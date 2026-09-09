import unreal
import os
import traceback

# 품질 상향용 애셋 재내보내기.
# 1) 캐릭터 피부 설정의 텍스처 소스 해상도를 8K 로 올려 클라우드에서 다시 받고 머티리얼 / 텍스처 애셋을 다시 내보낸다.
# 2) 주름 마스크 / 마이크로 노멀 / 눈 / 치아 텍스처를 PNG 로, 마스터 머티리얼 / 인스턴스를 T3D 텍스트로 내보낸다.
CHARACTER_PATH = os.environ.get("OLDFACE_CHARACTER_PATH", "/Game/OldFace/OldMan.OldMan")
PACKAGE_PATH = "/Game/OldFace"
TEXTURE_DIR = os.environ.get("OLDFACE_TEXTURE_DIR", "D:/MetaHumanExport/CharacterTextures8K")
LOOKDEV_DIR = os.environ.get("OLDFACE_LOOKDEV_DIR", "D:/MetaHumanExport/Lookdev")
REQUEST_HIGH_RESOLUTION = os.environ.get("OLDFACE_REQUEST_8K", "1") == "1"

LOOKDEV_TEXTURES = [
    "/MetaHumanCharacter/Lookdev_UHM/Skin/Textures/Skin_Animated/T_head_wm1_msk_01",
    "/MetaHumanCharacter/Lookdev_UHM/Skin/Textures/Skin_Animated/T_head_wm1_msk_02",
    "/MetaHumanCharacter/Lookdev_UHM/Skin/Textures/Skin_Animated/T_head_wm1_msk_03",
    "/MetaHumanCharacter/Lookdev_UHM/Skin/Textures/Skin_Animated/T_head_wm1_msk_04",
    "/MetaHumanCharacter/Lookdev_UHM/Skin/Textures/Skin_Animated/T_head_wm1_msk_04a",
    "/MetaHumanCharacter/Lookdev_UHM/Skin/Textures/Skin_Animated/T_head_wm13_msk_01",
    "/MetaHumanCharacter/Lookdev_UHM/Skin/Textures/Skin_Animated/T_head_wm2_msk_01",
    "/MetaHumanCharacter/Lookdev_UHM/Skin/Textures/Skin_Animated/T_head_wm2_msk_02",
    "/MetaHumanCharacter/Lookdev_UHM/Skin/Textures/Skin_Animated/T_head_wm2_msk_03",
    "/MetaHumanCharacter/Lookdev_UHM/Skin/Textures/Skin_Animated/T_head_wm2_msk_03a",
    "/MetaHumanCharacter/Lookdev_UHM/Skin/Textures/Skin_Animated/T_head_wm3_msk_01",
    "/MetaHumanCharacter/Lookdev_UHM/Skin/Textures/Skin_Animated/T_head_wm3_msk_02",
    "/MetaHumanCharacter/Lookdev_UHM/Skin/Textures/T_SkinMicroNormal",
    "/MetaHumanCharacter/Lookdev_UHM/Skin/Textures/T_SkinMicroNormal_cavity",
    "/MetaHumanCharacter/Lookdev_UHM/Skin/Textures/T_SkinMicro3_N",
    "/MetaHumanCharacter/Lookdev_UHM/Skin/Textures/T_skinMicro3_CAV",
    "/MetaHumanCharacter/Lookdev_UHM/Skin/Textures/T_Skin_LUT",
    "/MetaHumanCharacter/Lookdev_UHM/Common/Textures/T_MicroDetail001_N",
    "/MetaHumanCharacter/Lookdev_UHM/Eye/Textures/T_EyeSclera_N",
    "/MetaHumanCharacter/Lookdev_UHM/Eye/Textures/T_Eye_N",
    "/MetaHumanCharacter/Lookdev_UHM/Eye/Textures/T_Shared_Eye_AO",
    "/MetaHumanCharacter/Lookdev_UHM/Eye/Textures/T_EyeEdge_Masks",
    "/MetaHumanCharacter/Lookdev_UHM/Teeth/Textures/T_Teeth_Normal",
    "/MetaHumanCharacter/Lookdev_UHM/Teeth/Textures/T_Teeth_DetailNormal",
    "/MetaHumanCharacter/Lookdev_UHM/Teeth/Textures/T_Teeth_SharpNormal",
    "/MetaHumanCharacter/Lookdev_UHM/Teeth/Textures/T_Teeth_Masks_001",
    "/MetaHumanCharacter/Lookdev_UHM/Teeth/Textures/T_Teeth_Masks_002",
]
LOOKDEV_MATERIALS = [
    "/MetaHumanCharacter/Lookdev_UHM/Skin/Materials/M_skin_unified",
    "/MetaHumanCharacter/Lookdev_UHM/Eye/Materials/M_eye_eyeball_unified",
    "/MetaHumanCharacter/Lookdev_UHM/Eye/Materials/M_eye_occlusion_unified",
    "/MetaHumanCharacter/Lookdev_UHM/Eye/Materials/M_eye_lacrimal_fluid_unified",
    "/MetaHumanCharacter/Lookdev_UHM/Hair/Materials/M_hair_unified",
    "/MetaHumanCharacter/Lookdev_UHM/Teeth/Materials/M_teeth_unified",
    "/MetaHumanCharacter/Lookdev_UHM/Skin/Material_Functions/MF_skin_microSkinDetails",
    f"{PACKAGE_PATH}/Export/OldMan_MaterialsExport/Face/Materials/MI_Face_Skin_LOD0",
    f"{PACKAGE_PATH}/Export/OldMan_MaterialsExport/Face/Materials/MI_Face_Eye_Left",
    f"{PACKAGE_PATH}/Export/OldMan_MaterialsExport/Face/Materials/MI_Face_Teeth",
    f"{PACKAGE_PATH}/Export/OldMan_MaterialsExport/Face/Materials/MI_Face_EyeShell",
    f"{PACKAGE_PATH}/Export/OldMan_MaterialsExport/Face/Materials/MI_Face_LacrimalFluid",
]

def log(message):
    unreal.log_warning("[OLDFACE] " + str(message))

def export_object(asset, path, exporter):
    task = unreal.AssetExportTask()
    task.object = asset
    task.filename = path
    task.automated = True
    task.replace_identical = True
    task.prompt = False
    task.exporter = exporter
    return unreal.Exporter.run_asset_export_task(task)

def export_texture_folder(package_path, output_dir):
    registry = unreal.AssetRegistryHelpers.get_asset_registry()
    registry.scan_paths_synchronous([package_path], force_rescan=True)
    exported = 0
    for asset_data in registry.get_assets_by_path(package_path, recursive=True):
        if str(asset_data.asset_class_path.asset_name) != "Texture2D":
            continue
        texture = asset_data.get_asset()
        ok = export_object(texture, os.path.join(output_dir, texture.get_name() + ".png"), unreal.TextureExporterPNG())
        size = (texture.blueprint_get_size_x(), texture.blueprint_get_size_y()) if hasattr(texture, "blueprint_get_size_x") else "?"
        log(f"texture {texture.get_name()} {size} -> {ok}")
        exported += 1 if ok else 0
    return exported

def export_lookdev():
    for path in LOOKDEV_TEXTURES:
        if os.path.exists(os.path.join(LOOKDEV_DIR, path.split("/")[-1] + ".png")):
            continue
        texture = unreal.load_asset(path)
        if texture is None:
            log(f"missing {path}")
            continue
        ok = export_object(texture, os.path.join(LOOKDEV_DIR, texture.get_name() + ".png"), unreal.TextureExporterPNG())
        log(f"lookdev texture {texture.get_name()} -> {ok}")
    for path in LOOKDEV_MATERIALS:
        material = unreal.load_asset(path)
        if material is None:
            log(f"missing {path}")
            continue
        ok = export_object(material, os.path.join(LOOKDEV_DIR, material.get_name() + ".t3d"), unreal.ObjectExporterT3D())
        log(f"material t3d {material.get_name()} -> {ok}")
        if isinstance(material, unreal.MaterialInstance):
            try:
                scalars = {str(p.parameter_info.name): p.parameter_value for p in material.scalar_parameter_values}
                vectors = {str(p.parameter_info.name): [p.parameter_value.r, p.parameter_value.g, p.parameter_value.b, p.parameter_value.a] for p in material.vector_parameter_values}
                textures = {str(p.parameter_info.name): (p.parameter_value.get_path_name() if p.parameter_value else None) for p in material.texture_parameter_values}
                import json
                json.dump({"parent": material.parent.get_path_name() if material.parent else None, "scalars": scalars, "vectors": vectors, "textures": textures}, open(os.path.join(LOOKDEV_DIR, material.get_name() + ".json"), "w"), indent=1)
                log(f"  instance params scalars {len(scalars)} vectors {len(vectors)} textures {len(textures)}")
            except Exception:
                log("  instance params failed: " + traceback.format_exc().splitlines()[-1])

try:
    os.makedirs(TEXTURE_DIR, exist_ok=True)
    os.makedirs(LOOKDEV_DIR, exist_ok=True)
    # 8K 텍스처 재요청 → 머티리얼 / 텍스처 애셋 재내보내기 → PNG
    if REQUEST_HIGH_RESOLUTION:
        subsystem = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
        character = unreal.load_asset(CHARACTER_PATH)
        if not subsystem.try_add_object_to_edit(character):
            raise RuntimeError("cannot edit character")
        try:
            skin = character.skin_settings
            resolutions = skin.desired_texture_sources_resolutions
            names = [p for p in dir(resolutions) if not p.startswith("_") and p not in ("assign", "cast", "copy", "export_text", "get_editor_property", "import_text", "set_editor_properties", "set_editor_property", "static_struct", "to_dict", "to_tuple")]
            log(f"resolution fields {names}")
            for name in names:
                try:
                    resolutions.set_editor_property(name, unreal.RequestTextureResolution.RES8K)
                except Exception:
                    log(f"  cannot set {name}")
            skin.desired_texture_sources_resolutions = resolutions
            subsystem.commit_skin_settings(character=character, skin_settings=skin)
            log("skin settings committed with 8K")
            texture_params = unreal.MetaHumanCharacterTextureRequestParams()
            texture_params.blocking = True
            texture_params.report_progress = False
            subsystem.request_texture_sources(character=character, params=texture_params)
            log(f"has high res textures: {character.has_high_resolution_textures}")
            material_params = unreal.MetaHumanMaterialsExportParams()
            material_params.project_path = f"{PACKAGE_PATH}/Export"
            material_params.apply_as_overrides = False
            unreal.MetaHumanCharacterExportBlueprintLibrary.export_materials(character, material_params)
            log("materials exported")
        finally:
            if subsystem.is_object_added_for_editing(character):
                subsystem.remove_object_to_edit(character)
        unreal.EditorAssetLibrary.save_directory(PACKAGE_PATH, only_if_is_dirty=False, recursive=True)
        count = export_texture_folder(f"{PACKAGE_PATH}/Export/OldMan_MaterialsExport/Face", TEXTURE_DIR)
        log(f"exported {count} face textures to {TEXTURE_DIR}")
    # 룩데브 텍스처 / 머티리얼 (캐릭터와 무관 — 텍스처 하나가 내보내기 중 크래시를 내므로 마지막에)
    export_lookdev()
except Exception:
    log("failed: " + traceback.format_exc())
log("DONE")
unreal.SystemLibrary.quit_editor()
