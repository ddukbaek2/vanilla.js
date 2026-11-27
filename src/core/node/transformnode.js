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
const PARENT_SCALE = Vector2.create(0, 1); // readPosition 이 부모 크기를 읽는 칸. (값은 바로 지역 변수로 옮긴다, 다시 쓴다)
const DRAW_BOUNDS_DIRTY = 0; // 다시 셈해야 한다.
const DRAW_BOUNDS_KNOWN = 1; // 셈해 둔 경계가 맞다.
const DRAW_BOUNDS_UNKNOWN = 2; // 하위 트리에 어디에 그리는지 모르는 것이 있다. (그리기를 건너뛰지 않는다)
// 자식의 하위 트리 경계를 읽어 두는 칸. (읽은 바로 뒤에 쓰고 버리므로 재귀에도 같이 쓴다)
// 하위 트리 그리기 경계를 셀 때 고쳐 쓰는 칸. (읽은 바로 뒤에 쓰고 버리므로 재귀에도 같이 쓴다)
const childDrawBounds = new Rect();
const subtreeNodeRect = new Rect();
const subtreeComponentRect = new Rect();
const subtreeContentSize = Vector2.zero();
// 하위 트리 경계를 셈한 차례 번호. (셀 때마다 하나씩 늘려 그 노드에 적는다, 자식이 부모 좌표로 옮긴 경계를 언제 적었는지 견준다)
let drawBoundsStampCounter = 0;
// 자식 범위 칸의 한 자식 몫. (부모 좌표 경계를 앞에서부터 모은 가장 큰 아래와 오른쪽, 뒤에서부터 모은 가장 작은 위와 왼쪽, 앞 자식 가운데 건너뛰면 세는 수)
const CHILD_RANGE_STRIDE = 5;
const CHILD_RANGE_PREFIX_MAXIMUM_BOTTOM = 0;
const CHILD_RANGE_PREFIX_MAXIMUM_RIGHT = 1;
const CHILD_RANGE_SUFFIX_MINIMUM_TOP = 2;
const CHILD_RANGE_SUFFIX_MINIMUM_LEFT = 3;
const CHILD_RANGE_PREFIX_COUNT = 4;
// 보이는 자식 범위를 찾을 때 고쳐 쓰는 칸. (찾은 바로 뒤에 읽고 버린다)
const visibleChildRect = new Rect();
let visibleChildFirstIndex = 0;
let visibleChildLastIndex = 0;


//==============================================================================
// 노드의 글로벌 위치를 벡터에 쓰기. (TransformNode 면 readPosition, 아니면 getPosition 의 값을 옮긴다)
//==============================================================================
/**
 * @param { object } node 노드.
 * @param { Vector2 } out 쓸 벡터.
 */
function readNodePosition(node, out) {
	if (typeof node.readPosition === "function") {
		node.readPosition(out);
		return;
	}
	const position = node.getPosition();
	out.x = position.x;
	out.y = position.y;
}

//==============================================================================
// 노드의 글로벌 크기를 벡터에 쓰기. (TransformNode 면 readScale, 아니면 getScale 의 값을 옮긴다)
//==============================================================================
/**
 * @param { object } node 노드.
 * @param { Vector2 } out 쓸 벡터.
 */
function readNodeScale(node, out) {
	if (typeof node.readScale === "function") {
		node.readScale(out);
		return;
	}
	const scale = node.getScale();
	out.x = scale.x;
	out.y = scale.y;
}


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
	/** @private @type { number } */ #drawBoundsStamp; // 이 노드의 경계를 마지막으로 셈한 차례 번호. (0 이면 셈한 적 없다)
	/** @private @type { number } */ #parentDrawBoundsStamp; // 부모가 이 노드의 경계를 부모 좌표로 옮겨 적은 때 부모의 차례 번호. (-1 이면 적은 적 없다)
	/** @private @type { Rect | null } */ #parentDrawBounds; // 부모가 셈하며 적어 둔 이 노드의 하위 트리 경계. (부모의 내용 좌표, 처음 적을 때 만든다)
	/** @private @type { boolean } */ #isParentDrawBoundsEmpty; // 적어 둔 경계가 아무것도 그리지 않는지. (옮기기 전 크기가 0)
	/** @private @type { Float64Array | null } */ #childRangeList; // 자식 범위 칸. (자식마다 CHILD_RANGE_STRIDE 칸 + 끝에 건너뛰면 세는 수 합, 자식이 있는 노드가 처음 셀 때 만든다)
	/** @private @type { number } */ #childRangeStamp; // 자식 범위 칸을 적은 때의 차례 번호. (#drawBoundsStamp 와 같아야 맞다)
	/** @private @type { number } */ #childRangeCount; // 자식 범위 칸을 적은 때의 자식 수.

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
		this.#drawBoundsStamp = 0;
		this.#parentDrawBoundsStamp = -1;
		this.#parentDrawBounds = null;
		this.#isParentDrawBoundsEmpty = false;
		this.#childRangeList = null;
		this.#childRangeStamp = -1;
		this.#childRangeCount = 0;
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
			this.drawChildren(graphic);
		}
	}

	//==============================================================================
	// 자식 목록 출력. (자식 차례대로 Graphic.drawNode, draw 가 부른다)
	// - 하위 트리 거르기가 켜졌으면 부모 좌표의 보이는 사각형(Graphic.readLocalVisibleBounds)으로 보이는 자식 범위를 이분 찾기로 좁혀 그 앞뒤 자식은 부르지 않는다.
	//   범위는 하위 트리 경계를 셀 때 적어 둔 자식 경계(앞에서부터 모은 가장 큰 아래와 오른쪽, 뒤에서부터 모은 가장 작은 위와 왼쪽)로 찾으므로 자식이 어떤 차례로 놓여도 맞고,
	//   줄처럼 차례대로 놓이면 보이는 줄만 남는다. 경계를 모르는 자식이 있으면 그 자식을 넘어 좁히지 않는다. 그리기 차례는 그대로다.
	// - 그리는 동안 이 노드의 경계가 바뀌면(자식이 형제를 옮김 같은) 남은 자식을 모두 부른다.
	// - 이 노드가 보이는 사각형 안에 다 든 하위 트리를 그리는 중이면(Graphic.isInsideVisibleBounds) 좁히지 않고 모두 부른다. (자식도 모두 보이는 사각형 안이다)
	//==============================================================================
	/**
	 * @param { Graphic } graphic 그릴 그래픽.
	 * @example <caption>draw 를 덮어쓴 노드가 자식을 그리기</caption>
	 * import { Engine, EngineConfiguration, Scene, WorldNode, Paint, Colors, Rect, Vector2, Pivot } from "./build/vanilla.js";
	 *
	 * class FrameNode extends WorldNode {
	 * 	draw(graphic) {
	 * 		graphic.setFillColor(Colors.white);
	 * 		graphic.drawRect(Rect.create(0, 0, 20, 20));
	 * 		this.drawChildren(graphic);
	 * 	}
	 * 	calculateDrawnRect(rect) {
	 * 		rect.position.set(0, 0);
	 * 		rect.size.set(20, 20);
	 * 		return true;
	 * 	}
	 * }
	 *
	 * class MainScene extends Scene {
	 * 	initialize(engine) {
	 * 		super.initialize(engine);
	 * 		const frameNode = new FrameNode();
	 * 		frameNode.setPivot(Pivot.topLeft);
	 * 		this.getRoot().addChild(frameNode);
	 * 		const childNode = new WorldNode();
	 * 		childNode.setPivot(Pivot.topLeft);
	 * 		childNode.setRect(30, 0, 20, 20);
	 * 		childNode.addComponent(Paint);
	 * 		frameNode.addChild(childNode);
	 * 	}
	 * 	draw(graphic) {
	 * 		super.draw(graphic);
	 * 		console.log(graphic.getLastFrameCulledSubtreeCount());
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	drawChildren(graphic) {
		const children = this.getChildren();
		let firstIndex = 0;
		let lastIndex = System.Number.MAX_SAFE_INTEGER;
		if (this.#findVisibleChildRange(graphic, children.length)) {
			firstIndex = visibleChildFirstIndex;
			lastIndex = visibleChildLastIndex;
		}
		for (let childIndex = firstIndex; childIndex <= lastIndex && childIndex < children.length; ++childIndex) {
			graphic.drawNode(children[childIndex]);
			// 그리다 이 노드의 경계가 바뀌면 찾아 둔 범위가 맞지 않을 수 있어 남은 자식을 모두 본다.
			if (this.#drawBoundsState === DRAW_BOUNDS_DIRTY) {
				lastIndex = System.Number.MAX_SAFE_INTEGER;
			}
		}
	}

	//==============================================================================
	// 보이는 자식 범위 찾기. (찾으면 visibleChildFirstIndex, visibleChildLastIndex 에 적고 범위 밖 자식 가운데 건너뛰면 세는 수를 graphic 에 더한 뒤 true)
	// - 자식 범위 칸이 이번 경계 셈과 같은 차례이고 이 노드가 더럽지 않을 때만. 지금 변환은 이 노드의 내용 좌표.
	// - 첫 자식: 앞에서부터 모은 가장 큰 아래가 보이는 위 이상이고 가장 큰 오른쪽이 보이는 왼쪽 이상인 첫 자리. (그 앞 자식은 모두 위나 왼쪽 밖)
	// - 끝 자식: 뒤에서부터 모은 가장 작은 위가 보이는 아래 이하이고 가장 작은 왼쪽이 보이는 오른쪽 이하인 끝 자리. (그 뒤 자식은 모두 아래나 오른쪽 밖)
	//==============================================================================
	/**
	 * @param { Graphic } graphic 그릴 그래픽.
	 * @param { number } childCount 자식 수.
	 * @returns { boolean } 찾았으면 참.
	 */
	#findVisibleChildRange(graphic, childCount) {
		if (childCount < 2 || this.#childRangeStamp !== this.#drawBoundsStamp || this.#childRangeCount !== childCount || this.#drawBoundsState === DRAW_BOUNDS_DIRTY) {
			return false;
		}
		if (typeof graphic.isInsideVisibleBounds === "function" && graphic.isInsideVisibleBounds()) {
			return false;
		}
		if (this.#drawBoundsGeneration !== Component.getDrawnRectGeneration() || typeof graphic.readLocalVisibleBounds !== "function" || !graphic.readLocalVisibleBounds(visibleChildRect)) {
			return false;
		}
		const visibleMinimumX = visibleChildRect.position.x;
		const visibleMinimumY = visibleChildRect.position.y;
		const visibleMaximumX = visibleMinimumX + visibleChildRect.size.x;
		const visibleMaximumY = visibleMinimumY + visibleChildRect.size.y;
		const childRangeList = this.#childRangeList;

		// 첫 자식. (조건이 한 번 참이면 뒤로 내내 참이다)
		let lowIndex = 0;
		let highIndex = childCount;
		while (lowIndex < highIndex) {
			const middleIndex = (lowIndex + highIndex) >>> 1;
			const middleOffset = middleIndex * CHILD_RANGE_STRIDE;
			if (childRangeList[middleOffset + CHILD_RANGE_PREFIX_MAXIMUM_BOTTOM] >= visibleMinimumY && childRangeList[middleOffset + CHILD_RANGE_PREFIX_MAXIMUM_RIGHT] >= visibleMinimumX) {
				highIndex = middleIndex;
			}
			else {
				lowIndex = middleIndex + 1;
			}
		}
		const firstIndex = lowIndex;

		// 끝 자식. (조건이 참인 자리는 앞쪽에 모인다, 처음으로 거짓인 자리 바로 앞)
		lowIndex = 0;
		highIndex = childCount;
		while (lowIndex < highIndex) {
			const middleIndex = (lowIndex + highIndex) >>> 1;
			const middleOffset = middleIndex * CHILD_RANGE_STRIDE;
			if (childRangeList[middleOffset + CHILD_RANGE_SUFFIX_MINIMUM_TOP] <= visibleMaximumY && childRangeList[middleOffset + CHILD_RANGE_SUFFIX_MINIMUM_LEFT] <= visibleMaximumX) {
				lowIndex = middleIndex + 1;
			}
			else {
				highIndex = middleIndex;
			}
		}
		const lastIndex = lowIndex - 1;

		// 범위 밖 자식 가운데 건너뛰면 세는 수. (부모 좌표에서 먼저 거르기가 하나씩 건너뛰었을 수와 같다)
		const totalCount = childRangeList[childCount * CHILD_RANGE_STRIDE + CHILD_RANGE_PREFIX_COUNT];
		let culledCount = totalCount;
		if (firstIndex <= lastIndex) {
			const firstCount = childRangeList[firstIndex * CHILD_RANGE_STRIDE + CHILD_RANGE_PREFIX_COUNT];
			const afterLastCount = childRangeList[(lastIndex + 1) * CHILD_RANGE_STRIDE + CHILD_RANGE_PREFIX_COUNT];
			culledCount = firstCount + (totalCount - afterLastCount);
		}
		if (culledCount > 0) {
			graphic.addCulledSubtreeCount(culledCount);
		}
		visibleChildFirstIndex = firstIndex;
		visibleChildLastIndex = lastIndex;
		return true;
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
	// 글로벌 위치를 주어진 벡터에 쓰기. (getPosition 과 같은 값, 새 벡터를 짓지 않는다)
	// - getPosition 이나 부모의 위치, 회전, 크기 읽기를 덮어쓴 하위 클래스면 그 함수로 읽는다. (그때는 그 함수가 짓는 만큼 할당한다)
	//==============================================================================
	/**
	 * @param { Vector2 } out 쓸 벡터.
	 * @returns { Vector2 } out.
	 * @example <caption>프레임마다 같은 벡터에 글로벌 위치 읽기</caption>
	 * import { TransformNode, Vector2 } from "./vanilla.js";
	 * const parentNode = new TransformNode();
	 * parentNode.setLocalPosition(Vector2.create(10, 20));
	 * const childNode = new TransformNode();
	 * childNode.setParent(parentNode);
	 * childNode.setLocalPosition(Vector2.create(5, 0));
	 * const position = Vector2.create(0, 0);
	 * childNode.readPosition(position);
	 * if (position.x !== 15 || position.y !== 20) {
	 * 	throw new Error("position failed");
	 * }
	 */
	readPosition(out) {
		if (this.getPosition !== TransformNode.prototype.getPosition) {
			const position = this.getPosition();
			out.x = position.x;
			out.y = position.y;
			return out;
		}
		const parent = this.getParent();
		this.readLocalPosition(out);
		if (!parent) {
			return out;
		}
		const localX = out.x;
		const localY = out.y;
		readNodePosition(parent, out);
		const parentPositionX = out.x;
		const parentPositionY = out.y;
		const parentRotation = parent.getRotation();
		readNodeScale(parent, PARENT_SCALE);
		const parentScaleX = PARENT_SCALE.x;
		const parentScaleY = PARENT_SCALE.y;

		// getPosition 과 같은 셈, 같은 차례.
		const radian = Math.degreeToRadian(parentRotation);
		const cosRadian = Math.cos(radian);
		const sinRadian = Math.sin(radian);
		const sx = localX * parentScaleX;
		const sy = localY * parentScaleY;
		const rx = sx * cosRadian - sy * sinRadian;
		const ry = sx * sinRadian + sy * cosRadian;
		out.x = parentPositionX + rx;
		out.y = parentPositionY + ry;
		return out;
	}

	//==============================================================================
	// 글로벌 크기를 주어진 벡터에 쓰기. (getScale 과 같은 값, 새 벡터를 짓지 않는다)
	// - getScale 이나 getLocalScale 을 덮어쓴 하위 클래스면 그 함수로 읽는다.
	//==============================================================================
	/**
	 * @param { Vector2 } out 쓸 벡터.
	 * @returns { Vector2 } out.
	 * @example <caption>프레임마다 같은 벡터에 글로벌 크기 읽기</caption>
	 * import { TransformNode, Vector2 } from "./vanilla.js";
	 * const parentNode = new TransformNode();
	 * parentNode.setLocalScale(Vector2.create(2, 2));
	 * const childNode = new TransformNode();
	 * childNode.setParent(parentNode);
	 * childNode.setLocalScale(Vector2.create(0.5, 3));
	 * const scale = Vector2.create(0, 0);
	 * childNode.readScale(scale);
	 * if (scale.x !== 1 || scale.y !== 6) {
	 * 	throw new Error("scale failed");
	 * }
	 */
	readScale(out) {
		if (this.getScale !== TransformNode.prototype.getScale) {
			const scale = this.getScale();
			out.x = scale.x;
			out.y = scale.y;
			return out;
		}
		const parent = this.getParent();
		this.readLocalScale(out);
		if (!parent) {
			return out;
		}
		const localX = out.x;
		const localY = out.y;
		readNodeScale(parent, out);
		out.x = out.x * localX;
		out.y = out.y * localY;
		return out;
	}

	//==============================================================================
	// 로컬 위치를 주어진 벡터에 쓰기. (getLocalPosition 과 같은 값, 복제하지 않는다)
	//==============================================================================
	/**
	 * @param { Vector2 } out 쓸 벡터.
	 * @returns { Vector2 } out.
	 * @example <caption>로컬 위치 읽기</caption>
	 * import { TransformNode, Vector2 } from "./vanilla.js";
	 * const node = new TransformNode();
	 * node.setLocalPositionXY(3, 4);
	 * const position = node.readLocalPosition(Vector2.create(0, 0));
	 * if (position.x !== 3 || position.y !== 4) {
	 * 	throw new Error("local position failed");
	 * }
	 */
	readLocalPosition(out) {
		if (this.getLocalPosition !== TransformNode.prototype.getLocalPosition) {
			const position = this.getLocalPosition();
			out.x = position.x;
			out.y = position.y;
			return out;
		}
		out.x = this.#localPosition.x;
		out.y = this.#localPosition.y;
		return out;
	}

	//==============================================================================
	// 로컬 크기를 주어진 벡터에 쓰기. (getLocalScale 과 같은 값, 복제하지 않는다)
	//==============================================================================
	/**
	 * @param { Vector2 } out 쓸 벡터.
	 * @returns { Vector2 } out.
	 * @example <caption>로컬 크기 읽기</caption>
	 * import { TransformNode, Vector2 } from "./vanilla.js";
	 * const node = new TransformNode();
	 * node.setLocalScaleXY(2, 0.5);
	 * const scale = node.readLocalScale(Vector2.create(0, 0));
	 * if (scale.x !== 2 || scale.y !== 0.5) {
	 * 	throw new Error("local scale failed");
	 * }
	 */
	readLocalScale(out) {
		if (this.getLocalScale !== TransformNode.prototype.getLocalScale) {
			const scale = this.getLocalScale();
			out.x = scale.x;
			out.y = scale.y;
			return out;
		}
		out.x = this.#localScale.x;
		out.y = this.#localScale.y;
		return out;
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
		const isChanged = this.#localPosition.x !== position.x || this.#localPosition.y !== position.y;
		this.#localPosition.x = position.x;
		this.#localPosition.y = position.y;
		// 같은 값이면 경계를 다시 셈하지 않는다. (프레임마다 같은 자리를 다시 놓는 배치)
		if (isChanged) {
			this.markParentDrawBoundsDirty();
		}
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
		const isChanged = this.#localPosition.x !== x || this.#localPosition.y !== y;
		this.#localPosition.x = x;
		this.#localPosition.y = y;
		if (isChanged) {
			this.markParentDrawBoundsDirty();
		}
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
		const isChanged = this.#localScale.x !== scale.x || this.#localScale.y !== scale.y;
		this.#localScale.x = scale.x;
		this.#localScale.y = scale.y;
		// 같은 값이면 경계를 다시 셈하지 않는다. (프레임마다 같은 자리를 다시 놓는 배치)
		if (isChanged) {
			this.markParentDrawBoundsDirty();
		}
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
		const isChanged = this.#localScale.x !== x || this.#localScale.y !== y;
		this.#localScale.x = x;
		this.#localScale.y = y;
		if (isChanged) {
			this.markParentDrawBoundsDirty();
		}
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
		const isChanged = this.#localRotation !== rotation;
		this.#localRotation = rotation;
		if (isChanged) {
			this.markParentDrawBoundsDirty();
		}
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
		const isChanged = this.#isVisible !== isVisible;
		this.#isVisible = isVisible;
		if (isChanged) {
			this.markParentDrawBoundsDirty();
		}
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
			// 새 차례 번호를 먼저 적는다. (셈하며 자식에 적는 부모 좌표 경계가 이 번호를 단다, 앞 차례에 적은 것은 맞지 않게 된다)
			drawBoundsStampCounter += 1;
			this.#drawBoundsStamp = drawBoundsStampCounter;
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
	// 부모가 셈해 둔 이 노드의 하위 트리 그리기 경계 읽기. (부모의 내용 좌표, 이 노드의 변환을 건 경계 상자, 맞으면 true)
	// - 부모가 하위 트리 경계를 셈할 때(calculateSubtreeDrawBounds) 자식마다 옮겨 적어 둔 것이다. 이 노드의 변환이나 경계가 바뀌면 부모가 다시 셈하므로 그때까지 그대로 쓴다.
	// - 그리기 순회가 부모의 변환 아래에서 이 사각형을 먼저 보아, 부모 좌표의 보이는 사각형 밖이면 이 노드에 변환을 걸지 않고 건너뛴다. (스크롤은 부모의 변환만 바뀌므로 자식마다 다시 셈하지 않는다)
	// - 부모가 아직 셈하지 않았거나 셈한 뒤 바뀌었으면(다시 셈할 차례), 이 노드가 어디에 그리는지 모르거나 놓이는 곳을 모르면 false.
	//==============================================================================
	/**
	 * @param { Rect } rect 경계를 적을 곳. (부모의 내용 좌표, 크기가 0 이면 아무것도 그리지 않는다)
	 * @returns { boolean } 맞는 경계가 있으면 참. (없으면 rect 를 건드리지 않는다)
	 * @example <caption>부모가 셈해 둔 줄의 경계를 부모 좌표로 읽기</caption>
	 * import { WorldNode, Paint, Rect, Vector2, Pivot } from "./build/vanilla.js";
	 *
	 * const listNode = new WorldNode();
	 * listNode.setPivot(Pivot.topLeft);
	 * const rowNode = new WorldNode();
	 * rowNode.setPivot(Pivot.topLeft);
	 * rowNode.setRect(0, 120, 300, 40);
	 * rowNode.addComponent(Paint);
	 * listNode.addChild(rowNode);
	 * const drawBounds = Rect.zero();
	 * console.log(rowNode.readParentDrawBounds(drawBounds));
	 * listNode.readSubtreeDrawBounds(drawBounds);
	 * console.log(rowNode.readParentDrawBounds(drawBounds), drawBounds.position.y, drawBounds.size.y);
	 */
	readParentDrawBounds(rect) {
		const parent = this.getParent();
		if (parent === null || parent === undefined || !(#drawBoundsState in parent)) {
			return false;
		}
		if (this.#parentDrawBoundsStamp !== parent.#drawBoundsStamp || parent.#drawBoundsState === DRAW_BOUNDS_DIRTY || parent.#drawBoundsGeneration !== Component.getDrawnRectGeneration()) {
			return false;
		}
		const parentDrawBounds = this.#parentDrawBounds;
		if (this.#isParentDrawBoundsEmpty) {
			rect.position.set(parentDrawBounds.position.x, parentDrawBounds.position.y);
			rect.size.set(0, 0);
			return true;
		}
		rect.position.set(parentDrawBounds.position.x, parentDrawBounds.position.y);
		rect.size.set(parentDrawBounds.size.x, parentDrawBounds.size.y);
		return true;
	}

	//==============================================================================
	// 부모가 셈한 이 노드의 부모 좌표 경계 적기. (부모의 calculateSubtreeDrawBounds 가 자식마다 부른다, 값이 수가 아니면 적지 않고 false)
	//==============================================================================
	/**
	 * @param { Rect } rect 부모 좌표로 옮긴 경계.
	 * @param { boolean } isEmpty 옮기기 전 크기가 0 이었는지.
	 * @param { number } parentStamp 부모의 차례 번호.
	 * @returns { boolean } 적었으면 참.
	 */
	#writeParentDrawBounds(rect, isEmpty, parentStamp) {
		const leftX = rect.position.x;
		const topY = rect.position.y;
		const width = rect.size.x;
		const height = rect.size.y;
		if (!isEmpty && !(System.Number.isFinite(leftX) && System.Number.isFinite(topY) && System.Number.isFinite(width) && System.Number.isFinite(height))) {
			return false;
		}
		let parentDrawBounds = this.#parentDrawBounds;
		if (parentDrawBounds === null) {
			parentDrawBounds = new Rect();
			this.#parentDrawBounds = parentDrawBounds;
		}
		parentDrawBounds.position.set(leftX, topY);
		parentDrawBounds.size.set(width, height);
		this.#isParentDrawBoundsEmpty = isEmpty;
		this.#parentDrawBoundsStamp = parentStamp;
		return true;
	}

	//==============================================================================
	// 노드 스스로(컴포넌트와 자식 밖에) 그리는 사각형을 rect 에 적기. (내용 영역의 왼쪽 위가 원점, 알면 true)
	// - draw 를 덮어쓰지 않은 노드는 스스로 그리는 것이 없으므로 크기 0 을 적고 true.
	// - draw 를 덮어쓴 노드는 어디에 그리는지 모르므로 false. (그 노드의 조상은 하위 트리 그리기를 건너뛰지 않는다)
	//   덮어쓴 노드가 이 함수도 덮어써 그리는 사각형을 알리면 건너뛸 수 있다. 사각형이 바뀌면 markDrawBoundsDirty 를 부른다.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Rect } rect 그리는 사각형을 적을 곳. (노드 내용 영역의 왼쪽 위가 원점)
	 * @returns { boolean } 알면 참.
	 * @example <caption>그리기를 덮어쓰지 않은 노드는 스스로 그리는 것이 없다</caption>
	 * import { TransformNode, Rect } from "./build/vanilla.js";
	 *
	 * const node = new TransformNode();
	 * const drawnRect = Rect.zero();
	 * console.log(node.calculateDrawnRect(drawnRect), drawnRect.size.x);
	 */
	calculateDrawnRect(rect) {
		if (this.draw !== TransformNode.prototype.draw) {
			return false;
		}
		rect.position.set(0, 0);
		rect.size.set(0, 0);
		return true;
	}

	//==============================================================================
	// 하위 트리 그리기 경계를 부모의 내용 좌표로 옮기기. (알면 true, calculateSubtreeDrawBounds 가 자식마다 부른다)
	// - TransformNode 는 내용 영역과 피봇이 없어 어디에 놓이는지 정하지 않으므로 false. (WorldNode, UINode 가 저마다 놓는 꼴로 덮어쓴다)
	//==============================================================================
	/**
	 * @virtual
	 * @param { Rect } rect 옮길 경계. (이 노드의 내용 좌표, 부모의 내용 좌표로 바뀐 경계 상자를 적는다)
	 * @returns { boolean } 놓이는 곳을 알면 참.
	 * @example <caption>놓는 꼴을 모르는 노드</caption>
	 * import { TransformNode, Rect } from "./build/vanilla.js";
	 *
	 * const node = new TransformNode();
	 * console.log(node.transformDrawBoundsToParent(Rect.create(0, 0, 10, 10)));
	 */
	transformDrawBoundsToParent(rect) {
		return false;
	}

	//==============================================================================
	// 사각형을 이 노드의 회전과 배율로 돌리고 키워 부모 좌표에 옮긴 경계 상자로 바꾸기. (transformDrawBoundsToParent 가 쓴다)
	// - 차례: 기준점만큼 당김 → 배율 → 회전 → 옮김. (pushTransform 의 옮김, 회전, 배율과 같은 결과)
	//==============================================================================
	/**
	 * @param { Rect } rect 바꿀 사각형. (이 노드의 내용 좌표, 바뀐 경계 상자를 적는다)
	 * @param { number } pivotOffsetX 기준점의 가로 자리. (내용 좌표, 이만큼 당긴 뒤 키운다)
	 * @param { number } pivotOffsetY 기준점의 세로 자리.
	 * @param { number } translateX 부모 좌표로 옮기는 가로 거리.
	 * @param { number } translateY 부모 좌표로 옮기는 세로 거리.
	 * @example <caption>두 배로 키우고 옮긴 사각형</caption>
	 * import { TransformNode, Rect, Vector2 } from "./build/vanilla.js";
	 *
	 * const node = new TransformNode();
	 * node.setLocalScale(Vector2.create(2, 2));
	 * const rect = Rect.create(0, 0, 10, 10);
	 * node.transformLocalRectToParent(rect, 5, 5, 100, 0);
	 * console.log(rect.position.x, rect.size.x);
	 */
	transformLocalRectToParent(rect, pivotOffsetX, pivotOffsetY, translateX, translateY) {
		const localScale = this.#localScale;
		const radian = Math.degreeToRadian(this.#localRotation);
		const cosRadian = (radian === 0) ? 1 : System.Math.cos(radian);
		const sinRadian = (radian === 0) ? 0 : System.Math.sin(radian);
		const leftX = (rect.position.x - pivotOffsetX) * localScale.x;
		const topY = (rect.position.y - pivotOffsetY) * localScale.y;
		const rightX = (rect.position.x + rect.size.x - pivotOffsetX) * localScale.x;
		const bottomY = (rect.position.y + rect.size.y - pivotOffsetY) * localScale.y;
		const leftTopX = cosRadian * leftX - sinRadian * topY;
		const leftTopY = sinRadian * leftX + cosRadian * topY;
		const rightTopX = cosRadian * rightX - sinRadian * topY;
		const rightTopY = sinRadian * rightX + cosRadian * topY;
		const leftBottomX = cosRadian * leftX - sinRadian * bottomY;
		const leftBottomY = sinRadian * leftX + cosRadian * bottomY;
		const rightBottomX = cosRadian * rightX - sinRadian * bottomY;
		const rightBottomY = sinRadian * rightX + cosRadian * bottomY;
		const minimumX = System.Math.min(leftTopX, rightTopX, leftBottomX, rightBottomX) + translateX;
		const minimumY = System.Math.min(leftTopY, rightTopY, leftBottomY, rightBottomY) + translateY;
		const maximumX = System.Math.max(leftTopX, rightTopX, leftBottomX, rightBottomX) + translateX;
		const maximumY = System.Math.max(leftTopY, rightTopY, leftBottomY, rightBottomY) + translateY;
		rect.position.set(minimumX, minimumY);
		rect.size.set(maximumX - minimumX, maximumY - minimumY);
	}

	//==============================================================================
	// 하위 트리 그리기 경계 셈하기. (자기 그림과 켜지고 보이는 자식들 경계의 합, readSubtreeDrawBounds 가 바뀐 때만 부른다, 알면 true)
	// - 자기 그림: calculateDrawnRect 와 켜진 컴포넌트. 내용 영역 안에서만 그리는 컴포넌트(Component.isDrawnInsideContent)는 내용 영역을 한 단위씩 넓혀 보고,
	//   밖까지 그리는 컴포넌트는 Component.calculateDrawnRect 로 본다. 그리지 않는 컴포넌트(draw 를 덮어쓰지 않은 것)는 빼고,
	//   모르는 컴포넌트가 하나라도 있으면 모른다. 기즈모를 그리는 노드와 내용 크기를 읽을 수 없는 노드(내용 영역 안 컴포넌트가 있을 때)도 모른다.
	// - 자식: 자식의 하위 트리 경계를 자식이 옮긴(transformDrawBoundsToParent) 이 노드의 내용 좌표 경계 상자. 놓이는 곳을 모르는 자식이 있으면 모른다.
	// - 모르더라도 켜지고 보이는 자식의 경계는 모두 읽는다. (자식이 셈해 두어야 자손이 바뀐 것이 이 노드까지 번진다)
	// - 부모 좌표로 옮긴 자식의 경계는 자식에 적어 둔다. (readParentDrawBounds, 그리기 순회가 자식에 변환을 걸기 전에 본다, 이 노드가 다시 셈할 때까지 맞다)
	// - 마스크로 자식을 잘라도 경계는 줄이지 않는다. (넉넉하게 본다)
	//==============================================================================
	/**
	 * @virtual
	 * @param { Rect } rect 셈한 경계를 적을 곳. (이 노드의 내용 좌표)
	 * @returns { boolean } 경계를 알면 참.
	 */
	calculateSubtreeDrawBounds(rect) {
		let isKnown = true;
		let isFound = false;
		let minimumX = 0;
		let minimumY = 0;
		let maximumX = 0;
		let maximumY = 0;

		// 노드 스스로 그리는 것.
		const nodeRect = subtreeNodeRect;
		if (this.isGizmoVisible() || !this.calculateDrawnRect(nodeRect)) {
			isKnown = false;
		}
		else if (nodeRect.size.x > 0 && nodeRect.size.y > 0) {
			minimumX = nodeRect.position.x;
			minimumY = nodeRect.position.y;
			maximumX = minimumX + nodeRect.size.x;
			maximumY = minimumY + nodeRect.size.y;
			isFound = true;
		}

		// 켜진 컴포넌트.
		if (isKnown) {
			let isInsideContentReported = false;
			const componentRect = subtreeComponentRect;
			const components = this.getAllComponents();
			for (const component of components) {
				if (!component.isEnable() || component.draw === Component.prototype.draw) {
					continue;
				}
				if (component.isDrawnInsideContent()) {
					isInsideContentReported = true;
					continue;
				}
				if (!component.calculateDrawnRect(componentRect)) {
					isKnown = false;
					break;
				}
				if (!(componentRect.size.x > 0 && componentRect.size.y > 0)) {
					continue;
				}
				const componentRightX = componentRect.position.x + componentRect.size.x;
				const componentBottomY = componentRect.position.y + componentRect.size.y;
				if (!isFound) {
					minimumX = componentRect.position.x;
					minimumY = componentRect.position.y;
					maximumX = componentRightX;
					maximumY = componentBottomY;
					isFound = true;
				}
				else {
					minimumX = System.Math.min(minimumX, componentRect.position.x);
					minimumY = System.Math.min(minimumY, componentRect.position.y);
					maximumX = System.Math.max(maximumX, componentRightX);
					maximumY = System.Math.max(maximumY, componentBottomY);
				}
			}

			// 내용 영역 안에서만 그리는 컴포넌트는 내용 영역을 한 단위씩 넓혀 본다. (화면 밖 거르기와 같다)
			if (isKnown && isInsideContentReported) {
				const contentSize = subtreeContentSize;
				if (typeof this.copyContentSizeTo === "function") {
					this.copyContentSizeTo(contentSize);
				}
				else if (typeof this.getContentSize === "function") {
					const nodeContentSize = this.getContentSize();
					contentSize.set(nodeContentSize.x, nodeContentSize.y);
				}
				else {
					isKnown = false;
				}
				if (isKnown) {
					const contentMinimumX = System.Math.min(0, contentSize.x) - 1;
					const contentMinimumY = System.Math.min(0, contentSize.y) - 1;
					const contentMaximumX = System.Math.max(0, contentSize.x) + 1;
					const contentMaximumY = System.Math.max(0, contentSize.y) + 1;
					if (!isFound) {
						minimumX = contentMinimumX;
						minimumY = contentMinimumY;
						maximumX = contentMaximumX;
						maximumY = contentMaximumY;
						isFound = true;
					}
					else {
						minimumX = System.Math.min(minimumX, contentMinimumX);
						minimumY = System.Math.min(minimumY, contentMinimumY);
						maximumX = System.Math.max(maximumX, contentMaximumX);
						maximumY = System.Math.max(maximumY, contentMaximumY);
					}
				}
			}
		}

		// 켜지고 보이는 자식. (모르는 것이 나와도 자식이 셈해 두게 끝까지 읽는다)
		// 자식 범위 칸에 자식마다 부모 좌표 경계를 적는다. 모르는 자식은 막음(위와 왼쪽 -무한, 아래와 오른쪽 +무한), 꺼진 자식과 그리지 않는 자식은 빔(반대).
		const childRect = childDrawBounds;
		const children = this.getChildren();
		const childCount = children.length;
		let childRangeList = this.#childRangeList;
		if (childCount > 0 && (childRangeList === null || childRangeList.length < (childCount + 1) * CHILD_RANGE_STRIDE)) {
			childRangeList = new System.Float64Array((childCount + 1) * CHILD_RANGE_STRIDE);
			this.#childRangeList = childRangeList;
		}
		let childIndex = -1;
		for (const child of children) {
			childIndex += 1;
			const rangeOffset = childIndex * CHILD_RANGE_STRIDE;
			childRangeList[rangeOffset + CHILD_RANGE_PREFIX_MAXIMUM_BOTTOM] = System.Number.POSITIVE_INFINITY;
			childRangeList[rangeOffset + CHILD_RANGE_PREFIX_MAXIMUM_RIGHT] = System.Number.POSITIVE_INFINITY;
			childRangeList[rangeOffset + CHILD_RANGE_SUFFIX_MINIMUM_TOP] = System.Number.NEGATIVE_INFINITY;
			childRangeList[rangeOffset + CHILD_RANGE_SUFFIX_MINIMUM_LEFT] = System.Number.NEGATIVE_INFINITY;
			childRangeList[rangeOffset + CHILD_RANGE_PREFIX_COUNT] = 0;
			if (!(child instanceof TransformNode)) {
				isKnown = false;
				continue;
			}
			// 꺼진 자식은 Graphic.drawNode 가 바로 돌아가므로 빔. 숨긴 자식은 기즈모나 덮어쓴 draw 가 그릴 수 있어 막음.
			if (!child.isActive()) {
				childRangeList[rangeOffset + CHILD_RANGE_PREFIX_MAXIMUM_BOTTOM] = System.Number.NEGATIVE_INFINITY;
				childRangeList[rangeOffset + CHILD_RANGE_PREFIX_MAXIMUM_RIGHT] = System.Number.NEGATIVE_INFINITY;
				childRangeList[rangeOffset + CHILD_RANGE_SUFFIX_MINIMUM_TOP] = System.Number.POSITIVE_INFINITY;
				childRangeList[rangeOffset + CHILD_RANGE_SUFFIX_MINIMUM_LEFT] = System.Number.POSITIVE_INFINITY;
				continue;
			}
			if (!child.isVisible()) {
				continue;
			}
			if (!child.readSubtreeDrawBounds(childRect)) {
				isKnown = false;
				continue;
			}
			const isChildEmpty = !(childRect.size.x > 0 && childRect.size.y > 0);
			if (!child.transformDrawBoundsToParent(childRect)) {
				isKnown = false;
				continue;
			}
			if (child.#writeParentDrawBounds(childRect, isChildEmpty, this.#drawBoundsStamp)) {
				childRangeList[rangeOffset + CHILD_RANGE_PREFIX_COUNT] = 1;
				if (isChildEmpty) {
					childRangeList[rangeOffset + CHILD_RANGE_PREFIX_MAXIMUM_BOTTOM] = System.Number.NEGATIVE_INFINITY;
					childRangeList[rangeOffset + CHILD_RANGE_PREFIX_MAXIMUM_RIGHT] = System.Number.NEGATIVE_INFINITY;
					childRangeList[rangeOffset + CHILD_RANGE_SUFFIX_MINIMUM_TOP] = System.Number.POSITIVE_INFINITY;
					childRangeList[rangeOffset + CHILD_RANGE_SUFFIX_MINIMUM_LEFT] = System.Number.POSITIVE_INFINITY;
				}
				else {
					childRangeList[rangeOffset + CHILD_RANGE_PREFIX_MAXIMUM_BOTTOM] = childRect.position.y + childRect.size.y;
					childRangeList[rangeOffset + CHILD_RANGE_PREFIX_MAXIMUM_RIGHT] = childRect.position.x + childRect.size.x;
					childRangeList[rangeOffset + CHILD_RANGE_SUFFIX_MINIMUM_TOP] = childRect.position.y;
					childRangeList[rangeOffset + CHILD_RANGE_SUFFIX_MINIMUM_LEFT] = childRect.position.x;
				}
			}
			if (!isKnown || isChildEmpty) {
				continue;
			}
			const childRightX = childRect.position.x + childRect.size.x;
			const childBottomY = childRect.position.y + childRect.size.y;
			if (!isFound) {
				minimumX = childRect.position.x;
				minimumY = childRect.position.y;
				maximumX = childRightX;
				maximumY = childBottomY;
				isFound = true;
			}
			else {
				minimumX = System.Math.min(minimumX, childRect.position.x);
				minimumY = System.Math.min(minimumY, childRect.position.y);
				maximumX = System.Math.max(maximumX, childRightX);
				maximumY = System.Math.max(maximumY, childBottomY);
			}
		}

		// 자식 범위 칸을 앞에서부터(가장 큰 아래와 오른쪽, 건너뛰면 세는 수), 뒤에서부터(가장 작은 위와 왼쪽) 모은다. (자식을 그릴 때 이분 찾기로 보이는 범위를 찾는다)
		if (childCount > 0 && childIndex === childCount - 1) {
			let prefixMaximumBottom = System.Number.NEGATIVE_INFINITY;
			let prefixMaximumRight = System.Number.NEGATIVE_INFINITY;
			let prefixCount = 0;
			for (let rangeIndex = 0; rangeIndex < childCount; ++rangeIndex) {
				const rangeOffset = rangeIndex * CHILD_RANGE_STRIDE;
				prefixMaximumBottom = System.Math.max(prefixMaximumBottom, childRangeList[rangeOffset + CHILD_RANGE_PREFIX_MAXIMUM_BOTTOM]);
				prefixMaximumRight = System.Math.max(prefixMaximumRight, childRangeList[rangeOffset + CHILD_RANGE_PREFIX_MAXIMUM_RIGHT]);
				childRangeList[rangeOffset + CHILD_RANGE_PREFIX_MAXIMUM_BOTTOM] = prefixMaximumBottom;
				childRangeList[rangeOffset + CHILD_RANGE_PREFIX_MAXIMUM_RIGHT] = prefixMaximumRight;
				const countable = childRangeList[rangeOffset + CHILD_RANGE_PREFIX_COUNT];
				childRangeList[rangeOffset + CHILD_RANGE_PREFIX_COUNT] = prefixCount;
				prefixCount += countable;
			}
			childRangeList[childCount * CHILD_RANGE_STRIDE + CHILD_RANGE_PREFIX_COUNT] = prefixCount;
			let suffixMinimumTop = System.Number.POSITIVE_INFINITY;
			let suffixMinimumLeft = System.Number.POSITIVE_INFINITY;
			for (let rangeIndex = childCount - 1; rangeIndex >= 0; --rangeIndex) {
				const rangeOffset = rangeIndex * CHILD_RANGE_STRIDE;
				suffixMinimumTop = System.Math.min(suffixMinimumTop, childRangeList[rangeOffset + CHILD_RANGE_SUFFIX_MINIMUM_TOP]);
				suffixMinimumLeft = System.Math.min(suffixMinimumLeft, childRangeList[rangeOffset + CHILD_RANGE_SUFFIX_MINIMUM_LEFT]);
				childRangeList[rangeOffset + CHILD_RANGE_SUFFIX_MINIMUM_TOP] = suffixMinimumTop;
				childRangeList[rangeOffset + CHILD_RANGE_SUFFIX_MINIMUM_LEFT] = suffixMinimumLeft;
			}
			this.#childRangeStamp = this.#drawBoundsStamp;
			this.#childRangeCount = childCount;
		}
		else {
			this.#childRangeStamp = -1;
		}

		if (!isKnown) {
			return false;
		}
		if (!isFound) {
			rect.position.set(0, 0);
			rect.size.set(0, 0);
			return true;
		}
		rect.position.set(minimumX, minimumY);
		rect.size.set(maximumX - minimumX, maximumY - minimumY);
		return true;
	}
}