//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Node } from "../core/node.js";


//==============================================================================
// 비주얼 객체.
//==============================================================================
export class Visual extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Visual } */ #parent;
	/** @private @type { Visual[] } */ #children;
	/** @private @type { Vector2 } */ #location;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.#parent = null;
		this.#children = [];
		this.#location = Vector2.zero();
	}

	//==============================================================================
	// 자식 추가.
	//==============================================================================
	/**
	 * @param { Visual } visual 
	 * @returns { boolean }
	 */
	addChild(visual) {
		const childIndex = this.getChildIndex(visual);
		if (childIndex !== -1) {
			return false;
		}

		const parent = visual.getParent();
		if (parent) {
			parent.removeChild(visual);
		}

		this.#children.push(visual);
		return true;
	}

	//==============================================================================
	// 자식 제거.
	//==============================================================================
	/**
	 * @param { Visual } visual
	 * @returns { boolean }
	 */
	removeChild(visual) {
		const childIndex = this.getChildIndex(visual);
		if (childIndex !== -1) {
			const removed = this.removeChildAt(visual);
			return removed;
		}
		return false;
	}

	//==============================================================================
	// 자식 제거.
	//==============================================================================
	/**
	 * @param { number } childIndex
	 * @returns { boolean }
	 */
	removeChildAt(childIndex) {
		const childCount = this.getChildCount();
		if (childIndex < 0 || childIndex >= childCount) {
			return false;
		}
		
		const visual = this.getFChild(childIndex);
		visual.#parent = null;
		this.#children.splice(childIndex, 1);
		return true;
	}

	//==============================================================================
	// 모든 자식 제거.
	//==============================================================================
	removeChildren() {
		while (this.getChildCount() > 0) {
			this.removeChildAt(0);
		}
	}

	//==============================================================================
	// 부모 반환.
	//==============================================================================
	/**
	 * @returns { Visual }
	 */
	getParent() {
		return this.#parent;
	}

	//==============================================================================
	// 모든 자식 반환.
	//==============================================================================
	/**
	 * @returns { Visual[] }
	 */
	getChildren() {
		return this.#children;
	}

	//==============================================================================
	// 자식 갯수 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getChildCount() {
		return this.#children.length;
	}

	//==============================================================================
	// 자식 반환.
	//==============================================================================
	/**
	 * @param { number } childIndex 
	 * @returns { Visual | undefined }
	 */
	getChild(childIndex) {
		return this.#children.at(childIndex);
	}

	//==============================================================================
	// 자식 인덱스 반환.
	//==============================================================================
	/**
	 * @param { Visual } visual 
	 * @returns { number }
	 */
	getChildIndex(visual) {
		if (visual === null || visual === undefined) {
			return -1;
		}

		const childIndex = this.#children.indexOf(visual);
		return childIndex;
	}

	//==============================================================================
	// 자식 포함 여부 반환.
	//==============================================================================
	/**
	 * @param { Visual } visual 
	 * @returns { boolean }
	 */
	contains(visual) {
		const childIndex = this.getChildIndex(visual);
		if (childIndex !== -1) {
			return true;
		}

		return false;
	}
}