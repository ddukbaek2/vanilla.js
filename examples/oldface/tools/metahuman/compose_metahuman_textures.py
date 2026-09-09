import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# UE 에서 내보낸 메타휴먼 캐릭터 텍스처(T_Face_Basecolor / Normal / Cavity, 플러그인 기본 눈 / 치아 / 속눈썹)를 샘플용으로 합성한다.
# 사용: python compose_metahuman_textures.py <캐릭터 텍스처 디렉토리> <플러그인 텍스처 디렉토리> <assets 디렉토리>
character_dir = sys.argv[1].rstrip("/\\") + "/"
plugin_dir = sys.argv[2].rstrip("/\\") + "/"
assets = sys.argv[3].rstrip("/\\") + "/"
SKIN_SIZE = 2048

def load(name, directory, mode="RGB"):
    return Image.open(directory + name + ".png").convert(mode)

albedo = load("T_Face_Basecolor", character_dir)
print("face basecolor", albedo.size)
albedo.resize((SKIN_SIZE, SKIN_SIZE), Image.LANCZOS).save(assets + "head_albedo.jpg", "JPEG", quality=92, optimize=True)
normal = load("T_Face_Normal", character_dir)
print("face normal", normal.size)
# UE 노멀맵은 DirectX(Y-) 규약이라 초록 채널을 뒤집어 glTF(Y+) 규약으로 맞춘다
normal_channels = normal.split()
normal = Image.merge("RGB", (normal_channels[0], normal_channels[1].point(lambda value: 255 - value), normal_channels[2]))
normal.resize((SKIN_SIZE, SKIN_SIZE), Image.LANCZOS).save(assets + "head_normal.jpg", "JPEG", quality=92, optimize=True)
cavity = np.asarray(load("T_Face_Cavity", character_dir, "L").resize((2048, 2048), Image.LANCZOS)).astype(np.float32) / 255.0
print("face cavity mean", cavity.mean().round(3))
# 러프니스(ORM G): 캐비티가 깊을수록 거칠게, 기본 0.55
roughness = np.clip(0.55 + 0.35 * (1.0 - cavity), 0.3, 0.95)
orm = np.stack([np.ones_like(roughness), roughness, np.zeros_like(roughness)], axis=-1)
Image.fromarray((orm * 255 + 0.5).astype(np.uint8), "RGB").save(assets + "head_roughness.jpg", "JPEG", quality=90, optimize=True)
# 캐비티 자체를 디테일 높이(밝을수록 높음)로 써서 모공 캐비티 음영을 만든다
Image.fromarray((np.clip(0.5 + (cavity - cavity.mean()) * 1.5, 0, 1) * 255 + 0.5).astype(np.uint8), "L").convert("RGB").save(assets + "skin_detail.jpg", "JPEG", quality=90, optimize=True)

# 눈 / 치아 / 속눈썹 (플러그인 기본)
sclera = load("T_EyeSclera_D", plugin_dir)
iris = load("T_Iris001_01_D", plugin_dir, "RGBA")
size = sclera.size[0]
radius = int(size * 0.17)
iris_scaled = iris.resize((radius * 2, radius * 2), Image.LANCZOS)
mask = Image.new("L", (radius * 2, radius * 2), 0)
ImageDraw.Draw(mask).ellipse((0, 0, radius * 2 - 1, radius * 2 - 1), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(3))
eye = sclera.copy()
eye.paste(iris_scaled.convert("RGB"), (size // 2 - radius, size // 2 - radius), mask)
eye.resize((1024, 1024), Image.LANCZOS).save(assets + "eye_albedo.jpg", "JPEG", quality=92, optimize=True)
load("T_Teeth_BaseColor", plugin_dir).resize((1024, 1024), Image.LANCZOS).save(assets + "teeth_albedo.jpg", "JPEG", quality=90, optimize=True)
coverage = load("T_Eyelashes_S_Sparse_Coverage", plugin_dir, "L").resize((1024, 1024), Image.LANCZOS)
lash = Image.merge("RGBA", (Image.new("L", coverage.size, 40), Image.new("L", coverage.size, 28), Image.new("L", coverage.size, 22), coverage))
lash.save(assets + "eyelash.png", optimize=True)
print("COMPOSED", assets)
