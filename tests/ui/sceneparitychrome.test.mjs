//==============================================================================
// 씬과 툰 효과의 두 엔진 짝 크롬 시험. (NODE_PATH=$(npm root -g) node tests/ui/sceneparitychrome.test.mjs)
// - 엔진과 캔버스, WebGL2 가 있어야 하는 것을 헤드리스 크롬(창을 띄우지 않는다)에서 본다.
// - 러스트 판 짝: src/ui/uiscene.rs 의 레이아웃(game_scene_base.compute_safe_area_rect 가 뷰 매니저의 세이프 에어리어 강제값을 따른다),
//   src/game/gamescene.rs 의 get_dev_tools, src/core/engine.rs 의 EngineConfiguration::view_scale_mode(기본 StretchShort),
//   src/core/scene.rs 의 set_scene_background_color 와 draw_scene_background,
//   src/graphics3d/toon/toonvfx.rs 의 ToonRibbonOptions, ToonBeamOptions(alpha 기본 1), ToonParticleOptions, ToonGlintOptions(position).
// - 크롬 경로는 CHROME_PATH 로 바꿀 수 있다. puppeteer-core 나 크롬이 없으면 실패한다. (말없이 건너뛰지 않는다)
//==============================================================================
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";
import { check, checkEqual, checkJson, checkNear, finish } from "../testcheck.mjs";
import { gotoPage, launchBrowser } from "../chromepage.mjs";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const repositoryPath = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");
const contentTypeTable = { ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".html": "text/html" };

// 저장소를 잠깐 내주는 http 서버. (모듈은 file:// 로 못 불러온다)
const server = http.createServer((request, response) => {
	const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
	if (requestPath === "/") {
		response.writeHead(200, { "Content-Type": "text/html" });
		response.end("<!doctype html><title>sceneparity</title><link rel=\"icon\" href=\"data:,\"><style>body{margin:0}</style>");
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
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;

const chromePathList = [
	...(process.env.CHROME_PATH ? [process.env.CHROME_PATH] : []),
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	"C:/Program Files/Google/Chrome/Application/chrome.exe",
	"/usr/bin/google-chrome",
];
const executablePath = chromePathList.find((chromePath) => fs.existsSync(chromePath));
check(executablePath !== undefined, "크롬을 찾지 못함 (CHROME_PATH)");
const browser = await launchBrowser(puppeteer, { executablePath, headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
let result = null;
try {
	const page = await browser.newPage();
	await page.setViewport({ width: 640, height: 360 });
	page.on("pageerror", (error) => {
		console.log("페이지 오류: " + error.message);
	});
	// 씬 로드는 오류를 console.error 로만 남긴다. (SceneManager.loadScene 의 catch) 그것도 보이게 한다.
	page.on("console", (message) => {
		if (message.type() === "error") {
			console.log("콘솔 오류: " + message.text() + (message.location()?.url ? " (" + message.location().url + ")" : ""));
		}
	});
	await gotoPage(page, "http://127.0.0.1:" + port + "/");
	result = await page.evaluate(async () => {
		const Vanilla = await import("/import.js");
		const { Engine, EngineConfiguration, UIScene, GameScene, Scene, Vector2, ViewScaleMode, ToonVfx, Matrix4, Vector3 } = Vanilla;
		const output = {};
		const waitFrames = (count) => new Promise((resolve) => {
			let left = count;
			const step = () => {
				left -= 1;
				if (left <= 0) {
					resolve();
				}
				else {
					requestAnimationFrame(step);
				}
			};
			requestAnimationFrame(step);
		});

		// 뷰 스케일 모드: 설정 기본은 stretchShort 이고 엔진이 뷰 매니저에 넣는다.
		const defaultConfiguration = new EngineConfiguration();
		output.defaultViewScaleMode = defaultConfiguration.viewScaleMode;
		output.stretchShort = ViewScaleMode.stretchShort;

		const engineConfiguration = new EngineConfiguration();
		engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
		engineConfiguration.viewScaleMode = ViewScaleMode.stretchShortExpandLong;
		engineConfiguration.useDevTools = false;
		engineConfiguration.defaultFontUrl = "";
		const engine = new Engine(engineConfiguration);
		output.engineViewScaleMode = engine.getViewManager().getViewScaleMode();
		output.stretchShortExpandLong = ViewScaleMode.stretchShortExpandLong;

		// UIScene 의 세이프 에어리어는 뷰 매니저의 강제값과 무시할 쪽을 따른다.
		engine.getViewManager().setSafeAreaOverride({ top: 40, right: 0, bottom: 20, left: 10 });
		engine.getViewManager().setIgnoredSafeAreaSides(["bottom"]);
		let isInitialized = false;
		class ParityScene extends UIScene {
			constructor() {
				super();
				this.setLoadingMinDurationMs(0);
			}

			initialize(engine) {
				super.initialize(engine);
				this.setSceneBackgroundColor("#204060");
				isInitialized = true;
			}
		}
		const scene = new ParityScene();
		engine.run(scene);
		for (let frameIndex = 0; frameIndex < 600 && !isInitialized; ++frameIndex) {
			await waitFrames(1);
		}
		output.isInitialized = isInitialized;
		await waitFrames(5);
		const viewManager = engine.getViewManager();
		const insets = viewManager.getSafeAreaInsets();
		const safeAreaRect = scene.computeSafeAreaRect();
		const viewSize = viewManager.getViewSize();
		output.insets = [insets.top, insets.right, insets.bottom, insets.left];
		output.safeAreaRect = [safeAreaRect.position.x, safeAreaRect.position.y, safeAreaRect.size.x, safeAreaRect.size.y];
		output.expectedSafeAreaRect = [insets.left, insets.top, viewSize.x - insets.left - insets.right, viewSize.y - insets.top - insets.bottom];
		const layoutInsets = scene.getSafeAreaInsets ? scene.getSafeAreaInsets() : null;
		output.layoutInsets = layoutInsets ? [layoutInsets.top, layoutInsets.right, layoutInsets.bottom, layoutInsets.left] : null;
		output.devToolsIsNull = scene.getDevTools() === null;
		output.sceneViewScaleMode = viewManager.getViewScaleMode();

		// 배경은 Scene.drawSceneBackground 가 캔버스 전체에 칠한다. (세이프 에어리어 바깥 왼쪽 위 점)
		const canvas = document.querySelector("canvas");
		const probeCanvas = document.createElement("canvas");
		probeCanvas.width = canvas.width;
		probeCanvas.height = canvas.height;
		const probeContext = probeCanvas.getContext("2d");
		probeContext.drawImage(canvas, 0, 0);
		output.backgroundPixel = Array.from(probeContext.getImageData(2, 2, 1, 1).data);
		output.sceneMethods = [typeof Scene.prototype.setSceneBackgroundColor, typeof Scene.prototype.getSceneBackgroundColor, typeof Scene.prototype.drawSceneBackground];
		output.gameSceneDevTools = typeof GameScene.prototype.getDevTools;
		engine.stop?.();

		// ToonVfx: alpha 를 주지 않은 리본과 빔도 그린다. (러스트 판 기본 1) 자리는 position 으로 받는다.
		const drawVfx = (enqueue) => {
			const vfxCanvas = document.createElement("canvas");
			vfxCanvas.width = 64;
			vfxCanvas.height = 64;
			const webGL2RenderingContext = vfxCanvas.getContext("webgl2", { preserveDrawingBuffer: true, premultipliedAlpha: true });
			if (!webGL2RenderingContext) {
				return null;
			}
			const vfx = new ToonVfx(webGL2RenderingContext);
			const viewMatrix = Matrix4.createLookAt(Vector3.create(0, 0, 5), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
			const projectionMatrix = Matrix4.createOrthographic(-2, 2, -2, 2, 0.1, 50);
			webGL2RenderingContext.viewport(0, 0, 64, 64);
			webGL2RenderingContext.clearColor(0, 0, 0, 1);
			webGL2RenderingContext.clear(webGL2RenderingContext.COLOR_BUFFER_BIT | webGL2RenderingContext.DEPTH_BUFFER_BIT);
			enqueue(vfx);
			vfx.update(0.05);
			vfx.draw(viewMatrix, projectionMatrix);
			const pixels = new Uint8Array(64 * 64 * 4);
			webGL2RenderingContext.readPixels(0, 0, 64, 64, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, pixels);
			let litCount = 0;
			let leftLit = 0;
			let rightLit = 0;
			for (let index = 0; index < pixels.length; index += 4) {
				if (pixels[index] + pixels[index + 1] + pixels[index + 2] > 30) {
					litCount += 1;
					const column = (index / 4) % 64;
					if (column < 32) {
						leftLit += 1;
					}
					else {
						rightLit += 1;
					}
				}
			}
			return { litCount, leftLit, rightLit, counts: vfx.getActiveCounts() };
		};
		const ribbonPoints = [[-1.5, 0, 0], [0, 0.3, 0], [1.5, 0, 0]];
		output.ribbonDefault = drawVfx((vfx) => vfx.queueRibbon({ points: ribbonPoints, width: 0.4, brightness: 2 }));
		output.ribbonZero = drawVfx((vfx) => vfx.queueRibbon({ points: ribbonPoints, width: 0.4, brightness: 2, alpha: 0 }));
		output.beamDefault = drawVfx((vfx) => vfx.queueBeam({ start: [-1.5, 0, 0], end: [1.5, 0, 0], radius: 0.3, isCore: true, brightness: 2 }));
		output.lightningDefault = drawVfx((vfx) => vfx.queueLightning({ start: [-1.5, 0, 0], end: [1.5, 0, 0], radius: 0.1, width: 0.3, brightness: 2 }));
		output.glintRight = drawVfx((vfx) => vfx.queueGlint({ position: [1, 0, 0], size: 0.8, brightness: 3 }));
		output.glintLeft = drawVfx((vfx) => vfx.queueGlint({ position: [-1, 0, 0], size: 0.8, brightness: 3 }));
		output.particleRight = drawVfx((vfx) => vfx.emitParticles({ count: 8, position: [1, 0, 0], speed: 0, size: 0.6, life: 2, brightness: 3 }));
		output.fireballCount = drawVfx((vfx) => vfx.addFireball({ position: [0, 0, 0], radius: 0.8, life: 1 })).counts.fireballCount;
		return output;
	});
}
finally {
	await browser.close();
	server.close();
}

checkEqual(result.isInitialized, true, "UIScene initialize 까지 감");
checkEqual(result.defaultViewScaleMode, result.stretchShort, "EngineConfiguration.viewScaleMode 기본 stretchShort (러스트 판 StretchShort)");
checkEqual(result.engineViewScaleMode, result.stretchShortExpandLong, "엔진이 설정의 뷰 스케일 모드를 뷰 매니저에 넣는다");
checkEqual(result.sceneViewScaleMode, "none", "UIScene 은 initialize 에서 저마다의 모드(기본 none)로 바꾼다");
checkNear([result.insets[1], result.insets[2]], [0, 0], 1e-6, "오른쪽과 무시한 아래쪽은 0");
check(result.insets[0] > 0 && result.insets[3] > 0, "강제값 위와 왼쪽을 읽음");
checkNear(result.safeAreaRect, result.expectedSafeAreaRect, 1e-6, "UIScene.computeSafeAreaRect 는 뷰 매니저 인셋을 따른다");
if (result.layoutInsets !== null) {
	checkNear(result.layoutInsets, result.insets, 1e-6, "UIScene 레이아웃 가이드 인셋도 같다");
}
checkEqual(result.devToolsIsNull, true, "useDevTools 를 끄면 UIScene.getDevTools 는 null");
checkEqual(result.gameSceneDevTools, "function", "GameScene.getDevTools");
checkJson(result.sceneMethods, ["function", "function", "function"], "Scene 의 배경 함수 셋");
checkJson(result.backgroundPixel.slice(0, 3), [0x20, 0x40, 0x60], "색 글로 정한 배경을 세이프 에어리어 바깥까지 칠함");
check(result.ribbonDefault !== null, "WebGL2 컨텍스트");
check(result.ribbonDefault.litCount > 20, "alpha 없는 리본도 그림 (" + result.ribbonDefault.litCount + ")");
checkEqual(result.ribbonZero.litCount, 0, "alpha 0 리본은 그리지 않음");
check(result.beamDefault.litCount > 20, "alpha 없는 빔도 그림 (" + result.beamDefault.litCount + ")");
check(result.lightningDefault.litCount > 20, "alpha 없는 번개도 그림 (" + result.lightningDefault.litCount + ")");
check(result.glintRight.rightLit > 0 && result.glintRight.leftLit === 0, "빛 점 position 오른쪽 (" + result.glintRight.leftLit + ", " + result.glintRight.rightLit + ")");
check(result.glintLeft.leftLit > 0 && result.glintLeft.rightLit === 0, "빛 점 position 왼쪽 (" + result.glintLeft.leftLit + ", " + result.glintLeft.rightLit + ")");
check(result.particleRight.rightLit > 0 && result.particleRight.leftLit === 0, "파티클 position 오른쪽 (" + result.particleRight.leftLit + ", " + result.particleRight.rightLit + ")");
checkEqual(result.fireballCount, 1, "불덩이 position");
finish("씬과 툰 효과의 두 엔진 짝 (크롬)");
