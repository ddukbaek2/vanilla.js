//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "./object.js";
import * as Math from "./math.js";



//==============================================================================
// 유한 상태 처리기.
//==============================================================================
/**
 * @template T
 */
export class FiniteStateMachine extends Object {
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    /** @private @type { number } */ #stateTimer;
    /** @private @type { T | undefined } */ #state;
    /** @private @type { (previous: T, next: T) => void } */ #transitionEvent;
    /** @private @type { (state: T) => void } */ #stateEvent;

    //==============================================================================
    // 생성.
    //==============================================================================
    /**
     * @constructor
     */
    constructor() {
        super();
        this.#state = undefined;
        this.#stateTimer = 0;
        this.#transitionEvent = undefined;
        this.#stateEvent = undefined;
    }

    //==============================================================================
    // 갱신.
    //==============================================================================
    /**
     * @virtual
     * @param { number } timeDelta 
     */
    tick(timeDelta) {
        this.#stateTimer += timeDelta;

        const state = this.getState();
        switch (state) {
            case undefined: {
                break;
            }
        }
    }
 
    //==============================================================================
    // 상태 전이 이벤트 설정.
    //==============================================================================
    /**
     * @param { (previous: T, next: T) => void } transitionEvent
     */
    setTransitionEvent(transitionEvent) {
        this.#transitionEvent = transitionEvent;
    }
 
    //==============================================================================
    // 상태 이벤트 설정.
    //==============================================================================
    /**
     * @param { (state: T) => void } stateEvent
     */
    setTransitionEvent(stateEvent) {
        this.#stateEvent = stateEvent;
    }

    //==============================================================================
    // 상태 설정.
    //==============================================================================
    /**
     * @param { T | undefined } state 
     */
    setState(state) {
        const previous = this.getState();
        const next = state;
        if (previous !== next) {
            if (this.#transitionEvent) {
                this.#transitionEvent(previous, next);
            }
            this.#state = state;
            this.#stateTimer = 0;
            if (this.#stateEvent) {
                this.#stateEvent(next);
            }
        }
    }

    //==============================================================================
    // 상태 반환.
    //==============================================================================
    /**
     * @returns { T | undefined } 
     */
    getState() {
        return this.#state;
    }
}