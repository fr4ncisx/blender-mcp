import bpy

class ToonShaderFactory:
    def apply_toon_material(self, params):
        target_name = params.get("targetObjectName")
        palette_hex = params.get("palette", ["#333333", "#777777", "#CCCCCC"])
        outline_width = float(params.get("outlineWidth", 0.02))
        smooth_normals = bool(params.get("smoothNormals", False))

        target_obj = bpy.data.objects.get(target_name)
        if not target_obj:
            raise ValueError(f"Target object '{target_name}' not found")

        mat_name = f"{target_name}_ToonMat"
        mat = bpy.data.materials.new(name=mat_name)
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        links = mat.node_tree.links
        nodes.clear()

        diffuse = nodes.new(type="ShaderNodeBsdfDiffuse")
        diffuse.location = (-400, 0)

        shader_to_rgb = nodes.new(type="ShaderNodeShaderToRGB")
        shader_to_rgb.location = (-200, 0)

        color_ramp = nodes.new(type="ShaderNodeValToRGB")
        color_ramp.location = (50, 0)
        ramp = color_ramp.color_ramp
        ramp.interpolation = 'CONSTANT'

        palette_rgbs = [self._hex_to_rgba(h) for h in palette_hex]
        num_colors = len(palette_rgbs)

        while len(ramp.elements) < num_colors:
            ramp.elements.new(0.5)
        while len(ramp.elements) > num_colors:
            ramp.elements.remove(ramp.elements[-1])

        step = 1.0 / max(1, num_colors)
        for i, col in enumerate(palette_rgbs):
            elem = ramp.elements[i]
            elem.position = i * step
            elem.color = col

        emission = nodes.new(type="ShaderNodeEmission")
        emission.location = (200, 0)

        output = nodes.new(type="ShaderNodeOutputMaterial")
        output.location = (400, 0)

        links.new(diffuse.outputs["BSDF"], shader_to_rgb.inputs["Shader"])
        links.new(shader_to_rgb.outputs["Color"], color_ramp.inputs["Fac"])
        links.new(color_ramp.outputs["Color"], emission.inputs["Color"])
        links.new(emission.outputs["Emission"], output.inputs["Surface"])

        if target_obj.data.materials:
            target_obj.data.materials[0] = mat
        else:
            target_obj.data.materials.append(mat)

        if smooth_normals and hasattr(target_obj.data, "polygons"):
            for poly in target_obj.data.polygons:
                poly.use_smooth = True

        if outline_width > 0:
            self._apply_outline_modifier(target_obj, outline_width)

        return {
            "success": True,
            "applied": True,
            "materialName": mat.name,
            "object": target_obj.name,
            "paletteColors": len(palette_rgbs),
            "outline": outline_width > 0
        }

    def _apply_outline_modifier(self, target_obj, width):
        outline_mat_name = "Outline_Black_Mat"
        outline_mat = bpy.data.materials.get(outline_mat_name)
        if outline_mat is None:
            outline_mat = bpy.data.materials.new(name=outline_mat_name)
            outline_mat.use_nodes = True
            nodes = outline_mat.node_tree.nodes
            nodes.clear()
            emission = nodes.new(type="ShaderNodeEmission")
            emission.inputs["Color"].default_value = (0.0, 0.0, 0.0, 1.0)
            emission.inputs["Strength"].default_value = 1.0
            output = nodes.new(type="ShaderNodeOutputMaterial")
            outline_mat.node_tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])
            if hasattr(outline_mat, "use_backface_culling"):
                outline_mat.use_backface_culling = True

        if outline_mat.name not in [m.name for m in target_obj.data.materials if m]:
            target_obj.data.materials.append(outline_mat)

        mat_index = [m.name for m in target_obj.data.materials if m].index(outline_mat.name)

        mod = target_obj.modifiers.get("IsoOutline")
        if mod is None:
            mod = target_obj.modifiers.new(name="IsoOutline", type='SOLIDIFY')

        mod.thickness = -width
        mod.offset = 1.0
        mod.use_flip_normals = True
        mod.material_offset = mat_index
        mod.material_offset_rim = mat_index

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
