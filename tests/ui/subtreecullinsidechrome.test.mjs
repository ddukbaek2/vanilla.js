//==============================================================================
// 보이는 사각형 안에 다 든 하위 트리 크롬 시험. (NODE_PATH=$(npm root -g) node tests/ui/subtreecullinsidechrome.test.mjs)
// - 그리기 순회가 노드의 하위 트리 경계가 보이는 사각형(화면과 걸린 자르기) 안에 다 든다고 보면 그 아래 자손은 화면 밖 견주기 없이 그리고(Graphic.isInsideVisibleBounds 가 참),
//   그 아래에서 자르기를 새로 걸면 그 자르기 안에서 다시 견주는지 본다. (절두체 거르기의 '다 안' 표시)
// - 왼쪽: 화면 안에 다 드는 판(스크롤 내용까지 화면 안) 아래 칸 여섯, 스크롤 목록(새 자르기, 줄 9 개, 줄마다 위와 아래 반쪽 칸, 칸 밖 줄도 화면 안), 둥근 마스크(새 자르기, 마스크 밖이지만 판 안에 놓인 칸).
//   프레임마다 소수 픽셀만큼 스크롤한다.
// - 오른쪽: 30 도 돌린 판(화면 밖 칸이 하나 있어 다 안이 아니다) 아래 판(돌린 부모 좌표라 변환을 건 뒤 디바이스 좌표로 다 안을 본다)의 칸 열여섯과 돌린 스크롤 목록(스텐실 자르기, 줄 8 개).
// - 칸마다 그린 수를 세어, 하위 트리 거르기를 켠 길과 끈 길(노드마다 컴포넌트만 거름)이 프레임마다 같은 칸을 그리는지 본다. (새 자르기 밖 칸은 켠 길도 그리지 않는다)
//   켬, 끔, 거르기를 모두 끈 길(setCullingEnabled(false))의 찍은 화면 화소가 모두 같은지 본다.
// - 켠 길에서 판 아래 칸은 '다 안'으로 그려지고, 스크롤 목록 가장자리에 걸친 줄의 칸은 '다 안'이 아니며, 변환 뒤 화면 견주기(isLocalRectVisible)가 끈 길보다 적은지 센다.
// - 씬이 그려진 프레임 번호로 일을 정하고 찍는다. 크롬 경로는 CHROME_PATH 로 바꿀 수 있다. puppeteer-core 나 크롬이 없으면 실패한다.
//==============================================================================
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";
import { check, checkEqual, finish } from "../testcheck.mjs";
import { gotoPage, launchBrowser } from "../chromepage.mjs";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const repositoryPath = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");
const contentTypeTable = { ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".html": "text/html" };

const PAGE_SOURCE = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{position:absolute;left:0;top:0;width:100%;height:100%}</style><canvas id="mainCanvas"></canvas>
<script type="module">
const { Engine, EngineConfiguration, Scene, WorldNode, Component, Vector2, Color, Colors, Rect, Pivot, Paint, Mask, ViewScaleMode, UIScrollView } = await import("/import.js");
const isSubtreeCullingEnabled = new URLSearchParams(location.search).get("subtree") === "1";
const isCullingEnabled = new URLSearchParams(location.search).get("culling") !== "0";
const CAPTURE_FRAME_LIST = [20, 41, 42, 63];
const LAST_FRAME = 66;
const COUNTER_LIMIT = 400;
window.drawCountList = new Array(COUNTER_LIMIT).fill(0);
window.insideCountList = new Array(COUNTER_LIMIT).fill(0);
window.counterNameList = [];
window.captureList = [];
window.frameList = [];

// 칸마다 붙여 그린 수와 '다 안'으로 그린 수를 세는 컴포넌트. (내용 영역 안에만 그린다)
class DrawCounter extends Component {
	counterIndex = -1;
	isDrawnInsideContent() {
		return true;
	}
	draw(graphic) {
		window.drawCountList[this.counterIndex] += 1;
		if (typeof graphic.isInsideVisibleBounds === "function" && graphic.isInsideVisibleBounds()) {
			window.insideCountList[this.counterIndex] += 1;
		}
		graphic.setFillColor(Colors.white);
		graphic.drawRect(Rect.create(2, 2, 3, 3));
	}
}
function createBoxNode(parentNode, position, size) {
	const node = new WorldNode();
	parentNode.addChild(node);
	node.setPivot(Pivot.topLeft);
	node.setLocalPosition(position);
	node.setContentSize(size);
	return node;
}
function createCountedBox(parentNode, position, size, colorText, counterName) {
	const node = createBoxNode(parentNode, position, size);
	node.addComponent(Paint).setColor(colorText);
	const counter = node.addComponent(DrawCounter);
	counter.counterIndex = window.counterNameList.length;
	window.counterNameList.push(counterName);
	return node;
}
let leftScrollView = null;
let rotatedScrollView = null;
let drawnFrameCount = 0;
class InsideCullScene extends Scene {
	initialize(engine) {
		super.initialize(engine);
		const root = this.getRoot();
		root.setContentSize(Vector2.create(640, 360));

		// 왼쪽 판: 화면 안에 다 든다.
		const panelNode = createBoxNode(root, Vector2.create(20, 20), Vector2.create(300, 320));
		panelNode.addComponent(Paint).setColor("#202838");
		for (let tileIndex = 0; tileIndex < 6; ++tileIndex) {
			createCountedBox(panelNode, Vector2.create(10 + tileIndex * 47, 10), Vector2.create(40, 40), "#3a6ea5", "판 칸 " + tileIndex);
		}
		// 스크롤 목록. (새 자르기, 줄마다 위와 아래 반쪽 칸, 가장자리에 걸친 줄은 반쪽이 자르기 밖이다)
		const leftScrollNode = createBoxNode(panelNode, Vector2.create(10, 70), Vector2.create(280, 150));
		leftScrollView = leftScrollNode.addComponent(UIScrollView);
		leftScrollView.setBackgroundColor(Color.createFromHEX("#151a24"));
		leftScrollView.setHorizontal(false);
		leftScrollView.setScrollContentSize(Vector2.create(280, 9 * 26));
		for (let rowIndex = 0; rowIndex < 9; ++rowIndex) {
			const rowNode = createBoxNode(leftScrollView.getContent(), Vector2.create(4, rowIndex * 26), Vector2.create(260, 24));
			rowNode.addComponent(Paint).setColor(rowIndex % 2 === 0 ? "#4a3c30" : "#5a4a3c");
			createCountedBox(rowNode, Vector2.create(8, 0), Vector2.create(120, 11), "#c89b3c", "줄 위 " + rowIndex);
			createCountedBox(rowNode, Vector2.create(8, 13), Vector2.create(120, 11), "#9bc83c", "줄 아래 " + rowIndex);
		}
		// 둥근 마스크. (새 자르기, 오른쪽 두 칸은 마스크 밖이지만 판 안이다)
		const maskNode = createBoxNode(panelNode, Vector2.create(10, 262), Vector2.create(200, 50));
		maskNode.addComponent(Paint).setColor("#303848");
		maskNode.addComponent(Mask).setRoundSize(16);
		for (let boxIndex = 0; boxIndex < 9; ++boxIndex) {
			createCountedBox(maskNode, Vector2.create(-5 + boxIndex * 30, 5), Vector2.create(25, 40), "#a53a6e", "마스크 칸 " + boxIndex);
		}

		// 오른쪽 돌린 판: 화면 밖 칸이 있어 다 안이 아니다. 그 아래 판은 돌린 부모 좌표라 변환을 건 뒤 디바이스 좌표로 다 안을 본다.
		const rotatedNode = createBoxNode(root, Vector2.create(480, 180), Vector2.create(200, 200));
		rotatedNode.setPivot(Pivot.middleCenter);
		rotatedNode.setLocalRotation(30);
		createBoxNode(rotatedNode, Vector2.create(900, 0), Vector2.create(20, 20)).addComponent(Paint).setColor("#ffffff");
		const innerNode = createBoxNode(rotatedNode, Vector2.create(0, 0), Vector2.create(200, 200));
		innerNode.addComponent(Paint).setColor("#283820");
		for (let tileIndex = 0; tileIndex < 16; ++tileIndex) {
			createCountedBox(innerNode, Vector2.create(8 + (tileIndex % 8) * 23, 8 + System.Math.floor(tileIndex / 8) * 23), Vector2.create(20, 20), "#6ea53a", "돌린 판 칸 " + tileIndex);
		}
		// 돌린 자르기의 경계 상자는 넉넉하므로 좁은 칸으로 둔다. (넓으면 칸 밖 줄도 경계 상자에 걸쳐 두 길 모두 그린다)
		const rotatedScrollNode = createBoxNode(innerNode, Vector2.create(10, 60), Vector2.create(40, 50));
		rotatedScrollView = rotatedScrollNode.addComponent(UIScrollView);
		rotatedScrollView.setBackgroundColor(Color.createFromHEX("#151a24"));
		rotatedScrollView.setHorizontal(false);
		rotatedScrollView.setScrollContentSize(Vector2.create(40, 8 * 22));
		for (let rowIndex = 0; rowIndex < 8; ++rowIndex) {
			createCountedBox(rotatedScrollView.getContent(), Vector2.create(4, rowIndex * 22), Vector2.create(30, 18), "#3ca5c8", "돌린 줄 " + rowIndex);
		}
	}
	applyFrameEvent(frameNumber) {
		// 21 ~ 66: 프레임마다 소수 픽셀만큼 스크롤. (줄이 자르기 가장자리에 걸쳤다 나간다)
		if (frameNumber > 20) {
			leftScrollView.setScrollOffset(Vector2.create(0, -(frameNumber - 20) * 1.37));
			rotatedScrollView.setScrollOffset(Vector2.create(0, -(frameNumber - 20) * 1.13));
		}
	}
	draw(graphic) {
		drawnFrameCount += 1;
		const frameNumber = drawnFrameCount;
		graphic.setCullingEnabled(isCullingEnabled);
		graphic.setSubtreeCullingEnabled(isSubtreeCullingEnabled);
		graphic.setTextBakeScaleStep(0);
		if (frameNumber <= LAST_FRAME + 1 && window.frameList.length > 0 && window.frameList[window.frameList.length - 1].frameNumber === frameNumber - 1) {
			window.frameList[window.frameList.length - 1].culledSubtreeCount = graphic.getLastFrameCulledSubtreeCount();
		}
		this.applyFrameEvent(frameNumber);
		if (CAPTURE_FRAME_LIST.includes(frameNumber)) {
			window.captureList.push(engine.requestFrameCapture(engine.getFrameNumber()));
		}
		// 이 프레임에 변환 뒤 화면 견주기를 부른 수를 센다.
		let visibleCheckCount = 0;
		const isLocalRectVisible = graphic.isLocalRectVisible;
		graphic.isLocalRectVisible = function (rect) {
			visibleCheckCount += 1;
			return isLocalRectVisible.call(this, rect);
		};
		super.draw(graphic);
		delete graphic.isLocalRectVisible;
		// 마지막 프레임 뒤에도 엔진은 계속 그리므로(찍은 화면을 읽는 동안 켬과 끔의 프레임 수가 달라짐) 그 뒤 프레임은 남기지 않는다.
		if (frameNumber <= LAST_FRAME) {
			window.frameList.push({ frameNumber, culledSubtreeCount: -1, visibleCheckCount, drawCountList: window.drawCountList.slice(0, window.counterNameList.length), insideCountList: window.insideCountList.slice(0, window.counterNameList.length) });
		}
		if (frameNumber === LAST_FRAME) {
			window.isFinished = true;
		}
	}
}
const System = globalThis;
const engineConfiguration = new EngineConfiguration();
engineConfiguration.canvasId = "mainCanvas";
engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
const engine = new Engine(engineConfiguration);
engine.getViewManager().setViewScaleMode(ViewScaleMode.stretchShort);
engine.run(new InsideCullScene());
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
const browser = await launchBrowser(puppeteer, { executablePath, headless: true });

// 한 길(하위 트리 거르기 켬, 끔)로 그린 장면의 찍은 화면들과 프레임마다 센 값.
async function renderScene(queryText) {
	const page = await browser.newPage();
	await page.setViewport({ width: 640 * 2, height: 360 * 2, deviceScaleFactor: 1.5 });
	const errorList = [];
	page.on("pageerror", (error) => errorList.push(error.message));
	page.on("console", (message) => {
		if (message.type() === "error" || message.type() === "warning") {
			errorList.push(message.text());
		}
	});
	await gotoPage(page, "http://127.0.0.1:" + port + "/?" + queryText);
	// 다 그리지 못하면 페이지 오류를 같이 알린다.
	await page.waitForFunction(() => window.isFinished === true, { timeout: 60000 }).catch((error) => {
		throw new Error(error.message + "\n" + errorList.join("\n"));
	});
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
	const counterNameList = await page.evaluate(() => window.counterNameList);
	await page.close();
	return { captureResultList, frameList, counterNameList, errorList };
}

// 이름이 앞말로 시작하는 칸들의 번호.
function findCounterIndexList(counterNameList, prefixText) {
	const indexList = [];
	counterNameList.forEach((counterName, counterIndex) => {
		if (counterName.startsWith(prefixText)) {
			indexList.push(counterIndex);
		}
	});
	return indexList;
}

try {
	const offResult = await renderScene("subtree=0");
	const onResult = await renderScene("subtree=1");
	const noneResult = await renderScene("subtree=0&culling=0");
	checkEqual(offResult.errorList.join("\n"), "", "거르기 끈 길 오류");
	checkEqual(onResult.errorList.join("\n"), "", "거르기 켠 길 오류");
	checkEqual(noneResult.errorList.join("\n"), "", "거르기를 모두 끈 길 오류");
	checkEqual(onResult.captureResultList.length, 4, "찍은 화면 수");
	checkEqual(onResult.frameList.length, 66, "켠 길 프레임 수");
	checkEqual(offResult.frameList.length, 66, "끈 길 프레임 수");
	const captureNameList = ["멈춤", "스크롤 41", "스크롤 42", "스크롤 63"];
	for (let captureIndex = 0; captureIndex < onResult.captureResultList.length; ++captureIndex) {
		const onCapture = onResult.captureResultList[captureIndex];
		const offCapture = offResult.captureResultList[captureIndex];
		const noneCapture = noneResult.captureResultList[captureIndex];
		checkEqual(onCapture.width, 1920, "화면 폭");
		let differentPixelCount = 0;
		let differentNonePixelCount = 0;
		for (let index = 0; index < onCapture.pixels.length; ++index) {
			if (onCapture.pixels[index] !== offCapture.pixels[index]) {
				differentPixelCount += 1;
			}
			if (onCapture.pixels[index] !== noneCapture.pixels[index]) {
				differentNonePixelCount += 1;
			}
		}
		checkEqual(differentPixelCount, 0, `${captureNameList[captureIndex]}: 켬과 끔 화소 바이트 같음`);
		checkEqual(differentNonePixelCount, 0, `${captureNameList[captureIndex]}: 켬과 거르기 모두 끔 화소 바이트 같음`);
	}

	// 칸마다 그린 수가 켬과 끔에서 프레임마다 같다. (새 자르기 밖 칸은 켠 길도 그리지 않고, 들어오는 칸은 그 프레임에 그린다)
	const counterNameList = onResult.counterNameList;
	checkEqual(counterNameList.length, 6 + 18 + 9 + 16 + 8, "칸 수");
	const offFrameTable = new Map(offResult.frameList.map((frame) => [frame.frameNumber, frame]));
	const onFrameTable = new Map(onResult.frameList.map((frame) => [frame.frameNumber, frame]));
	// 돌린 스크롤 목록의 줄은 두 길 모두 넉넉한 경계 상자로 보되 견주는 좌표가 달라(켬은 부모 좌표, 끔은 디바이스 좌표) 켠 길이 더 적게 그릴 수 있다. 켠 길이 그린 줄은 끈 길도 그린다. (화소는 위에서 같다)
	let mismatchText = "";
	let rotatedMismatchText = "";
	for (const onFrame of onResult.frameList) {
		const offFrame = offFrameTable.get(onFrame.frameNumber);
		const previousOnFrame = onFrameTable.get(onFrame.frameNumber - 1);
		const previousOffFrame = offFrameTable.get(onFrame.frameNumber - 1);
		for (let counterIndex = 0; counterIndex < counterNameList.length; ++counterIndex) {
			const onDrawCount = onFrame.drawCountList[counterIndex] - (previousOnFrame ? previousOnFrame.drawCountList[counterIndex] : 0);
			const offDrawCount = offFrame.drawCountList[counterIndex] - (previousOffFrame ? previousOffFrame.drawCountList[counterIndex] : 0);
			const countText = `${onFrame.frameNumber} 프레임 ${counterNameList[counterIndex]}: 켬 ${onDrawCount}, 끔 ${offDrawCount}`;
			if (counterNameList[counterIndex].startsWith("돌린 줄 ")) {
				if (rotatedMismatchText === "" && onDrawCount > offDrawCount) {
					rotatedMismatchText = countText;
				}
			}
			else if (mismatchText === "" && onDrawCount !== offDrawCount) {
				mismatchText = countText;
			}
		}
	}
	checkEqual(mismatchText, "", "칸마다 그린 수가 켬과 끔에서 프레임마다 같음");
	checkEqual(rotatedMismatchText, "", "돌린 스크롤 목록에서 켠 길이 그린 줄은 끈 길도 그림");

	// 새 자르기 밖 칸은 그리지 않는다. (마지막 프레임에 그린 칸, 스크롤 목록은 보이는 것만, 마스크 밖 칸은 없음)
	const lastOnFrame = onResult.frameList[onResult.frameList.length - 1];
	const beforeLastOnFrame = onResult.frameList[onResult.frameList.length - 2];
	const isDrawnInLastFrame = (counterIndex) => lastOnFrame.drawCountList[counterIndex] > beforeLastOnFrame.drawCountList[counterIndex];
	const rowIndexList = findCounterIndexList(counterNameList, "줄 ");
	const drawnRowCount = rowIndexList.filter(isDrawnInLastFrame).length;
	check(drawnRowCount > 6 && drawnRowCount < 18, `스크롤 목록 칸은 보이는 것만 그림 (${drawnRowCount} / 18)`);
	const maskIndexList = findCounterIndexList(counterNameList, "마스크 칸 ");
	check(!isDrawnInLastFrame(maskIndexList[7]) && !isDrawnInLastFrame(maskIndexList[8]), "마스크 밖 오른쪽 두 칸은 그리지 않음");
	check(isDrawnInLastFrame(maskIndexList[0]) && isDrawnInLastFrame(maskIndexList[4]), "마스크에 걸친 칸과 안 칸은 그림");
	const rotatedRowIndexList = findCounterIndexList(counterNameList, "돌린 줄 ");
	const drawnRotatedRowCount = rotatedRowIndexList.filter(isDrawnInLastFrame).length;
	check(drawnRotatedRowCount >= 2 && drawnRotatedRowCount < 8, `돌린 스크롤 목록 칸은 보이는 것만 그림 (${drawnRotatedRowCount} / 8)`);
	check(onFrameTable.get(30).culledSubtreeCount > 0, `켠 길은 '다 안' 아래 새 자르기 밖 하위 트리를 건너뜀 (${onFrameTable.get(30).culledSubtreeCount})`);

	// '다 안'으로 그린 칸. (판 아래 칸은 프레임마다, 가장자리에 걸친 줄의 칸은 아님)
	const panelIndexList = findCounterIndexList(counterNameList, "판 칸 ");
	const rotatedPanelIndexList = findCounterIndexList(counterNameList, "돌린 판 칸 ");
	const isPanelInside = panelIndexList.every((counterIndex) => lastOnFrame.insideCountList[counterIndex] === lastOnFrame.drawCountList[counterIndex] && lastOnFrame.drawCountList[counterIndex] === lastOnFrame.frameNumber);
	check(isPanelInside, "판 아래 칸은 프레임마다 '다 안'으로 그림");
	const isRotatedPanelInside = rotatedPanelIndexList.every((counterIndex) => lastOnFrame.insideCountList[counterIndex] === lastOnFrame.drawCountList[counterIndex] && lastOnFrame.drawCountList[counterIndex] === lastOnFrame.frameNumber);
	check(isRotatedPanelInside, "돌린 판 아래 칸도 프레임마다 '다 안'으로 그림 (변환 뒤 디바이스 좌표로 본다)");
	const partialRowCount = rowIndexList.filter((counterIndex) => lastOnFrame.drawCountList[counterIndex] > lastOnFrame.insideCountList[counterIndex]).length;
	const insideRowCount = rowIndexList.filter((counterIndex) => lastOnFrame.insideCountList[counterIndex] > 0).length;
	check(partialRowCount > 0, `가장자리에 걸친 줄의 칸은 '다 안'이 아닌 프레임이 있음 (${partialRowCount})`);
	check(insideRowCount > 0, `새 자르기 안에 다 든 줄의 칸은 다시 '다 안'으로 그림 (${insideRowCount})`);
	const offInsideCount = offResult.frameList[offResult.frameList.length - 1].insideCountList.reduce((sum, value) => sum + value, 0);
	checkEqual(offInsideCount, 0, "끈 길은 '다 안'이 없음");

	// 켠 길은 '다 안' 아래에서 변환 뒤 화면 견주기를 하지 않는다.
	const onVisibleCheckCount = onFrameTable.get(30).visibleCheckCount;
	const offVisibleCheckCount = offFrameTable.get(30).visibleCheckCount;
	check(onVisibleCheckCount * 2 < offVisibleCheckCount, `켠 길의 변환 뒤 화면 견주기가 끈 길의 반보다 적음 (켬 ${onVisibleCheckCount}, 끔 ${offVisibleCheckCount})`);
	console.log(`변환 뒤 화면 견주기 수(30): 켬 ${onVisibleCheckCount} 끔 ${offVisibleCheckCount}, 건너뛴 하위 트리 ${onFrameTable.get(30).culledSubtreeCount}, 그린 줄 칸 ${drawnRowCount}, '다 안' 줄 칸 ${insideRowCount}, 걸친 줄 칸 ${partialRowCount}`);
}
finally {
	await browser.close();
	server.close();
}
finish("subtreecullinsidechrome");
