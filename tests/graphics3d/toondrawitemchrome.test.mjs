//==============================================================================
// 남겨 두는 그리기 항목(ToonDrawItem)과 그리기 줄 할당의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/graphics3d/toondrawitemchrome.test.mjs)
// - 헤드리스 크롬(창을 띄우지 않는다)에서 본다.
//   1. 판의 방 꼴(toonroomscene.mjs): 꼴 객체를 프레임마다 새로 짓는 길(fresh)과 ToonDrawItem 길(item)의 화면이 프레임 1, 30, 60, 90 에서 바이트까지 같다.
//   2. ToonDrawItem 의 바뀜 표시: setOption 과 markDirty 뒤 그 프레임에 반영되고, 새 그리기 줄과 새 꼴 객체로 그린 기준과 화면이 같다.
//      꼴 객체를 프레임마다 새로 짓되 값이 프레임마다 바뀌는 길(담은 칸이 쥔 기억 칸을 다시 씀)도 기준과 같다.
//   3. 할당: 멈춘 방(item 길, 도는 모형과 빛나는 부품을 멈춤)에서 엔진 그리기 줄이 프레임마다 잡는 메모리가 문턱 아래. (CDP HeapProfiler 표본)
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
const WIDTH = 320;
const HEIGHT = 180;
// 엔진 그리기 줄의 프레임당 할당 문턱. (KB, 표본이고 낮은 단계로 도는 함수의 수 담기가 섞여 흔들려 넉넉히, 2026-11-28 맥미니 36, 고치기 전 312)
const ALLOCATION_LIMIT_KILOBYTE = 60;
const server = http.createServer((request, response) => {
	const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
	if (requestPath === "/") {
		response.writeHead(200, { "Content-Type": "text/html" });
		response.end(`<!doctype html><title>drawitem</title><body><canvas id="freshCanvas" width="${WIDTH}" height="${HEIGHT}"></canvas><canvas id="itemCanvas" width="${WIDTH}" height="${HEIGHT}"></canvas></body>`);
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
try {
	const page = await browser.newPage();
	const pageErrorList = [];
	page.on("pageerror", (error) => pageErrorList.push(error.message));
	await gotoPage(page, "http://127.0.0.1:" + port + "/");

	// 1, 2. 화면.
	const result = await page.evaluate(async (width, height) => {
		const vanilla = await import("/import.js");
		const { createRoomScene } = await import("/tests/graphics3d/toonroomscene.mjs");
		const readHash = (gl) => {
			const pixels = new Uint8Array(width * height * 4);
			gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
			let hash = 2166136261;
			for (let index = 0; index < pixels.length; ++index) {
				hash = Math.imul(hash ^ pixels[index], 16777619);
			}
			return (hash >>> 0).toString(16);
		};
		const freshGl = document.getElementById("freshCanvas").getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
		const itemGl = document.getElementById("itemCanvas").getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
		const freshScene = createRoomScene(vanilla, freshGl, width, height, "fresh");
		const itemScene = createRoomScene(vanilla, itemGl, width, height, "item");
		const roomList = [];
		for (let frame = 0; frame <= 90; ++frame) {
			freshScene.drawFrame(frame);
			itemScene.drawFrame(frame);
			if (frame === 1 || frame === 30 || frame === 60 || frame === 90) {
				roomList.push({ frame: frame, fresh: readHash(freshGl), item: readHash(itemGl) });
			}
		}

		// 2. 바뀜 표시와 프레임마다 새 꼴. (상자 셋, 같은 렌더러에 새 그리기 줄로 그린 기준과 견준다)
		const { ToonRenderer, ToonDrawQueue, ToonDrawItem, MeshBuilder, createBoxGeometry, Matrix4, Vector3, Camera3D } = vanilla;
		const renderer = new ToonRenderer(itemGl);
		const builder = new MeshBuilder();
		builder.addPart(createBoxGeometry(1, 1, 1), Matrix4.createIdentity(), "#ffffff", { hasOutline: false });
		const boxMesh = renderer.createMesh(builder.readArrays());
		const camera = new Camera3D();
		camera.setPerspective(0.9, 0.1, 30);
		camera.setAspectRatio(width / height);
		camera.lookAt(Vector3.create(0, 1.5, 5), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
		const matrixList = [Matrix4.createTranslation(-1.5, 0, 0), Matrix4.createTranslation(0, 0, 0), Matrix4.createTranslation(1.5, 0, 0)];
		const queue = new ToonDrawQueue();
		const drawQueue = (targetQueue, fill) => {
			itemGl.bindFramebuffer(itemGl.FRAMEBUFFER, null);
			itemGl.viewport(0, 0, width, height);
			itemGl.clearColor(0, 0, 0, 1);
			itemGl.clear(itemGl.COLOR_BUFFER_BIT | itemGl.DEPTH_BUFFER_BIT);
			targetQueue.clear();
			fill(targetQueue);
			targetQueue.draw(renderer, camera);
			return readHash(itemGl);
		};
		const drawReference = (optionsList) => {
			return drawQueue(new ToonDrawQueue(), (targetQueue) => {
				for (let index = 0; index < 3; ++index) {
					targetQueue.addMesh(boxMesh, matrixList[index], JSON.parse(JSON.stringify(optionsList[index])));
				}
			});
		};
		const sharedOptions = { tintColor: [0.2, 0.8, 0.2, 1] };
		const itemList = [
			new ToonDrawItem(boxMesh, matrixList[0], { tintColor: [1, 0.2, 0.2, 1] }),
			new ToonDrawItem(boxMesh, matrixList[1], sharedOptions),
			queue.createItem(boxMesh, matrixList[2], { tintColor: [0.2, 0.2, 1, 1], specularScale: 0.5 }),
		];
		const markList = [];
		const drawItems = () => drawQueue(queue, (targetQueue) => {
			for (const drawItem of itemList) {
				targetQueue.addItem(drawItem);
			}
		});
		const readOptionsList = () => itemList.map((drawItem) => drawItem.getOptions());
		markList.push({ name: "처음", item: drawItems(), reference: drawReference(readOptionsList()) });
		itemList[0].setOption("emissiveColor", [1, 0.5, 0]);
		itemList[0].setOption("emissiveIntensity", 0.6);
		markList.push({ name: "setOption", item: drawItems(), reference: drawReference(readOptionsList()) });
		sharedOptions.tintColor[0] = 0.9;
		itemList[1].markDirty();
		markList.push({ name: "markDirty", item: drawItems(), reference: drawReference(readOptionsList()) });
		itemList[2].setOptions({ tintColor: [1, 1, 0.2, 1] });
		itemList[2].setModelMatrix(Matrix4.createTranslation(1.5, 0.5, 0));
		matrixList[2] = Matrix4.createTranslation(1.5, 0.5, 0);
		markList.push({ name: "setOptions, setModelMatrix", item: drawItems(), reference: drawReference(readOptionsList()) });
		// 프레임마다 새 꼴 객체, 값도 프레임마다 다름. (같은 칸이 쥔 기억 칸을 다시 푼다)
		const freshList = [];
		for (let frame = 0; frame < 4; ++frame) {
			const optionsList = [
				{ tintColor: [0.3 + frame * 0.2, 0.3, 0.3, 1] },
				frame % 2 === 0 ? { tintColor: [0.3, 0.9, 0.3, 1], specularScale: 0.2 } : { tintColor: [0.3, 0.9, 0.3, 1] },
				{ tintColor: [0.3, 0.3, 0.9, 1], alpha: frame === 2 ? 0.5 : 1 },
			];
			const queueHash = drawQueue(queue, (targetQueue) => {
				for (let index = 0; index < 3; ++index) {
					targetQueue.addMesh(boxMesh, matrixList[index], { ...optionsList[index] });
				}
			});
			freshList.push({ frame: frame, item: queueHash, reference: drawReference(optionsList) });
		}
		return { roomList: roomList, markList: markList, freshList: freshList, error: freshGl.getError() + itemGl.getError() };
	}, WIDTH, HEIGHT);
	for (const entry of result.roomList) {
		check(entry.fresh === entry.item, "방 프레임 " + entry.frame + " 화면이 다름 (" + entry.fresh + ", " + entry.item + ")");
	}
	check(new System.Set(result.roomList.map((entry) => entry.item)).size > 1, "방이 프레임마다 그대로다 (도는 모형이 안 돎)");
	for (const entry of result.markList) {
		check(entry.item === entry.reference, entry.name + " 뒤 화면이 기준과 다름");
	}
	check(new System.Set(result.markList.map((entry) => entry.item)).size === result.markList.length, "바뀜 표시가 화면에 반영되지 않음");
	for (const entry of result.freshList) {
		check(entry.item === entry.reference, "새 꼴 프레임 " + entry.frame + " 화면이 기준과 다름");
	}
	check(result.error === 0, "GL 오류 " + result.error);

	// 3. 할당. (멈춘 방을 데운 뒤 120 프레임, 엔진 몫: 할당한 자리에서 위로 src/base 밖의 첫 자리가 엔진 src)
	const allocationPage = await browser.newPage();
	await gotoPage(allocationPage, "http://127.0.0.1:" + port + "/");
	await allocationPage.evaluate(async (width, height) => {
		const vanilla = await import("/import.js");
		const { createRoomScene } = await import("/tests/graphics3d/toonroomscene.mjs");
		const gl = document.getElementById("itemCanvas").getContext("webgl2", { antialias: false });
		const scene = createRoomScene(vanilla, gl, width, height, "item");
		window.drawStillRoom = (count) => {
			for (let index = 0; index < count; ++index) {
				scene.drawFrame(0);
			}
		};
		window.drawStillRoom(90);
	}, WIDTH, HEIGHT);
	const session = await allocationPage.target().createCDPSession();
	await session.send("HeapProfiler.enable");
	await session.send("HeapProfiler.collectGarbage");
	await session.send("HeapProfiler.startSampling", { samplingInterval: 512, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
	const FRAME_COUNT = 120;
	await allocationPage.evaluate((count) => window.drawStillRoom(count), FRAME_COUNT);
	const { profile } = await session.send("HeapProfiler.stopSampling");
	let engineSize = 0;
	const visit = (node, owner) => {
		const callFrame = node.callFrame;
		const nextOwner = (!callFrame.url.includes("/src/base/") && callFrame.url !== "") ? callFrame : owner;
		if (node.selfSize > 0 && nextOwner !== null && nextOwner.url.includes("/src/")) {
			engineSize += node.selfSize;
		}
		for (const child of node.children ?? []) {
			visit(child, nextOwner);
		}
	};
	visit(profile.head, null);
	const engineKilobyte = engineSize / 1024 / FRAME_COUNT;
	console.log("멈춘 방 엔진 그리기 줄 할당: " + engineKilobyte.toFixed(2) + " KB/프레임 (문턱 " + ALLOCATION_LIMIT_KILOBYTE + ")");
	check(engineKilobyte < ALLOCATION_LIMIT_KILOBYTE, "엔진 그리기 줄 할당 " + engineKilobyte.toFixed(2) + " KB/프레임이 문턱 " + ALLOCATION_LIMIT_KILOBYTE + " 을 넘음");
	await allocationPage.close();
	check(pageErrorList.length === 0, "페이지 오류: " + pageErrorList.join(" | "));
}
finally {
	await browser.close();
	server.close();
}
console.log("toondrawitemchrome 시험 " + checkCount + " 개 통과");
