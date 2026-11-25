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
// 게임패드 종류. (단추 안내를 그 패드의 표기로 보일 때 쓴다)
//==============================================================================
/** @enum { string } */
export const GamepadKind = System.Object.freeze({
	xbox: "xbox", // 엑스박스 패드.
	playstation: "playstation", // 플레이스테이션 패드.
	nintendo: "nintendo", // 닌텐도 패드.
	other: "other", // 그 밖의 패드, 또는 모름.
});

// 패드 이름(Gamepad.id)에 이것이 있으면 그 종류다. (소문자, 브라우저가 이름에 붙이는 USB 제조사 번호와 흔한 이름)
const PLAYSTATION_GAMEPAD_ID_PARTS = ["054c", "playstation", "dualshock", "dualsense", "sony"];
const NINTENDO_GAMEPAD_ID_PARTS = ["057e", "nintendo", "joy-con", "pro controller"];
const XBOX_GAMEPAD_ID_PARTS = ["045e", "xbox", "xinput", "microsoft"];
// 축이 이만큼 넘게 기울면 그 패드를 쓴 것으로 본다. (가운데의 떨림으로 마지막 장치가 바뀌지 않게)
const GAMEPAD_ACTIVE_AXIS_THRESHOLD = 0.5;


//==============================================================================
// 패드 이름으로 종류 가르기. (플레이스테이션 054c, 닌텐도 057e, 엑스박스 045e 와 이름, 모르면 other)
//==============================================================================
/**
 * @param { string } gamepadId Gamepad.id
 * @returns { string } GamepadKind 의 값.
 */
export function readGamepadKind(gamepadId) {
	if (typeof gamepadId !== "string") {
		return GamepadKind.other;
	}
	const lowerCaseId = gamepadId.toLowerCase();
	const kindPartList = [
		[GamepadKind.playstation, PLAYSTATION_GAMEPAD_ID_PARTS],
		[GamepadKind.nintendo, NINTENDO_GAMEPAD_ID_PARTS],
		[GamepadKind.xbox, XBOX_GAMEPAD_ID_PARTS],
	];
	for (const [gamepadKind, idParts] of kindPartList) {
		for (const idPart of idParts) {
			if (lowerCaseId.includes(idPart)) {
				return gamepadKind;
			}
		}
	}
	return GamepadKind.other;
}


//==============================================================================
// 입력 매니저.
//==============================================================================
/**
 * @example <caption>패드 단추와 스틱 읽기</caption>
 * import { Engine, EngineConfiguration, Scene } from "./build/vanilla.js";
 *
 * class MainScene extends Scene {
 * 	tick(timeDelta) {
 * 		super.tick(timeDelta);
 * 		const engine = this.getEngine();
 * 		const inputManager = engine.getInputManager();
 * 		const gamepadManager = inputManager.getGamepadManager();
 * 		const gamepads = gamepadManager.getAllConnectedGamepads();
 * 		for (const gamepad of gamepads) {
 * 			if (gamepadManager.isButtonJustPressed(gamepad.index, 0)) {
 * 				console.log("jump", gamepad.id);
 * 			}
 * 			const horizontal = gamepadManager.getAxisValue(gamepad.index, 0);
 * 			if (Math.abs(horizontal) > 0.2) {
 * 				console.log("move", horizontal);
 * 			}
 * 		}
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * const inputManager = engine.getInputManager();
 * const gamepadManager = inputManager.getGamepadManager();
 * gamepadManager.setCallback((gamepadIndex, inputType, inputIndex, value) => {
 * 	console.log(gamepadIndex, inputType, inputIndex, value);
 * });
 * engine.run(new MainScene());
 */
export class GamepadManager extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/**@private @type { number[] } */ #connectedGamepadIndices; // 연결된 게임패드 식별자(index) 목록.
	/**@private @type { Map<number, Object> } */ #connectedGamepadStates; // key: index, value: { buttons: Map, axes: Map }
	/**@private @type { Function | null } */ #inputEventCallback; // 입력 콜백 함수.
	/**@private @type { boolean } */ #isInputLogEnabled; // 단추와 축이 바뀔 때마다 콘솔에 찍는지.
	/**@private @type { string } */ #activeGamepadId; // 마지막 갱신에 단추를 누르거나 축을 크게 기울인 패드의 이름. (없으면 빈 글)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { Engine } engine 이 매니저를 가진 엔진. (쓰지 않는다)
	 */
	constructor(engine) {
		super();
		this.#connectedGamepadIndices = [];
		this.#connectedGamepadStates = new Map();
		this.#inputEventCallback = null;
		this.#isInputLogEnabled = false;
		this.#activeGamepadId = "";
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 */
	tick(timeDelta) {
		this.updateAllGamepads();
	}

	//==============================================================================
	// 게임패드 연결.
	//==============================================================================
	/**
	 * @param { Gamepad } gamepad 붙일 게임패드. (null 이거나 이미 붙은 번호면 아무것도 하지 않는다)
	 */
	connect(gamepad) {
		if (gamepad === null || gamepad === undefined || this.#connectedGamepadIndices.indexOf(gamepad.index) !== -1) {
			return;
		}

		const state = {
			buttons: new Map(), // key: index, value: { pressed: boolean, value: number }
			axes: new Map(),    // key: index, value: number
		};

		// 버튼 초기화. (previousPressed 는 지난 갱신의 눌림)
		for (let i = 0; i < gamepad.buttons.length; i++) {
			state.buttons.set(i, { pressed: false, value: 0, previousPressed: false });
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
	 * @param { Gamepad } gamepad 놓을 게임패드. (붙지 않은 번호면 아무것도 하지 않는다)
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
	 * @param { (gamepadIndex: number, inputType: "button" | "value" | "axis", inputIndex: number, value: any) => void } callback 단추나 축이 바뀔 때 부를 함수. (button 은 눌림 참 거짓, value 는 0 보다 큰 아날로그 값, axis 는 -1 ~ 1, null 이면 부르지 않는다)
	 */
	setCallback(callback) {
		this.#inputEventCallback = callback;
	}

	//==============================================================================
	// 모든 게임패드 갱신.
	//==============================================================================
	updateAllGamepads() {
		const gamepads = System.navigator.getGamepads();
		this.#activeGamepadId = "";
		const isInputLogEnabled = this.isInputLogEnabled();

		// 브라우저가 주고 있는데 아직 맞이하지 않은 패드를 여기서 붙인다.
		//
		// gamepadconnected 이벤트는 페이지가 뜬 뒤 그 패드를 처음 만질 때 한 번만 온다.
		// 그 순간을 놓치면(이벤트를 걸기 전에 눌렀거나, 다른 탭에서 눌렀거나, 페이지를 새로 고쳤거나)
		// 영영 붙지 않아 패드가 먹지 않는다. 매 갱신마다 훑어 보완한다.
		for (let index = 0; index < gamepads.length; ++index) {
			const gamepad = gamepads[index];
			if (gamepad === null || gamepad === undefined) {
				continue;
			}
			if (this.#connectedGamepadIndices.indexOf(gamepad.index) !== -1) {
				continue;
			}
			this.connect(gamepad);
		}

		// 뽑힌 패드를 놓아준다. disconnect 이벤트도 같은 이유로 놓칠 수 있다.
		for (let index = this.#connectedGamepadIndices.length - 1; index >= 0; --index) {
			const hardwareIndex = this.#connectedGamepadIndices[index];
			const gamepad = gamepads[hardwareIndex];
			if (gamepad !== null && gamepad !== undefined) {
				continue;
			}
			this.#connectedGamepadIndices.splice(index, 1);
			this.#connectedGamepadStates.delete(hardwareIndex);
		}

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
				lastButtonState.previousPressed = lastButtonState.pressed;

				// 눌림 상태 변화 감지.
				if (lastButtonState.pressed !== currentButton.pressed) {
					lastButtonState.pressed = currentButton.pressed;
					const text = (i === GamepadButtonCode.L2 || i === GamepadButtonCode.R2) ? "Trigger" : "Button";
					if (currentButton.pressed) {
						this.#activeGamepadId = gamepad.id;
					}
					
					// 로그 출력.
					if (isInputLogEnabled) {
						console.log(`[GamepadManager] Pad ${hardwareIndex} ${text} ${i} ${currentButton.pressed ? "Pressed" : "Released"}`);
					}
					
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
						const text = (i === GamepadButtonCode.L2 || i === GamepadButtonCode.R2) ? "Trigger" : "Button";
						
						// 로그 출력.
						if (isInputLogEnabled) {
							console.log(`[GamepadManager] Pad ${hardwareIndex} ${text} ${i} Value: ${currentValue}`);
						}
						
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
					const isLastAxisBeyond = System.Math.abs(lastAxisValue) >= GAMEPAD_ACTIVE_AXIS_THRESHOLD;
					const isCurrentAxisBeyond = System.Math.abs(currentAxisValue) >= GAMEPAD_ACTIVE_AXIS_THRESHOLD;
					if (isCurrentAxisBeyond && !isLastAxisBeyond) {
						this.#activeGamepadId = gamepad.id;
					}
					
					// 로그 출력.
					if (isInputLogEnabled) {
						console.log(`[GamepadManager] Pad ${hardwareIndex} Axis ${i} Value: ${currentAxisValue}`);
					}
					
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
	 * @param { number } gamepadIndex 패드 번호. (Gamepad.index)
	 * @param { number } buttonIndex 단추 번호. (W3C 표준 매핑, 0 이 A 나 크로스 단추)
	 * @returns { boolean } 눌려 있으면 참. (없는 패드나 단추면 거짓)
	 */
	isButtonPressed(gamepadIndex, buttonIndex) {
		const state = this.#connectedGamepadStates.get(gamepadIndex);
		if (!state) return false;
		const button = state.buttons.get(buttonIndex);
		return button ? button.pressed : false;
	}

	//==============================================================================
	// 이번 갱신에 방금 눌린 버튼인지. (키보드 isKeyJustPressed 와 같은 쓰임)
	//==============================================================================
	/**
	 * @param { number } gamepadIndex 패드 번호. (Gamepad.index)
	 * @param { number } buttonIndex 단추 번호. (W3C 표준 매핑, 0 이 A 나 크로스 단추)
	 * @returns { boolean } 이번 갱신에 눌렸으면 참.
	 */
	isButtonJustPressed(gamepadIndex, buttonIndex) {
		const state = this.#connectedGamepadStates.get(gamepadIndex);
		if (!state) {
			return false;
		}
		const button = state.buttons.get(buttonIndex);
		if (!button) {
			return false;
		}
		return button.pressed && !button.previousPressed;
	}

	//==============================================================================
	// 이번 갱신에 방금 떼어진 버튼인지.
	//==============================================================================
	/**
	 * @param { number } gamepadIndex 패드 번호. (Gamepad.index)
	 * @param { number } buttonIndex 단추 번호. (W3C 표준 매핑, 0 이 A 나 크로스 단추)
	 * @returns { boolean } 이번 갱신에 떼어졌으면 참.
	 */
	isButtonJustReleased(gamepadIndex, buttonIndex) {
		const state = this.#connectedGamepadStates.get(gamepadIndex);
		if (!state) {
			return false;
		}
		const button = state.buttons.get(buttonIndex);
		if (!button) {
			return false;
		}
		return !button.pressed && button.previousPressed;
	}

	//==============================================================================
	// 버튼/트리거 아날로그 값 반환 (0.0 ~ 1.0).
	//==============================================================================
	/**
	 * @param { number } gamepadIndex 패드 번호. (Gamepad.index)
	 * @param { number } buttonIndex 단추 번호. (W3C 표준 매핑, 0 이 A 나 크로스 단추)
	 * @returns { number } 아날로그 값. (0 ~ 1, 소수 둘째 자리까지, 없으면 0)
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
	 * @param { number } gamepadIndex 패드 번호. (Gamepad.index)
	 * @param { number } axisIndex 축 번호. (0 왼쪽 가로, 1 왼쪽 세로, 2 오른쪽 가로, 3 오른쪽 세로)
	 * @returns { number } 축 값. (-1 ~ 1, 소수 둘째 자리까지, 없으면 0)
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
	 * @returns { Gamepad[] } 연결된 게임패드 목록. (브라우저의 지금 Gamepad)
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
	 * @returns { number } 연결된 게임패드 수.
	 */
	getConnectedGamepadCount() {
		return this.#connectedGamepadIndices.length;
	}

	//==============================================================================
	// 연결된 게임패드 반환.
	//==============================================================================
	/**
	 * @param { number } gamepadIndex 연결된 차례의 번호. (0 ~ 연결 수 - 1, Gamepad.index 가 아니다)
	 * @returns { Gamepad | undefined } 그 차례의 게임패드. (범위 밖이면 undefined)
	 */
	getConnectedGamepad(gamepadIndex) {
		if (gamepadIndex < 0 || gamepadIndex >= this.#connectedGamepadIndices.length) {
			return undefined;
		}

		const hardwareIndex = this.#connectedGamepadIndices.at(gamepadIndex);
		const gamepads = System.navigator.getGamepads();
		return gamepads[hardwareIndex];
	}

	//==============================================================================
	// 단추와 축이 바뀔 때마다 콘솔에 찍을지 설정. (기본은 끔, 연결과 해제는 늘 찍는다)
	//==============================================================================
	/**
	 * @param { boolean } isEnabled 참이면 콘솔에 찍는다.
	 */
	setInputLogEnabled(isEnabled) {
		this.#isInputLogEnabled = isEnabled;
	}

	//==============================================================================
	// 단추와 축이 바뀔 때마다 콘솔에 찍는지 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 콘솔에 찍으면 참.
	 */
	isInputLogEnabled() {
		return this.#isInputLogEnabled;
	}

	//==============================================================================
	// 마지막 갱신에 단추를 누르거나 축을 크게 기울인 패드의 이름 반환. (없으면 빈 글, 마지막으로 쓴 장치를 가릴 때)
	//==============================================================================
	/**
	 * @returns { string } 패드 이름. (Gamepad.id, 없으면 빈 글)
	 */
	getActiveGamepadId() {
		return this.#activeGamepadId;
	}

	//==============================================================================
	// 연결된 패드를 모두 떨기. (세기는 0 ~ 1, 브라우저 Gamepad.vibrationActuator 의 dual-rumble)
	// - 진동 장치가 없는 패드와 브라우저(사파리 등)는 건너뛴다.
	// - 앞의 진동이 끝나기 전에 다시 부르면 새 진동으로 바뀐다. (브라우저가 앞 약속을 거절하는 것은 흘린다)
	//==============================================================================
	/**
	 * @param { number } strongMagnitude 무거운 모터의 세기. (묵직한 울림)
	 * @param { number } weakMagnitude 가벼운 모터의 세기. (잘게 떨림)
	 * @param { number } seconds 떠는 시간. (초)
	 * @example <caption>연결된 패드를 0.25 초 떨기</caption>
	 * import { Engine, EngineConfiguration } from "./build/vanilla.js";
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * const engine = new Engine(engineConfiguration);
	 * const inputManager = engine.getInputManager();
	 * const gamepadManager = inputManager.getGamepadManager();
	 * gamepadManager.vibrate(1, 0.3, 0.25);
	 * const connectedGamepadCount = gamepadManager.getConnectedGamepadCount();
	 * console.log(connectedGamepadCount);
	 */
	vibrate(strongMagnitude, weakMagnitude, seconds) {
		if (typeof System.navigator.getGamepads !== "function") {
			return;
		}
		const durationMilliseconds = System.Math.max(0, System.Math.round(seconds * 1000));
		const clampedStrongMagnitude = System.Math.min(1, System.Math.max(0, strongMagnitude));
		const clampedWeakMagnitude = System.Math.min(1, System.Math.max(0, weakMagnitude));
		const gamepads = System.navigator.getGamepads();
		for (const hardwareIndex of this.#connectedGamepadIndices) {
			const gamepad = gamepads[hardwareIndex];
			if (gamepad === null || gamepad === undefined) {
				continue;
			}
			const vibrationActuator = gamepad.vibrationActuator;
			if (vibrationActuator === null || vibrationActuator === undefined || typeof vibrationActuator.playEffect !== "function") {
				continue;
			}
			const effectParameters = { duration: durationMilliseconds, strongMagnitude: clampedStrongMagnitude, weakMagnitude: clampedWeakMagnitude };
			const effectPromise = vibrationActuator.playEffect("dual-rumble", effectParameters);
			effectPromise.catch(() => {
			});
		}
	}
}