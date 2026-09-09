<div align="center">

# vanilla.js

**외부 의존성 없이 바닐라 자바스크립트로 만드는 경량 웹게임 엔진**

[![version](https://img.shields.io/badge/version-0.5.8--experimental-d4b06a?style=flat-square)](UPDATE.md)
[![license](https://img.shields.io/badge/license-MIT-3f3f46?style=flat-square)](LICENSE)
[![dependencies](https://img.shields.io/badge/dependencies-0-3f3f46?style=flat-square)](import.js)
[![renderer](https://img.shields.io/badge/renderer-WebGL2-3f3f46?style=flat-square)](src/core/graphic.js)
[![jsdoc](https://img.shields.io/badge/typing-JSDoc-3f3f46?style=flat-square)](src)

[샘플](#샘플) · [도구](#도구) · [빠른 시작](#빠른-시작) · [주요 기능](#주요-기능) · [업데이트 기록](UPDATE.md)

</div>

---

## 소개

vanilla.js 는 외부 라이브러리 없이 브라우저에서 바로 동작하는 웹게임 엔진입니다.
번들 하나를 모듈로 불러오면 씬 · 노드 · 입력 · UI · 파티클 · 오디오가 모두 준비됩니다.

- 런타임 의존성 0, 번들 `build/vanilla.min.js` 약 455 KB
- WebGL2 단일 프로그램 렌더러. 스프라이트 · 텍스트 · 도형 · 마스크가 같은 출력 경로를 씁니다
- 노드 / 컴포넌트 구조, 해상도 대응 뷰, 제약 기반 레이아웃을 갖춘 UI 시스템
- 파티클 · 셰이더 효과 · 타임라인 · 스키닝 3D 가 같은 API 위에 얹혀 있습니다
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

번들을 직접 만들 때는 esbuild 를 씁니다.

```bash
esbuild import.js --bundle --outfile=build/vanilla.js --format=esm --keep-names --sourcemap
esbuild import.js --bundle --outfile=build/vanilla.min.js --format=esm --minify
```

## 주요 기능

| 갈래 | 내용 |
| --- | --- |
| 코어 | `Engine` 루프 · `Scene` / `SceneManager` · `Node` 계층(`WorldNode` / `UINode`) · `Component` · `TimeManager` · `InputManager` · `ViewManager`(해상도 대응) · `TouchRaycaster` / `TouchRecognizer` |
| 렌더링 | WebGL2 `Graphic`(스프라이트 · 텍스트 · 리치 텍스트 · 도형 · 둥근 사각형 · 스텐실 클립) · `Mask` · `Camera2D` · 글자 텍스처 캐시 · 셰이더 프로그램 교체 |
| UI | 버튼 / 토글 / 스크롤 뷰 / 스크롤 바 / 슬라이더 / 입력 필드 / 진행 바 / 리스트 뷰 / 드롭다운 / 컨텍스트 메뉴 / 다이얼로그 / 토스트 / 스피너 / 선·막대 차트 · 제약 기반 레이아웃(`LayoutSolver`) |
| 효과 | `ParticleSystem`(방출 모양 · 버스트 · 수명 곡선) · `TrailRenderer` · `ShaderSprite` 48 종 · `ScreenEffect` 58 종 · `Shaker` · `FloatingText` |
| 애니메이션 | `Timeline` 런타임(트랙 보간 · 이징 31 종 + 베지어 · 이벤트 / 마커 / 사운드 / 파티클) · `Animator` 상태 기계 · `Tween` · `SpriteAnimator` |
| 3D (실험) | `SkinnedModel`(glTF / GLB / FBX · 스키닝 · 모프 타깃) · `SkinnedModelRenderer` · `ShadowMap` · `BloomEffect` · `AmbientOcclusionEffect` · `SubsurfaceScatteringEffect` · `HumanSkinRenderer` · `Material` / `RenderTarget` / `FullscreenPass` |
| 게임 보조 | `FiniteStateMachine` · `PathFinder` · `Grid` · `Collision2D` · `Steering2D` · `PlatformerBody` · `ObjectPool` · `SeededRandom` · `Localization` · `PersistedStore` · `DialogueRunner` · `Typewriter` |
| 오디오 | `AudioPlayer` · `AudioAsset` · `SoundEffectPool` · `BeepPlayer` |

## 도구

엔진과 함께 쓰는 웹 저작 도구입니다. 브라우저에서 바로 열리고, 결과물은 JSON 문서로 저장됩니다.

| 도구 | 설명 | 데모 | 소스 |
| --- | --- | --- | --- |
| UI Editor | 노드 트리 · 인스펙터 · 캔버스 편집으로 UI 화면을 짜고 `.ui.json` 으로 저장 | [열기](https://ddukbaek2.com/portfolio/uieditor/) | [`tools/uieditor`](tools/uieditor) |
| Particle Editor | 파티클 프리셋 저작. 미리보기에서 값을 바꾸며 조정 | [열기](https://ddukbaek2.com/portfolio/particleeditor/) | [`tools/particleeditor`](tools/particleeditor) |
| Timeline Editor | 유니티 타임라인 / 언리얼 시퀀서 쓰임새의 키프레임 저작. 도프 시트 + 커브, 자동 키, 이벤트 / 마커 | [열기](https://ddukbaek2.com/portfolio/timelineeditor/) | [`tools/timelineeditor`](tools/timelineeditor) |
| Visual Editor | 씬 / 게임 뷰 · 계층 · 인스펙터를 갖춘 통합 편집기 | [열기](https://ddukbaek2.com/portfolio/visualeditor/) | [`tools/visualeditor`](tools/visualeditor) |

명령줄 도구는 Node.js 로 실행합니다. 자세한 사용법은 [`tools/TOOLS.md`](tools/TOOLS.md) 에 있습니다.

| 명령 | 설명 |
| --- | --- |
| `node tools/atlas.cjs <폴더>` | 이미지 여러 장을 텍스처 한 장으로 묶기 |
| `node tools/project.cjs build --script <진입> --input <입력> --output <출력>` | 템플릿 복사 + esbuild 번들링 |
| `node tools/project.cjs check --input <입력>` | 자산 현황 점검 |
| `node tools/webm.cjs <폴더>` | 음원을 webm 으로 변환 |
| `node tools/mangle.cjs <입력> <출력> <제외 문자열>` | 코드 내 문자열 정리 |
| `node tools/excel.cjs` / `node tools/table.cjs` | 엑셀 · 테이블 데이터 처리 |

## 샘플

모두 저장소의 `examples/` 에 소스가 있고, 아래 링크는 배포본입니다.

| 샘플 | 설명 | 데모 | 소스 |
| --- | --- | --- | --- |
| Toon Shading | VRM 1.0 캐릭터의 애니풍 렌더링. 3 톤 램프 · 구면 노멀 얼굴 그림자 · 앞머리 그림자 · 천사 고리 · 화면 공간 림 · 아웃라인 · 스프링 본, Mixamo 본 애니메이션 8 종 | [열기](https://ddukbaek2.com/portfolio/toonshading/) | [`examples/toonshading`](examples/toonshading) |
| Old Face | 메타휴먼 얼굴 PBR. 서브서피스 스캐터링 · 표정 주름 맵 · 그룸 카드 머리카락 · 눈 굴절 · 머티리얼 그래프 패널 | [열기](https://ddukbaek2.com/portfolio/oldface/) | [`examples/oldface`](examples/oldface) |
| Ancient Mountain | 절차 지형(경사 · 고도 3 중 블렌딩)과 하늘 · 구름 · 섀도우 맵, 걷기 / 달리기 / 등반하는 캐릭터 | [열기](https://ddukbaek2.com/portfolio/ancientmountain/) | [`examples/ancientmountain`](examples/ancientmountain) |
| Neon Horizon | 절차 하늘(초콜릿 하늘 · 바닐라 태양)과 함대 3D 모델, 엔진 글로우 · 기함 주포 연출 | [열기](https://ddukbaek2.com/portfolio/neonhorizon/) | [`examples/neonhorizon`](examples/neonhorizon) |
| UI Showcase | UI 컴포넌트 전시. 버튼 · 스크롤 뷰 · 리스트 · 차트 · 다이얼로그 · 레이아웃 | [열기](https://ddukbaek2.com/portfolio/uishowcase/) | [`examples/uishowcase`](examples/uishowcase) |
| Particle Effects | 불 / 분수 / 눈 / 비 / 폭발 등 파티클 프리셋 18 종 | [열기](https://ddukbaek2.com/portfolio/particleeffects/) | [`examples/particleeffects`](examples/particleeffects) |
| Timeline Showcase | 타임라인 편집기로 만든 문서 8 종 재생. 트랜스포트 · 스크럽 · 마커 / 이벤트 | [열기](https://ddukbaek2.com/portfolio/timelineshowcase/) | [`examples/timelineshowcase`](examples/timelineshowcase) |
| Sprite Effects | `ShaderSprite` 48 종 · `ScreenEffect` 58 종 · 게임 연출 조합 시연 | [열기](https://ddukbaek2.com/portfolio/spriteeffects/) | [`examples/spriteeffects`](examples/spriteeffects) |

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
	base/         수학 · 색 · 자료구조 · 난수
	core/         엔진 루프 · 씬 · 노드 · 입력 · 렌더링(Graphic)
	ui/           UI 컴포넌트 · 레이아웃
	effect/       파티클 · 트레일 · ShaderSprite · ScreenEffect
	experimental/ 3D 그래픽스 · 타임라인
	game/ misc/   게임 보조 기능
	resource/     애셋 로더
	web/          브라우저 연동
examples/       샘플 (배포본과 같은 소스)
tools/          웹 저작 도구 + 명령줄 도구
build/          번들 산출물 (vanilla.js / vanilla.min.js)
import.js       공개 API 진입점
UPDATE.md       업데이트 기록
```

## 개발 환경

- Windows 11 Pro
- VSCode
	- Gemini Code Assist / Korean Language Pack / Live Server / Task Explorer
- Node.js v24
	- esbuild (번들링) · jsdoc (문서 생성)

## 링크

- 저장소: <https://github.com/ddukbaek2/vanilla.js>
- 템플릿: <https://github.com/ddukbaek2/playablegames-template>
- 배포 페이지: <https://ddukbaek2.com/vanilla.js>

## 라이선스

[MIT](LICENSE) © ddukbaek2
