//==============================================================================
// 하위 트리 거르기 크롬 시험. (NODE_PATH=$(npm root -g) node tests/ui/subtreecullchrome.test.mjs)
// - 스크롤 목록(줄 100 개), 돌린 부모 안의 마스크와 겹친 스크롤 목록(줄 40 개), 그림자 글, 경계를 모르는 사용자 노드,
//   경계를 알리는 사용자 노드(내용 영역 밖 아래로 그림)가 섞인 장면을 하위 트리 거르기를 켜고 끄고 그려 찍은 화면의 화소가 모두 같은지 본다.
//   멈춘 때, 스크롤하는 때, 화면 밖 줄을 옮겨 들이고 크기를 키워 들이고 끄고 숨긴 때, 되돌린 때, 돌린 때를 찍는다.
// - 거르기를 켜면 화면 밖 줄을 돌지 않는지(줄의 컴포넌트에 묻는 수가 오르지 않는지), 끄면 도는지 센다.
// - 화면 밖 줄을 옮기거나 키우면 다음 프레임에 경계를 다시 셈해 그 줄을 도는지 센다.
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
const { Engine, EngineConfiguration, Scene, WorldNode, Component, Vector2, Color, Colors, Rect, Pivot, Paint, Mask, ShadowText, TextAlign, ViewScaleMode, UIView, UILabel, UIButton, UIScrollView } = await import("/import.js");
const isSubtreeCullingEnabled = new URLSearchParams(location.search).get("subtree") === "1";
const CAPTURE_FRAME_LIST = [30, 70, 82, 86, 90];
const ROW_COUNT = 100;
const INNER_ROW_COUNT = 40;
window.visitCountList = new Array(ROW_COUNT).fill(0);
window.captureList = [];
window.frameList = [];

// 줄마다 붙여 그리기 순회가 줄을 돌 때마다 세는 컴포넌트. (화면 밖 거르기가 컴포넌트마다 isDrawnInsideContent 를 묻는다)
class VisitCounter extends Component {
	rowIndex = -1;
	isDrawnInsideContent() {
		window.visitCountList[this.rowIndex] += 1;
		return true;
	}
	draw(graphic) {
		graphic.setFillColor(Colors.white);
		graphic.drawRect(Rect.create(2, 2, 4, 4));
	}
}
// draw 를 덮어쓰고 경계를 알리지 않는 노드. (내용 영역 밖 왼쪽까지 그린다, 조상은 건너뛰지 않아야 한다)
class UnknownDrawNode extends WorldNode {
	draw(graphic) {
		super.draw(graphic);
		graphic.setFillColor(Color.createFromHEX("#ff00ff"));
		graphic.drawRect(Rect.create(-14, 4, 10, 10));
	}
}
// draw 를 덮어쓰고 경계를 알리는 노드. (내용 영역 밖 아래로 길게 그린다, 줄이 위로 나가도 아래 끝은 보인다)
class KnownDrawNode extends WorldNode {
	draw(graphic) {
		super.draw(graphic);
		graphic.setFillColor(Color.createFromHEX("#33ddff"));
		graphic.drawRect(Rect.create(0, 0, 6, 70));
	}
	calculateDrawnRect(rect) {
		rect.position.set(0, 0);
		rect.size.set(6, 70);
		return true;
	}
}
function createBoxNode(parentNode, position, size, nodeClass = WorldNode) {
	const node = new nodeClass();
	parentNode.addChild(node);
	node.setPivot(Pivot.topLeft);
	node.setLocalPosition(position);
	node.setContentSize(size);
	return node;
}
function createScrollView(parentNode, position, size, contentHeight) {
	const scrollNode = createBoxNode(parentNode, position, size);
	const scrollView = scrollNode.addComponent(UIScrollView);
	scrollView.setBackgroundColor(Color.createFromHEX("#1d1814"));
	scrollView.setScrollContentSize(Vector2.create(size.x, contentHeight));
	scrollView.setHorizontal(false);
	return scrollView;
}
const rowList = [];
let outerScrollView = null;
let innerScrollView = null;
let rotatedPanel = null;
let drawnFrameCount = 0;
class SubtreeScene extends Scene {
	initialize(engine) {
		super.initialize(engine);
		const root = this.getRoot();
		root.setContentSize(Vector2.create(640, 360));
		outerScrollView = createScrollView(root, Vector2.create(20, 20), Vector2.create(300, 320), ROW_COUNT * 34);
		for (let rowIndex = 0; rowIndex < ROW_COUNT; ++rowIndex) {
			const rowNode = createBoxNode(outerScrollView.getContent(), Vector2.create(6, rowIndex * 34), Vector2.create(280, 30));
			const rowPaint = rowNode.addComponent(Paint);
			rowPaint.setColor(rowIndex % 2 === 0 ? "#4a3c30" : "#5a4a3c");
			rowPaint.setRoundSize(7);
			rowNode.addComponent(VisitCounter).rowIndex = rowIndex;
			const label = rowNode.addComponent(UILabel);
			label.setText("줄 " + rowIndex + " 소리 크기");
			label.setFontSize(14);
			label.setTextAlign(TextAlign.left);
			label.setTextColor("#f1e9d8");
			const buttonNode = createBoxNode(rowNode, Vector2.create(200, 3), Vector2.create(70, 24));
			buttonNode.addComponent(UIView).setBackgroundColor(Color.createFromHEX(rowIndex % 3 === 0 ? "#2f7d4f" : "#7d2f3f"));
			const buttonLabel = buttonNode.addComponent(UILabel);
			buttonLabel.setText(rowIndex % 3 === 0 ? "켜기" : "끄기");
			buttonLabel.setFontSize(13);
			buttonLabel.setTextColor("#ffffff");
			buttonNode.addComponent(UIButton);
			if (rowIndex % 10 === 4) {
				const shadowNode = createBoxNode(rowNode, Vector2.create(120, 2), Vector2.create(70, 26));
				const shadowText = shadowNode.addComponent(ShadowText);
				shadowText.setShadow("#000000", 0.8, 2, 2);
				shadowText.setText("그림자");
			}
			if (rowIndex % 7 === 3) {
				createBoxNode(rowNode, Vector2.create(14, 8), Vector2.create(10, 10), UnknownDrawNode);
			}
			if (rowIndex % 5 === 1) {
				createBoxNode(rowNode, Vector2.create(190, 0), Vector2.create(6, 30), KnownDrawNode);
			}
			rowList.push({ rowNode, rowPaint, label, buttonNode });
		}

		// 돌린 부모 안의 마스크 안에 스크롤 목록. (자르기가 겹친다)
		rotatedPanel = createBoxNode(root, Vector2.create(360, 40), Vector2.create(250, 280));
		rotatedPanel.setLocalRotation(8);
		rotatedPanel.addComponent(Paint).setColor("#30445a");
		const maskNode = createBoxNode(rotatedPanel, Vector2.create(10, 10), Vector2.create(230, 260));
		maskNode.addComponent(Mask).setRoundSize(12);
		innerScrollView = createScrollView(maskNode, Vector2.create(0, 0), Vector2.create(230, 300), INNER_ROW_COUNT * 30);
		for (let rowIndex = 0; rowIndex < INNER_ROW_COUNT; ++rowIndex) {
			const rowNode = createBoxNode(innerScrollView.getContent(), Vector2.create(4, rowIndex * 30), Vector2.create(222, 26));
			rowNode.addComponent(Paint).setColor(rowIndex % 2 === 0 ? "#556b2f" : "#2f4f4f");
			const label = rowNode.addComponent(UILabel);
			label.setText("안쪽 " + rowIndex);
			label.setFontSize(12);
			label.setTextColor("#ffffff");
		}
	}
	applyFrameEvent(frameNumber) {
		// 41 ~ 80: 프레임마다 소수 픽셀만큼 스크롤. (부모 이동만 바뀐다)
		if (frameNumber > 40 && frameNumber <= 80) {
			outerScrollView.setScrollOffset(Vector2.create(0, -(frameNumber - 40) * 3.37));
			innerScrollView.setScrollOffset(Vector2.create(0, -(frameNumber - 40) * 2.11));
		}
		// 81: 화면 밖 줄을 옮겨 들이고, 위로 나간 줄의 크기를 키워 들이고, 보이는 줄을 끄고 숨긴다.
		if (frameNumber === 81) {
			rowList[82].rowNode.setLocalPosition(Vector2.create(30, 6 * 34));
			rowList[2].rowNode.setContentSize(Vector2.create(280, 190));
			rowList[7].rowNode.setActive(false);
			rowList[8].rowNode.setVisible(false);
			rowList[9].label.setText("바뀐 글 아홉째 줄");
			// 처음에 보이다 스크롤로 위로 나간 줄의 배율을 바꾼다. (86 번 프레임에 들여온다)
			rowList[0].rowNode.setLocalScale(Vector2.create(1.2, 1.2));
		}
		if (frameNumber === 84) {
			rowList[82].rowNode.setLocalPosition(Vector2.create(6, 82 * 34));
			rowList[2].rowNode.setContentSize(Vector2.create(280, 30));
			rowList[7].rowNode.setActive(true);
			rowList[8].rowNode.setVisible(true);
		}
		// 86: 화면 밖에서 배율을 바꾼 줄을 들여온다. (건너뛴 사이에 배율이 바뀌어도 글 굽기 배율이 건너뛰지 않은 때와 같아야 한다)
		if (frameNumber === 86) {
			rowList[0].rowNode.setLocalPosition(Vector2.create(10, 4 * 34 + 8));
		}
		if (frameNumber === 88) {
			rowList[12].rowNode.setLocalRotation(-6);
			rowList[95].rowNode.setLocalScale(Vector2.create(1, -110));
			rotatedPanel.setLocalRotation(-4);
		}
	}
	draw(graphic) {
		drawnFrameCount += 1;
		const frameNumber = drawnFrameCount;
		graphic.setSubtreeCullingEnabled(isSubtreeCullingEnabled);
		// 글을 1:1 배율로 굽는다. (배율이 움직이는 노드만 묶은 배율로 굽는 길을 본다)
		graphic.setTextBakeScaleStep(0);
		if (window.frameList.length > 0) {
			window.frameList[window.frameList.length - 1].culledSubtreeCount = graphic.getLastFrameCulledSubtreeCount();
		}
		this.applyFrameEvent(frameNumber);
		if (CAPTURE_FRAME_LIST.includes(frameNumber)) {
			window.captureList.push(engine.requestFrameCapture(engine.getFrameNumber()));
		}
		super.draw(graphic);
		window.frameList.push({ frameNumber, culledSubtreeCount: -1, visitCountList: window.visitCountList.slice() });
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
engine.run(new SubtreeScene());
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

try {
	const offResult = await renderScene("0");
	const onResult = await renderScene("1");
	checkEqual(offResult.errorList.join("\n"), "", "거르기 끈 길 오류");
	checkEqual(onResult.errorList.join("\n"), "", "거르기 켠 길 오류");
	checkEqual(onResult.captureResultList.length, 5, "찍은 화면 수");
	const captureNameList = ["멈춤", "스크롤", "옮겨 들임, 키워 들임, 끔, 숨김, 글 바꿈", "되돌림, 배율 바꾼 줄 들임", "돌림과 세로 배율"];
	for (let captureIndex = 0; captureIndex < onResult.captureResultList.length; ++captureIndex) {
		const onCapture = onResult.captureResultList[captureIndex];
		const offCapture = offResult.captureResultList[captureIndex];
		checkEqual(onCapture.width, 1920, "화면 폭");
		let differentPixelCount = 0;
		let drawnPixelCount = 0;
		for (let index = 0; index < onCapture.pixels.length; ++index) {
			if (onCapture.pixels[index] !== offCapture.pixels[index]) {
				differentPixelCount += 1;
			}
		}
		for (let index = 0; index < onCapture.pixels.length; index += 4) {
			if (onCapture.pixels[index] !== 0 || onCapture.pixels[index + 1] !== 0 || onCapture.pixels[index + 2] !== 0) {
				drawnPixelCount += 1;
			}
		}
		checkEqual(differentPixelCount, 0, `거르기 켬과 끔 화소 (${captureNameList[captureIndex]})`);
		check(drawnPixelCount >= 400000, `장면을 찍었다 (${captureNameList[captureIndex]}, 검정이 아닌 화소 ${drawnPixelCount})`);
	}

	const onFrameTable = new Map(onResult.frameList.map((frame) => [frame.frameNumber, frame]));
	const offFrameTable = new Map(offResult.frameList.map((frame) => [frame.frameNumber, frame]));
	// 켜면 화면 밖 하위 트리를 건너뛰고, 끄면 하나도 건너뛰지 않는다.
	const onCulledCount = onFrameTable.get(30).culledSubtreeCount;
	check(onCulledCount >= 80, `켜면 화면 밖 하위 트리를 건너뜀 (${onCulledCount})`);
	for (const frame of offResult.frameList) {
		if (frame.culledSubtreeCount > 0) {
			check(false, `끄면 건너뛰지 않음 (${frame.frameNumber}, ${frame.culledSubtreeCount})`);
			break;
		}
	}
	// 화면 밖 줄(50 번, 보이는 줄은 0 ~ 9 번)은 끄면 프레임마다 돌고 켜면 돌지 않는다. 보이는 줄(1 번)은 둘 다 돈다.
	checkEqual(readVisitCount(offFrameTable, 50, 10, 30), 20, "끄면 화면 밖 줄을 프레임마다 돎");
	checkEqual(readVisitCount(onFrameTable, 50, 10, 30), 0, "켜면 화면 밖 줄을 돌지 않음");
	checkEqual(readVisitCount(onFrameTable, 1, 10, 30), 20, "켜도 보이는 줄은 돎");
	// 그림자 글이 든 줄(54 번)은 그림자 글이 경계를 알려 켜면 돌지 않고, 경계를 모르는 사용자 노드가 든 줄(80 번)은 켜도 돈다.
	checkEqual(readVisitCount(onFrameTable, 54, 10, 30), 0, "경계를 알리는 그림자 글 줄은 켜면 돌지 않음");
	checkEqual(readVisitCount(onFrameTable, 80, 10, 30), 20, "경계를 모르는 사용자 노드 줄은 켜도 돎");
	// 화면 밖 줄을 옮겨 들이면(82 번, 81 번 프레임) 그 프레임부터 돌고, 되돌리면(84 번 프레임) 다시 돌지 않는다.
	checkEqual(readVisitCount(onFrameTable, 82, 70, 80), 0, "옮기기 전 82 번 줄은 돌지 않음");
	checkEqual(readVisitCount(onFrameTable, 82, 80, 83), 3, "옮겨 들인 82 번 줄은 다음 프레임부터 돎");
	checkEqual(readVisitCount(onFrameTable, 82, 84, 90), 0, "되돌린 82 번 줄은 다시 돌지 않음");
	// 위로 나간 줄(2 번)을 키우면 그 프레임부터 돈다.
	checkEqual(readVisitCount(onFrameTable, 2, 75, 80), 0, "위로 나간 2 번 줄은 돌지 않음");
	// (크기를 바꾸면 그 줄의 경계를 다시 셈하며 한 번 더 묻는다)
	checkEqual(readVisitCount(onFrameTable, 2, 80, 83), 4, "키운 2 번 줄은 다음 프레임부터 돎");
	// 세로 배율을 크게 뒤집은 화면 밖 줄(95 번, 88 번 프레임)은 위로 늘어 보이게 되어 돈다.
	checkEqual(readVisitCount(onFrameTable, 95, 84, 87), 0, "늘리기 전 95 번 줄은 돌지 않음");
	check(readVisitCount(onFrameTable, 95, 87, 90) === 3, `늘린 95 번 줄은 돎 (${readVisitCount(onFrameTable, 95, 87, 90)})`);
	// 처음에 보이다 스크롤로 나간 뒤 화면 밖에서 배율을 바꾼 줄(0 번)은 들여온 86 번 프레임부터 돈다.
	checkEqual(readVisitCount(onFrameTable, 0, 80, 85), 0, "배율만 바꾼 화면 밖 0 번 줄은 돌지 않음");
	checkEqual(readVisitCount(onFrameTable, 0, 85, 86), 1, "들여온 0 번 줄은 돎");
	console.log(`건너뛴 하위 트리: 멈춤 ${onCulledCount}, 스크롤 ${onFrameTable.get(70).culledSubtreeCount}, 바꾼 프레임 ${onFrameTable.get(82).culledSubtreeCount}`);
}
finally {
	await browser.close();
	server.close();
}
finish("subtreecullchrome");
