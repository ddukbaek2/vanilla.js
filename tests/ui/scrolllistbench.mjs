//==============================================================================
// 스크롤 목록 그리기 재기. (NODE_PATH=$(npm root -g) node tests/ui/scrolllistbench.mjs [반복 수])
// - 설정 창 같은 엔진만의 장면(UIScrollView 안 줄 120 개, 줄마다 둥근 바탕, 그림 칸, 글 둘, 단추 셋, 한 번에 10 줄쯤 보임)을
//   헤드리스 크롬에서 그리며 장면 트리 그리기(super.draw)의 CPU 시간을 프레임마다 재어 가운데 값을 찍는다.
// - 세 길을 견준다. 끔: 하위 트리 거르기를 끔(노드마다 컴포넌트 그리기만 거름), 켬: 엔진 하위 트리 거르기(기본),
//   게임 거르기: 하위 트리 거르기를 끄고 게임이 보이지 않는 줄을 꺼 버림(광부 키우기의 ScrollCulling 과 같은 일).
// - 멈춘 구간(프레임 60 ~ 179)과 스크롤 구간(180 ~ 299)을 따로 잰다. 길마다 반복 수(기본 5)만큼 새 페이지로 재어 가운데 값의 가운데 값을 찍는다.
// - 장면 둘을 잰다. 엔진: 위 장면. 광부 설정 창: 광부 키우기 설정 창(src/ui/settingswindow.js, widgets.js)이 줄마다 붙이는 엔진 컴포넌트를 그대로 단 장면.
//   (기준 해상도 1280x720, 줄 높이 56 과 사이 12, 보이는 칸 높이 572, 이름 칸과 조절 칸이 묶음 노드 아래 바로 자식으로 납작하게 놓임,
//    슬라이더 줄(UISlider 손잡이 반지름 13, 켬 칸 단추와 체크 그림, 누름 자리), 고르기 줄(글 단추 셋과 누름 자리), 언어 단추, 계정 줄, 판 줄, 무리 머리글과 줄을 120 줄만큼 되풀이,
//    글 단추는 칠, UIButton, ButtonMotion, 글 노드의 UILabel. 게임만의 컴포넌트(GlossSkin, GlossSlider, HitArea)는 넣지 않는다. 게임 거르기는 ScrollCulling 처럼 보이는 칸과 위아래 한 줄 밖의 바로 자식을 끈다)
// - 부하와 상관없는 근거로 59 번(멈춤)과 250 번(스크롤) 프레임에 변환을 건 수(Graphic.pushState 수)와 그리기 순회 단계별 호출 수를 센다.
// - 시험이 아니다. (tests/run.mjs 가 돌리지 않는다, 값은 기계마다 다르다) 크롬 경로는 CHROME_PATH 로 바꿀 수 있다.
//==============================================================================
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const repositoryPath = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");
const contentTypeTable = { ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".html": "text/html" };
const repeatCount = parseRepeatCount(process.argv[2]);

// 반복 수 읽기. (없거나 잘못되면 5)
function parseRepeatCount(text) {
	const value = Number.parseInt(text ?? "", 10);
	return Number.isFinite(value) && value > 0 ? value : 5;
}

const PAGE_SOURCE = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{position:absolute;left:0;top:0;width:100%;height:100%}</style><canvas id="mainCanvas"></canvas>
<script type="module">
const { Engine, EngineConfiguration, Scene, WorldNode, Vector2, Color, Pivot, Paint, Outline, Sprite, TextAlign, ViewScaleMode, UIView, UILabel, UIButton, UIScrollView, UISlider, ButtonMotion, TransformNode } = await import("/import.js");
const mode = new URLSearchParams(location.search).get("mode");
const sceneName = new URLSearchParams(location.search).get("scene");
const ROW_COUNT = 120;
const ROW_HEIGHT = 34;
const VIEWPORT_HEIGHT = 340;
const STATIC_FIRST_FRAME = 60;
const SCROLL_FIRST_FRAME = 180;
const LAST_FRAME = 299;
window.frameList = [];
// 센 프레임(멈춤 59, 스크롤 250)에만 그리기 순회가 변환을 건 수(pushState 수, 노드마다 하나 + 자르기와 층)와 단계별 호출 수를 센다. (부하와 상관없는 근거, 59 는 재는 구간 밖이다)
// - 단계: drawNode(노드 방문), drawComponent(컴포넌트 그리기), isLocalRectVisible(변환 뒤 하위 트리 견주기와 컴포넌트 거르기의 화면 견주기),
//   readParentDrawBounds(부모 좌표 먼저 거르기), readSubtreeDrawBounds(하위 트리 경계 읽기).
const PUSH_STATE_COUNT_FRAME_LIST = [59, 250];
const STAGE_NAME_LIST = ["pushState", "drawNode", "drawComponent", "isLocalRectVisible", "readParentDrawBounds", "readSubtreeDrawBounds"];
const transformNodePrototype = TransformNode.prototype;
function wrapCountedFunction(owner, functionName, counter) {
	const originalFunction = owner[functionName];
	if (typeof originalFunction !== "function") {
		return;
	}
	owner[functionName] = function (...argumentList) {
		counter[functionName] += 1;
		return originalFunction.apply(this, argumentList);
	};
	counter.restoreList.push(() => {
		if (owner === transformNodePrototype) {
			owner[functionName] = originalFunction;
		}
		else {
			delete owner[functionName];
		}
	});
}
function beginStageCount(graphic, frameNumber) {
	if (!PUSH_STATE_COUNT_FRAME_LIST.includes(frameNumber)) {
		return null;
	}
	const counter = { restoreList: [] };
	for (const stageName of STAGE_NAME_LIST) {
		counter[stageName] = 0;
	}
	for (const functionName of ["pushState", "drawNode", "drawComponent", "isLocalRectVisible"]) {
		wrapCountedFunction(graphic, functionName, counter);
	}
	for (const functionName of ["readParentDrawBounds", "readSubtreeDrawBounds"]) {
		wrapCountedFunction(transformNodePrototype, functionName, counter);
	}
	return counter;
}
function endStageCount(graphic, counter) {
	if (counter === null) {
		return null;
	}
	for (const restore of counter.restoreList) {
		restore();
	}
	delete counter.restoreList;
	return counter;
}
function createBoxNode(parentNode, x, y, width, height) {
	const node = new WorldNode();
	parentNode.addChild(node);
	node.setPivot(Pivot.topLeft);
	node.setLocalPosition(Vector2.create(x, y));
	node.setContentSize(Vector2.create(width, height));
	return node;
}
const rowNodeList = [];
let scrollView = null;
let drawnFrameCount = 0;
class SettingsScene extends Scene {
	initialize(engine) {
		super.initialize(engine);
		const root = this.getRoot();
		root.setContentSize(Vector2.create(640, 360));
		const scrollNode = createBoxNode(root, 20, 10, 600, VIEWPORT_HEIGHT);
		scrollView = scrollNode.addComponent(UIScrollView);
		scrollView.setBackgroundColor(Color.createFromHEX("#1d1814"));
		scrollView.setScrollContentSize(Vector2.create(600, ROW_COUNT * ROW_HEIGHT));
		scrollView.setHorizontal(false);
		for (let rowIndex = 0; rowIndex < ROW_COUNT; ++rowIndex) {
			const rowNode = createBoxNode(scrollView.getContent(), 6, rowIndex * ROW_HEIGHT, 580, 30);
			const rowPaint = rowNode.addComponent(Paint);
			rowPaint.setColor(rowIndex % 2 === 0 ? "#4a3c30" : "#5a4a3c");
			rowPaint.setRoundSize(7);
			const iconNode = createBoxNode(rowNode, 4, 3, 24, 24);
			const iconPaint = iconNode.addComponent(Paint);
			iconPaint.setColor("#c89b3c");
			iconPaint.setRoundSize(5);
			iconNode.addComponent(Outline);
			const titleNode = createBoxNode(rowNode, 36, 0, 180, 30);
			const titleLabel = titleNode.addComponent(UILabel);
			titleLabel.setText("설정 항목 " + rowIndex);
			titleLabel.setFontSize(14);
			titleLabel.setTextAlign(TextAlign.left);
			titleLabel.setTextColor("#f1e9d8");
			const valueNode = createBoxNode(rowNode, 220, 0, 90, 30);
			const valueLabel = valueNode.addComponent(UILabel);
			valueLabel.setText(String(rowIndex * 7 % 100) + "%");
			valueLabel.setFontSize(13);
			valueLabel.setTextColor("#d8c8a8");
			for (let buttonIndex = 0; buttonIndex < 3; ++buttonIndex) {
				const buttonNode = createBoxNode(rowNode, 320 + buttonIndex * 86, 3, 80, 24);
				buttonNode.addComponent(UIView).setBackgroundColor(Color.createFromHEX(buttonIndex === 0 ? "#2f7d4f" : "#7d2f3f"));
				const buttonLabel = buttonNode.addComponent(UILabel);
				buttonLabel.setText(["켜기", "끄기", "기본"][buttonIndex]);
				buttonLabel.setFontSize(13);
				buttonLabel.setTextColor("#ffffff");
				buttonNode.addComponent(UIButton);
			}
			rowNodeList.push(rowNode);
		}
	}
	// 게임 거르기: 보이는 칸 밖의 줄을 꺼 버린다. (광부 키우기의 ScrollCulling 과 같은 일)
	applyGameScrollCulling() {
		const scrollOffsetY = -scrollView.getScrollOffset().y;
		for (let rowIndex = 0; rowIndex < rowNodeList.length; ++rowIndex) {
			const rowTop = rowIndex * ROW_HEIGHT - scrollOffsetY;
			const isInside = rowTop + ROW_HEIGHT >= 0 && rowTop <= VIEWPORT_HEIGHT;
			if (rowNodeList[rowIndex].isActive() !== isInside) {
				rowNodeList[rowIndex].setActive(isInside);
			}
		}
	}
	draw(graphic) {
		drawnFrameCount += 1;
		const frameNumber = drawnFrameCount;
		// 하위 트리 거르기가 없는 옛 판에서도 돌게 있을 때만 부른다. (옛 판은 끔과 같다)
		if (typeof graphic.setSubtreeCullingEnabled === "function") {
			graphic.setSubtreeCullingEnabled(mode === "on");
		}
		if (frameNumber >= SCROLL_FIRST_FRAME) {
			scrollView.setScrollOffset(Vector2.create(0, -(frameNumber - SCROLL_FIRST_FRAME) * 2.37));
		}
		if (mode === "game") {
			this.applyGameScrollCulling();
		}
		const stageCounter = beginStageCount(graphic, frameNumber);
		const startTime = performance.now();
		super.draw(graphic);
		const drawTime = performance.now() - startTime;
		const stageCount = endStageCount(graphic, stageCounter);
		window.frameList.push({ frameNumber, drawTime, stageCount, drawCallCount: graphic.getLastFrameDrawCallCount(), culledSubtreeCount: (typeof graphic.getLastFrameCulledSubtreeCount === "function") ? graphic.getLastFrameCulledSubtreeCount() : 0 });
		if (frameNumber === LAST_FRAME) {
			window.isFinished = true;
		}
	}
}
// 광부 키우기 설정 창 꼴. (settingswindow.js, widgets.js 의 엔진 컴포넌트만, 기준 해상도 1280x720)
const RIMMINER_ROW_HEIGHT = 56;
const RIMMINER_ROW_GAP = 12;
const RIMMINER_VIEWPORT_HEIGHT = (RIMMINER_ROW_HEIGHT + RIMMINER_ROW_GAP) * 8 + RIMMINER_ROW_HEIGHT * 0.5;
const RIMMINER_KIND_LIST = ["slider", "slider", "segment", "language", "account", "version", "group"];
let rowsNode = null;
function createLabelNode(parentNode, x, y, width, height, text, fontSize, textAlign, isBold) {
	const node = createBoxNode(parentNode, x, y, width, height);
	const label = node.addComponent(UILabel);
	label.setFontSize(fontSize);
	label.setTextColor("#f1e9d8");
	label.setTextAlign(textAlign);
	label.setTextBaseline("middle");
	label.setBold(isBold);
	label.setText(text);
	return node;
}
function createTextButtonNode(parentNode, x, y, width, height, text) {
	const node = createBoxNode(parentNode, x, y, width, height);
	const paint = node.addComponent(Paint);
	paint.setColor("#3a3f4a");
	paint.setRoundSize(12);
	const button = node.addComponent(UIButton);
	button.setPressedTintColor(Color.createFromHEX("#c0c0c0"));
	node.addComponent(ButtonMotion);
	createLabelNode(node, 0, 0, width, height, text, 16, TextAlign.center, true);
	// 누름 자리. (단추 뒤 형제, attachHitArea)
	const hitNode = createBoxNode(parentNode, x - 4, y - 4, width + 8, height + 8);
	hitNode.addComponent(UIButton);
	return node;
}
class RimminerSettingsScene extends Scene {
	initialize(engine) {
		super.initialize(engine);
		const root = this.getRoot();
		root.setContentSize(Vector2.create(1280, 720));
		const scrollNode = createBoxNode(root, 340, 74, 600, RIMMINER_VIEWPORT_HEIGHT);
		scrollView = scrollNode.addComponent(UIScrollView);
		scrollView.setBackgroundColor(Color.createFromHEX("#1d1814"));
		scrollView.setHorizontal(false);
		rowsNode = createBoxNode(scrollView.getContent(), 0, 0, 600, 1);
		let rowTop = 0;
		for (let rowIndex = 0; rowIndex < ROW_COUNT; ++rowIndex) {
			const kind = RIMMINER_KIND_LIST[rowIndex % RIMMINER_KIND_LIST.length];
			if (kind === "group") {
				createLabelNode(rowsNode, 16, rowTop, 568, 36.5, "무리 " + rowIndex, 15, TextAlign.left, true);
				const lineNode = createBoxNode(rowsNode, 16, rowTop + 36.5, 568, 1.5);
				lineNode.addComponent(Paint).setColor("#5a4a3c");
				createBoxNode(rowsNode, 16, rowTop, 1, 38);
				rowTop += 38 + RIMMINER_ROW_GAP;
				continue;
			}
			createLabelNode(rowsNode, 16, rowTop, 110, RIMMINER_ROW_HEIGHT, "설정 " + rowIndex, 19, TextAlign.left, false);
			const controlNode = createBoxNode(rowsNode, 138, rowTop, 446, RIMMINER_ROW_HEIGHT);
			if (kind === "slider") {
				const sliderNode = createBoxNode(controlNode, 0, (RIMMINER_ROW_HEIGHT - 36) * 0.5, 386, 36);
				const slider = sliderNode.addComponent(UISlider);
				slider.setRange(0, 1);
				slider.setValue((rowIndex % 9) / 8);
				slider.setTrackColor(Color.createFromHEX("#3a3f4a"));
				slider.setFillColor(Color.createFromHEX("#e0a040"));
				slider.setThumbColor(Color.createFromHEX("#f1e9d8"));
				slider.setThumbRadius(13);
				slider.setTrackThickness(8);
				slider.setCornerRadius(4);
				const checkNode = createTextButtonNode(controlNode, 406, 8, 40, 40, "");
				const iconNode = createBoxNode(checkNode, 6, 6, 28, 28);
				iconNode.addComponent(Sprite).setColor(Color.createFromHEX("#1d1814"));
			}
			else if (kind === "segment") {
				for (let segmentIndex = 0; segmentIndex < 3; ++segmentIndex) {
					createTextButtonNode(controlNode, segmentIndex * 150, 6, 146, 44, ["30", "60", "120"][segmentIndex]);
				}
			}
			else if (kind === "language") {
				createTextButtonNode(controlNode, 0, 6, 446, 44, "한국어");
			}
			else if (kind === "account") {
				createLabelNode(controlNode, 0, 0, 360, RIMMINER_ROW_HEIGHT, "뚝백이", 19, TextAlign.left, false);
				createTextButtonNode(controlNode, 370, 6, 76, 44, "로그인");
			}
			else {
				createLabelNode(controlNode, 0, 0, 446, RIMMINER_ROW_HEIGHT, "1.2.0 (" + rowIndex + ")", 19, TextAlign.left, false);
			}
			rowTop += RIMMINER_ROW_HEIGHT + RIMMINER_ROW_GAP;
		}
		rowsNode.setContentSize(Vector2.create(600, rowTop));
		scrollView.setScrollContentSize(Vector2.create(600, rowTop));
	}
	// 게임 거르기: 보이는 칸과 위아래 한 줄 밖의 바로 자식을 꺼 버린다. (광부 키우기의 ScrollCulling 과 같은 일)
	applyGameScrollCulling() {
		const margin = RIMMINER_ROW_HEIGHT + RIMMINER_ROW_GAP;
		const visibleTop = -scrollView.getScrollOffset().y - margin;
		const visibleBottom = visibleTop + RIMMINER_VIEWPORT_HEIGHT + margin * 2;
		for (const childNode of rowsNode.getChildren()) {
			const childTop = childNode.getLocalPosition().y;
			const childBottom = childTop + childNode.getContentSize().y;
			const isInside = childBottom >= visibleTop && childTop <= visibleBottom;
			if (childNode.isActive() !== isInside) {
				childNode.setActive(isInside);
			}
		}
	}
	draw(graphic) {
		drawnFrameCount += 1;
		const frameNumber = drawnFrameCount;
		if (typeof graphic.setSubtreeCullingEnabled === "function") {
			graphic.setSubtreeCullingEnabled(mode === "on");
		}
		if (frameNumber >= SCROLL_FIRST_FRAME) {
			scrollView.setScrollOffset(Vector2.create(0, -(frameNumber - SCROLL_FIRST_FRAME) * 4.37));
		}
		if (mode === "game") {
			this.applyGameScrollCulling();
		}
		const stageCounter = beginStageCount(graphic, frameNumber);
		const startTime = performance.now();
		super.draw(graphic);
		const drawTime = performance.now() - startTime;
		const stageCount = endStageCount(graphic, stageCounter);
		window.frameList.push({ frameNumber, drawTime, stageCount, drawCallCount: graphic.getLastFrameDrawCallCount(), culledSubtreeCount: (typeof graphic.getLastFrameCulledSubtreeCount === "function") ? graphic.getLastFrameCulledSubtreeCount() : 0 });
		if (frameNumber === LAST_FRAME) {
			window.isFinished = true;
		}
	}
}
const isRimminerScene = sceneName === "rimminer";
const engineConfiguration = new EngineConfiguration();
engineConfiguration.canvasId = "mainCanvas";
engineConfiguration.referenceResolutionSize = isRimminerScene ? Vector2.create(1280, 720) : Vector2.create(640, 360);
const engine = new Engine(engineConfiguration);
engine.getViewManager().setViewScaleMode(ViewScaleMode.stretchShort);
engine.run(isRimminerScene ? new RimminerSettingsScene() : new SettingsScene());
</script>`;

// 페이지를 교차 출처 격리로 내어 performance.now 가 0.1 ms 로 뭉개지지 않게 한다. (격리하지 않으면 크롬이 시각을 거칠게 준다)
const isolationHeaderTable = { "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp" };
const server = http.createServer((request, response) => {
	for (const [headerName, headerValue] of Object.entries(isolationHeaderTable)) {
		response.setHeader(headerName, headerValue);
	}
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
if (executablePath === undefined) {
	console.log("크롬을 찾지 못함 (CHROME_PATH)");
	process.exit(1);
}
const browser = await puppeteer.launch({ executablePath, headless: true });

// 값 목록의 가운데 값.
function readMedian(valueList) {
	const sortedList = valueList.slice().sort((left, right) => left - right);
	return sortedList[Math.floor(sortedList.length / 2)];
}

// 한 길을 한 번 재기. (멈춤, 스크롤 구간의 가운데 값과 드로 콜, 건너뛴 하위 트리 수)
async function measureOnce(mode, sceneName) {
	const page = await browser.newPage();
	await page.setViewport({ width: 640 * 2, height: 360 * 2, deviceScaleFactor: 1.5 });
	const errorList = [];
	page.on("pageerror", (error) => errorList.push(error.message));
	await page.goto("http://127.0.0.1:" + port + "/?mode=" + mode + "&scene=" + sceneName);
	await page.waitForFunction(() => window.isFinished === true, { timeout: 120000 });
	const isCrossOriginIsolated = await page.evaluate(() => window.crossOriginIsolated === true);
	if (!isCrossOriginIsolated) {
		errorList.push("교차 출처 격리가 되지 않아 시각이 거칠다");
	}
	const frameList = await page.evaluate(() => window.frameList);
	await page.close();
	if (errorList.length > 0) {
		throw new Error(mode + " 오류: " + errorList.join("\n"));
	}
	const staticList = frameList.filter((frame) => frame.frameNumber >= 60 && frame.frameNumber < 180);
	const scrollList = frameList.filter((frame) => frame.frameNumber >= 180);
	return {
		staticTime: readMedian(staticList.map((frame) => frame.drawTime)),
		scrollTime: readMedian(scrollList.map((frame) => frame.drawTime)),
		drawCallCount: readMedian(staticList.map((frame) => frame.drawCallCount)),
		culledSubtreeCount: readMedian(staticList.map((frame) => frame.culledSubtreeCount)),
		staticStageCount: frameList.find((frame) => frame.frameNumber === 59).stageCount,
		scrollStageCount: frameList.find((frame) => frame.frameNumber === 250).stageCount,
	};
}

// 단계별 호출 수 글. (센 프레임 하나)
function formatStageCount(stageCount) {
	return ["drawNode", "drawComponent", "isLocalRectVisible", "readParentDrawBounds", "readSubtreeDrawBounds"].map((stageName) => stageName + " " + stageCount[stageName]).join(", ");
}

try {
	const modeList = ["off", "on", "game"];
	const modeNameTable = { off: "끔", on: "켬", game: "게임 거르기" };
	const sceneNameTable = { engine: "엔진 장면", rimminer: "광부 설정 창 꼴" };
	for (const sceneName of ["engine", "rimminer"]) {
		const resultTable = { off: [], on: [], game: [] };
		for (let repeatIndex = 0; repeatIndex < repeatCount; ++repeatIndex) {
			for (const mode of modeList) {
				resultTable[mode].push(await measureOnce(mode, sceneName));
			}
		}
		console.log(`${sceneNameTable[sceneName]} 그리기 가운데 값 (반복 ${repeatCount}, ms)`);
		for (const mode of modeList) {
			const resultList = resultTable[mode];
			const staticTime = readMedian(resultList.map((result) => result.staticTime));
			const scrollTime = readMedian(resultList.map((result) => result.scrollTime));
			const drawCallCount = readMedian(resultList.map((result) => result.drawCallCount));
			const culledSubtreeCount = readMedian(resultList.map((result) => result.culledSubtreeCount));
			const staticStageCount = resultList[0].staticStageCount;
			const scrollStageCount = resultList[0].scrollStageCount;
			console.log(`${modeNameTable[mode]}: 멈춤 ${staticTime.toFixed(3)}, 스크롤 ${scrollTime.toFixed(3)}, 드로 콜 ${drawCallCount}, 건너뛴 하위 트리 ${culledSubtreeCount}, 변환 건 수 멈춤 ${staticStageCount.pushState} 스크롤 ${scrollStageCount.pushState}`);
			console.log(`  단계별 호출 수 멈춤: ${formatStageCount(staticStageCount)}`);
			console.log(`  단계별 호출 수 스크롤: ${formatStageCount(scrollStageCount)}`);
		}
	}
}
finally {
	await browser.close();
	server.close();
}
