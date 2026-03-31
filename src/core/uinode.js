//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Vector2 } from "../base/vector2.js";
import * as Math from "../base/math.js";
import { Graphic } from "../core/graphic.js";
import { Node } from "../core/node.js";

//==============================================================================
// UI 기반 뷰.
// - 앵커 기반의 레이아웃(RectTransform)을 지원합니다.
// - 내부의 앵커 세팅을 기반으로 최종 계산된 값을 Node의 로컬 위치와 크기에 반영합니다.
//==============================================================================
export class UINode extends Node {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Vector2 } */ #anchoredPosition;
	/** @private @type { Vector2 } */ #sizeDelta;
	/** @private @type { Vector2 } */ #anchorMin;
	/** @private @type { Vector2 } */ #anchorMax;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.#anchoredPosition = Vector2.zero();
		this.#sizeDelta = Vector2.zero();
		this.#anchorMin = Vector2.create(0.5, 0.5);
		this.#anchorMax = Vector2.create(0.5, 0.5);
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta 
	 */
	tick(timeDelta) {
		// 매 프레임마다 부모 크기 변화 등에 대응하여 레이아웃 최종 반영
		this.updateRect();
		super.tick(timeDelta);
	}

	//==============================================================================
	// 앵커 기반 레이아웃 계산하여 최종 로컬 트랜스폼 및 크기 반영.
	//==============================================================================
	updateRect() {
		const parent = this.getParent();

		// 부모가 없으면 앵커 오프셋과 델타가 곧 최종값이 됨
		if (!parent) {
			super.setLocalPosition(this.#anchoredPosition);
			super.setContentSize(this.#sizeDelta);
			return;
		}

		const parentSize = parent.getContentSize();
		const parentPivot = parent.getPivot();
		const anchorMin = this.#anchorMin;
		const anchorMax = this.#anchorMax;
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

		// 최종 로컬 위치를 Node에 반영 (엔진이 렌더링에 사용)
		super.setLocalPosition(Vector2.create(
			anchorRefX + this.#anchoredPosition.x,
			anchorRefY + this.#anchoredPosition.y
		));

		// 최종 크기를 Node에 반영 (엔진이 충돌 및 렌더링에 사용)
		super.setContentSize(Vector2.create(
			parentSize.x * (anchorMax.x - anchorMin.x) + this.#sizeDelta.x,
			parentSize.y * (anchorMax.y - anchorMin.y) + this.#sizeDelta.y
		));
	}

	//==============================================================================
	// 앵커 기준 위치 오프셋 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } anchoredPosition 
	 */
	setAnchoredPosition(anchoredPosition) {
		this.#anchoredPosition = anchoredPosition;
		this.updateRect();
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
		this.#sizeDelta = sizeDelta;
		this.updateRect();
	}

	//==============================================================================
	// 오프셋 크기 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 
	 */
	getSizeDelta() {
		return this.#sizeDelta;
	}

	//==============================================================================
	// 앵커 최소값 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } anchorMin 
	 */
	setAnchorMin(anchorMin) {
		this.#anchorMin = anchorMin;
		this.updateRect();
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
		this.updateRect();
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
	// 로컬 위치 설정. (오버라이드: 외부에서 localPosition을 세팅할 경우, 앵커를 역계산하여 anchoredPosition에 반영)
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } localPosition 
	 */
	setLocalPosition(localPosition) {
		const parent = this.getParent();

		if (!parent) {
			this.setAnchoredPosition(localPosition);
			return;
		}

		const parentSize = parent.getContentSize();
		const parentPivot = parent.getPivot();
		const anchorMin = this.getAnchorMin();
		const anchorMax = this.getAnchorMax();
		const pivot = this.getPivot();

		const parentLeft = -parentSize.x * parentPivot.x;
		const parentTop = -parentSize.y * parentPivot.y;

		const anchorMinLocalX = parentLeft + parentSize.x * anchorMin.x;
		const anchorMinLocalY = parentTop + parentSize.y * anchorMin.y;
		const anchorMaxLocalX = parentLeft + parentSize.x * anchorMax.x;
		const anchorMaxLocalY = parentTop + parentSize.y * anchorMax.y;

		const anchorRefX = Math.lerp(anchorMinLocalX, anchorMaxLocalX, pivot.x);
		const anchorRefY = Math.lerp(anchorMinLocalY, anchorMaxLocalY, pivot.y);

		this.setAnchoredPosition(Vector2.create(
			localPosition.x - anchorRefX,
			localPosition.y - anchorRefY
		));
	}

	//==============================================================================
	// 콘텐츠 크기 설정. (오버라이드: 외부에서 contentSize를 세팅할 경우, 앵커를 역계산하여 sizeDelta에 반영)
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } contentSize 
	 */
	setContentSize(contentSize) {
		const parent = this.getParent();

		if (!parent) {
			this.setSizeDelta(contentSize);
			return;
		}

		const parentSize = parent.getContentSize();
		const anchorMin = this.getAnchorMin();
		const anchorMax = this.getAnchorMax();

		this.setSizeDelta(Vector2.create(
			contentSize.x - parentSize.x * (anchorMax.x - anchorMin.x),
			contentSize.y - parentSize.y * (anchorMax.y - anchorMin.y)
		));
	}

	// //==============================================================================
	// // 새로운 노드 생성.
	// //==============================================================================
	// /**
	//  * @returns { UINode }
	//  */
	// static create() {
	// 	var obj = new UINode();
	// 	return obj;
	// }
}