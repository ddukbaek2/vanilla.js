//==============================================================================
// 그림자 캐시가 재질 값에 다시 굽지 않는지 보는 크롬 시험. (NODE_PATH=$(npm root -g) node tests/graphics3d/shadowcasterorderchrome.test.mjs)
// - 헤드리스 크롬(창을 띄우지 않는다)에서 같은 모형 셋을 나눠 쓰는 드리우개 스물넷을 해 그림자 판 두 벌(everyFrame, onChange)에 그린다.
//   꼴 하나의 틴트가 매 프레임 바뀐다. (재질 블록이 바뀌어 불투명한 것의 정렬 차례가 바뀐다)
//   틴트는 그림자 깊이에 닿지 않으므로 onChange 는 다시 굽지 않아야 한다. (언리얼, HDRP 캐시 그림자처럼 드리우개는 물체마다 변환, 모형, 뼈대로 견준다)
// - 40 ~ 79 프레임(틴트만 바뀜)은 드리우개가 모두 구운 것이고 그림자 깊이를 하나도 그리지 않는다. (고치기 전에는 바닥 말고는 굽지 못해 매 프레임 다 그렸다)
//   80 프레임에 구운 상자 하나가 움직이기 시작하면 그 프레임에 다시 굽는다. 81 ~ 109 프레임은 다시 굽지 않고 그 상자만 덧그린다.
// - 프레임마다 두 벌로 장면을 그려 화소가 모두 같은지 본다. (onChange 의 그림자가 everyFrame 과 같다)
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
		response.end("<!doctype html><title>shadowcasterorder</title><body><canvas id=\"canvas\" width=\"200\" height=\"150\"></canvas></body>");
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
		const { ToonRenderer, ToonDrawQueue, MeshBuilder, createBoxGeometry, createSphereGeometry, createOctahedronGeometry, ShadowMap, ShadowUpdateMode, Matrix4, Vector3, Camera3D } = await import("/import.js");
		const width = 200;
		const height = 150;
		const canvas = document.getElementById("canvas");
		const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
		const renderer = new ToonRenderer(gl);
		const createMesh = (geometry, color) => {
			const builder = new MeshBuilder();
			builder.addPart(geometry, Matrix4.createIdentity(), color, { hasOutline: false });
			return renderer.createMesh(builder.readArrays());
		};
		const groundMesh = createMesh(createBoxGeometry(10, 0.2, 10), "#a0a8b0");
		const meshList = [createMesh(createBoxGeometry(0.5, 0.9, 0.5), "#e0a070"), createMesh(createSphereGeometry(0.3, 16, 12), "#80c0e0"), createMesh(createOctahedronGeometry(0.3), "#c0b090")];
		const camera = new Camera3D();
		camera.setPerspective(0.9, 0.1, 50);
		camera.setAspectRatio(width / height);
		camera.lookAt(Vector3.create(0, 6, 7), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
		const everyShadowMap = new ShadowMap(gl, 512);
		const changeShadowMap = new ShadowMap(gl, 512);
		everyShadowMap.setUpdateMode(ShadowUpdateMode.everyFrame);
		changeShadowMap.setUpdateMode(ShadowUpdateMode.onChange);
		const sunDirection = Vector3.create(-0.5, -1, -0.4);
		everyShadowMap.updateLightMatrix(Vector3.create(0, 0, 0), sunDirection, 6, 0.1, 20);
		changeShadowMap.updateLightMatrix(Vector3.create(0, 0, 0), sunDirection, 6, 0.1, 20);
		const queue = new ToonDrawQueue();
		// onChange 가 구운 판을 다시 구운 수 세기. (그림자 패스의 판이 cache 인 것)
		let bakeCount = 0;
		const originalDrawShadowPass = queue.drawShadowPass.bind(queue);
		queue.drawShadowPass = (renderer, shadowCache, renderTarget, itemList, shadowMap, shadowAtlas) => {
			if (shadowCache === changeShadowMap.getShadowCache() && renderTarget === "cache") {
				bakeCount += 1;
			}
			return originalDrawShadowPass(renderer, shadowCache, renderTarget, itemList, shadowMap, shadowAtlas);
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
		const pixels = new Uint8Array(width * height * 4);
		const readFrame = () => {
			gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
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
		const renderScene = (shadowMap) => {
			renderer.setShadow(shadowMap, 0.7);
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.viewport(0, 0, width, height);
			gl.clearColor(0.1, 0.1, 0.1, 1);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			queue.draw(renderer, camera);
			return readFrame();
		};
		// 드리우개: 6 x 4 칸, 모형 셋을 돌려 쓰고 꼴(틴트) 넷을 돌려 쓴다. 꼴 0 의 틴트가 매 프레임 바뀐다.
		const tintList = [[1, 0.7, 0.7, 1], [0.7, 1, 0.7, 1], [0.7, 0.7, 1, 1], [1, 1, 0.6, 1]];
		const frameList = [];
		let previousPixels = null;
		for (let frame = 0; frame < 120; ++frame) {
			queue.clear();
			queue.addMesh(groundMesh, Matrix4.createTranslation(0, -0.1, 0));
			for (let index = 0; index < 24; ++index) {
				const column = index % 6;
				const row = Math.floor(index / 6);
				// 7 번(구운 상자)은 80 ~ 84 프레임에 움직이고 그 뒤 선다.
				const offset = index === 7 && frame >= 80 ? Math.min(frame - 79, 5) * 0.1 : 0;
				const look = index % 4;
				const tintColor = look === 0 ? [0.5 + 0.5 * ((frame % 8) / 8), 0.6, 0.6, 1] : tintList[look];
				queue.addMesh(meshList[index % 3], Matrix4.createTranslation(-3 + column * 1.2 + offset, 0.45, -2 + row * 1.3), { tintColor: tintColor, tintAmount: 0.6 });
			}
			queue.drawShadows(renderer, everyShadowMap);
			const everyPixels = renderScene(everyShadowMap);
			bakeCount = 0;
			drawCount = 0;
			queue.drawShadows(renderer, changeShadowMap);
			const changeBakeCount = bakeCount;
			const changeDrawCount = drawCount;
			let staticCount = 0;
			for (const record of changeShadowMap.getShadowCache().casterRecords) {
				staticCount += record.isStatic ? 1 : 0;
			}
			const changePixels = renderScene(changeShadowMap);
			let litCount = 0;
			for (let index = 0; index < everyPixels.length; index += 4) {
				litCount += everyPixels[index] + everyPixels[index + 1] + everyPixels[index + 2] > 120 ? 1 : 0;
			}
			frameList.push({ frame: frame, isSame: isSame(everyPixels, changePixels), isTintVisible: previousPixels === null ? true : !isSame(previousPixels, everyPixels), bakeCount: changeBakeCount, drawCount: changeDrawCount, staticCount: staticCount, litCount: litCount, error: gl.getError() });
			previousPixels = everyPixels;
		}
		return { frameList: frameList };
	});
	await page.close();
}
finally {
	await browser.close();
	server.close();
}

const frameList = result.frameList;
if (process.env.SHADOW_ORDER_TRACE === "1") {
	console.log(frameList.map((frame) => frame.frame + ":" + frame.bakeCount + "/" + frame.drawCount + "/" + frame.staticCount).join(" "));
}
for (const frame of frameList) {
	check(frame.error === 0, frame.frame + " 프레임 GL 오류 " + frame.error);
	check(frame.litCount > 1000, frame.frame + " 프레임 장면이 그려짐 (" + frame.litCount + ")");
	check(frame.isSame, frame.frame + " 프레임 onChange 화면이 everyFrame 과 같음");
}
// 틴트가 화면에 드러나는지. (이 시험이 틴트를 실제로 바꾸는지)
check(frameList[50].isTintVisible, "50 프레임의 틴트가 49 프레임과 다르게 보임");
// 처음 30 프레임 안에 한 번 굽는다. (드리우개가 모두 그대로 30 프레임)
let warmBakeCount = 0;
for (let frame = 0; frame < 40; ++frame) {
	warmBakeCount += frameList[frame].bakeCount;
}
check(warmBakeCount === 1, "처음 40 프레임에 한 번 구움 (" + warmBakeCount + ")");
// 틴트만 바뀌는 프레임은 다시 굽지 않는다.
let tintBakeCount = 0;
for (let frame = 40; frame < 80; ++frame) {
	tintBakeCount += frameList[frame].bakeCount;
}
check(tintBakeCount === 0, "틴트만 바뀌는 40 ~ 79 프레임에 다시 굽지 않음 (" + tintBakeCount + ")");
// 틴트만 바뀌는 프레임은 드리우개 스물다섯(바닥과 스물넷)이 모두 구운 것이고 그림자 깊이를 하나도 그리지 않는다.
for (let frame = 40; frame < 80; ++frame) {
	check(frameList[frame].staticCount === 25, frame + " 프레임 드리우개가 모두 구운 것 (" + frameList[frame].staticCount + ")");
	check(frameList[frame].drawCount === 0, frame + " 프레임 onChange 가 그림자 깊이를 그리지 않음 (" + frameList[frame].drawCount + ")");
}
// 구운 상자가 움직이기 시작한 프레임은 다시 굽는다.
check(frameList[80].bakeCount === 1, "구운 상자가 움직인 80 프레임에 다시 구움 (" + frameList[80].bakeCount + ")");
let moveBakeCount = 0;
for (let frame = 81; frame < 110; ++frame) {
	moveBakeCount += frameList[frame].bakeCount;
}
check(moveBakeCount === 0, "움직이고 선 뒤 굽기 전 81 ~ 109 프레임에 다시 굽지 않음 (" + moveBakeCount + ")");
// 움직인 상자만 덧그린다. (구운 판을 옮기고 상자 하나)
for (let frame = 81; frame < 110; ++frame) {
	check(frameList[frame].drawCount === 1 && frameList[frame].staticCount === 24, frame + " 프레임 움직인 상자만 덧그림 (" + frameList[frame].drawCount + ", " + frameList[frame].staticCount + ")");
}
console.log("그림자 드리우개 차례 크롬 시험 통과 (" + checkCount + " 개 확인)");
