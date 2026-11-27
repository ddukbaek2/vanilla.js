//==============================================================================
// 그림자 갱신 방식의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/graphics3d/shadowcachechrome.test.mjs)
// - 헤드리스 크롬(창을 띄우지 않는다)에서 같은 그리기 줄을 해 그림자와 점광 그림자 판 두 벌에 그린다. 한 벌은 everyFrame, 한 벌은 onChange.
//   상자는 움직이다 서고(구워질 만큼 오래) 다시 움직이고, 인스턴스 하나가 한 번 옮겨 가고, 해와 점광이 한 번씩 움직이고, 모형 하나가 빠졌다 돌아온다.
//   프레임마다 두 벌로 장면을 그려 화소가 모두 같은지 본다. (onChange 의 그림자가 한 프레임도 늦게 따라오지 않는다)
// - 모두 그대로인 프레임은 onChange 가 그림자 깊이를 하나도 그리지 않고, 움직이는 것만 있는 프레임은 그것만 그리는지 셈한다.
// - 가위 시험을 켠 채(2D 자르기 안의 바깥 패스처럼) beginRender 를 불러도 해 그림자 판과 점광 판 모두 가위를 끄고 판 전체를 비우는지 본다.
// - interval 4 는 0, 4, 8 프레임에만 그리고 그 프레임의 화면이 everyFrame 과 같은지 본다.
//   puppeteer-core 나 크롬이 없으면 실패한다. (말없이 건너뛰지 않는다)
//==============================================================================
const System = globalThis;
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";
import { gotoPage } from "../chromepage.mjs";

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
		response.end("<!doctype html><title>shadowcache</title><body><canvas id=\"canvas\" width=\"160\" height=\"120\"></canvas></body>");
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
let result = null;
try {
	const page = await browser.newPage();
	await gotoPage(page, "http://127.0.0.1:" + port + "/");
	result = await page.evaluate(async () => {
		const { ToonRenderer, ToonDrawQueue, MeshBuilder, createBoxGeometry, createSphereGeometry, createOctahedronGeometry, ShadowMap, ShadowAtlas, ShadowUpdateMode, Matrix4, Vector3, Camera3D } = await import("/import.js");
		const canvas = document.getElementById("canvas");
		const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
		const renderer = new ToonRenderer(gl);
		const createMesh = (geometry, color) => {
			const builder = new MeshBuilder();
			builder.addPart(geometry, Matrix4.createIdentity(), color, { hasOutline: false });
			return renderer.createMesh(builder.readArrays());
		};
		const groundMesh = createMesh(createBoxGeometry(8, 0.2, 8), "#a0a8b0");
		const boxMesh = createMesh(createBoxGeometry(0.6, 0.8, 0.6), "#e0a070");
		const ballMesh = createMesh(createSphereGeometry(0.35, 16, 12), "#80c0e0");
		const pebbleMesh = createMesh(createOctahedronGeometry(0.2), "#c0b090");
		const camera = new Camera3D();
		camera.setPerspective(0.9, 0.1, 50);
		camera.setAspectRatio(160 / 120);
		camera.lookAt(Vector3.create(0, 4, 5), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
		const everyShadowMap = new ShadowMap(gl, 512);
		const changeShadowMap = new ShadowMap(gl, 512);
		const intervalShadowMap = new ShadowMap(gl, 512);
		everyShadowMap.setUpdateMode(ShadowUpdateMode.everyFrame);
		changeShadowMap.setUpdateMode(ShadowUpdateMode.onChange);
		intervalShadowMap.setUpdateMode(ShadowUpdateMode.interval, 4);
		const everyAtlas = new ShadowAtlas(gl, 512);
		const changeAtlas = new ShadowAtlas(gl, 512);
		everyAtlas.setUpdateMode(ShadowUpdateMode.everyFrame);
		const queue = new ToonDrawQueue();
		const pixels = new Uint8Array(160 * 120 * 4);
		const readFrame = () => {
			gl.readPixels(0, 0, 160, 120, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
			return pixels.slice();
		};
		const isSame = (first, second) => {
			for (let index = 0; index < first.length; ++index) {
				if (first[index] !== second[index]) {
					return false;
				}
			}
			return true;
		};
		// 그림자 깊이를 그린 수 세기. (drawElements 와 drawElementsInstanced)
		let drawCount = 0;
		const originalDrawElements = gl.drawElements.bind(gl);
		const originalDrawElementsInstanced = gl.drawElementsInstanced.bind(gl);
		gl.drawElements = (...args) => {
			drawCount += 1;
			return originalDrawElements(...args);
		};
		gl.drawElementsInstanced = (...args) => {
			drawCount += 1;
			return originalDrawElementsInstanced(...args);
		};
		const renderScene = (shadowMap, shadowAtlas) => {
			renderer.setShadow(shadowMap, 0.7);
			renderer.setLocalShadows(shadowAtlas, 1);
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.viewport(0, 0, 160, 120);
			gl.clearColor(0.1, 0.1, 0.1, 1);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			queue.draw(renderer, camera);
			return readFrame();
		};
		const frameList = [];
		let lightPosition = [-1.5, 2.5, 1];
		let sunDirection = Vector3.create(-0.5, -1, -0.4);
		for (let frame = 0; frame < 110; ++frame) {
			// 상자: 0 ~ 9 움직임, 10 ~ 59 섬(40 에 구워짐), 60 ~ 69 움직임, 그 뒤 섬.
			const boxX = frame < 10 ? -1 + frame * 0.1 : (frame < 60 ? 0 : (frame < 70 ? (frame - 60) * 0.08 : 0.8));
			// 인스턴스 하나는 90 에 옮겨 간다. 공은 95 ~ 99 에 빠진다.
			const pebbleList = [];
			for (let index = 0; index < 5; ++index) {
				const offset = index === 2 && frame >= 90 ? 0.6 : 0;
				pebbleList.push({ modelMatrix: Matrix4.createTranslation(-2 + index, 0.2, 1.5 + offset), tintColor: [1, 1, 1, 1] });
			}
			if (frame === 75) {
				sunDirection = Vector3.create(0.4, -1, -0.5);
			}
			if (frame === 82) {
				lightPosition = [1.2, 2.2, 0.5];
			}
			renderer.setPointLights([{ position: lightPosition, color: [1, 0.9, 0.7], intensity: 3, range: 8, castsShadow: true }]);
			everyAtlas.updateLights(renderer.getLightSet().getPointLights());
			changeAtlas.updateLights(renderer.getLightSet().getPointLights());
			everyShadowMap.updateLightMatrix(Vector3.create(0, 0, 0), sunDirection, 4, 0.1, 20);
			changeShadowMap.updateLightMatrix(Vector3.create(0, 0, 0), sunDirection, 4, 0.1, 20);
			intervalShadowMap.updateLightMatrix(Vector3.create(0, 0, 0), sunDirection, 4, 0.1, 20);
			queue.clear();
			queue.addMesh(groundMesh, Matrix4.createTranslation(0, -0.1, 0));
			queue.addMesh(boxMesh, Matrix4.createTranslation(boxX, 0.4, 0));
			if (frame < 95 || frame >= 100) {
				queue.addMesh(ballMesh, Matrix4.createTranslation(-1, 0.35, -1));
			}
			queue.addMeshInstanced(pebbleMesh, pebbleList);
			queue.drawShadows(renderer, everyShadowMap);
			queue.drawLocalShadows(renderer, everyAtlas);
			const everyPixels = renderScene(everyShadowMap, everyAtlas);
			drawCount = 0;
			queue.drawShadows(renderer, changeShadowMap);
			queue.drawLocalShadows(renderer, changeAtlas);
			const changeDrawCount = drawCount;
			const changePixels = renderScene(changeShadowMap, changeAtlas);
			drawCount = 0;
			queue.drawShadows(renderer, intervalShadowMap);
			const intervalDrawCount = drawCount;
			const intervalPixels = frame % 4 === 0 ? renderScene(intervalShadowMap, everyAtlas) : null;
			let litCount = 0;
			for (let index = 0; index < everyPixels.length; index += 4) {
				litCount += everyPixels[index] + everyPixels[index + 1] + everyPixels[index + 2] > 120 ? 1 : 0;
			}
			frameList.push({ frame: frame, isSame: isSame(everyPixels, changePixels), isIntervalSame: intervalPixels === null ? null : isSame(everyPixels, intervalPixels), changeDrawCount: changeDrawCount, intervalDrawCount: intervalDrawCount, litCount: litCount, error: gl.getError() });
		}
		// 가위 시험을 켠 채 beginRender. (판 전체를 비우고 그려야 한다, 해 그림자 판과 점광 판 같게)
		const scissorResult = {};
		for (const [name, shadowTarget] of [["shadowMap", everyShadowMap], ["shadowAtlas", everyAtlas]]) {
			gl.enable(gl.SCISSOR_TEST);
			gl.scissor(0, 0, 8, 8);
			shadowTarget.beginRender();
			scissorResult[name] = gl.isEnabled(gl.SCISSOR_TEST);
			gl.disable(gl.SCISSOR_TEST);
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		}
		// 움직이는 상자의 그림자가 화면에 드러나는지. (이 시험이 그림자 차이를 볼 수 있는지)
		return { frameList: frameList, scissorResult: scissorResult };
	});
	await page.close();
}
finally {
	await browser.close();
	server.close();
}

const frameList = result.frameList;
for (const frame of frameList) {
	check(frame.error === 0, frame.frame + " 프레임 GL 오류 " + frame.error);
	check(frame.litCount > 1000, frame.frame + " 프레임 장면이 그려짐 (" + frame.litCount + ")");
	check(frame.isSame, frame.frame + " 프레임 onChange 화면이 everyFrame 과 같음");
	if (frame.isIntervalSame !== null) {
		check(frame.isIntervalSame, frame.frame + " 프레임 interval 화면이 everyFrame 과 같음");
	}
	check((frame.intervalDrawCount > 0) === (frame.frame % 4 === 0), frame.frame + " 프레임 interval 4 는 네 프레임마다만 그림 (" + frame.intervalDrawCount + ")");
}
// 다 그대로인 프레임(45 ~ 59, 상자가 40 에 구워진 뒤)은 하나도 그리지 않는다.
for (let frame = 45; frame < 60; ++frame) {
	check(frameList[frame].changeDrawCount === 0, frame + " 프레임 onChange 가 그리지 않음 (" + frameList[frame].changeDrawCount + ")");
}
// 상자만 움직이는 프레임(62 ~ 69)은 상자만 그린다. (해 하나와 점광 여섯 칸, 칸 밖은 걸러져 그보다 적을 수 있다)
for (let frame = 62; frame < 70; ++frame) {
	check(frameList[frame].changeDrawCount > 0 && frameList[frame].changeDrawCount <= 7, frame + " 프레임 onChange 는 움직이는 것만 그림 (" + frameList[frame].changeDrawCount + ")");
}
// 첫 프레임은 전부 그린다.
check(frameList[0].changeDrawCount > 7, "첫 프레임은 전부 그림 (" + frameList[0].changeDrawCount + ")");
// 상자가 움직인 프레임끼리는 화면이 다르다. (그림자 차이를 보는 시험인지)
check(result.scissorResult.shadowMap === false, "ShadowMap.beginRender 가 가위 시험을 끔");
check(result.scissorResult.shadowAtlas === false, "ShadowAtlas.beginRender 가 가위 시험을 끔");
console.log("그림자 갱신 방식 크롬 시험 통과 (" + checkCount + " 개 확인)");
