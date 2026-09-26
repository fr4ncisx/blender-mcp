import sys
import os
import time
import signal

script_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(script_dir, ".."))
ext_dir = os.path.join(root_dir, "addon")

if root_dir not in sys.path:
    sys.path.insert(0, root_dir)
if ext_dir not in sys.path:
    sys.path.insert(0, ext_dir)

import bpy
from addon.server.ws_server import get_server_instance
from addon.server.protocol_router import ProtocolRouter

b_ver = bpy.app.version
b_ver_str = f"{b_ver[0]}.{b_ver[1]}.{b_ver[2]}"
engine_mode = "EEVEE Next" if b_ver >= (4, 2, 0) else "EEVEE Classic"
print(f"[blender-iso-mcp] Initialized bridge on Blender {b_ver_str} ({engine_mode})")

server = get_server_instance()
server.start()
router = ProtocolRouter.get_instance()

running = True

def _handle_exit(sig, frame):
    global running
    running = False

signal.signal(signal.SIGINT, _handle_exit)
signal.signal(signal.SIGTERM, _handle_exit)

try:
    while running:
        server.drain_and_execute_requests(router.dispatch)
        time.sleep(0.01)
except Exception:
    pass
finally:
    server.stop()
