//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Vector2 } from "../../base/vector2.js";
import { Rect } from "../../base/rect.js";
import * as Math from "../../base/math.js";
import { ImageAsset } from "../../resource/imageasset.js";
import { Graphic } from "../graphic.js";
import { Paint } from "./paint.js";
import { Color } from "../../base/color.js";


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
export class Sprite extends Paint {
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

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @construct
	 */
	constructor() {
		super();
		this.setComponentType("Sprite");
		this.#image = null;
		this.#imageRect = Rect.zero();
		this.#isHorizontalFlip = false;
		this.#isVerticalFlip = false;
		this.#spriteDrawMode = SpriteDrawMode.simple;
		this.#spriteBlendMode = SpriteBlendMode.normal;
		this.#nineSlice = Rect.zero();
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
		graphic.setBlendMode(spriteBlendMode);

		// 컬러 틴트 설정. (알파가 0 초과일 때만, 이미지 실루엣 안쪽에만 색을 덮음)
		if (color.alpha > 0) {
			graphic.setImageTintColor(color);
		}

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
					graphic.pushState();
					graphic.translate(position.x, position.y);
					graphic.beginClipRect(Rect.create(0, 0, fillWidth, fillHeight));
					for (let ty = 0; ty < fillHeight; ty += tileHeight) {
						for (let tx = 0; tx < fillWidth; tx += tileWidth) {
							graphic.drawImageWithSourceAndDestination(
								image,
								imageRect.position.x, imageRect.position.y,
								imageRect.width, imageRect.height,
								tx, ty, tileWidth, tileHeight
							);
						}
					}
					graphic.endClipRect();
					graphic.popState();
					break;
				}
		}

		// 컬러 틴트 해제.
		if (color.alpha > 0) {
			graphic.setImageTintColor(null);
		}

		// 블렌드 모드 복원.
		graphic.setBlendMode(SpriteBlendMode.normal);
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
