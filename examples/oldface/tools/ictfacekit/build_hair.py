# 머리카락, 턱수염, 콧수염, 눈썹 카드 짓기와 텍스처. (python -I build_hair.py <ict.npz> <vertex_indices.json> <작업 폴더> <assets 폴더>)
# 카드 뿌리를 머리 표면에 뿌리고 가닥을 중력과 흐름 방향으로 뻗는다. 카드 정점은 뿌리 얼굴 정점의 모프 델타를 그대로 받는다. LOD 0..4.
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from scipy.spatial import cKDTree
from oldface_common import loadIct, computeTransform, vertexNormals, writeGlb
from texture_common import saveImage, smoothstep

ictPath, indexPath, workDirectory, assetDirectory = sys.argv[1:5]
ict = loadIct(ictPath)
scale, offset, _ = computeTransform(ict)
info = json.load(open(os.path.join(workDirectory, "head_info.json")))
landmarkIndices = json.load(open(indexPath))["idx_to_landmark_verts"]
positionsAll = ict["positions"] * scale + offset
landmarks = positionsAll[landmarkIndices]
deltasAll = ict["deltas"] * scale
names = ict["names"]
headMaterials = [ict["materials"].index("M_Face"), ict["materials"].index("M_BackHead")]
headFaceMask = np.isin(ict["faceMaterial"], headMaterials)
headTriangles = ict["faceVertex"][headFaceMask]
normalsAll = vertexNormals(positionsAll, headTriangles)
headVertexIndices = np.unique(headTriangles)
tree = cKDTree(positionsAll[headVertexIndices])
eyeY = info["eyeCenters"][0][1]
browY = landmarks[17:27, 1].mean()
mouthCenter = landmarks[48:60].mean(0)
mouthWidth = abs(landmarks[54][0] - landmarks[48][0]) / 2
chinY = landmarks[8][1]
noseBottomY = landmarks[33][1]
upperLipY = landmarks[51][1]
random = np.random.default_rng(7)

# 표면 고르게 뿌리기. (넓이 가중, 조건 함수로 거름)
triangleA = positionsAll[headTriangles[:, 0]]
triangleB = positionsAll[headTriangles[:, 1]]
triangleC = positionsAll[headTriangles[:, 2]]
triangleArea = np.linalg.norm(np.cross(triangleB - triangleA, triangleC - triangleA), axis=1) / 2
def samplePoints(count, accept, oversample=40):
	chosen = random.choice(len(headTriangles), size=count * oversample, p=triangleArea / triangleArea.sum())
	r1, r2 = random.random(len(chosen)), random.random(len(chosen))
	flip = r1 + r2 > 1
	r1[flip], r2[flip] = 1 - r1[flip], 1 - r2[flip]
	points = triangleA[chosen] + r1[:, None] * (triangleB[chosen] - triangleA[chosen]) + r2[:, None] * (triangleC[chosen] - triangleA[chosen])
	weight = accept(points)
	keep = random.random(len(points)) < weight
	points = points[keep][:count]
	_, nearest = tree.query(points)
	vertexIndex = headVertexIndices[nearest]
	return points, normalsAll[vertexIndex], vertexIndex

def pushOutside(point, minimum):
	_, nearest = tree.query(point)
	vertexIndex = headVertexIndices[nearest]
	normal = normalsAll[vertexIndex]
	distance = ((point - positionsAll[vertexIndex]) * normal).sum(-1)
	return point + normal * np.maximum(minimum - distance, 0)[:, None]

# 가닥 경로. (뿌리, 노멀, 처음 방향, 길이, 중력, 표면 위 최소 거리)
def growStrands(roots, normals, directions, lengths, gravity, segments, lift, curl=0.0):
	points = [roots + normals * 0.0005]
	direction = directions / np.linalg.norm(directions, axis=1, keepdims=True)
	step = lengths / segments
	for segment in range(segments):
		t = (segment + 1) / segments
		direction = direction + np.array([0, -1.0, 0]) * gravity * step[:, None] * 30
		if curl:
			direction = direction + random.normal(0, curl, direction.shape)
		direction /= np.linalg.norm(direction, axis=1, keepdims=True)
		nextPoint = points[-1] + direction * step[:, None]
		nextPoint = pushOutside(nextPoint, lift * (0.4 + 0.6 * t))
		if lift > 0.004:
			# 얼굴 앞을 덮지 않게 옆으로 민다.
			faceFront = (np.abs(nextPoint[:, 0]) < 0.074) & (nextPoint[:, 2] > eyeZ - 0.03) & (nextPoint[:, 1] < browY + 0.06)
			nextPoint[faceFront, 0] = np.where(nextPoint[faceFront, 0] >= 0, 0.074, -0.074)
			# 목 앞으로 감기지 않게 뒤로 민다.
			neckFront = (np.abs(nextPoint[:, 0]) < 0.065) & (nextPoint[:, 2] > eyeZ - 0.085) & (nextPoint[:, 1] < chinY + 0.01)
			nextPoint[neckFront, 2] = eyeZ - 0.085
		direction = nextPoint - points[-1]
		direction /= np.maximum(np.linalg.norm(direction, axis=1, keepdims=True), 1e-9)
		points.append(nextPoint)
	return np.stack(points, 1)

# 카드 메시. (가닥 경로마다 리본, 아틀라스 칸 columns 중 하나, v 뿌리 0 -> 끝 1, 양면)
def buildCards(name, material, paths, normals, widths, rootVertex, columns):
	cardCount, pointCount, _ = paths.shape
	tangent = np.gradient(paths, axis=1)
	tangent /= np.maximum(np.linalg.norm(tangent, axis=2, keepdims=True), 1e-9)
	side = np.cross(tangent, normals[:, None, :])
	side /= np.maximum(np.linalg.norm(side, axis=2, keepdims=True), 1e-9)
	taper = np.linspace(1.0, 0.55, pointCount)[None, :, None]
	halfWidth = widths[:, None, None] / 2 * taper
	left = paths - side * halfWidth
	right = paths + side * halfWidth
	positions = np.stack([left, right], 2).reshape(-1, 3)
	column = random.integers(0, columns, cardCount)
	v = np.repeat(np.linspace(0.002, 0.998, pointCount)[None, :], cardCount, 0)
	u0 = (column[:, None] + 0.04) / columns
	u1 = (column[:, None] + 0.96) / columns
	uvs = np.stack([np.stack([np.repeat(u0, pointCount, 1), v], -1), np.stack([np.repeat(u1, pointCount, 1), v], -1)], 2).reshape(-1, 2)
	cardNormal = np.repeat(np.repeat(normals[:, None, :], pointCount, 1)[:, :, None, :], 2, 2).reshape(-1, 3)
	base = (np.arange(cardCount)[:, None] * pointCount + np.arange(pointCount - 1)[None, :]) * 2
	base = base.ravel()
	triangles = np.concatenate([np.stack([base, base + 2, base + 1], 1), np.stack([base + 1, base + 2, base + 3], 1)])
	# 양면. (뒤쪽 사본은 감기를 뒤집고 노멀은 그대로 바깥쪽)
	vertexCount = len(positions)
	positions = np.concatenate([positions, positions])
	uvs = np.concatenate([uvs, uvs])
	cardNormal = np.concatenate([cardNormal, cardNormal])
	triangles = np.concatenate([triangles, triangles[:, ::-1] + vertexCount])
	rootPerVertex = np.tile(np.repeat(rootVertex, pointCount * 2), 2)
	# 모프. (뿌리가 0.3 mm 미만 움직이는 정점은 버리고, 머리카락은 4 mm 미만 움직이는 셰이프를 통째로 버린다)
	targets = {}
	for index, targetName in enumerate(names):
		delta = deltasAll[index][rootPerVertex].copy()
		delta[np.linalg.norm(delta, axis=1) < 3e-4] = 0
		if np.abs(delta).max() > (4e-3 if name == "hair" else 3e-4):
			targets[targetName] = delta
	return {"name": name, "material": material, "positions": positions, "normals": cardNormal, "uvs": uvs, "triangles": triangles, "targets": targets}

# 영역. (머리: 이마 위 헤어라인에서 옆, 뒤, 목덜미까지)
eyeZ = info["eyeCenters"][0][2]
def scalpAccept(points):
	x, y, z = points[:, 0], points[:, 1], points[:, 2]
	frontness = smoothstep(eyeZ - 0.06, eyeZ - 0.01, z)
	hairline = (browY + 0.068) * frontness + (eyeY - 0.05) * (1 - frontness)
	temple = smoothstep(0.045, 0.07, np.abs(x)) * smoothstep(eyeZ - 0.03, eyeZ - 0.07, z)
	hairline = np.minimum(hairline, (eyeY + 0.015) * temple + 10 * (1 - temple))
	return smoothstep(hairline, hairline + 0.012, y)
def beardAccept(points):
	x, y, z = points[:, 0], points[:, 1], points[:, 2]
	chinBand = smoothstep(chinY - 0.012, chinY + 0.004, y) * (1 - smoothstep(mouthCenter[1] - 0.016, mouthCenter[1] - 0.009, y))
	width = 1 - smoothstep(mouthWidth + 0.002, mouthWidth + 0.012, np.abs(x))
	return chinBand * width * smoothstep(mouthCenter[2] - 0.05, mouthCenter[2] - 0.025, z)
def mustacheAccept(points):
	x, y, z = points[:, 0], points[:, 1], points[:, 2]
	band = smoothstep(upperLipY - 0.001, upperLipY + 0.003, y) * (1 - smoothstep(noseBottomY - 0.004, noseBottomY + 0.001, y))
	cornerBand = smoothstep(mouthWidth - 0.004, mouthWidth + 0.001, np.abs(x)) * (1 - smoothstep(mouthWidth + 0.006, mouthWidth + 0.011, np.abs(x))) * smoothstep(mouthCenter[1] - 0.012, mouthCenter[1] - 0.004, y) * (1 - smoothstep(noseBottomY - 0.004, noseBottomY, y))
	width = 1 - smoothstep(mouthWidth + 0.004, mouthWidth + 0.01, np.abs(x))
	return np.clip(band * width + cornerBand, 0, 1) * smoothstep(mouthCenter[2] - 0.03, mouthCenter[2] - 0.012, z)
browLine = [landmarks[17:22], landmarks[22:27]]
def browAccept(points):
	best = np.full(len(points), 1.0)
	for line in browLine:
		for index in range(len(line) - 1):
			a, b = line[index], line[index + 1]
			segment = b - a
			t = np.clip(((points - a) * segment).sum(1) / (segment * segment).sum(), 0, 1)
			distance = np.linalg.norm(points - (a + t[:, None] * segment), axis=1)
			best = np.minimum(best, distance)
	return 1 - smoothstep(0.003, 0.0065, best)

LOD_COUNTS = [(3500, 1200, 400, 400, 7), (2400, 800, 300, 280, 6), (1600, 520, 200, 200, 5), (1000, 320, 130, 130, 4), (600, 200, 80, 80, 3)]
scalpRoots, scalpNormals, scalpVertex = samplePoints(LOD_COUNTS[0][0], scalpAccept)
beardRoots, beardNormals, beardVertex = samplePoints(LOD_COUNTS[0][1], beardAccept, 400)
mustacheRoots, mustacheNormals, mustacheVertex = samplePoints(LOD_COUNTS[0][2], mustacheAccept, 2000)
browRoots, browNormals, browVertex = samplePoints(LOD_COUNTS[0][3], browAccept, 2000)
print("roots", len(scalpRoots), len(beardRoots), len(mustacheRoots), len(browRoots))
scalpLength = random.uniform(0.07, 0.11, len(scalpRoots)) + 0.05 * smoothstep(browY + 0.09, browY + 0.03, scalpRoots[:, 1])
beardLength = random.uniform(0.02, 0.042, len(beardRoots)) * (1 - 0.55 * smoothstep(0.0, mouthWidth + 0.01, np.abs(beardRoots[:, 0])))
mustacheLength = random.uniform(0.009, 0.016, len(mustacheRoots))
browLength = random.uniform(0.007, 0.014, len(browRoots))
browLength[random.random(len(browRoots)) < 0.12] *= 1.7
crown = np.array([0.0, browY + 0.11, eyeZ - 0.06])

for lodIndex, (scalpCount, beardCount, mustacheCount, browCount, segments) in enumerate(LOD_COUNTS):
	meshes = []
	def card(name, material, roots, normals, vertex, lengths, count, directions, gravity, lift, width, columns, curl=0.0, segmentCount=segments):
		widthScale = np.sqrt(len(roots) / count)
		paths = growStrands(roots[:count], normals[:count], directions[:count], lengths[:count], gravity, segmentCount, lift, curl)
		widths = random.uniform(0.8, 1.2, count) * width * widthScale
		return buildCards(name, material, paths, normals[:count], widths, vertex[:count], columns)
	away = scalpRoots - crown
	away[:, 1] = 0
	away[:, 1] -= 0.02
	scalpDirection = away / np.linalg.norm(away, axis=1, keepdims=True) * 0.5 + scalpNormals * 0.2 + np.array([0, -0.2, 0])
	frontRoot = smoothstep(eyeZ - 0.05, eyeZ - 0.01, scalpRoots[:, 2])
	scalpDirection += frontRoot[:, None] * np.array([0, 0.5, -1.4])
	meshes.append(card("hair", "m_hair", scalpRoots, scalpNormals, scalpVertex, scalpLength, scalpCount, scalpDirection, 0.5, 0.006, 0.012, 8, 0.06))
	beardDirection = beardNormals * 0.35 + np.array([0, -1.0, 0.15])
	meshes.append(card("beard", "m_beard", beardRoots, beardNormals, beardVertex, beardLength, beardCount, beardDirection, 0.3, 0.002, 0.006, 8, 0.1, max(segments - 2, 2)))
	mustacheSide = np.sign(mustacheRoots[:, 0])[:, None] * np.array([1.0, 0, 0])
	mustacheDirection = mustacheNormals * 0.25 + np.array([0, -1.0, 0.0]) + mustacheSide * 0.35
	meshes.append(card("mustache", "m_mustache", mustacheRoots, mustacheNormals, mustacheVertex, mustacheLength, mustacheCount, mustacheDirection, 0.2, 0.0015, 0.005, 8, 0.08, max(segments - 3, 2)))
	browSide = np.sign(browRoots[:, 0])[:, None] * np.array([1.0, 0, 0])
	browDirection = browSide + np.array([0, 0.35, 0]) + browNormals * 0.25
	meshes.append(card("eyebrows", "m_eyebrows", browRoots, browNormals, browVertex, browLength, browCount, browDirection, 0.05, 0.0008, 0.0028, 4, 0.12, 2))
	writeGlb(os.path.join(assetDirectory, "hair_lod%d.glb" % lodIndex), meshes)
	print("lod", lodIndex, [(mesh["name"], len(mesh["positions"]), len(mesh["targets"])) for mesh in meshes])

# 텍스처. (칸마다 가닥 뭉치: rgb 색, a 커버리지 / 탄젠트 rgb (0.5, 1, 0.5) 근처 + a 가닥 좌표)
def strandAtlas(path, tangentPath, size, tangentSize, columns, strandCount, colorRange, darkRatio, waviness, seed):
	generator = np.random.default_rng(seed)
	color = np.zeros((size, size, 3), dtype=np.float32)
	alpha = np.zeros((size, size), dtype=np.float32)
	columnWidth = size // columns
	v = (np.arange(size) + 0.5) / size
	for column in range(columns):
		x0 = column * columnWidth
		xs = np.arange(columnWidth)[None, :]
		for strand in range(strandCount):
			center = generator.uniform(0.12, 0.88) * columnWidth
			drift = generator.normal(0, 0.08) * columnWidth
			phase = generator.uniform(0, 6.28)
			frequency = generator.uniform(2, 6)
			strandPath = center + drift * v + np.sin(v * frequency + phase) * waviness * columnWidth
			end = generator.uniform(0.7, 1.0)
			width = generator.uniform(0.6, 1.4) * columnWidth / 90
			coverage = np.clip(1 - np.abs(xs - strandPath[:, None]) / width, 0, 1) * (1 - smoothstep(end - 0.15, end, v))[:, None]
			brightness = generator.uniform(*colorRange) if generator.random() > darkRatio else generator.uniform(0.18, 0.35)
			strandColor = np.array([brightness, brightness * 0.97, brightness * 0.93])
			block = slice(x0, x0 + columnWidth)
			color[:, block] = color[:, block] * (1 - coverage[..., None]) + strandColor * coverage[..., None]
			alpha[:, block] = np.maximum(alpha[:, block], coverage)
	filled = alpha > 0.01
	averageColor = color[filled].mean(0) if filled.any() else np.array([0.5, 0.5, 0.5])
	color[~filled] = averageColor
	saveImage(os.path.join(assetDirectory, path), np.concatenate([color, alpha[..., None]], -1))
	tv = np.repeat(((np.arange(tangentSize) + 0.5) / tangentSize)[:, None], tangentSize, 1)
	tangent = np.stack([0.5 + 0.03 * np.sin(tv * 20), np.full_like(tv, 1.0), np.full_like(tv, 0.5), tv], -1)
	saveImage(os.path.join(assetDirectory, tangentPath), tangent)

strandAtlas("hair.png", "hair_tangent.png", 2048, 512, 8, 70, (0.62, 0.9), 0.12, 0.03, 101)
strandAtlas("beard.png", "beard_tangent.png", 2048, 256, 8, 60, (0.7, 0.95), 0.06, 0.05, 103)
strandAtlas("mustache.png", "mustache_tangent.png", 2048, 256, 8, 60, (0.68, 0.92), 0.1, 0.04, 105)
strandAtlas("eyebrows.png", "eyebrows_tangent.png", 1024, 256, 4, 40, (0.5, 0.85), 0.3, 0.02, 107)
print("done")
