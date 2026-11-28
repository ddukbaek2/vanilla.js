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
/**
 * @example <caption>칸에 놓으면 머물고 밖에 놓으면 돌아가는 카드</caption>
 * import { Engine, EngineConfiguration, UIScene, UIDraggable, WorldNode, Paint, Color, Pivot, Vector2 } from "./build/vanilla.js";
 *
 * class DragScene extends UIScene {
 * 	create() {
 * 		super.create();
 * 		const root = this.getRoot();
 *
 * 		const slotNode = new WorldNode();
 * 		slotNode.setPivot(Pivot.topLeft.clone());
 * 		slotNode.setAnchor(Pivot.topLeft.clone());
 * 		slotNode.setContentSize(Vector2.create(140, 100));
 * 		slotNode.setLocalPosition(Vector2.create(420, 130));
 * 		const slotPaint = slotNode.addComponent(Paint);
 * 		slotPaint.setColor(new Color(1, 1, 1, 0.1));
 * 		root.addChild(slotNode);
 *
 * 		const cardNode = new WorldNode();
 * 		cardNode.setPivot(Pivot.topLeft.clone());
 * 		cardNode.setAnchor(Pivot.topLeft.clone());
 * 		cardNode.setContentSize(Vector2.create(120, 80));
 * 		cardNode.setLocalPosition(Vector2.create(80, 140));
 * 		const cardPaint = cardNode.addComponent(Paint);
 * 		cardPaint.setColor(new Color(0.36, 0.42, 1, 1));
 * 		cardPaint.setRoundSize(8);
 * 		const draggable = cardNode.addComponent(UIDraggable);
 * 		draggable.setSnapBackEnabled(true);
 * 		draggable.setDragEndEvent((self, viewPosition) => {
 * 			if (slotNode.contains(viewPosition)) {
 * 				self.settleHere();
 * 			}
 * 		});
 * 		root.addChild(cardNode);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * const scene = new DragScene();
 * scene.setLoadingMinDurationMs(0);
 * engine.run(scene);
 */
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
	 * @param { import("../core/node/componentnode.js").ComponentNode } node 붙을 노드. (WorldNode 면 setInteractable(true))
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
	 * @param { Vector2 } viewInputPosition 입력 위치. (뷰 좌표)
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
	 * @param { Vector2 } viewInputPosition 입력 위치. (뷰 좌표)
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
	 * @param { Vector2 } viewInputPosition 입력 위치. (뷰 좌표)
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
	 * @param { Vector2 } viewInputPosition 입력 위치. (뷰 좌표)
	 */
	touchCancel(viewInputPosition) {
		this.touchRelease(viewInputPosition);
	}

	//==============================================================================
	// 갱신. (제자리 복귀 미끄러짐)
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
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
	// 지금 자리에 눌러앉기. (dragEnd 처리기에서 드롭 성공 시 호출, 복귀를 멈춘다)
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

	//==============================================================================
	// 놓았을 때 잡기 전 자리로 돌아갈지 설정.
	//==============================================================================
	/** @param { boolean } isSnapBackEnabled 참이면 놓은 뒤 잡기 전 자리로 미끄러져 돌아간다. */
	setSnapBackEnabled(isSnapBackEnabled) {
		this.#isSnapBackEnabled = isSnapBackEnabled;
	}

	//==============================================================================
	// 되돌아가는 빠르기 설정. (기본 14)
	//==============================================================================
	/** @param { number } snapBackSpeed 초당 되돌아가는 비율 계수. (프레임마다 남은 거리의 이 값 곱하기 프레임 초 몫만큼 다가간다, 몫은 1 을 넘지 않는다) */
	setSnapBackSpeed(snapBackSpeed) {
		this.#snapBackSpeed = snapBackSpeed;
	}

	//==============================================================================
	// 끌기 시작 처리기 설정. (누른 순간 한 번)
	//==============================================================================
	/** @param { Function } dragStartEvent (self) */
	setDragStartEvent(dragStartEvent) {
		this.#dragStartEvent = dragStartEvent;
	}

	//==============================================================================
	// 끄는 중 처리기 설정. (노드를 옮긴 뒤 이동마다)
	//==============================================================================
	/** @param { Function } dragMoveEvent (self, viewPosition) */
	setDragMoveEvent(dragMoveEvent) {
		this.#dragMoveEvent = dragMoveEvent;
	}

	//==============================================================================
	// 끌기 끝 처리기 설정. (뗐거나 취소됐을 때, 되돌아가기를 켠 뒤에 부른다)
	// - 처리기 안에서 settleHere 를 부르면 그 자리에 머문다.
	//==============================================================================
	/**
	 * @param { Function } dragEndEvent (self, viewPosition)
	 * @example <caption>오른쪽 절반에 놓을 때만 머물기</caption>
	 * import { UIDraggable, WorldNode, Vector2 } from "./build/vanilla.js";
	 *
	 * const cardNode = new WorldNode();
	 * cardNode.setLocalPosition(Vector2.create(100, 100));
	 * const draggable = cardNode.addComponent(UIDraggable);
	 * draggable.setSnapBackEnabled(true);
	 * draggable.setDragEndEvent((self, viewPosition) => {
	 * 	if (viewPosition.x > 320) {
	 * 		self.settleHere();
	 * 	}
	 * });
	 * draggable.touchPress(Vector2.create(110, 110));
	 * draggable.touchMove(Vector2.create(160, 120));
	 * draggable.touchRelease(Vector2.create(160, 120));
	 * draggable.tick(1);
	 * const localPosition = cardNode.getLocalPosition();
	 * console.log(localPosition.x, localPosition.y);
	 */
	setDragEndEvent(dragEndEvent) {
		this.#dragEndEvent = dragEndEvent;
	}

	//==============================================================================
	// 끄는 중인지 반환.
	//==============================================================================
	/** @returns { boolean } 눌러서 끄는 중이면 참. (되돌아가는 중은 거짓) */
	isDragging() {
		return this.#isDragging;
	}

	//==============================================================================
	// 잡기 전 자리 반환. (settleHere 를 불렀으면 그 자리)
	//==============================================================================
	/** @returns { Vector2 | null } 로컬 자리의 복사본. (한 번도 누르지 않았으면 null) */
	getHomePosition() {
		return this.#homePosition ? Vector2.create(this.#homePosition.x, this.#homePosition.y) : null;
	}
}
