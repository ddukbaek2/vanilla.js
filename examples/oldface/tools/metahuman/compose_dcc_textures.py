import sys
import numpy as np
from PIL import Image

# 메타휴먼 DCC 패키지(Maps/)의 눈 / 피부 SRMF 텍스처를 샘플용으로 합성한다.
# - Eyes_Color: 메타휴먼이 합성한 공막 + 홍채(캐릭터 실제 눈 색) → eye_sclera.jpg(전체) + eye_iris.png(중앙 홍채 원판 크롭)
# - Eyes_Normal: 공막 / 홍채 노멀 → eye_sclera_normal.jpg + eye_iris_normal.png (UE DirectX Y- → G 반전)
# - Head_SRMF: R 스펙큘러, G 러프니스 → head_specular.jpg(R), head_roughness.jpg(ORM: G 러프니스)
# 사용: python compose_dcc_textures.py <DCC/Maps> <assets> [홍채 UV 반경 = 0.14]
Image.MAX_IMAGE_PIXELS = None
maps = sys.argv[1].rstrip("/\\") + "/"
assets = sys.argv[2].rstrip("/\\") + "/"
iris_radius = float(sys.argv[3]) if len(sys.argv) > 3 else 0.14

def flip_green(image):
    channels = image.split()
    return Image.merge("RGB", (channels[0], channels[1].point(lambda value: 255 - value), channels[2]))

def center_crop(image, radius_uv):
    width, height = image.size
    half = int(width * radius_uv)
    return image.crop((width // 2 - half, height // 2 - half, width // 2 + half, height // 2 + half))

eyes_color = Image.open(maps + "Eyes_Color.png").convert("RGB")
eyes_color.resize((1024, 1024), Image.LANCZOS).save(assets + "eye_sclera.jpg", "JPEG", quality=92, optimize=True)
iris = center_crop(eyes_color, iris_radius).resize((1024, 1024), Image.LANCZOS)
iris.convert("RGBA").save(assets + "eye_iris.png", optimize=True)
eyes_normal = flip_green(Image.open(maps + "Eyes_Normal.png").convert("RGB"))
eyes_normal.resize((1024, 1024), Image.LANCZOS).save(assets + "eye_sclera_normal.jpg", "JPEG", quality=92, optimize=True)
center_crop(eyes_normal, iris_radius).resize((512, 512), Image.LANCZOS).save(assets + "eye_iris_normal.png", optimize=True)
print("eyes", eyes_color.size, "iris crop radius", iris_radius)

srmf = np.asarray(Image.open(maps + "Head_SRMF.png").convert("RGBA")).astype(np.float32) / 255.0
specular = srmf[..., 0]
roughness = srmf[..., 1]
Image.fromarray((specular * 255 + 0.5).astype(np.uint8), "L").convert("RGB").save(assets + "head_specular.jpg", "JPEG", quality=90, optimize=True)
orm = np.stack([np.ones_like(roughness), roughness, np.zeros_like(roughness)], axis=-1)
Image.fromarray((orm * 255 + 0.5).astype(np.uint8), "RGB").save(assets + "head_roughness.jpg", "JPEG", quality=90, optimize=True)
print("srmf specular mean", specular.mean().round(3), "roughness mean", roughness.mean().round(3))
print("COMPOSED")
