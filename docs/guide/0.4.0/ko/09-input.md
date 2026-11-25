# 입력

엔진은 캔버스의 마우스와 터치, 문서의 키보드, 게임패드를 받아 `InputManager` 에 담습니다. 마우스와 터치는 "터치" 한 갈래로 합쳐 씬에 넘기고, 노드로 넘길 때는 `TouchRecognizer` 를 씁니다. 이 장은 씬에서 터치 받기, 노드로 넘기기, 손가락 여럿, 마우스 단추와 휠, 키보드, 입력 동작(`InputActions`), 게임패드, 마우스 커서를 봅니다.

## 씬에서 터치 받기

씬의 기본 `tick` 이 매 프레임 입력 상태를 보고 아래 메서드를 부릅니다. 좌표는 모두 뷰 좌표(`viewManager.applyViewRect` 로 그리는 좌표)입니다.

| 메서드 | 불리는 때 |
| --- | --- |
| `touchPress(viewInputPosition)` | 누른 프레임 |
| `touchMove(viewInputPosition)` | 누르고 있는 동안 (누른 프레임에는 부르지 않습니다) |
| `touchRelease(viewInputPosition)` | 뗀 프레임 (한 프레임 안에 눌렀다 뗐으면 `touchPress` 바로 뒤에) |
| `touchCancel(viewInputPosition)` | 터치가 취소된 프레임 (`touchcancel`) |
| `touchWheel(viewInputPosition, wheelDelta)` | 이번 프레임에 휠을 굴렸을 때 (`wheelDelta` 는 이번 프레임에 쌓인 `deltaX`, `deltaY`) |

마우스는 처음에 어느 단추든 터치로 넘깁니다. 왼쪽 단추만 터치로 넘기려면 `inputManager.setTouchFromLeftButtonOnly(true)` 를 부릅니다. 손가락이 여럿이면 가장 최근 터치 사건에서 바뀐 첫 손가락의 자리를 씁니다. (여러 손가락은 아래 "손가락 여럿")

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

`touchPress` 등을 덮어쓸 때 부모 것을 부르지 않아도 됩니다. (`Scene` 의 기본 구현은 비어 있습니다) `tick` 을 덮어쓸 때는 `super.tick(timeDelta)` 를 불러야 이 메서드들이 불립니다.

## 노드로 터치 넘기기 (TouchRaycaster, TouchRecognizer)

노드가 터치를 받으려면 셋이 필요합니다.

1. `WorldNode.setInteractable(true)`
2. 터치를 받을 메서드(`touchPress`, `touchMove`, `touchRelease`, `touchCancel`)를 가진 컴포넌트. 노드는 받은 터치를 그 메서드가 있는 컴포넌트 모두에 넘깁니다.
3. 씬이 `TouchRecognizer` 를 만들어 `setRootNode(root)` 로 루트를 주고, 씬의 터치 메서드에서 그것에 넘기기.

`TouchRaycaster` 는 누를 때 루트부터 그리는 차례로 트리를 돌아, 활성이고 `isInteractable()` 이 참이며 그 점을 품는(`contains`) 노드 가운데 가장 나중에 그리는(가장 위에 보이는) 노드를 고릅니다. `Mask` 가 붙은 노드 밖에 있는 자손은 고르지 않습니다. 고른 노드는 뗄 때까지 손가락이 밖으로 나가도 `touchMove`, `touchRelease` 를 받습니다. `TouchRecognizer` 는 이것을 이어받아, 고른 노드의 조상에 `UIScrollView` 가 있으면 누름을 0.15 초 늦춰 넘기고, 10 픽셀 넘게 끌면 노드에는 누름을 넘기지 않거나 취소하고 스크롤 칸에 끌기를 넘깁니다.

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
	#touchRecognizer;

	create() {
		super.create();
		const root = this.getRoot();
		this.#touchRecognizer = new TouchRecognizer();
		this.#touchRecognizer.setRootNode(root);
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

	touchPress(viewInputPosition) {
		this.#touchRecognizer.touchPress(viewInputPosition);
	}

	touchMove(viewInputPosition) {
		this.#touchRecognizer.touchMove(viewInputPosition);
	}

	touchRelease(viewInputPosition) {
		this.#touchRecognizer.touchRelease(viewInputPosition);
	}

	touchCancel(viewInputPosition) {
		this.#touchRecognizer.touchCancel(viewInputPosition);
	}

	touchWheel(viewInputPosition, wheelDelta) {
		this.#touchRecognizer.touchWheel(viewInputPosition, wheelDelta);
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

- `PressHighlight` 는 `require()` 로 `Paint` 를 요구하므로 `addComponent(PressHighlight)` 가 `Paint` 를 먼저 붙입니다.
- `touchWheel` 은 그 자리를 덮는 것 가운데 가장 위의 스크롤 칸(`UIScrollView` 같은 것)에 휠을 넘깁니다.
- `UIScene` 은 이 연결을 스스로 합니다. 버튼, 스크롤 뷰 같은 UI 컴포넌트는 "UI" 장에서 봅니다.

## 손가락 여럿 (TouchPoint)

씬의 터치 메서드는 한 자리만 받습니다. 손가락 여럿은 `InputManager` 에서 읽습니다. 터치 화면의 손가락만 들어가고 마우스는 들어가지 않습니다.

- `getTouchPoints()`: 지금 닿아 있는 손가락 목록 (닿은 차례). 단계는 `began`(이번 프레임에 닿음), `moved`, `stationary`
- `getEndedTouchPoints()`: 이번 프레임에 떨어진 손가락 (단계 `ended` 또는 `cancelled`, 자리는 뗀 자리)
- `findTouchPoint(identifier)`: 번호로 찾기 (없으면 `null`)

`TouchPoint` 는 `identifier`(닿아 있는 동안 같은 번호), `phase`(`TouchPhase` 값), `canvasNativePosition`(캔버스 왼쪽 위 기준 CSS 픽셀), `viewPosition`(뷰 좌표) 필드를 갖습니다.

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

## 마우스 단추와 휠

| 메서드 | 내용 |
| --- | --- |
| `isMouseButtonDown(button)` | 눌려 있는지. 단추는 `MouseButton.left`(0), `middle`(1), `right`(2) |
| `isMouseButtonJustPressed(button)`, `isMouseButtonJustReleased(button)` | 이번 프레임에 눌렀는지, 뗐는지 (프레임 사이에 눌렀다 뗀 것도 참) |
| `getViewInputPosition()`, `getCanvasNativeInputPosition()` | 마지막 포인터 자리 (뷰 좌표, 캔버스 CSS 픽셀) |
| `isTouchDown()` | 터치(손가락이나 터치로 넘기는 마우스 단추)가 눌린 채인지 |
| `hasWheelDelta()`, `getWheelDeltaX()`, `getWheelDeltaY()` | 이번 프레임에 쌓인 휠 값 (아래로 굴리면 Y 가 양수) |
| `isWheelWithCtrl()` | 마지막 휠을 Ctrl 과 함께 굴렸는지 (노트북 터치패드의 오므리기도 Ctrl 휠로 옵니다) |
| `setContextMenuPrevented(isPrevented)` | 캔버스의 오른쪽 클릭 메뉴를 막을지 (처음 참) |
| `setTouchFromLeftButtonOnly(isLeftButtonOnly)` | 왼쪽 단추만 터치로 넘길지 (처음 거짓) |

## 키보드

키는 `KeyboardEvent.code` 글로 묻습니다. 자판 배열과 상관없이 자리로 정해지는 이름입니다. (`"KeyA"`, `"Digit1"`, `"ArrowLeft"`, `"Space"`, `"Enter"`, `"Escape"`, `"ShiftLeft"`, `"ControlLeft"` 같은 것)

| 메서드 | 내용 |
| --- | --- |
| `isKeyPressed(code)` | 지금 눌려 있는지 |
| `isKeyJustPressed(code)` | 이번 프레임에 눌렸는지 (프레임 사이에 눌렀다 뗀 키도 참) |
| `isKeyJustReleased(code)` | 이번 프레임에 떼어졌는지 |
| `setPreventedKeys(codes)` | 브라우저 기본 동작을 막을 키 (Tab 의 초점 옮기기, Space 의 쪽 넘기기 같은 것). 글자 입력칸에 쓰는 중이면 막지 않습니다 |
| `isTypingInTextField()` | 초점이 글자 입력칸(input, textarea, contenteditable, select)에 있는지 |

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

## 입력 동작 (InputActions)

게임이 정한 동작 이름(`"confirm"`, `"jump"` 같은 글)에 키, 게임패드 단추, 게임패드 축의 한쪽을 여럿 묶고, 게임은 동작 이름으로 읽습니다. `inputManager.getInputActions()` 가 엔진이 하나 들고 있는 것을 주고, 엔진이 프레임 처음에 갱신합니다.

| 메서드 | 내용 |
| --- | --- |
| `bindKey(action, code)` | 키 묶기 |
| `bindGamepadButton(action, buttonIndex)` | 게임패드 단추 묶기 (W3C 표준 배치의 단추 번호, 연결된 패드 모두) |
| `bindAxis(action, axisIndex, direction)` | 축의 한쪽 묶기 (`direction` 이 1 이면 + 쪽, -1 이면 - 쪽) |
| `unbindAction(action)`, `getBoundKeys(action)` | 묶은 것 모두 풀기, 묶은 키 목록 |
| `setRepeat(action, delaySeconds, intervalSeconds)` | 누르고 있으면 기다린 뒤부터 간격마다 `isJustPressed` 가 다시 참 (메뉴 고르기) |
| `isPressed(action)`, `isJustPressed(action)`, `isJustReleased(action)` | 상태 |
| `readValue(action)` | 0 ~ 1. 키와 디지털 단추는 1, 트리거와 축은 기운 만큼 |
| `readAxis(negativeAction, positiveAction)` | 두 동작으로 만든 -1 ~ 1 축 |
| `readMoveAxis()` | WASD 와 방향키, 왼쪽 스틱, 바깥 입력원 가운데 가장 긴 이동 (길이 1 이하, 오른쪽 +x, 아래 +y) |
| `setDeadZone(value)`, `setAxisPressThreshold(value)` | 스틱 가운데 떨림을 거르는 길이 (처음 0.2), 축을 눌린 것으로 보는 기울기 (처음 0.5) |
| `setKeysIgnoredWhileTyping(isIgnored)` | 글자 입력칸에 쓰는 동안 키를 듣지 않을지 (처음 참) |
| `addSource(source)` | 엔진이 모르는 입력원 끼우기 (`readActionValue(action)` 를 가진 객체) |

게임패드 단추 번호는 W3C 표준 배치를 따릅니다. 0 이 A(크로스), 1 이 B(서클), 2 가 X(스퀘어), 3 이 Y(트라이앵글), 4 와 5 가 L1, R1, 6 과 7 이 L2, R2, 8 이 공유(뷰), 9 가 옵션(메뉴), 12 ~ 15 가 십자키 위, 아래, 왼쪽, 오른쪽입니다. 축 번호는 0 이 왼쪽 스틱 X, 1 이 왼쪽 스틱 Y(아래가 +), 2 와 3 이 오른쪽 스틱 X, Y 입니다.

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

## 게임패드 (GamepadManager)

`inputManager.getGamepadManager()` 로 얻습니다. 엔진이 `gamepadconnected` 와 `gamepaddisconnected` 를 받아 패드를 등록하고 매 프레임 상태를 읽습니다. 패드는 브라우저가 준 `Gamepad.index` 번호로 묻습니다.

| 메서드 | 내용 |
| --- | --- |
| `getAllConnectedGamepads()`, `getConnectedGamepadCount()` | 연결된 패드 (`Gamepad` 객체) 목록과 수 |
| `isButtonPressed(gamepadIndex, buttonIndex)` | 단추가 눌려 있는지 |
| `isButtonJustPressed(gamepadIndex, buttonIndex)`, `isButtonJustReleased(...)` | 이번 갱신에 눌렸는지, 떼어졌는지 |
| `getButtonValue(gamepadIndex, buttonIndex)` | 단추와 트리거 값 (0 ~ 1) |
| `getAxisValue(gamepadIndex, axisIndex)` | 스틱 축 값 (-1 ~ 1) |
| `vibrate(strongMagnitude, weakMagnitude, seconds)` | 연결된 패드를 모두 떨기 (세기 0 ~ 1, 진동 장치가 없는 패드와 브라우저는 건너뜀) |
| `setInputLogEnabled(isEnabled)` | 단추와 축이 바뀔 때마다 콘솔에 찍을지 (처음 끔) |
| `getActiveGamepadId()` | 마지막 갱신에 쓴 패드의 이름 (없으면 빈 글) |

`readGamepadKind(gamepadId)` 는 패드 이름으로 `GamepadKind.xbox`, `playstation`, `nintendo`, `other` 를 가릅니다. 단추 안내 그림을 패드에 맞출 때 씁니다. `inputManager.getLastGamepadKind()` 는 마지막으로 쓴 패드의 종류를 줍니다.

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

## 마지막 입력 장치

`inputManager.getLastInputDevice()` 는 마지막으로 쓴 장치를 `InputDevice.keyboard`, `mouse`, `touch`, `gamepad` 가운데 하나로 줍니다. 처음 값은 손가락이 주된 기기(CSS `pointer: coarse`)면 `touch`, 아니면 `keyboard` 입니다. 손가락을 뗀 직후 브라우저가 흉내 내 보내는 마우스 사건과 창이 흔들릴 때의 작은 마우스 움직임은 장치를 바꾸지 않습니다. `isTouchInput()` 은 마지막 입력이 손가락인지 줍니다. 화면에 "탭하세요" 와 "Enter 를 누르세요" 를 바꿔 보일 때 씁니다.

## 마우스 커서 (PointerCursor)

`PointerCursor` 는 하나뿐인 객체(`PointerCursor.getInstance()`)입니다. `setEnabled(true)` 로 켜면 엔진이 프레임 끝마다 캔버스의 CSS 커서를 정합니다. 꺼져 있으면(처음) 아무것도 하지 않습니다.

- `UIButton` 위에 마우스가 있으면 단추의 커서(처음 `"pointer"`), 아니면 `setScreenCursor(name)` 로 정한 커서입니다.
- `setCursorNames(buttonCursorName, defaultCursorName)` 로 단추 위 커서와 기본 커서를 바꿉니다.
- 쓸 수 있는 CSS 이름은 `pointer`, `crosshair`, `not-allowed`, `grab`, `grabbing`, `text`, `move`, `help`, `wait`, `progress`, `none` 이고, 모르는 이름이면 브라우저 기본 화살표입니다.
- `registerImageCursor(name, url, url2x, hotspotX, hotspotY, fallbackCursorName)` 로 그림 커서를 더하고 그 이름을 씁니다. (1 배, 2 배 그림, 1 배 기준 핫스팟, 그림을 못 쓸 때의 CSS 커서)
- 손가락이 주된 기기에서는 캔버스를 건드리지 않습니다.

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

## 주의할 점

- 씬의 터치 메서드와 `getViewInputPosition()` 은 자리 하나만 봅니다. 핀치처럼 손가락 여럿이 필요하면 `getTouchPoints()` 를 씁니다.
- 아무 씬이나 노드로 터치를 넘기지는 않습니다. `Scene` 을 바로 이어받았으면 `TouchRecognizer` 를 직접 연결하고, `UIScene` 은 스스로 연결합니다.
- 키 이름(`KeyCode`)과 게임패드 번호(`GamepadButtonCode`, `GamepadAnalogStickCode`)의 표는 공개 이름에 없습니다. 키는 `KeyboardEvent.code` 글, 패드는 W3C 표준 배치의 번호로 줍니다.
- 키는 문서(`document`)에서 받으므로 페이지에 초점이 있어야 들어옵니다. iframe 안의 게임은 iframe 을 한 번 눌러야 키를 받습니다.
- 창이 초점을 잃으면 엔진은 터치와 마우스 단추를 뗀 것으로 돌리지만 키는 그대로 둡니다. 키 상태는 페이지가 다시 보일 때(`visibilitychange`) 지웁니다. 키가 눌린 채 남는 것이 문제면 `PageEvent.blurred` 를 받아 `inputManager.clear()` 를 부릅니다.
- 한 프레임짜리 상태(`isKeyJustPressed`, `isMouseButtonJustPressed`, 휠 값, 떨어진 손가락)는 엔진이 프레임 끝에 지웁니다. 씬의 `tick` 안에서 읽습니다.

## 관련 클래스

InputManager, InputActions, InputDevice, MouseButton, TouchPhase, TouchPoint, TouchRaycaster, TouchRecognizer, GamepadManager, GamepadKind, PointerCursor, Scene, WorldNode, UIScene, PageEvent
