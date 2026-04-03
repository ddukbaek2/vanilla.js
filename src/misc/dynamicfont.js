//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Rect } from "../base/rect.js";
import { Graphic } from "../core/graphic.js";
import { FontAsset } from "../resource/fontasset.js";


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
//==============================================================================
export class DynamicFont extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { FontAsset } */ #fontAsset;                 // 폰트 애셋.
	/** @private @type { number } */ #fontSize;                     // 폰트 크기 (px).
	/** @private @type { number } */ #letterSpacing;                // 추가 자간 (px).
	/** @private @type { Map<string, GlyphInfo> } */ #glyphMap;     // 글리프 정보 맵.
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
	// 아틀라스 빌드 (지정 문자셋을 폰트로부터 읽어 텍스처 아틀라스 생성).
	//==============================================================================
	/**
	 * @param { string } charset
	 */
	buildAtlas(charset) {
		const fontFamily = this.#fontAsset ? this.#fontAsset.fontFace.family : '-apple-system, sans-serif';
		const fontString = `${this.#fontSize}px ${fontFamily}`;

		// 글리프 메트릭스 측정용 임시 캔버스.
		const measureCanvas = document.createElement('canvas');
		measureCanvas.width = ATLAS_MAX_WIDTH;
		measureCanvas.height = this.#fontSize * 2;
		const measureContext = measureCanvas.getContext('2d');
		measureContext.font = fontString;

		// 각 문자 메트릭스 측정.
		const entries = [];
		for (const char of charset) {
			if (this.#glyphMap.has(char)) {
				continue;
			}
			const metrics = measureContext.measureText(char);
			const glyphPixelWidth = Math.ceil(metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight);
			const glyphPixelHeight = Math.ceil(metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent);
			const slotWidth = glyphPixelWidth + ATLAS_PADDING * 2;
			const slotHeight = glyphPixelHeight + ATLAS_PADDING * 2;
			entries.push({ char, metrics, glyphPixelWidth, glyphPixelHeight, slotWidth, slotHeight });
		}

		if (entries.length === 0) {
			return;
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
		const atlasHeight = cursorY + rowHeight;

		// 아틀라스 캔버스 생성.
		this.#atlasCanvas = document.createElement('canvas');
		this.#atlasCanvas.width = ATLAS_MAX_WIDTH;
		this.#atlasCanvas.height = atlasHeight;
		const atlasContext = this.#atlasCanvas.getContext('2d');
		atlasContext.font = fontString;
		atlasContext.fillStyle = '#ffffff';
		atlasContext.textBaseline = 'alphabetic';

		// 글리프 렌더링 및 GlyphInfo 기록.
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
			glyphInfo.advance = entry.metrics.width + this.#letterSpacing;
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
		if (!this.#atlasCanvas) {
			return;
		}

		let cursorX = position.x;
		const baselineY = position.y;

		for (const char of text) {
			const glyphInfo = this.#glyphMap.get(char);
			if (!glyphInfo) {
				cursorX += this.#fontSize * 0.5;
				continue;
			}

			const destPosition = Vector2.create(cursorX - glyphInfo.bearingX, baselineY - glyphInfo.bearingY);
			const destSize = Vector2.create(glyphInfo.uvRect.size.x, glyphInfo.uvRect.size.y);
			graphic.drawImageWithImageRect(this.#atlasCanvas, destPosition, destSize, glyphInfo.uvRect);
			cursorX += glyphInfo.advance;
		}
	}

	//==============================================================================
	// 글리프 맵 초기화.
	//==============================================================================
	clearAtlas() {
		this.#glyphMap.clear();
		this.#atlasCanvas = null;
	}
}
