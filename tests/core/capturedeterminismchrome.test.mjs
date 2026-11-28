//==============================================================================
// 찍기 모드 결정성 크롬 시험. (NODE_PATH=$(npm root -g) node tests/core/capturedeterminismchrome.test.mjs)
// - 같은 예제를 찍기 모드(?capture=)로 두 번 찍어, 같은 프레임 번호의 그림이 바이트까지 같은지 본다.
// - 찍기 모드는 시간을 프레임마다 1/60 초씩 보내고, 씬을 불러온 뒤 로딩 화면 0.3 초와 GameScene 의 최소 노출 시간도 엔진 시계로 센다.
//   실제 시각(setTimeout)으로 세면 씬이 처음 그려지는 프레임이 실행마다 밀려, 로딩 화면에서 씬으로 넘어가는 프레임 둘레가 실행마다 달라진다.
// - quickstart(Scene, 받는 애셋 없음)와 loadingshowcase(GameScene, 그림 일곱 장과 문서를 받는다, 받기는 실제 시간)를 찍는다.
//   찍는 프레임은 로딩 화면에서 씬으로 넘어가는 둘레(15 ~ 25)와 그 뒤(40, 90)다. 넘어간 뒤 프레임이 로딩 화면(한 가지 색)이 아닌지도 본다.
// - 찍은 화면은 엔진이 내려받기로 넘기는 a 요소의 click 을 가로채 data URL 로 받는다. (파일을 쓰지 않는다)
// - 크롬 경로는 CHROME_PATH 로 바꿀 수 있다. puppeteer-core 나 크롬이 없으면 실패한다. (말없이 건너뛰지 않는다)
//==============================================================================
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
const contentTypeTable = { ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".html": "text/html", ".png": "image/png", ".jpg": "image/jpeg", ".ttf": "font/ttf", ".woff2": "font/woff2" };
const CAPTURE_FRAME_LIST = [15, 18, 19, 20, 21, 22, 25, 40, 90];
const EXAMPLE_NAME_LIST = ["quickstart", "loadingshowcase"];
const RUN_COUNT = 2;

//==============================================================================
// 저장소를 내주는 서버.
//==============================================================================
const server = http.createServer((request, response) => {
	const requestPath = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
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
const browser = await launchBrowser(puppeteer, { executablePath, headless: true });

//==============================================================================
// 예제 하나를 찍기 모드로 한 번 찍기. (프레임 번호 → data URL)
//==============================================================================
async function captureExample(exampleName) {
	const page = await browser.newPage();
	await page.setViewport({ width: 640, height: 360, deviceScaleFactor: 1 });
	const errorList = [];
	page.on("pageerror", (error) => errorList.push(error.message));
	await page.evaluateOnNewDocument(() => {
		window.captureDataUrlTable = {};
		const originalClick = HTMLAnchorElement.prototype.click;
		HTMLAnchorElement.prototype.click = function () {
			if (this.download && this.href.startsWith("data:image/png")) {
				window.captureDataUrlTable[this.download] = this.href;
				return;
			}
			originalClick.call(this);
		};
	});
	const captureQuery = "?capture=" + CAPTURE_FRAME_LIST.join(",") + "&captureName={frame}";
	await gotoPage(page, "http://127.0.0.1:" + port + "/examples/" + exampleName + "/index.html" + captureQuery);
	await page.waitForFunction((frameCount) => Object.keys(window.captureDataUrlTable).length >= frameCount, { timeout: 60000 }, CAPTURE_FRAME_LIST.length);
	const captureDataUrlTable = await page.evaluate(() => window.captureDataUrlTable);
	// 넘어간 뒤 프레임이 한 가지 색(로딩 화면)이 아닌지. (마지막 프레임의 화소 가짓수)
	const lastFrameColorCount = await page.evaluate(async (imageUrl) => {
		const image = new Image();
		image.src = imageUrl;
		await image.decode();
		const canvas = document.createElement("canvas");
		canvas.width = image.width;
		canvas.height = image.height;
		const context = canvas.getContext("2d");
		context.drawImage(image, 0, 0);
		const pixelData = context.getImageData(0, 0, canvas.width, canvas.height).data;
		const colorSet = new Set();
		for (let offset = 0; offset < pixelData.length; offset += 4 * 97) {
			colorSet.add(pixelData[offset] + "," + pixelData[offset + 1] + "," + pixelData[offset + 2]);
		}
		return colorSet.size;
	}, captureDataUrlTable[String(CAPTURE_FRAME_LIST[CAPTURE_FRAME_LIST.length - 1])]);
	await page.close();
	checkEqual(errorList.length, 0, exampleName + " 페이지 오류 없음 " + errorList.join(" | "));
	check(lastFrameColorCount > 1, exampleName + " 마지막 프레임은 로딩 화면이 아니다 (색 " + lastFrameColorCount + " 가지)");
	return captureDataUrlTable;
}

try {
	for (const exampleName of EXAMPLE_NAME_LIST) {
		const runList = [];
		for (let runIndex = 0; runIndex < RUN_COUNT; ++runIndex) {
			runList.push(await captureExample(exampleName));
		}
		let differentFrameList = [];
		for (const frameNumber of CAPTURE_FRAME_LIST) {
			const firstDataUrl = runList[0][String(frameNumber)];
			check(typeof firstDataUrl === "string" && firstDataUrl.length > 0, exampleName + " " + frameNumber + " 프레임을 찍음");
			for (let runIndex = 1; runIndex < RUN_COUNT; ++runIndex) {
				if (runList[runIndex][String(frameNumber)] !== firstDataUrl) {
					differentFrameList.push(frameNumber);
				}
			}
		}
		checkEqual(differentFrameList.join(","), "", exampleName + " 두 번 찍은 그림이 프레임마다 바이트까지 같다 (다른 프레임: " + differentFrameList.join(",") + ")");
		// 로딩 화면에서 씬으로 넘어가는 프레임이 찍은 둘레 안에 있는지. (같은 그림만 이어지면 넘어가는 둘레를 보지 못한 것)
		const distinctFrameCount = new Set(CAPTURE_FRAME_LIST.map((frameNumber) => runList[0][String(frameNumber)])).size;
		check(distinctFrameCount > 1, exampleName + " 찍은 프레임에 서로 다른 그림이 있다 (" + distinctFrameCount + " 가지)");
	}
}
finally {
	await browser.close();
	server.close();
}
finish("capturedeterminismchrome");
