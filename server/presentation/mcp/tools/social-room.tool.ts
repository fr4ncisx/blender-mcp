import path from 'node:path';
import { z } from 'zod';
import { IBlenderBridge } from '../../../domain/contracts/blender-bridge.contract.js';
import { SocialRoom, RoomTheme, RoomScale } from '../../../domain/entities/social-room.entity.js';
import { FrameworkDetector } from '../../../infrastructure/detection/framework-detector.js';
import { WebGameFrameworkExporter } from '../../../infrastructure/exporters/web-game-framework-exporter.js';
import { ProjectPaths } from '../../../domain/value-objects/project-paths.vo.js';

export const SOCIAL_ROOM_TOOL_NAME = 'blender_iso_build_room';
export const SOCIAL_ROOM_TOOL_DESCRIPTION =
  'Declaratively builds a production-grade 2:1 dimetric isometric virtual avatar lounge with fine-density tiles, translucent glass shaders, ergonomic furniture with suspended legs, 50+ avatar capacity, and exports for web game frameworks (Phaser, Pixi, ThreeJS, Babylon, Excalibur)';

export const SocialRoomInputSchema = z.object({
  theme: z.string().optional(),
  roomScale: z.enum(['intimate', 'grand', 'epic']).default('grand'),
  capacityTarget: z.number().int().min(10).max(500).default(50),
  width: z.number().int().min(2).max(64).optional(),
  depth: z.number().int().min(2).max(64).optional(),
  wallHeight: z.number().positive().default(2.4),
  floorStyle: z
    .enum(['architectural_stone', 'hardwood_parquet', 'executive_slate', 'carpet', 'checkerboard'])
    .default('architectural_stone'),
  layoutMatrix: z.array(z.array(z.union([z.number(), z.string(), z.null()]))).optional(),
  furniture: z
    .array(
      z.object({
        type: z.enum([
          'sofa_single',
          'sofa_double',
          'coffee_table',
          'bar_counter',
          'bar_stool',
          'potted_plant',
          'wall_art',
          'dj_booth',
          'speaker_stack',
          'curved_sofa',
          'vip_table',
          'floor_lamp',
          'stair_step',
          'reception_desk',
          'centerpiece',
          'doorway_frame',
          'entrance_mat',
          'transition_pad'
        ]),
        gridX: z.number(),
        gridY: z.number(),
        elevation: z.number().default(0.0),
        rotationSteps: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).default(0),
        primaryColor: z.string().optional(),
        secondaryColor: z.string().optional()
      })
    )
    .default([]),
  palette: z
    .object({
      floorLight: z.string(),
      floorDark: z.string(),
      wallColor: z.string(),
      wallTrim: z.string(),
      accentColor: z.string(),
      secondaryAccent: z.string().optional(),
      metalAccent: z.string().optional(),
      woodAccent: z.string().optional()
    })
    .optional(),
  entryTile: z
    .object({
      gridX: z.number().int(),
      gridY: z.number().int(),
      elevation: z.number().default(0.0),
      direction: z.enum(['N', 'S', 'E', 'W']).default('N')
    })
    .optional(),
  transitionTiles: z
    .array(
      z.object({
        gridX: z.number().int(),
        gridY: z.number().int(),
        elevation: z.number().default(0.0),
        targetRoom: z.string().default('next_room'),
        label: z.string().default('Doorway')
      })
    )
    .optional(),
  tileSize: z.number().positive().default(0.5),
  renderOutput: z.string().default(path.join(ProjectPaths.BLENDER_ROOMS, 'social_room.png')),
  resolutionWidth: z.number().int().positive().default(1024),
  targetFramework: z.string().default('auto')
});

export type SocialRoomInput = z.infer<typeof SocialRoomInputSchema>;

export interface McpToolResponse {
  readonly content: ReadonlyArray<{ readonly type: 'text'; readonly text: string }>;
  readonly isError?: boolean;
}

export async function handleSocialRoom(
  bridge: IBlenderBridge,
  input: SocialRoomInput
): Promise<McpToolResponse> {
  const validated = SocialRoomInputSchema.parse(input);

  const room = new SocialRoom({
    theme: validated.theme as RoomTheme,
    roomScale: validated.roomScale as RoomScale,
    capacityTarget: validated.capacityTarget,
    width: validated.width,
    depth: validated.depth,
    floorStyle: validated.floorStyle,
    wallHeight: validated.wallHeight,
    furniture: validated.furniture,
    palette: validated.palette,
    layoutMatrix: validated.layoutMatrix,
    targetFramework: validated.targetFramework,
    entryTile: validated.entryTile,
    transitionTiles: validated.transitionTiles
  });

  const commandParams = {
    ...room.toJSON(),
    tileSize: validated.tileSize,
    renderOutput: validated.renderOutput,
    resolutionWidth: validated.resolutionWidth
  };

  const result = await bridge.sendCommand<Record<string, unknown>>('build_social_room', commandParams);

  let exportedArtifacts: unknown = null;
  if (result.success && validated.renderOutput) {
    const detector = new FrameworkDetector();
    const resolvedTarget = detector.resolveTarget(validated.targetFramework);
    const exporter = new WebGameFrameworkExporter();

    const outputDir = path.dirname(validated.renderOutput);
    const parsedPath = path.parse(validated.renderOutput);
    const baseName = parsedPath.name;

    const dataObj = (result.data ?? {}) as Record<string, unknown>;
    const payload = {
      roomDimensions: (dataObj['roomDimensions'] as { width: number; depth: number }) ?? {
        width: room.width,
        depth: room.depth
      },
      totalObjects: (dataObj['totalObjects'] as number) ?? 0,
      furnitureCount: (dataObj['furnitureCount'] as number) ?? 0,
      renderPath: validated.renderOutput,
      capacityMetrics: (dataObj['capacityMetrics'] as any) ?? {
        minimumCapacity: validated.capacityTarget,
        calculatedMaxCapacity: 140,
        seatingCapacity: 20,
        standingWalkableCapacity: 120,
        totalFloorTiles: 178
      },
      navigationGrid: (dataObj['navigationGrid'] as any) ?? [],
      seatingRegistry: (dataObj['seatingRegistry'] as any) ?? [],
      cameraData: dataObj['cameraData'] as any,
      lightsData: dataObj['lightsData'] as any,
      objectsData: dataObj['objectsData'] as any,
      entryTile: (dataObj['entryTile'] as any) ?? validated.entryTile,
      transitionTiles: (dataObj['transitionTiles'] as any) ?? validated.transitionTiles
    };

    exportedArtifacts = await exporter.exportFrameworks(resolvedTarget, outputDir, baseName, payload);
  }

  const finalResponse = {
    ...result,
    theme: room.theme,
    frameworkExports: exportedArtifacts
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(finalResponse, null, 2)
      }
    ],
    isError: !result.success
  };
}
