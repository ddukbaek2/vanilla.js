//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { ScrollViewComponent, ScrollMode } from "./scrollviewcomponent.js";
import { Vector2 } from "../../base/vector2.js";
import * as Math from "../../base/math.js";
import { Tween } from "../../core/tween.js";


//==============================================================================
// 스냅 스크롤뷰 컴포넌트.
// - ScrollViewComponent를 상속하며, 드래그 해제 시 지정한 아이템 중앙으로 스냅된다.
// - 아이템 크기가 각각 달라도 각 아이템 중앙이 뷰포트 중앙에 오도록 스냅한다.
// - 가로 스냅: setHorizontal(true), setVertical(false) (기본값)
// - 세로 스냅: setHorizontal(false), setVertical(true)
//
// [스냅 동작 설정]
// - setMaxPagesPerSwipe(1)      : 1회 스와이프 시 현재 위치에서 최대 1칸 이동. (기본값)
// - setMaxPagesPerSwipe(n)      : 1회 스와이프 시 최대 n칸 이동.
// - setMaxPagesPerSwipe(Infinity): 1회 스와이프 시 현재 위치에서 가장 가까운 아이템으로 스냅.
// - setVelocityThreshold(px/s)  : 방향성 스냅을 발동할 최소 속도. (기본값: 200)
//==============================================================================
export class SnapScrollViewComponent extends ScrollViewComponent {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Tween | null } */ #snapTween;
	/** @private @type { number } */ #snapCurrentIndex;
	/** @private @type { boolean } */ #prevIsDragging;
	/** @private @type { number } */ #maxPagesPerSwipe;
	/** @private @type { number } */ #velocityThreshold;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();

		this.setScrollMode(ScrollMode.clamp);
		this.setHorizontal(true);
		this.setVertical(false);
		this.#snapTween = null;
		this.#snapCurrentIndex = 0;
		this.#prevIsDragging = false;
		this.#maxPagesPerSwipe = 1;
		this.#velocityThreshold = 200;
	}

	//==============================================================================
	// 1회 스와이프당 최대 이동 가능 페이지 수 설정.
	// - 1        : 항상 1칸만 이동 (기본값)
	// - n        : 최대 n칸 이동
	// - Infinity : 현재 위치에서 가장 가까운 아이템으로 스냅 (제한 없음)
	//==============================================================================
	/**
	 * @param { number } maxPagesPerSwipe
	 */
	setMaxPagesPerSwipe(maxPagesPerSwipe) {
		this.#maxPagesPerSwipe = maxPagesPerSwipe;
	}

	//==============================================================================
	// 1회 스와이프당 최대 이동 가능 페이지 수 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getMaxPagesPerSwipe() {
		return this.#maxPagesPerSwipe;
	}

	//==============================================================================
	// 방향성 스냅 발동 최소 속도 설정. (px/s)
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
		const isHorizontal = this.getHorizontal();
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
		const scrollVelocity = this.getScrollVelocity();
		const isHorizontal = this.getHorizontal();
		const currentAxisOffset = isHorizontal ? currentOffset.x : currentOffset.y;
		const axisVelocity = isHorizontal ? scrollVelocity.x : scrollVelocity.y;

		// 현재 위치에서 가장 가까운 스냅 인덱스 탐색.
		let closestIndex = 0;
		let closestDistance = System.Math.abs(snapOffsets[0] - currentAxisOffset);
		for (let snapSearchIndex = 1; snapSearchIndex < snapOffsets.length; ++snapSearchIndex) {
			const distance = System.Math.abs(snapOffsets[snapSearchIndex] - currentAxisOffset);
			if (distance < closestDistance) {
				closestDistance = distance;
				closestIndex = snapSearchIndex;
			}
		}

		// 목표 인덱스 결정.
		let targetIndex;
		if (this.#maxPagesPerSwipe === Infinity) {
			// 제한 없음: 현재 위치에서 가장 가까운 아이템으로 스냅.
			targetIndex = closestIndex;
		}
		else if (System.Math.abs(axisVelocity) > this.#velocityThreshold) {
			// 빠른 스와이프: 속도 방향으로 최대 maxPagesPerSwipe칸 이동.
			const direction = axisVelocity < 0 ? 1 : -1;
			targetIndex = Math.clamp(this.#snapCurrentIndex + direction * this.#maxPagesPerSwipe, 0, children.length - 1);
		}
		else {
			// 느린 스와이프: 가장 가까운 아이템으로 이동하되 최대 maxPagesPerSwipe칸 제한.
			targetIndex = Math.clamp(closestIndex, this.#snapCurrentIndex - this.#maxPagesPerSwipe, this.#snapCurrentIndex + this.#maxPagesPerSwipe);
		}

		this.setSnapCurrentIndex(targetIndex);
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
		const isHorizontal = this.getHorizontal();
		const currentOffset = this.getScrollOffset();
		const targetSnapOffset = snapOffsets[this.#snapCurrentIndex];
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
