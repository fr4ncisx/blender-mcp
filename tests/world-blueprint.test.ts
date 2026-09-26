import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WorldBlueprintEntity,
  BlueprintCell
} from '../server/domain/entities/world-blueprint.entity.js';

test('WorldBlueprintEntity parses ASCII grid with walls, elevations, furniture, stairs, and lights', () => {
  const ascii = [
    '#######',
    '#012B.#',
    '#S.T.L#',
    '#D^v<>#',
    '# ... #',
    '#######'
  ].join('\n');

  const blueprint = WorldBlueprintEntity.parse(ascii);

  assert.equal(blueprint.width, 7);
  assert.equal(blueprint.depth, 6);
  assert.equal(blueprint.cells.length, 42);

  const elev0 = blueprint.cells.find((c: BlueprintCell) => c.char === '0');
  const elev1 = blueprint.cells.find((c: BlueprintCell) => c.char === '1');
  const elev2 = blueprint.cells.find((c: BlueprintCell) => c.char === '2');

  assert.ok(elev0);
  assert.equal(elev0.elevation, 0.0);
  assert.equal(elev0.token, 'floor');

  assert.ok(elev1);
  assert.equal(elev1.elevation, 0.25);
  assert.equal(elev1.token, 'floor');

  assert.ok(elev2);
  assert.equal(elev2.elevation, 0.5);
  assert.equal(elev2.token, 'floor');

  const barCell = blueprint.cells.find((c: BlueprintCell) => c.char === 'B');
  assert.ok(barCell);
  assert.equal(barCell.token, 'bar_counter');

  const sofaCell = blueprint.cells.find((c: BlueprintCell) => c.char === 'S');
  assert.ok(sofaCell);
  assert.equal(sofaCell.token, 'sofa');

  const tableCell = blueprint.cells.find((c: BlueprintCell) => c.char === 'T');
  assert.ok(tableCell);
  assert.equal(tableCell.token, 'table');

  const doorCell = blueprint.cells.find((c: BlueprintCell) => c.char === 'D');
  assert.ok(doorCell);
  assert.equal(doorCell.token, 'doorway');

  const lightCell = blueprint.cells.find((c: BlueprintCell) => c.char === 'L');
  assert.ok(lightCell);
  assert.equal(lightCell.token, 'light_column');

  const stairN = blueprint.cells.find((c: BlueprintCell) => c.char === '^');
  const stairS = blueprint.cells.find((c: BlueprintCell) => c.char === 'v');
  const stairW = blueprint.cells.find((c: BlueprintCell) => c.char === '<');
  const stairE = blueprint.cells.find((c: BlueprintCell) => c.char === '>');

  assert.ok(stairN);
  assert.equal(stairN.token, 'stair_n');
  assert.ok(stairS);
  assert.equal(stairS.token, 'stair_s');
  assert.ok(stairW);
  assert.equal(stairW.token, 'stair_w');
  assert.ok(stairE);
  assert.equal(stairE.token, 'stair_e');

  const voidCell = blueprint.cells.find((c: BlueprintCell) => c.char === ' ');
  assert.ok(voidCell);
  assert.equal(voidCell.token, 'void');

  assert.equal(blueprint.seats.length, 1);
  assert.equal(blueprint.lights.length, 1);
  assert.equal(blueprint.stairs.length, 4);
  assert.ok(blueprint.obstacles.length > 0);
  assert.ok(blueprint.walkableFloor.length > 0);
});

test('WorldBlueprintEntity calculates 2:1 dimetric collision diamonds for obstacles', () => {
  const ascii = [
    '###',
    '#B#',
    '###'
  ].join('\n');

  const blueprint = WorldBlueprintEntity.parse(ascii);
  const tileWidth = 128;
  const tileHeight = 64;

  const diamonds = blueprint.calculateCollisionDiamonds(tileWidth, tileHeight);

  assert.equal(diamonds.length, blueprint.obstacles.length);

  for (const diamond of diamonds) {
    assert.ok(diamond.id.length > 0);
    assert.ok(typeof diamond.gridX === 'number');
    assert.ok(typeof diamond.gridY === 'number');
    assert.ok(typeof diamond.screenX === 'number');
    assert.ok(typeof diamond.screenY === 'number');
    assert.equal(diamond.diamondVertices.length, 4);

    const v = diamond.diamondVertices;
    assert.equal(v[0].x, diamond.screenX + tileWidth / 2);
    assert.equal(v[0].y, diamond.screenY);

    assert.equal(v[1].x, diamond.screenX + tileWidth);
    assert.equal(v[1].y, diamond.screenY + tileHeight / 2);

    assert.equal(v[2].x, diamond.screenX + tileWidth / 2);
    assert.equal(v[2].y, diamond.screenY + tileHeight);

    assert.equal(v[3].x, diamond.screenX);
    assert.equal(v[3].y, diamond.screenY + tileHeight / 2);
  }
});

test('WorldBlueprintEntity rejects empty or invalid blueprints', () => {
  assert.throws(() => {
    WorldBlueprintEntity.parse('');
  }, /empty/);

  assert.throws(() => {
    WorldBlueprintEntity.parse('   \n  \n');
  }, /empty/);

  assert.throws(() => {
    WorldBlueprintEntity.parse('####\n##\n####');
  }, /Inconsistent row lengths/);

  assert.throws(() => {
    WorldBlueprintEntity.parse('##\n#?');
  }, /Unknown blueprint token character/);
});

test('WorldBlueprintEntity exports valid compiler payload', () => {
  const ascii = '##\n..';
  const blueprint = WorldBlueprintEntity.parse(ascii);
  const payload = blueprint.toCompilerPayload();

  assert.equal(payload['width'], 2);
  assert.equal(payload['depth'], 2);
  assert.ok(Array.isArray(payload['cells']));
  assert.ok(Array.isArray(payload['obstacles']));
  assert.ok(Array.isArray(payload['walkableFloor']));
});
