import path from 'node:path';
import fs from 'node:fs/promises';
import {
  IAssetExportAdapter,
  ExportTargetType,
  ExportContext,
  ExportResult,
  ExportFileArtifact
} from '../../domain/contracts/asset-export-adapter.contract.js';
import { SafePathSanitizer } from '../storage/safe-path-sanitizer.js';

export interface TexturePackerFrame {
  readonly frame: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly rotated: boolean;
  readonly trimmed: boolean;
  readonly spriteSourceSize: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly sourceSize: { readonly w: number; readonly h: number };
  readonly pivot: { readonly x: number; readonly y: number };
}

export interface TexturePackerManifest {
  readonly frames: Record<string, TexturePackerFrame>;
  readonly meta: {
    readonly app: string;
    readonly version: string;
    readonly image: string;
    readonly format: string;
    readonly size: { readonly w: number; readonly h: number };
    readonly scale: string;
  };
}

export class UniversalAtlasExporter implements IAssetExportAdapter {
  public readonly targetType: ExportTargetType = 'universal';
  private readonly _sanitizer: SafePathSanitizer;

  constructor(sanitizer: SafePathSanitizer = new SafePathSanitizer()) {
    this._sanitizer = sanitizer;
  }

  public supports(target: ExportTargetType): boolean {
    return target === 'universal';
  }

  public async export(context: ExportContext): Promise<ExportResult> {
    try {
      const sanitizedDir = this._sanitizer.sanitizePath(context.outputDirectory);
      await fs.mkdir(sanitizedDir, { recursive: true });

      const baseName = context.baseName || 'atlas';
      const imageFileName = `${baseName}.png`;
      const jsonFileName = `${baseName}.json`;
      const jsonFilePath = path.join(sanitizedDir, jsonFileName);

      const frameWidth = typeof context.options?.['frameWidth'] === 'number' ? context.options['frameWidth'] : 128;
      const frameHeight = typeof context.options?.['frameHeight'] === 'number' ? context.options['frameHeight'] : 64;
      const totalFrames = typeof context.options?.['totalFrames'] === 'number' ? context.options['totalFrames'] : 4;

      const framesRecord: Record<string, TexturePackerFrame> = {};
      for (let i = 0; i < totalFrames; i++) {
        const frameKey = `${baseName}_dir_${i}.png`;
        framesRecord[frameKey] = {
          frame: {
            x: i * frameWidth,
            y: 0,
            w: frameWidth,
            h: frameHeight
          },
          rotated: false,
          trimmed: false,
          spriteSourceSize: {
            x: 0,
            y: 0,
            w: frameWidth,
            h: frameHeight
          },
          sourceSize: {
            w: frameWidth,
            h: frameHeight
          },
          pivot: {
            x: 0.5,
            y: 1.0
          }
        };
      }

      const manifest: TexturePackerManifest = {
        frames: framesRecord,
        meta: {
          app: 'blender-iso-mcp',
          version: '1.0.0',
          image: imageFileName,
          format: 'RGBA8888',
          size: {
            w: frameWidth * totalFrames,
            h: frameHeight
          },
          scale: '1'
        }
      };

      const jsonContent = JSON.stringify(manifest, null, 2);
      await fs.writeFile(jsonFilePath, jsonContent, 'utf-8');

      const artifacts: ExportFileArtifact[] = [
        {
          relativePath: jsonFileName,
          mimeType: 'application/json',
          sizeBytes: Buffer.byteLength(jsonContent, 'utf-8')
        }
      ];

      return {
        target: 'universal',
        success: true,
        artifacts,
        manifestPath: jsonFilePath
      };
    } catch (error) {
      return {
        target: 'universal',
        success: false,
        artifacts: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
