//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Color } from "../../base/color.js";
import { Rect } from "../../base/rect.js";
import { Graphic } from "../../core/graphic.js";
import { UIComponent } from "./uicomponent.js";


//==============================================================================
// 뷰 컴포넌트.
// - ScrollViewComponent, SnapScrollViewComponent 등 모든 뷰 컴포넌트의 기반 클래스.
// - 타입으로 하위 뷰 컴포넌트를 한번에 조회할 수 있다.
//   예: node.getComponent(ViewComponent)
//==============================================================================
export class ViewComponent extends UIComponent {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Color } */ #backgroundColor;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();

		this.#backgroundColor = new Color(1, 1, 1, 1);
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

		// 출력.
		const contentSize = node.getContentSize();
		const backgroundColor = this.getBackgroundColor();
		const backgroundRect = Rect.create(0, 0, contentSize.x, contentSize.y);
		graphic.setFillColor(backgroundColor);
		graphic.drawRect(backgroundRect);
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
