import os
import sys
import json
import numpy as np
from PIL import Image

# 메타휴먼 룩데브 텍스처를 샘플용으로 합성한다.
# - 피부: 마이크로 노멀(rgb) + 캐비티(a), 주름 마스크 아틀라스(4x4 타일 x RGBA 채널), 주름 노멀 / 색 아틀라스(2x2 타일)
# - 눈: 공막 색 / 노멀, 홍채 색 / 노멀, 눈꺼풀 차폐 알파(눈 차폐 메시 UV 기준 합성)
# - 치아 노멀, 그룸 카드 탄젠트 아틀라스
# UE 노멀맵은 DirectX(Y-) 규약이라 초록 채널을 뒤집는다.
# 사용: python compose_lookdev_textures.py <Lookdev> <플러그인 Textures> <캐릭터 텍스처(CM/WM)> <Grooms> <assets>
Image.MAX_IMAGE_PIXELS = None
lookdev = sys.argv[1].rstrip("/\\") + "/"
plugin = sys.argv[2].rstrip("/\\") + "/"
character = sys.argv[3].rstrip("/\\") + "/"
grooms = sys.argv[4].rstrip("/\\") + "/"
assets = sys.argv[5].rstrip("/\\") + "/"

def load(path, mode="RGB"):
    return Image.open(path).convert(mode)

def flip_green(image):
    channels = image.split()
    return Image.merge("RGB", (channels[0], channels[1].point(lambda value: 255 - value), channels[2]))

def save_jpeg(image, name, quality=92):
    image.save(assets + name, "JPEG", quality=quality, optimize=True)
    print(name, image.size)

# 마이크로 노멀 + 캐비티
micro_normal = flip_green(load(lookdev + "T_SkinMicroNormal.png"))
micro_cavity = load(lookdev + "T_SkinMicroNormal_cavity.png", "L")
micro = Image.merge("RGBA", (*micro_normal.split(), micro_cavity))
micro.save(assets + "skin_micro.png", optimize=True)
print("skin_micro.png", micro.size)

# 주름 마스크 아틀라스 (타일 순서는 wrinkles.json 의 채널 정의와 같아야 한다)
MASK_TILES = ["T_head_wm1_msk_01", "T_head_wm1_msk_02", "T_head_wm1_msk_03", "T_head_wm1_msk_04", "T_head_wm2_msk_01", "T_head_wm2_msk_02", "T_head_wm2_msk_03", "T_head_wm3_msk_01", "T_head_wm3_msk_02", "T_head_wm13_msk_01"]
TILE_SIZE = 1024
atlas = Image.new("RGBA", (TILE_SIZE * 4, TILE_SIZE * 4), (0, 0, 0, 0))
for index, name in enumerate(MASK_TILES):
    tile = load(lookdev + name + ".png", "RGBA").resize((TILE_SIZE, TILE_SIZE), Image.LANCZOS)
    # 04 / 03 처럼 마지막 채널이 비어 있는(255) 텍스처는 알파를 0 으로
    channels = list(tile.split())
    alpha = np.asarray(channels[3])
    if alpha.mean() > 250:
        channels[3] = Image.new("L", tile.size, 0)
    tile = Image.merge("RGBA", channels)
    # 셰이더 타일 좌표: x = index % 4, y = index / 4 (glTF UV 의 v = 0 이 이미지 첫 행이므로 위에서부터 채운다)
    column = index % 4
    row = index // 4
    atlas.paste(tile, (column * TILE_SIZE, row * TILE_SIZE))
atlas.save(assets + "wrinkle_masks.png", optimize=True)
print("wrinkle_masks.png", atlas.size)

# 주름 노멀 / 색 아틀라스 (2x2 타일: 0 좌하 = WM1, 1 우하 = WM2, 2 좌상 = WM3)
LAYER_SIZE = 2048
normal_atlas = Image.new("RGB", (LAYER_SIZE * 2, LAYER_SIZE * 2), (128, 128, 255))
color_atlas = Image.new("RGB", (LAYER_SIZE * 2, LAYER_SIZE * 2), (0, 0, 0))
for index in range(3):
    column = index % 2
    row = index // 2
    box = (column * LAYER_SIZE, row * LAYER_SIZE)
    wrinkle_normal = flip_green(load(character + f"T_Face_Normal_Animated_WM{index + 1}.png")).resize((LAYER_SIZE, LAYER_SIZE), Image.LANCZOS)
    normal_atlas.paste(wrinkle_normal, box)
    wrinkle_color = load(character + f"T_Face_Basecolor_Animated_CM{index + 1}.png").resize((LAYER_SIZE, LAYER_SIZE), Image.LANCZOS)
    color_atlas.paste(wrinkle_color, box)
save_jpeg(normal_atlas, "wrinkle_normal.jpg")
save_jpeg(color_atlas, "wrinkle_color.jpg")

# 눈: 공막 / 홍채
save_jpeg(load(plugin + "T_EyeSclera_D.png").resize((1024, 1024), Image.LANCZOS), "eye_sclera.jpg")
save_jpeg(flip_green(load(lookdev + "T_EyeSclera_N.png")).resize((1024, 1024), Image.LANCZOS), "eye_sclera_normal.jpg")
load(plugin + "T_Iris001_01_D.png", "RGBA").resize((1024, 1024), Image.LANCZOS).save(assets + "eye_iris.png", optimize=True)
flip_green(load(lookdev + "T_Eye_N.png")).save(assets + "eye_iris_normal.png", optimize=True)

# 눈꺼풀 차폐 알파 (눈 차폐 메시 UV: v 위 = 위 눈꺼풀 쪽 — 위 눈꺼풀 그림자는 진하고 넓게, 아래는 옅게)
size = 512
v = np.linspace(0.0, 1.0, size)[:, None]
u = np.linspace(0.0, 1.0, size)[None, :]
upper = np.clip((v - 0.62) / 0.38, 0.0, 1.0) ** 1.6 * 0.85
lower = np.clip((0.3 - v) / 0.3, 0.0, 1.0) ** 2.0 * 0.4
corner = np.clip((np.abs(u - 0.5) - 0.3) / 0.2, 0.0, 1.0) ** 1.5 * 0.5
darkness = np.clip(upper + lower + corner, 0.0, 1.0)
# glTF UV 의 v = 0 이 이미지 첫 행 (v 가 클수록 아래 행)
occlusion = Image.fromarray((darkness * 255 + 0.5).astype(np.uint8), "L")
Image.merge("RGBA", (occlusion, occlusion, occlusion, occlusion)).save(assets + "eye_occlusion.png", optimize=True)
print("eye_occlusion.png")

# 치아 노멀
teeth_normal_path = lookdev + "T_Teeth_Normal.png"
if os.path.exists(teeth_normal_path):
    save_jpeg(flip_green(load(teeth_normal_path)).resize((1024, 1024), Image.LANCZOS), "teeth_normal.jpg")

# 그룸 카드 탄젠트 (rgb 탄젠트 + a 가닥 좌표 — 원본 256)
for output_name, atlas_name in [("hair_tangent.png", "Hair_S_BobLayered_Hair_S_BobLayered_CardsAtlas_Tangent"), ("beard_tangent.png", "Goatee_L_Wavy_Goatee_L_Wavy_CardsAtlas_Tangent"), ("mustache_tangent.png", "Mustache_L_Wavy_Mustache_L_Wavy_CardsAtlas_Tangent"), ("eyebrows_tangent.png", "Eyebrows_M_Messy_Eyebrows_M_Messy_CardsAtlas_Tangent")]:
    load(grooms + atlas_name + ".png", "RGBA").save(assets + output_name, optimize=True)
    print(output_name)
print("COMPOSED")
