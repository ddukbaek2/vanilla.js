//==============================================================================
// 해 그림자 초점 칸(setFocusStep)의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/graphics3d/shadowfocusstepchrome.test.mjs)
// - 헤드리스 크롬(창을 띄우지 않는다)에서 카메라와 초점이 걷고 그림자를 던지는 것들은 서 있는 장면을 세 벌로 그린다. 기본 칸 0 의 everyFrame, 칸 0 의 onChange, 칸 2 의 onChange.
// - 칸 0 의 onChange 는 everyFrame 과 화소가 같고, 칸 2 의 onChange 는 다시 그린 프레임 수가 크게 줄며 초점 둘레 화면이 everyFrame 과 거의 같은지(그림자가 잘리지 않는지) 본다.
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
		response.end("<!doctype html><title>shadowfocusstep</title><body><canvas id=\"canvas\" width=\"160\" height=\"120\"></canvas></body>");
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
let result = null;
try {
	const page = await browser.newPage();
	await gotoPage(page, "http://127.0.0.1:" + port + "/");
	result = await page.evaluate(async () => {
		const { ToonRenderer, ToonDrawQueue, MeshBuilder, createBoxGeometry, ShadowMap, ShadowUpdateMode, Matrix4, Vector3, Camera3D } = await import("/import.js");
		const canvas = document.getElementById("canvas");
		const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
		const renderer = new ToonRenderer(gl);
		const createMesh = (geometry, color) => {
			const builder = new MeshBuilder();
			builder.addPart(geometry, Matrix4.createIdentity(), color, { hasOutline: false });
			return renderer.createMesh(builder.readArrays());
		};
		const groundMesh = createMesh(createBoxGeometry(80, 0.2, 80), "#a0a8b0");
		const boxMesh = createMesh(createBoxGeometry(0.6, 1.2, 0.6), "#e0a070");
		const pillarMesh = createMesh(createBoxGeometry(0.4, 2, 0.4), "#80c0e0");
		const camera = new Camera3D();
		camera.setPerspective(0.9, 0.1, 60);
		camera.setAspectRatio(160 / 120);
		const everyShadowMap = new ShadowMap(gl, 1024);
		const zeroShadowMap = new ShadowMap(gl, 1024);
		const stepShadowMap = new ShadowMap(gl, 1024);
		everyShadowMap.setUpdateMode(ShadowUpdateMode.everyFrame);
		zeroShadowMap.setUpdateMode(ShadowUpdateMode.onChange);
		stepShadowMap.setUpdateMode(ShadowUpdateMode.onChange);
		stepShadowMap.setFocusStep(2);
		const queue = new ToonDrawQueue();
		const pixels = new Uint8Array(160 * 120 * 4);
		const readFrame = () => {
			gl.readPixels(0, 0, 160, 120, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
			return pixels.slice();
		};
		let drawCount = 0;
		const originalDrawElements = gl.drawElements.bind(gl);
		gl.drawElements = (...args) => {
			drawCount += 1;
			return originalDrawElements(...args);
		};
		const sunDirection = Vector3.create(-0.5, -1, -0.4);
		const renderScene = (shadowMap) => {
			renderer.setShadow(shadowMap, 0.7);
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.viewport(0, 0, 160, 120);
			gl.clearColor(0.1, 0.1, 0.1, 1);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			queue.draw(renderer, camera);
			return readFrame();
		};
		const frameList = [];
		let everyKeyCount = 0;
		for (let frame = 0; frame < 120; ++frame) {
			const boxX = -3 + frame * 0.05; // 초점과 카메라가 걷는 자리. (그림자를 던지는 것들은 서 있다)
			camera.lookAt(Vector3.create(boxX, 4, 5), Vector3.create(boxX, 0, 0), Vector3.create(0, 1, 0));
			const focus = Vector3.create(boxX, 0, 0);
			everyShadowMap.updateLightMatrix(focus, sunDirection, 4, 0.1, 30);
			zeroShadowMap.updateLightMatrix(focus, sunDirection, 4, 0.1, 30);
			stepShadowMap.updateLightMatrix(focus, sunDirection, 4, 0.1, 30);
			queue.clear();
			queue.addMesh(groundMesh, Matrix4.createTranslation(0, -0.1, 0));
			queue.addMesh(boxMesh, Matrix4.createTranslation(0.3, 0.6, 0));
			queue.addMesh(pillarMesh, Matrix4.createTranslation(0, 1, -1));
			queue.addMesh(pillarMesh, Matrix4.createTranslation(3, 1, -0.5));
			queue.drawShadows(renderer, everyShadowMap);
			const everyPixels = renderScene(everyShadowMap);
			drawCount = 0;
			queue.drawShadows(renderer, zeroShadowMap);
			const zeroDrawCount = drawCount;
			const zeroPixels = renderScene(zeroShadowMap);
			drawCount = 0;
			queue.drawShadows(renderer, stepShadowMap);
			const stepDrawCount = drawCount;
			const stepPixels = renderScene(stepShadowMap);
			let zeroDiff = 0;
			let stepDiff = 0;
			let litCount = 0;
			for (let index = 0; index < everyPixels.length; index += 4) {
				zeroDiff += (everyPixels[index] !== zeroPixels[index] || everyPixels[index + 1] !== zeroPixels[index + 1] || everyPixels[index + 2] !== zeroPixels[index + 2]) ? 1 : 0;
				stepDiff += Math.abs(everyPixels[index] - stepPixels[index]) + Math.abs(everyPixels[index + 1] - stepPixels[index + 1]) + Math.abs(everyPixels[index + 2] - stepPixels[index + 2]) > 60 ? 1 : 0;
				litCount += everyPixels[index] + everyPixels[index + 1] + everyPixels[index + 2] > 120 ? 1 : 0;
			}
			frameList.push({ zeroDrawCount: zeroDrawCount, stepDrawCount: stepDrawCount, zeroDiff: zeroDiff, stepDiff: stepDiff, litCount: litCount, error: gl.getError() });
		}
		return { frameList: frameList, defaultStep: new ShadowMap(gl, 64).getFocusStep(), stepValue: stepShadowMap.getFocusStep() };
	});
	await page.close();
}
finally {
	await browser.close();
	server.close();
}

const frameList = result.frameList;
check(result.defaultStep === 0 && result.stepValue === 2, "기본 칸 0, 정한 칸 2");
let zeroRedraw = 0;
let stepRedraw = 0;
for (let frame = 0; frame < frameList.length; ++frame) {
	const entry = frameList[frame];
	check(entry.error === 0, frame + " 프레임 GL 오류");
	check(entry.litCount > 1000, frame + " 프레임 장면이 그려짐");
	check(entry.zeroDiff === 0, frame + " 프레임 칸 0 의 onChange 화면이 everyFrame 과 같음 (" + entry.zeroDiff + ")");
	check(entry.stepDiff < 160 * 120 * 0.02, frame + " 프레임 칸 2 의 화면이 everyFrame 과 거의 같음, 그림자 안 잘림 (" + entry.stepDiff + ")");
	zeroRedraw += entry.zeroDrawCount > 0 ? 1 : 0;
	stepRedraw += entry.stepDrawCount > 0 ? 1 : 0;
}
console.log("다시 그린 프레임 수: 칸 0 = " + zeroRedraw + ", 칸 2 = " + stepRedraw + " / " + frameList.length);
check(zeroRedraw > frameList.length * 0.8, "칸 0 은 따라 움직일 때 거의 매 프레임 다시 그림 (" + zeroRedraw + ")");
check(stepRedraw < frameList.length * 0.4, "칸 2 는 다시 그린 프레임이 크게 줆 (" + stepRedraw + ")");
console.log("해 그림자 초점 칸 크롬 시험 통과 (" + checkCount + " 개 확인)");
