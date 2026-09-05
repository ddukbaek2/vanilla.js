import bpy
import os
import sys
import json
import math
import importlib

scratch = sys.argv[sys.argv.index("--") + 1]
work = os.path.join(scratch, "wrap")
os.makedirs(work, exist_ok=True)
texture_dir = os.path.join(scratch, "mblab", "animate1978-MB-Lab-063bff0", "data", "textures")

addons_dir = bpy.utils.user_resource("SCRIPTS", path="addons", create=True)
if addons_dir not in sys.path:
    sys.path.append(addons_dir)
bpy.utils.refresh_script_paths()
bpy.ops.preferences.addon_enable(module="MB-Lab")
mb = importlib.import_module("MB-Lab")
scene = bpy.context.scene
for existing in list(bpy.data.objects):
    bpy.data.objects.remove(existing, do_unlink=True)

# 스캔 헤드
bpy.ops.import_scene.gltf(filepath=os.path.join(scratch, "scan", "head.glb"))
scan = [o for o in bpy.context.scene.objects if o.type == "MESH"][0]
scan.name = "scan"
for o in list(bpy.context.scene.objects):
    if o.type != "MESH":
        bpy.data.objects.remove(o, do_unlink=True)
scan.parent = None
scan.matrix_world.identity()
scan_material = bpy.data.materials.new("scan_material")
scan_material.use_nodes = True
tree = scan_material.node_tree
principled = tree.nodes["Principled BSDF"]
image_node = tree.nodes.new("ShaderNodeTexImage")
image_node.image = bpy.data.images.load(os.path.join(scratch, "scan", "head_albedo.jpg"))
tree.links.new(image_node.outputs["Color"], principled.inputs["Base Color"])
tree.nodes.active = image_node
scan.data.materials.clear()
scan.data.materials.append(scan_material)
print("scan verts:", len(scan.data.vertices), "polys:", len(scan.data.polygons), "bounds:", [tuple(round(c, 3) for c in b) for b in (scan.bound_box[0], scan.bound_box[6])])

# MB-Lab 캐릭터
scene.mblab_character_name = "m_ca01"
bpy.ops.mbast.init_character()
obj = bpy.context.active_object
humanoid = mb.mblab_humanoid
obj.character_age = 1.0
obj.character_mass = 0.0
obj.character_tone = 0.2
humanoid.update_character(mode="update_all")
scene.mblab_remove_all_modifiers = False
scene.mblab_final_prefix = "oldman"
bpy.ops.mbast.finalize_character()
body = [o for o in bpy.data.objects if o.type == "MESH" and o.name != "scan"][0]
body.name = "body"
armature = body.parent if body.parent and body.parent.type == "ARMATURE" else None
if armature:
    armature.name = "armature"
keys = body.data.shape_keys
for key in list(keys.key_blocks):
    if key.name != "Basis" and not key.name.startswith("Expressions_"):
        body.shape_key_remove(key)
for key in keys.key_blocks:
    key.value = 0.0
print("body verts:", len(body.data.vertices), "keys:", len(keys.key_blocks) - 1, "materials:", [m.name for m in body.data.materials], "groups:", len(body.vertex_groups))
for slot in body.material_slots:
    material = slot.material
    material.use_nodes = True
    tree = material.node_tree
    for node in list(tree.nodes):
        tree.nodes.remove(node)
    output = tree.nodes.new("ShaderNodeOutputMaterial")
    principled = tree.nodes.new("ShaderNodeBsdfPrincipled")
    tree.links.new(principled.outputs["BSDF"], output.inputs["Surface"])
    if "skin" in material.name.lower() or "generic" in material.name.lower():
        image_node = tree.nodes.new("ShaderNodeTexImage")
        image_node.image = bpy.data.images.load(os.path.join(texture_dir, "hum_m_cauc_albedo.png"))
        tree.links.new(image_node.outputs["Color"], principled.inputs["Base Color"])
        tree.nodes.active = image_node

# 정면 직교 렌더 (Workbench, 텍스처)
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "TEXTURE"
scene.render.resolution_x = 1024
scene.render.resolution_y = 1024
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
camera_data = bpy.data.cameras.new("landmark_camera")
camera_data.type = "ORTHO"
camera = bpy.data.objects.new("landmark_camera", camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
camera.rotation_euler = (math.pi / 2.0, 0.0, 0.0)

def frame_and_render(target, name, vertices):
    xs = [v.x for v in vertices]
    ys = [v.y for v in vertices]
    zs = [v.z for v in vertices]
    center_x = (min(xs) + max(xs)) / 2.0
    center_z = (min(zs) + max(zs)) / 2.0
    ortho_scale = max(max(xs) - min(xs), max(zs) - min(zs)) * 1.25
    camera_y = min(ys) - 1.0
    camera_data.ortho_scale = ortho_scale
    camera_data.clip_end = 100.0
    camera.location = (center_x, camera_y, center_z)
    for o in bpy.context.scene.objects:
        if o.type == "MESH":
            o.hide_render = (o != target)
    scene.render.filepath = os.path.join(work, name + "_front.png")
    bpy.ops.render.render(write_still=True)
    return {"center_x": center_x, "center_z": center_z, "ortho_scale": ortho_scale, "camera_y": camera_y}

scan_world = [scan.matrix_world @ v.co for v in scan.data.vertices]
info = {"scan": frame_and_render(scan, "scan", scan_world)}
body_world = [body.matrix_world @ v.co for v in body.data.vertices]
top_z = max(v.z for v in body_world)
head_vertices = [v for v in body_world if v.z > top_z - 0.34]
info["body"] = frame_and_render(body, "body", head_vertices)
json.dump(info, open(os.path.join(work, "cameras.json"), "w"), indent=1)
for o in bpy.context.scene.objects:
    o.hide_render = False
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(work, "stage1.blend"))
print("STAGE1 DONE", info)
