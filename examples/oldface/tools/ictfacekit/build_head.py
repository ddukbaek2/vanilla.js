# 머리 glb 짓기. (python -I build_head.py <ict.npz> <작업 폴더> <assets 폴더> [decimated npz ...])
# 1 단계(인자 셋): LOD0 부분 메시를 짓고 decimate 용 parts.npz 를 쓴다. 2 단계(decimated npz 가 있으면): LOD1, 2 를 짓는다.
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from scipy.spatial import cKDTree
from oldface_common import loadIct, computeTransform, PART_DEFINITIONS, eyeUv, vertexNormals, writeGlb

ictPath, workDirectory, assetDirectory = sys.argv[1:4]
ict = loadIct(ictPath)
scale, offset, eyeSpheres = computeTransform(ict)
positions = ict["positions"] * scale + offset
deltas = ict["deltas"] * scale
names = ict["names"]
print("scale", scale, "offset", offset, "names", len(names))

# 각막 경계 각. (구 반경보다 2% 넘게 솟기 시작하는 각)
limbusAngles = []
for index, materialName in enumerate(("M_ScleraLeft", "M_ScleraRight")):
	center, radius = eyeSpheres[index]
	vertexIndices = np.unique(ict["faceVertex"][ict["faceMaterial"] == ict["materials"].index(materialName)])
	points = ict["positions"][vertexIndices]
	relative = points - center
	distance = np.linalg.norm(relative, axis=1)
	angle = np.arccos(np.clip(relative[:, 2] / distance, -1, 1))
	# 5 도 띠마다 평균 반경비를 보고, 처음으로 1.02 아래로 내려가는 띠의 각.
	limbus = np.pi / 4
	for bandStart in np.radians(np.arange(0, 90, 5)):
		band = (angle >= bandStart) & (angle < bandStart + np.radians(5))
		if band.any() and (distance[band] / radius).mean() < 1.02:
			limbus = bandStart - np.radians(5)
			break
	limbusAngles.append(float(limbus))
print("limbus degrees", np.degrees(limbusAngles))

def buildPart(definition):
	nodeName, materialName, sources = definition
	cornerVertex = []
	cornerUv = []
	for sourceName, uOffset, uScale, uBase in sources:
		mask = ict["faceMaterial"] == ict["materials"].index(sourceName)
		faceVertex = ict["faceVertex"][mask]
		if uOffset is None:
			eyeIndex = 0 if "Left" in sourceName else 1
			center = eyeSpheres[eyeIndex][0] * scale + offset
			uv = eyeUv(positions[faceVertex.ravel()], center, limbusAngles[eyeIndex])
		else:
			uv = ict["uvs"][ict["faceUv"][mask].ravel()].copy()
			uv[:, 0] = (uv[:, 0] - uOffset) * uScale + uBase
			uv[:, 1] = 1.0 - uv[:, 1]
		cornerVertex.append(faceVertex.ravel())
		cornerUv.append(uv)
	cornerVertex = np.concatenate(cornerVertex)
	cornerUv = np.concatenate(cornerUv)
	keys = np.column_stack([cornerVertex.astype(np.float64), np.round(cornerUv * 1e6)])
	_, first, inverse = np.unique(keys, axis=0, return_index=True, return_inverse=True)
	original = cornerVertex[first]
	uvs = cornerUv[first]
	triangles = inverse.reshape(-1, 3)
	# 노멀은 원 정점으로 셈해 UV 이음매에서도 부드럽게.
	normalsOriginal = vertexNormals(positions, cornerVertex.reshape(-1, 3))
	part = {"name": nodeName, "material": materialName, "positions": positions[original], "normals": normalsOriginal[original], "uvs": uvs, "triangles": triangles, "original": original}
	part["targets"] = {name: deltas[index][original] for index, name in enumerate(names) if np.abs(deltas[index][original]).max() > 1e-5}
	if uOffset is None:
		center = eyeSpheres[eyeIndex][0] * scale + offset
		side = "Left" if eyeIndex == 0 else "Right"
		inward = -1.0 if eyeIndex == 0 else 1.0
		relative = part["positions"] - center
		angle = np.radians(25.0)
		def rotateX(points, theta):
			cosine, sine = np.cos(theta), np.sin(theta)
			return np.column_stack([points[:, 0], points[:, 1] * cosine + points[:, 2] * sine, -points[:, 1] * sine + points[:, 2] * cosine])
		def rotateY(points, theta):
			cosine, sine = np.cos(theta), np.sin(theta)
			return np.column_stack([points[:, 0] * cosine + points[:, 2] * sine, points[:, 1], -points[:, 0] * sine + points[:, 2] * cosine])
		part["targets"]["EyeLookUp" + side] = rotateX(relative, angle) - relative
		part["targets"]["EyeLookDown" + side] = rotateX(relative, -angle) - relative
		part["targets"]["EyeLookIn" + side] = rotateY(relative, inward * angle) - relative
		part["targets"]["EyeLookOut" + side] = rotateY(relative, -inward * angle) - relative
	return part

parts = [buildPart(definition) for definition in PART_DEFINITIONS]
for part in parts:
	print(part["name"], len(part["positions"]), len(part["triangles"]), len(part["targets"]))

if len(sys.argv) == 4:
	writeGlb(os.path.join(assetDirectory, "character_lod0.glb"), parts)
	np.savez(os.path.join(workDirectory, "parts.npz"), **{part["name"] + "_positions": part["positions"] for part in parts}, **{part["name"] + "_uvs": part["uvs"] for part in parts}, **{part["name"] + "_triangles": part["triangles"] for part in parts})
	json.dump({"limbusDegrees": np.degrees(limbusAngles).tolist(), "scale": scale, "offset": offset.tolist(), "eyeCenters": [(sphere[0] * scale + offset).tolist() for sphere in eyeSpheres]}, open(os.path.join(workDirectory, "head_info.json"), "w"))
	sys.exit(0)

# LOD1, 2. (decimate 한 부분은 새 정점마다 같은 부분의 가장 가까운 원 정점 델타를 쓴다)
for lodIndex, decimatedPath in enumerate(sys.argv[4:], start=1):
	decimated = np.load(decimatedPath)
	lodParts = []
	for part in parts:
		key = part["name"] + "_positions"
		if key not in decimated:
			lodParts.append(part)
			continue
		newPositions = decimated[key]
		newUvs = decimated[part["name"] + "_uvs"]
		newTriangles = decimated[part["name"] + "_triangles"]
		tree = cKDTree(part["positions"])
		_, nearest = tree.query(newPositions)
		lodPart = {"name": part["name"], "material": part["material"], "positions": newPositions, "uvs": newUvs, "triangles": newTriangles}
		lodPart["normals"] = vertexNormals(newPositions, newTriangles)
		# 이음매 정점끼리 노멀 맞추기. (같은 자리 정점의 노멀 평균)
		_, seamFirst, seamInverse = np.unique(np.round(newPositions * 1e6), axis=0, return_index=True, return_inverse=True)
		averaged = np.zeros((len(seamFirst), 3))
		np.add.at(averaged, seamInverse.ravel(), lodPart["normals"])
		averaged /= np.maximum(np.linalg.norm(averaged, axis=1, keepdims=True), 1e-12)
		lodPart["normals"] = averaged[seamInverse.ravel()]
		lodPart["targets"] = {name: delta[nearest] for name, delta in part["targets"].items()}
		lodParts.append(lodPart)
		print("lod", lodIndex, part["name"], len(newPositions), len(newTriangles))
	writeGlb(os.path.join(assetDirectory, "character_lod%d.glb" % lodIndex), lodParts)
