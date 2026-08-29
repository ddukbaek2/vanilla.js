//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Engine, EngineConfiguration } from "../../src/core/engine.js";
import { Scene } from "../../src/core/scene.js";
import { WorldNode } from "../../src/core/node/worldnode.js";
import { Vector2 } from "../../src/base/vector2.js";
import { Color } from "../../src/base/color.js";
import { Pivot } from "../../src/base/pivot.js";
import { Rect } from "../../src/base/rect.js";
import { Paint } from "../../src/core/component/paint.js";
import { Text } from "../../src/core/component/text.js";
import { UIDocument } from "../../src/ui/uidocument.js";
import { UILabel } from "../../src/ui/uilabel.js";
import { UIButton } from "../../src/ui/uibutton.js";
import { UIProgressView } from "../../src/ui/uiprogressview.js";
import { UISlider } from "../../src/ui/uislider.js";
import { UIScrollView } from "../../src/ui/uiscrollview.js";
import { UIView } from "../../src/ui/uiview.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 편집기 레이아웃 치수.
const MENUBAR_HEIGHT = 26;
const TOOLBAR_HEIGHT = 40;
const STATUSBAR_HEIGHT = 24;
const MENU_ITEM_HEIGHT = 24;
const MENU_PANEL_WIDTH = 190;
const HIERARCHY_WIDTH = 230;
const INSPECTOR_WIDTH = 260;
const ROW_HEIGHT = 26;

// 패널 경계(스플리터) 조작.
const SPLITTER_GRAB_WIDTH = 6;
const PANEL_WIDTH_MIN = 160;
const PANEL_WIDTH_MAX = 460;

// 스냅.
const SNAP_DISTANCE = 6;

// 좌측 위쪽 컴포넌트 영역 높이.
const PALETTE_HEIGHT = 214;

// 크기 조절 손잡이 8방향. (ratioX / ratioY 는 대상 영역 안에서의 위치 비율)
const RESIZE_HANDLE_DEFINITIONS = [
	{ id: "topLeft", ratioX: 0, ratioY: 0, moveLeft: true, moveTop: true, sizeX: -1, sizeY: -1 },
	{ id: "top", ratioX: 0.5, ratioY: 0, moveLeft: false, moveTop: true, sizeX: 0, sizeY: -1 },
	{ id: "topRight", ratioX: 1, ratioY: 0, moveLeft: false, moveTop: true, sizeX: 1, sizeY: -1 },
	{ id: "left", ratioX: 0, ratioY: 0.5, moveLeft: true, moveTop: false, sizeX: -1, sizeY: 0 },
	{ id: "right", ratioX: 1, ratioY: 0.5, moveLeft: false, moveTop: false, sizeX: 1, sizeY: 0 },
	{ id: "bottomLeft", ratioX: 0, ratioY: 1, moveLeft: true, moveTop: false, sizeX: -1, sizeY: 1 },
	{ id: "bottom", ratioX: 0.5, ratioY: 1, moveLeft: false, moveTop: false, sizeX: 0, sizeY: 1 },
	{ id: "bottomRight", ratioX: 1, ratioY: 1, moveLeft: false, moveTop: false, sizeX: 1, sizeY: 1 },
];

// 화면 확대 한 단계.
const VIEW_ZOOM_STEP = 1.12;

// 편집기 색상.
// 편집기 테마. (엔진 표준 PaneTheme 과 같은 값 — visualeditor 와 외형을 맞춘다)
//   background #1e1e1e / panel #252526 / toolbar #2d2d30 / border #444
//   text #ccc / textDim #aaa / inputBg #3c3c3c / resizer #333
// 강조는 바닐라 계열(#dcb67a)로 둔다.
const COLOR_BACKGROUND = new Color(0.118, 0.118, 0.118, 1);
const COLOR_TOOLBAR = new Color(0.176, 0.176, 0.188, 1);
const COLOR_PANEL = new Color(0.145, 0.145, 0.149, 1);
const COLOR_CANVAS_BACKGROUND = new Color(0.118, 0.118, 0.118, 1);
const COLOR_BUTTON = new Color(0.235, 0.235, 0.235, 1);
const COLOR_BUTTON_ACTIVE = new Color(0.055, 0.388, 0.612, 1);
const COLOR_ROW_SELECTED = new Color(0.055, 0.388, 0.612, 1);
const COLOR_FIELD = new Color(0.235, 0.235, 0.235, 1);
const COLOR_SECTION = new Color(0.863, 0.714, 0.478, 1);
const COLOR_TEXT = new Color(0.800, 0.800, 0.800, 1);
const COLOR_TEXT_DIM = new Color(0.667, 0.667, 0.667, 1);
const COLOR_SELECTION_OUTLINE = new Color(0.863, 0.714, 0.478, 1);
const COLOR_BORDER = new Color(0.267, 0.267, 0.267, 1);
const COLOR_BORDER_SOFT = new Color(0.200, 0.200, 0.200, 1);
const COLOR_HEADER = new Color(0.176, 0.176, 0.188, 1);
const COLOR_SPLITTER = new Color(0.200, 0.200, 0.200, 1);
const COLOR_INDENT_GUIDE = new Color(0.250, 0.250, 0.250, 1);
const COLOR_HOVER = new Color(0.165, 0.176, 0.180, 1);
const COLOR_ROW_HOVER = new Color(0.165, 0.176, 0.180, 1);

// 손잡이 방향별 마우스 커서 모양.
const RESIZE_CURSOR_TABLE = {
	topLeft: "nwse-resize",
	top: "ns-resize",
	topRight: "nesw-resize",
	left: "ew-resize",
	right: "ew-resize",
	bottomLeft: "nesw-resize",
	bottom: "ns-resize",
	bottomRight: "nwse-resize",
};

// 계층에 보여 줄 종류별 기호.
const NODE_GLYPH_TABLE = {
	UIButton: "\u25A3",
	UILabel: "\u0054",
	Text: "\u0054",
	UIScrollView: "\u2261",
	UIProgressView: "\u25AC",
	UISlider: "\u229D",
	UIImageView: "\u25A6",
	Sprite: "\u25A6",
	Mask: "\u25F0",
	Paint: "\u25A1",
};

// 모서리 둥글기.
const ROUND_BUTTON = 6;
const ROUND_FIELD = 5;
const ROUND_ROW = 5;

// 새 노드의 기본 크기.
const NEW_NODE_SIZE = 140;

// 선택 표시 테두리 두께.
const SELECTION_BORDER_THICKNESS = 2;

// 리사이즈 손잡이 크기.
const RESIZE_HANDLE_SIZE = 12;

// 값 칸을 끌었다고 볼 최소 이동량. (이보다 작으면 직접 입력으로 본다)
const FIELD_DRAG_THRESHOLD = 3;

// 되돌리기 보관 개수.
const UNDO_LIMIT = 64;

// 화면 확대 범위.
const VIEW_SCALE_MIN = 0.25;
const VIEW_SCALE_MAX = 4;

// 메뉴바 구성. (열면 아래로 항목이 펼쳐진다)
const MENU_DEFINITIONS = [
	{
		title: "파일",
		items: [
			{ id: "newDocument", label: "새로 만들기" },
			{ id: "load", label: "열기..." },
			{ id: "save", label: "저장 (JSON)" },
		],
	},
	{
		title: "편집",
		items: [
			{ id: "undo", label: "실행 취소        Ctrl+Z" },
			{ id: "redo", label: "다시 실행        Ctrl+Shift+Z" },
			{ id: "duplicate", label: "복제                Ctrl+D" },
			{ id: "deleteNode", label: "삭제                Delete" },
		],
	},
	{
		title: "추가",
		items: [
			{ id: "addNode", label: "패널" },
			{ id: "addText", label: "텍스트" },
			{ id: "addButton", label: "버튼" },
			{ id: "addScrollView", label: "스크롤뷰" },
			{ id: "addProgress", label: "진행바" },
			{ id: "addSlider", label: "슬라이더" },
		],
	},
];

// 컴포넌트 영역에 놓이는 항목. (누르면 편집 화면에 더한다)
const PALETTE_DEFINITIONS = [
	{ id: "addNode", label: "패널", glyph: "\u25A1" },
	{ id: "addText", label: "텍스트", glyph: "\u0054" },
	{ id: "addButton", label: "버튼", glyph: "\u25A3" },
	{ id: "addScrollView", label: "스크롤뷰", glyph: "\u2261" },
	{ id: "addProgress", label: "진행바", glyph: "\u25AC" },
	{ id: "addSlider", label: "슬라이더", glyph: "\u229D" },
];

// 우클릭 메뉴 구성.
const CONTEXT_MENU_ITEMS = [
	{ id: "duplicate", label: "복제" },
	{ id: "deleteNode", label: "삭제" },
	{ id: "bringToFront", label: "맨 앞으로" },
	{ id: "sendToBack", label: "맨 뒤로" },
];

// 컴포넌트별 편집 가능 속성. (참고 프로젝트의 버튼/패널/목록이 쓰는 표현을 편집할 수 있게 맞췄다)
// - kind: number 는 좌우 드래그, text 와 color 는 클릭 입력.
const COMPONENT_EDITOR_SCHEMA = {
	Paint: [
		{ propertyId: "color", label: "색상", kind: "color", getterName: "getColor", setterName: "setColor" },
		{ propertyId: "roundSize", label: "라운드", kind: "number", getterName: "getRoundSize", setterName: "setRoundSize" },
	],
	Sprite: [
		{ propertyId: "color", label: "색상", kind: "color", getterName: "getColor", setterName: "setColor" },
		{ propertyId: "roundSize", label: "라운드", kind: "number", getterName: "getRoundSize", setterName: "setRoundSize" },
	],
	Text: [
		{ propertyId: "text", label: "텍스트", kind: "text", getterName: "getText", setterName: "setText" },
		{ propertyId: "fontSize", label: "글자크기", kind: "number", getterName: "getFontSize", setterName: "setFontSize" },
		{ propertyId: "textColor", label: "글자색", kind: "color", getterName: "getTextColor", setterName: "setTextColor" },
	],
	UILabel: [
		{ propertyId: "text", label: "텍스트", kind: "text", getterName: "getText", setterName: "setText" },
		{ propertyId: "fontSize", label: "글자크기", kind: "number", getterName: "getFontSize", setterName: "setFontSize" },
		{ propertyId: "textColor", label: "글자색", kind: "color", getterName: "getTextColor", setterName: "setTextColor" },
	],
	UIButton: [
		{ propertyId: "pressedTintColor", label: "눌림색", kind: "color", getterName: "getPressedTintColor", setterName: "setPressedTintColor" },
		{ propertyId: "transitionDuration", label: "전환시간", kind: "number", getterName: "getTransitionDuration", setterName: "setTransitionDuration", step: 0.01 },
	],
	UIProgressView: [
		{ propertyId: "value", label: "값", kind: "number", getterName: "getValue", setterName: "setValue", step: 0.01 },
	],
	UISlider: [
		{ propertyId: "value", label: "값", kind: "number", getterName: "getValue", setterName: "setValue", step: 0.01 },
	],
	UIScrollView: [
		{ propertyId: "dragSensitivity", label: "드래그감도", kind: "number", getterName: "getDragSensitivity", setterName: "setDragSensitivity", step: 0.1 },
	],
};


//==============================================================================
// 편집기 씬. (엔진 UI 로 구성한 UI 편집 도구)
// - 좌측 계층 트리 / 중앙 편집 캔버스 / 우측 속성 패널 / 상단 툴바.
// - 편집 대상 문서 트리는 캔버스 노드의 자식으로 살아 있는 실제 노드다.
//   즉 편집 화면에 보이는 것이 런타임 결과와 동일하다.
//==============================================================================
export class UIEditorScene extends Scene {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WorldNode } */ #toolbarNode;
	/** @private @type { WorldNode } */ #hierarchyNode;
	/** @private @type { WorldNode } */ #inspectorNode;
	/** @private @type { WorldNode } */ #canvasNode;
	/** @private @type { WorldNode } */ #documentRootNode;
	/** @private @type { WorldNode } */ #overlayNode;
	/** @private @type { WorldNode | null } */ #selectedNode;
	/** @private @type { object[] } */ #toolbarButtons;
	/** @private @type { object[] } */ #hierarchyRows;
	/** @private @type { object[] } */ #inspectorFields;
	/** @private @type { string } */ #dragMode;
	/** @private @type { Vector2 } */ #dragStartInputPosition;
	/** @private @type { Vector2 } */ #dragStartValue;
	/** @private @type { object | null } */ #activeField;
	/** @private @type { boolean } */ #isFieldDragged;
	/** @private @type { string[] } */ #undoStack;
	/** @private @type { string[] } */ #redoStack;
	/** @private @type { number } */ #viewScale;
	/** @private @type { Vector2 } */ #viewOffset;
	/** @private @type { Vector2 } */ #panStartOffset;
	/** @private @type { number } */ #hierarchyWidth;
	/** @private @type { number } */ #inspectorWidth;
	/** @private @type { number } */ #splitStartWidth;
	/** @private @type { object[] } */ #snapGuideList;
	/** @private @type { object | null } */ #activeResizeHandle;
	/** @private @type { Vector2 } */ #resizeStartPosition;
	/** @private @type { Vector2 } */ #resizeStartSize;
	/** @private @type { WorldNode } */ #menuBarNode;
	/** @private @type { WorldNode } */ #statusBarNode;
	/** @private @type { WorldNode } */ #popupLayerNode;
	/** @private @type { object[] } */ #menuTitleEntries;
	/** @private @type { object[] } */ #popupItemEntries;
	/** @private @type { number } */ #openMenuIndex;
	/** @private @type { WorldNode } */ #splitterHandleLeft;
	/** @private @type { WorldNode } */ #splitterHandleRight;
	/** @private @type { string } */ #hoverTargetKey;
	/** @private @type { Vector2 } */ #pointerViewPosition;
	/** @private @type { WorldNode } */ #paletteNode;
	/** @private @type { object[] } */ #paletteEntries;
	/** @private @type { number } */ #nodeSerialNumber;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();

		this.#toolbarNode = null;
		this.#hierarchyNode = null;
		this.#inspectorNode = null;
		this.#canvasNode = null;
		this.#documentRootNode = null;
		this.#overlayNode = null;
		this.#selectedNode = null;
		this.#toolbarButtons = [];
		this.#hierarchyRows = [];
		this.#inspectorFields = [];
		this.#dragMode = "none";
		this.#dragStartInputPosition = Vector2.zero();
		this.#dragStartValue = Vector2.zero();
		this.#activeField = null;
		this.#isFieldDragged = false;
		this.#undoStack = [];
		this.#redoStack = [];
		this.#viewScale = 1;
		this.#viewOffset = Vector2.zero();
		this.#panStartOffset = Vector2.zero();
		this.#hierarchyWidth = HIERARCHY_WIDTH;
		this.#inspectorWidth = INSPECTOR_WIDTH;
		this.#splitStartWidth = 0;
		this.#snapGuideList = [];
		this.#activeResizeHandle = null;
		this.#resizeStartPosition = Vector2.zero();
		this.#resizeStartSize = Vector2.zero();
		this.#menuBarNode = null;
		this.#statusBarNode = null;
		this.#popupLayerNode = null;
		this.#menuTitleEntries = [];
		this.#popupItemEntries = [];
		this.#openMenuIndex = -1;
		this.#splitterHandleLeft = null;
		this.#splitterHandleRight = null;
		this.#hoverTargetKey = "";
		this.#pointerViewPosition = Vector2.zero();
		this.#paletteNode = null;
		this.#paletteEntries = [];
		this.#nodeSerialNumber = 0;
	}

	//==============================================================================
	// 씬 구성.
	//==============================================================================
	/**
	 * @override
	 */
	create() {
		super.create();

		const root = this.getRoot();
		root.setPivot(Pivot.topLeft.clone());
		root.setAnchor(Pivot.topLeft.clone());

		// 편집 캔버스. (문서 트리를 담는 영역)
		this.#canvasNode = this.createPanel(COLOR_CANVAS_BACKGROUND, "canvas");
		root.addChild(this.#canvasNode);

		this.#documentRootNode = new WorldNode();
		this.#documentRootNode.setName("Root");
		this.#documentRootNode.setPivot(Pivot.topLeft.clone());
		this.#documentRootNode.setAnchor(Pivot.topLeft.clone());
		this.#documentRootNode.setContentSize(Vector2.create(720, 480));
		this.#documentRootNode.setLocalPosition(Vector2.create(0, 0));
		const documentBackground = this.#documentRootNode.addComponent(Paint);
		documentBackground.setColor(new Color(0.208, 0.208, 0.216, 1));
		this.#canvasNode.addChild(this.#documentRootNode);

		// 선택 표시 오버레이. (문서 트리 위에 그려지는 편집기 전용 표시)
		this.#overlayNode = new WorldNode();
		this.#overlayNode.setName("overlay");
		this.#overlayNode.setPivot(Pivot.topLeft.clone());
		this.#overlayNode.setAnchor(Pivot.topLeft.clone());
		this.#canvasNode.addChild(this.#overlayNode);

		// 패널.
		this.#menuBarNode = this.createPanel(COLOR_TOOLBAR, "menubar");
		root.addChild(this.#menuBarNode);
		this.#toolbarNode = this.createPanel(COLOR_TOOLBAR, "toolbar");
		root.addChild(this.#toolbarNode);
		this.#statusBarNode = this.createPanel(COLOR_TOOLBAR, "statusbar");
		root.addChild(this.#statusBarNode);
		this.#splitterHandleLeft = this.createPanel(COLOR_SPLITTER, "splitterLeft");
		root.addChild(this.#splitterHandleLeft);
		this.#splitterHandleRight = this.createPanel(COLOR_SPLITTER, "splitterRight");
		root.addChild(this.#splitterHandleRight);
		this.#paletteNode = this.createPanel(COLOR_PANEL, "palette");
		root.addChild(this.#paletteNode);
		this.#hierarchyNode = this.createPanel(COLOR_PANEL, "hierarchy");
		root.addChild(this.#hierarchyNode);
		this.#inspectorNode = this.createPanel(COLOR_PANEL, "inspector");
		root.addChild(this.#inspectorNode);

		// 팝업(메뉴/우클릭)은 항상 맨 위에 그려야 하므로 마지막에 붙인다.
		this.#popupLayerNode = new WorldNode();
		this.#popupLayerNode.setName("popupLayer");
		this.#popupLayerNode.setPivot(Pivot.topLeft.clone());
		this.#popupLayerNode.setAnchor(Pivot.topLeft.clone());
		root.addChild(this.#popupLayerNode);

		this.buildMenuBar();
		this.buildToolbar();
		this.buildPalette();
		this.rebuildHierarchy();
		this.rebuildInspector();
		this.refreshStatusBar();

		// 마우스 위치 추적. (커서 모양과 강조 표시에 쓴다)
		System.window.addEventListener("mousemove", (mouseEvent) => {
			this.handlePointerMove(mouseEvent.clientX, mouseEvent.clientY);
		});

		// 우클릭 메뉴. (브라우저 기본 메뉴는 막는다)
		System.window.addEventListener("contextmenu", (mouseEvent) => {
			mouseEvent.preventDefault();
			this.openContextMenuAt(mouseEvent.clientX, mouseEvent.clientY);
		});

		System.window.addEventListener("keydown", (keyboardEvent) => {
			this.handleKeyDown(keyboardEvent);
		});
	}

	//==============================================================================
	// 단축키 처리. (되돌리기 / 복제 / 삭제 / 화살표 이동)
	//==============================================================================
	/**
	 * @param { KeyboardEvent } keyboardEvent
	 */
	handleKeyDown(keyboardEvent) {
		const isCommandKey = keyboardEvent.ctrlKey || keyboardEvent.metaKey;
		const loweredKey = keyboardEvent.key.toLowerCase();

		if (isCommandKey && loweredKey === "z") {
			if (keyboardEvent.shiftKey) {
				this.redoDocument();
			}
			else {
				this.undoDocument();
			}
			keyboardEvent.preventDefault();
			return;
		}
		if (isCommandKey && loweredKey === "d") {
			this.duplicateSelectedNode();
			keyboardEvent.preventDefault();
			return;
		}
		if (keyboardEvent.key === "Delete") {
			this.deleteSelectedNode();
			keyboardEvent.preventDefault();
			return;
		}
		if (keyboardEvent.key.indexOf("Arrow") === 0) {
			const selectedNode = this.getSelectedNode();
			if (!selectedNode || selectedNode === this.#documentRootNode) {
				return;
			}
			const moveAmount = keyboardEvent.shiftKey ? 10 : 1;
			let moveX = 0;
			let moveY = 0;
			if (keyboardEvent.key === "ArrowLeft") {
				moveX = -moveAmount;
			}
			else if (keyboardEvent.key === "ArrowRight") {
				moveX = moveAmount;
			}
			else if (keyboardEvent.key === "ArrowUp") {
				moveY = -moveAmount;
			}
			else if (keyboardEvent.key === "ArrowDown") {
				moveY = moveAmount;
			}
			this.pushUndoSnapshot();
			const localPosition = selectedNode.getLocalPosition();
			selectedNode.setLocalPosition(Vector2.create(localPosition.x + moveX, localPosition.y + moveY));
			this.refreshSelectionOverlay();
			this.rebuildInspector();
			keyboardEvent.preventDefault();
		}
	}

	//==============================================================================
	// 되돌리기 스냅샷 저장. (문서를 바꾸기 직전에 부른다)
	//==============================================================================
	pushUndoSnapshot() {
		if (!this.#documentRootNode) {
			return;
		}
		const jsonText = UIDocument.toJsonText(this.#documentRootNode, false);
		this.#undoStack.push(jsonText);
		if (this.#undoStack.length > UNDO_LIMIT) {
			this.#undoStack.shift();
		}
		this.#redoStack = [];
	}

	//==============================================================================
	// 되돌리기.
	//==============================================================================
	undoDocument() {
		if (this.#undoStack.length === 0) {
			return;
		}
		const currentJsonText = UIDocument.toJsonText(this.#documentRootNode, false);
		this.#redoStack.push(currentJsonText);
		const previousJsonText = this.#undoStack.pop();
		this.replaceDocument(previousJsonText);
	}

	//==============================================================================
	// 다시 실행.
	//==============================================================================
	redoDocument() {
		if (this.#redoStack.length === 0) {
			return;
		}
		const currentJsonText = UIDocument.toJsonText(this.#documentRootNode, false);
		this.#undoStack.push(currentJsonText);
		const nextJsonText = this.#redoStack.pop();
		this.replaceDocument(nextJsonText);
	}

	//==============================================================================
	// 문서 교체. (되돌리기 / 불러오기 공통)
	//==============================================================================
	/**
	 * @param { string } jsonText
	 */
	replaceDocument(jsonText) {
		const loadedRootNode = UIDocument.fromJsonText(jsonText);
		const canvasNode = this.#canvasNode;
		canvasNode.removeChild(this.#documentRootNode);
		this.#documentRootNode = loadedRootNode;
		this.#documentRootNode.setPivot(Pivot.topLeft.clone());
		this.#documentRootNode.setAnchor(Pivot.topLeft.clone());
		canvasNode.addChild(this.#documentRootNode);
		canvasNode.removeChild(this.#overlayNode);
		canvasNode.addChild(this.#overlayNode);
		this.selectNode(null);
		this.rebuildHierarchy();
	}

	//==============================================================================
	// 선택 노드 복제.
	//==============================================================================
	duplicateSelectedNode() {
		const selectedNode = this.getSelectedNode();
		if (!selectedNode || selectedNode === this.#documentRootNode) {
			return;
		}
		const parentNode = selectedNode.getParent();
		if (!parentNode) {
			return;
		}
		this.pushUndoSnapshot();
		const nodeData = UIDocument.serializeNode(selectedNode);
		const copiedNode = UIDocument.deserializeNode(nodeData);
		this.#nodeSerialNumber += 1;
		copiedNode.setName(selectedNode.getName() + "_사본" + this.#nodeSerialNumber);
		const localPosition = selectedNode.getLocalPosition();
		copiedNode.setLocalPosition(Vector2.create(localPosition.x + 16, localPosition.y + 16));
		parentNode.addChild(copiedNode);
		this.selectNode(copiedNode);
		this.rebuildHierarchy();
	}

	//==============================================================================
	// 단색 패널 노드 생성. (좌상단 기준)
	//==============================================================================
	/**
	 * @param { Color } color
	 * @param { string } name
	 * @returns { WorldNode }
	 */
	createPanel(color, name, roundSize = 0) {
		const panelNode = new WorldNode();
		panelNode.setName(name);
		panelNode.setPivot(Pivot.topLeft.clone());
		panelNode.setAnchor(Pivot.topLeft.clone());
		const paint = panelNode.addComponent(Paint);
		paint.setColor(color);
		paint.setRoundSize(roundSize);
		return panelNode;
	}

	//==============================================================================
	// 구분선 추가. (데스크톱 앱처럼 영역 경계를 또렷하게 나눈다)
	//==============================================================================
	/**
	 * @param { WorldNode } parentNode
	 * @param { Color } color
	 * @param { number } positionX
	 * @param { number } positionY
	 * @param { number } width
	 * @param { number } height
	 */
	addDividerLine(parentNode, color, positionX, positionY, width, height) {
		const dividerNode = this.createPanel(color, "divider");
		dividerNode.setContentSize(Vector2.create(width, height));
		dividerNode.setLocalPosition(Vector2.create(positionX, positionY));
		parentNode.addChild(dividerNode);
		return dividerNode;
	}

	//==============================================================================
	// 레이블 노드 생성. (좌상단 기준)
	// - Text 는 노드 영역(contentSize) 안에서 정렬되므로, 레이블 노드를 담을 영역 크기로
	//   만들고 위치는 영역 좌상단에 맞춘다. 여기에 중앙 오프셋을 더하면 이중으로 밀린다.
	//==============================================================================
	/**
	 * @param { string } textString
	 * @param { number } fontSize
	 * @param { Color } color
	 * @returns { WorldNode }
	 */
	createLabel(textString, fontSize, color) {
		const labelNode = new WorldNode();
		labelNode.setPivot(Pivot.topLeft.clone());
		labelNode.setAnchor(Pivot.topLeft.clone());
		const text = labelNode.addComponent(Text);
		text.setText(textString);
		text.setFontSize(fontSize);
		text.setTextColor(color);
		text.setTextAlign("left");
		text.setTextBaseline("middle");
		return labelNode;
	}

	//==============================================================================
	// 마우스 이동 처리. (커서 모양 + 마우스가 올라간 대상 강조)
	//==============================================================================
	/**
	 * @param { number } clientX
	 * @param { number } clientY
	 */
	handlePointerMove(clientX, clientY) {
		const engine = this.getEngine();
		if (!engine) {
			return;
		}
		const viewManager = engine.getViewManager();
		const devicePixelRatio = viewManager.getDevicePixelRatio();
		const canvasPosition = Vector2.create(clientX * devicePixelRatio, clientY * devicePixelRatio);
		const viewPosition = viewManager.canvasPositionToViewPosition(canvasPosition);
		this.#pointerViewPosition = viewPosition;

		this.applyPointerCursor(viewPosition);

		// 강조 대상이 바뀔 때만 다시 그린다. (매 프레임 재구성은 낭비다)
		const nextHoverKey = this.findHoverTargetKey(viewPosition);
		if (nextHoverKey !== this.#hoverTargetKey) {
			this.#hoverTargetKey = nextHoverKey;
			this.buildMenuBar();
			this.buildToolbar();
			this.buildPalette();
			this.rebuildHierarchy();
		}
	}

	//==============================================================================
	// 커서 모양 적용. (경계·손잡이·이동 대상에 따라 바뀐다)
	//==============================================================================
	/**
	 * @param { Vector2 } viewPosition
	 */
	applyPointerCursor(viewPosition) {
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		const canvas = viewManager.getCanvas();
		if (!canvas) {
			return;
		}

		if (this.#dragMode === "splitLeft" || this.#dragMode === "splitRight" || this.hitSplitter(viewPosition) !== "none") {
			canvas.style.cursor = "col-resize";
			return;
		}
		const selectedNode = this.getSelectedNode();
		if (selectedNode && selectedNode !== this.#documentRootNode) {
			const handleDefinition = this.findResizeHandleAt(selectedNode, viewPosition);
			if (handleDefinition) {
				canvas.style.cursor = RESIZE_CURSOR_TABLE[handleDefinition.id] || "default";
				return;
			}
		}
		for (const fieldEntry of this.#inspectorFields) {
			if (fieldEntry.kind === "number" && this.containsPoint(fieldEntry.node, viewPosition)) {
				canvas.style.cursor = "ew-resize";
				return;
			}
			if (fieldEntry.kind !== "number" && this.containsPoint(fieldEntry.node, viewPosition)) {
				canvas.style.cursor = "text";
				return;
			}
		}
		if (this.containsPoint(this.#canvasNode, viewPosition)) {
			const hitNode = this.findTopmostNodeAt(this.#documentRootNode, viewPosition);
			canvas.style.cursor = (hitNode && hitNode !== this.#documentRootNode) ? "move" : "default";
			return;
		}
		if (this.#popupItemEntries.length > 0 || this.#menuTitleEntries.length > 0) {
			for (const popupEntry of this.#popupItemEntries) {
				if (this.containsPoint(popupEntry.node, viewPosition)) {
					canvas.style.cursor = "pointer";
					return;
				}
			}
		}
		for (const buttonEntry of this.#toolbarButtons) {
			if (this.containsPoint(buttonEntry.node, viewPosition)) {
				canvas.style.cursor = "pointer";
				return;
			}
		}
		for (const paletteEntry of this.#paletteEntries) {
			if (this.containsPoint(paletteEntry.node, viewPosition)) {
				canvas.style.cursor = "pointer";
				return;
			}
		}
		canvas.style.cursor = "default";
	}

	//==============================================================================
	// 마우스가 올라간 대상 식별자 반환. (강조 표시용)
	//==============================================================================
	/**
	 * @param { Vector2 } viewPosition
	 * @returns { string }
	 */
	findHoverTargetKey(viewPosition) {
		for (const menuEntry of this.#menuTitleEntries) {
			if (this.containsPoint(menuEntry.node, viewPosition)) {
				return "menu:" + menuEntry.menuIndex;
			}
		}
		for (const buttonEntry of this.#toolbarButtons) {
			if (this.containsPoint(buttonEntry.node, viewPosition)) {
				return "tool:" + buttonEntry.id;
			}
		}
		for (const paletteEntry of this.#paletteEntries) {
			if (this.containsPoint(paletteEntry.node, viewPosition)) {
				return "palette:" + paletteEntry.id;
			}
		}
		for (const rowEntry of this.#hierarchyRows) {
			if (this.containsPoint(rowEntry.rowNode, viewPosition)) {
				return "row:" + rowEntry.node.getInstanceId();
			}
		}
		return "";
	}

	//==============================================================================
	// 노드 종류 기호 반환. (붙어 있는 컴포넌트로 판단)
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @returns { string }
	 */
	findNodeGlyph(node) {
		const componentList = node.getAllComponents();
		for (const component of componentList) {
			const glyph = NODE_GLYPH_TABLE[component.constructor.name];
			if (glyph) {
				return glyph;
			}
		}
		return "\u25CB";
	}

	//==============================================================================
	// 메뉴바 구성. (제목만 배치하고, 항목은 누를 때 펼친다)
	//==============================================================================
	buildMenuBar() {
		this.#menuBarNode.removeChildren();
		this.#menuTitleEntries = [];
		let offsetX = 6;
		for (let menuIndex = 0; menuIndex < MENU_DEFINITIONS.length; ++menuIndex) {
			const menuDefinition = MENU_DEFINITIONS[menuIndex];
			const titleWidth = menuDefinition.title.length * 13 + 20;
			const isOpen = menuIndex === this.#openMenuIndex;
			const isHovering = this.#hoverTargetKey === "menu:" + menuIndex;
			let titleColor = COLOR_TOOLBAR;
			if (isOpen) {
				titleColor = COLOR_BUTTON;
			}
			else if (isHovering) {
				titleColor = COLOR_HOVER;
			}
			const titleNode = this.createPanel(titleColor, "menuTitle", 4);
			titleNode.setContentSize(Vector2.create(titleWidth, MENUBAR_HEIGHT - 4));
			titleNode.setLocalPosition(Vector2.create(offsetX, 2));
			this.#menuBarNode.addChild(titleNode);

			const labelNode = this.createLabel(menuDefinition.title, 13, COLOR_TEXT);
			labelNode.setContentSize(Vector2.create(titleWidth, MENUBAR_HEIGHT - 4));
			labelNode.setLocalPosition(Vector2.create(10, 0));
			titleNode.addChild(labelNode);

			this.#menuTitleEntries.push({ menuIndex: menuIndex, node: titleNode, offsetX: offsetX });
			offsetX += titleWidth + 4;
		}

		const menuBarSize = this.#menuBarNode.getContentSize();
		this.addDividerLine(this.#menuBarNode, COLOR_BORDER, 0, MENUBAR_HEIGHT - 1, System.Math.max(menuBarSize.x, 4000), 1);
	}

	//==============================================================================
	// 팝업 목록 열기. (메뉴바 드롭다운과 우클릭 메뉴가 같은 표현을 쓴다)
	//==============================================================================
	/**
	 * @param { object[] } itemDefinitions
	 * @param { number } localX
	 * @param { number } localY
	 */
	openPopupMenu(itemDefinitions, localX, localY) {
		this.closePopupMenu();
		const panelHeight = itemDefinitions.length * MENU_ITEM_HEIGHT + 8;
		const shadowNode = this.createPanel(new Color(0, 0, 0, 0.35), "popupShadow", 6);
		shadowNode.setContentSize(Vector2.create(MENU_PANEL_WIDTH + 4, panelHeight + 4));
		shadowNode.setLocalPosition(Vector2.create(localX + 2, localY + 3));
		this.#popupLayerNode.addChild(shadowNode);

		const panelNode = this.createPanel(COLOR_HEADER, "popupPanel", 6);
		panelNode.setContentSize(Vector2.create(MENU_PANEL_WIDTH, panelHeight));
		panelNode.setLocalPosition(Vector2.create(localX, localY));
		this.#popupLayerNode.addChild(panelNode);

		for (let itemIndex = 0; itemIndex < itemDefinitions.length; ++itemIndex) {
			const itemDefinition = itemDefinitions[itemIndex];
			const itemNode = this.createPanel(COLOR_HEADER, "popupItem", 4);
			itemNode.setContentSize(Vector2.create(MENU_PANEL_WIDTH - 8, MENU_ITEM_HEIGHT));
			itemNode.setLocalPosition(Vector2.create(4, 4 + itemIndex * MENU_ITEM_HEIGHT));
			panelNode.addChild(itemNode);

			const labelNode = this.createLabel(itemDefinition.label, 13, COLOR_TEXT);
			labelNode.setContentSize(Vector2.create(MENU_PANEL_WIDTH - 20, MENU_ITEM_HEIGHT));
			labelNode.setLocalPosition(Vector2.create(10, 0));
			itemNode.addChild(labelNode);

			this.#popupItemEntries.push({ id: itemDefinition.id, node: itemNode });
		}
	}

	//==============================================================================
	// 팝업 닫기.
	//==============================================================================
	closePopupMenu() {
		if (this.#popupLayerNode) {
			this.#popupLayerNode.removeChildren();
		}
		this.#popupItemEntries = [];
	}

	//==============================================================================
	// 우클릭 메뉴 열기. (브라우저 좌표를 뷰 좌표로 바꿔 띄운다)
	//==============================================================================
	/**
	 * @param { number } clientX
	 * @param { number } clientY
	 */
	openContextMenuAt(clientX, clientY) {
		const engine = this.getEngine();
		if (!engine) {
			return;
		}
		const viewManager = engine.getViewManager();
		const devicePixelRatio = viewManager.getDevicePixelRatio();
		const canvasPosition = Vector2.create(clientX * devicePixelRatio, clientY * devicePixelRatio);
		const viewPosition = viewManager.canvasPositionToViewPosition(canvasPosition);

		// 캔버스 위에서 누른 경우 그 자리의 노드를 먼저 고른다.
		if (this.containsPoint(this.#canvasNode, viewPosition)) {
			const hitNode = this.findTopmostNodeAt(this.#documentRootNode, viewPosition);
			if (hitNode) {
				this.selectNode(hitNode);
			}
		}
		this.#openMenuIndex = -1;
		this.buildMenuBar();
		this.openPopupMenu(CONTEXT_MENU_ITEMS, viewPosition.x, viewPosition.y);
	}

	//==============================================================================
	// 상태표시줄 갱신. (선택 대상과 문서 정보를 한 줄로 보여 준다)
	//==============================================================================
	refreshStatusBar() {
		if (!this.#statusBarNode) {
			return;
		}
		this.#statusBarNode.removeChildren();

		const selectedNode = this.getSelectedNode();
		let statusText = "선택 없음";
		if (selectedNode) {
			const localPosition = selectedNode.getLocalPosition();
			const contentSize = selectedNode.getContentSize();
			const componentNameList = selectedNode.getAllComponents().map((component) => component.constructor.name);
			statusText = selectedNode.getName()
				+ "    x " + System.Math.round(localPosition.x) + "  y " + System.Math.round(localPosition.y)
				+ "    w " + System.Math.round(contentSize.x) + "  h " + System.Math.round(contentSize.y);
			if (componentNameList.length > 0) {
				statusText += "    [" + componentNameList.join(", ") + "]";
			}
		}
		const totalCount = this.countNodes(this.#documentRootNode) - 1;
		statusText += "        노드 " + totalCount + "개";

		this.addDividerLine(this.#statusBarNode, COLOR_BORDER, 0, 0, 4000, 1);

		const labelNode = this.createLabel(statusText, 12, COLOR_TEXT_DIM);
		labelNode.setContentSize(Vector2.create(1200, STATUSBAR_HEIGHT));
		labelNode.setLocalPosition(Vector2.create(12, 0));
		this.#statusBarNode.addChild(labelNode);
	}

	//==============================================================================
	// 노드 수 세기. (재귀)
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @returns { number }
	 */
	countNodes(node) {
		let totalCount = 1;
		const childNodeList = node.getChildren();
		for (const childNode of childNodeList) {
			totalCount += this.countNodes(childNode);
		}
		return totalCount;
	}

	//==============================================================================
	// 툴바 구성. (노드 추가 / 삭제 / 저장 / 불러오기)
	//==============================================================================
	buildToolbar() {
		const buttonDefinitions = [
			{ id: "newDocument", label: "새 문서" },
			{ id: "load", label: "열기" },
			{ id: "save", label: "저장" },
			{ id: "undo", label: "실행취소" },
			{ id: "redo", label: "다시실행" },
			{ id: "duplicate", label: "복제" },
			{ id: "deleteNode", label: "삭제" },
		];
		this.#toolbarButtons = [];
		let offsetX = 10;
		for (const definition of buttonDefinitions) {
			const buttonWidth = definition.label.length * 11 + 28;
			const isHovering = this.#hoverTargetKey === "tool:" + definition.id;
			const buttonNode = this.createPanel(isHovering ? COLOR_HOVER : COLOR_BUTTON, definition.id, ROUND_BUTTON);
			buttonNode.setContentSize(Vector2.create(buttonWidth, 30));
			buttonNode.setLocalPosition(Vector2.create(offsetX, 7));
			this.#toolbarNode.addChild(buttonNode);

			const labelNode = this.createLabel(definition.label, 14, COLOR_TEXT);
			labelNode.setContentSize(Vector2.create(buttonWidth, 30));
			labelNode.setLocalPosition(Vector2.create(14, 0));
			buttonNode.addChild(labelNode);

			this.#toolbarButtons.push({ id: definition.id, node: buttonNode });
			offsetX += buttonWidth + 8;

			// 만들기 도구와 파일 도구 사이를 세로선으로 끊는다.
			if (definition.id === "save" || definition.id === "duplicate") {
				this.addDividerLine(this.#toolbarNode, COLOR_BORDER_SOFT, offsetX - 2, 9, 1, TOOLBAR_HEIGHT - 18);
				offsetX += 8;
			}
		}

		this.addDividerLine(this.#toolbarNode, COLOR_BORDER, 0, TOOLBAR_HEIGHT - 1, 4000, 1);
	}

	//==============================================================================
	// 컴포넌트 영역 구성. (좌측 위쪽 — 누르면 편집 화면에 해당 요소를 더한다)
	//==============================================================================
	buildPalette() {
		this.#paletteNode.removeChildren();
		this.#paletteEntries = [];

		const headerNode = this.createPanel(COLOR_HEADER, "panelHeader");
		headerNode.setContentSize(Vector2.create(this.#hierarchyWidth, 28));
		headerNode.setLocalPosition(Vector2.create(0, 0));
		this.#paletteNode.addChild(headerNode);
		this.addDividerLine(this.#paletteNode, COLOR_BORDER, 0, 28, this.#hierarchyWidth, 1);
		this.addDividerLine(this.#paletteNode, COLOR_BORDER, this.#hierarchyWidth - 1, 0, 1, PALETTE_HEIGHT);
		this.addDividerLine(this.#paletteNode, COLOR_BORDER, 0, PALETTE_HEIGHT - 1, this.#hierarchyWidth, 1);

		const titleNode = this.createLabel("COMPONENTS", 11, COLOR_TEXT_DIM);
		titleNode.setContentSize(Vector2.create(this.#hierarchyWidth, 28));
		titleNode.setLocalPosition(Vector2.create(12, 0));
		this.#paletteNode.addChild(titleNode);

		for (let itemIndex = 0; itemIndex < PALETTE_DEFINITIONS.length; ++itemIndex) {
			const definition = PALETTE_DEFINITIONS[itemIndex];
			const isHovering = this.#hoverTargetKey === "palette:" + definition.id;
			const rowY = 34 + itemIndex * ROW_HEIGHT;
			const rowNode = this.createPanel(isHovering ? COLOR_ROW_HOVER : COLOR_PANEL, "paletteRow", isHovering ? ROUND_ROW : 0);
			rowNode.setContentSize(Vector2.create(this.#hierarchyWidth - 12, ROW_HEIGHT - 2));
			rowNode.setLocalPosition(Vector2.create(6, rowY));
			this.#paletteNode.addChild(rowNode);

			const glyphNode = this.createLabel(definition.glyph, 12, COLOR_SECTION);
			glyphNode.setContentSize(Vector2.create(16, ROW_HEIGHT - 2));
			glyphNode.setLocalPosition(Vector2.create(8, 0));
			rowNode.addChild(glyphNode);

			const labelNode = this.createLabel(definition.label, 13, COLOR_TEXT);
			labelNode.setContentSize(Vector2.create(this.#hierarchyWidth - 40, ROW_HEIGHT - 2));
			labelNode.setLocalPosition(Vector2.create(26, 0));
			rowNode.addChild(labelNode);

			this.#paletteEntries.push({ id: definition.id, node: rowNode });
		}
	}

	//==============================================================================
	// 계층 트리 재구성. (문서 트리를 행 목록으로 펼침)
	//==============================================================================
	rebuildHierarchy() {
		this.#hierarchyNode.removeChildren();
		this.#hierarchyRows = [];

		const panelSize = this.#hierarchyNode.getContentSize();
		const headerNode = this.createPanel(COLOR_HEADER, "panelHeader");
		headerNode.setContentSize(Vector2.create(this.#hierarchyWidth, 28));
		headerNode.setLocalPosition(Vector2.create(0, 0));
		this.#hierarchyNode.addChild(headerNode);
		this.addDividerLine(this.#hierarchyNode, COLOR_BORDER, 0, 28, this.#hierarchyWidth, 1);
		this.addDividerLine(this.#hierarchyNode, COLOR_BORDER, this.#hierarchyWidth - 1, 0, 1, System.Math.max(panelSize.y, 4000));

		const titleNode = this.createLabel("HIERARCHY", 11, COLOR_TEXT_DIM);
		titleNode.setContentSize(Vector2.create(this.#hierarchyWidth, 28));
		titleNode.setLocalPosition(Vector2.create(12, 0));
		this.#hierarchyNode.addChild(titleNode);

		const flatList = [];
		this.collectHierarchyRows(this.#documentRootNode, 0, flatList);
		for (let rowIndex = 0; rowIndex < flatList.length; ++rowIndex) {
			const entry = flatList[rowIndex];
			const rowY = 34 + rowIndex * ROW_HEIGHT;
			const isSelected = entry.node === this.#selectedNode;
			const isHovering = this.#hoverTargetKey === "row:" + entry.node.getInstanceId();
			let rowColor = COLOR_PANEL;
			if (isSelected) {
				rowColor = COLOR_ROW_SELECTED;
			}
			else if (isHovering) {
				rowColor = COLOR_ROW_HOVER;
			}
			const rowNode = this.createPanel(rowColor, "row", (isSelected || isHovering) ? ROUND_ROW : 0);
			rowNode.setContentSize(Vector2.create(this.#hierarchyWidth - 12, ROW_HEIGHT - 2));
			rowNode.setLocalPosition(Vector2.create(6, rowY));
			this.#hierarchyNode.addChild(rowNode);

			for (let depthIndex = 1; depthIndex <= entry.depth; ++depthIndex) {
				this.addDividerLine(this.#hierarchyNode, COLOR_INDENT_GUIDE, 10 + depthIndex * 12, rowY, 1, ROW_HEIGHT - 2);
			}

			const indentWidth = entry.depth * 12;
			const glyphNode = this.createLabel(this.findNodeGlyph(entry.node), 12, COLOR_SECTION);
			glyphNode.setContentSize(Vector2.create(16, ROW_HEIGHT - 2));
			glyphNode.setLocalPosition(Vector2.create(8 + indentWidth, 0));
			rowNode.addChild(glyphNode);

			const labelNode = this.createLabel(entry.node.getName(), 13, COLOR_TEXT);
			labelNode.setContentSize(Vector2.create(this.#hierarchyWidth - 40 - indentWidth, ROW_HEIGHT - 2));
			labelNode.setLocalPosition(Vector2.create(26 + indentWidth, 0));
			rowNode.addChild(labelNode);

			this.#hierarchyRows.push({ node: entry.node, rowNode: rowNode });
		}
	}

	//==============================================================================
	// 계층 행 수집. (재귀 — 깊이 포함)
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @param { number } depth
	 * @param { object[] } outputList
	 */
	collectHierarchyRows(node, depth, outputList) {
		outputList.push({ node: node, depth: depth });

		// 위젯이 만든 content 래퍼는 편집 대상이 아니므로 계층에 드러내지 않는다.
		// 다만 그 안에 담긴 자식(스크롤뷰 목록 항목 등)은 그대로 보여 준다.
		const widgetContentNodeSet = new System.Set();
		const componentList = node.getAllComponents();
		for (const component of componentList) {
			if (component instanceof UIView) {
				const contentNode = component.getContent();
				if (contentNode) {
					widgetContentNodeSet.add(contentNode);
				}
			}
		}

		const childNodeList = node.getChildren();
		for (const childNode of childNodeList) {
			if (widgetContentNodeSet.has(childNode)) {
				const grandChildNodeList = childNode.getChildren();
				for (const grandChildNode of grandChildNodeList) {
					this.collectHierarchyRows(grandChildNode, depth + 1, outputList);
				}
				continue;
			}
			this.collectHierarchyRows(childNode, depth + 1, outputList);
		}
	}

	//==============================================================================
	// 속성 패널 재구성. (노드 속성 + 붙어 있는 컴포넌트별 속성)
	//==============================================================================
	rebuildInspector() {
		this.#inspectorNode.removeChildren();
		this.#inspectorFields = [];

		const panelSize = this.#inspectorNode.getContentSize();
		const headerNode = this.createPanel(COLOR_HEADER, "panelHeader");
		headerNode.setContentSize(Vector2.create(this.#inspectorWidth, 28));
		headerNode.setLocalPosition(Vector2.create(0, 0));
		this.#inspectorNode.addChild(headerNode);
		this.addDividerLine(this.#inspectorNode, COLOR_BORDER, 0, 28, this.#inspectorWidth, 1);
		this.addDividerLine(this.#inspectorNode, COLOR_BORDER, 0, 0, 1, System.Math.max(panelSize.y, 4000));

		const titleNode = this.createLabel("INSPECTOR", 11, COLOR_TEXT_DIM);
		titleNode.setContentSize(Vector2.create(this.#inspectorWidth, 28));
		titleNode.setLocalPosition(Vector2.create(12, 0));
		this.#inspectorNode.addChild(titleNode);

		const selectedNode = this.getSelectedNode();
		if (!selectedNode) {
			const emptyNode = this.createLabel("선택된 노드 없음", 13, COLOR_TEXT_DIM);
			emptyNode.setContentSize(Vector2.create(this.#inspectorWidth, 24));
			emptyNode.setLocalPosition(Vector2.create(12, 40));
			this.#inspectorNode.addChild(emptyNode);
			return;
		}

		const localPosition = selectedNode.getLocalPosition();
		const contentSize = selectedNode.getContentSize();
		let offsetY = 36;
		offsetY = this.addInspectorField(offsetY, "이름", String(selectedNode.getName()), { target: "node", propertyId: "name", kind: "text" });
		offsetY = this.addInspectorField(offsetY, "X", String(System.Math.round(localPosition.x)), { target: "node", propertyId: "positionX", kind: "number" });
		offsetY = this.addInspectorField(offsetY, "Y", String(System.Math.round(localPosition.y)), { target: "node", propertyId: "positionY", kind: "number" });
		offsetY = this.addInspectorField(offsetY, "너비", String(System.Math.round(contentSize.x)), { target: "node", propertyId: "width", kind: "number" });
		offsetY = this.addInspectorField(offsetY, "높이", String(System.Math.round(contentSize.y)), { target: "node", propertyId: "height", kind: "number" });

		// 컴포넌트별 속성. (스키마에 등록된 것만 편집 가능)
		// 위젯이 스스로 만든 컴포넌트는 위젯 쪽에서 이미 다루므로 중복해서 보이지 않는다.
		const componentList = selectedNode.getAllComponents();
		const generatedTypeSet = UIDocument.collectGeneratedComponentTypes(componentList);
		for (let componentIndex = 0; componentIndex < componentList.length; ++componentIndex) {
			const component = componentList[componentIndex];
			const componentTypeName = component.constructor.name;
			const schemaList = COMPONENT_EDITOR_SCHEMA[componentTypeName];
			if (!schemaList || generatedTypeSet.has(componentTypeName)) {
				continue;
			}

			offsetY += 8;
			this.addDividerLine(this.#inspectorNode, COLOR_BORDER_SOFT, 0, offsetY, this.#inspectorWidth, 1);
			const sectionNode = this.createPanel(COLOR_HEADER, "sectionHeader");
			sectionNode.setContentSize(Vector2.create(this.#inspectorWidth, 24));
			sectionNode.setLocalPosition(Vector2.create(0, offsetY + 1));
			this.#inspectorNode.addChild(sectionNode);

			const sectionLabelNode = this.createLabel(componentTypeName, 12, COLOR_SECTION);
			sectionLabelNode.setContentSize(Vector2.create(this.#inspectorWidth, 24));
			sectionLabelNode.setLocalPosition(Vector2.create(12, 0));
			sectionNode.addChild(sectionLabelNode);
			offsetY += 30;

			for (const schema of schemaList) {
				const rawValue = component[schema.getterName]();
				const displayText = this.composeFieldDisplayText(schema.kind, rawValue);
				offsetY = this.addInspectorField(offsetY, schema.label, displayText, {
					target: "component",
					componentIndex: componentIndex,
					propertyId: schema.propertyId,
					kind: schema.kind,
					getterName: schema.getterName,
					setterName: schema.setterName,
					step: schema.step,
				});
			}
		}

		const hintNode = this.createLabel("숫자는 드래그 · 글자/색은 클릭", 12, COLOR_TEXT_DIM);
		hintNode.setContentSize(Vector2.create(this.#inspectorWidth, 20));
		hintNode.setLocalPosition(Vector2.create(12, offsetY + 6));
		this.#inspectorNode.addChild(hintNode);
	}

	//==============================================================================
	// 속성 한 줄 추가. (레이블 + 값 칸)
	//==============================================================================
	/**
	 * @param { number } offsetY
	 * @param { string } labelText
	 * @param { string } valueText
	 * @param { object } fieldInfo
	 * @returns { number }
	 */
	addInspectorField(offsetY, labelText, valueText, fieldInfo) {
		const labelNode = this.createLabel(labelText, 13, COLOR_TEXT_DIM);
		labelNode.setContentSize(Vector2.create(72, 24));
		labelNode.setLocalPosition(Vector2.create(12, offsetY));
		this.#inspectorNode.addChild(labelNode);

		const fieldNode = this.createPanel(COLOR_FIELD, fieldInfo.propertyId, ROUND_FIELD);
		fieldNode.setContentSize(Vector2.create(this.#inspectorWidth - 108, 24));
		fieldNode.setLocalPosition(Vector2.create(88, offsetY));
		this.#inspectorNode.addChild(fieldNode);

		// 색상 칸은 값 미리보기를 함께 보여 준다.
		let textLeft = 8;
		if (fieldInfo.kind === "color") {
			const swatchNode = this.createPanel(this.readFieldColor(fieldInfo), "swatch", 3);
			swatchNode.setContentSize(Vector2.create(18, 18));
			swatchNode.setLocalPosition(Vector2.create(4, 3));
			fieldNode.addChild(swatchNode);
			textLeft = 28;
		}

		const valueNode = this.createLabel(valueText, 13, COLOR_TEXT);
		valueNode.setContentSize(Vector2.create(this.#inspectorWidth - 108 - textLeft, 24));
		valueNode.setLocalPosition(Vector2.create(textLeft, 0));
		fieldNode.addChild(valueNode);

		fieldInfo.node = fieldNode;
		fieldInfo.label = labelText;
		this.#inspectorFields.push(fieldInfo);
		return offsetY + 28;
	}

	//==============================================================================
	// 필드 표시 문자열 구성.
	//==============================================================================
	/**
	 * @param { string } kind
	 * @param { * } rawValue
	 * @returns { string }
	 */
	composeFieldDisplayText(kind, rawValue) {
		if (kind === "color") {
			return rawValue.toHEXString();
		}
		if (kind === "number") {
			const numberValue = System.Number(rawValue);
			const isInteger = System.Math.abs(numberValue - System.Math.round(numberValue)) < 0.0001;
			return isInteger ? String(System.Math.round(numberValue)) : numberValue.toFixed(2);
		}
		return String(rawValue);
	}

	//==============================================================================
	// 필드의 현재 색상 반환. (미리보기 스와치용)
	//==============================================================================
	/**
	 * @param { object } fieldInfo
	 * @returns { Color }
	 */
	readFieldColor(fieldInfo) {
		const component = this.findFieldComponent(fieldInfo);
		if (!component) {
			return Color.white();
		}
		const color = component[fieldInfo.getterName]();
		return color;
	}

	//==============================================================================
	// 필드가 가리키는 컴포넌트 반환.
	//==============================================================================
	/**
	 * @param { object } fieldInfo
	 * @returns { * }
	 */
	findFieldComponent(fieldInfo) {
		const selectedNode = this.getSelectedNode();
		if (!selectedNode || fieldInfo.target !== "component") {
			return null;
		}
		const componentList = selectedNode.getAllComponents();
		const component = componentList[fieldInfo.componentIndex];
		return component;
	}

	//==============================================================================
	// 선택 표시 갱신. (선택 노드 테두리 + 리사이즈 손잡이)
	//==============================================================================
	refreshSelectionOverlay() {
		this.#overlayNode.removeChildren();
		const selectedNode = this.getSelectedNode();
		if (!selectedNode || selectedNode === this.#documentRootNode) {
			return;
		}

		const canvasPosition = this.#canvasNode.getPosition();
		const worldBounds = selectedNode.getWorldBounds();
		const localX = worldBounds.left - canvasPosition.x;
		const localY = worldBounds.top - canvasPosition.y;
		const borderDefinitions = [
			[localX, localY, worldBounds.width, SELECTION_BORDER_THICKNESS],
			[localX, localY + worldBounds.height - SELECTION_BORDER_THICKNESS, worldBounds.width, SELECTION_BORDER_THICKNESS],
			[localX, localY, SELECTION_BORDER_THICKNESS, worldBounds.height],
			[localX + worldBounds.width - SELECTION_BORDER_THICKNESS, localY, SELECTION_BORDER_THICKNESS, worldBounds.height],
		];
		for (const definition of borderDefinitions) {
			const borderNode = this.createPanel(COLOR_SELECTION_OUTLINE, "selectionBorder");
			borderNode.setContentSize(Vector2.create(definition[2], definition[3]));
			borderNode.setLocalPosition(Vector2.create(definition[0], definition[1]));
			this.#overlayNode.addChild(borderNode);
		}

		for (const handleDefinition of RESIZE_HANDLE_DEFINITIONS) {
			const handleNode = this.createPanel(COLOR_SELECTION_OUTLINE, "resizeHandle", 2);
			handleNode.setContentSize(Vector2.create(RESIZE_HANDLE_SIZE, RESIZE_HANDLE_SIZE));
			handleNode.setLocalPosition(Vector2.create(
				localX + worldBounds.width * handleDefinition.ratioX - RESIZE_HANDLE_SIZE * 0.5,
				localY + worldBounds.height * handleDefinition.ratioY - RESIZE_HANDLE_SIZE * 0.5));
			this.#overlayNode.addChild(handleNode);
		}

		this.drawSnapGuides();
		this.addDimensionBadge(localX, localY, selectedNode);
	}

	//==============================================================================
	// 화면 크기 변경.
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } canvasNativeSize
	 */
	resize(canvasNativeSize) {
		super.resize(canvasNativeSize);
		this.layout();
	}

	//==============================================================================
	// 패널 배치. (화면 크기에 맞춰 4분할)
	//==============================================================================
	layout() {
		const engine = this.getEngine();
		if (!engine || !this.#toolbarNode) {
			return;
		}
		const viewManager = engine.getViewManager();
		const viewSize = viewManager.getViewSize();

		const headerHeight = MENUBAR_HEIGHT + TOOLBAR_HEIGHT;
		const bodyHeight = System.Math.max(80, viewSize.y - headerHeight - STATUSBAR_HEIGHT);

		this.#menuBarNode.setContentSize(Vector2.create(viewSize.x, MENUBAR_HEIGHT));
		this.#menuBarNode.setLocalPosition(Vector2.create(0, 0));

		this.#toolbarNode.setContentSize(Vector2.create(viewSize.x, TOOLBAR_HEIGHT));
		this.#toolbarNode.setLocalPosition(Vector2.create(0, MENUBAR_HEIGHT));

		this.#statusBarNode.setContentSize(Vector2.create(viewSize.x, STATUSBAR_HEIGHT));
		this.#statusBarNode.setLocalPosition(Vector2.create(0, viewSize.y - STATUSBAR_HEIGHT));

		const paletteHeight = System.Math.min(PALETTE_HEIGHT, System.Math.max(80, bodyHeight - 120));
		this.#paletteNode.setContentSize(Vector2.create(this.#hierarchyWidth, paletteHeight));
		this.#paletteNode.setLocalPosition(Vector2.create(0, headerHeight));

		this.#hierarchyNode.setContentSize(Vector2.create(this.#hierarchyWidth, bodyHeight - paletteHeight));
		this.#hierarchyNode.setLocalPosition(Vector2.create(0, headerHeight + paletteHeight));

		this.#inspectorNode.setContentSize(Vector2.create(this.#inspectorWidth, bodyHeight));
		this.#inspectorNode.setLocalPosition(Vector2.create(viewSize.x - this.#inspectorWidth, headerHeight));

		const canvasWidth = System.Math.max(120, viewSize.x - this.#hierarchyWidth - this.#inspectorWidth);
		this.#canvasNode.setContentSize(Vector2.create(canvasWidth, bodyHeight));
		this.#canvasNode.setLocalPosition(Vector2.create(this.#hierarchyWidth, headerHeight));
		this.#overlayNode.setContentSize(Vector2.create(canvasWidth, bodyHeight));

		this.#popupLayerNode.setContentSize(Vector2.create(viewSize.x, viewSize.y));
		this.#popupLayerNode.setLocalPosition(Vector2.create(0, 0));

		// 좌우 패널과 캔버스 사이를 잡을 수 있다는 표시. (스플리터 손잡이)
		this.#splitterHandleLeft.setContentSize(Vector2.create(1, bodyHeight));
		this.#splitterHandleLeft.setLocalPosition(Vector2.create(this.#hierarchyWidth, headerHeight));
		this.#splitterHandleRight.setContentSize(Vector2.create(1, bodyHeight));
		this.#splitterHandleRight.setLocalPosition(Vector2.create(viewSize.x - this.#inspectorWidth - 1, headerHeight));

		this.refreshSelectionOverlay();
	}

	//==============================================================================
	// 출력 전 처리. (뷰 좌표계 적용 — 이 과정이 없으면 고DPI 화면에서 배치가 어긋난다)
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic
	 */
	preDraw(graphic) {
		super.preDraw(graphic);

		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		const canvasNativeSize = viewManager.getCanvasNativeSize();

		viewManager.applyCanvasNativeRect(graphic);
		graphic.setFillColor("rgb(30, 30, 30)");
		graphic.drawRect(Rect.create(0, 0, canvasNativeSize.x, canvasNativeSize.y));

		viewManager.applyViewRect(graphic);
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @override
	 * @param { number } deltaTime
	 */
	tick(deltaTime) {
		super.tick(deltaTime);
		this.layout();
	}

	//==============================================================================
	// 터치 누름. (툴바 / 계층 / 속성 / 캔버스 순으로 판정)
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } viewInputPosition
	 */
	touchPress(viewInputPosition) {
		this.#dragStartInputPosition = Vector2.create(viewInputPosition.x, viewInputPosition.y);

		// 열려 있는 팝업이 먼저다.
		if (this.#popupItemEntries.length > 0) {
			for (const popupEntry of this.#popupItemEntries) {
				if (this.containsPoint(popupEntry.node, viewInputPosition)) {
					const commandId = popupEntry.id;
					this.closePopupMenu();
					this.#openMenuIndex = -1;
					this.buildMenuBar();
					this.executeToolbarCommand(commandId);
					return;
				}
			}
			this.closePopupMenu();
			this.#openMenuIndex = -1;
			this.buildMenuBar();
			return;
		}

		// 메뉴바 제목.
		for (const menuEntry of this.#menuTitleEntries) {
			if (this.containsPoint(menuEntry.node, viewInputPosition)) {
				this.#openMenuIndex = menuEntry.menuIndex;
				this.buildMenuBar();
				this.openPopupMenu(MENU_DEFINITIONS[menuEntry.menuIndex].items, menuEntry.offsetX, MENUBAR_HEIGHT);
				return;
			}
		}

		// 패널 경계. (좌우 폭 조절)
		const splitterKind = this.hitSplitter(viewInputPosition);
		if (splitterKind !== "none") {
			this.#dragMode = splitterKind;
			this.#splitStartWidth = splitterKind === "splitLeft" ? this.#hierarchyWidth : this.#inspectorWidth;
			return;
		}

		// 컴포넌트 영역.
		for (const paletteEntry of this.#paletteEntries) {
			if (this.containsPoint(paletteEntry.node, viewInputPosition)) {
				this.executeToolbarCommand(paletteEntry.id);
				return;
			}
		}

		// 툴바 버튼.
		for (const buttonEntry of this.#toolbarButtons) {
			if (this.containsPoint(buttonEntry.node, viewInputPosition)) {
				this.executeToolbarCommand(buttonEntry.id);
				return;
			}
		}

		// 계층 행.
		for (const rowEntry of this.#hierarchyRows) {
			if (this.containsPoint(rowEntry.rowNode, viewInputPosition)) {
				this.selectNode(rowEntry.node);
				return;
			}
		}

		// 속성 필드. (숫자 칸은 드래그로 조절, 글자와 색은 클릭 입력)
		for (const fieldEntry of this.#inspectorFields) {
			if (this.containsPoint(fieldEntry.node, viewInputPosition)) {
				if (fieldEntry.kind === "number") {
					this.#activeField = fieldEntry;
					this.#dragMode = "field";
					this.#isFieldDragged = false;
					this.#dragStartValue = Vector2.create(this.readFieldNumber(fieldEntry), 0);
				}
				else if (fieldEntry.kind === "text") {
					this.promptFieldText(fieldEntry);
				}
				else if (fieldEntry.kind === "color") {
					this.promptFieldColor(fieldEntry);
				}
				return;
			}
		}

		// 캔버스 영역.
		if (this.containsPoint(this.#canvasNode, viewInputPosition)) {
			const selectedNode = this.getSelectedNode();
			if (selectedNode && selectedNode !== this.#documentRootNode) {
				const handleDefinition = this.findResizeHandleAt(selectedNode, viewInputPosition);
				if (handleDefinition) {
					this.pushUndoSnapshot();
					this.#dragMode = "resize";
					this.#activeResizeHandle = handleDefinition;
					const contentSize = selectedNode.getContentSize();
					const localPosition = selectedNode.getLocalPosition();
					this.#resizeStartSize = Vector2.create(contentSize.x, contentSize.y);
					this.#resizeStartPosition = Vector2.create(localPosition.x, localPosition.y);
					return;
				}
			}
			const hitNode = this.findTopmostNodeAt(this.#documentRootNode, viewInputPosition);
			this.selectNode(hitNode);
			if (hitNode && hitNode !== this.#documentRootNode) {
				this.pushUndoSnapshot();
				this.#dragMode = "move";
				const localPosition = hitNode.getLocalPosition();
				this.#dragStartValue = Vector2.create(localPosition.x, localPosition.y);
			}
		}
	}

	//==============================================================================
	// 터치 이동. (노드 이동 / 크기 조절 / 속성 값 조절)
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } viewInputPosition
	 */
	touchMove(viewInputPosition) {
		const deltaX = viewInputPosition.x - this.#dragStartInputPosition.x;
		const deltaY = viewInputPosition.y - this.#dragStartInputPosition.y;
		const selectedNode = this.getSelectedNode();

		if (this.#dragMode === "splitLeft") {
			this.#hierarchyWidth = System.Math.max(PANEL_WIDTH_MIN, System.Math.min(PANEL_WIDTH_MAX, this.#splitStartWidth + deltaX));
			this.layout();
			this.buildPalette();
			this.rebuildHierarchy();
			this.rebuildInspector();
			return;
		}
		if (this.#dragMode === "splitRight") {
			this.#inspectorWidth = System.Math.max(PANEL_WIDTH_MIN, System.Math.min(PANEL_WIDTH_MAX, this.#splitStartWidth - deltaX));
			this.layout();
			this.rebuildHierarchy();
			this.rebuildInspector();
			return;
		}

		if (this.#dragMode === "move" && selectedNode) {
			const movedPosition = Vector2.create(this.#dragStartValue.x + deltaX, this.#dragStartValue.y + deltaY);
			const snappedPosition = this.applySnap(selectedNode, movedPosition);
			selectedNode.setLocalPosition(snappedPosition);
			this.refreshSelectionOverlay();
			this.rebuildInspector();
			this.refreshStatusBar();
		}
		else if (this.#dragMode === "resize" && selectedNode && this.#activeResizeHandle) {
			const handleDefinition = this.#activeResizeHandle;
			let nextWidth = this.#resizeStartSize.x + deltaX * handleDefinition.sizeX;
			let nextHeight = this.#resizeStartSize.y + deltaY * handleDefinition.sizeY;
			nextWidth = System.Math.max(8, nextWidth);
			nextHeight = System.Math.max(8, nextHeight);

			// 왼쪽/위쪽을 잡으면 크기가 변한 만큼 시작 위치도 함께 움직인다.
			let nextX = this.#resizeStartPosition.x;
			let nextY = this.#resizeStartPosition.y;
			if (handleDefinition.moveLeft) {
				nextX = this.#resizeStartPosition.x + (this.#resizeStartSize.x - nextWidth);
			}
			if (handleDefinition.moveTop) {
				nextY = this.#resizeStartPosition.y + (this.#resizeStartSize.y - nextHeight);
			}
			selectedNode.setLocalPosition(Vector2.create(nextX, nextY));
			selectedNode.setContentSize(Vector2.create(nextWidth, nextHeight));
			this.refreshSelectionOverlay();
			this.rebuildInspector();
		}
		else if (this.#dragMode === "field" && this.#activeField && selectedNode) {
			if (System.Math.abs(deltaX) > FIELD_DRAG_THRESHOLD) {
				this.#isFieldDragged = true;
			}
			if (this.#isFieldDragged) {
				const stepAmount = this.#activeField.step || 1;
				let nextValue = this.#dragStartValue.x + deltaX * stepAmount;
				if (stepAmount >= 1) {
					nextValue = System.Math.round(nextValue);
				}
				this.writeFieldNumber(this.#activeField, nextValue);
				this.refreshSelectionOverlay();
				this.rebuildInspector();
			}
		}
	}

	//==============================================================================
	// 터치 뗌.
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } viewInputPosition
	 */
	touchRelease(viewInputPosition) {
		if (this.#dragMode === "field" && this.#activeField && !this.#isFieldDragged) {
			this.promptFieldNumber(this.#activeField);
		}
		this.#snapGuideList = [];
		this.#activeResizeHandle = null;
		this.refreshSelectionOverlay();
		this.#dragMode = "none";
		this.#activeField = null;
		this.#isFieldDragged = false;
	}

	//==============================================================================
	// 숫자 속성 직접 입력. (값 칸을 끌지 않고 눌렀을 때)
	//==============================================================================
	/**
	 * @param { object } fieldInfo
	 */
	promptFieldNumber(fieldInfo) {
		const currentValue = this.readFieldNumber(fieldInfo);
		const inputText = System.prompt(fieldInfo.label || fieldInfo.propertyId, this.composeFieldDisplayText("number", currentValue));
		if (inputText === null) {
			return;
		}
		const parsedValue = System.Number(inputText);
		if (!System.Number.isFinite(parsedValue)) {
			return;
		}
		this.writeFieldNumber(fieldInfo, parsedValue);
		this.refreshSelectionOverlay();
		this.rebuildInspector();
	}

	//==============================================================================
	// 숫자 속성 읽기. (드래그 시작 기준값)
	//==============================================================================
	/**
	 * @param { object } fieldInfo
	 * @returns { number }
	 */
	readFieldNumber(fieldInfo) {
		const selectedNode = this.getSelectedNode();
		if (!selectedNode) {
			return 0;
		}
		if (fieldInfo.target === "component") {
			const component = this.findFieldComponent(fieldInfo);
			if (!component) {
				return 0;
			}
			const componentValue = component[fieldInfo.getterName]();
			return System.Number(componentValue);
		}
		const localPosition = selectedNode.getLocalPosition();
		const contentSize = selectedNode.getContentSize();
		if (fieldInfo.propertyId === "positionX") {
			return localPosition.x;
		}
		if (fieldInfo.propertyId === "positionY") {
			return localPosition.y;
		}
		if (fieldInfo.propertyId === "width") {
			return contentSize.x;
		}
		if (fieldInfo.propertyId === "height") {
			return contentSize.y;
		}
		return 0;
	}

	//==============================================================================
	// 숫자 속성 쓰기.
	//==============================================================================
	/**
	 * @param { object } fieldInfo
	 * @param { number } value
	 */
	writeFieldNumber(fieldInfo, value) {
		const selectedNode = this.getSelectedNode();
		if (!selectedNode) {
			return;
		}
		if (fieldInfo.target === "component") {
			const component = this.findFieldComponent(fieldInfo);
			if (component) {
				component[fieldInfo.setterName](System.Math.max(0, value));
			}
			return;
		}
		const localPosition = selectedNode.getLocalPosition();
		const contentSize = selectedNode.getContentSize();
		if (fieldInfo.propertyId === "positionX") {
			selectedNode.setLocalPosition(Vector2.create(value, localPosition.y));
		}
		else if (fieldInfo.propertyId === "positionY") {
			selectedNode.setLocalPosition(Vector2.create(localPosition.x, value));
		}
		else if (fieldInfo.propertyId === "width") {
			selectedNode.setContentSize(Vector2.create(System.Math.max(8, value), contentSize.y));
		}
		else if (fieldInfo.propertyId === "height") {
			selectedNode.setContentSize(Vector2.create(contentSize.x, System.Math.max(8, value)));
		}
	}

	//==============================================================================
	// 글자 속성 입력. (노드 이름 또는 컴포넌트 텍스트)
	//==============================================================================
	/**
	 * @param { object } fieldInfo
	 */
	promptFieldText(fieldInfo) {
		const selectedNode = this.getSelectedNode();
		if (!selectedNode) {
			return;
		}
		if (fieldInfo.target === "component") {
			const component = this.findFieldComponent(fieldInfo);
			if (!component) {
				return;
			}
			const currentText = component[fieldInfo.getterName]();
			const inputText = System.prompt(fieldInfo.propertyId, currentText);
			if (inputText !== null) {
				component[fieldInfo.setterName](inputText);
			}
		}
		else {
			const inputName = System.prompt("노드 이름", selectedNode.getName());
			if (inputName !== null) {
				selectedNode.setName(inputName);
			}
		}
		this.rebuildHierarchy();
		this.rebuildInspector();
	}

	//==============================================================================
	// 색상 속성 입력. (#RRGGBB 표기)
	//==============================================================================
	/**
	 * @param { object } fieldInfo
	 */
	promptFieldColor(fieldInfo) {
		const component = this.findFieldComponent(fieldInfo);
		if (!component) {
			return;
		}
		const currentColor = component[fieldInfo.getterName]();
		const inputText = System.prompt("색상 (#RRGGBB)", currentColor.toHEXString());
		if (inputText === null) {
			return;
		}
		const parsedColor = Color.createFromHEX(inputText);
		if (parsedColor) {
			parsedColor.alpha = currentColor.alpha;
			component[fieldInfo.setterName](parsedColor);
		}
		this.rebuildInspector();
	}

	//==============================================================================
	// 툴바 명령 실행.
	//==============================================================================
	/**
	 * @param { string } commandId
	 */
	executeToolbarCommand(commandId) {
		if (commandId === "undo") {
			this.undoDocument();
		}
		else if (commandId === "redo") {
			this.redoDocument();
		}
		else if (commandId === "duplicate") {
			this.duplicateSelectedNode();
		}
		else if (commandId === "newDocument") {
			this.createNewDocument();
		}
		else if (commandId === "bringToFront") {
			this.reorderSelectedNode(true);
		}
		else if (commandId === "sendToBack") {
			this.reorderSelectedNode(false);
		}
		else if (commandId === "addNode") {
			this.addWidgetNode("panel");
		}
		else if (commandId === "addText") {
			this.addWidgetNode("text");
		}
		else if (commandId === "addButton") {
			this.addWidgetNode("button");
		}
		else if (commandId === "addScrollView") {
			this.addWidgetNode("scrollView");
		}
		else if (commandId === "addProgress") {
			this.addWidgetNode("progress");
		}
		else if (commandId === "addSlider") {
			this.addWidgetNode("slider");
		}
		else if (commandId === "deleteNode") {
			this.deleteSelectedNode();
		}
		else if (commandId === "save") {
			this.saveDocument();
		}
		else if (commandId === "load") {
			this.loadDocument();
		}
	}

	//==============================================================================
	// 위젯 노드 추가. (선택 노드의 자식으로 — 없으면 문서 루트에)
	// - 게임에서 실제로 쓰이는 UI 조각을 바로 얹을 수 있게 종류별 기본값을 갖춘다.
	//==============================================================================
	/**
	 * @param { string } widgetKind
	 */
	addWidgetNode(widgetKind) {
		this.#nodeSerialNumber += 1;
		const newNode = new WorldNode();
		newNode.setPivot(Pivot.topLeft.clone());
		newNode.setAnchor(Pivot.topLeft.clone());
		newNode.setLocalPosition(Vector2.create(40, 40));

		if (widgetKind === "text") {
			newNode.setName("Text" + this.#nodeSerialNumber);
			newNode.setContentSize(Vector2.create(200, 40));
			const label = newNode.addComponent(UILabel);
			label.setText("텍스트");
			label.setFontSize(20);
			label.setTextColor(COLOR_TEXT);
		}
		else if (widgetKind === "button") {
			newNode.setName("Button" + this.#nodeSerialNumber);
			newNode.setContentSize(Vector2.create(180, 56));
			newNode.setInteractable(true);
			const paint = newNode.addComponent(Paint);
			paint.setColor(new Color(0.055, 0.388, 0.612, 1));
			paint.setRoundSize(10);
			newNode.addComponent(UIButton);
			const label = newNode.addComponent(UILabel);
			label.setText("버튼");
			label.setFontSize(20);
			label.setTextColor(COLOR_TEXT);
		}
		else if (widgetKind === "scrollView") {
			newNode.setName("ScrollView" + this.#nodeSerialNumber);
			newNode.setContentSize(Vector2.create(320, 240));
			newNode.setInteractable(true);
			const paint = newNode.addComponent(Paint);
			paint.setColor(new Color(0.176, 0.176, 0.188, 1));
			paint.setRoundSize(8);
			const scrollView = newNode.addComponent(UIScrollView);
			scrollView.setScrollContentSize(Vector2.create(320, 720));
		}
		else if (widgetKind === "progress") {
			newNode.setName("Progress" + this.#nodeSerialNumber);
			newNode.setContentSize(Vector2.create(260, 24));
			const progressView = newNode.addComponent(UIProgressView);
			progressView.setRange(0, 1);
			progressView.setValue(0.6);
		}
		else if (widgetKind === "slider") {
			newNode.setName("Slider" + this.#nodeSerialNumber);
			newNode.setContentSize(Vector2.create(260, 32));
			newNode.setInteractable(true);
			newNode.addComponent(UISlider);
		}
		else {
			newNode.setName("Panel" + this.#nodeSerialNumber);
			newNode.setContentSize(Vector2.create(NEW_NODE_SIZE, NEW_NODE_SIZE * 0.6));
			const paint = newNode.addComponent(Paint);
			paint.setColor(new Color(0.290, 0.290, 0.298, 1));
			paint.setRoundSize(8);
		}

		const parentNode = this.getSelectedNode() || this.#documentRootNode;
		parentNode.addChild(newNode);
		this.selectNode(newNode);
		this.rebuildHierarchy();
	}

	//==============================================================================
	// 선택 노드 삭제.
	//==============================================================================
	deleteSelectedNode() {
		const selectedNode = this.getSelectedNode();
		if (!selectedNode || selectedNode === this.#documentRootNode) {
			return;
		}
		const parentNode = selectedNode.getParent();
		if (parentNode) {
			parentNode.removeChild(selectedNode);
		}
		this.selectNode(null);
		this.rebuildHierarchy();
	}

	//==============================================================================
	// 새 문서. (편집 중인 내용을 비운다)
	//==============================================================================
	createNewDocument() {
		this.pushUndoSnapshot();
		const emptyRootNode = new WorldNode();
		emptyRootNode.setName("Root");
		emptyRootNode.setPivot(Pivot.topLeft.clone());
		emptyRootNode.setAnchor(Pivot.topLeft.clone());
		emptyRootNode.setContentSize(Vector2.create(720, 480));
		const backgroundPaint = emptyRootNode.addComponent(Paint);
		backgroundPaint.setColor(new Color(0.208, 0.208, 0.216, 1));

		const canvasNode = this.#canvasNode;
		canvasNode.removeChild(this.#documentRootNode);
		this.#documentRootNode = emptyRootNode;
		canvasNode.addChild(this.#documentRootNode);
		canvasNode.removeChild(this.#overlayNode);
		canvasNode.addChild(this.#overlayNode);
		this.selectNode(null);
		this.rebuildHierarchy();
	}

	//==============================================================================
	// 그리는 순서 변경. (맨 앞 / 맨 뒤)
	//==============================================================================
	/**
	 * @param { boolean } isBringToFront
	 */
	reorderSelectedNode(isBringToFront) {
		const selectedNode = this.getSelectedNode();
		if (!selectedNode || selectedNode === this.#documentRootNode) {
			return;
		}
		const parentNode = selectedNode.getParent();
		if (!parentNode) {
			return;
		}
		this.pushUndoSnapshot();
		parentNode.removeChild(selectedNode);
		if (isBringToFront) {
			parentNode.addChild(selectedNode);
		}
		else {
			const siblingNodeList = parentNode.getChildren().slice();
			parentNode.removeChildren();
			parentNode.addChild(selectedNode);
			for (const siblingNode of siblingNodeList) {
				parentNode.addChild(siblingNode);
			}
		}
		this.rebuildHierarchy();
		this.refreshSelectionOverlay();
	}

	//==============================================================================
	// 문서 저장. (JSON 다운로드 — 서버 없이 동작)
	//==============================================================================
	/**
	 * @returns { string }
	 */
	saveDocument() {
		const jsonText = UIDocument.toJsonText(this.#documentRootNode);
		const blob = new System.Blob([jsonText], { type: "application/json" });
		const objectUrl = System.URL.createObjectURL(blob);
		const anchorElement = System.document.createElement("a");
		anchorElement.href = objectUrl;
		anchorElement.download = "ui.json";
		System.document.body.appendChild(anchorElement);
		anchorElement.click();
		System.document.body.removeChild(anchorElement);
		System.URL.revokeObjectURL(objectUrl);
		return jsonText;
	}

	//==============================================================================
	// 문서 불러오기. (파일 선택 — 서버 없이 동작)
	//==============================================================================
	loadDocument() {
		const inputElement = System.document.createElement("input");
		inputElement.type = "file";
		inputElement.accept = ".json,application/json";
		inputElement.addEventListener("change", () => {
			const selectedFile = inputElement.files[0];
			if (!selectedFile) {
				return;
			}
			const fileReader = new System.FileReader();
			fileReader.onload = () => {
				const loadedRootNode = UIDocument.fromJsonText(fileReader.result);
				const canvasNode = this.#canvasNode;
				canvasNode.removeChild(this.#documentRootNode);
				this.#documentRootNode = loadedRootNode;
				this.#documentRootNode.setPivot(Pivot.topLeft.clone());
				this.#documentRootNode.setAnchor(Pivot.topLeft.clone());
				canvasNode.addChild(this.#documentRootNode);
				canvasNode.removeChild(this.#overlayNode);
				canvasNode.addChild(this.#overlayNode);
				this.selectNode(null);
				this.rebuildHierarchy();
			};
			fileReader.readAsText(selectedFile);
		});
		inputElement.click();
	}

	//==============================================================================
	// 노드 선택.
	//==============================================================================
	/**
	 * @param { WorldNode | null } node
	 */
	selectNode(node) {
		this.#selectedNode = node;
		this.rebuildHierarchy();
		this.rebuildInspector();
		this.refreshSelectionOverlay();
		this.refreshStatusBar();
	}

	//==============================================================================
	// 패널 경계 판정. (좌우 스플리터 잡기)
	//==============================================================================
	/**
	 * @param { Vector2 } viewPosition
	 * @returns { string }
	 */
	hitSplitter(viewPosition) {
		const engine = this.getEngine();
		if (!engine || viewPosition.y < MENUBAR_HEIGHT + TOOLBAR_HEIGHT) {
			return "none";
		}
		const viewManager = engine.getViewManager();
		const viewSize = viewManager.getViewSize();
		const leftSplitterX = this.#hierarchyWidth;
		const rightSplitterX = viewSize.x - this.#inspectorWidth;
		if (System.Math.abs(viewPosition.x - leftSplitterX) <= SPLITTER_GRAB_WIDTH) {
			return "splitLeft";
		}
		if (System.Math.abs(viewPosition.x - rightSplitterX) <= SPLITTER_GRAB_WIDTH) {
			return "splitRight";
		}
		return "none";
	}

	//==============================================================================
	// 스냅 적용. (형제 노드의 모서리·중심선에 달라붙는다)
	// - 붙은 축은 안내선으로 표시해 어디에 맞았는지 보이게 한다.
	//==============================================================================
	/**
	 * @param { WorldNode } targetNode
	 * @param { Vector2 } desiredPosition
	 * @returns { Vector2 }
	 */
	applySnap(targetNode, desiredPosition) {
		this.#snapGuideList = [];
		const parentNode = targetNode.getParent();
		if (!parentNode) {
			return desiredPosition;
		}
		const targetSize = targetNode.getContentSize();

		// 비교 대상: 같은 부모의 다른 자식 + 부모 자신의 영역.
		const candidateVerticalList = [];
		const candidateHorizontalList = [];
		const parentSize = parentNode.getContentSize();
		candidateVerticalList.push(0, parentSize.x * 0.5, parentSize.x);
		candidateHorizontalList.push(0, parentSize.y * 0.5, parentSize.y);
		const siblingNodeList = parentNode.getChildren();
		for (const siblingNode of siblingNodeList) {
			if (siblingNode === targetNode || siblingNode === this.#overlayNode) {
				continue;
			}
			const siblingPosition = siblingNode.getLocalPosition();
			const siblingSize = siblingNode.getContentSize();
			candidateVerticalList.push(siblingPosition.x, siblingPosition.x + siblingSize.x * 0.5, siblingPosition.x + siblingSize.x);
			candidateHorizontalList.push(siblingPosition.y, siblingPosition.y + siblingSize.y * 0.5, siblingPosition.y + siblingSize.y);
		}

		// 대상의 왼쪽/가운데/오른쪽 세 지점을 각각 후보에 맞춰 본다.
		const snappedX = this.findSnappedValue(desiredPosition.x, targetSize.x, candidateVerticalList, "vertical");
		const snappedY = this.findSnappedValue(desiredPosition.y, targetSize.y, candidateHorizontalList, "horizontal");
		return Vector2.create(snappedX, snappedY);
	}

	//==============================================================================
	// 한 축의 스냅 값 계산.
	//==============================================================================
	/**
	 * @param { number } originValue
	 * @param { number } sizeValue
	 * @param { number[] } candidateList
	 * @param { string } axisName
	 * @returns { number }
	 */
	findSnappedValue(originValue, sizeValue, candidateList, axisName) {
		const edgeOffsets = [0, sizeValue * 0.5, sizeValue];
		let bestDistance = SNAP_DISTANCE;
		let bestValue = originValue;
		let bestGuideLine = -1;
		for (const edgeOffset of edgeOffsets) {
			const edgeValue = originValue + edgeOffset;
			for (const candidateValue of candidateList) {
				const distance = System.Math.abs(edgeValue - candidateValue);
				if (distance < bestDistance) {
					bestDistance = distance;
					bestValue = candidateValue - edgeOffset;
					bestGuideLine = candidateValue;
				}
			}
		}
		if (bestGuideLine >= 0) {
			this.#snapGuideList.push({ axis: axisName, value: bestGuideLine });
		}
		return bestValue;
	}

	//==============================================================================
	// 치수 배지 추가. (드래그 중 위치와 크기를 눈으로 확인)
	//==============================================================================
	/**
	 * @param { number } localX
	 * @param { number } localY
	 * @param { WorldNode } targetNode
	 */
	addDimensionBadge(localX, localY, targetNode) {
		const localPosition = targetNode.getLocalPosition();
		const contentSize = targetNode.getContentSize();
		const badgeText = System.Math.round(localPosition.x) + ", " + System.Math.round(localPosition.y)
			+ "   " + System.Math.round(contentSize.x) + " x " + System.Math.round(contentSize.y);
		const badgeWidth = badgeText.length * 7.6 + 16;

		const badgeNode = this.createPanel(new Color(0.118, 0.118, 0.118, 0.95), "dimensionBadge", 4);
		badgeNode.setContentSize(Vector2.create(badgeWidth, 22));
		badgeNode.setLocalPosition(Vector2.create(localX, System.Math.max(0, localY - 26)));
		this.#overlayNode.addChild(badgeNode);

		const badgeLabel = this.createLabel(badgeText, 12, COLOR_SELECTION_OUTLINE);
		badgeLabel.setContentSize(Vector2.create(badgeWidth, 22));
		badgeLabel.setLocalPosition(Vector2.create(8, 0));
		badgeNode.addChild(badgeLabel);
	}

	//==============================================================================
	// 스냅 안내선 그리기.
	//==============================================================================
	drawSnapGuides() {
		const documentPosition = this.#documentRootNode.getLocalPosition();
		const documentSize = this.#documentRootNode.getContentSize();
		for (const snapGuide of this.#snapGuideList) {
			const guideNode = this.createPanel(new Color(0.863, 0.714, 0.478, 0.9), "snapGuide");
			if (snapGuide.axis === "vertical") {
				guideNode.setContentSize(Vector2.create(1, documentSize.y));
				guideNode.setLocalPosition(Vector2.create(documentPosition.x + snapGuide.value, documentPosition.y));
			}
			else {
				guideNode.setContentSize(Vector2.create(documentSize.x, 1));
				guideNode.setLocalPosition(Vector2.create(documentPosition.x, documentPosition.y + snapGuide.value));
			}
			this.#overlayNode.addChild(guideNode);
		}
	}

	//==============================================================================
	// 화면 좌표가 노드 영역 안인지 판정.
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @param { Vector2 } viewPosition
	 * @returns { boolean }
	 */
	containsPoint(node, viewPosition) {
		const worldBounds = node.getWorldBounds();
		const isInside = viewPosition.x >= worldBounds.left && viewPosition.x <= worldBounds.left + worldBounds.width
			&& viewPosition.y >= worldBounds.top && viewPosition.y <= worldBounds.top + worldBounds.height;
		return isInside;
	}

	//==============================================================================
	// 리사이즈 손잡이 위인지 판정.
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @param { Vector2 } viewPosition
	 * @returns { boolean }
	 */
	findResizeHandleAt(node, viewPosition) {
		const worldBounds = node.getWorldBounds();
		for (const handleDefinition of RESIZE_HANDLE_DEFINITIONS) {
			const handleCenterX = worldBounds.left + worldBounds.width * handleDefinition.ratioX;
			const handleCenterY = worldBounds.top + worldBounds.height * handleDefinition.ratioY;
			const isInside = System.Math.abs(viewPosition.x - handleCenterX) <= RESIZE_HANDLE_SIZE
				&& System.Math.abs(viewPosition.y - handleCenterY) <= RESIZE_HANDLE_SIZE;
			if (isInside) {
				return handleDefinition;
			}
		}
		return null;
	}

	//==============================================================================
	// 최상위 히트 노드 탐색. (자식 우선 — 나중에 그려진 것이 위)
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @param { Vector2 } viewPosition
	 * @returns { WorldNode | null }
	 */
	findTopmostNodeAt(node, viewPosition) {
		const childNodeList = node.getChildren();
		for (let childIndex = childNodeList.length - 1; childIndex >= 0; --childIndex) {
			const hitNode = this.findTopmostNodeAt(childNodeList[childIndex], viewPosition);
			if (hitNode) {
				return hitNode;
			}
		}
		if (this.containsPoint(node, viewPosition)) {
			return node;
		}
		return null;
	}

	//==============================================================================
	// 선택 노드 반환.
	//==============================================================================
	/**
	 * @returns { WorldNode | null }
	 */
	getSelectedNode() {
		return this.#selectedNode;
	}

	//==============================================================================
	// 문서 루트 노드 반환.
	//==============================================================================
	/**
	 * @returns { WorldNode }
	 */
	getDocumentRootNode() {
		return this.#documentRootNode;
	}
}


//==============================================================================
// 편집기 실행.
//==============================================================================
const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 800);
engineConfiguration.canvasId = "editorCanvas";
engineConfiguration.autoResizeOnWindowResize = true;
const engine = new Engine(engineConfiguration);
System.document.title = "vanilla.js - UI Editor";
const editorScene = new UIEditorScene();
engine.run(editorScene);
