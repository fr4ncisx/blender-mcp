import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { WsBlenderClient } from '../server/infrastructure/blender/ws-blender-client.js';
import { ProcessDaemonManager } from '../server/infrastructure/blender/process-daemon-manager.js';
import { SafePathSanitizer } from '../server/infrastructure/storage/safe-path-sanitizer.js';
import { UniversalAtlasExporter } from '../server/infrastructure/exporters/universal-atlas-exporter.js';
import { Godot4TilesetExporter } from '../server/infrastructure/exporters/godot4-tileset-exporter.js';
import { LdtkExporter } from '../server/infrastructure/exporters/ldtk-exporter.js';
import { PhaserDefoldExporter } from '../server/infrastructure/exporters/phaser-defold-exporter.js';

import { handleSceneSetup } from '../server/presentation/mcp/tools/scene-setup.tool.js';
import { handleTileGenerator } from '../server/presentation/mcp/tools/tile-generator.tool.js';
import { handleNprMaterial } from '../server/presentation/mcp/tools/npr-material.tool.js';
import { handleTurnaroundRender } from '../server/presentation/mcp/tools/turnaround-render.tool.js';
import { handleInspectScene } from '../server/presentation/mcp/tools/inspect-scene.tool.js';

import fsSync from 'node:fs';

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

test('End-to-End AI MCP integration with real Blender 5.2.2 LTS', async () => {
  const outputDir = path.join(rootDir, 'output', 'blender', 'turnarounds');
  await fs.mkdir(outputDir, { recursive: true });

  const daemonManager = new ProcessDaemonManager({
    blenderPath: blenderExe,
    bridgeScriptPath: bridgeScript,
    port: 9876,
    host: '127.0.0.1'
  });

  let blenderProc: ChildProcess | null = null;
  const isAlreadyOpen = await daemonManager.isPortOpen(9876);

  if (!isAlreadyOpen) {
    blenderProc = spawn(blenderExe, ['--background', '--python', bridgeScript], {
      cwd: rootDir,
      stdio: 'pipe'
    });

    let portReady = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (await daemonManager.isPortOpen(9876)) {
        portReady = true;
        break;
      }
    }
    assert.equal(portReady, true);
  }

  const client = new WsBlenderClient({
    url: 'ws://127.0.0.1:9876',
    timeoutMs: 15000,
    reconnectIntervalMs: 500
  });

  await client.connect();
  assert.equal(client.isConnected(), true);

  const sanitizer = new SafePathSanitizer({ allowedRoots: [rootDir] });
  const exporters = [
    new UniversalAtlasExporter(sanitizer),
    new Godot4TilesetExporter(sanitizer),
    new LdtkExporter(sanitizer),
    new PhaserDefoldExporter(sanitizer)
  ];

  try {
    const setupResp = await handleSceneSetup(client, {
      tileWidth: 128,
      unitSize: 1.0,
      clearScene: true,
      ambientOcclusion: true,
      colorManagement: 'Standard'
    });

    assert.equal(setupResp.isError, false);

    const tileResp = await handleTileGenerator(client, {
      tileType: 'cube_block',
      name: 'HeroTower',
      unitSize: 1.0,
      unitHeight: 0.5,
      generateCollision: false
    });

    assert.equal(tileResp.isError, false);

    const matResp = await handleNprMaterial(client, {
      targetObjectName: 'HeroTower',
      palette: ['#2c3e50', '#e74c3c', '#3498db', '#f1c40f'],
      outlineWidth: 0.005,
      smoothNormals: false
    });

    assert.equal(matResp.isError, false);

    const inspectResp = await handleInspectScene(client, {
      includeObjects: true,
      includeCameras: true,
      includeMaterials: true
    });

    assert.equal(inspectResp.isError, false);
    const inspectData = JSON.parse(inspectResp.content[0].text);
    assert.equal(inspectData.success, true);
    assert.ok(inspectData.data.objectsCount >= 1);

    const universalResp = await handleTurnaroundRender(client, exporters, {
      objectName: 'HeroTower',
      tileWidth: 128,
      directions: 4,
      outputDirectory: outputDir,
      baseName: 'hero_tower',
      exportTarget: 'universal'
    });

    assert.equal(universalResp.isError, false);

    const godotResp = await handleTurnaroundRender(client, exporters, {
      objectName: 'HeroTower',
      tileWidth: 128,
      directions: 4,
      outputDirectory: outputDir,
      baseName: 'hero_tower',
      exportTarget: 'godot4'
    });

    assert.equal(godotResp.isError, false);

    const ldtkResp = await handleTurnaroundRender(client, exporters, {
      objectName: 'HeroTower',
      tileWidth: 128,
      directions: 4,
      outputDirectory: outputDir,
      baseName: 'hero_tower',
      exportTarget: 'ldtk'
    });

    assert.equal(ldtkResp.isError, false);

    const frame0Path = path.join(outputDir, 'hero_tower_dir_0.png');
    const atlasJsonPath = path.join(outputDir, 'hero_tower.json');
    const godotTresPath = path.join(outputDir, 'hero_tower.tres');
    const ldtkJsonPath = path.join(outputDir, 'hero_tower.ldtk.json');

    const frame0Stat = await fs.stat(frame0Path);
    assert.ok(frame0Stat.size > 100);

    const atlasJsonContent = await fs.readFile(atlasJsonPath, 'utf-8');
    const atlasJson = JSON.parse(atlasJsonContent);
    assert.equal(atlasJson.meta.app, 'blender-iso-mcp');
    assert.equal(Object.keys(atlasJson.frames).length, 4);

    const godotContent = await fs.readFile(godotTresPath, 'utf-8');
    assert.ok(godotContent.includes('tile_shape = 1'));
    assert.ok(godotContent.includes('tile_size = Vector2i(128, 64)'));

    const ldtkContent = await fs.readFile(ldtkJsonPath, 'utf-8');
    const ldtkJson = JSON.parse(ldtkContent);
    assert.equal(ldtkJson.identifier, 'hero_tower');
    assert.equal(ldtkJson.tileGridSize, 128);
    assert.ok(ldtkJson.tags.includes('isometric'));
  } finally {
    const filesToClean = [
      path.join(outputDir, 'hero_tower_dir_0.png'),
      path.join(outputDir, 'hero_tower_dir_1.png'),
      path.join(outputDir, 'hero_tower_dir_2.png'),
      path.join(outputDir, 'hero_tower_dir_3.png'),
      path.join(outputDir, 'hero_tower.json'),
      path.join(outputDir, 'hero_tower.tres'),
      path.join(outputDir, 'hero_tower.ldtk.json')
    ];
    for (const f of filesToClean) {
      await fs.rm(f, { force: true });
    }
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
