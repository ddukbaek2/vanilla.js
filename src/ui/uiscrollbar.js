//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../base/vector2.js";
import { Pivot } from "../base/pivot.js";
import { Color } from "../base/color.js";
import * as Math from "../base/math.js";
import { WorldNode } from "../core/node/worldnode.js";
import { Paint } from "../core/component/paint.js";


//==============================================================================
// 스크롤바 축.
//==============================================================================
export const ScrollBarAxis = {
	horizontal: "horizontal",
	vertical: "vertical",
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
		this.#thumbPaint.setColor(new Color(255, 255, 255, 0.6));
		this.#thumbPaint.setRoundSize(4);
		this.addChild(this.#thumbNode);
	}

	//==============================================================================
	// 대상 UIScrollView 설정.
	//==============================================================================
	setScrollView(scrollView) {
		this.#scrollView = scrollView;
	}

	//==============================================================================
	// 대상 UIScrollView 반환. (TouchRecognizer 가 자기 스크롤바의 ancestor scroll view
	//  인계 동작을 차단하는데 사용한다.)
	//==============================================================================
	getScrollView() {
		return this.#scrollView;
	}

	//==============================================================================
	// 축 설정. (ScrollBarAxis.vertical / horizontal)
	//==============================================================================
	setAxis(axis) {
		this.#axis = axis;
	}

	//==============================================================================
	// 트랙 색 설정.
	//==============================================================================
	setTrackColor(color) {
		this.#trackPaint.setColor(color);
	}

	//==============================================================================
	// 썸 색 설정.
	//==============================================================================
	setThumbColor(color) {
		this.#thumbPaint.setColor(color);
	}

	//==============================================================================
	// 썸 최소 길이 설정.
	//==============================================================================
	setMinThumbSize(size) {
		this.#minThumbSize = size;
	}

	//==============================================================================
	// 자동 숨김 설정. (콘텐트가 가시영역에 들어오면 트랙까지 숨김)
	//==============================================================================
	setAutoHide(autoHide) {
		this.#autoHide = autoHide;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
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
	touchRelease(viewInputPosition) {
		this.#isDraggingThumb = false;
	}

	//==============================================================================
	// 터치 취소.
	//==============================================================================
	touchCancel(viewInputPosition) {
		this.#isDraggingThumb = false;
	}
}
