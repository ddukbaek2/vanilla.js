# Engine and Scenes

Starting from configuring the engine with `EngineConfiguration` and running the first scene with `Engine.run`, this chapter covers the order in which scene methods are called, switching scenes, time, screen size and reference resolution, and page events.

## Engine configuration (EngineConfiguration)

Create it with `new EngineConfiguration()`, change its fields, and pass it to `new Engine(engineConfiguration)`. The default values are the ones set in the constructor.

| Field | Default | Meaning |
| --- | --- | --- |
| `referenceResolutionSize` | `Vector2.zero()` | Reference resolution. Every mode other than `ViewScaleMode.none` uses this size for the view |
| `canvasId` | `""` | Id of the canvas to use. If no such element exists, a `<canvas>` with that id is created and appended to `body` |
| `autoResizeOnWindowResize` | `false` | Whether to fit the canvas's CSS size to the window (`visualViewport` if available) when the window size changes |
| `title` | `""` | If not empty, it is written to `document.title` when the engine is created |
| `useStatistics` | `false` | Whether to draw the statistics panel on screen |
| `preserveDrawingBuffer` | `false` | Whether to keep the drawn image on the canvas after the frame ends (when another canvas reads it) |
| `maximumFramePerSecond` | `0` | Maximum FPS. 0 follows the display refresh rate. Change it at run time with `engine.setMaximumFramePerSecond` |
| `defaultFontUrl` | DOSGothic address on jsdelivr | Default font that `run` fetches in the background. An empty string fetches nothing |
| `ignoreVirtualKeyboardResize` | `false` | Whether to ignore resizes that only shrink the height while a text input has focus (mobile on-screen keyboard) |
| `rebakeTextOnFontLoad` | `false` | Whether to rebake text textures baked with a web font that finished loading late |
| `useDevTools` | `true` | Whether to use the developer tools (F2 panel). Turn it off in release builds |
| `maxCanvasAspectRatio` | `0` | How many times the short side the canvas's long side may be. 0 means no limit; when set, if the window is more elongated while fitting with `autoResizeOnWindowResize`, the canvas is shrunk and centered |
| `resumeAudioOnTouchEnd` | `false` | Whether to also wake the audio context when a touch ends (`touchend`, `pointerup`) |

## Creating and running the engine

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

`new Engine(engineConfiguration)` does the following.

- It throws if what you pass is not an `EngineConfiguration`.
- It finds or creates the canvas and creates `Graphic` (WebGL2), `SceneManager`, `TimeManager`, `ViewManager`, `InputManager` and the audio manager.
- It registers itself globally so it can be obtained anywhere with `Engine.getEngine()`.
- It hooks document events such as keyboard, mouse, touch, gamepad and page visibility, and measures the screen once.

`engine.run(scene)` throws if the scene is not a `Scene`, starts loading the scene in the background, and immediately starts the frame loop (`requestAnimationFrame`). It also fetches the default font in the background. Call `run` only once; load later scenes with `loadScene`.

Get the engine's parts with `getSceneManager()`, `getTimeManager()`, `getViewManager()`, `getInputManager()`, `getGraphic()`, `getCanvas()` and `getEngineConfiguration()`. Inside a scene, get the engine with `this.getEngine()`.

## Scene lifecycle

Extend `Scene` and override only the methods you need. They are called in this order.

1. `new MyScene()`: the constructor. The root node does not exist yet.
2. `create()`: called by `SceneManager` when loading. The base implementation creates the root node (a `WorldNode` named "root").
3. `load(engine)`: asynchronous. This is where assets are loaded. The base implementation sets the root node's pivot to the top left and its size to the view size.
4. After `load` finishes, it waits another 0.3 seconds and then calls `initialize(engine)`.
5. While `load` runs, the engine calls only `drawOnLoad(graphic)` every frame. (loading screen)
6. After that, every frame calls `tick(timeDelta)`, `preDraw(graphic)`, `draw(graphic)` and `postDraw(graphic)` in order. With `setGizmoVisible(true)`, `drawGizmos(graphic)` is called after them.
7. When the screen size changes, `resize(canvasNativeSize)` is called.
8. When unloading, `finalize(engine)` is called, then the asynchronous `unload(engine)`, and the scene is removed from the list. `destroy()` is not called.

The base `tick` runs the root node's `tick`, touch dispatch (`touchPress`, `touchMove`, `touchRelease`, `touchCancel`, `touchWheel`) and tween updates, in that order. The base `draw` draws the node tree with `graphic.drawNode(root)`. So call the parent method when overriding.

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

Seen from the engine, one frame is: maximum FPS filtering, resetting the `Graphic` state, updating `TimeManager`, updating `InputManager` (gamepads, input actions), step 5 (while loading) or step 6 above for each loaded scene, the statistics panel (when on), drawing the remaining batch, the mouse cursor, clearing one-frame input flags, and saving a verification capture (when requested). An exception thrown in one scene is caught for that scene and logged with `console.error`, and the loop keeps running.

## Switching scenes (SceneManager)

`SceneManager` holds the list of loaded scenes and keeps the order above. The engine has `engine.loadScene(scene)`, `engine.unloadScene(scene)` and `engine.unloadAllScenes()` that do the same, and all of them return a Promise. The Promise of `loadScene` resolves once `initialize` has finished.

Several scenes can be loaded at once. All loaded scenes are updated every frame and drawn in the order they were loaded. (a scene loaded later is drawn on top) When switching, load the next scene first and unload the current one once it is up, so the screen never goes blank.

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

- Calling `loadScene` on a scene that is already loaded, or `unloadScene` on a scene that is not loaded, does nothing.
- An unloaded scene object can be loaded again. Each load calls `create()` again and builds a new root node.

## Time (TimeManager)

The `timeDelta` of `tick(timeDelta)` is the seconds elapsed since the last frame multiplied by the time scale. One frame interval is clamped between 0 and an upper limit (0.25 seconds by default), so the first frame after a hidden tab comes back does not jump far.

| Method | Description |
| --- | --- |
| `getTimeDelta()` | Frame interval multiplied by the scale (seconds). The value scene and node `tick` receive |
| `getUnscaleDeltaTime()` | Frame interval before the scale (seconds) |
| `getTime()` | Time elapsed since the engine started (seconds, the sum of unscaled intervals) |
| `getRealtimeSinceStartup()` | Time since the page started (seconds, the `requestAnimationFrame` timestamp) |
| `getFramePerSecond()` | Number of frames drawn during the last second |
| `setTimeScale(timeScale)`, `getTimeScale()` | Time scale (default 1). At 0, `tick` is still called but `timeDelta` is 0 |
| `setMaximumTimeDelta(seconds)`, `getMaximumTimeDelta()` | Upper limit of one frame interval (default 0.25 seconds; less than 0 or not a number becomes 0.25) |

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

## Screen and reference resolution (ViewManager, ViewScaleMode)

These are the sizes `ViewManager` deals with.

| Name | Meaning |
| --- | --- |
| `getCanvasNativeSize()` | Size of the canvas element in CSS pixels |
| `getDevicePixelRatio()` | Device pixel ratio (can be capped with `setMaxRenderPixelRatio`) |
| `getCanvasPixelSize()` | Real pixel size of the canvas (CSS size x device pixel ratio) |
| `getReferenceResolutionSize()` | Reference resolution (`EngineConfiguration.referenceResolutionSize`) |
| `getViewNativeRect()` | Rectangle the view occupies inside the canvas (CSS pixels) |
| `getViewSize()` | View size used by game code. Node placement and input coordinates use this unit |

`ViewScaleMode` chooses how the view is set. The default is `none`.

| Mode | View size | Leftover |
| --- | --- | --- |
| `none` | Canvas CSS size as is (no scaling) | None |
| `referenceResolution` | Reference resolution, centered without scaling | Both axes may be cut or leave space |
| `stretchWidth` | Reference resolution, width scaled to the canvas | Height may be cut or leave space |
| `stretchHeight` | Reference resolution, height scaled to the canvas | Width may be cut or leave space |
| `stretchShort` | Reference resolution, scaled to fit the short axis | Margins on the long axis |
| `stretchWidthExpandHeight` | Width is the reference resolution, height follows the screen ratio | None |
| `stretchHeightExpandWidth` | Height is the reference resolution, width follows the screen ratio | None |
| `stretchShortExpandLong` | Short axis is the reference resolution, long axis fills the screen | None |

`applyAspectViewScaleMode()` picks `stretchWidthExpandHeight` if the screen is taller than the reference resolution, and `stretchHeightExpandWidth` otherwise.

The `Graphic` transform is reset to identity at the start of every frame. Drawing as is uses the canvas's real pixels as coordinates. A scene sets its coordinate system in `preDraw`.

- `viewManager.applyCanvasNativeRect(graphic)`: the whole canvas in CSS pixels. Use it to paint the background to the edges of the canvas.
- `viewManager.applyViewRect(graphic)`: view coordinates. (0, 0) is the top left of the view and the bottom right is `getViewSize()`. The touch coordinates a scene receives are in these coordinates too.

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

Other uses:

- `applyReferenceResolutionSize(size)`: changes the reference resolution at run time and recomputes the view.
- `canvasPositionToViewPosition(canvasPosition)`, `convertClientToView(clientX, clientY)`: convert canvas coordinates, or screen coordinates of a DOM event, to view coordinates.
- `getSafeAreaInsets()`: gives the margins that avoid notches and home indicators in view coordinates. (`{ top, right, bottom, left }`)
- `setMaxRenderPixelRatio(ratio)`: caps the ratio so the canvas does not get too many pixels on high pixel ratio devices. 0 means no limit.
- `getCssPixelScale()`: gives how many CSS pixels one view unit takes on screen.

## Page events

The engine passes a `PageEvent` value to registered listeners when the page is hidden and shown again, when the window loses and gains focus, and when the window is pressed.

| Value | When |
| --- | --- |
| `PageEvent.hidden` | The page was hidden (another tab, app switch) |
| `PageEvent.visible` | The page is visible again |
| `PageEvent.blurred` | The window lost focus |
| `PageEvent.focused` | The window gained focus |
| `PageEvent.pointerDown` | The window was pressed |

A scene has two methods to override. `onPageVisibilityRestored()` is called when the page becomes visible again, and `onPageProcessRestored()` when the browser revives a frozen page (the `resume` event, or a `pageshow` coming back from the back-forward cache). Before calling them, the engine wakes the audio context and clears pressed keys and touch state.

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

`UIScene` extends `Scene` and does common work for you. It applies the mode set with `setViewScaleMode` in `initialize`, paints the whole canvas in `preDraw` with the `setSceneBackgroundColor` color (black by default) and then switches to view coordinates, passes touches to nodes through `TouchRecognizer`, and attaches the developer tools when `useDevTools` is on. It draws a loading screen (a gauge and the image from `setLoadingImageUrl`), and by default the loading screen shows for at least 3 seconds. (`setLoadingMinDurationMs`; pressing the screen skips it) Constraint based layout (`UINode`) is covered in the "UI" chapter.

## Things to watch

- The root node is created in `create()`, not in the constructor. `getRoot()` is still empty in the constructor. When overriding `create`, call `super.create()` first.
- When overriding `load`, call `await super.load(engine)` so the root node gets the view size. To change the view mode, change it before that call.
- Modes other than `ViewScaleMode.none` divide by the reference resolution. If `referenceResolutionSize` is not set (default 0, 0), the view cannot be computed.
- The engine keeps using the `referenceResolutionSize` object it received when created. To change it at run time, call `applyReferenceResolutionSize`.
- Even after `load` finishes, `initialize` and `tick` start only 0.3 seconds later.
- Loading the next scene without unloading the current one makes both scenes run and draw together.

## Related classes

Engine, EngineConfiguration, PageEvent, Scene, SceneManager, TimeManager, ViewManager, ViewScaleMode, UIScene, Graphic
