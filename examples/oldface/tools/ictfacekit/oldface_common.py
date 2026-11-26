# OLD FACE 자산 공통. (ICT FaceKit 읽기, 엔진 좌표 변환, 부분 나누기, glb 쓰기)
import json, struct
import numpy as np

# ICT 표정 이름 -> ARKit 대문자 꼴. (좌우 둘인 browInnerUp, cheekPuff 는 더해 하나로)
def arkitName(ictName):
	base, _, side = ictName.partition("_")
	name = base[0].upper() + base[1:]
	if name in ("BrowInnerUp", "CheekPuff"):
		return name
	return name + {"L": "Left", "R": "Right", "": ""}[side]

def loadIct(path):
	data = np.load(path)
	positions = data["positions"]
	materials = [str(name) for name in data["materials"]]
	names = [str(name) for name in data["names"]]
	deltas = data["deltas"].astype(np.float64)
	# ARKit 이름으로 합치기.
	arkitNames = []
	arkitDeltas = []
	for index, name in enumerate(names):
		target = arkitName(name)
		if target in arkitNames:
			arkitDeltas[arkitNames.index(target)] += deltas[index]
		else:
			arkitNames.append(target)
			arkitDeltas.append(deltas[index].copy())
	return {
		"positions": positions, "uvs": data["uvs"], "faceMaterial": data["faceMaterial"], "faceVertex": data["faceVertex"], "faceUv": data["faceUv"],
		"materials": materials, "names": arkitNames, "deltas": np.array(arkitDeltas),
	}

# 눈알 구 맞추기. (뒤쪽 반구 정점으로 최소 제곱)
def fitSphere(points):
	matrix = np.column_stack([2 * points, np.ones(len(points))])
	rhs = (points ** 2).sum(1)
	solution = np.linalg.lstsq(matrix, rhs, rcond=None)[0]
	center = solution[:3]
	radius = np.sqrt(solution[3] + (center ** 2).sum())
	return center, radius

# 옛 장면과 같은 자리. (두 눈 가운데 (0, 1.6785, 0.09), 눈 사이 6 cm, 미터)
TARGET_EYE_CENTER = np.array([0.0, 1.6785, 0.09])
TARGET_EYE_SPACING = 0.06

def computeTransform(ict):
	centers = []
	for materialName in ("M_ScleraLeft", "M_ScleraRight"):
		vertexIndices = np.unique(ict["faceVertex"][ict["faceMaterial"] == ict["materials"].index(materialName)])
		points = ict["positions"][vertexIndices]
		back = points[points[:, 2] < np.median(points[:, 2])]
		center, radius = fitSphere(back)
		centers.append((center, radius))
	middle = (centers[0][0] + centers[1][0]) / 2
	scale = TARGET_EYE_SPACING / abs(centers[0][0][0] - centers[1][0][0])
	offset = TARGET_EYE_CENTER - middle * scale
	return scale, offset, centers

# 부분 정의. (glb 노드 이름, 재질 이름, ICT 재질과 UV 옮기기 (u 오프셋, u 배율, 붙일 u))
PART_DEFINITIONS = [
	("head", "m_head", [("M_Face", 0.0, 0.75, 0.0), ("M_BackHead", 1.0, 0.25, 0.75)]),
	("teeth", "m_teeth", [("M_Teeth", 3.0, 0.5, 0.0), ("M_GumsTongue", 2.0, 0.5, 0.5)]),
	("eyeLeft", "m_eyeball_left", [("M_ScleraLeft", None, None, None)]),
	("eyeRight", "m_eyeball_right", [("M_ScleraRight", None, None, None)]),
	("eyeshell", "m_eyeshell", [("M_EyeOcclusion", 0.0, 1.0, 0.0)]),
	("eyelashes", "m_eyelashes", [("M_EyeLashes", 6.0, 1.0, 0.0)]),
	("eyeEdge", "m_eyeEdge", [("M_LacrimalFluid", 4.0, 0.5, 0.0), ("M_EyeBlend", 0.0, 1.0, 0.0)]),
]

# 눈 UV. (각막 축 둘레 등거리 방위 투영, 각막 경계 각 limbusAngle 이 UV 반경 irisRadius 에 오게, 뒤쪽은 0.5 에서 멈춤)
def eyeUv(points, center, limbusAngle, irisRadius=0.133):
	relative = points - center
	radius = np.linalg.norm(relative, axis=1)
	angle = np.arccos(np.clip(relative[:, 2] / radius, -1, 1))
	planar = relative[:, :2]
	planarLength = np.maximum(np.linalg.norm(planar, axis=1), 1e-9)
	uvRadius = np.minimum(angle / limbusAngle * irisRadius, 0.5)
	u = 0.5 + planar[:, 0] / planarLength * uvRadius
	v = 0.5 - planar[:, 1] / planarLength * uvRadius
	return np.column_stack([u, v])

def vertexNormals(positions, triangles):
	normals = np.zeros_like(positions)
	a, b, c = positions[triangles[:, 0]], positions[triangles[:, 1]], positions[triangles[:, 2]]
	faceNormal = np.cross(b - a, c - a)
	for corner in range(3):
		np.add.at(normals, triangles[:, corner], faceNormal)
	length = np.linalg.norm(normals, axis=1, keepdims=True)
	normals /= np.maximum(length, 1e-12)
	return normals

# glb 쓰기. (meshes: [{name, material, positions, normals, uvs, triangles, targets: {이름: 델타}}], 희소 모프)
def writeGlb(path, meshes, generator="vanilla oldface tools"):
	binary = bytearray()
	bufferViews = []
	accessors = []
	def addView(array, target=None):
		data = np.ascontiguousarray(array).tobytes()
		while len(binary) % 4:
			binary.append(0)
		view = {"buffer": 0, "byteOffset": len(binary), "byteLength": len(data)}
		if target:
			view["target"] = target
		binary.extend(data)
		bufferViews.append(view)
		return len(bufferViews) - 1
	def addAccessor(array, kind, target=None, withBounds=False):
		componentType = {np.dtype(np.float32): 5126, np.dtype(np.uint32): 5125, np.dtype(np.uint16): 5123}[array.dtype]
		accessor = {"bufferView": addView(array, target), "componentType": componentType, "count": int(array.shape[0] if kind != "SCALAR" else array.size), "type": kind}
		if withBounds:
			accessor["min"] = array.min(0).tolist()
			accessor["max"] = array.max(0).tolist()
		accessors.append(accessor)
		return len(accessors) - 1
	gltfMeshes = []
	materials = []
	nodes = []
	for mesh in meshes:
		positions = mesh["positions"].astype(np.float32)
		attributes = {
			"POSITION": addAccessor(positions, "VEC3", 34962, True),
			"NORMAL": addAccessor(mesh["normals"].astype(np.float32), "VEC3", 34962),
			"TEXCOORD_0": addAccessor(mesh["uvs"].astype(np.float32), "VEC2", 34962),
		}
		indexType = np.uint32 if len(positions) > 65535 else np.uint16
		indices = addAccessor(mesh["triangles"].astype(indexType).ravel(), "SCALAR", 34963)
		materials.append({"name": mesh["material"], "pbrMetallicRoughness": {"baseColorFactor": [0.8, 0.8, 0.8, 1.0], "metallicFactor": 0.0, "roughnessFactor": 0.6}})
		primitive = {"attributes": attributes, "indices": indices, "material": len(materials) - 1}
		targetNames = []
		targets = []
		for name, delta in mesh.get("targets", {}).items():
			delta = delta.astype(np.float32)
			moved = np.nonzero(np.abs(delta).max(1) > 1e-6)[0]
			if len(moved) == 0:
				continue
			sparseIndexType = np.uint32 if len(positions) > 65535 else np.uint16
			accessors.append({
				"componentType": 5126, "count": len(positions), "type": "VEC3",
				"min": delta.min(0).tolist(), "max": delta.max(0).tolist(),
				"sparse": {"count": int(len(moved)), "indices": {"bufferView": addView(moved.astype(sparseIndexType)), "componentType": 5125 if sparseIndexType == np.uint32 else 5123}, "values": {"bufferView": addView(delta[moved])}},
			})
			targets.append({"POSITION": len(accessors) - 1})
			targetNames.append(name)
		gltfMesh = {"name": mesh["name"], "primitives": [primitive]}
		if targets:
			primitive["targets"] = targets
			gltfMesh["weights"] = [0.0] * len(targets)
			gltfMesh["extras"] = {"targetNames": targetNames}
		gltfMeshes.append(gltfMesh)
		nodes.append({"mesh": len(gltfMeshes) - 1, "name": mesh["name"]})
	while len(binary) % 4:
		binary.append(0)
	document = {
		"asset": {"version": "2.0", "generator": generator},
		"scene": 0, "scenes": [{"nodes": list(range(len(nodes)))}], "nodes": nodes, "meshes": gltfMeshes, "materials": materials,
		"accessors": accessors, "bufferViews": bufferViews, "buffers": [{"byteLength": len(binary)}],
	}
	text = json.dumps(document, separators=(",", ":")).encode()
	while len(text) % 4:
		text += b" "
	with open(path, "wb") as file:
		file.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(text) + 8 + len(binary)))
		file.write(struct.pack("<II", len(text), 0x4E4F534A))
		file.write(text)
		file.write(struct.pack("<II", len(binary), 0x004E4942))
		file.write(bytes(binary))
