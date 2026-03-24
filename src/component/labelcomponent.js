//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Vector2 } from "../base/vector2.js";
import { Rect } from "../base/rect.js";
import { Renderer } from "../core/renderer.js";
import { Component } from "../core/component.js";
import { FontAsset } from "../resource/fontasset.js";


//==============================================================================
// 텍스트 출력자 컴포넌트.
//==============================================================================
export class LabelComponent extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { FontFace } */ #fontFace;
	/** @private @type { string } */ #text;
	/** @private @type { number } */ #fontSize;
	/** @private @type { string } */ #textColor;
	/** @private @type { string } */ #strokeColor;
	/** @private @type { number } */ #strokeWidth;
	/** @private @type { "left" | "center" | "right" } */ #textAlign;
	/** @private @type { "top" | "middle" | "bottom" } */ #textBaseline;


	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.#fontFace = null;
		this.#text = "";
		this.#fontSize = 32;
		this.#textColor = "#000000";
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
	tick(timeDelta) {
		super.tick(timeDelta);
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @override
	 * @param { Renderer } renderer 
	 */
	draw(renderer) {
		if (!this.#text) {
			return;
		}

		const canvasContext = renderer.getCanvasContext();
		const fontFamily = this.#fontFace ? this.#fontFace.family : '-apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
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
	 * @param { FontFace | FontAsset } font 
	 */
	setFont(font) {
		if (font === null) {
			this.#fontFace = null;
		}
		else if (font instanceof FontFace) {
			this.#fontFace = font;
		}
		else if (font instanceof FontAsset) {
			this.#fontFace = font.fontFace;
		}
	}

	//==============================================================================
	// 폰트 반환.
	//==============================================================================
	/**
	 * @returns { FontFace } 
	 */
	getFontFace() {
		return this.#fontFace;
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

	//==============================================================================
	// 텍스트 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getText() {
		return this.#text;
	}

	//==============================================================================
	// 텍스트 크기 설정.
	//==============================================================================
	/**
	 * @param { number } size
	 */
	setFontSize(size) {
		this.#fontSize = size;
	}

	//==============================================================================
	// 텍스트 크기 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getFontSize() {
		return this.#fontSize;
	}

	//==============================================================================
	// 텍스트 색상 설정.
	//==============================================================================
	/**
	 * @param { string } color
	 */
	setTextColor(color) {
		this.#textColor = color;
	}
	
	//==============================================================================
	// 텍스트 색상 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getTextColor() {
		return this.#textColor;
	}

	//==============================================================================
	// 텍스트 외곽선 색상 설정.
	//==============================================================================
	/**
	 * @param { string } color
	 */
	setStrokeColor(color) {
		this.#strokeColor = color;
	}

	//==============================================================================
	// 텍스트 외곽선 두께 설정.
	//==============================================================================
	/**
	 * @param { number } width
	 */
	setStrokeWidth(width) {
		this.#strokeWidth = width;
	}

	//==============================================================================
	// 폰트 가로 정렬 설정.
	//==============================================================================
	/**
	 * @param { "left" | "center" | "right" } align
	 */
	setTextAlign(align) {
		this.#textAlign = align;
	}
	//==============================================================================
	// 폰트 세로 정렬 설정.
	//==============================================================================
	/**
	 * @param { "top" | "middle" | "bottom" } baseline
	 */
	setTextBaseline(baseline) {
		this.#textBaseline = baseline;
	}

	//==============================================================================
	// 텍스트가 출력되는 영역을 Rect로 반환.
	//==============================================================================
	/**
	 * @param { Renderer } renderer
	 * @param { LabelComponent } textDrawerComponent
	 * @param { string } text
	 * @param { string } font
	 * @returns { Rect }
	 */
	static calculateTextBounds(renderer, textDrawerComponent) {
		const fontFace = textDrawerComponent.getFontFace();
		const fontSize = textDrawerComponent.getFontSize();
		const text = textDrawerComponent.getText();

		const canvasContext = renderer.getCanvasContext();
		canvasContext.save();
		const fontFamily = fontFace ? fontFace.family : '-apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
		canvasContext.font = `${fontSize}px ${fontFamily}`;

		const metrics = canvasContext.measureText(text);
		const width = metrics.width;
		const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

		const position = this.getPosition();
		const pivot = this.getPivot();
		const scale = this.getScale();

		// 피봇과 스케일이 적용된 크기 계산.
		const scaledWidth = width * Math.abs(scale.x);
		const scaledHeight = height * Math.abs(scale.y);

		// 좌상단 좌표 계산.
		// const x = position.x - (scaledWidth * pivot.x);
		// const y = position.y - (scaledHeight * pivot.y);
		const x = position.x - scaledWidth;
		const y = position.y - scaledHeight;
		canvasContext.restore();

		return Rect.create(x, y, scaledWidth, scaledHeight);
	}
}