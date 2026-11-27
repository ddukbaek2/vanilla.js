//==============================================================================
// 미리 푼 그림과 판 끝 첨부 버리기의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/core/decodedimagestorechrome.test.mjs)
// - ImageAsset 이 읽은 그림을 Graphic 이 올린 텍스처가 그림 요소를 texImage2D(미리 곱한 알파) 로 올린 텍스처와 바이트까지 같은지 본다.
//   미리 푸는 꼴(8 비트 PNG, sRGB 조각 PNG, JPEG, 알파 없는 WebP)과 미리 풀지 않는 꼴(gAMA 1.0 PNG, 16 비트 PNG, 알파 WebP) 모두.
// - 미리 푸는 꼴은 ImageBitmap 을 맡기고, 아닌 꼴은 맡기지 않는지 본다. prepareLoadedImages 가 올리고 맡긴 것을 비우는지 본다.
// - 엔진이 둘이면 그림을 읽기 시작할 때 씬을 불러오던 Graphic 만 그 그림을 미리 올리고, 다른 Graphic 은 미리 올리지도 꺼내지도 않는지 본다.
//   주인을 모르는 그림(씬 불러오기 밖에서 읽은 것)은 Graphic 이 둘이면 어느 쪽도 미리 올리지 않는지 본다.
// - RenderTarget.resolve 가 첨부를 버려도 푼 텍스처가 맞고, resolve(true) 로 남긴 멀티샘플 판에 이어 그린 것이 남는지 본다.
//   puppeteer-core 나 크롬이 없으면 실패한다. (말없이 건너뛰지 않는다)
//==============================================================================
const System = globalThis;
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import url from "node:url";
import zlib from "node:zlib";
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

// PNG 짓기. (줄마다 거르기 0)
const crcTable = new System.Uint32Array(256).map((value, index) => {
	let crc = index;
	for (let bit = 0; bit < 8; bit++) {
		crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
	}
	return crc >>> 0;
});
function createChunk(type, data) {
	const typeBytes = System.Buffer.from(type, "ascii");
	const lengthBytes = System.Buffer.alloc(4);
	lengthBytes.writeUInt32BE(data.length);
	let crc = 0xffffffff;
	for (const byte of System.Buffer.concat([typeBytes, data])) {
		crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	}
	const crcBytes = System.Buffer.alloc(4);
	crcBytes.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
	return System.Buffer.concat([lengthBytes, typeBytes, data, crcBytes]);
}
function createPng(width, height, bitDepth, extraChunkList) {
	const channelBytes = bitDepth / 8;
	const rowList = [];
	for (let y = 0; y < height; y++) {
		const row = System.Buffer.alloc(1 + width * 4 * channelBytes);
		for (let x = 0; x < width; x++) {
			const valueList = [(y * 37 + x * 3) & 255, (y * 91 + 17) & 255, (255 - x) & 255, x & 255];
			for (let channel = 0; channel < 4; channel++) {
				const offset = 1 + (x * 4 + channel) * channelBytes;
				if (channelBytes === 2) {
					row.writeUInt16BE((valueList[channel] * 257 + x + y) & 0xffff, offset);
				}
				else {
					row[offset] = valueList[channel];
				}
			}
		}
		rowList.push(row);
	}
	const header = System.Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header[8] = bitDepth;
	header[9] = 6;
	return System.Buffer.concat([
		System.Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		createChunk("IHDR", header),
		...extraChunkList,
		createChunk("IDAT", zlib.deflateSync(System.Buffer.concat(rowList))),
		createChunk("IEND", System.Buffer.alloc(0)),
	]);
}
const gammaBytes = System.Buffer.alloc(4);
gammaBytes.writeUInt32BE(100000);
const imageTable = new System.Map([
	["/image/rgba.png", createPng(256, 32, 8, [])],
	["/image/srgb.png", createPng(256, 32, 8, [createChunk("sRGB", System.Buffer.from([0]))])],
	["/image/gamma.png", createPng(256, 32, 8, [createChunk("gAMA", gammaBytes)])],
	["/image/deep.png", createPng(256, 32, 16, [])],
]);

// 저장소와 지은 그림을 잠깐 내주는 http 서버. (모듈은 file:// 로 못 불러온다)
const server = http.createServer((request, response) => {
	const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
	if (requestPath === "/") {
		response.writeHead(200, { "Content-Type": "text/html" });
		response.end("<!doctype html><title>decodedimagestore</title><body></body>");
		return;
	}
	if (imageTable.has(requestPath)) {
		response.writeHead(200, { "Content-Type": "image/png" });
		response.end(imageTable.get(requestPath));
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
		const { ImageAsset } = await import("/src/resource/imageasset.js");
		const { DecodedImageStore } = await import("/src/core/graphic/decodedimagestore.js");
		const { RenderTarget } = await import("/src/graphics3d/rendertarget.js");
		const canvas = document.createElement("canvas");
		canvas.width = 64;
		canvas.height = 64;
		document.body.appendChild(canvas);
		const graphic = new Graphic(canvas, false);
		const gl = graphic.getWebGL2RenderingContext();
		const readTexture = (texture, width, height) => {
			const framebuffer = gl.createFramebuffer();
			gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
			const pixels = new Uint8Array(width * height * 4);
			gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.deleteFramebuffer(framebuffer);
			return pixels;
		};
		// 예전 길: 같은 바이트로 지은 그림 요소를 미리 곱한 알파로 바로 올린다.
		const readByElement = async (blob, width, height) => {
			const image = new Image();
			await new Promise((resolve) => {
				image.onload = resolve;
				image.src = URL.createObjectURL(blob);
			});
			const texture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
			gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
			const pixels = readTexture(texture, width, height);
			gl.deleteTexture(texture);
			return pixels;
		};
		// 캔버스로 JPEG 과 WebP 짓기. (알파 없는 WebP 는 불투명하게, 알파 WebP 는 반투명 갈래로)
		const createCanvasBlob = async (type, isOpaque) => {
			const sourceCanvas = new OffscreenCanvas(128, 32);
			const context = sourceCanvas.getContext("2d");
			const gradient = context.createLinearGradient(0, 0, 128, 0);
			gradient.addColorStop(0, isOpaque ? "rgb(255, 40, 0)" : "rgba(255, 40, 0, 0.1)");
			gradient.addColorStop(1, isOpaque ? "rgb(0, 90, 255)" : "rgba(0, 90, 255, 0.8)");
			context.fillStyle = gradient;
			context.fillRect(0, 0, 128, 32);
			return sourceCanvas.convertToBlob({ type: type, quality: 0.9 });
		};
		const caseList = [
			{ name: "rgba.png", blob: await (await fetch("/image/rgba.png")).blob(), isDecodedExpected: true },
			{ name: "srgb.png", blob: await (await fetch("/image/srgb.png")).blob(), isDecodedExpected: true },
			{ name: "gamma.png", blob: await (await fetch("/image/gamma.png")).blob(), isDecodedExpected: false },
			{ name: "deep.png", blob: await (await fetch("/image/deep.png")).blob(), isDecodedExpected: false },
			{ name: "photo.jpg", blob: await createCanvasBlob("image/jpeg", true), isDecodedExpected: true },
			{ name: "opaque.webp", blob: await createCanvasBlob("image/webp", true), isDecodedExpected: true },
			{ name: "alpha.webp", blob: await createCanvasBlob("image/webp", false), isDecodedExpected: false },
		];
		const caseResultList = [];
		const imageAssetList = [];
		for (const testCase of caseList) {
			const imageAsset = new ImageAsset();
			await imageAsset.loadFromBytes(testCase.name, testCase.blob);
			imageAssetList.push(imageAsset);
			const image = imageAsset.getImage();
			const isPending = DecodedImageStore.isPending(image);
			const decodedImage = DecodedImageStore.take(image);
			const isDecoded = decodedImage !== null;
			DecodedImageStore.register(image, decodedImage);
			const width = image.width;
			const height = image.height;
			const texture = graphic.getImageTextureCache().getTexture(image, true, false);
			const isTakenAfterUpload = !DecodedImageStore.isPending(image);
			const isClosedAfterUpload = decodedImage === null || decodedImage.width === 0;
			const pixels = readTexture(texture, width, height);
			const expectedPixels = await readByElement(testCase.blob, width, height);
			let differentByteCount = 0;
			for (let index = 0; index < pixels.length; index++) {
				if (pixels[index] !== expectedPixels[index]) {
					differentByteCount++;
				}
			}
			caseResultList.push({ name: testCase.name, isPending, isDecoded, isDecodedExpected: testCase.isDecodedExpected, isTakenAfterUpload, isClosedAfterUpload, differentByteCount, width, height });
		}

		// prepareLoadedImages: 읽고 아직 올리지 않은 그림을 올리고 비운다.
		const preparedAsset = new ImageAsset();
		await preparedAsset.load("/image/rgba.png");
		const isPreparedPendingBefore = DecodedImageStore.isPending(preparedAsset.getImage());
		const remainingCount = graphic.prepareLoadedImages();
		const isPreparedPendingAfter = DecodedImageStore.isPending(preparedAsset.getImage());
		const remainingAgainCount = graphic.prepareLoadedImages();
		const unloadedAsset = new ImageAsset();
		await unloadedAsset.load("/image/srgb.png");
		unloadedAsset.unload();
		const isUnloadedPending = DecodedImageStore.isPending(unloadedAsset.getImage());
		let isMissingRejected = false;
		try {
			await new ImageAsset().load("/image/missing.png");
		}
		catch (error) {
			isMissingRejected = String(error.message).includes("Load fail");
		}

		// 엔진 둘: 주인 Graphic 만 제 그림을 미리 올린다. (SceneManager 가 씬의 load 앞뒤로 beginLoading, endLoading 을 부르는 것과 같게)
		const otherCanvas = document.createElement("canvas");
		otherCanvas.width = 64;
		otherCanvas.height = 64;
		document.body.appendChild(otherCanvas);
		const otherGraphic = new Graphic(otherCanvas, false);
		const ownedAsset = new ImageAsset();
		DecodedImageStore.beginLoading(gl);
		await ownedAsset.load("/image/rgba.png");
		DecodedImageStore.endLoading(gl);
		const ownedImage = ownedAsset.getImage();
		otherGraphic.prepareLoadedImages();
		const isOwnedPendingAfterOther = DecodedImageStore.isPending(ownedImage);
		const otherTexture = otherGraphic.getImageTextureCache().getTexture(ownedImage, true);
		const isOwnedPendingAfterOtherDraw = DecodedImageStore.isPending(ownedImage);
		graphic.prepareLoadedImages();
		const isOwnedPendingAfterOwner = DecodedImageStore.isPending(ownedImage);
		const unknownAsset = new ImageAsset();
		await unknownAsset.load("/image/srgb.png");
		otherGraphic.prepareLoadedImages();
		graphic.prepareLoadedImages();
		const isUnknownPendingAfterBoth = DecodedImageStore.isPending(unknownAsset.getImage());
		unknownAsset.unload();
		const twoEngineResult = { isOwnedPendingAfterOther, isOtherTextureMade: otherTexture !== null, isOwnedPendingAfterOtherDraw, isOwnedPendingAfterOwner, isUnknownPendingAfterBoth };

		// RenderTarget.resolve: 버려도 푼 색이 맞고, 남기면 이어 그린 것이 남는다.
		const readColor = (renderTarget) => {
			const pixels = readTexture(renderTarget.getColorTexture(0), 1, 1);
			return [pixels[0], pixels[1], pixels[2], pixels[3]];
		};
		const clearTarget = (renderTarget, red, green, blue, isClearing) => {
			renderTarget.bind();
			gl.disable(gl.SCISSOR_TEST);
			gl.colorMask(true, true, true, true);
			gl.depthMask(true);
			if (isClearing) {
				gl.clearColor(red, green, blue, 1);
				gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			}
			else {
				// 왼쪽 아래 한 칸만 바꾼다. (가위로 나머지를 남긴다)
				gl.enable(gl.SCISSOR_TEST);
				gl.scissor(0, 0, 1, 1);
				gl.clearColor(red, green, blue, 1);
				gl.clear(gl.COLOR_BUFFER_BIT);
				gl.disable(gl.SCISSOR_TEST);
			}
		};
		const multisampleTarget = new RenderTarget(gl, 8, 8, true, { sampleCount: 4, useDepthTexture: true });
		clearTarget(multisampleTarget, 1, 0, 0, true);
		multisampleTarget.resolve();
		const discardedColor = readColor(multisampleTarget);
		clearTarget(multisampleTarget, 0, 1, 0, true);
		multisampleTarget.resolve(true);
		const keptColor = readColor(multisampleTarget);
		// 남긴 판에 왼쪽 아래 한 칸만 노랑으로 이어 그리고 다시 푼다. (나머지는 남긴 초록이어야 한다)
		clearTarget(multisampleTarget, 1, 1, 0, false);
		multisampleTarget.resolve();
		const keptCorner = (() => {
			const pixels = readTexture(multisampleTarget.getColorTexture(0), 8, 8);
			return [pixels[0], pixels[1], pixels[2], pixels[7 * 4], pixels[7 * 4 + 1], pixels[7 * 4 + 2]];
		})();
		const singleTarget = new RenderTarget(gl, 8, 8, true, {});
		clearTarget(singleTarget, 0, 0, 1, true);
		singleTarget.resolve();
		const singleColor = readColor(singleTarget);
		const glError = gl.getError();
		return {
			twoEngineResult, caseResultList, remainingCount, remainingAgainCount, isPreparedPendingBefore, isPreparedPendingAfter, isUnloadedPending, isMissingRejected,
			multisampleSampleCount: multisampleTarget.getSampleCount(), discardedColor, keptColor, keptCorner, singleColor, glError,
		};
	});
}
finally {
	await browser.close();
	server.close();
}

// 머리만 보고 꼴 가르기. (크롬 밖에서도 같은 함수)
const { DecodedImageStore } = await import("../../src/core/graphic/decodedimagestore.js");
const headerOf = (name) => new System.Uint8Array(imageTable.get("/image/" + name));
check(DecodedImageStore.isExactlyDecodable(headerOf("rgba.png")), "8 비트 PNG 는 미리 푼다");
check(DecodedImageStore.isExactlyDecodable(headerOf("srgb.png")), "sRGB 조각 PNG 는 미리 푼다");
check(!DecodedImageStore.isExactlyDecodable(headerOf("gamma.png")), "gAMA 1.0 알파 PNG 는 미리 풀지 않는다");
check(!DecodedImageStore.isExactlyDecodable(headerOf("deep.png")), "16 비트 PNG 는 미리 풀지 않는다");
check(DecodedImageStore.isExactlyDecodable(new System.Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "JPEG 는 미리 푼다");
check(!DecodedImageStore.isExactlyDecodable(new System.TextEncoder().encode("GIF89a")), "GIF 는 미리 풀지 않는다");
check(!DecodedImageStore.isExactlyDecodable(new System.TextEncoder().encode("<svg xmlns")), "SVG 는 미리 풀지 않는다");

for (const caseResult of result.caseResultList) {
	console.log("  " + caseResult.name + " " + caseResult.width + "x" + caseResult.height + " 미리 풂 " + caseResult.isDecoded + ", 다른 바이트 " + caseResult.differentByteCount);
	check(caseResult.isPending, caseResult.name + " 읽은 뒤 올리기 전 그림으로 맡겨짐");
	check(caseResult.isDecoded === caseResult.isDecodedExpected, caseResult.name + " 미리 풀기 " + caseResult.isDecoded + " (기대 " + caseResult.isDecodedExpected + ")");
	check(caseResult.differentByteCount === 0, caseResult.name + " 텍스처가 그림 요소를 올린 것과 다름 " + caseResult.differentByteCount + " 바이트");
	check(caseResult.isTakenAfterUpload, caseResult.name + " 올린 뒤 맡긴 것이 빠짐");
	check(caseResult.isClosedAfterUpload, caseResult.name + " 올린 뒤 ImageBitmap 을 닫음");
}
check(result.isPreparedPendingBefore && !result.isPreparedPendingAfter, "prepareLoadedImages 가 맡긴 그림을 올리고 비움");
check(result.remainingCount === 0 && result.remainingAgainCount === 0, "prepareLoadedImages 남은 수 " + result.remainingCount + ", 다시 " + result.remainingAgainCount);
check(!result.isUnloadedPending, "unload 하면 맡긴 그림을 놓음");
check(result.isMissingRejected, "없는 그림은 Load fail 로 거부");
check(result.twoEngineResult.isOwnedPendingAfterOther, "엔진 둘: 남의 Graphic 의 prepareLoadedImages 가 주인 있는 그림을 올리지 않음");
check(result.twoEngineResult.isOtherTextureMade && result.twoEngineResult.isOwnedPendingAfterOtherDraw, "엔진 둘: 남의 Graphic 이 그려도 주인의 미리 푼 그림을 꺼내지 않음");
check(!result.twoEngineResult.isOwnedPendingAfterOwner, "엔진 둘: 주인 Graphic 의 prepareLoadedImages 가 제 그림을 올림");
check(result.twoEngineResult.isUnknownPendingAfterBoth, "엔진 둘: 주인을 모르는 그림은 어느 Graphic 도 미리 올리지 않음");
console.log("  멀티샘플 표본 " + result.multisampleSampleCount + ", 버린 뒤 " + result.discardedColor.join(",") + ", 남긴 뒤 " + result.keptColor.join(",") + " 구석 " + result.keptCorner.join(",") + ", 한 표본 " + result.singleColor.join(","));
check(result.discardedColor.join(",") === "255,0,0,255", "버린 판의 푼 색 " + result.discardedColor.join(","));
check(result.keptColor.join(",") === "0,255,0,255", "남긴 판의 푼 색 " + result.keptColor.join(","));
check(result.keptCorner.join(",") === "255,255,0,0,255,0", "남긴 판에 이어 그린 칸과 남은 칸 " + result.keptCorner.join(","));
check(result.singleColor.join(",") === "0,0,255,255", "한 표본 판의 색 " + result.singleColor.join(","));
check(result.glError === 0, "GL 오류 " + result.glError);
console.log("미리 푼 그림과 첨부 버리기 크롬 시험 통과 (" + checkCount + " 검사)");
