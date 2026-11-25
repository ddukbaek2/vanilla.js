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
// 글자 안티앨리어싱. 끄면 구운 글자의 알파를 문턱값으로 0 과 255 로 가르고 텍스처를 NEAREST 로 뽑는다.
// 도트 글꼴을 설계 크기의 정수 배로 그리는 프로젝트가 끈다. 기본은 켜짐이라 동작이 바뀌지 않는다.
let isTextAntialiasEnabled = true;
const ALPHA_THRESHOLD = 128;


//==============================================================================
// 글자 안티앨리어싱 켬 / 끔.
//
// 켜고 끈 다음에 굽는 글자부터 적용된다. 이미 구워 둔 글자는 그대로다.
//==============================================================================
/**
 * @param { boolean } value
 */
export function setTextAntialiasEnabled(value) {
	isTextAntialiasEnabled = value;
}


//==============================================================================
// 글자 안티앨리어싱이 켜져 있는지.
//==============================================================================
/**
 * @returns { boolean }
 */
export function isTextAntialiasOn() {
	return isTextAntialiasEnabled;
}


//==============================================================================
// 글 재기 캐시. (글꼴 문자열과 글이 같으면 다시 재지 않는다, measureTextMetrics)
// - 오래 안 쓴 것부터 버린다. (MAXIMUM_MEASURE_COUNT 개까지)
// - 웹 글꼴의 조각이 받아지거나(loadingdone) 문서의 글꼴 얼굴 수가 바뀌면 통째로 비운다. (받기 전에 잰 너비는 대신 쓴 글꼴의 너비다)
//==============================================================================
const MAXIMUM_MEASURE_COUNT = 2048;
const measureCache = new System.Map();
let measureCanvasRenderingContext = null;
let measureFontLoadCount = 0;
let measuredFontLoadCount = 0;
let measuredFontFaceCount = -1;
if (System.document !== undefined && System.document.fonts !== undefined) {
	System.document.fonts.addEventListener("loadingdone", () => {
		measureFontLoadCount += 1;
	});
}

//==============================================================================
// 글 재기. (캐시를 거친다, 문서가 없으면 null)
// - 돌려준 TextMetrics 는 캐시가 나눠 쓰므로 고치지 않는다.
//==============================================================================
/**
 * @param { string } fontString
 * @param { string } text
 * @returns { TextMetrics | null }
 */
export function measureTextMetrics(fontString, text) {
	const document = System.document;
	if (document === undefined || document === null) {
		return null;
	}
	if (measureCanvasRenderingContext === null) {
		const measureCanvas = document.createElement("canvas");
		measureCanvasRenderingContext = measureCanvas.getContext("2d");
	}
	const fontFaceCount = document.fonts !== undefined ? document.fonts.size : 0;
	if (measuredFontLoadCount !== measureFontLoadCount || measuredFontFaceCount !== fontFaceCount) {
		measureCache.clear();
		measuredFontLoadCount = measureFontLoadCount;
		measuredFontFaceCount = fontFaceCount;
	}
	const cacheKey = fontString + "\u0000" + text;
	const cachedTextMetrics = measureCache.get(cacheKey);
	if (cachedTextMetrics !== undefined) {
		measureCache.delete(cacheKey);
		measureCache.set(cacheKey, cachedTextMetrics);
		return cachedTextMetrics;
	}
	measureCanvasRenderingContext.font = fontString;
	const textMetrics = measureCanvasRenderingContext.measureText(text);
	measureCache.set(cacheKey, textMetrics);
	while (measureCache.size > MAXIMUM_MEASURE_COUNT) {
		const oldestKey = measureCache.keys().next().value;
		measureCache.delete(oldestKey);
	}
	return textMetrics;
}

//==============================================================================
// 글 재기 캐시에 든 수. (시험과 통계용)
//==============================================================================
/**
 * @returns { number }
 */
export function readMeasureCacheCount() {
	return measureCache.size;
}


//==============================================================================
// unicode-range 글 → 코드 포인트 범위 목록. ("U+0-FF, U+4??" → [[0, 255], [1024, 1279]], 비었으면 전체)
//==============================================================================
/**
 * @param { string } unicodeRange
 * @returns { number[][] }
 */
function parseUnicodeRange(unicodeRange) {
	const ranges = [];
	if (typeof unicodeRange !== "string" || unicodeRange === "") {
		ranges.push([0, 0x10ffff]);
		return ranges;
	}
	for (const rangeText of unicodeRange.split(",")) {
		const rangeMatch = rangeText.trim().match(/^U\+([0-9a-fA-F?]+)(?:-([0-9a-fA-F]+))?$/i);
		if (rangeMatch === null) {
			continue;
		}
		const startText = rangeMatch[1].replace(/\?/g, "0");
		const endText = rangeMatch[2] !== undefined ? rangeMatch[2] : rangeMatch[1].replace(/\?/g, "F");
		ranges.push([System.parseInt(startText, 16), System.parseInt(endText, 16)]);
	}
	return ranges;
}


//==============================================================================
// 글에 범위 안의 글자가 있는지.
//==============================================================================
/**
 * @param { string } text
 * @param { number[][] } ranges
 * @returns { boolean }
 */
function hasCharacterInRanges(text, ranges) {
	for (const character of text) {
		const codePoint = character.codePointAt(0);
		for (const range of ranges) {
			if (codePoint >= range[0] && codePoint <= range[1]) {
				return true;
			}
		}
	}
	return false;
}


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
	/** @private @type { Map<string, object[]> } */ #entriesByText; // 문자열마다 그 문자열의 엔트리 목록. (찾을 때 열쇠 문자열을 만들지 않으려고)
	/** @private @type { HTMLCanvasElement } */ #bakeCanvas;
	/** @private @type { CanvasRenderingContext2D } */ #bakeCanvasRenderingContext;
	/** @private @type { CanvasRenderingContext2D } */ #measurementCanvasRenderingContext;
	/** @private @type { ((texture: WebGLTexture) => void) | null } */ #textureBinder; // 텍스처를 묶는 함수. (주인 Graphic 이 묶은 텍스처를 기억하게 넘긴다, null 이면 바로 묶는다)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext
	 * @param { ((texture: WebGLTexture) => void) | null } textureBinder - 텍스처를 묶는 함수. (null 이면 바로 묶는다)
	 */
	constructor(webGL2RenderingContext, textureBinder = null) {
		super();

		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#entries = new Map();
		this.#entriesByText = new Map();
		this.#textureBinder = textureBinder;

		const bakeCanvas = System.document.createElement("canvas");
		this.#bakeCanvas = bakeCanvas;
		this.#bakeCanvasRenderingContext = bakeCanvas.getContext("2d", { willReadFrequently: false });

		const measurementCanvas = System.document.createElement("canvas");
		this.#measurementCanvasRenderingContext = measurementCanvas.getContext("2d");
	}

	//==============================================================================
	// 문자열 측정. (화면에 보이지 않는 오프스크린 컨텍스트 사용, 글꼴 문자열과 글이 같으면 캐시한 것을 준다)
	// - 돌려준 TextMetrics 는 캐시가 나눠 쓰므로 고치지 않는다. (measureTextMetrics)
	//==============================================================================
	/**
	 * @param { string } fontString
	 * @param { string } text
	 * @returns { TextMetrics }
	 */
	measureText(fontString, text) {
		const textMetrics = measureTextMetrics(fontString, text);
		if (textMetrics !== null) {
			return textMetrics;
		}
		const measurementCanvasRenderingContext = this.getMeasurementCanvasRenderingContext();
		measurementCanvasRenderingContext.font = fontString;
		return measurementCanvasRenderingContext.measureText(text);
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
	// - textDirection: 문단의 방향. ("ltr" 또는 "rtl", 캔버스의 direction 으로 굽는다)
	// - 반환 필드는 전부 논리 좌표(스케일 나눔) 기준.
	//==============================================================================
	/**
	 * @param { string } mode
	 * @param { string } text
	 * @param { string } fontString
	 * @param { string } colorString
	 * @param { number } lineWidth
	 * @param { number } scale
	 * @param { string } textDirection 기본 "ltr".
	 * @returns { object | null }
	 */
	getEntry(mode, text, fontString, colorString, lineWidth, scale, textDirection = "ltr") {
		if (!text) {
			return null;
		}

		// 그릴 때마다 열쇠 문자열을 만들지 않고, 문자열로 엔트리 목록을 찾아 나머지 값을 견준다. (열쇠 문자열은 구울 때 한 번 만들어 엔트리에 둔다)
		const entries = this.getEntries();
		const entryList = this.#entriesByText.get(text);
		if (entryList !== undefined) {
			for (const entry of entryList) {
				if (entry.mode !== mode || entry.textDirection !== textDirection || entry.scale !== scale || entry.lineWidth !== lineWidth || entry.colorString !== colorString || entry.fontString !== fontString) {
					continue;
				}
				// LRU 갱신. (재삽입으로 최신화)
				const entryKey = entry.entryKey;
				entries.delete(entryKey);
				entries.set(entryKey, entry);
				return entry;
			}
		}

		const entryKey = `${mode}|${textDirection}|${scale}|${lineWidth}|${colorString}|${fontString}|${text}`;
		const entry = this.bakeEntry(mode, text, fontString, colorString, lineWidth, scale, textDirection);
		if (!entry) {
			return null;
		}

		entry.entryKey = entryKey;
		entry.mode = mode;
		entry.text = text;
		entry.fontString = fontString;
		entry.colorString = colorString;
		entry.lineWidth = lineWidth;
		entry.scale = scale;
		entry.textDirection = textDirection;

		// 값은 달라도 열쇠 문자열이 같은 엔트리(글꼴 문자열에 | 가 든 때 등)는 지금처럼 새 것으로 바꾼다.
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const collidedEntry = entries.get(entryKey);
		if (collidedEntry !== undefined) {
			webGL2RenderingContext.deleteTexture(collidedEntry.texture);
			this.removeEntry(entryKey, collidedEntry);
		}
		entries.set(entryKey, entry);
		const textEntryList = this.#entriesByText.get(text);
		if (textEntryList !== undefined) {
			textEntryList.push(entry);
		}
		else {
			this.#entriesByText.set(text, [entry]);
		}

		// 상한 초과 시 가장 오래된 엔트리부터 퇴출. (GPU 텍스처 누수 방지)
		while (entries.size > MAXIMUM_ENTRY_COUNT) {
			const oldestEntryKey = entries.keys().next().value;
			const oldestEntry = entries.get(oldestEntryKey);
			webGL2RenderingContext.deleteTexture(oldestEntry.texture);
			this.removeEntry(oldestEntryKey, oldestEntry);
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
	 * @param { string } textDirection 기본 "ltr".
	 * @returns { object | null }
	 */
	bakeEntry(mode, text, fontString, colorString, lineWidth, scale, textDirection = "ltr") {
		const bakeCanvas = this.getBakeCanvas();
		const bakeCanvasRenderingContext = this.getBakeCanvasRenderingContext();

		// 확대 배율이 적용된 폰트로 측정.
		const scaledFontString = this.buildScaledFontString(fontString, scale);
		bakeCanvasRenderingContext.font = scaledFontString;
		bakeCanvasRenderingContext.direction = textDirection;
		// 경계는 왼쪽 기준으로 잰다. (오른쪽에서 왼쪽 방향의 기본 정렬 "start" 는 오른쪽 기준이다)
		bakeCanvasRenderingContext.textAlign = "left";
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
		bakeCanvasRenderingContext.direction = textDirection;
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

		// 안티앨리어싱을 끈 경우: 알파를 문턱값으로 갈라 가장자리의 반투명 픽셀을 없앤다.
		if (!isTextAntialiasEnabled) {
			const imageData = bakeCanvasRenderingContext.getImageData(0, 0, bakeWidth, bakeHeight);
			const pixels = imageData.data;
			for (let pixelIndex = 3; pixelIndex < pixels.length; pixelIndex += 4) {
				pixels[pixelIndex] = pixels[pixelIndex] >= ALPHA_THRESHOLD ? 255 : 0;
			}
			bakeCanvasRenderingContext.putImageData(imageData, 0, 0);
		}

		// 텍스처 업로드. (프리멀티플라이드 알파)
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const texture = webGL2RenderingContext.createTexture();
		this.bindTexture(texture);
		webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
		webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.RGBA, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, bakeCanvas);
		webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);
		const textureFilter = isTextAntialiasEnabled ? webGL2RenderingContext.LINEAR : webGL2RenderingContext.NEAREST;
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, textureFilter);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, textureFilter);

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
		this.#entriesByText.clear();
	}

	//==============================================================================
	// 엔트리 하나를 맵과 문자열별 목록에서 뺀다. (텍스처는 부르는 쪽이 지운다)
	//==============================================================================
	/**
	 * @param { string } entryKey
	 * @param { object } entry
	 */
	removeEntry(entryKey, entry) {
		const entries = this.getEntries();
		entries.delete(entryKey);
		const entryList = this.#entriesByText.get(entry.text);
		if (entryList === undefined) {
			return;
		}
		const entryIndex = entryList.indexOf(entry);
		if (entryIndex >= 0) {
			entryList.splice(entryIndex, 1);
		}
		if (entryList.length === 0) {
			this.#entriesByText.delete(entry.text);
		}
	}

	//==============================================================================
	// 받아진 웹 폰트로 다시 구울 엔트리 파기.
	//
	// 늦게 받아진 폰트 얼굴(FontFace)의 이름을 쓰는 폰트 문자열로 구웠고, 그 얼굴의 글자 범위(unicodeRange)에 든 글자가 있는
	// 엔트리만 텍스처째 버린다. 다음에 그 글자를 그릴 때 받은 폰트로 다시 굽는다. 나머지 엔트리는 그대로 쓴다.
	// (캐시를 통째로 비우면 폰트가 받아질 때마다 모든 글자를 한꺼번에 다시 구워 그 프레임이 길어진다)
	//==============================================================================
	/**
	 * @param { Iterable<FontFace> } fontFaces
	 * @returns { number } 버린 엔트리 수.
	 */
	invalidateFontFaces(fontFaces) {
		const targets = [];
		for (const fontFace of fontFaces) {
			const familyName = System.String(fontFace.family).replace(/["']/g, "").trim().toLowerCase();
			if (familyName === "") {
				continue;
			}
			targets.push({ familyName: familyName, ranges: parseUnicodeRange(fontFace.unicodeRange) });
		}
		if (targets.length === 0) {
			return 0;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const entries = this.getEntries();
		let removedCount = 0;
		for (const [entryKey, entry] of System.Array.from(entries)) {
			// 열쇠는 mode|textDirection|scale|lineWidth|colorString|fontString|text 이다. (글에는 | 가 들 수 있다)
			const keyParts = entryKey.split("|");
			const fontString = keyParts.length > 5 ? keyParts[5].toLowerCase() : "";
			const text = keyParts.slice(6).join("|");
			const isAffected = targets.some((target) => {
				return fontString.includes(target.familyName) && hasCharacterInRanges(text, target.ranges);
			});
			if (!isAffected) {
				continue;
			}
			webGL2RenderingContext.deleteTexture(entry.texture);
			this.removeEntry(entryKey, entry);
			removedCount += 1;
		}
		return removedCount;
	}

	//==============================================================================
	// 텍스처 묶기. (받은 묶는 함수가 있으면 그것으로)
	//==============================================================================
	/**
	 * @param { WebGLTexture } texture
	 */
	bindTexture(texture) {
		const textureBinder = this.#textureBinder;
		if (textureBinder) {
			textureBinder(texture);
			return;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, texture);
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
