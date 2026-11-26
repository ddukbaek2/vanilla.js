//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../base/vector2.js";
import { Rect } from "../base/rect.js";
import { Pivot } from "../base/pivot.js";
import { Color } from "../base/color.js";
import * as Math from "../base/math.js";
import { WorldNode } from "../core/node/worldnode.js";
import { Paint } from "../core/component/paint.js";


//==============================================================================
// 스크롤바 축.
//==============================================================================
export const ScrollBarAxis = {
	horizontal: "horizontal", // 가로 스크롤바. (트랙 너비를 따라 썸이 움직이고 가로 오프셋을 바꾼다)
	vertical: "vertical",     // 세로 스크롤바. (트랙 높이를 따라 썸이 움직이고 세로 오프셋을 바꾼다, 기본)
};


//==============================================================================
// 스크롤바.
// - 대상 UIScrollView 의 스크롤 상태를 트랙(배경) + 썸(드래그 핸들)으로 표시한다.
// - 사용자가 썸 또는 트랙을 드래그하면 대상 UIScrollView 의 scrollOffset 을 직접 갱신.
// - 매 tick 에 대상의 offset / contentSize / 가시 영역을 읽어 썸 위치/크기를 갱신.
//
// 배치 주의:
// - 본 노드는 반드시 UIScrollView 가 attach 된 노드의 자식으로 두지 말 것.
//   (TouchRecognizer 가 ancestor scrollview 를 찾아 드래그를 그쪽에 인계해 버린다.)
//   대신 sibling 으로 두어 raycast 결과가 ScrollBar 자신이 되도록 한다.
//==============================================================================
/**
 * @example <caption>스크롤 뷰 옆에 세로 스크롤바 세우기</caption>
 * import { Engine, EngineConfiguration, UIScene, UIScrollView, UIScrollBar, ScrollBarAxis, WorldNode, Paint, Color, Pivot, Vector2 } from "./build/vanilla.js";
 *
 * class ScrollBarScene extends UIScene {
 * 	create() {
 * 		super.create();
 * 		const root = this.getRoot();
 * 		const viewportNode = new WorldNode();
 * 		viewportNode.setPivot(Pivot.topLeft.clone());
 * 		viewportNode.setAnchor(Pivot.topLeft.clone());
 * 		viewportNode.setContentSize(Vector2.create(300, 240));
 * 		viewportNode.setLocalPosition(Vector2.create(160, 60));
 * 		const scrollView = viewportNode.addComponent(UIScrollView);
 * 		scrollView.setHorizontal(false);
 * 		const rowCount = 24;
 * 		const rowHeight = 40;
 * 		const content = scrollView.getContent();
 * 		for (let rowIndex = 0; rowIndex < rowCount; ++rowIndex) {
 * 			const rowNode = new WorldNode();
 * 			rowNode.setPivot(Pivot.topLeft.clone());
 * 			rowNode.setAnchor(Pivot.topLeft.clone());
 * 			rowNode.setContentSize(Vector2.create(300, rowHeight - 4));
 * 			rowNode.setLocalPosition(Vector2.create(0, rowIndex * rowHeight));
 * 			const rowPaint = rowNode.addComponent(Paint);
 * 			rowPaint.setColor(new Color(0.2, 0.3 + (rowIndex % 2) * 0.1, 0.5, 1));
 * 			content.addChild(rowNode);
 * 		}
 * 		scrollView.setScrollContentSize(Vector2.create(300, rowCount * rowHeight));
 * 		root.addChild(viewportNode);
 *
 * 		const scrollBar = new UIScrollBar();
 * 		scrollBar.setScrollView(scrollView);
 * 		scrollBar.setAxis(ScrollBarAxis.vertical);
 * 		scrollBar.setContentSize(Vector2.create(10, 240));
 * 		scrollBar.setLocalPosition(Vector2.create(466, 60));
 * 		scrollBar.setTrackColor(new Color(1, 1, 1, 0.1));
 * 		scrollBar.setThumbColor(new Color(1, 1, 1, 0.7));
 * 		scrollBar.setMinThumbSize(32);
 * 		root.addChild(scrollBar);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * const scene = new ScrollBarScene();
 * scene.setLoadingMinDurationMs(0);
 * engine.run(scene);
 */
export class UIScrollBar extends WorldNode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { * } */ #scrollView;          // 대상 UIScrollView 컴포넌트.
	/** @private @type { string } */ #axis;
	/** @private @type { Paint } */ #trackPaint;
	/** @private @type { WorldNode } */ #thumbNode;
	/** @private @type { Paint } */ #thumbPaint;
	/** @private @type { boolean } */ #isDraggingThumb;
	/** @private @type { Vector2 } */ #dragStartViewPosition;
	/** @private @type { Vector2 } */ #dragStartScrollOffset;
	/** @private @type { number } */ #minThumbSize;
	/** @private @type { boolean } */ #autoHide;       // 콘텐트가 가시영역에 들어오면 트랙까지 숨길지.

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.#scrollView = null;
		this.#axis = ScrollBarAxis.vertical;
		this.#isDraggingThumb = false;
		this.#dragStartViewPosition = Vector2.zero();
		this.#dragStartScrollOffset = Vector2.zero();
		this.#minThumbSize = 24;
		this.#autoHide = true;

		this.setPivot(Pivot.topLeft);
		this.setAnchor(Pivot.topLeft);
		this.setInteractable(true);

		this.#trackPaint = this.addComponent(Paint);
		this.#trackPaint.setColor(new Color(0, 0, 0, 0.15));
		this.#trackPaint.setRoundSize(4);

		this.#thumbNode = new WorldNode();
		this.#thumbNode.setName("thumb");
		this.#thumbNode.setPivot(Pivot.topLeft);
		this.#thumbNode.setAnchor(Pivot.topLeft);
		this.#thumbPaint = this.#thumbNode.addComponent(Paint);
		this.#thumbPaint.setColor(new Color(1, 1, 1, 0.6));
		this.#thumbPaint.setRoundSize(4);
		this.addChild(this.#thumbNode);
	}

	//==============================================================================
	// 대상 UIScrollView 설정.
	//==============================================================================
	/**
	 * @param { UIScrollView | null } scrollView 상태를 보이고 끌기로 오프셋을 바꿀 스크롤 뷰. (null 이면 썸을 끄고 눌러도 아무것도 하지 않는다)
	 */
	setScrollView(scrollView) {
		this.#scrollView = scrollView;
	}

	//==============================================================================
	// 대상 UIScrollView 반환. (TouchRecognizer 가 자기 스크롤바의 ancestor scroll view
	//  인계 동작을 차단하는데 사용한다.)
	//==============================================================================
	/**
	 * @returns { UIScrollView | null } setScrollView 로 준 스크롤 뷰. (주지 않았으면 null)
	 */
	getScrollView() {
		return this.#scrollView;
	}

	//==============================================================================
	// 축 설정. (ScrollBarAxis.vertical / horizontal)
	//==============================================================================
	/**
	 * @param { string } axis 스크롤바 축. (ScrollBarAxis 값, 기본 vertical)
	 */
	setAxis(axis) {
		this.#axis = axis;
	}

	//==============================================================================
	// 축 반환.
	//==============================================================================
	/**
	 * @returns { string } 스크롤바 축. (ScrollBarAxis 값)
	 */
	getAxis() {
		return this.#axis;
	}

	//==============================================================================
	// 지금 썸 사각형. (스크롤바 노드 영역 안, 썸이 꺼져 있으면 null)
	//==============================================================================
	/**
	 * @returns { Rect | null } 썸 사각형. (스크롤바 노드 로컬 좌표, 썸이 꺼져 있으면 null)
	 * @example <caption>오프셋에 따라 썸이 트랙을 따라 내려가기</caption>
	 * import { UIScrollView, UIScrollBar, WorldNode, Vector2 } from "./build/vanilla.js";
	 *
	 * const viewportNode = new WorldNode();
	 * viewportNode.setContentSize(Vector2.create(200, 100));
	 * const scrollView = viewportNode.addComponent(UIScrollView);
	 * scrollView.setScrollContentSize(Vector2.create(200, 400));
	 * const scrollBar = new UIScrollBar();
	 * scrollBar.setScrollView(scrollView);
	 * scrollBar.setContentSize(Vector2.create(8, 100));
	 * scrollBar.tick(0);
	 * const topThumbRect = scrollBar.getThumbRect();
	 * scrollView.setScrollOffset(Vector2.create(0, -300));
	 * scrollBar.tick(0);
	 * const bottomThumbRect = scrollBar.getThumbRect();
	 * console.log(topThumbRect.size.y, bottomThumbRect.position.y);
	 */
	getThumbRect() {
		if (!this.#thumbNode.isActive()) {
			return null;
		}
		const thumbPosition = this.#thumbNode.getLocalPosition();
		const thumbSize = this.#thumbNode.getContentSize();
		return Rect.create(thumbPosition.x, thumbPosition.y, thumbSize.x, thumbSize.y);
	}

	//==============================================================================
	// 트랙 색 설정.
	//==============================================================================
	/**
	 * @param { Color } color 트랙(바탕) 색. (트랙 Paint 에 그대로 건다, 기본 검정 알파 0.15)
	 */
	setTrackColor(color) {
		this.#trackPaint.setColor(color);
	}

	//==============================================================================
	// 썸 색 설정.
	//==============================================================================
	/**
	 * @param { Color } color 썸(끄는 손잡이) 색. (썸 노드 Paint 에 그대로 건다, 기본 흰색 알파 0.6)
	 */
	setThumbColor(color) {
		this.#thumbPaint.setColor(color);
	}

	//==============================================================================
	// 트랙 색 반환. (트랙 Paint 의 색)
	//==============================================================================
	/**
	 * @returns { Color } 트랙 색. (트랙 Paint 가 쥔 색 그대로)
	 */
	getTrackColor() {
		return this.#trackPaint.getColor();
	}

	//==============================================================================
	// 썸 색 반환. (썸 노드 Paint 의 색)
	//==============================================================================
	/**
	 * @returns { Color } 썸 색. (썸 노드 Paint 가 쥔 색 그대로)
	 */
	getThumbColor() {
		return this.#thumbPaint.getColor();
	}

	//==============================================================================
	// 썸 최소 길이 설정.
	//==============================================================================
	/**
	 * @param { number } size 썸 길이의 하한. (픽셀, 기본 24, 콘텐트가 길어 썸이 이보다 짧아지면 이 길이로 둔다)
	 */
	setMinThumbSize(size) {
		this.#minThumbSize = size;
	}

	//==============================================================================
	// 자동 숨김 설정. (콘텐트가 가시영역에 들어오면 트랙까지 숨김)
	//==============================================================================
	/**
	 * @param { boolean } autoHide 참이면 스크롤할 것이 없을 때 스크롤바 노드까지 끈다. (기본 참, 거짓이면 썸만 끈다)
	 */
	setAutoHide(autoHide) {
		this.#autoHide = autoHide;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초, 노드 갱신에 넘기고 썸 자리를 다시 맞춘다)
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
		this.updateThumb();
	}

	//==============================================================================
	// 트랙 길이 / 가시 영역 / 콘텐트 크기로부터 썸의 위치와 크기를 갱신.
	//==============================================================================
	updateThumb() {
		const scrollView = this.#scrollView;
		if (!scrollView) {
			this.#thumbNode.setActive(false);
			return;
		}
		const scrollNode = scrollView.getNode();
		if (!scrollNode) {
			this.#thumbNode.setActive(false);
			return;
		}

		const viewportSize = scrollNode.getContentSize();
		const contentSize = scrollView.getScrollContentSize();
		const trackSize = this.getContentSize();
		const offset = scrollView.getScrollOffset();
		const isVertical = this.#axis === ScrollBarAxis.vertical;
		const viewportLength = isVertical ? viewportSize.y : viewportSize.x;
		const contentLength = isVertical ? contentSize.y : contentSize.x;
		const trackLength = isVertical ? trackSize.y : trackSize.x;
		const offsetAlongAxis = isVertical ? offset.y : offset.x;

		// 콘텐트가 가시 영역 이내면 스크롤 불필요.
		if (contentLength <= viewportLength || trackLength <= 0) {
			this.#thumbNode.setActive(false);
			if (this.#autoHide) {
				this.setActive(false);
			}
			return;
		}
		this.setActive(true);
		this.#thumbNode.setActive(true);

		const ratio = viewportLength / contentLength;
		const thumbLength = Math.max(this.#minThumbSize, trackLength * ratio);
		const scrollableContent = contentLength - viewportLength;
		const scrollableTrack = trackLength - thumbLength;
		const progress = scrollableContent > 0
			? Math.clamp01(-offsetAlongAxis / scrollableContent)
			: 0;
		const thumbPosAlongAxis = scrollableTrack * progress;

		if (isVertical) {
			this.#thumbNode.setLocalPosition(Vector2.create(0, thumbPosAlongAxis));
			this.#thumbNode.setContentSize(Vector2.create(trackSize.x, thumbLength));
		}
		else {
			this.#thumbNode.setLocalPosition(Vector2.create(thumbPosAlongAxis, 0));
			this.#thumbNode.setContentSize(Vector2.create(thumbLength, trackSize.y));
		}
	}

	//==============================================================================
	// 트랙 좌표(view) 위치를 받아 콘텐트 오프셋을 갱신. 트랙 클릭 시 사용.
	// - 썸 중앙이 클릭 위치에 오도록 진행도 계산.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 누른 자리. (뷰 좌표, 스크롤바의 월드 위치를 빼서 트랙 위 자리로 본다)
	 */
	applyTrackHitPosition(viewInputPosition) {
		const scrollView = this.#scrollView;
		if (!scrollView) return;
		const scrollNode = scrollView.getNode();
		if (!scrollNode) return;

		const viewportSize = scrollNode.getContentSize();
		const contentSize = scrollView.getScrollContentSize();
		const trackSize = this.getContentSize();
		const isVertical = this.#axis === ScrollBarAxis.vertical;
		const viewportLength = isVertical ? viewportSize.y : viewportSize.x;
		const contentLength = isVertical ? contentSize.y : contentSize.x;
		const trackLength = isVertical ? trackSize.y : trackSize.x;
		if (contentLength <= viewportLength || trackLength <= 0) return;

		const ratio = viewportLength / contentLength;
		const thumbLength = Math.max(this.#minThumbSize, trackLength * ratio);
		const scrollableContent = contentLength - viewportLength;
		const scrollableTrack = trackLength - thumbLength;
		if (scrollableTrack <= 0) return;

		const trackGlobal = this.getPosition();
		const localOnAxis = isVertical
			? viewInputPosition.y - trackGlobal.y
			: viewInputPosition.x - trackGlobal.x;
		const desiredThumbHead = Math.clamp(localOnAxis - thumbLength * 0.5, 0, scrollableTrack);
		const progress = desiredThumbHead / scrollableTrack;
		const newOffsetOnAxis = -progress * scrollableContent;

		const currentOffset = scrollView.getScrollOffset();
		scrollView.setScrollOffset(Vector2.create(
			isVertical ? currentOffset.x : newOffsetOnAxis,
			isVertical ? newOffsetOnAxis : currentOffset.y,
		));
	}

	//==============================================================================
	// 썸이 viewInputPosition 안에 있는지.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 볼 자리. (뷰 좌표)
	 * @returns { boolean } 썸 사각형 안이면 참. (가장자리도 든다)
	 */
	isInsideThumb(viewInputPosition) {
		const thumbGlobalPos = this.#thumbNode.getPosition();
		const thumbSize = this.#thumbNode.getContentSize();
		return viewInputPosition.x >= thumbGlobalPos.x
			&& viewInputPosition.x <= thumbGlobalPos.x + thumbSize.x
			&& viewInputPosition.y >= thumbGlobalPos.y
			&& viewInputPosition.y <= thumbGlobalPos.y + thumbSize.y;
	}

	//==============================================================================
	// 터치 누름. (썸 hit 이면 그 자리에서 드래그 시작, 트랙 hit 이면 점프 후 드래그)
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 누른 자리. (뷰 좌표)
	 * @example <caption>트랙 끝을 눌러 뛰고 썸을 끌어 올리기</caption>
	 * import { UIScrollView, UIScrollBar, WorldNode, Vector2 } from "./build/vanilla.js";
	 *
	 * const viewportNode = new WorldNode();
	 * viewportNode.setContentSize(Vector2.create(200, 100));
	 * const scrollView = viewportNode.addComponent(UIScrollView);
	 * scrollView.setScrollContentSize(Vector2.create(200, 400));
	 * const scrollBar = new UIScrollBar();
	 * scrollBar.setScrollView(scrollView);
	 * scrollBar.setContentSize(Vector2.create(8, 100));
	 * scrollBar.tick(0);
	 * scrollBar.touchPress(Vector2.create(4, 100));
	 * const jumpedOffset = scrollView.getScrollOffset();
	 * scrollBar.touchMove(Vector2.create(4, 62.5));
	 * scrollBar.touchRelease(Vector2.create(4, 62.5));
	 * const draggedOffset = scrollView.getScrollOffset();
	 * console.log(jumpedOffset.y, draggedOffset.y);
	 */
	touchPress(viewInputPosition) {
		if (!this.#scrollView) return;
		if (!this.isInsideThumb(viewInputPosition)) {
			this.applyTrackHitPosition(viewInputPosition);
		}
		this.#isDraggingThumb = true;
		this.#dragStartViewPosition = Vector2.create(viewInputPosition.x, viewInputPosition.y);
		const offset = this.#scrollView.getScrollOffset();
		this.#dragStartScrollOffset = Vector2.create(offset.x, offset.y);
	}

	//==============================================================================
	// 터치 이동.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 옮긴 자리. (뷰 좌표, 누른 자리부터 끈 길이를 트랙 대 콘텐트 비율로 오프셋에 옮긴다)
	 */
	touchMove(viewInputPosition) {
		if (!this.#isDraggingThumb || !this.#scrollView) return;
		const scrollNode = this.#scrollView.getNode();
		if (!scrollNode) return;

		const viewportSize = scrollNode.getContentSize();
		const contentSize = this.#scrollView.getScrollContentSize();
		const trackSize = this.getContentSize();
		const isVertical = this.#axis === ScrollBarAxis.vertical;
		const viewportLength = isVertical ? viewportSize.y : viewportSize.x;
		const contentLength = isVertical ? contentSize.y : contentSize.x;
		const trackLength = isVertical ? trackSize.y : trackSize.x;
		if (contentLength <= viewportLength || trackLength <= 0) return;

		const ratio = viewportLength / contentLength;
		const thumbLength = Math.max(this.#minThumbSize, trackLength * ratio);
		const scrollableContent = contentLength - viewportLength;
		const scrollableTrack = trackLength - thumbLength;
		if (scrollableTrack <= 0) return;

		// 드래그한 픽셀 만큼 트랙에서 썸이 움직이고, 그 비율로 콘텐트가 반대로 움직인다.
		const dragDelta = isVertical
			? viewInputPosition.y - this.#dragStartViewPosition.y
			: viewInputPosition.x - this.#dragStartViewPosition.x;
		const offsetDelta = -dragDelta * (scrollableContent / scrollableTrack);

		const startOffset = this.#dragStartScrollOffset;
		this.#scrollView.setScrollOffset(Vector2.create(
			isVertical ? startOffset.x : startOffset.x + offsetDelta,
			isVertical ? startOffset.y + offsetDelta : startOffset.y,
		));
	}

	//==============================================================================
	// 터치 뗌.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 뗀 자리. (뷰 좌표, 쓰지 않는다)
	 */
	touchRelease(viewInputPosition) {
		this.#isDraggingThumb = false;
	}

	//==============================================================================
	// 터치 취소.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 취소된 때의 자리. (뷰 좌표, 쓰지 않는다)
	 */
	touchCancel(viewInputPosition) {
		this.#isDraggingThumb = false;
	}
}
