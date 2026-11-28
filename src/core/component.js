//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Object } from "../base/object.js";
import { ComponentNode } from "./node/componentnode.js";
import { Graphic } from "../core/graphic.js";


//==============================================================================
// 전역 변수 목록.
//==============================================================================
// 그리는 사각형 세대. (글꼴 적재처럼 모든 컴포넌트의 그리는 사각형이 한꺼번에 바뀔 수 있으면 올린다, 노드가 셈해 둔 그리기 경계와 견준다)
let drawnRectGeneration = 0;


//==============================================================================
// 컴포넌트.
//==============================================================================
/**
 * @example <caption>노드에 붙여 돌리고 그리는 컴포넌트</caption>
 * import { Engine, EngineConfiguration, Scene, WorldNode, Component, Rect, Colors } from "./build/vanilla.js";
 *
 * class SpinningBox extends Component {
 * 	tick(timeDelta) {
 * 		const node = this.getNode();
 * 		const rotation = node.getLocalRotation();
 * 		node.setLocalRotation(rotation + 90 * timeDelta);
 * 	}
 *
 * 	draw(graphic) {
 * 		const node = this.getNode();
 * 		const contentSize = node.getContentSize();
 * 		graphic.setFillColor(Colors.white);
 * 		graphic.drawRect(Rect.create(0, 0, contentSize.x, contentSize.y));
 * 	}
 *
 * 	isDrawnInsideContent() {
 * 		return true;
 * 	}
 * }
 *
 * class MainScene extends Scene {
 * 	initialize(engine) {
 * 		const root = this.getRoot();
 * 		const node = new WorldNode();
 * 		node.setRect(100, 100, 80, 80);
 * 		node.addComponent(SpinningBox);
 * 		root.addChild(node);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
export class Component extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { string } */		#componentType; // 컴포넌트 타입.
	/** @private @type { ComponentNode } */	#node; // 소유권자.
	/** @private @type { boolean } */		#isEnable; // 활성화 여부.
	/** @private @type { boolean } */		#isGizmoVisible; // 기즈모 출력 여부.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.#componentType = "Component";
		this.#node = null;
		this.#isEnable = true;
		this.#isGizmoVisible = false;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @virtual
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 */
	tick(timeDelta) {
		// 갱신.
	}

	//==============================================================================
	// tick 이 할 일이 있는지. (거짓이면 노드가 이 컴포넌트의 tick 을 부르지 않는다)
	// - 기본은 tick 을 다시 정의했는지로 본다. 그리기만 하는 컴포넌트는 매 프레임 부르는 비용이 없어진다.
	// - tick 을 다시 정의했어도 할 일이 없는 때가 있으면 하위 클래스가 다시 정의한다.
	//==============================================================================
	/**
	 * @virtual
	 * @returns { boolean } 노드가 tick 을 불러야 하면 참.
	 */
	isTickNeeded() {
		return this.tick !== Component.prototype.tick;
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Graphic } graphic 그릴 그래픽.
	 */
	draw(graphic) {
		// 출력.
	}

	//==============================================================================
	// 기즈모 출력.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Graphic } graphic 그릴 그래픽.
	 */
	drawGizmos(graphic) {
		const isGizmoVisible = this.isGizmoVisible();
		if (!isGizmoVisible) {
			return;
		}

		// 출력.
	}

	//==============================================================================
	// 노드의 내용 영역(0, 0 ~ contentSize) 안에서만 그리는지 반환. (기본 false)
	// - true 를 돌려주면 Graphic 의 화면 밖 거르기가 켜져 있을 때, 내용 영역이 화면 밖이면 엔진이 draw 를 건너뛴다.
	// - 영역 밖(월드 좌표, 글자 넘침, 그림자 여백 등)에 조금이라도 그릴 수 있으면 false 로 둔다.
	//==============================================================================
	/**
	 * @virtual
	 * @returns { boolean } 내용 영역 안에서만 그리면 참.
	 */
	isDrawnInsideContent() {
		return false;
	}

	//==============================================================================
	// 내용 영역 밖까지 그리는 컴포넌트가 그리는 사각형을 rect 에 적기. (노드 내용 영역의 왼쪽 위가 원점, 알면 true, 기본 false)
	// - isDrawnInsideContent 가 false 인 컴포넌트만 묻는다. true 를 돌려주면 화면 밖 거르기가 이 사각형으로 본다.
	// - 크기가 0 인 사각형은 아무것도 그리지 않는다는 뜻이다.
	// - 모르면 false 로 둔다. (그 노드는 거르지 않는다)
	// - 노드는 이 사각형을 하위 트리 그리기 경계에 셈해 두고 바뀐 때만 다시 묻는다. 사각형을 바꾸는 값(글, 글꼴 크기 등)이 바뀌면 markDrawnRectDirty 를 부른다.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Rect } rect 그리는 사각형을 적을 곳. (노드 내용 영역의 왼쪽 위가 원점)
	 * @returns { boolean } rect 에 적었으면 참. (모르면 거짓)
	 * @example <caption>내용 영역 밖으로 번지는 그리기 알리기</caption>
	 * import { WorldNode, Component, Rect, Vector2 } from "./build/vanilla.js";
	 *
	 * class Glow extends Component {
	 * 	calculateDrawnRect(rect) {
	 * 		const node = this.getNode();
	 * 		const contentSize = node.getContentSize();
	 * 		rect.position.set(-10, -10);
	 * 		rect.size.set(contentSize.x + 20, contentSize.y + 20);
	 * 		return true;
	 * 	}
	 * }
	 *
	 * const node = new WorldNode();
	 * node.setContentSize(Vector2.create(100, 50));
	 * const glow = node.addComponent(Glow);
	 * const drawnRect = Rect.zero();
	 * const isKnown = glow.calculateDrawnRect(drawnRect);
	 * console.log(isKnown, drawnRect.size.x, drawnRect.size.y);
	 */
	calculateDrawnRect(rect) {
		return false;
	}

	//==============================================================================
	// 그리는 사각형(calculateDrawnRect)이 바뀌었음을 노드에 알리기. (노드가 셈해 둔 하위 트리 그리기 경계를 다시 셈하게 한다)
	// - calculateDrawnRect 를 덮어쓴 컴포넌트는 그 사각형을 바꾸는 값이 바뀔 때 부른다. (Godot 의 item_rect_changed, 유니티의 SetVerticesDirty 와 같은 자리)
	// - 내용 영역 안에서만 그리는 컴포넌트(isDrawnInsideContent)는 노드의 내용 크기를 보므로 부르지 않아도 된다.
	// - 노드에 붙지 않았으면 아무것도 하지 않는다.
	//==============================================================================
	/**
	 * @example <caption>번지는 너비가 바뀌면 알리기</caption>
	 * import { WorldNode, Component, Rect, Vector2 } from "./build/vanilla.js";
	 *
	 * class Glow extends Component {
	 * 	glowSize = 10;
	 * 	setGlowSize(glowSize) {
	 * 		this.glowSize = glowSize;
	 * 		this.markDrawnRectDirty();
	 * 	}
	 * 	calculateDrawnRect(rect) {
	 * 		const contentSize = this.getNode().getContentSize();
	 * 		rect.position.set(-this.glowSize, -this.glowSize);
	 * 		rect.size.set(contentSize.x + this.glowSize * 2, contentSize.y + this.glowSize * 2);
	 * 		return true;
	 * 	}
	 * }
	 *
	 * const node = new WorldNode();
	 * node.setContentSize(Vector2.create(100, 50));
	 * const glow = node.addComponent(Glow);
	 * glow.setGlowSize(20);
	 * const drawBounds = Rect.zero();
	 * const isKnown = node.readSubtreeDrawBounds(drawBounds);
	 * console.log(isKnown, drawBounds.size.x, drawBounds.size.y);
	 */
	markDrawnRectDirty() {
		const node = this.#node;
		if (node !== null && node !== undefined && typeof node.markDrawBoundsDirty === "function") {
			node.markDrawBoundsDirty();
		}
	}

	//==============================================================================
	// 모든 컴포넌트의 그리는 사각형이 바뀌었을 수 있음을 알리기. (글꼴 적재처럼 한꺼번에 바뀌는 때, 노드들은 다음에 그릴 때 경계를 다시 셈한다)
	//==============================================================================
	/**
	 * @example <caption>글꼴을 바꾼 뒤 모든 노드의 그리기 경계를 다시 셈하게 하기</caption>
	 * import { Component } from "./build/vanilla.js";
	 *
	 * const generationBefore = Component.getDrawnRectGeneration();
	 * Component.markAllDrawnRectsDirty();
	 * console.log(Component.getDrawnRectGeneration() === generationBefore + 1);
	 */
	static markAllDrawnRectsDirty() {
		drawnRectGeneration += 1;
	}

	//==============================================================================
	// 그리는 사각형 세대 반환. (markAllDrawnRectsDirty 를 부를 때마다 하나씩 오른다, 노드가 셈해 둔 경계와 견준다)
	//==============================================================================
	/**
	 * @returns { number } 그리는 사각형 세대.
	 */
	static getDrawnRectGeneration() {
		return drawnRectGeneration;
	}

	//==============================================================================
	// 그리기 입력을 기하 캐시 열쇠에 적기. (적었으면 true, 기본 false)
	// - true 를 돌려주면 Graphic 이 이 컴포넌트가 그린 정점을 캐시해 두고, 열쇠에 적은 값과 그리는 상태가 그대로면 draw 를 부르지 않고 캐시를 묶음에 옮긴다.
	//   이동(스크롤 등)이나 투명도만 바뀌면 캐시한 지역 정점에 새 행렬만 곱한다. (유니티 UGUI 의 SetVerticesDirty, Slate 의 Invalidate 와 같은 일을 입력 견주기로 한다)
	// - draw 가 읽는 값(색의 칸, 크기, 글, 그림, 노드의 내용 크기 등)을 모두 geometryKey.add 로 적는다. 빠진 값이 바뀌면 화면에 나오지 않는다.
	// - 시각이나 난수처럼 프레임마다 달라지는 것을 그리면 false 로 둔다. (프레임마다 draw 를 부른다)
	//==============================================================================
	/**
	 * @virtual
	 * @param { GeometryKey } geometryKey 입력을 적을 열쇠. (add 로 적는다)
	 * @returns { boolean } 입력을 모두 적었으면 참. (모르면 거짓)
	 * @example <caption>색과 크기만 읽는 컴포넌트의 입력 알리기</caption>
	 * import { WorldNode, Component, GeometryKey, Color, Rect, Vector2 } from "./build/vanilla.js";
	 *
	 * class Box extends Component {
	 * 	color = new Color(0.2, 0.6, 1, 1);
	 * 	draw(graphic) {
	 * 		const contentSize = this.getNode().getContentSize();
	 * 		graphic.setFillColor(this.color);
	 * 		graphic.drawRect(Rect.create(0, 0, contentSize.x, contentSize.y));
	 * 	}
	 * 	writeGeometryKey(geometryKey) {
	 * 		const contentSize = this.getNode().getContentSize();
	 * 		geometryKey.add(this.color.red);
	 * 		geometryKey.add(this.color.green);
	 * 		geometryKey.add(this.color.blue);
	 * 		geometryKey.add(this.color.alpha);
	 * 		geometryKey.add(contentSize.x);
	 * 		geometryKey.add(contentSize.y);
	 * 		return true;
	 * 	}
	 * }
	 *
	 * const node = new WorldNode();
	 * node.setContentSize(Vector2.create(100, 50));
	 * const box = node.addComponent(Box);
	 * const geometryKey = new GeometryKey();
	 * geometryKey.begin();
	 * console.log(box.writeGeometryKey(geometryKey), geometryKey.end());
	 */
	writeGeometryKey(geometryKey) {
		return false;
	}

	//==============================================================================
	// 의존 컴포넌트 목록 반환. (자식 클래스가 오버라이드)
	// - addComponent 가 본 컴포넌트를 부착하기 직전에 호출하여, 반환된 클래스 목록을
	//   같은 노드에 자동으로 추가한다 (이미 있으면 건너뜀).
	// - Unity 의 RequireComponent 와 같은 사상.
	//==============================================================================
	/**
	 * @virtual
	 * @returns { Function[] } 같은 노드에 먼저 붙일 컴포넌트 클래스 목록.
	 */
	require() {
		return [];
	}

	//==============================================================================
	// 노드에 붙음.
	//==============================================================================
	/**
	 * @virtual
	 * @param { ComponentNode } node 붙은 노드.
	 */
	attach(node) {
		// 코드.
	}

	//==============================================================================
	// 노드에서 떨어짐.
	//==============================================================================
	/**
	 * @virtual
	 * @param { ComponentNode } node 떨어진 노드.
	 */
	detach(node) {
		// 코드.
	}

	//==============================================================================
	// 소유권자 설정.
	//==============================================================================
	/**
	 * @param { ComponentNode } node 소유권자 노드. (떨어지면 null)
	 */
	setNode(node) {
		this.#node = node;
	}

	//==============================================================================
	// 소유권자 반환.
	//==============================================================================
	/**
	 * @returns { ComponentNode } 소유권자 노드. (붙지 않았으면 null)
	 */
	getNode() {
		return this.#node;
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

	//==============================================================================
	// 활성화 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } isEnable 켤지. (꺼지면 노드가 draw 를 부르지 않는다)
	 */
	setEnable(isEnable) {
		if (this.#isEnable === isEnable) {
			return;
		}
		this.#isEnable = isEnable;
		this.markDrawnRectDirty();
	}

	//==============================================================================
	// 활성화 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 켜져 있으면 참.
	 */
	isEnable() {
		return this.#isEnable;
	}

	//==============================================================================
	// 컴포넌트 타입 설정.
	//==============================================================================
	/**
	 * @param { string } componentType 컴포넌트 타입 이름. (처음은 "Component", Mask 같은 이름으로 종류를 가른다)
	 */
	setComponentType(componentType) {
		this.#componentType = componentType;
	}

	//==============================================================================
	// 컴포넌트 타입 반환.
	//==============================================================================
	/**
	 * @returns { string } 컴포넌트 타입 이름.
	 */
	getComponentType() {
		return this.#componentType;
	}
}
