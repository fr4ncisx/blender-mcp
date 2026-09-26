import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { IBlenderBridge } from '../../../domain/contracts/blender-bridge.contract.js';
import { SafePathSanitizer } from '../../../infrastructure/storage/safe-path-sanitizer.js';
import { AssetCacheManager } from '../../../infrastructure/cache/asset-cache-manager.js';
import { WorldBlueprintEntity } from '../../../domain/entities/world-blueprint.entity.js';

export const SYNTHESIZE_WORLD_TOOL_NAME = 'blender_iso_synthesize_world';
export const SYNTHESIZE_WORLD_TOOL_DESCRIPTION =
  'Synthesizes a full-scale 2:1 dimetric isometric world from a semantic ASCII or JSON blueprint grid with procedural geometry, stairs, furniture, collisions, and web manifests';

export const SynthesizeWorldInputSchema = z.object({
  blueprint: z.string().min(1),
  name: z.string().default('synthesized_world'),
  theme: z
    .enum([
      'art_deco_cyberpunk',
      'retro_social_lounge',
      'neo_tokyo_diner',
      'medieval_tavern',
      'minimalist_gallery'
    ])
    .default('art_deco_cyberpunk'),
  palette: z.array(z.string()).optional(),
  tileWidth: z.number().int().positive().default(128),
  seed: z.number().int().optional(),
  includePreview: z.boolean().default(true)
});

export type SynthesizeWorldInput = z.infer<typeof SynthesizeWorldInputSchema>;

export interface McpContentText {
  readonly type: 'text';
  readonly text: string;
}

export interface McpContentImage {
  readonly type: 'image';
  readonly data: string;
  readonly mimeType: string;
}

export type McpToolContent = McpContentText | McpContentImage;

export interface McpToolResponse {
  readonly content: ReadonlyArray<McpToolContent>;
  readonly isError?: boolean;
}

export async function handleSynthesizeWorld(
  bridge: IBlenderBridge,
  sanitizer: SafePathSanitizer,
  cacheManager: AssetCacheManager,
  input: SynthesizeWorldInput
): Promise<McpToolResponse> {
  const validated = SynthesizeWorldInputSchema.parse(input);
  const blueprintEntity = WorldBlueprintEntity.parse(validated.blueprint);

  const hash = cacheManager.computeHash(SYNTHESIZE_WORLD_TOOL_NAME, validated as unknown as Record<string, unknown>);
  const tileHeight = Math.floor(validated.tileWidth / 2);

  const relativeImagePath = path.join('output', 'blender', 'rooms', `${validated.name}.png`);
  const safeImagePath = sanitizer.sanitizePath(relativeImagePath);
  const relativeManifestPath = path.join('output', 'blender', 'rooms', `${validated.name}_manifest.json`);
  const safeManifestPath = sanitizer.sanitizePath(relativeManifestPath);

  const cached = await cacheManager.get(hash);
  if (cached && typeof cached === 'object') {
    let imageExists = false;
    try {
      await fs.access(safeImagePath);
      imageExists = true;
    } catch {}

    if (imageExists) {
      const contentList: McpToolContent[] = [];
      if (validated.includePreview) {
        try {
          const imgBuffer = await fs.readFile(safeImagePath);
          contentList.push({
            type: 'image',
            data: imgBuffer.toString('base64'),
            mimeType: 'image/png'
          });
        } catch {}
      }
      contentList.push({
        type: 'text',
        text: JSON.stringify({ ...cached, cached: true }, null, 2)
      });
      return {
        content: Object.freeze(contentList),
        isError: false
      };
    }
  }

  const commandParams = {
    name: validated.name,
    theme: validated.theme,
    palette: validated.palette,
    tileWidth: validated.tileWidth,
    seed: validated.seed,
    clearScene: true,
    renderOutput: safeImagePath,
    blueprint: blueprintEntity.toCompilerPayload()
  };

  const result = await bridge.sendCommand<Record<string, unknown>>('synthesize_world', commandParams);

  const collisions = blueprintEntity.calculateCollisionDiamonds(validated.tileWidth, tileHeight);

  const manifest = {
    name: validated.name,
    theme: validated.theme,
    dimensions: {
      width: blueprintEntity.width,
      depth: blueprintEntity.depth
    },
    tileDimensions: {
      tileWidth: validated.tileWidth,
      tileHeight
    },
    imagePath: safeImagePath,
    manifestPath: safeManifestPath,
    collisions,
    waypoints: blueprintEntity.walkableFloor.map((c) => ({
      gridX: c.gridX,
      gridY: c.gridY,
      elevation: c.elevation,
      token: c.token
    })),
    seats: blueprintEntity.seats.map((c) => ({
      gridX: c.gridX,
      gridY: c.gridY,
      elevation: c.elevation
    })),
    lights: blueprintEntity.lights.map((c) => ({
      gridX: c.gridX,
      gridY: c.gridY,
      elevation: c.elevation
    })),
    stairs: blueprintEntity.stairs.map((c) => ({
      gridX: c.gridX,
      gridY: c.gridY,
      elevation: c.elevation,
      token: c.token
    }))
  };

  await fs.mkdir(path.dirname(safeManifestPath), { recursive: true });
  await fs.writeFile(safeManifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  const cacheEntry: Record<string, unknown> = {
    ...result,
    imagePath: safeImagePath,
    manifestPath: safeManifestPath,
    manifest
  };

  await cacheManager.set(hash, cacheEntry);
  await cacheManager.saveCache();

  const contentList: McpToolContent[] = [];
  if (validated.includePreview) {
    try {
      const imgBuffer = await fs.readFile(safeImagePath);
      contentList.push({
        type: 'image',
        data: imgBuffer.toString('base64'),
        mimeType: 'image/png'
      });
    } catch {}
  }

  contentList.push({
    type: 'text',
    text: JSON.stringify(cacheEntry, null, 2)
  });

  return {
    content: Object.freeze(contentList),
    isError: !result.success
  };
}
