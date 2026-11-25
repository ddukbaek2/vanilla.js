//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");


//==============================================================================
// 전역 상수 목록.
//==============================================================================
const DEFAULT_MAXIMUM_PAGE_SIZE = 4096; // 쪽 그림의 가로세로 상한. (넘는 그림은 다음 쪽으로)
const DEFAULT_PADDING = 2; // 그림 사이 간격. (늘여 붙인 가장자리 바깥)
const DEFAULT_EXTRUDE = 0; // 그림 둘레에 가장자리 픽셀을 늘여 붙이는 수.


//==============================================================================
// 아틀라스 묶기.
// - 지정된 폴더의 모든 이미지(png, jpg)를 쪽 그림 몇 장과 JSON 하나로 묶는다. (SpriteAtlas.load 가 읽는다)
// - 쪽마다 모든 그림이 들어가는 가장 작은 2 의 거듭제곱 크기를 고르고, 상한(--max-size)에도 안 들어가는 그림은 다음 쪽으로 넘긴다.
// - 놓기는 MaxRects(남는 짧은 변이 가장 작은 빈자리)다. 긴 변이 긴 것, 넓은 것, 이름 차례로 놓아 같은 원본이면 늘 같은 결과다.
// - --extrude N: 그림 둘레에 가장자리 픽셀을 N 픽셀 늘여 붙인다. 확대, 축소, 밉맵에서 옆 그림이 번져 들지 않고, 바둑판으로 이어 그리는 그림의 이음매가 생기지 않는다.
//   JSON 의 자리는 늘여 붙인 것을 뺀 원래 그림의 자리다.
// - --padding N: 늘여 붙인 가장자리 바깥으로 그림 사이를 N 픽셀 띄운다.
// - 결과는 입력 폴더 옆에 <폴더 이름>.json 과 쪽 그림이다. 쪽이 한 장이면 <폴더 이름>.png, 여러 장이면 <폴더 이름>-0.png, <폴더 이름>-1.png ...
// - JSON: { images: { "파일 이름": { x, y, width, height, page } }, meta: { imageFileName, width, height, count, pages: [{ imageFileName, width, height }], extrude, padding } }
//   (images 와 meta 의 imageFileName, width, height, count 는 한 장이던 때와 같다, page 와 pages 를 더했다)
//==============================================================================


//==============================================================================
// 명령 줄 읽기. ({ targetDirectory, extrude, padding, maximumPageSize })
//==============================================================================
/**
 * @param { string[] } argumentList
 * @returns { object | null }
 */
function readArguments(argumentList) {
	const options = {
		targetDirectory: "",
		extrude: DEFAULT_EXTRUDE,
		padding: DEFAULT_PADDING,
		maximumPageSize: DEFAULT_MAXIMUM_PAGE_SIZE,
	};
	for (let argumentIndex = 0; argumentIndex < argumentList.length; ++argumentIndex) {
		const argument = argumentList[argumentIndex];
		if (argument === "--extrude" || argument === "--padding" || argument === "--max-size") {
			const value = Number.parseInt(argumentList[argumentIndex + 1], 10);
			argumentIndex += 1;
			if (!Number.isFinite(value) || value < 0) {
				console.error(`[AtlasPacker] 오류: ${argument} 다음에는 0 이상의 정수를 줍니다.`);
				return null;
			}
			if (argument === "--extrude") {
				options.extrude = value;
			}
			else if (argument === "--padding") {
				options.padding = value;
			}
			else {
				options.maximumPageSize = value;
			}
			continue;
		}
		options.targetDirectory = path.resolve(argument);
	}
	if (options.targetDirectory === "") {
		return null;
	}
	return options;
}

//==============================================================================
// 두 사각형이 겹치는지. ({ x, y, width, height })
//==============================================================================
function isOverlapping(first, second) {
	return first.x < second.x + second.width && second.x < first.x + first.width && first.y < second.y + second.height && second.y < first.y + first.height;
}

//==============================================================================
// 사각형이 다른 사각형 안에 드는지.
//==============================================================================
function isContained(inner, outer) {
	return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}

//==============================================================================
// 한 쪽에 놓기. (MaxRects, 남는 짧은 변이 가장 작은 빈자리에)
// - items: [{ name, width, height }] (간격과 늘여 붙인 몫을 넣은 크기)
// - 놓은 것은 Map(이름 → { x, y }), 못 놓은 것은 이름 목록으로 돌려준다.
//==============================================================================
function packPage(items, pageWidth, pageHeight) {
	let freeRects = [{ x: 0, y: 0, width: pageWidth, height: pageHeight }];
	const placements = new Map();
	const rejectedNames = [];
	for (const item of items) {
		let bestPosition = null;
		let bestShortScore = 0;
		let bestLongScore = 0;
		for (const freeRect of freeRects) {
			if (item.width > freeRect.width || item.height > freeRect.height) {
				continue;
			}
			const leftoverWidth = freeRect.width - item.width;
			const leftoverHeight = freeRect.height - item.height;
			const shortScore = Math.min(leftoverWidth, leftoverHeight);
			const longScore = Math.max(leftoverWidth, leftoverHeight);
			if (bestPosition === null || shortScore < bestShortScore || (shortScore === bestShortScore && longScore < bestLongScore)) {
				bestPosition = { x: freeRect.x, y: freeRect.y };
				bestShortScore = shortScore;
				bestLongScore = longScore;
			}
		}
		if (bestPosition === null) {
			rejectedNames.push(item.name);
			continue;
		}
		const placedRect = { x: bestPosition.x, y: bestPosition.y, width: item.width, height: item.height };
		placements.set(item.name, bestPosition);
		const nextFreeRects = [];
		for (const freeRect of freeRects) {
			if (!isOverlapping(freeRect, placedRect)) {
				nextFreeRects.push(freeRect);
				continue;
			}
			const freeRight = freeRect.x + freeRect.width;
			const freeBottom = freeRect.y + freeRect.height;
			const placedRight = placedRect.x + placedRect.width;
			const placedBottom = placedRect.y + placedRect.height;
			if (placedRect.x > freeRect.x) {
				nextFreeRects.push({ x: freeRect.x, y: freeRect.y, width: placedRect.x - freeRect.x, height: freeRect.height });
			}
			if (placedRight < freeRight) {
				nextFreeRects.push({ x: placedRight, y: freeRect.y, width: freeRight - placedRight, height: freeRect.height });
			}
			if (placedRect.y > freeRect.y) {
				nextFreeRects.push({ x: freeRect.x, y: freeRect.y, width: freeRect.width, height: placedRect.y - freeRect.y });
			}
			if (placedBottom < freeBottom) {
				nextFreeRects.push({ x: freeRect.x, y: placedBottom, width: freeRect.width, height: freeBottom - placedBottom });
			}
		}
		// 다른 빈자리 안에 드는 빈자리는 버린다. (똑같은 둘은 앞의 것만 남긴다)
		freeRects = nextFreeRects.filter((freeRect, freeIndex) => {
			for (let otherIndex = 0; otherIndex < nextFreeRects.length; ++otherIndex) {
				const otherRect = nextFreeRects[otherIndex];
				if (otherIndex === freeIndex || !isContained(freeRect, otherRect)) {
					continue;
				}
				const isSame = freeRect.x === otherRect.x && freeRect.y === otherRect.y && freeRect.width === otherRect.width && freeRect.height === otherRect.height;
				if (isSame && freeIndex < otherIndex) {
					continue;
				}
				return false;
			}
			return true;
		});
	}
	return { placements: placements, rejectedNames: rejectedNames };
}

//==============================================================================
// 쪽 크기 후보. (2 의 거듭제곱, 넓이가 작은 것부터, 같으면 정사각형에 가까운 것, 그다음 가로가 긴 것)
//==============================================================================
function readPageSizes(maximumPageSize) {
	const pageSizes = [];
	for (let width = 16; width <= maximumPageSize; width *= 2) {
		for (let height = 16; height <= maximumPageSize; height *= 2) {
			pageSizes.push({ width: width, height: height });
		}
	}
	pageSizes.sort((first, second) => {
		const firstArea = first.width * first.height;
		const secondArea = second.width * second.height;
		if (firstArea !== secondArea) {
			return firstArea - secondArea;
		}
		const firstDifference = Math.abs(first.width - first.height);
		const secondDifference = Math.abs(second.width - second.height);
		if (firstDifference !== secondDifference) {
			return firstDifference - secondDifference;
		}
		return second.width - first.width;
	});
	return pageSizes;
}

//==============================================================================
// 여러 쪽으로 나누어 놓기. (남은 것이 모두 들어가는 가장 작은 쪽, 가장 큰 쪽에도 다 안 들어가면 들어간 만큼 놓고 다음 쪽으로)
//==============================================================================
function packPages(items, maximumPageSize) {
	const pageSizes = readPageSizes(maximumPageSize);
	for (const item of items) {
		if (item.width > maximumPageSize || item.height > maximumPageSize) {
			throw new Error(`쪽(${maximumPageSize})보다 큰 그림입니다: ${item.name}`);
		}
	}
	const pages = [];
	let remainingItems = items.slice();
	while (remainingItems.length > 0) {
		let chosenPage = null;
		for (const pageSize of pageSizes) {
			const packResult = packPage(remainingItems, pageSize.width, pageSize.height);
			if (packResult.rejectedNames.length === 0) {
				chosenPage = { width: pageSize.width, height: pageSize.height, placements: packResult.placements };
				break;
			}
		}
		if (chosenPage === null) {
			const packResult = packPage(remainingItems, maximumPageSize, maximumPageSize);
			chosenPage = { width: maximumPageSize, height: maximumPageSize, placements: packResult.placements };
		}
		pages.push(chosenPage);
		remainingItems = remainingItems.filter((item) => {
			return !chosenPage.placements.has(item.name);
		});
	}
	return pages;
}

//==============================================================================
// 그림 하나를 가장자리를 늘여 붙여 그리기. (x, y 는 늘여 붙인 몫을 넣은 왼쪽 위)
//==============================================================================
function drawExtrudedImage(canvasRenderingContext, image, x, y, extrude) {
	const width = image.width;
	const height = image.height;
	const imageX = x + extrude;
	const imageY = y + extrude;
	canvasRenderingContext.drawImage(image, imageX, imageY);
	if (extrude <= 0) {
		return;
	}
	// 변의 한 줄을 늘여 붙인다. (왼쪽, 오른쪽, 위, 아래)
	canvasRenderingContext.drawImage(image, 0, 0, 1, height, x, imageY, extrude, height);
	canvasRenderingContext.drawImage(image, width - 1, 0, 1, height, imageX + width, imageY, extrude, height);
	canvasRenderingContext.drawImage(image, 0, 0, width, 1, imageX, y, width, extrude);
	canvasRenderingContext.drawImage(image, 0, height - 1, width, 1, imageX, imageY + height, width, extrude);
	// 귀퉁이 한 점을 늘여 붙인다.
	canvasRenderingContext.drawImage(image, 0, 0, 1, 1, x, y, extrude, extrude);
	canvasRenderingContext.drawImage(image, width - 1, 0, 1, 1, imageX + width, y, extrude, extrude);
	canvasRenderingContext.drawImage(image, 0, height - 1, 1, 1, x, imageY + height, extrude, extrude);
	canvasRenderingContext.drawImage(image, width - 1, height - 1, 1, 1, imageX + width, imageY + height, extrude, extrude);
}

//==============================================================================
// 아틀라스 묶기.
//==============================================================================
/**
 * @param { object } options { targetDirectory, extrude, padding, maximumPageSize }
 */
async function packAtlas(options) {
	const targetDirectory = options.targetDirectory;
	if (!fs.existsSync(targetDirectory) || !fs.statSync(targetDirectory).isDirectory()) {
		console.error(`[AtlasPacker] 오류: 입력 폴더가 존재하지 않거나 폴더가 아닙니다: ${targetDirectory}`);
		process.exit(1);
	}

	// 폴더 이름을 결과물의 이름으로 사용 (입력 폴더와 동일 계층)
	const folderName = path.basename(targetDirectory);
	const parentDirectory = path.dirname(targetDirectory);
	const atlasDataFileName = `${folderName}.json`;

	// 이미지 파일 필터링
	const fileNames = fs.readdirSync(targetDirectory).filter((fileName) => {
		const extension = path.extname(fileName).toLowerCase();
		return extension === ".png" || extension === ".jpg" || extension === ".jpeg";
	}).sort();
	if (fileNames.length === 0) {
		console.log("[AtlasPacker] 해당 폴더에 이미지 파일이 없습니다.");
		return;
	}
	console.log(`[AtlasPacker] 총 ${fileNames.length}개의 이미지 파일을 로드하는 중...`);

	// 이미지 파일 불러오기.
	const images = new Map();
	const items = [];
	const extrude = options.extrude;
	const padding = options.padding;
	for (const fileName of fileNames) {
		const fileFullName = path.join(targetDirectory, fileName);
		try {
			const image = await loadImage(fileFullName);
			images.set(fileName, image);
			items.push({ name: fileName, width: image.width + extrude * 2 + padding, height: image.height + extrude * 2 + padding });
		}
		catch (error) {
			console.error(`[AtlasPacker] 이미지 로드 실패: ${fileName}`, error);
		}
	}
	if (items.length === 0) {
		console.log("[AtlasPacker] 처리할 수 있는 이미지가 없습니다.");
		return;
	}

	// 긴 변이 긴 것부터, 넓은 것부터, 이름 차례로. (같은 원본이면 늘 같은 결과)
	items.sort((first, second) => {
		const firstLong = Math.max(first.width, first.height);
		const secondLong = Math.max(second.width, second.height);
		if (firstLong !== secondLong) {
			return secondLong - firstLong;
		}
		const firstArea = first.width * first.height;
		const secondArea = second.width * second.height;
		if (firstArea !== secondArea) {
			return secondArea - firstArea;
		}
		return first.name < second.name ? -1 : (first.name > second.name ? 1 : 0);
	});
	let pages;
	try {
		pages = packPages(items, options.maximumPageSize);
	}
	catch (error) {
		console.error(`[AtlasPacker] 오류: ${error.message}`);
		process.exit(1);
	}

	// 쪽마다 캔버스에 그린다. (늘여 붙일 때 번지지 않게 부드럽게 늘이지 않는다)
	const jsonOutput = { images: {}, meta: {} };
	const pageList = [];
	for (let pageIndex = 0; pageIndex < pages.length; ++pageIndex) {
		const page = pages[pageIndex];
		const pageFileName = pages.length === 1 ? `${folderName}.png` : `${folderName}-${pageIndex}.png`;
		const canvas = createCanvas(page.width, page.height);
		const canvasRenderingContext = canvas.getContext("2d");
		canvasRenderingContext.imageSmoothingEnabled = false;
		for (const [fileName, position] of page.placements) {
			const image = images.get(fileName);
			drawExtrudedImage(canvasRenderingContext, image, position.x, position.y, extrude);
			jsonOutput.images[fileName] = {
				x: position.x + extrude,
				y: position.y + extrude,
				width: image.width,
				height: image.height,
				page: pageIndex,
			};
		}
		const pageFileFullName = path.join(parentDirectory, pageFileName);
		fs.writeFileSync(pageFileFullName, canvas.toBuffer("image/png"));
		pageList.push({ imageFileName: pageFileName, width: page.width, height: page.height });
		console.log(`[AtlasPacker] 쪽 ${pageIndex}: ${pageFileFullName} (${page.width}x${page.height}, 그림 ${page.placements.size} 장)`);
	}

	// 이름 차례로 다시 담는다. (같은 원본이면 늘 같은 JSON)
	const sortedImages = {};
	for (const fileName of Object.keys(jsonOutput.images).sort()) {
		sortedImages[fileName] = jsonOutput.images[fileName];
	}
	jsonOutput.images = sortedImages;
	jsonOutput.meta = {
		imageFileName: pageList[0].imageFileName,
		width: pageList[0].width,
		height: pageList[0].height,
		count: items.length,
		pages: pageList,
		extrude: extrude,
		padding: padding,
	};
	const atlasDataFileFullName = path.join(parentDirectory, atlasDataFileName);
	fs.writeFileSync(atlasDataFileFullName, JSON.stringify(jsonOutput, null, "\t"));
	console.log(`[AtlasPacker] 완료: ${atlasDataFileFullName}`);
}


//==============================================================================
// 진입점.
//==============================================================================
function main() {
	const options = readArguments(process.argv.slice(2));
	if (options === null) {
		console.log("[AtlasPacker] 사용법: node tools/atlas.cjs <폴더경로> [--extrude 픽셀] [--padding 픽셀] [--max-size 쪽 상한]");
		process.exit(1);
	}

	// canvas 패키지 로드 가능 여부 사전 체크
	try {
		require.resolve("canvas");
	}
	catch (error) {
		console.error("[AtlasPacker] 오류: 'canvas' 패키지가 설치되어 있지 않습니다.");
		console.error("다음 명령어를 실행하여 패키지를 설치해주세요: npm install canvas");
		process.exit(1);
	}

	packAtlas(options).catch((error) => {
		console.error("[AtlasPacker] 오류: 작업 중 예기치 않은 오류가 발생했습니다:", error);
	});
}

main();
