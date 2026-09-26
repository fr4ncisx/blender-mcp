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
const largeLoungePngPath = path.join(outputDir, 'large_avatar_lounge.png');
const testPort = 9878;

test('Grand Multilevel Social Lounge materializes in Blender 5.2.2 LTS with 50+ capacity and multi-framework exports', async () => {
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
    const response = await handleSocialRoom(client, {
      roomScale: 'grand',
      capacityTarget: 80,
      tileSize: 0.5,
      renderOutput: largeLoungePngPath,
      resolutionWidth: 1024,
      targetFramework: 'all'
    });

    assert.equal(response.isError, false);
    const parsedData = JSON.parse(response.content[0].text);
    assert.equal(parsedData.success, true);

    const metrics = parsedData.data.capacityMetrics;
    assert.ok(metrics.minimumCapacity >= 50);
    assert.ok(metrics.standingWalkableCapacity >= 80);
    assert.ok(metrics.seatingCapacity >= 15);
    assert.ok(metrics.calculatedMaxCapacity >= 100);

    const navGrid: Array<{ elevation: number; walkable: boolean; tileType?: string }> = parsedData.data.navigationGrid;
    assert.ok(navGrid.length >= 500);
    assert.ok(navGrid.some((c) => c.elevation === 0.6));
    assert.ok(navGrid.some((c) => c.elevation === 1.2));
    assert.ok(navGrid.some((c) => c.tileType === 'entry'));
    assert.ok(navGrid.some((c) => c.tileType === 'transition'));

    assert.ok(parsedData.data.entryTile);
    assert.equal(parsedData.data.entryTile.gridX, 13);
    assert.equal(parsedData.data.entryTile.gridY, 0);
    assert.ok(parsedData.data.transitionTiles && parsedData.data.transitionTiles.length > 0);

    const stat = await fs.stat(largeLoungePngPath);
    assert.ok(stat.size > 20000);

    const phaserJsonPath = path.join(outputDir, 'large_avatar_lounge_phaser.json');
    const phaserRaw = await fs.readFile(phaserJsonPath, 'utf-8');
    const phaserData = JSON.parse(phaserRaw);
    assert.equal(phaserData.projection, 'dimetric_2_1');
    assert.equal(phaserData.collisionGrid.length, 28);
    assert.ok(phaserData.spawnPoint);
    assert.ok(phaserData.transitionTriggers.length > 0);

    const pixiJsonPath = path.join(outputDir, 'large_avatar_lounge_pixi.json');
    const pixiRaw = await fs.readFile(pixiJsonPath, 'utf-8');
    const pixiData = JSON.parse(pixiRaw);
    assert.ok(pixiData.depthSorting.formula.includes('zIndex'));
    assert.ok(pixiData.spawnPoint);
    assert.ok(pixiData.transitionTriggers.length > 0);

    const threeJsJsonPath = path.join(outputDir, 'large_avatar_lounge_threejs.json');
    const threeRaw = await fs.readFile(threeJsJsonPath, 'utf-8');
    const threeData = JSON.parse(threeRaw);
    assert.equal(threeData.camera.type, 'OrthographicCamera');
    assert.ok(threeData.spawnPoint);

    const babylonJsonPath = path.join(outputDir, 'large_avatar_lounge_babylon.json');
    const babylonRaw = await fs.readFile(babylonJsonPath, 'utf-8');
    const babylonData = JSON.parse(babylonRaw);
    assert.equal(babylonData.camera.mode, 'ORTHOGRAPHIC_CAMERA');
    assert.ok(babylonData.spawnPoint);

    const excaliburJsonPath = path.join(outputDir, 'large_avatar_lounge_excalibur.json');
    const excaliburRaw = await fs.readFile(excaliburJsonPath, 'utf-8');
    const excaliburData = JSON.parse(excaliburRaw);
    assert.equal(excaliburData.isometricMap.elevationLayers, 3);
    assert.ok(excaliburData.spawnPoint);

    const universalJsonPath = path.join(outputDir, 'large_avatar_lounge_universal.json');
    const universalRaw = await fs.readFile(universalJsonPath, 'utf-8');
    const universalData = JSON.parse(universalRaw);
    assert.equal(universalData.schemaVersion, '1.0.0');
    assert.ok(universalData.entryTile);
    assert.ok(universalData.transitionTiles.length > 0);

    const integrationSnippetPath = path.join(outputDir, 'large_avatar_lounge_integration.ts');
    const snippetRaw = await fs.readFile(integrationSnippetPath, 'utf-8');
    assert.ok(snippetRaw.includes('loadPhaserIsoRoom'));
    assert.ok(snippetRaw.includes('setupThreeJsIsoCamera'));
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
