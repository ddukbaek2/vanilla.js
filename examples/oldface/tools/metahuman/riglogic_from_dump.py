import sys
import os
import json
import numpy as np

# OldFaceTools(UE C++ 모듈)가 덤프한 DNA 지오메트리(manifest.json + 바이너리)와 RigLogic 포즈 결과(poses_joints.f32 /
# poses_blendshapes.f32)로 포즈별 정점 위치를 계산해 build_metahuman_glb.py 가 읽는 npz 를 만든다.
# 관절 값은 (위치 3, 쿼터니언 xyzw 4, 스케일 3) 로컬 변환이며 DNA 좌표(Maya Y 위, cm) 그대로다.
dump_dir = sys.argv[1]
pose_names_path = sys.argv[2]
output_path = sys.argv[3]

manifest = json.load(open(os.path.join(dump_dir, "manifest.json"), encoding="utf-8"))
poses_manifest = json.load(open(os.path.join(dump_dir, "poses_manifest.json"), encoding="utf-8"))
pose_names = json.load(open(pose_names_path))["pose_names"]
joint_count = int(manifest["joint_count"])
attribute_count = int(manifest["joint_attribute_count"])
parents = [int(p) for p in manifest["joint_parents"]]
pose_count = int(poses_manifest["pose_count"])
blendshape_count = int(poses_manifest["blendshape_count"])
neutral = np.fromfile(os.path.join(dump_dir, "neutral_joints.f32"), dtype=np.float32).astype(np.float64).reshape(joint_count, attribute_count)
pose_joints = np.fromfile(os.path.join(dump_dir, "poses_joints.f32"), dtype=np.float32).astype(np.float64).reshape(pose_count, joint_count, 10)
pose_blendshapes = np.fromfile(os.path.join(dump_dir, "poses_blendshapes.f32"), dtype=np.float32).astype(np.float64).reshape(pose_count, blendshape_count) if blendshape_count > 0 else np.zeros((pose_count, 0))
print("joints", joint_count, "attributes", attribute_count, "poses", pose_count, "blendshapes", blendshape_count, "matched controls", poses_manifest.get("matched_controls"))

def matrix_from_trs(values):
    tx, ty, tz, qx, qy, qz, qw, sx, sy, sz = values[:10]
    xx, yy, zz = qx * qx, qy * qy, qz * qz
    xy, xz, yz = qx * qy, qx * qz, qy * qz
    wx, wy, wz = qw * qx, qw * qy, qw * qz
    rotation = np.array([
        [1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy)],
        [2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx)],
        [2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy)],
    ])
    matrix = np.eye(4)
    matrix[:3, :3] = rotation @ np.diag([sx, sy, sz])
    matrix[:3, 3] = [tx, ty, tz]
    return matrix

def compose(local_values):
    world = np.zeros((joint_count, 4, 4))
    for i in range(joint_count):
        local = matrix_from_trs(local_values[i])
        parent = parents[i]
        world[i] = world[parent] @ local if (parent != i and 0 <= parent < i) else local
    return world

neutral_world = compose(neutral)
neutral_world_inverse = np.array([np.linalg.inv(m) for m in neutral_world])

meshes = {}
for entry in manifest["meshes"]:
    name = entry["name"]
    prefix = os.path.join(dump_dir, name + "__")
    vertex_count = int(entry["vertex_count"])
    influences = int(entry["influences"])
    positions = np.fromfile(prefix + "positions.f32", dtype=np.float32).astype(np.float64).reshape(vertex_count, 3)
    uvs = np.fromfile(prefix + "uvs.f32", dtype=np.float32).astype(np.float64).reshape(-1, 2)
    layout_positions = np.fromfile(prefix + "layout_positions.u32", dtype=np.uint32).astype(np.int64)
    layout_uvs = np.fromfile(prefix + "layout_uvs.u32", dtype=np.uint32).astype(np.int64)
    triangles = np.fromfile(prefix + "triangles.u32", dtype=np.uint32).astype(np.int64).reshape(-1, 3)
    skin_joints = np.fromfile(prefix + "skin_joints.u32", dtype=np.uint32).astype(np.int64).reshape(vertex_count, influences)
    skin_weights = np.fromfile(prefix + "skin_weights.f32", dtype=np.float32).astype(np.float64).reshape(vertex_count, influences)
    target_channels = np.fromfile(prefix + "target_channels.u32", dtype=np.uint32).astype(np.int64)
    target_offsets = np.fromfile(prefix + "target_offsets.u32", dtype=np.uint32).astype(np.int64)
    target_vertex_indices = np.fromfile(prefix + "target_vertex_indices.u32", dtype=np.uint32).astype(np.int64)
    target_deltas = np.fromfile(prefix + "target_deltas.f32", dtype=np.float32).astype(np.float64).reshape(-1, 3)
    targets = []
    for t in range(len(target_channels)):
        start, end = target_offsets[t], target_offsets[t + 1]
        targets.append((int(target_channels[t]), target_vertex_indices[start:end], target_deltas[start:end]))
    meshes[name] = {"positions": positions, "uvs": uvs, "layout_positions": layout_positions, "layout_uvs": layout_uvs, "triangles": triangles, "skin_joints": skin_joints, "skin_weights": skin_weights, "targets": targets}
    print("mesh", name, "vertices", vertex_count, "layouts", len(layout_positions), "triangles", len(triangles), "influences", influences, "targets", len(targets))

def skin_mesh(mesh, world, channel_weights):
    positions = mesh["positions"].copy()
    for channel, vertex_indices, deltas in mesh["targets"]:
        if channel < len(channel_weights) and abs(channel_weights[channel]) > 1e-5:
            positions[vertex_indices] += channel_weights[channel] * deltas
    skin = world @ neutral_world_inverse
    homogeneous = np.hstack([positions, np.ones((len(positions), 1))])
    transformed = np.einsum("vkij,vj->vki", skin[mesh["skin_joints"]], homogeneous)
    result = np.einsum("vk,vki->vi", mesh["skin_weights"], transformed)[:, :3]
    unskinned = mesh["skin_weights"].sum(axis=1) <= 0.0
    result[unskinned] = positions[unskinned]
    return result

arrays = {}
for name, mesh in meshes.items():
    arrays[f"{name}__layout_positions"] = mesh["layout_positions"]
    arrays[f"{name}__layout_uvs"] = mesh["layout_uvs"]
    arrays[f"{name}__uvs"] = mesh["uvs"]
    arrays[f"{name}__triangles"] = mesh["triangles"]
    arrays[f"{name}__neutral"] = mesh["positions"]
for frame in range(pose_count):
    world = compose(pose_joints[frame])
    pose_name = pose_names[frame] if frame < len(pose_names) else f"frame_{frame}"
    for name, mesh in meshes.items():
        arrays[f"{name}__pose_{frame}"] = skin_mesh(mesh, world, pose_blendshapes[frame])
    if frame % 16 == 0 or pose_name in ("JawOpen", "EyeBlinkLeft", "MouthSmileLeft"):
        head_name = "head" if "head" in meshes else list(meshes.keys())[0]
        delta = np.linalg.norm(arrays[f"{head_name}__pose_{frame}"] - meshes[head_name]["positions"], axis=1)
        print(f"frame {frame} {pose_name}: max vertex move {delta.max():.3f} cm, moved>1mm {int((delta > 0.1).sum())}")
np.savez_compressed(output_path, meta=json.dumps({"pose_names": pose_names[:pose_count], "mesh_names": list(meshes.keys())}), **arrays)
print("SAVED", output_path)
