//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Color } from "../../base/color.js";
import { Vector2 } from "../../base/vector2.js";
import { Graphic } from "../graphic.js";
import { FontAsset } from "../../resource/fontasset.js";
import { Text, getMeasurementCanvasRenderingContext, buildFontString } from "./text.js";


//==============================================================================
// 마크업 색상 이름 → HEX 매핑. (Unity TMP 와 호환)
//==============================================================================
const NAMED_COLORS = {
	red: "#ff0000",
	green: "#00ff00",
	blue: "#0000ff",
	white: "#ffffff",
	black: "#000000",
	yellow: "#ffff00",
	cyan: "#00ffff",
	magenta: "#ff00ff",
	gray: "#808080",
	grey: "#808080",
	orange: "#ffa500",
	purple: "#800080",
	brown: "#a52a2a",
	pink: "#ffc0cb",
	silver: "#c0c0c0",
	maroon: "#800000",
	olive: "#808000",
	navy: "#000080",
	teal: "#008080",
	lime: "#00ff00",
	aqua: "#00ffff",
	fuchsia: "#ff00ff",
};


//==============================================================================
// 색상 값 (#RRGGBB / #RRGGBBAA / 이름) 을 Color 로 파싱.
//==============================================================================
/**
 * @param { string } value
 * @returns { Color | null }
 */
function parseColorValue(value) {
	if (value === null || value === undefined) {
		return null;
	}
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return null;
	}
	if (trimmed.startsWith("#")) {
		return Color.createFromHEX(trimmed);
	}
	const lowered = trimmed.toLowerCase();
	const namedHex = NAMED_COLORS[lowered];
	if (namedHex !== undefined) {
		return Color.createFromHEX(namedHex);
	}
	return null;
}


//==============================================================================
// 단일 태그를 attributes 객체로 변환. 알 수 없는 태그면 null.
//==============================================================================
/**
 * @param { string } tagName
 * @param { string | undefined } value
 * @returns { object | null }
 */
function buildAttributesForTag(tagName, value) {
	switch (tagName) {
		case "color": {
			const textColor = parseColorValue(value);
			if (textColor === null) {
				return null;
			}
			return { textColor: textColor };
		}
		case "size": {
			const trimmed = (value !== undefined && value !== null) ? value.trim() : "";
			const fontSize = System.parseInt(trimmed, 10);
			if (System.Number.isFinite(fontSize) === false || fontSize <= 0) {
				return null;
			}
			return { fontSize: fontSize };
		}
		case "b": {
			return { bold: true };
		}
		case "i": {
			return { italic: true };
		}
		case "u": {
			return { underline: true };
		}
		case "s": {
			return { strikethrough: true };
		}
		default: {
			return null;
		}
	}
}


//==============================================================================
// 스택의 attribute 들을 하나의 attributes 로 머지. (안쪽 태그가 우선)
//==============================================================================
/**
 * @param { object[] } stack
 * @returns { object }
 */
function mergeAttributeStack(stack) {
	const result = {};
	for (const attributes of stack) {
		for (const key of System.Object.keys(attributes)) {
			if (key === "__tagName") {
				continue;
			}
			result[key] = attributes[key];
		}
	}
	return result;
}


//==============================================================================
// 마크업 문자열을 segment 배열 ({ text, attributes }) 로 파싱.
// - 알려진 태그가 1 개도 없으면 null 반환 (호출자가 plain text 로 처리하도록).
//==============================================================================
/**
 * @param { string } input
 * @returns { { text: string, attributes: object }[] | null }
 */
function parseMarkupToSegments(input) {
	if (input === null || input === undefined || input.length === 0) {
		return null;
	}
	if (input.indexOf("<") === -1) {
		return null;
	}
	const tagRegex = /<(\/?)([a-zA-Z]+)(?:=([^>]+))?>/g;
	const segments = [];
	const stack = [];
	let lastIndex = 0;
	let match;
	let foundKnownTag = false;
	while ((match = tagRegex.exec(input)) !== null) {
		const matchStart = match.index;
		const matchEnd = matchStart + match[0].length;
		const isClose = match[1] === "/";
		const tagName = match[2].toLowerCase();
		const tagValue = match[3];

		const precedingText = input.substring(lastIndex, matchStart);
		if (precedingText.length > 0) {
			segments.push({ text: precedingText, attributes: mergeAttributeStack(stack) });
		}

		if (isClose) {
			for (let stackIndex = stack.length - 1; stackIndex >= 0; --stackIndex) {
				if (stack[stackIndex].__tagName === tagName) {
					stack.splice(stackIndex, 1);
					foundKnownTag = true;
					break;
				}
			}
			lastIndex = matchEnd;
			continue;
		}

		const tagAttributes = buildAttributesForTag(tagName, tagValue);
		if (tagAttributes === null) {
			segments.push({ text: match[0], attributes: mergeAttributeStack(stack) });
			lastIndex = matchEnd;
			continue;
		}
		tagAttributes.__tagName = tagName;
		stack.push(tagAttributes);
		foundKnownTag = true;
		lastIndex = matchEnd;
	}

	const trailingText = input.substring(lastIndex);
	if (trailingText.length > 0) {
		segments.push({ text: trailingText, attributes: mergeAttributeStack(stack) });
	}

	if (foundKnownTag === false) {
		return null;
	}
	return segments;
}


//==============================================================================
// 리치텍스트 출력기 컴포넌트. (Text 를 상속)
//
// - 마크업 (Unity TMP 호환) 을 자동으로 파싱해 segment 별 폰트 / 크기 / 색상 /
//   볼드 / 이탤릭 / 밑줄 / 취소선을 다르게 적용해 그린다.
// - 지원 태그:
//   - <b>...</b>                            : 볼드
//   - <i>...</i>                            : 이탤릭
//   - <u>...</u>                            : 밑줄
//   - <s>...</s>                            : 취소선
//   - <color=#RRGGBB[AA]>...</color>        : 색상 (HEX)
//   - <color=red>...</color>                : 색상 (이름)
//   - <size=N>...</size>                    : 폰트 크기
//   - 알 수 없는 태그는 그대로 텍스트로 출력.
// - 마크업이 없는 plain text 면 부모 (Text) 의 draw 동작으로 fallback.
// - segment 별 미지정 속성은 부모 Text 의 전역 속성을 fallback.
// - 비활성화 상태 (isEnable() === false) 면 draw / 측정에서 건너뛴다.
//==============================================================================
export class RichText extends Text {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { { text: string, attributes: object }[] } */ #segments;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setComponentType("RichText");
		this.#segments = [];
	}

	//==============================================================================
	// 텍스트 설정 — 마크업 자동 파싱.
	// - 알려진 태그가 있으면 segment 배열로 분해해 보관.
	// - 마크업이 없으면 segment 비우고 plain text 동작으로 fallback.
	//==============================================================================
	/**
	 * @override
	 * @param { string } text
	 */
	setText(text) {
		super.setText(text);
		const parsed = parseMarkupToSegments(text);
		this.#segments = (parsed !== null) ? parsed : [];
	}

	//==============================================================================
	// segment 1 개 추가. (편의 API — 마크업 외에 프로그래밍 방식으로 segment 쌓기)
	//==============================================================================
	/**
	 * @param { string } text
	 * @param { object } [attributes]
	 * @returns { RichText }
	 */
	appendSegment(text, attributes) {
		const finalAttributes = (attributes !== null && attributes !== undefined) ? attributes : {};
		this.#segments.push({ text: text, attributes: finalAttributes });
		return this;
	}

	//==============================================================================
	// segment 모두 제거.
	//==============================================================================
	clearSegments() {
		this.#segments = [];
	}

	//==============================================================================
	// segment 목록 반환. (사본)
	//==============================================================================
	/**
	 * @returns { { text: string, attributes: object }[] }
	 */
	getSegments() {
		return this.#segments.slice();
	}

	//==============================================================================
	// segment 보유 여부.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	hasSegments() {
		const segments = this.#segments;
		if (segments.length === 0) {
			return false;
		}
		for (const segment of segments) {
			if (segment.text && segment.text.length > 0) {
				return true;
			}
		}
		return false;
	}

	//==============================================================================
	// 출력. (비활성화면 건너뜀, segment 가 비어있으면 부모의 plain text 동작)
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic
	 */
	draw(graphic) {
		if (this.isEnable() === false) {
			return;
		}
		if (this.hasSegments() === false) {
			super.draw(graphic);
			return;
		}
		const node = this.getNode();
		const contentSize = node.getContentSize();
		this.drawSegments(graphic, contentSize);
	}

	//==============================================================================
	// segment 별로 폰트 / 색 / 스타일을 적용해 좌→우 누적 그리기.
	// - 정렬 / baseline 은 합산 폭 / 최대 폰트 크기 기준.
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 * @param { Vector2 } contentSize
	 */
	drawSegments(graphic, contentSize) {
		const segments = this.#segments;

		const fallbackFontFace = this.getFontFace();
		const fallbackFontSize = this.getFontSize();
		const fallbackTextColor = this.getTextColor();
		const fallbackStrokeColor = this.getStrokeColor();
		const fallbackStrokeWidth = this.getStrokeWidth();
		const fallbackBold = this.isBold();
		const fallbackItalic = this.isItalic();
		const fallbackUnderline = this.isUnderline();
		const fallbackStrikethrough = this.isStrikethrough();
		const textAlign = this.getTextAlign();
		const textBaseline = this.getTextBaseline();

		// 합산 폭 / 최대 폰트 크기 계산.
		let totalWidth = 0;
		let maxFontSize = 0;
		for (const segment of segments) {
			const segmentText = segment.text;
			if (!segmentText || segmentText.length === 0) {
				continue;
			}
			const segmentFontSize = (typeof segment.attributes.fontSize === "number") ? segment.attributes.fontSize : fallbackFontSize;
			const segmentFontFace = this.resolveSegmentFontFace(segment.attributes.fontFace, fallbackFontFace);
			const segmentBold = (segment.attributes.bold === true) || fallbackBold;
			const segmentItalic = (segment.attributes.italic === true) || fallbackItalic;
			graphic.setFontString(buildFontString(segmentFontFace, segmentFontSize, segmentBold, segmentItalic));
			totalWidth += graphic.measureText(segmentText).width;
			if (segmentFontSize > maxFontSize) {
				maxFontSize = segmentFontSize;
			}
		}

		// 시작 X 좌표.
		let cursorX;
		if (textAlign === "left" || textAlign === "start") {
			cursorX = 0;
		}
		else if (textAlign === "right" || textAlign === "end") {
			cursorX = contentSize.x - totalWidth;
		}
		else {
			cursorX = (contentSize.x - totalWidth) * 0.5;
		}

		// Y 좌표.
		let baselineY;
		if (textBaseline === "top" || textBaseline === "hanging") {
			baselineY = 0;
		}
		else if (textBaseline === "bottom" || textBaseline === "ideographic" || textBaseline === "alphabetic") {
			baselineY = contentSize.y;
		}
		else {
			baselineY = contentSize.y * 0.5;
		}

		// segment 별 렌더링.
		graphic.setTextAlign("left");
		graphic.setTextBaseline(textBaseline);
		for (const segment of segments) {
			const segmentText = segment.text;
			if (!segmentText || segmentText.length === 0) {
				continue;
			}
			const segmentFontSize = (typeof segment.attributes.fontSize === "number") ? segment.attributes.fontSize : fallbackFontSize;
			const segmentFontFace = this.resolveSegmentFontFace(segment.attributes.fontFace, fallbackFontFace);
			const segmentTextColor = (segment.attributes.textColor instanceof Color) ? segment.attributes.textColor : fallbackTextColor;
			const segmentStrokeColor = (segment.attributes.strokeColor instanceof Color) ? segment.attributes.strokeColor : fallbackStrokeColor;
			const segmentStrokeWidth = (typeof segment.attributes.strokeWidth === "number") ? segment.attributes.strokeWidth : fallbackStrokeWidth;
			const segmentBold = (segment.attributes.bold === true) || fallbackBold;
			const segmentItalic = (segment.attributes.italic === true) || fallbackItalic;
			const segmentUnderline = (segment.attributes.underline === true) || fallbackUnderline;
			const segmentStrikethrough = (segment.attributes.strikethrough === true) || fallbackStrikethrough;

			graphic.setFontString(buildFontString(segmentFontFace, segmentFontSize, segmentBold, segmentItalic));
			if (segmentStrokeColor && segmentStrokeWidth > 0) {
				graphic.setStrokeColor(segmentStrokeColor.toHEXString());
				graphic.drawStrokeText(segmentText, cursorX, baselineY, segmentStrokeWidth);
			}
			graphic.setFillColor(segmentTextColor.toHEXString());
			graphic.drawFillText(segmentText, cursorX, baselineY);

			const segmentWidth = graphic.measureText(segmentText).width;
			const segmentLineWidth = System.Math.max(1, segmentFontSize / 16);
			if (segmentUnderline) {
				const underlineY = baselineY + this.computeUnderlineOffsetY(segmentFontSize);
				graphic.setStrokeColor(segmentTextColor.toHEXString());
				this.strokeHorizontalLine(graphic, cursorX, underlineY, segmentWidth, segmentLineWidth);
			}
			if (segmentStrikethrough) {
				const strikeY = baselineY + this.computeStrikethroughOffsetY(segmentFontSize);
				graphic.setStrokeColor(segmentTextColor.toHEXString());
				this.strokeHorizontalLine(graphic, cursorX, strikeY, segmentWidth, segmentLineWidth);
			}
			cursorX += segmentWidth;
		}
	}

	//==============================================================================
	// segment 의 fontFace 입력값을 해석해 적용 가능한 FontFace 로 변환.
	//==============================================================================
	/**
	 * @param { FontFace | FontAsset | null | undefined } input
	 * @param { FontFace | null } fallback
	 * @returns { FontFace | null }
	 */
	resolveSegmentFontFace(input, fallback) {
		if (input === null || input === undefined) {
			return fallback;
		}
		if (input instanceof FontAsset) {
			return input.fontFace;
		}
		return input;
	}

	//==============================================================================
	// 텍스트의 자연 크기 반환.
	// - segment 가 있으면 segment 합산 폭 + 최대 폰트 크기.
	// - 없으면 부모 (Text) 의 plain text 측정.
	//==============================================================================
	/**
	 * @override
	 * @returns { Vector2 }
	 */
	getIntrinsicContentSize() {
		if (this.isEnable() === false) {
			return Vector2.create(-1, -1);
		}
		if (this.hasSegments() === false) {
			return super.getIntrinsicContentSize();
		}
		const measurementContext = getMeasurementCanvasRenderingContext();
		if (measurementContext === null) {
			return Vector2.create(-1, -1);
		}
		const fallbackFontFace = this.getFontFace();
		const fallbackFontSize = this.getFontSize();
		const fallbackBold = this.isBold();
		const fallbackItalic = this.isItalic();
		let totalWidth = 0;
		let maxFontSize = 0;
		for (const segment of this.#segments) {
			const segmentText = segment.text;
			if (!segmentText || segmentText.length === 0) {
				continue;
			}
			const segmentFontSize = (typeof segment.attributes.fontSize === "number") ? segment.attributes.fontSize : fallbackFontSize;
			const segmentFontFace = this.resolveSegmentFontFace(segment.attributes.fontFace, fallbackFontFace);
			const segmentBold = (segment.attributes.bold === true) || fallbackBold;
			const segmentItalic = (segment.attributes.italic === true) || fallbackItalic;
			measurementContext.save();
			measurementContext.font = buildFontString(segmentFontFace, segmentFontSize, segmentBold, segmentItalic);
			totalWidth += measurementContext.measureText(segmentText).width;
			measurementContext.restore();
			if (segmentFontSize > maxFontSize) {
				maxFontSize = segmentFontSize;
			}
		}
		if (maxFontSize === 0) {
			maxFontSize = fallbackFontSize;
		}
		return Vector2.create(totalWidth, maxFontSize);
	}
}
