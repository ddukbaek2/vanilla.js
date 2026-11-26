//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { JsonAsset } from "../resource/jsonasset.js";


//==============================================================================
// 언어 묶음. (자산의 표로 두는 화면 글자의 언어, LanguagePack 으로 들여온다)
// - Localization(코드 안의 표)과 달리 글자를 자산의 JSON 파일로 둔다. 언어가 많고 번역가가 파일을 따로 고치는 게임에 쓴다.
// - 경로는 setLanguagePaths 로 정한다. (처음은 ./assets/localization/languages.json 과 그 폴더)
// - 언어를 불러온 뒤 할 일(그 언어의 글꼴 받기 등)은 setLanguageLoadedHandler 로 건다.
//
// 글자는 소스가 아니라 자산의 표에 있다. 언어의 목록은 languages.json 이고,
// 언어마다 한 파일(열쇠 → 글자)이다. 모든 언어의 파일은 기본 언어의 파일과 같은 열쇠를 갖는다. 
// 설정의 언어가 비어 있으면 플랫폼이 알려 준 언어, 그다음 기기(브라우저)의 언어를 따르고, 목록에 없으면 기본 언어(영어)이다.
// 고른 언어의 표에 없는 열쇠는 기본 언어의 글자로, 거기에도 없으면 열쇠 그대로 쓴다.
// 경로를 글자 그대로 적어 두어 빌드의 캐시 무효화가 지문을 붙이게 한다. (언어 파일의 지문은 빌드가 목록에 붙인다)
//==============================================================================
let languageListPath = "./assets/localization/languages.json";
// 탭의 제목이 될 글자의 열쇠.
let documentTitleKey = "game.title";
// 앞세울 언어 태그. (플랫폼이 알려 준 사용자의 언어, 없으면 "")
let preferredLanguageTag = "";
let languageDirectoryPath = "./assets/localization/";
// 언어를 불러온 뒤 부르는 함수. (언어의 한 줄과 모든 글자를 받는다, null 이면 없음)
let languageLoadedHandler = null;
// 방향 격리 문자. (처음 나오는 방향이 강한 글자로 방향을 정하는 격리의 시작과 끝, isolateText)
const FIRST_STRONG_ISOLATE = "\u2068";
const POP_DIRECTIONAL_ISOLATE = "\u2069";
// \ub123\ub294 \uac12\uc758 \uc790\ub9ac. ({\uc774\ub984})
const PLACEHOLDER_PATTERN = /\{([a-zA-Z0-9]+)\}/g;
// \ube57\uae08\uc73c\ub85c\ub9cc \uc774\uc740 \uc790\ub9ac\ub4e4. ({count}/{limit} \ucc98\ub7fc \uac12 \ub458\uc744 \uc787\ub294 \uac83\ub3c4 \ud55c \ub369\uc5b4\ub9ac\uc785\ub2c8\ub2e4, formatText)
const JOINED_PLACEHOLDER_PATTERN = /\{[a-zA-Z0-9]+\}(?:\s*\/\s*\{[a-zA-Z0-9]+\})*/g;

// 언어의 목록. ({ fallbackLanguage, languages: [{ code, name, englishName, fontGroup, direction, aliases, countries, file }] }, 못 읽었으면 null)
let languageList = null;
// 지금 언어. (목록의 한 줄, 못 읽었으면 null)
let currentLanguage = null;
// 지금 언어의 표와 기본 언어의 표. (열쇠 → 글자)
let currentTexts = {};
let fallbackTexts = {};

/**
 * @example <caption>파일 없이 목록과 표를 넣고 글자 얻기</caption>
 * import { LanguagePack } from "./build/vanilla.js";
 *
 * LanguagePack.setLanguageList({
 * 	fallbackLanguage: "en",
 * 	languages: [
 * 		{ code: "en", name: "English", englishName: "English", direction: "ltr", aliases: [], file: "en.json" },
 * 		{ code: "ar", name: "Arabic", englishName: "Arabic", direction: "rtl", aliases: ["ar-eg"], file: "ar.json" }
 * 	]
 * });
 * const englishTexts = { "hud.restart": "Restart {seconds}", "hud.ammo": "{count}/{limit}" };
 * LanguagePack.setLanguageTexts("en", englishTexts, englishTexts);
 * console.log(LanguagePack.readLanguageCode(), LanguagePack.translate("hud.restart"), LanguagePack.formatText("hud.restart", { seconds: 3 }));
 * const matchedLanguage = LanguagePack.matchLanguageTag("ar-EG");
 * console.log(matchedLanguage.code, LanguagePack.readTextDirection(), LanguagePack.resolveLanguageCode("ar"));
 */


//==============================================================================
// JSON 읽기. (못 읽으면 null)
//==============================================================================
/**
 * @param { string } assetPath
 * @returns { Promise<object | null> }
 */
async function readJson(assetPath) {
	const jsonAsset = new JsonAsset();
	// 받기나 JSON 해석이 실패하면 load 가 거부된다. 못 읽은 것으로 친다.
	try {
		await jsonAsset.load(assetPath);
	}
	catch (error) {
		return null;
	}
	if (jsonAsset.data === null || typeof jsonAsset.data !== "object") {
		return null;
	}
	return jsonAsset.data;
}

//==============================================================================
// 언어의 목록 불러오기. (한 번만)
//==============================================================================
export async function loadLanguageList() {
	if (languageList !== null) {
		return;
	}
	const data = await readJson(languageListPath);
	const isLanguageListSet = setLanguageList(data);
	if (!isLanguageListSet) {
		console.warn("[localization] 언어의 목록을 읽지 못했습니다.");
	}
}

//==============================================================================
// 글 목록 고르기. (글만 소문자로 남긴다, 배열이 아니면 빈 배열)
//==============================================================================
/**
 * @param { * } values 목록 파일의 aliases 나 countries 칸.
 * @returns { string[] } 소문자 글 배열.
 */
function normalizeTextList(values) {
	const textList = [];
	if (!System.Array.isArray(values)) {
		return textList;
	}
	for (const value of values) {
		if (typeof value === "string") {
			textList.push(value.toLowerCase());
		}
	}
	return textList;
}

//==============================================================================
// 언어 목록의 줄 고르기. (code 가 글이 아닌 줄은 빼고, aliases 와 countries 는 없으면 빈 배열, 글은 소문자로)
//==============================================================================
/**
 * @param { object[] } languages 목록 파일의 languages 배열.
 * @returns { object[] } 쓸 수 있는 줄 배열. (줄 객체는 그대로 쓰고 aliases, countries 칸만 고친다)
 */
function normalizeLanguageEntries(languages) {
	const languageEntries = [];
	for (const language of languages) {
		if (language === null || typeof language !== "object" || typeof language.code !== "string") {
			continue;
		}
		language.aliases = normalizeTextList(language.aliases);
		language.countries = normalizeTextList(language.countries);
		languageEntries.push(language);
	}
	return languageEntries;
}

//==============================================================================
// 언어의 목록 반환. (못 읽었으면 빈 배열)
//==============================================================================
/**
 * @returns { object[] } 언어 목록의 줄 배열. (못 읽었으면 빈 배열)
 */
export function readLanguages() {
	if (languageList === null) {
		return [];
	}
	return languageList.languages;
}

//==============================================================================
// 언어 찾기. (코드는 대소문자를 가리지 않는다, 없으면 null)
//==============================================================================
/**
 * @param { string } languageCode 찾을 언어 코드.
 * @returns { object | null } 목록의 그 언어 줄. 없으면 null.
 */
export function findLanguage(languageCode) {
	if (typeof languageCode !== "string" || languageCode === "") {
		return null;
	}
	const lowerCode = languageCode.toLowerCase();
	const languages = readLanguages();
	for (const language of languages) {
		if (language.code.toLowerCase() === lowerCode) {
			return language;
		}
	}
	return null;
}

//==============================================================================
// 언어 태그에 맞는 언어. ("pt-BR" → pt, "zh-Hant-TW" → zh-Hant, 뒤의 조각을 하나씩 떼며 코드와 별칭을 본다, 없으면 null)
//==============================================================================
/**
 * @param { string } languageTag 언어 태그. ("pt-BR" 같은 꼴, 밑줄도 받는다)
 * @returns { object | null } 맞는 언어 줄. 없으면 null.
 */
export function matchLanguageTag(languageTag) {
	if (typeof languageTag !== "string" || languageTag === "") {
		return null;
	}
	const languages = readLanguages();
	const subtags = languageTag.toLowerCase().replace(/_/g, "-").split("-");
	for (let subtagCount = subtags.length; subtagCount > 0; --subtagCount) {
		const candidateTag = subtags.slice(0, subtagCount).join("-");
		for (const language of languages) {
			if (language.code.toLowerCase() === candidateTag || language.aliases.includes(candidateTag)) {
				return language;
			}
		}
	}
	return null;
}

//==============================================================================
// 앞세울 언어 태그 넣기. (플랫폼이 알려 준 사용자의 언어, 기기의 언어보다 먼저 본다, 없으면 "")
//==============================================================================
/**
 * @param { string } languageTag 앞세울 언어 태그. (글이 아니면 "")
 */
export function setPreferredLanguageTag(languageTag) {
	preferredLanguageTag = typeof languageTag === "string" ? languageTag : "";
}

//==============================================================================
// 기기(브라우저)의 언어. (기기가 앞세우는 순서대로 목록에 있는 첫 언어, 없으면 기본 언어)
//==============================================================================
/**
 * @returns { string } 고른 언어 코드. (맞는 것이 없으면 기본 언어 코드)
 */
export function resolveDeviceLanguageCode() {
	const languageTags = [];
	if (preferredLanguageTag !== "") {
		languageTags.push(preferredLanguageTag);
	}
	const navigator = System.navigator;
	if (navigator) {
		if (navigator.languages) {
			for (const languageTag of navigator.languages) {
				languageTags.push(languageTag);
			}
		}
		if (navigator.language) {
			languageTags.push(navigator.language);
		}
	}
	for (const languageTag of languageTags) {
		const language = matchLanguageTag(languageTag);
		if (language !== null) {
			return language.code;
		}
	}
	return readFallbackLanguageCode();
}

//==============================================================================
// 기본 언어의 코드.
//==============================================================================
/**
 * @returns { string } 기본 언어 코드. (목록이 없거나 정하지 않았으면 "en")
 */
export function readFallbackLanguageCode() {
	if (languageList === null || typeof languageList.fallbackLanguage !== "string") {
		return "en";
	}
	return languageList.fallbackLanguage;
}

//==============================================================================
// 설정의 언어 → 쓸 언어의 코드. (비었거나 목록에 없으면 기기의 언어)
//==============================================================================
/**
 * @param { string } settingLanguageCode 설정에 저장된 언어 코드. (비었거나 목록에 없으면 기기의 언어)
 * @returns { string } 쓸 언어 코드.
 */
export function resolveLanguageCode(settingLanguageCode) {
	const language = findLanguage(settingLanguageCode);
	if (language !== null) {
		return language.code;
	}
	return resolveDeviceLanguageCode();
}

//==============================================================================
// 언어의 표 읽기. (못 읽으면 빈 표)
//==============================================================================
/**
 * @param { object } language
 * @returns { Promise<object> }
 */
async function readLanguageTexts(language) {
	const data = await readJson(languageDirectoryPath + language.file);
	if (data === null) {
		console.warn("[localization] 언어의 표를 읽지 못했습니다: " + language.code);
		return {};
	}
	return data;
}

//==============================================================================
// 언어 불러오기. (그 언어의 표와 기본 언어의 표, 목록에 없는 코드면 기본 언어)
//==============================================================================
/**
 * @param { string } languageCode 불러올 언어 코드. (목록에 없으면 기본 언어)
 */
export async function loadLanguage(languageCode) {
	await loadLanguageList();
	const fallbackLanguageCode = readFallbackLanguageCode();
	let language = findLanguage(languageCode);
	if (language === null) {
		language = findLanguage(fallbackLanguageCode);
	}
	if (language === null) {
		return;
	}
	const fallbackLanguage = findLanguage(fallbackLanguageCode);
	const isFallbackLoaded = fallbackLanguage !== null && System.Object.keys(fallbackTexts).length > 0;
	if (fallbackLanguage !== null && !isFallbackLoaded) {
		fallbackTexts = await readLanguageTexts(fallbackLanguage);
	}
	currentTexts = language === fallbackLanguage ? fallbackTexts : await readLanguageTexts(language);
	currentLanguage = language;
	applyDocumentLanguage(language);
}

//==============================================================================
// 페이지의 언어와 제목을 지금 언어로. (html 의 lang 과 탭의 제목, 제목은 setDocumentTitleKey 의 열쇠, 처음은 game.title)
//
// 빌드의 index.html 은 lang 이 한 가지로 박혀 있어, 고른 언어가 다르면 화면 읽기와 브라우저의 번역 제안이 어긋난다.
//==============================================================================
/**
 * @param { object } language 목록의 한 줄.
 */
function applyDocumentLanguage(language) {
	if (typeof System.document === "undefined") {
		return;
	}
	System.document.documentElement.lang = language.code;
	if (documentTitleKey === "") {
		return;
	}
	const documentTitle = translate(documentTitleKey);
	if (documentTitle !== documentTitleKey) {
		System.document.title = documentTitle;
	}
}

//==============================================================================
// 설정의 언어 적용하기. (쓸 언어를 정해 그 표를 불러오고, setLanguageLoadedHandler 로 건 함수를 부른다)
//==============================================================================
/**
 * @param { string } settingLanguageCode "" 이면 기기의 언어.
 */
export async function applyLanguageSetting(settingLanguageCode) {
	await loadLanguageList();
	const languageCode = resolveLanguageCode(settingLanguageCode);
	await loadLanguage(languageCode);
	const language = readLanguage();
	if (language === null) {
		return;
	}
	if (languageLoadedHandler === null) {
		return;
	}
	const allTexts = readAllTexts();
	await languageLoadedHandler(language, allTexts);
}

//==============================================================================
// 지금 언어. (목록의 한 줄, 아직 없으면 null)
//==============================================================================
/**
 * @returns { object | null } 지금 언어 줄. 아직 없으면 null.
 */
export function readLanguage() {
	return currentLanguage;
}

//==============================================================================
// 지금 언어의 코드. (아직 없으면 기본 언어)
//==============================================================================
/**
 * @returns { string } 지금 언어 코드. 아직 없으면 기본 언어 코드.
 */
export function readLanguageCode() {
	if (currentLanguage === null) {
		return readFallbackLanguageCode();
	}
	return currentLanguage.code;
}

//==============================================================================
// 지금 언어의 글자 방향. ("ltr" 또는 "rtl", 언어 목록의 direction, 아직 없으면 "ltr")
//
// 오른쪽에서 왼쪽으로 쓰는 언어(아랍어, 페르시아어, 히브리어 등)면 화면의 글자를 그 방향으로 굽고 배치를 좌우로 뒤집는다.
//==============================================================================
/**
 * @returns { string } "ltr" 또는 "rtl".
 */
export function readTextDirection() {
	if (currentLanguage === null || currentLanguage.direction !== "rtl") {
		return "ltr";
	}
	return "rtl";
}

//==============================================================================
// 지금 언어가 오른쪽에서 왼쪽으로 쓰는지. (readTextDirection 이 "rtl" 이면 true)
//==============================================================================
/**
 * @returns { boolean } 오른쪽에서 왼쪽으로 쓰면 참.
 */
export function isRightToLeft() {
	const textDirection = readTextDirection();
	return textDirection === "rtl";
}

//==============================================================================
// 배치의 가로 자리. (오른쪽에서 왼쪽 언어면 부모 너비 안에서 좌우를 뒤집은 왼쪽, 아니면 그대로)
//
// 창과 표의 왼쪽, 오른쪽 배치를 언어 방향에 맞춰 뒤집을 때 쓴다. 화면 구석의 자리나 슬라이더의 방향처럼 뒤집지 않을 것은 부르지 않는다.
//==============================================================================
/**
 * @param { number } x 왼쪽에서 오른쪽 언어일 때의 왼쪽.
 * @param { number } width 놓을 것의 너비.
 * @param { number } parentWidth 부모의 너비.
 * @returns { number } 지금 언어 방향에 맞춘 왼쪽.
 */
export function mirrorLayoutX(x, width, parentWidth) {
	if (!isRightToLeft()) {
		return x;
	}
	return parentWidth - x - width;
}

//==============================================================================
// 배치의 글자 정렬. (오른쪽에서 왼쪽 언어면 "left" 와 "right" 를 바꾸고, 나머지는 그대로)
//==============================================================================
/**
 * @param { string } textAlign "left", "center", "right", "start", "end"
 * @returns { string } 지금 언어 방향에 맞춘 정렬 값.
 */
export function readLayoutTextAlign(textAlign) {
	if (!isRightToLeft()) {
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
// 글 사이에 끼우는 값 묶기. (오른쪽에서 왼쪽 언어면 방향 격리 문자 FSI ... PDI 로 묶고, 아니면 그대로)
//
// 오른쪽에서 왼쪽으로 쓰는 글 안의 숫자와 단위(예: 123°/s, +60%, 88 / 1.5s)나 사람 이름이 앞뒤 글과 섞여 흩어지지 않게,
// 묶은 값은 제 방향(처음 나오는 방향이 강한 글자, 숫자뿐이면 왼쪽에서 오른쪽)으로 한 덩어리로 놓인다.
//==============================================================================
/**
 * @param { string } text 묶을 값의 글.
 * @returns { string } 오른쪽에서 왼쪽 언어면 방향 격리 문자로 묶은 글, 아니면 그대로. (빈 글은 그대로)
 */
export function isolateText(text) {
	const textDirection = readTextDirection();
	if (textDirection !== "rtl" || text === "") {
		return text;
	}
	return FIRST_STRONG_ISOLATE + text + POP_DIRECTIONAL_ISOLATE;
}

//==============================================================================
// 열쇠의 글자. (지금 언어 → 기본 언어 → 열쇠 그대로)
//==============================================================================
/**
 * @param { string } key 글자의 열쇠.
 * @returns { string } 지금 언어의 글자. 없으면 기본 언어의 글자, 거기에도 없으면 열쇠 그대로.
 */
export function translate(key) {
	const text = currentTexts[key];
	if (typeof text === "string") {
		return text;
	}
	const fallbackText = fallbackTexts[key];
	if (typeof fallbackText === "string") {
		return fallbackText;
	}
	return key;
}

//==============================================================================
// 열쇠의 글자에 값 넣기. ("Restart {seconds}" + { seconds: 3 } → "Restart 3")
//
// 오른쪽에서 왼쪽 언어면 넣는 값을 방향 격리 문자로 묶는다. (isolateText)
// 빗금으로만 이은 값들("{count}/{limit}")은 값마다가 아니라 통째로 한 번 묶는다. 값마다 묶으면 두 덩어리가 오른쪽부터 놓여 1/40 이 40/1 로 보인다.
//==============================================================================
/**
 * @param { string } key 글자의 열쇠.
 * @param { object } values 자리 이름 → 값.
 * @returns { string } 자리를 채운 글자.
 */
export function formatText(key, values) {
	const text = translate(key);
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
		return isolateText(valueText);
	});
}

//==============================================================================
// 지금 언어의 글자 모두. (글꼴의 조각을 미리 받을 때 쓴다)
//==============================================================================
/**
 * @returns { string } 지금 언어 표의 글자를 모두 이은 글.
 */
export function readAllTexts() {
	const texts = System.Object.values(currentTexts);
	return texts.join("");
}


//==============================================================================
// 언어의 목록 넣기. (파일 없이 바로 줄 때, languages.json 과 같은 꼴, 읽었으면 true)
// - loadLanguageList 가 읽은 파일도 여기로 넣는다. code 가 글이 아닌 줄은 빼고, aliases 와 countries 가 없으면 빈 배열, 글은 소문자로 맞춘다.
//==============================================================================
/**
 * @param { object } data - { fallbackLanguage, languages: [...] }
 * @returns { boolean } 목록을 넣었으면 참. (languages 배열이 없으면 거짓)
 * @example <caption>aliases 가 없는 줄도 받기</caption>
 * import { LanguagePack } from "./build/vanilla.js";
 *
 * const isLanguageListSet = LanguagePack.setLanguageList({
 * 	fallbackLanguage: "en",
 * 	languages: [
 * 		{ code: "en", name: "English", file: "en.json" },
 * 		{ code: "pt", name: "Portugues", aliases: ["PT-BR"], file: "pt.json" }
 * 	]
 * });
 * const englishLanguage = LanguagePack.matchLanguageTag("en-US");
 * const portugueseLanguage = LanguagePack.matchLanguageTag("pt_BR");
 * console.log(isLanguageListSet, englishLanguage.code, englishLanguage.aliases.length, portugueseLanguage.code);
 */
export function setLanguageList(data) {
	if (data === null || typeof data !== "object" || !System.Array.isArray(data.languages)) {
		return false;
	}
	const languageEntries = normalizeLanguageEntries(data.languages);
	languageList = System.Object.assign({}, data, { languages: languageEntries });
	return true;
}

//==============================================================================
// 지금 언어의 표 넣기. (파일 없이 바로 줄 때, 기본 언어 표도 함께. 언어가 목록에 없으면 false)
//==============================================================================
/**
 * @param { string } languageCode 지금 언어로 정할 코드. (목록에 있어야 한다)
 * @param { object } texts 열쇠 → 글자.
 * @param { object } fallbackTextTable 기본 언어의 열쇠 → 글자.
 * @returns { boolean } 넣었으면 참. 언어가 목록에 없으면 거짓.
 */
export function setLanguageTexts(languageCode, texts, fallbackTextTable) {
	const language = findLanguage(languageCode);
	if (language === null) {
		return false;
	}
	currentTexts = texts;
	fallbackTexts = fallbackTextTable;
	currentLanguage = language;
	return true;
}


//==============================================================================
// 경로 정하기. (언어 목록 파일, 언어 파일들이 있는 폴더, 불러오기 전에 부른다)
//==============================================================================
/**
 * @param { string } listPath 언어 목록 파일(languages.json) 경로.
 * @param { string } directoryPath - "/" 로 끝난다.
 */
export function setLanguagePaths(listPath, directoryPath) {
	languageListPath = listPath;
	languageDirectoryPath = directoryPath;
}

//==============================================================================
// 탭 제목이 될 글자의 열쇠 정하기. ("" 이면 탭 제목을 바꾸지 않는다)
//==============================================================================
/**
 * @param { string } titleKey 탭 제목이 될 글자의 열쇠. ("" 이면 탭 제목을 바꾸지 않는다)
 */
export function setDocumentTitleKey(titleKey) {
	documentTitleKey = titleKey;
}

//==============================================================================
// 언어를 불러온 뒤 부를 함수 정하기. (applyLanguageSetting 이 부른다, 그 언어의 글꼴 받기 등, null 이면 없음)
//==============================================================================
/**
 * @param { function(object, string): Promise<void> | void | null } handler - (언어의 한 줄, 모든 글자)
 */
export function setLanguageLoadedHandler(handler) {
	languageLoadedHandler = handler;
}
