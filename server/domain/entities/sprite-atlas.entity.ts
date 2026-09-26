export interface PivotPointProps {
  readonly x: number;
  readonly y: number;
}

export class PivotPoint {
  private readonly _x: number;
  private readonly _y: number;

  constructor(x: number, y: number) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new TypeError('PivotPoint coordinates must be finite numbers');
    }
    this._x = x;
    this._y = y;
    Object.freeze(this);
  }

  public static center(): PivotPoint {
    return new PivotPoint(0.5, 0.5);
  }

  public static bottomCenter(): PivotPoint {
    return new PivotPoint(0.5, 1.0);
  }

  public get x(): number {
    return this._x;
  }

  public get y(): number {
    return this._y;
  }

  public equals(other: PivotPoint): boolean {
    return this._x === other._x && this._y === other._y;
  }

  public toJSON(): PivotPointProps {
    return {
      x: this._x,
      y: this._y
    };
  }
}

export interface SpriteFrameProps {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly pivot: PivotPoint;
  readonly durationMs?: number;
  readonly rotated?: boolean;
}

export class SpriteFrame {
  private readonly _id: string;
  private readonly _x: number;
  private readonly _y: number;
  private readonly _width: number;
  private readonly _height: number;
  private readonly _pivot: PivotPoint;
  private readonly _durationMs?: number;
  private readonly _rotated: boolean;

  constructor(props: SpriteFrameProps) {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error('SpriteFrame id must not be empty');
    }
    if (!Number.isInteger(props.x) || props.x < 0) {
      throw new RangeError('SpriteFrame x must be a non-negative integer');
    }
    if (!Number.isInteger(props.y) || props.y < 0) {
      throw new RangeError('SpriteFrame y must be a non-negative integer');
    }
    if (!Number.isInteger(props.width) || props.width <= 0) {
      throw new RangeError('SpriteFrame width must be a positive integer');
    }
    if (!Number.isInteger(props.height) || props.height <= 0) {
      throw new RangeError('SpriteFrame height must be a positive integer');
    }
    if (!(props.pivot instanceof PivotPoint)) {
      throw new TypeError('SpriteFrame pivot must be an instance of PivotPoint');
    }
    if (props.durationMs !== undefined && (props.durationMs < 0 || !Number.isFinite(props.durationMs))) {
      throw new RangeError('SpriteFrame durationMs must be a positive number if provided');
    }

    this._id = props.id.trim();
    this._x = props.x;
    this._y = props.y;
    this._width = props.width;
    this._height = props.height;
    this._pivot = props.pivot;
    this._durationMs = props.durationMs;
    this._rotated = props.rotated ?? false;

    Object.freeze(this);
  }

  public get id(): string {
    return this._id;
  }

  public get x(): number {
    return this._x;
  }

  public get y(): number {
    return this._y;
  }

  public get width(): number {
    return this._width;
  }

  public get height(): number {
    return this._height;
  }

  public get pivot(): PivotPoint {
    return this._pivot;
  }

  public get durationMs(): number | undefined {
    return this._durationMs;
  }

  public get rotated(): boolean {
    return this._rotated;
  }

  public equals(other: SpriteFrame): boolean {
    return (
      this._id === other._id &&
      this._x === other._x &&
      this._y === other._y &&
      this._width === other._width &&
      this._height === other._height &&
      this._pivot.equals(other._pivot) &&
      this._durationMs === other._durationMs &&
      this._rotated === other._rotated
    );
  }

  public toJSON(): {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    pivot: PivotPointProps;
    durationMs?: number;
    rotated: boolean;
  } {
    return {
      id: this._id,
      x: this._x,
      y: this._y,
      width: this._width,
      height: this._height,
      pivot: this._pivot.toJSON(),
      ...(this._durationMs !== undefined ? { durationMs: this._durationMs } : {}),
      rotated: this._rotated
    };
  }
}

export interface SpriteAtlasProps {
  readonly id: string;
  readonly name: string;
  readonly imagePath: string;
  readonly width: number;
  readonly height: number;
  readonly frames: readonly SpriteFrame[];
}

export class SpriteAtlas {
  private readonly _id: string;
  private readonly _name: string;
  private readonly _imagePath: string;
  private readonly _width: number;
  private readonly _height: number;
  private readonly _frames: readonly SpriteFrame[];
  private readonly _frameMap: ReadonlyMap<string, SpriteFrame>;

  constructor(props: SpriteAtlasProps) {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error('SpriteAtlas id must not be empty');
    }
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('SpriteAtlas name must not be empty');
    }
    if (!props.imagePath || props.imagePath.trim().length === 0) {
      throw new Error('SpriteAtlas imagePath must not be empty');
    }
    if (!Number.isInteger(props.width) || props.width <= 0) {
      throw new RangeError('SpriteAtlas width must be a positive integer');
    }
    if (!Number.isInteger(props.height) || props.height <= 0) {
      throw new RangeError('SpriteAtlas height must be a positive integer');
    }
    if (!Array.isArray(props.frames)) {
      throw new TypeError('SpriteAtlas frames must be an array');
    }

    const frameMap = new Map<string, SpriteFrame>();
    for (const frame of props.frames) {
      if (!(frame instanceof SpriteFrame)) {
        throw new TypeError('All items in frames must be instances of SpriteFrame');
      }
      if (frameMap.has(frame.id)) {
        throw new Error(`Duplicate frame ID detected in SpriteAtlas: ${frame.id}`);
      }
      frameMap.set(frame.id, frame);
    }

    this._id = props.id.trim();
    this._name = props.name.trim();
    this._imagePath = props.imagePath.trim();
    this._width = props.width;
    this._height = props.height;
    this._frames = Object.freeze([...props.frames]);
    this._frameMap = frameMap;

    Object.freeze(this);
  }

  public get id(): string {
    return this._id;
  }

  public get name(): string {
    return this._name;
  }

  public get imagePath(): string {
    return this._imagePath;
  }

  public get width(): number {
    return this._width;
  }

  public get height(): number {
    return this._height;
  }

  public get frames(): readonly SpriteFrame[] {
    return this._frames;
  }

  public get frameCount(): number {
    return this._frames.length;
  }

  public getFrame(id: string): SpriteFrame | undefined {
    return this._frameMap.get(id);
  }

  public hasFrame(id: string): boolean {
    return this._frameMap.has(id);
  }

  public equals(other: SpriteAtlas): boolean {
    if (
      this._id !== other._id ||
      this._name !== other._name ||
      this._imagePath !== other._imagePath ||
      this._width !== other._width ||
      this._height !== other._height ||
      this._frames.length !== other._frames.length
    ) {
      return false;
    }
    return this._frames.every((frame, index) => frame.equals(other._frames[index]));
  }

  public toJSON(): {
    id: string;
    name: string;
    imagePath: string;
    width: number;
    height: number;
    frameCount: number;
    frames: ReturnType<SpriteFrame['toJSON']>[];
  } {
    return {
      id: this._id,
      name: this._name,
      imagePath: this._imagePath,
      width: this._width,
      height: this._height,
      frameCount: this._frames.length,
      frames: this._frames.map((frame) => frame.toJSON())
    };
  }
}
