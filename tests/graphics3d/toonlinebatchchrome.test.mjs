//==============================================================================
// 툰 선의 판 묶음 자리의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/graphics3d/toonlinebatchchrome.test.mjs)
// - 헤드리스 크롬(창을 띄우지 않는다)에서 본다.
//   1. 멈춘 프레임(행렬과 번호가 앞 프레임과 같음)에는 선의 판 묶음 그리기가 꼭짓점 버퍼를 올리지 않는다. (bufferData 0)
//   2. 한 모형 묶음의 행렬 하나만 바뀌면 그 묶음 하나만 올린다. (나머지 묶음은 올림 없음)
//   3. 다시 올리든 안 올리든 화면은 같다. (멈춘 프레임의 바이트가 같고, 바뀐 프레임은 바꾼 행렬로 처음부터 그린 화면과 바이트까지 같다)
//   puppeteer-core 나 크롬이 없으면 실패한다. (말없이 건너뛰지 않는다)
//==============================================================================
const System = globalThis;
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";
import { gotoPage } from "../chromepage.mjs";

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

const SIZE = 96;
const server = http.createServer((request, response) => {
	const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
	if (requestPath === "/") {
		response.writeHead(200, { "Content-Type": "text/html" });
		response.end(`<!doctype html><title>linebatch</title><body><canvas id="mainCanvas" width="${SIZE}" height="${SIZE}"></canvas><canvas id="referenceCanvas" width="${SIZE}" height="${SIZE}"></canvas></body>`);
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
try {
	const page = await browser.newPage();
	await gotoPage(page, "http://127.0.0.1:" + port + "/");
	result = await page.evaluate(async (size) => {
		const { ToonRenderer, ToonDrawQueue, ToonScreenOutline, MeshBuilder, createBoxGeometry, createSphereGeometry, Camera3D, Matrix4, Vector3 } = await import("/import.js");
		// 같은 장면을 두 컨텍스트에 짓는다. main 은 프레임을 이어 그리고, reference 는 프레임마다 새로 지어 그린다. (묶음 자리가 비어 있어 늘 올린다)
		const createSide = (canvasId) => {
			const gl = document.getElementById(canvasId).getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
			const side = { gl: gl, lineUploadCount: 0, otherUploadCount: 0 };
			const originalBufferData = gl.bufferData.bind(gl);
			let isLineBatch = false;
			gl.bufferData = (...args) => {
				if (args[0] === gl.ARRAY_BUFFER) {
					if (isLineBatch) {
						side.lineUploadCount += 1;
					}
					else {
						side.otherUploadCount += 1;
					}
				}
				return originalBufferData(...args);
			};
			const renderer = new ToonRenderer(gl);
			const createMesh = (geometry) => {
				const builder = new MeshBuilder();
				builder.addPart(geometry, Matrix4.createIdentity(), "#e0d0c0", { hasOutline: true });
				return renderer.createMesh(builder.readArrays());
			};
			const boxMesh = createMesh(createBoxGeometry(0.5, 0.5, 0.5));
			const sphereMesh = createMesh(createSphereGeometry(0.3, 12, 8));
			const screenOutline = new ToonScreenOutline(gl);
			screenOutline.setWidth(1);
			const originalBatch = screenOutline.drawMeshBatch.bind(screenOutline);
			screenOutline.drawMeshBatch = (...args) => {
				isLineBatch = true;
				originalBatch(...args);
				isLineBatch = false;
			};
			const queue = new ToonDrawQueue();
			queue.setScreenOutline(screenOutline);
			const camera = new Camera3D();
			camera.setPerspective(0.9, 0.1, 30);
			camera.setAspectRatio(1);
			camera.lookAt(Vector3.create(0, 4, 5), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
			const matrixList = [];
			for (let index = 0; index < 9; ++index) {
				const modelMatrix = Matrix4.createTranslation((index % 5) * 0.9 - 1.8, 0.25, Math.floor(index / 5) * 0.9 - 1.2);
				modelMatrix.multiply(Matrix4.createRotationY(index * 0.4));
				matrixList.push(modelMatrix);
			}
			side.matrixList = matrixList;
			side.drawFrame = () => {
				side.lineUploadCount = 0;
				side.otherUploadCount = 0;
				gl.bindFramebuffer(gl.FRAMEBUFFER, null);
				gl.viewport(0, 0, size, size);
				gl.clearColor(0.4, 0.5, 0.6, 1);
				gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
				queue.clear();
				for (let index = 0; index < 9; ++index) {
					queue.addMesh(index < 6 ? boxMesh : sphereMesh, matrixList[index], { lineId: 2 + index });
				}
				queue.draw(renderer, camera);
				gl.finish();
				const pixels = new Uint8Array(size * size * 4);
				gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
				return pixels;
			};
			return side;
		};
		const countDifferent = (first, second) => {
			let differentCount = 0;
			for (let index = 0; index < first.length; ++index) {
				if (first[index] !== second[index]) {
					differentCount += 1;
				}
			}
			return differentCount;
		};
		const main = createSide("mainCanvas");
		const reference = createSide("referenceCanvas");
		const frames = [];
		const firstPixels = main.drawFrame();
		frames.push({ lineUploadCount: main.lineUploadCount });
		const stillPixels = main.drawFrame();
		frames.push({ lineUploadCount: main.lineUploadCount, differentCount: countDifferent(firstPixels, stillPixels) });
		const stillAgainPixels = main.drawFrame();
		frames.push({ lineUploadCount: main.lineUploadCount, differentCount: countDifferent(stillPixels, stillAgainPixels) });
		// 상자 묶음의 행렬 하나를 옮긴다.
		for (const side of [main, reference]) {
			side.matrixList[2] = Matrix4.createTranslation(0.3, 0.25, -0.6);
		}
		const movedPixels = main.drawFrame();
		const referencePixels = reference.drawFrame();
		frames.push({ lineUploadCount: main.lineUploadCount, differentCount: countDifferent(movedPixels, referencePixels), changedCount: countDifferent(stillPixels, movedPixels) });
		const settledPixels = main.drawFrame();
		frames.push({ lineUploadCount: main.lineUploadCount, differentCount: countDifferent(movedPixels, settledPixels) });
		return { frames: frames, error: main.gl.getError() + reference.gl.getError() };
	}, SIZE);
}
finally {
	await browser.close();
	server.close();
}
const frames = result.frames;
check(frames[0].lineUploadCount === 2, "처음 프레임은 묶음 둘(상자 6, 공 3)을 올림 (" + frames[0].lineUploadCount + ")");
check(frames[1].lineUploadCount === 0 && frames[2].lineUploadCount === 0, "멈춘 프레임은 선의 판 묶음 올림 0 (" + frames[1].lineUploadCount + ", " + frames[2].lineUploadCount + ")");
check(frames[1].differentCount === 0 && frames[2].differentCount === 0, "멈춘 프레임의 화면은 앞 프레임과 바이트까지 같음 (" + frames[1].differentCount + ", " + frames[2].differentCount + ")");
check(frames[3].lineUploadCount === 1, "행렬 하나가 바뀌면 그 묶음 하나만 올림 (" + frames[3].lineUploadCount + ")");
check(frames[3].changedCount > 0, "옮긴 프레임은 화면이 바뀜 (" + frames[3].changedCount + ")");
check(frames[3].differentCount === 0, "바뀐 프레임의 화면은 처음부터 그린 것과 바이트까지 같음 (" + frames[3].differentCount + ")");
check(frames[4].lineUploadCount === 0 && frames[4].differentCount === 0, "다시 멈추면 올림 0 이고 화면 같음 (" + frames[4].lineUploadCount + ", " + frames[4].differentCount + ")");
check(result.error === 0, "GL 오류 없음 (" + result.error + ")");
console.log("툰 선의 판 묶음 자리 크롬 시험 통과 (" + checkCount + " 개 확인)");
