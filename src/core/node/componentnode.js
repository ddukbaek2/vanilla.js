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
/**
 * @example <caption>컴포넌트 붙이고 찾고 갱신하기</caption>
 * import { ComponentNode, Component } from "./build/vanilla.js";
 *
 * class Health extends Component {
 * 	constructor() {
 * 		super();
 * 		this.hitPoint = 100;
 * 	}
 * }
 *
 * class Poison extends Component {
 * 	require() {
 * 		return [Health];
 * 	}
 *
 * 	tick(timeDelta) {
 * 		const node = this.getNode();
 * 		const health = node.getComponent(Health);
 * 		health.hitPoint -= 10 * timeDelta;
 * 	}
 * }
 *
 * const node = new ComponentNode();
 * node.addComponent(Poison);
 * const health = node.getComponent(Health);
 * node.tick(0.5);
 * const hasHealth = node.hasComponent(Health);
 * console.log(hasHealth, health.hitPoint);
 */
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

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @virtual
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 */
	tick(timeDelta) {
		const isActive = this.isActive();
		if (isActive) {
			// 컴포넌트.
			const components = this.getAllComponents();
			for (const component of components) {
				const isTickNeeded = component.isTickNeeded();
				if (isTickNeeded) {
					component.tick(timeDelta);
				}
			}

			// 자식.
			const children = this.getChildren();
			for (const child of children) {
				const isActive = child.isActive();
				if (isActive) {
					child.tick(timeDelta);
				}
			}
		}
	}

	//==============================================================================
	// 하위 트리 그리기 경계가 바뀌었음을 표시. (그리는 노드 TransformNode 가 덮어쓴다, 여기서는 할 일이 없다)
	// - 컴포넌트를 더하거나 뺄 때, 컴포넌트를 켜고 끌 때 부른다.
	//==============================================================================
	/**
	 * @virtual
	 */
	markDrawBoundsDirty() {
		// 그리지 않는 노드는 경계가 없다.
	}

	//==============================================================================
	// 타입으로 컴포넌트 추가.
	//==============================================================================
	/**
	 * @param { Function } componentType 컴포넌트 클래스. (없으면 붙인다)
	 * @returns { Component | null } 있던 컴포넌트나 새로 붙인 컴포넌트. (componentType 이 없으면 null)
	 */
	getOrAddComponent(componentType) {
		if (componentType === null || componentType === undefined) {
			return null;
		}
		
		const hasComponent = this.hasComponent(componentType);
		if (hasComponent) {
			return this.getComponent(componentType);
		}
		else {
			return this.addComponent(componentType);
		}
	}

	//==============================================================================
	// 타입으로 컴포넌트 추가.
	//==============================================================================
	/**
	 * @param { Function } componentType 붙일 컴포넌트 클래스. (인자 없이 new 로 만들고, 같은 클래스가 있어도 또 붙인다)
	 * @returns { Component | null } 새로 붙인 컴포넌트. (componentType 이 없으면 null)
	 */
	addComponent(componentType) {
		if (componentType === null || componentType === undefined) {
			return null;
		}
		const component = new componentType();
		component.setNode(this);

		const components = this.getAllComponents();
		components.push(component);

		// 의존 컴포넌트(require) 자동 추가. attach 직전에 처리해 attach 본문이
		// 의존 컴포넌트의 존재를 가정할 수 있다.
		const requiredTypes = component.require();
		if (Array.isArray(requiredTypes)) {
			for (const requiredType of requiredTypes) {
				this.getOrAddComponent(requiredType);
			}
		}

		// 붙음.
		component.attach(this);
		this.markDrawBoundsDirty();

		return component;
	}

	//==============================================================================
	// 객체로 컴포넌트 제거.
	//==============================================================================
	/**
	 * @param { Component } component 뗄 컴포넌트. (이 노드에 없으면 아무것도 하지 않는다)
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
		this.markDrawBoundsDirty();
	}

	//==============================================================================
	// 컴포넌트 보유 여부..
	//==============================================================================
	/**
	 * @param { Function } componentType 찾을 컴포넌트 클래스. (자식 클래스도 맞는다)
	 * @returns { boolean } 있으면 참.
	 */
	hasComponent(componentType) {
		const component = this.getComponent(componentType);
		return component !== null && component !== undefined;
	}

	//==============================================================================
	// 모든 컴포넌트 목록 반환.
	//==============================================================================
	/**
	 * @returns { Component[] } 붙은 컴포넌트 목록. (붙인 차례, 안의 배열 그대로)
	 */
	getAllComponents() {
		return this.#components;
	}

	//==============================================================================
	// 타입에 대한 컴포넌트 반환.
	//==============================================================================
	/**
	 * @param { Function } componentType 찾을 컴포넌트 클래스. (자식 클래스도 맞는다)
	 * @returns { Component | null } 처음 맞는 컴포넌트. (없으면 null)
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
	 * @param { Function } componentType 찾을 컴포넌트 클래스. (자식 클래스도 맞는다)
	 * @returns { Component[] } 맞는 컴포넌트 모두. (새 배열)
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