//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Rect } from "../base/rect.js";


//==============================================================================
// 이미지 스크롤러.
//==============================================================================
export class ImageScroller extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { HTMLImageElement } */ #image;
	/** @private @type { Rect } */ #viewRect;
	/** @private @type { Vector2 } */ #scrollPosition;
	/** @private @type { Vector2 } */ #scrollSpeed;

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
		this.#scrollSpeed = Vector2.zero();
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta 
	 */
	tick(timeDelta) {
		this.#scrollPosition.x += this.#scrollSpeed.x * timeDelta;
		this.#scrollPosition.y += this.#scrollSpeed.y * timeDelta;
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

		// 부동소수점 오차로 인한 틈새 방지를 위해 좌표 정수화.
		const modX = Math.floor(this.#scrollPosition.x % imgW);
		const modY = Math.floor(this.#scrollPosition.y % imgH);

		const startX = this.#viewRect.position.x + (modX <= 0 ? modX : modX - imgW);
		const startY = this.#viewRect.position.y + (modY <= 0 ? modY : modY - imgH);

		renderer.beginClip(this.#viewRect);
		
		// 이미지 크기를 1.5픽셀정도 키워서 겹쳐 그려서 이미지 사이의 틈을 가리기.
		const overlap = 1.5;
		for (let x = startX; x < this.#viewRect.position.x + this.#viewRect.size.x; x += imgW) {
			for (let y = startY; y < this.#viewRect.position.y + this.#viewRect.size.y; y += imgH) {
				renderer.drawImage(
					this.#image, 
					Vector2.create(Math.floor(x), Math.floor(y)), 
					Vector2.create(imgW + overlap, imgH + overlap)
				);
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

	//==============================================================================
	// 화면 가시 영역 설정.
	//==============================================================================
	/**
	 * @param { Rect } rect 
	 */
	setViewRect(rect) {
		this.#viewRect = rect;
	}

	//==============================================================================
	// 화면 가시 영역 반환.
	//==============================================================================
	/**
	 * @returns { Rect }
	 */
	getViewRect() {
		return this.#viewRect;
	}

	//==============================================================================
	// 수직 스크롤 설정.
	//==============================================================================
	/**
	 * @param { number } speed 
	 */
	setVerticalScrollSpeed(speed) {
		this.#scrollSpeed.y = speed;
	}

	//==============================================================================
	// 수평 스크롤 설정.
	//==============================================================================
	/**
	 * @param { number } speed 
	 */
	setHorizontalScrollSpeed(value) {
		this.#scrollSpeed.x = value;
	}

	//==============================================================================
	// 스크롤 속도 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 
	 */
	getScrollSpeed(speed) {
		return this.#scrollSpeed;
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
}