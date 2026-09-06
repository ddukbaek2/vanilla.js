import sys
import numpy as np
from PIL import Image

# 그룸 카드 아틀라스(Layout2: Attribute R = 커버리지, G = 깊이)에서 샘플용 RGBA 텍스처를 만든다.
# 색은 그룸 머티리얼 파라미터 대신 지정한 기본색을 쓰고, 깊이로 약간의 명암 변화를 준다.
# 사용: python compose_hair_textures.py <Grooms 디렉토리> <assets 디렉토리>
grooms = sys.argv[1].rstrip("/\\") + "/"
assets = sys.argv[2].rstrip("/\\") + "/"
PARTS = [
    # (출력 이름, 아틀라스 이름, 기본색 sRGB, 출력 크기, 커버리지 배율)
    ("hair.png", "Hair_S_BobLayered_Hair_S_BobLayered_CardsAtlas_Attribute", (168, 162, 154), 2048, 1.3),
    ("beard.png", "Goatee_L_Wavy_Goatee_L_Wavy_CardsAtlas_Attribute", (172, 166, 158), 2048, 1.9),
    ("eyebrows.png", "Eyebrows_M_Messy_Eyebrows_M_Messy_CardsAtlas_Attribute", (118, 108, 98), 1024, 1.6),
    ("mustache.png", "Mustache_L_Wavy_Mustache_L_Wavy_CardsAtlas_Attribute", (172, 166, 158), 2048, 2.2),
]
for output_name, atlas_name, color, size, coverage_scale in PARTS:
    atlas = np.asarray(Image.open(grooms + atlas_name + ".png").convert("RGBA")).astype(np.float32) / 255.0
    coverage = atlas[..., 0]
    depth = atlas[..., 1]
    # Tangent 아틀라스 알파 = 가닥 방향 좌표(뿌리 0 → 끝 1). 뿌리 쪽을 어둡게 해 볼륨감을 준다.
    tangent = Image.open(grooms + atlas_name.replace("_Attribute", "_Tangent") + ".png").convert("RGBA").resize(atlas.shape[1::-1], Image.BILINEAR)
    coordinate = np.asarray(tangent).astype(np.float32)[..., 3] / 255.0
    shade = (0.55 + 0.45 * depth) * (0.72 + 0.28 * coordinate)
    rgb = np.stack([np.full_like(coverage, color[channel] / 255.0) * shade for channel in range(3)], axis=-1)
    # 커버리지를 알파로 (알파 테스트 0.5 기준이라 가는 가닥이 남도록 파트별 배율로 키운다)
    alpha = np.clip(coverage * coverage_scale, 0.0, 1.0)
    image = Image.fromarray((np.concatenate([rgb, alpha[..., None]], axis=-1) * 255 + 0.5).astype(np.uint8), "RGBA")
    if image.size[0] != size:
        image = image.resize((size, size), Image.LANCZOS)
    image.save(assets + output_name, optimize=True)
    print(output_name, image.size, "alpha>0.5 ratio", float((alpha > 0.5).mean()).__round__(3))
