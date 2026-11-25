//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";


// 처음부터 오른쪽에서 왼쪽으로 쓰는 언어. (아랍어, 페르시아어, 히브리어, 우르두어, 파슈토어, 이디시어, 디베히어)
const DEFAULT_RIGHT_TO_LEFT_LANGUAGES = ["ar", "fa", "he", "ur", "ps", "yi", "dv"];

// 방향 격리 문자. (처음 나오는 방향이 강한 글자로 방향을 정하는 격리의 시작과 끝)
const FIRST_STRONG_ISOLATE = "\u2068";
const POP_DIRECTIONAL_ISOLATE = "\u2069";

// 이름 자리. ("{seconds}")
const PLACEHOLDER_PATTERN = /\{([a-zA-Z0-9]+)\}/g;

// 빗금으로만 이은 이름 자리 무리. ("{count}/{limit}", "{count} / {limit}")
const JOINED_PLACEHOLDER_PATTERN = /\{[a-zA-Z0-9]+\}(?:\s*\/\s*\{[a-zA-Z0-9]+\})*/g;


//==============================================================================
// 로컬라이제이션.
// - 언어 자동 감지 + 번역 테이블 + {0}{1} 자리 표시자 치환 + 폴백을 한 곳에 모았다.
// - 키는 원문 그대로 써도 된다. 표에 없으면 원문(키)을 그대로 돌려주므로 점진 번역이 된다.
//   사용 예:
//     Localization.setTable("en", { "확인": "OK", "{0}점 획득": "Got {0} points" });
//     Localization.setLanguage(Localization.detectLanguage(["ko", "en"]));
//     Localization.text("{0}점 획득", 120);
// - 언어 태그를 뒤 조각부터 하나씩 떼며 맞추고 별칭도 본다. (setLanguageAliases)
// - 오른쪽에서 왼쪽으로 쓰는 언어(isRightToLeft, setRightToLeft)면 배치를 뒤집고(mirrorLayoutX, readLayoutTextAlign),
//   글 사이에 넣는 값을 방향 격리 문자로 묶는다. (isolateText, textNamed 의 "{이름}" 자리, 빗금으로만 이은 값들은 통째로 한 번 묶는다)
//==============================================================================
export class Localization extends Object {
	/** @private @type { Map } */ static #tableByLanguage = new System.Map();
	/** @private @type { string } */ static #languageCode = "ko";
	/** @private @type { string } */ static #fallbackLanguageCode = "ko";
	/** @private @type { Map<string, string> } */ static #aliasToLanguage = new System.Map(); // 별칭 → 언어 코드.
	/** @private @type { Set<string> } */ static #rightToLeftLanguages = new System.Set(DEFAULT_RIGHT_TO_LEFT_LANGUAGES); // 오른쪽에서 왼쪽으로 쓰는 언어의 첫 조각.

	//==============================================================================
	// 브라우저 언어 감지. (정적)
	// - navigator.languages 우선순위를 훑어 지원 목록에 있는 첫 언어를 고른다. (selectLanguage)
	//   "zh-TW" 같은 지역 표기는 "zh-tw" → "zh" 순으로 대조한다.
	//==============================================================================
	/**
	 * @param { string[] } supportedLanguageCodes
	 * @param { string } defaultLanguageCode
	 * @returns { string }
	 */
	static detectLanguage(supportedLanguageCodes, defaultLanguageCode = "ko") {
		const navigatorObject = System.navigator;
		const candidateList = [];
		if (navigatorObject) {
			if (navigatorObject.languages) {
				for (const languageTag of navigatorObject.languages) {
					candidateList.push(languageTag);
				}
			}
			else if (navigatorObject.language) {
				candidateList.push(navigatorObject.language);
			}
		}
		const languageCode = Localization.selectLanguage(candidateList, supportedLanguageCodes, defaultLanguageCode);
		return languageCode;
	}

	//==============================================================================
	// 선호 언어 목록에서 지원하는 첫 언어 고르기. (정적, detectLanguage 의 대조 부분)
	// - 태그의 뒤 조각부터 하나씩 떼며 지원 목록의 코드와 별칭을 본다. ("zh-Hant-TW" → "zh-hant-tw", "zh-hant", "zh", 밑줄은 하이픈으로)
	//==============================================================================
	/**
	 * @param { string[] } candidateList
	 * @param { string[] } supportedLanguageCodes
	 * @param { string } defaultLanguageCode
	 * @returns { string }
	 */
	static selectLanguage(candidateList, supportedLanguageCodes, defaultLanguageCode = "ko") {
		const supportedSet = new System.Set(supportedLanguageCodes.map((code) => code.toLowerCase()));
		const aliasToLanguage = Localization.#aliasToLanguage;
		for (const languageTag of candidateList) {
			const loweredTag = languageTag.toLowerCase().split("_").join("-");
			const subtagList = loweredTag.split("-");
			for (let subtagCount = subtagList.length; subtagCount >= 1; --subtagCount) {
				const candidateTag = subtagList.slice(0, subtagCount).join("-");
				if (supportedSet.has(candidateTag)) {
					return candidateTag;
				}
				const aliasLanguage = aliasToLanguage.get(candidateTag);
				if (aliasLanguage !== undefined && supportedSet.has(aliasLanguage)) {
					return aliasLanguage;
				}
			}
		}
		return defaultLanguageCode;
	}

	//==============================================================================
	// 언어의 별칭 설정. (정적, 예: "zh-hant" 에 "zh-tw", "zh-hk", 태그를 맞출 때 별칭도 그 언어로 본다)
	//==============================================================================
	/**
	 * @param { string } languageCode
	 * @param { string[] } aliasList
	 */
	static setLanguageAliases(languageCode, aliasList) {
		const loweredLanguageCode = languageCode.toLowerCase();
		for (const alias of aliasList) {
			const loweredAlias = alias.toLowerCase().split("_").join("-");
			Localization.#aliasToLanguage.set(loweredAlias, loweredLanguageCode);
		}
	}

	//==============================================================================
	// 오른쪽에서 왼쪽으로 쓰는 언어로 정하거나 풀기. (정적, 처음은 ar, fa, he, ur, ps, yi, dv)
	//==============================================================================
	/**
	 * @param { string } languageCode
	 * @param { boolean } isRightToLeft
	 */
	static setRightToLeft(languageCode, isRightToLeft) {
		const primaryCode = languageCode.toLowerCase().split("_").join("-").split("-")[0];
		if (isRightToLeft) {
			Localization.#rightToLeftLanguages.add(primaryCode);
		}
		else {
			Localization.#rightToLeftLanguages.delete(primaryCode);
		}
	}

	//==============================================================================
	// 지금 언어가 오른쪽에서 왼쪽으로 쓰는 언어인지. (정적, 글자를 그 방향으로 굽고 배치를 좌우로 뒤집을 때)
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	static isRightToLeft() {
		const languageCode = Localization.getLanguage();
		const primaryCode = languageCode.split("-")[0];
		return Localization.#rightToLeftLanguages.has(primaryCode);
	}

	//==============================================================================
	// 배치의 가로 자리. (정적, 오른쪽에서 왼쪽 언어면 부모 너비 안에서 좌우를 뒤집은 왼쪽, 아니면 그대로)
	// - 창과 표의 왼쪽, 오른쪽 배치를 언어 방향에 맞춰 뒤집을 때 쓴다. 화면 구석의 자리나 슬라이더의 방향처럼 뒤집지 않을 것은 부르지 않는다.
	//==============================================================================
	/**
	 * @param { number } x 왼쪽에서 오른쪽 언어일 때의 왼쪽.
	 * @param { number } width 놓을 것의 너비.
	 * @param { number } parentWidth 부모의 너비.
	 * @returns { number }
	 */
	static mirrorLayoutX(x, width, parentWidth) {
		if (!Localization.isRightToLeft()) {
			return x;
		}
		return parentWidth - x - width;
	}

	//==============================================================================
	// 배치의 글자 정렬. (정적, 오른쪽에서 왼쪽 언어면 "left" 와 "right" 를 바꾸고, 나머지는 그대로)
	//==============================================================================
	/**
	 * @param { string } textAlign TextAlign 의 값.
	 * @returns { string }
	 */
	static readLayoutTextAlign(textAlign) {
		if (!Localization.isRightToLeft()) {
			return textAlign;
		}
		if (textAlign === "left") {
			return "right";
		}
		if (textAlign === "right") {
			return "left";
		}
		return textAlign;
	}

	//==============================================================================
	// 글 사이에 끼우는 값 묶기. (정적, 오른쪽에서 왼쪽 언어면 방향 격리 문자로 묶고, 아니면 그대로)
	// - 숫자와 단위(123°/s, +60%)나 사람 이름이 앞뒤 글과 섞여 흩어지지 않고 제 방향으로 한 덩어리로 놓이게 한다.
	//==============================================================================
	/**
	 * @param { string } text
	 * @returns { string }
	 */
	static isolateText(text) {
		if (text === "" || !Localization.isRightToLeft()) {
			return text;
		}
		return FIRST_STRONG_ISOLATE + text + POP_DIRECTIONAL_ISOLATE;
	}

	//==============================================================================
	// 이름 자리 채우기. (정적, "Restart {seconds}" + { seconds: 3 } → "Restart 3")
	// - 번역문을 찾은 뒤(text) 채운다. 오른쪽에서 왼쪽 언어면 넣은 값을 방향 격리 문자로 묶는다.
	// - 빗금으로만 이은 값들("{count}/{limit}")은 값마다가 아니라 통째로 한 번 묶는다. (값마다 묶으면 1/40 이 40/1 로 보인다)
	// - 이름이 없는 자리는 그대로 둔다.
	//==============================================================================
	/**
	 * @param { string } key
	 * @param { object } values 자리 이름 → 값.
	 * @returns { string }
	 */
	static textNamed(key, values) {
		const text = Localization.text(key);
		return text.replace(JOINED_PLACEHOLDER_PATTERN, (joinedText) => {
			let isFilled = false;
			const valueText = joinedText.replace(PLACEHOLDER_PATTERN, (matched, name) => {
				if (!System.Object.prototype.hasOwnProperty.call(values, name)) {
					return matched;
				}
				isFilled = true;
				return System.String(values[name]);
			});
			if (!isFilled) {
				return joinedText;
			}
			return Localization.isolateText(valueText);
		});
	}

	//==============================================================================
	// 번역 테이블 설정. (정적)
	//==============================================================================
	/**
	 * @param { string } languageCode
	 * @param { object } table 키(원문) → 번역문. 값은 문자열 또는 문자열 배열.
	 */
	static setTable(languageCode, table) {
		Localization.#tableByLanguage.set(languageCode.toLowerCase(), table);
	}

	//==============================================================================
	// JSON 객체로 번역 표 설정. (정적, JsonAsset 으로 읽은 data 같은 것, 값이 글이면 글, 글 배열이면 글만 모은 목록, 그 밖의 값은 건너뛴다)
	//==============================================================================
	/**
	 * @param { string } languageCode
	 * @param { object } tableJson
	 */
	static setTableFromJson(languageCode, tableJson) {
		const table = {};
		if (tableJson !== null && typeof tableJson === "object" && !System.Array.isArray(tableJson)) {
			for (const key of System.Object.keys(tableJson)) {
				const value = tableJson[key];
				if (typeof value === "string") {
					table[key] = value;
				}
				else if (System.Array.isArray(value)) {
					table[key] = value.filter((item) => typeof item === "string");
				}
			}
		}
		Localization.setTable(languageCode, table);
	}

	//==============================================================================
	// 현재 언어 설정. (정적)
	//==============================================================================
	/**
	 * @param { string } languageCode
	 */
	static setLanguage(languageCode) {
		Localization.#languageCode = languageCode.toLowerCase();
	}

	//==============================================================================
	// 현재 언어 반환. (정적)
	//==============================================================================
	/**
	 * @returns { string }
	 */
	static getLanguage() {
		return Localization.#languageCode;
	}

	//==============================================================================
	// 폴백 언어 설정. (정적 — 현재 언어 표에 없으면 이 언어 표를 본다)
	//==============================================================================
	/**
	 * @param { string } languageCode
	 */
	static setFallbackLanguage(languageCode) {
		Localization.#fallbackLanguageCode = languageCode.toLowerCase();
	}

	//==============================================================================
	// 번역문 조회. (정적)
	// - 현재 언어 → 폴백 언어 → 키 원문 순으로 찾는다.
	// - {0} {1} … 자리 표시자를 인자로 치환한다.
	//==============================================================================
	/**
	 * @param { string } key
	 * @param { ...* } substitutions
	 * @returns { string }
	 */
	static text(key, ...substitutions) {
		let resolvedText = Localization.lookup(key);
		if (typeof resolvedText !== "string") {
			resolvedText = key;
		}
		for (let index = 0; index < substitutions.length; ++index) {
			resolvedText = resolvedText.split("{" + index + "}").join(String(substitutions[index]));
		}
		return resolvedText;
	}

	//==============================================================================
	// 배열형 번역 조회. (정적 — 대사 목록처럼 여러 줄인 항목)
	//==============================================================================
	/**
	 * @param { string } key
	 * @returns { string[] }
	 */
	static textList(key) {
		const resolvedValue = Localization.lookup(key);
		if (System.Array.isArray(resolvedValue)) {
			return resolvedValue;
		}
		if (typeof resolvedValue === "string") {
			return [resolvedValue];
		}
		return [key];
	}

	//==============================================================================
	// 원시 조회. (정적)
	//==============================================================================
	/**
	 * @param { string } key
	 * @returns { string | string[] | undefined }
	 */
	static lookup(key) {
		const currentTable = Localization.#tableByLanguage.get(Localization.#languageCode);
		if (currentTable && currentTable[key] !== undefined) {
			return currentTable[key];
		}
		const fallbackTable = Localization.#tableByLanguage.get(Localization.#fallbackLanguageCode);
		if (fallbackTable && fallbackTable[key] !== undefined) {
			return fallbackTable[key];
		}
		return undefined;
	}

	//==============================================================================
	// 모든 테이블 비우기. (정적 — 테스트용)
	//==============================================================================
	static clear() {
		Localization.#tableByLanguage.clear();
	}
}
