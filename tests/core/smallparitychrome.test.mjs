//==============================================================================
// 러스트 판 꼴 맞추기 작은 것들의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/core/smallparitychrome.test.mjs)
// - 러스트 판 짝: src/core/graphic.rs 의 resolve_shader_program(이름으로 담기, 실패는 한 번만 알리고 None),
//   src/effect/screeneffect.rs 의 ScreenEffect::new(), src/ui/uiinputfield.rs 의 Engine 으로 여는 문맥 메뉴.
// - 헤드리스 크롬(창을 띄우지 않는다)에서 돌린다.
//==============================================================================
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";
import { check, checkEqual, finish } from "../testcheck.mjs";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const repositoryPath = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");
const contentTypeTable = { ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".html": "text/html" };

// 저장소를 잠깐 내주는 http 서버. (모듈은 file:// 로 못 불러온다)
const server = http.createServer((request, response) => {
	const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
	if (requestPath === "/") {
		response.writeHead(200, { "Content-Type": "text/html" });
		response.end("<!doctype html><title>smallparity</title><link rel=\"icon\" href=\"data:,\"><style>body{margin:0}</style>");
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
const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
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
	await page.goto("http://127.0.0.1:" + port + "/");
	result = await page.evaluate(async () => {
		const Vanilla = await import("/import.js");
		const { Engine, EngineConfiguration, UIScene, UIInputField, ScreenEffect, ScreenEffectType, Vector2, Rect } = Vanilla;
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
		const engineConfiguration = new EngineConfiguration();
		engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
		engineConfiguration.useDevTools = false;
		engineConfiguration.defaultFontUrl = "";
		const engine = new Engine(engineConfiguration);
		let isInitialized = false;
		class SmallScene extends UIScene {
			constructor() {
				super();
				this.setLoadingMinDurationMs(0);
			}

			initialize(engine) {
				super.initialize(engine);
				isInitialized = true;
			}
		}
		engine.run(new SmallScene());
		for (let frameIndex = 0; frameIndex < 600 && !isInitialized; ++frameIndex) {
			await waitFrames(1);
		}
		await waitFrames(3);
		const graphic = engine.getGraphic();

		// resolveShaderProgram: 같은 이름은 한 번만 짓고, 실패는 null 로 담아 다시 짓지 않는다.
		const vertexSource = "#version 300 es\nlayout(location=0) in vec2 vertexPosition;in vec2 vertexTextureCoordinate;uniform mat3 projectionMatrix;out vec2 fragmentTextureCoordinate;void main(){fragmentTextureCoordinate=vertexTextureCoordinate;gl_Position=vec4((projectionMatrix*vec3(vertexPosition,1.0)).xy,0.0,1.0);}";
		const fragmentSource = "#version 300 es\nprecision highp float;in vec2 fragmentTextureCoordinate;uniform sampler2D mainTexture;out vec4 outputColor;void main(){outputColor=texture(mainTexture,fragmentTextureCoordinate);}";
		let createCount = 0;
		const first = graphic.resolveShaderProgram("smalltest", "plain", () => {
			createCount += 1;
			return [vertexSource, fragmentSource];
		});
		const second = graphic.resolveShaderProgram("smalltest", "plain", () => {
			createCount += 1;
			return [vertexSource, fragmentSource];
		});
		output.isResolved = first !== null;
		output.isSame = first === second;
		output.createCount = createCount;
		const otherGroup = graphic.resolveShaderProgram("smalltest2", "plain", () => [vertexSource, fragmentSource]);
		output.isOtherGroupDifferent = otherGroup !== null && otherGroup !== first;
		const originalError = console.error;
		const errorList = [];
		console.error = (message) => {
			errorList.push(String(message));
		};
		let badCreateCount = 0;
		const bad = graphic.resolveShaderProgram("smalltest", "bad", () => {
			badCreateCount += 1;
			return [vertexSource, "#version 300 es\nthis is not glsl"];
		});
		const badAgain = graphic.resolveShaderProgram("smalltest", "bad", () => {
			badCreateCount += 1;
			return [vertexSource, "#version 300 es\nthis is not glsl"];
		});
		console.error = originalError;
		output.bad = bad;
		output.badAgain = badAgain;
		output.badCreateCount = badCreateCount;
		output.errorCount = errorList.length;
		output.errorHasName = errorList.length > 0 && errorList[0].includes("smalltest.bad");

		// ScreenEffect 는 인자 없이 만들고 처음 그릴 때 그래픽을 받는다. (그리기 전에 부숴도 된다)
		const screenEffect = new ScreenEffect();
		screenEffect.setEnabled(ScreenEffectType.vignette, true);
		screenEffect.begin(graphic);
		screenEffect.end(graphic);
		output.screenEffectDrew = true;
		screenEffect.destroy();
		new ScreenEffect().destroy();

		// UIInputField 는 setEngine 을 안 불러도 Engine.getEngine() 으로 문맥 메뉴 손잡이를 붙인다.
		const canvas = engine.getViewManager().getCanvas();
		let contextMenuListenerCount = 0;
		const originalAddEventListener = canvas.addEventListener.bind(canvas);
		canvas.addEventListener = (type, listener, options) => {
			if (type === "contextmenu") {
				contextMenuListenerCount += 1;
			}
			return originalAddEventListener(type, listener, options);
		};
		const inputField = new UIInputField();
		inputField.attachContextMenuHandler();
		output.contextMenuListenerCount = contextMenuListenerCount;
		inputField.detachContextMenuHandler();
		return output;
	});
}
finally {
	await browser.close();
	server.close();
}

check(result.isResolved, "resolveShaderProgram 이 프로그램을 지음");
check(result.isSame, "같은 묶음, 이름은 같은 프로그램");
checkEqual(result.createCount, 1, "소스 만드는 함수는 한 번만 부름");
check(result.isOtherGroupDifferent, "묶음이 다르면 다른 프로그램");
checkEqual(result.bad, null, "짓기에 실패하면 null");
checkEqual(result.badAgain, null, "실패도 담아 둠");
checkEqual(result.badCreateCount, 1, "실패한 이름은 다시 짓지 않음");
checkEqual(result.errorCount, 1, "실패는 한 번만 알림");
check(result.errorHasName, "알림에 묶음.이름이 든다");
checkEqual(result.screenEffectDrew, true, "인자 없는 ScreenEffect 가 처음 그릴 때 그래픽을 받음");
checkEqual(result.contextMenuListenerCount, 1, "setEngine 없이도 Engine.getEngine() 으로 문맥 메뉴 손잡이를 붙임");
finish("러스트 판 꼴 맞추기 작은 것들 (크롬)");
