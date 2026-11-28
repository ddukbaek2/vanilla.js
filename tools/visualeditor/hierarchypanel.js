//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 끌어서 옮길 때 노드를 담는 형식.
const NODE_DRAG_TYPE = "application/x-vanilla-node";


//==============================================================================
// 하이어라키 패널. (문서 루트 밑의 노드 나무)
// - 누르면 고르고, 두 번 누르면 이름을 바꾸고, 세모를 누르면 펼치고 접는다.
// - 끌어서 다른 노드의 가운데에 놓으면 그 자식으로, 위나 아래 가장자리에 놓으면 그 앞이나 뒤 형제로 옮긴다. 빈 곳에 놓으면 맨 위 노드로.
// - 오른쪽 클릭은 contextMenu 알림을 부른다. (만들기, 복제, 지우기)
//==============================================================================
export class HierarchyPanel {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { HTMLElement } */ #bodyElement;
	/** @private @type { object | null } */ #documentRoot;
	/** @private @type { object | null } */ #selectedNode;
	/** @private @type { WeakSet<object> } */ #collapsedNodeSet;
	/** @private @type { object | null } */ #draggedNode;
	/** @private @type { string } */ #filterText; // 찾기 글. (비어 있지 않으면 이름에 든 노드만 납작하게 보인다)
	/** @private @type { object } */ #eventHandlers; // { select(node), move(node, parent, index), rename(node, name), contextMenu(node, x, y) }

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { HTMLElement } bodyElement
	 * @param { object } eventHandlers
	 */
	constructor(bodyElement, eventHandlers) {
		this.#bodyElement = bodyElement;
		this.#documentRoot = null;
		this.#selectedNode = null;
		this.#collapsedNodeSet = new System.WeakSet();
		this.#draggedNode = null;
		this.#filterText = "";
		this.#eventHandlers = eventHandlers;
		bodyElement.addEventListener("dragover", (dragEvent) => {
			if (dragEvent.dataTransfer.types.includes(NODE_DRAG_TYPE)) {
				dragEvent.preventDefault();
			}
		});
		bodyElement.addEventListener("drop", (dragEvent) => {
			const draggedNode = this.#draggedNode;
			if (draggedNode === null || dragEvent.target !== bodyElement) {
				return;
			}
			dragEvent.preventDefault();
			const documentRoot = this.#documentRoot;
			this.#eventHandlers.move(draggedNode, documentRoot, documentRoot.getChildren().length);
		});
		bodyElement.addEventListener("contextmenu", (mouseEvent) => {
			if (mouseEvent.target !== bodyElement) {
				return;
			}
			mouseEvent.preventDefault();
			this.#eventHandlers.contextMenu(null, mouseEvent.clientX, mouseEvent.clientY);
		});
	}

	//==============================================================================
	// 문서 루트와 고른 노드로 다시 그리기.
	//==============================================================================
	/**
	 * @param { object } documentRoot
	 * @param { object | null } selectedNode
	 */
	render(documentRoot, selectedNode) {
		this.#documentRoot = documentRoot;
		this.#selectedNode = selectedNode;
		const bodyElement = this.#bodyElement;
		const scrollTop = bodyElement.scrollTop;
		bodyElement.textContent = "";
		const filterText = this.#filterText.toLowerCase();
		if (filterText !== "") {
			const visit = (node) => {
				for (const childNode of node.getChildren()) {
					if (childNode.getName().toLowerCase().includes(filterText)) {
						this.renderNode(childNode, 0, true);
					}
					visit(childNode);
				}
			};
			visit(documentRoot);
		}
		else {
			for (const childNode of documentRoot.getChildren()) {
				this.renderNode(childNode, 0, false);
			}
		}
		bodyElement.scrollTop = scrollTop;
	}

	//==============================================================================
	// 노드 한 줄과 그 자식들 그리기.
	//==============================================================================
	/**
	 * @param { object } node
	 * @param { number } depth
	 * @param { boolean } isFlat - 찾기 결과처럼 자식을 그리지 않을 때.
	 */
	renderNode(node, depth, isFlat) {
		const childNodeList = node.getChildren();
		const hasChildren = !isFlat && childNodeList.length > 0;
		const isCollapsed = this.#collapsedNodeSet.has(node);
		const itemElement = System.document.createElement("div");
		itemElement.className = "treeItem";
		if (node === this.#selectedNode) {
			itemElement.classList.add("isSelected");
		}
		if (!node.isActive()) {
			itemElement.classList.add("isInactive");
		}
		itemElement.style.paddingLeft = `${4 + depth * 14}px`;
		itemElement.draggable = true;
		const toggleElement = System.document.createElement("span");
		toggleElement.className = "treeToggle";
		toggleElement.textContent = hasChildren ? (isCollapsed ? "▸" : "▾") : "";
		toggleElement.addEventListener("click", (mouseEvent) => {
			mouseEvent.stopPropagation();
			if (isCollapsed) {
				this.#collapsedNodeSet.delete(node);
			}
			else {
				this.#collapsedNodeSet.add(node);
			}
			this.render(this.#documentRoot, this.#selectedNode);
		});
		const iconElement = System.document.createElement("span");
		iconElement.className = "treeIcon";
		iconElement.textContent = node.getAllComponents().length > 0 ? "◆" : "◇";
		const labelElement = System.document.createElement("span");
		labelElement.className = "treeLabel";
		labelElement.textContent = node.getName() || "(이름 없음)";
		itemElement.append(toggleElement, iconElement, labelElement);
		itemElement.addEventListener("click", () => {
			this.#eventHandlers.select(node);
		});
		itemElement.addEventListener("dblclick", () => {
			this.beginRename(itemElement, labelElement, node);
		});
		itemElement.addEventListener("contextmenu", (mouseEvent) => {
			mouseEvent.preventDefault();
			this.#eventHandlers.select(node);
			this.#eventHandlers.contextMenu(node, mouseEvent.clientX, mouseEvent.clientY);
		});
		itemElement.addEventListener("dragstart", (dragEvent) => {
			this.#draggedNode = node;
			dragEvent.dataTransfer.setData(NODE_DRAG_TYPE, node.getName());
			dragEvent.dataTransfer.effectAllowed = "move";
		});
		itemElement.addEventListener("dragend", () => {
			this.#draggedNode = null;
		});
		itemElement.addEventListener("dragover", (dragEvent) => {
			const draggedNode = this.#draggedNode;
			if (draggedNode === null || draggedNode === node || this.isAncestor(draggedNode, node)) {
				return;
			}
			dragEvent.preventDefault();
			itemElement.classList.add("isDropTarget");
		});
		itemElement.addEventListener("dragleave", () => {
			itemElement.classList.remove("isDropTarget");
		});
		itemElement.addEventListener("drop", (dragEvent) => {
			itemElement.classList.remove("isDropTarget");
			const draggedNode = this.#draggedNode;
			if (draggedNode === null || draggedNode === node || this.isAncestor(draggedNode, node)) {
				return;
			}
			dragEvent.preventDefault();
			dragEvent.stopPropagation();
			const itemRect = itemElement.getBoundingClientRect();
			const ratio = (dragEvent.clientY - itemRect.top) / itemRect.height;
			const parentNode = node.getParent();
			const siblingIndex = parentNode.getChildren().indexOf(node);
			if (ratio < 0.25) {
				this.#eventHandlers.move(draggedNode, parentNode, siblingIndex);
			}
			else if (ratio > 0.75) {
				this.#eventHandlers.move(draggedNode, parentNode, siblingIndex + 1);
			}
			else {
				this.#collapsedNodeSet.delete(node);
				this.#eventHandlers.move(draggedNode, node, node.getChildren().length);
			}
		});
		this.#bodyElement.append(itemElement);
		if (node === this.#selectedNode) {
			System.requestAnimationFrame(() => {
				itemElement.scrollIntoView({ block: "nearest" });
			});
		}
		if (hasChildren && !isCollapsed) {
			for (const childNode of childNodeList) {
				this.renderNode(childNode, depth + 1, false);
			}
		}
	}

	//==============================================================================
	// 찾기 글 바꾸기.
	//==============================================================================
	/**
	 * @param { string } filterText
	 */
	setFilterText(filterText) {
		this.#filterText = filterText;
		if (this.#documentRoot !== null) {
			this.render(this.#documentRoot, this.#selectedNode);
		}
	}

	//==============================================================================
	// 고른 노드의 조상을 모두 펼치기. (씬 뷰에서 골랐을 때 하이어라키에 보이게)
	//==============================================================================
	/**
	 * @param { object } node
	 */
	revealNode(node) {
		let currentNode = node.getParent();
		while (currentNode !== null && currentNode !== undefined) {
			this.#collapsedNodeSet.delete(currentNode);
			currentNode = currentNode.getParent();
		}
	}

	//==============================================================================
	// 이름 바꾸기 시작. (글 칸을 띄우고, Enter 나 포커스를 잃으면 적용, Escape 면 그만둠)
	//==============================================================================
	/**
	 * @param { HTMLElement } itemElement
	 * @param { HTMLElement } labelElement
	 * @param { object } node
	 */
	beginRename(itemElement, labelElement, node) {
		const inputElement = System.document.createElement("input");
		inputElement.className = "treeRename";
		inputElement.value = node.getName();
		labelElement.replaceWith(inputElement);
		inputElement.focus();
		inputElement.select();
		let isFinished = false;
		const finish = (isApplied) => {
			if (isFinished) {
				return;
			}
			isFinished = true;
			if (isApplied && inputElement.value !== node.getName()) {
				this.#eventHandlers.rename(node, inputElement.value);
			}
			else {
				this.render(this.#documentRoot, this.#selectedNode);
			}
		};
		inputElement.addEventListener("keydown", (keyboardEvent) => {
			keyboardEvent.stopPropagation();
			if (keyboardEvent.key === "Enter") {
				finish(true);
			}
			else if (keyboardEvent.key === "Escape") {
				finish(false);
			}
		});
		inputElement.addEventListener("blur", () => {
			finish(true);
		});
	}

	//==============================================================================
	// ancestorNode 가 node 의 조상인지. (자기 밑으로 옮기지 못하게)
	//==============================================================================
	/**
	 * @param { object } ancestorNode
	 * @param { object } node
	 * @returns { boolean }
	 */
	isAncestor(ancestorNode, node) {
		let currentNode = node.getParent();
		while (currentNode !== null && currentNode !== undefined) {
			if (currentNode === ancestorNode) {
				return true;
			}
			currentNode = currentNode.getParent();
		}
		return false;
	}
}
