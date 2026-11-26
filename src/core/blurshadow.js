//==============================================================================
// 흐린 둥근 사각형 그림자. (엔진이 그리는 문맥 메뉴가 쓴다, 러스트 판 core/blurshadow.rs 와 같은 셈)
// - 브라우저의 CSS box-shadow 를 쓰지 않고, 둥근 사각형의 덮인 정도를 같은 시그마의 가우스로 흐린 그림을 CPU 로 구워 엔진 Graphic 으로 그린다.
//   두 엔진이 같은 셈으로 같은 그림을 굽는다.
// - 흐림 반경을 시그마로 바꾸는 셈은 크롬 원문 그대로다.
//   CSS box-shadow 와 Canvas2D shadowBlur 는 블링크 shadow_data.h 의 BlurRadiusToStdDev (반경 x 0.5, 명세 그대로),
//   views 그림자(gfx::ShadowValue)는 ui/gfx/skia_paint_util.cc 의 RadiusToSigma(blur / 2) (0.288675 x 반경 + 0.5).
// - 그림은 지금 변환의 배율(기기 픽셀)로 굽고, 크기, 모서리, 시그마, 배율, 색이 같으면 다시 굽지 않는다.
//==============================================================================


//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Vector2 } from "../base/vector2.js";
const System = globalThis;


//==============================================================================
// CSS box-shadow 의 흐림 반경을 가우스 시그마로. (블링크 ShadowData::BlurRadiusToStdDev, 반경의 반, 러스트 판 css_blur_radius_to_sigma)
//==============================================================================
/**
 * @param { number } blurRadius CSS 흐림 반경. (CSS 픽셀, 0 이상)
 * @returns { number } 시그마. (CSS 픽셀)
 */
export function cssBlurRadiusToSigma(blurRadius) {
	return System.Math.max(blurRadius, 0) * 0.5;
}


//==============================================================================
// 크롬 views 그림자 값(gfx::ShadowValue 의 blur)을 가우스 시그마로. (ui/gfx/skia_paint_util.cc 의 RadiusToSigma(blur / 2), 러스트 판 views_shadow_blur_to_sigma)
//==============================================================================
/**
 * @param { number } shadowBlur ShadowValue 의 blur. (도형 안팎을 같이 센 정수 픽셀)
 * @returns { number } 시그마. (DIP)
 */
export function viewsShadowBlurToSigma(shadowBlur) {
	// blur() / 2 는 정수 나눗셈이고, 0.288675f 는 float 를 double 로 넓혀 셈한 뒤 float 로 돌린다.
	const radius = System.Math.trunc(shadowBlur / 2);
	if (radius > 0) {
		return System.Math.fround(System.Math.fround(0.288675) * radius + 0.5);
	}
	return 0;
}


//==============================================================================
// 둥근 사각형의 덮인 정도를 가우스로 흐린 그림 굽기. (러스트 판 bake_shadow_mask)
// - 덮인 정도는 픽셀 가운데의 부호 거리로 셈한 반 픽셀 앤티에일리어싱이다.
// - 가우스는 가로, 세로 두 번 나눠 걸고(같은 값이 되는 줄과 열은 다시 셈하지 않는다), 낟알은 3 시그마까지 합이 1 이 되게 고른다.
//==============================================================================
/**
 * @param { number } width 둥근 사각형 폭. (기기 픽셀)
 * @param { number } height 둥근 사각형 높이. (기기 픽셀)
 * @param { number } cornerRadius 모서리 반지름. (기기 픽셀)
 * @param { number } sigma 가우스 시그마. (기기 픽셀, 0 이면 흐리지 않는다)
 * @returns { { width: number, height: number, margin: number, coverageList: Float32Array } } 구운 덮임 그림. (기기 픽셀, 둥근 사각형은 (margin, margin) 에서 시작, 덮인 정도는 줄마다 왼쪽에서 오른쪽으로)
 */
export function bakeShadowMask(width, height, cornerRadius, sigma) {
	width = System.Math.max(width, 0);
	height = System.Math.max(height, 0);
	cornerRadius = System.Math.min(System.Math.max(cornerRadius, 0), width * 0.5, height * 0.5);
	const kernelRadius = sigma > 0.01 ? System.Math.ceil(sigma * 3) : 0;
	const margin = kernelRadius + 1;
	const imageWidth = System.Math.ceil(width) + margin * 2;
	const imageHeight = System.Math.ceil(height) + margin * 2;
	// 가우스 낟알.
	const kernel = new System.Float32Array(kernelRadius * 2 + 1);
	if (kernelRadius === 0) {
		kernel[0] = 1;
	}
	else {
		const denominator = 2 * sigma * sigma;
		let sum = 0;
		const weightList = [];
		for (let offset = -kernelRadius; offset <= kernelRadius; ++offset) {
			const weight = System.Math.exp(-(offset * offset) / denominator);
			sum += weight;
			weightList.push(weight);
		}
		for (let index = 0; index < weightList.length; ++index) {
			kernel[index] = weightList[index] / sum;
		}
	}
	// 덮인 정도와 가로 흐림. (열 먼저 담아 세로 흐림이 이어진 조각을 읽게 한다)
	const halfWidth = width * 0.5;
	const halfHeight = height * 0.5;
	const centerX = margin + halfWidth;
	const centerY = margin + halfHeight;
	const columnMajor = new System.Float32Array(imageWidth * imageHeight);
	const coverageRow = new System.Float32Array(imageWidth);
	let previousCoverageRow = null;
	const blurredRow = new System.Float32Array(imageWidth);
	for (let rowIndex = 0; rowIndex < imageHeight; ++rowIndex) {
		const localY = System.Math.abs(rowIndex + 0.5 - centerY) - (halfHeight - cornerRadius);
		for (let columnIndex = 0; columnIndex < imageWidth; ++columnIndex) {
			const localX = System.Math.abs(columnIndex + 0.5 - centerX) - (halfWidth - cornerRadius);
			const outsideX = System.Math.max(localX, 0);
			const outsideY = System.Math.max(localY, 0);
			const outsideLength = System.Math.sqrt(outsideX * outsideX + outsideY * outsideY);
			const distance = outsideLength + System.Math.min(System.Math.max(localX, localY), 0) - cornerRadius;
			coverageRow[columnIndex] = System.Math.min(System.Math.max(0.5 - distance, 0), 1);
		}
		if (previousCoverageRow === null || !isSameLine(coverageRow, previousCoverageRow)) {
			blurLine(coverageRow, kernel, kernelRadius, blurredRow);
			previousCoverageRow = coverageRow.slice();
		}
		for (let columnIndex = 0; columnIndex < imageWidth; ++columnIndex) {
			columnMajor[columnIndex * imageHeight + rowIndex] = blurredRow[columnIndex];
		}
	}
	// 세로 흐림.
	const coverageList = new System.Float32Array(imageWidth * imageHeight);
	const blurredColumn = new System.Float32Array(imageHeight);
	for (let columnIndex = 0; columnIndex < imageWidth; ++columnIndex) {
		const columnStart = columnIndex * imageHeight;
		const column = columnMajor.subarray(columnStart, columnStart + imageHeight);
		if (columnIndex === 0 || !isSameLine(column, columnMajor.subarray(columnStart - imageHeight, columnStart))) {
			blurLine(column, kernel, kernelRadius, blurredColumn);
		}
		for (let rowIndex = 0; rowIndex < imageHeight; ++rowIndex) {
			coverageList[rowIndex * imageWidth + columnIndex] = blurredColumn[rowIndex];
		}
	}
	return { width: imageWidth, height: imageHeight, margin, coverageList };
}


//==============================================================================
// 두 줄이 같은지.
//==============================================================================
function isSameLine(first, second) {
	if (first.length !== second.length) {
		return false;
	}
	for (let index = 0; index < first.length; ++index) {
		if (first[index] !== second[index]) {
			return false;
		}
	}
	return true;
}


//==============================================================================
// 한 줄 가우스. (줄 밖은 0)
//==============================================================================
function blurLine(source, kernel, kernelRadius, destination) {
	const length = source.length;
	for (let index = 0; index < length; ++index) {
		let sum = 0;
		const first = System.Math.max(index - kernelRadius, 0);
		const last = System.Math.min(index + kernelRadius, length - 1);
		for (let sourceIndex = first; sourceIndex <= last; ++sourceIndex) {
			sum += source[sourceIndex] * kernel[sourceIndex + kernelRadius - index];
		}
		destination[index] = sum;
	}
}


//==============================================================================
// 구운 덮임 그림을 그림 한 장으로. (곧은 RGBA, OffscreenCanvas 나 canvas, 둘 다 없으면 null)
//==============================================================================
function createShadowImage(mask, color) {
	let canvas = null;
	if (typeof System.OffscreenCanvas === "function") {
		canvas = new System.OffscreenCanvas(mask.width, mask.height);
	}
	else if (System.document && typeof System.document.createElement === "function") {
		canvas = System.document.createElement("canvas");
		canvas.width = mask.width;
		canvas.height = mask.height;
	}
	if (!canvas) {
		return null;
	}
	const context = canvas.getContext("2d");
	if (!context) {
		return null;
	}
	const red = System.Math.round(System.Math.min(System.Math.max(color.red, 0), 1) * 255);
	const green = System.Math.round(System.Math.min(System.Math.max(color.green, 0), 1) * 255);
	const blue = System.Math.round(System.Math.min(System.Math.max(color.blue, 0), 1) * 255);
	const alpha = System.Math.min(System.Math.max(color.alpha, 0), 1);
	const imageData = context.createImageData(mask.width, mask.height);
	const pixels = imageData.data;
	for (let index = 0; index < mask.coverageList.length; ++index) {
		const pixelIndex = index * 4;
		pixels[pixelIndex] = red;
		pixels[pixelIndex + 1] = green;
		pixels[pixelIndex + 2] = blue;
		pixels[pixelIndex + 3] = System.Math.round(mask.coverageList[index] * alpha * 255);
	}
	context.putImageData(imageData, 0, 0);
	return canvas;
}


//==============================================================================
// 흐린 둥근 사각형 그림자 그리개. (구운 그림 하나를 들고 같은 값이면 다시 쓴다, 러스트 판 BlurredRoundRectShadow)
//==============================================================================
export class BlurredRoundRectShadow {
	/** @private @type { string | null } */ #bakedKey; // 구운 값. (폭, 높이, 모서리, 시그마, 배율, 색)
	/** @private @type { OffscreenCanvas | HTMLCanvasElement | null } */ #bakedImage; // 구운 그림.
	/** @private @type { number } */ #bakedMargin; // 구운 그림의 여백. (기기 픽셀)

	//==============================================================================
	// 생성. (구운 그림 없음)
	//==============================================================================
	constructor() {
		this.#bakedKey = null;
		this.#bakedImage = null;
		this.#bakedMargin = 0;
	}

	//==============================================================================
	// 그림자 그리기. (지금 Graphic 변환 안의 논리 좌표)
	//==============================================================================
	/**
	 * @param { Graphic } graphic 그릴 Graphic.
	 * @param { Rect } shapeRect 그림자를 드리우는 둥근 사각형. (밀기 전)
	 * @param { number } cornerRadius 모서리 반지름.
	 * @param { Vector2 } offset 그림자 밀기.
	 * @param { number } sigma 가우스 시그마. (논리 픽셀)
	 * @param { Color } color 그림자 색. (덮인 정도에 알파를 곱한다)
	 */
	draw(graphic, shapeRect, cornerRadius, offset, sigma, color) {
		if (shapeRect.width <= 0 || shapeRect.height <= 0 || color.alpha <= 0) {
			return;
		}
		const transformMatrix = graphic.getTransformMatrix();
		const scale = System.Math.max(System.Math.sqrt(transformMatrix.a * transformMatrix.a + transformMatrix.b * transformMatrix.b), 0.001);
		const key = [shapeRect.width, shapeRect.height, cornerRadius, sigma, scale, color.red, color.green, color.blue, color.alpha].join(",");
		if (this.#bakedKey !== key || this.#bakedImage === null) {
			const mask = bakeShadowMask(shapeRect.width * scale, shapeRect.height * scale, cornerRadius * scale, sigma * scale);
			this.#bakedImage = createShadowImage(mask, color);
			this.#bakedMargin = mask.margin;
			this.#bakedKey = key;
		}
		if (this.#bakedImage) {
			const margin = this.#bakedMargin / scale;
			const position = Vector2.create(shapeRect.left + offset.x - margin, shapeRect.top + offset.y - margin);
			const contentSize = Vector2.create(this.#bakedImage.width / scale, this.#bakedImage.height / scale);
			graphic.drawImage(this.#bakedImage, position, contentSize);
		}
	}
}
