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

export class PhaserDefoldExporter implements IAssetExportAdapter {
  public readonly targetType: ExportTargetType = 'phaser_defold';
  private readonly _sanitizer: SafePathSanitizer;

  constructor(sanitizer: SafePathSanitizer = new SafePathSanitizer()) {
    this._sanitizer = sanitizer;
  }

  public supports(target: ExportTargetType): boolean {
    return target === 'phaser_defold';
  }

  public async export(context: ExportContext): Promise<ExportResult> {
    try {
      const sanitizedDir = this._sanitizer.sanitizePath(context.outputDirectory);
      await fs.mkdir(sanitizedDir, { recursive: true });

      const baseName = context.baseName || 'atlas';
      const frameWidth = typeof context.options?.['frameWidth'] === 'number' ? context.options['frameWidth'] : 128;
      const frameHeight = typeof context.options?.['frameHeight'] === 'number' ? context.options['frameHeight'] : 64;
      const totalFrames = typeof context.options?.['totalFrames'] === 'number' ? context.options['totalFrames'] : 4;
      const imageFileName = `${baseName}.png`;

      const phaserJsonFileName = `${baseName}_phaser.json`;
      const phaserJsonPath = path.join(sanitizedDir, phaserJsonFileName);
      const phaserManifest = this.generatePhaserManifest({
        baseName,
        frameWidth,
        frameHeight,
        totalFrames,
        imageFileName
      });
      const phaserContent = JSON.stringify(phaserManifest, null, 2);
      await fs.writeFile(phaserJsonPath, phaserContent, 'utf-8');

      const defoldAtlasFileName = `${baseName}.atlas`;
      const defoldAtlasPath = path.join(sanitizedDir, defoldAtlasFileName);
      const defoldContent = this.generateDefoldContent(imageFileName);
      await fs.writeFile(defoldAtlasPath, defoldContent, 'utf-8');

      const artifacts: ExportFileArtifact[] = [
        {
          relativePath: phaserJsonFileName,
          mimeType: 'application/json',
          sizeBytes: Buffer.byteLength(phaserContent, 'utf-8')
        },
        {
          relativePath: defoldAtlasFileName,
          mimeType: 'text/plain',
          sizeBytes: Buffer.byteLength(defoldContent, 'utf-8')
        }
      ];

      return {
        target: 'phaser_defold',
        success: true,
        artifacts,
        manifestPath: phaserJsonPath
      };
    } catch (error) {
      return {
        target: 'phaser_defold',
        success: false,
        artifacts: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private generatePhaserManifest(params: {
    baseName: string;
    frameWidth: number;
    frameHeight: number;
    totalFrames: number;
    imageFileName: string;
  }): Record<string, unknown> {
    const frames = [];
    for (let i = 0; i < params.totalFrames; i++) {
      frames.push({
        filename: `${params.baseName}_dir_${i}.png`,
        rotated: false,
        trimmed: false,
        sourceSize: {
          w: params.frameWidth,
          h: params.frameHeight
        },
        spriteSourceSize: {
          x: 0,
          y: 0,
          w: params.frameWidth,
          h: params.frameHeight
        },
        frame: {
          x: i * params.frameWidth,
          y: 0,
          w: params.frameWidth,
          h: params.frameHeight
        },
        anchor: {
          x: 0.5,
          y: 1.0
        }
      });
    }

    return {
      textures: [
        {
          image: params.imageFileName,
          format: 'RGBA8888',
          size: {
            w: params.frameWidth * params.totalFrames,
            h: params.frameHeight
          },
          scale: 1,
          frames
        }
      ],
      meta: {
        app: 'blender-iso-mcp',
        version: '1.0.0',
        target: 'phaser_defold'
      }
    };
  }

  private generateDefoldContent(imageFileName: string): string {
    return [
      'images {',
      `  image: "/${imageFileName}"`,
      '  sprite_trim_mode: SPRITE_TRIM_MODE_OFF',
      '}',
      'margin: 0',
      'extrude_borders: 0',
      'inner_padding: 0',
      ''
    ].join('\n');
  }
}
