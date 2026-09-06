import sys
import json
import struct

# Blender 가 glb 메시에 써 넣는 기본 모프 가중치(weights) 배열을 제거한다. 남겨 두면 로더가 모든 셰이프를 동시에 적용한다.
path = sys.argv[1]
data = open(path, "rb").read()
json_length = struct.unpack("<I", data[12:16])[0]
gltf = json.loads(data[20:20 + json_length])
for mesh in gltf["meshes"]:
    mesh.pop("weights", None)
json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
while len(json_bytes) % 4:
    json_bytes += b" "
rest = data[20 + json_length:]
open(path, "wb").write(b"glTF" + struct.pack("<II", 2, 12 + 8 + len(json_bytes) + len(rest)) + struct.pack("<I", len(json_bytes)) + b"JSON" + json_bytes + rest)
print("STRIPPED", path)
