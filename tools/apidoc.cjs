//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");


//==============================================================================
// API 문서 자료 뽑기.
// - 엔진 진입점(import.js)이 내보내는 공개 API 를 소스에서 읽어 docs/api/<버전>.json 을 쓴다. (외부 의존 없이 node 내장 모듈만 쓴다)
// - 소스는 작은 토크나이저로 읽는다. (문자열, 템플릿 문자열, 정규식, 주석을 가려 중괄호 깊이를 센다)
// - 설명의 ko 는 소스 주석 원문 그대로, en 은 docs/api/translation.en.json (ko 원문 → en) 표에서 가져온다. 한글이 없는 원문은 그대로 en 이 된다.
// - since 는 v0.0.8 부터 만들려는 판 앞까지의 태그를 훑어, 그 클래스(이름으로 찾음)에 그 멤버가 처음 있던 판이다. 어느 태그에도 없으면 만들려는 판.
// - #이름, 밑줄로 시작하는 이름, JSDoc 에 @private 이 붙은 멤버는 뺀다.
// - JSDoc 의 @example 은 examples 칸이 된다. (모듈은 어느 선언에도 붙지 않은 깊이 0 의 JSDoc 에서 읽는다)
// - @example 바로 뒤의 @exampleImage <파일 이름> 은 그 예제의 image 칸이 된다. 그림은 docs/guide/<버전>/images/<파일 이름> 에 두고 --check 가 있는지 본다.
// - counterpart 는 러스트 판(vanilla-engine)의 짝이다. docs/api/counterpart.<버전>.json (러스트 판 도구가 이름으로 지은 짝 표를 옮겨 둔 것) 에서 읽는다.
// - 초안 모듈(이름이 experimental 이거나 experimental/ 로 시작하는 것)은 자료에 넣지 않고, 초안을 가리키는 짝도 뺀다.
//   --check(초안은 메모리에서 지어 따로 본다), --gaps, --missing, --check-examples 는 초안도 본다.
//   초안은 진입점(import.js)과 묶음에 들지 않아, 초안 진입점(src/experimental/experimental.js)을 Experimental 이름 공간으로 따로 읽는다.
//   초안 예제는 엔진을 ./import.js 로, 초안을 import * as Experimental from "./src/experimental/experimental.js" 로 불러온다.
// 사용:
//   node tools/apidoc.cjs <버전> [--date YYYY-MM-DD]   docs/api/<버전>.json 쓰기
//   node tools/apidoc.cjs <버전> --counterpart <짝 표>  러스트 판의 docs/api/counterpart.<버전>.json 을 이 저장소로 옮기고 자료 쓰기
//   node tools/apidoc.cjs <버전> --missing             표에 없는 ko 글 목록 (JSON 배열)
//   node tools/apidoc.cjs <버전> --check               docs/api/<버전>.json 꼴 검사와 수 세기, 예제 그림과 가이드 그림 파일 검사
//   node tools/apidoc.cjs <버전> --gaps                문서 빈 곳 (빈 설명, 빈 꼴, @returns 없는 함수, 예제 없는 클래스와 모듈, 머리 주석 없는 비공개 함수, 떨어진 머리 주석)
//   node tools/apidoc.cjs <버전> --check-examples      예제 검사 (문법, 엔진 이름, node 와 헤드리스 크롬으로 돌려 보기)
//   --missing, --gaps, --check-examples 는 --only <경로 앞>, --exclude <경로 앞> 으로 거른다. (여러 번 줄 수 있다)
//==============================================================================


//==============================================================================
// 전역 상수 목록.
//==============================================================================
const REPOSITORY_ROOT = path.resolve(__dirname, "..");
const ENTRY_FILE_PATH = path.join(REPOSITORY_ROOT, "import.js");
const DRAFT_ENTRY_MODULE_PATH = "src/experimental/experimental.js"; // 초안 진입점. (import.js 와 묶음에 들지 않는다)
const DRAFT_NAMESPACE_NAME = "Experimental"; // 초안 진입점을 읽는 이름 공간 이름.
const UPDATE_FILE_PATH = path.join(REPOSITORY_ROOT, "UPDATE.md");
const API_DIRECTORY_PATH = path.join(REPOSITORY_ROOT, "docs", "api");
const TRANSLATION_FILE_PATH = path.join(API_DIRECTORY_PATH, "translation.en.json");
const GUIDE_DIRECTORY_PATH = path.join(REPOSITORY_ROOT, "docs", "guide");
const ENGINE_NAME = "vanilla.js";
const COUNTERPART_ENGINE_NAME = "vanilla-engine"; // 짝 엔진. (러스트 판)
const SINCE_FIRST_VERSION = "0.0.8"; // since 를 훑기 시작하는 판. (이 판부터 소스가 src/ 아래 지금 꼴이다)
const MEMBER_KINDS = ["method", "property", "constructor", "static", "field"];
const HANGUL_PATTERN = /[ᄀ-ᇿ㄰-㆏가-힣]/;
const SECTION_HEADER_PATTERN = /목록\.?$/; // "포함 모듈 목록.", "멤버 변수 목록." 같은 구획 머리말.
const MULTI_CHARACTER_PUNCTUATORS = [">>>=", "...", "===", "!==", "**=", "<<=", ">>=", ">>>", "&&=", "||=", "??=", "=>", "==", "!=", "<=", ">=", "&&", "||", "??", "?.", "++", "--", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "**", "<<", ">>"];
const REGEX_PRECEDING_KEYWORDS = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"]);
const SCREAMING_NAME_PATTERN = /^[A-Z0-9_]+$/; // 대문자 이름의 객체는 열거가 아니라 상수 표로 둔다. (TIMELINE_NODE_DEFAULTS 등)
const SHORT_VALUE_LENGTH = 60; // 시그니처에 값을 그대로 보일 상수의 글자 수 상한.
const EXAMPLE_NODE_TIMEOUT_MILLISECONDS = 8000; // node 워커로 예제 하나를 돌릴 시간 상한.
const EXAMPLE_NODE_SETTLE_MILLISECONDS = 100; // 예제 모듈이 다 돈 뒤 늦게 나는 오류를 기다리는 시간.
const EXAMPLE_NODE_CONCURRENCY = 4; // 겹쳐 돌릴 node 워커 수의 상한.
const EXAMPLE_CHROME_TIMEOUT_MILLISECONDS = 10000; // 크롬 iframe 에서 예제 하나가 끝날 시간 상한.
const EXAMPLE_CHROME_SETTLE_MILLISECONDS = 1000; // 크롬 예제 모듈이 다 돈 뒤 몇 프레임이 도는 동안 오류를 기다리는 시간.
const EXAMPLE_CHROME_CONCURRENCY = 4; // 크롬 한 페이지에서 겹쳐 돌릴 iframe 수.
const EXAMPLE_IMAGE_NAME_PATTERN = /^[a-z0-9._-]+\.(webp|png|jpg|gif)$/; // 예제와 가이드 그림 파일 이름. (사이트와 정한 꼴, docs/guide/<버전>/images/ 에 둔다)
const DRAFT_MODULE_NAME = "experimental"; // 초안 모듈 이름. (이 이름이거나 "이름/" 으로 시작하는 모듈은 자료에 넣지 않는다, 러스트 판과 같음)
const GUIDE_IMAGE_PATTERN = /!\[[^\]]*\]\(\.\.\/images\/([^)\s]+)\)/g; // 가이드 본문의 그림. (![설명](../images/<이름>))


//==============================================================================
// 전역 변수 목록.
//==============================================================================
const exampleImageWarningSet = new Set(); // 놓인 자리가 틀린 @exampleImage. (@example 바로 뒤가 아님, 뽑을 때 알린다)


//==============================================================================
// 초안 모듈인지. (experimental 이거나 experimental/ 로 시작, 두 엔진의 모듈 이름에 같이 쓴다)
//==============================================================================
/**
 * @param { string } moduleName
 * @returns { boolean }
 */
function isDraftModuleName(moduleName) {
	return moduleName === DRAFT_MODULE_NAME || String(moduleName).startsWith(DRAFT_MODULE_NAME + "/");
}

//==============================================================================
// 토큰 목록 만들기.
// - 토큰: { type, value, line, endLine }. type 은 lineComment, blockComment, string, template, regex, identifier, number, punctuator.
// - lineComment 의 value 는 // 뒤의 글, blockComment 는 /* */ 를 포함한 전체 글이다.
//==============================================================================
/**
 * @param { string } sourceText
 * @returns { object[] }
 */
function tokenize(sourceText) {
	const tokenList = [];
	const sourceLength = sourceText.length;
	let index = 0;
	let line = 1;
	let lastSignificantToken = null;

	// 범위 안의 줄바꿈 수.
	const countNewlines = (startIndex, endIndex) => {
		let newlineCount = 0;
		for (let characterIndex = startIndex; characterIndex < endIndex; ++characterIndex) {
			if (sourceText.charCodeAt(characterIndex) === 10) {
				++newlineCount;
			}
		}
		return newlineCount;
	};

	// 토큰 넣기.
	const pushToken = (type, startIndex, endIndex, value) => {
		const startLine = line;
		line += countNewlines(startIndex, endIndex);
		const token = { type: type, value: value, line: startLine, endLine: line };
		tokenList.push(token);
		if (type !== "lineComment" && type !== "blockComment") {
			lastSignificantToken = token;
		}
	};

	while (index < sourceLength) {
		const character = sourceText[index];
		const nextCharacter = sourceText[index + 1];
		if (character === "\n") {
			++line;
			++index;
			continue;
		}
		if (character === " " || character === "\t" || character === "\r" || character === "﻿" || character === " ") {
			++index;
			continue;
		}
		const startIndex = index;
		if (character === "/" && nextCharacter === "/") {
			let endIndex = sourceText.indexOf("\n", index);
			if (endIndex < 0) {
				endIndex = sourceLength;
			}
			pushToken("lineComment", startIndex, endIndex, sourceText.slice(startIndex + 2, endIndex));
			index = endIndex;
			continue;
		}
		if (character === "/" && nextCharacter === "*") {
			let endIndex = sourceText.indexOf("*/", index + 2);
			endIndex = endIndex < 0 ? sourceLength : endIndex + 2;
			pushToken("blockComment", startIndex, endIndex, sourceText.slice(startIndex, endIndex));
			index = endIndex;
			continue;
		}
		if (character === "\"" || character === "'") {
			const endIndex = skipString(sourceText, index);
			pushToken("string", startIndex, endIndex, sourceText.slice(startIndex, endIndex));
			index = endIndex;
			continue;
		}
		if (character === "`") {
			const endIndex = skipTemplate(sourceText, index);
			pushToken("template", startIndex, endIndex, sourceText.slice(startIndex, endIndex));
			index = endIndex;
			continue;
		}
		if (character === "/" && isRegexAllowed(lastSignificantToken)) {
			const endIndex = skipRegex(sourceText, index);
			pushToken("regex", startIndex, endIndex, sourceText.slice(startIndex, endIndex));
			index = endIndex;
			continue;
		}
		if (/[A-Za-z_$#\u0080-￿]/.test(character)) {
			let endIndex = index + 1;
			while (endIndex < sourceLength && /[A-Za-z0-9_$\u0080-￿]/.test(sourceText[endIndex])) {
				++endIndex;
			}
			pushToken("identifier", startIndex, endIndex, sourceText.slice(startIndex, endIndex));
			index = endIndex;
			continue;
		}
		if (/[0-9]/.test(character) || (character === "." && /[0-9]/.test(nextCharacter || ""))) {
			let endIndex = index + 1;
			while (endIndex < sourceLength) {
				const numberCharacter = sourceText[endIndex];
				if (/[0-9A-Za-z_.]/.test(numberCharacter)) {
					++endIndex;
				}
				else if ((numberCharacter === "+" || numberCharacter === "-") && /[eE]/.test(sourceText[endIndex - 1]) && !/^0[xX]/.test(sourceText.slice(startIndex, endIndex))) {
					++endIndex;
				}
				else {
					break;
				}
			}
			pushToken("number", startIndex, endIndex, sourceText.slice(startIndex, endIndex));
			index = endIndex;
			continue;
		}
		let punctuator = character;
		for (const candidate of MULTI_CHARACTER_PUNCTUATORS) {
			if (sourceText.startsWith(candidate, index)) {
				punctuator = candidate;
				break;
			}
		}
		pushToken("punctuator", startIndex, startIndex + punctuator.length, punctuator);
		index = startIndex + punctuator.length;
	}
	return tokenList;
}

//==============================================================================
// 따옴표 문자열 끝 자리.
//==============================================================================
/**
 * @param { string } sourceText
 * @param { number } startIndex
 * @returns { number }
 */
function skipString(sourceText, startIndex) {
	const quote = sourceText[startIndex];
	let index = startIndex + 1;
	while (index < sourceText.length) {
		const character = sourceText[index];
		if (character === "\\") {
			index += 2;
			continue;
		}
		if (character === quote || character === "\n") {
			return index + 1;
		}
		++index;
	}
	return index;
}

//==============================================================================
// 템플릿 문자열 끝 자리. (${ } 안의 문자열, 템플릿, 주석, 중괄호를 센다)
//==============================================================================
/**
 * @param { string } sourceText
 * @param { number } startIndex
 * @returns { number }
 */
function skipTemplate(sourceText, startIndex) {
	let index = startIndex + 1;
	while (index < sourceText.length) {
		const character = sourceText[index];
		if (character === "\\") {
			index += 2;
			continue;
		}
		if (character === "`") {
			return index + 1;
		}
		if (character === "$" && sourceText[index + 1] === "{") {
			index += 2;
			let depth = 1;
			while (index < sourceText.length && depth > 0) {
				const innerCharacter = sourceText[index];
				if (innerCharacter === "\"" || innerCharacter === "'") {
					index = skipString(sourceText, index);
				}
				else if (innerCharacter === "`") {
					index = skipTemplate(sourceText, index);
				}
				else if (innerCharacter === "/" && sourceText[index + 1] === "/") {
					const newlineIndex = sourceText.indexOf("\n", index);
					index = newlineIndex < 0 ? sourceText.length : newlineIndex;
				}
				else if (innerCharacter === "/" && sourceText[index + 1] === "*") {
					const closeIndex = sourceText.indexOf("*/", index + 2);
					index = closeIndex < 0 ? sourceText.length : closeIndex + 2;
				}
				else {
					if (innerCharacter === "{") {
						++depth;
					}
					else if (innerCharacter === "}") {
						--depth;
					}
					++index;
				}
			}
			continue;
		}
		++index;
	}
	return index;
}

//==============================================================================
// 정규식 끝 자리. (문자 묶음 [ ] 안의 / 는 끝이 아니다)
//==============================================================================
/**
 * @param { string } sourceText
 * @param { number } startIndex
 * @returns { number }
 */
function skipRegex(sourceText, startIndex) {
	let index = startIndex + 1;
	let isInClass = false;
	while (index < sourceText.length) {
		const character = sourceText[index];
		if (character === "\\") {
			index += 2;
			continue;
		}
		if (character === "\n") {
			return index;
		}
		if (isInClass) {
			if (character === "]") {
				isInClass = false;
			}
		}
		else if (character === "[") {
			isInClass = true;
		}
		else if (character === "/") {
			++index;
			while (index < sourceText.length && /[a-z]/.test(sourceText[index])) {
				++index;
			}
			return index;
		}
		++index;
	}
	return index;
}

//==============================================================================
// 앞 토큰을 보고 / 가 정규식의 시작일 수 있는지.
//==============================================================================
/**
 * @param { object | null } previousToken
 * @returns { boolean }
 */
function isRegexAllowed(previousToken) {
	if (!previousToken) {
		return true;
	}
	if (previousToken.type === "identifier") {
		return REGEX_PRECEDING_KEYWORDS.has(previousToken.value);
	}
	if (previousToken.type === "punctuator") {
		return previousToken.value !== ")" && previousToken.value !== "]" && previousToken.value !== "}";
	}
	return false;
}

//==============================================================================
// 주석 토큰인지.
//==============================================================================
/**
 * @param { object } token
 * @returns { boolean }
 */
function isComment(token) {
	return token.type === "lineComment" || token.type === "blockComment";
}

//==============================================================================
// 다음 주석 아닌 토큰의 번호. (없으면 토큰 수)
//==============================================================================
/**
 * @param { object[] } tokenList
 * @param { number } index
 * @returns { number }
 */
function nextSignificantIndex(tokenList, index) {
	let tokenIndex = index;
	while (tokenIndex < tokenList.length && isComment(tokenList[tokenIndex])) {
		++tokenIndex;
	}
	return tokenIndex;
}

//==============================================================================
// 여는 괄호에 짝이 되는 닫는 괄호의 번호.
//==============================================================================
/**
 * @param { object[] } tokenList
 * @param { number } openIndex
 * @returns { number }
 */
function findMatchingIndex(tokenList, openIndex) {
	let depth = 0;
	for (let tokenIndex = openIndex; tokenIndex < tokenList.length; ++tokenIndex) {
		const token = tokenList[tokenIndex];
		if (token.type !== "punctuator") {
			continue;
		}
		if (token.value === "{" || token.value === "(" || token.value === "[") {
			++depth;
		}
		else if (token.value === "}" || token.value === ")" || token.value === "]") {
			--depth;
			if (depth === 0) {
				return tokenIndex;
			}
		}
	}
	return tokenList.length - 1;
}

//==============================================================================
// 문장 끝 번호. (깊이 0 의 ; 이나, 줄을 바꿔 시작하는 다음 선언 앞)
//==============================================================================
/**
 * @param { object[] } tokenList
 * @param { number } startIndex
 * @param { number } limitIndex
 * @returns { number }
 */
function findStatementEndIndex(tokenList, startIndex, limitIndex) {
	let tokenIndex = startIndex;
	let previousToken = null;
	while (tokenIndex < limitIndex) {
		const token = tokenList[tokenIndex];
		if (isComment(token)) {
			++tokenIndex;
			continue;
		}
		if (token.type === "punctuator" && token.value === ";") {
			return tokenIndex;
		}
		if (token.type === "punctuator" && (token.value === "}" || token.value === ")" || token.value === "]")) {
			return tokenIndex - 1;
		}
		if (previousToken && token.line > previousToken.endLine && token.type === "identifier" && /^(export|const|let|var|function|class|import|static|async|get|set)$/.test(token.value)) {
			return tokenIndex - 1;
		}
		if (token.type === "punctuator" && (token.value === "{" || token.value === "(" || token.value === "[")) {
			previousToken = tokenList[findMatchingIndex(tokenList, tokenIndex)];
			tokenIndex = findMatchingIndex(tokenList, tokenIndex) + 1;
			continue;
		}
		previousToken = token;
		++tokenIndex;
	}
	return limitIndex - 1;
}

//==============================================================================
// 토큰 범위의 원문 글. (공백은 한 칸으로)
//==============================================================================
/**
 * @param { object[] } tokenList
 * @param { number } startIndex
 * @param { number } endIndex
 * @returns { string }
 */
function joinTokens(tokenList, startIndex, endIndex) {
	let text = "";
	let previousToken = null;
	let beforePreviousToken = null;
	for (let tokenIndex = startIndex; tokenIndex <= endIndex; ++tokenIndex) {
		const token = tokenList[tokenIndex];
		if (isComment(token)) {
			continue;
		}
		const isAfterUnary = previousToken !== null && previousToken.type === "punctuator" && ["-", "+", "!", "~"].includes(previousToken.value) && (beforePreviousToken === null || (beforePreviousToken.type === "punctuator" && ![")", "]", "}"].includes(beforePreviousToken.value)) || (beforePreviousToken.type === "identifier" && REGEX_PRECEDING_KEYWORDS.has(beforePreviousToken.value)));
		const isEmptyBraces = previousToken !== null && previousToken.value === "{" && token.value === "}";
		if (previousToken && !isAfterUnary && !isEmptyBraces && needsSpace(previousToken, token)) {
			text += " ";
		}
		text += token.value;
		beforePreviousToken = previousToken;
		previousToken = token;
	}
	return text.replace(/\s+/g, " ").trim();
}

//==============================================================================
// 두 토큰 사이에 빈칸을 둘지. (시그니처를 소스 꼴에 가깝게)
//==============================================================================
/**
 * @param { object } previousToken
 * @param { object } token
 * @returns { boolean }
 */
function needsSpace(previousToken, token) {
	const tightAfter = ["(", "[", ".", "...", "?.", "!", "#"];
	const tightBefore = [")", "]", ",", ".", "?.", ";", ":"];
	if (previousToken.type === "punctuator" && tightAfter.includes(previousToken.value)) {
		return false;
	}
	if (token.type === "punctuator" && tightBefore.includes(token.value)) {
		return false;
	}
	if (token.type === "punctuator" && (token.value === "(" || token.value === "[") && previousToken.type === "identifier") {
		return false;
	}
	return true;
}

//==============================================================================
// JSDoc 읽기.
// - { tags: [{ name, type, parameterName, text, rawText }], freeText }
// - rawText 는 태그 이름 뒤의 원문 그대로다. (@example 의 코드는 이것으로 읽는다)
//==============================================================================
/**
 * @param { string } commentText
 * @returns { object }
 */
function parseJsdoc(commentText) {
	const bodyLines = commentText.replace(/^\/\*\*?/, "").replace(/\*\/$/, "").split("\n").map((rawLine) => rawLine.replace(/^\s*\*? ?/, "").replace(/\s+$/, ""));
	const body = bodyLines.join("\n");
	const tagList = [];
	const freeLines = [];
	let currentTag = null;
	let braceDepth = 0;
	let segmentText = "";

	// 모은 조각을 지금 태그나 자유 글에 넣기.
	const flushSegment = () => {
		if (currentTag) {
			currentTag.rawText += segmentText;
		}
		else {
			freeLines.push(segmentText);
		}
		segmentText = "";
	};

	for (let index = 0; index < body.length; ++index) {
		const character = body[index];
		if (character === "{") {
			++braceDepth;
		}
		else if (character === "}") {
			braceDepth = Math.max(0, braceDepth - 1);
		}
		const isTagStart = character === "@" && braceDepth === 0 && (index === 0 || /\s/.test(body[index - 1])) && /[A-Za-z]/.test(body[index + 1] || "");
		if (isTagStart) {
			flushSegment();
			const nameMatch = /^@([A-Za-z]+)/.exec(body.slice(index));
			currentTag = { name: nameMatch[1], rawText: "" };
			tagList.push(currentTag);
			index += nameMatch[0].length - 1;
			continue;
		}
		segmentText += character;
	}
	flushSegment();

	const tags = tagList.map((tag) => {
		let restText = tag.rawText.trim();
		let type = "";
		if (restText.startsWith("{")) {
			let depth = 0;
			let closeIndex = 0;
			while (closeIndex < restText.length) {
				if (restText[closeIndex] === "{") {
					++depth;
				}
				else if (restText[closeIndex] === "}") {
					--depth;
					if (depth === 0) {
						break;
					}
				}
				++closeIndex;
			}
			type = restText.slice(1, closeIndex).replace(/\s+/g, " ").trim();
			restText = restText.slice(closeIndex + 1).trim();
		}
		let parameterName = "";
		if (tag.name === "param" || tag.name === "arg" || tag.name === "argument") {
			const nameMatch = /^(\[[^\]]*\]|[^\s]+)/.exec(restText);
			if (nameMatch) {
				parameterName = nameMatch[1].replace(/^\[/, "").replace(/\]$/, "").replace(/=.*$/, "").trim();
				restText = restText.slice(nameMatch[0].length).trim();
			}
		}
		restText = restText.replace(/^-\s+/, "").trim(); // "이름 - 설명" 꼴의 하이픈만 뗀다. ("-1 이면" 처럼 붙은 음수는 그대로)
		return { name: tag.name, type: type, parameterName: parameterName, text: restText, rawText: tag.rawText };
	});
	const freeText = freeLines.join("").split("\n").map((freeLine) => freeLine.replace(/\s+$/, "")).join("\n").trim();
	return { tags: tags, freeText: freeText };
}

//==============================================================================
// 선언 앞의 주석 모으기.
// - 빈 줄을 만나거나, 앞 코드 줄 끝에 붙은 주석을 만나면 멈춘다.
// - { description, jsdoc, jsdocTokenIndex, headerTokenIndex, orphanHeaderList }
//==============================================================================
/**
 * @param { object[] } tokenList
 * @param { number } declarationIndex
 * @returns { object }
 */
function collectLeadingDocument(tokenList, declarationIndex) {
	const commentIndexList = [];
	let nextLine = tokenList[declarationIndex].line;
	for (let tokenIndex = declarationIndex - 1; tokenIndex >= 0; --tokenIndex) {
		const token = tokenList[tokenIndex];
		if (!isComment(token)) {
			break;
		}
		if (token.endLine < nextLine - 1) {
			break;
		}
		const previousToken = tokenList[tokenIndex - 1];
		if (previousToken && !isComment(previousToken) && previousToken.endLine === token.line) {
			break;
		}
		commentIndexList.unshift(tokenIndex);
		nextLine = token.line;
	}
	return readCommentGroup(tokenList, commentIndexList);
}

//==============================================================================
// 주석 묶음 풀기.
// - //==== 로 감싼 머리말은 마지막 것이 선언의 설명이다. (구획 머리말은 빼고, 그 뒤의 // 줄은 덧붙인다)
//==============================================================================
/**
 * @param { object[] } tokenList
 * @param { number[] } commentIndexList
 * @returns { object }
 */
function readCommentGroup(tokenList, commentIndexList) {
	let isInHeader = false;
	let headerLines = [];
	let headerStartIndex = -1;
	let lastHeader = null;
	let looseLines = [];
	let jsdoc = null;
	let jsdocTokenIndex = -1;
	const orphanHeaderList = [];
	for (const tokenIndex of commentIndexList) {
		const token = tokenList[tokenIndex];
		if (token.type === "blockComment") {
			if (token.value.startsWith("/**")) {
				jsdoc = parseJsdoc(token.value);
				jsdocTokenIndex = tokenIndex;
			}
			continue;
		}
		const lineText = token.value.replace(/^ /, "").replace(/\s+$/, "");
		if (/^=+$/.test(lineText.trim())) {
			if (isInHeader) {
				isInHeader = false;
				if (lastHeader) {
					orphanHeaderList.push(lastHeader);
				}
				lastHeader = { lines: trimEmptyLines(headerLines), tokenIndex: headerStartIndex };
				looseLines = [];
			}
			else {
				isInHeader = true;
				headerLines = [];
				headerStartIndex = tokenIndex;
			}
			continue;
		}
		if (isInHeader) {
			headerLines.push(lineText);
		}
		else {
			looseLines.push(lineText);
		}
	}
	let descriptionLines = [];
	let headerTokenIndex = -1;
	if (lastHeader && !isSectionHeader(lastHeader.lines)) {
		descriptionLines = lastHeader.lines.slice();
		headerTokenIndex = lastHeader.tokenIndex;
	}
	else if (lastHeader) {
		orphanHeaderList.push(lastHeader);
	}
	descriptionLines = descriptionLines.concat(looseLines);
	let description = trimEmptyLines(descriptionLines).join("\n");
	if (description === "" && jsdoc && jsdoc.freeText !== "") {
		description = jsdoc.freeText;
	}
	return { description: description, jsdoc: jsdoc, jsdocTokenIndex: jsdocTokenIndex, headerTokenIndex: headerTokenIndex, orphanHeaderList: orphanHeaderList };
}

//==============================================================================
// 앞뒤의 빈 줄 빼기.
//==============================================================================
/**
 * @param { string[] } lineList
 * @returns { string[] }
 */
function trimEmptyLines(lineList) {
	let startIndex = 0;
	let endIndex = lineList.length;
	while (startIndex < endIndex && lineList[startIndex].trim() === "") {
		++startIndex;
	}
	while (endIndex > startIndex && lineList[endIndex - 1].trim() === "") {
		--endIndex;
	}
	return lineList.slice(startIndex, endIndex);
}

//==============================================================================
// 구획 머리말인지. ("포함 모듈 목록." 처럼 한 줄이고 "목록" 으로 끝남)
//==============================================================================
/**
 * @param { string[] } headerLines
 * @returns { boolean }
 */
function isSectionHeader(headerLines) {
	return headerLines.length === 1 && SECTION_HEADER_PATTERN.test(headerLines[0].trim());
}

//==============================================================================
// 선언 끝에 같은 줄로 붙은 주석. (없으면 "")
//==============================================================================
/**
 * @param { object[] } tokenList
 * @param { number } endIndex
 * @returns { string }
 */
function readTrailingComment(tokenList, endIndex) {
	const endToken = tokenList[endIndex];
	const nextToken = tokenList[endIndex + 1];
	if (endToken && nextToken && nextToken.type === "lineComment" && nextToken.line === endToken.endLine) {
		return nextToken.value.trim();
	}
	return "";
}

//==============================================================================
// 매개변수 목록 읽기. (괄호 안 토큰 → [{ name, text }])
//==============================================================================
/**
 * @param { object[] } tokenList
 * @param { number } openIndex
 * @param { number } closeIndex
 * @returns { object[] }
 */
function readParameterList(tokenList, openIndex, closeIndex) {
	const parameterList = [];
	let segmentStartIndex = openIndex + 1;
	let tokenIndex = openIndex + 1;
	const pushSegment = (segmentEndIndex) => {
		const startIndex = nextSignificantIndex(tokenList, segmentStartIndex);
		if (startIndex > segmentEndIndex) {
			return;
		}
		const text = joinTokens(tokenList, startIndex, segmentEndIndex);
		if (text === "") {
			return;
		}
		let name = text;
		const firstToken = tokenList[startIndex];
		if (firstToken.type === "identifier") {
			name = firstToken.value;
		}
		else if (firstToken.value === "...") {
			name = "..." + tokenList[nextSignificantIndex(tokenList, startIndex + 1)].value;
		}
		else {
			const equalIndex = text.indexOf("=");
			name = equalIndex > 0 && !text.startsWith("{") && !text.startsWith("[") ? text.slice(0, equalIndex).trim() : text.replace(/\s*=\s*[^=].*$/, "");
		}
		parameterList.push({ name: name, text: text });
	};
	while (tokenIndex < closeIndex) {
		const token = tokenList[tokenIndex];
		if (token.type === "punctuator" && (token.value === "{" || token.value === "(" || token.value === "[")) {
			tokenIndex = findMatchingIndex(tokenList, tokenIndex) + 1;
			continue;
		}
		if (token.type === "punctuator" && token.value === ",") {
			pushSegment(tokenIndex - 1);
			segmentStartIndex = tokenIndex + 1;
		}
		++tokenIndex;
	}
	pushSegment(closeIndex - 1);
	return parameterList;
}

//==============================================================================
// 리터럴 토큰의 값. (문자열, 수, 참거짓, null, 음수, 그 밖은 undefined)
//==============================================================================
/**
 * @param { object[] } valueTokenList
 * @returns { any }
 */
function readLiteralValue(valueTokenList) {
	if (valueTokenList.length === 1) {
		const token = valueTokenList[0];
		if (token.type === "string") {
			return readStringLiteral(token.value);
		}
		if (token.type === "template" && !token.value.includes("${")) {
			return token.value.slice(1, -1);
		}
		if (token.type === "number") {
			return readNumberLiteral(token.value);
		}
		if (token.type === "identifier" && (token.value === "true" || token.value === "false")) {
			return token.value === "true";
		}
		if (token.type === "identifier" && token.value === "null") {
			return null;
		}
	}
	if (valueTokenList.length === 2 && valueTokenList[0].value === "-" && valueTokenList[1].type === "number") {
		return -readNumberLiteral(valueTokenList[1].value);
	}
	return undefined;
}

//==============================================================================
// 문자열 리터럴 풀기.
//==============================================================================
/**
 * @param { string } literalText
 * @returns { string }
 */
function readStringLiteral(literalText) {
	const innerText = literalText.slice(1, -1);
	return innerText.replace(/\\(u\{[0-9A-Fa-f]+\}|u[0-9A-Fa-f]{4}|x[0-9A-Fa-f]{2}|.)/g, (match, escapeText) => {
		if (escapeText.startsWith("u{")) {
			return String.fromCodePoint(Number.parseInt(escapeText.slice(2, -1), 16));
		}
		if (escapeText.length > 1 && (escapeText[0] === "u" || escapeText[0] === "x")) {
			return String.fromCharCode(Number.parseInt(escapeText.slice(1), 16));
		}
		const escapeTable = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", v: "\v", "0": "\0" };
		return escapeTable[escapeText] !== undefined ? escapeTable[escapeText] : escapeText;
	});
}

//==============================================================================
// 수 리터럴 풀기.
//==============================================================================
/**
 * @param { string } literalText
 * @returns { number }
 */
function readNumberLiteral(literalText) {
	const plainText = literalText.replace(/_/g, "").replace(/n$/, "");
	if (/^0[bB]/.test(plainText)) {
		return Number.parseInt(plainText.slice(2), 2);
	}
	if (/^0[oO]/.test(plainText)) {
		return Number.parseInt(plainText.slice(2), 8);
	}
	return Number(plainText);
}

//==============================================================================
// 소스 파일 하나 읽기.
// - { fileSummary, fileExampleList, declarationList, reexportList }
// - declaration: { kind: "class" | "function" | "variable", name, isExported, ... }
//==============================================================================
/**
 * @param { string } sourceText
 * @returns { object }
 */
function parseSourceFile(sourceText) {
	const tokenList = tokenize(sourceText);
	const declarationList = [];
	const exportNameList = [];
	const reexportList = [];
	const usedHeaderIndexSet = new Set();
	const usedJsdocIndexSet = new Set(); // 선언이 가져간 JSDoc 토큰 번호. (남은 깊이 0 의 JSDoc 이 파일의 예제다)
	const staticAssignmentList = []; // 클래스 밖에서 붙인 정적 속성. (ClassName.name = 값;)
	let firstDeclarationLine = Infinity;
	let tokenIndex = 0;
	while (tokenIndex < tokenList.length) {
		const token = tokenList[tokenIndex];
		if (isComment(token)) {
			++tokenIndex;
			continue;
		}
		const startIndex = tokenIndex;
		let isExported = false;
		let cursorIndex = tokenIndex;
		if (token.type === "identifier" && token.value === "export") {
			isExported = true;
			cursorIndex = nextSignificantIndex(tokenList, tokenIndex + 1);
			const nextToken = tokenList[cursorIndex];
			if (nextToken && nextToken.value === "{") {
				const closeIndex = findMatchingIndex(tokenList, cursorIndex);
				const specifierText = joinTokens(tokenList, cursorIndex + 1, closeIndex - 1);
				const specifierList = specifierText.split(",").map((specifier) => specifier.trim()).filter((specifier) => specifier !== "").map((specifier) => {
					const parts = specifier.split(/\s+as\s+/);
					return { localName: parts[0].trim(), exportName: (parts[1] || parts[0]).trim() };
				});
				const fromIndex = nextSignificantIndex(tokenList, closeIndex + 1);
				if (tokenList[fromIndex] && tokenList[fromIndex].value === "from") {
					const pathToken = tokenList[nextSignificantIndex(tokenList, fromIndex + 1)];
					reexportList.push({ specifierList: specifierList, modulePath: readStringLiteral(pathToken.value), isNamespace: false });
				}
				else {
					for (const specifier of specifierList) {
						exportNameList.push(specifier);
					}
				}
				tokenIndex = findStatementEndIndex(tokenList, closeIndex + 1, tokenList.length) + 1;
				continue;
			}
			if (nextToken && nextToken.value === "*") {
				const endIndex = findStatementEndIndex(tokenList, cursorIndex, tokenList.length);
				const statementText = joinTokens(tokenList, cursorIndex, endIndex);
				const namespaceMatch = /^\*\s*(?:as\s+([A-Za-z_$][\w$]*)\s+)?from\s+(["'].*["'])/.exec(statementText);
				if (namespaceMatch) {
					reexportList.push({ specifierList: [{ localName: "*", exportName: namespaceMatch[1] || "*" }], modulePath: readStringLiteral(namespaceMatch[2]), isNamespace: true });
				}
				tokenIndex = endIndex + 1;
				continue;
			}
			if (nextToken && nextToken.value === "default") {
				cursorIndex = nextSignificantIndex(tokenList, cursorIndex + 1);
			}
		}
		const keywordToken = tokenList[cursorIndex];
		if (!keywordToken) {
			break;
		}
		if (keywordToken.value === "class") {
			const declaration = parseClassDeclaration(tokenList, startIndex, cursorIndex);
			declaration.isExported = isExported;
			declarationList.push(declaration);
			firstDeclarationLine = Math.min(firstDeclarationLine, tokenList[startIndex].line);
			markUsedHeader(declaration.document, usedHeaderIndexSet);
			usedJsdocIndexSet.add(declaration.document.jsdocTokenIndex);
			tokenIndex = declaration.endIndex + 1;
			continue;
		}
		if (keywordToken.value === "function" || (keywordToken.value === "async" && tokenList[nextSignificantIndex(tokenList, cursorIndex + 1)].value === "function")) {
			const declaration = parseFunctionDeclaration(tokenList, startIndex, cursorIndex);
			declaration.isExported = isExported;
			declarationList.push(declaration);
			firstDeclarationLine = Math.min(firstDeclarationLine, tokenList[startIndex].line);
			markUsedHeader(declaration.document, usedHeaderIndexSet);
			usedJsdocIndexSet.add(declaration.document.jsdocTokenIndex);
			tokenIndex = declaration.endIndex + 1;
			continue;
		}
		if (keywordToken.value === "const" || keywordToken.value === "let" || keywordToken.value === "var") {
			const declaration = parseVariableDeclaration(tokenList, startIndex, cursorIndex);
			declaration.isExported = isExported;
			declarationList.push(declaration);
			usedJsdocIndexSet.add(declaration.document.jsdocTokenIndex);
			if (isExported) {
				firstDeclarationLine = Math.min(firstDeclarationLine, tokenList[startIndex].line);
				markUsedHeader(declaration.document, usedHeaderIndexSet);
			}
			tokenIndex = declaration.endIndex + 1;
			continue;
		}
		const dotToken = tokenList[nextSignificantIndex(tokenList, cursorIndex + 1)];
		if (!isExported && keywordToken.type === "identifier" && dotToken && dotToken.value === ".") {
			const memberNameIndex = nextSignificantIndex(tokenList, tokenList.indexOf(dotToken, cursorIndex) + 1);
			const assignIndex = nextSignificantIndex(tokenList, memberNameIndex + 1);
			if (tokenList[memberNameIndex] && tokenList[memberNameIndex].type === "identifier" && tokenList[assignIndex] && tokenList[assignIndex].value === "=") {
				const endIndex = findStatementEndIndex(tokenList, assignIndex + 1, tokenList.length);
				const valueStartIndex = nextSignificantIndex(tokenList, assignIndex + 1);
				const valueEndIndex = tokenList[endIndex].value === ";" ? endIndex - 1 : endIndex;
				const valueTokenList = [];
				for (let valueIndex = valueStartIndex; valueIndex <= valueEndIndex; ++valueIndex) {
					if (!isComment(tokenList[valueIndex])) {
						valueTokenList.push(tokenList[valueIndex]);
					}
				}
				const staticDocument = collectLeadingDocument(tokenList, startIndex);
				usedJsdocIndexSet.add(staticDocument.jsdocTokenIndex);
				staticAssignmentList.push({
					className: keywordToken.value,
					member: {
						name: tokenList[memberNameIndex].value,
						isStatic: true,
						isAsync: false,
						isGenerator: false,
						accessor: "",
						isMethod: false,
						parameterList: [],
						valueText: joinTokens(tokenList, valueStartIndex, valueEndIndex),
						literalValue: readLiteralValue(valueTokenList),
						document: staticDocument,
						trailingComment: readTrailingComment(tokenList, endIndex),
						assignedNameList: [],
						returnsValue: false,
						line: tokenList[startIndex].line,
					},
				});
				tokenIndex = endIndex + 1;
				continue;
			}
		}
		if (keywordToken.value === "import") {
			tokenIndex = findStatementEndIndex(tokenList, cursorIndex + 1, tokenList.length) + 1;
			continue;
		}
		if (keywordToken.type === "punctuator" && (keywordToken.value === "{" || keywordToken.value === "(" || keywordToken.value === "[")) {
			tokenIndex = findMatchingIndex(tokenList, cursorIndex) + 1;
			continue;
		}
		tokenIndex = cursorIndex + 1;
	}

	// 깊이 0 의 머리말 모으기. ({ lines, line, tokenIndex })
	// - 어느 선언도 가져가지 않은 깊이 0 의 JSDoc 에 든 @example 은 파일(모듈)의 예제다.
	const headerBlockList = [];
	const fileExampleList = [];
	let isInHeader = false;
	let headerLines = [];
	let headerStartIndex = -1;
	let depth = 0;
	for (let commentIndex = 0; commentIndex < tokenList.length; ++commentIndex) {
		const token = tokenList[commentIndex];
		if (token.type === "punctuator") {
			if (token.value === "{" || token.value === "(" || token.value === "[") {
				++depth;
			}
			else if (token.value === "}" || token.value === ")" || token.value === "]") {
				--depth;
			}
			continue;
		}
		if (token.type === "blockComment" && depth === 0 && token.value.startsWith("/**") && !usedJsdocIndexSet.has(commentIndex)) {
			for (const example of readExamples({ jsdoc: parseJsdoc(token.value) })) {
				fileExampleList.push(example);
			}
			continue;
		}
		if (token.type !== "lineComment" || depth !== 0) {
			continue;
		}
		const lineText = token.value.replace(/^ /, "").replace(/\s+$/, "");
		if (/^=+$/.test(lineText.trim())) {
			if (isInHeader) {
				isInHeader = false;
				const lines = trimEmptyLines(headerLines);
				if (lines.length > 0 && !isSectionHeader(lines)) {
					headerBlockList.push({ lines: lines, line: tokenList[headerStartIndex].line, tokenIndex: headerStartIndex });
				}
			}
			else {
				isInHeader = true;
				headerLines = [];
				headerStartIndex = commentIndex;
			}
			continue;
		}
		if (isInHeader) {
			headerLines.push(lineText);
		}
	}

	// 파일 머리 설명: 첫 선언 앞에 있고 어느 선언에도 쓰이지 않은 머리말 가운데 첫 것.
	const fileHeader = headerBlockList.find((headerBlock) => headerBlock.line < firstDeclarationLine && !usedHeaderIndexSet.has(headerBlock.tokenIndex));
	const fileSummary = fileHeader ? fileHeader.lines.join("\n") : "";

	// 머리말이 붙지 않은 클래스: 앞 클래스나 함수의 끝과 이 클래스 사이에 떨어져 있는 머리말 가운데 마지막 것. (사이에 상수가 끼어 있는 꼴)
	for (const declaration of declarationList) {
		if (declaration.kind !== "class" || declaration.document.description !== "") {
			continue;
		}
		let previousEndLine = 0;
		for (const otherDeclaration of declarationList) {
			if (otherDeclaration !== declaration && otherDeclaration.kind !== "variable" && otherDeclaration.endLine < declaration.line) {
				previousEndLine = Math.max(previousEndLine, otherDeclaration.endLine);
			}
		}
		const candidateList = headerBlockList.filter((headerBlock) => headerBlock.line > previousEndLine && headerBlock.line < declaration.line);
		if (candidateList.length > 0) {
			declaration.document.description = candidateList[candidateList.length - 1].lines.join("\n");
		}
	}

	for (const staticAssignment of staticAssignmentList) {
		const classDeclaration = declarationList.find((candidate) => candidate.kind === "class" && candidate.name === staticAssignment.className);
		if (classDeclaration) {
			classDeclaration.memberList.push(staticAssignment.member);
		}
	}
	for (const specifier of exportNameList) {
		const declaration = declarationList.find((candidate) => candidate.name === specifier.localName);
		if (declaration) {
			declaration.isExported = true;
			declaration.exportName = specifier.exportName;
		}
	}
	return { fileSummary: fileSummary, fileExampleList: fileExampleList, declarationList: declarationList, reexportList: reexportList };
}

//==============================================================================
// 선언이 쓴 머리말 표시.
//==============================================================================
/**
 * @param { object } document
 * @param { Set<number> } usedHeaderIndexSet
 */
function markUsedHeader(document, usedHeaderIndexSet) {
	if (document.headerTokenIndex >= 0) {
		usedHeaderIndexSet.add(document.headerTokenIndex);
	}
}

//==============================================================================
// 함수 선언 읽기.
//==============================================================================
/**
 * @param { object[] } tokenList
 * @param { number } startIndex
 * @param { number } keywordIndex
 * @returns { object }
 */
function parseFunctionDeclaration(tokenList, startIndex, keywordIndex) {
	let cursorIndex = keywordIndex;
	let isAsync = false;
	if (tokenList[cursorIndex].value === "async") {
		isAsync = true;
		cursorIndex = nextSignificantIndex(tokenList, cursorIndex + 1);
	}
	cursorIndex = nextSignificantIndex(tokenList, cursorIndex + 1);
	let isGenerator = false;
	if (tokenList[cursorIndex].value === "*") {
		isGenerator = true;
		cursorIndex = nextSignificantIndex(tokenList, cursorIndex + 1);
	}
	const name = tokenList[cursorIndex].value;
	const openIndex = nextSignificantIndex(tokenList, cursorIndex + 1);
	const closeIndex = findMatchingIndex(tokenList, openIndex);
	const bodyIndex = nextSignificantIndex(tokenList, closeIndex + 1);
	const endIndex = findMatchingIndex(tokenList, bodyIndex);
	return {
		kind: "function",
		name: name,
		isAsync: isAsync,
		isGenerator: isGenerator,
		parameterList: readParameterList(tokenList, openIndex, closeIndex),
		document: collectLeadingDocument(tokenList, startIndex),
		returnsValue: !isGenerator && hasValueReturn(tokenList, bodyIndex, endIndex),
		line: tokenList[startIndex].line,
		endLine: tokenList[endIndex].endLine,
		endIndex: endIndex,
	};
}

//==============================================================================
// 함수 몸에 값을 돌려주는 return 이 있는지. (안에 든 함수와 화살표 함수의 몸은 빼고 본다)
//==============================================================================
/**
 * @param { object[] } tokenList
 * @param { number } bodyOpenIndex
 * @param { number } bodyCloseIndex
 * @returns { boolean }
 */
function hasValueReturn(tokenList, bodyOpenIndex, bodyCloseIndex) {
	let tokenIndex = bodyOpenIndex + 1;
	while (tokenIndex < bodyCloseIndex) {
		const token = tokenList[tokenIndex];
		if (isComment(token)) {
			++tokenIndex;
			continue;
		}
		if (token.type === "identifier" && (token.value === "function" || token.value === "class")) {
			let searchIndex = tokenIndex + 1;
			while (searchIndex < bodyCloseIndex && tokenList[searchIndex].value !== "{") {
				if (tokenList[searchIndex].value === "(") {
					searchIndex = findMatchingIndex(tokenList, searchIndex);
				}
				++searchIndex;
			}
			tokenIndex = searchIndex < bodyCloseIndex ? findMatchingIndex(tokenList, searchIndex) + 1 : searchIndex;
			continue;
		}
		if (token.type === "punctuator" && token.value === "=>") {
			const arrowBodyIndex = nextSignificantIndex(tokenList, tokenIndex + 1);
			if (tokenList[arrowBodyIndex] && tokenList[arrowBodyIndex].value === "{") {
				tokenIndex = findMatchingIndex(tokenList, arrowBodyIndex) + 1;
				continue;
			}
		}
		if (token.type === "identifier" && token.value === "return") {
			const valueToken = tokenList[nextSignificantIndex(tokenList, tokenIndex + 1)];
			if (valueToken && valueToken.value !== ";" && valueToken.value !== "}" && valueToken.line === token.endLine) {
				return true;
			}
		}
		++tokenIndex;
	}
	return false;
}

//==============================================================================
// 변수 선언 읽기. (const NAME = 값; 값이 객체 리터럴이면 항목도 읽는다)
//==============================================================================
/**
 * @param { object[] } tokenList
 * @param { number } startIndex
 * @param { number } keywordIndex
 * @returns { object }
 */
function parseVariableDeclaration(tokenList, startIndex, keywordIndex) {
	const nameIndex = nextSignificantIndex(tokenList, keywordIndex + 1);
	const name = tokenList[nameIndex].value;
	const equalIndex = nextSignificantIndex(tokenList, nameIndex + 1);
	let endIndex = findStatementEndIndex(tokenList, nameIndex + 1, tokenList.length);
	let valueStartIndex = -1;
	let valueEndIndex = -1;
	if (tokenList[equalIndex] && tokenList[equalIndex].value === "=") {
		valueStartIndex = nextSignificantIndex(tokenList, equalIndex + 1);
		valueEndIndex = tokenList[endIndex].value === ";" ? endIndex - 1 : endIndex;
		while (valueEndIndex > valueStartIndex && isComment(tokenList[valueEndIndex])) {
			--valueEndIndex;
		}
	}
	const valueTokenList = [];
	for (let tokenIndex = valueStartIndex; valueStartIndex >= 0 && tokenIndex <= valueEndIndex; ++tokenIndex) {
		if (!isComment(tokenList[tokenIndex])) {
			valueTokenList.push(tokenList[tokenIndex]);
		}
	}
	const valueText = valueStartIndex >= 0 ? joinTokens(tokenList, valueStartIndex, valueEndIndex) : "";

	// 객체 리터럴. ({ ... } 또는 Object.freeze({ ... }))
	let objectOpenIndex = -1;
	if (valueTokenList.length > 0 && valueTokenList[0].value === "{") {
		objectOpenIndex = valueStartIndex;
	}
	else if (/^(System\.)?Object\.freeze\(\{/.test(valueText)) {
		objectOpenIndex = tokenList.indexOf(valueTokenList.find((token) => token.value === "{"), valueStartIndex);
	}
	let entryList = null;
	if (objectOpenIndex >= 0) {
		entryList = parseObjectEntries(tokenList, objectOpenIndex, findMatchingIndex(tokenList, objectOpenIndex));
	}
	const trailingIndex = tokenList[endIndex].value === ";" ? endIndex : valueEndIndex;
	return {
		kind: "variable",
		name: name,
		valueText: valueText,
		literalValue: readLiteralValue(valueTokenList),
		entryList: entryList,
		document: collectLeadingDocument(tokenList, startIndex),
		trailingComment: readTrailingComment(tokenList, trailingIndex),
		line: tokenList[startIndex].line,
		endLine: tokenList[endIndex].endLine,
		endIndex: endIndex,
	};
}

//==============================================================================
// 객체 리터럴 항목 읽기. ([{ name, literalValue, description }], 값이 리터럴이 아니면 식의 원문 글, 키: 값 아닌 꼴이 있으면 null)
//==============================================================================
/**
 * @param { object[] } tokenList
 * @param { number } openIndex
 * @param { number } closeIndex
 * @returns { object[] | null }
 */
function parseObjectEntries(tokenList, openIndex, closeIndex) {
	const entryList = [];
	let tokenIndex = nextSignificantIndex(tokenList, openIndex + 1);
	while (tokenIndex < closeIndex) {
		const keyToken = tokenList[tokenIndex];
		if (keyToken.type === "punctuator" && keyToken.value === ",") {
			tokenIndex = nextSignificantIndex(tokenList, tokenIndex + 1);
			continue;
		}
		if (keyToken.type !== "identifier" && keyToken.type !== "string" && keyToken.type !== "number") {
			return null;
		}
		const colonIndex = nextSignificantIndex(tokenList, tokenIndex + 1);
		if (!tokenList[colonIndex] || tokenList[colonIndex].value !== ":") {
			return null;
		}
		const valueStartIndex = nextSignificantIndex(tokenList, colonIndex + 1);
		let valueEndIndex = valueStartIndex;
		let scanIndex = valueStartIndex;
		while (scanIndex < closeIndex) {
			const token = tokenList[scanIndex];
			if (token.type === "punctuator" && token.value === ",") {
				break;
			}
			if (token.type === "punctuator" && (token.value === "{" || token.value === "(" || token.value === "[")) {
				scanIndex = findMatchingIndex(tokenList, scanIndex);
			}
			if (!isComment(tokenList[scanIndex])) {
				valueEndIndex = scanIndex;
			}
			++scanIndex;
		}
		const valueTokenList = [];
		for (let valueIndex = valueStartIndex; valueIndex <= valueEndIndex; ++valueIndex) {
			if (!isComment(tokenList[valueIndex])) {
				valueTokenList.push(tokenList[valueIndex]);
			}
		}
		let literalValue = readLiteralValue(valueTokenList);
		if (literalValue === undefined) {
			literalValue = joinTokens(tokenList, valueStartIndex, valueEndIndex);
		}
		const leadingDocument = collectLeadingDocument(tokenList, tokenIndex);
		const separatorIndex = scanIndex < closeIndex ? scanIndex : valueEndIndex;
		let description = leadingDocument.description;
		if (description === "") {
			description = readTrailingComment(tokenList, separatorIndex) || readTrailingComment(tokenList, valueEndIndex);
		}
		let typeText = "";
		if (leadingDocument.jsdoc) {
			const typeTag = leadingDocument.jsdoc.tags.find((tag) => tag.name === "type");
			typeText = typeTag ? typeTag.type : "";
		}
		entryList.push({ name: keyToken.type === "string" ? readStringLiteral(keyToken.value) : keyToken.value, literalValue: literalValue, description: description, type: typeText });
		tokenIndex = nextSignificantIndex(tokenList, scanIndex + 1);
	}
	return entryList;
}

//==============================================================================
// 클래스 선언 읽기.
//==============================================================================
/**
 * @param { object[] } tokenList
 * @param { number } startIndex
 * @param { number } keywordIndex
 * @returns { object }
 */
function parseClassDeclaration(tokenList, startIndex, keywordIndex) {
	let cursorIndex = nextSignificantIndex(tokenList, keywordIndex + 1);
	let name = "";
	if (tokenList[cursorIndex].type === "identifier" && tokenList[cursorIndex].value !== "extends") {
		name = tokenList[cursorIndex].value;
		cursorIndex = nextSignificantIndex(tokenList, cursorIndex + 1);
	}
	let extendsText = "";
	if (tokenList[cursorIndex].value === "extends") {
		const extendsStartIndex = nextSignificantIndex(tokenList, cursorIndex + 1);
		let bodySearchIndex = extendsStartIndex;
		while (bodySearchIndex < tokenList.length && tokenList[bodySearchIndex].value !== "{") {
			if (tokenList[bodySearchIndex].value === "(") {
				bodySearchIndex = findMatchingIndex(tokenList, bodySearchIndex);
			}
			++bodySearchIndex;
		}
		extendsText = joinTokens(tokenList, extendsStartIndex, bodySearchIndex - 1);
		cursorIndex = bodySearchIndex;
	}
	const bodyOpenIndex = cursorIndex;
	const bodyCloseIndex = findMatchingIndex(tokenList, bodyOpenIndex);
	return {
		kind: "class",
		name: name,
		extendsText: extendsText,
		memberList: parseClassMembers(tokenList, bodyOpenIndex, bodyCloseIndex),
		document: collectLeadingDocument(tokenList, startIndex),
		line: tokenList[startIndex].line,
		endLine: tokenList[bodyCloseIndex].endLine,
		endIndex: bodyCloseIndex,
	};
}

//==============================================================================
// 클래스 몸의 멤버 읽기.
// - member: { name, isStatic, isAsync, isGenerator, accessor: "get" | "set" | "", isMethod, parameterList, valueText, document, trailingComment, assignedNameList, returnsValue, line }
//==============================================================================
/**
 * @param { object[] } tokenList
 * @param { number } openIndex
 * @param { number } closeIndex
 * @returns { object[] }
 */
function parseClassMembers(tokenList, openIndex, closeIndex) {
	const memberList = [];
	let tokenIndex = nextSignificantIndex(tokenList, openIndex + 1);
	while (tokenIndex < closeIndex) {
		const startToken = tokenList[tokenIndex];
		if (startToken.type === "punctuator" && startToken.value === ";") {
			tokenIndex = nextSignificantIndex(tokenList, tokenIndex + 1);
			continue;
		}
		const startIndex = tokenIndex;
		let cursorIndex = tokenIndex;
		let isStatic = false;
		let isAsync = false;
		let isGenerator = false;
		let accessor = "";

		// 이름 뒤에 오는 것이 이름이면 앞 낱말은 꾸밈말이다.
		const isModifier = (index) => {
			const followIndex = nextSignificantIndex(tokenList, index + 1);
			const followToken = tokenList[followIndex];
			if (!followToken) {
				return false;
			}
			if (followToken.type === "punctuator") {
				return followToken.value === "*" || followToken.value === "[" || followToken.value === "{";
			}
			return followToken.line === tokenList[index].line || followToken.type === "identifier";
		};
		if (tokenList[cursorIndex].value === "static" && isModifier(cursorIndex)) {
			isStatic = true;
			cursorIndex = nextSignificantIndex(tokenList, cursorIndex + 1);
			if (tokenList[cursorIndex].value === "{") {
				tokenIndex = nextSignificantIndex(tokenList, findMatchingIndex(tokenList, cursorIndex) + 1);
				continue;
			}
		}
		if (tokenList[cursorIndex].value === "async" && isModifier(cursorIndex) && tokenList[nextSignificantIndex(tokenList, cursorIndex + 1)].value !== "{") {
			isAsync = true;
			cursorIndex = nextSignificantIndex(tokenList, cursorIndex + 1);
		}
		if (tokenList[cursorIndex].value === "*") {
			isGenerator = true;
			cursorIndex = nextSignificantIndex(tokenList, cursorIndex + 1);
		}
		if ((tokenList[cursorIndex].value === "get" || tokenList[cursorIndex].value === "set") && isModifier(cursorIndex) && tokenList[nextSignificantIndex(tokenList, cursorIndex + 1)].value !== "{") {
			accessor = tokenList[cursorIndex].value;
			cursorIndex = nextSignificantIndex(tokenList, cursorIndex + 1);
		}
		let name = tokenList[cursorIndex].value;
		if (tokenList[cursorIndex].type === "string") {
			name = readStringLiteral(name);
		}
		if (tokenList[cursorIndex].value === "[") {
			const computedCloseIndex = findMatchingIndex(tokenList, cursorIndex);
			name = joinTokens(tokenList, cursorIndex, computedCloseIndex);
			cursorIndex = computedCloseIndex;
		}
		const afterNameIndex = nextSignificantIndex(tokenList, cursorIndex + 1);
		const document = collectLeadingDocument(tokenList, startIndex);
		if (tokenList[afterNameIndex] && tokenList[afterNameIndex].value === "(") {
			const parameterCloseIndex = findMatchingIndex(tokenList, afterNameIndex);
			const bodyIndex = nextSignificantIndex(tokenList, parameterCloseIndex + 1);
			const bodyCloseIndex = findMatchingIndex(tokenList, bodyIndex);
			const assignedNameList = [];
			if (name === "constructor") {
				for (let bodyTokenIndex = bodyIndex; bodyTokenIndex < bodyCloseIndex; ++bodyTokenIndex) {
					if (tokenList[bodyTokenIndex].value === "this" && tokenList[bodyTokenIndex + 1] && tokenList[bodyTokenIndex + 1].value === "." && tokenList[bodyTokenIndex + 2] && tokenList[bodyTokenIndex + 3] && tokenList[bodyTokenIndex + 3].value === "=") {
						assignedNameList.push(tokenList[bodyTokenIndex + 2].value);
					}
				}
			}
			memberList.push({
				name: name,
				isStatic: isStatic,
				isAsync: isAsync,
				isGenerator: isGenerator,
				accessor: accessor,
				isMethod: true,
				parameterList: readParameterList(tokenList, afterNameIndex, parameterCloseIndex),
				valueText: "",
				document: document,
				trailingComment: "",
				assignedNameList: assignedNameList,
				returnsValue: !isGenerator && accessor !== "set" && name !== "constructor" && hasValueReturn(tokenList, bodyIndex, bodyCloseIndex),
				line: tokenList[startIndex].line,
			});
			tokenIndex = nextSignificantIndex(tokenList, bodyCloseIndex + 1);
			continue;
		}

		// 필드. (이름 [= 값];)
		let endIndex = findStatementEndIndex(tokenList, cursorIndex + 1, closeIndex);
		let valueText = "";
		let literalValue;
		if (tokenList[afterNameIndex] && tokenList[afterNameIndex].value === "=") {
			const valueStartIndex = nextSignificantIndex(tokenList, afterNameIndex + 1);
			const valueEndIndex = tokenList[endIndex].value === ";" ? endIndex - 1 : endIndex;
			valueText = joinTokens(tokenList, valueStartIndex, valueEndIndex);
			const valueTokenList = [];
			for (let valueIndex = valueStartIndex; valueIndex <= valueEndIndex; ++valueIndex) {
				if (!isComment(tokenList[valueIndex])) {
					valueTokenList.push(tokenList[valueIndex]);
				}
			}
			literalValue = readLiteralValue(valueTokenList);
		}
		memberList.push({
			name: name,
			isStatic: isStatic,
			isAsync: false,
			isGenerator: false,
			accessor: "",
			isMethod: false,
			parameterList: [],
			valueText: valueText,
			literalValue: literalValue,
			document: document,
			trailingComment: readTrailingComment(tokenList, endIndex),
			assignedNameList: [],
			returnsValue: false,
			line: tokenList[startIndex].line,
		});
		if (endIndex <= cursorIndex) {
			endIndex = cursorIndex;
		}
		tokenIndex = nextSignificantIndex(tokenList, endIndex + 1);
	}
	return memberList;
}

//==============================================================================
// 공개 이름인지. (#이름, 밑줄로 시작하는 이름은 내부)
//==============================================================================
/**
 * @param { string } name
 * @returns { boolean }
 */
function isPublicName(name) {
	return !name.startsWith("#") && !name.startsWith("_");
}

//==============================================================================
// JSDoc 에 @private 이 붙었는지.
//==============================================================================
/**
 * @param { object } document
 * @returns { boolean }
 */
function isMarkedPrivate(document) {
	return document.jsdoc !== null && document.jsdoc.tags.some((tag) => tag.name === "private");
}

//==============================================================================
// JSDoc 태그 찾기.
//==============================================================================
/**
 * @param { object } document
 * @param { string[] } tagNames
 * @returns { object | null }
 */
function findTag(document, tagNames) {
	if (!document.jsdoc) {
		return null;
	}
	return document.jsdoc.tags.find((tag) => tagNames.includes(tag.name)) || null;
}

//==============================================================================
// JSDoc 의 @example 읽기. ([{ title: { ko, en }, code, language, image? }], 없으면 빈 배열)
// - "@example <caption>제목</caption>" 의 제목은 ko 원문이고 en 은 번역 표에서 채운다. 제목이 없으면 빈 글.
// - 코드는 태그 다음 줄부터 다음 태그 앞까지다. 앞뒤 빈 줄과 모든 줄에 같이 붙은 들여쓰기는 뺀다.
// - @example 바로 뒤의 "@exampleImage 파일 이름" 은 그 예제의 image 칸이다. (파일 이름만, docs/guide/<버전>/images/ 에 둔다)
//==============================================================================
/**
 * @param { object } document
 * @returns { object[] }
 */
function readExamples(document) {
	if (!document || !document.jsdoc) {
		return [];
	}
	const exampleList = [];
	let previousTag = null;
	for (const tag of document.jsdoc.tags) {
		const isAfterExample = previousTag !== null && previousTag.name === "example";
		previousTag = tag;
		if (tag.name === "exampleImage") {
			const imageName = tag.text.trim();
			const lastExample = exampleList[exampleList.length - 1];
			if (isAfterExample && lastExample !== undefined && lastExample.image === undefined) {
				lastExample.image = imageName;
			}
			else {
				exampleImageWarningSet.add(imageName);
			}
			continue;
		}
		if (tag.name !== "example") {
			continue;
		}
		let exampleText = tag.rawText.replace(/^[ \t]+/, "");
		let title = "";
		const captionMatch = /^<caption>([\s\S]*?)<\/caption>/.exec(exampleText);
		if (captionMatch) {
			title = captionMatch[1].replace(/\s+/g, " ").trim();
			exampleText = exampleText.slice(captionMatch[0].length);
		}
		const lineList = trimEmptyLines(exampleText.split("\n").map((exampleLine) => exampleLine.replace(/\s+$/, "")));
		let commonIndent = null;
		for (const exampleLine of lineList) {
			if (exampleLine.trim() === "") {
				continue;
			}
			const indent = /^[ \t]*/.exec(exampleLine)[0];
			if (commonIndent === null || !indent.startsWith(commonIndent)) {
				commonIndent = commonIndent === null ? indent : commonPrefix(commonIndent, indent);
			}
		}
		const code = lineList.map((exampleLine) => exampleLine.slice((commonIndent || "").length)).join("\n");
		if (code === "") {
			continue;
		}
		exampleList.push({ title: createText(title), code: code, language: "javascript" });
	}
	return exampleList;
}

//==============================================================================
// 두 글의 같은 앞부분.
//==============================================================================
/**
 * @param { string } firstText
 * @param { string } secondText
 * @returns { string }
 */
function commonPrefix(firstText, secondText) {
	let length = 0;
	while (length < firstText.length && length < secondText.length && firstText[length] === secondText[length]) {
		++length;
	}
	return firstText.slice(0, length);
}

//==============================================================================
// 시그니처에 보일 값. (짧은 리터럴이면 " = 값", 아니면 "")
//==============================================================================
/**
 * @param { any } literalValue
 * @param { string } valueText
 * @returns { string }
 */
function formatShortValue(literalValue, valueText) {
	if (literalValue === undefined && !/^-?(Infinity|NaN)$/.test(valueText)) {
		return "";
	}
	if (valueText.length > SHORT_VALUE_LENGTH || valueText.includes("\n")) {
		return "";
	}
	return " = " + valueText;
}

//==============================================================================
// 값의 꼴 짐작. (JSDoc 이 없을 때 리터럴로)
//==============================================================================
/**
 * @param { any } literalValue
 * @returns { string }
 */
function guessLiteralType(literalValue) {
	if (literalValue === undefined || literalValue === null) {
		return "";
	}
	return typeof literalValue;
}

//==============================================================================
// 설명 글 칸. (ko 원문, en 은 나중에 채운다)
//==============================================================================
/**
 * @param { string } koreanText
 * @returns { object }
 */
function createText(koreanText) {
	return { ko: normalizeKoreanText(koreanText || ""), en: "" };
}

//==============================================================================
// 원문 글 다듬기. (긴 줄표 U+2014 와 가운뎃점 U+00B7 은 문서에 쓰지 않으므로 쉼표로 바꾼다, 그 밖은 원문 그대로)
//==============================================================================
/**
 * @param { string } text
 * @returns { string }
 */
function normalizeKoreanText(text) {
	return text.replace(/[ \t]*[\u2014\u00B7][ \t]*/g, ", ");
}

//==============================================================================
// 매개변수 목록 짓기. (코드의 매개변수 차례, JSDoc 은 이름으로, 안 맞으면 같은 자리로 잇는다)
//==============================================================================
/**
 * @param { object[] } parameterList
 * @param { object } document
 * @returns { object[] }
 */
function buildParameters(parameterList, document) {
	const jsdocParameterList = document.jsdoc ? document.jsdoc.tags.filter((tag) => (tag.name === "param" || tag.name === "arg" || tag.name === "argument") && !tag.parameterName.includes(".")) : [];
	const usedSet = new Set();
	const resultList = parameterList.map((parameter) => {
		const plainName = parameter.name.replace(/^\.\.\./, "");
		const jsdocIndex = jsdocParameterList.findIndex((tag, tagIndex) => !usedSet.has(tagIndex) && tag.parameterName === plainName);
		if (jsdocIndex >= 0) {
			usedSet.add(jsdocIndex);
		}
		return { parameter: parameter, jsdocIndex: jsdocIndex };
	});
	resultList.forEach((result, parameterIndex) => {
		if (result.jsdocIndex < 0 && parameterIndex < jsdocParameterList.length && !usedSet.has(parameterIndex)) {
			result.jsdocIndex = parameterIndex;
			usedSet.add(parameterIndex);
		}
	});
	return resultList.map((result) => {
		const tag = result.jsdocIndex >= 0 ? jsdocParameterList[result.jsdocIndex] : null;
		return { name: result.parameter.name, type: tag ? tag.type : "", description: createText(tag ? tag.text : "") };
	});
}

//==============================================================================
// 반환 칸 짓기. (@returns 가 없으면 null)
//==============================================================================
/**
 * @param { object } document
 * @returns { object | null }
 */
function buildReturns(document) {
	const tag = findTag(document, ["returns", "return"]);
	if (!tag) {
		return null;
	}
	return { type: tag.type, description: createText(tag.text) };
}

//==============================================================================
// 멤버 칸 짓기. (칸 차례: kind, name, signature, params, returns, description, since, source, deprecated, examples)
// - examples 는 fieldTable.examples 가 있으면 그것, 없으면 fieldTable.document 의 @example 이다. (하나도 없으면 칸을 두지 않는다)
//==============================================================================
/**
 * @param { object } fieldTable
 * @returns { object }
 */
function createMember(fieldTable) {
	const member = {
		kind: fieldTable.kind,
		name: fieldTable.name,
		signature: fieldTable.signature,
		params: fieldTable.params,
	};
	if (fieldTable.returns) {
		member.returns = fieldTable.returns;
	}
	member.description = createText(fieldTable.description);
	member.since = "";
	member.source = fieldTable.source;
	const deprecatedTag = fieldTable.document ? findTag(fieldTable.document, ["deprecated"]) : null;
	if (deprecatedTag) {
		member.deprecated = deprecatedTag.text || "deprecated";
	}
	const exampleList = fieldTable.examples || readExamples(fieldTable.document);
	if (exampleList.length > 0) {
		member.examples = exampleList;
	}
	return member;
}

//==============================================================================
// 클래스 멤버를 문서 멤버로. (get / set 짝은 property 하나로 합친다)
//==============================================================================
/**
 * @param { object } classDeclaration
 * @param { string } sourcePath
 * @param { object } statistics
 * @returns { object[] }
 */
function buildClassMembers(classDeclaration, sourcePath, statistics) {
	const resultList = [];
	const propertyTable = new Map();
	for (const member of classDeclaration.memberList) {
		if (!isPublicName(member.name)) {
			continue;
		}
		if (isMarkedPrivate(member.document)) {
			statistics.jsdocPrivateList.push(classDeclaration.name + "." + member.name);
			continue;
		}
		const staticPrefix = member.isStatic ? "static " : "";
		if (member.accessor !== "") {
			const propertyKey = staticPrefix + member.name;
			let property = propertyTable.get(propertyKey);
			if (!property) {
				property = { name: member.name, isStatic: member.isStatic, getter: null, setter: null, order: resultList.length };
				propertyTable.set(propertyKey, property);
				resultList.push(property);
			}
			property[member.accessor === "get" ? "getter" : "setter"] = member;
			if (member.accessor === "get" && member.returnsValue && !findTag(member.document, ["returns", "return", "type"])) {
				statistics.missingReturnsList.push({ source: sourcePath, line: member.line, name: classDeclaration.name + ".get " + member.name });
			}
			continue;
		}
		if (member.isMethod) {
			if (member.returnsValue && !findTag(member.document, ["returns", "return"])) {
				statistics.missingReturnsList.push({ source: sourcePath, line: member.line, name: classDeclaration.name + "." + member.name });
			}
			const asyncPrefix = member.isAsync ? "async " : "";
			const generatorPrefix = member.isGenerator ? "*" : "";
			const parameterText = member.parameterList.map((parameter) => parameter.text).join(", ");
			const isConstructor = member.name === "constructor" && !member.isStatic;
			resultList.push(createMember({
				kind: isConstructor ? "constructor" : (member.isStatic ? "static" : "method"),
				name: member.name,
				signature: staticPrefix + asyncPrefix + generatorPrefix + member.name + "(" + parameterText + ")",
				params: buildParameters(member.parameterList, member.document),
				returns: isConstructor ? null : buildReturns(member.document),
				description: member.document.description,
				source: sourcePath,
				document: member.document,
			}));
			continue;
		}
		const typeTag = findTag(member.document, ["type"]);
		const typeText = typeTag ? typeTag.type : guessLiteralType(member.literalValue);
		resultList.push(createMember({
			kind: member.isStatic ? "static" : "field",
			name: member.name,
			signature: staticPrefix + member.name + formatShortValue(member.literalValue, member.valueText),
			params: [],
			returns: typeText !== "" ? { type: typeText, description: createText("") } : null,
			description: member.document.description || member.trailingComment,
			source: sourcePath,
			document: member.document,
		}));
	}
	return resultList.map((entry) => {
		if (entry.getter === undefined) {
			return entry;
		}
		return buildPropertyMember(entry, sourcePath);
	});
}

//==============================================================================
// get / set 짝을 property 멤버로.
// - 시그니처는 "get name", "set name(value)", 둘 다면 "get/set name". returns.type 은 속성의 꼴이다.
// - 설명은 게터 머리말, 세터 머리말 차례로 잇는다. (같으면 하나)
//==============================================================================
/**
 * @param { object } property
 * @param { string } sourcePath
 * @returns { object }
 */
function buildPropertyMember(property, sourcePath) {
	const staticPrefix = property.isStatic ? "static " : "";
	let signature = staticPrefix + "get/set " + property.name;
	if (property.getter && !property.setter) {
		signature = staticPrefix + "get " + property.name;
	}
	else if (!property.getter && property.setter) {
		signature = staticPrefix + "set " + property.name + "(" + property.setter.parameterList.map((parameter) => parameter.text).join(", ") + ")";
	}
	let typeText = "";
	let returnText = "";
	if (property.getter) {
		const returnTag = findTag(property.getter.document, ["returns", "return", "type"]);
		if (returnTag) {
			typeText = returnTag.type;
			returnText = returnTag.text;
		}
	}
	if (typeText === "" && property.setter) {
		const parameterTag = findTag(property.setter.document, ["param", "type"]);
		if (parameterTag) {
			typeText = parameterTag.type;
		}
	}
	const descriptionList = [];
	for (const accessorMember of [property.getter, property.setter]) {
		if (accessorMember && accessorMember.document.description !== "" && !descriptionList.includes(accessorMember.document.description)) {
			descriptionList.push(accessorMember.document.description);
		}
	}
	const exampleList = [];
	for (const accessorMember of [property.getter, property.setter]) {
		if (accessorMember) {
			for (const example of readExamples(accessorMember.document)) {
				exampleList.push(example);
			}
		}
	}
	return createMember({
		kind: property.isStatic ? "static" : "property",
		name: property.name,
		signature: signature,
		params: [],
		returns: typeText !== "" || returnText !== "" ? { type: typeText, description: createText(returnText) } : null,
		description: descriptionList.join("\n"),
		source: sourcePath,
		document: property.getter ? property.getter.document : property.setter.document,
		examples: exampleList,
	});
}

//==============================================================================
// 모듈 함수를 문서 멤버로. (JSDoc 말로 함수는 method)
//==============================================================================
/**
 * @param { object } declaration
 * @param { string } sourcePath
 * @param { object } statistics
 * @returns { object }
 */
function buildFunctionMember(declaration, sourcePath, statistics) {
	if (declaration.returnsValue && !findTag(declaration.document, ["returns", "return"])) {
		statistics.missingReturnsList.push({ source: sourcePath, line: declaration.line, name: declaration.publicName });
	}
	const asyncPrefix = declaration.isAsync ? "async " : "";
	const generatorPrefix = declaration.isGenerator ? "*" : "";
	return createMember({
		kind: "method",
		name: declaration.publicName,
		signature: asyncPrefix + generatorPrefix + declaration.publicName + "(" + declaration.parameterList.map((parameter) => parameter.text).join(", ") + ")",
		params: buildParameters(declaration.parameterList, declaration.document),
		returns: buildReturns(declaration.document),
		description: declaration.document.description,
		source: sourcePath,
		document: declaration.document,
	});
}

//==============================================================================
// 모듈 상수를 문서 멤버로. (kind 는 field, returns.type 은 값의 꼴)
//==============================================================================
/**
 * @param { object } declaration
 * @param { string } sourcePath
 * @returns { object }
 */
function buildConstantMember(declaration, sourcePath) {
	const typeTag = findTag(declaration.document, ["type"]);
	const typeText = typeTag ? typeTag.type : guessLiteralType(declaration.literalValue);
	return createMember({
		kind: "field",
		name: declaration.publicName,
		signature: declaration.publicName + formatShortValue(declaration.literalValue, declaration.valueText),
		params: [],
		returns: typeText !== "" ? { type: typeText, description: createText("") } : null,
		description: declaration.document.description || declaration.trailingComment,
		source: sourcePath,
		document: declaration.document,
	});
}

//==============================================================================
// 열거 칸 짓기.
//==============================================================================
/**
 * @param { object } declaration
 * @returns { object }
 */
function buildEnum(declaration) {
	const enumEntry = {
		name: declaration.publicName,
		summary: createText(declaration.document.description || declaration.trailingComment),
		values: declaration.entryList.map((entry) => ({ name: entry.name, value: entry.literalValue, description: createText(entry.description) })),
	};
	const exampleList = readExamples(declaration.document);
	if (exampleList.length > 0) {
		enumEntry.examples = exampleList;
	}
	return enumEntry;
}

//==============================================================================
// 진입점이 내보내는 이름 읽기.
// - [{ modulePath, isNamespace, nameList: [{ localName, exportName }] }] (진입점에 처음 나온 차례)
//==============================================================================
/**
 * @returns { object[] }
 */
function readEntryExports() {
	const entry = parseSourceFile(fs.readFileSync(ENTRY_FILE_PATH, "utf8"));
	const moduleTable = new Map();
	for (const reexport of entry.reexportList) {
		const modulePath = path.posix.normalize(reexport.modulePath).replace(/^\.\//, "");
		if (!modulePath.startsWith("src/")) {
			continue;
		}
		let moduleEntry = moduleTable.get(modulePath);
		if (!moduleEntry) {
			moduleEntry = { modulePath: modulePath, isNamespace: false, namespaceName: "", nameList: [] };
			moduleTable.set(modulePath, moduleEntry);
		}
		if (reexport.isNamespace) {
			moduleEntry.isNamespace = true;
			moduleEntry.namespaceName = reexport.specifierList[0].exportName;
		}
		else {
			for (const specifier of reexport.specifierList) {
				moduleEntry.nameList.push(specifier);
			}
		}
	}

	// 초안 진입점. (진입점에 들지 않아 Experimental 이름 공간으로 따로 더한다)
	if (!moduleTable.has(DRAFT_ENTRY_MODULE_PATH) && fs.existsSync(path.join(REPOSITORY_ROOT, DRAFT_ENTRY_MODULE_PATH))) {
		moduleTable.set(DRAFT_ENTRY_MODULE_PATH, { modulePath: DRAFT_ENTRY_MODULE_PATH, isNamespace: true, namespaceName: DRAFT_NAMESPACE_NAME, nameList: [] });
	}

	// 이름 공간 모듈이 다시 내보내는 파일도 따라간다. (Experimental 처럼 그 파일에 선언 없이 export ... from 만 있는 모듈)
	const pendingModulePathList = Array.from(moduleTable.values()).filter((moduleEntry) => moduleEntry.isNamespace).map((moduleEntry) => moduleEntry.modulePath);
	while (pendingModulePathList.length > 0) {
		const namespacePath = pendingModulePathList.shift();
		const namespaceFullPath = path.join(REPOSITORY_ROOT, namespacePath);
		if (!fs.existsSync(namespaceFullPath)) {
			continue;
		}
		const namespaceEntry = moduleTable.get(namespacePath);
		const parsed = parseSourceFile(fs.readFileSync(namespaceFullPath, "utf8"));
		for (const reexport of parsed.reexportList) {
			if (!reexport.modulePath.startsWith(".")) {
				continue;
			}
			const modulePath = path.posix.normalize(path.posix.join(path.posix.dirname(namespacePath), reexport.modulePath));
			let moduleEntry = moduleTable.get(modulePath);
			if (!moduleEntry) {
				moduleEntry = { modulePath: modulePath, isNamespace: false, namespaceName: "", nameList: [] };
				moduleTable.set(modulePath, moduleEntry);
			}
			if (reexport.isNamespace) {
				if (!moduleEntry.isNamespace) {
					moduleEntry.isNamespace = true;
					moduleEntry.namespaceName = namespaceEntry.namespaceName;
					pendingModulePathList.push(modulePath);
				}
			}
			else {
				for (const specifier of reexport.specifierList) {
					moduleEntry.nameList.push(specifier);
				}
			}
		}
	}
	return Array.from(moduleTable.values());
}

//==============================================================================
// 공개 API 모으기. (since 와 en 은 비운 채)
//==============================================================================
/**
 * @param { object } statistics
 * @returns { object[] }
 */
function collectModules(statistics) {
	const moduleList = [];
	for (const moduleEntry of readEntryExports()) {
		const sourcePath = moduleEntry.modulePath;
		const fullPath = path.join(REPOSITORY_ROOT, sourcePath);
		if (!fs.existsSync(fullPath)) {
			statistics.unresolvedList.push(sourcePath);
			continue;
		}
		const parsed = parseSourceFile(fs.readFileSync(fullPath, "utf8"));
		const publicDeclarationList = [];
		if (moduleEntry.isNamespace) {
			for (const declaration of parsed.declarationList) {
				if (declaration.isExported && isPublicName(declaration.exportName || declaration.name)) {
					declaration.publicName = declaration.exportName || declaration.name;
					publicDeclarationList.push(declaration);
				}
			}
		}
		for (const specifier of moduleEntry.nameList) {
			const declaration = parsed.declarationList.find((candidate) => candidate.isExported && (candidate.exportName || candidate.name) === specifier.localName);
			if (!declaration) {
				statistics.unresolvedList.push(sourcePath + ": " + specifier.localName);
				continue;
			}
			if (!publicDeclarationList.includes(declaration)) {
				declaration.publicName = specifier.exportName;
				publicDeclarationList.push(declaration);
			}
		}
		publicDeclarationList.sort((first, second) => first.line - second.line);

		const classList = [];
		const functionList = [];
		const enumList = [];
		for (const declaration of publicDeclarationList) {
			if (declaration.kind === "class") {
				const classEntry = { name: declaration.publicName, summary: createText(declaration.document.description) };
				const classExampleList = readExamples(declaration.document);
				if (classExampleList.length > 0) {
					classEntry.examples = classExampleList;
				}
				if (declaration.extendsText !== "") {
					classEntry.extends = declaration.extendsText;
				}
				classEntry.members = buildClassMembers(declaration, sourcePath, statistics);
				classEntry.sinceKey = declaration.name;
				classList.push(classEntry);
			}
			else if (declaration.kind === "function") {
				const member = buildFunctionMember(declaration, sourcePath, statistics);
				member.sinceKey = declaration.name;
				functionList.push(member);
			}
			else if (declaration.entryList && declaration.entryList.length > 0 && !SCREAMING_NAME_PATTERN.test(declaration.publicName)) {
				enumList.push(buildEnum(declaration));
			}
			else {
				const member = buildConstantMember(declaration, sourcePath);
				member.sinceKey = declaration.name;
				functionList.push(member);
			}
		}

		// 모듈 설명: 파일 머리 설명, 없으면 주된 클래스(없으면 하나뿐인 공개 선언) 설명의 첫 줄.
		let moduleSummary = parsed.fileSummary;
		if (moduleSummary === "") {
			const baseName = path.basename(sourcePath, ".js");
			const mainClass = classList.find((classEntry) => classEntry.name.toLowerCase() === baseName) || classList[0];
			let firstText = "";
			if (mainClass) {
				firstText = mainClass.summary.ko;
			}
			else if (publicDeclarationList.length === 1) {
				firstText = functionList.length > 0 ? functionList[0].description.ko : enumList[0].summary.ko;
			}
			moduleSummary = firstText.split("\n")[0];
		}
		const moduleEntryData = {
			name: sourcePath.replace(/^src\//, "").replace(/\.js$/, ""),
			summary: createText(moduleSummary),
		};
		if (parsed.fileExampleList.length > 0) {
			moduleEntryData.examples = parsed.fileExampleList;
		}
		moduleEntryData.classes = classList;
		moduleEntryData.functions = functionList;
		moduleEntryData.enums = enumList;
		moduleList.push(moduleEntryData);
	}
	return moduleList;
}

//==============================================================================
// 판 글 비교. ("0.3.2" 꼴, 앞이 작으면 음수)
//==============================================================================
/**
 * @param { string } firstVersion
 * @param { string } secondVersion
 * @returns { number }
 */
function compareVersions(firstVersion, secondVersion) {
	const firstParts = firstVersion.split(".").map(Number);
	const secondParts = secondVersion.split(".").map(Number);
	for (let partIndex = 0; partIndex < 3; ++partIndex) {
		if (firstParts[partIndex] !== secondParts[partIndex]) {
			return firstParts[partIndex] - secondParts[partIndex];
		}
	}
	return 0;
}

//==============================================================================
// git 실행. (표준 출력 Buffer)
//==============================================================================
/**
 * @param { string[] } argumentList
 * @param { string } [inputText]
 * @returns { Buffer }
 */
function runGit(argumentList, inputText) {
	const result = childProcess.spawnSync("git", argumentList, { cwd: REPOSITORY_ROOT, input: inputText, maxBuffer: 1024 * 1024 * 1024 });
	if (result.status !== 0) {
		throw new Error("git " + argumentList.join(" ") + " 실패: " + String(result.stderr));
	}
	return result.stdout;
}

//==============================================================================
// 태그 하나의 이름 표 짓기.
// - { classTable: Map<클래스 이름, Set<멤버 이름>>, pathNameTable: Map<경로, Set<내보낸 이름>>, exportedNameSet }
// - git cat-file --batch 로 그 태그의 src/**/*.js 를 한 번에 읽는다. (git show <태그>:<경로> 와 같은 내용)
//==============================================================================
/**
 * @param { string } tagName
 * @param { object } statistics
 * @returns { object }
 */
function readTagNames(tagName, statistics) {
	const treeText = runGit(["ls-tree", "-r", tagName, "--", "src"]).toString("utf8");
	const blobList = [];
	for (const treeLine of treeText.split("\n")) {
		const treeMatch = /^\d+ blob ([0-9a-f]+)\t(.+)$/.exec(treeLine);
		if (treeMatch && treeMatch[2].endsWith(".js")) {
			blobList.push({ objectName: treeMatch[1], filePath: treeMatch[2] });
		}
	}
	const batchOutput = runGit(["cat-file", "--batch"], blobList.map((blob) => blob.objectName).join("\n") + "\n");
	const classTable = new Map();
	const pathNameTable = new Map();
	const exportedNameSet = new Set();
	let offset = 0;
	for (const blob of blobList) {
		const headerEnd = batchOutput.indexOf(10, offset);
		const headerText = batchOutput.slice(offset, headerEnd).toString("utf8");
		const size = Number(headerText.split(" ")[2]);
		const sourceText = batchOutput.slice(headerEnd + 1, headerEnd + 1 + size).toString("utf8");
		offset = headerEnd + 1 + size + 1;
		let parsed = null;
		try {
			parsed = parseSourceFile(sourceText);
		}
		catch (error) {
			statistics.sinceParseFailureList.push(tagName + ":" + blob.filePath);
			continue;
		}
		const nameSet = new Set();
		for (const declaration of parsed.declarationList) {
			if (declaration.kind === "class") {
				let memberSet = classTable.get(declaration.name);
				if (!memberSet) {
					memberSet = new Set();
					classTable.set(declaration.name, memberSet);
				}
				memberSet.add("constructor");
				for (const member of declaration.memberList) {
					memberSet.add(member.name);
					for (const assignedName of member.assignedNameList) {
						memberSet.add(assignedName);
					}
				}
			}
			else if (declaration.isExported) {
				nameSet.add(declaration.exportName || declaration.name);
				exportedNameSet.add(declaration.exportName || declaration.name);
			}
		}
		pathNameTable.set(blob.filePath, nameSet);
	}
	return { classTable: classTable, pathNameTable: pathNameTable, exportedNameSet: exportedNameSet };
}

//==============================================================================
// since 채우기.
// - 클래스 멤버: 그 이름의 클래스(파일이 옮겨져도 이름으로)에 그 멤버가 처음 있던 태그.
// - 모듈 함수와 상수: 같은 경로에 그 이름이 처음 있던 태그. 그 태그에 경로가 없으면 어느 파일이든 내보낸 같은 이름.
//==============================================================================
/**
 * @param { object[] } moduleList
 * @param { string } version
 * @param { object } statistics
 * @param { string[] } [givenTagList] 훑을 태그를 정해 줄 때. (빈 배열이면 모두 그 판)
 */
function fillSince(moduleList, version, statistics, givenTagList) {
	const tagList = givenTagList || runGit(["tag", "--list"]).toString("utf8").split("\n").map((tagName) => tagName.trim()).filter((tagName) => /^v\d+\.\d+\.\d+$/.test(tagName)).filter((tagName) => compareVersions(tagName.slice(1), SINCE_FIRST_VERSION) >= 0 && compareVersions(tagName.slice(1), version) < 0).sort((first, second) => compareVersions(first.slice(1), second.slice(1)));
	statistics.sinceTagList = tagList;
	const tagNamesList = tagList.map((tagName) => ({ version: tagName.slice(1), names: readTagNames(tagName, statistics) }));
	for (const moduleEntry of moduleList) {
		for (const classEntry of moduleEntry.classes) {
			for (const member of classEntry.members) {
				const found = tagNamesList.find((tagNames) => tagNames.names.classTable.has(classEntry.sinceKey) && tagNames.names.classTable.get(classEntry.sinceKey).has(member.name));
				member.since = found ? found.version : version;
			}
			delete classEntry.sinceKey;
		}
		for (const member of moduleEntry.functions) {
			const found = tagNamesList.find((tagNames) => {
				const nameSet = tagNames.names.pathNameTable.get(member.source);
				if (nameSet) {
					return nameSet.has(member.sinceKey);
				}
				return tagNames.names.exportedNameSet.has(member.sinceKey);
			});
			member.since = found ? found.version : version;
			delete member.sinceKey;
		}
	}
}

//==============================================================================
// 자료의 모든 설명 칸 돌기. (callback(textObject), 예제 제목도 돈다)
//==============================================================================
/**
 * @param { object } apiDocument
 * @param { Function } callback
 */
function forEachText(apiDocument, callback) {
	const visitExamples = (owner) => {
		for (const example of owner.examples || []) {
			callback(example.title);
		}
	};
	const visitMember = (member) => {
		for (const parameter of member.params || []) {
			callback(parameter.description);
		}
		if (member.returns) {
			callback(member.returns.description);
		}
		callback(member.description);
		visitExamples(member);
	};
	for (const moduleEntry of apiDocument.modules) {
		callback(moduleEntry.summary);
		visitExamples(moduleEntry);
		for (const classEntry of moduleEntry.classes) {
			callback(classEntry.summary);
			visitExamples(classEntry);
			classEntry.members.forEach(visitMember);
		}
		moduleEntry.functions.forEach(visitMember);
		for (const enumEntry of moduleEntry.enums) {
			callback(enumEntry.summary);
			visitExamples(enumEntry);
			for (const value of enumEntry.values) {
				callback(value.description);
			}
		}
	}
}

//==============================================================================
// 번역 표 읽기.
//==============================================================================
/**
 * @returns { object }
 */
function readTranslationTable() {
	if (!fs.existsSync(TRANSLATION_FILE_PATH)) {
		return {};
	}
	return JSON.parse(fs.readFileSync(TRANSLATION_FILE_PATH, "utf8"));
}

//==============================================================================
// en 채우기. (빈 en 칸이 된 ko 글 목록을 돌려준다)
//==============================================================================
/**
 * @param { object } apiDocument
 * @returns { string[] }
 */
function applyTranslation(apiDocument) {
	const translationTable = readTranslationTable();
	const missingSet = new Set();
	forEachText(apiDocument, (textObject) => {
		if (textObject.ko === "") {
			textObject.en = "";
			return;
		}
		if (!HANGUL_PATTERN.test(textObject.ko)) {
			textObject.en = textObject.ko;
			return;
		}
		const englishText = Object.prototype.hasOwnProperty.call(translationTable, textObject.ko) ? translationTable[textObject.ko] : "";
		if (typeof englishText === "string" && englishText !== "") {
			textObject.en = englishText;
			return;
		}
		textObject.en = "";
		missingSet.add(textObject.ko);
	});
	return Array.from(missingSet);
}

//==============================================================================
// 판의 날짜. (--date, UPDATE.md 의 "# <판> (YYYY-MM-DD)", 있던 자료의 날짜, 오늘 차례로)
//==============================================================================
/**
 * @param { string } version
 * @param { string } dateOption
 * @param { string } outputPath
 * @returns { string }
 */
function resolveDate(version, dateOption, outputPath) {
	if (dateOption) {
		return dateOption;
	}
	if (fs.existsSync(UPDATE_FILE_PATH)) {
		const escapedVersion = version.replace(/\./g, "\\.");
		const headingMatch = new RegExp("^# " + escapedVersion + " \\((\\d{4}-\\d{2}-\\d{2})\\)", "m").exec(fs.readFileSync(UPDATE_FILE_PATH, "utf8"));
		if (headingMatch) {
			return headingMatch[1];
		}
	}
	if (fs.existsSync(outputPath)) {
		const previousDocument = JSON.parse(fs.readFileSync(outputPath, "utf8"));
		if (typeof previousDocument.date === "string" && previousDocument.date !== "") {
			return previousDocument.date;
		}
	}
	const now = new Date();
	return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
}

//==============================================================================
// 짝 표 경로.
//==============================================================================
/**
 * @param { string } version
 * @returns { string }
 */
function getCounterpartTablePath(version) {
	return path.join(API_DIRECTORY_PATH, "counterpart." + version + ".json");
}

//==============================================================================
// 러스트 판 짝 표를 이 저장소로 옮기기.
// - 표 꼴: { engine: "vanilla-engine", counterpartEngine: "vanilla.js", version, items: [ { "vanilla-engine": { module, class, name }, "vanilla.js": { module, class, name } } ] }
// - 러스트 판 도구(cargo run -p vanilla-engine-apidoc -- <판> --counterpart <이 저장소 자료>)가 이 저장소 자료의 이름으로 짓는다. 짓는 일은 그쪽이 맡고 여기는 그대로 옮긴다.
//==============================================================================
/**
 * @param { string } sourcePath
 * @param { string } version
 */
function copyCounterpartTable(sourcePath, version) {
	const table = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
	if (table.engine !== COUNTERPART_ENGINE_NAME || table.counterpartEngine !== ENGINE_NAME || !Array.isArray(table.items)) {
		throw new Error("러스트 판 짝 표가 아니다: " + sourcePath);
	}
	if (table.version !== version) {
		throw new Error("짝 표의 판 " + table.version + " 이 " + version + " 이 아니다: " + sourcePath);
	}
	fs.mkdirSync(API_DIRECTORY_PATH, { recursive: true });
	fs.writeFileSync(getCounterpartTablePath(version), JSON.stringify(table, null, "\t") + "\n");
}

//==============================================================================
// 짝 열쇠. (모듈, 클래스, 이름)
//==============================================================================
/**
 * @param { object } key
 * @returns { string }
 */
function createCounterpartLookupKey(key) {
	return (key.module || "") + "\u001f" + (key.class || "") + "\u001f" + (key.name || "");
}

//==============================================================================
// 이름 견주기 꼴. (밑줄을 빼고 소문자, get_width 와 getWidth 가 같다)
//==============================================================================
/**
 * @param { string } name
 * @returns { string }
 */
function normalizeCounterpartName(name) {
	return (name || "").replace(/_/g, "").toLowerCase();
}

//==============================================================================
// 짝 채우기. (클래스, 열거, 멤버, 모듈 함수에 counterpart: { engine, module, class, name }, 없는 칸은 뺀다)
// - 열거 값에도 짝이 있으면 둔다. (러스트 판이 연관 상수를 둔 구조체로 옮긴 열거, Colors, Pivot, TileFlag 같은 것)
// - 러스트 판 짝이 여럿인 것(속성 하나가 get_ 와 set_ 둘, getDescription 이 get_description 과 get_description_mut 둘)은
//   이름이 같은 것(밑줄과 대소문자를 빼고), 읽기(get_, is_, has_), 표 차례 순으로 하나를 고른다.
// - 짝 표에 있지만 이 자료에 없는 것과, 짝이 없는 것의 수를 statistics 에 남긴다.
//==============================================================================
/**
 * @param { object[] } moduleList
 * @param { string } version
 * @param { object } statistics
 */
function fillCounterparts(moduleList, version, statistics) {
	statistics.counterpartTableItems = 0;
	statistics.counterpartStaleList = [];
	const tablePath = getCounterpartTablePath(version);
	if (!fs.existsSync(tablePath)) {
		statistics.counterpartTableMissing = true;
		return;
	}
	const table = JSON.parse(fs.readFileSync(tablePath, "utf8"));
	const candidateTable = new Map();
	for (const item of table.items || []) {
		const ownKey = item[ENGINE_NAME];
		const otherKey = item[COUNTERPART_ENGINE_NAME];
		if (!ownKey || !otherKey || isDraftModuleName(ownKey.module) || isDraftModuleName(otherKey.module)) {
			continue;
		}
		++statistics.counterpartTableItems;
		const lookupKey = createCounterpartLookupKey(ownKey);
		if (!candidateTable.has(lookupKey)) {
			candidateTable.set(lookupKey, []);
		}
		candidateTable.get(lookupKey).push(otherKey);
	}
	const usedKeySet = new Set();
	const pickCounterpart = (ownKey) => {
		const lookupKey = createCounterpartLookupKey(ownKey);
		const candidateList = candidateTable.get(lookupKey);
		if (!candidateList) {
			return null;
		}
		usedKeySet.add(lookupKey);
		const rankCandidate = (candidate) => {
			if (normalizeCounterpartName(candidate.name) === normalizeCounterpartName(ownKey.name)) {
				return 0;
			}
			if (/^(get|is|has)_/.test(candidate.name || "")) {
				return 1;
			}
			return 2;
		};
		let best = candidateList[0];
		for (const candidate of candidateList) {
			if (rankCandidate(candidate) < rankCandidate(best)) {
				best = candidate;
			}
		}
		const counterpart = { engine: COUNTERPART_ENGINE_NAME, module: best.module };
		if (best.class) {
			counterpart.class = best.class;
		}
		if (best.name) {
			counterpart.name = best.name;
		}
		return counterpart;
	};
	// 칸 차례를 지키며 counterpart 넣기. (beforeKey 앞, 없으면 끝)
	const insertCounterpart = (owner, counterpart, beforeKey) => {
		if (!counterpart) {
			return owner;
		}
		const result = {};
		for (const key of Object.keys(owner)) {
			if (key === beforeKey) {
				result.counterpart = counterpart;
			}
			result[key] = owner[key];
		}
		if (result.counterpart === undefined) {
			result.counterpart = counterpart;
		}
		return result;
	};
	// 멤버는 source 다음. (러스트 판 자료와 같은 차례)
	const memberBeforeKey = (member) => {
		const keyList = Object.keys(member);
		const sourceIndex = keyList.indexOf("source");
		return sourceIndex >= 0 && sourceIndex + 1 < keyList.length ? keyList[sourceIndex + 1] : "";
	};
	for (const moduleEntry of moduleList) {
		moduleEntry.classes = moduleEntry.classes.map((classEntry) => {
			classEntry.members = classEntry.members.map((member) => insertCounterpart(member, pickCounterpart({ module: moduleEntry.name, class: classEntry.name, name: member.name }), memberBeforeKey(member)));
			return insertCounterpart(classEntry, pickCounterpart({ module: moduleEntry.name, class: classEntry.name }), "members");
		});
		moduleEntry.functions = moduleEntry.functions.map((member) => insertCounterpart(member, pickCounterpart({ module: moduleEntry.name, name: member.name }), memberBeforeKey(member)));
		moduleEntry.enums = moduleEntry.enums.map((enumEntry) => {
			enumEntry.values = enumEntry.values.map((value) => insertCounterpart(value, pickCounterpart({ module: moduleEntry.name, class: enumEntry.name, name: value.name }), ""));
			return insertCounterpart(enumEntry, pickCounterpart({ module: moduleEntry.name, class: enumEntry.name }), "values");
		});
	}
	for (const lookupKey of candidateTable.keys()) {
		if (!usedKeySet.has(lookupKey)) {
			statistics.counterpartStaleList.push(lookupKey.split("\u001f").filter((part) => part !== "").join(" "));
		}
	}
}

//==============================================================================
// 자료 짓기.
//==============================================================================
/**
 * @param { string } version
 * @param { string } dateOption
 * @param { string } outputPath
 * @param { boolean } [isSinceEnabled] 거짓이면 태그를 훑지 않고 since 를 모두 그 판으로 둔다. (빈 곳 찾기와 예제 검사는 since 가 필요 없다)
 * @returns { object }
 */
function buildApiDocument(version, dateOption, outputPath, isSinceEnabled = true) {
	const statistics = { unresolvedList: [], jsdocPrivateList: [], sinceParseFailureList: [], sinceTagList: [], missingReturnsList: [] };
	const moduleList = collectModules(statistics);
	if (isSinceEnabled) {
		fillSince(moduleList, version, statistics);
	}
	else {
		fillSince(moduleList, version, statistics, []);
	}
	fillCounterparts(moduleList, version, statistics);
	const apiDocument = {
		engine: ENGINE_NAME,
		version: version,
		date: resolveDate(version, dateOption, outputPath),
		modules: moduleList,
	};
	const missingList = applyTranslation(apiDocument);
	return { apiDocument: apiDocument, missingList: missingList, statistics: statistics };
}

//==============================================================================
// 자료에서 초안 모듈 떼기. (자료의 modules 는 초안 아닌 것만 남기고, 뗀 초안 모듈 목록을 돌려준다)
//==============================================================================
/**
 * @param { object } apiDocument
 * @returns { object[] }
 */
function removeDraftModules(apiDocument) {
	const draftModuleList = apiDocument.modules.filter((moduleEntry) => isDraftModuleName(moduleEntry.name));
	apiDocument.modules = apiDocument.modules.filter((moduleEntry) => !isDraftModuleName(moduleEntry.name));
	return draftModuleList;
}

//==============================================================================
// 초안 모듈 검사 결과 찍기. (자료에 넣지 않는 초안도 꼴과 빈 칸을 본다, 꼴 오류 수를 돌려준다)
//==============================================================================
/**
 * @param { object } apiDocument
 * @param { object[] } draftModuleList
 * @returns { number }
 */
function printDraftCheckResult(apiDocument, draftModuleList) {
	const draftResult = checkApiDocument({ engine: apiDocument.engine, version: apiDocument.version, date: apiDocument.date, modules: draftModuleList }, true);
	console.log("[apidoc] 초안 모듈(자료에 넣지 않음) " + draftResult.counts.modules + ", ko 빈 칸 " + draftResult.counts.emptyKorean + ", en 빈 칸 " + draftResult.counts.emptyEnglish + ", 꼴 오류 " + draftResult.errorList.length);
	for (const error of draftResult.errorList.slice(0, 50)) {
		console.log("  초안: " + error);
	}
	return draftResult.errorList.length;
}

//==============================================================================
// 값 멤버인지. (필드와 정적 필드, returns 는 값의 꼴만 담고 설명은 멤버 설명이 맡는다)
//==============================================================================
/**
 * @param { object } member
 * @returns { boolean }
 */
function isValueMember(member) {
	if (member.kind === "field") {
		return true;
	}
	return member.kind === "static" && !member.signature.includes("(") && !/^static (get|set|get\/set) /.test(member.signature);
}

//==============================================================================
// 자료 꼴 검사와 수 세기. (꼴 오류 목록을 돌려준다)
// - isDraftOnly 면 초안 모듈만 든 자료다. (초안이 있어도 오류가 아니고, 소스의 그림 표시와 가이드 그림은 보지 않는다)
//==============================================================================
/**
 * @param { object } apiDocument
 * @param { boolean } [isDraftOnly]
 * @returns { object }
 */
function checkApiDocument(apiDocument, isDraftOnly = false) {
	const errorList = [];
	const counts = { modules: 0, classes: 0, members: 0, functions: 0, enums: 0, enumValues: 0, texts: 0, emptyEnglish: 0, emptyKorean: 0, emptyValueSlots: 0, examples: 0, exampleImages: 0, guideImages: 0, unusedImages: 0, moduleExamples: 0, classExamples: 0, memberExamples: 0, enumExamples: 0, classesWithoutExample: 0, modulesWithoutExample: 0, counterparts: 0, classCounterparts: 0, memberCounterparts: 0, functionCounterparts: 0, enumCounterparts: 0, enumValueCounterparts: 0 };
	const sinceTable = Object.create(null);
	const kindTable = Object.create(null);

	// 설명 칸인지. (emptyKind: "count" 는 빈 ko 를 ko 빈 칸으로, "valueSlot" 은 필드 값 칸으로 세고, "optional" 은 세지 않는다)
	const checkText = (textObject, where, emptyKind) => {
		if (!textObject || typeof textObject !== "object" || typeof textObject.ko !== "string" || typeof textObject.en !== "string" || Object.keys(textObject).length !== 2) {
			errorList.push(where + ": 설명 칸이 { ko, en } 이 아니다");
			return;
		}
		++counts.texts;
		if (textObject.ko !== "" && textObject.en === "") {
			++counts.emptyEnglish;
		}
		if (textObject.ko === "") {
			if (emptyKind === "valueSlot") {
				++counts.emptyValueSlots;
			}
			else if (emptyKind !== "optional") {
				++counts.emptyKorean;
			}
		}
	};
	// 그림 파일 이름이 꼴에 맞고 docs/guide/<버전>/images/ 에 있는지.
	const imageDirectoryPath = path.join(GUIDE_DIRECTORY_PATH, String(apiDocument.version), "images");
	const usedImageSet = new Set();
	const checkImage = (imageName, where) => {
		if (typeof imageName !== "string" || !EXAMPLE_IMAGE_NAME_PATTERN.test(imageName)) {
			errorList.push(where + ": 파일 이름 꼴 " + JSON.stringify(imageName) + " (영문 소문자, 숫자, 점, 밑줄, 하이픈과 .webp, .png, .jpg, .gif)");
			return;
		}
		if (!fs.existsSync(path.join(imageDirectoryPath, imageName))) {
			errorList.push(where + ": 파일 없음 docs/guide/" + apiDocument.version + "/images/" + imageName);
		}
	};
	// 예제 칸인지. (없으면 0, 있으면 예제 수)
	const checkExamples = (owner, where) => {
		if (owner.examples === undefined) {
			return 0;
		}
		if (!Array.isArray(owner.examples) || owner.examples.length === 0) {
			errorList.push(where + ": examples 가 빈 배열이거나 배열이 아니다");
			return 0;
		}
		owner.examples.forEach((example, exampleIndex) => {
			const exampleWhere = where + " 예제 " + (exampleIndex + 1);
			checkText(example.title, exampleWhere + " 제목", "optional");
			if (typeof example.code !== "string" || example.code.trim() === "") {
				errorList.push(exampleWhere + ": code 가 빈 글이다");
			}
			if (example.language !== "javascript") {
				errorList.push(exampleWhere + ": language " + example.language);
			}
			if (example.image !== undefined) {
				checkImage(example.image, exampleWhere + " 그림");
				usedImageSet.add(example.image);
				++counts.exampleImages;
			}
			if (Object.keys(example).length !== (example.image === undefined ? 3 : 4)) {
				errorList.push(exampleWhere + ": 칸이 { title, code, language, image? } 가 아니다");
			}
			++counts.examples;
		});
		return owner.examples.length;
	};
	// 짝 칸인지. (없으면 0, 있으면 1)
	const checkCounterpart = (owner, where) => {
		if (owner.counterpart === undefined) {
			return 0;
		}
		const counterpart = owner.counterpart;
		if (!counterpart || typeof counterpart !== "object" || counterpart.engine !== COUNTERPART_ENGINE_NAME || typeof counterpart.module !== "string" || counterpart.module === "") {
			errorList.push(where + ": counterpart 꼴");
			return 0;
		}
		if (isDraftModuleName(counterpart.module)) {
			errorList.push(where + ": 초안 모듈을 가리키는 짝 " + counterpart.module);
		}
		for (const key of Object.keys(counterpart)) {
			if (!["engine", "module", "class", "name"].includes(key) || typeof counterpart[key] !== "string" || counterpart[key] === "") {
				errorList.push(where + ": counterpart 칸 " + key);
			}
		}
		++counts.counterparts;
		return 1;
	};
	// 멤버 꼴인지.
	const checkMember = (member, where) => {
		const memberWhere = where + "." + member.name;
		if (!MEMBER_KINDS.includes(member.kind)) {
			errorList.push(memberWhere + ": kind " + member.kind);
		}
		kindTable[member.kind] = (kindTable[member.kind] || 0) + 1;
		for (const key of ["name", "signature", "since", "source"]) {
			if (typeof member[key] !== "string" || member[key] === "") {
				errorList.push(memberWhere + ": " + key + " 가 빈 글이다");
			}
		}
		if (!/^\d+\.\d+\.\d+$/.test(member.since)) {
			errorList.push(memberWhere + ": since " + member.since);
		}
		sinceTable[member.since] = (sinceTable[member.since] || 0) + 1;
		if (!Array.isArray(member.params)) {
			errorList.push(memberWhere + ": params 가 배열이 아니다");
		}
		for (const parameter of member.params || []) {
			if (typeof parameter.name !== "string" || typeof parameter.type !== "string") {
				errorList.push(memberWhere + ": 매개변수 꼴");
			}
			checkText(parameter.description, memberWhere + "(" + parameter.name + ")");
		}
		if (member.returns !== undefined) {
			if (typeof member.returns.type !== "string") {
				errorList.push(memberWhere + ": returns.type");
			}
			checkText(member.returns.description, memberWhere + " returns", isValueMember(member) ? "valueSlot" : "count");
		}
		if (member.deprecated !== undefined && typeof member.deprecated !== "string") {
			errorList.push(memberWhere + ": deprecated");
		}
		checkText(member.description, memberWhere);
		counts.memberExamples += checkExamples(member, memberWhere);
		return checkCounterpart(member, memberWhere);
	};

	if (apiDocument.engine !== ENGINE_NAME) {
		errorList.push("engine 이 " + ENGINE_NAME + " 이 아니다");
	}
	if (!/^\d+\.\d+\.\d+$/.test(apiDocument.version || "")) {
		errorList.push("version 꼴");
	}
	if (!/^\d{4}-\d{2}-\d{2}$/.test(apiDocument.date || "")) {
		errorList.push("date 꼴");
	}
	for (const moduleEntry of apiDocument.modules || []) {
		++counts.modules;
		if (!isDraftOnly && isDraftModuleName(moduleEntry.name)) {
			errorList.push(moduleEntry.name + ": 초안 모듈이 자료에 있다");
		}
		checkText(moduleEntry.summary, moduleEntry.name);
		const moduleExampleCount = checkExamples(moduleEntry, moduleEntry.name);
		counts.moduleExamples += moduleExampleCount;
		if (moduleExampleCount === 0 && !(moduleEntry.classes || []).some((classEntry) => classEntry.examples !== undefined)) {
			++counts.modulesWithoutExample;
		}
		for (const key of ["classes", "functions", "enums"]) {
			if (!Array.isArray(moduleEntry[key])) {
				errorList.push(moduleEntry.name + ": " + key + " 가 배열이 아니다");
			}
		}
		for (const classEntry of moduleEntry.classes || []) {
			++counts.classes;
			checkText(classEntry.summary, classEntry.name);
			const classExampleCount = checkExamples(classEntry, classEntry.name);
			counts.classExamples += classExampleCount;
			if (classExampleCount === 0) {
				++counts.classesWithoutExample;
			}
			if (classEntry.extends !== undefined && (typeof classEntry.extends !== "string" || classEntry.extends === "")) {
				errorList.push(classEntry.name + ": extends");
			}
			counts.classCounterparts += checkCounterpart(classEntry, classEntry.name);
			for (const member of classEntry.members || []) {
				++counts.members;
				counts.memberCounterparts += checkMember(member, classEntry.name);
			}
		}
		for (const member of moduleEntry.functions || []) {
			++counts.functions;
			counts.functionCounterparts += checkMember(member, moduleEntry.name);
		}
		for (const enumEntry of moduleEntry.enums || []) {
			++counts.enums;
			checkText(enumEntry.summary, enumEntry.name);
			counts.enumExamples += checkExamples(enumEntry, enumEntry.name);
			counts.enumCounterparts += checkCounterpart(enumEntry, enumEntry.name);
			for (const value of enumEntry.values || []) {
				++counts.enumValues;
				checkText(value.description, enumEntry.name + "." + value.name);
				counts.enumValueCounterparts += checkCounterpart(value, enumEntry.name + "." + value.name);
			}
		}
	}
	if (isDraftOnly) {
		return { errorList: errorList, counts: counts, sinceTable: sinceTable, kindTable: kindTable };
	}
	// 소스의 @exampleImage 가 모두 자료에 들었는지. (빠졌으면 공개 API 가 아닌 곳이나 초안, @example 바로 뒤가 아닌 곳에 놓였다)
	for (const sourcePath of listSourceFiles()) {
		const sourceText = fs.readFileSync(path.join(REPOSITORY_ROOT, sourcePath), "utf8");
		for (const imageMatch of sourceText.matchAll(/@exampleImage[ \t]+([^\s*]+)/g)) {
			if (!usedImageSet.has(imageMatch[1])) {
				errorList.push(sourcePath + ": @exampleImage " + imageMatch[1] + " 이 자료에 없다 (@example 바로 뒤에 둔다)");
			}
		}
	}
	// 가이드 그림. (ko 와 en 이 같은 그림을 같은 차례로 쓰고, 파일이 있어야 한다)
	const guideVersionPath = path.join(GUIDE_DIRECTORY_PATH, String(apiDocument.version));
	const readGuideImages = (language, fileName) => {
		const filePath = path.join(guideVersionPath, language, fileName);
		if (!fs.existsSync(filePath)) {
			return null;
		}
		return Array.from(fs.readFileSync(filePath, "utf8").matchAll(GUIDE_IMAGE_PATTERN), (imageMatch) => imageMatch[1]);
	};
	const koreanGuidePath = path.join(guideVersionPath, "ko");
	const guideFileList = fs.existsSync(koreanGuidePath) ? fs.readdirSync(koreanGuidePath).filter((fileName) => fileName.endsWith(".md")).sort() : [];
	for (const fileName of guideFileList) {
		const koreanImageList = readGuideImages("ko", fileName);
		const englishImageList = readGuideImages("en", fileName);
		if (englishImageList !== null && koreanImageList.join("\n") !== englishImageList.join("\n")) {
			errorList.push("가이드 " + fileName + ": ko 와 en 의 그림이 다르다 (ko " + koreanImageList.join(", ") + " / en " + englishImageList.join(", ") + ")");
		}
		for (const imageName of koreanImageList) {
			checkImage(imageName, "가이드 ko/" + fileName + " 그림");
			usedImageSet.add(imageName);
			++counts.guideImages;
		}
	}
	if (fs.existsSync(imageDirectoryPath)) {
		counts.unusedImages = fs.readdirSync(imageDirectoryPath).filter((fileName) => !fileName.startsWith(".") && !usedImageSet.has(fileName)).length;
	}
	return { errorList: errorList, counts: counts, sinceTable: sinceTable, kindTable: kindTable };
}

//==============================================================================
// 경로가 거르개에 드는지. (onlyList 가 비면 모두 들고, excludeList 에 앞부분이 맞으면 빠진다)
//==============================================================================
/**
 * @param { string } filePath
 * @param { object } options
 * @returns { boolean }
 */
function isPathSelected(filePath, options) {
	if (options.excludeList.some((prefix) => filePath.startsWith(prefix))) {
		return false;
	}
	return options.onlyList.length === 0 || options.onlyList.some((prefix) => filePath.startsWith(prefix));
}

//==============================================================================
// src 아래 모든 .js 파일. (저장소 기준 경로, 이름 차례)
//==============================================================================
/**
 * @returns { string[] }
 */
function listSourceFiles() {
	const resultList = [];
	const visit = (relativeDirectory) => {
		const entryList = fs.readdirSync(path.join(REPOSITORY_ROOT, relativeDirectory), { withFileTypes: true }).sort((first, second) => (first.name < second.name ? -1 : 1));
		for (const entry of entryList) {
			const relativePath = relativeDirectory + "/" + entry.name;
			if (entry.isDirectory()) {
				visit(relativePath);
			}
			else if (entry.name.endsWith(".js")) {
				resultList.push(relativePath);
			}
		}
	};
	visit("src");
	return resultList;
}

//==============================================================================
// 문서 빈 곳 모으기.
// - 공개 API: 빈 ko 설명(모듈, 클래스, 멤버, 매개변수, 반환, 열거), 빈 매개변수 꼴, 값을 돌려주는데 @returns 가 없는 함수, 예제 없는 클래스와 모듈.
// - src 의 모든 파일: 공개 API 가 아닌 함수와 메서드(#이름, 밑줄 이름, @private, 내보내지 않은 것) 가운데 머리 주석이 없는 것, 선언에 붙지 않은 머리 주석.
// - [{ source, kind, name, line }] (line 은 알 때만)
//==============================================================================
/**
 * @param { object } apiDocument
 * @param { object } statistics
 * @param { object } options
 * @returns { object[] }
 */
function collectGaps(apiDocument, statistics, options) {
	const gapList = [];
	const addGap = (source, kind, name, line) => {
		if (isPathSelected(source, options)) {
			gapList.push({ source: source, kind: kind, name: name, line: line || 0 });
		}
	};
	const visitMember = (source, ownerName, member) => {
		const memberName = ownerName + "." + member.name;
		if (member.description.ko === "") {
			addGap(source, "멤버 설명", memberName);
		}
		for (const parameter of member.params) {
			if (parameter.description.ko === "") {
				addGap(source, "매개변수 설명", memberName + "(" + parameter.name + ")");
			}
			if (parameter.type === "") {
				addGap(source, "매개변수 꼴", memberName + "(" + parameter.name + ")");
			}
		}
		if (member.returns && member.returns.description.ko === "" && !isValueMember(member)) {
			addGap(source, "반환 설명", memberName);
		}
	};
	const publicClassKeySet = new Set();
	for (const moduleEntry of apiDocument.modules) {
		const source = "src/" + moduleEntry.name + ".js";
		if (moduleEntry.summary.ko === "") {
			addGap(source, "모듈 요약", moduleEntry.name);
		}
		if (moduleEntry.examples === undefined && !moduleEntry.classes.some((classEntry) => classEntry.examples !== undefined)) {
			addGap(source, "예제 없는 모듈", moduleEntry.name);
		}
		for (const classEntry of moduleEntry.classes) {
			publicClassKeySet.add(source + "|" + classEntry.name);
			if (classEntry.summary.ko === "") {
				addGap(source, "클래스 요약", classEntry.name);
			}
			if (classEntry.examples === undefined) {
				addGap(source, "예제 없는 클래스", classEntry.name);
			}
			for (const member of classEntry.members) {
				visitMember(source, classEntry.name, member);
			}
		}
		for (const member of moduleEntry.functions) {
			visitMember(source, moduleEntry.name, member);
		}
		for (const enumEntry of moduleEntry.enums) {
			if (enumEntry.summary.ko === "") {
				addGap(source, "열거 요약", enumEntry.name);
			}
			for (const value of enumEntry.values) {
				if (value.description.ko === "") {
					addGap(source, "열거 값 설명", enumEntry.name + "." + value.name);
				}
			}
		}
	}
	for (const missingReturns of statistics.missingReturnsList) {
		addGap(missingReturns.source, "@returns 없음", missingReturns.name, missingReturns.line);
	}
	for (const sourcePath of listSourceFiles()) {
		if (!isPathSelected(sourcePath, options)) {
			continue;
		}
		const sourceText = fs.readFileSync(path.join(REPOSITORY_ROOT, sourcePath), "utf8");
		const parsed = parseSourceFile(sourceText);
		for (const detachedHeader of findDetachedHeaders(sourceText)) {
			addGap(sourcePath, "떨어진 머리 주석", detachedHeader.name, detachedHeader.line);
		}
		for (const declaration of parsed.declarationList) {
			if (declaration.kind === "function" && declaration.document.description === "" && !(declaration.isExported && isPublicName(declaration.exportName || declaration.name))) {
				addGap(sourcePath, "머리 주석 없는 비공개 함수", declaration.name, declaration.line);
			}
			if (declaration.kind !== "class") {
				continue;
			}
			const isPublicClass = publicClassKeySet.has(sourcePath + "|" + declaration.name);
			for (const member of declaration.memberList) {
				if (!member.isMethod || member.document.description !== "") {
					continue;
				}
				if (isPublicClass && isPublicName(member.name) && !isMarkedPrivate(member.document)) {
					continue;
				}
				addGap(sourcePath, "머리 주석 없는 비공개 함수", (declaration.name || "(이름 없는 클래스)") + "." + (member.accessor !== "" ? member.accessor + " " : "") + member.name, member.line);
			}
		}
	}
	return gapList;
}

//==============================================================================
// 선언에 붙지 않은 머리 주석 찾기. (--gaps 의 "떨어진 머리 주석")
// - 머리 주석(//==== 로 감싼 줄)과 JSDoc 다음에 선언 없이 다른 머리 주석이 오면, 함수를 옮기거나 지우고 남은 옛 덩이다.
// - 구획 머리말("멤버 변수 목록." 처럼 "목록" 으로 끝나는 한 줄)이 아닌 머리 주석 바로 뒤에 다른 머리 주석이 와도 떨어진 것이다.
//   (구획 머리말이 아닌 머리 주석은 바로 뒤 선언의 설명으로 읽히므로, 절을 나누는 머리말은 "목록" 으로 끝내거나 선언마다 제 머리 주석을 둔다)
// - [{ name, line }] (name 은 머리 주석의 첫 줄)
//==============================================================================
/**
 * @param { string } sourceText
 * @returns { object[] }
 */
function findDetachedHeaders(sourceText) {
	const tokenList = tokenize(sourceText);
	const detachedList = [];
	const isRuleLine = (token) => token !== undefined && token.type === "lineComment" && /^=+$/.test(token.value.trim());
	let tokenIndex = 0;
	while (tokenIndex < tokenList.length) {
		if (!isRuleLine(tokenList[tokenIndex])) {
			++tokenIndex;
			continue;
		}
		// 머리 주석 하나. (여는 줄, 글 줄, 닫는 줄)
		const openIndex = tokenIndex;
		let closeIndex = openIndex + 1;
		const headerLines = [];
		while (closeIndex < tokenList.length && tokenList[closeIndex].type === "lineComment" && !isRuleLine(tokenList[closeIndex])) {
			headerLines.push(tokenList[closeIndex].value.trim());
			++closeIndex;
		}
		if (!isRuleLine(tokenList[closeIndex]) || headerLines.length === 0) {
			tokenIndex = closeIndex;
			continue;
		}
		let nextIndex = closeIndex + 1;
		let hasJsdoc = false;
		const jsdocToken = tokenList[nextIndex];
		if (jsdocToken !== undefined && jsdocToken.type === "blockComment" && jsdocToken.value.startsWith("/**") && jsdocToken.line === tokenList[closeIndex].endLine + 1) {
			hasJsdoc = true;
			++nextIndex;
		}
		const nextToken = tokenList[nextIndex];
		const isAdjacent = nextToken !== undefined && nextToken.line === tokenList[nextIndex - 1].endLine + 1;
		const isFollowedByHeader = isAdjacent && (isRuleLine(nextToken) || (nextToken.type === "lineComment" && isRuleLine(tokenList[nextIndex + 1])));
		if (isFollowedByHeader && (hasJsdoc || !isSectionHeader(headerLines))) {
			detachedList.push({ name: headerLines[0], line: tokenList[openIndex].line });
		}
		tokenIndex = closeIndex + 1;
	}
	return detachedList;
}

//==============================================================================
// 빈 곳 찍기. (파일마다 갈래별로, 끝에 갈래별 합)
//==============================================================================
/**
 * @param { object[] } gapList
 */
function printGaps(gapList) {
	const fileTable = new Map();
	const kindCountTable = new Map();
	for (const gap of gapList) {
		if (!fileTable.has(gap.source)) {
			fileTable.set(gap.source, new Map());
		}
		const kindTable = fileTable.get(gap.source);
		if (!kindTable.has(gap.kind)) {
			kindTable.set(gap.kind, []);
		}
		kindTable.get(gap.kind).push(gap.line > 0 ? gap.name + ":" + gap.line : gap.name);
		kindCountTable.set(gap.kind, (kindCountTable.get(gap.kind) || 0) + 1);
	}
	for (const [source, kindTable] of fileTable) {
		let fileCount = 0;
		for (const nameList of kindTable.values()) {
			fileCount += nameList.length;
		}
		console.log(source + " (" + fileCount + ")");
		for (const [kind, nameList] of kindTable) {
			console.log("  " + kind + " " + nameList.length + ": " + nameList.join(", "));
		}
	}
	console.log("[apidoc] 빈 곳 " + gapList.length + " 개, 파일 " + fileTable.size + " 개" + (gapList.length > 0 ? ": " + Array.from(kindCountTable).map((entry) => entry[0] + " " + entry[1]).join(", ") : ""));
}

//==============================================================================
// 예제 모으기.
// - 공개 API 의 @example 과 가이드(docs/guide/<버전>/<언어>/*.md)의 javascript, js, html 코드 칸.
// - [{ source, where, title, code, page, kind: "api" | "guide", language }] (page 는 html 칸의 원문, code 는 그 안의 모듈 스크립트)
//==============================================================================
/**
 * @param { object } apiDocument
 * @param { object } options
 * @returns { object[] }
 */
function collectExamples(apiDocument, options) {
	const exampleList = [];
	const addApiExamples = (source, where, owner) => {
		for (const example of owner.examples || []) {
			exampleList.push({ source: source, where: where, title: example.title.ko, code: example.code, page: "", kind: "api", language: "" });
		}
	};
	for (const moduleEntry of apiDocument.modules) {
		const source = "src/" + moduleEntry.name + ".js";
		if (!isPathSelected(source, options)) {
			continue;
		}
		addApiExamples(source, moduleEntry.name, moduleEntry);
		for (const classEntry of moduleEntry.classes) {
			addApiExamples(source, classEntry.name, classEntry);
			for (const member of classEntry.members) {
				addApiExamples(source, classEntry.name + "." + member.name, member);
			}
		}
		for (const member of moduleEntry.functions) {
			addApiExamples(source, moduleEntry.name + "." + member.name, member);
		}
		for (const enumEntry of moduleEntry.enums) {
			addApiExamples(source, enumEntry.name, enumEntry);
		}
	}
	const guideDirectoryPath = path.join(REPOSITORY_ROOT, "docs", "guide", apiDocument.version);
	if (fs.existsSync(guideDirectoryPath)) {
		for (const language of fs.readdirSync(guideDirectoryPath).sort()) {
			const languageDirectoryPath = path.join(guideDirectoryPath, language);
			if (!fs.statSync(languageDirectoryPath).isDirectory()) {
				continue;
			}
			for (const fileName of fs.readdirSync(languageDirectoryPath).filter((name) => name.endsWith(".md")).sort()) {
				const source = "docs/guide/" + apiDocument.version + "/" + language + "/" + fileName;
				if (!isPathSelected(source, options)) {
					continue;
				}
				for (const block of readCodeBlocks(fs.readFileSync(path.join(languageDirectoryPath, fileName), "utf8"))) {
					if (block.language === "html") {
						const scriptList = [];
						const scriptPattern = /<script\s+type=["']module["'][^>]*>([\s\S]*?)<\/script>/g;
						let scriptMatch = scriptPattern.exec(block.code);
						while (scriptMatch) {
							scriptList.push(scriptMatch[1]);
							scriptMatch = scriptPattern.exec(block.code);
						}
						if (scriptList.length === 0) {
							continue;
						}
						exampleList.push({ source: source, where: fileName + ":" + block.line, title: "", code: scriptList.join("\n"), page: block.code, kind: "guide", language: language });
					}
					else {
						exampleList.push({ source: source, where: fileName + ":" + block.line, title: "", code: block.code, page: "", kind: "guide", language: language });
					}
				}
			}
		}
	}
	return exampleList;
}

//==============================================================================
// 마크다운의 코드 칸 읽기. ([{ language, code, line }], javascript 와 js 는 javascript 로, html 만 따로, 그 밖은 뺀다)
//==============================================================================
/**
 * @param { string } markdownText
 * @returns { object[] }
 */
function readCodeBlocks(markdownText) {
	const blockList = [];
	const lineList = markdownText.split("\n");
	let lineIndex = 0;
	while (lineIndex < lineList.length) {
		const fenceMatch = /^(\s*)```\s*([A-Za-z]*)/.exec(lineList[lineIndex]);
		if (!fenceMatch) {
			++lineIndex;
			continue;
		}
		const startLine = lineIndex + 1;
		const codeLineList = [];
		++lineIndex;
		while (lineIndex < lineList.length && !/^\s*```\s*$/.test(lineList[lineIndex])) {
			codeLineList.push(lineList[lineIndex]);
			++lineIndex;
		}
		++lineIndex;
		const language = fenceMatch[2].toLowerCase();
		if (language === "javascript" || language === "js") {
			blockList.push({ language: "javascript", code: codeLineList.join("\n"), line: startLine });
		}
		else if (language === "html") {
			blockList.push({ language: "html", code: codeLineList.join("\n"), line: startLine });
		}
	}
	return blockList;
}

//==============================================================================
// 엔진을 부르는 모듈 이름인지. (./build/vanilla.js, vanilla.min.js, import.js 처럼 끝 이름으로 본다)
//==============================================================================
/**
 * @param { string } specifier
 * @returns { boolean }
 */
function isEngineSpecifier(specifier) {
	return /(^|\/)(vanilla(\.min)?\.js|import\.js)$/.test(specifier);
}

//==============================================================================
// 초안 진입점을 부르는 모듈 이름인지. (./src/experimental/experimental.js 처럼 끝 이름으로 본다)
//==============================================================================
/**
 * @param { string } specifier
 * @returns { boolean }
 */
function isDraftSpecifier(specifier) {
	return /(^|\/)experimental\/experimental\.js$/.test(specifier);
}

//==============================================================================
// 예제의 import 읽기.
// - { importList: [{ localName, exportName, isNamespace, isDraft }], foreignList: [모듈 이름], strippedCode }
// - strippedCode 는 엔진 import 를 const { ... } = __engine; 으로, 초안 진입점 import 를 const { ... } = __engine.Experimental; 으로 바꾼 글이다. (줄 수는 그대로)
//==============================================================================
/**
 * @param { string } code
 * @returns { object }
 */
function readExampleImports(code) {
	const importList = [];
	const foreignList = [];
	const importPattern = /\bimport\s*(\{[^}]*\}|\*\s*as\s+[A-Za-z_$][\w$]*)\s*from\s*(["'])([^"']+)\2\s*;?/g;
	const strippedCode = code.replace(importPattern, (matchText, clauseText, quote, specifier) => {
		const newlineText = "\n".repeat((matchText.match(/\n/g) || []).length);
		const isDraft = isDraftSpecifier(specifier);
		if (!isDraft && !isEngineSpecifier(specifier)) {
			foreignList.push(specifier);
			return matchText;
		}
		const sourceName = isDraft ? "__engine." + DRAFT_NAMESPACE_NAME : "__engine";
		if (clauseText.startsWith("*")) {
			const localName = clauseText.replace(/^\*\s*as\s+/, "").trim();
			importList.push({ localName: localName, exportName: "*", isNamespace: true, isDraft: isDraft });
			return "const " + localName + " = " + sourceName + ";" + newlineText;
		}
		const bindingList = [];
		for (const specifierText of clauseText.slice(1, -1).split(",")) {
			const parts = specifierText.trim().split(/\s+as\s+/);
			if (parts[0] === "") {
				continue;
			}
			const exportName = parts[0].trim();
			const localName = (parts[1] || parts[0]).trim();
			importList.push({ localName: localName, exportName: exportName, isNamespace: false, isDraft: isDraft });
			bindingList.push(exportName === localName ? exportName : exportName + ": " + localName);
		}
		return "const { " + bindingList.join(", ") + " } = " + sourceName + ";" + newlineText;
	});
	return { importList: importList, foreignList: foreignList, strippedCode: strippedCode };
}

//==============================================================================
// 클래스 인스턴스가 가진 이름 표 짓기. (프로토타입 사슬의 메서드와 접근자, 문서의 필드, 생성자가 this 에 넣는 이름)
//==============================================================================
/**
 * @param { Function } classValue
 * @param { Map<string, Set<string>> } classFieldTable
 * @returns { Set<string> }
 */
function readInstanceNames(classValue, classFieldTable) {
	const nameSet = new Set();
	let prototype = classValue.prototype;
	while (prototype) {
		for (const name of Object.getOwnPropertyNames(prototype)) {
			nameSet.add(name);
		}
		const constructorFunction = prototype.constructor;
		if (constructorFunction && classFieldTable.has(constructorFunction.name)) {
			for (const name of classFieldTable.get(constructorFunction.name)) {
				nameSet.add(name);
			}
		}
		prototype = Object.getPrototypeOf(prototype);
	}
	return nameSet;
}

//==============================================================================
// 예제 하나의 이름 검사. (오류 글 목록)
// - 엔진에서 불러온 이름이 엔진에 있는지, 불러온이름.멤버 가 있는지.
// - const 이름 = new 클래스(...) 나 const 이름 = 클래스.정적함수(...) (돌려주는 꼴이 엔진 클래스일 때) 로 만든 이름의 이름.멤버 가 그 클래스에 있는지.
//==============================================================================
/**
 * @param { object } example
 * @param { object } engineModule
 * @param { object } draftModule 초안 진입점 모듈.
 * @param { object } nameContext { classFieldTable, staticReturnTable }
 * @returns { string[] }
 */
function checkExampleNames(example, engineModule, draftModule, nameContext) {
	const errorList = [];
	const importResult = readExampleImports(example.code);
	for (const foreignSpecifier of importResult.foreignList) {
		errorList.push("엔진 밖 모듈을 불러온다: " + foreignSpecifier);
	}
	const bindingTable = new Map();
	// 클래스 이름으로 찾는 표. (엔진과 초안의 이름이 겹치지 않는다)
	const classModule = Object.assign({}, draftModule, engineModule);
	for (const importEntry of importResult.importList) {
		const sourceModule = importEntry.isDraft ? draftModule : engineModule;
		if (importEntry.isNamespace) {
			bindingTable.set(importEntry.localName, { value: sourceModule, name: "*" });
			continue;
		}
		if (!Object.prototype.hasOwnProperty.call(sourceModule, importEntry.exportName)) {
			errorList.push((importEntry.isDraft ? "초안에 없는 이름을 불러온다: " : "엔진에 없는 이름을 불러온다: ") + importEntry.exportName);
			continue;
		}
		bindingTable.set(importEntry.localName, { value: sourceModule[importEntry.exportName], name: importEntry.exportName });
	}
	const tokenList = tokenize(importResult.strippedCode).filter((token) => !isComment(token));
	const instanceTable = new Map();
	for (let tokenIndex = 0; tokenIndex < tokenList.length; ++tokenIndex) {
		const token = tokenList[tokenIndex];
		const previousToken = tokenList[tokenIndex - 1];
		const isMemberAccess = previousToken && previousToken.type === "punctuator" && (previousToken.value === "." || previousToken.value === "?.");
		if (token.type !== "identifier" || isMemberAccess) {
			continue;
		}
		if ((token.value === "const" || token.value === "let" || token.value === "var") && tokenList[tokenIndex + 1] && tokenList[tokenIndex + 1].type === "identifier" && tokenList[tokenIndex + 2] && tokenList[tokenIndex + 2].value === "=") {
			let valueIndex = tokenIndex + 3;
			if (tokenList[valueIndex] && tokenList[valueIndex].value === "await") {
				++valueIndex;
			}
			const valueToken = tokenList[valueIndex];
			const nameToken = tokenList[valueIndex + 1];
			// 부른 뒤에 이어 부르지 않을 때만 꼴을 안다. (new 클래스(...).멤버() 나 클래스.정적함수(...).멤버() 의 사슬은 모른다)
			const isCallEndingStatement = (openIndex) => {
				if (!tokenList[openIndex] || tokenList[openIndex].value !== "(") {
					return false;
				}
				const closeIndex = findMatchingIndex(tokenList, openIndex);
				const afterToken = tokenList[closeIndex + 1];
				return !afterToken || afterToken.value === ";" || afterToken.line > tokenList[closeIndex].endLine && afterToken.value !== "." && afterToken.value !== "?.";
			};
			if (valueToken && valueToken.value === "new" && nameToken && bindingTable.has(nameToken.value) && typeof bindingTable.get(nameToken.value).value === "function" && isCallEndingStatement(valueIndex + 2)) {
				instanceTable.set(tokenList[tokenIndex + 1].value, bindingTable.get(nameToken.value).name);
			}
			else if (valueToken && bindingTable.has(valueToken.value) && nameToken && nameToken.value === "." && tokenList[valueIndex + 2] && isCallEndingStatement(valueIndex + 3)) {
				const returnClassName = nameContext.staticReturnTable.get(bindingTable.get(valueToken.value).name + "." + tokenList[valueIndex + 2].value);
				if (returnClassName && typeof classModule[returnClassName] === "function") {
					instanceTable.set(tokenList[tokenIndex + 1].value, returnClassName);
				}
			}
		}
		const dotToken = tokenList[tokenIndex + 1];
		const memberToken = tokenList[tokenIndex + 2];
		if (!dotToken || dotToken.value !== "." || !memberToken || memberToken.type !== "identifier") {
			continue;
		}
		if (bindingTable.has(token.value)) {
			const binding = bindingTable.get(token.value);
			if (binding.value !== null && binding.value !== undefined && (typeof binding.value === "object" || typeof binding.value === "function") && !(memberToken.value in binding.value)) {
				errorList.push("엔진에 없는 이름: " + (binding.name === "*" ? token.value : binding.name) + "." + memberToken.value);
			}
		}
		else if (instanceTable.has(token.value)) {
			const className = instanceTable.get(token.value);
			const instanceNameSet = readInstanceNames(classModule[className], nameContext.classFieldTable);
			if (!instanceNameSet.has(memberToken.value)) {
				errorList.push("엔진에 없는 이름: " + className + " 인스턴스의 " + memberToken.value + " (" + token.value + "." + memberToken.value + ")");
			}
		}
	}
	return errorList;
}

//==============================================================================
// 이름 검사에 쓸 표 짓기.
// - classFieldTable: 클래스 이름 → 필드와 생성자가 this 에 넣는 이름. (src 의 모든 클래스)
// - staticReturnTable: "클래스.정적함수" → 돌려주는 엔진 클래스 이름. (@returns 꼴이 클래스 이름이나 this 하나일 때)
//==============================================================================
/**
 * @param { object } apiDocument
 * @returns { object }
 */
function buildNameContext(apiDocument) {
	const classFieldTable = new Map();
	for (const sourcePath of listSourceFiles()) {
		const parsed = parseSourceFile(fs.readFileSync(path.join(REPOSITORY_ROOT, sourcePath), "utf8"));
		for (const declaration of parsed.declarationList) {
			if (declaration.kind !== "class" || declaration.name === "") {
				continue;
			}
			const nameSet = classFieldTable.get(declaration.name) || new Set();
			for (const member of declaration.memberList) {
				if (!member.isMethod) {
					nameSet.add(member.name);
				}
				for (const assignedName of member.assignedNameList) {
					nameSet.add(assignedName);
				}
			}
			classFieldTable.set(declaration.name, nameSet);
		}
	}
	const staticReturnTable = new Map();
	for (const moduleEntry of apiDocument.modules) {
		for (const classEntry of moduleEntry.classes) {
			for (const member of classEntry.members) {
				if (member.kind !== "static" || !member.returns) {
					continue;
				}
				const typeText = member.returns.type.replace(/\s*\|\s*null\b/g, "").trim();
				staticReturnTable.set(classEntry.name + "." + member.name, typeText === "this" ? classEntry.name : typeText);
			}
		}
	}
	return { classFieldTable: classFieldTable, staticReturnTable: staticReturnTable };
}

//==============================================================================
// 여러 일을 정한 수만큼 겹쳐 돌리기.
//==============================================================================
/**
 * @param { any[] } itemList
 * @param { number } limit
 * @param { Function } runItem async (item, index) => void
 * @returns { Promise<void> }
 */
async function runWithConcurrency(itemList, limit, runItem) {
	let nextIndex = 0;
	const runnerList = [];
	for (let runnerIndex = 0; runnerIndex < Math.min(limit, itemList.length); ++runnerIndex) {
		runnerList.push((async () => {
			while (nextIndex < itemList.length) {
				const itemIndex = nextIndex;
				++nextIndex;
				await runItem(itemList[itemIndex], itemIndex);
			}
		})());
	}
	await Promise.all(runnerList);
}

//==============================================================================
// node 워커로 예제 하나 돌리기. (오류 글 목록, 빈 배열이면 통과)
// - 엔진 import 를 import.js 의 파일 주소로 바꾼 .mjs 를 임시 폴더에 쓰고 워커에서 불러온다. (워커마다 엔진 모듈이 새로 읽힌다)
// - 모듈이 다 돈 뒤 잠깐 더 기다려 늦게 난 오류와 console.error 도 잡는다. 시간 안에 끝나지 않으면 오류다.
//==============================================================================
/**
 * @param { object } example
 * @param { string } temporaryDirectoryPath
 * @param { number } exampleIndex
 * @returns { Promise<string[]> }
 */
function runExampleInNode(example, temporaryDirectoryPath, exampleIndex) {
	const { Worker } = require("worker_threads");
	const { pathToFileURL } = require("url");
	const engineUrl = pathToFileURL(ENTRY_FILE_PATH).href;
	const modulePath = path.join(temporaryDirectoryPath, "example-" + exampleIndex + ".mjs");
	fs.writeFileSync(modulePath, rewriteEngineSpecifier(example.code, engineUrl));
	const workerSource = [
		"const { parentPort, workerData } = require(\"worker_threads\");",
		"const errorList = [];",
		"console.error = (...argumentList) => { errorList.push(\"console.error: \" + argumentList.map(String).join(\" \")); };",
		"process.on(\"unhandledRejection\", (reason) => { errorList.push(\"unhandledRejection: \" + ((reason && reason.stack) || String(reason))); });",
		"import(workerData.moduleUrl).then(() => {",
		"	setTimeout(() => parentPort.postMessage(errorList), workerData.settleMilliseconds);",
		"}, (error) => {",
		"	errorList.push((error && error.stack) || String(error));",
		"	parentPort.postMessage(errorList);",
		"});",
	].join("\n");
	return new Promise((resolve) => {
		const worker = new Worker(workerSource, { eval: true, workerData: { moduleUrl: pathToFileURL(modulePath).href, settleMilliseconds: EXAMPLE_NODE_SETTLE_MILLISECONDS }, stdout: true, stderr: true });
		let isFinished = false;
		const finish = (errorList) => {
			if (isFinished) {
				return;
			}
			isFinished = true;
			clearTimeout(timeoutHandle);
			worker.terminate();
			resolve(errorList);
		};
		const timeoutHandle = setTimeout(() => finish(["시간 안에 끝나지 않음 (" + EXAMPLE_NODE_TIMEOUT_MILLISECONDS + " ms)"]), EXAMPLE_NODE_TIMEOUT_MILLISECONDS);
		worker.stdout.resume();
		worker.stderr.resume();
		worker.on("message", (errorList) => finish(errorList));
		worker.on("error", (error) => finish([(error && error.stack) || String(error)]));
		worker.on("exit", () => finish(["워커가 결과 없이 끝남"]));
	});
}

//==============================================================================
// 엔진 import 의 모듈 이름 바꾸기.
//==============================================================================
/**
 * @param { string } code
 * @param { string } engineUrl
 * @returns { string }
 */
function rewriteEngineSpecifier(code, engineUrl) {
	const draftUrl = engineUrl.replace(/import\.js$/, DRAFT_ENTRY_MODULE_PATH);
	return code.replace(/(\bfrom\s*)(["'])([^"']+)\2/g, (matchText, fromText, quote, specifier) => {
		if (isDraftSpecifier(specifier)) {
			return fromText + "\"" + draftUrl + "\"";
		}
		return isEngineSpecifier(specifier) ? fromText + "\"" + engineUrl + "\"" : matchText;
	});
}

//==============================================================================
// 크롬 경로 찾기. (--chrome, 환경 변수 CHROME_PATH, 흔한 설치 자리 차례로, 없으면 "")
//==============================================================================
/**
 * @param { string } chromePathOption
 * @returns { string }
 */
function findChromePath(chromePathOption) {
	const candidateList = [chromePathOption, process.env.CHROME_PATH || "", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"];
	return candidateList.find((candidatePath) => candidatePath !== "" && fs.existsSync(candidatePath)) || "";
}

//==============================================================================
// 예제 하나를 iframe 에 넣을 html 로. (오류와 console.error 를 부모에게 보내고, 모듈 끝에서 done 을 보낸다)
//==============================================================================
/**
 * @param { object } example
 * @param { string } engineUrl
 * @param { number } exampleIndex
 * @returns { string }
 */
function buildExamplePage(example, engineUrl, exampleIndex) {
	const hookScript = [
		"<script>",
		"const __exampleIndex = " + exampleIndex + ";",
		"const __postExample = (type, text) => parent.postMessage({ index: __exampleIndex, type: type, text: String(text) }, \"*\");",
		"addEventListener(\"error\", (event) => __postExample(\"error\", (event.message || \"error\") + (event.filename ? \" (\" + event.filename + \":\" + event.lineno + \")\" : \"\")));",
		"addEventListener(\"unhandledrejection\", (event) => __postExample(\"error\", \"unhandledrejection: \" + ((event.reason && event.reason.stack) || event.reason)));",
		"const __consoleError = console.error.bind(console);",
		"console.error = (...argumentList) => { __postExample(\"error\", \"console.error: \" + argumentList.map(String).join(\" \")); __consoleError(...argumentList); };",
		"</script>",
	].join("\n");
	const doneText = "\n__postExample(\"done\", \"\");\n";
	if (example.page !== "") {
		let pageText = example.page.replace(/(<script\s+type=["']module["'][^>]*>)([\s\S]*?)(<\/script>)/g, (matchText, openText, scriptText, closeText) => openText + rewriteEngineSpecifier(scriptText, engineUrl) + doneText + closeText);
		if (/<head[^>]*>/i.test(pageText)) {
			pageText = pageText.replace(/<head[^>]*>/i, (headText) => headText + hookScript);
		}
		else {
			pageText = hookScript + pageText;
		}
		return pageText;
	}
	return "<!DOCTYPE html><html><head><meta charset=\"utf-8\">" + hookScript + "</head><body style=\"margin:0\"><script type=\"module\">\n" + rewriteEngineSpecifier(example.code, engineUrl).replace(/<\/script/gi, "<\\/script") + doneText + "</script></body></html>";
}

//==============================================================================
// 헤드리스 크롬으로 예제들 돌리기. ([오류 글 목록] 을 예제 차례대로)
// - 노드 내장 http 로 저장소를 루트로 하는 정적 서버를 띄우고, 실행 페이지가 예제마다 iframe 을 만들어 몇 개씩 겹쳐 돌린 뒤 결과를 POST 로 돌려준다.
// - 크롬은 하나만, 창 없이(--headless=new), 임시 프로필로 띄우고 결과를 받으면 바로 끈다.
//==============================================================================
/**
 * @param { object[] } exampleList
 * @param { string } chromePath
 * @returns { Promise<string[][]> }
 */
function runExamplesInChrome(exampleList, chromePath) {
	const http = require("http");
	const os = require("os");
	const contentTypeTable = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".glb": "model/gltf-binary", ".gltf": "model/gltf+json", ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".webm": "audio/webm", ".wasm": "application/wasm" };
	const runnerScript = [
		"const SETTLE_MILLISECONDS = " + EXAMPLE_CHROME_SETTLE_MILLISECONDS + ";",
		"const TIMEOUT_MILLISECONDS = " + EXAMPLE_CHROME_TIMEOUT_MILLISECONDS + ";",
		"const CONCURRENCY = " + EXAMPLE_CHROME_CONCURRENCY + ";",
		"const runExample = (example) => new Promise((resolve) => {",
		"	const iframe = document.createElement(\"iframe\");",
		"	iframe.width = \"640\";",
		"	iframe.height = \"360\";",
		"	iframe.style.position = \"absolute\";",
		"	iframe.style.left = \"0\";",
		"	iframe.style.top = \"0\";",
		"	const errorList = [];",
		"	let isDone = false;",
		"	let isFinished = false;",
		"	let settleHandle = 0;",
		"	const finish = () => {",
		"		if (isFinished) {",
		"			return;",
		"		}",
		"		isFinished = true;",
		"		clearTimeout(timeoutHandle);",
		"		clearTimeout(settleHandle);",
		"		removeEventListener(\"message\", onMessage);",
		"		iframe.remove();",
		"		resolve({ index: example.index, errorList: errorList });",
		"	};",
		"	const onMessage = (event) => {",
		"		if (!event.data || event.data.index !== example.index) {",
		"			return;",
		"		}",
		"		if (event.data.type === \"error\") {",
		"			errorList.push(event.data.text);",
		"			if (!isDone && settleHandle === 0) {",
		"				settleHandle = setTimeout(finish, SETTLE_MILLISECONDS);",
		"			}",
		"		}",
		"		else if (event.data.type === \"done\") {",
		"			isDone = true;",
		"			clearTimeout(settleHandle);",
		"			settleHandle = setTimeout(finish, SETTLE_MILLISECONDS);",
		"		}",
		"	};",
		"	addEventListener(\"message\", onMessage);",
		"	const timeoutHandle = setTimeout(() => {",
		"		if (!isDone) {",
		"			errorList.push(\"시간 안에 끝나지 않음 (\" + TIMEOUT_MILLISECONDS + \" ms)\");",
		"		}",
		"		finish();",
		"	}, TIMEOUT_MILLISECONDS);",
		"	iframe.srcdoc = example.page;",
		"	document.body.appendChild(iframe);",
		"});",
		"(async () => {",
		"	const exampleList = await (await fetch(\"/__examples.json\")).json();",
		"	const resultList = [];",
		"	let nextIndex = 0;",
		"	const runnerList = [];",
		"	for (let runnerIndex = 0; runnerIndex < CONCURRENCY; ++runnerIndex) {",
		"		runnerList.push((async () => {",
		"			while (nextIndex < exampleList.length) {",
		"				const example = exampleList[nextIndex];",
		"				++nextIndex;",
		"				resultList.push(await runExample(example));",
		"			}",
		"		})());",
		"	}",
		"	await Promise.all(runnerList);",
		"	await fetch(\"/__result\", { method: \"POST\", body: JSON.stringify(resultList) });",
		"})();",
	].join("\n");
	return new Promise((resolve, reject) => {
		let chromeProcess = null;
		let profileDirectoryPath = "";
		let overallHandle = 0;
		const server = http.createServer((request, response) => {
			const requestPath = decodeURIComponent(request.url.split("?")[0]);
			if (request.method === "POST" && requestPath === "/__result") {
				const chunkList = [];
				request.on("data", (chunk) => chunkList.push(chunk));
				request.on("end", () => {
					response.writeHead(200);
					response.end();
					const resultList = JSON.parse(Buffer.concat(chunkList).toString("utf8"));
					const errorTable = exampleList.map(() => ["결과 없음"]);
					for (const result of resultList) {
						errorTable[result.index] = result.errorList;
					}
					cleanUp();
					resolve(errorTable);
				});
				return;
			}
			if (requestPath === "/__runner.html") {
				response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
				response.end("<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head><body><script type=\"module\">\n" + runnerScript + "\n</script></body></html>");
				return;
			}
			if (requestPath === "/__examples.json") {
				const engineUrl = "http://127.0.0.1:" + server.address().port + "/import.js";
				response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
				response.end(JSON.stringify(exampleList.map((example, exampleIndex) => ({ index: exampleIndex, page: buildExamplePage(example, engineUrl, exampleIndex) }))));
				return;
			}
			const filePath = path.join(REPOSITORY_ROOT, requestPath);
			if (!filePath.startsWith(REPOSITORY_ROOT + path.sep)) {
				response.writeHead(403);
				response.end();
				return;
			}
			fs.readFile(filePath, (error, data) => {
				if (error) {
					response.writeHead(404);
					response.end();
					return;
				}
				response.writeHead(200, { "Content-Type": contentTypeTable[path.extname(filePath).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
				response.end(data);
			});
		});
		// 끊겨도 크롬이 남지 않게 신호를 받으면 치우고 끝낸다.
		const onSignal = () => {
			cleanUp();
			process.exit(1);
		};
		const cleanUp = () => {
			clearTimeout(overallHandle);
			process.removeListener("SIGINT", onSignal);
			process.removeListener("SIGTERM", onSignal);
			if (chromeProcess && chromeProcess.exitCode === null) {
				chromeProcess.kill("SIGKILL");
			}
			server.close();
			if (profileDirectoryPath !== "") {
				fs.rmSync(profileDirectoryPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
				profileDirectoryPath = "";
			}
		};
		process.once("SIGINT", onSignal);
		process.once("SIGTERM", onSignal);
		server.listen(0, "127.0.0.1", () => {
			profileDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "apidoc-chrome-"));
			const runnerUrl = "http://127.0.0.1:" + server.address().port + "/__runner.html";
			chromeProcess = childProcess.spawn(chromePath, ["--headless=new", "--user-data-dir=" + profileDirectoryPath, "--no-first-run", "--no-default-browser-check", "--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required", "--mute-audio", "--window-size=1280,720", runnerUrl], { stdio: "ignore" });
			chromeProcess.on("error", (error) => {
				cleanUp();
				reject(error);
			});
			const overallMilliseconds = 60000 + exampleList.length * EXAMPLE_CHROME_TIMEOUT_MILLISECONDS / EXAMPLE_CHROME_CONCURRENCY;
			overallHandle = setTimeout(() => {
				cleanUp();
				reject(new Error("크롬이 " + overallMilliseconds + " ms 안에 결과를 돌려주지 않았다"));
			}, overallMilliseconds);
		});
	});
}

//==============================================================================
// 예제 검사.
// - 모든 예제: 공개 API 예제와 en 가이드 예제에 한글이 없는지, 문법(모듈로 읽힘), 엔진 이름이 실제로 있는지.
// - --no-run 이 아니면 node 워커로 돌려 보고, node 에서 오류가 난 것(DOM, WebGL, 소리 같은 브라우저 기능)과 html 칸은 헤드리스 크롬으로 돌린다.
// - 크롬이 없거나 --no-chrome 이면 크롬 단계는 건너뛰고 "돌리지 못함" 으로 센다. (실패로 치지 않는다)
// - 통과하면 참.
//==============================================================================
/**
 * @param { object } apiDocument
 * @param { object } options
 * @returns { Promise<boolean> }
 */
async function checkExamples(apiDocument, options) {
	const { pathToFileURL } = require("url");
	const os = require("os");
	const exampleList = collectExamples(apiDocument, options);
	const engineModule = await import(pathToFileURL(ENTRY_FILE_PATH).href);
	const draftModule = await import(pathToFileURL(path.join(REPOSITORY_ROOT, DRAFT_ENTRY_MODULE_PATH)).href);
	const nameContext = buildNameContext(apiDocument);
	const AsyncFunction = (async () => {}).constructor;
	const stateList = exampleList.map(() => ({ staticErrorList: [], runErrorList: [], ranIn: "" }));
	exampleList.forEach((example, exampleIndex) => {
		const state = stateList[exampleIndex];
		if ((example.kind === "api" || example.language === "en") && HANGUL_PATTERN.test(example.code)) {
			state.staticErrorList.push("예제 코드에 한글이 있다 (설명은 <caption> 제목으로, 영어는 번역 표로)");
		}
		const importResult = readExampleImports(example.code);
		try {
			new AsyncFunction("__engine", "\"use strict\";\n" + importResult.strippedCode);
		}
		catch (error) {
			state.staticErrorList.push("문법: " + error.message);
			return;
		}
		for (const errorText of checkExampleNames(example, engineModule, draftModule, nameContext)) {
			state.staticErrorList.push(errorText);
		}
	});
	let nodePassCount = 0;
	let chromePassCount = 0;
	let notRunCount = 0;
	let chromeMessage = "";
	if (options.isRunEnabled) {
		const runnableIndexList = [];
		stateList.forEach((state, exampleIndex) => {
			if (state.staticErrorList.length === 0) {
				runnableIndexList.push(exampleIndex);
			}
		});
		const temporaryDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "apidoc-examples-"));
		const chromeIndexList = [];
		try {
			await runWithConcurrency(runnableIndexList.filter((exampleIndex) => exampleList[exampleIndex].page === ""), Math.max(1, Math.min(EXAMPLE_NODE_CONCURRENCY, os.cpus().length - 2)), async (exampleIndex) => {
				const errorList = await runExampleInNode(exampleList[exampleIndex], temporaryDirectoryPath, exampleIndex);
				if (errorList.length === 0) {
					stateList[exampleIndex].ranIn = "node";
					++nodePassCount;
				}
				else {
					stateList[exampleIndex].runErrorList = errorList.map((errorText) => "node: " + errorText.split("\n")[0]);
					chromeIndexList.push(exampleIndex);
				}
			});
		}
		finally {
			fs.rmSync(temporaryDirectoryPath, { recursive: true, force: true });
		}
		for (const exampleIndex of runnableIndexList) {
			if (exampleList[exampleIndex].page !== "") {
				chromeIndexList.push(exampleIndex);
			}
		}
		chromeIndexList.sort((first, second) => first - second);
		const chromePath = options.isChromeEnabled ? findChromePath(options.chromePath) : "";
		if (chromeIndexList.length > 0 && chromePath !== "") {
			const chromeErrorTable = await runExamplesInChrome(chromeIndexList.map((exampleIndex) => exampleList[exampleIndex]), chromePath);
			chromeIndexList.forEach((exampleIndex, chromeIndex) => {
				const errorList = chromeErrorTable[chromeIndex];
				if (errorList.length === 0) {
					stateList[exampleIndex].ranIn = "chrome";
					stateList[exampleIndex].runErrorList = [];
					++chromePassCount;
				}
				else {
					stateList[exampleIndex].runErrorList = stateList[exampleIndex].runErrorList.concat(errorList.map((errorText) => "chrome: " + errorText.split("\n")[0]));
				}
			});
		}
		else if (chromeIndexList.length > 0) {
			chromeMessage = options.isChromeEnabled ? "크롬을 찾지 못해 크롬 단계를 건너뜀 (--chrome 이나 CHROME_PATH 로 정한다)" : "--no-chrome 이라 크롬 단계를 건너뜀";
			for (const exampleIndex of chromeIndexList) {
				stateList[exampleIndex].runErrorList = [];
				stateList[exampleIndex].ranIn = "skipped";
				++notRunCount;
			}
		}
	}
	let failureCount = 0;
	stateList.forEach((state, exampleIndex) => {
		const errorList = state.staticErrorList.concat(state.runErrorList);
		if (errorList.length === 0) {
			return;
		}
		++failureCount;
		const example = exampleList[exampleIndex];
		console.log("[apidoc] 예제 실패: " + example.source + " " + example.where + (example.title !== "" ? " (" + example.title + ")" : ""));
		for (const errorText of errorList.slice(0, 6)) {
			console.log("  " + errorText);
		}
	});
	const apiCount = exampleList.filter((example) => example.kind === "api").length;
	console.log("[apidoc] 예제 " + exampleList.length + " 개 (API " + apiCount + ", 가이드 " + (exampleList.length - apiCount) + "), 문법과 이름 통과 " + stateList.filter((state) => state.staticErrorList.length === 0).length);
	if (options.isRunEnabled) {
		console.log("[apidoc] 돌려 봄: node 통과 " + nodePassCount + ", 크롬 통과 " + chromePassCount + ", 돌리지 못함 " + notRunCount);
	}
	if (chromeMessage !== "") {
		console.log("[apidoc] " + chromeMessage);
	}
	console.log("[apidoc] 예제 실패 " + failureCount + " 개");
	return failureCount === 0;
}

//==============================================================================
// 명령 줄 읽기. ({ version, mode, dateOption, onlyList, excludeList, isRunEnabled, isChromeEnabled, chromePath })
//==============================================================================
/**
 * @param { string[] } argumentList
 * @returns { object | null }
 */
function readArguments(argumentList) {
	const options = { version: "", mode: "write", dateOption: "", counterpartPath: "", onlyList: [], excludeList: [], isRunEnabled: true, isChromeEnabled: true, chromePath: "" };
	for (let argumentIndex = 0; argumentIndex < argumentList.length; ++argumentIndex) {
		const argument = argumentList[argumentIndex];
		if (argument === "--missing") {
			options.mode = "missing";
		}
		else if (argument === "--check") {
			options.mode = "check";
		}
		else if (argument === "--gaps") {
			options.mode = "gaps";
		}
		else if (argument === "--check-examples") {
			options.mode = "examples";
		}
		else if (argument === "--no-run") {
			options.isRunEnabled = false;
		}
		else if (argument === "--no-chrome") {
			options.isChromeEnabled = false;
		}
		else if (argument === "--counterpart") {
			options.counterpartPath = argumentList[argumentIndex + 1] || "";
			argumentIndex += 1;
			if (options.counterpartPath === "") {
				return null;
			}
		}
		else if (argument === "--only" || argument === "--exclude" || argument === "--chrome") {
			const value = argumentList[argumentIndex + 1] || "";
			argumentIndex += 1;
			if (value === "") {
				return null;
			}
			if (argument === "--only") {
				options.onlyList.push(value);
			}
			else if (argument === "--exclude") {
				options.excludeList.push(value);
			}
			else {
				options.chromePath = value;
			}
		}
		else if (argument === "--date") {
			options.dateOption = argumentList[argumentIndex + 1] || "";
			argumentIndex += 1;
			if (!/^\d{4}-\d{2}-\d{2}$/.test(options.dateOption)) {
				return null;
			}
		}
		else if (/^\d+\.\d+\.\d+$/.test(argument)) {
			options.version = argument;
		}
		else {
			return null;
		}
	}
	return options.version === "" ? null : options;
}

//==============================================================================
// 검사 결과 찍기.
//==============================================================================
/**
 * @param { object } checkResult
 */
function printCheckResult(checkResult) {
	const counts = checkResult.counts;
	console.log("[apidoc] 모듈 " + counts.modules + ", 클래스 " + counts.classes + ", 멤버 " + counts.members + ", 함수와 상수 " + counts.functions + ", 열거 " + counts.enums + " (값 " + counts.enumValues + ")");
	console.log("[apidoc] 설명 칸 " + counts.texts + ", ko 빈 칸 " + counts.emptyKorean + ", en 빈 칸(ko 는 있음) " + counts.emptyEnglish + ", 필드 값 칸(꼴만 두고 설명은 멤버 설명에) " + counts.emptyValueSlots);
	console.log("[apidoc] 예제 " + counts.examples + " (모듈 " + counts.moduleExamples + ", 클래스 " + counts.classExamples + ", 멤버 " + counts.memberExamples + ", 열거 " + counts.enumExamples + "), 예제 없는 클래스 " + counts.classesWithoutExample + ", 제 예제도 클래스 예제도 없는 모듈 " + counts.modulesWithoutExample);
	console.log("[apidoc] 그림: 예제 " + counts.exampleImages + ", 가이드(ko) " + counts.guideImages + ", 아무도 쓰지 않는 그림 파일 " + counts.unusedImages + " (docs/guide/<버전>/images)");
	console.log("[apidoc] 러스트 판 짝 " + counts.counterparts + " (클래스 " + counts.classCounterparts + ", 멤버 " + counts.memberCounterparts + ", 함수와 상수 " + counts.functionCounterparts + ", 열거 " + counts.enumCounterparts + ", 열거 값 " + counts.enumValueCounterparts + ")");
	console.log("[apidoc] kind: " + Object.keys(checkResult.kindTable).map((kind) => kind + " " + checkResult.kindTable[kind]).join(", "));
	const sinceList = Object.keys(checkResult.sinceTable).sort(compareVersions);
	console.log("[apidoc] since: " + sinceList.map((since) => since + " " + checkResult.sinceTable[since]).join(", "));
	if (checkResult.errorList.length > 0) {
		console.log("[apidoc] 꼴 오류 " + checkResult.errorList.length + " 개");
		for (const error of checkResult.errorList.slice(0, 50)) {
			console.log("  " + error);
		}
	}
	else {
		console.log("[apidoc] 꼴 오류 없음");
	}
}

//==============================================================================
// 진입.
//==============================================================================
async function main() {
	const options = readArguments(process.argv.slice(2));
	if (!options) {
		console.log("사용: node tools/apidoc.cjs <버전> [--date YYYY-MM-DD] [--counterpart <러스트 판 짝 표>] | <버전> --missing | <버전> --check | <버전> --gaps [--only <경로 앞>] [--exclude <경로 앞>] | <버전> --check-examples [--only <경로 앞>] [--exclude <경로 앞>] [--no-run] [--no-chrome] [--chrome <크롬 경로>]");
		process.exitCode = 1;
		return;
	}
	const outputPath = path.join(API_DIRECTORY_PATH, options.version + ".json");
	if (options.mode === "gaps") {
		const gapBuildResult = buildApiDocument(options.version, options.dateOption, outputPath, false);
		printGaps(collectGaps(gapBuildResult.apiDocument, gapBuildResult.statistics, options));
		return;
	}
	if (options.mode === "examples") {
		const exampleBuildResult = buildApiDocument(options.version, options.dateOption, outputPath, false);
		const isPassed = await checkExamples(exampleBuildResult.apiDocument, options);
		if (!isPassed) {
			process.exitCode = 1;
		}
		return;
	}
	if (options.mode === "check") {
		const checkResult = checkApiDocument(JSON.parse(fs.readFileSync(outputPath, "utf8")));
		printCheckResult(checkResult);
		const draftBuildResult = buildApiDocument(options.version, options.dateOption, outputPath, false);
		const draftErrorCount = printDraftCheckResult(draftBuildResult.apiDocument, removeDraftModules(draftBuildResult.apiDocument));
		if (checkResult.errorList.length > 0 || draftErrorCount > 0) {
			process.exitCode = 1;
		}
		return;
	}
	if (options.mode === "missing") {
		const missingBuildResult = buildApiDocument(options.version, options.dateOption, outputPath, false);
		const selectedDocument = { modules: missingBuildResult.apiDocument.modules.filter((moduleEntry) => isPathSelected("src/" + moduleEntry.name + ".js", options)) };
		const missingSet = new Set();
		forEachText(selectedDocument, (textObject) => {
			if (textObject.ko !== "" && textObject.en === "") {
				missingSet.add(textObject.ko);
			}
		});
		process.stdout.write(JSON.stringify(Array.from(missingSet), null, "\t") + "\n");
		return;
	}
	if (options.counterpartPath !== "") {
		copyCounterpartTable(path.resolve(options.counterpartPath), options.version);
		console.log("[apidoc] 짝 표를 옮김: " + path.relative(REPOSITORY_ROOT, getCounterpartTablePath(options.version)));
	}
	const buildResult = buildApiDocument(options.version, options.dateOption, outputPath);
	const draftModuleList = removeDraftModules(buildResult.apiDocument);
	fs.mkdirSync(API_DIRECTORY_PATH, { recursive: true });
	fs.writeFileSync(outputPath, JSON.stringify(buildResult.apiDocument, null, "\t") + "\n");
	const statistics = buildResult.statistics;
	console.log("[apidoc] " + path.relative(REPOSITORY_ROOT, outputPath) + " 씀. since 태그: " + statistics.sinceTagList.join(", "));
	if (statistics.unresolvedList.length > 0) {
		console.log("[apidoc] 진입점에 있지만 소스에서 못 찾은 이름 " + statistics.unresolvedList.length + " 개: " + statistics.unresolvedList.join(", "));
	}
	if (statistics.sinceParseFailureList.length > 0) {
		console.log("[apidoc] since 를 훑다 못 읽은 파일 " + statistics.sinceParseFailureList.length + " 개: " + statistics.sinceParseFailureList.join(", "));
	}
	console.log("[apidoc] JSDoc @private 이라 뺀 멤버 " + statistics.jsdocPrivateList.length + " 개");
	if (statistics.counterpartTableMissing) {
		console.log("[apidoc] 짝 표가 없어 counterpart 를 두지 않음: " + path.relative(REPOSITORY_ROOT, getCounterpartTablePath(options.version)) + " (--counterpart 로 러스트 판 짝 표를 옮긴다)");
	}
	else if (statistics.counterpartStaleList.length > 0) {
		console.log("[apidoc] 짝 표에 있지만 자료에 없는 이름 " + statistics.counterpartStaleList.length + " 개 (러스트 판 짝 표를 다시 지을 것): " + statistics.counterpartStaleList.slice(0, 20).join(", "));
	}
	printCheckResult(checkApiDocument(buildResult.apiDocument));
	if (printDraftCheckResult(buildResult.apiDocument, draftModuleList) > 0) {
		process.exitCode = 1;
	}
	if (exampleImageWarningSet.size > 0) {
		console.log("[apidoc] @example 바로 뒤가 아니라 그림을 붙이지 못한 @exampleImage " + exampleImageWarningSet.size + " 개: " + Array.from(exampleImageWarningSet).join(", "));
		process.exitCode = 1;
	}
	if (buildResult.missingList.length > 0) {
		console.log("[apidoc] 번역 표에 없는 ko 글 " + buildResult.missingList.length + " 개 (en 을 빈 글로 둠). 목록: node tools/apidoc.cjs " + options.version + " --missing");
	}
}

if (require.main === module) {
	main().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}
