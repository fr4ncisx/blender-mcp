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
const loungePngPath = path.join(outputDir, 'avatar_social_lounge.png');

test('Social Room Builder materializes and renders a complete 2:1 virtual avatar lounge in Blender 5.2.2 LTS', async () => {
  await fs.mkdir(outputDir, { recursive: true });

  const daemonManager = new ProcessDaemonManager({
    blenderPath: blenderExe,
    bridgeScriptPath: bridgeScript,
    port: 9877,
    host: '127.0.0.1'
  });

  let blenderProc: ChildProcess | null = null;
  const isAlreadyOpen = await daemonManager.isPortOpen(9877);

  if (!isAlreadyOpen) {
    blenderProc = spawn(blenderExe, ['--background', '--python', bridgeScript], {
      cwd: rootDir,
      stdio: 'pipe',
      env: { ...process.env, BLENDER_MCP_PORT: '9877' }
    });

    let portReady = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (await daemonManager.isPortOpen(9877)) {
        portReady = true;
        break;
      }
    }
    assert.equal(portReady, true);
  }

  const client = new WsBlenderClient({
    url: 'ws://127.0.0.1:9877',
    timeoutMs: 20000,
    reconnectIntervalMs: 500
  });

  await client.connect();
  assert.equal(client.isConnected(), true);

  try {
    const response = await handleSocialRoom(client, {
      width: 6,
      depth: 6,
      wallHeight: 2.2,
      floorStyle: 'checkerboard',
      tileSize: 1.0,
      renderOutput: loungePngPath,
      resolutionWidth: 512,
      palette: {
        floorLight: '#f5f0e6',
        floorDark: '#d48c66',
        wallColor: '#2b5876',
        wallTrim: '#1e3c52',
        accentColor: '#f1a94e'
      },
      furniture: [
        {
          type: 'sofa_double',
          gridX: 1,
          gridY: 3,
          rotationSteps: 0,
          primaryColor: '#f1a94e',
          secondaryColor: '#1e3c52'
        },
        {
          type: 'sofa_single',
          gridX: 3,
          gridY: 1,
          rotationSteps: 3,
          primaryColor: '#2ecc71',
          secondaryColor: '#1e3c52'
        },
        {
          type: 'coffee_table',
          gridX: 2,
          gridY: 2,
          rotationSteps: 0,
          secondaryColor: '#ecf0f1'
        },
        {
          type: 'bar_counter',
          gridX: 4,
          gridY: 4,
          rotationSteps: 0,
          primaryColor: '#e67e22',
          secondaryColor: '#34495e'
        },
        {
          type: 'bar_stool',
          gridX: 4,
          gridY: 3,
          rotationSteps: 0,
          primaryColor: '#e74c3c'
        },
        {
          type: 'potted_plant',
          gridX: 0,
          gridY: 4,
          rotationSteps: 0
        },
        {
          type: 'wall_art',
          gridX: 3,
          gridY: 5.8,
          rotationSteps: 0,
          primaryColor: '#9b59b6'
        }
      ]
    });

    assert.equal(response.isError, false);
    const parsedData = JSON.parse(response.content[0].text);
    assert.equal(parsedData.success, true);
    assert.equal(parsedData.data.furnitureCount, 7);
    assert.ok(parsedData.data.totalObjects >= 36);

    const stat = await fs.stat(loungePngPath);
    assert.ok(stat.size > 2000);
  } finally {
    await client.disconnect();
    if (blenderProc) {
      blenderProc.kill('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (!blenderProc.killed) {
        blenderProc.kill('SIGKILL');
      }
    }
  }
});
