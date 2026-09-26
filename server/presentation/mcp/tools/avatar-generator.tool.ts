import { z } from 'zod';
import { IBlenderBridge } from '../../../domain/contracts/blender-bridge.contract.js';
import { SafePathSanitizer } from '../../../infrastructure/storage/safe-path-sanitizer.js';
import {
  IsometricAvatarEntity,
  AvatarColorPalette
} from '../../../domain/entities/isometric-avatar.entity.js';
import { ProjectPaths } from '../../../domain/value-objects/project-paths.vo.js';

export const AVATAR_GENERATOR_TOOL_NAME = 'blender_iso_create_avatar';
export const AVATAR_GENERATOR_TOOL_DESCRIPTION =
  'Procedurally builds and renders a 2:1 dimetric NPR stylized humanoid avatar in Blender with customizable palette, beveled hair, layered clothing, and generates 8-direction turnaround sprites';

export const AvatarGeneratorInputSchema = z.object({
  name: z.string().default('IsoAvatar'),
  skinColor: z.string().default('#fcd5b4'),
  hairColor: z.string().default('#4a2c11'),
  shirtColor: z.string().default('#00f0ff'),
  pantsColor: z.string().default('#1e293b'),
  shoesColor: z.string().default('#111827'),
  scale: z.number().positive().default(1.0),
  directions: z.union([z.literal(4), z.literal(8)]).default(8),
  tileWidth: z.number().int().positive().default(128),
  tileHeight: z.number().int().positive().default(256),
  outputDirectory: z.string().default(ProjectPaths.BLENDER_TURNAROUNDS),
  baseName: z.string().default('avatar')
});

export type AvatarGeneratorInput = z.infer<typeof AvatarGeneratorInputSchema>;

export interface McpToolResponse {
  readonly content: ReadonlyArray<{ readonly type: 'text'; readonly text: string }>;
  readonly isError?: boolean;
}

export async function handleAvatarGenerator(
  bridge: IBlenderBridge,
  sanitizer: SafePathSanitizer,
  input: AvatarGeneratorInput
): Promise<McpToolResponse> {
  const validated = AvatarGeneratorInputSchema.parse(input);
  const safeOutputDir = sanitizer.sanitizePath(validated.outputDirectory);

  const palette: AvatarColorPalette = {
    skinColor: validated.skinColor,
    hairColor: validated.hairColor,
    shirtColor: validated.shirtColor,
    pantsColor: validated.pantsColor,
    shoesColor: validated.shoesColor
  };

  const avatar = new IsometricAvatarEntity({
    name: validated.name,
    palette,
    scale: validated.scale,
    direction: 0,
    gridX: 0,
    gridY: 0,
    elevation: 0
  });

  const commandParams = {
    ...avatar.toJSON(),
    directions: validated.directions,
    tileWidth: validated.tileWidth,
    tileHeight: validated.tileHeight,
    outputDirectory: safeOutputDir,
    baseName: validated.baseName
  };

  const result = await bridge.sendCommand<Record<string, unknown>>('build_avatar', commandParams);

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
