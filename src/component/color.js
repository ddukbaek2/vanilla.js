//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Color as ColorValue } from "../base/color.js";
import { Rect } from "../base/rect.js";
import { Graphic } from "../core/graphic.js";
import { Component } from "../core/component.js";
import { TransformNode } from "../core/node/transformnode.js";


//==============================================================================
// 내용의 색상과 투명도를 결정하는 컴포넌트.
//==============================================================================
export class Color extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { ColorValue } */ #color; // 컬러.
	/** @private @type { number } */ #roundSize; // 라운드 사이즈.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @construct
	 */
	constructor() {
		super();
		this.componentType = 'Color';
		this.#color = ColorValue.white();
		this.#roundSize = 0;
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 */
	draw(graphic) {
		// super.draw(graphic);
		const node = this.getNode();

		// Component.draw()를 호출하는 쪽은 TransformNode이므로 신뢰하고 사용.
		// if (node instanceof TransformNode)
		const contentSize = node.getContentSize();
		const color = this.getColor();
		const rect = Rect.create(0, 0, contentSize.x, contentSize.y);

		// 출력.
		graphic.setFillColor(color);
		if (this.#roundSize > 0) {
			graphic.drawRoundRect(rect, this.#roundSize);
		}
		else {
			graphic.drawRect(rect);
		}
	}

	//==============================================================================
	// 색상 설정.
	//==============================================================================
	/**
	 * @param { ColorValue | string | CanvasGradient | CanvasPattern } other
	 */
	setColor(other) {
		if (other === null || other === undefined) {
			this.#color = ColorValue.transparent();
		}
		else if (typeof other === "string") {
			if (other.startsWith("#")) {
				this.#color = ColorValue.createFromHEX(other);
			}
			else if (other.startsWith("rgb")) {
				this.#color = ColorValue.createFromRGBA(other);
			}
		}
		else if (other instanceof ColorValue) {
			this.#color = other;
		}
	}

	//==============================================================================
	// 색상 반환.
	//==============================================================================
	/**
	 * @returns { ColorValue }
	 */
	getColor() {
		return this.#color;
	}

	//==============================================================================
	// 라운드 크기 설정.
	//==============================================================================
	/**
	 * @param { number } roundSize
	 */
	setRoundSize(roundSize) {
		this.#roundSize = roundSize;
	}
}
