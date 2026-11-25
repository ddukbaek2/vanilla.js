//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Rect } from "../base/rect.js";


//==============================================================================
// 이미지 영역.
//==============================================================================
/**
 * @example <caption>스프라이트 시트의 한 칸을 조각으로</caption>
 * import { ImageAsset, Frame, Rect } from "./build/vanilla.js";
 *
 * const imageAsset = new ImageAsset();
 * await imageAsset.load("examples/assets/spritesheet.png");
 * const image = imageAsset.getImage();
 * const frame = new Frame(image, Rect.create(200, 0, 200, 200));
 * const imageRect = frame.getImageRect();
 * console.log(imageRect.x, imageRect.y, imageRect.width, imageRect.height);
 * const wholeFrame = new Frame(image);
 * const wholeRect = wholeFrame.getImageRect();
 * console.log(wholeRect.width, wholeRect.height);
 */
export class Frame extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { HTMLImageElement } */ #image; // 이미지.
	/** @type { Rect } */ #rect; // 이미지 내부 영역.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { HTMLImageElement } image 이미지. (null 이나 undefined 면 예외를 낸다)
	 * @param { Rect | null } rect 이미지 안의 영역. (픽셀, null 이면 이미지 전체, 이미지 밖으로 넘어도 자르지 않는다)
	 */
	constructor(image, rect = null) {
		super();
		this.#image = image;
		if (image === null || image === undefined) {
			throw new System.Error("image is null.");
		}
		if (rect === null || rect === undefined) {
			this.#rect = Rect.create(0, 0, image.width, image.height);
		}
		else {
			// this.#rect = Rect.clamp(rect, Rect.zero(), Rect.create(0, 0, image.width, image.height));
			this.#rect = rect;
		}
	}

	//==============================================================================
	// 이미지 반환.
	//==============================================================================
	/**
	 * @returns { HTMLImageElement } 이미지.
	 */
	getImage() {
		return this.#image;
	}

	//==============================================================================
	// 이미지 내부 영역 반환.
	//==============================================================================
	/**
	 * @returns { Rect } 이미지 안의 영역. (픽셀)
	 */
	getImageRect() {
		return this.#rect;
	}
}