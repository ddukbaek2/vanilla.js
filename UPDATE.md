# 업데이트 기록

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