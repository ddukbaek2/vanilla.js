//==============================================================================
// 정점 유니폼 칸 한도의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/graphics3d/uniformlimitchrome.test.mjs)
// - WebGL2 가 보장하는 최솟값은 MAX_VERTEX_UNIFORM_VECTORS 256, MAX_FRAGMENT_UNIFORM_VECTORS 224 칸이다. 데스크탑은 4096 이라 넘어도 돌지만 안드로이드(갤럭시 Z 폴드3)는 256 에서 링크에 실패한다.
// - 엔진이 짓는 프로그램마다 기본 블록 유니폼을 vec4 칸으로 세어(mat4 4 칸, 배열은 원소마다 한 칸 이상) 한도 안인지 본다.
//   몸 기능 비트를 전부 켠 것(TOON_FEATURE_ALL)과 하나씩 뺀 것, 인스턴스 꼴, 모서리 어둠, 바깥선, 그림자 깊이, 선의 판, 그림자 맵과 아틀라스, 스키닝 렌더러(뼈 96, 모프 96), 피부 렌더러, 효과를 모두 짓는다.
//   뼈 행렬 배열은 유니폼 블록(JointBlock)으로 넘겨 기본 블록에 들지 않는다.
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
		response.end("<!doctype html><title>uniformlimit</title><body><canvas id=\"canvas\" width=\"160\" height=\"120\"></canvas></body>");
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
		const gl = document.getElementById("canvas").getContext("webgl2", { antialias: false });
		const limits = { vertex: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS), fragment: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) };
		// 링크한 프로그램마다 기본 블록 유니폼을 vec4 칸으로 센다. (유니폼 이름이 그 단계 소스에 나오면 그 단계의 것으로 본다)
		const programList = [];
		const sourceTable = new WeakMap();
		const attachTable = new WeakMap();
		const originalShaderSource = gl.shaderSource.bind(gl);
		gl.shaderSource = (shader, text) => {
			sourceTable.set(shader, text);
			originalShaderSource(shader, text);
		};
		const originalAttachShader = gl.attachShader.bind(gl);
		gl.attachShader = (program, shader) => {
			if (!attachTable.has(program)) {
				attachTable.set(program, []);
			}
			attachTable.get(program).push(shader);
			originalAttachShader(program, shader);
		};
		const readRows = (type, size) => {
			const matrixRows = { 0x8B5A: 2, 0x8B5B: 3, 0x8B5C: 4 };
			if (matrixRows[type] !== undefined) {
				return matrixRows[type] * size;
			}
			const scalarSize = { 0x1406: 0.25, 0x8B50: 0.5, 0x8B51: 1, 0x8B52: 1, 0x1404: 0.25, 0x8B53: 0.5, 0x8B54: 1, 0x8B55: 1, 0x1405: 0.25, 0x8B56: 0.25 };
			if (scalarSize[type] === undefined) {
				return 0; // 샘플러
			}
			return size > 1 ? size : scalarSize[type];
		};
		const originalLinkProgram = gl.linkProgram.bind(gl);
		gl.linkProgram = (program) => {
			originalLinkProgram(program);
			let vertexSource = "";
			let fragmentSource = "";
			for (const shader of attachTable.get(program) ?? []) {
				if (gl.getShaderParameter(shader, gl.SHADER_TYPE) === gl.VERTEX_SHADER) {
					vertexSource = sourceTable.get(shader) ?? "";
				}
				else {
					fragmentSource = sourceTable.get(shader) ?? "";
				}
			}
			const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
			const indexList = Array.from({ length: count }, (value, index) => index);
			const blockList = count > 0 ? gl.getActiveUniforms(program, indexList, gl.UNIFORM_BLOCK_INDEX) : [];
			let vertexRows = 0;
			let fragmentRows = 0;
			let biggest = "";
			for (let index = 0; index < count; ++index) {
				if (blockList[index] !== -1) {
					continue;
				}
				const info = gl.getActiveUniform(program, index);
				const baseName = info.name.replace(/\[0\]$/, "");
				const rows = readRows(info.type, info.size);
				const pattern = new RegExp("\\b" + baseName + "\\b");
				if (pattern.test(vertexSource)) {
					vertexRows += rows;
					if (rows >= 24) {
						biggest += " " + baseName + ":" + rows;
					}
				}
				if (pattern.test(fragmentSource)) {
					fragmentRows += rows;
				}
			}
			programList.push({ linked: gl.getProgramParameter(program, gl.LINK_STATUS), vertexRows: Math.ceil(vertexRows), fragmentRows: Math.ceil(fragmentRows), biggest: biggest, hasJointBlock: gl.getUniformBlockIndex(program, "JointBlock") !== gl.INVALID_INDEX });
		};
		const engine = await import("/import.js");
		const { ToonRenderer, ToonMaterial, ToonInstanceLayout, ToonScreenOutline, ToonVfx, ShadowMap, ShadowAtlas, SkinnedModelRenderer, HumanSkinRenderer, AmbientOcclusionEffect, SubsurfaceScatteringEffect, BloomEffect, MultiLevelBloomEffect, composeToonProgramSources, ShaderProgram } = engine;
		const featureNameList = ["baseTexture", "emissiveTexture", "decalTexture", "matcap", "angelRing", "rampTexture", "shadeStops", "rim", "shadeRim", "shadow", "intensityLimit"];
		const instanceLayout = new ToonInstanceLayout([{ name: "instanceMatrix", size: 16 }, { name: "instanceTint", size: 4 }, { name: "instanceLineId", size: 1 }]);
		const material = new ToonMaterial({ name: "probe", surfaceChunk: "void applySurface(inout ToonSurface surface) { surface.baseColor *= 0.8; }" });
		const buildSources = (sourceMaterial, layout, isAmbientOcclusion, disabledFeatures) => {
			const sources = composeToonProgramSources(sourceMaterial, layout, isAmbientOcclusion, undefined, disabledFeatures);
			new ShaderProgram(gl, sources.solidVertexShader, sources.solidFragmentShader, sources.attributeLocationTable);
			if (disabledFeatures.length === 0) {
				new ShaderProgram(gl, sources.outlineVertexShader, sources.outlineFragmentShader, sources.attributeLocationTable);
				new ShaderProgram(gl, sources.depthVertexShader, sources.depthFragmentShader, sources.attributeLocationTable);
			}
		};
		// 몸 기능 비트: 전부 켠 것(TOON_FEATURE_ALL), 하나씩 뺀 것, 전부 뺀 것. 재질과 인스턴스 꼴, 모서리 어둠의 조합.
		const featureSetList = [[], featureNameList.slice()];
		for (const name of featureNameList) {
			featureSetList.push([name]);
		}
		for (const sourceMaterial of [null, material]) {
			for (const layout of [null, instanceLayout]) {
				for (const isAmbientOcclusion of [false, true]) {
					for (const disabledFeatures of featureSetList) {
						buildSources(sourceMaterial, layout, isAmbientOcclusion, disabledFeatures);
					}
				}
			}
		}
		const renderer = new ToonRenderer(gl); // 기본 프로그램 칸(몸, 바깥선, 깊이)
		const toonProgramCount = programList.length;
		const objectList = [renderer, new ToonScreenOutline(gl), new ToonVfx(gl), new ShadowMap(gl, 256), new ShadowAtlas(gl, 256, 128), new SkinnedModelRenderer(gl), new HumanSkinRenderer(gl), new AmbientOcclusionEffect(gl), new SubsurfaceScatteringEffect(gl), new BloomEffect(gl), new MultiLevelBloomEffect(gl)];
		const error = gl.getError();
		return { limits: limits, programList: programList, toonProgramCount: toonProgramCount, objectCount: objectList.length, error: error };
	});
}
finally {
	await browser.close();
	server.close();
}
check(result.error === 0, "GL 오류 없음 (" + result.error + ")");
check(result.programList.length > 150, "센 프로그램 수 (" + result.programList.length + ")");
check(result.toonProgramCount > 100, "툰 몸 기능 변형을 센 수 (" + result.toonProgramCount + ")");
let jointProgramCount = 0;
let worstVertex = 0;
let worstFragment = 0;
for (const program of result.programList) {
	check(program.linked, "링크됨");
	worstVertex = Math.max(worstVertex, program.vertexRows);
	worstFragment = Math.max(worstFragment, program.fragmentRows);
	jointProgramCount += program.hasJointBlock ? 1 : 0;
	check(program.vertexRows <= 256, "정점 유니폼 " + program.vertexRows + " 칸이 WebGL2 최솟값 256 칸 안" + program.biggest);
	check(program.fragmentRows <= 224, "조각 유니폼 " + program.fragmentRows + " 칸이 WebGL2 최솟값 224 칸 안");
}
check(jointProgramCount >= 40, "뼈 행렬 블록(JointBlock)을 쓰는 프로그램 수 (" + jointProgramCount + ")");
console.log("유니폼 칸 한도 크롬 시험 통과 (프로그램 " + result.programList.length + " 개, 정점 최대 " + worstVertex + " 칸, 조각 최대 " + worstFragment + " 칸, " + checkCount + " 개 확인)");
