//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Object } from "../base/object.js";
import { ComponentNode } from "./node/componentnode.js";
import { Graphic } from "../core/graphic.js";


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
		this.#isEnable = isEnable;
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
