//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../base/vector2.js";
import { UIControl } from "./uicontrol.js";
import { WorldNode } from "../core/node/worldnode.js";


//==============================================================================
// 드래그 가능 컴포넌트.
// - 노드에 붙이면 눌러서 끌 수 있다. 놓으면 dragEndEvent 로 알리고,
//   setSnapBackEnabled(true) 면 잡기 전 자리로 미끄러져 돌아간다.
// - 이동량은 뷰 좌표 차분을 그대로 로컬 좌표에 더한다.
//   (조상 노드에 배율이 있으면 감도가 달라질 수 있다)
// - 사용:
//     const draggable = cardNode.addComponent(UIDraggable);
//     draggable.setSnapBackEnabled(true);
//     draggable.setDragEndEvent((self, viewPosition) => { ... });
//==============================================================================
export class UIDraggable extends UIControl {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { boolean } */ #isDragging;
	/** @private @type { Vector2 | null } */ #previousViewPosition;
	/** @private @type { Vector2 | null } */ #homePosition; // 잡기 전 로컬 자리.
	/** @private @type { boolean } */ #isSnapBackEnabled;
	/** @private @type { boolean } */ #isReturning;
	/** @private @type { number } */ #snapBackSpeed; // 초당 되돌아가는 비율 계수.
	/** @private @type { Function | null } */ #dragStartEvent; // (self)
	/** @private @type { Function | null } */ #dragMoveEvent; // (self, viewPosition)
	/** @private @type { Function | null } */ #dragEndEvent; // (self, viewPosition)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.setComponentType("Draggable");
		this.#isDragging = false;
		this.#previousViewPosition = null;
		this.#homePosition = null;
		this.#isSnapBackEnabled = false;
		this.#isReturning = false;
		this.#snapBackSpeed = 14;
		this.#dragStartEvent = null;
		this.#dragMoveEvent = null;
		this.#dragEndEvent = null;
	}

	//==============================================================================
	// 노드에 붙음. (터치를 받도록 인터랙션 활성화)
	//==============================================================================
	/**
	 * @override
	 * @param { import("../core/node/componentnode.js").ComponentNode } node
	 */
	attach(node) {
		super.attach(node);
		if (node instanceof WorldNode) {
			node.setInteractable(true);
		}
	}

	//==============================================================================
	// 터치 눌림.
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } viewInputPosition
	 */
	touchPress(viewInputPosition) {
		const node = this.getNode();
		this.#isDragging = true;
		this.#isReturning = false;
		this.#previousViewPosition = Vector2.create(viewInputPosition.x, viewInputPosition.y);
		const localPosition = node.getLocalPosition();
		this.#homePosition = Vector2.create(localPosition.x, localPosition.y);
		if (this.#dragStartEvent) {
			this.#dragStartEvent(this);
		}
	}

	//==============================================================================
	// 터치 이동.
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } viewInputPosition
	 */
	touchMove(viewInputPosition) {
		if (!this.#isDragging) {
			return;
		}
		const node = this.getNode();
		const deltaX = viewInputPosition.x - this.#previousViewPosition.x;
		const deltaY = viewInputPosition.y - this.#previousViewPosition.y;
		this.#previousViewPosition = Vector2.create(viewInputPosition.x, viewInputPosition.y);
		const localPosition = node.getLocalPosition();
		node.setLocalPosition(Vector2.create(localPosition.x + deltaX, localPosition.y + deltaY));
		if (this.#dragMoveEvent) {
			this.#dragMoveEvent(this, viewInputPosition);
		}
	}

	//==============================================================================
	// 터치 뗌.
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } viewInputPosition
	 */
	touchRelease(viewInputPosition) {
		if (!this.#isDragging) {
			return;
		}
		this.#isDragging = false;
		if (this.#isSnapBackEnabled) {
			this.#isReturning = true;
		}
		if (this.#dragEndEvent) {
			this.#dragEndEvent(this, viewInputPosition);
		}
	}

	//==============================================================================
	// 터치 취소.
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } viewInputPosition
	 */
	touchCancel(viewInputPosition) {
		this.touchRelease(viewInputPosition);
	}

	//==============================================================================
	// 갱신. (제자리 복귀 미끄러짐)
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
		if (!this.#isReturning || !this.#homePosition) {
			return;
		}
		const node = this.getNode();
		const localPosition = node.getLocalPosition();
		const blend = System.Math.min(this.#snapBackSpeed * timeDelta, 1);
		const nextX = localPosition.x + (this.#homePosition.x - localPosition.x) * blend;
		const nextY = localPosition.y + (this.#homePosition.y - localPosition.y) * blend;
		node.setLocalPosition(Vector2.create(nextX, nextY));
		const remainX = this.#homePosition.x - nextX;
		const remainY = this.#homePosition.y - nextY;
		if (remainX * remainX + remainY * remainY < 0.25) {
			node.setLocalPosition(Vector2.create(this.#homePosition.x, this.#homePosition.y));
			this.#isReturning = false;
		}
	}

	//==============================================================================
	// 지금 자리에 눌러앉기. (dragEnd 처리기에서 드롭 성공 시 호출 — 복귀를 멈춘다)
	//==============================================================================
	settleHere() {
		const node = this.getNode();
		const localPosition = node.getLocalPosition();
		this.#homePosition = Vector2.create(localPosition.x, localPosition.y);
		this.#isReturning = false;
	}

	//==============================================================================
	// 제자리로 즉시 되돌리기.
	//==============================================================================
	snapHome() {
		if (this.#homePosition) {
			const node = this.getNode();
			node.setLocalPosition(Vector2.create(this.#homePosition.x, this.#homePosition.y));
		}
		this.#isReturning = false;
	}

	//==============================================================================
	// 설정 / 조회 메서드 목록.
	//==============================================================================
	/** @param { boolean } isSnapBackEnabled */
	setSnapBackEnabled(isSnapBackEnabled) {
		this.#isSnapBackEnabled = isSnapBackEnabled;
	}

	/** @param { number } snapBackSpeed */
	setSnapBackSpeed(snapBackSpeed) {
		this.#snapBackSpeed = snapBackSpeed;
	}

	/** @param { Function } dragStartEvent (self) */
	setDragStartEvent(dragStartEvent) {
		this.#dragStartEvent = dragStartEvent;
	}

	/** @param { Function } dragMoveEvent (self, viewPosition) */
	setDragMoveEvent(dragMoveEvent) {
		this.#dragMoveEvent = dragMoveEvent;
	}

	/** @param { Function } dragEndEvent (self, viewPosition) */
	setDragEndEvent(dragEndEvent) {
		this.#dragEndEvent = dragEndEvent;
	}

	/** @returns { boolean } */
	isDragging() {
		return this.#isDragging;
	}

	/** @returns { Vector2 | null } */
	getHomePosition() {
		return this.#homePosition ? Vector2.create(this.#homePosition.x, this.#homePosition.y) : null;
	}
}
