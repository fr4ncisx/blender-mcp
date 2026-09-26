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
const artDecoLoungePngPath = path.join(outputDir, 'art_deco_lounge.png');
const testPort = 9882;

test('Art Deco Cyberpunk Lounge materializes in Blender 5.2.2 LTS with high density and web manifests', async () => {
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
    timeoutMs: 30000,
    reconnectIntervalMs: 500
  });

  await client.connect();
  assert.equal(client.isConnected(), true);

  try {
    const response = await handleSocialRoom(client, {
      theme: 'art_deco_cyberpunk',
      roomScale: 'grand',
      capacityTarget: 80,
      width: 16,
      depth: 16,
      wallHeight: 2.6,
      tileSize: 0.5,
      floorStyle: 'architectural_stone',
      palette: {
        floorLight: '#1a1a1a',
        floorDark: '#05472a',
        wallColor: '#1a1a1a',
        wallTrim: '#d4af37',
        accentColor: '#ff007f',
        secondaryAccent: '#00f0ff',
        metalAccent: '#d4af37',
        woodAccent: '#1a1a1a'
      },
      furniture: [
        { type: 'curved_sofa', gridX: 2, gridY: 14, elevation: 0.0, rotationSteps: 0, primaryColor: '#ff007f', secondaryColor: '#d4af37' },
        { type: 'bar_counter', gridX: 2, gridY: 12, elevation: 0.0, rotationSteps: 0, primaryColor: '#d4af37', secondaryColor: '#1a1a1a' },
        { type: 'bar_counter', gridX: 3, gridY: 12, elevation: 0.0, rotationSteps: 0, primaryColor: '#d4af37', secondaryColor: '#1a1a1a' },
        { type: 'bar_counter', gridX: 4, gridY: 12, elevation: 0.0, rotationSteps: 0, primaryColor: '#d4af37', secondaryColor: '#1a1a1a' },
        { type: 'bar_stool', gridX: 2, gridY: 11, elevation: 0.0, rotationSteps: 0, primaryColor: '#05472a', secondaryColor: '#d4af37' },
        { type: 'bar_stool', gridX: 3, gridY: 11, elevation: 0.0, rotationSteps: 0, primaryColor: '#05472a', secondaryColor: '#d4af37' },
        { type: 'bar_stool', gridX: 4, gridY: 11, elevation: 0.0, rotationSteps: 0, primaryColor: '#05472a', secondaryColor: '#d4af37' },
        { type: 'dj_booth', gridX: 8, gridY: 14, elevation: 0.0, rotationSteps: 0, primaryColor: '#00f0ff', secondaryColor: '#ff007f' },
        { type: 'speaker_stack', gridX: 7, gridY: 14, elevation: 0.0, rotationSteps: 0, primaryColor: '#1a1a1a', secondaryColor: '#ff007f' },
        { type: 'speaker_stack', gridX: 9, gridY: 14, elevation: 0.0, rotationSteps: 0, primaryColor: '#1a1a1a', secondaryColor: '#ff007f' },
        { type: 'vip_table', gridX: 12, gridY: 12, elevation: 0.0, rotationSteps: 0, primaryColor: '#d4af37', secondaryColor: '#05472a' },
        { type: 'sofa_double', gridX: 12, gridY: 13, elevation: 0.0, rotationSteps: 0, primaryColor: '#ff007f', secondaryColor: '#d4af37' },
        { type: 'sofa_single', gridX: 12, gridY: 11, elevation: 0.0, rotationSteps: 0, primaryColor: '#ff007f', secondaryColor: '#d4af37' },
        { type: 'floor_lamp', gridX: 14, gridY: 14, elevation: 0.0, rotationSteps: 0, primaryColor: '#d4af37', secondaryColor: '#00f0ff' },
        { type: 'floor_lamp', gridX: 1, gridY: 14, elevation: 0.0, rotationSteps: 0, primaryColor: '#d4af37', secondaryColor: '#00f0ff' },
        { type: 'curved_sofa', gridX: 5, gridY: 6, elevation: 0.0, rotationSteps: 0, primaryColor: '#05472a', secondaryColor: '#d4af37' },
        { type: 'curved_sofa', gridX: 10, gridY: 6, elevation: 0.0, rotationSteps: 0, primaryColor: '#05472a', secondaryColor: '#d4af37' },
        { type: 'doorway_frame', gridX: 8, gridY: 0, elevation: 0.0, rotationSteps: 0, primaryColor: '#d4af37', secondaryColor: '#1a1a1a' },
        { type: 'entrance_mat', gridX: 8, gridY: 1, elevation: 0.0, rotationSteps: 0, primaryColor: '#ff007f', secondaryColor: '#05472a' },
        { type: 'transition_pad', gridX: 8, gridY: 2, elevation: 0.0, rotationSteps: 0, primaryColor: '#00f0ff', secondaryColor: '#d4af37' }
      ],
      renderOutput: artDecoLoungePngPath,
      resolutionWidth: 1024,
      targetFramework: 'phaser_defold'
    });

    assert.equal(response.isError, false);
    const parsed = JSON.parse(response.content[0].text);
    assert.equal(parsed.success, true);
    assert.equal(parsed.theme, 'art_deco_cyberpunk');

    const fileExists = fsSync.existsSync(artDecoLoungePngPath);
    assert.equal(fileExists, true);
    const stat = await fs.stat(artDecoLoungePngPath);
    assert.ok(stat.size > 20000, `Expected render size > 20000 bytes, got ${stat.size}`);

    assert.ok(parsed.frameworkExports);
  } finally {
    await client.disconnect();
    if (blenderProc) {
      blenderProc.kill();
    }
  }
});
