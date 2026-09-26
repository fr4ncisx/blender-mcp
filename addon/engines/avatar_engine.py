import bpy
import math
import os

class IsometricAvatarEngine:
    def build_avatar(self, params):
        name = params.get("name", "IsoAvatar")
        palette = params.get("palette", {})
        skin_color = palette.get("skinColor", "#fcd5b4")
        hair_color = palette.get("hairColor", "#4a2c11")
        shirt_color = palette.get("shirtColor", "#00f0ff")
        pants_color = palette.get("pantsColor", "#1e293b")
        shoes_color = palette.get("shoesColor", "#111827")

        scale = float(params.get("scale", 1.0))
        output_dir = params.get("outputDirectory", "output/blender/turnarounds")
        base_name = params.get("baseName", "avatar")
        res_w = int(params.get("tileWidth", 128))
        res_h = int(params.get("tileHeight", 256))
        dirs_count = int(params.get("directions", 8))

        output_dir = os.path.abspath(output_dir)
        os.makedirs(output_dir, exist_ok=True)

        for obj in list(bpy.context.scene.objects):
            bpy.data.objects.remove(obj, do_unlink=True)

        mats = [
            self._create_toon_mat("Mat_Avatar_Skin", skin_color, roughness=0.5),
            self._create_toon_mat("Mat_Avatar_Hair", hair_color, roughness=0.4),
            self._create_toon_mat("Mat_Avatar_Shirt", shirt_color, roughness=0.35),
            self._create_toon_mat("Mat_Avatar_Pants", pants_color, roughness=0.4),
            self._create_toon_mat("Mat_Avatar_Shoes", shoes_color, roughness=0.3)
        ]

        verts, faces, mat_indices = [], [], []

        self._add_box(verts, faces, mat_indices, (-0.17 * scale, -0.10 * scale, 0.0), (-0.03 * scale, 0.14 * scale, 0.10 * scale), 4)
        self._add_box(verts, faces, mat_indices, (0.03 * scale, -0.10 * scale, 0.0), (0.17 * scale, 0.14 * scale, 0.10 * scale), 4)

        self._add_box(verts, faces, mat_indices, (-0.16 * scale, -0.08 * scale, 0.10 * scale), (-0.04 * scale, 0.08 * scale, 0.72 * scale), 3)
        self._add_box(verts, faces, mat_indices, (0.04 * scale, -0.08 * scale, 0.10 * scale), (0.16 * scale, 0.08 * scale, 0.72 * scale), 3)
        self._add_box(verts, faces, mat_indices, (-0.18 * scale, -0.09 * scale, 0.72 * scale), (0.18 * scale, 0.09 * scale, 0.86 * scale), 3)

        self._add_box(verts, faces, mat_indices, (-0.20 * scale, -0.10 * scale, 0.86 * scale), (0.20 * scale, 0.10 * scale, 1.34 * scale), 2)
        self._add_box(verts, faces, mat_indices, (-0.06 * scale, -0.06 * scale, 1.34 * scale), (0.06 * scale, 0.06 * scale, 1.42 * scale), 0)

        self._add_box(verts, faces, mat_indices, (-0.31 * scale, -0.08 * scale, 1.14 * scale), (-0.20 * scale, 0.08 * scale, 1.34 * scale), 2)
        self._add_box(verts, faces, mat_indices, (-0.30 * scale, -0.07 * scale, 0.92 * scale), (-0.21 * scale, 0.07 * scale, 1.14 * scale), 2)
        self._add_box(verts, faces, mat_indices, (-0.29 * scale, -0.06 * scale, 0.76 * scale), (-0.22 * scale, 0.06 * scale, 0.92 * scale), 0)

        self._add_box(verts, faces, mat_indices, (0.20 * scale, -0.08 * scale, 1.14 * scale), (0.31 * scale, 0.08 * scale, 1.34 * scale), 2)
        self._add_box(verts, faces, mat_indices, (0.21 * scale, -0.07 * scale, 0.92 * scale), (0.30 * scale, 0.07 * scale, 1.14 * scale), 2)
        self._add_box(verts, faces, mat_indices, (0.22 * scale, -0.06 * scale, 0.76 * scale), (0.29 * scale, 0.06 * scale, 0.92 * scale), 0)

        self._add_box(verts, faces, mat_indices, (-0.16 * scale, -0.14 * scale, 1.42 * scale), (0.16 * scale, 0.14 * scale, 1.74 * scale), 0)
        self._add_box(verts, faces, mat_indices, (-0.02 * scale, 0.14 * scale, 1.54 * scale), (0.02 * scale, 0.16 * scale, 1.60 * scale), 0)

        self._add_box(verts, faces, mat_indices, (-0.18 * scale, -0.16 * scale, 1.70 * scale), (0.18 * scale, 0.13 * scale, 1.84 * scale), 1)
        self._add_box(verts, faces, mat_indices, (-0.18 * scale, -0.17 * scale, 1.46 * scale), (0.18 * scale, -0.12 * scale, 1.74 * scale), 1)
        self._add_box(verts, faces, mat_indices, (-0.19 * scale, -0.16 * scale, 1.52 * scale), (-0.15 * scale, 0.08 * scale, 1.76 * scale), 1)
        self._add_box(verts, faces, mat_indices, (0.15 * scale, -0.16 * scale, 1.52 * scale), (0.19 * scale, 0.08 * scale, 1.76 * scale), 1)
        self._add_box(verts, faces, mat_indices, (-0.17 * scale, 0.08 * scale, 1.68 * scale), (0.17 * scale, 0.16 * scale, 1.78 * scale), 1)

        mesh = bpy.data.meshes.new(f"{name}_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()

        avatar_obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(avatar_obj)

        for mat in mats:
            avatar_obj.data.materials.append(mat)
        for p, midx in enumerate(mat_indices):
            avatar_obj.data.polygons[p].material_index = midx

        bevel = avatar_obj.modifiers.new("AvatarBevel", type='BEVEL')
        bevel.width = 0.012 * scale
        bevel.segments = 2

        self._setup_camera_and_lighting(scale, res_w, res_h)

        if dirs_count == 4:
            angles = [45.0, 135.0, 225.0, 315.0]
        else:
            angles = [0.0, 45.0, 90.0, 135.0, 180.0, 225.0, 270.0, 315.0]

        rendered_files = []
        total_size = 0

        for i, angle_deg in enumerate(angles):
            avatar_obj.rotation_euler = (0.0, 0.0, math.radians(angle_deg))
            bpy.context.view_layer.update()

            out_filename = f"{base_name}_dir_{i}.png"
            out_path = os.path.join(output_dir, out_filename)
            bpy.context.scene.render.filepath = out_path
            bpy.ops.render.render(write_still=True)

            file_size = 0
            if os.path.exists(out_path):
                file_size = os.path.getsize(out_path)
                total_size += file_size

            rendered_files.append({
                "directionIndex": i,
                "angleDegrees": angle_deg,
                "filePath": out_path,
                "fileSize": file_size
            })

        avatar_obj.rotation_euler = (0.0, 0.0, 0.0)
        bpy.context.view_layer.update()

        return {
            "success": True,
            "avatarName": name,
            "directions": len(rendered_files),
            "files": rendered_files,
            "outputDirectory": output_dir,
            "renderSizeBytes": total_size
        }

    def _setup_camera_and_lighting(self, scale, res_w, res_h):
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
                bg_node.inputs["Strength"].default_value = 0.35

        cam_data = bpy.data.cameras.new("AvatarIsoCam")
        cam_data.type = 'ORTHO'
        cam_data.ortho_scale = 2.4 * scale
        cam_data.clip_start = 0.1
        cam_data.clip_end = 200.0

        cam_obj = bpy.data.objects.new("AvatarIsoCam", cam_data)
        scene.collection.objects.link(cam_obj)
        scene.camera = cam_obj

        cam_obj.rotation_mode = 'XYZ'
        cam_obj.rotation_euler = (math.radians(60.0), 0.0, math.radians(45.0))

        dist = 20.0
        cz = 0.95 * scale
        cam_obj.location = (
            dist * 0.6123724356957945,
            -dist * 0.6123724356957945,
            cz + dist * 0.5
        )

        sun_key = bpy.data.lights.new(name="AvatarKeySun", type='SUN')
        sun_key.energy = 2.5
        sun_key.color = (1.0, 0.98, 0.95)
        sun_key.use_shadow = False
        sun_key_obj = bpy.data.objects.new(name="AvatarKeySun", object_data=sun_key)
        scene.collection.objects.link(sun_key_obj)
        sun_key_obj.location = (0.0, 0.0, 10.0)
        sun_key_obj.rotation_euler = (math.radians(60.0), math.radians(10.0), math.radians(-30.0))

        sun_fill = bpy.data.lights.new(name="AvatarFillSun", type='SUN')
        sun_fill.energy = 1.2
        sun_fill.color = (0.95, 0.97, 1.0)
        sun_fill.use_shadow = False
        sun_fill_obj = bpy.data.objects.new(name="AvatarFillSun", object_data=sun_fill)
        scene.collection.objects.link(sun_fill_obj)
        sun_fill_obj.location = (0.0, 0.0, 10.0)
        sun_fill_obj.rotation_euler = (math.radians(50.0), math.radians(-20.0), math.radians(45.0))

        sun_rim = bpy.data.lights.new(name="AvatarRimSun", type='SUN')
        sun_rim.energy = 0.8
        sun_rim.color = (1.0, 0.95, 0.90)
        sun_rim.use_shadow = False
        sun_rim_obj = bpy.data.objects.new(name="AvatarRimSun", object_data=sun_rim)
        scene.collection.objects.link(sun_rim_obj)
        sun_rim_obj.location = (0.0, 0.0, 10.0)
        sun_rim_obj.rotation_euler = (math.radians(30.0), math.radians(40.0), math.radians(160.0))

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

    def _create_toon_mat(self, name, hex_color, roughness=0.35):
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        links = mat.node_tree.links
        nodes.clear()

        principled = nodes.new(type="ShaderNodeBsdfPrincipled")
        principled.location = (0, 0)
        rgba = self._hex_to_rgba(hex_color)
        principled.inputs["Base Color"].default_value = rgba
        if "Roughness" in principled.inputs:
            principled.inputs["Roughness"].default_value = roughness

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
