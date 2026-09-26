export class Resolution {
  private readonly _width: number;
  private readonly _height: number;

  constructor(width: number, height: number = width / 2) {
    if (!Number.isInteger(width) || width <= 0) {
      throw new TypeError('Resolution width must be a positive integer');
    }
    if (width % 2 !== 0) {
      throw new RangeError('Resolution width must be an even number');
    }
    if (!Number.isInteger(height) || height <= 0) {
      throw new TypeError('Resolution height must be a positive integer');
    }
    if (height !== width / 2) {
      throw new RangeError('Resolution height must be exactly half of width for dimetric projection');
    }
    this._width = width;
    this._height = height;
    Object.freeze(this);
  }

  public static create(width: number): Resolution {
    return new Resolution(width, width / 2);
  }

  public get width(): number {
    return this._width;
  }

  public get height(): number {
    return this._height;
  }

  public get aspectRatio(): number {
    return this._width / this._height;
  }

  public equals(other: Resolution): boolean {
    return this._width === other._width && this._height === other._height;
  }

  public toJSON(): { width: number; height: number; aspectRatio: number } {
    return {
      width: this._width,
      height: this._height,
      aspectRatio: this.aspectRatio
    };
  }
}
