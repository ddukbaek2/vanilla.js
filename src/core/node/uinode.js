//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Rect } from "../../base/rect.js";
import { Vector2 } from "../../base/vector2.js";
import { Graphic } from "../graphic.js";
import { AnchoredTransformNode } from "./anchoredtransformnode.js";


//==============================================================================
// UI 노드.
// - 마스크 기능.
// - 이벤트 체이닝 기능.
// - 포커스 기능.
//==============================================================================
export class UINode extends AnchoredTransformNode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { boolean } */ #isMaskEnabled;
	/** @private @type { boolean } */ #isEventChainEnabled;
	/** @private @type { boolean } */ #isTouchBlocked;
	/** @private @type { boolean } */ #isFocused;
	/** @private @type { * } */ #engine;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.#isMaskEnabled = false;
		this.#isEventChainEnabled = false;
		this.#isTouchBlocked = false;
		this.#isFocused = false;
		this.#engine = null;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		if (this.#isEventChainEnabled && this.#engine) {
			this.processEventChain();
		}
		super.tick(timeDelta);
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

		const isMaskEnabled = this.isMaskEnabled();
		if (isMaskEnabled) {
			// 자신의 contentSize 기준으로 클리핑 후 자식 출력.
			const canvasRenderingContext = graphic.getCanvasRenderingContext();
			const contentSize = this.getContentSize();
			canvasRenderingContext.save();
			canvasRenderingContext.beginPath();
			canvasRenderingContext.rect();
			canvasRenderingContext.clip();

			const clipRect = Rect.create(0, 0, contentSize.x, contentSize.y);
			graphic.beginClipRect(clipRect);

			const children = this.getChildren();
			for (const child of children) {
				graphic.drawNode(child);
			}
			
			graphic.endClipRect();
		}
		else {
			// 마스크 없이 자식 출력.
			const children = this.getChildren();
			for (const child of children) {
				graphic.drawNode(child);
			}
		}
	}

	//==============================================================================
	// 이벤트 체이닝 처리.
	// 터치 누름 시, 하위 UINode를 역순으로 순회하여
	// bounds 안에 있는 가장 위의 노드 하나만 활성화하고 나머지를 차단한다.
	//==============================================================================
	/** @private */
	processEventChain() {
		const inputManager = this.#engine.getInputManager();

		// 모든 하위 UINode 차단 해제.
		this.setAllTouchBlocked(this, false);

		// 터치 누름 시에만 체이닝으로 소비자를 결정.
		if (!inputManager.isTouchPressed()) {
			return;
		}

		// 모든 하위 UINode 차단.
		this.setAllTouchBlocked(this, true);

		// 역순으로 순회하여 가장 위에 있는 노드를 찾아 차단 해제.
		const viewInputPosition = inputManager.getViewInputPosition();
		this.findAndUnblockFirst(this, viewInputPosition);
	}

	//==============================================================================
	// 하위 계층 전체의 UINode 터치 차단 여부 일괄 설정.
	//==============================================================================
	/**
	 * @private
	 * @param { * } node
	 * @param { boolean } blocked
	 */
	setAllTouchBlocked(node, blocked) {
		const children = node.getChildren();
		for (const child of children) {
			if (child instanceof UINode) {
				child.setTouchBlocked(blocked);
			}
			this.setAllTouchBlocked(child, blocked);
		}
	}

	//==============================================================================
	// 역순으로 순회하여 bounds 안에 있는 첫 번째 UINode를 차단 해제.
	// 해당 노드의 하위 계층도 함께 차단 해제한다.
	// 반환값: 소비 여부.
	//==============================================================================
	/**
	 * @private
	 * @param { * } node
	 * @param { Vector2 } viewInputPosition
	 * @returns { boolean }
	 */
	findAndUnblockFirst(node, viewInputPosition) {
		const children = node.getChildren();
		for (let i = children.length - 1; i >= 0; i--) {
			const child = children[i];
			if (!child.isActive()) {
				continue;
			}
			if (!(child instanceof UINode)) {
				continue;
			}

			// 자식의 하위 계층을 먼저 탐색 (깊이 우선).
			const isConsumedByDescendant = this.findAndUnblockFirst(child, viewInputPosition);
			if (isConsumedByDescendant) {
				return true;
			}

			// 이 자식이 bounds 안에 있으면 소비.
			const isInsideBounds = child.contains(viewInputPosition);
			if (isInsideBounds) {
				child.setTouchBlocked(false);
				// 이 자식의 하위 계층도 모두 차단 해제.
				this.setAllTouchBlocked(child, false);
				return true;
			}
		}
		return false;
	}

	//==============================================================================
	// 터치 차단 여부 설정. (이벤트 체이닝에 의해 제어됨)
	//==============================================================================
	/**
	 * @param { boolean } blocked
	 */
	setTouchBlocked(blocked) {
		this.#isTouchBlocked = blocked;
	}

	//==============================================================================
	// 터치 차단 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isTouchBlocked() {
		return this.#isTouchBlocked;
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
	// 이벤트 체이닝 활성화 설정.
	//==============================================================================
	/**
	 * @param { boolean } enabled
	 */
	setEventChainEnabled(enabled) {
		this.#isEventChainEnabled = enabled;
	}

	//==============================================================================
	// 이벤트 체이닝 활성화 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isEventChainEnabled() {
		return this.#isEventChainEnabled;
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
