import fs from 'node:fs/promises';
import path from 'node:path';
import { ExportTargetType } from '../../domain/contracts/asset-export-adapter.contract.js';
import { SafePathSanitizer } from '../storage/safe-path-sanitizer.js';

export interface RoomExportPayload {
  readonly roomDimensions: { width: number; depth: number };
  readonly totalObjects: number;
  readonly furnitureCount: number;
  readonly renderPath?: string;
  readonly capacityMetrics: {
    minimumCapacity: number;
    calculatedMaxCapacity: number;
    seatingCapacity: number;
    standingWalkableCapacity: number;
    totalFloorTiles: number;
  };
  readonly navigationGrid: ReadonlyArray<{
    gridX: number;
    gridY: number;
    elevation: number;
    walkable: boolean;
    tileType: string;
  }>;
  readonly seatingRegistry: ReadonlyArray<{
    id: string;
    gridX: number;
    gridY: number;
    elevation: number;
    sitDirection: number;
  }>;
  readonly cameraData?: {
    orthoScale: number;
    rotationEuler: [number, number, number];
    location: [number, number, number];
  };
  readonly lightsData?: ReadonlyArray<{
    name: string;
    type: string;
    energy: number;
    rotationEuler: [number, number, number];
  }>;
  readonly objectsData?: ReadonlyArray<{
    name: string;
    type: string;
    location: [number, number, number];
  }>;
  readonly entryTile?: {
    gridX: number;
    gridY: number;
    elevation?: number;
    direction?: string;
  };
  readonly transitionTiles?: ReadonlyArray<{
    gridX: number;
    gridY: number;
    elevation?: number;
    targetRoom?: string;
    label?: string;
  }>;
}

export interface GeneratedFrameworkArtifacts {
  readonly target: ExportTargetType;
  readonly files: ReadonlyArray<{
    readonly fileName: string;
    readonly relativePath: string;
    readonly sizeBytes: number;
  }>;
}

export class WebGameFrameworkExporter {
  private readonly _sanitizer: SafePathSanitizer;

  constructor(sanitizer: SafePathSanitizer = new SafePathSanitizer()) {
    this._sanitizer = sanitizer;
  }

  public async exportFrameworks(
    target: ExportTargetType,
    outputDirectory: string,
    baseName: string,
    payload: RoomExportPayload
  ): Promise<GeneratedFrameworkArtifacts> {
    const sanitizedDir = this._sanitizer.sanitizePath(outputDirectory);
    await fs.mkdir(sanitizedDir, { recursive: true });

    const files: Array<{ fileName: string; relativePath: string; sizeBytes: number }> = [];

    const shouldExport = (t: ExportTargetType): boolean => target === 'all' || target === t;

    if (shouldExport('phaser') || target === 'phaser_defold') {
      const phaserPath = path.join(sanitizedDir, `${baseName}_phaser.json`);
      const phaserContent = JSON.stringify(this.buildPhaserManifest(payload, baseName), null, 2);
      await fs.writeFile(phaserPath, phaserContent, 'utf-8');
      files.push({
        fileName: `${baseName}_phaser.json`,
        relativePath: path.relative(sanitizedDir, phaserPath),
        sizeBytes: Buffer.byteLength(phaserContent, 'utf-8')
      });
    }

    if (shouldExport('pixi')) {
      const pixiPath = path.join(sanitizedDir, `${baseName}_pixi.json`);
      const pixiContent = JSON.stringify(this.buildPixiManifest(payload, baseName), null, 2);
      await fs.writeFile(pixiPath, pixiContent, 'utf-8');
      files.push({
        fileName: `${baseName}_pixi.json`,
        relativePath: path.relative(sanitizedDir, pixiPath),
        sizeBytes: Buffer.byteLength(pixiContent, 'utf-8')
      });
    }

    if (shouldExport('threejs')) {
      const threePath = path.join(sanitizedDir, `${baseName}_threejs.json`);
      const threeContent = JSON.stringify(this.buildThreeJsManifest(payload, baseName), null, 2);
      await fs.writeFile(threePath, threeContent, 'utf-8');
      files.push({
        fileName: `${baseName}_threejs.json`,
        relativePath: path.relative(sanitizedDir, threePath),
        sizeBytes: Buffer.byteLength(threeContent, 'utf-8')
      });
    }

    if (shouldExport('babylon')) {
      const babylonPath = path.join(sanitizedDir, `${baseName}_babylon.json`);
      const babylonContent = JSON.stringify(this.buildBabylonManifest(payload, baseName), null, 2);
      await fs.writeFile(babylonPath, babylonContent, 'utf-8');
      files.push({
        fileName: `${baseName}_babylon.json`,
        relativePath: path.relative(sanitizedDir, babylonPath),
        sizeBytes: Buffer.byteLength(babylonContent, 'utf-8')
      });
    }

    if (shouldExport('excalibur')) {
      const excaliburPath = path.join(sanitizedDir, `${baseName}_excalibur.json`);
      const excaliburContent = JSON.stringify(this.buildExcaliburManifest(payload, baseName), null, 2);
      await fs.writeFile(excaliburPath, excaliburContent, 'utf-8');
      files.push({
        fileName: `${baseName}_excalibur.json`,
        relativePath: path.relative(sanitizedDir, excaliburPath),
        sizeBytes: Buffer.byteLength(excaliburContent, 'utf-8')
      });
    }

    if (shouldExport('universal') || target === 'all') {
      const universalPath = path.join(sanitizedDir, `${baseName}_universal.json`);
      const universalContent = JSON.stringify(this.buildUniversalManifest(payload, baseName), null, 2);
      await fs.writeFile(universalPath, universalContent, 'utf-8');
      files.push({
        fileName: `${baseName}_universal.json`,
        relativePath: path.relative(sanitizedDir, universalPath),
        sizeBytes: Buffer.byteLength(universalContent, 'utf-8')
      });

      const snippetPath = path.join(sanitizedDir, `${baseName}_integration.ts`);
      const snippetContent = this.buildIntegrationSnippet(baseName);
      await fs.writeFile(snippetPath, snippetContent, 'utf-8');
      files.push({
        fileName: `${baseName}_integration.ts`,
        relativePath: path.relative(sanitizedDir, snippetPath),
        sizeBytes: Buffer.byteLength(snippetContent, 'utf-8')
      });
    }

    return {
      target,
      files: Object.freeze(files)
    };
  }

  private buildPhaserManifest(payload: RoomExportPayload, baseName: string): Record<string, unknown> {
    const collisionGrid: number[][] = [];
    for (let y = 0; y < payload.roomDimensions.depth; y++) {
      const row: number[] = [];
      for (let x = 0; x < payload.roomDimensions.width; x++) {
        const cell = payload.navigationGrid.find((c) => c.gridX === x && c.gridY === y);
        if (!cell) {
          row.push(1);
        } else if (!cell.walkable) {
          row.push(1);
        } else if (cell.tileType.includes('stair')) {
          row.push(2);
        } else {
          row.push(0);
        }
      }
      collisionGrid.push(row);
    }

    return {
      name: baseName,
      type: 'isometric',
      projection: 'dimetric_2_1',
      tileDimensions: { width: 64, height: 32 },
      roomDimensions: payload.roomDimensions,
      capacity: payload.capacityMetrics,
      collisionGrid,
      seatingSpots: payload.seatingRegistry,
      spawnPoint: payload.entryTile ?? null,
      transitionTriggers: payload.transitionTiles ?? [],
      imageFile: `${baseName}.png`
    };
  }

  private buildPixiManifest(payload: RoomExportPayload, baseName: string): Record<string, unknown> {
    return {
      name: baseName,
      renderType: 'pixi_v8_isometric',
      projection: { ratio: 2.0, tileWidth: 64, tileHeight: 32 },
      depthSorting: {
        formula: 'zIndex = (y * 32) + (x * 16) + (elevation * 64)',
        anchor: { x: 0.5, y: 1.0 }
      },
      capacity: payload.capacityMetrics,
      spawnPoint: payload.entryTile ?? null,
      transitionTriggers: payload.transitionTiles ?? [],
      containers: [
        { id: 'background', sortable: false },
        { id: 'ysorted_entities', sortable: true },
        { id: 'foreground_occlusion', sortable: false }
      ],
      interactiveSeats: payload.seatingRegistry,
      imageFile: `${baseName}.png`
    };
  }

  private buildThreeJsManifest(payload: RoomExportPayload, baseName: string): Record<string, unknown> {
    return {
      name: baseName,
      engine: 'threejs',
      camera: {
        type: 'OrthographicCamera',
        orthoScale: payload.cameraData?.orthoScale ?? 22.0,
        rotationEulerDeg: [60.0, 0.0, 45.0],
        location: payload.cameraData?.location ?? [0, 0, 0],
        near: 0.1,
        far: 500.0
      },
      lights: payload.lightsData ?? [],
      sceneNodes: payload.objectsData ?? [],
      capacity: payload.capacityMetrics,
      spawnPoint: payload.entryTile ?? null,
      transitionTriggers: payload.transitionTiles ?? [],
      textureFile: `${baseName}.png`
    };
  }

  private buildBabylonManifest(payload: RoomExportPayload, baseName: string): Record<string, unknown> {
    return {
      name: baseName,
      engine: 'babylonjs',
      camera: {
        type: 'TargetCamera',
        mode: 'ORTHOGRAPHIC_CAMERA',
        orthoScale: payload.cameraData?.orthoScale ?? 22.0,
        rotationDeg: [60.0, 0.0, 45.0],
        position: payload.cameraData?.location ?? [0, 0, 0]
      },
      capacity: payload.capacityMetrics,
      spawnPoint: payload.entryTile ?? null,
      transitionTriggers: payload.transitionTiles ?? [],
      instances: payload.objectsData ?? []
    };
  }

  private buildExcaliburManifest(payload: RoomExportPayload, baseName: string): Record<string, unknown> {
    return {
      name: baseName,
      engine: 'excaliburjs',
      isometricMap: {
        rows: payload.roomDimensions.depth,
        columns: payload.roomDimensions.width,
        tileWidth: 64,
        tileHeight: 32,
        elevationLayers: 3
      },
      capacity: payload.capacityMetrics,
      spawnPoint: payload.entryTile ?? null,
      transitionTriggers: payload.transitionTiles ?? [],
      grid: payload.navigationGrid
    };
  }

  private buildUniversalManifest(payload: RoomExportPayload, baseName: string): Record<string, unknown> {
    return {
      schemaVersion: '1.0.0',
      roomName: baseName,
      dimensions: payload.roomDimensions,
      capacityMetrics: payload.capacityMetrics,
      entryTile: payload.entryTile ?? null,
      transitionTiles: payload.transitionTiles ?? [],
      navigationGrid: payload.navigationGrid,
      seatingRegistry: payload.seatingRegistry,
      camera: payload.cameraData,
      lights: payload.lightsData,
      objects: payload.objectsData,
      renderImage: `${baseName}.png`
    };
  }

  private buildIntegrationSnippet(baseName: string): string {
    return `export const loadPhaserIsoRoom = (scene: { load: { image: (key: string, path: string) => void; json: (key: string, path: string) => void } }) => {
  scene.load.image('${baseName}_bg', '${baseName}.png');
  scene.load.json('${baseName}_meta', '${baseName}_phaser.json');
};

export const createPixiIsoRoom = async () => {
  const response = await fetch('${baseName}_pixi.json');
  const meta = await response.json();
  return meta;
};

export const setupThreeJsIsoCamera = (THREE: { OrthographicCamera: new (left: number, right: number, top: number, bottom: number, near: number, far: number) => { rotation: { set: (x: number, y: number, z: number) => void } } }, meta: { camera: { orthoScale: number; rotationEulerDeg: [number, number, number] } }) => {
  const aspect = window.innerWidth / window.innerHeight;
  const frustum = meta.camera.orthoScale;
  const camera = new THREE.OrthographicCamera(
    -frustum * aspect,
    frustum * aspect,
    frustum,
    -frustum,
    0.1,
    500
  );
  camera.rotation.set(
    (meta.camera.rotationEulerDeg[0] * Math.PI) / 180,
    (meta.camera.rotationEulerDeg[1] * Math.PI) / 180,
    (meta.camera.rotationEulerDeg[2] * Math.PI) / 180
  );
  return camera;
};
`;
  }
}
