import bpy
import math
import os

class HabboBarEngine:
    def build_bar(self, params):
        tile_size = float(params.get("tileSize", 0.5))
        render_output = params.get("renderOutput", "")
        res_w = int(params.get("resolutionWidth", 640))
        res_h = int(params.get("resolutionHeight", 480))

        for obj in list(bpy.context.scene.objects):
            bpy.data.objects.remove(obj, do_unlink=True)

        mats = self._init_materials()
        created_objects = []

        w = 19
        d = 19
        ts = tile_size

        bg_objs = self._build_environment(w, d, ts, mats)
        created_objects.extend(bg_objs)

        floor_objs = self._build_floors_and_foundation(w, d, ts, mats)
        created_objects.extend(floor_objs)

        wall_objs = self._build_walls_and_vault(w, d, ts, mats)
        created_objects.extend(wall_objs)

        bar_objs = self._build_bar_deck_and_counter(w, d, ts, mats)
        created_objects.extend(bar_objs)

        sofa_objs = self._build_seating_booths(w, d, ts, mats)
        created_objects.extend(sofa_objs)

        exit_objs = self._build_exit_portal(ts, mats)
        created_objects.extend(exit_objs)

        lights_objs = self._setup_lighting_and_camera(w, d, ts, res_w, res_h, mats)
        created_objects.extend(lights_objs)

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

        return {
            "success": True,
            "theme": "habbo_rooftop_bar",
            "roomDimensions": {"width": w, "depth": d},
            "totalObjects": len(created_objects),
            "renderPath": render_output,
            "renderSizeBytes": rendered_size
        }

    def _init_materials(self):
        m = {}
        m["bg_water"] = self._create_toon_mat("Habbo_BgWater", "#316a84", roughness=0.60)
        m["brick_base"] = self._create_toon_mat("Habbo_BrickBase", "#dedfe3", roughness=0.45)
        m["brick_mortar"] = self._create_toon_mat("Habbo_BrickMortar", "#70737d", roughness=0.70)
        m["stone_tile"] = self._create_toon_mat("Habbo_StoneTile", "#d4d1c9", roughness=0.40)
        m["stone_grout"] = self._create_toon_mat("Habbo_StoneGrout", "#9e9a90", roughness=0.60)
        m["wood_plank"] = self._create_toon_mat("Habbo_WoodPlank", "#bfae93", roughness=0.35)
        m["wood_groove"] = self._create_toon_mat("Habbo_WoodGroove", "#8f7c62", roughness=0.50)
        m["wood_riser"] = self._create_toon_mat("Habbo_WoodRiser", "#8c1d35", roughness=0.40)
        m["wood_column"] = self._create_toon_mat("Habbo_WoodColumn", "#c59458", roughness=0.35)
        m["wood_column_dark"] = self._create_toon_mat("Habbo_WoodColumnDark", "#9e6f36", roughness=0.40)
        m["wood_door"] = self._create_toon_mat("Habbo_WoodDoor", "#c59458", roughness=0.40)
        m["wood_door_frame"] = self._create_toon_mat("Habbo_WoodDoorFrame", "#6b4226", roughness=0.45)
        m["dance_base"] = self._create_toon_mat("Habbo_DanceBase", "#a39175", roughness=0.35)
        m["dance_light"] = self._create_toon_mat("Habbo_DanceLight", "#fde047", roughness=0.15, emission_color="#facc15", emission_strength=7.0)
        m["wall_damask"] = self._create_toon_mat("Habbo_WallDamask", "#8c1d35", roughness=0.45)
        m["wall_vault"] = self._create_toon_mat("Habbo_WallVault", "#f0eff4", roughness=0.30)
        m["wall_seam"] = self._create_toon_mat("Habbo_WallSeam", "#71717a", roughness=0.50)
        m["wall_arch"] = self._create_toon_mat("Habbo_WallArch", "#dedfe3", roughness=0.40)
        m["neon_red"] = self._create_toon_mat("Habbo_NeonRed", "#ff1e42", roughness=0.10, emission_color="#ff1e42", emission_strength=10.0)
        m["neon_frame"] = self._create_toon_mat("Habbo_NeonFrame", "#27272a", roughness=0.60)
        m["neon_backing"] = self._create_toon_mat("Habbo_NeonBacking", "#18181b", roughness=0.70)
        m["bar_top"] = self._create_toon_mat("Habbo_BarTop", "#b8d8be", roughness=0.20)
        m["bar_front"] = self._create_toon_mat("Habbo_BarFront", "#e2e8f0", roughness=0.35)
        m["brass"] = self._create_toon_mat("Habbo_Brass", "#c59b27", roughness=0.18, metallic=0.88)
        m["metal_black"] = self._create_toon_mat("Habbo_MetalBlack", "#18181b", roughness=0.40, metallic=0.70)
        m["glass"] = self._create_toon_glass_mat("Habbo_Glass", "#bbf2f6", alpha=0.38)
        m["glass_balustrade"] = self._create_toon_glass_mat("Habbo_GlassBalustrade", "#7dd3fc", alpha=0.45)
        m["sofa_cushion"] = self._create_toon_mat("Habbo_SofaCushion", "#ccccff", roughness=0.35)
        m["sofa_cushion_edge"] = self._create_toon_mat("Habbo_SofaCushionEdge", "#b0b0ee", roughness=0.40)
        m["sofa_base"] = self._create_toon_mat("Habbo_SofaBase", "#7c6ea8", roughness=0.30)
        m["sofa_table"] = self._create_toon_mat("Habbo_SofaTable", "#c59458", roughness=0.35)
        m["pendant_shade"] = self._create_toon_mat("Habbo_PendantShade", "#ea580c", roughness=0.20, emission_color="#ea580c", emission_strength=4.0)
        m["pendant_bulb"] = self._create_toon_mat("Habbo_PendantBulb", "#fffbeb", roughness=0.10, emission_color="#fef08a", emission_strength=9.0)
        m["exit_box"] = self._create_toon_mat("Habbo_ExitBox", "#15803d", roughness=0.20, emission_color="#16a34a", emission_strength=6.0)
        m["exit_text"] = self._create_toon_mat("Habbo_ExitText", "#f0fdf4", roughness=0.10, emission_color="#ffffff", emission_strength=8.0)
        m["mat_door"] = self._create_toon_mat("Habbo_MatDoor", "#6b4226", roughness=0.85)
        m["bottle_cyan"] = self._create_toon_mat("Habbo_BottleCyan", "#06b6d4", roughness=0.15, emission_color="#06b6d4", emission_strength=1.5)
        m["bottle_green"] = self._create_toon_mat("Habbo_BottleGreen", "#22c55e", roughness=0.15, emission_color="#22c55e", emission_strength=1.5)
        m["bottle_red"] = self._create_toon_mat("Habbo_BottleRed", "#ef4444", roughness=0.15, emission_color="#ef4444", emission_strength=1.5)
        m["bottle_amber"] = self._create_toon_mat("Habbo_BottleAmber", "#f59e0b", roughness=0.15, emission_color="#f59e0b", emission_strength=1.5)
        m["poster_frame"] = self._create_toon_mat("Habbo_PosterFrame", "#c59b27", roughness=0.20, metallic=0.80)
        m["poster_canvas"] = self._create_toon_mat("Habbo_PosterCanvas", "#0284c7", roughness=0.45)
        m["poster_art"] = self._create_toon_mat("Habbo_PosterArt", "#e11d48", roughness=0.40)
        m["poster_skin"] = self._create_toon_mat("Habbo_PosterSkin", "#fed7aa", roughness=0.40)
        m["cash_register"] = self._create_toon_mat("Habbo_CashRegister", "#334155", roughness=0.30, metallic=0.60)
        return m

    def _build_environment(self, w, d, ts, m):
        verts, faces, mats = [], [], []
        span = 35.0 * ts
        self._add_box(verts, faces, mats, (-span * 0.4, -span * 0.4, -0.65), (span * 0.8, span * 0.8, -0.60), 0)

        mesh = bpy.data.meshes.new("HabboWaterBg_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new("HabboWaterBg", mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.data.materials.append(m["bg_water"])
        return [obj]

    def _build_floors_and_foundation(self, w, d, ts, m):
        objs = []
        base_depth = 0.55

        f_verts, f_faces, f_mats = [], [], []

        self._add_box(f_verts, f_faces, f_mats, (0.0, -0.06 * ts, -base_depth), (w * ts, 0.0, 0.0), 0)
        for row in range(4):
            z_m = -base_depth + row * 0.14
            self._add_box(f_verts, f_faces, f_mats, (0.0, -0.065 * ts, z_m), (w * ts, 0.0, z_m + 0.02 * ts), 1)

        self._add_box(f_verts, f_faces, f_mats, (w * ts, 0.0, -base_depth), (w * ts + 0.06 * ts, 10.5 * ts, 0.0), 0)
        for row in range(4):
            z_m = -base_depth + row * 0.14
            self._add_box(f_verts, f_faces, f_mats, (w * ts, 0.0, z_m), (w * ts + 0.065 * ts, 10.5 * ts, z_m + 0.02 * ts), 1)

        self._add_box(f_verts, f_faces, f_mats, (w * ts, 10.5 * ts, -base_depth), (w * ts + 0.06 * ts, d * ts, 0.90), 0)
        for row in range(9):
            z_m = -base_depth + row * 0.15
            self._add_box(f_verts, f_faces, f_mats, (w * ts, 10.5 * ts, z_m), (w * ts + 0.065 * ts, d * ts, z_m + 0.02 * ts), 1)

        mesh_f = bpy.data.meshes.new("HabboFoundation_Mesh")
        mesh_f.from_pydata(f_verts, [], f_faces)
        mesh_f.update()
        obj_f = bpy.data.objects.new("HabboFoundation", mesh_f)
        bpy.context.scene.collection.objects.link(obj_f)
        obj_f.data.materials.append(m["brick_base"])
        obj_f.data.materials.append(m["brick_mortar"])
        for p, midx in enumerate(f_mats):
            obj_f.data.polygons[p].material_index = midx
        objs.append(obj_f)

        s_verts, s_faces, s_mats = [], [], []
        for gx in range(0, w):
            for gy in range(0, 11):
                x0, y0 = gx * ts, gy * ts
                x1, y1 = (gx + 1) * ts, (gy + 1) * ts
                self._add_box(s_verts, s_faces, s_mats, (x0, y0, -0.05), (x1, y1, 0.0), 0)
                self._add_box(s_verts, s_faces, s_mats, (x0, y0, 0.001), (x1, y0 + 0.015 * ts, 0.004), 1)
                self._add_box(s_verts, s_faces, s_mats, (x0, y0, 0.001), (x0 + 0.015 * ts, y1, 0.004), 1)

        mesh_s = bpy.data.meshes.new("HabboFloorStone_Mesh")
        mesh_s.from_pydata(s_verts, [], s_faces)
        mesh_s.update()
        obj_s = bpy.data.objects.new("HabboFloorStone", mesh_s)
        bpy.context.scene.collection.objects.link(obj_s)
        obj_s.data.materials.append(m["stone_tile"])
        obj_s.data.materials.append(m["stone_grout"])
        for p, midx in enumerate(s_mats):
            obj_s.data.polygons[p].material_index = midx
        objs.append(obj_s)

        d_verts, d_faces, d_mats = [], [], []
        dx0, dy0 = 5.6 * ts, 3.2 * ts
        dx1, dy1 = 14.5 * ts, 7.5 * ts
        self._add_box(d_verts, d_faces, d_mats, (dx0, dy0, 0.0), (dx1, dy1, 0.015 * ts), 0)

        for col in range(12):
            for row in range(6):
                lx = dx0 + 0.35 * ts + col * 0.70 * ts
                ly = dy0 + 0.35 * ts + row * 0.65 * ts
                lr = 0.065 * ts
                self._add_box(d_verts, d_faces, d_mats, (lx - lr, ly - lr, 0.015 * ts), (lx + lr, ly + lr, 0.025 * ts), 1)

        mesh_d = bpy.data.meshes.new("HabboDanceFloor_Mesh")
        mesh_d.from_pydata(d_verts, [], d_faces)
        mesh_d.update()
        obj_d = bpy.data.objects.new("HabboDanceFloor", mesh_d)
        bpy.context.scene.collection.objects.link(obj_d)
        obj_d.data.materials.append(m["dance_base"])
        obj_d.data.materials.append(m["dance_light"])
        for p, midx in enumerate(d_mats):
            obj_d.data.polygons[p].material_index = midx
        objs.append(obj_d)

        st_verts, st_faces, st_mats = [], [], []
        steps = 10
        st_x0 = 5.6 * ts
        st_x1 = 14.5 * ts
        st_y0 = 7.5 * ts
        st_y1 = 10.5 * ts
        step_d = (st_y1 - st_y0) / float(steps)
        step_h = 0.90 / float(steps)

        for s in range(steps):
            cur_z = s * step_h
            cur_top = (s + 1) * step_h
            sy0 = st_y0 + s * step_d
            sy1 = sy0 + step_d
            self._add_box(st_verts, st_faces, st_mats, (st_x0, sy0, 0.0), (st_x1, sy1, cur_top), 0)
            self._add_box(st_verts, st_faces, st_mats, (st_x0, sy0, cur_top - 0.015 * ts), (st_x1, sy1, cur_top), 1)
            self._add_box(st_verts, st_faces, st_mats, (st_x0, sy0, cur_top - 0.01 * ts), (st_x1, sy0 + 0.025 * ts, cur_top + 0.005 * ts), 2)

        mesh_st = bpy.data.meshes.new("HabboGrandStairs_Mesh")
        mesh_st.from_pydata(st_verts, [], st_faces)
        mesh_st.update()
        obj_st = bpy.data.objects.new("HabboGrandStairs", mesh_st)
        bpy.context.scene.collection.objects.link(obj_st)
        obj_st.data.materials.append(m["wood_riser"])
        obj_st.data.materials.append(m["wood_plank"])
        obj_st.data.materials.append(m["brass"])
        for p, midx in enumerate(st_mats):
            obj_st.data.polygons[p].material_index = midx
        objs.append(obj_st)

        stair_rail = self._create_stair_railing("HabboStairRail", st_x1, st_y0, st_y1, 0.0, 0.90, ts, m)
        objs.append(stair_rail)

        bp_verts, bp_faces, bp_mats = [], [], []
        bp_x0 = 0.0
        bp_x1 = w * ts
        bp_y0 = 10.5 * ts
        bp_y1 = d * ts
        self._add_box(bp_verts, bp_faces, bp_mats, (bp_x0, bp_y0, 0.0), (bp_x1, bp_y1, 0.90), 0)

        for row in range(int((bp_y1 - bp_y0) / (0.35 * ts))):
            py = bp_y0 + row * 0.35 * ts
            self._add_box(bp_verts, bp_faces, bp_mats, (bp_x0, py, 0.90), (bp_x1, py + 0.015 * ts, 0.905), 1)

        self._add_box(bp_verts, bp_faces, bp_mats, (0.0, bp_y0 - 0.04 * ts, 0.0), (st_x0, bp_y0, 0.90), 2)
        self._add_box(bp_verts, bp_faces, bp_mats, (st_x1, bp_y0 - 0.04 * ts, 0.0), (bp_x1, bp_y0, 0.90), 2)

        mesh_bp = bpy.data.meshes.new("HabboBarPlatform_Mesh")
        mesh_bp.from_pydata(bp_verts, [], bp_faces)
        mesh_bp.update()
        obj_bp = bpy.data.objects.new("HabboBarPlatform", mesh_bp)
        bpy.context.scene.collection.objects.link(obj_bp)
        obj_bp.data.materials.append(m["wood_plank"])
        obj_bp.data.materials.append(m["wood_groove"])
        obj_bp.data.materials.append(m["wood_riser"])
        for p, midx in enumerate(bp_mats):
            obj_bp.data.polygons[p].material_index = midx
        objs.append(obj_bp)

        center_divider = self._create_glass_divider("HabboCenterDivider", 5.4 * ts, 3.2 * ts, 5.4 * ts, 10.5 * ts, 0.0, 0.65, ts, m)
        objs.append(center_divider)

        deck_divider = self._create_glass_divider("HabboDeckDivider", 0.0, bp_y0, 5.4 * ts, bp_y0, 0.90, 0.65, ts, m)
        objs.append(deck_divider)

        return objs

    def _create_stair_railing(self, name, rx, y0, y1, z0, z1, ts, m):
        verts, faces, mat_indices = [], [], []
        post_r = 0.025 * ts
        rail_h = 0.55
        steps = 6

        for i in range(steps + 1):
            t = float(i) / float(steps)
            cy = y0 + t * (y1 - y0)
            cz = z0 + t * (z1 - z0)
            self._add_box(verts, faces, mat_indices, (rx - post_r, cy - post_r, cz), (rx + post_r, cy + post_r, cz + rail_h), 0)

        for i in range(steps):
            t0 = float(i) / float(steps)
            t1 = float(i + 1) / float(steps)
            cy0 = y0 + t0 * (y1 - y0)
            cy1 = y0 + t1 * (y1 - y0)
            cz0 = z0 + t0 * (z1 - z0)
            cz1 = z0 + t1 * (z1 - z0)

            thick = 0.012 * ts
            self._add_box(verts, faces, mat_indices, (rx - thick, cy0, cz0 + 0.05 * ts), (rx + thick, cy1, cz1 + rail_h - 0.05 * ts), 1)
            self._add_box(verts, faces, mat_indices, (rx - post_r * 1.2, cy0, cz0 + rail_h - 0.025 * ts), (rx + post_r * 1.2, cy1, cz1 + rail_h), 0)

        mesh = bpy.data.meshes.new(f"{name}_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.visible_shadow = False
        obj.data.materials.append(m["brass"])
        obj.data.materials.append(m["glass_balustrade"])
        for p, midx in enumerate(mat_indices):
            obj.data.polygons[p].material_index = midx
        return obj

    def _create_glass_divider(self, name, x0, y0, x1, y1, base_z, h, ts, m):
        verts, faces, mat_indices = [], [], []
        thick = 0.02 * ts
        post_r = 0.03 * ts

        self._add_box(verts, faces, mat_indices, (x0 - post_r, y0 - post_r, base_z), (x0 + post_r, y0 + post_r, base_z + h), 0)
        self._add_box(verts, faces, mat_indices, (x1 - post_r, y1 - post_r, base_z), (x1 + post_r, y1 + post_r, base_z + h), 0)
        self._add_box(verts, faces, mat_indices, (x0, y0 - thick, base_z + 0.04 * ts), (x1, y1 + thick, base_z + h - 0.04 * ts), 1)
        self._add_box(verts, faces, mat_indices, (x0, y0 - thick * 1.5, base_z + h - 0.04 * ts), (x1, y1 + thick * 1.5, base_z + h), 0)
        self._add_box(verts, faces, mat_indices, (x0, y0 - thick * 1.5, base_z), (x1, y1 + thick * 1.5, base_z + 0.04 * ts), 0)

        for t in [0.0, 0.5, 1.0]:
            px = x0 + t * (x1 - x0)
            py = y0 + t * (y1 - y0)
            pr = 0.015 * ts
            self._add_box(verts, faces, mat_indices, (px - pr, py - pr, base_z), (px + pr, py + pr, 3.60), 2)

        mesh = bpy.data.meshes.new(f"{name}_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.visible_shadow = False
        obj.data.materials.append(m["brass"])
        obj.data.materials.append(m["glass_balustrade"])
        obj.data.materials.append(m["metal_black"])
        for p, midx in enumerate(mat_indices):
            obj.data.polygons[p].material_index = midx
        return obj

    def _build_walls_and_vault(self, w, d, ts, m):
        objs = []
        wall_thick = 0.20 * ts
        z_spring = 2.20
        z_top = 3.60

        ww_verts, ww_faces, ww_mats = [], [], []
        panel_steps = 3
        slopes = [0.08 * ts, 0.20 * ts, 0.38 * ts]
        z_levels = [z_spring, z_spring + 0.45, z_spring + 0.90, z_top]

        self._add_box(ww_verts, ww_faces, ww_mats, (-wall_thick, 0.0, 0.0), (0.0, d * ts, z_spring), 0)

        for s in range(panel_steps):
            cz0 = z_levels[s]
            cz1 = z_levels[s + 1]
            slope_in = slopes[s]
            self._add_box(ww_verts, ww_faces, ww_mats, (-wall_thick, 0.0, cz0), (slope_in, d * ts, cz1), 1)
            for gy in range(0, d, 2):
                py = gy * ts
                self._add_box(ww_verts, ww_faces, ww_mats, (slope_in - 0.015 * ts, py, cz0), (slope_in, py + 0.035 * ts, cz1), 2)
            self._add_box(ww_verts, ww_faces, ww_mats, (slope_in - 0.015 * ts, 0.0, cz1 - 0.02 * ts), (slope_in, d * ts, cz1), 2)

        self._add_box(ww_verts, ww_faces, ww_mats, (-wall_thick, 0.0, z_top - 0.03 * ts), (slopes[-1] + 0.05 * ts, d * ts, z_top + 0.06 * ts), 1)

        mesh_ww = bpy.data.meshes.new("HabboWestWall_Mesh")
        mesh_ww.from_pydata(ww_verts, [], ww_faces)
        mesh_ww.update()
        obj_ww = bpy.data.objects.new("HabboWestWall", mesh_ww)
        bpy.context.scene.collection.objects.link(obj_ww)
        obj_ww.data.materials.append(m["wall_damask"])
        obj_ww.data.materials.append(m["wall_vault"])
        obj_ww.data.materials.append(m["wall_seam"])
        for p, midx in enumerate(ww_mats):
            obj_ww.data.polygons[p].material_index = midx
        objs.append(obj_ww)

        rw_verts, rw_faces, rw_mats = [], [], []
        bar_wall_end = 14.5 * ts
        self._add_box(rw_verts, rw_faces, rw_mats, (0.0, d * ts, 0.90), (bar_wall_end, d * ts + wall_thick, z_spring), 0)

        for s in range(panel_steps):
            cz0 = z_levels[s]
            cz1 = z_levels[s + 1]
            slope_in = slopes[s]
            self._add_box(rw_verts, rw_faces, rw_mats, (0.0, d * ts - slope_in, cz0), (bar_wall_end, d * ts + wall_thick, cz1), 1)
            for gx in range(0, 15, 2):
                px = gx * ts
                self._add_box(rw_verts, rw_faces, rw_mats, (px, d * ts - slope_in - 0.015 * ts, cz0), (px + 0.035 * ts, d * ts - slope_in, cz1), 2)
            self._add_box(rw_verts, rw_faces, rw_mats, (0.0, d * ts - slope_in - 0.015 * ts, cz1 - 0.02 * ts), (bar_wall_end, d * ts - slope_in, cz1), 2)

        self._add_box(rw_verts, rw_faces, rw_mats, (0.0, d * ts - slopes[-1] - 0.05 * ts, z_top - 0.03 * ts), (bar_wall_end, d * ts + wall_thick, z_top + 0.06 * ts), 1)

        door_x0 = 12.8 * ts
        door_x1 = 14.2 * ts
        self._add_box(rw_verts, rw_faces, rw_mats, (door_x0, d * ts - 0.02 * ts, 0.90), (door_x1, d * ts + 0.01 * ts, 2.35), 3)
        self._add_box(rw_verts, rw_faces, rw_mats, (door_x0 + 0.05 * ts, d * ts - 0.03 * ts, 0.90), (door_x1 - 0.05 * ts, d * ts - 0.01 * ts, 2.30), 4)

        mesh_rw = bpy.data.meshes.new("HabboBarWall_Mesh")
        mesh_rw.from_pydata(rw_verts, [], rw_faces)
        mesh_rw.update()
        obj_rw = bpy.data.objects.new("HabboBarWall", mesh_rw)
        bpy.context.scene.collection.objects.link(obj_rw)
        obj_rw.data.materials.append(m["wall_damask"])
        obj_rw.data.materials.append(m["wall_vault"])
        obj_rw.data.materials.append(m["wall_seam"])
        obj_rw.data.materials.append(m["wood_door_frame"])
        obj_rw.data.materials.append(m["wood_door"])
        for p, midx in enumerate(rw_mats):
            obj_rw.data.polygons[p].material_index = midx
        objs.append(obj_rw)

        ew_verts, ew_faces, ew_mats = [], [], []
        hw_x0 = bar_wall_end
        hw_x1 = w * ts
        self._add_box(ew_verts, ew_faces, ew_mats, (hw_x0, d * ts, 0.90), (hw_x1, d * ts + wall_thick, 2.70), 0)

        for s in range(panel_steps):
            cz0 = z_levels[s]
            cz1 = z_levels[s + 1]
            slope_in = slopes[s]
            self._add_box(ew_verts, ew_faces, ew_mats, (hw_x0, d * ts - slope_in, cz0), (hw_x1, d * ts + wall_thick, cz1), 0)
            for gx in range(15, w, 2):
                px = gx * ts
                self._add_box(ew_verts, ew_faces, ew_mats, (px, d * ts - slope_in - 0.015 * ts, cz0), (px + 0.035 * ts, d * ts - slope_in, cz1), 1)

        sign_x0 = hw_x0 + 0.3 * ts
        sign_x1 = hw_x1 - 0.3 * ts
        sign_y = d * ts - 0.03 * ts
        sign_z0 = 1.25
        sign_z1 = 2.25

        self._add_box(ew_verts, ew_faces, ew_mats, (sign_x0, sign_y - 0.02 * ts, sign_z0), (sign_x1, sign_y, sign_z1), 2)
        self._add_box(ew_verts, ew_faces, ew_mats, (sign_x0 + 0.05 * ts, sign_y - 0.035 * ts, sign_z0 + 0.05 * ts), (sign_x1 - 0.05 * ts, sign_y - 0.01 * ts, sign_z1 - 0.05 * ts), 4)

        letter_z0 = sign_z0 + 0.45
        letter_z1 = sign_z1 - 0.15

        h_x = sign_x0 + 0.35 * ts
        self._add_box(ew_verts, ew_faces, ew_mats, (h_x, sign_y - 0.06 * ts, letter_z0), (h_x + 0.07 * ts, sign_y - 0.03 * ts, letter_z1), 3)
        self._add_box(ew_verts, ew_faces, ew_mats, (h_x + 0.28 * ts, sign_y - 0.06 * ts, letter_z0), (h_x + 0.35 * ts, sign_y - 0.03 * ts, letter_z1), 3)
        self._add_box(ew_verts, ew_faces, ew_mats, (h_x, sign_y - 0.06 * ts, letter_z0 + 0.22), (h_x + 0.35 * ts, sign_y - 0.03 * ts, letter_z0 + 0.28), 3)

        e_x = h_x + 0.50 * ts
        self._add_box(ew_verts, ew_faces, ew_mats, (e_x, sign_y - 0.06 * ts, letter_z0), (e_x + 0.07 * ts, sign_y - 0.03 * ts, letter_z1), 3)
        self._add_box(ew_verts, ew_faces, ew_mats, (e_x, sign_y - 0.06 * ts, letter_z1 - 0.06 * ts), (e_x + 0.32 * ts, sign_y - 0.03 * ts, letter_z1), 3)
        self._add_box(ew_verts, ew_faces, ew_mats, (e_x, sign_y - 0.06 * ts, letter_z0 + 0.22), (e_x + 0.28 * ts, sign_y - 0.03 * ts, letter_z0 + 0.28), 3)
        self._add_box(ew_verts, ew_faces, ew_mats, (e_x, sign_y - 0.06 * ts, letter_z0), (e_x + 0.32 * ts, sign_y - 0.03 * ts, letter_z0 + 0.06 * ts), 3)

        l_x = e_x + 0.48 * ts
        self._add_box(ew_verts, ew_faces, ew_mats, (l_x, sign_y - 0.06 * ts, letter_z0), (l_x + 0.07 * ts, sign_y - 0.03 * ts, letter_z1), 3)
        self._add_box(ew_verts, ew_faces, ew_mats, (l_x, sign_y - 0.06 * ts, letter_z0), (l_x + 0.32 * ts, sign_y - 0.03 * ts, letter_z0 + 0.06 * ts), 3)

        p_x = l_x + 0.48 * ts
        self._add_box(ew_verts, ew_faces, ew_mats, (p_x, sign_y - 0.06 * ts, letter_z0), (p_x + 0.07 * ts, sign_y - 0.03 * ts, letter_z1), 3)
        self._add_box(ew_verts, ew_faces, ew_mats, (p_x, sign_y - 0.06 * ts, letter_z1 - 0.06 * ts), (p_x + 0.32 * ts, sign_y - 0.03 * ts, letter_z1), 3)
        self._add_box(ew_verts, ew_faces, ew_mats, (p_x + 0.25 * ts, sign_y - 0.06 * ts, letter_z0 + 0.25), (p_x + 0.32 * ts, sign_y - 0.03 * ts, letter_z1), 3)
        self._add_box(ew_verts, ew_faces, ew_mats, (p_x, sign_y - 0.06 * ts, letter_z0 + 0.22), (p_x + 0.32 * ts, sign_y - 0.03 * ts, letter_z0 + 0.28), 3)

        excl_x = p_x + 0.48 * ts
        self._add_box(ew_verts, ew_faces, ew_mats, (excl_x, sign_y - 0.06 * ts, letter_z0 + 0.15), (excl_x + 0.08 * ts, sign_y - 0.03 * ts, letter_z1), 3)
        self._add_box(ew_verts, ew_faces, ew_mats, (excl_x, sign_y - 0.06 * ts, letter_z0), (excl_x + 0.08 * ts, sign_y - 0.03 * ts, letter_z0 + 0.08 * ts), 3)

        arrow_x0 = sign_x0 + 0.4 * ts
        arrow_x1 = sign_x1 - 0.4 * ts
        arrow_z = sign_z0 + 0.16
        self._add_box(ew_verts, ew_faces, ew_mats, (arrow_x0, sign_y - 0.06 * ts, arrow_z), (arrow_x1, sign_y - 0.03 * ts, arrow_z + 0.06 * ts), 3)
        self._add_box(ew_verts, ew_faces, ew_mats, (arrow_x0, sign_y - 0.06 * ts, arrow_z - 0.06 * ts), (arrow_x0 + 0.22 * ts, sign_y - 0.03 * ts, arrow_z + 0.12 * ts), 3)

        mesh_ew = bpy.data.meshes.new("HabboHelpWall_Mesh")
        mesh_ew.from_pydata(ew_verts, [], ew_faces)
        mesh_ew.update()
        obj_ew = bpy.data.objects.new("HabboHelpWall", mesh_ew)
        bpy.context.scene.collection.objects.link(obj_ew)
        obj_ew.data.materials.append(m["wall_vault"])
        obj_ew.data.materials.append(m["wall_seam"])
        obj_ew.data.materials.append(m["neon_frame"])
        obj_ew.data.materials.append(m["neon_red"])
        obj_ew.data.materials.append(m["neon_backing"])
        for p, midx in enumerate(ew_mats):
            obj_ew.data.polygons[p].material_index = midx
        objs.append(obj_ew)

        col_coords = [
            (0.0, 5.5 * ts, 0.0, 2.70),
            (0.0, 11.0 * ts, 0.0, 2.70),
            (0.0, d * ts, 0.90, 3.20),
            (bar_wall_end, d * ts, 0.90, 3.20),
            (w * ts, d * ts, 0.90, 2.80),
        ]
        c_verts, c_faces, c_mats = [], [], []
        cw = 0.30 * ts
        for cx, cy, cz0, cz1 in col_coords:
            self._add_box(c_verts, c_faces, c_mats, (cx - cw * 0.5, cy - cw * 0.5, cz0), (cx + cw * 0.5, cy + cw * 0.5, cz1), 0)
            self._add_box(c_verts, c_faces, c_mats, (cx - cw * 0.5 - 0.02 * ts, cy - cw * 0.5 - 0.02 * ts, cz0), (cx + cw * 0.5 + 0.02 * ts, cy + cw * 0.5 + 0.02 * ts, cz0 + 0.12 * ts), 1)

        mesh_c = bpy.data.meshes.new("HabboColumns_Mesh")
        mesh_c.from_pydata(c_verts, [], c_faces)
        mesh_c.update()
        obj_c = bpy.data.objects.new("HabboColumns", mesh_c)
        bpy.context.scene.collection.objects.link(obj_c)
        obj_c.data.materials.append(m["wood_column"])
        obj_c.data.materials.append(m["wood_column_dark"])
        for p, midx in enumerate(c_mats):
            obj_c.data.polygons[p].material_index = midx
        objs.append(obj_c)

        return objs

    def _build_bar_deck_and_counter(self, w, d, ts, m):
        objs = []
        b_verts, b_faces, b_mats = [], [], []

        bar_y = 15.0 * ts
        bar_x0 = 1.0 * ts
        bar_x1 = 14.2 * ts
        bar_z0 = 0.90
        bar_h = 0.85
        bar_thick = 0.45 * ts

        self._add_box(b_verts, b_faces, b_mats, (bar_x0, bar_y - bar_thick, bar_z0), (bar_x1, bar_y, bar_z0 + bar_h - 0.05 * ts), 0)
        self._add_box(b_verts, b_faces, b_mats, (bar_x0, bar_y - bar_thick - 0.03 * ts, bar_z0 + 0.08 * ts), (bar_x1, bar_y - bar_thick, bar_z0 + 0.12 * ts), 1)
        self._add_box(b_verts, b_faces, b_mats, (bar_x0 - 0.04 * ts, bar_y - bar_thick - 0.05 * ts, bar_z0 + bar_h - 0.05 * ts), (bar_x1 + 0.04 * ts, bar_y + 0.03 * ts, bar_z0 + bar_h), 2)

        tap_positions = [bar_x0 + 2.0 * ts, bar_x0 + 5.0 * ts, bar_x0 + 8.0 * ts, bar_x0 + 11.0 * ts]
        for tx in tap_positions:
            self._add_box(b_verts, b_faces, b_mats, (tx - 0.05 * ts, bar_y - bar_thick * 0.6, bar_z0 + bar_h), (tx + 0.05 * ts, bar_y - bar_thick * 0.4, bar_z0 + bar_h + 0.25 * ts), 1)
            self._add_box(b_verts, b_faces, b_mats, (tx - 0.025 * ts, bar_y - bar_thick * 0.7, bar_z0 + bar_h + 0.20 * ts), (tx + 0.025 * ts, bar_y - bar_thick * 0.6, bar_z0 + bar_h + 0.30 * ts), 3)

        for gx in range(int(bar_x0 / ts), int(bar_x1 / ts)):
            gx_w = gx * ts + 0.5 * ts
            self._add_box(b_verts, b_faces, b_mats, (gx_w - 0.035 * ts, bar_y - bar_thick * 0.8, bar_z0 + bar_h), (gx_w + 0.035 * ts, bar_y - bar_thick * 0.7, bar_z0 + bar_h + 0.08 * ts), 4)

        mesh_b = bpy.data.meshes.new("HabboBarCounter_Mesh")
        mesh_b.from_pydata(b_verts, [], b_faces)
        mesh_b.update()
        obj_b = bpy.data.objects.new("HabboBarCounter", mesh_b)
        bpy.context.scene.collection.objects.link(obj_b)
        obj_b.data.materials.append(m["bar_front"])
        obj_b.data.materials.append(m["brass"])
        obj_b.data.materials.append(m["bar_top"])
        obj_b.data.materials.append(m["metal_black"])
        obj_b.data.materials.append(m["glass"])
        for p, midx in enumerate(b_mats):
            obj_b.data.polygons[p].material_index = midx
        objs.append(obj_b)

        sh_verts, sh_faces, sh_mats = [], [], []
        sh_y = d * ts - 0.08 * ts
        sh_x0 = 3.5 * ts
        sh_x1 = 12.5 * ts

        shelf_levels = [bar_z0 + 0.50, bar_z0 + 0.78, bar_z0 + 1.06]
        for sz in shelf_levels:
            self._add_box(sh_verts, sh_faces, sh_mats, (sh_x0, sh_y - 0.20 * ts, sz), (sh_x1, sh_y, sz + 0.02 * ts), 0)
            self._add_box(sh_verts, sh_faces, sh_mats, (sh_x0, sh_y - 0.21 * ts, sz - 0.01 * ts), (sh_x1, sh_y - 0.19 * ts, sz + 0.03 * ts), 1)

            bottle_count = 16
            b_step = (sh_x1 - sh_x0 - 0.3 * ts) / float(bottle_count)
            for bi in range(bottle_count):
                bx = sh_x0 + 0.15 * ts + bi * b_step
                bw = 0.03 * ts
                bh = 0.15 * ts
                mat_bottle_idx = 2 + (bi % 4)
                self._add_box(sh_verts, sh_faces, sh_mats, (bx - bw, sh_y - 0.15 * ts, sz + 0.02 * ts), (bx + bw, sh_y - 0.06 * ts, sz + 0.02 * ts + bh), mat_bottle_idx)

        cash_x = sh_x0 - 0.6 * ts
        cash_z = bar_z0 + 0.50
        self._add_box(sh_verts, sh_faces, sh_mats, (cash_x - 0.22 * ts, sh_y - 0.30 * ts, cash_z), (cash_x + 0.22 * ts, sh_y - 0.05 * ts, cash_z + 0.25 * ts), 6)
        self._add_box(sh_verts, sh_faces, sh_mats, (cash_x - 0.18 * ts, sh_y - 0.31 * ts, cash_z + 0.04 * ts), (cash_x + 0.18 * ts, sh_y - 0.27 * ts, cash_z + 0.12 * ts), 1)

        post_x0 = 1.2 * ts
        post_x1 = 2.6 * ts
        post_z0 = bar_z0 + 0.60
        post_z1 = bar_z0 + 1.30
        self._add_box(sh_verts, sh_faces, sh_mats, (post_x0 - 0.03 * ts, sh_y - 0.02 * ts, post_z0 - 0.03 * ts), (post_x1 + 0.03 * ts, sh_y, post_z1 + 0.03 * ts), 1)
        self._add_box(sh_verts, sh_faces, sh_mats, (post_x0, sh_y - 0.025 * ts, post_z0), (post_x1, sh_y - 0.01 * ts, post_z1), 7)
        self._add_box(sh_verts, sh_faces, sh_mats, (post_x0 + 0.20 * ts, sh_y - 0.035 * ts, post_z0 + 0.15 * ts), (post_x1 - 0.20 * ts, sh_y - 0.015 * ts, post_z1 - 0.15 * ts), 8)
        self._add_box(sh_verts, sh_faces, sh_mats, (post_x0 + 0.30 * ts, sh_y - 0.04 * ts, post_z0 + 0.40 * ts), (post_x1 - 0.30 * ts, sh_y - 0.02 * ts, post_z1 - 0.10 * ts), 9)

        mesh_sh = bpy.data.meshes.new("HabboBackBar_Mesh")
        mesh_sh.from_pydata(sh_verts, [], sh_faces)
        mesh_sh.update()
        obj_sh = bpy.data.objects.new("HabboBackBar", mesh_sh)
        bpy.context.scene.collection.objects.link(obj_sh)
        obj_sh.data.materials.append(m["glass"])
        obj_sh.data.materials.append(m["brass"])
        obj_sh.data.materials.append(m["bottle_cyan"])
        obj_sh.data.materials.append(m["bottle_green"])
        obj_sh.data.materials.append(m["bottle_red"])
        obj_sh.data.materials.append(m["bottle_amber"])
        obj_sh.data.materials.append(m["cash_register"])
        obj_sh.data.materials.append(m["poster_canvas"])
        obj_sh.data.materials.append(m["poster_art"])
        obj_sh.data.materials.append(m["poster_skin"])
        for p, midx in enumerate(sh_mats):
            obj_sh.data.polygons[p].material_index = midx
        objs.append(obj_sh)

        p_verts, p_faces, p_mats = [], [], []
        lamp_count = 8
        lamp_step = (bar_x1 - bar_x0 - 0.8 * ts) / float(lamp_count - 1)
        lamp_y = bar_y - bar_thick * 0.5
        lamp_z = 2.40

        for li in range(lamp_count):
            lx = bar_x0 + 0.4 * ts + li * lamp_step
            self._add_box(p_verts, p_faces, p_mats, (lx - 0.01 * ts, lamp_y - 0.01 * ts, lamp_z), (lx + 0.01 * ts, lamp_y + 0.01 * ts, 3.60), 0)
            sr = 0.12 * ts
            self._add_box(p_verts, p_faces, p_mats, (lx - sr, lamp_y - sr, lamp_z - 0.08 * ts), (lx + sr, lamp_y + sr, lamp_z), 1)
            br = 0.04 * ts
            self._add_box(p_verts, p_faces, p_mats, (lx - br, lamp_y - br, lamp_z - 0.09 * ts), (lx + br, lamp_y + br, lamp_z - 0.04 * ts), 2)

        mesh_p = bpy.data.meshes.new("HabboPendants_Mesh")
        mesh_p.from_pydata(p_verts, [], p_faces)
        mesh_p.update()
        obj_p = bpy.data.objects.new("HabboPendants", mesh_p)
        bpy.context.scene.collection.objects.link(obj_p)
        obj_p.data.materials.append(m["metal_black"])
        obj_p.data.materials.append(m["pendant_shade"])
        obj_p.data.materials.append(m["pendant_bulb"])
        for p, midx in enumerate(p_mats):
            obj_p.data.polygons[p].material_index = midx
        objs.append(obj_p)

        return objs

    def _build_seating_booths(self, w, d, ts, m):
        objs = []
        s_verts, s_faces, s_mats = [], [], []

        self._add_curved_sofa_block(s_verts, s_faces, s_mats, 0.6 * ts, 12.0 * ts, 4.6 * ts, 16.5 * ts, 0.90, ts)
        self._add_counter_ledge(s_verts, s_faces, s_mats, 4.6 * ts, 12.5 * ts, 4.6 * ts, 16.0 * ts, 0.90, ts)

        self._add_curved_sofa_block(s_verts, s_faces, s_mats, 0.6 * ts, 6.0 * ts, 4.6 * ts, 10.5 * ts, 0.0, ts)
        self._add_counter_ledge(s_verts, s_faces, s_mats, 4.6 * ts, 6.5 * ts, 4.6 * ts, 10.0 * ts, 0.0, ts)

        self._add_curved_sofa_block(s_verts, s_faces, s_mats, 0.6 * ts, 1.5 * ts, 4.6 * ts, 4.8 * ts, 0.0, ts)

        mesh_s = bpy.data.meshes.new("HabboSofas_Mesh")
        mesh_s.from_pydata(s_verts, [], s_faces)
        mesh_s.update()
        obj_s = bpy.data.objects.new("HabboSofas", mesh_s)
        bpy.context.scene.collection.objects.link(obj_s)
        obj_s.data.materials.append(m["sofa_base"])
        obj_s.data.materials.append(m["sofa_cushion"])
        obj_s.data.materials.append(m["sofa_cushion_edge"])
        obj_s.data.materials.append(m["sofa_table"])
        obj_s.data.materials.append(m["metal_black"])
        for p, midx in enumerate(s_mats):
            obj_s.data.polygons[p].material_index = midx
        objs.append(obj_s)

        return objs

    def _add_curved_sofa_block(self, verts, faces, mats, x0, y0, x1, y1, base_z, ts):
        sofa_h = 0.42
        back_h = 0.78
        seat_w = 0.65 * ts

        self._add_box(verts, faces, mats, (x0, y0, base_z), (x1, y1, base_z + 0.12 * ts), 0)

        self._add_box(verts, faces, mats, (x0, y0, base_z + 0.12 * ts), (x1, y1, base_z + sofa_h), 1)
        self._add_box(verts, faces, mats, (x0, y0, base_z + sofa_h - 0.02 * ts), (x1, y1, base_z + sofa_h), 2)

        self._add_box(verts, faces, mats, (x0, y1 - seat_w, base_z + sofa_h), (x1, y1, base_z + back_h), 1)
        self._add_box(verts, faces, mats, (x0, y0, base_z + sofa_h), (x0 + seat_w, y1, base_z + back_h), 1)
        self._add_box(verts, faces, mats, (x0, y0, base_z + sofa_h), (x1, y0 + seat_w, base_z + back_h), 1)

    def _add_counter_ledge(self, verts, faces, mats, x0, y0, x1, y1, base_z, ts):
        ledge_w = 0.30 * ts
        ledge_h = 0.04 * ts
        lz = base_z + 0.85
        self._add_box(verts, faces, mats, (x0 - ledge_w * 0.5, y0, lz), (x1 + ledge_w * 0.5, y1, lz + ledge_h), 3)

        post_r = 0.015 * ts
        self._add_box(verts, faces, mats, (x0 - post_r, y0 - post_r, base_z), (x0 + post_r, y0 + post_r, 3.60), 4)
        self._add_box(verts, faces, mats, (x1 - post_r, y1 - post_r, base_z), (x1 + post_r, y1 + post_r, 3.60), 4)

    def _build_exit_portal(self, ts, m):
        objs = []
        e_verts, e_faces, e_mats = [], [], []

        ex = 3.2 * ts
        ey = 0.8 * ts
        ez = 0.0

        self._add_box(e_verts, e_faces, e_mats, (ex - 0.7 * ts, ey - 0.4 * ts, ez), (ex + 0.7 * ts, ey + 0.4 * ts, ez + 0.02 * ts), 0)

        pole_r = 0.025 * ts
        pole_h = 1.75
        pw = 0.65 * ts
        self._add_box(e_verts, e_faces, e_mats, (ex - pw - pole_r, ey - pole_r, ez), (ex - pw + pole_r, ey + pole_r, ez + pole_h), 1)
        self._add_box(e_verts, e_faces, e_mats, (ex + pw - pole_r, ey - pole_r, ez), (ex + pw + pole_r, ey + pole_r, ez + pole_h), 1)

        sign_w = 0.75 * ts
        sign_h = 0.30 * ts
        sign_z = ez + pole_h - 0.10 * ts
        self._add_box(e_verts, e_faces, e_mats, (ex - sign_w * 0.5, ey - 0.06 * ts, sign_z), (ex + sign_w * 0.5, ey + 0.06 * ts, sign_z + sign_h), 2)
        self._add_box(e_verts, e_faces, e_mats, (ex - sign_w * 0.4, ey - 0.07 * ts, sign_z + 0.05 * ts), (ex + sign_w * 0.4, ey + 0.07 * ts, sign_z + sign_h - 0.05 * ts), 3)

        gate_z = ez + 0.25 * ts
        gate_h = 0.45 * ts
        thick = 0.015 * ts
        self._add_box(e_verts, e_faces, e_mats, (ex - pw, ey - thick, gate_z), (ex - 0.05 * ts, ey + thick, gate_z + gate_h), 4)
        self._add_box(e_verts, e_faces, e_mats, (ex + 0.05 * ts, ey - thick, gate_z), (ex + pw, ey + thick, gate_z + gate_h), 4)

        mesh_e = bpy.data.meshes.new("HabboExitPortal_Mesh")
        mesh_e.from_pydata(e_verts, [], e_faces)
        mesh_e.update()
        obj_e = bpy.data.objects.new("HabboExitPortal", mesh_e)
        bpy.context.scene.collection.objects.link(obj_e)
        obj_e.data.materials.append(m["mat_door"])
        obj_e.data.materials.append(m["brass"])
        obj_e.data.materials.append(m["exit_box"])
        obj_e.data.materials.append(m["exit_text"])
        obj_e.data.materials.append(m["glass_balustrade"])
        for p, midx in enumerate(e_mats):
            obj_e.data.polygons[p].material_index = midx
        objs.append(obj_e)

        return objs

    def _setup_lighting_and_camera(self, w, d, ts, res_w, res_h, m):
        objs = []
        scene = bpy.context.scene

        try:
            scene.render.engine = 'BLENDER_EEVEE_NEXT'
        except Exception:
            scene.render.engine = 'BLENDER_EEVEE'

        scene.render.resolution_x = res_w
        scene.render.resolution_y = res_h
        scene.render.resolution_percentage = 100
        scene.render.film_transparent = True

        world = scene.world
        if world and world.use_nodes:
            bg_node = world.node_tree.nodes.get("Background")
            if bg_node:
                bg_node.inputs["Color"].default_value = (0.0, 0.0, 0.0, 1.0)
                bg_node.inputs["Strength"].default_value = 0.40

        cam_data = bpy.data.cameras.new("HabboBarIsoCam")
        cam_data.type = 'ORTHO'
        cam_data.ortho_scale = 13.5 * ts * 2.0
        cam_data.clip_start = 0.1
        cam_data.clip_end = 500.0

        cam_obj = bpy.data.objects.new("HabboBarIsoCam", cam_data)
        scene.collection.objects.link(cam_obj)
        scene.camera = cam_obj

        rot_x = math.radians(60.0)
        rot_y = 0.0
        rot_z = math.radians(45.0)
        cam_obj.rotation_mode = 'XYZ'
        cam_obj.rotation_euler = (rot_x, rot_y, rot_z)

        cx = 8.5 * ts
        cy = 9.8 * ts
        cz = 0.90
        dist = 70.0
        cam_obj.location = (
            cx + dist * 0.6123724356957945,
            cy - dist * 0.6123724356957945,
            cz + dist * 0.5
        )
        objs.append(cam_obj)

        sun1_data = bpy.data.lights.new(name="HabboKeySun", type='SUN')
        sun1_data.energy = 2.2
        sun1_data.color = (1.0, 0.98, 0.95)
        sun1_data.use_shadow = False
        sun1_obj = bpy.data.objects.new(name="HabboKeySun", object_data=sun1_data)
        scene.collection.objects.link(sun1_obj)
        sun1_obj.location = (cx, cy, 25.0)
        sun1_obj.rotation_euler = (math.radians(60.0), math.radians(10.0), math.radians(-30.0))
        objs.append(sun1_obj)

        sun2_data = bpy.data.lights.new(name="HabboFillSun", type='SUN')
        sun2_data.energy = 1.4
        sun2_data.color = (0.94, 0.96, 1.0)
        sun2_data.use_shadow = False
        sun2_obj = bpy.data.objects.new(name="HabboFillSun", object_data=sun2_data)
        scene.collection.objects.link(sun2_obj)
        sun2_obj.location = (cx, cy, 25.0)
        sun2_obj.rotation_euler = (math.radians(50.0), math.radians(-20.0), math.radians(45.0))
        objs.append(sun2_obj)

        front_sun = bpy.data.lights.new(name="HabboFrontSun", type='SUN')
        front_sun.energy = 1.0
        front_sun.color = (1.0, 0.97, 0.92)
        front_sun.use_shadow = False
        front_obj = bpy.data.objects.new(name="HabboFrontSun", object_data=front_sun)
        scene.collection.objects.link(front_obj)
        front_obj.location = (cx, cy, 25.0)
        front_obj.rotation_euler = (math.radians(35.0), math.radians(15.0), math.radians(15.0))
        objs.append(front_obj)

        neon_light = bpy.data.lights.new(name="HabboNeonPoint", type='POINT')
        neon_light.energy = 50.0
        neon_light.color = (1.0, 0.12, 0.25)
        neon_light.use_shadow = False
        neon_obj = bpy.data.objects.new(name="HabboNeonPoint", object_data=neon_light)
        scene.collection.objects.link(neon_obj)
        neon_obj.location = (16.5 * ts, 18.2 * ts, 1.75)
        objs.append(neon_obj)

        bar_light = bpy.data.lights.new(name="HabboBarLight", type='POINT')
        bar_light.energy = 140.0
        bar_light.color = (1.0, 0.92, 0.75)
        bar_light.use_shadow = False
        bar_obj = bpy.data.objects.new(name="HabboBarLight", object_data=bar_light)
        scene.collection.objects.link(bar_obj)
        bar_obj.location = (7.5 * ts, 15.0 * ts, 2.30)
        objs.append(bar_obj)

        dance_point = bpy.data.lights.new(name="HabboDanceLight", type='POINT')
        dance_point.energy = 70.0
        dance_point.color = (1.0, 0.90, 0.30)
        dance_point.use_shadow = False
        dance_obj = bpy.data.objects.new(name="HabboDanceLight", object_data=dance_point)
        scene.collection.objects.link(dance_obj)
        dance_obj.location = (10.0 * ts, 5.5 * ts, 0.60)
        objs.append(dance_point)

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

    def _create_toon_glass_mat(self, name, hex_color, alpha=0.40):
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
        r, g, b, _ = self._hex_to_rgba(hex_color)
        principled.inputs["Base Color"].default_value = (r, g, b, 1.0)
        if "Alpha" in principled.inputs:
            principled.inputs["Alpha"].default_value = alpha
        if "Roughness" in principled.inputs:
            principled.inputs["Roughness"].default_value = 0.10
        if "Metallic" in principled.inputs:
            principled.inputs["Metallic"].default_value = 0.05

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
