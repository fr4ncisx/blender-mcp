import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { AppConfig } from '../server/infrastructure/config/app-config.js';

test('AppConfig loads zero-config defaults when no args or env are present', () => {
  const config = AppConfig.load([], {}, os.tmpdir());

  assert.equal(config.blenderHost, '127.0.0.1');
  assert.equal(config.blenderPort, 9876);
  assert.equal(config.timeoutMs, 15000);
  assert.equal(config.wsUrl, 'ws://127.0.0.1:9876/blender-rpc');
  assert.equal(config.authToken, undefined);
  assert.equal(Object.isFrozen(config), true);
});

test('AppConfig prioritizes environment variables over defaults', () => {
  const customEnv = {
    BLENDER_HOST: '192.168.1.100',
    BLENDER_PORT: '9880',
    BLENDER_TIMEOUT_MS: '20000',
    BLENDER_AUTH_TOKEN: 'secret_mcp_token_xyz',
    BLENDER_PATH: '/custom/path/blender'
  };

  const config = AppConfig.load([], customEnv, os.tmpdir());

  assert.equal(config.blenderHost, '192.168.1.100');
  assert.equal(config.blenderPort, 9880);
  assert.equal(config.timeoutMs, 20000);
  assert.equal(config.authToken, 'secret_mcp_token_xyz');
  assert.equal(config.blenderPath, '/custom/path/blender');
  assert.equal(config.wsUrl, 'ws://192.168.1.100:9880/blender-rpc');
});

test('AppConfig prioritizes CLI arguments over environment variables', () => {
  const customEnv = {
    BLENDER_HOST: '192.168.1.100',
    BLENDER_PORT: '9880',
    BLENDER_TIMEOUT_MS: '20000',
    BLENDER_AUTH_TOKEN: 'env_token'
  };

  const cliArgs = [
    '--port=9999',
    '--host=10.0.0.1',
    '--token=cli_token',
    '--timeout=45000',
    '--blender=/cli/blender'
  ];

  const config = AppConfig.load(cliArgs, customEnv, os.tmpdir());

  assert.equal(config.blenderHost, '10.0.0.1');
  assert.equal(config.blenderPort, 9999);
  assert.equal(config.timeoutMs, 45000);
  assert.equal(config.authToken, 'cli_token');
  assert.equal(config.blenderPath, '/cli/blender');
  assert.equal(config.wsUrl, 'ws://10.0.0.1:9999/blender-rpc');
});

test('AppConfig supports short CLI flags', () => {
  const cliArgs = ['-p', '9123', '-h', '0.0.0.0', '-t', 'short_tok', '-b', '/short/blender'];
  const config = AppConfig.load(cliArgs, {}, os.tmpdir());

  assert.equal(config.blenderPort, 9123);
  assert.equal(config.blenderHost, '0.0.0.0');
  assert.equal(config.authToken, 'short_tok');
  assert.equal(config.blenderPath, '/short/blender');
});

test('AppConfig parses local .env file when present in directory', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'iso-appconfig-test-'));
  try {
    const envContent = [
      '# This is a comment',
      'BLENDER_PORT=8888',
      'BLENDER_HOST="127.0.0.99"',
      "BLENDER_AUTH_TOKEN='dotenv_token'",
      'BLENDER_TIMEOUT_MS=12000'
    ].join('\n');

    await fs.writeFile(path.join(tmpDir, '.env'), envContent, 'utf-8');

    const config = AppConfig.load([], {}, tmpDir);

    assert.equal(config.blenderPort, 8888);
    assert.equal(config.blenderHost, '127.0.0.99');
    assert.equal(config.authToken, 'dotenv_token');
    assert.equal(config.timeoutMs, 12000);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('AppConfig falls back gracefully when given invalid port or timeout numbers', () => {
  const cliArgs = ['--port=invalid_port', '--timeout=-999'];
  const config = AppConfig.load(cliArgs, {}, os.tmpdir());

  assert.equal(config.blenderPort, 9876);
  assert.equal(config.timeoutMs, 15000);
});
