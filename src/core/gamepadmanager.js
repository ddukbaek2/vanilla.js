//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Engine } from "./engine.js";


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
export class GamepadManager extends Object {
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    /**@private @type { Gamepad[] } */ #connectedGamepads; // 연결된 게임패드 목록.
    /**@private @type { Map } */ #conntectedGamepadButtonStates; // key: Gamepad.id, Value: { Key: GamepadButton.index, Value: boolean }

    //==============================================================================
    // 생성.
    //==============================================================================
    /**
     * @constructor
     * @param { Engine } engine 
     */
    constructor(engine) {
        super();
        this.#connectedGamepads = [];
        this.#conntectedGamepadButtonStates = new Map();
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
        // const gamepads = System.navigator.getGamepads();
        // for (let gamepadIndex = 0; gamepadIndex < gamepads.length; ++gamepadIndex) {
        // 	const gamepad = gamepads[gamepadIndex];
        // 	if (gamepad === null) {
        // 		continue;
        // 	}

        // 	for (let buttonIndex = 0; buttonIndex < gamepad.buttons.length; ++buttonIndex) {
        // 		const button = gamepad.buttons[buttonIndex];
        // 		if (button === null) {
        // 			continue;
        // 		}

        // 		if (button.pressed) {
        // 			console.log(`[${gamepadIndex}][${buttonIndex}] pressed`);
        // 		}
        // 	}

        // 	// // 0~3
        // 	// for (let axisIndex = 0; axisIndex < gamepad.axes.length; ++axisIndex) {
        // 	// 	const axis = gamepad.axes[axisIndex];
        // 	// 	if (axis === null) {
        // 	// 		continue;
        // 	// 	}

        // 	// 	console.log(`[${gamepadIndex}][${axisIndex}] axis: ${axis}`);
        // 	// }
        // }

        const connectedGamepads = this.getAllConnectedGamepads();
        for (const gamepad of connectedGamepads) {
            if (gamepad === null) {
                continue;
            }

            // gamepad.id
            // gamepad.index
            // gamepad.mapping
            // gamepad.connected
            // gamepad.timestamp
            // gamepad.vibrationActuator
            // gamepad.buttons
            // gamepad.axes

            const gamepadId = gamepad.id;
            const buttonStates = this.#conntectedGamepadButtonStates.get(gamepadId);
            if (buttonStates.length == 0) {
                continue;
            }

            for (const [buttonIndex, buttonState] of buttonStates) {
                const button = gamepad.buttons[buttonIndex];
                if (!button) {
                    continue;
                }

                if (buttonState !== button.pressed) {
                    buttonStates.set(buttonIndex, button.pressed);
                    console.log(`[GamepadManager] ${gamepadId}: buttonIndex: ${buttonIndex}, pressed: ${button.pressed}`);
                }
            }
        }
    }

    // //==============================================================================
    // // 연결된 게임패드 갯수 반환.
    // //==============================================================================
    // /**
    //  * @returns { number }
    //  */
    // getGamepadCount() {
    // 	const gamepads = System.navigator.getGamepads();
    // 	return gamepads.length;
    // }

    // //==============================================================================
    // // 게임패드 반환.
    // //==============================================================================
    // /**
    //  * @param { number } gamepadIndex
    //  * @returns { Gamepad }
    //  */
    // getGamepad(gamepadIndex) {
    // 	const gamepads = System.navigator.getGamepads();
    // 	if (gamepads === null) {
    // 		return null;
    // 	}
    // 	else if (gamepadIndex < 0 || gamepadIndex >= gamepads.length) {
    // 		return null;
    // 	}

    // 	// Gamepad
    // 	const gamepad = gamepads.at(gamepadIndex);
    // 	// gamepad.id // string
    // 	// gamepad.connected // boolean
    // 	// gamepad.index // number
    // 	// gamepad.mapping // GamepadMappingType
    // 	// gamepad.timestamp // DOMHighResTimeStamp
    // 	// gamepad.vibrationActuator // GamepadHapticActuator
    // 	return gamepad;
    // }

    // //==============================================================================
    // // 게임패드 버튼 눌림 상태 반환.
    // //==============================================================================
    // /**
    //  * @param { number } gamepadIndex 
    //  * @param { number } buttonIndex 
    //  * @returns { boolean }
    //  */
    // isGamepadButtonPressed(gamepadIndex, buttonIndex) {
    // 	const gamepad = this.getGamepad(gamepadIndex);
    // 	if (gamepad === null || buttonIndex < 0 || buttonIndex >= gamepad.buttons.length) {
    // 		return false;
    // 	}

    // 	// GamepadButton[]
    // 	const button = gamepad.buttons[buttonIndex];
    // 	if (button === null) {
    // 		return false;
    // 	}

    // 	return button.pressed;
    // }

    // //==============================================================================
    // // 게임패드 아날로그 스틱 축 값 반환. (-1.0 ~ 1.0)
    // //==============================================================================
    // /**
    //  * @param { number } gamepadIndex 
    //  * @param { number } axisIndex 
    //  * @returns { number }
    //  */
    // getGamepadAxis(gamepadIndex, axisIndex) {
    // 	const gamepad = this.getGamepad(gamepadIndex);
    // 	if (gamepad === null || axisIndex < 0 || axisIndex >= gamepad.axes.length) {
    // 		return false;
    // 	}

    // 	const axis = gamepad.axes[axisIndex];
    // 	if (axis === null) {
    // 		return false;
    // 	}

    // 	return axis;
    // }

    //==============================================================================
    // 게임패드 연결.
    //==============================================================================
    /**
     * @param { Gamepad } gamepad
     */
    connect(gamepad) {
        if (gamepad === null || this.#connectedGamepads.indexOf(gamepad) !== -1) {
            return;
        }
        const buttonStates = new Map();
        this.#connectedGamepads.push(gamepad);
        this.#conntectedGamepadButtonStates.set(gamepad.id, buttonStates);

        // GamepadButton
        // for (const button of gamepad.buttons) {
        for (let buttonIndex = 0; buttonIndex < gamepad.buttons.length; ++buttonIndex) {
            const button = gamepad.buttons[buttonIndex];
            if (button === null) {
                continue;
            }

            buttonStates.set(buttonIndex, false);			
        }
    }

    //==============================================================================
    // 게임패드 연결 해제.
    //==============================================================================
    /**
     * @param { Gamepad } gamepad
     */
    disconnect(gamepad) {
        if (gamepad === null) {
            return;
        }
        const gamepadIndex = this.#connectedGamepads.indexOf(gamepad);
        if (gamepadIndex === -1) {
            return;
        }

        this.#connectedGamepads.slice(gamepadIndex, 1);
    }

    //==============================================================================
    // 연결된 모든 게임패드 반환.
    //==============================================================================
    /**
     * @returns { Gamepad[] }
     */
    getAllConnectedGamepads() {
        return this.#connectedGamepads;
    }

    //==============================================================================
    // 연결된 게임패드 수 반환.
    //==============================================================================
    /**
     * @returns { number }
     */
    getConnectedGamepadCount() {
        return this.#connectedGamepads.length;
    }

    //==============================================================================
    // 연결된 게임패드 반환.
    //==============================================================================
    /**
     * @returns { Gamepad | undefined }
     */
    getConnectedGamepad(gamepadIndex) {
        if (gamepadIndex < 0 || gamepadIndex >= this.#connectedGamepads.length) {
            return undefined;
        }

        const gamepad = this.#connectedGamepads.at(gamepad);
        return gamepad;
    }
}