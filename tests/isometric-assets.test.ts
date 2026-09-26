import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import {
  IsometricAssetDefinition,
  AssetArchetype
} from '../server/domain/entities/isometric-asset-definition.entity.js';
import { IsometricCollisionEntity } from '../server/domain/entities/isometric-collision.entity.js';
import { IsometricAssetGenerator } from '../server/infrastructure/assets/isometric-asset-generator.js';
import { ProjectPathsManager } from '../server/infrastructure/storage/project-paths-manager.js';
import { SafePathSanitizer } from '../server/infrastructure/storage/safe-path-sanitizer.js';
import { handleIsometricAssetBaker } from '../server/presentation/mcp/tools/isometric-asset-baker.tool.js';

test('IsometricCollisionEntity calculates 2:1 dimetric tile diamond and bounding box', () => {
  const diamond = IsometricCollisionEntity.createIsometricTileDiamond(64, 32);
  assert.equal(diamond.length, 4);
  assert.deepEqual(diamond[0], { x: 32, y: 0 });
  assert.deepEqual(diamond[1], { x: 64, y: 16 });
  assert.deepEqual(diamond[2], { x: 32, y: 32 });
  assert.deepEqual(diamond[3], { x: 0, y: 16 });
  assert.ok(Object.isFrozen(diamond));

  const bbox = IsometricCollisionEntity.createBoundingBox(10, 20, 30, 40);
  assert.equal(bbox.length, 4);
  assert.deepEqual(bbox[0], { x: 10, y: 20 });
  assert.deepEqual(bbox[1], { x: 40, y: 20 });
  assert.deepEqual(bbox[2], { x: 40, y: 60 });
  assert.deepEqual(bbox[3], { x: 10, y: 60 });
  assert.ok(Object.isFrozen(bbox));

  assert.throws(() => {
    IsometricCollisionEntity.createIsometricTileDiamond(-64, 32);
  }, RangeError);

  assert.throws(() => {
    IsometricCollisionEntity.createBoundingBox(0, 0, -10, 20);
  }, RangeError);
});

test('IsometricAssetDefinition enforces exact 2:1 dimetric dimensions and proportional heights', () => {
  const floorAsset = IsometricAssetDefinition.createStandard({
    id: 'floor_parquet',
    name: 'Parquet Floor',
    archetype: 'floor',
    tileWidth: 64
  });

  assert.equal(floorAsset.tileWidth, 64);
  assert.equal(floorAsset.tileHeight, 32);
  assert.equal(floorAsset.spriteWidth, 64);
  assert.equal(floorAsset.spriteHeight, 32);
  assert.equal(floorAsset.unitHeight, 1.0);
  assert.deepEqual(floorAsset.anchorPivot, { x: 0.5, y: 0.5 });

  const wallAsset = IsometricAssetDefinition.createStandard({
    id: 'wall_brick',
    name: 'Brick Wall',
    archetype: 'wall',
    tileWidth: 64
  });

  assert.equal(wallAsset.tileWidth, 64);
  assert.equal(wallAsset.tileHeight, 32);
  assert.equal(wallAsset.spriteWidth, 64);
  assert.equal(wallAsset.spriteHeight, 64);
  assert.equal(wallAsset.unitHeight, 2.0);
  assert.deepEqual(wallAsset.anchorPivot, { x: 0.5, y: 0.75 });

  const columnAsset = IsometricAssetDefinition.createStandard({
    id: 'pillar_greek',
    name: 'Greek Pillar',
    archetype: 'column',
    tileWidth: 64,
    unitHeight: 3.0
  });

  assert.equal(columnAsset.unitHeight, 3.0);
  assert.equal(columnAsset.spriteHeight, 96);
  assert.equal(columnAsset.anchorPivot.x, 0.5);
  assert.equal(columnAsset.anchorPivot.y, Number(((96 - 16) / 96).toFixed(4)));
});

test('IsometricAssetDefinition calculates mathematically exact 2:1 collision diamond vertices', () => {
  const asset = IsometricAssetDefinition.createStandard({
    id: 'floor_test',
    name: 'Floor Test',
    archetype: 'floor',
    tileWidth: 64
  });

  const diamond = asset.collisionDiamond;
  assert.equal(diamond.length, 4);
  assert.deepEqual(diamond[0], { x: 32, y: 0 });
  assert.deepEqual(diamond[1], { x: 64, y: 16 });
  assert.deepEqual(diamond[2], { x: 32, y: 32 });
  assert.deepEqual(diamond[3], { x: 0, y: 16 });
});

test('IsometricAssetDefinition rejects invalid dimensions or invalid archetypes', () => {
  assert.throws(() => {
    IsometricAssetDefinition.createStandard({
      id: 'bad_tile',
      name: 'Bad Tile',
      archetype: 'floor',
      tileWidth: 63
    });
  }, RangeError);

  assert.throws(() => {
    IsometricAssetDefinition.createStandard({
      id: 'bad_tile',
      name: 'Bad Tile',
      archetype: 'floor',
      tileWidth: -64
    });
  }, RangeError);

  assert.throws(() => {
    IsometricAssetDefinition.createStandard({
      id: 'bad_tile',
      name: 'Bad Tile',
      archetype: 'invalid_archetype' as unknown as AssetArchetype,
      tileWidth: 64
    });
  }, Error);

  assert.throws(() => {
    IsometricAssetDefinition.createStandard({
      id: '',
      name: 'Valid Name',
      archetype: 'floor',
      tileWidth: 64
    });
  }, Error);
});

test('IsometricAssetDefinition is immutable and serializable to JSON', () => {
  const asset = IsometricAssetDefinition.createStandard({
    id: 'sofa_test',
    name: 'Sofa Test',
    archetype: 'furniture',
    tileWidth: 64,
    tags: ['lounge'],
    properties: { comfort: 10 }
  });

  assert.ok(Object.isFrozen(asset));
  assert.ok(Object.isFrozen(asset.collisionDiamond));
  assert.ok(Object.isFrozen(asset.anchorPivot));
  assert.ok(Object.isFrozen(asset.tags));
  assert.ok(Object.isFrozen(asset.properties));

  const json = asset.toJSON();
  assert.equal(json['id'], 'sofa_test');
  assert.equal(json['archetype'], 'furniture');
  assert.equal(json['tileWidth'], 64);
  assert.equal(json['tileHeight'], 32);
});

test('IsometricAssetGenerator builds standard catalog, collision files, and manifests', async () => {
  const tempBase = path.resolve(process.cwd(), 'tests/output/asset_gen_test');
  const sanitizer = new SafePathSanitizer({ allowedRoots: [process.cwd(), tempBase] });
  const pathsManager = new ProjectPathsManager(sanitizer, tempBase);
  const generator = new IsometricAssetGenerator(sanitizer, pathsManager);

  const catalog = generator.generateStandardCatalog(64);
  assert.ok(catalog.length >= 7);

  const archetypes = new Set(catalog.map((a) => a.archetype));
  assert.ok(archetypes.has('floor'));
  assert.ok(archetypes.has('wall'));
  assert.ok(archetypes.has('slope'));
  assert.ok(archetypes.has('furniture'));
  assert.ok(archetypes.has('stair'));
  assert.ok(archetypes.has('column'));
  assert.ok(archetypes.has('transition'));

  const result = await generator.bakeCatalog({
    tileWidth: 64,
    targetDir: tempBase,
    manifestFileName: 'test_manifest.json'
  });

  assert.equal(result.totalAssets, catalog.length);
  assert.equal(result.collisionFiles.length, catalog.length);

  const manifestContent = await fs.readFile(result.manifestPath, 'utf-8');
  const parsedManifest = JSON.parse(manifestContent) as {
    version: string;
    projection: string;
    totalAssets: number;
    assets: readonly unknown[];
  };

  assert.equal(parsedManifest.version, '0.7.0');
  assert.equal(parsedManifest.projection, 'dimetric_2_1');
  assert.equal(parsedManifest.totalAssets, catalog.length);
  assert.equal(parsedManifest.assets.length, catalog.length);

  for (const collisionFile of result.collisionFiles) {
    const fileStat = await fs.stat(collisionFile);
    assert.ok(fileStat.isFile());
    const fileData = JSON.parse(await fs.readFile(collisionFile, 'utf-8')) as {
      collisionDiamond: Array<{ x: number; y: number }>;
    };
    assert.equal(fileData.collisionDiamond.length, 4);
  }

  await fs.rm(tempBase, { recursive: true, force: true });
});

test('MCP tool handleIsometricAssetBaker executes and returns structured JSON response', async () => {
  const sanitizer = new SafePathSanitizer({ allowedRoots: [process.cwd()] });

  const response = await handleIsometricAssetBaker(sanitizer, {
    tileWidth: 64,
    archetypes: ['floor', 'wall', 'furniture'],
    outputDirectory: 'output/isometric-assets',
    manifestFileName: 'mcp_test_manifest.json'
  });

  assert.equal(response.isError, undefined);
  const data = JSON.parse(response.content[0].text) as {
    success: boolean;
    totalAssets: number;
    manifestPath: string;
    tileWidth: number;
    tileHeight: number;
    projection: string;
  };

  assert.equal(data.success, true);
  assert.ok(data.totalAssets >= 3);
  assert.equal(data.tileWidth, 64);
  assert.equal(data.tileHeight, 32);
  assert.equal(data.projection, 'dimetric_2_1');

  const manifestStat = await fs.stat(data.manifestPath);
  assert.ok(manifestStat.isFile());
});
