//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VObject } from "../base/object.js";
import { VVector2 } from "../base/vector2.js";
import { VRenderer } from "../core/renderer.js"
import { VSprite } from "./sprite.js";
import { VImageAsset } from "../resource/imageasset.js";


//==============================================================================
// 애니메이션 객체.
//==============================================================================
export class VAnimation extends VObject {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { VVector2 } */ size;
	/** @type { number } */ totalFrames;
	/** @type { VImageAsset[] } */ images;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.size = VVector2.zero();
		this.totalFrames = 0;
		this.images = [];
	}
}


//==============================================================================
// 애니메이션 처리 기능이 추가된 스프라이트.
//==============================================================================
export class VAnimatedSprite extends VSprite {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { VAnimation } */ #animation;
	/** @private @type { number } */ #elapsedTime;
	/** @private @type { number } */ #currentFrameIndex;
	/** @private @type { number } */ #repeatNumber;
	/** @private @type { boolean } */ #isPlaying;
	
	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		
		this.#animation = null;
		this.#elapsedTime = 0.0;
		this.#currentFrameIndex = 0;
		this.#repeatNumber = 0;
		this.#isPlaying = false;
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
		this.updateAnimation(timeDelta);
	}

	//==============================================================================
	// 애니메이션 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta 
	 */
	updateAnimation(timeDelta) {
		if (this.#isPlaying) {
			this.#elapsedTime += timeDelta;
			if (this.#elapsedTime >= this.#animation.totalFrames) {
				this.#elapsedTime -= this.#animation.totalFrames;
				++this.#currentFrameIndex;
				this.setImage(this.#animation.images[this.#currentFrameIndex]);
				if (this.#currentFrameIndex >= this.#animation.totalFrames) {
					this.#currentFrameIndex = 0;
					--this.#repeatNumber;
					if (this.#repeatNumber == 0) {
						this.stop();
					}
				}
			}
		}
	}

	//==============================================================================
	// 애니메이션 설정.
	//==============================================================================
	/**
	 * @override
	 * @param { VAnimation } animation 
	 */
	setAnimation(animation) {
		this.#animation = animation;
	}

	//==============================================================================
	// 재생.
	//==============================================================================
	play() {
		this.#isPlaying = true;
		this.#currentFrameIndex = 0;
		this.#elapsedTime = 0.0;
		this.#repeatNumber = 1;
		updateAnimation(0.0);
	}

	//==============================================================================
	// 정지.
	//==============================================================================
	stop() {
		this.#isPlaying = false;
	}

	//==============================================================================
	// 재생 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isPlaying() {
		return this.#isPlaying;
	}
}