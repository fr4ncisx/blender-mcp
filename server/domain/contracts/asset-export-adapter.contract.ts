export type ExportTargetType =
  | 'universal'
  | 'godot4'
  | 'ldtk'
  | 'phaser_defold'
  | 'phaser'
  | 'pixi'
  | 'threejs'
  | 'babylon'
  | 'excalibur'
  | 'all';

export interface ExportFileArtifact {
  readonly relativePath: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export interface ExportContext {
  readonly targetType: ExportTargetType;
  readonly outputDirectory: string;
  readonly baseName: string;
  readonly includeMetadata: boolean;
  readonly options?: Readonly<Record<string, unknown>>;
}

export interface ExportResult {
  readonly target: ExportTargetType;
  readonly success: boolean;
  readonly artifacts: readonly ExportFileArtifact[];
  readonly manifestPath?: string;
  readonly error?: string;
}

export interface IAssetExportAdapter {
  readonly targetType: ExportTargetType;
  supports(target: ExportTargetType): boolean;
  export(context: ExportContext): Promise<ExportResult>;
}
