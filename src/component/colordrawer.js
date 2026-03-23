//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VColor } from "../base/color.js";
import { VRenderer } from "../core/renderer.js";
import { VBoundsComponent } from "./bounds.js";


//==============================================================================
// 내용의 색상과 투명도를 결정하는 컴포넌트.
//==============================================================================
export class VColorDrawerComponent extends VBoundsComponent {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { VColor } */ #color; // 컬러.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @construct
	 */
	constructor() {
		super();
		this.#color = VColor.white();
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { VRenderer } renderer 
	 */
	draw(renderer) {
		// super.draw(renderer);

		const canvasContext = renderer.getCanvasContext();

		// 출력.
		// 피봇 위치 반영 - 기본 (0, 0) 에서 피봇만큼 좌상 방향으로 당겨준다. 
		const pivotPosition = super.getPivotPosition();
		const color = this.getColor();
		canvasContext.fillStyle = color.toHEXString();
		canvasContext.fillRect(pivotPosition.x, pivotPosition.y, contentSize.x, contentSize.y);
	}

	//==============================================================================
	// 색상 설정.
	//==============================================================================
	/**
	 * @param { string | VColor } other
	 */
	setColor(other) {
		if (other === null) {
			this.#color = VColor.transparent();
		}
		else if (typeof other === "string") {
			if (other.startsWith("#")) {
				this.#color = VColor.createFromHEX(colorString);
			}
			else if (other.startsWith("rgb")) {
				this.#color = VColor.createFromRGBA(colorString);
			}
		}
		else if (other instanceof VColor) {
			this.#color = other;
		}
	}

	//==============================================================================
	// 색상 반환.
	//==============================================================================
	/**
	 * @returns { VColor } 
	 */
	getColor() {
		return this.#color;
	}
}