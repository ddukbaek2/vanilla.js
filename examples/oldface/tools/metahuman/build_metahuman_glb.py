import bpy
import os
import sys
import json
import math
import numpy as np

# riglogic_eval.py 가 만든 npz(메시별 레이아웃 정점 / UV / 삼각형 / 포즈별 정점 위치)로 Blender 메시를 만들고
# 포즈마다 셰이프키를 추가한 뒤 glb 로 내보낸다. 검증용 렌더도 남긴다. DNA 좌표는 Maya 규약(Y 위, cm) 이다.
npz_path = sys.argv[sys.argv.index("--") + 1]
glb_path = sys.argv[sys.argv.index("--") + 2]
render_dir = sys.argv[sys.argv.index("--") + 3] if len(sys.argv) > sys.argv.index("--") + 3 else None
data = np.load(npz_path)
meta = json.loads(str(data["meta"]))
pose_names = meta["pose_names"]
mesh_names = meta["mesh_names"]
SKIP = {"saliva", "eyeshell", "eyeEdge", "cartilage"}
# 메시별 셰이프키 최소 이동 (m). 머리카락은 두피의 미세한 움직임까지 셰이프키로 남기면 용량만 커지므로 4mm 미만은 버린다.
SNAP_THRESHOLD = {"hair": 0.004}

def to_blender(points_cm):
    # Maya Y 위 (x, y, z) → Blender Z 위 (x, -z, y), cm → m
    return np.stack([points_cm[:, 0], -points_cm[:, 2], points_cm[:, 1]], axis=1) * 0.01

for existing in list(bpy.data.objects):
    bpy.data.objects.remove(existing, do_unlink=True)
scene = bpy.context.scene
objects = []
for name in mesh_names:
    if name in SKIP:
        continue
    layout_positions = data[f"{name}__layout_positions"]
    layout_uvs = data[f"{name}__layout_uvs"]
    uvs = data[f"{name}__uvs"]
    triangles = data[f"{name}__triangles"]
    neutral = data[f"{name}__neutral"]
    vertices = to_blender(neutral[layout_positions])
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices.tolist(), [], triangles.tolist())
    mesh.validate(verbose=False)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    loop_uvs = np.zeros((len(mesh.loops), 2), dtype=np.float32)
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            layout_index = mesh.loops[loop_index].vertex_index
            loop_uvs[loop_index] = uvs[layout_uvs[layout_index]]
    uv_layer.data.foreach_set("uv", loop_uvs.reshape(-1))
    material_names = {"eyeLeft": "eyeball_left", "eyeRight": "eyeball_right"}
    material = bpy.data.materials.new("m_" + material_names.get(name, name))
    material.use_nodes = True
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.shape_key_add(name="Basis", from_mix=False)
    for frame, pose_name in enumerate(pose_names):
        if pose_name == "Default" or pose_name.startswith("Pose_"):
            continue
        posed = to_blender(data[f"{name}__pose_{frame}"][layout_positions])
        # 스키닝 수치 잡음(1e-7 수준)을 기준 위치로 되돌려 희소 셰이프키가 되게 한다 (0.05mm 미만 이동 무시)
        delta = posed - vertices
        posed = np.where(np.linalg.norm(delta, axis=1, keepdims=True) < SNAP_THRESHOLD.get(name, 0.00005), vertices, posed)
        if not np.any(np.abs(posed - vertices) > 0.0):
            continue
        key = obj.shape_key_add(name=pose_name, from_mix=False)
        key.data.foreach_set("co", posed.reshape(-1).astype(np.float32))
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    objects.append(obj)
    print("built", name, "vertices", len(mesh.vertices), "keys", len(mesh.shape_keys.key_blocks) - 1)

if render_dir:
    os.makedirs(render_dir, exist_ok=True)
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "SINGLE"
    scene.display.shading.single_color = (0.6, 0.55, 0.5)
    scene.render.resolution_x = 700
    scene.render.resolution_y = 800
    head = [o for o in objects if o.name == "head"][0]
    bounds = np.array([head.matrix_world @ v.co for v in head.data.vertices])
    center = (bounds.min(axis=0) + bounds.max(axis=0)) / 2.0
    camera_data = bpy.data.cameras.new("camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = (bounds.max(axis=0) - bounds.min(axis=0)).max() * 1.15
    camera = bpy.data.objects.new("camera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera.location = (center[0], center[1] - 1.5, center[2])
    camera.rotation_euler = (math.pi / 2.0, 0.0, 0.0)
    for pose_name in ["Default"] + [n for n in pose_names if n in ("JawOpen", "EyeBlinkLeft", "MouthSmileLeft", "BrowInnerUp", "MouthPucker")]:
        for obj in objects:
            for key in obj.data.shape_keys.key_blocks:
                key.value = 1.0 if key.name == pose_name else 0.0
        scene.render.filepath = os.path.join(render_dir, f"pose_{pose_name}.png")
        bpy.ops.render.render(write_still=True)
    for obj in objects:
        for key in obj.data.shape_keys.key_blocks:
            key.value = 0.0
    bpy.data.objects.remove(camera, do_unlink=True)

bpy.ops.object.select_all(action="DESELECT")
for obj in objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = objects[0]
bpy.ops.export_scene.gltf(filepath=glb_path, export_format="GLB", use_selection=True, export_apply=False, export_morph=True, export_morph_normal=False, export_morph_tangent=False, export_skins=False, export_animations=False, export_yup=True, export_texcoords=True, export_normals=True, export_materials="EXPORT", export_image_format="NONE", export_try_sparse_sk=True)
print("EXPORTED", glb_path, os.path.getsize(glb_path))
