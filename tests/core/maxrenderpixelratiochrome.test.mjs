//==============================================================================
// 도는 중 렌더 배율 상한 바꾸기의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/core/maxrenderpixelratiochrome.test.mjs)
// - 헤드리스 크롬(창을 띄우지 않는다, 기기 픽셀 배율 2)에서 엔진을 돌려 주황 사각형을 그리고, 10 번째 tick 에서 setMaxRenderPixelRatio(1) 을 건다.
//   프레임마다 엔진이 그린 뒤 사각형 가운데 화소를 떠서, 바꾼 프레임도 까맣지 않고(지금까지는 그 프레임이 까맸다) 다음 프레임부터 버퍼가 800x450 인지 본다.
//   puppeteer-core 나 크롬이 없으면 실패한다. (말없이 건너뛰지 않는다)
//==============================================================================
const System = globalThis;
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";
import { gotoPage, launchBrowser } from "../chromepage.mjs";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const repositoryPath = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");
const contentTypeTable = { ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".html": "text/html" };
let checkCount = 0;
function check(condition, message) {
	checkCount++;
	if (!condition) {
		throw new System.Error("시험 실패: " + message);
	}
}

// 저장소를 잠깐 내주는 http 서버. (모듈은 file:// 로 못 불러온다)
const server = http.createServer((request, response) => {
	const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
	if (requestPath === "/") {
		response.writeHead(200, { "Content-Type": "text/html" });
		response.end("<!doctype html><title>renderscale</title><style>html,body{margin:0;width:100%;height:100%}canvas{display:block;width:100%;height:100%}</style><body><canvas id=\"gameCanvas\"></canvas></body>");
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
let frameList = null;
try {
	const page = await browser.newPage();
	await page.setViewport({ width: 800, height: 450, deviceScaleFactor: 2 });
	await gotoPage(page, "http://127.0.0.1:" + port + "/");
	frameList = await page.evaluate(async () => {
		const { Engine, EngineConfiguration, Scene, Vector2, Rect } = await import("/import.js");
		return await new Promise((resolve) => {
			const frameList = [];
			let tickCount = 0;
			class MainScene extends Scene {
				tick(timeDelta) {
					super.tick(timeDelta);
					tickCount++;
					if (tickCount === 10) {
						this.getEngine().getViewManager().setMaxRenderPixelRatio(1);
					}
				}
				draw(graphic) {
					super.draw(graphic);
					graphic.setFillColor("#ff8000");
					graphic.drawRect(Rect.create(0, 0, 640, 360));
					graphic.flushBatch();
					const gl = graphic.getWebGL2RenderingContext();
					const pixel = new Uint8Array(4);
					gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
					frameList.push({ tickCount, width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, pixel: Array.from(pixel) });
					if (tickCount === 20) {
						resolve(frameList);
					}
				}
			}
			const engineConfiguration = new EngineConfiguration();
			engineConfiguration.canvasId = "gameCanvas";
			engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
			engineConfiguration.autoResizeOnWindowResize = true;
			engineConfiguration.defaultFontUrl = "";
			engineConfiguration.useDevTools = false;
			const engine = new Engine(engineConfiguration);
			engine.run(new MainScene());
		});
	});
}
finally {
	await browser.close();
	server.close();
}

for (const frame of frameList) {
	const isOrange = frame.pixel[0] === 255 && frame.pixel[1] === 128 && frame.pixel[2] === 0;
	check(isOrange, "tick " + frame.tickCount + " 의 화소가 주황 " + frame.pixel.join(",") + " (" + frame.width + "x" + frame.height + ")");
}
const beforeFrame = frameList.find((frame) => frame.tickCount === 9);
const afterFrame = frameList.find((frame) => frame.tickCount === 11);
check(beforeFrame.width === 1600 && beforeFrame.height === 900, "바꾸기 전 버퍼 1600x900 " + beforeFrame.width + "x" + beforeFrame.height);
check(afterFrame.width === 800 && afterFrame.height === 450, "바꾼 다음 프레임 버퍼 800x450 " + afterFrame.width + "x" + afterFrame.height);
console.log("도는 중 렌더 배율 상한 크롬 시험 통과 (" + checkCount + " 검사)");
