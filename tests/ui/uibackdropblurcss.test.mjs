//==============================================================================
// UIView 뒤 화면 흐림(setBackdropBlur, setBackdropCornerRadius)과 크롬 CSS backdrop-filter: blur(Npx) 의 화소 비교 시험.
// (NODE_PATH=$(npm root -g) node tests/ui/uibackdropblurcss.test.mjs)
// - 같은 장면(줄무늬, 색 사각형, 비스듬한 줄)을 엔진 흐림과 CSS 흐림(border-radius 포함)으로 찍어 뷰 자리 안 화소를 견준다.
// - UIBACKDROPBLURCSS_SHOTS=폴더 를 주면 엔진과 CSS 그림, 차이 그림을 그 폴더에 적는다.
// - 러스트 예제 uibackdropblur 와 같은 장면이다. (UIBACKDROPBLURCSS_DUMP=경로 로 엔진 그림 화소를 적는다)
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

const PAGE_SOURCE = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{position:absolute;left:0;top:0;width:100%;height:100%}#cssPanel{position:absolute;left:200px;top:100px;width:240px;height:160px}</style><canvas id="mainCanvas"></canvas><div id="cssPanel"></div>
<script type="module">
const { Engine, EngineConfiguration, Scene, WorldNode, Vector2, Color, Pivot, ViewScaleMode, UIView } = await import("/import.js");
const query = new URLSearchParams(location.search);
const blurRadius = Number(query.get("blur"));
const cornerRadius = Number(query.get("radius"));
const isCss = query.get("css") === "1";
if (isCss) {
	document.getElementById("cssPanel").style.cssText += ";backdrop-filter:blur(" + blurRadius + "px);border-radius:" + cornerRadius + "px";
}
function createBoxNode(parentNode, position, size) {
	const node = new WorldNode();
	parentNode.addChild(node);
	node.setPivot(Pivot.topLeft);
	node.setLocalPosition(position);
	node.setContentSize(size);
	return node;
}
function addBox(root, x, y, width, height, hex) {
	const view = createBoxNode(root, Vector2.create(x, y), Vector2.create(width, height)).addComponent(UIView);
	view.setBackgroundColor(Color.createFromHEX(hex));
}
let drawnFrameCount = 0;
class BlurScene extends Scene {
	initialize(engine) {
		super.initialize(engine);
		const root = this.getRoot();
		root.setContentSize(Vector2.create(640, 360));
		for (let stripeIndex = 0; stripeIndex < 64; ++stripeIndex) {
			addBox(root, stripeIndex * 10, 0, 10, 360, stripeIndex % 2 === 0 ? "#ffffff" : "#000000");
		}
		addBox(root, 150, 60, 120, 80, "#e03030");
		addBox(root, 330, 200, 160, 90, "#2060e0");
		addBox(root, 260, 140, 100, 100, "#30c050");
		for (let lineIndex = 0; lineIndex < 12; ++lineIndex) {
			addBox(root, 205 + lineIndex * 18, 105 + lineIndex * 12, 6, 6, "#ffd000");
		}
		if (!isCss) {
			const panelNode = createBoxNode(root, Vector2.create(200, 100), Vector2.create(240, 160));
			const panelView = panelNode.addComponent(UIView);
			panelView.setBackdropBlur(blurRadius);
			panelView.setBackdropCornerRadius(cornerRadius);
		}
	}
	draw(graphic) {
		drawnFrameCount += 1;
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



const shotFolder = process.env.UIBACKDROPBLURCSS_SHOTS;
if (shotFolder) {
	fs.mkdirSync(shotFolder, { recursive: true });
}
try {
	const shoot = async (blurValue, radiusValue, isCss) => {
		const page = await browser.newPage();
		await page.setViewport({ width: 640, height: 360, deviceScaleFactor: 1 });
		const errorList = [];
		page.on("pageerror", (error) => errorList.push(error.message));
		page.on("console", (message) => {
			if (message.type() === "error" || message.type() === "warning") {
				errorList.push(message.text());
			}
		});
		await page.goto("http://127.0.0.1:" + port + "/?blur=" + blurValue + "&radius=" + radiusValue + "&css=" + (isCss ? 1 : 0));
		await page.waitForFunction(() => window.isFinished === true, { timeout: 60000 });
		await new Promise((resolve) => setTimeout(resolve, 300));
		const buffer = Buffer.from(await page.screenshot({ type: "png" }));
		const pixelList = await page.evaluate(async (base64) => {
			const image = new Image();
			image.src = "data:image/png;base64," + base64;
			await image.decode();
			const canvas = new OffscreenCanvas(image.width, image.height);
			const context = canvas.getContext("2d");
			context.drawImage(image, 0, 0);
			return Array.from(context.getImageData(0, 0, image.width, image.height).data);
		}, buffer.toString("base64"));
		await page.close();
		return { errorList, buffer, pixelList };
	};
	const caseList = [[3, 0], [8, 0], [20, 0], [40, 0], [8, 24]];
	for (const [blurValue, radiusValue] of caseList) {
		const engineResult = await shoot(blurValue, radiusValue, false);
		const cssResult = await shoot(blurValue, radiusValue, true);
		checkEqual(engineResult.errorList.join("\n"), "", `엔진 오류 blur ${blurValue}`);
		let sumDifference = 0;
		let maxDifference = 0;
		let countOver8 = 0;
		let count = 0;
		const width = 640;
		for (let y = 104; y < 256; ++y) {
			for (let x = 204; x < 436; ++x) {
				for (let channel = 0; channel < 3; ++channel) {
					const index = (y * width + x) * 4 + channel;
					const difference = Math.abs(engineResult.pixelList[index] - cssResult.pixelList[index]);
					sumDifference += difference;
					maxDifference = Math.max(maxDifference, difference);
					countOver8 += difference > 8 ? 1 : 0;
					count += 1;
				}
			}
		}
		// 뷰 밖(CSS 와 같이 그대로)도 견준다.
		let outsideDifference = 0;
		for (let y = 0; y < 360; y += 3) {
			for (let x = 0; x < 190; ++x) {
				outsideDifference = Math.max(outsideDifference, Math.abs(engineResult.pixelList[(y * width + x) * 4] - cssResult.pixelList[(y * width + x) * 4]));
			}
		}
		// 모서리 바깥 귀퉁이 화소(둥글면 흐리지 않은 줄 그대로).
		const meanDifference = sumDifference / count;
		console.log(`blur ${blurValue} radius ${radiusValue}: 평균 차 ${meanDifference.toFixed(2)} 최대 ${maxDifference} 8 넘는 비율 ${(countOver8 / count * 100).toFixed(2)}% 뷰 밖 최대 ${outsideDifference}`);
		// 표준편차 30 넘는 큰 흐림은 크롬(Skia)이 줄여서 흐리는 근사를 써 조금 더 벌어진다.
		const meanLimit = blurValue > 30 ? 6 : 3;
		check(meanDifference < meanLimit, `blur ${blurValue} radius ${radiusValue} 평균 차 ${meanDifference.toFixed(2)} 가 ${meanLimit} 미만`);
		check(outsideDifference <= 2, `blur ${blurValue} 뷰 밖이 같음`);
		if (shotFolder) {
			fs.writeFileSync(path.join(shotFolder, `blur_engine_${blurValue}_${radiusValue}.png`), engineResult.buffer);
			fs.writeFileSync(path.join(shotFolder, `blur_css_${blurValue}_${radiusValue}.png`), cssResult.buffer);
		}
	}
}
finally {
	await browser.close();
	server.close();
}
finish("uibackdropblurcss");
