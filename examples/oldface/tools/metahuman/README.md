# OLD FACE 메타휴먼 애셋 생성

에픽 메타휴먼 크리에이터 프리셋(현재 "Walter", 노인 남성)에서 얼굴 DNA / 피부 텍스처 / 그룸 카드를 꺼내고, DNA 의 RigLogic 을 언리얼 엔진 안에서 직접 계산해 ARKit 52 표정을 셰이프키로 굽고 glb 로 만든다. 언리얼 에디터의 후처리 AnimBP 는 헤드리스에서 본을 갱신하지 않으므로, C++ 모듈(`ue/OldFaceTools`)이 엔진의 RigLogicLib 으로 조인트 / 블렌드셰이프 출력을 평가한다.

준비물
- Unreal Engine 5.8.2 + 에픽 런처의 "MetaHuman Creator Core Data" 옵션 설치, 에픽 계정 로그인(오토리그 / 고해상도 텍스처는 클라우드 서비스). 처음 한 번 에디터가 띄우는 메타휴먼 로그인 창에서 로그인해 두면 이후 헤드리스 실행에서도 재사용된다.
- `ue/OldFaceProject.uproject` 를 D:/MetaHumanExport/OldFaceProject 같은 곳에 두고 `ue/OldFaceTools` 를 Source 에 넣어 `Build.bat OldFaceProjectEditor Win64 Development -Project=...` 로 빌드한다(RigLogicModule / RigLogicLib 의존).
- Blender 5.1, Python 3.10 + numpy + scipy + Pillow.
- 작업 디렉토리는 D:/MetaHumanExport 기준으로 스크립트에 적혀 있다(환경 변수 OLDFACE_* 로 바꿀 수 있는 항목은 각 스크립트 상단 참고). Git Bash 에서 `/Game/...` 경로를 환경 변수로 넘길 때는 `MSYS_NO_PATHCONV=1 MSYS2_ENV_CONV_EXCL="*"` 를 붙여야 한다.

순서 (`UE=UnrealEditor-Cmd.exe <project.uproject> -unattended -nosplash -nopause -RenderOffScreen -stdout -FullStdOutLogOutput`)
1. `UE -ExecutePythonScript=dump_arkit_curves.py` — ARKit 매핑 애니메이션의 프레임별 raw 제어 커브(CTRL_expressions_*) 덤프 → `Head/arkit_curves.json` (65 프레임)
2. `UE -ExecutePythonScript=export_textures.py` — 플러그인 기본 공막 / 홍채 / 치아 / 속눈썹 PNG → `Textures/`
3. `OLDFACE_PRESET=Walter UE -ExecutePythonScript=ue/ue_create_character.py` — 프리셋 복제(/Game/OldFace/OldMan) → 피부 합성 → 클라우드 오토리그(JOINTS_AND_BLEND_SHAPES) → 고해상도 텍스처 → DNA(`Character/OldMan_Head.dna`) / 머리 스켈레탈 메시 / 머티리얼 텍스처 애셋 내보내기
4. `OLDFACE_DNA_FILE=.../OldMan_Head.dna OLDFACE_DUMP_DIR=.../Dump_oldman UE -ExecutePythonScript=ue/ue_dump_rig.py` — C++ 모듈로 DNA 지오메트리(메시별 정점 / UV / 삼각형 / 스킨 가중치 / 블렌드셰이프 델타)와 65 포즈의 조인트 / 블렌드셰이프 출력 덤프
5. `OLDFACE_EXPORT_PATH=/Game/OldFace/Export/OldMan_MaterialsExport UE -ExecutePythonScript=ue/ue_export_character_textures.py` — 얼굴 / 몸 텍스처 PNG (`CharacterTextures/`, 2K)
6. `python riglogic_from_dump.py <Dump_oldman> <Dump_oldman/pose_names.json> Head/oldman_arkit.npz` — 조인트 계층 합성 + LBS + 블렌드셰이프로 포즈별 정점 위치
7. 그룸 카드 (머리카락 / 눈썹 / 콧수염 / 턱수염)
   - `OLDFACE_GROOM_NAMES=BobLayered,Goatee_L_Wavy,Mustache_L_Wavy,Eyebrows_M_Messy UE -ExecutePythonScript=ue/ue_export_grooms.py` — 카드 LOD 스태틱 메시 FBX 와 아틀라스(Layout2: Attribute R 커버리지 / G 깊이, Tangent A 가닥 좌표)
   - `UE -ExecutePythonScript=ue/ue_export_legacy_heads.py` — 그룸 바인딩 소스 머리(SKM_Groom_Head_Legacy01 / 02) FBX 와 캐릭터 슬롯 선택(어떤 그룸을 쓰는지) 출력
   - Blender 로 FBX 정점 / UV / 삼각형을 npz 로 뽑고(`Grooms/cards_raw.npz`, `Grooms/legacy_heads_raw.npz`), `python legacy_heads_to_dna.py` 로 레거시 머리를 UV 기준 DNA 정점 순서에 대응
   - `python fit_hair_cards.py Grooms/parts.json Head/oldman_arkit.npz Head/oldman_full.npz` — 카드 정점을 소스 머리의 최근접 삼각형(무게중심 + 로컬 프레임 오프셋)에 바인딩해 Walter 중립 / 포즈별 위치로 재구성 (머리카락은 양면 사본)
8. `blender -b --python build_metahuman_glb.py -- Head/oldman_full.npz character.glb [렌더 디렉토리]` — 메시(머리 / 치아 / 눈알 / 속눈썹 / 그룸 4종) + 희소 셰이프키 glb (Maya Y 위 cm → Blender 변환, 머리카락은 4mm 미만 이동 버림)
9. `python strip_default_weights.py character.glb` — 기본 가중치 제거
10. `python compose_metahuman_textures.py <CharacterTextures> <Textures> <assets>` — 피부 알베도 / 노멀(UE DirectX Y- → glTF Y+ 로 G 반전) / 캐비티 → 러프니스(ORM G)와 디테일 높이, 눈 / 치아 / 속눈썹(Sparse)
11. `python compose_hair_textures.py <Grooms> <assets>` — 카드 커버리지를 알파로, 깊이 / 가닥 좌표로 음영을 준 RGBA (hair / beard / mustache / eyebrows)
12. `assets/expressions.json` 은 ARKit 셰이프 이름(MouthSmileLeft 등) 가중치 프리셋
13. 룩데브 텍스처 (언리얼 룩 재현)
   - `UE -ExecutePythonScript=ue/ue_upgrade_assets.py` — 주름 마스크(T_head_wm*_msk_*) / 마이크로 노멀 / 눈(공막 노멀, 홍채 노멀) / 치아 텍스처 PNG, 마스터 머티리얼 T3D, 캐릭터 텍스처 소스 8K 재요청(내보내기 애셋은 2K 로 남는다 — 고해상도는 `ue/ue_export_dcc.py` 의 DCC 패키지에서 얻는다)
   - `python compose_lookdev_textures.py <Lookdev> <Textures> <CM/WM 텍스처> <Grooms> <assets>` — 마이크로 노멀 + 캐비티(skin_micro.png), 주름 마스크 아틀라스(wrinkle_masks.png, 4x4 타일), 주름 노멀 / 색 아틀라스(wrinkle_normal.jpg / wrinkle_color.jpg, 2x2 타일), 공막 / 홍채 색 / 노멀, 눈꺼풀 차폐 알파(eye_occlusion.png), 치아 노멀, 카드 탄젠트 아틀라스
   - `python make_wrinkles_json.py <Dump> wrinkle_mapping.json <assets/wrinkles.json>` — 마스크 채널 → 영역 / 주름 맵 기여, ARKit 셰이프 → 영역 값(C++ 덤프의 RigLogic 애니메이티드 맵 출력). 채널 매핑은 마스크 텍스처의 UV 무게중심으로 추정한 것(wrinkle_mapping.json)

참고
- `riglogic_eval.py` 는 DNA 2.1 파일(에픽 MetaHuman-DNA-Calibration 동봉 Taro 등)을 Python 바인딩(dnacalib)으로 평가하던 이전 경로. UE 5.8 이 내보내는 DNA 2.5 는 읽지 못하므로 4 ~ 6 의 C++ 덤프 경로를 쓴다.
- 머티리얼 내보내기의 얼굴 텍스처 애셋은 desired_texture_sources_resolutions 를 8K 로 올려도 2048 로 만들어진다. 주름 색 맵(CM1~3)은 중간 회색 기준 오버레이, 주름 노멀 맵(WM1~3)은 xy 델타(파랑 채널 없음)다.
