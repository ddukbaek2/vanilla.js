//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VVector2 } from "../base/vector2.js";
import { VRenderer } from "../core/renderer.js";
import { UINode } from "./uinode.js";
import { VFontAsset } from "../resource/fontasset.js";


//==============================================================================
// UI 레이블.
//==============================================================================
export class UILabel extends UINode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { FontFace } */ #font;
	/** @private @type { string } */ #text = "";
	/** @private @type { number } */ #fontSize = 32;
	/** @private @type { string } */ #textColor = "black";
	/** @private @type { string } */ #strokeColor = null;
	/** @private @type { number } */ #strokeWidth = 0;
	/** @private @type { "left" | "center" | "right" } */ #textAlign = "center";
	/** @private @type { "top" | "middle" | "bottom" } */ #textBaseline = "middle";

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.#font = null;
		this.#text = "";
		this.#fontSize = 32;
		this.#textColor = "black";
		this.#strokeColor = null;
		this.#strokeWidth = 0;
		this.#textAlign = "center";
		this.#textBaseline = "middle";
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
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @override
	 * @param { VRenderer } renderer 
	 */
	draw(renderer) {
		super.draw(renderer);

		if (!this.#text) {
			return;
		}

		const canvasContext = renderer.getCanvasContext();
		
		const fontFamily = this.#font ? this.#font.family : '-apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
		canvasContext.font = `${this.#fontSize}px ${fontFamily}`;
		canvasContext.textAlign = this.#textAlign;
		canvasContext.textBaseline = this.#textBaseline;

		if (this.#strokeColor && this.#strokeWidth > 0) {
			canvasContext.strokeStyle = this.#strokeColor;
			canvasContext.lineWidth = this.#strokeWidth;
			canvasContext.strokeText(this.#text, 0, 0);
		}

		canvasContext.fillStyle = this.#textColor;
		canvasContext.fillText(this.#text, 0, 0);
	}

	//==============================================================================
	// 폰트 설정.
	//==============================================================================
	/**
	 * @param { FontFace | VFontAsset } font 
	 */
	setFont(font) {
		if (font === null) {
			this.#font = null;
		}
		else if (font instanceof FontFace) {
			this.#font = font;
		}
		else if (font instanceof VFontAsset) {
			this.#font = font.fontFace;
		}
	}

	//==============================================================================
	// 폰트 반환.
	//==============================================================================
	/**
	 * @returns { FontFace } 
	 */
	getFont() {
		return this.#font
	}

	//==============================================================================
	// 텍스트 설정.
	//==============================================================================
	/**
	 * @param { string } text
	 */
	setText(text) {
		this.#text = text;
	}

	/**
	 * @param { number } size
	 */
	setFontSize(size) {
		this.#fontSize = size;
	}

	/**
	 * @param { string } color
	 */
	setTextColor(color) {
		this.#textColor = color;
	}
	
	/**
	 * @param { string } color
	 */
	setStrokeColor(color) {
		this.#strokeColor = color;
	}

	/**
	 * @param { number } width
	 */
	setStrokeWidth(width) {
		this.#strokeWidth = width;
	}

	/**
	 * @param { "left" | "center" | "right" } align
	 */
	setTextAlign(align) {
		this.#textAlign = align;
	}

	/**
	 * @param { "top" | "middle" | "bottom" } baseline
	 */
	setTextBaseline(baseline) {
		this.#textBaseline = baseline;
	}
}