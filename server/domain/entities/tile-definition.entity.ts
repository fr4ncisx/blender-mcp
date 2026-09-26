import { Resolution } from '../value-objects/resolution.vo.js';

export type TileType =
  | 'flat_ground'
  | 'cube_block'
  | 'slope_n'
  | 'slope_s'
  | 'slope_e'
  | 'slope_w'
  | 'wall_corner';

export const VALID_TILE_TYPES: readonly TileType[] = Object.freeze([
  'flat_ground',
  'cube_block',
  'slope_n',
  'slope_s',
  'slope_e',
  'slope_w',
  'wall_corner'
]);

export interface TileDefinitionProps {
  readonly id: string;
  readonly name: string;
  readonly tileType: TileType;
  readonly resolution: Resolution;
  readonly unitHeight?: number;
  readonly collisionRequired?: boolean;
}

export class TileDefinition {
  private readonly _id: string;
  private readonly _name: string;
  private readonly _tileType: TileType;
  private readonly _resolution: Resolution;
  private readonly _unitHeight: number;
  private readonly _collisionRequired: boolean;

  constructor(props: TileDefinitionProps) {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error('TileDefinition id must not be empty');
    }
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('TileDefinition name must not be empty');
    }
    if (!VALID_TILE_TYPES.includes(props.tileType)) {
      throw new Error(`Invalid tile type: ${props.tileType}`);
    }
    if (!(props.resolution instanceof Resolution)) {
      throw new TypeError('TileDefinition resolution must be an instance of Resolution');
    }

    const unitHeight = props.unitHeight ?? 1.0;
    if (unitHeight < 0) {
      throw new RangeError('TileDefinition unitHeight cannot be negative');
    }

    this._id = props.id.trim();
    this._name = props.name.trim();
    this._tileType = props.tileType;
    this._resolution = props.resolution;
    this._unitHeight = unitHeight;
    this._collisionRequired = props.collisionRequired ?? false;

    Object.freeze(this);
  }

  public get id(): string {
    return this._id;
  }

  public get name(): string {
    return this._name;
  }

  public get tileType(): TileType {
    return this._tileType;
  }

  public get resolution(): Resolution {
    return this._resolution;
  }

  public get unitHeight(): number {
    return this._unitHeight;
  }

  public get collisionRequired(): boolean {
    return this._collisionRequired;
  }

  public equals(other: TileDefinition): boolean {
    return (
      this._id === other._id &&
      this._name === other._name &&
      this._tileType === other._tileType &&
      this._resolution.equals(other._resolution) &&
      this._unitHeight === other._unitHeight &&
      this._collisionRequired === other._collisionRequired
    );
  }

  public toJSON(): {
    id: string;
    name: string;
    tileType: TileType;
    resolution: { width: number; height: number; aspectRatio: number };
    unitHeight: number;
    collisionRequired: boolean;
  } {
    return {
      id: this._id,
      name: this._name,
      tileType: this._tileType,
      resolution: this._resolution.toJSON(),
      unitHeight: this._unitHeight,
      collisionRequired: this._collisionRequired
    };
  }
}
