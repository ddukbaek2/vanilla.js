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

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @construct
	 */
	constructor() {
		super();
		this.#color = Color.white();
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Graphic } graphic 
	 */
	draw(graphic) {
		// super.draw(graphic);

		const canvasContext = graphic.getCanvasContext();
		const node = this.getNode();
		if (!node) return;

		// 출력.
		const contentSize = node.getContentSize();
		const color = this.getColor();
		const colorString = color.toHEXString();
		canvasContext.fillStyle = colorString;
		graphic.drawRect(Rect.create(0, 0, contentSize.x, contentSize.y));
	}

	//==============================================================================
	// 색상 설정.
	//==============================================================================
	/**
	 * @param { string | Color } other
	 */
	setColor(other) {
		if (other === null) {
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