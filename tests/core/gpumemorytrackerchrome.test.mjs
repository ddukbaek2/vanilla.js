//==============================================================================
// GPU 메모리 셈의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/core/gpumemorytrackerchrome.test.mjs)
// - 헤드리스 크롬(창을 띄우지 않는다)에서 컨텍스트에 셈을 걸고, 텍스처(texImage2D, texStorage2D 밉 단계, generateMipmap), 렌더버퍼(멀티샘플), 버퍼(bufferData 크기와 데이터)를 지어
//   셈한 바이트가 손으로 센 값과 같은지, 지우면 빠지는지, 주인 이름에 지은 자리가 드는지, 컨텍스트를 잃으면 비는지 본다.
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
		response.end("<!doctype html><title>gpumemorytracker</title><style>html,body{margin:0;width:100%;height:100%}canvas{display:block;width:100%;height:100%}</style><body><canvas id=\"gameCanvas\"></canvas></body>");
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
try {
	const page = await browser.newPage();
	await gotoPage(page, "http://127.0.0.1:" + port + "/");
	result = await page.evaluate(async () => {
		const { GpuMemoryTracker } = await import("/import.js");
		const canvas = document.createElement("canvas");
		canvas.width = 64;
		canvas.height = 64;
		document.body.appendChild(canvas);
		const gl = canvas.getContext("webgl2", { antialias: false });
		const tracker = GpuMemoryTracker.attach(gl);
		const isSameTracker = GpuMemoryTracker.attach(gl) === tracker;
		const readKind = (kind) => tracker.readUsage().kindTable[kind];
		const out = { isSameTracker };
		function buildTexture() {
			const texture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texStorage2D(gl.TEXTURE_2D, 3, gl.RGBA8, 16, 16); // 16x16 + 8x8 + 4x4 = 336 화소, 4 바이트
			return texture;
		}
		const storageTexture = buildTexture();
		out.storage = readKind("texture").bytes;
		const imageTexture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, imageTexture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 8, 4, 0, gl.RGBA, gl.HALF_FLOAT, null); // 32 화소 x 8 바이트
		out.afterImage = readKind("texture").bytes - out.storage;
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 8, 4, 0, gl.RGBA, gl.HALF_FLOAT, null); // 같은 단계를 다시 정하면 더하지 않는다.
		out.afterImageAgain = readKind("texture").bytes - out.storage;
		const canvasSource = document.createElement("canvas");
		canvasSource.width = 4;
		canvasSource.height = 2;
		const sourceTexture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvasSource); // 짧은 꼴, 8 화소 x 4 바이트
		out.afterSource = readKind("texture").bytes - out.storage - out.afterImage;
		gl.generateMipmap(gl.TEXTURE_2D); // 4x2 -> 2x1 -> 1x1, 3 화소 더
		out.afterMipmap = readKind("texture").bytes - out.storage - out.afterImage - out.afterSource;
		const renderbuffer = gl.createRenderbuffer();
		gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
		gl.renderbufferStorageMultisample(gl.RENDERBUFFER, 4, gl.RGBA8, 10, 10); // 100 x 4 x 4
		out.multisample = readKind("renderbuffer").bytes;
		const plainRenderbuffer = gl.createRenderbuffer();
		gl.bindRenderbuffer(gl.RENDERBUFFER, plainRenderbuffer);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, 10, 10); // 100 x 4
		out.afterPlain = readKind("renderbuffer").bytes - out.multisample;
		const arrayBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, arrayBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, 1000, gl.DYNAMIC_DRAW);
		const dataBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, dataBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(25), gl.STATIC_DRAW); // 100 바이트
		const rangeBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, rangeBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(25), gl.STATIC_DRAW, 5, 10); // 원소 10 개 = 40 바이트
		const elementBuffer = gl.createBuffer();
		const vertexArray = gl.createVertexArray();
		gl.bindVertexArray(vertexArray);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elementBuffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(30), gl.STATIC_DRAW); // 60 바이트
		gl.bindVertexArray(null);
		out.buffer = readKind("buffer").bytes;
		out.bufferCount = readKind("buffer").count;
		out.owner = tracker.readUsage().ownerList.find((ownerUsage) => ownerUsage.kind === "texture").owner;
		// 지우면 빠진다.
		gl.deleteTexture(storageTexture);
		out.afterDelete = readKind("texture").bytes;
		gl.deleteBuffer(arrayBuffer);
		out.afterBufferDelete = readKind("buffer").bytes;
		out.canvasBytes = tracker.readUsage().canvasBytes; // antialias 끔: 64 x 64 x 8
		// 컨텍스트를 잃으면 빈다.
		canvas.addEventListener("webglcontextlost", (event) => event.preventDefault());
		const lostPromise = new Promise((resolve) => canvas.addEventListener("webglcontextlost", () => resolve(), { once: true }));
		gl.getExtension("WEBGL_lose_context").loseContext();
		await lostPromise;
		const lostUsage = tracker.readUsage();
		out.lostTotal = lostUsage.totalBytes;
		out.lostCanvas = lostUsage.canvasBytes;
		// 엔진은 기본으로 셈을 걸지 않는다. (GL 짓기 호출이 브라우저 본디 함수 그대로, 켜면 그때부터 가로챈다)
		const { Engine, EngineConfiguration } = await import("/import.js");
		const engineConfiguration = new EngineConfiguration();
		engineConfiguration.canvasId = "gameCanvas";
		const engine = new Engine(engineConfiguration);
		const engineGl = document.getElementById("gameCanvas").getContext("webgl2");
		out.offEnabled = engine.isGpuMemoryTrackingEnabled();
		out.offHooked = engineGl.createTexture.name === "vanillaGpuMemoryTrackerHook" || engineGl.texImage2D.name === "vanillaGpuMemoryTrackerHook";
		engine.enableGpuMemoryTracking();
		out.onEnabled = engine.isGpuMemoryTrackingEnabled();
		out.onHooked = engineGl.createTexture.name === "vanillaGpuMemoryTrackerHook";
		const afterTexture = engineGl.createTexture();
		engineGl.bindTexture(engineGl.TEXTURE_2D, afterTexture);
		engineGl.texStorage2D(engineGl.TEXTURE_2D, 1, engineGl.RGBA8, 8, 8);
		const engineUsage = engine.readGpuMemoryUsage();
		out.engineTexture = engineUsage.kindTable.texture.bytes;
		out.engineOwner = engineUsage.ownerList.length > 0 ? engineUsage.ownerList[0].owner : "";
		return out;
	});
}
finally {
	await browser.close();
	server.close();
}

check(result.isSameTracker, "같은 컨텍스트에는 하나만 건다");
check(result.storage === 336 * 4, "texStorage2D 밉 셋 " + result.storage + " (1344 이어야)");
check(result.afterImage === 32 * 8, "texImage2D RGBA16F " + result.afterImage + " (256 이어야)");
check(result.afterImageAgain === result.afterImage, "같은 단계를 다시 정해도 더하지 않음 " + result.afterImageAgain);
check(result.afterSource === 8 * 4, "texImage2D 짧은 꼴(원본 크기) " + result.afterSource + " (32 이어야)");
check(result.afterMipmap === 3 * 4, "generateMipmap 이 더한 밉 " + result.afterMipmap + " (12 이어야)");
check(result.multisample === 100 * 4 * 4, "멀티샘플 렌더버퍼는 샘플 수를 곱함 " + result.multisample + " (1600 이어야)");
check(result.afterPlain === 100 * 4, "렌더버퍼 DEPTH24_STENCIL8 " + result.afterPlain + " (400 이어야)");
check(result.buffer === 1000 + 100 + 40 + 60, "bufferData 크기, 데이터, 원소 범위, 요소 버퍼 " + result.buffer + " (1200 이어야)");
check(result.bufferCount === 4, "버퍼 수 " + result.bufferCount);
check(result.afterDelete === result.afterImage + result.afterSource + result.afterMipmap, "deleteTexture 가 뺌 " + result.afterDelete);
check(result.afterBufferDelete === 200, "deleteBuffer 가 뺌 " + result.afterBufferDelete + " (200 이어야)");
check(result.canvasBytes === 64 * 64 * 8, "캔버스 몫(antialias 끔) " + result.canvasBytes);
check(result.owner.includes("buildTexture") || result.owner.includes("evaluate"), "주인 이름에 지은 자리가 듦 " + result.owner);
check(result.lostTotal === 0 && result.lostCanvas === 0, "컨텍스트를 잃으면 비움 " + result.lostTotal);
check(result.offEnabled === false && result.offHooked === false, "엔진은 기본으로 셈을 걸지 않음 " + result.offEnabled + " " + result.offHooked);
check(result.onEnabled === true && result.onHooked === true, "enableGpuMemoryTracking 이 켬 " + result.onEnabled + " " + result.onHooked);
check(result.engineTexture === 8 * 8 * 4, "켠 뒤에 지은 텍스처부터 셈 " + result.engineTexture + " (256 이어야)");
console.log("GPU 메모리 셈 크롬 시험 통과 (" + checkCount + " 검사)");
