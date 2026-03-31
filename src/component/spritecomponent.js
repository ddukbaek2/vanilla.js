//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Vector2 } from "../base/vector2.js";
import { Rect } from "../base/rect.js";
import * as Math from "../base/math.js";
import { ImageAsset } from "../resource/imageasset.js";
import { Graphic } from "../core/graphic.js";
import { ColorComponent } from "./colorcomponent.js";


//==============================================================================
// 스프라이트 모드.
//==============================================================================
export const SpriteMode = {
	simple: "simple",
	sliced: "sliced",
	tiled: "tiled",
}


//==============================================================================
// 스프라이트 블렌드 모드.
//==============================================================================
export const SpriteBlendMode = {
	normal: "normal",
	darken: "darken",
	multiply: "multiply",
	colorBurn: "colorBurn",
	lighten: "lighten",
	screen: "screen",
	colorDodge: "colorDodge",
	overlay: "overlay",
	softLight: "softLight",
	hardLight: "hardLight",
	difference: "difference",
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
		// super.draw(graphic);

		const canvasRenderingContext = graphic.getCanvasRenderingContext();
		const image = this.getImage();
		const color = super.getColor();
		const colorString = color.toHEXString();
		if (image === null) {
			// 출력.
			canvasRenderingContext.fillStyle = colorString;
			super.draw(graphic);
			return;
		}

		const node = this.getNode();
		if (!node) return;

		const position = Vector2.zero();
		const contentSize = node.getContentSize();
		const flip = this.getFlip();
		const imageSize = contentSize.multiply(flip);

		// 이미지 소스 조정.
		let imageRect = this.getImageRect();
		if (imageRect === null || imageRect.equals(Rect.zero())) {
			imageRect = Rect.create(0, 0, image.width, image.height);
		}

		// 출력.
		canvasRenderingContext.fillStyle = colorString;
		graphic.drawImage2(image, position, imageSize, imageRect);
	}

	//==============================================================================
	// 이미지 설정.
	//==============================================================================
	/**
	 * @param { HTMLImageElement | ImageAsset } image 
	 */
	setImage(image) {
		if (image === null) {
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