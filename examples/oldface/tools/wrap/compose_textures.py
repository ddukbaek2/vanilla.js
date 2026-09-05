import os
import sys
import numpy as np
from PIL import Image, ImageFilter

# 베이크 결과(스캔 알베도 / 스페큘러 / 노화 높이 / 히트 마스크)를 샘플용 텍스처로 합성한다.
# - 알베도: 스캔(마스크 안) + 색 맞춘 MB-Lab 알베도(바깥)
# - 노멀 / 디테일: 노화 높이맵의 미분 (마스크 바깥은 평탄 / MB-Lab 디테일)
# - 러프니스(ORM G): 스캔 스페큘러 기반 (바깥은 MB-Lab 러프니스)
scratch = sys.argv[1]
output_dir = sys.argv[2]
work = os.path.join(scratch, "wrap")
texture_dir = os.path.join(scratch, "mblab", "animate1978-MB-Lab-063bff0", "data", "textures")
original_assets = os.path.join(scratch, "original_assets")
ALBEDO_GAIN = np.array([0.9, 0.86, 0.82], dtype=np.float32)
NORMAL_STRENGTH = 10.0
DETAIL_GAIN = 1.6

def load(path, size=None, mode="RGB"):
    image = Image.open(path).convert(mode)
    if size is not None and image.size != (size, size):
        image = image.resize((size, size), Image.LANCZOS)
    array = np.asarray(image).astype(np.float32) / 255.0
    return array

def box_blur(array, radius):
    padded = np.pad(array, [(radius, radius), (radius, radius)] + [(0, 0)] * (array.ndim - 2), mode="edge")
    summed = np.cumsum(np.cumsum(padded, axis=0, dtype=np.float64), axis=1)
    summed = np.pad(summed, [(1, 0), (1, 0)] + [(0, 0)] * (array.ndim - 2))
    size = 2 * radius + 1
    height, width = array.shape[:2]
    total = summed[size:size + height, size:size + width] - summed[:height, size:size + width] - summed[size:size + height, :width] + summed[:height, :width]
    return (total / float(size * size)).astype(np.float32)

def fill_outside(array, valid, iterations=12):
    # 유효 텍셀의 값을 바깥으로 번지게 채워 블렌딩 시 검은 테두리를 막는다
    filled = array.copy()
    filled[~valid] = 0.0
    weight = valid.astype(np.float32)
    for _ in range(iterations):
        blurred_weight = box_blur(weight, 2)
        blurred = box_blur(filled * (weight[..., None] if filled.ndim == 3 else weight), 2)
        grow = (weight <= 0.0) & (blurred_weight > 1e-4)
        if filled.ndim == 3:
            filled[grow] = blurred[grow] / blurred_weight[grow][:, None]
        else:
            filled[grow] = blurred[grow] / blurred_weight[grow]
        weight[grow] = 1.0
    return filled

def save_jpeg(array, path, quality=92):
    if array.ndim == 2:
        array = np.stack([array, array, array], axis=-1)
    Image.fromarray(np.clip(array * 255.0 + 0.5, 0, 255).astype(np.uint8), "RGB").save(path, "JPEG", quality=quality, optimize=True)

def resize_mask(mask, size, resample):
    return np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).resize((size, size), resample)).astype(np.float32) / 255.0

# 마스크
mask_hard = load(os.path.join(work, "baked_mask.png"), 2048, "L") > 0.5
mask_soft = resize_mask(mask_hard.astype(np.float32), 2048, Image.BILINEAR)
mask_soft = np.asarray(Image.fromarray((mask_soft * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(np.float32) / 255.0
mask_soft = np.where(mask_hard, np.maximum(mask_soft, 0.999), mask_soft)
mask_hard_4k = resize_mask(mask_hard.astype(np.float32), 4096, Image.NEAREST) > 0.5
mask_soft_4k = resize_mask(mask_soft, 4096, Image.BILINEAR)
print("mask coverage:", round(float(mask_hard.mean()), 4))

# 알베도
baked_albedo = fill_outside(load(os.path.join(work, "baked_albedo.png"), 2048), mask_hard) * ALBEDO_GAIN
mblab_albedo = load(os.path.join(texture_dir, "hum_m_cauc_albedo.png"), 2048)
dilated = np.asarray(Image.fromarray((mask_hard * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))) > 127
eroded = ~(np.asarray(Image.fromarray(((~mask_hard) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))) > 127)
edge_band = dilated & (~mask_hard)
inner_band = mask_hard & (~eroded)
scan_edge_color = baked_albedo[inner_band].mean(axis=0)
mblab_edge_color = mblab_albedo[edge_band].mean(axis=0)
gain = scan_edge_color / np.maximum(mblab_edge_color, 1e-3)
print("edge colors scan / mblab / gain:", scan_edge_color.round(3), mblab_edge_color.round(3), gain.round(3))
matched_mblab = np.clip(mblab_albedo * gain, 0.0, 1.0)
albedo = baked_albedo * mask_soft[..., None] + matched_mblab * (1.0 - mask_soft[..., None])
save_jpeg(albedo, os.path.join(output_dir, "skin_albedo.jpg"))

# 높이 → 노멀 (4K) / 디테일 (4K)
height = fill_outside(load(os.path.join(work, "baked_height.png"), 4096, "L"), mask_hard_4k, 16)
height_smooth = box_blur(height, 1)
gradient_x = (np.roll(height_smooth, -1, axis=1) - np.roll(height_smooth, 1, axis=1)) * 0.5
gradient_y = (np.roll(height_smooth, -1, axis=0) - np.roll(height_smooth, 1, axis=0)) * 0.5
normal_x = -gradient_x * NORMAL_STRENGTH
normal_y = -gradient_y * NORMAL_STRENGTH
normal_z = np.ones_like(height)
length = np.sqrt(normal_x * normal_x + normal_y * normal_y + normal_z * normal_z)
normal = np.stack([normal_x / length, normal_y / length, normal_z / length], axis=-1) * 0.5 + 0.5
flat = np.array([0.5, 0.5, 1.0], dtype=np.float32)
normal = normal * mask_soft_4k[..., None] + flat * (1.0 - mask_soft_4k[..., None])
save_jpeg(normal, os.path.join(output_dir, "skin_normal.jpg"), quality=90)
print("height std inside mask:", round(float(height[mask_hard_4k].std()), 4))

mblab_detail = load(os.path.join(original_assets, "skin_detail.jpg"), 4096, "L")
high_pass = height - box_blur(height, 24)
scan_detail = np.clip(0.5 + high_pass * DETAIL_GAIN, 0.0, 1.0)
detail = scan_detail * mask_soft_4k + mblab_detail * (1.0 - mask_soft_4k)
save_jpeg(detail, os.path.join(output_dir, "skin_detail.jpg"), quality=90)
print("detail std scan / mblab:", round(float(scan_detail[mask_hard_4k].std()), 4), round(float(mblab_detail.std()), 4))

# 러프니스 (ORM 의 G)
baked_specular = fill_outside(load(os.path.join(work, "baked_specular.png"), 2048), mask_hard)
specular = baked_specular.mean(axis=2)
current_orm = load(os.path.join(original_assets, "skin_roughness.jpg"), 2048)
current_roughness = current_orm[..., 1]
specular_mean = float(specular[mask_hard].mean())
scan_roughness = np.clip(0.45 + 0.35 * (specular_mean - specular), 0.25, 0.95)
roughness = scan_roughness * mask_soft + current_roughness * (1.0 - mask_soft)
orm = np.stack([np.ones_like(roughness), roughness, np.zeros_like(roughness)], axis=-1)
save_jpeg(orm, os.path.join(output_dir, "skin_roughness.jpg"))
print("roughness mean inside mask:", round(float(scan_roughness[mask_hard].mean()), 3))
print("COMPOSED", output_dir)
