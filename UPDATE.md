# 업데이트 기록

# 0.5.8-experimental (2026-09-07)
- 타임라인 편집기(tools/timelineeditor) 신규 — 유니티 타임라인 / 언리얼 시퀀서 쓰임새의 키프레임 저작 도구. 노드별 묶음 트랙 도프 시트 + 커브 보기(값 세로 끌기), 자동 키(레코드) 모드, 속성 줄 ◆ 키 단추, 이벤트 / 사운드 트랙, 마커, 이징 31종 + 3차 베지어(프리셋 6종 + 곡선 미리보기), 다중 선택 / 상자 선택 / 끌기 / 복사·붙여넣기 / 시간 배율 / 뒤집기, 프레임 스냅, 되돌리기 64단계, 무대 미리보기에서 노드 선택 · 끌어 옮기기, 이미지 / 오디오 애셋(데이터 주소로 문서에 내장), .timeline.json 저장 / 열기, 사용 코드 복사
- Timeline 런타임(src/experimental/animation/timeline.js) — 무대 노드 서술(group / paint / sprite / text / particle / sound) 생성, 트랙(x, y, width, height, scaleX, scaleY, rotation, opacity, visible, color, text, number, fontSize, visibleCharacters, frame, effect, event) 보간, 첫 키 이전 / 마지막 키 이후 값 유지, 반복 시 구간 이벤트 발생, 마커 / 이벤트 / 완료 핸들러, 대상 해석기(노드가 아닌 객체도 setTimelineProperty 로 구동)
- ShaderSprite(src/effect/shadersprite.js) 신규 — Sprite 와 같은 출력 경로에 프래그먼트 효과 48종(색: flash / silhouette / colorize / grayscale / sepia / invert / hueShift / colorAdjust / posterize / threshold / gradientMap · 외곽: outline / innerOutline / glow / innerGlow / shadow / edgeDetect / emboss / sharpen · 흐림: blur / motionBlur / radialBlur · 왜곡: wave / flag / ripple / heatHaze / bulge / swirl / mirror / kaleidoscope / jitter / pixelate / glitch / chromatic · 무늬: hologram / scanlines / oldFilm / vignette / shine · 전환: dissolve / burn / noiseFade / pixelDissolve / wipe / iris / diamondWipe / clockWipe / blinds / checkerWipe)
- ScreenEffect(src/effect/screeneffect.js) 신규 — 씬 전체 후처리 사슬 58종(렌즈 왜곡 / 볼록 / 소용돌이 / 만화경 / 대칭 / 파문 / 아지랑이 / 떨림 / 겹침 / 모자이크 / 충격파 / 물결 · 방향 / 방사 / 가우시안 / 틸트 시프트 블러, 빛줄기, 블룸, 아나모픽 · 글리치 / VHS / 색수차 · 색온도 / 리프트-감마-게인 / 컬러 그레이드 / 색상 회전 / 스플릿 토닝 / ACES 톤맵 / 그라디언트 맵 / 세피아 / 무채색 / 포스터화 / 디더 / 하프톤 / 샤픈 / 윤곽 / 낡은 필름 / 야시경 / 반전 · CRT / 그레인 / 빗줄기 / 안개 / 비네트 / 스포트라이트 / 집중선 / 레터박스 · 전환 11종), 스텐실 포함 오프스크린 대상 + 핑퐁 / 하프 해상도 패스, 타임라인 속성("vignette", "shockwave.radius") 구동
- Graphic: setShaderProgramOverride / restoreRenderState 추가(그리기 중 프로그램 바꿔 끼우기, 외부 GL 패스 뒤 상태 복구), ShaderProgram 에 어트리뷰트 위치 고정 옵션
- 샘플 timeline(examples/timelineshowcase) 신규 — 편집기 문서 8종(제목 리빌 / 로고 스팅 / HUD 인트로 / 컷신 / 콤보 팝업 / 장면 전환 / 반복 아이들 / 패럴랙스)을 생성기(generate.mjs)로 만들고 트랜스포트(재생 / 정지 / 반복 / 속도 / 스크럽 + 마커 눈금)로 재생, 화면 효과 트랙 연동
- 성능: Graphic 이 글자를 흰색으로 굽고 그릴 때 색을 곱하도록 바꿔 색 변화(버튼 틴트 전환 / 타임라인 색 트랙)마다 텍스트를 다시 굽지 않음, 타임라인 fontSize 트랙은 정수 픽셀로 적용, ScreenEffect 는 켜진 효과가 없으면 오프스크린 / 복사 패스를 건너뜀, spritefx 목록은 보이는 행만 활성(프레임당 드로우 콜 441 → 약 170) + 다 탄 파티클 노드 정리
- ScreenEffect 적용 영역: setRegion(x, y, 폭, 높이, 둥근 모서리 반지름 — 캔버스 픽셀) 으로 무대 창 안에만 효과를 걸 수 있음. 씬을 오프스크린에 그리지 않고 화면에서 영역만 떠 와(blitFramebuffer) 처리한 뒤 같은 자리에 되돌려 놓으며, 둥근 모서리 바깥은 원본을 유지. resetAll() 로 모드 전환 때 이전 파라미터 / 색이 남지 않게 함. timelineshowcase · spriteeffects 샘플은 무대 사각형(모서리 14)에만 효과가 걸린다
- Mask 에 둥근 모서리(setRoundSize) — Graphic.beginClipRect(rect, roundSize) 가 둥근 사각형을 스텐실에 써서 무대 컨텐트가 배경 모양대로 잘린다. timelineshowcase · spriteeffects · particleeffects 샘플의 무대(반지름 14)에 적용
- Timeline 이 파티클을 시간으로 다룸 — 대상 파티클 시스템을 수동 틱(ParticleSystem.setManualTick / simulate)으로 바꿔 재생 중에만 진행하고, 스크럽 / 되감기 / 반복 감기 때는 비운 뒤 0초부터 이벤트를 다시 밟으며 재시뮬레이션한다. 일시 정지하면 파티클도 멈춘다
- 샘플 이름: Effects → Particle Effects, Timeline → Timeline Showcase, Sprite FX → Sprite Effects. 두 새 샘플에서 상단 설명과 무대 위 코드 패널을 뺐다(시연용). Sprite Effects 목록은 스프라이트 셰이더 → 화면 효과 → 연출 차례
- 샘플 spritefx(examples/spriteeffects) 신규 — 절차적 픽셀 스프라이트(슬라임 / 코인 / 박쥐 / 문장 / 별 / 보석)로 ShaderSprite 48종 · ScreenEffect 58종을 표에서 자동 나열하고, 연출 조합 25종(히트 스톱 / 화면 흔들림 / 슬로 모션 / 잔상 / 플립북 / 떠오르는 데미지 / 타자기 대사 / 슬래시 트레일 / 패럴랙스 / 카메라 펀치 / 스쿼시 앤 스트레치 / 스폰·디스폰 / 체력 바 / 번개 / 레벨 업 / 텔레포트 / 프리즈 프레임 / 포털 / 수중 / 상태 이상 / 승리 / 게임 오버 / 낮·밤 / 피격 넉백 / 폭우) 시연

# 0.5.7-experimental (2026-09-07)
- OLD FACE 옵션 전면 확장 — 우측 패널에 슬라이더 36종(렌더: 프레임 레이트 30 / 60 / 최대, 슈퍼샘플링 0.5~2x, 노출, 블룸 강도 / 문턱, 비네트, 그레인 / 지오메트리: 머리 메시 LOD 0~2, 머리카락 카드 5단계(LOW~CINEMATIC), 텍스처 크기 4단계 / 그림자: 섀도우 맵 1K~8K + 표본 4~24, 부드러움, 강도 / 피부: 노멀, 모공, 캐비티, 마이크로 노멀, 주름 깊이, SSS 폭, 스펙큘러, 러프니스, 잔털 / AO 강도 · 반경 / 조명 키 · 필 · 림 · 앰비언트 / 머리카락 흔들림 · 스펙큘러 · 뿌리 차폐 / 눈 홍채 · 동공 · 깊이 / 머리 따라가기 · 깜빡임 빈도), 패널 세로 스크롤 · 폭 확대
  - 머리 LOD 0 / 1 / 2 (24k / 12k / 6k 정점) 와 머리카락 카드 LOD 0~4 를 별도 glb 로 나눠 슬라이더로 필요할 때 로드, 텍스처 크기는 TEXTURE_MIN_LOD 로 실효 해상도 조절, 섀도우 맵은 해상도 변경 시 재생성
  - HumanSkinRenderer: 버텍스 셰이더 주입(기반 렌더러 옵션) 으로 머리카락 흔들림(가닥 끝 가중 사인 합성), 섀도우 표본 수 유니폼(포아송 24), 프린지 블렌드 토글
  - 머티리얼 그래프 2배 확대 + 휠 세로 스크롤, 기본 표정 SERIOUS(미간 / 입술 압박) 추가, 눈물선 / 침 유체 커버리지 상수화(눈꺼풀 위 흰 줄 제거), 실사 얼굴 파비콘(favicon.png)
  - 메타휴먼 DCC 패키지의 Eyes_Color / Eyes_Normal(캐릭터 실제 청회색 홍채) 과 Head_SRMF(스펙큘러 / 러프니스 맵)를 눈 · 피부 머티리얼에 적용 (compose_dcc_textures.py)
  - 옵션 패널 세로 스크롤 복구(overflow 충돌) / 폭 372px, 슬라이더는 모두 왼쪽 = 성능, 오른쪽 = 품질 방향으로 통일, 머티리얼 그래프 드래그 스크롤 + 노드 폭에 맞춘 줄바꿈 + 크레딧 겹침 회피, 렌더링 정보에 GPU 메모리 추정 / JS 힙 / 장치 메모리, 포트폴리오 목록용 favicon.svg(PNG 내장)
  - ANTI-ALIASING 슬라이더(OFF / FXAA / FXAA + 대비 적응 샤픈)로 FXAA 토글 대체, 로딩 진행 막대, 얼굴 털(눈썹 / 수염)은 흔들림 제외 셰이딩 모드로 분리, 주름 색 오버레이 폭 제한(눈꺼풀 청백색 얼룩 제거), 눈물선 유체 축소, 눈꺼풀이 감길수록 눈알을 그늘지게(감은 눈 틈의 흰 하이라이트 제거)
  - 그래픽 설정 패널 접기 / 펼치기(기본 접음, 제목 클릭) + 표정 버튼 위 z-index, 슬라이더 값 칸 잘림 수정, 머티리얼 그래프를 설정 패널과 같은 규격(폭 372 / 여백 18 / 제목 바 / 패딩 / 폰트 / 스텐실 클립 내부 스크롤)으로 재구성 — 모바일은 접힌 설정 아래 전체 폭 카드, 크레딧은 모바일에서도 표시
  - 패널 제목 OPTIONS, 옵션 패널 / 그래프 높이를 렌더링 정보 HUD 위까지로 자동 제한, 그래프 구성 요소 크기(제목 10px · 그룹 9px · 본문 10.5px · 자간)를 옵션 패널 CSS 와 동일하게, 프레임 레이트 30 / 60(기본 30), RENDER SCALE 슬라이더(해상도 대비 % — 내부 렌더 버퍼, 4K 픽셀 예산 제한), HUD 에 display / render buffer 분리 표시

# 0.5.6-experimental (2026-09-07)
- OLD FACE 렌더링을 언리얼 메타휴먼 룩에 맞춰 상향 — HumanSkinRenderer 를 셰이딩 모드(피부 / 눈 / 머리카락 / 차폐 / 유체) 통합 셰이더로 재작성
  - 피부: 표정 주름 맵 3종(노멀 / 색 오버레이) 을 메타휴먼 마스크 아틀라스(4x4 타일 x RGBA 채널) 와 RigLogic 애니메이티드 맵 출력으로 가중 혼합(assets/wrinkles.json), 타일링 마이크로 노멀 / 캐비티, 골 기반 러프니스, 회전 포아송 PCF 소프트 섀도우(4K 섀도우 맵)
  - 눈: 각막 굴절 시차 홍채, 홍채 노멀 / 림버스 / 동공, 각막 하이라이트 + 환경 반사, 공막 정맥 노멀, 눈꺼풀 차폐 셸 메시(블렌드 어둡힘), 눈물선 / 침 메시(유체 스펙큘러)
  - 머리카락: 카드 탄젠트 아틀라스로 Kajiya-Kay 이중 로브 이방성 하이라이트, 뿌리 차폐, 투과 역광, 컷아웃 + 프린지 블렌드 2패스(조도 감쇠 + 스펙큘러 버퍼에 색), 섀도우 맵 컷아웃 캐스팅
  - AmbientOcclusionEffect(신규): 깊이 + 노멀 MRT 로 반구 표본 SSAO + 깊이 인식 블러, 합성에서 조도 / 스펙큘러에 적용
  - 1.5x 슈퍼샘플링(내부 렌더 해상도) + FXAA, 배경을 씬 MRT 에 직접 그려 블렌드 패스가 커버리지에 의존하지 않게 함
  - 애셋: 메타휴먼 룩데브 텍스처(주름 마스크 / 마이크로 노멀 / 눈 / 치아) 내보내기와 합성 스크립트, C++ 덤프에 애니메이티드 맵 출력 추가
  - 렌더링 옵션 패널에 AMBIENT OCCLUSION / EXPRESSION WRINKLE MAPS 토글 추가

# 0.5.5-experimental (2026-09-07)
- OLD FACE 애셋을 메타휴먼 크리에이터 노인 프리셋 "Walter" 로 교체 — 실제 피부 텍스처(알베도 / 노멀 / 캐비티 → 러프니스와 디테일 높이), 그룸 카드 머리카락 / 눈썹 / 콧수염 / 턱수염, 총 11.1만 삼각형, ARKit 51 셰이프키(얼굴 리그 RigLogic 을 그대로 계산)
  - UE 5.8.2 + MetaHuman Creator Core Data 헤드리스 파이프라인(examples/oldface/tools/metahuman/ue): 프리셋 복제 → 클라우드 오토리그(JOINTS_AND_BLEND_SHAPES) / 고해상도 텍스처 → DNA / 머리 메시 / 머티리얼 텍스처 내보내기 → C++ 모듈 OldFaceTools 로 DNA 2.5 지오메트리 덤프와 RigLogic 포즈 평가(엔진의 RigLogicLib 사용, 65 프레임 ARKit 매핑 커브)
  - 그룸 카드: 그룸 애셋의 카드 LOD1 스태틱 메시와 아틀라스(Layout2: Attribute R 커버리지 / G 깊이, Tangent A 가닥 좌표)를 꺼내 바인딩 소스 머리(레거시 그룸 머리, UV 로 DNA 정점 순서 대응)의 최근접 삼각형 프레임으로 Walter 머리에 다시 붙이고, 같은 바인딩으로 표정 포즈마다 정점을 옮겨 셰이프키로 굽음(턱수염이 턱, 눈썹이 이마를 따라감). 머리카락만 양면 사본, 셰이프키는 4mm 이상 이동만 유지
  - 샘플: 머리 머티리얼에 메타휴먼 노멀 / 러프니스 맵, 그룸 카드 4종 머티리얼(알파 컷아웃, 산란 없음), 머티리얼 그래프 패널 썸네일(NORMAL / CAVITY / HAIR), 크레딧 문구

# 0.5.0-experimental (2026-09-05)
- OLD FACE 샘플 추가 (examples/oldface) — 에픽 메타휴먼 얼굴(Taro DNA: 머리 2.4만 정점 + 치아 / 눈알 / 속눈썹, RigLogic 을 ARKit 51종 셰이프키로 굽음)을 피부 파이프라인으로 렌더링
  - 애셋 생성(examples/oldface/tools/metahuman): UE 5.8 에서 ARKit 매핑 애니메이션의 raw 제어 커브를 덤프하고, 에픽 DNA 라이브러리로 DNA 의 RigLogic(PSD / 조인트 그룹 행렬 / 블렌드셰이프 채널)을 직접 평가해 포즈별 정점을 계산, Blender 로 희소 셰이프키 glb 생성.
    눈(공막 + 홍채 합성) / 치아 / 속눈썹 텍스처는 메타휴먼 플러그인 기본 텍스처, 피부 알베도는 자리표시자(코어 데이터 설치 후 교체 예정)
  - 표정 버튼 13종(NEUTRAL / HAPPY / GRIN / PEACEFUL / EXCITED / ANGRY / FURIOUS / SAD / PAIN / DISGUSTED / BORED / CONFUSED / EMBARRASSED) — ARKit 블렌드셰이프 가중치 프리셋(assets/expressions.json)을 부드럽게 전환, 깜빡임은 EyeBlink 단위
  - 머리 / 치아 / 눈알 / 속눈썹 카드(알파 컷아웃)를 부위별 머티리얼로 분리(눈과 카드는 산란 마스크 0)
  - 머리 방향은 흉상 모델 행렬을 목 아래 피벗으로 회전해 포인터를 따라감, 카메라 초점은 눈알 정점 중심, 폰 핀치 줌, 렌더링 정보 패널이 홈 링크와 겹치면 위로 이동
  - 선형 HDR 피부 파이프라인: 섀도우 깊이 → 피부 MRT(조도 / 알베도 / 스펙큘러) → 화면 공간 SSS → 합성 → 블룸 → ACES 톤 매핑 → FXAA
  - 렌더링 옵션 패널(숫자 키) + 우측 하단 렌더링 정보(fps / 프레임 시간 / 해상도 / 삼각형 / 정점 / 드로우 콜 / 모프 수)
  - 와이어프레임 토글(깊이 프리패스로 앞면 모서리만, 모프 / 스키닝 반영), 좌측 머티리얼 그래프 패널(원본 / 노화 텍스처 축소본, 셰이딩 파라미터, MRT / SSS / HDR 중간 버퍼 실시간 미리보기, 토글)
- experimental/graphics
  - HumanSkinRenderer 추가 (SkinnedModelRenderer 파생 — 3점 조명 + 3색 반구 앰비언트 + 소프트박스 반사 환경,
    탄젠트 노멀 + 4K 높이 미분 디테일 + 캐비티, 피부 F0 이중 로브 GGX + 잔털, 조도 / 알베도 / 스펙큘러 MRT 출력)
  - SubsurfaceScatteringEffect 추가 (분리형 화면 공간 SSS — 피부 확산 프로파일 커널, 깊이 인식, 산란 폭 투영)
  - SkinnedModel: 스킨 없는 정적 메시 로드(합성 스킨), 모프 타깃(glTF targets / weights 애니메이션 + addMorphTarget / setMorphWeight, 최대 96),
    glTF 희소(sparse) 접근자, 드로어블에 메시 CPU 데이터와 머티리얼 이름 유지, setMaterial 추가
  - SkinnedModelRenderer: 프래그먼트 셰이더 주입 생성자, 모프 타깃 버텍스 경로(실수 텍스처 + gl_VertexID)
  - SkinnedModelRenderer.drawWireframe / SkinnedModel.uploadWireframeIndices: 중복 없는 모서리 선 인덱스로 와이어프레임 출력
  - Material: sRGB 색 텍스처(SRGB8_ALPHA8), 캔버스 소스 이미지, 이방성 필터, 추가 텍스처 슬롯(setTexture), URL 이미지 서술 로더,
    머티리얼별 서브서피스 팩터(setSubsurfaceFactor), setUseAlphaCutout
  - HumanSkinRenderer: 색 텍스처 셰이더 디코드, 러프니스 텍스처(G) x roughnessFactor, 오파시티 알파 컷아웃, 머티리얼별 SSS 마스크
  - RenderTarget: 다중 컬러 어태치먼트(MRT), RGBA16F 실수 컬러, 깊이 텍스처 옵션
- ParticleSystem: EmitterShape 를 ParticleEmitterShape 로 개명하고, 문자열이던 렌더 모양을 ParticleRenderShape 열거형(circle / rect / streak / image)으로 통일 (값은 기존 문자열과 같아 vfx JSON 은 그대로 호환)
- UIDropdown: 펼친 목록을 트리 뿌리로 옮겨 그려 나중에 그려지는 형제 노드에 가려지지 않게 수정 (접으면 되돌림)
- UI 쇼케이스: 내비게이션 캡션을 CONSOLE 에서 UI SHOWCASE 로 변경

# 0.4.1-experimental (2026-09-03)
- Graphic: 정점 버퍼 올리기를 bufferSubData 덮어쓰기에서 bufferData 고아 처리로 교체 (drawVertices / drawColoredQuads)
  — 사파리(ANGLE → Metal)는 GPU 가 아직 읽는 버퍼를 덮어쓰면 드로우 콜마다 CPU 를 세워, 드로우 콜 45 · 정점 1000 남짓에도
  아이폰 10 fps · 맥 22 fps 가 나왔음. 교체 뒤 맥 사파리 60 fps 확인 (srpg 프로젝트에서 발견, 크롬은 영향 없음)
- 에디터 · EFFECTS 샘플: 이펙트 20종 + 코드 패널 / 복사 / fps, 유사 이펙트 7종 정리와 신규 메커니즘 5종, 오버레이 / 스크롤바 개선,
  ASSETS 구획 3종 · 파티클 계층 트리 · 격자 / 뷰 토글 · 팔레트 드래그 앤 드롭 수리

# 0.4.0-experimental (2026-08-31)
- 형제 게임 프로젝트들에서 반복 구현되던 범용 기능을 엔진으로 흡수 (실험적 브랜치)
- base
  - math: randomRange / randomInt / pickRandom / shuffle / approach / moveTowards 추가
  - SeededRandom 추가 (mulberry32, 일일 시드 생성 포함)
  - Cooldown / RepeatTimer 추가
  - ObjectPool 추가
  - FiniteStateMachine 재작성 (enter / tick / exit, 전이 가드 / 알림)
  - Format 추가 (천 단위 / 한국어 단위 / K·M·B 축약 / 자릿수 채움 / 분:초)
  - Color.fromHEXCached 추가 (공유 인스턴스 캐시)
- core
  - InputManager: isKeyJustPressed / isKeyJustReleased (프레임 엣지 검출) 추가
  - ViewManager: 안전 영역 조회(getSafeAreaInsets), 화면비 기반 자동 스케일 모드(applyAspectViewScaleMode), 렌더 픽셀 배율 상한(setMaxRenderPixelRatio) 추가
  - Engine.exitApplication 추가 (Capacitor 앱 종료 지원)
  - TextAsset: 캐시 무시 로드(setNoCache) 추가
  - SoundEffectPool 추가 (다중 보이스 효과음 재생)
  - Text: 자동 줄바꿈(단어 / 글자 단위), 줄 간격, 글자 수 노출(타자기용) 추가
  - AnimationClip.fromAtlas 추가 (TexturePacker json / 사각형 배열)
- ui
  - UILabel: 줄바꿈 / 노출 글자 수 전달 메서드 추가
  - UIButton: 최소 눌림 시간(setMinimumPressedSeconds) 추가
  - UIProgressView: 보조 게이지(setSecondaryValue) 추가
  - PopupMotion 추가 (팝업 등장 / 퇴장 배율·딤 전환기)
  - UIToast 추가 (줄 세워 보여 주는 알약 알림)
  - UIDialog 추가 (딤 + 카드 + 확인 / 취소 대화 상자)
- misc
  - PathFinder(A*), Grid(플러드필 / 연결 검사 / 사각형 겹침), Collision2D, Steering2D 추가
  - Camera2D 추가 (팬 / 줌 / 관성 / 추적 / 경계 / 트윈, 앵커 보존 줌)
  - PointerGesture(탭 / 드래그 / 길게 누름), Shaker(화면 흔들림), FocusNavigator(방향키 포커스 이동) 추가
  - PersistedStore(버전 붙은 저장소), Localization(다국어 표), LocalStorage.clearByPrefix 추가
  - Typewriter, DialogueRunner / DialogueScriptParser(대화 스크립트), SpriteAnimator, PlatformerBody, FloatingText, BeepPlayer 추가
- 검증: 순수 로직 Node 테스트 83건(41 + 42) 통과, 헤드리스 크롬 스모크 26건 통과
- UIListView 추가 (재활용 리스트 — 템플릿 노드 + 데이터 수만 받아 보이는 범위만 생성 / 회수, 끝 도달 알림으로 무한 스크롤)
- TimeManager: 프레임 시간을 [0, 0.25초]로 제한 (타이머 역행 / 백그라운드 탭 복귀 시 튀는 dt 방지)
- SkinnedModel: 애니메이션 없는 정적 모델도 기본 포즈로 그려지도록 수정
- UI 쇼케이스 전면 개편: 기준 해상도 1440x900 고밀도 레이아웃, 왼쪽 레일 내비, 절제된 팔레트,
  목록 항목은 문서에 굽지 않고 템플릿 + 데이터로 동적 생성 (상품 500건 무한 스크롤 + 로딩 줄, 구매 기록, 대사 패널)
- NEON HORIZON: 셰이더 실루엣 전투순양함을 실제 3D 모델로 교체 (Quaternius 'Ultimate Spaceships' Executioner, CC0)
  — 엔진 SkinnedModel GLB 경로 사용, 선미 엔진 글로우 / 기함 주포는 투영 앵커로 유지
- UILabel: getTextAlign / getTextBaseline 추가, UIDocument 가 라벨 정렬을 저장 / 복원하도록 보강
- 위젯 대량 추가: UIDropdown(콤보박스), UIContextMenu(우클릭 메뉴), UISpinner(회전 인디케이터),
  UILineChart / UIBarChart(실시간 차트), UIDraggable(드래그 앤 드롭, 스냅백 / settleHere)
- UIButton: 길게 누름(setLongPressedEvent / setLongPressSeconds, 발화 시 클릭 삼킴), 눌림 경과 시간 조회 추가
- UIToast: 가로 표시 자리(setRestX) / 글자 크기 옵션 추가
- ParticleSystem / TrailRenderer 추가 (유니티식 2D 파티클 — rate / burst / shape(point·circle·cone·box·edge) /
  수명·속도·크기·회전·색 시작 범위 / 수명 그라디언트 / 중력·감쇠 / 가산 합성 / 월드 공간, 트레일 띠)
- UI 쇼케이스를 "VANILLA CONSOLE" 앱으로 전면 재구성: 실시간 대시보드(라인 / 바 차트, KPI, 이벤트 피드),
  스토어(카트 선택 / 해제 / 클리어 / 체크아웃, 스피너 로딩 줄), 설정(드롭다운 포함), 컴포넌트 플레이그라운드
  (버튼 상태 / 롱프레스 / 컨텍스트 메뉴 / 드래그 / 스피너 / 타자기 / 차트) — 화면 좌우 여백 제거(stretchShortExpandLong + 우측 앵커)
- EFFECTS 샘플 추가 (파티클 놀이터 — 불 / 분수 / 눈 / 색종이 / 폭발 / 불꽃놀이 / 마법 궤적)
- 쇼케이스 테마 선택 추가 (Dim 기본 / Dark / Light — 문서 색을 역할로 캐시해 즉시 리매핑, localStorage 저장)
- Graphic: 정점 색 배치 경로 추가 (파티클 전용 셰이더 + 단일 업로드 — 시스템당 드로우 1회) / 부드러운 원 텍스처
- ParticleSystem: 배치 렌더 전환(수백 배 드로우콜 절감), blendMode 선택(lighter/multiply/screen), 어트랙터(끌림+소용돌이),
  워블(살랑임), streak 렌더(비/유성), applyDescription(vfx JSON 애셋 로드)
- EFFECTS 샘플 V2: 세그먼트 탭 + 무대 상자(Mask 클리핑) + 전 모드 자동 무한 반복, 12모드로 확충
  (불/분수/눈/비/색종이/폭발/불꽃놀이/별가루/불씨/거품/소용돌이/궤적), 모드 전환 시 파티클 정리
- 파티클 편집기 tools/particleeditor 추가 (라이브 프리뷰 + 전체 속성 인스펙터 + 프리셋 9종 + .vfx.json 저장/불러오기)
- Engine.run: 기본 폰트(CDN) 로드가 실패하거나 늦어도 씬 로드 / 렌더 루프가 막히지 않게 수정

# 0.3.0 (2026-08-30)
- 렌더러 교체: Canvas 2D -> WebGL2
- WebGL2 3D 샘플 추가 (NEON HORIZON / ancientmountain) — 절차적 지형, 블룸, 파티클, 함대 연출
- FBX 로더에 스키닝 / PBR 머터리얼 / 애니메이션 클립 처리 추가
- SkinnedModel 을 데이터와 자세만 갖도록 정리하고 렌더링은 SkinnedModelRenderer 로 분리
- Material 추가 (셰이더 템플릿 + PBR 계수 + 텍스처 슬롯)
- UI 문서 형식 UIDocument 추가 (uiasset json 저장 / 복원)
  - 노드와 컴포넌트 종류 등록 API (registerNodeType / registerComponentType)
  - 전용 처리기가 없는 컴포넌트는 get/set 짝으로 저장 / 복원
  - 노드 참조를 UI 뿌리 기준 절대 경로로 기록 ({ "$nodeRef": "/Panel/Slider/Thumb" })
- UI 편집기 tools/uieditor 추가 (서버 없이 파일 하나로 실행)
- 컴포넌트 Enable 이 렌더링에 반영되도록 수정 (WorldNode / TransformNode 가 draw 전에 isEnable 확인)
- UISlider: thumb 을 자식 노드로 대신 쓸 수 있는 setThumbNode / getThumbNode 추가
- UIButton: 마우스가 올라간 상태(hover) 처리와 색 / 이벤트 설정 추가
- UIView: 배경 기본색을 투명으로 변경
- UIProgressView 를 import.js 에 추가
- Paint: getRoundSize 추가
- WorldNode.getWorldBounds 가 첫 모서리를 빠뜨리던 것 수정
- Pane: 구분선 두께를 PaneTheme.size.resizer 로 정할 수 있게 추가
- Pane: 구분선을 잡은 지점 기준으로 끌고, 누를 때 브라우저 기본 끌기를 막아 첫 드래그가 죽던 문제 수정
- UI 편집기: 뿌리도 다른 노드와 같게 다룬다. 뿌리 크기가 곧 문서 크기다.

# 0.2.1 (2026-08-02)
- 엑셀 도구 추가
- 입력 처리기 추가 및 휠 입력 처리
- WorldNode 에 앵커드포지션 추가
- Label ==> Text 변경
- UINode 관련 작업 및 UI 구조/컴포넌트 위치 정리
- AnchoredWorldNode 의존성 제거 및 마스크 분리
- Color 객체에 클론 기능 추가
- 활성화된 객체만 틱 처리가 되도록 처리
- 스크롤뷰가 버튼의 부모로 있을 때 스크롤뷰 우선 처리
- 데브툴즈 관련 수정
    - 네이티브 해상도를 따르도록 수정
    - 이미지 안티앨리어싱 처리 설정 추가
- 모바일 웹브라우저 화면 해상도 처리 오류 수정
- 입력필드 관련 오류 수정
- 오디오 컨텍스트 경고 관련 수정
- AudioManager.resumeContext() 에서 iOS WebKit 비표준 "interrupted" 상태 복구 처리

# 0.2.0 (...)
- 컴포넌트 이름 수정 및 위치 변경
- UIBuilder ==> NodeLayout
- 데브툴즈 관련 설정 및 기능 추가
    - 데브툴즈를 켤때 현재 모든 노드의 기즈모를 보이기/감추기 할 것인지 프로퍼티
    - 데브툴즈를 켜고 있는 중에 뷰렉트의 해상도 비율 가이드라인을 보여줄 것인지 프로퍼티


# 0.1.0 (2026-04-13)
- 런타임에서 엔진 상태 파악을 위한 DEVTools 추가
- LocalStorage 추가
- ViewScaleMode 3종 추가 및 정리
- Node 구조 개선
- TouchRaycaster 추가

# 0.0.11 (2026-04-08)
- UIBuilder 추가
- ScrollViewComponent, SnapScrollViewComponent, ToggleButtonComponent 추가
- VirtualPad 추가
- ViewManager.getViewSize() 추가
- WebSocketClient 추가

# 0.0.10 (2026-04-05)
- AudioManager 추가.
- AudioContext 소실시 복원 처리.

# 0.0.9 (2026-04-03)
# 0.0.8 (2026-03-30)
# 0.0.7 (2026-03-30)
# 0.0.6 (2026-03-29)
# 0.0.5 (2026-03-27)
# 0.0.4 (2026-03-27)
# 0.0.3 (2026-03-26)
# 0.0.2 (2026-03-25)
# 0.0.1 (2026-03-18)