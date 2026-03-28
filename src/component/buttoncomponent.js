//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Vector2 } from "../base/vector2.js";
import { Enum } from "../misc/identifier.js";
import { Rect } from "../base/rect.js";
import * as Math from "../base/math.js";
import { OBB } from "../base/obb.js";
import { Renderer } from "../core/renderer.js";
import { Component } from "../core/component.js";


//==============================================================================
// 버튼 상태.
//==============================================================================
export const VButtonState = {
	normal: Enum.auto(),
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
	/** @private @type { Function } */ #clickEvent;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @construct
	 */
	constructor() {
		super();
		this.#buttonState = VButtonState.normal;
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
			case VButtonState.normal: {
					break;
				}
			case VButtonState.hover: {
					break;
				}
			case VButtonState.pressed: {
					break;
				}
			case VButtonState.released: {
					break;
				}
			case VButtonState.selected: {
					break;
				}
			case VButtonState.disabled: {
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
	 * @param { Function } clickEvent
	 */
	setClickEvent(clickEvent) {
		this.#clickEvent = clickEvent;
	}

	//==============================================================================
	// 클릭 이벤트 반환.
	//==============================================================================
	/**
	 * @returns { Function }
	 */
	getClickEvent() {
		return this.#clickEvent;
	}
}