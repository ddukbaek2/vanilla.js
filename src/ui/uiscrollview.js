//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { UIView } from "./uiview.js";
import { AnchoredWorldNode } from "../core/node/anchoredworldmnode.js";
import { Vector2 } from "../base/vector2.js";
import * as Math from "../base/math.js";
import { UIScrollBar, ScrollBarAxis } from "./uiscrollbar.js";


//==============================================================================
// 스크롤바 기본 두께 / 마진 (UIKit indicator 스타일).
//==============================================================================
const SCROLLBAR_THICKNESS = 12;
const SCROLLBAR_MARGIN = 6;
const WHEEL_SCROLL_SCALE = 1.0;


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
// - AnchoredWorldNode에 추가하면 마스크(크롭)가 자동 활성화된다.
// - 중첩 ScrollView를 지원한다. (TouchRaycaster와 연동)
//==============================================================================
export class UIScrollView extends UIView {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Vector2 } */	#scrollContentSize; // 스크롤 가능한 내부 컨텐트 영역.
	/** @private @type { string } */	#scrollMode; // 스크롤 모드.
	/** @private @type { Vector2 } */	#scrollVelocity; // 스크롤 속도.
	/** @private @type { Vector2 } */	#previousViewInputPosition;
	/** @private @type { Vector2 } */	#currentViewInputPosition;
	/** @private @type { boolean } */	#horizontalEnabled; // 수평 이동 여부.
	/** @private @type { boolean } */	#verticalEnabled; // 수직 이동 여부.
	/** @private @type { Vector2 } */	#scrollOffset; // 스크롤 오프셋.
	/** @private @type { boolean } */	#isDragging; // 드래그 중인지 여부.
	/** @private @type { Vector2 } */	#dragStartViewPosition;
	/** @private @type { Vector2 } */	#dragStartOffset;
	/** @private @type { number } */	#dragSensitivity; // 드래그 반영량 배율.
	/** @private @type { UIScrollBar | null } */ #verticalScrollBar;
	/** @private @type { UIScrollBar | null } */ #horizontalScrollBar;
	/** @private @type { boolean } */ #showsVerticalScrollBar;
	/** @private @type { boolean } */ #showsHorizontalScrollBar;
	/** @private @type { number } */ #wheelScrollScale;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @construct
	 */
	constructor() {
		super();
		this.setComponentType("ScrollView");
		this.#scrollOffset = Vector2.zero();
		this.#scrollContentSize = Vector2.zero();
		this.#isDragging = false;
		this.#dragStartViewPosition = Vector2.zero();
		this.#dragStartOffset = Vector2.zero();
		this.#scrollMode = ScrollMode.clamp;
		this.#scrollVelocity = Vector2.zero();
		this.#previousViewInputPosition = Vector2.zero();
		this.#currentViewInputPosition = Vector2.zero();
		this.#horizontalEnabled = true;
		this.#verticalEnabled = true;
		this.#dragSensitivity = 1.0;
		this.#verticalScrollBar = null;
		this.#horizontalScrollBar = null;
		this.#showsVerticalScrollBar = false;
		this.#showsHorizontalScrollBar = false;
		this.#wheelScrollScale = WHEEL_SCROLL_SCALE;
	}

	//==============================================================================
	// 노드에 붙음. (AnchoredWorldNode의 isInteractable을 자동 활성화)
	//==============================================================================
	/**
	 * @override
	 * @param { ComponentNode } node
	 */
	attach(node) {
		super.attach(node);
		if (node instanceof AnchoredWorldNode) {
			node.setInteractable(true);
		}
	}

	//==============================================================================
	// 터치 누름. (TouchRaycaster → AnchoredWorldNode → ScrollView)
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } viewInputPosition
	 */
	touchPress(viewInputPosition) {
		this.#isDragging = true;
		this.#dragStartViewPosition = Vector2.create(viewInputPosition.x, viewInputPosition.y);
		const scrollOffset = this.getScrollOffset();
		this.#dragStartOffset = Vector2.create(scrollOffset.x, scrollOffset.y);
		this.#scrollVelocity = Vector2.zero();
		this.#previousViewInputPosition = Vector2.create(viewInputPosition.x, viewInputPosition.y);
		this.#currentViewInputPosition = Vector2.create(viewInputPosition.x, viewInputPosition.y);
	}

	//==============================================================================
	// 터치 이동. (TouchRaycaster → AnchoredWorldNode → ScrollView)
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } viewInputPosition
	 */
	touchMove(viewInputPosition) {
		if (this.isDragging()) {
			this.#currentViewInputPosition = Vector2.create(viewInputPosition.x, viewInputPosition.y);
		}
	}

	//==============================================================================
	// 터치 뗌. (TouchRaycaster → AnchoredWorldNode → ScrollView)
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } viewInputPosition
	 */
	touchRelease(viewInputPosition) {
		this.#isDragging = false;
	}

	//==============================================================================
	// 터치 취소. (TouchRaycaster → AnchoredWorldNode → ScrollView)
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } viewInputPosition
	 */
	touchCancel(viewInputPosition) {
		this.#isDragging = false;
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

		// 스크롤바 자동 레이아웃.
		this.layoutScrollBars();

		// 드래그 중 오프셋 및 속도 계산.
		if (this.isDragging()) {
			const viewInputPosition = this.#currentViewInputPosition;
			const dragSensitivity = this.getDragSensitivity();
			const rawDeltaX = (viewInputPosition.x - this.#dragStartViewPosition.x) * dragSensitivity;
			const rawDeltaY = (viewInputPosition.y - this.#dragStartViewPosition.y) * dragSensitivity;
			const deltaX = this.isHorizontal() ? rawDeltaX : 0;
			const deltaY = this.isVertical() ? rawDeltaY : 0;
			const proposedOffset = Vector2.create(
				this.#dragStartOffset.x + deltaX,
				this.#dragStartOffset.y + deltaY
			);
			const scrollMode = this.getScrollMode();
			if (scrollMode === ScrollMode.elastic) {
				const contentSize = node.getContentSize();
				const elasticMaxX = 0;
				const scrollContentSize = this.getScrollContentSize();
				const elasticMinX = Math.min(0, contentSize.x - scrollContentSize.x);
				const elasticMaxY = 0;
				const elasticMinY = Math.min(0, contentSize.y - scrollContentSize.y);
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

				// 컨텐트의 위치 수정.
				const content = this.getContent();
				if (content) {
					const currentScrollOffset = this.getScrollOffset();
					content.setAnchoredPosition(currentScrollOffset);
				}

				if (timeDelta > 0) {
					const rawVelocityX = (viewInputPosition.x - this.#previousViewInputPosition.x) / timeDelta;
					const rawVelocityY = (viewInputPosition.y - this.#previousViewInputPosition.y) / timeDelta;
					const velocityX = this.isHorizontal() ? rawVelocityX : 0;
					const velocityY = this.isVertical() ? rawVelocityY : 0;
					this.#scrollVelocity = Vector2.create(velocityX, velocityY);
				}
			}
			else {
				this.applyScrollOffset(proposedOffset);
			}
			this.#previousViewInputPosition = Vector2.create(viewInputPosition.x, viewInputPosition.y);
		}

		const scrollMode = this.getScrollMode();
		if (scrollMode === ScrollMode.elastic && !this.isDragging()) {
			const contentSize = node.getContentSize();
			const physicsBoundsMaxX = 0;
			const scrollContentSize = this.getScrollContentSize();
			const physicsBoundsMinX = this.isHorizontal() ? Math.min(0, contentSize.x - scrollContentSize.x) : 0;
			const physicsBoundsMaxY = 0;
			const physicsBoundsMinY = this.isVertical() ? Math.min(0, contentSize.y - scrollContentSize.y) : 0;
			const springConstant = 1200;
			const dampingCoefficient = 30;
			const frictionCoefficient = 5;
			const scrollVelocity = this.getScrollVelocity();
			let physicsVelocityX = scrollVelocity.x;
			let physicsVelocityY = scrollVelocity.y;
			const currentScrollOffset = this.getScrollOffset();
			let physicsOffsetX = currentScrollOffset.x;
			let physicsOffsetY = currentScrollOffset.y;
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

			// 컨텐트의 위치 수정.
			const content = this.getContent();
			if (content) {
				const updatedScrollOffset = this.getScrollOffset();
				content.setAnchoredPosition(updatedScrollOffset);
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
		const scrollContentSize = this.getScrollContentSize();

		const maxX = 0;
		const minX = this.isHorizontal() ? Math.min(0, contentSize.x - scrollContentSize.x) : 0;
		const maxY = 0;
		const minY = this.isVertical() ? Math.min(0, contentSize.y - scrollContentSize.y) : 0;

		this.#scrollOffset = Vector2.create(
			Math.clamp(offset.x, minX, maxX),
			Math.clamp(offset.y, minY, maxY)
		);

		// 컨텐트의 위치 수정.
		const content = this.getContent();
		if (content) {
			const scrollOffset = this.getScrollOffset();
			content.setAnchoredPosition(scrollOffset);
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
	isHorizontal() {
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
	isVertical() {
		return this.#verticalEnabled;
	}

	//==============================================================================
	// 드래그 반영량 배율 설정. (1.0 = 기본, 2.0 = 두 배 빠르게)
	//==============================================================================
	/**
	 * @param { number } dragSensitivity
	 */
	setDragSensitivity(dragSensitivity) {
		this.#dragSensitivity = dragSensitivity;
	}

	//==============================================================================
	// 드래그 반영량 배율 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getDragSensitivity() {
		return this.#dragSensitivity;
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

		// 컨텐트의 크기 수정.
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

	//==============================================================================
	// 세로 스크롤바 노출 여부 설정. true 면 자동 생성하여 호스트 노드의 자식으로 추가.
	//==============================================================================
	/**
	 * @param { boolean } shows
	 */
	setShowsVerticalScrollBar(shows) {
		this.#showsVerticalScrollBar = !!shows;
		const node = this.getNode();
		if (this.#showsVerticalScrollBar) {
			if (!this.#verticalScrollBar && node) {
				const bar = new UIScrollBar();
				bar.setName("verticalScrollBar");
				bar.setAxis(ScrollBarAxis.vertical);
				bar.setScrollView(this);
				node.addChild(bar);
				this.#verticalScrollBar = bar;
			}
			if (this.#verticalScrollBar) this.#verticalScrollBar.setActive(true);
		}
		else {
			if (this.#verticalScrollBar) this.#verticalScrollBar.setActive(false);
		}
	}

	//==============================================================================
	// 가로 스크롤바 노출 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } shows
	 */
	setShowsHorizontalScrollBar(shows) {
		this.#showsHorizontalScrollBar = !!shows;
		const node = this.getNode();
		if (this.#showsHorizontalScrollBar) {
			if (!this.#horizontalScrollBar && node) {
				const bar = new UIScrollBar();
				bar.setName("horizontalScrollBar");
				bar.setAxis(ScrollBarAxis.horizontal);
				bar.setScrollView(this);
				node.addChild(bar);
				this.#horizontalScrollBar = bar;
			}
			if (this.#horizontalScrollBar) this.#horizontalScrollBar.setActive(true);
		}
		else {
			if (this.#horizontalScrollBar) this.#horizontalScrollBar.setActive(false);
		}
	}

	//==============================================================================
	// 세로 / 가로 스크롤바 인스턴스 반환. (커스터마이즈 용)
	//==============================================================================
	getVerticalScrollBar() {
		return this.#verticalScrollBar;
	}
	getHorizontalScrollBar() {
		return this.#horizontalScrollBar;
	}

	//==============================================================================
	// 스크롤바가 차지하는(reserved) 영역의 두께. (스크롤바가 활성/표시 중일 때만)
	//==============================================================================
	getVerticalScrollBarReservedWidth() {
		return (this.#showsVerticalScrollBar && this.#verticalScrollBar)
			? SCROLLBAR_THICKNESS + SCROLLBAR_MARGIN * 2
			: 0;
	}
	getHorizontalScrollBarReservedHeight() {
		return (this.#showsHorizontalScrollBar && this.#horizontalScrollBar)
			? SCROLLBAR_THICKNESS + SCROLLBAR_MARGIN * 2
			: 0;
	}

	//==============================================================================
	// 스크롤바를 제외한 실제 콘텐트가 그려질 수 있는 가시 영역 크기.
	// - 가로 스크롤바가 있으면 그 만큼 세로가 줄고, 세로 스크롤바가 있으면 가로가 준다.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getInnerContentSize() {
		const node = this.getNode();
		if (!node) return Vector2.zero();
		const viewportSize = node.getContentSize();
		const reservedX = this.getVerticalScrollBarReservedWidth();
		const reservedY = this.getHorizontalScrollBarReservedHeight();
		return Vector2.create(
			Math.max(0, viewportSize.x - reservedX),
			Math.max(0, viewportSize.y - reservedY),
		);
	}

	//==============================================================================
	// 매 tick 마다 스크롤바 위치 / 크기 갱신.
	//==============================================================================
	layoutScrollBars() {
		const node = this.getNode();
		if (!node) return;
		const viewportSize = node.getContentSize();
		const reservedX = this.getVerticalScrollBarReservedWidth();
		const reservedY = this.getHorizontalScrollBarReservedHeight();

		if (this.#verticalScrollBar && this.#showsVerticalScrollBar) {
			const x = viewportSize.x - SCROLLBAR_THICKNESS - SCROLLBAR_MARGIN;
			const y = SCROLLBAR_MARGIN;
			const w = SCROLLBAR_THICKNESS;
			const h = Math.max(0, viewportSize.y - SCROLLBAR_MARGIN * 2 - reservedY);
			this.#verticalScrollBar.setLocalPosition(Vector2.create(x, y));
			this.#verticalScrollBar.setContentSize(Vector2.create(w, h));
		}
		if (this.#horizontalScrollBar && this.#showsHorizontalScrollBar) {
			const x = SCROLLBAR_MARGIN;
			const y = viewportSize.y - SCROLLBAR_THICKNESS - SCROLLBAR_MARGIN;
			const w = Math.max(0, viewportSize.x - SCROLLBAR_MARGIN * 2 - reservedX);
			const h = SCROLLBAR_THICKNESS;
			this.#horizontalScrollBar.setLocalPosition(Vector2.create(x, y));
			this.#horizontalScrollBar.setContentSize(Vector2.create(w, h));
		}
	}

	//==============================================================================
	// 휠 입력 처리. (TouchRaycaster → UIScrollView)
	// - delta: 마우스 휠 누적값 (DOM WheelEvent 의 deltaX/deltaY 와 동일 부호. 아래 = +y)
	//==============================================================================
	/**
	 * @param { Vector2 } delta
	 */
	wheel(delta) {
		if (!delta) return;
		const offset = this.getScrollOffset();
		const dx = this.isHorizontal() ? delta.x * this.#wheelScrollScale : 0;
		const dy = this.isVertical() ? delta.y * this.#wheelScrollScale : 0;
		this.applyScrollOffset(Vector2.create(offset.x - dx, offset.y - dy));
		// 휠 입력 후엔 elastic 의 잔여 속도를 정리해 튕김을 방지.
		this.#scrollVelocity = Vector2.zero();
	}

	//==============================================================================
	// 휠 스크롤 배율 설정.
	//==============================================================================
	setWheelScrollScale(scale) {
		this.#wheelScrollScale = scale;
	}
}
