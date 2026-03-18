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
	// 출력 상태 시작.
	//==============================================================================
	/**
	 * @override
	 * @param { VRenderer } renderer 
	 */
	preDraw(renderer) {
		// super.preDraw(renderer);
		const position = super.getPosition();
		const rotation = super.getRotation();
		const scale = super.getScale();
		const opacity = super.getOpacity();
		const color = super.getColor();
		const canvasContext = renderer.getCanvasContext();
		canvasContext.translate(position.x, position.y);
		canvasContext.rotate(rotation);
		
		const flip = VVector2.create(this.isHorizontalFlip() ? -1 : 1, this.isVerticalFlip() ? -1 : 1);
		const finalScale = scale.multiply(flip);
		canvasContext.scale(finalScale.x, finalScale.y);
		canvasContext.globalAlpha = opacity;
		canvasContext.fillStyle = color;
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @override
	 * @param { VRenderer } renderer 
	 */
	draw(renderer) {
		// super.draw(renderer);
		const size = super.getSize();
		const pivot = super.getPivot();
		// 기본은 좌상이므로 0,0이라치고...
		// 거기서 0~1, 0~1을 뺀다...
		const offset = VVector2.zero().subtract(size.multiply(pivot));
		console.log(`pivot=(${pivot.x}, ${pivot.y}) offset=(${offset.x}, ${offset.y})`);
		renderer.drawImage(this.#image, offset, size);
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
	setSlice(slices) {
		this.#slices = slices;
	}

	//==============================================================================
	// 이미지 부분 반환.
	//==============================================================================
	/**
	 * @returns { VRect }
	 */
	getSlice(slices) {
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