//==============================================================================
// 툰 재질 블록과 그리기 줄 정렬의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/graphics3d/toondrawbatchchrome.test.mjs)
// - 헤드리스 크롬(창을 띄우지 않는다)에서 본다.
//   1. 재질 블록(ToonDrawMaterial, std140): 같은 꼴 객체의 값을 그 자리에서 고치거나 칸을 바꾸면 그 프레임에 반영된다. 값이 같으면 새 블록을 올리지 않는다.
//      새 꼴 객체라도 값이 같으면 앞의 블록을 같이 쓴다. 그린 화소는 새 렌더러가 같은 값으로 그린 것과 바이트까지 같다.
//   2. 그리기 줄 정렬: 프레임마다 같은 것을 담으면 앞의 차례를 다시 쓰고, 담는 차례나 재질이 바뀌면 다시 정렬한다. 화면은 새 그리기 줄로 그린 것과 바이트까지 같다.
//   3. 비치는 것은 정렬이 바뀌어도 카메라에서 먼 것부터 섞는다. (담은 차례를 뒤집어도 화면이 같다)
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

const SIZE = 64;
const server = http.createServer((request, response) => {
	const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
	if (requestPath === "/") {
		response.writeHead(200, { "Content-Type": "text/html" });
		response.end(`<!doctype html><title>drawbatch</title><body><canvas id="mainCanvas" width="${SIZE}" height="${SIZE}"></canvas><canvas id="referenceCanvas" width="${SIZE}" height="${SIZE}"></canvas></body>`);
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
		const { ToonRenderer, ToonDrawQueue, ToonMaterial, MeshBuilder, createBoxGeometry, Matrix4, Vector3 } = await import("/import.js");
		const createSide = (canvasId) => {
			const gl = document.getElementById(canvasId).getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
			const side = { gl: gl, blockUploadCount: 0, renderer: new ToonRenderer(gl) };
			const original = gl.bufferData.bind(gl);
			gl.bufferData = (target, ...args) => {
				// 재질 블록(float 44)만 센다. (프레임 블록 ToonFrame 은 float 164)
				if (target === gl.UNIFORM_BUFFER && args[0] !== null && typeof args[0] === "object" && args[0].byteLength === 44 * 4) {
					side.blockUploadCount += 1;
				}
				return original(target, ...args);
			};
			const builder = new MeshBuilder();
			builder.addPart(createBoxGeometry(1, 1, 1), Matrix4.createIdentity(), "#ffffff", { hasOutline: false });
			side.boxMesh = side.renderer.createMesh(builder.readArrays());
			side.material = new ToonMaterial({ name: "batchStripe", surfaceChunk: "void applySurface(inout ToonSurface surface) { surface.baseColor *= 0.8; }" });
			return side;
		};
		const main = createSide("mainCanvas");
		const viewMatrix = Matrix4.createLookAt(Vector3.create(0, 1.5, 5), Vector3.create(0, 0, -1), Vector3.create(0, 1, 0));
		const projectionMatrix = Matrix4.createPerspective(0.9, 1, 0.1, 30);
		const readPixels = (side) => {
			const pixels = new Uint8Array(size * size * 4);
			side.gl.readPixels(0, 0, size, size, side.gl.RGBA, side.gl.UNSIGNED_BYTE, pixels);
			return pixels;
		};
		const isSamePixels = (first, second) => first.every((value, index) => value === second[index]);
		const center = (pixels) => {
			const offset = (size / 2 * size + size / 2) * 4;
			return [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
		};
		const drawDirect = (side, optionsList) => {
			const gl = side.gl;
			gl.clearColor(0, 0, 0, 1);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			side.renderer.beginFrameWithMatrices(viewMatrix, projectionMatrix);
			for (const entry of optionsList) {
				side.renderer.drawMesh(side.boxMesh, entry.matrix, entry.options);
			}
			side.renderer.endFrame();
			return readPixels(side);
		};
		// 새 렌더러로 같은 값을 그린 기준. (재질 블록을 처음 짓는 길)
		const drawReference = (optionsList) => {
			const reference = createSide("referenceCanvas");
			const pixels = drawDirect(reference, optionsList.map((entry) => ({ matrix: entry.matrix, options: JSON.parse(JSON.stringify(entry.options)) })));
			reference.renderer.destroy();
			return pixels;
		};

		// 1. 재질 블록.
		const identity = Matrix4.createIdentity();
		const options = { tintColor: [1, 0.2, 0.2, 1], specularScale: 0.5 };
		const blockResult = [];
		const steps = [
			() => {},
			() => {},
			() => {
				options.tintColor[1] = 0.9;
			},
			() => {
				options.tintColor = [0.2, 0.2, 1, 1];
			},
			() => {
				options.tintAmount = 0.5;
			},
		];
		for (const step of steps) {
			step();
			const uploadStart = main.blockUploadCount;
			const pixels = drawDirect(main, [{ matrix: identity, options: options }]);
			blockResult.push({ center: center(pixels), uploads: main.blockUploadCount - uploadStart, isSameAsReference: isSamePixels(pixels, drawReference([{ matrix: identity, options: options }])) });
		}
		// 새 꼴 객체지만 값이 같으면 앞의 블록을 같이 쓴다.
		const uploadBeforeFresh = main.blockUploadCount;
		drawDirect(main, [{ matrix: identity, options: { tintColor: [0.2, 0.2, 1, 1], specularScale: 0.5, tintAmount: 0.5 } }]);
		const freshUploads = main.blockUploadCount - uploadBeforeFresh;

		// 2. 그리기 줄 정렬과 3. 비치는 것.
		const queue = new ToonDrawQueue();
		const looks = [
			{ tintColor: [1, 0.5, 0.5, 1] },
			{ tintColor: [0.5, 1, 0.5, 1], material: main.material },
			{ tintColor: [0.5, 0.5, 1, 1] },
			{ tintColor: [1, 1, 0.3, 0.5] },
			{ tintColor: [0.3, 1, 1, 0.5] },
		];
		const matrices = [Matrix4.createTranslation(-1.2, 0, -1), Matrix4.createTranslation(0, 0, -2), Matrix4.createTranslation(1.2, 0, -1), Matrix4.createTranslation(-0.3, 0.2, 0.5), Matrix4.createTranslation(0.3, 0.1, -0.6)];
		const drawQueue = (side, targetQueue, orderList) => {
			const gl = side.gl;
			gl.clearColor(0, 0, 0, 1);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			targetQueue.clear();
			for (const index of orderList) {
				targetQueue.addMesh(side.boxMesh, matrices[index], looks[index]);
			}
			targetQueue.drawWithMatrices(side.renderer, viewMatrix, projectionMatrix);
			return readPixels(side);
		};
		const queueResult = [];
		const orders = [[0, 1, 2, 3, 4], [0, 1, 2, 3, 4], [2, 4, 0, 3, 1], [2, 4, 0, 3, 1], [4, 3, 2, 1, 0]];
		for (let frame = 0; frame < orders.length; ++frame) {
			if (frame === 3) {
				looks[2].material = main.material;
			}
			const pixels = drawQueue(main, queue, orders[frame]);
			const reference = createSide("referenceCanvas");
			const referencePixels = drawQueue(reference, new ToonDrawQueue(), orders[frame]);
			reference.renderer.destroy();
			queueResult.push({ isSameAsReference: isSamePixels(pixels, referencePixels), pixels: Array.from(pixels) });
		}
		return { blockResult: blockResult, freshUploads: freshUploads, queueResult: queueResult.map((entry) => entry.isSameAsReference), lastFrames: [queueResult[3].pixels, queueResult[4].pixels], error: main.gl.getError() };
	}, SIZE);
}
finally {
	await browser.close();
	server.close();
}
const blockResult = result.blockResult;
check(blockResult[0].uploads === 1, "첫 그리기는 재질 블록 하나를 지어 올림 (" + blockResult[0].uploads + ")");
check(blockResult[1].uploads === 0, "값이 같으면 다시 올리지 않음 (" + blockResult[1].uploads + ")");
check(blockResult[2].uploads === 1 && blockResult[2].center[1] > blockResult[1].center[1] + 40, "같은 꼴 객체의 틴트를 그 자리에서 고치면 그 프레임에 반영 (" + blockResult[1].center + " → " + blockResult[2].center + ")");
check(blockResult[3].center[2] > blockResult[3].center[0] + 40, "꼴 객체의 틴트 칸을 바꾸면 반영 (" + blockResult[3].center + ")");
check(blockResult[4].uploads === 1 && blockResult[4].center.join() !== blockResult[3].center.join(), "꼴에 새 칸(tintAmount)을 더하면 반영 (" + blockResult[3].center + " → " + blockResult[4].center + ")");
for (let index = 0; index < blockResult.length; ++index) {
	check(blockResult[index].isSameAsReference, index + " 번째 그리기가 새 렌더러로 같은 값을 그린 것과 바이트까지 같음");
}
check(result.freshUploads === 0, "새 꼴 객체라도 값이 같으면 앞의 블록을 같이 씀 (" + result.freshUploads + ")");
for (let frame = 0; frame < result.queueResult.length; ++frame) {
	check(result.queueResult[frame], frame + " 프레임 그리기 줄이 새 그리기 줄로 그린 것과 바이트까지 같음 (정렬 다시 쓰기, 담는 차례, 재질 바꿈)");
}
// 프레임 3 과 4 는 같은 것을 다른 차례로 담았다. 비치는 것 둘(3, 4)은 먼 것부터 섞어 화면이 같다. (불투명한 것은 깊이로 가려 같다)
const [shuffled, reversed] = result.lastFrames;
let differentCount = 0;
for (let index = 0; index < shuffled.length; ++index) {
	if (shuffled[index] !== reversed[index]) {
		differentCount += 1;
	}
}
check(differentCount === 0, "비치는 것은 담은 차례와 상관없이 깊이 차례 (다른 바이트 " + differentCount + ")");
check(result.error === 0, "GL 오류 없음 (" + result.error + ")");
console.log("툰 재질 블록과 그리기 줄 정렬 크롬 시험 통과 (" + checkCount + " 개 확인)");
