//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Rect } from "../base/rect.js";


//==============================================================================
// 애니메이션 프레임 데이터.
//==============================================================================
export class AnimationFrame {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { HTMLImageElement } */ #image; // 이미지.
	/** @type { Rect } */ #rect; // 이미지 내부 영역.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { HTMLImageElement } image
	 * @param { Rect | null } rect
	 */
	constructor(image, rect = null) {
		this.#image = image;
		if (rect === null) {
			this.#rect = Rect.create(0, 0, image.width, image.height);
		}
		else {
			this.#rect = Rect.clamp(rect, Rect.zero(), Rect.create(0, 0, image.width, image.height));
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
	// 이미지 내부 영역 반환.
	//==============================================================================
	/**
	 * @returns { Rect }
	 */
	getRect() {
		return this.#rect;
	}
}


//==============================================================================
// 애니메이션 시간 및 상태 계산용 클래스.
// (렌더링 로직 없이 순수하게 프레임 전환 계산만 수행)
//==============================================================================
export class Animator extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { AnimationFrame[] } */ #frames;
	/** @private @type { number } */ #currentFrameIndex;
	/** @private @type { number } */ #frameTimeCounter;
	/** @private @type { number } */ #fps;
	/** @private @type { boolean } */ #isLoop;
	/** @private @type { boolean } */ #isPlaying;
	/** @private @type { Function } */ #onComplete;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.#frames = [];
		this.#currentFrameIndex = 0;
		this.#frameTimeCounter = 0;
		this.#fps = 10;
		this.#isLoop = true;
		this.#isPlaying = false;
		this.#onComplete = null;
	}

	//==============================================================================
	// 설정.
	//==============================================================================
	/**
	 * 낱장 이미지 목록으로 애니메이션 프레임을 설정합니다.
	 * @param { HTMLImageElement[] } images 이미지 배열.
	 */
	setFramesFromImages(images) {
		this.#frames = images.map(img => new AnimationFrame(img));
		this.stop();
	}

	/**
	 * 스프라이트 시트(단일 이미지)와 영역 목록으로 애니메이션 프레임을 설정합니다.
	 * @param { HTMLImageElement } spriteSheet 시트 이미지.
	 * @param { Rect[] } rects 각 프레임의 영역 배열.
	 */
	setFramesFromRects(spriteSheet, rects) {
		this.#frames = rects.map(rect => new AnimationFrame(spriteSheet, rect));
		this.stop();
	}

	/**
	 * 초당 프레임 수를 설정합니다.
	 * @param { number } value 
	 */
	setFPS(value) {
		this.#fps = value;
	}

	/**
	 * 루프 여부를 설정합니다.
	 * @param { boolean } value 
	 */
	setLoop(value) {
		this.#isLoop = value;
	}

	/**
	 * 애니메이션 종료 콜백을 설정합니다. (루프가 아닐 때 호출됨)
	 * @param { Function } callback 
	 */
	setOnComplete(callback) {
		this.#onComplete = callback;
	}

	//==============================================================================
	// 제어.
	//==============================================================================
	/**
	 * 애니메이션을 재생합니다.
	 */
	play() {
		this.#isPlaying = true;
	}

	/**
	 * 애니메이션을 일시 정지합니다.
	 */
	pause() {
		this.#isPlaying = false;
	}

	/**
	 * 애니메이션을 정지하고 첫 프레임으로 되돌립니다.
	 */
	stop() {
		this.#isPlaying = false;
		this.#currentFrameIndex = 0;
		this.#frameTimeCounter = 0;
	}

	/**
	 * 특정 프레임으로 이동하여 재생합니다.
	 * @param { number } index 
	 */
	gotoAndPlay(index) {
		this.#currentFrameIndex = Math.max(0, Math.min(index, this.#frames.length - 1));
		this.#frameTimeCounter = 0;
		this.play();
	}

	/**
	 * 특정 프레임으로 이동하여 정지합니다.
	 * @param { number } index 
	 */
	gotoAndStop(index) {
		this.#currentFrameIndex = Math.max(0, Math.min(index, this.#frames.length - 1));
		this.#frameTimeCounter = 0;
		this.pause();
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta 
	 */
	tick(timeDelta) {
		if (!this.#isPlaying || this.#frames.length === 0 || this.#fps <= 0) {
			return;
		}

		const frameDuration = 1.0 / this.#fps;
		this.#frameTimeCounter += timeDelta;

		if (this.#frameTimeCounter >= frameDuration) {
			const framesToAdvance = Math.floor(this.#frameTimeCounter / frameDuration);
			this.#frameTimeCounter %= frameDuration;
			this.#currentFrameIndex += framesToAdvance;

			if (this.#currentFrameIndex >= this.#frames.length) {
				if (this.#isLoop) {
					this.#currentFrameIndex %= this.#frames.length;
				} else {
					this.#currentFrameIndex = this.#frames.length - 1;
					this.#isPlaying = false;
					if (this.#onComplete) {
						this.#onComplete();
					}
				}
			}
		}
	}

	//==============================================================================
	// 정보 반환 (렌더러에서 사용).
	//==============================================================================
	/**
	 * 현재 프레임의 프레임 데이터를 반환합니다.
	 * @returns { AnimationFrame }
	 */
	get currentFrameData() {
		return this.#frames[this.#currentFrameIndex] || null;
	}

	/**
	 * 현재 프레임의 이미지를 반환합니다.
	 * @returns { HTMLImageElement }
	 */
	get currentImage() {
		const frame = this.currentFrameData;
		return frame ? frame.#image : null;
	}

	/**
	 * 현재 프레임의 소스 영역(Rect)을 반환합니다.
	 * @returns { Rect }
	 */
	get currentSourceRect() {
		const frame = this.currentFrameData;
		return frame ? frame.#sourceRect : null;
	}

	/**
	 * @returns { boolean }
	 */
	get isPlaying() {
		return this.#isPlaying;
	}

	/**
	 * @returns { number }
	 */
	get currentFrame() {
		return this.#currentFrameIndex;
	}

	/**
	 * @returns { number }
	 */
	get totalFrames() {
		return this.#frames.length;
	}
}