import bpy
import math
import os

class SocialRoomEngine:
    def build_room(self, params):
        if params.get("theme") in ("habbo_bar", "habbo_rooftop_bar"):
            from .habbo_bar_engine import HabboBarEngine
            return HabboBarEngine().build_bar(params)

        width = int(params.get("width", 28))
        depth = int(params.get("depth", 28))
        wall_height = float(params.get("wallHeight", 2.4))
        tile_size = float(params.get("tileSize", 0.5))
        render_output = params.get("renderOutput", "")
        res_w = int(params.get("resolutionWidth", 1024))
        res_h = res_w // 2

        palette = params.get("palette", {})
        col_floor_light = palette.get("floorLight", "#ded9d2")
        col_floor_dark = palette.get("floorDark", "#d4cec5")
        col_wall = palette.get("wallColor", "#ded9d2")
        col_trim = palette.get("wallTrim", "#c59b27")
        col_accent = palette.get("accentColor", "#b45309")
        col_sec_accent = palette.get("secondaryAccent", "#0f766e")
        col_metal = palette.get("metalAccent", "#c59b27")
        col_wood = palette.get("woodAccent", "#382417")

        floor_style = params.get("floorStyle", "architectural_stone")
        entry_tile = params.get("entryTile", {"gridX": 13, "gridY": 0, "elevation": 0.0, "direction": "N"})
        transition_tiles = params.get("transitionTiles", [
            {"gridX": 25, "gridY": 27, "elevation": 1.2, "targetRoom": "vip_terrace", "label": "VIP Terrace"},
            {"gridX": 10, "gridY": 27, "elevation": 0.6, "targetRoom": "executive_hall", "label": "Executive Hall"}
        ])

        raw_layout = params.get("layoutMatrix")
        if raw_layout and len(raw_layout) > 0:
            layout_grid = raw_layout
            width = len(layout_grid[0])
            depth = len(layout_grid)
        else:
            layout_grid = self._create_default_grand_layout(width, depth)

        raw_furniture = params.get("furniture")
        if raw_furniture and len(raw_furniture) > 0:
            furniture_list = raw_furniture
        else:
            furniture_list = self._create_default_grand_furniture(width, depth, col_accent, col_sec_accent, col_metal, col_wood)

        for obj in list(bpy.context.scene.objects):
            bpy.data.objects.remove(obj, do_unlink=True)

        created_objects = []
        navigation_grid = []
        seating_registry = []

        floor_objs, nav_cells = self._build_layout_floors(
            layout_grid,
            width,
            depth,
            tile_size,
            col_floor_light,
            col_floor_dark,
            col_wood,
            floor_style,
            entry_tile,
            transition_tiles
        )
        created_objects.extend(floor_objs)
        navigation_grid.extend(nav_cells)

        wall_objs = self._build_perimeter_walls(
            layout_grid,
            width,
            depth,
            tile_size,
            wall_height,
            col_wall,
            col_trim,
            col_wood,
            transition_tiles
        )
        created_objects.extend(wall_objs)

        stair_objs, stair_nav = self._build_layout_stairs(layout_grid, width, depth, tile_size, col_wood, col_trim)
        created_objects.extend(stair_objs)
        navigation_grid.extend(stair_nav)

        railing_objs = self._build_safety_railings(layout_grid, width, depth, tile_size, col_metal, entry_tile, transition_tiles)
        created_objects.extend(railing_objs)

        furni_objs, seats, occupied_cells = self._build_grand_furniture(
            furniture_list,
            tile_size,
            col_accent,
            col_sec_accent,
            col_metal,
            col_wood
        )
        created_objects.extend(furni_objs)
        seating_registry.extend(seats)

        walkable_count = 0
        final_nav_grid = []
        for cell in navigation_grid:
            coord_key = (cell["gridX"], cell["gridY"])
            is_occupied = coord_key in occupied_cells
            is_walkable = cell["walkable"] and not is_occupied
            if is_walkable:
                walkable_count += 1
            final_nav_grid.append({
                "gridX": cell["gridX"],
                "gridY": cell["gridY"],
                "elevation": cell["elevation"],
                "walkable": is_walkable,
                "tileType": cell["tileType"]
            })

        capacity_metrics = {
            "minimumCapacity": 50,
            "calculatedMaxCapacity": walkable_count + len(seating_registry),
            "seatingCapacity": len(seating_registry),
            "standingWalkableCapacity": walkable_count,
            "totalFloorTiles": len(navigation_grid)
        }

        camera_data = self._setup_camera_and_render(width, depth, tile_size, wall_height, res_w, res_h)
        lights_data, chand_objs = self._setup_lighting(width, depth, tile_size, wall_height, col_metal)
        created_objects.extend(chand_objs)

        rendered_size = 0
        if render_output:
            render_output = os.path.abspath(render_output)
            os.makedirs(os.path.dirname(render_output), exist_ok=True)
            bpy.context.scene.render.filepath = render_output
            bpy.context.scene.render.image_settings.file_format = 'PNG'
            bpy.context.scene.render.image_settings.color_mode = 'RGBA'
            bpy.ops.render.render(write_still=True)
            if os.path.exists(render_output):
                rendered_size = os.path.getsize(render_output)

        objects_data = []
        for obj in created_objects:
            objects_data.append({
                "name": obj.name,
                "type": obj.type,
                "location": [round(v, 4) for v in obj.location]
            })

        return {
            "success": True,
            "roomDimensions": {"width": width, "depth": depth},
            "totalObjects": len(created_objects),
            "furnitureCount": len(furni_objs),
            "renderPath": render_output,
            "renderSizeBytes": rendered_size,
            "capacityMetrics": capacity_metrics,
            "entryTile": entry_tile,
            "transitionTiles": transition_tiles,
            "navigationGrid": final_nav_grid,
            "seatingRegistry": seating_registry,
            "cameraData": camera_data,
            "lightsData": lights_data,
            "objectsData": objects_data
        }

    def _create_default_grand_layout(self, width, depth):
        if width < 12 or depth < 12:
            return [[1 for _ in range(width)] for _ in range(depth)]

        if width >= 20 and depth >= 20:
            grid = []
            for y in range(depth):
                row = []
                for x in range(width):
                    if x >= 18 and y >= 16:
                        row.append(3)
                    elif x < 7 or y >= 16 or x >= 23:
                        row.append(2)
                    else:
                        row.append(1)
                grid.append(row)

            grid[15][13] = "STAIR_N"
            grid[15][14] = "STAIR_N"
            grid[20][17] = "STAIR_E"
            grid[21][17] = "STAIR_E"
            return grid

        grid = []
        for y in range(depth):
            row = []
            for x in range(width):
                if (x < 3 and y < 3) or (x > 13 and y < 4):
                    row.append(None)
                elif x >= 11 and y >= 9:
                    row.append(3)
                elif (x < 3 and y >= 3) or y >= 10:
                    row.append(2)
                else:
                    row.append(1)
            grid.append(row)

        if depth > 10 and width > 11:
            grid[9][6] = "STAIR_N"
            grid[10][11] = "STAIR_E"
        return grid

    def _create_default_grand_furniture(self, width, depth, accent_col, sec_col, metal_col, wood_col):
        if width >= 20 and depth >= 20:
            return [
                {"type": "centerpiece", "gridX": 13, "gridY": 8, "elevation": 0.0, "rotationSteps": 0, "primaryColor": "#1e293b", "secondaryColor": "#0284c7"},
                {"type": "reception_desk", "gridX": 13, "gridY": 2, "elevation": 0.0, "rotationSteps": 0, "primaryColor": wood_col, "secondaryColor": metal_col},
                {"type": "potted_plant", "gridX": 11, "gridY": 2, "elevation": 0.0, "rotationSteps": 0},
                {"type": "potted_plant", "gridX": 16, "gridY": 2, "elevation": 0.0, "rotationSteps": 0},
                {"type": "sofa_double", "gridX": 8, "gridY": 6, "elevation": 0.0, "rotationSteps": 0, "primaryColor": accent_col, "secondaryColor": metal_col},
                {"type": "sofa_double", "gridX": 8, "gridY": 10, "elevation": 0.0, "rotationSteps": 2, "primaryColor": accent_col, "secondaryColor": metal_col},
                {"type": "coffee_table", "gridX": 9, "gridY": 8, "elevation": 0.0, "rotationSteps": 0, "secondaryColor": metal_col},
                {"type": "sofa_single", "gridX": 6, "gridY": 8, "elevation": 0.0, "rotationSteps": 1, "primaryColor": sec_col, "secondaryColor": metal_col},
                {"type": "sofa_single", "gridX": 11, "gridY": 8, "elevation": 0.0, "rotationSteps": 3, "primaryColor": sec_col, "secondaryColor": metal_col},
                {"type": "potted_plant", "gridX": 6, "gridY": 6, "elevation": 0.0, "rotationSteps": 0},
                {"type": "potted_plant", "gridX": 6, "gridY": 10, "elevation": 0.0, "rotationSteps": 0},
                {"type": "sofa_double", "gridX": 17, "gridY": 6, "elevation": 0.0, "rotationSteps": 0, "primaryColor": accent_col, "secondaryColor": metal_col},
                {"type": "sofa_double", "gridX": 17, "gridY": 10, "elevation": 0.0, "rotationSteps": 2, "primaryColor": accent_col, "secondaryColor": metal_col},
                {"type": "coffee_table", "gridX": 18, "gridY": 8, "elevation": 0.0, "rotationSteps": 0, "secondaryColor": metal_col},
                {"type": "sofa_single", "gridX": 15, "gridY": 8, "elevation": 0.0, "rotationSteps": 1, "primaryColor": sec_col, "secondaryColor": metal_col},
                {"type": "sofa_single", "gridX": 20, "gridY": 8, "elevation": 0.0, "rotationSteps": 3, "primaryColor": sec_col, "secondaryColor": metal_col},
                {"type": "potted_plant", "gridX": 21, "gridY": 6, "elevation": 0.0, "rotationSteps": 0},
                {"type": "potted_plant", "gridX": 21, "gridY": 10, "elevation": 0.0, "rotationSteps": 0},
                {"type": "bar_counter", "gridX": 2, "gridY": 8, "elevation": 0.6, "rotationSteps": 1, "primaryColor": sec_col, "secondaryColor": metal_col},
                {"type": "bar_counter", "gridX": 2, "gridY": 9, "elevation": 0.6, "rotationSteps": 1, "primaryColor": sec_col, "secondaryColor": metal_col},
                {"type": "bar_counter", "gridX": 2, "gridY": 10, "elevation": 0.6, "rotationSteps": 1, "primaryColor": sec_col, "secondaryColor": metal_col},
                {"type": "bar_counter", "gridX": 2, "gridY": 11, "elevation": 0.6, "rotationSteps": 1, "primaryColor": sec_col, "secondaryColor": metal_col},
                {"type": "bar_counter", "gridX": 2, "gridY": 12, "elevation": 0.6, "rotationSteps": 1, "primaryColor": sec_col, "secondaryColor": metal_col},
                {"type": "bar_stool", "gridX": 3, "gridY": 8, "elevation": 0.6, "rotationSteps": 3, "primaryColor": "#fafaf9", "secondaryColor": metal_col},
                {"type": "bar_stool", "gridX": 3, "gridY": 9, "elevation": 0.6, "rotationSteps": 3, "primaryColor": "#fafaf9", "secondaryColor": metal_col},
                {"type": "bar_stool", "gridX": 3, "gridY": 10, "elevation": 0.6, "rotationSteps": 3, "primaryColor": "#fafaf9", "secondaryColor": metal_col},
                {"type": "bar_stool", "gridX": 3, "gridY": 11, "elevation": 0.6, "rotationSteps": 3, "primaryColor": "#fafaf9", "secondaryColor": metal_col},
                {"type": "bar_stool", "gridX": 3, "gridY": 12, "elevation": 0.6, "rotationSteps": 3, "primaryColor": "#fafaf9", "secondaryColor": metal_col},
                {"type": "potted_plant", "gridX": 2, "gridY": 6, "elevation": 0.6, "rotationSteps": 0},
                {"type": "potted_plant", "gridX": 2, "gridY": 14, "elevation": 0.6, "rotationSteps": 0},
                {"type": "wall_art", "gridX": 0, "gridY": 10, "elevation": 0.6, "rotationSteps": 1, "primaryColor": accent_col},
                {"type": "sofa_double", "gridX": 10, "gridY": 23, "elevation": 0.6, "rotationSteps": 2, "primaryColor": "#fafaf9", "secondaryColor": metal_col},
                {"type": "coffee_table", "gridX": 10, "gridY": 20, "elevation": 0.6, "rotationSteps": 0, "secondaryColor": metal_col},
                {"type": "sofa_single", "gridX": 8, "gridY": 20, "elevation": 0.6, "rotationSteps": 1, "primaryColor": "#c2410c", "secondaryColor": metal_col},
                {"type": "sofa_single", "gridX": 12, "gridY": 20, "elevation": 0.6, "rotationSteps": 3, "primaryColor": "#c2410c", "secondaryColor": metal_col},
                {"type": "wall_art", "gridX": 5, "gridY": 27, "elevation": 0.6, "rotationSteps": 0, "primaryColor": sec_col},
                {"type": "potted_plant", "gridX": 7, "gridY": 26, "elevation": 0.6, "rotationSteps": 0},
                {"type": "potted_plant", "gridX": 14, "gridY": 26, "elevation": 0.6, "rotationSteps": 0},
                {"type": "curved_sofa", "gridX": 22, "gridY": 24, "elevation": 1.2, "rotationSteps": 2, "primaryColor": "#d97706", "secondaryColor": metal_col},
                {"type": "vip_table", "gridX": 23, "gridY": 21, "elevation": 1.2, "rotationSteps": 0, "secondaryColor": metal_col},
                {"type": "sofa_single", "gridX": 20, "gridY": 21, "elevation": 1.2, "rotationSteps": 1, "primaryColor": "#fafaf9", "secondaryColor": metal_col},
                {"type": "sofa_single", "gridX": 25, "gridY": 21, "elevation": 1.2, "rotationSteps": 3, "primaryColor": "#fafaf9", "secondaryColor": metal_col},
                {"type": "wall_art", "gridX": 23, "gridY": 27, "elevation": 1.2, "rotationSteps": 0, "primaryColor": accent_col},
                {"type": "potted_plant", "gridX": 27, "gridY": 26, "elevation": 1.2, "rotationSteps": 0},
                {"type": "potted_plant", "gridX": 27, "gridY": 17, "elevation": 1.2, "rotationSteps": 0}
            ]

        return [
            {"type": "reception_desk", "gridX": 5, "gridY": 2, "elevation": 0.0, "rotationSteps": 0, "primaryColor": wood_col, "secondaryColor": metal_col},
            {"type": "bar_counter", "gridX": 1, "gridY": 5, "elevation": 0.6, "rotationSteps": 1, "primaryColor": sec_col, "secondaryColor": metal_col},
            {"type": "bar_counter", "gridX": 1, "gridY": 6, "elevation": 0.6, "rotationSteps": 1, "primaryColor": sec_col, "secondaryColor": metal_col},
            {"type": "bar_counter", "gridX": 1, "gridY": 7, "elevation": 0.6, "rotationSteps": 1, "primaryColor": sec_col, "secondaryColor": metal_col},
            {"type": "bar_stool", "gridX": 2, "gridY": 5, "elevation": 0.6, "rotationSteps": 3, "primaryColor": "#fafaf9", "secondaryColor": metal_col},
            {"type": "bar_stool", "gridX": 2, "gridY": 6, "elevation": 0.6, "rotationSteps": 3, "primaryColor": "#fafaf9", "secondaryColor": metal_col},
            {"type": "bar_stool", "gridX": 2, "gridY": 7, "elevation": 0.6, "rotationSteps": 3, "primaryColor": "#fafaf9", "secondaryColor": metal_col},
            {"type": "sofa_double", "gridX": 5, "gridY": 13, "elevation": 0.6, "rotationSteps": 2, "primaryColor": "#fafaf9", "secondaryColor": metal_col},
            {"type": "coffee_table", "gridX": 5, "gridY": 11, "elevation": 0.6, "rotationSteps": 0, "secondaryColor": metal_col},
            {"type": "sofa_single", "gridX": 3, "gridY": 11, "elevation": 0.6, "rotationSteps": 1, "primaryColor": "#c2410c", "secondaryColor": metal_col},
            {"type": "sofa_single", "gridX": 7, "gridY": 11, "elevation": 0.6, "rotationSteps": 3, "primaryColor": "#c2410c", "secondaryColor": metal_col},
            {"type": "curved_sofa", "gridX": 11, "gridY": 13, "elevation": 1.2, "rotationSteps": 2, "primaryColor": "#d97706", "secondaryColor": metal_col},
            {"type": "vip_table", "gridX": 12, "gridY": 11, "elevation": 1.2, "rotationSteps": 0, "secondaryColor": metal_col},
            {"type": "potted_plant", "gridX": 0, "gridY": 3, "elevation": 0.6, "rotationSteps": 0},
            {"type": "potted_plant", "gridX": 15, "gridY": 15, "elevation": 1.2, "rotationSteps": 0},
            {"type": "wall_art", "gridX": 6, "gridY": 15, "elevation": 0.6, "rotationSteps": 0, "primaryColor": sec_col},
            {"type": "wall_art", "gridX": 13, "gridY": 15, "elevation": 1.2, "rotationSteps": 0, "primaryColor": accent_col}
        ]

    def _setup_camera_and_render(self, w, d, ts, wh, rw, rh):
        scene = bpy.context.scene
        try:
            scene.render.engine = 'BLENDER_EEVEE'
        except Exception:
            try:
                scene.render.engine = 'BLENDER_EEVEE_NEXT'
            except Exception:
                pass

        scene.render.film_transparent = True
        scene.render.resolution_x = rw
        scene.render.resolution_y = rh
        scene.render.resolution_percentage = 100

        cam_data = bpy.data.cameras.new("GrandIsoCamera")
        cam_data.type = 'ORTHO'
        diag_span = (w + d) * ts * 0.70710678
        vertical_span = (diag_span * 0.5) + (wh * 1.5) + 1.2
        cam_data.ortho_scale = max(diag_span, vertical_span * 2.0) * 1.08
        cam_data.clip_start = 0.1
        cam_data.clip_end = 500.0

        cam_obj = bpy.data.objects.new("GrandIsoCamera", cam_data)
        scene.collection.objects.link(cam_obj)
        scene.camera = cam_obj

        rot_x = math.radians(60.0)
        rot_y = 0.0
        rot_z = math.radians(45.0)
        cam_obj.rotation_mode = 'XYZ'
        cam_obj.rotation_euler = (rot_x, rot_y, rot_z)

        cx = (w * ts) / 2.0
        cy = (d * ts) / 2.0
        cz = 0.7

        dist = 70.0
        cam_obj.location = (
            cx + dist * 0.6123724356957945,
            cy - dist * 0.6123724356957945,
            cz + dist * 0.5
        )

        return {
            "orthoScale": cam_data.ortho_scale,
            "rotationEuler": [round(rot_x, 4), round(rot_y, 4), round(rot_z, 4)],
            "location": [round(v, 4) for v in cam_obj.location]
        }

    def _setup_lighting(self, w, d, ts, wh, metal_col):
        cx = (w * ts) / 2.0
        cy = (d * ts) / 2.0

        world = bpy.context.scene.world
        if world and world.use_nodes:
            bg_node = world.node_tree.nodes.get("Background")
            if bg_node:
                bg_node.inputs["Color"].default_value = (0.96, 0.95, 0.93, 1.0)
                bg_node.inputs["Strength"].default_value = 0.45

        chand_x = 13.5 * ts
        chand_y = 8.5 * ts
        chand_z = wh + 0.60

        chand_data = bpy.data.lights.new(name="GrandChandelierLight", type='POINT')
        chand_data.energy = 950.0
        chand_data.color = (1.0, 0.96, 0.90)
        if hasattr(chand_data, "shadow_soft_size"):
            chand_data.shadow_soft_size = 0.35
        chand_data.use_shadow = True
        chand_obj = bpy.data.objects.new(name="GrandChandelierLight", object_data=chand_data)
        bpy.context.scene.collection.objects.link(chand_obj)
        chand_obj.location = (chand_x, chand_y, chand_z - 0.15)

        fixture_obj = self._create_chandelier_fixture("GrandChandelierFixture", chand_x, chand_y, chand_z, ts, metal_col)

        bar_data = bpy.data.lights.new(name="BarPendantLight", type='POINT')
        bar_data.energy = 60.0
        bar_data.color = (1.0, 0.93, 0.82)
        bar_data.use_shadow = False
        bar_obj = bpy.data.objects.new(name="BarPendantLight", object_data=bar_data)
        bpy.context.scene.collection.objects.link(bar_obj)
        bar_obj.location = (2.5 * ts, 10.0 * ts, 0.6 + wh * 0.8)

        vip_data = bpy.data.lights.new(name="VIPPendantLight", type='POINT')
        vip_data.energy = 80.0
        vip_data.color = (1.0, 0.94, 0.85)
        vip_data.use_shadow = False
        vip_obj = bpy.data.objects.new(name="VIPPendantLight", object_data=vip_data)
        bpy.context.scene.collection.objects.link(vip_obj)
        vip_obj.location = (23.0 * ts, 22.0 * ts, 1.2 + wh * 0.8)

        sun1_data = bpy.data.lights.new(name="StudioKeySun", type='SUN')
        sun1_data.energy = 1.0
        sun1_data.color = (1.0, 0.98, 0.95)
        sun1_data.use_shadow = False
        sun1_obj = bpy.data.objects.new(name="StudioKeySun", object_data=sun1_data)
        bpy.context.scene.collection.objects.link(sun1_obj)
        sun1_obj.location = (cx, cy, 20.0)
        sun1_obj.rotation_euler = (math.radians(58.0), math.radians(12.0), math.radians(-40.0))

        sun2_data = bpy.data.lights.new(name="StudioFillSun", type='SUN')
        sun2_data.energy = 0.7
        sun2_data.color = (0.92, 0.95, 1.0)
        sun2_data.use_shadow = False
        sun2_obj = bpy.data.objects.new(name="StudioFillSun", object_data=sun2_data)
        bpy.context.scene.collection.objects.link(sun2_obj)
        sun2_obj.location = (cx, cy, 20.0)
        sun2_obj.rotation_euler = (math.radians(65.0), math.radians(-20.0), math.radians(45.0))

        sun3_data = bpy.data.lights.new(name="StudioRimSun", type='SUN')
        sun3_data.energy = 0.5
        sun3_data.color = (1.0, 1.0, 1.0)
        sun3_data.use_shadow = False
        sun3_obj = bpy.data.objects.new(name="StudioRimSun", object_data=sun3_data)
        bpy.context.scene.collection.objects.link(sun3_obj)
        sun3_obj.location = (cx, cy, 20.0)
        sun3_obj.rotation_euler = (math.radians(40.0), math.radians(-30.0), math.radians(135.0))

        lights_meta = [
            {"name": "StudioKeySun", "type": "SUN", "energy": 1.0, "rotationEuler": [58.0, 12.0, -40.0]},
            {"name": "GrandChandelierLight", "type": "POINT", "energy": 950.0, "rotationEuler": [0.0, 0.0, 0.0]},
            {"name": "BarPendantLight", "type": "POINT", "energy": 60.0, "rotationEuler": [0.0, 0.0, 0.0]},
            {"name": "VIPPendantLight", "type": "POINT", "energy": 80.0, "rotationEuler": [0.0, 0.0, 0.0]}
        ]
        return lights_meta, [chand_obj, fixture_obj]

    def _create_chandelier_fixture(self, name, cx, cy, cz, ts, metal_col):
        mat_brass = self._create_toon_mat(f"{name}_Brass", metal_col, roughness=0.15, metallic=0.90)
        mat_glow = self._create_toon_mat(f"{name}_Glow", "#fffdf0", roughness=0.10, emission_color="#fffdf0", emission_strength=4.5)
        verts, faces, mat_indices = [], [], []

        stem_w = 0.03 * ts
        self._add_box(verts, faces, mat_indices, (cx - stem_w, cy - stem_w, cz - 0.40), (cx + stem_w, cy + stem_w, cz + 1.20), 0)

        r1 = 1.10 * ts
        w1 = 0.04 * ts
        h1 = 0.05 * ts
        z1 = cz - 0.10
        self._add_box(verts, faces, mat_indices, (cx - r1, cy - w1, z1), (cx + r1, cy + w1, z1 + h1), 0)
        self._add_box(verts, faces, mat_indices, (cx - w1, cy - r1, z1), (cx + w1, cy + r1, z1 + h1), 0)
        d1 = r1 * 0.7071
        self._add_box(verts, faces, mat_indices, (cx - d1 - w1, cy - d1 - w1, z1), (cx - d1 + w1, cy - d1 + w1, z1 + h1), 0)
        self._add_box(verts, faces, mat_indices, (cx + d1 - w1, cy - d1 - w1, z1), (cx + d1 + w1, cy - d1 + w1, z1 + h1), 0)
        self._add_box(verts, faces, mat_indices, (cx - d1 - w1, cy + d1 - w1, z1), (cx - d1 + w1, cy + d1 + w1, z1 + h1), 0)
        self._add_box(verts, faces, mat_indices, (cx + d1 - w1, cy + d1 - w1, z1), (cx + d1 + w1, cy + d1 + w1, z1 + h1), 0)

        r2 = 0.65 * ts
        w2 = 0.035 * ts
        h2 = 0.045 * ts
        z2 = cz - 0.32
        self._add_box(verts, faces, mat_indices, (cx - r2, cy - w2, z2), (cx + r2, cy + w2, z2 + h2), 0)
        self._add_box(verts, faces, mat_indices, (cx - w2, cy - r2, z2), (cx + w2, cy + r2, z2 + h2), 0)

        p_size = 0.045 * ts
        for angle_deg in (0, 45, 90, 135, 180, 225, 270, 315):
            rad = math.radians(angle_deg)
            px = cx + r1 * math.cos(rad)
            py = cy + r1 * math.sin(rad)
            self._add_box(verts, faces, mat_indices, (px - p_size, py - p_size, z1 - 0.06 * ts), (px + p_size, py + p_size, z1 + 0.06 * ts), 1)

        for angle_deg in (22.5, 112.5, 202.5, 292.5):
            rad = math.radians(angle_deg)
            px = cx + r2 * math.cos(rad)
            py = cy + r2 * math.sin(rad)
            self._add_box(verts, faces, mat_indices, (px - p_size * 0.9, py - p_size * 0.9, z2 - 0.05 * ts), (px + p_size * 0.9, py + p_size * 0.9, z2 + 0.05 * ts), 1)

        mesh = bpy.data.meshes.new(f"{name}_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.data.materials.append(mat_brass)
        obj.data.materials.append(mat_glow)
        for p_idx, m_idx in enumerate(mat_indices):
            obj.data.polygons[p_idx].material_index = m_idx
        obj.visible_shadow = False
        return obj

    def _build_layout_floors(self, grid, w, d, ts, col_light, col_dark, col_wood, floor_style, entry_tile, transition_tiles):
        objs = []
        nav_cells = []

        mat_slab = self._create_toon_mat("Floor_ArchSlab", "#ded9d2", roughness=0.38)
        mat_brass_strip = self._create_toon_mat("Floor_BrassStrip", "#c59b27", roughness=0.18, metallic=0.88)
        mat_carpet_field = self._create_toon_mat("Floor_CarpetField", "#1c2536", roughness=0.85)
        mat_carpet_border = self._create_toon_mat("Floor_CarpetBorder", "#161d2a", roughness=0.80)
        mat_carpet_gold = self._create_toon_mat("Floor_CarpetGold", "#d4af37", roughness=0.20, metallic=0.85)
        mat_carpet_medallion = self._create_toon_mat("Floor_CarpetMedallion", "#eae5dc", roughness=0.30)

        mat_parquet = self._create_toon_mat("Floor_Parquet", "#5c3d2e", roughness=0.32)
        mat_parquet_edge = self._create_toon_mat("Floor_ParquetEdge", "#3e281b", roughness=0.30)
        mat_bar_runner = self._create_toon_mat("Floor_BarRunner", "#232a36", roughness=0.60)

        mat_vip_carpet = self._create_toon_mat("Floor_VIPCarpet", "#182030", roughness=0.82)
        mat_vip_border = self._create_toon_mat("Floor_VIPBorder", "#c59b27", roughness=0.18, metallic=0.85)
        mat_riser = self._create_toon_mat("Floor_Riser", "#222938", roughness=0.45)

        mat_entry_mat = self._create_toon_mat("Floor_EntryMat", "#181e29", roughness=0.85)
        mat_entry_brass = self._create_toon_mat("Floor_EntryBrass", "#d4af37", roughness=0.18, metallic=0.88)
        mat_stanchion_brass = self._create_toon_mat("Floor_StanchionBrass", "#f59e0b", roughness=0.15, metallic=0.90)
        mat_stanchion_rope = self._create_toon_mat("Floor_StanchionRope", "#991b1b", roughness=0.75)
        mat_trans_plate = self._create_toon_mat("Floor_TransPlate", "#c59b27", roughness=0.20, metallic=0.85)

        entry_coords = (int(entry_tile.get("gridX", -1)), int(entry_tile.get("gridY", -1)))
        trans_coords = {(int(t.get("gridX", -1)), int(t.get("gridY", -1))) for t in transition_tiles}

        strip_gap = 0.012 * ts

        faces = [
            (0, 1, 2, 3),
            (7, 6, 5, 4),
            (0, 4, 5, 1),
            (1, 5, 6, 2),
            (2, 6, 7, 3),
            (3, 7, 4, 0),
        ]

        for y in range(d):
            for x in range(w):
                cell = grid[y][x]
                if cell is None or cell == 0:
                    continue

                if isinstance(cell, str) and "STAIR" in cell:
                    continue

                elev = 0.0
                if cell == 2:
                    elev = 0.6
                elif cell == 3:
                    elev = 1.2

                x0, y0 = x * ts, y * ts
                x1, y1 = (x + 1) * ts, (y + 1) * ts

                grout_verts = [
                    (x0, y0, elev - 0.02 * ts),
                    (x1, y0, elev - 0.02 * ts),
                    (x1, y1, elev - 0.02 * ts),
                    (x0, y1, elev - 0.02 * ts),
                    (x0, y0, -0.20),
                    (x1, y0, -0.20),
                    (x1, y1, -0.20),
                    (x0, y1, -0.20),
                ]
                mesh_grout = bpy.data.meshes.new(f"Grout_{x}_{y}_Mesh")
                mesh_grout.from_pydata(grout_verts, [], faces)
                mesh_grout.update()
                obj_grout = bpy.data.objects.new(f"Grout_{x}_{y}", mesh_grout)
                bpy.context.scene.collection.objects.link(obj_grout)
                obj_grout.data.materials.append(mat_brass_strip)
                objs.append(obj_grout)

                x0_t, x1_t = x0 + strip_gap, x1 - strip_gap
                y0_t, y1_t = y0 + strip_gap, y1 - strip_gap
                tile_bot = elev - 0.04 * ts

                tile_verts = [
                    (x0_t, y0_t, elev),
                    (x1_t, y0_t, elev),
                    (x1_t, y1_t, elev),
                    (x0_t, y1_t, elev),
                    (x0_t, y0_t, tile_bot),
                    (x1_t, y0_t, tile_bot),
                    (x1_t, y0_t, tile_bot),
                    (x0_t, y1_t, tile_bot),
                ]
                mesh_tile = bpy.data.meshes.new(f"Tile_{x}_{y}_Mesh")
                mesh_tile.from_pydata(tile_verts, [], faces)
                mesh_tile.update()
                obj = bpy.data.objects.new(f"Tile_{x}_{y}", mesh_tile)
                bpy.context.scene.collection.objects.link(obj)

                bev = obj.modifiers.new("TileBevel", 'BEVEL')
                bev.width = 0.008 * ts
                bev.segments = 2

                is_entry = (x, y) == entry_coords
                is_trans = (x, y) in trans_coords

                is_in_lounge_carpet = (cell == 1) and (6 <= x <= 20) and (4 <= y <= 12)
                is_carpet_border = is_in_lounge_carpet and (x in (6, 20) or y in (4, 12))
                is_carpet_medallion = is_in_lounge_carpet and (11 <= x <= 15) and (6 <= y <= 10)

                if is_entry:
                    obj.data.materials.append(mat_entry_mat)
                    objs.append(obj)

                    th_verts, th_faces, th_mats = [], [], []
                    self._add_box(th_verts, th_faces, th_mats, (x0, y0, elev), (x1, y0 + 0.05 * ts, elev + 0.015 * ts), 0)
                    self._add_box(th_verts, th_faces, th_mats, (x0, y1 - 0.05 * ts, elev), (x1, y1, elev + 0.015 * ts), 0)
                    self._add_box(th_verts, th_faces, th_mats, (x0, y0, elev), (x0 + 0.05 * ts, y1, elev + 0.015 * ts), 0)
                    self._add_box(th_verts, th_faces, th_mats, (x1 - 0.05 * ts, y0, elev), (x1, y1, elev + 0.015 * ts), 0)
                    mesh_th = bpy.data.meshes.new(f"Entry_Threshold_{x}_{y}_Mesh")
                    mesh_th.from_pydata(th_verts, [], th_faces)
                    mesh_th.update()
                    obj_th = bpy.data.objects.new(f"Entry_Threshold_{x}_{y}", mesh_th)
                    bpy.context.scene.collection.objects.link(obj_th)
                    obj_th.data.materials.append(mat_entry_brass)
                    objs.append(obj_th)

                    mat_lantern = self._create_toon_mat("Entry_LanternGlow", "#fffdf0", roughness=0.10, emission_color="#fffdf0", emission_strength=4.0)
                    door_obj = self._create_grand_entrance_doorway(
                        f"GrandEntrance_{x}_{y}",
                        x0 - 1.0 * ts,
                        x1 + 1.0 * ts,
                        y0,
                        elev,
                        ts,
                        2.4,
                        mat_parquet,
                        mat_carpet_gold,
                        self._create_glass_mat("Entry_DoorGlass"),
                        mat_entry_brass,
                        mat_lantern,
                        mat_slab
                    )
                    objs.append(door_obj)

                    stanch_obj = self._create_entrance_stanchions(f"Entry_Stanchions_{x}_{y}", x0, x1, y0, elev, ts, mat_stanchion_brass, mat_stanchion_rope)
                    objs.append(stanch_obj)

                    nav_cells.append({
                        "gridX": x,
                        "gridY": y,
                        "elevation": elev,
                        "walkable": True,
                        "tileType": "entry"
                    })
                elif is_trans:
                    obj.data.materials.append(mat_trans_plate)
                    objs.append(obj)

                    chevron_verts, chevron_faces, chevron_mats = [], [], []
                    self._add_box(chevron_verts, chevron_faces, chevron_mats, (x0 + 0.1 * ts, y0 + 0.1 * ts, elev), (x1 - 0.1 * ts, y1 - 0.1 * ts, elev + 0.02 * ts), 0)
                    mesh_chev = bpy.data.meshes.new(f"Trans_Plate_{x}_{y}_Mesh")
                    mesh_chev.from_pydata(chevron_verts, [], chevron_faces)
                    mesh_chev.update()
                    obj_chev = bpy.data.objects.new(f"Trans_Plate_{x}_{y}", mesh_chev)
                    bpy.context.scene.collection.objects.link(obj_chev)
                    obj_chev.data.materials.append(mat_trans_plate)
                    objs.append(obj_chev)

                    nav_cells.append({
                        "gridX": x,
                        "gridY": y,
                        "elevation": elev,
                        "walkable": True,
                        "tileType": "transition"
                    })
                elif is_carpet_border:
                    obj.data.materials.append(mat_carpet_border)
                    objs.append(obj)

                    cab_verts, cab_faces, cab_mats = [], [], []
                    self._add_box(cab_verts, cab_faces, cab_mats, (x0_t + 0.06 * ts, y0_t + 0.06 * ts, elev), (x1_t - 0.06 * ts, y1_t - 0.06 * ts, elev + 0.008 * ts), 0)
                    mesh_cab = bpy.data.meshes.new(f"BorderGold_{x}_{y}_Mesh")
                    mesh_cab.from_pydata(cab_verts, [], cab_faces)
                    mesh_cab.update()
                    obj_cab = bpy.data.objects.new(f"BorderGold_{x}_{y}", mesh_cab)
                    bpy.context.scene.collection.objects.link(obj_cab)
                    obj_cab.data.materials.append(mat_carpet_gold)
                    objs.append(obj_cab)

                    nav_cells.append({
                        "gridX": x,
                        "gridY": y,
                        "elevation": elev,
                        "walkable": True,
                        "tileType": "level_1"
                    })
                elif is_carpet_medallion:
                    obj.data.materials.append(mat_carpet_medallion)
                    objs.append(obj)

                    med_verts, med_faces, med_mats = [], [], []
                    self._add_box(med_verts, med_faces, med_mats, (x0_t + 0.12 * ts, y0_t + 0.12 * ts, elev), (x1_t - 0.12 * ts, y1_t - 0.12 * ts, elev + 0.006 * ts), 0)
                    mesh_med = bpy.data.meshes.new(f"MedallionGold_{x}_{y}_Mesh")
                    mesh_med.from_pydata(med_verts, [], med_faces)
                    mesh_med.update()
                    obj_med = bpy.data.objects.new(f"MedallionGold_{x}_{y}", mesh_med)
                    bpy.context.scene.collection.objects.link(obj_med)
                    obj_med.data.materials.append(mat_carpet_gold)
                    objs.append(obj_med)

                    nav_cells.append({
                        "gridX": x,
                        "gridY": y,
                        "elevation": elev,
                        "walkable": True,
                        "tileType": "level_1"
                    })
                elif is_in_lounge_carpet:
                    obj.data.materials.append(mat_carpet_field)
                    objs.append(obj)

                    nav_cells.append({
                        "gridX": x,
                        "gridY": y,
                        "elevation": elev,
                        "walkable": True,
                        "tileType": "level_1"
                    })
                else:
                    if cell == 1:
                        chosen_mat = mat_slab
                    elif cell == 2:
                        is_mezz_edge = (x == 6 and 4 <= y <= 15) or (y == 16 and 7 <= x <= 17) or (x == 23 and 4 <= y <= 15)
                        is_bar_zone = (1 <= x <= 3 and 7 <= y <= 13)
                        if is_bar_zone:
                            chosen_mat = mat_bar_runner
                        elif is_mezz_edge:
                            chosen_mat = mat_parquet_edge
                        else:
                            chosen_mat = mat_parquet
                    else:
                        is_vip_edge = (x in (18, 27) or y in (16, 27))
                        chosen_mat = mat_vip_border if is_vip_edge else mat_vip_carpet

                    obj.data.materials.append(chosen_mat)
                    objs.append(obj)

                    nav_cells.append({
                        "gridX": x,
                        "gridY": y,
                        "elevation": elev,
                        "walkable": True,
                        "tileType": f"level_{cell}"
                    })

                if y > 0:
                    south_cell = grid[y - 1][x]
                    south_elev = self._get_cell_elevation(south_cell)
                    if elev > south_elev and not (isinstance(south_cell, str) and "STAIR" in south_cell):
                        riser = self._create_vertical_riser(f"Riser_S_{x}_{y}", (x0, y0), (x1, y0), south_elev, elev, mat_riser)
                        objs.append(riser)

                if x < w - 1:
                    east_cell = grid[y][x + 1]
                    east_elev = self._get_cell_elevation(east_cell)
                    if elev > east_elev and not (isinstance(east_cell, str) and "STAIR" in east_cell):
                        riser = self._create_vertical_riser(f"Riser_E_{x}_{y}", (x1, y0), (x1, y1), east_elev, elev, mat_riser)
                        objs.append(riser)

        return objs, nav_cells

    def _build_perimeter_walls(self, grid, w, d, ts, wh, col_wall, col_trim, col_wood, transition_tiles):
        objs = []
        col_wall_upper = "#ded9d2"
        col_wainscot = "#382417"
        col_trim = "#c59b27"
        mat_wall = self._create_toon_mat("Perimeter_WallUpper", col_wall_upper, roughness=0.42)
        mat_wainscot = self._create_toon_mat("Perimeter_Wainscot", col_wainscot, roughness=0.30)
        mat_trim = self._create_toon_mat("Perimeter_Trim", col_trim, roughness=0.18, metallic=0.88)
        mat_glass = self._create_glass_mat("Portal_Glass")
        mat_brass = self._create_toon_mat("Portal_Brass", col_trim, roughness=0.18, metallic=0.88)
        mat_sconce = self._create_toon_mat("Wall_Sconce_Mat", "#fffdf0", roughness=0.10, emission_color="#fffdf0", emission_strength=3.5)

        thick = 0.15 * ts
        chair_rail_h = 0.05
        cornice_h = 0.10
        z_ceiling = 1.2 + wh
        z_chair_rail = 2.05

        trans_coords = {(int(t.get("gridX", -1)), int(t.get("gridY", -1))) for t in transition_tiles}

        for y in range(d):
            for x in range(w):
                cell = grid[y][x]
                if cell is None or cell == 0:
                    continue

                elev = self._get_cell_elevation(cell)
                x0, y0 = x * ts, y * ts
                x1, y1 = (x + 1) * ts, (y + 1) * ts

                is_north_boundary = (y == d - 1) or (grid[y + 1][x] is None) or (grid[y + 1][x] == 0)
                if is_north_boundary:
                    is_trans = (x, y) in trans_coords
                    if is_trans:
                        portal_obj = self._create_doorway_portal(f"Portal_N_{x}_{y}", x0, x1, y1, elev, ts, wh, mat_trim, mat_glass, mat_brass, mat_wainscot)
                        portal_obj.visible_shadow = False
                        objs.append(portal_obj)

                        door_top = z_chair_rail
                        lw_verts, lw_faces, lw_mats = [], [], []
                        self._add_box(lw_verts, lw_faces, lw_mats, (x0, y1, door_top), (x1, y1 + thick, z_ceiling - cornice_h), 0)
                        self._add_box(lw_verts, lw_faces, lw_mats, (x0, y1 - 0.02 * ts, z_ceiling - cornice_h), (x1, y1 + thick, z_ceiling), 2)
                        mesh_lw = bpy.data.meshes.new(f"WallLintel_N_{x}_{y}_Mesh")
                        mesh_lw.from_pydata(lw_verts, [], lw_faces)
                        mesh_lw.update()
                        obj_lw = bpy.data.objects.new(f"WallLintel_N_{x}_{y}", mesh_lw)
                        bpy.context.scene.collection.objects.link(obj_lw)
                        obj_lw.data.materials.append(mat_wall)
                        obj_lw.data.materials.append(mat_wainscot)
                        obj_lw.data.materials.append(mat_trim)
                        for p_idx, m_idx in enumerate(lw_mats):
                            obj_lw.data.polygons[p_idx].material_index = m_idx
                        objs.append(obj_lw)
                    else:
                        w_verts, w_faces, w_mats = [], [], []

                        self._add_box(w_verts, w_faces, w_mats, (x0, y1, elev), (x1, y1 + thick, z_chair_rail), 1)
                        self._add_box(w_verts, w_faces, w_mats, (x0 + 0.04 * ts, y1 - 0.012 * ts, elev + 0.10 * ts), (x1 - 0.04 * ts, y1, z_chair_rail - 0.08 * ts), 1)

                        self._add_box(w_verts, w_faces, w_mats, (x0, y1 - 0.015 * ts, z_chair_rail), (x1, y1 + thick, z_chair_rail + chair_rail_h), 2)

                        self._add_box(w_verts, w_faces, w_mats, (x0, y1, z_chair_rail + chair_rail_h), (x1, y1 + thick, z_ceiling - cornice_h), 0)

                        self._add_box(w_verts, w_faces, w_mats, (x0, y1 - 0.02 * ts, z_ceiling - cornice_h), (x1, y1 + thick, z_ceiling), 2)

                        if x % 4 == 0:
                            self._add_box(w_verts, w_faces, w_mats, (x0 - 0.04 * ts, y1 - 0.035 * ts, elev), (x0 + 0.08 * ts, y1, z_ceiling), 1)
                            self._add_box(w_verts, w_faces, w_mats, (x0 - 0.05 * ts, y1 - 0.045 * ts, elev), (x0 + 0.09 * ts, y1, elev + 0.25 * ts), 1)
                            self._add_box(w_verts, w_faces, w_mats, (x0 - 0.05 * ts, y1 - 0.045 * ts, z_ceiling - 0.20 * ts), (x0 + 0.09 * ts, y1, z_ceiling - 0.08 * ts), 2)
                            self._add_box(w_verts, w_faces, w_mats, (x0, y1 - 0.045 * ts, z_chair_rail + 0.35), (x0 + 0.04 * ts, y1 - 0.035 * ts, z_chair_rail + 0.65), 2)
                            self._add_box(w_verts, w_faces, w_mats, (x0 - 0.02 * ts, y1 - 0.055 * ts, z_chair_rail + 0.40), (x0 + 0.06 * ts, y1 - 0.035 * ts, z_chair_rail + 0.60), 3)

                        mesh = bpy.data.meshes.new(f"WallArch_N_{x}_{y}_Mesh")
                        mesh.from_pydata(w_verts, [], w_faces)
                        mesh.update()
                        obj = bpy.data.objects.new(f"WallArch_N_{x}_{y}", mesh)
                        bpy.context.scene.collection.objects.link(obj)
                        obj.data.materials.append(mat_wall)
                        obj.data.materials.append(mat_wainscot)
                        obj.data.materials.append(mat_trim)
                        obj.data.materials.append(mat_sconce)

                        for p_idx, m_idx in enumerate(w_mats):
                            obj.data.polygons[p_idx].material_index = m_idx

                        self._apply_outline(obj, 0.003)
                        objs.append(obj)

                    if x == 18:
                        trans_verts, trans_faces, trans_mats = [], [], []
                        self._add_box(trans_verts, trans_faces, trans_mats, (x0 - 0.06 * ts, y1 - 0.045 * ts, 0.6), (x0 + 0.06 * ts, y1 + thick, z_ceiling), 1)
                        self._add_box(trans_verts, trans_faces, trans_mats, (x0 - 0.07 * ts, y1 - 0.055 * ts, 0.6), (x0 + 0.07 * ts, y1 + thick, 0.6 + 0.25 * ts), 1)
                        self._add_box(trans_verts, trans_faces, trans_mats, (x0 - 0.07 * ts, y1 - 0.055 * ts, z_ceiling - 0.20 * ts), (x0 + 0.07 * ts, y1 + thick, z_ceiling - 0.08 * ts), 2)
                        mesh_tp = bpy.data.meshes.new("WallTransPilaster_N_Mesh")
                        mesh_tp.from_pydata(trans_verts, [], trans_faces)
                        mesh_tp.update()
                        obj_tp = bpy.data.objects.new("WallTransPilaster_N", mesh_tp)
                        bpy.context.scene.collection.objects.link(obj_tp)
                        obj_tp.data.materials.append(mat_wall)
                        obj_tp.data.materials.append(mat_wainscot)
                        obj_tp.data.materials.append(mat_trim)
                        for p_idx, m_idx in enumerate(trans_mats):
                            obj_tp.data.polygons[p_idx].material_index = m_idx
                        objs.append(obj_tp)

                    if x == w - 1:
                        term_verts, term_faces, term_mats = [], [], []
                        self._add_box(term_verts, term_faces, term_mats, (x1 - 0.02 * ts, y1 - thick, elev), (x1 + thick, y1 + thick, z_ceiling), 1)
                        self._add_box(term_verts, term_faces, term_mats, (x1 - 0.03 * ts, y1 - thick - 0.02 * ts, elev), (x1 + thick + 0.02 * ts, y1 + thick, elev + 0.25 * ts), 1)
                        self._add_box(term_verts, term_faces, term_mats, (x1 - 0.03 * ts, y1 - thick - 0.02 * ts, z_ceiling - 0.20 * ts), (x1 + thick + 0.02 * ts, y1 + thick, z_ceiling - 0.08 * ts), 2)
                        mesh_tm = bpy.data.meshes.new("WallEastTerminal_Mesh")
                        mesh_tm.from_pydata(term_verts, [], term_faces)
                        mesh_tm.update()
                        obj_tm = bpy.data.objects.new("WallEastTerminal", mesh_tm)
                        bpy.context.scene.collection.objects.link(obj_tm)
                        obj_tm.data.materials.append(mat_wall)
                        obj_tm.data.materials.append(mat_wainscot)
                        obj_tm.data.materials.append(mat_trim)
                        for p_idx, m_idx in enumerate(term_mats):
                            obj_tm.data.polygons[p_idx].material_index = m_idx
                        objs.append(obj_tm)

                is_west_boundary = (x == 0) or (grid[y][x - 1] is None) or (grid[y][x - 1] == 0)
                if is_west_boundary:
                    w_verts, w_faces, w_mats = [], [], []

                    self._add_box(w_verts, w_faces, w_mats, (x0 - thick, y0, elev), (x0, y1, z_chair_rail), 1)
                    self._add_box(w_verts, w_faces, w_mats, (x0, y0 + 0.04 * ts, elev + 0.10 * ts), (x0 + 0.012 * ts, y1 - 0.04 * ts, z_chair_rail - 0.08 * ts), 1)

                    self._add_box(w_verts, w_faces, w_mats, (x0 - thick, y0, z_chair_rail), (x0 + 0.015 * ts, y1, z_chair_rail + chair_rail_h), 2)

                    self._add_box(w_verts, w_faces, w_mats, (x0 - thick, y0, z_chair_rail + chair_rail_h), (x0, y1, z_ceiling - cornice_h), 0)

                    self._add_box(w_verts, w_faces, w_mats, (x0 - thick, y0, z_ceiling - cornice_h), (x0 + 0.02 * ts, y1, z_ceiling), 2)

                    if y % 4 == 0:
                        self._add_box(w_verts, w_faces, w_mats, (x0 - thick, y0 - 0.04 * ts, elev), (x0 + 0.035 * ts, y0 + 0.08 * ts, z_ceiling), 1)
                        self._add_box(w_verts, w_faces, w_mats, (x0 - thick, y0 - 0.05 * ts, elev), (x0 + 0.045 * ts, y0 + 0.09 * ts, elev + 0.25 * ts), 1)
                        self._add_box(w_verts, w_faces, w_mats, (x0 - thick, y0 - 0.05 * ts, z_ceiling - 0.20 * ts), (x0 + 0.045 * ts, y0 + 0.09 * ts, z_ceiling - 0.08 * ts), 2)
                        self._add_box(w_verts, w_faces, w_mats, (x0, y0 - 0.045 * ts, z_chair_rail + 0.35), (x0 + 0.035 * ts, y0 + 0.04 * ts, z_chair_rail + 0.65), 2)
                        self._add_box(w_verts, w_faces, w_mats, (x0 + 0.035 * ts, y0 - 0.02 * ts, z_chair_rail + 0.40), (x0 + 0.055 * ts, y0 + 0.06 * ts, z_chair_rail + 0.60), 3)

                    mesh = bpy.data.meshes.new(f"WallArch_W_{x}_{y}_Mesh")
                    mesh.from_pydata(w_verts, [], w_faces)
                    mesh.update()
                    obj = bpy.data.objects.new(f"WallArch_W_{x}_{y}", mesh)
                    bpy.context.scene.collection.objects.link(obj)
                    obj.data.materials.append(mat_wall)
                    obj.data.materials.append(mat_wainscot)
                    obj.data.materials.append(mat_trim)
                    obj.data.materials.append(mat_sconce)

                    for p_idx, m_idx in enumerate(w_mats):
                        obj.data.polygons[p_idx].material_index = m_idx

                    self._apply_outline(obj, 0.003)
                    objs.append(obj)

                    if y == 0:
                        sw_verts, sw_faces, sw_mats = [], [], []
                        self._add_box(sw_verts, sw_faces, sw_mats, (x0 - thick, y0 - thick, elev), (x0 + thick, y0 + 0.02 * ts, z_ceiling), 1)
                        self._add_box(sw_verts, sw_faces, sw_mats, (x0 - thick - 0.02 * ts, y0 - thick - 0.02 * ts, elev), (x0 + thick + 0.02 * ts, y0 + 0.03 * ts, elev + 0.25 * ts), 1)
                        self._add_box(sw_verts, sw_faces, sw_mats, (x0 - thick - 0.02 * ts, y0 - thick - 0.02 * ts, z_ceiling - 0.20 * ts), (x0 + thick + 0.02 * ts, y0 + 0.03 * ts, z_ceiling - 0.08 * ts), 2)
                        mesh_sw = bpy.data.meshes.new("WallSouthTerminal_Mesh")
                        mesh_sw.from_pydata(sw_verts, [], sw_faces)
                        mesh_sw.update()
                        obj_sw = bpy.data.objects.new("WallSouthTerminal", mesh_sw)
                        bpy.context.scene.collection.objects.link(obj_sw)
                        obj_sw.data.materials.append(mat_wall)
                        obj_sw.data.materials.append(mat_wainscot)
                        obj_sw.data.materials.append(mat_trim)
                        for p_idx, m_idx in enumerate(sw_mats):
                            obj_sw.data.polygons[p_idx].material_index = m_idx
                        objs.append(obj_sw)

        return objs

    def _build_layout_stairs(self, grid, w, d, ts, col_wood, col_trim):
        objs = []
        nav_cells = []
        mat_tread = self._create_toon_mat("Stair_TreadMat", "#5c3d2e", roughness=0.30)
        mat_riser = self._create_toon_mat("Stair_RiserMat", "#222938", roughness=0.45)
        mat_brass = self._create_toon_mat("Stair_BrassMat", "#c59b27", roughness=0.15, metallic=0.90)

        for y in range(d):
            for x in range(w):
                cell = grid[y][x]
                if not (isinstance(cell, str) and "STAIR" in cell):
                    continue

                if "N" in cell:
                    bottom_elev = self._get_cell_elevation(grid[max(0, y - 1)][x])
                    top_elev = self._get_cell_elevation(grid[min(d - 1, y + 1)][x])
                else:
                    bottom_elev = self._get_cell_elevation(grid[y][max(0, x - 1)])
                    top_elev = self._get_cell_elevation(grid[y][min(w - 1, x + 1)])

                if top_elev <= bottom_elev:
                    top_elev = bottom_elev + 0.6

                steps = 4
                step_h = (top_elev - bottom_elev) / float(steps)
                step_d = ts / float(steps)
                tread_thick = 0.035 * ts
                overhang = 0.030 * ts
                brass_w = 0.025 * ts
                brass_t = 0.015 * ts

                faces = [
                    (0, 3, 2, 1),
                    (4, 5, 6, 7),
                    (0, 1, 5, 4),
                    (1, 2, 6, 5),
                    (2, 3, 7, 6),
                    (3, 0, 4, 7),
                ]

                for s in range(steps):
                    cur_base = bottom_elev + s * step_h
                    cur_top = bottom_elev + (s + 1) * step_h

                    if "N" in cell:
                        sy0 = (y * ts) + (s * step_d)
                        sy1 = sy0 + step_d

                        riser_verts = [
                            (x * ts, sy0, cur_base),
                            ((x + 1) * ts, sy0, cur_base),
                            ((x + 1) * ts, sy0 + 0.02 * ts, cur_base),
                            (x * ts, sy0 + 0.02 * ts, cur_base),
                            (x * ts, sy0, cur_top - tread_thick),
                            ((x + 1) * ts, sy0, cur_top - tread_thick),
                            ((x + 1) * ts, sy0 + 0.02 * ts, cur_top - tread_thick),
                            (x * ts, sy0 + 0.02 * ts, cur_top - tread_thick),
                        ]
                        mesh_riser = bpy.data.meshes.new(f"Riser_{x}_{y}_{s}_Mesh")
                        mesh_riser.from_pydata(riser_verts, [], faces)
                        mesh_riser.update()
                        obj_riser = bpy.data.objects.new(f"Riser_{x}_{y}_{s}", mesh_riser)
                        bpy.context.scene.collection.objects.link(obj_riser)
                        obj_riser.data.materials.append(mat_riser)
                        objs.append(obj_riser)

                        tread_sy0 = sy0 - (overhang if s > 0 else 0.0)
                        tread_verts = [
                            (x * ts, tread_sy0, cur_top - tread_thick),
                            ((x + 1) * ts, tread_sy0, cur_top - tread_thick),
                            ((x + 1) * ts, sy1, cur_top - tread_thick),
                            (x * ts, sy1, cur_top - tread_thick),
                            (x * ts, tread_sy0, cur_top),
                            ((x + 1) * ts, tread_sy0, cur_top),
                            ((x + 1) * ts, sy1, cur_top),
                            (x * ts, sy1, cur_top),
                        ]
                        mesh_tread = bpy.data.meshes.new(f"Tread_{x}_{y}_{s}_Mesh")
                        mesh_tread.from_pydata(tread_verts, [], faces)
                        mesh_tread.update()
                        obj_tread = bpy.data.objects.new(f"Tread_{x}_{y}_{s}", mesh_tread)
                        bpy.context.scene.collection.objects.link(obj_tread)
                        obj_tread.data.materials.append(mat_tread)
                        bev = obj_tread.modifiers.new("TreadBevel", 'BEVEL')
                        bev.width = 0.008 * ts
                        bev.segments = 2
                        self._apply_outline(obj_tread, 0.002 * ts)
                        objs.append(obj_tread)

                        brass_verts = [
                            (x * ts, tread_sy0, cur_top - brass_t),
                            ((x + 1) * ts, tread_sy0, cur_top - brass_t),
                            ((x + 1) * ts, tread_sy0 + brass_w, cur_top - brass_t),
                            (x * ts, tread_sy0 + brass_w, cur_top - brass_t),
                            (x * ts, tread_sy0, cur_top + 0.002 * ts),
                            ((x + 1) * ts, tread_sy0, cur_top + 0.002 * ts),
                            ((x + 1) * ts, tread_sy0 + brass_w, cur_top + 0.002 * ts),
                            (x * ts, tread_sy0 + brass_w, cur_top + 0.002 * ts),
                        ]
                        mesh_brass = bpy.data.meshes.new(f"Brass_{x}_{y}_{s}_Mesh")
                        mesh_brass.from_pydata(brass_verts, [], faces)
                        mesh_brass.update()
                        obj_brass = bpy.data.objects.new(f"Brass_{x}_{y}_{s}", mesh_brass)
                        bpy.context.scene.collection.objects.link(obj_brass)
                        obj_brass.data.materials.append(mat_brass)
                        objs.append(obj_brass)

                    else:
                        sx0 = (x * ts) + (s * step_d)
                        sx1 = sx0 + step_d

                        riser_verts = [
                            (sx0, y * ts, cur_base),
                            (sx0 + 0.02 * ts, y * ts, cur_base),
                            (sx0 + 0.02 * ts, (y + 1) * ts, cur_base),
                            (sx0, (y + 1) * ts, cur_base),
                            (sx0, y * ts, cur_top - tread_thick),
                            (sx0 + 0.02 * ts, y * ts, cur_top - tread_thick),
                            (sx0 + 0.02 * ts, (y + 1) * ts, cur_top - tread_thick),
                            (sx0, (y + 1) * ts, cur_top - tread_thick),
                        ]
                        mesh_riser = bpy.data.meshes.new(f"Riser_{x}_{y}_{s}_Mesh")
                        mesh_riser.from_pydata(riser_verts, [], faces)
                        mesh_riser.update()
                        obj_riser = bpy.data.objects.new(f"Riser_{x}_{y}_{s}", mesh_riser)
                        bpy.context.scene.collection.objects.link(obj_riser)
                        obj_riser.data.materials.append(mat_riser)
                        objs.append(obj_riser)

                        tread_sx0 = sx0 - (overhang if s > 0 else 0.0)
                        tread_verts = [
                            (tread_sx0, y * ts, cur_top - tread_thick),
                            (sx1, y * ts, cur_top - tread_thick),
                            (sx1, (y + 1) * ts, cur_top - tread_thick),
                            (tread_sx0, (y + 1) * ts, cur_top - tread_thick),
                            (tread_sx0, y * ts, cur_top),
                            (sx1, y * ts, cur_top),
                            (sx1, (y + 1) * ts, cur_top),
                            (tread_sx0, (y + 1) * ts, cur_top),
                        ]
                        mesh_tread = bpy.data.meshes.new(f"Tread_{x}_{y}_{s}_Mesh")
                        mesh_tread.from_pydata(tread_verts, [], faces)
                        mesh_tread.update()
                        obj_tread = bpy.data.objects.new(f"Tread_{x}_{y}_{s}", mesh_tread)
                        bpy.context.scene.collection.objects.link(obj_tread)
                        obj_tread.data.materials.append(mat_tread)
                        bev = obj_tread.modifiers.new("TreadBevel", 'BEVEL')
                        bev.width = 0.008 * ts
                        bev.segments = 2
                        self._apply_outline(obj_tread, 0.002 * ts)
                        objs.append(obj_tread)

                        brass_verts = [
                            (tread_sx0, y * ts, cur_top - brass_t),
                            (tread_sx0 + brass_w, y * ts, cur_top - brass_t),
                            (tread_sx0 + brass_w, (y + 1) * ts, cur_top - brass_t),
                            (tread_sx0, (y + 1) * ts, cur_top - brass_t),
                            (tread_sx0, y * ts, cur_top + 0.002 * ts),
                            (tread_sx0 + brass_w, y * ts, cur_top + 0.002 * ts),
                            (tread_sx0 + brass_w, (y + 1) * ts, cur_top + 0.002 * ts),
                            (tread_sx0, (y + 1) * ts, cur_top + 0.002 * ts),
                        ]
                        mesh_brass = bpy.data.meshes.new(f"Brass_{x}_{y}_{s}_Mesh")
                        mesh_brass.from_pydata(brass_verts, [], faces)
                        mesh_brass.update()
                        obj_brass = bpy.data.objects.new(f"Brass_{x}_{y}_{s}", mesh_brass)
                        bpy.context.scene.collection.objects.link(obj_brass)
                        obj_brass.data.materials.append(mat_brass)
                        objs.append(obj_brass)

                nav_cells.append({
                    "gridX": x,
                    "gridY": y,
                    "elevation": (bottom_elev + top_elev) / 2.0,
                    "walkable": True,
                    "tileType": "stair_n" if "N" in cell else "stair_e"
                })

        return objs, nav_cells

    def _build_safety_railings(self, grid, w, d, ts, metal_col, entry_tile, transition_tiles):
        objs = []
        mat_glass = self._create_glass_mat("Railing_Glass")
        mat_metal = self._create_toon_mat("Railing_Metal", metal_col, roughness=0.18, metallic=0.88)
        rail_h = 0.55

        entry_coords = (int(entry_tile.get("gridX", -1)), int(entry_tile.get("gridY", -1)))
        trans_coords = {(int(t.get("gridX", -1)), int(t.get("gridY", -1))) for t in transition_tiles}

        for y in range(d):
            for x in range(w):
                cell = grid[y][x]
                if cell is None or cell == 0 or (isinstance(cell, str) and "STAIR" in cell):
                    continue

                elev = self._get_cell_elevation(cell)
                if elev < 0.5:
                    continue

                if (x, y) == entry_coords or (x, y) in trans_coords:
                    continue

                x0, y0 = x * ts, y * ts
                x1, y1 = (x + 1) * ts, (y + 1) * ts

                if y > 0:
                    south_cell = grid[y - 1][x]
                    south_elev = self._get_cell_elevation(south_cell)
                    is_stair = (isinstance(south_cell, str) and "STAIR" in south_cell)
                    is_stair_landing = is_stair and ("N" in south_cell)
                    if not is_stair_landing and not is_stair and south_elev < elev - 0.2:
                        railing = self._create_railing_segment(f"Rail_S_{x}_{y}", (x0, y0), (x1, y0), elev, rail_h, mat_glass, mat_metal)
                        objs.append(railing)

                if x < w - 1:
                    east_cell = grid[y][x + 1]
                    east_elev = self._get_cell_elevation(east_cell)
                    is_stair = (isinstance(east_cell, str) and "STAIR" in east_cell)
                    is_stair_approach = is_stair and ("E" in east_cell)
                    if not is_stair_approach and not is_stair and east_elev < elev - 0.2:
                        railing = self._create_railing_segment(f"Rail_E_{x}_{y}", (x1, y0), (x1, y1), elev, rail_h, mat_glass, mat_metal)
                        objs.append(railing)

                if y < d - 1:
                    north_cell = grid[y + 1][x]
                    north_elev = self._get_cell_elevation(north_cell)
                    is_stair = (isinstance(north_cell, str) and "STAIR" in north_cell)
                    is_stair_approach = is_stair and ("N" in north_cell)
                    if not is_stair_approach and not is_stair and north_elev < elev - 0.2:
                        railing = self._create_railing_segment(f"Rail_N_{x}_{y}", (x0, y1), (x1, y1), elev, rail_h, mat_glass, mat_metal)
                        objs.append(railing)

                if x > 0:
                    west_cell = grid[y][x - 1]
                    west_elev = self._get_cell_elevation(west_cell)
                    is_stair = (isinstance(west_cell, str) and "STAIR" in west_cell)
                    is_stair_landing = is_stair and ("E" in west_cell)
                    if not is_stair_landing and not is_stair and west_elev < elev - 0.2:
                        railing = self._create_railing_segment(f"Rail_W_{x}_{y}", (x0, y0), (x0, y1), elev, rail_h, mat_glass, mat_metal)
                        objs.append(railing)

        return objs

    def _build_grand_furniture(self, items, ts, accent_col, sec_col, metal_col, wood_col):
        objs = []
        seats = []
        occupied_cells = set()
        spatial_boxes = []

        for i, item in enumerate(items):
            ftype = item.get("type", "sofa_single")
            gx = float(item.get("gridX", 0))
            gy = float(item.get("gridY", 0))
            elev = float(item.get("elevation", 0.0))
            rot_step = int(item.get("rotationSteps", 0))
            prim_col = item.get("primaryColor", accent_col)
            s_col = item.get("secondaryColor", metal_col)

            tiles_len = 1.0
            tiles_wid = 1.0
            if ftype in ("sofa_double", "reception_desk", "centerpiece"):
                tiles_len = 2.0
            elif ftype in ("curved_sofa", "dj_booth"):
                tiles_len = 3.0

            if ftype == "centerpiece":
                tiles_wid = 2.0

            if rot_step in (1, 3):
                span_x = tiles_wid
                span_y = tiles_len
            else:
                span_x = tiles_len
                span_y = tiles_wid

            wx = (gx + (span_x / 2.0)) * ts
            wy = (gy + (span_y / 2.0)) * ts
            wz = elev
            yaw = math.radians(rot_step * 90.0)

            hx = (span_x * ts) / 2.0
            hy = (span_y * ts) / 2.0
            xmin, xmax = wx - hx + (0.02 * ts), wx + hx - (0.02 * ts)
            ymin, ymax = wy - hy + (0.02 * ts), wy + hy - (0.02 * ts)

            collides = False
            for (b_xmin, b_ymin, b_xmax, b_ymax, b_elev) in spatial_boxes:
                if abs(b_elev - elev) < 0.3:
                    if not (xmax <= b_xmin or xmin >= b_xmax or ymax <= b_ymin or ymin >= b_ymax):
                        collides = True
                        break

            if collides:
                continue

            spatial_boxes.append((xmin, ymin, xmax, ymax, elev))

            for ox in range(int(span_x)):
                for oy in range(int(span_y)):
                    occupied_cells.add((int(gx + ox), int(gy + oy)))

            if ftype == "centerpiece":
                obj = self._create_centerpiece(f"Centerpiece_{i}", ts, prim_col, sec_col, s_col)
            elif ftype == "reception_desk":
                obj = self._create_reception_desk(f"Reception_{i}", ts, wood_col, s_col)
                seats.append({"id": f"Seat_Reception_{i}", "gridX": int(gx + 1), "gridY": int(gy + 1), "elevation": elev, "sitDirection": (rot_step + 2) % 4 * 90})
            elif ftype == "bar_counter":
                obj = self._create_counter(f"Counter_{i}", ts, prim_col, s_col)
            elif ftype == "bar_stool":
                obj = self._create_stool(f"Stool_{i}", ts, prim_col, s_col)
                seats.append({"id": f"Seat_Stool_{i}", "gridX": int(gx), "gridY": int(gy), "elevation": elev, "sitDirection": rot_step * 90})
            elif ftype == "sofa_double":
                obj = self._create_sofa(f"Sofa_Double_{i}", 2.0, ts, prim_col, s_col, wood_col)
                seats.append({"id": f"Seat_Sofa_D1_{i}", "gridX": int(gx), "gridY": int(gy), "elevation": elev, "sitDirection": rot_step * 90})
                seats.append({"id": f"Seat_Sofa_D2_{i}", "gridX": int(gx + (1 if rot_step in (0, 2) else 0)), "gridY": int(gy + (1 if rot_step in (1, 3) else 0)), "elevation": elev, "sitDirection": rot_step * 90})
            elif ftype == "curved_sofa":
                obj = self._create_sofa(f"Sofa_VIP_{i}", 3.0, ts, prim_col, s_col, wood_col)
                seats.append({"id": f"Seat_VIP_1_{i}", "gridX": int(gx), "gridY": int(gy), "elevation": elev, "sitDirection": rot_step * 90})
                seats.append({"id": f"Seat_VIP_2_{i}", "gridX": int(gx + (1 if rot_step in (0, 2) else 0)), "gridY": int(gy + (1 if rot_step in (1, 3) else 0)), "elevation": elev, "sitDirection": rot_step * 90})
                seats.append({"id": f"Seat_VIP_3_{i}", "gridX": int(gx + (2 if rot_step in (0, 2) else 0)), "gridY": int(gy + (2 if rot_step in (1, 3) else 0)), "elevation": elev, "sitDirection": rot_step * 90})
            elif ftype == "sofa_single":
                obj = self._create_sofa(f"Sofa_Single_{i}", 1.0, ts, prim_col, s_col, wood_col)
                seats.append({"id": f"Seat_Sofa_S_{i}", "gridX": int(gx), "gridY": int(gy), "elevation": elev, "sitDirection": rot_step * 90})
            elif ftype == "coffee_table":
                obj = self._create_coffee_table(f"Table_{i}", ts, s_col, wood_col)
            elif ftype == "vip_table":
                obj = self._create_coffee_table(f"VIP_Table_{i}", ts, s_col, wood_col)
            elif ftype == "potted_plant":
                obj = self._create_plant(f"Plant_{i}", ts)
            elif ftype == "wall_art":
                obj = self._create_wall_art(f"Art_{i}", ts, prim_col)
                wy = (gy * ts) + (ts * 0.99)
                wz = elev + (2.5 * ts)
            else:
                obj = self._create_cube_obj(f"Furn_{i}", ts, prim_col)

            obj.location = (wx, wy, wz)
            obj.rotation_euler.z = yaw
            self._apply_outline(obj, 0.0025 * ts)
            objs.append(obj)

        return objs, seats, occupied_cells

    def _add_box(self, verts, faces, mat_indices, pmin, pmax, mat_idx=0):
        x0, y0, z0 = pmin
        x1, y1, z1 = pmax
        idx0 = len(verts)
        verts.extend([
            (x0, y0, z0),
            (x1, y0, z0),
            (x1, y1, z0),
            (x0, y1, z0),
            (x0, y0, z1),
            (x1, y0, z1),
            (x1, y1, z1),
            (x0, y1, z1),
        ])
        faces.extend([
            (idx0 + 0, idx0 + 3, idx0 + 2, idx0 + 1),
            (idx0 + 4, idx0 + 5, idx0 + 6, idx0 + 7),
            (idx0 + 0, idx0 + 1, idx0 + 5, idx0 + 4),
            (idx0 + 1, idx0 + 2, idx0 + 6, idx0 + 5),
            (idx0 + 2, idx0 + 3, idx0 + 7, idx0 + 6),
            (idx0 + 3, idx0 + 0, idx0 + 4, idx0 + 7),
        ])
        mat_indices.extend([mat_idx] * 6)

    def _create_centerpiece(self, name, ts, col_rim, col_water, metal_col):
        mat_rim = self._create_toon_mat(f"{name}_RimMat", col_rim, roughness=0.45)
        mat_water = self._create_toon_mat(f"{name}_WaterMat", col_water, roughness=0.10)
        mat_marble = self._create_toon_mat(f"{name}_MarbleMat", "#f8fafc", roughness=0.25)
        mat_metal = self._create_toon_mat(f"{name}_MetalMat", metal_col, roughness=0.18, metallic=0.88)

        verts, faces, mat_indices = [], [], []

        basin_r = 0.92 * ts
        basin_h = 0.45 * ts
        segments = 12

        for s in range(segments):
            angle0 = (s / float(segments)) * math.pi * 2.0
            angle1 = ((s + 1) / float(segments)) * math.pi * 2.0
            x0a, y0a = math.cos(angle0) * basin_r, math.sin(angle0) * basin_r
            x1a, y1a = math.cos(angle1) * basin_r, math.sin(angle1) * basin_r

            self._add_box(verts, faces, mat_indices, (min(x0a, x1a), min(y0a, y1a), 0.0), (max(x0a, x1a) + 0.02 * ts, max(y0a, y1a) + 0.02 * ts, basin_h), 0)

        inner_r = basin_r - 0.14 * ts
        self._add_box(verts, faces, mat_indices, (-inner_r, -inner_r, 0.06 * ts), (inner_r, inner_r, 0.18 * ts), 2)
        self._add_box(verts, faces, mat_indices, (-inner_r + 0.04 * ts, -inner_r + 0.04 * ts, 0.18 * ts), (inner_r - 0.04 * ts, inner_r - 0.04 * ts, basin_h - 0.04 * ts), 1)

        ped_r = 0.28 * ts
        self._add_box(verts, faces, mat_indices, (-ped_r, -ped_r, basin_h - 0.04 * ts), (ped_r, ped_r, basin_h + 0.25 * ts), 2)
        bowl_r = 0.42 * ts
        self._add_box(verts, faces, mat_indices, (-bowl_r, -bowl_r, basin_h + 0.25 * ts), (bowl_r, bowl_r, basin_h + 0.35 * ts), 0)
        spout_r = 0.09 * ts
        self._add_box(verts, faces, mat_indices, (-spout_r, -spout_r, basin_h + 0.35 * ts), (spout_r, spout_r, basin_h + 0.58 * ts), 3)

        mesh = bpy.data.meshes.new(f"{name}_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)

        obj.data.materials.append(mat_rim)
        obj.data.materials.append(mat_water)
        obj.data.materials.append(mat_marble)
        obj.data.materials.append(mat_metal)

        for p_idx, m_idx in enumerate(mat_indices):
            obj.data.polygons[p_idx].material_index = m_idx

        bev = obj.modifiers.new("CenterpieceBevel", 'BEVEL')
        bev.width = 0.015 * ts
        bev.segments = 2
        return obj

    def _create_reception_desk(self, name, ts, wood_col, metal_col):
        mat_wood = self._create_toon_mat(f"{name}_WoodMat", wood_col, roughness=0.35)
        mat_marble = self._create_toon_mat(f"{name}_MarbleMat", "#f8fafc", roughness=0.22)
        mat_metal = self._create_toon_mat(f"{name}_MetalMat", metal_col, roughness=0.18, metallic=0.88)
        mat_dark = self._create_toon_mat(f"{name}_DarkMat", "#0f172a", roughness=0.45)
        mat_screen = self._create_toon_mat(f"{name}_ScreenMat", "#0284c7", roughness=0.10)

        length = 1.95 * ts
        depth = 0.85 * ts
        height = 1.05 * ts
        hl = length / 2.0
        hd = depth / 2.0

        verts, faces, mat_indices = [], [], []

        self._add_box(verts, faces, mat_indices, (-hl + 0.04 * ts, -hd + 0.04 * ts, 0.0), (hl - 0.04 * ts, hd - 0.04 * ts, 0.08 * ts), 2)
        self._add_box(verts, faces, mat_indices, (-hl, -hd, 0.08 * ts), (hl, hd, height - 0.06 * ts), 0)
        self._add_box(verts, faces, mat_indices, (-hl - 0.03 * ts, -hd - 0.05 * ts, height - 0.06 * ts), (hl + 0.03 * ts, hd + 0.03 * ts, height), 1)

        term_w = 0.35 * ts
        self._add_box(verts, faces, mat_indices, (-term_w / 2.0, -0.05 * ts, height), (term_w / 2.0, 0.05 * ts, height + 0.03 * ts), 3)
        self._add_box(verts, faces, mat_indices, (-term_w / 2.0 + 0.03 * ts, 0.01 * ts, height + 0.03 * ts), (term_w / 2.0 - 0.03 * ts, 0.04 * ts, height + 0.28 * ts), 4)

        bell_r = 0.06 * ts
        self._add_box(verts, faces, mat_indices, (hl * 0.6 - bell_r, -hd * 0.4 - bell_r, height), (hl * 0.6 + bell_r, -hd * 0.4 + bell_r, height + 0.06 * ts), 2)

        mesh = bpy.data.meshes.new(f"{name}_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)

        obj.data.materials.append(mat_wood)
        obj.data.materials.append(mat_marble)
        obj.data.materials.append(mat_metal)
        obj.data.materials.append(mat_dark)
        obj.data.materials.append(mat_screen)

        for p_idx, m_idx in enumerate(mat_indices):
            obj.data.polygons[p_idx].material_index = m_idx

        bev = obj.modifiers.new("DeskBevel", 'BEVEL')
        bev.width = 0.012 * ts
        bev.segments = 2
        return obj

    def _create_entrance_stanchions(self, name, x0, x1, y0, elev, ts, mat_brass, mat_rope):
        verts, faces, mat_indices = [], [], []

        left_x = x0 + 0.15 * ts
        right_x = x1 - 0.15 * ts
        stanch_y = y0 + 0.20 * ts
        stanch_h = 0.85 * ts
        base_r = 0.12 * ts
        pole_r = 0.025 * ts

        self._add_box(verts, faces, mat_indices, (left_x - base_r, stanch_y - base_r, elev), (left_x + base_r, stanch_y + base_r, elev + 0.04 * ts), 0)
        self._add_box(verts, faces, mat_indices, (left_x - pole_r, stanch_y - pole_r, elev + 0.04 * ts), (left_x + pole_r, stanch_y + pole_r, elev + stanch_h), 0)
        self._add_box(verts, faces, mat_indices, (left_x - 0.045 * ts, stanch_y - 0.045 * ts, elev + stanch_h), (left_x + 0.045 * ts, stanch_y + 0.045 * ts, elev + stanch_h + 0.07 * ts), 0)

        self._add_box(verts, faces, mat_indices, (right_x - base_r, stanch_y - base_r, elev), (right_x + base_r, stanch_y + base_r, elev + 0.04 * ts), 0)
        self._add_box(verts, faces, mat_indices, (right_x - pole_r, stanch_y - pole_r, elev + 0.04 * ts), (right_x + pole_r, stanch_y + pole_r, elev + stanch_h), 0)
        self._add_box(verts, faces, mat_indices, (right_x - 0.045 * ts, stanch_y - 0.045 * ts, elev + stanch_h), (right_x + 0.045 * ts, stanch_y + 0.045 * ts, elev + stanch_h + 0.07 * ts), 0)

        rope_r = 0.02 * ts
        self._add_box(verts, faces, mat_indices, (left_x, stanch_y - rope_r, elev + stanch_h * 0.65), (right_x, stanch_y + rope_r, elev + stanch_h * 0.65 + 0.04 * ts), 1)

        mesh = bpy.data.meshes.new(f"{name}_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)

        obj.data.materials.append(mat_brass)
        obj.data.materials.append(mat_rope)

        for p_idx, m_idx in enumerate(mat_indices):
            obj.data.polygons[p_idx].material_index = m_idx

        return obj

    def _create_grand_entrance_doorway(self, name, x0, x1, y0, elev, ts, wh, mat_wood, mat_trim, mat_glass, mat_brass, mat_sconce, mat_marble):
        verts, faces, mat_indices = [], [], []

        door_w = x1 - x0
        cx = (x0 + x1) / 2.0
        door_h = 2.05
        portal_h = 2.35
        pw = 0.20 * ts
        thick = 0.14 * ts

        self._add_box(verts, faces, mat_indices, (x0 - pw - 0.02 * ts, y0 - thick - 0.02 * ts, elev), (x0 + 0.02 * ts, y0 + thick + 0.02 * ts, elev + 0.14), 3)
        self._add_box(verts, faces, mat_indices, (x0 - pw, y0 - thick, elev + 0.14), (x0, y0 + thick, elev + door_h), 0)
        self._add_box(verts, faces, mat_indices, (x0 - pw + 0.03 * ts, y0 - thick - 0.015 * ts, elev + 0.20), (x0 - 0.03 * ts, y0 - thick, elev + door_h - 0.08), 5)
        self._add_box(verts, faces, mat_indices, (x0 - pw - 0.02 * ts, y0 - thick - 0.02 * ts, elev + door_h - 0.08), (x0 + 0.02 * ts, y0 + thick + 0.02 * ts, elev + door_h), 3)

        self._add_box(verts, faces, mat_indices, (x1 - 0.02 * ts, y0 - thick - 0.02 * ts, elev), (x1 + pw + 0.02 * ts, y0 + thick + 0.02 * ts, elev + 0.14), 3)
        self._add_box(verts, faces, mat_indices, (x1, y0 - thick, elev + 0.14), (x1 + pw, y0 + thick, elev + door_h), 0)
        self._add_box(verts, faces, mat_indices, (x1 + 0.03 * ts, y0 - thick - 0.015 * ts, elev + 0.20), (x1 + pw - 0.03 * ts, y0 - thick, elev + door_h - 0.08), 5)
        self._add_box(verts, faces, mat_indices, (x1 - 0.02 * ts, y0 - thick - 0.02 * ts, elev + door_h - 0.08), (x1 + pw + 0.02 * ts, y0 + thick + 0.02 * ts, elev + door_h), 3)

        self._add_box(verts, faces, mat_indices, (x0 - pw * 0.5 - 0.03 * ts, y0 - thick - 0.08 * ts, elev + 1.45), (x0 - pw * 0.5 + 0.03 * ts, y0 - thick, elev + 1.65), 4)
        self._add_box(verts, faces, mat_indices, (x0 - pw * 0.5 - 0.04 * ts, y0 - thick - 0.09 * ts, elev + 1.42), (x0 - pw * 0.5 + 0.04 * ts, y0 - thick - 0.07 * ts, elev + 1.68), 3)
        self._add_box(verts, faces, mat_indices, (x1 + pw * 0.5 - 0.03 * ts, y0 - thick - 0.08 * ts, elev + 1.45), (x1 + pw * 0.5 + 0.03 * ts, y0 - thick, elev + 1.65), 4)
        self._add_box(verts, faces, mat_indices, (x1 + pw * 0.5 - 0.04 * ts, y0 - thick - 0.09 * ts, elev + 1.42), (x1 + pw * 0.5 + 0.04 * ts, y0 - thick - 0.07 * ts, elev + 1.68), 3)

        self._add_box(verts, faces, mat_indices, (x0 - pw - 0.03 * ts, y0 - thick - 0.02 * ts, elev + door_h), (x1 + pw + 0.03 * ts, y0 + thick + 0.02 * ts, elev + door_h + 0.05), 3)
        self._add_box(verts, faces, mat_indices, (x0 - pw - 0.02 * ts, y0 - thick - 0.01 * ts, elev + door_h + 0.05), (x1 + pw + 0.02 * ts, y0 + thick + 0.01 * ts, elev + portal_h - 0.05), 5)
        self._add_box(verts, faces, mat_indices, (cx - 0.7 * ts, y0 - thick - 0.03 * ts, elev + door_h + 0.08), (cx + 0.7 * ts, y0 - thick, elev + portal_h - 0.08), 1)
        self._add_box(verts, faces, mat_indices, (x0 - pw - 0.04 * ts, y0 - thick - 0.03 * ts, elev + portal_h - 0.05), (x1 + pw + 0.04 * ts, y0 + thick + 0.03 * ts, elev + portal_h), 3)

        self._add_box(verts, faces, mat_indices, (x0 + 0.02 * ts, y0 - 0.01 * ts, elev + door_h - 0.22), (x1 - 0.02 * ts, y0 + 0.01 * ts, elev + door_h), 2)
        self._add_box(verts, faces, mat_indices, (cx - 0.015 * ts, y0 - 0.02 * ts, elev + door_h - 0.22), (cx + 0.015 * ts, y0 + 0.02 * ts, elev + door_h), 3)

        leaf_w = (door_w - 0.04 * ts) / 2.0
        cos30 = 0.8660
        sin30 = 0.5000

        lx_end = x0 + 0.02 * ts + leaf_w * cos30
        ly_end = y0 + leaf_w * sin30
        self._add_box(verts, faces, mat_indices, (x0 + 0.02 * ts, y0, elev + 0.02 * ts), (lx_end, ly_end, elev + door_h - 0.24), 0)
        self._add_box(verts, faces, mat_indices, (x0 + 0.02 * ts, y0, elev + 0.02 * ts), (lx_end, ly_end, elev + 0.22), 3)
        self._add_box(verts, faces, mat_indices, (x0 + 0.08 * ts, y0 + 0.04 * ts, elev + 0.26), (lx_end - 0.04 * ts, ly_end - 0.02 * ts, elev + door_h - 0.30), 2)
        self._add_box(verts, faces, mat_indices, (lx_end - 0.06 * ts, ly_end - 0.03 * ts, elev + 0.85), (lx_end - 0.02 * ts, ly_end - 0.01 * ts, elev + 1.25), 1)

        rx_end = x1 - 0.02 * ts - leaf_w * cos30
        ry_end = y0 + leaf_w * sin30
        self._add_box(verts, faces, mat_indices, (rx_end, ry_end, elev + 0.02 * ts), (x1 - 0.02 * ts, y0, elev + door_h - 0.24), 0)
        self._add_box(verts, faces, mat_indices, (rx_end, ry_end, elev + 0.02 * ts), (x1 - 0.02 * ts, y0, elev + 0.22), 3)
        self._add_box(verts, faces, mat_indices, (rx_end + 0.04 * ts, ry_end - 0.02 * ts, elev + 0.26), (x1 - 0.08 * ts, y0 + 0.04 * ts, elev + door_h - 0.30), 2)
        self._add_box(verts, faces, mat_indices, (rx_end + 0.02 * ts, ry_end - 0.01 * ts, elev + 0.85), (rx_end + 0.06 * ts, ry_end - 0.03 * ts, elev + 1.25), 1)

        rw_thick = 0.02 * ts
        rw_h = 0.45
        self._add_box(verts, faces, mat_indices, (x0 - 2.5 * ts, y0 - rw_thick, elev), (x0 - pw - 0.02 * ts, y0 + rw_thick, elev + 0.04 * ts), 3)
        self._add_box(verts, faces, mat_indices, (x0 - 2.5 * ts, y0 - rw_thick * 0.5, elev + 0.04 * ts), (x0 - pw - 0.02 * ts, y0 + rw_thick * 0.5, elev + rw_h - 0.04 * ts), 2)
        self._add_box(verts, faces, mat_indices, (x0 - 2.5 * ts, y0 - rw_thick, elev + rw_h - 0.04 * ts), (x0 - pw - 0.02 * ts, y0 + rw_thick, elev + rw_h), 1)

        self._add_box(verts, faces, mat_indices, (x1 + pw + 0.02 * ts, y0 - rw_thick, elev), (x1 + 2.5 * ts, y0 + rw_thick, elev + 0.04 * ts), 3)
        self._add_box(verts, faces, mat_indices, (x1 + pw + 0.02 * ts, y0 - rw_thick * 0.5, elev + 0.04 * ts), (x1 + 2.5 * ts, y0 + rw_thick * 0.5, elev + rw_h - 0.04 * ts), 2)
        self._add_box(verts, faces, mat_indices, (x1 + pw + 0.02 * ts, y0 - rw_thick, elev + rw_h - 0.04 * ts), (x1 + 2.5 * ts, y0 + rw_thick, elev + rw_h), 1)

        mesh = bpy.data.meshes.new(f"{name}_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)

        obj.data.materials.append(mat_wood)
        obj.data.materials.append(mat_trim)
        obj.data.materials.append(mat_glass)
        obj.data.materials.append(mat_brass)
        obj.data.materials.append(mat_sconce)
        obj.data.materials.append(mat_marble)

        for p_idx, m_idx in enumerate(mat_indices):
            obj.data.polygons[p_idx].material_index = m_idx

        bev = obj.modifiers.new("EntranceBevel", 'BEVEL')
        bev.width = 0.008 * ts
        bev.segments = 2
        obj.visible_shadow = False
        return obj

    def _create_doorway_portal(self, name, x0, x1, y1, elev, ts, wh, mat_frame, mat_glass, mat_brass, mat_wood):
        verts, faces, mat_indices = [], [], []

        post_w = 0.12 * ts
        thick = 0.18 * ts
        door_h = 2.05

        self._add_box(verts, faces, mat_indices, (x0, y1, elev), (x0 + post_w, y1 + thick, elev + door_h), 0)
        self._add_box(verts, faces, mat_indices, (x1 - post_w, y1, elev), (x1, y1 + thick, elev + door_h), 0)
        self._add_box(verts, faces, mat_indices, (x0, y1, elev + door_h - post_w), (x1, y1 + thick, elev + door_h), 0)

        self._add_box(verts, faces, mat_indices, (x0 + post_w, y1 - 0.01 * ts, elev + door_h - 0.22), (x1 - post_w, y1 + thick, elev + door_h - 0.04), 2)

        panel_w = (x1 - x0 - (post_w * 2.0) - (0.04 * ts)) / 2.0
        p0_x = x0 + post_w + (0.02 * ts)
        p1_x = p0_x + panel_w
        p2_x = p1_x + (0.02 * ts)
        p3_x = p2_x + panel_w

        self._add_box(verts, faces, mat_indices, (p0_x, y1 + 0.02 * ts, elev + 0.02 * ts), (p1_x, y1 + 0.08 * ts, elev + door_h - post_w - 0.02 * ts), 3)
        self._add_box(verts, faces, mat_indices, (p2_x, y1 + 0.02 * ts, elev + 0.02 * ts), (p3_x, y1 + 0.08 * ts, elev + door_h - post_w - 0.02 * ts), 3)

        self._add_box(verts, faces, mat_indices, (p0_x, y1 + 0.02 * ts, elev + 0.02 * ts), (p1_x, y1 + 0.08 * ts, elev + 0.20), 2)
        self._add_box(verts, faces, mat_indices, (p2_x, y1 + 0.02 * ts, elev + 0.02 * ts), (p3_x, y1 + 0.08 * ts, elev + 0.20), 2)

        self._add_box(verts, faces, mat_indices, (p0_x + 0.03 * ts, y1 + 0.04 * ts, elev + 0.24), (p1_x - 0.03 * ts, y1 + 0.06 * ts, elev + door_h - post_w - 0.06 * ts), 1)
        self._add_box(verts, faces, mat_indices, (p2_x + 0.03 * ts, y1 + 0.04 * ts, elev + 0.24), (p3_x - 0.03 * ts, y1 + 0.06 * ts, elev + door_h - post_w - 0.06 * ts), 1)

        self._add_box(verts, faces, mat_indices, (p1_x - 0.035 * ts, y1 + 0.01 * ts, elev + 0.85), (p1_x - 0.015 * ts, y1 + 0.09 * ts, elev + 1.25), 2)
        self._add_box(verts, faces, mat_indices, (p2_x + 0.015 * ts, y1 + 0.01 * ts, elev + 0.85), (p2_x + 0.035 * ts, y1 + 0.09 * ts, elev + 1.25), 2)

        mesh = bpy.data.meshes.new(f"{name}_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)

        obj.data.materials.append(mat_frame)
        obj.data.materials.append(mat_glass)
        obj.data.materials.append(mat_brass)
        obj.data.materials.append(mat_wood)

        for p_idx, m_idx in enumerate(mat_indices):
            obj.data.polygons[p_idx].material_index = m_idx

        bev = obj.modifiers.new("PortalBevel", 'BEVEL')
        bev.width = 0.012 * ts
        bev.segments = 2
        obj.visible_shadow = False
        return obj

    def _create_counter(self, name, ts, front_col, metal_col):
        mat_front = self._create_toon_mat(f"{name}_FrontMat", front_col, roughness=0.35)
        mat_top = self._create_toon_mat(f"{name}_TopMat", "#f8fafc", roughness=0.22)
        mat_metal = self._create_toon_mat(f"{name}_MetalMat", metal_col, roughness=0.18, metallic=0.88)
        length = 0.98 * ts
        depth = 0.65 * ts
        height = 0.95 * ts
        hl = length / 2.0
        hd = depth / 2.0

        verts, faces, mat_indices = [], [], []

        self._add_box(verts, faces, mat_indices, (-hl + 0.03 * ts, -hd + 0.03 * ts, 0.0), (hl - 0.03 * ts, hd - 0.03 * ts, 0.08 * ts), 2)
        self._add_box(verts, faces, mat_indices, (-hl, -hd, 0.08 * ts), (hl, hd, height - 0.06 * ts), 0)
        self._add_box(verts, faces, mat_indices, (-hl - 0.04 * ts, -hd - 0.07 * ts, height - 0.06 * ts), (hl + 0.04 * ts, hd + 0.04 * ts, height), 1)
        self._add_box(verts, faces, mat_indices, (-hl - 0.02 * ts, -hd - 0.09 * ts, 0.12 * ts), (hl + 0.02 * ts, -hd - 0.06 * ts, 0.16 * ts), 2)

        mesh = bpy.data.meshes.new(f"{name}_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.data.materials.append(mat_front)
        obj.data.materials.append(mat_top)
        obj.data.materials.append(mat_metal)

        for p_idx, m_idx in enumerate(mat_indices):
            obj.data.polygons[p_idx].material_index = m_idx

        bev = obj.modifiers.new("CounterBevel", 'BEVEL')
        bev.width = 0.012 * ts
        bev.segments = 2
        return obj

    def _create_stool(self, name, ts, cushion_col, metal_col):
        mat_metal = self._create_toon_mat(f"{name}_MetalMat", metal_col, roughness=0.18, metallic=0.88)
        mat_cushion = self._create_toon_mat(f"{name}_CushionMat", cushion_col, roughness=0.40)
        mat_trim = self._create_toon_mat(f"{name}_TrimMat", "#d97706", roughness=0.18, metallic=0.88)
        radius = 0.28 * ts
        height = 0.75 * ts

        verts, faces, mat_indices = [], [], []

        self._add_box(verts, faces, mat_indices, (-0.18 * ts, -0.18 * ts, 0.0), (0.18 * ts, 0.18 * ts, 0.035 * ts), 0)
        self._add_box(verts, faces, mat_indices, (-0.035 * ts, -0.035 * ts, 0.035 * ts), (0.035 * ts, 0.035 * ts, height - 0.10 * ts), 0)
        self._add_box(verts, faces, mat_indices, (-0.15 * ts, -0.15 * ts, 0.22 * ts), (0.15 * ts, 0.15 * ts, 0.25 * ts), 0)
        self._add_box(verts, faces, mat_indices, (-radius, -radius, height - 0.10 * ts), (radius, radius, height), 1)
        self._add_box(verts, faces, mat_indices, (-radius - 0.015 * ts, -radius - 0.015 * ts, height - 0.03 * ts), (radius + 0.015 * ts, radius + 0.015 * ts, height + 0.005 * ts), 2)

        mesh = bpy.data.meshes.new(f"{name}_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.data.materials.append(mat_metal)
        obj.data.materials.append(mat_cushion)
        obj.data.materials.append(mat_trim)

        for p_idx, m_idx in enumerate(mat_indices):
            obj.data.polygons[p_idx].material_index = m_idx

        bev = obj.modifiers.new("StoolBevel", 'BEVEL')
        bev.width = 0.012 * ts
        bev.segments = 2
        return obj

    def _create_sofa(self, name, tiles_length, ts, col_cushion, col_metal, col_wood):
        mat_cushion = self._create_toon_mat(f"{name}_CushionMat", col_cushion, roughness=0.42)
        mat_metal = self._create_toon_mat(f"{name}_MetalMat", col_metal, roughness=0.18, metallic=0.88)
        mat_base = self._create_toon_mat(f"{name}_BaseMat", col_wood, roughness=0.35)
        mat_pillow = self._create_toon_mat(f"{name}_PillowMat", "#f5f5f4", roughness=0.55)

        length = (tiles_length - 0.08) * ts
        depth = 0.82 * ts
        hl = length / 2.0
        hd = depth / 2.0
        arm_w = 0.14 * ts

        verts, faces, mat_indices = [], [], []

        leg_r = 0.030 * ts
        self._add_box(verts, faces, mat_indices, (-hl + 0.06 * ts - leg_r, -hd + 0.06 * ts - leg_r, 0.0), (-hl + 0.06 * ts + leg_r, -hd + 0.06 * ts + leg_r, 0.12 * ts), 1)
        self._add_box(verts, faces, mat_indices, ( hl - 0.06 * ts - leg_r, -hd + 0.06 * ts - leg_r, 0.0), ( hl - 0.06 * ts + leg_r, -hd + 0.06 * ts + leg_r, 0.12 * ts), 1)
        self._add_box(verts, faces, mat_indices, (-hl + 0.06 * ts - leg_r,  hd - 0.06 * ts - leg_r, 0.0), (-hl + 0.06 * ts + leg_r,  hd - 0.06 * ts + leg_r, 0.12 * ts), 1)
        self._add_box(verts, faces, mat_indices, ( hl - 0.06 * ts - leg_r,  hd - 0.06 * ts - leg_r, 0.0), ( hl - 0.06 * ts + leg_r,  hd - 0.06 * ts + leg_r, 0.12 * ts), 1)

        self._add_box(verts, faces, mat_indices, (-hl + 0.02 * ts, -hd + 0.02 * ts, 0.08 * ts), (hl - 0.02 * ts, hd - 0.02 * ts, 0.14 * ts), 2)

        self._add_box(verts, faces, mat_indices, (-hl + arm_w, -hd + 0.02 * ts, 0.14 * ts), (hl - arm_w, hd - 0.16 * ts, 0.44 * ts), 0)
        self._add_box(verts, faces, mat_indices, (-hl + arm_w + 0.02 * ts, -hd + 0.04 * ts, 0.44 * ts), (hl - arm_w - 0.02 * ts, hd - 0.14 * ts, 0.52 * ts), 0)

        self._add_box(verts, faces, mat_indices, (-hl, -hd, 0.14 * ts), (-hl + arm_w, hd, 0.58 * ts), 0)
        self._add_box(verts, faces, mat_indices, (hl - arm_w, -hd, 0.14 * ts), (hl, hd, 0.58 * ts), 0)

        self._add_box(verts, faces, mat_indices, (-hl + arm_w, hd - 0.18 * ts, 0.14 * ts), (hl - arm_w, hd, 0.80 * ts), 0)

        if tiles_length >= 2.0:
            pw = 0.22 * ts
            self._add_box(verts, faces, mat_indices, (-hl + arm_w + 0.04 * ts, hd - 0.22 * ts, 0.46 * ts), (-hl + arm_w + pw, hd - 0.10 * ts, 0.68 * ts), 3)
            self._add_box(verts, faces, mat_indices, (hl - arm_w - pw, hd - 0.22 * ts, 0.46 * ts), (hl - arm_w - 0.04 * ts, hd - 0.10 * ts, 0.68 * ts), 3)

        mesh = bpy.data.meshes.new(f"{name}_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)

        obj.data.materials.append(mat_cushion)
        obj.data.materials.append(mat_metal)
        obj.data.materials.append(mat_base)
        obj.data.materials.append(mat_pillow)

        for p_idx, m_idx in enumerate(mat_indices):
            obj.data.polygons[p_idx].material_index = m_idx

        bev = obj.modifiers.new("SofaBevel", 'BEVEL')
        bev.width = 0.016 * ts
        bev.segments = 2
        return obj

    def _create_coffee_table(self, name, ts, metal_col, wood_col):
        mat_metal = self._create_toon_mat(f"{name}_MetalMat", metal_col, roughness=0.18, metallic=0.88)
        mat_marble = self._create_toon_mat(f"{name}_MarbleMat", "#f8fafc", roughness=0.22)
        mat_shelf = self._create_toon_mat(f"{name}_ShelfMat", wood_col, roughness=0.35)
        mat_book = self._create_toon_mat(f"{name}_BookMat", "#b45309", roughness=0.45)

        size = 0.85 * ts
        height = 0.44 * ts
        hs = size / 2.0
        leg_w = 0.035 * ts

        verts, faces, mat_indices = [], [], []

        self._add_box(verts, faces, mat_indices, (-hs, -hs, 0.0), (-hs + leg_w, -hs + leg_w, height - 0.04 * ts), 0)
        self._add_box(verts, faces, mat_indices, ( hs - leg_w, -hs, 0.0), ( hs, -hs + leg_w, height - 0.04 * ts), 0)
        self._add_box(verts, faces, mat_indices, (-hs,  hs - leg_w, 0.0), (-hs + leg_w,  hs, height - 0.04 * ts), 0)
        self._add_box(verts, faces, mat_indices, ( hs - leg_w,  hs - leg_w, 0.0), ( hs,  hs, height - 0.04 * ts), 0)

        self._add_box(verts, faces, mat_indices, (-hs + 0.05 * ts, -hs + 0.05 * ts, 0.12 * ts), (hs - 0.05 * ts, hs - 0.05 * ts, 0.15 * ts), 2)
        self._add_box(verts, faces, mat_indices, (-hs - 0.02 * ts, -hs - 0.02 * ts, height - 0.05 * ts), (hs + 0.02 * ts, hs + 0.02 * ts, height), 1)

        self._add_box(verts, faces, mat_indices, (-0.18 * ts, -0.12 * ts, height), (0.12 * ts, 0.12 * ts, height + 0.025 * ts), 3)

        mesh = bpy.data.meshes.new(f"{name}_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)

        obj.data.materials.append(mat_metal)
        obj.data.materials.append(mat_marble)
        obj.data.materials.append(mat_shelf)
        obj.data.materials.append(mat_book)

        for p_idx, m_idx in enumerate(mat_indices):
            obj.data.polygons[p_idx].material_index = m_idx

        bev = obj.modifiers.new("TableBevel", 'BEVEL')
        bev.width = 0.010 * ts
        bev.segments = 2
        return obj

    def _create_plant(self, name, ts):
        mat_pot = self._create_toon_mat(f"{name}_PotMat", "#fafaf9", roughness=0.30)
        mat_leaf1 = self._create_toon_mat(f"{name}_Leaf1Mat", "#15803d", roughness=0.35)
        mat_leaf2 = self._create_toon_mat(f"{name}_Leaf2Mat", "#166534", roughness=0.38)
        mat_dirt = self._create_toon_mat(f"{name}_DirtMat", "#26160c", roughness=0.75)
        mat_gold = self._create_toon_mat(f"{name}_GoldMat", "#d97706", roughness=0.18, metallic=0.88)

        pot_size = 0.65 * ts
        total_h = 1.15 * ts
        hs = pot_size / 2.0
        pot_h = total_h * 0.42

        verts, faces, mat_indices = [], [], []

        self._add_box(verts, faces, mat_indices, (-hs * 0.75, -hs * 0.75, 0.0), (hs * 0.75, hs * 0.75, pot_h * 0.1), 4)
        self._add_box(verts, faces, mat_indices, (-hs, -hs, pot_h * 0.1), (hs, hs, pot_h), 0)
        self._add_box(verts, faces, mat_indices, (-hs + 0.04 * ts, -hs + 0.04 * ts, pot_h - 0.03 * ts), (hs - 0.04 * ts, hs - 0.04 * ts, pot_h), 3)

        lr = hs * 1.6
        self._add_box(verts, faces, mat_indices, (-0.05 * ts, -0.05 * ts, pot_h), (0.05 * ts, 0.05 * ts, total_h * 0.75), 2)
        self._add_box(verts, faces, mat_indices, (-lr, -0.15 * ts, total_h * 0.55), (0.0, 0.15 * ts, total_h * 0.75), 1)
        self._add_box(verts, faces, mat_indices, (0.0, -0.15 * ts, total_h * 0.60), (lr, 0.15 * ts, total_h * 0.85), 2)
        self._add_box(verts, faces, mat_indices, (-0.15 * ts, -lr, total_h * 0.62), (0.15 * ts, 0.0, total_h * 0.88), 1)
        self._add_box(verts, faces, mat_indices, (-0.15 * ts, 0.0, total_h * 0.65), (0.15 * ts, lr, total_h * 0.92), 2)
        self._add_box(verts, faces, mat_indices, (-lr * 0.6, -lr * 0.6, total_h * 0.75), (lr * 0.6, lr * 0.6, total_h), 1)

        mesh = bpy.data.meshes.new(f"{name}_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)

        obj.data.materials.append(mat_pot)
        obj.data.materials.append(mat_leaf1)
        obj.data.materials.append(mat_leaf2)
        obj.data.materials.append(mat_dirt)
        obj.data.materials.append(mat_gold)

        for p_idx, m_idx in enumerate(mat_indices):
            obj.data.polygons[p_idx].material_index = m_idx

        bev = obj.modifiers.new("PlantBevel", 'BEVEL')
        bev.width = 0.010 * ts
        bev.segments = 2
        return obj

    def _create_wall_art(self, name, ts, color):
        mat = self._create_toon_mat(f"{name}_Mat", color, roughness=0.35)
        mat_frame = self._create_toon_mat(f"{name}_FrameMat", "#d97706", roughness=0.18, metallic=0.88)
        mat_canvas = self._create_toon_mat(f"{name}_CanvasMat", "#fafaf9", roughness=0.60)
        w = 1.8 * ts
        h = 1.0 * ts
        hw = w / 2.0
        hh = h / 2.0
        thick = 0.04 * ts

        verts, faces, mat_indices = [], [], []

        self._add_box(verts, faces, mat_indices, (-hw, -thick, -hh), (hw, 0.0, hh), 0)
        self._add_box(verts, faces, mat_indices, (-hw + 0.06 * ts, -thick - 0.005 * ts, -hh + 0.06 * ts), (hw - 0.06 * ts, -thick, hh - 0.06 * ts), 1)
        self._add_box(verts, faces, mat_indices, (-hw * 0.5, -thick - 0.01 * ts, -hh * 0.5), (hw * 0.5, -thick - 0.005 * ts, hh * 0.5), 2)

        mesh = bpy.data.meshes.new(f"{name}_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)

        obj.data.materials.append(mat_frame)
        obj.data.materials.append(mat_canvas)
        obj.data.materials.append(mat)

        for p_idx, m_idx in enumerate(mat_indices):
            obj.data.polygons[p_idx].material_index = m_idx

        return obj

    def _create_cube_obj(self, name, ts, color):
        mat = self._create_toon_mat(f"{name}_Mat", color, roughness=0.40)
        size = 0.80 * ts
        height = 0.80 * ts
        hs = size / 2.0
        verts = [
            (-hs, -hs, 0.0),
            ( hs, -hs, 0.0),
            ( hs,  hs, 0.0),
            (-hs,  hs, 0.0),
            (-hs, -hs, height),
            ( hs, -hs, height),
            ( hs,  hs, height),
            (-hs,  hs, height),
        ]
        faces = [
            (0, 3, 2, 1),
            (4, 5, 6, 7),
            (0, 1, 5, 4),
            (1, 2, 6, 5),
            (2, 3, 7, 6),
            (3, 0, 4, 7),
        ]
        mesh = bpy.data.meshes.new(f"{name}_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.data.materials.append(mat)
        return obj

    def _create_vertical_riser(self, name, p0, p1, z_low, z_high, mat):
        thick = 0.05
        dx = p1[0] - p0[0]
        dy = p1[1] - p0[1]
        length = math.hypot(dx, dy)
        if length < 1e-5:
            nx, ny = 0.0, 1.0
        else:
            nx = -dy / length
            ny = dx / length
        ox = nx * thick
        oy = ny * thick
        verts = [
            (p0[0], p0[1], z_low),
            (p1[0], p1[1], z_low),
            (p1[0], p1[1], z_high),
            (p0[0], p0[1], z_high),
            (p0[0] + ox, p0[1] + oy, z_low),
            (p1[0] + ox, p1[1] + oy, z_low),
            (p1[0] + ox, p1[1] + oy, z_high),
            (p0[0] + ox, p0[1] + oy, z_high),
        ]
        faces = [
            (0, 1, 2, 3),
            (7, 6, 5, 4),
            (0, 4, 5, 1),
            (1, 5, 6, 2),
            (2, 6, 7, 3),
            (3, 7, 4, 0),
        ]
        mesh = bpy.data.meshes.new(f"{name}_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.data.materials.append(mat)
        return obj

    def _create_railing_segment(self, name, p0, p1, z_base, rail_h, mat_glass, mat_metal):
        thick = 0.02
        post_r = 0.02
        handrail_h = 0.04
        panel_top = rail_h - handrail_h

        dx = p1[0] - p0[0]
        dy = p1[1] - p0[1]
        length = math.hypot(dx, dy)
        if length < 1e-5:
            nx, ny = 0.0, 1.0
        else:
            nx = -dy / length
            ny = dx / length

        gx = nx * (thick / 2.0)
        gy = ny * (thick / 2.0)
        hx = nx * post_r
        hy = ny * post_r

        verts = [
            (p0[0] - gx, p0[1] - gy, z_base + 0.04),
            (p1[0] - gx, p1[1] - gy, z_base + 0.04),
            (p1[0] - gx, p1[1] - gy, z_base + panel_top),
            (p0[0] - gx, p0[1] - gy, z_base + panel_top),
            (p0[0] + gx, p0[1] + gy, z_base + 0.04),
            (p1[0] + gx, p1[1] + gy, z_base + 0.04),
            (p1[0] + gx, p1[1] + gy, z_base + panel_top),
            (p0[0] + gx, p0[1] + gy, z_base + panel_top),
            (p0[0] - post_r, p0[1] - post_r, z_base),
            (p0[0] + post_r, p0[1] - post_r, z_base),
            (p0[0] + post_r, p0[1] + post_r, z_base),
            (p0[0] - post_r, p0[1] + post_r, z_base),
            (p0[0] - post_r, p0[1] - post_r, z_base + rail_h),
            (p0[0] + post_r, p0[1] - post_r, z_base + rail_h),
            (p0[0] + post_r, p0[1] + post_r, z_base + rail_h),
            (p0[0] - post_r, p0[1] + post_r, z_base + rail_h),
            (p0[0] - hx, p0[1] - hy, z_base + panel_top),
            (p1[0] - hx, p1[1] - hy, z_base + panel_top),
            (p1[0] + hx, p1[1] + hy, z_base + panel_top),
            (p0[0] + hx, p0[1] + hy, z_base + panel_top),
            (p0[0] - hx, p0[1] - hy, z_base + rail_h),
            (p1[0] - hx, p1[1] - hy, z_base + rail_h),
            (p1[0] + hx, p1[1] + hy, z_base + rail_h),
            (p0[0] + hx, p0[1] + hy, z_base + rail_h),
        ]
        faces = [
            (0, 1, 2, 3),
            (7, 6, 5, 4),
            (0, 4, 5, 1),
            (1, 5, 6, 2),
            (2, 6, 7, 3),
            (3, 7, 4, 0),
            (8, 9, 13, 12),
            (9, 10, 14, 13),
            (10, 11, 15, 14),
            (11, 8, 12, 15),
            (16, 17, 21, 20),
            (17, 18, 22, 21),
            (18, 19, 23, 22),
            (19, 16, 20, 23),
            (20, 21, 22, 23),
        ]
        mesh = bpy.data.meshes.new(f"{name}_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.visible_shadow = False
        obj.data.materials.append(mat_glass)
        obj.data.materials.append(mat_metal)
        for p in range(6, len(faces)):
            obj.data.polygons[p].material_index = 1
        return obj

    def _create_toon_mat(self, name, hex_color, roughness=0.38, metallic=0.0, emission_color=None, emission_strength=0.0):
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        links = mat.node_tree.links
        nodes.clear()

        principled = nodes.new(type="ShaderNodeBsdfPrincipled")
        principled.location = (0, 0)
        rgba_base = self._hex_to_rgba(hex_color)
        principled.inputs["Base Color"].default_value = rgba_base
        if "Roughness" in principled.inputs:
            principled.inputs["Roughness"].default_value = roughness
        if "Metallic" in principled.inputs:
            principled.inputs["Metallic"].default_value = metallic
        if emission_color and "Emission Color" in principled.inputs:
            principled.inputs["Emission Color"].default_value = self._hex_to_rgba(emission_color)
            if "Emission Strength" in principled.inputs:
                principled.inputs["Emission Strength"].default_value = emission_strength

        output = nodes.new(type="ShaderNodeOutputMaterial")
        output.location = (300, 0)
        links.new(principled.outputs["BSDF"], output.inputs["Surface"])
        return mat

    def _create_glass_mat(self, name):
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
        if hasattr(mat, "blend_method"):
            mat.blend_method = 'BLEND'
        if hasattr(mat, "surface_render_method"):
            try:
                mat.surface_render_method = 'BLENDED'
            except Exception:
                pass
        if hasattr(mat, "shadow_method"):
            mat.shadow_method = 'NONE'

        nodes = mat.node_tree.nodes
        links = mat.node_tree.links
        nodes.clear()

        principled = nodes.new(type="ShaderNodeBsdfPrincipled")
        principled.location = (0, 0)
        principled.inputs["Base Color"].default_value = (0.75, 0.90, 0.96, 0.45)
        if "Roughness" in principled.inputs:
            principled.inputs["Roughness"].default_value = 0.08
        if "Transmission" in principled.inputs:
            principled.inputs["Transmission"].default_value = 0.85
        elif "Transmission Weight" in principled.inputs:
            principled.inputs["Transmission Weight"].default_value = 0.85
        if "IOR" in principled.inputs:
            principled.inputs["IOR"].default_value = 1.45

        output = nodes.new(type="ShaderNodeOutputMaterial")
        output.location = (300, 0)
        links.new(principled.outputs["BSDF"], output.inputs["Surface"])
        return mat

    def _apply_outline(self, obj, width):
        outline_mat_name = "SocialOutline_Mat"
        outline_mat = bpy.data.materials.get(outline_mat_name)
        if outline_mat is None:
            outline_mat = bpy.data.materials.new(name=outline_mat_name)
            outline_mat.use_nodes = True
            nodes = outline_mat.node_tree.nodes
            nodes.clear()
            emission = nodes.new(type="ShaderNodeEmission")
            emission.inputs["Color"].default_value = (0.10, 0.12, 0.16, 1.0)
            emission.inputs["Strength"].default_value = 1.0
            output = nodes.new(type="ShaderNodeOutputMaterial")
            outline_mat.node_tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])
            if hasattr(outline_mat, "use_backface_culling"):
                outline_mat.use_backface_culling = True

        if outline_mat.name not in [m.name for m in obj.data.materials if m]:
            obj.data.materials.append(outline_mat)

        mat_index = [m.name for m in obj.data.materials if m].index(outline_mat.name)
        mod = obj.modifiers.new(name="IsoOutline", type='SOLIDIFY')
        mod.thickness = -width
        mod.offset = 1.0
        mod.use_flip_normals = True
        mod.material_offset = mat_index
        mod.material_offset_rim = mat_index

    def _get_cell_elevation(self, cell):
        if cell is None or cell == 0:
            return 0.0
        if isinstance(cell, str):
            return 0.0
        if cell == 2:
            return 0.6
        if cell == 3:
            return 1.2
        return 0.0

    def _hex_to_rgba(self, hex_str):
        clean = hex_str.strip().lstrip('#')
        if len(clean) == 3:
            clean = ''.join([c * 2 for c in clean])
        if len(clean) != 6:
            return (0.5, 0.5, 0.5, 1.0)
        r = int(clean[0:2], 16) / 255.0
        g = int(clean[2:4], 16) / 255.0
        b = int(clean[4:6], 16) / 255.0
        return (r, g, b, 1.0)
