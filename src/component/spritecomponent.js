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

		// 블렌드 모드 설정.
		canvasRenderingContext.globalCompositeOperation = spriteBlendMode;

		// 컬러 틴트 적용. (alpha > 0이면 tintCanvas로 블렌드, 아니면 이미지 직접 블렌드)
		if (color.alpha > 0) {
			const tintWidth = Math.ceil(contentSize.x);
			const tintHeight = Math.ceil(contentSize.y);
			if (tintWidth > 0 && tintHeight > 0) {
				if (!this.#tintCanvas || this.#tintCanvas.width !== tintWidth || this.#tintCanvas.height !== tintHeight) {
					this.#tintCanvas = new OffscreenCanvas(tintWidth, tintHeight);
					this.#tintContext = this.#tintCanvas.getContext('2d');
				}
				this.#tintContext.clearRect(0, 0, tintWidth, tintHeight);
				this.#tintContext.drawImage(image, 0, 0, tintWidth, tintHeight);
				this.#tintContext.globalCompositeOperation = 'source-atop';
				this.#tintContext.fillStyle = color.toRGBAString();
				this.#tintContext.fillRect(0, 0, tintWidth, tintHeight);
				this.#tintContext.globalCompositeOperation = 'source-over';
				canvasRenderingContext.drawImage(this.#tintCanvas, position.x, position.y, imageSize.x, imageSize.y);
			}
		}
		else {
			// 이미지 출력.
			const spriteDrawMode = this.getSpriteDrawMode();
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

						graphic.drawImageWithImageRect(image, position, imageSize, imageRect);
						break;
					}
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