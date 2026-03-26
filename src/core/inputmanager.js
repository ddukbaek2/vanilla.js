//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Engine } from "./engine.js";


//==============================================================================
// 입력 매니저.
//==============================================================================
export class InputManager extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { boolean } */ #isTouchPressed; // 입력시 딱 한번 눌림.
	/** @private @type { boolean } */ #isTouchReleased; // 입력시 딱 한번 뗌.
	/** @private @type { boolean } */ #isTouchMoved; // 입력시 뗄 때가지 계속 눌림.
	/** @private @type { Vector2 } */ #canvasNativeInputPosition; // canvasNativeSize 기반 위치값.
	/** @private @type { Vector2 } */ #inputPosition;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { Engine } engine 
	 */
	constructor(engine) {
		super();

		this.#isTouchPressed = false;
		this.#isTouchReleased = false;	
		this.#isTouchMoved = false;
		this.#canvasNativeInputPosition = Vector2.zero();
		this.#inputPosition = Vector2.zero();
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
		this.#canvasNativeInputPosition = position;
	}

	//==============================================================================
	// canvasNativeSize 기반 입력 위치 반환. (복사 후 반환)
	//==============================================================================
	/**
	 * @returns { Vector2 } 
	 */
	getCanvasNativeInputPosition() {
		return this.#canvasNativeInputPosition.clone();
	}

	//==============================================================================
	// 뷰의 입력 위치 갱신.
	//==============================================================================
	/**
	 * @param { Vector2 } position 
	 */
	setViewInputPosition(position) {
		this.#inputPosition = position;
	}

	//==============================================================================
	// 뷰의 입력 위치 반환. (복사 후 반환)
	//==============================================================================
	/**
	 * @returns { Vector2 } 
	 */
	getViewInputPosition() {
		// return this.#position;
		return this.#inputPosition.clone();
	}
}