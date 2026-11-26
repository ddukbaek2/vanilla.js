//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { List } from "../base/collection/list.js";
import { Dictionary } from "../base/collection/dictionary.js";
import { Frame } from "../core/frame.js";
import { AnimationClip } from "../resource/animationclip.js";


//==============================================================================
// 전이 조건의 견주는 법.
// - if, ifNot 은 참 거짓 매개변수를 본다. (if 는 트리거가 걸려 있는 것도 본다)
// - greater, less, equals, notEqual 은 실수와 정수 매개변수를 기준 값과 견준다.
//==============================================================================
export const AnimationConditionMode = System.Object.freeze({
	if: "if", // 참 거짓 매개변수가 참이거나 트리거가 걸려 있다.
	ifNot: "ifNot", // 참 거짓 매개변수가 거짓이다.
	greater: "greater", // 수 매개변수가 기준 값보다 크다.
	less: "less", // 수 매개변수가 기준 값보다 작다.
	equals: "equals", // 수 매개변수가 기준 값과 같다.
	notEqual: "notEqual", // 수 매개변수가 기준 값과 다르다.
});


//==============================================================================
// 애니메이션 상태. (클립 하나를 속도와 되풀이 여부로 튼다)
// - 상태 시간은 들어온 뒤 흐른 초에 속도를 곱해 쌓은 것이다. 정규화 시간은 상태 시간을 클립 길이로 나눈 것이다. (1 이면 한 바퀴)
// - 되풀이는 setLoop 로 정하지 않으면(null) 클립의 isLoop 를 따른다.
// - 클립이 없거나 길이가 0 이면 정규화 시간은 시간이 흐르기 전 0, 흐른 뒤 1 이다.
//==============================================================================
/**
 * @example <caption>상태에 클립 달고 시간에 맞는 프레임 보기</caption>
 * import { AnimationState, AnimationClip, Rect } from "./build/vanilla.js";
 *
 * const clip = new AnimationClip();
 * clip.setFrames([Rect.create(0, 0, 32, 32), Rect.create(32, 0, 32, 32)]);
 * clip.setDuration(0.5);
 * clip.setLoop(false);
 * const state = new AnimationState();
 * state.setClip(clip);
 * state.setSpeed(2);
 * state.setLoop(true);
 * console.log(state.isLoop(), state.getNormalizedTime(0.75), state.getFrameIndex(0.75));
 */
export class AnimationState extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { AnimationClip } */ #clip; // 클립.
	/** @private @type { number } */ #speed; // 재생 속도. (1 이면 제 속도)
	/** @private @type { boolean | null } */ #isLoop; // 되풀이 여부. (null 이면 클립을 따른다)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.#clip = null;
		this.#speed = 1;
		this.#isLoop = null;
	}

	//==============================================================================
	// 클립 설정.
	//==============================================================================
	/**
	 * @param { AnimationClip | null } clip 이 상태에서 쓸 클립. (null 이면 비운다)
	 */
	setClip(clip) {
		this.#clip = clip;
	}

	//==============================================================================
	// 클립 반환. (없으면 null)
	//==============================================================================
	/**
	 * @returns { AnimationClip | null } 이 상태의 클립.
	 */
	getClip() {
		return this.#clip;
	}

	//==============================================================================
	// 재생 속도 설정.
	//==============================================================================
	/**
	 * @param { number } speed 재생 속도. (기본 1, 2 면 두 배로 빠르고 0 이면 멈춘다)
	 */
	setSpeed(speed) {
		this.#speed = speed;
	}

	//==============================================================================
	// 재생 속도 반환.
	//==============================================================================
	/**
	 * @returns { number } 재생 속도. (기본 1)
	 */
	getSpeed() {
		return this.#speed;
	}

	//==============================================================================
	// 되풀이 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean | null } isLoop 되풀이하면 참. (null 이면 클립의 isLoop 를 따른다, 기본 null)
	 */
	setLoop(isLoop) {
		this.#isLoop = isLoop;
	}

	//==============================================================================
	// 되풀이 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 되풀이하면 참. (setLoop 로 정하지 않았으면 클립의 isLoop, 클립도 없으면 거짓)
	 */
	isLoop() {
		if (this.#isLoop !== null) {
			return this.#isLoop;
		}
		const clip = this.getClip();
		if (clip === null) {
			return false;
		}
		return clip.isLoop();
	}

	//==============================================================================
	// 한 바퀴 길이 반환.
	//==============================================================================
	/**
	 * @returns { number } 클립의 지속 시간. (초, 클립이 없으면 0)
	 */
	getDuration() {
		const clip = this.getClip();
		if (clip === null) {
			return 0;
		}
		return clip.getDuration();
	}

	//==============================================================================
	// 정규화 시간 반환.
	//==============================================================================
	/**
	 * @param { number } time 상태 시간. (초, 속도를 곱해 쌓은 것)
	 * @returns { number } 상태 시간을 한 바퀴 길이로 나눈 것. (1 이면 한 바퀴, 되풀이하면 1 을 넘어 쌓인다. 길이가 0 이면 시간이 흐르기 전 0, 흐른 뒤 1)
	 */
	getNormalizedTime(time) {
		const duration = this.getDuration();
		if (duration <= 0) {
			return time > 0 ? 1 : 0;
		}
		return time / duration;
	}

	//==============================================================================
	// 프레임 번호 반환.
	//==============================================================================
	/**
	 * @param { number } time 상태 시간. (초, 속도를 곱해 쌓은 것)
	 * @returns { number | null } 그 시간에 보일 클립 프레임의 번호. (0 부터, 되풀이하면 바퀴마다 처음부터, 아니면 끝 프레임에 머문다. 길이가 0 이면 0, 클립이나 프레임이 없으면 null)
	 */
	getFrameIndex(time) {
		const clip = this.getClip();
		if (clip === null) {
			return null;
		}
		const frameCount = clip.getFrameCount();
		if (frameCount === 0) {
			return null;
		}
		const duration = clip.getDuration();
		if (duration <= 0) {
			return 0;
		}
		const normalizedTime = time / duration;
		let cycleTime = 0;
		if (this.isLoop()) {
			cycleTime = normalizedTime - System.Math.floor(normalizedTime);
		}
		else {
			cycleTime = System.Math.min(System.Math.max(normalizedTime, 0), 1);
		}
		return System.Math.min(System.Math.floor(cycleTime * frameCount), frameCount - 1);
	}
}


//==============================================================================
// 애니메이션 전이. (조건이 맞으면 대상 상태로 넘어가는 상태 사이의 연결)
// - from 이 null 이면 어느 상태에서나(Any State) 넘어간다. to 가 null 이거나 상태 목록 밖이면 쓰지 않는다.
// - 종료 시각(exitTime)은 나가는 상태의 정규화 시간이다. 정해 두면 그 시각을 지나는 갱신에서만 넘어갈 수 있다.
//   되풀이하는 상태에서 1 보다 작은 종료 시각은 바퀴마다 본다. (0.5 면 1.5, 2.5 에서도) 그 밖은 한 번만 본다.
// - 조건은 모두 맞아야 한다. 종료 시각도 조건도 없는 전이는 쓰지 않는다.
// - 섞는 시간(duration, 초)이 0 보다 크면 그동안 두 상태가 함께 흐르며 가중치가 선형으로 옮겨 간다. (크로스페이드)
// - 어느 상태에서나 넘어가는 전이가 지금 상태로 가는 경우는 canTransitionToSelf 가 참일 때만 탄다. (기본 참, 다시 처음부터 튼다)
//==============================================================================
/**
 * @example <caption>걷기에서 달리기로 가는 전이</caption>
 * import { Animator, AnimationState, AnimationTransition, AnimationConditionMode } from "./build/vanilla.js";
 *
 * const animator = new Animator();
 * const walkIndex = animator.addState(new AnimationState());
 * const runIndex = animator.addState(new AnimationState());
 * const transition = new AnimationTransition();
 * transition.setFrom(walkIndex);
 * transition.setTo(runIndex);
 * transition.setDuration(0.2);
 * transition.addCondition("speed", AnimationConditionMode.greater, 3);
 * animator.addTransition(transition);
 * const conditions = transition.getConditions();
 * console.log(transition.getFrom(), transition.getTo(), transition.getExitTime(), conditions[0].mode);
 */
export class AnimationTransition extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number | null } */ #from; // 나가는 상태. (Animator 상태 목록의 번호, null 이면 어느 상태에서나)
	/** @private @type { number | null } */ #to; // 들어가는 상태. (Animator 상태 목록의 번호)
	/** @private @type { number | null } */ #exitTime; // 종료 시각. (나가는 상태의 정규화 시간, null 이면 없음)
	/** @private @type { number } */ #duration; // 섞는 시간. (초)
	/** @private @type { boolean } */ #canTransitionToSelf; // 어느 상태에서나 넘어가는 전이가 지금 상태로도 가는지.
	/** @private @type { { parameterName: string, mode: string, threshold: number }[] } */ #conditions; // 조건 목록.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.#from = null;
		this.#to = null;
		this.#exitTime = null;
		this.#duration = 0;
		this.#canTransitionToSelf = true;
		this.#conditions = [];
	}

	//==============================================================================
	// 나가는 상태 설정. (Animator.addState 가 돌려준 번호)
	//==============================================================================
	/**
	 * @param { number | null } from 나가는 상태의 번호. (null 이면 어느 상태에서나, 기본 null)
	 */
	setFrom(from) {
		this.#from = from;
	}

	//==============================================================================
	// 나가는 상태 반환.
	//==============================================================================
	/**
	 * @returns { number | null } 나가는 상태의 번호. 어느 상태에서나 넘어가면 null.
	 */
	getFrom() {
		return this.#from;
	}

	//==============================================================================
	// 들어가는 상태 설정. (Animator.addState 가 돌려준 번호)
	//==============================================================================
	/**
	 * @param { number | null } to 들어가는 상태의 번호. (null 이면 비우고, 빈 전이는 쓰지 않는다)
	 */
	setTo(to) {
		this.#to = to;
	}

	//==============================================================================
	// 들어가는 상태 반환.
	//==============================================================================
	/**
	 * @returns { number | null } 들어가는 상태의 번호. 정하지 않았으면 null.
	 */
	getTo() {
		return this.#to;
	}

	//==============================================================================
	// 종료 시각 설정.
	//==============================================================================
	/**
	 * @param { number | null } exitTime 나가는 상태의 정규화 시간. (1 이면 한 바퀴 끝, null 이면 종료 시각 없이 조건만 본다, 기본 null)
	 */
	setExitTime(exitTime) {
		this.#exitTime = exitTime;
	}

	//==============================================================================
	// 종료 시각 반환.
	//==============================================================================
	/**
	 * @returns { number | null } 종료 시각. (정규화 시간, 없으면 null)
	 */
	getExitTime() {
		return this.#exitTime;
	}

	//==============================================================================
	// 섞는 시간 설정.
	//==============================================================================
	/**
	 * @param { number } duration 두 상태를 섞는 시간. (초, 0 이하이면 바로 넘어간다, 기본 0)
	 */
	setDuration(duration) {
		this.#duration = duration;
	}

	//==============================================================================
	// 섞는 시간 반환.
	//==============================================================================
	/**
	 * @returns { number } 섞는 시간. (초)
	 */
	getDuration() {
		return this.#duration;
	}

	//==============================================================================
	// 지금 상태로 가는 것을 허락할지 설정.
	//==============================================================================
	/**
	 * @param { boolean } canTransitionToSelf 참이면 어느 상태에서나 넘어가는 전이가 지금 상태로도 간다. (기본 참, from 이 정해진 전이에는 쓰지 않는다)
	 */
	setCanTransitionToSelf(canTransitionToSelf) {
		this.#canTransitionToSelf = canTransitionToSelf;
	}

	//==============================================================================
	// 지금 상태로 가는 것을 허락하는지 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 어느 상태에서나 넘어가는 전이가 지금 상태로도 가면 참.
	 */
	canTransitionToSelf() {
		return this.#canTransitionToSelf;
	}

	//==============================================================================
	// 조건 추가.
	//==============================================================================
	/**
	 * @param { string } parameterName 견줄 매개변수 이름.
	 * @param { string } mode 견주는 법. (AnimationConditionMode 의 값)
	 * @param { number } threshold 기준 값. (greater, less, equals, notEqual 에서 쓴다, 기본 0)
	 */
	addCondition(parameterName, mode, threshold = 0) {
		this.#conditions.push({
			parameterName: parameterName,
			mode: mode,
			threshold: threshold
		});
	}

	//==============================================================================
	// 조건 목록 반환.
	//==============================================================================
	/**
	 * @returns { { parameterName: string, mode: string, threshold: number }[] } 넣은 차례의 조건 목록. (복사본이 아니다)
	 */
	getConditions() {
		return this.#conditions;
	}

	//==============================================================================
	// 종료 시각을 지났는지 반환.
	//==============================================================================
	/**
	 * @param { AnimationState } state 나가는 상태.
	 * @param { number } previousTime 이번 갱신 앞의 상태 시간. (초)
	 * @param { number } currentTime 이번 갱신 뒤의 상태 시간. (초)
	 * @returns { boolean } 종료 시각이 없거나, 이번 갱신에서 종료 시각을 지났으면 참. (길이가 0 인 상태는 들어온 뒤 첫 갱신에서 지난다)
	 */
	isExitTimeReached(state, previousTime, currentTime) {
		const exitTime = this.getExitTime();
		if (exitTime === null) {
			return true;
		}
		const duration = state.getDuration();
		if (duration <= 0) {
			return previousTime <= 0 && currentTime > 0;
		}
		const previousNormalizedTime = previousTime / duration;
		const currentNormalizedTime = currentTime / duration;
		if (currentNormalizedTime <= previousNormalizedTime) {
			return false;
		}

		// 되풀이하는 상태에서 1 보다 작은 종료 시각은 바퀴마다 본다.
		let crossingTime = exitTime;
		const isLoop = state.isLoop();
		if (isLoop && exitTime < 1) {
			crossingTime = exitTime + System.Math.max(0, System.Math.ceil(previousNormalizedTime - exitTime));
		}
		return previousNormalizedTime <= crossingTime && crossingTime < currentNormalizedTime;
	}
}


//==============================================================================
// 애니메이터. (상태 기계로 스프라이트 클립을 고르고 섞는다)
// - 처음 더한 상태에서 시작한다. play 로 아무 상태로나 바로 옮길 수 있다.
// - 매개변수는 실수(setFloat), 정수(setInteger), 참 거짓(setBool), 트리거(setTrigger) 넷이다. 같은 이름을 다른 종류로 넣으면 종류째 바꾼다.
//   트리거는 그 트리거를 조건으로 쓴 전이가 타면 풀린다. (resetTrigger 로 직접 풀 수도 있다)
// - tick 차례: 상태 시간을 흘린다(섞는 중이면 두 상태 모두) → 섞는 중이면 섞는 시간을 다 채웠을 때 다음 상태로 넘어간다
//   → 섞는 중이 아니면 어느 상태에서나 넘어가는 전이, 지금 상태에서 나가는 전이 차례로 넣은 순서대로 보고 처음 맞는 하나를 탄다.
//   섞는 동안에는 새 전이를 보지 않는다.
// - 섞는 중의 가중치: 다음 상태가 getTransitionWeight(섞은 시간 / 섞는 시간), 지금 상태가 1 - 그 값이다.
// - 고른 프레임은 getCurrentFrame, getNextFrame 으로 꺼낸다. (클립 프레임 목록의 것, Frame 이나 Rect)
//==============================================================================
/**
 * @example <caption>속도로 걷기와 달리기를 오가는 애니메이터</caption>
 * import { Animator, AnimationState, AnimationTransition, AnimationClip, AnimationConditionMode, Rect } from "./build/vanilla.js";
 *
 * const walkClip = new AnimationClip();
 * walkClip.setFrames([Rect.create(0, 0, 32, 32), Rect.create(32, 0, 32, 32)]);
 * walkClip.setDuration(1);
 * walkClip.setLoop(true);
 * const runClip = new AnimationClip();
 * runClip.setFrames([Rect.create(0, 32, 32, 32), Rect.create(32, 32, 32, 32)]);
 * runClip.setDuration(0.5);
 * runClip.setLoop(true);
 *
 * const animator = new Animator();
 * const walkState = new AnimationState();
 * walkState.setClip(walkClip);
 * const runState = new AnimationState();
 * runState.setClip(runClip);
 * const walkIndex = animator.addState(walkState);
 * const runIndex = animator.addState(runState);
 * const toRun = new AnimationTransition();
 * toRun.setFrom(walkIndex);
 * toRun.setTo(runIndex);
 * toRun.setDuration(0.25);
 * toRun.addCondition("speed", AnimationConditionMode.greater, 3);
 * animator.addTransition(toRun);
 * const toWalk = new AnimationTransition();
 * toWalk.setFrom(runIndex);
 * toWalk.setTo(walkIndex);
 * toWalk.addCondition("speed", AnimationConditionMode.less, 1);
 * animator.addTransition(toWalk);
 *
 * animator.setFloat("speed", 5);
 * animator.tick(0.125);
 * console.log(animator.getCurrentStateIndex(), animator.getNextStateIndex(), animator.getTransitionWeight());
 * animator.tick(0.125);
 * console.log(animator.getNextStateIndex(), animator.getTransitionWeight());
 * animator.tick(0.125);
 * const frame = animator.getCurrentFrame();
 * console.log(animator.getCurrentStateIndex(), animator.isInTransition(), frame.position.y);
 */
export class Animator extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { List<AnimationState> } */ #states; // 상태 목록.
	/** @private @type { List<AnimationTransition> } */ #transitions; // 전이 목록.
	/** @private @type { Dictionary<string, { type: string, value: number | boolean }> } */ #parameters; // 매개변수 목록. (type 은 float, int, bool, trigger)
	/** @private @type { number | null } */ #currentStateIndex; // 지금 상태. (상태가 없으면 null)
	/** @private @type { number } */ #currentTime; // 지금 상태 시간. (초, 속도를 곱해 쌓은 것)
	/** @private @type { number | null } */ #nextStateIndex; // 섞으며 들어가는 상태. (섞는 중이 아니면 null)
	/** @private @type { number } */ #nextTime; // 들어가는 상태 시간. (초)
	/** @private @type { number } */ #transitionElapsed; // 섞은 시간. (초)
	/** @private @type { number } */ #transitionDuration; // 섞는 시간. (초)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.#states = new List();
		this.#transitions = new List();
		this.#parameters = new Dictionary();
		this.#currentStateIndex = null;
		this.#currentTime = 0;
		this.#nextStateIndex = null;
		this.#nextTime = 0;
		this.#transitionElapsed = 0;
		this.#transitionDuration = 0;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초, 상태마다 속도를 곱해 흘린다)
	 */
	tick(timeDelta) {
		const currentStateIndex = this.getCurrentStateIndex();
		if (currentStateIndex === null) {
			return;
		}
		const states = this.getStates();
		const currentState = states.getAt(currentStateIndex);
		const nextStateIndex = this.getNextStateIndex();
		let previousTime = 0;
		if (nextStateIndex !== null) {
			// 섞는 중: 두 상태가 함께 흐르고, 섞는 시간을 다 채우면 들어가는 상태가 지금 상태가 된다.
			const nextState = states.getAt(nextStateIndex);
			this.#currentTime += timeDelta * currentState.getSpeed();
			previousTime = this.#nextTime;
			this.#nextTime += timeDelta * nextState.getSpeed();
			this.#transitionElapsed += timeDelta;
			if (this.#transitionElapsed < this.#transitionDuration) {
				return;
			}
			this.#currentStateIndex = nextStateIndex;
			this.#currentTime = this.#nextTime;
			this.#nextStateIndex = null;
			this.#nextTime = 0;
			this.#transitionElapsed = 0;
			this.#transitionDuration = 0;
		}
		else {
			previousTime = this.#currentTime;
			this.#currentTime += timeDelta * currentState.getSpeed();
		}

		// 탈 전이 찾기.
		const transitionIndex = this.findTransition(previousTime);
		if (transitionIndex !== null) {
			this.startTransition(transitionIndex);
		}
	}

	//==============================================================================
	// 상태 바로 틀기. (섞지 않고 처음부터)
	//==============================================================================
	/**
	 * @param { number } stateIndex 틀 상태의 번호. (Animator.addState 가 돌려준 것, 목록 밖이면 무시한다)
	 */
	play(stateIndex) {
		const states = this.getStates();
		const stateCount = states.getCount();
		if (!System.Number.isInteger(stateIndex) || stateIndex < 0 || stateIndex >= stateCount) {
			return;
		}
		this.#currentStateIndex = stateIndex;
		this.#currentTime = 0;
		this.#nextStateIndex = null;
		this.#nextTime = 0;
		this.#transitionElapsed = 0;
		this.#transitionDuration = 0;
	}

	//==============================================================================
	// 탈 전이 찾기.
	//==============================================================================
	/**
	 * @param { number } previousTime 이번 갱신 앞의 지금 상태 시간. (초, 종료 시각을 지났는지 볼 때 쓴다)
	 * @returns { number | null } 처음 맞는 전이의 번호. (어느 상태에서나 넘어가는 전이를 먼저, 그다음 지금 상태에서 나가는 전이를 넣은 순서대로 본다, 섞는 중이거나 없으면 null)
	 */
	findTransition(previousTime) {
		const currentStateIndex = this.getCurrentStateIndex();
		const nextStateIndex = this.getNextStateIndex();
		if (currentStateIndex === null || nextStateIndex !== null) {
			return null;
		}
		const states = this.getStates();
		const stateCount = states.getCount();
		const currentState = states.getAt(currentStateIndex);
		const transitions = this.getTransitions();
		const transitionCount = transitions.getCount();
		for (const isAnyStatePass of [true, false]) {
			for (let transitionIndex = 0; transitionIndex < transitionCount; ++transitionIndex) {
				const transition = transitions.getAt(transitionIndex);
				const from = transition.getFrom();
				const to = transition.getTo();
				if (to === null || to < 0 || to >= stateCount) {
					continue;
				}
				if (isAnyStatePass) {
					if (from !== null) {
						continue;
					}
					const canTransitionToSelf = transition.canTransitionToSelf();
					if (to === currentStateIndex && !canTransitionToSelf) {
						continue;
					}
				}
				else if (from !== currentStateIndex) {
					continue;
				}

				// 종료 시각도 조건도 없는 전이는 쓰지 않는다.
				const exitTime = transition.getExitTime();
				const conditions = transition.getConditions();
				if (exitTime === null && conditions.length === 0) {
					continue;
				}
				const isExitTimeReached = transition.isExitTimeReached(currentState, previousTime, this.#currentTime);
				if (!isExitTimeReached) {
					continue;
				}
				const isEveryConditionSatisfied = conditions.every((condition) => this.isConditionSatisfied(condition));
				if (isEveryConditionSatisfied) {
					return transitionIndex;
				}
			}
		}
		return null;
	}

	//==============================================================================
	// 전이 타기. (조건과 종료 시각은 보지 않는다)
	//==============================================================================
	/**
	 * @param { number } transitionIndex 탈 전이의 번호. (Animator.addTransition 이 돌려준 것, 목록 밖이거나 들어가는 상태가 목록 밖이면 무시한다)
	 */
	startTransition(transitionIndex) {
		const transitions = this.getTransitions();
		const transitionCount = transitions.getCount();
		if (!System.Number.isInteger(transitionIndex) || transitionIndex < 0 || transitionIndex >= transitionCount) {
			return;
		}
		const transition = transitions.getAt(transitionIndex);
		const to = transition.getTo();
		const states = this.getStates();
		const stateCount = states.getCount();
		if (to === null || to < 0 || to >= stateCount) {
			return;
		}

		// 조건으로 쓴 트리거는 탄 전이가 쓴 것으로 치고 푼다.
		const conditions = transition.getConditions();
		const parameters = this.getParameters();
		for (const condition of conditions) {
			const parameter = parameters.get(condition.parameterName);
			if (parameter !== undefined && parameter.type === "trigger") {
				parameter.value = false;
			}
		}

		const duration = transition.getDuration();
		if (duration > 0) {
			this.#nextStateIndex = to;
			this.#nextTime = 0;
			this.#transitionElapsed = 0;
			this.#transitionDuration = duration;
		}
		else {
			this.play(to);
		}
	}

	//==============================================================================
	// 조건이 맞는지 반환.
	//==============================================================================
	/**
	 * @param { { parameterName: string, mode: string, threshold: number } } condition 볼 조건. (AnimationTransition.getConditions 의 요소)
	 * @returns { boolean } 지금 매개변수로 조건이 맞으면 참. (매개변수가 없거나 견줄 수 없는 종류면 거짓)
	 */
	isConditionSatisfied(condition) {
		const parameters = this.getParameters();
		const parameter = parameters.get(condition.parameterName);
		if (parameter === undefined) {
			return false;
		}
		const isNumber = parameter.type === "float" || parameter.type === "int";
		switch (condition.mode) {
			case AnimationConditionMode.if: {
				return (parameter.type === "bool" || parameter.type === "trigger") && parameter.value === true;
			}
			case AnimationConditionMode.ifNot: {
				return parameter.type === "bool" && parameter.value === false;
			}
			case AnimationConditionMode.greater: {
				return isNumber && parameter.value > condition.threshold;
			}
			case AnimationConditionMode.less: {
				return isNumber && parameter.value < condition.threshold;
			}
			case AnimationConditionMode.equals: {
				return isNumber && parameter.value === condition.threshold;
			}
			case AnimationConditionMode.notEqual: {
				return isNumber && parameter.value !== condition.threshold;
			}
			default: {
				return false;
			}
		}
	}

	//==============================================================================
	// 실수 매개변수 설정.
	//==============================================================================
	/**
	 * @param { string } name 매개변수 이름.
	 * @param { number } value 값. (같은 이름이 있으면 종류째 바꾼다)
	 */
	setFloat(name, value) {
		this.#parameters.add(name, { type: "float", value: value });
	}

	//==============================================================================
	// 실수 매개변수 반환.
	//==============================================================================
	/**
	 * @param { string } name 매개변수 이름.
	 * @returns { number } 값. (없거나 실수가 아니면 0)
	 */
	getFloat(name) {
		const parameters = this.getParameters();
		const parameter = parameters.get(name);
		if (parameter === undefined || parameter.type !== "float") {
			return 0;
		}
		return parameter.value;
	}

	//==============================================================================
	// 정수 매개변수 설정.
	//==============================================================================
	/**
	 * @param { string } name 매개변수 이름.
	 * @param { number } value 값. (소수점 아래는 버린다, 같은 이름이 있으면 종류째 바꾼다)
	 */
	setInteger(name, value) {
		this.#parameters.add(name, { type: "int", value: System.Math.trunc(value) });
	}

	//==============================================================================
	// 정수 매개변수 반환.
	//==============================================================================
	/**
	 * @param { string } name 매개변수 이름.
	 * @returns { number } 값. (없거나 정수가 아니면 0)
	 */
	getInteger(name) {
		const parameters = this.getParameters();
		const parameter = parameters.get(name);
		if (parameter === undefined || parameter.type !== "int") {
			return 0;
		}
		return parameter.value;
	}

	//==============================================================================
	// 참 거짓 매개변수 설정.
	//==============================================================================
	/**
	 * @param { string } name 매개변수 이름.
	 * @param { boolean } value 값. (같은 이름이 있으면 종류째 바꾼다)
	 */
	setBool(name, value) {
		this.#parameters.add(name, { type: "bool", value: value === true });
	}

	//==============================================================================
	// 참 거짓 매개변수 반환.
	//==============================================================================
	/**
	 * @param { string } name 매개변수 이름.
	 * @returns { boolean } 값. (없거나 참 거짓이 아니면 거짓)
	 */
	getBool(name) {
		const parameters = this.getParameters();
		const parameter = parameters.get(name);
		if (parameter === undefined || parameter.type !== "bool") {
			return false;
		}
		return parameter.value;
	}

	//==============================================================================
	// 트리거 걸기. (그 트리거를 조건으로 쓴 전이가 타면 풀린다)
	//==============================================================================
	/**
	 * @param { string } name 매개변수 이름. (같은 이름이 있으면 종류째 바꾼다)
	 */
	setTrigger(name) {
		this.#parameters.add(name, { type: "trigger", value: true });
	}

	//==============================================================================
	// 트리거 풀기.
	//==============================================================================
	/**
	 * @param { string } name 매개변수 이름. (같은 이름이 있으면 종류째 바꾼다)
	 */
	resetTrigger(name) {
		this.#parameters.add(name, { type: "trigger", value: false });
	}

	//==============================================================================
	// 트리거가 걸려 있는지 반환.
	//==============================================================================
	/**
	 * @param { string } name 매개변수 이름.
	 * @returns { boolean } 걸려 있으면 참. (없거나 트리거가 아니면 거짓)
	 */
	getTrigger(name) {
		const parameters = this.getParameters();
		const parameter = parameters.get(name);
		if (parameter === undefined || parameter.type !== "trigger") {
			return false;
		}
		return parameter.value;
	}

	//==============================================================================
	// 모든 매개변수 반환.
	//==============================================================================
	/**
	 * @returns { Dictionary<string, { type: string, value: number | boolean }> } 매개변수 이름과 종류, 값의 딕셔너리. (type 은 float, int, bool, trigger, 복사본이 아니다)
	 */
	getParameters() {
		return this.#parameters;
	}

	//==============================================================================
	// 상태 추가. (상태 목록의 번호를 돌려준다, 처음 더한 상태에서 시작한다)
	//==============================================================================
	/**
	 * @param { AnimationState } state 더할 상태.
	 * @returns { number } 더한 상태의 번호. (0 부터)
	 */
	addState(state) {
		this.#states.add(state);
		const stateIndex = this.#states.getCount() - 1;
		const currentStateIndex = this.getCurrentStateIndex();
		if (currentStateIndex === null) {
			this.play(stateIndex);
		}
		return stateIndex;
	}

	//==============================================================================
	// 상태 목록 반환.
	//==============================================================================
	/**
	 * @returns { List<AnimationState> } 상태 목록. (복사본이 아니다)
	 */
	getStates() {
		return this.#states;
	}

	//==============================================================================
	// 전이 추가. (전이 목록의 번호를 돌려준다)
	//==============================================================================
	/**
	 * @param { AnimationTransition } transition 더할 전이.
	 * @returns { number } 더한 전이의 번호. (0 부터)
	 */
	addTransition(transition) {
		this.#transitions.add(transition);
		return this.#transitions.getCount() - 1;
	}

	//==============================================================================
	// 전이 목록 반환.
	//==============================================================================
	/**
	 * @returns { List<AnimationTransition> } 전이 목록. (복사본이 아니다)
	 */
	getTransitions() {
		return this.#transitions;
	}

	//==============================================================================
	// 지금 상태 반환.
	//==============================================================================
	/**
	 * @returns { number | null } 지금 상태의 번호. (섞는 중이면 나가는 상태, 상태가 없으면 null)
	 */
	getCurrentStateIndex() {
		return this.#currentStateIndex;
	}

	//==============================================================================
	// 지금 상태의 정규화 시간 반환.
	//==============================================================================
	/**
	 * @returns { number } 지금 상태 시간을 한 바퀴 길이로 나눈 것. (상태가 없으면 0)
	 */
	getCurrentNormalizedTime() {
		const currentStateIndex = this.getCurrentStateIndex();
		if (currentStateIndex === null) {
			return 0;
		}
		const states = this.getStates();
		const currentState = states.getAt(currentStateIndex);
		return currentState.getNormalizedTime(this.#currentTime);
	}

	//==============================================================================
	// 지금 상태의 프레임 반환.
	//==============================================================================
	/**
	 * @returns { Frame | Rect | null } 지금 상태 시간에 보일 클립 프레임. (클립 프레임 목록의 것, 상태나 클립이나 프레임이 없으면 null)
	 */
	getCurrentFrame() {
		const currentStateIndex = this.getCurrentStateIndex();
		if (currentStateIndex === null) {
			return null;
		}
		const states = this.getStates();
		const currentState = states.getAt(currentStateIndex);
		const frameIndex = currentState.getFrameIndex(this.#currentTime);
		if (frameIndex === null) {
			return null;
		}
		const clip = currentState.getClip();
		return clip.getFrame(frameIndex);
	}

	//==============================================================================
	// 섞는 중인지 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 두 상태를 섞는 중이면 참.
	 */
	isInTransition() {
		const nextStateIndex = this.getNextStateIndex();
		return nextStateIndex !== null;
	}

	//==============================================================================
	// 섞으며 들어가는 상태 반환.
	//==============================================================================
	/**
	 * @returns { number | null } 들어가는 상태의 번호. (섞는 중이 아니면 null)
	 */
	getNextStateIndex() {
		return this.#nextStateIndex;
	}

	//==============================================================================
	// 들어가는 상태의 정규화 시간 반환.
	//==============================================================================
	/**
	 * @returns { number } 들어가는 상태 시간을 한 바퀴 길이로 나눈 것. (섞는 중이 아니면 0)
	 */
	getNextNormalizedTime() {
		const nextStateIndex = this.getNextStateIndex();
		if (nextStateIndex === null) {
			return 0;
		}
		const states = this.getStates();
		const nextState = states.getAt(nextStateIndex);
		return nextState.getNormalizedTime(this.#nextTime);
	}

	//==============================================================================
	// 들어가는 상태의 프레임 반환.
	//==============================================================================
	/**
	 * @returns { Frame | Rect | null } 들어가는 상태 시간에 보일 클립 프레임. (섞는 중이 아니거나 클립이나 프레임이 없으면 null)
	 */
	getNextFrame() {
		const nextStateIndex = this.getNextStateIndex();
		if (nextStateIndex === null) {
			return null;
		}
		const states = this.getStates();
		const nextState = states.getAt(nextStateIndex);
		const frameIndex = nextState.getFrameIndex(this.#nextTime);
		if (frameIndex === null) {
			return null;
		}
		const clip = nextState.getClip();
		return clip.getFrame(frameIndex);
	}

	//==============================================================================
	// 들어가는 상태의 가중치 반환. (크로스페이드)
	//==============================================================================
	/**
	 * @returns { number } 섞은 시간 / 섞는 시간. (0 ~ 1, 지금 상태의 가중치는 1 - 이 값, 섞는 중이 아니면 0)
	 */
	getTransitionWeight() {
		const nextStateIndex = this.getNextStateIndex();
		if (nextStateIndex === null || this.#transitionDuration <= 0) {
			return 0;
		}
		return System.Math.min(System.Math.max(this.#transitionElapsed / this.#transitionDuration, 0), 1);
	}
}
