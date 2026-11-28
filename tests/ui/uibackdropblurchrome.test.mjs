//==============================================================================
// UIView 뒤 화면 흐림(setBackdropBlur) 크롬 시험. (NODE_PATH=$(npm root -g) node tests/ui/uibackdropblurchrome.test.mjs)
// - 흰 줄과 검은 줄이 번갈아 깔린 화면 위에 흐림 반지름 0 과 6 의 투명 뷰를 얹어 찍는다.
//   0 은 줄이 그대로, 6 은 뷰 자리 안만 줄이 흐려져 회색이 섞이고 뷰 밖은 그대로인지 본다.
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
const { Engine, EngineConfiguration, Scene, WorldNode, Vector2, Color, Pivot, ViewScaleMode, UIView } = await import("/import.js");
const blurRadius = Number(new URLSearchParams(location.search).get("blur"));
function createBoxNode(parentNode, position, size) {
	const node = new WorldNode();
	parentNode.addChild(node);
	node.setPivot(Pivot.topLeft);
	node.setLocalPosition(position);
	node.setContentSize(size);
	return node;
}
let drawnFrameCount = 0;
class BlurScene extends Scene {
	initialize(engine) {
		super.initialize(engine);
		const root = this.getRoot();
		root.setContentSize(Vector2.create(640, 360));
		for (let stripeIndex = 0; stripeIndex < 64; ++stripeIndex) {
			const stripeNode = createBoxNode(root, Vector2.create(stripeIndex * 10, 0), Vector2.create(10, 360));
			const stripeView = stripeNode.addComponent(UIView);
			stripeView.setBackgroundColor(stripeIndex % 2 === 0 ? Color.createFromHEX("#ffffff") : Color.createFromHEX("#000000"));
		}
		const panelNode = createBoxNode(root, Vector2.create(200, 100), Vector2.create(240, 160));
		const panelView = panelNode.addComponent(UIView);
		panelView.setBackdropBlur(blurRadius);
	}
	draw(graphic) {
		drawnFrameCount += 1;
		if (drawnFrameCount === 10) {
			window.capturePromise = engine.requestFrameCapture(engine.getFrameNumber());
		}
		super.draw(graphic);
		if (drawnFrameCount === 14) {
			window.isFinished = true;
		}
	}
}
const engineConfiguration = new EngineConfiguration();
engineConfiguration.canvasId = "mainCanvas";
engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
const engine = new Engine(engineConfiguration);
engine.getViewManager().setViewScaleMode(ViewScaleMode.stretchShort);
engine.run(new BlurScene());
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


try {
	const readRow = async (blurValue) => {
		const page = await browser.newPage();
		await page.setViewport({ width: 640, height: 360, deviceScaleFactor: 1 });
		const errorList = [];
		page.on("pageerror", (error) => errorList.push(error.message));
		page.on("console", (message) => {
			if (message.type() === "error" || message.type() === "warning") {
				errorList.push(message.text());
			}
		});
		await page.goto("http://127.0.0.1:" + port + "/?blur=" + blurValue);
		await page.waitForFunction(() => window.isFinished === true, { timeout: 60000 });
		const rowResult = await page.evaluate(async () => {
			const image = new Image();
			image.src = await window.capturePromise;
			await image.decode();
			const canvas = new OffscreenCanvas(image.width, image.height);
			const context = canvas.getContext("2d");
			context.drawImage(image, 0, 0);
			const scale = image.width / 640;
			const readRowValueList = (y, fromX, toX) => {
				const valueList = [];
				const data = context.getImageData(Math.round(fromX * scale), Math.round(y * scale), Math.round((toX - fromX) * scale), 1).data;
				for (let offset = 0; offset < data.length; offset += 4) {
					valueList.push(data[offset]);
				}
				return valueList;
			};
			return { inside: readRowValueList(180, 230, 410), outside: readRowValueList(180, 20, 180), width: image.width };
		});
		await page.close();
		return { errorList, ...rowResult };
	};
	const sharpResult = await readRow(0);
	const blurResult = await readRow(6);
	checkEqual(sharpResult.errorList.join("\n"), "", "흐림 0 오류");
	checkEqual(blurResult.errorList.join("\n"), "", "흐림 6 오류");
	const countMiddle = (valueList) => valueList.filter((value) => value > 40 && value < 215).length;
	check(countMiddle(sharpResult.inside) < sharpResult.inside.length * 0.1, `흐림 0 은 줄이 또렷함 (중간값 ${countMiddle(sharpResult.inside)}/${sharpResult.inside.length})`);
	check(countMiddle(blurResult.inside) > blurResult.inside.length * 0.5, `흐림 6 은 뷰 안 줄이 흐려짐 (중간값 ${countMiddle(blurResult.inside)}/${blurResult.inside.length})`);
	checkEqual(JSON.stringify(blurResult.outside), JSON.stringify(sharpResult.outside), "뷰 밖은 그대로");
	console.log(`뷰 안 중간값 비율 ${countMiddle(blurResult.inside)}/${blurResult.inside.length}`);
}
finally {
	await browser.close();
	server.close();
}
finish("uibackdropblurchrome");
