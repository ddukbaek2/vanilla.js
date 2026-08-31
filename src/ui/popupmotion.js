//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";


//==============================================================================
// 팝업 등장 / 퇴장 전환기.
// - closed → opening → open → closing → closed 네 상태를 오가며
//   배율(등장: 0.45 → 1.18 되튕김 → 1, 퇴장: 1 → 1.08 → 0.08)과
//   어둡게 가리는 비율(dimRatio)을 산출한다. (여러 게임이 복붙하던 연출)
// - 렌더 방식과 무관하다. 매 프레임 tick(dt) 후 getScale() / getDimRatio() 를 읽어
//   노드 배율 / 막 알파에 적용한다. setInstantEnabled(true) 면 연출 없이 즉시 전환한다.
//==============================================================================
export const PopupMotionState = {
	closed: "closed",
	opening: "opening",
	open: "open",
	closing: "closing",
};

export class PopupMotion extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { string } */ #state;
	/** @private @type { number } */ #elapsedSeconds;
	/** @private @type { number } */ #openDuration;
	/** @private @type { number } */ #closeDuration;
	/** @private @type { boolean } */ #isInstantEnabled;
	/** @private @type { Function | null } */ #openedEvent;
	/** @private @type { Function | null } */ #closedEvent;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { object } options { openDuration = 0.32, closeDuration = 0.22 }
	 */
	constructor(options = {}) {
		super();
		this.#state = PopupMotionState.closed;
		this.#elapsedSeconds = 0;
		this.#openDuration = (options.openDuration !== undefined) ? options.openDuration : 0.32;
		this.#closeDuration = (options.closeDuration !== undefined) ? options.closeDuration : 0.22;
		this.#isInstantEnabled = false;
		this.#openedEvent = null;
		this.#closedEvent = null;
	}

	//==============================================================================
	// 열기.
	//==============================================================================
	open() {
		if (this.#state === PopupMotionState.open || this.#state === PopupMotionState.opening) {
			return;
		}
		if (this.#isInstantEnabled) {
			this.#state = PopupMotionState.open;
			if (this.#openedEvent) {
				this.#openedEvent();
			}
			return;
		}
		this.#state = PopupMotionState.opening;
		this.#elapsedSeconds = 0;
	}

	//==============================================================================
	// 닫기.
	//==============================================================================
	close() {
		if (this.#state === PopupMotionState.closed || this.#state === PopupMotionState.closing) {
			return;
		}
		if (this.#isInstantEnabled) {
			this.#state = PopupMotionState.closed;
			if (this.#closedEvent) {
				this.#closedEvent();
			}
			return;
		}
		this.#state = PopupMotionState.closing;
		this.#elapsedSeconds = 0;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		if (this.#state === PopupMotionState.opening) {
			this.#elapsedSeconds += timeDelta;
			if (this.#elapsedSeconds >= this.#openDuration) {
				this.#state = PopupMotionState.open;
				if (this.#openedEvent) {
					this.#openedEvent();
				}
			}
		}
		else if (this.#state === PopupMotionState.closing) {
			this.#elapsedSeconds += timeDelta;
			if (this.#elapsedSeconds >= this.#closeDuration) {
				this.#state = PopupMotionState.closed;
				if (this.#closedEvent) {
					this.#closedEvent();
				}
			}
		}
	}

	//==============================================================================
	// 현재 배율 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getScale() {
		if (this.#state === PopupMotionState.open) {
			return 1;
		}
		if (this.#state === PopupMotionState.closed) {
			return 0;
		}
		if (this.#state === PopupMotionState.opening) {

			// 0.45 에서 시작해 1.18 로 부풀었다가 1 로 자리 잡는 되튕김.
			const ratio = System.Math.min(1, this.#elapsedSeconds / this.#openDuration);
			const smooth = ratio * ratio * (3 - 2 * ratio);
			if (smooth < 0.72) {
				return 0.45 + (1.18 - 0.45) * (smooth / 0.72);
			}
			return 1.18 - (1.18 - 1) * ((smooth - 0.72) / 0.28);
		}

		// closing: 1 → 1.08 로 살짝 부풀었다가 0.08 로 수축.
		const ratio = System.Math.min(1, this.#elapsedSeconds / this.#closeDuration);
		if (ratio < 0.25) {
			return 1 + (1.08 - 1) * (ratio / 0.25);
		}
		const shrinkRatio = (ratio - 0.25) / 0.75;
		const eased = shrinkRatio * shrinkRatio * shrinkRatio;
		return 1.08 - (1.08 - 0.08) * eased;
	}

	//==============================================================================
	// 어둡게 가리는 비율 반환. (0 ~ 1)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getDimRatio() {
		if (this.#state === PopupMotionState.open) {
			return 1;
		}
		if (this.#state === PopupMotionState.closed) {
			return 0;
		}
		if (this.#state === PopupMotionState.opening) {
			return System.Math.min(1, this.#elapsedSeconds / this.#openDuration);
		}
		return 1 - System.Math.min(1, this.#elapsedSeconds / this.#closeDuration);
	}

	//==============================================================================
	// 조작 가능 여부. (완전히 열린 뒤에만 참)
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isInteractive() {
		return this.#state === PopupMotionState.open;
	}

	//==============================================================================
	// 상태 조회.
	//==============================================================================
	/** @returns { string } */
	getState() {
		return this.#state;
	}

	/** @returns { boolean } */
	isVisible() {
		return this.#state !== PopupMotionState.closed;
	}

	//==============================================================================
	// 즉시 전환 여부 설정. (연출 없는 UI 톤)
	//==============================================================================
	/**
	 * @param { boolean } isInstantEnabled
	 */
	setInstantEnabled(isInstantEnabled) {
		this.#isInstantEnabled = isInstantEnabled;
	}

	//==============================================================================
	// 알림 설정.
	//==============================================================================
	/** @param { Function } openedEvent */
	setOpenedEvent(openedEvent) {
		this.#openedEvent = openedEvent;
	}

	/** @param { Function } closedEvent */
	setClosedEvent(closedEvent) {
		this.#closedEvent = closedEvent;
	}
}
