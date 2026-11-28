//==============================================================================
// 해 그림자 치우침의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/graphics3d/shadowbiaschrome.test.mjs)
// - 헤드리스 크롬(창을 띄우지 않는다)에서 ToonView3D 안에 직교 원 행렬 카메라(Camera3D.setMatrices)로 바닥과 벽을 그리고,
//   ShadowMap(near 1, far 100) 을 ToonDrawQueue.drawShadows 로 그려 setShadow 로 받는다. 같은 장면을 그림자 받기 켜고 끄고 그려 견준다.
// - 1. 여드름: extent 40, 해상도 512 에서 해를 받는 벽의 두 옆면(빛과 약 84 도, 73 도)이 제 그림자를 받지 않는다.
//   (치우침을 셰이더에 0.0015 깊이와 0.02 노멀로 박아 두었을 때는 두 면이 그림자 깊은 곳만큼 어두워졌다)
// - 2. 떠 보임: extent 2, 해상도 2048 에서 높이 0.1 의 낮은 벽도 밑동에 붙은 그림자를 드리운다. (박아 둔 치우침은 월드 0.15 라 그림자가 아예 없었다)
// - 3. 높이 2 의 벽 그림자는 extent 8 에서 밑동부터 해 방향대로 끝(z -2.1)까지 닿는다.
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
		response.end("<!doctype html><title>shadowbias</title><style>html,body{margin:0;width:100%;height:100%}canvas{display:block;width:100%;height:100%}</style><body><canvas id=\"gameCanvas\"></canvas></body>");
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
const browser = await launchBrowser(puppeteer, { executablePath, headless: true, protocolTimeout: 60000 });

// 한 장면 그리기. (벽의 두 옆면 7x7 화소와, 벽 그늘 쪽 바닥 x=0 줄의 z -1.5 ~ -2.3 화소 밝기)
const capture = async (extent, resolution, wallHeight, receivesShadow) => {
	const page = await browser.newPage();
	await page.setViewport({ width: 400, height: 300, deviceScaleFactor: 1 });
	await gotoPage(page, "http://127.0.0.1:" + port + "/");
	const captured = await page.evaluate(async (extent, resolution, wallHeight, receivesShadow) => {
		const { Engine, EngineConfiguration, Scene, WorldNode, Vector2, Vector3, Matrix4, Pivot, ToonView3D, ToonDrawQueue, MeshBuilder, createBoxGeometry, ShadowMap } = await import("/import.js");
		return await new Promise((resolve) => {
			let frame = 0;
			class MainScene extends Scene {
				initialize(engine) {
					super.initialize(engine);
					const node = new WorldNode();
					this.getRoot().addChild(node);
					node.setPivot(Pivot.topLeft);
					node.setLocalPosition(Vector2.create(0, 0));
					node.setContentSizeXY(400, 300);
					const view = node.addComponent(ToonView3D);
					const floorBuilder = new MeshBuilder();
					floorBuilder.addPart(createBoxGeometry(12, 0.2, 12), Matrix4.createTranslation(0, -0.1, 0), "#d0c0a0");
					const wallBuilder = new MeshBuilder();
					wallBuilder.addPart(createBoxGeometry(1, wallHeight, 3), Matrix4.createTranslation(0, wallHeight * 0.5, 0), "#a0a0d0");
					const floorArrays = floorBuilder.readArrays();
					const wallArrays = wallBuilder.readArrays();
					const queue = new ToonDrawQueue();
					let floorMesh = null;
					let wallMesh = null;
					let shadowMap = null;
					// 빛이 나아가는 방향. (+x 면과 약 84 도, +z 면과 약 73 도로 스친다, 그림자는 -x, -z 쪽)
					const lightDirection = [-0.1, -1, -0.3];
					// 면을 보는 카메라와 그늘 쪽 바닥을 내려다보는 카메라. (둘 다 직교 원 행렬)
					const sideViewMatrix = Matrix4.createLookAt(Vector3.create(8, 6, 8), Vector3.create(0, 1, 0), Vector3.create(0, 1, 0));
					const sideProjectionMatrix = Matrix4.createOrthographic(-4, 4, -3, 3, 0.1, 40);
					const floorViewMatrix = Matrix4.createLookAt(Vector3.create(0, 8, -1.801), Vector3.create(0, 0, -1.8), Vector3.create(0, 0, 1));
					const floorProjectionMatrix = Matrix4.createOrthographic(-1, 1, -0.75, 0.75, 0.1, 40);
					const drawOptions = { hasOutline: false, receivesShadow: receivesShadow };
					view.setDrawCallback((renderer, camera) => {
						if (floorMesh === null) {
							floorMesh = renderer.createMesh(floorArrays);
							wallMesh = renderer.createMesh(wallArrays);
							shadowMap = new ShadowMap(renderer.getWebGL2RenderingContext(), resolution);
						}
						camera.setMatrices(frame < 8 ? sideViewMatrix : floorViewMatrix, frame < 8 ? sideProjectionMatrix : floorProjectionMatrix);
						shadowMap.updateLightMatrix(Vector3.create(0, 0, 0), Vector3.create(lightDirection[0], lightDirection[1], lightDirection[2]), extent, 1, 100);
						queue.clear();
						queue.addMesh(floorMesh, Matrix4.createIdentity(), drawOptions);
						queue.addMesh(wallMesh, Matrix4.createIdentity(), drawOptions);
						queue.drawShadows(renderer, shadowMap);
						renderer.setSunDirection(lightDirection);
						renderer.setShadow(shadowMap, 1);
						queue.draw(renderer, camera);
					});
					this.readPoint = (x, y, z) => {
						const clip = view.getCamera().getViewProjectionMatrix().transformPoint(x, y, z);
						return [Math.floor((clip.x * 0.5 + 0.5) * 400), Math.floor((clip.y * 0.5 + 0.5) * 300)];
					};
				}
				draw(graphic) {
					super.draw(graphic);
					frame++;
					const gl = graphic.getWebGL2RenderingContext();
					if (frame === 7) {
						graphic.flushBatch();
						const readPatch = (point) => {
							const pixels = new Uint8Array(7 * 7 * 4);
							gl.readPixels(point[0] - 3, point[1] - 3, 7, 7, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
							return Array.from(pixels);
						};
						this.patches = { side: readPatch(this.readPoint(0.5, wallHeight * 0.5, 0)), front: readPatch(this.readPoint(0, wallHeight * 0.5, 1.5)) };
					}
					if (frame === 14) {
						graphic.flushBatch();
						const line = [];
						for (let step = 0; step < 160; ++step) {
							const point = this.readPoint(0, 0, -1.5 - step * 0.005);
							const pixels = new Uint8Array(4);
							gl.readPixels(point[0], point[1], 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
							line.push(pixels[0] + pixels[1] + pixels[2]);
						}
						resolve({ side: this.patches.side, front: this.patches.front, line: line });
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
	}, extent, resolution, wallHeight, receivesShadow);
	await page.close();
	return captured;
};

// 그림자 받기 켜고 끈 두 장의 차이. (면마다 RGB 평균 어두워진 몫, 바닥 줄은 그림자 깊은 곳 절반 넘게 어두운 첫 자리와 끝 자리의 z)
const measure = async (extent, resolution, wallHeight) => {
	const withShadow = await capture(extent, resolution, wallHeight, true);
	const withoutShadow = await capture(extent, resolution, wallHeight, false);
	const readDarkening = (name) => {
		let sum = 0;
		let count = 0;
		for (let index = 0; index < withShadow[name].length; index += 4) {
			for (let channel = 0; channel < 3; ++channel) {
				sum += withoutShadow[name][index + channel] - withShadow[name][index + channel];
				count++;
			}
		}
		return sum / count;
	};
	const darkList = withShadow.line.map((value, index) => withoutShadow.line[index] - value);
	const deep = System.Math.max(...darkList);
	let first = -1;
	let last = -1;
	darkList.forEach((value, index) => {
		if (value > deep * 0.5) {
			first = first < 0 ? index : first;
			last = index;
		}
	});
	return { side: readDarkening("side"), front: readDarkening("front"), deep: deep, bandStart: first < 0 ? null : -1.5 - first * 0.005, bandEnd: last < 0 ? null : -1.5 - last * 0.005 };
};

let coarse = null;
let low = null;
let tall = null;
try {
	coarse = await measure(40, 512, 2);
	low = await measure(2, 2048, 0.1);
	tall = await measure(8, 2048, 2);
}
finally {
	await browser.close();
	server.close();
}
console.log("  extent 40 해상도 512: 84 도 면 " + coarse.side.toFixed(1) + ", 73 도 면 " + coarse.front.toFixed(1));
console.log("  extent 2 높이 0.1: 그림자 " + low.bandStart + " ~ " + low.bandEnd + " (깊이 " + low.deep + "), extent 8 높이 2: " + tall.bandStart + " ~ " + tall.bandEnd);
// 1. 여드름이 없다.
check(coarse.side < 1, "빛과 84 도로 스치는 면이 제 그림자를 받지 않음 (어두워진 몫 " + coarse.side.toFixed(1) + ")");
check(coarse.front < 1, "빛과 73 도로 스치는 면이 제 그림자를 받지 않음 (어두워진 몫 " + coarse.front.toFixed(1) + ")");
// 2. 낮은 벽도 붙은 그림자를 드리운다. (높이 0.1 x 해의 기울기 0.3 = 밑동에서 0.03)
check(low.bandStart !== null && low.deep > 60, "높이 0.1 의 벽이 그림자를 드리움 (깊이 " + low.deep + ")");
check(low.bandStart >= -1.51, "낮은 벽의 그림자가 밑동에 붙음 (시작 " + low.bandStart + ")");
check(System.Math.abs(low.bandEnd - -1.53) <= 0.01, "낮은 벽의 그림자 끝이 해 방향대로 z -1.53 (끝 " + low.bandEnd + ")");
// 3. 높은 벽의 그림자는 밑동부터 끝까지.
check(tall.bandStart >= -1.51, "높은 벽의 그림자가 밑동에 붙음 (시작 " + tall.bandStart + ")");
check(System.Math.abs(tall.bandEnd - -2.1) <= 0.02, "높은 벽의 그림자 끝이 해 방향대로 z -2.1 (끝 " + tall.bandEnd + ")");
console.log("해 그림자 치우침 크롬 시험 통과 (" + checkCount + " 검사)");
