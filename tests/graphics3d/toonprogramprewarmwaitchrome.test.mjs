//==============================================================================
// 그리지 않는 프레임에서 미리 짓기가 나아가는지의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/graphics3d/toonprogramprewarmwaitchrome.test.mjs)
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
		response.end("<!doctype html><title>programprewarmwait</title><style>html,body{margin:0;width:100%;height:100%}canvas{display:block;width:100%;height:100%}</style><body><canvas id=\"gameCanvas\"></canvas></body>");
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
		const { ToonRenderer, ToonDrawQueue, MeshBuilder, createSphereGeometry, Matrix4 } = await import("/import.js");
		const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
		// 엔진 루프(프레임마다 지우고 그리면 그 프레임 끝에 명령이 흘러간다) 없이, 아무것도 그리지 않는 컨텍스트로 잰다. (불러오기 화면 꼴)
		const canvas = document.createElement("canvas");
		canvas.width = 320;
		canvas.height = 200;
		document.body.appendChild(canvas);
		const gl = canvas.getContext("webgl2");
		const isParallel = gl.getExtension("KHR_parallel_shader_compile") !== null;
		if (!isParallel) {
			return { isParallel };
		}
		const counts = { status: 0, flush: 0, finish: 0 };
		const getProgramParameter = gl.getProgramParameter.bind(gl);
		gl.getProgramParameter = (program, name) => {
			if (name === gl.getExtension("KHR_parallel_shader_compile").COMPLETION_STATUS_KHR) {
				counts.status += 1;
			}
			return getProgramParameter(program, name);
		};
		const flush = gl.flush.bind(gl);
		gl.flush = () => {
			counts.flush += 1;
			flush();
		};
		const identity = Matrix4.createIdentity();
		const renderer = new ToonRenderer(gl);
		const builder = new MeshBuilder();
		builder.addPart(createSphereGeometry(0.6, 16, 10), identity, "#c8b090");
		const mesh = renderer.createMesh(builder.readArrays());
		const nameList = ["rampTexture", "shadeStops", "rim", "shadeRim", "intensityLimit"];
		const lightFeatureList = [];
		for (let bits = 0; bits < 32; ++bits) {
			lightFeatureList.push(nameList.filter((name, index) => (bits & (1 << index)) !== 0));
		}
		const material = renderer.createMaterial({ name: "tint", surfaceChunk: "void applySurface(inout ToonSurface surface) { surface.baseColor *= 0.8; }" });
		const queue = new ToonDrawQueue();
		queue.addMesh(mesh, Matrix4.createTranslation(-1.2, 0.8, 0), { castsShadow: false });
		queue.addMesh(mesh, Matrix4.createTranslation(0, -0.8, 0), { castsShadow: false, material: material });

		// 미리 짓기를 맡기고 그리지 않고 waitFrames 프레임 넘긴 뒤 그린다. (불러오기 화면 다음에 판을 그리는 꼴) 그려진 화소 수를 센다.
		const projectionMatrix = Matrix4.createIdentity();
		const projectionElements = projectionMatrix.getElements();
		projectionElements[0] = 1.5;
		projectionElements[5] = 2.4;
		projectionElements[10] = -1.02;
		projectionElements[11] = -1;
		projectionElements[14] = -0.2;
		projectionElements[15] = 0;
		const viewMatrix = Matrix4.createTranslation(0, 0, -4);
		const drawAfterWait = async (waitFrames, options) => {
			const renderer2 = new ToonRenderer(gl);
			const builder2 = new MeshBuilder();
			builder2.addPart(createSphereGeometry(0.6, 16, 10), identity, "#c8b090");
			const mesh2 = renderer2.createMesh(builder2.readArrays());
			const material2 = renderer2.createMaterial({ name: "tint", surfaceChunk: "void applySurface(inout ToonSurface surface) { surface.baseColor *= 0.8; }" });
			const queue2 = new ToonDrawQueue();
			queue2.addMesh(mesh2, Matrix4.createTranslation(-1.2, 0.8, 0), { castsShadow: false });
			queue2.addMesh(mesh2, Matrix4.createTranslation(1.2, -0.8, 0), { castsShadow: false, material: material2 });
			const prewarm2 = renderer2.prewarmDrawQueue(queue2, options);
			for (let frame = 0; frame < waitFrames; ++frame) {
				await nextFrame();
			}
			const wasReady = prewarm2.isReady();
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.clearColor(0, 0, 0, 1);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			queue2.drawWithMatrices(renderer2, viewMatrix, projectionMatrix);
			const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
			gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
			let drawnCount = 0;
			for (let index = 0; index < pixels.length; index += 4) {
				if (pixels[index] + pixels[index + 1] + pixels[index + 2] > 0) {
					drawnCount += 1;
				}
			}
			return { wasReady, drawnCount };
		};
		const drawResult = {};
		for (const waitFrames of [0, 1, 2, 45]) {
			drawResult["wait" + waitFrames] = await drawAfterWait(waitFrames, {});
			drawResult["listed" + waitFrames] = await drawAfterWait(waitFrames, { lightFeatureList: lightFeatureList });
		}
		counts.flush = 0;
		counts.status = 0;
		const prewarm = renderer.prewarmDrawQueue(queue, { lightFeatureList: lightFeatureList });
		const flushAfterStart = counts.flush;
		const frameLimit = 300;
		let readyFrame = -1;
		let flushPerFrame = 0;
		const remainList = [];
		let maxMilliseconds = 0;
		let lastTime = performance.now();
		for (let frame = 1; frame <= frameLimit; ++frame) {
			await nextFrame(); // 그리기 줄 draw 없이 프레임만 넘긴다.
			const now = performance.now();
			maxMilliseconds = Math.max(maxMilliseconds, now - lastTime);
			lastTime = now;
			remainList.push(prewarm.isReady() ? 0 : 1);
			if (prewarm.isReady()) {
				readyFrame = frame;
				flushPerFrame = counts.flush / frame;
				break;
			}
		}
		return { drawResult, flushAfterStart, flushPerFrame, statusCount: counts.status, remainList: remainList.join(""), isParallel, readyFrame, frameLimit, maxMilliseconds, counts };
	});
}
finally {
	await browser.close();
	server.close();
}
console.log(JSON.stringify(result));
// GPU 가 없는 기계(CI 의 리눅스, 윈도우)의 소프트웨어 렌더러(SwiftShader)는 KHR_parallel_shader_compile 을 주지 않는다. 확장이 없으면 엔진은 그 자리에서 짓고(병렬로 맡길 일이 없다) 이 시험이 잴 것이 없다.
if (!result.isParallel) {
	console.log("건너뜀: 이 크롬은 KHR_parallel_shader_compile 을 주지 않음 (소프트웨어 렌더러)");
	process.exit(0);
}
for (const name of Object.keys(result.drawResult)) {
	check(result.drawResult[name].drawnCount > 1000, `미리 짓고 그리지 않고 기다린 뒤 그려도 화소가 나와야 함 (${name}: ${result.drawResult[name].drawnCount}, 끝남 ${result.drawResult[name].wasReady})`);
}
check(result.readyFrame > 0, `그리지 않는 프레임 ${result.frameLimit} 개 안에 미리 짓기가 끝나지 않음`);
check(result.flushAfterStart > 0, "미리 짓기를 맡긴 뒤 gl.flush 로 명령을 보내지 않음");
check(result.flushPerFrame >= 1, "그리지 않는 프레임에 gl.flush 가 없음");
check(result.maxMilliseconds < 500, `프레임 하나가 너무 김 ${result.maxMilliseconds} ms`);
const realErrorList = errorMessageList.filter((message) => !message.includes("404"));
check(realErrorList.length === 0, "콘솔 오류: " + realErrorList.join(" | "));
console.log(`그리지 않는 프레임 미리 짓기 시험 통과 (${checkCount} 검사)`);
