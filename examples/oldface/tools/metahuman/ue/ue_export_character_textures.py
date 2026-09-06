import unreal
import os
import traceback

# 프로젝트 Export 폴더(머티리얼 내보내기 결과)와 캐릭터가 참조하는 Texture2D 를 PNG 로 내보낸다.
PACKAGE_PATH = os.environ.get("OLDFACE_EXPORT_PATH", "/Game/OldFace/Export")
OUTPUT_DIR = os.environ.get("OLDFACE_TEXTURE_DIR", "D:/MetaHumanExport/CharacterTextures")

def log(message):
    unreal.log_warning("[OLDFACE] " + str(message))

try:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    registry = unreal.AssetRegistryHelpers.get_asset_registry()
    registry.scan_paths_synchronous([PACKAGE_PATH], force_rescan=True)
    assets = registry.get_assets_by_path(PACKAGE_PATH, recursive=True)
    log(f"assets under {PACKAGE_PATH}: {len(assets)}")
    exported = 0
    for asset_data in assets:
        class_name = str(asset_data.asset_class_path.asset_name)
        if class_name not in ("Texture2D",):
            log(f"skip {class_name} {asset_data.package_name}")
            continue
        texture = asset_data.get_asset()
        task = unreal.AssetExportTask()
        task.object = texture
        task.filename = os.path.join(OUTPUT_DIR, texture.get_name() + ".png")
        task.automated = True
        task.replace_identical = True
        task.prompt = False
        task.exporter = unreal.TextureExporterPNG()
        ok = unreal.Exporter.run_asset_export_task(task)
        exported += 1 if ok else 0
        log(f"texture {texture.get_name()} -> {ok}")
    log(f"exported {exported} textures to {OUTPUT_DIR}")
except Exception:
    log("failed: " + traceback.format_exc())
log("DONE")
unreal.SystemLibrary.quit_editor()
