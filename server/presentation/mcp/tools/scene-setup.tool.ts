import { z } from 'zod';
import { IBlenderBridge } from '../../../domain/contracts/blender-bridge.contract.js';
import {
  CAMERA_ANGLE_X_DEG,
  CAMERA_ANGLE_Y_DEG,
  calculateOrthoScale,
  calculateDimetricResolution
} from '../../../domain/math/isometric-projection.math.js';

export const SCENE_SETUP_TOOL_NAME = 'blender_iso_setup_scene';
export const SCENE_SETUP_TOOL_DESCRIPTION = 'Configures Blender camera and scene for 2:1 dimetric isometric rendering';

export const SceneSetupInputSchema = z.object({
  unitSize: z.number().positive().default(1.0),
  tileWidth: z.number().int().positive().default(128),
  clearScene: z.boolean().default(true),
  ambientOcclusion: z.boolean().default(true),
  colorManagement: z.enum(['Standard', 'AgX', 'Filmic']).default('Standard')
});

export type SceneSetupInput = z.infer<typeof SceneSetupInputSchema>;

export interface McpToolResponse {
  readonly content: ReadonlyArray<{ readonly type: 'text'; readonly text: string }>;
  readonly isError?: boolean;
}

export async function handleSceneSetup(
  bridge: IBlenderBridge,
  input: SceneSetupInput
): Promise<McpToolResponse> {
  const validated = SceneSetupInputSchema.parse(input);
  const orthoScale = calculateOrthoScale(validated.unitSize);
  const resolution = calculateDimetricResolution(validated.tileWidth);

  const commandParams = {
    cameraRotation: {
      x: CAMERA_ANGLE_X_DEG,
      y: CAMERA_ANGLE_Y_DEG,
      z: 45.0
    },
    orthoScale,
    resolution,
    clearScene: validated.clearScene,
    ambientOcclusion: validated.ambientOcclusion,
    colorManagement: validated.colorManagement
  };

  const result = await bridge.sendCommand('setup_scene', commandParams);

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
