import sys
import json
import numpy as np
from scipy.spatial import cKDTree

# 그룸 카드 메시(아키타입 머리 기준)를 대상 캐릭터 머리에 바인딩해 중립 / 포즈별 정점을 만든다.
# 카드 정점마다 소스 머리의 최근접 삼각형(무게중심 좌표 + 삼각형 로컬 프레임 오프셋)을 찾고, 같은 토폴로지의
# 대상 머리(중립, 포즈)에서 그 삼각형 프레임으로 위치를 재구성한다 (그룸 바인딩의 RBF 를 국소 프레임 전달로 대신).
# 사용: python fit_hair_cards.py <parts.json> <target npz> <output npz> [--cards-only]
# --cards-only: 대상 머리 메시를 빼고 카드 파트만 담는다 (머리카락 LOD 별 glb 용)
# parts.json: [{"name": "hair", "cards": "<cards_raw.npz 의 키 접두어>", "source_head": "<legacy_heads_dna.npz 의 키>"}]
# 소스 머리 정점(DNA 순서, Maya cm)은 legacy_heads_to_dna.py 가 만들고, 삼각형은 아키타입 덤프의 것을 쓴다.
parts = json.load(open(sys.argv[1]))
target = np.load(sys.argv[2])
output_path = sys.argv[3]
cards_raw = np.load("D:/MetaHumanExport/Grooms/cards_raw.npz")
meta = json.loads(str(target["meta"]))
pose_names = meta["pose_names"]

ARCHETYPE = "D:/MetaHumanExport/Dump_archetype"
legacy_heads = np.load("D:/MetaHumanExport/Grooms/legacy_heads_dna.npz")

def load_source_head(key):
    positions = legacy_heads[key].astype(np.float64)
    layout_positions = np.fromfile(f"{ARCHETYPE}/head__layout_positions.u32", dtype=np.uint32)
    triangles = np.fromfile(f"{ARCHETYPE}/head__triangles.u32", dtype=np.uint32).reshape(-1, 3)
    return positions, layout_positions[triangles].astype(np.int64)

def blender_cards_to_maya(points):
    # Blender FBX 임포트 (x, y 뒤, z 위) → Maya (x, z, -y)
    return np.stack([points[:, 0], points[:, 2], -points[:, 1]], axis=1).astype(np.float64)

def triangle_frames(vertices, triangles):
    v0 = vertices[triangles[:, 0]]
    v1 = vertices[triangles[:, 1]]
    v2 = vertices[triangles[:, 2]]
    e1 = v1 - v0
    e1 /= np.linalg.norm(e1, axis=1, keepdims=True) + 1e-12
    normal = np.cross(v1 - v0, v2 - v0)
    normal /= np.linalg.norm(normal, axis=1, keepdims=True) + 1e-12
    e2 = np.cross(normal, e1)
    return v0, v1, v2, np.stack([e1, e2, normal], axis=2)  # [T, 3, 3] 열 = 축

def closest_point_barycentric(p, a, b, c):
    # 점 p 에서 삼각형 abc 의 최근접점 무게중심 좌표 (Ericson, Real-Time Collision Detection)
    ab = b - a
    ac = c - a
    ap = p - a
    d1 = np.einsum("ij,ij->i", ab, ap)
    d2 = np.einsum("ij,ij->i", ac, ap)
    bp = p - b
    d3 = np.einsum("ij,ij->i", ab, bp)
    d4 = np.einsum("ij,ij->i", ac, bp)
    cp = p - c
    d5 = np.einsum("ij,ij->i", ab, cp)
    d6 = np.einsum("ij,ij->i", ac, cp)
    vc = d3 * d2 - d1 * d4
    vb = d5 * d2 - d1 * d6
    va = d3 * d6 - d5 * d4
    bary = np.zeros((len(p), 3))
    # 기본: 내부
    denominator = va + vb + vc
    safe = np.where(np.abs(denominator) < 1e-20, 1e-20, denominator)
    v = vb / safe
    w = vc / safe
    bary[:, 1] = v
    bary[:, 2] = w
    bary[:, 0] = 1.0 - v - w
    # 정점 영역
    region_a = (d1 <= 0) & (d2 <= 0)
    bary[region_a] = [1, 0, 0]
    region_b = (d3 >= 0) & (d4 <= d3)
    bary[region_b] = [0, 1, 0]
    region_c = (d6 >= 0) & (d5 <= d6)
    bary[region_c] = [0, 0, 1]
    # 변 영역
    edge_ab = (vc <= 0) & (d1 >= 0) & (d3 <= 0) & ~region_a & ~region_b & ~region_c
    t = d1 / (d1 - d3 + 1e-20)
    bary[edge_ab] = np.stack([1 - t, t, np.zeros_like(t)], axis=1)[edge_ab]
    edge_ac = (vb <= 0) & (d2 >= 0) & (d6 <= 0) & ~region_a & ~region_b & ~region_c
    t = d2 / (d2 - d6 + 1e-20)
    bary[edge_ac] = np.stack([1 - t, np.zeros_like(t), t], axis=1)[edge_ac]
    edge_bc = (va <= 0) & (d4 - d3 >= 0) & (d5 - d6 >= 0) & ~region_a & ~region_b & ~region_c
    t = (d4 - d3) / ((d4 - d3) + (d5 - d6) + 1e-20)
    bary[edge_bc] = np.stack([np.zeros_like(t), 1 - t, t], axis=1)[edge_bc]
    bary = np.clip(bary, 0, 1)
    bary /= bary.sum(axis=1, keepdims=True)
    return bary

def bind(points, vertices, triangles, candidates=24):
    v0, v1, v2, frames = triangle_frames(vertices, triangles)
    centroids = (v0 + v1 + v2) / 3.0
    tree = cKDTree(centroids)
    _, nearest = tree.query(points, k=candidates)
    best_distance = np.full(len(points), np.inf)
    best_triangle = np.zeros(len(points), dtype=np.int64)
    best_bary = np.zeros((len(points), 3))
    for column in range(candidates):
        triangle_index = nearest[:, column]
        bary = closest_point_barycentric(points, v0[triangle_index], v1[triangle_index], v2[triangle_index])
        closest = bary[:, 0:1] * v0[triangle_index] + bary[:, 1:2] * v1[triangle_index] + bary[:, 2:3] * v2[triangle_index]
        distance = np.linalg.norm(points - closest, axis=1)
        better = distance < best_distance
        best_distance[better] = distance[better]
        best_triangle[better] = triangle_index[better]
        best_bary[better] = bary[better]
    closest = np.einsum("ij,ijk->ik", best_bary, np.stack([v0[best_triangle], v1[best_triangle], v2[best_triangle]], axis=1))
    offset_world = points - closest
    # 로컬 프레임 좌표 (프레임 열이 축이므로 전치 곱)
    local = np.einsum("ikj,ik->ij", frames[best_triangle], offset_world)
    return best_triangle, best_bary, local, best_distance

def apply(binding, vertices, triangles):
    triangle_index, bary, local = binding
    v0, v1, v2, frames = triangle_frames(vertices, triangles)
    closest = bary[:, 0:1] * v0[triangle_index] + bary[:, 1:2] * v1[triangle_index] + bary[:, 2:3] * v2[triangle_index]
    return closest + np.einsum("ijk,ik->ij", frames[triangle_index], local)

cards_only = "--cards-only" in sys.argv
output = {} if cards_only else {key: target[key] for key in target.files if key != "meta"}
target_layout = target["head__layout_positions"]
target_triangles = target_layout[target["head__triangles"]].astype(np.int64)
target_neutral = target["head__neutral"].astype(np.float64)
mesh_names = [] if cards_only else list(meta["mesh_names"])
for part in parts:
    name = part["name"]
    prefix = part["cards"]
    source_vertices, source_triangles = load_source_head(part["source_head"])
    points = blender_cards_to_maya(cards_raw[prefix + "__positions"])
    uvs = cards_raw[prefix + "__uvs"].astype(np.float32)
    triangles = cards_raw[prefix + "__triangles"].astype(np.uint32)
    triangle_index, bary, local, distance = bind(points, source_vertices, source_triangles)
    print(f"{name}: vertices {len(points)} bind distance median {np.median(distance):.2f} cm, 90% {np.percentile(distance, 90):.2f} cm, max {distance.max():.2f} cm")
    binding = (triangle_index, bary, local)
    neutral = apply(binding, target_neutral, target_triangles)
    # 안쪽 면이 보이는 파트(머리카락)는 양면 렌더링을 위해 뒤집힌 삼각형 사본을 정점까지 복제해서 붙인다
    vertex_count = len(points)
    copies = 2 if part.get("double_sided", False) else 1
    all_triangles = np.concatenate([triangles, triangles[:, ::-1] + vertex_count], axis=0).astype(np.uint32) if copies == 2 else triangles
    output[f"{name}__layout_positions"] = np.arange(vertex_count * copies, dtype=np.uint32)
    output[f"{name}__layout_uvs"] = np.arange(vertex_count * copies, dtype=np.uint32)
    output[f"{name}__uvs"] = np.concatenate([uvs] * copies, axis=0)
    output[f"{name}__triangles"] = all_triangles
    output[f"{name}__neutral"] = np.concatenate([neutral] * copies, axis=0).astype(np.float32)
    moved = 0
    for frame, pose_name in enumerate(pose_names):
        key = f"head__pose_{frame}"
        if key not in target.files:
            continue
        posed = apply(binding, target[key].astype(np.float64), target_triangles)
        output[f"{name}__pose_{frame}"] = np.concatenate([posed] * copies, axis=0).astype(np.float32)
        moved += int(np.linalg.norm(posed - neutral, axis=1).max() > 0.1)
    print(f"  neutral bounds {neutral.min(axis=0).round(1)} {neutral.max(axis=0).round(1)}, poses moving >1mm: {moved}")
    mesh_names.append(name)
meta["mesh_names"] = mesh_names
output["meta"] = np.array(json.dumps(meta))
np.savez_compressed(output_path, **output)
print("SAVED", output_path)
