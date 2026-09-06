import sys
import json
import numpy as np

# 주름 맵 정의(assets/wrinkles.json)를 만든다.
# - channels: 마스크 아틀라스 채널(타일 x 4 + RGBA) → 영역 이름 / 주름 맵 1·2·3 기여 (wm13 영역은 1 과 3 둘 다)
# - shapes: ARKit 셰이프 → 영역 값 (C++ 덤프의 RigLogic 애니메이티드 맵 노멀 출력, 0.01 이상만)
# 사용: python make_wrinkles_json.py <Dump 디렉토리> <채널 매핑 json> <출력 json>
dump = sys.argv[1].rstrip("/\\") + "/"
mapping = json.load(open(sys.argv[2]))
output_path = sys.argv[3]
manifest = json.load(open(dump + "manifest.json"))
poses_manifest = json.load(open(dump + "poses_manifest.json"))
pose_names = json.load(open(dump + "pose_names.json"))["pose_names"]
names = manifest["animated_map_names"]
values = np.fromfile(dump + "poses_animatedmaps.f32", dtype=np.float32).reshape(poses_manifest["pose_count"], -1)

channels = []
for tile in mapping["tiles"]:
    for channel_name in tile["channels"]:
        maps = [0, 0, 0]
        if channel_name:
            prefix = channel_name.split("_")[1]
            if prefix == "wm1":
                maps = [1, 0, 0]
            elif prefix == "wm2":
                maps = [0, 1, 0]
            elif prefix == "wm3":
                maps = [0, 0, 1]
            elif prefix == "wm13":
                maps = [1, 0, 1]
        channels.append({"region": channel_name if channel_name else "", "maps": maps})
    while len(channels) % 4 != 0:
        channels.append({"region": "", "maps": [0, 0, 0]})

shapes = {}
normal_indices = [(index, name.split(".")[1]) for index, name in enumerate(names) if "_normal." in name]
for frame, pose_name in enumerate(pose_names):
    if pose_name == "Default" or pose_name.startswith("Pose_"):
        continue
    regions = {}
    for index, region in normal_indices:
        value = float(values[frame, index])
        if value >= 0.01:
            regions[region] = max(regions.get(region, 0.0), round(value, 3))
    if regions:
        shapes[pose_name] = regions
json.dump({"channels": channels, "shapes": shapes}, open(output_path, "w"), indent=1)
known = {c["region"] for c in channels if c["region"]}
used = {r for regions in shapes.values() for r in regions}
print("channels", len(channels), "shapes", len(shapes), "regions without channel:", sorted(used - known))
