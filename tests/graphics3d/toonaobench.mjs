// 모서리 어둠(AO) 패스 재기. (node toonaobench.mjs <엔진 뿌리> <변형 쉼표> [너비 높이], 변형: 주소 꼬리 ao=off 나 stub=occ+blur+up 은 그 패스 셰이더를 읽지 않고 바로 쓰는 것으로 바꿈)
// 방 장면을 프레임마다 그리고(큐가 AO 를 부른다) GPU 처리량(ms)을 잰다. ao=off 로 뺀 값과의 차가 AO 몫. 큐 그림 몫이 같아야 하니 같은 장면만 견준다.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(process.env.NODE_PATH.split(":")[0] + "/");
const puppeteer = require("puppeteer-core");
const root = path.resolve(process.argv[2]);
const variants = process.argv[3].split(",");
const WIDTH = Number(process.argv[4] || 2560), HEIGHT = Number(process.argv[5] || 1440);
const types = { ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".html": "text/html" };
const server = http.createServer((request, response) => {
	const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
	if (requestPath === "/") {
		response.writeHead(200, { "Content-Type": "text/html" });
		response.end(`<!doctype html><body><canvas id="c" width="${WIDTH}" height="${HEIGHT}"></canvas></body>`);
		return;
	}
	const filePath = path.join(root, requestPath);
	if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) { response.writeHead(404); response.end(); return; }
	response.writeHead(200, { "Content-Type": types[path.extname(filePath)] ?? "application/octet-stream" });
	fs.createReadStream(filePath).pipe(response);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal"], ignoreDefaultArgs: ["--disable-gpu"] });
try {
	for (const variant of variants) {
		const page = await browser.newPage();
		page.on("pageerror", (error) => console.log("페이지 오류", error.message));
		await page.goto("http://127.0.0.1:" + server.address().port + "/?" + variant.replace(/,/g, "&"), { waitUntil: "load" });
		const result = await page.evaluate(async (width, height) => {
			const stub = new URLSearchParams(globalThis.location.search).get("stub") || "";
			const stubList = stub.split("+");
			// 패스 셰이더를 읽지 않고 바로 쓰는 것으로 바꿈. (판, 상태, 유니폼 올림은 그대로)
			const gl = document.getElementById("c").getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
			const originalShaderSource = gl.shaderSource.bind(gl);
			gl.shaderSource = (shader, source) => {
				let kind = null;
				if (source.includes("SLICE_COUNT") && source.includes("readArc")) { kind = "occ"; }
				else if (source.includes("occlusionTexture") && source.includes("nearestCell")) { kind = "up"; }
				else if (source.includes("occlusionTexture") && source.includes("GAUSSIAN_WEIGHTS")) { kind = "blur"; }
				if (kind !== null && stubList.includes(kind)) {
					source = source.replace("void main()", "void mainOriginal()") + "\nvoid main() { fragmentColor = vec4(1.0); }\n";
				}
				originalShaderSource(shader, source);
			};
			const vanilla = await import("/import.js");
			const { createRoomScene } = await import("/tests/graphics3d/toonroomscene.mjs");
			const scene = createRoomScene(vanilla, gl, width, height, "item", false);
			const postProcess = new vanilla.ToonPostProcess(gl, width, height);
			postProcess.setAmbientOcclusion(new URLSearchParams(globalThis.location.search).get("ao") !== "off", 0.5, 0.4, 0.5, 1);
			scene.queue.setPostProcess(postProcess);
			scene.drawFrame(1);
			scene.drawFrame(2);
			const lineTarget = scene.screenOutline.getLineTarget();
			const view = scene.camera.getViewMatrix();
			const projection = scene.camera.getProjectionMatrix();
			const one = new Uint8Array(4);
			let hash = 0;
			const times = [];
			for (let round = 0; round < 5; ++round) {
				gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, one);
				const start = performance.now();
				for (let frame = 0; frame < 30; ++frame) {
					scene.drawFrame(3 + frame);
				}
				gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, one);
				times.push((performance.now() - start) / 30);
			}
			times.sort((a, b) => a - b);
			scene.drawFrame(3);
			const shot = document.getElementById("c").toDataURL("image/png");
			return { shot: shot, msPerCall: Number(times[2].toFixed(3)), times: times.map((v) => Number(v.toFixed(3))), lineTarget: lineTarget === null ? null : [lineTarget.width, lineTarget.height] };
		}, WIDTH, HEIGHT);
		if (process.env.SHOT) {
			fs.writeFileSync(process.env.SHOT + "_" + variant.replace(/[^a-z0-9=+]/g, "") + ".png", Buffer.from(result.shot.split(",")[1], "base64"));
		}
		delete result.shot;
		console.log(variant.padEnd(28), JSON.stringify(result));
		await page.close();
	}
}
finally {
	await browser.close();
	server.close();
}
