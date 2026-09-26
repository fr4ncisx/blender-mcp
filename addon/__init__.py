import bpy
from .server.ws_server import BlenderWsServer, get_server_instance
from .server.protocol_router import ProtocolRouter
from .engines.avatar_engine import IsometricAvatarEngine

bl_info = {
    "name": "Blender Isometric 2:1 MCP Bridge",
    "author": "MCP Dev",
    "version": (0, 9, 0),
    "blender": (5, 0, 0),
    "location": "View3D > Sidebar > Iso MCP",
    "description": "WebSocket JSON-RPC bridge for isometric 2:1 rendering and asset export",
    "category": "Render",
}

_timer_running = False

def _process_queue_timer():
    global _timer_running
    if not _timer_running:
        return None
    server = get_server_instance()
    if server and server.is_running():
        router = ProtocolRouter.get_instance()
        server.drain_and_execute_requests(router.dispatch)
    return 0.05

class ISO_OT_start_bridge_server(bpy.types.Operator):
    bl_idname = "iso.start_bridge_server"
    bl_label = "Start Bridge Server"
    bl_description = "Start the WebSocket JSON-RPC server on port 9876"

    def execute(self, context):
        global _timer_running
        server = get_server_instance()
        if not server.is_running():
            server.start()
            _timer_running = True
            if not bpy.app.timers.is_registered(_process_queue_timer):
                bpy.app.timers.register(_process_queue_timer, persistent=True)
            self.report({'INFO'}, "Iso MCP Bridge Server started on port 9876")
        else:
            self.report({'WARNING'}, "Bridge Server is already running")
        return {'FINISHED'}

class ISO_OT_stop_bridge_server(bpy.types.Operator):
    bl_idname = "iso.stop_bridge_server"
    bl_label = "Stop Bridge Server"
    bl_description = "Stop the WebSocket JSON-RPC server"

    def execute(self, context):
        global _timer_running
        server = get_server_instance()
        if server.is_running():
            server.stop()
            _timer_running = False
            if bpy.app.timers.is_registered(_process_queue_timer):
                bpy.app.timers.unregister(_process_queue_timer)
            self.report({'INFO'}, "Iso MCP Bridge Server stopped")
        else:
            self.report({'WARNING'}, "Bridge Server is not running")
        return {'FINISHED'}

class ISO_PT_mcp_bridge_panel(bpy.types.Panel):
    bl_label = "Iso 2:1 MCP Bridge"
    bl_idname = "ISO_PT_mcp_bridge_panel"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = "Iso MCP"

    def draw(self, context):
        layout = self.layout
        server = get_server_instance()
        is_running = server.is_running()

        status_box = layout.box()
        if is_running:
            status_box.label(text="Status: Running (127.0.0.1:9876)", icon='CHECKMARK')
            layout.operator(ISO_OT_stop_bridge_server.bl_idname, text="Stop Server", icon='CANCEL')
        else:
            status_box.label(text="Status: Stopped", icon='CANCEL')
            layout.operator(ISO_OT_start_bridge_server.bl_idname, text="Start Server", icon='PLAY')

classes = (
    ISO_OT_start_bridge_server,
    ISO_OT_stop_bridge_server,
    ISO_PT_mcp_bridge_panel,
)

def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    global _timer_running
    server = get_server_instance()
    server.start()
    _timer_running = True
    if not bpy.app.timers.is_registered(_process_queue_timer):
        bpy.app.timers.register(_process_queue_timer, persistent=True)

def unregister():
    global _timer_running
    _timer_running = False
    if bpy.app.timers.is_registered(_process_queue_timer):
        bpy.app.timers.unregister(_process_queue_timer)
    server = get_server_instance()
    if server.is_running():
        server.stop()
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)
