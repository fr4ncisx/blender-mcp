import { z } from 'zod';
import { IBlenderBridge } from '../../../domain/contracts/blender-bridge.contract.js';

export const INSPECT_SCENE_TOOL_NAME = 'blender_iso_inspect_scene';
export const INSPECT_SCENE_TOOL_DESCRIPTION = 'Inspects current Blender scene structure, objects, camera configuration, and active materials';

export const InspectSceneInputSchema = z.object({
  includeObjects: z.boolean().default(true),
  includeCameras: z.boolean().default(true),
  includeMaterials: z.boolean().default(true)
});

export type InspectSceneInput = z.infer<typeof InspectSceneInputSchema>;

export interface McpToolResponse {
  readonly content: ReadonlyArray<{ readonly type: 'text'; readonly text: string }>;
  readonly isError?: boolean;
}

export async function handleInspectScene(
  bridge: IBlenderBridge,
  input: InspectSceneInput
): Promise<McpToolResponse> {
  const validated = InspectSceneInputSchema.parse(input);

  const commandParams = {
    includeObjects: validated.includeObjects,
    includeCameras: validated.includeCameras,
    includeMaterials: validated.includeMaterials
  };

  const result = await bridge.sendCommand('inspect_scene', commandParams);

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
