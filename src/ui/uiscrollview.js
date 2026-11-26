//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { UIView } from "./uiview.js";
import { WorldNode } from "../core/node/worldnode.js";
import { Vector2 } from "../base/vector2.js";
import * as Math from "../base/math.js";
import { UIScrollBar, ScrollBarAxis } from "./uiscrollbar.js";
import { Mask } from "../core/component/mask.js";


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
	clamp: "clamp", // 경계를 넘지 않게 자른다.
	elastic: "elastic", // 경계를 넘으면 저항이 생기고 놓으면 튕겨 돌아온다.
};


//==============================================================================
// 스크롤뷰 컴포넌트.
// - 소유 노드의 getContentSize()를 가시 영역으로 사용한다.
// - 내부에 별도의 콘텐츠 노드를 생성하며, 드래그로 스크롤링할 수 있다.
// - require() 로 Mask 를 의존 선언하므로 부착되는 노드(WorldNode 계열)에 자동으로
//   Mask 가 추가되어 자식 클리핑이 동작한다.
// - 중첩 ScrollView를 지원한다. (TouchRaycaster와 연동)
//==============================================================================
/**
 * @example <caption>세로로 끄는 목록과 스크롤바</caption>
 * import { Engine, EngineConfiguration, UIScene, UIScrollView, UILabel, WorldNode, Paint, Color, Pivot, Vector2 } from "./build/vanilla.js";
 *
 * class ScrollScene extends UIScene {
 * 	create() {
 * 		super.create();
 * 		const viewportNode = new WorldNode();
 * 		viewportNode.setPivot(Pivot.topLeft.clone());
 * 		viewportNode.setAnchor(Pivot.topLeft.clone());
 * 		viewportNode.setContentSize(Vector2.create(320, 240));
 * 		viewportNode.setLocalPosition(Vector2.create(160, 60));
 * 		const scrollView = viewportNode.addComponent(UIScrollView);
 * 		scrollView.setBackgroundColor(new Color(0.1, 0.12, 0.16, 1));
 * 		scrollView.setHorizontal(false);
 * 		scrollView.setScrollMode("elastic");
 * 		scrollView.setShowsVerticalScrollBar(true);
 *
 * 		const rowCount = 20;
 * 		const rowHeight = 40;
 * 		const content = scrollView.getContent();
 * 		for (let rowIndex = 0; rowIndex < rowCount; ++rowIndex) {
 * 			const rowNode = new WorldNode();
 * 			rowNode.setPivot(Pivot.topLeft.clone());
 * 			rowNode.setAnchor(Pivot.topLeft.clone());
 * 			rowNode.setContentSize(Vector2.create(280, rowHeight - 4));
 * 			rowNode.setLocalPosition(Vector2.create(8, rowIndex * rowHeight + 2));
 * 			const rowPaint = rowNode.addComponent(Paint);
 * 			rowPaint.setColor(new Color(1, 1, 1, 0.06));
 * 			const rowLabel = rowNode.addComponent(UILabel);
 * 			rowLabel.setText("Row " + rowIndex);
 * 			content.addChild(rowNode);
 * 		}
 * 		scrollView.setScrollContentSize(Vector2.create(320, rowCount * rowHeight));
 * 		scrollView.setScrollOffset(Vector2.create(0, -120));
 * 		const root = this.getRoot();
 * 		root.addChild(viewportNode);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * const scene = new ScrollScene();
 * scene.setLoadingMinDurationMs(0);
 * engine.run(scene);
 */
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
	/** @private @type { boolean } */ #passesCrossAxisDrag; // 스크롤하지 않는 축으로 끄는 손가락을 누른 노드에 남길지.

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
		this.#passesCrossAxisDrag = false;
	}

	//==============================================================================
	// 의존 컴포넌트, 자식 클리핑을 위해 Mask 가 필요.
	//==============================================================================
	/**
	 * @override
	 * @returns { Function[] } 같은 노드에 함께 붙일 컴포넌트 목록. ([Mask])
	 */
	require() {
		return [Mask];
	}

	//==============================================================================
	// 노드에 붙음. (WorldNode 계열의 isInteractable 을 자동 활성화)
	//==============================================================================
	/**
	 * @override
	 * @param { ComponentNode } node 붙을 노드. (내용 크기가 보이는 영역이 된다)
	 */
	attach(node) {
		super.attach(node);
		if (node instanceof WorldNode) {
			node.setInteractable(true);
		}
	}

	//==============================================================================
	// 터치 누름. (TouchRaycaster → WorldNode → ScrollView)
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } viewInputPosition 입력 위치. (뷰 좌표)
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
	// 터치 이동. (TouchRaycaster → WorldNode → ScrollView)
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } viewInputPosition 입력 위치. (뷰 좌표, 끄는 중일 때만 담아 두고 tick 에서 반영한다)
	 */
	touchMove(viewInputPosition) {
		if (this.isDragging()) {
			this.#currentViewInputPosition = Vector2.create(viewInputPosition.x, viewInputPosition.y);
		}
	}

	//==============================================================================
	// 터치 뗌. (TouchRaycaster → WorldNode → ScrollView)
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } viewInputPosition 입력 위치. (뷰 좌표, 쓰지 않는다)
	 */
	touchRelease(viewInputPosition) {
		this.#isDragging = false;
	}

	//==============================================================================
	// 터치 취소. (TouchRaycaster → WorldNode → ScrollView)
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } viewInputPosition 입력 위치. (뷰 좌표, 쓰지 않는다)
	 */
	touchCancel(viewInputPosition) {
		this.#isDragging = false;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
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
	 * @param { Vector2 } offset 스크롤 오프셋. (콘텐츠 노드의 자리, 0 이 맨 위 왼쪽이고 내릴수록 음수, 끌 수 있는 축만 범위로 자르고 다른 축은 0)
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
	 * @param { Vector2 } offset 스크롤 오프셋. (0 이 맨 위 왼쪽이고 내릴수록 음수, 범위로 자른다)
	 * @example <caption>오프셋의 부호와 범위 자르기</caption>
	 * import { UIScrollView, WorldNode, Vector2 } from "./build/vanilla.js";
	 *
	 * const viewportNode = new WorldNode();
	 * viewportNode.setContentSize(Vector2.create(200, 100));
	 * const scrollView = viewportNode.addComponent(UIScrollView);
	 * scrollView.setScrollContentSize(Vector2.create(200, 500));
	 * scrollView.setScrollOffset(Vector2.create(0, -1000));
	 * const clampedOffset = scrollView.getScrollOffset();
	 * console.log(clampedOffset.y);
	 * scrollView.wheel(Vector2.create(0, -150));
	 * const wheeledOffset = scrollView.getScrollOffset();
	 * console.log(wheeledOffset.y);
	 */
	setScrollOffset(offset) {
		this.applyScrollOffset(offset);
	}

	//==============================================================================
	// 스크롤 오프셋 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 스크롤 오프셋. (복사하지 않은 원본, 0 이 맨 위 왼쪽이고 내릴수록 음수)
	 */
	getScrollOffset() {
		return this.#scrollOffset;
	}

	//==============================================================================
	// 가로 스크롤 활성 설정. (false = 가로 스크롤 비활성)
	//==============================================================================
	/**
	 * @param { boolean } horizontal 참이면 가로로 끌 수 있다.
	 */
	setHorizontal(horizontal) {
		this.#horizontalEnabled = horizontal;
	}

	//==============================================================================
	// 가로 스크롤 활성 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 가로로 끌 수 있으면 참.
	 */
	isHorizontal() {
		return this.#horizontalEnabled;
	}

	//==============================================================================
	// 세로 스크롤 활성 설정. (false = 세로 스크롤 비활성)
	//==============================================================================
	/**
	 * @param { boolean } vertical 참이면 세로로 끌 수 있다.
	 */
	setVertical(vertical) {
		this.#verticalEnabled = vertical;
	}

	//==============================================================================
	// 세로 스크롤 활성 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 세로로 끌 수 있으면 참.
	 */
	isVertical() {
		return this.#verticalEnabled;
	}

	//==============================================================================
	// 스크롤하지 않는 축으로 끄는 손가락을 누른 노드에 남길지 설정. (기본 false)
	// - false 면 지금까지처럼 어느 쪽이든 드래그 임계를 넘으면 스크롤 뷰가 가져간다.
	// - true 면 세로만 스크롤하는 뷰에서 가로로 더 많이 끈 손가락(가로만이면 세로로)은 가져가지 않고,
	//   누른 노드(슬라이더 등)가 곧바로 누름을 받아 끝까지 끈다. 두 축 모두 스크롤하면 늘 가져간다.
	//==============================================================================
	/**
	 * @param { boolean } passes 참이면 스크롤하지 않는 축의 드래그를 누른 노드에 남긴다.
	 * @example <caption>세로 목록 안의 가로 드래그 남기기</caption>
	 * import { UIScrollView, WorldNode, Vector2 } from "./build/vanilla.js";
	 *
	 * const viewportNode = new WorldNode();
	 * viewportNode.setContentSize(Vector2.create(200, 100));
	 * const scrollView = viewportNode.addComponent(UIScrollView);
	 * scrollView.setHorizontal(false);
	 * scrollView.setPassesCrossAxisDrag(true);
	 * const isSidewaysTaken = scrollView.isScrollDrag(30, 5);
	 * const isDownwardTaken = scrollView.isScrollDrag(5, 30);
	 * console.log(isSidewaysTaken, isDownwardTaken);
	 */
	setPassesCrossAxisDrag(passes) {
		this.#passesCrossAxisDrag = !!passes;
	}

	//==============================================================================
	// 스크롤하지 않는 축으로 끄는 손가락을 누른 노드에 남기는지 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 스크롤하지 않는 축의 드래그를 남기면 참.
	 */
	isPassingCrossAxisDrag() {
		return this.#passesCrossAxisDrag;
	}

	//==============================================================================
	// 끈 방향이 이 뷰가 가져갈 드래그인지. (스크롤하지 않는 축의 드래그를 남기는 옵션을 켰을 때만 가려낸다)
	//==============================================================================
	/**
	 * @param { number } deltaX 누른 자리에서 끈 가로 거리. (픽셀, 부호는 보지 않는다)
	 * @param { number } deltaY 누른 자리에서 끈 세로 거리. (픽셀, 부호는 보지 않는다)
	 * @returns { boolean } 이 뷰가 가져가면 참. (옵션이 꺼졌거나 두 축 모두 스크롤하면 늘 참, 끌 수 있는 축이 없으면 거짓)
	 */
	isScrollDrag(deltaX, deltaY) {
		if (!this.#passesCrossAxisDrag) {
			return true;
		}
		const horizontalEnabled = this.#horizontalEnabled;
		const verticalEnabled = this.#verticalEnabled;
		if (horizontalEnabled && verticalEnabled) {
			return true;
		}
		const absoluteX = System.Math.abs(deltaX);
		const absoluteY = System.Math.abs(deltaY);
		if (verticalEnabled) {
			return absoluteY >= absoluteX;
		}
		if (horizontalEnabled) {
			return absoluteX >= absoluteY;
		}
		return false;
	}

	//==============================================================================
	// 드래그 반영량 배율 설정. (1.0 = 기본, 2.0 = 두 배 빠르게)
	//==============================================================================
	/**
	 * @param { number } dragSensitivity 드래그 반영량 배율. (끈 거리에 곱한다)
	 */
	setDragSensitivity(dragSensitivity) {
		this.#dragSensitivity = dragSensitivity;
	}

	//==============================================================================
	// 드래그 반영량 배율 반환.
	//==============================================================================
	/**
	 * @returns { number } 드래그 반영량 배율. (기본 1)
	 */
	getDragSensitivity() {
		return this.#dragSensitivity;
	}

	//==============================================================================
	// 스크롤 모드 설정.
	//==============================================================================
	/**
	 * @param { string } scrollMode "clamp" 면 경계에서 멈추고, "elastic" 이면 경계를 넘을 때 저항이 생기고 놓으면 튕겨 돌아온다.
	 */
	setScrollMode(scrollMode) {
		this.#scrollMode = scrollMode;
	}

	//==============================================================================
	// 스크롤 모드 반환.
	//==============================================================================
	/**
	 * @returns { string } "clamp" 나 "elastic". (기본 "clamp")
	 */
	getScrollMode() {
		return this.#scrollMode;
	}

	//==============================================================================
	// 스크롤 콘텐츠 크기 설정. (가시 영역보다 크게 설정해야 스크롤 가능)
	//==============================================================================
	/**
	 * @param { Vector2 } scrollContentSize 스크롤할 콘텐츠 크기. (픽셀, 복제해 콘텐츠 노드의 내용 크기에도 넣는다)
	 */
	setScrollContentSize(scrollContentSize) {
		scrollContentSize = scrollContentSize.clone();
		this.#scrollContentSize = scrollContentSize;

		// 컨텐트의 크기 수정.
		const content = this.getContent();
		if (content) {
			content.setContentSize(scrollContentSize);
		}
	}

	//==============================================================================
	// 스크롤 콘텐츠 크기 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 스크롤할 콘텐츠 크기. (픽셀)
	 */
	getScrollContentSize() {
		return this.#scrollContentSize;
	}


	//==============================================================================
	// 드래그 중 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 누르고 있으면 참.
	 */
	isDragging() {
		return this.#isDragging;
	}

	//==============================================================================
	// 현재 스크롤 속도 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 스크롤 속도. (초당 픽셀, elastic 모드에서만 셈한다)
	 */
	getScrollVelocity() {
		return this.#scrollVelocity;
	}

	//==============================================================================
	// 세로 스크롤바 노출 여부 설정. true 면 자동 생성하여 호스트 노드의 자식으로 추가.
	//==============================================================================
	/**
	 * @param { boolean } shows 참이면 보인다. (노드에 붙기 전이면 스크롤바를 만들지 못한다)
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
	 * @param { boolean } shows 참이면 보인다. (처음 켤 때 만들어 노드의 자식으로 붙인다, 노드에 붙기 전이면 만들지 못한다)
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
	/**
	 * @returns { UIScrollBar | null } 세로 스크롤바. (한 번도 켜지 않았으면 null)
	 */
	getVerticalScrollBar() {
		return this.#verticalScrollBar;
	}

	//==============================================================================
	// 가로 스크롤바 반환. (커스터마이즈 용)
	//==============================================================================
	/**
	 * @returns { UIScrollBar | null } 가로 스크롤바. (한 번도 켜지 않았으면 null)
	 */
	getHorizontalScrollBar() {
		return this.#horizontalScrollBar;
	}

	//==============================================================================
	// 스크롤바가 차지하는(reserved) 영역의 두께. (스크롤바가 활성/표시 중일 때만)
	//==============================================================================
	/**
	 * @returns { number } 세로 스크롤바가 차지하는 너비. (픽셀, 보일 때 24, 아니면 0)
	 */
	getVerticalScrollBarReservedWidth() {
		return (this.#showsVerticalScrollBar && this.#verticalScrollBar)
			? SCROLLBAR_THICKNESS + SCROLLBAR_MARGIN * 2
			: 0;
	}

	//==============================================================================
	// 가로 스크롤바가 차지하는 영역의 두께. (스크롤바가 보일 때만)
	//==============================================================================
	/**
	 * @returns { number } 가로 스크롤바가 차지하는 높이. (픽셀, 보일 때 24, 아니면 0)
	 */
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
	 * @returns { Vector2 } 스크롤바 몫을 뺀 보이는 영역 크기. (픽셀, 노드에 붙기 전이면 0)
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
	 * @param { Vector2 } delta 휠 누적값. (휠 스크롤 배율을 곱해 오프셋에서 뺀다, 없으면 아무것도 하지 않는다)
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
	/**
	 * @param { number } scale 휠 누적값에 곱할 배율. (기본 1)
	 */
	setWheelScrollScale(scale) {
		this.#wheelScrollScale = scale;
	}
}
