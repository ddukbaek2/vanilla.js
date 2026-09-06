# OLD FACE 메타휴먼 애셋 생성

에픽 메타휴먼 얼굴(DNA)에서 RigLogic 을 직접 계산해 ARKit 52 표정을 셰이프키로 굽고 glb 로 만든다. 언리얼 에디터의 후처리 AnimBP 는 헤드리스에서 본을 갱신하지 않아, DNA 의 행동 데이터(PSD / 조인트 그룹 행렬 / 블렌드셰이프 채널)로 평가한다.

준비물
- Unreal Engine 5.8 (MetaHuman 플러그인 동봉) — ARKit 매핑 애니메이션 `AS_MetaHuman_ARKit_Mapping` 과 기본 눈 / 치아 / 속눈썹 텍스처를 꺼내는 데만 쓴다.
- Epic `MetaHuman-DNA-Calibration` 저장소(Python 3.10 용 `lib/Maya2024/windows` 바인딩)와 동봉 DNA(`data/dna_files/Taro.dna`). 현재 공개 라이브러리는 DNA 2.1 까지만 읽으므로 UE 5.8 이 내보내는 2.5 DNA 는 읽지 못한다.
- Blender 5.1, Python 3.10 + numpy + Pillow.

순서
1. `UnrealEditor-Cmd.exe <project.uproject> -ExecutePythonScript=dump_arkit_curves.py -unattended -RenderOffScreen` — 프레임별 raw 제어 커브(CTRL_expressions_*) 덤프 → `arkit_curves.json`
2. `UnrealEditor-Cmd.exe ... -ExecutePythonScript=export_textures.py` — 공막 / 홍채 / 치아 / 속눈썹 PNG 내보내기
3. `python riglogic_eval.py <Taro.dna> <arkit_curves.json> <out.npz>` — RigLogic 평가(raw → PSD → 조인트 델타(위치 cm, 회전 도 XYZ) / 블렌드셰이프 가중치 → 계층 합성 → LBS)로 포즈별 정점 위치
4. `blender -b --python build_metahuman_glb.py -- <out.npz> <character.glb> [렌더 디렉토리]` — 메시(머리 / 치아 / 눈알 / 속눈썹) + 희소 셰이프키 glb (Maya Y 위 cm → Blender 변환)
5. `python strip_default_weights.py <character.glb>` — 기본 가중치 제거
6. `python compose_textures.py <UE 텍스처 디렉토리> <assets>` — 눈 / 치아 / 속눈썹 / 피부 자리표시자
7. `assets/expressions.json` 은 ARKit 셰이프 이름(MouthSmileLeft 등) 가중치 프리셋

미완: 피부 알베도 / 노멀과 노인 얼굴, 머리카락은 "MetaHuman Creator Core Data"(런처 설치) 와 에픽 클라우드(오토리그 / 텍스처 다운로드) 가 있어야 만들 수 있다.
