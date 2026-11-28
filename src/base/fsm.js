//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "./object.js";


//==============================================================================
// 유한 상태 기계.
// - 여러 게임이 "문자열 상태 + switch 문 + 수동 전이" 를 제각각 만들던 것을 표준화했다.
// - 상태마다 enter / tick / exit 처리를 등록하고 changeState() 로 전이한다.
// - setTransitionGuard() 로 허용되지 않은 전이를 막을 수 있다.
//==============================================================================
/**
 * @example <caption>상태 등록하고 갱신하며 전이하기</caption>
 * import { FiniteStateMachine } from "./build/vanilla.js";
 *
 * const stateMachine = new FiniteStateMachine();
 * stateMachine.addState("idle", {
 * 	enter: (previousStateName) => {
 * 		console.log("enter idle from", previousStateName);
 * 	},
 * });
 * stateMachine.addState("attack", {
 * 	tick: (timeDelta, stateSeconds) => {
 * 		if (stateSeconds >= 1) {
 * 			stateMachine.changeState("idle");
 * 		}
 * 	},
 * 	exit: (nextStateName) => {
 * 		console.log("exit attack to", nextStateName);
 * 	},
 * });
 * stateMachine.changeState("idle");
 * stateMachine.changeState("attack");
 * stateMachine.tick(0.5);
 * console.log(stateMachine.getStateName(), stateMachine.getStateSeconds());
 * stateMachine.tick(0.5);
 * console.log(stateMachine.getStateName());
 */
export class FiniteStateMachine extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Map } */ #stateTable;
	/** @private @type { string | null } */ #stateName;
	/** @private @type { number } */ #stateSeconds;
	/** @private @type { Function | null } */ #transitionGuard;
	/** @private @type { Function | null } */ #transitionEvent;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();

		this.#stateTable = new System.Map();
		this.#stateName = null;
		this.#stateSeconds = 0;
		this.#transitionGuard = null;
		this.#transitionEvent = null;
	}

	//==============================================================================
	// 상태 등록.
	// - handlers: { enter?, tick?, exit? }
	//   enter(previousStateName), tick(timeDelta, stateSeconds), exit(nextStateName)
	//==============================================================================
	/**
	 * @param { string } stateName 상태 이름. (이미 있으면 처리 함수를 바꿔 넣는다)
	 * @param { object } handlers { enter, tick, exit } 처리 함수. (모두 생략할 수 있다, 기본 {})
	 */
	addState(stateName, handlers = {}) {
		this.#stateTable.set(stateName, {
			enter: handlers.enter ? handlers.enter : null,
			tick: handlers.tick ? handlers.tick : null,
			exit: handlers.exit ? handlers.exit : null,
		});
	}

	//==============================================================================
	// 상태 전이.
	// - 같은 상태로의 전이는 기본적으로 무시한다. (isForced 가 참이면 exit / enter 를 다시 부른다)
	// - 전이 가드가 거짓을 반환하면 전이하지 않는다.
	//==============================================================================
	/**
	 * @param { string } nextStateName 옮겨 갈 상태 이름. (등록하지 않은 이름이면 전이하지 않는다)
	 * @param { boolean } isForced 참이면 같은 상태로도 다시 전이한다. (기본 false, 전이 가드는 그대로 본다)
	 * @returns { boolean } 전이 성공 여부.
	 */
	changeState(nextStateName, isForced = false) {
		if (!this.#stateTable.has(nextStateName)) {
			return false;
		}
		const previousStateName = this.#stateName;
		if (previousStateName === nextStateName && !isForced) {
			return false;
		}
		if (this.#transitionGuard && !this.#transitionGuard(previousStateName, nextStateName)) {
			return false;
		}

		if (previousStateName !== null) {
			const previousState = this.#stateTable.get(previousStateName);
			if (previousState && previousState.exit) {
				previousState.exit(nextStateName);
			}
		}

		this.#stateName = nextStateName;
		this.#stateSeconds = 0;

		if (this.#transitionEvent) {
			this.#transitionEvent(previousStateName, nextStateName);
		}

		const nextState = this.#stateTable.get(nextStateName);
		if (nextState.enter) {
			nextState.enter(previousStateName);
		}
		return true;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta 지난 프레임과의 간격. (초, 상태에 머문 시간에 더하고 현재 상태의 tick 에 넘긴다)
	 */
	tick(timeDelta) {
		if (this.#stateName === null) {
			return;
		}
		this.#stateSeconds += timeDelta;
		const currentState = this.#stateTable.get(this.#stateName);
		if (currentState && currentState.tick) {
			currentState.tick(timeDelta, this.#stateSeconds);
		}
	}

	//==============================================================================
	// 현재 상태 이름 반환.
	//==============================================================================
	/**
	 * @returns { string | null } 현재 상태 이름. (아직 전이하지 않았으면 null)
	 */
	getStateName() {
		return this.#stateName;
	}

	//==============================================================================
	// 현재 상태에 머문 시간 반환. (초)
	//==============================================================================
	/**
	 * @returns { number } 현재 상태에 머문 시간. (초, 전이할 때 0 으로 돌아간다)
	 */
	getStateSeconds() {
		return this.#stateSeconds;
	}

	//==============================================================================
	// 상태 존재 여부.
	//==============================================================================
	/**
	 * @param { string } stateName 찾을 상태 이름.
	 * @returns { boolean } 등록한 상태이면 참.
	 */
	hasState(stateName) {
		return this.#stateTable.has(stateName);
	}

	//==============================================================================
	// 전이 가드 설정. (previous, next) => boolean
	//==============================================================================
	/**
	 * @param { Function } transitionGuard (previousStateName, nextStateName) => boolean. (거짓을 돌려주면 전이하지 않는다, null 이면 가드 없음)
	 * @example <caption>쓰러진 뒤로는 전이 막기</caption>
	 * import { FiniteStateMachine } from "./build/vanilla.js";
	 *
	 * const stateMachine = new FiniteStateMachine();
	 * stateMachine.addState("alive");
	 * stateMachine.addState("dead");
	 * stateMachine.setTransitionGuard((previousStateName, nextStateName) => {
	 * 	if (previousStateName === "dead") {
	 * 		return false;
	 * 	}
	 * 	return true;
	 * });
	 * stateMachine.changeState("alive");
	 * stateMachine.changeState("dead");
	 * const isChanged = stateMachine.changeState("alive");
	 * console.log(isChanged, stateMachine.getStateName());
	 */
	setTransitionGuard(transitionGuard) {
		this.#transitionGuard = transitionGuard;
	}

	//==============================================================================
	// 전이 알림 설정. (previous, next) => void, exit 뒤, enter 앞에 불린다.
	//==============================================================================
	/**
	 * @param { Function } transitionEvent (previousStateName, nextStateName) => void. (null 이면 부르지 않는다)
	 */
	setTransitionEvent(transitionEvent) {
		this.#transitionEvent = transitionEvent;
	}
}
