import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { fileURLToPath } from 'node:url';

import { WsBlenderClient } from '../server/infrastructure/blender/ws-blender-client.js';
import { ProcessDaemonManager } from '../server/infrastructure/blender/process-daemon-manager.js';
import { handleSocialRoom } from '../server/presentation/mcp/tools/social-room.tool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function resolveBlenderExecutable(): string {
  if (process.env['BLENDER_PATH']) {
    return process.env['BLENDER_PATH'];
  }
  if (process.platform === 'win32') {
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const candidateBase = path.join(programFiles, 'Blender Foundation');
    try {
      if (fsSync.existsSync(candidateBase)) {
        const entries = fsSync.readdirSync(candidateBase);
        for (const entry of entries) {
          const candidateExe = path.join(candidateBase, entry, 'blender.exe');
          if (fsSync.existsSync(candidateExe)) {
            return candidateExe;
          }
        }
      }
    } catch {
      return 'blender';
    }
  } else if (process.platform === 'darwin') {
    const macPath = '/Applications/Blender.app/Contents/MacOS/Blender';
    if (fsSync.existsSync(macPath)) {
      return macPath;
    }
  }
  return 'blender';
}

const blenderExe = resolveBlenderExecutable();
const bridgeScript = path.join(rootDir, 'scripts', 'blender_bridge_server.py');
const outputDir = path.join(rootDir, 'output', 'blender', 'rooms');
const habboBarPngPath = path.join(outputDir, 'habbo_rooftop_bar.png');
const testPort = 9879;

test('Habbo Rooftop Bar materializes in Blender 5.2.2 LTS reproducing the iconic bar diorama', async () => {
  await fs.mkdir(outputDir, { recursive: true });

  const daemonManager = new ProcessDaemonManager({
    blenderPath: blenderExe,
    bridgeScriptPath: bridgeScript,
    port: testPort,
    host: '127.0.0.1'
  });

  let blenderProc: ChildProcess | null = null;
  const isAlreadyOpen = await daemonManager.isPortOpen(testPort);

  if (!isAlreadyOpen) {
    blenderProc = spawn(blenderExe, ['--background', '--python', bridgeScript], {
      cwd: rootDir,
      stdio: 'pipe',
      env: { ...process.env, BLENDER_MCP_PORT: String(testPort) }
    });

    let portReady = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (await daemonManager.isPortOpen(testPort)) {
        portReady = true;
        break;
      }
    }
    assert.equal(portReady, true);
  }

  const client = new WsBlenderClient({
    url: `ws://127.0.0.1:${testPort}`,
    timeoutMs: 25000,
    reconnectIntervalMs: 500
  });

  await client.connect();
  assert.equal(client.isConnected(), true);

  try {
    const directResult = await client.sendCommand<Record<string, unknown>>('build_habbo_bar', {
      renderOutput: habboBarPngPath,
      resolutionWidth: 640,
      resolutionHeight: 480,
      tileSize: 0.5
    });

    assert.equal(directResult.success, true);
    assert.equal(directResult.data?.['theme'], 'habbo_rooftop_bar');

    const stat = await fs.stat(habboBarPngPath);
    assert.ok(stat.size > 20000);

    const mcpResponse = await handleSocialRoom(client, {
      theme: 'habbo_bar',
      renderOutput: habboBarPngPath,
      resolutionWidth: 640,
      tileSize: 0.5,
      targetFramework: 'phaser_defold'
    });

    assert.equal(mcpResponse.isError, false);
    const parsedMcp = JSON.parse(mcpResponse.content[0].text);
    assert.equal(parsedMcp.success, true);

  } finally {
    await client.disconnect();
    if (blenderProc) {
      blenderProc.kill();
    }
  }
});
