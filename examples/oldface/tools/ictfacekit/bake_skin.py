# 나이 든 피부, 주름, 치아, 눈 텍스처 절차로 굽기. (python -I bake_skin.py <ict.npz> <vertex_indices.json> <작업 폴더> <assets 폴더>)
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from oldface_common import vertexNormals
from texture_common import rasterize, valueNoise, fractalNoise, tileNoise, heightToNormal, smoothstep, saveImage, insidePolygon

ictPath, indexPath, workDirectory, assetDirectory = sys.argv[1:5]
info = json.load(open(os.path.join(workDirectory, "head_info.json")))
parts = np.load(os.path.join(workDirectory, "parts.npz"))
ictPositions = np.load(ictPath)["positions"]
landmarkIndices = json.load(open(indexPath))["idx_to_landmark_verts"]
landmarks = ictPositions[landmarkIndices] * info["scale"] + np.array(info["offset"])
print("landmark 36 x", landmarks[36][0], "45 x", landmarks[45][0])
eyeCenters = np.array(info["eyeCenters"])

def gauss(distance, width):
	return np.exp(-(distance / width) ** 2)

def partMaps(name, resolution):
	positions = parts[name + "_positions"]
	triangles = parts[name + "_triangles"]
	normals = vertexNormals(positions, triangles)
	maps, covered = rasterize(parts[name + "_uvs"], triangles, np.concatenate([positions, normals, parts[name + "_uvs"]], 1), resolution)
	return maps[..., 0:3], maps[..., 3:6], covered

#==============================================================================
# 머리. (2048, 위치 지도에서 모든 맵을 셈)
#==============================================================================
resolution = 2048
cachePath = os.path.join(workDirectory, "head_maps.npz")
if os.path.exists(cachePath):
	cache = np.load(cachePath)
	position, normal = cache["position"], cache["normal"]
else:
	position, normal, _ = partMaps("head", resolution)
	np.savez(cachePath, position=position, normal=normal)
x, y, z = position[..., 0], position[..., 1], position[..., 2]
side = np.sign(x)
absoluteX = np.abs(x)
eyeY = eyeCenters[0][1]
browY = landmarks[17:27, 1].mean()
noseTip = landmarks[30]
mouthCenter = landmarks[48:60].mean(0)
mouthWidth = abs(landmarks[54][0] - landmarks[48][0]) / 2
chinY = landmarks[8][1]
front = smoothstep(-0.2, 0.4, normal[..., 2])

def fold(value, spacing, width, jitter):
	phase = value / spacing + jitter
	return gauss(phase - np.round(phase), width)

lowNoise = fractalNoise(position, 60.0, 3, seed=1)
lineJitter = (fractalNoise(position, 90.0, 2, seed=2) - 0.5) * 0.8

# 영역. (이마, 미간, 눈꼬리, 눈 밑, 팔자, 목, 입술, 턱)
foreheadMask = smoothstep(browY + 0.008, browY + 0.016, y) * (1 - smoothstep(browY + 0.055, browY + 0.07, y)) * (1 - smoothstep(0.045, 0.06, absoluteX)) * front
glabellaMask = gauss(x / 0.009, 1) * gauss((y - browY - 0.006) / 0.014, 1) * front
outerCorner = np.where(side[..., None] > 0, landmarks[45], landmarks[36])
cornerDelta = position - outerCorner
cornerDistance = np.hypot(cornerDelta[..., 0], cornerDelta[..., 1])
crowsMask = smoothstep(0.003, 0.008, cornerDistance) * (1 - smoothstep(0.022, 0.03, cornerDistance)) * smoothstep(0.0, 0.006, cornerDelta[..., 0] * side)
eyeCenterSide = np.where(side[..., None] > 0, eyeCenters[0], eyeCenters[1])
eyeDelta = position - eyeCenterSide
eyeDistance = np.hypot(eyeDelta[..., 0], eyeDelta[..., 1])
underEyeMask = smoothstep(0.014, 0.017, eyeDistance) * (1 - smoothstep(0.022, 0.026, eyeDistance)) * smoothstep(0.0, -0.006, eyeDelta[..., 1]) * front
upperLidMask = smoothstep(0.011, 0.014, eyeDistance) * (1 - smoothstep(0.019, 0.022, eyeDistance)) * smoothstep(0.0, 0.004, eyeDelta[..., 1]) * front
# 팔자 주름. (콧방울 옆에서 입꼬리 바깥 아래로 이은 선분까지 거리)
wingPoint = np.where(side[..., None] > 0, landmarks[35], landmarks[31]) + np.array([0, 0, 0])
wingPoint = wingPoint + np.stack([side * 0.008, np.zeros_like(x), np.zeros_like(x)], -1)
cornerPoint = np.where(side[..., None] > 0, landmarks[54], landmarks[48]) + np.stack([side * 0.008, np.full_like(x, -0.012), np.zeros_like(x)], -1)
segment = cornerPoint - wingPoint
along = np.clip(((position - wingPoint)[..., :2] * segment[..., :2]).sum(-1) / (segment[..., :2] ** 2).sum(-1), 0, 1)
closest = wingPoint[..., :2] + along[..., None] * segment[..., :2]
nasolabialDistance = np.linalg.norm(position[..., :2] - closest, axis=-1)
nasolabialMask = gauss(nasolabialDistance / 0.006, 1) * front * (z > noseTip[2] - 0.06)
neckMask = smoothstep(chinY - 0.015, chinY - 0.03, y) * (1 - smoothstep(chinY - 0.08, chinY - 0.095, y)) * smoothstep(0.0, 0.5, normal[..., 2])
lipPolygon = landmarks[48:60, :2]
lipMask = insidePolygon(x, y, lipPolygon) & (z > mouthCenter[2] - 0.015)
from scipy import ndimage
lipSoft = ndimage.gaussian_filter(lipMask.astype(np.float32), 2.0)
lipSurround = gauss(np.hypot((x - mouthCenter[0]) / (mouthWidth + 0.008), (y - mouthCenter[1]) / 0.022), 1) * front * (1 - lipSoft)
chinMask = gauss(np.hypot(x / 0.022, (y - (chinY + 0.018)) / 0.014), 1) * front
cheekMask = gauss(np.hypot((absoluteX - 0.045) / 0.022, (y - (eyeY - 0.035)) / 0.025), 1) * front
noseBridgeMask = gauss(x / 0.012, 1) * gauss((y - (eyeY - 0.002)) / 0.008, 1) * front
scalpMask = smoothstep(browY + 0.07, browY + 0.09, y) + (1 - front) * smoothstep(eyeY - 0.02, eyeY + 0.02, y)
scalpMask = np.clip(scalpMask, 0, 1)

# 결 높이. (나이 든 고정 주름 + 모공, skin_detail 로)
foreheadLines = fold(y, 0.0085, 0.16, lineJitter) * foreheadMask
crowsAngle = np.arctan2(cornerDelta[..., 1], cornerDelta[..., 0] * side)
crowsLines = fold(crowsAngle, 0.2, 0.18, lineJitter * 0.5) * crowsMask
underEyeLines = fold(eyeDistance, 0.0035, 0.2, lineJitter * 0.5) * underEyeMask
upperLidLines = fold(eyeDistance, 0.004, 0.22, lineJitter * 0.3) * upperLidMask
glabellaLines = fold(x, 0.007, 0.16, lineJitter * 0.4) * glabellaMask
neckLines = fold(y, 0.011, 0.14, lineJitter) * neckMask
lipLines = fold(np.arctan2(y - mouthCenter[1], x - mouthCenter[0]), 0.09, 0.2, lineJitter * 0.3) * lipSurround * 0.7 + fold(x, 0.0018, 0.25, lineJitter) * lipSoft * 0.5
noseBridgeLines = fold(y, 0.003, 0.2, lineJitter) * noseBridgeMask
cheekCrease = (fractalNoise(position * np.array([1.0, 2.5, 1.0]), 260.0, 2, seed=5) > 0.62) * cheekMask
pores = smoothstep(0.62, 0.85, fractalNoise(position, 2200.0, 2, seed=7)) * (1 - lipSoft) * (1 - scalpMask * 0.6)
pores *= 0.6 + 0.8 * (gauss(np.hypot(x / 0.02, (y - noseTip[1]) / 0.02), 1) + cheekMask)
fine = fractalNoise(position, 1200.0, 3, seed=9) - 0.5

def wrinkleHeight(scale):
	return -(foreheadLines * 0.9 + crowsLines * 0.4 + underEyeLines * 0.3 + upperLidLines * 0.4 + glabellaLines * 0.5 + neckLines * 0.35 + lipLines * 0.5 + noseBridgeLines * 0.3 + cheekCrease * 0.25) * scale - nasolabialMask * 0.9 * scale

height = 0.5 + ndimage.gaussian_filter(wrinkleHeight(0.14), 1.5) - pores * 0.12 + fine * 0.1 + (lowNoise - 0.5) * 0.08
height = np.clip(height, 0, 1)
saveImage(os.path.join(assetDirectory, "skin_detail.jpg"), np.repeat(height[..., None], 3, -1))
cavity = np.clip(0.5 - ndimage.gaussian_filter(height, 6) + height - 0.5, -0.5, 0.5)
crease = np.clip(-(height - ndimage.gaussian_filter(height, 12)) * 3, 0, 1)

# 노멀. (큰 굴곡만, 같은 높이 꼴로)
largeHeight = ndimage.gaussian_filter(wrinkleHeight(1.0) + (lowNoise - 0.5) * 0.3, 4)
headNormal = heightToNormal(largeHeight, 8.0)
saveImage(os.path.join(assetDirectory, "head_normal.jpg"), headNormal * 0.5 + 0.5)

# 알베도. (나이 든 피부: 얼룩, 볼과 코 붉은 기, 입술, 눈 밑, 검버섯, 두피)
base = np.array([0.60, 0.45, 0.38])
albedo = np.broadcast_to(base, position.shape).copy()
albedo *= (0.93 + 0.14 * lowNoise)[..., None]
redness = np.clip(cheekMask * 0.9 + gauss(np.hypot(x / 0.016, (y - noseTip[1]) / 0.016), 1) * 0.9 + gauss(np.hypot((absoluteX - 0.07) / 0.015, (y - eyeY) / 0.03), 1) * 0.5 * (1 - front), 0, 1)
redness *= 0.6 + 0.6 * fractalNoise(position, 140.0, 3, seed=11)
albedo += redness[..., None] * np.array([0.06, -0.035, -0.03])
albedo = albedo * (1 - lipSoft[..., None] * 0.7) + lipSoft[..., None] * 0.7 * np.array([0.56, 0.31, 0.29])
underEyeTint = underEyeMask * gauss(eyeDistance - 0.017, 0.006)
albedo = albedo * (1 - underEyeTint[..., None] * 0.35) + underEyeTint[..., None] * 0.35 * np.array([0.42, 0.30, 0.30])
spotNoise = fractalNoise(position, 180.0, 2, seed=13)
spotMask = smoothstep(0.66, 0.74, spotNoise) * np.clip(foreheadMask * 1.5 + cheekMask + scalpMask * 0.8 + gauss((absoluteX - 0.06) / 0.015, 1) * smoothstep(eyeY - 0.01, eyeY + 0.02, y), 0, 1)
albedo = albedo * (1 - spotMask[..., None] * 0.45) + spotMask[..., None] * 0.45 * np.array([0.45, 0.28, 0.18])
fineSpots = smoothstep(0.7, 0.8, fractalNoise(position, 700.0, 1, seed=15)) * 0.25
albedo *= (1 - fineSpots[..., None] * np.array([0.3, 0.4, 0.5]))
# 두피는 머리카락 빛으로 칠해 카드 사이로 살이 비치지 않게.
albedo = albedo * (1 - scalpMask[..., None] * 0.6) + scalpMask[..., None] * 0.6 * np.array([0.58, 0.56, 0.54])
albedo *= (1 - crease * 0.1)[..., None]
saveImage(os.path.join(assetDirectory, "head_albedo.jpg"), albedo)

# 거칠기 (R 차폐, G 거칠기, B 0) 와 스펙큘러. (입술과 T 존은 매끈, 골은 거칠고 어둡다)
tZone = np.clip(gauss(x / 0.018, 1) * smoothstep(noseTip[1] - 0.01, noseTip[1] + 0.01, y) * (1 - scalpMask) + foreheadMask * 0.6, 0, 1)
roughness = 0.66 - tZone * 0.1 - lipSoft * 0.2 + scalpMask * 0.06 + crease * 0.15 + (fine * 0.1)
occlusion = 1 - crease * 0.5 - nasolabialMask * 0.1
saveImage(os.path.join(assetDirectory, "head_roughness.jpg"), np.stack([occlusion, roughness, np.zeros_like(roughness)], -1))
specular = 0.58 + tZone * 0.15 + lipSoft * 0.2 - scalpMask * 0.1 - crease * 0.3 + cavity * 0.4
saveImage(os.path.join(assetDirectory, "head_specular.jpg"), np.repeat(specular[..., None], 3, -1))

#==============================================================================
# 표정 주름. (마스크 아틀라스 4x4 타일 1024, 주름 노멀과 색 2x2 타일 2048, wrinkles.json)
#==============================================================================
def sided(mask, sign):
	return mask * smoothstep(-0.004 * sign, 0.004 * sign, x) if sign else mask

channels = [
	("forehead_L", [1, 0, 0], sided(foreheadMask, 1)),
	("forehead_R", [1, 0, 0], sided(foreheadMask, -1)),
	("upperLid_L", [1, 0, 0], sided(upperLidMask, 1)),
	("upperLid_R", [1, 0, 0], sided(upperLidMask, -1)),
	("neck_L", [1, 0, 0], sided(neckMask, 1)),
	("neck_R", [1, 0, 0], sided(neckMask, -1)),
	("chin", [1, 0, 0], chinMask),
	("glabella", [0, 1, 0], glabellaMask),
	("noseBridge", [0, 1, 0], noseBridgeMask),
	("lips", [0, 1, 0], np.clip(lipSurround + lipSoft, 0, 1)),
	("crowsFeet_L", [0, 0, 1], sided(crowsMask, 1)),
	("crowsFeet_R", [0, 0, 1], sided(crowsMask, -1)),
	("underEye_L", [0, 0, 1], sided(underEyeMask, 1)),
	("underEye_R", [0, 0, 1], sided(underEyeMask, -1)),
	("nasolabial_L", [0, 0, 1], sided(gauss(nasolabialDistance / 0.012, 1) * front, 1)),
	("nasolabial_R", [0, 0, 1], sided(gauss(nasolabialDistance / 0.012, 1) * front, -1)),
]
tile = 1024
maskAtlas = np.zeros((tile * 4, tile * 4, 4), dtype=np.float32)
for channelIndex, (_, _, mask) in enumerate(channels):
	tileIndex, channel = divmod(channelIndex, 4)
	row, column = divmod(tileIndex, 4)
	smallMask = ndimage.zoom(np.clip(mask, 0, 1).astype(np.float32), tile / resolution, order=1)
	maskAtlas[row * tile:(row + 1) * tile, column * tile:(column + 1) * tile, channel] = smallMask
saveImage(os.path.join(assetDirectory, "wrinkle_masks.png"), maskAtlas)

layerHeights = [
	-(fold(y, 0.0085, 0.13, lineJitter) * 1.0 + fold(eyeDistance, 0.0035, 0.16, lineJitter * 0.3) * 0.7 + fold(y, 0.011, 0.12, lineJitter) * 0.8 + (fractalNoise(position, 500.0, 2, seed=21) - 0.5) * 0.8 * chinMask),
	-(fold(x, 0.006, 0.12, lineJitter * 0.4) * 1.0 + fold(y, 0.003, 0.18, lineJitter) * 0.7 * noseBridgeMask + fold(np.arctan2(y - mouthCenter[1], x - mouthCenter[0]), 0.07, 0.16, lineJitter * 0.3) * 0.8),
	-(fold(crowsAngle, 0.16, 0.14, lineJitter * 0.5) * crowsMask * 1.0 + fold(eyeDistance, 0.003, 0.16, lineJitter * 0.5) * underEyeMask * 0.8 + gauss(nasolabialDistance / 0.004, 1) * 1.2 + cheekCrease * 0.4),
]
layerTile = 2048
normalAtlas = np.full((layerTile * 2, layerTile * 2, 3), 0.5, dtype=np.float32)
normalAtlas[..., 2] = 1.0
colorAtlas = np.full((layerTile * 2, layerTile * 2, 3), 0.5, dtype=np.float32)
for layerIndex, layerHeight in enumerate(layerHeights):
	row, column = divmod(layerIndex, 2)
	layerHeight = ndimage.gaussian_filter(layerHeight, 1.2)
	layerNormal = heightToNormal(layerHeight, 3.0) * 0.5 + 0.5
	groove = np.clip(-layerHeight, 0, 1)
	layerColor = np.stack([0.5 - groove * 0.12, 0.5 - groove * 0.16, 0.5 - groove * 0.15], -1)
	normalAtlas[row * layerTile:(row + 1) * layerTile, column * layerTile:(column + 1) * layerTile] = layerNormal
	colorAtlas[row * layerTile:(row + 1) * layerTile, column * layerTile:(column + 1) * layerTile] = layerColor
saveImage(os.path.join(assetDirectory, "wrinkle_normal.jpg"), normalAtlas, 88)
saveImage(os.path.join(assetDirectory, "wrinkle_color.jpg"), colorAtlas, 88)

shapes = {
	"BrowInnerUp": {"forehead_L": 0.7, "forehead_R": 0.7},
	"BrowOuterUpLeft": {"forehead_L": 1.0}, "BrowOuterUpRight": {"forehead_R": 1.0},
	"EyeWideLeft": {"forehead_L": 0.3}, "EyeWideRight": {"forehead_R": 0.3},
	"BrowDownLeft": {"glabella": 0.8, "noseBridge": 0.3}, "BrowDownRight": {"glabella": 0.8, "noseBridge": 0.3},
	"EyeBlinkLeft": {"upperLid_L": 1.0, "crowsFeet_L": 0.2}, "EyeBlinkRight": {"upperLid_R": 1.0, "crowsFeet_R": 0.2},
	"EyeLookDownLeft": {"upperLid_L": 0.6}, "EyeLookDownRight": {"upperLid_R": 0.6},
	"EyeSquintLeft": {"crowsFeet_L": 0.8, "underEye_L": 0.6}, "EyeSquintRight": {"crowsFeet_R": 0.8, "underEye_R": 0.6},
	"CheekSquintLeft": {"crowsFeet_L": 1.0, "underEye_L": 0.8}, "CheekSquintRight": {"crowsFeet_R": 1.0, "underEye_R": 0.8},
	"MouthSmileLeft": {"nasolabial_L": 1.0, "crowsFeet_L": 0.5, "underEye_L": 0.4}, "MouthSmileRight": {"nasolabial_R": 1.0, "crowsFeet_R": 0.5, "underEye_R": 0.4},
	"NoseSneerLeft": {"noseBridge": 1.0, "nasolabial_L": 0.5}, "NoseSneerRight": {"noseBridge": 1.0, "nasolabial_R": 0.5},
	"MouthPucker": {"lips": 1.0}, "MouthFunnel": {"lips": 0.7},
	"MouthShrugLower": {"chin": 1.0}, "MouthPressLeft": {"chin": 0.4}, "MouthPressRight": {"chin": 0.4}, "MouthRollLower": {"chin": 0.3},
	"MouthStretchLeft": {"neck_L": 1.0}, "MouthStretchRight": {"neck_R": 1.0},
	"MouthFrownLeft": {"neck_L": 0.6, "chin": 0.3}, "MouthFrownRight": {"neck_R": 0.6, "chin": 0.3},
	"JawOpen": {"neck_L": 0.3, "neck_R": 0.3},
}
json.dump({"channels": [{"region": name, "maps": maps} for name, maps, _ in channels], "shapes": shapes}, open(os.path.join(assetDirectory, "wrinkles.json"), "w"), indent=1)

#==============================================================================
# 마이크로 노멀과 캐비티. (타일, 1024)
#==============================================================================
microHeight = sum(tileNoise(1024, period, seed=31 + index) * amplitude for index, (period, amplitude) in enumerate([(64, 0.5), (128, 0.3), (256, 0.2)]))
microPores = smoothstep(0.62, 0.8, tileNoise(1024, 160, seed=41))
microHeight = microHeight - microPores * 0.5
microNormal = heightToNormal(microHeight, 40.0, wrap=True)
microCavity = 0.42 + (microHeight - microHeight.mean()) * 0.5
saveImage(os.path.join(assetDirectory, "skin_micro.png"), np.concatenate([microNormal * 0.5 + 0.5, microCavity[..., None]], -1))

#==============================================================================
# 치아와 잇몸. (1024, u 0.5 아래 치아, 위 잇몸과 혀)
#==============================================================================
teethPosition, teethNormal, _ = partMaps("teeth", 1024)
uCoordinate = (np.arange(1024) + 0.5) / 1024
isTeeth = (uCoordinate[None, :] < 0.5)
depth = smoothstep(mouthCenter[2] - 0.05, mouthCenter[2] - 0.005, teethPosition[..., 2])
toothNoise = fractalNoise(teethPosition, 900.0, 2, seed=51)
toothColor = np.array([0.80, 0.73, 0.58]) * (0.85 + 0.15 * toothNoise)[..., None]
toothColor *= (0.55 + 0.45 * depth)[..., None]
gumNoise = fractalNoise(teethPosition, 500.0, 2, seed=53)
gumColor = np.array([0.62, 0.30, 0.29]) * (0.85 + 0.2 * gumNoise)[..., None] * (0.5 + 0.5 * depth)[..., None]
teethAlbedo = np.where(isTeeth[..., None], toothColor, gumColor)
saveImage(os.path.join(assetDirectory, "teeth_albedo.jpg"), teethAlbedo)
teethHeight = ndimage.gaussian_filter(np.where(isTeeth, toothNoise * 0.3, gumNoise * 0.6), 1.5)
saveImage(os.path.join(assetDirectory, "teeth_normal.jpg"), heightToNormal(teethHeight, 8.0) * 0.5 + 0.5)

#==============================================================================
# 눈. (공막은 각막 축 등거리 방위 UV, 홍채는 홍채 반경이 텍스처 반경 0.5)
#==============================================================================
size = 1024
v, u = np.meshgrid((np.arange(size) + 0.5) / size, (np.arange(size) + 0.5) / size, indexing="ij")
du, dv = u - 0.5, v - 0.5
radius = np.hypot(du, dv)
angle = np.arctan2(dv, du)
spherePoint = np.stack([np.cos(angle) * radius, np.sin(angle) * radius, np.zeros_like(radius)], -1)
veinNoise = fractalNoise(spherePoint, 40.0, 4, seed=61)
veins = gauss(veinNoise - 0.5, 0.025) * smoothstep(0.16, 0.34, radius)
sclera = np.array([0.80, 0.74, 0.68]) * (0.95 + 0.05 * fractalNoise(spherePoint, 12.0, 3, seed=63))[..., None]
sclera = sclera * (1 - smoothstep(0.2, 0.36, radius)[..., None] * 0.15)
sclera = sclera * (1 - veins[..., None] * 0.5) + veins[..., None] * 0.5 * np.array([0.62, 0.22, 0.2])
saveImage(os.path.join(assetDirectory, "eye_sclera.jpg"), sclera)
saveImage(os.path.join(assetDirectory, "eye_sclera_normal.jpg"), heightToNormal(ndimage.gaussian_filter(veinNoise * 0.4 + veins * 0.3, 2), 6.0) * 0.5 + 0.5)
fiberNoise = fractalNoise(np.stack([np.cos(angle) * 6, np.sin(angle) * 6, radius * 1.5], -1), 6.0, 4, seed=71)
fineFiber = fractalNoise(np.stack([np.cos(angle) * 40, np.sin(angle) * 40, radius * 3.0], -1), 3.0, 3, seed=73)
crypts = smoothstep(0.62, 0.75, fractalNoise(np.stack([np.cos(angle) * 9, np.sin(angle) * 9, radius * 14], -1), 1.0, 2, seed=75))
irisRadial = radius / 0.5
# 나이 든 회청색 홍채: 동공 둘레는 호박빛(중심 이색), 바깥은 회청, 가는 방사 섬유와 움푹한 틈, 짙은 윤부 고리.
outer = np.array([0.33, 0.39, 0.42])
inner = np.array([0.40, 0.37, 0.30])
iris = outer * (1 - gauss(irisRadial - 0.28, 0.11)[..., None] * 0.8) + inner * gauss(irisRadial - 0.28, 0.11)[..., None] * 0.8
iris = iris * (0.62 + 0.38 * fiberNoise + 0.35 * (fineFiber - 0.5))[..., None]
iris *= (1 - crypts * 0.35)[..., None]
collarette = gauss(irisRadial - 0.42, 0.06)
iris = iris * (1 - collarette[..., None] * 0.25) + collarette[..., None] * 0.25 * np.array([0.5, 0.48, 0.42])
iris *= (1 - smoothstep(0.78, 1.0, irisRadial) * 0.7)[..., None]
saveImage(os.path.join(assetDirectory, "eye_iris.png"), np.concatenate([np.clip(iris, 0, 1), np.ones_like(radius)[..., None]], -1))
irisHeight = ndimage.gaussian_filter(fiberNoise * 0.5 + fineFiber * 0.3 - crypts * 0.3 - collarette * 0.3, 0.8)
saveImage(os.path.join(assetDirectory, "eye_iris_normal.png"), ndimage.zoom(heightToNormal(irisHeight, 10.0), (0.5, 0.5, 1), order=1) * 0.5 + 0.5)

# 눈꺼풀 차폐. (눈 가림 메시 UV 에 3D 자리로: 위 눈꺼풀 쪽과 눈꼬리가 어둡다)
shellPosition, _, shellCovered = partMaps("eyeshell", 512)
shellCenter = np.where((shellPosition[..., 0] > 0)[..., None], eyeCenters[0], eyeCenters[1])
shellDelta = shellPosition - shellCenter
elevation = shellDelta[..., 1] / 0.012
lateral = np.abs(shellDelta[..., 0]) / 0.014
darkness = np.clip(0.06 + 0.3 * smoothstep(0.0, 0.9, elevation) + 0.12 * smoothstep(0.6, 1.0, lateral), 0, 0.45) * shellCovered
saveImage(os.path.join(assetDirectory, "eye_occlusion.png"), np.repeat(darkness[..., None], 4, -1))

# 속눈썹. (ICT 속눈썹 UV: 띠 여섯(위 셋 v 0.012..0.484, 아래 셋 v 0.514..0.986), 띠마다 u 가 눈꺼풀 길이, v 띠 아래 끝이 뿌리, 위 끝이 끝)
# 위 속눈썹은 짙고 촘촘하게, 아래는 짧고 성기게. 가닥마다 길이와 휨이 다르고 끝으로 갈수록 가늘다. 짙은 갈색에 흰 가닥이 섞인다.
lashGenerator = np.random.default_rng(81)
lashColor = np.zeros((1024, 1024, 3), dtype=np.float32)
lashAlpha = np.zeros((1024, 1024), dtype=np.float32)
lashColumns = np.arange(1024)[None, :]
LASH_BANDS = [(0.012, 0.152, False), (0.178, 0.318, False), (0.344, 0.484, False), (0.514, 0.654, True), (0.680, 0.820, True), (0.846, 0.986, True)]
for bandStart, bandEnd, lower in LASH_BANDS:
	rowStart, rowEnd = int(bandStart * 1024), int(np.ceil(bandEnd * 1024))
	bandV = (np.arange(rowStart, rowEnd) + 0.5) / 1024
	for strand in range(110 if lower else 320):
		rootU = lashGenerator.uniform(0.01, 0.99) * 1024
		length = (bandEnd - bandStart) * (lashGenerator.uniform(0.3, 0.6) if lower else lashGenerator.uniform(0.6, 1.0))
		along = (bandV - bandStart) / length
		inside = (along >= 0) & (along <= 1)
		path = rootU + lashGenerator.normal(0, 3) * along ** 2
		# 눈 하나가 화면에서 수십 픽셀이라 밉맵에서 가닥이 사라지지 않게 뿌리를 굵게 둔다. (뿌리끼리 겹쳐 짙은 속눈썹 줄이 된다)
		width = (4.0 if not lower else 2.0) * (1 - 0.75 * np.clip(along, 0, 1))
		coverage = np.clip(1 - np.abs(lashColumns - path[:, None]) / width[:, None], 0, 1) * inside[:, None] * (1 - 0.5 * np.clip(along, 0, 1))[:, None]
		if lower:
			coverage *= 0.6
		shade = lashGenerator.uniform(0.1, 0.2) if lashGenerator.random() > 0.3 else lashGenerator.uniform(0.5, 0.68)
		block = slice(rowStart, rowEnd)
		lashColor[block] = lashColor[block] * (1 - coverage[..., None]) + np.array([shade, shade * 0.92, shade * 0.85]) * coverage[..., None]
		lashAlpha[block] = np.maximum(lashAlpha[block], coverage)
lashColor[lashAlpha < 0.01] = np.array([0.2, 0.18, 0.16])
saveImage(os.path.join(assetDirectory, "eyelash.png"), np.concatenate([lashColor, lashAlpha[..., None]], -1))
print("done")
