//==============================================================================
// UI 기하 캐시 크롬 시험. (NODE_PATH=$(npm root -g) node tests/ui/uigeometrycachechrome.test.mjs)
// - 설정 창 같은 장면(UIScrollView 안 줄 50 개, 줄마다 둥근 바탕, 글, 단추 바탕과 글)을 기하 캐시를 켜고 끄고 그려 찍은 화면의 화소가 모두 같은지 본다.
//   멈춘 때, 스크롤하는 때(부모 이동만 바뀜), 위치, 색(세터와 받은 Color 를 바로 고친 것), 글, 글 색, 보임, 투명도, 배율을 바꾼 때를 찍는다.
// - 캐시를 켜면 멈춘 프레임과 스크롤 프레임에 다시 셈하는 컴포넌트가 없고, 바꾼 프레임에는 바꾼 것만 다시 셈하는지 센다.
// - 캐시를 켜면 멈춘 프레임은 GPU 에 남긴 묶음으로 그리는지(정점을 올리지 않음) 센다. 찍는 프레임 30, 86, 90 은 남긴 묶음으로 그린 화면이다.
// - 프레임마다 장면 트리 그리기(super.draw)의 CPU 시간을 재어 찍는다. (재는 값은 견주지 않는다)
// - 씬이 그려진 프레임 번호로 일을 정하고 찍는다. (로딩 화면이 아닌지도 본다)
// - 크롬 경로는 CHROME_PATH 로 바꿀 수 있다. puppeteer-core 나 크롬이 없으면 실패한다. (말없이 건너뛰지 않는다)
//==============================================================================
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";
import { check, checkEqual, finish } from "../testcheck.mjs";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const repositoryPath = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");
const contentTypeTable = { ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".html": "text/html" };

const PAGE_SOURCE = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{position:absolute;left:0;top:0;width:100%;height:100%}</style><canvas id="mainCanvas"></canvas>
<script type="module">
const { Engine, EngineConfiguration, Scene, WorldNode, Vector2, Color, Pivot, Paint, TextAlign, ViewScaleMode, UIView, UILabel, UIButton, UIScrollView } = await import("/import.js");
const isGeometryCachingEnabled = new URLSearchParams(location.search).get("cache") === "1";
const ROW_COUNT = 50;
const CAPTURE_FRAME_LIST = [30, 70, 82, 86, 90];
function createBoxNode(parentNode, position, size) {
	const node = new WorldNode();
	parentNode.addChild(node);
	node.setPivot(Pivot.topLeft);
	node.setLocalPosition(position);
	node.setContentSize(size);
	return node;
}
const rowList = [];
let scrollView = null;
let drawnFrameCount = 0;
window.captureList = [];
window.frameList = [];
class SettingsScene extends Scene {
	initialize(engine) {
		super.initialize(engine);
		const root = this.getRoot();
		root.setContentSize(Vector2.create(640, 360));
		const scrollNode = createBoxNode(root, Vector2.create(20, 20), Vector2.create(360, 320));
		scrollView = scrollNode.addComponent(UIScrollView);
		scrollView.setBackgroundColor(Color.createFromHEX("#1d1814"));
		scrollView.setScrollContentSize(Vector2.create(360, ROW_COUNT * 34));
		scrollView.setHorizontal(false);
		for (let rowIndex = 0; rowIndex < ROW_COUNT; ++rowIndex) {
			const rowNode = createBoxNode(scrollView.getContent(), Vector2.create(6, rowIndex * 34), Vector2.create(340, 30));
			const rowPaint = rowNode.addComponent(Paint);
			rowPaint.setColor(rowIndex % 2 === 0 ? "#4a3c30" : "#5a4a3c");
			rowPaint.setRoundSize(7);
			const label = rowNode.addComponent(UILabel);
			label.setText("설정 항목 " + rowIndex + " 소리 크기");
			label.setFontSize(14);
			label.setTextAlign(TextAlign.left);
			label.setTextColor("#f1e9d8");
			const buttonNode = createBoxNode(rowNode, Vector2.create(250, 3), Vector2.create(80, 24));
			const buttonView = buttonNode.addComponent(UIView);
			buttonView.setBackgroundColor(Color.createFromHEX(rowIndex % 3 === 0 ? "#2f7d4f" : "#7d2f3f"));
			const buttonLabel = buttonNode.addComponent(UILabel);
			buttonLabel.setText(rowIndex % 3 === 0 ? "켜기" : "끄기");
			buttonLabel.setFontSize(13);
			buttonLabel.setTextColor("#ffffff");
			buttonNode.addComponent(UIButton);
			rowList.push({ rowNode, rowPaint, label, buttonNode, buttonView });
		}
		const titleNode = createBoxNode(root, Vector2.create(400, 20), Vector2.create(220, 40));
		titleNode.addComponent(Paint).setColor("#30445a");
		const titleLabel = titleNode.addComponent(UILabel);
		titleLabel.setText("설정");
		titleLabel.setFontSize(20);
		titleLabel.setTextColor("#ffffff");
		rowList.titleNode = titleNode;
		rowList.titleLabel = titleLabel;
	}
	applyFrameEvent(frameNumber) {
		// 41 ~ 80: 프레임마다 소수 픽셀만큼 스크롤. (부모 이동만 바뀐다)
		if (frameNumber > 40 && frameNumber <= 80) {
			scrollView.setScrollOffset(Vector2.create(0, -(frameNumber - 40) * 3.37));
		}
		if (frameNumber === 81) {
			rowList[2].rowNode.setLocalPosition(Vector2.create(19.5, 2 * 34));
			rowList[3].rowPaint.setColor("#2266aa");
			rowList[4].label.setText("바뀐 글 넷째 줄");
			rowList[5].rowNode.setVisible(false);
			rowList[6].rowPaint.getColor().red = 1;
			rowList[7].rowNode.setLocalOpacity(0.5);
			rowList[8].label.setTextColor("#ffcc00");
			rowList[9].buttonView.getBackgroundColor().blue = 1;
			rowList[10].rowNode.setLocalScale(Vector2.create(1.1, 1.1));
			rowList[11].buttonNode.setContentSize(Vector2.create(60, 24));
			rowList.titleLabel.setText("설정 (바뀜)");
		}
		if (frameNumber === 84) {
			rowList[2].rowNode.setLocalPosition(Vector2.create(6, 2 * 34));
			rowList[4].label.setText("또 바뀐 글");
			rowList[5].rowNode.setVisible(true);
			rowList[7].rowNode.setLocalOpacity(0.8);
			rowList.titleNode.setLocalPosition(Vector2.create(401.25, 21.5));
		}
		if (frameNumber === 88) {
			rowList[12].rowNode.setRotation(0.05);
			rowList.titleNode.setLocalOpacity(0.6);
		}
	}
	draw(graphic) {
		drawnFrameCount += 1;
		const frameNumber = drawnFrameCount;
		graphic.setGeometryCachingEnabled(isGeometryCachingEnabled);
		// 지난 프레임의 캐시 수. (이 프레임 앞에서 읽으므로 앞 프레임 칸에 적는다)
		if (window.frameList.length > 0) {
			const previousFrame = window.frameList[window.frameList.length - 1];
			previousFrame.hitCount = graphic.getLastFrameGeometryCacheHitCount();
			previousFrame.rebuildCount = graphic.getLastFrameGeometryRebuildCount();
			previousFrame.retainedCount = graphic.getLastFrameRetainedBatchCount();
			previousFrame.drawCallCount = graphic.getLastFrameDrawCallCount();
		}
		this.applyFrameEvent(frameNumber);
		if (CAPTURE_FRAME_LIST.includes(frameNumber)) {
			window.captureList.push(engine.requestFrameCapture(engine.getFrameNumber()));
		}
		const startTime = performance.now();
		super.draw(graphic);
		const drawTime = performance.now() - startTime;
		window.frameList.push({ frameNumber, drawTime, hitCount: -1, rebuildCount: -1, retainedCount: -1, drawCallCount: -1 });
		if (frameNumber === CAPTURE_FRAME_LIST[CAPTURE_FRAME_LIST.length - 1] + 2) {
			window.isFinished = true;
		}
	}
}
const engineConfiguration = new EngineConfiguration();
engineConfiguration.canvasId = "mainCanvas";
engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
const engine = new Engine(engineConfiguration);
engine.getViewManager().setViewScaleMode(ViewScaleMode.stretchShort);
engine.run(new SettingsScene());
</script>`;

const server = http.createServer((request, response) => {
	const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
	if (requestPath === "/") {
		response.writeHead(200, { "Content-Type": "text/html" });
		response.end(PAGE_SOURCE);
		return;
	}
	if (requestPath === "/favicon.ico") {
		response.writeHead(204);
		response.end();
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
check(executablePath !== undefined, "크롬을 찾지 못함 (CHROME_PATH)");
const browser = await puppeteer.launch({ executablePath, headless: true });

// 한 길(캐시 켬, 끔)로 그린 장면의 찍은 화면들과 프레임마다 잰 값.
async function renderScene(cacheFlag) {
	const page = await browser.newPage();
	await page.setViewport({ width: 640 * 2, height: 360 * 2, deviceScaleFactor: 1.5 });
	const errorList = [];
	page.on("pageerror", (error) => errorList.push(error.message));
	page.on("console", (message) => {
		if (message.type() === "error" || message.type() === "warning") {
			errorList.push(message.text());
		}
	});
	await page.goto("http://127.0.0.1:" + port + "/?cache=" + cacheFlag);
	await page.waitForFunction(() => window.isFinished === true, { timeout: 60000 });
	// 찍은 화면은 하나씩 base64 로 받는다. (한 번에 받으면 CDP 가 넘길 수 있는 크기를 넘는다)
	const captureCount = await page.evaluate(() => window.captureList.length);
	const captureResultList = [];
	for (let captureIndex = 0; captureIndex < captureCount; ++captureIndex) {
		const captureResult = await page.evaluate(async (index) => {
			const image = new Image();
			image.src = await window.captureList[index];
			await image.decode();
			const canvas = new OffscreenCanvas(image.width, image.height);
			const context = canvas.getContext("2d");
			context.drawImage(image, 0, 0);
			const pixelBytes = new Uint8Array(context.getImageData(0, 0, image.width, image.height).data.buffer);
			let binaryText = "";
			for (let offset = 0; offset < pixelBytes.length; offset += 32768) {
				binaryText += String.fromCharCode.apply(null, pixelBytes.subarray(offset, offset + 32768));
			}
			return { width: image.width, height: image.height, pixelText: btoa(binaryText) };
		}, captureIndex);
		captureResultList.push({ width: captureResult.width, height: captureResult.height, pixels: Buffer.from(captureResult.pixelText, "base64") });
	}
	const frameList = await page.evaluate(() => window.frameList);
	await page.close();
	return { captureResultList, frameList, errorList };
}

// 프레임 구간의 장면 그리기 시간 가운데 값. (밀리초)
function readMedianDrawTime(frameList, firstFrame, lastFrame) {
	const timeList = frameList.filter((frame) => frame.frameNumber >= firstFrame && frame.frameNumber <= lastFrame).map((frame) => frame.drawTime).sort((left, right) => left - right);
	return timeList[Math.floor(timeList.length / 2)];
}

try {
	const uncachedResult = await renderScene("0");
	const cachedResult = await renderScene("1");
	checkEqual(uncachedResult.errorList.join("\n"), "", "캐시 끈 길 오류");
	checkEqual(cachedResult.errorList.join("\n"), "", "캐시 켠 길 오류");
	checkEqual(cachedResult.captureResultList.length, 5, "찍은 화면 수");
	const captureNameList = ["멈춤", "스크롤", "위치, 색, 글, 보임, 투명도, 배율 바꿈", "되돌림과 이동", "회전과 투명도"];
	for (let captureIndex = 0; captureIndex < cachedResult.captureResultList.length; ++captureIndex) {
		const cachedCapture = cachedResult.captureResultList[captureIndex];
		const uncachedCapture = uncachedResult.captureResultList[captureIndex];
		checkEqual(cachedCapture.width, 1920, "화면 폭");
		let differentPixelCount = 0;
		let drawnPixelCount = 0;
		for (let index = 0; index < cachedCapture.pixels.length; ++index) {
			if (cachedCapture.pixels[index] !== uncachedCapture.pixels[index]) {
				differentPixelCount += 1;
			}
		}
		for (let index = 0; index < cachedCapture.pixels.length; index += 4) {
			if (cachedCapture.pixels[index] !== 0 || cachedCapture.pixels[index + 1] !== 0 || cachedCapture.pixels[index + 2] !== 0) {
				drawnPixelCount += 1;
			}
		}
		checkEqual(differentPixelCount, 0, `캐시 켬과 끔 화소 (${captureNameList[captureIndex]})`);
		check(drawnPixelCount >= 400000, `장면을 찍었다 (${captureNameList[captureIndex]}, 검정이 아닌 화소 ${drawnPixelCount})`);
	}

	// 캐시를 켜면 멈춘 프레임과 스크롤 프레임에 다시 셈하는 것이 없고, 바꾼 프레임에는 바꾼 것만 다시 셈한다.
	const frameTable = new Map(cachedResult.frameList.map((frame) => [frame.frameNumber, frame]));
	checkEqual(frameTable.get(30).rebuildCount, 0, "멈춘 프레임 다시 셈 수");
	check(frameTable.get(30).hitCount >= 40, `멈춘 프레임 캐시로 그린 수 (${frameTable.get(30).hitCount})`);
	checkEqual(frameTable.get(70).rebuildCount, 0, "스크롤 프레임 다시 셈 수");
	check(frameTable.get(70).hitCount >= 40, `스크롤 프레임 캐시로 그린 수 (${frameTable.get(70).hitCount})`);
	const changedRebuildCount = frameTable.get(81).rebuildCount;
	check(changedRebuildCount >= 6 && changedRebuildCount <= 30, `바꾼 프레임은 바꾼 것만 다시 셈 (${changedRebuildCount})`);
	checkEqual(frameTable.get(83).rebuildCount, 0, "바꾼 뒤 멈춘 프레임 다시 셈 수");
	// 멈춘 프레임은 모든 묶음을 남긴 버퍼로 그리고, 바꾼 프레임은 남기지 않은 묶음이 있다.
	for (const frameNumber of [30, 86, 90]) {
		const frame = frameTable.get(frameNumber);
		check(frame.retainedCount >= 1 && frame.retainedCount === frame.drawCallCount, `멈춘 프레임은 남긴 묶음으로 그림 (${frameNumber}, ${frame.retainedCount} / ${frame.drawCallCount})`);
	}
	check(frameTable.get(81).retainedCount < frameTable.get(81).drawCallCount, `바꾼 프레임은 묶음을 다시 올림 (${frameTable.get(81).retainedCount} / ${frameTable.get(81).drawCallCount})`);
	for (const frame of uncachedResult.frameList) {
		check(frame.hitCount <= 0, `캐시 끈 길은 캐시로 그리지 않음 (${frame.frameNumber})`);
		check(frame.retainedCount <= 0, `캐시 끈 길은 남긴 묶음을 쓰지 않음 (${frame.frameNumber})`);
	}
	const uncachedStaticTime = readMedianDrawTime(uncachedResult.frameList, 10, 40);
	const cachedStaticTime = readMedianDrawTime(cachedResult.frameList, 10, 40);
	const uncachedScrollTime = readMedianDrawTime(uncachedResult.frameList, 45, 80);
	const cachedScrollTime = readMedianDrawTime(cachedResult.frameList, 45, 80);
	console.log(`장면 그리기 가운데 값(ms): 멈춤 끔 ${uncachedStaticTime.toFixed(3)} 켬 ${cachedStaticTime.toFixed(3)}, 스크롤 끔 ${uncachedScrollTime.toFixed(3)} 켬 ${cachedScrollTime.toFixed(3)}`);
	console.log(`캐시로 그린 수: 멈춤 ${frameTable.get(30).hitCount}, 스크롤 ${frameTable.get(70).hitCount}, 바꾼 프레임 다시 셈 ${changedRebuildCount}, 남긴 묶음 멈춤 ${frameTable.get(30).retainedCount} / ${frameTable.get(30).drawCallCount}, 스크롤 ${frameTable.get(70).retainedCount} / ${frameTable.get(70).drawCallCount}`);
}
finally {
	await browser.close();
	server.close();
}
finish("uigeometrycachechrome");
