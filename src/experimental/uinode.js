//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Pivot } from "../base/pivot.js";
import { Vector2 as Vector2 } from "../base/vector2.js";
import { Node } from "../core/node.js";


//==============================================================================
// UI에 특화된 노드.
//==============================================================================
export class VUINode extends Node {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Vector2 } */ #pivot;
	/** @private @type { Vector2 } */ #contentSize;
	/** @private @type { Vector2 } */ #anchorMin;
	/** @private @type { Vector2 } */ #anchorMax;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		
		// this.#pivot = Pivot.topLeft;
		this.#pivot = Pivot.middleCenter;
		this.#contentSize = Vector2.zero();
		this.#contentSize = Vector2.zero();
		this.#anchorMin = Vector2.zero();
		this.#anchorMax = Vector2.zero();
	}

	/**
	 * @returns { Vector2 }
	 */
	getContentSize() {
		return this.#contentSize;
	}
}