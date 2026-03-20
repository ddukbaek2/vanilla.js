//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VVector2 } from "../base/vector2.js";
import * as VMath from "../base/math.js";
import { VRenderer } from "../core/renderer.js"
import { VNode } from "../core/node.js";
import { VRect } from "../base/rect.js";


//==============================================================================
// 스프라이트.
//==============================================================================
export class VSprite extends VNode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { HTMLImageElement } */ #image;
	/** @private @type { VRect } */ #slices;
	/** @private @type { boolean } */ #isHorizontalFlip;
	/** @private @type { boolean } */ #isVerticalFlip;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.#image = null;
		this.#slices = VRect.zero();
		this.#isHorizontalFlip = false;
		this.#isVerticalFlip = false;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta 
	 */
	update(timeDelta) {
		super.update(timeDelta);
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @override
	 * @param { VRenderer } renderer 
	 */
	draw(renderer) {
		const canvasContext = renderer.getCanvasContext();
		const image = this.getImage();
		if (image === null) {
			super.draw(renderer);
			return;
		}

		// 소스 조정.
		let slices = this.getSlices();
		if (slices === null || slices.equals(VRect.zero())) {
			slices = VRect.create(0, 0, image.width, image.height);
		}

		const size = super.getContentSize();
		const pivotPosition = this.calculatePivotPosition();

		// 출력.
		canvasContext.drawImage(image, slices.position.x, slices.position.y, slices.size.x, slices.size.y, pivotPosition.x, pivotPosition.y, size.x, size.y);
	}

	//==============================================================================
	// 플립 기능으로 인해 뒤집어진 크기 계산.
	//==============================================================================
	/**
	 * @override
	 * @returns { VVector2 }
	 */
	calculateTransformScale() {
		const scale = super.calculateTransformScale();
		const isHorizontalFlip = this.isHorizontalFlip();
		const isVerticalFlip = this.isVerticalFlip();
		let flippedScale = VVector2.create(isHorizontalFlip ? -scale.x : scale.x, isVerticalFlip ? -scale.y : scale.y);
		return flippedScale;
	}

	//==============================================================================
	// 피봇 기능으로 인해 스케일 반전되며 틀어진 출력 중심점 위치를 포함하여 중심점 위치 계산.
	//==============================================================================
	/**
	 * @override
	 * @returns { VVector2 }
	 */
	calculatePivotPosition() {
		const pivotPosition = super.calculatePivotPosition();
		const isHorizontalFlip = this.isHorizontalFlip();
		const isVerticalFlip = this.isVerticalFlip();
		const size = super.getContentSize();
		if (isHorizontalFlip) {
			pivotPosition.x = -size.x - pivotPosition.x;
		}
		if (isVerticalFlip) {
			pivotPosition.y = -size.y - pivotPosition.y;
		}
		return pivotPosition;
	}

	//==============================================================================
	// 이미지 설정.
	//==============================================================================
	/**
	 * @param { HTMLImageElement } image 
	 */
	setImage(image) {
		this.#image = image;	
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
	 * @param { VRect } slices
	 */
	setSlices(slices) {
		this.#slices = slices;
	}

	//==============================================================================
	// 이미지 부분 반환.
	//==============================================================================
	/**
	 * @returns { VRect }
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
	 * @returns { VVector2 }
	 */
	isHorizontalFlip() {
		return this.#isHorizontalFlip;
	}
	
	//==============================================================================
	// 이미지 뒤집기 여부 반환.
	//==============================================================================
	/**
	 * @returns { VVector2 }
	 */
	isVerticalFlip() {
		return this.#isVerticalFlip;
	}
}