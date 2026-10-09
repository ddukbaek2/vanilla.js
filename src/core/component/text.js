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
// 글자 묶음과 단어로 나누기. (줄바꿈 용, Intl.Segmenter 가 있으면 쓴다)
// - 글자 묶음(grapheme): 받침, 성조, 결합 부호가 앞 글자에서 떨어지지 않는다. 없으면 코드 포인트 단위.
// - 단어: 태국어, 라오어, 크메르어, 버마어, 한중일처럼 공백 없이 쓰는 글자도 단어 사이를 찾는다.
//   문장 부호처럼 단어가 아닌 조각은 앞 단어에 붙인다. (줄 맨 앞에 문장 부호가 오지 않게) 없으면 통째로 한 조각.
//==============================================================================
let graphemeSegmenter = null;
let wordSegmenter = null;

/**
 * @param { string } text
 * @returns { string[] }
 */
export function splitGraphemes(text) {
	if (graphemeSegmenter === null && System.Intl && typeof System.Intl.Segmenter === "function") {
		graphemeSegmenter = new System.Intl.Segmenter(undefined, { granularity: "grapheme" });
	}
	if (graphemeSegmenter === null) {
		return System.Array.from(text);
	}
	const pieces = [];
	for (const segmentData of graphemeSegmenter.segment(text)) {
		pieces.push(segmentData.segment);
	}
	return pieces;
}

/**
 * @param { string } text
 * @returns { string[] } 단어마다 한 조각. (단어가 아닌 조각은 앞 단어에 붙인다)
 */
export function splitWords(text) {
	if (wordSegmenter === null && System.Intl && typeof System.Intl.Segmenter === "function") {
		wordSegmenter = new System.Intl.Segmenter(undefined, { granularity: "word" });
	}
	if (wordSegmenter === null) {
		return [text];
	}
	const pieces = [];
	let pendingPrefix = "";
	for (const segmentData of wordSegmenter.segment(text)) {
		if (segmentData.isWordLike) {
			pieces.push(pendingPrefix + segmentData.segment);
			pendingPrefix = "";
		}
		else if (pieces.length > 0) {
			pieces[pieces.length - 1] += segmentData.segment;
		}
		else {
			pendingPrefix += segmentData.segment;
		}
	}
	if (pendingPrefix.length > 0) {
		pieces.push(pendingPrefix);
	}
	return pieces;
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
	/** @private @type { string } */ #textDirection; // 문단의 방향. ("inherit" 면 그리는 때의 Graphic 방향을 따른다)
	/** @private @type { number } */ #wordWrapWidth; // 0 이면 한 줄. 넘으면 이 폭에서 줄을 바꾼다.
	/** @private @type { string } */ #wrapMode; // "word": 공백 단위(넘치는 단어는 글자 분할) | "char": 글자 단위.
	/** @private @type { number } */ #lineSpacing; // 줄 간격 배율.
	/** @private @type { number } */ #visibleCharacterCount; // 표시 글자 수. -1 이면 전체.

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
		this.#textDirection = "inherit";
		this.#wordWrapWidth = 0;
		this.#wrapMode = "word";
		this.#lineSpacing = 1.25;
		this.#visibleCharacterCount = -1;
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
		if (this.#textDirection !== "inherit") {
			graphic.setTextDirection(this.#textDirection);
		}
		if (this.#wordWrapWidth > 0 || text.indexOf("\n") >= 0) {
			this.drawWrappedText(graphic, contentSize, text);
			return;
		}
		const visibleText = this.applyVisibleCharacterCount(text);
		if (!visibleText) {
			return;
		}
		this.drawPlainText(graphic, contentSize, visibleText);
	}

	//==============================================================================
	// 표시 글자 수만큼 앞에서 자르기.
	//==============================================================================
	/**
	 * @param { string } text
	 * @returns { string }
	 */
	applyVisibleCharacterCount(text) {
		if (this.#visibleCharacterCount < 0) {
			return text;
		}
		return text.slice(0, this.#visibleCharacterCount);
	}

	//==============================================================================
	// 여러 줄 텍스트 그리기. (자동 줄바꿈 + 명시적 개행 + 표시 글자 수)
	// - textBaseline 은 줄 묶음의 세로 정렬로 쓴다. (top / middle / bottom)
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 * @param { Vector2 } contentSize
	 * @param { string } fullText
	 */
	drawWrappedText(graphic, contentSize, fullText) {
		const wrapWidth = (this.#wordWrapWidth > 0) ? this.#wordWrapWidth : contentSize.x;
		const lineList = this.wrapTextToLines(fullText, wrapWidth);
		const lineHeight = this.#fontSize * this.#lineSpacing;
		const blockHeight = lineList.length * lineHeight;

		let blockTop;
		if (this.#textBaseline === "top" || this.#textBaseline === "hanging") {
			blockTop = 0;
		}
		else if (this.#textBaseline === "bottom" || this.#textBaseline === "ideographic" || this.#textBaseline === "alphabetic") {
			blockTop = contentSize.y - blockHeight;
		}
		else {
			blockTop = (contentSize.y - blockHeight) * 0.5;
		}

		// 문단의 방향은 글 전체로 정해 모든 줄에 쓴다. ("start" / "end" 정렬도 그 방향을 따른다)
		const textDirection = graphic.resolveTextDirection(fullText);
		graphic.setTextDirection(textDirection);
		const textAlign = graphic.resolveTextAlign(this.#textAlign, textDirection);
		let drawX;
		if (textAlign === "left") {
			drawX = 0;
		}
		else if (textAlign === "right") {
			drawX = contentSize.x;
		}
		else {
			drawX = contentSize.x * 0.5;
		}

		graphic.setFontString(buildFontString(this.#fontFace, this.#fontSize, this.#bold, this.#italic));
		graphic.setTextAlign(textAlign);
		graphic.setTextBaseline("middle");

		const strokeColor = this.getStrokeColor();
		const textColor = this.getTextColor();
		const decorationLineWidth = System.Math.max(1, this.#fontSize / 16);

		let remainCount = this.#visibleCharacterCount;
		for (let lineIndex = 0; lineIndex < lineList.length; ++lineIndex) {
			let lineText = lineList[lineIndex];
			if (remainCount >= 0) {
				if (remainCount <= 0) {
					break;
				}
				if (lineText.length > remainCount) {
					lineText = lineText.slice(0, remainCount);
				}
				remainCount -= lineList[lineIndex].length;
			}
			if (lineText.length === 0) {
				continue;
			}
			const lineY = blockTop + (lineIndex + 0.5) * lineHeight;
			if (strokeColor && this.#strokeWidth > 0) {
				graphic.setStrokeColor(strokeColor.toHEXString());
				graphic.drawStrokeText(lineText, drawX, lineY, this.#strokeWidth);
			}
			graphic.setFillColor(textColor.toHEXString());
			graphic.drawFillText(lineText, drawX, lineY);

			if (this.#underline || this.#strikethrough) {
				const lineWidth = this.measurePlainTextWidth(lineText);
				const startX = this.computeUnderlineStartX(drawX, lineWidth, textAlign);
				graphic.setStrokeColor(textColor.toHEXString());
				if (this.#underline) {
					this.strokeHorizontalLine(graphic, startX, lineY + this.#fontSize * 0.5 + decorationLineWidth, lineWidth, decorationLineWidth);
				}
				if (this.#strikethrough) {
					this.strokeHorizontalLine(graphic, startX, lineY, lineWidth, decorationLineWidth);
				}
			}
		}
	}

	//==============================================================================
	// 텍스트를 폭에 맞춰 줄 배열로 나누기.
	// - "word": 공백 단위로 채우고, 한 단어가 폭을 넘으면 글자 단위로 강제 분할.
	//   (공백 없는 CJK 문장은 통째로 한 단어이므로 자연히 글자 단위가 된다)
	// - "char": 처음부터 글자 단위.
	// - 명시적 개행(\n)은 항상 지켜진다.
	//==============================================================================
	/**
	 * @param { string } text
	 * @param { number } maxWidth
	 * @returns { string[] }
	 */
	wrapTextToLines(text, maxWidth) {
		const measurementContext = getMeasurementCanvasRenderingContext();
		if (measurementContext === null || maxWidth <= 0) {
			return text.split("\n");
		}
		measurementContext.save();
		measurementContext.font = buildFontString(this.#fontFace, this.#fontSize, this.#bold, this.#italic);
		const measureWidth = (candidateText) => {
			return measurementContext.measureText(candidateText).width;
		};

		const lineList = [];
		const appendByCharacter = (chunkText, seedText) => {
			// seedText 에 chunkText 를 글자 묶음 단위로 이어 붙이며 넘칠 때마다 줄을 확정한다.
			let currentLine = seedText;
			for (const character of splitGraphemes(chunkText)) {
				const candidate = currentLine + character;
				if (currentLine.length > 0 && measureWidth(candidate) > maxWidth) {
					lineList.push(currentLine);
					currentLine = character;
				}
				else {
					currentLine = candidate;
				}
			}
			return currentLine;
		};

		for (const paragraphText of text.split("\n")) {
			if (paragraphText.length === 0) {
				lineList.push("");
				continue;
			}
			if (this.#wrapMode === "char") {
				const lastLine = appendByCharacter(paragraphText, "");
				lineList.push(lastLine);
				continue;
			}
			let currentLine = "";
			for (const wordText of paragraphText.split(" ")) {
				const candidate = (currentLine.length > 0) ? (currentLine + " " + wordText) : wordText;
				if (measureWidth(candidate) <= maxWidth) {
					currentLine = candidate;
					continue;
				}
				// 공백 없이 이어 쓴 조각(태국어 등)에 단어가 여럿이면, 단어 사이에서 나눠 지금 줄의 남은 자리부터 채운다.
				const wordPieces = splitWords(wordText);
				if (wordPieces.length > 1) {
					let isFirstPiece = true;
					for (const wordPiece of wordPieces) {
						const separator = (isFirstPiece && currentLine.length > 0) ? " " : "";
						isFirstPiece = false;
						const pieceCandidate = currentLine + separator + wordPiece;
						if (measureWidth(pieceCandidate) <= maxWidth) {
							currentLine = pieceCandidate;
							continue;
						}
						if (currentLine.length > 0) {
							lineList.push(currentLine);
						}
						currentLine = (measureWidth(wordPiece) <= maxWidth) ? wordPiece : appendByCharacter(wordPiece, "");
					}
					continue;
				}
				if (currentLine.length > 0) {
					lineList.push(currentLine);
					currentLine = "";
				}
				if (measureWidth(wordText) <= maxWidth) {
					currentLine = wordText;
				}
				else {
					currentLine = appendByCharacter(wordText, "");
				}
			}
			lineList.push(currentLine);
		}
		measurementContext.restore();
		return lineList;
	}

	//==============================================================================
	// 줄바꿈 반영 크기 측정. (레이아웃 용)
	//==============================================================================
	/**
	 * @returns { object } { width, height, lineCount }
	 */
	measureWrappedSize() {
		const text = this.getText();
		if (!text) {
			return { width: 0, height: 0, lineCount: 0 };
		}
		if (this.#wordWrapWidth <= 0 && text.indexOf("\n") < 0) {
			return { width: this.measurePlainTextWidth(text), height: this.#fontSize * this.#lineSpacing, lineCount: 1 };
		}
		const wrapWidth = (this.#wordWrapWidth > 0) ? this.#wordWrapWidth : System.Number.POSITIVE_INFINITY;
		const lineList = this.wrapTextToLines(text, wrapWidth);
		let maxLineWidth = 0;
		for (const lineText of lineList) {
			maxLineWidth = System.Math.max(maxLineWidth, this.measurePlainTextWidth(lineText));
		}
		return { width: maxLineWidth, height: lineList.length * this.#fontSize * this.#lineSpacing, lineCount: lineList.length };
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
		const textDirection = graphic.resolveTextDirection(text);
		graphic.setTextDirection(textDirection);
		const textAlign = graphic.resolveTextAlign(this.#textAlign, textDirection);
		let drawX;
		if (textAlign === "left") {
			drawX = 0;
		}
		else if (textAlign === "right") {
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
		graphic.setTextAlign(textAlign);
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
			const startX = this.computeUnderlineStartX(drawX, textWidth, textAlign);
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
	 * @param { string } textAlign 실제 정렬. (기본은 이 글자의 정렬, "start" 는 왼쪽, "end" 는 오른쪽으로 본다)
	 * @returns { number }
	 */
	computeUnderlineStartX(drawX, textWidth, textAlign = this.#textAlign) {
		if (textAlign === "left" || textAlign === "start") {
			return drawX;
		}
		if (textAlign === "right" || textAlign === "end") {
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
	//==============================================================================
	// 자동 줄바꿈 폭 설정. (0 이면 한 줄)
	//==============================================================================
	/**
	 * @param { number } wordWrapWidth
	 */
	setWordWrapWidth(wordWrapWidth) {
		this.#wordWrapWidth = System.Math.max(0, wordWrapWidth);
	}

	//==============================================================================
	// 자동 줄바꿈 폭 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getWordWrapWidth() {
		return this.#wordWrapWidth;
	}

	//==============================================================================
	// 줄바꿈 방식 설정. ("word" | "char")
	//==============================================================================
	/**
	 * @param { string } wrapMode
	 */
	setWrapMode(wrapMode) {
		this.#wrapMode = wrapMode;
	}

	//==============================================================================
	// 줄바꿈 방식 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getWrapMode() {
		return this.#wrapMode;
	}

	//==============================================================================
	// 줄 간격 배율 설정.
	//==============================================================================
	/**
	 * @param { number } lineSpacing
	 */
	setLineSpacing(lineSpacing) {
		this.#lineSpacing = System.Math.max(0.1, lineSpacing);
	}

	//==============================================================================
	// 줄 간격 배율 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getLineSpacing() {
		return this.#lineSpacing;
	}

	//==============================================================================
	// 표시 글자 수 설정. (-1 이면 전체 — 타자기 연출용)
	//==============================================================================
	/**
	 * @param { number } visibleCharacterCount
	 */
	setVisibleCharacterCount(visibleCharacterCount) {
		this.#visibleCharacterCount = System.Math.max(-1, System.Math.floor(visibleCharacterCount));
	}

	//==============================================================================
	// 표시 글자 수 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getVisibleCharacterCount() {
		return this.#visibleCharacterCount;
	}

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
	// 글자 방향 설정. ("inherit" | "ltr" | "rtl" | "auto", Graphic.setTextDirection 과 같다)
	// - "inherit" 면 그리는 때의 Graphic 방향을 따른다. (기본)
	// - 정렬 "start" / "end" 가 이 방향에 따라 왼쪽, 오른쪽이 된다. (오른쪽에서 왼쪽 언어의 화면은 "rtl" 과 "start")
	//==============================================================================
	/**
	 * @param { "inherit" | "ltr" | "rtl" | "auto" } textDirection
	 */
	setTextDirection(textDirection) {
		this.#textDirection = textDirection;
	}

	//==============================================================================
	// 글자 방향 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getTextDirection() {
		return this.#textDirection;
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
