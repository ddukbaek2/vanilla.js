//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Rect } from "../base/rect.js";
import { Frame } from "./frame.js";
// import { AnimationClip } from "./animationclip.js";


//==============================================================================
// 애니메이션 처리기.
//==============================================================================
export class Animation extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	// /** @private @type { AnimationClip[] } */ #clips; // 클립 목록.
	/** @private @type { Frame[] } */ #frames; // 프레임 목록.
	/** @private @type { boolean } */ #isPlaying; // 재생 중인지 여부.
	/** @private @type { number } */ #currentFrameIndex; // 현재 프레임 번호.
	/** @private @type { number } */ #frameTimeCounter;
	/** @private @type { number } */ #animationSpeed; // 애니메이션 속도: 초당 프레임 수.
	/** @private @type { boolean } */ #isLoop;
	/** @private @type { Function } */ #onComplete;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		// this.#clips = [];
		this.#frames = [];
		this.#currentFrameIndex = 0;
		this.#frameTimeCounter = 0;
		this.#animationSpeed = 10;
		this.#isLoop = true;
		this.#isPlaying = false;
		this.#onComplete = null;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta 
	 */
	tick(timeDelta) {
		if (!this.#isPlaying || this.#frames.length === 0 || this.#animationSpeed <= 0) {
			return;
		}

		const frameDuration = 1.0 / this.#animationSpeed;
		this.#frameTimeCounter += timeDelta;

		if (this.#frameTimeCounter >= frameDuration) {
			const framesToAdvance = Math.floor(this.#frameTimeCounter / frameDuration);
			this.#frameTimeCounter %= frameDuration;
			this.#currentFrameIndex += framesToAdvance;

			if (this.#currentFrameIndex >= this.#frames.length) {
				// 반복.
				if (this.#isLoop) {
					this.#currentFrameIndex %= this.#frames.length;
				}
				else {
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
	// 재생.
	//==============================================================================
	play() {
		const isPlaying = this.isPlaying();
		if (isPlaying) {
			return;
		}

		this.#isPlaying = true;
	}

	//==============================================================================
	// 일시정지.
	//==============================================================================
	pause() {

	}

	//==============================================================================
	// 재개.
	//==============================================================================
	resume() {

	}

	//==============================================================================
	// 정지.
	//==============================================================================
	stop() {
		const isPlaying = this.isPlaying();
		if (!isPlaying) {
			return;
		}

		this.#isPlaying = false;
		this.#currentFrameIndex = 0;
		this.#frameTimeCounter = 0;
	}

	//==============================================================================
	// 프레임 설정.
	//==============================================================================
	/**
	 * @param { Frame[] } frames
	 */
	setFrames(frames) {
		if (frames === null || frames instanceof Array === false) {
			return;
		}

		this.#frames = frames;
		this.stop();
	}

	//==============================================================================
	// 프레임 설정. (낱장의 스프라이트 이미지 목록)
	//==============================================================================
	/**
	 * @param { HTMLImageElement[] } images
	 */
	setFramesFromImages(images) {
		if (images === null || images instanceof Array === false || images.length === 0) {
			return;
		}
		const frames = images.map(image => new Frame(image));
		this.setFrames(frames);
	}

	//==============================================================================
	// 프레임 설정. (스프라이트 시트)
	//==============================================================================
	/**
	 * @param { HTMLImageElement } image
	 * @param { Rect[] } rects
	 */
	setFramesFromRects(image, rects) {
		if (image === null || image instanceof HTMLImageElement === false ||
			rects === 0 || rects instanceof Array === false || rects.length === 0) {
			return;
		}

		const frames = rects.map(rect => new Frame(image, rect));
		this.setFrames(frames);
	}

	//==============================================================================
	// 초당 프레임 숫 설정.
	// - 예) 60으로 지정시 초당 이미지 60회 변경됨.
	//==============================================================================
	/**
	 * @param { number } animationSpeed 
	 */
	setAnimationSpeed(animationSpeed) {
		this.#animationSpeed = animationSpeed;
	}

	//==============================================================================
	// 반복 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } value 
	 */
	setLoop(value) {
		this.#isLoop = value;
	}

	//==============================================================================
	// 애니메이션 완료 콜백 설정.
	//==============================================================================
	/**
	 * @param { Function } callback 
	 */
	setOnComplete(callback) {
		this.#onComplete = callback;
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
	// 재생 중인지 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isPlaying() {
		return this.#isPlaying;
	}
	//==============================================================================
	// 현재 프레임 반환.
	//==============================================================================
	/**
	 * @returns { Frame }
	 */
	getCurrentFrame() {
		return this.#frames[this.#currentFrameIndex] || null;
	}

	//==============================================================================
	// 현재 이미지 반환.
	//==============================================================================
	/**
	 * @returns { HTMLImageElement }
	 */
	getCurrentImage() {
		const frame = this.getCurrentFrame();
		return frame ? frame.getImage() : null;
	}

	//==============================================================================
	// 현재 영역 반환.
	//==============================================================================
	getCurrentRect() {
		const frame = this.getCurrentFrame();
		return frame ? frame.getRect() : null;
	}

	//==============================================================================
	// 현재 프레임 번호 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getCurrentFrameIndex() {
		return this.#currentFrameIndex;
	}

	//==============================================================================
	// 모든 프레임 수 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getTotalFrameCount() {
		return this.#frames.length;
	}
}