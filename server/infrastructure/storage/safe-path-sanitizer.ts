import path from 'node:path';

export interface SafePathSanitizerOptions {
  readonly allowedRoots?: readonly string[];
}

export class SafePathSanitizer {
  private readonly _allowedRoots: readonly string[];

  constructor(options?: SafePathSanitizerOptions) {
    const defaultRoots = [path.resolve(process.cwd())];
    const roots = options?.allowedRoots && options.allowedRoots.length > 0
      ? options.allowedRoots.map((r) => path.resolve(r))
      : defaultRoots;

    this._allowedRoots = Object.freeze([...roots]);
    Object.freeze(this);
  }

  public sanitizePath(untrustedPath: string, rootOverride?: string): string {
    if (typeof untrustedPath !== 'string' || untrustedPath.trim().length === 0) {
      throw new Error('Path must be a non-empty string');
    }

    if (untrustedPath.includes('\0')) {
      throw new SecurityError('Path traversal attempt detected: null byte injection');
    }

    const baseRoot = rootOverride ? path.resolve(rootOverride) : this._allowedRoots[0];
    const resolvedPath = path.resolve(baseRoot, untrustedPath);

    const isContained = this.isUnderAllowedRoot(resolvedPath, rootOverride ? baseRoot : undefined);
    if (!isContained) {
      throw new SecurityError(`Access denied: path '${untrustedPath}' resolves outside allowed boundaries`);
    }

    return resolvedPath;
  }

  public isSafe(untrustedPath: string, rootOverride?: string): boolean {
    try {
      this.sanitizePath(untrustedPath, rootOverride);
      return true;
    } catch {
      return false;
    }
  }

  private isUnderAllowedRoot(targetPath: string, specificRoot?: string): boolean {
    const rootsToCheck = specificRoot ? [specificRoot] : this._allowedRoots;

    for (const root of rootsToCheck) {
      const normalizedRoot = path.normalize(root);
      const normalizedTarget = path.normalize(targetPath);

      if (normalizedTarget === normalizedRoot) {
        return true;
      }

      const relative = path.relative(normalizedRoot, normalizedTarget);
      if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
        return true;
      }
    }

    return false;
  }
}

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}
