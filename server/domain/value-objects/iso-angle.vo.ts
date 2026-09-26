export type IsoDirectionCount = 4 | 8;

export class IsoAngle {
  private readonly _yawDegrees: number;
  private readonly _directionIndex: number;
  private readonly _totalDirections: IsoDirectionCount;

  private constructor(yawDegrees: number, directionIndex: number, totalDirections: IsoDirectionCount) {
    this._yawDegrees = yawDegrees;
    this._directionIndex = directionIndex;
    this._totalDirections = totalDirections;
    Object.freeze(this);
  }

  public static fromIndex(index: number, totalDirections: IsoDirectionCount = 4): IsoAngle {
    if (!Number.isInteger(index) || index < 0 || index >= totalDirections) {
      throw new RangeError(`Direction index must be an integer between 0 and ${totalDirections - 1}`);
    }
    const step = 360 / totalDirections;
    const yaw = (45 + index * step) % 360;
    return new IsoAngle(yaw, index, totalDirections);
  }

  public static fromDegrees(degrees: number, totalDirections: IsoDirectionCount = 4): IsoAngle {
    const normalized = ((degrees % 360) + 360) % 360;
    const step = 360 / totalDirections;
    for (let i = 0; i < totalDirections; i++) {
      const targetYaw = (45 + i * step) % 360;
      if (Math.abs(normalized - targetYaw) < 0.001) {
        return new IsoAngle(targetYaw, i, totalDirections);
      }
    }
    throw new RangeError(`Angle ${degrees}° does not match any valid isometric step for ${totalDirections} directions`);
  }

  public get degrees(): number {
    return this._yawDegrees;
  }

  public get radians(): number {
    return (this._yawDegrees * Math.PI) / 180;
  }

  public get directionIndex(): number {
    return this._directionIndex;
  }

  public get totalDirections(): IsoDirectionCount {
    return this._totalDirections;
  }

  public equals(other: IsoAngle): boolean {
    return (
      this._yawDegrees === other._yawDegrees &&
      this._totalDirections === other._totalDirections &&
      this._directionIndex === other._directionIndex
    );
  }

  public toJSON(): { degrees: number; radians: number; directionIndex: number; totalDirections: IsoDirectionCount } {
    return {
      degrees: this._yawDegrees,
      radians: this.radians,
      directionIndex: this._directionIndex,
      totalDirections: this._totalDirections
    };
  }
}
