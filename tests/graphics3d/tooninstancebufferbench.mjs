//==============================================================================
// 툰 인스턴스 그리기 재기. (NODE_PATH=$(npm root -g) node tests/graphics3d/tooninstancebufferbench.mjs [반복 수] [청크 수])
// - 광부 키우기 mid 꼴 장면(toonminerscene.mjs, 바위 세 종 460 개, 건물 스무 채, 해 그림자 onChange, 화면 공간 바깥선)을 헤드리스 크롬에서 그린다.
// - 두 길을 견준다. array: ToonDrawQueue.addMeshInstanced (프레임마다 인스턴스 배열을 걸러 몸, 그림자, 선의 판이 따로 올림),
//   buffer: addMeshInstanceBuffer (한 번 올린 버퍼를 몸, 껍데기, 그림자, 선의 판이 같이 씀).
// - 프레임마다 버퍼 올림(bufferData, bufferSubData 를 가로채 셈), 드로 콜, 스크립트 시간(drawFrame 의 CPU 시간, gl.finish 없음)을 잰다.
//   스크립트 시간은 프레임마다의 가운데 값과 평균을 같이 찍는다. (교차 출처 격리로 performance.now 를 촘촘하게 한다)
//   프레임 0 ~ 59 는 데우기(그림자도 구워짐), 60 ~ 239 를 잰다. 길마다 반복 수(기본 5)만큼 새 페이지로 재어 가운데 값의 가운데 값을 찍는다.
//   청크 수(기본 6)는 바위를 x 쪽으로 쪼개 따로 담을 수다. (종류 셋 x 청크 수만큼 인스턴스 묶음, 1 이면 묶음 셋)
//   가운데 값과 평균은 그대로인 프레임(60 ~ 149)만, 고친 프레임(150)은 따로 찍는다.
//   반복마다 array, buffer 를 번갈아(ABAB) 새 페이지로 잰다. 시작과 끝의 기계 부하(load average)를 같이 찍는다. 버퍼 올림 수와 드로 콜은 부하와 상관없다.
//   맥의 성능 코어와 효율 코어 사이를 옮겨 다녀 반복마다 두 배 가까이 갈릴 때가 있다. 반복의 가운데 값과 가장 빠른 반복을 같이 본다.
//   프레임 150 에 바위 하나를 고친다. (buffer 는 updateInstanceBufferRange 하나, 그림자는 다시 구움)
// - 시험이 아니다. (tests/run.mjs 가 돌리지 않는다, 값은 기계마다 다르다) 크롬 경로는 CHROME_PATH 로 바꿀 수 있다.
//==============================================================================
import fs from "node:fs";
import os from "node:os";
import http from "node:http";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const repositoryPath = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");
const contentTypeTable = { ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".html": "text/html" };
const repeatCount = parseRepeatCount(process.argv[2]);
const chunkCount = parseRepeatCount(process.argv[3] ?? "6");
const WIDTH = 960;
const HEIGHT = 540;

// 반복 수 읽기. (없거나 잘못되면 5)
function parseRepeatCount(text) {
	const value = Number.parseInt(text ?? "", 10);
	return Number.isFinite(value) && value > 0 ? value : 5;
}

// 가운데 값.
function readMedian(values) {
	const sorted = [...values].sort((first, second) => first - second);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

// 교차 출처 격리로 performance.now 를 촘촘하게. (격리하지 않으면 크롬이 0.1 ms 로 거칠게 깎는다)
const ISOLATION_HEADERS = { "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp" };
const server = http.createServer((request, response) => {
	for (const [name, value] of Object.entries(ISOLATION_HEADERS)) {
		response.setHeader(name, value);
	}
	const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
	if (requestPath === "/") {
		response.writeHead(200, { "Content-Type": "text/html" });
		response.end(`<!doctype html><title>instancebench</title><body><canvas id="canvas" width="${WIDTH}" height="${HEIGHT}"></canvas></body>`);
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
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const chromePathList = [
	...(process.env.CHROME_PATH ? [process.env.CHROME_PATH] : []),
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	"C:/Program Files/Google/Chrome/Application/chrome.exe",
	"/usr/bin/google-chrome",
];
const executablePath = chromePathList.find((chromePath) => fs.existsSync(chromePath));
if (executablePath === undefined) {
	throw new Error("크롬을 찾지 못함 (CHROME_PATH)");
}
const browser = await puppeteer.launch({ executablePath, headless: true });
const startLoad = os.loadavg().map((value) => value.toFixed(2)).join(" ");
const resultTable = { array: [], buffer: [] };
try {
	for (let repeat = 0; repeat < repeatCount; ++repeat) {
		for (const drawPath of ["array", "buffer"]) {
			const page = await browser.newPage();
			await page.goto("http://127.0.0.1:" + port + "/");
			const result = await page.evaluate(async (drawPath, width, height, chunkCount) => {
				const vanilla = await import("/import.js");
				const { createMinerScene } = await import("/tests/graphics3d/toonminerscene.mjs");
				const gl = document.getElementById("canvas").getContext("webgl2", { antialias: false });
				let uploadCount = 0;
				for (const name of ["bufferData", "bufferSubData"]) {
					const original = gl[name].bind(gl);
					gl[name] = (...args) => {
						uploadCount += 1;
						return original(...args);
					};
				}
				let drawCallCount = 0;
				for (const name of ["drawElements", "drawElementsInstanced", "drawArrays", "drawArraysInstanced"]) {
					const original = gl[name].bind(gl);
					gl[name] = (...args) => {
						drawCallCount += 1;
						return original(...args);
					};
				}
				const scene = createMinerScene(vanilla, gl, width, height, drawPath, chunkCount);
				const timeList = [];
				let updateTime = 0;
				const uploadList = [];
				const drawCallList = [];
				for (let frame = 0; frame < 240; ++frame) {
					uploadCount = 0;
					drawCallCount = 0;
					const startTime = performance.now();
					if (frame === 150) {
						const rock = scene.readRock(0, 10);
						const elements = rock.modelMatrix.getElements();
						scene.setRock(0, 10, { modelMatrix: vanilla.Matrix4.createTranslation(elements[12], 0.3, elements[14]) });
					}
					scene.drawFrame();
					const time = performance.now() - startTime;
					gl.finish();
					if (frame === 150) {
						updateTime = time;
					}
					if (frame >= 60 && frame < 150) {
						timeList.push(time);
						uploadList.push(uploadCount);
						drawCallList.push(drawCallCount);
					}
				}
				const median = (values) => {
					const sorted = [...values].sort((first, second) => first - second);
					return sorted[Math.floor(sorted.length / 2)];
				};
				const mean = timeList.reduce((sum, value) => sum + value, 0) / timeList.length;
				return { time: median(timeList), mean: mean, updateTime: updateTime, isIsolated: self.crossOriginIsolated, upload: median(uploadList), uploadMaximum: Math.max(...uploadList), drawCall: median(drawCallList), error: gl.getError() };
			}, drawPath, WIDTH, HEIGHT, chunkCount);
			resultTable[drawPath].push(result);
			await page.close();
		}
	}
}
finally {
	await browser.close();
	server.close();
}
console.log(`기계 부하(1, 5, 15 분 평균): 처음 ${startLoad}, 끝 ${os.loadavg().map((value) => value.toFixed(2)).join(" ")}, 반복마다 array 와 buffer 를 번갈아 잰다`);
for (const drawPath of ["array", "buffer"]) {
	const list = resultTable[drawPath];
	const time = readMedian(list.map((result) => result.time));
	const mean = readMedian(list.map((result) => result.mean));
	const updateTime = readMedian(list.map((result) => result.updateTime));
	const fastest = Math.min(...list.map((result) => result.time));
	console.log(`${drawPath} (청크 ${chunkCount}): 스크립트 가운데 ${time.toFixed(3)} ms, 가장 빠른 반복 ${fastest.toFixed(3)} ms, 평균 ${mean.toFixed(3)} ms, 고친 프레임 ${updateTime.toFixed(3)} ms (반복마다 ${list.map((result) => result.time.toFixed(3)).join(", ")}, 격리 ${list[0].isIsolated}), 버퍼 올림 프레임당 ${readMedian(list.map((result) => result.upload))} (가장 많을 때 ${Math.max(...list.map((result) => result.uploadMaximum))}), 드로 콜 ${readMedian(list.map((result) => result.drawCall))}, GL 오류 ${list.map((result) => result.error).join(",")}`);
}
