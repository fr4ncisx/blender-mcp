import { Resolution } from '../value-objects/resolution.vo.js';

export type RenderPassType = 'albedo' | 'normal_2d' | 'depth' | 'shadow_mask';

export const VALID_RENDER_PASS_TYPES: readonly RenderPassType[] = Object.freeze([
  'albedo',
  'normal_2d',
  'depth',
  'shadow_mask'
]);

export interface RenderPassFile {
  readonly passType: RenderPassType;
  readonly filePath: string;
  readonly resolution: Resolution;
}

export interface RenderPassBundleProps {
  readonly id: string;
  readonly tileId: string;
  readonly passes: readonly RenderPassFile[];
}

export class RenderPassBundle {
  private readonly _id: string;
  private readonly _tileId: string;
  private readonly _passes: ReadonlyMap<RenderPassType, RenderPassFile>;

  constructor(props: RenderPassBundleProps) {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error('RenderPassBundle id must not be empty');
    }
    if (!props.tileId || props.tileId.trim().length === 0) {
      throw new Error('RenderPassBundle tileId must not be empty');
    }
    if (!Array.isArray(props.passes) || props.passes.length === 0) {
      throw new Error('RenderPassBundle must contain at least one pass');
    }

    const passMap = new Map<RenderPassType, RenderPassFile>();
    for (const pass of props.passes) {
      if (!VALID_RENDER_PASS_TYPES.includes(pass.passType)) {
        throw new Error(`Invalid render pass type: ${pass.passType}`);
      }
      if (!pass.filePath || pass.filePath.trim().length === 0) {
        throw new Error(`Render pass file path must not be empty for pass: ${pass.passType}`);
      }
      if (!(pass.resolution instanceof Resolution)) {
        throw new TypeError(`Render pass resolution must be an instance of Resolution for pass: ${pass.passType}`);
      }
      if (passMap.has(pass.passType)) {
        throw new Error(`Duplicate pass type detected in RenderPassBundle: ${pass.passType}`);
      }
      passMap.set(pass.passType, {
        passType: pass.passType,
        filePath: pass.filePath.trim(),
        resolution: pass.resolution
      });
    }

    this._id = props.id.trim();
    this._tileId = props.tileId.trim();
    this._passes = passMap;

    Object.freeze(this);
  }

  public get id(): string {
    return this._id;
  }

  public get tileId(): string {
    return this._tileId;
  }

  public get passCount(): number {
    return this._passes.size;
  }

  public get passes(): readonly RenderPassFile[] {
    return Array.from(this._passes.values());
  }

  public getPass(passType: RenderPassType): RenderPassFile | undefined {
    return this._passes.get(passType);
  }

  public hasPass(passType: RenderPassType): boolean {
    return this._passes.has(passType);
  }

  public isComplete(): boolean {
    return VALID_RENDER_PASS_TYPES.every((type) => this._passes.has(type));
  }

  public equals(other: RenderPassBundle): boolean {
    if (this._id !== other._id || this._tileId !== other._tileId || this._passes.size !== other._passes.size) {
      return false;
    }
    for (const [type, pass] of this._passes.entries()) {
      const otherPass = other._passes.get(type);
      if (!otherPass) return false;
      if (pass.filePath !== otherPass.filePath) return false;
      if (!pass.resolution.equals(otherPass.resolution)) return false;
    }
    return true;
  }

  public toJSON(): {
    id: string;
    tileId: string;
    isComplete: boolean;
    passes: Array<{
      passType: RenderPassType;
      filePath: string;
      resolution: { width: number; height: number; aspectRatio: number };
    }>;
  } {
    return {
      id: this._id,
      tileId: this._tileId,
      isComplete: this.isComplete(),
      passes: Array.from(this._passes.values()).map((p) => ({
        passType: p.passType,
        filePath: p.filePath,
        resolution: p.resolution.toJSON()
      }))
    };
  }
}
