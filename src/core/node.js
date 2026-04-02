//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Graphic } from "./graphic.js";
import * as Math from "../base/math.js";
import { Component } from "./component.js";
import { Pivot } from "../base/pivot.js";
import { Rect } from "../base/rect.js";
import { OBB } from "../base/obb.js";


//==============================================================================
// 계층 객체.
// - 부모와 자식을 가질 수 있다.
// - 컴포넌트를 가질 수 있다.
// - 활성화 여부를 지정할 수 있다.
// - tick()을 처리 할 수 있다. (엔진에서 호출)
//==============================================================================
export class Node extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Component[] } */ #components; // 컴포넌트 목록.
	/** @private @type { Node | null } */ #parent; // 부모 노드.
	/** @private @type { Node[] } */ #children; // 자식 노드 목록.
	/** @private @type { boolean } */ #isActive; // 활성화 여부.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.#components = [];
		this.#parent = null;
		this.#children = [];
		this.#isActive = true;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @virtual
	 * @param { number } timeDelta 
	 */
	tick(timeDelta) {
		if (!this.isActive()) {
			return;
		}

		// 컴포넌트.
		const components = this.getAllComponents();
		for (const component of this.getAllComponents()) {
			component.tick(timeDelta);
		}

		// 자식.
		const children = this.getChildren();
		for (const child of children) {
			child.tick(timeDelta);
		}
	}

	//==============================================================================
	// 타입으로 컴포넌트 추가.
	//==============================================================================
	/**
	 * @param { Function } componentType  
	 */
	addComponent(componentType) {
		if (componentType === null || componentType === undefined) {
			return null;
		}
		const component = new componentType();
		component.setNode(this);

		const components = this.getAllComponents();
		components.push(component);
		return component;
	}

	//==============================================================================
	// 객체로 컴포넌트 제거.
	//==============================================================================
	/**
	 * @param { Component } component 
	 */
	removeComponent(component) {
		const components = this.getAllComponents();
		const index = components.indexOf(component);
		if (index === -1) {
			return;
		}

		component.setNode(null);
		components.splice(index, 1);
	}

	//==============================================================================
	// 컴포넌트 보유 여부..
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	hasComponent(componentType) {
		const component = this.getComponent(componentType);
		return component !== null && component !== undefined;
	}

	//==============================================================================
	// 모든 컴포넌트 목록 반환.
	//==============================================================================
	/**
	 * @returns { Component[] }
	 */
	getAllComponents() {
		return this.#components;
	}

	//==============================================================================
	// 타입에 대한 컴포넌트 반환.
	//==============================================================================
	/**
	 * @param { Function } componentType 
	 * @returns { Component | null }
	 */
	getComponent(componentType) {
		const component = this.#components.find(component => component instanceof componentType);
		if (component === null || component === undefined) {
			return null;
		}		
		return component;
	}

	//==============================================================================
	// 타입에 대한 모든 컴포넌트 반환.
	//==============================================================================
	/**
	 * @param { Function } componentType 
	 * @returns { Component[] }
	 */
	getComponents(componentType) {
		const result = [];
		const components = this.getAllComponents();
		for (const component of components) {
			if (component instanceof componentType) {
				result.push(component);
			}
		}
		return result;
	}

	//==============================================================================
	// 부모 설정.
	//==============================================================================
	/**
	 * @param { Node } parent 
	 */
	setParent(parent) {
		// 기존 부모가 존재 할 경우.
		if (this.#parent) {
			// 동일 부모.
			if (this.#parent === parent) {
				return;
			}

			// 자식 제거.
			const index = this.#parent.#children.indexOf(this);
			if (index !== -1) {
				this.#parent.#children.splice(index, 1);
			}

			this.#parent = null;
		}

		this.#parent = parent;

		// 새 부모가 존재 할 경우.
		if (this.#parent) {
			// 자식 추가.
			parent.#children.push(this);
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
		return this.#parent === null || this.#parent === undefined;
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
	// 부모 반환.
	//==============================================================================
	/**
	 * @returns { Node } 
	 */
	getParent() {
		return this.#parent;
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
	getChildCount(index) {
		return this.#children.length;
	}

	//==============================================================================
	// 자식 반환.
	//==============================================================================
	/**
	 * @returns { Node } 
	 */
	getChild(index) {
		return this.#children[index];
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