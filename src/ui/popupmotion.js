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
	closed: "closed", // 닫힘. (배율 0, 가림 0)
	opening: "opening", // 여는 중. (배율이 0.45 에서 1.18 로 부풀었다가 1 로)
	open: "open", // 열림. (배율 1, 가림 1, 이때만 조작할 수 있다)
	closing: "closing", // 닫는 중. (배율이 1.08 로 부풀었다가 0.08 로)
};

/**
 * @example <caption>판의 배율과 막의 알파에 걸기</caption>
 * import { PopupMotion, PopupMotionState, WorldNode, Paint, Color, Vector2 } from "./build/vanilla.js";
 *
 * const panelNode = new WorldNode();
 * const dimNode = new WorldNode();
 * const dimPaint = dimNode.addComponent(Paint);
 * const popupMotion = new PopupMotion({ openDuration: 0.3, closeDuration: 0.2 });
 * popupMotion.setOpenedEvent(() => {
 * 	console.log("opened");
 * });
 * popupMotion.setClosedEvent(() => {
 * 	console.log("closed");
 * });
 * const applyMotion = () => {
 * 	const scale = popupMotion.getScale();
 * 	const dimRatio = popupMotion.getDimRatio();
 * 	panelNode.setLocalScale(Vector2.create(scale, scale));
 * 	dimPaint.setColor(new Color(0, 0, 0, 0.5 * dimRatio));
 * };
 * popupMotion.open();
 * for (let frameIndex = 0; frameIndex < 30; ++frameIndex) {
 * 	popupMotion.tick(1 / 60);
 * 	applyMotion();
 * }
 * const state = popupMotion.getState();
 * console.log(state === PopupMotionState.open);
 * popupMotion.close();
 * for (let frameIndex = 0; frameIndex < 30; ++frameIndex) {
 * 	popupMotion.tick(1 / 60);
 * 	applyMotion();
 * }
 */
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
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
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
	 * @returns { number } 판에 걸 배율. (닫힘 0, 열림 1, 여닫는 중에는 되튕김 곡선)
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
	 * @returns { number } 가리는 비율. (0 ~ 1, 여닫는 시간에 곧게 비례)
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
	 * @returns { boolean } 열림 상태면 참.
	 */
	isInteractive() {
		return this.#state === PopupMotionState.open;
	}

	//==============================================================================
	// 상태 조회.
	//==============================================================================
	/** @returns { string } 상태. (PopupMotionState 의 값) */
	getState() {
		return this.#state;
	}

	//==============================================================================
	// 보이는지 반환. (닫힘이 아니면 참)
	//==============================================================================
	/** @returns { boolean } 닫힘 상태가 아니면 참. */
	isVisible() {
		return this.#state !== PopupMotionState.closed;
	}

	//==============================================================================
	// 즉시 전환 여부 설정. (연출 없는 UI 톤)
	//==============================================================================
	/**
	 * @param { boolean } isInstantEnabled 참이면 open, close 가 곧바로 열림, 닫힘이 되고 알림도 그 자리에서 부른다.
	 */
	setInstantEnabled(isInstantEnabled) {
		this.#isInstantEnabled = isInstantEnabled;
	}

	//==============================================================================
	// 움직임 없이 바로 열고 닫는지.
	//==============================================================================
	/**
	 * @returns { boolean } 바로 열고 닫으면 참.
	 */
	isInstantEnabled() {
		return this.#isInstantEnabled;
	}

	//==============================================================================
	// 알림 설정.
	//==============================================================================
	/** @param { Function } openedEvent 다 열렸을 때 부를 함수. (인자 없음) */
	setOpenedEvent(openedEvent) {
		this.#openedEvent = openedEvent;
	}

	//==============================================================================
	// 다 닫혔을 때 알림 설정.
	//==============================================================================
	/** @param { Function } closedEvent 다 닫혔을 때 부를 함수. (인자 없음) */
	setClosedEvent(closedEvent) {
		this.#closedEvent = closedEvent;
	}
}
