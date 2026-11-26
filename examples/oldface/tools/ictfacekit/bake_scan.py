# Infinite 머리 스캔(Lee Perry-Smith, CC BY 3.0) 텍스처를 감싼 ICT 머리 UV 로 굽기. bake_skin.py 다음에 돌려 머리 알베도, 노멀, 디테일 높이, 거칠기, 스펙큘러를 덮어쓴다.
# python -I bake_scan.py <작업 폴더> <fit_scan 이 쓴 scan.npz> <lambertian.jpg> <bump.png> <assets 폴더>
# 머리 텍셀마다 3D 자리에서 가장 가까운 스캔 겉면 텍셀을 찾아(스캔 UV 에 위치를 래스터한 KD 트리) 그 자리의 색과 변위를 가져온다.
# 변위는 띠를 나눠 중간 띠(주름, 팔자, 입술 결)는 head_normal 로, 고운 띠(모공, 잔주름)는 skin_detail 높이로 쓴다.
# 스캔은 검은 수염 자국과 눈썹이 있어 흰머리 장면에 맞게 털 자국을 지우고 수염 그늘을 걷는다. 스캔이 덮지 않는 곳(어깨, 입 안)은 bake_skin 의 절차 피부를 스캔 피부색에 맞춰 잇는다.
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from scipy import ndimage
from scipy.spatial import cKDTree
from PIL import Image
from texture_common import rasterize, heightToNormal, smoothstep, saveImage

Image.MAX_IMAGE_PIXELS = None
workDirectory, scanPath, albedoPath, bumpPath, assetDirectory = sys.argv[1:6]
info = json.load(open(os.path.join(workDirectory, "head_info.json")))
cache = np.load(os.path.join(workDirectory, "head_maps.npz"))
position, normal = cache["position"], cache["normal"]
resolution = position.shape[0]
scan = np.load(scanPath)
# fit_scan 의 장면 자리 -> build_head 가 다시 맞춘 장면 자리.
scanPositions = (scan["positions"] - scan["transformOffset"]) / scan["transformScale"] * info["scale"] + np.array(info["offset"])

scanAlbedo = np.asarray(Image.open(albedoPath).convert("RGB")).astype(np.float32) / 255
scanResolution = scanAlbedo.shape[0]
bump = np.asarray(Image.open(bumpPath)).astype(np.float32) / 65535

# 스캔 UV 에 3D 자리 래스터. (OBJ 의 v 는 위로, 그림 줄은 아래로)
cornerUvs = scan["uvs"][scan["uvTriangles"].ravel()]
flatTriangles = np.arange(len(cornerUvs)).reshape(-1, 3)
scanMap, scanCovered = rasterize(np.column_stack([cornerUvs[:, 0], 1 - cornerUvs[:, 1]]), flatTriangles, scanPositions[scan["triangles"].ravel()], scanResolution)
rows, columns = np.nonzero(scanCovered)
tree = cKDTree(scanMap[rows, columns])

distance, nearest = tree.query(position.reshape(-1, 3), workers=-1)
distance = distance.reshape(resolution, resolution)
scanRow, scanColumn = rows[nearest].reshape(resolution, resolution), columns[nearest].reshape(resolution, resolution)
covered = 1 - smoothstep(0.004, 0.012, distance)

albedo = scanAlbedo[scanRow, scanColumn]
bumpScale = bump.shape[0] / scanResolution
height = ndimage.map_coordinates(bump, [(scanRow + 0.5) * bumpScale - 0.5, (scanColumn + 0.5) * bumpScale - 0.5], order=1)

# bake_skin 이 쓴 절차 맵은 처음 돌 때 작업 폴더에 옮겨 두고 그것을 읽는다. (다시 돌려도 같은 결과)
def proceduralMap(name, mode):
	keepPath = os.path.join(workDirectory, "procedural_" + name)
	if not os.path.exists(keepPath):
		Image.open(os.path.join(assetDirectory, name)).save(keepPath, quality=95)
	return np.asarray(Image.open(keepPath).convert(mode)).astype(np.float32) / 255

def blur(image, radius):
	if image.ndim == 3:
		return np.stack([ndimage.gaussian_filter(image[..., channel], radius) for channel in range(image.shape[2])], -1)
	return ndimage.gaussian_filter(image, radius)

x, y, z = position[..., 0], position[..., 1], position[..., 2]
eyeY = np.mean([center[1] for center in info["eyeCenters"]])
front = smoothstep(0.0, 0.5, normal[..., 2])

# 털 자국(수염, 눈썹, 두피 털)을 지우고 둘레 살빛으로 메운다. (주변보다 어둡고 덜 붉은 점, 입술은 뺀다)
luminance = albedo @ np.array([0.299, 0.587, 0.114])
redness = albedo[..., 0] - albedo[..., 1]
hair = np.clip((blur(luminance, 5) - luminance) / 0.06, 0, 1) * (1 - smoothstep(0.14, 0.22, blur(redness, 3)))
hair = np.clip(blur(hair, 0.8) * 1.4, 0, 1)
skinWeight = (1 - hair) ** 2 + 1e-4
skinFill = blur(albedo * skinWeight[..., None], 4) / blur(skinWeight, 4)[..., None]
albedo = albedo * (1 - hair[..., None]) + skinFill * hair[..., None]

# 수염 그늘(털 뿌리가 비치는 푸르스름하고 어두운 낮은 주파수)을 볼 살빛에 맞춘다.
cheek = (np.abs(np.abs(x) - 0.045) < 0.015) & (np.abs(y - (eyeY - 0.03)) < 0.01) & (front > 0.5)
reference = albedo[cheek].mean(0)
lowColor = blur(albedo, 14)
lips = smoothstep(0.03, 0.07, (lowColor[..., 0] - lowColor[..., 1]) - (reference[0] - reference[1]))
beardRegion = smoothstep(eyeY - 0.04, eyeY - 0.055, y) * smoothstep(eyeY - 0.26, eyeY - 0.2, y) * (1 - lips)
correction = np.clip(reference / np.maximum(lowColor, 1e-3), 1.0, 1.7)
albedo = albedo * correction ** beardRegion[..., None]

# 흰 수염 끝이 살짝 비치게. (카드가 덮는 턱과 입 둘레)
albedo = albedo * (1 - hair[..., None] * beardRegion[..., None] * 0.25) + 0.8 * hair[..., None] * beardRegion[..., None] * 0.25

# 눈 둘레의 붉은 기를 걷는다. (스캔은 눈을 감고 있어 눈물언덕과 눈꺼풀 안쪽의 붉은 살이 ICT 의 뜬 눈꺼풀 가에 묻어난다)
eyeRegion = np.zeros_like(y)
for center in info["eyeCenters"]:
	eyeRegion = np.maximum(eyeRegion, 1 - smoothstep(0.8, 1.3, np.sqrt(((x - center[0]) / 0.02) ** 2 + ((y - center[1]) / 0.012) ** 2)) * smoothstep(center[2] - 0.02, center[2] - 0.005, z))
excess = np.clip((albedo[..., 0] - albedo[..., 1]) - (reference[0] - reference[1]), 0, 1)
albedo[..., 0] -= excess * eyeRegion * 0.7
albedo[..., 2] += excess * eyeRegion * 0.15

# 장면 빛에 맞춘 피부 반사율. (스캔 색은 밝게 찍혀 있어 볼 평균을 나이 든 남자 피부 알베도 쯤으로 옮긴다)
albedo = np.clip(albedo * (np.array([0.62, 0.47, 0.40]) / reference), 0, 1)

# 두피는 머리카락 빛을 섞어 카드 사이로 살이 비치지 않게. (build_hair 의 헤어라인과 같은 꼴)
eyeZ = info["eyeCenters"][0][2]
frontness = smoothstep(eyeZ - 0.06, eyeZ - 0.01, z)
hairline = (eyeY + 0.093) * frontness + (eyeY - 0.05) * (1 - frontness)
scalp = smoothstep(hairline, hairline + 0.02, y) * (1 - smoothstep(0.045, 0.07, np.abs(x)) * smoothstep(eyeZ - 0.03, eyeZ - 0.07, z) * smoothstep(eyeY + 0.03, eyeY + 0.0, y))
albedo = albedo * (1 - scalp[..., None] * 0.55) + scalp[..., None] * 0.55 * np.array([0.62, 0.6, 0.58])

# 덮지 않는 곳은 절차 피부를 스캔 빛에 맞춰.
procedural = proceduralMap("head_albedo.jpg", "RGB")
overlap = covered > 0.9
gain = albedo[overlap].mean(0) / np.maximum(procedural[overlap].mean(0), 1e-3)
albedo = albedo * covered[..., None] + np.clip(procedural * gain, 0, 1) * (1 - covered[..., None])
saveImage(os.path.join(assetDirectory, "head_albedo.jpg"), albedo)

# 변위 띠 나누기. (2048 텍셀 기준 반경)
height = height * covered + (height[overlap].mean()) * (1 - covered)
low = ndimage.gaussian_filter(height, 24 * resolution / 2048)
medium = ndimage.gaussian_filter(height, 1.2 * resolution / 2048) - low
fine = height - ndimage.gaussian_filter(height, 3 * resolution / 2048)
mediumScale = 1 / max(np.percentile(np.abs(medium[overlap]), 99), 1e-6)
fineScale = 1 / max(np.percentile(np.abs(fine[overlap]), 99), 1e-6)
headNormal = heightToNormal(medium * mediumScale, 1.6 * resolution / 2048)
saveImage(os.path.join(assetDirectory, "head_normal.jpg"), headNormal * 0.5 + 0.5)
detail = np.clip(0.5 + fine * fineScale * 0.35, 0, 1)
saveImage(os.path.join(assetDirectory, "skin_detail.jpg"), np.repeat(detail[..., None], 3, -1))

# 거칠기 (R 차폐, G 거칠기) 와 스펙큘러. bake_skin 의 부위별 값에서 절차 주름을 지우고 스캔 골을 얹는다.
roughnessMap = proceduralMap("head_roughness.jpg", "RGB")
specularMap = proceduralMap("head_specular.jpg", "L")
cavity = np.clip(-(ndimage.gaussian_filter(height, 2 * resolution / 2048) - ndimage.gaussian_filter(height, 10 * resolution / 2048)) * mediumScale, 0, 1)
roughness = ndimage.gaussian_filter(roughnessMap[..., 1], 12) + 0.04 + cavity * 0.12 + hair * 0.08 + (fine * fineScale) * 0.03
occlusion = 1 - cavity * 0.45
specular = ndimage.gaussian_filter(specularMap, 12) - cavity * 0.25 - hair * 0.15
saveImage(os.path.join(assetDirectory, "head_roughness.jpg"), np.stack([occlusion, np.clip(roughness, 0, 1), np.zeros_like(roughness)], -1))
saveImage(os.path.join(assetDirectory, "head_specular.jpg"), np.repeat(np.clip(specular, 0, 1)[..., None], 3, -1))
print("covered", float(overlap.mean()), "medium scale", mediumScale, "fine scale", fineScale)
