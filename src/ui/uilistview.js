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
// - 템플릿 대신 항목 노드를 만드는 함수(setCreateItemEvent)를 줄 수도 있다. 항목 크기를 정하지 않았으면 처음 만든 항목의 크기를 읽는다.
// - 사용:
//     const listView = scrollNode.addComponent(UIListView);
//     listView.setTemplateNode(templateNode);
//     listView.setBindItemEvent((itemNode, itemIndex) => { ... });
//     listView.setItemCount(500);
//     listView.setReachEndEvent(() => { ... });
//==============================================================================
/**
 * @example <caption>500 줄 목록을 템플릿 하나로 보이기</caption>
 * import { Engine, EngineConfiguration, UIScene, UIListView, UILabel, WorldNode, Paint, Color, Pivot, Vector2 } from "./build/vanilla.js";
 *
 * class ListScene extends UIScene {
 * 	create() {
 * 		super.create();
 * 		const listNode = new WorldNode();
 * 		listNode.setPivot(Pivot.topLeft.clone());
 * 		listNode.setAnchor(Pivot.topLeft.clone());
 * 		listNode.setContentSize(Vector2.create(320, 240));
 * 		listNode.setLocalPosition(Vector2.create(160, 60));
 *
 * 		const templateNode = new WorldNode();
 * 		templateNode.setPivot(Pivot.topLeft.clone());
 * 		templateNode.setAnchor(Pivot.topLeft.clone());
 * 		templateNode.setContentSize(Vector2.create(320, 36));
 * 		const rowPaint = templateNode.addComponent(Paint);
 * 		rowPaint.setColor(new Color(1, 1, 1, 0.08));
 * 		const rowLabel = templateNode.addComponent(UILabel);
 * 		rowLabel.setFontSize(16);
 * 		listNode.addChild(templateNode);
 *
 * 		const listView = listNode.addComponent(UIListView);
 * 		listView.setTemplateNode(templateNode);
 * 		listView.setSpacing(4);
 * 		listView.setBindItemEvent((itemNode, itemIndex) => {
 * 			const itemLabel = itemNode.getComponent(UILabel);
 * 			itemLabel.setText("Row " + itemIndex);
 * 		});
 * 		listView.setItemCount(500);
 * 		listView.setReachEndEvent(() => {
 * 			const itemCount = listView.getItemCount();
 * 			listView.setItemCount(itemCount + 100);
 * 		});
 * 		const root = this.getRoot();
 * 		root.addChild(listNode);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * const scene = new ListScene();
 * scene.setLoadingMinDurationMs(0);
 * engine.run(scene);
 */
export class UIListView extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object | null } */ #templateData; // 직렬화된 템플릿.
	/** @private @type { UIDocument | null } */ #templateDocument; // 템플릿을 쓰고 읽는 문서. (항목을 만들 때마다 이 문서로 읽는다)
	/** @private @type { Function | null } */ #createItemEvent; // () => WorldNode, 템플릿 대신 항목 노드를 만든다.
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
		this.setComponentType("UIListView");
		this.#templateData = null;
		this.#templateDocument = null;
		this.#createItemEvent = null;
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
	 * @returns { Function[] } 같은 노드에 함께 붙어야 하는 컴포넌트. (UIScrollView, 없으면 addComponent 가 먼저 붙인다)
	 */
	require() {
		return [UIScrollView];
	}

	//==============================================================================
	// 템플릿 설정.
	// - 노드를 직렬화해 두고 필요할 때 복제한다. 원본은 감춘다.
	//   항목 크기는 템플릿의 contentSize 진행 축 값에서 읽는다.
	// - 엔진 기본 종류만 등록한 새 UIDocument 로 복제한다. 게임 컴포넌트가 든 템플릿은 setTemplateNodeWithDocument 를 쓴다.
	//==============================================================================
	/**
	 * @param { import("../core/node/worldnode.js").WorldNode } templateNode 항목의 본이 될 노드. (UIDocument 로 직렬화해 쥐고 이 노드는 끈다, 항목 크기를 정하지 않았으면 이 노드의 contentSize 진행 축 값을 쓴다, 앞서 준 만들기 함수는 지운다)
	 */
	setTemplateNode(templateNode) {
		this.setTemplateNodeWithDocument(templateNode, new UIDocument());
	}

	//==============================================================================
	// 템플릿 설정. (게임 컴포넌트를 등록한 UIDocument 로 직렬화하고 복제한다)
	//==============================================================================
	/**
	 * @param { import("../core/node/worldnode.js").WorldNode } templateNode 항목의 본이 될 노드. (setTemplateNode 와 같다)
	 * @param { UIDocument } uiDocument 템플릿을 쓰고 읽을 문서. (템플릿의 컴포넌트 종류를 등록해 둔 것, 항목을 만들 때마다 이 문서로 읽는다)
	 * @example <caption>게임 컴포넌트가 든 템플릿으로 목록 짓기</caption>
	 * import { UIDocument, UIListView, WorldNode, Component, Vector2 } from "./build/vanilla.js";
	 *
	 * class Badge extends Component {
	 * }
	 *
	 * const uiDocument = new UIDocument();
	 * uiDocument.registerComponentType("Badge", Badge);
	 * const listNode = new WorldNode();
	 * listNode.setContentSize(Vector2.create(200, 300));
	 * const listView = listNode.addComponent(UIListView);
	 * const templateNode = new WorldNode();
	 * templateNode.setContentSize(Vector2.create(200, 40));
	 * templateNode.addComponent(Badge);
	 * listView.setTemplateNodeWithDocument(templateNode, uiDocument);
	 * console.log(templateNode.isActive(), listView.getItemSize());
	 */
	setTemplateNodeWithDocument(templateNode, uiDocument) {
		this.#createItemEvent = null;
		this.#templateDocument = uiDocument;
		this.#templateData = uiDocument.serializeNode(templateNode);
		this.#templateData.active = true;
		templateNode.setActive(false);
		const templateSize = templateNode.getContentSize();
		if (this.#itemSize <= 0) {
			this.#itemSize = this.#isHorizontal ? templateSize.x : templateSize.y;
		}
	}
	//==============================================================================
	// 항목 노드 만들기 함수 설정. (템플릿 대신, () => WorldNode. 만든 노드는 content 노드의 자식으로 붙인다)
	//==============================================================================
	/**
	 * @param { Function | null } createItemEvent 항목 노드를 만들어 돌려줄 함수. (() => WorldNode, 함수를 주면 앞서 준 템플릿을 버리고, null 이면 만들기 함수를 지운다)
	 * @example <caption>만들기 함수로 보이는 줄만 노드 만들기</caption>
	 * import { UIListView, UIScrollView, WorldNode, Pivot, Vector2 } from "./build/vanilla.js";
	 *
	 * const listNode = new WorldNode();
	 * listNode.setContentSize(Vector2.create(200, 100));
	 * const listView = listNode.addComponent(UIListView);
	 * listView.setCreateItemEvent(() => {
	 * 	const itemNode = new WorldNode();
	 * 	itemNode.setPivot(Pivot.topLeft.clone());
	 * 	itemNode.setAnchor(Pivot.topLeft.clone());
	 * 	itemNode.setContentSize(Vector2.create(200, 20));
	 * 	return itemNode;
	 * });
	 * listView.setItemCount(100);
	 * listView.tick(0);
	 * console.log(listView.getItemSize(), listView.getActiveItemCount());
	 * const scrollView = listNode.getComponent(UIScrollView);
	 * scrollView.setScrollOffset(Vector2.create(0, -500));
	 * listView.tick(0);
	 * console.log(listView.getItemNode(0), listView.getItemNode(25) !== null);
	 */
	setCreateItemEvent(createItemEvent) {
		this.#createItemEvent = createItemEvent;
		if (createItemEvent !== null) {
			this.#templateData = null;
		}
	}


	//==============================================================================
	// 항목 수 설정. (스크롤 영역 갱신 + 끝 알림 재무장)
	//==============================================================================
	/**
	 * @param { number } itemCount 항목 수. (0 보다 작으면 0, 늘어나면 끝 알림을 다시 무장하고, 스크롤 영역을 다시 재고 보이는 항목을 다시 바인딩한다)
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
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초, 쓰지 않는다)
	 */
	tick(timeDelta) {
		if (!this.#templateData && !this.#createItemEvent) {
			return;
		}
		const scrollView = this.findScrollView();
		if (!scrollView) {
			return;
		}
		// 항목 크기를 정하지 않았으면 처음 만든 항목 노드의 크기를 읽는다. (그 노드는 회수 목록에 넣어 다시 쓴다)
		if (this.#itemSize <= 0) {
			const measuredItemNode = this.acquireItemNode(scrollView);
			if (!measuredItemNode) {
				return;
			}
			const measuredSize = measuredItemNode.getContentSize();
			measuredItemNode.setActive(false);
			this.#itemSize = this.#isHorizontal ? measuredSize.x : measuredSize.y;
			this.#freeItemList.push(measuredItemNode);
			this.updateScrollContentSize();
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
		const itemNode = (this.#createItemEvent !== null) ? this.#createItemEvent() : this.#templateDocument.deserializeNode(this.#templateData);
		if (!itemNode) {
			return null;
		}
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
	 * @param { number } itemIndex 항목 순서. (0 부터)
	 * @returns { import("../core/node/worldnode.js").WorldNode | null } 그 항목을 보이는 노드. (보이는 범위와 여유 항목 밖이라 노드가 없으면 null, 노드는 범위를 벗어나면 다른 항목에 다시 쓰인다)
	 */
	getItemNode(itemIndex) {
		const itemNode = this.#activeItemMap.get(itemIndex);
		return itemNode ? itemNode : null;
	}

	//==============================================================================
	// 설정 메서드 목록.
	//==============================================================================

	//==============================================================================
	// 항목 바인딩 함수 설정.
	//==============================================================================
	/** @param { Function } bindItemEvent 항목 노드에 내용을 채울 함수. ((itemNode, itemIndex) => void, 노드를 그 항목에 새로 꺼내 쓸 때와 refresh, setItemCount 때 부른다) */
	setBindItemEvent(bindItemEvent) {
		this.#bindItemEvent = bindItemEvent;
	}

	//==============================================================================
	// 끝 알림 함수 설정. (무한 스크롤, 더 불러오기)
	//==============================================================================
	/**
	 * @param { Function } reachEndEvent 남은 길이가 setReachEndThreshold 안에 들면 한 번 부를 함수. (() => void, setItemCount 로 항목이 늘면 다시 부를 수 있다)
	 * @example <caption>끝에 닿으면 다음 20 개 붙이기</caption>
	 * import { UIListView, UIScrollView, WorldNode, Pivot, Vector2 } from "./build/vanilla.js";
	 *
	 * const listNode = new WorldNode();
	 * listNode.setContentSize(Vector2.create(200, 100));
	 * const listView = listNode.addComponent(UIListView);
	 * listView.setItemSize(20);
	 * listView.setCreateItemEvent(() => {
	 * 	const itemNode = new WorldNode();
	 * 	itemNode.setPivot(Pivot.topLeft.clone());
	 * 	itemNode.setAnchor(Pivot.topLeft.clone());
	 * 	itemNode.setContentSize(Vector2.create(200, 20));
	 * 	return itemNode;
	 * });
	 * let reachEndCount = 0;
	 * listView.setReachEndEvent(() => {
	 * 	reachEndCount += 1;
	 * 	const itemCount = listView.getItemCount();
	 * 	listView.setItemCount(itemCount + 20);
	 * });
	 * listView.setReachEndThreshold(40);
	 * listView.setItemCount(20);
	 * listView.tick(0);
	 * console.log(reachEndCount, listView.getItemCount());
	 * const scrollView = listNode.getComponent(UIScrollView);
	 * scrollView.setScrollOffset(Vector2.create(0, -280));
	 * listView.tick(0);
	 * console.log(reachEndCount, listView.getItemCount());
	 */
	setReachEndEvent(reachEndEvent) {
		this.#reachEndEvent = reachEndEvent;
	}

	//==============================================================================
	// 끝 알림 거리 설정.
	//==============================================================================
	/** @param { number } reachEndThreshold 끝에서 이 길이 안에 들면 알린다. (픽셀, 기본 120) */
	setReachEndThreshold(reachEndThreshold) {
		this.#reachEndThreshold = reachEndThreshold;
	}

	//==============================================================================
	// 항목 크기 설정.
	//==============================================================================
	/** @param { number } itemSize 진행 축 방향 항목 크기. (픽셀, 0 이하면 템플릿이나 처음 만든 항목의 크기를 읽는다, 스크롤 영역을 다시 잰다) */
	setItemSize(itemSize) {
		this.#itemSize = itemSize;
		this.updateScrollContentSize();
	}

	//==============================================================================
	// 항목 간격 설정.
	//==============================================================================
	/** @param { number } spacing 항목 사이 간격. (픽셀, 기본 0, 스크롤 영역을 다시 잰다) */
	setSpacing(spacing) {
		this.#spacing = spacing;
		this.updateScrollContentSize();
	}

	//==============================================================================
	// 진행 방향 설정.
	//==============================================================================
	/** @param { boolean } isHorizontal 참이면 항목을 가로로 늘어놓는다. (기본 세로, 바뀌면 스크롤 영역을 다시 재고 보이는 항목을 새 축에 다시 놓는다, 템플릿이나 항목 크기를 읽기 전에 정한다, 스크롤 뷰의 축은 따로 정한다) */
	setHorizontal(isHorizontal) {
		if (this.#isHorizontal === isHorizontal) {
			return;
		}
		this.#isHorizontal = isHorizontal;
		for (const itemNode of this.#activeItemMap.values()) {
			itemNode.setActive(false);
			this.#freeItemList.push(itemNode);
		}
		this.#activeItemMap.clear();
		this.updateScrollContentSize();
	}

	//==============================================================================
	// 화면 밖 여유 항목 수 설정.
	//==============================================================================
	/** @param { number } bufferItemCount 보이는 범위 앞뒤로 더 만들어 둘 항목 수. (0 보다 작으면 0, 기본 1) */
	setBufferItemCount(bufferItemCount) {
		this.#bufferItemCount = System.Math.max(0, bufferItemCount);
	}

	//==============================================================================
	// 조회 메서드 목록.
	//==============================================================================

	//==============================================================================
	// 항목 수 반환.
	//==============================================================================
	/** @returns { number } setItemCount 로 정한 항목 수. */
	getItemCount() {
		return this.#itemCount;
	}

	//==============================================================================
	// 항목 크기 반환.
	//==============================================================================
	/** @returns { number } 진행 축 방향 항목 크기. (픽셀, 아직 모르면 0) */
	getItemSize() {
		return this.#itemSize;
	}

	//==============================================================================
	// 항목 간격 반환.
	//==============================================================================
	/** @returns { number } 항목 사이 간격. (픽셀) */
	getSpacing() {
		return this.#spacing;
	}

	//==============================================================================
	// 가로 진행 여부 반환.
	//==============================================================================
	/** @returns { boolean } 항목을 가로로 늘어놓으면 참. (기본 거짓) */
	isHorizontal() {
		return this.#isHorizontal;
	}

	//==============================================================================
	// 보이는 항목 노드 수 반환.
	//==============================================================================
	/** @returns { number } 지금 항목을 맡은 노드 수. (보이는 범위와 여유 항목, 회수해 둔 노드는 세지 않는다) */
	getActiveItemCount() {
		return this.#activeItemMap.size;
	}
}
