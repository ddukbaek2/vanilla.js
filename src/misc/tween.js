//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VObject } from "../base/object.js";
import { VVector2 } from "../base/vector2.js";
import { VEnum } from "../base/identifier.js";
import * as VMath from "../base/math.js";


//==============================================================================
// 동작 타입.
//==============================================================================
export const EaseType = {
	linear: VEnum.auto(),
	easeIn: VEnum.auto(),
	easeOut: VEnum.auto(),
	easeInOut: VEnum.auto(),
};


export const Sample = {
	numberSample: (from, to, normalizedTime) => {
		normalizedTime = VMath.clamp(normalizedTime, 0, 1);
		const current = VMath.lerp(from, to, normalizedTime);
		return current;
	},
	vector2Sample: (from, to, normalizedTime) => {
		normalizedTime = VMath.clamp(normalizedTime, 0, 1);
		const current = VVector2.create(
			Sample.numberSample(from.x, to.x, normalizedTime),
			Sample.numberSample(from.y, to.y, normalizedTime)
		);
		return current;
	},
};

//==============================================================================
// 터치 효과.
//==============================================================================
export class VTween extends VObject {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { boolean } */ #isPlaying;
	/** @private @type { any } */ #target;
	/** @private @type { any } */ #from;
	/** @private @type { any } */ #to;
	/** @private @type { EaseType } */ #easeType;
	/** @private @type { number } */ #duration;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.isPlaying = false;
		this.#target = null;
		this.#from = null;
		this.#to = null;
		this.#easeType = EaseType.linear;
		this.#duration = 0.0;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta 
	 */
	update(timeDelta) {
		this.updateTween(timeDelta);
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta 
	 */
	updateTween(timeDelta) {
		if (!this.#isPlaying) {
			return;
		}
	}

	//==============================================================================
	// 재생.
	//==============================================================================
	play() {
		this.#isPlaying = true;
	}

	//==============================================================================
	// 정지.
	//==============================================================================
	stop() {
		if (!this.#isPlaying) {
			return;
		}

		this.#isPlaying = false;
	}

	//==============================================================================
	// 재생 중 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isPlaying() {
		return this.#isPlaying;
	}
}