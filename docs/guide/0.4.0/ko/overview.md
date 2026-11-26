# vanilla.js

**외부 의존성 없이 바닐라 자바스크립트로 만드는 경량 웹게임 엔진**

## 소개

vanilla.js 는 외부 라이브러리 없이 브라우저에서 바로 동작하는 웹게임 엔진입니다.
번들 하나를 모듈로 불러오면 씬, 노드, 입력, UI, 파티클, 오디오가 모두 준비됩니다.

- 런타임 의존성 0. 아래 명령으로 지금 소스(2026-11-26 dev)를 묶으면 `vanilla.min.js` 약 765 KB, gzip 약 215 KB 입니다
- WebGL2 렌더러. 스프라이트, 텍스트, 도형, 마스크가 같은 출력 경로를 쓰고, 묶어 그리기와 화면 밖 거르기가 기본으로 켜져 있습니다
- 블렌드 모드는 Canvas2D 합성 26 가지를 모두 그립니다. overlay, soft-light, hue 같은 13 가지와 렌더 타겟에 그리는 multiply 는 그릴 영역 아래를 떠 와 W3C Compositing and Blending 공식대로 셰이더로 섞습니다
- 노드 / 컴포넌트 구조, 해상도 대응 뷰, 제약 기반 레이아웃, 창 쌓기를 갖춘 UI 시스템
- 파티클, 셰이더 효과, 타임라인, 스키닝 3D, 툰 3D 가 같은 API 위에 얹혀 있습니다
- 러스트로 옮긴 [vanilla-engine](https://github.com/ddukbaek2/vanilla-engine) 과 공개 API 와 동작을 맞춰 둡니다
- 공개 API 전체에 JSDoc 타입이 붙어 편집기 자동 완성과 타입 힌트가 동작합니다

## 주요 기능

| 갈래 | 내용 |
| --- | --- |
| 코어 | `Engine` 루프(최대 FPS, 페이지 이벤트, 검증용 화면 저장), `Scene` / `SceneManager`, `Node` 계층(`WorldNode` / `UINode`), `Component`, `TimeManager`, `InputManager`(마우스 단추, 손가락 목록, 마지막 입력 장치, 막을 키), `InputActions`(입력 동작), `GamepadManager`(진동, 패드 종류), `ViewManager`(해상도 대응, 세이프 에어리어, 렌더 배율 상한), `TouchRaycaster` / `TouchRecognizer`, `PointerCursor` |
| 렌더링 | WebGL2 `Graphic`(스프라이트, 텍스트, 리치 텍스트, 도형, 둥근 사각형, 고리와 호, 선분 묶음, 스텐실 클립, 블렌드 모드 26 가지), 묶어 그리기와 화면 밖 거르기(기본 켬), `Mask`, `Outline`, `SoftShade`, `ShadowText`, `ShadowImage`, `Camera2D`, 글자 텍스처 캐시, 셰이더 프로그램 교체, `ShaderWarmer` |
| UI | 버튼 / 토글 / 스크롤 뷰 / 스크롤 바 / 슬라이더 / 입력 필드 / 진행 바 / 진행 고리 / 리스트 뷰 / 드롭다운 / 컨텍스트 메뉴 / 다이얼로그 / 토스트 / 스피너 / 선, 막대 차트, 창 쌓기(`UIWindowLayer`, `UIWindow`, `UIConfirmWindow`), `ButtonMotion`, `ToastMotion`, `UIHitArea`, `UIScale`, `UIDocument`, 제약 기반 레이아웃(`LayoutSolver`) |
| 효과 | `ParticleSystem`(방출 모양, 렌더 모양, 버스트, 수명 곡선, 끌개, 월드 공간), `TrailRenderer`, `ShaderSprite` 49 종, `ScreenEffect` 58 종, `HeatHazeEffect`, `Shaker`, `FloatingText` |
| 애니메이션 | `Timeline` 런타임(트랙 보간, 이징 31 종 + 베지어, 이벤트 / 마커 / 사운드 / 파티클), `Animator` 상태 기계, `Tween`(노드 속성 트윈 포함), `SpriteAnimator` |
| 3D | `SkinnedModel`(glTF / GLB / FBX, 스키닝, 모프 타깃), `SkinnedModelRenderer`, `HumanSkinRenderer`, `ShadowMap`, `BloomEffect`, `MultiLevelBloomEffect`, `AmbientOcclusionEffect`, `SubsurfaceScatteringEffect`, `Camera3D`, `Material` / `RenderTarget`(멀티샘플) / `FullscreenPass` |
| 툰 3D | `ToonRenderer`(셀 셰이딩, 껍데기 바깥선, 인스턴싱, 그림자, `ToonLightSet` 빛 묶음과 점광, `ToonMaterial` 셰이더 조각, 인스턴스 꼴과 영구 인스턴스 버퍼), `ToonMesh` / `ToonGlb`, `ToonDrawQueue`(그리기 단계 콜백), `ToonScreenOutline`, `ToonVfx`, `ToonPostProcess`(MSAA, 다단 블룸, 색 보정), `ToonView3D` |
| 게임 보조 | `FiniteStateMachine`, `PathFinder`, `Grid`, `Collision2D`, `Steering2D`, `PlatformerBody`, `ObjectPool`, `SeededRandom`, `FixedStepper`, `Localization`, `LanguagePack`, `UIFont`, `DynamicFont`, `Format`, `PersistedStore`, `LocalStorage`, `DialogueRunner`, `Typewriter`, `CameraGestures`, `FrameProbe`, `GraphicsQualityGovernor`, `BuildInfo` |
| 애셋 | `ImageAsset`, `TextAsset`, `JsonAsset`, `BlobAsset`, `FontAsset`, `AudioAsset`, `AssetLoader`(함께 받기, 진행률, 실패 목록), `LoadingProgress`, `SpriteAtlas` |
| 오디오 | `AudioPlayer`, `AudioBus`, `SoundSystem`(소리 표, 배경음악, 효과음 버스, 음소거 규칙), `SoundEffectPool`, `BeepPlayer` |

## 게임

엔진으로 만든 플레이 가능한 결과물입니다.

| 게임 | 링크 |
| --- | --- |
| Tales of Cultivation | [열기](https://ddukbaek2.com/portfolio/talesofcultivation/) |
| Pipe Mania | [열기](https://ddukbaek2.com/portfolio/pipemania/) |
| Scramble Heroes | [열기](https://ddukbaek2.com/portfolio/scramble-heroes/) |

## 저장소 구조

```
src/            엔진 소스
	base/         수학, 색, 자료구조(collection/), 난수
	core/         엔진 루프, 씬, 노드, 입력, 렌더링(Graphic), 소리
	ui/           UI 컴포넌트, 레이아웃
	effect/       파티클, 트레일, ShaderSprite, ScreenEffect, HeatHazeEffect
	animation/    타임라인, Animator, Action
	graphics3d/   3D 그래픽스 (툰 3D 는 toon/)
	game/ misc/   게임 보조 기능
	resource/     애셋 로더
	web/          브라우저 연동
	experimental/ 0.4.0 뒤 기능의 초안 (Experimental 이름 공간, API 가 바뀔 수 있음)
	deprecated/   폐기와 폐기 예정
examples/       샘플 (배포본과 같은 소스)
tools/          웹 저작 도구와 명령줄 도구
build/          번들 산출물 (vanilla.js / vanilla.min.js)
import.js       공개 API 진입점
UPDATE.md       업데이트 기록
```

## 개발 환경

- Windows 11 Pro, macOS(애플 실리콘)
- VSCode
	- Gemini Code Assist / Korean Language Pack / Live Server / Task Explorer
- Node.js v25
	- esbuild (번들링), jsdoc (문서 생성)

## 링크

- 저장소: <https://github.com/ddukbaek2/vanilla.js>
- 배포 페이지: <https://ddukbaek2.com>

## 라이선스

[MIT](https://github.com/ddukbaek2/vanilla.js/blob/release/LICENSE) © ddukbaek2
