//==============================================================================
// 글자 간격(Text.setLetterSpacing)의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/core/textenginegapchrome.test.mjs)
// - 글 너비가 크롬 캔버스 letterSpacing 로 잰 너비와 같은지, 글자 묶음마다 그린 자리가 캔버스가 잰 앞 글 너비와 같은지, 기본 0 은 한 번에 그리는지 본다.
// - 크롬 경로는 CHROME_PATH 로 바꿀 수 있다. puppeteer-core 나 크롬이 없으면 실패한다. (말없이 건너뛰지 않는다)
//==============================================================================
const System = globalThis;
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";
import { check, checkEqual, finish } from "../testcheck.mjs";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const repositoryPath = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");
const contentTypeTable = { ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".html": "text/html" };

const server = http.createServer((request, response) => {
	const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
	if (requestPath === "/") {
		response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
		response.end("<!doctype html><meta charset=\"utf-8\"><title>textletterspacing</title>");
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
await new System.Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;

const chromePathList = [
	...(process.env.CHROME_PATH ? [process.env.CHROME_PATH] : []),
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	"C:/Program Files/Google/Chrome/Application/chrome.exe",
	"/usr/bin/google-chrome",
];
const executablePath = chromePathList.find((chromePath) => fs.existsSync(chromePath));
check(executablePath !== undefined, "크롬을 찾지 못함 (CHROME_PATH)");
const browser = await puppeteer.launch({ executablePath, headless: true });
try {
	const page = await browser.newPage();
	const pageErrorList = [];
	page.on("pageerror", (error) => pageErrorList.push(error.message));
	await page.goto(`http://127.0.0.1:${port}/`);
	const result = await page.evaluate(async () => {
		const { Text, Engine } = await import("/import.js");
		// 바깥 주소 열기. (window.open 을 가로채 부른 인자를 본다)
		const openCallList = [];
		const originalOpen = window.open;
		window.open = (...argumentList) => { openCallList.push(argumentList); return null; };
		const openResultList = ["https://vanillapunch.com", "javascript:alert(1)", "file:///etc/passwd", "mailto:a@b.c"].map((address) => Engine.prototype.openUrl.call({}, address));
		window.open = originalOpen;
		const fontString = "32px sans-serif";
		const context = new OffscreenCanvas(16, 16).getContext("2d");
		context.font = fontString;
		const text = "Hello 안녕";
		const readCanvasWidth = (value, spacing) => {
			context.letterSpacing = `${spacing}px`;
			return context.measureText(value).width;
		};
		const makeText = (spacing) => {
			const textComponent = new Text();
			textComponent.setFontSize(32);
			textComponent.setText(text);
			textComponent.setLetterSpacing(spacing);
			return textComponent;
		};
		const widthList = [0, 3, -1.5].map((spacing) => ({ spacing, width: makeText(spacing).measureText(), expected: readCanvasWidth(text, spacing) }));
		// 그린 자리 기록. (가짜 그래픽)
		const drawList = [];
		const fakeGraphic = {
			getTextDirection: () => "ltr",
			setTextAlign: (value) => drawList.push(["align", value]),
			drawFillText: (value, x, y) => drawList.push(["fill", value, x, y]),
			drawStrokeText: (value, x, y) => drawList.push(["stroke", value, x, y]),
		};
		const drawLine = (spacing, align) => {
			drawList.length = 0;
			makeText(spacing).drawTextLine(fakeGraphic, text, 100, 20, align, 32, false);
			return drawList.slice();
		};
		const spaced = drawLine(3, "left");
		const fillList = spaced.filter((entry) => entry[0] === "fill");
		const positionList = fillList.map((entry, index) => ({ index, x: entry[2] - 100, expected: readCanvasWidth(Array.from(text).slice(0, index).join(""), 3) }));
		const plain = drawLine(0, "center");
		const centered = drawLine(3, "center");
		const rightAligned = drawLine(3, "right");
		return { openResultList, openCallList, widthList, fillCount: fillList.length, positionList, plain, firstCenter: centered.find((entry) => entry[0] === "fill")[2], firstRight: rightAligned.find((entry) => entry[0] === "fill")[2], width3: makeText(3).measureText(), defaultValue: new Text().getLetterSpacing(), setValue: makeText(3).getLetterSpacing() };
	});
	checkEqual(pageErrorList.join(" / "), "", "페이지 오류");
	for (const item of result.widthList) {
		check(System.Math.abs(item.width - item.expected) < 0.01, `간격 ${item.spacing} 너비 ${item.width} (캔버스 ${item.expected})`);
	}
	checkEqual(JSON.stringify(result.openResultList), "[true,false,false,true]", "열 수 있는 주소만 연다");
	checkEqual(JSON.stringify(result.openCallList[0]), JSON.stringify(["https://vanillapunch.com", "_blank", "noopener"]), "새 탭, noopener");
	checkEqual(result.openCallList.length, 2, "막은 주소는 부르지 않음");
	checkEqual(result.fillCount, 8, "글자 묶음마다 그림");
	for (const item of result.positionList) {
		check(System.Math.abs(item.x - item.expected) < 0.01, `${item.index} 번째 글자 자리 ${item.x} (캔버스 ${item.expected})`);
	}
	checkEqual(result.plain.filter((entry) => entry[0] === "fill").length, 1, "간격 0 은 한 번에 그림");
	checkEqual(result.defaultValue, 0, "처음 값 0");
	checkEqual(result.setValue, 3, "정한 값");
	check(System.Math.abs(result.firstCenter - (100 - result.width3 * 0.5)) < 0.01, "가운데 정렬은 간격을 더한 너비로");
	check(System.Math.abs(result.firstRight - (100 - result.width3)) < 0.01, "오른쪽 정렬은 간격을 더한 너비로");
	console.log(`간격 3 너비 ${result.widthList[1].width}`);
}
finally {
	await browser.close();
	server.close();
}
finish("textenginegapchrome");
