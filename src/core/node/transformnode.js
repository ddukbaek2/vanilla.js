//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../../base/vector2.js";
import { Graphic } from "../graphic.js";
import * as Math from "../../base/math.js";
import { ComponentNode } from "./componentnode.js";
import { Component } from "../component.js";
import { Rect } from "../../base/rect.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 하위 트리 그리기 경계의 상태.
const DRAW_BOUNDS_DIRTY = 0; // 다시 셈해야 한다.
const DRAW_BOUNDS_KNOWN = 1; // 셈해 둔 경계가 맞다.
const DRAW_BOUNDS_UNKNOWN = 2; // 하위 트리에 어디에 그리는지 모르는 것이 있다. (그리기를 건너뛰지 않는다)
// 자식의 하위 트리 경계를 읽어 두는 칸. (읽은 바로 뒤에 쓰고 버리므로 재귀에도 같이 쓴다)
const childDrawBounds = new Rect();


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
	/** @private @type { boolean } */ #isVisible; // 보이기 플래그. (켜짐, 투명도와 따로, 거짓이면 이 노드와 자손을 그리지 않고 누름도 받지 않는다)
	/** @private @type { boolean } */ #isGizmoVisible; // 기즈모 출력 여부.
	/** @private @type { boolean } */ #isOpacityLayer; // 투명도를 노드와 자손에 묶어 한 번에 얹을지. (CSS opacity)
	/** @private @type { number } */ #lastDrawnMaximumScale; // 지난번 그릴 때 변환의 가장 큰 배율. (0 이면 아직 모른다, Graphic 이 글 굽기 배율에 쓴다)
	/** @private @type { number } */ #lastDrawnFrameNumber; // 지난번 그린 프레임 번호. (-1 이면 그린 적 없다, Graphic 이 글 굽기 배율에 쓴다)
	/** @private @type { number } */ #drawBoundsState; // 하위 트리 그리기 경계의 상태. (DRAW_BOUNDS_DIRTY, KNOWN, UNKNOWN)
	/** @private @type { number } */ #drawBoundsGeneration; // 경계를 셈한 때의 컴포넌트 그리는 사각형 세대. (Component.getDrawnRectGeneration)
	/** @private @type { Rect | null } */ #drawBounds; // 셈해 둔 하위 트리 그리기 경계. (이 노드의 내용 좌표, 처음 읽을 때 만든다)

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
		this.#isOpacityLayer = false;
		this.#localOpacity = 1.0;
		this.#isVisible = true;
		this.#lastDrawnMaximumScale = 0;
		this.#lastDrawnFrameNumber = -1;
		this.#drawBoundsState = DRAW_BOUNDS_DIRTY;
		this.#drawBoundsGeneration = -1;
		this.#drawBounds = null;
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
		const isDrawn = this.isActive() && this.isVisible() && this.getLocalOpacity() > 0;
		if (isDrawn) {
			// 컴포넌트 목록 출력.
			const components = this.getAllComponents();
			for (const component of components) {
				if (!component.isEnable()) {
					continue;
				}
				graphic.drawComponent(component);
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
		this.markParentDrawBoundsDirty();
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
		this.markParentDrawBoundsDirty();
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
		this.markParentDrawBoundsDirty();
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
		this.markParentDrawBoundsDirty();
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
		this.markParentDrawBoundsDirty();
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
	// 보이기 설정. (켜짐, 투명도와 따로 두는 플래그, 러스트 판 WorldNode::set_visible 과 같다)
	// - 거짓이면 이 노드와 자손을 그리지 않고 TouchRaycaster 의 누름도 받지 않는다. 갱신(tick)은 그대로 돈다.
	//==============================================================================
	/**
	 * @param { boolean } isVisible 거짓이면 숨긴다. (기본 참)
	 * @example <caption>부모를 숨기면 자식도 계층에서 안 보인다</caption>
	 * import { WorldNode } from "./build/vanilla.js";
	 *
	 * const parentNode = new WorldNode();
	 * const childNode = new WorldNode();
	 * parentNode.addChild(childNode);
	 * parentNode.setVisible(false);
	 * console.log(parentNode.isVisible(), parentNode.isActive(), childNode.isVisible(), childNode.isVisibleInHierarchy());
	 */
	setVisible(isVisible) {
		this.#isVisible = isVisible;
		this.markParentDrawBoundsDirty();
	}

	//==============================================================================
	// 보이기 플래그 반환. (setVisible 로 정한 값, 켜짐과 투명도는 보지 않는다, 계층 판정은 isVisibleInHierarchy)
	//==============================================================================
	/**
	 * @returns { boolean } 보이기 플래그. (기본 참)
	 */
	isVisible() {
		return this.#isVisible;
	}

	//==============================================================================
	// 현재부터 루트까지 계층 전체의 가시 상태 반환. (자신과 조상 모두 켜져 있고, 보이기 플래그가 참이고, 로컬 투명도가 0 보다 커야 참)
	//==============================================================================
	/**
	 * @returns { boolean } 자신과 모든 부모가 보이면 참.
	 * @example <caption>꺼짐, 투명도 0, 숨김 가운데 하나라도 조상에 있으면 거짓</caption>
	 * import { WorldNode } from "./build/vanilla.js";
	 *
	 * const parentNode = new WorldNode();
	 * const childNode = new WorldNode();
	 * parentNode.addChild(childNode);
	 * parentNode.setLocalOpacity(0);
	 * console.log(childNode.isActiveInHierarchy(), childNode.isVisibleInHierarchy());
	 * parentNode.setLocalOpacity(1);
	 * childNode.setVisible(false);
	 * console.log(parentNode.isVisibleInHierarchy(), childNode.isVisibleInHierarchy());
	 */
	isVisibleInHierarchy() {
		let current = this;
		while (current !== null && current !== undefined) {
			const isCurrentActive = typeof current.isActive === "function" ? current.isActive() : true;
			const isCurrentVisible = typeof current.isVisible === "function" ? current.isVisible() : true;
			const currentOpacity = typeof current.getLocalOpacity === "function" ? current.getLocalOpacity() : 1;
			if (!isCurrentActive || !isCurrentVisible || !(currentOpacity > 0)) {
				return false;
			}
			current = current.getParent();
		}
		return true;
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
	// 지난번 그릴 때 변환의 가장 큰 배율과 그 프레임 번호 설정. (Graphic.drawNode 가 부른다)
	//==============================================================================
	/**
	 * @param { number } maximumScale 변환의 가장 큰 배율.
	 * @param { number } frameNumber 그린 프레임 번호. (Graphic 이 프레임마다 하나씩 올리는 번호, 기본 0)
	 */
	setLastDrawnMaximumScale(maximumScale, frameNumber = 0) {
		this.#lastDrawnMaximumScale = maximumScale;
		this.#lastDrawnFrameNumber = frameNumber;
	}

	//==============================================================================
	// 지난번 그린 프레임 번호 반환. (setLastDrawnMaximumScale 로 적은 번호, -1 이면 그린 적 없다)
	//==============================================================================
	/**
	 * @returns { number } 지난번 그린 프레임 번호.
	 */
	getLastDrawnFrameNumber() {
		return this.#lastDrawnFrameNumber;
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
		this.markDrawBoundsDirty();
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

	//==============================================================================
	// 투명도 층 설정. (CSS opacity 처럼 투명도를 노드와 자손에 묶어 한 번에 얹을지)
	// - 켜고 투명도(부모의 것을 곱한 값)가 1 보다 작으면 이 노드와 자손을 층에 모아 그렸다가 그 투명도로 한 번에 얹는다. (Graphic.beginOpacityLayer)
	//   겹친 자식끼리 비치지 않는다. 끄면(처음) 노드마다 투명도를 곱해 따로 얹는다.
	//==============================================================================
	/**
	 * @param { boolean } isOpacityLayer 투명도를 묶어 얹을지.
	 * @example <caption>반투명한 묶음 노드 (겹친 자식이 서로 비치지 않는다)</caption>
	 * import { WorldNode } from "./build/vanilla.js";
	 *
	 * const groupNode = new WorldNode();
	 * groupNode.setLocalOpacity(0.5);
	 * groupNode.setOpacityLayer(true);
	 * console.log(groupNode.isOpacityLayer());
	 */
	setOpacityLayer(isOpacityLayer) {
		this.#isOpacityLayer = isOpacityLayer;
	}

	//==============================================================================
	// 투명도 층 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 투명도를 노드와 자손에 묶어 얹으면 참.
	 */
	isOpacityLayer() {
		return this.#isOpacityLayer;
	}

	//==============================================================================
	// 부모 설정. (오버라이드: 옛 부모와 새 부모의 하위 트리 그리기 경계가 바뀐다)
	//==============================================================================
	/**
	 * @override
	 * @param { Node | null } parent 새 부모. (null 이면 떼어 낸다)
	 * @returns { boolean } 붙였거나 떼었으면 참. (자기 자손을 부모로 주면 거짓)
	 */
	setParent(parent) {
		const previousParent = this.getParent();
		const isAttached = super.setParent(parent);
		if (isAttached && previousParent !== parent) {
			if (previousParent !== null && previousParent !== undefined) {
				previousParent.markDrawBoundsDirty();
			}
			this.markParentDrawBoundsDirty();
		}
		return isAttached;
	}

	//==============================================================================
	// 켜짐 설정. (오버라이드: 꺼진 자식은 부모의 하위 트리 그리기 경계에 들지 않는다)
	//==============================================================================
	/**
	 * @override
	 * @param { boolean } active 켤지.
	 */
	setActive(active) {
		const isChanged = this.isActive() !== active;
		super.setActive(active);
		if (isChanged) {
			this.markParentDrawBoundsDirty();
		}
	}

	//==============================================================================
	// 하위 트리 그리기 경계가 바뀌었음을 표시. (이 노드와 조상이 다음에 그릴 때 경계를 다시 셈한다)
	// - 변환, 내용 크기, 자식 더함과 뺌, 켜짐과 보임, 컴포넌트가 바뀌면 엔진이 부른다. 조상으로 번지다 이미 표시된 노드에서 멈춘다.
	// - draw 를 덮어쓴 노드는 calculateDrawnRect 가 알리는 사각형이 바뀔 때 부른다.
	//==============================================================================
	/**
	 * @override
	 * @example <caption>스스로 그리는 노드가 그리는 곳이 바뀌었음을 알리기</caption>
	 * import { WorldNode, Rect, Colors } from "./build/vanilla.js";
	 *
	 * class Ripple extends WorldNode {
	 * 	radius = 10;
	 * 	setRadius(radius) {
	 * 		this.radius = radius;
	 * 		this.markDrawBoundsDirty();
	 * 	}
	 * 	draw(graphic) {
	 * 		super.draw(graphic);
	 * 		graphic.setFillColor(Colors.white);
	 * 		graphic.drawRect(Rect.create(-this.radius, -this.radius, this.radius * 2, this.radius * 2));
	 * 	}
	 * 	calculateDrawnRect(rect) {
	 * 		rect.position.set(-this.radius, -this.radius);
	 * 		rect.size.set(this.radius * 2, this.radius * 2);
	 * 		return true;
	 * 	}
	 * }
	 *
	 * const ripple = new Ripple();
	 * ripple.setRadius(40);
	 * const drawBounds = Rect.zero();
	 * console.log(ripple.readSubtreeDrawBounds(drawBounds), drawBounds.size.x);
	 */
	markDrawBoundsDirty() {
		let node = this;
		while (node !== null && node !== undefined && #drawBoundsState in node) {
			if (node.#drawBoundsState === DRAW_BOUNDS_DIRTY) {
				break;
			}
			node.#drawBoundsState = DRAW_BOUNDS_DIRTY;
			node = node.getParent();
		}
	}

	//==============================================================================
	// 부모의 하위 트리 그리기 경계가 바뀌었음을 표시. (이 노드의 변환, 켜짐, 보임이 바뀌면 이 노드의 경계는 그대로이고 부모의 경계가 바뀐다)
	//==============================================================================
	markParentDrawBoundsDirty() {
		const parent = this.getParent();
		if (parent !== null && parent !== undefined && typeof parent.markDrawBoundsDirty === "function") {
			parent.markDrawBoundsDirty();
		}
	}

	//==============================================================================
	// 하위 트리 그리기 경계 읽기. (이 노드의 내용 좌표, pushTransform 을 건 뒤의 좌표, 알면 true)
	// - 이 노드와 켜지고 보이는 자손이 그리는 곳을 모두 품는 사각형이다. 크기가 0 이면 아무것도 그리지 않는다.
	// - 바뀐 때만 다시 셈하고(calculateSubtreeDrawBounds) 그 밖에는 셈해 둔 것을 준다. 그리기 순회가 이 사각형이 화면과 자르기 밖이면 하위 트리를 통째로 건너뛴다.
	// - 어디에 그리는지 모르는 것(경계를 알리지 않는 컴포넌트, draw 를 덮어쓰고 calculateDrawnRect 를 알리지 않는 노드)이 들면 false.
	//==============================================================================
	/**
	 * @param { Rect } rect 경계를 적을 곳.
	 * @returns { boolean } 경계를 알면 참. (모르면 rect 를 건드리지 않는다)
	 * @example <caption>줄 노드의 하위 트리 경계 읽기</caption>
	 * import { WorldNode, Paint, Rect, Vector2, Pivot } from "./build/vanilla.js";
	 *
	 * const rowNode = new WorldNode();
	 * rowNode.setPivot(Pivot.topLeft);
	 * rowNode.setContentSize(Vector2.create(300, 40));
	 * rowNode.addComponent(Paint);
	 * const iconNode = new WorldNode();
	 * iconNode.setPivot(Pivot.topLeft);
	 * iconNode.setRect(-20, 4, 32, 32);
	 * iconNode.addComponent(Paint);
	 * rowNode.addChild(iconNode);
	 * const drawBounds = Rect.zero();
	 * const isKnown = rowNode.readSubtreeDrawBounds(drawBounds);
	 * console.log(isKnown, drawBounds.position.x, drawBounds.size.x);
	 */
	readSubtreeDrawBounds(rect) {
		let drawBounds = this.#drawBounds;
		if (drawBounds === null) {
			drawBounds = new Rect();
			this.#drawBounds = drawBounds;
		}
		const drawnRectGeneration = Component.getDrawnRectGeneration();
		if (this.#drawBoundsState === DRAW_BOUNDS_DIRTY || this.#drawBoundsGeneration !== drawnRectGeneration) {
			const isKnown = this.calculateSubtreeDrawBounds(drawBounds) === true;
			const leftX = drawBounds.position.x;
			const topY = drawBounds.position.y;
			const width = drawBounds.size.x;
			const height = drawBounds.size.y;
			const isFinite = System.Number.isFinite(leftX) && System.Number.isFinite(topY) && System.Number.isFinite(width) && System.Number.isFinite(height);
			this.#drawBoundsState = (isKnown && isFinite) ? DRAW_BOUNDS_KNOWN : DRAW_BOUNDS_UNKNOWN;
			this.#drawBoundsGeneration = drawnRectGeneration;
		}
		if (this.#drawBoundsState !== DRAW_BOUNDS_KNOWN) {
			return false;
		}
		rect.position.set(drawBounds.position.x, drawBounds.position.y);
		rect.size.set(drawBounds.size.x, drawBounds.size.y);
		return true;
	}

	//==============================================================================
	// 하위 트리 그리기 경계 셈하기. (readSubtreeDrawBounds 가 바뀐 때만 부른다, 알면 true)
	// - TransformNode 는 내용 영역이 없어 컴포넌트가 어디에 그리는지 모르므로 false. (WorldNode 가 덮어쓴다)
	// - 모르더라도 켜지고 보이는 자식의 경계는 모두 읽는다. (자식이 셈해 두어야 자손이 바뀐 것이 이 노드까지 번진다)
	//==============================================================================
	/**
	 * @virtual
	 * @param { Rect } rect 셈한 경계를 적을 곳. (이 노드의 내용 좌표)
	 * @returns { boolean } 경계를 알면 참.
	 */
	calculateSubtreeDrawBounds(rect) {
		const children = this.getChildren();
		for (const child of children) {
			if (child instanceof TransformNode && child.isActive() && child.isVisible()) {
				child.readSubtreeDrawBounds(childDrawBounds);
			}
		}
		return false;
	}
}