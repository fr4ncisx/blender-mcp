import { z } from 'zod';
import { IBlenderBridge } from '../../../domain/contracts/blender-bridge.contract.js';
import {
  RenderPassBundle,
  RenderPassType,
  VALID_RENDER_PASS_TYPES
} from '../../../domain/entities/render-pass-bundle.entity.js';
import { Resolution } from '../../../domain/value-objects/resolution.vo.js';
import { ProjectPaths } from '../../../domain/value-objects/project-paths.vo.js';

export const PASS_BAKER_TOOL_NAME = 'blender_iso_bake_2d_passes';
export const PASS_BAKER_TOOL_DESCRIPTION = 'Bakes secondary 2D render passes (albedo, normal_2d, depth, shadow_mask) for isometric sprites';

export const PassBakerInputSchema = z.object({
  objectName: z.string().min(1),
  passes: z.array(z.enum(VALID_RENDER_PASS_TYPES as [RenderPassType, ...RenderPassType[]])).min(1),
  outputDirectory: z.string().default(ProjectPaths.BLENDER_PASSES),
  baseName: z.string().default('baked_passes'),
  tileWidth: z.number().int().positive().default(128)
});

export type PassBakerInput = z.infer<typeof PassBakerInputSchema>;

export interface McpToolResponse {
  readonly content: ReadonlyArray<{ readonly type: 'text'; readonly text: string }>;
  readonly isError?: boolean;
}

export async function handlePassBaker(
  bridge: IBlenderBridge,
  input: PassBakerInput
): Promise<McpToolResponse> {
  const validated = PassBakerInputSchema.parse(input);
  const resolution = Resolution.create(validated.tileWidth);

  const commandParams = {
    objectName: validated.objectName,
    passes: validated.passes,
    outputDirectory: validated.outputDirectory,
    baseName: validated.baseName,
    resolution: resolution.toJSON()
  };

  const result = await bridge.sendCommand<{
    readonly passes: ReadonlyArray<{ readonly passType: RenderPassType; readonly filePath: string }>;
  }>('bake_passes', commandParams);

  if (!result.success || !result.data) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ],
      isError: true
    };
  }

  const passFiles = result.data.passes.map((p) => ({
    passType: p.passType,
    filePath: p.filePath,
    resolution
  }));

  const bundle = new RenderPassBundle({
    id: `${validated.baseName}_bundle`,
    tileId: validated.objectName,
    passes: passFiles
  });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            result,
            bundle: bundle.toJSON()
          },
          null,
          2
        )
      }
    ],
    isError: false
  };
}
