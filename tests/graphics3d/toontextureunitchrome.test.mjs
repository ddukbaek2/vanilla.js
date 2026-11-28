//==============================================================================
// 툰 그리기의 텍스처 유닛 고르기 크롬 시험. (NODE_PATH=$(npm root -g) node tests/graphics3d/toontextureunitchrome.test.mjs)
// - 헤드리스 크롬(창을 띄우지 않는다)에서 모형 넷과 바탕색 텍스처 둘을 엇갈려 쓰는 상자 여덟을 해 그림자와 함께 그리기 줄로 그린다.
//   정렬한 차례에서 바탕색 텍스처가 그리기마다 바뀐다. (유닛 4 만 바뀐다)
// - 그리기마다 고른 유닛을 0 으로 되돌리지 않으므로 같은 유닛만 바꾸는 그리기는 activeTexture 없이 bindTexture 하나다.
//   고치기 전에는 그리기마다 activeTexture(4) 와 activeTexture(0) 둘을 불러 프레임에 스물여섯이었다. (고친 뒤 열하나)
// - 단계 콜백과 몸 그리기의 onBeforeDraw 에는 유닛 0 을 고른 채 넘기고, 프레임이 끝나면 앞서 고른 유닛(3)과 유닛 0 의 텍스처를 돌려놓는지 GL 에 바로 물어 본다.
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
		response.end("<!doctype html><title>toontextureunit</title><body><canvas id=\"canvas\" width=\"160\" height=\"120\"></canvas></body>");
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
		const { ToonRenderer, ToonDrawQueue, ToonDrawStage, ToonProgramKind, MeshBuilder, createBoxGeometry, createSphereGeometry, createOctahedronGeometry, createCylinderGeometry, ShadowMap, ShadowUpdateMode, Matrix4, Vector3, Camera3D } = await import("/import.js");
		const canvas = document.getElementById("canvas");
		const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
		const renderer = new ToonRenderer(gl);
		const createMesh = (geometry) => {
			const builder = new MeshBuilder();
			builder.addPart(geometry, Matrix4.createIdentity(), "#ffffff", { hasOutline: false });
			return renderer.createMesh(builder.readArrays());
		};
		const createPattern = (first, second) => {
			const patternCanvas = document.createElement("canvas");
			patternCanvas.width = 8;
			patternCanvas.height = 8;
			const context = patternCanvas.getContext("2d");
			context.fillStyle = first;
			context.fillRect(0, 0, 8, 8);
			context.fillStyle = second;
			context.fillRect(0, 0, 4, 4);
			return renderer.createTexture(patternCanvas, { isMipmapped: false });
		};
		const groundMesh = createMesh(createBoxGeometry(8, 0.2, 8));
		const meshList = [createMesh(createBoxGeometry(0.6, 0.8, 0.6)), createMesh(createSphereGeometry(0.35, 12, 8)), createMesh(createOctahedronGeometry(0.35)), createMesh(createCylinderGeometry(0.3, 0.3, 0.8, 12))];
		const textureList = [createPattern("#e0a070", "#603020"), createPattern("#70a0e0", "#203060")];
		const camera = new Camera3D();
		camera.setPerspective(0.9, 0.1, 50);
		camera.setAspectRatio(160 / 120);
		camera.lookAt(Vector3.create(0, 4, 5), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
		const shadowMap = new ShadowMap(gl, 512);
		shadowMap.setUpdateMode(ShadowUpdateMode.onChange);
		shadowMap.updateLightMatrix(Vector3.create(0, 0, 0), Vector3.create(-0.5, -1, -0.4), 4, 0.1, 20);
		renderer.setShadow(shadowMap, 0.7);
		const queue = new ToonDrawQueue();
		// 상태 캐시를 거치지 않고 GL 에 바로 묻는다.
		const readParameter = (name) => WebGL2RenderingContext.prototype.getParameter.call(gl, name);
		const callbackUnitList = [];
		const counter = { isOn: false, activeTexture: 0, bindTexture: 0 };
		const originalActiveTexture = gl.activeTexture.bind(gl);
		const originalBindTexture = gl.bindTexture.bind(gl);
		gl.activeTexture = (textureUnit) => {
			counter.activeTexture += counter.isOn ? 1 : 0;
			return originalActiveTexture(textureUnit);
		};
		gl.bindTexture = (target, texture) => {
			counter.bindTexture += counter.isOn ? 1 : 0;
			return originalBindTexture(target, texture);
		};
		const outsideTexture = gl.createTexture();
		const frameList = [];
		for (let frame = 0; frame < 6; ++frame) {
			// 게임이 유닛 0 에 제 텍스처를 두고 유닛 3 을 고른 채 3D 를 그린다.
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, outsideTexture);
			gl.activeTexture(gl.TEXTURE3);
			counter.activeTexture = 0;
			counter.bindTexture = 0;
			counter.isOn = true;
			queue.clear();
			queue.addMesh(groundMesh, Matrix4.createTranslation(0, -0.1, 0));
			for (let index = 0; index < 8; ++index) {
				const options = { baseColorTexture: textureList[index % 2] };
				if (index === 5) {
					// 몸 그리기의 콜백만 본다. (그림자 깊이 패스는 텍스처를 묶지 않아 고른 유닛이 그대로다)
					options.onBeforeDraw = (program, context, kind) => {
						if (kind === ToonProgramKind.solid) {
							callbackUnitList.push(readParameter(context.ACTIVE_TEXTURE) - context.TEXTURE0);
						}
					};
				}
				queue.addMesh(meshList[Math.floor(index / 2)], Matrix4.createTranslation(-2.1 + index * 0.6, 0.4, 0), options);
			}
			queue.addPass(ToonDrawStage.afterOpaque, (renderer, context) => {
				callbackUnitList.push(readParameter(context.ACTIVE_TEXTURE) - context.TEXTURE0);
			});
			queue.drawShadows(renderer, shadowMap);
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.viewport(0, 0, 160, 120);
			gl.clearColor(0.1, 0.1, 0.1, 1);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			queue.draw(renderer, camera);
			counter.isOn = false;
			const activeUnit = readParameter(gl.ACTIVE_TEXTURE) - gl.TEXTURE0;
			gl.activeTexture(gl.TEXTURE0);
			const firstUnitTexture = readParameter(gl.TEXTURE_BINDING_2D);
			frameList.push({ activeTexture: counter.activeTexture, bindTexture: counter.bindTexture, activeUnit: activeUnit, isFirstUnitRestored: firstUnitTexture === outsideTexture, error: gl.getError() });
		}
		const pixels = new Uint8Array(160 * 120 * 4);
		gl.readPixels(0, 0, 160, 120, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
		let litCount = 0;
		for (let index = 0; index < pixels.length; index += 4) {
			litCount += pixels[index] + pixels[index + 1] + pixels[index + 2] > 120 ? 1 : 0;
		}
		return { frameList: frameList, callbackUnitList: callbackUnitList, litCount: litCount };
	});
	await page.close();
}
finally {
	await browser.close();
	server.close();
}

const frameList = result.frameList;
if (process.env.TEXTURE_UNIT_TRACE === "1") {
	console.log(JSON.stringify(frameList));
}
check(result.litCount > 1000, "장면이 그려짐 (" + result.litCount + ")");
for (let frame = 0; frame < frameList.length; ++frame) {
	check(frameList[frame].error === 0, frame + " 프레임 GL 오류 " + frameList[frame].error);
	check(frameList[frame].activeUnit === 3, frame + " 프레임 뒤 고른 유닛이 3 으로 돌아옴 (" + frameList[frame].activeUnit + ")");
	check(frameList[frame].isFirstUnitRestored, frame + " 프레임 뒤 유닛 0 의 텍스처가 돌아옴");
}
// 같은 차례로 그리는 프레임(2 부터)은 바탕색 유닛만 바뀐다. 그리기마다 유닛을 0 으로 되돌리지 않는다.
for (let frame = 2; frame < frameList.length; ++frame) {
	// 그림자 패스와 프레임의 적어 두기와 돌리기(유닛 3 에서 0 을 읽고 돌아옴) 다섯, 바탕색과 유닛 0 의 점광 그림자 처음 묶기 셋, 콜백 둘 앞뒤 셋, 합 열하나. (고치기 전 스물여섯)
	check(frameList[frame].activeTexture <= 12, frame + " 프레임 activeTexture 가 열둘 이하 (" + frameList[frame].activeTexture + ")");
	check(frameList[frame].bindTexture >= 8, frame + " 프레임 바탕색 텍스처는 그리기마다 묶음 (" + frameList[frame].bindTexture + ")");
}
// 단계 콜백과 onBeforeDraw 는 유닛 0 을 고른 채 부른다.
check(result.callbackUnitList.length === frameList.length * 2, "콜백을 프레임마다 둘 부름 (" + result.callbackUnitList.length + ")");
for (const unit of result.callbackUnitList) {
	check(unit === 0, "콜백이 유닛 0 을 고른 채 불림 (" + unit + ")");
}
console.log("툰 텍스처 유닛 크롬 시험 통과 (" + checkCount + " 개 확인)");
