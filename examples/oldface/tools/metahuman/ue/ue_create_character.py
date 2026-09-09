import unreal
import os
import traceback

# 메타휴먼 프리셋을 복제해 캐릭터를 만들고(피부 합성, 그룸 유지), 클라우드 오토리그 + 고해상도 텍스처를 요청한 뒤
# DNA(.dna) / 머리 스켈레탈 메시 / 머티리얼(텍스처)을 프로젝트와 외부 경로로 내보낸다.
PRESET_NAME = os.environ.get("OLDFACE_PRESET", "Walter")
CHARACTER_NAME = os.environ.get("OLDFACE_CHARACTER", "OldMan")
PACKAGE_PATH = "/Game/OldFace"
EXTERNAL_DIR = os.environ.get("OLDFACE_EXTERNAL_DIR", "D:/MetaHumanExport/Character")
RIG_TYPE = os.environ.get("OLDFACE_RIG_TYPE", "JOINTS_AND_BLENDSHAPES")
RIG_TYPE_FALLBACK = "JOINTS_ONLY"

def log(message):
    unreal.log_warning("[OLDFACE] " + str(message))

try:
    os.makedirs(EXTERNAL_DIR, exist_ok=True)
    subsystem = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
    asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
    character_path = f"{PACKAGE_PATH}/{CHARACTER_NAME}"
    if unreal.EditorAssetLibrary.does_asset_exist(character_path):
        unreal.EditorAssetLibrary.delete_asset(character_path)
    preset = unreal.load_asset(f"/MetaHumanCharacter/Optional/Presets/{PRESET_NAME}")
    if preset is None:
        raise RuntimeError(f"preset {PRESET_NAME} not found")
    character = asset_tools.duplicate_asset(CHARACTER_NAME, PACKAGE_PATH, preset)
    log(f"character {character} from preset {PRESET_NAME}")
    if not subsystem.try_add_object_to_edit(character):
        raise RuntimeError("cannot edit character")
    try:
        log(f"has high res textures before: {character.has_high_resolution_textures}")
        # 피부 텍스처 합성(로컬)
        try:
            subsystem.commit_skin_settings(character=character, skin_settings=character.skin_settings)
            log("skin committed")
        except Exception:
            log("skin commit failed: " + traceback.format_exc())
        # 오토리그 (클라우드)
        params = unreal.MetaHumanCharacterAutoRiggingRequestParams()
        params.blocking = True
        params.report_progress = False
        params.rig_type = getattr(unreal.MetaHumanRigType, RIG_TYPE, None) or getattr(unreal.MetaHumanRigType, RIG_TYPE_FALLBACK)
        log(f"rig type {params.rig_type} available {[n for n in dir(unreal.MetaHumanRigType) if n.isupper()]}")
        subsystem.request_auto_rigging(character=character, params=params)
        log(f"auto rigging returned, rigging state: {subsystem.get_rigging_state(character) if hasattr(subsystem, 'get_rigging_state') else 'n/a'}")
        # 고해상도 텍스처 (클라우드)
        texture_params = unreal.MetaHumanCharacterTextureRequestParams()
        texture_params.blocking = True
        texture_params.report_progress = False
        subsystem.request_texture_sources(character=character, params=texture_params)
        log(f"has high res textures after: {character.has_high_resolution_textures}")
        # DNA 내보내기 (프로젝트 + 외부 .dna)
        dna_params = unreal.MetaHumanDNAExportParams()
        dna_params.project_path = f"{PACKAGE_PATH}/Export"
        dna_params.external_path = EXTERNAL_DIR
        dna_params.dna_head = True
        dna_params.dna_body = False
        dna_params.overwrite_existing_assets = True
        unreal.MetaHumanCharacterExportBlueprintLibrary.export_dna(character, dna_params)
        log(f"dna export: {os.path.exists(os.path.join(EXTERNAL_DIR, CHARACTER_NAME + '_Head.dna'))} files {os.listdir(EXTERNAL_DIR)}")
        # 머리 스켈레탈 메시
        geo_params = unreal.MetaHumanGeometryExportParams()
        geo_params.project_path = f"{PACKAGE_PATH}/Export"
        geo_params.head_skeletal_mesh = True
        geo_params.body_skeletal_mesh = False
        geo_params.full_body_skeletal_mesh = False
        geo_params.overwrite_existing_assets = True
        unreal.MetaHumanCharacterExportBlueprintLibrary.export_geometry(character, geo_params)
        log(f"geometry export: head exists={unreal.EditorAssetLibrary.does_asset_exist(f'{PACKAGE_PATH}/Export/{CHARACTER_NAME}_Head.{CHARACTER_NAME}_Head')}")
        # 머티리얼 (텍스처 애셋)
        material_params = unreal.MetaHumanMaterialsExportParams()
        material_params.project_path = f"{PACKAGE_PATH}/Export"
        material_params.apply_as_overrides = False
        unreal.MetaHumanCharacterExportBlueprintLibrary.export_materials(character, material_params)
        log("materials exported")
    finally:
        if subsystem.is_object_added_for_editing(character):
            subsystem.remove_object_to_edit(character)
    unreal.EditorAssetLibrary.save_directory(PACKAGE_PATH, only_if_is_dirty=False, recursive=True)
    registry = unreal.AssetRegistryHelpers.get_asset_registry()
    assets = registry.get_assets_by_path(f"{PACKAGE_PATH}/Export", recursive=True)
    log(f"export folder assets: {len(assets)}")
    for asset_data in assets:
        log(f"  {asset_data.asset_class_path.asset_name} {asset_data.package_name}")
except Exception:
    log("failed: " + traceback.format_exc())
log("DONE")
unreal.SystemLibrary.quit_editor()
