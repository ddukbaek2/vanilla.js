//==============================================================================
// 글리프 아틀라스 글자 그리기의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/core/textglyphatlaschrome.test.mjs)
// - 원본은 글리프를 (글자 덩어리, 1/8 자리 칸) 열쇠로 아틀라스에 한 번만 굽고 문자열은 글리프 사각형으로 그린다.
//   헤드리스 크롬(창을 띄우지 않는다)에서 엔진이 그린 글자와, 예전 길(fillText 로 문자열을 통째로 구운 텍스처 한 장을 같은 그리기 길로)로 그린 것을 화소로 견준다.
//   (한글, 영어, 숫자, 섞인 글, 이모지, 합자, 아랍어, 태국어, 여러 크기와 굵기)
// - 같은 글자로 된 새 문자열은 굽지 않고(올린 수가 늘지 않고), 글자 많은 화면이 드로 콜 하나로 묶이는지 본다.
// - 크롬 경로는 CHROME_PATH 로 바꿀 수 있다. puppeteer-core 나 크롬이 없으면 실패한다. (말없이 건너뛰지 않는다)
//==============================================================================
const System = globalThis;
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

const server = http.createServer((request, response) => {
	const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
	if (requestPath === "/") {
		response.writeHead(200, { "Content-Type": "text/html" });
		response.end("<!doctype html><title>textglyphatlas</title><style>body{margin:0;background:#000}canvas{width:100vw;height:100vh;display:block}</style>");
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
try {
	const page = await browser.newPage();
	const pageErrorList = [];
	page.on("pageerror", (error) => pageErrorList.push(error.message));
	await page.setViewport({ width: 640, height: 480, deviceScaleFactor: 1 });
	await page.goto(`http://127.0.0.1:${port}/`);
	const result = await page.evaluate(async () => {
		const System = globalThis;
		const { Engine, EngineConfiguration, Scene, Vector2 } = await import("/import.js");
		const lineList = [
			["16px sans-serif", "Score 12345 HP 98/100"],
			["bold 13px sans-serif", "안녕하세요 뚝백이님 가격 1,234원"],
			["italic 20px serif", "AVATAR Toyota office ﬁ fi ffl"],
			["24px system-ui", "office fifty Wâté naïve"],
			["18px sans-serif", "😀👍🏽 👨‍👩‍👧 🇰🇷 1️⃣"],
			["18px sans-serif", "مرحبا بالعالم 123"],
			["18px sans-serif", "สวัสดีครับ नमस्ते Привет"],
			["11px monospace", "1234567890 +-*/=% Mixed 한글"],
		];
		let frame = 0;
		let phase = "lines";
		const referenceTextureList = [];
		const statistics = {};
		class MainScene extends Scene {
			initialize(engine) {
				const graphic = engine.getGraphic();
				graphic.setTextBakeScaleStep(0);
				graphic.setTextPixelSnapEnabled(true);
			}
			draw(graphic) {
				super.draw(graphic);
				frame += 1;
				// 프레임마다 검게 비운다. (preserveDrawingBuffer 라 지난 프레임 글이 겹쳐 쌓이지 않게)
				graphic.flushSpriteBatch();
				const clearContext = graphic.getWebGL2RenderingContext();
				clearContext.clearColor(0, 0, 0, 1);
				clearContext.clear(clearContext.COLOR_BUFFER_BIT);
				graphic.setFillColor("#ffffff");
				graphic.setTextAlign("left");
				graphic.setTextBaseline("alphabetic");
				if (phase === "lines") {
					lineList.forEach(([fontString, text], lineIndex) => {
						graphic.setFontString(fontString);
						graphic.drawFillText(text, 8, 40 + lineIndex * 50);
					});
				}
				else if (phase === "reference") {
					// 예전 길: 문자열을 fillText 로 캔버스 한 장에 굽고(여유 2, 펜은 정수 자리) 텍스처 하나로 그린다.
					const webGL2RenderingContext = graphic.getWebGL2RenderingContext();
					lineList.forEach(([fontString, text], lineIndex) => {
						if (referenceTextureList[lineIndex] === undefined) {
							const bakeCanvas = document.createElement("canvas");
							const bakeContext = bakeCanvas.getContext("2d", { willReadFrequently: false });
							bakeContext.font = fontString;
							bakeContext.direction = /[\u0590-\u08FF]/.test(text[0]) ? "rtl" : "ltr";
							bakeContext.textAlign = "left";
							const textMetrics = bakeContext.measureText(text);
							const penX = 2 + System.Math.ceil(System.Math.max(textMetrics.actualBoundingBoxLeft, 0));
							const baselineY = 2 + System.Math.ceil(textMetrics.fontBoundingBoxAscent);
							bakeCanvas.width = penX + System.Math.ceil(System.Math.max(textMetrics.actualBoundingBoxRight, 0)) + 2;
							bakeCanvas.height = baselineY + System.Math.ceil(textMetrics.fontBoundingBoxDescent) + 2;
							bakeContext.font = fontString;
							bakeContext.textAlign = "left";
							bakeContext.fillStyle = "#ffffff";
							bakeContext.fillText(text, penX, baselineY);
							const texture = webGL2RenderingContext.createTexture();
							webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, texture);
							webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
							webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.RGBA, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, bakeCanvas);
							webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
							webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, webGL2RenderingContext.LINEAR);
							webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
							webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);
							graphic.invalidateRenderStateCache();
							referenceTextureList[lineIndex] = { texture: texture, penX: penX, baselineY: baselineY, width: bakeCanvas.width, height: bakeCanvas.height };
						}
						const reference = referenceTextureList[lineIndex];
						const left = 8 - reference.penX;
						const top = 40 + lineIndex * 50 - reference.baselineY;
						const floatCount = graphic.writeQuad(0, left, top, left + reference.width, top + reference.height, 0, 0, 1, 1);
						graphic.drawVertices(floatCount / 4, reference.texture, graphic.getWhiteColor());
					});
				}
				else {
					// 글자 많은 화면. (줄 50 개, 숫자만 바뀌는 새 문자열)
					graphic.setFontString("14px sans-serif");
					for (let lineIndex = 0; lineIndex < 50; ++lineIndex) {
						graphic.drawFillText(`${(lineIndex * 7919 + frame * 104729) % 100000}`, 8 + (lineIndex % 5) * 120, 20 + System.Math.floor(lineIndex / 5) * 20);
					}
				}
			}
		}
		const engineConfiguration = new EngineConfiguration();
		engineConfiguration.referenceResolutionSize = Vector2.create(640, 480);
		engineConfiguration.preserveDrawingBuffer = true;
		const engine = new Engine(engineConfiguration);
		engine.run(new MainScene());
		const waitFrames = async (count) => {
			const target = frame + count;
			while (frame < target) {
				await new Promise((resolve) => requestAnimationFrame(resolve));
			}
		};
		await waitFrames(3);

		// 엔진이 그린 화면과 예전 길로 그린 화면의 화소 견주기. (흰 글을 검은 바탕에)
		const graphic = engine.getGraphic();
		const webGL2RenderingContext = graphic.getWebGL2RenderingContext();
		const width = webGL2RenderingContext.drawingBufferWidth;
		const height = webGL2RenderingContext.drawingBufferHeight;
		const readFrame = () => {
			const pixels = new Uint8Array(width * height * 4);
			webGL2RenderingContext.readPixels(0, 0, width, height, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, pixels);
			return pixels;
		};
		const enginePixels = readFrame();
		// 찍은 것이 글이 그려진 장면인지(전부 검정이 아닌지) 센다. 로딩 화면이나 빈 화면끼리 견주면 아무것도 확인하지 못한다.
		let litPixelCount = 0;
		for (let index = 0; index < enginePixels.length; index += 4) {
			if (enginePixels[index] !== 0 || enginePixels[index + 1] !== 0 || enginePixels[index + 2] !== 0) {
				litPixelCount += 1;
			}
		}
		statistics.litPixelCount = litPixelCount;
		phase = "reference";
		await waitFrames(3);
		const referencePixels = readFrame();
		const lineDifferenceList = lineList.map(() => ({ count: 0, maximum: 0 }));
		for (let y = 0; y < height; ++y) {
			const lineIndex = System.Math.min(System.Math.floor((y - 5) / 50), lineList.length - 1);
			for (let x = 0; x < width; ++x) {
				for (let channel = 0; channel < 4; ++channel) {
					const pixelOffset = ((height - 1 - y) * width + x) * 4 + channel;
					const difference = System.Math.abs(enginePixels[pixelOffset] - referencePixels[pixelOffset]);
					if (difference > 1 && lineIndex >= 0) {
						lineDifferenceList[lineIndex].count += 1;
						lineDifferenceList[lineIndex].maximum = System.Math.max(lineDifferenceList[lineIndex].maximum, difference);
					}
				}
			}
		}

		// 숫자만 바뀌는 새 문자열은 처음 몇 프레임 뒤로 굽지 않고, 50 줄이 드로 콜 하나다.
		const textStringTextureCache = graphic.getTextStringTextureCache();
		phase = "numbers";
		await waitFrames(3);
		const uploadCountBefore = textStringTextureCache.readAtlasStatistics().uploadCount;
		await waitFrames(3);
		statistics.uploadCountGrowth = textStringTextureCache.readAtlasStatistics().uploadCount - uploadCountBefore;
		statistics.drawCallCount = graphic.getLastFrameDrawCallCount();
		statistics.atlasPageCount = textStringTextureCache.readAtlasStatistics().atlasPageCount;
		return { lineDifferenceList, statistics };
	});
	checkEqual(pageErrorList.length, 0, "페이지 오류 " + pageErrorList.join(" / "));
	check(result.statistics.litPixelCount >= 2000, `글이 그려진 장면을 찍었다 (검정이 아닌 화소 ${result.statistics.litPixelCount})`);
	result.lineDifferenceList.forEach((lineDifference, lineIndex) => {
		// 글리프 잉크가 겹치는 화소(기울임, 이모지)는 8 비트 겹치기 반올림으로 1, 2 단계 다를 수 있다.
		check(lineDifference.count <= 4 && lineDifference.maximum <= 6, `줄 ${lineIndex} 예전 길과 다른 화소 ${lineDifference.count} 개, 최대 ${lineDifference.maximum}`);
	});
	checkEqual(result.statistics.uploadCountGrowth, 0, "아는 숫자로 된 새 문자열은 굽지 않음");
	check(result.statistics.drawCallCount <= 2, "글자 50 줄 드로 콜 " + result.statistics.drawCallCount);
	checkEqual(result.statistics.atlasPageCount, 1, "아틀라스 장 수");
	console.log("줄마다 예전 길과 다른 화소(2 단계 넘게): " + result.lineDifferenceList.map((lineDifference) => lineDifference.count + "/" + lineDifference.maximum).join(", ") + ", 드로 콜 " + result.statistics.drawCallCount);
}
finally {
	await browser.close();
	server.close();
}
finish("textglyphatlaschrome");
