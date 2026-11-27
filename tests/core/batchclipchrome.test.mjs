//==============================================================================
// 2D 묶음의 셰이더 자르기와 자르기 안 거르기 크롬 시험. (NODE_PATH=$(npm root -g) node tests/core/batchclipchrome.test.mjs)
// - 축에 맞고 화소 경계에 놓인 자르기는 스텐실 대신 묶음 셰이더로 자른다. 같은 장면을 아주 조금 돌려(1e-9 라디안) 스텐실 길로 그린 것과 화소가 모두 같은지 본다.
//   장면: 스크롤 칸(UIScrollView, 줄 40 개), 겹친 자르기, 둥근 자르기 안팎, 정점 색 쿼드, 더하기와 셰이더 섞기, 불투명도 층, 바깥 WebGL 패스.
// - 셰이더 길이 드로 콜이 더 적고, 스크롤 칸 밖 줄의 컴포넌트를 거르는지(getLastFrameCulledNodeCount) 본다.
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

const PAGE_SOURCE = `<!doctype html><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{position:absolute;left:0;top:0;width:100%;height:100%}</style><canvas id="mainCanvas"></canvas>
<script type="module">
const { Engine, EngineConfiguration, Scene, WorldNode, Vector2, Rect, Color, Pivot, Paint, TextAlign, ViewScaleMode, UILabel, UIButton, UIScrollView } = await import("/import.js");
const rotation = new URLSearchParams(location.search).get("rotation") === "1" ? 1e-9 : 0;
function createBoxNode(parentNode, position, size) {
	const node = new WorldNode();
	parentNode.addChild(node);
	node.setPivot(Pivot.topLeft);
	node.setLocalPosition(position);
	node.setContentSize(size);
	return node;
}
let externalProgram = null;
class BatchClipScene extends Scene {
	initialize(engine) {
		super.initialize(engine);
		const root = this.getRoot();
		root.setContentSize(Vector2.create(640, 360));
		const scrollNode = createBoxNode(root, Vector2.create(20, 20), Vector2.create(300, 200));
		const scrollView = scrollNode.addComponent(UIScrollView);
		scrollView.setBackgroundColor(Color.createFromHEX("#1d1814"));
		scrollView.setScrollContentSize(Vector2.create(300, 40 * 30));
		scrollView.setHorizontal(false);
		scrollView.setScrollOffset(Vector2.create(0, -95));
		for (let rowIndex = 0; rowIndex < 40; ++rowIndex) {
			const rowNode = createBoxNode(scrollView.getContent(), Vector2.create(4, rowIndex * 30), Vector2.create(280, 26));
			const rowPaint = rowNode.addComponent(Paint);
			rowPaint.setColor(rowIndex % 2 === 0 ? "#4a3c30" : "#5a4a3c");
			rowPaint.setRoundSize(6);
			const label = rowNode.addComponent(UILabel);
			label.setText("줄 " + rowIndex);
			label.setFontSize(14);
			label.setTextAlign(TextAlign.left);
			label.setTextColor("#f1e9d8");
			rowNode.addComponent(UIButton);
		}
	}
	drawColoredQuads(graphic, left, top) {
		const cornerList = [[0, 0], [1, 0], [0, 1], [0, 1], [1, 0], [1, 1]];
		const vertexData = graphic.getParticleVertexData(8 * 48);
		let offset = 0;
		for (let quadIndex = 0; quadIndex < 8; ++quadIndex) {
			for (const [cornerX, cornerY] of cornerList) {
				vertexData[offset++] = left + quadIndex * 13.5 + cornerX * 20;
				vertexData[offset++] = top + cornerY * 20;
				vertexData[offset++] = cornerX;
				vertexData[offset++] = cornerY;
				vertexData[offset++] = quadIndex / 8;
				vertexData[offset++] = cornerX;
				vertexData[offset++] = cornerY * 0.7;
				vertexData[offset++] = 0.4 + 0.3 * cornerX;
			}
		}
		graphic.drawColoredQuads(8 * 6, graphic.getSoftDiscTexture());
	}
	draw(graphic) {
		graphic.rotate(rotation);
		super.draw(graphic);
		graphic.beginClipRect(Rect.create(340, 20, 120, 80));
		graphic.setFillColor("rgba(80, 160, 255, 0.8)");
		graphic.drawCircle(Vector2.create(400, 60), 70);
		graphic.beginClipRect(Rect.create(360, 40, 60, 80));
		graphic.setFillColor("rgba(255, 60, 60, 0.6)");
		graphic.drawRect(Rect.create(300, 0, 300, 200));
		this.drawColoredQuads(graphic, 340, 70);
		graphic.endClipRect();
		graphic.beginClipRect(Rect.create(380, 30, 100, 60), 12);
		graphic.setFillColor("rgba(60, 255, 60, 0.5)");
		graphic.drawRect(Rect.create(300, 0, 300, 200));
		graphic.endClipRect();
		graphic.setBlendMode("lighter");
		this.drawColoredQuads(graphic, 330, 30);
		graphic.setBlendMode("overlay");
		graphic.setFillColor("rgba(255, 120, 40, 0.7)");
		graphic.drawCircle(Vector2.create(450, 90), 40);
		graphic.setBlendMode("source-over");
		graphic.endClipRect();
		graphic.beginClipRect(Rect.create(480, 20, 140, 100), 16);
		graphic.beginClipRect(Rect.create(470, 40, 100, 100));
		graphic.pushState();
		graphic.setGlobalAlpha(0.5);
		graphic.beginOpacityLayer();
		graphic.setFillColor("#ff0000");
		graphic.drawRect(Rect.create(460, 30, 100, 60));
		graphic.setFillColor("#0000ff");
		graphic.drawRect(Rect.create(500, 60, 100, 60));
		graphic.endOpacityLayer();
		graphic.popState();
		graphic.endClipRect();
		graphic.endClipRect();
		graphic.beginClipRect(Rect.create(340, 140, 100, 60));
		graphic.beginClipRect(Rect.create(380, 120, 100, 60));
		graphic.runExternalPass((webGL2RenderingContext) => {
			if (externalProgram === null) {
				const vertexShader = webGL2RenderingContext.createShader(webGL2RenderingContext.VERTEX_SHADER);
				webGL2RenderingContext.shaderSource(vertexShader, "#version 300 es\\nvoid main() { vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0); }");
				webGL2RenderingContext.compileShader(vertexShader);
				const fragmentShader = webGL2RenderingContext.createShader(webGL2RenderingContext.FRAGMENT_SHADER);
				webGL2RenderingContext.shaderSource(fragmentShader, "#version 300 es\\nprecision highp float; out vec4 outputColor; void main() { outputColor = vec4(0.9, 0.2, 0.6, 1.0); }");
				webGL2RenderingContext.compileShader(fragmentShader);
				externalProgram = webGL2RenderingContext.createProgram();
				webGL2RenderingContext.attachShader(externalProgram, vertexShader);
				webGL2RenderingContext.attachShader(externalProgram, fragmentShader);
				webGL2RenderingContext.linkProgram(externalProgram);
			}
			webGL2RenderingContext.useProgram(externalProgram);
			webGL2RenderingContext.bindVertexArray(null);
			webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);
			webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLES, 0, 3);
		}, { clearDepth: false });
		graphic.endClipRect();
		graphic.endClipRect();
		window.drawCallCountList.push(graphic.getLastFrameDrawCallCount());
		window.culledNodeCountList.push(graphic.getLastFrameCulledNodeCount());
	}
}
window.drawCallCountList = [];
window.culledNodeCountList = [];
const engineConfiguration = new EngineConfiguration();
engineConfiguration.canvasId = "mainCanvas";
engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
const engine = new Engine(engineConfiguration);
engine.getViewManager().setViewScaleMode(ViewScaleMode.stretchShort);
engine.run(new BatchClipScene());
window.capturePromise = engine.requestFrameCapture(20);
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

// 한 길로 그린 장면의 화소와 드로 콜 수. (화소 비율 1.5, 1280 x 720 화면이라 자르기 경계가 화소 경계에 놓인다)
async function renderScene(rotationFlag) {
	const page = await browser.newPage();
	await page.setViewport({ width: 640 * 2, height: 360 * 2, deviceScaleFactor: 1.5 });
	const errorList = [];
	page.on("pageerror", (error) => errorList.push(error.message));
	page.on("console", (message) => {
		if (message.type() === "error" || message.type() === "warning") {
			errorList.push(message.text());
		}
	});
	await page.goto("http://127.0.0.1:" + port + "/?rotation=" + rotationFlag);
	await page.waitForFunction(() => window.capturePromise !== undefined);
	const dataUrl = await page.evaluate(() => window.capturePromise);
	const pixelResult = await page.evaluate(async (imageUrl) => {
		const image = new Image();
		image.src = imageUrl;
		await image.decode();
		const canvas = new OffscreenCanvas(image.width, image.height);
		const context = canvas.getContext("2d");
		context.drawImage(image, 0, 0);
		return { width: image.width, height: image.height, pixels: Array.from(context.getImageData(0, 0, image.width, image.height).data) };
	}, dataUrl);
	const countList = await page.evaluate(() => ({ drawCallCountList: window.drawCallCountList, culledNodeCountList: window.culledNodeCountList }));
	await page.close();
	return { ...pixelResult, ...countList, errorList };
}

try {
	const shaderClipResult = await renderScene("0");
	const stencilClipResult = await renderScene("1");
	checkEqual(shaderClipResult.errorList.join("\n"), "", "셰이더 자르기 길 오류");
	checkEqual(stencilClipResult.errorList.join("\n"), "", "스텐실 자르기 길 오류");
	checkEqual(shaderClipResult.width, 1920, "화면 폭");
	checkEqual(shaderClipResult.width, stencilClipResult.width, "두 길 화면 폭");
	let differentPixelCount = 0;
	for (let index = 0; index < shaderClipResult.pixels.length; ++index) {
		if (shaderClipResult.pixels[index] !== stencilClipResult.pixels[index]) {
			differentPixelCount += 1;
		}
	}
	checkEqual(differentPixelCount, 0, "셰이더 자르기와 스텐실 자르기 화소");
	const shaderDrawCallCount = shaderClipResult.drawCallCountList[shaderClipResult.drawCallCountList.length - 1];
	const stencilDrawCallCount = stencilClipResult.drawCallCountList[stencilClipResult.drawCallCountList.length - 1];
	check(shaderDrawCallCount < stencilDrawCallCount, `셰이더 자르기 드로 콜이 더 적다 (${shaderDrawCallCount} < ${stencilDrawCallCount})`);
	const culledNodeCount = shaderClipResult.culledNodeCountList[shaderClipResult.culledNodeCountList.length - 1];
	check(culledNodeCount >= 30, `스크롤 칸 밖 줄을 거른다 (${culledNodeCount})`);
	checkEqual(stencilClipResult.culledNodeCountList[stencilClipResult.culledNodeCountList.length - 1], culledNodeCount, "두 길 거른 노드 수");
	console.log(`드로 콜: 셰이더 자르기 ${shaderDrawCallCount}, 스텐실 자르기 ${stencilDrawCallCount}, 거른 노드 ${culledNodeCount}`);
}
finally {
	await browser.close();
	server.close();
}
finish("batchclipchrome");
