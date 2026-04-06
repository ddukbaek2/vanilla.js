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
// 스크롤 모드.
// - clamp: 경계를 초과하지 않는 기본 모드.
// - elastic: 경계를 초과하면 저항이 생기고 놓으면 스프링처럼 튕겨 돌아오는 모드.
//==============================================================================
export const ScrollMode = {
	clamp: "clamp",
	elastic: "elastic",
};


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
	/** @private @type { string } */ #scrollMode;
	/** @private @type { Vector2 } */ #scrollVelocity;
	/** @private @type { Vector2 } */ #prevViewInputPosition;

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
		this.#scrollMode = ScrollMode.clamp;
		this.#scrollVelocity = Vector2.zero();
		this.#prevViewInputPosition = Vector2.zero();
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
					this.#scrollVelocity = Vector2.zero();
					this.#prevViewInputPosition = Vector2.create(viewInputPosition.x, viewInputPosition.y);
				}
			}
		}
		else if (inputManager.isTouchMoved()) {
			if (this.#isDragging) {
				const deltaX = viewInputPosition.x - this.#dragStartViewPosition.x;
				const deltaY = viewInputPosition.y - this.#dragStartViewPosition.y;
				const proposedOffset = Vector2.create(
					this.#dragStartOffset.x + deltaX,
					this.#dragStartOffset.y + deltaY
				);
				if (this.#scrollMode === ScrollMode.elastic) {
					const contentSize = node.getContentSize();
					const elasticMaxX = 0;
					const elasticMinX = Math.min(0, contentSize.x - this.#scrollContentSize.x);
					const elasticMaxY = 0;
					const elasticMinY = Math.min(0, contentSize.y - this.#scrollContentSize.y);
					const elasticResistance = 0.3;
					let elasticOffsetX = proposedOffset.x;
					let elasticOffsetY = proposedOffset.y;
					if (elasticOffsetX > elasticMaxX) {
						elasticOffsetX = elasticMaxX + (elasticOffsetX - elasticMaxX) * elasticResistance;
					}
					else if (elasticOffsetX < elasticMinX) {
						elasticOffsetX = elasticMinX + (elasticOffsetX - elasticMinX) * elasticResistance;
					}
					if (elasticOffsetY > elasticMaxY) {
						elasticOffsetY = elasticMaxY + (elasticOffsetY - elasticMaxY) * elasticResistance;
					}
					else if (elasticOffsetY < elasticMinY) {
						elasticOffsetY = elasticMinY + (elasticOffsetY - elasticMinY) * elasticResistance;
					}
					this.#scrollOffset = Vector2.create(elasticOffsetX, elasticOffsetY);
					if (this.#contentNode) {
						this.#contentNode.setAnchoredPosition(this.#scrollOffset);
					}
					if (timeDelta > 0) {
						const velocityX = (viewInputPosition.x - this.#prevViewInputPosition.x) / timeDelta;
						const velocityY = (viewInputPosition.y - this.#prevViewInputPosition.y) / timeDelta;
						this.#scrollVelocity = Vector2.create(velocityX, velocityY);
					}
				}
				else {
					this.#applyScrollOffset(proposedOffset);
				}
				this.#prevViewInputPosition = Vector2.create(viewInputPosition.x, viewInputPosition.y);
			}
		}
		else if (inputManager.isTouchReleased()) {
			this.#isDragging = false;
		}

		if (this.#scrollMode === ScrollMode.elastic && !this.#isDragging) {
			const contentSize = node.getContentSize();
			const physicsBoundsMaxX = 0;
			const physicsBoundsMinX = Math.min(0, contentSize.x - this.#scrollContentSize.x);
			const physicsBoundsMaxY = 0;
			const physicsBoundsMinY = Math.min(0, contentSize.y - this.#scrollContentSize.y);
			const springConstant = 1200;
			const dampingCoefficient = 30;
			const frictionCoefficient = 5;
			let physicsVelocityX = this.#scrollVelocity.x;
			let physicsVelocityY = this.#scrollVelocity.y;
			let physicsOffsetX = this.#scrollOffset.x;
			let physicsOffsetY = this.#scrollOffset.y;
			const physicsClampedX = Math.clamp(physicsOffsetX, physicsBoundsMinX, physicsBoundsMaxX);
			const physicsClampedY = Math.clamp(physicsOffsetY, physicsBoundsMinY, physicsBoundsMaxY);
			const physicsDisplacementX = physicsOffsetX - physicsClampedX;
			const physicsDisplacementY = physicsOffsetY - physicsClampedY;
			const physicsIsOutOfBounds = physicsDisplacementX !== 0 || physicsDisplacementY !== 0;
			if (physicsIsOutOfBounds) {
				const physicsSpringForceX = -physicsDisplacementX * springConstant;
				const physicsSpringForceY = -physicsDisplacementY * springConstant;
				const physicsDampingForceX = -physicsVelocityX * dampingCoefficient;
				const physicsDampingForceY = -physicsVelocityY * dampingCoefficient;
				physicsVelocityX += (physicsSpringForceX + physicsDampingForceX) * timeDelta;
				physicsVelocityY += (physicsSpringForceY + physicsDampingForceY) * timeDelta;
			}
			else {
				const physicsFrictionFactor = Math.max(0, 1 - frictionCoefficient * timeDelta);
				physicsVelocityX *= physicsFrictionFactor;
				physicsVelocityY *= physicsFrictionFactor;
			}
			physicsOffsetX += physicsVelocityX * timeDelta;
			physicsOffsetY += physicsVelocityY * timeDelta;
			const physicsNewClampedX = Math.clamp(physicsOffsetX, physicsBoundsMinX, physicsBoundsMaxX);
			const physicsNewClampedY = Math.clamp(physicsOffsetY, physicsBoundsMinY, physicsBoundsMaxY);
			const physicsNewDispX = physicsOffsetX - physicsNewClampedX;
			const physicsNewDispY = physicsOffsetY - physicsNewClampedY;
			const physicsSpeedSq = physicsVelocityX * physicsVelocityX + physicsVelocityY * physicsVelocityY;
			if (physicsSpeedSq < 1.0 && Math.abs(physicsNewDispX) < 0.5 && Math.abs(physicsNewDispY) < 0.5) {
				physicsOffsetX = physicsNewClampedX;
				physicsOffsetY = physicsNewClampedY;
				physicsVelocityX = 0;
				physicsVelocityY = 0;
			}
			this.#scrollOffset = Vector2.create(physicsOffsetX, physicsOffsetY);
			if (this.#contentNode) {
				this.#contentNode.setAnchoredPosition(this.#scrollOffset);
			}
			this.#scrollVelocity = Vector2.create(physicsVelocityX, physicsVelocityY);
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
	// 스크롤 모드 설정.
	//==============================================================================
	/**
	 * @param { string } scrollMode
	 */
	setScrollMode(scrollMode) {
		this.#scrollMode = scrollMode;
	}

	//==============================================================================
	// 스크롤 모드 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getScrollMode() {
		return this.#scrollMode;
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
