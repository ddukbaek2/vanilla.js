//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../base/vector2.js";
import { Component } from "../core/component.js";

// 나옴: 바깥쪽에서 미끄러져 들어오는 거리, 투명에서 보이기까지와 커졌다 돌아오는 초, 크기.
const ENTER_DISTANCE = 10;
const ENTER_SECONDS = 0.18;
const ENTER_SETTLE_SECONDS = 0.08;
const ENTER_START_SCALE = 0.94;
const ENTER_PEAK_SCALE = 1.02;
// 사라짐: 떠오르는 거리와 초, 새 알림에 비킬 때의 초.
const EXIT_DISTANCE = 8;
const EXIT_SECONDS = 0.25;
const QUICK_EXIT_SECONDS = 0.12;
// 같은 글이 또 오면 통 튀는 크기와 초.
const REPEAT_SCALE = 1.05;
const REPEAT_SECONDS = 0.15;
// 머무는 시간: 글이 이 글자 수를 넘으면 그만큼마다 더하고, 이 초를 넘지 않는다.
const LONG_TEXT_CHARACTERS = 20;
const LONG_TEXT_EXTRA_SECONDS = 0.5;
const MAXIMUM_STAY_SECONDS = 4;

// 알림의 단계.
export const ToastPhase = System.Object.freeze({
	hidden: "hidden",
	enter: "enter",
	stay: "stay",
	exit: "exit",
});


//==============================================================================
// 알림 머무는 시간. (표의 시간에 긴 글이면 LONG_TEXT_CHARACTERS 자마다 LONG_TEXT_EXTRA_SECONDS 를 더하고 MAXIMUM_STAY_SECONDS 까지)
//==============================================================================
/**
 * @param { string } text
 * @param { number } baseSeconds
 * @returns { number }
 */
export function readToastSeconds(text, baseSeconds) {
	const characterCount = System.Array.from(text).length;
	const extraSteps = System.Math.max(0, System.Math.ceil((characterCount - LONG_TEXT_CHARACTERS) / LONG_TEXT_CHARACTERS));
	return System.Math.min(MAXIMUM_STAY_SECONDS, System.Math.max(baseSeconds, baseSeconds + extraSteps * LONG_TEXT_EXTRA_SECONDS));
}

//==============================================================================
// 알림이 나오고 사라지는 모습. (토스트 노드에 붙이는 컴포넌트, UIToast 는 줄 세운 알약 알림을 스스로 만들고 이것은 게임이 만든 알림 노드를 움직인다)
//
// 알림 노드에 붙여 show 로 띄운다. 바깥쪽(위 알림은 위, 아래 알림은 아래)에서 미끄러져 들어오며 보이고 살짝 커졌다 돌아오고,
// 머무는 시간이 지나면 떠오르며 사라진 뒤 노드를 끈다.
// 떠 있는 동안 다른 글이 오면 앞 것이 빨리 비키고 새 글이 들어오며, 같은 글이 또 오면 시간만 다시 채우고 통 튄다.
// 노드의 자리는 화면이 놓은 자리를 기준으로 그 둘레에서만 움직인다. (그 사이 화면이 다시 놓으면 그 자리가 새 기준)
//==============================================================================
export class ToastMotion extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #enterSide; // 들어오는 쪽. (-1 이면 위에서, 1 이면 아래에서)
	/** @private @type { string } */ #phase; // ToastPhase
	/** @private @type { number } */ #phaseSeconds; // 이 단계에서 지난 초.
	/** @private @type { number } */ #exitLength; // 이번 사라짐의 초. (보통이나 빨리 비킴)
	/** @private @type { number } */ #staySeconds; // 머무는 남은 초.
	/** @private @type { number } */ #repeatSeconds; // 같은 글로 통 튀는 남은 초.
	/** @private @type { string } */ #text; // 떠 있는 글.
	/** @private @type { object | null } */ #pending; // 앞 것이 비킨 뒤 띄울 것. ({ text, seconds, applyText })
	/** @private @type { Vector2 | null } */ #basePosition; // 화면이 놓은 자리.
	/** @private @type { Vector2 | null } */ #appliedPosition; // 이 부품이 마지막으로 놓은 자리.

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setComponentType("ToastMotion");
		this.#enterSide = -1;
		this.#phase = ToastPhase.hidden;
		this.#phaseSeconds = 0;
		this.#exitLength = EXIT_SECONDS;
		this.#staySeconds = 0;
		this.#repeatSeconds = 0;
		this.#text = "";
		this.#pending = null;
		this.#basePosition = null;
		this.#appliedPosition = null;
	}

	//==============================================================================
	// 들어오는 쪽 정하기. (-1 이면 위에서, 1 이면 아래에서)
	//==============================================================================
	/**
	 * @param { number } enterSide
	 */
	setEnterSide(enterSide) {
		this.#enterSide = enterSide;
	}

	//==============================================================================
	// 띄우기. (applyText 가 노드에 글과 색을 넣음, 떠 있는 다른 글은 빨리 비킨 뒤 띄움)
	//==============================================================================
	/**
	 * @param { string } text
	 * @param { number } seconds 머무는 초.
	 * @param { function(): void } applyText
	 */
	show(text, seconds, applyText) {
		const node = this.getNode();
		const isShown = this.#phase !== ToastPhase.hidden && node !== null && node.isActive();
		if (isShown && text === this.#text && this.#phase !== ToastPhase.exit) {
			this.#staySeconds = seconds;
			this.#repeatSeconds = REPEAT_SECONDS;
			return;
		}
		if (isShown) {
			this.#pending = { text: text, seconds: seconds, applyText: applyText };
			this.startExit(QUICK_EXIT_SECONDS);
			return;
		}
		this.startEnter(text, seconds, applyText);
	}

	//==============================================================================
	// 떠 있는지. (나오는 중, 머무는 중, 사라지는 중)
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isShowing() {
		return this.#phase !== ToastPhase.hidden;
	}

	//==============================================================================
	// 단계 반환. (ToastPhase)
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getPhase() {
		return this.#phase;
	}

	//==============================================================================
	// 곧바로 끄기. (판이 바뀔 때)
	//==============================================================================
	hideNow() {
		this.#pending = null;
		this.#phase = ToastPhase.hidden;
		const node = this.getNode();
		if (node !== null) {
			this.placeAround(node, 1, 0, 1);
			node.setActive(false);
		}
		this.#basePosition = null;
		this.#appliedPosition = null;
	}

	//==============================================================================
	// 나오기 시작.
	//==============================================================================
	/**
	 * @param { string } text
	 * @param { number } seconds
	 * @param { function(): void } applyText
	 */
	startEnter(text, seconds, applyText) {
		applyText();
		this.#text = text;
		this.#staySeconds = seconds;
		this.#repeatSeconds = 0;
		this.#phase = ToastPhase.enter;
		this.#phaseSeconds = 0;
		const node = this.getNode();
		if (node !== null) {
			node.setActive(true);
			this.placeAround(node, ENTER_START_SCALE, this.#enterSide * ENTER_DISTANCE, 0);
		}
	}

	//==============================================================================
	// 사라지기 시작.
	//==============================================================================
	/**
	 * @param { number } exitLength
	 */
	startExit(exitLength) {
		this.#phase = ToastPhase.exit;
		this.#phaseSeconds = 0;
		this.#exitLength = exitLength;
	}

	//==============================================================================
	// 갱신. (단계마다 자리와 크기와 불투명도)
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		const node = this.getNode();
		if (node === null || this.#phase === ToastPhase.hidden) {
			return;
		}
		this.#phaseSeconds += timeDelta;
		let scale = 1;
		let offsetY = 0;
		let opacity = 1;
		switch (this.#phase) {
			case ToastPhase.enter: {
				const enterRatio = System.Math.min(1, this.#phaseSeconds / ENTER_SECONDS);
				const easedRatio = 1 - (1 - enterRatio) * (1 - enterRatio);
				offsetY = this.#enterSide * ENTER_DISTANCE * (1 - easedRatio);
				opacity = easedRatio;
				if (this.#phaseSeconds <= ENTER_SECONDS) {
					scale = ENTER_START_SCALE + (ENTER_PEAK_SCALE - ENTER_START_SCALE) * easedRatio;
				}
				else {
					const settleRatio = System.Math.min(1, (this.#phaseSeconds - ENTER_SECONDS) / ENTER_SETTLE_SECONDS);
					scale = ENTER_PEAK_SCALE + (1 - ENTER_PEAK_SCALE) * settleRatio;
				}
				if (this.#phaseSeconds >= ENTER_SECONDS + ENTER_SETTLE_SECONDS) {
					this.#phase = ToastPhase.stay;
					this.#phaseSeconds = 0;
				}
				break;
			}
			case ToastPhase.stay: {
				this.#staySeconds -= timeDelta;
				if (this.#repeatSeconds > 0) {
					this.#repeatSeconds = System.Math.max(0, this.#repeatSeconds - timeDelta);
					scale = 1 + (REPEAT_SCALE - 1) * System.Math.sin((1 - this.#repeatSeconds / REPEAT_SECONDS) * System.Math.PI);
				}
				if (this.#staySeconds <= 0) {
					this.startExit(EXIT_SECONDS);
				}
				break;
			}
			case ToastPhase.exit: {
				const exitRatio = System.Math.min(1, this.#phaseSeconds / this.#exitLength);
				offsetY = -EXIT_DISTANCE * exitRatio;
				opacity = 1 - exitRatio;
				if (exitRatio >= 1) {
					const pending = this.#pending;
					this.#pending = null;
					this.placeAround(node, 1, 0, 1);
					this.#basePosition = null;
					this.#appliedPosition = null;
					if (pending !== null) {
						this.startEnter(pending.text, pending.seconds, pending.applyText);
					}
					else {
						this.#phase = ToastPhase.hidden;
						node.setActive(false);
					}
					return;
				}
				break;
			}
			default: {
				break;
			}
		}
		this.placeAround(node, scale, offsetY, opacity);
	}

	//==============================================================================
	// 화면이 놓은 자리를 기준으로 가운데를 두고 그 크기와 위아래 비킴, 불투명도로 놓기.
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @param { number } scale
	 * @param { number } offsetY
	 * @param { number } opacity
	 */
	placeAround(node, scale, offsetY, opacity) {
		const localPosition = node.getLocalPosition();
		const appliedPosition = this.#appliedPosition;
		const isMovedByLayout = appliedPosition === null || appliedPosition.x !== localPosition.x || appliedPosition.y !== localPosition.y;
		if (isMovedByLayout || this.#basePosition === null) {
			this.#basePosition = Vector2.create(localPosition.x, localPosition.y);
		}
		const basePosition = this.#basePosition;
		const contentSize = node.getContentSize();
		const positionX = basePosition.x - contentSize.x * (scale - 1) * 0.5;
		const positionY = basePosition.y - contentSize.y * (scale - 1) * 0.5 + offsetY;
		node.setLocalPosition(Vector2.create(positionX, positionY));
		node.setLocalScale(Vector2.create(scale, scale));
		node.setLocalOpacity(opacity);
		this.#appliedPosition = Vector2.create(positionX, positionY);
	}
}

//==============================================================================
// 알림 노드에 나옴과 사라짐 붙이기. (ToastMotion 을 돌려줌)
//==============================================================================
/**
 * @param { WorldNode } node
 * @param { number } enterSide -1 이면 위에서, 1 이면 아래에서 들어온다.
 * @returns { ToastMotion }
 */
export function attachToastMotion(node, enterSide) {
	const toastMotion = node.addComponent(ToastMotion);
	toastMotion.setEnterSide(enterSide);
	return toastMotion;
}
