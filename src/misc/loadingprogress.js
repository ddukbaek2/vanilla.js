//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";

// 알려 준 정도를 따라가는 빠르기의 기본값. (초당 남은 거리의 비율)
const DEFAULT_FOLLOW_RATE = 6;
// 이만큼 가까워지면 알려 준 정도에 딱 붙인다.
const SNAP_DISTANCE = 0.0005;


//==============================================================================
// 로딩 진행률.
// - 로딩의 단계가 알려 준 정도(setProgress, 0 ~ 1, 줄어들지 않음)를 보이는 정도(getShownProgress)가 부드럽게 따라간다.
//   받기가 몰려 진행률이 한 번에 뛰어도 막대가 튀지 않고 미끄러진다.
// - 매 프레임 update(timeDelta) 를 부른다. 따라가는 몫은 1 - exp(-빠르기 * 시간) 이라 프레임 간격이 달라도 같은 빠르기다.
//==============================================================================
/**
 * @example <caption>알려 준 정도를 보이는 정도가 따라가기</caption>
 * import { LoadingProgress } from "./build/vanilla.js";
 *
 * const loadingProgress = new LoadingProgress(6);
 * loadingProgress.setProgress(0.5);
 * for (let frame = 0; frame < 30; ++frame) {
 * 	loadingProgress.update(1 / 60);
 * }
 * console.log(loadingProgress.getProgress(), loadingProgress.getShownProgress().toFixed(3));
 *
 * loadingProgress.setProgress(0.3);
 * console.log(loadingProgress.getProgress());
 *
 * loadingProgress.setProgress(1);
 * while (!loadingProgress.isFinished()) {
 * 	loadingProgress.update(1 / 60);
 * }
 * console.log(loadingProgress.getShownProgress());
 */
export class LoadingProgress extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #targetProgress; // 알려 준 정도. (0 ~ 1)
	/** @private @type { number } */ #shownProgress; // 보이는 정도. (0 ~ 1)
	/** @private @type { number } */ #followRate;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { number } followRate 따라가는 빠르기. (초당 남은 거리의 비율, 기본 6)
	 */
	constructor(followRate = DEFAULT_FOLLOW_RATE) {
		super();
		this.#targetProgress = 0;
		this.#shownProgress = 0;
		this.#followRate = DEFAULT_FOLLOW_RATE;
		this.setFollowRate(followRate);
	}

	//==============================================================================
	// 알려 준 정도 설정. (0 ~ 1 로 자르고, 앞서 알린 것보다 작으면 무시한다)
	//==============================================================================
	/**
	 * @param { number } progress 알려 줄 정도. (0 ~ 1)
	 */
	setProgress(progress) {
		if (typeof progress !== "number" || System.Number.isNaN(progress)) {
			return;
		}
		const clampedProgress = System.Math.max(0, System.Math.min(1, progress));
		this.#targetProgress = System.Math.max(this.#targetProgress, clampedProgress);
	}

	//==============================================================================
	// 알려 준 정도 반환.
	//==============================================================================
	/**
	 * @returns { number } 0 ~ 1
	 */
	getProgress() {
		return this.#targetProgress;
	}

	//==============================================================================
	// 보이는 정도 반환. (그릴 때 읽는다)
	//==============================================================================
	/**
	 * @returns { number } 0 ~ 1
	 */
	getShownProgress() {
		return this.#shownProgress;
	}

	//==============================================================================
	// 갱신. (보이는 정도가 알려 준 정도를 따라간다)
	//==============================================================================
	/**
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 */
	update(timeDelta) {
		if (typeof timeDelta !== "number" || !System.Number.isFinite(timeDelta) || timeDelta <= 0) {
			return;
		}
		const targetProgress = this.getProgress();
		const followRate = this.getFollowRate();
		const followRatio = 1 - System.Math.exp(-followRate * timeDelta);
		this.#shownProgress += (targetProgress - this.#shownProgress) * followRatio;
		if (System.Math.abs(targetProgress - this.#shownProgress) < SNAP_DISTANCE) {
			this.#shownProgress = targetProgress;
		}
	}

	//==============================================================================
	// 따라가는 빠르기 설정. (초당 남은 거리의 비율, 0 보다 커야 한다. 아니면 그대로 둔다)
	//==============================================================================
	/**
	 * @param { number } followRate 따라가는 빠르기. (초당 남은 거리의 비율)
	 */
	setFollowRate(followRate) {
		if (typeof followRate !== "number" || !System.Number.isFinite(followRate) || followRate <= 0) {
			return;
		}
		this.#followRate = followRate;
	}

	//==============================================================================
	// 따라가는 빠르기 반환.
	//==============================================================================
	/**
	 * @returns { number } 따라가는 빠르기. (초당 남은 거리의 비율)
	 */
	getFollowRate() {
		return this.#followRate;
	}

	//==============================================================================
	// 보이는 정도가 끝(1)에 닿았는지.
	//==============================================================================
	/**
	 * @returns { boolean } 보이는 정도가 1 에 닿았으면 참.
	 */
	isFinished() {
		return this.#shownProgress >= 1;
	}

	//==============================================================================
	// 처음으로. (알려 준 정도와 보이는 정도를 0 으로)
	//==============================================================================
	reset() {
		this.#targetProgress = 0;
		this.#shownProgress = 0;
	}
}
