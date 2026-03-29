//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Engine } from "./engine.js";


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
	/**@private @type { Gamepad[] } */ #gamepads; // 게임패드 목록.
	/** @private @type { Set<string> } */ #keys; // 키 목록.
	/** @private @type { boolean } */ #isTouchPressed; // 입력시 딱 한번 눌림.
	/** @private @type { boolean } */ #isTouchReleased; // 입력시 딱 한번 뗌.
	/** @private @type { boolean } */ #isTouchMoved; // 입력시 뗄 때가지 계속 눌림.
	/** @private @type { Vector2 } */ #canvasNativeInputPosition; // canvasNativeSize 기반 위치값.
	/** @private @type { Vector2 } */ #viewInputPosition;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { Engine } engine 
	 */
	constructor(engine) {
		super();

		this.#gamepads = [];
		this.#keys = new Set();
		this.#isTouchPressed = false;
		this.#isTouchReleased = false;	
		this.#isTouchMoved = false;
		this.#canvasNativeInputPosition = Vector2.zero();
		this.#viewInputPosition = Vector2.zero();
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
	}

	//==============================================================================
	// 모든 게임패드 갱신.
	//==============================================================================
	updateAllGamepads() {
		const gamepads = System.navigator.getGamepads();
		for (let gamepadIndex = 0; gamepadIndex < gamepads.length; ++gamepadIndex) {
			const gamepad = gamepads[gamepadIndex];
			if (gamepad === null) {
				continue;
			}

			for (let buttonIndex = 0; buttonIndex < gamepad.buttons.length; ++buttonIndex) {
				const button = gamepad.buttons[buttonIndex];
				if (button === null) {
					continue;
				}

				if (button.pressed) {
					console.log(`[${gamepadIndex}][${buttonIndex}] pressed`);
				}
			}

			// // 0~3
			// for (let axisIndex = 0; axisIndex < gamepad.axes.length; ++axisIndex) {
			// 	const axis = gamepad.axes[axisIndex];
			// 	if (axis === null) {
			// 		continue;
			// 	}

			// 	console.log(`[${gamepadIndex}][${axisIndex}] axis: ${axis}`);
			// }
		}
	}

	//==============================================================================
	// 연결된 게임패드 갯수 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getGamepadCount() {
		const gamepads = System.navigator.getGamepads();
		return gamepads.length;
	}

	//==============================================================================
	// 게임패드 반환.
	//==============================================================================
	/**
	 * @param { number } gamepadIndex
	 * @returns { Gamepad }
	 */
	getGamepad(gamepadIndex) {
		const gamepads = System.navigator.getGamepads();
		if (gamepads === null) {
			return null;
		}
		else if (gamepadIndex < 0 || gamepadIndex >= gamepads.length) {
			return null;
		}

		// Gamepad
		const gamepad = gamepads.at(gamepadIndex);
		// gamepad.id // string
		// gamepad.connected // boolean
		// gamepad.index // number
		// gamepad.mapping // GamepadMappingType
		// gamepad.timestamp // DOMHighResTimeStamp
		// gamepad.vibrationActuator // GamepadHapticActuator
		return gamepad;
	}

	//==============================================================================
	// 게임패드 버튼 눌림 상태 반환.
	//==============================================================================
	/**
	 * @param { number } gamepadIndex 
	 * @param { number } buttonIndex 
	 * @returns { boolean }
	 */
	isGamepadButtonPressed(gamepadIndex, buttonIndex) {
		const gamepad = this.getGamepad(gamepadIndex);
		if (gamepad === null || buttonIndex < 0 || buttonIndex >= gamepad.buttons.length) {
			return false;
		}

		// GamepadButton[]
		const button = gamepad.buttons[buttonIndex];
		if (button === null) {
			return false;
		}

		return button.pressed;
	}

	//==============================================================================
	// 게임패드 아날로그 스틱 축 값 반환. (-1.0 ~ 1.0)
	//==============================================================================
	/**
	 * @param { number } gamepadIndex 
	 * @param { number } axisIndex 
	 * @returns { number }
	 */
	getGamepadAxis(gamepadIndex, axisIndex) {
		const gamepad = this.getGamepad(gamepadIndex);
		if (gamepad === null || axisIndex < 0 || axisIndex >= gamepad.axes.length) {
			return false;
		}

		const axis = gamepad.axes[axisIndex];
		if (axis === null) {
			return false;
		}

		return axis;
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
}