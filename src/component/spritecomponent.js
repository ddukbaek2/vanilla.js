//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Vector2 } from "../base/vector2.js";
import { Rect } from "../base/rect.js";
import * as Math from "../base/math.js";
import { ImageAsset } from "../resource/imageasset.js";
import { Renderer } from "../core/renderer.js";
import { ColorComponent } from "./colorcomponent.js";


//==============================================================================
// 스프라이트 모드.
//==============================================================================
export const SpriteMode = {
	simple,
	sliced,
	tiled,
}


//==============================================================================
// 스프라이트 블렌드 모드.
//==============================================================================
export const SpriteBlendMode = {
	normal,
	additive,
	multiply,
	screen,
	overlay,
}


//==============================================================================
// 스프라이트 출력자 컴포넌트.
//==============================================================================
export class SpriteComponent extends ColorComponent {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { HTMLImageElement } */ #image;
	/** @private @type { Rect } */ #slices;
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
		this.#slices = Rect.zero();
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
	 * @param { Renderer } renderer
	 */
	draw(renderer) {
		// super.draw(renderer);

		const canvasContext = renderer.getCanvasContext();
		const image = this.getImage();
		const color = super.getColor();
		if (image === null) {
			canvasContext.fillStyle = color.toHEXString();
			super.draw(renderer);
			return;
		}

		const pivotPosition = super.getPivotPosition();
		const contentSize = super.getContentSize();
		const isHorizontalFlip = this.isHorizontalFlip();
		const isVerticalFlip = this.isVerticalFlip();

		// 이미지 소스 조정.
		let slices = this.getSlices();
		if (slices === null || slices.equals(Rect.zero())) {
			slices = Rect.create(0, 0, image.width, image.height);
		}

		// 출력.
		// 피봇 위치 반영 - 기본 (0, 0) 에서 피봇만큼 좌상 방향으로 당겨준다. 
		// 이미지 플립 반영 - 이미지를 뒤집어서 출력한다.
		canvasContext.fillStyle = color.toHEXString();
		canvasContext.drawImage(image,
			slices.position.x, slices.position.y, slices.size.x, slices.size.y,
			pivotPosition.x, pivotPosition.y, 
			isHorizontalFlip ? -contentSize.x : contentSize.x, isVerticalFlip ? -contentSize.y : contentSize.y
		);
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
	// 이미지 부분 설정.
	//==============================================================================
	/**
	 * @param { Rect } slices
	 */
	setSlices(slices) {
		this.#slices = slices;
	}

	//==============================================================================
	// 이미지 부분 반환.
	//==============================================================================
	/**
	 * @returns { Rect }
	 */
	getSlices() {
		return this.#slices;
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
}