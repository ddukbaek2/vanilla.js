import unreal
import os
import traceback

# 프리셋마다 복제 → 피부 로컬 합성 → 머티리얼 내보내기 → 얼굴 알베도 PNG (나이 / 피부 상태 비교용) → 임시 애셋 삭제
PRESET_ROOT = "/MetaHumanCharacter/Optional/Presets"
SURVEY_PATH = "/Game/OldFace/Survey"
OUTPUT_DIR = os.environ.get("OLDFACE_PRESET_DIR", "D:/MetaHumanExport/Presets")
ONLY = [n.strip() for n in os.environ.get("OLDFACE_SURVEY_ONLY", "").split(",") if n.strip()]

def log(message):
    unreal.log_warning("[OLDFACE] " + str(message))

try:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    subsystem = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
    asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
    registry = unreal.AssetRegistryHelpers.get_asset_registry()
    registry.scan_paths_synchronous([PRESET_ROOT], force_rescan=True)
    presets = [a for a in registry.get_assets_by_path(PRESET_ROOT, recursive=False) if str(a.asset_class_path.asset_name) == "MetaHumanCharacter"]
    for asset_data in presets:
        name = str(asset_data.asset_name)
        if ONLY and name not in ONLY:
            continue
        if os.path.exists(os.path.join(OUTPUT_DIR, f"{name}_basecolor.png")):
            continue
        try:
            preset = asset_data.get_asset()
            character_path = f"{SURVEY_PATH}/{name}"
            if unreal.EditorAssetLibrary.does_asset_exist(character_path):
                unreal.EditorAssetLibrary.delete_asset(character_path)
            character = asset_tools.duplicate_asset(name, SURVEY_PATH, preset)
            if not subsystem.try_add_object_to_edit(character):
                log(f"{name}: cannot edit")
                continue
            try:
                subsystem.commit_skin_settings(character=character, skin_settings=character.skin_settings)
                texture_params = unreal.MetaHumanCharacterTextureRequestParams()
                texture_params.blocking = True
                texture_params.report_progress = False
                subsystem.request_texture_sources(character=character, params=texture_params)
                material_params = unreal.MetaHumanMaterialsExportParams()
                material_params.project_path = f"{SURVEY_PATH}/Export"
                material_params.apply_as_overrides = False
                unreal.MetaHumanCharacterExportBlueprintLibrary.export_materials(character, material_params)
            finally:
                if subsystem.is_object_added_for_editing(character):
                    subsystem.remove_object_to_edit(character)
            registry.scan_paths_synchronous([f"{SURVEY_PATH}/Export"], force_rescan=True)
            exported = False
            for texture_data in registry.get_assets_by_path(f"{SURVEY_PATH}/Export", recursive=True):
                if str(texture_data.asset_name) != "T_Face_Basecolor":
                    continue
                texture = texture_data.get_asset()
                task = unreal.AssetExportTask()
                task.object = texture
                task.filename = os.path.join(OUTPUT_DIR, f"{name}_basecolor.png")
                task.automated = True
                task.replace_identical = True
                task.prompt = False
                task.exporter = unreal.TextureExporterPNG()
                exported = unreal.Exporter.run_asset_export_task(task)
            log(f"{name}: basecolor exported {exported}")
            unreal.EditorAssetLibrary.delete_directory(f"{SURVEY_PATH}/Export")
            unreal.EditorAssetLibrary.delete_asset(character_path)
        except Exception:
            log(f"{name}: failed " + traceback.format_exc().splitlines()[-1])
except Exception:
    log("failed: " + traceback.format_exc())
log("DONE")
unreal.SystemLibrary.quit_editor()
