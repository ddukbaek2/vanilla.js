import unreal
import os
import traceback

# 캐릭터의 synthesized_face_textures 맵 내용을 조사하고 Texture2D 를 PNG 로 내보낸다.
CHARACTER_PATH = os.environ.get("OLDFACE_CHARACTER_PATH", "/Game/OldFace/OldMan.OldMan")
OUTPUT_DIR = os.environ.get("OLDFACE_TEXTURE_DIR", "D:/MetaHumanExport/CharacterTextures8K")

def log(message):
    unreal.log_warning("[OLDFACE] " + str(message))

try:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    character = unreal.load_asset(CHARACTER_PATH)
    for prop in ("synthesized_face_textures", "synthesized_face_textures_info", "body_textures", "high_res_body_textures_info", "has_high_resolution_textures"):
        try:
            value = character.get_editor_property(prop)
            log(f"{prop}: type {type(value).__name__} value {str(value)[:600]}")
        except Exception:
            log(f"{prop} failed: " + traceback.format_exc().splitlines()[-1])
    textures = character.get_editor_property("synthesized_face_textures")
    exported = 0
    try:
        for key in textures.keys():
            texture = textures[key]
            log(f"face texture {key}: {texture} size {(texture.blueprint_get_size_x(), texture.blueprint_get_size_y()) if texture else None}")
            if texture is None:
                continue
            task = unreal.AssetExportTask()
            task.object = texture
            task.filename = os.path.join(OUTPUT_DIR, f"{str(key).split('.')[-1]}.png")
            task.automated = True
            task.replace_identical = True
            task.prompt = False
            task.exporter = unreal.TextureExporterPNG()
            ok = unreal.Exporter.run_asset_export_task(task)
            log(f"  exported -> {ok}")
            exported += 1 if ok else 0
    except Exception:
        log("iterate failed: " + traceback.format_exc())
    log(f"exported {exported}")
except Exception:
    log("failed: " + traceback.format_exc())
log("DONE")
unreal.SystemLibrary.quit_editor()
