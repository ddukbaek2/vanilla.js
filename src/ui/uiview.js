//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Color } from "../base/color.js";
import { Pivot } from "../base/pivot.js";
import { Rect } from "../base/rect.js";
import { Vector2 } from "../base/vector2.js";
import { Component } from "../core/component.js";
import { Engine } from "../core/engine.js";
import { Graphic } from "../core/graphic.js";
import { WorldNode } from "../core/node/worldnode.js";


//==============================================================================
// 뷰 컴포넌트.
// - ScrollView, SnapScrollView 등 모든 뷰 컴포넌트의 기반 클래스.
// - 타입으로 하위 뷰 컴포넌트를 한번에 조회할 수 있다.
//   예: node.getComponent(View)
// - 컨테이너 역할을 하므로 UIControl 을 상속하지 않고 Component 직접 상속.
//   대신 UIControl 이 갖던 setEngine/getEngine 를 자체적으로 보유한다.
//==============================================================================
/**
 * @example <caption>배경색이 있는 판에 라벨 담기</caption>
 * import { Engine, EngineConfiguration, UIScene, UIView, UILabel, WorldNode, Pivot, Vector2, Color } from "./build/vanilla.js";
 *
 * class MainScene extends UIScene {
 * 	constructor() {
 * 		super();
 * 		this.setLoadingMinDurationMs(0);
 * 	}
 *
 * 	initialize(engine) {
 * 		super.initialize(engine);
 * 		const panelNode = new WorldNode();
 * 		panelNode.setPivot(Pivot.topLeft);
 * 		panelNode.setAnchor(Pivot.topLeft);
 * 		panelNode.setLocalPosition(Vector2.create(40, 40));
 * 		panelNode.setContentSize(Vector2.create(240, 160));
 * 		const view = panelNode.addComponent(UIView);
 * 		view.setBackgroundColor(new Color(0.1, 0.12, 0.16, 1));
 *
 * 		const labelNode = new WorldNode();
 * 		labelNode.setPivot(Pivot.topLeft);
 * 		labelNode.setAnchor(Pivot.topLeft);
 * 		labelNode.setLocalPosition(Vector2.create(16, 16));
 * 		labelNode.setContentSize(Vector2.create(208, 32));
 * 		const label = labelNode.addComponent(UILabel);
 * 		label.setText("Panel");
 * 		label.setFontSize(20);
 * 		const content = view.getContent();
 * 		content.addChild(labelNode);
 *
 * 		const root = this.getRoot();
 * 		root.addChild(panelNode);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * engineConfiguration.canvasId = "mainCanvas";
 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
 * engineConfiguration.autoResizeOnWindowResize = true;
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
export class UIView extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Engine } */ #engine;
	/** @private @type { WorldNode | null } */ #content; // 컨텐트 노드.
	/** @private @type { Color } */ #backgroundColor;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.setComponentType("View");
		this.#engine = null;
		this.#content = null;
		this.#backgroundColor = new Color(1, 1, 1, 0);
	}

	//==============================================================================
	// 엔진 설정. (구 UIComponent 에서 이관)
	//==============================================================================
	/**
	 * @param { Engine } engine 엔진.
	 */
	setEngine(engine) {
		this.#engine = engine;
	}

	//==============================================================================
	// 엔진 반환. (구 UIComponent 에서 이관)
	//==============================================================================
	/**
	 * @returns { Engine | null } setEngine 으로 준 엔진. (주지 않았으면 null)
	 */
	getEngine() {
		return this.#engine;
	}

	//==============================================================================
	// 노드에 붙음.
	//==============================================================================
	/**
	 * @override
	 * @param { ComponentNode } node 붙을 노드.
	 */
	attach(node) {
		super.attach(node);

		// 컨텐트 노드 추가. 부모 좌상단에 anchor (0,0) 으로 정렬.
		this.#content = new WorldNode();
		this.#content.setName("content");
		this.#content.setPivot(Pivot.topLeft);
		this.#content.setAnchor(Vector2.zero());
		this.#content.setAnchoredPosition(Vector2.zero());
		const content = this.getContent();
		node.addChild(content);
	}

	//==============================================================================
	// 노드에서 떨어짐.
	//==============================================================================
	/**
	 * @override
	 * @param { ComponentNode } node 떨어질 노드.
	 */
	detach(node) {
		super.detach(node);
	}

	//==============================================================================
	// 내용 영역 안에서만 그리는지 반환. (배경은 내용 크기의 사각형만 칠한다, 화면 밖과 자르기 밖 거르기가 쓴다)
	// - draw 를 덮어쓴 하위 클래스는 어디에 그리는지 모르므로 false. (그 클래스가 이 함수도 덮어써 알린다)
	//==============================================================================
	/**
	 * @override
	 * @returns { boolean } 내용 영역 안에서만 그리면 참.
	 */
	isDrawnInsideContent() {
		return this.draw === UIView.prototype.draw;
	}

	//==============================================================================
	// 출력. (배경색이 설정된 경우 스크롤뷰 영역에 배경을 그린다)
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic 그래픽.
	 */
	draw(graphic) {
		const node = this.getNode();
		if (!node) {
			return;
		}

		//  컨텐트 영역 출력.
		// 투명한 바탕은 그리지 않는다. (보이지 않는 드로우가 묶어 그리기를 끊지 않게)
		const backgroundColor = this.getBackgroundColor();
		if (backgroundColor.alpha <= 0) {
			return;
		}
		const contentSize = node.getContentSize();
		const backgroundRect = Rect.create(0, 0, contentSize.x, contentSize.y);
		graphic.setFillColor(backgroundColor);
		graphic.drawRect(backgroundRect);
	}

	//==============================================================================
	// 터치 누름. (TouchRaycaster → WorldNode)
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } viewInputPosition 누른 자리. (뷰 좌표)
	 */
	touchPress(viewInputPosition) {
	}

	//==============================================================================
	// 터치 이동. (TouchRaycaster → WorldNode)
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } viewInputPosition 옮긴 자리. (뷰 좌표)
	 */
	touchMove(viewInputPosition) {
		// if (this.isDragging()) {
		// 	//
		// }
	}

	//==============================================================================
	// 터치 뗌. (TouchRaycaster → WorldNode)
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } viewInputPosition 뗀 자리. (뷰 좌표)
	 */
	touchRelease(viewInputPosition) {
	}

	//==============================================================================
	// 터치 취소. (TouchRaycaster → WorldNode)
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } viewInputPosition 취소된 때의 자리. (뷰 좌표)
	 */
	touchCancel(viewInputPosition) {
	}

	//==============================================================================
	// 콘텐츠 노드 반환. (자식 노드를 이 노드에 추가하면 스크롤 대상이 됨)
	//==============================================================================
	/**
	 * @returns { WorldNode } 컨텐트 노드. (노드에 붙기 전이면 null)
	 */
	getContent() {
		return this.#content;
	}

	//==============================================================================
	// 배경색 설정. (null 이면 배경을 지운다)
	//==============================================================================
	/**
	 * @param { Color | null } backgroundColor 배경색. (사본을 담는다, 알파가 0 이면 그리지 않는다, null 이나 undefined 면 처음 값인 알파 0 흰색으로 돌려 그리지 않는다)
	 * @example <caption>배경을 칠했다가 지우기</caption>
	 * import { UIView, Color } from "./build/vanilla.js";
	 *
	 * const view = new UIView();
	 * view.setBackgroundColor(new Color(0.1, 0.12, 0.16, 1));
	 * const paintedColor = view.getBackgroundColor();
	 * view.setBackgroundColor(null);
	 * const clearedColor = view.getBackgroundColor();
	 * console.log(paintedColor.alpha, clearedColor.alpha);
	 */
	setBackgroundColor(backgroundColor) {
		if (backgroundColor === null || backgroundColor === undefined) {
			this.#backgroundColor = new Color(1, 1, 1, 0);
			return;
		}
		this.#backgroundColor = backgroundColor.clone();
	}

	//==============================================================================
	// 배경색 반환.
	//==============================================================================
	/**
	 * @returns { Color } 배경색. (기본은 알파가 0 인 흰색)
	 */
	getBackgroundColor() {
		return this.#backgroundColor;
	}
}
