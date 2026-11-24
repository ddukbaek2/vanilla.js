//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Graphic } from "../graphic.js";
import { Component } from "../component.js";


//==============================================================================
// 부드러운 그늘의 모양.
//==============================================================================
export const SoftShadeShape = System.Object.freeze({
	band: "band", // 가운데 가로줄이 가장 짙고 위아래 끝으로 차츰 엷어지는 띠. (양옆은 fadeWidth 안쪽까지 차츰)
	bottom: "bottom", // 아래 끝이 가장 짙고 위 끝에서 0 인 세로 그라데이션.
});


//==============================================================================
// 부드럽게 0 에서 1 로. (edge 이하에서 세제곱 곡선, edge 가 0 이면 계단)
//==============================================================================
/**
 * @param { number } edge
 * @param { number } value
 * @returns { number }
 */
function readSmoothRise(edge, value) {
	if (edge <= 0) {
		return value > 0 ? 1 : 0;
	}
	const ratio = System.Math.min(1, System.Math.max(0, value / edge));
	return ratio * ratio * (3 - 2 * ratio);
}


//==============================================================================
// 부드러운 그늘.
// - 글 뒤를 어둡게 눌러 밝은 바탕 위에서도 읽히게 할 때 쓴다. 모양을 작은 캔버스 한 장에 구워 노드의 내용 크기로 늘려 그린다.
// - 부드러운 그라데이션이라 낮은 해상도로 구워 늘려도 자국이 보이지 않는다. (구운 한 픽셀이 굽기 단위만큼을 덮고, 가로세로 상한이 있다)
// - 노드 크기, 모양, 색, 짙기, 양옆 흐림이 바뀌면 다시 굽는다. 노드의 불투명도는 한 장째로 먹는다.
//==============================================================================
export class SoftShade extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { string } */ #shape; // 모양. (SoftShadeShape)
	/** @private @type { string } */ #color; // 색. ("#rrggbb")
	/** @private @type { number } */ #opacity; // 가장 짙은 곳의 불투명도.
	/** @private @type { number } */ #fadeWidth; // 띠의 양옆이 엷어지는 너비. (내용 크기 단위)
	/** @private @type { number } */ #bakeUnit; // 구운 캔버스 한 픽셀이 덮는 내용 크기 단위.
	/** @private @type { number } */ #bakeMaximumSize; // 구운 캔버스의 가로세로 상한. (픽셀)
	/** @private @type { HTMLCanvasElement | null } */ #bakeCanvas; // 구운 캔버스.
	/** @private @type { string } */ #bakeKey; // 구운 값.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.setComponentType("SoftShade");
		this.#shape = SoftShadeShape.band;
		this.#color = "#000000";
		this.#opacity = 0.5;
		this.#fadeWidth = 0;
		this.#bakeUnit = 4;
		this.#bakeMaximumSize = 256;
		this.#bakeCanvas = null;
		this.#bakeKey = "";
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 */
	draw(graphic) {
		const node = this.getNode();
		const contentSize = node.getContentSize();
		const contentWidth = contentSize.x;
		const contentHeight = contentSize.y;
		const opacity = this.getOpacity();
		if (contentWidth <= 0 || contentHeight <= 0 || opacity <= 0) {
			return;
		}
		const bakeUnit = this.getBakeUnit();
		const bakeMaximumSize = this.getBakeMaximumSize();
		const bakeWidth = System.Math.max(2, System.Math.min(bakeMaximumSize, System.Math.ceil(contentWidth / bakeUnit)));
		const bakeHeight = System.Math.max(2, System.Math.min(bakeMaximumSize, System.Math.ceil(contentHeight / bakeUnit)));
		const fadeWidth = this.getFadeWidth();
		const fadeRatio = System.Math.min(0.5, fadeWidth / contentWidth);
		const shape = this.getShape();
		const color = this.getColor();
		const fadeRatioText = fadeRatio.toFixed(3);
		const bakeKey = `${shape}|${color}|${opacity}|${fadeRatioText}|${bakeWidth}|${bakeHeight}`;
		if (bakeKey !== this.#bakeKey) {
			this.#bakeKey = bakeKey;
			this.bakeShade(bakeWidth, bakeHeight, fadeRatio);
		}
		const bakeCanvas = this.getBakeCanvas();
		if (bakeCanvas === null) {
			return;
		}
		graphic.drawImageWithSourceAndDestination(bakeCanvas, 0, 0, bakeCanvas.width, bakeCanvas.height, 0, 0, contentWidth, contentHeight);
	}

	//==============================================================================
	// 내용 영역 안에서만 그리는지 반환. (구운 그늘을 내용 크기로 늘려 그린다)
	// - draw 를 덮어쓴 하위 클래스는 어디에 그리는지 모르므로 false.
	//==============================================================================
	/**
	 * @override
	 * @returns { boolean }
	 */
	isDrawnInsideContent() {
		return this.draw === SoftShade.prototype.draw;
	}

	//==============================================================================
	// 굽기. (픽셀마다 알파를 셈한다, 텍스처 캐시가 캔버스마다 한 번 올리므로 구울 때마다 새 캔버스)
	//==============================================================================
	/**
	 * @param { number } bakeWidth
	 * @param { number } bakeHeight
	 * @param { number } fadeRatio
	 */
	bakeShade(bakeWidth, bakeHeight, fadeRatio) {
		const bakeCanvas = System.document.createElement("canvas");
		const canvasRenderingContext = bakeCanvas.getContext("2d");
		if (canvasRenderingContext === null) {
			this.#bakeCanvas = null;
			return;
		}
		bakeCanvas.width = bakeWidth;
		bakeCanvas.height = bakeHeight;
		const color = this.getColor();
		const colorText = color.slice(1);
		const colorValue = System.parseInt(colorText, 16);
		const red = (colorValue >> 16) & 255;
		const green = (colorValue >> 8) & 255;
		const blue = colorValue & 255;
		const opacity = this.getOpacity();
		const shape = this.getShape();
		const isBand = shape === SoftShadeShape.band;
		const imageData = canvasRenderingContext.createImageData(bakeWidth, bakeHeight);
		const pixels = imageData.data;
		for (let row = 0; row < bakeHeight; ++row) {
			const down = (row + 0.5) / bakeHeight;
			const rowShade = isBand ? readSmoothRise(0.5, System.Math.min(down, 1 - down)) : down;
			for (let column = 0; column < bakeWidth; ++column) {
				const across = (column + 0.5) / bakeWidth;
				const columnShade = isBand ? readSmoothRise(fadeRatio, System.Math.min(across, 1 - across)) : 1;
				const pixelIndex = (row * bakeWidth + column) * 4;
				pixels[pixelIndex] = red;
				pixels[pixelIndex + 1] = green;
				pixels[pixelIndex + 2] = blue;
				pixels[pixelIndex + 3] = System.Math.round(255 * opacity * rowShade * columnShade);
			}
		}
		canvasRenderingContext.putImageData(imageData, 0, 0);
		this.#bakeCanvas = bakeCanvas;
	}

	//==============================================================================
	// 그늘 설정. (모양, 색, 가장 짙은 곳의 불투명도, 띠의 양옆이 엷어지는 너비)
	//==============================================================================
	/**
	 * @param { string } shape - SoftShadeShape
	 * @param { string } color - "#rrggbb"
	 * @param { number } opacity
	 * @param { number } fadeWidth
	 */
	setShade(shape, color, opacity, fadeWidth = 0) {
		this.#shape = shape;
		this.#color = color;
		this.#opacity = opacity;
		this.#fadeWidth = fadeWidth;
	}

	//==============================================================================
	// 굽기 해상도 설정. (구운 한 픽셀이 덮는 단위, 가로세로 상한)
	//==============================================================================
	/**
	 * @param { number } bakeUnit
	 * @param { number } bakeMaximumSize
	 */
	setBakeResolution(bakeUnit, bakeMaximumSize) {
		this.#bakeUnit = System.Math.max(1, bakeUnit);
		this.#bakeMaximumSize = System.Math.max(2, bakeMaximumSize);
	}

	//==============================================================================
	// 모양 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getShape() {
		return this.#shape;
	}

	//==============================================================================
	// 색 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getColor() {
		return this.#color;
	}

	//==============================================================================
	// 가장 짙은 곳의 불투명도 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getOpacity() {
		return this.#opacity;
	}

	//==============================================================================
	// 띠의 양옆이 엷어지는 너비 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getFadeWidth() {
		return this.#fadeWidth;
	}

	//==============================================================================
	// 구운 한 픽셀이 덮는 단위 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getBakeUnit() {
		return this.#bakeUnit;
	}

	//==============================================================================
	// 구운 캔버스의 가로세로 상한 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getBakeMaximumSize() {
		return this.#bakeMaximumSize;
	}

	//==============================================================================
	// 구운 캔버스 반환. (아직 굽지 않았으면 null)
	//==============================================================================
	/**
	 * @returns { HTMLCanvasElement | null }
	 */
	getBakeCanvas() {
		return this.#bakeCanvas;
	}
}
