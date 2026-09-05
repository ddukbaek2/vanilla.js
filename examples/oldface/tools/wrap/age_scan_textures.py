import os
import sys
import math
import numpy as np
from PIL import Image

# 첫 버전 샘플(createAgedImages)의 노화 처리를 스캔 UV 공간에서 오프라인으로 수행한다.
# 좌표는 1024 알베도 레이아웃(원점 좌상) 기준, 출력은 2048 알베도 + 4096 디스플레이스먼트(주름 골 합성).
scratch = sys.argv[1]
scan_dir = os.path.join(scratch, "scan")
SIZE = 2048
SCALE = SIZE / 1024.0

def clamp(value, low, high):
    return np.minimum(np.maximum(value, low), high)

def smoothstep(edge0, edge1, value):
    normalized = clamp((value - edge0) / (edge1 - edge0), 0.0, 1.0)
    return normalized * normalized * (3.0 - 2.0 * normalized)

def mix(a, b, t):
    return a + (b - a) * t

def hash_noise(x, y):
    value = np.sin(x * 127.1 + y * 311.7) * 43758.5453
    return value - np.floor(value)

def value_noise(x, y):
    cell_x = np.floor(x)
    cell_y = np.floor(y)
    fraction_x = x - cell_x
    fraction_y = y - cell_y
    weight_x = fraction_x * fraction_x * (3.0 - 2.0 * fraction_x)
    weight_y = fraction_y * fraction_y * (3.0 - 2.0 * fraction_y)
    value00 = hash_noise(cell_x, cell_y)
    value10 = hash_noise(cell_x + 1.0, cell_y)
    value01 = hash_noise(cell_x, cell_y + 1.0)
    value11 = hash_noise(cell_x + 1.0, cell_y + 1.0)
    value_x0 = value00 + (value10 - value00) * weight_x
    value_x1 = value01 + (value11 - value01) * weight_x
    return value_x0 + (value_x1 - value_x0) * weight_y

# 1024 레이아웃 좌표 격자
grid_y, grid_x = np.mgrid[0:SIZE, 0:SIZE]
X = (grid_x + 0.5) / SCALE
Y = (grid_y + 0.5) / SCALE

def ellipse_mask(center_x, center_y, radius_x, radius_y):
    normalized_x = (X - center_x) / radius_x
    normalized_y = (Y - center_y) / radius_y
    distance = np.sqrt(normalized_x * normalized_x + normalized_y * normalized_y)
    return 1.0 - smoothstep(0.72, 1.0, distance)

random_seed = [7]
def next_random():
    random_seed[0] = (random_seed[0] * 16807) % 2147483647
    return random_seed[0] / 2147483647.0

def composite_patch(layer, x0, y0, alpha_patch):
    height, width = alpha_patch.shape
    x1 = x0 + width
    y1 = y0 + height
    if x0 >= SIZE or y0 >= SIZE or x1 <= 0 or y1 <= 0:
        return
    sx0 = max(0, -x0)
    sy0 = max(0, -y0)
    dx0 = max(0, x0)
    dy0 = max(0, y0)
    dx1 = min(SIZE, x1)
    dy1 = min(SIZE, y1)
    patch = alpha_patch[sy0:sy0 + (dy1 - dy0), sx0:sx0 + (dx1 - dx0)]
    region = layer[dy0:dy1, dx0:dx1]
    region += patch * (1.0 - region)

def draw_segment(layer, ax, ay, bx, by, width, alpha):
    # 둥근 끝의 선분 (좌표 / 폭은 2048 픽셀 단위)
    half = width * 0.5
    x0 = int(math.floor(min(ax, bx) - half - 1.5))
    y0 = int(math.floor(min(ay, by) - half - 1.5))
    x1 = int(math.ceil(max(ax, bx) + half + 1.5))
    y1 = int(math.ceil(max(ay, by) + half + 1.5))
    if x1 <= x0 or y1 <= y0:
        return
    py, px = np.mgrid[y0:y1, x0:x1]
    px = px + 0.5
    py = py + 0.5
    dx = bx - ax
    dy = by - ay
    length_squared = dx * dx + dy * dy
    if length_squared > 0.0:
        t = clamp(((px - ax) * dx + (py - ay) * dy) / length_squared, 0.0, 1.0)
    else:
        t = np.zeros_like(px)
    distance = np.sqrt((px - (ax + dx * t)) ** 2 + (py - (ay + dy * t)) ** 2)
    coverage = clamp(half + 0.5 - distance, 0.0, 1.0)
    composite_patch(layer, x0, y0, coverage * alpha)

wrinkle_seed = [0]
def stroke_wrinkle(layer, points, width, alpha, waviness):
    wrinkle_seed[0] += 1
    sample_count = 16
    samples = []
    for sample_index in range(sample_count + 1):
        t = sample_index / sample_count
        if len(points) == 3:
            x = (1 - t) * (1 - t) * points[0][0] + 2 * (1 - t) * t * points[1][0] + t * t * points[2][0]
            y = (1 - t) * (1 - t) * points[0][1] + 2 * (1 - t) * t * points[1][1] + t * t * points[2][1]
        else:
            x = points[0][0] + (points[1][0] - points[0][0]) * t
            y = points[0][1] + (points[1][1] - points[0][1]) * t
        samples.append([x, y])
    for sample_index in range(sample_count + 1):
        previous = samples[max(sample_index - 1, 0)]
        following = samples[min(sample_index + 1, sample_count)]
        tangent_x = following[0] - previous[0]
        tangent_y = following[1] - previous[1]
        tangent_length = math.sqrt(tangent_x * tangent_x + tangent_y * tangent_y) or 1.0
        noise = float(value_noise(wrinkle_seed[0] * 3.1 + sample_index * 0.55, wrinkle_seed[0] * 0.73)) - 0.5
        samples[sample_index][0] += -tangent_y / tangent_length * noise * waviness * 2
        samples[sample_index][1] += tangent_x / tangent_length * noise * waviness * 2
    for sample_index in range(sample_count):
        t = (sample_index + 0.5) / sample_count
        taper = 0.2 + 0.8 * math.pow(math.sin(t * math.pi), 0.6)
        a = samples[sample_index]
        b = samples[sample_index + 1]
        for width_factor, alpha_factor in ((5.0, 0.05), (2.6, 0.1), (1.0, 0.5)):
            draw_segment(layer, a[0] * SCALE, a[1] * SCALE, b[0] * SCALE, b[1] * SCALE, width * taper * width_factor * SCALE, alpha * taper * alpha_factor)

albedo = np.asarray(Image.open(os.path.join(scan_dir, "head_albedo.jpg")).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)).astype(np.float32) / 255.0
average_size = SIZE // 8
average = np.asarray(Image.open(os.path.join(scan_dir, "head_albedo.jpg")).convert("RGB").resize((average_size, average_size), Image.LANCZOS)).astype(np.float32) / 255.0

# 검버섯 레이어
spot_layer = np.zeros((SIZE, SIZE), dtype=np.float32)
spot_regions = [[512, 420, 290, 320], [512, 150, 340, 120], [512, 700, 250, 110], [250, 500, 190, 240], [774, 500, 190, 240]]
for spot_index in range(320):
    region = spot_regions[int(next_random() * len(spot_regions))]
    angle = next_random() * math.pi * 2
    reach = math.sqrt(next_random())
    spot_x = region[0] + math.cos(angle) * reach * region[2]
    spot_y = region[1] + math.sin(angle) * reach * region[3]
    spot_radius = 1.6 + next_random() * next_random() * 8
    spot_alpha = 0.25 + next_random() * 0.55
    ratio = 0.7 + next_random() * 0.5
    radius_pixels = spot_radius * SCALE
    x0 = int(math.floor(spot_x * SCALE - radius_pixels - 2))
    y0 = int(math.floor(spot_y * SCALE - radius_pixels - 2))
    extent = int(math.ceil(radius_pixels * 2 + 4))
    py, px = np.mgrid[y0:y0 + extent, x0:x0 + extent]
    u = (px + 0.5 - spot_x * SCALE)
    v = (py + 0.5 - spot_y * SCALE)
    cos_a = math.cos(angle)
    sin_a = math.sin(angle)
    ru = u * cos_a + v * sin_a
    rv = -u * sin_a + v * cos_a
    inside = np.sqrt((ru / radius_pixels) ** 2 + (rv / (radius_pixels * ratio)) ** 2) <= 1.0
    circular = np.sqrt(u * u + v * v) / radius_pixels
    gradient = np.where(circular < 0.55, 1.0 - (circular / 0.55) * 0.3, clamp((1.0 - circular) / 0.45, 0.0, 1.0) * 0.7)
    composite_patch(spot_layer, x0, y0, (gradient * spot_alpha * inside).astype(np.float32))

# 주름 레이어
wrinkle_layer = np.zeros((SIZE, SIZE), dtype=np.float32)
stroke_wrinkle(wrinkle_layer, [[392, 172], [512, 150], [640, 172]], 2.2, 0.7, 3.4)
stroke_wrinkle(wrinkle_layer, [[352, 200], [512, 176], [676, 200]], 2.5, 0.8, 3.2)
stroke_wrinkle(wrinkle_layer, [[404, 226], [512, 204], [616, 226]], 2.2, 0.68, 3.4)
stroke_wrinkle(wrinkle_layer, [[342, 232], [372, 226], [404, 230]], 1.5, 0.4, 2)
stroke_wrinkle(wrinkle_layer, [[620, 230], [652, 226], [684, 232]], 1.5, 0.4, 2)
stroke_wrinkle(wrinkle_layer, [[430, 246], [512, 232], [596, 246]], 1.4, 0.32, 2.6)
stroke_wrinkle(wrinkle_layer, [[430, 186], [470, 180], [510, 186]], 1.1, 0.24, 2)
stroke_wrinkle(wrinkle_layer, [[540, 212], [590, 206], [640, 212]], 1.1, 0.24, 2)
stroke_wrinkle(wrinkle_layer, [[497, 246], [494, 270], [500, 296]], 1.8, 0.55, 1)
stroke_wrinkle(wrinkle_layer, [[527, 246], [530, 270], [524, 296]], 1.8, 0.55, 1)
crow_feet = [[40, -15, 1.5, 0.5], [44, 3, 1.7, 0.55], [38, 21, 1.5, 0.5], [28, 34, 1.2, 0.3]]
for corner in ([372, -1], [655, 1]):
    for foot in crow_feet:
        stroke_wrinkle(wrinkle_layer, [[corner[0], 300], [corner[0] + corner[1] * foot[0] * 0.5, 300 + foot[1] * 0.5], [corner[0] + corner[1] * foot[0], 300 + foot[1]]], foot[2], foot[3], 1.2)
stroke_wrinkle(wrinkle_layer, [[395, 338], [440, 352], [485, 340]], 1.3, 0.35, 1.2)
stroke_wrinkle(wrinkle_layer, [[540, 340], [585, 352], [630, 338]], 1.3, 0.35, 1.2)
stroke_wrinkle(wrinkle_layer, [[400, 352], [440, 364], [480, 354]], 1.1, 0.22, 1.2)
stroke_wrinkle(wrinkle_layer, [[545, 354], [585, 364], [625, 352]], 1.1, 0.22, 1.2)
stroke_wrinkle(wrinkle_layer, [[462, 428], [444, 468], [450, 506]], 3.2, 0.5, 1.6)
stroke_wrinkle(wrinkle_layer, [[562, 428], [580, 468], [574, 506]], 3.2, 0.5, 1.6)
stroke_wrinkle(wrinkle_layer, [[442, 486], [434, 515], [438, 546]], 1.4, 0.2, 1.6)
stroke_wrinkle(wrinkle_layer, [[583, 486], [591, 515], [587, 546]], 1.4, 0.2, 1.6)
stroke_wrinkle(wrinkle_layer, [[468, 512], [512, 524], [556, 512]], 1.5, 0.35, 1.6)
for lip_x in (484, 496, 508, 520, 532, 542):
    stroke_wrinkle(wrinkle_layer, [[lip_x, 446], [lip_x, 462]], 1.1, 0.32, 0.6)
for neck_y in (694, 728):
    stroke_wrinkle(wrinkle_layer, [[392, neck_y - 6], [512, neck_y + 10], [636, neck_y - 6]], 2.2, 0.26, 3)

# 미세 잔주름 레이어
crinkle_layer = np.zeros((SIZE, SIZE), dtype=np.float32)
crinkle_regions = [[400, 425, 80, 70], [624, 425, 80, 70], [512, 190, 160, 55], [512, 720, 130, 60], [352, 305, 36, 36], [672, 305, 36, 36]]
for crinkle_index in range(1400):
    region = crinkle_regions[int(next_random() * len(crinkle_regions))]
    angle = next_random() * math.pi * 2
    reach = math.sqrt(next_random())
    start_x = region[0] + math.cos(angle) * reach * region[2]
    start_y = region[1] + math.sin(angle) * reach * region[3]
    direction = next_random() * math.pi
    length = 2 + next_random() * 3
    alpha = 0.03 + next_random() * 0.05
    draw_segment(crinkle_layer, start_x * SCALE, start_y * SCALE, (start_x + math.cos(direction) * length) * SCALE, (start_y + math.sin(direction) * length) * SCALE, 1.0 * SCALE, alpha)

# 알베도 픽셀 처리
background = albedo[int(8 * SCALE), int(8 * SCALE)]
background_distance = np.abs(albedo - background).sum(axis=2) * 255.0
skin_mask = smoothstep(6.0, 30.0, background_distance)
red = albedo[..., 0].copy()
green = albedo[..., 1].copy()
blue = albedo[..., 2].copy()
luminance = 0.299 * red + 0.587 * green + 0.114 * blue
maximum_channel = np.maximum(red, np.maximum(green, blue))
minimum_channel = np.minimum(red, np.minimum(green, blue))
saturation = np.where(maximum_channel > 0, (maximum_channel - minimum_channel) / np.maximum(maximum_channel, 1e-6), 0.0)
local = average[grid_y >> 3, grid_x >> 3]
local_luminance = 0.299 * local[..., 0] + 0.587 * local[..., 1] + 0.114 * local[..., 2]

stubble_mask = ellipse_mask(512, 600, 228, 190) * (1.0 - ellipse_mask(512, 415, 88, 40)) * (1.0 - ellipse_mask(512, 472, 78, 30))
brow_mask = np.maximum(ellipse_mask(430, 272, 80, 34), ellipse_mask(596, 272, 80, 34))
darkness = clamp((local_luminance - luminance) / 0.2, 0.0, 1.0)
low_saturation = clamp((0.42 - saturation) / 0.3, 0.0, 1.0)
hair_amount = darkness * (0.35 + 0.65 * low_saturation)
hair_mask = np.maximum(stubble_mask * 0.95, brow_mask * 0.85)
gray_level = 0.8 - darkness * 0.2
hair_blend = hair_amount * hair_mask
red = mix(red, gray_level * 0.92, hair_blend)
green = mix(green, gray_level * 0.9, hair_blend)
blue = mix(blue, gray_level * 0.88, hair_blend)

gray = 0.299 * red + 0.587 * green + 0.114 * blue
red = mix(red, gray, 0.12) * 0.97
green = mix(green, gray, 0.12) * 0.95 * 0.97
blue = mix(blue, gray, 0.12) * 0.905 * 0.97

blotch_noise = value_noise(X / 55.0, Y / 55.0) * 0.6 + value_noise(X / 23.0 + 7.0, Y / 23.0 + 3.0) * 0.4
emphasis = np.maximum(ellipse_mask(512, 400, 130, 120), np.maximum(ellipse_mask(400, 425, 120, 100), ellipse_mask(624, 425, 120, 100)))
blotch = smoothstep(0.55, 0.8, blotch_noise) * (0.3 + 0.7 * emphasis) * 0.8
red = mix(red, red * 1.22, blotch)
green = mix(green, green * 0.88, blotch)
blue = mix(blue, blue * 0.84, blotch)

red = mix(red, red * 0.55, spot_layer)
green = mix(green, green * 0.42, spot_layer)
blue = mix(blue, blue * 0.34, spot_layer)

red = red * (1.0 - wrinkle_layer * 0.06)
green = green * (1.0 - wrinkle_layer * 0.09)
blue = blue * (1.0 - wrinkle_layer * 0.1)

lip_mask = ellipse_mask(512, 472, 76, 27)
red = mix(red, red * 0.95, lip_mask * 0.45)
green = mix(green, green * 1.12, lip_mask * 0.45)
blue = mix(blue, blue * 1.1, lip_mask * 0.45)
eye_shadow_mask = np.maximum(ellipse_mask(432, 336, 78, 32), ellipse_mask(594, 336, 78, 32))
red = red * mix(1.0, 0.9, eye_shadow_mask * 0.6)
green = green * mix(1.0, 0.86, eye_shadow_mask * 0.6)
blue = blue * mix(1.0, 0.9, eye_shadow_mask * 0.6)

aged = np.stack([red, green, blue], axis=-1)
aged = albedo + (clamp(aged, 0.0, 1.0) - albedo) * skin_mask[..., None]
aged_image = Image.fromarray(np.clip(aged * 255.0 + 0.5, 0, 255).astype(np.uint8), "RGB")
aged_image.save(os.path.join(scan_dir, "aged_albedo_preview.jpg"), "JPEG", quality=92)
aged_image.transpose(Image.FLIP_TOP_BOTTOM).save(os.path.join(scan_dir, "aged_albedo_flipped.png"))

# 디스플레이스먼트: 주름 / 잔주름을 골로 합성
displacement = np.asarray(Image.open(os.path.join(scan_dir, "head_displacement.jpg")).convert("L")).astype(np.float32) / 255.0
wrinkle_4k = np.asarray(Image.fromarray(wrinkle_layer).resize((4096, 4096), Image.BILINEAR))
crinkle_4k = np.asarray(Image.fromarray(crinkle_layer).resize((4096, 4096), Image.BILINEAR))
displacement = clamp(displacement - wrinkle_4k * 0.3 - crinkle_4k * 0.12, 0.0, 1.0)
displacement_image = Image.fromarray(np.clip(displacement * 255.0 + 0.5, 0, 255).astype(np.uint8), "L")
displacement_image.transpose(Image.FLIP_TOP_BOTTOM).save(os.path.join(scan_dir, "aged_displacement_flipped.png"))
print("AGED", "wrinkle max", float(wrinkle_layer.max()), "spot max", float(spot_layer.max()), "skin coverage", float(skin_mask.mean()))
