import unreal
import os
import traceback

# 메타휴먼 플러그인의 눈 / 치아 / 속눈썹 기본 텍스처를 PNG 로 내보낸다.
OUTPUT_DIR = "D:/MetaHumanExport/Textures"
ASSETS = [
    "/MetaHumanCharacter/Lookdev_UHM/Eye/Textures/T_EyeSclera_D",
    "/MetaHumanCharacter/Lookdev_UHM/Eye/Textures/T_EyeSclera_N",
    "/MetaHumanCharacter/Lookdev_UHM/Eye/Textures/T_Iris001_01_D",
    "/MetaHumanCharacter/Lookdev_UHM/Eye/Textures/T_Veins_D",
    "/MetaHumanCharacter/Lookdev_UHM/Teeth/Textures/T_Teeth_BaseColor",
    "/MetaHumanCharacter/Lookdev_UHM/Teeth/Textures/T_Teeth_Normal",
    "/MetaHumanCharacter/Lookdev_UHM/Skin/Textures/T_SkinMicroNormal",
    "/MetaHumanCharacter/Lookdev_UHM/Skin/Textures/T_skinMicro3_CAV",
]

def log(message):
    unreal.log_warning("[OLDFACE] " + str(message))

try:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    registry = unreal.AssetRegistryHelpers.get_asset_registry()
    for folder in ("/MetaHumanCharacter/Textures/Eyelashes", "/MetaHumanCharacter/Lookdev_UHM/Eye/Textures/Iris"):
        for asset_data in registry.get_assets_by_path(folder, recursive=True):
            ASSETS.append(str(asset_data.package_name))
    for path in ASSETS:
        texture = unreal.load_asset(path)
        if texture is None:
            log(f"missing {path}")
            continue
        task = unreal.AssetExportTask()
        task.object = texture
        task.filename = os.path.join(OUTPUT_DIR, texture.get_name() + ".png")
        task.automated = True
        task.replace_identical = True
        task.prompt = False
        task.exporter = unreal.TextureExporterPNG()
        ok = unreal.Exporter.run_asset_export_task(task)
        log(f"{texture.get_name()} {texture.blueprint_get_size_x()}x{texture.blueprint_get_size_y()} -> {ok}")
except Exception:
    log("failed: " + traceback.format_exc())
log("DONE")
unreal.SystemLibrary.quit_editor()
