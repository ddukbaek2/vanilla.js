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
/**
 * @example <caption>부모를 거친 자리, 회전, 크기 읽기</caption>
 * import { TransformNode, Vector2 } from "./build/vanilla.js";
 *
 * const parent = new TransformNode();
 * parent.setLocalPosition(Vector2.create(100, 50));
 * parent.setLocalRotation(90);
 * parent.setLocalScale(Vector2.create(2, 2));
 * const child = new TransformNode();
 * child.setLocalPositionXY(10, 0);
 * child.setLocalOpacity(0.5);
 * parent.addChild(child);
 * const position = child.getPosition();
 * const rotation = child.getRotation();
 * const scale = child.getScale();
 * const opacity = child.getOpacity();
 * console.log(position.x, position.y, rotation, scale.x, opacity);
 */
export class TransformNode extends ComponentNode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Vector2 } */ #localPosition; // 로컬 위치.
	/** @private @type { Vector2 } */ #localScale; // 로컬 크기.
	/** @private @type { number } */ #localRotation; // 로컬 회전값. (degree)
	/** @private @type { number } */ #localOpacity; // 투명도.
	/** @private @type { boolean } */ #isGizmoVisible; // 기즈모 출력 여부.
	/** @private @type { number } */ #lastDrawnMaximumScale; // 지난번 그릴 때 변환의 가장 큰 배율. (0 이면 아직 모른다, Graphic 이 글 굽기 배율에 쓴다)

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
		this.#lastDrawnMaximumScale = 0;
	}

	//==============================================================================
	// 출력 상태 시작.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Graphic } graphic 변환을 걸 그래픽.
	 */
	pushTransform(graphic) {
		if (graphic) {
			graphic.pushState();

			// 트랜스폼 반영.
			this.applyLocalTransform(graphic);

			// 투명도 반영.
			const localOpacity = this.getLocalOpacity();
			graphic.multiplyGlobalAlpha(localOpacity);
		}
	}

	//==============================================================================
	// 로컬 위치, 회전, 크기를 graphic 의 변환에 건다.
	// - 위치와 크기를 복제하지 않고 읽는다. getLocalPosition() / getLocalScale() 을 덮어쓴 하위 클래스면 그 함수로 읽는다.
	//==============================================================================
	/**
	 * @param { Graphic } graphic 변환을 걸 그래픽.
	 */
	applyLocalTransform(graphic) {
		const localRotation = this.getLocalRotation();
		const radian = Math.degreeToRadian(localRotation);
		const isLocalPositionOverridden = this.getLocalPosition !== TransformNode.prototype.getLocalPosition;
		const isLocalScaleOverridden = this.getLocalScale !== TransformNode.prototype.getLocalScale;
		if (isLocalPositionOverridden || isLocalScaleOverridden) {
			const localPosition = this.getLocalPosition();
			const localScale = this.getLocalScale();
			graphic.translate(localPosition.x, localPosition.y);
			graphic.rotate(radian);
			graphic.scale(localScale.x, localScale.y);
			return;
		}

		graphic.translate(this.#localPosition.x, this.#localPosition.y);
		graphic.rotate(radian);
		graphic.scale(this.#localScale.x, this.#localScale.y);
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Graphic } graphic 그릴 그래픽.
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
	 * @param { Graphic } graphic 그릴 그래픽.
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
	 * @param { Graphic } graphic 상태를 되돌릴 그래픽.
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
	 * @param { Vector2 } position 부모들을 거친 월드 자리. (부모의 위치, 회전, 크기를 거꾸로 걸어 로컬 위치로 바꾼다)
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
	 * @returns { Vector2 } 부모들을 거친 월드 자리. (부모가 없으면 로컬 위치)
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
	 * @param { Vector2 } scale 부모들을 거친 크기 배율. (부모 배율로 나눠 로컬 크기로 바꾸고, 부모 배율이 0 인 축은 0)
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
	 * @returns { Vector2 } 부모들을 거친 크기 배율.
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
	 * @param { number } rotation 부모들을 거친 회전. (도)
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
	 * @returns { number } 부모들을 거친 회전. (도)
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
	 * @param { Vector2 } position 부모 기준 자리. (값을 옮겨 적고 받은 벡터는 들고 있지 않는다)
	 */
	setLocalPosition(position) {
		// 복제본을 새로 만들지 않고 가진 벡터에 값을 옮겨 적는다. (가진 벡터는 밖으로 내주지 않는다, getLocalPosition() 은 복제해 준다)
		this.#localPosition.x = position.x;
		this.#localPosition.y = position.y;
	}

	//==============================================================================
	// 로컬 위치 설정. (x, y 를 바로 받는다, Vector2 를 만들지 않는다)
	// - getLocalPosition() / setLocalPosition() 을 덮어쓴 하위 클래스면 setLocalPosition 으로 넘긴다.
	//==============================================================================
	/**
	 * @param { number } x 부모 기준 X.
	 * @param { number } y 부모 기준 Y.
	 */
	setLocalPositionXY(x, y) {
		const isLocalPositionOverridden = this.setLocalPosition !== TransformNode.prototype.setLocalPosition;
		if (isLocalPositionOverridden) {
			this.setLocalPosition(Vector2.create(x, y));
			return;
		}
		this.#localPosition.x = x;
		this.#localPosition.y = y;
	}

	//==============================================================================
	// 로컬 위치 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 로컬 위치의 사본.
	 */
	getLocalPosition() {
		return this.#localPosition.clone();
	}

	//==============================================================================
	// 로컬 크기 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } scale 로컬 크기 배율. (값을 옮겨 적는다)
	 */
	setLocalScale(scale) {
		// 복제본을 새로 만들지 않고 가진 벡터에 값을 옮겨 적는다. (getLocalScale() 은 복제해 준다)
		this.#localScale.x = scale.x;
		this.#localScale.y = scale.y;
	}

	//==============================================================================
	// 로컬 크기 설정. (x, y 를 바로 받는다, Vector2 를 만들지 않는다)
	// - setLocalScale() 을 덮어쓴 하위 클래스면 setLocalScale 로 넘긴다.
	//==============================================================================
	/**
	 * @param { number } x 로컬 가로 배율.
	 * @param { number } y 로컬 세로 배율.
	 */
	setLocalScaleXY(x, y) {
		const isLocalScaleOverridden = this.setLocalScale !== TransformNode.prototype.setLocalScale;
		if (isLocalScaleOverridden) {
			this.setLocalScale(Vector2.create(x, y));
			return;
		}
		this.#localScale.x = x;
		this.#localScale.y = y;
	}

	//==============================================================================
	// 로컬 크기 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 로컬 크기의 사본.
	 */
	getLocalScale() {
		return this.#localScale.clone();
	}

	//==============================================================================
	// 로컬 회전 설정.
	//==============================================================================
	/**
	 * @param { number } rotation 로컬 회전. (도)
	 */
	setLocalRotation(rotation) {
		this.#localRotation = rotation;
	}

	//==============================================================================
	// 로컬 회전 반환.
	//==============================================================================
	/**
	 * @returns { number } 로컬 회전. (도)
	 */
	getLocalRotation() {
		return this.#localRotation;
	}

	//==============================================================================
	// 가시 상태 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 켜져 있고 로컬 투명도가 0 보다 크면 참.
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
	 * @returns { boolean } 자신과 모든 부모가 보이면 참.
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
	 * @returns { number } 부모들의 투명도를 곱한 투명도. (0 ~ 1)
	 */
	getOpacity() {
		let globalOpacity = this.getLocalOpacity();
		let current = this;
		while (current !== null && current !== undefined) {
			current = current.getParent();
			if (current === null || current === undefined) {
				continue;
			}

			globalOpacity *= current.getLocalOpacity();
		}

		globalOpacity = Math.clamp(globalOpacity, 0, 1);
		return globalOpacity;
	}

	//==============================================================================
	// 로컬 투명도 설정.
	//==============================================================================
	/**
	 * @param { number } opacity 로컬 투명도. (0 ~ 1 로 자른다)
	 */
	setLocalOpacity(opacity) {
		this.#localOpacity = Math.clamp(opacity, 0, 1);
	}

	//==============================================================================
	// 로컬 투명도 반환.
	//==============================================================================
	/**
	 * @returns { number } 로컬 투명도. (0 ~ 1)
	 */
	getLocalOpacity() {
		return this.#localOpacity;
	}

	//==============================================================================
	// 지난번 그릴 때 변환의 가장 큰 배율 설정. (Graphic.drawNode 가 부른다)
	//==============================================================================
	/**
	 * @param { number } maximumScale 변환의 가장 큰 배율.
	 */
	setLastDrawnMaximumScale(maximumScale) {
		this.#lastDrawnMaximumScale = maximumScale;
	}

	//==============================================================================
	// 지난번 그릴 때 변환의 가장 큰 배율 반환. (0 이면 아직 모른다)
	//==============================================================================
	/**
	 * @returns { number } 변환의 가장 큰 배율. (0 이면 아직 모른다)
	 */
	getLastDrawnMaximumScale() {
		return this.#lastDrawnMaximumScale;
	}

	//==============================================================================
	// 기즈모 그리기 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } isVisible 참이면 기즈모를 그린다.
	 */
	setGizmoVisible(isVisible) {
		this.#isGizmoVisible = isVisible;
	}

	//==============================================================================
	// 기즈모 그리기 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 기즈모를 그리면 참.
	 */
	isGizmoVisible() {
		return this.#isGizmoVisible;
	}
}