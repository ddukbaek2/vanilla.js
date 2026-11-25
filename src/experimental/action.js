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
//         .condition((target) => gameState.isReady())
//         .call((target) => { target.playAnimation(); })
//         .repeat(3, new Action().wait(0.5, { updated: (p, t) => { ... } }))
//         .forever(new Action().wait(2.0));
//
//     action.start(myNode);
//
//     // 매 프레임:
//     action.step(timeDelta);
//==============================================================================
/**
 * @example <caption>기다리고 부르고 반복하기</caption>
 * import { Action } from "./build/vanilla.js";
 *
 * const target = { opacity: 0, isReady: false };
 * const blinkAction = new Action();
 * blinkAction.wait(0.1);
 * const action = new Action();
 * action.wait(0.5, {
 * 	updated: (progress, actionTarget) => {
 * 		actionTarget.opacity = progress;
 * 	}
 * });
 * action.call((actionTarget) => {
 * 	actionTarget.isReady = true;
 * });
 * action.repeat(2, blinkAction);
 * action.start(target);
 * for (let frame = 0; frame < 60; ++frame) {
 * 	action.step(1 / 60);
 * }
 * console.log(target.opacity, target.isReady, action.isDone());
 */
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
		const target = this.getTarget();
		if (step.type === "call") {
			step.fn(target);
			this.#advanceStep();
			return;
		}
		if (step.callbacks && step.callbacks.started) {
			step.callbacks.started(target);
		}
		if (step.type === "repeat") {
			if (step.times <= 0) {
				this.#advanceStep();
				return;
			}
			this.#currentStepState.completedCount = 0;
			step.innerAction.start(target);
		}
		else if (step.type === "forever") {
			step.innerAction.start(target);
		}
		else if (step.type === "loop") {
			if (!step.conditionFn(target)) {
				this.#advanceStep();
				return;
			}
			step.innerAction.start(target);
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
	 * @param { number } duration 기다릴 시간. (초, 0 이하이면 다음 step 에서 바로 끝난다)
	 * @param { { started?: Function, updated?: Function, completed?: Function } } callbacks { started, updated, completed } 콜백. (모두 생략할 수 있다)
	 * @returns { Action } 이어 쓸 수 있게 이 액션.
	 * @example <caption>진행률 콜백 받기</caption>
	 * import { Action } from "./build/vanilla.js";
	 *
	 * const action = new Action();
	 * action.wait(1, {
	 * 	started: (target) => {
	 * 		console.log("started", target.name);
	 * 	},
	 * 	updated: (progress, target) => {
	 * 		target.progress = progress;
	 * 	},
	 * 	completed: (target) => {
	 * 		console.log("completed", target.progress);
	 * 	}
	 * });
	 * const target = { name: "fade", progress: 0 };
	 * action.start(target);
	 * action.step(0.5);
	 * action.step(0.5);
	 * console.log(action.isDone());
	 */
	wait(duration, callbacks = {}) {
		this.#steps.push({ type: "wait", duration: duration, callbacks: callbacks });
		return this;
	}

	//==============================================================================
	// 조건이 참이 될 때까지 대기. (조건 함수는 대상을 받는다)
	// - callbacks.started(target)              : 스텝 시작 시 호출.
	// - callbacks.updated(target)              : 조건 충족 전 매 프레임 호출.
	// - callbacks.completed(target)            : 조건 충족 시 호출.
	//==============================================================================
	/**
	 * @param { Function } conditionFn 대상을 받아 참을 돌려주면 다음 스텝으로 넘어가는 함수. (step 마다 부른다)
	 * @param { { started?: Function, updated?: Function, completed?: Function } } callbacks { started, updated, completed } 콜백. (모두 생략할 수 있다)
	 * @returns { Action } 이어 쓸 수 있게 이 액션.
	 */
	condition(conditionFn, callbacks = {}) {
		this.#steps.push({ type: "condition", conditionFn: conditionFn, callbacks: callbacks });
		return this;
	}

	//==============================================================================
	// 즉시 콜백 호출.
	//==============================================================================
	/**
	 * @param { Function } fn 대상을 받는 함수. (스텝이 시작되면 바로 부르고 다음 스텝으로 넘어간다)
	 * @returns { Action } 이어 쓸 수 있게 이 액션.
	 */
	call(fn) {
		this.#steps.push({ type: "call", fn: fn });
		return this;
	}

	//==============================================================================
	// 내부 액션을 N회 반복. (0 이하이면 돌지 않고 넘어간다)
	//==============================================================================
	/**
	 * @param { number } times 반복 수. (0 이하이면 돌지 않고 넘어간다)
	 * @param { Action } innerAction 반복할 액션. (끝날 때마다 같은 대상으로 다시 start 한다)
	 * @returns { Action } 이어 쓸 수 있게 이 액션.
	 */
	repeat(times, innerAction) {
		this.#steps.push({ type: "repeat", times: times, innerAction: innerAction });
		return this;
	}

	//==============================================================================
	// 내부 액션을 무한 반복.
	//==============================================================================
	/**
	 * @param { Action } innerAction 끝날 때마다 다시 start 할 액션.
	 * @returns { Action } 이어 쓸 수 있게 이 액션.
	 */
	forever(innerAction) {
		this.#steps.push({ type: "forever", innerAction: innerAction });
		return this;
	}

	//==============================================================================
	// 조건이 참인 동안 내부 액션을 반복. (조건 함수는 대상을 받는다)
	//==============================================================================
	/**
	 * @param { Function } conditionFn 대상을 받아 참이면 한 번 더 도는 함수. (스텝을 시작할 때와 내부 액션이 끝날 때마다 부른다)
	 * @param { Action } innerAction 반복할 액션.
	 * @returns { Action } 이어 쓸 수 있게 이 액션.
	 * @example <caption>조건이 참인 동안 반복하기</caption>
	 * import { Action } from "./build/vanilla.js";
	 *
	 * const counter = { count: 0 };
	 * const incrementAction = new Action();
	 * incrementAction.call((target) => {
	 * 	target.count += 1;
	 * });
	 * const action = new Action();
	 * action.loop((target) => {
	 * 	return target.count < 3;
	 * }, incrementAction);
	 * action.start(counter);
	 * for (let frame = 0; frame < 10; ++frame) {
	 * 	action.step(1 / 60);
	 * }
	 * console.log(counter.count, action.isDone());
	 */
	loop(conditionFn, innerAction) {
		this.#steps.push({ type: "loop", conditionFn: conditionFn, innerAction: innerAction });
		return this;
	}

	//==============================================================================
	// 실행 시작.
	//==============================================================================
	/**
	 * @param { System.Object } target 콜백과 조건 함수에 넘길 대상. (undefined 이면 전의 대상을 그대로 쓴다)
	 * @returns { Action } 이어 쓸 수 있게 이 액션.
	 */
	start(target) {
		const currentTarget = this.getTarget();
		this.#target = target !== undefined ? target : currentTarget;
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
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 */
	step(timeDelta) {
		if (!this.isRunning() || this.isDone()) {
			return;
		}
		if (this.#currentStepIndex >= this.#steps.length) {
			this.#isRunning = false;
			this.#isDone = true;
			return;
		}
		const step = this.#steps[this.#currentStepIndex];
		const target = this.getTarget();
		switch (step.type) {
			case "wait": {
				this.#currentStepElapsed += timeDelta;
				const progress = (step.duration > 0) ? Math.clamp(this.#currentStepElapsed / step.duration, 0, 1) : 1;
				if (step.callbacks && step.callbacks.updated) {
					step.callbacks.updated(progress, target);
				}
				if (this.#currentStepElapsed >= step.duration) {
					if (step.callbacks && step.callbacks.completed) {
						step.callbacks.completed(target);
					}
					this.#advanceStep();
				}
				break;
			}
			case "condition": {
				if (step.callbacks && step.callbacks.updated) {
					step.callbacks.updated(target);
				}
				if (step.conditionFn(target)) {
					if (step.callbacks && step.callbacks.completed) {
						step.callbacks.completed(target);
					}
					this.#advanceStep();
				}
				break;
			}
			case "repeat": {
				const repeatAction = step.innerAction;
				repeatAction.step(timeDelta);
				if (repeatAction.isDone()) {
					this.#currentStepState.completedCount++;
					if (this.#currentStepState.completedCount >= step.times) {
						this.#advanceStep();
					}
					else {
						repeatAction.start(target);
					}
				}
				break;
			}
			case "forever": {
				const foreverAction = step.innerAction;
				foreverAction.step(timeDelta);
				if (foreverAction.isDone()) {
					foreverAction.start(target);
				}
				break;
			}
			case "loop": {
				const loopAction = step.innerAction;
				loopAction.step(timeDelta);
				if (loopAction.isDone()) {
					if (step.conditionFn(target)) {
						loopAction.start(target);
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
	 * @returns { boolean } 모든 스텝을 마쳤거나 stop 했으면 참.
	 */
	isDone() {
		return this.#isDone;
	}

	//==============================================================================
	// 실행 중 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } start 한 뒤 아직 끝나지 않았으면 참.
	 */
	isRunning() {
		return this.#isRunning;
	}

	//==============================================================================
	// 타겟 반환.
	//==============================================================================
	/**
	 * @returns { System.Object } start 에 넘긴 대상. 없으면 null.
	 */
	getTarget() {
		return this.#target;
	}
}
