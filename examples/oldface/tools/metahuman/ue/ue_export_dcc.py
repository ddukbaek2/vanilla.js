import unreal
import os
import traceback

# DCC 패키지 내보내기. (고해상도 텍스처 소스가 파일로 나오는지 확인하기 위한 경로)
CHARACTER_PATH = os.environ.get("OLDFACE_CHARACTER_PATH", "/Game/OldFace/OldMan.OldMan")
OUTPUT_DIR = os.environ.get("OLDFACE_DCC_DIR", "D:/MetaHumanExport/DCC")

def log(message):
    unreal.log_warning("[OLDFACE] " + str(message))

try:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    character = unreal.load_asset(CHARACTER_PATH)
    subsystem = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
    if not subsystem.try_add_object_to_edit(character):
        raise RuntimeError("cannot edit character")
    try:
        params = unreal.MetaHumanDCCExportParams()
        params.external_path = OUTPUT_DIR
        params.bake_make_up = False
        params.compress_in_zip_file = False
        params.archive_name = "OldMan"
        unreal.MetaHumanCharacterExportBlueprintLibrary.export_dcc(character, params)
        log("dcc exported")
    finally:
        if subsystem.is_object_added_for_editing(character):
            subsystem.remove_object_to_edit(character)
    for root, directories, files in os.walk(OUTPUT_DIR):
        for name in files:
            path = os.path.join(root, name)
            log(f"file {path} {os.path.getsize(path)}")
except Exception:
    log("failed: " + traceback.format_exc())
log("DONE")
unreal.SystemLibrary.quit_editor()
