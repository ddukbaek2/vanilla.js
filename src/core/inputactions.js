//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { GamepadAnalogStickCode } from "./gamepadmanager.js";
import { InputDevice } from "./inputmanager.js";


// 스틱과 축의 가운데 떨림을 거르는 길이의 처음 값. (이보다 덜 기울면 0)
const DEFAULT_DEAD_ZONE = 0.2;
// 축에 묶은 동작을 눌린 것으로 보는 기울기의 처음 값. (죽은 구역을 빼기 전 값)
const DEFAULT_AXIS_PRESS_THRESHOLD = 0.5;
// 바깥 입력원의 동작 값을 눌린 것으로 보는 값.
const SOURCE_PRESS_THRESHOLD = 0.5;
// 이동 축의 키. (KeyboardEvent.code, 자판 배열과 상관없이 같은 자리)
const MOVE_LEFT_KEYS = ["KeyA", "ArrowLeft"];
const MOVE_RIGHT_KEYS = ["KeyD", "ArrowRight"];
const MOVE_UP_KEYS = ["KeyW", "ArrowUp"];
const MOVE_DOWN_KEYS = ["KeyS", "ArrowDown"];


//==============================================================================
// 입력 동작.
// - 동작 이름("confirm", "left" 같은 게임이 정한 글)에 키, 게임패드 단추, 게임패드 축의 한쪽을 묶는다. 한 동작에 여럿을 묶을 수 있고, 하나라도 눌렸으면 눌린 것이다.
// - 엔진의 InputManager 가 하나 들고(getInputActions) 프레임 첫머리의 tick 에서 update 를 부른다. 게임은 읽기만 한다.
// - 키는 프레임 사이에 눌렀다 뗀 것도 그 프레임에 한 번 눌린 것으로 본다. (InputManager.isKeyJustPressed)
// - setRepeat 를 건 동작은 누르고 있으면 기다린 뒤부터 간격마다 isJustPressed 가 다시 참이 된다. (메뉴 고르기)
// - 축은 죽은 구역(setDeadZone)을 빼고 나머지를 0 ~ 1 로 다시 편다. 스틱은 길이로, 묶은 축은 한쪽 값으로 거른다.
// - 바깥 입력원(addSource)은 엔진이 모르는 입력(플랫폼 SDK 의 패드 같은 것)을 게임이 끼우는 자리다. 아래 함수를 가진 객체다.
//     readActionValue(action) → 0 ~ 1 의 수 또는 참거짓. (0.5 이상이면 눌림)
//     readMoveAxis() → { x, y } 또는 null. (없어도 된다, readMoveAxis 에 합친다)
//     readGamepadKind() → GamepadKind 의 값. (없어도 된다, 이 입력원이 입력을 넣은 프레임에 마지막 장치를 게임패드와 그 종류로 적는다)
// - 글자 입력칸에 쓰는 동안은 키를 듣지 않는다. (setKeysIgnoredWhileTyping 으로 끈다)
//==============================================================================
/**
 * @example <caption>동작에 키, 단추, 축 묶고 읽기</caption>
 * import { Engine, EngineConfiguration, Scene } from "./build/vanilla.js";
 *
 * class MainScene extends Scene {
 * 	initialize(engine) {
 * 		const inputManager = engine.getInputManager();
 * 		const inputActions = inputManager.getInputActions();
 * 		inputActions.bindKey("confirm", "Enter");
 * 		inputActions.bindKey("confirm", "Space");
 * 		inputActions.bindGamepadButton("confirm", 0);
 * 		inputActions.bindKey("down", "ArrowDown");
 * 		inputActions.bindAxis("down", 1, 1);
 * 		inputActions.setRepeat("down", 0.4, 0.1);
 * 	}
 *
 * 	tick(timeDelta) {
 * 		super.tick(timeDelta);
 * 		const engine = this.getEngine();
 * 		const inputManager = engine.getInputManager();
 * 		const inputActions = inputManager.getInputActions();
 * 		if (inputActions.isJustPressed("confirm")) {
 * 			console.log("confirm");
 * 		}
 * 		if (inputActions.isJustPressed("down")) {
 * 			console.log("next item");
 * 		}
 * 		const moveAxis = inputActions.readMoveAxis();
 * 		if (moveAxis.x !== 0 || moveAxis.y !== 0) {
 * 			console.log(moveAxis.x, moveAxis.y);
 * 		}
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
export class InputActions extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Map<string, string[]> } */ #keyBindings; // 동작마다 묶은 키.
	/** @private @type { Map<string, number[]> } */ #gamepadButtonBindings; // 동작마다 묶은 게임패드 단추. (GamepadButtonCode)
	/** @private @type { Map<string, { axisIndex: number, direction: number }[]> } */ #axisBindings; // 동작마다 묶은 게임패드 축의 한쪽.
	/** @private @type { Map<string, { delaySeconds: number, intervalSeconds: number }> } */ #repeats; // 동작마다 누르고 있을 때의 반복.
	/** @private @type { Map<string, object> } */ #states; // 동작마다 이번 프레임의 상태. { isPressed, wasPressed, value, repeatSeconds, isRepeatFired }
	/** @private @type { object[] } */ #sources; // 바깥 입력원.
	/** @private @type { number } */ #deadZone;
	/** @private @type { number } */ #axisPressThreshold;
	/** @private @type { boolean } */ #isKeysIgnoredWhileTyping;
	/** @private @type { boolean } */ #isTyping; // 이번 프레임에 글자 입력칸에 쓰는 중인지.
	/** @private @type { object | null } */ #inputManager; // 마지막 update 에 받은 입력 매니저.
	/** @private @type { Vector2 } */ #sourceMoveAxis; // 이번 프레임에 바깥 입력원이 준 이동 축 가운데 가장 긴 것.

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.#keyBindings = new System.Map();
		this.#gamepadButtonBindings = new System.Map();
		this.#axisBindings = new System.Map();
		this.#repeats = new System.Map();
		this.#states = new System.Map();
		this.#sources = [];
		this.#deadZone = DEFAULT_DEAD_ZONE;
		this.#axisPressThreshold = DEFAULT_AXIS_PRESS_THRESHOLD;
		this.#isKeysIgnoredWhileTyping = true;
		this.#isTyping = false;
		this.#inputManager = null;
		this.#sourceMoveAxis = Vector2.zero();
	}

	//==============================================================================
	// 동작의 상태 칸 반환. (없으면 만든다)
	//==============================================================================
	/**
	 * @param { string } action 동작 이름. (게임이 정한 글)
	 * @returns { object } 동작의 상태. { isPressed, wasPressed, value, repeatSeconds, isRepeatFired }
	 */
	createActionState(action) {
		let state = this.#states.get(action);
		if (state === undefined) {
			state = { isPressed: false, wasPressed: false, value: 0, repeatSeconds: 0, isRepeatFired: false };
			this.#states.set(action, state);
		}
		return state;
	}

	//==============================================================================
	// 키 묶기. (KeyboardEvent.code, KeyCode 의 값)
	//==============================================================================
	/**
	 * @param { string } action 동작 이름. (게임이 정한 글)
	 * @param { string } key 묶을 키 코드. (KeyboardEvent.code, 같은 키는 한 번만)
	 */
	bindKey(action, key) {
		this.createActionState(action);
		const keys = this.#keyBindings.get(action) || [];
		if (!keys.includes(key)) {
			keys.push(key);
		}
		this.#keyBindings.set(action, keys);
	}

	//==============================================================================
	// 게임패드 단추 묶기. (GamepadButtonCode, 연결된 패드 모두)
	//==============================================================================
	/**
	 * @param { string } action 동작 이름. (게임이 정한 글)
	 * @param { number } buttonCode 묶을 단추 번호. (W3C 표준 매핑, 0 이 A 나 크로스 단추)
	 */
	bindGamepadButton(action, buttonCode) {
		this.createActionState(action);
		const buttonCodes = this.#gamepadButtonBindings.get(action) || [];
		if (!buttonCodes.includes(buttonCode)) {
			buttonCodes.push(buttonCode);
		}
		this.#gamepadButtonBindings.set(action, buttonCodes);
	}

	//==============================================================================
	// 게임패드 축의 한쪽 묶기. (GamepadAnalogStickCode, direction 이 1 이면 + 쪽, -1 이면 - 쪽, 축 Y 는 아래가 +)
	// - 그쪽으로 setAxisPressThreshold 만큼 기울면 눌린 것이고, 값(readValue)은 죽은 구역을 뺀 기울기다.
	//==============================================================================
	/**
	 * @param { string } action 동작 이름. (게임이 정한 글)
	 * @param { number } axisIndex 축 번호. (0 왼쪽 가로, 1 왼쪽 세로, 2 오른쪽 가로, 3 오른쪽 세로)
	 * @param { number } direction 묶을 쪽. (0 이상이면 + 쪽, 음수면 - 쪽)
	 */
	bindAxis(action, axisIndex, direction) {
		this.createActionState(action);
		const axisBindingList = this.#axisBindings.get(action) || [];
		const axisDirection = direction < 0 ? -1 : 1;
		for (const axisBinding of axisBindingList) {
			if (axisBinding.axisIndex === axisIndex && axisBinding.direction === axisDirection) {
				return;
			}
		}
		axisBindingList.push({ axisIndex: axisIndex, direction: axisDirection });
		this.#axisBindings.set(action, axisBindingList);
	}

	//==============================================================================
	// 동작에 묶은 것 모두 풀기. (키 바꾸기 화면에서 다시 묶기 전에, 반복 설정은 남는다)
	//==============================================================================
	/**
	 * @param { string } action 동작 이름. (게임이 정한 글)
	 */
	unbindAction(action) {
		this.#keyBindings.delete(action);
		this.#gamepadButtonBindings.delete(action);
		this.#axisBindings.delete(action);
	}

	//==============================================================================
	// 동작에 묶은 키 목록 반환. (사본, 단추 안내를 그릴 때)
	//==============================================================================
	/**
	 * @param { string } action 동작 이름. (게임이 정한 글)
	 * @returns { string[] } 묶은 키 코드 목록의 사본. (없으면 빈 배열)
	 */
	getBoundKeys(action) {
		const keys = this.#keyBindings.get(action) || [];
		return keys.slice();
	}

	//==============================================================================
	// 누르고 있으면 반복 설정. (기다리는 초 뒤부터 간격 초마다 isJustPressed 가 참, 간격이 0 이하면 반복을 끈다)
	//==============================================================================
	/**
	 * @param { string } action 동작 이름. (게임이 정한 글)
	 * @param { number } delaySeconds 첫 반복까지 기다리는 시간. (초, 음수는 0)
	 * @param { number } intervalSeconds 반복 간격. (초, 0 이하면 반복을 끈다)
	 */
	setRepeat(action, delaySeconds, intervalSeconds) {
		this.createActionState(action);
		if (intervalSeconds <= 0) {
			this.#repeats.delete(action);
			return;
		}
		this.#repeats.set(action, { delaySeconds: System.Math.max(0, delaySeconds), intervalSeconds: intervalSeconds });
	}

	//==============================================================================
	// 죽은 구역 설정. (0 ~ 1 미만, 처음은 0.2)
	//==============================================================================
	/**
	 * @param { number } deadZone 죽은 구역. (0 ~ 0.99 로 자른다)
	 */
	setDeadZone(deadZone) {
		this.#deadZone = System.Math.min(0.99, System.Math.max(0, deadZone));
	}

	//==============================================================================
	// 죽은 구역 반환.
	//==============================================================================
	/**
	 * @returns { number } 죽은 구역. (0 ~ 0.99)
	 */
	getDeadZone() {
		return this.#deadZone;
	}

	//==============================================================================
	// 축에 묶은 동작을 눌린 것으로 보는 기울기 설정. (0 ~ 1, 처음은 0.5)
	//==============================================================================
	/**
	 * @param { number } axisPressThreshold 눌린 것으로 보는 기울기. (0 ~ 1 로 자른다)
	 */
	setAxisPressThreshold(axisPressThreshold) {
		this.#axisPressThreshold = System.Math.min(1, System.Math.max(0, axisPressThreshold));
	}

	//==============================================================================
	// 축에 묶은 동작을 눌린 것으로 보는 기울기 반환.
	//==============================================================================
	/**
	 * @returns { number } 눌린 것으로 보는 기울기. (0 ~ 1)
	 */
	getAxisPressThreshold() {
		return this.#axisPressThreshold;
	}

	//==============================================================================
	// 글자 입력칸에 쓰는 동안 키를 듣지 않을지 설정. (처음은 참)
	//==============================================================================
	/**
	 * @param { boolean } isIgnored 참이면 글자 입력칸에 쓰는 동안 키를 듣지 않는다.
	 */
	setKeysIgnoredWhileTyping(isIgnored) {
		this.#isKeysIgnoredWhileTyping = isIgnored;
	}

	//==============================================================================
	// 글자 입력칸에 쓰는 동안 키를 듣지 않는지 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 글자 입력칸에 쓰는 동안 키를 듣지 않으면 참.
	 */
	isKeysIgnoredWhileTyping() {
		return this.#isKeysIgnoredWhileTyping;
	}

	//==============================================================================
	// 바깥 입력원 더하기. (이미 있으면 그대로)
	//==============================================================================
	/**
	 * @param { object } source { readActionValue(action), readMoveAxis(), readGamepadKind() }
	 * @example <caption>바깥 입력원 끼우기</caption>
	 * import { Engine, EngineConfiguration, GamepadKind } from "./build/vanilla.js";
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * const engine = new Engine(engineConfiguration);
	 * const inputManager = engine.getInputManager();
	 * const inputActions = inputManager.getInputActions();
	 * inputActions.bindKey("confirm", "Enter");
	 * const platformSource = {
	 * 	readActionValue(action) {
	 * 		if (action === "confirm") {
	 * 			return 1;
	 * 		}
	 * 		return 0;
	 * 	},
	 * 	readMoveAxis() {
	 * 		return { x: 0.5, y: 0 };
	 * 	},
	 * 	readGamepadKind() {
	 * 		return GamepadKind.xbox;
	 * 	},
	 * };
	 * inputActions.addSource(platformSource);
	 * inputActions.update(inputManager, 0);
	 * const moveAxis = inputActions.readMoveAxis();
	 * const isConfirmPressed = inputActions.isPressed("confirm");
	 * const lastInputDevice = inputManager.getLastInputDevice();
	 * console.log(isConfirmPressed, moveAxis.x, lastInputDevice);
	 * inputActions.removeSource(platformSource);
	 */
	addSource(source) {
		if (source === null || source === undefined || this.#sources.includes(source)) {
			return;
		}
		this.#sources.push(source);
	}

	//==============================================================================
	// 바깥 입력원 빼기.
	//==============================================================================
	/**
	 * @param { object } source 더했던 입력원. (없으면 아무것도 하지 않는다)
	 */
	removeSource(source) {
		const sourceIndex = this.#sources.indexOf(source);
		if (sourceIndex !== -1) {
			this.#sources.splice(sourceIndex, 1);
		}
	}

	//==============================================================================
	// 프레임마다 갱신. (InputManager.tick 이 부른다)
	//==============================================================================
	/**
	 * @param { object } inputManager InputManager
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 */
	update(inputManager, timeDelta) {
		this.#inputManager = inputManager;
		const isTypingInTextField = inputManager.isTypingInTextField();
		this.#isTyping = this.#isKeysIgnoredWhileTyping && isTypingInTextField;
		const gamepadManager = inputManager.getGamepadManager();
		const gamepads = gamepadManager.getAllConnectedGamepads();
		let sourceGamepadKind = "";

		for (const [action, state] of this.#states) {
			let isPressed = false;
			let value = 0;

			// 키. (프레임 사이에 눌렀다 뗀 것도 이번 프레임에 눌린 것으로)
			if (!this.#isTyping) {
				const keys = this.#keyBindings.get(action) || [];
				for (const key of keys) {
					const isKeyPressed = inputManager.isKeyPressed(key);
					const isKeyJustPressed = inputManager.isKeyJustPressed(key);
					if (isKeyPressed || isKeyJustPressed) {
						isPressed = true;
						value = 1;
						break;
					}
				}
			}

			// 게임패드 단추와 축. (연결된 패드 모두)
			const buttonCodes = this.#gamepadButtonBindings.get(action) || [];
			const axisBindingList = this.#axisBindings.get(action) || [];
			for (const gamepad of gamepads) {
				const gamepadIndex = gamepad.index;
				for (const buttonCode of buttonCodes) {
					const isButtonPressed = gamepadManager.isButtonPressed(gamepadIndex, buttonCode);
					if (!isButtonPressed) {
						continue;
					}
					isPressed = true;
					const buttonValue = gamepadManager.getButtonValue(gamepadIndex, buttonCode);
					value = System.Math.max(value, buttonValue > 0 ? buttonValue : 1);
				}
				for (const axisBinding of axisBindingList) {
					const axisValue = gamepadManager.getAxisValue(gamepadIndex, axisBinding.axisIndex);
					const directedValue = axisValue * axisBinding.direction;
					if (directedValue >= this.#axisPressThreshold && directedValue > 0) {
						isPressed = true;
					}
					const scaledValue = this.applyDeadZone(directedValue);
					value = System.Math.max(value, scaledValue);
				}
			}

			// 바깥 입력원.
			for (const source of this.#sources) {
				if (typeof source.readActionValue !== "function") {
					continue;
				}
				const sourceValue = source.readActionValue(action);
				const numberValue = sourceValue === true ? 1 : (typeof sourceValue === "number" && System.Number.isFinite(sourceValue) ? System.Math.min(1, System.Math.max(0, sourceValue)) : 0);
				if (numberValue <= 0) {
					continue;
				}
				value = System.Math.max(value, numberValue);
				if (numberValue >= SOURCE_PRESS_THRESHOLD) {
					isPressed = true;
					if (typeof source.readGamepadKind === "function") {
						sourceGamepadKind = source.readGamepadKind();
					}
				}
			}

			// 상태와 반복.
			state.wasPressed = state.isPressed;
			state.isPressed = isPressed;
			state.value = value;
			state.isRepeatFired = false;
			const repeat = this.#repeats.get(action);
			if (isPressed && !state.wasPressed) {
				state.repeatSeconds = repeat !== undefined ? repeat.delaySeconds : 0;
			}
			else if (isPressed && repeat !== undefined) {
				state.repeatSeconds -= timeDelta;
				if (state.repeatSeconds <= 0) {
					state.isRepeatFired = true;
					state.repeatSeconds += repeat.intervalSeconds;
					// 프레임이 길게 끊겼으면 몰아서 반복하지 않고 한 간격을 다시 기다린다.
					if (state.repeatSeconds <= 0) {
						state.repeatSeconds = repeat.intervalSeconds;
					}
				}
			}
		}

		// 바깥 입력원의 이동 축.
		let sourceMoveAxis = Vector2.zero();
		for (const source of this.#sources) {
			if (typeof source.readMoveAxis !== "function") {
				continue;
			}
			const moveAxis = source.readMoveAxis();
			if (moveAxis === null || moveAxis === undefined) {
				continue;
			}
			const clampedMoveAxis = this.clampLength(moveAxis.x, moveAxis.y);
			const clampedLength = System.Math.hypot(clampedMoveAxis.x, clampedMoveAxis.y);
			const currentLength = System.Math.hypot(sourceMoveAxis.x, sourceMoveAxis.y);
			if (clampedLength > currentLength) {
				sourceMoveAxis = clampedMoveAxis;
			}
			if (clampedLength > this.#deadZone && typeof source.readGamepadKind === "function") {
				sourceGamepadKind = source.readGamepadKind();
			}
		}
		this.#sourceMoveAxis = sourceMoveAxis;

		// 바깥 입력원이 입력을 넣었으면 마지막 장치는 그 패드다.
		if (typeof sourceGamepadKind === "string" && sourceGamepadKind !== "") {
			inputManager.setLastInputDevice(InputDevice.gamepad);
			inputManager.setLastGamepadKind(sourceGamepadKind);
		}
	}

	//==============================================================================
	// 모두 뗀 것으로 되돌리기. (창이 포커스를 잃었을 때, 뗌도 알리지 않는다)
	//==============================================================================
	clear() {
		for (const state of this.#states.values()) {
			state.isPressed = false;
			state.wasPressed = false;
			state.value = 0;
			state.repeatSeconds = 0;
			state.isRepeatFired = false;
		}
		this.#sourceMoveAxis = Vector2.zero();
	}

	//==============================================================================
	// 동작이 눌려 있는지.
	//==============================================================================
	/**
	 * @param { string } action 동작 이름. (게임이 정한 글)
	 * @returns { boolean } 눌려 있으면 참. (없는 동작이면 거짓)
	 */
	isPressed(action) {
		const state = this.#states.get(action);
		return state !== undefined && state.isPressed;
	}

	//==============================================================================
	// 이번 프레임에 눌렸는지. (setRepeat 를 건 동작은 반복 때도 참)
	//==============================================================================
	/**
	 * @param { string } action 동작 이름. (게임이 정한 글)
	 * @returns { boolean } 이번 프레임에 눌렸거나 반복이 왔으면 참.
	 */
	isJustPressed(action) {
		const state = this.#states.get(action);
		if (state === undefined) {
			return false;
		}
		return (state.isPressed && !state.wasPressed) || state.isRepeatFired;
	}

	//==============================================================================
	// 이번 프레임에 떼어졌는지.
	//==============================================================================
	/**
	 * @param { string } action 동작 이름. (게임이 정한 글)
	 * @returns { boolean } 이번 프레임에 떼어졌으면 참.
	 */
	isJustReleased(action) {
		const state = this.#states.get(action);
		return state !== undefined && !state.isPressed && state.wasPressed;
	}

	//==============================================================================
	// 동작의 값. (0 ~ 1, 키와 디지털 단추는 1, 트리거와 축은 기운 만큼)
	//==============================================================================
	/**
	 * @param { string } action 동작 이름. (게임이 정한 글)
	 * @returns { number } 동작의 값. (0 ~ 1, 없는 동작이면 0)
	 */
	readValue(action) {
		const state = this.#states.get(action);
		return state !== undefined ? state.value : 0;
	}

	//==============================================================================
	// 두 동작으로 만든 축. (-1 ~ 1, 양쪽 동작의 값의 차)
	//==============================================================================
	/**
	 * @param { string } negativeAction 음수 쪽 동작 이름. (값을 뺀다)
	 * @param { string } positiveAction 양수 쪽 동작 이름. (값을 더한다)
	 * @returns { number } 양수 쪽 값에서 음수 쪽 값을 뺀 축 값. (-1 ~ 1)
	 */
	readAxis(negativeAction, positiveAction) {
		const negativeValue = this.readValue(negativeAction);
		const positiveValue = this.readValue(positiveAction);
		return positiveValue - negativeValue;
	}

	//==============================================================================
	// 게임패드 스틱. (연결된 패드 가운데 가장 크게 기운 것, 죽은 구역을 길이로 빼고 길이 1 이하, 오른쪽 +x 아래 +y)
	//==============================================================================
	/**
	 * @param { number } xAxisIndex GamepadAnalogStickCode
	 * @param { number } yAxisIndex GamepadAnalogStickCode
	 * @returns { Vector2 } 스틱 벡터. (길이 0 ~ 1, 오른쪽 +x 아래 +y, update 전이면 (0, 0))
	 */
	readGamepadStick(xAxisIndex, yAxisIndex) {
		const inputManager = this.#inputManager;
		let stickVector = Vector2.zero();
		if (inputManager === null) {
			return stickVector;
		}
		const gamepadManager = inputManager.getGamepadManager();
		const gamepads = gamepadManager.getAllConnectedGamepads();
		for (const gamepad of gamepads) {
			const gamepadIndex = gamepad.index;
			const axisX = gamepadManager.getAxisValue(gamepadIndex, xAxisIndex);
			const axisY = gamepadManager.getAxisValue(gamepadIndex, yAxisIndex);
			const length = System.Math.hypot(axisX, axisY);
			const scaledLength = this.applyDeadZone(length);
			const currentLength = System.Math.hypot(stickVector.x, stickVector.y);
			if (scaledLength > currentLength) {
				stickVector = Vector2.create(axisX / length * scaledLength, axisY / length * scaledLength);
			}
		}
		return stickVector;
	}

	//==============================================================================
	// 이동 축. (WASD 와 방향키, 왼쪽 스틱, 바깥 입력원의 이동 축 가운데 가장 긴 것, 길이 1 이하, 오른쪽 +x 아래 +y)
	// - 키는 대각선도 길이 1 이다. 글자 입력칸에 쓰는 동안은 키를 듣지 않는다.
	//==============================================================================
	/**
	 * @returns { Vector2 } 이동 벡터. (길이 0 ~ 1, 오른쪽 +x 아래 +y, update 전이면 (0, 0))
	 */
	readMoveAxis() {
		const inputManager = this.#inputManager;
		if (inputManager === null) {
			return Vector2.zero();
		}
		let moveVector = Vector2.zero();
		if (!this.#isTyping) {
			const isAnyKeyPressed = (keys) => {
				for (const key of keys) {
					if (inputManager.isKeyPressed(key)) {
						return true;
					}
				}
				return false;
			};
			const directionX = (isAnyKeyPressed(MOVE_RIGHT_KEYS) ? 1 : 0) - (isAnyKeyPressed(MOVE_LEFT_KEYS) ? 1 : 0);
			const directionY = (isAnyKeyPressed(MOVE_DOWN_KEYS) ? 1 : 0) - (isAnyKeyPressed(MOVE_UP_KEYS) ? 1 : 0);
			const keyLength = System.Math.hypot(directionX, directionY);
			if (keyLength > 0) {
				moveVector = Vector2.create(directionX / keyLength, directionY / keyLength);
			}
		}
		const stickVector = this.readGamepadStick(GamepadAnalogStickCode.LEFT_X, GamepadAnalogStickCode.LEFT_Y);
		const candidateVectors = [stickVector, this.#sourceMoveAxis];
		for (const candidateVector of candidateVectors) {
			const candidateLength = System.Math.hypot(candidateVector.x, candidateVector.y);
			const currentLength = System.Math.hypot(moveVector.x, moveVector.y);
			if (candidateLength > currentLength) {
				moveVector = Vector2.create(candidateVector.x, candidateVector.y);
			}
		}
		return moveVector;
	}

	//==============================================================================
	// 죽은 구역 빼기. (죽은 구역 이하면 0, 나머지를 0 ~ 1 로 다시 펴서 조금 기울였을 때 튀지 않게)
	//==============================================================================
	/**
	 * @param { number } value 거를 값. (0 이상의 길이나 한쪽 기울기)
	 * @returns { number } 죽은 구역을 뺀 값. (0 ~ 1)
	 */
	applyDeadZone(value) {
		if (!System.Number.isFinite(value) || value <= this.#deadZone) {
			return 0;
		}
		const clampedValue = System.Math.min(1, value);
		return (clampedValue - this.#deadZone) / (1 - this.#deadZone);
	}

	//==============================================================================
	// 길이 1 로 자르기.
	//==============================================================================
	/**
	 * @param { number } x X 성분. (유한한 수가 아니면 0)
	 * @param { number } y Y 성분. (유한한 수가 아니면 0)
	 * @returns { Vector2 } 길이가 1 이하인 새 벡터.
	 */
	clampLength(x, y) {
		const vectorX = System.Number.isFinite(x) ? x : 0;
		const vectorY = System.Number.isFinite(y) ? y : 0;
		const length = System.Math.hypot(vectorX, vectorY);
		if (length <= 1) {
			return Vector2.create(vectorX, vectorY);
		}
		return Vector2.create(vectorX / length, vectorY / length);
	}
}
