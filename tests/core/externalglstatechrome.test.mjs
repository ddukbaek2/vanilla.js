//==============================================================================
// 게임이 엔진 컨텍스트로 WebGL 을 직접 쓴 뒤의 2D 와 ToonView3D 크롬 시험. (NODE_PATH=$(npm root -g) node tests/core/externalglstatechrome.test.mjs)
// - 헤드리스 크롬(창을 띄우지 않는다)에서 같은 장면(자르기(Mask) 건 부모 안의 ToonView3D 공, 그 위의 2D)을 세 갈래로 그려 견준다.
//   base: 게임 WebGL 없음. miner: graphic.flushBatch 뒤 게임이 제 프로그램을 쓰게 하고 유니폼을 쓰고 제 프레임 버퍼에 그린 뒤(광부 키우기의 그림자 지도 꼴) 자르기 안의 ToonView3D.
//   state: runExternalPass 밖에서 프로그램, 섞기, 뷰포트, 텍스처 유닛, 버텍스 어레이, 정점 버퍼, 깊이 시험, 면 가리기, 가위를 바꿔 두고 2D 와 ToonView3D.
// - 세 갈래 모두 GL 오류가 0 이고(getError, 크롬 경고), 캔버스 화소가 base 와 바이트까지 같은지 본다. (게임은 제 프레임 버퍼에만 그리고 캔버스를 묶어 돌려준다)
// - base 의 프레임당 GL 부름 수와 화소 해시를 찍는다. (고치기 전 코드와 견줄 때 쓴다)
//   puppeteer-core 나 크롬이 없으면 실패한다. (말없이 건너뛰지 않는다)
//==============================================================================
const System = globalThis;
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import url from "node:url";
import crypto from "node:crypto";
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
		response.end("<!doctype html><title>externalglstate</title><style>html,body{margin:0;width:100%;height:100%}canvas{display:block;width:100%;height:100%}</style><body><canvas id=\"gameCanvas\"></canvas></body>");
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

// 한 갈래 그려 뜨기. (20 번째 프레임의 화소, GL 오류, 19 번째 프레임의 GL 부름 수)
const capture = async (mode) => {
	const page = await browser.newPage();
	const warningList = [];
	page.on("console", (message) => {
		const text = message.text();
		// 크롬이 드라이버 성능 힌트("GL Driver Message (OpenGL, Performance, ...): GPU stall due to ReadPixels")를 콘솔에 찍는 것은 엔진의 GL 오류, 경고가 아니다. (소프트웨어 렌더러, 시험이 화소를 읽는 곳)
		if (/WebGL|GL_|INVALID/.test(text) && !/GL Driver Message \(OpenGL, Performance/.test(text)) {
			warningList.push(text);
		}
	});
	await page.setViewport({ width: 400, height: 300, deviceScaleFactor: 1 });
	await gotoPage(page, "http://127.0.0.1:" + port + "/");
	const captured = await page.evaluate(async (mode) => {
		const { Engine, EngineConfiguration, Scene, WorldNode, Vector2, Vector3, Rect, Matrix4, Pivot, Mask, ToonView3D, ToonDrawQueue, MeshBuilder, createSphereGeometry } = await import("/import.js");
		return await new Promise((resolve) => {
			let frame = 0;
			let callCount = 0;
			let frameStartCallCount = 0;
			let frameCallCount = 0;
			let gameResource = null;
			const errorList = [];

			// 게임 쪽 WebGL. (제 프로그램, 제 버텍스 어레이와 정점 버퍼, 제 프레임 버퍼, 제 텍스처)
			const createGameResource = (gl) => {
				const vertexShader = gl.createShader(gl.VERTEX_SHADER);
				gl.shaderSource(vertexShader, "#version 300 es\nin vec2 position;\nuniform mat3 shadowMatrix;\nvoid main() { gl_Position = vec4((shadowMatrix * vec3(position, 1.0)).xy, 0.5, 1.0); }");
				gl.compileShader(vertexShader);
				const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
				gl.shaderSource(fragmentShader, "#version 300 es\nprecision highp float;\nuniform vec4 shadowColor;\nout vec4 outputColor;\nvoid main() { outputColor = shadowColor; }");
				gl.compileShader(fragmentShader);
				const program = gl.createProgram();
				gl.attachShader(program, vertexShader);
				gl.attachShader(program, fragmentShader);
				gl.bindAttribLocation(program, 0, "position");
				gl.linkProgram(program);
				const vertexArray = gl.createVertexArray();
				const vertexBuffer = gl.createBuffer();
				gl.bindVertexArray(vertexArray);
				gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
				gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
				gl.enableVertexAttribArray(0);
				gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
				gl.bindVertexArray(null);
				const texture = gl.createTexture();
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, texture);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 64, 64, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
				const framebuffer = gl.createFramebuffer();
				gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
				gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
				gl.bindFramebuffer(gl.FRAMEBUFFER, null);
				const otherTexture = gl.createTexture();
				gl.bindTexture(gl.TEXTURE_2D, otherTexture);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 0, 255, 255]));
				return { program, vertexArray, vertexBuffer, texture, framebuffer, otherTexture };
			};

			// 게임이 그림자 지도처럼 제 프레임 버퍼에 그린다. (프레임 버퍼만 캔버스로 돌려준다)
			const drawGameShadow = (gl, isLeavingState) => {
				if (gameResource === null) {
					gameResource = createGameResource(gl);
				}
				gl.bindFramebuffer(gl.FRAMEBUFFER, gameResource.framebuffer);
				gl.viewport(0, 0, 64, 64);
				gl.useProgram(gameResource.program);
				gl.uniformMatrix3fv(gl.getUniformLocation(gameResource.program, "shadowMatrix"), false, new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));
				gl.uniform4fv(gl.getUniformLocation(gameResource.program, "shadowColor"), new Float32Array([0.3, 0.6, 0.9, 1]));
				gl.bindVertexArray(gameResource.vertexArray);
				gl.drawArrays(gl.TRIANGLES, 0, 3);
				gl.bindFramebuffer(gl.FRAMEBUFFER, null);
				if (isLeavingState) {
					// 남겨 둔 상태. (뷰포트는 그림자 지도 크기, 섞기와 깊이와 면 가리기와 가위를 바꾸고, 다른 유닛과 0 번 유닛에 제 텍스처를 묶어 둔다)
					gl.bindBuffer(gl.ARRAY_BUFFER, gameResource.vertexBuffer);
					gl.blendFunc(gl.ONE, gl.ONE);
					gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT);
					gl.disable(gl.BLEND);
					gl.enable(gl.DEPTH_TEST);
					gl.enable(gl.CULL_FACE);
					gl.enable(gl.SCISSOR_TEST);
					gl.scissor(0, 0, 8, 8);
					for (let unitIndex = 0; unitIndex < 8; unitIndex++) {
						gl.activeTexture(gl.TEXTURE0 + unitIndex);
						gl.bindTexture(gl.TEXTURE_2D, gameResource.otherTexture);
					}
					gl.activeTexture(gl.TEXTURE3);
				}
			};

			class MainScene extends Scene {
				initialize(engine) {
					super.initialize(engine);
					const maskNode = new WorldNode();
					this.getRoot().addChild(maskNode);
					maskNode.setPivot(Pivot.topLeft);
					maskNode.setLocalPosition(Vector2.create(40, 30));
					maskNode.setContentSizeXY(300, 220);
					maskNode.addComponent(Mask);
					const viewNode = new WorldNode();
					maskNode.addChild(viewNode);
					viewNode.setPivot(Pivot.topLeft);
					viewNode.setLocalPosition(Vector2.create(-20, -10));
					viewNode.setContentSizeXY(360, 260);
					const view = viewNode.addComponent(ToonView3D);
					view.getCamera().setPerspective(0.8, 0.1, 100);
					view.getCamera().lookAt(Vector3.create(0, 0, 3), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
					const builder = new MeshBuilder();
					builder.addPart(createSphereGeometry(0.8, 24, 16), Matrix4.createIdentity(), "#f0b080");
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
					const gl = graphic.getWebGL2RenderingContext();
					frame++;
					if (frame === 1) {
						// 프레임당 GL 부름 수 세기. (엔진의 상태 캐시가 가로챈 함수 위에 덧씌운다)
						for (const name of Object.getOwnPropertyNames(WebGL2RenderingContext.prototype)) {
							const descriptor = Object.getOwnPropertyDescriptor(WebGL2RenderingContext.prototype, name);
							if (typeof descriptor.value !== "function" || name === "constructor" || name === "getError") {
								continue;
							}
							const innerFunction = gl[name];
							gl[name] = function (...argumentList) {
								callCount++;
								return innerFunction.apply(gl, argumentList);
							};
						}
					}
					if (frame === 20) {
						frameCallCount = callCount - frameStartCallCount;
					}
					frameStartCallCount = callCount;
					// 배경. (게임 WebGL 앞의 2D)
					graphic.setFillColor("#406080");
					graphic.drawRect(Rect.create(0, 0, 400, 300));
					graphic.setFillColor("#c04040");
					graphic.drawRect(Rect.create(10, 10, 80, 40));
					if (mode !== "base") {
						graphic.flushBatch();
						drawGameShadow(gl, mode === "state");
					}
					// 자르기(Mask) 건 부모 안의 ToonView3D.
					super.draw(graphic);
					// 위의 2D. (사각형, 원, 반투명)
					graphic.setFillColor("#20c040");
					graphic.drawRect(Rect.create(20, 20, 160, 30));
					graphic.setFillColor("rgba(255, 255, 255, 0.5)");
					graphic.drawCircle(Vector2.create(300, 240), 40);
					if (frame === 20) {
						graphic.flushBatch();
						for (let errorIndex = 0; errorIndex < 8; errorIndex++) {
							const error = gl.getError();
							if (error === gl.NO_ERROR) {
								break;
							}
							errorList.push(error);
						}
						const width = gl.drawingBufferWidth;
						const height = gl.drawingBufferHeight;
						const pixels = new Uint8Array(width * height * 4);
						gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
						resolve({ width, height, pixels: Array.from(pixels), errorList, frameCallCount });
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
	}, mode);
	await page.close();
	captured.warningList = warningList;
	return captured;
};

let base = null;
let miner = null;
let state = null;
try {
	base = await capture("base");
	miner = await capture("miner");
	state = await capture("state");
}
finally {
	await browser.close();
	server.close();
}

const hashPixels = (captured) => crypto.createHash("sha256").update(Buffer.from(captured.pixels)).digest("hex").slice(0, 16);
const countDifferentPixels = (left, right) => {
	let differentCount = 0;
	for (let index = 0; index < left.pixels.length; index += 4) {
		if (left.pixels[index] !== right.pixels[index] || left.pixels[index + 1] !== right.pixels[index + 1] || left.pixels[index + 2] !== right.pixels[index + 2] || left.pixels[index + 3] !== right.pixels[index + 3]) {
			differentCount++;
		}
	}
	return differentCount;
};
console.log("  base 화소 해시 " + hashPixels(base) + ", 프레임당 GL 부름 " + base.frameCallCount + " (miner " + miner.frameCallCount + ", state " + state.frameCallCount + ")");
console.log("  오류 base " + base.errorList.length + "/" + base.warningList.length + ", miner " + miner.errorList.length + "/" + miner.warningList.length + " " + miner.warningList.slice(0, 2).join(" | ") + ", state " + state.errorList.length + "/" + state.warningList.length + ", 다른 화소 miner " + countDifferentPixels(base, miner) + ", state " + countDifferentPixels(base, state));
for (const [name, captured] of [["base", base], ["miner", miner], ["state", state]]) {
	check(captured.errorList.length === 0, name + " 의 GL 오류 0 (" + captured.errorList.join(",") + ")");
	check(captured.warningList.length === 0, name + " 의 크롬 WebGL 경고 0 (" + captured.warningList.slice(0, 3).join(" | ") + ")");
}
// 공이 자르기 안에 그려졌는지. (자르기 밖과 안의 화소가 다르다)
const readPixel = (captured, viewX, viewY) => {
	const index = ((captured.height - 1 - viewY) * captured.width + viewX) * 4;
	return captured.pixels.slice(index, index + 4).join(",");
};
check(readPixel(base, 190, 150) !== readPixel(base, 30, 280), "base 의 공이 자르기 안에 그려짐 " + readPixel(base, 190, 150));
const minerDifferentCount = countDifferentPixels(base, miner);
const stateDifferentCount = countDifferentPixels(base, state);
check(minerDifferentCount === 0, "miner 화면이 base 와 같음 (다른 화소 " + minerDifferentCount + ")");
check(stateDifferentCount === 0, "state 화면이 base 와 같음 (다른 화소 " + stateDifferentCount + ")");
console.log("바깥 WebGL 뒤 2D 와 ToonView3D 크롬 시험 통과 (" + checkCount + " 검사)");
