// //==============================================================================
// // 포함 모듈 목록.
// //==============================================================================
// import { Vector2 } from "../base/vector2.js";
// import { Graphic } from "../core/graphic.js";
// import { AnchoredTransformNode } from "./anchoredtransformnode.js";
// import { FontAsset } from "../resource/fontasset.js";


// //==============================================================================
// // UI 레이블.
// //==============================================================================
// export class UILabel extends AnchoredTransformNode {
// 	//==============================================================================
// 	// 멤버 변수 목록.
// 	//==============================================================================
// 	/** @private @type { FontFace } */ #fontFace;
// 	/** @private @type { string } */ #text = "";
// 	/** @private @type { number } */ #fontSize = 32;
// 	/** @private @type { string } */ #textColor = "black";
// 	/** @private @type { string } */ #strokeColor = null;
// 	/** @private @type { number } */ #strokeWidth = 0;
// 	/** @private @type { "left" | "center" | "right" } */ #textAlign = "center";
// 	/** @private @type { "top" | "middle" | "bottom" } */ #textBaseline = "middle";

// 	//==============================================================================
// 	// 생성.
// 	//==============================================================================
// 	constructor() {
// 		super();
// 		this.#fontFace = null;
// 		this.#text = "";
// 		this.#fontSize = 32;
// 		this.#textColor = "black";
// 		this.#strokeColor = null;
// 		this.#strokeWidth = 0;
// 		this.#textAlign = "center";
// 		this.#textBaseline = "middle";
// 	}

// 	//==============================================================================
// 	// 갱신.
// 	//==============================================================================
// 	/**
// 	 * @override
// 	 * @param { number } timeDelta 
// 	 */
// 	tick(timeDelta) {
// 		super.tick(timeDelta);
// 	}

// 	//==============================================================================
// 	// 출력.
// 	//==============================================================================
// 	/**
// 	 * @override
// 	 * @param { Graphic } graphic 
// 	 */
// 	draw(graphic) {
// 		// super.draw(graphic);

// 		if (!this.#text) {
// 			return;
// 		}

// 		const canvasRenderingContext = graphic.getCanvasRenderingContext();
// 		const fontFamily = this.#fontFace ? this.#fontFace.family : '-apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
// 		canvasRenderingContext.font = `${this.#fontSize}px ${fontFamily}`;
// 		canvasRenderingContext.textAlign = this.#textAlign;
// 		canvasRenderingContext.textBaseline = this.#textBaseline;

// 		// const contentSize = this.getContentSize();
// 		const pivotPosition = this.calculatePivotPosition();

// 		if (this.#strokeColor && this.#strokeWidth > 0) {
// 			canvasRenderingContext.strokeStyle = this.#strokeColor;
// 			canvasRenderingContext.lineWidth = this.#strokeWidth;
// 			canvasRenderingContext.strokeText(this.#text, pivotPosition.x, pivotPosition.y);
// 		}

// 		canvasRenderingContext.fillStyle = this.#textColor;
// 		canvasRenderingContext.fillText(this.#text, pivotPosition.x, pivotPosition.y);
// 	}

// 	//==============================================================================
// 	// 폰트 설정.
// 	//==============================================================================
// 	/**
// 	 * @param { FontFace | FontAsset } font 
// 	 */
// 	setFont(font) {
// 		if (font === null || font === undefined) {
// 			this.#fontFace = null;
// 		}
// 		else if (font instanceof FontFace) {
// 			this.#fontFace = font;
// 		}
// 		else if (font instanceof FontAsset) {
// 			this.#fontFace = font.fontFace;
// 		}
// 	}

// 	//==============================================================================
// 	// 폰트 반환.
// 	//==============================================================================
// 	/**
// 	 * @returns { FontFace } 
// 	 */
// 	getFont() {
// 		return this.#fontFace
// 	}

// 	//==============================================================================
// 	// 텍스트 설정.
// 	//==============================================================================
// 	/**
// 	 * @param { string } text
// 	 */
// 	setText(text) {
// 		this.#text = text;
// 	}

// 	/**
// 	 * @param { number } size
// 	 */
// 	setFontSize(size) {
// 		this.#fontSize = size;
// 	}

// 	/**
// 	 * @param { string } color
// 	 */
// 	setTextColor(color) {
// 		this.#textColor = color;
// 	}
	
// 	/**
// 	 * @param { string } color
// 	 */
// 	setStrokeColor(color) {
// 		this.#strokeColor = color;
// 	}

// 	/**
// 	 * @param { number } width
// 	 */
// 	setStrokeWidth(width) {
// 		this.#strokeWidth = width;
// 	}

// 	/**
// 	 * @param { "left" | "center" | "right" } align
// 	 */
// 	setTextAlign(align) {
// 		this.#textAlign = align;
// 	}

// 	/**
// 	 * @param { "top" | "middle" | "bottom" } baseline
// 	 */
// 	setTextBaseline(baseline) {
// 		this.#textBaseline = baseline;
// 	}
// }