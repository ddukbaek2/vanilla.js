import numpy as np
from scipy.spatial import cKDTree

# 레거시 그룸 머리(스켈레탈 메시 FBX → 렌더 정점)를 UV 로 아키타입 DNA 머리 정점 순서에 대응시킨다.
# 메타휴먼 머리 토폴로지 / UV 는 모든 캐릭터가 같으므로 UV 최근접으로 1:1 대응이 나온다. 치아 / 눈알 등이 같은 UV 영역을
# 쓰는 경우는 아키타입 위치와의 잔차(평행이동 제거 후)로 걸러낸다.
ARCHETYPE = "D:/MetaHumanExport/Dump_archetype"
raw = np.load("D:/MetaHumanExport/Grooms/legacy_heads_raw.npz")
positions = np.fromfile(f"{ARCHETYPE}/head__positions.f32", dtype=np.float32).reshape(-1, 3).astype(np.float64)
uvs = np.fromfile(f"{ARCHETYPE}/head__uvs.f32", dtype=np.float32).reshape(-1, 2).astype(np.float64)
layout_positions = np.fromfile(f"{ARCHETYPE}/head__layout_positions.u32", dtype=np.uint32)
layout_uvs = np.fromfile(f"{ARCHETYPE}/head__layout_uvs.u32", dtype=np.uint32)
archetype_layout_uv = uvs[layout_uvs]
archetype_layout_position = positions[layout_positions]
# 아키타입 덤프 프레임 (x, y 앞, z 위) → Maya (x, z, y)
archetype_layout_position = archetype_layout_position[:, [0, 2, 1]]
tree = cKDTree(archetype_layout_uv)
output = {}
for name in ("SKM_Groom_Head_Legacy01", "SKM_Groom_Head_Legacy02"):
    legacy_positions = raw[name + "__positions"].astype(np.float64) * 100.0
    # Blender FBX 임포트 (x, y 뒤, z 위) m → Maya (x, z, -y) cm
    legacy_positions = np.stack([legacy_positions[:, 0], legacy_positions[:, 2], -legacy_positions[:, 1]], axis=1)
    legacy_uvs = raw[name + "__uvs"].astype(np.float64)
    distance, layout_index = tree.query(legacy_uvs)
    close = distance < 2e-4
    dna_index = layout_positions[layout_index]
    # 평행이동 추정 (UV 가 정확히 맞는 후보들의 위치 차 중앙값)
    offset = np.median(legacy_positions[close] - archetype_layout_position[layout_index[close]], axis=0)
    residual = np.linalg.norm(legacy_positions - archetype_layout_position[layout_index] - offset, axis=1)
    print(f"{name}: uv-close {close.sum()} of {len(legacy_uvs)}, offset {offset.round(2)} cm, residual median {np.median(residual[close]):.2f} 90% {np.percentile(residual[close], 90):.2f} max {residual[close].max():.2f}")
    result = np.full((len(positions), 3), np.nan)
    best = np.full(len(positions), np.inf)
    for candidate in np.flatnonzero(close):
        index = dna_index[candidate]
        score = residual[candidate]
        if score < best[index]:
            best[index] = score
            result[index] = legacy_positions[candidate]
    missing = np.isnan(result[:, 0])
    print(f"  mapped {np.sum(~missing)} of {len(positions)} dna vertices, missing {missing.sum()}, residual>2cm {(best[~missing] > 2).sum()}")
    if missing.any():
        # 빠진 정점은 아키타입 위치 + 평행이동으로 채운다
        result[missing] = positions[missing][:, [0, 2, 1]] + offset
    output[name] = result.astype(np.float32)
np.savez_compressed("D:/MetaHumanExport/Grooms/legacy_heads_dna.npz", **output)
print("SAVED")
