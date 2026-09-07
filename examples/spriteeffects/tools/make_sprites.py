import math
import os
import sys
from PIL import Image, ImageDraw

# 스프라이트 연출 샘플용 절차적 픽셀 스프라이트 생성. (외부 애셋 없이 코드로 그린다)
# - slime.png   : 64x64 x 8 프레임 가로 시트. (숨쉬는 슬라임 — 눌리고 늘어남)
# - coin.png    : 48x48 x 8 프레임 가로 시트. (회전하는 금화)
# - bat.png     : 64x48 x 4 프레임 가로 시트. (날개짓 박쥐)
# - emblem.png  : 160x160 단일. (V 방패 문장)
# - star.png    : 64x64 단일. (별)
# - gem.png     : 64x64 단일. (보석)
# 사용: python make_sprites.py <출력 디렉토리>
output_directory = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "assets")
os.makedirs(output_directory, exist_ok=True)
PIXEL = 4  # 픽셀 아트 배율. (작게 그린 뒤 최근접 확대)


def upscale(image):
    return image.resize((image.width * PIXEL, image.height * PIXEL), Image.NEAREST)


def make_slime():
    frames = []
    for frame_index in range(8):
        phase = frame_index / 8 * math.tau
        squash = 1 + math.sin(phase) * 0.12
        image = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        width = 12 * squash
        height = 10 / squash
        left = 8 - width / 2
        top = 14 - height
        draw.ellipse((left, top, left + width, 14), fill=(72, 196, 112, 255))
        draw.ellipse((left + 1, top + 1, left + width - 1, 13), fill=(104, 226, 140, 255))
        draw.ellipse((left + width * 0.22, top + height * 0.18, left + width * 0.42, top + height * 0.4), fill=(236, 255, 240, 255))
        eye_y = top + height * 0.45
        draw.rectangle((left + width * 0.32, eye_y, left + width * 0.32 + 1, eye_y + 2), fill=(20, 40, 30, 255))
        draw.rectangle((left + width * 0.62, eye_y, left + width * 0.62 + 1, eye_y + 2), fill=(20, 40, 30, 255))
        draw.line((left + width * 0.42, eye_y + 3.5, left + width * 0.56, eye_y + 3.5), fill=(20, 40, 30, 255))
        draw.line((left + 1, 14, left + width - 1, 14), fill=(40, 120, 70, 255))
        frames.append(upscale(image))
    sheet = Image.new("RGBA", (64 * 8, 64), (0, 0, 0, 0))
    for frame_index, frame in enumerate(frames):
        sheet.paste(frame, (frame_index * 64, 0))
    sheet.save(os.path.join(output_directory, "slime.png"), optimize=True)


def make_coin():
    frames = []
    for frame_index in range(8):
        phase = frame_index / 8 * math.tau
        width = max(1.5, abs(math.cos(phase)) * 10)
        image = Image.new("RGBA", (12, 12), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        left = 6 - width / 2
        is_back = math.cos(phase) < 0
        rim = (176, 128, 32, 255)
        face = (244, 200, 72, 255) if not is_back else (220, 172, 52, 255)
        draw.ellipse((left, 1, left + width, 11), fill=rim)
        if width > 3:
            draw.ellipse((left + 1, 2, left + width - 1, 10), fill=face)
        if width > 6 and not is_back:
            draw.rectangle((5, 4, 6, 8), fill=(190, 140, 40, 255))
            draw.ellipse((left + 1.5, 2.5, left + 3.5, 4.5), fill=(255, 240, 170, 255))
        frames.append(upscale(image))
    sheet = Image.new("RGBA", (48 * 8, 48), (0, 0, 0, 0))
    for frame_index, frame in enumerate(frames):
        sheet.paste(frame, (frame_index * 48, 0))
    sheet.save(os.path.join(output_directory, "coin.png"), optimize=True)


def make_bat():
    frames = []
    for frame_index in range(4):
        flap = [0, 2, 4, 2][frame_index]
        image = Image.new("RGBA", (16, 12), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        body = (72, 52, 96, 255)
        wing = (96, 72, 128, 255)
        draw.polygon([(1, 3 + flap), (6, 6), (6, 9), (2, 8 + flap * 0.5)], fill=wing)
        draw.polygon([(15, 3 + flap), (10, 6), (10, 9), (14, 8 + flap * 0.5)], fill=wing)
        draw.ellipse((5, 4, 11, 10), fill=body)
        draw.polygon([(6, 5), (6, 2), (8, 4)], fill=body)
        draw.polygon([(10, 5), (10, 2), (8, 4)], fill=body)
        draw.point((7, 6), fill=(255, 220, 90, 255))
        draw.point((9, 6), fill=(255, 220, 90, 255))
        frames.append(upscale(image))
    sheet = Image.new("RGBA", (64 * 4, 48), (0, 0, 0, 0))
    for frame_index, frame in enumerate(frames):
        sheet.paste(frame, (frame_index * 64, 0))
    sheet.save(os.path.join(output_directory, "bat.png"), optimize=True)


def make_emblem():
    image = Image.new("RGBA", (40, 40), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    shield = [(4, 4), (36, 4), (36, 20), (20, 37), (4, 20)]
    draw.polygon(shield, fill=(212, 176, 106, 255))
    inner = [(7, 7), (33, 7), (33, 19), (20, 33), (7, 19)]
    draw.polygon(inner, fill=(38, 30, 22, 255))
    draw.polygon([(11, 10), (16, 10), (20, 24), (24, 10), (29, 10), (22, 30), (18, 30)], fill=(242, 236, 226, 255))
    draw.rectangle((9, 8, 31, 8), fill=(255, 240, 200, 255))
    upscale(image).save(os.path.join(output_directory, "emblem.png"), optimize=True)


def make_star():
    image = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    points = []
    for point_index in range(10):
        angle = -math.pi / 2 + point_index * math.pi / 5
        radius = 7.5 if point_index % 2 == 0 else 3.2
        points.append((8 + math.cos(angle) * radius, 8.5 + math.sin(angle) * radius))
    draw.polygon(points, fill=(255, 214, 82, 255))
    draw.polygon([(8, 3), (9.5, 6.5), (8, 8), (6.5, 6.5)], fill=(255, 244, 190, 255))
    upscale(image).save(os.path.join(output_directory, "star.png"), optimize=True)


def make_gem():
    image = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.polygon([(3, 5), (13, 5), (15, 8), (8, 15), (1, 8)], fill=(80, 170, 255, 255))
    draw.polygon([(5, 5), (11, 5), (12, 8), (8, 13), (4, 8)], fill=(130, 205, 255, 255))
    draw.polygon([(5, 5), (8, 5), (7, 8), (4, 8)], fill=(210, 240, 255, 255))
    draw.line((1, 8, 15, 8), fill=(60, 120, 220, 255))
    upscale(image).save(os.path.join(output_directory, "gem.png"), optimize=True)


make_slime()
make_coin()
make_bat()
make_emblem()
make_star()
make_gem()
print("sprites written to", output_directory)
