import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { AssetCacheManager } from '../server/infrastructure/cache/asset-cache-manager.js';
import { SafePathSanitizer } from '../server/infrastructure/storage/safe-path-sanitizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const testCacheDir = path.join(rootDir, 'output', '.test-cache');

test('AssetCacheManager computes deterministic SHA-256 hashes regardless of key order', () => {
  const manager = new AssetCacheManager();

  const paramsA = {
    name: 'world_one',
    tileWidth: 128,
    nested: { b: 2, a: 1 }
  };

  const paramsB = {
    nested: { a: 1, b: 2 },
    tileWidth: 128,
    name: 'world_one'
  };

  const hashA = manager.computeHash('blender_iso_synthesize_world', paramsA);
  const hashB = manager.computeHash('blender_iso_synthesize_world', paramsB);

  assert.equal(hashA, hashB);
  assert.equal(hashA.length, 64);

  const hashDiff = manager.computeHash('blender_iso_synthesize_world', {
    ...paramsA,
    tileWidth: 256
  });
  assert.notEqual(hashA, hashDiff);
});

test('AssetCacheManager stores, retrieves, and persists cache entries', async () => {
  const sanitizer = new SafePathSanitizer();
  const manager = new AssetCacheManager(sanitizer, {
    cacheDir: testCacheDir,
    manifestName: 'test-manifest.json'
  });

  const testHash = 'a'.repeat(64);
  const testEntry = {
    success: true,
    name: 'persisted_test',
    imagePath: 'output/blender/rooms/test.png'
  };

  const initialMiss = await manager.get(testHash);
  assert.equal(initialMiss, null);

  await manager.set(testHash, testEntry);
  const inMemoryHit = await manager.get(testHash);
  assert.deepEqual(inMemoryHit, testEntry);

  await manager.saveCache();

  const secondManager = new AssetCacheManager(sanitizer, {
    cacheDir: testCacheDir,
    manifestName: 'test-manifest.json'
  });

  const persistedHit = await secondManager.get(testHash);
  assert.deepEqual(persistedHit, testEntry);

  try {
    await fs.rm(testCacheDir, { recursive: true, force: true });
  } catch {}
});
