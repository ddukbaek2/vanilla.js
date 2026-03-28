//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Color } from "../base/color.js";
import { Renderer } from "../core/renderer.js";
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
	 * @param { Renderer } renderer 
	 */
	draw(renderer) {
		// super.draw(renderer);

		const canvasContext = renderer.getCanvasContext();
		const node = this.getNode();
		if (!node) return;

		// 출력.
		// 피봇 위치 반영 - 기본 (0, 0) 에서 피봇만큼 좌상 방향으로 당겨준다. 
		const pivotPosition = node.getPivotPosition();
		const size = node.getContentSize();
		const color = this.getColor();
		canvasContext.fillStyle = color.toHEXString();
		canvasContext.fillRect(pivotPosition.x, pivotPosition.y, size.x, size.y);
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