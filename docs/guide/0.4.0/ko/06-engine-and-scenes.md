# 엔진과 씬

`EngineConfiguration` 으로 엔진을 정하고 `Engine.run` 으로 첫 씬을 돌리는 데서 시작해, 씬의 메서드가 불리는 차례, 씬 바꾸기, 시간, 화면 크기와 기준 해상도, 페이지 이벤트를 봅니다.

## 엔진 설정 (EngineConfiguration)

`new EngineConfiguration()` 으로 만든 뒤 칸을 고쳐 `new Engine(engineConfiguration)` 에 넘깁니다. 처음 값은 생성자에 적힌 값입니다.

| 칸 | 처음 값 | 뜻 |
| --- | --- | --- |
| `referenceResolutionSize` | `Vector2.zero()` | 기준 해상도. `ViewScaleMode.none` 이 아닌 모드가 이 크기를 뷰로 씁니다 |
| `canvasId` | `""` | 쓸 캔버스의 아이디. 그런 요소가 없으면 그 아이디로 `<canvas>` 를 만들어 `body` 에 붙입니다 |
| `autoResizeOnWindowResize` | `false` | 창(`visualViewport` 가 있으면 그것) 크기가 바뀔 때 캔버스의 CSS 크기를 창에 맞출지 |
| `title` | `""` | 빈 글이 아니면 엔진을 만들 때 `document.title` 로 씁니다 |
| `useStatistics` | `false` | 화면에 정보창을 그릴지 |
| `preserveDrawingBuffer` | `false` | 프레임이 끝난 뒤에도 그린 것을 캔버스에 남길지 (다른 캔버스가 읽어 갈 때) |
| `maximumFramePerSecond` | `0` | 최대 FPS. 0 이면 화면 주사율을 따릅니다. 실행 중에는 `engine.setMaximumFramePerSecond` 로 바꿉니다 |
| `defaultFontUrl` | `""` | `run` 이 뒤에서 받아 글꼴 이름 `"default"` 로 올리는 기본 글꼴. 빈 글이면 받지 않고 시스템 글꼴로 그립니다 |
| `ignoreVirtualKeyboardResize` | `false` | 글자 입력칸에 초점이 있는 동안 세로만 줄어드는 리사이즈(모바일 화면 키보드)를 무시할지 |
| `rebakeTextOnFontLoad` | `false` | 웹 글꼴이 늦게 받아지면 그 글꼴로 구운 글자 텍스처를 다시 구울지 |
| `useDevTools` | `true` | 개발자 도구(F2 패널)를 쓸지. 출시 빌드에서 끕니다 |
| `maxCanvasAspectRatio` | `0` | 캔버스의 긴 쪽이 짧은 쪽의 몇 배까지인지. 0 이면 제한하지 않고, 정하면 `autoResizeOnWindowResize` 로 맞출 때 창이 더 길쭉하면 캔버스를 줄여 가운데에 둡니다 |
| `resumeAudioOnTouchEnd` | `false` | 손을 뗄 때(`touchend`, `pointerup`)에도 오디오 컨텍스트를 깨울지 |

## 엔진 만들고 돌리기

```javascript
import { Engine, EngineConfiguration, Scene, Vector2 } from "./build/vanilla.js";

class MainScene extends Scene {
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.canvasId = "mainCanvas";
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
engineConfiguration.autoResizeOnWindowResize = true;
engineConfiguration.title = "My Game";
const engine = new Engine(engineConfiguration);
engine.run(new MainScene());

const sameEngine = Engine.getEngine();
const versionString = engine.getVersionString();
console.log(sameEngine === engine, versionString);
```

`new Engine(engineConfiguration)` 은 이런 일을 합니다.

- 넘긴 것이 `EngineConfiguration` 이 아니면 예외를 던집니다.
- 캔버스를 찾거나 만들고, `Graphic`(WebGL2), `SceneManager`, `TimeManager`, `ViewManager`, `InputManager`, 오디오 매니저를 만듭니다.
- 자신을 전역에 올려 `Engine.getEngine()` 으로 어디서나 얻게 합니다.
- 키보드, 마우스, 터치, 게임패드, 페이지 가시성 같은 문서 이벤트를 걸고 화면 크기를 한 번 잽니다.

`engine.run(scene)` 은 씬이 `Scene` 이 아니면 예외를 던지고, 씬 불러오기를 뒤에서 시작한 뒤 바로 프레임 루프(`requestAnimationFrame`)를 돌립니다. 기본 글꼴도 뒤에서 받습니다. `run` 은 한 번만 부르고, 다음 씬부터는 `loadScene` 으로 올립니다.

엔진이 가진 것은 `getTimeManager()`, `getViewManager()`, `getInputManager()`, `getGraphic()`, `getCanvas()`, `getEngineConfiguration()` 으로 얻습니다. 씬 안에서는 `this.getEngine()` 으로 엔진을 얻습니다.

## 씬의 생명 주기

`Scene` 을 이어받아 필요한 메서드만 덮어씁니다. 불리는 차례는 이렇습니다.

1. `new MyScene()`: 생성자. 루트 노드는 아직 없습니다.
2. `create()`: `SceneManager` 가 불러올 때 부릅니다. 기본 구현이 루트 노드(이름 "root" 인 `WorldNode`)를 만듭니다.
3. `load(engine)`: 비동기. 애셋을 받는 자리입니다. 기본 구현은 루트 노드를 왼쪽 위 기준점, 뷰 크기로 맞춥니다.
4. `load` 가 끝나면 0.3 초를 더 기다린 뒤 `initialize(engine)` 를 부릅니다.
5. `load` 가 도는 동안 엔진은 매 프레임 `drawOnLoad(graphic)` 만 부릅니다. (로딩 화면)
6. 그 뒤로 매 프레임 `tick(timeDelta)`, `preDraw(graphic)`, `draw(graphic)`, `postDraw(graphic)` 차례로 부릅니다. `setGizmoVisible(true)` 면 그 뒤에 `drawGizmos(graphic)` 도 부릅니다.
7. 화면 크기가 바뀌면 `resize(canvasNativeSize)` 를 부릅니다.
8. 내릴 때 `finalize(engine)`, 그다음 비동기 `unload(engine)` 를 부르고 목록에서 뺍니다. `destroy()` 는 부르지 않습니다.

기본 `tick` 은 루트 노드의 `tick`, 터치 넘기기(`touchPress`, `touchMove`, `touchRelease`, `touchCancel`, `touchWheel`), 트윈 갱신을 차례로 합니다. 기본 `draw` 는 `graphic.drawNode(root)` 로 노드 트리를 그립니다. 그래서 덮어쓸 때는 부모 것을 부릅니다.

```javascript
import { Engine, EngineConfiguration, Scene, Vector2 } from "./build/vanilla.js";

class LifecycleScene extends Scene {
	#tickCount;

	constructor() {
		super();
		this.#tickCount = 0;
		console.log("constructor");
	}

	create() {
		super.create();
		const root = this.getRoot();
		const rootName = root.getName();
		console.log("create", rootName);
	}

	async load(engine) {
		await super.load(engine);
		console.log("load");
	}

	initialize(engine) {
		super.initialize(engine);
		console.log("initialize");
	}

	tick(timeDelta) {
		super.tick(timeDelta);
		this.#tickCount += 1;
		if (this.#tickCount === 1) {
			console.log("first tick", timeDelta);
		}
	}

	draw(graphic) {
		super.draw(graphic);
	}

	resize(canvasNativeSize) {
		super.resize(canvasNativeSize);
		console.log("resize", canvasNativeSize.x, canvasNativeSize.y);
	}

	finalize(engine) {
		console.log("finalize");
		super.finalize(engine);
	}

	async unload(engine) {
		console.log("unload");
		await super.unload(engine);
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
engineConfiguration.autoResizeOnWindowResize = true;
const engine = new Engine(engineConfiguration);
engine.run(new LifecycleScene());
```

엔진 쪽에서 본 한 프레임은 이렇습니다. 최대 FPS 거르기, `Graphic` 상태 되돌리기, `TimeManager` 갱신, `InputManager` 갱신(게임패드, 입력 동작), 불러온 씬마다 위의 5 번(불러오는 중)이나 6 번, 정보창(켰을 때), 남은 묶음 그리기, 마우스 커서, 한 프레임짜리 입력 표시 지우기, 검증용 화면 저장(요청했을 때). 씬 하나에서 난 예외는 그 씬에서 잡아 `console.error` 로 찍고 루프는 계속 돕니다.

## 씬 바꾸기

엔진이 불러온 씬 목록을 들고 위의 차례를 지킵니다. `engine.loadScene(scene)`, `engine.unloadScene(scene)`, `engine.unloadAllScenes()` 로 올리고 내리며, 모두 Promise 를 돌려줍니다. 불러온 씬 목록은 `engine.getAllLoadedScenes()` 로 얻습니다. (러스트 판 get_all_loaded_scenes 와 같다, 씬 매니저는 엔진 안쪽이라 내보내지 않는다) `loadScene` 의 Promise 는 `initialize` 까지 끝나면 풀립니다.

씬은 여럿을 함께 올릴 수 있습니다. 올린 씬은 모두 매 프레임 갱신되고, 올린 차례로 그려집니다. (나중에 올린 씬이 위) 바꿀 때는 다음 씬을 먼저 올려 두고, 다 올라오면 지금 씬을 내리면 화면이 비지 않습니다.

```javascript
import { Engine, EngineConfiguration, Scene, Vector2, Rect, Color } from "./build/vanilla.js";

class ViewScene extends Scene {
	preDraw(graphic) {
		super.preDraw(graphic);
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		viewManager.applyViewRect(graphic);
	}
}

class MainScene extends ViewScene {
	draw(graphic) {
		super.draw(graphic);
		graphic.setFillColor(new Color(0.2, 0.6, 1, 1));
		graphic.drawRect(Rect.create(100, 100, 300, 200));
	}
}

class SplashScene extends ViewScene {
	#elapsedSeconds;
	#isLeaving;

	constructor() {
		super();
		this.#elapsedSeconds = 0;
		this.#isLeaving = false;
	}

	tick(timeDelta) {
		super.tick(timeDelta);
		this.#elapsedSeconds += timeDelta;
		if (this.#isLeaving || this.#elapsedSeconds < 0.5) {
			return;
		}
		this.#isLeaving = true;
		this.changeScene().catch((error) => {
			console.error(error);
		});
	}

	async changeScene() {
		const engine = this.getEngine();
		const mainScene = new MainScene();
		await engine.loadScene(mainScene);
		await engine.unloadScene(this);
	}

	draw(graphic) {
		super.draw(graphic);
		graphic.setFillColor("#ffffff");
		graphic.drawRect(Rect.create(540, 320, 200, 80));
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
engineConfiguration.autoResizeOnWindowResize = true;
const engine = new Engine(engineConfiguration);
engine.run(new SplashScene());
```

- 이미 올라 있는 씬을 다시 `loadScene` 하거나, 올라 있지 않은 씬을 `unloadScene` 하면 아무것도 하지 않습니다.
- 내린 씬 객체는 다시 올릴 수 있습니다. 올릴 때마다 `create()` 가 다시 불려 루트 노드를 새로 만듭니다.

## 시간 (TimeManager)

`tick(timeDelta)` 의 `timeDelta` 는 지난 프레임부터 흐른 초에 시간 배율을 곱한 값입니다. 한 프레임 간격은 0 에서 상한(처음 0.25 초) 사이로 자릅니다. 탭이 가려졌다 돌아온 첫 프레임이 크게 뛰지 않게 하려는 것입니다.

| 메서드 | 내용 |
| --- | --- |
| `getTimeDelta()` | 배율을 곱한 프레임 간격 (초). 씬과 노드의 `tick` 이 받는 값 |
| `getUnscaleDeltaTime()` | 배율을 곱하기 전 프레임 간격 (초) |
| `getTime()` | 엔진이 시작한 뒤 흐른 시간 (초, 배율을 곱하기 전 간격을 더한 것) |
| `getRealtimeSinceStartup()` | 페이지가 시작한 뒤의 시각 (초, `requestAnimationFrame` 의 시각) |
| `getFramePerSecond()` | 지난 1 초 동안 그린 프레임 수 |
| `setTimeScale(timeScale)`, `getTimeScale()` | 시간 배율 (처음 1). 0 이면 `tick` 은 계속 불리지만 `timeDelta` 가 0 입니다 |
| `setMaximumTimeDelta(seconds)`, `getMaximumTimeDelta()` | 한 프레임 간격의 상한 (처음 0.25 초, 0 보다 작거나 숫자가 아니면 0.25) |

```javascript
import { Engine, EngineConfiguration, Scene, Vector2 } from "./build/vanilla.js";

class TimeScene extends Scene {
	initialize(engine) {
		super.initialize(engine);
		const timeManager = engine.getTimeManager();
		timeManager.setTimeScale(0.5);
		timeManager.setMaximumTimeDelta(0.1);
	}

	tick(timeDelta) {
		super.tick(timeDelta);
		const engine = this.getEngine();
		const timeManager = engine.getTimeManager();
		const framePerSecond = timeManager.getFramePerSecond();
		const time = timeManager.getTime();
		engine.setTitle(`${framePerSecond} FPS, ${time.toFixed(1)} s`);
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
engineConfiguration.autoResizeOnWindowResize = true;
const engine = new Engine(engineConfiguration);
engine.run(new TimeScene());
```

## 화면과 기준 해상도 (ViewManager, ViewScaleMode)

`ViewManager` 가 다루는 크기는 이렇습니다.

| 이름 | 뜻 |
| --- | --- |
| `getCanvasNativeSize()` | 캔버스 요소의 CSS 픽셀 크기 |
| `getDevicePixelRatio()` | 기기 배율 (`setMaxRenderPixelRatio` 로 상한을 걸 수 있습니다) |
| `getCanvasPixelSize()` | 캔버스의 실제 픽셀 크기 (CSS 크기 x 기기 배율) |
| `getReferenceResolutionSize()` | 기준 해상도 (`EngineConfiguration.referenceResolutionSize`) |
| `getViewNativeRect()` | 캔버스 안에서 뷰가 차지하는 사각형 (CSS 픽셀) |
| `getViewSize()` | 게임 코드가 쓰는 뷰 크기. 노드 배치와 입력 좌표가 이 단위입니다 |

뷰를 어떻게 정할지는 `ViewScaleMode` 로 고릅니다. 처음은 `none` 입니다.

| 모드 | 뷰 크기 | 남는 곳 |
| --- | --- | --- |
| `none` | 캔버스 CSS 크기 그대로 (늘이지 않음) | 없음 |
| `referenceResolution` | 기준 해상도, 늘이지 않고 가운데 | 양쪽 축이 잘리거나 남음 |
| `stretchWidth` | 기준 해상도, 가로를 캔버스에 맞춰 늘임 | 세로가 잘리거나 남음 |
| `stretchHeight` | 기준 해상도, 세로를 캔버스에 맞춰 늘임 | 가로가 잘리거나 남음 |
| `stretchShort` | 기준 해상도, 짧은 축을 맞춰 늘임 | 긴 축에 여백 |
| `stretchWidthExpandHeight` | 가로는 기준 해상도, 세로는 화면 비율대로 | 없음 |
| `stretchHeightExpandWidth` | 세로는 기준 해상도, 가로는 화면 비율대로 | 없음 |
| `stretchShortExpandLong` | 짧은 축은 기준 해상도, 긴 축은 화면을 채움 | 없음 |

`applyAspectViewScaleMode()` 는 화면이 기준 해상도보다 세로로 길면 `stretchWidthExpandHeight`, 아니면 `stretchHeightExpandWidth` 를 고릅니다.

엔진은 씬마다 `preDraw` 앞(로딩 중이면 `drawOnLoad` 앞)에 뷰 좌표(`applyViewRect`)를 걸어 둡니다. 씬이 받는 터치 좌표와 같은 좌표라, 기기 픽셀 배율이 2 인 화면(레티나 같은)에서도 같은 크기와 자리로 그려집니다. 씬은 `preDraw` 에서 좌표계를 바꿀 수 있고, 캔버스의 실제 픽셀로 그리려면 `graphic.setTransform(1, 0, 0, 1, 0, 0)` 을 부릅니다.

- `viewManager.applyCanvasNativeRect(graphic)`: 캔버스 전체를 CSS 픽셀로. 바탕을 캔버스 끝까지 칠할 때 씁니다.
- `viewManager.applyViewRect(graphic)`: 뷰 좌표로. (0, 0) 이 뷰의 왼쪽 위이고 오른쪽 아래가 `getViewSize()` 입니다. 씬이 받는 터치 좌표도 이 좌표입니다.

```javascript
import { Engine, EngineConfiguration, Scene, Vector2, Rect, Color, ViewScaleMode } from "./build/vanilla.js";

class LetterboxScene extends Scene {
	async load(engine) {
		const viewManager = engine.getViewManager();
		viewManager.setViewScaleMode(ViewScaleMode.stretchShort);
		await super.load(engine);
	}

	preDraw(graphic) {
		super.preDraw(graphic);
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		const canvasNativeSize = viewManager.getCanvasNativeSize();
		viewManager.applyCanvasNativeRect(graphic);
		graphic.setFillColor("#202028");
		graphic.drawRect(Rect.create(0, 0, canvasNativeSize.x, canvasNativeSize.y));
		viewManager.applyViewRect(graphic);
	}

	draw(graphic) {
		super.draw(graphic);
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		const viewSize = viewManager.getViewSize();
		graphic.setFillColor(new Color(0.15, 0.3, 0.5, 1));
		graphic.drawRect(Rect.create(0, 0, viewSize.x, viewSize.y));
		graphic.setFillColor("#ffffff");
		graphic.drawRect(Rect.create(0, 0, 80, 80));
		graphic.drawRect(Rect.create(viewSize.x - 80, viewSize.y - 80, 80, 80));
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
engineConfiguration.autoResizeOnWindowResize = true;
const engine = new Engine(engineConfiguration);
engine.run(new LetterboxScene());
```

그 밖의 쓰임입니다.

- `applyReferenceResolutionSize(size)`: 실행 중에 기준 해상도를 바꾸고 뷰를 다시 셉니다.
- `canvasPositionToViewPosition(canvasPosition)`, `convertClientToView(clientX, clientY)`: 캔버스 좌표나 DOM 사건의 화면 좌표를 뷰 좌표로 바꿉니다.
- `getSafeAreaInsets()`: 노치와 홈 표시줄을 비킬 여백을 뷰 좌표로 줍니다. (`{ top, right, bottom, left }`)
- `setMaxRenderPixelRatio(ratio)`: 기기 배율이 높은 기기에서 캔버스 픽셀이 너무 많아지지 않게 상한을 겁니다. 0 이면 제한하지 않습니다.
- `getCssPixelScale()`: 뷰 한 단위가 화면에서 몇 CSS 픽셀인지 줍니다.

## 페이지 이벤트

엔진은 페이지가 가려지고 다시 보일 때, 창이 초점을 잃고 얻을 때, 창을 누를 때 등록한 리스너에 `PageEvent` 값을 넘깁니다.

| 값 | 때 |
| --- | --- |
| `PageEvent.hidden` | 페이지가 가려짐 (다른 탭, 앱 전환) |
| `PageEvent.visible` | 페이지가 다시 보임 |
| `PageEvent.blurred` | 창이 초점을 잃음 |
| `PageEvent.focused` | 창이 초점을 얻음 |
| `PageEvent.pointerDown` | 창을 누름 |

씬에는 덮어쓸 메서드가 둘 있습니다. `onPageVisibilityRestored()` 는 페이지가 다시 보일 때, `onPageProcessRestored()` 는 브라우저가 멈췄던 페이지를 되살릴 때(`resume` 사건, 뒤로 가기 캐시에서 돌아온 `pageshow`) 불립니다. 이 둘을 부르기 전에 엔진은 오디오 컨텍스트를 깨우고 눌린 키와 터치 상태를 지웁니다.

```javascript
import { Engine, EngineConfiguration, Scene, Vector2, PageEvent } from "./build/vanilla.js";

class PausingScene extends Scene {
	#pageEventListener;

	initialize(engine) {
		super.initialize(engine);
		this.#pageEventListener = (pageEvent) => {
			const timeManager = engine.getTimeManager();
			if (pageEvent === PageEvent.hidden) {
				timeManager.setTimeScale(0);
			}
			else if (pageEvent === PageEvent.visible) {
				timeManager.setTimeScale(1);
			}
		};
		engine.addPageEventListener(this.#pageEventListener);
		const isPageHidden = engine.isPageHidden();
		console.log("hidden at start", isPageHidden);
	}

	finalize(engine) {
		engine.removePageEventListener(this.#pageEventListener);
		super.finalize(engine);
	}

	onPageVisibilityRestored() {
		super.onPageVisibilityRestored();
		console.log("page visible again");
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
engineConfiguration.autoResizeOnWindowResize = true;
const engine = new Engine(engineConfiguration);
engine.run(new PausingScene());
```

## UIScene

`UIScene` 은 `Scene` 을 이어받아 자주 쓰는 일을 미리 해 둔 씬입니다. `setViewScaleMode` 로 정한 모드를 `initialize` 에서 걸고, `preDraw` 에서 캔버스 전체를 `setSceneBackgroundColor` 의 색(처음 검정)으로 칠한 뒤 뷰 좌표로 바꾸고, 터치를 `TouchRecognizer` 로 노드에 넘기고, `useDevTools` 가 켜져 있으면 개발자 도구를 붙입니다. 로딩 화면(게이지와 `setLoadingImageUrl` 의 그림)을 그리며, 로딩은 처음에 최소 3 초 보입니다. (`setLoadingMinDurationMs`, 화면을 누르면 바로 넘어갑니다) 제약 기반 레이아웃(`UINode`)은 "UI" 장에서 봅니다.

## 주의할 점

- 루트 노드는 생성자가 아니라 `create()` 에서 생깁니다. 생성자에서 `getRoot()` 는 아직 비어 있습니다. `create` 를 덮어쓸 때는 맨 앞에서 `super.create()` 를 부릅니다.
- `load` 를 덮어쓸 때는 `await super.load(engine)` 를 불러야 루트 노드가 뷰 크기를 받습니다. 뷰 모드를 바꾸려면 그보다 먼저 바꿉니다.
- `ViewScaleMode.none` 이 아닌 모드는 기준 해상도로 나눕니다. `referenceResolutionSize` 를 정하지 않으면(처음 값 0, 0) 뷰를 셀 수 없습니다.
- 엔진은 만들 때 받은 `referenceResolutionSize` 객체를 그대로 씁니다. 실행 중에 바꿀 때는 `applyReferenceResolutionSize` 를 부릅니다.
- `load` 가 끝나도 0.3 초 뒤에야 `initialize` 와 `tick` 이 시작됩니다.
- 씬을 내리지 않고 다음 씬을 올리면 두 씬이 함께 돌고 함께 그려집니다.

## 관련 클래스

Engine, EngineConfiguration, PageEvent, Scene, TimeManager, ViewManager, ViewScaleMode, UIScene, Graphic
