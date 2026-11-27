//==============================================================================
// 색 공간 칸의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/graphics3d/tooncolorspacechrome.test.mjs)
// - 헤드리스 크롬(창을 띄우지 않는다)에서 감마(기본)와 선형 색 공간의 툰 렌더러를 짓는다.
// - 텍스처 형식: 선형 색 공간의 색 텍스처는 SRGB8_ALPHA8(프레임버퍼에 붙이면 색 부호화 SRGB), 자료 텍스처(isColorData: false)와 감마 색 공간의 텍스처는 LINEAR.
// - 셰이더: 선형만 소스마다 #define VANILLA_COLOR_SPACE_LINEAR 1 이 #version 다음 줄에 있고, 감마 소스는 정의가 없다. 선형 프로그램, 후처리, 화면 바깥선이 지어진다.
// - 섞기: 빛을 받지 않는 검정 몸을 흰 틴트와 반씩 섞으면 감마는 sRGB 로 섞어 128 쪽, 선형은 선형으로 섞어 188 쪽이다. (sRGB 표준 곡선 0.5 → 0.735)
// - 엔진: EngineConfiguration.colorSpace 기본은 gamma, linear 로 지은 엔진은 Engine, Graphic, 툰 렌더러 기본값이 모두 linear.
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
const repositoryPath = process.env.TOON_COLOR_SPACE_REPOSITORY_PATH ?? path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");
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
		response.end("<!doctype html><title>colorspace</title><body><canvas id=\"canvas\" width=\"64\" height=\"64\"></canvas></body>");
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
	const pageErrors = [];
	page.on("pageerror", (error) => pageErrors.push(String(error.message)));
	await page.goto("http://127.0.0.1:" + port + "/");
	result = await page.evaluate(async () => {
		const { ToonRenderer, ToonPostProcess, ToonScreenOutline, ColorSpace, composeToonProgramSources, MeshBuilder, createBoxGeometry, Matrix4, Vector3, Engine, EngineConfiguration } = await import("/import.js");
		const canvas = document.getElementById("canvas");
		const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
		const readEncoding = (texture) => {
			const framebuffer = gl.createFramebuffer();
			gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
			const encoding = gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING);
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.deleteFramebuffer(framebuffer);
			return encoding === gl.SRGB ? "srgb" : (encoding === gl.LINEAR ? "linear" : String(encoding));
		};
		const pixel = { width: 1, height: 1, data: new Uint8Array([200, 100, 50, 255]) };
		const readMixedPixel = (renderer) => {
			const builder = new MeshBuilder();
			builder.addPart(createBoxGeometry(4, 4, 0.2), Matrix4.createIdentity(), "#000000", { isUnlit: true, hasOutline: false });
			const mesh = renderer.createMesh(builder.readArrays());
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.viewport(0, 0, 64, 64);
			gl.clearColor(0, 0, 0, 1);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			const viewMatrix = Matrix4.createLookAt(Vector3.create(0, 0, 3), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
			const projectionMatrix = Matrix4.createPerspective(0.8, 1, 0.1, 10);
			renderer.beginFrameWithMatrices(viewMatrix, projectionMatrix);
			renderer.drawMesh(mesh, Matrix4.createIdentity(), { tintColor: [1, 1, 1, 1], tintAmount: 0.5, hasOutline: false });
			renderer.endFrame();
			const pixels = new Uint8Array(4);
			gl.readPixels(32, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
			return Array.from(pixels);
		};
		const gammaRenderer = new ToonRenderer(gl);
		const linearRenderer = new ToonRenderer(gl, { colorSpace: ColorSpace.linear });
		const gammaSources = composeToonProgramSources(null, null, ColorSpace.gamma);
		const linearSources = composeToonProgramSources(null, null, ColorSpace.linear);
		const defaultSources = composeToonProgramSources(null, null);
		const sourceNames = ["solidVertexShader", "solidFragmentShader", "outlineVertexShader", "outlineFragmentShader", "depthVertexShader", "depthFragmentShader"];
		const linearPostProcess = new ToonPostProcess(gl, 64, 64, { colorSpace: ColorSpace.linear });
		const linearScreenOutline = new ToonScreenOutline(gl, { colorSpace: ColorSpace.linear });
		const output = {
			gammaDefault: gammaRenderer.getColorSpace(),
			linearColorSpace: linearRenderer.getColorSpace(),
			gammaColorEncoding: readEncoding(gammaRenderer.createTexture(pixel, { isMipmapped: false })),
			gammaDataEncoding: readEncoding(gammaRenderer.createTexture(pixel, { isMipmapped: false, isColorData: false })),
			linearColorEncoding: readEncoding(linearRenderer.createTexture(pixel)),
			linearDataEncoding: readEncoding(linearRenderer.createTexture(pixel, { isColorData: false })),
			gammaHasDefine: sourceNames.some((name) => gammaSources[name].includes("VANILLA_COLOR_SPACE_LINEAR 1")),
			linearHasDefine: sourceNames.every((name) => linearSources[name].startsWith("#version 300 es\n#define VANILLA_COLOR_SPACE_LINEAR 1\n")),
			defaultIsGamma: sourceNames.every((name) => defaultSources[name] === gammaSources[name]),
			postProcessColorSpace: linearPostProcess.getColorSpace(),
			screenOutlineColorSpace: linearScreenOutline.getColorSpace(),
			gammaMixed: readMixedPixel(gammaRenderer),
			linearMixed: readMixedPixel(linearRenderer),
			defaultConfiguration: new EngineConfiguration().colorSpace,
			glError: gl.getError(),
		};
		const engineConfiguration = new EngineConfiguration();
		engineConfiguration.colorSpace = ColorSpace.linear;
		const engine = new Engine(engineConfiguration);
		output.engineColorSpace = engine.getColorSpace();
		output.graphicColorSpace = engine.getGraphic().getColorSpace();
		const engineGl = engine.getGraphic().getWebGL2RenderingContext();
		output.engineRendererColorSpace = new ToonRenderer(engineGl).getColorSpace();
		output.enginePostProcessColorSpace = new ToonPostProcess(engineGl, 64, 64).getColorSpace();
		output.engineScreenOutlineColorSpace = new ToonScreenOutline(engineGl).getColorSpace();
		return output;
	});
	check(pageErrors.length === 0, "페이지 오류 없음 (" + pageErrors.join(" | ") + ")");
}
finally {
	await browser.close();
	server.close();
}
console.log("  " + JSON.stringify(result));
check(result.glError === 0, "GL 오류 없음 (" + result.glError + ")");
check(result.gammaDefault === "gamma", "엔진이 없으면 툰 렌더러는 gamma");
check(result.linearColorSpace === "linear", "colorSpace: linear 로 지은 툰 렌더러");
check(result.gammaColorEncoding === "linear" && result.gammaDataEncoding === "linear", "감마 색 공간의 텍스처는 RGBA (부호화 LINEAR)");
check(result.linearColorEncoding === "srgb", "선형 색 공간의 색 텍스처는 SRGB8_ALPHA8 (부호화 SRGB)");
check(result.linearDataEncoding === "linear", "선형 색 공간의 자료 텍스처(isColorData: false)는 RGBA8 (부호화 LINEAR)");
check(result.gammaHasDefine === false, "감마 소스에는 정의가 없음");
check(result.linearHasDefine === true, "선형 소스마다 #version 다음 줄에 정의");
check(result.defaultIsGamma === true, "엔진이 없으면 소스는 감마와 같음");
check(result.postProcessColorSpace === "linear" && result.screenOutlineColorSpace === "linear", "후처리와 화면 바깥선이 선형으로 지어짐");
check(System.Math.abs(result.gammaMixed[0] - 128) <= 1 && result.gammaMixed[0] === result.gammaMixed[1], "감마는 sRGB 로 섞음 (" + result.gammaMixed.join(",") + ")");
check(System.Math.abs(result.linearMixed[0] - 188) <= 1 && result.linearMixed[0] === result.linearMixed[1], "선형은 선형으로 섞음 (" + result.linearMixed.join(",") + ")");
check(result.defaultConfiguration === "gamma", "EngineConfiguration.colorSpace 기본은 gamma");
check(result.engineColorSpace === "linear" && result.graphicColorSpace === "linear", "엔진과 Graphic 의 색 공간");
check(result.engineRendererColorSpace === "linear" && result.enginePostProcessColorSpace === "linear" && result.engineScreenOutlineColorSpace === "linear", "툰 렌더러, 후처리, 화면 바깥선 기본값은 엔진의 색 공간");
console.log("툰 색 공간 크롬 시험 통과 (" + checkCount + " 검사)");
