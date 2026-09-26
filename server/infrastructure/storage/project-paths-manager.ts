import path from 'node:path';
import fs from 'node:fs/promises';
import { ProjectPaths } from '../../domain/value-objects/project-paths.vo.js';
import { SafePathSanitizer } from './safe-path-sanitizer.js';

export type BlenderSubCategory = 'rooms' | 'turnarounds' | 'passes' | 'root' | string;
export type AssetSubCategory = 'tiles' | 'atlases' | 'collisions' | 'manifests' | 'root' | string;

export class ProjectPathsManager {
  private readonly _sanitizer: SafePathSanitizer;
  private readonly _baseDir: string;

  constructor(sanitizer: SafePathSanitizer = new SafePathSanitizer(), baseDir: string = process.cwd()) {
    this._sanitizer = sanitizer;
    this._baseDir = path.resolve(baseDir);
    Object.freeze(this);
  }

  public get baseDir(): string {
    return this._baseDir;
  }

  public async ensureDirectoryStructure(baseDir?: string): Promise<readonly string[]> {
    const root = baseDir ? path.resolve(baseDir) : this._baseDir;
    const created: string[] = [];

    for (const relativeDir of ProjectPaths.ALL_DIRECTORIES) {
      const targetPath = path.resolve(root, relativeDir);
      const sanitized = this._sanitizer.sanitizePath(targetPath);
      await fs.mkdir(sanitized, { recursive: true });
      created.push(sanitized);
    }

    return Object.freeze(created);
  }

  public resolveBlenderPath(subCategory: BlenderSubCategory, fileName?: string): string {
    let relDir: string;
    switch (subCategory) {
      case 'rooms':
        relDir = ProjectPaths.BLENDER_ROOMS;
        break;
      case 'turnarounds':
        relDir = ProjectPaths.BLENDER_TURNAROUNDS;
        break;
      case 'passes':
        relDir = ProjectPaths.BLENDER_PASSES;
        break;
      case 'root':
        relDir = ProjectPaths.BLENDER_ROOT;
        break;
      default:
        relDir = path.join(ProjectPaths.BLENDER_ROOT, subCategory);
        break;
    }

    const categoryRoot = this._sanitizer.sanitizePath(relDir, this._baseDir);
    if (!fileName) {
      return categoryRoot;
    }

    return this._sanitizer.sanitizePath(fileName, categoryRoot);
  }

  public resolveAssetPath(subCategory: AssetSubCategory, fileName?: string): string {
    let relDir: string;
    switch (subCategory) {
      case 'tiles':
        relDir = ProjectPaths.ASSETS_TILES;
        break;
      case 'atlases':
        relDir = ProjectPaths.ASSETS_ATLASES;
        break;
      case 'collisions':
        relDir = ProjectPaths.ASSETS_COLLISIONS;
        break;
      case 'manifests':
        relDir = ProjectPaths.ASSETS_MANIFESTS;
        break;
      case 'root':
        relDir = ProjectPaths.ISOMETRIC_ASSETS_ROOT;
        break;
      default:
        relDir = path.join(ProjectPaths.ISOMETRIC_ASSETS_ROOT, subCategory);
        break;
    }

    const categoryRoot = this._sanitizer.sanitizePath(relDir, this._baseDir);
    if (!fileName) {
      return categoryRoot;
    }

    return this._sanitizer.sanitizePath(fileName, categoryRoot);
  }
}
