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
/**
 * @example <caption>배경 이미지를 바둑판으로 이어 흘리기</caption>
 * import { Engine, EngineConfiguration, Scene, ImageScroller, ImageAsset, Rect } from "./build/vanilla.js";
 *
 * const imageAsset = new ImageAsset();
 * await imageAsset.load("examples/assets/spritesheet.png");
 * const image = imageAsset.getImage();
 * const imageScroller = new ImageScroller();
 * imageScroller.setImage(image);
 * imageScroller.setViewRect(Rect.create(0, 0, 640, 360));
 * imageScroller.setHorizontalScrollSpeed(-60);
 * imageScroller.setVerticalScrollSpeed(20);
 *
 * class MainScene extends Scene {
 * 	tick(timeDelta) {
 * 		super.tick(timeDelta);
 * 		imageScroller.tick(timeDelta);
 * 	}
 *
 * 	draw(graphic) {
 * 		super.draw(graphic);
 * 		imageScroller.draw(graphic);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
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
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 */
	tick(timeDelta) {
		const scrollPosition = this.getScrollPosition();
		const scrollSpeed = this.getScrollSpeed();
		scrollPosition.x += scrollSpeed.x * timeDelta;
		scrollPosition.y += scrollSpeed.y * timeDelta;
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Graphic } graphic 그릴 그래픽.
	 */
	draw(graphic) {
		const image = this.getImage();
		if (!image) {
			return;
		}

		const imgW = image.width;
		const imgH = image.height;

		if (imgW === 0 || imgH === 0) {
			return;
		}

		// 부동소수점 오차로 인한 틈새 방지를 위해 좌표 정수화.
		const scrollPosition = this.getScrollPosition();
		const modX = Math.floor(scrollPosition.x % imgW);
		const modY = Math.floor(scrollPosition.y % imgH);

		const viewRect = this.getViewRect();
		const startX = viewRect.position.x + (modX <= 0 ? modX : modX - imgW);
		const startY = viewRect.position.y + (modY <= 0 ? modY : modY - imgH);

		graphic.beginClipRect(viewRect);

		// 이미지 크기를 1.5픽셀정도 키워서 겹쳐 그려서 이미지 사이의 틈을 가리기.
		const overlap = 1.5;
		for (let x = startX; x < viewRect.position.x + viewRect.size.x; x += imgW) {
			for (let y = startY; y < viewRect.position.y + viewRect.size.y; y += imgH) {
				graphic.drawImage(
					image,
					Vector2.create(Math.floor(x), Math.floor(y)),
					Vector2.create(imgW + overlap, imgH + overlap)
				);
			}
		}

		graphic.endClipRect();
	}

	//==============================================================================
	// 이미지 설정.
	//==============================================================================
	/**
	 * @param { HTMLImageElement | ImageAsset } image 바둑판으로 이어 그릴 이미지. (null 이면 그리지 않는다)
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
	 * @returns { HTMLImageElement } 이어 그릴 이미지. (없으면 null)
	 */
	getImage() {
		return this.#image;
	}

	//==============================================================================
	// 화면 가시 영역 설정.
	//==============================================================================
	/**
	 * @param { Rect } rect 이미지를 채워 그릴 화면 영역. (이 밖은 잘라낸다)
	 */
	setViewRect(rect) {
		this.#viewRect = rect;
	}

	//==============================================================================
	// 화면 가시 영역 반환.
	//==============================================================================
	/**
	 * @returns { Rect } 이미지를 채워 그릴 화면 영역.
	 */
	getViewRect() {
		return this.#viewRect;
	}

	//==============================================================================
	// 수직 스크롤 설정.
	//==============================================================================
	/**
	 * @param { number } speed 세로 스크롤 속도. (픽셀 / 초)
	 */
	setVerticalScrollSpeed(speed) {
		this.#scrollSpeed.y = speed;
	}

	//==============================================================================
	// 수평 스크롤 설정.
	//==============================================================================
	/**
	 * @param { number } speed 가로 스크롤 속도. (픽셀 / 초)
	 */
	setHorizontalScrollSpeed(value) {
		this.#scrollSpeed.x = value;
	}

	//==============================================================================
	// 스크롤 속도 반환.
	//==============================================================================
	/**
	 * @param { any } speed 쓰지 않는다.
	 * @returns { Vector2 } 스크롤 속도. (픽셀 / 초, 안에 쥔 벡터 그대로)
	 */
	getScrollSpeed(speed) {
		return this.#scrollSpeed;
	}

	//==============================================================================
	// 스크롤 위치 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } position 스크롤 위치. (픽셀, 받은 벡터를 그대로 쥐고 tick 이 고친다)
	 */
	setScrollPosition(position) {
		this.#scrollPosition = position;
	}

	//==============================================================================
	// 스크롤 위치 반환.
	//==============================================================================
	/**
	 * @returns { HTMLImageElement } 스크롤 위치. (픽셀, 안에 쥔 벡터 그대로)
	 */
	getScrollPosition() {
		return this.#scrollPosition;
	}
}