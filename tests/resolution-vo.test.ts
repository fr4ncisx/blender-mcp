import test from 'node:test';
import assert from 'node:assert/strict';
import { Resolution } from '../server/domain/value-objects/resolution.vo.js';

test('Resolution creates valid immutable instances with 2:1 aspect ratio', () => {
  const res128 = Resolution.create(128);
  assert.equal(res128.width, 128);
  assert.equal(res128.height, 64);
  assert.equal(res128.aspectRatio, 2.0);
  assert.equal(Object.isFrozen(res128), true);

  const res64 = new Resolution(64, 32);
  assert.equal(res64.width, 64);
  assert.equal(res64.height, 32);
  assert.equal(res64.aspectRatio, 2.0);

  const json = res128.toJSON();
  assert.deepEqual(json, { width: 128, height: 64, aspectRatio: 2.0 });
});

test('Resolution rejects odd width values', () => {
  assert.throws(() => Resolution.create(127), RangeError);
  assert.throws(() => new Resolution(63, 31), RangeError);
  assert.throws(() => new Resolution(1, 0.5), RangeError);
});

test('Resolution rejects non-positive or non-integer widths', () => {
  assert.throws(() => Resolution.create(0), TypeError);
  assert.throws(() => Resolution.create(-128), TypeError);
  assert.throws(() => Resolution.create(128.5), TypeError);
});

test('Resolution rejects height not strictly equal to width / 2', () => {
  assert.throws(() => new Resolution(128, 65), RangeError);
  assert.throws(() => new Resolution(128, 63), RangeError);
  assert.throws(() => new Resolution(128, 128), RangeError);
});

test('Resolution equals correctly compares instances', () => {
  const resA = Resolution.create(128);
  const resB = new Resolution(128, 64);
  const resC = Resolution.create(256);

  assert.equal(resA.equals(resB), true);
  assert.equal(resA.equals(resC), false);
});
