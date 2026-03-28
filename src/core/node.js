//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Renderer } from "./renderer.js";
import * as Math from "../base/math.js";
import { Component } from "./component.js";
import { Pivot } from "../base/pivot.js";


//==============================================================================
// 계층 및 영역 객체.
//==============================================================================
export class Node extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Component[] } */ #components; // 컴포넌트 목록.
	/** @private @type { Node | null } */ #parent; // 부모 노드.
	/** @private @type { Node[] } */ #children; // 자식 노드 목록.
	/** @private @type { Vector2 } */ #localPosition; // 로컬 위치.
	/** @private @type { Vector2 } */ #localScale; // 로컬 크기.
	/** @private @type { number } */ #localRotation; // 로컬 회전값. (degree)
	/** @private @type { boolean } */ #isActive; // 활성화 여부.
	/** @private @type { number } */ #opacity; // 투명도.
	/** @private @type { Vector2 } */ #pivot; // 기준점.
	/** @private @type { Vector2 } */ #size; // 크기.

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
		this.#localPosition = Vector2.zero();
		this.#localScale = Vector2.one();
		this.#localRotation = 0.0;
		this.#isActive = true;
		this.#opacity = 1.0;
		this.#pivot = Pivot.middleCenter;
		this.#size = Vector2.zero();
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
		for (const component of this.getAllComponents()) {
			component.tick(timeDelta);
		}

		// 자식.
		for (const child of this.#children) {
			child.tick(timeDelta);
		}
	}

	//==============================================================================
	// 출력 상태 시작.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Renderer } renderer 
	 */
	beginCanvasState(renderer) {
		const canvasContext = renderer.getCanvasContext();
		if (canvasContext) {
			canvasContext.save();

			const localPosition = this.getLocalPosition();
			const degree = this.getLocalRotation();
			let radian = Math.degreeToRadian(degree);
			const scale = this.getLocalScale();
			const opacity = this.getOpacity();

			const pivot = this.getPivot();
			const size = this.getSize();

			// 트랜스폼 조정.
			canvasContext.translate(localPosition.x, localPosition.y);
			canvasContext.rotate(radian);
			canvasContext.scale(scale.x, scale.y);
			
			// 피봇 반영.
			canvasContext.translate(-(size.x * pivot.x), -(size.y * pivot.y));

			// 컬러 반영.
			canvasContext.globalAlpha *= opacity;
		}
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Renderer } renderer 
	 */
	draw(renderer) {
		const isVisible = this.isVisible();
		if (isVisible) {
			// 컴포넌트 목록 출력.
			const components = this.getAllComponents();
			for (const component of components) {
				component.draw(renderer);
			}

			// 기즈모 출력.
			this.drawGizmos(renderer);
		}
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Renderer } renderer 
	 */
	drawGizmos(renderer) {
		// 영역 및 기준점 출력.
		const canvasContext = renderer.getCanvasContext();
		if (canvasContext) {
			// 좌표.
			const size = this.getSize();
			const pivot = this.getPivot();
			const origin = Vector2.create(size.x * pivot.x, size.y * pivot.y);
			const left = 0;
			const top = 0;
			const right = left + size.x;
			const bottom = top + size.y;

			// 기존 투명도 무효화 및 색상 설정.
			const originalAlpha = canvasContext.globalAlpha;
			canvasContext.globalAlpha = 1.0;
			canvasContext.fillStyle = "#000000";
			canvasContext.strokeStyle = "#000000";

			// 범위.
			canvasContext.beginPath();
			canvasContext.moveTo(left, top);
			canvasContext.lineTo(right, top);
			canvasContext.lineTo(right, bottom);
			canvasContext.lineTo(left, bottom);
			canvasContext.lineTo(left, top);
			canvasContext.stroke();
			// canvasContext.globalAlpha = originalAlpha;

			// 기준점.
			const pointSize = 4;
			canvasContext.beginPath();
			canvasContext.arc(origin.x, origin.y, pointSize, 0, Math.PI * 2);
			canvasContext.fill();
			// canvasContext.fillRect(left - (pointSize / 2), top - (pointSize / 2), pointSize, pointSize);

			// 기존 투명도 복원.
			canvasContext.globalAlpha = originalAlpha;
		}
	}

	//==============================================================================
	// 출력 상태 종료.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Renderer } renderer 
	 */
	endCanvasState(renderer) {
		const canvasContext = renderer.getCanvasContext();
		if (canvasContext) {
			canvasContext.restore();
		}
	}

	//==============================================================================
	// 피봇에 기반한 로컬 위치 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getPivotPosition() {
		const size = this.getSize();
		const pivot = this.getPivot();
		return Vector2.create(-(size.x * pivot.x), -(size.y * pivot.y));
	}

	//==============================================================================
	// 로컬 위치 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } position 
	 */
	setLocalPosition(position) {
		this.#localPosition = position;
	}

	//==============================================================================
	// 로컬 위치 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 
	 */
	getLocalPosition() {
		return this.#localPosition;
	}

	//==============================================================================
	// 글로벌 위치 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } position 
	 */
	setPosition(position) {
		const parent = this.getParent();
		if (!parent) {
			this.setLocalPosition(position);
			return;
		}

		const parentPos = parent.getPosition();
		const parentRot = parent.getRotation();
		const parentScale = parent.getScale();

		// 부모 기준 위치 차이
		const dx = position.x - parentPos.x;
		const dy = position.y - parentPos.y;

		// 역회전
		const radian = Math.degreeToRadian(-parentRot);
		const cosR = Math.cos(radian);
		const sinR = Math.sin(radian);

		const rx = dx * cosR - dy * sinR;
		const ry = dx * sinR + dy * cosR;

		// 역스케일
		const sx = parentScale.x !== 0 ? rx / parentScale.x : 0;
		const sy = parentScale.y !== 0 ? ry / parentScale.y : 0;

		this.setLocalPosition(Vector2.create(sx, sy));
	}

	//==============================================================================
	// 글로벌 위치 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 
	 */
	getPosition() {
		const parent = this.getParent();
		const localPos = this.getLocalPosition();
		if (!parent) {
			return localPos;
		}

		const parentPos = parent.getPosition();
		const parentRot = parent.getRotation();
		const parentScale = parent.getScale();

		const radian = Math.degreeToRadian(parentRot);
		const cosR = Math.cos(radian);
		const sinR = Math.sin(radian);

		// 스케일 및 회전 적용
		const sx = localPos.x * parentScale.x;
		const sy = localPos.y * parentScale.y;

		const rx = sx * cosR - sy * sinR;
		const ry = sx * sinR + sy * cosR;

		return Vector2.create(parentPos.x + rx, parentPos.y + ry);
	}

	//==============================================================================
	// 로컬 크기 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } scale 
	 */
	setLocalScale(scale) {
		this.#localScale = scale;
	}

	//==============================================================================
	// 로컬 크기 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 
	 */
	getLocalScale() {
		return this.#localScale;
	}

	//==============================================================================
	// 글로벌 크기 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } scale 
	 */
	setScale(scale) {
		const parent = this.getParent();
		if (!parent) {
			this.setLocalScale(scale);
		} else {
			const pScale = parent.getScale();
			this.setLocalScale(Vector2.create(
				pScale.x !== 0 ? scale.x / pScale.x : 0,
				pScale.y !== 0 ? scale.y / pScale.y : 0
			));
		}
	}

	//==============================================================================
	// 글로벌 크기 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 
	 */
	getScale() {
		const parent = this.getParent();
		const localScale = this.getLocalScale();
		if (!parent) {
			return localScale;
		}
		const pScale = parent.getScale();
		return Vector2.create(pScale.x * localScale.x, pScale.y * localScale.y);
	}

	//==============================================================================
	// 로컬 회전 설정.
	//==============================================================================
	/**
	 * @param { number } rotation 
	 */
	setLocalRotation(rotation) {
		this.#localRotation = rotation;
	}

	//==============================================================================
	// 로컬 회전 반환.
	//==============================================================================
	/**
	 * @returns { number } 
	 */
	getLocalRotation() {
		return this.#localRotation;
	}

	//==============================================================================
	// 글로벌 회전 설정.
	//==============================================================================
	/**
	 * @param { number } rotation 
	 */
	setRotation(rotation) {
		const parent = this.getParent();
		if (!parent) {
			this.setLocalRotation(rotation);
		} else {
			this.setLocalRotation(rotation - parent.getRotation());
		}
	}

	//==============================================================================
	// 글로벌 회전 반환.
	//==============================================================================
	/**
	 * @returns { number } 
	 */
	getRotation() {
		const parent = this.getParent();
		const localRot = this.getLocalRotation();
		if (!parent) {
			return localRot;
		}
		return parent.getRotation() + localRot;
	}

	//==============================================================================
	// 타입으로 컴포넌트 추가.
	//==============================================================================
	/**
	 * @param { Function } componentType  
	 */
	addComponent(componentType) {
		if (componentType === null) {
			return null;
		}
		const component = new componentType();
		component.setNode(this);
		this.#components.push(component);
		return component;
	}

	//==============================================================================
	// 객체로 컴포넌트 제거.
	//==============================================================================
	/**
	 * @param { Component } component 
	 */
	removeComponent(component) {
		const index = this.#components.indexOf(component);
		if (index === -1) {
			return;
		}

		component.setNode(null);
		this.#components.splice(index, 1);
	}

	//==============================================================================
	// 컴포넌트 보유 여부..
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	hasComponent(componentType) {
		return this.getComponent(componentType) !== null;
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
		if (component === null) {
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
		const components = [];
		for (const component of this.getAllComponents()) {
			if (component instanceof componentType) {
				components.push(component);
			}
		}
		return components;
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
		while (this.#children.length > 0) {
			const child = this.#children[0];
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
		return this.#parent === null;
	}

	//==============================================================================
	// 자식이 없는지 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 
	 */
	isLeaf() {
		return this.#children.length === 0;
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
	// 현재부터 루트까지 계층 전체의 활성화 상태 반환. (루트까지 하나라도 비활성화상태면 false 반환)
	//==============================================================================
	/**
	 * @returns { boolean } 
	 */
	isActiveInHierarchy() {
		if (this.isActive()) {
			let current = this;
			while (current !== null) {
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
	// 활성화 상태 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 
	 */
	isActive() {
		return this.#isActive;		
	}

	//==============================================================================
	// 현재부터 루트까지 계층 전체의 가시 상태 반환. (루트까지 하나라도 비활성화상태면 false 반환)
	//==============================================================================
	/**
	 * @returns { boolean } 
	 */
	isVisibleInHierarchy() {
		if (this.isVisible()) {
			let current = this;
			while (current !== null) {
				if (current.isVisible()) {
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
	// 가시 상태 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 
	 */
	isVisible() {
		const opacity = this.getOpacity();
		const isVisible = opacity > 0;
		return isVisible;
	}

	//==============================================================================
	// 투명도 설정.
	//==============================================================================
	/**
	 * @param { number } opacity 
	 */
	setOpacity(opacity) {
		this.#opacity = Math.clamp(opacity, 0, 1);
	}

	//==============================================================================
	// 투명도 반환.
	//==============================================================================
	/**
	 * @returns { number } 
	 */
	getOpacity() {
		return this.#opacity;
	}

	//==============================================================================
	// 기준점 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } pivot
	 */
	setPivot(pivot) {
		this.#pivot = pivot;
		// this.#pivot.x = Math.clamp(pivot.x, 0, 1);
		// this.#pivot.y = Math.clamp(pivot.y, 0, 1);
		// console.log(this.#pivot);
	}

	//==============================================================================
	// 기준점 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getPivot() {
		return this.#pivot;
	}

	//==============================================================================
	// 실제 크기 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } size 
	 */
	setSize(size) {
		this.#size = size;
	}

	//==============================================================================
	// 실제 크기 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 
	 */
	getSize() {
		return this.#size;
	}

	//==============================================================================
	// 새로운 노드 생성.
	//==============================================================================
	/**
	 * @returns { Node }
	 */
	static create() {
		var obj = new Node();
		return obj;
	}
}