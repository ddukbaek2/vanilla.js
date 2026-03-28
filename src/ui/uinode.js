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
// - Node의 localPosition을 anchoredPosition의 저장소로 활용합니다.
// - Node의 size를 sizeDelta의 저장소로 활용합니다.
//==============================================================================
export class UINode extends Node {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Vector2 } */ #anchorMin;
	/** @private @type { Vector2 } */ #anchorMax;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.#anchorMin = Vector2.create(0.5, 0.5);
		this.#anchorMax = Vector2.create(0.5, 0.5);
	}

	//==============================================================================
	// 앵커 기준 위치 오프셋 반환. (UI에서의 핵심 좌표)
	//==============================================================================
	/**
	 * @returns { Vector2 } 
	 */
	getAnchoredPosition() {
		return super.getLocalPosition(); // Node의 localPosition 메모리를 사용
	}

	//==============================================================================
	// 앵커 기준 위치 오프셋 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } anchoredPosition 
	 */
	setAnchoredPosition(anchoredPosition) {
		super.setLocalPosition(anchoredPosition);
	}

	//==============================================================================
	// 로컬 위치 반환. (오버라이드: 앵커 기준점을 계산하여 부모 피봇 기준의 실제 위치 도출)
	//==============================================================================
	/**
	 * @override
	 * @returns { Vector2 }
	 */
	getLocalPosition() {
		const anchoredPosition = this.getAnchoredPosition();
		const parent = this.getParent();

		if (!parent) {
			return anchoredPosition;
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
			anchorRefX + anchoredPosition.x,
			anchorRefY + anchoredPosition.y
		);
	}

	//==============================================================================
	// 로컬 위치 설정. (오버라이드: 앵커 기준점을 역계산하여 anchoredPosition에 저장)
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

		const parentSize = parent.getSize();
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
	// 오프셋 크기 반환. (UI에서의 핵심 크기)
	//==============================================================================
	/**
	 * @returns { Vector2 } 
	 */
	getSizeDelta() {
		return super.getSize(); // Node의 size 메모리를 사용
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
	// 실제 크기 반환. (오버라이드: 앵커 비율과 부모 크기를 바탕으로 Stretch된 최종 크기 도출)
	//==============================================================================
	/**
	 * @override
	 * @returns { Vector2 } 
	 */
	getSize() {
		const parent = this.getParent();
		const sizeDelta = this.getSizeDelta();

		if (!parent) {
			return sizeDelta;
		}

		const parentSize = parent.getSize();
		const anchorMin = this.getAnchorMin();
		const anchorMax = this.getAnchorMax();

		return Vector2.create(
			parentSize.x * (anchorMax.x - anchorMin.x) + sizeDelta.x,
			parentSize.y * (anchorMax.y - anchorMin.y) + sizeDelta.y
		);
	}

	//==============================================================================
	// 실제 크기 설정. (오버라이드: 현재 앵커에 맞춰 역으로 sizeDelta를 계산하여 저장)
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } size 
	 */
	setSize(size) {
		const parent = this.getParent();

		if (!parent) {
			this.setSizeDelta(size);
			return;
		}

		const parentSize = parent.getSize();
		const anchorMin = this.getAnchorMin();
		const anchorMax = this.getAnchorMax();

		this.setSizeDelta(Vector2.create(
			size.x - parentSize.x * (anchorMax.x - anchorMin.x),
			size.y - parentSize.y * (anchorMax.y - anchorMin.y)
		));
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