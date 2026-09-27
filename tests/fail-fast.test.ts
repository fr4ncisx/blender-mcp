import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AppConfig } from '../server/infrastructure/config/app-config.js';

describe('AppConfig fail-fast and isBlenderInstalled', () => {
  test('isBlenderInstalled is true when blenderPath resolves to an existing file', () => {
    const config = AppConfig.load(
      [`--blender=${process.execPath}`],
      {},
      process.cwd()
    );
    assert.equal(config.isBlenderInstalled, true);
  });

  test('isBlenderInstalled is false when blenderPath does not exist on disk', () => {
    const config = AppConfig.load(
      [],
      { BLENDER_PATH: '/nonexistent/auto-detection-disabled/blender', ProgramFiles: 'C:\\NoSuchDir\\DoesNotExist', PATH: '' },
      process.cwd()
    );
    assert.equal(config.isBlenderInstalled, false);
  });

  test('isBlenderInstalled is false when path does not exist', () => {
    const config = AppConfig.load(
      ['--blender=/nonexistent/path/blender'],
      {},
      process.cwd()
    );
    assert.equal(config.isBlenderInstalled, false);
  });

  test('failFast is false by default', () => {
    const config = AppConfig.load([], {}, process.cwd());
    assert.equal(config.failFast, false);
  });

  test('failFast is true when --fail-fast CLI arg is passed', () => {
    const config = AppConfig.load(['--fail-fast'], {}, process.cwd());
    assert.equal(config.failFast, true);
  });

  test('failFast is true when BLENDER_FAIL_FAST=true env var is set', () => {
    const config = AppConfig.load([], { BLENDER_FAIL_FAST: 'true' }, process.cwd());
    assert.equal(config.failFast, true);
  });

  test('failFast is true when BLENDER_FAIL_FAST=1 env var is set', () => {
    const config = AppConfig.load([], { BLENDER_FAIL_FAST: '1' }, process.cwd());
    assert.equal(config.failFast, true);
  });
});
