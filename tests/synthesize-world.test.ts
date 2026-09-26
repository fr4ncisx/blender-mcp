import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { fileURLToPath } from 'node:url';

import { WsBlenderClient } from '../server/infrastructure/blender/ws-blender-client.js';
import { ProcessDaemonManager } from '../server/infrastructure/blender/process-daemon-manager.js';
import { SafePathSanitizer } from '../server/infrastructure/storage/safe-path-sanitizer.js';
import { AssetCacheManager } from '../server/infrastructure/cache/asset-cache-manager.js';
import { handleSynthesizeWorld } from '../server/presentation/mcp/tools/synthesize-world.tool.js';

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
const worldName = 'synth_integration_world';
const imagePath = path.join(outputDir, `${worldName}.png`);
const manifestPath = path.join(outputDir, `${worldName}_manifest.json`);
const testPort = 9883;

test('World Synthesizer Engine produces 2:1 dimetric diorama, in-chat image preview, and manifests in Blender 5.2.2 LTS', async () => {
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

  const sanitizer = new SafePathSanitizer();
  const cacheManager = new AssetCacheManager(sanitizer);

  const blueprintGrid = [
    '############',
    '#0000000000#',
    '#0111111110#',
    '#0122222210#',
    '#012B..B210#',
    '#012....210#',
    '#01S..T.S10#',
    '#01S....S10#',
    '#01^....v10#',
    '#01L....L10#',
    '#0000D00000#',
    '############'
  ].join('\n');

  try {
    const response = await handleSynthesizeWorld(client, sanitizer, cacheManager, {
      blueprint: blueprintGrid,
      name: worldName,
      theme: 'art_deco_cyberpunk',
      tileWidth: 128,
      includePreview: true
    });

    assert.equal(response.isError, false);
    assert.ok(fsSync.existsSync(imagePath));

    const stats = await fs.stat(imagePath);
    assert.ok(stats.size > 1024);

    const imgContent = response.content.find((c) => c.type === 'image');
    assert.ok(imgContent);
    assert.equal(imgContent.mimeType, 'image/png');
    assert.ok(imgContent.data.length > 100);

    assert.ok(fsSync.existsSync(manifestPath));
    const manifestData = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
    assert.equal(manifestData.name, worldName);
    assert.ok(manifestData.collisions.length > 0);
    assert.ok(manifestData.waypoints.length > 0);
    assert.ok(manifestData.seats.length > 0);
    assert.ok(manifestData.lights.length > 0);
    assert.ok(manifestData.stairs.length > 0);
  } finally {
    if (client.isConnected()) {
      await client.disconnect();
    }
    if (blenderProc) {
      blenderProc.kill();
    }
    await fs.unlink(imagePath).catch(() => {});
    await fs.unlink(manifestPath).catch(() => {});
  }
});
