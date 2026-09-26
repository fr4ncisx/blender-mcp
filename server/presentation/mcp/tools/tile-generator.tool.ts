import { z } from 'zod';
import { IBlenderBridge } from '../../../domain/contracts/blender-bridge.contract.js';
import { VALID_TILE_TYPES, TileType } from '../../../domain/entities/tile-definition.entity.js';

export const TILE_GENERATOR_TOOL_NAME = 'blender_iso_create_tile';
export const TILE_GENERATOR_TOOL_DESCRIPTION = 'Generates 3D isometric tile geometry according to standard dimetric grid templates';

export const TileGeneratorInputSchema = z.object({
  tileType: z.enum([
    'flat_ground',
    'cube_block',
    'slope_n',
    'slope_s',
    'slope_e',
    'slope_w',
    'wall_corner'
  ] as const),
  name: z.string().default('IsometricTile'),
  unitSize: z.number().positive().default(1.0),
  unitHeight: z.number().positive().default(1.0),
  subdivisions: z.number().int().min(1).max(64).default(1),
  generateCollision: z.boolean().default(false)
});

export type TileGeneratorInput = z.infer<typeof TileGeneratorInputSchema>;

export interface McpToolResponse {
  readonly content: ReadonlyArray<{ readonly type: 'text'; readonly text: string }>;
  readonly isError?: boolean;
}

export async function handleTileGenerator(
  bridge: IBlenderBridge,
  input: TileGeneratorInput
): Promise<McpToolResponse> {
  const validated = TileGeneratorInputSchema.parse(input);

  const commandParams = {
    tileType: validated.tileType as TileType,
    name: validated.name,
    unitSize: validated.unitSize,
    unitHeight: validated.unitHeight,
    subdivisions: validated.subdivisions,
    generateCollision: validated.generateCollision
  };

  const result = await bridge.sendCommand('create_tile', commandParams);

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
