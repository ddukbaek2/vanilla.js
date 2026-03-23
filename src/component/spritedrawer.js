//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VVector2 } from "../base/vector2.js";
import { VRect } from "../base/rect.js";
import * as VMath from "../base/math.js";
import { VImageAsset } from "../resource/imageasset.js";
import { VRenderer } from "../core/renderer.js";
import { VColorDrawerComponent } from "./colordrawer.js";


//==============================================================================
// 스프라이트 출력자 컴포넌트.
//==============================================================================
export class VSpriteDrawerComponent extends VColorDrawerComponent {
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
	/**
	 * @construct
	 */
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
	 * @param { number } timeDelta 
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { VRenderer } renderer
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
		if (slices === null || slices.equals(VRect.zero())) {
			slices = VRect.create(0, 0, image.width, image.height);
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
	 * @param { HTMLImageElement | VImageAsset } image 
	 */
	setImage(image) {
		if (image === null) {
			this.#image = null;
		}
		else if (image instanceof HTMLImageElement) {
			this.#image = image;
		}
		else if (image instanceof VImageAsset) {
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