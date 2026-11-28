<div align="center">

# vanilla.js

**외부 의존성 없이 바닐라 자바스크립트로 만드는 경량 웹게임 엔진**

[![version](https://img.shields.io/badge/version-0.3.2-d4b06a?style=flat-square)](UPDATE.md)
[![license](https://img.shields.io/badge/license-MIT-3f3f46?style=flat-square)](LICENSE)
[![dependencies](https://img.shields.io/badge/dependencies-0-3f3f46?style=flat-square)](import.js)
[![renderer](https://img.shields.io/badge/renderer-WebGL2-3f3f46?style=flat-square)](src/core/graphic.js)
[![jsdoc](https://img.shields.io/badge/typing-JSDoc-3f3f46?style=flat-square)](src)

[샘플](#샘플) / [도구](#도구) / [빠른 시작](#빠른-시작) / [주요 기능](#주요-기능) / [업데이트 기록](UPDATE.md)

</div>

---

## 소개

vanilla.js 는 외부 라이브러리 없이 브라우저에서 바로 동작하는 웹게임 엔진입니다.
번들 하나를 모듈로 불러오면 씬, 노드, 입력, UI, 파티클, 오디오가 모두 준비됩니다.

- 런타임 의존성 0. 아래 명령으로 지금 소스(2026-11-28 dev)를 묶으면 `vanilla.min.js` 1,026,992 바이트, `gzip -9` 297,669 바이트입니다. (초안 src/experimental 은 묶음에 들지 않습니다) 게임을 소스에서 esbuild 로 묶으면 쓰는 것만 듭니다. (2D 와 UI 만 쓰는 게임은 3D 가 빠집니다)
- WebGL2 렌더러. 스프라이트, 텍스트, 도형, 마스크가 같은 출력 경로를 쓰고, 묶어 그리기와 화면 밖 거르기가 기본으로 켜져 있습니다
- 블렌드 모드는 Canvas2D 합성 26 가지를 모두 그립니다. overlay, soft-light, hue 같은 13 가지와 렌더 타겟에 그리는 multiply 는 그릴 영역 아래를 떠 와 W3C Compositing and Blending 공식대로 셰이더로 섞습니다
- 노드 / 컴포넌트 구조, 해상도 대응 뷰, 제약 기반 레이아웃, 창 쌓기를 갖춘 UI 시스템
- 파티클, 셰이더 효과, 타임라인, 스키닝 3D, 툰 3D 가 같은 API 위에 얹혀 있습니다
- 러스트로 옮긴 [vanilla-engine](https://github.com/ddukbaek2/vanilla-engine) 과 공개 API 와 동작을 맞춰 둡니다
- 공개 API 전체에 JSDoc 타입이 붙어 편집기 자동 완성과 타입 힌트가 동작합니다

## 빠른 시작

```html
<canvas id="mainCanvas"></canvas>
<script type="module">
	import { Engine, EngineConfiguration, Scene, Vector2, Rect, Colors } from "./build/vanilla.js";

	class MainScene extends Scene {
		draw(graphic) {
			super.draw(graphic);
			graphic.setFillColor(Colors.white);
			graphic.drawRect(Rect.create(100, 100, 200, 120));
		}
	}

	const engineConfiguration = new EngineConfiguration();
	engineConfiguration.canvasId = "mainCanvas";
	engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
	engineConfiguration.autoResizeOnWindowResize = true;
	const engine = new Engine(engineConfiguration);
	engine.run(new MainScene());
</script>
```

번들을 직접 만들 때는 esbuild 를 씁니다. 아래 명령이 `build/vanilla.js`(와 소스 맵 `vanilla.js.map`), `build/vanilla.min.js` 를 짓습니다.

```bash
node tools/bundle.cjs
```

- `vanilla.js` 는 읽는 판입니다. 줄과 들여쓰기는 남기고 주석은 뺍니다. 원래 소스와 주석은 소스 맵에 다 들어 있어 브라우저 개발 도구에서는 원래 파일로 보입니다. (esbuild 는 줄이지 않은 묶음에 주석을 그대로 남겨, 주석이 묶음의 40% 쯤 되어 읽는 시간이 늘었습니다. 그래서 공백을 줄여 주석을 뺀 묶음을 한 번 더 esbuild 로 펴서 씁니다)
- `vanilla.min.js` 는 줄인 판입니다. (`esbuild import.js --bundle --format=esm --minify --keep-names`)
- 저장소 맨 위 `package.json` 의 `sideEffects` 는 묶는 도구(esbuild, webpack)에 엔진 모듈이 불러올 때 따로 하는 일이 없다고 알립니다. 그래서 게임을 소스에서 묶으면 쓰지 않는 모듈이 통째로 빠집니다. (`import.js` 만 예외로 두어, 초안이 엔진 진입점을 먼저 읽는 `import "../../import.js"` 는 남습니다)
- 묶음 머리의 `/*! ... */` 한 줄은 엔진 라이선스와 제3자 고지 파일(THIRD_PARTY_LICENSES.md)을 가리킵니다. 줄여도 남습니다.
- 초안(src/experimental 의 2D 물리, 타일맵, 2D 뼈대, 공간 소리, 세이브)은 진입점 `import.js` 와 묶음에 들지 않습니다. 쓰려면 묶음 대신 소스를 불러옵니다. 초안이 src 의 엔진 모듈을 불러오므로 엔진도 묶음이 아닌 `import.js` 로 불러야 클래스가 하나입니다. 게임을 esbuild 로 묶으면 초안도 함께 묶입니다.

```js
import { Engine, Vector2 } from "./import.js";
import * as Experimental from "./src/experimental/experimental.js";

const world = new Experimental.PhysicsWorld2D(new Experimental.WorldDefinition2D(32));
```

## 주요 기능

| 갈래 | 내용 |
| --- | --- |
| 코어 | `Engine` 루프(최대 FPS, 페이지 이벤트, 검증용 화면 저장), `Scene` / `SceneManager`, `Node` 계층(`WorldNode` / `UINode`), `Component`, `TimeManager`, `InputManager`(마우스 단추, 손가락 목록, 마지막 입력 장치, 막을 키), `InputActions`(입력 동작), `GamepadManager`(진동, 패드 종류), `ViewManager`(해상도 대응, 세이프 에어리어, 렌더 배율 상한), `TouchRaycaster` / `TouchRecognizer`, `PointerCursor` |
| 렌더링 | WebGL2 `Graphic`(스프라이트, 텍스트, 리치 텍스트, 도형, 둥근 사각형, 고리와 호, 선분 묶음, 스텐실 클립, 블렌드 모드 26 가지), 묶어 그리기와 화면 밖 거르기(기본 켬), `Mask`, `Outline`, `SoftShade`, `ShadowText`, `ShadowImage`, `Camera2D`, 글자 텍스처 캐시, 셰이더 프로그램 교체, `ShaderWarmer` |
| UI | 버튼 / 토글 / 스크롤 뷰 / 스크롤 바 / 슬라이더 / 입력 필드 / 진행 바 / 진행 고리 / 리스트 뷰 / 드롭다운 / 컨텍스트 메뉴 / 다이얼로그 / 토스트 / 스피너 / 선, 막대 차트, 창 쌓기(`UIWindowLayer`, `UIWindow`, `UIConfirmWindow`), `ButtonMotion`, `ToastMotion`, `UIHitArea`, `UIScale`, `UIDocument`, 제약 기반 레이아웃(`LayoutSolver`) |
| 효과 | `ParticleSystem`(방출 모양, 렌더 모양, 버스트, 수명 곡선, 끌개, 월드 공간), `TrailRenderer`, `ShaderSprite` 49 종, `ScreenEffect` 58 종, `HeatHazeEffect`, `Shaker`, `FloatingText` |
| 애니메이션 | `Timeline` 런타임(트랙 보간, 이징 31 종 + 베지어, 이벤트 / 마커 / 사운드 / 파티클), `Animator` 상태 기계, `Tween`(노드 속성 트윈 포함), `SpriteAnimator` |
| 3D | `SkinnedModel`(glTF / GLB / FBX, 스키닝, 모프 타깃), `SkinnedModelRenderer`, `HumanSkinRenderer`, `ShadowMap`, `BloomEffect`, `MultiLevelBloomEffect`, `AmbientOcclusionEffect`, `SubsurfaceScatteringEffect`, `Camera3D`, `Material` / `RenderTarget`(멀티샘플) / `FullscreenPass` |
| 툰 3D | `ToonRenderer`(그늘 램프 셀 셰이딩: 바탕과 1 차, 2 차 그늘의 Step, Feather, 램프 텍스처, 그림자가 그늘 색으로, 단단한 툰 하이라이트와 림, 그늘 쪽 림, 매트캡, 천사 고리(2 번 UV), 색마다 빛 색 켜고 끄기, 거리에 따라 굵기를 맞추고 멀면 사라지는 껍데기 바깥선, 인스턴싱, 해 그림자와 점광, 스포트라이트 그림자 아틀라스(`ShadowAtlas`), `ToonLightSet` 빛 묶음과 점광, 스포트라이트, `ToonMaterial` 셰이더 조각, 인스턴스 꼴과 영구 인스턴스 버퍼), `MeshBuilder`, `readGlbArrays`, `ToonDrawQueue`(그리기 단계 콜백, 화면 공간 바깥선 맡기기), `ToonScreenOutline`(바로 이웃 경계에서 잡고 점프 플러딩으로 넓히는 화면 공간 바깥선, 실루엣과 꺾임 선 굵기 따로, 모형마다 끄고 켜기), `ToonVfx`, `ToonPostProcess`(MSAA, 다단 블룸, 색 보정), `ToonView3D` |
| 게임 보조 | `FiniteStateMachine`, `PathFinder`, `Grid`, `Collision2D`, `Steering2D`, `PlatformerBody`, `ObjectPool`, `SeededRandom`, `FixedStepper`, `Localization`, `LanguagePack`, `UIFont`, `DynamicFont`, `Format`, `PersistedStore`, `LocalStorage`, `DialogueRunner`, `Typewriter`, `CameraGestures`, `FrameProbe`, `GraphicsQualityGovernor`, `BuildInfo` |
| 애셋 | `ImageAsset`, `TextAsset`, `JsonAsset`, `BlobAsset`, `FontAsset`, `AudioAsset`, `AssetLoader`(함께 받기, 진행률, 실패 목록), `LoadingProgress`, `SpriteAtlas` |
| 오디오 | `AudioPlayer`, `AudioBus`, `SoundSystem`(소리 표, 배경음악, 효과음 버스, 음소거 규칙), `SoundEffectPool`, `BeepPlayer` |

## 도구

엔진과 함께 쓰는 웹 저작 도구입니다. 브라우저에서 바로 열리고, 결과물은 JSON 문서로 저장됩니다.

| 도구 | 설명 | 데모 | 소스 |
| --- | --- | --- | --- |
| UI Editor | 노드 트리, 인스펙터, 캔버스 편집으로 UI 화면을 짜고 `.uiasset.json` 으로 저장 | [열기](https://vanillapunch.com/tools/editor/uieditor/) | [`tools/uieditor`](tools/uieditor) |
| Particle Editor | 파티클 프리셋 저작. 미리보기에서 값을 바꾸며 조정 | [열기](https://vanillapunch.com/tools/editor/particleeditor/) | [`tools/particleeditor`](tools/particleeditor) |
| Timeline Editor | 유니티 타임라인 / 언리얼 시퀀서 쓰임새의 키프레임 저작. 도프 시트 + 커브, 자동 키, 이벤트 / 마커 | [열기](https://vanillapunch.com/tools/editor/timelineeditor/) | [`tools/timelineeditor`](tools/timelineeditor) |
| Visual Editor | 유니티처럼 도킹 창(하이어라키, 씬, 게임, 인스펙터, 프로젝트, 콘솔)을 갖춘 통합 편집기. 폴더 열기, 프리팹, 되돌리기, 재생. 씬은 UIDocument 형식(`.scene.json`)으로 저장 | [열기](https://vanillapunch.com/tools/editor/visualeditor/) | [`tools/visualeditor`](tools/visualeditor) |

명령줄 도구는 Node.js 로 실행합니다. 자세한 사용법은 [`tools/TOOLS.md`](tools/TOOLS.md) 에 있습니다.

| 명령 | 설명 |
| --- | --- |
| `node tools/atlas.cjs <폴더>` | 이미지 여러 장을 텍스처로 묶기 (MaxRects, 넘치면 여러 장, `SpriteAtlas` 가 읽음) |
| `node tools/project.cjs build --script <진입> --input <입력> --output <출력>` | 템플릿 복사와 esbuild 번들링 |
| `node tools/project.cjs check --input <입력>` | 자산 현황 점검 |
| `node tools/project.cjs stage --source <소스> --destination <대상>` | 배포할 폴더로 복사 |
| `node tools/webm.cjs <폴더>` | 음원을 webm 으로 변환 |
| `node tools/mangle.cjs <입력> <출력> <제외 문자열>` | 코드 내 문자열 정리 |
| `node tools/apidoc.cjs <버전>` | 공개 API 문서 자료(`docs/api/<버전>.json`) 뽑기 |
| `node tools/bundle.cjs` | 엔진 묶음(`build/vanilla.js`, `build/vanilla.min.js`) 짓기 |

`tools/excel.cjs` 는 엑셀(xlsx)과 JSON, 데이터 클래스 소스를 오가는 함수 모음입니다. `module.exports` 로 함수만 내보내고 명령줄 진입점이 없어서 `node tools/excel.cjs` 로 혼자 실행하면 아무것도 하지 않습니다. 다른 스크립트에서 `require` 로 불러 쓰고, 쓰는 프로젝트에 npm 패키지 `xlsx` 가 깔려 있어야 합니다. `tools/table.cjs` 는 지금 빈 파일입니다.

## 샘플

모두 저장소의 `examples/` 에 소스가 있고, 아래 링크는 배포본입니다.

| 샘플 | 설명 | 데모 | 소스 |
| --- | --- | --- | --- |
| Toon Shading | VRM 1.0 캐릭터의 애니풍 렌더링. 3 톤 램프, 구면 노멀 얼굴 그림자, 앞머리 그림자, 천사 고리, 화면 공간 림, 아웃라인, 스프링 본, Quaternius(CC0) 본 애니메이션 8 종 | [열기](https://vanillapunch.com/tools/demo/toonshading/) | [`examples/toonshading`](examples/toonshading) |
| Old Face | MetaHuman(Epic Games, 데모 전용) 얼굴의 PBR. 서브서피스 스캐터링, 표정 주름 맵, 그룸 카드 머리카락, 눈 굴절, 머티리얼 그래프 패널. 에셋 고지: [MetaHuman](https://www.metahuman.com/), [라이선스](https://www.metahuman.com/en-US/license) | [열기](https://vanillapunch.com/tools/demo/oldface/) | [`examples/oldface`](examples/oldface) |
| Ancient Mountain | 절차 지형(경사, 고도 3 중 블렌딩)과 하늘, 구름, 섀도우 맵, 걷기 / 달리기 / 등반하는 캐릭터 | [열기](https://vanillapunch.com/tools/demo/ancientmountain/) | [`examples/ancientmountain`](examples/ancientmountain) |
| Neon Horizon | 절차 하늘(초콜릿 하늘, 바닐라 태양)과 함대 3D 모델, 엔진 글로우, 기함 주포 연출 | [열기](https://vanillapunch.com/tools/demo/neonhorizon/) | [`examples/neonhorizon`](examples/neonhorizon) |
| UI Showcase | UI 컴포넌트 전시. 버튼, 스크롤 뷰, 리스트, 차트, 다이얼로그, 레이아웃 | [열기](https://vanillapunch.com/tools/demo/uishowcase/) | [`examples/uishowcase`](examples/uishowcase) |
| Particle Effects | 불 / 분수 / 눈 / 비 / 폭발 등 파티클 프리셋 18 종 | [열기](https://vanillapunch.com/tools/demo/particleeffects/) | [`examples/particleeffects`](examples/particleeffects) |
| Timeline Showcase | 타임라인 편집기로 만든 문서 8 종 재생. 트랜스포트, 스크럽, 마커 / 이벤트 | [열기](https://vanillapunch.com/tools/demo/timelineshowcase/) | [`examples/timelineshowcase`](examples/timelineshowcase) |
| Sprite Effects | `ShaderSprite` 49 종, `ScreenEffect` 58 종, 게임 연출 조합 시연 | [열기](https://vanillapunch.com/tools/demo/spriteeffects/) | [`examples/spriteeffects`](examples/spriteeffects) |

배포본이 없는 예제: [`examples/cameratour`](examples/cameratour)(돌아가는 `Camera2D`, 노드 트윈, `Indicator`), [`examples/toonmaterial`](examples/toonmaterial)(툰 확장 시험 장면: 머티리얼 셰이더 조각, 텍스처와 데칼, 점광, 반 램버트 띠, 더하기 홀로그램, 평면 거울, 영구 인스턴스 버퍼), [`examples/toonstyle`](examples/toonstyle)(툰 셰이딩과 바깥선 견주기 장면, 러스트 예제 toonstyle 과 같은 장면)

러스트 엔진 예제와 이름, 장면이 같은 예제(배포본 없음): [`examples/nodebasics`](examples/nodebasics)(노드와 컴포넌트, 직접 만든 컴포넌트), [`examples/asyncawait`](examples/asyncawait)(async loadAssets, `Wait.seconds`, `Wait.nextFrame`, `fadeScreen`), [`examples/blendmodes`](examples/blendmodes)(블렌드 모드 26 가지, 파티클 쿼드, 바꿔 끼운 셰이더, 반투명 렌더 타겟), [`examples/devtoolsshowcase`](examples/devtoolsshowcase)(개발자 도구 하이어라키와 인스펙터), [`examples/loadingshowcase`](examples/loadingshowcase)(`AssetLoader`, 바꾼 로딩 화면, `FixedStepper`, `BuildInfo`), [`examples/misctour`](examples/misctour)(`ImageScroller`, `Camera2D`, `PathFinder`, `NodeLayout`, `Typewriter`, `FloatingText`, `TouchEffect`, `SpriteAnimator`, `VirtualPad`), [`examples/engineextras`](examples/engineextras)(`Outline`, `UIProgressRing`, `SoftShade`, 글자 꾸밈, `CameraGestures`, 단추 반응, 토스트), [`examples/inputgallery`](examples/inputgallery)(`UIInputField`, 리치텍스트, `InputActions`, 흉내 낸 입력), [`examples/effectgallery`](examples/effectgallery)(`ShaderSprite` 50 가지, 영역에 건 `ScreenEffect`, `TrailRenderer`, `ParticleSystem` 여덟), [`examples/glyphparity`](examples/glyphparity)(글자 래스터 견주기), [`examples/audiotone`](examples/audiotone)(소리 장치 확인), [`examples/gamepadlist`](examples/gamepadlist)(게임패드 목록)

러스트 엔진 예제와 이름, 장면이 같은 예제 2(배포본 없음, `?capture=` 로 같은 프레임을 찍어 견줌): [`examples/quickstart`](examples/quickstart)(빠른 시작, 흰 사각형 하나), [`examples/scenedocument`](examples/scenedocument)(`UIDocument` 씬 파일 읽기와 다시 내보내기), [`examples/uiscenelayout`](examples/uiscenelayout)(`UIScene`, `UINode` 제약 레이아웃, 세이프 에어리어 가이드), [`examples/textshaping`](examples/textshaping)(오른쪽에서 왼쪽 글, 기울임과 굵게, 낱말 줄바꿈, 색 이모지, `DynamicFont`), [`examples/textnodeextras`](examples/textnodeextras)(글자 칸 맞춤, `drawRing`, `drawArc`, `drawLineSegments`, `SpriteAtlas`, `convertViewToLocal`), [`examples/toonshowcase`](examples/toonshowcase)(기본 도형, GLB 뼈대 움직임, 인스턴싱 바위 2 천, 그림자, HDR 블룸), [`examples/toonfx`](examples/toonfx)(`ToonScreenOutline`, `ToonVfx` 터짐, 빔, 번개, 리본), [`examples/toonview`](examples/toonview)(`ToonView3D`, `ToonDrawQueue`, `Camera3D.projectToView`, 색 보정), [`examples/toonpost`](examples/toonpost)(`ToonPostProcess` 멀티샘플, 다단 블룸, LDR 길, `ToonVfx` 자국과 사건 열쇠), [`examples/uigallery`](examples/uigallery)(단추, 토글, 슬라이더, 진행률, 이미지 뷰, 스크롤 뷰, 흉내 낸 입력), [`examples/uigallery2`](examples/uigallery2)(목록, 스냅 뷰, 드롭다운, 끌기, 차트, 스피너, 토스트, 메뉴, 대화 상자), [`examples/windowshowcase`](examples/windowshowcase)(`UIWindowLayer` 창 쌓기, 확인 창, `fadeScreen`, 게임 영역 기준, 놀이 입력), [`examples/panelayout`](examples/panelayout)(`Pane`, `PaneStyle` 화면 분할 패널), [`examples/modelviewer`](examples/modelviewer)(`SkinnedModel` GLB 와 FBX 읽기, FBX 애니메이션 붙이기, 코드로 짓는 땅 GLB, `ShadowMap`, `RenderTarget`, `BloomEffect` 합성, `?measureAssetCache=1` 자산 캐시 재기)

## 게임

엔진으로 만든 플레이 가능한 결과물입니다.

| 게임 | 링크 |
| --- | --- |
| Pipe Mania | [열기](https://vanillapunch.com/games/#pipemania) |

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
	experimental/ 0.4.0 뒤 기능의 초안 (import.js 와 묶음에 들지 않음, experimental.js 를 직접 불러옴, API 가 바뀔 수 있음)
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
- 엔진 소개: <https://vanillapunch.com/tools/#vanillajs>
- 문서: <https://vanillapunch.com/docs/vanilla.js/>
- 업데이트 소식: <https://vanillapunch.com/news/?kind=patch>
- 문의: <https://vanillapunch.com/support/>

## 라이선스

[MIT](LICENSE) © vanillapunch

- 엔진에 들어간 제3자 코드와 표(크로미엄과 블링크, tween.js, Kiwi, gl-matrix, Separable SSS, 초안의 libtiled 와 Box2D)의 고지는 [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) 에 모았습니다. 런타임 패키지 의존은 없습니다. 묶음과 웹 도구 html 머리의 한 줄 주석이 엔진 라이선스와 이 파일을 가리킵니다. 엔진을 묶어 낸 게임은 LICENSE 와 이 파일을 함께 냅니다. (`tools/project.cjs build` 가 출력에 두 파일을 복사합니다)
- 기본 글꼴 DOSGothic(MIT, https://github.com/hurss/fonts)은 묶음에 들지 않고 실행할 때 jsDelivr 에서 받습니다. (`src/core/engine.js`)
- 예제 자산(`examples/`)의 출처와 라이선스는 THIRD_PARTY_LICENSES.md 의 Example Assets 와 자산 폴더의 README.md 에 있습니다. 3D 캐릭터와 애니메이션은 Quaternius(CC0), 여우는 Khronos 샘플(CC0 과 CC BY 4.0)입니다. oldface 의 얼굴 에셋은 MetaHuman(Epic Games, 데모 전용, https://www.metahuman.com/ , https://www.metahuman.com/en-US/license)이고 엔진 라이선스에 들지 않습니다. (`examples/oldface/ASSETS_LICENSE.md`)
