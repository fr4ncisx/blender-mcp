import WebSocket from 'ws';
import {
  IBlenderBridge,
  JsonRpcRequest,
  JsonRpcResponse,
  BlenderCommandResult
} from '../../domain/contracts/blender-bridge.contract.js';

export interface WsBlenderClientOptions {
  readonly url?: string;
  readonly authToken?: string;
  readonly timeoutMs?: number;
  readonly maxReconnectAttempts?: number;
  readonly reconnectIntervalMs?: number;
}

interface PendingPromise {
  readonly resolve: (res: JsonRpcResponse<unknown>) => void;
  readonly reject: (err: Error) => void;
  readonly timer: NodeJS.Timeout;
  readonly startTime: number;
}

export class WsBlenderClient implements IBlenderBridge {
  private readonly _url: string;
  private readonly _authToken?: string;
  private readonly _timeoutMs: number;
  private readonly _maxReconnectAttempts: number;
  private readonly _reconnectIntervalMs: number;
  private _ws: WebSocket | null = null;
  private _requestId = 0;
  private readonly _pending = new Map<string | number, PendingPromise>();
  private _connected = false;

  constructor(options?: WsBlenderClientOptions) {
    this._url = options?.url ?? 'ws://127.0.0.1:9876/blender-rpc';
    this._authToken = options?.authToken;
    this._timeoutMs = options?.timeoutMs ?? 30000;
    this._maxReconnectAttempts = options?.maxReconnectAttempts ?? 3;
    this._reconnectIntervalMs = options?.reconnectIntervalMs ?? 1000;
  }

  public isConnected(): boolean {
    return this._connected && this._ws !== null && this._ws.readyState === WebSocket.OPEN;
  }

  public async connect(urlOverride?: string): Promise<void> {
    const targetUrl = urlOverride ?? this._url;

    if (this.isConnected()) {
      return;
    }

    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < this._maxReconnectAttempts) {
      try {
        await this.attemptConnection(targetUrl);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        attempts++;
        if (attempts < this._maxReconnectAttempts) {
          await new Promise((resolve) => setTimeout(resolve, this._reconnectIntervalMs));
        }
      }
    }

    throw new Error(
      `Failed to connect to Blender WebSocket at ${targetUrl} after ${this._maxReconnectAttempts} attempts: ${lastError?.message}`
    );
  }

  public async disconnect(): Promise<void> {
    for (const [id, pending] of this._pending.entries()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('WebSocket client disconnected'));
      this._pending.delete(id);
    }

    if (this._ws) {
      this._ws.removeAllListeners();
      this._ws.close();
      this._ws = null;
    }

    this._connected = false;
  }

  public async sendCommand<TResult = unknown, TParams = unknown>(
    method: string,
    params: TParams
  ): Promise<BlenderCommandResult<TResult>> {
    if (!this.isConnected()) {
      await this.connect();
    }

    const id = ++this._requestId;
    const request: JsonRpcRequest<TParams> = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    const startTime = Date.now();

    return new Promise<BlenderCommandResult<TResult>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(id);
        resolve({
          success: false,
          error: `Blender RPC request timed out after ${this._timeoutMs}ms for method '${method}'`,
          executionTimeMs: Date.now() - startTime
        });
      }, this._timeoutMs);

      this._pending.set(id, {
        resolve: (response: JsonRpcResponse<unknown>) => {
          const executionTimeMs = Date.now() - startTime;
          if (response.error) {
            resolve({
              success: false,
              error: `RPC Error ${response.error.code}: ${response.error.message}`,
              executionTimeMs
            });
          } else {
            resolve({
              success: true,
              data: response.result as TResult,
              executionTimeMs
            });
          }
        },
        reject: (error: Error) => {
          resolve({
            success: false,
            error: error.message,
            executionTimeMs: Date.now() - startTime
          });
        },
        timer,
        startTime
      });

      if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
        clearTimeout(timer);
        this._pending.delete(id);
        reject(new Error('WebSocket connection is not open'));
        return;
      }

      this._ws.send(JSON.stringify(request), (err) => {
        if (err) {
          clearTimeout(timer);
          this._pending.delete(id);
          reject(err);
        }
      });
    });
  }

  public async executeScript<TResult>(
    script: string,
    context?: Record<string, unknown>
  ): Promise<BlenderCommandResult<TResult>> {
    return this.sendCommand<TResult>('execute_script', {
      script,
      context
    });
  }

  private attemptConnection(targetUrl: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const headers: Record<string, string> = {};
      if (this._authToken) {
        headers['Authorization'] = `Bearer ${this._authToken}`;
      }

      const ws = new WebSocket(targetUrl, { headers });

      const onOpen = (): void => {
        cleanup();
        this._ws = ws;
        this._connected = true;
        this.setupSocketListeners(ws);
        resolve();
      };

      const onError = (err: Error): void => {
        cleanup();
        reject(err);
      };

      const cleanup = (): void => {
        ws.removeListener('open', onOpen);
        ws.removeListener('error', onError);
      };

      ws.once('open', onOpen);
      ws.once('error', onError);
    });
  }

  private setupSocketListeners(ws: WebSocket): void {
    ws.on('message', (data: WebSocket.RawData) => {
      try {
        const text = data.toString('utf-8');
        const parsed = JSON.parse(text) as JsonRpcResponse<unknown>;

        if (parsed && (typeof parsed.id === 'string' || typeof parsed.id === 'number')) {
          const pending = this._pending.get(parsed.id);
          if (pending) {
            clearTimeout(pending.timer);
            this._pending.delete(parsed.id);
            pending.resolve(parsed);
          }
        }
      } catch (err) {
        return;
      }
    });

    ws.on('close', () => {
      this._connected = false;
      for (const [id, pending] of this._pending.entries()) {
        clearTimeout(pending.timer);
        pending.reject(new Error('WebSocket connection closed by remote host'));
        this._pending.delete(id);
      }
    });

    ws.on('error', () => {
      this._connected = false;
    });
  }
}
