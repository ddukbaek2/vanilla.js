import unreal
import os
import json
import traceback

# ARKit 매핑 애니메이션의 모든 커브(RigLogic 제어값)를 프레임별로 덤프한다.
OUTPUT_DIR = "D:/MetaHumanExport/Head"
ANIM_PATH = "/MetaHumanCharacter/Face/ARKit/AS_MetaHuman_ARKit_Mapping"
POSE_ASSET_PATH = "/MetaHumanCharacter/Face/ARKit/PA_MetaHuman_ARKit_Mapping"

def log(message):
    unreal.log_warning("[OLDFACE] " + str(message))

try:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    anim = unreal.load_asset(ANIM_PATH)
    pose_asset = unreal.load_asset(POSE_ASSET_PATH)
    pose_names = [str(n) for n in pose_asset.get_pose_names()]
    frame_count = unreal.AnimationLibrary.get_num_frames(anim)
    curve_names = [str(n) for n in unreal.AnimationLibrary.get_animation_curve_names(anim, unreal.RawCurveTrackTypes.RCT_FLOAT)]
    frame_rate = unreal.AnimationLibrary.get_rate_of_animation(anim) if hasattr(unreal.AnimationLibrary, "get_rate_of_animation") else 24.0
    curves = {}
    for name in curve_names:
        times, values = unreal.AnimationLibrary.get_float_keys(anim, name)
        times = [float(t) for t in times]
        values = [float(v) for v in values]
        sampled = []
        for frame in range(frame_count):
            time = frame / 24.0
            # 키가 프레임에 정확히 놓여 있으면 그 값, 아니면 가장 가까운 키
            best = min(range(len(times)), key=lambda k: abs(times[k] - time)) if times else None
            sampled.append(values[best] if best is not None and abs(times[best] - time) < 1e-3 else 0.0)
        curves[name] = sampled
    json.dump({"pose_names": pose_names, "frame_count": frame_count, "curves": curves}, open(os.path.join(OUTPUT_DIR, "arkit_curves.json"), "w"))
    active = [n for n, v in curves.items() if max(abs(x) for x in v) > 1e-4]
    log(f"curves {len(curve_names)} active {len(active)} frames {frame_count} sample {active[:6]}")
    jaw = [n for n in curve_names if "jawopen" in n.lower()]
    log(f"jaw curves {jaw} values at JawOpen frame {[round(curves[n][pose_names.index('JawOpen')], 3) for n in jaw]}")
except Exception:
    log("failed: " + traceback.format_exc())
log("DONE")
unreal.SystemLibrary.quit_editor()
