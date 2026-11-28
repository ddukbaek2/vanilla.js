//==============================================================================
// 툰 강조의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/graphics3d/toonhighlightchrome.test.mjs)
// - 헤드리스 크롬(창을 띄우지 않는다)에서 같은 바위 셋을 인스턴스로 그린다. (번호 10, 11, 12, 화면을 세 칸으로 나눠 하나씩)
// - 번호 색 표: ToonScreenOutline.setLineColor 로 11 만 넣으면 가운데 칸의 선만 바뀌고 양 옆 칸은 화소가 같다. 표를 비우면 넣기 전과 화소가 같다.
// - 인스턴스 빛남: 가운데 인스턴스에만 emissiveColor 를 주면 가운데 칸만 밝아지고 양 옆 칸은 화소가 같다. 가운데 칸 안의 명암 차이는 남는다.
//   SCREEN_DUMP_PATH 를 주면 찍은 그림을 .rgba 로 남긴다. (화면 견주기)
//   puppeteer-core 나 크롬이 없으면 실패한다. (말없이 건너뛰지 않는다)
//==============================================================================
const System = globalThis;
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";
import { gotoPage, launchBrowser } from "../chromepage.mjs";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const repositoryPath = process.env.TOON_HIGHLIGHT_REPOSITORY_PATH ?? path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");
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
		response.end("<!doctype html><title>highlight</title><body><canvas id=\"canvas\" width=\"480\" height=\"200\"></canvas></body>");
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
const browser = await launchBrowser(puppeteer, { executablePath, headless: true });
let captures = null;
try {
	const page = await browser.newPage();
	await gotoPage(page, "http://127.0.0.1:" + port + "/");
	captures = await page.evaluate(async () => {
		const { ToonRenderer, ToonScreenOutline, MeshBuilder, createOctahedronGeometry, Matrix4, Vector3 } = await import("/import.js");
		const canvas = document.getElementById("canvas");
		const webGL2RenderingContext = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
		const renderer = new ToonRenderer(webGL2RenderingContext);
		const outline = new ToonScreenOutline(webGL2RenderingContext);
		outline.setWidth(3);
		outline.setCrease(40, 1.5, 1);
		const builder = new MeshBuilder();
		builder.addPart(createOctahedronGeometry(0.55), Matrix4.createIdentity(), "#a89880", { hasOutline: false });
		const rockMesh = renderer.createMesh(builder.readArrays());
		const viewMatrix = Matrix4.createLookAt(Vector3.create(0, 1.6, 4.2), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
		const projectionMatrix = Matrix4.createPerspective(0.6, 480 / 200, 0.1, 50);
		const readFrame = (instances, hasOutline) => {
			webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, null);
			webGL2RenderingContext.viewport(0, 0, 480, 200);
			webGL2RenderingContext.clearColor(0.2, 0.25, 0.3, 1);
			webGL2RenderingContext.clear(webGL2RenderingContext.COLOR_BUFFER_BIT | webGL2RenderingContext.DEPTH_BUFFER_BIT);
			if (hasOutline && outline.beginLineIds(viewMatrix, projectionMatrix)) {
				outline.drawMeshInstanced(rockMesh, instances, 10);
				outline.endLineIds();
			}
			renderer.beginFrameWithMatrices(viewMatrix, projectionMatrix);
			renderer.drawMeshInstanced(rockMesh, instances);
			renderer.endFrame();
			if (hasOutline) {
				outline.drawOutline();
			}
			const pixels = new Uint8Array(480 * 200 * 4);
			webGL2RenderingContext.readPixels(0, 0, 480, 200, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, pixels);
			return Array.from(pixels);
		};
		const createInstances = () => [-1.6, 0, 1.6].map((x, index) => ({ modelMatrix: Matrix4.createTranslation(x, 0, 0), lineId: 10 + index }));
		const result = {};
		result.base = readFrame(createInstances(), true);
		outline.setLineColor(11, [1, 0.85, 0.1, 1]);
		result.lineColor = readFrame(createInstances(), true);
		result.lineColorCount = outline.getLineColorCount();
		outline.setLineColor(0, [1, 0, 0, 1]);
		outline.setLineColor(99999, [1, 0, 0, 1]);
		result.lineColorCountAfterInvalid = outline.getLineColorCount();
		outline.clearLineColors();
		result.cleared = readFrame(createInstances(), true);
		outline.setLineColor(12, [1, 0, 0, 1]);
		outline.removeLineColor(12);
		result.removed = readFrame(createInstances(), true);
		result.bodyBase = readFrame(createInstances(), false);
		const glowInstances = createInstances();
		glowInstances[1].emissiveColor = [1, 0.85, 0.3];
		glowInstances[1].emissiveIntensity = 0.3;
		result.bodyGlow = readFrame(glowInstances, false);
		result.error = webGL2RenderingContext.getError();
		return result;
	});
	await page.close();
}
finally {
	await browser.close();
	server.close();
}

check(captures.error === 0, "GL 오류 없음 (" + captures.error + ")");
const width = 480;
const height = 200;
// 칸마다 다른 화소 수와 밝기 합. (칸 0, 1, 2 는 x 0 ~ 159, 160 ~ 319, 320 ~ 479)
const compareColumns = (first, second) => {
	const differentCounts = [0, 0, 0];
	for (let pixelY = 0; pixelY < height; pixelY++) {
		for (let pixelX = 0; pixelX < width; pixelX++) {
			const index = (pixelY * width + pixelX) * 4;
			if (first[index] !== second[index] || first[index + 1] !== second[index + 1] || first[index + 2] !== second[index + 2] || first[index + 3] !== second[index + 3]) {
				differentCounts[System.Math.floor(pixelX / 160)]++;
			}
		}
	}
	return differentCounts;
};
const lineColorDifference = compareColumns(captures.base, captures.lineColor);
console.log("  번호 색 표(11 만): 칸마다 다른 화소 " + lineColorDifference.join(", "));
check(lineColorDifference[0] === 0 && lineColorDifference[2] === 0, "표에 없는 번호 10, 12 의 칸은 화소가 같음");
check(lineColorDifference[1] > 200, "표에 넣은 번호 11 의 칸은 선이 바뀜 (" + lineColorDifference[1] + ")");
check(captures.lineColorCount === 1 && captures.lineColorCountAfterInvalid === 1, "범위 밖 번호는 표에 들지 않음");
// 바뀐 화소는 노란 쪽. (빨강이 초록보다 크고 파랑이 작음)
let yellowCount = 0;
for (let pixelY = 0; pixelY < height; pixelY++) {
	for (let pixelX = 160; pixelX < 320; pixelX++) {
		const index = (pixelY * width + pixelX) * 4;
		if (captures.lineColor[index] !== captures.base[index] && captures.lineColor[index] > 200 && captures.lineColor[index + 2] < 120) {
			yellowCount++;
		}
	}
}
check(yellowCount > 100, "가운데 칸의 선이 표의 노란 색 (" + yellowCount + ")");
const clearedDifference = compareColumns(captures.base, captures.cleared);
check(clearedDifference.every((count) => count === 0), "clearLineColors 뒤는 넣기 전과 화소가 같음 (" + clearedDifference.join(", ") + ")");
const removedDifference = compareColumns(captures.base, captures.removed);
check(removedDifference.every((count) => count === 0), "removeLineColor 뒤는 넣기 전과 화소가 같음 (" + removedDifference.join(", ") + ")");

const glowDifference = compareColumns(captures.bodyBase, captures.bodyGlow);
console.log("  인스턴스 빛남(가운데만): 칸마다 다른 화소 " + glowDifference.join(", "));
check(glowDifference[0] === 0 && glowDifference[2] === 0, "빛남이 없는 인스턴스의 칸은 화소가 같음");
check(glowDifference[1] > 1000, "빛남을 준 인스턴스의 칸은 바뀜 (" + glowDifference[1] + ")");
// 가운데 칸: 모든 바뀐 화소가 더 밝고, 명암 차이(가장 밝은 면과 어두운 면의 차)가 남는다.
let darkerCount = 0;
let minimumGlow = 765;
let maximumGlow = 0;
for (let pixelY = 0; pixelY < height; pixelY++) {
	for (let pixelX = 160; pixelX < 320; pixelX++) {
		const index = (pixelY * width + pixelX) * 4;
		const baseSum = captures.bodyBase[index] + captures.bodyBase[index + 1] + captures.bodyBase[index + 2];
		const glowSum = captures.bodyGlow[index] + captures.bodyGlow[index + 1] + captures.bodyGlow[index + 2];
		if (glowSum === baseSum) {
			continue;
		}
		if (glowSum < baseSum) {
			darkerCount++;
		}
		minimumGlow = System.Math.min(minimumGlow, glowSum);
		maximumGlow = System.Math.max(maximumGlow, glowSum);
	}
}
console.log("  빛남 인스턴스 밝기 합 범위 " + minimumGlow + " ~ " + maximumGlow);
check(darkerCount === 0, "빛남은 더하기라 어두워진 화소가 없음 (" + darkerCount + ")");
check(maximumGlow - minimumGlow > 60, "빛남 위에 명암이 남음 (" + (maximumGlow - minimumGlow) + ")");
if (process.env.SCREEN_DUMP_PATH) {
	for (const name of ["base", "lineColor", "cleared", "bodyBase", "bodyGlow"]) {
		fs.writeFileSync(process.env.SCREEN_DUMP_PATH + "_" + name + ".rgba", Buffer.from(captures[name]));
	}
}
console.log("툰 강조 크롬 시험 통과 (" + checkCount + " 검사)");
