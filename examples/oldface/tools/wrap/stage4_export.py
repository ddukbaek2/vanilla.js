import bpy
import os
import sys

scratch = sys.argv[sys.argv.index("--") + 1]
work = os.path.join(scratch, "wrap")
addons_dir = bpy.utils.user_resource("SCRIPTS", path="addons", create=True)
if addons_dir not in sys.path:
    sys.path.append(addons_dir)
bpy.utils.refresh_script_paths()
bpy.ops.preferences.addon_enable(module="MB-Lab")
bpy.ops.wm.open_mainfile(filepath=os.path.join(work, "stage2.blend"))
body = bpy.data.objects["body"]
armature = bpy.data.objects["armature"]
glb_path = os.path.join(work, "oldman.glb")

keys = body.data.shape_keys
for key in keys.key_blocks:
    key.value = 0.0
print("expression keys:", len(keys.key_blocks) - 1)

uv_layers = body.data.uv_layers
main_layer = uv_layers["UVMap"]
material_names = [slot.material.name if slot.material else "" for slot in body.material_slots]
uv_by_material = {"human_eyes": "Eyes_cornea", "Iris_V4": "Eyes_iris"}
for polygon in body.data.polygons:
    material_name = material_names[polygon.material_index]
    for keyword, layer_name in uv_by_material.items():
        if keyword in material_name:
            source_layer = uv_layers[layer_name]
            for loop_index in polygon.loop_indices:
                main_layer.data[loop_index].uv = source_layer.data[loop_index].uv
for layer in list(uv_layers):
    if layer.name != "UVMap":
        uv_layers.remove(layer)

for modifier in list(body.modifiers):
    if modifier.type != "ARMATURE":
        body.modifiers.remove(modifier)
for slot in body.material_slots:
    material = slot.material
    if material is None:
        continue
    material.use_nodes = True
    tree = material.node_tree
    for node in list(tree.nodes):
        tree.nodes.remove(node)
    output = tree.nodes.new("ShaderNodeOutputMaterial")
    principled = tree.nodes.new("ShaderNodeBsdfPrincipled")
    tree.links.new(principled.outputs["BSDF"], output.inputs["Surface"])

bpy.ops.object.select_all(action="DESELECT")
body.select_set(True)
armature.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.export_scene.gltf(filepath=glb_path, export_format="GLB", use_selection=True, export_apply=False, export_morph=True, export_morph_normal=False, export_morph_tangent=False, export_skins=True, export_animations=False, export_yup=True, export_texcoords=True, export_normals=True, export_materials="EXPORT", export_image_format="NONE")
print("EXPORTED", glb_path, os.path.getsize(glb_path))
