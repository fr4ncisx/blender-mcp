export type FurniType =
  | 'sofa_single'
  | 'sofa_double'
  | 'coffee_table'
  | 'bar_counter'
  | 'bar_stool'
  | 'potted_plant'
  | 'wall_art'
  | 'dj_booth'
  | 'speaker_stack'
  | 'curved_sofa'
  | 'vip_table'
  | 'floor_lamp'
  | 'stair_step'
  | 'reception_desk'
  | 'centerpiece'
  | 'doorway_frame'
  | 'entrance_mat'
  | 'transition_pad';

import { ThemeSynthesizer } from '../services/theme-synthesizer.service.js';

export type FloorStyle =
  | 'architectural_stone'
  | 'hardwood_parquet'
  | 'executive_slate'
  | 'carpet'
  | 'checkerboard';

export type RoomTheme = string;

export type RoomScale = 'intimate' | 'grand' | 'epic';

export type RoomLayoutCell = number | string | null;

export interface EntryTileSpec {
  readonly gridX: number;
  readonly gridY: number;
  readonly elevation?: number;
  readonly direction?: 'N' | 'S' | 'E' | 'W';
}

export interface TransitionTileSpec {
  readonly gridX: number;
  readonly gridY: number;
  readonly elevation?: number;
  readonly targetRoom?: string;
  readonly label?: string;
}

export interface SocialFurniItem {
  readonly type: FurniType;
  readonly gridX: number;
  readonly gridY: number;
  readonly elevation?: number;
  readonly rotationSteps?: 0 | 1 | 2 | 3;
  readonly primaryColor?: string;
  readonly secondaryColor?: string;
}

export interface SocialRoomPalette {
  readonly floorLight: string;
  readonly floorDark: string;
  readonly wallColor: string;
  readonly wallTrim: string;
  readonly accentColor: string;
  readonly secondaryAccent?: string;
  readonly metalAccent?: string;
  readonly woodAccent?: string;
}

export interface RoomCapacityMetrics {
  readonly minimumCapacity: number;
  readonly calculatedMaxCapacity: number;
  readonly seatingCapacity: number;
  readonly standingWalkableCapacity: number;
  readonly totalFloorTiles: number;
}

export interface SeatingSpot {
  readonly id: string;
  readonly gridX: number;
  readonly gridY: number;
  readonly elevation: number;
  readonly sitDirection: 0 | 90 | 180 | 270;
}

export interface NavigationCell {
  readonly gridX: number;
  readonly gridY: number;
  readonly elevation: number;
  readonly walkable: boolean;
  readonly tileType: string;
}

export interface SocialRoomSpec {
  readonly width?: number;
  readonly depth?: number;
  readonly floorStyle?: FloorStyle;
  readonly wallHeight?: number;
  readonly furniture?: ReadonlyArray<SocialFurniItem>;
  readonly palette?: SocialRoomPalette;
  readonly layoutMatrix?: ReadonlyArray<ReadonlyArray<RoomLayoutCell>>;
  readonly targetFramework?: string;
  readonly theme?: RoomTheme;
  readonly roomScale?: RoomScale;
  readonly capacityTarget?: number;
  readonly entryTile?: EntryTileSpec;
  readonly transitionTiles?: ReadonlyArray<TransitionTileSpec>;
}

export const THEME_PRESETS: Readonly<Record<RoomTheme, SocialRoomPalette>> = Object.freeze({
  luxury_lounge: Object.freeze({
    floorLight: '#e9ecef',
    floorDark: '#cfd8dc',
    wallColor: '#1a2634',
    wallTrim: '#c5a059',
    accentColor: '#a0522d',
    secondaryAccent: '#1b4332',
    metalAccent: '#d4af37',
    woodAccent: '#3e2723'
  }),
  cyberpunk_club: Object.freeze({
    floorLight: '#1f242d',
    floorDark: '#0f141c',
    wallColor: '#0d1117',
    wallTrim: '#00f5d4',
    accentColor: '#ff007f',
    secondaryAccent: '#7928ca',
    metalAccent: '#00b4d8',
    woodAccent: '#161b22'
  }),
  cozy_bistro: Object.freeze({
    floorLight: '#f5ebe0',
    floorDark: '#d5bdaf',
    wallColor: '#4a3e3d',
    wallTrim: '#bc6c25',
    accentColor: '#dda15e',
    secondaryAccent: '#6b705c',
    metalAccent: '#b7b7a4',
    woodAccent: '#582f0e'
  })
});

export class SocialRoom {
  public readonly width: number;
  public readonly depth: number;
  public readonly floorStyle: FloorStyle;
  public readonly wallHeight: number;
  public readonly furniture: ReadonlyArray<SocialFurniItem>;
  public readonly palette: SocialRoomPalette;
  public readonly layoutMatrix?: ReadonlyArray<ReadonlyArray<RoomLayoutCell>>;
  public readonly targetFramework?: string;
  public readonly theme?: RoomTheme;
  public readonly roomScale: RoomScale;
  public readonly capacityTarget: number;
  public readonly entryTile?: EntryTileSpec;
  public readonly transitionTiles?: ReadonlyArray<TransitionTileSpec>;

  constructor(spec: SocialRoomSpec = {}) {
    this.theme = spec.theme;
    this.roomScale = spec.roomScale ?? 'grand';
    this.capacityTarget = spec.capacityTarget ?? 50;

    const dimensions = this.resolveScaleDimensions(this.roomScale, spec.width, spec.depth);
    this.width = dimensions.width;
    this.depth = dimensions.depth;
    this.floorStyle = spec.floorStyle ?? 'architectural_stone';
    this.wallHeight = spec.wallHeight ?? 2.4;
    this.furniture = Object.freeze([...(spec.furniture ?? [])]);
    this.layoutMatrix = spec.layoutMatrix
      ? Object.freeze(spec.layoutMatrix.map((row) => Object.freeze([...row])))
      : undefined;
    this.targetFramework = spec.targetFramework;
    this.entryTile = spec.entryTile;
    this.transitionTiles = spec.transitionTiles
      ? Object.freeze([...spec.transitionTiles])
      : undefined;

    this.palette = ThemeSynthesizer.synthesize(this.theme, spec.palette);

    Object.freeze(this);
  }

  private resolveScaleDimensions(
    scale: RoomScale,
    explicitWidth?: number,
    explicitDepth?: number
  ): { width: number; depth: number } {
    if (explicitWidth && explicitDepth) {
      if (!Number.isInteger(explicitWidth) || explicitWidth < 2) {
        throw new RangeError('Room width must be an integer >= 2');
      }
      if (!Number.isInteger(explicitDepth) || explicitDepth < 2) {
        throw new RangeError('Room depth must be an integer >= 2');
      }
      return { width: explicitWidth, depth: explicitDepth };
    }

    if (scale === 'intimate') {
      return { width: 12, depth: 12 };
    }
    if (scale === 'epic') {
      return { width: 36, depth: 36 };
    }
    return { width: 28, depth: 28 };
  }

  public toJSON(): Required<
    Omit<SocialRoomSpec, 'layoutMatrix' | 'targetFramework' | 'theme' | 'entryTile' | 'transitionTiles'>
  > & {
    layoutMatrix?: ReadonlyArray<ReadonlyArray<RoomLayoutCell>>;
    targetFramework?: string;
    theme?: RoomTheme;
    entryTile?: EntryTileSpec;
    transitionTiles?: ReadonlyArray<TransitionTileSpec>;
  } {
    return {
      width: this.width,
      depth: this.depth,
      floorStyle: this.floorStyle,
      wallHeight: this.wallHeight,
      furniture: this.furniture,
      palette: this.palette,
      theme: this.theme,
      roomScale: this.roomScale,
      capacityTarget: this.capacityTarget,
      layoutMatrix: this.layoutMatrix,
      targetFramework: this.targetFramework,
      entryTile: this.entryTile,
      transitionTiles: this.transitionTiles
    };
  }
}
