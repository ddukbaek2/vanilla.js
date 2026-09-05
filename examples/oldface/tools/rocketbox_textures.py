import os
import sys
import numpy as np
from PIL import Image

# Microsoft Rocketbox 아바타 텍스처(TGA 2K) → 샘플용 텍스처.
# 사용: python rocketbox_textures.py <Textures 디렉토리> <prefix(m009 등)> <출력 디렉토리>
# - color → albedo JPEG, normal → JPEG, specular → ORM(G = 러프니스) JPEG, opacity(RGBA) → 헤어 카드 PNG 1K
texture_dir = sys.argv[1]
prefix = sys.argv[2]
output_dir = sys.argv[3]
os.makedirs(output_dir, exist_ok=True)
for part in ("head", "body"):
    Image.open(os.path.join(texture_dir, "%s_%s_color.tga" % (prefix, part))).convert("RGB").save(os.path.join(output_dir, "%s_albedo.jpg" % part), "JPEG", quality=92, optimize=True)
    Image.open(os.path.join(texture_dir, "%s_%s_normal.tga" % (prefix, part))).convert("RGB").save(os.path.join(output_dir, "%s_normal.jpg" % part), "JPEG", quality=92, optimize=True)
    specular = np.asarray(Image.open(os.path.join(texture_dir, "%s_%s_specular.tga" % (prefix, part))).convert("L")).astype(np.float32) / 255.0
    roughness = np.clip(0.85 - specular * 0.7, 0.2, 0.95)
    orm = np.stack([np.ones_like(roughness), roughness, np.zeros_like(roughness)], axis=-1)
    Image.fromarray((orm * 255 + 0.5).astype(np.uint8), "RGB").save(os.path.join(output_dir, "%s_roughness.jpg" % part), "JPEG", quality=90, optimize=True)
opacity = Image.open(os.path.join(texture_dir, "%s_opacity_color.tga" % prefix)).convert("RGBA")
opacity.resize((1024, 1024), Image.LANCZOS).save(os.path.join(output_dir, "hair.png"), optimize=True)
print("CONVERTED", output_dir)
