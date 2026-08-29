//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Color } from "../base/color.js";
import { Rect } from "../base/rect.js";
import { Vector2 } from "../base/vector2.js";
import * as Math from "../base/math.js";
import { Graphic } from "../core/graphic.js";
import { WorldNode } from "../core/node/worldnode.js";
import { UIControl } from "./uicontrol.js";
import { ProgressDirection } from "./uiprogressview.js";


//==============================================================================
// 슬라이더 컨트롤.
// - 사용자 입력(드래그/탭)으로 값을 조정한다. → UIControl 을 상속.
// - 표시 부분(트랙/채움)은 UIProgressView 와 외관이 비슷하지만, 컨트롤 트리에
//   속해야 하므로 UIProgressView 를 상속하지 않고 직접 그린다.
// - thumb 까지 추가로 그린다.
//==============================================================================
export class UISlider extends UIControl {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #value;
	/** @private @type { number } */ #minValue;
	/** @private @type { number } */ #maxValue;
	/** @private @type { Color } */  #trackColor;
	/** @private @type { Color } */  #fillColor;
	/** @private @type { Color } */  #thumbColor;
	/** @private @type { number } */ #thumbRadius;
	/** @private @type { WorldNode } */ #thumbNode;
	/** @private @type { number } */ #cornerRadius;
	/** @private @type { string } */ #direction;
	/** @private @type { boolean } */ #isDragging;
	/** @private @type { boolean } */ #isInteractable;
	/** @private @type { (slider: UISlider) => void } */ #valueChangedEvent;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setComponentType("UISlider");
		this.#value = 0;
		this.#minValue = 0;
		this.#maxValue = 1;
		this.#trackColor = new Color(0.7, 0.7, 0.7, 1);
		this.#fillColor = new Color(0.23, 0.51, 0.96, 1); // blue-500 근사
		this.#thumbColor = new Color(1, 1, 1, 1);
		this.#thumbRadius = 16;
		this.#thumbNode = null;
		this.#cornerRadius = 0;
		this.#direction = ProgressDirection.horizontal;
		this.#isDragging = false;
		this.#isInteractable = true;
		this.#valueChangedEvent = null;
	}

	//==============================================================================
	// 노드에 붙음. (WorldNode 의 isInteractable 을 자동 활성화)
	//==============================================================================
	/**
	 * @override
	 * @param { ComponentNode } node
	 */
	attach(node) {
		super.attach(node);
		if (node instanceof WorldNode) {
			node.setInteractable(true);
		}
	}

	//==============================================================================
	// 출력. (트랙 + 채움 + thumb)
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic
	 */
	draw(graphic) {
		const node = this.getNode();
		if (!node) {
			return;
		}
		const contentSize = node.getContentSize();
		if (contentSize.x <= 0 || contentSize.y <= 0) {
			return;
		}

		// 트랙.
		const trackRect = Rect.create(0, 0, contentSize.x, contentSize.y);
		graphic.setFillColor(this.#trackColor);
		if (this.#cornerRadius > 0) {
			graphic.drawRoundRect(trackRect, this.#cornerRadius);
		}
		else {
			graphic.drawRect(trackRect);
		}

		// 채움.
		const ratio = this.getRatio();
		if (ratio > 0) {
			let fillRect;
			if (this.#direction === ProgressDirection.vertical) {
				const fillHeight = contentSize.y * ratio;
				fillRect = Rect.create(0, contentSize.y - fillHeight, contentSize.x, fillHeight);
			}
			else {
				const fillWidth = contentSize.x * ratio;
				fillRect = Rect.create(0, 0, fillWidth, contentSize.y);
			}
			graphic.setFillColor(this.#fillColor);
			if (this.#cornerRadius > 0) {
				graphic.drawRoundRect(fillRect, this.#cornerRadius);
			}
			else {
				graphic.drawRect(fillRect);
			}
		}

		// thumb 위치.
		let thumbX;
		let thumbY;
		if (this.#direction === ProgressDirection.vertical) {
			thumbX = contentSize.x * 0.5;
			thumbY = contentSize.y * (1 - ratio);
		}
		else {
			thumbX = contentSize.x * ratio;
			thumbY = contentSize.y * 0.5;
		}

		// thumb 노드를 지정했으면 그 노드를 자리에 옮기고 원은 그리지 않는다.
		if (this.#thumbNode) {
			const thumbSize = this.#thumbNode.getContentSize();
			this.#thumbNode.setLocalPosition(Vector2.create(thumbX - thumbSize.x * 0.5, thumbY - thumbSize.y * 0.5));
			return;
		}

		// thumb 그리기 (원).
		graphic.setFillColor(this.#thumbColor);
		graphic.drawCircle(Vector2.create(thumbX, thumbY), this.#thumbRadius);
	}

	//==============================================================================
	// 터치 누름.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition
	 */
	touchPress(viewInputPosition) {
		if (!this.#isInteractable) {
			return;
		}
		this.#isDragging = true;
		this.updateValueFromInput(viewInputPosition);
	}

	//==============================================================================
	// 터치 이동.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition
	 */
	touchMove(viewInputPosition) {
		if (!this.#isDragging) {
			return;
		}
		this.updateValueFromInput(viewInputPosition);
	}

	//==============================================================================
	// 터치 뗌.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition
	 */
	touchRelease(viewInputPosition) {
		if (!this.#isDragging) {
			return;
		}
		this.updateValueFromInput(viewInputPosition);
		this.#isDragging = false;
	}

	//==============================================================================
	// 터치 취소.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition
	 */
	touchCancel(viewInputPosition) {
		this.#isDragging = false;
	}

	//==============================================================================
	// 입력 좌표 → 값 갱신 + 콜백.
	//==============================================================================
	/**
	 * @private
	 * @param { Vector2 } viewInputPosition
	 */
	updateValueFromInput(viewInputPosition) {
		const node = this.getNode();
		if (!node) {
			return;
		}
		const corners = node.getWorldCorners();
		if (!corners || corners.length < 1) {
			return;
		}
		const topLeft = corners[0];
		const localX = viewInputPosition.x - topLeft.x;
		const localY = viewInputPosition.y - topLeft.y;
		const contentSize = node.getContentSize();

		let ratio;
		if (this.#direction === ProgressDirection.vertical) {
			ratio = contentSize.y > 0 ? 1 - (localY / contentSize.y) : 0;
		}
		else {
			ratio = contentSize.x > 0 ? (localX / contentSize.x) : 0;
		}
		ratio = Math.clamp(ratio, 0, 1);

		const previousValue = this.#value;
		const newValue = this.#minValue + (this.#maxValue - this.#minValue) * ratio;
		this.setValue(newValue);

		if (this.#value !== previousValue && this.#valueChangedEvent) {
			this.#valueChangedEvent(this);
		}
	}

	//==============================================================================
	// 값/범위/비율.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getRatio() {
		const range = this.#maxValue - this.#minValue;
		if (range <= 0) {
			return 0;
		}
		const r = (this.#value - this.#minValue) / range;
		return Math.clamp(r, 0, 1);
	}

	/** @param { number } value */
	setValue(value) {
		this.#value = Math.clamp(value, this.#minValue, this.#maxValue);
	}
	getValue() { return this.#value; }

	/**
	 * @param { number } minValue
	 * @param { number } maxValue
	 */
	setRange(minValue, maxValue) {
		this.#minValue = minValue;
		this.#maxValue = maxValue;
		this.setValue(this.#value);
	}
	getMinValue() { return this.#minValue; }
	getMaxValue() { return this.#maxValue; }

	//==============================================================================
	// 외부 setValue 후 콜백을 강제 호출하고 싶을 때.
	//==============================================================================
	fireValueChanged() {
		if (this.#valueChangedEvent) {
			this.#valueChangedEvent(this);
		}
	}

	//==============================================================================
	// 색상.
	//==============================================================================
	/** @param { Color } color */ setTrackColor(color) { this.#trackColor = color; }
	getTrackColor() { return this.#trackColor; }

	/** @param { Color } color */ setFillColor(color) { this.#fillColor = color; }
	getFillColor() { return this.#fillColor; }

	/** @param { Color } color */ setThumbColor(color) { this.#thumbColor = color; }
	getThumbColor() { return this.#thumbColor; }

	//==============================================================================
	// 모양.
	//==============================================================================
	/** @param { number } radius */ setThumbRadius(radius) { this.#thumbRadius = radius; }
	getThumbRadius() { return this.#thumbRadius; }

	/** @param { WorldNode } node */ setThumbNode(node) { this.#thumbNode = node; }
	getThumbNode() { return this.#thumbNode; }

	/** @param { number } radius */ setCornerRadius(radius) { this.#cornerRadius = radius; }
	getCornerRadius() { return this.#cornerRadius; }

	/** @param { string } direction */ setDirection(direction) { this.#direction = direction; }
	getDirection() { return this.#direction; }

	//==============================================================================
	// 콜백 / 인터랙션.
	//==============================================================================
	/** @param { (slider: UISlider) => void } callback */
	setValueChangedEvent(callback) { this.#valueChangedEvent = callback; }
	getValueChangedEvent() { return this.#valueChangedEvent; }

	/** @param { boolean } isInteractable */
	setInteractable(isInteractable) { this.#isInteractable = isInteractable; }
	getInteractable() { return this.#isInteractable; }

	/** @returns { boolean } */
	isDragging() { return this.#isDragging; }
}
