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
	/** @private @type { number } */ #maximumTimeDelta; // 한 프레임 간격의 상한. (초)

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
		this.#maximumTimeDelta = 0.25;
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
		// (타이머 역행 시 음수, 백그라운드 탭 복귀 시 거대 값이 들어올 수 있어 [0, 상한]으로 막는다. 상한은 기본 0.25초, setMaximumTimeDelta)
		const rawTimeDelta = (realtimeSinceStartup - this.#realtimeSinceStartup);
		const maximumTimeDelta = this.getMaximumTimeDelta();
		const unscaledTimeDelta = System.Math.min(maximumTimeDelta, System.Math.max(0, rawTimeDelta));
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

	//==============================================================================
	// 한 프레임 간격의 상한 설정. (초, 기본 0.25)
	// - 창이 가려졌다 돌아오거나 오래 멈춘 뒤의 첫 프레임 간격을 이 값으로 자른다. 0 보다 작거나 숫자가 아니면 0.25 로 둔다.
	// - 물리나 흐름이 한 번에 크게 나아가면 안 되는 게임은 0.1, 0.05 처럼 줄인다.
	//==============================================================================
	/**
	 * @param { number } seconds
	 */
	setMaximumTimeDelta(seconds) {
		if (typeof seconds !== "number" || !System.Number.isFinite(seconds) || seconds < 0) {
			this.#maximumTimeDelta = 0.25;
			return;
		}
		this.#maximumTimeDelta = seconds;
	}

	//==============================================================================
	// 한 프레임 간격의 상한 반환. (초)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getMaximumTimeDelta() {
		return this.#maximumTimeDelta;
	}
}