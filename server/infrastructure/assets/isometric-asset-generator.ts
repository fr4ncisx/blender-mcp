import path from 'node:path';
import fs from 'node:fs/promises';
import {
  IsometricAssetDefinition,
  AssetArchetype
} from '../../domain/entities/isometric-asset-definition.entity.js';
import { SafePathSanitizer } from '../storage/safe-path-sanitizer.js';
import { ProjectPathsManager } from '../storage/project-paths-manager.js';

export interface BakeCatalogOptions {
  readonly tileWidth?: number;
  readonly archetypes?: readonly AssetArchetype[];
  readonly targetDir?: string;
  readonly manifestFileName?: string;
  readonly customAssets?: readonly IsometricAssetDefinition[];
}

export interface BakeCatalogResult {
  readonly manifestPath: string;
  readonly collisionFiles: readonly string[];
  readonly totalAssets: number;
  readonly assets: readonly IsometricAssetDefinition[];
}

export class IsometricAssetGenerator {
  private readonly _sanitizer: SafePathSanitizer;
  private readonly _pathsManager: ProjectPathsManager;

  constructor(
    sanitizer: SafePathSanitizer = new SafePathSanitizer(),
    pathsManager: ProjectPathsManager = new ProjectPathsManager(sanitizer)
  ) {
    this._sanitizer = sanitizer;
    this._pathsManager = pathsManager;
    Object.freeze(this);
  }

  public generateStandardCatalog(tileWidth = 64): readonly IsometricAssetDefinition[] {
    const definitions: IsometricAssetDefinition[] = [
      IsometricAssetDefinition.createStandard({
        id: 'floor_stone',
        name: 'Stone Floor',
        archetype: 'floor',
        tileWidth,
        tags: ['floor', 'stone', 'habbo'],
        properties: { material: 'stone', walkable: true }
      }),
      IsometricAssetDefinition.createStandard({
        id: 'floor_wood',
        name: 'Wood Parquet Floor',
        archetype: 'floor',
        tileWidth,
        tags: ['floor', 'wood', 'habbo'],
        properties: { material: 'wood', walkable: true }
      }),
      IsometricAssetDefinition.createStandard({
        id: 'floor_dance',
        name: 'Dance Floor',
        archetype: 'floor',
        tileWidth,
        tags: ['floor', 'dance', 'light'],
        properties: { material: 'dance', emissive: true, walkable: true }
      }),
      IsometricAssetDefinition.createStandard({
        id: 'wall_damask',
        name: 'Damask Wallpaper Wall',
        archetype: 'wall',
        tileWidth,
        unitHeight: 2.0,
        tags: ['wall', 'damask', 'habbo'],
        properties: { material: 'damask', blocksVision: true }
      }),
      IsometricAssetDefinition.createStandard({
        id: 'wall_vault',
        name: 'Vault Seam Wall',
        archetype: 'wall',
        tileWidth,
        unitHeight: 2.0,
        tags: ['wall', 'vault'],
        properties: { material: 'vault', blocksVision: true }
      }),
      IsometricAssetDefinition.createStandard({
        id: 'slope_ramp',
        name: 'Elevation Slope Ramp',
        archetype: 'slope',
        tileWidth,
        unitHeight: 1.5,
        tags: ['slope', 'ramp', 'elevation'],
        properties: { inclination: 0.5, walkable: true }
      }),
      IsometricAssetDefinition.createStandard({
        id: 'bar_counter',
        name: 'Modular Bar Counter',
        archetype: 'furniture',
        tileWidth,
        unitHeight: 2.0,
        tags: ['furniture', 'bar', 'counter'],
        properties: { interactive: true, seating: false }
      }),
      IsometricAssetDefinition.createStandard({
        id: 'sofa_lavender',
        name: 'Lounge Sofa Lavender',
        archetype: 'furniture',
        tileWidth,
        unitHeight: 2.0,
        tags: ['furniture', 'sofa', 'lounge'],
        properties: { interactive: true, seating: true, capacity: 2 }
      }),
      IsometricAssetDefinition.createStandard({
        id: 'grand_stairs',
        name: 'Grand Wooden Stairs',
        archetype: 'stair',
        tileWidth,
        unitHeight: 2.0,
        tags: ['stair', 'elevation', 'wood'],
        properties: { stepCount: 4, elevationGain: 1.0, walkable: true }
      }),
      IsometricAssetDefinition.createStandard({
        id: 'marble_column',
        name: 'Architectural Marble Column',
        archetype: 'column',
        tileWidth,
        unitHeight: 3.0,
        tags: ['column', 'pillar', 'architecture'],
        properties: { loadBearing: true, collidable: true }
      }),
      IsometricAssetDefinition.createStandard({
        id: 'doorway_transition',
        name: 'Threshold Transition Pad',
        archetype: 'transition',
        tileWidth,
        unitHeight: 1.0,
        tags: ['transition', 'doorway', 'portal'],
        properties: { triggerZone: true, walkable: true }
      })
    ];

    return Object.freeze(definitions);
  }

  public async saveCollisionDefinitions(
    assets: readonly IsometricAssetDefinition[],
    targetDir?: string
  ): Promise<readonly string[]> {
    const collisionsDir = targetDir
      ? this._sanitizer.sanitizePath(targetDir)
      : this._pathsManager.resolveAssetPath('collisions');

    await fs.mkdir(collisionsDir, { recursive: true });

    const savedFiles: string[] = [];

    for (const asset of assets) {
      const fileName = `${asset.id}.collision.json`;
      const filePath = path.join(collisionsDir, fileName);
      const sanitizedFilePath = this._sanitizer.sanitizePath(filePath);

      const collisionDocument = {
        assetId: asset.id,
        name: asset.name,
        archetype: asset.archetype,
        tileWidth: asset.tileWidth,
        tileHeight: asset.tileHeight,
        spriteWidth: asset.spriteWidth,
        spriteHeight: asset.spriteHeight,
        unitHeight: asset.unitHeight,
        anchorPivot: asset.anchorPivot,
        collisionDiamond: asset.collisionDiamond
      };

      await fs.writeFile(sanitizedFilePath, JSON.stringify(collisionDocument, null, 2), 'utf-8');
      savedFiles.push(sanitizedFilePath);
    }

    return Object.freeze(savedFiles);
  }

  public async exportManifest(
    assets: readonly IsometricAssetDefinition[],
    targetDir?: string,
    manifestFileName = 'isometric_assets_manifest.json'
  ): Promise<string> {
    const manifestsDir = targetDir
      ? this._sanitizer.sanitizePath(targetDir)
      : this._pathsManager.resolveAssetPath('manifests');

    await fs.mkdir(manifestsDir, { recursive: true });

    const manifestPath = this._sanitizer.sanitizePath(path.join(manifestsDir, manifestFileName));

    const manifestDocument = {
      version: '0.7.0',
      projection: 'dimetric_2_1',
      ratio: '2:1',
      totalAssets: assets.length,
      assets: assets.map((asset) => asset.toJSON())
    };

    await fs.writeFile(manifestPath, JSON.stringify(manifestDocument, null, 2), 'utf-8');
    return manifestPath;
  }

  public async bakeCatalog(options?: BakeCatalogOptions): Promise<BakeCatalogResult> {
    const tileWidth = options?.tileWidth ?? 64;
    let assets = options?.customAssets && options.customAssets.length > 0
      ? options.customAssets
      : this.generateStandardCatalog(tileWidth);

    if (options?.archetypes && options.archetypes.length > 0) {
      const allowedArchetypes = new Set(options.archetypes);
      assets = assets.filter((a) => allowedArchetypes.has(a.archetype));
    }

    await this._pathsManager.ensureDirectoryStructure();

    const collisionsDir = options?.targetDir ? path.join(options.targetDir, 'collisions') : undefined;
    const manifestsDir = options?.targetDir ? path.join(options.targetDir, 'manifests') : undefined;

    const collisionFiles = await this.saveCollisionDefinitions(assets, collisionsDir);
    const manifestPath = await this.exportManifest(
      assets,
      manifestsDir,
      options?.manifestFileName ?? 'isometric_assets_manifest.json'
    );

    return Object.freeze({
      manifestPath,
      collisionFiles,
      totalAssets: assets.length,
      assets
    });
  }
}
