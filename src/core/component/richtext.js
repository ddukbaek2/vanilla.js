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
// - 글자 방향: segment 를 이은 글로 문단 방향을 정하고 (이 글자의 방향, "inherit" 면 Graphic 의 방향), 오른쪽에서 왼쪽이면 segment 를 오른쪽부터 놓는다.
//   segment 마다 그 방향으로 굽고, 정렬 "start" / "end" 도 그 방향으로 푼다.
// - segment 별 미지정 속성은 부모 Text 의 전역 속성을 fallback.
// - 비활성화 상태 (isEnable() === false) 면 draw / 측정에서 건너뛴다.
//==============================================================================
/**
 * @example <caption>마크업으로 글 조각마다 꾸미기</caption>
 * import { Engine, EngineConfiguration, Scene, Vector2, WorldNode, RichText } from "./build/vanilla.js";
 *
 * class MainScene extends Scene {
 * 	async load(engine) {
 * 		await super.load(engine);
 * 		const labelNode = new WorldNode();
 * 		labelNode.setContentSize(Vector2.create(560, 60));
 * 		labelNode.setLocalPosition(Vector2.create(320, 180));
 * 		const richText = labelNode.addComponent(RichText);
 * 		richText.setFontSize(28);
 * 		richText.setTextColor("#ffffff");
 * 		richText.setText("Get <color=#ffcc00><b>100</b></color> gold and <i>a <u>key</u></i>");
 * 		const root = this.getRoot();
 * 		root.addChild(labelNode);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
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
	// 그리는 사각형을 rect 에 적기. (오버라이드: 조각이 없으면 Text 와 같고, 있으면 조각을 이은 한 줄의 사각형)
	// - 조각마다 제 글꼴로 잰 너비를 더한 합산 폭을 정렬대로 놓고(그리기와 같은 자리), 가장 큰 글꼴 크기의 반과 가장 굵은 외곽선만큼 양옆에 더한다.
	//   "start" 와 "end" 는 그릴 때의 방향으로 왼쪽이나 오른쪽이 되므로 둘 다 품는다.
	// - 세로는 베이스라인 자리에서 위아래로 가장 큰 글꼴 크기의 1.5 배와 가장 굵은 외곽선만큼. (밑줄, 취소선도 이 안)
	// - 잴 수 없으면 false. (거르지 않는다)
	//==============================================================================
	/**
	 * @override
	 * @param { Rect } rect 그리는 사각형을 적을 곳. (노드 내용 영역의 왼쪽 위가 원점)
	 * @returns { boolean } 적었으면 참. (잴 수 없으면 거짓)
	 * @example <caption>조각을 이은 글이 그리는 곳 보기</caption>
	 * import { WorldNode, RichText, Rect, Vector2 } from "./build/vanilla.js";
	 *
	 * const node = new WorldNode();
	 * node.setContentSize(Vector2.create(200, 40));
	 * const richText = node.addComponent(RichText);
	 * richText.appendSegment("HP ", { bold: true });
	 * richText.appendSegment("42", { fontSize: 32 });
	 * const drawnRect = Rect.zero();
	 * const isKnown = richText.calculateDrawnRect(drawnRect);
	 * console.log(isKnown, drawnRect.size.y >= 32);
	 */
	calculateDrawnRect(rect) {
		if (this.hasSegments() === false) {
			return super.calculateDrawnRect(rect);
		}
		const node = this.getNode();
		if (node === null || node === undefined) {
			return false;
		}
		const measurementContext = getMeasurementCanvasRenderingContext();
		if (measurementContext === null) {
			return false;
		}
		const fallbackFontFace = this.getFontFace();
		const fallbackFontSize = this.getFontSize();
		const fallbackStrokeWidth = this.getStrokeWidth();
		const fallbackBold = this.isBold();
		const fallbackItalic = this.isItalic();
		let totalWidth = 0;
		let maximumFontSize = 0;
		let maximumStrokeWidth = 0;
		for (const segment of this.#segments) {
			const segmentText = segment.text;
			if (!segmentText || segmentText.length === 0) {
				continue;
			}
			const segmentFontSize = (typeof segment.attributes.fontSize === "number") ? segment.attributes.fontSize : fallbackFontSize;
			const segmentFontFace = this.resolveSegmentFontFace(segment.attributes.fontFace, fallbackFontFace);
			const segmentStrokeWidth = (typeof segment.attributes.strokeWidth === "number") ? segment.attributes.strokeWidth : fallbackStrokeWidth;
			const segmentBold = (segment.attributes.bold === true) || fallbackBold;
			const segmentItalic = (segment.attributes.italic === true) || fallbackItalic;
			measurementContext.save();
			measurementContext.font = buildFontString(segmentFontFace, segmentFontSize, segmentBold, segmentItalic);
			totalWidth += measurementContext.measureText(segmentText).width;
			measurementContext.restore();
			maximumFontSize = System.Math.max(maximumFontSize, segmentFontSize);
			maximumStrokeWidth = System.Math.max(maximumStrokeWidth, segmentStrokeWidth);
		}
		if (maximumFontSize === 0) {
			rect.position.set(0, 0);
			rect.size.set(0, 0);
			return true;
		}
		const contentSize = node.getContentSize();
		const textAlign = this.getTextAlign();
		let leftX;
		let rightX;
		if (textAlign === "left") {
			leftX = 0;
			rightX = totalWidth;
		}
		else if (textAlign === "right") {
			leftX = contentSize.x - totalWidth;
			rightX = contentSize.x;
		}
		else if (textAlign === "start" || textAlign === "end") {
			leftX = System.Math.min(0, contentSize.x - totalWidth);
			rightX = System.Math.max(totalWidth, contentSize.x);
		}
		else {
			leftX = (contentSize.x - totalWidth) * 0.5;
			rightX = leftX + totalWidth;
		}
		const textBaseline = this.getTextBaseline();
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
		const horizontalMargin = maximumFontSize * 0.5 + maximumStrokeWidth;
		const verticalMargin = maximumFontSize * 1.5 + maximumStrokeWidth;
		rect.position.set(leftX - horizontalMargin, baselineY - verticalMargin);
		rect.size.set(rightX - leftX + horizontalMargin * 2, verticalMargin * 2);
		return true;
	}

	//==============================================================================
	// 텍스트 설정, 마크업 자동 파싱.
	// - 알려진 태그가 있으면 segment 배열로 분해해 보관.
	// - 마크업이 없으면 segment 비우고 plain text 동작으로 fallback.
	//==============================================================================
	/**
	 * @override
	 * @param { string } text 보일 글. (알려진 마크업 태그가 있으면 segment 로 나눈다)
	 */
	setText(text) {
		super.setText(text);
		const parsed = parseMarkupToSegments(text);
		this.#segments = (parsed !== null) ? parsed : [];
	}

	//==============================================================================
	// segment 1 개 추가. (편의 API, 마크업 외에 프로그래밍 방식으로 segment 쌓기)
	//==============================================================================
	/**
	 * @param { string } text segment 글.
	 * @param { object } [attributes] segment 속성. ({ fontFace, fontSize, textColor, strokeColor, strokeWidth, bold, italic, underline, strikethrough }, 색은 Color, 빠진 것은 Text 의 속성을 쓴다)
	 * @returns { RichText } 이 컴포넌트. (이어 부를 수 있다)
	 * @example <caption>segment 를 코드로 쌓기</caption>
	 * import { Engine, EngineConfiguration, Scene, Vector2, WorldNode, RichText, Color } from "./build/vanilla.js";
	 *
	 * class MainScene extends Scene {
	 * 	async load(engine) {
	 * 		await super.load(engine);
	 * 		const labelNode = new WorldNode();
	 * 		labelNode.setContentSize(Vector2.create(400, 60));
	 * 		labelNode.setLocalPosition(Vector2.create(320, 180));
	 * 		const richText = labelNode.addComponent(RichText);
	 * 		richText.setFontSize(24);
	 * 		const healthColor = Color.createFromHEX("#ff4444");
	 * 		richText.appendSegment("HP ", { bold: true });
	 * 		richText.appendSegment("42", { textColor: healthColor, fontSize: 32 });
	 * 		richText.appendSegment(" / 100");
	 * 		const segments = richText.getSegments();
	 * 		console.log(segments.length);
	 * 		const root = this.getRoot();
	 * 		root.addChild(labelNode);
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	appendSegment(text, attributes) {
		const finalAttributes = (attributes !== null && attributes !== undefined) ? attributes : {};
		this.#segments.push({ text: text, attributes: finalAttributes });
		this.markDrawnRectDirty();
		return this;
	}

	//==============================================================================
	// segment 모두 제거.
	//==============================================================================
	clearSegments() {
		this.#segments = [];
		this.markDrawnRectDirty();
	}

	//==============================================================================
	// segment 목록 반환. (사본)
	//==============================================================================
	/**
	 * @returns { { text: string, attributes: object }[] } segment 목록의 사본. ({ text, attributes } 배열)
	 */
	getSegments() {
		return this.#segments.slice();
	}

	//==============================================================================
	// segment 보유 여부.
	//==============================================================================
	/**
	 * @returns { boolean } 글이 있는 segment 가 하나라도 있으면 참.
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
	 * @param { Graphic } graphic 그래픽.
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
	 * @param { Graphic } graphic 그래픽.
	 * @param { Vector2 } contentSize 노드의 내용 크기.
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
		const textBaseline = this.getTextBaseline();

		// 문단의 방향은 segment 를 이은 글로 정한다. ("start" / "end" 정렬과 segment 를 놓는 차례가 그 방향을 따른다)
		if (this.getTextDirection() !== "inherit") {
			graphic.setTextDirection(this.getTextDirection());
		}
		const joinedText = segments.map((segment) => segment.text || "").join("");
		const textDirection = graphic.resolveTextDirection(joinedText);
		graphic.setTextDirection(textDirection);
		const isRightToLeft = textDirection === "rtl";
		const textAlign = graphic.resolveTextAlign(this.getTextAlign(), textDirection);

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

		// 시작 X 좌표. (오른쪽에서 왼쪽이면 오른쪽 끝에서 왼쪽으로 놓아 간다)
		let cursorX;
		if (textAlign === "left") {
			cursorX = 0;
		}
		else if (textAlign === "right") {
			cursorX = contentSize.x - totalWidth;
		}
		else {
			cursorX = (contentSize.x - totalWidth) * 0.5;
		}
		if (isRightToLeft) {
			cursorX += totalWidth;
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
			const segmentWidth = graphic.measureText(segmentText).width;
			if (isRightToLeft) {
				cursorX -= segmentWidth;
			}
			if (segmentStrokeColor && segmentStrokeWidth > 0) {
				graphic.setStrokeColor(segmentStrokeColor.toHEXString());
				graphic.drawStrokeText(segmentText, cursorX, baselineY, segmentStrokeWidth);
			}
			graphic.setFillColor(segmentTextColor.toHEXString());
			graphic.drawFillText(segmentText, cursorX, baselineY);

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
			if (!isRightToLeft) {
				cursorX += segmentWidth;
			}
		}
	}

	//==============================================================================
	// segment 의 fontFace 입력값을 해석해 적용 가능한 FontFace 로 변환.
	//==============================================================================
	/**
	 * @param { FontFace | FontAsset | null | undefined } input segment 의 글꼴 값. (FontAsset 이면 그 글꼴, null 이나 undefined 면 fallback)
	 * @param { FontFace | null } fallback 대신 쓸 글꼴.
	 * @returns { FontFace | null } 쓸 글꼴. (null 이면 시스템 글꼴)
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
	 * @returns { Vector2 } 자연 크기. (segment 너비 합과 가장 큰 글자 크기, 잴 수 없거나 비활성이면 (-1, -1))
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
