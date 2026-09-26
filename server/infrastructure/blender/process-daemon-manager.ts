import { spawn, ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';

export interface ProcessDaemonOptions {
  readonly blenderPath?: string;
  readonly bridgeScriptPath?: string;
  readonly port?: number;
  readonly host?: string;
  readonly startupTimeoutMs?: number;
}

export class ProcessDaemonManager {
  private readonly _blenderPath: string;
  private readonly _bridgeScriptPath: string;
  private readonly _port: number;
  private readonly _host: string;
  private readonly _startupTimeoutMs: number;
  private _process: ChildProcess | null = null;

  constructor(options?: ProcessDaemonOptions) {
    this._blenderPath =
      options?.blenderPath ||
      process.env['BLENDER_PATH'] ||
      this._resolveDefaultBlenderExecutable();
    this._bridgeScriptPath =
      options?.bridgeScriptPath ||
      process.env['BLENDER_BRIDGE_SCRIPT'] ||
      'scripts/blender_bridge_server.py';
    this._port = options?.port ?? 9876;
    this._host = options?.host ?? '127.0.0.1';
    this._startupTimeoutMs = options?.startupTimeoutMs ?? 15000;
  }

  private _resolveDefaultBlenderExecutable(): string {
    if (process.platform === 'win32') {
      const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
      const baseDir = path.join(programFiles, 'Blender Foundation');
      if (fs.existsSync(baseDir)) {
        try {
          const entries = fs.readdirSync(baseDir);
          for (const entry of entries) {
            const exeCandidate = path.join(baseDir, entry, 'blender.exe');
            if (fs.existsSync(exeCandidate)) {
              return exeCandidate;
            }
          }
        } catch {
          return 'blender';
        }
      }
    } else if (process.platform === 'darwin') {
      const macPath = '/Applications/Blender.app/Contents/MacOS/Blender';
      if (fs.existsSync(macPath)) {
        return macPath;
      }
    }
    return 'blender';
  }

  public async isPortOpen(port: number = this._port, host: string = this._host): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(1000);

      const cleanup = (): void => {
        socket.removeAllListeners();
        socket.destroy();
      };

      socket.once('connect', () => {
        cleanup();
        resolve(true);
      });

      socket.once('timeout', () => {
        cleanup();
        resolve(false);
      });

      socket.once('error', () => {
        cleanup();
        resolve(false);
      });

      socket.connect(port, host);
    });
  }

  public async ensureRunning(): Promise<void> {
    const alreadyOpen = await this.isPortOpen();
    if (alreadyOpen) {
      return;
    }

    if (this._process) {
      this.stop();
    }

    const args = ['-b', '-P', this._bridgeScriptPath];
    this._process = spawn(this._blenderPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
      env: {
        ...process.env,
        BLENDER_RPC_PORT: String(this._port)
      }
    });

    const startTime = Date.now();
    while (Date.now() - startTime < this._startupTimeoutMs) {
      if (await this.isPortOpen()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    this.stop();
    throw new Error(
      `Blender headless daemon failed to bind port ${this._port} within ${this._startupTimeoutMs}ms`
    );
  }

  public stop(): void {
    if (this._process) {
      this._process.kill('SIGTERM');
      this._process = null;
    }
  }

  public isRunning(): boolean {
    return this._process !== null && !this._process.killed;
  }
}
