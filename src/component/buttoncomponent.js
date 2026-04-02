//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Enum } from "../base/identifier.js";
import { Graphic } from "../core/graphic.js";
import { Component } from "../core/component.js";
import { Color } from "../base/color.js";
import * as Math from "../base/math.js";
import { SpriteComponent } from "./spritecomponent.js";
import { LabelComponent } from "./labelcomponent.js";


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
	/** @private @type { function(ButtonComponent): void } */ #pressedEvent;
	/** @private @type { function(ButtonComponent): void } */ #releasedEvent;
	/** @private @type { function(ButtonComponent): void } */ #clickedEvent;
	/** @private @type { * } */ #engine;
	/** @private @type { boolean } */ #isPressTracking;
	/** @private @type { number } */ #tintFactor;
	/** @private @type { number } */ #transitionDuration;
	/** @private @type { number } */ #tintProgress;
	/** @private @type { Array } */ #colorEntries;

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
		this.#pressedEvent = null;
		this.#releasedEvent = null;
		this.#clickedEvent = null;
		this.#engine = null;
		this.#isPressTracking = false;
		this.#tintFactor = 0.6;
		this.#transitionDuration = 0.1;
		this.#tintProgress = 0;
		this.#colorEntries = [];
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
		this.updateButtonState();
		this.#updateTintTransition(timeDelta);
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic
	 */
	draw(graphic) {
		// super.draw(graphic);
	}

	//==============================================================================
	// 버튼 갱신.
	//==============================================================================
	updateButtonState() {
		if (!this.#engine) {
			return;
		}
		const node = this.getNode();
		if (!node) {
			return;
		}
		const inputManager = this.#engine.getInputManager();
		const viewInputPosition = inputManager.getViewInputPosition();
		const isInsideBounds = node.contains(viewInputPosition);

		if (inputManager.isTouchPressed()) {
			if (isInsideBounds) {
				this.#isPressTracking = true;
				this.setButtonState(ButtonState.pressed);
				this.#collectColorTargets();
				if (this.#pressedEvent) {
					this.#pressedEvent(this);
				}
			}
		}
		else if (inputManager.isTouchReleased()) {
			if (this.#isPressTracking) {
				this.#isPressTracking = false;
				this.setButtonState(ButtonState.released);
				if (this.#releasedEvent) {
					this.#releasedEvent(this);
				}
				if (isInsideBounds) {
					if (this.#clickedEvent) {
						this.#clickedEvent(this);
					}
					if (this.#clickEvent) {
						this.#clickEvent(this);
					}
				}
				this.setButtonState(ButtonState.normal);
			}
		}
	}

	//==============================================================================
	// 틴트 트랜지션 갱신.
	//==============================================================================
	/** @private */
	#updateTintTransition(timeDelta) {
		const buttonState = this.getButtonState();
		const isPressed = buttonState === ButtonState.pressed;

		if (isPressed) {
			this.#tintProgress = Math.min(this.#tintProgress + timeDelta / this.#transitionDuration, 1);
		}
		else {
			this.#tintProgress = Math.max(this.#tintProgress - timeDelta / this.#transitionDuration, 0);
		}

		this.#applyTintProgress(this.#tintProgress);
	}

	//==============================================================================
	// 틴트 적용.
	//==============================================================================
	/** @private */
	#applyTintProgress(progress) {
		for (const colorEntry of this.#colorEntries) {
			const originalColor = colorEntry.originalColor;
			const tintMultiplier = Math.lerp(1, this.#tintFactor, progress);
			const tintedRed = originalColor.red * tintMultiplier;
			const tintedGreen = originalColor.green * tintMultiplier;
			const tintedBlue = originalColor.blue * tintMultiplier;
			const tintedColor = new Color(tintedRed, tintedGreen, tintedBlue, originalColor.alpha);
			if (colorEntry.type === 'sprite') {
				colorEntry.component.setColor(tintedColor);
			}
			else if (colorEntry.type === 'label') {
				colorEntry.component.setTextColor(tintedColor);
			}
		}
	}

	//==============================================================================
	// 색상 대상 수집.
	//==============================================================================
	/** @private */
	#collectColorTargets() {
		this.#colorEntries = [];
		const node = this.getNode();
		if (!node) {
			return;
		}
		this.#collectFromNode(node);
	}

	//==============================================================================
	// 노드에서 색상 대상 재귀 수집.
	//==============================================================================
	/** @private */
	#collectFromNode(node) {
		const spriteComponents = node.getComponents(SpriteComponent);
		for (const spriteComponent of spriteComponents) {
			const originalColor = spriteComponent.getColor();
			const copiedColor = new Color(originalColor.red, originalColor.green, originalColor.blue, originalColor.alpha);
			this.#colorEntries.push({ type: 'sprite', component: spriteComponent, originalColor: copiedColor });
		}
		const labelComponents = node.getComponents(LabelComponent);
		for (const labelComponent of labelComponents) {
			const originalColor = labelComponent.getTextColor();
			const copiedColor = new Color(originalColor.red, originalColor.green, originalColor.blue, originalColor.alpha);
			this.#colorEntries.push({ type: 'label', component: labelComponent, originalColor: copiedColor });
		}
		const children = node.getChildren();
		for (const child of children) {
			this.#collectFromNode(child);
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

	//==============================================================================
	// 누름 이벤트 설정.
	//==============================================================================
	/**
	 * @param { function(ButtonComponent): void } callback
	 */
	setPressedEvent(callback) {
		this.#pressedEvent = callback;
	}

	//==============================================================================
	// 누름 이벤트 반환.
	//==============================================================================
	/**
	 * @returns { function(ButtonComponent): void }
	 */
	getPressedEvent() {
		return this.#pressedEvent;
	}

	//==============================================================================
	// 뗌 이벤트 설정.
	//==============================================================================
	/**
	 * @param { function(ButtonComponent): void } callback
	 */
	setReleasedEvent(callback) {
		this.#releasedEvent = callback;
	}

	//==============================================================================
	// 뗌 이벤트 반환.
	//==============================================================================
	/**
	 * @returns { function(ButtonComponent): void }
	 */
	getReleasedEvent() {
		return this.#releasedEvent;
	}

	//==============================================================================
	// 클릭됨 이벤트 설정.
	//==============================================================================
	/**
	 * @param { function(ButtonComponent): void } callback
	 */
	setClickedEvent(callback) {
		this.#clickedEvent = callback;
	}

	//==============================================================================
	// 클릭됨 이벤트 반환.
	//==============================================================================
	/**
	 * @returns { function(ButtonComponent): void }
	 */
	getClickedEvent() {
		return this.#clickedEvent;
	}

	//==============================================================================
	// 엔진 설정.
	//==============================================================================
	/**
	 * @param { * } engine
	 */
	setEngine(engine) {
		this.#engine = engine;
	}

	//==============================================================================
	// 엔진 반환.
	//==============================================================================
	/**
	 * @returns { * }
	 */
	getEngine() {
		return this.#engine;
	}
}
