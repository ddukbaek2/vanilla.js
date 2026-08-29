# 업데이트 기록

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