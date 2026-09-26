import bpy
import math

class CameraController:
    def setup_scene(self, params):
        unit_size = float(params.get("unitSize", 1.0))
        ortho_scale = float(params.get("orthoScale", math.sqrt(2.0) * unit_size))
        clear_scene = bool(params.get("clearScene", True))
        ambient_occlusion = bool(params.get("ambientOcclusion", True))
        color_management = params.get("colorManagement", "Standard")

        res_info = params.get("resolution", {})
        width = int(res_info.get("width", 128))
        height = int(res_info.get("height", width // 2))

        rot_info = params.get("cameraRotation", {})
        rot_x = math.radians(float(rot_info.get("x", 60.0)))
        rot_y = math.radians(float(rot_info.get("y", 0.0)))
        rot_z = math.radians(float(rot_info.get("z", 45.0)))

        scene = bpy.context.scene

        if clear_scene:
            for obj in list(scene.objects):
                bpy.data.objects.remove(obj, do_unlink=True)

        try:
            scene.render.engine = 'BLENDER_EEVEE'
        except Exception:
            try:
                scene.render.engine = 'BLENDER_EEVEE_NEXT'
            except Exception:
                pass

        scene.render.film_transparent = True
        scene.render.resolution_x = width
        scene.render.resolution_y = height
        scene.render.resolution_percentage = 100

        if hasattr(scene.render, "pixel_filter_type"):
            try:
                scene.render.pixel_filter_type = 'BOX'
            except Exception:
                pass

        if hasattr(scene.render, "filter_size"):
            scene.render.filter_size = 1.0

        if hasattr(scene.view_settings, "view_transform"):
            try:
                scene.view_settings.view_transform = color_management
            except Exception:
                pass

        if hasattr(scene, "eevee") and hasattr(scene.eevee, "use_gtao"):
            scene.eevee.use_gtao = ambient_occlusion

        camera_obj = None
        for obj in scene.objects:
            if obj.type == 'CAMERA':
                camera_obj = obj
                break

        if camera_obj is None:
            camera_data = bpy.data.cameras.new("IsoCamera")
            camera_obj = bpy.data.objects.new("IsoCamera", camera_data)
            scene.collection.objects.link(camera_obj)

        scene.camera = camera_obj
        camera_obj.data.type = 'ORTHO'
        camera_obj.data.ortho_scale = ortho_scale
        camera_obj.rotation_mode = 'XYZ'
        camera_obj.rotation_euler = (rot_x, rot_y, rot_z)

        dist = 20.0
        camera_obj.location = (
            dist * math.sin(rot_z) * math.sin(rot_x),
            -dist * math.cos(rot_z) * math.sin(rot_x),
            dist * math.cos(rot_x)
        )

        sun_obj = None
        for obj in scene.objects:
            if obj.type == 'LIGHT' and obj.data.type == 'SUN':
                sun_obj = obj
                break

        if sun_obj is None:
            sun_data = bpy.data.lights.new(name="IsoSun", type='SUN')
            sun_obj = bpy.data.objects.new(name="IsoSun", object_data=sun_data)
            scene.collection.objects.link(sun_obj)

        sun_obj.data.energy = 2.5
        sun_obj.rotation_euler = (math.radians(45.0), math.radians(25.0), math.radians(110.0))

        return {
            "success": True,
            "configured": True,
            "engine": scene.render.engine,
            "orthoScale": ortho_scale,
            "resolution": {"width": width, "height": height},
            "cameraLocation": [round(v, 4) for v in camera_obj.location],
            "cameraRotation": [round(math.degrees(v), 2) for v in camera_obj.rotation_euler]
        }
