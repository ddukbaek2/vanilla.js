//==============================================================================
// GPU 처리량 재기(Engine.measureGpuThroughput) 크롬 시험. (NODE_PATH=$(npm root -g) node tests/core/gputhroughputchrome.test.mjs)
// - 재는 동안 씬의 tick 을 부르지 않고 그리기만 하는지, 엔진 시간과 프레임 번호가 그대로인지, 다 재면 엔진 루프가 이어 도는지 본다.
// - 값의 꼴(프레임 수, 30 프레임 덩이, 프레임당 ms 가 양수), 재는 중 또 부르기와 잘못된 프레임 수는 거부하는지도 본다.
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
const { Engine, EngineConfiguration, Scene, Rect, Vector2 } = await import("/import.js");
window.counter = { tick: 0, draw: 0 };
class CountingScene extends Scene {
	tick(timeDelta) {
		super.tick(timeDelta);
		window.counter.tick += 1;
	}
	draw(graphic) {
		super.draw(graphic);
		window.counter.draw += 1;
		graphic.setFillColor("#336699");
		graphic.drawRect(Rect.create(0, 0, 320, 180));
	}
}
const engineConfiguration = new EngineConfiguration();
engineConfiguration.canvasId = "mainCanvas";
engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
const engine = new Engine(engineConfiguration);
engine.run(new CountingScene());
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

try {
	const page = await browser.newPage();
	await page.setViewport({ width: 640, height: 360, deviceScaleFactor: 1 });
	const errorList = [];
	page.on("pageerror", (error) => errorList.push(error.message));
	await gotoPage(page, "http://127.0.0.1:" + port + "/");
	await page.waitForFunction(() => window.counter !== undefined && window.counter.tick > 10, { timeout: 10000 });
	const measured = await page.evaluate(async () => {
		const engine = globalThis.vanillaEngine;
		const before = { time: engine.getTimeManager().getTime(), frameNumber: engine.getFrameNumber(), tick: window.counter.tick, draw: window.counter.draw };
		const promise = engine.measureGpuThroughput(45);
		let secondError = "";
		try {
			await engine.measureGpuThroughput(10);
		}
		catch (error) {
			secondError = error.message;
		}
		let invalidError = "";
		try {
			await engine.measureGpuThroughput(0);
		}
		catch (error) {
			invalidError = error.message;
		}
		const result = await promise;
		const after = { time: engine.getTimeManager().getTime(), frameNumber: engine.getFrameNumber(), tick: window.counter.tick, draw: window.counter.draw };
		// 엔진 루프가 이어 도는지. (rAF 몇 번 뒤)
		await new Promise((resolve) => setTimeout(resolve, 300));
		const resumed = { time: engine.getTimeManager().getTime(), tick: window.counter.tick };
		return { before, after, resumed, result, secondError, invalidError };
	});
	checkEqual(measured.after.time, measured.before.time, "재는 동안 엔진 시간이 그대로다");
	checkEqual(measured.after.frameNumber, measured.before.frameNumber, "재는 동안 프레임 번호가 그대로다");
	checkEqual(measured.after.tick, measured.before.tick, "재는 동안 씬의 tick 을 부르지 않는다");
	checkEqual(measured.after.draw - measured.before.draw, 10 + 45, "데움 10 과 잰 45 프레임을 그린다");
	checkEqual(measured.result.frameCount, 45, "잰 프레임 수");
	checkEqual(measured.result.chunkFrameCount, 30, "덩이 프레임 수");
	checkEqual(measured.result.chunkMillisecondsPerFrame.length, 2, "45 프레임은 30 과 15 두 덩이");
	check(measured.result.millisecondsPerFrame > 0 && Number.isFinite(measured.result.millisecondsPerFrame), "프레임당 시간이 양수 (" + measured.result.millisecondsPerFrame + " ms)");
	check(measured.secondError.includes("already running"), "재는 중 또 부르면 거부한다 (" + measured.secondError + ")");
	check(measured.invalidError.includes("frameCount"), "잘못된 프레임 수는 거부한다 (" + measured.invalidError + ")");
	check(measured.resumed.tick > measured.after.tick && measured.resumed.time > measured.after.time, "다 재면 엔진 루프가 이어 돈다");
	await page.close();
	checkEqual(errorList.length, 0, "페이지 오류 없음 " + errorList.join(" | "));
}
finally {
	await browser.close();
	server.close();
}
finish("gputhroughputchrome");
