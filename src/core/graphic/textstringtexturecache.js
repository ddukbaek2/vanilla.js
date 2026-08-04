//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";
import * as Math from "../../base/math.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
const MAXIMUM_ENTRY_COUNT = 512; // 캐시 엔트리 상한.


//==============================================================================
// 문자열 텍스처 캐시.
// - WebGL2 에는 텍스트 API 가 없으므로, 오프스크린 2D 캔버스에 문자열을 굽고
//   GPU 텍스처로 업로드해 쿼드로 출력한다. 같은 (문자열, 폰트, 색, 스케일) 조합은
//   재굽기 없이 캐시를 재사용한다. (LRU, 퇴출 시 텍스처 삭제)
// - 추후 글리프 아틀라스 방식으로 교체할 때 이 클래스만 갈아끼우면 된다.
//==============================================================================
export class TextStringTextureCache extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { Map<string, object> } */ #entries;
	/** @private @type { HTMLCanvasElement } */ #bakeCanvas;
	/** @private @type { CanvasRenderingContext2D } */ #bakeCanvasRenderingContext;
	/** @private @type { CanvasRenderingContext2D } */ #measurementCanvasRenderingContext;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext
	 */
	constructor(webGL2RenderingContext) {
		super();

		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#entries = new Map();

		const bakeCanvas = System.document.createElement("canvas");
		this.#bakeCanvas = bakeCanvas;
		this.#bakeCanvasRenderingContext = bakeCanvas.getContext("2d", { willReadFrequently: false });

		const measurementCanvas = System.document.createElement("canvas");
		this.#measurementCanvasRenderingContext = measurementCanvas.getContext("2d");
	}

	//==============================================================================
	// 문자열 측정. (화면에 보이지 않는 오프스크린 컨텍스트 사용)
	//==============================================================================
	/**
	 * @param { string } fontString
	 * @param { string } text
	 * @returns { TextMetrics }
	 */
	measureText(fontString, text) {
		const measurementCanvasRenderingContext = this.getMeasurementCanvasRenderingContext();
		measurementCanvasRenderingContext.font = fontString;
		const textMetrics = measurementCanvasRenderingContext.measureText(text);
		return textMetrics;
	}

	//==============================================================================
	// 폰트 문자열의 픽셀 크기를 배율만큼 확대한 문자열 반환.
	//==============================================================================
	/**
	 * @param { string } fontString
	 * @param { number } scale
	 * @returns { string }
	 */
	buildScaledFontString(fontString, scale) {
		if (scale === 1) {
			return fontString;
		}

		return fontString.replace(/(\d+(?:\.\d+)?)px/, (matched, sizeText) => {
			const scaledSize = System.Number.parseFloat(sizeText) * scale;
			return `${scaledSize}px`;
		});
	}

	//==============================================================================
	// 문자열 텍스처 엔트리 반환. (없으면 굽기 후 반환)
	// - mode: "fill" 또는 "stroke".
	// - 반환 필드는 전부 논리 좌표(스케일 나눔) 기준.
	//==============================================================================
	/**
	 * @param { string } mode
	 * @param { string } text
	 * @param { string } fontString
	 * @param { string } colorString
	 * @param { number } lineWidth
	 * @param { number } scale
	 * @returns { object | null }
	 */
	getEntry(mode, text, fontString, colorString, lineWidth, scale) {
		if (!text) {
			return null;
		}

		const entryKey = `${mode}|${scale}|${lineWidth}|${colorString}|${fontString}|${text}`;
		const entries = this.getEntries();
		if (entries.has(entryKey)) {
			// LRU 갱신. (재삽입으로 최신화)
			const entry = entries.get(entryKey);
			entries.delete(entryKey);
			entries.set(entryKey, entry);
			return entry;
		}

		const entry = this.bakeEntry(mode, text, fontString, colorString, lineWidth, scale);
		if (!entry) {
			return null;
		}

		entries.set(entryKey, entry);

		// 상한 초과 시 가장 오래된 엔트리부터 퇴출. (GPU 텍스처 누수 방지)
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		while (entries.size > MAXIMUM_ENTRY_COUNT) {
			const oldestEntryKey = entries.keys().next().value;
			const oldestEntry = entries.get(oldestEntryKey);
			webGL2RenderingContext.deleteTexture(oldestEntry.texture);
			entries.delete(oldestEntryKey);
		}

		return entry;
	}

	//==============================================================================
	// 문자열을 오프스크린 캔버스에 굽고 텍스처로 업로드.
	//==============================================================================
	/**
	 * @param { string } mode
	 * @param { string } text
	 * @param { string } fontString
	 * @param { string } colorString
	 * @param { number } lineWidth
	 * @param { number } scale
	 * @returns { object | null }
	 */
	bakeEntry(mode, text, fontString, colorString, lineWidth, scale) {
		const bakeCanvas = this.getBakeCanvas();
		const bakeCanvasRenderingContext = this.getBakeCanvasRenderingContext();

		// 확대 배율이 적용된 폰트로 측정.
		const scaledFontString = this.buildScaledFontString(fontString, scale);
		bakeCanvasRenderingContext.font = scaledFontString;
		const scaledTextMetrics = bakeCanvasRenderingContext.measureText(text);

		// 글리프 실측 경계. (측정 미지원 브라우저는 전진폭 기반 근사)
		const actualLeft = Math.ceil(Math.max(scaledTextMetrics.actualBoundingBoxLeft || 0, 0));
		const actualRight = Math.ceil(Math.max(scaledTextMetrics.actualBoundingBoxRight || scaledTextMetrics.width, 0));

		// 폰트 상하 경계. (미지원 시 실측 경계로 폴백)
		let scaledFontAscent = scaledTextMetrics.fontBoundingBoxAscent;
		if (scaledFontAscent === undefined) {
			scaledFontAscent = scaledTextMetrics.actualBoundingBoxAscent || 0;
		}
		let scaledFontDescent = scaledTextMetrics.fontBoundingBoxDescent;
		if (scaledFontDescent === undefined) {
			scaledFontDescent = scaledTextMetrics.actualBoundingBoxDescent || 0;
		}

		// 아웃라인 두께와 안티앨리어싱 여유 패딩.
		const scaledPadding = Math.ceil((lineWidth * scale) / 2) + 2;

		// 굽기 좌표와 캔버스 크기.
		const scaledPenX = scaledPadding + actualLeft;
		const scaledBaselineY = scaledPadding + Math.ceil(scaledFontAscent);
		const bakeWidth = scaledPenX + actualRight + scaledPadding;
		const bakeHeight = scaledBaselineY + Math.ceil(scaledFontDescent) + scaledPadding;
		if (bakeWidth <= 0 || bakeHeight <= 0) {
			return null;
		}

		// 캔버스 크기 변경은 상태를 초기화하므로 이후에 폰트를 다시 설정.
		bakeCanvas.width = bakeWidth;
		bakeCanvas.height = bakeHeight;
		bakeCanvasRenderingContext.clearRect(0, 0, bakeWidth, bakeHeight);
		bakeCanvasRenderingContext.font = scaledFontString;
		bakeCanvasRenderingContext.textAlign = "left";
		bakeCanvasRenderingContext.textBaseline = "alphabetic";
		if (mode === "stroke") {
			bakeCanvasRenderingContext.strokeStyle = colorString;
			bakeCanvasRenderingContext.lineWidth = lineWidth * scale;
			bakeCanvasRenderingContext.strokeText(text, scaledPenX, scaledBaselineY);
		}
		else {
			bakeCanvasRenderingContext.fillStyle = colorString;
			bakeCanvasRenderingContext.fillText(text, scaledPenX, scaledBaselineY);
		}

		// 텍스처 업로드. (프리멀티플라이드 알파)
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const texture = webGL2RenderingContext.createTexture();
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, texture);
		webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
		webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.RGBA, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, bakeCanvas);
		webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, webGL2RenderingContext.LINEAR);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, webGL2RenderingContext.LINEAR);

		// 논리 좌표(스케일 나눔) 기준 메트릭 저장.
		const entry = {
			texture: texture,
			quadWidth: bakeWidth / scale,
			quadHeight: bakeHeight / scale,
			penOffsetX: scaledPenX / scale,
			baselineOffsetY: scaledBaselineY / scale,
			advanceWidth: scaledTextMetrics.width / scale,
			fontAscent: scaledFontAscent / scale,
			fontDescent: scaledFontDescent / scale,
		};
		return entry;
	}

	//==============================================================================
	// 모든 엔트리 파기. (텍스처 삭제 포함)
	//==============================================================================
	clear() {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const entries = this.getEntries();
		for (const entry of entries.values()) {
			webGL2RenderingContext.deleteTexture(entry.texture);
		}
		entries.clear();
	}

	//==============================================================================
	// 렌더링 컨텍스트 반환.
	//==============================================================================
	/**
	 * @returns { WebGL2RenderingContext }
	 */
	getWebGL2RenderingContext() {
		return this.#webGL2RenderingContext;
	}

	//==============================================================================
	// 엔트리 맵 반환.
	//==============================================================================
	/**
	 * @returns { Map<string, object> }
	 */
	getEntries() {
		return this.#entries;
	}

	//==============================================================================
	// 굽기용 캔버스 반환.
	//==============================================================================
	/**
	 * @returns { HTMLCanvasElement }
	 */
	getBakeCanvas() {
		return this.#bakeCanvas;
	}

	//==============================================================================
	// 굽기용 캔버스 렌더링 컨텍스트 반환.
	//==============================================================================
	/**
	 * @returns { CanvasRenderingContext2D }
	 */
	getBakeCanvasRenderingContext() {
		return this.#bakeCanvasRenderingContext;
	}

	//==============================================================================
	// 측정용 캔버스 렌더링 컨텍스트 반환.
	//==============================================================================
	/**
	 * @returns { CanvasRenderingContext2D }
	 */
	getMeasurementCanvasRenderingContext() {
		return this.#measurementCanvasRenderingContext;
	}
}
