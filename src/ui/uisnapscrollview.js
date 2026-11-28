//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { UIScrollView, ScrollMode } from "./uiscrollview.js";
import { Vector2 } from "../base/vector2.js";
import * as Math from "../base/math.js";
import { Tween } from "../core/tween.js";


//==============================================================================
// 스냅 스크롤뷰 컴포넌트.
// - ScrollView를 상속하며, 드래그 해제 시 지정한 아이템 중앙으로 스냅된다.
// - 아이템 크기가 각각 달라도 각 아이템 중앙이 뷰포트 중앙에 오도록 스냅된다.
// - 가로 스냅: setHorizontal(true), setVertical(false) (기본값)
// - 세로 스냅: setHorizontal(false), setVertical(true)
//
// [스냅 동작 설정]
// - setSnapToNearest(false) : 1회 스와이프 시 1칸만 이동. (기본값)
//   끄는 동안 오프셋은 지금 칸 ±1 칸 범위를 넘지 않는다. 놓을 때 드래그 속도가 setVelocityThreshold 이상이면
//   그 방향으로 한 칸 넘기고(플링), 아니면 끈 거리가 옆 칸 크기의 setPageChangeThreshold 비율 이상일 때 넘긴다.
// - setSnapToNearest(true)  : 드래그한 위치에서 가장 가까운 아이템으로 스냅. (끄는 동안 칸 범위를 자르지 않아 여러 칸을 지날 수 있다)
// - setVelocityThreshold(px/s): 1칸 모드에서 방향을 결정할 최소 속도. (기본값: 200, 스크롤 오프셋이 움직인 초당 픽셀)
//
// [페이지 이동]
// - pageTo(index, smooth): 지정 인덱스로 이동. smooth=true이면 트윈, false이면 즉시 이동.
//==============================================================================
/**
 * @example <caption>가로로 넘기는 다섯 쪽</caption>
 * import { Engine, EngineConfiguration, UIScene, UISnapScrollView, UILabel, WorldNode, Paint, Color, Pivot, Vector2 } from "./build/vanilla.js";
 *
 * class PagerScene extends UIScene {
 * 	create() {
 * 		super.create();
 * 		const pageWidth = 360;
 * 		const pageHeight = 200;
 * 		const pageCount = 5;
 * 		const viewportNode = new WorldNode();
 * 		viewportNode.setPivot(Pivot.topLeft.clone());
 * 		viewportNode.setAnchor(Pivot.topLeft.clone());
 * 		viewportNode.setContentSize(Vector2.create(pageWidth, pageHeight));
 * 		viewportNode.setLocalPosition(Vector2.create(140, 80));
 * 		const snapScrollView = viewportNode.addComponent(UISnapScrollView);
 * 		snapScrollView.setPageChangeThreshold(0.25);
 *
 * 		const content = snapScrollView.getContent();
 * 		for (let pageIndex = 0; pageIndex < pageCount; ++pageIndex) {
 * 			const pageNode = new WorldNode();
 * 			pageNode.setPivot(Pivot.topLeft.clone());
 * 			pageNode.setAnchor(Pivot.topLeft.clone());
 * 			pageNode.setContentSize(Vector2.create(pageWidth, pageHeight));
 * 			pageNode.setLocalPosition(Vector2.create(pageIndex * pageWidth, 0));
 * 			const pagePaint = pageNode.addComponent(Paint);
 * 			pagePaint.setColor(new Color(0.2 + pageIndex * 0.15, 0.3, 0.6, 1));
 * 			const pageLabel = pageNode.addComponent(UILabel);
 * 			pageLabel.setText("Page " + (pageIndex + 1));
 * 			pageLabel.setFontSize(28);
 * 			content.addChild(pageNode);
 * 		}
 * 		snapScrollView.setScrollContentSize(Vector2.create(pageWidth * pageCount, pageHeight));
 * 		snapScrollView.pageTo(2, false);
 * 		const root = this.getRoot();
 * 		root.addChild(viewportNode);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * const scene = new PagerScene();
 * scene.setLoadingMinDurationMs(0);
 * engine.run(scene);
 */
export class UISnapScrollView extends UIScrollView {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Tween | null } */ #snapTween;
	/** @private @type { number } */ #snapCurrentIndex;
	/** @private @type { boolean } */ #prevIsDragging;
	/** @private @type { boolean } */ #isSnapToNearest;
	/** @private @type { number } */ #velocityThreshold;
	/** @private @type { number } */ #pageChangeThreshold; // 느린 스와이프 시 페이지 전환 임계값 (아이템 크기 대비 비율).
	/** @private @type { number } */ #dragVelocity; // 끄는 동안 스크롤 축 오프셋이 움직인 속도. (초당 픽셀)
	/** @private @type { number } */ #previousDragAxisOffset; // 지난 tick 의 칸 범위 자르기 전 스크롤 축 오프셋.

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setComponentType("SnapScrollView");
		this.setScrollMode(ScrollMode.clamp);
		this.setHorizontal(true);
		this.setVertical(false);
		this.#snapTween = null;
		this.#snapCurrentIndex = 0;
		this.#prevIsDragging = false;
		this.#isSnapToNearest = false;
		this.#velocityThreshold = 200;
		this.#pageChangeThreshold = 0.35;
		this.#dragVelocity = 0;
		this.#previousDragAxisOffset = 0;
	}

	//==============================================================================
	// 스냅 모드 설정.
	// - false: 1회 스와이프 시 1칸만 이동. (기본값)
	// - true : 드래그 위치에서 가장 가까운 아이템으로 스냅.
	//==============================================================================
	/**
	 * @param { boolean } isSnapToNearest 참이면 가장 가까운 아이템 모드. (끄는 동안 칸 범위를 자르지 않고, 놓으면 스냅 오프셋이 가장 가까운 아이템으로 간다)
	 * @example <caption>여러 칸을 끌고 놓으면 가장 가까운 칸으로 붙기</caption>
	 * import { UISnapScrollView, WorldNode, Pivot, Vector2 } from "./build/vanilla.js";
	 *
	 * const viewportNode = new WorldNode();
	 * viewportNode.setContentSize(Vector2.create(200, 120));
	 * const snapScrollView = viewportNode.addComponent(UISnapScrollView);
	 * snapScrollView.setSnapToNearest(true);
	 * const content = snapScrollView.getContent();
	 * for (let pageIndex = 0; pageIndex < 5; ++pageIndex) {
	 * 	const pageNode = new WorldNode();
	 * 	pageNode.setPivot(Pivot.topLeft.clone());
	 * 	pageNode.setAnchor(Pivot.topLeft.clone());
	 * 	pageNode.setContentSize(Vector2.create(200, 120));
	 * 	pageNode.setLocalPosition(Vector2.create(pageIndex * 200, 0));
	 * 	content.addChild(pageNode);
	 * }
	 * snapScrollView.setScrollContentSize(Vector2.create(1000, 120));
	 * snapScrollView.touchPress(Vector2.create(190, 60));
	 * snapScrollView.tick(0.016);
	 * snapScrollView.touchMove(Vector2.create(-300, 60));
	 * snapScrollView.tick(0.016);
	 * snapScrollView.touchRelease(Vector2.create(-300, 60));
	 * snapScrollView.tick(0.5);
	 * const scrollOffset = snapScrollView.getScrollOffset();
	 * console.log(snapScrollView.getSnapCurrentIndex(), scrollOffset.x);
	 */
	setSnapToNearest(isSnapToNearest) {
		this.#isSnapToNearest = isSnapToNearest;
	}

	//==============================================================================
	// 스냅 모드 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 가장 가까운 아이템 모드면 참. (기본 거짓)
	 */
	getSnapToNearest() {
		return this.#isSnapToNearest;
	}

	//==============================================================================
	// 방향성 스냅 발동 최소 속도 설정. (px/s, 1칸 모드에서만 사용)
	//==============================================================================
	/**
	 * @param { number } velocityThreshold 최소 속도. (스크롤 오프셋이 움직인 초당 픽셀, 1칸 모드에서 놓을 때 드래그 속도가 이 이상이면 끈 거리와 상관없이 그 방향으로 한 칸 넘긴다)
	 */
	setVelocityThreshold(velocityThreshold) {
		this.#velocityThreshold = velocityThreshold;
	}

	//==============================================================================
	// 방향성 스냅 발동 최소 속도 반환.
	//==============================================================================
	/**
	 * @returns { number } 최소 속도. (초당 픽셀, 기본 200)
	 */
	getVelocityThreshold() {
		return this.#velocityThreshold;
	}

	//==============================================================================
	// 느린 스와이프 시 페이지 전환 임계값 설정. (아이템 크기 대비 비율, 기본값: 0.35)
	//==============================================================================
	/**
	 * @param { number } pageChangeThreshold 옆 아이템 크기에 대한 비율. (뗄 때 이만큼 넘게 끌었으면 그 아이템으로 넘긴다)
	 */
	setPageChangeThreshold(pageChangeThreshold) {
		this.#pageChangeThreshold = pageChangeThreshold;
	}

	//==============================================================================
	// 느린 스와이프 시 페이지 전환 임계값 반환.
	//==============================================================================
	/**
	 * @returns { number } 옆 아이템 크기에 대한 비율. (기본 0.35)
	 */
	getPageChangeThreshold() {
		return this.#pageChangeThreshold;
	}

	//==============================================================================
	// 드래그 속도 반환.
	//==============================================================================
	/**
	 * @returns { number } 끄는 동안 스크롤 축 오프셋이 움직인 속도. (초당 픽셀, 다음 칸 쪽이 음수, 마지막으로 끈 tick 의 값이고 끌기를 시작하면 0)
	 */
	getDragVelocity() {
		return this.#dragVelocity;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초, 스냅 트윈도 이만큼 나아간다)
	 */
	tick(timeDelta) {
		const prevIsDragging = this.#prevIsDragging;
		super.tick(timeDelta);
		const currentIsDragging = this.isDragging();
		this.#prevIsDragging = currentIsDragging;

		// 드래그 시작 시 스냅 트윈 취소.
		if (!prevIsDragging && currentIsDragging) {
			this.#snapTween = null;
		}

		// 드래그 속도. (칸 범위로 자르기 전 오프셋이 tick 사이에 움직인 거리, 끌기를 시작한 tick 은 0)
		if (currentIsDragging) {
			const scrollOffset = this.getScrollOffset();
			const dragAxisOffset = this.isHorizontal() ? scrollOffset.x : scrollOffset.y;
			if (prevIsDragging && timeDelta > 0) {
				this.#dragVelocity = (dragAxisOffset - this.#previousDragAxisOffset) / timeDelta;
			}
			else if (!prevIsDragging) {
				this.#dragVelocity = 0;
			}
			this.#previousDragAxisOffset = dragAxisOffset;
		}

		// 드래그 중 스크롤 오프셋을 현재 페이지 ±1 범위로 제한. (가장 가까운 아이템 모드는 자르지 않는다)
		if (currentIsDragging && !this.getSnapToNearest()) {
			this.clampScrollOffsetToAdjacentPages();
		}

		// 드래그 종료 시 스냅 타겟 계산 및 트윈 시작.
		if (prevIsDragging && !currentIsDragging) {
			this.playSnapTween();
		}

		// 스냅 트윈 갱신.
		if (this.#snapTween !== null) {
			this.#snapTween.tick(timeDelta);
		}
	}

	//==============================================================================
	// 드래그 중 스크롤 오프셋을 현재 페이지의 인접 페이지 범위로 제한.
	//==============================================================================
	clampScrollOffsetToAdjacentPages() {
		const contentNode = this.getContent();
		if (!contentNode) {
			return;
		}
		const children = contentNode.getChildren();
		if (children.length === 0) {
			return;
		}
		const snapOffsets = this.computeSnapOffsets();
		const snapCurrentIndex = this.getSnapCurrentIndex();
		const maxIndex = children.length - 1;
		const prevIndex = System.Math.max(0, snapCurrentIndex - 1);
		const nextIndex = System.Math.min(maxIndex, snapCurrentIndex + 1);
		const isHorizontal = this.isHorizontal();
		const currentOffset = this.getScrollOffset();

		if (isHorizontal) {
			const maxOffset = snapOffsets[prevIndex];
			const minOffset = snapOffsets[nextIndex];
			const clampedX = Math.clamp(currentOffset.x, minOffset, maxOffset);
			if (clampedX !== currentOffset.x) {
				this.setScrollOffset(Vector2.create(clampedX, currentOffset.y));
			}
		}
		else {
			const maxOffset = snapOffsets[prevIndex];
			const minOffset = snapOffsets[nextIndex];
			const clampedY = Math.clamp(currentOffset.y, minOffset, maxOffset);
			if (clampedY !== currentOffset.y) {
				this.setScrollOffset(Vector2.create(currentOffset.x, clampedY));
			}
		}
	}

	//==============================================================================
	// 자식 노드별 스냅 오프셋 목록 계산.
	// - 각 아이템 중앙이 뷰포트 중앙에 오는 스크롤 오프셋 배열을 반환한다.
	// - 아이템 크기가 불균일해도 올바르게 계산된다.
	//==============================================================================
	/**
	 * @returns { number[] } 콘텐츠 노드의 자식 차례대로 스크롤 오프셋. (스크롤하는 축의 값, 자식이 없거나 노드에 붙기 전이면 빈 배열)
	 */
	computeSnapOffsets() {
		const node = this.getNode();
		const contentNode = this.getContent();
		if (!node || !contentNode) {
			return [];
		}
		const children = contentNode.getChildren();
		if (children.length === 0) {
			return [];
		}
		const viewportSize = node.getContentSize();
		const isHorizontal = this.isHorizontal();
		const snapOffsets = [];
		for (let snapOffsetIndex = 0; snapOffsetIndex < children.length; ++snapOffsetIndex) {
			const child = children[snapOffsetIndex];
			const childLocalPosition = child.getLocalPosition();
			const childContentSize = child.getContentSize();
			let snapOffset;
			if (isHorizontal) {
				snapOffset = viewportSize.x * 0.5 - childLocalPosition.x - childContentSize.x * 0.5;
			}
			else {
				snapOffset = viewportSize.y * 0.5 - childLocalPosition.y - childContentSize.y * 0.5;
			}
			snapOffsets.push(snapOffset);
		}
		return snapOffsets;
	}

	//==============================================================================
	// 현재 오프셋과 속도를 기반으로 스냅 인덱스를 결정하고 트윈을 시작한다.
	// - 가장 가까운 아이템 모드: 스냅 오프셋이 지금 오프셋과 가장 가까운 아이템.
	// - 1칸 모드: 드래그 속도가 setVelocityThreshold 이상이면 속도 방향으로 한 칸, 아니면 끈 방향으로 끈 거리가 옆 칸 크기의 비율 이상일 때 한 칸.
	//==============================================================================
	playSnapTween() {
		const contentNode = this.getContent();
		if (!contentNode) {
			return;
		}
		const children = contentNode.getChildren();
		if (children.length === 0) {
			return;
		}
		const snapOffsets = this.computeSnapOffsets();
		const currentOffset = this.getScrollOffset();
		const isHorizontal = this.isHorizontal();
		const currentAxisOffset = isHorizontal ? currentOffset.x : currentOffset.y;

		// 가장 가까운 아이템 모드: 스냅 오프셋과의 거리가 가장 짧은 아이템. (같으면 앞 아이템)
		if (this.getSnapToNearest()) {
			let nearestIndex = 0;
			let nearestDistance = System.Math.abs(snapOffsets[0] - currentAxisOffset);
			for (let snapOffsetIndex = 1; snapOffsetIndex < snapOffsets.length; ++snapOffsetIndex) {
				const distance = System.Math.abs(snapOffsets[snapOffsetIndex] - currentAxisOffset);
				if (distance < nearestDistance) {
					nearestDistance = distance;
					nearestIndex = snapOffsetIndex;
				}
			}
			this.setSnapCurrentIndex(nearestIndex);
			return;
		}

		// 1칸 모드의 목표 인덱스: 빠르게 튕겼으면 속도 방향으로 1칸, 아니면 드래그 방향으로 최대 1칸 (옆 칸이 비율 이상 드러나면 전환).
		const snapCurrentIndex = this.getSnapCurrentIndex();
		const currentSnapOffset = snapOffsets[snapCurrentIndex];
		const dragAmount = currentAxisOffset - currentSnapOffset;
		const dragVelocity = this.getDragVelocity();
		const velocityThreshold = this.getVelocityThreshold();
		const isFling = System.Math.abs(dragVelocity) >= velocityThreshold && dragVelocity !== 0;
		let direction;
		if (isFling) {
			direction = dragVelocity < 0 ? 1 : -1;
		}
		else {
			direction = dragAmount < 0 ? 1 : -1;
		}
		const candidateIndex = Math.clamp(snapCurrentIndex + direction, 0, children.length - 1);
		let targetIndex;
		if (candidateIndex !== snapCurrentIndex) {
			const candidateChild = children[candidateIndex];
			const candidateChildContentSize = candidateChild.getContentSize();
			const targetItemSize = isHorizontal ? candidateChildContentSize.x : candidateChildContentSize.y;
			const pageChangeThreshold = this.getPageChangeThreshold();
			if (isFling || System.Math.abs(dragAmount) >= targetItemSize * pageChangeThreshold) {
				targetIndex = candidateIndex;
			}
			else {
				targetIndex = snapCurrentIndex;
			}
		}
		else {
			targetIndex = snapCurrentIndex;
		}

		this.setSnapCurrentIndex(targetIndex);
	}

	//==============================================================================
	// 지정 인덱스로 이동.
	// - smooth: true이면 트윈으로 부드럽게, false이면 즉시 이동.
	//==============================================================================
	/**
	 * @param { number } index 아이템 순서. (콘텐츠 노드의 자식 순서, 0 ~ 자식 수 - 1 로 자른다)
	 * @param { boolean } smooth 참이면 0.3 초 트윈으로, 거짓이면 바로 옮긴다.
	 * @example <caption>바로 옮기기와 트윈으로 옮기기</caption>
	 * import { UISnapScrollView, WorldNode, Pivot, Vector2 } from "./build/vanilla.js";
	 *
	 * const viewportNode = new WorldNode();
	 * viewportNode.setContentSize(Vector2.create(200, 120));
	 * const snapScrollView = viewportNode.addComponent(UISnapScrollView);
	 * const content = snapScrollView.getContent();
	 * for (let pageIndex = 0; pageIndex < 3; ++pageIndex) {
	 * 	const pageNode = new WorldNode();
	 * 	pageNode.setPivot(Pivot.topLeft.clone());
	 * 	pageNode.setAnchor(Pivot.topLeft.clone());
	 * 	pageNode.setContentSize(Vector2.create(200, 120));
	 * 	pageNode.setLocalPosition(Vector2.create(pageIndex * 200, 0));
	 * 	content.addChild(pageNode);
	 * }
	 * snapScrollView.setScrollContentSize(Vector2.create(600, 120));
	 * snapScrollView.pageTo(2, false);
	 * const jumpedOffset = snapScrollView.getScrollOffset();
	 * console.log(jumpedOffset.x);
	 * snapScrollView.pageTo(1, true);
	 * snapScrollView.tick(0.5);
	 * const tweenedOffset = snapScrollView.getScrollOffset();
	 * console.log(tweenedOffset.x);
	 */
	pageTo(index, smooth) {
		const contentNode = this.getContent();
		if (!contentNode) {
			return;
		}
		const children = contentNode.getChildren();
		if (children.length === 0) {
			return;
		}
		const clampedIndex = Math.clamp(index, 0, children.length - 1);
		if (smooth) {
			this.setSnapCurrentIndex(clampedIndex);
		}
		else {
			this.#snapCurrentIndex = clampedIndex;
			this.#snapTween = null;
			const snapOffsets = this.computeSnapOffsets();
			const isHorizontal = this.isHorizontal();
			const currentOffset = this.getScrollOffset();
			const snapCurrentIndex = this.getSnapCurrentIndex();
			const targetSnapOffset = snapOffsets[snapCurrentIndex];
			let targetOffsetX;
			let targetOffsetY;
			if (isHorizontal) {
				targetOffsetX = targetSnapOffset;
				targetOffsetY = currentOffset.y;
			}
			else {
				targetOffsetX = currentOffset.x;
				targetOffsetY = targetSnapOffset;
			}
			this.setScrollOffset(Vector2.create(targetOffsetX, targetOffsetY));
		}
	}

	//==============================================================================
	// 특정 인덱스로 스냅 트윈 이동.
	//==============================================================================
	/**
	 * @param { number } index 아이템 순서. (0 ~ 자식 수 - 1 로 자른다, 자식이 없으면 아무것도 하지 않는다)
	 */
	setSnapCurrentIndex(index) {
		const contentNode = this.getContent();
		if (!contentNode) {
			return;
		}
		const children = contentNode.getChildren();
		if (children.length === 0) {
			return;
		}
		this.#snapCurrentIndex = Math.clamp(index, 0, children.length - 1);
		const snapOffsets = this.computeSnapOffsets();
		const isHorizontal = this.isHorizontal();
		const currentOffset = this.getScrollOffset();
		const snapCurrentIndex = this.getSnapCurrentIndex();
		const targetSnapOffset = snapOffsets[snapCurrentIndex];
		let targetOffsetX;
		let targetOffsetY;
		if (isHorizontal) {
			targetOffsetX = targetSnapOffset;
			targetOffsetY = currentOffset.y;
		}
		else {
			targetOffsetX = currentOffset.x;
			targetOffsetY = targetSnapOffset;
		}
		const startOffsetX = currentOffset.x;
		const startOffsetY = currentOffset.y;
		this.#snapTween = new Tween({ x: startOffsetX, y: startOffsetY });
		this.#snapTween.to({ x: targetOffsetX, y: targetOffsetY }, 0.3);
		this.#snapTween.easing(Tween.easingFunction.cubic.easeOut);
		this.#snapTween.setUpdate((values) => {
			this.setScrollOffset(Vector2.create(values.x, values.y));
		});
		this.#snapTween.setComplete(() => {
			this.#snapTween = null;
		});
		this.#snapTween.start();
	}

	//==============================================================================
	// 현재 스냅 인덱스 반환.
	//==============================================================================
	/**
	 * @returns { number } 지금 스냅한(또는 트윈으로 가는) 아이템 순서.
	 */
	getSnapCurrentIndex() {
		return this.#snapCurrentIndex;
	}
}
