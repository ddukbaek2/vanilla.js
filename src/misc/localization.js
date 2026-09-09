//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";


//==============================================================================
// 로컬라이제이션.
// - 언어 자동 감지 + 번역 테이블 + {0}{1} 자리 표시자 치환 + 폴백을 한 곳에 모았다.
// - 키는 원문 그대로 써도 된다. 표에 없으면 원문(키)을 그대로 돌려주므로 점진 번역이 된다.
//   사용 예:
//     Localization.setTable("en", { "확인": "OK", "{0}점 획득": "Got {0} points" });
//     Localization.setLanguage(Localization.detectLanguage(["ko", "en"]));
//     Localization.text("{0}점 획득", 120);
//==============================================================================
export class Localization extends Object {
	/** @private @type { Map } */ static #tableByLanguage = new System.Map();
	/** @private @type { string } */ static #languageCode = "ko";
	/** @private @type { string } */ static #fallbackLanguageCode = "ko";

	//==============================================================================
	// 브라우저 언어 감지. (정적)
	// - navigator.languages 우선순위를 훑어 지원 목록에 있는 첫 언어를 고른다.
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
		const supportedSet = new System.Set(supportedLanguageCodes.map((code) => code.toLowerCase()));
		for (const languageTag of candidateList) {
			const loweredTag = languageTag.toLowerCase();
			if (supportedSet.has(loweredTag)) {
				return loweredTag;
			}
			const primaryCode = loweredTag.split("-")[0];
			if (supportedSet.has(primaryCode)) {
				return primaryCode;
			}
		}
		return defaultLanguageCode;
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
