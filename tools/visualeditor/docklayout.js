//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 탭을 이만큼 끌어야 끌기로 친다. (그보다 적으면 누르기)
const DRAG_START_DISTANCE = 6;

// 창 가장자리에서 이 비율 안쪽이면 그쪽으로 나누어 붙인다. (넘으면 탭으로 합친다)
const EDGE_ZONE_RATIO = 0.3;

// 도킹 전체 가장자리에서 이 픽셀 안쪽이면 전체 바깥쪽에 붙인다.
const ROOT_EDGE_PIXELS = 18;

// 바깥쪽에 붙일 때 새 창이 차지하는 비율.
const ROOT_EDGE_RATIO = 0.25;

// 창 하나의 가장 작은 크기. (픽셀)
const MINIMUM_GROUP_PIXELS = 90;

// 나누는 쪽과 방향.
const SIDE_DIRECTION_TABLE = {
	left: "row",
	right: "row",
	top: "column",
	bottom: "column",
};


//==============================================================================
// DOM 요소 만들기.
//==============================================================================
/**
 * @param { string } tagName
 * @param { string } className
 * @param { string } text
 * @returns { HTMLElement }
 */
function createElement(tagName, className = "", text = "") {
	const element = System.document.createElement(tagName);
	if (className !== "") {
		element.className = className;
	}
	if (text !== "") {
		element.textContent = text;
	}
	return element;
}

//==============================================================================
// 나무 깊은 복사. (기본 배치를 고치지 않게)
//==============================================================================
/**
 * @param { object } node
 * @returns { object }
 */
function cloneTree(node) {
	return System.JSON.parse(System.JSON.stringify(node));
}


//==============================================================================
// 도킹 배치. (유니티나 VS Code 처럼 창 탭을 끌어 다른 창에 탭으로 합치거나 위아래양옆으로 나누어 붙인다)
// - 배치는 나무다. 마디는 둘 중 하나다.
//   나누기: { kind: "split", direction: "row" | "column", children: [마디...], weights: [비율...] }
//   묶음: { kind: "group", windowIds: [창 이름...], activeId: 보이는 창 이름 }
// - 창 내용 요소는 한 번 만들어 두고, 배치가 바뀔 때마다 새 자리에 옮겨 단다. (안의 상태가 그대로 남는다)
// - 탭을 끌면 놓을 자리를 파란 칸으로 미리 보여 주고, 놓으면 나무를 고치고 다시 그린다.
// - 창 가장자리(30%)는 그쪽으로 나누기, 가운데와 탭 줄은 탭으로 합치기, 도킹 전체 가장자리는 전체 바깥쪽에 붙이기.
// - 사이 막대를 끌어 크기를 바꾸고, 탭을 두 번 누르면 그 묶음을 크게 펼친다.
// - 배치는 브라우저에 남겨 두고 다시 열면 되살린다.
//==============================================================================
export class DockLayout {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { HTMLElement } */ #rootElement;
	/** @private @type { Map<string, object> } */ #windowTable; // 이름 → { id, title, contentElement, toolElement, isClosable, homeSide, homeNeighborId }
	/** @private @type { object } */ #defaultTree;
	/** @private @type { object } */ #tree;
	/** @private @type { Map<string, string> } */ #closedNeighborTable; // 닫은 창 → 닫을 때 같은 묶음에 있던 창.
	/** @private @type { object | null } */ #maximizedGroup;
	/** @private @type { Set<string> } */ #alertSet; // 탭에 빨간 표시를 할 창.
	/** @private @type { string } */ #storageKey;
	/** @private @type { object } */ #callbacks; // { activate(id), rendered() }
	/** @private @type { HTMLElement } */ #indicatorElement; // 놓을 자리 칸.
	/** @private @type { HTMLElement } */ #markerElement; // 탭 사이 넣을 자리 막대.
	/** @private @type { HTMLElement | null } */ #ghostElement; // 끄는 탭 그림자.
	/** @private @type { Map<object, HTMLElement> } */ #groupElementTable; // 묶음 → 그린 요소.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { HTMLElement } rootElement
	 * @param { Array<object> } windowList { id, title, contentElement, toolElement?, isClosable?, homeSide?, homeNeighborId? }
	 * @param { object } defaultTree
	 * @param { string } storageKey
	 * @param { object } callbacks
	 */
	constructor(rootElement, windowList, defaultTree, storageKey, callbacks) {
		this.#rootElement = rootElement;
		this.#windowTable = new Map();
		for (const windowItem of windowList) {
			windowItem.contentElement.classList.add("dockContent");
			this.#windowTable.set(windowItem.id, {
				id: windowItem.id,
				title: windowItem.title,
				contentElement: windowItem.contentElement,
				toolElement: windowItem.toolElement || null,
				isClosable: windowItem.isClosable !== false,
				homeSide: windowItem.homeSide || "center",
				homeNeighborId: windowItem.homeNeighborId || "",
			});
		}
		this.#defaultTree = cloneTree(defaultTree);
		this.#tree = cloneTree(defaultTree);
		this.#closedNeighborTable = new Map();
		this.#maximizedGroup = null;
		this.#alertSet = new Set();
		this.#storageKey = storageKey;
		this.#callbacks = callbacks;
		this.#indicatorElement = createElement("div", "dockIndicator");
		this.#markerElement = createElement("div", "dockTabMarker");
		this.#ghostElement = null;
		this.#groupElementTable = new Map();
		System.document.body.append(this.#indicatorElement, this.#markerElement);
		this.load();
	}

	//==============================================================================
	// 브라우저에 남긴 배치 읽기. (맞지 않으면 기본 배치)
	//==============================================================================
	load() {
		let savedData = null;
		try {
			const savedText = System.localStorage.getItem(this.#storageKey);
			savedData = savedText ? System.JSON.parse(savedText) : null;
		}
		catch (error) {
			savedData = null;
		}
		if (savedData !== null && this.isValidTree(savedData.tree)) {
			this.#tree = savedData.tree;
			this.#closedNeighborTable = new Map(System.Object.entries(savedData.closedNeighbors || {}));
		}
		else {
			this.#tree = cloneTree(this.#defaultTree);
			this.#closedNeighborTable = new Map();
		}

		// 남긴 배치에 없는 새 창은 제자리에 연다. (닫아 둔 창은 그대로 둔다)
		for (const windowId of this.#windowTable.keys()) {
			if (this.findGroupOf(windowId) === null && !this.#closedNeighborTable.has(windowId)) {
				this.placeWindow(windowId);
			}
		}
	}

	//==============================================================================
	// 배치 남기기.
	//==============================================================================
	save() {
		try {
			System.localStorage.setItem(this.#storageKey, System.JSON.stringify({
				tree: this.#tree,
				closedNeighbors: System.Object.fromEntries(this.#closedNeighborTable),
			}));
		}
		catch (error) {
			// 저장소를 못 쓰면 이번 실행에서만 남는다.
		}
	}

	//==============================================================================
	// 기본 배치로 되돌리기.
	//==============================================================================
	resetLayout() {
		this.#tree = cloneTree(this.#defaultTree);
		this.#closedNeighborTable = new Map();
		this.#maximizedGroup = null;
		this.save();
		this.render();
	}

	//==============================================================================
	// 남긴 나무가 쓸 만한지. (모르는 창, 겹친 창, 빈 묶음이 없어야 한다)
	//==============================================================================
	/**
	 * @param { object } tree
	 * @returns { boolean }
	 */
	isValidTree(tree) {
		const seenSet = new Set();
		const visit = (node) => {
			if (node === null || typeof node !== "object") {
				return false;
			}
			if (node.kind === "group") {
				if (!System.Array.isArray(node.windowIds) || node.windowIds.length === 0) {
					return false;
				}
				for (const windowId of node.windowIds) {
					if (!this.#windowTable.has(windowId) || seenSet.has(windowId)) {
						return false;
					}
					seenSet.add(windowId);
				}
				if (!node.windowIds.includes(node.activeId)) {
					node.activeId = node.windowIds[0];
				}
				return true;
			}
			if (node.kind === "split") {
				if (node.direction !== "row" && node.direction !== "column") {
					return false;
				}
				if (!System.Array.isArray(node.children) || node.children.length === 0) {
					return false;
				}
				if (!System.Array.isArray(node.weights) || node.weights.length !== node.children.length) {
					node.weights = node.children.map(() => 1);
				}
				return node.children.every(visit);
			}
			return false;
		};
		if (!visit(tree)) {
			return false;
		}

		// 닫을 수 없는 창은 반드시 있어야 한다.
		for (const windowItem of this.#windowTable.values()) {
			if (!windowItem.isClosable && !seenSet.has(windowItem.id)) {
				return false;
			}
		}
		return true;
	}

	//==============================================================================
	// 창이 든 묶음과 그 부모 찾기.
	//==============================================================================
	/**
	 * @param { string } windowId
	 * @returns { object | null } { group, parent }
	 */
	findGroupOf(windowId) {
		let result = null;
		this.visitGroups((group, parent) => {
			if (result === null && group.windowIds.includes(windowId)) {
				result = { group, parent };
			}
		});
		return result;
	}

	//==============================================================================
	// 모든 묶음 돌기.
	//==============================================================================
	/**
	 * @param { function } visitor (group, parent)
	 */
	visitGroups(visitor) {
		const visit = (node, parent) => {
			if (node.kind === "group") {
				visitor(node, parent);
				return;
			}
			for (const child of node.children) {
				visit(child, node);
			}
		};
		visit(this.#tree, null);
	}

	//==============================================================================
	// 마디의 부모 찾기.
	//==============================================================================
	/**
	 * @param { object } targetNode
	 * @returns { object | null }
	 */
	findParent(targetNode) {
		const visit = (node) => {
			if (node.kind !== "split") {
				return null;
			}
			for (const child of node.children) {
				if (child === targetNode) {
					return node;
				}
				const found = visit(child);
				if (found !== null) {
					return found;
				}
			}
			return null;
		};
		return visit(this.#tree);
	}

	//==============================================================================
	// 나무에서 창 빼기. (빈 묶음은 없애고, 하나 남은 나누기는 풀고, 같은 방향 나누기는 합친다)
	//==============================================================================
	/**
	 * @param { string } windowId
	 */
	removeWindowFromTree(windowId) {
		const found = this.findGroupOf(windowId);
		if (found === null) {
			return;
		}
		const group = found.group;
		const index = group.windowIds.indexOf(windowId);
		group.windowIds.splice(index, 1);
		if (group.activeId === windowId) {
			group.activeId = group.windowIds[System.Math.min(index, group.windowIds.length - 1)] || "";
		}
		if (this.#maximizedGroup === group && group.windowIds.length === 0) {
			this.#maximizedGroup = null;
		}
		this.#tree = this.normalize(this.#tree) || { kind: "group", windowIds: [], activeId: "" };
	}

	//==============================================================================
	// 나무 정리.
	//==============================================================================
	/**
	 * @param { object } node
	 * @returns { object | null }
	 */
	normalize(node) {
		if (node.kind === "group") {
			return node.windowIds.length > 0 ? node : null;
		}
		const childList = [];
		const weightList = [];
		for (let index = 0; index < node.children.length; ++index) {
			const child = this.normalize(node.children[index]);
			if (child === null) {
				continue;
			}
			const weight = node.weights[index];
			if (child.kind === "split" && child.direction === node.direction) {
				// 같은 방향이면 풀어서 합친다. (자식 비율을 부모 비율 안에 나눈다)
				const childWeightSum = child.weights.reduce((sum, value) => sum + value, 0);
				for (let childIndex = 0; childIndex < child.children.length; ++childIndex) {
					childList.push(child.children[childIndex]);
					weightList.push(weight * child.weights[childIndex] / childWeightSum);
				}
				continue;
			}
			childList.push(child);
			weightList.push(weight);
		}
		if (childList.length === 0) {
			return null;
		}
		if (childList.length === 1) {
			return childList[0];
		}
		node.children = childList;
		node.weights = weightList;
		return node;
	}

	//==============================================================================
	// 묶음 옆에 새 창 묶음 붙이기.
	//==============================================================================
	/**
	 * @param { object } targetNode
	 * @param { string } side left, right, top, bottom
	 * @param { string } windowId
	 */
	splitBeside(targetNode, side, windowId) {
		const direction = SIDE_DIRECTION_TABLE[side];
		const isBefore = side === "left" || side === "top";
		const newGroup = { kind: "group", windowIds: [windowId], activeId: windowId };
		const parent = this.findParent(targetNode);
		if (parent !== null && parent.direction === direction) {
			const index = parent.children.indexOf(targetNode);
			const halfWeight = parent.weights[index] * 0.5;
			parent.weights[index] = halfWeight;
			parent.children.splice(isBefore ? index : index + 1, 0, newGroup);
			parent.weights.splice(isBefore ? index : index + 1, 0, halfWeight);
			return;
		}
		const split = {
			kind: "split",
			direction,
			children: isBefore ? [newGroup, targetNode] : [targetNode, newGroup],
			weights: [1, 1],
		};
		this.replaceNode(targetNode, split);
	}

	//==============================================================================
	// 도킹 전체 바깥쪽에 새 창 묶음 붙이기.
	//==============================================================================
	/**
	 * @param { string } side
	 * @param { string } windowId
	 */
	splitRoot(side, windowId) {
		const direction = SIDE_DIRECTION_TABLE[side];
		const isBefore = side === "left" || side === "top";
		const newGroup = { kind: "group", windowIds: [windowId], activeId: windowId };
		const root = this.#tree;
		if (root.kind === "split" && root.direction === direction) {
			const weightSum = root.weights.reduce((sum, value) => sum + value, 0);
			const newWeight = weightSum * ROOT_EDGE_RATIO / (1 - ROOT_EDGE_RATIO);
			root.children.splice(isBefore ? 0 : root.children.length, 0, newGroup);
			root.weights.splice(isBefore ? 0 : root.weights.length, 0, newWeight);
			return;
		}
		const restWeight = (1 - ROOT_EDGE_RATIO) / ROOT_EDGE_RATIO;
		this.#tree = {
			kind: "split",
			direction,
			children: isBefore ? [newGroup, root] : [root, newGroup],
			weights: isBefore ? [1, restWeight] : [restWeight, 1],
		};
	}

	//==============================================================================
	// 마디 갈아 끼우기.
	//==============================================================================
	/**
	 * @param { object } oldNode
	 * @param { object } newNode
	 */
	replaceNode(oldNode, newNode) {
		if (this.#tree === oldNode) {
			this.#tree = newNode;
			return;
		}
		const parent = this.findParent(oldNode);
		if (parent !== null) {
			parent.children[parent.children.indexOf(oldNode)] = newNode;
		}
	}

	//==============================================================================
	// 닫혀 있던 창을 제자리에 두기. (닫을 때 같이 있던 창 옆, 없으면 창마다 정한 쪽)
	//==============================================================================
	/**
	 * @param { string } windowId
	 */
	placeWindow(windowId) {
		const windowItem = this.#windowTable.get(windowId);
		const closedNeighborId = this.#closedNeighborTable.get(windowId);
		this.#closedNeighborTable.delete(windowId);
		for (const neighborId of [closedNeighborId, windowItem.homeNeighborId]) {
			const neighbor = neighborId ? this.findGroupOf(neighborId) : null;
			if (neighbor !== null) {
				neighbor.group.windowIds.push(windowId);
				neighbor.group.activeId = windowId;
				return;
			}
		}
		if (this.#tree.kind === "group" && this.#tree.windowIds.length === 0) {
			this.#tree = { kind: "group", windowIds: [windowId], activeId: windowId };
			return;
		}
		if (windowItem.homeSide === "center") {
			// 가장 큰 묶음에 탭으로.
			let largestGroup = null;
			let largestArea = -1;
			this.visitGroups((group) => {
				const groupElement = this.#groupElementTable.get(group);
				const rect = groupElement ? groupElement.getBoundingClientRect() : { width: 1, height: 1 };
				if (rect.width * rect.height > largestArea) {
					largestArea = rect.width * rect.height;
					largestGroup = group;
				}
			});
			largestGroup.windowIds.push(windowId);
			largestGroup.activeId = windowId;
			return;
		}
		this.splitRoot(windowItem.homeSide, windowId);
	}

	//==============================================================================
	// 창 보이기. (닫혀 있으면 열고, 탭을 앞으로)
	//==============================================================================
	/**
	 * @param { string } windowId
	 */
	activateWindow(windowId) {
		if (!this.#windowTable.has(windowId)) {
			return;
		}
		let found = this.findGroupOf(windowId);
		if (found === null) {
			this.placeWindow(windowId);
			found = this.findGroupOf(windowId);
		}
		if (this.#maximizedGroup !== null && this.#maximizedGroup !== found.group) {
			this.#maximizedGroup = null;
		}
		found.group.activeId = windowId;
		this.#alertSet.delete(windowId);
		this.save();
		this.render();
		this.#callbacks.activate(windowId);
	}

	//==============================================================================
	// 창 닫기.
	//==============================================================================
	/**
	 * @param { string } windowId
	 */
	closeWindow(windowId) {
		const windowItem = this.#windowTable.get(windowId);
		if (!windowItem || !windowItem.isClosable) {
			return;
		}
		const found = this.findGroupOf(windowId);
		if (found === null) {
			return;
		}
		const neighborId = found.group.windowIds.find((otherId) => otherId !== windowId);
		this.#closedNeighborTable.set(windowId, neighborId || "");
		this.removeWindowFromTree(windowId);
		this.save();
		this.render();
	}

	//==============================================================================
	// 창이 열려 있는지. (어느 묶음에든 들어 있으면)
	//==============================================================================
	/**
	 * @param { string } windowId
	 * @returns { boolean }
	 */
	isWindowOpen(windowId) {
		return this.findGroupOf(windowId) !== null;
	}

	//==============================================================================
	// 창이 지금 화면에 보이는지. (묶음의 앞 탭이고, 펼친 묶음에 가리지 않았으면)
	//==============================================================================
	/**
	 * @param { string } windowId
	 * @returns { boolean }
	 */
	isWindowVisible(windowId) {
		const found = this.findGroupOf(windowId);
		if (found === null || found.group.activeId !== windowId) {
			return false;
		}
		return this.#maximizedGroup === null || this.#maximizedGroup === found.group;
	}

	//==============================================================================
	// 탭 빨간 표시. (콘솔 오류처럼 눈길을 끌 때)
	//==============================================================================
	/**
	 * @param { string } windowId
	 * @param { boolean } isAlert
	 */
	setWindowAlert(windowId, isAlert) {
		if (isAlert && this.isWindowVisible(windowId)) {
			return;
		}
		if (isAlert) {
			this.#alertSet.add(windowId);
		}
		else {
			this.#alertSet.delete(windowId);
		}
		const tabElement = this.#rootElement.querySelector(`.dockTab[data-window-id="${windowId}"]`);
		if (tabElement !== null) {
			tabElement.classList.toggle("isAlert", isAlert);
		}
	}

	//==============================================================================
	// 묶음 크게 펼치기와 되돌리기.
	//==============================================================================
	/**
	 * @param { object } group
	 */
	toggleMaximize(group) {
		this.#maximizedGroup = this.#maximizedGroup === group ? null : group;
		this.render();
	}

	//==============================================================================
	// 다시 그리기.
	//==============================================================================
	render() {
		const rootElement = this.#rootElement;

		// 옮겨 달면 스크롤이 처음으로 돌아가므로 남겨 두었다가 되돌린다.
		const scrollList = [];
		for (const windowItem of this.#windowTable.values()) {
			for (const scrollElement of [windowItem.contentElement, ...windowItem.contentElement.querySelectorAll("*")]) {
				if (scrollElement.scrollTop !== 0 || scrollElement.scrollLeft !== 0) {
					scrollList.push({ element: scrollElement, top: scrollElement.scrollTop, left: scrollElement.scrollLeft });
				}
			}
		}
		this.#groupElementTable = new Map();
		rootElement.textContent = "";
		const rootNode = this.#maximizedGroup !== null ? this.#maximizedGroup : this.#tree;
		rootElement.append(this.renderNode(rootNode));
		for (const scrollItem of scrollList) {
			scrollItem.element.scrollTop = scrollItem.top;
			scrollItem.element.scrollLeft = scrollItem.left;
		}
		this.#callbacks.rendered();
	}

	//==============================================================================
	// 마디 그리기.
	//==============================================================================
	/**
	 * @param { object } node
	 * @returns { HTMLElement }
	 */
	renderNode(node) {
		if (node.kind === "group") {
			return this.renderGroup(node);
		}
		return this.renderSplit(node);
	}

	//==============================================================================
	// 나누기 그리기. (자식 사이에 크기 막대)
	//==============================================================================
	/**
	 * @param { object } split
	 * @returns { HTMLElement }
	 */
	renderSplit(split) {
		const splitElement = createElement("div", `dockSplit ${split.direction === "row" ? "isRow" : "isColumn"}`);
		const childElementList = [];
		for (let index = 0; index < split.children.length; ++index) {
			if (index > 0) {
				const splitterElement = createElement("div", "dockSplitter");
				this.attachSplitter(splitterElement, split, index - 1, childElementList);
				splitElement.append(splitterElement);
			}
			const childElement = this.renderNode(split.children[index]);
			childElement.style.flex = `${split.weights[index]} 1 0px`;
			childElementList.push(childElement);
			splitElement.append(childElement);
		}
		return splitElement;
	}

	//==============================================================================
	// 크기 막대 끌기. (양옆 두 마디의 비율만 바꾼다)
	//==============================================================================
	/**
	 * @param { HTMLElement } splitterElement
	 * @param { object } split
	 * @param { number } index 막대 앞 마디 차례.
	 * @param { Array<HTMLElement> } childElementList
	 */
	attachSplitter(splitterElement, split, index, childElementList) {
		const isRow = split.direction === "row";
		splitterElement.addEventListener("pointerdown", (pointerEvent) => {
			pointerEvent.preventDefault();
			splitterElement.setPointerCapture(pointerEvent.pointerId);
			splitterElement.classList.add("isDragging");
			const firstElement = childElementList[index];
			const secondElement = childElementList[index + 1];
			const firstRect = firstElement.getBoundingClientRect();
			const secondRect = secondElement.getBoundingClientRect();
			const firstSize = isRow ? firstRect.width : firstRect.height;
			const secondSize = isRow ? secondRect.width : secondRect.height;
			const pairSize = firstSize + secondSize;
			const pairWeight = split.weights[index] + split.weights[index + 1];
			const startPosition = isRow ? pointerEvent.clientX : pointerEvent.clientY;
			const minimumSize = System.Math.min(MINIMUM_GROUP_PIXELS, pairSize * 0.5);
			const moveListener = (moveEvent) => {
				const delta = (isRow ? moveEvent.clientX : moveEvent.clientY) - startPosition;
				const newFirstSize = System.Math.max(minimumSize, System.Math.min(pairSize - minimumSize, firstSize + delta));
				split.weights[index] = pairWeight * newFirstSize / pairSize;
				split.weights[index + 1] = pairWeight - split.weights[index];
				firstElement.style.flex = `${split.weights[index]} 1 0px`;
				secondElement.style.flex = `${split.weights[index + 1]} 1 0px`;
			};
			const upListener = () => {
				splitterElement.classList.remove("isDragging");
				splitterElement.removeEventListener("pointermove", moveListener);
				splitterElement.removeEventListener("pointerup", upListener);
				splitterElement.removeEventListener("pointercancel", upListener);
				this.save();
			};
			splitterElement.addEventListener("pointermove", moveListener);
			splitterElement.addEventListener("pointerup", upListener);
			splitterElement.addEventListener("pointercancel", upListener);
		});
	}

	//==============================================================================
	// 묶음 그리기. (탭 줄, 앞 탭의 도구, 내용)
	//==============================================================================
	/**
	 * @param { object } group
	 * @returns { HTMLElement }
	 */
	renderGroup(group) {
		const groupElement = createElement("div", "dockGroup");
		if (group === this.#maximizedGroup) {
			groupElement.classList.add("isMaximized");
		}
		const tabStrip = createElement("div", "dockTabStrip");
		const tabList = createElement("div", "dockTabList");
		const bodyElement = createElement("div", "dockBody");
		for (const windowId of group.windowIds) {
			const windowItem = this.#windowTable.get(windowId);
			const isActive = windowId === group.activeId;
			const tabElement = createElement("div", "dockTab" + (isActive ? " isActive" : "") + (this.#alertSet.has(windowId) ? " isAlert" : ""));
			tabElement.dataset.windowId = windowId;
			tabElement.append(createElement("span", "dockTabTitle", windowItem.title));
			if (windowItem.isClosable) {
				const closeButton = createElement("span", "dockTabClose", "×");
				closeButton.title = "닫기";
				closeButton.addEventListener("pointerdown", (pointerEvent) => {
					pointerEvent.stopPropagation();
				});
				closeButton.addEventListener("click", (mouseEvent) => {
					mouseEvent.stopPropagation();
					this.closeWindow(windowId);
				});
				tabElement.append(closeButton);
			}
			tabElement.addEventListener("pointerdown", (pointerEvent) => {
				this.beginTabPress(pointerEvent, tabElement, group, windowId);
			});
			tabElement.addEventListener("dblclick", () => {
				this.toggleMaximize(group);
			});
			tabElement.addEventListener("auxclick", (mouseEvent) => {
				if (mouseEvent.button === 1) {
					this.closeWindow(windowId);
				}
			});
			tabList.append(tabElement);
			windowItem.contentElement.style.display = isActive ? "" : "none";
			bodyElement.append(windowItem.contentElement);
		}
		tabStrip.append(tabList);
		const activeItem = this.#windowTable.get(group.activeId);
		if (activeItem && activeItem.toolElement !== null) {
			const toolHolder = createElement("div", "dockTabTools");
			toolHolder.append(activeItem.toolElement);
			tabStrip.append(toolHolder);
		}
		groupElement.append(tabStrip, bodyElement);
		this.#groupElementTable.set(group, groupElement);
		return groupElement;
	}

	//==============================================================================
	// 탭 누르기. (그대로 떼면 탭 고르기, 끌면 도킹 끌기)
	//==============================================================================
	/**
	 * @param { PointerEvent } pointerEvent
	 * @param { HTMLElement } tabElement
	 * @param { object } group
	 * @param { string } windowId
	 */
	beginTabPress(pointerEvent, tabElement, group, windowId) {
		if (pointerEvent.button !== 0) {
			return;
		}
		pointerEvent.preventDefault();
		const startX = pointerEvent.clientX;
		const startY = pointerEvent.clientY;
		let isDragging = false;
		let target = null;
		const pointerId = pointerEvent.pointerId;
		tabElement.setPointerCapture(pointerId);
		const moveListener = (moveEvent) => {
			if (!isDragging) {
				if (System.Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < DRAG_START_DISTANCE) {
					return;
				}
				isDragging = true;
				if (this.#maximizedGroup !== null) {
					this.#maximizedGroup = null;
					this.render();
				}
				this.beginDragVisual(windowId);
			}
			this.moveGhost(moveEvent.clientX, moveEvent.clientY);
			target = this.findDropTarget(moveEvent.clientX, moveEvent.clientY, windowId);
			this.showDropTarget(target);
		};
		const finish = (isCancelled) => {
			tabElement.removeEventListener("pointermove", moveListener);
			tabElement.removeEventListener("pointerup", upListener);
			tabElement.removeEventListener("pointercancel", cancelListener);
			System.window.removeEventListener("keydown", keyListener, true);
			if (tabElement.hasPointerCapture(pointerId)) {
				tabElement.releasePointerCapture(pointerId);
			}
			if (!isDragging) {
				if (!isCancelled) {
					this.activateWindow(windowId);
				}
				return;
			}
			this.endDragVisual();
			if (!isCancelled && target !== null) {
				this.applyDrop(windowId, target);
			}
		};
		const upListener = () => {
			finish(false);
		};
		const cancelListener = () => {
			finish(true);
		};
		const keyListener = (keyboardEvent) => {
			if (keyboardEvent.key === "Escape") {
				keyboardEvent.stopPropagation();
				keyboardEvent.preventDefault();
				finish(true);
			}
		};
		tabElement.addEventListener("pointermove", moveListener);
		tabElement.addEventListener("pointerup", upListener);
		tabElement.addEventListener("pointercancel", cancelListener);
		System.window.addEventListener("keydown", keyListener, true);
	}

	//==============================================================================
	// 끌기 모습 시작과 끝. (탭 그림자, 놓을 자리 칸)
	//==============================================================================
	/**
	 * @param { string } windowId
	 */
	beginDragVisual(windowId) {
		const ghostElement = createElement("div", "dockGhost", this.#windowTable.get(windowId).title);
		System.document.body.append(ghostElement);
		this.#ghostElement = ghostElement;
		System.document.body.classList.add("isDockDragging");
	}

	endDragVisual() {
		if (this.#ghostElement !== null) {
			this.#ghostElement.remove();
			this.#ghostElement = null;
		}
		System.document.body.classList.remove("isDockDragging");
		this.#indicatorElement.classList.remove("isVisible");
		this.#markerElement.classList.remove("isVisible");
	}

	/**
	 * @param { number } clientX
	 * @param { number } clientY
	 */
	moveGhost(clientX, clientY) {
		if (this.#ghostElement !== null) {
			this.#ghostElement.style.transform = `translate(${clientX + 12}px, ${clientY + 10}px)`;
		}
	}

	//==============================================================================
	// 놓을 자리 찾기.
	// - 돌려주는 것: { kind: "root", side, rect } | { kind: "split", group, side, rect } | { kind: "tabs", group, index, rect, markerX, markerRect } | null
	//==============================================================================
	/**
	 * @param { number } clientX
	 * @param { number } clientY
	 * @param { string } windowId 끄는 창.
	 * @returns { object | null }
	 */
	findDropTarget(clientX, clientY, windowId) {
		const rootRect = this.#rootElement.getBoundingClientRect();
		if (clientX < rootRect.left || clientX > rootRect.right || clientY < rootRect.top || clientY > rootRect.bottom) {
			return null;
		}
		const source = this.findGroupOf(windowId);
		const isAlone = source !== null && source.group.windowIds.length === 1;

		// 손가락 아래 묶음.
		let hitGroup = null;
		let hitElement = null;
		for (const [group, groupElement] of this.#groupElementTable) {
			const rect = groupElement.getBoundingClientRect();
			if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
				hitGroup = group;
				hitElement = groupElement;
				break;
			}
		}
		const isOwnGroup = hitGroup !== null && source !== null && source.group === hitGroup;

		// 탭 줄 위: 그 자리에 탭으로 넣는다. (전체 가장자리보다 먼저 본다)
		const stripElement = hitElement !== null ? hitElement.querySelector(".dockTabStrip") : null;
		const stripRect = stripElement !== null ? stripElement.getBoundingClientRect() : null;
		if (stripRect !== null && clientY <= stripRect.bottom) {
			if (isOwnGroup && isAlone) {
				return null;
			}
			const tabElementList = [...stripElement.querySelectorAll(".dockTab")];
			let index = 0;
			let markerX = tabElementList.length > 0 ? tabElementList[0].getBoundingClientRect().left : stripRect.left + 4;
			for (const tabElement of tabElementList) {
				const tabRect = tabElement.getBoundingClientRect();
				if (clientX > tabRect.left + tabRect.width * 0.5) {
					index += 1;
					markerX = tabRect.right;
				}
			}
			return { kind: "tabs", group: hitGroup, index, rect: rectOf(hitElement.getBoundingClientRect()), markerRect: { left: markerX - 1, top: stripRect.top + 4, width: 3, height: stripRect.height - 8 } };
		}

		// 도킹 전체 가장자리. (혼자인 창이 이미 그 끝을 다 차지하고 있으면 바뀔 게 없다)
		const rootSideList = [
			{ side: "left", distance: clientX - rootRect.left },
			{ side: "right", distance: rootRect.right - clientX },
			{ side: "top", distance: clientY - rootRect.top },
			{ side: "bottom", distance: rootRect.bottom - clientY },
		];
		rootSideList.sort((first, second) => first.distance - second.distance);
		if (rootSideList[0].distance < ROOT_EDGE_PIXELS && !(isAlone && this.#tree === source.group)) {
			const side = rootSideList[0].side;
			const isRow = SIDE_DIRECTION_TABLE[side] === "row";
			const bandSize = (isRow ? rootRect.width : rootRect.height) * ROOT_EDGE_RATIO;
			const rect = {
				left: side === "right" ? rootRect.right - bandSize : rootRect.left,
				top: side === "bottom" ? rootRect.bottom - bandSize : rootRect.top,
				width: isRow ? bandSize : rootRect.width,
				height: isRow ? rootRect.height : bandSize,
			};
			return { kind: "root", side, rect };
		}

		if (hitGroup === null) {
			return null;
		}
		const groupRect = hitElement.getBoundingClientRect();

		// 내용 위: 가장자리면 나누기, 가운데면 탭으로 합치기.
		const bodyTop = stripRect.bottom;
		const bodyHeight = System.Math.max(1, groupRect.bottom - bodyTop);
		const ratioX = (clientX - groupRect.left) / System.Math.max(1, groupRect.width);
		const ratioY = (clientY - bodyTop) / bodyHeight;
		const sideList = [
			{ side: "left", distance: ratioX },
			{ side: "right", distance: 1 - ratioX },
			{ side: "top", distance: ratioY },
			{ side: "bottom", distance: 1 - ratioY },
		];
		sideList.sort((first, second) => first.distance - second.distance);
		if (sideList[0].distance < EDGE_ZONE_RATIO) {
			if (isOwnGroup && isAlone) {
				return null;
			}
			const side = sideList[0].side;
			const halfWidth = groupRect.width * 0.5;
			const halfHeight = groupRect.height * 0.5;
			const rect = {
				left: side === "right" ? groupRect.left + halfWidth : groupRect.left,
				top: side === "bottom" ? groupRect.top + halfHeight : groupRect.top,
				width: side === "left" || side === "right" ? halfWidth : groupRect.width,
				height: side === "top" || side === "bottom" ? halfHeight : groupRect.height,
			};
			return { kind: "split", group: hitGroup, side, rect };
		}
		if (isOwnGroup) {
			return null;
		}
		return { kind: "tabs", group: hitGroup, index: hitGroup.windowIds.length, rect: rectOf(groupRect), markerRect: null };
	}

	//==============================================================================
	// 놓을 자리 보여 주기. (칸이 미끄러지듯 옮겨 간다)
	//==============================================================================
	/**
	 * @param { object | null } target
	 */
	showDropTarget(target) {
		const indicatorElement = this.#indicatorElement;
		const markerElement = this.#markerElement;
		if (target === null) {
			indicatorElement.classList.remove("isVisible");
			markerElement.classList.remove("isVisible");
			return;
		}
		const rect = target.rect;
		const isFirstShow = !indicatorElement.classList.contains("isVisible");
		if (isFirstShow) {
			// 처음 나타날 때는 미끄러지지 않고 그 자리에서 커진다.
			indicatorElement.classList.add("isInstant");
		}
		indicatorElement.style.left = `${rect.left + 3}px`;
		indicatorElement.style.top = `${rect.top + 3}px`;
		indicatorElement.style.width = `${System.Math.max(0, rect.width - 6)}px`;
		indicatorElement.style.height = `${System.Math.max(0, rect.height - 6)}px`;
		if (isFirstShow) {
			void indicatorElement.offsetWidth;
			indicatorElement.classList.remove("isInstant");
		}
		indicatorElement.classList.add("isVisible");
		if (target.kind === "tabs" && target.markerRect !== null) {
			const markerRect = target.markerRect;
			markerElement.style.left = `${markerRect.left}px`;
			markerElement.style.top = `${markerRect.top}px`;
			markerElement.style.height = `${markerRect.height}px`;
			markerElement.classList.add("isVisible");
		}
		else {
			markerElement.classList.remove("isVisible");
		}
	}

	//==============================================================================
	// 놓기. (나무를 고치고 다시 그린다)
	//==============================================================================
	/**
	 * @param { string } windowId
	 * @param { object } target
	 */
	applyDrop(windowId, target) {
		const source = this.findGroupOf(windowId);
		if (source === null) {
			return;
		}
		if (target.kind === "tabs") {
			const targetGroup = target.group;
			let index = target.index;
			if (source.group === targetGroup) {
				const currentIndex = targetGroup.windowIds.indexOf(windowId);
				if (currentIndex < index) {
					index -= 1;
				}
				targetGroup.windowIds.splice(currentIndex, 1);
				targetGroup.windowIds.splice(index, 0, windowId);
				targetGroup.activeId = windowId;
			}
			else {
				this.removeWindowFromTree(windowId);
				targetGroup.windowIds.splice(System.Math.min(index, targetGroup.windowIds.length), 0, windowId);
				targetGroup.activeId = windowId;
			}
		}
		else if (target.kind === "split") {
			this.removeWindowFromTree(windowId);
			this.splitBeside(target.group, target.side, windowId);
			this.#tree = this.normalize(this.#tree);
		}
		else if (target.kind === "root") {
			this.removeWindowFromTree(windowId);
			this.splitRoot(target.side, windowId);
			this.#tree = this.normalize(this.#tree);
		}
		this.save();
		this.render();
		this.#callbacks.activate(windowId);
	}

	//==============================================================================
	// 시험용. (지금 나무)
	//==============================================================================
	/**
	 * @returns { object }
	 */
	getTree() {
		return this.#tree;
	}
}


//==============================================================================
// DOMRect 를 평범한 칸으로.
//==============================================================================
/**
 * @param { DOMRect } domRect
 * @returns { object }
 */
function rectOf(domRect) {
	return { left: domRect.left, top: domRect.top, width: domRect.width, height: domRect.height };
}
