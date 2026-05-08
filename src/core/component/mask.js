//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Rect } from "../../base/rect.js";
import { Component } from "../component.js";
import { Graphic } from "../graphic.js";


//==============================================================================
// 마스크 컴포넌트.
// - 부착된 노드의 contentSize 영역으로 자식 노드들의 그리기를 클리핑한다.
// - 실제 begin/end 호출은 노드의 draw 가 자식 그리기 직전/직후에 한다.
//   (draw() 자체는 컴포넌트 출력 단계에서 호출되지만 아무것도 하지 않는다.)
//==============================================================================
export class Mask extends Component {
	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setComponentType("Mask");
	}

	//==============================================================================
	// 클리핑 시작. (노드의 draw 가 자식 그리기 직전에 호출)
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 */
	beginClip(graphic) {
		const node = this.getNode();
		if (!node) {
			return;
		}
		if (typeof node.getContentSize !== "function") {
			return;
		}
		const contentSize = node.getContentSize();
		const clipRect = Rect.create(0, 0, contentSize.x, contentSize.y);
		graphic.beginClipRect(clipRect);
	}

	//==============================================================================
	// 클리핑 종료. (노드의 draw 가 자식 그리기 직후에 호출)
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 */
	endClip(graphic) {
		graphic.endClipRect();
	}
}
