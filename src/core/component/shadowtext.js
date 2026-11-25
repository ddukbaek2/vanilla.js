//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Graphic } from "../graphic.js";
import { Component } from "../component.js";
import { detectTextDirection } from "../graphic.js";
import { buildFontString } from "./text.js";
import { acquireSharedBake, releaseSharedBake } from "../graphic/sharedbakecache.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 구운 캔버스의 가장자리 여유. (안티앨리어싱, 픽셀)
const BAKE_PADDING = 2;

// 웹 글꼴의 조각이 받아진 횟수. (늘면 다음 그릴 때 다시 굽는다)
let fontLoadCount = 0;
if (System.document !== undefined && System.document.fonts !== undefined) {
	System.document.fonts.addEventListener("loadingdone", () => {
		fontLoadCount += 1;
	});
}


//==============================================================================
// "#rrggbb" 와 불투명도로 캔버스의 rgba 색 글 만들기.
//==============================================================================
/**
 * @param { string } colorText - "#rrggbb"
 * @param { number } opacity - 0 ~ 1
 * @returns { string }
 */
export function buildRGBAString(colorText, opacity) {
	const hexText = colorText.slice(1);
	const value = System.parseInt(hexText, 16);
	const red = (value >> 16) & 255;
	const green = (value >> 8) & 255;
	const blue = value & 255;
	return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}


//==============================================================================
// 그림자를 깐 한 줄 글.
// - 글자 노드 두 벌(같은 글을 검게 밑에, 글을 위에)로 그림자를 깔면 둘이 따로 비쳐, 노드를 흐리게 할 때 흐린 글 사이로 밑의 그림자가 보인다.
//   이 컴포넌트는 그림자 위에 글을 얹은 모습을 캔버스 한 장에 구워 그 한 장을 그리므로, 노드의 불투명도가 글과 그림자에 한 장째로 먹는다.
// - 가로 정렬과 놓는 자리는 Graphic.drawTextEntry 와 같은 셈이다. 세로는 노드의 가운데다.
// - 글이 노드 너비를 넘으면 처음 크기에서 최소 비율(setFitMinimumRatio)까지 줄여 맞춘다.
// - 그리는 배율(기기의 DPR, 뷰 배율), 글, 꼴, 노드 너비가 바뀌거나 웹 글꼴의 조각이 새로 받아지면 다시 굽는다.
// - 그림자는 캔버스의 그림자로 칠해 번지게 할 수 있다. 번지는 만큼 구운 캔버스의 가장자리를 넓힌다.
// - 기울임, 밑줄, 취소선(setItalic, setUnderline, setStrikethrough): 선의 자리, 두께는 Text 의 가운데 기준선과 같고, 선도 글과 함께 구워 그림자가 깔린다.
// - 글 방향은 "ltr", "rtl", "auto"(글의 첫 강한 글자로) 이다.
//==============================================================================
/**
 * @example <caption>그림자를 깐 제목 글</caption>
 * import { Engine, EngineConfiguration, Scene, Vector2, WorldNode, ShadowText, FontAsset } from "./build/vanilla.js";
 *
 * class MainScene extends Scene {
 * 	async load(engine) {
 * 		await super.load(engine);
 * 		const fontAsset = new FontAsset();
 * 		await fontAsset.loadFont("DOSGothic", "examples/assets/DOSGothic.woff");
 * 		const titleNode = new WorldNode();
 * 		titleNode.setContentSize(Vector2.create(400, 60));
 * 		titleNode.setLocalPosition(Vector2.create(320, 180));
 * 		const shadowText = titleNode.addComponent(ShadowText);
 * 		shadowText.setFontFace(fontAsset.fontFace);
 * 		shadowText.setTextStyle(40, true, "#ffffff");
 * 		shadowText.setShadow("#000000", 0.8, 3, 4);
 * 		shadowText.setText("Vanilla Engine");
 * 		const root = this.getRoot();
 * 		root.addChild(titleNode);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
export class ShadowText extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { string } */ #text;
	/** @private @type { FontFace | null } */ #fontFace; // 글꼴. (null 이면 시스템 글꼴)
	/** @private @type { number } */ #fontSize; // 처음 크기. (넘치면 줄여 굽는다)
	/** @private @type { boolean } */ #isBold;
	/** @private @type { boolean } */ #isItalic;
	/** @private @type { boolean } */ #isUnderline;
	/** @private @type { boolean } */ #isStrikethrough;
	/** @private @type { string } */ #textAlign; // "left", "center", "right", "start", "end"
	/** @private @type { string } */ #textDirection; // "ltr", "rtl", "auto"
	/** @private @type { string } */ #textColor; // "#rrggbb" 나 CSS 색.
	/** @private @type { string } */ #shadowColor; // "#rrggbb"
	/** @private @type { number } */ #shadowOpacity;
	/** @private @type { number } */ #shadowOffset; // 그림자가 글 아래로 내려가는 만큼. (내용 크기 단위)
	/** @private @type { number } */ #shadowBlur; // 그림자가 번지는 만큼. (내용 크기 단위, 0 이면 번지지 않는다)
	/** @private @type { number } */ #fitMinimumRatio; // 넘칠 때 줄이는 가장 작은 비율. (1 이면 줄이지 않는다)
	/** @private @type { HTMLCanvasElement | null } */ #bakeCanvas; // 구운 한 장. (굽지 않았으면 null)
	/** @private @type { string } */ #bakeKey; // 구운 조건. (바뀌면 다시 굽는다)
	/** @private @type { object } */ #bakeMetrics; // 구운 한 장의 논리 좌표 치수. { scale, advanceWidth, penOffsetX, baselineOffsetY, fontAscent, fontDescent }

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.setComponentType("ShadowText");
		this.#text = "";
		this.#fontFace = null;
		this.#fontSize = 16;
		this.#isBold = false;
		this.#isItalic = false;
		this.#isUnderline = false;
		this.#isStrikethrough = false;
		this.#textAlign = "center";
		this.#textDirection = "ltr";
		this.#textColor = "#ffffff";
		this.#shadowColor = "#000000";
		this.#shadowOpacity = 1;
		this.#shadowOffset = 0;
		this.#shadowBlur = 0;
		this.#fitMinimumRatio = 0.6;
		this.#bakeCanvas = null;
		this.#bakeKey = "";
		this.#bakeMetrics = { scale: 1, advanceWidth: 0, penOffsetX: 0, baselineOffsetY: 0, fontAscent: 0, fontDescent: 0 };
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Graphic } graphic 그래픽.
	 */
	draw(graphic) {
		const text = this.getText();
		if (text === "") {
			return;
		}
		const node = this.getNode();
		const contentSize = node.getContentSize();
		const contentWidth = contentSize.x;
		const contentHeight = contentSize.y;
		const bakeScale = graphic.calculateTextBakeScale();
		const textDirection = this.resolveBakeTextDirection();
		const fontFace = this.getFontFace();
		const fontFamily = fontFace === null ? "" : fontFace.family;
		const bakeKey = ["ShadowText", text, this.#fontSize, this.#isBold, this.#isItalic, this.#isUnderline, this.#isStrikethrough, this.#textColor, this.#shadowColor, this.#shadowOpacity, this.#shadowOffset, this.#shadowBlur, this.#fitMinimumRatio, contentWidth, bakeScale, textDirection, fontFamily, fontLoadCount].join("|");
		if (bakeKey !== this.#bakeKey) {
			// 같은 모양을 구운 것이 있으면 나눠 쓰고, 없으면 굽는다. (sharedbakecache.js)
			releaseSharedBake(this.#bakeKey, this);
			this.#bakeKey = bakeKey;
			const bake = acquireSharedBake(bakeKey, this, () => {
				this.bakeText(graphic, text, contentWidth, bakeScale, textDirection, fontFace);
				return { canvas: this.getBakeCanvas(), metrics: this.#bakeMetrics };
			});
			this.#bakeCanvas = bake.canvas;
			this.#bakeMetrics = bake.metrics;
		}
		const bakeCanvas = this.getBakeCanvas();
		if (bakeCanvas === null) {
			return;
		}

		// Graphic.drawTextEntry 와 같이 가로는 정렬대로, 세로는 가운데(middle 베이스라인)에 놓는다.
		const bakeMetrics = this.#bakeMetrics;
		const textAlign = graphic.resolveTextAlign(this.getTextAlign(), textDirection);
		let anchorX = contentWidth * 0.5;
		let alignOffset = -bakeMetrics.advanceWidth * 0.5;
		if (textAlign === "left") {
			anchorX = 0;
			alignOffset = 0;
		}
		else if (textAlign === "right") {
			anchorX = contentWidth;
			alignOffset = -bakeMetrics.advanceWidth;
		}
		let quadX = anchorX + alignOffset - bakeMetrics.penOffsetX;
		let quadY = contentHeight * 0.5 + (bakeMetrics.fontAscent - bakeMetrics.fontDescent) * 0.5 - bakeMetrics.baselineOffsetY;

		// 픽셀 맞춤. (글과 같이, 회전이나 기울임이 없을 때만 왼쪽 위를 기기 픽셀에 맞춘다)
		const transformMatrix = graphic.getTransformMatrix();
		const isPixelSnapEnabled = graphic.isTextPixelSnapEnabled();
		if (isPixelSnapEnabled && transformMatrix.b === 0 && transformMatrix.c === 0 && transformMatrix.a > 0 && transformMatrix.d > 0) {
			const devicePoint = transformMatrix.transformPoint(quadX, quadY);
			quadX += (System.Math.round(devicePoint.x) - devicePoint.x) / transformMatrix.a;
			quadY += (System.Math.round(devicePoint.y) - devicePoint.y) / transformMatrix.d;
		}
		const quadWidth = bakeCanvas.width / bakeMetrics.scale;
		const quadHeight = bakeCanvas.height / bakeMetrics.scale;
		graphic.drawImageWithSourceAndDestination(bakeCanvas, 0, 0, bakeCanvas.width, bakeCanvas.height, quadX, quadY, quadWidth, quadHeight);
	}

	//==============================================================================
	// 노드에서 떨어짐. (나눠 쓰던 구운 그림을 놓는다)
	//==============================================================================
	/**
	 * @override
	 * @param { ComponentNode } node 떨어지는 노드.
	 */
	detach(node) {
		releaseSharedBake(this.#bakeKey, this);
		this.#bakeKey = "";
		this.#bakeCanvas = null;
		super.detach(node);
	}

	//==============================================================================
	// 굽기. (글을 한 번 칠하면 캔버스가 그 밑에 그림자를 먼저 칠한다)
	// - 텍스처 캐시가 캔버스마다 한 번 올리므로 구울 때마다 새 캔버스를 만든다. (앞의 것은 수거되며 텍스처도 함께 수거된다)
	//==============================================================================
	/**
	 * @param { Graphic } graphic 그래픽. (처음 크기의 글 너비를 잰다)
	 * @param { string } text 구울 글.
	 * @param { number } fitWidth - 맞출 너비. (0 이하면 맞추지 않는다)
	 * @param { number } bakeScale 굽는 배율. (Graphic.calculateTextBakeScale)
	 * @param { string } textDirection 굽는 방향. ("ltr" 또는 "rtl")
	 * @param { FontFace | null } fontFace 글꼴. (null 이면 시스템 글꼴)
	 */
	bakeText(graphic, text, fitWidth, bakeScale, textDirection, fontFace) {
		const bakeCanvas = System.document.createElement("canvas");
		const canvasRenderingContext = bakeCanvas.getContext("2d");
		if (canvasRenderingContext === null) {
			this.#bakeCanvas = null;
			return;
		}

		// 넘치면 처음 크기에서 줄인다.
		let fontSize = this.#fontSize;
		const textWidth = this.measureTextWidth(graphic);
		if (fitWidth > 0 && textWidth > fitWidth) {
			const fitRatio = System.Math.max(this.#fitMinimumRatio, fitWidth / textWidth);
			fontSize = System.Math.floor(this.#fontSize * fitRatio * 10) / 10;
		}
		const scaledFontString = buildFontString(fontFace, fontSize * bakeScale, this.#isBold, this.#isItalic);
		canvasRenderingContext.font = scaledFontString;
		canvasRenderingContext.direction = textDirection;
		canvasRenderingContext.textAlign = "left";
		const textMetrics = canvasRenderingContext.measureText(text);

		// 글자의 실제 경계와 글꼴의 위아래 경계. (재지 못하는 브라우저는 전진폭과 실제 경계로 대신한다)
		const actualLeft = System.Math.ceil(System.Math.max(textMetrics.actualBoundingBoxLeft || 0, 0));
		const actualRight = System.Math.ceil(System.Math.max(textMetrics.actualBoundingBoxRight || textMetrics.width, 0));
		let scaledFontAscent = textMetrics.fontBoundingBoxAscent;
		if (scaledFontAscent === undefined) {
			scaledFontAscent = textMetrics.actualBoundingBoxAscent || 0;
		}
		let scaledFontDescent = textMetrics.fontBoundingBoxDescent;
		if (scaledFontDescent === undefined) {
			scaledFontDescent = textMetrics.actualBoundingBoxDescent || 0;
		}
		const scaledShadowOffset = this.#shadowOffset * bakeScale;
		const scaledShadowBlur = this.#shadowBlur * bakeScale;

		// 번지는 그림자가 잘리지 않게 사방을 번지는 만큼 넓힌다.
		const bakePadding = BAKE_PADDING + System.Math.ceil(scaledShadowBlur);
		const scaledPenX = bakePadding + actualLeft;
		const scaledBaselineY = bakePadding + System.Math.ceil(scaledFontAscent);
		const bakeWidth = scaledPenX + actualRight + bakePadding;
		// 밑줄은 기준선 아래로 내려가므로 그만큼 여유를 더 둔다.
		const scaledDecorationLineWidth = System.Math.max(1, fontSize / 16) * bakeScale;
		const scaledMiddleY = scaledBaselineY - (scaledFontAscent - scaledFontDescent) * 0.5;
		const scaledUnderlineY = scaledMiddleY + (fontSize * 0.5 + 2) * bakeScale;
		let bakeHeight = scaledBaselineY + System.Math.ceil(scaledFontDescent + scaledShadowOffset) + bakePadding;
		if (this.#isUnderline) {
			bakeHeight = System.Math.max(bakeHeight, System.Math.ceil(scaledUnderlineY + scaledDecorationLineWidth * 0.5 + scaledShadowOffset) + bakePadding);
		}
		if (bakeWidth <= 0 || bakeHeight <= 0) {
			this.#bakeCanvas = null;
			return;
		}

		// 캔버스 크기를 바꾸면 상태가 처음으로 돌아가므로 글꼴을 다시 둔다.
		bakeCanvas.width = bakeWidth;
		bakeCanvas.height = bakeHeight;
		canvasRenderingContext.font = scaledFontString;
		canvasRenderingContext.direction = textDirection;
		canvasRenderingContext.textAlign = "left";
		canvasRenderingContext.textBaseline = "alphabetic";
		canvasRenderingContext.shadowColor = buildRGBAString(this.#shadowColor, this.#shadowOpacity);
		canvasRenderingContext.shadowBlur = scaledShadowBlur;
		canvasRenderingContext.shadowOffsetX = 0;
		canvasRenderingContext.shadowOffsetY = scaledShadowOffset;
		canvasRenderingContext.fillStyle = this.#textColor;
		canvasRenderingContext.fillText(text, scaledPenX, scaledBaselineY);
		// 밑줄과 취소선도 같은 그림자로 칠한다. (길이는 전진폭, Text 의 가운데 기준선과 같은 자리)
		if (this.#isUnderline) {
			canvasRenderingContext.fillRect(scaledPenX, scaledUnderlineY - scaledDecorationLineWidth * 0.5, textMetrics.width, scaledDecorationLineWidth);
		}
		if (this.#isStrikethrough) {
			canvasRenderingContext.fillRect(scaledPenX, scaledMiddleY - scaledDecorationLineWidth * 0.5, textMetrics.width, scaledDecorationLineWidth);
		}
		this.#bakeCanvas = bakeCanvas;
		this.#bakeMetrics = {
			scale: bakeScale,
			advanceWidth: textMetrics.width / bakeScale,
			penOffsetX: scaledPenX / bakeScale,
			baselineOffsetY: scaledBaselineY / bakeScale,
			fontAscent: scaledFontAscent / bakeScale,
			fontDescent: scaledFontDescent / bakeScale,
		};
	}

	//==============================================================================
	// 글 너비 재기. (처음 크기로, Text 와 같은 재기, 내용 크기 단위)
	//==============================================================================
	/**
	 * @param { Graphic } graphic 그래픽. (글 재기 캐시를 쓴다)
	 * @returns { number } 글 너비. (내용 크기 단위, 글이 비었으면 0)
	 */
	measureTextWidth(graphic) {
		const text = this.getText();
		if (text === "") {
			return 0;
		}
		const textStringTextureCache = graphic.getTextStringTextureCache();
		const fontFace = this.getFontFace();
		const fontString = buildFontString(fontFace, this.#fontSize, this.#isBold, this.#isItalic);
		const textMetrics = textStringTextureCache.measureText(fontString, text);
		return textMetrics.width;
	}

	//==============================================================================
	// 글 설정.
	//==============================================================================
	/**
	 * @param { string } text 보일 한 줄 글.
	 */
	setText(text) {
		this.#text = text;
	}

	//==============================================================================
	// 글 반환.
	//==============================================================================
	/**
	 * @returns { string } 글.
	 */
	getText() {
		return this.#text;
	}

	//==============================================================================
	// 글꼴 설정. (null 이면 시스템 글꼴)
	//==============================================================================
	/**
	 * @param { FontFace | null } fontFace 글꼴. (null 이면 시스템 글꼴)
	 */
	setFontFace(fontFace) {
		this.#fontFace = fontFace;
	}

	//==============================================================================
	// 글꼴 반환.
	//==============================================================================
	/**
	 * @returns { FontFace | null } 글꼴. (null 이면 시스템 글꼴)
	 */
	getFontFace() {
		return this.#fontFace;
	}

	//==============================================================================
	// 글의 꼴 설정. (처음 크기, 굵기, 색)
	//==============================================================================
	/**
	 * @param { number } fontSize 처음 글자 크기. (내용 크기 단위, 넘치면 줄여 굽는다)
	 * @param { boolean } isBold 굵게 할지.
	 * @param { string } textColor 글 색. ("#rrggbb" 나 CSS 색)
	 */
	setTextStyle(fontSize, isBold, textColor) {
		this.#fontSize = fontSize;
		this.#isBold = isBold;
		this.#textColor = textColor;
	}

	//==============================================================================
	// 처음 글자 크기 반환.
	//==============================================================================
	/**
	 * @returns { number } 처음 글자 크기.
	 */
	getFontSize() {
		return this.#fontSize;
	}

	//==============================================================================
	// 가로 정렬 설정.
	//==============================================================================
	/**
	 * @param { string } textAlign - "left", "center", "right", "start", "end"
	 */
	setTextAlign(textAlign) {
		this.#textAlign = textAlign;
	}

	//==============================================================================
	// 가로 정렬 반환.
	//==============================================================================
	/**
	 * @returns { string } 가로 정렬. ("left", "center", "right", "start", "end")
	 */
	getTextAlign() {
		return this.#textAlign;
	}

	//==============================================================================
	// 글 방향 설정. ("ltr", "rtl", "auto")
	//==============================================================================
	/**
	 * @param { string } textDirection 글 방향. ("ltr", "rtl", "auto", 그 밖의 값은 "ltr" 로 굽는다)
	 */
	setTextDirection(textDirection) {
		this.#textDirection = textDirection;
	}

	//==============================================================================
	// 글 방향 반환.
	//==============================================================================
	/**
	 * @returns { string } 글 방향. ("ltr", "rtl", "auto")
	 */
	getTextDirection() {
		return this.#textDirection;
	}

	//==============================================================================
	// 굽는 실제 방향. ("rtl" 이면 오른쪽에서 왼쪽, "auto" 는 글의 첫 강한 글자로, 그 밖은 "ltr")
	//==============================================================================
	/**
	 * @returns { string } "ltr" 또는 "rtl".
	 */
	resolveBakeTextDirection() {
		if (this.#textDirection === "rtl") {
			return "rtl";
		}
		if (this.#textDirection === "auto") {
			return detectTextDirection(this.#text);
		}
		return "ltr";
	}

	//==============================================================================
	// 굵게 여부.
	//==============================================================================
	/**
	 * @returns { boolean } 굵게면 참.
	 */
	isBold() {
		return this.#isBold;
	}

	//==============================================================================
	// 기울임 설정.
	//==============================================================================
	/**
	 * @param { boolean } isItalic 기울일지. (true 일 때만 기울인다)
	 */
	setItalic(isItalic) {
		this.#isItalic = isItalic === true;
	}

	//==============================================================================
	// 기울임 여부.
	//==============================================================================
	/**
	 * @returns { boolean } 기울임이면 참.
	 */
	isItalic() {
		return this.#isItalic;
	}

	//==============================================================================
	// 밑줄 설정.
	//==============================================================================
	/**
	 * @param { boolean } isUnderline 밑줄을 그을지. (true 일 때만 긋는다)
	 */
	setUnderline(isUnderline) {
		this.#isUnderline = isUnderline === true;
	}

	//==============================================================================
	// 밑줄 여부.
	//==============================================================================
	/**
	 * @returns { boolean } 밑줄이면 참.
	 */
	isUnderline() {
		return this.#isUnderline;
	}

	//==============================================================================
	// 취소선 설정.
	//==============================================================================
	/**
	 * @param { boolean } isStrikethrough 취소선을 그을지. (true 일 때만 긋는다)
	 */
	setStrikethrough(isStrikethrough) {
		this.#isStrikethrough = isStrikethrough === true;
	}

	//==============================================================================
	// 취소선 여부.
	//==============================================================================
	/**
	 * @returns { boolean } 취소선이면 참.
	 */
	isStrikethrough() {
		return this.#isStrikethrough;
	}

	//==============================================================================
	// 그림자 설정. (색, 불투명도, 글 아래로 내려가는 만큼, 번지는 만큼)
	//==============================================================================
	/**
	 * @param { string } shadowColor - "#rrggbb"
	 * @param { number } shadowOpacity 그림자 불투명도. (0 ~ 1)
	 * @param { number } shadowOffset 그림자가 글 아래로 내려가는 만큼. (내용 크기 단위)
	 * @param { number } shadowBlur - 0 이면 번지지 않는다.
	 */
	setShadow(shadowColor, shadowOpacity, shadowOffset, shadowBlur = 0) {
		this.#shadowColor = shadowColor;
		this.#shadowOpacity = shadowOpacity;
		this.#shadowOffset = shadowOffset;
		this.#shadowBlur = shadowBlur;
	}

	//==============================================================================
	// 넘칠 때 줄이는 가장 작은 비율 설정. (1 이면 줄이지 않는다)
	//==============================================================================
	/**
	 * @param { number } fitMinimumRatio 넘칠 때 줄이는 가장 작은 비율. (0.01 ~ 1 로 자른다, 1 이면 줄이지 않는다)
	 */
	setFitMinimumRatio(fitMinimumRatio) {
		this.#fitMinimumRatio = System.Math.max(0.01, System.Math.min(1, fitMinimumRatio));
	}

	//==============================================================================
	// 넘칠 때 줄이는 가장 작은 비율 반환.
	//==============================================================================
	/**
	 * @returns { number } 넘칠 때 줄이는 가장 작은 비율.
	 */
	getFitMinimumRatio() {
		return this.#fitMinimumRatio;
	}

	//==============================================================================
	// 구운 캔버스 반환. (아직 굽지 않았으면 null)
	//==============================================================================
	/**
	 * @returns { HTMLCanvasElement | null } 구운 캔버스. (아직 굽지 않았으면 null)
	 */
	getBakeCanvas() {
		return this.#bakeCanvas;
	}
}
