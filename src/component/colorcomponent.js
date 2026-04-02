//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Color } from "../base/color.js";
import { Rect } from "../base/rect.js";
import { Graphic } from "../core/graphic.js";
import { Component } from "../core/component.js";


//==============================================================================
// 내용의 색상과 투명도를 결정하는 컴포넌트.
//==============================================================================
export class ColorComponent extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Color } */ #color; // 컬러.
	/** @private @type { number } */ #roundSize; // 라운드 사이즈.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @construct
	 */
	constructor() {
		super();
		this.#color = Color.white();
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

		const canvasRenderingContext = graphic.getCanvasRenderingContext();
		const node = this.getNode();
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
	 * @param { Color | string | CanvasGradient | CanvasPattern } other
	 */
	setColor(other) {
		if (other === null || other === undefined) {
			this.#color = Color.transparent();
		}
		else if (typeof other === "string") {
			if (other.startsWith("#")) {
				this.#color = Color.createFromHEX(other);
			}
			else if (other.startsWith("rgb")) {
				this.#color = Color.createFromRGBA(other);
			}
		}
		else if (other instanceof Color) {
			this.#color = other;
		}
	}

	//==============================================================================
	// 색상 반환.
	//==============================================================================
	/**
	 * @returns { Color } 
	 */
	getColor() {
		return this.#color;
	}
}