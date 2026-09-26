import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SafePathSanitizer } from '../storage/safe-path-sanitizer.js';

export interface AssetCacheManagerOptions {
  readonly cacheDir?: string;
  readonly manifestName?: string;
}

export class AssetCacheManager {
  private readonly _sanitizer: SafePathSanitizer;
  private readonly _cacheDir: string;
  private readonly _manifestPath: string;
  private readonly _memoryCache: Map<string, Record<string, unknown>>;
  private _isLoaded: boolean;

  constructor(sanitizer?: SafePathSanitizer, options?: AssetCacheManagerOptions) {
    this._sanitizer = sanitizer ?? new SafePathSanitizer();
    const rawCacheDir = options?.cacheDir ?? path.join('output', '.cache');
    const rawManifestName = options?.manifestName ?? 'asset-manifest.json';
    this._cacheDir = this._sanitizer.sanitizePath(rawCacheDir);
    this._manifestPath = this._sanitizer.sanitizePath(path.join(rawCacheDir, rawManifestName));
    this._memoryCache = new Map();
    this._isLoaded = false;
  }

  public get manifestPath(): string {
    return this._manifestPath;
  }

  public get cacheDir(): string {
    return this._cacheDir;
  }

  public computeHash(
    toolName: string,
    inputParams: Record<string, unknown>,
    version: string = '0.9.0'
  ): string {
    const normalizedParams = this.canonicalizeObject(inputParams);
    const payload = JSON.stringify({
      tool: toolName,
      version,
      params: normalizedParams
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  public async get(hash: string): Promise<Record<string, unknown> | null> {
    await this.ensureLoaded();
    const entry = this._memoryCache.get(hash);
    if (!entry) {
      return null;
    }
    return entry;
  }

  public async set(hash: string, entry: Record<string, unknown>): Promise<void> {
    await this.ensureLoaded();
    this._memoryCache.set(hash, entry);
  }

  public async saveCache(): Promise<void> {
    await this.ensureLoaded();
    await fs.mkdir(this._cacheDir, { recursive: true });
    const serialized: Record<string, Record<string, unknown>> = {};
    for (const [key, value] of this._memoryCache.entries()) {
      serialized[key] = value;
    }
    const tempPath = `${this._manifestPath}.tmp`;
    const content = JSON.stringify(serialized, null, 2);
    try {
      await fs.writeFile(tempPath, content, 'utf-8');
      await fs.rename(tempPath, this._manifestPath);
    } catch {
      await fs.writeFile(this._manifestPath, content, 'utf-8');
      try {
        await fs.unlink(tempPath);
      } catch {}
    }
  }

  private async ensureLoaded(): Promise<void> {
    if (this._isLoaded) {
      return;
    }
    try {
      const data = await fs.readFile(this._manifestPath, 'utf-8');
      const parsed = JSON.parse(data) as Record<string, Record<string, unknown>>;
      if (parsed && typeof parsed === 'object') {
        for (const [key, value] of Object.entries(parsed)) {
          this._memoryCache.set(key, value);
        }
      }
    } catch {}
    this._isLoaded = true;
  }

  private canonicalizeObject(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.canonicalizeObject(item));
    }
    const record = obj as Record<string, unknown>;
    const sortedKeys = Object.keys(record).sort();
    const canonical: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      canonical[key] = this.canonicalizeObject(record[key]);
    }
    return canonical;
  }
}
