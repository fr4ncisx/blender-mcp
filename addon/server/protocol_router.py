import bpy
from ..engines.camera_controller import CameraController
from ..engines.tile_builder import TileBuilder
from ..engines.toon_shader_factory import ToonShaderFactory
from ..engines.turnaround_renderer import TurnaroundRenderer
from ..engines.render_pass_compositor import RenderPassCompositor
from ..engines.social_room_engine import SocialRoomEngine
from ..engines.habbo_bar_engine import HabboBarEngine
from ..engines.avatar_engine import IsometricAvatarEngine
from ..engines.world_synthesizer import WorldSynthesizerEngine

class ProtocolRouter:
    _instance = None

    def __init__(self):
        self.camera_controller = CameraController()
        self.tile_builder = TileBuilder()
        self.shader_factory = ToonShaderFactory()
        self.turnaround_renderer = TurnaroundRenderer()
        self.pass_compositor = RenderPassCompositor()
        self.social_room_engine = SocialRoomEngine()
        self.habbo_bar_engine = HabboBarEngine()
        self.avatar_engine = IsometricAvatarEngine()
        self.world_synthesizer_engine = WorldSynthesizerEngine()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def dispatch(self, method, params):
        if method == "setup_scene":
            return self.camera_controller.setup_scene(params)
        elif method == "create_tile":
            return self.tile_builder.create_tile(params)
        elif method == "apply_npr_material":
            return self.shader_factory.apply_toon_material(params)
        elif method == "render_turnaround":
            return self.turnaround_renderer.render_turnaround(params)
        elif method == "bake_passes":
            return self.pass_compositor.bake_passes(params)
        elif method == "build_social_room":
            return self.social_room_engine.build_room(params)
        elif method == "build_habbo_bar":
            return self.habbo_bar_engine.build_bar(params)
        elif method == "build_avatar":
            return self.avatar_engine.build_avatar(params)
        elif method == "synthesize_world":
            return self.world_synthesizer_engine.render_world(params)
        elif method == "inspect_scene":
            return self._inspect_scene(params)
        elif method == "execute_script":
            return self._execute_script(params)
        else:
            raise ValueError(f"Unknown RPC method: {method}")

    def _inspect_scene(self, params):
        include_objects = params.get("includeObjects", True)
        include_cameras = params.get("includeCameras", True)
        include_materials = params.get("includeMaterials", True)

        result = {
            "sceneName": bpy.context.scene.name,
            "renderEngine": bpy.context.scene.render.engine,
            "fps": bpy.context.scene.render.fps,
            "objectsCount": len(bpy.data.objects),
        }

        if include_objects:
            result["objects"] = [
                {
                    "name": obj.name,
                    "type": obj.type,
                    "location": [round(v, 4) for v in obj.location],
                    "dimensions": [round(v, 4) for v in obj.dimensions]
                }
                for obj in bpy.data.objects
            ]

        if include_cameras:
            result["cameras"] = [
                {
                    "name": cam.name,
                    "type": cam.data.type,
                    "orthoScale": getattr(cam.data, "ortho_scale", None),
                    "rotationEuler": [round(v, 4) for v in cam.rotation_euler]
                }
                for cam in bpy.data.objects if cam.type == 'CAMERA'
            ]

        if include_materials:
            result["materials"] = [mat.name for mat in bpy.data.materials]

        return result

    def _execute_script(self, params):
        script = params.get("script", "")
        context = params.get("context", {})
        scope = {"bpy": bpy, "context": context}
        exec(script, scope)
        return {"executed": True, "output": scope.get("result", None)}
