//==============================================================================
// 툰 모서리 어둠(화면 공간 AO)의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/graphics3d/toonambientocclusionchrome.test.mjs)
// - 헤드리스 크롬(창을 띄우지 않는다)에서 방 구석(바닥, 뒷벽, 왼벽), 상자, 다리 둘 달린 로봇을 ToonDrawQueue 와 ToonPostProcess 로 그린다. (원근과 직교)
// - 꺼짐: 켠 적 없음, 켰다 끔 모두 화소가 같다. TOON_AO_BASE_PATH(고치기 전 저장소)를 주면 그 저장소의 같은 장면과 바이트까지 같다.
// - 켬: 벽과 바닥이 만나는 곳, 상자 옆 바닥, 로봇 발밑이 어두워지고 트인 바닥은 거의 그대로다. 해 칸 경계(로봇 몸의 밝기 단계)는 그 자리 그대로다.
// - 직접 빛 몫(setAmbientOcclusion 다섯째 인자) 0 은 고치기 전의 켬과 바이트까지 같고, 0.25, 0.5, 1 로 갈수록 해가 비추는 구석이 더 어두워진다.
//   트인 바닥과 로봇 머리(해 칸 경계)는 몫을 올려도 끔과 바이트까지 같다.
//   바깥선(ToonScreenOutline)을 켠 장면은 그 선의 판을 다시 쓰고, 끈 장면은 후처리의 미리 그리기(선 없이 선의 판만)를 쓴다. 둘의 모서리 어둠 판은 같다.
//   TOON_AO_PICTURE_PATH 를 주면 전, 후, AO 판 그림을 그 폴더에 .png 로 남긴다.
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
const basePath = process.env.TOON_AO_BASE_PATH ? path.resolve(process.env.TOON_AO_BASE_PATH) : null;
const picturePath = process.env.TOON_AO_PICTURE_PATH ? path.resolve(process.env.TOON_AO_PICTURE_PATH) : null;
const contentTypeTable = { ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".html": "text/html" };
const WIDTH = 640;
const HEIGHT = 360;
let checkCount = 0;
function check(condition, message) {
	checkCount++;
	if (!condition) {
		throw new System.Error("시험 실패: " + message);
	}
}

// 저장소를 잠깐 내주는 http 서버. (/base/ 아래는 고치기 전 저장소)
const server = http.createServer((request, response) => {
	let requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
	if (requestPath === "/") {
		response.writeHead(200, { "Content-Type": "text/html" });
		response.end("<!doctype html><title>ambient occlusion</title><body></body>");
		return;
	}
	let rootPath = repositoryPath;
	if (requestPath.startsWith("/base/") && basePath !== null) {
		rootPath = basePath;
		requestPath = requestPath.slice(5);
	}
	const filePath = path.join(rootPath, requestPath);
	if (!filePath.startsWith(rootPath) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
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

// 페이지 안에서 장면을 그리고 화소를 돌려준다. (modulePath 의 import.js, 고치기 전 저장소는 모서리 어둠 함수가 없다)
const renderScene = async (page, modulePath, cases) => {
	return page.evaluate(async (modulePath, cases, width, height) => {
		const engine = await import(modulePath);
		const { ToonRenderer, ToonPostProcess, ToonDrawQueue, ToonScreenOutline, MeshBuilder, createBoxGeometry, createSphereGeometry, createCylinderGeometry, Matrix4, Vector3 } = engine;
		const canvas = Object.assign(document.createElement("canvas"), { width: width, height: height });
		document.body.appendChild(canvas);
		const webGL2RenderingContext = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
		const postProcess = new ToonPostProcess(webGL2RenderingContext, width, height, { depthBits: 24 });
		postProcess.setBloom(false, 0, 1, 2);
		const renderer = new ToonRenderer(webGL2RenderingContext);
		renderer.setHdrOutput(postProcess.getUseFloatColor());
		renderer.setLight([-0.45, -1, -0.35], [1.6, 1.5, 1.35], [0.55, 0.6, 0.75], [0.3, 0.27, 0.24]);
		renderer.setBandCount(3);
		const outline = new ToonScreenOutline(webGL2RenderingContext);
		outline.setWidth(2);
		outline.setHdrOutput(postProcess.getUseFloatColor());
		const createMesh = (parts) => {
			const builder = new MeshBuilder();
			for (const part of parts) {
				builder.addPart(part[0], part[1], part[2], { hasOutline: false });
			}
			return renderer.createMesh(builder.readArrays());
		};
		const floorMesh = createMesh([[createBoxGeometry(8, 0.2, 8), Matrix4.createTranslation(0, -0.1, 0), "#b8b0a4"]]);
		const wallMesh = createMesh([[createBoxGeometry(8, 3, 0.2), Matrix4.createTranslation(0, 1.5, -2.1), "#a8b4c0"], [createBoxGeometry(0.2, 3, 8), Matrix4.createTranslation(-2.1, 1.5, 0), "#a8b4c0"]]);
		const crateMesh = createMesh([[createBoxGeometry(0.8, 0.8, 0.8), Matrix4.createTranslation(0.6, 0.4, -0.6), "#c89060"]]);
		const robotMesh = createMesh([
			[createSphereGeometry(0.38, 32, 20), Matrix4.createTranslation(-0.6, 1.05, 0.6), "#e0e4ea"],
			[createCylinderGeometry(0.07, 0.07, 0.62, 16), Matrix4.createTranslation(-0.75, 0.37, 0.6), "#707880"],
			[createCylinderGeometry(0.07, 0.07, 0.62, 16), Matrix4.createTranslation(-0.45, 0.37, 0.6), "#707880"],
			[createBoxGeometry(0.16, 0.06, 0.24), Matrix4.createTranslation(-0.75, 0.03, 0.64), "#505860"],
			[createBoxGeometry(0.16, 0.06, 0.24), Matrix4.createTranslation(-0.45, 0.03, 0.64), "#505860"],
		]);
		const queue = new ToonDrawQueue();
		const hasPostProcessQueue = typeof queue.setPostProcess === "function";
		const eye = Vector3.create(3.2, 3.0, 4.2);
		const target = Vector3.create(-0.2, 0.3, -0.4);
		const viewMatrix = Matrix4.createLookAt(eye, target, Vector3.create(0, 1, 0));
		const perspectiveMatrix = Matrix4.createPerspective(0.75, width / height, 0.1, 40);
		const orthographicHeight = 2.6;
		const orthographicMatrix = Matrix4.createOrthographic(-orthographicHeight * width / height, orthographicHeight * width / height, -orthographicHeight, orthographicHeight, 0.1, 40);
		const project = (projectionMatrix, point) => {
			const matrix = projectionMatrix.clone();
			matrix.multiply(viewMatrix);
			const elements = matrix.getElements();
			const clipX = elements[0] * point[0] + elements[4] * point[1] + elements[8] * point[2] + elements[12];
			const clipY = elements[1] * point[0] + elements[5] * point[1] + elements[9] * point[2] + elements[13];
			const clipW = elements[3] * point[0] + elements[7] * point[1] + elements[11] * point[2] + elements[15];
			return [Math.floor((clipX / clipW * 0.5 + 0.5) * width), Math.floor((clipY / clipW * 0.5 + 0.5) * height)];
		};
		// 화소는 base64 글로 돌려준다. (배열로는 CDP 가 돌려주지 못하는 크기)
		const encodePixels = (pixels) => {
			let text = "";
			for (let index = 0; index < pixels.length; index += 32768) {
				text += String.fromCharCode.apply(null, pixels.subarray(index, index + 32768));
			}
			return btoa(text);
		};
		const readPixels = () => {
			const pixels = new Uint8Array(width * height * 4);
			webGL2RenderingContext.readPixels(0, 0, width, height, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, pixels);
			return pixels;
		};
		const readAmbientOcclusionPixels = () => {
			const texture = postProcess.getAmbientOcclusionTexture();
			const framebuffer = webGL2RenderingContext.createFramebuffer();
			webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, framebuffer);
			webGL2RenderingContext.framebufferTexture2D(webGL2RenderingContext.FRAMEBUFFER, webGL2RenderingContext.COLOR_ATTACHMENT0, webGL2RenderingContext.TEXTURE_2D, texture, 0);
			const pixels = readPixels();
			webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, null);
			webGL2RenderingContext.deleteFramebuffer(framebuffer);
			const gray = new Uint8Array(width * height * 4);
			for (let index = 0; index < width * height; index++) {
				gray[index * 4] = gray[index * 4 + 1] = gray[index * 4 + 2] = pixels[index * 4];
				gray[index * 4 + 3] = 255;
			}
			return gray;
		};
		const drawFrame = (projectionMatrix, hasOutline) => {
			queue.clear();
			queue.setScreenOutline(hasOutline ? outline : null);
			if (hasPostProcessQueue) {
				queue.setPostProcess(postProcess);
			}
			queue.addMesh(floorMesh, Matrix4.createIdentity(), { lineId: 1, hasScreenOutline: false });
			queue.addMesh(wallMesh, Matrix4.createIdentity(), { lineId: 2, hasScreenOutline: false });
			queue.addMesh(crateMesh, Matrix4.createIdentity(), { lineId: 3 });
			queue.addMesh(robotMesh, Matrix4.createIdentity(), { lineId: 4 });
			postProcess.begin([0.1, 0.1, 0.12]);
			queue.drawWithMatrices(renderer, viewMatrix, projectionMatrix);
			postProcess.end(null, [0, 0, width, height]);
		};
		const result = { captures: {}, probes: {}, pictures: {} };
		for (const caseItem of cases) {
			const projectionMatrix = caseItem.isOrthographic ? orthographicMatrix : perspectiveMatrix;
			if (hasPostProcessQueue) {
				postProcess.setAmbientOcclusion(caseItem.isEnabled, 0.5, 0.5, 0.5, caseItem.directLightingStrength ?? 0);
			}
			drawFrame(projectionMatrix, caseItem.hasOutline);
			const pixels = readPixels();
			result.captures[caseItem.name] = encodePixels(pixels);
			if (caseItem.hasPicture) {
				result.pictures[caseItem.name] = canvas.toDataURL("image/png");
			}
			if (caseItem.isEnabled && caseItem.hasAmbientOcclusionPicture) {
				const gray = readAmbientOcclusionPixels();
				result.captures[caseItem.name + "Occlusion"] = encodePixels(gray);
				const pictureCanvas = Object.assign(document.createElement("canvas"), { width: width, height: height });
				const context = pictureCanvas.getContext("2d");
				const imageData = context.createImageData(width, height);
				for (let row = 0; row < height; row++) {
					imageData.data.set(gray.subarray((height - 1 - row) * width * 4, (height - row) * width * 4), row * width * 4);
				}
				context.putImageData(imageData, 0, 0);
				result.pictures[caseItem.name + "Occlusion"] = pictureCanvas.toDataURL("image/png");
			}
			result.probes[caseItem.name] = {
				wallCorner: project(projectionMatrix, [1.2, 0.02, -1.96]),
				leftCorner: project(projectionMatrix, [-1.96, 0.02, -0.2]),
				crateSide: project(projectionMatrix, [1.03, 0.01, -0.3]),
				robotFoot: project(projectionMatrix, [-0.6, 0.01, 0.64]),
				openFloor: project(projectionMatrix, [1.7, 0.0, 1.4]),
				robotHead: project(projectionMatrix, [-0.6, 1.05, 0.6]),
			};
		}
		// 비용: 같은 장면을 켜고 끄고 20 프레임씩. (readPixels 로 끝을 기다린 벽시계 시간, GPU 시간 재기가 있으면 그것도)
		if (hasPostProcessQueue) {
			const timerExtension = webGL2RenderingContext.getExtension("EXT_disjoint_timer_query_webgl2");
			const measure = (isEnabled) => {
				postProcess.setAmbientOcclusion(isEnabled, 0.5, 0.5, 0.5);
				drawFrame(perspectiveMatrix, false);
				readPixels();
				const start = performance.now();
				for (let frame = 0; frame < 20; frame++) {
					drawFrame(perspectiveMatrix, false);
				}
				readPixels();
				return (performance.now() - start) / 20;
			};
			result.timing = { off: measure(false), on: measure(true), off2: measure(false), on2: measure(true), hasTimer: timerExtension !== null };
			// 한 프레임의 GL 호출 수. (컨텍스트의 함수를 감싸 센다, 상태 캐시가 건너뛴 것은 세지 않는다)
			const countCalls = (isEnabled, hasOutline) => {
				postProcess.setAmbientOcclusion(isEnabled, 0.5, 0.5, 0.5);
				drawFrame(perspectiveMatrix, hasOutline);
				const counts = { total: 0, drawArrays: 0, drawElements: 0 };
				const originals = {};
				for (const name of ["drawArrays", "drawElements", "drawElementsInstanced", "drawArraysInstanced", "useProgram", "bindTexture", "activeTexture", "bindFramebuffer", "viewport", "uniform1i", "uniform1f", "uniform2f", "uniform3f", "uniform4f", "uniformMatrix3fv", "uniformMatrix4fv", "bindVertexArray", "enable", "disable", "getParameter", "isEnabled", "bindBufferBase"]) {
					originals[name] = webGL2RenderingContext[name];
					webGL2RenderingContext[name] = function (...argumentList) {
						counts.total += 1;
						if (name.startsWith("draw")) {
							counts[name.startsWith("drawArrays") ? "drawArrays" : "drawElements"] += 1;
						}
						return originals[name].apply(this, argumentList);
					};
				}
				drawFrame(perspectiveMatrix, hasOutline);
				for (const name of Object.keys(originals)) {
					webGL2RenderingContext[name] = originals[name];
				}
				return counts;
			};
			result.calls = { off: countCalls(false, false), on: countCalls(true, false), outlineOff: countCalls(false, true), outlineOn: countCalls(true, true) };
			postProcess.setAmbientOcclusion(false);
		}
		result.error = webGL2RenderingContext.getError();
		return result;
	}, modulePath, cases, WIDTH, HEIGHT);
};

const browser = await puppeteer.launch({ executablePath, headless: true });
let current = null;
let base = null;
try {
	const page = await browser.newPage();
	const errorList = [];
	page.on("console", (message) => {
		// 파비콘 같은 없는 파일의 404 는 셈하지 않는다.
		if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) {
			errorList.push(message.text());
		}
	});
	await gotoPage(page, "http://127.0.0.1:" + port + "/");
	current = await renderScene(page, "/import.js", [
		{ name: "offPerspective", isOrthographic: false, hasOutline: false, isEnabled: false, hasPicture: true },
		{ name: "offOrthographic", isOrthographic: true, hasOutline: false, isEnabled: false, hasPicture: true },
		{ name: "offOutline", isOrthographic: true, hasOutline: true, isEnabled: false, hasPicture: true },
		{ name: "onPerspective", isOrthographic: false, hasOutline: false, isEnabled: true, hasPicture: true, hasAmbientOcclusionPicture: true },
		{ name: "onOrthographic", isOrthographic: true, hasOutline: false, isEnabled: true, hasPicture: true, hasAmbientOcclusionPicture: true },
		{ name: "onOutline", isOrthographic: true, hasOutline: true, isEnabled: true, hasPicture: true, hasAmbientOcclusionPicture: true },
		{ name: "offAgainPerspective", isOrthographic: false, hasOutline: false, isEnabled: false },
		{ name: "offAgainOutline", isOrthographic: true, hasOutline: true, isEnabled: false },
		{ name: "directQuarterPerspective", isOrthographic: false, hasOutline: false, isEnabled: true, hasPicture: true, hasAmbientOcclusionPicture: true, directLightingStrength: 0.25 },
		{ name: "directHalfPerspective", isOrthographic: false, hasOutline: false, isEnabled: true, hasPicture: true, hasAmbientOcclusionPicture: true, directLightingStrength: 0.5 },
		{ name: "directFullPerspective", isOrthographic: false, hasOutline: false, isEnabled: true, hasPicture: true, hasAmbientOcclusionPicture: true, directLightingStrength: 1 },
		{ name: "directFullOutline", isOrthographic: true, hasOutline: true, isEnabled: true, hasPicture: true, hasAmbientOcclusionPicture: true, directLightingStrength: 1 },
		{ name: "offAfterDirectPerspective", isOrthographic: false, hasOutline: false, isEnabled: false },
	]);
	if (basePath !== null) {
		base = await renderScene(page, "/base/import.js", [
			{ name: "offPerspective", isOrthographic: false, hasOutline: false, isEnabled: false },
			{ name: "offOrthographic", isOrthographic: true, hasOutline: false, isEnabled: false },
			{ name: "offOutline", isOrthographic: true, hasOutline: true, isEnabled: false },
			{ name: "onPerspective", isOrthographic: false, hasOutline: false, isEnabled: true },
			{ name: "onOrthographic", isOrthographic: true, hasOutline: false, isEnabled: true },
			{ name: "onOutline", isOrthographic: true, hasOutline: true, isEnabled: true },
		]);
	}
	check(errorList.length === 0, "콘솔 오류 없음 (" + errorList.join(" / ") + ")");
	await page.close();
}
finally {
	await browser.close();
	server.close();
}

// 그림은 검사 앞에 남긴다. (실패한 화면도 보게)
if (picturePath !== null) {
	fs.mkdirSync(picturePath, { recursive: true });
	for (const [name, dataUrl] of Object.entries(current.pictures)) {
		fs.writeFileSync(path.join(picturePath, "toonao-" + name + ".png"), System.Buffer.from(dataUrl.split(",")[1], "base64"));
	}
	console.log("  그림: " + picturePath);
}
check(current.error === 0, "GL 오류 없음 (" + current.error + ")");
for (const result of [current, base]) {
	if (result !== null) {
		for (const name of Object.keys(result.captures)) {
			result.captures[name] = new System.Uint8Array(System.Buffer.from(result.captures[name], "base64"));
		}
	}
}
const countDifferent = (first, second) => {
	let count = 0;
	for (let index = 0; index < first.length; index++) {
		if (first[index] !== second[index]) {
			count++;
		}
	}
	return count;
};
// 꺼짐은 바이트까지 같다.
check(countDifferent(current.captures.offPerspective, current.captures.offAgainPerspective) === 0, "원근: 켰다 끈 화면이 켠 적 없는 화면과 같음");
check(countDifferent(current.captures.offOutline, current.captures.offAgainOutline) === 0, "바깥선: 켰다 끈 화면이 켠 적 없는 화면과 같음");
check(countDifferent(current.captures.offPerspective, current.captures.offAfterDirectPerspective) === 0, "원근: 직접 빛 몫 1 로 켰다 끈 화면이 켠 적 없는 화면과 같음");
if (base !== null) {
	for (const name of ["offPerspective", "offOrthographic", "offOutline"]) {
		const different = countDifferent(current.captures[name], base.captures[name]);
		console.log("  꺼짐 " + name + ": 고치기 전과 다른 바이트 " + different);
		check(different === 0, name + ": 꺼짐이 고치기 전과 바이트까지 같음");
	}
	// 직접 빛 몫 0(기본)의 켬은 고치기 전의 켬과 바이트까지 같다.
	for (const name of ["onPerspective", "onOrthographic", "onOutline"]) {
		const different = countDifferent(current.captures[name], base.captures[name]);
		console.log("  켬(직접 빛 몫 0) " + name + ": 고치기 전과 다른 바이트 " + different);
		check(different === 0, name + ": 직접 빛 몫 0 의 켬이 고치기 전과 바이트까지 같음");
	}
}
else {
	console.log("  (TOON_AO_BASE_PATH 를 주지 않아 고치기 전 저장소와는 견주지 않음)");
}

// 켬: 화소 밝기 견주기. (3 x 3 평균, readPixels 는 왼쪽 아래 원점)
const readLuminance = (pixels, point) => {
	let sum = 0;
	for (let offsetY = -1; offsetY <= 1; offsetY++) {
		for (let offsetX = -1; offsetX <= 1; offsetX++) {
			const index = ((point[1] + offsetY) * WIDTH + point[0] + offsetX) * 4;
			sum += pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722;
		}
	}
	return sum / 9;
};
const darkeningTable = {};
for (const [onName, offName] of [["onPerspective", "offPerspective"], ["onOrthographic", "offOrthographic"], ["onOutline", "offOutline"], ["directQuarterPerspective", "offPerspective"], ["directHalfPerspective", "offPerspective"], ["directFullPerspective", "offPerspective"], ["directFullOutline", "offOutline"]]) {
	const probes = current.probes[onName];
	const onPixels = current.captures[onName];
	const offPixels = current.captures[offName];
	const occlusionPixels = current.captures[onName + "Occlusion"];
	const lineList = [];
	const darkening = {};
	for (const [probeName, point] of Object.entries(probes)) {
		darkening[probeName] = readLuminance(offPixels, point) - readLuminance(onPixels, point);
		lineList.push(probeName + " " + darkening[probeName].toFixed(1) + " (AO " + readLuminance(occlusionPixels, point).toFixed(0) + ")");
	}
	console.log("  " + onName + " 어두워진 밝기: " + lineList.join(", "));
	darkeningTable[onName] = darkening;
	// 바깥선 장면은 선이 3 x 3 평균에 섞여(선은 켜고 끔이 같다) 덜 드러나므로 1 이상만 본다.
	const minimumDarkening = onName === "onOutline" ? 1 : 2;
	for (const probeName of ["wallCorner", "leftCorner", "crateSide", "robotFoot"]) {
		check(darkening[probeName] >= minimumDarkening, onName + ": " + probeName + " (벽과 바닥이 만나는 곳, 상자 옆, 로봇 발밑) 이 어두워짐");
		check(readLuminance(occlusionPixels, probes[probeName]) <= 235, onName + ": " + probeName + " 의 AO 판이 어두움");
	}
	check(System.Math.abs(darkening.openFloor) <= 1.5, onName + ": 트인 바닥은 거의 그대로");
	check(readLuminance(occlusionPixels, probes.openFloor) >= 250, onName + ": 트인 바닥의 AO 판은 거의 1");
	// 해 칸 경계: 로봇 머리를 가로지르는 세로 줄에서 밝기가 가장 크게 뛰는 자리가 같다.
	const readEdge = (pixels) => {
		const center = probes.robotHead;
		let bestRow = -1;
		let bestJump = 0;
		for (let row = center[1] - 25; row < center[1] + 25; row++) {
			const jump = System.Math.abs(readLuminance(pixels, [center[0], row + 1]) - readLuminance(pixels, [center[0], row]));
			if (jump > bestJump) {
				bestJump = jump;
				bestRow = row;
			}
		}
		return bestRow;
	};
	const offEdge = readEdge(offPixels);
	const onEdge = readEdge(onPixels);
	// 로봇 머리 가운데 25 x 25 (해 칸 경계가 지나는 트인 곳) 는 바이트까지 같다.
	let headDifferent = 0;
	for (let offsetY = -12; offsetY <= 12; offsetY++) {
		for (let offsetX = -12; offsetX <= 12; offsetX++) {
			const index = ((probes.robotHead[1] + offsetY) * WIDTH + probes.robotHead[0] + offsetX) * 4;
			for (let channel = 0; channel < 4; channel++) {
				headDifferent += onPixels[index + channel] !== offPixels[index + channel] ? 1 : 0;
			}
		}
	}
	console.log("  " + onName + " 해 칸 경계 줄: 끔 " + offEdge + ", 켬 " + onEdge + ", 머리 가운데 다른 바이트 " + headDifferent);
	check(headDifferent === 0, onName + ": 로봇 머리 가운데(해 칸 경계)는 그대로");
	if (onName !== "onOutline" && onName !== "directFullOutline") {
		check(offEdge === onEdge, onName + ": 해 칸 경계 자리가 그대로");
	}
	// 트인 바닥 가운데 9 x 9 는 직접 빛 몫과 상관없이 끔과 바이트까지 같다. (보임이 정확히 1)
	let openDifferent = 0;
	for (let offsetY = -4; offsetY <= 4; offsetY++) {
		for (let offsetX = -4; offsetX <= 4; offsetX++) {
			const index = ((probes.openFloor[1] + offsetY) * WIDTH + probes.openFloor[0] + offsetX) * 4;
			for (let channel = 0; channel < 4; channel++) {
				openDifferent += onPixels[index + channel] !== offPixels[index + channel] ? 1 : 0;
			}
		}
	}
	check(openDifferent === 0, onName + ": 트인 바닥 가운데는 끔과 바이트까지 같음 (" + openDifferent + ")");
}
// 직접 빛 몫을 올릴수록 해가 비추는 구석이 더 어두워진다. (0 → 0.25 → 0.5 → 1)
for (const probeName of ["wallCorner", "leftCorner", "crateSide", "robotFoot"]) {
	const steps = ["onPerspective", "directQuarterPerspective", "directHalfPerspective", "directFullPerspective"].map((name) => darkeningTable[name][probeName]);
	console.log("  직접 빛 몫 0 / 0.25 / 0.5 / 1 의 " + probeName + " 어두워진 밝기: " + steps.map((value) => value.toFixed(1)).join(" / "));
	for (let index = 1; index < steps.length; index++) {
		check(steps[index] > steps[index - 1] + 0.5, probeName + ": 직접 빛 몫을 올리면 더 어두워짐 (" + steps[index - 1].toFixed(1) + " → " + steps[index].toFixed(1) + ")");
	}
}
check(darkeningTable.directFullOutline.wallCorner > darkeningTable.onOutline.wallCorner + 0.5, "바깥선 직교: 직접 빛 몫 1 이면 벽 구석이 더 어두워짐");
// 바깥선의 선의 판을 다시 쓴 AO 판과 미리 그리기의 AO 판은 같다. (같은 직교 장면)
const occlusionDifferent = countDifferent(current.captures.onOrthographicOcclusion, current.captures.onOutlineOcclusion);
console.log("  바깥선 선의 판과 미리 그리기의 AO 판 다른 바이트: " + occlusionDifferent);
check(occlusionDifferent === 0, "바깥선의 선의 판을 다시 써도 AO 판이 같음");
if (current.timing) {
	const timing = current.timing;
	const calls = current.calls;
	console.log("  한 프레임 GL 호출(센 것): 바깥선 없음 끔 " + calls.off.total + " (그리기 " + (calls.off.drawArrays + calls.off.drawElements) + ") → 켬 " + calls.on.total + " (그리기 " + (calls.on.drawArrays + calls.on.drawElements) + "), 바깥선 있음 끔 " + calls.outlineOff.total + " (그리기 " + (calls.outlineOff.drawArrays + calls.outlineOff.drawElements) + ") → 켬 " + calls.outlineOn.total + " (그리기 " + (calls.outlineOn.drawArrays + calls.outlineOn.drawElements) + ")");
	console.log("  프레임 시간(640x360, 20 프레임 평균 ms): 끔 " + timing.off.toFixed(2) + " / " + timing.off2.toFixed(2) + ", 켬 " + timing.on.toFixed(2) + " / " + timing.on2.toFixed(2) + (timing.hasTimer ? "" : " (GPU 시간 재기 없음, 벽시계)"));
}
console.log("툰 모서리 어둠 크롬 시험 통과 (" + checkCount + " 검사)");
