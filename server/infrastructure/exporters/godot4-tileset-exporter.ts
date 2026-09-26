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

export class Godot4TilesetExporter implements IAssetExportAdapter {
  public readonly targetType: ExportTargetType = 'godot4';
  private readonly _sanitizer: SafePathSanitizer;

  constructor(sanitizer: SafePathSanitizer = new SafePathSanitizer()) {
    this._sanitizer = sanitizer;
  }

  public supports(target: ExportTargetType): boolean {
    return target === 'godot4';
  }

  public async export(context: ExportContext): Promise<ExportResult> {
    try {
      const sanitizedDir = this._sanitizer.sanitizePath(context.outputDirectory);
      await fs.mkdir(sanitizedDir, { recursive: true });

      const baseName = context.baseName || 'tileset';
      const tresFileName = `${baseName}.tres`;
      const tresFilePath = path.join(sanitizedDir, tresFileName);

      const tileWidth = typeof context.options?.['tileWidth'] === 'number' ? context.options['tileWidth'] : 128;
      const tileHeight = typeof context.options?.['tileHeight'] === 'number' ? context.options['tileHeight'] : 64;
      const hasNormalMap = Boolean(context.options?.['hasNormalMap']);
      const diffuseTexturePath = typeof context.options?.['diffuseTexture'] === 'string'
        ? context.options['diffuseTexture']
        : `res://${baseName}_albedo.png`;
      const normalTexturePath = typeof context.options?.['normalTexture'] === 'string'
        ? context.options['normalTexture']
        : `res://${baseName}_normal.png`;

      const tresContent = this.generateTresContent({
        tileWidth,
        tileHeight,
        hasNormalMap,
        diffuseTexturePath,
        normalTexturePath
      });

      await fs.writeFile(tresFilePath, tresContent, 'utf-8');

      const artifacts: ExportFileArtifact[] = [
        {
          relativePath: tresFileName,
          mimeType: 'text/plain',
          sizeBytes: Buffer.byteLength(tresContent, 'utf-8')
        }
      ];

      return {
        target: 'godot4',
        success: true,
        artifacts,
        manifestPath: tresFilePath
      };
    } catch (error) {
      return {
        target: 'godot4',
        success: false,
        artifacts: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private generateTresContent(params: {
    tileWidth: number;
    tileHeight: number;
    hasNormalMap: boolean;
    diffuseTexturePath: string;
    normalTexturePath: string;
  }): string {
    const { tileWidth, tileHeight, hasNormalMap, diffuseTexturePath, normalTexturePath } = params;

    if (hasNormalMap) {
      return [
        '[gd_resource type="TileSet" load_steps=5 format=3 uid="uid://blender_iso_tileset"]',
        '',
        `[ext_resource type="Texture2D" path="${diffuseTexturePath}" id="1_albedo"]`,
        `[ext_resource type="Texture2D" path="${normalTexturePath}" id="2_normal"]`,
        '',
        '[sub_resource type="CanvasTexture" id="CanvasTexture_iso_1"]',
        'diffuse_texture = ExtResource("1_albedo")',
        'normal_texture = ExtResource("2_normal")',
        '',
        '[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_iso_1"]',
        'texture = SubResource("CanvasTexture_iso_1")',
        `texture_region_size = Vector2i(${tileWidth}, ${tileHeight})`,
        '0:0/0 = 0',
        '',
        '[resource]',
        'tile_shape = 1',
        'tile_layout = 0',
        'tile_offset_axis = 0',
        `tile_size = Vector2i(${tileWidth}, ${tileHeight})`,
        'sources/0 = SubResource("TileSetAtlasSource_iso_1")',
        ''
      ].join('\n');
    }

    return [
      '[gd_resource type="TileSet" load_steps=3 format=3 uid="uid://blender_iso_tileset"]',
      '',
      `[ext_resource type="Texture2D" path="${diffuseTexturePath}" id="1_albedo"]`,
      '',
      '[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_iso_1"]',
      'texture = ExtResource("1_albedo")',
      `texture_region_size = Vector2i(${tileWidth}, ${tileHeight})`,
      '0:0/0 = 0',
      '',
      '[resource]',
      'tile_shape = 1',
      'tile_layout = 0',
      'tile_offset_axis = 0',
      `tile_size = Vector2i(${tileWidth}, ${tileHeight})`,
      'sources/0 = SubResource("TileSetAtlasSource_iso_1")',
      ''
    ].join('\n');
  }
}
