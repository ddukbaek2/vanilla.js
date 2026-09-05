import bpy
import bmesh
import os
import sys
import json
import math
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

scratch = sys.argv[sys.argv.index("--") + 1]
work = os.path.join(scratch, "wrap")
addons_dir = bpy.utils.user_resource("SCRIPTS", path="addons", create=True)
if addons_dir not in sys.path:
    sys.path.append(addons_dir)
bpy.utils.refresh_script_paths()
bpy.ops.preferences.addon_enable(module="MB-Lab")
bpy.ops.wm.open_mainfile(filepath=os.path.join(work, "stage1.blend"))
scene = bpy.context.scene
scan = bpy.data.objects["scan"]
body = bpy.data.objects["body"]
armature = bpy.data.objects["armature"]
cameras = json.load(open(os.path.join(work, "cameras.json")))
landmarks = json.load(open(os.path.join(work, "landmarks.json")))

EYE_CONTOUR = {7, 163, 144, 145, 153, 154, 155, 173, 157, 158, 159, 160, 161, 246, 382, 381, 380, 374, 373, 390, 249, 466, 388, 387, 386, 385, 384, 398}
EYE_CONTOUR |= set(range(468, 478))

def world_vertices(obj):
    mesh = obj.data
    count = len(mesh.vertices)
    coords = np.empty(count * 3, dtype=np.float64)
    mesh.vertices.foreach_get("co", coords)
    coords = coords.reshape(count, 3)
    matrix = np.array(obj.matrix_world, dtype=np.float64)
    return coords @ matrix[:3, :3].T + matrix[:3, 3]

def material_polygons(obj, keyword):
    names = [m.name.lower() if m else "" for m in obj.data.materials]
    return [p for p in obj.data.polygons if keyword in names[p.material_index]]

def build_bvh(coords, polygons):
    return BVHTree.FromPolygons([Vector(c) for c in coords], [list(p.vertices) for p in polygons], all_triangles=False)

def raycast_landmarks(name, bvh):
    camera = cameras[name]
    points = {}
    for index, (u, v, _) in enumerate(landmarks[name]):
        origin = Vector((camera["center_x"] + (u - 0.5) * camera["ortho_scale"], camera["camera_y"], camera["center_z"] + (0.5 - v) * camera["ortho_scale"]))
        hit = bvh.ray_cast(origin, Vector((0.0, 1.0, 0.0)), 50.0)
        if hit[0] is not None:
            points[index] = np.array(hit[0], dtype=np.float64)
    return points

scan_coords = world_vertices(scan)
scan_bvh = build_bvh(scan_coords, list(scan.data.polygons))
body_coords = world_vertices(body)
skin_polygons = material_polygons(body, "skin3")
skin_bvh = build_bvh(body_coords, skin_polygons)
scan_points = raycast_landmarks("scan", scan_bvh)
body_points = raycast_landmarks("body", skin_bvh)
common = [i for i in range(468) if i in scan_points and i in body_points and i not in EYE_CONTOUR]
print("landmark pairs:", len(common))
P_scan = np.array([scan_points[i] for i in common])
P_body = np.array([body_points[i] for i in common])

# 유사 변환 (Umeyama): 스캔 → 바디 좌표계
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

scale, R, t = umeyama(P_scan, P_body)
print("similarity scale:", scale, "rotation diag:", np.diag(R).round(4), "translation:", t.round(4))
scan_coords = scan_coords @ (scale * R).T + t
P_scan = P_scan @ (scale * R).T + t
scan.matrix_world.identity()
scan.data.vertices.foreach_set("co", scan_coords.reshape(-1).astype(np.float32))
scan.data.update()
scan_bvh = build_bvh(scan_coords, list(scan.data.polygons))
residual = np.linalg.norm(P_scan - P_body, axis=1)
print("after similarity residual mm: mean", round(residual.mean() * 1000, 2), "max", round(residual.max() * 1000, 2))

# 3D 박판 스플라인 (바디 랜드마크 → 스캔 랜드마크)
TPS_CENTER = P_body.mean(axis=0)
def tps_solve(sources, targets, regularization):
    count = len(sources)
    centered = sources - TPS_CENTER
    K = -np.linalg.norm(centered[:, None, :] - centered[None, :, :], axis=2)
    P = np.hstack([np.ones((count, 1)), centered])
    A = np.zeros((count + 4, count + 4))
    A[:count, :count] = K + regularization * np.eye(count)
    A[:count, count:] = P
    A[count:, :count] = P.T
    B = np.zeros((count + 4, 3))
    B[:count] = targets - TPS_CENTER
    solution = np.linalg.solve(A, B)
    return solution[:count], solution[count:]

def tps_apply(points, sources, W, A):
    result = np.empty_like(points)
    step = 4096
    centered_sources = sources - TPS_CENTER
    for start in range(0, len(points), step):
        chunk = points[start:start + step] - TPS_CENTER
        U = -np.linalg.norm(chunk[:, None, :] - centered_sources[None, :, :], axis=2)
        P = np.hstack([np.ones((len(chunk), 1)), chunk])
        result[start:start + step] = P @ A + U @ W + TPS_CENTER
    return result

# 두개골 앵커: 두 머리의 눈 중심 기준 같은 방향 광선의 표면 교점
def eye_center_from_landmarks(points, transform):
    corners = [transform(points[i]) for i in (33, 133, 362, 263) if i in points]
    return np.mean(corners, axis=0)
scan_eye = eye_center_from_landmarks(scan_points, lambda p: p @ (scale * R).T + t)
body_eye = eye_center_from_landmarks(body_points, lambda p: p)
ANCHOR_DIRECTIONS = []
for elevation_degrees, azimuths in ((85, (0,)), (65, (0, 60, -60, 120, -120, 180)), (45, (0, 45, -45, 90, -90, 135, -135, 180)), (20, (0, 30, -30)), (0, (0, 30, -30)), (-25, (0, 25, -25))):
    for azimuth_degrees in azimuths:
        elevation = math.radians(elevation_degrees)
        azimuth = math.radians(azimuth_degrees)
        ANCHOR_DIRECTIONS.append(Vector((math.sin(azimuth) * math.cos(elevation), math.cos(azimuth) * math.cos(elevation), math.sin(elevation))))
def anchor_points(bvh, eye):
    center = Vector((eye[0], eye[1] + 0.08, eye[2] + 0.025))
    hits = []
    for direction in ANCHOR_DIRECTIONS:
        hit = bvh.ray_cast(center, direction, 1.0)
        hits.append(np.array(hit[0], dtype=np.float64) if hit[0] is not None else None)
    return hits
scan_anchors = anchor_points(scan_bvh, scan_eye)
body_anchors = anchor_points(skin_bvh, body_eye)
anchor_pairs = [(b, s) for b, s in zip(body_anchors, scan_anchors) if b is not None and s is not None]
print("anchor pairs:", len(anchor_pairs), "of", len(ANCHOR_DIRECTIONS), "mean offset mm", round(float(np.mean([np.linalg.norm(s - b) for b, s in anchor_pairs])) * 1000, 1))
P_body = np.vstack([P_body, np.array([b for b, s in anchor_pairs])])
P_scan = np.vstack([P_scan, np.array([s for b, s in anchor_pairs])])
np.savez(os.path.join(work, "landmark_points.npz"), body=P_body, scan=P_scan)
W, A = tps_solve(P_body, P_scan, 0.002)
warped_landmarks = tps_apply(P_body, P_body, W, A)
residual = np.linalg.norm(P_scan - warped_landmarks, axis=1)
print("after TPS residual mm: mean", round(residual.mean() * 1000, 2), "max", round(residual.max() * 1000, 2))
body_coords = tps_apply(body_coords, P_body, W, A)

# 표면 투영 (피부만, 법선 일치 / 깊이 / 눈 주변 / 스캔 경계 가중)
names = [m.name.lower() if m else "" for m in body.data.materials]
vertex_material = np.full(len(body.data.vertices), -1, dtype=np.int64)
for polygon in body.data.polygons:
    for vi in polygon.vertices:
        vertex_material[vi] = polygon.material_index
def material_index(keyword):
    return [i for i, n in enumerate(names) if keyword in n][0]
skin_index = material_index("skin3")
skin_mask = vertex_material == skin_index
scan_minimum = scan_coords.min(axis=0) - 0.02
scan_maximum = scan_coords.max(axis=0) + 0.02
inside_scan_box = np.all((body_coords > scan_minimum) & (body_coords < scan_maximum), axis=1)
skin_vertices = np.where(skin_mask & inside_scan_box)[0]
print("projection candidates:", len(skin_vertices), "of skin", int(skin_mask.sum()))
eye_mask = vertex_material == material_index("human_eyes")
eye_centers = []
for side in (-1.0, 1.0):
    side_mask = eye_mask & ((body_coords[:, 0] * side) > 0)
    eye_centers.append(body_coords[side_mask].mean(axis=0))
print("eye centers:", [c.round(4) for c in eye_centers])
for keyword in ("generic", "human_teeth", "tongue", "eyelash", "nails"):
    part = body_coords[vertex_material == material_index(keyword)]
    print(keyword, "count", len(part), "center", part.mean(axis=0).round(3), "size", (part.max(axis=0) - part.min(axis=0)).round(3))

scan_bm = bmesh.new()
scan_bm.from_mesh(scan.data)
boundary = [v.co.copy() for v in scan_bm.verts if any(e.is_boundary for e in v.link_edges)]
scan_bm.free()
boundary_tree = KDTree(len(boundary))
for i, co in enumerate(boundary):
    boundary_tree.insert(co, i)
boundary_tree.balance()
print("scan boundary vertices:", len(boundary))

edges = np.array([(e.vertices[0], e.vertices[1]) for e in body.data.edges], dtype=np.int64)
skin_edges = edges[skin_mask[edges[:, 0]] & skin_mask[edges[:, 1]]]
def smooth_field(field, iterations):
    for _ in range(iterations):
        sums = np.zeros_like(field)
        counts = np.zeros(len(field))
        np.add.at(sums, skin_edges[:, 0], field[skin_edges[:, 1]])
        np.add.at(sums, skin_edges[:, 1], field[skin_edges[:, 0]])
        np.add.at(counts, skin_edges[:, 0], 1.0)
        np.add.at(counts, skin_edges[:, 1], 1.0)
        valid = counts > 0
        field[valid] = 0.5 * field[valid] + 0.5 * sums[valid] / counts[valid][:, None]
    return field

def vertex_normals(coords):
    body.data.vertices.foreach_set("co", coords.reshape(-1).astype(np.float32))
    body.data.update()
    normals = np.empty(len(body.data.vertices) * 3, dtype=np.float64)
    body.data.vertex_normals.foreach_get("vector", normals)
    return normals.reshape(-1, 3)

lip_landmark_indices = [common.index(i) for i in (13, 14, 0, 17, 61, 291) if i in common]
lip_points = P_scan[lip_landmark_indices]
mouth_center = lip_points.mean(axis=0)
eye_center = (eye_centers[0] + eye_centers[1]) / 2.0
print("mouth center:", mouth_center.round(4), "eye center:", eye_center.round(4))
def projection_region_weight(p):
    # 입안: 입술 뒤쪽 상자 안은 투영하지 않는다
    if abs(p[0] - mouth_center[0]) < 0.045 and abs(p[2] - mouth_center[2]) < 0.03 and p[1] > mouth_center[1] + 0.006:
        return 0.0
    # 귀: 눈 뒤쪽 띠에서 바깥으로 튀어나온 부분은 투영하지 않는다
    if -0.08 < p[2] - eye_center[2] < 0.05 and eye_center[1] + 0.035 < p[1] < eye_center[1] + 0.14:
        return max(0.0, min(1.0, (0.066 - abs(p[0])) / 0.012))
    return 1.0

total_displacement = np.zeros_like(body_coords)
for iteration, smoothing in enumerate((12, 8, 6, 4, 3)):
    normals = vertex_normals(body_coords)
    displacement = np.zeros_like(body_coords)
    stats = []
    for vi in skin_vertices:
        p = body_coords[vi]
        location, normal, index, distance = scan_bvh.find_nearest(Vector(p))
        if location is None:
            continue
        q = np.array(location)
        n = np.array(normal)
        signed = float(np.dot(p - q, n))
        agreement = float(np.dot(normals[vi], n))
        weight = max(0.0, min(1.0, (agreement - 0.2) / 0.5))
        weight *= projection_region_weight(p)
        eye_distance = min(np.linalg.norm(p - c) for c in eye_centers)
        weight *= max(0.0, min(1.0, (eye_distance - 0.02) / 0.012))
        _, boundary_index, boundary_distance = boundary_tree.find(location)
        weight *= max(0.0, min(1.0, (boundary_distance - 0.01) / 0.04))
        offset = q - p
        offset_length = float(np.linalg.norm(offset))
        if offset_length > 0.03:
            offset = offset * (0.03 / offset_length)
        displacement[vi] = weight * offset
        if weight > 0.0:
            stats.append(abs(signed))
    displacement = smooth_field(displacement, smoothing)
    body_coords += displacement
    total_displacement += displacement
    print("iteration", iteration, "mean |signed| mm", round(float(np.mean(stats)) * 1000, 2), "max", round(float(np.max(stats)) * 1000, 2))

# 눈알 / 치아 / 혀 / 입안은 주변 피부 변위의 평균만큼 강체 이동
def rigid_follow(part_mask, center, radius):
    near = skin_mask & (np.linalg.norm(body_coords - center, axis=1) < radius)
    offset = total_displacement[near].mean(axis=0) if near.any() else np.zeros(3)
    body_coords[part_mask] += offset
    total_displacement[part_mask] += offset
    return offset
for side_index, center in enumerate(eye_centers):
    side = -1.0 if side_index == 0 else 1.0
    side_mask = (body_coords[:, 0] * side) > 0
    part = side_mask & np.isin(vertex_material, [material_index(k) for k in ("human_eyes", "cornea", "iris", "pupil", "eyelash")])
    print("eye follow", side, rigid_follow(part, center, 0.03).round(4))
mouth_parts = np.isin(vertex_material, [material_index(k) for k in ("generic", "human_teeth", "tongue")])
mouth_center = body_coords[vertex_material == material_index("human_teeth")].mean(axis=0)
print("mouth follow", rigid_follow(mouth_parts, mouth_center, 0.035).round(4))

# 정점 / 셰이프키 / 본 적용
key_blocks = body.data.shape_keys.key_blocks
count = len(body.data.vertices)
for key in key_blocks:
    coords = np.empty(count * 3, dtype=np.float64)
    key.data.foreach_get("co", coords)
    coords = coords.reshape(count, 3)
    coords = tps_apply(coords, P_body, W, A) + total_displacement
    key.data.foreach_set("co", coords.reshape(-1).astype(np.float32))
body.data.vertices.foreach_set("co", body_coords.reshape(-1).astype(np.float32))
body.data.update()
bpy.ops.object.select_all(action="DESELECT")
armature.select_set(True)
bpy.context.view_layer.objects.active = armature
bpy.ops.object.mode_set(mode="EDIT")
matrix = np.array(armature.matrix_world, dtype=np.float64)
for bone in armature.data.edit_bones:
    for attribute in ("head", "tail"):
        point = np.array(getattr(bone, attribute), dtype=np.float64) @ matrix[:3, :3].T + matrix[:3, 3]
        warped = tps_apply(point[None, :], P_body, W, A)[0]
        setattr(bone, attribute, Vector(np.linalg.solve(matrix[:3, :3], warped - matrix[:3, 3])))
bpy.ops.object.mode_set(mode="OBJECT")
for modifier in list(body.modifiers):
    if modifier.type != "ARMATURE":
        body.modifiers.remove(modifier)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(work, "stage2.blend"))

# 확인 렌더
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.color_type = "SINGLE"
scene.display.shading.single_color = (0.6, 0.55, 0.5)
camera = bpy.data.objects["landmark_camera"]
camera_info = cameras["body"]
camera.data.ortho_scale = 0.42
top = body_coords[skin_mask][:, 2].max()
for view_name, location, rotation in (("front", (0.0, camera_info["camera_y"], top - 0.17), (math.pi / 2.0, 0.0, 0.0)), ("side", (-1.2, 0.0, top - 0.17), (math.pi / 2.0, 0.0, -math.pi / 2.0)), ("quarter", (-0.85, -0.85, top - 0.17), (math.pi / 2.0, 0.0, -math.pi / 4.0))):
    camera.location = location
    camera.rotation_euler = rotation
    for target, label in ((body, "body"), (scan, "scan")):
        for o in scene.objects:
            if o.type == "MESH":
                o.hide_render = (o != target)
        scene.render.filepath = os.path.join(work, "wrapped_%s_%s.png" % (label, view_name))
        bpy.ops.render.render(write_still=True)
print("STAGE2 DONE")
