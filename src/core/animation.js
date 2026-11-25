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
/**
 * @example <caption>스프라이트 시트로 한 번 도는 애니메이션</caption>
 * import { ImageAsset, Animation, Rect } from "./build/vanilla.js";
 *
 * const imageAsset = new ImageAsset();
 * await imageAsset.load("examples/assets/spritesheet.png");
 * const image = imageAsset.getImage();
 * const rects = [];
 * for (let row = 0; row < 3; ++row) {
 * 	for (let column = 0; column < 3; ++column) {
 * 		rects.push(Rect.create(column * 200, row * 200, 200, 200));
 * 	}
 * }
 *
 * const animation = new Animation();
 * animation.setFramesFromRects(image, rects);
 * animation.setAnimationSpeed(8);
 * animation.setLoop(false);
 * animation.setOnComplete(() => {
 * 	console.log("complete", animation.getCurrentFrameIndex());
 * });
 * animation.play();
 * animation.tick(0.5);
 * console.log(animation.getCurrentFrameIndex(), animation.getTotalFrameCount());
 * animation.tick(1.0);
 * console.log(animation.isPlaying());
 */
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
	 * @param { number } timeDelta 지난 시간. (초, 재생 중이고 프레임이 있고 속도가 0 보다 클 때만 넘긴다)
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
	// 일시정지. (지금 프레임과 쌓인 시간을 그대로 둔다)
	//==============================================================================
	pause() {
		this.#isPlaying = false;
	}

	//==============================================================================
	// 재개. (멈춘 프레임에서 이어 간다)
	//==============================================================================
	resume() {
		this.#isPlaying = true;
	}

	//==============================================================================
	// 정지. (첫 프레임으로 되돌린다. 멈춰 있어도 되돌린다)
	//==============================================================================
	stop() {
		this.#isPlaying = false;
		this.#currentFrameIndex = 0;
		this.#frameTimeCounter = 0;
	}

	//==============================================================================
	// 프레임 설정.
	//==============================================================================
	/**
	 * @param { Frame[] } frames 프레임 목록. (배열이 아니면 무시한다, 넣으면 stop 처럼 첫 프레임으로 되돌리고 멈춘다)
	 */
	setFrames(frames) {
		if (frames === null || frames === undefined || frames instanceof Array === false) {
			return;
		}

		this.#frames = frames;
		this.stop();
	}

	//==============================================================================
	// 프레임 설정. (낱장의 스프라이트 이미지 목록)
	//==============================================================================
	/**
	 * @param { HTMLImageElement[] } images 낱장 이미지 목록. (이미지마다 전체 영역 프레임 하나, 비었거나 배열이 아니면 무시한다)
	 */
	setFramesFromImages(images) {
		if (images === null || images === undefined || images instanceof Array === false || images.length === 0) {
			return;
		}
		const frames = images.map(image => new Frame(image));
		this.setFrames(frames);
	}

	//==============================================================================
	// 프레임 설정. (스프라이트 시트)
	//==============================================================================
	/**
	 * @param { HTMLImageElement } image 스프라이트 시트 이미지. (HTMLImageElement 가 아니면 무시한다)
	 * @param { Rect[] } rects 시트 안의 프레임 영역 목록. (픽셀, 비었거나 배열이 아니면 무시한다)
	 */
	setFramesFromRects(image, rects) {
		if (image === null || image === undefined || image instanceof HTMLImageElement === false ||
			rects === null || rects === undefined || rects instanceof Array === false || rects.length === 0) {
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
	 * @param { number } animationSpeed 초당 프레임 수. (기본 10, 0 이하이면 넘기지 않는다)
	 */
	setAnimationSpeed(animationSpeed) {
		this.#animationSpeed = animationSpeed;
	}

	//==============================================================================
	// 반복 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } value 반복하면 참. (기본 참, 거짓이면 마지막 프레임에서 멈추고 완료 콜백을 부른다)
	 */
	setLoop(value) {
		this.#isLoop = value;
	}

	//==============================================================================
	// 애니메이션 완료 콜백 설정.
	//==============================================================================
	/**
	 * @param { Function } callback 반복하지 않는 애니메이션이 마지막 프레임에 닿으면 부를 함수. (인자 없음, null 이면 부르지 않는다)
	 */
	setOnComplete(callback) {
		this.#onComplete = callback;
	}

	/**
	 * 특정 프레임으로 이동하여 재생합니다.
	 * @param { number } index 프레임 번호. (0 부터, 범위 밖이면 처음이나 끝으로 자른다)
	 */
	gotoAndPlay(index) {
		this.#currentFrameIndex = Math.max(0, Math.min(index, this.#frames.length - 1));
		this.#frameTimeCounter = 0;
		this.play();
	}

	/**
	 * 특정 프레임으로 이동하여 정지합니다.
	 * @param { number } index 프레임 번호. (0 부터, 범위 밖이면 처음이나 끝으로 자른다)
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
	 * @returns { boolean } 재생 중이면 참.
	 */
	isPlaying() {
		return this.#isPlaying;
	}
	//==============================================================================
	// 현재 프레임 반환.
	//==============================================================================
	/**
	 * @returns { Frame } 현재 프레임. (프레임이 없으면 null)
	 */
	getCurrentFrame() {
		return this.#frames[this.#currentFrameIndex] || null;
	}

	//==============================================================================
	// 현재 이미지 반환.
	//==============================================================================
	/**
	 * @returns { HTMLImageElement } 현재 프레임의 이미지. (프레임이 없으면 null)
	 */
	getCurrentImage() {
		const frame = this.getCurrentFrame();
		return frame ? frame.getImage() : null;
	}

	//==============================================================================
	// 현재 영역 반환.
	//==============================================================================
	/**
	 * @returns { Rect | null } 현재 프레임의 이미지 안 영역. (픽셀, 프레임이 없으면 null)
	 */
	getCurrentRect() {
		const frame = this.getCurrentFrame();
		return frame ? frame.getImageRect() : null;
	}

	//==============================================================================
	// 현재 프레임 번호 반환.
	//==============================================================================
	/**
	 * @returns { number } 현재 프레임 번호. (0 부터)
	 */
	getCurrentFrameIndex() {
		return this.#currentFrameIndex;
	}

	//==============================================================================
	// 모든 프레임 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 프레임 수.
	 */
	getTotalFrameCount() {
		return this.#frames.length;
	}
}