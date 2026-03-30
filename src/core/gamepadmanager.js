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
        this.updateAllGamepads();
    }

    //==============================================================================
    // 모든 게임패드 갱신.
    //==============================================================================
    updateAllGamepads() {
        const gamepads = System.navigator.getGamepads();
        const connectedGamepads = this.getAllConnectedGamepads();
        for (const connectedGamepad of connectedGamepads) {
            if (connectedGamepad === null) {
                continue;
            }

            const gamepad = gamepads[connectedGamepad.index];
            if (!gamepad) {
                continue;
            }

            const gamepadId = gamepad.id;
            const buttonStates = this.#conntectedGamepadButtonStates.get(gamepadId);
            if (!buttonStates || buttonStates.size === 0) {
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

        this.#connectedGamepads.splice(gamepadIndex, 1);
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

        const gamepad = this.#connectedGamepads.at(gamepadIndex);
        return gamepad;
    }
}