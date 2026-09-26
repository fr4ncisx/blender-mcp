import test from 'node:test';
import assert from 'node:assert/strict';

import {
  IsometricAvatarEntity,
  AvatarColorPalette
} from '../server/domain/entities/isometric-avatar.entity.js';
import { DepthSortingMath } from '../server/domain/math/depth-sorting.math.js';
import { SafePathSanitizer } from '../server/infrastructure/storage/safe-path-sanitizer.js';
import { IBlenderBridge } from '../server/domain/contracts/blender-bridge.contract.js';
import { handleAvatarGenerator } from '../server/presentation/mcp/tools/avatar-generator.tool.js';

test('IsometricAvatarEntity initializes with default values and freeze', () => {
  const avatar = IsometricAvatarEntity.createDefault('TestAvatar');
  assert.equal(avatar.name, 'TestAvatar');
  assert.equal(avatar.scale, 1.0);
  assert.equal(avatar.direction, 0);
  assert.equal(avatar.gridX, 0);
  assert.equal(avatar.gridY, 0);
  assert.equal(avatar.elevation, 0);
  assert.equal(avatar.palette.skinColor, '#fcd5b4');
  assert.equal(avatar.palette.shirtColor, '#00f0ff');
  assert.equal(Object.isFrozen(avatar), true);
  assert.equal(Object.isFrozen(avatar.palette), true);
});

test('IsometricAvatarEntity supports custom palette and overrides', () => {
  const customPalette: AvatarColorPalette = {
    skinColor: '#ffd1a4',
    hairColor: '#1a1a1a',
    shirtColor: '#ff007f',
    pantsColor: '#05472a',
    shoesColor: '#d4af37'
  };
  const avatar = new IsometricAvatarEntity({
    name: 'CyberpunkDancer',
    palette: customPalette,
    scale: 1.5,
    direction: 3,
    gridX: 4,
    gridY: 7,
    elevation: 0.5
  });
  assert.equal(avatar.name, 'CyberpunkDancer');
  assert.equal(avatar.scale, 1.5);
  assert.equal(avatar.direction, 3);
  assert.equal(avatar.gridX, 4);
  assert.equal(avatar.gridY, 7);
  assert.equal(avatar.elevation, 0.5);
  assert.equal(avatar.palette.shirtColor, '#ff007f');
  assert.equal(avatar.palette.shoesColor, '#d4af37');

  const json = avatar.toJSON();
  assert.equal(json['name'], 'CyberpunkDancer');
  assert.equal(json['scale'], 1.5);
});

test('IsometricAvatarEntity validates constructor arguments', () => {
  const validPalette: AvatarColorPalette = {
    skinColor: '#fcd5b4',
    hairColor: '#4a2c11',
    shirtColor: '#00f0ff',
    pantsColor: '#1e293b',
    shoesColor: '#111827'
  };
  assert.throws(() => {
    new IsometricAvatarEntity({
      name: '',
      palette: validPalette
    });
  }, /Avatar name must not be empty/);

  assert.throws(() => {
    new IsometricAvatarEntity({
      name: 'ValidName',
      palette: validPalette,
      scale: -0.5
    });
  }, /Avatar scale must be positive/);

  assert.throws(() => {
    new IsometricAvatarEntity({
      name: 'ValidName',
      palette: validPalette,
      direction: -1
    });
  }, /Avatar direction must be non-negative/);
});

test('IsometricAvatarEntity returns correct yaw directions', () => {
  const avatar = IsometricAvatarEntity.createDefault();
  assert.equal(avatar.getDirectionYaw(0, 4), 45);
  assert.equal(avatar.getDirectionYaw(1, 4), 135);
  assert.equal(avatar.getDirectionYaw(2, 4), 225);
  assert.equal(avatar.getDirectionYaw(3, 4), 315);

  assert.equal(avatar.getDirectionYaw(0, 8), 45);
  assert.equal(avatar.getDirectionYaw(1, 8), 90);
  assert.equal(avatar.getDirectionYaw(2, 8), 135);
  assert.equal(avatar.getDirectionYaw(3, 8), 180);
  assert.equal(avatar.getDirectionYaw(4, 8), 225);
  assert.equal(avatar.getDirectionYaw(5, 8), 270);
  assert.equal(avatar.getDirectionYaw(6, 8), 315);
  assert.equal(avatar.getDirectionYaw(7, 8), 0);
});

test('DepthSortingMath calculates isometric depth correctly', () => {
  const depthGround = DepthSortingMath.calculateIsometricDepth(100, 200, 0);
  assert.equal(depthGround, 200);

  const depthElevated = DepthSortingMath.calculateIsometricDepth(100, 200, 1.5);
  assert.equal(depthElevated, 1700);

  const depthElevatedHigh = DepthSortingMath.calculateIsometricDepth(50, 150, 2);
  assert.equal(depthElevatedHigh, 2150);
});

test('DepthSortingMath sorts entities by depth in ascending rendering order', () => {
  const entities = [
    { id: 'entity_front', screenX: 100, screenY: 300, elevation: 0 },
    { id: 'entity_back', screenX: 100, screenY: 50, elevation: 0 },
    { id: 'entity_elevated', screenX: 100, screenY: 100, elevation: 1 },
    { id: 'entity_mid', screenX: 100, screenY: 150, elevation: 0 }
  ];

  const sorted = DepthSortingMath.sortEntitiesByDepth(entities);
  assert.equal(sorted[0].id, 'entity_back');
  assert.equal(sorted[1].id, 'entity_mid');
  assert.equal(sorted[2].id, 'entity_front');
  assert.equal(sorted[3].id, 'entity_elevated');
});

test('DepthSortingMath screenToGrid and gridToScreen roundtrip with mathematical precision', () => {
  const tileWidth = 64;
  const tileHeight = 32;
  const originX = 250;
  const originY = 180;

  const testCoords = [
    { gx: 0, gy: 0 },
    { gx: 5, gy: 3 },
    { gx: 12.5, gy: 8.25 },
    { gx: -4, gy: 6 },
    { gx: 7.75, gy: -2.5 }
  ];

  for (const { gx, gy } of testCoords) {
    const screen = DepthSortingMath.gridToScreen(gx, gy, tileWidth, tileHeight, originX, originY);
    const grid = DepthSortingMath.screenToGrid(screen.screenX, screen.screenY, tileWidth, tileHeight, originX, originY);
    assert.ok(Math.abs(grid.gridX - gx) < 1e-10, `gridX mismatch: expected ${gx}, got ${grid.gridX}`);
    assert.ok(Math.abs(grid.gridY - gy) < 1e-10, `gridY mismatch: expected ${gy}, got ${grid.gridY}`);
  }
});

test('handleAvatarGenerator calls bridge with validated params and returns MCP response', async () => {
  const sanitizer = new SafePathSanitizer();
  let capturedCommand = '';
  let capturedParams: Record<string, unknown> | null = null;
  const mockBridge: IBlenderBridge = {
    sendCommand: async <T>(method: string, params: Record<string, unknown>) => {
      capturedCommand = method;
      capturedParams = params;
      return { success: true, data: { filesCount: 8 } } as unknown as { success: boolean; data?: T; error?: string };
    },
    connect: async () => {},
    disconnect: async () => {},
    isConnected: () => true
  };

  const response = await handleAvatarGenerator(mockBridge, sanitizer, {
    name: 'NeoAvatar',
    skinColor: '#fcd5b4',
    hairColor: '#4a2c11',
    shirtColor: '#ff007f',
    pantsColor: '#05472a',
    shoesColor: '#d4af37',
    scale: 1.0,
    directions: 8,
    tileWidth: 128,
    tileHeight: 256,
    outputDirectory: 'output/blender/turnarounds',
    baseName: 'neo_avatar'
  });

  assert.equal(response.isError, false);
  assert.equal(capturedCommand, 'build_avatar');
  assert.equal(capturedParams?.['name'], 'NeoAvatar');
  assert.equal(capturedParams?.['directions'], 8);
  const parsed = JSON.parse(response.content[0].text);
  assert.equal(parsed.success, true);
});

