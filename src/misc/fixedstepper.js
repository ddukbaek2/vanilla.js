//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";


//==============================================================================
// 고정 걸음.
// - 프레임 간격이 들쭉날쭉해도 규칙(물리, 판의 흐름)은 늘 같은 걸음(stepSeconds)으로 돌린다.
// - advance(timeDelta, stepFunction) 가 받은 시간을 쌓아 두고 걸음만큼 찰 때마다 stepFunction(stepSeconds) 을 부른다.
//   돌려주는 값은 남은 몫(0 ~ 1)이다. 앞 걸음과 지금 걸음 사이를 이 몫만큼 섞어 그리면 걸음이 화면 주사율과 어긋나 떨리지 않는다.
// - 한 프레임에 maximumStepsPerFrame 걸음까지만 돈다. 그만큼 돌고도 남았으면 남은 시간을 버린다.
//   (느린 기기에서 멈칫한 뒤 밀린 것을 한꺼번에 몰아 돌다 더 느려지지 않게)
// - stepFunction 이 false 를 돌려주면 이번 프레임의 걸음을 거기서 멈추고 남은 시간은 쌓아 둔다. (회의, 연출처럼 잠시 붙잡을 때)
//==============================================================================
/**
 * @example <caption>들쭉날쭉한 프레임을 같은 걸음으로 돌리기</caption>
 * import { FixedStepper } from "./build/vanilla.js";
 *
 * const fixedStepper = new FixedStepper(1 / 60, 5);
 * let position = 0;
 * const velocity = 120;
 * const frameDeltaList = [0.016, 0.033, 0.008, 0.050];
 * for (const timeDelta of frameDeltaList) {
 * 	const alpha = fixedStepper.advance(timeDelta, (stepSeconds) => {
 * 		position += velocity * stepSeconds;
 * 	});
 * 	console.log(fixedStepper.getLastStepCount(), alpha.toFixed(2), position.toFixed(2));
 * }
 */
export class FixedStepper extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #stepSeconds;
	/** @private @type { number } */ #maximumStepsPerFrame;
	/** @private @type { number } */ #accumulatedSeconds;
	/** @private @type { number } */ #lastStepCount;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { number } stepSeconds 한 걸음의 시간. (초, 기본 1 / 60)
	 * @param { number } maximumStepsPerFrame 한 프레임에 도는 걸음의 상한. (기본 5)
	 */
	constructor(stepSeconds = 1 / 60, maximumStepsPerFrame = 5) {
		super();
		this.#stepSeconds = 1 / 60;
		this.#maximumStepsPerFrame = 5;
		this.#accumulatedSeconds = 0;
		this.#lastStepCount = 0;
		this.setStepSeconds(stepSeconds);
		this.setMaximumStepsPerFrame(maximumStepsPerFrame);
	}

	//==============================================================================
	// 한 걸음의 시간 설정. (초, 0 보다 커야 한다. 아니면 그대로 둔다)
	//==============================================================================
	/**
	 * @param { number } stepSeconds 한 걸음의 시간. (초)
	 */
	setStepSeconds(stepSeconds) {
		if (typeof stepSeconds !== "number" || !System.Number.isFinite(stepSeconds) || stepSeconds <= 0) {
			return;
		}
		this.#stepSeconds = stepSeconds;
	}

	//==============================================================================
	// 한 걸음의 시간 반환. (초)
	//==============================================================================
	/**
	 * @returns { number } 한 걸음의 시간. (초)
	 */
	getStepSeconds() {
		return this.#stepSeconds;
	}

	//==============================================================================
	// 한 프레임에 도는 걸음의 상한 설정. (1 이상, 소수는 버린다)
	//==============================================================================
	/**
	 * @param { number } maximumStepsPerFrame 한 프레임에 도는 걸음의 상한.
	 */
	setMaximumStepsPerFrame(maximumStepsPerFrame) {
		if (typeof maximumStepsPerFrame !== "number" || !System.Number.isFinite(maximumStepsPerFrame)) {
			return;
		}
		this.#maximumStepsPerFrame = System.Math.max(1, System.Math.floor(maximumStepsPerFrame));
	}

	//==============================================================================
	// 한 프레임에 도는 걸음의 상한 반환.
	//==============================================================================
	/**
	 * @returns { number } 한 프레임에 도는 걸음의 상한.
	 */
	getMaximumStepsPerFrame() {
		return this.#maximumStepsPerFrame;
	}

	//==============================================================================
	// 나아가기. (받은 시간만큼 걸음을 돌리고 남은 몫을 돌려준다)
	//==============================================================================
	/**
	 * @param { number } timeDelta 이번 프레임의 시간. (초, 음수나 숫자가 아니면 0)
	 * @param { (stepSeconds: number) => (boolean | void) } stepFunction 한 걸음. false 를 돌려주면 이번 프레임은 거기서 멈춘다.
	 * @returns { number } 남은 몫. (0 ~ 1)
	 * @example <caption>남은 몫으로 섞어 그리고, false 로 걸음을 붙잡기</caption>
	 * import { FixedStepper } from "./build/vanilla.js";
	 *
	 * const fixedStepper = new FixedStepper();
	 * let previousPosition = 0;
	 * let currentPosition = 0;
	 * let isPaused = false;
	 * const step = (stepSeconds) => {
	 * 	if (isPaused) {
	 * 		return false;
	 * 	}
	 * 	previousPosition = currentPosition;
	 * 	currentPosition += 60 * stepSeconds;
	 * 	return true;
	 * };
	 * const alpha = fixedStepper.advance(0.025, step);
	 * const drawPosition = previousPosition + (currentPosition - previousPosition) * alpha;
	 * console.log(fixedStepper.getLastStepCount(), drawPosition);
	 *
	 * isPaused = true;
	 * fixedStepper.advance(0.1, step);
	 * console.log(fixedStepper.getLastStepCount(), fixedStepper.getAlpha());
	 */
	advance(timeDelta, stepFunction) {
		const stepSeconds = this.getStepSeconds();
		const maximumStepsPerFrame = this.getMaximumStepsPerFrame();
		const isValidTimeDelta = typeof timeDelta === "number" && System.Number.isFinite(timeDelta) && timeDelta > 0;
		if (isValidTimeDelta) {
			this.#accumulatedSeconds += timeDelta;
		}
		let stepCount = 0;
		let isHeld = false;
		while (this.#accumulatedSeconds >= stepSeconds && stepCount < maximumStepsPerFrame) {
			const stepResult = stepFunction(stepSeconds);
			if (stepResult === false) {
				isHeld = true;
				break;
			}
			this.#accumulatedSeconds -= stepSeconds;
			stepCount += 1;
		}
		if (!isHeld && stepCount >= maximumStepsPerFrame && this.#accumulatedSeconds >= stepSeconds) {
			this.#accumulatedSeconds = 0;
		}
		this.#lastStepCount = stepCount;
		return this.getAlpha();
	}

	//==============================================================================
	// 남은 몫. (쌓인 시간 / 한 걸음, 0 ~ 1)
	//==============================================================================
	/**
	 * @returns { number } 남은 몫. (0 ~ 1)
	 */
	getAlpha() {
		const stepSeconds = this.getStepSeconds();
		const alpha = this.#accumulatedSeconds / stepSeconds;
		return System.Math.max(0, System.Math.min(1, alpha));
	}

	//==============================================================================
	// 지난 advance 에서 돈 걸음 수.
	//==============================================================================
	/**
	 * @returns { number } 지난 advance 에서 돈 걸음 수.
	 */
	getLastStepCount() {
		return this.#lastStepCount;
	}

	//==============================================================================
	// 쌓인 시간 비우기. (판을 새로 시작하거나 붙잡았다 풀 때)
	//==============================================================================
	reset() {
		this.#accumulatedSeconds = 0;
		this.#lastStepCount = 0;
	}
}
