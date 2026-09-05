# 업데이트 기록

# 0.5.0-experimental (2026-09-05)
- OLD FACE 샘플 추가 (examples/oldface) — 실사 두상 스캔(Lee Perry-Smith, CC BY 3.0)을 노인으로 렌더링
  - 선형 HDR 피부 파이프라인: 섀도우 깊이 → 피부 MRT(조도 / 알베도 / 스펙큘러) → 화면 공간 SSS → 합성 → 블룸 → ACES 톤 매핑 → FXAA
  - 텍스처 노화(흰 수염 / 눈썹, 창백한 피부톤, 홍조, 검버섯, 주름 골 노멀)와 처짐 모프를 CPU 에서 생성
  - 절차적 모프 타깃 10종으로 페이스 애니메이션 (호흡 / 눈 찡그림 / 눈썹 / 미소 / 턱 / 포인터를 따라가는 머리 회전)
  - 렌더링 옵션 패널(숫자 키) + 우측 하단 렌더링 정보(fps / 프레임 시간 / 해상도 / 삼각형 / 정점 / 드로우 콜 / 모프 수)
- experimental/graphics
  - HumanSkinRenderer 추가 (SkinnedModelRenderer 파생 — 3점 조명 + 3색 반구 앰비언트 + 소프트박스 반사 환경,
    탄젠트 노멀 + 4K 높이 미분 디테일 + 캐비티, 피부 F0 이중 로브 GGX + 잔털, 조도 / 알베도 / 스펙큘러 MRT 출력)
  - SubsurfaceScatteringEffect 추가 (분리형 화면 공간 SSS — 피부 확산 프로파일 커널, 깊이 인식, 산란 폭 투영)
  - SkinnedModel: 스킨 없는 정적 메시 로드(합성 스킨), 모프 타깃(glTF targets / weights 애니메이션 + addMorphTarget / setMorphWeight),
    드로어블에 메시 CPU 데이터 유지, setMaterial 추가
  - SkinnedModelRenderer: 프래그먼트 셰이더 주입 생성자, 모프 타깃 버텍스 경로(실수 텍스처 + gl_VertexID)
  - Material: sRGB 색 텍스처(SRGB8_ALPHA8), 캔버스 소스 이미지, 이방성 필터, 추가 텍스처 슬롯(setTexture), URL 이미지 서술 로더
  - RenderTarget: 다중 컬러 어태치먼트(MRT), RGBA16F 실수 컬러, 깊이 텍스처 옵션

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