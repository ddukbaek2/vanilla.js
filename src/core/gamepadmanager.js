//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Engine } from "./engine.js";


// W3C Standard Gamepad API Axes (아날로그 스틱)
const AnalogStick = {
    LEFT_X: 0,  // -1.0(Left)  to 1.0(Right)
    LEFT_Y: 1,  // -1.0(Up)    to 1.0(Down)
    RIGHT_X: 2, // -1.0(Left)  to 1.0(Right)
    RIGHT_Y: 3, // -1.0(Up)    to 1.0(Down)
};

// W3C Standard Gamepad API Buttons
const Button = {
    // Face Buttons
    A_CROSS: 0,       // Bottom face button (Xbox: A, PS: Cross)
    B_CIRCLE: 1,      // Right face button  (Xbox: B, PS: Circle)
    X_SQUARE: 2,      // Left face button   (Xbox: X, PS: Square)
    Y_TRIANGLE: 3,    // Top face button    (Xbox: Y, PS: Triangle)

    // Bumpers / Shoulders
    L1: 4,            // Left Bumper  (LB / L1)
    R1: 5,            // Right Bumper (RB / R1)

    // Triggers (버튼으로도 쓰이고 아날로그 값도 가짐)
    L2: 6,            // Left Trigger  (LT / L2)
    R2: 7,            // Right Trigger (RT / R2)

    // System / Center Buttons
    SHARE_VIEW: 8,    // Share / View / Select
    OPTIONS_MENU: 9,  // Options / Menu / Start

    // Stick Clicks
    L3: 10,           // Left Stick Click  (LS / L3)
    R3: 11,           // Right Stick Click (RS / R3)

    // D-Pad
    DPAD_UP: 12,      // Directional Pad Up
    DPAD_DOWN: 13,    // Directional Pad Down
    DPAD_LEFT: 14,    // Directional Pad Left
    DPAD_RIGHT: 15,   // Directional Pad Right

    // Home / Touchpad (OS 및 브라우저에 따라 다름)
    HOME_PS: 16,      // Xbox Button / PS Logo Button
    TOUCHPAD: 17,     // PS4/5 Touchpad Click (비표준)
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
                    console.log(`[GamepadManager] Pad ${hardwareIndex} Button ${i} ${currentButton.pressed ? 'Pressed' : 'Released'}`);
                }

                // 아날로그 값(트리거 등) 변화 감지 (소수점 2자리까지).
                const currentValue = parseFloat(currentButton.value.toFixed(2));
                if (lastButtonState.value !== currentValue) {
                    lastButtonState.value = currentValue;
                    // 트리거 등 값이 유의미할 때만 로그 출력.
                    if (currentValue > 0) {
                        console.log(`[GamepadManager] Pad ${hardwareIndex} Button ${i} Value: ${currentValue}`);
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
                    console.log(`[GamepadManager] Pad ${hardwareIndex} Axis ${i} Value: ${currentAxisValue}`);
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
        if (gamepad === null || this.#connectedGamepadIndices.indexOf(gamepad.index) !== -1) {
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
        if (gamepad === null) {
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
    getConnectedGamepad(listIndex) {
        if (listIndex < 0 || listIndex >= this.#connectedGamepadIndices.length) {
            return undefined;
        }

        const hardwareIndex = this.#connectedGamepadIndices.at(listIndex);
        const gamepads = System.navigator.getGamepads();
        return gamepads[hardwareIndex];
    }
}