export interface ScreenPoint {
  readonly screenX: number;
  readonly screenY: number;
}

export interface GridPoint {
  readonly gridX: number;
  readonly gridY: number;
}

export interface DepthEntity {
  readonly screenX: number;
  readonly screenY: number;
  readonly elevation?: number;
}

export class DepthSortingMath {
  public static calculateIsometricDepth(
    screenX: number,
    screenY: number,
    elevation: number = 0
  ): number {
    return screenY + elevation * 1000;
  }

  public static sortEntitiesByDepth<T extends DepthEntity>(
    entities: readonly T[]
  ): T[] {
    return [...entities].sort((a, b) => {
      const depthA = DepthSortingMath.calculateIsometricDepth(
        a.screenX,
        a.screenY,
        a.elevation ?? 0
      );
      const depthB = DepthSortingMath.calculateIsometricDepth(
        b.screenX,
        b.screenY,
        b.elevation ?? 0
      );
      if (depthA !== depthB) {
        return depthA - depthB;
      }
      return a.screenX - b.screenX;
    });
  }

  public static gridToScreen(
    gridX: number,
    gridY: number,
    tileWidth: number,
    tileHeight: number,
    originX: number = 0,
    originY: number = 0
  ): ScreenPoint {
    const halfWidth = tileWidth / 2;
    const halfHeight = tileHeight / 2;
    const screenX = originX + (gridX - gridY) * halfWidth;
    const screenY = originY + (gridX + gridY) * halfHeight;
    return { screenX, screenY };
  }

  public static screenToGrid(
    screenX: number,
    screenY: number,
    tileWidth: number,
    tileHeight: number,
    originX: number = 0,
    originY: number = 0
  ): GridPoint {
    const halfWidth = tileWidth / 2;
    const halfHeight = tileHeight / 2;
    const dx = (screenX - originX) / halfWidth;
    const dy = (screenY - originY) / halfHeight;
    const gridX = (dx + dy) / 2;
    const gridY = (dy - dx) / 2;
    return { gridX, gridY };
  }
}
