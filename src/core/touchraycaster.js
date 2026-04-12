//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { UINode } from "./node/uinode.js";


//==============================================================================
// 터치 레이캐스터.
// - 루트 노드로부터 draw() 호출 순서대로 번호를 매기고,
//   터치 좌표와 겹치는 활성 + isInteractable() 노드 중
//   가장 높은 번호(맨 앞)의 노드를 반환한다.
//==============================================================================
export class TouchRaycaster extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { * } */ #rootNode;
	/** @private @type { number } */ #drawOrderCounter;
	/** @private @type { UINode | null } */ #hitNode;
	/** @private @type { number } */ #hitDrawOrder;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.#rootNode = null;
		this.#drawOrderCounter = 0;
		this.#hitNode = null;
		this.#hitDrawOrder = -1;
	}

	//==============================================================================
	// 루트 노드 설정.
	//==============================================================================
	/**
	 * @param { * } rootNode
	 */
	setRootNode(rootNode) {
		this.#rootNode = rootNode;
	}

	//==============================================================================
	// 루트 노드 반환.
	//==============================================================================
	/**
	 * @returns { * }
	 */
	getRootNode() {
		return this.#rootNode;
	}

	//==============================================================================
	// 레이캐스트.
	// - 루트 노드로부터 draw() 호출 순서대로 번호를 매기며 순회한다.
	// - 활성화 상태이고 isInteractable()이 참이며 터치 좌표를 포함하는
	//   노드를 수집하고, 그 중 가장 높은 번호의 노드를 반환한다.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition
	 * @returns { UINode | null }
	 */
	raycast(viewInputPosition) {
		const rootNode = this.#rootNode;
		if (!rootNode) {
			return null;
		}

		this.#drawOrderCounter = 0;
		this.#hitNode = null;
		this.#hitDrawOrder = -1;

		this.traverse(rootNode, viewInputPosition);

		return this.#hitNode;
	}

	//==============================================================================
	// 노드 트리 순회. (draw() 호출 순서와 동일한 깊이 우선 전위 순회)
	//==============================================================================
	/**
	 * @private
	 * @param { * } node
	 * @param { Vector2 } viewInputPosition
	 */
	traverse(node, viewInputPosition) {
		if (!node) {
			return;
		}
		const isActive = node.isActive();
		if (!isActive) {
			return;
		}

		// 현재 노드에 번호 부여 후 판정.
		const currentDrawOrder = this.#drawOrderCounter;
		this.#drawOrderCounter++;

		if (node instanceof UINode) {
			const isInteractable = node.isInteractable();
			if (isInteractable) {
				const isInside = node.contains(viewInputPosition);
				if (isInside) {
					if (currentDrawOrder > this.#hitDrawOrder) {
						this.#hitNode = node;
						this.#hitDrawOrder = currentDrawOrder;
					}
				}
			}
		}

		// 자식 순회. (draw() 순서와 동일)
		const children = node.getChildren();
		for (const child of children) {
			this.traverse(child, viewInputPosition);
		}
	}
}
