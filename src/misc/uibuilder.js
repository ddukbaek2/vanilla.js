//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { UINode } from "../core/node/uinode.js";
import { Vector2 } from "../base/vector2.js";
import { Engine } from "../core/engine.js";
import { Object } from "../base/object.js";


//==============================================================================
// UI 빌더.
// - 지역 변수 없이 UINode 계층 구조를 선언적으로 구성하는 플루언트 빌더.
// - Unreal Slate / Flutter 위젯과 유사한 구조.
// - Vector2 없이 숫자쌍(x, y)으로 모든 위치/크기를 지정한다.
//
// 사용 예:
//   const panel = UIBuilder.create()
//       .anchorMin(0.5, 0.5)
//       .anchorMax(0.5, 0.5)
//       .sizeDelta(680, 900)
//       .component(ColorComponent, (c) => { c.setColor(new Color(0.1, 0.1, 0.1, 1)); })
//       .children(
//           UIBuilder.create()
//               .sizeDelta(120, 70)
//               .component(LabelComponent, (c) => { c.setText("확인"); })
//       )
//       .build();
//==============================================================================
export class UIBuilder extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { UINode } */ #node;
	/** @private @type { UIBuilder[] } */ #childBuilders;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		
		this.#node = new UINode();
		this.#childBuilders = [];
	}

	//==============================================================================
	// 빌더 인스턴스 생성.
	//==============================================================================
	/**
	 * @returns { UIBuilder }
	 */
	static create() {
		const builder = new UIBuilder();
		return builder;
	}

	//==============================================================================
	// 노드 직접 접근. (빌더에 없는 속성을 설정할 때 사용)
	//==============================================================================
	/**
	 * @param { Function } callback
	 * @returns { UIBuilder }
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
	 * @returns { UIBuilder }
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
	 * @returns { UIBuilder }
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
	 * @returns { UIBuilder }
	 */
	component(componentType, callback) {
		const component = this.#node.addComponent(componentType);
		if (callback) {
			callback(component);
		}
		return this;
	}

	//==============================================================================
	// 자식 빌더 추가.
	// - 가변 인자로 여러 자식 빌더를 한번에 추가할 수 있다.
	//==============================================================================
	/**
	 * @param { ...UIBuilder } builders
	 * @returns { UIBuilder }
	 */
	children(...builders) {
		for (const builder of builders) {
			this.#childBuilders.push(builder);
		}
		return this;
	}

	//==============================================================================
	// 로컬 위치 설정.
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @returns { UIBuilder }
	 */
	localPosition(x, y) {
		this.#node.setLocalPosition(Vector2.create(x, y));
		return this;
	}

	//==============================================================================
	// 피벗 설정.
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @returns { UIBuilder }
	 */
	pivot(x, y) {
		this.#node.setPivot(Vector2.create(x, y));
		return this;
	}

	//==============================================================================
	// 콘텐츠 크기 설정.
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @returns { UIBuilder }
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
	 * @returns { UIBuilder }
	 */
	localScale(x, y) {
		this.#node.setLocalScale(Vector2.create(x, y));
		return this;
	}

	//==============================================================================
	// 앵커 최소값 설정.
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @returns { UIBuilder }
	 */
	anchorMin(x, y) {
		this.#node.setAnchorMin(Vector2.create(x, y));
		return this;
	}

	//==============================================================================
	// 앵커 최대값 설정.
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @returns { UIBuilder }
	 */
	anchorMax(x, y) {
		this.#node.setAnchorMax(Vector2.create(x, y));
		return this;
	}

	//==============================================================================
	// 앵커 기준 위치 오프셋 설정.
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @returns { UIBuilder }
	 */
	anchoredPosition(x, y) {
		this.#node.setAnchoredPosition(Vector2.create(x, y));
		return this;
	}

	//==============================================================================
	// 오프셋 크기 설정.
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @returns { UIBuilder }
	 */
	sizeDelta(x, y) {
		this.#node.setSizeDelta(Vector2.create(x, y));
		return this;
	}

	//==============================================================================
	// 마스크 활성화 설정.
	//==============================================================================
	/**
	 * @param { boolean } enabled
	 * @returns { UIBuilder }
	 */
	maskEnabled(enabled) {
		this.#node.setMaskEnabled(enabled);
		return this;
	}

	//==============================================================================
	// 이벤트 체이닝 활성화 설정.
	//==============================================================================
	/**
	 * @param { boolean } enabled
	 * @returns { UIBuilder }
	 */
	eventChainEnabled(enabled) {
		this.#node.setEventChainEnabled(enabled);
		return this;
	}

	//==============================================================================
	// 엔진 설정.
	//==============================================================================
	/**
	 * @param { Engine } engine
	 * @returns { UIBuilder }
	 */
	engine(engine) {
		this.#node.setEngine(engine);
		return this;
	}

	//==============================================================================
	// 빌드.
	// - 자식 빌더를 모두 재귀적으로 빌드한다.
	// - parent가 제공된 경우 자신을 parent에 자식으로 추가한다.
	// - 완성된 UINode를 반환한다.
	//==============================================================================
	/**
	 * @param { UINode } [parent]
	 * @returns { UINode }
	 */
	build(parent) {
		for (const childBuilder of this.#childBuilders) {
			childBuilder.build(this.#node);
		}
		if (parent) {
			parent.addChild(this.#node);
		}
		return this.#node;
	}
}
