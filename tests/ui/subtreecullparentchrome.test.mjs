//==============================================================================
// 부모 좌표에서 먼저 거르기 크롬 시험. (NODE_PATH=$(npm root -g) node tests/ui/subtreecullparentchrome.test.mjs)
// - 그리기 순회가 자식에 변환을 걸기 전에 부모가 셈해 둔 자식 경계(TransformNode.readParentDrawBounds)를 부모 좌표의 보이는 사각형과 견주어 건너뛰는 길을 본다.
// - 왼쪽: 스크롤 목록 안 묶음 노드 하나에 이름 칸과 조절 칸 300 개가 바로 자식으로 납작하게 놓인 장면(광부 설정 창 꼴). 프레임마다 소수 픽셀만큼 스크롤한다.
//   조절 칸마다 그린 수를 세어, 하위 트리 거르기를 켠 길과 끈 길(노드마다 컴포넌트만 거름)이 프레임마다 같은 칸을 그리는지 본다. (스크롤로 들어오는 칸이 그 프레임에 바로 그려진다)
//   켠 길이 묶음 노드의 자식마다 변환을 걸지 않는지(프레임의 pushState 수), 보이는 자식 범위 밖 자식은 drawNode 도 부르지 않는지(이분 찾기, 프레임의 drawNode 수) 센다.
// - 오른쪽: 둥근 마스크 안에 가로세로 배율이 다른 노드, 그 안에 돌린 노드(기울임이 생긴다), 그 안의 스크롤 목록(자르기가 겹친다)에 칸 144 개를 마스크 가장자리에 걸치게 놓고
//   스크롤하며 돌림을 바꾼다. 켬과 끔, 거르기를 모두 끈 길(setCullingEnabled(false))의 찍은 화면 화소가 모두 같은지 본다. (넉넉하게 거르는지)
// - 화면 아래 밖에서 위로 날아오르는 파티클(수동 틱, 씨앗 고정)과 화면 아래 밖에서 올라오는 노드의 꼬리(TrailRenderer)가 화면 밖인 동안 켠 길이 그리지 않고,
//   들어오면 그려 화소가 같은지 본다. (프레임마다 경계를 다시 셈한다, 노드마다 컴포넌트만 거르는 길도 이 경계를 쓰므로 거르기를 모두 끈 길과 견준다)
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
const { Engine, EngineConfiguration, Scene, WorldNode, Component, Vector2, Color, Colors, Rect, Pivot, Paint, Mask, TextAlign, ViewScaleMode, UILabel, UIScrollView, ParticleSystem, TrailRenderer } = await import("/import.js");
const isSubtreeCullingEnabled = new URLSearchParams(location.search).get("subtree") === "1";
const isCullingEnabled = new URLSearchParams(location.search).get("culling") !== "0";
const CAPTURE_FRAME_LIST = [30, 55, 56, 75, 92];
const LAST_FRAME = 96;
const FLAT_ROW_COUNT = 150;
const GRID_SIZE = 12;
window.drawCountList = new Array(FLAT_ROW_COUNT).fill(0);
window.particleDrawCount = 0;
window.trailDrawCount = 0;
window.captureList = [];
window.frameList = [];

// 조절 칸마다 붙여 그린 수를 세는 컴포넌트. (내용 영역 안에만 그린다)
class DrawCounter extends Component {
	rowIndex = -1;
	isDrawnInsideContent() {
		return true;
	}
	draw(graphic) {
		window.drawCountList[this.rowIndex] += 1;
		graphic.setFillColor(Colors.white);
		graphic.drawRect(Rect.create(2, 2, 4, 4));
	}
}
// 그린 수를 세는 파티클과 꼬리. (그리는 사각형은 엔진 것 그대로)
class CountedParticleSystem extends ParticleSystem {
	draw(graphic) {
		window.particleDrawCount += 1;
		super.draw(graphic);
	}
}
class CountedTrailRenderer extends TrailRenderer {
	draw(graphic) {
		window.trailDrawCount += 1;
		super.draw(graphic);
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
function createScrollView(parentNode, position, size, contentSize, isHorizontal) {
	const scrollNode = createBoxNode(parentNode, position, size);
	const scrollView = scrollNode.addComponent(UIScrollView);
	scrollView.setBackgroundColor(Color.createFromHEX("#1d1814"));
	scrollView.setScrollContentSize(contentSize);
	scrollView.setHorizontal(isHorizontal);
	return scrollView;
}
let flatScrollView = null;
let gridScrollView = null;
let rotatedNode = null;
let particleSystem = null;
let trailNode = null;
let drawnFrameCount = 0;
class ParentCullScene extends Scene {
	initialize(engine) {
		super.initialize(engine);
		const root = this.getRoot();
		root.setContentSize(Vector2.create(640, 360));

		// 왼쪽: 묶음 노드 아래 바로 자식으로 납작하게 놓인 이름 칸과 조절 칸.
		flatScrollView = createScrollView(root, Vector2.create(20, 20), Vector2.create(280, 320), Vector2.create(280, FLAT_ROW_COUNT * 20), false);
		const groupNode = createBoxNode(flatScrollView.getContent(), Vector2.create(0, 0), Vector2.create(270, FLAT_ROW_COUNT * 20));
		for (let rowIndex = 0; rowIndex < FLAT_ROW_COUNT; ++rowIndex) {
			const nameNode = createBoxNode(groupNode, Vector2.create(6, rowIndex * 20), Vector2.create(140, 18));
			const nameLabel = nameNode.addComponent(UILabel);
			nameLabel.setText("이름 " + rowIndex);
			nameLabel.setFontSize(12);
			nameLabel.setTextAlign(TextAlign.left);
			nameLabel.setTextColor("#f1e9d8");
			const controlNode = createBoxNode(groupNode, Vector2.create(150, rowIndex * 20), Vector2.create(110, 18));
			controlNode.addComponent(Paint).setColor(rowIndex % 2 === 0 ? "#4a3c30" : "#5a4a3c");
			controlNode.addComponent(DrawCounter).rowIndex = rowIndex;
		}

		// 오른쪽: 둥근 마스크 > 가로세로 배율이 다른 노드 > 돌린 노드 > 스크롤 목록. (자르기가 겹치고 기울임이 생긴다)
		const maskNode = createBoxNode(root, Vector2.create(330, 20), Vector2.create(290, 320));
		maskNode.addComponent(Paint).setColor("#30445a");
		maskNode.addComponent(Mask).setRoundSize(16);
		const scaledNode = createBoxNode(maskNode, Vector2.create(145, 160), Vector2.create(0, 0));
		scaledNode.setLocalScale(Vector2.create(1.3, 0.8));
		rotatedNode = createBoxNode(scaledNode, Vector2.create(0, 0), Vector2.create(0, 0));
		rotatedNode.setLocalRotation(35);
		gridScrollView = createScrollView(rotatedNode, Vector2.create(-120, -120), Vector2.create(240, 240), Vector2.create(GRID_SIZE * 26, GRID_SIZE * 26), true);
		const gridGroupNode = createBoxNode(gridScrollView.getContent(), Vector2.create(0, 0), Vector2.create(GRID_SIZE * 26, GRID_SIZE * 26));
		for (let rowIndex = 0; rowIndex < GRID_SIZE; ++rowIndex) {
			for (let columnIndex = 0; columnIndex < GRID_SIZE; ++columnIndex) {
				const cellNode = createBoxNode(gridGroupNode, Vector2.create(columnIndex * 26 + 3, rowIndex * 26 + 3), Vector2.create(20, 20));
				const cellPaint = cellNode.addComponent(Paint);
				cellPaint.setColor((rowIndex + columnIndex) % 2 === 0 ? "#c89b3c" : "#3c8bc8");
				cellPaint.setRoundSize(4);
			}
		}

		// 화면 아래 밖(세로 360 아래)에서 위로 날아오르는 파티클. (수동 틱으로 프레임마다 1/60 초씩, 씨앗 고정)
		const particleNode = createBoxNode(root, Vector2.create(315, 420), Vector2.create(0, 0));
		particleSystem = particleNode.addComponent(CountedParticleSystem);
		particleSystem.setManualTick(true);
		particleSystem.setRandomSeed(7);
		particleSystem.setEmissionRate(30);
		particleSystem.setStartLifetime(10);
		particleSystem.setStartSpeed(0);
		particleSystem.setStartSize(8);
		particleSystem.setGravity(0, -300);
		particleSystem.setStartColor(Color.createFromHEX("#ffcc33"));
		particleSystem.play();
		// 화면 아래 밖에서 40 번 프레임부터 위로 올라오는 노드의 꼬리. (굵기와 색이 그대로라 점이 늙어도 같게 그린다)
		trailNode = createBoxNode(root, Vector2.create(325, 400), Vector2.create(0, 0));
		const trailRenderer = trailNode.addComponent(CountedTrailRenderer);
		trailRenderer.setTime(100);
		trailRenderer.setWidth(6, 6);
		trailRenderer.setColors(Color.createFromHEX("#33ffcc"), Color.createFromHEX("#33ffcc"));
	}
	applyFrameEvent(frameNumber) {
		particleSystem.simulate(1 / 60);
		if (frameNumber >= 40) {
			trailNode.setLocalPosition(Vector2.create(325, 400 - (frameNumber - 40) * 3));
		}
		// 41 ~ 96: 프레임마다 소수 픽셀만큼 스크롤. (부모 이동만 바뀐다, 왼쪽 목록은 거의 세 프레임마다 한 칸씩 들어온다)
		if (frameNumber > 40) {
			flatScrollView.setScrollOffset(Vector2.create(0, -(frameNumber - 40) * 7.37));
			gridScrollView.setScrollOffset(Vector2.create(-(frameNumber - 40) * 1.13, -(frameNumber - 40) * 1.41));
		}
		// 70: 돌림을 바꾼다. (자식들 경계는 그대로이고 보이는 사각형만 바뀐다)
		if (frameNumber === 70) {
			rotatedNode.setLocalRotation(-50);
		}
		// 85: 묶음 노드 아래 화면 밖 칸을 보이는 자리로 옮긴다. (부모가 다시 셈해 그 프레임부터 그린다)
		if (frameNumber === 85) {
			flatScrollView.getContent().getChildren()[0].getChildren()[2 * 140 + 1].setLocalPosition(Vector2.create(150, 25 * 20 + 9));
		}
	}
	draw(graphic) {
		drawnFrameCount += 1;
		const frameNumber = drawnFrameCount;
		graphic.setCullingEnabled(isCullingEnabled);
		graphic.setSubtreeCullingEnabled(isSubtreeCullingEnabled);
		graphic.setTextBakeScaleStep(0);
		if (window.frameList.length > 0) {
			window.frameList[window.frameList.length - 1].culledSubtreeCount = graphic.getLastFrameCulledSubtreeCount();
		}
		this.applyFrameEvent(frameNumber);
		if (CAPTURE_FRAME_LIST.includes(frameNumber)) {
			window.captureList.push(engine.requestFrameCapture(engine.getFrameNumber()));
		}
		// 이 프레임에 변환을 건 수를 센다.
		let pushStateCount = 0;
		const pushState = graphic.pushState;
		graphic.pushState = function () {
			pushStateCount += 1;
			return pushState.call(this);
		};
		let drawNodeCount = 0;
		const drawNode = graphic.drawNode;
		graphic.drawNode = function (node) {
			drawNodeCount += 1;
			return drawNode.call(this, node);
		};
		super.draw(graphic);
		delete graphic.pushState;
		delete graphic.drawNode;
		window.frameList.push({ frameNumber, culledSubtreeCount: -1, pushStateCount, drawNodeCount, drawCountList: window.drawCountList.slice(), particleDrawCount: window.particleDrawCount, trailDrawCount: window.trailDrawCount });
		if (frameNumber === LAST_FRAME) {
			window.isFinished = true;
		}
	}
}
const engineConfiguration = new EngineConfiguration();
engineConfiguration.canvasId = "mainCanvas";
engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
const engine = new Engine(engineConfiguration);
engine.getViewManager().setViewScaleMode(ViewScaleMode.stretchShort);
engine.run(new ParentCullScene());
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

try {
	const offResult = await renderScene("subtree=0");
	const onResult = await renderScene("subtree=1");
	const noneResult = await renderScene("subtree=0&culling=0");
	checkEqual(offResult.errorList.join("\n"), "", "거르기 끈 길 오류");
	checkEqual(onResult.errorList.join("\n"), "", "거르기 켠 길 오류");
	checkEqual(noneResult.errorList.join("\n"), "", "거르기를 모두 끈 길 오류");
	checkEqual(onResult.captureResultList.length, 5, "찍은 화면 수");
	const captureNameList = ["멈춤", "스크롤 55", "스크롤 56", "돌림 바꾼 뒤 스크롤", "화면 밖 칸을 옮겨 들인 뒤"];
	for (let captureIndex = 0; captureIndex < onResult.captureResultList.length; ++captureIndex) {
		const onCapture = onResult.captureResultList[captureIndex];
		const offCapture = offResult.captureResultList[captureIndex];
		const noneCapture = noneResult.captureResultList[captureIndex];
		checkEqual(onCapture.width, 1920, "화면 폭");
		let differentPixelCount = 0;
		let differentNonePixelCount = 0;
		let drawnPixelCount = 0;
		for (let index = 0; index < onCapture.pixels.length; ++index) {
			if (onCapture.pixels[index] !== offCapture.pixels[index]) {
				differentPixelCount += 1;
			}
			if (onCapture.pixels[index] !== noneCapture.pixels[index]) {
				differentNonePixelCount += 1;
			}
		}
		for (let index = 0; index < onCapture.pixels.length; index += 4) {
			if (onCapture.pixels[index] !== 0 || onCapture.pixels[index + 1] !== 0 || onCapture.pixels[index + 2] !== 0) {
				drawnPixelCount += 1;
			}
		}
		checkEqual(differentPixelCount, 0, `거르기 켬과 끔 화소 (${captureNameList[captureIndex]})`);
		checkEqual(differentNonePixelCount, 0, `거르기 켬과 모두 끔 화소 (${captureNameList[captureIndex]})`);
		check(drawnPixelCount >= 400000, `장면을 찍었다 (${captureNameList[captureIndex]}, 검정이 아닌 화소 ${drawnPixelCount})`);
	}

	// 조절 칸마다 그린 수가 켬과 끔에서 프레임마다 같다. (스크롤로 들어오는 칸이 그 프레임에 바로 그려지고, 화면 밖 칸을 옮겨 들이면 그 프레임부터 그려진다)
	const offFrameTable = new Map(offResult.frameList.map((frame) => [frame.frameNumber, frame]));
	let differentFrameText = "";
	let enteredRowCount = 0;
	for (const onFrame of onResult.frameList) {
		// (끝을 알린 뒤 페이지를 닫기 전에 더 그린 프레임은 길마다 수가 달라 보지 않는다)
		const offFrame = offFrameTable.get(onFrame.frameNumber);
		if (onFrame.frameNumber > 96 || offFrame === undefined) {
			continue;
		}
		if (onFrame.drawCountList.join(",") !== offFrame.drawCountList.join(",")) {
			differentFrameText = `${onFrame.frameNumber} 번 프레임`;
			break;
		}
	}
	checkEqual(differentFrameText, "", "켬과 끔이 프레임마다 같은 조절 칸을 그림");
	const onFrameTable = new Map(onResult.frameList.map((frame) => [frame.frameNumber, frame]));
	for (let rowIndex = 0; rowIndex < 150; ++rowIndex) {
		if (onFrameTable.get(40).drawCountList[rowIndex] === 0 && onFrameTable.get(84).drawCountList[rowIndex] > 0) {
			enteredRowCount += 1;
		}
	}
	check(enteredRowCount >= 15, `스크롤로 들어와 그려진 조절 칸 (${enteredRowCount})`);
	checkEqual(onFrameTable.get(85).drawCountList[140] - onFrameTable.get(84).drawCountList[140], 1, "옮겨 들인 140 번 칸은 그 프레임에 그려짐");

	// 켠 길은 묶음 노드의 화면 밖 자식에 변환을 걸지 않는다. (자식 300 개 가운데 보이는 것은 서른 남짓, 끈 길은 모두 건다)
	// (부모 좌표에서 먼저 거르지 않고 변환을 건 뒤에 거르면 켬과 끔의 수가 같다)
	const onPushStateCount = onFrameTable.get(30).pushStateCount;
	const offPushStateCount = offFrameTable.get(30).pushStateCount;
	check(offPushStateCount >= 300 + 144, `끈 길은 자식마다 변환을 검 (${offPushStateCount})`);
	check(offPushStateCount - onPushStateCount >= 250, `켠 길은 화면 밖 자식에 변환을 걸지 않음 (켬 ${onPushStateCount}, 끔 ${offPushStateCount})`);
	const onScrollPushStateCount = onFrameTable.get(60).pushStateCount;
	const offScrollPushStateCount = offFrameTable.get(60).pushStateCount;
	check(offScrollPushStateCount - onScrollPushStateCount >= 250, `스크롤 중에도 걸지 않음 (켬 ${onScrollPushStateCount}, 끔 ${offScrollPushStateCount})`);
	// 화면 밖 파티클과 꼬리는 켜면 그리지 않고(거르기를 모두 끄면 프레임마다 그린다), 들어오면 그린다.
	const noneFrameTable = new Map(noneResult.frameList.map((frame) => [frame.frameNumber, frame]));
	checkEqual(noneFrameTable.get(20).particleDrawCount, 20, "모두 끄면 화면 밖 파티클을 프레임마다 그림");
	checkEqual(onFrameTable.get(20).particleDrawCount, 0, "켜면 화면 밖 파티클을 그리지 않음");
	check(onFrameTable.get(60).particleDrawCount - onFrameTable.get(50).particleDrawCount === 10, `들어온 파티클은 그림 (${onFrameTable.get(60).particleDrawCount - onFrameTable.get(50).particleDrawCount})`);
	checkEqual(noneFrameTable.get(40).trailDrawCount, 40, "모두 끄면 화면 밖 꼬리를 프레임마다 그림");
	checkEqual(onFrameTable.get(40).trailDrawCount, 0, "켜면 화면 밖 꼬리를 그리지 않음");
	checkEqual(onFrameTable.get(70).trailDrawCount - onFrameTable.get(60).trailDrawCount, 10, "들어온 꼬리는 그림");
	console.log(`파티클을 처음 그린 프레임: 켬 ${onResult.frameList.find((frame) => frame.particleDrawCount > 0).frameNumber}, 꼬리: 켬 ${onResult.frameList.find((frame) => frame.trailDrawCount > 0).frameNumber}`);
	// 켠 길은 보이는 자식 범위 밖 자식에 drawNode 를 부르지 않는다. (끈 길은 모든 노드에 부른다)
	const onDrawNodeCount = onFrameTable.get(30).drawNodeCount;
	const offDrawNodeCount = offFrameTable.get(30).drawNodeCount;
	check(offDrawNodeCount - onDrawNodeCount >= 250, `켠 길은 범위 밖 자식에 drawNode 를 부르지 않음 (켬 ${onDrawNodeCount}, 끔 ${offDrawNodeCount})`);
	const onScrollDrawNodeCount = onFrameTable.get(60).drawNodeCount;
	check(offFrameTable.get(60).drawNodeCount - onScrollDrawNodeCount >= 250, `스크롤 중에도 부르지 않음 (켬 ${onScrollDrawNodeCount})`);
	console.log(`drawNode 수: 멈춤(30) 켬 ${onDrawNodeCount} 끔 ${offDrawNodeCount}, 스크롤(60) 켬 ${onScrollDrawNodeCount}`);
	console.log(`변환 건 수: 멈춤(30) 켬 ${onPushStateCount} 끔 ${offPushStateCount}, 스크롤(60) 켬 ${onScrollPushStateCount} 끔 ${offScrollPushStateCount}, 건너뛴 하위 트리 ${onFrameTable.get(30).culledSubtreeCount}`);
}
finally {
	await browser.close();
	server.close();
}
finish("subtreecullparentchrome");
