//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";


//==============================================================================
// 포인터 제스처 인식기. (헤드리스)
// - 탭 / 드래그 / 롱프레스를 임계값으로 분류한다. 노드에 얽매이지 않아 어디서나 쓴다.
// - 사용: press(x, y) → move(x, y) → tick(dt) → release() 순으로 넘기고,
//   콜백(setTapEvent / setDragEvent / setLongPressEvent)으로 결과를 받는다.
// - 여러 게임이 pressedTime / dragMoved 변수를 제각각 들고 다니던 것을 표준화했다.
//==============================================================================
export class PointerGesture extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { boolean } */ #isPressed;
	/** @private @type { boolean } */ #isDragging;
	/** @private @type { boolean } */ #isLongPressed;
	/** @private @type { Vector2 } */ #pressPosition;
	/** @private @type { Vector2 } */ #currentPosition;
	/** @private @type { number } */ #pressedSeconds;
	/** @private @type { number } */ #dragThreshold;
	/** @private @type { number } */ #longPressSeconds;
	/** @private @type { Function | null } */ #tapEvent;
	/** @private @type { Function | null } */ #dragEvent;
	/** @private @type { Function | null } */ #dragEndEvent;
	/** @private @type { Function | null } */ #longPressEvent;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { object } options { dragThreshold = 12, longPressSeconds = 0.6 }
	 */
	constructor(options = {}) {
		super();

		this.#isPressed = false;
		this.#isDragging = false;
		this.#isLongPressed = false;
		this.#pressPosition = Vector2.zero();
		this.#currentPosition = Vector2.zero();
		this.#pressedSeconds = 0;
		this.#dragThreshold = (options.dragThreshold !== undefined) ? options.dragThreshold : 12;
		this.#longPressSeconds = (options.longPressSeconds !== undefined) ? options.longPressSeconds : 0.6;
		this.#tapEvent = null;
		this.#dragEvent = null;
		this.#dragEndEvent = null;
		this.#longPressEvent = null;
	}

	//==============================================================================
	// 누름.
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 */
	press(x, y) {
		this.#isPressed = true;
		this.#isDragging = false;
		this.#isLongPressed = false;
		this.#pressedSeconds = 0;
		this.#pressPosition = Vector2.create(x, y);
		this.#currentPosition = Vector2.create(x, y);
	}

	//==============================================================================
	// 이동.
	// - 누른 지점에서 임계값을 넘으면 드래그로 확정하고 이후 매 이동마다 dragEvent 를 부른다.
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 */
	move(x, y) {
		if (!this.#isPressed) {
			return;
		}
		this.#currentPosition = Vector2.create(x, y);
		if (!this.#isDragging) {
			const movedX = x - this.#pressPosition.x;
			const movedY = y - this.#pressPosition.y;
			if (movedX * movedX + movedY * movedY >= this.#dragThreshold * this.#dragThreshold) {
				this.#isDragging = true;
			}
		}
		if (this.#isDragging && this.#dragEvent) {
			this.#dragEvent(this.#currentPosition, this.#pressPosition);
		}
	}

	//==============================================================================
	// 갱신. (롱프레스 시간 누적)
	// - 드래그로 확정되지 않은 채 longPressSeconds 를 넘기면 롱프레스를 한 번 알린다.
	//==============================================================================
	/**
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		if (!this.#isPressed || this.#isDragging || this.#isLongPressed) {
			return;
		}
		this.#pressedSeconds += timeDelta;
		if (this.#pressedSeconds >= this.#longPressSeconds) {
			this.#isLongPressed = true;
			if (this.#longPressEvent) {
				this.#longPressEvent(this.#pressPosition);
			}
		}
	}

	//==============================================================================
	// 뗌.
	// - 드래그도 롱프레스도 아니었으면 탭으로 알린다.
	//==============================================================================
	release() {
		if (!this.#isPressed) {
			return;
		}
		const wasDragging = this.#isDragging;
		const wasLongPressed = this.#isLongPressed;
		this.#isPressed = false;
		this.#isDragging = false;
		this.#isLongPressed = false;
		if (wasDragging) {
			if (this.#dragEndEvent) {
				this.#dragEndEvent(this.#currentPosition, this.#pressPosition);
			}
			return;
		}
		if (wasLongPressed) {
			return;
		}
		if (this.#tapEvent) {
			this.#tapEvent(this.#currentPosition);
		}
	}

	//==============================================================================
	// 취소. (아무것도 알리지 않고 상태만 되돌린다)
	//==============================================================================
	cancel() {
		this.#isPressed = false;
		this.#isDragging = false;
		this.#isLongPressed = false;
	}

	//==============================================================================
	// 롱프레스 진행 비율 반환. (게이지 표시용, 0~1)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getLongPressRatio() {
		if (!this.#isPressed || this.#isDragging || this.#longPressSeconds <= 0) {
			return 0;
		}
		return System.Math.min(1, this.#pressedSeconds / this.#longPressSeconds);
	}

	//==============================================================================
	// 상태 조회.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isPressed() {
		return this.#isPressed;
	}

	/**
	 * @returns { boolean }
	 */
	isDragging() {
		return this.#isDragging;
	}

	//==============================================================================
	// 콜백 설정.
	//==============================================================================
	/** @param { Function } tapEvent (position) => void */
	setTapEvent(tapEvent) {
		this.#tapEvent = tapEvent;
	}

	/** @param { Function } dragEvent (currentPosition, pressPosition) => void */
	setDragEvent(dragEvent) {
		this.#dragEvent = dragEvent;
	}

	/** @param { Function } dragEndEvent (currentPosition, pressPosition) => void */
	setDragEndEvent(dragEndEvent) {
		this.#dragEndEvent = dragEndEvent;
	}

	/** @param { Function } longPressEvent (pressPosition) => void */
	setLongPressEvent(longPressEvent) {
		this.#longPressEvent = longPressEvent;
	}

	//==============================================================================
	// 임계값 설정.
	//==============================================================================
	/** @param { number } dragThreshold */
	setDragThreshold(dragThreshold) {
		this.#dragThreshold = dragThreshold;
	}

	/** @param { number } longPressSeconds */
	setLongPressSeconds(longPressSeconds) {
		this.#longPressSeconds = longPressSeconds;
	}
}
