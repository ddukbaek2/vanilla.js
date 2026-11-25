//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Rect } from "../../base/rect.js";
import { Graphic } from "../graphic.js";
import { Component } from "../component.js";
import { buildRGBAString } from "./shadowtext.js";
import { acquireSharedBake, releaseSharedBake } from "../graphic/sharedbakecache.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 구운 캔버스의 가장자리 여유. (안티앨리어싱, 픽셀)
const BAKE_PADDING = 2;

// 그림마다 붙이는 번호. (구운 그림을 나눠 쓰는 열쇠, setImage 할 때마다 새 번호를 붙여 그 그림을 다시 굽게 한다)
const imageIdentifiers = new System.WeakMap();
let nextImageIdentifier = 1;


//==============================================================================
// 그림자를 깐 그림.
// - 그림(또는 아틀라스의 한 조각)을 노드 안에 비를 지켜 가장 크게, 가운데로 그린다.
// - ShadowText 와 같이 그림의 모양(불투명도) 밑에 그림자를 칠한 모습을 캔버스 한 장에 구워 그 한 장을 그린다.
//   노드의 불투명도가 그림과 그림자에 한 장째로 먹는다.
// - 그림 색을 주면 그림을 그 색 한 빛의 모양으로 칠한다. (같은 자리 위에 원래 그림을 얹어 그림자만 남기는 감쌈 등)
// - 그리는 배율(기기의 DPR, 뷰 배율), 그림, 색, 그림자, 노드 크기가 바뀌면 다시 굽는다. 그림자가 번지는 만큼 가장자리를 넓힌다.
//==============================================================================
export class ShadowImage extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { HTMLImageElement | HTMLCanvasElement | null } */ #image; // 그림.
	/** @private @type { Rect | null } */ #imageRect; // 그림 안의 조각. (null 이면 그림 전체)
	/** @private @type { string | null } */ #imageColor; // 그림을 한 빛으로 칠할 색. (null 이면 그림 그대로)
	/** @private @type { string } */ #shadowColor; // "#rrggbb"
	/** @private @type { number } */ #shadowOpacity;
	/** @private @type { number } */ #shadowOffset; // 그림자가 그림 아래로 내려가는 만큼. (내용 크기 단위)
	/** @private @type { number } */ #shadowBlur; // 그림자가 번지는 만큼. (내용 크기 단위, 0 이면 번지지 않는다)
	/** @private @type { number } */ #imageVersion; // 그림이나 조각을 바꾼 횟수. (바뀌면 다시 굽는다)
	/** @private @type { HTMLCanvasElement | null } */ #bakeCanvas; // 구운 한 장. (굽지 않았으면 null)
	/** @private @type { string } */ #bakeKey; // 구운 조건.
	/** @private @type { object } */ #bakeMetrics; // 구운 한 장의 논리 좌표 치수. { scale, imageLeft, imageTop }

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.setComponentType("ShadowImage");
		this.#image = null;
		this.#imageRect = null;
		this.#imageColor = null;
		this.#shadowColor = "#000000";
		this.#shadowOpacity = 1;
		this.#shadowOffset = 0;
		this.#shadowBlur = 0;
		this.#imageVersion = 0;
		this.#bakeCanvas = null;
		this.#bakeKey = "";
		this.#bakeMetrics = { scale: 1, imageLeft: 0, imageTop: 0 };
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 */
	draw(graphic) {
		const image = this.getImage();
		if (image === null) {
			return;
		}
		const sourceRect = this.readSourceRect();
		if (sourceRect.width <= 0 || sourceRect.height <= 0) {
			return;
		}
		const node = this.getNode();
		const contentSize = node.getContentSize();
		const contentWidth = contentSize.x;
		const contentHeight = contentSize.y;
		if (contentWidth <= 0 || contentHeight <= 0) {
			return;
		}

		// 노드 안에 그림의 비를 지켜 가장 크게, 가운데로.
		const fitScale = System.Math.min(contentWidth / sourceRect.width, contentHeight / sourceRect.height);
		const imageWidth = sourceRect.width * fitScale;
		const imageHeight = sourceRect.height * fitScale;
		const bakeScale = graphic.calculateTextBakeScale();
		let imageIdentifier = imageIdentifiers.get(image);
		if (imageIdentifier === undefined) {
			imageIdentifier = nextImageIdentifier;
			nextImageIdentifier += 1;
			imageIdentifiers.set(image, imageIdentifier);
		}
		const bakeKey = ["ShadowImage", imageIdentifier, sourceRect.left, sourceRect.top, sourceRect.width, sourceRect.height, this.#imageColor, this.#shadowColor, this.#shadowOpacity, this.#shadowOffset, this.#shadowBlur, imageWidth, imageHeight, bakeScale].join("|");
		if (bakeKey !== this.#bakeKey) {
			// 같은 그림과 모양을 구운 것이 있으면 나눠 쓰고, 없으면 굽는다. (sharedbakecache.js)
			releaseSharedBake(this.#bakeKey, this);
			this.#bakeKey = bakeKey;
			const bake = acquireSharedBake(bakeKey, this, () => {
				this.bakeImage(image, sourceRect, imageWidth, imageHeight, bakeScale);
				return { canvas: this.getBakeCanvas(), metrics: this.#bakeMetrics };
			});
			this.#bakeCanvas = bake.canvas;
			this.#bakeMetrics = bake.metrics;
		}
		const bakeCanvas = this.getBakeCanvas();
		if (bakeCanvas === null) {
			return;
		}
		const bakeMetrics = this.#bakeMetrics;
		const quadX = (contentWidth - imageWidth) * 0.5 - bakeMetrics.imageLeft;
		const quadY = (contentHeight - imageHeight) * 0.5 - bakeMetrics.imageTop;
		const quadWidth = bakeCanvas.width / bakeMetrics.scale;
		const quadHeight = bakeCanvas.height / bakeMetrics.scale;
		graphic.drawImageWithSourceAndDestination(bakeCanvas, 0, 0, bakeCanvas.width, bakeCanvas.height, quadX, quadY, quadWidth, quadHeight);
	}

	//==============================================================================
	// 노드에서 떨어짐. (나눠 쓰던 구운 그림을 놓는다)
	//==============================================================================
	/**
	 * @override
	 * @param { ComponentNode } node
	 */
	detach(node) {
		releaseSharedBake(this.#bakeKey, this);
		this.#bakeKey = "";
		this.#bakeCanvas = null;
		super.detach(node);
	}

	//==============================================================================
	// 그림 안의 조각 읽기. (조각이 없으면 그림 전체)
	//==============================================================================
	/**
	 * @returns { { left: number, top: number, width: number, height: number } }
	 */
	readSourceRect() {
		const imageRect = this.getImageRect();
		if (imageRect !== null) {
			return { left: imageRect.left, top: imageRect.top, width: imageRect.width, height: imageRect.height };
		}
		const image = this.getImage();
		const imageWidth = image.naturalWidth || image.width;
		const imageHeight = image.naturalHeight || image.height;
		return { left: 0, top: 0, width: imageWidth, height: imageHeight };
	}

	//==============================================================================
	// 굽기. (그림을 한 번 칠하면 캔버스가 그 밑에 그림자를 먼저 칠한다)
	// - 텍스처 캐시가 캔버스마다 한 번 올리므로 구울 때마다 새 캔버스를 만든다.
	//==============================================================================
	/**
	 * @param { HTMLImageElement | HTMLCanvasElement } image
	 * @param { object } sourceRect
	 * @param { number } imageWidth
	 * @param { number } imageHeight
	 * @param { number } bakeScale
	 */
	bakeImage(image, sourceRect, imageWidth, imageHeight, bakeScale) {
		const scaledImageWidth = System.Math.max(1, System.Math.round(imageWidth * bakeScale));
		const scaledImageHeight = System.Math.max(1, System.Math.round(imageHeight * bakeScale));
		const scaledShadowOffset = this.#shadowOffset * bakeScale;
		const scaledShadowBlur = this.#shadowBlur * bakeScale;

		// 번지는 그림자가 잘리지 않게 사방을 번지는 만큼 넓힌다.
		const bakePadding = BAKE_PADDING + System.Math.ceil(scaledShadowBlur);
		const bakeCanvas = System.document.createElement("canvas");
		bakeCanvas.width = scaledImageWidth + bakePadding * 2;
		bakeCanvas.height = scaledImageHeight + bakePadding * 2 + System.Math.ceil(scaledShadowOffset);
		const canvasRenderingContext = bakeCanvas.getContext("2d");
		if (canvasRenderingContext === null) {
			this.#bakeCanvas = null;
			return;
		}
		const sourceImage = this.readScaledImage(image, sourceRect, scaledImageWidth, scaledImageHeight);
		if (sourceImage === null) {
			this.#bakeCanvas = null;
			return;
		}
		canvasRenderingContext.shadowColor = buildRGBAString(this.#shadowColor, this.#shadowOpacity);
		canvasRenderingContext.shadowBlur = scaledShadowBlur;
		canvasRenderingContext.shadowOffsetX = 0;
		canvasRenderingContext.shadowOffsetY = scaledShadowOffset;
		canvasRenderingContext.drawImage(sourceImage, bakePadding, bakePadding);
		this.#bakeCanvas = bakeCanvas;
		this.#bakeMetrics = { scale: bakeScale, imageLeft: bakePadding / bakeScale, imageTop: bakePadding / bakeScale };
	}

	//==============================================================================
	// 그릴 크기로 줄인 그림. (그림 색이 있으면 그 색 한 빛의 모양, 그림자 없이)
	//==============================================================================
	/**
	 * @param { HTMLImageElement | HTMLCanvasElement } image
	 * @param { object } sourceRect
	 * @param { number } scaledImageWidth
	 * @param { number } scaledImageHeight
	 * @returns { HTMLCanvasElement | null }
	 */
	readScaledImage(image, sourceRect, scaledImageWidth, scaledImageHeight) {
		const scaledCanvas = System.document.createElement("canvas");
		scaledCanvas.width = scaledImageWidth;
		scaledCanvas.height = scaledImageHeight;
		const canvasRenderingContext = scaledCanvas.getContext("2d");
		if (canvasRenderingContext === null) {
			return null;
		}
		canvasRenderingContext.imageSmoothingEnabled = true;
		canvasRenderingContext.imageSmoothingQuality = "high";
		canvasRenderingContext.drawImage(image, sourceRect.left, sourceRect.top, sourceRect.width, sourceRect.height, 0, 0, scaledImageWidth, scaledImageHeight);
		const imageColor = this.getImageColor();
		if (imageColor !== null) {
			canvasRenderingContext.globalCompositeOperation = "source-in";
			canvasRenderingContext.fillStyle = imageColor;
			canvasRenderingContext.fillRect(0, 0, scaledImageWidth, scaledImageHeight);
		}
		return scaledCanvas;
	}

	//==============================================================================
	// 그림 설정. (조각을 주지 않으면 그림 전체)
	//==============================================================================
	/**
	 * @param { HTMLImageElement | HTMLCanvasElement | null } image
	 * @param { Rect | null } imageRect
	 */
	setImage(image, imageRect = null) {
		this.#image = image;
		this.#imageRect = imageRect === null ? null : imageRect.clone();
		this.#imageVersion += 1;
		if (image !== null && image !== undefined) {
			imageIdentifiers.set(image, nextImageIdentifier);
			nextImageIdentifier += 1;
		}
	}

	//==============================================================================
	// 그림 반환.
	//==============================================================================
	/**
	 * @returns { HTMLImageElement | HTMLCanvasElement | null }
	 */
	getImage() {
		return this.#image;
	}

	//==============================================================================
	// 그림 안의 조각 반환. (null 이면 그림 전체)
	//==============================================================================
	/**
	 * @returns { Rect | null }
	 */
	getImageRect() {
		return this.#imageRect;
	}

	//==============================================================================
	// 그림을 한 빛으로 칠할 색 설정. (null 이면 그림 그대로)
	//==============================================================================
	/**
	 * @param { string | null } imageColor
	 */
	setImageColor(imageColor) {
		this.#imageColor = imageColor;
	}

	//==============================================================================
	// 그림을 한 빛으로 칠할 색 반환.
	//==============================================================================
	/**
	 * @returns { string | null }
	 */
	getImageColor() {
		return this.#imageColor;
	}

	//==============================================================================
	// 그림자 설정. (색, 불투명도, 그림 아래로 내려가는 만큼, 번지는 만큼)
	//==============================================================================
	/**
	 * @param { string } shadowColor - "#rrggbb"
	 * @param { number } shadowOpacity
	 * @param { number } shadowOffset
	 * @param { number } shadowBlur - 0 이면 번지지 않는다.
	 */
	setShadow(shadowColor, shadowOpacity, shadowOffset, shadowBlur = 0) {
		this.#shadowColor = shadowColor;
		this.#shadowOpacity = shadowOpacity;
		this.#shadowOffset = shadowOffset;
		this.#shadowBlur = shadowBlur;
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
