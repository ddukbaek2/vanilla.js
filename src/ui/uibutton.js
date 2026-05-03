//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Enum } from "../base/identifier.js";
import { Graphic } from "../core/graphic.js";
import { UIControl } from "./uicontrol.js";
import { AnchoredWorldNode } from "../core/node/anchoredworldmnode.js";
import { Color } from "../base/color.js";
import * as Math from "../base/math.js";
import { Sprite } from "../core/component/sprite.js";
import { Label } from "../core/component/label.js";
import { UIImageView } from "./uiimageview.js";
import { UILabel } from "./uilabel.js";


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
export class UIButton extends UIControl {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { ButtonState } */ #buttonState;
	/** @private @type { function(UIButton): boolean } */ #clickEvent;
	/** @private @type { function(UIButton): void } */ #pressedEvent;
	/** @private @type { function(UIButton): void } */ #releasedEvent;
	/** @private @type { function(UIButton): void } */ #clickedEvent;
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
		this.setComponentType("Button");
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
	// 노드에 붙음. (AnchoredWorldNode의 isInteractable을 자동 활성화)
	//==============================================================================
	/**
	 * @override
	 * @param { ComponentNode } node
	 */
	attach(node) {
		super.attach(node);
		if (node instanceof AnchoredWorldNode) {
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
	// 터치 누름. (TouchRaycaster → AnchoredWorldNode → Button)
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition
	 */
	touchPress(viewInputPosition) {
		if (!this.getInteractable()) {
			return;
		}
		this.#isPressTracking = true;
		this.setButtonState(ButtonState.pressed);
		this.collectColorTargets();
		const pressedEvent = this.getPressedEvent();
		if (pressedEvent) {
			pressedEvent(this);
		}
	}

	//==============================================================================
	// 터치 뗌. (TouchRaycaster → AnchoredWorldNode → Button)
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition
	 */
	touchRelease(viewInputPosition) {
		if (!this.getInteractable()) {
			return;
		}
		if (!this.#isPressTracking) {
			return;
		}
		this.#isPressTracking = false;
		this.setButtonState(ButtonState.released);
		this.#tintProgress = 0;
		this.applyTintProgress(0);
		const releasedEvent = this.getReleasedEvent();
		if (releasedEvent) {
			releasedEvent(this);
		}
		const node = this.getNode();
		const isInsideBounds = node.contains(viewInputPosition);
		if (isInsideBounds) {
			const clickedEvent = this.getClickedEvent();
			if (clickedEvent) {
				clickedEvent(this);
			}
			const clickEvent = this.getClickEvent();
			if (clickEvent) {
				clickEvent(this);
			}
		}
		this.setButtonState(ButtonState.normal);
	}

	//==============================================================================
	// 터치 취소. (TouchRaycaster → AnchoredWorldNode → Button)
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition
	 */
	touchCancel(viewInputPosition) {
		if (!this.#isPressTracking) {
			return;
		}
		this.#isPressTracking = false;
		this.#tintProgress = 0;
		this.applyTintProgress(0);
		this.setButtonState(ButtonState.normal);
	}

	//==============================================================================
	// 틴트 트랜지션 갱신.
	//==============================================================================
	/** @private */
	updateTintTransition(timeDelta) {
		if (!this.getInteractable()) {
			this.applyDisabledTint();
			return;
		}
		const buttonState = this.getButtonState();
		const isPressed = buttonState === ButtonState.pressed;
		const transitionDuration = this.getTransitionDuration();

		if (isPressed) {
			this.#tintProgress = Math.min(this.#tintProgress + timeDelta / transitionDuration, 1);
		}
		else {
			this.#tintProgress = Math.max(this.#tintProgress - timeDelta / transitionDuration, 0);
		}

		this.applyTintProgress(this.#tintProgress);
	}

	//==============================================================================
	// 틴트 적용.
	//==============================================================================
	applyTintProgress(progress) {
		const pressedTintColor = this.getPressedTintColor();
		for (const colorEntry of this.#colorEntries) {
			if (colorEntry.type === "sprite" || colorEntry.type === "imageview") {
				const overlayAlpha = Math.lerp(0, pressedTintColor.alpha, progress);
				const overlayColor = new Color(pressedTintColor.red, pressedTintColor.green, pressedTintColor.blue, overlayAlpha);
				colorEntry.component.setColor(overlayColor);
			}
			else if (colorEntry.type === "label" || colorEntry.type === "uilabel") {
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
			if (colorEntry.type === "sprite" || colorEntry.type === "imageview") {
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
		// 노드에 UIImageView 가 있으면 wrapper 를 통해 색을 제어한다.
		// (UIImageView 는 attach 시 내부 Sprite 를 자동 부착하므로
		//  wrapper 가 있는 경우 raw Sprite 를 별도로 잡지 않고 wrapper 만 다룬다)
		const imageViews = node.getComponents(UIImageView);
		if (imageViews.length > 0) {
			for (const imageView of imageViews) {
				this.#colorEntries.push({ type: "imageview", component: imageView });
			}
		}
		else {
			const sprites = node.getComponents(Sprite);
			for (const sprite of sprites) {
				this.#colorEntries.push({ type: "sprite", component: sprite });
			}
		}

		// 라벨도 동일. UILabel wrapper 가 있으면 wrapper 만, 없으면 raw Label 처리.
		const uiLabels = node.getComponents(UILabel);
		if (uiLabels.length > 0) {
			for (const uiLabel of uiLabels) {
				const originalColor = uiLabel.getTextColor();
				const copiedColor = new Color(originalColor.red, originalColor.green, originalColor.blue, originalColor.alpha);
				this.#colorEntries.push({ type: "uilabel", component: uiLabel, originalColor: copiedColor });
			}
		}
		else {
			const labelComponents = node.getComponents(Label);
			for (const labelComponent of labelComponents) {
				const originalColor = labelComponent.getTextColor();
				const copiedColor = new Color(originalColor.red, originalColor.green, originalColor.blue, originalColor.alpha);
				this.#colorEntries.push({ type: "label", component: labelComponent, originalColor: copiedColor });
			}
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
		if (this.getButtonState() === buttonState) {
			return;
		}
		const previousButtonState = this.getButtonState();
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
	 * @param { function(UIButton): boolean } callback
	 */
	setClickEvent(callback) {
		this.#clickEvent = callback;
	}

	//==============================================================================
	// 클릭 이벤트 설정.
	//==============================================================================
	/**
	 * @param { function(UIButton): boolean } callback
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
	 * @returns { function(UIButton): boolean }
	 */
	getClickEvent() {
		return this.#clickEvent;
	}

	//==============================================================================
	// 누름 이벤트 설정.
	//==============================================================================
	/**
	 * @param { function(UIButton): void } callback
	 */
	setPressedEvent(callback) {
		this.#pressedEvent = callback;
	}

	//==============================================================================
	// 누름 이벤트 반환.
	//==============================================================================
	/**
	 * @returns { function(UIButton): void }
	 */
	getPressedEvent() {
		return this.#pressedEvent;
	}

	//==============================================================================
	// 뗌 이벤트 설정.
	//==============================================================================
	/**
	 * @param { function(UIButton): void } callback
	 */
	setReleasedEvent(callback) {
		this.#releasedEvent = callback;
	}

	//==============================================================================
	// 뗌 이벤트 반환.
	//==============================================================================
	/**
	 * @returns { function(UIButton): void }
	 */
	getReleasedEvent() {
		return this.#releasedEvent;
	}

	//==============================================================================
	// 클릭됨 이벤트 설정.
	//==============================================================================
	/**
	 * @param { function(UIButton): void } callback
	 */
	setClickedEvent(callback) {
		this.#clickedEvent = callback;
	}

	//==============================================================================
	// 클릭됨 이벤트 반환.
	//==============================================================================
	/**
	 * @returns { function(UIButton): void }
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
		if (this.getInteractable() === isInteractable) {
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
