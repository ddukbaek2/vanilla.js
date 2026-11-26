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
/**
 * @example <caption>계층 만들고 이름으로 찾기</caption>
 * import { Node } from "./build/vanilla.js";
 *
 * const root = new Node();
 * root.setName("root");
 * const child = new Node();
 * child.setName("child");
 * root.addChild(child);
 * const grandChild = new Node();
 * grandChild.setName("grandChild");
 * child.addChild(grandChild);
 * child.setActive(false);
 * const found = root.findChildRecursiveByName("grandChild");
 * console.log(found === grandChild, grandChild.isActive(), grandChild.isActiveInHierarchy());
 * console.log(root.getChildCount(), grandChild.getParent() === child, root.isRoot(), grandChild.isLeaf());
 */
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
	 * @param { Node | null } parent 새 부모. (null 이면 지금 부모에서 떼어 내기만 한다)
	 * @returns { boolean } 붙였거나 떼었으면 참. (자신이나 자신의 자손 밑으로는 계층이 고리가 되므로 붙이지 않고 거짓)
	 */
	setParent(parent) {
		// 자신이나 자손 밑으로 붙이면 계층이 고리가 되어 위로 올라가는 셈(isActiveInHierarchy 등)이 끝나지 않는다.
		let ancestor = parent;
		while (ancestor) {
			if (ancestor === this) {
				return false;
			}
			ancestor = ancestor.getParent();
		}

		// 기존 부모가 존재 할 경우.
		const currentParent = this.getParent();
		if (currentParent) {
			// 동일 부모 일 경우 무시.
			if (currentParent === parent) {
				return true;
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
		return true;
	}

	//==============================================================================
	// 자식 추가.
	//==============================================================================
	/**
	 * @param { Node } child 붙일 노드. (다른 부모에 붙어 있었으면 거기서 떼어 와 자식 목록 맨 뒤에 붙인다)
	 * @returns { boolean } 붙였으면 참. (이 노드 자신이나 이 노드의 조상이면 붙이지 않고 거짓)
	 */
	addChild(child) {
		const isAttached = child.setParent(this);
		return isAttached;
	}

	//==============================================================================
	// 자식 제거.
	//==============================================================================
	/**
	 * @param { Node } child 뗄 노드. (이 노드의 자식일 때만 떼어 낸다, 아니면 아무것도 하지 않는다)
	 */
	removeChild(child) {
		const childParent = child.getParent();
		if (childParent !== this) {
			return;
		}
		child.setParent(null);
	}

	//==============================================================================
	// 자식 제거.
	//==============================================================================
	/**
	 * @param { number } childIndex 뗄 자식의 차례. (0 부터, 범위 밖이면 아무것도 하지 않는다)
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
	 * @returns { boolean } 부모가 없으면 참.
	 */
	isRoot() {
		const parent = this.getParent();
		return !Node.isValidate(parent);
	}

	//==============================================================================
	// 자식이 없는지 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 자식이 없으면 참.
	 */
	isLeaf() {
		const children = this.getChildren();
		return children.length === 0;
	}

	//==============================================================================
	// 부모 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 부모가 있으면 참.
	 */
	hasParent() {
		const parent = this.getParent();
		return parent !== null;
	}

	//==============================================================================
	// 부모 반환.
	//==============================================================================
	/**
	 * @returns { Node } 부모 노드. (없으면 null)
	 */
	getParent() {
		return this.#parent;
	}

	//==============================================================================
	// 형제 목록 반환.
	//==============================================================================
	/**
	 * @returns { Node[] | null } 부모의 자식 목록. (자신도 들어 있는 원본 배열, 부모가 없으면 null)
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
	 * @returns { Node[] } 직계 자식 목록. (복사하지 않은 원본 배열)
	 */
	getChildren() {
		return this.#children;
	}

	//==============================================================================
	// 자식 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 직계 자식 수.
	 */
	getChildCount() {
		const children = this.getChildren();
		return children.length;
	}

	//==============================================================================
	// 자식 반환.
	//==============================================================================
	/**
	 * @param { number } childIndex 자식의 차례. (0 부터)
	 * @returns { Node | null } 그 차례의 직계 자식. (범위 밖이면 null)
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
	 * @param { Node } child 찾을 노드.
	 * @returns { number } 직계 자식 목록에서의 차례. (자식이 아니면 -1)
	 */
	getChildIndex(child) {
		const children = this.getChildren();
		return children.indexOf(child);
	}

	//==============================================================================
	// 자식 포함 여부 반환.
	//==============================================================================
	/**
	 * @param { Node } child 찾을 노드.
	 * @returns { boolean } 직계 자식이면 참.
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
	 * @param { boolean } active 참이면 활성. (자식의 값은 바꾸지 않는다)
	 */
	setActive(active) {
		this.#isActive = active;
	}

	//==============================================================================
	// 활성화 상태 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 자신이 활성이면 참. (부모는 보지 않는다)
	 */
	isActive() {
		return this.#isActive;		
	}

	//==============================================================================
	// 현재부터 루트까지 계층 전체의 활성화 상태 반환. (루트까지 하나라도 비활성화상태면 false 반환)
	//==============================================================================
	/**
	 * @returns { boolean } 자신과 루트까지의 모든 부모가 활성이면 참.
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
	 * @param { string } name 노드 이름. (같은 이름을 막지 않는다)
	 */
	setName(name) {
		this.#name = name;
	}

	//==============================================================================
	// 이름 반환.
	//==============================================================================
	/**
	 * @returns { string } 노드 이름. (기본 빈 글)
	 */
	getName() {
		return this.#name;
	}

	//==============================================================================
	// 조건으로 직계 자식 찾기.
	//==============================================================================
	/**
	 * @param { function(Node): boolean } predicate 직계 자식을 받아 고를 것이면 참을 돌려주는 함수. (null 이면 null 을 돌려준다)
	 * @returns { Node | null } 자식 목록 차례로 처음 맞은 직계 자식. (없으면 null)
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
	 * @param { function(Node): boolean } predicate 자손을 받아 고를 것이면 참을 돌려주는 함수.
	 * @returns { Node | null } 깊이 우선으로 처음 맞은 자손. (손자 아래까지 모두 본다, 없으면 null)
	 * @example <caption>조건으로 하위 계층 전체에서 찾기</caption>
	 * import { Node } from "./build/vanilla.js";
	 *
	 * const root = new Node();
	 * const child = new Node();
	 * const grandChild = new Node();
	 * root.addChild(child);
	 * child.addChild(grandChild);
	 * grandChild.setActive(false);
	 * const inactiveNode = root.findChildRecursive((node) => {
	 * 	return !node.isActive();
	 * });
	 * console.log(inactiveNode === grandChild);
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
	 * @param { string } name 찾을 이름.
	 * @returns { Node | null } 이름이 같은 첫 직계 자식. (없으면 null)
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
	 * @param { string } name 찾을 이름.
	 * @returns { Node | null } 깊이 우선으로 처음 맞은, 이름이 같은 자손. (없으면 null)
	 */
	findChildRecursiveByName(name) {
		return this.findChildRecursive((child) => {
			return child.getName() === name;
		});
	}

	//==============================================================================
	// 이름으로 하위 계층 전체에서 찾기. (깊이 우선, findChildRecursiveByName 과 같다, 러스트 판 find_descendant_by_name 과 같은 이름)
	//==============================================================================
	/**
	 * @param { string } name 찾을 이름.
	 * @returns { Node | null } 깊이 우선으로 처음 맞은, 이름이 같은 자손. (없으면 null)
	 */
	findDescendantByName(name) {
		const descendant = this.findChildRecursiveByName(name);
		return descendant;
	}

	//==============================================================================
	// 조건에 맞는 직계 자식 떼어 파괴. (떼어 낸 수 반환, 러스트 판 destroy_children_where 와 같은 이름)
	//==============================================================================
	/**
	 * @param { function(Node): boolean } predicate 직계 자식을 받아 떼어 파괴할 것이면 참을 돌려주는 함수.
	 * @returns { number } 떼어 파괴한 자식 수.
	 * @example <caption>조건에 맞는 자식 떼어 파괴하기</caption>
	 * import { Node } from "./build/vanilla.js";
	 *
	 * const root = new Node();
	 * for (let index = 0; index < 4; ++index) {
	 * 	const child = new Node();
	 * 	child.setName("enemy" + index);
	 * 	child.setActive(index % 2 === 0);
	 * 	root.addChild(child);
	 * }
	 * const destroyedCount = root.destroyChildrenWhere((child) => {
	 * 	return !child.isActive();
	 * });
	 * console.log(destroyedCount, root.getChildCount());
	 */
	destroyChildrenWhere(predicate) {
		const children = this.getChildren().slice();
		let destroyedCount = 0;
		for (const child of children) {
			if (!predicate(child)) {
				continue;
			}
			this.removeChild(child);
			child.destroy();
			destroyedCount += 1;
		}
		return destroyedCount;
	}

	//==============================================================================
	// 이름으로 직계 자식 제거.
	//==============================================================================
	/**
	 * @param { string } name 뗄 직계 자식의 이름. (같은 이름이 여럿이면 첫 자식만 뗀다)
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
	 * @param { number } childIndex 형제 사이의 새 차례. (0 ~ 형제 수 - 1 로 자른다, 부모가 없으면 아무것도 하지 않는다)
	 * @example <caption>형제 사이에서 맨 앞, 맨 뒤로 옮기기</caption>
	 * import { Node } from "./build/vanilla.js";
	 *
	 * const root = new Node();
	 * const first = new Node();
	 * const second = new Node();
	 * const third = new Node();
	 * root.addChild(first);
	 * root.addChild(second);
	 * root.addChild(third);
	 * third.setSiblingIndex(0);
	 * first.setSiblingIndex(100);
	 * console.log(third.getSiblingIndex(), second.getSiblingIndex(), first.getSiblingIndex());
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
	 * @returns { number } 형제 사이의 차례. (부모가 없으면 -1)
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