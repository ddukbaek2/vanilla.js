import os
import sys
import json
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

# 1단계 정면 렌더(scan_front.png / body_front.png)에서 FaceLandmarker 로 랜드마크 478개를 검출해 landmarks.json 으로 저장한다.
# 모델: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
scratch = sys.argv[1]
work = os.path.join(scratch, "wrap")
options = vision.FaceLandmarkerOptions(base_options=mp_python.BaseOptions(model_asset_path=os.path.join(scratch, "face_landmarker.task")), num_faces=1)
landmarker = vision.FaceLandmarker.create_from_options(options)
result_all = {}
for name in ("scan", "body"):
    image = mp.Image.create_from_file(os.path.join(work, name + "_front.png"))
    result = landmarker.detect(image)
    if not result.face_landmarks:
        raise SystemExit(name + ": no face detected")
    result_all[name] = [[l.x, l.y, l.z] for l in result.face_landmarks[0]]
    print(name, "landmarks:", len(result_all[name]))
json.dump(result_all, open(os.path.join(work, "landmarks.json"), "w"))
