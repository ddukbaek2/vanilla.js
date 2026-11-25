//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Rect } from "../base/rect.js";
import { Graphic } from "../core/graphic.js";
import { FontAsset } from "../resource/fontasset.js";
import { splitGraphemes } from "../core/component/text.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
const ATLAS_MAX_WIDTH = 1024; // 아틀라스 최대 가로 크기 (px).
const ATLAS_PADDING = 2;      // 글리프 간 여백 (px).


//==============================================================================
// 글리프 정보.
//==============================================================================
export class GlyphInfo extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { string } */ char;       // 문자.
	/** @type { Rect } */ uvRect;       // 아틀라스 내 UV 좌표 및 크기.
	/** @type { number } */ advance;    // 수평 이동량 (advance width + 자간, px).
	/** @type { number } */ bearingX;   // 커서에서 글리프 좌측 픽셀까지 거리.
	/** @type { number } */ bearingY;   // 베이스라인에서 글리프 상단 픽셀까지 거리.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.char = "";
		this.uvRect = Rect.zero();
		this.advance = 0;
		this.bearingX = 0;
		this.bearingY = 0;
	}
}


//==============================================================================
// 다이나믹 폰트.
// - 정한 글자들을 한 글꼴, 한 크기로 글자 아틀라스(캔버스 한 장)에 모아 굽고, 글을 그릴 때 아틀라스에서 글리프를 잘라 그린다.
//   글자마다 같은 그림을 쓰므로 묶어 그리기가 끊기지 않는다. (문자열마다 텍스처를 굽는 Text 와 다르다)
//   점수, 피해 숫자, 시계처럼 글자가 자주 바뀌고 같은 글자를 많이 그리는 곳에 쓴다.
// - 글자는 글자 묶음(받침, 결합 부호, 이모지 묶음) 단위로 센다. 아틀라스에 없는 글자는 글자 크기의 반만큼 비우고 넘어간다.
// - buildAtlas 로 글자를 더하면 든 글자를 모두 새 캔버스에 다시 놓는다. (앞서 구운 글자의 자리가 새 캔버스와 어긋나지 않게)
//==============================================================================
export class DynamicFont extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { FontAsset } */ #fontAsset;                 // 폰트 애셋.
	/** @private @type { number } */ #fontSize;                     // 폰트 크기 (px).
	/** @private @type { number } */ #letterSpacing;                // 추가 자간 (px).
	/** @private @type { Map<string, GlyphInfo> } */ #glyphMap;     // 글리프 정보 맵.
	/** @private @type { string[] } */ #characterList;              // 아틀라스에 든 글자. (넣은 차례, 다시 구울 때 모두 놓는다)
	/** @private @type { HTMLCanvasElement } */ #atlasCanvas;       // 폰트 아틀라스 텍스처 캔버스.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.#fontAsset = null;
		this.#fontSize = 32;
		this.#letterSpacing = 0;
		this.#glyphMap = new Map();
		this.#characterList = [];
		this.#atlasCanvas = null;
	}

	//==============================================================================
	// 폰트 애셋 설정.
	//==============================================================================
	/**
	 * @param { FontAsset } fontAsset
	 */
	setFontAsset(fontAsset) {
		this.#fontAsset = fontAsset;
	}

	//==============================================================================
	// 폰트 크기 설정.
	//==============================================================================
	/**
	 * @param { number } fontSize
	 */
	setFontSize(fontSize) {
		this.#fontSize = fontSize;
	}

	//==============================================================================
	// 폰트 크기 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getFontSize() {
		return this.#fontSize;
	}

	//==============================================================================
	// 자간 설정.
	//==============================================================================
	/**
	 * @param { number } letterSpacing
	 */
	setLetterSpacing(letterSpacing) {
		this.#letterSpacing = letterSpacing;
	}

	//==============================================================================
	// 자간 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getLetterSpacing() {
		return this.#letterSpacing;
	}

	//==============================================================================
	// 아틀라스 캔버스 반환.
	//==============================================================================
	/**
	 * @returns { HTMLCanvasElement }
	 */
	getAtlasCanvas() {
		return this.#atlasCanvas;
	}

	//==============================================================================
	// 글리프 정보 반환.
	//==============================================================================
	/**
	 * @param { string } char
	 * @returns { GlyphInfo | null }
	 */
	getGlyph(char) {
		const glyphInfo = this.#glyphMap.get(char);
		if (glyphInfo === undefined) {
			return null;
		}
		return glyphInfo;
	}

	//==============================================================================
	// 아틀라스 빌드. (charset 의 글자 가운데 아직 없는 글자를 더하고, 아틀라스를 든 글자 모두로 다시 굽는다)
	//==============================================================================
	/**
	 * @param { string } charset
	 */
	buildAtlas(charset) {
		let isChanged = false;
		for (const character of splitGraphemes(charset)) {
			if (this.#characterList.includes(character)) {
				continue;
			}
			this.#characterList.push(character);
			isChanged = true;
		}
		if (!isChanged && this.#atlasCanvas !== null) {
			return;
		}
		this.rebuildAtlas();
	}

	//==============================================================================
	// 든 글자를 모두 다시 굽기. (글꼴, 크기, 자간을 바꾼 뒤 부른다)
	//==============================================================================
	rebuildAtlas() {
		const document = System.document;
		const fontFamily = this.#fontAsset ? this.#fontAsset.fontFace.family : "-apple-system, sans-serif";
		const fontSize = this.getFontSize();
		const fontString = `${fontSize}px ${fontFamily}`;

		// 글리프 메트릭스 측정용 임시 캔버스.
		const measureCanvas = document.createElement("canvas");
		measureCanvas.width = ATLAS_MAX_WIDTH;
		measureCanvas.height = fontSize * 2;
		const measureContext = measureCanvas.getContext("2d");
		measureContext.font = fontString;

		// 각 문자 메트릭스 측정.
		const entries = [];
		for (const char of this.#characterList) {
			const metrics = measureContext.measureText(char);
			const glyphPixelWidth = Math.ceil(metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight);
			const glyphPixelHeight = Math.ceil(metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent);
			const slotWidth = glyphPixelWidth + ATLAS_PADDING * 2;
			const slotHeight = glyphPixelHeight + ATLAS_PADDING * 2;
			entries.push({ char, metrics, glyphPixelWidth, glyphPixelHeight, slotWidth, slotHeight });
		}

		// 아틀라스 레이아웃 계산 (행 단위 배치).
		let cursorX = 0;
		let cursorY = 0;
		let rowHeight = 0;
		for (const entry of entries) {
			if (cursorX + entry.slotWidth > ATLAS_MAX_WIDTH) {
				cursorX = 0;
				cursorY += rowHeight;
				rowHeight = 0;
			}
			entry.atlasX = cursorX;
			entry.atlasY = cursorY;
			cursorX += entry.slotWidth;
			if (entry.slotHeight > rowHeight) {
				rowHeight = entry.slotHeight;
			}
		}
		const atlasHeight = Math.max(1, cursorY + rowHeight);

		// 아틀라스 캔버스 생성. (텍스처 캐시가 캔버스마다 한 번 올리므로 구울 때마다 새 캔버스)
		this.#atlasCanvas = document.createElement("canvas");
		const atlasCanvas = this.getAtlasCanvas();
		atlasCanvas.width = ATLAS_MAX_WIDTH;
		atlasCanvas.height = atlasHeight;
		const atlasContext = atlasCanvas.getContext("2d");
		atlasContext.font = fontString;
		atlasContext.fillStyle = "#ffffff";
		atlasContext.textBaseline = "alphabetic";

		// 글리프 렌더링 및 GlyphInfo 기록.
		this.#glyphMap.clear();
		const letterSpacing = this.getLetterSpacing();
		for (const entry of entries) {
			const fillX = entry.atlasX + ATLAS_PADDING + entry.metrics.actualBoundingBoxLeft;
			const fillY = entry.atlasY + ATLAS_PADDING + entry.metrics.actualBoundingBoxAscent;
			atlasContext.fillText(entry.char, fillX, fillY);

			const glyphInfo = new GlyphInfo();
			glyphInfo.char = entry.char;
			glyphInfo.uvRect = Rect.create(
				entry.atlasX + ATLAS_PADDING,
				entry.atlasY + ATLAS_PADDING,
				entry.glyphPixelWidth,
				entry.glyphPixelHeight
			);
			glyphInfo.advance = entry.metrics.width + letterSpacing;
			glyphInfo.bearingX = entry.metrics.actualBoundingBoxLeft;
			glyphInfo.bearingY = entry.metrics.actualBoundingBoxAscent;
			this.#glyphMap.set(entry.char, glyphInfo);
		}
	}

	//==============================================================================
	// 텍스트 렌더링 (아틀라스에서 글리프 샘플링).
	//==============================================================================
	/**
	 * @param { string } text
	 * @param { Vector2 } position  베이스라인 기준 좌상단 위치.
	 * @param { Graphic } graphic
	 */
	drawText(text, position, graphic) {
		const atlasCanvas = this.getAtlasCanvas();
		if (!atlasCanvas) {
			return;
		}

		let cursorX = position.x;
		const baselineY = position.y;
		const fontSize = this.getFontSize();

		for (const char of splitGraphemes(text)) {
			const glyphInfo = this.#glyphMap.get(char);
			if (!glyphInfo) {
				cursorX += fontSize * 0.5;
				continue;
			}
			if (glyphInfo.uvRect.size.x <= 0 || glyphInfo.uvRect.size.y <= 0) {
				cursorX += glyphInfo.advance;
				continue;
			}

			const destPosition = Vector2.create(cursorX - glyphInfo.bearingX, baselineY - glyphInfo.bearingY);
			const destSize = Vector2.create(glyphInfo.uvRect.size.x, glyphInfo.uvRect.size.y);
			graphic.drawImageWithImageRect(atlasCanvas, destPosition, destSize, glyphInfo.uvRect);
			cursorX += glyphInfo.advance;
		}
	}

	//==============================================================================
	// 글 너비 재기. (아틀라스의 전진폭 합, 없는 글자는 글자 크기의 반)
	//==============================================================================
	/**
	 * @param { string } text
	 * @returns { number }
	 */
	measureText(text) {
		let width = 0;
		for (const char of splitGraphemes(text)) {
			const glyphInfo = this.#glyphMap.get(char);
			width += glyphInfo ? glyphInfo.advance : this.getFontSize() * 0.5;
		}
		return width;
	}

	//==============================================================================
	// 글리프 맵 초기화.
	//==============================================================================
	clearAtlas() {
		this.#glyphMap.clear();
		this.#characterList = [];
		this.#atlasCanvas = null;
	}
}
