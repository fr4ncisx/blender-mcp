export interface IsometricPoint {
  readonly x: number;
  readonly y: number;
}

export class IsometricCollisionEntity {
  private constructor() {}

  public static createIsometricTileDiamond(
    tileWidth: number,
    tileHeight: number
  ): readonly IsometricPoint[] {
    if (!Number.isFinite(tileWidth) || tileWidth <= 0 || !Number.isFinite(tileHeight) || tileHeight <= 0) {
      throw new RangeError('Tile dimensions must be positive finite numbers');
    }

    return Object.freeze([
      Object.freeze({ x: tileWidth / 2, y: 0 }),
      Object.freeze({ x: tileWidth, y: tileHeight / 2 }),
      Object.freeze({ x: tileWidth / 2, y: tileHeight }),
      Object.freeze({ x: 0, y: tileHeight / 2 })
    ]);
  }

  public static createBoundingBox(
    x: number,
    y: number,
    width: number,
    height: number
  ): readonly IsometricPoint[] {
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(width) ||
      width <= 0 ||
      !Number.isFinite(height) ||
      height <= 0
    ) {
      throw new RangeError('Bounding box dimensions must be valid finite numbers with positive size');
    }

    return Object.freeze([
      Object.freeze({ x, y }),
      Object.freeze({ x: x + width, y }),
      Object.freeze({ x: x + width, y: y + height }),
      Object.freeze({ x, y: y + height })
    ]);
  }
}
