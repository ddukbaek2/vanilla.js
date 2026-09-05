import bpy
import os
import sys

# Microsoft Rocketbox 얼굴용 FBX(_facial) → 샘플용 GLB.
# - ARKit 블렌드셰이프(AK_*) 52종만 남긴다 (엔진 모프 최대 96)
# - 눈알 폴리곤(눈 본 가중)을 별도 머티리얼(eyes)로 분리한다 (카메라 초점 / 낮은 러프니스)
# - 골격 스케일 적용, 이미지는 내보내지 않는다 (텍스처는 따로 변환)
fbx_path = sys.argv[sys.argv.index("--") + 1]
glb_path = sys.argv[sys.argv.index("--") + 2]
for existing in list(bpy.data.objects):
    bpy.data.objects.remove(existing, do_unlink=True)
bpy.ops.import_scene.fbx(filepath=fbx_path)
body = [o for o in bpy.data.objects if o.type == "MESH"][0]
armature = [o for o in bpy.data.objects if o.type == "ARMATURE"][0]

# FBX 의 테이크 애니메이션(오브젝트 스케일 0.01 / 위치 키 포함)을 제거하고 포즈를 휴식 자세로 되돌린다 — 남겨 두면 내보내기가 애니메이션 값을 루트 노드에 쓴다
for target in (body, armature, body.data, armature.data):
    target.animation_data_clear()
for pose_bone in armature.pose.bones:
    pose_bone.matrix_basis.identity()
for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)

# cm 단위 FBX: 메시 월드 변환을 정점 / 셰이프키 데이터에 굽고, 골격은 오브젝트 변환을 본 데이터에 적용해 둘 다 항등 변환의 미터 단위로 만든다
mesh_world = body.matrix_world.copy()
for key in body.data.shape_keys.key_blocks:
    for point in key.data:
        point.co = mesh_world @ point.co
for vertex in body.data.vertices:
    vertex.co = mesh_world @ vertex.co
body.parent = None
body.matrix_world.identity()
bpy.ops.object.select_all(action="DESELECT")
armature.select_set(True)
bpy.context.view_layer.objects.active = armature
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
body.parent = armature
body.matrix_parent_inverse.identity()
body.matrix_world.identity()
head_bone = armature.data.bones.get("Bip01 Head")
print("armature scale:", tuple(round(s, 4) for s in armature.scale), "mesh dims:", tuple(round(d, 3) for d in body.dimensions), "mesh z range:", round(min(v.co.z for v in body.data.vertices), 3), round(max(v.co.z for v in body.data.vertices), 3), "head bone:", tuple(round(c, 3) for c in head_bone.head_local))

keys = body.data.shape_keys
for key in list(keys.key_blocks):
    if key.name != "Basis" and not key.name.startswith("AK_"):
        body.shape_key_remove(key)
for key in keys.key_blocks:
    key.value = 0.0
print("shape keys kept:", len(keys.key_blocks) - 1)

# 어깨 아래는 잘라낸다 (흉상 — 머리 본에서 30cm 아래 평면보다 낮은 폴리곤과 팔 폴리곤 제거, 뚫린 구멍은 어두운 캡으로 메움)
import bmesh
cut_height = head_bone.head_local.z - 0.30
arm_group_indices = {g.index for g in body.vertex_groups if any(part in g.name for part in ("UpperArm", "Forearm", "Hand", "Finger"))}
arm_weight = {}
for vertex in body.data.vertices:
    arm_weight[vertex.index] = sum(group.weight for group in vertex.groups if group.group in arm_group_indices)
# 머리카락 카드(눈 위 6cm 보다 높은 opacity 폴리곤)는 뺀다 — 알파 컷아웃에서 판처럼 보이고, 두피에는 머리카락이 그려져 있다. 속눈썹 / 눈썹 카드는 남긴다.
material_names = [m.name.lower() if m else "" for m in body.data.materials]
eye_group_indices = [g.index for g in body.vertex_groups if g.name in ("Bip01 REye", "Bip01 LEye")]
eye_height = sum(v.co.z for v in body.data.vertices if any(group.group in eye_group_indices and group.weight > 0.5 for group in v.groups)) / max(1, sum(1 for v in body.data.vertices if any(group.group in eye_group_indices and group.weight > 0.5 for group in v.groups)))
body_material_index = [i for i, n in enumerate(material_names) if "body" in n][0]
bm = bmesh.new()
bm.from_mesh(body.data)
removed = [f for f in bm.faces if all(v.co.z < cut_height for v in f.verts) or all(arm_weight[v.index] > 0.5 for v in f.verts) or ("opacity" in material_names[f.material_index] and f.calc_center_median().z > eye_height + 0.06)]
bmesh.ops.delete(bm, geom=removed, context="FACES")
boundary_edges = [e for e in bm.edges if e.is_boundary]
filled = bmesh.ops.holes_fill(bm, edges=boundary_edges, sides=0)
for face in filled["faces"]:
    face.material_index = body_material_index
bm.to_mesh(body.data)
bm.free()
print("bust cut at z:", round(cut_height, 3), "eye height:", round(eye_height, 3), "removed polygons:", len(removed), "cap faces:", len(filled["faces"]), "polygons left:", len(body.data.polygons), "vertices left:", len(body.data.vertices))

eye_group_indices = [g.index for g in body.vertex_groups if g.name in ("Bip01 REye", "Bip01 LEye")]
eye_vertices = set()
for vertex in body.data.vertices:
    for group in vertex.groups:
        if group.group in eye_group_indices and group.weight > 0.5:
            eye_vertices.add(vertex.index)
eyes_material = bpy.data.materials.new("m_eyes")
body.data.materials.append(eyes_material)
eyes_material_index = len(body.data.materials) - 1
eye_polygon_count = 0
eye_center = [0.0, 0.0, 0.0]
for polygon in body.data.polygons:
    if all(vi in eye_vertices for vi in polygon.vertices):
        polygon.material_index = eyes_material_index
        eye_polygon_count += 1
        world = body.matrix_world @ polygon.center
        eye_center = [eye_center[0] + world.x, eye_center[1] + world.y, eye_center[2] + world.z]
if eye_polygon_count:
    eye_center = [c / eye_polygon_count for c in eye_center]
print("eye vertices:", len(eye_vertices), "eye polygons:", eye_polygon_count, "eye center:", [round(c, 3) for c in eye_center])
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
    print("material:", material.name, "polygons:", sum(1 for p in body.data.polygons if p.material_index == slot.slot_index))

bpy.ops.object.select_all(action="DESELECT")
body.select_set(True)
armature.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.export_scene.gltf(filepath=glb_path, export_format="GLB", use_selection=True, export_apply=False, export_morph=True, export_morph_normal=False, export_morph_tangent=False, export_skins=True, export_animations=False, export_yup=True, export_texcoords=True, export_normals=True, export_materials="EXPORT", export_image_format="NONE")
print("EXPORTED", glb_path, os.path.getsize(glb_path))
