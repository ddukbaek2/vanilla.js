//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { ViewComponent } from "./viewcomponent.js";
import { UINode } from "../../core/node/uinode.js";
import { AnchoredTransformNode } from "../../core/node/anchoredtransformnode.js";
import { Vector2 } from "../../base/vector2.js";
import { Pivot } from "../../base/pivot.js";
import * as Math from "../../base/math.js";
import { Color } from "../../base/color.js";
import { Rect } from "../../base/rect.js";
import { ColorComponent } from "../colorcomponent.js";


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
export class ScrollViewComponent extends ViewComponent {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { AnchoredTransformNode | null } */ #content; // 컨텐트 노드.
	/** @private @type { Vector2 } */	#scrollContentSize; // 스크롤 가능한 내부 컨텐트 영역.
	/** @private @type { string } */	#scrollMode; // 스크롤 모드.
	/** @private @type { Vector2 } */	#scrollVelocity; // 스크롤 속도.
	/** @private @type { Vector2 } */	#previousViewInputPosition;
	/** @private @type { boolean } */	#horizontalEnabled; // 수평 이동 여부.
	/** @private @type { boolean } */	#verticalEnabled; // 수직 이동 여부.
	/** @private @type { Vector2 } */	#scrollOffset; // 스크롤 오프셋.
	/** @private @type { boolean } */	#isDragging; // 드래그 중인지 여부.
	/** @private @type { Vector2 } */	#dragStartViewPosition;
	/** @private @type { Vector2 } */	#dragStartOffset;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @construct
	 */
	constructor() {
		super();
		this.#content = null;
		this.#scrollOffset = Vector2.zero();
		this.#scrollContentSize = Vector2.zero();
		this.#isDragging = false;
		this.#dragStartViewPosition = Vector2.zero();
		this.#dragStartOffset = Vector2.zero();
		this.#scrollMode = ScrollMode.clamp;
		this.#scrollVelocity = Vector2.zero();
		this.#previousViewInputPosition = Vector2.zero();
		this.#horizontalEnabled = true;
		this.#verticalEnabled = true;
	}

	//==============================================================================
	// 노드에 붙음.
	//==============================================================================
	/**
	 * @override
	 * @param { TransformNode } node
	 */
	attach(node) {
		super.attach(node);

		// 컨텐츠 노드 추가.
		this.#content = new AnchoredTransformNode();
		this.#content.setAnchorMin(Vector2.zero());
		this.#content.setAnchorMax(Vector2.zero());
		this.#content.setPivot(Pivot.topLeft);
		this.#content.setAnchoredPosition(Vector2.zero());
		node.addChild(this.#content);

		if (node instanceof UINode) {
			node.setMaskEnabled(true);
		}
	}

	//==============================================================================
	// 노드에서 떨어짐.
	//==============================================================================
	/**
	 * @override
	 * @param { TransformNode } node
	 */
	detach(node) {
		super.detach(node);
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		const node = this.getNode();
		if (!node) {
			return;
		}

		const engine = this.getEngine();
		if (!engine) {
			return;
		}

		const inputManager = engine.getInputManager();
		const viewInputPosition = inputManager.getViewInputPosition();

		// 누름.
		if (inputManager.isTouchPressed()) {
			const isTouchBlocked = this.isTouchBlocked();
			if (!isTouchBlocked) {
				const isInsideBounds = node.contains(viewInputPosition);
				if (isInsideBounds) {
					this.#isDragging = true;
					this.#dragStartViewPosition = Vector2.create(viewInputPosition.x, viewInputPosition.y);
					this.#dragStartOffset = Vector2.create(this.#scrollOffset.x, this.#scrollOffset.y);
					this.#scrollVelocity = Vector2.zero();
					this.#previousViewInputPosition = Vector2.create(viewInputPosition.x, viewInputPosition.y);
				}
			}
		}
		// 이동.
		else if (inputManager.isTouchMoved()) {
			if (this.#isDragging) {
				const rawDeltaX = viewInputPosition.x - this.#dragStartViewPosition.x;
				const rawDeltaY = viewInputPosition.y - this.#dragStartViewPosition.y;
				const deltaX = this.#horizontalEnabled ? rawDeltaX : 0;
				const deltaY = this.#verticalEnabled ? rawDeltaY : 0;
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
					const elasticResistance = 0.5;
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

					const content = this.getContent();
					if (content) {
						content.setAnchoredPosition(this.#scrollOffset);
					}
					if (timeDelta > 0) {
						const rawVelocityX = (viewInputPosition.x - this.#previousViewInputPosition.x) / timeDelta;
						const rawVelocityY = (viewInputPosition.y - this.#previousViewInputPosition.y) / timeDelta;
						const velocityX = this.#horizontalEnabled ? rawVelocityX : 0;
						const velocityY = this.#verticalEnabled ? rawVelocityY : 0;
						this.#scrollVelocity = Vector2.create(velocityX, velocityY);
					}
				}
				else {
					this.applyScrollOffset(proposedOffset);
				}
				this.#previousViewInputPosition = Vector2.create(viewInputPosition.x, viewInputPosition.y);
			}
		}
		// 뗌.
		else if (inputManager.isTouchReleased()) {
			this.#isDragging = false;
		}

		if (this.#scrollMode === ScrollMode.elastic && !this.#isDragging) {
			const contentSize = node.getContentSize();
			const physicsBoundsMaxX = 0;
			const physicsBoundsMinX = this.#horizontalEnabled ? Math.min(0, contentSize.x - this.#scrollContentSize.x) : 0;
			const physicsBoundsMaxY = 0;
			const physicsBoundsMinY = this.#verticalEnabled ? Math.min(0, contentSize.y - this.#scrollContentSize.y) : 0;
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

			// 경계 밖에서 복귀 중 경계를 넘어 내부로 진입하면 경계에서 정지.
			if (physicsDisplacementX > 0 && physicsOffsetX < physicsBoundsMaxX) {
				physicsOffsetX = physicsBoundsMaxX;
				physicsVelocityX = 0;
			}
			else if (physicsDisplacementX < 0 && physicsOffsetX > physicsBoundsMinX) {
				physicsOffsetX = physicsBoundsMinX;
				physicsVelocityX = 0;
			}
			if (physicsDisplacementY > 0 && physicsOffsetY < physicsBoundsMaxY) {
				physicsOffsetY = physicsBoundsMaxY;
				physicsVelocityY = 0;
			}
			else if (physicsDisplacementY < 0 && physicsOffsetY > physicsBoundsMinY) {
				physicsOffsetY = physicsBoundsMinY;
				physicsVelocityY = 0;
			}

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

			const content = this.getContent();
			if (content) {
				content.setAnchoredPosition(this.#scrollOffset);
			}
			this.#scrollVelocity = Vector2.create(physicsVelocityX, physicsVelocityY);
		}
	}

	//==============================================================================
	// 스크롤 오프셋 적용. (클램핑 포함)
	//==============================================================================
	/**
	 * @param { Vector2 } offset
	 */
	applyScrollOffset(offset) {
		const node = this.getNode();
		const contentSize = node.getContentSize();
		const scrollContentSize = this.#scrollContentSize;

		const maxX = 0;
		const minX = this.#horizontalEnabled ? Math.min(0, contentSize.x - scrollContentSize.x) : 0;
		const maxY = 0;
		const minY = this.#verticalEnabled ? Math.min(0, contentSize.y - scrollContentSize.y) : 0;

		this.#scrollOffset = Vector2.create(
			Math.clamp(offset.x, minX, maxX),
			Math.clamp(offset.y, minY, maxY)
		);

		const content = this.getContent();
		if (content) {
			content.setAnchoredPosition(this.#scrollOffset);
		}
	}

	//==============================================================================
	// 스크롤 오프셋 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } offset
	 */
	setScrollOffset(offset) {
		this.applyScrollOffset(offset);
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
	// 가로 스크롤 활성 설정. (false = 가로 스크롤 비활성)
	//==============================================================================
	/**
	 * @param { boolean } horizontal
	 */
	setHorizontal(horizontal) {
		this.#horizontalEnabled = horizontal;
	}

	//==============================================================================
	// 가로 스크롤 활성 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	getHorizontal() {
		return this.#horizontalEnabled;
	}

	//==============================================================================
	// 세로 스크롤 활성 설정. (false = 세로 스크롤 비활성)
	//==============================================================================
	/**
	 * @param { boolean } vertical
	 */
	setVertical(vertical) {
		this.#verticalEnabled = vertical;
	}

	//==============================================================================
	// 세로 스크롤 활성 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	getVertical() {
		return this.#verticalEnabled;
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
		scrollContentSize = scrollContentSize.clone();
		this.#scrollContentSize = scrollContentSize;

		const content = this.getContent();
		if (content) {
			content.setSizeDelta(scrollContentSize);
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
	 * @returns { AnchoredTransformNode }
	 */
	getContent() {
		return this.#content;
	}

	//==============================================================================
	// 드래그 중 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isDragging() {
		return this.#isDragging;
	}

	//==============================================================================
	// 현재 스크롤 속도 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getScrollVelocity() {
		return this.#scrollVelocity;
	}
}
