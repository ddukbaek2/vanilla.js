# ICT 얼굴을 Infinite 머리 스캔(Lee Perry-Smith, CC BY 3.0) 꼴로 감싸기. 위상, UV, 표정 델타는 ICT 그대로 두고 중립 정점만 옮긴다.
# python -I fit_scan.py <ict.npz> <vertex_indices.json> <head.OBJ> <출력 ict_fit.npz> <출력 scan.npz>
# 1) 스캔 기준점 13 개(정면 직교 렌더에서 고른 화면 자리, 아래 표)를 ICT 68 기준점의 같은 번호에 맞춰 닮음 변환으로 스캔을 장면에 놓는다.
# 2) 기준점 차이를 가우스 RBF 로 모든 ICT 정점(눈, 이, 속눈썹 포함)에 퍼뜨린다.
# 3) 머리 겉면을 스캔 겉면에 점-평면 ICP 로 붙이되, 옮김을 메시 위에서 고르게 펴 ICT 의 결을 지킨다. 스캔은 눈을 감고 있어 눈 구멍은 붙이지 않는다.
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from scipy.spatial import cKDTree
from oldface_common import computeTransform, loadIct, vertexNormals
from texture_common import rasterize

ictPath, indexPath, scanPath, outputPath, scanOutputPath = sys.argv[1:6]

def loadObj(path):
	positions, uvs, faces = [], [], []
	for line in open(path):
		if line.startswith("v "):
			positions.append([float(token) for token in line.split()[1:4]])
		elif line.startswith("vt "):
			uvs.append([float(token) for token in line.split()[1:3]])
		elif line.startswith("f "):
			corners = [corner.split("/") for corner in line.split()[1:]]
			faces.append([(int(corner[0]) - 1, int(corner[1]) - 1) for corner in corners])
	vertexTriangles, uvTriangles = [], []
	for face in faces:
		for index in range(1, len(face) - 1):
			vertexTriangles.append([face[0][0], face[index][0], face[index + 1][0]])
			uvTriangles.append([face[0][1], face[index][1], face[index + 1][1]])
	return np.array(positions), np.array(uvs), np.array(vertexTriangles), np.array(uvTriangles)

# 스캔 기준점. (iBUG 68 번호 -> 정면 직교 렌더 화면 자리, x = px / 5000 - 0.1, y = 0.07 - py / 5000, 깊이는 앞에서 쏜 광선)
SCAN_LANDMARKS = {
	36: (271, 401), 39: (422, 378), 42: (580, 378), 45: (750, 396),
	19: (320, 270), 24: (680, 268), 21: (445, 300), 22: (555, 300),
	30: (497, 548), 33: (497, 595), 48: (402, 717), 54: (615, 712), 51: (507, 665), 57: (507, 737), 8: (500, 958),
}

scanPositions, scanUvs, scanTriangles, scanUvTriangles = loadObj(scanPath)

def frontHit(x, y):
	best = None
	a, b, c = scanPositions[scanTriangles[:, 0]], scanPositions[scanTriangles[:, 1]], scanPositions[scanTriangles[:, 2]]
	denominator = (b[:, 1] - c[:, 1]) * (a[:, 0] - c[:, 0]) + (c[:, 0] - b[:, 0]) * (a[:, 1] - c[:, 1])
	valid = np.abs(denominator) > 1e-14
	weightA = np.where(valid, ((b[:, 1] - c[:, 1]) * (x - c[:, 0]) + (c[:, 0] - b[:, 0]) * (y - c[:, 1])) / np.where(valid, denominator, 1), -1)
	weightB = np.where(valid, ((c[:, 1] - a[:, 1]) * (x - c[:, 0]) + (a[:, 0] - c[:, 0]) * (y - c[:, 1])) / np.where(valid, denominator, 1), -1)
	weightC = 1 - weightA - weightB
	inside = (weightA >= 0) & (weightB >= 0) & (weightC >= 0)
	z = weightA * a[:, 2] + weightB * b[:, 2] + weightC * c[:, 2]
	return np.array([x, y, z[inside].max()])

landmarkIndices = json.load(open(indexPath))["idx_to_landmark_verts"]
ict = loadIct(ictPath)
scale, offset, _ = computeTransform(ict)
positions = ict["positions"] * scale + offset
numbers = sorted(SCAN_LANDMARKS)
scanLandmarks = np.array([frontHit(SCAN_LANDMARKS[number][0] / 5000 - 0.1, 0.07 - SCAN_LANDMARKS[number][1] / 5000) for number in numbers])
ictLandmarks = positions[[landmarkIndices[number] for number in numbers]]

# 닮음 변환. (Umeyama, 스캔 -> 장면)
scanMean, ictMean = scanLandmarks.mean(0), ictLandmarks.mean(0)
centeredScan, centeredIct = scanLandmarks - scanMean, ictLandmarks - ictMean
u, singular, vt = np.linalg.svd(centeredIct.T @ centeredScan)
sign = np.diag([1, 1, np.sign(np.linalg.det(u @ vt))])
rotation = u @ sign @ vt
similarityScale = (singular * np.diag(sign)).sum() / (centeredScan ** 2).sum()
scanScene = (scanPositions - scanMean) @ rotation.T * similarityScale + ictMean
scanLandmarksScene = (scanLandmarks - scanMean) @ rotation.T * similarityScale + ictMean
print("scan scale", similarityScale, "landmark rms before warp (mm)", np.sqrt(((scanLandmarksScene - ictLandmarks) ** 2).sum(1).mean()) * 1000)

# RBF 로 기준점 차이 퍼뜨리기.
sigma = 0.035
def kernel(points, centers):
	return np.exp(-((points[:, None, :] - centers[None, :, :]) ** 2).sum(-1) / sigma ** 2)
weights = np.linalg.solve(kernel(ictLandmarks, ictLandmarks) + np.eye(len(numbers)) * 1e-3, scanLandmarksScene - ictLandmarks)
positions = positions + kernel(positions, ictLandmarks) @ weights

# 머리 정점과 이웃.
headMaterials = [ict["materials"].index("M_Face"), ict["materials"].index("M_BackHead")]
headFaces = ict["faceVertex"][np.isin(ict["faceMaterial"], headMaterials)]
headVertices = np.unique(headFaces)
edges = np.concatenate([headFaces[:, [0, 1]], headFaces[:, [1, 2]], headFaces[:, [2, 0]]])
edges = np.unique(np.sort(edges, 1), axis=0)
neighborCount = np.bincount(edges.ravel(), minlength=len(positions)).astype(np.float64)

def smoothField(field, weight, iterations):
	field = field * weight[:, None]
	total = weight.copy()
	for _ in range(iterations):
		summedField = np.zeros_like(field)
		summedWeight = np.zeros_like(total)
		for first, second in ((0, 1), (1, 0)):
			np.add.at(summedField, edges[:, first], field[edges[:, second]])
			np.add.at(summedWeight, edges[:, first], total[edges[:, second]])
		field = (field + summedField) / (1 + neighborCount[:, None])
		total = (total + summedWeight) / (1 + neighborCount)
	return field / np.maximum(total, 1e-6)[:, None], total

# 스캔 겉면 표본. (스캔 UV 에 위치와 노멀을 래스터)
scanNormals = vertexNormals(scanScene, scanTriangles)
cornerUvs = scanUvs[scanUvTriangles.ravel()]
cornerAttributes = np.concatenate([scanScene[scanTriangles.ravel()], scanNormals[scanTriangles.ravel()]], 1)
flatTriangles = np.arange(len(cornerUvs)).reshape(-1, 3)
samples, covered = rasterize(np.column_stack([cornerUvs[:, 0], 1 - cornerUvs[:, 1]]), flatTriangles, cornerAttributes, 1024)
samplePoints = samples[covered][:, 0:3]
sampleNormals = samples[covered][:, 3:6]
sampleNormals /= np.linalg.norm(sampleNormals, axis=1, keepdims=True)
tree = cKDTree(samplePoints)

# 눈 구멍과 입 안은 붙이지 않는다.
eyeCenters = []
for number in ((36, 39), (42, 45)):
	eyeCenters.append((positions[landmarkIndices[number[0]]] + positions[landmarkIndices[number[1]]]) / 2)
isHead = np.zeros(len(positions), bool)
isHead[headVertices] = True
freeze = np.zeros(len(positions))
for center in eyeCenters:
	freeze = np.maximum(freeze, ((np.abs(positions[:, 0] - center[0]) < 0.019) & (np.abs(positions[:, 1] - center[1]) < 0.011)).astype(float))

for iteration in range(8):
	normals = vertexNormals(positions, headFaces)
	distance, nearest = tree.query(positions)
	target = samplePoints[nearest]
	targetNormal = sampleNormals[nearest]
	planeOffset = ((target - positions) * targetNormal).sum(1)
	displacement = planeOffset[:, None] * targetNormal
	agreement = (normals * targetNormal).sum(1)
	weight = isHead * (distance < 0.012) * (agreement > 0.6) * (1 - freeze)
	iterations = [40, 30, 20, 14, 10, 8, 6, 6][iteration]
	smoothed, _ = smoothField(displacement, weight.astype(np.float64), iterations)
	positions[headVertices] += smoothed[headVertices]
	print("icp", iteration, "matched", int(weight.sum()), "rms (mm)", np.sqrt((planeOffset[weight > 0] ** 2).mean()) * 1000)

# 머리가 아닌 부분은 가까운 머리 정점의 옮김을 따른다. (눈알과 이는 모양을 지킨 채 통째로 옮긴다)
original = ict["positions"] * scale + offset
rbfPositions = original + kernel(original, ictLandmarks) @ weights
headMove = positions - rbfPositions
headTree = cKDTree(rbfPositions[headVertices])
others = np.setdiff1d(np.arange(len(positions)), headVertices)
distance, nearest = headTree.query(rbfPositions[others], k=8)
inverse = 1 / np.maximum(distance, 1e-5)
move = (headMove[headVertices][nearest] * inverse[..., None]).sum(1) / inverse.sum(1)[:, None]
positions[others] = rbfPositions[others] + move
for materialNames in (("M_ScleraLeft", "M_IrisLeft"), ("M_ScleraRight", "M_IrisRight"), ("M_Teeth", "M_GumsTongue")):
	vertices = np.unique(ict["faceVertex"][np.isin(ict["faceMaterial"], [ict["materials"].index(name) for name in materialNames])])
	positions[vertices] = original[vertices] + (positions[vertices] - original[vertices]).mean(0)
	# 눈꺼풀, 속눈썹, 눈 가림은 눈알과 같은 옮김을 받아 ICT 의 눈꺼풀과 눈알 사이가 그대로 남는다. (눈알이 살을 뚫지 않게) 둘레로 갈수록 머리 옮김에 섞는다.
	if materialNames[0].startswith("M_Sclera"):
		eyeMove = positions[vertices].mean(0) - original[vertices].mean(0)
		center = original[vertices].mean(0)
		offset3 = original - center
		ellipse = np.sqrt((offset3[:, 0] / 0.021) ** 2 + (offset3[:, 1] / 0.013) ** 2 + (offset3[:, 2] / 0.022) ** 2)
		follow = 1 - np.clip((ellipse - 1.0) / 0.7, 0, 1)
		follow = follow * follow * (3 - 2 * follow)
		follow[vertices] = 0
		positions = positions * (1 - follow[:, None]) + (original + eyeMove) * follow[:, None]

data = dict(np.load(ictPath))
data["positions"] = (positions - offset) / scale
np.savez_compressed(outputPath, **data)
np.savez_compressed(scanOutputPath, positions=scanScene, uvs=scanUvs, triangles=scanTriangles, uvTriangles=scanUvTriangles, transformScale=scale, transformOffset=offset)
print("wrote", outputPath)
