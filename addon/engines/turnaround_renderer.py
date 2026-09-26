import bpy
import math
import os

class TurnaroundRenderer:
    def render_turnaround(self, params):
        object_name = params.get("objectName")
        angles = params.get("angles", [45.0, 135.0, 225.0, 315.0])
        res_info = params.get("resolution", {})
        width = int(res_info.get("width", 128))
        height = int(res_info.get("height", width // 2))
        output_dir = params.get("outputDirectory", bpy.app.tempdir)
        base_name = params.get("baseName", "turnaround")

        target_obj = bpy.data.objects.get(object_name)
        if not target_obj:
            raise ValueError(f"Target object '{object_name}' not found for turnaround render")

        scene = bpy.context.scene
        scene.render.resolution_x = width
        scene.render.resolution_y = height
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = 'PNG'
        scene.render.image_settings.color_mode = 'RGBA'

        os.makedirs(output_dir, exist_ok=True)

        original_rot_z = target_obj.rotation_euler.z
        rendered_files = []

        try:
            for i, angle_deg in enumerate(angles):
                target_obj.rotation_euler.z = math.radians(angle_deg)
                bpy.context.view_layer.update()

                out_filename = f"{base_name}_dir_{i}.png"
                out_path = os.path.join(output_dir, out_filename)
                scene.render.filepath = out_path

                bpy.ops.render.render(write_still=True)
                rendered_files.append({
                    "directionIndex": i,
                    "angleDegrees": angle_deg,
                    "filePath": out_path
                })
        finally:
            target_obj.rotation_euler.z = original_rot_z
            bpy.context.view_layer.update()

        return {
            "success": True,
            "object": object_name,
            "totalRendered": len(rendered_files),
            "files": rendered_files
        }
