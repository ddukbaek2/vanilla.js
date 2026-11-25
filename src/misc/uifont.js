//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { JsonAsset } from "../resource/jsonasset.js";


//==============================================================================
// UI 글꼴. (화면 위의 모든 글자, 여러 문자의 글꼴 조각을 한 이름 아래 묶음, UIFont 로 들여온다)
// - 글꼴 이름, 목록 파일과 폴더, 맨 뒤 묶음, 굵기, 기다리는 시간은 configureUiFont 로 정한다. (처음은 GameUI, ./assets/fonts/fonts.json, latin, 500 과 700)
// - 목록은 fonts.json(색인 [{ group, manifest }])과 fonts-<묶음>.json(조각 [{ file, weight, unicodeRange }])이다.
//
// 화면의 모든 언어를 한 글꼴 이름(configureUiFont 의 family) 아래에 모아 그린다.
// 라틴, 키릴 문자는 기본 글꼴(Exo 2)이고, 그 밖의 문자는 그와 비슷한 느낌의 글꼴이다. 
// 글꼴 파일을 합치지 않는다. Google Fonts 가 나눠 둔 조각마다 FontFace 를 만들어 그 조각의 글자 범위(unicode-range)로 올린다.
// 그래서 브라우저는 화면에 쓰는 글자가 든 조각만 받는다. (한, 중, 일 글꼴은 조각이 수백 개이다)
// 한자처럼 여러 글꼴이 함께 가진 글자는 나중에 올린 글꼴이 그린다. 고른 언어의 글꼴 묶음을 라틴 바로 앞(뒤에서 둘째)에 올려
// 일본어면 일본 글꼴, 중국어 번체면 번체 글꼴의 한자가 나오게 한다. 라틴은 늘 맨 뒤라 숫자와 영문은 어느 언어에서나 라틴 글꼴이다.
// 한 글꼴 이름 아래의 조각은 굵기의 표시가 모두 같아야 글자 범위로 함께 고른다. (굵기를 먼저 고르고 그 굵기의 조각만 보기 때문이다)
// 그래서 모든 조각을 configureUiFont 의 weights(처음은 500, 700) 두 굵기로만 올린다. 가변 굵기 조각은 두 번(500 과 700), 400 뿐인 조각은 500 으로 올린다.
// 화면이 400 을 청하면 500, 600 을 청하면 700 조각이 그린다.
// 캔버스는 받지 않은 조각을 기다리지 않고 다른 글꼴로 그려 버리므로, 쓸 글자를 그릴 조각을 미리 받는다. (loadUiFontText)
// 조각을 받으면 엔진(EngineConfiguration.rebakeTextOnFontLoad)이 그 조각의 글자로 구운 글자 그림만 버려 다시 굽는다.
// 글꼴의 목록은 묶음마다 나뉘어 있다. (fonts.json 은 색인, fonts-<묶음>.json 이 그 묶음의 조각들)
// 처음에는 고른 언어와 라틴의 목록만 받고, 나머지(언어 창의 언어 이름, 사람 이름처럼 다른 문자)는 놀이를 시작하고 조금 뒤에 받는다.
// 처음의 조각은 configureUiFont 의 waitMilliseconds 까지만 기다리고, 그 뒤는 놀이를 먼저 시작해 받는 대로 다시 굽는다. (첫 로딩 줄이기)
// 경로를 글자 그대로 적어 두어 빌드의 캐시 무효화가 지문을 붙이게 한다. (조각의 지문은 빌드가 목록에 붙인다)
//==============================================================================
let uiFontFamily = "GameUI";
let fontManifestPath = "./assets/fonts/fonts.json";
let fontDirectoryPath = "./assets/fonts/";
// 맨 뒤(가장 높게)에 두는 묶음.
let primaryFontGroup = "latin";
// 조각을 올리는 굵기. (보통과 굵게)
let uiFontWeights = [500, 700];
// 처음에 쓸 글자의 조각을 기다리는 가장 긴 시간. (밀리초, 느린 망에서도 놀이를 오래 막지 않게)
let uiFontWaitMilliseconds = 1500;
// 놀이를 시작하고 나머지 묶음의 목록을 받기 시작하기까지. (밀리초, 처음의 받기와 겹치지 않게)
let remainingGroupsDelayMilliseconds = 3000;

// 글꼴 묶음. ([{ group, order, faces: [{ fontFace, weight, ranges }] }], 목록 순서가 아니라 올린 순서)
let fontGroups = [];
// 글꼴 목록의 색인. ([{ group, manifest }], 색인의 차례, 아직 못 읽었으면 null)
let fontIndex = null;
// 앞세운 묶음. (applyUiFontGroup 이 마지막으로 앞세운 고른 언어의 묶음)
let currentFontGroup = primaryFontGroup;
// 나머지 묶음을 받기 시작했는지.
let isRemainingGroupsRequested = false;
// 엔진의 글자 컴포넌트에 줄 대표 FontFace. (글꼴 이름만 읽는다, 못 불러왔으면 null)
let representativeFontFace = null;
// 미리 받기를 청한 글자. (같은 글자를 거듭 청하지 않는다)
const requestedCharacters = new System.Set();

/**
 * @example <caption>UI 글꼴 설정하고 글꼴 문자열 만들기</caption>
 * import { UIFont } from "./build/vanilla.js";
 *
 * UIFont.configureUiFont({ family: "ExampleUI", manifestPath: "./assets/fonts/fonts.json", directoryPath: "./assets/fonts/", weights: [500, 700], waitMilliseconds: 1000 });
 * const fontString = UIFont.buildUiFontString(700, 24);
 * console.log(UIFont.readUiFontFamily(), fontString, UIFont.readUiFontFace());
 */


//==============================================================================
// 글자 범위 읽기. ("U+0000-00FF, U+0131" → [[0, 255], [305, 305]])
//==============================================================================
/**
 * @param { string } unicodeRange
 * @returns { number[][] }
 */
function parseUnicodeRange(unicodeRange) {
	const ranges = [];
	for (const rangeText of unicodeRange.split(",")) {
		const rangeMatch = rangeText.trim().match(/^U\+([0-9a-fA-F?]+)(?:-([0-9a-fA-F]+))?$/);
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
// 조각의 굵기 → 올릴 굵기. ("400 700" → [500, 700], "400" → [500], "700" → [700])
//
// 범위면 그 안의 uiFontWeights 모두, 한 값이면 가장 가까운 하나이다.
//==============================================================================
/**
 * @param { string } weightDescriptor
 * @returns { number[] }
 */
function readTargetWeights(weightDescriptor) {
	const weightValues = weightDescriptor.trim().split(/\s+/).map((weightText) => {
		return System.Number(weightText);
	});
	if (weightValues.length >= 2) {
		return uiFontWeights.filter((targetWeight) => {
			return targetWeight >= weightValues[0] && targetWeight <= weightValues[1];
		});
	}
	let nearestWeight = uiFontWeights[0];
	for (const targetWeight of uiFontWeights) {
		if (System.Math.abs(targetWeight - weightValues[0]) < System.Math.abs(nearestWeight - weightValues[0])) {
			nearestWeight = targetWeight;
		}
	}
	return [nearestWeight];
}

//==============================================================================
// 그 글자를 그 굵기로 그릴 조각. (나중에 올린 묶음부터 보아 범위에 드는 첫 조각, 없으면 null)
//==============================================================================
/**
 * @param { number } codePoint
 * @param { number } targetWeight
 * @returns { FontFace | null }
 */
function findDrawingFontFace(codePoint, targetWeight) {
	for (let groupIndex = fontGroups.length - 1; groupIndex >= 0; --groupIndex) {
		const faces = fontGroups[groupIndex].faces;
		for (const face of faces) {
			if (face.weight !== targetWeight) {
				continue;
			}
			for (const range of face.ranges) {
				if (codePoint >= range[0] && codePoint <= range[1]) {
					return face.fontFace;
				}
			}
		}
	}
	return null;
}

//==============================================================================
// 엔진의 글자 그림 캐시 비우기. (받은 조각으로 다시 굽게 한다)
//==============================================================================
function clearTextCache() {
	const engine = System.vanillaEngine;
	if (!engine) {
		return;
	}
	const graphic = engine.getGraphic();
	if (!graphic) {
		return;
	}
	const textStringTextureCache = graphic.getTextStringTextureCache();
	textStringTextureCache.clear();
}

//==============================================================================
// UI 글꼴 불러오기. (고른 언어와 라틴의 묶음을 올려 앞세우고, 그 언어의 글자를 미리 받는다)
//
// 쓸 글자의 조각은 uiFontWaitMilliseconds 까지만 기다리고 나머지는 뒤에서 받는다.
// 나머지 묶음은 처음 한 번 remainingGroupsDelayMilliseconds 뒤에 받기 시작한다.
// 못 불러와도 게임은 시스템 글꼴로 이어진다.
//==============================================================================
/**
 * @param { string } fontGroup 고른 언어의 글꼴 묶음. (languages.json 의 fontGroup)
 * @param { string } text 미리 받을 글자. (그 언어의 글자 모두)
 */
export async function loadUiFont(fontGroup, text) {
	const isIndexLoaded = await loadFontIndex();
	if (!isIndexLoaded) {
		return;
	}
	await System.Promise.all([loadFontGroup(fontGroup), loadFontGroup(primaryFontGroup)]);
	if (fontGroups.length === 0) {
		return;
	}
	applyUiFontGroup(fontGroup);
	const textLoad = loadUiFontText(text);
	const waitLimit = new System.Promise((resolve) => {
		System.setTimeout(resolve, uiFontWaitMilliseconds);
	});
	await System.Promise.race([textLoad, waitLimit]);
	if (!isRemainingGroupsRequested) {
		isRemainingGroupsRequested = true;
		System.setTimeout(() => {
			loadRemainingFontGroups();
		}, remainingGroupsDelayMilliseconds);
	}
}

//==============================================================================
// 글꼴 목록의 색인 읽기. (한 번만, 읽었으면 true)
//==============================================================================
/**
 * @returns { Promise<boolean> }
 */
async function loadFontIndex() {
	if (fontIndex !== null) {
		return true;
	}
	const jsonAsset = new JsonAsset();
	await jsonAsset.load(fontManifestPath);
	const manifest = jsonAsset.data;
	if (manifest === null || !System.Array.isArray(manifest.fonts)) {
		console.warn("[uifont] 글꼴의 목록을 읽지 못했습니다.");
		return false;
	}
	fontIndex = manifest.fonts.filter((indexEntry) => {
		return typeof indexEntry.group === "string" && typeof indexEntry.manifest === "string";
	});
	return true;
}

//==============================================================================
// 글꼴 묶음 하나 올릴 준비. (그 묶음의 목록을 받아 조각마다 FontFace 를 만든다, 이미 있으면 그대로)
//
// 올리기(document.fonts 에 넣기)는 applyUiFontGroup 이 차례를 맞춰 한다.
//==============================================================================
/**
 * @param { string } group
 */
async function loadFontGroup(group) {
	const isLoaded = fontGroups.some((fontGroupEntry) => {
		return fontGroupEntry.group === group;
	});
	if (isLoaded || fontIndex === null) {
		return;
	}
	const indexOrder = fontIndex.findIndex((indexEntry) => {
		return indexEntry.group === group;
	});
	if (indexOrder < 0) {
		return;
	}
	const indexEntry = fontIndex[indexOrder];
	const jsonAsset = new JsonAsset();
	await jsonAsset.load(fontDirectoryPath + indexEntry.manifest);
	const font = jsonAsset.data;
	if (font === null || !System.Array.isArray(font.faces)) {
		console.warn("[uifont] 글꼴 묶음의 목록을 읽지 못했습니다: " + group);
		return;
	}
	// 받는 사이에 다른 곳이 같은 묶음을 올렸으면 그대로 둔다.
	const isLoadedMeanwhile = fontGroups.some((fontGroupEntry) => {
		return fontGroupEntry.group === group;
	});
	if (isLoadedMeanwhile) {
		return;
	}
	const faces = [];
	for (const face of font.faces) {
		const ranges = parseUnicodeRange(face.unicodeRange);
		const targetWeights = readTargetWeights(face.weight);
		for (const targetWeight of targetWeights) {
			const descriptors = { weight: System.String(targetWeight), style: face.style, unicodeRange: face.unicodeRange, display: "swap" };
			const fontFace = new System.FontFace(uiFontFamily, "url(" + fontDirectoryPath + face.file + ")", descriptors);
			faces.push({ fontFace: fontFace, weight: targetWeight, ranges: ranges });
		}
	}
	fontGroups.push({ group: group, order: indexOrder, faces: faces });
}

//==============================================================================
// 나머지 묶음 받기. (다른 문자의 글자, 다 받으면 차례를 맞춰 올리고 그동안 청한 글자의 조각을 받는다)
//==============================================================================
async function loadRemainingFontGroups() {
	if (fontIndex === null) {
		return;
	}
	const groupLoads = fontIndex.map((indexEntry) => {
		return loadFontGroup(indexEntry.group);
	});
	try {
		await System.Promise.all(groupLoads);
	}
	catch (error) {
		console.warn("[uifont] 나머지 글꼴 묶음을 받지 못했습니다.", error);
	}
	applyUiFontGroup(currentFontGroup);
	// 묶음이 아직 없어 조각을 찾지 못했던 글자(먼저 청한 이름)도 이제 받는다.
	const requestedText = System.Array.from(requestedCharacters).join("");
	loadUiFontText(requestedText);
}

//==============================================================================
// 고른 언어의 글꼴 묶음 앞세우기. (그 묶음을 라틴 바로 앞에 두고 모든 조각을 다시 올린다)
//==============================================================================
/**
 * @param { string } fontGroup 앞세울 글꼴 묶음. (languages.json 의 fontGroup, 올린 묶음이 하나도 없으면 아무것도 하지 않는다)
 */
export function applyUiFontGroup(fontGroup) {
	if (fontGroups.length === 0) {
		return;
	}
	currentFontGroup = fontGroup;
	// 나머지 묶음은 색인의 차례대로 둔다. (늦게 받은 묶음이 끼어도 차례가 같게)
	const orderedGroups = fontGroups.filter((fontGroupEntry) => {
		return fontGroupEntry.group !== fontGroup && fontGroupEntry.group !== primaryFontGroup;
	});
	orderedGroups.sort((firstGroup, secondGroup) => {
		return firstGroup.order - secondGroup.order;
	});
	for (const fontGroupEntry of fontGroups) {
		if (fontGroupEntry.group === fontGroup && fontGroup !== primaryFontGroup) {
			orderedGroups.push(fontGroupEntry);
		}
	}
	for (const fontGroupEntry of fontGroups) {
		if (fontGroupEntry.group === primaryFontGroup) {
			orderedGroups.push(fontGroupEntry);
		}
	}
	const fontFaceSet = System.document.fonts;
	for (const fontGroupEntry of fontGroups) {
		for (const face of fontGroupEntry.faces) {
			fontFaceSet.delete(face.fontFace);
		}
	}
	for (const fontGroupEntry of orderedGroups) {
		for (const face of fontGroupEntry.faces) {
			fontFaceSet.add(face.fontFace);
		}
	}
	fontGroups = orderedGroups;
	const primaryGroup = orderedGroups[orderedGroups.length - 1];
	representativeFontFace = primaryGroup.faces.length > 0 ? primaryGroup.faces[0].fontFace : null;
	clearTextCache();
}

//==============================================================================
// 글자의 조각 받기. (그 글자가 든 조각만, 다 받을 때까지 기다린다)
//==============================================================================
/**
 * @param { string } text 그릴 글자. (빈 글이거나 올린 묶음이 없으면 아무것도 하지 않는다)
 */
export async function loadUiFontText(text) {
	if (fontGroups.length === 0 || typeof text !== "string" || text === "") {
		return;
	}
	// 글자마다 굵기마다 그 글자를 그릴 조각(나중에 올린 것부터 보아 범위에 드는 첫 조각)을 모은다.
	const fontFacesToLoad = new System.Set();
	for (const character of text) {
		requestedCharacters.add(character);
		const codePoint = character.codePointAt(0);
		for (const targetWeight of uiFontWeights) {
			const fontFace = findDrawingFontFace(codePoint, targetWeight);
			if (fontFace !== null && fontFace.status !== "loaded") {
				fontFacesToLoad.add(fontFace);
			}
		}
	}
	if (fontFacesToLoad.size === 0) {
		return;
	}
	const loads = System.Array.from(fontFacesToLoad).map((fontFace) => {
		return fontFace.load();
	});
	try {
		await System.Promise.all(loads);
	}
	catch (error) {
		console.warn("[uifont] 글꼴의 조각을 받지 못했습니다.", error);
	}
}

//==============================================================================
// 글자의 조각 받기 청하기. (사람 이름처럼 그때그때 나오는 글자, 기다리지 않고 처음 보는 글자만)
//==============================================================================
/**
 * @param { string } text 그릴 글자. (전에 청하지 않은 글자만 받는다)
 */
export function requestUiFontText(text) {
	if (fontGroups.length === 0 || typeof text !== "string" || text === "") {
		return;
	}
	let newCharacters = "";
	for (const character of text) {
		if (!requestedCharacters.has(character)) {
			newCharacters += character;
		}
	}
	if (newCharacters === "") {
		return;
	}
	loadUiFontText(newCharacters);
}

//==============================================================================
// 불러온 UI 글꼴의 대표 FontFace 반환. (엔진의 UILabel, UIInputField 에 준다, 글꼴 이름만 쓰이다, 못 불러왔으면 null)
//==============================================================================
/**
 * @returns { FontFace | null } 맨 뒤 묶음의 첫 조각. 못 불러왔으면 null.
 */
export function readUiFontFace() {
	return representativeFontFace;
}

//==============================================================================
// UI 글꼴 문자열. (굵기, 크기)
//==============================================================================
/**
 * @param { number } fontWeight 굵기. (500, 700 같은 수)
 * @param { number } fontSize 크기. (픽셀)
 * @returns { string } 캔버스 font 꼴의 글. (예: 700 24px "GameUI", sans-serif)
 */
export function buildUiFontString(fontWeight, fontSize) {
	return fontWeight + " " + fontSize + "px \"" + uiFontFamily + "\", sans-serif";
}


//==============================================================================
// UI 글꼴 설정. (불러오기 전에 부른다, 주지 않은 칸은 그대로)
//==============================================================================
/**
 * @param { object } options - { family, manifestPath, directoryPath, primaryGroup, weights, waitMilliseconds, remainingDelayMilliseconds }
 */
export function configureUiFont(options) {
	if (options.family !== undefined) {
		uiFontFamily = options.family;
	}
	if (options.manifestPath !== undefined) {
		fontManifestPath = options.manifestPath;
	}
	if (options.directoryPath !== undefined) {
		fontDirectoryPath = options.directoryPath;
	}
	if (options.primaryGroup !== undefined) {
		primaryFontGroup = options.primaryGroup;
		currentFontGroup = options.primaryGroup;
	}
	if (options.weights !== undefined) {
		uiFontWeights = options.weights.slice();
	}
	if (options.waitMilliseconds !== undefined) {
		uiFontWaitMilliseconds = options.waitMilliseconds;
	}
	if (options.remainingDelayMilliseconds !== undefined) {
		remainingGroupsDelayMilliseconds = options.remainingDelayMilliseconds;
	}
}

//==============================================================================
// UI 글꼴 이름 반환.
//==============================================================================
/**
 * @returns { string } UI 글꼴 이름. (처음은 "GameUI")
 */
export function readUiFontFamily() {
	return uiFontFamily;
}
