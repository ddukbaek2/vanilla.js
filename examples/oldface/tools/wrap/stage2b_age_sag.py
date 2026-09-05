import bpy
import os
import sys
import math
import numpy as np

# 첫 버전 샘플의 노화 처짐 모프(ageSag)를 래핑된 바디의 기본 형상과 모든 셰이프키에 영구 적용한다.
# 랜드마크는 스캔 원본(glTF y 위, z 정면) 좌표계 기준이라 바디 정점을 그 좌표계로 되돌려 계산한다.
scratch = sys.argv[sys.argv.index("--") + 1]
work = os.path.join(scratch, "wrap")
addons_dir = bpy.utils.user_resource("SCRIPTS", path="addons", create=True)
if addons_dir not in sys.path:
    sys.path.append(addons_dir)
bpy.utils.refresh_script_paths()
bpy.ops.preferences.addon_enable(module="MB-Lab")
bpy.ops.wm.open_mainfile(filepath=os.path.join(work, "stage1.blend"))
original_scan = bpy.data.objects["scan"]
original_coords = np.array([tuple(original_scan.matrix_world @ v.co) for v in original_scan.data.vertices], dtype=np.float64)
bpy.ops.wm.open_mainfile(filepath=os.path.join(work, "stage2.blend"))
scan = bpy.data.objects["scan"]
body = bpy.data.objects["body"]
transformed_coords = np.array([tuple(scan.matrix_world @ v.co) for v in scan.data.vertices], dtype=np.float64)

# 유사 변환 복원 (원본 임포트 좌표 → 2단계 좌표)
def umeyama(source, target):
    mean_source = source.mean(axis=0)
    mean_target = target.mean(axis=0)
    source_centered = source - mean_source
    target_centered = target - mean_target
    covariance = target_centered.T @ source_centered / len(source)
    U, D, Vt = np.linalg.svd(covariance)
    S = np.eye(3)
    if np.linalg.det(U) * np.linalg.det(Vt) < 0:
        S[2, 2] = -1
    R = U @ S @ Vt
    variance_source = (source_centered ** 2).sum() / len(source)
    scale = (D * np.diag(S)).sum() / variance_source
    t = mean_target - scale * R @ mean_source
    return scale, R, t
scale, R, t = umeyama(original_coords, transformed_coords)
print("similarity restored: scale", round(scale, 5), "residual mm", round(float(np.linalg.norm(original_coords @ (scale * R).T + t - transformed_coords, axis=1).max()) * 1000, 3))

LANDMARKS = {
    "browLeft": [-0.89, 1.99, 1.99], "browRight": [0.65, 1.94, 1.98], "eyelidLeft": [-0.77, 1.64, 1.83], "eyelidRight": [0.57, 1.62, 1.87],
    "mouthCornerLeft": [-0.53, 0.39, 2.11], "mouthCornerRight": [0.37, 0.42, 2.09], "cheekLeft": [-1.33, 0.65, 1.31], "cheekRight": [1.1, 0.66, 1.28],
    "jowlLeft": [-1.05, -0.13, 1.34], "jowlRight": [0.92, -0.02, 1.32], "templeLeft": [-1.46, 2.01, 0.95], "templeRight": [1.25, 2.03, 0.93],
    "noseTip": [-0.09, 1.03, 2.57], "upperLip": [-0.12, 0.62, 2.33], "lowerLip": [-0.07, 0.41, 2.26], "chin": [0.01, -0.28, 2.26], "neckFront": [-0.08, -0.9, 1.15],
}
def gaussian(points, center, radius):
    center = np.array(center, dtype=np.float64)
    distance_squared = ((points - center) ** 2).sum(axis=1)
    sigma = radius * 0.5
    return np.exp(-distance_squared / (2.0 * sigma * sigma))
def shifted(name, dx, dy, dz):
    base = LANDMARKS[name]
    return [base[0] + dx, base[1] + dy, base[2] + dz]

def age_sag(points, normals):
    # points / normals: 스캔 원본 glTF 좌표계
    delta = np.zeros_like(points)
    jowl_left = gaussian(points, LANDMARKS["jowlLeft"], 0.95)
    jowl_right = gaussian(points, LANDMARKS["jowlRight"], 0.95)
    delta[:, 0] += -0.04 * jowl_left + 0.04 * jowl_right
    delta[:, 1] += -0.22 * (jowl_left + jowl_right)
    delta[:, 2] += 0.03 * (jowl_left + jowl_right)
    cheek = gaussian(points, LANDMARKS["cheekLeft"], 0.7) + gaussian(points, LANDMARKS["cheekRight"], 0.7)
    temple = gaussian(points, LANDMARKS["templeLeft"], 0.65) + gaussian(points, LANDMARKS["templeRight"], 0.65)
    hollow = 0.1 * cheek + 0.11 * temple
    delta -= normals * hollow[:, None]
    eye_bag = gaussian(points, shifted("eyelidLeft", 0, -0.3, -0.05), 0.42) + gaussian(points, shifted("eyelidRight", 0, -0.3, -0.05), 0.42)
    delta += normals * (0.05 * eye_bag)[:, None]
    upper_lip = gaussian(points, LANDMARKS["upperLip"], 0.38)
    lower_lip = gaussian(points, LANDMARKS["lowerLip"], 0.38)
    delta[:, 1] += 0.02 * upper_lip - 0.01 * lower_lip
    delta[:, 2] += -0.045 * (upper_lip + lower_lip)
    hood = gaussian(points, shifted("eyelidLeft", 0, 0.2, -0.02), 0.5) + gaussian(points, shifted("eyelidRight", 0, 0.2, -0.02), 0.5)
    delta[:, 1] += -0.02 * hood
    delta[:, 2] += 0.012 * hood
    socket = gaussian(points, shifted("eyelidLeft", 0.3, 0.05, -0.05), 0.35) + gaussian(points, shifted("eyelidRight", -0.3, 0.05, -0.05), 0.35)
    delta -= normals * (0.035 * socket)[:, None]
    nose = gaussian(points, LANDMARKS["noseTip"], 0.5)
    delta[:, 1] += -0.06 * nose
    pouch = gaussian(points, shifted("mouthCornerLeft", -0.42, 0.3, -0.32), 0.5) + gaussian(points, shifted("mouthCornerRight", 0.42, 0.3, -0.32), 0.5)
    crease = gaussian(points, shifted("mouthCornerLeft", -0.2, 0.25, -0.08), 0.24) + gaussian(points, shifted("mouthCornerRight", 0.2, 0.25, -0.08), 0.24)
    delta += normals * (0.05 * pouch - 0.03 * crease)[:, None]
    brow = gaussian(points, LANDMARKS["browLeft"], 0.65) + gaussian(points, LANDMARKS["browRight"], 0.65)
    delta[:, 1] += -0.05 * brow
    chin = gaussian(points, LANDMARKS["chin"], 0.6)
    delta[:, 1] += -0.03 * chin
    neck = gaussian(points, LANDMARKS["neckFront"], 0.6)
    delta[:, 1] += -0.05 * neck
    delta[:, 2] += 0.06 * neck
    return delta

# 바디 정점 → 원본 임포트 좌표 → glTF 좌표 (x, y, z) = (x_i, z_i, -y_i)
count = len(body.data.vertices)
coords = np.empty(count * 3, dtype=np.float64)
body.data.vertices.foreach_get("co", coords)
coords = coords.reshape(count, 3)
normals = np.empty(count * 3, dtype=np.float64)
body.data.vertex_normals.foreach_get("vector", normals)
normals = normals.reshape(count, 3)
inverse_rotation = np.linalg.inv(R)
import_coords = (coords - t) @ inverse_rotation.T / scale
import_normals = normals @ inverse_rotation.T
gltf_points = np.stack([import_coords[:, 0], import_coords[:, 2], -import_coords[:, 1]], axis=1)
gltf_normals = np.stack([import_normals[:, 0], import_normals[:, 2], -import_normals[:, 1]], axis=1)
delta_gltf = age_sag(gltf_points, gltf_normals)
delta_import = np.stack([delta_gltf[:, 0], -delta_gltf[:, 2], delta_gltf[:, 1]], axis=1)
delta = delta_import @ (scale * R).T

names = [m.name.lower() if m else "" for m in body.data.materials]
vertex_material = np.full(count, -1, dtype=np.int64)
for polygon in body.data.polygons:
    for vi in polygon.vertices:
        vertex_material[vi] = polygon.material_index
apply_mask = np.isin(vertex_material, [i for i, n in enumerate(names) if "skin3" in n or "eyelash" in n])
delta[~apply_mask] = 0.0
print("sag applied vertices:", int(apply_mask.sum()), "max mm", round(float(np.linalg.norm(delta, axis=1).max()) * 1000, 2))

for key in body.data.shape_keys.key_blocks:
    key_coords = np.empty(count * 3, dtype=np.float64)
    key.data.foreach_get("co", key_coords)
    key_coords = key_coords.reshape(count, 3) + delta
    key.data.foreach_set("co", key_coords.reshape(-1).astype(np.float32))
body.data.vertices.foreach_set("co", (coords + delta).reshape(-1).astype(np.float32))
body.data.update()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(work, "stage2.blend"))

scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.color_type = "SINGLE"
scene.display.shading.single_color = (0.6, 0.55, 0.5)
scene.display.shading.light = "STUDIO"
camera = bpy.data.objects["landmark_camera"]
camera.data.ortho_scale = 0.42
top = float((coords + delta)[apply_mask][:, 2].max())
for view_name, location, rotation in (("front", (0.0, -1.2, top - 0.17), (math.pi / 2.0, 0.0, 0.0)), ("quarter", (-0.85, -0.85, top - 0.17), (math.pi / 2.0, 0.0, -math.pi / 4.0))):
    camera.location = location
    camera.rotation_euler = rotation
    for o in scene.objects:
        if o.type == "MESH":
            o.hide_render = (o != body)
    scene.render.filepath = os.path.join(work, "sag_%s.png" % view_name)
    bpy.ops.render.render(write_still=True)
print("SAG DONE")
