//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { WorldNode } from "../core/node/worldnode.js";
import { Vector2 } from "../base/vector2.js";
import { Object } from "../base/object.js";
import { Mask } from "../core/component/mask.js";


//==============================================================================
// 노드 레이아웃.
// - 지역 변수 없이 노드 계층 구조를 선언적으로 구성하는 플루언트 빌더.
// - Unreal Slate / Flutter 위젯과 유사한 구조.
// - Vector2 없이 숫자쌍(x, y)으로 모든 위치/크기를 지정한다.
// - create(nodeClass)로 노드 타입을 지정한다. (기본값: WorldNode)
//
// 사용 예:
//   const panel = NodeLayout.create(WorldNode)
//       .pivot(Pivot.middleCenter)
//       .contentSize(680, 900)
//       .component(Paint, (c) => { c.setColor(new Color(0.1, 0.1, 0.1, 1)); })
//       .children(
//           NodeLayout.create(WorldNode)
//               .contentSize(120, 70)
//               .component(Text, (c) => { c.setText("확인"); })
//       )
//       .build();
//==============================================================================
export class NodeLayout extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { * } */ #node;
	/** @private @type { NodeLayout[] } */ #childLayouts;
	/** @private @type { * } */ #parentNode;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { Function } [nodeClass]
	 */
	constructor(nodeClass) {
		super();
		const NodeClass = nodeClass ?? WorldNode;
		this.#node = new NodeClass();
		this.#childLayouts = [];
		this.#parentNode = null;
	}

	//==============================================================================
	// 레이아웃 인스턴스 생성.
	//==============================================================================
	/**
	 * @param { Function } [nodeClass]
	 * @returns { NodeLayout }
	 */
	static create(nodeClass) {
		const nodeLayout = new NodeLayout(nodeClass);
		return nodeLayout;
	}

	//==============================================================================
	// 노드 직접 접근. (빌더에 없는 속성을 설정할 때 사용)
	//==============================================================================
	/**
	 * @param { Function } callback
	 * @returns { NodeLayout }
	 */
	apply(callback) {
		callback(this.#node);
		return this;
	}

	//==============================================================================
	// 활성화 설정.
	//==============================================================================
	/**
	 * @param { boolean } active
	 * @returns { NodeLayout }
	 */
	active(active) {
		this.#node.setActive(active);
		return this;
	}

	//==============================================================================
	// 이름 설정.
	//==============================================================================
	/**
	 * @param { string } name
	 * @returns { NodeLayout }
	 */
	name(name) {
		this.#node.setName(name);
		return this;
	}

	//==============================================================================
	// 컴포넌트 추가 및 설정.
	// - callback이 없으면 컴포넌트만 추가한다.
	//==============================================================================
	/**
	 * @param { Function } componentType
	 * @param { Function } [callback]
	 * @returns { NodeLayout }
	 */
	component(componentType, callback) {
		const component = this.#node.addComponent(componentType);
		if (callback) {
			callback(component);
		}
		return this;
	}

	//==============================================================================
	// 자식 레이아웃 추가.
	// - 가변 인자로 여러 자식 레이아웃을 한번에 추가할 수 있다.
	//==============================================================================
	/**
	 * @param { ...NodeLayout } layouts
	 * @returns { NodeLayout }
	 */
	children(...layouts) {
		for (const layout of layouts) {
			this.#childLayouts.push(layout);
		}
		return this;
	}

	//==============================================================================
	// 로컬 위치 설정.
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @returns { NodeLayout }
	 */
	localPosition(x, y) {
		this.#node.setLocalPosition(Vector2.create(x, y));
		return this;
	}

	//==============================================================================
	// 피벗 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } pivot
	 * @returns { NodeLayout }
	 */
	pivot(pivot) {
		this.#node.setPivot(pivot);
		return this;
	}

	//==============================================================================
	// 콘텐츠 크기 설정.
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @returns { NodeLayout }
	 */
	contentSize(x, y) {
		this.#node.setContentSize(Vector2.create(x, y));
		return this;
	}

	//==============================================================================
	// 로컬 스케일 설정.
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @returns { NodeLayout }
	 */
	localScale(x, y) {
		this.#node.setLocalScale(Vector2.create(x, y));
		return this;
	}

	//==============================================================================
	// 부모 노드 설정. (build()에 인자 없이 호출 시 이 부모에 자식으로 추가된다.)
	//==============================================================================
	/**
	 * @param { * } parentNode
	 * @returns { NodeLayout }
	 */
	parent(parentNode) {
		this.#parentNode = parentNode;
		return this;
	}

	//==============================================================================
	// 단일 앵커 설정. (WorldNode.setAnchor)
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @returns { NodeLayout }
	 */
	anchor(x, y) {
		this.#node.setAnchor(Vector2.create(x, y));
		return this;
	}

	//==============================================================================
	// 앵커 기준 위치 오프셋 설정.
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @returns { NodeLayout }
	 */
	anchoredPosition(x, y) {
		this.#node.setAnchoredPosition(Vector2.create(x, y));
		return this;
	}

	//==============================================================================
	// 마스크 활성화 설정.
	//==============================================================================
	/**
	 * @param { boolean } enabled
	 * @returns { NodeLayout }
	 */
	maskEnabled(enabled) {
		if (enabled) {
			this.#node.getOrAddComponent(Mask);
		}
		else {
			const maskComponent = this.#node.getComponent(Mask);
			if (maskComponent) {
				this.#node.removeComponent(maskComponent);
			}
		}
		return this;
	}

	//==============================================================================
	// 빌드.
	// - 자식 레이아웃을 모두 재귀적으로 빌드한다.
	// - parent 인자가 제공되면 그 부모에 자식으로 추가한다.
	// - parent 인자가 없고 parent() 메서드로 지정된 부모가 있으면 그 부모에 자식으로 추가한다.
	// - 완성된 노드를 반환한다.
	//==============================================================================
	/**
	 * @param { * } [parent]
	 * @returns { * }
	 */
	build(parent) {
		for (const childLayout of this.#childLayouts) {
			childLayout.build(this.#node);
		}
		const targetParent = parent ?? this.#parentNode;
		if (targetParent) {
			targetParent.addChild(this.#node);
		}
		return this.#node;
	}
}
