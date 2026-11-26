//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";
import { List } from "../collection/list.js";
import { Dictionary } from "../collection/dictionary.js";
import { Frame } from "../../core/frame.js";
import { Animation } from "../../core/animation.js";
import { AnimationClip } from "../../resource/animationclip.js";


//==============================================================================
// 애니메이션 상태.
//==============================================================================
/**
 * @example <caption>상태에 클립 달기</caption>
 * import { AnimationState, AnimationClip } from "./build/vanilla.js";
 *
 * const clip = new AnimationClip();
 * clip.setLoop(false);
 * const state = new AnimationState();
 * state.setClip(clip);
 * const stateClip = state.getClip();
 * console.log(stateClip.isLoop());
 */
export class AnimationState extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { AnimationClip } */ #clip; // 클립.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.#clip = null;
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
}


//==============================================================================
// 애니메이션 전환. (조건이 만족되면 대상 상태를 실행하는 애니메이션 노드 간 연결)
//==============================================================================
/**
 * @example <caption>두 상태를 잇는 전환</caption>
 * import { Animator, AnimationState, AnimationTransition } from "./build/vanilla.js";
 *
 * const animator = new Animator();
 * const idleState = new AnimationState();
 * const runState = new AnimationState();
 * const idleIndex = animator.addState(idleState);
 * const runIndex = animator.addState(runState);
 * const transition = new AnimationTransition();
 * transition.setFrom(idleIndex);
 * transition.setTo(runIndex);
 * console.log(transition.getFrom(), transition.getTo());
 */
export class AnimationTransition extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number | null } */ #from; // 나가는 상태. (Animator 상태 목록의 번호)
	/** @private @type { number | null } */ #to; // 들어가는 상태. (Animator 상태 목록의 번호)

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
	}

	//==============================================================================
	// 나가는 상태 설정. (Animator.addState 가 돌려준 번호)
	//==============================================================================
	/**
	 * @param { number | null } from 나가는 상태의 번호. (null 이면 비운다)
	 */
	setFrom(from) {
		this.#from = from;
	}

	//==============================================================================
	// 나가는 상태 반환.
	//==============================================================================
	/**
	 * @returns { number | null } 나가는 상태의 번호. 정하지 않았으면 null.
	 */
	getFrom() {
		return this.#from;
	}

	//==============================================================================
	// 들어가는 상태 설정. (Animator.addState 가 돌려준 번호)
	//==============================================================================
	/**
	 * @param { number | null } to 들어가는 상태의 번호. (null 이면 비운다)
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
}


//==============================================================================
// 애니메이터.
//==============================================================================
/**
 * @example <caption>상태, 전환, 프로퍼티 담기</caption>
 * import { Animator, AnimationState, AnimationTransition, AnimationClip } from "./build/vanilla.js";
 *
 * const animator = new Animator();
 * const idleClip = new AnimationClip();
 * const runClip = new AnimationClip();
 * const idleState = new AnimationState();
 * idleState.setClip(idleClip);
 * const runState = new AnimationState();
 * runState.setClip(runClip);
 * const idleIndex = animator.addState(idleState);
 * const runIndex = animator.addState(runState);
 * const transition = new AnimationTransition();
 * transition.setFrom(idleIndex);
 * transition.setTo(runIndex);
 * animator.addTransition(transition);
 * animator.setProperty("speed", 2);
 * animator.tick(1 / 60);
 * const states = animator.getStates();
 * console.log(states.getCount(), animator.getProperty("speed"));
 */
export class Animator extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Animation } */ #animation; // 처리기.
	/** @private @type { List<AnimationState> } */ #states; // 상태 목록.
	/** @private @type { List<AnimationTransition> } */ #transitions; // 전환 목록.
	/** @private @type { Dictionary<string, System.Object> } */ #properties; // 애니메이터 프로퍼티 목록.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.#animation = new Animation();
		this.#states = new List();
		this.#transitions = new List();
		this.#properties = new Dictionary();
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 */
	tick(timeDelta) {
		this.#animation.tick(timeDelta);
	}

	//==============================================================================
	// 프로퍼티 설정.
	//==============================================================================
	/**
	 * @param { string } name 프로퍼티 이름.
	 * @param { System.Object } value 값. (같은 이름이 있으면 덮어쓴다)
	 */
	setProperty(name, value) {
		this.#properties.add(name, value);
	}

	//==============================================================================
	// 프로퍼티 반환.
	//==============================================================================
	/**
	 * @param { string } name 프로퍼티 이름.
	 * @returns { System.Object } 그 이름의 값. 없으면 undefined.
	 */
	getProperty(name) {
		const value = this.#properties.get(name);
		return value;
	}

	//==============================================================================
	// 모든 프로퍼티 반환.
	//==============================================================================
	/**
	 * @returns { Dictionary<string, System.Object> } 프로퍼티 이름과 값의 딕셔너리. (복사본이 아니다)
	 */
	getProperties() {
		return this.#properties;
	}

	//==============================================================================
	// 처리기 반환.
	//==============================================================================
	/**
	 * @returns { Animation } tick 이 갱신하는 Animation.
	 */
	getAnimation() {
		return this.#animation;
	}

	//==============================================================================
	// 상태 추가. (상태 목록의 번호를 돌려준다)
	//==============================================================================
	/**
	 * @param { AnimationState } state 더할 상태.
	 * @returns { number } 더한 상태의 번호. (0 부터)
	 */
	addState(state) {
		this.#states.add(state);
		return this.#states.getCount() - 1;
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
	// 전환 추가. (전환 목록의 번호를 돌려준다)
	//==============================================================================
	/**
	 * @param { AnimationTransition } transition 더할 전환.
	 * @returns { number } 더한 전환의 번호. (0 부터)
	 */
	addTransition(transition) {
		this.#transitions.add(transition);
		return this.#transitions.getCount() - 1;
	}

	//==============================================================================
	// 전환 목록 반환.
	//==============================================================================
	/**
	 * @returns { List<AnimationTransition> } 전환 목록. (복사본이 아니다)
	 */
	getTransitions() {
		return this.#transitions;
	}
}