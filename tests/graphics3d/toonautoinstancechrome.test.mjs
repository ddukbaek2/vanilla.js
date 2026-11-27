//==============================================================================
// 툰 그리기 줄 자동 인스턴싱의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/graphics3d/toonautoinstancechrome.test.mjs)
// - 헤드리스 크롬(창을 띄우지 않는다)에서 본다.
//   1. 같은 모형, 같은 재질 값(꼴 객체는 따로, 선 번호는 다름)의 불투명한 것은 몸, 바깥선 껍데기, 그림자 깊이, 선의 판을 인스턴스 그리기 하나로.
//      머티리얼(ToonMaterial)이나 모형이나 틴트가 다르거나 감기가 뒤집힌 것은 묶지 않는다. (인스턴스 수 목록으로 본다)
//   2. 화면은 묶지 않게 한 그리기 줄(꼴마다 다른 indexCount, 그리는 범위는 같음)과 바이트까지 같다. 비치는 것도 같이 담는다.
//   3. 묶음 자리는 행렬이 앞 프레임과 같으면 다시 올리지 않는다. (몸과 바깥선 껍데기는 같은 자리)
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

const SIZE = 96;
const server = http.createServer((request, response) => {
	const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
	if (requestPath === "/") {
		response.writeHead(200, { "Content-Type": "text/html" });
		response.end(`<!doctype html><title>autoinstance</title><body><canvas id="mainCanvas" width="${SIZE}" height="${SIZE}"></canvas><canvas id="referenceCanvas" width="${SIZE}" height="${SIZE}"></canvas></body>`);
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
	result = await page.evaluate(async (size) => {
		const { ToonRenderer, ToonDrawQueue, ToonScreenOutline, ToonMaterial, MeshBuilder, createBoxGeometry, createSphereGeometry, ShadowMap, ShadowUpdateMode, Camera3D, Matrix4, Vector3 } = await import("/import.js");
		// isReference 면 꼴마다 다른 indexCount 를 준다. (모형보다 커서 그리는 범위는 같고, 푼 칸이 달라 묶이지 않는다)
		const createSide = (canvasId, isReference) => {
			const gl = document.getElementById(canvasId).getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
			const side = { gl: gl, instanceCounts: [], plainDrawCount: 0, arrayUploadCount: 0 };
			const originalBufferData = gl.bufferData.bind(gl);
			gl.bufferData = (target, ...args) => {
				if (target === gl.ARRAY_BUFFER) {
					side.arrayUploadCount += 1;
				}
				return originalBufferData(target, ...args);
			};
			const originalInstanced = gl.drawElementsInstanced.bind(gl);
			gl.drawElementsInstanced = (mode, count, type, offset, instanceCount) => {
				side.instanceCounts.push(instanceCount);
				return originalInstanced(mode, count, type, offset, instanceCount);
			};
			const originalDraw = gl.drawElements.bind(gl);
			gl.drawElements = (...args) => {
				side.plainDrawCount += 1;
				return originalDraw(...args);
			};
			const renderer = new ToonRenderer(gl);
			const createMesh = (geometry) => {
				const builder = new MeshBuilder();
				builder.addPart(geometry, Matrix4.createIdentity(), "#e0d0c0", { hasOutline: true });
				return renderer.createMesh(builder.readArrays());
			};
			const boxMesh = createMesh(createBoxGeometry(0.5, 0.5, 0.5));
			const sphereMesh = createMesh(createSphereGeometry(0.3, 12, 8));
			const stripe = new ToonMaterial({ name: "autoStripe", surfaceChunk: "void applySurface(inout ToonSurface surface) { surface.baseColor *= 0.7; }" });
			const screenOutline = new ToonScreenOutline(gl);
			screenOutline.setWidth(1);
			const queue = new ToonDrawQueue();
			queue.setScreenOutline(screenOutline);
			const shadowMap = new ShadowMap(gl, 256);
			shadowMap.setUpdateMode(ShadowUpdateMode.everyFrame);
			shadowMap.updateLightMatrix(Vector3.create(0, 0, 0), Vector3.create(-0.3, -1, -0.2), 6, 0.1, 20);
			renderer.setShadow(shadowMap, 0.6);
			const camera = new Camera3D();
			camera.setPerspective(0.9, 0.1, 30);
			camera.setAspectRatio(1);
			camera.lookAt(Vector3.create(0, 4, 5), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
			// 담을 것: [모형, 꼴, 자리]. 상자 같은 꼴 여섯, 상자 다른 틴트 셋, 공 같은 꼴 셋, 상자 같은 꼴에 머티리얼 둘, 상자 뒤집은 감기 하나, 비치는 상자 하나.
			const plainLook = { tintColor: [0.9, 0.8, 0.7, 1] };
			const redLook = { tintColor: [1, 0.4, 0.4, 1] };
			const entryList = [];
			for (let index = 0; index < 6; ++index) {
				entryList.push([boxMesh, plainLook, null, false]);
			}
			for (let index = 0; index < 3; ++index) {
				entryList.push([boxMesh, redLook, null, false]);
				entryList.push([sphereMesh, plainLook, null, false]);
			}
			entryList.push([boxMesh, plainLook, stripe, false]);
			entryList.push([boxMesh, plainLook, stripe, false]);
			entryList.push([boxMesh, plainLook, null, true]);
			const itemList = entryList.map(([mesh, look, material, isMirrored], index) => {
				const modelMatrix = Matrix4.createTranslation((index % 5) * 0.9 - 1.8, 0.25, Math.floor(index / 5) * 0.9 - 1.2);
				modelMatrix.multiply(Matrix4.createRotationY(index * 0.4));
				if (isMirrored) {
					modelMatrix.multiply(Matrix4.createScale(-1, 1, 1));
				}
				const options = Object.assign({}, look, { lineId: 2 + index });
				if (material !== null) {
					options.material = material;
				}
				if (isReference) {
					options.indexCount = 100000 + index;
				}
				return { mesh: mesh, modelMatrix: modelMatrix, options: options };
			});
			const transparentOptions = { tintColor: [0.5, 0.8, 1, 1], alpha: 0.5, lineId: 40 };
			const groundOptions = { lineId: 1, hasScreenOutline: false };
			const groundBuilder = new MeshBuilder();
			groundBuilder.addPart(createBoxGeometry(6, 0.1, 5), Matrix4.createTranslation(0, -0.05, 0), "#808890", { hasOutline: false });
			const groundMesh = renderer.createMesh(groundBuilder.readArrays());
			side.drawFrame = () => {
				side.instanceCounts.length = 0;
				side.plainDrawCount = 0;
				side.arrayUploadCount = 0;
				queue.clear();
				queue.addMesh(groundMesh, Matrix4.createIdentity(), groundOptions);
				for (const item of itemList) {
					queue.addMesh(item.mesh, item.modelMatrix, item.options);
				}
				queue.addMesh(boxMesh, Matrix4.createTranslation(0.4, 0.6, 0.6), transparentOptions);
				queue.drawShadows(renderer, shadowMap);
				queue.draw(renderer, camera);
				gl.finish();
				const pixels = new Uint8Array(size * size * 4);
				gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
				return pixels;
			};
			return side;
		};
		const main = createSide("mainCanvas", false);
		const reference = createSide("referenceCanvas", true);
		const frames = [];
		for (let frame = 0; frame < 3; ++frame) {
			const mainPixels = main.drawFrame();
			const referencePixels = reference.drawFrame();
			let differentCount = 0;
			for (let index = 0; index < mainPixels.length; ++index) {
				if (mainPixels[index] !== referencePixels[index]) {
					differentCount += 1;
				}
			}
			let litCount = 0;
			for (let index = 0; index < mainPixels.length; index += 4) {
				if (mainPixels[index] + mainPixels[index + 1] + mainPixels[index + 2] > 30) {
					litCount += 1;
				}
			}
			frames.push({ differentCount: differentCount, litCount: litCount, mainInstanceCounts: [...main.instanceCounts], referenceInstanceCounts: [...reference.instanceCounts], mainPlainCount: main.plainDrawCount, referencePlainCount: reference.plainDrawCount, mainUploadCount: main.arrayUploadCount });
		}
		return { frames: frames, error: main.gl.getError() + reference.gl.getError() };
	}, SIZE);
}
finally {
	await browser.close();
	server.close();
}
// 그림자, 몸, 바깥선 껍데기는 [상자 같은 꼴 6, 상자 빨강 3, 공 3, 상자 머티리얼 2], 선의 판은 [상자 11 (머티리얼과 틴트는 선의 판과 상관없음), 공 3].
const EXPECTED_INSTANCE_COUNTS = [11, 6, 6, 6, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2];
for (let frame = 0; frame < result.frames.length; ++frame) {
	const entry = result.frames[frame];
	const sorted = [...entry.mainInstanceCounts].sort((first, second) => second - first);
	check(sorted.join() === EXPECTED_INSTANCE_COUNTS.join(), frame + " 프레임 묶음: 같은 모형과 재질 값만 묶고 머티리얼, 모형, 틴트, 뒤집은 감기가 다르면 묶지 않음 (" + sorted.join() + ")");
	check(entry.referenceInstanceCounts.length === 0, frame + " 프레임 비교 쪽은 묶지 않음 (" + entry.referenceInstanceCounts.join() + ")");
	check(entry.mainPlainCount + entry.mainInstanceCounts.length < entry.referencePlainCount, frame + " 프레임 그리기 수가 준다 (" + (entry.mainPlainCount + entry.mainInstanceCounts.length) + " < " + entry.referencePlainCount + ")");
	check(entry.litCount > 1000, frame + " 프레임 무언가 그렸다 (" + entry.litCount + ")");
	check(entry.differentCount === 0, frame + " 프레임 화면이 묶지 않고 그린 것과 바이트까지 같음 (다른 바이트 " + entry.differentCount + ")");
}
// 묶음 자리는 값이 같으면 다시 올리지 않는다. (몸, 그림자 묶음 넷씩 여덟, 바깥선 껍데기는 몸의 자리를 같이 씀, 선의 판 둘도 자기 묶음 자리라 올리지 않음)
check(result.frames[1].mainUploadCount === result.frames[0].mainUploadCount - 10 && result.frames[2].mainUploadCount === result.frames[1].mainUploadCount, "같은 행렬이면 묶음 자리를 다시 올리지 않음 (" + result.frames.map((entry) => entry.mainUploadCount).join(", ") + ")");
check(result.error === 0, "GL 오류 없음 (" + result.error + ")");
console.log("툰 자동 인스턴싱 크롬 시험 통과 (" + checkCount + " 개 확인)");
