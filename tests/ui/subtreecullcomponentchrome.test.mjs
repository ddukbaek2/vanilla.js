//==============================================================================
// 컴포넌트마다 하위 트리 거르기 크롬 시험. (NODE_PATH=$(npm root -g) node tests/ui/subtreecullcomponentchrome.test.mjs)
// - 엔진이 그리는 컴포넌트를 한 줄에 하나씩 단 스크롤 목록(줄 60 개)과, 화면 아래 바로 밖에 둔 노드들을 하위 트리 거르기를 켜고 끄고 그려 찍은 화면의 화소가 모두 같은지 본다.
//   컴포넌트: 칠, 라벨, 단추, 슬라이더(손잡이 원이 넘침), 진행 막대, 진행 고리, 그림자 글, 그림자 그림, 조각 글, 선 그래프(범위 밖 값), 막대 그래프, 바깥선, 부드러운 그늘, 외곽선 글.
// - 켜면 화면 밖 줄을 컴포넌트마다 돌지 않는지(경계를 알리는지), 끄면 도는지 센다.
// - 81 번 프레임에 세터로 그리는 곳을 화면 밖에서 안으로 넓힌다. (슬라이더 손잡이 반지름, 그림자 글과 그림의 그림자 내림, 조각 글 조각 더함, 선 그래프 값, 글꼴 크기,
//   솔버로 놓은 UINode 의 자리) 다음 프레임에 그려지는지와 화면이 끈 길과 같은지, 84 번 프레임에 되돌리면 다시 건너뛰는지 본다.
// - 크롬 경로는 CHROME_PATH 로 바꿀 수 있다. puppeteer-core 나 크롬이 없으면 실패한다.
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
const KIND_LIST = ["paint", "label", "button", "slider", "progress", "ring", "shadowText", "shadowImage", "richText", "lineChart", "barChart", "outline", "softShade", "strokeText"];
const WIDEN_LIST = ["slider", "shadowText", "richText", "lineChart", "shadowImage", "text"];

const PAGE_SOURCE = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{position:absolute;left:0;top:0;width:100%;height:100%}</style><canvas id="mainCanvas"></canvas>
<script type="module">
const { Engine, EngineConfiguration, Scene, WorldNode, Component, Vector2, Color, Colors, Rect, Pivot, Paint, Text, TextAlign, ViewScaleMode, UIView, UILabel, UIButton, UIScrollView, UISlider, UIProgressView, UIProgressRing, ShadowText, ShadowImage, RichText, UILineChart, UIBarChart, Outline, SoftShade, UINode, LayoutSolver } = await import("/import.js");
const isSubtreeCullingEnabled = new URLSearchParams(location.search).get("subtree") === "1";
const KIND_LIST = ${JSON.stringify(KIND_LIST)};
const WIDEN_LIST = ${JSON.stringify(WIDEN_LIST)};
const CAPTURE_FRAME_LIST = [30, 60, 82, 86];
const ROW_COUNT = 60;
window.visitCountList = new Array(ROW_COUNT).fill(0);
window.widenVisitCountList = new Array(WIDEN_LIST.length + 1).fill(0);
window.captureList = [];
window.frameList = [];

// 그리기 순회가 노드를 돌 때마다 세는 컴포넌트. (화면 밖 거르기가 컴포넌트마다 isDrawnInsideContent 를 묻는다, 내용 영역 안에 작은 점)
// 보이는 사각형 안에 다 든 하위 트리(Graphic.isInsideVisibleBounds)는 묻지 않고 그리므로 그때는 draw 에서 센다.
class VisitCounter extends Component {
	countList = null;
	countIndex = -1;
	isDrawnInsideContent() {
		this.countList[this.countIndex] += 1;
		return true;
	}
	draw(graphic) {
		if (typeof graphic.isInsideVisibleBounds === "function" && graphic.isInsideVisibleBounds()) {
			this.countList[this.countIndex] += 1;
		}
		graphic.setFillColor(Colors.white);
		graphic.drawRect(Rect.create(1, 1, 2, 2));
	}
}
// 그릴 때마다 세는 컴포넌트. (UINode 는 노드마다 거르기 없이 컴포넌트를 그린다)
class DrawCounter extends Component {
	countList = null;
	countIndex = -1;
	isDrawnInsideContent() {
		return true;
	}
	draw(graphic) {
		this.countList[this.countIndex] += 1;
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
const imageCanvas = document.createElement("canvas");
imageCanvas.width = 16;
imageCanvas.height = 16;
const imageContext = imageCanvas.getContext("2d");
imageContext.fillStyle = "#ffd27a";
imageContext.fillRect(2, 2, 12, 12);
// 줄에 그 종류의 컴포넌트 달기.
function attachKind(rowNode, kind, rowIndex) {
	if (kind === "paint") {
		const paint = rowNode.addComponent(Paint);
		paint.setColor("#4a3c30");
		paint.setRoundSize(8);
	}
	else if (kind === "label") {
		const label = rowNode.addComponent(UILabel);
		label.setText("라벨 " + rowIndex);
		label.setFontSize(14);
		label.setTextAlign(TextAlign.left);
		label.setTextColor("#f1e9d8");
	}
	else if (kind === "button") {
		const buttonNode = createBoxNode(rowNode, Vector2.create(180, 6), Vector2.create(90, 28));
		buttonNode.addComponent(UIView).setBackgroundColor(Color.createFromHEX("#2f7d4f"));
		buttonNode.addComponent(UIButton);
		const buttonLabel = buttonNode.addComponent(UILabel);
		buttonLabel.setText("켜기");
		buttonLabel.setFontSize(13);
		buttonLabel.setTextColor("#ffffff");
	}
	else if (kind === "slider") {
		const sliderNode = createBoxNode(rowNode, Vector2.create(20, 16), Vector2.create(200, 8));
		const slider = sliderNode.addComponent(UISlider);
		slider.setThumbRadius(12);
		slider.setValue((rowIndex % 7) / 6);
	}
	else if (kind === "progress") {
		const progressView = rowNode.addComponent(UIProgressView);
		progressView.setValue(0.4);
	}
	else if (kind === "ring") {
		const ringNode = createBoxNode(rowNode, Vector2.create(10, 2), Vector2.create(36, 36));
		ringNode.addComponent(UIProgressRing).setRatio(0.7);
	}
	else if (kind === "shadowText") {
		const shadowText = rowNode.addComponent(ShadowText);
		shadowText.setShadow("#000000", 0.8, 3, 4);
		shadowText.setText("그림자 " + rowIndex);
	}
	else if (kind === "shadowImage") {
		const imageNode = createBoxNode(rowNode, Vector2.create(30, 4), Vector2.create(32, 32));
		const shadowImage = imageNode.addComponent(ShadowImage);
		shadowImage.setImage(imageCanvas);
		shadowImage.setShadow("#000000", 0.7, 4, 6);
	}
	else if (kind === "richText") {
		const richText = rowNode.addComponent(RichText);
		richText.setFontSize(14);
		richText.appendSegment("HP ", { bold: true });
		richText.appendSegment(String(rowIndex), { fontSize: 22, textColor: Color.createFromHEX("#ff6666") });
		richText.appendSegment(" / 100", { strokeWidth: 2, strokeColor: Color.createFromHEX("#000000") });
	}
	else if (kind === "lineChart") {
		const chart = rowNode.addComponent(UILineChart);
		chart.setValueRange(0, 1);
		chart.setLineWidth(2);
		chart.setValueList([0.2, 0.9, 1.6, 0.4, -0.5, 0.7]);
	}
	else if (kind === "barChart") {
		const chart = rowNode.addComponent(UIBarChart);
		chart.setValueList([3, 5, 2, 7, 4]);
	}
	else if (kind === "outline") {
		const outline = rowNode.addComponent(Outline);
		outline.setLineWidth(3);
		outline.setRoundSize(8);
	}
	else if (kind === "softShade") {
		rowNode.addComponent(SoftShade);
	}
	else if (kind === "strokeText") {
		const text = rowNode.addComponent(Text);
		text.setText("외곽선 글 " + rowIndex);
		text.setFontSize(16);
		text.setStrokeColor("#000000");
		text.setStrokeWidth(4);
	}
}
let scrollView = null;
const widenTable = {};
let uiNode = null;
let uiSolver = null;
let uiTopConstraint = null;
let drawnFrameCount = 0;
function placeUINodeTop(top) {
	if (uiTopConstraint !== null) {
		uiNode.removeConstraint(uiTopConstraint);
	}
	uiTopConstraint = uiNode.topAnchor.equalTo(top);
	uiNode.addConstraint(uiTopConstraint);
	uiSolver.updateVariables();
}
class ComponentScene extends Scene {
	initialize(engine) {
		super.initialize(engine);
		const root = this.getRoot();
		root.setContentSize(Vector2.create(640, 360));
		const scrollNode = createBoxNode(root, Vector2.create(20, 20), Vector2.create(300, 320));
		scrollView = scrollNode.addComponent(UIScrollView);
		scrollView.setBackgroundColor(Color.createFromHEX("#1d1814"));
		scrollView.setScrollContentSize(Vector2.create(300, ROW_COUNT * 44));
		scrollView.setHorizontal(false);
		for (let rowIndex = 0; rowIndex < ROW_COUNT; ++rowIndex) {
			const rowNode = createBoxNode(scrollView.getContent(), Vector2.create(8, rowIndex * 44), Vector2.create(284, 40));
			attachKind(rowNode, KIND_LIST[rowIndex % KIND_LIST.length], rowIndex);
			const visitCounter = rowNode.addComponent(VisitCounter);
			visitCounter.countList = window.visitCountList;
			visitCounter.countIndex = rowIndex;
		}

		// 화면 아래 바로 밖에 둔 노드. (부모 묶음 노드 아래, 세터로 그리는 곳을 위로 넓혀 화면에 들인다)
		for (let widenIndex = 0; widenIndex < WIDEN_LIST.length; ++widenIndex) {
			const kind = WIDEN_LIST[widenIndex];
			const groupNode = createBoxNode(root, Vector2.create(340 + widenIndex * 48, 0), Vector2.create(0, 0));
			let node = null;
			let component = null;
			if (kind === "slider") {
				node = createBoxNode(groupNode, Vector2.create(0, 368), Vector2.create(40, 6));
				component = node.addComponent(UISlider);
				component.setThumbRadius(2);
				component.setValue(0.5);
			}
			else if (kind === "shadowText") {
				node = createBoxNode(groupNode, Vector2.create(0, 380), Vector2.create(44, 10));
				component = node.addComponent(ShadowText);
				component.setTextStyle(10, true, "#ffffff");
				component.setShadow("#ff4040", 1, 0, 0);
				component.setText("그림자");
			}
			else if (kind === "richText") {
				node = createBoxNode(groupNode, Vector2.create(0, 372), Vector2.create(44, 10));
				component = node.addComponent(RichText);
				component.setFontSize(10);
				component.setTextColor("#ffffff");
				component.appendSegment("가");
			}
			else if (kind === "lineChart") {
				node = createBoxNode(groupNode, Vector2.create(0, 370), Vector2.create(40, 20));
				component = node.addComponent(UILineChart);
				component.setValueRange(0, 1);
				component.setLineWidth(3);
				component.setLineColor(Color.createFromHEX("#40ff80"));
				component.setValueList([0.2, 0.5, 0.3]);
			}
			else if (kind === "shadowImage") {
				node = createBoxNode(groupNode, Vector2.create(0, 372), Vector2.create(24, 24));
				component = node.addComponent(ShadowImage);
				component.setImage(imageCanvas);
				component.setShadow("#40a0ff", 1, 0, 0);
			}
			else if (kind === "text") {
				node = createBoxNode(groupNode, Vector2.create(0, 380), Vector2.create(44, 10));
				component = node.addComponent(Text);
				component.setText("글");
				component.setFontSize(10);
				component.setTextColor("#ffff40");
			}
			const visitCounter = node.addComponent(VisitCounter);
			visitCounter.countList = window.widenVisitCountList;
			visitCounter.countIndex = widenIndex;
			widenTable[kind] = component;
		}

		// 솔버로 놓은 UINode. (화면 아래 밖에 두었다가 솔버로 들인다)
		uiSolver = new LayoutSolver();
		uiNode = new UINode();
		root.addChild(uiNode);
		uiNode.setSolver(uiSolver);
		uiNode.addConstraint(uiNode.leftAnchor.equalTo(580));
		uiNode.addConstraint(uiNode.widthAnchor.equalTo(40));
		uiNode.addConstraint(uiNode.heightAnchor.equalTo(20));
		placeUINodeTop(380);
		uiNode.addComponent(Paint).setColor("#ff8800");
		const drawCounter = uiNode.addComponent(DrawCounter);
		drawCounter.countList = window.widenVisitCountList;
		drawCounter.countIndex = WIDEN_LIST.length;
	}
	applyFrameEvent(frameNumber) {
		if (frameNumber > 40 && frameNumber <= 60) {
			scrollView.setScrollOffset(Vector2.create(0, -(frameNumber - 40) * 4.37));
		}
		if (frameNumber === 81) {
			widenTable.slider.setThumbRadius(24);
			widenTable.shadowText.setShadow("#ff4040", 1, -40, 0);
			widenTable.richText.appendSegment("나", { fontSize: 64 });
			widenTable.lineChart.setValueList([0.2, 3, 0.3]);
			widenTable.shadowImage.setShadow("#40a0ff", 1, -30, 0);
			widenTable.text.setFontSize(60);
			placeUINodeTop(330);
		}
		if (frameNumber === 84) {
			widenTable.slider.setThumbRadius(2);
			widenTable.shadowText.setShadow("#ff4040", 1, 0, 0);
			widenTable.richText.clearSegments();
			widenTable.richText.appendSegment("가");
			widenTable.lineChart.setValueList([0.2, 0.5, 0.3]);
			widenTable.shadowImage.setShadow("#40a0ff", 1, 0, 0);
			widenTable.text.setFontSize(10);
			placeUINodeTop(380);
		}
	}
	draw(graphic) {
		drawnFrameCount += 1;
		const frameNumber = drawnFrameCount;
		graphic.setSubtreeCullingEnabled(isSubtreeCullingEnabled);
		graphic.setTextBakeScaleStep(0);
		if (window.frameList.length > 0) {
			window.frameList[window.frameList.length - 1].culledSubtreeCount = graphic.getLastFrameCulledSubtreeCount();
		}
		this.applyFrameEvent(frameNumber);
		if (CAPTURE_FRAME_LIST.includes(frameNumber)) {
			window.captureList.push(engine.requestFrameCapture(engine.getFrameNumber()));
		}
		super.draw(graphic);
		window.frameList.push({ frameNumber, culledSubtreeCount: -1, visitCountList: window.visitCountList.slice(), widenVisitCountList: window.widenVisitCountList.slice() });
		if (frameNumber === 90) {
			window.isFinished = true;
		}
	}
}
const engineConfiguration = new EngineConfiguration();
engineConfiguration.canvasId = "mainCanvas";
engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
const engine = new Engine(engineConfiguration);
engine.getViewManager().setViewScaleMode(ViewScaleMode.stretchShort);
engine.run(new ComponentScene());
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
async function renderScene(subtreeFlag) {
	const page = await browser.newPage();
	await page.setViewport({ width: 640 * 2, height: 360 * 2, deviceScaleFactor: 1.5 });
	const errorList = [];
	page.on("pageerror", (error) => errorList.push(error.message));
	page.on("console", (message) => {
		if (message.type() === "error" || message.type() === "warning") {
			errorList.push(message.text());
		}
	});
	await gotoPage(page, "http://127.0.0.1:" + port + "/?subtree=" + subtreeFlag);
	await page.waitForFunction(() => window.isFinished === true, { timeout: 60000 });
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

// 두 프레임 사이에 그 줄을 돈 수.
function readVisitCount(frameTable, rowIndex, firstFrame, lastFrame) {
	return frameTable.get(lastFrame).visitCountList[rowIndex] - frameTable.get(firstFrame).visitCountList[rowIndex];
}

// 두 프레임 사이에 그 노드를 돈 수.
function readWidenVisitCount(frameTable, widenIndex, firstFrame, lastFrame) {
	return frameTable.get(lastFrame).widenVisitCountList[widenIndex] - frameTable.get(firstFrame).widenVisitCountList[widenIndex];
}

try {
	const offResult = await renderScene("0");
	const onResult = await renderScene("1");
	checkEqual(offResult.errorList.join("\n"), "", "거르기 끈 길 오류");
	checkEqual(onResult.errorList.join("\n"), "", "거르기 켠 길 오류");
	checkEqual(onResult.captureResultList.length, 4, "찍은 화면 수");
	const captureNameList = ["멈춤", "스크롤", "세터로 넓혀 들임", "되돌림"];
	for (let captureIndex = 0; captureIndex < onResult.captureResultList.length; ++captureIndex) {
		const onCapture = onResult.captureResultList[captureIndex];
		const offCapture = offResult.captureResultList[captureIndex];
		let differentPixelCount = 0;
		for (let index = 0; index < onCapture.pixels.length; ++index) {
			if (onCapture.pixels[index] !== offCapture.pixels[index]) {
				differentPixelCount += 1;
			}
		}
		checkEqual(differentPixelCount, 0, `거르기 켬과 끔 화소 (${captureNameList[captureIndex]})`);
	}
	// 세터로 넓혀 들인 화면이 되돌린 화면과 달라야 넓힌 그림이 화면에 들어온 것이다.
	let widenedPixelCount = 0;
	const widenedCapture = onResult.captureResultList[2].pixels;
	const revertedCapture = onResult.captureResultList[3].pixels;
	for (let index = 0; index < widenedCapture.length; ++index) {
		if (widenedCapture[index] !== revertedCapture[index]) {
			widenedPixelCount += 1;
		}
	}
	check(widenedPixelCount > 1000, `넓힌 그림이 화면에 들어옴 (${widenedPixelCount})`);

	const onFrameTable = new Map(onResult.frameList.map((frame) => [frame.frameNumber, frame]));
	const offFrameTable = new Map(offResult.frameList.map((frame) => [frame.frameNumber, frame]));
	// 컴포넌트마다 화면 밖 줄(20 번 뒤 그 종류의 첫 줄)은 끄면 프레임마다 돌고 켜면 돌지 않는다. (경계를 알린다)
	for (let kindIndex = 0; kindIndex < KIND_LIST.length; ++kindIndex) {
		const rowIndex = 28 + kindIndex;
		checkEqual(readVisitCount(offFrameTable, rowIndex, 10, 30), 20, `끄면 화면 밖 ${KIND_LIST[rowIndex % KIND_LIST.length]} 줄을 돎`);
		checkEqual(readVisitCount(onFrameTable, rowIndex, 10, 30), 0, `켜면 화면 밖 ${KIND_LIST[rowIndex % KIND_LIST.length]} 줄을 돌지 않음`);
	}
	checkEqual(readVisitCount(onFrameTable, 1, 10, 30), 20, "켜도 보이는 줄은 돎");
	// 화면 아래 밖 노드는 넓히기 전에 돌지 않고, 넓힌 다음 프레임부터 돌고, 되돌리면 다시 돌지 않는다.
	const widenNameList = [...WIDEN_LIST, "UINode"];
	for (let widenIndex = 0; widenIndex < widenNameList.length; ++widenIndex) {
		checkEqual(readWidenVisitCount(onFrameTable, widenIndex, 70, 80), 0, `넓히기 전 ${widenNameList[widenIndex]} 은 돌지 않음`);
		check(readWidenVisitCount(onFrameTable, widenIndex, 80, 83) >= 3, `넓힌 ${widenNameList[widenIndex]} 은 그 프레임부터 돎 (${readWidenVisitCount(onFrameTable, widenIndex, 80, 83)})`);
		checkEqual(readWidenVisitCount(onFrameTable, widenIndex, 85, 89), 0, `되돌린 ${widenNameList[widenIndex]} 은 다시 돌지 않음`);
	}
	console.log(`건너뛴 하위 트리: 멈춤 ${onFrameTable.get(30).culledSubtreeCount}, 스크롤 ${onFrameTable.get(60).culledSubtreeCount}, 넓힌 프레임 ${onFrameTable.get(82).culledSubtreeCount}, 넓힌 화소 ${widenedPixelCount}`);
}
finally {
	await browser.close();
	server.close();
}
finish("subtreecullcomponentchrome");
