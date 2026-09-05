import bpy
import bmesh
import os
import sys

scratch = sys.argv[sys.argv.index("--") + 1]
work = os.path.join(scratch, "wrap")
scan_dir = os.path.join(scratch, "scan")
addons_dir = bpy.utils.user_resource("SCRIPTS", path="addons", create=True)
if addons_dir not in sys.path:
    sys.path.append(addons_dir)
bpy.utils.refresh_script_paths()
bpy.ops.preferences.addon_enable(module="MB-Lab")
bpy.ops.wm.open_mainfile(filepath=os.path.join(work, "stage2.blend"))
scene = bpy.context.scene
scan = bpy.data.objects["scan"]
body = bpy.data.objects["body"]

# 스캔 머티리얼: 알베도 + 노멀 맵 + 4K 디스플레이스먼트 범프
scan_material = scan.data.materials[0]
tree = scan_material.node_tree
for node in list(tree.nodes):
    tree.nodes.remove(node)
output = tree.nodes.new("ShaderNodeOutputMaterial")
principled = tree.nodes.new("ShaderNodeBsdfPrincipled")
tree.links.new(principled.outputs["BSDF"], output.inputs["Surface"])
albedo_node = tree.nodes.new("ShaderNodeTexImage")
# 스캔 glb 의 UV 는 v 위 방향이라 glTF 임포터가 뒤집어 놓는다 — 상하 반전한 이미지를 쓴다
albedo_node.image = bpy.data.images.load(os.path.join(scan_dir, "aged_albedo_flipped.png"))
specular_node = tree.nodes.new("ShaderNodeTexImage")
specular_node.image = bpy.data.images.load(os.path.join(scan_dir, "head_specular_flipped.png"))
specular_node.image.colorspace_settings.name = "Non-Color"
displacement_node = tree.nodes.new("ShaderNodeTexImage")
displacement_node.image = bpy.data.images.load(os.path.join(scan_dir, "aged_displacement_flipped.png"))
displacement_node.image.colorspace_settings.name = "Non-Color"
bump_node = tree.nodes.new("ShaderNodeBump")
bump_node.inputs["Strength"].default_value = 1.0
bump_node.inputs["Distance"].default_value = 0.003
tree.links.new(displacement_node.outputs["Color"], bump_node.inputs["Height"])
tree.links.new(bump_node.outputs["Normal"], principled.inputs["Normal"])
tree.links.new(albedo_node.outputs["Color"], principled.inputs["Base Color"])
emission_node = tree.nodes.new("ShaderNodeEmission")
emission_node.inputs["Strength"].default_value = 1.0

# 베이크 대상: 피부 폴리곤만 남긴 바디 복제본
target_mesh = body.data.copy()
target = bpy.data.objects.new("bake_target", target_mesh)
scene.collection.objects.link(target)
target.matrix_world = body.matrix_world.copy()
if target_mesh.shape_keys:
    target.shape_key_clear()
skin_index = [i for i, m in enumerate(target_mesh.materials) if "skin3" in m.name.lower()][0]
bm = bmesh.new()
bm.from_mesh(target_mesh)
bm.faces.ensure_lookup_table()
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index != skin_index], context="FACES")
bm.to_mesh(target_mesh)
bm.free()
target_mesh.materials.clear()
bake_material = bpy.data.materials.new("bake_material")
bake_material.use_nodes = True
target_mesh.materials.append(bake_material)
bake_tree = bake_material.node_tree
bake_image_node = bake_tree.nodes.new("ShaderNodeTexImage")
bake_tree.nodes.active = bake_image_node
print("bake target polygons:", len(target_mesh.polygons), "uv layers:", [l.name for l in target_mesh.uv_layers])

scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 1
scene.cycles.use_denoising = False
scene.render.bake.use_selected_to_active = True
scene.render.bake.cage_extrusion = 0.012
scene.render.bake.max_ray_distance = 0.05
scene.render.bake.margin = 24
scene.render.bake.use_pass_direct = False
scene.render.bake.use_pass_indirect = False
scene.render.bake.use_pass_color = True
scene.render.bake.normal_space = "TANGENT"
for o in scene.objects:
    o.hide_render = o.type == "MESH" and o not in (scan, target)
    o.hide_set(o.type == "MESH" and o not in (scan, target))
bpy.ops.object.select_all(action="DESELECT")
scan.select_set(True)
target.select_set(True)
bpy.context.view_layer.objects.active = target

def bake(name, size, bake_type, color_input=None, alpha=False, default=(0.0, 0.0, 0.0, 1.0)):
    image = bpy.data.images.new(name, size, size, alpha=alpha, float_buffer=False)
    image.generated_color = default
    image.colorspace_settings.name = "sRGB" if bake_type == "DIFFUSE" and name == "baked_albedo" else "Non-Color"
    bake_image_node.image = image
    for link in list(tree.links):
        if link.to_node == output:
            tree.links.remove(link)
    if color_input is not None:
        tree.links.new(color_input, principled.inputs["Base Color"])
    if bake_type == "EMIT":
        tree.links.new(emission_node.outputs["Emission"], output.inputs["Surface"])
    else:
        tree.links.new(principled.outputs["BSDF"], output.inputs["Surface"])
    bpy.ops.object.bake(type=bake_type, use_selected_to_active=True)
    image.filepath_raw = os.path.join(work, name + ".png")
    image.file_format = "PNG"
    image.save()
    print("baked", name, size)

bake("baked_mask", 2048, "EMIT")
bake("baked_albedo", 2048, "DIFFUSE", albedo_node.outputs["Color"])
bake("baked_specular", 2048, "DIFFUSE", specular_node.outputs["Color"])
bake("baked_height", 4096, "DIFFUSE", displacement_node.outputs["Color"], default=(0.5, 0.5, 0.5, 1.0))
print("STAGE3 DONE")
