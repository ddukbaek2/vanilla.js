# Input

The engine receives mouse and touch input on the canvas, keyboard input on the document, and gamepads, and stores them in `InputManager`. Mouse and touch are merged into a single "touch" stream passed to the scene, and the scene passes it on to nodes (`TouchRaycaster`, `TouchRecognizer`). This chapter covers receiving touches in a scene, passing them to nodes, multiple fingers, mouse buttons and the wheel, the keyboard, input actions (`InputActions`), gamepads, and the mouse cursor.

## Receiving touches in a scene

The scene's base `tick` checks the input state every frame and calls the methods below. All coordinates are view coordinates (the coordinates you draw in after `viewManager.applyViewRect`).

| Method | When it is called |
| --- | --- |
| `touchPress(viewInputPosition)` | The frame of the press |
| `touchMove(viewInputPosition)` | While held (not on the frame of the press) |
| `touchRelease(viewInputPosition)` | The frame of the release (right after `touchPress` if both happened within one frame) |
| `touchCancel(viewInputPosition)` | The frame a touch was cancelled (`touchcancel`) |
| `touchWheel(viewInputPosition, wheelDelta)` | When the wheel was rolled this frame (`wheelDelta` is the `deltaX` and `deltaY` accumulated this frame) |

By default the mouse passes any button as a touch. To pass only the left button, call `inputManager.setTouchFromLeftButtonOnly(true)`. With several fingers, the position of the first changed finger of the latest touch event is used. (see "Multiple fingers" below for several fingers)

```javascript
import { Engine, EngineConfiguration, Scene, Vector2, Color } from "./build/vanilla.js";

class DragScene extends Scene {
	#ballPosition;
	#grabOffset;

	constructor() {
		super();
		this.#ballPosition = Vector2.create(640, 360);
		this.#grabOffset = null;
	}

	touchPress(viewInputPosition) {
		const deltaX = viewInputPosition.x - this.#ballPosition.x;
		const deltaY = viewInputPosition.y - this.#ballPosition.y;
		if (deltaX * deltaX + deltaY * deltaY <= 60 * 60) {
			this.#grabOffset = Vector2.create(deltaX, deltaY);
		}
	}

	touchMove(viewInputPosition) {
		if (this.#grabOffset === null) {
			return;
		}
		this.#ballPosition = Vector2.create(viewInputPosition.x - this.#grabOffset.x, viewInputPosition.y - this.#grabOffset.y);
	}

	touchRelease(viewInputPosition) {
		this.#grabOffset = null;
	}

	touchCancel(viewInputPosition) {
		this.#grabOffset = null;
	}

	preDraw(graphic) {
		super.preDraw(graphic);
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		viewManager.applyViewRect(graphic);
	}

	draw(graphic) {
		super.draw(graphic);
		const isGrabbed = this.#grabOffset !== null;
		graphic.setFillColor(isGrabbed ? new Color(1, 0.7, 0.2, 1) : new Color(0.3, 0.7, 1, 1));
		graphic.drawCircle(this.#ballPosition, 60);
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
engineConfiguration.autoResizeOnWindowResize = true;
const engine = new Engine(engineConfiguration);
engine.run(new DragScene());
```

You do not need to call the parent when overriding `touchPress` and the others. (the `Scene` base implementations are empty) When overriding `tick`, call `super.tick(timeDelta)` so these methods are called.

## Passing touches to nodes (TouchRaycaster, TouchRecognizer)

A node needs three things to receive touches.

1. `WorldNode.setInteractable(true)`
2. A component with touch methods (`touchPress`, `touchMove`, `touchRelease`, `touchCancel`). The node passes each touch to every component that has the method.
3. The node is under the scene root. Whatever the kind of scene, `tickTouch` first passes the touch to the frontmost node through the scene's touch raycaster (a `TouchRaycaster` at first), then calls the scene's touch methods.

On a press, `TouchRaycaster` walks the tree from the root in draw order and picks, among nodes that are active, have `isInteractable()` true and contain the point (`contains`), the one drawn last (the one visible on top). Descendants outside a node with a `Mask` are not picked. The picked node keeps receiving `touchMove` and `touchRelease` until release, even if the finger leaves it. `TouchRecognizer` extends this: if the picked node has a `UIScrollView` ancestor, it delays the press by 0.15 seconds, and once the drag goes beyond 10 pixels it withholds or cancels the press on the node and hands the drag to the scroll view. If there are buttons inside a scroll view, replace the scene's raycaster with `setTouchRaycaster(new TouchRecognizer())`. If the scene has to intercept touches (such as dragging a bar), turn it off with `setTouchRaycaster(null)` and pass touches yourself from the scene's touch methods. `UIScene` and `GameScene` do this.

```javascript
import { Engine, EngineConfiguration, Scene, WorldNode, Component, Paint, TouchRecognizer, Vector2, Color } from "./build/vanilla.js";

class PressHighlight extends Component {
	#paint;
	#clickCount;

	constructor() {
		super();
		this.#paint = null;
		this.#clickCount = 0;
	}

	attach(node) {
		super.attach(node);
		this.#paint = node.getComponent(Paint);
	}

	require() {
		return [Paint];
	}

	touchPress(viewInputPosition) {
		this.#paint.setColor("#ffaa33");
	}

	touchRelease(viewInputPosition) {
		this.#paint.setColor("#3366cc");
		const node = this.getNode();
		const isInside = node.contains(viewInputPosition);
		if (isInside) {
			this.#clickCount += 1;
			console.log("clicked", this.#clickCount);
		}
	}

	touchCancel(viewInputPosition) {
		this.#paint.setColor("#3366cc");
	}
}

class ButtonScene extends Scene {
	create() {
		super.create();
		this.setTouchRaycaster(new TouchRecognizer());
	}

	initialize(engine) {
		super.initialize(engine);
		const root = this.getRoot();
		const button = new WorldNode();
		button.setContentSize(Vector2.create(240, 90));
		button.setLocalPosition(Vector2.create(640, 360));
		button.setInteractable(true);
		button.addComponent(PressHighlight);
		const paint = button.getComponent(Paint);
		paint.setColor("#3366cc");
		paint.setRoundSize(16);
		root.addChild(button);
	}

	preDraw(graphic) {
		super.preDraw(graphic);
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		viewManager.applyViewRect(graphic);
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
engineConfiguration.autoResizeOnWindowResize = true;
const engine = new Engine(engineConfiguration);
engine.run(new ButtonScene());
```

- `PressHighlight` requires `Paint` through `require()`, so `addComponent(PressHighlight)` attaches `Paint` first.
- `touchWheel` passes the wheel to the topmost scroll view (such as `UIScrollView`) covering that point.
- `UIScene` makes this connection by itself. UI components such as buttons and scroll views are covered in the "UI" chapter.

## Multiple fingers (TouchPoint)

A scene's touch methods receive only one position. Read multiple fingers from `InputManager`. Only fingers on a touch screen are listed; the mouse is not.

- `getTouchPoints()`: the fingers touching now (in touch order). The phase is `began` (touched this frame), `moved` or `stationary`
- `getEndedTouchPoints()`: fingers lifted this frame (phase `ended` or `cancelled`, position where they were lifted)
- `findTouchPoint(identifier)`: find by number (`null` if none)

A `TouchPoint` has the fields `identifier` (the same number while touching), `phase` (a `TouchPhase` value), `canvasNativePosition` (CSS pixels from the canvas's top left) and `viewPosition` (view coordinates).

```javascript
import { Engine, EngineConfiguration, Scene, TouchPhase, Vector2, Color } from "./build/vanilla.js";

class MultiTouchScene extends Scene {
	#fingerPositions;

	constructor() {
		super();
		this.#fingerPositions = [];
	}

	tick(timeDelta) {
		super.tick(timeDelta);
		const engine = this.getEngine();
		const inputManager = engine.getInputManager();
		const touchPoints = inputManager.getTouchPoints();
		this.#fingerPositions = [];
		for (const touchPoint of touchPoints) {
			const viewPosition = touchPoint.viewPosition;
			this.#fingerPositions.push(viewPosition);
			if (touchPoint.phase === TouchPhase.began) {
				const identifier = touchPoint.identifier;
				console.log("finger down", identifier);
			}
		}
		const endedTouchPoints = inputManager.getEndedTouchPoints();
		for (const endedTouchPoint of endedTouchPoints) {
			const identifier = endedTouchPoint.identifier;
			const phase = endedTouchPoint.phase;
			console.log("finger up", identifier, phase);
		}
	}

	preDraw(graphic) {
		super.preDraw(graphic);
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		viewManager.applyViewRect(graphic);
	}

	draw(graphic) {
		super.draw(graphic);
		graphic.setFillColor(new Color(1, 1, 1, 0.6));
		for (const fingerPosition of this.#fingerPositions) {
			graphic.drawCircle(fingerPosition, 50);
		}
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
engineConfiguration.autoResizeOnWindowResize = true;
const engine = new Engine(engineConfiguration);
engine.run(new MultiTouchScene());
```

## Mouse buttons and wheel

| Method | Description |
| --- | --- |
| `isMouseButtonDown(button)` | Whether held. Buttons are `MouseButton.left` (0), `middle` (1) and `right` (2) |
| `isMouseButtonJustPressed(button)`, `isMouseButtonJustReleased(button)` | Whether pressed or released this frame (also true for a press and release between frames) |
| `getViewInputPosition()`, `getCanvasNativeInputPosition()` | Last pointer position (view coordinates, canvas CSS pixels) |
| `isTouchDown()` | Whether a touch (a finger, or a mouse button passed as touch) is held |
| `hasWheelDelta()`, `getWheelDeltaX()`, `getWheelDeltaY()` | Wheel values accumulated this frame (rolling down makes Y positive) |
| `isWheelWithCtrl()` | Whether the last wheel was rolled with Ctrl (laptop touchpad pinches also arrive as Ctrl wheel) |
| `setContextMenuPrevented(isPrevented)` | Whether to block the canvas's right click menu (true by default) |
| `setTouchFromLeftButtonOnly(isLeftButtonOnly)` | Whether to pass only the left button as touch (false by default) |

## Keyboard

Keys are queried with `KeyboardEvent.code` strings. These names are fixed by physical position regardless of keyboard layout. (such as `"KeyA"`, `"Digit1"`, `"ArrowLeft"`, `"Space"`, `"Enter"`, `"Escape"`, `"ShiftLeft"`, `"ControlLeft"`)

| Method | Description |
| --- | --- |
| `isKeyPressed(code)` | Whether held now |
| `isKeyJustPressed(code)` | Whether pressed this frame (also true for a key pressed and released between frames) |
| `isKeyJustReleased(code)` | Whether released this frame |
| `setPreventedKeys(codes)` | Keys whose browser default action is blocked (such as Tab moving focus or Space scrolling the page). Not blocked while typing in a text input |
| `isTypingInTextField()` | Whether focus is in a text input (input, textarea, contenteditable, select) |

```javascript
import { Engine, EngineConfiguration, Scene, Vector2, Rect, Color } from "./build/vanilla.js";

class KeyboardScene extends Scene {
	#position;

	constructor() {
		super();
		this.#position = Vector2.create(640, 360);
	}

	initialize(engine) {
		super.initialize(engine);
		const inputManager = engine.getInputManager();
		inputManager.setPreventedKeys(["Space", "ArrowUp", "ArrowDown"]);
	}

	tick(timeDelta) {
		super.tick(timeDelta);
		const engine = this.getEngine();
		const inputManager = engine.getInputManager();
		const speed = 300;
		let moveX = 0;
		let moveY = 0;
		if (inputManager.isKeyPressed("ArrowLeft")) {
			moveX -= 1;
		}
		if (inputManager.isKeyPressed("ArrowRight")) {
			moveX += 1;
		}
		if (inputManager.isKeyPressed("ArrowUp")) {
			moveY -= 1;
		}
		if (inputManager.isKeyPressed("ArrowDown")) {
			moveY += 1;
		}
		this.#position = Vector2.create(this.#position.x + moveX * speed * timeDelta, this.#position.y + moveY * speed * timeDelta);
		if (inputManager.isKeyJustPressed("Space")) {
			console.log("jump");
		}
	}

	preDraw(graphic) {
		super.preDraw(graphic);
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		viewManager.applyViewRect(graphic);
	}

	draw(graphic) {
		super.draw(graphic);
		graphic.setFillColor(new Color(0.4, 0.9, 0.5, 1));
		graphic.drawRect(Rect.create(this.#position.x - 40, this.#position.y - 40, 80, 80));
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
engineConfiguration.autoResizeOnWindowResize = true;
const engine = new Engine(engineConfiguration);
engine.run(new KeyboardScene());
```

## Input actions (InputActions)

Bind several keys, gamepad buttons and gamepad axis directions to action names chosen by the game (strings such as `"confirm"` or `"jump"`), and have the game read by action name. `inputManager.getInputActions()` returns the one the engine holds, and the engine updates it at the start of every frame.

| Method | Description |
| --- | --- |
| `bindKey(action, code)` | Bind a key |
| `bindGamepadButton(action, buttonIndex)` | Bind a gamepad button (button number in the W3C standard mapping, all connected pads) |
| `bindAxis(action, axisIndex, direction)` | Bind one direction of an axis (`direction` 1 is the + side, -1 the - side) |
| `unbindAction(action)`, `getBoundKeys(action)` | Remove every binding, list of bound keys |
| `setRepeat(action, delaySeconds, intervalSeconds)` | While held, `isJustPressed` becomes true again every interval after the delay (menu selection) |
| `isPressed(action)`, `isJustPressed(action)`, `isJustReleased(action)` | State |
| `readValue(action)` | 0 to 1. Keys and digital buttons give 1, triggers and axes give how far they are pushed |
| `readAxis(negativeAction, positiveAction)` | A -1 to 1 axis made from two actions |
| `readMoveAxis()` | The longest movement among WASD and arrow keys, the left stick and external sources (length 1 or less, +x right, +y down) |
| `setDeadZone(value)`, `setAxisPressThreshold(value)` | Length that filters stick center jitter (default 0.2), tilt at which an axis counts as pressed (default 0.5) |
| `setKeysIgnoredWhileTyping(isIgnored)` | Whether to ignore keys while typing in a text input (true by default) |
| `addSource(source)` | Plug in an input source the engine does not know (an object with `readActionValue(action)`) |

Gamepad button numbers follow the W3C standard mapping. 0 is A (Cross), 1 is B (Circle), 2 is X (Square), 3 is Y (Triangle), 4 and 5 are L1 and R1, 6 and 7 are L2 and R2, 8 is Share (View), 9 is Options (Menu), and 12 to 15 are D-pad up, down, left and right. Axis numbers are 0 for left stick X, 1 for left stick Y (down is +), and 2 and 3 for right stick X and Y.

```javascript
import { Engine, EngineConfiguration, Scene, Vector2, Rect, Color } from "./build/vanilla.js";

class ActionScene extends Scene {
	#position;
	#selectedIndex;

	constructor() {
		super();
		this.#position = Vector2.create(640, 360);
		this.#selectedIndex = 0;
	}

	initialize(engine) {
		super.initialize(engine);
		const inputManager = engine.getInputManager();
		const inputActions = inputManager.getInputActions();
		inputActions.bindKey("confirm", "Enter");
		inputActions.bindKey("confirm", "Space");
		inputActions.bindGamepadButton("confirm", 0);
		inputActions.bindKey("next", "Tab");
		inputActions.bindGamepadButton("next", 15);
		inputActions.bindAxis("next", 0, 1);
		inputActions.setRepeat("next", 0.4, 0.1);
	}

	tick(timeDelta) {
		super.tick(timeDelta);
		const engine = this.getEngine();
		const inputManager = engine.getInputManager();
		const inputActions = inputManager.getInputActions();
		const moveAxis = inputActions.readMoveAxis();
		this.#position = Vector2.create(this.#position.x + moveAxis.x * 300 * timeDelta, this.#position.y + moveAxis.y * 300 * timeDelta);
		if (inputActions.isJustPressed("next")) {
			this.#selectedIndex = (this.#selectedIndex + 1) % 4;
		}
		if (inputActions.isJustPressed("confirm")) {
			console.log("confirm", this.#selectedIndex);
		}
	}

	preDraw(graphic) {
		super.preDraw(graphic);
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		viewManager.applyViewRect(graphic);
	}

	draw(graphic) {
		super.draw(graphic);
		for (let index = 0; index < 4; ++index) {
			const isSelected = index === this.#selectedIndex;
			graphic.setFillColor(isSelected ? "#ffcc33" : "#445066");
			graphic.drawRect(Rect.create(40 + index * 140, 40, 120, 60));
		}
		graphic.setFillColor(new Color(0.4, 0.8, 1, 1));
		graphic.drawCircle(this.#position, 40);
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
engineConfiguration.autoResizeOnWindowResize = true;
const engine = new Engine(engineConfiguration);
engine.run(new ActionScene());
```

## Gamepads (GamepadManager)

Get it with `inputManager.getGamepadManager()`. The engine registers pads on `gamepadconnected` and `gamepaddisconnected` and reads their state every frame. Pads are queried with the `Gamepad.index` number the browser gives.

| Method | Description |
| --- | --- |
| `getAllConnectedGamepads()`, `getConnectedGamepadCount()` | List and count of connected pads (`Gamepad` objects) |
| `isButtonPressed(gamepadIndex, buttonIndex)` | Whether a button is held |
| `isButtonJustPressed(gamepadIndex, buttonIndex)`, `isButtonJustReleased(...)` | Whether pressed or released in this update |
| `getButtonValue(gamepadIndex, buttonIndex)` | Button and trigger value (0 to 1) |
| `getAxisValue(gamepadIndex, axisIndex)` | Stick axis value (-1 to 1) |
| `vibrate(strongMagnitude, weakMagnitude, seconds)` | Vibrates every connected pad (magnitude 0 to 1; pads and browsers without a vibration actuator are skipped) |
| `setInputLogEnabled(isEnabled)` | Whether to log to the console whenever buttons or axes change (off by default) |
| `getActiveGamepadId()` | Name of the pad used in the last update (empty string if none) |

`readGamepadKind(gamepadId)` tells `GamepadKind.xbox`, `playstation`, `nintendo` or `other` from the pad name. Use it to match button prompt images to the pad. `inputManager.getLastGamepadKind()` gives the kind of the last used pad.

```javascript
import { Engine, EngineConfiguration, Scene, Vector2, GamepadKind, readGamepadKind } from "./build/vanilla.js";

class GamepadScene extends Scene {
	tick(timeDelta) {
		super.tick(timeDelta);
		const engine = this.getEngine();
		const inputManager = engine.getInputManager();
		const gamepadManager = inputManager.getGamepadManager();
		const gamepads = gamepadManager.getAllConnectedGamepads();
		for (const gamepad of gamepads) {
			const gamepadIndex = gamepad.index;
			const leftStickX = gamepadManager.getAxisValue(gamepadIndex, 0);
			const leftStickY = gamepadManager.getAxisValue(gamepadIndex, 1);
			const rightTrigger = gamepadManager.getButtonValue(gamepadIndex, 7);
			if (gamepadManager.isButtonJustPressed(gamepadIndex, 0)) {
				const gamepadId = gamepad.id;
				const gamepadKind = readGamepadKind(gamepadId);
				const buttonName = gamepadKind === GamepadKind.playstation ? "Cross" : "A";
				console.log(buttonName, leftStickX, leftStickY, rightTrigger);
				gamepadManager.vibrate(0.8, 0.4, 0.2);
			}
		}
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
engineConfiguration.autoResizeOnWindowResize = true;
const engine = new Engine(engineConfiguration);
engine.run(new GamepadScene());
```

## Last input device

`inputManager.getLastInputDevice()` gives the last used device as one of `InputDevice.keyboard`, `mouse`, `touch` and `gamepad`. The initial value is `touch` on devices whose primary input is a finger (CSS `pointer: coarse`), and `keyboard` otherwise. Mouse events the browser emulates right after a finger lifts, and tiny mouse movements from a shaking window, do not change the device. `isTouchInput()` tells whether the last input was a finger. Use it to switch on-screen hints between "Tap" and "Press Enter".

## Mouse cursor (PointerCursor)

`PointerCursor` is a single shared object (`PointerCursor.getInstance()`). Once turned on with `setEnabled(true)`, the engine sets the canvas's CSS cursor at the end of every frame. While off (the default), it does nothing.

- Over a `UIButton` it is the button cursor (default `"pointer"`), otherwise the cursor set with `setScreenCursor(name)`.
- `setCursorNames(buttonCursorName, defaultCursorName)` changes the cursor over buttons and the default cursor.
- Usable CSS names are `pointer`, `crosshair`, `not-allowed`, `grab`, `grabbing`, `text`, `move`, `help`, `wait`, `progress` and `none`; an unknown name shows the browser's default arrow.
- `registerImageCursor(name, url, url2x, hotspotX, hotspotY, fallbackCursorName)` adds an image cursor that you then use by name. (1x and 2x images, hotspot in 1x pixels, the CSS cursor used when the image cannot be)
- On devices whose primary input is a finger, the canvas is left alone.

```javascript
import { Engine, EngineConfiguration, Scene, PointerCursor, Vector2 } from "./build/vanilla.js";

class CursorScene extends Scene {
	initialize(engine) {
		super.initialize(engine);
		const pointerCursor = PointerCursor.getInstance();
		pointerCursor.setEnabled(true);
		pointerCursor.setCursorNames("pointer", "default");
	}

	touchPress(viewInputPosition) {
		const pointerCursor = PointerCursor.getInstance();
		pointerCursor.setScreenCursor("grabbing");
	}

	touchRelease(viewInputPosition) {
		const pointerCursor = PointerCursor.getInstance();
		pointerCursor.setScreenCursor("grab");
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
engineConfiguration.autoResizeOnWindowResize = true;
const engine = new Engine(engineConfiguration);
engine.run(new CursorScene());
```

## Things to watch

- A scene's touch methods and `getViewInputPosition()` see only one position. When you need several fingers, such as for pinching, use `getTouchPoints()`.
- Every kind of scene passes touches to nodes. If the scene's touch methods also forward to a raycaster, touches are passed twice, so turn off the scene's passing with `setTouchRaycaster(null)` when you pass them yourself.
- The tables of key names (`KeyCode`) and gamepad numbers (`GamepadButtonCode`, `GamepadAnalogStickCode`) are not public names. Pass keys as `KeyboardEvent.code` strings and pad inputs as W3C standard mapping numbers.
- Keys are received on the document, so the page must have focus. A game inside an iframe receives keys only after the iframe is clicked once.
- When the window loses focus, the engine releases touches and mouse buttons but leaves keys as they are. Key state is cleared when the page becomes visible again (`visibilitychange`). If keys staying pressed is a problem, listen for `PageEvent.blurred` and call `inputManager.clear()`.
- One-frame state (`isKeyJustPressed`, `isMouseButtonJustPressed`, wheel values, lifted fingers) is cleared by the engine at the end of the frame. Read it inside the scene's `tick`.

## Related classes

InputManager, InputActions, InputDevice, MouseButton, TouchPhase, TouchPoint, TouchRaycaster, TouchRecognizer, GamepadManager, GamepadKind, PointerCursor, Scene, WorldNode, UIScene, PageEvent
