import path from 'node:path';
import fs from 'node:fs';

export interface AppConfigParams {
  readonly blenderHost: string;
  readonly blenderPort: number;
  readonly blenderPath?: string;
  readonly authToken?: string;
  readonly timeoutMs: number;
  readonly wsUrl: string;
}

export class AppConfig {
  public readonly blenderHost: string;
  public readonly blenderPort: number;
  public readonly blenderPath?: string;
  public readonly authToken?: string;
  public readonly timeoutMs: number;
  public readonly wsUrl: string;

  constructor(params: AppConfigParams) {
    this.blenderHost = params.blenderHost;
    this.blenderPort = params.blenderPort;
    this.blenderPath = params.blenderPath;
    this.authToken = params.authToken;
    this.timeoutMs = params.timeoutMs;
    this.wsUrl = params.wsUrl;
    Object.freeze(this);
  }

  public static load(
    cliArgs: readonly string[] = process.argv.slice(2),
    env: Record<string, string | undefined> = process.env,
    cwd: string = process.cwd()
  ): AppConfig {
    const cliValues = AppConfig.parseCliArgs(cliArgs);
    const dotEnvValues = AppConfig.parseDotEnv(cwd);

    const host =
      cliValues['host'] ??
      env['BLENDER_HOST'] ??
      dotEnvValues['BLENDER_HOST'] ??
      '127.0.0.1';

    const rawPort =
      cliValues['port'] ??
      env['BLENDER_PORT'] ??
      dotEnvValues['BLENDER_PORT'] ??
      '9876';
    const port = AppConfig.sanitizePort(rawPort, 9876);

    const rawTimeout =
      cliValues['timeout'] ??
      env['BLENDER_TIMEOUT_MS'] ??
      dotEnvValues['BLENDER_TIMEOUT_MS'] ??
      '15000';
    const timeoutMs = AppConfig.sanitizePositiveInt(rawTimeout, 15000);

    const authToken =
      cliValues['token'] ??
      env['BLENDER_AUTH_TOKEN'] ??
      dotEnvValues['BLENDER_AUTH_TOKEN'];

    const rawBlenderPath =
      cliValues['blender'] ??
      env['BLENDER_PATH'] ??
      dotEnvValues['BLENDER_PATH'];
    const blenderPath = rawBlenderPath ?? AppConfig.detectSystemBlenderPath(env);

    const wsUrl = `ws://${host}:${port}/blender-rpc`;

    return new AppConfig({
      blenderHost: host,
      blenderPort: port,
      blenderPath,
      authToken,
      timeoutMs,
      wsUrl
    });
  }

  private static parseCliArgs(args: readonly string[]): Record<string, string> {
    const result: Record<string, string> = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (!arg) continue;

      if (arg.startsWith('--')) {
        const eqIdx = arg.indexOf('=');
        if (eqIdx !== -1) {
          const key = arg.slice(2, eqIdx).trim();
          const val = arg.slice(eqIdx + 1).trim();
          result[key] = val;
        } else {
          const key = arg.slice(2).trim();
          const next = args[i + 1];
          if (next && !next.startsWith('-')) {
            result[key] = next.trim();
            i++;
          } else {
            result[key] = 'true';
          }
        }
      } else if (arg.startsWith('-') && arg.length === 2) {
        const flag = arg.slice(1);
        const next = args[i + 1];
        let mappedKey: string | undefined;

        if (flag === 'p') mappedKey = 'port';
        if (flag === 'h') mappedKey = 'host';
        if (flag === 'b') mappedKey = 'blender';
        if (flag === 't') mappedKey = 'token';

        if (mappedKey && next && !next.startsWith('-')) {
          result[mappedKey] = next.trim();
          i++;
        }
      }
    }

    return result;
  }

  private static parseDotEnv(cwd: string): Record<string, string> {
    const envPath = path.resolve(cwd, '.env');
    if (!fs.existsSync(envPath)) {
      return {};
    }

    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      const lines = content.split('\n');
      const values: Record<string, string> = {};

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length === 0 || trimmed.startsWith('#')) {
          continue;
        }

        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) {
          continue;
        }

        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();

        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }

        if (key.length > 0) {
          values[key] = val;
        }
      }

      return values;
    } catch {
      return {};
    }
  }

  private static sanitizePort(value: string, fallback: number): number {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed <= 0 || parsed > 65535) {
      return fallback;
    }
    return parsed;
  }

  private static sanitizePositiveInt(value: string, fallback: number): number {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed <= 0) {
      return fallback;
    }
    return parsed;
  }

  private static detectSystemBlenderPath(
    env: Record<string, string | undefined>
  ): string | undefined {
    if (process.platform === 'win32') {
      const programFiles = env['ProgramFiles'] || 'C:\\Program Files';
      const candidateBase = path.join(programFiles, 'Blender Foundation');
      if (fs.existsSync(candidateBase)) {
        try {
          const entries = fs.readdirSync(candidateBase);
          for (const entry of entries) {
            const candidateExe = path.join(candidateBase, entry, 'blender.exe');
            if (fs.existsSync(candidateExe)) {
              return candidateExe;
            }
          }
        } catch {
          return undefined;
        }
      }
    } else if (process.platform === 'darwin') {
      const macPath = '/Applications/Blender.app/Contents/MacOS/Blender';
      if (fs.existsSync(macPath)) {
        return macPath;
      }
    }
    return undefined;
  }
}
