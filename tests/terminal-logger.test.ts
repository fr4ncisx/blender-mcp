import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TerminalLogger } from '../server/presentation/logging/terminal-logger.js';
import { AppConfig } from '../server/infrastructure/config/app-config.js';

const mockConfigInstalled = {
  blenderHost: '127.0.0.1',
  blenderPort: 9876,
  blenderPath: process.execPath,
  authToken: undefined,
  timeoutMs: 15000,
  wsUrl: 'ws://127.0.0.1:9876/blender-rpc',
  isBlenderInstalled: true,
  failFast: false
} as AppConfig;

const mockConfigNotInstalled = {
  blenderHost: '127.0.0.1',
  blenderPort: 9876,
  blenderPath: undefined,
  authToken: undefined,
  timeoutMs: 15000,
  wsUrl: 'ws://127.0.0.1:9876/blender-rpc',
  isBlenderInstalled: false,
  failFast: false
} as AppConfig;

function captureStderr(fn: () => void): string {
  let captured = '';
  const original = process.stderr.write.bind(process.stderr);
  (process.stderr as NodeJS.WriteStream).write = (chunk: string | Uint8Array): boolean => {
    captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString();
    return true;
  };
  fn();
  (process.stderr as NodeJS.WriteStream).write = original;
  return captured;
}

describe('TerminalLogger', () => {
  test('logToolStart writes to stderr and contains tool name', () => {
    const output = captureStderr(() => {
      TerminalLogger.logToolStart('my_tool', { key: 'val' });
    });
    assert.ok(output.includes('my_tool'));
  });

  test('logToolSuccess writes to stderr and contains success and duration', () => {
    const output = captureStderr(() => {
      TerminalLogger.logToolSuccess('my_tool', 42);
    });
    assert.ok(output.includes('success'));
    assert.ok(output.includes('42'));
  });

  test('logToolError writes to stderr and contains failed and reason', () => {
    const output = captureStderr(() => {
      TerminalLogger.logToolError('my_tool', 10, 'connection refused');
    });
    assert.ok(output.includes('failed'));
    assert.ok(output.includes('connection refused'));
  });

  test('logInfo writes to stderr', () => {
    const output = captureStderr(() => {
      TerminalLogger.logInfo('Server started');
    });
    assert.ok(output.includes('Server started'));
  });

  test('printStartupBanner with isBlenderInstalled true writes startup box to stderr', () => {
    const output = captureStderr(() => {
      TerminalLogger.printStartupBanner(mockConfigInstalled, 10);
    });
    assert.ok(output.includes('blender-mcp'));
    assert.ok(output.includes('READY'));
  });

  test('printFailFastBanner writes fatal box containing FATAL', () => {
    const output = captureStderr(() => {
      TerminalLogger.printFailFastBanner(mockConfigNotInstalled);
    });
    assert.ok(output.includes('FATAL'));
  });
});
