//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Vector2 } from "../base/vector2.js";
import { Enum } from "../base/identifier.js";
import { Rect } from "../base/rect.js";
import * as Math from "../base/math.js";
import { OBB } from "../base/obb.js";
import { Renderer } from "../core/renderer.js";
import { Component } from "../core/component.js";


//==============================================================================
// 버튼 상태.
//==============================================================================
export const ButtonState = {
	normal: Enum.begin(),
	hover: Enum.auto(),
	pressed: Enum.auto(),
	released: Enum.auto(),
	disabled: Enum.auto()
};

//==============================================================================
// 버튼의 상태.
//==============================================================================
export class ButtonComponent extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { ButtonState } */ #buttonState;
	/** @private @type { function(ButtonComponent): boolean } */ #clickEvent;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @construct
	 */
	constructor() {
		super();
		this.#buttonState = ButtonState.normal;
		this.#clickEvent = null;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta 
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
		this.updateButtonState();
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Renderer } renderer 
	 */
	draw(renderer) {
		// super.draw(renderer);
	}

	//==============================================================================
	// 버튼 갱신.
	//==============================================================================
	updateButtonState() {
		const buttonState = this.getButtonState();
		switch (buttonState) {
			case ButtonState.normal: {
					break;
				}
			case ButtonState.hover: {
					break;
				}
			case ButtonState.pressed: {
					break;
				}
			case ButtonState.released: {
					break;
				}
			case ButtonState.selected: {
					break;
				}
			case ButtonState.disabled: {
					break;
				}
		}
	}

	//==============================================================================
	// 버튼 상태 변경.
	//==============================================================================
	/**
	 * @param { ButtonState } buttonState
	 */
	setButtonState(buttonState) {
		if (this.#buttonState === buttonState) {
			return;
		}
		const previousButtonState = this.#buttonState;
		this.#buttonState = buttonState;
	}

	//==============================================================================
	// 버튼 상태 반환.
	//==============================================================================
	/**
	 * @returns { ButtonState }
	 */
	getButtonState() {
		return this.#buttonState;
	}

	//==============================================================================
	// 클릭 이벤트 설정.
	//==============================================================================
	/**
	 * @param { function(ButtonComponent): boolean } callback
	 */
	setClickEvent(callback) {
		this.#clickEvent = callback;
	}

	
	//==============================================================================
	// 클릭 이벤트 설정.
	//==============================================================================
	/**
	 * @param { function(ButtonComponent): boolean } callback
	 */
	setStateEvent(buttonState, callback) {
		// this.#clickEvent = callback;
		switch (buttonState) {
			case ButtonState.normal: {
					break;
				}
		}
	}

	//==============================================================================
	// 클릭 이벤트 반환.
	//==============================================================================
	/**
	 * @returns { function(ButtonComponent): boolean }
	 */
	getClickEvent() {
		return this.#clickEvent;
	}
}