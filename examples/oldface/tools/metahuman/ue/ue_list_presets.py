import unreal
import os
import json
import traceback

# 메타휴먼 크리에이터 프리셋 목록과 피부 설정(텍스처 타입 / 러프니스 등)을 출력하고, 각 프리셋의 합성 알베도를 작은 PNG 로 내보낸다.
PRESET_ROOT = "/MetaHumanCharacter/Optional/Presets"
OUTPUT_DIR = os.environ.get("OLDFACE_PRESET_DIR", "D:/MetaHumanExport/Presets")

def log(message):
    unreal.log_warning("[OLDFACE] " + str(message))

try:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    registry = unreal.AssetRegistryHelpers.get_asset_registry()
    registry.scan_paths_synchronous([PRESET_ROOT], force_rescan=True)
    presets = [a for a in registry.get_assets_by_path(PRESET_ROOT, recursive=False) if str(a.asset_class_path.asset_name) == "MetaHumanCharacter"]
    log(f"presets {len(presets)}")
    summary = {}
    for asset_data in presets:
        name = str(asset_data.asset_name)
        character = asset_data.get_asset()
        try:
            skin = character.skin_settings
            skin_properties = skin.skin
            fields = {}
            for prop in ("face_texture_index", "body_texture_index", "u", "v", "roughness", "show_top_underwear", "face_texture_type", "body_texture_type"):
                try:
                    value = skin_properties.get_editor_property(prop)
                    fields[prop] = str(value)
                except Exception:
                    pass
            if not fields:
                fields["skin"] = str(skin_properties)[:300]
            freckles = str(skin.freckles)[:120]
            summary[name] = {"skin": fields, "freckles": freckles}
            log(f"{name}: {fields}")
        except Exception:
            log(f"{name}: skin read failed " + traceback.format_exc().splitlines()[-1])
        # 합성 얼굴 알베도 (프리셋에 저장된 텍스처)
        try:
            textures = character.get_editor_property("synthesized_face_textures")
            for key in textures.keys():
                if "Basecolor" in str(key) and "Animated" not in str(key):
                    texture = textures[key]
                    task = unreal.AssetExportTask()
                    task.object = texture
                    task.filename = os.path.join(OUTPUT_DIR, f"{name}_basecolor.png")
                    task.automated = True
                    task.replace_identical = True
                    task.prompt = False
                    task.exporter = unreal.TextureExporterPNG()
                    ok = unreal.Exporter.run_asset_export_task(task)
                    log(f"  {name} basecolor {(texture.blueprint_get_size_x(), texture.blueprint_get_size_y())} -> {ok}")
        except Exception:
            log(f"  {name} texture failed " + traceback.format_exc().splitlines()[-1])
    json.dump(summary, open(os.path.join(OUTPUT_DIR, "presets.json"), "w"), indent=1)
except Exception:
    log("failed: " + traceback.format_exc())
log("DONE")
unreal.SystemLibrary.quit_editor()
