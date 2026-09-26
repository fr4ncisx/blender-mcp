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

export class LdtkExporter implements IAssetExportAdapter {
  public readonly targetType: ExportTargetType = 'ldtk';
  private readonly _sanitizer: SafePathSanitizer;

  constructor(sanitizer: SafePathSanitizer = new SafePathSanitizer()) {
    this._sanitizer = sanitizer;
  }

  public supports(target: ExportTargetType): boolean {
    return target === 'ldtk';
  }

  public async export(context: ExportContext): Promise<ExportResult> {
    try {
      const sanitizedDir = this._sanitizer.sanitizePath(context.outputDirectory);
      await fs.mkdir(sanitizedDir, { recursive: true });

      const baseName = context.baseName || 'tileset';
      const tileWidth = typeof context.options?.['tileWidth'] === 'number' ? context.options['tileWidth'] : 128;
      const tileHeight = typeof context.options?.['tileHeight'] === 'number' ? context.options['tileHeight'] : 64;
      const totalTiles = typeof context.options?.['totalTiles'] === 'number' ? context.options['totalTiles'] : 4;
      const columns = typeof context.options?.['columns'] === 'number' ? context.options['columns'] : totalTiles;
      const imageFileName = `${baseName}.png`;
      const imageWidth = tileWidth * columns;
      const imageHeight = tileHeight * Math.ceil(totalTiles / columns);

      const ldtkFileName = `${baseName}.ldtk.json`;
      const ldtkFilePath = path.join(sanitizedDir, ldtkFileName);
      const ldtkContent = this.generateLdtkContent({
        baseName,
        tileWidth,
        tileHeight,
        imageFileName,
        imageWidth,
        imageHeight
      });

      await fs.writeFile(ldtkFilePath, ldtkContent, 'utf-8');

      const artifacts: ExportFileArtifact[] = [
        {
          relativePath: ldtkFileName,
          mimeType: 'application/json',
          sizeBytes: Buffer.byteLength(ldtkContent, 'utf-8')
        }
      ];

      return {
        target: 'ldtk',
        success: true,
        artifacts,
        manifestPath: ldtkFilePath
      };
    } catch (error) {
      return {
        target: 'ldtk',
        success: false,
        artifacts: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private generateLdtkContent(params: {
    baseName: string;
    tileWidth: number;
    tileHeight: number;
    imageFileName: string;
    imageWidth: number;
    imageHeight: number;
  }): string {
    const data = {
      __header__: {
        fileType: 'LDtk tileset definition',
        app: 'blender-iso-mcp',
        doc: 'https://ldtk.io/json'
      },
      identifier: params.baseName,
      uid: 1001,
      relPath: params.imageFileName,
      pxWid: params.imageWidth,
      pxHei: params.imageHeight,
      tileGridSize: params.tileWidth,
      spacing: 0,
      padding: 0,
      tags: ['isometric', 'blender-mcp', 'dimetric-2-1'],
      customData: [
        {
          tileId: 0,
          data: JSON.stringify({
            orientation: 'isometric',
            ratio: '2:1',
            tileWidth: params.tileWidth,
            tileHeight: params.tileHeight
          })
        }
      ]
    };

    return JSON.stringify(data, null, 2);
  }
}
