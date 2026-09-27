import { AppConfig } from '../../infrastructure/config/app-config.js';

const useColors =
  !process.env['NO_COLOR'] && process.stderr.isTTY === true;

const C = Object.freeze({
  reset: useColors ? '\x1b[0m' : '',
  bold: useColors ? '\x1b[1m' : '',
  dim: useColors ? '\x1b[2m' : '',
  cyan: useColors ? '\x1b[36m' : '',
  green: useColors ? '\x1b[32m' : '',
  yellow: useColors ? '\x1b[33m' : '',
  red: useColors ? '\x1b[31m' : '',
  magenta: useColors ? '\x1b[35m' : '',
  white: useColors ? '\x1b[37m' : '',
  bgDark: useColors ? '\x1b[48;5;235m' : '',
});

const BOX_WIDTH = 52;

function pad(text: string, width: number): string {
  return text.length >= width ? text.slice(0, width) : text + ' '.repeat(width - text.length);
}

function boxLine(content: string): string {
  return `${C.dim}║${C.reset}  ${content}  ${C.dim}║${C.reset}`;
}

function divider(): string {
  return `${C.dim}╠${'═'.repeat(BOX_WIDTH)}╣${C.reset}`;
}

function topBorder(): string {
  return `${C.dim}╔${'═'.repeat(BOX_WIDTH)}╗${C.reset}`;
}

function bottomBorder(): string {
  return `${C.dim}╚${'═'.repeat(BOX_WIDTH)}╝${C.reset}`;
}

function ts(): string {
  return `[${new Date().toLocaleTimeString('en-GB')}]`;
}

function truncateReason(reason: string): string {
  return reason.length > 80 ? reason.slice(0, 77) + '...' : reason;
}

function formatParams(keyParams: Record<string, unknown>): string {
  const keys = Object.keys(keyParams).slice(0, 2);
  const parts = keys.map(k => `${k}=${String(keyParams[k])}`);
  const joined = parts.join(', ');
  return joined.length > 60 ? joined.slice(0, 57) + '...' : joined;
}

export class TerminalLogger {
  static printStartupBanner(config: AppConfig, toolsCount: number): void {
    const version = '0.9.0';
    const titleContent = `${C.bold}${C.cyan}blender-mcp  v${version}${C.reset}`;
    const innerWidth = BOX_WIDTH - 4;

    const blenderStatus = config.isBlenderInstalled
      ? `${C.white}${pad(config.blenderPath ?? '', innerWidth - 14)}${C.reset}  ${C.green}✔ detected${C.reset}`
      : `${C.yellow}⚠ not found${C.reset}`;

    const lines = [
      topBorder(),
      `${C.dim}║${C.reset}  ${titleContent}${' '.repeat(Math.max(0, innerWidth - 16))}  ${C.dim}║${C.reset}`,
      divider(),
      boxLine(`${C.white}Bridge   ${C.reset}${C.white}${config.wsUrl}${C.reset}`),
      boxLine(`${C.white}Host     ${C.reset}${C.white}${config.blenderHost}${C.reset}       ${C.white}Port  ${config.blenderPort}${C.reset}`),
      boxLine(`${C.white}Transport  stdio         Tools  ${toolsCount}${C.reset}`),
      boxLine(`${C.white}Node     ${process.version}         PID   ${process.pid}${C.reset}`),
      boxLine(`${C.white}Blender  ${C.reset}${blenderStatus}`),
      boxLine(`${C.white}Engine   READY${C.reset}`),
      bottomBorder(),
    ];

    process.stderr.write(lines.join('\n') + '\n');
  }

  static printFailFastBanner(config: AppConfig): void {
    void config;
    const lines = [
      `${C.red}${C.bold}╔${'═'.repeat(BOX_WIDTH)}╗${C.reset}`,
      `${C.red}${C.bold}║  ✖  FATAL: Blender not found — cannot start${' '.repeat(BOX_WIDTH - 45)}║${C.reset}`,
      `${C.red}${C.bold}╠${'═'.repeat(BOX_WIDTH)}╣${C.reset}`,
      `${C.red}${C.bold}║  Install Blender 3.6 LTS or later, then retry.${' '.repeat(BOX_WIDTH - 47)}║${C.reset}`,
      `${C.red}${C.bold}║  https://www.blender.org/download/${' '.repeat(BOX_WIDTH - 35)}║${C.reset}`,
      `${C.red}${C.bold}║  Or set: BLENDER_PATH=/path/to/blender${' '.repeat(BOX_WIDTH - 39)}║${C.reset}`,
      `${C.red}${C.bold}╚${'═'.repeat(BOX_WIDTH)}╝${C.reset}`,
    ];
    process.stderr.write(lines.join('\n') + '\n');
  }

  static logToolStart(toolName: string, keyParams: Record<string, unknown>): void {
    const paramStr = formatParams(keyParams);
    const suffix = paramStr.length > 0 ? ` (${paramStr})` : '';
    process.stderr.write(
      `${C.cyan}${ts()} [MCP] → Executing tool: ${toolName}${suffix}${C.reset}\n`
    );
  }

  static logToolSuccess(toolName: string, durationMs: number): void {
    void toolName;
    process.stderr.write(
      `${C.green}${ts()} [MCP] ✔ Tool completed in ${durationMs}ms (status: success)${C.reset}\n`
    );
  }

  static logToolError(toolName: string, durationMs: number, reason: string): void {
    void toolName;
    process.stderr.write(
      `${C.red}${ts()} [MCP] ✖ Tool failed in ${durationMs}ms (${truncateReason(reason)})${C.reset}\n`
    );
  }

  static logInfo(message: string): void {
    process.stderr.write(
      `${C.cyan}${ts()} [MCP] ℹ ${message}${C.reset}\n`
    );
  }
}
