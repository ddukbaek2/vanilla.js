//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Vector2 } from "../base/vector2.js";
import { Rect } from "../base/rect.js";
import * as Math from "../base/math.js";
import { ImageAsset } from "../resource/imageasset.js";
import { Graphic } from "../core/graphic.js";
import { ColorComponent } from "./colorcomponent.js";
import { Color } from "../base/color.js";


//==============================================================================
// 스프라이트 모드.
//==============================================================================
export const SpriteDrawMode = {
	simple: "simple",
	sliced: "sliced",
	tiled: "tiled",
}


//==============================================================================
// 스프라이트 블렌드 모드. (Canvas2D globalCompositeOperation 대응)
//==============================================================================
export const SpriteBlendMode = {
	normal:          "source-over",      // 기본 알파 합성.
	sourceIn:        "source-in",        // 교차 영역만 출력 (배경 알파 마스크).
	sourceOut:       "source-out",       // 교차 외 영역만 출력.
	sourceAtop:      "source-atop",      // 배경 위에 교차 영역만 합성.
	destinationOver: "destination-over", // 배경 아래에 합성.
	destinationIn:   "destination-in",   // 배경에서 교차 영역만 유지.
	destinationOut:  "destination-out",  // 배경에서 교차 외 영역만 유지.
	destinationAtop: "destination-atop", // 배경 위에 교차 영역만 유지.
	lighter:         "lighter",          // 색상 덧셈 (Add).
	copy:            "copy",             // 소스만 출력 (배경 무시).
	xor:             "xor",              // 교차 영역 제외.
	multiply:        "multiply",         // 곱셈 합성 (어두워짐).
	screen:          "screen",           // 스크린 합성 (밝아짐).
	overlay:         "overlay",          // 오버레이 (명암 강조).
	darken:          "darken",           // 어두운 픽셀 선택.
	lighten:         "lighten",          // 밝은 픽셀 선택.
	colorDodge:      "color-dodge",      // 컬러 닷지 (밝아짐).
	colorBurn:       "color-burn",       // 컬러 번 (어두워짐).
	hardLight:       "hard-light",       // 하드 라이트.
	softLight:       "soft-light",       // 소프트 라이트.
	difference:      "difference",       // 차이값 합성.
	exclusion:       "exclusion",        // 차이값 합성 (낮은 대비).
	hue:             "hue",              // 색조만 적용.
	saturation:      "saturation",       // 채도만 적용.
	color:           "color",            // 색조+채도 적용.
	luminosity:      "luminosity",       // 밝기만 적용.
}


//==============================================================================
// 스프라이트 출력자 컴포넌트.
//==============================================================================
export class SpriteComponent extends ColorComponent {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { HTMLImageElement } */ #image;
	/** @private @type { Rect } */ #imageRect;
	/** @private @type { boolean } */ #isHorizontalFlip;
	/** @private @type { boolean } */ #isVerticalFlip;
	/** @private @type { string } */ #spriteDrawMode;
	/** @private @type { string } */ #spriteBlendMode;
	/** @private @type { Rect } */ #nineSlice;
	/** @private @type { OffscreenCanvas | null } */ #tintCanvas;
	/** @private @type { OffscreenCanvasRenderingContext2D | null } */ #tintContext;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @construct
	 */
	constructor() {
		super();
		this.#image = null;
		this.#imageRect = Rect.zero();
		this.#isHorizontalFlip = false;
		this.#isVerticalFlip = false;
		this.#spriteDrawMode = SpriteDrawMode.simple;
		this.#spriteBlendMode = SpriteBlendMode.normal;
		this.#nineSlice = Rect.zero();
		this.#tintCanvas = null;
		this.#tintContext = null;
		super.setColor(Color.transparent());
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta 
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 */
	draw(graphic) {
		const canvasRenderingContext = graphic.getCanvasRenderingContext();
		const image = this.getImage();
		const color = super.getColor();

		// 일반 사각형 출력.
		if (image === null || image === undefined) {
			super.draw(graphic);
			return;
		}

		const node = this.getNode();
		if (!node) return;

		const position = Vector2.zero();
		const contentSize = node.getContentSize();
		const flip = this.getFlip();
		const imageSize = contentSize.multiply(flip);
		const spriteBlendMode = this.getSpriteBlendMode();
		const spriteDrawMode = this.getSpriteDrawMode();

		// 슬라이스드 모드에서 컨텐츠 크기가 나인슬라이스 경계 합보다 작으면 출력 안 함.
		if (spriteDrawMode === SpriteDrawMode.sliced) {
			const nineSlice = this.getNineSlice();
			const left = nineSlice.position.x;
			const top = nineSlice.position.y;
			const right = nineSlice.size.x;
			const bottom = nineSlice.size.y;
			if (contentSize.x < left + right || contentSize.y < top + bottom) {
				return;
			}
		}

		// 블렌드 모드 설정.
		canvasRenderingContext.globalCompositeOperation = spriteBlendMode;

		// 드로우 모드에 따라 이미지 출력.
		switch (spriteDrawMode) {
			case SpriteDrawMode.simple: {
					// 이미지 소스 조정.
					let imageRect = this.getImageRect();
					if (imageRect === null || imageRect === undefined || imageRect.equals(Rect.zero())) {
						imageRect = Rect.create(0, 0, image.width, image.height);
					}

					graphic.drawImageWithImageRect(image, position, imageSize, imageRect);
					break;
				}
			case SpriteDrawMode.sliced: {
					const nineSlice = this.getNineSlice();
					graphic.drawImageWithNineSlice(image, position, imageSize, nineSlice);
					break;
				}
			case SpriteDrawMode.tiled: {
					// 이미지 소스 조정.
					let imageRect = this.getImageRect();
					if (imageRect === null || imageRect === undefined || imageRect.equals(Rect.zero())) {
						imageRect = Rect.create(0, 0, image.width, image.height);
					}

					const tileWidth = Math.ceil(imageRect.width);
					const tileHeight = Math.ceil(imageRect.height);
					const fillWidth = Math.abs(imageSize.x);
					const fillHeight = Math.abs(imageSize.y);

					// 클리핑 후 수동 타일 반복.
					canvasRenderingContext.save();
					canvasRenderingContext.translate(position.x, position.y);
					canvasRenderingContext.beginPath();
					canvasRenderingContext.rect(0, 0, fillWidth, fillHeight);
					canvasRenderingContext.clip();
					for (let ty = 0; ty < fillHeight; ty += tileHeight) {
						for (let tx = 0; tx < fillWidth; tx += tileWidth) {
							canvasRenderingContext.drawImage(
								image,
								imageRect.position.x, imageRect.position.y,
								imageRect.width, imageRect.height,
								tx, ty, tileWidth, tileHeight
							);
						}
					}
					canvasRenderingContext.restore();
					break;
				}
		}

		// 컬러 틴트 적용. (항상, draw mode 위에 덮어씌움. 투명 영역 제외)
		if (color.alpha > 0) {
			const tintWidth = Math.ceil(contentSize.x);
			const tintHeight = Math.ceil(contentSize.y);
			if (tintWidth > 0 && tintHeight > 0) {
				if (!this.#tintCanvas || this.#tintCanvas.width !== tintWidth || this.#tintCanvas.height !== tintHeight) {
					this.#tintCanvas = new OffscreenCanvas(tintWidth, tintHeight);
					this.#tintContext = this.#tintCanvas.getContext('2d');
				}
				this.#tintContext.clearRect(0, 0, tintWidth, tintHeight);

				// draw mode에 맞춰 tintCanvas에 이미지 그리기 (알파 마스크 원본).
				switch (spriteDrawMode) {
					case SpriteDrawMode.simple: {
							let imageRect = this.getImageRect();
							if (imageRect === null || imageRect === undefined || imageRect.equals(Rect.zero())) {
								imageRect = Rect.create(0, 0, image.width, image.height);
							}
							this.#tintContext.drawImage(
								image,
								imageRect.position.x, imageRect.position.y,
								imageRect.width, imageRect.height,
								0, 0, tintWidth, tintHeight
							);
							break;
						}
					case SpriteDrawMode.sliced: {
							const nineSlice = this.getNineSlice();
							const sw = image.width;
							const sh = image.height;
							const left = nineSlice.position.x;
							const top = nineSlice.position.y;
							const right = nineSlice.size.x;
							const bottom = nineSlice.size.y;
							const dw = Math.max(tintWidth, left + right);
							const dh = Math.max(tintHeight, top + bottom);
							const hasHorizontal = left > 0 || right > 0;
							const hasVertical = top > 0 || bottom > 0;
							if (hasHorizontal && hasVertical) {
								const centerSrcW = sw - left - right;
								const centerSrcH = sh - top - bottom;
								const centerDstW = dw - left - right;
								const centerDstH = dh - top - bottom;
								this.#tintContext.drawImage(image, 0, 0, left, top, 0, 0, left + 1, top + 1);
								this.#tintContext.drawImage(image, left, 0, centerSrcW, top, left, 0, centerDstW + 1, top + 1);
								this.#tintContext.drawImage(image, sw - right, 0, right, top, dw - right, 0, right, top + 1);
								this.#tintContext.drawImage(image, 0, top, left, centerSrcH, 0, top, left + 1, centerDstH + 1);
								this.#tintContext.drawImage(image, left, top, centerSrcW, centerSrcH, left, top, centerDstW + 1, centerDstH + 1);
								this.#tintContext.drawImage(image, sw - right, top, right, centerSrcH, dw - right, top, right, centerDstH + 1);
								this.#tintContext.drawImage(image, 0, sh - bottom, left, bottom, 0, dh - bottom, left + 1, bottom);
								this.#tintContext.drawImage(image, left, sh - bottom, centerSrcW, bottom, left, dh - bottom, centerDstW + 1, bottom);
								this.#tintContext.drawImage(image, sw - right, sh - bottom, right, bottom, dw - right, dh - bottom, right, bottom);
							}
							else if (hasHorizontal) {
								const centerSrcW = sw - left - right;
								const centerDstW = dw - left - right;
								this.#tintContext.drawImage(image, 0, 0, left, sh, 0, 0, left + 1, dh);
								this.#tintContext.drawImage(image, left, 0, centerSrcW, sh, left, 0, centerDstW + 1, dh);
								this.#tintContext.drawImage(image, sw - right, 0, right, sh, dw - right, 0, right, dh);
							}
							else if (hasVertical) {
								const centerSrcH = sh - top - bottom;
								const centerDstH = dh - top - bottom;
								this.#tintContext.drawImage(image, 0, 0, sw, top, 0, 0, dw, top + 1);
								this.#tintContext.drawImage(image, 0, top, sw, centerSrcH, 0, top, dw, centerDstH + 1);
								this.#tintContext.drawImage(image, 0, sh - bottom, sw, bottom, 0, dh - bottom, dw, bottom);
							}
							else {
								this.#tintContext.drawImage(image, 0, 0, sw, sh, 0, 0, dw, dh);
							}
							break;
						}
					case SpriteDrawMode.tiled: {
							let imageRect = this.getImageRect();
							if (imageRect === null || imageRect === undefined || imageRect.equals(Rect.zero())) {
								imageRect = Rect.create(0, 0, image.width, image.height);
							}
							const tileWidth = Math.ceil(imageRect.width);
							const tileHeight = Math.ceil(imageRect.height);
							for (let ty = 0; ty < tintHeight; ty += tileHeight) {
								for (let tx = 0; tx < tintWidth; tx += tileWidth) {
									this.#tintContext.drawImage(
										image,
										imageRect.position.x, imageRect.position.y,
										imageRect.width, imageRect.height,
										tx, ty, tileWidth, tileHeight
									);
								}
							}
							break;
						}
				}

				// source-atop으로 투명 영역 제외하여 틴트 적용.
				this.#tintContext.globalCompositeOperation = 'source-atop';
				this.#tintContext.fillStyle = color.toRGBAString();
				this.#tintContext.fillRect(0, 0, tintWidth, tintHeight);
				this.#tintContext.globalCompositeOperation = 'source-over';

				// 틴트 오버레이를 source-over로 main canvas에 합성.
				canvasRenderingContext.globalCompositeOperation = 'source-over';
				canvasRenderingContext.drawImage(this.#tintCanvas, position.x, position.y, imageSize.x, imageSize.y);
			}
		}

		// 블렌드 모드 복원.
		canvasRenderingContext.globalCompositeOperation = 'source-over';
	}

	//==============================================================================
	// 스프라이트 출력 모드 설정.
	//==============================================================================
	/**
	 * @param { string } spriteDrawMode
	 */
	setSpriteDrawMode(spriteDrawMode) {
		this.#spriteDrawMode = spriteDrawMode;
	}

	//==============================================================================
	// 스프라이트 출력 모드 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getSpriteDrawMode() {
		return this.#spriteDrawMode;
	}

	//==============================================================================
	// 스프라이트 블렌드 모드 설정.
	//==============================================================================
	/**
	 * @param { string } spriteBlendMode
	 */
	setSpriteBlendMode(spriteBlendMode) {
		this.#spriteBlendMode = spriteBlendMode;
	}

	//==============================================================================
	// 스프라이트 블렌드 모드 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getSpriteBlendMode() {
		return this.#spriteBlendMode;
	}

	//==============================================================================
	// 나인슬라이스 영역 설정.
	//==============================================================================
	/**
	 * @param { Rect } nineSlice
	 */
	setNineSlice(nineSlice) {
		this.#nineSlice = nineSlice;
	}

	//==============================================================================
	// 나인슬라이스 영역 반환.
	//==============================================================================
	/**
	 * @returns { Rect }
	 */
	getNineSlice() {
		return this.#nineSlice;
	}

	//==============================================================================
	// 이미지 설정.
	//==============================================================================
	/**
	 * @param { HTMLImageElement | ImageAsset } image 
	 */
	setImage(image) {
		if (image === null || image === undefined) {
			this.#image = null;
		}
		else if (image instanceof HTMLImageElement) {
			this.#image = image;
		}
		else if (image instanceof ImageAsset) {
			this.#image = image.image;
		}
	}

	//==============================================================================
	// 이미지 반환.
	//==============================================================================
	/**
	 * @returns { HTMLImageElement }
	 */
	getImage() {
		return this.#image;
	}

	//==============================================================================
	// 이미지 영역 설정.
	//==============================================================================
	/**
	 * @param { Rect } imageRect
	 */
	setImageRect(imageRect) {
		this.#imageRect = imageRect;
	}

	//==============================================================================
	// 이미지 영역 반환.
	//==============================================================================
	/**
	 * @returns { Rect }
	 */
	getImageRect() {
		return this.#imageRect;
	}

	//==============================================================================
	// 이미지 뒤집기 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } flip
	 */
	setHorizontalFlip(flip) {
		this.#isHorizontalFlip = flip;
	}

	//==============================================================================
	// 이미지 뒤집기 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } flip
	 */
	setVerticalFlip(flip) {
		this.#isVerticalFlip = flip;
	}

	//==============================================================================
	// 이미지 뒤집기 여부 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	isHorizontalFlip() {
		return this.#isHorizontalFlip;
	}
	
	//==============================================================================
	// 이미지 뒤집기 여부 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	isVerticalFlip() {
		return this.#isVerticalFlip;
	}

	//==============================================================================
	// 이미지 뒤집히는 값 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getFlip() {
		const isHorizontalFlip = this.isHorizontalFlip();
		const isVerticalFlip = this.isVerticalFlip();

		if (isHorizontalFlip) {
			if (isVerticalFlip) {
				return Vector2.create(-1, -1);
			}
			else {
				return Vector2.create(-1, 1);
			}
		}
		else {
			if (isVerticalFlip) {
				return Vector2.create(1, -1);
			}
			else {
				return Vector2.create(1, 1);
			}
		}
	}
}