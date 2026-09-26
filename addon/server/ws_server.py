import socket
import threading
import queue
import hashlib
import base64
import struct
import json
import traceback
import os

class BlenderWsServer:
    def __init__(self, host="127.0.0.1", port=9876, auth_token=None):
        self.host = host
        self.port = port
        self.auth_token = auth_token
        self.server_socket = None
        self.is_active = False
        self.listen_thread = None
        self.request_queue = queue.Queue()
        self.clients = []
        self.clients_lock = threading.Lock()

    def start(self):
        if self.is_active:
            return
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.server_socket.bind((self.host, self.port))
        self.server_socket.listen(5)
        self.is_active = True
        self.listen_thread = threading.Thread(target=self._accept_loop, daemon=True)
        self.listen_thread.start()

    def stop(self):
        self.is_active = False
        with self.clients_lock:
            for client in self.clients:
                try:
                    client.close()
                except Exception:
                    pass
            self.clients.clear()
        if self.server_socket:
            try:
                self.server_socket.close()
            except Exception:
                pass
            self.server_socket = None

    def is_running(self):
        return self.is_active

    def _accept_loop(self):
        while self.is_active:
            try:
                client_sock, _ = self.server_socket.accept()
                threading.Thread(target=self._handle_client, args=(client_sock,), daemon=True).start()
            except Exception:
                break

    def _handle_client(self, client_sock):
        try:
            handshake_data = client_sock.recv(4096).decode('utf-8', errors='ignore')
            if not self._perform_handshake(client_sock, handshake_data):
                client_sock.close()
                return

            with self.clients_lock:
                self.clients.append(client_sock)

            while self.is_active:
                msg = self._read_frame(client_sock)
                if msg is None:
                    break
                try:
                    payload = json.loads(msg)
                    self.request_queue.put((payload, client_sock))
                except json.JSONDecodeError:
                    error_resp = {
                        "jsonrpc": "2.0",
                        "id": None,
                        "error": {"code": -32700, "message": "Parse error"}
                    }
                    self._send_frame(client_sock, json.dumps(error_resp))
        except Exception:
            pass
        finally:
            with self.clients_lock:
                if client_sock in self.clients:
                    self.clients.remove(client_sock)
            try:
                client_sock.close()
            except Exception:
                pass

    def _perform_handshake(self, client_sock, raw_request):
        lines = raw_request.split('\r\n')
        headers = {}
        for line in lines[1:]:
            if ': ' in line:
                key, val = line.split(': ', 1)
                headers[key.lower()] = val

        if self.auth_token:
            auth_header = headers.get('authorization', '')
            expected = f"Bearer {self.auth_token}"
            if auth_header != expected:
                client_sock.sendall(b"HTTP/1.1 401 Unauthorized\r\n\r\n")
                return False

        sec_key = headers.get('sec-websocket-key')
        if not sec_key:
            client_sock.sendall(b"HTTP/1.1 400 Bad Request\r\n\r\n")
            return False

        guid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
        accept_raw = hashlib.sha1((sec_key + guid).encode('utf-8')).digest()
        accept_key = base64.b64encode(accept_raw).decode('utf-8')

        response = (
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Accept: {accept_key}\r\n\r\n"
        )
        client_sock.sendall(response.encode('utf-8'))
        return True

    def _read_frame(self, client_sock):
        head = client_sock.recv(2)
        if len(head) < 2:
            return None
        byte1, byte2 = head[0], head[1]
        opcode = byte1 & 0x0F
        if opcode == 0x8:
            return None

        is_masked = bool(byte2 & 0x80)
        payload_len = byte2 & 0x7F

        if payload_len == 126:
            ext = client_sock.recv(2)
            if len(ext) < 2:
                return None
            payload_len = struct.unpack("!H", ext)[0]
        elif payload_len == 127:
            ext = client_sock.recv(8)
            if len(ext) < 8:
                return None
            payload_len = struct.unpack("!Q", ext)[0]

        mask = None
        if is_masked:
            mask = client_sock.recv(4)
            if len(mask) < 4:
                return None

        received = bytearray()
        while len(received) < payload_len:
            chunk = client_sock.recv(min(4096, payload_len - len(received)))
            if not chunk:
                return None
            received.extend(chunk)

        if is_masked and mask:
            unmasked = bytearray(payload_len)
            for i in range(payload_len):
                unmasked[i] = received[i] ^ mask[i % 4]
            return unmasked.decode('utf-8', errors='ignore')

        return received.decode('utf-8', errors='ignore')

    def _send_frame(self, client_sock, text_message):
        payload = text_message.encode('utf-8')
        length = len(payload)
        header = bytearray([0x81])

        if length <= 125:
            header.append(length)
        elif length <= 65535:
            header.append(126)
            header.extend(struct.pack("!H", length))
        else:
            header.append(127)
            header.extend(struct.pack("!Q", length))

        try:
            client_sock.sendall(header + payload)
        except Exception:
            pass

    def drain_and_execute_requests(self, dispatch_fn):
        while not self.request_queue.empty():
            try:
                request, client_sock = self.request_queue.get_nowait()
            except queue.Empty:
                break

            req_id = request.get("id")
            method = request.get("method")
            params = request.get("params", {})

            try:
                result = dispatch_fn(method, params)
                response = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": result
                }
            except Exception as e:
                response = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {
                        "code": -32603,
                        "message": str(e),
                        "data": traceback.format_exc()
                    }
                }

            self._send_frame(client_sock, json.dumps(response))

_global_server = None

def get_server_instance(host="127.0.0.1", port=None, auth_token=None):
    global _global_server
    if _global_server is None:
        target_port = port if port is not None else int(os.environ.get("BLENDER_MCP_PORT", "9876"))
        _global_server = BlenderWsServer(host=host, port=target_port, auth_token=auth_token)
    return _global_server
