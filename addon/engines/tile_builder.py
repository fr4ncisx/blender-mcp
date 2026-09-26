import bpy

class TileBuilder:
    def create_tile(self, params):
        tile_type = params.get("tileType", "flat_ground")
        name = params.get("name", "IsometricTile")
        unit_size = float(params.get("unitSize", 1.0))
        unit_height = float(params.get("unitHeight", 1.0))
        generate_collision = bool(params.get("generateCollision", False))

        hs = unit_size / 2.0
        h = unit_height

        verts, faces = self._generate_geometry(tile_type, hs, h)

        mesh = bpy.data.meshes.new(f"{name}_mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()

        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)

        if generate_collision:
            self._create_collision_hull(obj, verts, faces, name)

        return {
            "success": True,
            "created": True,
            "name": obj.name,
            "tileType": tile_type,
            "verticesCount": len(verts),
            "facesCount": len(faces)
        }

    def _generate_geometry(self, tile_type, hs, h):
        if tile_type == "flat_ground":
            verts = [
                (-hs, -hs, 0.0),
                ( hs, -hs, 0.0),
                ( hs,  hs, 0.0),
                (-hs,  hs, 0.0),
            ]
            faces = [(0, 1, 2, 3)]
            return verts, faces

        elif tile_type == "cube_block":
            verts = [
                (-hs, -hs, 0.0),
                ( hs, -hs, 0.0),
                ( hs,  hs, 0.0),
                (-hs,  hs, 0.0),
                (-hs, -hs, h),
                ( hs, -hs, h),
                ( hs,  hs, h),
                (-hs,  hs, h),
            ]
            faces = [
                (0, 3, 2, 1),
                (4, 5, 6, 7),
                (0, 1, 5, 4),
                (1, 2, 6, 5),
                (2, 3, 7, 6),
                (3, 0, 4, 7),
            ]
            return verts, faces

        elif tile_type == "slope_n":
            verts = [
                (-hs, -hs, 0.0),
                ( hs, -hs, 0.0),
                ( hs,  hs, 0.0),
                (-hs,  hs, 0.0),
                ( hs,  hs, h),
                (-hs,  hs, h),
            ]
            faces = [
                (0, 3, 2, 1),
                (0, 1, 4, 5),
                (2, 3, 5, 4),
                (0, 5, 3),
                (1, 2, 4),
            ]
            return verts, faces

        elif tile_type == "slope_s":
            verts = [
                (-hs, -hs, 0.0),
                ( hs, -hs, 0.0),
                ( hs,  hs, 0.0),
                (-hs,  hs, 0.0),
                (-hs, -hs, h),
                ( hs, -hs, h),
            ]
            faces = [
                (0, 3, 2, 1),
                (3, 2, 5, 4),
                (0, 1, 5, 4),
                (0, 4, 3),
                (1, 2, 5),
            ]
            return verts, faces

        elif tile_type == "slope_e":
            verts = [
                (-hs, -hs, 0.0),
                ( hs, -hs, 0.0),
                ( hs,  hs, 0.0),
                (-hs,  hs, 0.0),
                ( hs, -hs, h),
                ( hs,  hs, h),
            ]
            faces = [
                (0, 3, 2, 1),
                (3, 0, 4, 5),
                (1, 2, 5, 4),
                (0, 1, 4),
                (3, 5, 2),
            ]
            return verts, faces

        elif tile_type == "slope_w":
            verts = [
                (-hs, -hs, 0.0),
                ( hs, -hs, 0.0),
                ( hs,  hs, 0.0),
                (-hs,  hs, 0.0),
                (-hs, -hs, h),
                (-hs,  hs, h),
            ]
            faces = [
                (0, 3, 2, 1),
                (1, 2, 5, 4),
                (0, 3, 5, 4),
                (0, 4, 1),
                (2, 3, 5),
            ]
            return verts, faces

        elif tile_type == "wall_corner":
            t = hs * 0.4
            verts = [
                (-hs, -hs, 0.0),
                ( hs, -hs, 0.0),
                ( hs,  hs, 0.0),
                (-hs,  hs, 0.0),
                (-hs, -hs, h),
                (-hs + t, -hs, h),
                (-hs + t,  hs - t, h),
                ( hs,  hs - t, h),
                ( hs,  hs, h),
                (-hs,  hs, h),
            ]
            faces = [
                (0, 1, 2, 3),
                (4, 5, 6, 7, 8, 9),
                (0, 3, 9, 4),
                (3, 2, 8, 9),
            ]
            return verts, faces

        else:
            raise ValueError(f"Unsupported tile type: {tile_type}")

    def _create_collision_hull(self, parent_obj, verts, faces, name):
        col_mesh = bpy.data.meshes.new(f"{name}_col_mesh")
        col_mesh.from_pydata(verts, [], faces)
        col_mesh.update()
        col_obj = bpy.data.objects.new(f"{name}_col", col_mesh)
        bpy.context.scene.collection.objects.link(col_obj)
        col_obj.parent = parent_obj
        col_obj.display_type = 'WIRE'
        col_obj.hide_render = True
