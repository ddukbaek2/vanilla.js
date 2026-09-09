import unreal
import os
import traceback

# 그룸 바인딩 소스인 레거시 그룸 머리 스켈레탈 메시를 FBX 로 내보내고, 캐릭터의 슬롯 선택(워드로브 아이템)을 출력한다.
CHARACTER_PATH = os.environ.get("OLDFACE_CHARACTER_PATH", "/Game/OldFace/OldMan.OldMan")
OUTPUT_DIR = os.environ.get("OLDFACE_GROOM_DIR", "D:/MetaHumanExport/Grooms")
HEADS = ["/MetaHumanCharacter/Optional/Grooms/GroomMesh/SKM_Groom_Head_Legacy01.SKM_Groom_Head_Legacy01", "/MetaHumanCharacter/Optional/Grooms/GroomMesh/SKM_Groom_Head_Legacy02.SKM_Groom_Head_Legacy02"]

def log(message):
    unreal.log_warning("[OLDFACE] " + str(message))

try:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    for path in HEADS:
        mesh = unreal.load_asset(path)
        task = unreal.AssetExportTask()
        task.object = mesh
        task.filename = os.path.join(OUTPUT_DIR, mesh.get_name() + ".fbx")
        options = unreal.FbxExportOption()
        options.level_of_detail = False
        options.collision = False
        options.export_morph_targets = False
        options.export_preview_mesh = False
        task.options = options
        task.automated = True
        task.replace_identical = True
        task.prompt = False
        task.exporter = unreal.SkeletalMeshExporterFBX()
        ok = unreal.Exporter.run_asset_export_task(task)
        log(f"exported {path} -> {task.filename}: {ok}")
    character = unreal.load_asset(CHARACTER_PATH)
    collection = character.get_editor_property("internal_collection")
    instance = collection.get_editor_property("default_instance")
    for slot in collection.get_slot_names():
        try:
            data = instance.get_slot_selection_data(slot)
            log(f"slot {slot}: {data}")
        except Exception:
            log(f"slot {slot}: read failed " + traceback.format_exc().splitlines()[-1])
        try:
            keys = collection.get_item_keys_for_slot(slot)
            log(f"  slot {slot} items: {[str(collection.get_item_display_name(k)) for k in keys]}")
        except Exception:
            log(f"  slot {slot} items failed " + traceback.format_exc().splitlines()[-1])
except Exception:
    log("failed: " + traceback.format_exc())
log("DONE")
unreal.SystemLibrary.quit_editor()
