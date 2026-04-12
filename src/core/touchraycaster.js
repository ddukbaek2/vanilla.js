//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { UINode } from "./node/uinode.js";


//==============================================================================
// 터치 레이캐스터.
// - 씬의 touchPress / touchMove / touchRelease / touchCancel을 받아
//   루트 노드 트리를 draw() 순서로 순회하고,
//   활성 + isInteractable() 노드 중 가장 앞(높은 번호)의 노드에
//   터치 이벤트를 전달한다.
//==============================================================================
export class TouchRaycaster extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { * } */ #rootNode;
	/** @private @type { UINode | null } */ #currentTarget;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.#rootNode = null;
		this.#currentTarget = null;
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
	// 현재 터치 대상 반환.
	//==============================================================================
	/**
	 * @returns { UINode | null }
	 */
	getCurrentTarget() {
		return this.#currentTarget;
	}

	//==============================================================================
	// 터치 누름.
	// - raycast로 대상을 결정하고 touchPress를 전달한다.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition
	 */
	touchPress(viewInputPosition) {
		const hitNode = this.raycast(viewInputPosition);
		this.#currentTarget = hitNode;
		if (hitNode) {
			hitNode.touchPress(viewInputPosition);
		}
	}

	//==============================================================================
	// 터치 이동.
	// - press 시 결정된 대상에 touchMove를 전달한다.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition
	 */
	touchMove(viewInputPosition) {
		const currentTarget = this.#currentTarget;
		if (currentTarget) {
			currentTarget.touchMove(viewInputPosition);
		}
	}

	//==============================================================================
	// 터치 뗌.
	// - press 시 결정된 대상에 touchRelease를 전달하고 대상을 해제한다.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition
	 */
	touchRelease(viewInputPosition) {
		const currentTarget = this.#currentTarget;
		if (currentTarget) {
			currentTarget.touchRelease(viewInputPosition);
		}
		this.#currentTarget = null;
	}

	//==============================================================================
	// 터치 취소.
	// - press 시 결정된 대상에 touchCancel을 전달하고 대상을 해제한다.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition
	 */
	touchCancel(viewInputPosition) {
		const currentTarget = this.#currentTarget;
		if (currentTarget) {
			currentTarget.touchCancel(viewInputPosition);
		}
		this.#currentTarget = null;
	}

	//==============================================================================
	// 레이캐스트.
	// - 루트 노드로부터 draw() 호출 순서대로 번호를 매기며 순회한다.
	// - 활성화 상태이고 isInteractable()이 참이며 터치 좌표를 포함하는
	//   노드 중 가장 높은 번호의 노드를 반환한다.
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

		let drawOrderCounter = 0;
		let hitNode = null;
		let hitDrawOrder = -1;

		const traverse = (node) => {
			if (!node) {
				return;
			}
			const isActive = node.isActive();
			if (!isActive) {
				return;
			}

			// 현재 노드에 번호 부여 후 판정.
			const currentDrawOrder = drawOrderCounter;
			++drawOrderCounter;

			if (node instanceof UINode) {
				const isInteractable = node.isInteractable();
				if (isInteractable) {
					const isInside = node.contains(viewInputPosition);
					if (isInside) {
						if (currentDrawOrder > hitDrawOrder) {
							hitNode = node;
							hitDrawOrder = currentDrawOrder;
						}
					}
				}
			}

			// 자식 순회. (draw() 순서와 동일)
			const children = node.getChildren();
			for (const child of children) {
				traverse(child);
			}
		};

		traverse(rootNode);

		return hitNode;
	}
}
