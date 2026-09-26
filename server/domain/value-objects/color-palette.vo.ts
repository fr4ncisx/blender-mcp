export class ColorPalette {
  private readonly _colors: readonly string[];

  constructor(colors: readonly string[]) {
    if (!Array.isArray(colors) || colors.length === 0) {
      throw new Error('ColorPalette requires at least one color');
    }
    const normalizedColors = colors.map((color) => ColorPalette.normalizeHex(color));
    this._colors = Object.freeze([...normalizedColors]);
    Object.freeze(this);
  }

  public static normalizeHex(hex: string): string {
    const trimmed = hex.trim();
    const withoutHash = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;

    if (/^[0-9a-fA-F]{3}$/.test(withoutHash)) {
      const r = withoutHash[0];
      const g = withoutHash[1];
      const b = withoutHash[2];
      return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }

    if (/^[0-9a-fA-F]{6}$/.test(withoutHash)) {
      return `#${withoutHash}`.toUpperCase();
    }

    throw new Error(`Invalid hexadecimal color format: ${hex}`);
  }

  public get colors(): readonly string[] {
    return this._colors;
  }

  public get size(): number {
    return this._colors.length;
  }

  public getColor(index: number): string {
    if (!Number.isInteger(index) || index < 0 || index >= this._colors.length) {
      throw new RangeError(`Color index out of range: ${index}`);
    }
    return this._colors[index];
  }

  public hasColor(hex: string): boolean {
    try {
      const normalized = ColorPalette.normalizeHex(hex);
      return this._colors.includes(normalized);
    } catch {
      return false;
    }
  }

  public indexOf(hex: string): number {
    try {
      const normalized = ColorPalette.normalizeHex(hex);
      return this._colors.indexOf(normalized);
    } catch {
      return -1;
    }
  }

  public equals(other: ColorPalette): boolean {
    if (this._colors.length !== other._colors.length) {
      return false;
    }
    return this._colors.every((color, index) => color === other._colors[index]);
  }

  public toJSON(): readonly string[] {
    return [...this._colors];
  }
}
