import { z } from 'zod';
import { IBlenderBridge } from '../../../domain/contracts/blender-bridge.contract.js';
import {
  IAssetExportAdapter,
  ExportTargetType,
  ExportContext
} from '../../../domain/contracts/asset-export-adapter.contract.js';
import { getDirectionYaw } from '../../../domain/math/isometric-projection.math.js';
import { Resolution } from '../../../domain/value-objects/resolution.vo.js';
import { ProjectPaths } from '../../../domain/value-objects/project-paths.vo.js';

export const TURNAROUND_RENDER_TOOL_NAME = 'blender_iso_render_turnaround';
export const TURNAROUND_RENDER_TOOL_DESCRIPTION = 'Renders multi-angle isometric turnaround sprites and generates engine-ready atlas files';

export const TurnaroundRenderInputSchema = z.object({
  objectName: z.string().min(1),
  directions: z.union([z.literal(4), z.literal(8)]).default(4),
  tileWidth: z.number().int().positive().default(128),
  outputDirectory: z.string().default(ProjectPaths.BLENDER_TURNAROUNDS),
  baseName: z.string().default('turnaround'),
  exportTarget: z.enum(['universal', 'godot4', 'ldtk', 'phaser_defold'] as const).default('universal')
});

export type TurnaroundRenderInput = z.infer<typeof TurnaroundRenderInputSchema>;

export interface McpToolResponse {
  readonly content: ReadonlyArray<{ readonly type: 'text'; readonly text: string }>;
  readonly isError?: boolean;
}

export async function handleTurnaroundRender(
  bridge: IBlenderBridge,
  exporters: readonly IAssetExportAdapter[],
  input: TurnaroundRenderInput
): Promise<McpToolResponse> {
  const validated = TurnaroundRenderInputSchema.parse(input);
  const resolution = Resolution.create(validated.tileWidth);

  const angles: number[] = [];
  for (let i = 0; i < validated.directions; i++) {
    angles.push(getDirectionYaw(i, validated.directions));
  }

  const renderParams = {
    objectName: validated.objectName,
    angles,
    resolution: resolution.toJSON(),
    outputDirectory: validated.outputDirectory,
    baseName: validated.baseName
  };

  const renderResult = await bridge.sendCommand('render_turnaround', renderParams);
  if (!renderResult.success) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(renderResult, null, 2)
        }
      ],
      isError: true
    };
  }

  const matchedAdapter = exporters.find((adapter) => adapter.supports(validated.exportTarget));
  if (!matchedAdapter) {
    return {
      content: [
        {
          type: 'text',
          text: `No export adapter registered for target '${validated.exportTarget}'`
        }
      ],
      isError: true
    };
  }

  const exportContext: ExportContext = {
    targetType: validated.exportTarget,
    outputDirectory: validated.outputDirectory,
    baseName: validated.baseName,
    includeMetadata: true,
    options: {
      tileWidth: resolution.width,
      tileHeight: resolution.height,
      frameWidth: resolution.width,
      frameHeight: resolution.height,
      totalFrames: validated.directions,
      totalTiles: validated.directions
    }
  };

  const exportResult = await matchedAdapter.export(exportContext);

  const finalOutput = {
    render: renderResult,
    export: exportResult
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(finalOutput, null, 2)
      }
    ],
    isError: !exportResult.success
  };
}
