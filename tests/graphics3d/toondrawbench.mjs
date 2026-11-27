//==============================================================================
// 툰 그리기 줄의 그리기마다 CPU 비용 재기. (NODE_PATH=$(npm root -g) node tests/graphics3d/toondrawbench.mjs <견줄 저장소 경로> [반복 수] [장면들])
// - 두 엔진 사본을 견준다. a: 견줄 저장소(고치기 전 사본), b: 이 저장소. 장면은 이 저장소의 것을 두 엔진에 같이 쓴다.
//   lobby: 애버런트 로비 꼴(toonlobbyscene.mjs), lobbymove: 같은 로비를 카메라가 돌며(프레임 블록 값이 패스마다 바뀜), roommove: 판의 방(fresh)을 카메라가 돌며, miner: 광부 mid 꼴(toonminerscene.mjs, 인스턴스 버퍼, 청크 6),
//   room: 애버런트 판의 방 꼴(toonroomscene.mjs, 부품마다 꼴을 프레임마다 새로 지음), roomitem: 같은 방을 남겨 두는 항목(ToonDrawItem)으로. (엔진에 없으면 room 과 같다)
// - 찍는 것:
//   1. 센 값(부하와 상관없음): 프레임당 GL 호출 수(전부, 유니폼, 프로그램 바꿈, 텍스처 묶기, 버텍스 어레이 묶기, 버퍼 올림, 유니폼 버퍼 묶기, 드로 콜).
//   2. 화면: 프레임 30, 90, 150 의 readPixels 해시가 a 와 b 에서 같은지.
//   3. 스크립트 시간: drawFrame 의 CPU 시간(gl.finish 없음, 교차 출처 격리) 가운데 값, a 와 b 를 번갈아(ABAB) 새 페이지로, 반복의 가운데 값.
//   4. 프로파일: CDP Profiler 로 프레임 60 ~ 239 의 자기 시간 위 함수(ms/프레임), 엔진 JS(src) 자체 시간 합, 가비지 컬렉터 시간.
//   5. 할당: CDP HeapProfiler 표본(1 KB 마다)으로 프레임 60 ~ 239 에 잡은 메모리(KB/프레임). 엔진 몫(장면 코드가 바로 부른 수학 함수는 장면 몫)과 함수마다 위.
//      BENCH_ALLOCATION=0 이면 뺀다. BENCH_ONLY=allocation 이면 할당만 잰다. (센 값, 화면 해시, 시간, 프로파일을 건너뜀) BENCH_ONLY=count 면 센 값과 화면 해시만.
// - 시작과 끝의 기계 부하를 찍는다. 시험이 아니다. (tests/run.mjs 가 돌리지 않는다)
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
const basePath = path.resolve(process.argv[2] ?? path.join(repositoryPath, "../base"));
const repeatCount = Number.parseInt(process.argv[3] ?? "5", 10);
const sceneNameList = (process.argv[4] ?? "lobby,miner").split(",");
const contentTypeTable = { ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".html": "text/html" };
const WIDTH = 960;
const HEIGHT = 540;
const ISOLATION_HEADERS = { "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp" };

function readMedian(values) {
	const sorted = [...values].sort((first, second) => first - second);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const server = http.createServer((request, response) => {
	for (const [name, value] of Object.entries(ISOLATION_HEADERS)) {
		response.setHeader(name, value);
	}
	let requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
	if (requestPath === "/") {
		response.writeHead(200, { "Content-Type": "text/html" });
		response.end(`<!doctype html><title>toondrawbench</title><body><canvas id="canvas" width="${WIDTH}" height="${HEIGHT}"></canvas></body>`);
		return;
	}
	let rootPath = repositoryPath;
	if (requestPath.startsWith("/a/")) {
		rootPath = basePath;
		requestPath = requestPath.slice(2);
	}
	else if (requestPath.startsWith("/b/")) {
		requestPath = requestPath.slice(2);
	}
	const filePath = path.join(rootPath, requestPath);
	if (!filePath.startsWith(rootPath) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
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
	"/usr/bin/google-chrome",
];
const executablePath = chromePathList.find((chromePath) => fs.existsSync(chromePath));
const browser = await puppeteer.launch({ executablePath, headless: true });

// 한 페이지에서 한 장면을 돌린다. mode: "count" (GL 호출을 세고 화면 해시), "time" (시간만), "profile" (CDP 프로파일)
async function runScene(version, sceneName, mode) {
	const page = await browser.newPage();
	await page.goto("http://127.0.0.1:" + port + "/");
	let session = null;
	if (mode === "profile") {
		session = await page.target().createCDPSession();
		await session.send("Profiler.enable");
		await session.send("Profiler.setSamplingInterval", { interval: 50 });
	}
	if (mode === "allocation") {
		session = await page.target().createCDPSession();
		await session.send("HeapProfiler.enable");
	}
	await page.exposeFunction("benchProfile", async (isStart) => {
		if (session === null) {
			return null;
		}
		if (mode === "allocation") {
			if (isStart) {
				await session.send("HeapProfiler.collectGarbage");
				await session.send("HeapProfiler.startSampling", { samplingInterval: 1024, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
				return null;
			}
			const { profile } = await session.send("HeapProfiler.stopSampling");
			return JSON.stringify(profile);
		}
		if (isStart) {
			await session.send("Profiler.start");
			return null;
		}
		const { profile } = await session.send("Profiler.stop");
		return JSON.stringify(profile);
	});
	const result = await page.evaluate(async (version, sceneName, mode, width, height) => {
		const vanilla = await import("/" + version + "/import.js");
		const gl = document.getElementById("canvas").getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
		const countTable = {};
		const readCounter = { count: 0 };
		let readCountAtFrame = 0;
		if (mode === "count") {
			const prototype = Object.getPrototypeOf(gl);
			for (const name of Object.getOwnPropertyNames(prototype)) {
				const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
				if (typeof descriptor.value !== "function" || name === "constructor" || name.startsWith("get") || name === "isContextLost") {
					continue;
				}
				const original = descriptor.value;
				gl[name] = function (...args) {
					countTable[name] = (countTable[name] ?? 0) + 1;
					return original.apply(gl, args);
				};
			}
		}
		let scene = null;
		if (sceneName === "lobby" || sceneName === "lobbymove") {
			const { createLobbyScene } = await import("/b/tests/graphics3d/toonlobbyscene.mjs");
			scene = createLobbyScene(vanilla, gl, width, height, mode === "read" ? readCounter : null, sceneName === "lobbymove");
		}
		else if (sceneName === "room" || sceneName === "roomitem" || sceneName === "roommove") {
			const { createRoomScene } = await import("/b/tests/graphics3d/toonroomscene.mjs");
			scene = createRoomScene(vanilla, gl, width, height, sceneName === "roomitem" ? "item" : "fresh", sceneName === "roommove");
		}
		else {
			const { createMinerScene } = await import("/b/tests/graphics3d/toonminerscene.mjs");
			const minerScene = createMinerScene(vanilla, gl, width, height, "buffer", 6);
			scene = { drawFrame: () => minerScene.drawFrame(), renderer: minerScene.renderer };
		}
		const timeList = [];
		const hashList = [];
		const frameCountList = [];
		const totalTable = {}; // 240 프레임 모두의 버퍼 짓기와 지우기, 올림. (한 프레임만 보면 안 보이는 몰아 지우기를 잡는다)
		const pixels = new Uint8Array(width * height * 4);
		const readHash = () => {
			gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
			let hash = 2166136261;
			for (let index = 0; index < pixels.length; ++index) {
				hash = Math.imul(hash ^ pixels[index], 16777619);
			}
			return (hash >>> 0).toString(16);
		};
		for (let frame = 0; frame < 240; ++frame) {
			if ((mode === "profile" || mode === "allocation") && frame === 60) {
				await window.benchProfile(true);
			}
			for (const name of Object.keys(countTable)) {
				totalTable[name] = (totalTable[name] ?? 0) + countTable[name];
				countTable[name] = 0;
			}
			const startTime = performance.now();
			scene.drawFrame(frame);
			const time = performance.now() - startTime;
			if (mode === "count" && frame === 100) {
				frameCountList.push({ ...countTable });
			}
			if (frame === 99) {
				readCounter.count = 0;
			}
			if (frame === 100) {
				readCountAtFrame = readCounter.count;
			}
			gl.finish();
			if (mode === "count" && (frame === 30 || frame === 90 || frame === 150)) {
				hashList.push(readHash());
			}
			if (frame >= 60) {
				timeList.push(time);
			}
		}
		let profileText = null;
		if (mode === "profile" || mode === "allocation") {
			profileText = await window.benchProfile(false);
		}
		const sorted = [...timeList].sort((first, second) => first - second);
		return { time: sorted[Math.floor(sorted.length / 2)], readCount: readCountAtFrame, itemCount: scene.queue !== undefined ? scene.queue.getItemCount() : 0, hashList: hashList, counts: frameCountList[0] ?? null, totals: totalTable, statistics: scene.renderer.getFrameStatistics(), error: gl.getError(), profileText: profileText };
	}, version, sceneName, mode, WIDTH, HEIGHT);
	await page.close();
	return result;
}

// 프로파일의 자기 시간을 함수마다 모은다. (ms/프레임, 180 프레임)
function readSelfTimes(profileText) {
	const profile = JSON.parse(profileText);
	const nodeTable = new Map(profile.nodes.map((node) => [node.id, node]));
	const selfTable = new Map();
	let engineTime = 0;
	for (let index = 0; index < profile.samples.length; ++index) {
		const node = nodeTable.get(profile.samples[index]);
		const delta = profile.timeDeltas[index + 1] ?? 0;
		const frame = node.callFrame;
		if (frame.url.includes("/src/")) {
			engineTime += delta / 1000;
		}
		const key = (frame.functionName || "(anonymous)") + " " + path.basename(frame.url || "") + ":" + frame.lineNumber;
		selfTable.set(key, (selfTable.get(key) ?? 0) + delta / 1000);
	}
	const garbageTime = [...selfTable.entries()].filter(([key]) => key.startsWith("(garbage")).reduce((sum, [, time]) => sum + time, 0);
	const topList = [...selfTable.entries()].filter(([key]) => !key.startsWith("(idle)") && !key.startsWith("(program)") && !key.startsWith("(garbage") && !key.startsWith("(root)")).sort((first, second) => second[1] - first[1]).slice(0, 16).map(([key, time]) => key + " " + (time / 180).toFixed(4));
	return ["엔진 JS 자체 합 " + (engineTime / 180).toFixed(4), "가비지 컬렉터 " + (garbageTime / 180).toFixed(4), ...topList];
}

// 할당 표본을 모은다. (KB/프레임, 180 프레임) 엔진 몫: 할당한 자리에서 위로 올라가며 src/base 밖의 첫 자리가 엔진(src)이면 엔진, 장면(tests)이면 장면.
function readAllocations(profileText) {
	const profile = JSON.parse(profileText);
	const selfTable = new Map();
	const ownerTable = new Map();
	let engineSize = 0;
	let sceneSize = 0;
	let totalSize = 0;
	const readKey = (callFrame) => (callFrame.functionName || "(anonymous)") + " " + path.basename(callFrame.url || "") + ":" + callFrame.lineNumber;
	const visit = (node, owner) => {
		const callFrame = node.callFrame;
		const isBase = callFrame.url.includes("/src/base/");
		const nextOwner = (!isBase && callFrame.url !== "") ? callFrame : owner;
		if (node.selfSize > 0) {
			totalSize += node.selfSize;
			const key = readKey(callFrame);
			selfTable.set(key, (selfTable.get(key) ?? 0) + node.selfSize);
			if (nextOwner !== null && nextOwner.url.includes("/src/")) {
				engineSize += node.selfSize;
				const ownerKey = readKey(nextOwner);
				ownerTable.set(ownerKey, (ownerTable.get(ownerKey) ?? 0) + node.selfSize);
			}
			else if (nextOwner !== null && nextOwner.url.includes("/tests/")) {
				sceneSize += node.selfSize;
			}
		}
		for (const child of node.children ?? []) {
			visit(child, nextOwner);
		}
	};
	visit(profile.head, null);
	const toKilobyte = (size) => (size / 1024 / 180).toFixed(2);
	const sortTable = (table) => [...table.entries()].sort((first, second) => second[1] - first[1]).slice(0, 16).map(([key, size]) => key + " " + toKilobyte(size));
	return { text: `전체 ${toKilobyte(totalSize)}, 엔진 몫 ${toKilobyte(engineSize)}, 장면 몫 ${toKilobyte(sceneSize)}`, selfList: sortTable(selfTable), ownerList: sortTable(ownerTable), engineKilobyte: engineSize / 1024 / 180 };
}

const COUNT_GROUPS = {
	all: () => true,
	uniform: (name) => name.startsWith("uniform") && name !== "uniformBlockBinding",
	useProgram: (name) => name === "useProgram",
	bindTexture: (name) => name === "bindTexture" || name === "activeTexture",
	bindVertexArray: (name) => name === "bindVertexArray",
	upload: (name) => name === "bufferData" || name === "bufferSubData",
	bufferData: (name) => name === "bufferData",
	createBuffer: (name) => name === "createBuffer",
	deleteBuffer: (name) => name === "deleteBuffer",
	bindBufferBase: (name) => name === "bindBufferBase" || name === "bindBufferRange",
	draw: (name) => name.startsWith("draw"),
};

const startLoad = os.loadavg().map((value) => value.toFixed(2)).join(" ");
try {
	for (const sceneName of sceneNameList) {
		console.log(`== ${sceneName}`);
		if (process.env.BENCH_ONLY === "allocation") {
			for (const version of ["a", "b"]) {
				const allocation = readAllocations((await runScene(version, sceneName, "allocation")).profileText);
				console.log(`${version} 할당 (KB/프레임): ${allocation.text}\n  자리마다: ${allocation.selfList.join(" | ")}\n  엔진 몫 함수마다: ${allocation.ownerList.join(" | ")}`);
			}
			continue;
		}
		const countResult = {};
		for (const version of ["a", "b"]) {
			const result = await runScene(version, sceneName, "count");
			countResult[version] = result;
			const groups = Object.entries(COUNT_GROUPS).map(([group, test]) => group + " " + Object.entries(result.counts).filter(([name]) => test(name)).reduce((sum, [, count]) => sum + count, 0));
			console.log(`${version} 센 값(프레임 100): ${groups.join(", ")}, 그린 ${result.statistics.drawnObjectCount}, 거른 ${result.statistics.culledObjectCount}, 드로 콜 ${result.statistics.drawCallCount}, GL 오류 ${result.error}`);
			const total = (name) => result.totals[name] ?? 0;
			console.log(`${version} 240 프레임 합: createBuffer ${total("createBuffer")}, deleteBuffer ${total("deleteBuffer")}, bufferData ${total("bufferData")}, bufferSubData ${total("bufferSubData")}, bindBufferRange ${total("bindBufferRange")}, bindBufferBase ${total("bindBufferBase")}`);
		}
		if (sceneName === "lobby") {
			for (const version of ["a", "b"]) {
				const result = await runScene(version, sceneName, "read");
				console.log(`${version} 꼴 객체 칸 읽기(프레임 100): ${result.readCount}, 담은 것 ${result.itemCount}, 하나에 ${(result.readCount / result.itemCount).toFixed(1)}`);
			}
		}
		console.log(`화면 해시 a ${countResult.a.hashList.join(" ")}, b ${countResult.b.hashList.join(" ")}, 같음 ${countResult.a.hashList.join() === countResult.b.hashList.join()}`);
		if (process.env.BENCH_ONLY === "count") {
			continue;
		}
		const timeTable = { a: [], b: [] };
		for (let repeat = 0; repeat < repeatCount; ++repeat) {
			for (const version of ["a", "b"]) {
				timeTable[version].push((await runScene(version, sceneName, "time")).time);
			}
		}
		for (const version of ["a", "b"]) {
			console.log(`${version} 스크립트 가운데 ${readMedian(timeTable[version]).toFixed(3)} ms (반복마다 ${timeTable[version].map((time) => time.toFixed(3)).join(", ")})`);
		}
		if (process.env.BENCH_PROFILE !== "0") {
			for (const version of ["a", "b"]) {
				const result = await runScene(version, sceneName, "profile");
				console.log(`${version} 자기 시간 위 (ms/프레임): ${readSelfTimes(result.profileText).join(" | ")}`);
			}
		}
		if (process.env.BENCH_ALLOCATION !== "0") {
			for (const version of ["a", "b"]) {
				const allocation = readAllocations((await runScene(version, sceneName, "allocation")).profileText);
				console.log(`${version} 할당 (KB/프레임): ${allocation.text}\n  자리마다: ${allocation.selfList.join(" | ")}\n  엔진 몫 함수마다: ${allocation.ownerList.join(" | ")}`);
			}
		}
	}
}
finally {
	await browser.close();
	server.close();
}
console.log(`기계 부하(1, 5, 15 분 평균): 처음 ${startLoad}, 끝 ${os.loadavg().map((value) => value.toFixed(2)).join(" ")}`);
