//==============================================================================
// 광부 꼴 장면의 GPU 메모리 셈. (NODE_PATH=$(npm root -g) node tests/graphics3d/gpumemorybench.mjs [옛 엔진 경로])
// - 헤드리스 크롬에서 엔진의 GPU 메모리 셈(GpuMemoryTracker)으로 텍스처, 렌더버퍼, 버퍼 바이트를 종류별과 주인별로 센다. 시험이 아니다. (tests/run.mjs 가 돌리지 않는다)
// - 아이폰 SE2 의 그리는 버퍼(750 x 1334, CSS 375 x 667 에 기기 픽셀 배율 2)에, 광부 게임 설정(그림자 2048, 바깥선 판 배율 0.75)으로 센다.
//   미리 정한 장면: miner (그림자 onChange 와 구운 판), minerevery (그림자 everyFrame), minerpost (miner 에 ToonPostProcess RGBA16F, 멀티샘플 4, 블룸, 배율 0.75 를 더한 견주기 값, 광부 게임은 쓰지 않음)
// - 옛 엔진 경로(광부 게임의 libs/vanilla.js, 0.3.2 꼴)를 주면 그 엔진의 그림자 지도 2048 에 선 찾기의 판 셋(RGBA8, DEPTH24, RG8, 배율 0.75)을 게임 코드대로 지은 값도 같이 센다.
// - 셈은 형식과 크기로 낸 이름값이다. (드라이버가 맞추는 정렬, 타일 메모리, 멀티샘플 압축은 모른다. 멀티샘플 렌더버퍼는 샘플 수를 곱한다, 캔버스 멀티샘플은 4 로 가정)
//==============================================================================
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const repositoryPath = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");
const oldEnginePath = process.argv[2] !== undefined ? path.resolve(process.argv[2]) : null;
const contentTypeTable = { ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".html": "text/html" };
const WIDTH = 750;
const HEIGHT = 1334;

const server = http.createServer((request, response) => {
	let requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
	if (requestPath === "/") {
		response.writeHead(200, { "Content-Type": "text/html" });
		response.end(`<!doctype html><title>gpumemorybench</title><body><canvas id="canvas" width="${WIDTH}" height="${HEIGHT}"></canvas></body>`);
		return;
	}
	let rootPath = repositoryPath;
	if (requestPath.startsWith("/old/") && oldEnginePath !== null) {
		rootPath = oldEnginePath;
		requestPath = requestPath.slice(4);
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
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const chromePathList = [
	...(process.env.CHROME_PATH ? [process.env.CHROME_PATH] : []),
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	"/usr/bin/google-chrome",
];
const executablePath = chromePathList.find((chromePath) => fs.existsSync(chromePath));
const browser = await puppeteer.launch({ executablePath, headless: true });

async function measure(sceneName) {
	const page = await browser.newPage();
	await page.goto("http://127.0.0.1:" + port + "/");
	const usage = await page.evaluate(async (sceneName, width, height) => {
		const vanilla = await import("/import.js");
		const gl = document.getElementById("canvas").getContext("webgl2", { alpha: false, stencil: true, antialias: true, premultipliedAlpha: true });
		const tracker = vanilla.GpuMemoryTracker.attach(gl);
		if (sceneName === "old") {
			// 옛 광부 게임: 옛 엔진의 그림자 지도 2048 과 게임의 선 찾기 판 셋. (게임 코드 readLineTarget 과 같은 형식, 같은 배율)
			const { ShadowMap } = await import("/old/src/experimental/graphics/shadowmap.js");
			const shadowMap = new ShadowMap(gl, 2048);
			const lineWidth = Math.ceil(width * 0.75);
			const lineHeight = Math.ceil(height * 0.75);
			for (const internalFormat of [gl.RGBA8, gl.DEPTH_COMPONENT24, gl.RG8]) {
				const texture = gl.createTexture();
				gl.bindTexture(gl.TEXTURE_2D, texture);
				gl.texStorage2D(gl.TEXTURE_2D, 1, internalFormat, lineWidth, lineHeight);
			}
			return { usage: tracker.readUsage(), note: "옛 엔진 그림자 2048 + 선 판 셋(" + lineWidth + "x" + lineHeight + ")" };
		}
		const { createMinerScene } = await import("/tests/graphics3d/toonminerscene.mjs");
		const options = { shadowResolution: 2048, outlineResolutionScale: 0.75, shadowUpdateMode: sceneName === "minerevery" ? vanilla.ShadowUpdateMode.everyFrame : vanilla.ShadowUpdateMode.onChange };
		const minerScene = createMinerScene(vanilla, gl, width, height, "buffer", 6, options);
		let postProcess = null;
		if (sceneName === "minerpost") {
			postProcess = new vanilla.ToonPostProcess(gl, width, height, { sampleCount: 4, useFloatColor: true });
			postProcess.setResolutionScale(0.75);
			postProcess.setBloom(true, 0.6, 0.9, 1.6);
		}
		for (let frame = 0; frame < 8; ++frame) {
			if (postProcess !== null) {
				postProcess.begin([0.1, 0.1, 0.1]);
			}
			minerScene.drawFrame();
			if (postProcess !== null) {
				postProcess.end(null, [0, 0, width, height]);
			}
			// 구운 판은 움직이는 것이 없어도 한 번 지어진다.
			if (frame === 3) {
				minerScene.shadowMap.requestUpdate?.();
			}
		}
		gl.finish();
		return { usage: tracker.readUsage(), note: "" };
	}, sceneName, WIDTH, HEIGHT);
	await page.close();
	return usage;
}

const MEBIBYTE = 1024 * 1024;
const format = (bytes) => (bytes / MEBIBYTE).toFixed(1).padStart(7) + " MiB";
const sceneNameList = ["miner", "minerevery", "minerpost", ...(oldEnginePath !== null ? ["old"] : [])];
try {
	console.log("그리는 버퍼 " + WIDTH + " x " + HEIGHT + " (SE2, CSS 375 x 667, 기기 픽셀 배율 2), 광부 설정: 그림자 2048, 바깥선 판 배율 0.75, 캔버스 멀티샘플 4 가정");
	for (const sceneName of sceneNameList) {
		const { usage, note } = await measure(sceneName);
		console.log("\n== " + sceneName + " " + note);
		console.log("  합 " + format(usage.totalBytes) + " (캔버스 기본 프레임 버퍼 " + format(usage.canvasBytes) + ")");
		for (const [kind, kindUsage] of Object.entries(usage.kindTable)) {
			console.log("  " + kind.padEnd(14) + format(kindUsage.bytes) + "  " + kindUsage.count + " 개");
		}
		console.log("  주인별 (큰 것부터 12 줄)");
		for (const ownerUsage of usage.ownerList.slice(0, 12)) {
			console.log("    " + format(ownerUsage.bytes) + "  " + String(ownerUsage.count).padStart(3) + " 개  " + ownerUsage.kind.padEnd(14) + ownerUsage.owner);
		}
	}
}
finally {
	await browser.close();
	server.close();
}
