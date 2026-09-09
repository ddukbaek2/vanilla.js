import sys
import os
import json
import math
import numpy as np

# 메타휴먼 DNA(행동 + 지오메트리)로 RigLogic 을 직접 계산한다.
# raw 제어값 → PSD(곱) → 조인트 그룹 행렬(관절 변환 델타) / 블렌드셰이프 채널 가중치 → 관절 계층 합성 → 스키닝.
# 결과: 메시별 정점(레이아웃 단위) / UV / 삼각형 / 포즈별 정점 위치를 npz 로 저장한다.
sys.path.insert(0, "D:/MetaHumanExport/dnacalib/lib/Maya2024/windows")
from dna import DataLayer_All, FileStream, Status, BinaryStreamReader

dna_path = sys.argv[1]
curves_path = sys.argv[2]
output_path = sys.argv[3]

stream = FileStream(dna_path, FileStream.AccessMode_Read, FileStream.OpenMode_Binary)
reader = BinaryStreamReader(stream, DataLayer_All)
reader.read()
if not Status.isOk():
    raise SystemExit("DNA read failed: " + Status.get().message)

raw_count = reader.getRawControlCount()
psd_count = reader.getPSDCount()
joint_count = reader.getJointCount()
raw_names = [reader.getRawControlName(i) for i in range(raw_count)]
raw_index = {name: i for i, name in enumerate(raw_names)}
print("raw", raw_count, "psd", psd_count, "joints", joint_count, "joint rows", reader.getJointRowCount(), "cols", reader.getJointColumnCount())

# PSD 정의
psd_rows = np.array(reader.getPSDRowIndices(), dtype=np.int64)
psd_cols = np.array(reader.getPSDColumnIndices(), dtype=np.int64)
psd_values = np.array(reader.getPSDValues(), dtype=np.float64)
input_count = raw_count + psd_count
print("psd entries", len(psd_rows), "row range", int(psd_rows.min()) if len(psd_rows) else None, int(psd_rows.max()) if len(psd_rows) else None)

# 조인트 그룹
joint_groups = []
for g in range(reader.getJointGroupCount()):
    lods = list(reader.getJointGroupLODs(g))
    row_count_lod0 = lods[0] if lods else 0
    inputs = np.array(reader.getJointGroupInputIndices(g), dtype=np.int64)
    outputs = np.array(reader.getJointGroupOutputIndices(g), dtype=np.int64)
    values = np.array(reader.getJointGroupValues(g), dtype=np.float64)
    if len(inputs) == 0 or len(outputs) == 0:
        continue
    matrix = values.reshape(len(outputs), len(inputs))
    joint_groups.append((inputs, outputs[:row_count_lod0], matrix[:row_count_lod0]))
print("joint groups", len(joint_groups))

# 블렌드셰이프 채널 (LOD0)
bs_lods = list(reader.getBlendShapeChannelLODs())
bs_inputs = np.array(reader.getBlendShapeChannelInputIndices(), dtype=np.int64)
bs_outputs = np.array(reader.getBlendShapeChannelOutputIndices(), dtype=np.int64)
bs_lod0 = bs_lods[0] if bs_lods else len(bs_inputs)
channel_count = reader.getBlendShapeChannelCount()
print("blendshape channels", channel_count, "lod0 inputs", bs_lod0)

# 중립 관절
neutral_translation = np.array([reader.getNeutralJointTranslation(i) for i in range(joint_count)], dtype=np.float64).reshape(joint_count, 3)
neutral_rotation = np.array([reader.getNeutralJointRotation(i) for i in range(joint_count)], dtype=np.float64).reshape(joint_count, 3)
parents = [reader.getJointParentIndex(i) for i in range(joint_count)]
joint_names = [reader.getJointName(i) for i in range(joint_count)]

def rotation_matrix_xyz(degrees):
    x, y, z = np.radians(degrees)
    cx, sx = math.cos(x), math.sin(x)
    cy, sy = math.cos(y), math.sin(y)
    cz, sz = math.cos(z), math.sin(z)
    rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return rz @ ry @ rx

def compose(translations, rotations):
    world = np.zeros((joint_count, 4, 4))
    for i in range(joint_count):
        local = np.eye(4)
        local[:3, :3] = rotation_matrix_xyz(rotations[i])
        local[:3, 3] = translations[i]
        parent = parents[i]
        world[i] = world[parent] @ local if (parent != i and parent >= 0) else local
    return world

neutral_world = compose(neutral_translation, neutral_rotation)
neutral_world_inverse = np.array([np.linalg.inv(m) for m in neutral_world])

def evaluate(raw_values):
    inputs = np.zeros(input_count)
    inputs[:raw_count] = np.clip(raw_values, 0.0, 1.0)
    # PSD: 같은 행의 (열 × 가중치) 곱
    psd = {}
    for row, col, value in zip(psd_rows, psd_cols, psd_values):
        psd[row] = psd.get(row, 1.0) * inputs[col] * value
    for row, value in psd.items():
        inputs[row] = value
    joint_delta = np.zeros(joint_count * 9)
    for group_inputs, group_outputs, matrix in joint_groups:
        joint_delta[group_outputs] += matrix @ inputs[group_inputs]
    joint_delta = joint_delta.reshape(joint_count, 9)
    translations = neutral_translation + joint_delta[:, 0:3]
    rotations = neutral_rotation + joint_delta[:, 3:6]
    channel_weights = np.zeros(channel_count)
    channel_weights[bs_outputs[:bs_lod0]] = inputs[bs_inputs[:bs_lod0]]
    return compose(translations, rotations), channel_weights

# 메시 (LOD0)
mesh_indices = [i for i in range(reader.getMeshCount()) if "_lod0_" in reader.getMeshName(i)]
meshes = {}
for mesh_index in mesh_indices:
    name = reader.getMeshName(mesh_index).replace("_lod0_mesh", "")
    positions = np.stack([reader.getVertexPositionXs(mesh_index), reader.getVertexPositionYs(mesh_index), reader.getVertexPositionZs(mesh_index)], axis=1).astype(np.float64)
    uvs = np.stack([reader.getVertexTextureCoordinateUs(mesh_index), reader.getVertexTextureCoordinateVs(mesh_index)], axis=1).astype(np.float64)
    layout_positions = np.array(reader.getVertexLayoutPositionIndices(mesh_index), dtype=np.int64)
    layout_uvs = np.array(reader.getVertexLayoutTextureCoordinateIndices(mesh_index), dtype=np.int64)
    triangles = []
    for face_index in range(reader.getFaceCount(mesh_index)):
        layout = list(reader.getFaceVertexLayoutIndices(mesh_index, face_index))
        for k in range(1, len(layout) - 1):
            triangles.append((layout[0], layout[k], layout[k + 1]))
    triangles = np.array(triangles, dtype=np.int64)
    # 스킨 가중치 (정점 단위)
    vertex_count = len(positions)
    influence = 0
    weight_entries = []
    for v in range(vertex_count):
        joints = list(reader.getSkinWeightsJointIndices(mesh_index, v))
        values = list(reader.getSkinWeightsValues(mesh_index, v))
        weight_entries.append(list(zip(joints, values)))
        influence = max(influence, len(joints))
    skin_joints = np.zeros((vertex_count, max(influence, 1)), dtype=np.int64)
    skin_weights = np.zeros((vertex_count, max(influence, 1)), dtype=np.float64)
    for v, entries in enumerate(weight_entries):
        for slot, (j, w) in enumerate(entries):
            skin_joints[v, slot] = j
            skin_weights[v, slot] = w
    # 블렌드셰이프 타깃 (정점 단위 델타)
    targets = []
    for t in range(reader.getBlendShapeTargetCount(mesh_index)):
        channel = reader.getBlendShapeChannelIndex(mesh_index, t)
        vertex_indices = np.array(reader.getBlendShapeTargetVertexIndices(mesh_index, t), dtype=np.int64)
        deltas = np.stack([reader.getBlendShapeTargetDeltaXs(mesh_index, t), reader.getBlendShapeTargetDeltaYs(mesh_index, t), reader.getBlendShapeTargetDeltaZs(mesh_index, t)], axis=1).astype(np.float64)
        targets.append((channel, vertex_indices, deltas))
    meshes[name] = {"positions": positions, "uvs": uvs, "layout_positions": layout_positions, "layout_uvs": layout_uvs, "triangles": triangles, "skin_joints": skin_joints, "skin_weights": skin_weights, "targets": targets}
    print("mesh", name, "vertices", vertex_count, "layouts", len(layout_positions), "triangles", len(triangles), "influences", influence, "targets", len(targets))

def skin_mesh(mesh, world, channel_weights):
    positions = mesh["positions"].copy()
    for channel, vertex_indices, deltas in mesh["targets"]:
        weight = channel_weights[channel]
        if abs(weight) > 1e-5:
            positions[vertex_indices] += weight * deltas
    skin = world @ neutral_world_inverse
    homogeneous = np.hstack([positions, np.ones((len(positions), 1))])
    selected = skin[mesh["skin_joints"]]
    transformed = np.einsum("vkij,vj->vki", selected, homogeneous)
    result = np.einsum("vk,vki->vi", mesh["skin_weights"], transformed)[:, :3]
    unskinned = mesh["skin_weights"].sum(axis=1) <= 0.0
    result[unskinned] = positions[unskinned]
    return result

# 포즈별 raw 제어값 (UE ARKit 매핑 애니메이션 커브) — 이름 규약 맞추기: CTRL_expressions_jawOpen ↔ CTRL_expressions.jawOpen
if curves_path == "test":
    test_names = ["Default", "JawOpen", "EyeBlinkLeft", "MouthSmileLeft"]
    test_controls = {"JawOpen": {"CTRL_expressions.jawOpen": 1.0}, "EyeBlinkLeft": {"CTRL_expressions.eyeBlinkL": 1.0}, "MouthSmileLeft": {"CTRL_expressions.mouthCornerPullL": 1.0}}
    curve_data = {"pose_names": test_names, "frame_count": len(test_names), "curves": {}}
    for raw_name in raw_names:
        curve_data["curves"][raw_name] = [test_controls.get(n, {}).get(raw_name, 0.0) for n in test_names]
else:
    curve_data = json.load(open(curves_path))
pose_names = curve_data["pose_names"]
frame_count = curve_data["frame_count"]
curve_lookup = {}
for name, values in curve_data["curves"].items():
    key = name.lower().replace(".", "_")
    curve_lookup[key] = values
matched = 0
raw_curve_values = np.zeros((frame_count, raw_count))
for i, raw_name in enumerate(raw_names):
    key = raw_name.lower().replace(".", "_")
    if key in curve_lookup:
        raw_curve_values[:, i] = curve_lookup[key][:frame_count]
        matched += 1
print("raw controls matched to curves", matched, "of", raw_count)

output = {"pose_names": pose_names[:frame_count], "mesh_names": list(meshes.keys())}
arrays = {}
for name, mesh in meshes.items():
    arrays[f"{name}__layout_positions"] = mesh["layout_positions"]
    arrays[f"{name}__layout_uvs"] = mesh["layout_uvs"]
    arrays[f"{name}__uvs"] = mesh["uvs"]
    arrays[f"{name}__triangles"] = mesh["triangles"]
    arrays[f"{name}__neutral"] = mesh["positions"]
for frame in range(frame_count):
    world, channel_weights = evaluate(raw_curve_values[frame])
    pose_name = pose_names[frame] if frame < len(pose_names) else f"frame_{frame}"
    for name, mesh in meshes.items():
        arrays[f"{name}__pose_{frame}"] = skin_mesh(mesh, world, channel_weights)
    if frame % 16 == 0 or pose_name in ("JawOpen", "EyeBlinkLeft", "MouthSmileLeft"):
        head = arrays[f"head__pose_{frame}"]
        delta = np.linalg.norm(head - meshes["head"]["positions"], axis=1)
        print(f"frame {frame} {pose_name}: max vertex move {delta.max():.3f} cm, moved>1mm {int((delta > 0.1).sum())}, active channels {int((np.abs(channel_weights) > 1e-3).sum())}")
np.savez_compressed(output_path, meta=json.dumps(output), **arrays)
print("SAVED", output_path)
