import { IsometricCollisionEntity, IsometricPoint } from './isometric-collision.entity.js';

export type AssetArchetype = 'floor' | 'wall' | 'slope' | 'furniture' | 'stair' | 'column' | 'transition';

export interface CreateStandardAssetParams {
  readonly id: string;
  readonly name: string;
  readonly archetype: AssetArchetype;
  readonly tileWidth: number;
  readonly unitHeight?: number;
  readonly tags?: readonly string[];
  readonly properties?: Readonly<Record<string, unknown>>;
}

export interface IsometricAssetDefinitionProps {
  readonly id: string;
  readonly name: string;
  readonly archetype: AssetArchetype;
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly spriteWidth: number;
  readonly spriteHeight: number;
  readonly unitHeight: number;
  readonly collisionDiamond: readonly IsometricPoint[];
  readonly anchorPivot: { readonly x: number; readonly y: number };
  readonly tags: readonly string[];
  readonly properties: Readonly<Record<string, unknown>>;
}

const VALID_ARCHETYPES: readonly AssetArchetype[] = Object.freeze([
  'floor',
  'wall',
  'slope',
  'furniture',
  'stair',
  'column',
  'transition'
]);

export class IsometricAssetDefinition {
  private readonly _props: IsometricAssetDefinitionProps;

  constructor(props: IsometricAssetDefinitionProps) {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error('Asset id must be a non-empty string');
    }
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Asset name must be a non-empty string');
    }
    if (!VALID_ARCHETYPES.includes(props.archetype)) {
      throw new Error(`Invalid asset archetype: ${props.archetype}`);
    }
    if (!Number.isInteger(props.tileWidth) || props.tileWidth <= 0 || props.tileWidth % 2 !== 0) {
      throw new RangeError('Tile width must be a positive even integer');
    }
    if (props.tileHeight !== Math.floor(props.tileWidth / 2)) {
      throw new RangeError('Tile height must be exactly Math.floor(tileWidth / 2) for 2:1 dimetric projection');
    }
    if (!Number.isFinite(props.spriteWidth) || props.spriteWidth <= 0) {
      throw new RangeError('Sprite width must be a positive finite number');
    }
    if (!Number.isFinite(props.spriteHeight) || props.spriteHeight <= 0) {
      throw new RangeError('Sprite height must be a positive finite number');
    }
    if (!Number.isFinite(props.unitHeight) || props.unitHeight <= 0) {
      throw new RangeError('Unit height must be a positive finite number');
    }

    this._props = Object.freeze({
      id: props.id,
      name: props.name,
      archetype: props.archetype,
      tileWidth: props.tileWidth,
      tileHeight: props.tileHeight,
      spriteWidth: props.spriteWidth,
      spriteHeight: props.spriteHeight,
      unitHeight: props.unitHeight,
      collisionDiamond: Object.freeze([...props.collisionDiamond]),
      anchorPivot: Object.freeze({ ...props.anchorPivot }),
      tags: Object.freeze([...(props.tags ?? [])]),
      properties: Object.freeze({ ...(props.properties ?? {}) })
    });

    Object.freeze(this);
  }

  public static createStandard(params: CreateStandardAssetParams): IsometricAssetDefinition {
    if (!params.id || params.id.trim().length === 0) {
      throw new Error('Asset id must be a non-empty string');
    }
    if (!params.name || params.name.trim().length === 0) {
      throw new Error('Asset name must be a non-empty string');
    }
    if (!VALID_ARCHETYPES.includes(params.archetype)) {
      throw new Error(`Invalid asset archetype: ${params.archetype}`);
    }
    if (!Number.isInteger(params.tileWidth) || params.tileWidth <= 0 || params.tileWidth % 2 !== 0) {
      throw new RangeError('Tile width must be a positive even integer for 2:1 dimetric ratio');
    }

    const tileWidth = params.tileWidth;
    const tileHeight = Math.floor(tileWidth / 2);

    let unitHeight: number;
    if (params.unitHeight !== undefined && params.unitHeight > 0) {
      unitHeight = params.unitHeight;
    } else if (params.archetype === 'floor' || params.archetype === 'transition') {
      unitHeight = 1.0;
    } else {
      unitHeight = 2.0;
    }

    const spriteWidth = tileWidth;
    const spriteHeight = Math.floor(tileHeight * unitHeight);

    const anchorY = Number(((spriteHeight - tileHeight * 0.5) / spriteHeight).toFixed(4));
    const anchorPivot = Object.freeze({ x: 0.5, y: anchorY });

    const collisionDiamond = IsometricCollisionEntity.createIsometricTileDiamond(tileWidth, tileHeight);

    return new IsometricAssetDefinition({
      id: params.id,
      name: params.name,
      archetype: params.archetype,
      tileWidth,
      tileHeight,
      spriteWidth,
      spriteHeight,
      unitHeight,
      collisionDiamond,
      anchorPivot,
      tags: params.tags ?? [],
      properties: params.properties ?? {}
    });
  }

  public get id(): string {
    return this._props.id;
  }

  public get name(): string {
    return this._props.name;
  }

  public get archetype(): AssetArchetype {
    return this._props.archetype;
  }

  public get tileWidth(): number {
    return this._props.tileWidth;
  }

  public get tileHeight(): number {
    return this._props.tileHeight;
  }

  public get spriteWidth(): number {
    return this._props.spriteWidth;
  }

  public get spriteHeight(): number {
    return this._props.spriteHeight;
  }

  public get unitHeight(): number {
    return this._props.unitHeight;
  }

  public get collisionDiamond(): readonly IsometricPoint[] {
    return this._props.collisionDiamond;
  }

  public get anchorPivot(): { readonly x: number; readonly y: number } {
    return this._props.anchorPivot;
  }

  public get tags(): readonly string[] {
    return this._props.tags;
  }

  public get properties(): Readonly<Record<string, unknown>> {
    return this._props.properties;
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this._props.id,
      name: this._props.name,
      archetype: this._props.archetype,
      tileWidth: this._props.tileWidth,
      tileHeight: this._props.tileHeight,
      spriteWidth: this._props.spriteWidth,
      spriteHeight: this._props.spriteHeight,
      unitHeight: this._props.unitHeight,
      collisionDiamond: this._props.collisionDiamond,
      anchorPivot: this._props.anchorPivot,
      tags: this._props.tags,
      properties: this._props.properties
    };
  }
}
