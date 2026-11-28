//==============================================================================
// 2D 묶음의 셰이더 자르기와 자르기 안 거르기 크롬 시험. (NODE_PATH=$(npm root -g) node tests/core/batchclipchrome.test.mjs)
// - 축에 맞고 화소 경계에 놓인 자르기는 스텐실 대신 묶음 셰이더로 자른다. 같은 장면을 아주 조금 돌려(1e-9 라디안) 스텐실 길로 그린 것과 화소가 모두 같은지 본다.
//   장면: 스크롤 칸(UIScrollView, 줄 40 개), 겹친 자르기, 둥근 자르기 안팎, 정점 색 쿼드, 더하기와 셰이더 섞기, 불투명도 층, 바깥 WebGL 패스,
//   스텐실 테스트를 끄고 돌아오는 바깥 패스 뒤의 둥근 자르기, 축에 맞는 자르기 안에서 바꿔 끼운 셰이더에 셰이더 섞기(overlay)를 준 그리기.
//   불투명도 층 안에서 깊이를 비우지 않는 바깥 3D 패스(clearDepth: false, 깊이 시험 LESS).
// - 불투명도 층 칸은 층마다 깊이를 비우고 시작해야 한다. (지난 층이나 지난 프레임의 깊이가 남거나 판 끝에 버린 깊이를 읽으면 3D 가 가려진다)
//   invalidateFramebuffer 는 버려도 된다는 알림이라 드라이버가 무시해도 된다. 크롬(ANGLE)은 버린 깊이를 1 로 다시 채워 드러나지 않으므로,
//   페이지에서 invalidateFramebuffer 를 아무것도 하지 않게 바꿔 무시하는 드라이버를 흉내 낸다. (지난 프레임의 깊이 0.5 가 남는다)
// - 바꿔 끼운 셰이더와 셰이더 섞기는 덧그림 칸에 먼저 그리고 옮겨 섞는다. 옮길 때 자르기 밖을 덮지 않는지(바탕색이 남는지) 본다.
// - 셰이더 길이 드로 콜이 더 적고, 스크롤 칸 밖 줄을 거르는지(줄째 건너뛴 getLastFrameCulledSubtreeCount 와 컴포넌트만 거른 getLastFrameCulledNodeCount 의 합) 본다.
// - 씬이 그려진 다섯째 프레임을 찍는다. (씬은 불러온 뒤 로딩 화면을 0.3 초 더 보여서, 정한 프레임 번호로 찍으면 로딩 화면끼리 견주거나 한쪽만 로딩 화면이 된다)
//   찍은 화면이 로딩 화면(검정)이 아닌지도 본다.
// - 크롬 경로는 CHROME_PATH 로 바꿀 수 있다. puppeteer-core 나 크롬이 없으면 실패한다. (말없이 건너뛰지 않는다)
//==============================================================================
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";
import { check, checkEqual, checkNear, finish } from "../testcheck.mjs";
import { gotoPage, launchBrowser } from "../chromepage.mjs";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const repositoryPath = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");
const contentTypeTable = { ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".html": "text/html" };

const PAGE_SOURCE = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{position:absolute;left:0;top:0;width:100%;height:100%}</style><canvas id="mainCanvas"></canvas>
<script type="module">
WebGL2RenderingContext.prototype.invalidateFramebuffer = function () {};
const { Engine, EngineConfiguration, Scene, WorldNode, Vector2, Rect, Color, Pivot, Paint, TextAlign, ViewScaleMode, UILabel, UIButton, UIScrollView, ShaderProgram } = await import("/import.js");
const rotation = new URLSearchParams(location.search).get("rotation") === "1" ? 1e-9 : 0;
const CAPTURE_DRAWN_FRAME_COUNT = 5;
function createBoxNode(parentNode, position, size) {
	const node = new WorldNode();
	parentNode.addChild(node);
	node.setPivot(Pivot.topLeft);
	node.setLocalPosition(position);
	node.setContentSize(size);
	return node;
}
let externalProgram = null;
let overrideProgram = null;
let depthProgram = null;
let drawnFrameCount = 0;
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
		// 씬이 그려진 다섯째 프레임을 찍는다. (이 프레임 끝에 캔버스를 넘긴다)
		drawnFrameCount += 1;
		if (drawnFrameCount === CAPTURE_DRAWN_FRAME_COUNT) {
			window.capturePromise = engine.requestFrameCapture(engine.getFrameNumber());
		}
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
		// 바깥 패스가 스텐실 테스트를 끄고 쓰기 마스크를 0 으로 둔 채 돌아와도, 그 뒤의 스텐실 자르기(둥근 자르기)가 깨지지 않아야 한다.
		graphic.beginClipRect(Rect.create(20, 240, 140, 100));
		graphic.runExternalPass((webGL2RenderingContext) => {
			webGL2RenderingContext.disable(webGL2RenderingContext.STENCIL_TEST);
			webGL2RenderingContext.stencilMask(0x00);
		}, { clearDepth: false });
		graphic.endClipRect();
		graphic.beginClipRect(Rect.create(40, 250, 120, 90), 14);
		graphic.setFillColor("#20e070");
		graphic.drawRect(Rect.create(0, 230, 200, 130));
		graphic.endClipRect();
		// 축에 맞는 자르기 안에서 바꿔 끼운 셰이더에 셰이더 섞기를 준다. (바탕을 깔고, 자르기보다 넓게 그린다)
		graphic.setFillColor("#406080");
		graphic.drawRect(Rect.create(220, 230, 400, 120));
		if (overrideProgram === null) {
			const vertexShaderSource = "#version 300 es\\nin vec2 vertexPosition; in vec2 vertexTextureCoordinate; uniform mat3 projectionMatrix; uniform mat3 modelMatrix; out vec2 textureCoordinate;\\n"
				+ "void main() { vec3 position = projectionMatrix * modelMatrix * vec3(vertexPosition, 1.0); gl_Position = vec4(position.xy, 0.0, 1.0); textureCoordinate = vertexTextureCoordinate; }";
			const fragmentShaderSource = "#version 300 es\\nprecision highp float; in vec2 textureCoordinate; uniform sampler2D mainTexture; uniform vec4 mainColor; uniform float globalAlpha; out vec4 outputColor;\\n"
				+ "void main() { float alpha = texture(mainTexture, textureCoordinate).a * mainColor.a * globalAlpha; outputColor = vec4(vec3(1.0, 0.3, 0.1) * alpha, alpha); }";
			overrideProgram = new ShaderProgram(graphic.getWebGL2RenderingContext(), vertexShaderSource, fragmentShaderSource);
		}
		graphic.beginClipRect(Rect.create(300, 260, 120, 60));
		graphic.setBlendMode("overlay");
		graphic.setShaderProgramOverride(overrideProgram);
		graphic.setFillColor("#ffffff");
		graphic.drawRect(Rect.create(240, 240, 300, 100));
		graphic.setShaderProgramOverride(null);
		graphic.setBlendMode("source-over");
		graphic.endClipRect();
		// 불투명도 층 안에서 깊이를 비우지 않는 바깥 3D 패스. (깊이 0.5 의 사각형을 LESS 로 그린다, 층 칸의 깊이가 1 로 비워져 있어야 보인다)
		graphic.beginOpacityLayer();
		graphic.runExternalPass((webGL2RenderingContext) => {
			if (depthProgram === null) {
				const vertexShader = webGL2RenderingContext.createShader(webGL2RenderingContext.VERTEX_SHADER);
				webGL2RenderingContext.shaderSource(vertexShader, "#version 300 es\\nconst vec2 cornerList[6] = vec2[6](vec2(0.0, 0.0), vec2(1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, 1.0), vec2(1.0, 0.0), vec2(1.0, 1.0));\\n"
					+ "void main() { vec2 corner = cornerList[gl_VertexID]; gl_Position = vec4(mix(0.5625, 0.9375, corner.x), mix(-0.1667, 0.2222, corner.y), 0.0, 1.0); }");
				webGL2RenderingContext.compileShader(vertexShader);
				const fragmentShader = webGL2RenderingContext.createShader(webGL2RenderingContext.FRAGMENT_SHADER);
				webGL2RenderingContext.shaderSource(fragmentShader, "#version 300 es\\nprecision highp float; out vec4 outputColor; void main() { outputColor = vec4(0.2, 0.8, 0.9, 1.0); }");
				webGL2RenderingContext.compileShader(fragmentShader);
				depthProgram = webGL2RenderingContext.createProgram();
				webGL2RenderingContext.attachShader(depthProgram, vertexShader);
				webGL2RenderingContext.attachShader(depthProgram, fragmentShader);
				webGL2RenderingContext.linkProgram(depthProgram);
			}
			webGL2RenderingContext.useProgram(depthProgram);
			webGL2RenderingContext.bindVertexArray(null);
			webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);
			webGL2RenderingContext.enable(webGL2RenderingContext.DEPTH_TEST);
			webGL2RenderingContext.depthFunc(webGL2RenderingContext.LESS);
			webGL2RenderingContext.depthMask(true);
			webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLES, 0, 6);
		}, { clearDepth: false });
		graphic.endOpacityLayer();
		window.drawCallCountList.push(graphic.getLastFrameDrawCallCount());
		window.culledNodeCountList.push(graphic.getLastFrameCulledNodeCount() + graphic.getLastFrameCulledSubtreeCount());
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
	await gotoPage(page, "http://127.0.0.1:" + port + "/?rotation=" + rotationFlag);
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
	// 찍은 것이 로딩 화면(검정)이 아니라 장면인지. (스크롤 칸만 900 x 600 화소)
	let drawnPixelCount = 0;
	for (let index = 0; index < shaderClipResult.pixels.length; index += 4) {
		if (shaderClipResult.pixels[index] !== 0 || shaderClipResult.pixels[index + 1] !== 0 || shaderClipResult.pixels[index + 2] !== 0) {
			drawnPixelCount += 1;
		}
	}
	check(drawnPixelCount >= 540000, `장면을 찍었다 (검정이 아닌 화소 ${drawnPixelCount})`);
	// 바깥 패스 뒤 둥근 자르기 안 가운데(100, 295)와 둥근 모서리 밖(41, 251)의 화소. (화면 배율 3)
	for (const result of [shaderClipResult, stencilClipResult]) {
		const insideOffset = ((295 * 3) * result.width + 100 * 3) * 4;
		checkEqual([result.pixels[insideOffset], result.pixels[insideOffset + 1], result.pixels[insideOffset + 2]].join(","), "32,224,112", "바깥 패스가 스텐실을 끈 뒤 둥근 자르기 안");
		const cornerOffset = ((251 * 3) * result.width + 41 * 3) * 4;
		checkEqual([result.pixels[cornerOffset], result.pixels[cornerOffset + 1], result.pixels[cornerOffset + 2]].join(","), "0,0,0", "바깥 패스가 스텐실을 끈 뒤 둥근 자르기 모서리 밖");
	}
	// 불투명도 층 안의 깊이를 비우지 않는 3D 패스가 보이는지. (560, 175)
	for (const result of [shaderClipResult, stencilClipResult]) {
		const depthOffset = ((175 * 3) * result.width + 560 * 3) * 4;
		// 소프트웨어 렌더러(SwiftShader)는 블렌딩 끝 자리 반올림이 GPU 와 한 단계 다를 수 있다.
		checkNear([result.pixels[depthOffset], result.pixels[depthOffset + 1], result.pixels[depthOffset + 2]], [51, 204, 229], 1, "불투명도 층 안의 clearDepth: false 3D 패스");
	}
	// 바꿔 끼운 셰이더와 셰이더 섞기: 자르기 밖(260, 290)은 바탕색, 자르기 안(360, 290)은 섞인 색. (화면 배율 3)
	for (const result of [shaderClipResult, stencilClipResult]) {
		const outsideOffset = ((290 * 3) * result.width + 260 * 3) * 4;
		checkEqual([result.pixels[outsideOffset], result.pixels[outsideOffset + 1], result.pixels[outsideOffset + 2]].join(","), "64,96,128", "바꿔 끼운 셰이더 섞기 자르기 밖");
		const insideOffset = ((290 * 3) * result.width + 360 * 3) * 4;
		check(result.pixels[insideOffset] !== 64 || result.pixels[insideOffset + 1] !== 96 || result.pixels[insideOffset + 2] !== 128, "바꿔 끼운 셰이더 섞기 자르기 안은 섞였다");
	}
	const shaderDrawCallCount = shaderClipResult.drawCallCountList[shaderClipResult.drawCallCountList.length - 1];
	const stencilDrawCallCount = stencilClipResult.drawCallCountList[stencilClipResult.drawCallCountList.length - 1];
	check(shaderDrawCallCount < stencilDrawCallCount, `셰이더 자르기 드로 콜이 더 적다 (${shaderDrawCallCount} < ${stencilDrawCallCount})`);
	const culledNodeCount = shaderClipResult.culledNodeCountList[shaderClipResult.culledNodeCountList.length - 1];
	check(culledNodeCount >= 30, `스크롤 칸 밖 줄을 거른다 (${culledNodeCount})`);
	checkEqual(stencilClipResult.culledNodeCountList[stencilClipResult.culledNodeCountList.length - 1], culledNodeCount, "두 길 거른 노드 수");
	console.log(`드로 콜: 셰이더 자르기 ${shaderDrawCallCount}, 스텐실 자르기 ${stencilDrawCallCount}, 거른 노드 ${culledNodeCount}, 그린 화소 ${drawnPixelCount}`);
}
finally {
	await browser.close();
	server.close();
}
finish("batchclipchrome");
