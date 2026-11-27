//==============================================================================
// 줄 높이를 넘는 잉크의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/core/texttallinkchrome.test.mjs)
// - 크롬 캔버스 fillText, strokeText 는 글꼴 상자(fontBoundingBox 오름, 내림) 밖의 잉크도 자르지 않는다.
//   원본 글 굽기도 문자열 사각형과 글리프 칸의 세로를 잉크(actualBoundingBox)까지 넓혀 자르지 않는지 본다.
//   (Ǻ 위 꺾쇠, 겹친 결합 부호, serif 의 높은 부호, 굵게, 이모지, 바깥선, 여러 크기, 굽기 배율 1 과 2)
// - 견줄 것은 같은 글을 크롬 캔버스 한 장에 넉넉한 여백으로 바로 fillText(바깥선은 strokeText) 해 텍스처 하나로 같은 그리기 길로 그린 것이다.
//   정수 자리(화소 맞추기)에서 다른 화소가 없어야 한다. 잉크가 줄 높이 안인 보통 글도 같은 장면에 넣어 함께 본다.
//   (크롬 맥은 안티앨리어싱 잉크가 actualBoundingBox 를 올림한 경계 밖 한 줄까지 번져, 여백이 1 이면 맨 위 한 줄이 다르다. 여백 2 에서 0)
// - 그림자 글(ShadowText)이 구운 캔버스도 네 가장자리 줄에 잉크와 번진 그림자가 닿지 않는지 본다.
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
		response.end("<!doctype html><title>texttallink</title><style>body{margin:0;background:#000}canvas{width:100vw;height:100vh;display:block}</style>");
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

// 줄마다 [글꼴, 글, 그리기("fill" 또는 "stroke"), 바깥선 굵기, 잉크가 줄 높이를 넘는가]
const lineList = [
	["32px sans-serif", "ǺǻẪ Ĩ̃ Å", "fill", 0, true],
	["40px serif", "Ĩ̃ Ǻ ẫ Ṏ", "fill", 0, true],
	["24px sans-serif", "e\u0303\u0301\u0302\u0308 x\u0332\u0333\u0347 Ǻ", "fill", 0, true],
	["bold 28px serif", "ǺẪ Ỗ Ĩ̃", "fill", 0, true],
	["14px sans-serif", "Ĩ̃ǺẪ e\u0303\u0301\u0302 작은 글", "fill", 0, true],
	["28px sans-serif", "😀👍🏽 Ǻ", "fill", 0, true],
	["32px sans-serif", "ǺĨ̃ẪỖ", "stroke", 3, true],
	["18px sans-serif", "Score 12345 안녕하세요 Wâté", "fill", 0, false],
];

//==============================================================================
// 한 배율로 장면을 그려 엔진 화면과 크롬 캔버스 화면을 견주기. (줄마다 다른 화소 수와 가장 큰 차이)
//==============================================================================
async function compareAtScale(browser, deviceScaleFactor) {
	const page = await browser.newPage();
	const pageErrorList = [];
	page.on("pageerror", (error) => pageErrorList.push(error.message));
	await page.setViewport({ width: 640, height: 640, deviceScaleFactor: deviceScaleFactor });
	await page.goto(`http://127.0.0.1:${port}/`);
	const result = await page.evaluate(async (lineList) => {
		const System = globalThis;
		const { Engine, EngineConfiguration, Scene, ShadowText, Vector2 } = await import("/import.js");
		const LINE_SPACING = 76;
		const FIRST_BASELINE = 60;
		const REFERENCE_PADDING = 40;
		let frame = 0;
		let phase = "lines";
		const referenceTextureList = [];
		let bakeScale = 1;
		class MainScene extends Scene {
			initialize(engine) {
				const graphic = engine.getGraphic();
				graphic.setTextBakeScaleStep(0);
				graphic.setTextPixelSnapEnabled(true);
			}
			draw(graphic) {
				super.draw(graphic);
				frame += 1;
				graphic.flushBatch();
				const clearContext = graphic.getWebGL2RenderingContext();
				clearContext.clearColor(0, 0, 0, 1);
				clearContext.clear(clearContext.COLOR_BUFFER_BIT);
				graphic.setFillColor("#ffffff");
				graphic.setStrokeColor("#ffffff");
				graphic.setTextAlign("left");
				graphic.setTextBaseline("alphabetic");
				bakeScale = graphic.calculateTextBakeScale();
				if (phase === "lines") {
					lineList.forEach(([fontString, text, mode, lineWidth], lineIndex) => {
						graphic.setFontString(fontString);
						if (mode === "stroke") {
							graphic.drawStrokeText(text, 8, FIRST_BASELINE + lineIndex * LINE_SPACING, lineWidth);
						}
						else {
							graphic.drawFillText(text, 8, FIRST_BASELINE + lineIndex * LINE_SPACING);
						}
					});
					return;
				}
				// 크롬 캔버스 한 장에 같은 글을 넉넉한 여백으로 바로 그려(굽기 배율로 키운 글꼴, 펜은 정수 자리) 텍스처 하나로 그린다.
				const webGL2RenderingContext = graphic.getWebGL2RenderingContext();
				lineList.forEach(([fontString, text, mode, lineWidth], lineIndex) => {
					if (referenceTextureList[lineIndex] === undefined) {
						const scaledFontString = fontString.replace(/(\d+(?:\.\d+)?)px/, (matched, sizeText) => `${System.Number.parseFloat(sizeText) * bakeScale}px`);
						const bakeCanvas = document.createElement("canvas");
						const bakeContext = bakeCanvas.getContext("2d");
						bakeContext.font = scaledFontString;
						bakeContext.textAlign = "left";
						const textMetrics = bakeContext.measureText(text);
						const scaledPadding = REFERENCE_PADDING * bakeScale;
						const penX = scaledPadding + System.Math.ceil(System.Math.max(textMetrics.actualBoundingBoxLeft, 0));
						const baselineY = scaledPadding + System.Math.ceil(System.Math.max(textMetrics.fontBoundingBoxAscent, textMetrics.actualBoundingBoxAscent));
						bakeCanvas.width = penX + System.Math.ceil(System.Math.max(textMetrics.actualBoundingBoxRight, 0)) + scaledPadding;
						bakeCanvas.height = baselineY + System.Math.ceil(System.Math.max(textMetrics.fontBoundingBoxDescent, textMetrics.actualBoundingBoxDescent)) + scaledPadding;
						bakeContext.font = scaledFontString;
						bakeContext.textAlign = "left";
						if (mode === "stroke") {
							bakeContext.strokeStyle = "#ffffff";
							bakeContext.lineWidth = lineWidth * bakeScale;
							bakeContext.strokeText(text, penX, baselineY);
						}
						else {
							bakeContext.fillStyle = "#ffffff";
							bakeContext.fillText(text, penX, baselineY);
						}
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
					const left = 8 - reference.penX / bakeScale;
					const top = FIRST_BASELINE + lineIndex * LINE_SPACING - reference.baselineY / bakeScale;
					const floatCount = graphic.writeQuad(0, left, top, left + reference.width / bakeScale, top + reference.height / bakeScale, 0, 0, 1, 1);
					graphic.drawVertices(floatCount / 4, reference.texture, graphic.getWhiteColor());
				});
			}
		}
		const engineConfiguration = new EngineConfiguration();
		engineConfiguration.referenceResolutionSize = Vector2.create(640, 640);
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
		const graphic = engine.getGraphic();
		const webGL2RenderingContext = graphic.getWebGL2RenderingContext();
		const width = webGL2RenderingContext.drawingBufferWidth;
		const height = webGL2RenderingContext.drawingBufferHeight;
		const readFrame = () => {
			const pixels = new Uint8Array(width * height * 4);
			webGL2RenderingContext.readPixels(0, 0, width, height, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, pixels);
			return pixels;
		};
		phase = "lines";
		await waitFrames(3);
		const enginePixels = readFrame();
		phase = "reference";
		await waitFrames(3);
		const referencePixels = readFrame();
		// 줄마다 다른 화소. (화면 세로를 줄 간격으로 나눠 센다, 위에서 아래)
		const pixelPerUnit = height / 640;
		const lineDifferenceList = lineList.map(() => ({ count: 0, maximum: 0, litCount: 0, left: Infinity, top: Infinity, right: -1, bottom: -1 }));
		for (let y = 0; y < height; ++y) {
			const lineIndex = System.Math.min(System.Math.max(System.Math.floor((y / pixelPerUnit - (FIRST_BASELINE - 56)) / LINE_SPACING), 0), lineList.length - 1);
			for (let x = 0; x < width; ++x) {
				const pixelOffset = ((height - 1 - y) * width + x) * 4;
				if (referencePixels[pixelOffset] !== 0) {
					lineDifferenceList[lineIndex].litCount += 1;
				}
				for (let channel = 0; channel < 4; ++channel) {
					const difference = System.Math.abs(enginePixels[pixelOffset + channel] - referencePixels[pixelOffset + channel]);
					if (difference > 0) {
						lineDifferenceList[lineIndex].count += 1;
						const lineDifference = lineDifferenceList[lineIndex];
						lineDifference.maximum = System.Math.max(lineDifference.maximum, difference);
						lineDifference.left = System.Math.min(lineDifference.left, x);
						lineDifference.right = System.Math.max(lineDifference.right, x);
						lineDifference.top = System.Math.min(lineDifference.top, y);
						lineDifference.bottom = System.Math.max(lineDifference.bottom, y);
					}
				}
			}
		}
		// 그림자 글(ShadowText)도 줄 높이를 넘는 잉크를 자르지 않는다. (구운 캔버스 네 가장자리 줄에 잉크와 번진 그림자가 닿지 않고 잉크는 있다)
		const shadowEdgeList = [];
		for (const [fontSize, text, shadowBlur] of [[32, "ǺǻẪ", 0], [24, "e\u0303\u0301\u0302\u0308 x\u0332\u0333", 0], [18, "Score 안녕", 0], [24, "Ǻ 번짐", 8]]) {
			const shadowText = new ShadowText();
			shadowText.setText(text);
			shadowText.setTextStyle(fontSize, false, "#ffffff");
			shadowText.setShadow("#ff0000", 1, 2, shadowBlur);
			shadowText.bakeText(graphic, text, 0, bakeScale, "ltr", null);
			const bakeCanvas = shadowText.getBakeCanvas();
			const pixels = bakeCanvas.getContext("2d").getImageData(0, 0, bakeCanvas.width, bakeCanvas.height).data;
			let edgeAlpha = 0;
			let inkAlpha = 0;
			for (let x = 0; x < bakeCanvas.width; ++x) {
				edgeAlpha += pixels[x * 4 + 3] + pixels[((bakeCanvas.height - 1) * bakeCanvas.width + x) * 4 + 3];
			}
			for (let y = 0; y < bakeCanvas.height; ++y) {
				edgeAlpha += pixels[y * bakeCanvas.width * 4 + 3] + pixels[(y * bakeCanvas.width + bakeCanvas.width - 1) * 4 + 3];
			}
			for (let index = 3; index < pixels.length; index += 4) {
				inkAlpha += pixels[index];
			}
			shadowEdgeList.push({ text: text, edgeAlpha: edgeAlpha, inkAlpha: inkAlpha });
		}
		return { lineDifferenceList, bakeScale, shadowEdgeList };
	}, lineList);
	await page.close();
	checkEqual(pageErrorList.length, 0, "페이지 오류 " + pageErrorList.join(" / "));
	return result;
}

const browser = await puppeteer.launch({ executablePath, headless: true });
try {
	for (const deviceScaleFactor of [1, 2]) {
		const result = await compareAtScale(browser, deviceScaleFactor);
		checkEqual(result.bakeScale, deviceScaleFactor, "굽기 배율");
		console.log(`배율 ${deviceScaleFactor} 줄마다 크롬 캔버스와 다른 화소(수/최대): ` + result.lineDifferenceList.map((lineDifference) => lineDifference.count + "/" + lineDifference.maximum + (lineDifference.count > 0 ? ` (${lineDifference.left},${lineDifference.top}~${lineDifference.right},${lineDifference.bottom})` : "")).join(", "));
		for (const shadowEdge of result.shadowEdgeList) {
			check(shadowEdge.inkAlpha > 0, `배율 ${deviceScaleFactor} 그림자 글 "${shadowEdge.text}" 잉크가 구워졌다`);
			checkEqual(shadowEdge.edgeAlpha, 0, `배율 ${deviceScaleFactor} 그림자 글 "${shadowEdge.text}" 구운 캔버스 네 가장자리 줄 알파 합`);
		}
		result.lineDifferenceList.forEach((lineDifference, lineIndex) => {
			check(lineDifference.litCount >= 100, `배율 ${deviceScaleFactor} 줄 ${lineIndex} 글이 그려졌다 (밝은 화소 ${lineDifference.litCount})`);
			checkEqual(lineDifference.count, 0, `배율 ${deviceScaleFactor} 줄 ${lineIndex} "${lineList[lineIndex][1]}" 크롬 캔버스와 다른 화소 수 (최대 ${lineDifference.maximum})`);
		});
	}
}
finally {
	await browser.close();
	server.close();
}
finish("texttallinkchrome");
