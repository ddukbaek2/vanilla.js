//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Engine } from "./engine.js";
import { GamepadManager } from "./gamepadmanager.js";


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
	audiomute: "AudioMute",
	audioplay: "MediaPlay",
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
// 입력 매니저.
//==============================================================================
export class InputManager extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Set<string> } */ #keys; // 키 목록.
	/** @private @type { boolean } */ #isTouchPressed; // 입력시 딱 한번 눌림.
	/** @private @type { boolean } */ #isTouchReleased; // 입력시 딱 한번 뗌.
	/** @private @type { boolean } */ #isTouchCancelled; // 입력시 딱 한번 취소됨.
	/** @private @type { boolean } */ #isTouchMoved; // 입력시 뗄 때가지 계속 눌림.
	/** @private @type { Vector2 } */ #canvasNativeInputPosition; // canvasNativeSize 기반 위치값.
	/** @private @type { Vector2 } */ #viewInputPosition; // referenceResolutionSize 기반 위치값.
	/** @private @type { GamepadManager } */ #gamepadManager;

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
		this.#isTouchPressed = false;
		this.#isTouchReleased = false;
		this.#isTouchCancelled = false;
		this.#isTouchMoved = false;
		this.#canvasNativeInputPosition = Vector2.zero();
		this.#viewInputPosition = Vector2.zero();
		this.#gamepadManager = new GamepadManager(engine);
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		const gamepadManager = this.getGamepadManager();
		if (gamepadManager) {
			gamepadManager.tick(timeDelta);
		}
	}

	//==============================================================================
	// 모든 입력 상태를 초기 상태로 되돌림. (페이지 프로세스 복원 시 stuck touch/key 방지용)
	//==============================================================================
	clearAllInputState() {
		this.#keys.clear();
		this.#isTouchPressed = false;
		this.#isTouchReleased = false;
		this.#isTouchCancelled = false;
		this.#isTouchMoved = false;
	}

	//==============================================================================
	// 키 누름 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } value
	 */
	pushKey(key) {
		this.#keys.add(key);
	}

	//==============================================================================
	// 키 뗌 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } value
	 */
	popKey(key) {
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
}