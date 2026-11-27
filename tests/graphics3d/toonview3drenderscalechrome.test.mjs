//==============================================================================
// ToonView3D 렌더 스케일의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/graphics3d/toonview3drenderscalechrome.test.mjs)
// - 헤드리스 크롬(창을 띄우지 않는다, 기기 픽셀 배율 2)에서 엔진을 돌려 ToonView3D 에 공 하나를 그리고, 그 위에 2D 띠를 그린다.
//   배율 1 과 0.5 를 같은 프레임에서 떠서, 2D 띠는 화소가 같고(UI 는 기기 화소 그대로), 3D 자리는 그려졌으며 배율 1 과 가까운지 본다.
// - 배율 0.5 의 공 가장자리는 배율 1 보다 덜 날카롭다. (늘인 것)
//   puppeteer-core 나 크롬이 없으면 실패한다. (말없이 건너뛰지 않는다)
//==============================================================================
const System = globalThis;
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const repositoryPath = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");
const contentTypeTable = { ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".html": "text/html" };
let checkCount = 0;
function check(condition, message) {
	checkCount++;
	if (!condition) {
		throw new System.Error("시험 실패: " + message);
	}
}

// 저장소를 잠깐 내주는 http 서버. (모듈은 file:// 로 못 불러온다)
const server = http.createServer((request, response) => {
	const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
	if (requestPath === "/") {
		response.writeHead(200, { "Content-Type": "text/html" });
		response.end("<!doctype html><title>renderscale</title><style>html,body{margin:0;width:100%;height:100%}canvas{display:block;width:100%;height:100%}</style><body><canvas id=\"gameCanvas\"></canvas></body>");
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
await new System.Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
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
const captureScale = async (renderScale) => {
	const page = await browser.newPage();
	await page.setViewport({ width: 400, height: 300, deviceScaleFactor: 2 });
	await page.goto("http://127.0.0.1:" + port + "/");
	const captured = await page.evaluate(async (renderScale) => {
		const { Engine, EngineConfiguration, Scene, WorldNode, Vector2, Vector3, Rect, Matrix4, Pivot, ToonView3D, ToonDrawQueue, ToonMesh } = await import("/import.js");
		return await new Promise((resolve) => {
			let frame = 0;
			class MainScene extends Scene {
				initialize(engine) {
					super.initialize(engine);
					const node = new WorldNode();
					this.getRoot().addChild(node);
					node.setPivot(Pivot.topLeft);
					node.setLocalPosition(Vector2.create(0, 0));
					node.setContentSizeXY(400, 300);
					const view = node.addComponent(ToonView3D);
					view.setRenderScale(renderScale);
					view.getCamera().setPerspective(0.8, 0.1, 100);
					view.getCamera().lookAt(Vector3.create(0, 0, 3), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
					const builder = new ToonMesh.MeshBuilder();
					builder.addPart(ToonMesh.createSphereGeometry(0.8, 32, 20), Matrix4.createIdentity(), "#f0b080");
					const arrays = builder.readArrays();
					const queue = new ToonDrawQueue();
					let mesh = null;
					view.setDrawCallback((renderer, camera) => {
						if (mesh === null) {
							mesh = renderer.createMesh(arrays);
						}
						queue.clear();
						queue.addMesh(mesh, Matrix4.createIdentity());
						queue.draw(renderer, camera);
					});
				}
				draw(graphic) {
					super.draw(graphic);
					// 3D 위의 2D 띠. (UI)
					graphic.setFillColor("#20c040");
					graphic.drawRect(Rect.create(20, 20, 160, 30));
					frame++;
					if (frame === 20) {
						const gl = graphic.getWebGL2RenderingContext();
						graphic.flushSpriteBatch();
						const width = gl.drawingBufferWidth;
						const height = gl.drawingBufferHeight;
						const pixels = new Uint8Array(width * height * 4);
						gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
						resolve({ width, height, pixels: Array.from(pixels) });
					}
				}
			}
			const engineConfiguration = new EngineConfiguration();
			engineConfiguration.canvasId = "gameCanvas";
			engineConfiguration.referenceResolutionSize = Vector2.create(400, 300);
			engineConfiguration.defaultFontUrl = "";
			engineConfiguration.useDevTools = false;
			const engine = new Engine(engineConfiguration);
			engine.run(new MainScene());
		});
	}, renderScale);
	await page.close();
	return captured;
};
let full = null;
let half = null;
try {
	full = await captureScale(1);
	half = await captureScale(0.5);
}
finally {
	await browser.close();
	server.close();
}

check(full.width === half.width && full.height === half.height, "크기가 같음");
const width = full.width;
const height = full.height;
check(width === 800 && height === 600, "기기 픽셀 배율 2 의 드로잉 버퍼 " + width + "x" + height);
// 화소 읽기. (GL 은 아래 줄부터, 뷰 좌표 x, y 를 기기 픽셀로)
const readPixel = (capture, viewX, viewY) => {
	const pixelX = System.Math.floor(viewX * 2);
	const pixelY = height - 1 - System.Math.floor(viewY * 2);
	const index = (pixelY * width + pixelX) * 4;
	return capture.pixels.slice(index, index + 4);
};
// 1. 2D 띠는 화소가 같다.
let uiDifferentCount = 0;
for (let viewY = 22; viewY < 48; viewY += 0.5) {
	for (let viewX = 22; viewX < 178; viewX += 0.5) {
		const fullPixel = readPixel(full, viewX, viewY);
		const halfPixel = readPixel(half, viewX, viewY);
		if (fullPixel.join(",") !== halfPixel.join(",")) {
			uiDifferentCount++;
		}
	}
}
check(uiDifferentCount === 0, "2D 띠의 화소가 배율과 상관없이 같음 (다른 화소 " + uiDifferentCount + ")");
// 2. 공 가운데는 그려졌고 두 배율이 가깝다.
const centerFull = readPixel(full, 200, 150);
const centerHalf = readPixel(half, 200, 150);
const background = readPixel(full, 5, 290);
check(centerFull.join(",") !== background.join(","), "배율 1 의 공이 그려짐 " + centerFull.join(","));
check(centerHalf.join(",") !== background.join(","), "배율 0.5 의 공이 그려짐 " + centerHalf.join(","));
let sphereDifferenceSum = 0;
let sphereSampleCount = 0;
for (let viewY = 120; viewY < 180; viewY += 1) {
	for (let viewX = 170; viewX < 230; viewX += 1) {
		const fullPixel = readPixel(full, viewX, viewY);
		const halfPixel = readPixel(half, viewX, viewY);
		for (let channel = 0; channel < 3; channel++) {
			sphereDifferenceSum += System.Math.abs(fullPixel[channel] - halfPixel[channel]);
			sphereSampleCount++;
		}
	}
}
const sphereMeanDifference = sphereDifferenceSum / sphereSampleCount;
check(sphereMeanDifference < 6, "공 가운데의 두 배율 차이 평균 " + sphereMeanDifference.toFixed(2) + " (6 아래)");
// 3. 공 가장자리를 가로지르는 줄의 이웃 화소 차이 최댓값이 배율 0.5 에서 더 작다. (늘여서 무르다)
const readEdgeSharpness = (capture) => {
	let maximumStep = 0;
	for (let viewX = 100; viewX < 300; viewX += 0.5) {
		const left = readPixel(capture, viewX, 150);
		const right = readPixel(capture, viewX + 0.5, 150);
		maximumStep = System.Math.max(maximumStep, System.Math.abs(left[0] - right[0]) + System.Math.abs(left[1] - right[1]) + System.Math.abs(left[2] - right[2]));
	}
	return maximumStep;
};
const fullSharpness = readEdgeSharpness(full);
const halfSharpness = readEdgeSharpness(half);
console.log("  공 가운데 차이 평균 " + sphereMeanDifference.toFixed(2) + ", 가장자리 이웃 차 최댓값 배율 1 " + fullSharpness + ", 배율 0.5 " + halfSharpness);
check(halfSharpness < fullSharpness, "배율 0.5 의 가장자리가 더 무름");
if (process.env.RENDER_SCALE_DUMP_PATH) {
	fs.writeFileSync(process.env.RENDER_SCALE_DUMP_PATH + "_full.rgba", Buffer.from(full.pixels));
	fs.writeFileSync(process.env.RENDER_SCALE_DUMP_PATH + "_half.rgba", Buffer.from(half.pixels));
}
console.log("ToonView3D 렌더 스케일 크롬 시험 통과 (" + checkCount + " 검사)");
