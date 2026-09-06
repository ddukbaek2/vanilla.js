import unreal
import os
import json
import traceback

# OldFaceTools C++ 모듈로 DNA 지오메트리와 RigLogic 포즈(ARKit 매핑 커브)를 덤프한다.
# 환경 변수: OLDFACE_DNA_FILE(.dna 경로) 또는 OLDFACE_FACE_MESH(스켈레탈 메시 애셋 경로), OLDFACE_DUMP_DIR(출력)
OUTPUT_DIR = os.environ.get("OLDFACE_DUMP_DIR", "D:/MetaHumanExport/Dump")
DNA_FILE = os.environ.get("OLDFACE_DNA_FILE", "")
FACE_MESH_PATH = os.environ.get("OLDFACE_FACE_MESH", "/MetaHumanCharacter/Face/SKM_Face.SKM_Face")
CURVES_PATH = "D:/MetaHumanExport/Head/arkit_curves.json"

def log(message):
    unreal.log_warning("[OLDFACE] " + str(message))

try:
    library = unreal.OldFaceRigLogicLibrary
    if DNA_FILE:
        dna = library.load_dna_file(DNA_FILE)
        log(f"dna from file {DNA_FILE}: {dna}")
    else:
        mesh = unreal.load_asset(FACE_MESH_PATH)
        dna = library.get_dna_from_skeletal_mesh(mesh)
        log(f"dna from mesh {FACE_MESH_PATH}: {dna}")
    if dna is None:
        raise RuntimeError("no DNA")
    log(f"dump geometry: {library.dump_geometry(dna, OUTPUT_DIR)}")
    curves = json.load(open(CURVES_PATH))
    pose_names = curves["pose_names"]
    frame_count = curves["frame_count"]
    names = [n for n in curves["curves"].keys() if n.lower().startswith("ctrl_expressions")]
    flat = []
    for frame in range(frame_count):
        for name in names:
            flat.append(float(curves["curves"][name][frame]))
    log(f"evaluate poses: controls {len(names)} frames {frame_count}: {library.evaluate_poses(dna, names, flat, frame_count, OUTPUT_DIR)}")
    json.dump({"pose_names": pose_names[:frame_count]}, open(os.path.join(OUTPUT_DIR, "pose_names.json"), "w"))
except Exception:
    log("failed: " + traceback.format_exc())
log("DONE")
unreal.SystemLibrary.quit_editor()
