//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Color } from "../../base/color.js";
import { Rect } from "../../base/rect.js";
import { Vector2 } from "../../base/vector2.js";
import { SYSTEM_FONT_STRING } from "../../base/platform.js";
import { Component } from "../component.js";
import { Graphic } from "../graphic.js";
import { FontAsset } from "../../resource/fontasset.js";


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
// 측정용 오프스크린 캔버스 컨텍스트. (intrinsic content size 계산 / 정렬 계산용)
//==============================================================================
let measurementCanvasRenderingContext = null;

//==============================================================================
// 측정 컨텍스트 반환. document 가 없는 환경에서는 null.
//==============================================================================
/**
 * @returns { CanvasRenderingContext2D | null }
 */
export function getMeasurementCanvasRenderingContext() {
	if (measurementCanvasRenderingContext === null) {
		const document = System.document;
		if (document === null || document === undefined) {
			return null;
		}
		const canvas = document.createElement("canvas");
		measurementCanvasRenderingContext = canvas.getContext("2d");
	}
	return measurementCanvasRenderingContext;
}


//==============================================================================
// 폰트 문자열 합성 (canvas font property 형식).
//==============================================================================
/**
 * @param { FontFace | null } fontFace
 * @param { number } fontSize
 * @param { boolean } bold
 * @param { boolean } italic
 * @returns { string }
 */
export function buildFontString(fontFace, fontSize, bold, italic) {
	const fontFamily = fontFace ? fontFace.family : SYSTEM_FONT_STRING;
	const styleParts = [];
	if (italic) {
		styleParts.push("italic");
	}
	if (bold) {
		styleParts.push("bold");
	}
	styleParts.push(`${fontSize}px`);
	styleParts.push(fontFamily);
	return styleParts.join(" ");
}


//==============================================================================
// 원시(plain) 텍스트 출력기 컴포넌트.
// - 단일 폰트 / 단일 크기 / 단일 색상으로 텍스트를 1 라인 그리는 컴포넌트.
// - 볼드 / 이탤릭 / 밑줄 / 취소선은 텍스트 전체에 일괄 적용된다.
// - 마크업 태그는 해석하지 않는다 (그대로 출력).
//   리치텍스트 (마크업 + segment 별 스타일) 가 필요하면 RichText 컴포넌트를 사용.
// - 비활성화 상태 (isEnable() === false) 면 draw / 측정에서 건너뛴다.
//==============================================================================
export class Text extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { FontFace } */ #fontFace;
	/** @private @type { string } */ #text;
	/** @private @type { number } */ #fontSize;
	/** @private @type { Color } */ #textColor;
	/** @private @type { Color } */ #strokeColor;
	/** @private @type { number } */ #strokeWidth;
	/** @private @type { boolean } */ #bold;
	/** @private @type { boolean } */ #italic;
	/** @private @type { boolean } */ #underline;
	/** @private @type { boolean } */ #strikethrough;
	/** @private @type { string } */ #textAlign;
	/** @private @type { string } */ #textBaseline;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setComponentType("Text");
		this.#fontFace = null;
		this.#text = "";
		this.#fontSize = 32;
		this.#textColor = Color.white();
		this.#strokeColor = Color.white();
		this.#strokeWidth = 0;
		this.#bold = false;
		this.#italic = false;
		this.#underline = false;
		this.#strikethrough = false;
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
	// 출력. (비활성화면 건너뜀)
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic
	 */
	draw(graphic) {
		if (this.isEnable() === false) {
			return;
		}
		const text = this.getText();
		if (!text) {
			return;
		}
		const node = this.getNode();
		const contentSize = node.getContentSize();
		this.drawPlainText(graphic, contentSize, text);
	}

	//==============================================================================
	// 일반 텍스트 그리기.
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 * @param { Vector2 } contentSize
	 * @param { string } text
	 */
	drawPlainText(graphic, contentSize, text) {
		let drawX;
		if (this.#textAlign === "left" || this.#textAlign === "start") {
			drawX = 0;
		}
		else if (this.#textAlign === "right" || this.#textAlign === "end") {
			drawX = contentSize.x;
		}
		else {
			drawX = contentSize.x * 0.5;
		}

		let drawY;
		if (this.#textBaseline === "top" || this.#textBaseline === "hanging") {
			drawY = 0;
		}
		else if (this.#textBaseline === "bottom" || this.#textBaseline === "ideographic" || this.#textBaseline === "alphabetic") {
			drawY = contentSize.y;
		}
		else {
			drawY = contentSize.y * 0.5;
		}

		graphic.setFontString(buildFontString(this.#fontFace, this.#fontSize, this.#bold, this.#italic));
		graphic.setTextAlign(this.#textAlign);
		graphic.setTextBaseline(this.#textBaseline);

		const strokeColor = this.getStrokeColor();
		if (strokeColor && this.#strokeWidth > 0) {
			graphic.setStrokeColor(strokeColor.toHEXString());
			graphic.drawStrokeText(text, drawX, drawY, this.#strokeWidth);
		}

		const textColor = this.getTextColor();
		graphic.setFillColor(textColor.toHEXString());
		graphic.drawFillText(text, drawX, drawY);

		if (this.#underline || this.#strikethrough) {
			const textWidth = this.measurePlainTextWidth(text);
			const startX = this.computeUnderlineStartX(drawX, textWidth);
			const fontSize = this.#fontSize;
			graphic.setStrokeColor(textColor.toHEXString());
			const lineWidth = System.Math.max(1, fontSize / 16);
			if (this.#underline) {
				const underlineY = drawY + this.computeUnderlineOffsetY(fontSize);
				this.strokeHorizontalLine(graphic, startX, underlineY, textWidth, lineWidth);
			}
			if (this.#strikethrough) {
				const strikeY = drawY + this.computeStrikethroughOffsetY(fontSize);
				this.strokeHorizontalLine(graphic, startX, strikeY, textWidth, lineWidth);
			}
		}
	}

	//==============================================================================
	// 일반 텍스트의 픽셀 너비 측정. (오프스크린 컨텍스트 사용)
	//==============================================================================
	/**
	 * @param { string } text
	 * @returns { number }
	 */
	measurePlainTextWidth(text) {
		const measurementContext = getMeasurementCanvasRenderingContext();
		if (measurementContext === null) {
			return 0;
		}
		measurementContext.save();
		measurementContext.font = buildFontString(this.#fontFace, this.#fontSize, this.#bold, this.#italic);
		const width = measurementContext.measureText(text).width;
		measurementContext.restore();
		return width;
	}

	//==============================================================================
	// 밑줄 시작 X 좌표 계산. (textAlign 기준 캔버스 fillText 의 cursor 위치 보정)
	//==============================================================================
	/**
	 * @param { number } drawX
	 * @param { number } textWidth
	 * @returns { number }
	 */
	computeUnderlineStartX(drawX, textWidth) {
		if (this.#textAlign === "left" || this.#textAlign === "start") {
			return drawX;
		}
		if (this.#textAlign === "right" || this.#textAlign === "end") {
			return drawX - textWidth;
		}
		return drawX - textWidth * 0.5;
	}

	//==============================================================================
	// 밑줄 Y 오프셋. (baseline 기준 텍스트 아래쪽으로의 거리)
	//==============================================================================
	/**
	 * @param { number } fontSize
	 * @returns { number }
	 */
	computeUnderlineOffsetY(fontSize) {
		if (this.#textBaseline === "top" || this.#textBaseline === "hanging") {
			return fontSize + 2;
		}
		if (this.#textBaseline === "middle") {
			return fontSize * 0.5 + 2;
		}
		return 4;
	}

	//==============================================================================
	// 취소선 Y 오프셋.
	//==============================================================================
	/**
	 * @param { number } fontSize
	 * @returns { number }
	 */
	computeStrikethroughOffsetY(fontSize) {
		if (this.#textBaseline === "top" || this.#textBaseline === "hanging") {
			return fontSize * 0.55;
		}
		if (this.#textBaseline === "middle") {
			return 0;
		}
		return -fontSize * 0.35;
	}

	//==============================================================================
	// 가로 라인 stroke.
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 * @param { number } x
	 * @param { number } y
	 * @param { number } width
	 * @param { number } lineWidth
	 */
	strokeHorizontalLine(graphic, x, y, width, lineWidth = 1) {
		graphic.drawLine([
			Vector2.create(x, y),
			Vector2.create(x + width, y),
		], lineWidth);
	}

	//==============================================================================
	// 텍스트의 자연 크기 반환. (UIKit 의 intrinsicContentSize 와 동일 사상)
	// - 비활성화 상태면 (-1, -1) 반환 (가이드 영향 없음).
	// - 측정 불가 (document 없음 등) 면 (-1, -1).
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getIntrinsicContentSize() {
		if (this.isEnable() === false) {
			return Vector2.create(-1, -1);
		}
		const measurementContext = getMeasurementCanvasRenderingContext();
		if (measurementContext === null) {
			return Vector2.create(-1, -1);
		}
		const text = this.#text;
		if (!text || text.length === 0) {
			return Vector2.create(0, this.#fontSize);
		}
		measurementContext.save();
		measurementContext.font = buildFontString(this.#fontFace, this.#fontSize, this.#bold, this.#italic);
		const width = measurementContext.measureText(text).width;
		measurementContext.restore();
		return Vector2.create(width, this.#fontSize);
	}

	//==============================================================================
	// 폰트 설정.
	//==============================================================================
	/**
	 * @param { FontFace | FontAsset } font
	 */
	setFont(font) {
		if (font === null || font === undefined) {
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
		if (color === null || color === undefined) {
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
		if (color === null || color === undefined) {
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
	// 외곽선 두께 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getStrokeWidth() {
		return this.#strokeWidth;
	}

	//==============================================================================
	// 볼드 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } bold
	 */
	setBold(bold) {
		this.#bold = bold === true;
	}

	//==============================================================================
	// 볼드 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isBold() {
		return this.#bold;
	}

	//==============================================================================
	// 이탤릭 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } italic
	 */
	setItalic(italic) {
		this.#italic = italic === true;
	}

	//==============================================================================
	// 이탤릭 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isItalic() {
		return this.#italic;
	}

	//==============================================================================
	// 밑줄 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } underline
	 */
	setUnderline(underline) {
		this.#underline = underline === true;
	}

	//==============================================================================
	// 밑줄 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isUnderline() {
		return this.#underline;
	}

	//==============================================================================
	// 취소선 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } strikethrough
	 */
	setStrikethrough(strikethrough) {
		this.#strikethrough = strikethrough === true;
	}

	//==============================================================================
	// 취소선 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isStrikethrough() {
		return this.#strikethrough;
	}

	//==============================================================================
	// 폰트 가로 정렬 설정.
	//==============================================================================
	/**
	 * @param { "left" | "center" | "right" | "start" | "end" } align
	 */
	setTextAlign(align) {
		this.#textAlign = align;
	}

	//==============================================================================
	// 폰트 가로 정렬 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getTextAlign() {
		return this.#textAlign;
	}

	//==============================================================================
	// 폰트 세로 정렬 설정.
	//==============================================================================
	/**
	 * @param { "top" | "middle" | "bottom" | "alphabetic" | "hanging" | "ideographic" } baseline
	 */
	setTextBaseline(baseline) {
		this.#textBaseline = baseline;
	}

	//==============================================================================
	// 폰트 세로 정렬 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getTextBaseline() {
		return this.#textBaseline;
	}

	//==============================================================================
	// 텍스트가 출력되는 영역을 Rect로 반환. (호환용)
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 * @param { Text } textComponent
	 * @returns { Rect }
	 */
	static calculateTextBounds(graphic, textComponent) {
		const fontFace = textComponent.getFontFace();
		const fontSize = textComponent.getFontSize();
		const text = textComponent.getText();

		const measurementContext = getMeasurementCanvasRenderingContext();
		if (measurementContext === null) {
			return Rect.create(0, 0, 0, 0);
		}
		measurementContext.save();
		measurementContext.font = buildFontString(fontFace, fontSize, false, false);

		const metrics = measurementContext.measureText(text);
		const width = metrics.width;
		const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

		measurementContext.restore();

		return Rect.create(0, 0, width, height);
	}
}
