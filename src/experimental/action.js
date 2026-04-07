//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import * as Math from "../base/math.js";
import { Object } from "../base/object.js";


//==============================================================================
// 액션.
// - 순차적으로 스텝을 실행하는 스크립팅 방식의 액션 클래스.
// - 사용 예시:
//     const action = new Action()
//         .wait(1.0, {
//             started:   (target) => { },
//             updated:   (progress, target) => { target.setLocalOpacity(progress); },
//             completed: (target) => { }
//         })
//         .condition(() => gameState.isReady())
//         .call((target) => { target.playAnimation(); })
//         .repeat(3, new Action().wait(0.5, { updated: (p, t) => { ... } }))
//         .forever(new Action().wait(2.0));
//
//     action.start(myNode);
//
//     // 매 프레임:
//     action.step(timeDelta);
//==============================================================================
export class Action extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Array } */ #steps;
	/** @private @type { number } */ #currentStepIndex;
	/** @private @type { number } */ #currentStepElapsed;
	/** @private @type { System.Object } */ #currentStepState;
	/** @private @type { System.Object } */ #target;
	/** @private @type { boolean } */ #isRunning;
	/** @private @type { boolean } */ #isDone;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.#steps = [];
		this.#currentStepIndex = 0;
		this.#currentStepElapsed = 0;
		this.#currentStepState = null;
		this.#target = null;
		this.#isRunning = false;
		this.#isDone = false;
	}

	//==============================================================================
	// 현재 스텝 시작 처리.
	//==============================================================================
	/** @private */
	#startCurrentStep() {
		if (this.#currentStepIndex >= this.#steps.length) {
			this.#isRunning = false;
			this.#isDone = true;
			return;
		}
		const step = this.#steps[this.#currentStepIndex];
		this.#currentStepElapsed = 0;
		this.#currentStepState = {};
		if (step.type === 'call') {
			step.fn(this.#target);
			this.#advanceStep();
			return;
		}
		if (step.callbacks && step.callbacks.started) {
			step.callbacks.started(this.#target);
		}
		if (step.type === 'repeat') {
			this.#currentStepState.completedCount = 0;
			step.innerAction.start(this.#target);
		}
		else if (step.type === 'forever') {
			step.innerAction.start(this.#target);
		}
		else if (step.type === 'loop') {
			if (!step.conditionFn()) {
				this.#advanceStep();
				return;
			}
			step.innerAction.start(this.#target);
		}
	}

	//==============================================================================
	// 다음 스텝으로 이동.
	//==============================================================================
	/** @private */
	#advanceStep() {
		this.#currentStepIndex++;
		this.#startCurrentStep();
	}

	//==============================================================================
	// 일정 시간 대기.
	// - callbacks.started(target)              : 스텝 시작 시 호출.
	// - callbacks.updated(progress, target)    : 매 프레임 호출. progress = 0~1.
	// - callbacks.completed(target)            : 스텝 완료 시 호출.
	//==============================================================================
	/**
	 * @param { number } duration
	 * @param { { started?: Function, updated?: Function, completed?: Function } } callbacks
	 * @returns { Action }
	 */
	wait(duration, callbacks = {}) {
		this.#steps.push({ type: 'wait', duration: duration, callbacks: callbacks });
		return this;
	}

	//==============================================================================
	// 조건이 참이 될 때까지 대기.
	// - callbacks.started(target)              : 스텝 시작 시 호출.
	// - callbacks.updated(target)              : 조건 충족 전 매 프레임 호출.
	// - callbacks.completed(target)            : 조건 충족 시 호출.
	//==============================================================================
	/**
	 * @param { Function } conditionFn
	 * @param { { started?: Function, updated?: Function, completed?: Function } } callbacks
	 * @returns { Action }
	 */
	condition(conditionFn, callbacks = {}) {
		this.#steps.push({ type: 'condition', conditionFn: conditionFn, callbacks: callbacks });
		return this;
	}

	//==============================================================================
	// 즉시 콜백 호출.
	//==============================================================================
	/**
	 * @param { Function } fn
	 * @returns { Action }
	 */
	call(fn) {
		this.#steps.push({ type: 'call', fn: fn });
		return this;
	}

	//==============================================================================
	// 내부 액션을 N회 반복.
	//==============================================================================
	/**
	 * @param { number } times
	 * @param { Action } innerAction
	 * @returns { Action }
	 */
	repeat(times, innerAction) {
		this.#steps.push({ type: 'repeat', times: times, innerAction: innerAction });
		return this;
	}

	//==============================================================================
	// 내부 액션을 무한 반복.
	//==============================================================================
	/**
	 * @param { Action } innerAction
	 * @returns { Action }
	 */
	forever(innerAction) {
		this.#steps.push({ type: 'forever', innerAction: innerAction });
		return this;
	}

	//==============================================================================
	// 조건이 참인 동안 내부 액션을 반복.
	//==============================================================================
	/**
	 * @param { Function } conditionFn
	 * @param { Action } innerAction
	 * @returns { Action }
	 */
	loop(conditionFn, innerAction) {
		this.#steps.push({ type: 'loop', conditionFn: conditionFn, innerAction: innerAction });
		return this;
	}

	//==============================================================================
	// 실행 시작.
	//==============================================================================
	/**
	 * @param { System.Object } target
	 * @returns { Action }
	 */
	start(target) {
		this.#target = target !== undefined ? target : this.#target;
		this.#currentStepIndex = 0;
		this.#currentStepElapsed = 0;
		this.#currentStepState = null;
		this.#isRunning = true;
		this.#isDone = false;
		this.#startCurrentStep();
		return this;
	}

	//==============================================================================
	// 실행 중단.
	//==============================================================================
	stop() {
		this.#isRunning = false;
		this.#isDone = true;
	}

	//==============================================================================
	// 갱신. (매 프레임 호출)
	//==============================================================================
	/**
	 * @param { number } timeDelta
	 */
	step(timeDelta) {
		if (!this.#isRunning || this.#isDone) {
			return;
		}
		if (this.#currentStepIndex >= this.#steps.length) {
			this.#isRunning = false;
			this.#isDone = true;
			return;
		}
		const step = this.#steps[this.#currentStepIndex];
		switch (step.type) {
			case 'wait': {
				this.#currentStepElapsed += timeDelta;
				const progress = Math.clamp(this.#currentStepElapsed / step.duration, 0, 1);
				if (step.callbacks && step.callbacks.updated) {
					step.callbacks.updated(progress, this.#target);
				}
				if (this.#currentStepElapsed >= step.duration) {
					if (step.callbacks && step.callbacks.completed) {
						step.callbacks.completed(this.#target);
					}
					this.#advanceStep();
				}
				break;
			}
			case 'condition': {
				if (step.callbacks && step.callbacks.updated) {
					step.callbacks.updated(this.#target);
				}
				if (step.conditionFn()) {
					if (step.callbacks && step.callbacks.completed) {
						step.callbacks.completed(this.#target);
					}
					this.#advanceStep();
				}
				break;
			}
			case 'repeat': {
				const repeatAction = step.innerAction;
				repeatAction.step(timeDelta);
				if (repeatAction.isDone()) {
					this.#currentStepState.completedCount++;
					if (this.#currentStepState.completedCount >= step.times) {
						this.#advanceStep();
					}
					else {
						repeatAction.start(this.#target);
					}
				}
				break;
			}
			case 'forever': {
				const foreverAction = step.innerAction;
				foreverAction.step(timeDelta);
				if (foreverAction.isDone()) {
					foreverAction.start(this.#target);
				}
				break;
			}
			case 'loop': {
				const loopAction = step.innerAction;
				loopAction.step(timeDelta);
				if (loopAction.isDone()) {
					if (step.conditionFn()) {
						loopAction.start(this.#target);
					}
					else {
						this.#advanceStep();
					}
				}
				break;
			}
			default: {
				break;
			}
		}
	}

	//==============================================================================
	// 완료 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isDone() {
		return this.#isDone;
	}

	//==============================================================================
	// 실행 중 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isRunning() {
		return this.#isRunning;
	}

	//==============================================================================
	// 타겟 반환.
	//==============================================================================
	/**
	 * @returns { System.Object }
	 */
	getTarget() {
		return this.#target;
	}
}
