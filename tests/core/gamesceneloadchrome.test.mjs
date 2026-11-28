//==============================================================================
// GameScene 불러오기 크롬 시험. (NODE_PATH=$(npm root -g) node tests/core/gamesceneloadchrome.test.mjs)
// - drawOnLoad 를 super 없이 덮어쓴 GameScene 도 load 가 끝나고 initialize 까지 가는지 본다. (보통 실행과 찍기 모드 둘 다)
//   로딩 시각(첫 프레임 전에 load 가 불렸을 때)과 터치 건너뛰기는 엔진이 로딩 중 프레임마다 부르는 엔진 프레임 함수가 잡는다. 덮어쓸 수 있는 drawOnLoad 에 기대지 않는다.
//   예전에는 그 시각을 drawOnLoad 만 잡아, 덮어쓰면 load 가 오류 없이 멈추고 initialize 가 불리지 않았다.
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
const contentTypeTable = { ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".html": "text/html" };
const PAGE_SOURCE = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{position:absolute;left:0;top:0;width:100%;height:100%}</style><canvas id="mainCanvas"></canvas>
<script type="module">
const { Engine, EngineConfiguration, Colors, Rect } = await import("/import.js");
const { GameScene } = await import("/src/game/gamescene.js");
window.initializeFrameNumber = -1;
class OverriddenLoadingScene extends GameScene {
	constructor() {
		super();
		this.setLoadingMinDurationMs(300);
	}
	drawOnLoad(graphic) {
		// super 없이 덮어쓴다. (게임이 제 로딩 화면을 그리는 꼴)
		graphic.setFillColor(Colors.white);
		graphic.drawRect(Rect.create(10, 10, 40, 40));
	}
	initialize(engine) {
		super.initialize(engine);
		window.initializeFrameNumber = engine.getFrameNumber();
	}
}
const engineConfiguration = new EngineConfiguration();
const engine = new Engine(engineConfiguration);
engine.run(new OverriddenLoadingScene());
</script>`;

const server = http.createServer((request, response) => {
	const requestPath = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
	if (requestPath === "/") {
		response.writeHead(200, { "Content-Type": "text/html" });
		response.end(PAGE_SOURCE);
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
const browser = await launchBrowser(puppeteer, { executablePath, headless: true });

//==============================================================================
// 한 번 열어 initialize 가 불린 프레임 번호 받기.
//==============================================================================
async function readInitializeFrameNumber(query) {
	const page = await browser.newPage();
	await page.setViewport({ width: 640, height: 360, deviceScaleFactor: 1 });
	const errorList = [];
	page.on("pageerror", (error) => errorList.push(error.message));
	await page.evaluateOnNewDocument(() => {
		// 찍기 모드의 내려받기를 막는다. (파일을 쓰지 않는다)
		HTMLAnchorElement.prototype.click = function () {
		};
	});
	await gotoPage(page, "http://127.0.0.1:" + port + "/" + query);
	let initializeFrameNumber = -1;
	try {
		await page.waitForFunction(() => window.initializeFrameNumber >= 0, { timeout: 10000 });
		initializeFrameNumber = await page.evaluate(() => window.initializeFrameNumber);
	}
	catch (error) {
		initializeFrameNumber = -1;
	}
	await page.close();
	checkEqual(errorList.length, 0, query + " 페이지 오류 없음 " + errorList.join(" | "));
	return initializeFrameNumber;
}

try {
	const normalFrameNumber = await readInitializeFrameNumber("");
	check(normalFrameNumber > 0, "보통 실행: drawOnLoad 를 super 없이 덮어써도 initialize 가 불린다 (프레임 " + normalFrameNumber + ")");
	// 찍기 모드: 최소 노출 0.3 초(18 프레임)와 불러온 뒤 0.3 초(18 프레임)를 엔진 시계로 센다. 두 번 열어 같은 프레임인지도 본다.
	const captureFrameNumber = await readInitializeFrameNumber("?capture=200");
	check(captureFrameNumber > 0, "찍기 모드: drawOnLoad 를 super 없이 덮어써도 initialize 가 불린다 (프레임 " + captureFrameNumber + ")");
	const secondCaptureFrameNumber = await readInitializeFrameNumber("?capture=200");
	checkEqual(secondCaptureFrameNumber, captureFrameNumber, "찍기 모드: 두 번 열어도 initialize 프레임이 같다");
	check(captureFrameNumber >= 36, "찍기 모드: 최소 노출 시간과 불러온 뒤 0.3 초를 다 센 뒤 initialize 한다 (프레임 " + captureFrameNumber + ")");
}
finally {
	await browser.close();
	server.close();
}
finish("gamesceneloadchrome");
