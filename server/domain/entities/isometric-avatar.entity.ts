import { getDirectionYaw } from '../math/isometric-projection.math.js';

export interface AvatarColorPalette {
  readonly skinColor: string;
  readonly hairColor: string;
  readonly shirtColor: string;
  readonly pantsColor: string;
  readonly shoesColor: string;
}

export interface IsometricAvatarProps {
  readonly name: string;
  readonly palette: AvatarColorPalette;
  readonly scale?: number;
  readonly direction?: number;
  readonly gridX?: number;
  readonly gridY?: number;
  readonly elevation?: number;
}

export class IsometricAvatarEntity {
  public readonly name: string;
  public readonly palette: AvatarColorPalette;
  public readonly scale: number;
  public readonly direction: number;
  public readonly gridX: number;
  public readonly gridY: number;
  public readonly elevation: number;

  public constructor(props: IsometricAvatarProps) {
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Avatar name must not be empty');
    }
    const scale = props.scale ?? 1.0;
    if (scale <= 0) {
      throw new Error('Avatar scale must be positive');
    }
    const direction = props.direction ?? 0;
    if (direction < 0) {
      throw new Error('Avatar direction must be non-negative');
    }
    this.name = props.name.trim();
    this.palette = Object.freeze({ ...props.palette });
    this.scale = scale;
    this.direction = direction;
    this.gridX = props.gridX ?? 0;
    this.gridY = props.gridY ?? 0;
    this.elevation = props.elevation ?? 0;
    Object.freeze(this);
  }

  public static createDefault(
    name: string = 'IsoAvatar',
    overrides?: Partial<AvatarColorPalette>
  ): IsometricAvatarEntity {
    const defaultPalette: AvatarColorPalette = {
      skinColor: '#fcd5b4',
      hairColor: '#4a2c11',
      shirtColor: '#00f0ff',
      pantsColor: '#1e293b',
      shoesColor: '#111827'
    };
    const palette: AvatarColorPalette = {
      skinColor: overrides?.skinColor ?? defaultPalette.skinColor,
      hairColor: overrides?.hairColor ?? defaultPalette.hairColor,
      shirtColor: overrides?.shirtColor ?? defaultPalette.shirtColor,
      pantsColor: overrides?.pantsColor ?? defaultPalette.pantsColor,
      shoesColor: overrides?.shoesColor ?? defaultPalette.shoesColor
    };
    return new IsometricAvatarEntity({
      name,
      palette,
      scale: 1.0,
      direction: 0,
      gridX: 0,
      gridY: 0,
      elevation: 0
    });
  }

  public getDirectionYaw(dirIndex: number, totalDirs: 4 | 8): number {
    return getDirectionYaw(dirIndex, totalDirs);
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      palette: this.palette,
      scale: this.scale,
      direction: this.direction,
      gridX: this.gridX,
      gridY: this.gridY,
      elevation: this.elevation
    };
  }
}
