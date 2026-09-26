import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIMETRIC_RATIO,
  DIMETRIC_ANGLE_RAD,
  calculateOrthoScale,
  calculateDimetricResolution,
  getDirectionYaw,
  projectWorldToDimetricScreen
} from '../server/domain/math/isometric-projection.math.js';

test('dimetric slope ratio is exactly 2:1 with error < 0.0001', () => {
  assert.equal(DIMETRIC_RATIO, 2.0);

  const cosAngle = Math.cos(DIMETRIC_ANGLE_RAD);
  const sinAngle = Math.sin(DIMETRIC_ANGLE_RAD);
  const calculatedRatio = cosAngle / sinAngle;

  const error = Math.abs(calculatedRatio - 2.0);
  assert.ok(error < 0.0001);

  const pointX = projectWorldToDimetricScreen(1, 0, 0, 100);
  const pointY = projectWorldToDimetricScreen(0, 1, 0, 100);

  const slopeX = Math.abs(pointX.screenX / pointX.screenY);
  const slopeY = Math.abs(pointY.screenX / pointY.screenY);

  assert.ok(Math.abs(slopeX - 2.0) < 0.0001);
  assert.ok(Math.abs(slopeY - 2.0) < 0.0001);
});

test('calculateOrthoScale returns Math.SQRT2 * unitSize', () => {
  assert.equal(calculateOrthoScale(1.0), Math.SQRT2);
  assert.equal(calculateOrthoScale(2.5), Math.SQRT2 * 2.5);
});

test('calculateDimetricResolution enforces 2:1 aspect ratio', () => {
  const res128 = calculateDimetricResolution(128);
  assert.equal(res128.width, 128);
  assert.equal(res128.height, 64);

  const res64 = calculateDimetricResolution(64);
  assert.equal(res64.width, 64);
  assert.equal(res64.height, 32);

  const res256 = calculateDimetricResolution(256);
  assert.equal(res256.width, 256);
  assert.equal(res256.height, 128);
});

test('getDirectionYaw returns correct cardinal and ordinal angles', () => {
  assert.equal(getDirectionYaw(0, 4), 45);
  assert.equal(getDirectionYaw(1, 4), 135);
  assert.equal(getDirectionYaw(2, 4), 225);
  assert.equal(getDirectionYaw(3, 4), 315);

  assert.equal(getDirectionYaw(0, 8), 45);
  assert.equal(getDirectionYaw(1, 8), 90);
  assert.equal(getDirectionYaw(2, 8), 135);
  assert.equal(getDirectionYaw(3, 8), 180);
  assert.equal(getDirectionYaw(4, 8), 225);
  assert.equal(getDirectionYaw(5, 8), 270);
  assert.equal(getDirectionYaw(6, 8), 315);
  assert.equal(getDirectionYaw(7, 8), 0);

  assert.throws(() => getDirectionYaw(-1, 4), RangeError);
  assert.throws(() => getDirectionYaw(4, 4), RangeError);
  assert.throws(() => getDirectionYaw(8, 8), RangeError);
});
