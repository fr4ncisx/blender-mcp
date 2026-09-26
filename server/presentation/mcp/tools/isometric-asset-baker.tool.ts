import { z } from 'zod';
import { SafePathSanitizer } from '../../../infrastructure/storage/safe-path-sanitizer.js';
import { ProjectPathsManager } from '../../../infrastructure/storage/project-paths-manager.js';
import { IsometricAssetGenerator } from '../../../infrastructure/assets/isometric-asset-generator.js';
import { ProjectPaths } from '../../../domain/value-objects/project-paths.vo.js';
import { AssetArchetype } from '../../../domain/entities/isometric-asset-definition.entity.js';

export const ISOMETRIC_ASSET_BAKER_TOOL_NAME = 'blender_iso_bake_assets';
export const ISOMETRIC_ASSET_BAKER_TOOL_DESCRIPTION =
  'Bakes 2:1 dimetric isometric asset definitions, mathematical collision diamonds, and engine manifests';

export const IsometricAssetBakerInputSchema = z.object({
  tileWidth: z.number().int().positive().default(64),
  archetypes: z
    .array(z.enum(['floor', 'wall', 'slope', 'furniture', 'stair', 'column', 'transition']))
    .optional(),
  outputDirectory: z.string().default(ProjectPaths.ISOMETRIC_ASSETS_ROOT),
  manifestFileName: z.string().default('isometric_assets_manifest.json')
});

export type IsometricAssetBakerInput = z.infer<typeof IsometricAssetBakerInputSchema>;

export interface McpToolResponse {
  readonly content: ReadonlyArray<{ readonly type: 'text'; readonly text: string }>;
  readonly isError?: boolean;
}

export async function handleIsometricAssetBaker(
  sanitizer: SafePathSanitizer,
  input: IsometricAssetBakerInput
): Promise<McpToolResponse> {
  try {
    const validated = IsometricAssetBakerInputSchema.parse(input);
    const pathsManager = new ProjectPathsManager(sanitizer);
    await pathsManager.ensureDirectoryStructure();

    const generator = new IsometricAssetGenerator(sanitizer, pathsManager);
    const result = await generator.bakeCatalog({
      tileWidth: validated.tileWidth,
      archetypes: validated.archetypes as readonly AssetArchetype[] | undefined,
      targetDir: validated.outputDirectory,
      manifestFileName: validated.manifestFileName
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              totalAssets: result.totalAssets,
              manifestPath: result.manifestPath,
              collisionFiles: result.collisionFiles,
              tileWidth: validated.tileWidth,
              tileHeight: Math.floor(validated.tileWidth / 2),
              projection: 'dimetric_2_1'
            },
            null,
            2
          )
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error instanceof Error ? error.message : String(error)
            },
            null,
            2
          )
        }
      ],
      isError: true
    };
  }
}
