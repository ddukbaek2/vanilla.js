//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Engine } from "./engine.js";


//==============================================================================
// 시간 매니저.
//==============================================================================
export class TimeManager extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #realtimeSinceStartup;
	/** @private @type { number } */ #time;
	/** @private @type { number } */ #unscaledTimeDelta;
	/** @private @type { number } */ #fps;
	/** @private @type { number } */ #framesThisSecond;
	/** @private @type { number } */ #previousFrameCheckTime;
	/** @private @type { number } */ #timeScale;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { Engine } engine 
	 */
	constructor(engine) {
		super();
		this.#realtimeSinceStartup = 0;
		this.#time = 0.0;
		this.#unscaledTimeDelta = 0.0;
		this.#fps = 0;
		this.#framesThisSecond = 0;
		this.#previousFrameCheckTime = 0;
		this.#timeScale = 1;
	}

	//==============================================================================
	// 시간 계산.
	//==============================================================================
	/**
	 * @param { number } timestamp
	 */
	update(timestamp) {
		// timestamp: 현재 웹페이지의 생명주기가 시작된 후부터 경과된 시간. (밀리초)
		// 이를 초 단위로 변환해서 사용함.
		const realtimeSinceStartup = timestamp * 0.001;

		// 최초 시간 처리.
		if (this.#realtimeSinceStartup === 0) {
			this.#realtimeSinceStartup = realtimeSinceStartup;
			this.#previousFrameCheckTime = realtimeSinceStartup;
		}

		// 시간 반영.
		// (타이머 역행 시 음수, 백그라운드 탭 복귀 시 거대 값이 들어올 수 있어 [0, 0.25초]로 막는다)
		const rawTimeDelta = (realtimeSinceStartup - this.#realtimeSinceStartup);
		const unscaledTimeDelta = System.Math.min(0.25, System.Math.max(0, rawTimeDelta));
		this.#realtimeSinceStartup = realtimeSinceStartup;
		this.#time += unscaledTimeDelta;
		this.#unscaledTimeDelta = unscaledTimeDelta;

		// 프레임 계산.
		if (realtimeSinceStartup >= this.#previousFrameCheckTime + 1.0) {
			this.#fps = this.#framesThisSecond;
			this.#framesThisSecond = 0;
			this.#previousFrameCheckTime = realtimeSinceStartup;
		}

		// 프레임 증가.
		++this.#framesThisSecond;
	}

	//==============================================================================
	// 현재 프라우저가 시작 된 이후 시간 반환. (초 단위)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getRealtimeSinceStartup() {
		return this.#realtimeSinceStartup;
	}

	//==============================================================================
	// 현재 엔진이 시작 된 이후 시간 반환. (초 단위)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getTime() {
		return this.#time;
	}

	//==============================================================================
	// 현재 프레임과 이전 프레임 사이의 경과 시간 반환. (초 단위)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getUnscaleDeltaTime() {
		return this.#unscaledTimeDelta;
	}

	//==============================================================================
	// 현재 프레임과 이전 프레임 사이의 경과 시간 반환. (초 단위)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getTimeDelta() {
		const unscaledTimeDelta = this.getUnscaleDeltaTime();
		const timeScale = this.getTimeScale();
		return unscaledTimeDelta * timeScale;
	}

	//==============================================================================
	// 현재 초당 프레임 수 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getFramePerSecond() {
		return this.#fps;
	}

	//==============================================================================
	// 시간 배율 설정.
	//==============================================================================
	/**
	 * @param { number } timeScale
	 */
	setTimeScale(timeScale) {
		this.#timeScale = timeScale;
	}

	//==============================================================================
	// 시간 배율 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getTimeScale() {
		return this.#timeScale;
	}
}