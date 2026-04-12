//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Rect } from "../../base/rect.js";
import { Vector2 } from "../../base/vector2.js";
import { Graphic } from "../graphic.js";
import { AnchoredWorldNode } from "./anchoredworldmnode.js";


//==============================================================================
// UI 노드.
// - 마스크 기능.
// - 터치 인터랙션 기능.
// - 포커스 기능.
//==============================================================================
export class UINode extends AnchoredWorldNode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { boolean } */ #isMaskEnabled;
	/** @private @type { boolean } */ #isInteractable;
	/** @private @type { boolean } */ #isFocused;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.#isMaskEnabled = false;
		this.#isInteractable = false;
		this.#isFocused = false;
	}

	//==============================================================================
	// 출력. (오버라이드: 마스크 활성화 시 자식을 자신의 영역으로 크롭)
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic
	 */
	draw(graphic) {
		const isVisible = this.isVisible();
		if (!isVisible) {
			return;
		}

		// 컴포넌트 출력.
		const components = this.getAllComponents();
		for (const component of components) {
			component.draw(graphic);
		}

		// 마스크 처리.
		const isMaskEnabled = this.isMaskEnabled();
		if (isMaskEnabled) {
			// 자신의 contentSize 기준으로 클리핑 후 자식 출력.
			const contentSize = this.getContentSize();
			const clipRect = Rect.create(0, 0, contentSize.x, contentSize.y);
			graphic.beginClipRect(clipRect);
		}

		// 자식 출력.
		const children = this.getChildren();
		for (const child of children) {
			graphic.drawNode(child);
		}

		// 마스크 처리.
		if (isMaskEnabled) {
			graphic.endClipRect();
		}
	}

	//==============================================================================
	// 터치 인터랙션 활성화 설정.
	//==============================================================================
	/**
	 * @param { boolean } isInteractable
	 */
	setInteractable(isInteractable) {
		this.#isInteractable = isInteractable;
	}

	//==============================================================================
	// 터치 인터랙션 활성화 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isInteractable() {
		return this.#isInteractable;
	}

	//==============================================================================
	// 터치 누름. (TouchRaycaster에 의해 호출)
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } viewInputPosition
	 */
	touchPress(viewInputPosition) {
	}

	//==============================================================================
	// 터치 이동. (TouchRaycaster에 의해 호출)
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } viewInputPosition
	 */
	touchMove(viewInputPosition) {
	}

	//==============================================================================
	// 터치 뗌. (TouchRaycaster에 의해 호출)
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } viewInputPosition
	 */
	touchRelease(viewInputPosition) {
	}

	//==============================================================================
	// 터치 취소. (TouchRaycaster에 의해 호출)
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } viewInputPosition
	 */
	touchCancel(viewInputPosition) {
	}

	//==============================================================================
	// 마스크 활성화 설정. (자식이 자신의 contentSize 영역 밖으로 나가면 크롭)
	//==============================================================================
	/**
	 * @param { boolean } enabled
	 */
	setMaskEnabled(enabled) {
		this.#isMaskEnabled = enabled;
	}

	//==============================================================================
	// 마스크 활성화 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isMaskEnabled() {
		return this.#isMaskEnabled;
	}

	//==============================================================================
	// 포커스 설정. (자신부터 가장 상위의 UINode까지 전파)
	//==============================================================================
	setFocus() {
		if (this.#isFocused) {
			return;
		}
		this.#isFocused = true;
		const parent = this.getParent();
		if (parent && parent instanceof UINode) {
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
}
