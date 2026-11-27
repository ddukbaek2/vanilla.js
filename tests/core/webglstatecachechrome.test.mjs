//==============================================================================
// WebGL 상태 캐시의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/core/webglstatecachechrome.test.mjs)
// - 헤드리스 크롬(puppeteer-core 와 시스템 크롬, 창을 띄우지 않는다)에서 Graphic 을 만들고, 상태 함수를 마구 불러 가며
//   캐시가 답한 getParameter, isEnabled 가 프로토타입의 진짜 getParameter, isEnabled 와 같은지 견준다. (틀린 인자, 지우기, 컨텍스트 잃기 포함)
// - 그리는 중에 GL 에 묻는 횟수가 0 인지(프레임 버퍼, 뷰포트, 섞기, 깊이, 면, 프로그램 같은 것), resetGLStateCache 뒤에 다시 맞는지 본다.
// - antialias 설정이 컨텍스트 속성으로 들어가는지 본다. (기본 켬, 끄면 끔)
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
		response.end("<!doctype html><title>webglstatecache</title><body></body>");
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
	await page.goto("http://127.0.0.1:" + port + "/");
	result = await page.evaluate(async () => {
		const { Graphic } = await import("/src/core/graphic.js");
		const { WebGLStateCache } = await import("/src/core/graphic/webglstatecache.js");
		const mismatchList = [];
		const candidateTable = { programList: [], vertexArrayList: [], textureList: [] }; // 견줄 객체. (만든 뒤 채운다)
		let knownAnswerCount = 0; // 견주기 함수(isProgramInUse 같은 것)가 참이라고 답한 수. (모두 거짓이면 시험이 헛돈다)
		const canvas = document.createElement("canvas");
		canvas.width = 320;
		canvas.height = 200;
		document.body.appendChild(canvas);
		const graphic = new Graphic(canvas, false);
		const gl = graphic.getWebGL2RenderingContext();
		const realGetParameter = (parameterName) => WebGL2RenderingContext.prototype.getParameter.call(gl, parameterName);
		const realIsEnabled = (capability) => WebGL2RenderingContext.prototype.isEnabled.call(gl, capability);
		const parameterList = [
			["FRAMEBUFFER_BINDING", gl.FRAMEBUFFER_BINDING], ["READ_FRAMEBUFFER_BINDING", gl.READ_FRAMEBUFFER_BINDING],
			["VIEWPORT", gl.VIEWPORT], ["SCISSOR_BOX", gl.SCISSOR_BOX], ["COLOR_CLEAR_VALUE", gl.COLOR_CLEAR_VALUE], ["COLOR_WRITEMASK", gl.COLOR_WRITEMASK],
			["BLEND_SRC_RGB", gl.BLEND_SRC_RGB], ["BLEND_DST_RGB", gl.BLEND_DST_RGB], ["BLEND_SRC_ALPHA", gl.BLEND_SRC_ALPHA], ["BLEND_DST_ALPHA", gl.BLEND_DST_ALPHA],
			["BLEND_EQUATION_RGB", gl.BLEND_EQUATION_RGB], ["BLEND_EQUATION_ALPHA", gl.BLEND_EQUATION_ALPHA],
			["DEPTH_WRITEMASK", gl.DEPTH_WRITEMASK], ["DEPTH_FUNC", gl.DEPTH_FUNC], ["FRONT_FACE", gl.FRONT_FACE], ["CULL_FACE_MODE", gl.CULL_FACE_MODE],
			["CURRENT_PROGRAM", gl.CURRENT_PROGRAM], ["VERTEX_ARRAY_BINDING", gl.VERTEX_ARRAY_BINDING], ["ACTIVE_TEXTURE", gl.ACTIVE_TEXTURE],
			["TEXTURE_BINDING_2D", gl.TEXTURE_BINDING_2D], ["TEXTURE_BINDING_CUBE_MAP", gl.TEXTURE_BINDING_CUBE_MAP], ["TEXTURE_BINDING_3D", gl.TEXTURE_BINDING_3D], ["TEXTURE_BINDING_2D_ARRAY", gl.TEXTURE_BINDING_2D_ARRAY],
			["UNPACK_FLIP_Y_WEBGL", gl.UNPACK_FLIP_Y_WEBGL], ["UNPACK_PREMULTIPLY_ALPHA_WEBGL", gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL], ["UNPACK_COLORSPACE_CONVERSION_WEBGL", gl.UNPACK_COLORSPACE_CONVERSION_WEBGL],
			["PACK_ALIGNMENT", gl.PACK_ALIGNMENT], ["UNPACK_ALIGNMENT", gl.UNPACK_ALIGNMENT], ["MAX_SAMPLES", gl.MAX_SAMPLES], ["MAX_VIEWPORT_DIMS", gl.MAX_VIEWPORT_DIMS],
		];
		const capabilityList = [gl.BLEND, gl.CULL_FACE, gl.DEPTH_TEST, gl.DITHER, gl.POLYGON_OFFSET_FILL, gl.SAMPLE_ALPHA_TO_COVERAGE, gl.SAMPLE_COVERAGE, gl.SCISSOR_TEST, gl.STENCIL_TEST, gl.RASTERIZER_DISCARD];
		const toText = (value) => {
			if (ArrayBuffer.isView(value) || Array.isArray(value)) {
				return value.constructor.name + "[" + Array.from(value).join(",") + "]";
			}
			return String(value);
		};
		const compareAll = (label) => {
			for (const [name, parameterName] of parameterList) {
				const cachedValue = gl.getParameter(parameterName);
				const realValue = realGetParameter(parameterName);
				const isSame = (ArrayBuffer.isView(realValue) || Array.isArray(realValue)) ? toText(cachedValue) === toText(realValue) : cachedValue === realValue;
				if (!isSame) {
					mismatchList.push(label + " " + name + " 캐시 " + toText(cachedValue) + " 진짜 " + toText(realValue));
				}
			}
			for (const capability of capabilityList) {
				if (gl.isEnabled(capability) !== realIsEnabled(capability)) {
					mismatchList.push(label + " isEnabled 0x" + capability.toString(16));
				}
			}
			compareKnownValues(label);
			while (gl.getError() !== gl.NO_ERROR) {
				// 일부러 낸 오류를 비운다.
			}
		};
		// 견주기 함수가 참이면 진짜 GL 값도 그것이어야 한다. (같은 값 호출을 건너뛸 때 쓰므로 틀린 참은 그리기를 망친다, 거짓은 모른다는 뜻이라 괜찮다)
		const compareKnownValues = (label) => {
			const stateCache = WebGLStateCache.find(gl);
			const expectKnown = (name, isKnown, isReal) => {
				if (isKnown) {
					knownAnswerCount += 1;
					if (!isReal) {
						mismatchList.push(label + " " + name + " 캐시는 같다고 했으나 진짜는 다름");
					}
				}
			};
			const realProgram = realGetParameter(gl.CURRENT_PROGRAM);
			for (const program of [...candidateTable.programList, null]) {
				expectKnown("isProgramInUse", stateCache.isProgramInUse(program), program === realProgram);
			}
			const realVertexArray = realGetParameter(gl.VERTEX_ARRAY_BINDING);
			for (const vertexArray of [...candidateTable.vertexArrayList, null]) {
				expectKnown("isVertexArrayBound", stateCache.isVertexArrayBound(vertexArray), vertexArray === realVertexArray);
			}
			const realActiveTexture = realGetParameter(gl.ACTIVE_TEXTURE);
			const realActivate = (textureUnit) => WebGL2RenderingContext.prototype.activeTexture.call(gl, textureUnit);
			for (let unit = 0; unit < 8; unit++) {
				expectKnown("isActiveTexture", stateCache.isActiveTexture(gl.TEXTURE0 + unit), gl.TEXTURE0 + unit === realActiveTexture);
				// 진짜 묶음은 프로토타입으로 유닛을 바꿔 읽고 되돌린다. (캐시가 모르게 바꾸고 되돌리므로 기억은 그대로 맞다)
				realActivate(gl.TEXTURE0 + unit);
				const realTexture2D = realGetParameter(gl.TEXTURE_BINDING_2D);
				const realTextureCube = realGetParameter(gl.TEXTURE_BINDING_CUBE_MAP);
				realActivate(realActiveTexture);
				for (const texture of [...candidateTable.textureList, null]) {
					expectKnown("isTextureBound 2D", stateCache.isTextureBound(gl.TEXTURE0 + unit, gl.TEXTURE_2D, texture), texture === realTexture2D);
					expectKnown("isTextureBound 큐브", stateCache.isTextureBound(gl.TEXTURE0 + unit, gl.TEXTURE_CUBE_MAP, texture), texture === realTextureCube);
				}
			}
			const realFrontFace = realGetParameter(gl.FRONT_FACE);
			for (const mode of [gl.CW, gl.CCW]) {
				expectKnown("isFrontFace", stateCache.isFrontFace(mode), mode === realFrontFace);
			}
			const realCullFace = realGetParameter(gl.CULL_FACE_MODE);
			for (const mode of [gl.FRONT, gl.BACK, gl.FRONT_AND_BACK]) {
				expectKnown("isCullFace", stateCache.isCullFace(mode), mode === realCullFace);
			}
		};

		// 처음 값.
		compareAll("처음");

		// 자원.
		const framebufferList = [gl.createFramebuffer(), gl.createFramebuffer()];
		const textureList = [gl.createTexture(), gl.createTexture(), gl.createTexture()];
		const vertexArrayList = [gl.createVertexArray(), gl.createVertexArray()];
		const makeProgram = (isValid) => {
			const vertexShader = gl.createShader(gl.VERTEX_SHADER);
			gl.shaderSource(vertexShader, "#version 300 es\nvoid main() { gl_Position = vec4(0.0); }");
			gl.compileShader(vertexShader);
			const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
			gl.shaderSource(fragmentShader, isValid ? "#version 300 es\nprecision mediump float; out vec4 o; void main() { o = vec4(1.0); }" : "#version 300 es\nbroken");
			gl.compileShader(fragmentShader);
			const program = gl.createProgram();
			gl.attachShader(program, vertexShader);
			gl.attachShader(program, fragmentShader);
			gl.linkProgram(program);
			return program;
		};
		const programList = [makeProgram(true), makeProgram(true), makeProgram(false)];
		candidateTable.programList = programList;
		candidateTable.vertexArrayList = vertexArrayList;
		candidateTable.textureList = textureList;

		// 정해진 경우들. (틀린 인자 포함)
		gl.viewport(10, 20, 30, 40); compareAll("뷰포트");
		gl.viewport(1, 2, -5, 10); compareAll("뷰포트 음수");
		gl.viewport(0.7, -3.2, 100000, 100000); compareAll("뷰포트 한도");
		gl.scissor(5, 6, 7, 8); compareAll("가위");
		gl.scissor(5, 6, -7, 8); compareAll("가위 음수");
		gl.clearColor(2, -1, 0.3, 1); compareAll("비우기 색 범위 밖");
		gl.clearColor(0.1, 0.2, 0.3, 0.4); compareAll("비우기 색");
		gl.colorMask(true, false, 1, 0); compareAll("색 가림");
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); compareAll("섞기");
		gl.blendFunc(gl.CONSTANT_COLOR, gl.CONSTANT_ALPHA); compareAll("섞기 상수 섞음");
		gl.blendFunc(12345, gl.ONE); compareAll("섞기 틀린 값");
		gl.blendFunc(gl.ONE, gl.SRC_ALPHA_SATURATE); compareAll("섞기 대상 saturate");
		gl.blendFuncSeparate(gl.ONE, gl.ZERO, gl.DST_ALPHA, gl.ONE_MINUS_DST_COLOR); compareAll("섞기 따로");
		gl.blendEquation(gl.MAX); compareAll("섞기 식");
		gl.blendEquationSeparate(gl.FUNC_SUBTRACT, 999); compareAll("섞기 식 틀림");
		gl.blendEquationSeparate(gl.FUNC_REVERSE_SUBTRACT, gl.MIN); compareAll("섞기 식 따로");
		gl.depthMask(false); compareAll("깊이 쓰기");
		gl.depthFunc(gl.GEQUAL); compareAll("깊이 견주기");
		gl.depthFunc(77); compareAll("깊이 견주기 틀림");
		gl.frontFace(gl.CW); compareAll("앞면");
		gl.cullFace(gl.FRONT_AND_BACK); compareAll("가리는 면");
		gl.cullFace(gl.BLEND); compareAll("가리는 면 틀림");
		for (const capability of capabilityList) {
			gl.enable(capability);
		}
		compareAll("모두 켬");
		gl.disable(gl.DITHER); gl.disable(gl.RASTERIZER_DISCARD); gl.enable(0x1234); compareAll("일부 끔, 틀린 기능");
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebufferList[0]); compareAll("프레임 버퍼");
		gl.bindFramebuffer(gl.READ_FRAMEBUFFER, framebufferList[1]); compareAll("읽기 프레임 버퍼");
		gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null); compareAll("그리기 프레임 버퍼 null");
		gl.bindFramebuffer(gl.FRAMEBUFFER, undefined); compareAll("프레임 버퍼 undefined");
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebufferList[1]); gl.deleteFramebuffer(framebufferList[1]); compareAll("묶인 프레임 버퍼 지움");
		gl.useProgram(programList[0]); compareAll("프로그램");
		gl.useProgram(programList[2]); compareAll("링크 실패 프로그램");
		gl.useProgram(programList[1]); gl.deleteProgram(programList[1]); compareAll("쓰는 프로그램 지움");
		gl.bindVertexArray(vertexArrayList[0]); compareAll("버텍스 어레이");
		gl.deleteVertexArray(vertexArrayList[0]); compareAll("묶인 버텍스 어레이 지움");
		gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, textureList[0]); compareAll("유닛 3 텍스처");
		gl.activeTexture(gl.TEXTURE0 + 100000); compareAll("유닛 한도 밖");
		gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_CUBE_MAP, textureList[1]); compareAll("유닛 1 큐브");
		gl.bindTexture(gl.TEXTURE_2D, textureList[1]); compareAll("큐브를 2D 로 묶음(틀림)");
		gl.activeTexture(gl.TEXTURE3); gl.deleteTexture(textureList[0]); compareAll("묶인 텍스처 지움");
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 5); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 3); gl.pixelStorei(gl.PACK_ALIGNMENT, 2); compareAll("픽셀 설정");
		gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); compareAll("색 공간 끔");
		gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, 42); compareAll("색 공간 틀림");

		// 마구 부르기. (정한 씨앗의 의사 난수)
		let seed = 12345;
		const random = () => {
			seed = (seed * 1103515245 + 12345) & 0x7fffffff;
			return seed / 0x7fffffff;
		};
		const pick = (list) => list[Math.floor(random() * list.length)];
		const liveFramebufferList = [null, gl.createFramebuffer(), gl.createFramebuffer()];
		const liveTextureList = [null, gl.createTexture(), gl.createTexture()];
		const liveVertexArrayList = [null, gl.createVertexArray()];
		const operationList = [
			() => gl.viewport(Math.floor(random() * 50), Math.floor(random() * 50), Math.floor(random() * 400), Math.floor(random() * 400)),
			() => gl.scissor(Math.floor(random() * 50), Math.floor(random() * 50), Math.floor(random() * 400), Math.floor(random() * 400)),
			() => gl.clearColor(random(), random(), random(), random()),
			() => gl.colorMask(random() < 0.5, random() < 0.5, random() < 0.5, random() < 0.5),
			() => gl.blendFunc(pick([gl.ONE, gl.ZERO, gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.DST_COLOR]), pick([gl.ONE, gl.ZERO, gl.ONE_MINUS_SRC_ALPHA, gl.SRC_COLOR])),
			() => gl.blendFuncSeparate(pick([gl.ONE, gl.SRC_ALPHA]), pick([gl.ZERO, gl.ONE_MINUS_SRC_ALPHA]), pick([gl.ONE, gl.ZERO]), pick([gl.ONE, gl.ONE_MINUS_SRC_ALPHA])),
			() => gl.blendEquation(pick([gl.FUNC_ADD, gl.FUNC_SUBTRACT, gl.MIN])),
			() => gl.depthMask(random() < 0.5),
			() => gl.depthFunc(pick([gl.LESS, gl.LEQUAL, gl.ALWAYS, gl.EQUAL])),
			() => gl.frontFace(pick([gl.CW, gl.CCW])),
			() => gl.cullFace(pick([gl.FRONT, gl.BACK])),
			() => (random() < 0.5 ? gl.enable : gl.disable).call(gl, pick(capabilityList)),
			() => gl.bindFramebuffer(pick([gl.FRAMEBUFFER, gl.DRAW_FRAMEBUFFER, gl.READ_FRAMEBUFFER]), pick(liveFramebufferList)),
			() => gl.useProgram(pick([null, programList[0]])),
			() => gl.bindVertexArray(pick(liveVertexArrayList)),
			() => gl.activeTexture(gl.TEXTURE0 + Math.floor(random() * 4)),
			() => gl.bindTexture(gl.TEXTURE_2D, pick(liveTextureList)),
			() => gl.pixelStorei(pick([gl.UNPACK_FLIP_Y_WEBGL, gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL]), random() < 0.5 ? 1 : 0),
		];
		for (let operationIndex = 0; operationIndex < 600; operationIndex++) {
			pick(operationList)();
			if (operationIndex % 20 === 19) {
				compareAll("마구 " + operationIndex);
			}
		}

		// 가로채지 못한 길로 바꾸면 틀리고, resetGLStateCache 뒤에 맞는다.
		WebGL2RenderingContext.prototype.viewport.call(gl, 3, 4, 50, 60);
		const staleViewport = graphic.getCurrentViewport();
		const isStaleBeforeReset = staleViewport.width !== 50;
		graphic.resetGLStateCache();
		const resetViewport = graphic.getCurrentViewport();
		compareAll("reset 뒤");

		// 그리는 중에 GL 에 묻는 횟수. (프로토타입의 getParameter, isEnabled 를 세며 엔진이 2D 와 바깥 패스를 그리게 한다)
		let realQueryCount = 0;
		const originalPrototypeGetParameter = WebGL2RenderingContext.prototype.getParameter;
		const originalPrototypeIsEnabled = WebGL2RenderingContext.prototype.isEnabled;
		WebGL2RenderingContext.prototype.getParameter = function (parameterName) {
			realQueryCount++;
			return originalPrototypeGetParameter.call(this, parameterName);
		};
		WebGL2RenderingContext.prototype.isEnabled = function (capability) {
			realQueryCount++;
			return originalPrototypeIsEnabled.call(this, capability);
		};
		const queryParameterList = [gl.FRAMEBUFFER_BINDING, gl.VIEWPORT, gl.BLEND_SRC_RGB, gl.DEPTH_WRITEMASK, gl.DEPTH_FUNC, gl.FRONT_FACE, gl.CURRENT_PROGRAM, gl.VERTEX_ARRAY_BINDING, gl.ACTIVE_TEXTURE, gl.TEXTURE_BINDING_2D, gl.COLOR_CLEAR_VALUE, gl.UNPACK_FLIP_Y_WEBGL, gl.MAX_SAMPLES];
		for (let frameIndex = 0; frameIndex < 10; frameIndex++) {
			for (const parameterName of queryParameterList) {
				gl.getParameter(parameterName);
			}
			gl.isEnabled(gl.BLEND);
			gl.isEnabled(gl.SCISSOR_TEST);
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.viewport(0, 0, 320, 200);
		}
		WebGL2RenderingContext.prototype.getParameter = originalPrototypeGetParameter;
		WebGL2RenderingContext.prototype.isEnabled = originalPrototypeIsEnabled;

		// 컨텍스트 잃기와 되살리기.
		const loseContextExtension = gl.getExtension("WEBGL_lose_context");
		let lostMismatchCount = -1;
		let isContextLostEventSeen = false;
		let isContextRestoredEventSeen = false;
		if (loseContextExtension) {
			// 되살리려면 잃을 때 기본 동작을 막아야 한다.
			canvas.addEventListener("webglcontextlost", (event) => event.preventDefault());
			const waitEvent = (eventName) => Promise.race([new Promise((resolve) => canvas.addEventListener(eventName, () => resolve(true), { once: true })), new Promise((resolve) => setTimeout(() => resolve(false), 3000))]);
			const lostPromise = waitEvent("webglcontextlost");
			loseContextExtension.loseContext();
			isContextLostEventSeen = await lostPromise;
			const beforeCount = mismatchList.length;
			compareAll("잃은 동안");
			gl.viewport(1, 1, 2, 2);
			const restoredPromise = waitEvent("webglcontextrestored");
			loseContextExtension.restoreContext();
			isContextRestoredEventSeen = await restoredPromise;
			compareAll("되살린 뒤");
			lostMismatchCount = mismatchList.length - beforeCount;
		}

		// antialias 설정.
		const antialiasDefaultCanvas = document.createElement("canvas");
		const antialiasDefault = new Graphic(antialiasDefaultCanvas, false).getWebGL2RenderingContext().getContextAttributes().antialias;
		const antialiasOffCanvas = document.createElement("canvas");
		const antialiasOff = new Graphic(antialiasOffCanvas, false, false).getWebGL2RenderingContext().getContextAttributes().antialias;
		return {
			mismatchList,
			knownAnswerCount,
			isStaleBeforeReset,
			resetViewport: [resetViewport.position.x, resetViewport.position.y, resetViewport.width, resetViewport.height],
			realQueryCount,
			lostMismatchCount,
			isContextLostEventSeen,
			isContextRestoredEventSeen,
			antialiasDefault,
			antialiasOff,
		};
	});
}
finally {
	await browser.close();
	server.close();
}

for (const mismatch of result.mismatchList.slice(0, 20)) {
	console.log("  다름: " + mismatch);
}
check(result.mismatchList.length === 0, "캐시와 진짜 GL 값이 다름 " + result.mismatchList.length + " 곳");
check(result.knownAnswerCount > 0, "견주기 함수가 한 번도 참이라고 답하지 않음 (시험이 헛돈다)");
console.log("  견주기 함수가 참이라고 답한 수 " + result.knownAnswerCount);
check(result.isStaleBeforeReset, "프로토타입으로 바꾼 뷰포트는 reset 전에 모르는 것이 맞음");
check(result.resetViewport.join(",") === "3,4,50,60", "resetGLStateCache 뒤 뷰포트 " + result.resetViewport.join(","));
check(result.realQueryCount === 0, "그리는 중 GL 에 물은 횟수 " + result.realQueryCount + " (0 이어야)");
console.log("  컨텍스트 잃음 사건 " + result.isContextLostEventSeen + ", 되살림 사건 " + result.isContextRestoredEventSeen);
check(result.lostMismatchCount === 0, "컨텍스트를 되살린 뒤 다름 " + result.lostMismatchCount);
check(result.antialiasDefault === true, "antialias 기본 켬");
check(result.antialiasOff === false, "antialias 끔");
console.log("WebGL 상태 캐시 크롬 시험 통과 (" + checkCount + " 검사)");
