//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Enum } from "../../base/identifier.js";
import { Graphic } from "../../core/graphic.js";
import { UIComponent } from "./uicomponent.js";
import { UINode } from "../../core/node/uinode.js";
import { Color } from "../../base/color.js";
import * as Math from "../../base/math.js";
import { SpriteComponent } from "../spritecomponent.js";
import { LabelComponent } from "../labelcomponent.js";


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
// 버튼.
//==============================================================================
export class ButtonComponent extends UIComponent {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { ButtonState } */ #buttonState;
	/** @private @type { function(ButtonComponent): boolean } */ #clickEvent;
	/** @private @type { function(ButtonComponent): void } */ #pressedEvent;
	/** @private @type { function(ButtonComponent): void } */ #releasedEvent;
	/** @private @type { function(ButtonComponent): void } */ #clickedEvent;
	/** @private @type { boolean } */ #isPressTracking;
	/** @private @type { Color } */ #pressedTintColor;
	/** @private @type { number } */ #transitionDuration;
	/** @private @type { number } */ #tintProgress;
	/** @private @type { Array } */ #colorEntries;
	/** @private @type { boolean } */ #isInteractable;
	/** @private @type { Color } */ #disabledTintColor;

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
		this.#isPressTracking = false;
		this.#pressedTintColor = new Color(0, 0, 0, 0.3);
		this.#transitionDuration = 0.3;
		this.#tintProgress = 0;
		this.#colorEntries = [];
		this.#isInteractable = true;
		this.#disabledTintColor = new Color(0, 0, 0, 0.5);
	}

	//==============================================================================
	// 노드에 붙음. (UINode의 isInteractable을 자동 활성화)
	//==============================================================================
	/**
	 * @override
	 * @param { ComponentNode } node
	 */
	attach(node) {
		super.attach(node);
		if (node instanceof UINode) {
			node.setInteractable(true);
		}
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
		this.updateTintTransition(timeDelta);
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
	// 터치 누름. (TouchRaycaster → UINode → ButtonComponent)
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition
	 */
	touchPress(viewInputPosition) {
		if (!this.#isInteractable) {
			return;
		}
		this.#isPressTracking = true;
		this.setButtonState(ButtonState.pressed);
		this.collectColorTargets();
		if (this.#pressedEvent) {
			this.#pressedEvent(this);
		}
	}

	//==============================================================================
	// 터치 뗌. (TouchRaycaster → UINode → ButtonComponent)
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition
	 */
	touchRelease(viewInputPosition) {
		if (!this.#isInteractable) {
			return;
		}
		if (!this.#isPressTracking) {
			return;
		}
		this.#isPressTracking = false;
		this.setButtonState(ButtonState.released);
		if (this.#releasedEvent) {
			this.#releasedEvent(this);
		}
		const node = this.getNode();
		const isInsideBounds = node.contains(viewInputPosition);
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

	//==============================================================================
	// 틴트 트랜지션 갱신.
	//==============================================================================
	/** @private */
	updateTintTransition(timeDelta) {
		if (!this.#isInteractable) {
			this.applyDisabledTint();
			return;
		}
		const buttonState = this.getButtonState();
		const isPressed = buttonState === ButtonState.pressed;

		if (isPressed) {
			this.#tintProgress = Math.min(this.#tintProgress + timeDelta / this.#transitionDuration, 1);
		}
		else {
			this.#tintProgress = Math.max(this.#tintProgress - timeDelta / this.#transitionDuration, 0);
		}

		this.applyTintProgress(this.#tintProgress);
	}

	//==============================================================================
	// 틴트 적용.
	//==============================================================================
	applyTintProgress(progress) {
		const pressedTintColor = this.#pressedTintColor;
		for (const colorEntry of this.#colorEntries) {
			if (colorEntry.type === 'sprite') {
				const overlayAlpha = Math.lerp(0, pressedTintColor.alpha, progress);
				const overlayColor = new Color(pressedTintColor.red, pressedTintColor.green, pressedTintColor.blue, overlayAlpha);
				colorEntry.component.setColor(overlayColor);
			}
			else if (colorEntry.type === 'label') {
				const originalColor = colorEntry.originalColor;
				const tintedRed = Math.lerp(originalColor.red, pressedTintColor.red, pressedTintColor.alpha * progress);
				const tintedGreen = Math.lerp(originalColor.green, pressedTintColor.green, pressedTintColor.alpha * progress);
				const tintedBlue = Math.lerp(originalColor.blue, pressedTintColor.blue, pressedTintColor.alpha * progress);
				const tintedColor = new Color(tintedRed, tintedGreen, tintedBlue, originalColor.alpha);
				colorEntry.component.setTextColor(tintedColor);
			}
		}
	}

	//==============================================================================
	// 비활성화 틴트 적용.
	//==============================================================================
	/** @private */
	applyDisabledTint() {
		const disabledTintColor = this.#disabledTintColor;
		for (const colorEntry of this.#colorEntries) {
			if (colorEntry.type === 'sprite') {
				const overlayColor = new Color(disabledTintColor.red, disabledTintColor.green, disabledTintColor.blue, disabledTintColor.alpha);
				colorEntry.component.setColor(overlayColor);
			}
		}
	}

	//==============================================================================
	// 색상 대상 수집.
	//==============================================================================
	collectColorTargets() {
		this.#colorEntries = [];
		const node = this.getNode();
		if (!node) {
			return;
		}
		this.collectFromNode(node);
	}

	//==============================================================================
	// 노드에서 색상 대상 재귀 수집.
	//==============================================================================
	collectFromNode(node) {
		const spriteComponents = node.getComponents(SpriteComponent);
		for (const spriteComponent of spriteComponents) {
			this.#colorEntries.push({ type: 'sprite', component: spriteComponent });
		}
		const labelComponents = node.getComponents(LabelComponent);
		for (const labelComponent of labelComponents) {
			const originalColor = labelComponent.getTextColor();
			const copiedColor = new Color(originalColor.red, originalColor.green, originalColor.blue, originalColor.alpha);
			this.#colorEntries.push({ type: 'label', component: labelComponent, originalColor: copiedColor });
		}
		const children = node.getChildren();
		for (const child of children) {
			this.collectFromNode(child);
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
	// 눌림 틴트 색상 설정.
	//==============================================================================
	/**
	 * @param { Color } color
	 */
	setPressedTintColor(color) {
		this.#pressedTintColor = color;
	}

	//==============================================================================
	// 눌림 틴트 색상 반환.
	//==============================================================================
	/**
	 * @returns { Color }
	 */
	getPressedTintColor() {
		return this.#pressedTintColor;
	}

	//==============================================================================
	// 트랜지션 지속 시간 설정.
	//==============================================================================
	/**
	 * @param { number } duration
	 */
	setTransitionDuration(duration) {
		this.#transitionDuration = duration;
	}

	//==============================================================================
	// 트랜지션 지속 시간 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getTransitionDuration() {
		return this.#transitionDuration;
	}

	//==============================================================================
	// 활성화 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } isInteractable
	 */
	setInteractable(isInteractable) {
		if (this.#isInteractable === isInteractable) {
			return;
		}
		this.#isInteractable = isInteractable;
		if (!isInteractable) {
			this.collectColorTargets();
			this.setButtonState(ButtonState.disabled);
		}
		else {
			this.#tintProgress = 0;
			this.applyTintProgress(0);
			this.setButtonState(ButtonState.normal);
		}
	}

	//==============================================================================
	// 활성화 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	getInteractable() {
		return this.#isInteractable;
	}
}
