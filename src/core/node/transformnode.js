//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../../base/vector2.js";
import { Graphic } from "../graphic.js";
import * as Math from "../../base/math.js";
import { ComponentNode } from "./componentnode.js";


//==============================================================================
// 계층적 TRS 객체.
// - Transform 기능.
// - 렌더링 기능. (컴포넌트 포함)
//==============================================================================
export class TransformNode extends ComponentNode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Vector2 } */ #localPosition; // 로컬 위치.
	/** @private @type { Vector2 } */ #localScale; // 로컬 크기.
	/** @private @type { number } */ #localRotation; // 로컬 회전값. (degree)
	/** @private @type { number } */ #localOpacity; // 투명도.
	/** @private @type { boolean } */ #isGizmoVisible; // 기즈모 출력 여부.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.nodeType = "TransformNode";
		this.#localPosition = Vector2.zero();
		this.#localScale = Vector2.one();
		this.#localRotation = 0.0;
		this.#isGizmoVisible = false;
		this.#localOpacity = 1.0;
	}

	//==============================================================================
	// 출력 상태 시작.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Graphic } graphic
	 */
	pushTransform(graphic) {
		if (graphic) {
			graphic.pushState();

			// 트랜스폼 반영.
			const localPosition = this.getLocalPosition();
			const localRotation = this.getLocalRotation();
			const radian = Math.degreeToRadian(localRotation);
			const localScale = this.getLocalScale();
			graphic.translate(localPosition.x, localPosition.y);
			graphic.rotate(radian);
			graphic.scale(localScale.x, localScale.y);

			// 투명도 반영.
			const localOpacity = this.getLocalOpacity();
			graphic.multiplyGlobalAlpha(localOpacity);
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
				if (!component.isEnable()) {
					continue;
				}
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
	 * @virtual
	 * @param { Graphic } graphic 
	 */
	drawGizmos(graphic) {
		// const isGizmoVisible = this.isGizmoVisible();
		// if (!isGizmoVisible) {
		// 	return;
		// }

		// 영역 및 기준점 출력.
		if (graphic) {

			// 기존 투명도 무효화 및 색상 설정.
			const originalAlpha = graphic.getGlobalAlpha();
			graphic.setGlobalAlpha(1.0);

			// 컴포넌트 기즈모 출력.
			const components = this.getAllComponents();
			for (const component of components) {
				const isGizmoVisible = component.isGizmoVisible();
				if (isGizmoVisible) {
					component.drawGizmos(graphic);
				}
			}

			// 기존 투명도 복원.
			graphic.setGlobalAlpha(originalAlpha);
		}
	}

	//==============================================================================
	// 출력 상태 종료.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Graphic } graphic 
	 */
	popTransform(graphic) {
		if (graphic) {
			graphic.popState();
		}
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
		this.#localPosition = position.clone();
	}

	//==============================================================================
	// 로컬 위치 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 
	 */
	getLocalPosition() {
		return this.#localPosition.clone();
	}

	//==============================================================================
	// 로컬 크기 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } scale 
	 */
	setLocalScale(scale) {
		this.#localScale = scale.clone();
	}

	//==============================================================================
	// 로컬 크기 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 
	 */
	getLocalScale() {
		return this.#localScale.clone();
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
	// 가시 상태 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 
	 */
	isVisible() {
		const isActive = this.isActive();
		if (isActive) {
			const opacity = this.getLocalOpacity();
			if (opacity > 0) {
				return true;
			}
		}

		return false;
	}

	//==============================================================================
	// 현재부터 루트까지 계층 전체의 가시 상태 반환. (루트까지 하나라도 비활성화상태면 false 반환)
	//==============================================================================
	/**
	 * @returns { boolean } 
	 */
	isVisibleInHierarchy() {
		const isVisible = this.isVisible();
		if (isVisible) {
			let current = this;
			while (current !== null && current !== undefined) {
				const isCurrentVisible = current.isVisible();
				if (isCurrentVisible) {
					current = current.getParent();
				}
				else {
					return false;
				}
			}
			return true;
		}
		else {
			return false;
		}
	}

	//==============================================================================
	// 글로벌 투명도 반환.
	//==============================================================================
	/**
	 * @returns { number } 
	 */
	getOpacity() {
		let globalOpacity = this.getLocalOpacity();
		let current = this;
		while (current !== null && current !== undefined) {
			current = current.getParent();
			if (current === null || current === undefined) {
				continue;
			}

			opcacity *= current.getLocalOpacity();
		}

		globalOpacity = Math.clamp(globalOpacity, 0, 1);
		return globalOpacity;
	}

	//==============================================================================
	// 로컬 투명도 설정.
	//==============================================================================
	/**
	 * @param { number } opacity 
	 */
	setLocalOpacity(opacity) {
		this.#localOpacity = Math.clamp(opacity, 0, 1);
	}

	//==============================================================================
	// 로컬 투명도 반환.
	//==============================================================================
	/**
	 * @returns { number } 
	 */
	getLocalOpacity() {
		return this.#localOpacity;
	}

	//==============================================================================
	// 기즈모 그리기 여부 설정.
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
}