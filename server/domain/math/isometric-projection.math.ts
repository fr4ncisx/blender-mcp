export const CAMERA_ANGLE_X_DEG = 60.0;
export const CAMERA_ANGLE_Y_DEG = 0.0;
export const DIMETRIC_RATIO = 2.0;
export const DIMETRIC_ANGLE_RAD = Math.atan(0.5);

export interface DimetricResolution {
  readonly width: number;
  readonly height: number;
}

export interface ScreenPoint2D {
  readonly screenX: number;
  readonly screenY: number;
}

export function calculateOrthoScale(unitSize: number): number {
  return Math.SQRT2 * unitSize;
}

export function calculateDimetricResolution(tileWidth: number): DimetricResolution {
  return {
    width: tileWidth,
    height: Math.floor(tileWidth / 2)
  };
}

export function getDirectionYaw(directionIndex: number, totalDirections: 4 | 8): number {
  if (!Number.isInteger(directionIndex) || directionIndex < 0 || directionIndex >= totalDirections) {
    throw new RangeError(`Direction index must be an integer between 0 and ${totalDirections - 1}`);
  }
  const step = 360 / totalDirections;
  return (45 + directionIndex * step) % 360;
}

export function projectWorldToDimetricScreen(
  x: number,
  y: number,
  z: number,
  pixelsPerUnit: number
): ScreenPoint2D {
  const screenX = (x - y) * Math.cos(DIMETRIC_ANGLE_RAD) * pixelsPerUnit;
  const screenY = ((x + y) * Math.sin(DIMETRIC_ANGLE_RAD) - z) * pixelsPerUnit;
  return { screenX, screenY };
}
