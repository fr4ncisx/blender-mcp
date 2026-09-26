import { IsometricCollisionEntity } from './isometric-collision.entity.js';
import { DepthSortingMath } from '../math/depth-sorting.math.js';

export type BlueprintTokenType =
  | 'void'
  | 'wall_perimeter'
  | 'wall_interior'
  | 'floor'
  | 'bar_counter'
  | 'sofa'
  | 'table'
  | 'doorway'
  | 'stair_n'
  | 'stair_s'
  | 'stair_e'
  | 'stair_w'
  | 'light_column';

export interface BlueprintCell {
  readonly token: BlueprintTokenType;
  readonly char: string;
  readonly gridX: number;
  readonly gridY: number;
  readonly elevation: number;
}

export interface CollisionDiamondRecord {
  readonly id: string;
  readonly type: string;
  readonly gridX: number;
  readonly gridY: number;
  readonly elevation: number;
  readonly screenX: number;
  readonly screenY: number;
  readonly diamondVertices: readonly { readonly x: number; readonly y: number }[];
}

export class WorldBlueprintEntity {
  private readonly _width: number;
  private readonly _depth: number;
  private readonly _cells: readonly BlueprintCell[];
  private readonly _obstacles: readonly BlueprintCell[];
  private readonly _walkableFloor: readonly BlueprintCell[];
  private readonly _seats: readonly BlueprintCell[];
  private readonly _lights: readonly BlueprintCell[];
  private readonly _stairs: readonly BlueprintCell[];

  constructor(width: number, depth: number, cells: readonly BlueprintCell[]) {
    if (!Number.isInteger(width) || width <= 0) {
      throw new RangeError('World width must be a positive integer');
    }
    if (!Number.isInteger(depth) || depth <= 0) {
      throw new RangeError('World depth must be a positive integer');
    }
    if (!cells || cells.length === 0) {
      throw new Error('Cells array cannot be empty');
    }
    if (cells.length !== width * depth) {
      throw new Error(`Cells count (${cells.length}) does not match dimensions (${width}x${depth}=${width * depth})`);
    }

    this._width = width;
    this._depth = depth;
    this._cells = Object.freeze([...cells]);

    this._obstacles = Object.freeze(
      this._cells.filter(
        (c) =>
          c.token === 'wall_perimeter' ||
          c.token === 'wall_interior' ||
          c.token === 'bar_counter' ||
          c.token === 'table' ||
          c.token === 'light_column'
      )
    );

    this._walkableFloor = Object.freeze(
      this._cells.filter(
        (c) =>
          c.token === 'floor' ||
          c.token === 'doorway' ||
          c.token === 'stair_n' ||
          c.token === 'stair_s' ||
          c.token === 'stair_e' ||
          c.token === 'stair_w'
      )
    );

    this._seats = Object.freeze(this._cells.filter((c) => c.token === 'sofa'));
    this._lights = Object.freeze(this._cells.filter((c) => c.token === 'light_column'));
    this._stairs = Object.freeze(this._cells.filter((c) => c.token.startsWith('stair_')));

    Object.freeze(this);
  }

  public get width(): number {
    return this._width;
  }

  public get depth(): number {
    return this._depth;
  }

  public get cells(): readonly BlueprintCell[] {
    return this._cells;
  }

  public get obstacles(): readonly BlueprintCell[] {
    return this._obstacles;
  }

  public get walkableFloor(): readonly BlueprintCell[] {
    return this._walkableFloor;
  }

  public get seats(): readonly BlueprintCell[] {
    return this._seats;
  }

  public get lights(): readonly BlueprintCell[] {
    return this._lights;
  }

  public get stairs(): readonly BlueprintCell[] {
    return this._stairs;
  }

  public static parse(asciiGrid: string): WorldBlueprintEntity {
    if (typeof asciiGrid !== 'string' || asciiGrid.trim().length === 0) {
      throw new Error('Blueprint ASCII grid cannot be empty');
    }

    const normalized = asciiGrid.replace(/^\r?\n+/, '').replace(/\r?\n+$/, '');
    if (normalized.length === 0) {
      throw new Error('Blueprint ASCII grid cannot be empty');
    }

    const lines = normalized.split(/\r?\n/);
    const depth = lines.length;
    const width = lines[0].length;

    if (width === 0 || depth === 0) {
      throw new Error('Blueprint must have at least 1 cell');
    }

    for (let y = 0; y < depth; y++) {
      if (lines[y].length !== width) {
        throw new Error(`Inconsistent row lengths in blueprint grid: expected ${width}, got ${lines[y].length} at row ${y}`);
      }
    }

    const cells: BlueprintCell[] = [];

    for (let y = 0; y < depth; y++) {
      for (let x = 0; x < width; x++) {
        const char = lines[y][x];
        let token: BlueprintTokenType;
        let elevation = 0;

        if (char === ' ') {
          token = 'void';
          elevation = 0;
        } else if (char === '.') {
          token = 'floor';
          elevation = 0;
        } else if (char === '#') {
          token = 'wall_perimeter';
          elevation = 0;
        } else if (char === '=') {
          token = 'wall_interior';
          elevation = 0;
        } else if (char >= '0' && char <= '9') {
          token = 'floor';
          elevation = Number.parseInt(char, 10) * 0.25;
        } else if (char === 'B') {
          token = 'bar_counter';
          elevation = 0;
        } else if (char === 'S') {
          token = 'sofa';
          elevation = 0;
        } else if (char === 'T') {
          token = 'table';
          elevation = 0;
        } else if (char === 'D') {
          token = 'doorway';
          elevation = 0;
        } else if (char === '^') {
          token = 'stair_n';
          elevation = 0;
        } else if (char === 'v') {
          token = 'stair_s';
          elevation = 0;
        } else if (char === '<') {
          token = 'stair_w';
          elevation = 0;
        } else if (char === '>') {
          token = 'stair_e';
          elevation = 0;
        } else if (char === 'L') {
          token = 'light_column';
          elevation = 0;
        } else {
          throw new Error(`Unknown blueprint token character: '${char}' at (${x}, ${y})`);
        }

        cells.push(
          Object.freeze({
            token,
            char,
            gridX: x,
            gridY: y,
            elevation
          })
        );
      }
    }

    return new WorldBlueprintEntity(width, depth, cells);
  }

  public calculateCollisionDiamonds(
    tileWidth: number,
    tileHeight: number
  ): readonly CollisionDiamondRecord[] {
    const baseDiamond = IsometricCollisionEntity.createIsometricTileDiamond(tileWidth, tileHeight);
    return Object.freeze(
      this._obstacles.map((cell) => {
        const { screenX, screenY } = DepthSortingMath.gridToScreen(
          cell.gridX,
          cell.gridY,
          tileWidth,
          tileHeight
        );
        const diamondVertices = Object.freeze(
          baseDiamond.map((pt) =>
            Object.freeze({
              x: screenX + pt.x,
              y: screenY + pt.y
            })
          )
        );
        return Object.freeze({
          id: `${cell.token}_${cell.gridX}_${cell.gridY}`,
          type: cell.token,
          gridX: cell.gridX,
          gridY: cell.gridY,
          elevation: cell.elevation,
          screenX,
          screenY,
          diamondVertices
        });
      })
    );
  }

  public toCompilerPayload(): Record<string, unknown> {
    return {
      width: this._width,
      depth: this._depth,
      cells: this._cells,
      obstacles: this._obstacles,
      walkableFloor: this._walkableFloor,
      seats: this._seats,
      lights: this._lights,
      stairs: this._stairs
    };
  }
}
