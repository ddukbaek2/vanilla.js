//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Rect } from "../base/rect.js";


//==============================================================================
// 배경 스크롤러.
//==============================================================================
export class BackgroundScroller extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { HTMLImageElement } */ #image;
	/** @private @type { Rect } */ #viewRect;
	/** @private @type { Vector2 } */ #scrollPosition;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.#image = null;
		this.#viewRect = Rect.zero();
		this.#scrollPosition = Vector2.zero();
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Renderer } renderer 
	 */
	draw(renderer) {
		if (!this.#image) {
			return;
		}

		const imgW = this.#image.width;
		const imgH = this.#image.height;

		if (imgW === 0 || imgH === 0) {
			return;
		}

		const modX = ((this.#scrollPosition.x % imgW) + imgW) % imgW;
		const modY = ((this.#scrollPosition.y % imgH) + imgH) % imgH;

		renderer.beginClip(this.#viewRect);
		for (let x = this.#viewRect.position.x + modX - imgW; x < this.#viewRect.position.x + this.#viewRect.size.x; x += imgW) {
			for (let y = this.#viewRect.position.y + modY - imgH; y < this.#viewRect.position.y + this.#viewRect.size.y; y += imgH) {
				renderer.drawImage(this.#image, Vector2.create(x, y), Vector2.create(imgW, imgH));
			}
		}
		renderer.endClip();
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

	setViewRect(rect) {
		this.#viewRect = rect;
	}

	getViewRect() {
		return this.#viewRect;
	}

	//==============================================================================
	// 스크롤 위치 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } position 
	 */
	setScrollPosition(position) {
		this.#scrollPosition = position;
	}

	//==============================================================================
	// 스크롤 위치 반환.
	//==============================================================================
	/**
	 * @returns { HTMLImageElement }
	 */
	getScrollPosition() {
		return this.#scrollPosition;
	}

	setVerticalScroll(value) {
		this.#scrollPosition.y = value;
	}

	setHorizontalScroll(value) {
		this.#scrollPosition.x = value;
	}
}