# OLD FACE wrap 파이프라인

Lee Perry-Smith 두상 스캔(CC BY 3.0)의 형상과 피부에 MB-Lab 1.8(AGPL-3.0)의 골격 / 눈알 / 치아 / 혀 / 표정 단위 셰이프키 81종을 입히는 스크립트 묶음이다.
작업 디렉토리(`<scratch>`)에는 `scan/head.glb` 와 텍스처 4장(head_albedo / head_normal / head_specular / head_displacement), MB-Lab 소스(`mblab/animate1978-MB-Lab-063bff0`), `face_landmarker.task` 가 있어야 하고, MB-Lab 애드온은 Blender 사용자 애드온 경로에 설치돼 있어야 한다.

실행 순서 (Blender 5.1 헤드리스 + 시스템 Python 3.10 / mediapipe / Pillow / numpy):

1. `blender -b --python stage1_scene.py -- <scratch>` — 스캔 임포트 + MB-Lab 캐릭터 생성(finalize) + 정면 직교 렌더 2장 + `stage1.blend`
2. `python detect_landmarks.py <scratch>` — 두 렌더에서 랜드마크 478개 검출
3. `blender -b --python stage2_wrap.py -- <scratch>` — 유사 변환 + 두개골 앵커 + 3D 박판 스플라인 + 표면 투영, 셰이프키 / 본 동일 적용 → `stage2.blend`
4. `python age_scan_textures.py <scratch>` — 스캔 UV 공간에서 알베도 노화(흰 수염 / 검버섯 / 홍조 / 주름 음영) + 주름 골 높이맵
5. `blender -b --python stage2b_age_sag.py -- <scratch>` — 노화 처짐 모프를 기본 형상과 셰이프키에 영구 적용
6. `blender -b --python stage3_bake.py -- <scratch>` — Cycles selected-to-active 로 알베도 / 스페큘러 / 높이 / 히트 마스크 베이크
7. `blender -b --python stage4_export.py -- <scratch>` — 눈 UV 병합, 머티리얼 단순화, `wrap/oldman.glb` 내보내기
8. `python compose_textures.py <scratch> <output_dir>` — skin_albedo / skin_normal / skin_detail / skin_roughness 합성

스캔 glb 의 UV 는 v 위 방향이라 glTF 임포터가 뒤집어 놓는다. 그래서 베이크에 쓰는 스캔 텍스처는 상하 반전본을 쓴다.
