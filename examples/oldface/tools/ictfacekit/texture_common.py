# OLD FACE 절차 텍스처 공통. (UV 래스터, 3D 값 노이즈, 높이 -> 노멀)
import numpy as np
from scipy import ndimage
from PIL import Image

# UV 공간 삼각형 래스터. (텍셀마다 정점 속성을 무게중심으로 보간, 빈 텍셀은 가장 가까운 칠한 텍셀로 채움)
def rasterize(uvs, triangles, attributes, resolution):
	channelCount = attributes.shape[1]
	output = np.zeros((resolution, resolution, channelCount), dtype=np.float32)
	covered = np.zeros((resolution, resolution), dtype=bool)
	pixel = uvs * resolution - 0.5
	for triangle in triangles:
		a, b, c = pixel[triangle[0]], pixel[triangle[1]], pixel[triangle[2]]
		minX = max(int(np.floor(min(a[0], b[0], c[0]))), 0)
		maxX = min(int(np.ceil(max(a[0], b[0], c[0]))), resolution - 1)
		minY = max(int(np.floor(min(a[1], b[1], c[1]))), 0)
		maxY = min(int(np.ceil(max(a[1], b[1], c[1]))), resolution - 1)
		if maxX < minX or maxY < minY:
			continue
		xs, ys = np.meshgrid(np.arange(minX, maxX + 1), np.arange(minY, maxY + 1))
		denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
		if abs(denominator) < 1e-12:
			continue
		weightA = ((b[1] - c[1]) * (xs - c[0]) + (c[0] - b[0]) * (ys - c[1])) / denominator
		weightB = ((c[1] - a[1]) * (xs - c[0]) + (a[0] - c[0]) * (ys - c[1])) / denominator
		weightC = 1 - weightA - weightB
		inside = (weightA >= -1e-4) & (weightB >= -1e-4) & (weightC >= -1e-4)
		if not inside.any():
			continue
		values = weightA[inside, None] * attributes[triangle[0]] + weightB[inside, None] * attributes[triangle[1]] + weightC[inside, None] * attributes[triangle[2]]
		output[ys[inside], xs[inside]] = values
		covered[ys[inside], xs[inside]] = True
	_, (nearestY, nearestX) = ndimage.distance_transform_edt(~covered, return_indices=True)
	return output[nearestY, nearestX], covered

def hash3(ix, iy, iz, seed):
	n = (ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791) ^ (seed * 2654435761)
	n = n & 0xFFFFFFFF
	n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
	n = n ^ (n >> 16)
	return (n & 0xFFFFFF) / float(0xFFFFFF)

# 3D 값 노이즈. (0..1, points 는 (..., 3))
def valueNoise(points, frequency, seed=0):
	scaled = points * frequency
	base = np.floor(scaled).astype(np.int64)
	fraction = scaled - base
	smooth = fraction * fraction * (3 - 2 * fraction)
	result = 0
	for dx in (0, 1):
		for dy in (0, 1):
			for dz in (0, 1):
				corner = hash3(base[..., 0] + dx, base[..., 1] + dy, base[..., 2] + dz, seed)
				weight = (smooth[..., 0] if dx else 1 - smooth[..., 0]) * (smooth[..., 1] if dy else 1 - smooth[..., 1]) * (smooth[..., 2] if dz else 1 - smooth[..., 2])
				result = result + corner * weight
	return result

def fractalNoise(points, frequency, octaves, seed=0, gain=0.5):
	total = 0
	amplitude = 1.0
	norm = 0
	for octave in range(octaves):
		total = total + valueNoise(points, frequency * (2 ** octave), seed + octave * 17) * amplitude
		norm += amplitude
		amplitude *= gain
	return total / norm

# 2D 주기 값 노이즈. (타일되는 텍스처용, period 칸)
def tileNoise(resolution, period, seed=0):
	coordinate = np.arange(resolution) / resolution * period
	base = np.floor(coordinate).astype(np.int64)
	fraction = coordinate - base
	smooth = fraction * fraction * (3 - 2 * fraction)
	grid = hash3(np.arange(period)[:, None], np.arange(period)[None, :], np.zeros((period, period), dtype=np.int64), seed)
	y0, y1 = base % period, (base + 1) % period
	x0, x1 = y0, y1
	top = grid[y0][:, x0] * (1 - smooth[None, :]) + grid[y0][:, x1] * smooth[None, :]
	bottom = grid[y1][:, x0] * (1 - smooth[None, :]) + grid[y1][:, x1] * smooth[None, :]
	return top * (1 - smooth[:, None]) + bottom * smooth[:, None]

# 높이 -> 탄젠트 노멀. (셰이더 디테일 높이와 같은 꼴: xy = -기울기, u 오른쪽, v 는 행이 늘어나는 쪽)
def heightToNormal(height, strength, wrap=False):
	if wrap:
		gradientU = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * 0.5
		gradientV = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * 0.5
	else:
		gradientV, gradientU = np.gradient(height)
	normal = np.stack([-gradientU * strength, -gradientV * strength, np.ones_like(height)], -1)
	normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
	return normal

def smoothstep(edge0, edge1, value):
	t = np.clip((value - edge0) / (edge1 - edge0), 0, 1)
	return t * t * (3 - 2 * t)

def saveImage(path, array, quality=92):
	array = np.clip(array, 0, 1)
	image = Image.fromarray((array * 255 + 0.5).astype(np.uint8))
	if path.endswith(".jpg"):
		image.save(path, quality=quality)
	else:
		image.save(path, optimize=True)

# 점이 2D 다각형 안인지. (교차 수, 꼭짓점 (n, 2))
def insidePolygon(x, y, polygon):
	inside = np.zeros(x.shape, dtype=bool)
	count = len(polygon)
	for index in range(count):
		x0, y0 = polygon[index]
		x1, y1 = polygon[(index + 1) % count]
		crossing = ((y0 > y) != (y1 > y)) & (x < (x1 - x0) * (y - y0) / (y1 - y0 + 1e-12) + x0)
		inside ^= crossing
	return inside
