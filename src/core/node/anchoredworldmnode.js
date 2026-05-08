//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../../base/vector2.js";
import * as Math from "../../base/math.js";
import { WorldNode } from "./worldnode.js";


//==============================================================================
// UI 기반 뷰.
// - 앵커, 앵커 포지션, 사이즈 델타 기능. (부모 기준으로 배치되고 늘려붙이는 것을 기준으로 한 확장 좌표계)
// - 클리핑이 필요하면 Mask 컴포넌트를 부착한다. (실제 처리는 WorldNode.draw 가 담당)
// - 포커스 기능.
//==============================================================================
export class AnchoredWorldNode extends WorldNode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Vector2 } */ #anchoredPosition;
	/** @private @type { Vector2 } */ #sizeDelta;
	/** @private @type { Vector2 } */ #anchorMin;
	/** @private @type { Vector2 } */ #anchorMax;
	/** @private @type { boolean } */ #isFocused;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.nodeType = "AnchoredWorldNode";
		this.#anchoredPosition = Vector2.zero();
		this.#sizeDelta = Vector2.zero();
		this.#anchorMin = Vector2.create(0.5, 0.5);
		this.#anchorMax = Vector2.create(0.5, 0.5);
		this.#isFocused = false;
	}

	//==============================================================================
	// 포커스 설정. (자신부터 가장 상위의 AnchoredWorldNode까지 전파)
	//==============================================================================
	setFocus() {
		if (this.isFocus()) {
			return;
		}
		this.#isFocused = true;
		const parent = this.getParent();
		if (parent && parent instanceof AnchoredWorldNode) {
			parent.setFocus();
		}
	}

	//==============================================================================
	// 포커스 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isFocus() {
		return this.#isFocused;
	}

	//==============================================================================
	// 포커스 해제.
	//==============================================================================
	clearFocus() {
		this.#isFocused = false;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		// 매 프레임마다 부모 크기 변화 등에 대응하여 레이아웃 최종 반영.
		this.calculateAnchoredRect();
		super.tick(timeDelta);
	}

	//==============================================================================
	// 앵커 기반 레이아웃 계산하여 최종 로컬 트랜스폼 및 크기 반영.
	//==============================================================================
	calculateAnchoredRect() {
		const parent = this.getParent();

		// 부모가 없으면 앵커 오프셋과 델타가 곧 최종값이 됨
		if (!parent) {
			const anchoredPosition = this.getAnchoredPosition();
			super.setLocalPosition(anchoredPosition);
			const sizeDelta = this.getSizeDelta();
			super.setContentSize(sizeDelta);
			return;
		}

		const parentSize = parent.getContentSize();
		const anchorMin = this.getAnchorMin();
		const anchorMax = this.getAnchorMax();
		const pivot = this.getPivot();

		// 앵커 영역 계산 (부모 좌상단 기준).
		const anchorMinLocalX = parentSize.x * anchorMin.x;
		const anchorMinLocalY = parentSize.y * anchorMin.y;
		const anchorMaxLocalX = parentSize.x * anchorMax.x;
		const anchorMaxLocalY = parentSize.y * anchorMax.y;

		// 앵커 기준점 (자신의 피봇 비율에 따라 결정)
		const anchorRefX = Math.lerp(anchorMinLocalX, anchorMaxLocalX, pivot.x);
		const anchorRefY = Math.lerp(anchorMinLocalY, anchorMaxLocalY, pivot.y);

		// 최종 로컬 위치를 Node에 반영 (엔진이 렌더링에 사용)
		const anchoredPosition = this.getAnchoredPosition();
		super.setLocalPosition(Vector2.create(
			anchorRefX + anchoredPosition.x,
			anchorRefY + anchoredPosition.y
		));

		// 최종 크기를 Node에 반영 (엔진이 충돌 및 렌더링에 사용)
		const sizeDelta = this.getSizeDelta();
		super.setContentSize(Vector2.create(
			parentSize.x * (anchorMax.x - anchorMin.x) + sizeDelta.x,
			parentSize.y * (anchorMax.y - anchorMin.y) + sizeDelta.y
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
		this.calculateAnchoredRect();
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
		this.calculateAnchoredRect();
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
		this.calculateAnchoredRect();
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
		this.calculateAnchoredRect();
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
		const anchorMin = this.getAnchorMin();
		const anchorMax = this.getAnchorMax();
		const pivot = this.getPivot();

		const anchorMinLocalX = parentSize.x * anchorMin.x;
		const anchorMinLocalY = parentSize.y * anchorMin.y;
		const anchorMaxLocalX = parentSize.x * anchorMax.x;
		const anchorMaxLocalY = parentSize.y * anchorMax.y;

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
}
