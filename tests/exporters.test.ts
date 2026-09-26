import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { UniversalAtlasExporter } from '../server/infrastructure/exporters/universal-atlas-exporter.js';
import { Godot4TilesetExporter } from '../server/infrastructure/exporters/godot4-tileset-exporter.js';
import { LdtkExporter } from '../server/infrastructure/exporters/ldtk-exporter.js';
import { PhaserDefoldExporter } from '../server/infrastructure/exporters/phaser-defold-exporter.js';
import { SafePathSanitizer } from '../server/infrastructure/storage/safe-path-sanitizer.js';

test('UniversalAtlasExporter exports valid TexturePacker JSON manifest', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'iso-universal-test-'));
  try {
    const sanitizer = new SafePathSanitizer({ allowedRoots: [tmpDir] });
    const exporter = new UniversalAtlasExporter(sanitizer);

    const result = await exporter.export({
      targetType: 'universal',
      outputDirectory: tmpDir,
      baseName: 'hero_iso',
      includeMetadata: true,
      options: {
        frameWidth: 128,
        frameHeight: 64,
        totalFrames: 4
      }
    });

    assert.equal(result.success, true);
    assert.equal(result.target, 'universal');
    assert.ok(result.manifestPath);

    const raw = await fs.readFile(result.manifestPath, 'utf-8');
    const parsed = JSON.parse(raw);

    assert.equal(parsed.meta.app, 'blender-iso-mcp');
    assert.equal(parsed.meta.image, 'hero_iso.png');
    assert.equal(Object.keys(parsed.frames).length, 4);
    assert.deepEqual(parsed.frames['hero_iso_dir_0.png'].pivot, { x: 0.5, y: 1.0 });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('Godot4TilesetExporter exports valid TileSet .tres with ISOMETRIC shape and CanvasTexture', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'iso-godot-test-'));
  try {
    const sanitizer = new SafePathSanitizer({ allowedRoots: [tmpDir] });
    const exporter = new Godot4TilesetExporter(sanitizer);

    const result = await exporter.export({
      targetType: 'godot4',
      outputDirectory: tmpDir,
      baseName: 'terrain_tiles',
      includeMetadata: true,
      options: {
        tileWidth: 128,
        tileHeight: 64,
        hasNormalMap: true
      }
    });

    assert.equal(result.success, true);
    assert.equal(result.target, 'godot4');
    assert.ok(result.manifestPath);

    const content = await fs.readFile(result.manifestPath, 'utf-8');
    assert.ok(content.includes('tile_shape = 1'));
    assert.ok(content.includes('tile_size = Vector2i(128, 64)'));
    assert.ok(content.includes('CanvasTexture'));
    assert.ok(content.includes('diffuse_texture'));
    assert.ok(content.includes('normal_texture'));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('LdtkExporter generates valid LDtk JSON manifest', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'iso-ldtk-test-'));
  try {
    const sanitizer = new SafePathSanitizer({ allowedRoots: [tmpDir] });
    const exporter = new LdtkExporter(sanitizer);

    const result = await exporter.export({
      targetType: 'ldtk',
      outputDirectory: tmpDir,
      baseName: 'medieval_tiles',
      includeMetadata: true,
      options: {
        tileWidth: 128,
        tileHeight: 64,
        totalTiles: 8,
        columns: 4
      }
    });

    assert.equal(result.success, true);
    assert.equal(result.target, 'ldtk');
    assert.equal(result.artifacts.length, 1);

    const ldtkPath = path.join(tmpDir, 'medieval_tiles.ldtk.json');
    const ldtkContent = await fs.readFile(ldtkPath, 'utf-8');
    const ldtkJson = JSON.parse(ldtkContent);
    assert.equal(ldtkJson.identifier, 'medieval_tiles');
    assert.equal(ldtkJson.tileGridSize, 128);
    assert.ok(ldtkJson.tags.includes('isometric'));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('PhaserDefoldExporter generates normalized anchor manifest and Defold atlas', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'iso-phaser-test-'));
  try {
    const sanitizer = new SafePathSanitizer({ allowedRoots: [tmpDir] });
    const exporter = new PhaserDefoldExporter(sanitizer);

    const result = await exporter.export({
      targetType: 'phaser_defold',
      outputDirectory: tmpDir,
      baseName: 'creature',
      includeMetadata: true,
      options: {
        frameWidth: 128,
        frameHeight: 64,
        totalFrames: 4
      }
    });

    assert.equal(result.success, true);
    assert.equal(result.target, 'phaser_defold');

    const phaserPath = path.join(tmpDir, 'creature_phaser.json');
    const phaserRaw = await fs.readFile(phaserPath, 'utf-8');
    const phaserJson = JSON.parse(phaserRaw);
    assert.equal(phaserJson.textures[0].frames[0].anchor.x, 0.5);
    assert.equal(phaserJson.textures[0].frames[0].anchor.y, 1.0);

    const defoldPath = path.join(tmpDir, 'creature.atlas');
    const defoldContent = await fs.readFile(defoldPath, 'utf-8');
    assert.ok(defoldContent.includes('images {'));
    assert.ok(defoldContent.includes('image: "/creature.png"'));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
