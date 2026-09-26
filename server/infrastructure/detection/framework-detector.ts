import fs from 'node:fs';
import path from 'node:path';
import { ExportTargetType } from '../../domain/contracts/asset-export-adapter.contract.js';

export class FrameworkDetector {
  public resolveTarget(target?: string, cwd?: string): ExportTargetType {
    if (target && target !== 'auto') {
      const normalized = target.toLowerCase().trim();
      if (this.isValidTarget(normalized)) {
        return normalized;
      }
    }

    return this.detectFromWorkspace(cwd ?? process.cwd());
  }

  public detectFromWorkspace(cwd: string): ExportTargetType {
    const pkgPath = path.resolve(cwd, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      return 'all';
    }

    try {
      const raw = fs.readFileSync(pkgPath, 'utf-8');
      const data = JSON.parse(raw);
      const deps = { ...data.dependencies, ...data.devDependencies };

      if ('phaser' in deps) {
        return 'phaser';
      }
      if ('pixi.js' in deps) {
        return 'pixi';
      }
      if ('three' in deps || '@types/three' in deps) {
        return 'threejs';
      }
      if ('@babylonjs/core' in deps || 'babylonjs' in deps) {
        return 'babylon';
      }
      if ('excalibur' in deps) {
        return 'excalibur';
      }

      return 'all';
    } catch {
      return 'all';
    }
  }

  private isValidTarget(target: string): target is ExportTargetType {
    const valid: ReadonlyArray<string> = [
      'universal',
      'godot4',
      'ldtk',
      'phaser_defold',
      'phaser',
      'pixi',
      'threejs',
      'babylon',
      'excalibur',
      'all'
    ];
    return valid.includes(target);
  }
}
