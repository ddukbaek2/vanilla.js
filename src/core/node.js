//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VObject } from "../base/object.js";
import { VVector2 } from "../base/vector2.js";
import { VRenderer } from "./renderer.js";
import * as VMath from "../base/math.js";
import { VComponent } from "./component.js";


//==============================================================================
// 계층 및 영역 객체.
//==============================================================================
export class VNode extends VObject {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { VComponent[] } */ #components; // 컴포넌트 목록.
	/** @private @type { VNode | null } */ #parent; // 부모 노드.
	/** @private @type { VNode[] } */ #children; // 자식 노드 목록.
	/** @private @type { VVector2 } */ #position; // 위치.
	/** @private @type { VVector2 } */ #scale; // 크기.
	/** @private @type { number } */ #rotation; // 회전값. (degree)
	/** @private @type { boolean } */ #isActive; // 활성화 여부.
	/** @private @type { boolean } */ #isVisible; // 렌더링 여부.
	/** @private @type { number } */ #opacity; // 투명도.
	/** @private @type { boolean } */ #isVisibleGizmos; // 기즈모 출력 여부.

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
		this.#position = VVector2.zero();
		this.#scale = VVector2.one();
		this.#rotation = 0.0;
		this.#isActive = true;
		this.#isVisible = true;
		this.#opacity = 1.0;
		this.#isVisibleGizmos = false;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @virtual
	 * @param { number } timeDelta 
	 */
	tick(timeDelta) {
		// 컴포넌트.
		for (const component of this.getAllComponents()) {
			component.tick(timeDelta);
		}

		// 자식.
		for (const child of this.#children) {
			if (child.isActive()) {
				child.tick(timeDelta);
			}
		}
	}

	//==============================================================================
	// 출력 상태 시작.
	//==============================================================================
	/**
	 * @virtual
	 * @param { VRenderer } renderer 
	 */
	pushMatrix(renderer) {
		const canvasContext = renderer.getCanvasContext();
		canvasContext.save();

		const position = this.getPosition();
		const degree = this.getRotation();
		let radian = VMath.degreeToRadian(degree);
		const scale = this.getScale();
		const opacity = this.getOpacity();

		// 트랜스폼 조정.
		canvasContext.translate(position.x, position.y);
		canvasContext.rotate(radian);
		canvasContext.scale(scale.x, scale.y);
		canvasContext.globalAlpha *= opacity;
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @virtual
	 * @param { VRenderer } renderer 
	 */
	draw(renderer) {
		// 중심점 출력.
		// const canvasContext = renderer.getCanvasContext();
		// canvasContext.fillStyle = "#00ff00";
		// canvasContext.fillRect(0, 0, 8, 8);

		// 컴포넌트 출력.
		if (this.isVisible()) {
			for (const component of this.getAllComponents()) {
				component.draw(renderer);
			}
		}
	}

	//==============================================================================
	// 출력 상태 종료.
	//==============================================================================
	/**
	 * @virtual
	 * @param { VRenderer } renderer 
	 */
	popMatrix(renderer) {
		const canvasContext = renderer.getCanvasContext();
		canvasContext.restore();
	}

	// //==============================================================================
	// // 기즈모 출력.
	// //==============================================================================
	// /**
	//  * @virtual
	//  * @param { VRenderer } renderer 
	//  */
	// drawGizmos(renderer) {
	// 	if (!this.isVisibleGizmos()) {
	// 		return;
	// 	}
		
	// 	const engine = renderer.getEngine();
	// 	const canvasContext = renderer.getCanvasContext();

	// 	const degree = this.getRotation();
	// 	const radian = VMath.degreeToRadian(degree);

	// 	// 이미지 회전이 반영된 기준점 출력.
	// 	canvasContext.fillStyle = "#00ff00";
	// 	const worldCorners = this.getWorldCorners();
	// 	const pivots = [VPiVPivotvot2D.topLeft, VPivot.topRight, VPivot.bottomRight, VPivot.bottomLeft];
	// 	for (let i = 0; i < worldCorners.length; ++i) {
	// 		const worldCorner = worldCorners[i];
	// 		canvasContext.save();
	// 		engine.gameViewIdentity(null);
	// 		canvasContext.translate(worldCorner.x, worldCorner.y);
	// 		canvasContext.rotate(radian);
	// 		const contentSize = VVector2.create(4, 4);//.divide(this.getScale());
	// 		const pivotPosition = VVector2.zero().subtract(contentSize.multiply(pivots[i]));
	// 		canvasContext.fillRect(pivotPosition.x, pivotPosition.y, contentSize.x, contentSize.y);
	// 		canvasContext.restore();
	// 	}

	// 	// 월드 코너 출력.
	// 	canvasContext.save();
	// 	engine.gameViewIdentity(null);
	// 	canvasContext.strokeStyle = "#00ff00";
	// 	canvasContext.lineWidth = 2;
	// 	canvasContext.beginPath();
	// 	canvasContext.moveTo(worldCorners[0].x, worldCorners[0].y);
	// 	for (let i = 1; i < worldCorners.length; ++i) {
	// 		canvasContext.lineTo(worldCorners[i].x, worldCorners[i].y);
	// 	}
	// 	canvasContext.closePath();
	// 	canvasContext.stroke();
	// 	canvasContext.restore();
	// }

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
	 * @param { VComponent } component 
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
	 * @returns { VComponent[] }
	 */
	getAllComponents() {
		return this.#components;
	}

	//==============================================================================
	// 타입에 대한 컴포넌트 반환.
	//==============================================================================
	/**
	 * @param { Function } componentType 
	 * @returns { VComponent | null }
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
	 * @returns { VComponent[] }
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
	 * @param { VNode } parent 
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
	 * @param { VNode } child 
	 */
	addChild(child) {
		child.setParent(this);
	}

	//==============================================================================
	// 자식 제거.
	//==============================================================================
	/**
	 * @param { VNode } child 
	 */
	removeChild(child) {
		child.setParent(null);
	}

	//==============================================================================
	// 모든 자식 제거. (직계 자식 목록만 비우기 때문에 자식들이 소유한 계층 구조는 유지됨)
	//==============================================================================
	removeChildren() {
		// for (let i = 0; i < this.#children.length; ++i) {
		// 	const child = this.#children[i];
		// 	this.removeChild(child);
		// 	--i;
		// }
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
	 * @returns { VNode } 
	 */
	getParent() {
		return this.#parent;
	}

	//==============================================================================
	// 자식 목록 반환.
	//==============================================================================
	/**
	 * @returns { VNode[] } 
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
	 * @returns { VNode } 
	 */
	getChild(index) {
		return this.#children[index];
	}

	//==============================================================================
	// 위치 설정.
	//==============================================================================
	/**
	 * @param { VVector2 } position 
	 */
	setPosition(position) {
		this.#position = position;
	}

	//==============================================================================
	// 위치 반환.
	//==============================================================================
	/**
	 * @returns { VVector2 } 
	 */
	getPosition() {
		return this.#position;
	}

	//==============================================================================
	// 크기 설정.
	//==============================================================================
	/**
	 * @param { VVector2 } scale 
	 */
	setScale(scale) {
		this.#scale = scale;
	}

	//==============================================================================
	// 크기 반환.
	//==============================================================================
	/**
	 * @returns { VVector2 } 
	 */
	getScale() {
		return this.#scale;
	}

	//==============================================================================
	// 회전 설정.
	//==============================================================================
	/**
	 * @param { number } rotation 
	 */
	setRotation(rotation) {
		this.#rotation = rotation;
	}

	//==============================================================================
	// 회전 반환.
	//==============================================================================
	/**
	 * @returns { number } 
	 */
	getRotation() {
		return this.#rotation;
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
	// 가시 상태 설정.
	//==============================================================================
	/**
	 * @param { boolean } visible 
	 */
	setVisible(visible) {
		this.#isVisible = visible;
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
		return this.#isVisible;
	}

	//==============================================================================
	// 투명도 설정.
	//==============================================================================
	/**
	 * @param { number } opacity 
	 */
	setOpacity(opacity) {
		this.#opacity = VMath.clamp(opacity, 0, 1);
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
	// 기즈모 그리기 설정.
	//==============================================================================
	/**
	 * @param { boolean }
	 */
	setVisibleGizmos(visible) {
		this.#isVisibleGizmos = visible;
	}

	//==============================================================================
	// 기즈모 그리기 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isVisibleGizmos() {
		return this.#isVisibleGizmos;
	}

	//==============================================================================
	// 새로운 노드 생성.
	//==============================================================================
	/**
	 * @returns { VNode }
	 */
	static create() {
		var obj = new VNode();
		return obj;
	}
}