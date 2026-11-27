//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";
import * as Math from "../../base/math.js";
import { SYSTEM_FONT_STRING } from "../../base/platform.js";

/**
 * @example <caption>Graphic 없이 글 너비 재기</caption>
 * import { measureTextWithoutGraphic } from "./build/vanilla.js";
 *
 * const textMetrics = measureTextWithoutGraphic("bold 16px sans-serif", "Hello");
 * if (textMetrics !== null) {
 * 	console.log(textMetrics.width);
 * }
 */


//==============================================================================
// 전역 상수 목록.
//==============================================================================
const MAXIMUM_ENTRY_COUNT = 1024; // 글 배치 엔트리 상한. (엔트리는 글리프 사각형 목록뿐이라 텍스처가 없다)
const ATLAS_PAGE_SIZE = 1024; // 글리프 아틀라스 한 장의 너비와 높이. (텍셀)
const MAXIMUM_ATLAS_PAGE_COUNT = 8; // 아틀라스 장 수 상한. (넘으면 가장 오래 안 쓴 장을 비워 다시 쓴다)
const SUBPIXEL_SLOT_COUNT = 8; // 글리프 가로 자리 칸 수. (스키아 서브픽셀 4 칸의 경계 1/8, 3/8, 5/8, 7/8 과 정수 반올림 경계 1/2 를 모두 담는 1/8 칸)
const MAXIMUM_ATLAS_FONT_SIZE = 256; // 이보다 큰 글꼴은 스키아가 글리프를 패스로 칠해 자리를 칸으로 묶지 않으므로 문자열째 굽는다. (SkStrikeSpec::ShouldDrawAsPath)
const STROKE_MITER_LIMIT = 10; // 캔버스 miterLimit 기본값. (바깥선 글리프 칸의 여유)
const RIGHT_TO_LEFT_PATTERN = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF\u{10800}-\u{10FFF}\u{1E800}-\u{1EFFF}]/u; // 오른쪽에서 왼쪽 글자. (히브리, 아랍, 시리아 같은)
const JOINING_CLUSTER_PATTERN = /^[\p{L}\p{M}]/u; // 글자 덩어리가 낱말 안에서 합자, 이어진 꼴로 이웃과 엮일 수 있는지. (글자, 결합 부호로 시작)
const STANDALONE_SCRIPT_PATTERN = /^[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Bopomofo}]/u; // 글자 덩어리마다 따로 그려도 되는 글자. (한글, 한자, 가나)
const COMBINING_MARK_PATTERN = /\p{M}/u;
const EMOJI_CLUSTER_PATTERN = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
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
// 글꼴 크기 낱말. (CSS font 줄임 꼴에서 이 낱말 뒤가 글꼴 이름 목록이다, 줄높이 "/20px" 가 붙을 수 있다)
//==============================================================================
const FONT_SIZE_PATTERN = /^(?:[+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?(?:px|pt|pc|in|cm|mm|q|em|rem|ex|ch|vw|vh|vmin|vmax|%)|xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large|larger|smaller)(?:\/.*)?$/i;
const DEFAULT_FONT_FAMILY = "default"; // 엔진 기본 글꼴 이름. (러스트 판 Text, DynamicFont 의 처음 글꼴 이름)

//==============================================================================
// 글꼴 글의 기본 글꼴 이름 default 를 엔진 기본 글꼴 사슬로 풀기. (러스트 판 TextStringTextureCache 의 글꼴 찾기와 같다)
// - 이름 목록에 default(따옴표를 쳐도, 대소문자를 가리지 않는다)가 있으면 그 자리는 그 이름으로 올린 글꼴만 찾고("default" 로 따옴표를 친다),
//   목록 끝에 엔진 기본 글꼴 사슬 SYSTEM_FONT_STRING 을 잇는다. (러스트 판은 이름 목록 다음에 기본 폰트, 시스템 글꼴 사슬 차례로 찾는다)
// - CSS 에서 따옴표 없는 default 는 예약어라 캔버스가 그 글꼴 글을 통째로 버린다. (크롬은 앞의 글꼴을 그대로 둔다)
// - default 가 없거나 크기 낱말을 찾지 못한 글은 그대로 돌려준다.
//==============================================================================
/**
 * @param { string } fontString CSS 글꼴 글. (예: "bold 16px default")
 * @returns { string } 캔버스에 넣을 글꼴 글.
 */
function resolveFontString(fontString) {
	if (!/default/i.test(fontString)) {
		return fontString;
	}

	// 크기 낱말을 찾아 그 뒤를 이름 목록으로 본다. (앞의 기울임, 굵기 같은 낱말에는 따옴표와 쉼표가 없다)
	const wordPattern = /\S+/g;
	let familyListStart = -1;
	let wordMatch = wordPattern.exec(fontString);
	while (wordMatch !== null) {
		if (wordMatch[0].includes(",") || wordMatch[0].includes("\"") || wordMatch[0].includes("'")) {
			break;
		}
		if (FONT_SIZE_PATTERN.test(wordMatch[0])) {
			familyListStart = wordMatch.index + wordMatch[0].length;
			// 줄높이를 빈칸을 두고 적은 꼴. ("16px / 20px")
			const lineHeightMatch = /^\s*\/\s*\S+/.exec(fontString.slice(familyListStart));
			if (lineHeightMatch !== null && !wordMatch[0].includes("/")) {
				familyListStart += lineHeightMatch[0].length;
			}
			break;
		}
		wordMatch = wordPattern.exec(fontString);
	}
	if (familyListStart < 0) {
		return fontString;
	}

	// 쉼표로 이름을 나눈다. (따옴표 안의 쉼표는 이름의 글자다)
	const familyListText = fontString.slice(familyListStart);
	const familyNameList = [];
	let familyName = "";
	let quoteCharacter = "";
	for (const character of familyListText) {
		if (quoteCharacter !== "") {
			familyName += character;
			if (character === quoteCharacter) {
				quoteCharacter = "";
			}
			continue;
		}
		if (character === "\"" || character === "'") {
			quoteCharacter = character;
			familyName += character;
			continue;
		}
		if (character === ",") {
			familyNameList.push(familyName.trim());
			familyName = "";
			continue;
		}
		familyName += character;
	}
	familyNameList.push(familyName.trim());

	let isDefaultRequested = false;
	const resolvedFamilyNameList = familyNameList.map((name) => {
		const unquotedName = /^(["'])(.*)\1$/.exec(name);
		const bareName = unquotedName !== null ? unquotedName[2] : name;
		if (bareName.toLowerCase() !== DEFAULT_FONT_FAMILY) {
			return name;
		}
		isDefaultRequested = true;
		return `"${DEFAULT_FONT_FAMILY}"`;
	});
	if (!isDefaultRequested) {
		return fontString;
	}
	resolvedFamilyNameList.push(SYSTEM_FONT_STRING);
	return fontString.slice(0, familyListStart).trimEnd() + " " + resolvedFamilyNameList.join(", ");
}

//==============================================================================
// 글 재기. (캐시를 거친다, 문서가 없으면 null)
// - 돌려준 TextMetrics 는 캐시가 나눠 쓰므로 고치지 않는다.
// - 기본 글꼴 이름 default 는 엔진 기본 글꼴 사슬로 잰다. (resolveFontString)
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
	measureCanvasRenderingContext.font = resolveFontString(fontString);
	const textMetrics = measureCanvasRenderingContext.measureText(text);
	measureCache.set(cacheKey, textMetrics);
	while (measureCache.size > MAXIMUM_MEASURE_COUNT) {
		const oldestKey = measureCache.keys().next().value;
		measureCache.delete(oldestKey);
	}
	return textMetrics;
}

//==============================================================================
// Graphic 없이 글 재기. (measureTextMetrics 와 같다, 러스트 판 measure_text_without_graphic 과 같은 이름. 문서가 없으면 null)
//==============================================================================
/**
 * @param { string } fontString CSS 글꼴 글. (예: "bold 16px sans-serif")
 * @param { string } text 잴 글.
 * @returns { TextMetrics | null } 글의 치수. (캐시가 나눠 쓰므로 고치지 않는다, 문서가 없으면 null)
 */
export function measureTextWithoutGraphic(fontString, text) {
	return measureTextMetrics(fontString, text);
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
// 글리프 아틀라스 글 캐시. (이름은 예전 문자열 텍스처 캐시 그대로)
// - WebGL2 에는 글자 API 가 없으므로 오프스크린 2D 캔버스의 fillText 로 글리프를 굽고 아틀라스 텍스처에 올려 사각형으로 그린다.
// - 스키아 글리프 캐시(strike), 유니티 TextMeshPro 동적 아틀라스, 언리얼 폰트 캐시와 같은 꼴이다.
//   글꼴(모드, 글꼴 글, 굽는 배율, 선 굵기)마다 글리프를 한 번만 굽고, 문자열은 글리프 사각형을 배치에 넣어 그린다.
//   새 문자열은 처음 보는 글리프만 굽는다. 같은 아틀라스 장의 글자는 한 번에 묶여 그려진다.
// - 결과는 문자열을 fillText 로 통째로 그린 것과 화소까지 같게 맞춘다.
//   크롬(스키아)은 글리프를 가로 서브픽셀 4 칸(SkPackedGlyphID kSubPixelPosLen 2, 반올림 1/8)으로 묶어 따로 래스터하고 정수 자리에 겹쳐 찍는다.
//   그래서 (글자 덩어리, 1/8 자리 칸) 열쇠로 구운 글리프를 measureText 로 잰 자리에 놓으면 통째로 그린 것과 같다.
//   서브픽셀 자리가 꺼진 기계(정수 반올림, 경계 1/2)도 1/8 칸이 경계를 담아 같다.
// - 글자 덩어리(Intl.Segmenter 의 grapheme)마다 하나씩 굽는다. 합자나 이어진 꼴이 생길 수 있는 글자(라틴, 키릴 같은 글자의 낱말)는
//   낱말째 한 덩어리로 굽는다. 한글, 한자, 가나, 숫자, 문장 부호, 이모지는 덩어리마다 따로다.
// - 오른쪽에서 왼쪽 글(아랍어, 히브리어), 아주 큰 글꼴, Intl.Segmenter 가 없는 곳은 문자열째 한 덩어리로 굽는다. (예전과 같다)
// - 아틀라스 장이 차면 새 장을 열고, 장 수가 상한이면 가장 오래 안 쓴 장을 비워 다시 쓴다.
//==============================================================================
export class TextStringTextureCache extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { Map<string, object> } */ #entries; // 글 배치 엔트리. (LRU)
	/** @private @type { Map<string, object[]> } */ #entriesByText; // 문자열마다 그 문자열의 엔트리 목록. (찾을 때 열쇠 문자열을 만들지 않으려고)
	/** @private @type { Map<string, object> } */ #glyphs; // 구운 글리프. (열쇠: 글꼴 열쇠, 글자 덩어리, 자리 열쇠)
	/** @private @type { object[] } */ #atlasPages; // 아틀라스 장 목록.
	/** @private @type { number } */ #useSerial; // 엔트리를 줄 때마다 늘리는 번호. (장의 LRU)
	/** @private @type { number } */ #bakedGlyphCount; // 지금까지 구운 글리프 수. (통계)
	/** @private @type { number } */ #uploadCount; // 지금까지 아틀라스에 올린 수. (통계, 굽기 캔버스 한 장이 한 번)
	/** @private @type { object | null } */ #segmenter; // 글자 덩어리 나누기. (Intl.Segmenter, 없으면 null)
	/** @private @type { HTMLCanvasElement } */ #bakeCanvas;
	/** @private @type { CanvasRenderingContext2D } */ #bakeCanvasRenderingContext;
	/** @private @type { CanvasRenderingContext2D } */ #measurementCanvasRenderingContext;
	/** @private @type { CanvasRenderingContext2D } */ #layoutCanvasRenderingContext; // 글 배치 재기용. (글꼴을 바꿀 때만 다시 건다)
	/** @private @type { ((texture: WebGLTexture) => void) | null } */ #textureBinder; // 텍스처를 묶는 함수. (주인 Graphic 이 묶은 텍스처를 기억하게 넘긴다, null 이면 바로 묶는다)
	/** @private @type { (() => void) | null } */ #beforeTextureOverwrite; // 아틀라스 장을 비워 덮어쓰기 전에 부르는 함수. (주인 Graphic 이 쌓아 둔 묶음을 먼저 그린다)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext
	 * @param { ((texture: WebGLTexture) => void) | null } textureBinder - 텍스처를 묶는 함수. (null 이면 바로 묶는다)
	 * @param { (() => void) | null } beforeTextureOverwrite - 아틀라스 장을 비워 덮어쓰기 전에 부르는 함수. (쌓아 둔 그리기를 먼저 내보낸다, null 이면 부르지 않는다)
	 */
	constructor(webGL2RenderingContext, textureBinder = null, beforeTextureOverwrite = null) {
		super();

		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#entries = new Map();
		this.#entriesByText = new Map();
		this.#glyphs = new Map();
		this.#atlasPages = [];
		this.#useSerial = 0;
		this.#bakedGlyphCount = 0;
		this.#uploadCount = 0;
		this.#textureBinder = textureBinder;
		this.#beforeTextureOverwrite = beforeTextureOverwrite;
		this.#segmenter = System.Intl !== undefined && typeof System.Intl.Segmenter === "function" ? new System.Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

		const bakeCanvas = System.document.createElement("canvas");
		this.#bakeCanvas = bakeCanvas;
		this.#bakeCanvasRenderingContext = bakeCanvas.getContext("2d", { willReadFrequently: false });

		const measurementCanvas = System.document.createElement("canvas");
		this.#measurementCanvasRenderingContext = measurementCanvas.getContext("2d");

		const layoutCanvas = System.document.createElement("canvas");
		this.#layoutCanvasRenderingContext = layoutCanvas.getContext("2d");
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
		measurementCanvasRenderingContext.font = resolveFontString(fontString);
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
	// 글 배치 엔트리 반환. (없으면 배치하고 처음 보는 글리프만 구워 반환)
	// - mode: "fill" 또는 "stroke".
	// - textDirection: 문단의 방향. ("ltr" 또는 "rtl", 캔버스의 direction 으로 굽는다)
	// - 반환 필드는 전부 논리 좌표(스케일 나눔) 기준. 문자열을 통째로 구웠을 때의 사각형(quadWidth, quadHeight, penOffsetX, baselineOffsetY)과
	//   그 사각형 왼쪽 위 기준의 글리프 사각형(glyphTextures, glyphRects 의 왼, 위, 오른, 아래, u0, v0, u1, v1 여덟 값씩)을 준다.
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

		this.#useSerial += 1;
		const useSerial = this.#useSerial;

		// 그릴 때마다 열쇠 문자열을 만들지 않고, 문자열로 엔트리 목록을 찾아 나머지 값을 견준다. (열쇠 문자열은 배치할 때 한 번 만들어 엔트리에 둔다)
		const entries = this.getEntries();
		const entryList = this.#entriesByText.get(text);
		if (entryList !== undefined) {
			for (const entry of entryList) {
				if (entry.mode !== mode || entry.textDirection !== textDirection || entry.scale !== scale || entry.lineWidth !== lineWidth || entry.colorString !== colorString || entry.fontString !== fontString) {
					continue;
				}
				// LRU 갱신. (재삽입으로 최신화, 쓴 아틀라스 장도)
				const entryKey = entry.entryKey;
				entries.delete(entryKey);
				entries.set(entryKey, entry);
				for (const atlasPage of entry.atlasPages) {
					atlasPage.lastUseSerial = useSerial;
				}
				return entry;
			}
		}

		const entryKey = `${mode}|${textDirection}|${scale}|${lineWidth}|${colorString}|${fontString}|${text}`;
		const entry = this.buildEntry(mode, text, fontString, colorString, lineWidth, scale, textDirection);
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

		// 값은 달라도 열쇠 문자열이 같은 엔트리(글꼴 문자열에 | 가 든 때 등)는 새 것으로 바꾼다.
		const collidedEntry = entries.get(entryKey);
		if (collidedEntry !== undefined) {
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

		// 상한 초과 시 가장 오래된 엔트리부터 퇴출. (글리프는 아틀라스에 남아 다른 글이 나눠 쓴다)
		while (entries.size > MAXIMUM_ENTRY_COUNT) {
			const oldestEntryKey = entries.keys().next().value;
			const oldestEntry = entries.get(oldestEntryKey);
			this.removeEntry(oldestEntryKey, oldestEntry);
		}

		return entry;
	}

	//==============================================================================
	// 받아 둔 엔트리를 다시 쓴 것으로 적기. (getEntry 가 찾았을 때와 같게 LRU 를 갱신한다, Graphic 의 기하 캐시가 draw 없이 글을 그릴 때 부른다)
	//==============================================================================
	/**
	 * @param { object } entry getEntry 로 받은 엔트리.
	 * @returns { boolean } 엔트리가 아직 캐시에 있으면 참. (버려졌으면 거짓, 다시 getEntry 로 받아야 한다)
	 */
	touchEntry(entry) {
		const entries = this.getEntries();
		const entryKey = entry.entryKey;
		if (entries.get(entryKey) !== entry) {
			return false;
		}
		this.#useSerial += 1;
		const useSerial = this.#useSerial;
		entries.delete(entryKey);
		entries.set(entryKey, entry);
		for (const atlasPage of entry.atlasPages) {
			atlasPage.lastUseSerial = useSerial;
		}
		return true;
	}

	//==============================================================================
	// 글을 글자 덩어리로 나눠 배치하고, 처음 보는 글리프를 아틀라스에 굽는다.
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
	buildEntry(mode, text, fontString, colorString, lineWidth, scale, textDirection = "ltr") {
		// 확대 배율이 적용된 폰트로 측정. (문자열째 그릴 때의 캔버스 크기와 펜 자리를 예전 굽기와 같게 셈한다, 기본 글꼴 이름 default 는 엔진 기본 글꼴 사슬로 푼다)
		const scaledFontString = this.buildScaledFontString(resolveFontString(fontString), scale);
		const layoutCanvasRenderingContext = this.#layoutCanvasRenderingContext;
		layoutCanvasRenderingContext.font = scaledFontString;
		layoutCanvasRenderingContext.direction = textDirection;
		// 경계는 왼쪽 기준으로 잰다. (오른쪽에서 왼쪽 방향의 기본 정렬 "start" 는 오른쪽 기준이다)
		layoutCanvasRenderingContext.textAlign = "left";
		const scaledTextMetrics = layoutCanvasRenderingContext.measureText(text);

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

		// 문자열째 그릴 때의 펜 자리와 크기. (글리프 칸은 이 사각형 안으로 잘라 예전과 같은 화소만 남긴다)
		const scaledPenX = scaledPadding + actualLeft;
		const scaledBaselineY = scaledPadding + Math.ceil(scaledFontAscent);
		const bakeWidth = scaledPenX + actualRight + scaledPadding;
		const bakeHeight = scaledBaselineY + Math.ceil(scaledFontDescent) + scaledPadding;
		if (bakeWidth <= 0 || bakeHeight <= 0) {
			return null;
		}

		// 글자 덩어리 나누기와 자리 재기.
		const chunks = this.splitTextChunks(text, scaledFontString, textDirection);
		this.measureChunkPositions(text, chunks, scaledFontString);

		// 글리프 칸의 가로 여유. (바깥선은 꺾인 모서리가 miterLimit 까지 뻗으므로 넉넉히, 문자열 사각형 밖은 잘린다)
		const cellPadding = mode === "stroke" ? Math.ceil((lineWidth * scale * STROKE_MITER_LIMIT) / 2) + 2 : scaledPadding + 1;
		const isNearest = !isTextAntialiasEnabled;
		const strikeKey = `${mode}|${lineWidth * scale}|${isNearest ? 1 : 0}|${textDirection}|${scaledFontString}\u0002`;
		const useSerial = this.#useSerial;

		// 글리프 찾기. (없으면 굽기 목록에 모은다)
		const glyphList = [];
		const missingGlyphList = [];
		for (const chunk of chunks) {
			const startPosition = chunk.positions[0];
			const anchorX = Math.floor(startPosition);
			const fractionX = startPosition - anchorX;
			let positionKey;
			if (chunk.isExactPosition) {
				positionKey = "x" + fractionX;
			}
			else {
				positionKey = "";
				for (const position of chunk.positions) {
					const slotIndex = Math.floor(position * SUBPIXEL_SLOT_COUNT);
					positionKey += System.String.fromCharCode(97 + (((slotIndex % SUBPIXEL_SLOT_COUNT) + SUBPIXEL_SLOT_COUNT) % SUBPIXEL_SLOT_COUNT));
				}
			}
			const glyphKey = strikeKey + chunk.text + "\u0001" + positionKey;
			let glyph = this.#glyphs.get(glyphKey);
			if (glyph === undefined && missingGlyphList.length > 0) {
				glyph = missingGlyphList.find((missingGlyph) => missingGlyph.glyphKey === glyphKey);
			}
			if (glyph === undefined) {
				const chunkMetrics = chunk.isWholeText ? scaledTextMetrics : this.measureLayoutText(scaledFontString, chunk.text);
				const chunkLeft = Math.ceil(Math.max(chunkMetrics.actualBoundingBoxLeft || 0, 0));
				const chunkRight = Math.ceil(Math.max(chunkMetrics.actualBoundingBoxRight || chunkMetrics.width, 0));
				const originX = cellPadding + chunkLeft;
				glyph = {
					glyphKey: glyphKey,
					text: chunk.text,
					scaledFontString: scaledFontString,
					fractionX: fractionX,
					originX: originX,
					width: originX + 1 + chunkRight + cellPadding,
					height: bakeHeight,
					baselineY: scaledBaselineY,
					atlasPage: null,
					atlasX: 0,
					atlasY: 0,
				};
				missingGlyphList.push(glyph);
			}
			else if (glyph.atlasPage !== null) {
				glyph.atlasPage.lastUseSerial = useSerial;
			}
			glyphList.push(glyph, anchorX);
		}
		if (missingGlyphList.length > 0) {
			this.bakeGlyphs(missingGlyphList, mode, colorString, lineWidth * scale, textDirection);
		}

		// 글리프 사각형. (문자열 사각형 왼쪽 위 기준 논리 좌표, 문자열 사각형 밖은 잘라 낸다)
		const glyphTextures = [];
		const glyphRects = [];
		const atlasPages = [];
		for (let glyphIndex = 0; glyphIndex < glyphList.length; glyphIndex += 2) {
			const glyph = glyphList[glyphIndex];
			const anchorX = glyphList[glyphIndex + 1];
			const atlasPage = glyph.atlasPage;
			if (atlasPage === null) {
				continue;
			}
			const cellLeft = scaledPenX + anchorX - glyph.originX;
			const cellTop = scaledBaselineY - glyph.baselineY;
			const clippedLeft = Math.max(cellLeft, 0);
			const clippedRight = Math.min(cellLeft + glyph.width, bakeWidth);
			const clippedTop = Math.max(cellTop, 0);
			const clippedBottom = Math.min(cellTop + glyph.height, bakeHeight);
			if (clippedRight <= clippedLeft || clippedBottom <= clippedTop) {
				continue;
			}
			glyphTextures.push(atlasPage.texture);
			glyphRects.push(
				clippedLeft / scale,
				clippedTop / scale,
				clippedRight / scale,
				clippedBottom / scale,
				(glyph.atlasX + clippedLeft - cellLeft) / atlasPage.width,
				(glyph.atlasY + clippedTop - cellTop) / atlasPage.height,
				(glyph.atlasX + clippedRight - cellLeft) / atlasPage.width,
				(glyph.atlasY + clippedBottom - cellTop) / atlasPage.height);
			if (!atlasPages.includes(atlasPage)) {
				atlasPages.push(atlasPage);
			}
		}

		// 논리 좌표(스케일 나눔) 기준 메트릭 저장.
		const entry = {
			glyphTextures: glyphTextures,
			glyphRects: glyphRects,
			atlasPages: atlasPages,
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
	// 글을 따로 구울 글자 덩어리로 나누기.
	// - 덩어리마다 text, start(글 안 UTF-16 자리), clusterEnds(덩어리 안 글자 덩어리마다 끝 자리), isExactPosition(자리를 1/8 칸으로 묶지 못함), isWholeText.
	// - 한글, 한자, 가나, 숫자, 문장 부호, 공백, 이모지는 글자 덩어리마다 따로. 그 밖의 글자(라틴, 키릴, 태국 같은)는 이어진 낱말째.
	// - 결합 부호가 붙은 덩어리는 부호 글리프의 자리가 덩어리 시작과 따로 놀아 칸으로 묶지 않고 정확한 자리로 굽는다.
	// - 오른쪽에서 왼쪽 글, 아주 큰 글꼴, 나누기를 못 하는 곳은 글 전체가 한 덩어리.
	//==============================================================================
	/**
	 * @param { string } text
	 * @param { string } scaledFontString
	 * @param { string } textDirection
	 * @returns { object[] }
	 */
	splitTextChunks(text, scaledFontString, textDirection) {
		const segmenter = this.#segmenter;
		const fontSizeMatch = scaledFontString.match(/(\d+(?:\.\d+)?)px/);
		const fontSize = fontSizeMatch !== null ? System.Number.parseFloat(fontSizeMatch[1]) : Infinity;
		if (segmenter === null || textDirection !== "ltr" || fontSize > MAXIMUM_ATLAS_FONT_SIZE || RIGHT_TO_LEFT_PATTERN.test(text)) {
			return [{ text: text, start: 0, clusterEnds: [text.length], isExactPosition: true, isWholeText: true, positions: [0] }];
		}

		const chunks = [];
		let previousChunk = null;
		let isPreviousJoining = false;
		for (const segment of segmenter.segment(text)) {
			const clusterText = segment.segment;
			const clusterEnd = segment.index + clusterText.length;
			const isJoining = JOINING_CLUSTER_PATTERN.test(clusterText) && !STANDALONE_SCRIPT_PATTERN.test(clusterText);
			const isExactPosition = clusterText.length > 1 && COMBINING_MARK_PATTERN.test(clusterText) && !EMOJI_CLUSTER_PATTERN.test(clusterText);
			if (isJoining && isPreviousJoining && previousChunk !== null) {
				previousChunk.text += clusterText;
				previousChunk.clusterEnds.push(clusterEnd);
				previousChunk.isExactPosition = previousChunk.isExactPosition || isExactPosition;
				continue;
			}
			previousChunk = { text: clusterText, start: segment.index, clusterEnds: [clusterEnd], isExactPosition: isExactPosition, isWholeText: false, positions: null };
			chunks.push(previousChunk);
			isPreviousJoining = isJoining;
		}
		return chunks;
	}

	//==============================================================================
	// 덩어리 안 글자 덩어리마다 펜에서의 가로 자리 재기. (굽는 배율 텍셀)
	// - 자리(k) = 자리(k-1) + (앞 글자 덩어리와 이 글자 덩어리를 붙인 너비) - (이 글자 덩어리만의 너비).
	//   붙인 너비에서 뒤 덩어리 너비를 빼면 앞 덩어리의 커닝까지 든 전진폭이다. 크롬이 셈한 자리와 같다.
	// - 짝 너비와 덩어리 너비는 글 재기 캐시에 남아 숫자처럼 되풀이되는 짝은 다시 재지 않는다. (글 길이에 비례)
	// - 자리는 크롬의 글리프 자리처럼 32 비트 실수로 쌓는다.
	//==============================================================================
	/**
	 * @param { string } text
	 * @param { object[] } chunks
	 * @param { string } scaledFontString
	 */
	measureChunkPositions(text, chunks, scaledFontString) {
		if (chunks.length === 1 && chunks[0].isWholeText) {
			return;
		}
		let previousClusterText = null;
		let previousPosition = 0;
		for (const chunk of chunks) {
			const positions = [];
			let clusterStart = chunk.start;
			for (const clusterEnd of chunk.clusterEnds) {
				const clusterText = text.substring(clusterStart, clusterEnd);
				let position = 0;
				if (previousClusterText !== null) {
					const pairWidth = this.measureLayoutText(scaledFontString, previousClusterText + clusterText).width;
					const clusterWidth = this.measureLayoutText(scaledFontString, clusterText).width;
					position = System.Math.fround(previousPosition + System.Math.fround(pairWidth - clusterWidth));
				}
				positions.push(position);
				previousClusterText = clusterText;
				previousPosition = position;
				clusterStart = clusterEnd;
			}
			chunk.positions = positions;
		}
	}

	//==============================================================================
	// 글자 덩어리 재기. (왼쪽에서 오른쪽, 캐시를 거친다, 배치용 컨텍스트에 그 글꼴이 걸려 있어야 한다)
	//==============================================================================
	/**
	 * @param { string } scaledFontString
	 * @param { string } text
	 * @returns { TextMetrics }
	 */
	measureLayoutText(scaledFontString, text) {
		const layoutCanvasRenderingContext = this.#layoutCanvasRenderingContext;
		const textMetrics = measureTextMetrics(scaledFontString, text);
		if (textMetrics !== null) {
			return textMetrics;
		}
		return layoutCanvasRenderingContext.measureText(text);
	}

	//==============================================================================
	// 글리프들을 아틀라스에 굽기. (한 줄에 이어 놓인 칸은 굽기 캔버스 한 장에 그려 한 번에 올린다)
	//==============================================================================
	/**
	 * @param { object[] } glyphList
	 * @param { string } mode
	 * @param { string } colorString
	 * @param { number } scaledLineWidth
	 * @param { string } textDirection
	 */
	bakeGlyphs(glyphList, mode, colorString, scaledLineWidth, textDirection) {
		const isNearest = !isTextAntialiasEnabled;
		const spans = [];
		let currentSpan = null;
		for (const glyph of glyphList) {
			this.allocateGlyphCell(glyph, isNearest);
			if (glyph.atlasPage === null) {
				continue;
			}
			if (currentSpan !== null && currentSpan.atlasPage === glyph.atlasPage && currentSpan.atlasY === glyph.atlasY && currentSpan.atlasX + currentSpan.width === glyph.atlasX && currentSpan.height === glyph.height) {
				currentSpan.width += glyph.width;
				currentSpan.glyphs.push(glyph);
				continue;
			}
			currentSpan = { atlasPage: glyph.atlasPage, atlasX: glyph.atlasX, atlasY: glyph.atlasY, width: glyph.width, height: glyph.height, glyphs: [glyph] };
			spans.push(currentSpan);
		}

		const bakeCanvas = this.getBakeCanvas();
		const bakeCanvasRenderingContext = this.getBakeCanvasRenderingContext();
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		for (const span of spans) {
			// 캔버스 크기 변경은 상태를 초기화하고 비우므로 이후에 폰트를 다시 설정.
			bakeCanvas.width = span.width;
			bakeCanvas.height = span.height;
			bakeCanvasRenderingContext.clearRect(0, 0, span.width, span.height);
			bakeCanvasRenderingContext.font = span.glyphs[0].scaledFontString;
			bakeCanvasRenderingContext.direction = textDirection;
			bakeCanvasRenderingContext.textAlign = "left";
			bakeCanvasRenderingContext.textBaseline = "alphabetic";
			if (mode === "stroke") {
				bakeCanvasRenderingContext.strokeStyle = colorString;
				bakeCanvasRenderingContext.lineWidth = scaledLineWidth;
			}
			else {
				bakeCanvasRenderingContext.fillStyle = colorString;
			}
			for (const glyph of span.glyphs) {
				const penX = glyph.atlasX - span.atlasX + glyph.originX + glyph.fractionX;
				if (mode === "stroke") {
					bakeCanvasRenderingContext.strokeText(glyph.text, penX, glyph.baselineY);
				}
				else {
					bakeCanvasRenderingContext.fillText(glyph.text, penX, glyph.baselineY);
				}
			}

			// 안티앨리어싱을 끈 경우: 알파를 문턱값으로 갈라 가장자리의 반투명 픽셀을 없앤다.
			if (isNearest) {
				const imageData = bakeCanvasRenderingContext.getImageData(0, 0, span.width, span.height);
				const pixels = imageData.data;
				for (let pixelIndex = 3; pixelIndex < pixels.length; pixelIndex += 4) {
					pixels[pixelIndex] = pixels[pixelIndex] >= ALPHA_THRESHOLD ? 255 : 0;
				}
				bakeCanvasRenderingContext.putImageData(imageData, 0, 0);
			}

			// 아틀라스 장에 올리기. (프리멀티플라이드 알파)
			this.bindTexture(span.atlasPage.texture);
			webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
			webGL2RenderingContext.texSubImage2D(webGL2RenderingContext.TEXTURE_2D, 0, span.atlasX, span.atlasY, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, bakeCanvas);
			webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
			this.#bakedGlyphCount += span.glyphs.length;
			this.#uploadCount += 1;
		}
	}

	//==============================================================================
	// 글리프 칸 자리 잡기. (가장 나중에 연 장의 같은 높이 줄에 이어 놓고, 없으면 새 줄, 새 장, 장 수가 상한이면 가장 오래 안 쓴 장을 비운다)
	// - 이번 엔트리가 쓰는 장(lastUseSerial 이 지금 번호)은 비우지 않는다. 그것뿐이면 상한을 넘겨 새 장을 연다.
	//==============================================================================
	/**
	 * @param { object } glyph
	 * @param { boolean } isNearest
	 */
	allocateGlyphCell(glyph, isNearest) {
		const useSerial = this.#useSerial;
		const atlasPages = this.#atlasPages;
		const width = glyph.width;
		const height = glyph.height;

		// 한 장보다 큰 칸은 제 크기의 장을 따로 연다.
		if (width > ATLAS_PAGE_SIZE || height > ATLAS_PAGE_SIZE) {
			this.makeRoomForAtlasPage();
			const atlasPage = this.createAtlasPage(width, height, isNearest, true);
			this.placeGlyph(glyph, atlasPage, 0, 0);
			return;
		}

		// 가장 나중에 연 장에만 이어 놓는다. 차면 새 장을 연다. (TextMeshPro 여러 장 아틀라스처럼, 앞 장의 남은 틈을 채우면 한 문자열의 글리프가 여러 장에 흩어져 드로 콜이 나뉜다)
		for (let atlasPageIndex = atlasPages.length - 1; atlasPageIndex >= 0; --atlasPageIndex) {
			const atlasPage = atlasPages[atlasPageIndex];
			if (atlasPage.isNearest !== isNearest || atlasPage.isDedicated) {
				continue;
			}
			if (this.tryPlaceGlyph(glyph, atlasPage)) {
				return;
			}
			break;
		}
		this.makeRoomForAtlasPage();
		const atlasPage = this.createAtlasPage(ATLAS_PAGE_SIZE, ATLAS_PAGE_SIZE, isNearest, false);
		atlasPage.lastUseSerial = useSerial;
		this.tryPlaceGlyph(glyph, atlasPage);
	}

	//==============================================================================
	// 장 하나에 글리프 칸 놓아 보기. (같은 높이 줄의 남은 자리, 없으면 새 줄)
	//==============================================================================
	/**
	 * @param { object } glyph
	 * @param { object } atlasPage
	 * @returns { boolean } 놓았으면 참.
	 */
	tryPlaceGlyph(glyph, atlasPage) {
		const width = glyph.width;
		const height = glyph.height;
		for (const shelf of atlasPage.shelves) {
			if (shelf.height === height && shelf.cursorX + width <= atlasPage.width) {
				this.placeGlyph(glyph, atlasPage, shelf.cursorX, shelf.y);
				shelf.cursorX += width;
				return true;
			}
		}
		if (atlasPage.nextShelfY + height <= atlasPage.height) {
			const shelf = { y: atlasPage.nextShelfY, height: height, cursorX: width };
			atlasPage.shelves.push(shelf);
			atlasPage.nextShelfY += height;
			this.placeGlyph(glyph, atlasPage, 0, shelf.y);
			return true;
		}
		return false;
	}

	//==============================================================================
	// 글리프를 장의 자리에 적고 글리프 맵에 넣기.
	//==============================================================================
	/**
	 * @param { object } glyph
	 * @param { object } atlasPage
	 * @param { number } atlasX
	 * @param { number } atlasY
	 */
	placeGlyph(glyph, atlasPage, atlasX, atlasY) {
		glyph.atlasPage = atlasPage;
		glyph.atlasX = atlasX;
		glyph.atlasY = atlasY;
		atlasPage.glyphs.push(glyph);
		atlasPage.lastUseSerial = this.#useSerial;
		this.#glyphs.set(glyph.glyphKey, glyph);
	}

	//==============================================================================
	// 장 수가 상한이면 가장 오래 안 쓴 장 하나를 지워 자리를 낸다. (이번 엔트리가 쓰는 장은 지우지 않는다)
	//==============================================================================
	makeRoomForAtlasPage() {
		const atlasPages = this.#atlasPages;
		if (atlasPages.length < MAXIMUM_ATLAS_PAGE_COUNT) {
			return;
		}
		let oldestAtlasPage = null;
		for (const atlasPage of atlasPages) {
			if (atlasPage.lastUseSerial >= this.#useSerial) {
				continue;
			}
			if (oldestAtlasPage === null || atlasPage.lastUseSerial < oldestAtlasPage.lastUseSerial) {
				oldestAtlasPage = atlasPage;
			}
		}
		if (oldestAtlasPage === null) {
			return;
		}
		this.removeAtlasPage(oldestAtlasPage);
	}

	//==============================================================================
	// 아틀라스 장 만들기.
	//==============================================================================
	/**
	 * @param { number } width
	 * @param { number } height
	 * @param { boolean } isNearest 가까운 텍셀로 뽑을지. (안티앨리어싱을 끈 글자)
	 * @param { boolean } isDedicated 칸 하나만 담는 장인지.
	 * @returns { object }
	 */
	createAtlasPage(width, height, isNearest, isDedicated) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const texture = webGL2RenderingContext.createTexture();
		this.bindTexture(texture);
		webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.RGBA, width, height, 0, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, null);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);
		const textureFilter = isNearest ? webGL2RenderingContext.NEAREST : webGL2RenderingContext.LINEAR;
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, textureFilter);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, textureFilter);
		const atlasPage = {
			texture: texture,
			width: width,
			height: height,
			isNearest: isNearest,
			isDedicated: isDedicated,
			shelves: [],
			nextShelfY: 0,
			glyphs: [],
			lastUseSerial: this.#useSerial,
		};
		this.#atlasPages.push(atlasPage);
		return atlasPage;
	}

	//==============================================================================
	// 아틀라스 장 지우기. (그 장의 글리프와 그 장을 쓰는 엔트리도 버린다, 쌓아 둔 그리기를 먼저 내보낸다)
	//==============================================================================
	/**
	 * @param { object } atlasPage
	 */
	removeAtlasPage(atlasPage) {
		const beforeTextureOverwrite = this.#beforeTextureOverwrite;
		if (beforeTextureOverwrite !== null) {
			beforeTextureOverwrite();
		}
		for (const glyph of atlasPage.glyphs) {
			if (this.#glyphs.get(glyph.glyphKey) === glyph) {
				this.#glyphs.delete(glyph.glyphKey);
			}
			glyph.atlasPage = null;
		}
		const entries = this.getEntries();
		for (const [entryKey, entry] of System.Array.from(entries)) {
			if (entry.atlasPages.includes(atlasPage)) {
				this.removeEntry(entryKey, entry);
			}
		}
		const atlasPageIndex = this.#atlasPages.indexOf(atlasPage);
		if (atlasPageIndex >= 0) {
			this.#atlasPages.splice(atlasPageIndex, 1);
		}
		this.getWebGL2RenderingContext().deleteTexture(atlasPage.texture);
	}

	//==============================================================================
	// 모든 엔트리와 글리프 파기. (아틀라스 텍스처 삭제 포함)
	//==============================================================================
	clear() {
		const beforeTextureOverwrite = this.#beforeTextureOverwrite;
		if (beforeTextureOverwrite !== null && this.#atlasPages.length > 0) {
			beforeTextureOverwrite();
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		for (const atlasPage of this.#atlasPages) {
			webGL2RenderingContext.deleteTexture(atlasPage.texture);
			for (const glyph of atlasPage.glyphs) {
				glyph.atlasPage = null;
			}
		}
		this.#atlasPages.length = 0;
		this.#glyphs.clear();
		this.getEntries().clear();
		this.#entriesByText.clear();
	}

	//==============================================================================
	// 엔트리 하나를 맵과 문자열별 목록에서 뺀다.
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
	// 받아진 웹 폰트로 다시 구울 엔트리와 글리프 파기.
	//
	// 늦게 받아진 폰트 얼굴(FontFace)의 이름을 쓰는 폰트 문자열로 구웠고, 그 얼굴의 글자 범위(unicodeRange)에 든 글자가 있는
	// 엔트리와 글리프만 버린다. 다음에 그 글자를 그릴 때 받은 폰트로 다시 굽는다. 나머지는 그대로 쓴다.
	// (캐시를 통째로 비우면 폰트가 받아질 때마다 모든 글자를 한꺼번에 다시 구워 그 프레임이 길어진다)
	// 버린 글리프의 칸은 그 장이 비워질 때 다시 쓴다.
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
		const isAffected = (fontString, text) => {
			const lowerFontString = fontString.toLowerCase();
			return targets.some((target) => {
				return lowerFontString.includes(target.familyName) && hasCharacterInRanges(text, target.ranges);
			});
		};
		for (const [glyphKey, glyph] of System.Array.from(this.#glyphs)) {
			if (isAffected(glyph.scaledFontString, glyph.text)) {
				this.#glyphs.delete(glyphKey);
			}
		}
		const entries = this.getEntries();
		let removedCount = 0;
		for (const [entryKey, entry] of System.Array.from(entries)) {
			if (!isAffected(resolveFontString(entry.fontString), entry.text)) {
				continue;
			}
			this.removeEntry(entryKey, entry);
			removedCount += 1;
		}
		return removedCount;
	}

	//==============================================================================
	// 아틀라스 통계. (시험과 통계용: 장 수, 글리프 수, 지금까지 구운 글리프 수, 지금까지 올린 수, 엔트리 수)
	//==============================================================================
	/**
	 * @returns { { atlasPageCount: number, glyphCount: number, bakedGlyphCount: number, uploadCount: number, entryCount: number } }
	 */
	readAtlasStatistics() {
		return {
			atlasPageCount: this.#atlasPages.length,
			glyphCount: this.#glyphs.size,
			bakedGlyphCount: this.#bakedGlyphCount,
			uploadCount: this.#uploadCount,
			entryCount: this.getEntries().size,
		};
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
