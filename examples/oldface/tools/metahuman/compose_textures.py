import sys
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# UE 에서 내보낸 메타휴먼 기본 텍스처(PNG)를 샘플용으로 합성한다.
# 사용: python compose_textures.py <UE 텍스처 디렉토리> <assets 디렉토리>
# - eye_albedo.jpg: 공막 맵 중앙(방사형 눈 UV, 반경 0.17)에 홍채 합성
# - teeth_albedo.jpg, eyelash.png(커버리지 → 알파), head_albedo.jpg(피부색 자리표시자 — 코어 데이터 설치 후 합성 텍스처로 교체)
textures = sys.argv[1].rstrip("/\\") + "/"
assets = sys.argv[2].rstrip("/\\") + "/"
sclera = Image.open(textures + "T_EyeSclera_D.png").convert("RGB")
iris = Image.open(textures + "T_Iris001_01_D.png").convert("RGBA")
size = sclera.size[0]
radius = int(size * 0.17)
iris_scaled = iris.resize((radius * 2, radius * 2), Image.LANCZOS)
mask = Image.new("L", (radius * 2, radius * 2), 0)
ImageDraw.Draw(mask).ellipse((0, 0, radius * 2 - 1, radius * 2 - 1), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(3))
eye = sclera.copy()
eye.paste(iris_scaled.convert("RGB"), (size // 2 - radius, size // 2 - radius), mask)
eye.resize((1024, 1024), Image.LANCZOS).save(assets + "eye_albedo.jpg", "JPEG", quality=92, optimize=True)
Image.open(textures + "T_Teeth_BaseColor.png").convert("RGB").resize((1024, 1024), Image.LANCZOS).save(assets + "teeth_albedo.jpg", "JPEG", quality=90, optimize=True)
coverage = Image.open(textures + "T_Eyelashes_S_Thin_Coverage.png").convert("L").resize((1024, 1024), Image.LANCZOS)
lash = Image.merge("RGBA", (Image.new("L", coverage.size, 40), Image.new("L", coverage.size, 28), Image.new("L", coverage.size, 22), coverage))
lash.save(assets + "eyelash.png", optimize=True)
rng = np.random.default_rng(3)
noise = rng.normal(0.0, 0.012, (512, 512, 1)).astype(np.float32)
skin = np.clip(np.array([0.72, 0.53, 0.44], dtype=np.float32) + noise, 0, 1)
Image.fromarray((skin * 255).astype(np.uint8), "RGB").save(assets + "head_albedo.jpg", "JPEG", quality=90)
print("COMPOSED", assets)
