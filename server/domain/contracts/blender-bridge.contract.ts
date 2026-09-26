export interface JsonRpcRequest<T = unknown> {
  readonly jsonrpc: '2.0';
  readonly id: string | number;
  readonly method: string;
  readonly params: T;
}

export interface JsonRpcError {
  readonly code: number;
  readonly message: string;
  readonly data?: unknown;
}

export interface JsonRpcResponse<T = unknown> {
  readonly jsonrpc: '2.0';
  readonly id: string | number;
  readonly result?: T;
  readonly error?: JsonRpcError;
}

export interface BlenderCommandResult<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly executionTimeMs: number;
}

export interface IBlenderBridge {
  connect(url?: string): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  sendCommand<TResult = unknown, TParams = unknown>(
    method: string,
    params: TParams
  ): Promise<BlenderCommandResult<TResult>>;
  executeScript<TResult>(
    script: string,
    context?: Record<string, unknown>
  ): Promise<BlenderCommandResult<TResult>>;
}
