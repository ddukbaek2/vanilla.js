//==============================================================================
// 기본 글꼴 이름 default 의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/core/defaultfontchrome.test.mjs)
// - 러스트 판은 글꼴 글의 이름 default 를 엔진 기본 글꼴 사슬로 읽는다. 원본도 글 재기와 글자 굽기에서 default 를 SYSTEM_FONT_STRING 사슬로 푸는지 본다.
//   (CSS 에서 따옴표 없는 default 는 예약어라 풀지 않으면 캔버스가 글꼴 글을 통째로 버리고 앞의 글꼴을 그대로 쓴다)
// - 대소문자, 따옴표, 굵기, 다른 이름과 섞인 목록, 글리프 아틀라스의 글리프 자리, 애셋 없는 DynamicFont 를 본다.
// - 크롬 경로는 CHROME_PATH 로 바꿀 수 있다. puppeteer-core 나 크롬이 없으면 실패한다. (말없이 건너뛰지 않는다)
//==============================================================================
const System = globalThis;
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";
import { check, checkEqual, finish } from "../testcheck.mjs";
import { gotoPage, launchBrowser } from "../chromepage.mjs";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const repositoryPath = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");
const contentTypeTable = { ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".html": "text/html" };

const server = http.createServer((request, response) => {
	const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
	if (requestPath === "/") {
		response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
		response.end("<!doctype html><meta charset=\"utf-8\"><title>defaultfont</title>");
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
const browser = await launchBrowser(puppeteer, { executablePath, headless: true });
try {
	const page = await browser.newPage();
	const pageErrorList = [];
	page.on("pageerror", (error) => pageErrorList.push(error.message));
	await gotoPage(page, `http://127.0.0.1:${port}/`);
	const result = await page.evaluate(async () => {
		const { measureTextWithoutGraphic, DynamicFont } = await import("/import.js");
		const { TextStringTextureCache } = await import("/src/core/graphic/textstringtexturecache.js");
		const { SYSTEM_FONT_STRING } = await import("/src/base/platform.js");
		const text = "Default 기본 글꼴 123";
		// 앞에 다른 글꼴로 재 둔다. (default 를 풀지 않으면 캔버스가 그 글꼴을 그대로 쓴다)
		const measureWidth = (fontString, measuredText) => {
			measureTextWithoutGraphic("40px serif", "x");
			return measureTextWithoutGraphic(fontString, measuredText).width;
		};
		const widthPairList = [
			["16px default", `16px ${SYSTEM_FONT_STRING}`, text],
			["bold 20px DEFAULT", `bold 20px ${SYSTEM_FONT_STRING}`, text],
			["italic 500 18px 'default'", `italic 500 18px ${SYSTEM_FONT_STRING}`, text],
			["16px/24px Default", `16px ${SYSTEM_FONT_STRING}`, text],
			["16px default, serif", "16px serif", "Default Latin 123"],
			["16px NoSuchFontName, default", `16px ${SYSTEM_FONT_STRING}`, text],
		].map(([fontString, expectedFontString, measuredText]) => ({ fontString, width: measureWidth(fontString, measuredText), expectedWidth: measureWidth(expectedFontString, measuredText) }));
		const serifWidth = measureWidth("16px serif", text);

		// 글리프 아틀라스: 글리프 자리(왼, 위, 오른, 아래)가 SYSTEM_FONT_STRING 으로 구운 것과 같은지.
		const webGL2RenderingContext = new OffscreenCanvas(16, 16).getContext("webgl2");
		const textStringTextureCache = new TextStringTextureCache(webGL2RenderingContext);
		textStringTextureCache.getEntry("fill", "x", "40px serif", "#ffffff", 0, 2, "ltr");
		const readGlyphBoxList = (entry) => {
			const glyphBoxList = [];
			for (let index = 0; index < entry.glyphRects.length; index += 8) {
				glyphBoxList.push(entry.glyphRects.slice(index, index + 4).map((value) => Math.round(value * 1000) / 1000).join(","));
			}
			return { quadWidth: entry.quadWidth, quadHeight: entry.quadHeight, penOffsetX: entry.penOffsetX, baselineOffsetY: entry.baselineOffsetY, advanceWidth: entry.advanceWidth, fontAscent: entry.fontAscent, fontDescent: entry.fontDescent, glyphBoxText: glyphBoxList.join(" ") };
		};
		const defaultEntry = readGlyphBoxList(textStringTextureCache.getEntry("fill", text, "16px default", "#ffffff", 0, 2, "ltr"));
		const systemEntry = readGlyphBoxList(textStringTextureCache.getEntry("fill", text, `16px ${SYSTEM_FONT_STRING}`, "#ffffff", 0, 2, "ltr"));
		const strokeDefaultEntry = readGlyphBoxList(textStringTextureCache.getEntry("stroke", text, "bold 16px default", "#ffffff", 2, 1, "ltr"));
		const strokeSystemEntry = readGlyphBoxList(textStringTextureCache.getEntry("stroke", text, `bold 16px ${SYSTEM_FONT_STRING}`, "#ffffff", 2, 1, "ltr"));

		// 애셋 없는 DynamicFont 는 엔진 기본 글꼴 사슬로 굽는다. (러스트 판 글꼴 이름 "default")
		const dynamicFont = new DynamicFont();
		dynamicFont.setFontSize(20);
		dynamicFont.buildAtlas("가A");
		const dynamicFontAdvance = dynamicFont.getGlyph("A").advance;
		const systemAdvance = measureTextWithoutGraphic(`20px ${SYSTEM_FONT_STRING}`, "A").width;
		return { widthPairList, serifWidth, defaultEntry, systemEntry, strokeDefaultEntry, strokeSystemEntry, dynamicFontAdvance, systemAdvance };
	});
	checkEqual(pageErrorList.join(" / "), "", "페이지 오류");
	for (const widthPair of result.widthPairList) {
		checkEqual(widthPair.width, widthPair.expectedWidth, `${widthPair.fontString} 너비`);
	}
	check(result.widthPairList[0].width !== result.serifWidth, `default 가 앞의 글꼴(serif)로 재지 않음 (${result.widthPairList[0].width}, serif ${result.serifWidth})`);
	checkEqual(JSON.stringify(result.defaultEntry), JSON.stringify(result.systemEntry), "default 로 구운 글리프 자리");
	check(result.defaultEntry.glyphBoxText.length > 0, "default 글리프가 있음");
	checkEqual(JSON.stringify(result.strokeDefaultEntry), JSON.stringify(result.strokeSystemEntry), "default 바깥선 글리프 자리");
	checkEqual(result.dynamicFontAdvance, result.systemAdvance, "애셋 없는 DynamicFont 글자 너비");
	console.log(`16px default 너비 ${result.widthPairList[0].width}, serif ${result.serifWidth}`);
}
finally {
	await browser.close();
	server.close();
}
finish("defaultfontchrome");
