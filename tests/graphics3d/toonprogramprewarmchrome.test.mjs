//==============================================================================
// 프로그램 변형 미리 짓기의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/graphics3d/toonprogramprewarmchrome.test.mjs)
// - 헤드리스 크롬(창을 띄우지 않는다)에서 처음 보는 기능 조합(머티리얼, 인스턴스 꼴, 몸 기능 비트)을 그리는 첫 프레임을 센다.
// - 미리 짓기 없이는 그 프레임에 프로그램 짓기(compileShader, linkProgram)가 있고, 미리 짓기 뒤에는 0 번이다.
// - 미리 짓기가 끝나기 전에 그려도 같은 화면이다. 화면 바이트는 세 갈래 모두 같다.
//   puppeteer-core 나 크롬이 없으면 실패한다. (말없이 건너뛰지 않는다)
//==============================================================================
const System = globalThis;
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";

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
		response.end("<!doctype html><title>programprewarm</title><style>html,body{margin:0;width:100%;height:100%}canvas{display:block;width:100%;height:100%}</style><body><canvas id=\"gameCanvas\"></canvas></body>");
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
	await page.goto("http://127.0.0.1:" + port + "/");
	result = await page.evaluate(async () => {
		const { Engine, EngineConfiguration, Scene, Vector2, ToonRenderer, ToonDrawQueue, MeshBuilder, createSphereGeometry, Matrix4 } = await import("/import.js");
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
		const counts = { compile: 0, link: 0 };
		const compileShader = gl.compileShader.bind(gl);
		const linkProgram = gl.linkProgram.bind(gl);
		gl.compileShader = (shader) => {
			counts.compile += 1;
			compileShader(shader);
		};
		gl.linkProgram = (program) => {
			counts.link += 1;
			linkProgram(program);
		};
		const identity = Matrix4.createIdentity();
		const viewMatrix = Matrix4.createTranslation(0, 0, -4);
		const projectionMatrix = Matrix4.createIdentity();
		const projectionElements = projectionMatrix.getElements();
		projectionElements[0] = 1.5;
		projectionElements[5] = 2.4;
		projectionElements[10] = -1.02;
		projectionElements[11] = -1;
		projectionElements[14] = -0.2;
		projectionElements[15] = 0;
		// 렌더러 하나와 그것이 그릴 장면. (몸 기능 비트가 다른 셋: 빛 묶음의 림, 머티리얼, 인스턴스 꼴)
		const createScene = () => {
			const renderer = new ToonRenderer(gl);
			const builder = new MeshBuilder();
			builder.addPart(createSphereGeometry(0.6, 16, 10), identity, "#c8b090");
			const mesh = renderer.createMesh(builder.readArrays());
			const material = renderer.createMaterial({ name: "tint", surfaceChunk: "void applySurface(inout ToonSurface surface) { surface.baseColor *= 0.8; }" });
			const instanceLayout = renderer.createInstanceLayout([{ name: "instanceMatrix", size: 16 }, { name: "instanceTint", size: 4 }]);
			const instanceData = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -1.6, -1, 0, 1, 1, 0.6, 0.6, 1]);
			const instanceBuffer = renderer.createInstanceBuffer(instanceLayout, instanceData);
			const rimLightSet = renderer.createLightSet();
			rimLightSet.setRimLight([0.6, 0.65, 0.8], 2.5, 0, 1);
			const queue = new ToonDrawQueue();
			queue.addMesh(mesh, Matrix4.createTranslation(-1.2, 0.8, 0), { castsShadow: false });
			queue.addMesh(mesh, Matrix4.createTranslation(1.2, 0.8, 0), { castsShadow: false, lightSet: rimLightSet });
			queue.addMesh(mesh, Matrix4.createTranslation(0, -0.8, 0), { castsShadow: false, material: material });
			queue.addMeshInstanceBuffer(mesh, instanceBuffer, 1, { castsShadow: false, material: material });
			return { renderer, queue, material };
		};
		const drawFrame = (scene) => {
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.clearColor(0.2, 0.3, 0.4, 1);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			counts.compile = 0;
			counts.link = 0;
			const startTime = performance.now();
			scene.queue.drawWithMatrices(scene.renderer, viewMatrix, projectionMatrix);
			const milliseconds = performance.now() - startTime;
			const built = { compile: counts.compile, link: counts.link };
			const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
			gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
			let hash = 2166136261;
			for (let index = 0; index < pixels.length; ++index) {
				hash = Math.imul(hash ^ pixels[index], 16777619) >>> 0;
			}
			return { built, hash, milliseconds };
		};
		const isParallel = gl.getExtension("KHR_parallel_shader_compile") !== null;
		// 1. 미리 짓기 없이.
		const plain = createScene();
		const plainFrame = drawFrame(plain);
		const plainSecond = drawFrame(plain);
		// 2. 미리 짓고 끝난 뒤.
		const warmed = createScene();
		counts.compile = 0;
		counts.link = 0;
		const prewarm = warmed.renderer.prewarmDrawQueue(warmed.queue);
		const wasReadyAtOnce = prewarm.isReady();
		await prewarm.wait();
		const prewarmBuilt = { compile: counts.compile, link: counts.link };
		const warmedFrame = drawFrame(warmed);
		const warmedSecond = drawFrame(warmed);
		// 3. 미리 짓기가 끝나기 전에 그린다. (그 자리에서 지어 쓰고 같은 화면)
		const early = createScene();
		const earlyPrewarm = early.renderer.prewarmDrawQueue(early.queue);
		const earlyFrame = drawFrame(early);
		await earlyPrewarm.wait();
		const earlySecond = drawFrame(early);
		// 4. 미리 짓고 머티리얼을 지우면 맡긴 것도 지운다. (오류 없이)
		const deleted = createScene();
		deleted.renderer.prewarmDrawQueue(deleted.queue);
		deleted.renderer.deleteMaterial(deleted.material);
		const deletedPrewarm = deleted.renderer.prewarmDrawQueue(deleted.queue);
		await deletedPrewarm.wait();
		return { isParallel, plainFrame, plainSecond, wasReadyAtOnce, prewarmBuilt, warmedFrame, warmedSecond, earlyFrame, earlySecond, earlyReady: earlyPrewarm.isReady(), deletedReady: deletedPrewarm.isReady() };
	});
}
finally {
	await browser.close();
	server.close();
}

console.log("  첫 프레임 그리기 시간(ms) 미리 짓기 없이 " + result.plainFrame.milliseconds.toFixed(1) + ", 미리 짓기 뒤 " + result.warmedFrame.milliseconds.toFixed(1) + ", 둘째 프레임 " + result.plainSecond.milliseconds.toFixed(1));
console.log("  병렬 컴파일 확장 " + result.isParallel + ", 첫 프레임 짓기(미리 짓기 없이) " + JSON.stringify(result.plainFrame.built) + ", 미리 짓기가 지은 것 " + JSON.stringify(result.prewarmBuilt) + ", 미리 짓기 뒤 첫 프레임 " + JSON.stringify(result.warmedFrame.built) + ", 끝나기 전에 그린 프레임 " + JSON.stringify(result.earlyFrame.built));
check(result.plainFrame.built.compile > 0 && result.plainFrame.built.link > 0, "미리 짓기 없이는 첫 프레임에 프로그램을 지음");
check(result.plainSecond.built.compile === 0, "미리 짓기 없이도 둘째 프레임은 짓지 않음");
check(result.prewarmBuilt.compile > 0 && result.prewarmBuilt.link > 0, "미리 짓기가 프로그램을 지음");
check(result.warmedFrame.built.compile === 0 && result.warmedFrame.built.link === 0, "미리 짓기 뒤 첫 프레임에 프로그램 짓기 0 번 (" + JSON.stringify(result.warmedFrame.built) + ")");
check(result.warmedSecond.built.compile === 0, "미리 짓기 뒤 둘째 프레임도 0 번");
check(result.earlyFrame.hash === result.plainFrame.hash, "끝나기 전에 그린 화면이 미리 짓기 없는 화면과 같음");
check(result.earlySecond.hash === result.plainFrame.hash && result.earlySecond.built.compile === 0, "미리 짓기가 끝난 뒤에도 같은 화면, 더 짓지 않음");
check(result.warmedFrame.hash === result.plainFrame.hash && result.warmedSecond.hash === result.plainFrame.hash, "미리 지은 화면이 미리 짓기 없는 화면과 바이트까지 같음");
check(result.earlyReady === true, "wait 가 풀린 뒤 isReady");
check(result.isParallel ? result.wasReadyAtOnce === false : result.wasReadyAtOnce === true, "확장이 없으면 호출 안에서 끝, 있으면 맡기고 돌아옴");
check(result.deletedReady === true, "머티리얼을 지운 뒤에도 미리 짓기가 끝남");
const scriptErrorList = errorMessageList.filter((message) => message.startsWith("pageerror") || message.includes("ToonRenderer"));
check(scriptErrorList.length === 0, "스크립트 오류 없음: " + scriptErrorList.join(" | "));
console.log("프로그램 변형 미리 짓기 크롬 시험 통과 (" + checkCount + " 검사)");
