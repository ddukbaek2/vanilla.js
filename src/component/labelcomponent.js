//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Rect } from "../base/rect.js";
import { Graphic } from "../core/graphic.js";
import { Component } from "../core/component.js";
import { FontAsset } from "../resource/fontasset.js";
import { Color } from "../base/color.js";
import { SYSTEM_FONT_STRING } from "../base/platform.js";


//==============================================================================
// 텍스트 수평 설정. (CanvasTextAlign)
//==============================================================================
export const TextAlign = {
	left: "left",
	center: "center",
	right: "right",
	start: "start",
	end: "end",
};


//==============================================================================
// 텍스트 수직 설정. (CanvasTextBaseline)
//==============================================================================
export const TextBaseline = {
	top: "top",
	middle: "middle",
	bottom: "bottom",
	ideographic: "ideographic",
	hanging: "hanging",
	alphabetic: "alphabetic",
};


//==============================================================================
// 텍스트 출력기 컴포넌트.
//==============================================================================
export class LabelComponent extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { FontFace } */ #fontFace;
	/** @private @type { string } */ #text;
	/** @private @type { number } */ #fontSize;
	/** @private @type { Color } */ #textColor;
	/** @private @type { Color } */ #strokeColor;
	/** @private @type { number } */ #strokeWidth;
	/** @private @type { "left" | "center" | "right" } */ #textAlign; // TextAlign
	/** @private @type { "top" | "middle" | "bottom" } */ #textBaseline; // TextBaseline
	// /** @private @type { boolean } */ #autoExpandContentSize;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.#fontFace = null;
		this.#text = "";
		this.#fontSize = 32;
		this.#textColor = Color.white();
		this.#strokeColor = Color.white();
		this.#strokeWidth = 0;
		this.#textAlign = "center";
		this.#textBaseline = "middle";
		// this.#autoExpandContentSize = true;
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
	 * @param { Graphic } graphic 
	 */
	draw(graphic) {
		if (!this.#text) {
			return;
		}

		const node = this.getNode();
		const contentSize = node.getContentSize();

		let drawX;
		if (this.#textAlign === "left" || this.#textAlign === "start") drawX = 0;
		else if (this.#textAlign === "right" || this.#textAlign === "end") drawX = contentSize.x;
		else drawX = contentSize.x * 0.5;

		let drawY;
		if (this.#textBaseline === "top" || this.#textBaseline === "hanging") drawY = 0;
		else if (this.#textBaseline === "bottom" || this.#textBaseline === "ideographic" || this.#textBaseline === "alphabetic") drawY = contentSize.y;
		else drawY = contentSize.y * 0.5;

		const canvasRenderingContext = graphic.getCanvasRenderingContext();
		const fontFamily = this.#fontFace ? this.#fontFace.family : SYSTEM_FONT_STRING;
		canvasRenderingContext.font = `${this.#fontSize}px ${fontFamily}`;
		canvasRenderingContext.textAlign = this.#textAlign;
		canvasRenderingContext.textBaseline = this.#textBaseline;

		if (this.#strokeColor && this.#strokeWidth > 0) {
			canvasRenderingContext.strokeStyle = this.#strokeColor;
			canvasRenderingContext.lineWidth = this.#strokeWidth;
			canvasRenderingContext.strokeText(this.#text, drawX, drawY);
		}

		const textColor = this.getTextColor();
		const textColorString = textColor.toHEXString();
		canvasRenderingContext.fillStyle = textColorString;
		canvasRenderingContext.fillText(this.#text, drawX, drawY);
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
	 * @param { number } fontSize
	 */
	setFontSize(fontSize) {
		this.#fontSize = fontSize;
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
	 * @param { Color | string | CanvasGradient | CanvasPattern } color
	 */
	setTextColor(color) {
		if (color === null) {
			this.#textColor = Color.transparent();
		}
		else if (typeof color === "string") {
			if (color.startsWith("#")) {
				this.#textColor = Color.createFromHEX(color);
			}
			else if (color.startsWith("rgb")) {
				this.#textColor = Color.createFromRGBA(color);
			}
		}
		else if (color instanceof Color) {
			this.#textColor = color;
		}
	}
	
	//==============================================================================
	// 텍스트 색상 반환.
	//==============================================================================
	/**
	 * @returns { Color }
	 */
	getTextColor() {
		return this.#textColor;
	}

	//==============================================================================
	// 텍스트 외곽선 색상 설정.
	//==============================================================================
	/**
	 * @param { Color | string | CanvasGradient | CanvasPattern } color
	 */
	setStrokeColor(color) {
		if (color === null) {
			this.#strokeColor = Color.transparent();
		}
		else if (typeof color === "string") {
			if (color.startsWith("#")) {
				this.#strokeColor = Color.createFromHEX(color);
			}
			else if (color.startsWith("rgb")) {
				this.#strokeColor = Color.createFromRGBA(color);
			}
		}
		else if (color instanceof Color) {
			this.#strokeColor = color;
		}
	}

	//==============================================================================
	// 텍스트 외곽선 색상 반환.
	//==============================================================================
	/**
	 * @returns { Color }
	 */
	getStrokeColor() {
		return this.#strokeColor;
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
	 * @param { Graphic } graphic
	 * @param { LabelComponent } textDrawerComponent
	 * @param { string } text
	 * @param { string } font
	 * @returns { Rect }
	 */
	static calculateTextBounds(graphic, textDrawerComponent) {
		const fontFace = textDrawerComponent.getFontFace();
		const fontSize = textDrawerComponent.getFontSize();
		const text = textDrawerComponent.getText();

		const canvasRenderingContext = graphic.getCanvasRenderingContext();
		canvasRenderingContext.save();
		const fontFamily = fontFace ? fontFace.family : '-apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
		canvasRenderingContext.font = `${fontSize}px ${fontFamily}`;

		const metrics = canvasRenderingContext.measureText(text);
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
		canvasRenderingContext.restore();

		return Rect.create(x, y, scaledWidth, scaledHeight);
	}
}