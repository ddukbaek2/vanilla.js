//==============================================================================
// 툰 인스턴스 버퍼 길의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/graphics3d/tooninstancebufferchrome.test.mjs)
// - 헤드리스 크롬(창을 띄우지 않는다)에서 광부 mid 꼴 장면(toonminerscene.mjs)을 두 캔버스에 두 길로 그린다.
//   array 는 ToonDrawQueue.addMeshInstanced, buffer 는 addMeshInstanceBuffer. 몸, 바깥선 껍데기, 해 그림자(onChange), 선의 판(인스턴스마다 다른 선 번호, setLineColor 색)을 켠다.
// - 프레임마다 두 길의 화소가 바이트까지 같은지 본다. 바위 하나를 옮기고 틴트와 선 번호를 바꾼 뒤(buffer 는 updateInstanceBufferRange 하나) 다음 프레임에 두 길 모두 바뀌고 같은지 본다.
// - 그림자 캐시: 구워진 뒤 그대로인 프레임은 그림자 깊이를 그리지 않고, 버퍼를 고친 프레임은 다시 굽는다. (버퍼의 generation)
// - 버퍼 올림(bufferData, bufferSubData)을 세어 buffer 길이 프레임마다 인스턴스를 올리지 않는지 본다. 지운 버퍼를 담아도 GL 오류 없이 그리지 않는다.
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

const WIDTH = 240;
const HEIGHT = 160;

// 저장소를 잠깐 내주는 http 서버. (모듈은 file:// 로 못 불러온다)
const server = http.createServer((request, response) => {
	const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
	if (requestPath === "/") {
		response.writeHead(200, { "Content-Type": "text/html" });
		response.end(`<!doctype html><title>instancebuffer</title><body><canvas id="arrayCanvas" width="${WIDTH}" height="${HEIGHT}"></canvas><canvas id="bufferCanvas" width="${WIDTH}" height="${HEIGHT}"></canvas></body>`);
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
	result = await page.evaluate(async (width, height) => {
		const vanilla = await import("/import.js");
		const { createMinerScene } = await import("/tests/graphics3d/toonminerscene.mjs");
		const { Matrix4 } = vanilla;
		// 길마다 컨텍스트와 셈.
		const createSide = (canvasId, path) => {
			const gl = document.getElementById(canvasId).getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
			const side = { gl: gl, uploadCount: 0, shadowDrawCount: 0, isShadowCounting: false, scene: null };
			for (const name of ["bufferData", "bufferSubData"]) {
				const original = gl[name].bind(gl);
				gl[name] = (...args) => {
					side.uploadCount += 1;
					return original(...args);
				};
			}
			for (const name of ["drawElements", "drawElementsInstanced"]) {
				const original = gl[name].bind(gl);
				gl[name] = (...args) => {
					if (side.isShadowCounting) {
						side.shadowDrawCount += 1;
					}
					return original(...args);
				};
			}
			side.scene = createMinerScene(vanilla, gl, width, height, path, 2);
			// 그림자 깊이를 그린 수는 drawShadows 안에서만 센다.
			const queue = side.scene.queue;
			const originalDrawShadows = queue.drawShadows.bind(queue);
			queue.drawShadows = (...args) => {
				side.isShadowCounting = true;
				originalDrawShadows(...args);
				side.isShadowCounting = false;
			};
			return side;
		};
		const arraySide = createSide("arrayCanvas", "array");
		const bufferSide = createSide("bufferCanvas", "buffer");
		const readPixels = (side) => {
			const pixels = new Uint8Array(width * height * 4);
			side.gl.readPixels(0, 0, width, height, side.gl.RGBA, side.gl.UNSIGNED_BYTE, pixels);
			return pixels;
		};
		const countDifferent = (first, second) => {
			let count = 0;
			for (let index = 0; index < first.length; index += 4) {
				if (first[index] !== second[index] || first[index + 1] !== second[index + 1] || first[index + 2] !== second[index + 2] || first[index + 3] !== second[index + 3]) {
					count += 1;
				}
			}
			return count;
		};
		const countBlueLine = (pixels) => {
			let count = 0;
			for (let index = 0; index < pixels.length; index += 4) {
				count += pixels[index + 2] > pixels[index] + 90 && pixels[index + 2] > 110 ? 1 : 0;
			}
			return count;
		};
		const frameList = [];
		let previousBufferPixels = null;
		for (let frame = 0; frame < 75; ++frame) {
			for (const side of [arraySide, bufferSide]) {
				side.uploadCount = 0;
				side.shadowDrawCount = 0;
			}
			if (frame === 40) {
				// 바위 하나를 옮기고 틴트와 선 번호를 바꾼다. (선 번호는 색 표의 파란 번호로)
				for (const side of [arraySide, bufferSide]) {
					const rock = side.scene.readRock(4, 12);
					const elements = rock.modelMatrix.getElements();
					const modelMatrix = Matrix4.createTranslation(elements[12] + 0.45, 0.5, elements[14]);
					side.scene.setRock(4, 12, { modelMatrix: modelMatrix, tintColor: [1, 0.35, 0.3, 1], lineId: 30 });
				}
			}
			const sideResultList = [];
			for (const side of [arraySide, bufferSide]) {
				side.scene.drawFrame();
				sideResultList.push({ pixels: readPixels(side), uploadCount: side.uploadCount, shadowDrawCount: side.shadowDrawCount, error: side.gl.getError() });
			}
			const [arrayResult, bufferResult] = sideResultList;
			frameList.push({
				frame: frame,
				differentCount: countDifferent(arrayResult.pixels, bufferResult.pixels),
				changedFromPrevious: previousBufferPixels === null ? -1 : countDifferent(previousBufferPixels, bufferResult.pixels),
				blueLineCount: countBlueLine(bufferResult.pixels),
				arrayUploadCount: arrayResult.uploadCount,
				bufferUploadCount: bufferResult.uploadCount,
				arrayShadowDrawCount: arrayResult.shadowDrawCount,
				bufferShadowDrawCount: bufferResult.shadowDrawCount,
				arrayError: arrayResult.error,
				bufferError: bufferResult.error,
			});
			previousBufferPixels = bufferResult.pixels;
		}
		// 지운 버퍼로 그리기. (GL 오류 없이 아무것도 그리지 않는다)
		const renderer = bufferSide.scene.renderer;
		const pointLayout = renderer.createInstanceLayout([{ name: "instanceMatrix", size: 16 }]);
		const deleted = renderer.createInstanceBuffer(pointLayout, Matrix4.createIdentity().getElements().slice());
		const generationBeforeDelete = deleted.generation;
		renderer.deleteInstanceBuffer(deleted);
		renderer.beginFrameWithMatrices(Matrix4.createIdentity(), Matrix4.createIdentity());
		renderer.drawMeshInstanceBuffer(bufferSide.scene.rockMeshList[0], deleted, 1);
		const deletedDrawCount = renderer.getFrameStatistics().drawCallCount;
		renderer.endFrame();
		const deletedResult = { generationChanged: deleted.generation !== generationBeforeDelete, drawCallCount: deletedDrawCount, error: bufferSide.gl.getError() };
		// 범위를 넘는 일부 고치기는 던진다.
		const single = renderer.createInstanceBuffer(pointLayout, Matrix4.createIdentity().getElements().slice());
		let isRangeThrown = false;
		try {
			renderer.updateInstanceBufferRange(single, 1, Matrix4.createIdentity().getElements().slice());
		}
		catch (error) {
			isRangeThrown = true;
		}
		renderer.deleteInstanceBuffer(single);
		return { frameList: frameList, deletedResult: deletedResult, isRangeThrown: isRangeThrown, rockCounts: Array.from({ length: arraySide.scene.getBatchCount() }, (value, batch) => arraySide.scene.getRockCount(batch)) };
	}, WIDTH, HEIGHT);
	await page.close();
}
finally {
	await browser.close();
	server.close();
}

const frameList = result.frameList;
console.log("바위 수 " + result.rockCounts.join(", ") + ", 프레임 0 올림 array " + frameList[0].arrayUploadCount + " / buffer " + frameList[0].bufferUploadCount + ", 프레임 40 올림 array " + frameList[40].arrayUploadCount + " / buffer " + frameList[40].bufferUploadCount + ", 프레임 50 올림 array " + frameList[50].arrayUploadCount + " / buffer " + frameList[50].bufferUploadCount);
for (const frame of frameList) {
	check(frame.arrayError === 0 && frame.bufferError === 0, frame.frame + " 프레임 GL 오류 (" + frame.arrayError + ", " + frame.bufferError + ")");
	check(frame.differentCount === 0, frame.frame + " 프레임 두 길의 화소가 바이트까지 같음 (다른 화소 " + frame.differentCount + ")");
	check(frame.blueLineCount > 20, frame.frame + " 프레임 setLineColor 의 파란 선이 보임 (" + frame.blueLineCount + ")");
	check(frame.bufferUploadCount < frame.arrayUploadCount, frame.frame + " 프레임 buffer 길이 덜 올림 (" + frame.bufferUploadCount + " < " + frame.arrayUploadCount + ")");
}
// 버퍼를 고친 프레임은 바로 반영된다. (두 길이 같고 앞 프레임과 다르다)
check(frameList[40].changedFromPrevious > 0, "버퍼를 고친 다음 프레임에 화면이 바뀜 (" + frameList[40].changedFromPrevious + ")");
check(frameList[40].bufferUploadCount === frameList[39].bufferUploadCount + 1, "고친 프레임의 올림은 bufferSubData 하나만 더 (" + frameList[39].bufferUploadCount + " → " + frameList[40].bufferUploadCount + ")");
// 그림자 캐시: 첫 프레임은 전부, 구워진 뒤(30 프레임) 그대로면 그리지 않고, 고친 프레임은 다시 그린다.
check(frameList[0].bufferShadowDrawCount > 0, "첫 프레임은 그림자를 그림");
for (let frame = 32; frame < 40; ++frame) {
	check(frameList[frame].bufferShadowDrawCount === 0, frame + " 프레임 buffer 길의 그림자 캐시가 그리지 않음 (" + frameList[frame].bufferShadowDrawCount + ")");
	check(frameList[frame].arrayShadowDrawCount === 0, frame + " 프레임 array 길의 그림자 캐시가 그리지 않음 (" + frameList[frame].arrayShadowDrawCount + ")");
}
check(frameList[40].bufferShadowDrawCount > 0, "버퍼를 고친 프레임에 그림자 캐시가 다시 그림 (" + frameList[40].bufferShadowDrawCount + ")");
check(frameList[74].bufferShadowDrawCount === 0, "다시 구운 뒤 그대로면 그리지 않음 (" + frameList[74].bufferShadowDrawCount + ")");
check(result.deletedResult.generationChanged, "지운 버퍼의 generation 이 바뀜");
check(result.deletedResult.drawCallCount === 0 && result.deletedResult.error === 0, "지운 버퍼로 그리면 GL 오류 없이 그리지 않음 (" + result.deletedResult.drawCallCount + ", " + result.deletedResult.error + ")");
check(result.isRangeThrown, "범위를 넘는 일부 고치기는 던짐");
console.log("툰 인스턴스 버퍼 크롬 시험 통과 (" + checkCount + " 개 확인)");
