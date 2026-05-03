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
import { AnchoredWorldNode } from "../core/node/anchoredworldmnode.js";


//==============================================================================
// 뷰 컴포넌트.
// - ScrollView, SnapScrollView 등 모든 뷰 컴포넌트의 기반 클래스.
// - 타입으로 하위 뷰 컴포넌트를 한번에 조회할 수 있다.
//   예: node.getComponent(View)
// - 컨테이너 역할을 하므로 UIControl 을 상속하지 않고 Component 직접 상속.
//   대신 UIControl 이 갖던 setEngine/getEngine 를 자체적으로 보유한다.
//==============================================================================
export class UIView extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Engine } */ #engine;
	/** @private @type { AnchoredWorldNode | null } */ #content; // 컨텐트 노드.
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
		this.#backgroundColor = new Color(1, 1, 1, 1);
	}

	//==============================================================================
	// 엔진 설정. (구 UIComponent 에서 이관)
	//==============================================================================
	/**
	 * @param { Engine } engine
	 */
	setEngine(engine) {
		this.#engine = engine;
	}

	//==============================================================================
	// 엔진 반환. (구 UIComponent 에서 이관)
	//==============================================================================
	/**
	 * @returns { Engine | null }
	 */
	getEngine() {
		return this.#engine;
	}

	//==============================================================================
	// 노드에 붙음.
	//==============================================================================
	/**
	 * @override
	 * @param { ComponentNode } node
	 */
	attach(node) {
		super.attach(node);

		// 컨텐트 노드 추가.
		this.#content = new AnchoredWorldNode();
		this.#content.setName("content");
		this.#content.setAnchorMin(Vector2.zero());
		this.#content.setAnchorMax(Vector2.zero());
		this.#content.setPivot(Pivot.topLeft);
		this.#content.setAnchoredPosition(Vector2.zero());
		const content = this.getContent();
		node.addChild(content);

		if (node instanceof AnchoredWorldNode) {
			node.setMaskEnabled(true);
		}
	}

	//==============================================================================
	// 노드에서 떨어짐.
	//==============================================================================
	/**
	 * @override
	 * @param { ComponentNode } node
	 */
	detach(node) {
		super.detach(node);
	}

	//==============================================================================
	// 출력. (배경색이 설정된 경우 스크롤뷰 영역에 배경을 그린다)
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic
	 */
	draw(graphic) {
		const node = this.getNode();
		if (!node) {
			return;
		}

		//  컨텐트 영역 출력.
		const contentSize = node.getContentSize();
		const backgroundColor = this.getBackgroundColor();
		const backgroundRect = Rect.create(0, 0, contentSize.x, contentSize.y);
		graphic.setFillColor(backgroundColor);
		graphic.drawRect(backgroundRect);
	}

	//==============================================================================
	// 터치 누름. (TouchRaycaster → AnchoredWorldNode)
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } viewInputPosition
	 */
	touchPress(viewInputPosition) {
	}

	//==============================================================================
	// 터치 이동. (TouchRaycaster → AnchoredWorldNode)
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } viewInputPosition
	 */
	touchMove(viewInputPosition) {
		// if (this.isDragging()) {
		// 	//
		// }
	}

	//==============================================================================
	// 터치 뗌. (TouchRaycaster → AnchoredWorldNode)
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } viewInputPosition
	 */
	touchRelease(viewInputPosition) {
	}

	//==============================================================================
	// 터치 취소. (TouchRaycaster → AnchoredWorldNode)
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } viewInputPosition
	 */
	touchCancel(viewInputPosition) {
	}

	//==============================================================================
	// 콘텐츠 노드 반환. (자식 노드를 이 노드에 추가하면 스크롤 대상이 됨)
	//==============================================================================
	/**
	 * @returns { AnchoredWorldNode }
	 */
	getContent() {
		return this.#content;
	}

	//==============================================================================
	// 배경색 설정.
	//==============================================================================
	/**
	 * @param { Color | null } backgroundColor
	 */
	setBackgroundColor(backgroundColor) {
		this.#backgroundColor = backgroundColor.clone();
	}

	//==============================================================================
	// 배경색 반환.
	//==============================================================================
	/**
	 * @returns { Color }
	 */
	getBackgroundColor() {
		return this.#backgroundColor;
	}
}
