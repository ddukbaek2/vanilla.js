//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Engine } from "./engine.js";
import { GamepadManager, GamepadKind, readGamepadKind } from "./gamepadmanager.js";
import { InputActions } from "./inputactions.js";


//==============================================================================
// 키 목록.
//==============================================================================
export const KeyCode = {
	a: "KeyA",
	b: "KeyB",
	c: "KeyC",
	d: "KeyD",
	e: "KeyE",
	f: "KeyF",
	g: "KeyG",
	h: "KeyH",
	i: "KeyI",
	j: "KeyJ",
	k: "KeyK",
	l: "KeyL",
	m: "KeyM",
	n: "KeyN",
	o: "KeyO",
	p: "KeyP",
	q: "KeyQ",
	r: "KeyR",
	s: "KeyS",
	t: "KeyT",
	u: "KeyU",
	v: "KeyV",
	w: "KeyW",
	x: "KeyX",
	y: "KeyY",
	z: "KeyZ",
	"0": "Digit0",
	"1": "Digit1",
	"2": "Digit2",
	"3": "Digit3",
	"4": "Digit4",
	"5": "Digit5",
	"6": "Digit6",
	"7": "Digit7",
	"8": "Digit8",
	"9": "Digit9",
	backspace: "Backspace",
	tab: "Tab",
	enter: "Enter",
	shift: "ShiftLeft",
	ctrl: "ControlLeft",
	alt: "AltLeft",
	capslock: "CapsLock",
	escape: "Escape",
	space: "Space",
	pageup: "PageUp",
	pagedown: "PageDown",
	end: "End",
	home: "Home",
	arrowleft: "ArrowLeft",
	arrowup: "ArrowUp",
	arrowright: "ArrowRight",
	arrowdown: "ArrowDown",
	insert: "Insert",
	delete: "Delete",
	f1: "F1",
	f2: "F2",
	f3: "F3",
	f4: "F4",
	f5: "F5",
	f6: "F6",
	f7: "F7",
	f8: "F8",
	f9: "F9",
	f10: "F10",
	f11: "F11",
	f12: "F12",
	scrolllock: "ScrollLock",
	semicolon: "Semicolon",
	equal: "Equal",
	comma: "Comma",
	minus: "Minus",
	period: "Period",
	slash: "Slash",
	backquote: "Backquote",
	bracketleft: "BracketLeft",
	backslash: "Backslash",
	bracketright: "BracketRight",
	quote: "Quote",
	meta: "MetaLeft",
	command: "MetaLeft",
	pause: "Pause",
	audiovolumeup: "AudioVolumeUp",
	audiovolumedown: "AudioVolumeDown",
	audiomute: "AudioVolumeMute", // 음소거. (W3C code 표의 이름)
	audioplay: "MediaPlayPause", // 재생/멈춤. (W3C code 표의 이름, 표에 MediaPlay 는 없다)
	audiostop: "MediaStop",
	audioprev: "MediaTrackPrevious",
	audionext: "MediaTrackNext",
	
	numLock: "NumLock",
	numpadDivide: "NumpadDivide", // 텐키 나누기.
	numpadMultiply: "NumpadMultiply", // 텐키 곱하기.
	numpadSubtract: "NumpadSubtract", // 텐키 빼기.
	numpadDecimal: "NumpadDecimal", // 텐키 점.
	numpadAdd: "NumpadAdd", // 텐키 더하기.
	numpadEnter: "NumpadEnter", // 텐키 엔터.
	numpad0: "Numpad0",
	numpad1: "Numpad1",
	numpad2: "Numpad2",
	numpad3: "Numpad3",
	numpad4: "Numpad4",
	numpad5: "Numpad5",
	numpad6: "Numpad6",
	numpad7: "Numpad7",
	numpad8: "Numpad8",
	numpad9: "Numpad9",
};

const AnalogStick = {
	L: -1,
	R: -1,
	L2: -1,
	R2: -1,
};

const Button = {
	UP: -1,
	DOWN: 13,
	LEFT: -1,
	RIGHT: -1,

	A: -1,
	B: -1,
	X: -1,
	Y: -1,

	Triangle: -1,
	Square: -1,
	Circle: -1,
	Cross: -1,

	L1: 4,
	R1: 7,
	L3: 10,
	R3: 11,

	TOUCHPAD: 17,
	SHARE: 8,
	OPTIONS: 9,
	PS: 16,
};


//==============================================================================
// 마우스 단추. (MouseEvent.button 의 값)
//==============================================================================
/** @enum { number } */
export const MouseButton = System.Object.freeze({
	left: 0,
	middle: 1,
	right: 2,
});

// 마우스 단추 칸 수.
const MOUSE_BUTTON_COUNT = 3;

//==============================================================================
// 손가락의 단계. (began 이번 프레임에 닿음, moved 움직임, stationary 가만히, ended 뗌, cancelled 취소)
//==============================================================================
/** @enum { string } */
export const TouchPhase = System.Object.freeze({
	began: "began",
	moved: "moved",
	stationary: "stationary",
	ended: "ended",
	cancelled: "cancelled",
});

//==============================================================================
// 마지막으로 쓴 입력 장치.
//==============================================================================
/** @enum { string } */
export const InputDevice = System.Object.freeze({
	keyboard: "keyboard",
	mouse: "mouse",
	touch: "touch",
	gamepad: "gamepad",
});


//==============================================================================
// 손가락 하나. (identifier 는 브라우저의 Touch.identifier, 자리는 캔버스 기준과 뷰 기준)
//==============================================================================
export class TouchPoint extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { number } */ identifier; // 손가락 번호. (닿아 있는 동안 같다)
	/** @type { string } */ phase; // TouchPhase 의 값.
	/** @type { Vector2 } */ canvasNativePosition; // 캔버스 왼쪽 위 기준 CSS 픽셀 자리.
	/** @type { Vector2 } */ viewPosition; // 뷰(기준 해상도) 자리.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { number } identifier
	 * @param { string } phase
	 * @param { Vector2 } canvasNativePosition
	 * @param { Vector2 } viewPosition
	 */
	constructor(identifier, phase, canvasNativePosition, viewPosition) {
		super();
		this.identifier = identifier;
		this.phase = phase;
		this.canvasNativePosition = canvasNativePosition;
		this.viewPosition = viewPosition;
	}
}


//==============================================================================
// 입력 매니저.
//==============================================================================
export class InputManager extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Set<string> } */ #keys; // 키 목록.
	/** @private @type { Set<string> } */ #justPressedKeys; // 지난 프레임 끝 뒤로 눌린 키. (프레임 안에 눌렀다 뗀 것도 남는다)
	/** @private @type { Set<string> } */ #justReleasedKeys; // 지난 프레임 끝 뒤로 떼어진 키.
	/** @private @type { boolean } */ #isTouchPressed; // 입력시 딱 한번 눌림.
	/** @private @type { boolean } */ #isTouchReleased; // 입력시 딱 한번 뗌.
	/** @private @type { boolean } */ #isTouchCancelled; // 입력시 딱 한번 취소됨.
	/** @private @type { boolean } */ #isTouchMoved; // 입력시 뗄 때가지 계속 눌림.
	/** @private @type { boolean } */ #isTouchDown; // 터치(손가락이나 터치로 넘기는 마우스 단추)가 눌린 채인지. (뗄 때까지 켜져 있다)
	/** @private @type { boolean } */ #isWheelWithCtrl; // 마지막 휠을 Ctrl 과 함께 굴렸는지.
	/** @private @type { Vector2 } */ #canvasNativeInputPosition; // canvasNativeSize 기반 위치값.
	/** @private @type { Vector2 } */ #viewInputPosition; // referenceResolutionSize 기반 위치값.
	/** @private @type { GamepadManager } */ #gamepadManager;
	/** @private @type { number } */ #wheelDeltaX; // 이번 프레임에 누적된 휠 가로.
	/** @private @type { number } */ #wheelDeltaY; // 이번 프레임에 누적된 휠 세로.
	/** @private @type { Engine } */ #engine;
	/** @private @type { boolean[] } */ #mouseButtonsDown; // 마우스 단추 셋의 눌림. (MouseButton 차례)
	/** @private @type { boolean[] } */ #mouseButtonsJustPressed; // 지난 프레임 끝 뒤로 눌린 단추.
	/** @private @type { boolean[] } */ #mouseButtonsJustReleased; // 지난 프레임 끝 뒤로 떼어진 단추.
	/** @private @type { TouchPoint[] } */ #touchPoints; // 닿아 있는 손가락. (닿은 차례)
	/** @private @type { TouchPoint[] } */ #endedTouchPoints; // 지난 프레임 끝 뒤로 떨어진 손가락.
	/** @private @type { string } */ #lastInputDevice; // InputDevice 의 값.
	/** @private @type { string } */ #lastGamepadKind; // GamepadKind 의 값.
	/** @private @type { Set<string> } */ #preventedKeys; // 브라우저 기본 동작을 막을 키.
	/** @private @type { boolean } */ #isContextMenuPrevented; // 캔버스의 오른쪽 클릭 메뉴를 막는지.
	/** @private @type { boolean } */ #isTouchFromLeftButtonOnly; // 마우스 왼쪽 단추만 터치로 넘기는지.
	/** @private @type { InputActions } */ #inputActions;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { Engine } engine 
	 */
	constructor(engine) {
		super();
		this.#keys = new Set();
		this.#justPressedKeys = new Set();
		this.#justReleasedKeys = new Set();
		this.#isTouchPressed = false;
		this.#isTouchReleased = false;
		this.#isTouchCancelled = false;
		this.#isTouchMoved = false;
		this.#isTouchDown = false;
		this.#isWheelWithCtrl = false;
		this.#canvasNativeInputPosition = Vector2.zero();
		this.#viewInputPosition = Vector2.zero();
		this.#gamepadManager = new GamepadManager(engine);
		this.#wheelDeltaX = 0;
		this.#wheelDeltaY = 0;
		this.#engine = engine;
		this.#mouseButtonsDown = new System.Array(MOUSE_BUTTON_COUNT).fill(false);
		this.#mouseButtonsJustPressed = new System.Array(MOUSE_BUTTON_COUNT).fill(false);
		this.#mouseButtonsJustReleased = new System.Array(MOUSE_BUTTON_COUNT).fill(false);
		this.#touchPoints = [];
		this.#endedTouchPoints = [];
		this.#lastInputDevice = InputDevice.keyboard;
		if (typeof System.matchMedia === "function") {
			const mediaQueryList = System.matchMedia("(pointer: coarse)");
			if (mediaQueryList.matches) {
				this.#lastInputDevice = InputDevice.touch;
			}
		}
		this.#lastGamepadKind = GamepadKind.other;
		this.#preventedKeys = new Set();
		this.#isContextMenuPrevented = true;
		this.#isTouchFromLeftButtonOnly = false;
		this.#inputActions = new InputActions();
	}

	//==============================================================================
	// 갱신. (게임패드 폴링, 패드를 썼으면 마지막 장치를 게임패드로, 입력 동작 갱신)
	//==============================================================================
	/**
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		const gamepadManager = this.getGamepadManager();
		if (gamepadManager) {
			gamepadManager.tick(timeDelta);
			const activeGamepadId = gamepadManager.getActiveGamepadId();
			if (activeGamepadId !== "") {
				this.setLastInputDevice(InputDevice.gamepad);
				const gamepadKind = readGamepadKind(activeGamepadId);
				this.setLastGamepadKind(gamepadKind);
			}
		}
		const inputActions = this.getInputActions();
		inputActions.update(this, timeDelta);
	}

	//==============================================================================
	// 모든 입력 상태를 초기 상태로 되돌림. (페이지 프로세스 복원 시 stuck touch/key 방지용)
	//==============================================================================
	clear() {
		this.#keys.clear();
		this.#justPressedKeys.clear();
		this.#justReleasedKeys.clear();
		this.#isTouchPressed = false;
		this.#isTouchReleased = false;
		this.#isTouchCancelled = false;
		this.#isTouchMoved = false;
		this.#isTouchDown = false;
		this.#wheelDeltaX = 0;
		this.#wheelDeltaY = 0;
		this.#mouseButtonsDown.fill(false);
		this.#mouseButtonsJustPressed.fill(false);
		this.#mouseButtonsJustReleased.fill(false);
		this.#touchPoints = [];
		this.#endedTouchPoints = [];
		this.#inputActions.clear();
	}

	//==============================================================================
	// 마우스 휠 누적값.
	// - addWheelDelta 로 들어온 값을 한 프레임 누적해서 들고 있다가, 프레임 종료 시
	//   엔진이 clearWheelDelta() 로 비운다.
	//==============================================================================
	addWheelDelta(deltaX, deltaY) {
		this.#wheelDeltaX += deltaX;
		this.#wheelDeltaY += deltaY;
	}

	getWheelDeltaX() {
		return this.#wheelDeltaX;
	}

	getWheelDeltaY() {
		return this.#wheelDeltaY;
	}

	hasWheelDelta() {
		return this.#wheelDeltaX !== 0 || this.#wheelDeltaY !== 0;
	}

	clearWheelDelta() {
		this.#wheelDeltaX = 0;
		this.#wheelDeltaY = 0;
	}

	//==============================================================================
	// 마지막 휠을 Ctrl 과 함께 굴렸는지 설정. (엔진이 wheel 에서 부른다, 노트북 터치패드의 오므리기도 Ctrl 휠로 온다)
	//==============================================================================
	/**
	 * @param { boolean } isWheelWithCtrl
	 */
	setWheelWithCtrl(isWheelWithCtrl) {
		this.#isWheelWithCtrl = isWheelWithCtrl;
	}

	//==============================================================================
	// 마지막 휠을 Ctrl 과 함께 굴렸는지 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isWheelWithCtrl() {
		return this.#isWheelWithCtrl;
	}

	//==============================================================================
	// 키 누름 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } value
	 */
	pushKey(key) {
		if (!this.#keys.has(key)) {
			this.#justPressedKeys.add(key);
		}
		this.#keys.add(key);
	}

	//==============================================================================
	// 키 뗌 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } value
	 */
	popKey(key) {
		if (this.#keys.has(key)) {
			this.#justReleasedKeys.add(key);
		}
		this.#keys.delete(key);
	}

	//==============================================================================
	// 키 누름 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isKeyPressed(key) {
		return this.#keys.has(key);
	}

	//==============================================================================
	// 이번 프레임에 방금 눌린 키인지 여부.
	// - 게임마다 wasPressed 변수를 손으로 들고 다니던 것을 대신한다.
	// - 지난 프레임 끝 뒤로 온 키 사건을 본다. 프레임 사이에 눌렀다 뗀 키도 참이다. (그때는 isKeyPressed 가 거짓이고 isKeyJustReleased 도 참)
	//==============================================================================
	/**
	 * @param { string } key
	 * @returns { boolean }
	 */
	isKeyJustPressed(key) {
		return this.#justPressedKeys.has(key);
	}

	//==============================================================================
	// 이번 프레임에 방금 떼어진 키인지 여부.
	//==============================================================================
	/**
	 * @param { string } key
	 * @returns { boolean }
	 */
	isKeyJustReleased(key) {
		return this.#justReleasedKeys.has(key);
	}

	//==============================================================================
	// 프레임 스냅샷 갱신.
	// - 엔진이 프레임 끝에서 부른다. 이번 프레임에 본 키와 마우스 단추의 눌림, 뗌을 비우고, 떨어진 손가락을 지우고 남은 손가락을 가만히로 둔다.
	//==============================================================================
	updateFrameSnapshot() {
		this.#justPressedKeys.clear();
		this.#justReleasedKeys.clear();
		this.#mouseButtonsJustPressed.fill(false);
		this.#mouseButtonsJustReleased.fill(false);
		this.#endedTouchPoints = [];
		for (const touchPoint of this.#touchPoints) {
			touchPoint.phase = TouchPhase.stationary;
		}
	}

	//==============================================================================
	// 누름 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } value
	 */
	setTouchPressed(value) {
		this.#isTouchPressed = value;
	}

	//==============================================================================
	// 뗌 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } value
	 */
	setTouchReleased(value) {
		this.#isTouchReleased = value;
	}

	//==============================================================================
	// 취소 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } value
	 */
	setTouchCancelled(value) {
		this.#isTouchCancelled = value;
	}

	//==============================================================================
	// 누르고 있는 중인지 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } value
	 */
	setTouchMoved(value) {
		this.#isTouchMoved = value;
	}

	//==============================================================================
	// 누름 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 
	 */
	isTouchPressed() {
		return this.#isTouchPressed;
	}

	//==============================================================================
	// 뗌 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isTouchReleased() {
		return this.#isTouchReleased;
	}

	//==============================================================================
	// 취소 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isTouchCancelled() {
		return this.#isTouchCancelled;
	}

	//==============================================================================
	// 누르고 있는 중인지 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 
	 */
	isTouchMoved() {
		return this.#isTouchMoved;
	}

	//==============================================================================
	// 터치가 눌린 채인지 설정. (엔진이 누름과 뗌에서 부른다)
	//==============================================================================
	/**
	 * @param { boolean } value
	 */
	setTouchDown(value) {
		this.#isTouchDown = value;
	}

	//==============================================================================
	// 터치가 눌린 채인지 반환. (누른 프레임부터 뗄 때까지 참, 누른 채 움직이지 않아도 참)
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isTouchDown() {
		return this.#isTouchDown;
	}

	//==============================================================================
	// canvasNativeSize 기반 입력 위치 갱신.
	//==============================================================================
	/**
	 * @param { Vector2 } position 
	 */
	setCanvasNativeInputPosition(position) {
		position.x = Math.round(position.x);
		position.y = Math.round(position.y);
		this.#canvasNativeInputPosition = position;
	}

	//==============================================================================
	// canvasNativeSize 기반 입력 위치 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 
	 */
	getCanvasNativeInputPosition() {
		return this.#canvasNativeInputPosition;
	}

	//==============================================================================
	// 뷰의 입력 위치 갱신.
	//==============================================================================
	/**
	 * @param { Vector2 } position 
	 */
	setViewInputPosition(position) {
		position.x = Math.round(position.x);
		position.y = Math.round(position.y);
		this.#viewInputPosition = position;
	}

	//==============================================================================
	// 뷰의 입력 위치 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 
	 */
	getViewInputPosition() {
		return this.#viewInputPosition;
	}

    //==============================================================================
    // 모든 게임패드 갱신.
    //==============================================================================
    updateAllGamepads() {
		const gamepadManager = this.getGamepadManager();
		if (gamepadManager) {
			gamepadManager.updateAllGamepads();
		}	
	}

	//==============================================================================
	// 게임패드 연결.
	//==============================================================================
	/**
	 * @param { Gamepad } gamepad
	 */
	connectGamepad(gamepad) {
		const gamepadManager = this.getGamepadManager();
		if (gamepadManager) {
			gamepadManager.connect(gamepad);
		}
	}

	//==============================================================================
	// 게임패드 연결 해제.
	//==============================================================================
	/**
	 * @param { Gamepad } gamepad
	 */
	disconnectGamepad(gamepad) {
		const gamepadManager = this.getGamepadManager();
		if (gamepadManager) {
			gamepadManager.disconnect(gamepad);
		}
	}

	//==============================================================================
	// 게임패드 매니저 반환.
	//==============================================================================
	/**
	 * @returns { GamepadManager } 
	 */
	getGamepadManager() {
		return this.#gamepadManager;
	}

	//==============================================================================
	// 마우스 단추 눌림 설정. (엔진이 mousedown, mouseup 에서 부른다)
	//==============================================================================
	/**
	 * @param { number } mouseButton MouseButton 의 값.
	 * @param { boolean } isDown
	 */
	setMouseButtonDown(mouseButton, isDown) {
		if (mouseButton < 0 || mouseButton >= MOUSE_BUTTON_COUNT) {
			return;
		}
		const wasDown = this.#mouseButtonsDown[mouseButton];
		if (isDown && !wasDown) {
			this.#mouseButtonsJustPressed[mouseButton] = true;
		}
		if (!isDown && wasDown) {
			this.#mouseButtonsJustReleased[mouseButton] = true;
		}
		this.#mouseButtonsDown[mouseButton] = isDown;
	}

	//==============================================================================
	// 마우스 단추가 눌려 있는지.
	//==============================================================================
	/**
	 * @param { number } mouseButton MouseButton 의 값.
	 * @returns { boolean }
	 */
	isMouseButtonDown(mouseButton) {
		return this.#mouseButtonsDown[mouseButton] === true;
	}

	//==============================================================================
	// 이번 프레임에 마우스 단추를 눌렀는지. (프레임 사이에 눌렀다 뗀 것도 참)
	//==============================================================================
	/**
	 * @param { number } mouseButton MouseButton 의 값.
	 * @returns { boolean }
	 */
	isMouseButtonJustPressed(mouseButton) {
		return this.#mouseButtonsJustPressed[mouseButton] === true;
	}

	//==============================================================================
	// 이번 프레임에 마우스 단추를 뗐는지.
	//==============================================================================
	/**
	 * @param { number } mouseButton MouseButton 의 값.
	 * @returns { boolean }
	 */
	isMouseButtonJustReleased(mouseButton) {
		return this.#mouseButtonsJustReleased[mouseButton] === true;
	}

	//==============================================================================
	// 마우스 왼쪽 단추만 터치로 넘길지 설정. (끄면(기본) 지금까지처럼 어느 단추든 터치다)
	// - 오른쪽이나 가운데 끌기를 카메라에 쓰는 게임이 켜면 그 단추로 UI 가 눌리지 않는다.
	//==============================================================================
	/**
	 * @param { boolean } isLeftButtonOnly
	 */
	setTouchFromLeftButtonOnly(isLeftButtonOnly) {
		this.#isTouchFromLeftButtonOnly = isLeftButtonOnly;
	}

	//==============================================================================
	// 마우스 왼쪽 단추만 터치로 넘기는지 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isTouchFromLeftButtonOnly() {
		return this.#isTouchFromLeftButtonOnly;
	}

	//==============================================================================
	// 캔버스의 오른쪽 클릭 메뉴를 막을지 설정. (처음은 참, 지금까지와 같다)
	//==============================================================================
	/**
	 * @param { boolean } isPrevented
	 */
	setContextMenuPrevented(isPrevented) {
		this.#isContextMenuPrevented = isPrevented;
	}

	//==============================================================================
	// 캔버스의 오른쪽 클릭 메뉴를 막는지 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isContextMenuPrevented() {
		return this.#isContextMenuPrevented;
	}

	//==============================================================================
	// 손가락이 닿음. (엔진이 touchstart 의 바뀐 손가락마다 부른다, 이미 있는 번호면 움직임으로 본다)
	//==============================================================================
	/**
	 * @param { number } identifier
	 * @param { Vector2 } canvasNativePosition
	 * @param { Vector2 } viewPosition
	 */
	beginTouchPoint(identifier, canvasNativePosition, viewPosition) {
		const touchPoint = this.findTouchPoint(identifier);
		if (touchPoint !== null) {
			this.moveTouchPoint(identifier, canvasNativePosition, viewPosition);
			return;
		}
		this.#touchPoints.push(new TouchPoint(identifier, TouchPhase.began, canvasNativePosition, viewPosition));
	}

	//==============================================================================
	// 손가락이 움직임. (이번 프레임에 닿은 손가락은 began 그대로)
	//==============================================================================
	/**
	 * @param { number } identifier
	 * @param { Vector2 } canvasNativePosition
	 * @param { Vector2 } viewPosition
	 */
	moveTouchPoint(identifier, canvasNativePosition, viewPosition) {
		const touchPoint = this.findTouchPoint(identifier);
		if (touchPoint === null) {
			return;
		}
		touchPoint.canvasNativePosition = canvasNativePosition;
		touchPoint.viewPosition = viewPosition;
		if (touchPoint.phase !== TouchPhase.began) {
			touchPoint.phase = TouchPhase.moved;
		}
	}

	//==============================================================================
	// 손가락이 떨어짐. (닿은 목록에서 빼서 이번 프레임의 떨어진 목록에 둔다)
	//==============================================================================
	/**
	 * @param { number } identifier
	 * @param { Vector2 } canvasNativePosition
	 * @param { Vector2 } viewPosition
	 * @param { boolean } isCancelled
	 */
	endTouchPoint(identifier, canvasNativePosition, viewPosition, isCancelled) {
		const touchPoint = this.findTouchPoint(identifier);
		if (touchPoint === null) {
			return;
		}
		const touchIndex = this.#touchPoints.indexOf(touchPoint);
		this.#touchPoints.splice(touchIndex, 1);
		touchPoint.canvasNativePosition = canvasNativePosition;
		touchPoint.viewPosition = viewPosition;
		touchPoint.phase = isCancelled ? TouchPhase.cancelled : TouchPhase.ended;
		this.#endedTouchPoints.push(touchPoint);
	}

	//==============================================================================
	// 손가락 찾기. (없으면 null)
	//==============================================================================
	/**
	 * @param { number } identifier
	 * @returns { TouchPoint | null }
	 */
	findTouchPoint(identifier) {
		for (const touchPoint of this.#touchPoints) {
			if (touchPoint.identifier === identifier) {
				return touchPoint;
			}
		}
		return null;
	}

	//==============================================================================
	// 닿아 있는 손가락 목록. (닿은 차례, 단계는 began, moved, stationary, 받은 배열을 바꾸지 않는다)
	//==============================================================================
	/**
	 * @returns { TouchPoint[] }
	 */
	getTouchPoints() {
		return this.#touchPoints;
	}

	//==============================================================================
	// 이번 프레임에 떨어진 손가락 목록. (단계는 ended, cancelled, 자리는 뗀 자리)
	//==============================================================================
	/**
	 * @returns { TouchPoint[] }
	 */
	getEndedTouchPoints() {
		return this.#endedTouchPoints;
	}

	//==============================================================================
	// 마지막으로 쓴 입력 장치 설정. (엔진이 키, 마우스, 손가락, 패드 입력에서 부른다, 게임이 바깥 입력원을 쓸 때도)
	//==============================================================================
	/**
	 * @param { string } inputDevice InputDevice 의 값.
	 */
	setLastInputDevice(inputDevice) {
		this.#lastInputDevice = inputDevice;
	}

	//==============================================================================
	// 마지막으로 쓴 입력 장치 반환. (처음은 손가락 기기면 touch, 아니면 keyboard)
	//==============================================================================
	/**
	 * @returns { string } InputDevice 의 값.
	 */
	getLastInputDevice() {
		return this.#lastInputDevice;
	}

	//==============================================================================
	// 마지막 입력이 손가락인지. (마우스, 키보드, 게임패드면 거짓)
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isTouchInput() {
		const lastInputDevice = this.getLastInputDevice();
		return lastInputDevice === InputDevice.touch;
	}

	//==============================================================================
	// 마지막으로 쓴 게임패드의 종류 설정.
	//==============================================================================
	/**
	 * @param { string } gamepadKind GamepadKind 의 값.
	 */
	setLastGamepadKind(gamepadKind) {
		this.#lastGamepadKind = gamepadKind;
	}

	//==============================================================================
	// 마지막으로 쓴 게임패드의 종류 반환. (단추를 누르거나 스틱을 크게 기울인 패드의 이름으로 가른다, 처음은 other)
	//==============================================================================
	/**
	 * @returns { string } GamepadKind 의 값.
	 */
	getLastGamepadKind() {
		return this.#lastGamepadKind;
	}

	//==============================================================================
	// 브라우저 기본 동작을 막을 키 설정. (KeyboardEvent.code 목록, Tab 의 초점 옮기기, Space 의 쪽 넘기기 같은 것)
	// - 글자 입력칸에 초점이 있으면 막지 않는다. (isTypingInTextField)
	//==============================================================================
	/**
	 * @param { string[] } keys
	 */
	setPreventedKeys(keys) {
		this.#preventedKeys = new Set(keys);
	}

	//==============================================================================
	// 브라우저 기본 동작을 막을 키 목록 반환. (사본)
	//==============================================================================
	/**
	 * @returns { string[] }
	 */
	getPreventedKeys() {
		return System.Array.from(this.#preventedKeys);
	}

	//==============================================================================
	// 그 키의 기본 동작을 막는지.
	//==============================================================================
	/**
	 * @param { string } key
	 * @returns { boolean }
	 */
	isKeyPrevented(key) {
		return this.#preventedKeys.has(key);
	}

	//==============================================================================
	// 글자 입력칸에 쓰는 중인지. (초점이 글자 input, textarea, contenteditable, select 에 있음)
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isTypingInTextField() {
		const engine = this.#engine;
		if (engine && engine.isTextInputFocused()) {
			return true;
		}
		const document = System.document;
		if (!document || !document.activeElement) {
			return false;
		}
		return document.activeElement.tagName === "SELECT";
	}

	//==============================================================================
	// 입력 동작 반환. (동작 이름에 키, 패드 단추, 축을 묶어 읽는다, tick 마다 갱신된다)
	//==============================================================================
	/**
	 * @returns { InputActions }
	 */
	getInputActions() {
		return this.#inputActions;
	}
}