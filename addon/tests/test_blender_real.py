import sys
import os
import math

script_dir = os.path.dirname(os.path.abspath(__file__))
ext_dir = os.path.abspath(os.path.join(script_dir, ".."))
root_dir = os.path.abspath(os.path.join(ext_dir, ".."))

if root_dir not in sys.path:
    sys.path.insert(0, root_dir)
if ext_dir not in sys.path:
    sys.path.insert(0, ext_dir)

import bpy
from addon.server.protocol_router import ProtocolRouter

def run_tests():
    router = ProtocolRouter.get_instance()

    setup_res = router.dispatch("setup_scene", {
        "unitSize": 1.0,
        "resolution": {"width": 128, "height": 64},
        "cameraRotation": {"x": 60.0, "y": 0.0, "z": 45.0},
        "clearScene": True,
        "ambientOcclusion": True,
        "colorManagement": "Standard"
    })

    assert setup_res["success"] is True

    scene = bpy.context.scene
    assert scene.render.resolution_x == 128
    assert scene.render.resolution_y == 64
    assert scene.render.film_transparent is True

    cam_obj = scene.camera
    assert cam_obj is not None
    assert cam_obj.data.type == 'ORTHO'

    expected_scale = math.sqrt(2.0) * 1.0
    assert abs(cam_obj.data.ortho_scale - expected_scale) < 1e-4

    rot_x = math.degrees(cam_obj.rotation_euler.x)
    rot_z = math.degrees(cam_obj.rotation_euler.z)
    assert abs(rot_x - 60.0) < 1e-3
    assert abs(rot_z - 45.0) < 1e-3

    tile_res = router.dispatch("create_tile", {
        "tileType": "cube_block",
        "name": "TestCube",
        "unitSize": 1.0,
        "unitHeight": 0.5,
        "generateCollision": False
    })

    assert tile_res["created"] is True
    assert tile_res["name"] == "TestCube"

    tile_obj = bpy.data.objects.get("TestCube")
    assert tile_obj is not None
    assert len(tile_obj.data.vertices) >= 8

    mat_res = router.dispatch("apply_npr_material", {
        "targetObjectName": "TestCube",
        "palette": ["#1a5276", "#2980b9", "#5499c7", "#aed6f1"],
        "outlineWidth": 0.005,
        "smoothNormals": False
    })

    assert mat_res["success"] is True
    assert len(tile_obj.data.materials) >= 1

    out_dir = os.path.join(root_dir, "output")
    os.makedirs(out_dir, exist_ok=True)
    test_render_path = os.path.join(out_dir, "blender_test_render.png")

    scene.render.filepath = test_render_path
    scene.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True)

    assert os.path.exists(test_render_path)
    file_size = os.path.getsize(test_render_path)
    assert file_size > 0

    print(f"BLENDER_REAL_TEST_SUCCESS: Rendered {file_size} bytes to {test_render_path}")

if __name__ == "__main__":
    try:
        run_tests()
        sys.exit(0)
    except Exception as e:
        import traceback
        traceback.print_exc()
        sys.exit(1)
