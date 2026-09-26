import bpy
import math
import os

class WorldSynthesizerEngine:
    def render_world(self, params):
        name = str(params.get("name", "synthesized_world"))
        theme = str(params.get("theme", "art_deco_cyberpunk"))
        tile_width = int(params.get("tileWidth", 128))
        clear_scene = bool(params.get("clearScene", True))
        seed = int(params.get("seed", 42))

        output_path = params.get("renderOutput", params.get("outputPath", ""))
        if not output_path:
            output_path = os.path.join("output", "blender", "rooms", f"{name}.png")
        output_path = os.path.abspath(output_path)

        bp_data = params.get("blueprint", {})
        width = int(bp_data.get("width", params.get("width", 10)))
        depth = int(bp_data.get("depth", params.get("depth", 10)))
        cells = bp_data.get("cells", params.get("cells", []))

        if clear_scene:
            for obj in list(bpy.context.scene.objects):
                bpy.data.objects.remove(obj, do_unlink=True)

        palette_overrides = params.get("palette", None)
        mats = self._init_theme_materials(theme, palette_overrides)

        created_objects = []
        ts = 0.5

        floor_obj = self._build_floors(cells, width, depth, ts, mats)
        if floor_obj:
            created_objects.append(floor_obj)

        wall_perim_obj = self._build_perimeter_walls(cells, ts, mats)
        if wall_perim_obj:
            created_objects.append(wall_perim_obj)

        wall_inter_obj = self._build_interior_walls(cells, ts, mats)
        if wall_inter_obj:
            created_objects.append(wall_inter_obj)

        bar_obj = self._build_bars(cells, ts, mats)
        if bar_obj:
            created_objects.append(bar_obj)

        sofa_obj = self._build_sofas(cells, ts, mats)
        if sofa_obj:
            created_objects.append(sofa_obj)

        table_obj = self._build_tables(cells, ts, mats)
        if table_obj:
            created_objects.append(table_obj)

        stair_obj = self._build_stairs(cells, ts, mats)
        if stair_obj:
            created_objects.append(stair_obj)

        doorway_obj = self._build_doorways(cells, ts, mats)
        if doorway_obj:
            created_objects.append(doorway_obj)

        col_obj, light_objs = self._build_light_columns(cells, ts, mats)
        if col_obj:
            created_objects.append(col_obj)
        created_objects.extend(light_objs)

        cam_obj = self._setup_camera(width, depth, ts)
        created_objects.append(cam_obj)

        sun_objs = self._setup_lighting(width, depth, ts)
        created_objects.extend(sun_objs)

        res_w = int(params.get("resolutionWidth", 1024))
        res_h = res_w // 2
        scene = bpy.context.scene

        try:
            scene.render.engine = 'BLENDER_EEVEE_NEXT'
        except Exception:
            scene.render.engine = 'BLENDER_EEVEE'

        scene.render.resolution_x = res_w
        scene.render.resolution_y = res_h
        scene.render.resolution_percentage = 100
        scene.render.film_transparent = True

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        scene.render.filepath = output_path
        scene.render.image_settings.file_format = 'PNG'
        scene.render.image_settings.color_mode = 'RGBA'

        bpy.ops.render.render(write_still=True)

        rendered_size = os.path.getsize(output_path) if os.path.exists(output_path) else 0

        return {
            "success": True,
            "name": name,
            "theme": theme,
            "roomDimensions": {"width": width, "depth": depth},
            "totalObjects": len(created_objects),
            "imagePath": output_path,
            "renderPath": output_path,
            "renderSizeBytes": rendered_size
        }

    def _init_theme_materials(self, theme, palette_overrides):
        m = {}
        if theme == 'art_deco_cyberpunk':
            c_wall_perim = "#0f172a"
            c_wall_cornice = "#00f0ff"
            c_wall_inter = "#1e293b"
            c_floor = "#090d16"
            c_floor_trim = "#00f0ff"
            c_bar_top = "#d4af37"
            c_bar_base = "#0f172a"
            c_sofa = "#4338ca"
            c_sofa_cushion = "#06b6d4"
            c_table = "#e2e8f0"
            c_stair = "#1e293b"
            c_door = "#c59458"
            c_light_base = "#1e293b"
            c_light_glow = "#00f0ff"
        elif theme == 'retro_social_lounge':
            c_wall_perim = "#451a03"
            c_wall_cornice = "#d97706"
            c_wall_inter = "#78350f"
            c_floor = "#e7e5e4"
            c_floor_trim = "#a8a29e"
            c_bar_top = "#92400e"
            c_bar_base = "#451a03"
            c_sofa = "#c2410c"
            c_sofa_cushion = "#fed7aa"
            c_table = "#fef3c7"
            c_stair = "#92400e"
            c_door = "#b45309"
            c_light_base = "#78350f"
            c_light_glow = "#fde047"
        elif theme == 'neo_tokyo_diner':
            c_wall_perim = "#18181b"
            c_wall_cornice = "#ef4444"
            c_wall_inter = "#27272a"
            c_floor = "#f4f4f5"
            c_floor_trim = "#e4e4e7"
            c_bar_top = "#e2e8f0"
            c_bar_base = "#dc2626"
            c_sofa = "#ef4444"
            c_sofa_cushion = "#ffffff"
            c_table = "#f8fafc"
            c_stair = "#3f3f46"
            c_door = "#ef4444"
            c_light_base = "#27272a"
            c_light_glow = "#22d3ee"
        elif theme == 'medieval_tavern':
            c_wall_perim = "#292524"
            c_wall_cornice = "#78716c"
            c_wall_inter = "#44403c"
            c_floor = "#57534e"
            c_floor_trim = "#44403c"
            c_bar_top = "#382417"
            c_bar_base = "#26160c"
            c_sofa = "#78350f"
            c_sofa_cushion = "#92400e"
            c_table = "#582f0e"
            c_stair = "#451a03"
            c_door = "#382417"
            c_light_base = "#1c1917"
            c_light_glow = "#f59e0b"
        else:
            c_wall_perim = "#f8fafc"
            c_wall_cornice = "#cbd5e1"
            c_wall_inter = "#e2e8f0"
            c_floor = "#e2e8f0"
            c_floor_trim = "#cbd5e1"
            c_bar_top = "#0f172a"
            c_bar_base = "#334155"
            c_sofa = "#0f172a"
            c_sofa_cushion = "#64748b"
            c_table = "#ffffff"
            c_stair = "#94a3b8"
            c_door = "#475569"
            c_light_base = "#0f172a"
            c_light_glow = "#ffffff"

        if palette_overrides and len(palette_overrides) >= 3:
            c_wall_cornice = palette_overrides[0]
            c_sofa = palette_overrides[1]
            c_light_glow = palette_overrides[2]

        m["wall_perim"] = self._create_toon_mat("Mat_WallPerim", c_wall_perim, roughness=0.35)
        m["wall_cornice"] = self._create_toon_mat("Mat_WallCornice", c_wall_cornice, roughness=0.18, metallic=0.85)
        m["wall_inter"] = self._create_toon_mat("Mat_WallInter", c_wall_inter, roughness=0.40)
        m["floor"] = self._create_toon_mat("Mat_Floor", c_floor, roughness=0.45)
        m["floor_trim"] = self._create_toon_mat("Mat_FloorTrim", c_floor_trim, roughness=0.30)
        m["bar_top"] = self._create_toon_mat("Mat_BarTop", c_bar_top, roughness=0.20)
        m["bar_base"] = self._create_toon_mat("Mat_BarBase", c_bar_base, roughness=0.40)
        m["footrest"] = self._create_toon_mat("Mat_Footrest", "#d4af37", roughness=0.15, metallic=0.90)
        m["sofa"] = self._create_toon_mat("Mat_Sofa", c_sofa, roughness=0.40)
        m["sofa_cushion"] = self._create_toon_mat("Mat_SofaCushion", c_sofa_cushion, roughness=0.35)
        m["table"] = self._create_toon_mat("Mat_Table", c_table, roughness=0.25)
        m["stair"] = self._create_toon_mat("Mat_Stair", c_stair, roughness=0.40)
        m["door"] = self._create_toon_mat("Mat_Door", c_door, roughness=0.45)
        m["light_base"] = self._create_toon_mat("Mat_LightBase", c_light_base, roughness=0.30)
        m["light_glow"] = self._create_toon_mat("Mat_LightGlow", c_light_glow, roughness=0.10, emission_color=c_light_glow, emission_strength=8.0)
        return m

    def _build_floors(self, cells, width, depth, ts, m):
        verts, faces, mats = [], [], []
        floor_cells = [c for c in cells if c.get("token") != "void"]
        if not floor_cells:
            return None

        for c in floor_cells:
            gx = c["gridX"]
            gy = c["gridY"]
            elev = float(c.get("elevation", 0.0))
            x0, y0 = gx * ts, gy * ts
            x1, y1 = (gx + 1) * ts, (gy + 1) * ts

            self._add_box(verts, faces, mats, (x0, y0, elev - 0.05), (x1, y1, elev), 0)
            self._add_box(verts, faces, mats, (x0, y0, elev), (x1, y0 + 0.015 * ts, elev + 0.002), 1)
            self._add_box(verts, faces, mats, (x0, y0, elev), (x0 + 0.015 * ts, y1, elev + 0.002), 1)

            if elev > 0.0:
                self._add_box(verts, faces, mats, (x0, y0, 0.0), (x1, y1, elev - 0.05), 0)

        mesh = bpy.data.meshes.new("WorldFloors_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new("WorldFloors", mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.data.materials.append(m["floor"])
        obj.data.materials.append(m["floor_trim"])
        for p, midx in enumerate(mats):
            obj.data.polygons[p].material_index = midx
        return obj

    def _build_perimeter_walls(self, cells, ts, m):
        verts, faces, mats = [], [], []
        target_cells = [c for c in cells if c.get("token") == "wall_perimeter"]
        if not target_cells:
            return None

        wall_h = 2.5
        for c in target_cells:
            gx = c["gridX"]
            gy = c["gridY"]
            elev = float(c.get("elevation", 0.0))
            x0, y0 = gx * ts, gy * ts
            x1, y1 = (gx + 1) * ts, (gy + 1) * ts

            self._add_box(verts, faces, mats, (x0, y0, elev), (x1, y1, elev + wall_h - 0.15), 0)
            self._add_box(verts, faces, mats, (x0 - 0.03 * ts, y0 - 0.03 * ts, elev + wall_h - 0.15), (x1 + 0.03 * ts, y1 + 0.03 * ts, elev + wall_h), 1)

        mesh = bpy.data.meshes.new("WorldWallPerim_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new("WorldWallPerim", mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.data.materials.append(m["wall_perim"])
        obj.data.materials.append(m["wall_cornice"])
        for p, midx in enumerate(mats):
            obj.data.polygons[p].material_index = midx
        return obj

    def _build_interior_walls(self, cells, ts, m):
        verts, faces, mats = [], [], []
        target_cells = [c for c in cells if c.get("token") == "wall_interior"]
        if not target_cells:
            return None

        wall_h = 1.2
        for c in target_cells:
            gx = c["gridX"]
            gy = c["gridY"]
            elev = float(c.get("elevation", 0.0))
            x0, y0 = gx * ts, gy * ts
            x1, y1 = (gx + 1) * ts, (gy + 1) * ts

            self._add_box(verts, faces, mats, (x0, y0, elev), (x1, y1, elev + wall_h - 0.06), 0)
            self._add_box(verts, faces, mats, (x0 - 0.015 * ts, y0 - 0.015 * ts, elev + wall_h - 0.06), (x1 + 0.015 * ts, y1 + 0.015 * ts, elev + wall_h), 1)

        mesh = bpy.data.meshes.new("WorldWallInter_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new("WorldWallInter", mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.data.materials.append(m["wall_inter"])
        obj.data.materials.append(m["wall_cornice"])
        for p, midx in enumerate(mats):
            obj.data.polygons[p].material_index = midx
        return obj

    def _build_bars(self, cells, ts, m):
        verts, faces, mats = [], [], []
        target_cells = [c for c in cells if c.get("token") == "bar_counter"]
        if not target_cells:
            return None

        for c in target_cells:
            gx = c["gridX"]
            gy = c["gridY"]
            elev = float(c.get("elevation", 0.0))
            x0, y0 = gx * ts, gy * ts
            x1, y1 = (gx + 1) * ts, (gy + 1) * ts

            self._add_box(verts, faces, mats, (x0 + 0.05 * ts, y0 + 0.05 * ts, elev), (x1 - 0.05 * ts, y1 - 0.05 * ts, elev + 0.82), 0)
            self._add_box(verts, faces, mats, (x0, y0, elev + 0.82), (x1, y1, elev + 0.90), 1)
            self._add_box(verts, faces, mats, (x0 - 0.03 * ts, y0 - 0.03 * ts, elev + 0.08), (x1 + 0.03 * ts, y1 + 0.03 * ts, elev + 0.14), 2)

        mesh = bpy.data.meshes.new("WorldBarCounters_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new("WorldBarCounters", mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.data.materials.append(m["bar_base"])
        obj.data.materials.append(m["bar_top"])
        obj.data.materials.append(m["footrest"])
        for p, midx in enumerate(mats):
            obj.data.polygons[p].material_index = midx
        return obj

    def _build_sofas(self, cells, ts, m):
        verts, faces, mats = [], [], []
        target_cells = [c for c in cells if c.get("token") == "sofa"]
        if not target_cells:
            return None

        for c in target_cells:
            gx = c["gridX"]
            gy = c["gridY"]
            elev = float(c.get("elevation", 0.0))
            x0, y0 = gx * ts, gy * ts
            x1, y1 = (gx + 1) * ts, (gy + 1) * ts

            self._add_box(verts, faces, mats, (x0 + 0.06 * ts, y0 + 0.06 * ts, elev), (x1 - 0.06 * ts, y1 - 0.06 * ts, elev + 0.14), 0)
            self._add_box(verts, faces, mats, (x0 + 0.06 * ts, y0 + 0.06 * ts, elev + 0.14), (x1 - 0.06 * ts, y1 - 0.22 * ts, elev + 0.44), 1)
            self._add_box(verts, faces, mats, (x0 + 0.06 * ts, y1 - 0.26 * ts, elev + 0.14), (x1 - 0.06 * ts, y1 - 0.04 * ts, elev + 0.78), 1)
            self._add_box(verts, faces, mats, (x0 + 0.04 * ts, y0 + 0.06 * ts, elev + 0.14), (x0 + 0.16 * ts, y1 - 0.04 * ts, elev + 0.56), 0)
            self._add_box(verts, faces, mats, (x1 - 0.16 * ts, y0 + 0.06 * ts, elev + 0.14), (x1 - 0.04 * ts, y1 - 0.04 * ts, elev + 0.56), 0)

        mesh = bpy.data.meshes.new("WorldSofas_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new("WorldSofas", mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.data.materials.append(m["sofa"])
        obj.data.materials.append(m["sofa_cushion"])
        for p, midx in enumerate(mats):
            obj.data.polygons[p].material_index = midx
        return obj

    def _build_tables(self, cells, ts, m):
        verts, faces, mats = [], [], []
        target_cells = [c for c in cells if c.get("token") == "table"]
        if not target_cells:
            return None

        for c in target_cells:
            gx = c["gridX"]
            gy = c["gridY"]
            elev = float(c.get("elevation", 0.0))
            x0, y0 = gx * ts, gy * ts
            x1, y1 = (gx + 1) * ts, (gy + 1) * ts

            cx = (x0 + x1) / 2.0
            cy = (y0 + y1) / 2.0
            pw = 0.08 * ts
            self._add_box(verts, faces, mats, (cx - pw, cy - pw, elev), (cx + pw, cy + pw, elev + 0.50), 0)
            self._add_box(verts, faces, mats, (x0 + 0.08 * ts, y0 + 0.08 * ts, elev + 0.50), (x1 - 0.08 * ts, y1 - 0.08 * ts, elev + 0.58), 0)

        mesh = bpy.data.meshes.new("WorldTables_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new("WorldTables", mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.data.materials.append(m["table"])
        for p, midx in enumerate(mats):
            obj.data.polygons[p].material_index = midx
        return obj

    def _build_stairs(self, cells, ts, m):
        verts, faces, mats = [], [], []
        target_cells = [c for c in cells if str(c.get("token", "")).startswith("stair_")]
        if not target_cells:
            return None

        num_steps = 4
        step_h = 0.25 / num_steps

        for c in target_cells:
            gx = c["gridX"]
            gy = c["gridY"]
            token = c["token"]
            elev = float(c.get("elevation", 0.0))
            x0, y0 = gx * ts, gy * ts
            x1, y1 = (gx + 1) * ts, (gy + 1) * ts

            for s in range(num_steps):
                z_top = elev + (s + 1) * step_h
                if token == "stair_n":
                    sy0 = y0 + s * (ts / num_steps)
                    sy1 = sy0 + (ts / num_steps)
                    self._add_box(verts, faces, mats, (x0, sy0, elev), (x1, sy1, z_top), 0)
                elif token == "stair_s":
                    sy0 = y1 - (s + 1) * (ts / num_steps)
                    sy1 = sy0 + (ts / num_steps)
                    self._add_box(verts, faces, mats, (x0, sy0, elev), (x1, sy1, z_top), 0)
                elif token == "stair_e":
                    sx0 = x0 + s * (ts / num_steps)
                    sx1 = sx0 + (ts / num_steps)
                    self._add_box(verts, faces, mats, (sx0, y0, elev), (sx1, y1, z_top), 0)
                else:
                    sx0 = x1 - (s + 1) * (ts / num_steps)
                    sx1 = sx0 + (ts / num_steps)
                    self._add_box(verts, faces, mats, (sx0, y0, elev), (sx1, y1, z_top), 0)

        mesh = bpy.data.meshes.new("WorldStairs_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new("WorldStairs", mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.data.materials.append(m["stair"])
        for p, midx in enumerate(mats):
            obj.data.polygons[p].material_index = midx
        return obj

    def _build_doorways(self, cells, ts, m):
        verts, faces, mats = [], [], []
        target_cells = [c for c in cells if c.get("token") == "doorway"]
        if not target_cells:
            return None

        door_h = 2.2
        post_w = 0.08 * ts
        for c in target_cells:
            gx = c["gridX"]
            gy = c["gridY"]
            elev = float(c.get("elevation", 0.0))
            x0, y0 = gx * ts, gy * ts
            x1, y1 = (gx + 1) * ts, (gy + 1) * ts

            self._add_box(verts, faces, mats, (x0, y0, elev), (x0 + post_w, y1, elev + door_h), 0)
            self._add_box(verts, faces, mats, (x1 - post_w, y0, elev), (x1, y1, elev + door_h), 0)
            self._add_box(verts, faces, mats, (x0, y0, elev + door_h - 0.15), (x1, y1, elev + door_h), 0)

        mesh = bpy.data.meshes.new("WorldDoorways_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new("WorldDoorways", mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.data.materials.append(m["door"])
        for p, midx in enumerate(mats):
            obj.data.polygons[p].material_index = midx
        return obj

    def _build_light_columns(self, cells, ts, m):
        verts, faces, mats = [], [], []
        light_objs = []
        target_cells = [c for c in cells if c.get("token") == "light_column"]
        if not target_cells:
            return None, light_objs

        for idx, c in enumerate(target_cells):
            gx = c["gridX"]
            gy = c["gridY"]
            elev = float(c.get("elevation", 0.0))
            cx = (gx + 0.5) * ts
            cy = (gy + 0.5) * ts
            col_r = 0.08 * ts
            glow_r = 0.14 * ts

            self._add_box(verts, faces, mats, (cx - col_r * 1.5, cy - col_r * 1.5, elev), (cx + col_r * 1.5, cy + col_r * 1.5, elev + 0.15), 0)
            self._add_box(verts, faces, mats, (cx - col_r, cy - col_r, elev + 0.15), (cx + col_r, cy + col_r, elev + 1.8), 0)
            self._add_box(verts, faces, mats, (cx - glow_r, cy - glow_r, elev + 1.8), (cx + glow_r, cy + glow_r, elev + 2.15), 1)

            p_data = bpy.data.lights.new(name=f"WorldLight_{idx}", type='POINT')
            p_data.energy = 40.0
            p_data.color = (1.0, 0.95, 0.85)
            p_data.use_shadow = False
            p_obj = bpy.data.objects.new(name=f"WorldLight_{idx}", object_data=p_data)
            bpy.context.scene.collection.objects.link(p_obj)
            p_obj.location = (cx, cy, elev + 2.0)
            light_objs.append(p_obj)

        mesh = bpy.data.meshes.new("WorldLightCols_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        col_obj = bpy.data.objects.new("WorldLightCols", mesh)
        bpy.context.scene.collection.objects.link(col_obj)
        col_obj.data.materials.append(m["light_base"])
        col_obj.data.materials.append(m["light_glow"])
        for p, midx in enumerate(mats):
            col_obj.data.polygons[p].material_index = midx
        return col_obj, light_objs

    def _setup_camera(self, width, depth, ts):
        cam_data = bpy.data.cameras.new("WorldSynthesizerCam")
        cam_data.type = 'ORTHO'

        diag_span = (width + depth) * ts * 0.70710678
        vertical_span = (diag_span * 0.5) + (3.0 * ts) + 1.5
        cam_data.ortho_scale = max(diag_span, vertical_span * 2.0) * 1.15
        cam_data.clip_start = 0.1
        cam_data.clip_end = 500.0

        cam_obj = bpy.data.objects.new("WorldSynthesizerCam", cam_data)
        bpy.context.scene.collection.objects.link(cam_obj)
        bpy.context.scene.camera = cam_obj

        rot_x = math.radians(60.0)
        rot_y = 0.0
        rot_z = math.radians(45.0)
        cam_obj.rotation_mode = 'XYZ'
        cam_obj.rotation_euler = (rot_x, rot_y, rot_z)

        cx = (width * ts) / 2.0
        cy = (depth * ts) / 2.0
        cz = 0.5
        dist = 80.0

        cam_obj.location = (
            cx + dist * 0.6123724356957945,
            cy - dist * 0.6123724356957945,
            cz + dist * 0.5
        )
        return cam_obj

    def _setup_lighting(self, width, depth, ts):
        objs = []
        cx = (width * ts) / 2.0
        cy = (depth * ts) / 2.0

        sun1_data = bpy.data.lights.new(name="WorldKeySun", type='SUN')
        sun1_data.energy = 2.2
        sun1_data.color = (1.0, 0.98, 0.95)
        sun1_data.use_shadow = False
        sun1_obj = bpy.data.objects.new(name="WorldKeySun", object_data=sun1_data)
        bpy.context.scene.collection.objects.link(sun1_obj)
        sun1_obj.location = (cx, cy, 25.0)
        sun1_obj.rotation_euler = (math.radians(58.0), math.radians(12.0), math.radians(-40.0))
        objs.append(sun1_obj)

        sun2_data = bpy.data.lights.new(name="WorldFillSun", type='SUN')
        sun2_data.energy = 1.4
        sun2_data.color = (0.92, 0.95, 1.0)
        sun2_data.use_shadow = False
        sun2_obj = bpy.data.objects.new(name="WorldFillSun", object_data=sun2_data)
        bpy.context.scene.collection.objects.link(sun2_obj)
        sun2_obj.location = (cx, cy, 25.0)
        sun2_obj.rotation_euler = (math.radians(65.0), math.radians(-20.0), math.radians(45.0))
        objs.append(sun2_obj)

        sun3_data = bpy.data.lights.new(name="WorldRimSun", type='SUN')
        sun3_data.energy = 0.8
        sun3_data.color = (1.0, 1.0, 1.0)
        sun3_data.use_shadow = False
        sun3_obj = bpy.data.objects.new(name="WorldRimSun", object_data=sun3_data)
        bpy.context.scene.collection.objects.link(sun3_obj)
        sun3_obj.location = (cx, cy, 25.0)
        sun3_obj.rotation_euler = (math.radians(40.0), math.radians(-30.0), math.radians(135.0))
        objs.append(sun3_obj)

        return objs

    def _add_box(self, verts, faces, mats, min_pt, max_pt, mat_index):
        x0, y0, z0 = min_pt
        x1, y1, z1 = max_pt
        v_offset = len(verts)

        verts.extend([
            (x0, y0, z0),
            (x1, y0, z0),
            (x1, y1, z0),
            (x0, y1, z0),
            (x0, y0, z1),
            (x1, y0, z1),
            (x1, y1, z1),
            (x0, y1, z1)
        ])

        faces.extend([
            (v_offset + 0, v_offset + 3, v_offset + 2, v_offset + 1),
            (v_offset + 4, v_offset + 5, v_offset + 6, v_offset + 7),
            (v_offset + 0, v_offset + 1, v_offset + 5, v_offset + 4),
            (v_offset + 1, v_offset + 2, v_offset + 6, v_offset + 5),
            (v_offset + 2, v_offset + 3, v_offset + 7, v_offset + 6),
            (v_offset + 3, v_offset + 0, v_offset + 4, v_offset + 7)
        ])

        mats.extend([mat_index] * 6)

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
