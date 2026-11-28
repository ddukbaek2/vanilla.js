//==============================================================================
// WebGL 컨텍스트 잃음 처리의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/core/contextlostchrome.test.mjs)
// - 헤드리스 크롬(창을 띄우지 않는다)에서 엔진을 돌려 초록 사각형을 그리다가 WEBGL_lose_context 로 컨텍스트를 잃게 하고 되살린다.
// - 잃은 동안: 엔진이 그리지 않아 예외가 0, 엔진 오류 길(console.error)로 한 번만 알리고, 리스너에 lost 를 한 번 넘기고, 씬 갱신은 이어 돈다.
// - 되살린 뒤: 리스너에 restored 를 한 번 넘기고, 엔진이 기본 자원을 다시 지어 초록 사각형을 다시 그린다.
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
		response.end("<!doctype html><title>contextlost</title><style>html,body{margin:0;width:100%;height:100%}canvas{display:block;width:100%;height:100%}</style><body><canvas id=\"gameCanvas\"></canvas></body>");
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
let result = null;
const errorMessageList = []; // 콘솔 오류와 페이지 예외. (시각 구분 없이 쌓고, 시험 안에서 사건 번호로 나눈다)
try {
	const page = await browser.newPage();
	await page.setViewport({ width: 320, height: 200, deviceScaleFactor: 1 });
	page.on("console", (message) => {
		if (message.type() === "error") {
			errorMessageList.push(message.text());
		}
	});
	page.on("pageerror", (error) => {
		errorMessageList.push("pageerror: " + error.message);
	});
	await gotoPage(page, "http://127.0.0.1:" + port + "/");
	result = await page.evaluate(async () => {
		const { Engine, EngineConfiguration, Scene, Vector2, Rect } = await import("/import.js");
		const sleepFrames = (frameCount) => new Promise((resolve) => {
			let remaining = frameCount;
			const step = () => {
				if (--remaining <= 0) {
					resolve();
				}
				else {
					requestAnimationFrame(step);
				}
			};
			requestAnimationFrame(step);
		});
		const counter = { tick: 0, draw: 0 };
		class MainScene extends Scene {
			tick(timeDelta) {
				super.tick(timeDelta);
				counter.tick++;
			}
			draw(graphic) {
				super.draw(graphic);
				counter.draw++;
				graphic.setFillColor("#00ff00");
				graphic.drawRect(Rect.create(0, 0, 320, 200));
			}
		}
		const engineConfiguration = new EngineConfiguration();
		engineConfiguration.canvasId = "gameCanvas";
		engineConfiguration.referenceResolutionSize = Vector2.create(320, 200);
		engineConfiguration.defaultFontUrl = "";
		engineConfiguration.useDevTools = false;
		const engine = new Engine(engineConfiguration);
		const eventList = [];
		const hasListenerApi = typeof engine.addGraphicContextEventListener === "function";
		if (hasListenerApi) {
			engine.addGraphicContextEventListener((graphicContextEvent) => eventList.push(graphicContextEvent));
		}
		engine.run(new MainScene());
		await sleepFrames(10);
		const gl = engine.getGraphic().getWebGL2RenderingContext();
		const canvas = engine.getCanvas();
		const readCenter = () => {
			const pixel = new Uint8Array(4);
			gl.readPixels(160, 100, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
			return Array.from(pixel);
		};
		const extension = gl.getExtension("WEBGL_lose_context");
		const waitEvent = (eventName) => new Promise((resolve) => {
			const timer = setTimeout(() => resolve(false), 5000);
			canvas.addEventListener(eventName, () => {
				clearTimeout(timer);
				resolve(true);
			}, { once: true });
		});
		const lostPromise = waitEvent("webglcontextlost");
		extension.loseContext();
		const lostSeen = await lostPromise;
		await sleepFrames(2);
		const afterLost = { tick: counter.tick, draw: counter.draw };
		const eventCountAtLost = eventList.length;
		await sleepFrames(30);
		const duringLost = { tick: counter.tick - afterLost.tick, draw: counter.draw - afterLost.draw };
		const isLostFlag = typeof engine.getGraphic().isContextLost === "function" ? engine.getGraphic().isContextLost() : null;
		const restoredPromise = waitEvent("webglcontextrestored");
		extension.restoreContext();
		const restoredSeen = await restoredPromise;
		await sleepFrames(10);
		const afterRestoreDraw = counter.draw;
		// 그린 프레임 끝에 바로 읽으려고 한 프레임 안에서 그리고 읽는다.
		const center = await new Promise((resolve) => {
			const scene = engine.getSceneManager().getAllLoadedScenes()[0];
			const originalDraw = scene.draw.bind(scene);
			scene.draw = (graphic) => {
				originalDraw(graphic);
				graphic.flushBatch();
				scene.draw = originalDraw;
				resolve(readCenter());
			};
		});
		await sleepFrames(5);
		return {
			hasListenerApi,
			lostSeen,
			restoredSeen,
			eventList,
			eventCountAtLost,
			duringLost,
			isLostFlag,
			drawAfterRestoreCount: counter.draw - afterRestoreDraw,
			center,
			isLostAfterRestore: typeof engine.getGraphic().isContextLost === "function" ? engine.getGraphic().isContextLost() : null,
		};
	});
}
finally {
	await browser.close();
	server.close();
}

console.log("  잃음 사건 " + result.lostSeen + ", 되살림 사건 " + result.restoredSeen + ", 리스너가 받은 것 " + JSON.stringify(result.eventList));
console.log("  잃은 동안 30 프레임: 씬 갱신 " + result.duringLost.tick + ", 그리기 " + result.duringLost.draw + ", 되살린 뒤 중심 화소 " + result.center.join(","));
check(result.lostSeen === true && result.restoredSeen === true, "잃음과 되살림 사건이 둘 다 옴");
check(result.hasListenerApi, "엔진에 addGraphicContextEventListener 가 있음");
check(result.isLostFlag === true, "잃은 동안 Graphic.isContextLost 가 참");
check(result.duringLost.draw === 0, "잃은 동안 그리기 0 (실제 " + result.duringLost.draw + ")");
check(result.duringLost.tick >= 20, "잃은 동안에도 씬 갱신은 이어 돎 (실제 " + result.duringLost.tick + ")");
const engineLostMessageList = errorMessageList.filter((message) => message.includes("WebGL2 context lost"));
const otherErrorList = errorMessageList.filter((message) => !message.includes("WebGL2 context lost") && !message.includes("Failed to load resource"));
for (const message of otherErrorList.slice(0, 5)) {
	console.log("  예외: " + message.split("\n")[0]);
}
check(otherErrorList.length === 0, "잃고 되살리는 동안 예외 " + otherErrorList.length + " 개 (0 이어야)");
check(engineLostMessageList.length === 1, "엔진 오류 길 알림 " + engineLostMessageList.length + " 번 (한 번이어야)");
check(result.eventList.join(",") === "lost,restored", "리스너가 받은 것 " + result.eventList.join(",") + " (lost,restored 한 번씩이어야)");
check(result.eventCountAtLost === 1, "잃은 직후 리스너가 받은 수 " + result.eventCountAtLost);
check(result.isLostAfterRestore === false, "되살린 뒤 isContextLost 가 거짓");
check(result.drawAfterRestoreCount >= 5, "되살린 뒤 다시 그림 (그리기 " + result.drawAfterRestoreCount + ")");
check(result.center[0] === 0 && result.center[1] === 255 && result.center[2] === 0, "되살린 뒤 초록 사각형 화소 " + result.center.join(","));
console.log("WebGL 컨텍스트 잃음 크롬 시험 통과 (" + checkCount + " 검사)");
