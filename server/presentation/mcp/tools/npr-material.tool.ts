import { z } from 'zod';
import { IBlenderBridge } from '../../../domain/contracts/blender-bridge.contract.js';
import { ColorPalette } from '../../../domain/value-objects/color-palette.vo.js';

export const NPR_MATERIAL_TOOL_NAME = 'blender_iso_apply_npr_material';
export const NPR_MATERIAL_TOOL_DESCRIPTION = 'Applies stylized non-photorealistic pixel/toon shading and palette quantization to objects';

export const NprMaterialInputSchema = z.object({
  targetObjectName: z.string().min(1),
  palette: z.array(z.string()).min(1),
  pixelSnap: z.boolean().default(true),
  outlineWidth: z.number().nonnegative().default(0.02),
  shadingSteps: z.number().int().min(1).max(16).default(3),
  smoothNormals: z.boolean().default(false)
});

export type NprMaterialInput = z.infer<typeof NprMaterialInputSchema>;

export interface McpToolResponse {
  readonly content: ReadonlyArray<{ readonly type: 'text'; readonly text: string }>;
  readonly isError?: boolean;
}

export async function handleNprMaterial(
  bridge: IBlenderBridge,
  input: NprMaterialInput
): Promise<McpToolResponse> {
  const validated = NprMaterialInputSchema.parse(input);
  const colorPalette = new ColorPalette(validated.palette);

  const commandParams = {
    targetObjectName: validated.targetObjectName,
    palette: colorPalette.colors,
    pixelSnap: validated.pixelSnap,
    outlineWidth: validated.outlineWidth,
    shadingSteps: validated.shadingSteps,
    smoothNormals: validated.smoothNormals
  };

  const result = await bridge.sendCommand('apply_npr_material', commandParams);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }
    ],
    isError: !result.success
  };
}
