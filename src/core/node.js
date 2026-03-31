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
	/** @private @type { Vector2 } */ #contentSize; // 크기.
	/** @private @type { boolean } */ #isGizmoVisible; // 기즈모 출력 여부.

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
		this.#isGizmoVisible = true;
		this.#opacity = 1.0;
		this.#pivot = Pivot.middleCenter;
		this.#contentSize = Vector2.zero();
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
	 * @param { Graphic } graphic 
	 */
	beginCanvasState(graphic) {
		const canvasRenderingContext = graphic.getCanvasRenderingContext();
		if (canvasRenderingContext) {
			canvasRenderingContext.save();

			const localPosition = this.getLocalPosition();
			const localRotation = this.getLocalRotation();
			const radian = Math.degreeToRadian(localRotation);
			const scale = this.getLocalScale();
			const opacity = this.getOpacity();

			const pivot = this.getPivot();
			const contentSize = this.getContentSize();

			// 트랜스폼 조정.
			canvasRenderingContext.translate(localPosition.x, localPosition.y);
			canvasRenderingContext.rotate(radian);
			canvasRenderingContext.scale(scale.x, scale.y);
			
			// 피봇 반영.
			canvasRenderingContext.translate(-(contentSize.x * pivot.x), -(contentSize.y * pivot.y));

			// 컬러 반영.
			canvasRenderingContext.globalAlpha *= opacity;
		}
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Graphic } graphic 
	 */
	draw(graphic) {
		const isVisible = this.isVisible();
		if (isVisible) {
			// 컴포넌트 목록 출력.
			const components = this.getAllComponents();
			for (const component of components) {
				component.draw(graphic);
			}

			// 자식 목록 출력.
			const children = this.getChildren();
			for (const child of children) {
				graphic.drawNode(child);
			}
		}
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Graphic } graphic 
	 */
	drawGizmo(graphic) {
		const isGizmoVisible = this.isGizmoVisible();
		if (!isGizmoVisible) {
			return;
		}

		// 영역 및 기준점 출력.
		const canvasRenderingContext = graphic.getCanvasRenderingContext();
		if (canvasRenderingContext) {
			// 기존 투명도 무효화 및 색상 설정.
			const originalAlpha = canvasRenderingContext.globalAlpha;
			canvasRenderingContext.globalAlpha = 1.0;

			// 컴포넌트 기즈모 출력.
			const components = this.getAllComponents();
			for (const component of components) {
				component.drawGizmo(graphic);
			}

			// 좌표.
			const contentSize = this.getContentSize();
			const pivot = this.getPivot();
			const origin = Vector2.create(contentSize.x * pivot.x, contentSize.y * pivot.y);
			const left = 0;
			const top = 0;
			const right = left + contentSize.x;
			const bottom = top + contentSize.y;

			// 기존 투명도 무효화 및 색상 설정.
			canvasRenderingContext.fillStyle = "#00ff00";
			canvasRenderingContext.strokeStyle = "#00ff00";

			// 범위.
			canvasRenderingContext.beginPath();
			canvasRenderingContext.moveTo(left, top);
			canvasRenderingContext.lineTo(right, top);
			canvasRenderingContext.lineTo(right, bottom);
			canvasRenderingContext.lineTo(left, bottom);
			canvasRenderingContext.lineTo(left, top);
			canvasRenderingContext.stroke();

			// 기준점.
			const pointSize = 4;
			canvasRenderingContext.beginPath();
			canvasRenderingContext.arc(origin.x, origin.y, pointSize, 0, Math.PI * 2);
			canvasRenderingContext.fill();
			
			// 기존 투명도 복원.
			canvasRenderingContext.globalAlpha = originalAlpha;
		}
	}

	//==============================================================================
	// 출력 상태 종료.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Graphic } graphic 
	 */
	endCanvasState(graphic) {
		const canvasRenderingContext = graphic.getCanvasRenderingContext();
		if (canvasRenderingContext) {
			canvasRenderingContext.restore();
		}
	}

	// //==============================================================================
	// // 기즈모 출력.
	// //==============================================================================
	// /**
	//  * @virtual
	//  * @param { Graphic } graphic 
	//  */
	// drawGizmo(graphic) {
	// 	if (!this.isVisibleGizmos()) {
	// 		return;
	// 	}
		
	// 	const engine = graphic.getEngine();
	// 	const canvasRenderingContext = graphic.getCanvasRenderingContext();

	// 	const degree = this.getRotation();
	// 	const radian = Math.degreeToRadian(degree);

	// 	// 이미지 회전이 반영된 기준점 출력.
	// 	canvasRenderingContext.fillStyle = "#00ff00";
	// 	const worldCorners = this.getWorldCorners();
	// 	const pivots = [Pivot.topLeft, Pivot.topRight, Pivot.bottomRight, Pivot.bottomLeft];
	// 	for (let i = 0; i < worldCorners.length; ++i) {
	// 		const worldCorner = worldCorners[i];
	// 		canvasRenderingContext.save();
	// 		engine.gameViewIdentity(null);
	// 		canvasRenderingContext.translate(worldCorner.x, worldCorner.y);
	// 		canvasRenderingContext.rotate(radian);
	// 		const contentSize = Vector2.create(4, 4);//.divide(this.getScale());
	// 		const pivotPosition = Vector2.zero().subtract(contentSize.multiply(pivots[i]));
	// 		canvasRenderingContext.fillRect(pivotPosition.x, pivotPosition.y, contentSize.x, contentSize.y);
	// 		canvasRenderingContext.restore();
	// 	}

	// 	// 월드 코너 출력.
	// 	canvasRenderingContext.save();
	// 	engine.gameViewIdentity(null);
	// 	canvasRenderingContext.strokeStyle = "#00ff00";
	// 	canvasRenderingContext.lineWidth = 2;
	// 	canvasRenderingContext.beginPath();
	// 	canvasRenderingContext.moveTo(worldCorners[0].x, worldCorners[0].y);
	// 	for (let i = 1; i < worldCorners.length; ++i) {
	// 		canvasRenderingContext.lineTo(worldCorners[i].x, worldCorners[i].y);
	// 	}
	// 	canvasRenderingContext.closePath();
	// 	canvasRenderingContext.stroke();
	// 	canvasRenderingContext.restore();
	// }

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

		const parentPosition = parent.getPosition();
		const parentRotation = parent.getRotation();
		const parentScale = parent.getScale();

		// 부모 기준 위치 차이
		const dx = position.x - parentPosition.x;
		const dy = position.y - parentPosition.y;

		// 역회전
		const radian = Math.degreeToRadian(-parentRotation);
		const cosRadian = Math.cos(radian);
		const sinRadian = Math.sin(radian);

		const rx = dx * cosRadian - dy * sinRadian;
		const ry = dx * sinRadian + dy * cosRadian;

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
		const localPosition = this.getLocalPosition();
		if (!parent) {
			return localPosition;
		}

		const parentPosition = parent.getPosition();
		const parentRotation = parent.getRotation();
		const parentScale = parent.getScale();

		const radian = Math.degreeToRadian(parentRotation);
		const cosRadian = Math.cos(radian);
		const sinRadian = Math.sin(radian);

		// 스케일 및 회전 적용
		const sx = localPosition.x * parentScale.x;
		const sy = localPosition.y * parentScale.y;
		const rx = sx * cosRadian - sy * sinRadian;
		const ry = sx * sinRadian + sy * cosRadian;
		return Vector2.create(parentPosition.x + rx, parentPosition.y + ry);
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
		}
		else {
			const parentScale = parent.getScale();
			this.setLocalScale(Vector2.create(
				parentScale.x !== 0 ? scale.x / parentScale.x : 0,
				parentScale.y !== 0 ? scale.y / parentScale.y : 0
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
		const parentScale = parent.getScale();
		return Vector2.create(parentScale.x * localScale.x, parentScale.y * localScale.y);
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
		}
		else {
			const parentRotation = parent.getRotation();
			this.setLocalRotation(rotation - parentRotation);
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
		const localRotation = this.getLocalRotation();
		if (!parent) {
			return localRotation;
		}

		const parentRotation = parent.getRotation();
		return parentRotation + localRotation;
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
		const isActive = this.isActive();
		if (isActive) {
			const opacity = this.getOpacity();
			if (opacity > 0) {
				return true;
			}
		}

		return false;
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
		this.#pivot.x = Math.clamp(pivot.x, 0, 1);
		this.#pivot.y = Math.clamp(pivot.y, 0, 1);
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
	// 실제 내용 크기 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } contentSize 
	 */
	setContentSize(contentSize) {
		this.#contentSize = contentSize;
	}

	//==============================================================================
	// 실제 내용 크기 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 
	 */
	getContentSize() {
		return this.#contentSize;
	}

	//==============================================================================
	// 실제 화면에 그려지는 영역 반환. (OBB)
	//==============================================================================
	/**
	 * @returns { Vector2[] }
	 */
	getWorldCorners() {
		const position = this.getPosition();
		const scale = this.getScale();
		const rotation = this.getRotation();
		const contentSize = this.getContentSize();
		const pivot = this.getPivot();

		const width = contentSize.x * Math.abs(scale.x);
		const height = contentSize.y * Math.abs(scale.y);

		const left = -(width * pivot.x);
		const right = width * (1 - pivot.x);
		const top = -(height * pivot.y);
		const bottom = height * (1 - pivot.y);

		const radian = Math.degreeToRadian(rotation);
		const cosR = Math.cos(radian);
		const sinR = Math.sin(radian);

		return [
			Vector2.create(left * cosR - top * sinR + position.x, left * sinR + top * cosR + position.y),
			Vector2.create(right * cosR - top * sinR + position.x, right * sinR + top * cosR + position.y),
			Vector2.create(right * cosR - bottom * sinR + position.x, right * sinR + bottom * cosR + position.y),
			Vector2.create(left * cosR - bottom * sinR + position.x, left * sinR + bottom * cosR + position.y)
		];
	}

	//==============================================================================
	// getWorldCorners()를 기반으로 최소, 최대위치를 만들어 바운딩박스를 형성.
	//==============================================================================
	/**
	 * @returns { Rect }
	 */
	getWorldBounds() {
		const worldCorners = this.getWorldCorners();

		let min = Vector2.positiveInfinity();
		let max = Vector2.negativeInfinity();
		for (let i = 1; i < worldCorners.length; ++i) {
			const worldCorner = worldCorners[i];
			if (min.x > worldCorner.x) {
				min.x = worldCorner.x;
			}
			if (min.y > worldCorner.y) {
				min.y = worldCorner.y;
			}
			if (max.x < worldCorner.x) {
				max.x = worldCorner.x;
			}
			if (max.y < worldCorner.y) {
				max.y = worldCorner.y;
			}
		}

		return Rect.create(min.x, min.y, max.x - min.x, max.y - min.y);
	}

	//==============================================================================
	// getWorldCorners() 를 통한 충돌 검출.
	//==============================================================================
	/**
	 * @param { Vector2 } viewPosition
	 * @returns { boolean }
	 */
	contains(viewPosition) {
		if (viewPosition === null) {
			return false;
		}
		const worldCorners = this.getWorldCorners();
		const obb = new OBB();
		obb.setEdges(worldCorners);
		const inside = obb.contains(viewPosition);
		return inside;
	}

	//==============================================================================
	// 기즈모 그리기 설정.
	//==============================================================================
	/**
	 * @param { boolean } isVisible 
	 */
	setGizmoVisible(isVisible) {
		this.#isGizmoVisible = isVisible;
	}

	//==============================================================================
	// 기즈모 그리기 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isGizmoVisible() {
		return this.#isGizmoVisible;
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