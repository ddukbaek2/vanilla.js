//==============================================================================
// 타일맵 쇼케이스 자산 만들기. (node 내장 모듈만 쓴다)
// - 실행: node examples/tilemapshowcase/generate.mjs
// - assets/ 에 타일셋 그림(PNG)과 Tiled JSON 지도(.tmj), 바깥 타일셋(.tsj)을 쓴다. 그림은 칸마다 점을 찍어 그린다.
// - 지도는 Tiled JSON 형식(https://doc.mapeditor.org/en/stable/reference/json-map-format/)을 따른다.
//   층 자료는 배열, base64, base64 + zlib, base64 + gzip, 끝없는 지도의 덩이를 골고루 쓴다.
//==============================================================================
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import url from "node:url";

const System = globalThis;
const ASSET_DIRECTORY_PATH = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "assets");
const FLIP_HORIZONTAL = 0x80000000;
const FLIP_VERTICAL = 0x40000000;
const FLIP_DIAGONAL = 0x20000000;


//==============================================================================
// CRC32 표. (PNG 덩이 검사 값)
//==============================================================================
const crcTable = new System.Uint32Array(256);
for (let tableIndex = 0; tableIndex < 256; ++tableIndex) {
	let value = tableIndex;
	for (let bitIndex = 0; bitIndex < 8; ++bitIndex) {
		value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
	}
	crcTable[tableIndex] = value >>> 0;
}

//==============================================================================
// CRC32 셈하기.
//==============================================================================
function computeCrc(bytes) {
	let crc = 0xFFFFFFFF;
	for (const byte of bytes) {
		crc = crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
	}
	return (crc ^ 0xFFFFFFFF) >>> 0;
}

//==============================================================================
// PNG 덩이 하나.
//==============================================================================
function createPngChunk(typeText, dataBuffer) {
	const lengthBuffer = System.Buffer.alloc(4);
	lengthBuffer.writeUInt32BE(dataBuffer.length, 0);
	const typeBuffer = System.Buffer.from(typeText, "ascii");
	const crcBuffer = System.Buffer.alloc(4);
	crcBuffer.writeUInt32BE(computeCrc(System.Buffer.concat([typeBuffer, dataBuffer])), 0);
	return System.Buffer.concat([lengthBuffer, typeBuffer, dataBuffer, crcBuffer]);
}

//==============================================================================
// RGBA 그림.
//==============================================================================
class PixelImage {
	constructor(width, height) {
		this.width = width;
		this.height = height;
		this.pixels = new System.Uint8Array(width * height * 4);
	}

	setPixel(x, y, color) {
		if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
			return;
		}
		const pixelIndex = (y * this.width + x) * 4;
		this.pixels[pixelIndex] = color[0];
		this.pixels[pixelIndex + 1] = color[1];
		this.pixels[pixelIndex + 2] = color[2];
		this.pixels[pixelIndex + 3] = color.length > 3 ? color[3] : 255;
	}

	fillRect(left, top, width, height, color) {
		for (let y = top; y < top + height; ++y) {
			for (let x = left; x < left + width; ++x) {
				this.setPixel(x, y, color);
			}
		}
	}

	// 점이 다각형 안인지로 칠한다. (화소 가운데로 본다)
	fillPolygon(left, top, pointList, color) {
		for (let y = 0; y < 64; ++y) {
			for (let x = 0; x < 64; ++x) {
				const sampleX = x + 0.5;
				const sampleY = y + 0.5;
				let isInside = false;
				for (let pointIndex = 0, previousIndex = pointList.length - 1; pointIndex < pointList.length; previousIndex = pointIndex++) {
					const currentPoint = pointList[pointIndex];
					const previousPoint = pointList[previousIndex];
					if ((currentPoint[1] > sampleY) !== (previousPoint[1] > sampleY)) {
						const crossX = (previousPoint[0] - currentPoint[0]) * (sampleY - currentPoint[1]) / (previousPoint[1] - currentPoint[1]) + currentPoint[0];
						if (sampleX < crossX) {
							isInside = !isInside;
						}
					}
				}
				if (isInside) {
					this.setPixel(left + x, top + y, color);
				}
			}
		}
	}

	fillCircle(left, top, centerX, centerY, radius, color) {
		for (let y = System.Math.floor(centerY - radius); y <= System.Math.ceil(centerY + radius); ++y) {
			for (let x = System.Math.floor(centerX - radius); x <= System.Math.ceil(centerX + radius); ++x) {
				const differenceX = x + 0.5 - centerX;
				const differenceY = y + 0.5 - centerY;
				if (differenceX * differenceX + differenceY * differenceY <= radius * radius) {
					this.setPixel(left + x, top + y, color);
				}
			}
		}
	}

	writePng(filePath) {
		const headerBuffer = System.Buffer.alloc(13);
		headerBuffer.writeUInt32BE(this.width, 0);
		headerBuffer.writeUInt32BE(this.height, 4);
		headerBuffer[8] = 8;
		headerBuffer[9] = 6;
		headerBuffer[10] = 0;
		headerBuffer[11] = 0;
		headerBuffer[12] = 0;
		const rowLength = this.width * 4 + 1;
		const rawBuffer = System.Buffer.alloc(rowLength * this.height);
		for (let y = 0; y < this.height; ++y) {
			rawBuffer[y * rowLength] = 0;
			System.Buffer.from(this.pixels.buffer, y * this.width * 4, this.width * 4).copy(rawBuffer, y * rowLength + 1);
		}
		const signatureBuffer = System.Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
		const pngBuffer = System.Buffer.concat([
			signatureBuffer,
			createPngChunk("IHDR", headerBuffer),
			createPngChunk("IDAT", zlib.deflateSync(rawBuffer, { level: 9 })),
			createPngChunk("IEND", System.Buffer.alloc(0)),
		]);
		fs.writeFileSync(filePath, pngBuffer);
	}
}

//==============================================================================
// 칸 좌표로 정한 0 ~ 1 값. (점 무늬가 실행마다 같다)
//==============================================================================
function hashNoise(x, y, seed) {
	let value = (x * 374761393 + y * 668265263 + seed * 2147483647) >>> 0;
	value = ((value ^ (value >>> 13)) * 1274126177) >>> 0;
	return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

// 점 무늬 바탕.
function fillSpeckled(image, left, top, width, height, baseColor, speckColor, speckRatio, seed) {
	image.fillRect(left, top, width, height, baseColor);
	for (let y = 0; y < height; ++y) {
		for (let x = 0; x < width; ++x) {
			if (hashNoise(x, y, seed) < speckRatio) {
				image.setPixel(left + x, top + y, speckColor);
			}
		}
	}
}

const GRASS = [79, 154, 58];
const GRASS_DARK = [58, 122, 44];
const DIRT = [138, 90, 50];
const DIRT_DARK = [110, 70, 38];
const WATER = [47, 111, 181];
const WATER_LIGHT = [126, 186, 235];
const STONE = [128, 128, 136];
const STONE_DARK = [88, 88, 96];
const SAND = [216, 194, 122];
const SAND_DARK = [190, 166, 98];
const ROAD = [201, 164, 107];
const ROAD_EDGE = [150, 112, 66];
const WOOD = [120, 78, 40];
const WHITE = [245, 245, 240];
const RED = [210, 56, 56];
const LEAF = [40, 104, 48];
const LEAF_LIGHT = [72, 146, 62];

//==============================================================================
// 정사각 타일셋. (16 x 16, 여백 1, 간격 2, 8 열 3 행)
//==============================================================================
function createTerrainImage() {
	const tileSize = 16;
	const margin = 1;
	const spacing = 2;
	const columns = 8;
	const rows = 3;
	const image = new PixelImage(margin * 2 + columns * tileSize + (columns - 1) * spacing, margin * 2 + rows * tileSize + (rows - 1) * spacing);
	const tileLeft = (tileId) => margin + (tileId % columns) * (tileSize + spacing);
	const tileTop = (tileId) => margin + System.Math.floor(tileId / columns) * (tileSize + spacing);
	// 0 풀, 1 꽃 풀, 2 흙.
	fillSpeckled(image, tileLeft(0), tileTop(0), 16, 16, GRASS, GRASS_DARK, 0.18, 1);
	fillSpeckled(image, tileLeft(1), tileTop(1), 16, 16, GRASS, GRASS_DARK, 0.18, 2);
	for (const [flowerX, flowerY, flowerColor] of [[3, 4, [250, 220, 80]], [11, 3, [240, 120, 170]], [7, 10, [250, 250, 250]], [13, 12, [250, 220, 80]]]) {
		image.fillRect(tileLeft(1) + flowerX, tileTop(1) + flowerY, 2, 2, flowerColor);
	}
	fillSpeckled(image, tileLeft(2), tileTop(2), 16, 16, DIRT, DIRT_DARK, 0.22, 3);
	// 3 ~ 6 물결 네 프레임.
	for (let frameIndex = 0; frameIndex < 4; ++frameIndex) {
		const tileId = 3 + frameIndex;
		image.fillRect(tileLeft(tileId), tileTop(tileId), 16, 16, WATER);
		for (const waveY of [3, 9, 14]) {
			for (let waveX = 0; waveX < 5; ++waveX) {
				image.setPixel(tileLeft(tileId) + (waveX + frameIndex * 4 + waveY) % 16, tileTop(tileId) + waveY, WATER_LIGHT);
			}
		}
	}
	// 7 돌벽.
	image.fillRect(tileLeft(7), tileTop(7), 16, 16, STONE);
	for (let brickRow = 0; brickRow < 4; ++brickRow) {
		image.fillRect(tileLeft(7), tileTop(7) + brickRow * 4 + 3, 16, 1, STONE_DARK);
		const shift = brickRow % 2 === 0 ? 0 : 4;
		for (let brickColumn = 0; brickColumn < 2; ++brickColumn) {
			image.fillRect(tileLeft(7) + shift + brickColumn * 8, tileTop(7) + brickRow * 4, 1, 3, STONE_DARK);
		}
	}
	// 8 모래, 9 덤불.
	fillSpeckled(image, tileLeft(8), tileTop(8), 16, 16, SAND, SAND_DARK, 0.2, 4);
	fillSpeckled(image, tileLeft(9), tileTop(9), 16, 16, GRASS, GRASS_DARK, 0.18, 5);
	image.fillCircle(tileLeft(9), tileTop(9), 8, 9, 6.5, LEAF);
	image.fillCircle(tileLeft(9), tileTop(9), 6.5, 7, 3, LEAF_LIGHT);
	// 10 화살표. (오른쪽을 가리키고 왼쪽 위에 빨간 점, 뒤집기와 돌리기가 눈에 보인다)
	fillSpeckled(image, tileLeft(10), tileTop(10), 16, 16, GRASS, GRASS_DARK, 0.18, 6);
	image.fillRect(tileLeft(10) + 3, tileTop(10) + 7, 7, 2, WHITE);
	image.fillPolygon(tileLeft(10), tileTop(10), [[9, 3], [14, 8], [9, 13]], WHITE);
	image.fillRect(tileLeft(10) + 1, tileTop(10) + 1, 3, 3, RED);
	// 11 울타리. (바탕이 비었다)
	image.fillRect(tileLeft(11), tileTop(11) + 5, 16, 2, WOOD);
	image.fillRect(tileLeft(11), tileTop(11) + 10, 16, 2, WOOD);
	image.fillRect(tileLeft(11) + 2, tileTop(11) + 3, 3, 12, WOOD);
	image.fillRect(tileLeft(11) + 10, tileTop(11) + 3, 3, 12, WOOD);
	// 12 비탈. (오른쪽 아래 반이 돌)
	image.fillPolygon(tileLeft(12), tileTop(12), [[16, 0], [16, 16], [0, 16]], STONE);
	image.fillPolygon(tileLeft(12), tileTop(12), [[16, 3], [16, 16], [3, 16]], STONE_DARK);
	// 13 바위, 14 자갈, 15 짙은 풀.
	image.fillCircle(tileLeft(13), tileTop(13), 8, 9, 6, STONE_DARK);
	image.fillCircle(tileLeft(13), tileTop(13), 7, 8, 5, STONE);
	fillSpeckled(image, tileLeft(14), tileTop(14), 16, 16, STONE, STONE_DARK, 0.35, 7);
	fillSpeckled(image, tileLeft(15), tileTop(15), 16, 16, GRASS_DARK, LEAF, 0.3, 8);
	// 16 ~ 21 길. (외톨이, 끝(오른쪽으로 이어짐), 곧은 길(좌우), 모퉁이(오른쪽과 아래), 세 갈래(좌우와 아래), 네 갈래)
	const roadArms = [[], ["right"], ["left", "right"], ["right", "down"], ["left", "right", "down"], ["left", "right", "up", "down"]];
	for (let roadIndex = 0; roadIndex < roadArms.length; ++roadIndex) {
		const tileId = 16 + roadIndex;
		const left = tileLeft(tileId);
		const top = tileTop(tileId);
		image.fillRect(left + 3, top + 3, 10, 10, ROAD_EDGE);
		image.fillRect(left + 4, top + 4, 8, 8, ROAD);
		for (const arm of roadArms[roadIndex]) {
			if (arm === "right") {
				image.fillRect(left + 12, top + 3, 4, 10, ROAD_EDGE);
				image.fillRect(left + 11, top + 4, 5, 8, ROAD);
			}
			else if (arm === "left") {
				image.fillRect(left, top + 3, 4, 10, ROAD_EDGE);
				image.fillRect(left, top + 4, 5, 8, ROAD);
			}
			else if (arm === "down") {
				image.fillRect(left + 3, top + 12, 10, 4, ROAD_EDGE);
				image.fillRect(left + 4, top + 11, 8, 5, ROAD);
			}
			else {
				image.fillRect(left + 3, top, 10, 4, ROAD_EDGE);
				image.fillRect(left + 4, top, 8, 5, ROAD);
			}
		}
	}
	// 22 ~ 23 은 비워 둔다.
	image.writePng(path.join(ASSET_DIRECTORY_PATH, "terrain.png"));
}

//==============================================================================
// 큰 타일 타일셋. (16 x 32 두 장: 나무, 가로등, 격자보다 위로 넘친다)
//==============================================================================
function createTreeImage() {
	const image = new PixelImage(32, 32);
	image.fillRect(6, 20, 4, 12, WOOD);
	image.fillCircle(0, 0, 8, 11, 7.5, LEAF);
	image.fillCircle(0, 0, 6, 8, 4, LEAF_LIGHT);
	image.fillRect(16 + 7, 6, 2, 26, STONE_DARK);
	image.fillRect(16 + 4, 2, 8, 5, [60, 60, 70]);
	image.fillRect(16 + 5, 3, 6, 3, [255, 226, 120]);
	image.writePng(path.join(ASSET_DIRECTORY_PATH, "trees.png"));
}

//==============================================================================
// 그림 모음 타일셋의 그림들. (상자, 팻말 한 장씩)
//==============================================================================
function createPropImages() {
	const chestImage = new PixelImage(16, 16);
	chestImage.fillRect(2, 5, 12, 10, WOOD);
	chestImage.fillRect(2, 8, 12, 1, [80, 50, 24]);
	chestImage.fillRect(7, 8, 2, 3, [240, 200, 70]);
	chestImage.writePng(path.join(ASSET_DIRECTORY_PATH, "chest.png"));
	const signImage = new PixelImage(16, 16);
	signImage.fillRect(7, 8, 2, 8, WOOD);
	signImage.fillRect(2, 2, 12, 7, [170, 120, 70]);
	signImage.fillRect(4, 4, 8, 1, [90, 60, 30]);
	signImage.fillRect(4, 6, 6, 1, [90, 60, 30]);
	signImage.writePng(path.join(ASSET_DIRECTORY_PATH, "sign.png"));
}

//==============================================================================
// 아이소 타일셋. (32 x 32 그림, 아래 16 줄이 마름모, 4 열 2 행)
//==============================================================================
function createIsometricImage() {
	const image = new PixelImage(128, 64);
	const diamond = [[16, 16], [32, 24], [16, 32], [0, 24]];
	const tileLeft = (tileId) => (tileId % 4) * 32;
	const tileTop = (tileId) => System.Math.floor(tileId / 4) * 32;
	const fillDiamond = (tileId, color) => {
		image.fillPolygon(tileLeft(tileId), tileTop(tileId), diamond, color);
	};
	// 0 풀, 1 ~ 2 물 두 프레임, 3 돌 블록, 4 흙, 5 꽃 풀, 6 나무, 7 길.
	fillDiamond(0, GRASS);
	fillDiamond(1, WATER);
	fillDiamond(2, WATER);
	image.fillRect(tileLeft(1) + 10, tileTop(1) + 22, 6, 1, WATER_LIGHT);
	image.fillRect(tileLeft(2) + 16, tileTop(2) + 25, 6, 1, WATER_LIGHT);
	image.fillPolygon(tileLeft(3), tileTop(3), [[16, 0], [32, 8], [16, 16], [0, 8]], [160, 160, 168]);
	image.fillPolygon(tileLeft(3), tileTop(3), [[0, 8], [16, 16], [16, 32], [0, 24]], STONE);
	image.fillPolygon(tileLeft(3), tileTop(3), [[16, 16], [32, 8], [32, 24], [16, 32]], STONE_DARK);
	fillDiamond(4, DIRT);
	fillDiamond(5, GRASS);
	image.fillRect(tileLeft(5) + 12, tileTop(5) + 22, 2, 2, [250, 220, 80]);
	image.fillRect(tileLeft(5) + 19, tileTop(5) + 25, 2, 2, [240, 120, 170]);
	fillDiamond(6, GRASS);
	image.fillRect(tileLeft(6) + 15, tileTop(6) + 14, 3, 10, WOOD);
	image.fillCircle(tileLeft(6), tileTop(6), 16.5, 10, 7, LEAF);
	fillDiamond(7, ROAD);
	image.writePng(path.join(ASSET_DIRECTORY_PATH, "isometric.png"));
}

//==============================================================================
// 육각 타일셋. (32 x 32 뾰족 꼭대기 육각, 곧은 변 16, 4 열 2 행)
//==============================================================================
function createHexagonImage() {
	const image = new PixelImage(128, 64);
	const hexagon = [[16, 0], [32, 8], [32, 24], [16, 32], [0, 24], [0, 8]];
	const innerHexagon = [[16, 2], [30, 9], [30, 23], [16, 30], [2, 23], [2, 9]];
	const tileLeft = (tileId) => (tileId % 4) * 32;
	const tileTop = (tileId) => System.Math.floor(tileId / 4) * 32;
	const colorList = [GRASS, WATER, STONE, LEAF, SAND, GRASS, [190, 120, 90], [235, 240, 245]];
	const edgeList = [GRASS_DARK, [36, 86, 150], STONE_DARK, [28, 76, 36], SAND_DARK, GRASS_DARK, [140, 84, 60], [190, 200, 210]];
	for (let tileId = 0; tileId < 8; ++tileId) {
		image.fillPolygon(tileLeft(tileId), tileTop(tileId), hexagon, edgeList[tileId]);
		image.fillPolygon(tileLeft(tileId), tileTop(tileId), innerHexagon, colorList[tileId]);
	}
	// 2 산, 3 숲, 5 화살표(돌리기가 보인다), 6 마을.
	image.fillPolygon(tileLeft(2), tileTop(2), [[16, 7], [25, 23], [7, 23]], [210, 210, 215]);
	image.fillCircle(tileLeft(3), tileTop(3), 11, 13, 5, LEAF_LIGHT);
	image.fillCircle(tileLeft(3), tileTop(3), 20, 18, 5, LEAF_LIGHT);
	image.fillRect(tileLeft(5) + 8, tileTop(5) + 15, 10, 3, WHITE);
	image.fillPolygon(tileLeft(5), tileTop(5), [[17, 10], [25, 16.5], [17, 23]], WHITE);
	image.fillRect(tileLeft(5) + 14, tileTop(5) + 4, 4, 4, RED);
	image.fillRect(tileLeft(6) + 9, tileTop(6) + 14, 6, 6, WHITE);
	image.fillRect(tileLeft(6) + 17, tileTop(6) + 11, 6, 9, WHITE);
	image.writePng(path.join(ASSET_DIRECTORY_PATH, "hexagon.png"));
}

//==============================================================================
// 타일 값 배열을 base64 로. (리틀 엔디언 32 비트, 압축 선택)
//==============================================================================
function encodeTileData(tileList, compression) {
	const rawBuffer = System.Buffer.alloc(tileList.length * 4);
	for (let tileIndex = 0; tileIndex < tileList.length; ++tileIndex) {
		rawBuffer.writeUInt32LE(tileList[tileIndex] >>> 0, tileIndex * 4);
	}
	let encodedBuffer = rawBuffer;
	if (compression === "zlib") {
		encodedBuffer = zlib.deflateSync(rawBuffer);
	}
	else if (compression === "gzip") {
		encodedBuffer = zlib.gzipSync(rawBuffer);
	}
	return encodedBuffer.toString("base64");
}

//==============================================================================
// 정사각 지도. (18 x 12, 층: 땅(배열), 위층 묶음 안의 꾸밈(base64 + zlib), 강조(base64, 색과 불투명도), 물체 층)
//==============================================================================
function createOrthogonalMap() {
	const columnCount = 18;
	const rowCount = 12;
	const groundList = [];
	for (let row = 0; row < rowCount; ++row) {
		for (let column = 0; column < columnCount; ++column) {
			let tile = hashNoise(column, row, 11) < 0.15 ? 2 : 1;
			const pondDistance = (column - 13.5) * (column - 13.5) / 9 + (row - 7.5) * (row - 7.5) / 6;
			if (pondDistance < 1) {
				tile = 4;
			}
			else if (pondDistance < 1.7) {
				tile = 9;
			}
			else if (row >= 10 && column <= 5) {
				tile = 3;
			}
			groundList.push(tile);
		}
	}
	const decorationList = new System.Array(columnCount * rowCount).fill(0);
	const setDecoration = (column, row, tile) => {
		decorationList[row * columnCount + column] = tile >>> 0;
	};
	for (let column = 0; column < 6; ++column) {
		setDecoration(column, 0, 8);
	}
	setDecoration(6, 0, 13);
	setDecoration(6, 1, 13 | FLIP_HORIZONTAL);
	for (let column = 8; column < 14; ++column) {
		setDecoration(column, 9 - 6, 12);
	}
	// 화살표 여덟 방향. (뒤집기 비트 조합 0 ~ 7)
	const arrowFlags = [0, FLIP_DIAGONAL | FLIP_HORIZONTAL, FLIP_HORIZONTAL | FLIP_VERTICAL, FLIP_DIAGONAL | FLIP_VERTICAL, FLIP_HORIZONTAL, FLIP_VERTICAL, FLIP_DIAGONAL, FLIP_DIAGONAL | FLIP_HORIZONTAL | FLIP_VERTICAL];
	for (let arrowIndex = 0; arrowIndex < arrowFlags.length; ++arrowIndex) {
		setDecoration(1 + arrowIndex, 2, (11 | arrowFlags[arrowIndex]) >>> 0);
	}
	setDecoration(2, 5, 10);
	setDecoration(3, 5, 10);
	setDecoration(4, 5, 14);
	setDecoration(15, 2, 10);
	setDecoration(16, 3, 10);
	setDecoration(9, 6, 25);
	setDecoration(11, 6, 25);
	setDecoration(16, 5, 26);
	setDecoration(1, 8, 27);
	setDecoration(2, 8, 28);
	setDecoration(14, 10, 25);
	const highlightList = new System.Array(columnCount * rowCount).fill(0);
	for (let column = 9; column < 12; ++column) {
		highlightList[8 * columnCount + column] = 15;
		highlightList[9 * columnCount + column] = 15;
	}
	const mapData = {
		compressionlevel: -1,
		height: rowCount,
		infinite: false,
		layers: [
			{ data: groundList, height: rowCount, id: 1, name: "ground", opacity: 1, type: "tilelayer", visible: true, width: columnCount, x: 0, y: 0 },
			{
				id: 2, name: "upper", opacity: 1, type: "group", visible: true, x: 0, y: 0,
				layers: [
					{ compression: "zlib", data: encodeTileData(decorationList, "zlib"), encoding: "base64", height: rowCount, id: 3, name: "decoration", opacity: 1, type: "tilelayer", visible: true, width: columnCount, x: 0, y: 0, properties: [{ name: "isSolid", type: "bool", value: true }] },
					{ data: encodeTileData(highlightList, ""), encoding: "base64", height: rowCount, id: 4, name: "highlight", opacity: 0.6, tintcolor: "#ffff80c0", type: "tilelayer", visible: true, width: columnCount, x: 0, y: 0 },
				],
			},
			{
				draworder: "topdown", id: 5, name: "spawns", opacity: 1, type: "objectgroup", visible: true, x: 0, y: 0,
				objects: [
					{ id: 1, name: "player", point: true, rotation: 0, type: "start", visible: true, width: 0, height: 0, x: 40, y: 104 },
					{ id: 2, name: "pond", ellipse: true, rotation: 0, type: "area", visible: true, width: 96, height: 64, x: 168, y: 80, properties: [{ name: "depth", type: "float", value: 1.5 }] },
				],
			},
		],
		nextlayerid: 6,
		nextobjectid: 3,
		orientation: "orthogonal",
		properties: [{ name: "title", type: "string", value: "meadow" }],
		renderorder: "right-down",
		tiledversion: "1.12.0",
		tileheight: 16,
		tilesets: [
			{
				columns: 8, firstgid: 1, image: "terrain.png", imageheight: 54, imagewidth: 144, margin: 1, name: "terrain", spacing: 2, tilecount: 24, tileheight: 16, tilewidth: 16,
				properties: [{ name: "biome", type: "string", value: "temperate" }],
				tiles: [
					{ id: 3, type: "water", animation: [{ tileid: 3, duration: 180 }, { tileid: 4, duration: 180 }, { tileid: 5, duration: 180 }, { tileid: 6, duration: 180 }], properties: [{ name: "isWater", type: "bool", value: true }] },
					{ id: 7, type: "wall", objectgroup: { draworder: "index", id: 2, name: "", opacity: 1, type: "objectgroup", visible: true, x: 0, y: 0, objects: [{ id: 1, name: "", rotation: 0, type: "", visible: true, x: 0, y: 0, width: 16, height: 16 }] } },
					{ id: 9, type: "bush", objectgroup: { draworder: "index", id: 2, name: "", opacity: 1, type: "objectgroup", visible: true, x: 0, y: 0, objects: [{ id: 1, name: "", ellipse: true, rotation: 0, type: "", visible: true, x: 2, y: 3, width: 12, height: 12 }] } },
					{ id: 10, type: "arrow", objectgroup: { draworder: "index", id: 2, name: "", opacity: 1, type: "objectgroup", visible: true, x: 0, y: 0, objects: [{ id: 1, name: "", rotation: 0, type: "", visible: true, x: 9, y: 3, polygon: [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 10 }] }] } },
					{ id: 11, type: "fence", objectgroup: { draworder: "index", id: 2, name: "", opacity: 1, type: "objectgroup", visible: true, x: 0, y: 0, objects: [{ id: 1, name: "", rotation: 0, type: "", visible: true, x: 0, y: 5, width: 16, height: 7 }] } },
					{ id: 12, type: "slope", objectgroup: { draworder: "index", id: 2, name: "", opacity: 1, type: "objectgroup", visible: true, x: 0, y: 0, objects: [{ id: 1, name: "", rotation: 0, type: "", visible: true, x: 0, y: 16, polygon: [{ x: 0, y: 0 }, { x: 16, y: -16 }, { x: 16, y: 0 }] }] } },
				],
			},
			{
				columns: 2, firstgid: 25, image: "trees.png", imageheight: 32, imagewidth: 32, margin: 0, name: "trees", spacing: 0, tilecount: 2, tileheight: 32, tilewidth: 16,
				tiles: [{ id: 0, objectgroup: { draworder: "index", id: 2, name: "", opacity: 1, type: "objectgroup", visible: true, x: 0, y: 0, objects: [{ id: 1, name: "", rotation: 0, type: "", visible: true, x: 5, y: 20, width: 6, height: 12 }] } }],
			},
			{ firstgid: 27, source: "props.tsj" },
		],
		tilewidth: 16,
		type: "map",
		version: "1.10",
		width: columnCount,
	};
	fs.writeFileSync(path.join(ASSET_DIRECTORY_PATH, "orthogonal.tmj"), JSON.stringify(mapData, null, 1) + "\n");
	const propsTileset = {
		columns: 0, grid: { height: 1, orientation: "orthogonal", width: 1 }, margin: 0, name: "props", spacing: 0, tilecount: 2, tiledversion: "1.12.0", tileheight: 16, tilewidth: 16, type: "tileset", version: "1.10",
		tiles: [
			{ id: 0, image: "chest.png", imageheight: 16, imagewidth: 16, type: "chest", properties: [{ name: "gold", type: "int", value: 30 }], objectgroup: { draworder: "index", id: 2, name: "", opacity: 1, type: "objectgroup", visible: true, x: 0, y: 0, objects: [{ id: 1, name: "", rotation: 0, type: "", visible: true, x: 2, y: 5, width: 12, height: 10 }] } },
			{ id: 1, image: "sign.png", imageheight: 16, imagewidth: 16, type: "sign", properties: [{ name: "text", type: "string", value: "pond" }] },
		],
	};
	fs.writeFileSync(path.join(ASSET_DIRECTORY_PATH, "props.tsj"), JSON.stringify(propsTileset, null, 1) + "\n");
}

//==============================================================================
// 아이소 지도. (8 x 8, 칸 32 x 16, 땅(base64 + gzip), 블록(배열))
//==============================================================================
function createIsometricMap() {
	const size = 8;
	const groundList = [];
	const blockList = [];
	for (let row = 0; row < size; ++row) {
		for (let column = 0; column < size; ++column) {
			let tile = 1;
			if (column >= 5 && row >= 5) {
				tile = 2;
			}
			else if (column === 3 || row === 2) {
				tile = 8;
			}
			else if (hashNoise(column, row, 21) < 0.2) {
				tile = 6;
			}
			else if (hashNoise(column, row, 22) < 0.15) {
				tile = 5;
			}
			groundList.push(tile);
			let block = 0;
			if ((column === 0 && row >= 4) || (row === 7 && column <= 3)) {
				block = 4;
			}
			else if ((column === 6 && row === 1) || (column === 1 && row === 0)) {
				block = 7;
			}
			blockList.push(block);
		}
	}
	const mapData = {
		compressionlevel: -1,
		height: size,
		infinite: false,
		layers: [
			{ compression: "gzip", data: encodeTileData(groundList, "gzip"), encoding: "base64", height: size, id: 1, name: "ground", opacity: 1, type: "tilelayer", visible: true, width: size, x: 0, y: 0 },
			{ data: blockList, height: size, id: 2, name: "blocks", opacity: 1, type: "tilelayer", visible: true, width: size, x: 0, y: 0 },
		],
		nextlayerid: 3,
		nextobjectid: 1,
		orientation: "isometric",
		renderorder: "right-down",
		tiledversion: "1.12.0",
		tileheight: 16,
		tilesets: [
			{
				columns: 4, firstgid: 1, image: "isometric.png", imageheight: 64, imagewidth: 128, margin: 0, name: "isometric", spacing: 0, tilecount: 8, tileheight: 32, tilewidth: 32,
				tiles: [{ id: 1, animation: [{ tileid: 1, duration: 400 }, { tileid: 2, duration: 400 }] }],
			},
		],
		tilewidth: 32,
		type: "map",
		version: "1.10",
		width: size,
	};
	fs.writeFileSync(path.join(ASSET_DIRECTORY_PATH, "isometric.tmj"), JSON.stringify(mapData, null, 1) + "\n");
}

//==============================================================================
// 육각 지도. (끝없는 지도의 덩이 하나, 8 x 6 만 채움, 칸 32 x 32, 곧은 변 16, Y 축 홀수 줄 엇갈림)
//==============================================================================
function createHexagonalMap() {
	const chunkSize = 16;
	const chunkList = new System.Array(chunkSize * chunkSize).fill(0);
	for (let row = 0; row < 6; ++row) {
		for (let column = 0; column < 8; ++column) {
			let tile = 1;
			const noise = hashNoise(column, row, 31);
			if (column >= 5 && row <= 1) {
				tile = 3;
			}
			else if (row === 5) {
				tile = 2;
			}
			else if (noise < 0.18) {
				tile = 4;
			}
			else if (noise < 0.3) {
				tile = 5;
			}
			chunkList[row * chunkSize + column] = tile;
		}
	}
	chunkList[2 * chunkSize + 2] = 7;
	chunkList[3 * chunkSize + 5] = 8;
	// 화살표 육각을 0, 60, 120, 180 도로.
	chunkList[1 * chunkSize + 1] = 6;
	chunkList[1 * chunkSize + 2] = (6 | FLIP_DIAGONAL) >>> 0;
	chunkList[1 * chunkSize + 3] = (6 | 0x10000000) >>> 0;
	chunkList[1 * chunkSize + 4] = (6 | FLIP_DIAGONAL | 0x10000000) >>> 0;
	const mapData = {
		compressionlevel: -1,
		height: 6,
		hexsidelength: 16,
		infinite: true,
		layers: [
			{ chunks: [{ data: chunkList, height: chunkSize, width: chunkSize, x: 0, y: 0 }], height: chunkSize, id: 1, name: "ground", opacity: 1, startx: 0, starty: 0, type: "tilelayer", visible: true, width: chunkSize, x: 0, y: 0 },
		],
		nextlayerid: 2,
		nextobjectid: 1,
		orientation: "hexagonal",
		renderorder: "right-down",
		staggeraxis: "y",
		staggerindex: "odd",
		tiledversion: "1.12.0",
		tileheight: 32,
		tilesets: [{ columns: 4, firstgid: 1, image: "hexagon.png", imageheight: 64, imagewidth: 128, margin: 0, name: "hexagon", spacing: 0, tilecount: 8, tileheight: 32, tilewidth: 32 }],
		tilewidth: 32,
		type: "map",
		version: "1.10",
		width: 8,
	};
	fs.writeFileSync(path.join(ASSET_DIRECTORY_PATH, "hexagonal.tmj"), JSON.stringify(mapData, null, 1) + "\n");
}

fs.mkdirSync(ASSET_DIRECTORY_PATH, { recursive: true });
createTerrainImage();
createTreeImage();
createPropImages();
createIsometricImage();
createHexagonImage();
createOrthogonalMap();
createIsometricMap();
createHexagonalMap();
console.log("tilemapshowcase assets written:", fs.readdirSync(ASSET_DIRECTORY_PATH).join(", "));
