//==============================================================================
// 입력 필드 편집 상태 기계의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/ui/inputfieldchrome.test.mjs)
// - 원본 UIInputField 는 글 편집을 DOM 입력 요소(input, 여러 줄은 textarea)에 맡긴다. 그래서 원본의 편집 동작은 크롬 DOM 의 동작이다.
//   헤드리스 크롬(창을 띄우지 않는다)의 textarea 에 같은 편집을 걸어, 러스트 판 시험이 지키는 값과 같은지 본다.
// - 러스트 판 짝: src/ui/uiinputfield.rs 의 edit_buffer_undo_groups_like_blink(붙여넣기 묶음은 빼고),
//   word_and_paragraph_ranges_like_blink(두 번, 세 번 누르기), word_keys_move_select_and_delete_like_chrome.
// - 편집 키는 운영체제 단축키 대신 블링크 편집 명령(MoveWordLeft, DeleteWordBackward, Undo 같은)으로 건다. (맥 헤드리스는 단축키를 명령으로 바꾸지 않는다)
//   낱말 옮기기 결과는 운영체제마다 다르다. (러스트 판 cfg 와 같은 갈래)
// - 크롬 경로는 CHROME_PATH 로 바꿀 수 있다. puppeteer-core 나 크롬이 없으면 실패한다. (말없이 건너뛰지 않는다)
//==============================================================================
import fs from "node:fs";
import { createRequire } from "node:module";
import { checkEqual, checkJson, check, finish } from "../testcheck.mjs";
import { launchBrowser } from "../chromepage.mjs";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const chromePathList = [
	...(process.env.CHROME_PATH ? [process.env.CHROME_PATH] : []),
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	"C:/Program Files/Google/Chrome/Application/chrome.exe",
	"/usr/bin/google-chrome",
];
const executablePath = chromePathList.find((chromePath) => fs.existsSync(chromePath));
check(executablePath !== undefined, "크롬을 찾지 못함 (CHROME_PATH)");
const isWindows = process.platform === "win32";
const isMac = process.platform === "darwin";

const browser = await launchBrowser(puppeteer, { executablePath, headless: true });
try {
	const page = await browser.newPage();
	await page.setContent("<!doctype html><style>body{margin:0}textarea{position:absolute;left:0;top:0;width:600px;height:200px;margin:0;padding:0;border:0;outline:0;resize:none;font:20px/20px monospace;white-space:pre;}</style><textarea spellcheck=\"false\"></textarea>");
	await page.focus("textarea");

	// 글과 고르기 읽기. (고정 끝 anchor, 움직이는 끝 focus)
	async function readState() {
		return await page.evaluate(() => {
			const textArea = document.querySelector("textarea");
			const isBackward = textArea.selectionDirection === "backward";
			return { text: textArea.value, anchor: isBackward ? textArea.selectionEnd : textArea.selectionStart, focus: isBackward ? textArea.selectionStart : textArea.selectionEnd };
		});
	}
	// 글을 새로 넣는다. (되돌리기 기록도 비운다)
	async function resetText(text) {
		await page.evaluate((newText) => {
			const textArea = document.querySelector("textarea");
			textArea.value = newText;
			textArea.setSelectionRange(newText.length, newText.length);
		}, text);
	}
	// 고르기 걸기. (anchor 에서 focus 쪽으로)
	async function setSelection(anchor, focus) {
		await page.evaluate((anchorIndex, focusIndex) => {
			const textArea = document.querySelector("textarea");
			textArea.setSelectionRange(Math.min(anchorIndex, focusIndex), Math.max(anchorIndex, focusIndex), anchorIndex <= focusIndex ? "forward" : "backward");
		}, anchor, focus);
	}
	// 블링크 편집 명령 하나. (글자를 내지 않는 키 F13 에 명령을 실어 보낸다)
	async function runCommand(commandName) {
		await page.keyboard.press("F13", { commands: [commandName] });
	}
	async function typeCharacter(character) {
		await page.keyboard.type(character);
	}

	// 되돌리기 묶음: 이어 친 글자는 한 번에, 뒤로 지우기는 새 묶음이고 그 뒤 친 글자는 그 묶음에 붙는다.
	await resetText("");
	for (const character of ["a", "b", "c"]) {
		await typeCharacter(character);
	}
	await runCommand("DeleteBackward");
	await runCommand("DeleteBackward");
	await typeCharacter("d");
	checkEqual((await readState()).text, "ad", "친 뒤 글");
	await runCommand("Undo");
	checkEqual((await readState()).text, "abc", "되돌리기 1");
	await runCommand("Undo");
	checkEqual((await readState()).text, "", "되돌리기 2");
	await runCommand("Redo");
	checkEqual((await readState()).text, "abc", "다시 하기 1");
	await runCommand("Redo");
	checkEqual((await readState()).text, "ad", "다시 하기 2");
	// 커서를 옮기면 끊긴다.
	await setSelection(0, 0);
	await typeCharacter("x");
	await typeCharacter("y");
	checkEqual((await readState()).text, "xyad", "커서 옮긴 뒤 친 글");
	await runCommand("Undo");
	checkEqual((await readState()).text, "ad", "커서 옮긴 뒤 되돌리기는 옮긴 뒤 친 것만");

	// 낱말과 문단 범위: 두 번 누르기는 낱말(공백이면 공백, 문단 끝 자리는 줄바꿈, 글 끝은 앞 낱말), 세 번 누르기는 문단(줄바꿈까지).
	const rangeText = "hello  world\nnext line";
	await resetText(rangeText);
	const characterWidth = await page.evaluate(() => {
		const context = document.createElement("canvas").getContext("2d");
		context.font = "20px monospace";
		return context.measureText("0").width;
	});
	// 글 자리 offset 의 글자 가운데를 누른다. (줄 끝 자리는 그 줄 끝 뒤를 누른다)
	async function clickAt(offset, clickCount) {
		const lineStartList = [0, rangeText.indexOf("\n") + 1];
		const lineIndex = offset >= lineStartList[1] ? 1 : 0;
		const column = offset - lineStartList[lineIndex];
		await page.mouse.click((column + 0.5) * characterWidth, lineIndex * 20 + 10, { count: clickCount });
		const state = await readState();
		return [Math.min(state.anchor, state.focus), Math.max(state.anchor, state.focus)];
	}
	// 윈도우 크롬은 두 번 누른 낱말에 뒤 공백을 붙인다. (selectTrailingWhitespaceEnabled, 러스트 판 skip_trailing_whitespace 와 같은 갈래)
	for (const [offset, expectedRange] of [[1, [0, isWindows ? 7 : 5]], [5, [5, 7]], [7, [7, 12]], [12, [12, 13]], [22, [18, 22]]]) {
		await page.mouse.click(590, 190);
		await new Promise((resolve) => setTimeout(resolve, 600));
		checkJson(await clickAt(offset, 2), expectedRange, "두 번 누르기 " + offset);
	}
	for (const [offset, expectedRange] of [[3, [0, 13]], [15, [13, 22]]]) {
		await page.mouse.click(590, 190);
		await new Promise((resolve) => setTimeout(resolve, 600));
		checkJson(await clickAt(offset, 3), expectedRange, "세 번 누르기 " + offset);
	}

	// 낱말 키: 옮기기는 커서 자리에서(오른쪽은 윈도우만 다음 낱말 앞), 맥은 넓히던 고르기가 고정 끝을 넘지 않는다.
	await resetText("hello world foo\nbar");
	const rightEnd = isWindows ? 12 : 11;
	async function pressCommand(commandName) {
		await runCommand(commandName);
		const state = await readState();
		return [state.anchor, state.focus];
	}
	await setSelection(8, 8);
	checkJson(await pressCommand("MoveWordLeft"), [6, 6], "낱말 왼쪽");
	checkJson(await pressCommand("MoveWordRight"), [rightEnd, rightEnd], "낱말 오른쪽");
	await setSelection(2, 8);
	checkJson(await pressCommand("MoveWordRight"), [rightEnd, rightEnd], "고른 것이 있어도 커서에서 오른쪽");
	await setSelection(8, 2);
	checkJson(await pressCommand("MoveWordLeft"), [0, 0], "고른 것이 있어도 커서에서 왼쪽");
	await setSelection(8, 8);
	checkJson(await pressCommand("MoveWordLeftAndModifySelection"), [8, 6], "왼쪽으로 넓히기");
	checkJson(await pressCommand("MoveWordRightAndModifySelection"), isMac ? [8, 8] : [8, rightEnd], "고정 끝을 넘는 넓히기");
	await setSelection(16, 16);
	checkJson(await pressCommand("MoveWordLeft"), [16, 16], "글자가 있는 줄 앞 낱말 왼쪽");
	checkJson(await pressCommand("DeleteWordBackward"), [15, 15], "줄 앞 낱말 지우기는 줄바꿈 하나");
	checkEqual((await readState()).text, "hello world foobar", "줄바꿈 지운 글");

	// 되돌리기 묶음: [낱말 지우기 + 뒤로 지우기] / [낱말 지우기]
	await resetText("one two three");
	await runCommand("DeleteWordBackward");
	await runCommand("DeleteBackward");
	await runCommand("DeleteWordBackward");
	checkEqual((await readState()).text, "one ", "낱말 지우기 셋 뒤");
	await runCommand("Undo");
	checkEqual((await readState()).text, "one two", "낱말 지우기 되돌리기 1");
	await runCommand("Undo");
	checkEqual((await readState()).text, "one two three", "낱말 지우기 되돌리기 2");
	// 고른 것은 고른 것만 지우고 따로 한 묶음이다. 그 뒤 친 글자도 새 묶음.
	await setSelection(4, 7);
	await runCommand("DeleteWordForward");
	await typeCharacter("x");
	checkEqual((await readState()).text, "one x three", "고른 것 지우고 친 글");
	await runCommand("Undo");
	checkEqual((await readState()).text, "one  three", "고른 것 지우기 되돌리기 1");
	await runCommand("Undo");
	checkEqual((await readState()).text, "one two three", "고른 것 지우기 되돌리기 2");
	// 앞으로 낱말 지우기: 맥과 리눅스는 낱말 끝까지, 윈도우는 다음 낱말 앞까지.
	await setSelection(3, 3);
	await runCommand("DeleteWordForward");
	checkEqual((await readState()).text, isWindows ? "onetwo three" : "one three", "앞으로 낱말 지우기");
	console.log("크롬 " + (await browser.version()));
}
finally {
	await browser.close();
}

finish("tests/ui/inputfieldchrome.test.mjs");
