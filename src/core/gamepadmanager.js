//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Engine } from "./engine.js";


//==============================================================================
// 게임패드 아날로그 스틱 식별자. (W3C Standard Gamepad 매핑 규격)
//==============================================================================
/** @enum { number } */
export const GamepadAnalogStickCode = {
	LEFT_X: 0,
	LEFT_Y: 1,
	RIGHT_X: 2,
	RIGHT_Y: 3,
};


//==============================================================================
// 게임패드 트리거 식별자. (W3C Standard Gamepad 매핑 규격)
//==============================================================================
/** @enum { number } */
export const GamepadTriggerCode = {
	L2: 6,
	R2: 7,
};


//==============================================================================
// 게임패드 버튼 식별자. (W3C Standard Gamepad 매핑 규격)
//==============================================================================
/** @enum { number } */
export const GamepadButtonCode = {
	// Face Buttons
	A_CROSS: 0,
	B_CIRCLE: 1,
	X_SQUARE: 2,
	Y_TRIANGLE: 3,

	// Bumpers
	L1: 4,
	R1: 5,

	// Triggers (버튼으로도 인식됨)
	L2: 6,
	R2: 7,

	// System
	SHARE_VIEW: 8,
	OPTIONS_MENU: 9,

	// Stick Clicks
	L3: 10,
	R3: 11,

	// D-Pad
	DPAD_UP: 12,
	DPAD_DOWN: 13,
	DPAD_LEFT: 14,
	DPAD_RIGHT: 15,

	// Center
	HOME_PS: 16,
	TOUCHPAD: 17,
};


//==============================================================================
// 입력 매니저.
//==============================================================================
export class GamepadManager extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/**@private @type { number[] } */ #connectedGamepadIndices; // 연결된 게임패드 식별자(index) 목록.
	/**@private @type { Map<number, Object> } */ #connectedGamepadStates; // key: index, value: { buttons: Map, axes: Map }
	/**@private @type { Function | null } */ #inputEventCallback; // 입력 콜백 함수.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { Engine } engine 
	 */
	constructor(engine) {
		super();
		this.#connectedGamepadIndices = [];
		this.#connectedGamepadStates = new Map();
		this.#inputEventCallback = null;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		this.updateAllGamepads();
	}

	//==============================================================================
	// 게임패드 연결.
	//==============================================================================
	/**
	 * @param { Gamepad } gamepad
	 */
	connect(gamepad) {
		if (gamepad === null || gamepad === undefined || this.#connectedGamepadIndices.indexOf(gamepad.index) !== -1) {
			return;
		}

		const state = {
			buttons: new Map(), // key: index, value: { pressed: boolean, value: number }
			axes: new Map(),    // key: index, value: number
		};

		// 버튼 초기화.
		for (let i = 0; i < gamepad.buttons.length; i++) {
			state.buttons.set(i, { pressed: false, value: 0 });
		}

		// 축 초기화.
		for (let i = 0; i < gamepad.axes.length; i++) {
			state.axes.set(i, 0);
		}

		this.#connectedGamepadIndices.push(gamepad.index);
		this.#connectedGamepadStates.set(gamepad.index, state);
		console.log(`[GamepadManager] Connected: ${gamepad.id} at index ${gamepad.index}`);
	}

	//==============================================================================
	// 게임패드 연결 해제.
	//==============================================================================
	/**
	 * @param { Gamepad } gamepad
	 */
	disconnect(gamepad) {
		if (gamepad === null || gamepad === undefined) {
			return;
		}
		const listIndex = this.#connectedGamepadIndices.indexOf(gamepad.index);
		if (listIndex === -1) {
			return;
		}

		this.#connectedGamepadIndices.splice(listIndex, 1);
		this.#connectedGamepadStates.delete(gamepad.index);
		console.log(`[GamepadManager] Disconnected: index ${gamepad.index}`);
	}

	//==============================================================================
	// 콜백 설정.
	//==============================================================================
	/**
	 * @param { (gamepadIndex: number, inputType: "button" | "value" | "axis", inputIndex: number, value: any) => void } callback
	 */
	setCallback(callback) {
		this.#inputEventCallback = callback;
	}

	//==============================================================================
	// 모든 게임패드 갱신.
	//==============================================================================
	updateAllGamepads() {
		const gamepads = System.navigator.getGamepads();
		for (const hardwareIndex of this.#connectedGamepadIndices) {
			const gamepad = gamepads[hardwareIndex];
			if (!gamepad) {
				continue;
			}

			const state = this.#connectedGamepadStates.get(hardwareIndex);
			if (!state) {
				continue;
			}

			// 버튼 및 트리거 상태 확인.
			for (let i = 0; i < gamepad.buttons.length; i++) {
				const currentButton = gamepad.buttons[i];
				const lastButtonState = state.buttons.get(i);

				if (!lastButtonState) {
					continue;
				}

				// 눌림 상태 변화 감지.
				if (lastButtonState.pressed !== currentButton.pressed) {
					lastButtonState.pressed = currentButton.pressed;
					const label = (i === GamepadButtonCode.L2 || i === GamepadButtonCode.R2) ? "Trigger" : "Button";
					
					// 로그 출력.
					console.log(`[GamepadManager] Pad ${hardwareIndex} ${label} ${i} ${currentButton.pressed ? "Pressed" : "Released"}`);
					
					// 콜백 호출.
					if (this.#inputEventCallback) {
						this.#inputEventCallback(hardwareIndex, "button", i, currentButton.pressed);
					}
				}

				// 아날로그 값(트리거 등) 변화 감지 (소수점 2자리까지).
				const currentValue = parseFloat(currentButton.value.toFixed(2));
				if (lastButtonState.value !== currentValue) {
					lastButtonState.value = currentValue;
					
					// 트리거 등 값이 유의미할 때만 처리.
					if (currentValue > 0) {
						const label = (i === GamepadButtonCode.L2 || i === GamepadButtonCode.R2) ? "Trigger" : "Button";
						
						// 로그 출력.
						console.log(`[GamepadManager] Pad ${hardwareIndex} ${label} ${i} Value: ${currentValue}`);
						
						// 콜백 호출.
						if (this.#inputEventCallback) {
							this.#inputEventCallback(hardwareIndex, "value", i, currentValue);
						}
					}
				}
			}

			// 아날로그 스틱(축) 상태 확인.
			for (let i = 0; i < gamepad.axes.length; i++) {
				const currentAxisValue = parseFloat(gamepad.axes[i].toFixed(2));
				const lastAxisValue = state.axes.get(i);

				// 미세한 떨림(Deadzone) 고려하여 0.01 이상의 변화만 감지.
				if (Math.abs(lastAxisValue - currentAxisValue) > 0.01) {
					state.axes.set(i, currentAxisValue);
					
					// 로그 출력.
					console.log(`[GamepadManager] Pad ${hardwareIndex} Axis ${i} Value: ${currentAxisValue}`);
					
					// 콜백 호출.
					if (this.#inputEventCallback) {
						this.#inputEventCallback(hardwareIndex, "axis", i, currentAxisValue);
					}
				}
			}
		}
	}

	//==============================================================================
	// 버튼 눌림 상태 반환.
	//==============================================================================
	/**
	 * @param { number } gamepadIndex 
	 * @param { number } buttonIndex 
	 * @returns { boolean }
	 */
	isButtonPressed(gamepadIndex, buttonIndex) {
		const state = this.#connectedGamepadStates.get(gamepadIndex);
		if (!state) return false;
		const button = state.buttons.get(buttonIndex);
		return button ? button.pressed : false;
	}

	//==============================================================================
	// 버튼/트리거 아날로그 값 반환 (0.0 ~ 1.0).
	//==============================================================================
	/**
	 * @param { number } gamepadIndex 
	 * @param { number } buttonIndex 
	 * @returns { number }
	 */
	getButtonValue(gamepadIndex, buttonIndex) {
		const state = this.#connectedGamepadStates.get(gamepadIndex);
		if (!state) return 0;
		const button = state.buttons.get(buttonIndex);
		return button ? button.value : 0;
	}

	//==============================================================================
	// 아날로그 스틱 축 값 반환 (-1.0 ~ 1.0).
	//==============================================================================
	/**
	 * @param { number } gamepadIndex 
	 * @param { number } axisIndex 
	 * @returns { number }
	 */
	getAxisValue(gamepadIndex, axisIndex) {
		const state = this.#connectedGamepadStates.get(gamepadIndex);
		if (!state) return 0;
		return state.axes.get(axisIndex) || 0;
	}

	//==============================================================================
	// 연결된 모든 게임패드 반환.
	//==============================================================================
	/**
	 * @returns { Gamepad[] }
	 */
	getAllConnectedGamepads() {
		const gamepads = System.navigator.getGamepads();
		const connected = [];
		for (const hardwareIndex of this.#connectedGamepadIndices) {
			const gamepad = gamepads[hardwareIndex];
			if (gamepad) {
				connected.push(gamepad);
			}
		}
		return connected;
	}

	//==============================================================================
	// 연결된 게임패드 수 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getConnectedGamepadCount() {
		return this.#connectedGamepadIndices.length;
	}

	//==============================================================================
	// 연결된 게임패드 반환.
	//==============================================================================
	/**
	 * @returns { Gamepad | undefined }
	 */
	getConnectedGamepad(gamepadIndex) {
		if (gamepadIndex < 0 || gamepadIndex >= this.#connectedGamepadIndices.length) {
			return undefined;
		}

		const hardwareIndex = this.#connectedGamepadIndices.at(gamepadIndex);
		const gamepads = System.navigator.getGamepads();
		return gamepads[hardwareIndex];
	}
}