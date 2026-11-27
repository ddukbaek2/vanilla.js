//==============================================================================
// 입력 필드 여러 줄과 되돌리기의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/ui/inputfieldmultilinechrome.test.mjs)
// - 헤드리스 크롬(창을 띄우지 않는다)에서 원본 엔진을 돌려 UIInputField 를 직접 친다.
// - 줄 나누기: 여러 줄 필드의 줄 범위가 같은 폭과 폰트의 pre-wrap, break-word 칸(크롬 textarea 의 안쪽 편집 칸과 같은 CSS)에서 크롬이 나눈 줄과 같은지 본다.
//   글은 러스트 판 textarealayout.rs 의 line_break_list_matches_chrome_textarea 30 글이다. 고정폭 글꼴로 러스트 판 wraps_like_pre_wrap_break_word 의 줄도 본다.
// - 되돌리기: 러스트 판 uiinputfield.rs 의 edit_buffer_undo_groups_like_blink 와 같은 묶음(캔버스 모드, DOM 입력 모드)과 IME 조합 중 되돌리지 않음.
// - 키: 여러 줄 Enter 는 줄을 넣고 한 줄 Enter 는 제출, 위아래는 가로 자리를 지킨다. (러스트 판 moves_vertically_and_hit_tests 의 자리)
// - 크롬 경로는 CHROME_PATH 로 바꿀 수 있다. puppeteer-core 나 크롬이 없으면 실패한다. (말없이 건너뛰지 않는다)
//==============================================================================
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";
import { check, checkEqual, checkJson, finish } from "../testcheck.mjs";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const repositoryPath = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");
const contentTypeTable = { ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".html": "text/html" };

// 저장소를 잠깐 내주는 http 서버. (모듈은 file:// 로 못 불러온다)
const server = http.createServer((request, response) => {
	const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
	if (requestPath === "/") {
		response.writeHead(200, { "Content-Type": "text/html" });
		response.end("<!doctype html><title>inputfieldmultiline</title><link rel=\"icon\" href=\"data:,\"><style>body{margin:0}</style>");
		return;
	}
	const filePath = path.join(repositoryPath, requestPath);
	if (!filePath.startsWith(repositoryPath) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
		response.writeHead(404);
		response.end();
		return;
	}
	response.writeHead(200, { "Content-Type": contentTypeTable[path.extname(filePath)] ?? "application/octet-stream" });
	fs.createReadStream(filePath).pipe(response);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;

const chromePathList = [
	...(process.env.CHROME_PATH ? [process.env.CHROME_PATH] : []),
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	"C:/Program Files/Google/Chrome/Application/chrome.exe",
	"/usr/bin/google-chrome",
];
const executablePath = chromePathList.find((chromePath) => fs.existsSync(chromePath));
check(executablePath !== undefined, "크롬을 찾지 못함 (CHROME_PATH)");
const isMac = process.platform === "darwin";
const commandKey = isMac ? "Meta" : "Control";

// 러스트 판 line_break_list_matches_chrome_textarea 의 글.
const lineBreakTextList = [
	"hello world foo", "state-of-the-art e-mail", "a/b http://x.com/a?b=c", "(abc) [def] {ghi}", "1,000.50 $30 30% 3.14",
	"안녕하세요 반갑습니다", "日本語の文章です。終わり", "中文句子，测试。", "ภาษาไทยเป็นภาษาที่สวยงาม", "foo—bar…baz",
	"don't stop", "a  b", "가나다abc가나", "x=1;y=2", "「こんにちは」と言った",
	"テスト・ケース", "a(b)c x)(y z=[1]", "foo-123 a-1 -1 1-2", "«bonjour» déjà-vu ¿qué?", "price: $5, ok! 50%off",
	"tab\there", "C++/C# a.b,c;d", "über-straße", "A&B|C~D", "привет мир",
	"ABC-DEF?ghi", "あ〜い゠う", "ぁぃぅ々〻", "「中」〜〜", "a‐b–c—d",
];

const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
	const page = await browser.newPage();
	await page.setViewport({ width: 640, height: 360 });
	page.on("pageerror", (error) => {
		console.log("페이지 오류: " + error.message);
	});
	await page.goto("http://127.0.0.1:" + port + "/");
	const isReady = await page.evaluate(async () => {
		const Vanilla = await import("/import.js");
		const { Engine, EngineConfiguration, UIScene, UIInputField, Vector2 } = Vanilla;
		const engineConfiguration = new EngineConfiguration();
		engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
		engineConfiguration.useDevTools = false;
		engineConfiguration.defaultFontUrl = "";
		const engine = new Engine(engineConfiguration);
		let isInitialized = false;
		class FieldScene extends UIScene {
			constructor() {
				super();
				this.setLoadingMinDurationMs(0);
			}

			initialize(engine) {
				super.initialize(engine);
				isInitialized = true;
			}
		}
		const scene = new FieldScene();
		engine.run(scene);
		for (let frameIndex = 0; frameIndex < 600 && !isInitialized; ++frameIndex) {
			await new Promise((resolve) => requestAnimationFrame(resolve));
		}
		// 고정폭 글꼴. (운영체제의 고정폭 글꼴을 이름 붙여 넣는다, 일반 글꼴 이름 monospace 는 FontFace 이름으로 쓰면 따옴표가 붙어 일반 글꼴이 아니다)
		const monospaceFontFace = new FontFace("VanillaTestMono", "local(Menlo), local(Consolas), local(DejaVu Sans Mono), local(Liberation Mono), local(Courier New)");
		document.fonts.add(monospaceFontFace);
		await monospaceFontFace.load();
		const { buildFontString } = await import("/src/core/component/text.js");
		globalThis.buildFontString = buildFontString;
		globalThis.monospaceFontFace = monospaceFontFace;
		// 필드 만들기. (DOM 입력이면 attach 전에 정한다)
		globalThis.createField = (isDOMInput, isMultiline, width, height, isMonospace) => {
			const field = new UIInputField();
			field.setEngine(engine);
			field.setUseDOMInput(isDOMInput);
			field.setMultiline(isMultiline);
			field.setLocalPosition(Vector2.create(0, 0));
			field.setContentSize(Vector2.create(width, height));
			if (isMonospace) {
				field.setFont(monospaceFontFace);
			}
			scene.getRoot().addChild(field);
			field.attach();
			return field;
		};
		globalThis.Vanilla = Vanilla;
		return isInitialized;
	});
	check(isReady, "엔진 씬 시작");

	// 1) 줄 나누기: 필드의 줄 범위와 같은 CSS 칸에서 크롬이 나눈 줄이 같다. (폭 두 가지)
	const lineBreakResult = await page.evaluate((textList) => {
		const field = globalThis.createField(false, true, 100, 400, false);
		field.setPadding(0);
		const fontString = globalThis.buildFontString(null, 28, false, false);
		// 크롬 textarea 의 안쪽 편집 칸과 같은 CSS 의 칸에서 줄 범위 읽기.
		const readChromeLineList = (text, width) => {
			const element = document.createElement("div");
			element.style.cssText = "position:absolute;left:0;top:0;margin:0;padding:0;border:0;white-space:pre-wrap;overflow-wrap:break-word;";
			element.style.font = fontString;
			element.style.width = width + "px";
			element.appendChild(document.createTextNode(text));
			document.body.appendChild(element);
			const textNode = element.firstChild;
			const range = document.createRange();
			const startList = [0];
			let previousTop = null;
			for (let index = 0; index < text.length; ++index) {
				range.setStart(textNode, index);
				range.setEnd(textNode, index + 1);
				const rectList = range.getClientRects();
				if (rectList.length === 0) {
					continue;
				}
				if (previousTop !== null && rectList[0].top > previousTop + 0.5) {
					startList.push(index);
				}
				previousTop = rectList[0].top;
			}
			element.remove();
			return startList;
		};
		const mismatchList = [];
		let lineCount = 0;
		for (const width of [60, 130]) {
			field.setContentSize(globalThis.Vanilla.Vector2.create(width, 400));
			for (const text of textList) {
				field.setText(text);
				const engineStartList = field.getTextAreaLineRangeList().map((line) => line.start);
				const chromeStartList = readChromeLineList(text, width);
				lineCount += engineStartList.length;
				if (JSON.stringify(engineStartList) !== JSON.stringify(chromeStartList)) {
					mismatchList.push(`${width}px ${text}: 엔진 ${JSON.stringify(engineStartList)}, 크롬 ${JSON.stringify(chromeStartList)}`);
				}
			}
		}
		field.detach(); field.getParent().removeChild(field);
		return { mismatchList, lineCount };
	}, lineBreakTextList);
	checkJson(lineBreakResult.mismatchList, [], "줄 나누기가 크롬 pre-wrap break-word 칸과 같다");
	check(lineBreakResult.lineCount > lineBreakTextList.length * 2, "폭으로 나뉜 줄이 있다 (" + lineBreakResult.lineCount + ")");

	// 2) 러스트 판 wraps_like_pre_wrap_break_word: 고정폭 글꼴로 8 글자 폭.
	const wrapResult = await page.evaluate(() => {
		const field = globalThis.createField(false, true, 100, 400, true);
		field.setPadding(0);
		field.setFontSize(20);
		const context = document.createElement("canvas").getContext("2d");
		context.font = globalThis.buildFontString(globalThis.monospaceFontFace, 20, false, false);
		const characterWidth = context.measureText("a").width;
		field.setContentSize(globalThis.Vanilla.Vector2.create(characterWidth * 8 + 0.01, 400));
		field.setText("hello world foo\nabcdefghijkl");
		const lineList = field.getTextAreaLineRangeList().map((line) => [line.start, line.end, line.isHardBreak]);
		field.detach(); field.getParent().removeChild(field);
		return lineList;
	});
	checkJson(wrapResult, [[0, 6, false], [6, 12, false], [12, 15, true], [16, 24, false], [24, 28, false]], "pre-wrap break-word 줄 (러스트 판과 같은 자리)");

	// 3) 캔버스 모드 되돌리기 묶음. (러스트 판 edit_buffer_undo_groups_like_blink 의 차례)
	await page.evaluate(() => {
		const field = globalThis.createField(false, true, 400, 200, true);
		field.focus();
		globalThis.canvasField = field;
		globalThis.submitCount = 0;
		field.setOnSubmit(() => {
			globalThis.submitCount += 1;
		});
	});
	const pressCanvasKey = async (key, modifier) => {
		await page.evaluate((keyName, modifierName) => {
			const isMeta = modifierName === "Meta";
			const isControl = modifierName === "Control";
			document.dispatchEvent(new KeyboardEvent("keydown", { key: keyName, metaKey: isMeta, ctrlKey: isControl, shiftKey: keyName === "Z", bubbles: true, cancelable: true }));
		}, key, modifier ?? "");
	};
	const readCanvasField = async () => await page.evaluate(() => {
		const field = globalThis.canvasField;
		return { text: field.getText(), cursor: field.getCursorIndex(), canUndo: field.canUndo(), canRedo: field.canRedo() };
	});
	for (const character of ["a", "b", "c"]) {
		await pressCanvasKey(character);
	}
	await pressCanvasKey("Backspace");
	await pressCanvasKey("Backspace");
	await pressCanvasKey("d");
	checkEqual((await readCanvasField()).text, "ad", "캔버스: 친 뒤 글");
	await pressCanvasKey("z", commandKey);
	checkEqual((await readCanvasField()).text, "abc", "캔버스: 되돌리기 1");
	await pressCanvasKey("z", commandKey);
	const afterSecondUndo = await readCanvasField();
	checkEqual(afterSecondUndo.text, "", "캔버스: 되돌리기 2");
	checkEqual(afterSecondUndo.canUndo, false, "캔버스: 더 되돌릴 것 없음");
	await pressCanvasKey("Z", commandKey);
	checkEqual((await readCanvasField()).text, "abc", "캔버스: 다시 하기 1 (Shift + Z)");
	if (isMac) {
		await pressCanvasKey("Z", commandKey);
	}
	else {
		await pressCanvasKey("y", commandKey);
	}
	const afterRedo = await readCanvasField();
	checkEqual(afterRedo.text, "ad", "캔버스: 다시 하기 2");
	checkEqual(afterRedo.canRedo, false, "캔버스: 더 다시 할 것 없음");
	// 커서를 옮기면 끊긴다. 새 편집은 다시 하기를 지운다.
	await page.evaluate(() => globalThis.canvasField.moveCursor(0, false));
	await pressCanvasKey("x");
	await pressCanvasKey("ArrowRight");
	await pressCanvasKey("y");
	checkEqual((await readCanvasField()).text, "xayd", "캔버스: 옮긴 뒤 친 글");
	await pressCanvasKey("z", commandKey);
	checkEqual((await readCanvasField()).text, "xad", "캔버스: 옮긴 자리에서 끊긴 묶음");
	await pressCanvasKey("z", commandKey);
	checkEqual((await readCanvasField()).text, "ad", "캔버스: 앞 묶음");
	await pressCanvasKey("z");
	checkEqual((await readCanvasField()).canRedo, false, "캔버스: 새 편집은 다시 하기를 지운다");
	// 여러 줄 Enter 는 줄을 넣고 제출하지 않는다. setText 는 이력을 비운다.
	await pressCanvasKey("Enter");
	const afterEnter = await readCanvasField();
	checkEqual(afterEnter.text, "z\nad", "캔버스 여러 줄: Enter 는 줄을 넣는다");
	checkEqual(await page.evaluate(() => globalThis.submitCount), 0, "캔버스 여러 줄: Enter 는 제출하지 않는다");
	await page.evaluate(() => globalThis.canvasField.setText("reset"));
	checkEqual((await readCanvasField()).canUndo, false, "setText 는 되돌리기 목록을 비운다");

	// 4) 위아래 이동은 가로 자리를 지킨다. (러스트 판 moves_vertically_and_hit_tests: 4 → 9 → 14, 위는 글 앞, 마지막 줄 아래는 글 끝)
	await page.evaluate(() => {
		const field = globalThis.canvasField;
		field.setText("abcdef\nab\nabcdef");
		field.moveCursor(4, false);
	});
	const verticalList = [];
	for (const key of ["ArrowDown", "ArrowDown", "ArrowDown", "ArrowUp", "ArrowUp", "ArrowUp", "ArrowUp"]) {
		await pressCanvasKey(key);
		verticalList.push((await readCanvasField()).cursor);
	}
	checkJson(verticalList, [9, 14, 16, 9, 4, 0, 0], "위아래 이동 자리");
	await page.evaluate(() => (globalThis.canvasField.detach(), globalThis.canvasField.getParent().removeChild(globalThis.canvasField)));

	// 5) 한 줄 Enter 는 제출한다.
	const singleLineSubmit = await page.evaluate(() => {
		const field = globalThis.createField(false, false, 400, 56, false);
		let submittedValue = null;
		field.setOnSubmit((value) => {
			submittedValue = value;
		});
		field.focus();
		field.setText("one");
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
		const result = { submittedValue, text: field.getText() };
		field.detach();
		field.detach(); field.getParent().removeChild(field);
		return result;
	});
	checkJson(singleLineSubmit, { submittedValue: "one", text: "one" }, "한 줄 Enter 는 제출");

	// 6) DOM 입력 여러 줄: 숨긴 textarea, 실제 키 입력, 엔진 이력 되돌리기. (브라우저 되돌리기는 막는다)
	const domTagName = await page.evaluate(() => {
		const field = globalThis.createField(true, true, 400, 200, false);
		globalThis.domField = field;
		field.focus();
		const textArea = document.querySelector("textarea.uiinputfield-hidden");
		return textArea ? textArea.tagName : null;
	});
	checkEqual(domTagName, "TEXTAREA", "DOM 입력 여러 줄은 textarea");
	const readDOMField = async () => await page.evaluate(() => {
		const field = globalThis.domField;
		const textArea = document.querySelector("textarea.uiinputfield-hidden");
		return { text: field.getText(), domText: textArea.value, canUndo: field.canUndo(), canRedo: field.canRedo(), isComposing: field.isComposing() };
	});
	const pressCommand = async (key, isShift) => {
		await page.keyboard.down(commandKey);
		if (isShift) {
			await page.keyboard.down("Shift");
		}
		await page.keyboard.press(key);
		if (isShift) {
			await page.keyboard.up("Shift");
		}
		await page.keyboard.up(commandKey);
	};
	await page.keyboard.type("abc");
	await page.keyboard.press("Backspace");
	await page.keyboard.press("Backspace");
	await page.keyboard.type("d");
	await page.keyboard.press("Enter");
	await page.keyboard.type("e");
	const afterDOMTyping = await readDOMField();
	checkEqual(afterDOMTyping.text, "ad\ne", "DOM: 친 뒤 글 (Enter 는 줄바꿈)");
	await pressCommand("KeyZ", false);
	checkJson(await readDOMField(), { text: "abc", domText: "abc", canUndo: true, canRedo: true, isComposing: false }, "DOM: 되돌리기 1 (줄바꿈은 글자 넣기 묶음)");
	await pressCommand("KeyZ", false);
	checkEqual((await readDOMField()).domText, "", "DOM: 되돌리기 2");
	await pressCommand("KeyZ", true);
	checkEqual((await readDOMField()).text, "abc", "DOM: 다시 하기 1");
	await pressCommand("KeyZ", true);
	checkEqual((await readDOMField()).domText, "ad\ne", "DOM: 다시 하기 2");
	// 브라우저 되돌리기 명령(historyUndo)도 엔진 이력으로 한다.
	await page.keyboard.press("F13", { commands: ["Undo"] });
	checkEqual((await readDOMField()).text, "abc", "DOM: 브라우저 Undo 명령도 엔진 이력");
	await page.keyboard.press("F13", { commands: ["Redo"] });
	checkEqual((await readDOMField()).text, "ad\ne", "DOM: 브라우저 Redo 명령도 엔진 이력");

	// 7) IME 조합 중에는 되돌리지 않는다. 확정한 글은 앞 글자 넣기 묶음에 붙는다. (다시 하기는 묶음을 닫아서 글자 하나를 먼저 친다)
	await page.keyboard.type("f");
	const client = await page.createCDPSession();
	await client.send("Input.imeSetComposition", { text: "가", selectionStart: 1, selectionEnd: 1 });
	const duringComposition = await readDOMField();
	checkEqual(duringComposition.isComposing, true, "IME: 조합 중");
	await pressCommand("KeyZ", false);
	const afterComposingUndo = await readDOMField();
	checkEqual(afterComposingUndo.text, "ad\nef", "IME: 조합 중 되돌리기 안 됨 (값)");
	checkEqual(afterComposingUndo.isComposing, true, "IME: 조합 중 되돌리기 안 됨 (조합 그대로)");
	await client.send("Input.insertText", { text: "가" });
	const afterCommit = await readDOMField();
	checkEqual(afterCommit.text, "ad\nef가", "IME: 확정");
	checkEqual(afterCommit.isComposing, false, "IME: 조합 끝");
	await pressCommand("KeyZ", false);
	checkEqual((await readDOMField()).text, "ad\ne", "IME: 확정 글은 앞 글자 넣기 묶음에 붙는다");
	await page.evaluate(() => {
		globalThis.domField.detach();
		globalThis.domField.getParent().removeChild(globalThis.domField);
	});
}
finally {
	await browser.close();
	server.close();
}
finish("tests/ui/inputfieldmultilinechrome.test.mjs");
