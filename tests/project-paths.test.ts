import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { ProjectPaths } from '../server/domain/value-objects/project-paths.vo.js';
import { ProjectPathsManager } from '../server/infrastructure/storage/project-paths-manager.js';
import { SafePathSanitizer, SecurityError } from '../server/infrastructure/storage/safe-path-sanitizer.js';

test('ProjectPaths Value Object is immutable and provides canonical output paths', () => {
  assert.equal(ProjectPaths.BLENDER_ROOT, 'output/blender');
  assert.equal(ProjectPaths.BLENDER_ROOMS, 'output/blender/rooms');
  assert.equal(ProjectPaths.BLENDER_TURNAROUNDS, 'output/blender/turnarounds');
  assert.equal(ProjectPaths.BLENDER_PASSES, 'output/blender/passes');

  assert.equal(ProjectPaths.ISOMETRIC_ASSETS_ROOT, 'output/isometric-assets');
  assert.equal(ProjectPaths.ASSETS_TILES, 'output/isometric-assets/tiles');
  assert.equal(ProjectPaths.ASSETS_ATLASES, 'output/isometric-assets/atlases');
  assert.equal(ProjectPaths.ASSETS_COLLISIONS, 'output/isometric-assets/collisions');
  assert.equal(ProjectPaths.ASSETS_MANIFESTS, 'output/isometric-assets/manifests');

  assert.equal(ProjectPaths.blenderRoot, 'output/blender');
  assert.equal(ProjectPaths.blenderRooms, 'output/blender/rooms');
  assert.equal(ProjectPaths.blenderTurnarounds, 'output/blender/turnarounds');
  assert.equal(ProjectPaths.blenderPasses, 'output/blender/passes');

  assert.equal(ProjectPaths.isometricAssetsRoot, 'output/isometric-assets');
  assert.equal(ProjectPaths.assetsTiles, 'output/isometric-assets/tiles');
  assert.equal(ProjectPaths.assetsAtlases, 'output/isometric-assets/atlases');
  assert.equal(ProjectPaths.assetsCollisions, 'output/isometric-assets/collisions');
  assert.equal(ProjectPaths.assetsManifests, 'output/isometric-assets/manifests');

  assert.equal(ProjectPaths.ALL_DIRECTORIES.length, 7);
  assert.ok(Object.isFrozen(ProjectPaths.ALL_DIRECTORIES));
  assert.ok(Object.isFrozen(ProjectPaths));

  assert.throws(() => {
    (ProjectPaths as Record<string, unknown>)['BLENDER_ROOT'] = 'mutated';
  }, TypeError);
});

test('ProjectPathsManager ensures directory structure across all segregated paths', async () => {
  const tempBase = path.resolve(process.cwd(), 'tests/output/paths_manager_test');
  const sanitizer = new SafePathSanitizer({ allowedRoots: [process.cwd(), tempBase] });
  const manager = new ProjectPathsManager(sanitizer, tempBase);

  const createdDirs = await manager.ensureDirectoryStructure(tempBase);
  assert.equal(createdDirs.length, 7);

  for (const createdDir of createdDirs) {
    const stat = await fs.stat(createdDir);
    assert.ok(stat.isDirectory());
  }

  await fs.rm(tempBase, { recursive: true, force: true });
});

test('ProjectPathsManager resolves subcategories safely and validates against path traversal', () => {
  const projectRoot = process.cwd();
  const sanitizer = new SafePathSanitizer({ allowedRoots: [projectRoot] });
  const manager = new ProjectPathsManager(sanitizer, projectRoot);

  const roomPath = manager.resolveBlenderPath('rooms', 'lounge.png');
  assert.equal(roomPath, path.resolve(projectRoot, 'output/blender/rooms/lounge.png'));

  const turnaroundDir = manager.resolveBlenderPath('turnarounds');
  assert.equal(turnaroundDir, path.resolve(projectRoot, 'output/blender/turnarounds'));

  const passesPath = manager.resolveBlenderPath('passes', 'albedo.png');
  assert.equal(passesPath, path.resolve(projectRoot, 'output/blender/passes/albedo.png'));

  const tilePath = manager.resolveAssetPath('tiles', 'floor_wood.png');
  assert.equal(tilePath, path.resolve(projectRoot, 'output/isometric-assets/tiles/floor_wood.png'));

  const atlasPath = manager.resolveAssetPath('atlases', 'hero.json');
  assert.equal(atlasPath, path.resolve(projectRoot, 'output/isometric-assets/atlases/hero.json'));

  const collisionPath = manager.resolveAssetPath('collisions', 'floor_wood.collision.json');
  assert.equal(collisionPath, path.resolve(projectRoot, 'output/isometric-assets/collisions/floor_wood.collision.json'));

  const manifestPath = manager.resolveAssetPath('manifests', 'isometric_assets_manifest.json');
  assert.equal(manifestPath, path.resolve(projectRoot, 'output/isometric-assets/manifests/isometric_assets_manifest.json'));

  assert.throws(() => {
    manager.resolveBlenderPath('rooms', '../../../../Windows/System32/cmd.exe');
  }, SecurityError);

  assert.throws(() => {
    manager.resolveAssetPath('tiles', '../../../etc/passwd');
  }, SecurityError);
});
