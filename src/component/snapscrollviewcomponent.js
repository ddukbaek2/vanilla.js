//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { ScrollViewComponent, ScrollMode } from "./scrollviewcomponent.js";
import { Vector2 } from "../base/vector2.js";
import * as Math from "../base/math.js";
import { Tween } from "../core/tween.js";


//==============================================================================
// 스냅 스크롤뷰 컴포넌트.
// - ScrollViewComponent를 상속하며, 드래그 해제 시 가장 가까운 자식으로 스냅된다.
// - 한 화면에 자식 1개가 보이도록 레이아웃을 구성해야 한다.
// - 가로 스냅: setHorizontal(true), setVertical(false) (기본값)
// - 세로 스냅: setHorizontal(false), setVertical(true)
// - 속도가 velocityThreshold 이상이면 해당 방향의 다음/이전 페이지로 스냅된다.
//==============================================================================
export class SnapScrollViewComponent extends ScrollViewComponent {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Tween | null } */ #snapTween;
	/** @private @type { number } */ #snapCurrentIndex;
	/** @private @type { boolean } */ #prevIsDragging;

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
	// 현재 오프셋과 속도를 기반으로 스냅 인덱스 계산 후 스냅 트윈 시작.
	//==============================================================================
	playSnapTween() {
		const node = this.getNode();
		if (!node) {
			return;
		}
		const contentNode = this.getContentNode();
		if (!contentNode) {
			return;
		}
		const pageCount = contentNode.getChildren().length;
		if (pageCount === 0) {
			return;
		}
		const viewportSize = node.getContentSize();
		const currentOffset = this.getScrollOffset();
		const scrollVelocity = this.getScrollVelocity();
		const isHorizontal = this.getHorizontal();
		const velocityThreshold = 200;
		let snapIndex;
		if (isHorizontal) {
			const rawPage = -currentOffset.x / viewportSize.x;
			let snapPage;
			if (scrollVelocity.x < -velocityThreshold) {
				snapPage = Math.floor(rawPage) + 1;
			}
			else if (scrollVelocity.x > velocityThreshold) {
				snapPage = Math.floor(rawPage);
			}
			else {
				snapPage = Math.round(rawPage);
			}
			snapIndex = Math.clamp(snapPage, 0, pageCount - 1);
		}
		else {
			const rawPage = -currentOffset.y / viewportSize.y;
			let snapPage;
			if (scrollVelocity.y < -velocityThreshold) {
				snapPage = Math.floor(rawPage) + 1;
			}
			else if (scrollVelocity.y > velocityThreshold) {
				snapPage = Math.floor(rawPage);
			}
			else {
				snapPage = Math.round(rawPage);
			}
			snapIndex = Math.clamp(snapPage, 0, pageCount - 1);
		}
		this.setSnapCurrentIndex(snapIndex);
	}

	//==============================================================================
	// 특정 인덱스로 스냅 트윈 이동.
	//==============================================================================
	/**
	 * @param { number } index
	 */
	setSnapCurrentIndex(index) {
		const node = this.getNode();
		if (!node) {
			return;
		}
		const contentNode = this.getContentNode();
		if (!contentNode) {
			return;
		}
		const pageCount = contentNode.getChildren().length;
		const viewportSize = node.getContentSize();
		const currentOffset = this.getScrollOffset();
		const isHorizontal = this.getHorizontal();
		this.#snapCurrentIndex = Math.clamp(index, 0, pageCount - 1);
		let targetOffsetX;
		let targetOffsetY;
		if (isHorizontal) {
			targetOffsetX = -this.#snapCurrentIndex * viewportSize.x;
			targetOffsetY = currentOffset.y;
		}
		else {
			targetOffsetX = currentOffset.x;
			targetOffsetY = -this.#snapCurrentIndex * viewportSize.y;
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
