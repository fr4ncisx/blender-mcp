import bpy
import os

class RenderPassCompositor:
    def bake_passes(self, params):
        object_name = params.get("objectName")
        requested_passes = params.get("passes", ["albedo", "normal_2d", "depth", "shadow_mask"])
        output_dir = params.get("outputDirectory", bpy.app.tempdir)
        base_name = params.get("baseName", "baked_passes")
        res_info = params.get("resolution", {})
        width = int(res_info.get("width", 128))
        height = int(res_info.get("height", width // 2))

        os.makedirs(output_dir, exist_ok=True)

        scene = bpy.context.scene
        scene.render.resolution_x = width
        scene.render.resolution_y = height
        scene.render.resolution_percentage = 100
        scene.render.film_transparent = True

        view_layer = scene.view_layers[0]
        view_layer.use_pass_normal = True
        view_layer.use_pass_z = True
        if hasattr(view_layer, "use_pass_diffuse_color"):
            view_layer.use_pass_diffuse_color = True
        if hasattr(view_layer, "use_pass_shadow"):
            view_layer.use_pass_shadow = True

        scene.use_nodes = True
        tree = scene.node_tree
        nodes = tree.nodes
        links = tree.links
        nodes.clear()

        rl = nodes.new("CompositorNodeRLayers")
        rl.location = (-400, 200)

        file_output = nodes.new("CompositorNodeOutputFile")
        file_output.base_path = output_dir
        file_output.location = (400, 200)
        file_output.file_slots.clear()

        pass_results = []

        for p in requested_passes:
            filename = f"{base_name}_{p}"
            filepath = os.path.join(output_dir, f"{filename}.png")
            slot = file_output.file_slots.new(filename)

            if p == "albedo":
                src = rl.outputs.get("DiffCol") or rl.outputs.get("Image")
                links.new(src, file_output.inputs[slot.path])
            elif p == "normal_2d":
                norm_out = rl.outputs.get("Normal")
                if norm_out:
                    map_val = nodes.new("CompositorNodeMapValue")
                    map_val.size = [0.5]
                    map_val.offset = [0.5]
                    links.new(norm_out, map_val.inputs[0])
                    links.new(map_val.outputs[0], file_output.inputs[slot.path])
                else:
                    links.new(rl.outputs["Image"], file_output.inputs[slot.path])
            elif p == "depth":
                z_out = rl.outputs.get("Depth")
                if z_out:
                    norm_z = nodes.new("CompositorNodeNormalize")
                    links.new(z_out, norm_z.inputs[0])
                    links.new(norm_z.outputs[0], file_output.inputs[slot.path])
                else:
                    links.new(rl.outputs["Image"], file_output.inputs[slot.path])
            elif p == "shadow_mask":
                shadow_out = rl.outputs.get("Shadow") or rl.outputs.get("Image")
                links.new(shadow_out, file_output.inputs[slot.path])
            else:
                links.new(rl.outputs["Image"], file_output.inputs[slot.path])

            pass_results.append({
                "passType": p,
                "filePath": filepath
            })

        comp = nodes.new("CompositorNodeComposite")
        comp.location = (400, -100)
        links.new(rl.outputs["Image"], comp.inputs["Image"])

        scene.render.filepath = os.path.join(output_dir, f"{base_name}_composite.png")
        bpy.ops.render.render(write_still=True)

        return {
            "success": True,
            "object": object_name,
            "passes": pass_results
        }
