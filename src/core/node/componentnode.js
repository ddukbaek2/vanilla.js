//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../../base/vector2.js";
import { Graphic } from "../graphic.js";
import { Component } from "../component.js";
import { Node } from "../../base/node.js"; 


//==============================================================================
// 계층적 컴포넌트 처리 객체.
// - 컴포넌트 기능.
// - 주기적 갱신 기능. (컴포넌트 포함)
//==============================================================================
export class ComponentNode extends Node {
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
	/** @private @type { Component[] } */ #components; // 컴포넌트 목록.

    //==============================================================================
    // 생성.
    //==============================================================================
    /**
     * @constructor
     */
    constructor() {
        super();

		this.#components = [];
    }

	// //==============================================================================
	// // 초기화.
	// //==============================================================================
	// /**
	//  * @virtual
	//  */
	// initialize(timeDelta) {

	// }

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
		for (const component of components) {
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

		// 붙음.
		component.attach(this);

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

		// 떼어짐.
		component.detach(this);
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
}