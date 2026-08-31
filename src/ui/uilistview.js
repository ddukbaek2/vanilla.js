//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../base/vector2.js";
import { Component } from "../core/component.js";
import { UIScrollView } from "./uiscrollview.js";
import { UIDocument } from "./uidocument.js";


//==============================================================================
// 재활용 리스트 뷰.
// - 템플릿 노드 하나와 항목 수만 받아, 화면에 보이는 범위만 실제 노드로 만들고
//   벗어난 노드는 회수해 다시 쓴다. 수백 ~ 수천 건도 노드 수는 화면 분량에 머문다.
// - UIScrollView 와 같은 노드에 붙는다. (require 로 자동 부착)
//   항목 내용은 setBindItemEvent 로 코드에서 채운다. (데이터 주도)
// - 끝 근처에 닿으면 setReachEndEvent 알림을 한 번 보낸다. (무한 스크롤 / 더 불러오기)
//   setItemCount 로 항목 수가 늘어나면 알림이 다시 무장된다.
// - 사용:
//     const listView = scrollNode.addComponent(UIListView);
//     listView.setTemplateNode(templateNode);
//     listView.setBindItemEvent((itemNode, itemIndex) => { ... });
//     listView.setItemCount(500);
//     listView.setReachEndEvent(() => { ... });
//==============================================================================
export class UIListView extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object | null } */ #templateData; // 직렬화된 템플릿.
	/** @private @type { number } */ #itemCount;
	/** @private @type { number } */ #itemSize; // 진행 축 방향 항목 크기.
	/** @private @type { number } */ #spacing;
	/** @private @type { boolean } */ #isHorizontal;
	/** @private @type { number } */ #bufferItemCount; // 화면 밖 여유 항목 수.
	/** @private @type { Function | null } */ #bindItemEvent; // (itemNode, itemIndex)
	/** @private @type { Function | null } */ #reachEndEvent;
	/** @private @type { number } */ #reachEndThreshold; // 끝에서 이 거리 안이면 알림. (픽셀)
	/** @private @type { boolean } */ #isReachEndArmed;
	/** @private @type { System.Map } */ #activeItemMap; // index → node
	/** @private @type { import("../core/node/worldnode.js").WorldNode[] } */ #freeItemList;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.#templateData = null;
		this.#itemCount = 0;
		this.#itemSize = 0;
		this.#spacing = 0;
		this.#isHorizontal = false;
		this.#bufferItemCount = 1;
		this.#bindItemEvent = null;
		this.#reachEndEvent = null;
		this.#reachEndThreshold = 120;
		this.#isReachEndArmed = true;
		this.#activeItemMap = new System.Map();
		this.#freeItemList = [];
	}

	//==============================================================================
	// 의존 컴포넌트.
	//==============================================================================
	/**
	 * @override
	 * @returns { Function[] }
	 */
	require() {
		return [UIScrollView];
	}

	//==============================================================================
	// 템플릿 설정.
	// - 노드를 직렬화해 두고 필요할 때 복제한다. 원본은 감춘다.
	//   항목 크기는 템플릿의 contentSize 진행 축 값에서 읽는다.
	//==============================================================================
	/**
	 * @param { import("../core/node/worldnode.js").WorldNode } templateNode
	 */
	setTemplateNode(templateNode) {
		this.#templateData = UIDocument.serializeNode(templateNode);
		this.#templateData.active = true;
		templateNode.setActive(false);
		const templateSize = templateNode.getContentSize();
		if (this.#itemSize <= 0) {
			this.#itemSize = this.#isHorizontal ? templateSize.x : templateSize.y;
		}
	}

	//==============================================================================
	// 항목 수 설정. (스크롤 영역 갱신 + 끝 알림 재무장)
	//==============================================================================
	/**
	 * @param { number } itemCount
	 */
	setItemCount(itemCount) {
		const previousItemCount = this.#itemCount;
		this.#itemCount = System.Math.max(0, itemCount);
		if (this.#itemCount > previousItemCount) {
			this.#isReachEndArmed = true;
		}
		this.updateScrollContentSize();
		this.refresh();
	}

	//==============================================================================
	// 갱신. (보이는 범위 계산 → 회수 / 생성)
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		if (!this.#templateData) {
			return;
		}
		const scrollView = this.findScrollView();
		if (!scrollView) {
			return;
		}
		const node = this.getNode();
		const contentSize = node.getContentSize();
		const scrollOffset = scrollView.getScrollOffset();
		const viewLength = this.#isHorizontal ? contentSize.x : contentSize.y;
		const scrolled = this.#isHorizontal ? -scrollOffset.x : -scrollOffset.y;
		const pitch = this.#itemSize + this.#spacing;
		if (pitch <= 0) {
			return;
		}

		// 보이는 범위. (버퍼 포함)
		let firstIndex = System.Math.floor(scrolled / pitch) - this.#bufferItemCount;
		let lastIndex = System.Math.ceil((scrolled + viewLength) / pitch) + this.#bufferItemCount - 1;
		firstIndex = System.Math.max(0, firstIndex);
		lastIndex = System.Math.min(this.#itemCount - 1, lastIndex);

		// 범위를 벗어난 항목 회수.
		for (const [itemIndex, itemNode] of [...this.#activeItemMap]) {
			if (itemIndex < firstIndex || itemIndex > lastIndex) {
				itemNode.setActive(false);
				this.#activeItemMap.delete(itemIndex);
				this.#freeItemList.push(itemNode);
			}
		}

		// 빠진 항목 생성 / 재사용.
		for (let itemIndex = firstIndex; itemIndex <= lastIndex; ++itemIndex) {
			if (this.#activeItemMap.has(itemIndex)) {
				continue;
			}
			const itemNode = this.acquireItemNode(scrollView);
			itemNode.setName("Item" + itemIndex);
			itemNode.setActive(true);
			const itemPosition = this.#isHorizontal
				? Vector2.create(itemIndex * pitch, 0)
				: Vector2.create(0, itemIndex * pitch);
			itemNode.setLocalPosition(itemPosition);
			this.#activeItemMap.set(itemIndex, itemNode);
			if (this.#bindItemEvent) {
				this.#bindItemEvent(itemNode, itemIndex);
			}
		}

		// 끝 근처 알림. (무한 스크롤)
		if (this.#reachEndEvent && this.#isReachEndArmed && this.#itemCount > 0) {
			const totalLength = this.#itemCount * pitch - this.#spacing;
			const remainLength = totalLength - (scrolled + viewLength);
			if (remainLength <= this.#reachEndThreshold) {
				this.#isReachEndArmed = false;
				this.#reachEndEvent();
			}
		}
	}

	//==============================================================================
	// 항목 노드 확보. (회수분 재사용, 없으면 템플릿 복제)
	//==============================================================================
	/**
	 * @private
	 * @param { UIScrollView } scrollView
	 * @returns { import("../core/node/worldnode.js").WorldNode }
	 */
	acquireItemNode(scrollView) {
		const freeItemNode = this.#freeItemList.pop();
		if (freeItemNode) {
			return freeItemNode;
		}
		const itemNode = UIDocument.deserializeNode(this.#templateData);
		const contentNode = scrollView.getContent();
		if (contentNode) {
			contentNode.addChild(itemNode);
		}
		else {
			this.getNode().addChild(itemNode);
		}
		return itemNode;
	}

	//==============================================================================
	// 보이는 항목 전부 다시 바인딩. (데이터 내용이 바뀌었을 때)
	//==============================================================================
	refresh() {
		if (!this.#bindItemEvent) {
			return;
		}
		for (const [itemIndex, itemNode] of this.#activeItemMap) {
			if (itemIndex >= this.#itemCount) {
				continue;
			}
			this.#bindItemEvent(itemNode, itemIndex);
		}
	}

	//==============================================================================
	// 스크롤 영역 갱신.
	//==============================================================================
	/**
	 * @private
	 */
	updateScrollContentSize() {
		const scrollView = this.findScrollView();
		if (!scrollView) {
			return;
		}
		const pitch = this.#itemSize + this.#spacing;
		const totalLength = (this.#itemCount > 0) ? (this.#itemCount * pitch - this.#spacing) : 0;
		const node = this.getNode();
		const contentSize = node.getContentSize();
		const scrollContentSize = this.#isHorizontal
			? Vector2.create(totalLength, contentSize.y)
			: Vector2.create(contentSize.x, totalLength);
		scrollView.setScrollContentSize(scrollContentSize);
	}

	//==============================================================================
	// 같은 노드의 스크롤 뷰 반환.
	//==============================================================================
	/**
	 * @private
	 * @returns { UIScrollView | null }
	 */
	findScrollView() {
		const node = this.getNode();
		if (!node) {
			return null;
		}
		const scrollViewComponents = node.getComponents(UIScrollView);
		return (scrollViewComponents.length > 0) ? scrollViewComponents[0] : null;
	}

	//==============================================================================
	// 특정 항목의 실제 노드 반환. (화면 밖이면 null)
	//==============================================================================
	/**
	 * @param { number } itemIndex
	 * @returns { import("../core/node/worldnode.js").WorldNode | null }
	 */
	getItemNode(itemIndex) {
		const itemNode = this.#activeItemMap.get(itemIndex);
		return itemNode ? itemNode : null;
	}

	//==============================================================================
	// 설정 메서드 목록.
	//==============================================================================
	/** @param { Function } bindItemEvent (itemNode, itemIndex) */
	setBindItemEvent(bindItemEvent) {
		this.#bindItemEvent = bindItemEvent;
	}

	/** @param { Function } reachEndEvent */
	setReachEndEvent(reachEndEvent) {
		this.#reachEndEvent = reachEndEvent;
	}

	/** @param { number } reachEndThreshold 픽셀. */
	setReachEndThreshold(reachEndThreshold) {
		this.#reachEndThreshold = reachEndThreshold;
	}

	/** @param { number } itemSize 진행 축 방향 항목 크기. */
	setItemSize(itemSize) {
		this.#itemSize = itemSize;
		this.updateScrollContentSize();
	}

	/** @param { number } spacing 항목 사이 간격. */
	setSpacing(spacing) {
		this.#spacing = spacing;
		this.updateScrollContentSize();
	}

	/** @param { boolean } isHorizontal 가로 진행 여부. (기본 세로) */
	setHorizontal(isHorizontal) {
		this.#isHorizontal = isHorizontal;
	}

	/** @param { number } bufferItemCount 화면 밖 여유 항목 수. */
	setBufferItemCount(bufferItemCount) {
		this.#bufferItemCount = System.Math.max(0, bufferItemCount);
	}

	//==============================================================================
	// 조회 메서드 목록.
	//==============================================================================
	/** @returns { number } */
	getItemCount() {
		return this.#itemCount;
	}

	/** @returns { number } */
	getItemSize() {
		return this.#itemSize;
	}

	/** @returns { number } */
	getSpacing() {
		return this.#spacing;
	}

	/** @returns { number } */
	getActiveItemCount() {
		return this.#activeItemMap.size;
	}
}
