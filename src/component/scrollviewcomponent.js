//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { UIComponent } from "./uicomponent.js";
import { UINode } from "../core/uinode.js";
import { AnchoredTransformNode } from "../core/anchoredtransformnode.js";
import { Vector2 } from "../base/vector2.js";
import { Pivot } from "../base/pivot.js";
import * as Math from "../base/math.js";


//==============================================================================
// 스크롤뷰 컴포넌트.
// - 소유 노드의 getContentSize()를 가시 영역으로 사용한다.
// - 내부에 별도의 콘텐츠 노드를 생성하며, 드래그로 스크롤링할 수 있다.
// - AnchoredTransformNode에 추가하면 마스크(크롭)가 자동 활성화된다.
// - 중첩 ScrollView를 지원한다. (이벤트 체이닝과 연동)
//==============================================================================
export class ScrollViewComponent extends UIComponent {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { AnchoredTransformNode | null } */ #contentNode;
	/** @private @type { Vector2 } */ #scrollOffset;
	/** @private @type { Vector2 } */ #scrollContentSize;
	/** @private @type { * } */ #engine;
	/** @private @type { boolean } */ #isDragging;
	/** @private @type { Vector2 } */ #dragStartViewPosition;
	/** @private @type { Vector2 } */ #dragStartOffset;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @construct
	 */
	constructor() {
		super();
		this.#contentNode = null;
		this.#scrollOffset = Vector2.zero();
		this.#scrollContentSize = Vector2.zero();
		this.#engine = null;
		this.#isDragging = false;
		this.#dragStartViewPosition = Vector2.zero();
		this.#dragStartOffset = Vector2.zero();
	}

	//==============================================================================
	// 소유권자 설정. (오버라이드: 내부 콘텐츠 노드 생성 및 마스크 활성화)
	//==============================================================================
	/**
	 * @override
	 * @param { * } node
	 */
	setNode(node) {
		super.setNode(node);
		if (node) {
			this.#contentNode = new AnchoredTransformNode();
			this.#contentNode.setAnchorMin(Vector2.zero());
			this.#contentNode.setAnchorMax(Vector2.zero());
			this.#contentNode.setPivot(Pivot.topLeft);
			this.#contentNode.setAnchoredPosition(Vector2.zero());
			node.addChild(this.#contentNode);
			if (node instanceof UINode) {
				node.setMaskEnabled(true);
			}
		}
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		if (!this.#engine) {
			return;
		}
		const node = this.getNode();
		if (!node) {
			return;
		}

		const inputManager = this.#engine.getInputManager();
		const viewInputPosition = inputManager.getViewInputPosition();

		if (inputManager.isTouchPressed()) {
			if (!this.isTouchBlocked()) {
				const isInsideBounds = node.contains(viewInputPosition);
				if (isInsideBounds) {
					this.#isDragging = true;
					this.#dragStartViewPosition = Vector2.create(viewInputPosition.x, viewInputPosition.y);
					this.#dragStartOffset = Vector2.create(this.#scrollOffset.x, this.#scrollOffset.y);
				}
			}
		}
		else if (inputManager.isTouchMoved()) {
			if (this.#isDragging) {
				const deltaX = viewInputPosition.x - this.#dragStartViewPosition.x;
				const deltaY = viewInputPosition.y - this.#dragStartViewPosition.y;
				this.#applyScrollOffset(Vector2.create(
					this.#dragStartOffset.x + deltaX,
					this.#dragStartOffset.y + deltaY
				));
			}
		}
		else if (inputManager.isTouchReleased()) {
			this.#isDragging = false;
		}
	}

	//==============================================================================
	// 스크롤 오프셋 적용. (클램핑 포함)
	//==============================================================================
	/** @private */
	#applyScrollOffset(offset) {
		const node = this.getNode();
		const contentSize = node.getContentSize();
		const scrollContentSize = this.#scrollContentSize;

		const maxX = 0;
		const minX = Math.min(0, contentSize.x - scrollContentSize.x);
		const maxY = 0;
		const minY = Math.min(0, contentSize.y - scrollContentSize.y);

		this.#scrollOffset = Vector2.create(
			Math.clamp(offset.x, minX, maxX),
			Math.clamp(offset.y, minY, maxY)
		);

		if (this.#contentNode) {
			this.#contentNode.setAnchoredPosition(this.#scrollOffset);
		}
	}

	//==============================================================================
	// 스크롤 오프셋 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } offset
	 */
	setScrollOffset(offset) {
		this.#applyScrollOffset(offset);
	}

	//==============================================================================
	// 스크롤 오프셋 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getScrollOffset() {
		return this.#scrollOffset;
	}

	//==============================================================================
	// 스크롤 콘텐츠 크기 설정. (가시 영역보다 크게 설정해야 스크롤 가능)
	//==============================================================================
	/**
	 * @param { Vector2 } scrollContentSize
	 */
	setScrollContentSize(scrollContentSize) {
		this.#scrollContentSize = scrollContentSize;
		if (this.#contentNode) {
			this.#contentNode.setSizeDelta(scrollContentSize);
		}
	}

	//==============================================================================
	// 스크롤 콘텐츠 크기 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getScrollContentSize() {
		return this.#scrollContentSize;
	}

	//==============================================================================
	// 콘텐츠 노드 반환. (자식 노드를 이 노드에 추가하면 스크롤 대상이 됨)
	//==============================================================================
	/**
	 * @returns { AnchoredTransformNode | null }
	 */
	getContentNode() {
		return this.#contentNode;
	}

	//==============================================================================
	// 엔진 설정.
	//==============================================================================
	/**
	 * @param { * } engine
	 */
	setEngine(engine) {
		this.#engine = engine;
	}

	//==============================================================================
	// 엔진 반환.
	//==============================================================================
	/**
	 * @returns { * }
	 */
	getEngine() {
		return this.#engine;
	}
}
