# ==============================================================================
# OLD FACE 애셋 생성 스크립트. (Blender 헤드리스 + MB-Lab 1.8.1)
# - 실행: blender -b --python mblab_export.py
# - 전제: MB-Lab 애드온이 Blender 사용자 애드온 디렉토리에 "MB-Lab" 이름으로 설치되어 있어야 한다.
#   (https://github.com/animate1978/MB-Lab 의 1_8_1 소스를 그 이름의 폴더로 복사)
# - 결과: oldman.glb (골격 + 표정 단위 셰이프키 81종, 눈 UV 를 주 UV 로 병합, 이미지 제외)
#         oldman_displacement.png (나이 반영 디스플레이스먼트 — 피부 노멀 맵 생성용)
# - 텍스처는 MB-Lab data/textures 의 원본을 웹용(JPEG/PNG)으로 변환해 assets/ 에 둔다.
# ==============================================================================
import bpy
import os
import sys
import importlib
import traceback
import json

OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "oldman.glb")
addons_dir = bpy.utils.user_resource("SCRIPTS", path="addons", create=True)
if addons_dir not in sys.path:
    sys.path.append(addons_dir)
bpy.utils.refresh_script_paths()
bpy.ops.preferences.addon_enable(module="MB-Lab")
mb = importlib.import_module("MB-Lab")
scene = bpy.context.scene

# 기본 큐브 등 제거.
for existing in list(bpy.data.objects):
    bpy.data.objects.remove(existing, do_unlink=True)

scene.mblab_character_name = "m_ca01"
bpy.ops.mbast.init_character()
obj = bpy.context.active_object
print("initialized:", obj.name, len(obj.data.vertices))

# 노인 체형. (나이 최대, 마른 체형, 근긴장 낮음)
obj.character_age = 1.0
obj.character_mass = -0.2
obj.character_tone = -0.3
mb.mblab_humanoid.update_character(mode="update_all")
print("age applied:", obj.character_age)

scene.mblab_remove_all_modifiers = False
scene.mblab_final_prefix = "oldman"
bpy.ops.mbast.finalize_character()
body = None
for candidate in bpy.data.objects:
    if candidate.type == "MESH" and "oldman" in candidate.name.lower():
        body = candidate
for candidate in bpy.data.objects:
    print("object:", candidate.name, candidate.type)
if body is None:
    body = [o for o in bpy.data.objects if o.type == "MESH"][0]
armature = body.parent if body.parent and body.parent.type == "ARMATURE" else None
print("finalized body:", body.name, "vertices:", len(body.data.vertices), "armature:", armature.name if armature else None)
keys = body.data.shape_keys
key_names = [k.name for k in keys.key_blocks] if keys else []
print("shape keys:", len(key_names), key_names[:6])

# 표정 외 셰이프키 제거. (Basis 와 Expressions_* 만 유지)
if keys:
    for key in list(keys.key_blocks):
        if key.name != "Basis" and not key.name.startswith("Expressions_"):
            body.shape_key_remove(key)
    for key in keys.key_blocks:
        key.value = 0.0
    print("expression keys kept:", len(keys.key_blocks) - 1)

# 눈 UV 를 주 UV 로 병합. (공막: Eyes_cornea, 홍채: Eyes_iris — 엔진은 TEXCOORD_0 만 읽는다)
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
print("uv layers:", [layer.name for layer in uv_layers])

# 나이 반영 디스플레이스먼트 이미지 저장. (피부 노멀 맵 생성용)
for image in bpy.data.images:
    if "displ" in image.name.lower():
        image_path = os.path.join(os.path.dirname(OUTPUT), "oldman_displacement.png")
        image.filepath_raw = image_path
        image.file_format = "PNG"
        try:
            image.save()
            print("saved displacement image:", image.name, image.size[:], image_path)
        except Exception as error:
            print("displacement save failed:", image.name, error)

# 골격 외 모디파이어 제거. (서브디비전 / 디스플레이스 / 보정 스무딩 — 디테일은 엔진 텍스처가 맡는다)
for modifier in list(body.modifiers):
    if modifier.type != "ARMATURE":
        body.modifiers.remove(modifier)
print("modifiers:", [m.type for m in body.modifiers])

# 머티리얼 단순화. (이름만 유지, 이미지 제외 — 텍스처는 엔진에서 직접 로드)
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
print("materials:", [slot.material.name if slot.material else None for slot in body.material_slots])

# 본 이름 기록.
if armature:
    bone_names = [bone.name for bone in armature.data.bones]
    print("bones:", len(bone_names), [n for n in bone_names if "head" in n.lower() or "neck" in n.lower() or "spine" in n.lower()][:12])

# 내보내기. (본 메시 + 골격, 모프 타깃, 이미지 제외)
bpy.ops.object.select_all(action="DESELECT")
body.select_set(True)
if armature:
    armature.select_set(True)
bpy.context.view_layer.objects.active = body
export_arguments = dict(
    filepath=OUTPUT,
    export_format="GLB",
    use_selection=True,
    export_apply=False,
    export_morph=True,
    export_morph_normal=False,
    export_morph_tangent=False,
    export_skins=True,
    export_animations=False,
    export_yup=True,
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
    export_image_format="NONE",
)
try:
    bpy.ops.export_scene.gltf(**export_arguments)
except TypeError as error:
    print("export argument fallback:", error)
    export_arguments.pop("export_image_format", None)
    bpy.ops.export_scene.gltf(**export_arguments)
print("EXPORTED", OUTPUT, os.path.getsize(OUTPUT))
