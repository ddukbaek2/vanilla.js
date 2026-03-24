//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Rect } from "../base/rect.js";
import { Vector2 } from "../base/vector2.js";
import { Renderer } from "../core/renderer.js";
import { Enum } from "../misc/identifier.js";
import { UINode } from "./uinode.js";
// import { FontAsset } from "../core/fontasset.js";
import { Sprite } from "../rendering/sprite.js";


//==============================================================================
// 버튼 상태.
//==============================================================================
export const ButtonState = {
	normal: Enum.auto(),
	hover: Enum.auto(),
	pressed: Enum.auto(),
	released: Enum.auto(),
	selected: Enum.auto(),
	disabled: Enum.auto(),
}


//==============================================================================
// UI 버튼.
//==============================================================================
export class UIButton extends UINode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { ButtonState } */ #buttonState;
	/** @private @type { Function } */ #clickEvent;
	/** @private @type { Sprite } */ #sprite;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.#buttonState = ButtonState.normal;
		this.#clickEvent = null;
		this.#sprite = new Sprite();
		this.addChild(this.#sprite);
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta 
	 */
	update(timeDelta) {
		super.update(timeDelta);
		this.updateButtonState();
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
	// 출력.
	//==============================================================================
	/**
	 * @override
	 * @param { Renderer } renderer 
	 */
	draw(renderer) {
		// super.draw(renderer);
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

	//==============================================================================
	// 영역에 충돌 되었는지 여부.
	//==============================================================================
	/**
	 * @param { Vector2 } position
	 * @returns { boolean }
	 */
	contains(position) {
		const rect = Rect.create(this.position.x, this.position.y, this.size.x, this.size.y);
		if (rect.overlaps(position)) {
			return true;
		}
		return false;
	}
}