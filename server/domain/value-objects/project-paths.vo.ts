export class ProjectPaths {
  public static readonly BLENDER_ROOT = 'output/blender';
  public static readonly BLENDER_ROOMS = 'output/blender/rooms';
  public static readonly BLENDER_TURNAROUNDS = 'output/blender/turnarounds';
  public static readonly BLENDER_PASSES = 'output/blender/passes';

  public static readonly ISOMETRIC_ASSETS_ROOT = 'output/isometric-assets';
  public static readonly ASSETS_TILES = 'output/isometric-assets/tiles';
  public static readonly ASSETS_ATLASES = 'output/isometric-assets/atlases';
  public static readonly ASSETS_COLLISIONS = 'output/isometric-assets/collisions';
  public static readonly ASSETS_MANIFESTS = 'output/isometric-assets/manifests';

  public static readonly ALL_DIRECTORIES: readonly string[] = Object.freeze([
    ProjectPaths.BLENDER_ROOMS,
    ProjectPaths.BLENDER_TURNAROUNDS,
    ProjectPaths.BLENDER_PASSES,
    ProjectPaths.ASSETS_TILES,
    ProjectPaths.ASSETS_ATLASES,
    ProjectPaths.ASSETS_COLLISIONS,
    ProjectPaths.ASSETS_MANIFESTS
  ]);

  public static get blenderRoot(): string {
    return ProjectPaths.BLENDER_ROOT;
  }

  public static get blenderRooms(): string {
    return ProjectPaths.BLENDER_ROOMS;
  }

  public static get blenderTurnarounds(): string {
    return ProjectPaths.BLENDER_TURNAROUNDS;
  }

  public static get blenderPasses(): string {
    return ProjectPaths.BLENDER_PASSES;
  }

  public static get isometricAssetsRoot(): string {
    return ProjectPaths.ISOMETRIC_ASSETS_ROOT;
  }

  public static get assetsTiles(): string {
    return ProjectPaths.ASSETS_TILES;
  }

  public static get assetsAtlases(): string {
    return ProjectPaths.ASSETS_ATLASES;
  }

  public static get assetsCollisions(): string {
    return ProjectPaths.ASSETS_COLLISIONS;
  }

  public static get assetsManifests(): string {
    return ProjectPaths.ASSETS_MANIFESTS;
  }

  public static get allDirectories(): readonly string[] {
    return ProjectPaths.ALL_DIRECTORIES;
  }

  private constructor() {}
}

Object.freeze(ProjectPaths);
