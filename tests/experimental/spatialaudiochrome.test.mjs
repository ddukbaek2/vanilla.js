//==============================================================================
// 공간 소리 초안의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/experimental/spatialaudiochrome.test.mjs)
// - 헤드리스 크롬(puppeteer-core 와 시스템 크롬, 창을 띄우지 않는다)에서 SpatialAudioPlayer, SpatialAudioListener 가
//   PannerNode 와 AudioListener 에 설정과 자리를 거는지 본다. 받지 않는 설정은 앞 값을 두는지, 바뀐 칸만 대입하는지도 본다.
// - 크롬 경로는 CHROME_PATH 로 바꿀 수 있다. puppeteer-core 나 크롬이 없으면 실패한다. (말없이 건너뛰지 않는다)
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

// 저장소를 잠깐 내주는 http 서버. (모듈은 file:// 로 못 불러온다)
const server = http.createServer((request, response) => {
	const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
	if (requestPath === "/") {
		response.writeHead(200, { "Content-Type": "text/html" });
		response.end("<!doctype html><title>spatialaudio</title>");
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
	result = await page.evaluate(async () => {
		const engineModule = await import("/import.js");
		const Experimental = await import("/src/experimental/experimental.js");
		const { Vector3 } = engineModule;
		const audioContext = new OfflineAudioContext(2, 128, 48000);
		const pannerList = [];
		const createPanner = BaseAudioContext.prototype.createPanner;
		BaseAudioContext.prototype.createPanner = function () {
			const pannerNode = createPanner.call(this);
			pannerList.push(pannerNode);
			return pannerNode;
		};
		const audioManager = { ensureAudioContext: () => audioContext };
		const readPanner = (pannerNode) => ({
			panningModel: pannerNode.panningModel,
			distanceModel: pannerNode.distanceModel,
			refDistance: pannerNode.refDistance,
			maxDistance: pannerNode.maxDistance,
			rolloffFactor: pannerNode.rolloffFactor,
			coneInnerAngle: pannerNode.coneInnerAngle,
			coneOuterAngle: pannerNode.coneOuterAngle,
			coneOuterGain: pannerNode.coneOuterGain,
			position: [pannerNode.positionX.value, pannerNode.positionY.value, pannerNode.positionZ.value],
			orientation: [pannerNode.orientationX.value, pannerNode.orientationY.value, pannerNode.orientationZ.value],
		});
		const player = new Experimental.SpatialAudioPlayer(audioManager);
		const initialPanner = readPanner(pannerList[0]);
		const settings = new Experimental.PannerSettings();
		settings.panningModel = Experimental.PanningModel.Hrtf;
		settings.distanceModel = Experimental.DistanceModel.Linear;
		settings.referenceDistance = 2;
		settings.maximumDistance = 40;
		settings.rolloffFactor = 0.5;
		settings.coneInnerAngle = 60;
		settings.coneOuterAngle = 120;
		settings.coneOuterGain = 0.25;
		const isSettingsAccepted = player.setSettings(settings);
		player.setPosition(Vector3.create(3, -1, 2));
		player.setOrientation(Vector3.create(0, 0, -1));
		const appliedPanner = readPanner(pannerList[0]);
		const isRejected = !player.setMaximumDistance(0) && !player.setCone(30, 60, 1.5);
		// 바뀐 칸만 대입한다. (손으로 바꾼 positionX 는 그 칸을 바꾸지 않으면 그대로)
		pannerList[0].positionX.value = 9;
		player.setPosition(Vector3.create(3, 5, 2));
		const partialPanner = readPanner(pannerList[0]);
		const listener = new Experimental.SpatialAudioListener(audioManager);
		listener.setPosition(Vector3.create(1, 2, 3));
		listener.setOrientation(Vector3.create(1, 0, 0), Vector3.create(0, 0, 1));
		const audioListener = audioContext.listener;
		const listenerValue = {
			position: [audioListener.positionX.value, audioListener.positionY.value, audioListener.positionZ.value],
			forward: [audioListener.forwardX.value, audioListener.forwardY.value, audioListener.forwardZ.value],
			up: [audioListener.upX.value, audioListener.upY.value, audioListener.upZ.value],
		};
		return { userAgent: navigator.userAgent, pannerCount: pannerList.length, initialPanner, isSettingsAccepted, appliedPanner, isRejected, partialPanner, listenerValue };
	});
}
finally {
	await browser.close();
	server.close();
}

const isSameList = (left, right) => left.length === right.length && left.every((value, index) => value === right[index]);
check(result.pannerCount === 1, "PannerNode 하나");
const initialPanner = result.initialPanner;
check(initialPanner.panningModel === "equalpower" && initialPanner.distanceModel === "inverse" && initialPanner.refDistance === 1 && initialPanner.maxDistance === 10000, "처음 설정 (WebAudio 기본)");
check(initialPanner.rolloffFactor === 1 && initialPanner.coneInnerAngle === 360 && initialPanner.coneOuterAngle === 360 && initialPanner.coneOuterGain === 0, "처음 원뿔");
check(isSameList(initialPanner.position, [0, 0, 0]) && isSameList(initialPanner.orientation, [1, 0, 0]), "처음 자리와 방향");
check(result.isSettingsAccepted, "설정 받기");
const appliedPanner = result.appliedPanner;
check(appliedPanner.panningModel === "HRTF" && appliedPanner.distanceModel === "linear" && appliedPanner.refDistance === 2 && appliedPanner.maxDistance === 40, "설정 걸기");
check(appliedPanner.rolloffFactor === 0.5 && appliedPanner.coneInnerAngle === 60 && appliedPanner.coneOuterAngle === 120 && appliedPanner.coneOuterGain === 0.25, "원뿔 걸기");
check(isSameList(appliedPanner.position, [3, -1, 2]) && isSameList(appliedPanner.orientation, [0, 0, -1]), "자리와 방향 걸기");
check(result.isRejected && result.partialPanner.maxDistance === 40 && result.partialPanner.coneOuterGain === 0.25, "받지 않는 설정은 앞 값");
check(isSameList(result.partialPanner.position, [9, 5, 2]), "바뀐 칸만 대입");
const listenerValue = result.listenerValue;
check(isSameList(listenerValue.position, [1, 2, 3]) && isSameList(listenerValue.forward, [1, 0, 0]) && isSameList(listenerValue.up, [0, 0, 1]), "리스너 자리와 방향 걸기");
console.log(`공간 소리 크롬 시험 ${checkCount} 개 통과 (${result.userAgent.match(/Chrome\/[0-9.]+/)?.[0] ?? result.userAgent})`);
