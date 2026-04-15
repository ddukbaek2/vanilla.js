//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Engine } from "../core/engine.js";
import { Graphic } from "../core/graphic.js";
import { TransformNode } from "../core/node/transformnode.js";
import { KeyCode } from "../core/inputmanager.js";
import { Component } from "../core/component.js";
import { LocalStorage } from "./localstorage.js";
import { ViewScaleMode } from "../core/viewmanager.js";


//==============================================================================
// 고정 레이아웃 상수.
//==============================================================================
const TITLE_HEIGHT = 28;
const TAB_HEIGHT = 24;
const ITEM_HEIGHT = 20;
const INDENT_WIDTH = 14;
const SCROLL_BAR_WIDTH = 6;
const GIZMO_CHECKBOX_SIZE = 12;
const GIZMO_CHECKBOX_MARGIN = 4;
const FONT_SIZE = 12;
const PADDING = 7;
const LABEL_COLUMN_WIDTH = 144;
const RESIZE_HANDLE_SIZE = 10;
const SPLITTER_HIT_SIZE = 8;
const MIN_PANEL_WIDTH = 300;
const MIN_PANEL_HEIGHT = 200;
const MIN_LEFT_WIDTH = 80;
const TABS = ["Statistics", "Node Hierarchy", "Local Storage", "Settings"];
const DEFAULT_PANEL_WIDTH = 810;
const DEFAULT_PANEL_HEIGHT = 520;
const DEFAULT_LEFT_WIDTH = 405;
const SETTINGS_STORAGE_KEY = "hierarchy.settings";


//==============================================================================
// 색상 상수.
//==============================================================================
const COLOR_BACKGROUND = "rgba(22, 18, 12, 0.97)";
const COLOR_TITLE_BACKGROUND = "rgba(40, 32, 18, 1)";
const COLOR_BORDER_NORMAL = "rgba(110, 88, 50, 1)";
const COLOR_BORDER_ACTIVE = "rgba(212, 180, 106, 0.9)";
const COLOR_SPLITTER = "rgba(75, 60, 35, 1)";
const COLOR_SPLITTER_ACTIVE = "rgba(212, 180, 106, 0.85)";
const COLOR_RESIZE_CORNER = "rgba(212, 180, 106, 0.5)";
const COLOR_ITEM_SELECTED = "rgba(120, 90, 35, 0.85)";
const COLOR_SECTION_HEADER_BACKGROUND = "rgba(48, 38, 20, 0.9)";
const COLOR_COMPONENT_HEADER_BACKGROUND = "rgba(36, 28, 14, 0.85)";
const COLOR_TEXT = "#d4b896";
const COLOR_TEXT_DIM = "#7a6a50";
const COLOR_ACCENT = "#d4b46a";
const COLOR_COMPONENT = "#a8c870";
const COLOR_PROPERTY_VALUE = "#e8d5a3";
const COLOR_CLOSE_BUTTON = "rgba(140, 55, 28, 0.95)";
const COLOR_INACTIVE_TEXT = "#8c7455";
const COLOR_SCROLLBAR = "rgba(110, 88, 50, 0.55)";
const COLOR_TRUE = "#8cc878";
const COLOR_FALSE = "#c87878";


//==============================================================================
// 리사이즈 모드.
//==============================================================================
const ResizeMode = {
	none: "none",
	top: "top",
	bottom: "bottom",
	left: "left",
	right: "right",
	topLeft: "topLeft",
	bottomLeft: "bottomLeft",
	bottomRight: "bottomRight",
	splitter: "splitter",
};


//==============================================================================
// 트리 목록 항목.
//==============================================================================
class DEVToolsFlatItem {
	/** @type { TransformNode } */ node;
	/** @type { number } */ depth;
	/** @type { boolean } */ effectiveActive;

	/**
	 * @param { TransformNode } node
	 * @param { number } depth
	 * @param { boolean } effectiveActive
	 */
	constructor(node, depth, effectiveActive) {
		this.node = node;
		this.depth = depth;
		this.effectiveActive = effectiveActive;
	}
}


//==============================================================================
// 인스펙터 라인.
//==============================================================================
class InspectorLine {
	/** @type { string | null } */ label;
	/** @type { string } */ value;
	/** @type { string } */ color;
	/** @type { boolean } */ isSeparator;
	/** @type { boolean } */ isSectionHeader;
	/** @type { boolean } */ isComponentHeader;
	/** @type { Component | null } */ componentRef;
	/** @type { boolean } */ isComponentProperty;

	/**
	 * @param { string | null } label
	 * @param { string } value
	 * @param { string } color
	 * @param { boolean } isSeparator
	 * @param { boolean } isSectionHeader
	 * @param { boolean } isComponentHeader
	 * @param { Component | null } componentRef
	 * @param { boolean } isComponentProperty
	 */
	constructor(label, value, color, isSeparator, isSectionHeader, isComponentHeader, componentRef, isComponentProperty) {
		this.label = label;
		this.value = value;
		this.color = color || COLOR_TEXT;
		this.isSeparator = isSeparator || false;
		this.isSectionHeader = isSectionHeader || false;
		this.isComponentHeader = isComponentHeader || false;
		this.componentRef = componentRef || null;
		this.isComponentProperty = isComponentProperty || false;
	}
}


//==============================================================================
// 하이어라키 패널.
// - F2 키로 표시/숨김 토글.
// - 씬 노드 계층 구조를 좌측 트리 + 우측 인스펙터로 표시.
// - 타이틀바 드래그로 패널 이동.
// - 모든 엣지/코너 드래그로 크기 조절.
// - 중앙 구분선 드래그로 좌우 비율 조절.
// - 컴포넌트 헤더 클릭으로 프로퍼티 목록 펼침/접힘 (기본값: 펼침).
//==============================================================================
export class DEVTools extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Engine } */ #engine;
	/** @private @type { TransformNode[] } */ #rootNodes;
	/** @private @type { boolean } */ #isVisible;
	/** @private @type { number } */ #panelX;
	/** @private @type { number } */ #panelY;
	/** @private @type { number } */ #panelWidth;
	/** @private @type { number } */ #panelHeight;
	/** @private @type { number } */ #leftWidth;
	/** @private @type { boolean } */ #isDraggingPanel;
	/** @private @type { number } */ #dragStartMouseX;
	/** @private @type { number } */ #dragStartMouseY;
	/** @private @type { number } */ #dragStartPanelX;
	/** @private @type { number } */ #dragStartPanelY;
	/** @private @type { string } */ #resizeMode;
	/** @private @type { number } */ #resizeDragStartMouseX;
	/** @private @type { number } */ #resizeDragStartMouseY;
	/** @private @type { number } */ #resizeDragStartPanelX;
	/** @private @type { number } */ #resizeDragStartPanelY;
	/** @private @type { number } */ #resizeDragStartPanelWidth;
	/** @private @type { number } */ #resizeDragStartPanelHeight;
	/** @private @type { number } */ #resizeDragStartLeftWidth;
	/** @private @type { TransformNode | null } */ #selectedNode;
	/** @private @type { number } */ #treeScrollY;
	/** @private @type { number } */ #inspectorScrollY;
	/** @private @type { boolean } */ #prevIsKeyF2;
	/** @private @type { DEVToolsFlatItem[] } */ #flatList;
	/** @private @type { Set } */ #expandedNodes;
	/** @private @type { Set } */ #collapsedComponents;
	/** @private @type { InspectorLine[] } */ #cachedInspectorLines;
	/** @private @type { boolean } */ #isTreeScrollDragging;
	/** @private @type { number } */ #treeScrollDragStartMouseY;
	/** @private @type { number } */ #treeScrollDragStartScrollY;
	/** @private @type { boolean } */ #isInspectorScrollDragging;
	/** @private @type { number } */ #inspectorScrollDragStartMouseY;
	/** @private @type { number } */ #inspectorScrollDragStartScrollY;
	/** @private @type { number } */ #activeTab;
	/** @private @type { number } */ #localStorageScrollY;
	/** @private @type { boolean } */ #isLocalStorageScrollDragging;
	/** @private @type { number } */ #localStorageScrollDragStartMouseY;
	/** @private @type { number } */ #localStorageScrollDragStartScrollY;
	/** @private @type { string | null } */ #selectedLocalStorageKey;
	/** @private @type { boolean } */ #isDimEnabled;
	/** @private @type { boolean } */ #isAllGizmosVisible;
	/** @private @type { boolean } */ #isHeightAspectGuideVisible;
	/** @private @type { boolean } */ #isWidthAspectGuideVisible;
	/** @private @type { { x: number, y: number, width: number, height: number }[] } */ #ctxButtonRects;
	/** @private @type { string | null } */ #selectedStatisticsKey;
	/** @private @type { number } */ #statisticsScrollY;
	/** @private @type { boolean } */ #isStatisticsScrollDragging;
	/** @private @type { number } */ #statisticsScrollDragStartMouseY;
	/** @private @type { number } */ #statisticsScrollDragStartScrollY;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();

		this.#engine = null;
		this.#rootNodes = [];
		this.#isVisible = false;
		this.#panelX = 10;
		this.#panelY = 50;
		this.#panelWidth = DEFAULT_PANEL_WIDTH;
		this.#panelHeight = DEFAULT_PANEL_HEIGHT;
		this.#leftWidth = DEFAULT_LEFT_WIDTH;
		this.#isDraggingPanel = false;
		this.#dragStartMouseX = 0;
		this.#dragStartMouseY = 0;
		this.#dragStartPanelX = 0;
		this.#dragStartPanelY = 0;
		this.#resizeMode = ResizeMode.none;
		this.#resizeDragStartMouseX = 0;
		this.#resizeDragStartMouseY = 0;
		this.#resizeDragStartPanelX = 0;
		this.#resizeDragStartPanelY = 0;
		this.#resizeDragStartPanelWidth = 0;
		this.#resizeDragStartPanelHeight = 0;
		this.#resizeDragStartLeftWidth = 0;
		this.#selectedNode = null;
		this.#treeScrollY = 0;
		this.#inspectorScrollY = 0;
		this.#prevIsKeyF2 = false;
		this.#flatList = [];
		this.#expandedNodes = new Set();
		this.#collapsedComponents = new Set();
		this.#cachedInspectorLines = [];
		this.#isTreeScrollDragging = false;
		this.#treeScrollDragStartMouseY = 0;
		this.#treeScrollDragStartScrollY = 0;
		this.#isInspectorScrollDragging = false;
		this.#inspectorScrollDragStartMouseY = 0;
		this.#inspectorScrollDragStartScrollY = 0;
		this.#activeTab = 1;
		this.#localStorageScrollY = 0;
		this.#isLocalStorageScrollDragging = false;
		this.#localStorageScrollDragStartMouseY = 0;
		this.#localStorageScrollDragStartScrollY = 0;
		this.#selectedLocalStorageKey = null;
		this.#isDimEnabled = false;
		this.#isAllGizmosVisible = true;
		this.#isHeightAspectGuideVisible = false;
		this.#isWidthAspectGuideVisible = false;
		this.#ctxButtonRects = [];
		this.loadSettings();
		this.#selectedStatisticsKey = null;
		this.#statisticsScrollY = 0;
		this.#isStatisticsScrollDragging = false;
		this.#statisticsScrollDragStartMouseY = 0;
		this.#statisticsScrollDragStartScrollY = 0;
	}

	//==============================================================================
	// 엔진 설정.
	//==============================================================================
	/**
	 * @param { Engine } engine
	 */
	setEngine(engine) {
		this.#engine = engine;
		const graphic = this.#engine.getGraphic();
		graphic.setForceGizmosVisible(false);
	}

	//==============================================================================
	// 루트 노드 목록 설정.
	//==============================================================================
	/**
	 * @param { TransformNode[] } rootNodes
	 */
	setRootNodes(rootNodes) {
		this.#rootNodes = rootNodes;
		for (let rootIndex = 0; rootIndex < rootNodes.length; ++rootIndex) {
			this.#expandedNodes.add(rootNodes[rootIndex]);
		}
	}

	//==============================================================================
	// 표시 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isVisible() {
		return this.#isVisible;
	}

	//==============================================================================
	// 현재 터치 위치가 패널 내부에 있는지 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isPointerInsidePanel() {
		if (!this.#isVisible || !this.#engine) {
			return false;
		}
		const inputManager = this.#engine.getInputManager();
		const touchPosition = inputManager.getViewInputPosition();
		const touchX = touchPosition.x;
		const touchY = touchPosition.y;
		const isInsideX = touchX >= this.#panelX && touchX <= this.#panelX + this.#panelWidth;
		const isInsideY = touchY >= this.#panelY && touchY <= this.#panelY + this.#panelHeight;
		return isInsideX && isInsideY;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		if (!this.#engine) {
			return;
		}

		const inputManager = this.#engine.getInputManager();
		const isKeyF2 = inputManager.isKeyPressed(KeyCode.f2);

		// F2 just-pressed 감지.
		if (isKeyF2 && !this.#prevIsKeyF2) {
			this.#isVisible = !this.#isVisible;
			const graphic = this.#engine.getGraphic();
			const isForceGizmosVisible = this.#isVisible && this.#isAllGizmosVisible;
			graphic.setForceGizmosVisible(isForceGizmosVisible);
			if (this.#isVisible) {
				const viewManager = this.#engine.getViewManager();
				const canvasNativeSize = viewManager.getCanvasNativeSize();
				const canvasBottomRight = viewManager.canvasPositionToViewPosition(canvasNativeSize);
				this.#panelX = canvasBottomRight.x - this.#panelWidth;
				this.#panelY = canvasBottomRight.y - this.#panelHeight;
			}
		}
		this.#prevIsKeyF2 = isKeyF2;

		if (!this.#isVisible) {
			return;
		}

		// 트리 목록 갱신.
		this.rebuildFlatList();

		const isTouchPressed = inputManager.isTouchPressed();
		const isTouchReleased = inputManager.isTouchReleased();
		const isTouchMoved = inputManager.isTouchMoved();
		const touchPosition = inputManager.getViewInputPosition();
		const touchX = touchPosition.x;
		const touchY = touchPosition.y;

		if (isTouchPressed) {
			this.handlePress(touchX, touchY);
		}
		else if (isTouchMoved) {
			this.handleMove(touchX, touchY);
		}
		else if (isTouchReleased) {
			this.handleRelease(touchX, touchY);
		}
	}

	//==============================================================================
	// 리사이즈 드래그 시작.
	//==============================================================================
	/**
	 * @param { string } mode
	 * @param { number } touchX
	 * @param { number } touchY
	 */
	startResize(mode, touchX, touchY) {
		this.#resizeMode = mode;
		this.#resizeDragStartMouseX = touchX;
		this.#resizeDragStartMouseY = touchY;
		this.#resizeDragStartPanelX = this.#panelX;
		this.#resizeDragStartPanelY = this.#panelY;
		this.#resizeDragStartPanelWidth = this.#panelWidth;
		this.#resizeDragStartPanelHeight = this.#panelHeight;
		this.#resizeDragStartLeftWidth = this.#leftWidth;
	}

	//==============================================================================
	// 눌림 처리.
	//==============================================================================
	/**
	 * @param { number } touchX
	 * @param { number } touchY
	 */
	handlePress(touchX, touchY) {
		const panelX = this.#panelX;
		const panelY = this.#panelY;
		const panelWidth = this.#panelWidth;
		const panelHeight = this.#panelHeight;
		const leftWidth = this.#leftWidth;

		// 패널 범위 밖이면 무시.
		const isInsideX = touchX >= panelX && touchX <= panelX + panelWidth;
		const isInsideY = touchY >= panelY && touchY <= panelY + panelHeight;
		if (!isInsideX || !isInsideY) {
			return;
		}

		// 엣지/코너 근접 여부.
		const nearLeft = touchX <= panelX + RESIZE_HANDLE_SIZE;
		const nearRight = touchX >= panelX + panelWidth - RESIZE_HANDLE_SIZE;
		const nearTop = touchY <= panelY + RESIZE_HANDLE_SIZE;
		const nearBottom = touchY >= panelY + panelHeight - RESIZE_HANDLE_SIZE;

		// 닫기 버튼 영역 (top-right 전용).
		const inCloseButton = touchY <= panelY + TITLE_HEIGHT &&
		                      touchX >= panelX + panelWidth - TITLE_HEIGHT;

		// 코너 리사이즈 (최우선, 닫기 버튼 제외).
		if (nearLeft && nearTop && !inCloseButton) {
			this.startResize(ResizeMode.topLeft, touchX, touchY);
			return;
		}
		if (nearLeft && nearBottom) {
			this.startResize(ResizeMode.bottomLeft, touchX, touchY);
			return;
		}
		if (nearRight && nearBottom) {
			this.startResize(ResizeMode.bottomRight, touchX, touchY);
			return;
		}

		// 엣지 리사이즈.
		if (nearLeft) {
			this.startResize(ResizeMode.left, touchX, touchY);
			return;
		}
		if (nearRight && !inCloseButton) {
			this.startResize(ResizeMode.right, touchX, touchY);
			return;
		}
		if (nearTop && !inCloseButton) {
			this.startResize(ResizeMode.top, touchX, touchY);
			return;
		}
		if (nearBottom) {
			this.startResize(ResizeMode.bottom, touchX, touchY);
			return;
		}

		// 타이틀바 영역.
		if (touchY <= panelY + TITLE_HEIGHT) {
			// 닫기 버튼.
			if (inCloseButton) {
				this.#isVisible = false;
				const graphic = this.#engine.getGraphic();
				graphic.setForceGizmosVisible(false);
				return;
			}
			// 패널 드래그 시작.
			this.#isDraggingPanel = true;
			this.#dragStartMouseX = touchX;
			this.#dragStartMouseY = touchY;
			this.#dragStartPanelX = panelX;
			this.#dragStartPanelY = panelY;
			return;
		}

		// 탭바 영역.
		if (touchY <= panelY + TITLE_HEIGHT + TAB_HEIGHT) {
			const tabWidth = panelWidth / TABS.length;
			const tabIndex = System.Math.floor((touchX - panelX) / tabWidth);
			if (tabIndex >= 0 && tabIndex < TABS.length) {
				this.#activeTab = tabIndex;
			}
			return;
		}

		const contentY = panelY + TITLE_HEIGHT + TAB_HEIGHT + 1;
		const contentHeight = panelHeight - TITLE_HEIGHT - TAB_HEIGHT - 1;

		// Statistics 탭 상호작용 처리.
		if (this.#activeTab === 0) {
			this.handleStatisticsPress(touchX, touchY, panelX, contentY, panelWidth, contentHeight);
			return;
		}

		// Local Storage 탭 상호작용 처리.
		if (this.#activeTab === 2) {
			this.handleLocalStoragePress(touchX, touchY, panelX, contentY, panelWidth, contentHeight);
			return;
		}

		// Settings 탭 상호작용 처리.
		if (this.#activeTab === 3) {
			this.handleSettingsPress(touchX, touchY, panelX, contentY, panelWidth, contentHeight);
			return;
		}

		// Node Hierarchy 탭에서만 트리/인스펙터 상호작용 처리.
		if (this.#activeTab !== 1) {
			return;
		}

		// 스플리터 드래그.
		const splitterX = panelX + leftWidth;
		const isNearSplitter = touchX >= splitterX - SPLITTER_HIT_SIZE / 2 &&
		                       touchX <= splitterX + SPLITTER_HIT_SIZE / 2;
		if (isNearSplitter) {
			this.startResize(ResizeMode.splitter, touchX, touchY);
			return;
		}

		// 트리 영역.
		if (touchX < panelX + leftWidth) {
			const treeItemsY = contentY + ITEM_HEIGHT * 2;
			const localY = touchY - treeItemsY + this.#treeScrollY;
			const clickedIndex = System.Math.floor(localY / ITEM_HEIGHT);

			if (clickedIndex >= 0 && clickedIndex < this.#flatList.length) {
				const clickedItem = this.#flatList[clickedIndex];
				const clickedNode = clickedItem.node;
				const childCount = clickedNode.getChildren().length;

				// 기즈모 체크박스 클릭 감지.
				const checkboxRightX = panelX + leftWidth - SCROLL_BAR_WIDTH - GIZMO_CHECKBOX_MARGIN;
				const checkboxX = checkboxRightX - GIZMO_CHECKBOX_SIZE;
				const itemTopY = treeItemsY + clickedIndex * ITEM_HEIGHT - this.#treeScrollY;
				const itemMidY = itemTopY + ITEM_HEIGHT * 0.5;
				const checkboxY = itemMidY - GIZMO_CHECKBOX_SIZE * 0.5;
				const isCheckboxHit = touchX >= checkboxX && touchX <= checkboxX + GIZMO_CHECKBOX_SIZE &&
				                      touchY >= checkboxY && touchY <= checkboxY + GIZMO_CHECKBOX_SIZE;
				if (isCheckboxHit) {
					clickedNode.setGizmoVisible(!clickedNode.isGizmoVisible());
					return;
				}

				// 액티브 체크박스 클릭 감지.
				const activeCheckboxRightX = checkboxX - GIZMO_CHECKBOX_MARGIN;
				const activeCheckboxX = activeCheckboxRightX - GIZMO_CHECKBOX_SIZE;
				const isActiveCheckboxHit = touchX >= activeCheckboxX && touchX <= activeCheckboxX + GIZMO_CHECKBOX_SIZE &&
				                            touchY >= checkboxY && touchY <= checkboxY + GIZMO_CHECKBOX_SIZE;
				if (isActiveCheckboxHit) {
					clickedNode.setActive(!clickedNode.isActive());
					return;
				}

				if (childCount > 0) {
					if (this.#expandedNodes.has(clickedNode)) {
						this.#expandedNodes.delete(clickedNode);
					}
					else {
						this.#expandedNodes.add(clickedNode);
					}
				}

				this.#selectedNode = clickedNode;
				this.#inspectorScrollY = 0;
			}

			this.#isTreeScrollDragging = true;
			this.#treeScrollDragStartMouseY = touchY;
			this.#treeScrollDragStartScrollY = this.#treeScrollY;
			return;
		}

		// 인스펙터 영역 - 컴포넌트 헤더 클릭 감지.
		const localY = touchY - contentY + this.#inspectorScrollY;
		const clickedLineIndex = System.Math.floor(localY / ITEM_HEIGHT);

		if (clickedLineIndex >= 0 && clickedLineIndex < this.#cachedInspectorLines.length) {
			const clickedLine = this.#cachedInspectorLines[clickedLineIndex];
			if (clickedLine.isComponentHeader && clickedLine.componentRef) {
				const componentRef = clickedLine.componentRef;
				if (this.#collapsedComponents.has(componentRef)) {
					this.#collapsedComponents.delete(componentRef);
				}
				else {
					this.#collapsedComponents.add(componentRef);
				}
				return;
			}
		}

		this.#isInspectorScrollDragging = true;
		this.#inspectorScrollDragStartMouseY = touchY;
		this.#inspectorScrollDragStartScrollY = this.#inspectorScrollY;
	}

	//==============================================================================
	// 이동 처리.
	//==============================================================================
	/**
	 * @param { number } touchX
	 * @param { number } touchY
	 */
	handleMove(touchX, touchY) {
		// 패널 드래그.
		if (this.#isDraggingPanel) {
			const deltaX = touchX - this.#dragStartMouseX;
			const deltaY = touchY - this.#dragStartMouseY;
			this.#panelX = this.#dragStartPanelX + deltaX;
			this.#panelY = this.#dragStartPanelY + deltaY;
		}

		// 리사이즈.
		if (this.#resizeMode !== ResizeMode.none) {
			const deltaX = touchX - this.#resizeDragStartMouseX;
			const deltaY = touchY - this.#resizeDragStartMouseY;

			// 오른쪽 엣지 관련 (우측으로 넓혀짐).
			const isRightMode = this.#resizeMode === ResizeMode.right ||
			                    this.#resizeMode === ResizeMode.bottomRight;
			if (isRightMode) {
				const newWidth = this.#resizeDragStartPanelWidth + deltaX;
				this.#panelWidth = System.Math.max(MIN_PANEL_WIDTH, newWidth);
			}

			// 왼쪽 엣지 관련 (좌측으로 넓혀짐 = panelX 이동 + 너비 변화).
			const isLeftMode = this.#resizeMode === ResizeMode.left ||
			                   this.#resizeMode === ResizeMode.topLeft ||
			                   this.#resizeMode === ResizeMode.bottomLeft;
			if (isLeftMode) {
				const newWidth = this.#resizeDragStartPanelWidth - deltaX;
				if (newWidth >= MIN_PANEL_WIDTH) {
					this.#panelWidth = newWidth;
					this.#panelX = this.#resizeDragStartPanelX + deltaX;
				}
			}

			// 아래쪽 엣지 관련 (아래로 높여짐).
			const isBottomMode = this.#resizeMode === ResizeMode.bottom ||
			                     this.#resizeMode === ResizeMode.bottomRight ||
			                     this.#resizeMode === ResizeMode.bottomLeft;
			if (isBottomMode) {
				const newHeight = this.#resizeDragStartPanelHeight + deltaY;
				this.#panelHeight = System.Math.max(MIN_PANEL_HEIGHT, newHeight);
			}

			// 위쪽 엣지 관련 (위로 높여짐 = panelY 이동 + 높이 변화).
			const isTopMode = this.#resizeMode === ResizeMode.top ||
			                  this.#resizeMode === ResizeMode.topLeft;
			if (isTopMode) {
				const newHeight = this.#resizeDragStartPanelHeight - deltaY;
				if (newHeight >= MIN_PANEL_HEIGHT) {
					this.#panelHeight = newHeight;
					this.#panelY = this.#resizeDragStartPanelY + deltaY;
				}
			}

			// 스플리터 드래그.
			if (this.#resizeMode === ResizeMode.splitter) {
				const newLeftWidth = this.#resizeDragStartLeftWidth + deltaX;
				const maxLeftWidth = this.#panelWidth - MIN_LEFT_WIDTH;
				this.#leftWidth = System.Math.max(MIN_LEFT_WIDTH, System.Math.min(maxLeftWidth, newLeftWidth));
			}
		}

		// 트리 스크롤.
		if (this.#isTreeScrollDragging) {
			const deltaY = touchY - this.#treeScrollDragStartMouseY;
			const newScrollY = this.#treeScrollDragStartScrollY - deltaY;
			this.#treeScrollY = System.Math.max(0, newScrollY);
		}

		// 인스펙터 스크롤.
		if (this.#isInspectorScrollDragging) {
			const deltaY = touchY - this.#inspectorScrollDragStartMouseY;
			const newScrollY = this.#inspectorScrollDragStartScrollY - deltaY;
			this.#inspectorScrollY = System.Math.max(0, newScrollY);
		}

		// 로컬 스토리지 스크롤.
		if (this.#isLocalStorageScrollDragging) {
			const deltaY = touchY - this.#localStorageScrollDragStartMouseY;
			const newScrollY = this.#localStorageScrollDragStartScrollY - deltaY;
			this.#localStorageScrollY = System.Math.max(0, newScrollY);
		}

		// 통계 스크롤.
		if (this.#isStatisticsScrollDragging) {
			const deltaY = touchY - this.#statisticsScrollDragStartMouseY;
			const newScrollY = this.#statisticsScrollDragStartScrollY - deltaY;
			this.#statisticsScrollY = System.Math.max(0, newScrollY);
		}
	}

	//==============================================================================
	// 뗌 처리.
	//==============================================================================
	/**
	 * @param { number } touchX
	 * @param { number } touchY
	 */
	handleRelease(touchX, touchY) {
		this.#isDraggingPanel = false;
		this.#resizeMode = ResizeMode.none;
		this.#isTreeScrollDragging = false;
		this.#isInspectorScrollDragging = false;
		this.#isLocalStorageScrollDragging = false;
		this.#isStatisticsScrollDragging = false;
	}

	//==============================================================================
	// 로컬 스토리지 탭 눌림 처리.
	//==============================================================================
	/**
	 * @param { number } touchX
	 * @param { number } touchY
	 * @param { number } panelX
	 * @param { number } panelY
	 * @param { number } panelWidth
	 * @param { number } panelHeight
	 */
	handleLocalStoragePress(touchX, touchY, panelX, panelY, panelWidth, panelHeight) {
		const addBtnWidth = 48;
		const clearBtnWidth = 48;
		const btnHeight = ITEM_HEIGHT - 4;
		const btnY = panelY + 2;
		const clearBtnX = panelX + panelWidth - PADDING - clearBtnWidth;
		const addBtnX = clearBtnX - PADDING - addBtnWidth;

		// + Add 버튼 클릭.
		if (touchX >= addBtnX && touchX <= addBtnX + addBtnWidth &&
		    touchY >= btnY && touchY <= btnY + btnHeight) {
			const newKey = System.window.prompt("키 입력:");
			if (newKey !== null && newKey.trim() !== "") {
				const newValue = System.window.prompt("값 입력:") || "";
				LocalStorage.setString(newKey.trim(), newValue);
			}
			return;
		}

		// Clear 버튼 클릭.
		if (touchX >= clearBtnX && touchX <= clearBtnX + clearBtnWidth &&
		    touchY >= btnY && touchY <= btnY + btnHeight) {
			if (System.window.confirm("모든 로컬 스토리지 항목을 삭제하시겠습니까?")) {
				LocalStorage.clear();
				this.#selectedLocalStorageKey = null;
			}
			return;
		}

		// 선택 컨텍스트 메뉴 클릭.
		const contextMenuHeight = ITEM_HEIGHT + 8;
		const hasSelection = this.#selectedLocalStorageKey !== null;
		if (hasSelection) {
			const contextMenuY = panelY + panelHeight - contextMenuHeight;
			if (touchY >= contextMenuY) {
				const selectedKey = this.#selectedLocalStorageKey;
				let buttonIndex = -1;
				for (let rectIndex = 0; rectIndex < this.#ctxButtonRects.length; ++rectIndex) {
					const buttonRect = this.#ctxButtonRects[rectIndex];
					const isHitX = touchX >= buttonRect.x && touchX <= buttonRect.x + buttonRect.width;
					const isHitY = touchY >= buttonRect.y && touchY <= buttonRect.y + buttonRect.height;
					if (isHitX && isHitY) {
						buttonIndex = rectIndex;
						break;
					}
				}
				if (buttonIndex >= 0) {
					switch (buttonIndex) {
						case 0: {
							// Edit Key.
							const newKey = System.window.prompt("키 이름 수정:", selectedKey);
							if (newKey !== null && newKey.trim() !== "" && newKey.trim() !== selectedKey) {
								const existingValue = LocalStorage.getString(selectedKey) || "";
								LocalStorage.remove(selectedKey);
								LocalStorage.setString(newKey.trim(), existingValue);
								this.#selectedLocalStorageKey = newKey.trim();
							}
							break;
						}
						case 1: {
							// Edit Value.
							const currentValue = LocalStorage.getString(selectedKey) || "";
							const newValue = System.window.prompt(`"${selectedKey}" 값 수정:`, currentValue);
							if (newValue !== null) {
								LocalStorage.setString(selectedKey, newValue);
							}
							break;
						}
						case 2: {
							// Duplicate.
							const cloneKey = selectedKey + " (Clone)";
							const cloneValue = LocalStorage.getString(selectedKey) || "";
							LocalStorage.setString(cloneKey, cloneValue);
							this.#selectedLocalStorageKey = cloneKey;
							break;
						}
						case 3: {
							// Remove.
							if (System.window.confirm(`"${selectedKey}" 항목을 삭제하시겠습니까?`)) {
								LocalStorage.remove(selectedKey);
								this.#selectedLocalStorageKey = null;
							}
							break;
						}
					}
				}
				return;
			}
		}

		// 아이템 목록 영역 클릭.
		const itemsY = panelY + ITEM_HEIGHT * 2;
		const keys = LocalStorage.getKeys();
		const delColWidth = 24;
		const localY = touchY - itemsY + this.#localStorageScrollY;
		const clickedIndex = System.Math.floor(localY / ITEM_HEIGHT);

		if (touchY >= itemsY && clickedIndex >= 0 && clickedIndex < keys.length) {
			const clickedKey = keys[clickedIndex];

			// 삭제(×) 버튼 클릭.
			const delBtnX = panelX + panelWidth - SCROLL_BAR_WIDTH - delColWidth;
			if (touchX >= delBtnX) {
				if (System.window.confirm(`"${clickedKey}" 항목을 삭제하시겠습니까?`)) {
					LocalStorage.remove(clickedKey);
					if (this.#selectedLocalStorageKey === clickedKey) {
						this.#selectedLocalStorageKey = null;
					}
				}
				return;
			}

			// 행 클릭 → 선택 / 선택해제 토글.
			if (this.#selectedLocalStorageKey === clickedKey) {
				this.#selectedLocalStorageKey = null;
			}
			else {
				this.#selectedLocalStorageKey = clickedKey;
			}
		}
		else if (touchY >= itemsY) {
			// 아이템 아래 빈 영역 클릭 → 선택 해제.
			this.#selectedLocalStorageKey = null;
		}

		// 아이템 영역 전체에서 스크롤 드래그 시작.
		if (touchY >= itemsY) {
			this.#isLocalStorageScrollDragging = true;
			this.#localStorageScrollDragStartMouseY = touchY;
			this.#localStorageScrollDragStartScrollY = this.#localStorageScrollY;
		}
	}

	//==============================================================================
	// 트리 목록 재구성.
	//==============================================================================
	rebuildFlatList() {
		this.#flatList = [];
		for (let rootIndex = 0; rootIndex < this.#rootNodes.length; ++rootIndex) {
			const rootNode = this.#rootNodes[rootIndex];
			this.collectNode(rootNode, 0, true);
		}
	}

	//==============================================================================
	// 노드를 플랫 목록에 재귀 추가.
	//==============================================================================
	/**
	 * @param { TransformNode } node
	 * @param { number } depth
	 * @param { boolean } parentActive
	 */
	collectNode(node, depth, parentActive) {
		const isNodeActive = node.isActive();
		const effectiveActive = parentActive && isNodeActive;
		const flatItem = new DEVToolsFlatItem(node, depth, effectiveActive);
		this.#flatList.push(flatItem);

		const isExpanded = this.#expandedNodes.has(node);
		if (!isExpanded) {
			return;
		}

		const children = node.getChildren();
		for (let childIndex = 0; childIndex < children.length; ++childIndex) {
			this.collectNode(children[childIndex], depth + 1, effectiveActive);
		}
	}

	//==============================================================================
	// 컴포넌트의 get*/is* 프로퍼티 목록 수집.
	//==============================================================================
	/**
	 * @param { Component } component
	 * @returns { { name: string, value: * }[] }
	 */
	getComponentProperties(component) {
		const properties = [];
		const seenNames = new Set();
		let proto = System.Object.getPrototypeOf(component);

		while (proto && proto.constructor &&
		       proto.constructor !== Component &&
		       proto !== System.Object.prototype) {
			const methodNames = System.Object.getOwnPropertyNames(proto);
			for (let i = 0; i < methodNames.length; ++i) {
				const methodName = methodNames[i];
				if (seenNames.has(methodName)) {
					continue;
				}
				seenNames.add(methodName);
				if (typeof component[methodName] !== "function") {
					continue;
				}
				if (component[methodName].length !== 0) {
					continue;
				}
				const isGetter = methodName.startsWith("get") || methodName.startsWith("is");
				if (!isGetter) {
					continue;
				}
				if (methodName === "constructor" || methodName === "getNode") {
					continue;
				}
				try {
					const value = component[methodName]();
					properties.push({ name: methodName, value });
				}
				catch (error) {
					// 오류 발생 시 건너뜀.
				}
			}
			proto = System.Object.getPrototypeOf(proto);
		}

		return properties;
	}

	//==============================================================================
	// get* 메서드명을 프로퍼티명 형식으로 변환. (getTextColor → textColor)
	//==============================================================================
	/**
	 * @param { string } methodName
	 * @returns { string }
	 */
	formatMethodName(methodName) {
		if (methodName.startsWith("get") && methodName.length > 3) {
			const trimmed = methodName.slice(3);
			return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
		}
		return methodName;
	}

	//==============================================================================
	// 프로퍼티 값을 문자열로 포맷.
	//==============================================================================
	/**
	 * @param { * } value
	 * @returns { string }
	 */
	formatPropertyValue(value) {
		if (value === null) {
			return "null";
		}
		if (value === undefined) {
			return "undefined";
		}
		if (typeof value === "boolean") {
			return value ? "true" : "false";
		}
		if (typeof value === "number") {
			return value.toFixed(2);
		}
		if (typeof value === "string") {
			const truncated = value.length > 28 ? value.slice(0, 25) + "..." : value;
			return `"${truncated}"`;
		}
		if (typeof value === "object") {
			// Vector2-like.
			if (typeof value.x === "number" && typeof value.y === "number" && !("width" in value)) {
				return `(${value.x.toFixed(2)}, ${value.y.toFixed(2)})`;
			}
			// Rect-like (Rect 클래스는 position.x/y에 좌표가 있고 x/y 직접 프로퍼티가 없음).
			if (typeof value.width === "number" && typeof value.height === "number") {
				let rawX = value.x;
				let rawY = value.y;
				if (typeof rawX !== "number" && value.position) {
					rawX = value.position.x;
				}
				if (typeof rawY !== "number" && value.position) {
					rawY = value.position.y;
				}
				const rectX = typeof rawX === "number" ? rawX.toFixed(1) : "?";
				const rectY = typeof rawY === "number" ? rawY.toFixed(1) : "?";
				return `(${rectX}, ${rectY}, ${value.width.toFixed(1)}, ${value.height.toFixed(1)})`;
			}
			// Color-like (red, green, blue 프로퍼티).
			if (typeof value.red === "number" && typeof value.green === "number" && typeof value.blue === "number") {
				const r = System.Math.round(value.red * 255);
				const g = System.Math.round(value.green * 255);
				const b = System.Math.round(value.blue * 255);
				const a = typeof value.alpha === "number" ? value.alpha.toFixed(2) : "1";
				return `rgba(${r}, ${g}, ${b}, ${a})`;
			}
			const typeName = value.constructor ? value.constructor.name : "object";
			return `[${typeName}]`;
		}
		return String(value);
	}

	//==============================================================================
	// 인스펙터 라인 목록 구성.
	//==============================================================================
	/**
	 * @param { TransformNode } node
	 * @returns { InspectorLine[] }
	 */
	buildInspectorLines(node) {
		const lines = [];

		// Node 섹션 헤더.
		lines.push(new InspectorLine("Node", "", COLOR_ACCENT, false, true, false, null, false));

		// 기본 정보.
		const nodeName = node.getName() || "(unnamed)";
		const nodeTypeName = node.nodeType || node.constructor.name;
		const isActive = node.isActive();
		const childCount = node.getChildren().length;
		lines.push(new InspectorLine("name", nodeName, COLOR_TEXT, false, false, false, null, false));
		lines.push(new InspectorLine("type", nodeTypeName, COLOR_ACCENT, false, false, false, null, false));
		lines.push(new InspectorLine("active", isActive ? "true" : "false", isActive ? COLOR_TRUE : COLOR_FALSE, false, false, false, null, false));
		lines.push(new InspectorLine("children", String(childCount), COLOR_TEXT, false, false, false, null, false));

		// 트랜스폼 정보.
		if (typeof node.getLocalPosition === "function") {
			const localPosition = node.getLocalPosition();
			const positionText = `(${localPosition.x.toFixed(1)}, ${localPosition.y.toFixed(1)})`;
			lines.push(new InspectorLine("localPos", positionText, COLOR_TEXT, false, false, false, null, false));
		}
		if (typeof node.getLocalScale === "function") {
			const localScale = node.getLocalScale();
			const scaleText = `(${localScale.x.toFixed(3)}, ${localScale.y.toFixed(3)})`;
			lines.push(new InspectorLine("localScale", scaleText, COLOR_TEXT, false, false, false, null, false));
		}
		if (typeof node.getLocalRotation === "function") {
			const localRotation = node.getLocalRotation();
			lines.push(new InspectorLine("localRot", `${localRotation.toFixed(2)} deg`, COLOR_TEXT, false, false, false, null, false));
		}
		if (typeof node.getLocalOpacity === "function") {
			const localOpacity = node.getLocalOpacity();
			lines.push(new InspectorLine("opacity", localOpacity.toFixed(3), COLOR_TEXT, false, false, false, null, false));
		}
		if (typeof node.getContentSize === "function") {
			const contentSize = node.getContentSize();
			const sizeText = `(${contentSize.x.toFixed(1)}, ${contentSize.y.toFixed(1)})`;
			lines.push(new InspectorLine("contentSize", sizeText, COLOR_TEXT, false, false, false, null, false));
		}
		if (typeof node.getPivot === "function") {
			const pivot = node.getPivot();
			const pivotText = `(${pivot.x.toFixed(3)}, ${pivot.y.toFixed(3)})`;
			lines.push(new InspectorLine("pivot", pivotText, COLOR_TEXT, false, false, false, null, false));
		}

		// 구분선.
		lines.push(new InspectorLine(null, "", COLOR_TEXT, true, false, false, null, false));

		// Components 섹션 헤더.
		lines.push(new InspectorLine("Components", "", COLOR_ACCENT, false, true, false, null, false));

		if (typeof node.getAllComponents === "function") {
			const components = node.getAllComponents();
			if (components.length === 0) {
				lines.push(new InspectorLine(null, "(없음)", COLOR_TEXT_DIM, false, false, false, null, false));
			}
			else {
				for (let componentIndex = 0; componentIndex < components.length; ++componentIndex) {
					const component = components[componentIndex];
					const componentTypeName = component.getComponentType() || component.constructor.name;
					// 기본 펼침: collapsedComponents에 없으면 펼쳐진 상태.
					const isExpanded = !this.#collapsedComponents.has(component);

					// 컴포넌트 헤더.
					lines.push(new InspectorLine(null, componentTypeName, COLOR_COMPONENT, false, false, true, component, false));

					// 펼쳐진 경우 프로퍼티 목록.
					if (isExpanded) {
						const componentProperties = this.getComponentProperties(component);
						if (componentProperties.length === 0) {
							lines.push(new InspectorLine(null, "(프로퍼티 없음)", COLOR_TEXT_DIM, false, false, false, null, true));
						}
						else {
							for (let propIndex = 0; propIndex < componentProperties.length; ++propIndex) {
								const componentProperty = componentProperties[propIndex];
								const propName = this.formatMethodName(componentProperty.name);
								const propValue = this.formatPropertyValue(componentProperty.value);
								lines.push(new InspectorLine(propName, propValue, COLOR_PROPERTY_VALUE, false, false, false, null, true));
							}
						}
					}
				}
			}
		}
		else {
			lines.push(new InspectorLine(null, "(없음)", COLOR_TEXT_DIM, false, false, false, null, false));
		}

		// 캐시 저장.
		this.#cachedInspectorLines = lines;
		return lines;
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 */
	draw(graphic) {
		if (!this.#isVisible) {
			return;
		}

		const canvasRenderingContext = graphic.getCanvasRenderingContext();
		canvasRenderingContext.save();

		const panelX = this.#panelX;
		const panelY = this.#panelY;
		const panelWidth = this.#panelWidth;
		const panelHeight = this.#panelHeight;
		const leftWidth = this.#leftWidth;

		// 딤드 배경 (캔버스 전체를 덮음 - 이후 패널이 위에 그려지므로 패널 외부만 딤드 효과).
		if (this.#isDimEnabled) {
			canvasRenderingContext.save();
			canvasRenderingContext.setTransform(1, 0, 0, 1, 0, 0);
			canvasRenderingContext.fillStyle = "rgba(0, 0, 0, 0.5)";
			canvasRenderingContext.fillRect(0, 0, canvasRenderingContext.canvas.width, canvasRenderingContext.canvas.height);
			canvasRenderingContext.restore();
		}

		// 화면 비율 가이드라인 출력.
		this.drawAspectGuide(graphic);

		// 배경.
		canvasRenderingContext.fillStyle = COLOR_BACKGROUND;
		canvasRenderingContext.fillRect(panelX, panelY, panelWidth, panelHeight);

		// 타이틀바 배경.
		canvasRenderingContext.fillStyle = COLOR_TITLE_BACKGROUND;
		canvasRenderingContext.fillRect(panelX, panelY, panelWidth, TITLE_HEIGHT);

		// 타이틀 텍스트.
		canvasRenderingContext.fillStyle = COLOR_ACCENT;
		canvasRenderingContext.font = `bold ${FONT_SIZE}px monospace`;
		canvasRenderingContext.textAlign = "left";
		canvasRenderingContext.textBaseline = "middle";
		canvasRenderingContext.fillText("Runtime DEV Tools", panelX + PADDING, panelY + TITLE_HEIGHT * 0.5);

		// 닫기 버튼.
		const closeBtnX = panelX + panelWidth - TITLE_HEIGHT;
		canvasRenderingContext.fillStyle = COLOR_CLOSE_BUTTON;
		canvasRenderingContext.fillRect(closeBtnX, panelY, TITLE_HEIGHT, TITLE_HEIGHT);
		canvasRenderingContext.fillStyle = "#ffffff";
		canvasRenderingContext.font = `bold ${FONT_SIZE}px monospace`;
		canvasRenderingContext.textAlign = "center";
		canvasRenderingContext.textBaseline = "middle";
		canvasRenderingContext.fillText("X", closeBtnX + TITLE_HEIGHT * 0.5, panelY + TITLE_HEIGHT * 0.5);

		// 타이틀바 하단 구분선.
		canvasRenderingContext.strokeStyle = COLOR_SPLITTER;
		canvasRenderingContext.lineWidth = 1;
		canvasRenderingContext.beginPath();
		canvasRenderingContext.moveTo(panelX, panelY + TITLE_HEIGHT + 0.5);
		canvasRenderingContext.lineTo(panelX + panelWidth, panelY + TITLE_HEIGHT + 0.5);
		canvasRenderingContext.stroke();

		// 탭바.
		const tabWidth = panelWidth / TABS.length;
		for (let tabIndex = 0; tabIndex < TABS.length; ++tabIndex) {
			const tabX = panelX + tabIndex * tabWidth;
			const isActiveTab = tabIndex === this.#activeTab;
			canvasRenderingContext.fillStyle = isActiveTab ? COLOR_SECTION_HEADER_BACKGROUND : COLOR_COMPONENT_HEADER_BACKGROUND;
			canvasRenderingContext.fillRect(tabX, panelY + TITLE_HEIGHT, tabWidth, TAB_HEIGHT);
			canvasRenderingContext.fillStyle = isActiveTab ? COLOR_ACCENT : COLOR_TEXT_DIM;
			canvasRenderingContext.font = `${FONT_SIZE}px monospace`;
			canvasRenderingContext.textAlign = "center";
			canvasRenderingContext.textBaseline = "middle";
			canvasRenderingContext.fillText(TABS[tabIndex], tabX + tabWidth * 0.5, panelY + TITLE_HEIGHT + TAB_HEIGHT * 0.5);
		}
		// 탭바 하단 구분선.
		canvasRenderingContext.strokeStyle = COLOR_SPLITTER;
		canvasRenderingContext.lineWidth = 1;
		canvasRenderingContext.beginPath();
		canvasRenderingContext.moveTo(panelX, panelY + TITLE_HEIGHT + TAB_HEIGHT + 0.5);
		canvasRenderingContext.lineTo(panelX + panelWidth, panelY + TITLE_HEIGHT + TAB_HEIGHT + 0.5);
		canvasRenderingContext.stroke();

		const contentY = panelY + TITLE_HEIGHT + TAB_HEIGHT + 1;
		const contentHeight = panelHeight - TITLE_HEIGHT - TAB_HEIGHT - 1;
		const rightPanelX = panelX + leftWidth + 1;
		const rightPanelWidth = panelWidth - leftWidth - 1;

		if (this.#activeTab === 0) {
			// 통계 패널 출력.
			this.drawStatisticsPanel(canvasRenderingContext, panelX, contentY, panelWidth, contentHeight);
		}
		else if (this.#activeTab === 1) {
			// 트리 패널 출력.
			this.drawTreePanel(canvasRenderingContext, panelX, contentY, leftWidth, contentHeight);

			// 좌우 구분선.
			const isSplitterActive = this.#resizeMode === ResizeMode.splitter;
			canvasRenderingContext.fillStyle = isSplitterActive ? COLOR_SPLITTER_ACTIVE : COLOR_SPLITTER;
			canvasRenderingContext.fillRect(panelX + leftWidth, contentY, 1, contentHeight);

			// 인스펙터 패널 출력.
			this.drawInspectorPanel(canvasRenderingContext, rightPanelX, contentY, rightPanelWidth, contentHeight);
		}
		else if (this.#activeTab === 2) {
			// 로컬 스토리지 패널 출력.
			this.drawLocalStoragePanel(canvasRenderingContext, panelX, contentY, panelWidth, contentHeight);
		}
		else if (this.#activeTab === 3) {
			// 세팅 패널 출력.
			this.drawSettingsPanel(canvasRenderingContext, panelX, contentY, panelWidth, contentHeight);
		}
		else {
			canvasRenderingContext.fillStyle = COLOR_TEXT_DIM;
			canvasRenderingContext.font = `${FONT_SIZE}px monospace`;
			canvasRenderingContext.textAlign = "center";
			canvasRenderingContext.textBaseline = "middle";
			canvasRenderingContext.fillText(TABS[this.#activeTab], panelX + panelWidth * 0.5, contentY + contentHeight * 0.5);
		}

		// 테두리 (리사이즈 중이면 하이라이팅, 항상 최상단에 그림).
		const isResizing = this.#resizeMode !== ResizeMode.none &&
		                   this.#resizeMode !== ResizeMode.splitter;
		canvasRenderingContext.strokeStyle = isResizing ? COLOR_BORDER_ACTIVE : COLOR_BORDER_NORMAL;
		canvasRenderingContext.lineWidth = isResizing ? 2 : 1;
		canvasRenderingContext.strokeRect(panelX + 0.5, panelY + 0.5, panelWidth - 1, panelHeight - 1);

		canvasRenderingContext.restore();
	}

	//==============================================================================
	// 트리 패널 출력.
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { number } panelX
	 * @param { number } panelY
	 * @param { number } panelWidth
	 * @param { number } panelHeight
	 */
	drawTreePanel(canvasRenderingContext, panelX, panelY, panelWidth, panelHeight) {
		canvasRenderingContext.save();
		canvasRenderingContext.beginPath();
		canvasRenderingContext.rect(panelX, panelY, panelWidth, panelHeight);
		canvasRenderingContext.clip();

		// 트리 패널 제목.
		canvasRenderingContext.fillStyle = COLOR_SECTION_HEADER_BACKGROUND;
		canvasRenderingContext.fillRect(panelX, panelY, panelWidth, ITEM_HEIGHT);
		canvasRenderingContext.fillStyle = COLOR_ACCENT;
		canvasRenderingContext.font = `bold ${FONT_SIZE}px monospace`;
		canvasRenderingContext.textBaseline = "middle";
		canvasRenderingContext.textAlign = "left";
		canvasRenderingContext.fillText("Hierarchy", panelX + PADDING, panelY + ITEM_HEIGHT * 0.5);

		// 컬럼 헤더 행.
		const columnHeaderY = panelY + ITEM_HEIGHT;
		const columnHeaderMidY = columnHeaderY + ITEM_HEIGHT * 0.5;
		canvasRenderingContext.fillStyle = COLOR_COMPONENT_HEADER_BACKGROUND;
		canvasRenderingContext.fillRect(panelX, columnHeaderY, panelWidth, ITEM_HEIGHT);
		const headerCheckboxRightX = panelX + panelWidth - SCROLL_BAR_WIDTH - GIZMO_CHECKBOX_MARGIN;
		const headerGizmoCheckboxX = headerCheckboxRightX - GIZMO_CHECKBOX_SIZE;
		const headerActiveCheckboxX = headerGizmoCheckboxX - GIZMO_CHECKBOX_MARGIN - GIZMO_CHECKBOX_SIZE;
		canvasRenderingContext.font = `${FONT_SIZE - 1}px monospace`;
		canvasRenderingContext.textBaseline = "middle";
		canvasRenderingContext.fillStyle = COLOR_TEXT_DIM;
		canvasRenderingContext.textAlign = "left";
		canvasRenderingContext.fillText("Name", panelX + PADDING + 12, columnHeaderMidY);
		canvasRenderingContext.textAlign = "right";
		canvasRenderingContext.fillText("Type", headerActiveCheckboxX - GIZMO_CHECKBOX_MARGIN, columnHeaderMidY);
		canvasRenderingContext.textAlign = "center";
		canvasRenderingContext.fillText("A", headerActiveCheckboxX + GIZMO_CHECKBOX_SIZE * 0.5, columnHeaderMidY);
		canvasRenderingContext.fillText("G", headerGizmoCheckboxX + GIZMO_CHECKBOX_SIZE * 0.5, columnHeaderMidY);

		const itemsY = panelY + ITEM_HEIGHT * 2;
		const itemsHeight = panelHeight - ITEM_HEIGHT * 2;
		const totalItemsHeight = this.#flatList.length * ITEM_HEIGHT;

		if (totalItemsHeight > itemsHeight) {
			const maxTreeScrollY = totalItemsHeight - itemsHeight;
			this.#treeScrollY = System.Math.min(this.#treeScrollY, maxTreeScrollY);
		}
		else {
			this.#treeScrollY = 0;
		}

		// 항목 영역만 클립 (헤더가 스크롤에 가려지지 않도록).
		canvasRenderingContext.save();
		canvasRenderingContext.beginPath();
		canvasRenderingContext.rect(panelX, itemsY, panelWidth, itemsHeight);
		canvasRenderingContext.clip();

		for (let itemIndex = 0; itemIndex < this.#flatList.length; ++itemIndex) {
			try {

			const flatItem = this.#flatList[itemIndex];
			const itemY = itemsY + itemIndex * ITEM_HEIGHT - this.#treeScrollY;

			if (itemY + ITEM_HEIGHT < itemsY || itemY > itemsY + itemsHeight) {
				continue;
			}

			const node = flatItem.node;
			const depth = flatItem.depth;
			const isSelected = node === this.#selectedNode;
			const hasChildren = node.getChildren().length > 0;
			const isExpanded = this.#expandedNodes.has(node);
			const isActive = node.isActive();
			const effectiveActive = flatItem.effectiveActive;
			const itemMidY = itemY + ITEM_HEIGHT * 0.5;

			if (isSelected) {
				canvasRenderingContext.fillStyle = COLOR_ITEM_SELECTED;
				canvasRenderingContext.fillRect(panelX, itemY, panelWidth, ITEM_HEIGHT);
			}

			const indentX = panelX + PADDING + depth * INDENT_WIDTH;

			if (hasChildren) {
				canvasRenderingContext.fillStyle = isExpanded ? COLOR_ACCENT : COLOR_TEXT_DIM;
				canvasRenderingContext.font = `${FONT_SIZE}px monospace`;
				canvasRenderingContext.textBaseline = "middle";
				canvasRenderingContext.textAlign = "left";
				const triangleText = isExpanded ? "v" : ">";
				canvasRenderingContext.fillText(triangleText, indentX, itemMidY);
			}

			const nodeName = node.getName() || "(unnamed)";
			canvasRenderingContext.fillStyle = effectiveActive ? COLOR_TEXT : COLOR_INACTIVE_TEXT;
			canvasRenderingContext.font = `${FONT_SIZE}px monospace`;
			canvasRenderingContext.textBaseline = "middle";
			canvasRenderingContext.textAlign = "left";
			canvasRenderingContext.fillText(nodeName, indentX + 12, itemMidY);

			const nodeTypeName = node.nodeType || node.constructor.name;
			canvasRenderingContext.fillStyle = COLOR_TEXT_DIM;
			canvasRenderingContext.font = `${FONT_SIZE - 1}px monospace`;
			canvasRenderingContext.textAlign = "right";

			// 기즈모 체크박스 (우측 끝 SCROLL_BAR_WIDTH+GIZMO_CHECKBOX_MARGIN 안쪽).
			const checkboxRightX = panelX + panelWidth - SCROLL_BAR_WIDTH - GIZMO_CHECKBOX_MARGIN;
			const checkboxX = checkboxRightX - GIZMO_CHECKBOX_SIZE;
			const checkboxY = System.Math.floor(itemMidY - GIZMO_CHECKBOX_SIZE * 0.5);
			const isGizmoVisible = typeof node.isGizmoVisible === "function" ? node.isGizmoVisible() : false;
			// 외곽 테두리 (항상 ACCENT 색).
			canvasRenderingContext.fillStyle = COLOR_ACCENT;
			canvasRenderingContext.fillRect(checkboxX, checkboxY, GIZMO_CHECKBOX_SIZE, GIZMO_CHECKBOX_SIZE);
			// 내부 (꺼졌으면 배경색으로 채워 빈 박스처럼, 켜졌으면 그대로 채움).
			if (!isGizmoVisible) {
				canvasRenderingContext.fillStyle = "#16120a";
				canvasRenderingContext.fillRect(checkboxX + 2, checkboxY + 2, GIZMO_CHECKBOX_SIZE - 4, GIZMO_CHECKBOX_SIZE - 4);
			}

			// 액티브 체크박스 (기즈모 체크박스 왼쪽).
			const activeCheckboxRightX = checkboxX - GIZMO_CHECKBOX_MARGIN;
			const activeCheckboxX = activeCheckboxRightX - GIZMO_CHECKBOX_SIZE;
			// 외곽 테두리.
			canvasRenderingContext.fillStyle = isActive ? COLOR_TRUE : COLOR_FALSE;
			canvasRenderingContext.fillRect(activeCheckboxX, checkboxY, GIZMO_CHECKBOX_SIZE, GIZMO_CHECKBOX_SIZE);
			// 내부 (비활성이면 빈 박스처럼, 활성이면 채움).
			if (!isActive) {
				canvasRenderingContext.fillStyle = "#16120a";
				canvasRenderingContext.fillRect(activeCheckboxX + 2, checkboxY + 2, GIZMO_CHECKBOX_SIZE - 4, GIZMO_CHECKBOX_SIZE - 4);
			}

			// 노드 타입 텍스트 (액티브 체크박스 왼쪽에 우측 정렬).
			canvasRenderingContext.fillStyle = COLOR_TEXT_DIM;
			canvasRenderingContext.fillText(nodeTypeName, activeCheckboxX - GIZMO_CHECKBOX_MARGIN, itemMidY);

			}
			catch (error) {
				// 아이템 렌더링 오류 무시 (canvas save/restore 불균형 방지).
			}
		}

		canvasRenderingContext.restore();

		if (totalItemsHeight > itemsHeight) {
			const maxTreeScrollY = totalItemsHeight - itemsHeight;
			const scrollRatio = this.#treeScrollY / maxTreeScrollY;
			const barHeight = System.Math.max(20, itemsHeight * itemsHeight / totalItemsHeight);
			const barY = itemsY + scrollRatio * (itemsHeight - barHeight);
			canvasRenderingContext.fillStyle = COLOR_SCROLLBAR;
			canvasRenderingContext.fillRect(panelX + panelWidth - SCROLL_BAR_WIDTH, barY, SCROLL_BAR_WIDTH, barHeight);
		}

		canvasRenderingContext.restore();
	}

	//==============================================================================
	// 인스펙터 패널 출력.
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { number } panelX
	 * @param { number } panelY
	 * @param { number } panelWidth
	 * @param { number } panelHeight
	 */
	drawInspectorPanel(canvasRenderingContext, panelX, panelY, panelWidth, panelHeight) {
		canvasRenderingContext.save();
		canvasRenderingContext.beginPath();
		canvasRenderingContext.rect(panelX, panelY, panelWidth, panelHeight);
		canvasRenderingContext.clip();

		if (!this.#selectedNode) {
			canvasRenderingContext.fillStyle = COLOR_TEXT_DIM;
			canvasRenderingContext.font = `${FONT_SIZE}px monospace`;
			canvasRenderingContext.textAlign = "center";
			canvasRenderingContext.textBaseline = "middle";
			canvasRenderingContext.fillText("노드를 선택하세요", panelX + panelWidth * 0.5, panelY + panelHeight * 0.5);
			canvasRenderingContext.restore();
			return;
		}

		const inspectorLines = this.buildInspectorLines(this.#selectedNode);
		const totalContentHeight = inspectorLines.length * ITEM_HEIGHT;

		if (totalContentHeight > panelHeight) {
			const maxInspectorScrollY = totalContentHeight - panelHeight;
			this.#inspectorScrollY = System.Math.min(this.#inspectorScrollY, maxInspectorScrollY);
		}
		else {
			this.#inspectorScrollY = 0;
		}

		for (let lineIndex = 0; lineIndex < inspectorLines.length; ++lineIndex) {
			try {

			const line = inspectorLines[lineIndex];
			const lineY = panelY + lineIndex * ITEM_HEIGHT - this.#inspectorScrollY;

			if (lineY + ITEM_HEIGHT < panelY || lineY > panelY + panelHeight) {
				continue;
			}

			const lineMidY = lineY + ITEM_HEIGHT * 0.5;

			// 구분선.
			if (line.isSeparator) {
				canvasRenderingContext.strokeStyle = "rgba(75, 60, 35, 0.8)";
				canvasRenderingContext.lineWidth = 1;
				canvasRenderingContext.beginPath();
				canvasRenderingContext.moveTo(panelX + PADDING, lineMidY + 0.5);
				canvasRenderingContext.lineTo(panelX + panelWidth - PADDING, lineMidY + 0.5);
				canvasRenderingContext.stroke();
				continue;
			}

			// 섹션 헤더.
			if (line.isSectionHeader) {
				canvasRenderingContext.fillStyle = COLOR_SECTION_HEADER_BACKGROUND;
				canvasRenderingContext.fillRect(panelX, lineY, panelWidth, ITEM_HEIGHT);
				canvasRenderingContext.fillStyle = line.color;
				canvasRenderingContext.font = `bold ${FONT_SIZE}px monospace`;
				canvasRenderingContext.textBaseline = "middle";
				canvasRenderingContext.textAlign = "left";
				canvasRenderingContext.fillText(line.label, panelX + PADDING, lineMidY);
				continue;
			}

			// 컴포넌트 헤더.
			if (line.isComponentHeader) {
				canvasRenderingContext.fillStyle = COLOR_COMPONENT_HEADER_BACKGROUND;
				canvasRenderingContext.fillRect(panelX, lineY, panelWidth, ITEM_HEIGHT);
				const isExpanded = !this.#collapsedComponents.has(line.componentRef);
				canvasRenderingContext.fillStyle = isExpanded ? COLOR_ACCENT : COLOR_TEXT_DIM;
				canvasRenderingContext.font = `${FONT_SIZE}px monospace`;
				canvasRenderingContext.textBaseline = "middle";
				canvasRenderingContext.textAlign = "left";
				const expandText = isExpanded ? "v" : ">";
				canvasRenderingContext.fillText(expandText, panelX + PADDING, lineMidY);
				canvasRenderingContext.fillStyle = line.color;
				canvasRenderingContext.font = `bold ${FONT_SIZE}px monospace`;
				canvasRenderingContext.fillText(line.value, panelX + PADDING + 14, lineMidY);
				continue;
			}

			canvasRenderingContext.font = `${FONT_SIZE}px monospace`;
			canvasRenderingContext.textBaseline = "middle";

			// 컴포넌트 프로퍼티 (노드 프로퍼티와 동일한 x 위치).
			if (line.isComponentProperty) {
				canvasRenderingContext.fillStyle = COLOR_TEXT_DIM;
				canvasRenderingContext.textAlign = "left";
				canvasRenderingContext.fillText(line.label, panelX + PADDING, lineMidY);
				canvasRenderingContext.fillStyle = line.color;
				canvasRenderingContext.fillText(line.value, panelX + PADDING + LABEL_COLUMN_WIDTH, lineMidY);
				continue;
			}

			// 일반 레이블 + 값 (노드 프로퍼티).
			if (line.label) {
				canvasRenderingContext.fillStyle = COLOR_TEXT_DIM;
				canvasRenderingContext.textAlign = "left";
				canvasRenderingContext.fillText(line.label, panelX + PADDING, lineMidY);
				canvasRenderingContext.fillStyle = line.color;
				canvasRenderingContext.fillText(line.value, panelX + PADDING + LABEL_COLUMN_WIDTH, lineMidY);
				continue;
			}

			// 값만.
			canvasRenderingContext.fillStyle = line.color;
			canvasRenderingContext.textAlign = "left";
			canvasRenderingContext.fillText(line.value, panelX + PADDING, lineMidY);

			}
			catch (error) {
				// 라인 렌더링 오류 무시 (canvas save/restore 불균형 방지).
			}
		}

		if (totalContentHeight > panelHeight) {
			const maxInspectorScrollY = totalContentHeight - panelHeight;
			const scrollRatio = this.#inspectorScrollY / maxInspectorScrollY;
			const barHeight = System.Math.max(20, panelHeight * panelHeight / totalContentHeight);
			const barY = panelY + scrollRatio * (panelHeight - barHeight);
			canvasRenderingContext.fillStyle = COLOR_SCROLLBAR;
			canvasRenderingContext.fillRect(panelX + panelWidth - SCROLL_BAR_WIDTH, barY, SCROLL_BAR_WIDTH, barHeight);
		}

		canvasRenderingContext.restore();
	}

	//==============================================================================
	// 로컬 스토리지 패널 출력.
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { number } panelX
	 * @param { number } panelY
	 * @param { number } panelWidth
	 * @param { number } panelHeight
	 */
	drawLocalStoragePanel(canvasRenderingContext, panelX, panelY, panelWidth, panelHeight) {
		canvasRenderingContext.save();
		canvasRenderingContext.beginPath();
		canvasRenderingContext.rect(panelX, panelY, panelWidth, panelHeight);
		canvasRenderingContext.clip();

		// 헤더 배경.
		canvasRenderingContext.fillStyle = COLOR_SECTION_HEADER_BACKGROUND;
		canvasRenderingContext.fillRect(panelX, panelY, panelWidth, ITEM_HEIGHT);

		// 헤더 타이틀.
		canvasRenderingContext.fillStyle = COLOR_ACCENT;
		canvasRenderingContext.font = `bold ${FONT_SIZE}px monospace`;
		canvasRenderingContext.textAlign = "left";
		canvasRenderingContext.textBaseline = "middle";
		canvasRenderingContext.fillText("Local Storage", panelX + PADDING, panelY + ITEM_HEIGHT * 0.5);

		// + Add 버튼.
		const addBtnWidth = 48;
		const clearBtnWidth = 48;
		const btnHeight = ITEM_HEIGHT - 4;
		const btnY = panelY + 2;
		const clearBtnX = panelX + panelWidth - PADDING - clearBtnWidth;
		const addBtnX = clearBtnX - PADDING - addBtnWidth;
		canvasRenderingContext.fillStyle = "rgba(60, 100, 60, 0.9)";
		canvasRenderingContext.fillRect(addBtnX, btnY, addBtnWidth, btnHeight);
		canvasRenderingContext.fillStyle = "#8cc878";
		canvasRenderingContext.font = `${FONT_SIZE - 1}px monospace`;
		canvasRenderingContext.textAlign = "center";
		canvasRenderingContext.fillText("+ Add", addBtnX + addBtnWidth * 0.5, panelY + ITEM_HEIGHT * 0.5);

		// Clear 버튼.
		canvasRenderingContext.fillStyle = "rgba(100, 40, 30, 0.9)";
		canvasRenderingContext.fillRect(clearBtnX, btnY, clearBtnWidth, btnHeight);
		canvasRenderingContext.fillStyle = "#c87878";
		canvasRenderingContext.textAlign = "center";
		canvasRenderingContext.fillText("Clear", clearBtnX + clearBtnWidth * 0.5, panelY + ITEM_HEIGHT * 0.5);

		// 컬럼 헤더.
		const columnHeaderY = panelY + ITEM_HEIGHT;
		canvasRenderingContext.fillStyle = COLOR_COMPONENT_HEADER_BACKGROUND;
		canvasRenderingContext.fillRect(panelX, columnHeaderY, panelWidth, ITEM_HEIGHT);
		const delColWidth = 24;
		const availableWidth = panelWidth - delColWidth - SCROLL_BAR_WIDTH;
		const keyColWidth = System.Math.floor(availableWidth * 0.4);
		const valueColWidth = availableWidth - keyColWidth;
		canvasRenderingContext.fillStyle = COLOR_TEXT_DIM;
		canvasRenderingContext.font = `${FONT_SIZE - 1}px monospace`;
		canvasRenderingContext.textAlign = "left";
		canvasRenderingContext.textBaseline = "middle";
		canvasRenderingContext.fillText("Key", panelX + PADDING, columnHeaderY + ITEM_HEIGHT * 0.5);
		canvasRenderingContext.fillText("Value", panelX + keyColWidth + PADDING, columnHeaderY + ITEM_HEIGHT * 0.5);
		canvasRenderingContext.textAlign = "center";
		canvasRenderingContext.fillText("×", panelX + panelWidth - SCROLL_BAR_WIDTH - delColWidth * 0.5, columnHeaderY + ITEM_HEIGHT * 0.5);

		// 아이템 목록.
		const keys = LocalStorage.getKeys();
		const itemsY = panelY + ITEM_HEIGHT * 2;
		const contextMenuHeight = ITEM_HEIGHT + 8;
		const hasSelection = this.#selectedLocalStorageKey !== null;
		const itemsHeight = panelHeight - ITEM_HEIGHT * 2 - (hasSelection ? contextMenuHeight : 0);
		const totalItemsHeight = keys.length * ITEM_HEIGHT;

		if (totalItemsHeight > itemsHeight) {
			const maxScrollY = totalItemsHeight - itemsHeight;
			this.#localStorageScrollY = System.Math.min(this.#localStorageScrollY, maxScrollY);
		}
		else {
			this.#localStorageScrollY = 0;
		}

		// 항목 영역만 클립 (헤더가 스크롤에 가려지지 않도록).
		canvasRenderingContext.save();
		canvasRenderingContext.beginPath();
		canvasRenderingContext.rect(panelX, itemsY, panelWidth, itemsHeight);
		canvasRenderingContext.clip();

		for (let keyIndex = 0; keyIndex < keys.length; ++keyIndex) {
			const key = keys[keyIndex];
			const rawValue = LocalStorage.getString(key);
			const itemY = itemsY + keyIndex * ITEM_HEIGHT - this.#localStorageScrollY;

			if (itemY + ITEM_HEIGHT < itemsY || itemY > itemsY + itemsHeight) {
				continue;
			}

			const itemMidY = itemY + ITEM_HEIGHT * 0.5;
			const isSelected = key === this.#selectedLocalStorageKey;

			if (isSelected) {
				canvasRenderingContext.fillStyle = COLOR_ITEM_SELECTED;
				canvasRenderingContext.fillRect(panelX, itemY, panelWidth - SCROLL_BAR_WIDTH, ITEM_HEIGHT);
			}

			// 행 구분선.
			canvasRenderingContext.strokeStyle = COLOR_SPLITTER;
			canvasRenderingContext.lineWidth = 1;
			canvasRenderingContext.beginPath();
			canvasRenderingContext.moveTo(panelX, itemY + ITEM_HEIGHT - 0.5);
			canvasRenderingContext.lineTo(panelX + panelWidth - SCROLL_BAR_WIDTH, itemY + ITEM_HEIGHT - 0.5);
			canvasRenderingContext.stroke();

			// Key 텍스트.
			canvasRenderingContext.fillStyle = COLOR_ACCENT;
			canvasRenderingContext.font = `${FONT_SIZE}px monospace`;
			canvasRenderingContext.textAlign = "left";
			canvasRenderingContext.textBaseline = "middle";
			const maxKeyChars = System.Math.floor(keyColWidth / 7);
			const keyText = key.length > maxKeyChars ? key.slice(0, maxKeyChars - 3) + "..." : key;
			canvasRenderingContext.fillText(keyText, panelX + PADDING, itemMidY);

			// Value 텍스트.
			canvasRenderingContext.fillStyle = COLOR_PROPERTY_VALUE;
			const valueStr = rawValue !== null ? rawValue : "(null)";
			const maxValueChars = System.Math.floor(valueColWidth / 7);
			const valueText = valueStr.length > maxValueChars ? valueStr.slice(0, maxValueChars - 3) + "..." : valueStr;
			canvasRenderingContext.fillText(valueText, panelX + keyColWidth + PADDING, itemMidY);

			// 삭제(×) 버튼.
			const delBtnX = panelX + panelWidth - SCROLL_BAR_WIDTH - delColWidth;
			canvasRenderingContext.fillStyle = "rgba(100, 40, 30, 0.6)";
			canvasRenderingContext.fillRect(delBtnX + 2, itemY + 2, delColWidth - 4, ITEM_HEIGHT - 4);
			canvasRenderingContext.fillStyle = "#c87878";
			canvasRenderingContext.font = `${FONT_SIZE}px monospace`;
			canvasRenderingContext.textAlign = "center";
			canvasRenderingContext.fillText("×", delBtnX + delColWidth * 0.5, itemMidY);
		}

		// 항목 없음 안내.
		if (keys.length === 0) {
			canvasRenderingContext.fillStyle = COLOR_TEXT_DIM;
			canvasRenderingContext.font = `${FONT_SIZE}px monospace`;
			canvasRenderingContext.textAlign = "center";
			canvasRenderingContext.textBaseline = "middle";
			canvasRenderingContext.fillText("(비어있음)", panelX + panelWidth * 0.5, itemsY + itemsHeight * 0.5);
		}

		canvasRenderingContext.restore();

		// 스크롤바.
		if (totalItemsHeight > itemsHeight) {
			const maxScrollY = totalItemsHeight - itemsHeight;
			const scrollRatio = this.#localStorageScrollY / maxScrollY;
			const barHeight = System.Math.max(20, itemsHeight * itemsHeight / totalItemsHeight);
			const barY = itemsY + scrollRatio * (itemsHeight - barHeight);
			canvasRenderingContext.fillStyle = COLOR_SCROLLBAR;
			canvasRenderingContext.fillRect(panelX + panelWidth - SCROLL_BAR_WIDTH, barY, SCROLL_BAR_WIDTH, barHeight);
		}

		// 선택 컨텍스트 메뉴.
		if (hasSelection) {
			const contextMenuY = panelY + panelHeight - contextMenuHeight;
			canvasRenderingContext.fillStyle = COLOR_COMPONENT_HEADER_BACKGROUND;
			canvasRenderingContext.fillRect(panelX, contextMenuY, panelWidth, contextMenuHeight);
			canvasRenderingContext.strokeStyle = COLOR_BORDER_NORMAL;
			canvasRenderingContext.lineWidth = 1;
			canvasRenderingContext.beginPath();
			canvasRenderingContext.moveTo(panelX, contextMenuY + 0.5);
			canvasRenderingContext.lineTo(panelX + panelWidth, contextMenuY + 0.5);
			canvasRenderingContext.stroke();

			const contextButtonLabels = ["Edit Key", "Edit Value", "Duplicate", "Remove"];
			const contextButtonColors = ["rgba(50,80,50,0.9)", "rgba(40,60,90,0.9)", "rgba(40,70,100,0.9)", "rgba(100,40,30,0.9)"];
			const contextButtonTextColors = ["#8cc878", "#a8c8e8", "#78b4c8", "#c87878"];
			const contextButtonCount = contextButtonLabels.length;
			const contextButtonGap = 4;
			const contextButtonHeight = contextMenuHeight - 8;
			const contextButtonTextPadding = 10;
			canvasRenderingContext.font = `${FONT_SIZE - 1}px monospace`;
			// 텍스트 크기 기반으로 각 버튼 너비 계산.
			const contextButtonWidths = [];
			for (let labelIndex = 0; labelIndex < contextButtonCount; ++labelIndex) {
				const measuredTextWidth = canvasRenderingContext.measureText(contextButtonLabels[labelIndex]).width;
				contextButtonWidths.push(System.Math.ceil(measuredTextWidth) + contextButtonTextPadding * 2);
			}
			let totalContextButtonWidth = contextButtonGap * (contextButtonCount - 1);
			for (let widthIndex = 0; widthIndex < contextButtonWidths.length; ++widthIndex) {
				totalContextButtonWidth += contextButtonWidths[widthIndex];
			}
			const contextButtonStartX = panelX + panelWidth - PADDING - totalContextButtonWidth;
			const contextButtonY = contextMenuY + (contextMenuHeight - contextButtonHeight) * 0.5;
			canvasRenderingContext.textBaseline = "middle";
			canvasRenderingContext.textAlign = "center";
			this.#ctxButtonRects = [];
			let currentContextButtonX = contextButtonStartX;
			for (let buttonIndex = 0; buttonIndex < contextButtonCount; ++buttonIndex) {
				const contextButtonX = currentContextButtonX;
				const contextButtonWidth = contextButtonWidths[buttonIndex];
				this.#ctxButtonRects.push({ x: contextButtonX, y: contextButtonY, width: contextButtonWidth, height: contextButtonHeight });
				canvasRenderingContext.fillStyle = contextButtonColors[buttonIndex];
				canvasRenderingContext.fillRect(contextButtonX, contextButtonY, contextButtonWidth, contextButtonHeight);
				canvasRenderingContext.fillStyle = contextButtonTextColors[buttonIndex];
				canvasRenderingContext.fillText(contextButtonLabels[buttonIndex], contextButtonX + contextButtonWidth * 0.5, contextMenuY + contextMenuHeight * 0.5);
				currentContextButtonX += contextButtonWidth + contextButtonGap;
			}
		}

		canvasRenderingContext.restore();
	}

	//==============================================================================
	// 화면 비율 가이드라인 출력.
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 */
	drawAspectGuide(graphic) {
		if (!this.#isHeightAspectGuideVisible && !this.#isWidthAspectGuideVisible) {
			return;
		}
		if (!this.#engine) {
			return;
		}
		const viewManager = this.#engine.getViewManager();
		const viewScaleMode = viewManager.getViewScaleMode();
		const isStretchMode = viewScaleMode === ViewScaleMode.stretchWidth ||
		                      viewScaleMode === ViewScaleMode.stretchHeight ||
		                      viewScaleMode === ViewScaleMode.stretchShort ||
		                      viewScaleMode === ViewScaleMode.stretchWidthExpandHeight ||
		                      viewScaleMode === ViewScaleMode.stretchHeightExpandWidth ||
		                      viewScaleMode === ViewScaleMode.stretchShortExpandLong;
		if (!isStretchMode) {
			return;
		}
		const viewSize = viewManager.getViewSize();
		const viewWidth = viewSize.x;
		const viewHeight = viewSize.y;
		const centerX = viewWidth * 0.5;
		const centerY = viewHeight * 0.5;
		const canvasRenderingContext = graphic.getCanvasRenderingContext();
		canvasRenderingContext.save();
		canvasRenderingContext.lineWidth = 2;

		// 세로 기준 (height 고정 100%, width = height * 비율).
		if (this.#isHeightAspectGuideVisible) {
			const heightFixed = viewHeight;
			const heightBasedWidth100 = viewHeight * 1.0;
			const heightBasedWidth75 = viewHeight * 0.75;
			const heightBasedWidth50 = viewHeight * 0.5;
			canvasRenderingContext.strokeStyle = "rgba(80, 200, 240, 1)";
			canvasRenderingContext.strokeRect(centerX - heightBasedWidth100 * 0.5, centerY - heightFixed * 0.5, heightBasedWidth100, heightFixed);
			canvasRenderingContext.strokeRect(centerX - heightBasedWidth75 * 0.5, centerY - heightFixed * 0.5, heightBasedWidth75, heightFixed);
			canvasRenderingContext.strokeRect(centerX - heightBasedWidth50 * 0.5, centerY - heightFixed * 0.5, heightBasedWidth50, heightFixed);
		}

		// 가로 기준 (width 고정 100%, height = width * 비율).
		if (this.#isWidthAspectGuideVisible) {
			const widthFixed = viewWidth;
			const widthBasedHeight100 = viewWidth * 1.0;
			const widthBasedHeight75 = viewWidth * 0.75;
			const widthBasedHeight50 = viewWidth * 0.5;
			canvasRenderingContext.strokeStyle = "rgba(240, 180, 80, 1)";
			canvasRenderingContext.strokeRect(centerX - widthFixed * 0.5, centerY - widthBasedHeight100 * 0.5, widthFixed, widthBasedHeight100);
			canvasRenderingContext.strokeRect(centerX - widthFixed * 0.5, centerY - widthBasedHeight75 * 0.5, widthFixed, widthBasedHeight75);
			canvasRenderingContext.strokeRect(centerX - widthFixed * 0.5, centerY - widthBasedHeight50 * 0.5, widthFixed, widthBasedHeight50);
		}

		canvasRenderingContext.restore();
	}

	//==============================================================================
	// 세팅 패널 출력.
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { number } panelX
	 * @param { number } panelY
	 * @param { number } panelWidth
	 * @param { number } panelHeight
	 */
	drawSettingsPanel(canvasRenderingContext, panelX, panelY, panelWidth, panelHeight) {
		canvasRenderingContext.save();
		canvasRenderingContext.beginPath();
		canvasRenderingContext.rect(panelX, panelY, panelWidth, panelHeight);
		canvasRenderingContext.clip();

		// 헤더 배경.
		canvasRenderingContext.fillStyle = COLOR_SECTION_HEADER_BACKGROUND;
		canvasRenderingContext.fillRect(panelX, panelY, panelWidth, ITEM_HEIGHT);

		// 헤더 타이틀.
		canvasRenderingContext.fillStyle = COLOR_ACCENT;
		canvasRenderingContext.font = `bold ${FONT_SIZE}px monospace`;
		canvasRenderingContext.textAlign = "left";
		canvasRenderingContext.textBaseline = "middle";
		canvasRenderingContext.fillText("Settings", panelX + PADDING, panelY + ITEM_HEIGHT * 0.5);

		// Dim Background 항목.
		const dimRowY = panelY + ITEM_HEIGHT;
		const dimRowMidY = dimRowY + ITEM_HEIGHT * 0.5;
		canvasRenderingContext.fillStyle = COLOR_TEXT;
		canvasRenderingContext.font = `${FONT_SIZE}px monospace`;
		canvasRenderingContext.textAlign = "left";
		canvasRenderingContext.textBaseline = "middle";
		canvasRenderingContext.fillText("Dim Background", panelX + PADDING, dimRowMidY);

		const dimCheckboxX = panelX + PADDING + 120;
		const dimCheckboxY = System.Math.floor(dimRowMidY - GIZMO_CHECKBOX_SIZE * 0.5);
		canvasRenderingContext.fillStyle = this.#isDimEnabled ? COLOR_TRUE : COLOR_ACCENT;
		canvasRenderingContext.fillRect(dimCheckboxX, dimCheckboxY, GIZMO_CHECKBOX_SIZE, GIZMO_CHECKBOX_SIZE);
		if (!this.#isDimEnabled) {
			canvasRenderingContext.fillStyle = "#16120a";
			canvasRenderingContext.fillRect(dimCheckboxX + 2, dimCheckboxY + 2, GIZMO_CHECKBOX_SIZE - 4, GIZMO_CHECKBOX_SIZE - 4);
		}

		// Show All Gizmos 항목.
		const gizmosRowY = panelY + ITEM_HEIGHT * 2;
		const gizmosRowMidY = gizmosRowY + ITEM_HEIGHT * 0.5;
		canvasRenderingContext.fillStyle = COLOR_TEXT;
		canvasRenderingContext.font = `${FONT_SIZE}px monospace`;
		canvasRenderingContext.textAlign = "left";
		canvasRenderingContext.textBaseline = "middle";
		canvasRenderingContext.fillText("Show All Gizmos", panelX + PADDING, gizmosRowMidY);

		const gizmosCheckboxX = panelX + PADDING + 120;
		const gizmosCheckboxY = System.Math.floor(gizmosRowMidY - GIZMO_CHECKBOX_SIZE * 0.5);
		canvasRenderingContext.fillStyle = this.#isAllGizmosVisible ? COLOR_TRUE : COLOR_ACCENT;
		canvasRenderingContext.fillRect(gizmosCheckboxX, gizmosCheckboxY, GIZMO_CHECKBOX_SIZE, GIZMO_CHECKBOX_SIZE);
		if (!this.#isAllGizmosVisible) {
			canvasRenderingContext.fillStyle = "#16120a";
			canvasRenderingContext.fillRect(gizmosCheckboxX + 2, gizmosCheckboxY + 2, GIZMO_CHECKBOX_SIZE - 4, GIZMO_CHECKBOX_SIZE - 4);
		}

		// Show Height Aspect Guide 항목.
		const heightAspectGuideRowY = panelY + ITEM_HEIGHT * 3;
		const heightAspectGuideRowMidY = heightAspectGuideRowY + ITEM_HEIGHT * 0.5;
		canvasRenderingContext.fillStyle = COLOR_TEXT;
		canvasRenderingContext.font = `${FONT_SIZE}px monospace`;
		canvasRenderingContext.textAlign = "left";
		canvasRenderingContext.textBaseline = "middle";
		canvasRenderingContext.fillText("Show Height Aspect Guide", panelX + PADDING, heightAspectGuideRowMidY);

		const heightAspectGuideCheckboxX = panelX + PADDING + 168;
		const heightAspectGuideCheckboxY = System.Math.floor(heightAspectGuideRowMidY - GIZMO_CHECKBOX_SIZE * 0.5);
		canvasRenderingContext.fillStyle = this.#isHeightAspectGuideVisible ? COLOR_TRUE : COLOR_ACCENT;
		canvasRenderingContext.fillRect(heightAspectGuideCheckboxX, heightAspectGuideCheckboxY, GIZMO_CHECKBOX_SIZE, GIZMO_CHECKBOX_SIZE);
		if (!this.#isHeightAspectGuideVisible) {
			canvasRenderingContext.fillStyle = "#16120a";
			canvasRenderingContext.fillRect(heightAspectGuideCheckboxX + 2, heightAspectGuideCheckboxY + 2, GIZMO_CHECKBOX_SIZE - 4, GIZMO_CHECKBOX_SIZE - 4);
		}

		// Show Width Aspect Guide 항목.
		const widthAspectGuideRowY = panelY + ITEM_HEIGHT * 4;
		const widthAspectGuideRowMidY = widthAspectGuideRowY + ITEM_HEIGHT * 0.5;
		canvasRenderingContext.fillStyle = COLOR_TEXT;
		canvasRenderingContext.font = `${FONT_SIZE}px monospace`;
		canvasRenderingContext.textAlign = "left";
		canvasRenderingContext.textBaseline = "middle";
		canvasRenderingContext.fillText("Show Width Aspect Guide", panelX + PADDING, widthAspectGuideRowMidY);

		const widthAspectGuideCheckboxX = panelX + PADDING + 168;
		const widthAspectGuideCheckboxY = System.Math.floor(widthAspectGuideRowMidY - GIZMO_CHECKBOX_SIZE * 0.5);
		canvasRenderingContext.fillStyle = this.#isWidthAspectGuideVisible ? COLOR_TRUE : COLOR_ACCENT;
		canvasRenderingContext.fillRect(widthAspectGuideCheckboxX, widthAspectGuideCheckboxY, GIZMO_CHECKBOX_SIZE, GIZMO_CHECKBOX_SIZE);
		if (!this.#isWidthAspectGuideVisible) {
			canvasRenderingContext.fillStyle = "#16120a";
			canvasRenderingContext.fillRect(widthAspectGuideCheckboxX + 2, widthAspectGuideCheckboxY + 2, GIZMO_CHECKBOX_SIZE - 4, GIZMO_CHECKBOX_SIZE - 4);
		}

		canvasRenderingContext.restore();
	}

	//==============================================================================
	// 세팅 탭 눌림 처리.
	//==============================================================================
	/**
	 * @param { number } touchX
	 * @param { number } touchY
	 * @param { number } panelX
	 * @param { number } panelY
	 * @param { number } panelWidth
	 * @param { number } panelHeight
	 */
	handleSettingsPress(touchX, touchY, panelX, panelY, panelWidth, panelHeight) {
		const dimRowY = panelY + ITEM_HEIGHT;
		const dimRowMidY = dimRowY + ITEM_HEIGHT * 0.5;
		const dimCheckboxX = panelX + PADDING + 120;
		const dimCheckboxY = System.Math.floor(dimRowMidY - GIZMO_CHECKBOX_SIZE * 0.5);
		const isDimCheckboxHit = touchX >= dimCheckboxX && touchX <= dimCheckboxX + GIZMO_CHECKBOX_SIZE &&
		                         touchY >= dimCheckboxY && touchY <= dimCheckboxY + GIZMO_CHECKBOX_SIZE;
		if (isDimCheckboxHit) {
			this.#isDimEnabled = !this.#isDimEnabled;
			this.saveSettings();
			return;
		}

		const gizmosRowY = panelY + ITEM_HEIGHT * 2;
		const gizmosRowMidY = gizmosRowY + ITEM_HEIGHT * 0.5;
		const gizmosCheckboxX = panelX + PADDING + 120;
		const gizmosCheckboxY = System.Math.floor(gizmosRowMidY - GIZMO_CHECKBOX_SIZE * 0.5);
		const isGizmosCheckboxHit = touchX >= gizmosCheckboxX && touchX <= gizmosCheckboxX + GIZMO_CHECKBOX_SIZE &&
		                            touchY >= gizmosCheckboxY && touchY <= gizmosCheckboxY + GIZMO_CHECKBOX_SIZE;
		if (isGizmosCheckboxHit) {
			this.#isAllGizmosVisible = !this.#isAllGizmosVisible;
			const graphic = this.#engine.getGraphic();
			graphic.setForceGizmosVisible(this.#isAllGizmosVisible);
			this.saveSettings();
			return;
		}

		const heightAspectGuideRowY = panelY + ITEM_HEIGHT * 3;
		const heightAspectGuideRowMidY = heightAspectGuideRowY + ITEM_HEIGHT * 0.5;
		const heightAspectGuideCheckboxX = panelX + PADDING + 168;
		const heightAspectGuideCheckboxY = System.Math.floor(heightAspectGuideRowMidY - GIZMO_CHECKBOX_SIZE * 0.5);
		const isHeightAspectGuideCheckboxHit = touchX >= heightAspectGuideCheckboxX && touchX <= heightAspectGuideCheckboxX + GIZMO_CHECKBOX_SIZE &&
		                                       touchY >= heightAspectGuideCheckboxY && touchY <= heightAspectGuideCheckboxY + GIZMO_CHECKBOX_SIZE;
		if (isHeightAspectGuideCheckboxHit) {
			this.#isHeightAspectGuideVisible = !this.#isHeightAspectGuideVisible;
			this.saveSettings();
			return;
		}

		const widthAspectGuideRowY = panelY + ITEM_HEIGHT * 4;
		const widthAspectGuideRowMidY = widthAspectGuideRowY + ITEM_HEIGHT * 0.5;
		const widthAspectGuideCheckboxX = panelX + PADDING + 168;
		const widthAspectGuideCheckboxY = System.Math.floor(widthAspectGuideRowMidY - GIZMO_CHECKBOX_SIZE * 0.5);
		const isWidthAspectGuideCheckboxHit = touchX >= widthAspectGuideCheckboxX && touchX <= widthAspectGuideCheckboxX + GIZMO_CHECKBOX_SIZE &&
		                                      touchY >= widthAspectGuideCheckboxY && touchY <= widthAspectGuideCheckboxY + GIZMO_CHECKBOX_SIZE;
		if (isWidthAspectGuideCheckboxHit) {
			this.#isWidthAspectGuideVisible = !this.#isWidthAspectGuideVisible;
			this.saveSettings();
		}
	}

	//==============================================================================
	// 설정 불러오기.
	//==============================================================================
	loadSettings() {
		if (!LocalStorage.containsKey(SETTINGS_STORAGE_KEY)) {
			return;
		}
		const settingsJson = LocalStorage.getString(SETTINGS_STORAGE_KEY);
		try {
			const settingsObject = System.JSON.parse(settingsJson);
			if (typeof settingsObject.dimEnabled === "boolean") {
				this.#isDimEnabled = settingsObject.dimEnabled;
			}
			if (typeof settingsObject.allGizmosVisible === "boolean") {
				this.#isAllGizmosVisible = settingsObject.allGizmosVisible;
			}
			if (typeof settingsObject.heightAspectGuideVisible === "boolean") {
				this.#isHeightAspectGuideVisible = settingsObject.heightAspectGuideVisible;
			}
			if (typeof settingsObject.widthAspectGuideVisible === "boolean") {
				this.#isWidthAspectGuideVisible = settingsObject.widthAspectGuideVisible;
			}
		}
		catch (error) {
			// 파싱 실패 시 기본값 유지.
		}
	}

	//==============================================================================
	// 설정 저장.
	//==============================================================================
	saveSettings() {
		const settingsObject = { dimEnabled: this.#isDimEnabled, allGizmosVisible: this.#isAllGizmosVisible, heightAspectGuideVisible: this.#isHeightAspectGuideVisible, widthAspectGuideVisible: this.#isWidthAspectGuideVisible };
		const settingsJson = System.JSON.stringify(settingsObject);
		LocalStorage.setString(SETTINGS_STORAGE_KEY, settingsJson);
	}

	//==============================================================================
	// 통계 항목 수집.
	//==============================================================================
	gatherStatisticsItems() {
		const items = [];
		const platform = this.#engine.getPlatform();
		const viewManager = this.#engine.getViewManager();
		const inputManager = this.#engine.getInputManager();
		const timeManager = this.#engine.getTimeManager();

		platform.getPlatformInfo();

		items.push({ key: "Platform", value: "", isSeparator: false, isSectionHeader: true });
		const versionString = this.#engine.getVersionString();
		items.push({ key: "engineVersion", value: versionString, isSeparator: false, isSectionHeader: false });
		const platformName = platform.platformName;
		items.push({ key: "platformName", value: platformName, isSeparator: false, isSectionHeader: false });
		const browserName = platform.browserName;
		items.push({ key: "browserName", value: browserName, isSeparator: false, isSectionHeader: false });

		items.push({ key: "Screen", value: "", isSeparator: false, isSectionHeader: true });
		const clientNativeSize = viewManager.getClientNativeSize();
		const clientNativeSizeText = `(${clientNativeSize.x}, ${clientNativeSize.y})`;
		items.push({ key: "clientNativeSize", value: clientNativeSizeText, isSeparator: false, isSectionHeader: false });
		const canvasNativeSize = viewManager.getCanvasNativeSize();
		const canvasNativeSizeText = `(${canvasNativeSize.x}, ${canvasNativeSize.y})`;
		items.push({ key: "canvasNativeSize", value: canvasNativeSizeText, isSeparator: false, isSectionHeader: false });
		const canvasPixelSize = viewManager.getCanvasPixelSize();
		const canvasPixelSizeText = `(${canvasPixelSize.x}, ${canvasPixelSize.y})`;
		items.push({ key: "canvasPixelSize", value: canvasPixelSizeText, isSeparator: false, isSectionHeader: false });
		const referenceResolutionSize = viewManager.getReferenceResolutionSize();
		const referenceResolutionSizeText = `(${referenceResolutionSize.x}, ${referenceResolutionSize.y})`;
		items.push({ key: "referenceResolutionSize", value: referenceResolutionSizeText, isSeparator: false, isSectionHeader: false });
		items.push({ key: "screenSize", value: "(N/A)", isSeparator: false, isSectionHeader: false });
		const viewScaleMode = viewManager.getViewScaleMode();
		items.push({ key: "viewScaleMode", value: viewScaleMode, isSeparator: false, isSectionHeader: false });
		const viewNativeRect = viewManager.getViewNativeRect();
		const viewNativeRectText = `(${viewNativeRect.position.x}, ${viewNativeRect.position.y}) - (${viewNativeRect.size.x}, ${viewNativeRect.size.y})`;
		items.push({ key: "viewNativeRect", value: viewNativeRectText, isSeparator: false, isSectionHeader: false });
		const viewSize = viewManager.getViewSize();
		const viewSizeText = `(${viewSize.x}, ${viewSize.y})`;
		items.push({ key: "viewSize", value: viewSizeText, isSeparator: false, isSectionHeader: false });
		const canvasNativeInputPosition = inputManager.getCanvasNativeInputPosition();
		const canvasNativeInputPositionText = `(${canvasNativeInputPosition.x}, ${canvasNativeInputPosition.y})`;
		items.push({ key: "canvasNativeInputPosition", value: canvasNativeInputPositionText, isSeparator: false, isSectionHeader: false });
		const viewInputPosition = inputManager.getViewInputPosition();
		const viewInputPositionText = `(${viewInputPosition.x}, ${viewInputPosition.y})`;
		items.push({ key: "viewInputPosition", value: viewInputPositionText, isSeparator: false, isSectionHeader: false });

		items.push({ key: "Time", value: "", isSeparator: false, isSectionHeader: true });
		const realtimeSinceStartup = timeManager.getRealtimeSinceStartup();
		const realtimeSinceStartupText = `${realtimeSinceStartup.toFixed(2)}s`;
		items.push({ key: "realtimeSinceStartup", value: realtimeSinceStartupText, isSeparator: false, isSectionHeader: false });
		const time = timeManager.getTime();
		const timeText = `${time.toFixed(2)}s`;
		items.push({ key: "time", value: timeText, isSeparator: false, isSectionHeader: false });
		const framePerSecond = timeManager.getFramePerSecond();
		const framePerSecondText = `${framePerSecond}`;
		items.push({ key: "framePerSecond", value: framePerSecondText, isSeparator: false, isSectionHeader: false });
		const timeDelta = timeManager.getTimeDelta();
		const timeDeltaText = `${timeDelta.toFixed(3)}s`;
		items.push({ key: "timeDelta", value: timeDeltaText, isSeparator: false, isSectionHeader: false });

		items.push({ key: "Memory", value: "", isSeparator: false, isSectionHeader: true });
		const performanceMemory = System.window.performance ? System.window.performance.memory : null;
		if (performanceMemory) {
			const usedHeapMegabytes = (performanceMemory.usedJSHeapSize / (1024 * 1024)).toFixed(2);
			items.push({ key: "usedJSHeapSize", value: `${usedHeapMegabytes} MB`, isSeparator: false, isSectionHeader: false });
			const totalHeapMegabytes = (performanceMemory.totalJSHeapSize / (1024 * 1024)).toFixed(2);
			items.push({ key: "totalJSHeapSize", value: `${totalHeapMegabytes} MB`, isSeparator: false, isSectionHeader: false });
			const heapLimitMegabytes = (performanceMemory.jsHeapSizeLimit / (1024 * 1024)).toFixed(2);
			items.push({ key: "jsHeapSizeLimit", value: `${heapLimitMegabytes} MB`, isSeparator: false, isSectionHeader: false });
		}
		else {
			items.push({ key: "usedJSHeapSize", value: "(N/A)", isSeparator: false, isSectionHeader: false });
			items.push({ key: "totalJSHeapSize", value: "(N/A)", isSeparator: false, isSectionHeader: false });
			items.push({ key: "jsHeapSizeLimit", value: "(N/A)", isSeparator: false, isSectionHeader: false });
		}

		return items;
	}

	//==============================================================================
	// 통계 패널 출력.
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { number } panelX
	 * @param { number } panelY
	 * @param { number } panelWidth
	 * @param { number } panelHeight
	 */
	drawStatisticsPanel(canvasRenderingContext, panelX, panelY, panelWidth, panelHeight) {
		canvasRenderingContext.save();
		canvasRenderingContext.beginPath();
		canvasRenderingContext.rect(panelX, panelY, panelWidth, panelHeight);
		canvasRenderingContext.clip();

		// 헤더 배경.
		canvasRenderingContext.fillStyle = COLOR_SECTION_HEADER_BACKGROUND;
		canvasRenderingContext.fillRect(panelX, panelY, panelWidth, ITEM_HEIGHT);

		// 헤더 타이틀.
		canvasRenderingContext.fillStyle = COLOR_ACCENT;
		canvasRenderingContext.font = `bold ${FONT_SIZE}px monospace`;
		canvasRenderingContext.textAlign = "left";
		canvasRenderingContext.textBaseline = "middle";
		canvasRenderingContext.fillText("Statistics", panelX + PADDING, panelY + ITEM_HEIGHT * 0.5);

		// 항목 목록.
		const availableWidth = panelWidth - SCROLL_BAR_WIDTH;
		const keyColumnWidth = System.Math.floor(availableWidth * 0.4);
		const statisticsItems = this.gatherStatisticsItems();
		const itemsY = panelY + ITEM_HEIGHT;
		const itemsHeight = panelHeight - ITEM_HEIGHT;
		const totalItemsHeight = statisticsItems.length * ITEM_HEIGHT;

		if (totalItemsHeight > itemsHeight) {
			const maxStatisticsScrollY = totalItemsHeight - itemsHeight;
			this.#statisticsScrollY = System.Math.min(this.#statisticsScrollY, maxStatisticsScrollY);
		}
		else {
			this.#statisticsScrollY = 0;
		}

		const valueColumnWidth = availableWidth - keyColumnWidth;
		const maxKeyCharacters = System.Math.floor(keyColumnWidth / 7);
		const maxValueCharacters = System.Math.floor(valueColumnWidth / 7);

		// 항목 영역만 클립 (헤더 타이틀이 스크롤에 가려지지 않도록).
		canvasRenderingContext.save();
		canvasRenderingContext.beginPath();
		canvasRenderingContext.rect(panelX, itemsY, panelWidth, itemsHeight);
		canvasRenderingContext.clip();

		for (let itemIndex = 0; itemIndex < statisticsItems.length; ++itemIndex) {
			const statisticsItem = statisticsItems[itemIndex];
			const itemY = itemsY + itemIndex * ITEM_HEIGHT - this.#statisticsScrollY;

			if (itemY + ITEM_HEIGHT < itemsY || itemY > itemsY + itemsHeight) {
				continue;
			}

			const itemMidY = itemY + ITEM_HEIGHT * 0.5;

			// 구분선.
			if (statisticsItem.isSeparator) {
				canvasRenderingContext.strokeStyle = COLOR_SPLITTER;
				canvasRenderingContext.lineWidth = 1;
				canvasRenderingContext.beginPath();
				canvasRenderingContext.moveTo(panelX, itemMidY + 0.5);
				canvasRenderingContext.lineTo(panelX + availableWidth, itemMidY + 0.5);
				canvasRenderingContext.stroke();
				continue;
			}

			// 하위 섹션 헤더.
			if (statisticsItem.isSectionHeader) {
				canvasRenderingContext.fillStyle = COLOR_COMPONENT_HEADER_BACKGROUND;
				canvasRenderingContext.fillRect(panelX, itemY, availableWidth, ITEM_HEIGHT);
				// 왼쪽 강조선.
				canvasRenderingContext.fillStyle = COLOR_ACCENT;
				canvasRenderingContext.fillRect(panelX + PADDING, itemY + 4, 2, ITEM_HEIGHT - 8);
				canvasRenderingContext.fillStyle = COLOR_TEXT;
				canvasRenderingContext.font = `${FONT_SIZE}px monospace`;
				canvasRenderingContext.textAlign = "left";
				canvasRenderingContext.textBaseline = "middle";
				canvasRenderingContext.fillText(statisticsItem.key, panelX + PADDING + 8, itemMidY);
				continue;
			}

			const isSelected = statisticsItem.key === this.#selectedStatisticsKey;

			if (isSelected) {
				canvasRenderingContext.fillStyle = COLOR_ITEM_SELECTED;
				canvasRenderingContext.fillRect(panelX, itemY, availableWidth, ITEM_HEIGHT);
			}

			// 행 구분선.
			canvasRenderingContext.strokeStyle = COLOR_SPLITTER;
			canvasRenderingContext.lineWidth = 1;
			canvasRenderingContext.beginPath();
			canvasRenderingContext.moveTo(panelX, itemY + ITEM_HEIGHT - 0.5);
			canvasRenderingContext.lineTo(panelX + availableWidth, itemY + ITEM_HEIGHT - 0.5);
			canvasRenderingContext.stroke();

			canvasRenderingContext.font = `${FONT_SIZE}px monospace`;
			canvasRenderingContext.textAlign = "left";
			canvasRenderingContext.textBaseline = "middle";

			// Key 텍스트.
			canvasRenderingContext.fillStyle = COLOR_ACCENT;
			const keyText = statisticsItem.key.length > maxKeyCharacters ? statisticsItem.key.slice(0, maxKeyCharacters - 3) + "..." : statisticsItem.key;
			canvasRenderingContext.fillText(keyText, panelX + PADDING, itemMidY);

			// Value 텍스트.
			canvasRenderingContext.fillStyle = COLOR_PROPERTY_VALUE;
			const valueText = statisticsItem.value.length > maxValueCharacters ? statisticsItem.value.slice(0, maxValueCharacters - 3) + "..." : statisticsItem.value;
			canvasRenderingContext.fillText(valueText, panelX + keyColumnWidth + PADDING, itemMidY);
		}

		canvasRenderingContext.restore();

		// 스크롤바.
		if (totalItemsHeight > itemsHeight) {
			const maxStatisticsScrollY = totalItemsHeight - itemsHeight;
			const scrollRatio = this.#statisticsScrollY / maxStatisticsScrollY;
			const barHeight = System.Math.max(20, itemsHeight * itemsHeight / totalItemsHeight);
			const barY = itemsY + scrollRatio * (itemsHeight - barHeight);
			canvasRenderingContext.fillStyle = COLOR_SCROLLBAR;
			canvasRenderingContext.fillRect(panelX + panelWidth - SCROLL_BAR_WIDTH, barY, SCROLL_BAR_WIDTH, barHeight);
		}

		canvasRenderingContext.restore();
	}

	//==============================================================================
	// 통계 탭 눌림 처리.
	//==============================================================================
	/**
	 * @param { number } touchX
	 * @param { number } touchY
	 * @param { number } panelX
	 * @param { number } panelY
	 * @param { number } panelWidth
	 * @param { number } panelHeight
	 */
	handleStatisticsPress(touchX, touchY, panelX, panelY, panelWidth, panelHeight) {
		const statisticsItems = this.gatherStatisticsItems();
		const itemsY = panelY + ITEM_HEIGHT;
		const localY = touchY - itemsY + this.#statisticsScrollY;
		const clickedIndex = System.Math.floor(localY / ITEM_HEIGHT);

		if (touchY >= itemsY && clickedIndex >= 0 && clickedIndex < statisticsItems.length) {
			const clickedItem = statisticsItems[clickedIndex];
			if (!clickedItem.isSeparator && !clickedItem.isSectionHeader) {
				if (this.#selectedStatisticsKey === clickedItem.key) {
					this.#selectedStatisticsKey = null;
				}
				else {
					this.#selectedStatisticsKey = clickedItem.key;
				}
			}
		}
		else if (touchY >= itemsY) {
			this.#selectedStatisticsKey = null;
		}

		if (touchY >= itemsY) {
			this.#isStatisticsScrollDragging = true;
			this.#statisticsScrollDragStartMouseY = touchY;
			this.#statisticsScrollDragStartScrollY = this.#statisticsScrollY;
		}
	}
}
