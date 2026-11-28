//==============================================================================
// 셰이더 짓기 실패 알림의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/graphics3d/toonshaderbuilderrorchrome.test.mjs)
// - 헤드리스 크롬(창을 띄우지 않는다)에서 일부러 틀린 툰 머티리얼 조각으로 프로그램 짓기를 실패시킨다.
// - 셰이더 탓의 실패: 엔진의 그래픽 오류 리스너가 { kind, name, error } 를 한 번 받고, 같은 머티리얼은 다시 알리지도 짓지도 않는다.
// - 컨텍스트를 잃은 뒤의 실패: 알리지 않고 실패를 기억하지 않는다. 되살린 뒤 같은 (옳은) 머티리얼이 지어진다.
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
		response.end("<!doctype html><title>shaderbuilderror</title><style>html,body{margin:0;width:100%;height:100%}canvas{display:block;width:100%;height:100%}</style><body><canvas id=\"gameCanvas\"></canvas></body>");
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
		const { Engine, EngineConfiguration, Scene, Vector2, ToonRenderer, GraphicErrorKind } = await import("/import.js");
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
		const engineConfiguration = new EngineConfiguration();
		engineConfiguration.canvasId = "gameCanvas";
		engineConfiguration.referenceResolutionSize = Vector2.create(320, 200);
		engineConfiguration.defaultFontUrl = "";
		engineConfiguration.useDevTools = false;
		const engine = new Engine(engineConfiguration);
		engine.run(new Scene());
		await sleepFrames(5);
		const gl = engine.getGraphic().getWebGL2RenderingContext();
		const errorList = [];
		engine.addGraphicErrorListener((graphicError) => errorList.push(graphicError));
		const renderer = new ToonRenderer(gl);
		const badMaterial = renderer.createMaterial({ name: "badMaterial", surfaceChunk: "void applySurface(inout ToonSurface surface) { this is not glsl }" });
		const goodMaterial = renderer.createMaterial({ name: "goodMaterial", surfaceChunk: "void applySurface(inout ToonSurface surface) { surface.baseColor *= 0.5; }" });
		const first = renderer.prepareMaterial(badMaterial);
		const second = renderer.prepareMaterial(badMaterial);
		const goodBefore = renderer.prepareMaterial(goodMaterial);
		const afterBad = errorList.map((graphicError) => ({ kind: graphicError.kind, name: graphicError.name, hasError: graphicError.error instanceof Error }));
		// 컨텍스트를 잃은 뒤의 실패. (옳은 머티리얼이라도 잃은 컨텍스트에서는 짓지 못한다)
		const lostMaterial = renderer.createMaterial({ name: "lostMaterial", surfaceChunk: "void applySurface(inout ToonSurface surface) { surface.baseColor *= 0.25; }" });
		const extension = gl.getExtension("WEBGL_lose_context");
		const canvas = engine.getCanvas();
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
		const lostResult = renderer.prepareMaterial(lostMaterial);
		const errorCountAfterLost = errorList.length;
		await sleepFrames(3);
		const restoredPromise = waitEvent("webglcontextrestored");
		extension.restoreContext();
		const restoredSeen = await restoredPromise;
		await sleepFrames(3);
		const restoredResult = renderer.prepareMaterial(lostMaterial);
		return { kindValue: GraphicErrorKind.shaderBuildFailed, first, second, goodBefore, afterBad, lostSeen, lostResult, errorCountAfterLost, restoredSeen, restoredResult, errorCountEnd: errorList.length };
	});
}
finally {
	await browser.close();
	server.close();
}

console.log("  틀린 머티리얼 짓기 " + result.first + "/" + result.second + ", 받은 알림 " + JSON.stringify(result.afterBad) + ", 잃은 뒤 짓기 " + result.lostResult + ", 되살린 뒤 짓기 " + result.restoredResult);
check(result.kindValue === "shaderBuildFailed", "GraphicErrorKind.shaderBuildFailed 값");
check(result.first === false && result.second === false, "틀린 셰이더는 지어지지 않음");
check(result.goodBefore === true, "옳은 머티리얼은 지어짐");
check(result.afterBad.length === 1, "틀린 머티리얼 알림 " + result.afterBad.length + " 번 (한 번이어야)");
check(result.afterBad[0].kind === "shaderBuildFailed" && result.afterBad[0].name.includes("badMaterial") && result.afterBad[0].hasError, "알림의 kind, name, error");
check(result.lostSeen && result.restoredSeen, "잃음과 되살림 사건이 옴");
check(result.lostResult === false, "잃은 컨텍스트에서는 지어지지 않음");
check(result.errorCountAfterLost === 1, "잃은 뒤 실패는 알리지 않음 (알림 " + result.errorCountAfterLost + ")");
check(result.restoredResult === true, "잃은 뒤의 실패를 기억하지 않아 되살린 뒤 지어짐");
check(result.errorCountEnd === 1, "끝까지 알림 한 번");
console.log("셰이더 짓기 실패 알림 크롬 시험 통과 (" + checkCount + " 검사)");
