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
// 사용:
//   node tools/apidoc.cjs <버전> [--date YYYY-MM-DD]   docs/api/<버전>.json 쓰기
//   node tools/apidoc.cjs <버전> --missing             표에 없는 ko 글 목록 (JSON 배열)
//   node tools/apidoc.cjs <버전> --check               docs/api/<버전>.json 꼴 검사와 수 세기
//==============================================================================


//==============================================================================
// 전역 상수 목록.
//==============================================================================
const REPOSITORY_ROOT = path.resolve(__dirname, "..");
const ENTRY_FILE_PATH = path.join(REPOSITORY_ROOT, "import.js");
const UPDATE_FILE_PATH = path.join(REPOSITORY_ROOT, "UPDATE.md");
const API_DIRECTORY_PATH = path.join(REPOSITORY_ROOT, "docs", "api");
const TRANSLATION_FILE_PATH = path.join(API_DIRECTORY_PATH, "translation.en.json");
const ENGINE_NAME = "vanilla.js";
const SINCE_FIRST_VERSION = "0.0.8"; // since 를 훑기 시작하는 판. (이 판부터 소스가 src/ 아래 지금 꼴이다)
const MEMBER_KINDS = ["method", "property", "constructor", "static", "field"];
const HANGUL_PATTERN = /[ᄀ-ᇿ㄰-㆏가-힣]/;
const SECTION_HEADER_PATTERN = /목록\.?$/; // "포함 모듈 목록.", "멤버 변수 목록." 같은 구획 머리말.
const MULTI_CHARACTER_PUNCTUATORS = [">>>=", "...", "===", "!==", "**=", "<<=", ">>=", ">>>", "&&=", "||=", "??=", "=>", "==", "!=", "<=", ">=", "&&", "||", "??", "?.", "++", "--", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "**", "<<", ">>"];
const REGEX_PRECEDING_KEYWORDS = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"]);
const SCREAMING_NAME_PATTERN = /^[A-Z0-9_]+$/; // 대문자 이름의 객체는 열거가 아니라 상수 표로 둔다. (TIMELINE_NODE_DEFAULTS 등)
const SHORT_VALUE_LENGTH = 60; // 시그니처에 값을 그대로 보일 상수의 글자 수 상한.


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
// - { tags: [{ name, type, parameterName, text }], freeText }
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
		restText = restText.replace(/^-\s*/, "").trim();
		return { name: tag.name, type: type, parameterName: parameterName, text: restText };
	});
	const freeText = freeLines.join("").split("\n").map((freeLine) => freeLine.replace(/\s+$/, "")).join("\n").trim();
	return { tags: tags, freeText: freeText };
}

//==============================================================================
// 선언 앞의 주석 모으기.
// - 빈 줄을 만나거나, 앞 코드 줄 끝에 붙은 주석을 만나면 멈춘다.
// - { description, jsdoc, headerTokenIndex, orphanHeaderTokenIndexList }
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
	const orphanHeaderList = [];
	for (const tokenIndex of commentIndexList) {
		const token = tokenList[tokenIndex];
		if (token.type === "blockComment") {
			if (token.value.startsWith("/**")) {
				jsdoc = parseJsdoc(token.value);
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
	return { description: description, jsdoc: jsdoc, headerTokenIndex: headerTokenIndex, orphanHeaderList: orphanHeaderList };
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
// - { headerList, declarationList, exportList, reexportList }
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
			tokenIndex = declaration.endIndex + 1;
			continue;
		}
		if (keywordToken.value === "function" || (keywordToken.value === "async" && tokenList[nextSignificantIndex(tokenList, cursorIndex + 1)].value === "function")) {
			const declaration = parseFunctionDeclaration(tokenList, startIndex, cursorIndex);
			declaration.isExported = isExported;
			declarationList.push(declaration);
			firstDeclarationLine = Math.min(firstDeclarationLine, tokenList[startIndex].line);
			markUsedHeader(declaration.document, usedHeaderIndexSet);
			tokenIndex = declaration.endIndex + 1;
			continue;
		}
		if (keywordToken.value === "const" || keywordToken.value === "let" || keywordToken.value === "var") {
			const declaration = parseVariableDeclaration(tokenList, startIndex, cursorIndex);
			declaration.isExported = isExported;
			declarationList.push(declaration);
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
						document: collectLeadingDocument(tokenList, startIndex),
						trailingComment: readTrailingComment(tokenList, endIndex),
						assignedNameList: [],
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
	const headerBlockList = [];
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
	return { fileSummary: fileSummary, declarationList: declarationList, reexportList: reexportList };
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
		line: tokenList[startIndex].line,
		endLine: tokenList[endIndex].endLine,
		endIndex: endIndex,
	};
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
// - member: { name, isStatic, isAsync, isGenerator, accessor: "get" | "set" | "", isMethod, parameterList, valueText, document, trailingComment, assignedNameList }
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
// 멤버 칸 짓기. (칸 차례: kind, name, signature, params, returns, description, since, source, deprecated)
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
			continue;
		}
		if (member.isMethod) {
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
	return createMember({
		kind: property.isStatic ? "static" : "property",
		name: property.name,
		signature: signature,
		params: [],
		returns: typeText !== "" || returnText !== "" ? { type: typeText, description: createText(returnText) } : null,
		description: descriptionList.join("\n"),
		source: sourcePath,
		document: property.getter ? property.getter.document : property.setter.document,
	});
}

//==============================================================================
// 모듈 함수를 문서 멤버로. (JSDoc 말로 함수는 method)
//==============================================================================
/**
 * @param { object } declaration
 * @param { string } sourcePath
 * @returns { object }
 */
function buildFunctionMember(declaration, sourcePath) {
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
	return {
		name: declaration.publicName,
		summary: createText(declaration.document.description || declaration.trailingComment),
		values: declaration.entryList.map((entry) => ({ name: entry.name, value: entry.literalValue, description: createText(entry.description) })),
	};
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
				if (declaration.extendsText !== "") {
					classEntry.extends = declaration.extendsText;
				}
				classEntry.members = buildClassMembers(declaration, sourcePath, statistics);
				classEntry.sinceKey = declaration.name;
				classList.push(classEntry);
			}
			else if (declaration.kind === "function") {
				const member = buildFunctionMember(declaration, sourcePath);
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
		moduleList.push({
			name: sourcePath.replace(/^src\//, "").replace(/\.js$/, ""),
			summary: createText(moduleSummary),
			classes: classList,
			functions: functionList,
			enums: enumList,
		});
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
 */
function fillSince(moduleList, version, statistics) {
	const tagList = runGit(["tag", "--list"]).toString("utf8").split("\n").map((tagName) => tagName.trim()).filter((tagName) => /^v\d+\.\d+\.\d+$/.test(tagName)).filter((tagName) => compareVersions(tagName.slice(1), SINCE_FIRST_VERSION) >= 0 && compareVersions(tagName.slice(1), version) < 0).sort((first, second) => compareVersions(first.slice(1), second.slice(1)));
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
// 자료의 모든 설명 칸 돌기. (callback(textObject))
//==============================================================================
/**
 * @param { object } apiDocument
 * @param { Function } callback
 */
function forEachText(apiDocument, callback) {
	const visitMember = (member) => {
		for (const parameter of member.params || []) {
			callback(parameter.description);
		}
		if (member.returns) {
			callback(member.returns.description);
		}
		callback(member.description);
	};
	for (const moduleEntry of apiDocument.modules) {
		callback(moduleEntry.summary);
		for (const classEntry of moduleEntry.classes) {
			callback(classEntry.summary);
			classEntry.members.forEach(visitMember);
		}
		moduleEntry.functions.forEach(visitMember);
		for (const enumEntry of moduleEntry.enums) {
			callback(enumEntry.summary);
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
// 자료 짓기.
//==============================================================================
/**
 * @param { string } version
 * @param { string } dateOption
 * @param { string } outputPath
 * @returns { object }
 */
function buildApiDocument(version, dateOption, outputPath) {
	const statistics = { unresolvedList: [], jsdocPrivateList: [], sinceParseFailureList: [], sinceTagList: [] };
	const moduleList = collectModules(statistics);
	fillSince(moduleList, version, statistics);
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
// 자료 꼴 검사와 수 세기. (꼴 오류 목록을 돌려준다)
//==============================================================================
/**
 * @param { object } apiDocument
 * @returns { object }
 */
function checkApiDocument(apiDocument) {
	const errorList = [];
	const counts = { modules: 0, classes: 0, members: 0, functions: 0, enums: 0, enumValues: 0, texts: 0, emptyEnglish: 0, emptyKorean: 0 };
	const sinceTable = Object.create(null);
	const kindTable = Object.create(null);

	// 설명 칸인지.
	const checkText = (textObject, where) => {
		if (!textObject || typeof textObject !== "object" || typeof textObject.ko !== "string" || typeof textObject.en !== "string" || Object.keys(textObject).length !== 2) {
			errorList.push(where + ": 설명 칸이 { ko, en } 이 아니다");
			return;
		}
		++counts.texts;
		if (textObject.ko !== "" && textObject.en === "") {
			++counts.emptyEnglish;
		}
		if (textObject.ko === "") {
			++counts.emptyKorean;
		}
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
			checkText(member.returns.description, memberWhere + " returns");
		}
		if (member.deprecated !== undefined && typeof member.deprecated !== "string") {
			errorList.push(memberWhere + ": deprecated");
		}
		checkText(member.description, memberWhere);
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
		checkText(moduleEntry.summary, moduleEntry.name);
		for (const key of ["classes", "functions", "enums"]) {
			if (!Array.isArray(moduleEntry[key])) {
				errorList.push(moduleEntry.name + ": " + key + " 가 배열이 아니다");
			}
		}
		for (const classEntry of moduleEntry.classes || []) {
			++counts.classes;
			checkText(classEntry.summary, classEntry.name);
			if (classEntry.extends !== undefined && (typeof classEntry.extends !== "string" || classEntry.extends === "")) {
				errorList.push(classEntry.name + ": extends");
			}
			for (const member of classEntry.members || []) {
				++counts.members;
				checkMember(member, classEntry.name);
			}
		}
		for (const member of moduleEntry.functions || []) {
			++counts.functions;
			checkMember(member, moduleEntry.name);
		}
		for (const enumEntry of moduleEntry.enums || []) {
			++counts.enums;
			checkText(enumEntry.summary, enumEntry.name);
			for (const value of enumEntry.values || []) {
				++counts.enumValues;
				checkText(value.description, enumEntry.name + "." + value.name);
			}
		}
	}
	return { errorList: errorList, counts: counts, sinceTable: sinceTable, kindTable: kindTable };
}

//==============================================================================
// 명령 줄 읽기. ({ version, mode, dateOption })
//==============================================================================
/**
 * @param { string[] } argumentList
 * @returns { object | null }
 */
function readArguments(argumentList) {
	const options = { version: "", mode: "write", dateOption: "" };
	for (let argumentIndex = 0; argumentIndex < argumentList.length; ++argumentIndex) {
		const argument = argumentList[argumentIndex];
		if (argument === "--missing") {
			options.mode = "missing";
		}
		else if (argument === "--check") {
			options.mode = "check";
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
	console.log("[apidoc] 설명 칸 " + counts.texts + ", ko 빈 칸 " + counts.emptyKorean + ", en 빈 칸(ko 는 있음) " + counts.emptyEnglish);
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
function main() {
	const options = readArguments(process.argv.slice(2));
	if (!options) {
		console.log("사용: node tools/apidoc.cjs <버전> [--date YYYY-MM-DD] | <버전> --missing | <버전> --check");
		process.exitCode = 1;
		return;
	}
	const outputPath = path.join(API_DIRECTORY_PATH, options.version + ".json");
	if (options.mode === "check") {
		const checkResult = checkApiDocument(JSON.parse(fs.readFileSync(outputPath, "utf8")));
		printCheckResult(checkResult);
		if (checkResult.errorList.length > 0) {
			process.exitCode = 1;
		}
		return;
	}
	const buildResult = buildApiDocument(options.version, options.dateOption, outputPath);
	if (options.mode === "missing") {
		process.stdout.write(JSON.stringify(buildResult.missingList, null, "\t") + "\n");
		return;
	}
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
	printCheckResult(checkApiDocument(buildResult.apiDocument));
	if (buildResult.missingList.length > 0) {
		console.log("[apidoc] 번역 표에 없는 ko 글 " + buildResult.missingList.length + " 개 (en 을 빈 글로 둠). 목록: node tools/apidoc.cjs " + options.version + " --missing");
	}
}

if (require.main === module) {
	main();
}
