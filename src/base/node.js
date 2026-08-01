//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "./object.js";
import * as Math from "./math.js";


//==============================================================================
// 계층 객체.
// - 부모와 자식을 가질 수 있는 계층 구조 기능.
// - 활성화 여부 지정 기능.
//==============================================================================
export class Node extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Node | null } */	#parent; // 부모 노드.
	/** @private @type { Node[] } */		#children; // 자식 노드 목록.
	/** @private @type { boolean } */		#isActive; // 활성화 여부.
	/** @private @type { string } */		#name; // 노드 이름.

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
		this.#isActive = true;
		this.#name = "";
	}

	//==============================================================================
	// 부모 설정.
	//==============================================================================
	/**
	 * @param { Node } parent 
	 */
	setParent(parent) {
		if (this === parent) {
			throw new Error("");
		}

		// 기존 부모가 존재 할 경우.
		const currentParent = this.getParent();
		if (currentParent) {
			// 동일 부모 일 경우 무시.
			if (currentParent === parent) {
				return;
			}

			// 기존 부모의 자식 제거.
			const currentParentChildren = currentParent.getChildren();
			const childIndex = currentParentChildren.indexOf(this);
			currentParentChildren.splice(childIndex, 1);
			this.#parent = null;
		}

		// 새 부모가 존재 할 경우.
		if (parent) {
			// 새 부모의 자식 추가.
			this.#parent = parent;
			const newParentChildren = parent.getChildren();
			newParentChildren.push(this);
		}
	}

	//==============================================================================
	// 자식 추가.
	//==============================================================================
	/**
	 * @param { Node } child 
	 */
	addChild(child) {
		child.setParent(this);
	}

	//==============================================================================
	// 자식 제거.
	//==============================================================================
	/**
	 * @param { Node } child 
	 */
	removeChild(child) {
		child.setParent(null);
	}

	//==============================================================================
	// 자식 제거.
	//==============================================================================
	/**
	 * @param { number } childIndex 
	 */
	removeChildAt(childIndex) {
		if (childIndex !== -1) {
			const child = this.getChild(childIndex);
			if (child) {
				this.removeChild(child);
			}
		}
	}

	//==============================================================================
	// 모든 자식 제거. (직계 자식 목록만 비우기 때문에 자식들이 소유한 계층 구조는 유지됨)
	//==============================================================================
	removeChildren() {
		const children = this.getChildren();
		while (children.length > 0) {
			const child = children.at(0);
			this.removeChild(child);
		}
	}

	//==============================================================================
	// 부모가 없는지 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 
	 */
	isRoot() {
		const parent = this.getParent();
		return !Node.isValidate(parent);
	}

	//==============================================================================
	// 자식이 없는지 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 
	 */
	isLeaf() {
		const children = this.getChildren();
		return children.length === 0;
	}

	//==============================================================================
	// 부모 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 
	 */
	hasParent() {
		const parent = this.getParent();
		return parent !== null;
	}

	//==============================================================================
	// 부모 반환.
	//==============================================================================
	/**
	 * @returns { Node } 
	 */
	getParent() {
		return this.#parent;
	}

	//==============================================================================
	// 형제 목록 반환.
	//==============================================================================
	/**
	 * @returns { Node[] | null } 
	 */
	getSiblings() {
		const parent = this.getParent();
		if (!parent) {
			return null;
		}

		const children = parent.getChildren();
		return children;
	}

	//==============================================================================
	// 자식 목록 반환.
	//==============================================================================
	/**
	 * @returns { Node[] } 
	 */
	getChildren() {
		return this.#children;
	}

	//==============================================================================
	// 자식 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 
	 */
	getChildCount() {
		const children = this.getChildren();
		return children.length;
	}

	//==============================================================================
	// 자식 반환.
	//==============================================================================
	/**
	 * @returns { Node | null } 
	 */
	getChild(childIndex) {
		const children = this.getChildren();
		if (childIndex < 0 || childIndex >= children.length) {
			return null;
		}

		return children[childIndex];
	}

	//==============================================================================
	// 자식의 위치 반환.
	//==============================================================================
	/**
	 * @param { Node } child
	 * @returns { number } 
	 */
	getChildIndex(child) {
		const children = this.getChildren();
		return children.indexOf(child);
	}

	//==============================================================================
	// 자식 포함 여부 반환.
	//==============================================================================
	/**
	 * @param { Node } child 
	 * @returns { boolean }
	 */
	hasChild(child) {
		const childIndex = this.getChildIndex(child);
		if (childIndex !== -1) {
			return true;
		}

		return false;
	}

	//==============================================================================
	// 활성화 상태 설정.
	//==============================================================================
	/**
	 * @param { boolean } active 
	 */
	setActive(active) {
		this.#isActive = active;
	}

	//==============================================================================
	// 활성화 상태 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 
	 */
	isActive() {
		return this.#isActive;		
	}

	//==============================================================================
	// 현재부터 루트까지 계층 전체의 활성화 상태 반환. (루트까지 하나라도 비활성화상태면 false 반환)
	//==============================================================================
	/**
	 * @returns { boolean } 
	 */
	isActiveInHierarchy() {
		if (this.isActive()) {
			let current = this;
			while (current !== null && current !== undefined) {
				if (current.isActive()) {
					current = current.getParent();
				}
				else {
					return false;
				}
			}
			return true;
		} else {
			return false;
		}
	}
	
	//==============================================================================
	// 이름 설정.
	//==============================================================================
	/**
	 * @param { string } name
	 */
	setName(name) {
		this.#name = name;
	}

	//==============================================================================
	// 이름 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getName() {
		return this.#name;
	}

	//==============================================================================
	// 조건으로 직계 자식 찾기.
	//==============================================================================
	/**
	 * @param { function(Node): boolean } predicate
	 * @returns { Node | null }
	 */
	findChild(predicate) {
		if (predicate) {
			const children = this.getChildren();
			for (const child of children) {
				if (predicate(child)) {
					return child;
				}
			}
		}

		return null;
	}

	//==============================================================================
	// 조건으로 직계 자식 찾기. (깊이 우선)
	//==============================================================================
	/**
	 * @param { function(Node): boolean } predicate
	 * @returns { Node | null }
	 */
	findChildRecursive(predicate) {
		const children = this.getChildren();
		for (const child of children) {
			if (predicate(child)) {
				return child;
			}
			const found = child.findChildRecursive(predicate);
			if (found !== null) {
				return found;
			}
		}
		return null;
	}

	
	//==============================================================================
	// 이름으로 직계 자식 찾기.
	//==============================================================================
	/**
	 * @param { string } name
	 * @returns { Node | null }
	 */
	findChildByName(name) {
		return this.findChild((child) => {
			return child.getName() === name;
		});
	}

	//==============================================================================
	// 이름으로 하위 계층 전체에서 찾기. (깊이 우선)
	//==============================================================================
	/**
	 * @param { string } name
	 * @returns { Node | null }
	 */
	findChildRecursiveByName(name) {
		return this.findChildRecursive((child) => {
			return child.getName() === name;
		});
	}

	//==============================================================================
	// 이름으로 직계 자식 제거.
	//==============================================================================
	/**
	 * @param { string } name
	 */
	removeChildByName(name) {
		const child = this.findChildByName(name);
		if (child !== null) {
			this.removeChild(child);
		}
	}

	//==============================================================================
	// 형제간의 위치 설정.
	//==============================================================================
	/**
	 * @param { number } childIndex
	 */
	setSiblingIndex(childIndex) {
		if (!this.hasParent()) {
			return;
		}

		const parent = this.getParent();
		const children = parent.getChildren();
		const oldChildIndex = children.indexOf(this);
		const newChildIndex = Math.clamp(childIndex, 0, children.length - 1);
		if (oldChildIndex === newChildIndex) {
			return;
		}		

		children.splice(oldChildIndex, 1);
        children.splice(newChildIndex, 0, this);
	}

	//==============================================================================
	// 형제간의 위치 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getSiblingIndex() {
		if (!this.hasParent()) {
			return -1;
		}

		const parent = this.getParent();
		const childIndex = parent.getChildIndex(this);
		return childIndex;
	}

	// //==============================================================================
	// // 새로운 노드 생성.
	// //==============================================================================
	// /**
	//  * @returns { Node }
	//  */
	// static create() {
	// 	var obj = new Node();
	// 	return obj;
	// }
}