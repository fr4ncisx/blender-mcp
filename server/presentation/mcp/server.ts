import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolResult
} from '@modelcontextprotocol/sdk/types.js';
import { performance } from 'node:perf_hooks';

import { SafePathSanitizer } from '../../infrastructure/storage/safe-path-sanitizer.js';
import { UniversalAtlasExporter } from '../../infrastructure/exporters/universal-atlas-exporter.js';
import { Godot4TilesetExporter } from '../../infrastructure/exporters/godot4-tileset-exporter.js';
import { LdtkExporter } from '../../infrastructure/exporters/ldtk-exporter.js';
import { PhaserDefoldExporter } from '../../infrastructure/exporters/phaser-defold-exporter.js';
import { WsBlenderClient } from '../../infrastructure/blender/ws-blender-client.js';
import { IAssetExportAdapter } from '../../domain/contracts/asset-export-adapter.contract.js';
import { AppConfig } from '../../infrastructure/config/app-config.js';
import { TerminalLogger } from '../logging/terminal-logger.js';

import {
  SCENE_SETUP_TOOL_NAME,
  SCENE_SETUP_TOOL_DESCRIPTION,
  handleSceneSetup,
  SceneSetupInput
} from './tools/scene-setup.tool.js';

import {
  TILE_GENERATOR_TOOL_NAME,
  TILE_GENERATOR_TOOL_DESCRIPTION,
  handleTileGenerator,
  TileGeneratorInput
} from './tools/tile-generator.tool.js';

import {
  NPR_MATERIAL_TOOL_NAME,
  NPR_MATERIAL_TOOL_DESCRIPTION,
  handleNprMaterial,
  NprMaterialInput
} from './tools/npr-material.tool.js';

import {
  TURNAROUND_RENDER_TOOL_NAME,
  TURNAROUND_RENDER_TOOL_DESCRIPTION,
  handleTurnaroundRender,
  TurnaroundRenderInput
} from './tools/turnaround-render.tool.js';

import {
  PASS_BAKER_TOOL_NAME,
  PASS_BAKER_TOOL_DESCRIPTION,
  handlePassBaker,
  PassBakerInput
} from './tools/pass-baker.tool.js';

import {
  INSPECT_SCENE_TOOL_NAME,
  INSPECT_SCENE_TOOL_DESCRIPTION,
  handleInspectScene,
  InspectSceneInput
} from './tools/inspect-scene.tool.js';

import {
  SOCIAL_ROOM_TOOL_NAME,
  SOCIAL_ROOM_TOOL_DESCRIPTION,
  handleSocialRoom,
  SocialRoomInput
} from './tools/social-room.tool.js';

import {
  ISOMETRIC_ASSET_BAKER_TOOL_NAME,
  ISOMETRIC_ASSET_BAKER_TOOL_DESCRIPTION,
  handleIsometricAssetBaker,
  IsometricAssetBakerInput
} from './tools/isometric-asset-baker.tool.js';

import {
  AVATAR_GENERATOR_TOOL_NAME,
  AVATAR_GENERATOR_TOOL_DESCRIPTION,
  handleAvatarGenerator,
  AvatarGeneratorInput
} from './tools/avatar-generator.tool.js';

import { AssetCacheManager } from '../../infrastructure/cache/asset-cache-manager.js';
import {
  SYNTHESIZE_WORLD_TOOL_NAME,
  SYNTHESIZE_WORLD_TOOL_DESCRIPTION,
  handleSynthesizeWorld,
  SynthesizeWorldInput
} from './tools/synthesize-world.tool.js';

const BLENDER_REQUIRING_TOOLS: ReadonlySet<string> = new Set([
  SCENE_SETUP_TOOL_NAME,
  TILE_GENERATOR_TOOL_NAME,
  NPR_MATERIAL_TOOL_NAME,
  TURNAROUND_RENDER_TOOL_NAME,
  PASS_BAKER_TOOL_NAME,
  INSPECT_SCENE_TOOL_NAME,
  SOCIAL_ROOM_TOOL_NAME,
  AVATAR_GENERATOR_TOOL_NAME,
  SYNTHESIZE_WORLD_TOOL_NAME
]);

export function createServer(config?: AppConfig): Server {
  const effectiveConfig = config ?? AppConfig.load();
  const sanitizer = new SafePathSanitizer();
  const cacheManager = new AssetCacheManager(sanitizer);
  const exporters: readonly IAssetExportAdapter[] = Object.freeze([
    new UniversalAtlasExporter(sanitizer),
    new Godot4TilesetExporter(sanitizer),
    new LdtkExporter(sanitizer),
    new PhaserDefoldExporter(sanitizer)
  ]);
  const bridge = new WsBlenderClient({
    url: effectiveConfig.wsUrl,
    authToken: effectiveConfig.authToken,
    timeoutMs: effectiveConfig.timeoutMs
  });

  const server = new Server(
    {
      name: 'blender-iso-mcp',
      version: '0.9.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: SCENE_SETUP_TOOL_NAME,
          description: SCENE_SETUP_TOOL_DESCRIPTION,
          inputSchema: {
            type: 'object',
            properties: {
              unitSize: { type: 'number', default: 1.0 },
              tileWidth: { type: 'number', default: 128 },
              clearScene: { type: 'boolean', default: true },
              ambientOcclusion: { type: 'boolean', default: true },
              colorManagement: { type: 'string', enum: ['Standard', 'AgX', 'Filmic'], default: 'Standard' }
            }
          }
        },
        {
          name: TILE_GENERATOR_TOOL_NAME,
          description: TILE_GENERATOR_TOOL_DESCRIPTION,
          inputSchema: {
            type: 'object',
            properties: {
              tileType: {
                type: 'string',
                enum: [
                  'flat_ground',
                  'cube_block',
                  'slope_n',
                  'slope_s',
                  'slope_e',
                  'slope_w',
                  'wall_corner'
                ]
              },
              name: { type: 'string', default: 'IsometricTile' },
              unitSize: { type: 'number', default: 1.0 },
              unitHeight: { type: 'number', default: 1.0 },
              subdivisions: { type: 'number', default: 1 },
              generateCollision: { type: 'boolean', default: false }
            },
            required: ['tileType']
          }
        },
        {
          name: NPR_MATERIAL_TOOL_NAME,
          description: NPR_MATERIAL_TOOL_DESCRIPTION,
          inputSchema: {
            type: 'object',
            properties: {
              targetObjectName: { type: 'string' },
              palette: { type: 'array', items: { type: 'string' } },
              pixelSnap: { type: 'boolean', default: true },
              outlineWidth: { type: 'number', default: 0.02 },
              shadingSteps: { type: 'number', default: 3 },
              smoothNormals: { type: 'boolean', default: false }
            },
            required: ['targetObjectName', 'palette']
          }
        },
        {
          name: TURNAROUND_RENDER_TOOL_NAME,
          description: TURNAROUND_RENDER_TOOL_DESCRIPTION,
          inputSchema: {
            type: 'object',
            properties: {
              objectName: { type: 'string' },
              directions: { type: 'number', enum: [4, 8], default: 4 },
              tileWidth: { type: 'number', default: 128 },
              outputDirectory: { type: 'string', default: 'output/blender/turnarounds' },
              baseName: { type: 'string', default: 'turnaround' },
              exportTarget: {
                type: 'string',
                enum: ['universal', 'godot4', 'ldtk', 'phaser_defold'],
                default: 'universal'
              }
            },
            required: ['objectName']
          }
        },
        {
          name: PASS_BAKER_TOOL_NAME,
          description: PASS_BAKER_TOOL_DESCRIPTION,
          inputSchema: {
            type: 'object',
            properties: {
              objectName: { type: 'string' },
              passes: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['albedo', 'normal_2d', 'depth', 'shadow_mask']
                }
              },
              outputDirectory: { type: 'string', default: 'output/blender/passes' },
              baseName: { type: 'string', default: 'baked_passes' },
              tileWidth: { type: 'number', default: 128 }
            },
            required: ['objectName', 'passes']
          }
        },
        {
          name: INSPECT_SCENE_TOOL_NAME,
          description: INSPECT_SCENE_TOOL_DESCRIPTION,
          inputSchema: {
            type: 'object',
            properties: {
              includeObjects: { type: 'boolean', default: true },
              includeCameras: { type: 'boolean', default: true },
              includeMaterials: { type: 'boolean', default: true }
            }
          }
        },
        {
          name: SOCIAL_ROOM_TOOL_NAME,
          description: SOCIAL_ROOM_TOOL_DESCRIPTION,
          inputSchema: {
            type: 'object',
            properties: {
              width: { type: 'integer', default: 6 },
              depth: { type: 'integer', default: 6 },
              wallHeight: { type: 'number', default: 2.2 },
              floorStyle: { type: 'string', enum: ['checkerboard', 'hardwood', 'carpet'], default: 'checkerboard' },
              furniture: { type: 'array', items: { type: 'object' } },
              palette: { type: 'object' },
              tileSize: { type: 'number', default: 1.0 },
              renderOutput: { type: 'string', default: 'output/blender/rooms/social_room.png' },
              resolutionWidth: { type: 'integer', default: 512 }
            }
          }
        },
        {
          name: ISOMETRIC_ASSET_BAKER_TOOL_NAME,
          description: ISOMETRIC_ASSET_BAKER_TOOL_DESCRIPTION,
          inputSchema: {
            type: 'object',
            properties: {
              tileWidth: { type: 'integer', default: 64 },
              archetypes: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['floor', 'wall', 'slope', 'furniture', 'stair', 'column', 'transition']
                }
              },
              outputDirectory: { type: 'string', default: 'output/isometric-assets' },
              manifestFileName: { type: 'string', default: 'isometric_assets_manifest.json' }
            }
          }
        },
        {
          name: AVATAR_GENERATOR_TOOL_NAME,
          description: AVATAR_GENERATOR_TOOL_DESCRIPTION,
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', default: 'IsoAvatar' },
              skinColor: { type: 'string', default: '#fcd5b4' },
              hairColor: { type: 'string', default: '#4a2c11' },
              shirtColor: { type: 'string', default: '#00f0ff' },
              pantsColor: { type: 'string', default: '#1e293b' },
              shoesColor: { type: 'string', default: '#111827' },
              scale: { type: 'number', default: 1.0 },
              directions: { type: 'number', enum: [4, 8], default: 8 },
              tileWidth: { type: 'number', default: 128 },
              tileHeight: { type: 'number', default: 256 },
              outputDirectory: { type: 'string', default: 'output/blender/turnarounds' },
              baseName: { type: 'string', default: 'avatar' }
            }
          }
        },
        {
          name: SYNTHESIZE_WORLD_TOOL_NAME,
          description: SYNTHESIZE_WORLD_TOOL_DESCRIPTION,
          inputSchema: {
            type: 'object',
            properties: {
              blueprint: { type: 'string' },
              name: { type: 'string', default: 'synthesized_world' },
              theme: {
                type: 'string',
                enum: [
                  'art_deco_cyberpunk',
                  'retro_social_lounge',
                  'neo_tokyo_diner',
                  'medieval_tavern',
                  'minimalist_gallery'
                ],
                default: 'art_deco_cyberpunk'
              },
              palette: { type: 'array', items: { type: 'string' } },
              tileWidth: { type: 'number', default: 128 },
              seed: { type: 'number' },
              includePreview: { type: 'boolean', default: true }
            },
            required: ['blueprint']
          }
        }
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const handlerStart = performance.now();
    const { name, arguments: args } = request.params;
    const safeArgs = (args ?? {}) as Record<string, unknown>;

    if (!effectiveConfig.isBlenderInstalled && BLENDER_REQUIRING_TOOLS.has(name)) {
      TerminalLogger.logToolError(name, 0, 'Blender not installed — tool requires a live Blender instance');
      return {
        content: [{ type: 'text', text: 'Blender is not installed or not found on this system. Install Blender 3.6+ and configure BLENDER_PATH.' }],
        isError: true
      };
    }

    TerminalLogger.logToolStart(name, safeArgs);

    let result: {
      readonly content: ReadonlyArray<
        | { readonly type: 'text'; readonly text: string }
        | { readonly type: 'image'; readonly data: string; readonly mimeType: string }
      >;
      readonly isError?: boolean;
    };

    try {
      switch (name) {
        case SCENE_SETUP_TOOL_NAME:
          result = await handleSceneSetup(bridge, safeArgs as unknown as SceneSetupInput);
          break;
        case TILE_GENERATOR_TOOL_NAME:
          result = await handleTileGenerator(bridge, safeArgs as unknown as TileGeneratorInput);
          break;
        case NPR_MATERIAL_TOOL_NAME:
          result = await handleNprMaterial(bridge, safeArgs as unknown as NprMaterialInput);
          break;
        case TURNAROUND_RENDER_TOOL_NAME:
          result = await handleTurnaroundRender(bridge, exporters, safeArgs as unknown as TurnaroundRenderInput);
          break;
        case PASS_BAKER_TOOL_NAME:
          result = await handlePassBaker(bridge, safeArgs as unknown as PassBakerInput);
          break;
        case INSPECT_SCENE_TOOL_NAME:
          result = await handleInspectScene(bridge, safeArgs as unknown as InspectSceneInput);
          break;
        case SOCIAL_ROOM_TOOL_NAME:
          result = await handleSocialRoom(bridge, safeArgs as unknown as SocialRoomInput);
          break;
        case ISOMETRIC_ASSET_BAKER_TOOL_NAME:
          result = await handleIsometricAssetBaker(sanitizer, safeArgs as unknown as IsometricAssetBakerInput);
          break;
        case AVATAR_GENERATOR_TOOL_NAME:
          result = await handleAvatarGenerator(bridge, sanitizer, safeArgs as unknown as AvatarGeneratorInput);
          break;
        case SYNTHESIZE_WORLD_TOOL_NAME:
          result = await handleSynthesizeWorld(
            bridge,
            sanitizer,
            cacheManager,
            safeArgs as unknown as SynthesizeWorldInput
          );
          break;
        default:
          return {
            content: [
              {
                type: 'text',
                text: `Tool not found: ${name}`
              }
            ],
            isError: true
          };
      }
    } catch (err: unknown) {
      const duration = Math.round(performance.now() - handlerStart);
      TerminalLogger.logToolError(name, duration, err instanceof Error ? err.message : String(err));
      return {
        content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
        isError: true
      };
    }

    const successDuration = Math.round(performance.now() - handlerStart);
    TerminalLogger.logToolSuccess(name, successDuration);
    return { content: [...result.content], isError: result.isError };
  });

  return server;
}

async function main(): Promise<void> {
  const config = AppConfig.load(process.argv.slice(2));

  if (config.failFast && !config.isBlenderInstalled) {
    TerminalLogger.printFailFastBanner(config);
    process.exit(1);
  }

  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  TerminalLogger.printStartupBanner(config, 10);
}

if (process.argv[1]?.endsWith('server.js') || process.argv[1]?.endsWith('server.ts')) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exit(1);
  });
}
