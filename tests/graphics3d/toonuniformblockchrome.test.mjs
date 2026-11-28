//==============================================================================
// 툰 유니폼 블록(재질 블록과 프레임 블록 고리)의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/graphics3d/toonuniformblockchrome.test.mjs)
// - 재질 블록: 한 렌더러로 프레임마다 서로 다른 틴트 열을 그려 갈래 한도(1024)를 넘긴다. 한도에 닿아도 버퍼를 지우지 않고(deleteBuffer 0) 짓는 수가 한도를 넘지 않는지,
//   0 프레임에 쓴 뒤 내보내졌을 꼴 객체를 마지막 프레임에 다시 넘겨도 화면이 새 렌더러로 그린 것과 같은지 본다.
// - 프레임 블록: 카메라가 프레임마다 움직여도 프레임 블록 버퍼(장)가 몇 장에서 그치고 지우지 않는지, 한도에 닿은 뒤로는 버퍼를 짓지 않고 있던 버퍼에 쓰는지,
//   고른 프레임의 화면이 새 렌더러(다른 컨텍스트)로 같은 프레임을 그린 것과 화소까지 같은지 본다.
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
		response.end("<!doctype html><title>toonuniformblock</title><body><canvas id=\"canvas\" width=\"160\" height=\"120\"></canvas><canvas id=\"fresh\" width=\"160\" height=\"120\"></canvas></body>");
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
		const { ToonRenderer, MeshBuilder, createBoxGeometry, Matrix4, Vector3 } = await import("/import.js");
		const OBJECT_COUNT = 12;
		const FRAME_COUNT = 110;
		const checkFrameSet = new Set([0, 1, 40, 80, FRAME_COUNT - 1]);
		const pixels = new Uint8Array(160 * 120 * 4);
		const counts = { createBuffer: 0, deleteBuffer: 0, bufferSubData: 0 };
		const createContext = (canvasId, isCounted) => {
			const gl = document.getElementById(canvasId).getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
			if (isCounted) {
				for (const name of Object.keys(counts)) {
					const original = gl[name].bind(gl);
					gl[name] = (...args) => {
						counts[name] += 1;
						return original(...args);
					};
				}
			}
			return gl;
		};
		const createScene = (gl) => {
			const renderer = new ToonRenderer(gl);
			const builder = new MeshBuilder();
			builder.addPart(createBoxGeometry(0.5, 0.5, 0.5), Matrix4.createIdentity(), "#c0c0c0", { hasOutline: true });
			const mesh = renderer.createMesh(builder.readArrays());
			return { gl: gl, renderer: renderer, mesh: mesh };
		};
		const heldOptions = { tintColor: [0.2, 0.9, 0.4, 1] }; // 0 프레임과 마지막 프레임에만 넘기는 꼴. (사이에 한도를 넘겨 내보내진다)
		const drawFrame = (scene, frame) => {
			const { gl, renderer, mesh } = scene;
			gl.viewport(0, 0, 160, 120);
			gl.clearColor(0, 0, 0, 1);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			const angle = frame * 0.05;
			const viewMatrix = Matrix4.createLookAt(Vector3.create(5 * Math.sin(angle), 3, 5 * Math.cos(angle)), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
			const projectionMatrix = Matrix4.createPerspective(0.9, 160 / 120, 0.1, 30);
			renderer.beginFrameWithMatrices(viewMatrix, projectionMatrix);
			for (let index = 0; index < OBJECT_COUNT; ++index) {
				const value = (frame * OBJECT_COUNT + index) / (FRAME_COUNT * OBJECT_COUNT);
				const options = { tintColor: [0.3 + 0.7 * value, 1 - 0.5 * value, 0.5, 1] };
				const x = (index % 4) - 1.5;
				const z = Math.floor(index / 4) - 1;
				renderer.drawMesh(mesh, Matrix4.createTranslation(x * 1.1, 0, z * 1.1), options);
			}
			if (frame === 0 || frame === FRAME_COUNT - 1) {
				renderer.drawMesh(mesh, Matrix4.createTranslation(0, 1.2, 0), heldOptions);
			}
			renderer.endFrame();
			gl.readPixels(0, 0, 160, 120, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
			return pixels.slice();
		};
		const scene = createScene(createContext("canvas", true));
		const freshGl = createContext("fresh", false);
		const createCount = counts.createBuffer;
		const frameList = [];
		let lateCreateCount = 0;
		let lateSubDataCount = 0;
		for (let frame = 0; frame < FRAME_COUNT; ++frame) {
			const createBefore = counts.createBuffer;
			const subDataBefore = counts.bufferSubData;
			const drawn = drawFrame(scene, frame);
			if (frame >= FRAME_COUNT - 10) {
				lateCreateCount += counts.createBuffer - createBefore;
				lateSubDataCount += counts.bufferSubData - subDataBefore;
			}
			if (!checkFrameSet.has(frame)) {
				continue;
			}
			const freshScene = createScene(freshGl);
			// 새 렌더러는 그 프레임 하나만 그린다. (0 프레임의 꼴 객체는 그 프레임에 처음 본다)
			const expected = drawFrame(freshScene, frame);
			freshScene.renderer.destroy();
			let differentCount = 0;
			let litCount = 0;
			for (let index = 0; index < drawn.length; index += 4) {
				if (drawn[index] !== expected[index] || drawn[index + 1] !== expected[index + 1] || drawn[index + 2] !== expected[index + 2]) {
					differentCount += 1;
				}
				if (drawn[index] + drawn[index + 1] + drawn[index + 2] > 0) {
					litCount += 1;
				}
			}
			frameList.push({ frame: frame, differentCount: differentCount, litCount: litCount });
		}
		return { frameList: frameList, createdBuffers: counts.createBuffer - createCount, deletedBuffers: counts.deleteBuffer, lateCreateCount: lateCreateCount, lateSubDataCount: lateSubDataCount, error: scene.gl.getError() };
	});
}
finally {
	await browser.close();
	server.close();
}
const distinctValueCount = 110 * 12 + 1;
check(distinctValueCount > 1024, "재질 값 수가 갈래 한도를 넘음 (" + distinctValueCount + ")");
check(result.error === 0, "GL 오류 없음 (" + result.error + ")");
for (const frame of result.frameList) {
	check(frame.litCount > 500, frame.frame + " 프레임에 그린 것이 있음 (" + frame.litCount + ")");
	check(frame.differentCount === 0, frame.frame + " 프레임 화면이 새 렌더러로 그린 것과 같음 (다른 화소 " + frame.differentCount + ")");
}
check(result.deletedBuffers === 0, "한도를 넘어도 버퍼를 지우지 않음 (deleteBuffer " + result.deletedBuffers + ")");
check(result.createdBuffers <= 1024 + 2 + 16, "짓는 버퍼가 재질 갈래 한도와 프레임 블록 장 몇 장 안 (createBuffer " + result.createdBuffers + ")");
check(result.lateCreateCount === 0, "한도에 닿은 뒤(마지막 10 프레임)는 버퍼를 짓지 않음 (createBuffer " + result.lateCreateCount + ")");
check(result.lateSubDataCount >= 10 * 12, "한도에 닿은 뒤 새 재질 값과 프레임 값은 있던 버퍼에 bufferSubData 로 씀 (" + result.lateSubDataCount + ")");
console.log("툰 유니폼 블록 크롬 시험 통과 (" + checkCount + " 개 확인)");
