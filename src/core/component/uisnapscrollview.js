//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { UIScrollView, ScrollMode } from "./uiscrollview.js";
import { Vector2 } from "../../base/vector2.js";
import * as Math from "../../base/math.js";
import { Tween } from "../tween.js";


//==============================================================================
// 스냅 스크롤뷰 컴포넌트.
// - ScrollView를 상속하며, 드래그 해제 시 지정한 아이템 중앙으로 스냅된다.
// - 아이템 크기가 각각 달라도 각 아이템 중앙이 뷰포트 중앙에 오도록 스냅된다.
// - 가로 스냅: setHorizontal(true), setVertical(false) (기본값)
// - 세로 스냅: setHorizontal(false), setVertical(true)
//
// [스냅 동작 설정]
// - setSnapToNearest(false) : 1회 스와이프 시 1칸만 이동. (기본값)
// - setSnapToNearest(true)  : 드래그한 위치에서 가장 가까운 아이템으로 스냅.
// - setVelocityThreshold(px/s): 1칸 모드에서 방향을 결정할 최소 속도. (기본값: 200)
//
// [페이지 이동]
// - pageTo(index, smooth): 지정 인덱스로 이동. smooth=true이면 트윈, false이면 즉시 이동.
//==============================================================================
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

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setComponentType('SnapScrollView');
		this.setScrollMode(ScrollMode.clamp);
		this.setHorizontal(true);
		this.setVertical(false);
		this.#snapTween = null;
		this.#snapCurrentIndex = 0;
		this.#prevIsDragging = false;
		this.#isSnapToNearest = false;
		this.#velocityThreshold = 200;
		this.#pageChangeThreshold = 0.35;
	}

	//==============================================================================
	// 스냅 모드 설정.
	// - false: 1회 스와이프 시 1칸만 이동. (기본값)
	// - true : 드래그 위치에서 가장 가까운 아이템으로 스냅.
	//==============================================================================
	/**
	 * @param { boolean } isSnapToNearest
	 */
	setSnapToNearest(isSnapToNearest) {
		this.#isSnapToNearest = isSnapToNearest;
	}

	//==============================================================================
	// 스냅 모드 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	getSnapToNearest() {
		return this.#isSnapToNearest;
	}

	//==============================================================================
	// 방향성 스냅 발동 최소 속도 설정. (px/s, 1칸 모드에서만 사용)
	//==============================================================================
	/**
	 * @param { number } velocityThreshold
	 */
	setVelocityThreshold(velocityThreshold) {
		this.#velocityThreshold = velocityThreshold;
	}

	//==============================================================================
	// 방향성 스냅 발동 최소 속도 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getVelocityThreshold() {
		return this.#velocityThreshold;
	}

	//==============================================================================
	// 느린 스와이프 시 페이지 전환 임계값 설정. (아이템 크기 대비 비율, 기본값: 0.35)
	//==============================================================================
	/**
	 * @param { number } pageChangeThreshold
	 */
	setPageChangeThreshold(pageChangeThreshold) {
		this.#pageChangeThreshold = pageChangeThreshold;
	}

	//==============================================================================
	// 느린 스와이프 시 페이지 전환 임계값 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getPageChangeThreshold() {
		return this.#pageChangeThreshold;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
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
	// 자식 노드별 스냅 오프셋 목록 계산.
	// - 각 아이템 중앙이 뷰포트 중앙에 오는 스크롤 오프셋 배열을 반환한다.
	// - 아이템 크기가 불균일해도 올바르게 계산된다.
	//==============================================================================
	/**
	 * @returns { number[] }
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

		// 목표 인덱스 결정: 드래그 방향으로 최대 1칸, 목표 페이지 35% 이상 노출 시 전환.
		const snapCurrentIndex = this.getSnapCurrentIndex();
		const currentSnapOffset = snapOffsets[snapCurrentIndex];
		const dragAmount = currentAxisOffset - currentSnapOffset;
		const direction = dragAmount < 0 ? 1 : -1;
		const candidateIndex = Math.clamp(snapCurrentIndex + direction, 0, children.length - 1);
		let targetIndex;
		if (candidateIndex !== snapCurrentIndex) {
			const candidateChild = children[candidateIndex];
			const candidateChildContentSize = candidateChild.getContentSize();
			const targetItemSize = isHorizontal ? candidateChildContentSize.x : candidateChildContentSize.y;
			const pageChangeThreshold = this.getPageChangeThreshold();
			if (System.Math.abs(dragAmount) >= targetItemSize * pageChangeThreshold) {
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
	 * @param { number } index
	 * @param { boolean } smooth
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
	 * @param { number } index
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
		this.#snapTween.easing(Tween.easingFunction.cubic.out);
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
	 * @returns { number }
	 */
	getSnapCurrentIndex() {
		return this.#snapCurrentIndex;
	}
}
