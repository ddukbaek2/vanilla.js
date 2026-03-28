//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Vector2 } from "../base/vector2.js";
import * as Math from "../base/math.js";
import { Renderer } from "../core/renderer.js";
import { Node } from "../core/node.js";


//==============================================================================
// UI 기반 뷰.
// - 앵커 기반의 레이아웃(RectTransform)을 지원합니다.
//==============================================================================
export class UINode extends Node {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Vector2 } */ #anchoredPosition;
	/** @private @type { Vector2 } */ #anchorMin;
	/** @private @type { Vector2 } */ #anchorMax;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.#anchoredPosition = Vector2.zero();
		this.#anchorMin = Vector2.create(0.5, 0.5);
		this.#anchorMax = Vector2.create(0.5, 0.5);
	}

	//==============================================================================
	// 앵커와 TRS 포지션이 모두 반영된 부모 기준의 최종 로컬 위치 반환.
	//==============================================================================
	/**
	 * @override
	 * @returns { Vector2 }
	 */
	getLocalPosition() {
		const position = super.getLocalPosition(); // TRS 기본 위치
		const anchoredPosition = this.getAnchoredPosition(); // UI 앵커 위치
		const parent = this.getParent();

		if (!parent) {
			return position.add(anchoredPosition);
		}

		const parentSize = parent.getSize();
		const parentPivot = parent.getPivot();
		const anchorMin = this.getAnchorMin();
		const anchorMax = this.getAnchorMax();
		const pivot = this.getPivot();

		// 부모의 피봇 위치를 (0,0)으로 했을 때의 부모 좌상단 좌표
		const parentLeft = -parentSize.x * parentPivot.x;
		const parentTop = -parentSize.y * parentPivot.y;

		// 앵커 영역 계산
		const anchorMinLocalX = parentLeft + parentSize.x * anchorMin.x;
		const anchorMinLocalY = parentTop + parentSize.y * anchorMin.y;
		const anchorMaxLocalX = parentLeft + parentSize.x * anchorMax.x;
		const anchorMaxLocalY = parentTop + parentSize.y * anchorMax.y;

		// 앵커 기준점 (자신의 피봇 비율에 따라 결정)
		const anchorRefX = Math.lerp(anchorMinLocalX, anchorMaxLocalX, pivot.x);
		const anchorRefY = Math.lerp(anchorMinLocalY, anchorMaxLocalY, pivot.y);

		return Vector2.create(
			anchorRefX + anchoredPosition.x + position.x,
			anchorRefY + anchoredPosition.y + position.y
		);
	}

	//==============================================================================
	// 실제 크기 반환. (앵커 영역과 base 크기를 기반으로 계산된 렌더링용 크기)
	//==============================================================================
	/**
	 * @override
	 * @returns { Vector2 } 
	 */
	getSize() {
		const parent = this.getParent();
		const baseSize = super.getSize(); // UI에서는 이를 sizeDelta 역할로 활용.

		if (!parent) {
			return baseSize;
		}

		const parentSize = parent.getSize();
		const anchorMin = this.getAnchorMin();
		const anchorMax = this.getAnchorMax();

		return Vector2.create(
			parentSize.x * (anchorMax.x - anchorMin.x) + baseSize.x,
			parentSize.y * (anchorMax.y - anchorMin.y) + baseSize.y
		);
	}

	//==============================================================================
	// 앵커 기준 위치 오프셋 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } anchoredPosition 
	 */
	setAnchoredPosition(anchoredPosition) {
		this.#anchoredPosition = anchoredPosition;
	}

	//==============================================================================
	// 앵커 기준 위치 오프셋 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 
	 */
	getAnchoredPosition() {
		return this.#anchoredPosition;
	}

	//==============================================================================
	// 오프셋 크기 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } sizeDelta 
	 */
	setSizeDelta(sizeDelta) {
		super.setSize(sizeDelta);
	}

	//==============================================================================
	// 오프셋 크기 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 
	 */
	getSizeDelta() {
		return super.getSize();
	}

	//==============================================================================
	// 앵커 최소값 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } anchorMin 
	 */
	setAnchorMin(anchorMin) {
		this.#anchorMin = anchorMin;
	}

	//==============================================================================
	// 앵커 최소값 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getAnchorMin() {
		return this.#anchorMin;
	}

	//==============================================================================
	// 앵커 최대값 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } anchorMax 
	 */
	setAnchorMax(anchorMax) {
		this.#anchorMax = anchorMax;
	}

	//==============================================================================
	// 앵커 최대값 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getAnchorMax() {
		return this.#anchorMax;
	}

	//==============================================================================
	// 새로운 노드 생성.
	//==============================================================================
	/**
	 * @returns { UINode }
	 */
	static create() {
		var obj = new UINode();
		return obj;
	}
}