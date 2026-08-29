//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import * as Engine from "../../import.js";
import { Component } from "../../src/core/component.js";
import { Pane, PaneStyle, PaneTheme } from "../../src/web/pane.js";
import { Graphic } from "../../src/core/graphic.js";
import { WorldNode } from "../../src/core/node/worldnode.js";
import { Vector2 } from "../../src/base/vector2.js";
import { Color } from "../../src/base/color.js";
import { Pivot } from "../../src/base/pivot.js";
import { Rect } from "../../src/base/rect.js";
import { Paint } from "../../src/core/component/paint.js";
import { UIDocument } from "../../src/ui/uidocument.js";
import { UIView } from "../../src/ui/uiview.js";
import { UILabel } from "../../src/ui/uilabel.js";
import { UIButton } from "../../src/ui/uibutton.js";
import { UIProgressView } from "../../src/ui/uiprogressview.js";
import { UISlider } from "../../src/ui/uislider.js";
import { UIScrollView } from "../../src/ui/uiscrollview.js";
import { UISnapScrollView } from "../../src/ui/uisnapscrollview.js";
import { UIScrollBar } from "../../src/ui/uiscrollbar.js";
import { UIInputField } from "../../src/ui/uiinputfield.js";
import { UIImageView } from "../../src/ui/uiimageview.js";
import { UIToggleButton } from "../../src/ui/uitogglebutton.js";
import { RichText } from "../../src/core/component/richtext.js";
import { Mask } from "../../src/core/component/mask.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 편집 화면에 놓을 수 있는 요소 목록.
// 목록에 쓰는 그림 아이콘. (14x14 기준, 색은 글자색을 따른다)
const ICON_SHAPES = {
	empty: "<rect x='2.5' y='3.5' width='9' height='7' rx='1' fill='none' stroke='currentColor' stroke-dasharray='2 1.6'/>",
	panel: "<rect x='2' y='3' width='10' height='8' rx='1.5' fill='currentColor' opacity='0.75'/>",
	divider: "<rect x='2' y='6.5' width='10' height='1.4' rx='0.7' fill='currentColor'/>",
	text: "<path d='M3 4h8M7 4v6' stroke='currentColor' stroke-width='1.4' stroke-linecap='round' fill='none'/>",
	richText: "<path d='M2.5 4h6M5.5 4v6' stroke='currentColor' stroke-width='1.3' stroke-linecap='round' fill='none'/>"
		+ "<circle cx='10.5' cy='9' r='1.8' fill='currentColor'/>",
	image: "<rect x='2' y='3' width='10' height='8' rx='1.2' fill='none' stroke='currentColor' stroke-width='1.2'/>"
		+ "<path d='M3.4 9.6l2.4-2.6 1.8 1.9 1.5-1.4 1.5 2.1z' fill='currentColor'/>"
		+ "<circle cx='5' cy='5.4' r='0.9' fill='currentColor'/>",
	button: "<rect x='1.8' y='4' width='10.4' height='6' rx='2' fill='currentColor' opacity='0.75'/>"
		+ "<rect x='4' y='6.4' width='6' height='1.2' rx='0.6' fill='#ffffff' opacity='0.85'/>",
	toggleButton: "<rect x='2' y='3.5' width='9' height='7' rx='1.4' fill='none' stroke='currentColor' stroke-width='1.2'/>"
		+ "<path d='M4.2 7.2l1.8 1.8 3.4-3.8' stroke='currentColor' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/>",
	inputField: "<rect x='1.8' y='4' width='10.4' height='6' rx='1.2' fill='none' stroke='currentColor' stroke-width='1.2'/>"
		+ "<path d='M4.4 5.6v2.8' stroke='currentColor' stroke-width='1.2' stroke-linecap='round'/>",
	progress: "<rect x='1.8' y='5.6' width='10.4' height='2.8' rx='1.4' fill='none' stroke='currentColor' stroke-width='1.1'/>"
		+ "<rect x='2.8' y='6.4' width='4.4' height='1.2' rx='0.6' fill='currentColor'/>",
	slider: "<path d='M2 7h10' stroke='currentColor' stroke-width='1.2' stroke-linecap='round'/>"
		+ "<circle cx='8.4' cy='7' r='2.4' fill='currentColor'/>",
	scrollView: "<rect x='2' y='3' width='10' height='8' rx='1.2' fill='none' stroke='currentColor' stroke-width='1.2'/>"
		+ "<rect x='9.4' y='4.2' width='1.4' height='3.4' rx='0.7' fill='currentColor'/>",
	snapScrollView: "<rect x='1.4' y='4' width='3.6' height='6' rx='1' fill='currentColor' opacity='0.45'/>"
		+ "<rect x='5.6' y='3.2' width='4.4' height='7.6' rx='1' fill='currentColor'/>"
		+ "<rect x='10.6' y='4' width='2.4' height='6' rx='1' fill='currentColor' opacity='0.45'/>",
	scrollBar: "<rect x='5.4' y='1.8' width='3.2' height='10.4' rx='1.6' fill='none' stroke='currentColor' stroke-width='1.1'/>"
		+ "<rect x='6.2' y='3.4' width='1.6' height='4' rx='0.8' fill='currentColor'/>",
	editMode: "<path d='M2.5 11.5l1-2.6 5.4-5.4a1.2 1.2 0 0 1 1.7 0l0.9 0.9a1.2 1.2 0 0 1 0 1.7l-5.4 5.4z'"
		+ " fill='currentColor'/>",
	renderMode: "<path d='M4.4 2.8l7 4.2-7 4.2z' fill='currentColor'/>",
	mask: "<rect x='1.8' y='3.4' width='7' height='7' rx='1.2' fill='none' stroke='currentColor' stroke-width='1.2'/>"
		+ "<path d='M5.2 3.4h6a1.2 1.2 0 0 1 1.2 1.2v6a1.2 1.2 0 0 1-1.2 1.2h-6z' fill='currentColor' opacity='0.8'/>",
};

// 편집 화면에 놓을 수 있는 요소 목록.
const PALETTE_DEFINITIONS = [
	{ id: "empty", label: "Empty Node" },
	{ id: "panel", label: "Panel" },
	{ id: "divider", label: "Divider" },
	{ id: "text", label: "Label" },
	{ id: "richText", label: "RichText" },
	{ id: "image", label: "Image" },
	{ id: "button", label: "Button" },
	{ id: "toggleButton", label: "ToggleButton" },
	{ id: "inputField", label: "InputField" },
	{ id: "progress", label: "ProgressBar" },
	{ id: "slider", label: "Slider" },
	{ id: "scrollView", label: "ScrollView" },
	{ id: "snapScrollView", label: "SnapScrollView" },
	{ id: "scrollBar", label: "ScrollBar" },
	{ id: "mask", label: "Mask" },
];

// 컴포넌트별 편집 가능 속성.
const COMPONENT_EDITOR_SCHEMA = {
	Paint: [
		{ propertyId: "color", label: "Color", kind: "color", getterName: "getColor", setterName: "setColor" },
		{ propertyId: "roundSize", label: "Round", kind: "number", getterName: "getRoundSize", setterName: "setRoundSize" },
	],
	Sprite: [
		{ propertyId: "color", label: "Color", kind: "color", getterName: "getColor", setterName: "setColor" },
		{ propertyId: "roundSize", label: "Round", kind: "number", getterName: "getRoundSize", setterName: "setRoundSize" },
	],
	UILabel: [
		{ propertyId: "text", label: "Text", kind: "text", getterName: "getText", setterName: "setText" },
		{ propertyId: "fontSize", label: "Font Size", kind: "number", getterName: "getFontSize", setterName: "setFontSize" },
		{ propertyId: "textColor", label: "Text Color", kind: "color", getterName: "getTextColor", setterName: "setTextColor" },
	],
	UIButton: [
		{ propertyId: "hoverTintColor", label: "Hover Tint", kind: "color", getterName: "getHoverTintColor", setterName: "setHoverTintColor" },
		{ propertyId: "pressedTintColor", label: "Press Tint", kind: "color", getterName: "getPressedTintColor", setterName: "setPressedTintColor" },
	],
	UIProgressView: [
		{ propertyId: "value", label: "Value", kind: "number", getterName: "getValue", setterName: "setValue", step: 0.01 },
	],
	UISlider: [
		{ propertyId: "value", label: "Value", kind: "number", getterName: "getValue", setterName: "setValue", step: 0.01 },
	],
	UIScrollView: [
		{ propertyId: "dragSensitivity", label: "Drag Sens.", kind: "number", getterName: "getDragSensitivity", setterName: "setDragSensitivity", step: 0.1 },
	],
};

// 계층에 보여 줄 종류별 기호.
// 노드에 붙은 것으로 팔레트 종류를 되짚는 차례. (먼저 걸리는 것을 쓴다)
const NODE_KIND_LOOKUP = [
	{ typeName: "UIInputField", paletteId: "inputField" },
	{ typeName: "UIScrollBar", paletteId: "scrollBar" },
	{ typeName: "UISnapScrollView", paletteId: "snapScrollView" },
	{ typeName: "UIScrollView", paletteId: "scrollView" },
	{ typeName: "UISlider", paletteId: "slider" },
	{ typeName: "UIProgressView", paletteId: "progress" },
	{ typeName: "UIToggleButton", paletteId: "toggleButton" },
	{ typeName: "UIButton", paletteId: "button" },
	{ typeName: "UIImageView", paletteId: "image" },
	{ typeName: "Sprite", paletteId: "image" },
	{ typeName: "UILabel", paletteId: "text" },
	{ typeName: "RichText", paletteId: "richText" },
	{ typeName: "Text", paletteId: "text" },
	{ typeName: "Mask", paletteId: "mask" },
	{ typeName: "Paint", paletteId: "panel" },
];

// 편집 화면 표시 색.
// 편집기 글꼴. 애플 계열을 앞에 두고 없는 환경은 뒤로 물린다.
const EDITOR_FONT_FAMILY = "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"SF Pro Display\","
	+ " \"Helvetica Neue\", Pretendard, \"Apple SD Gothic Neo\", \"Segoe UI Variable Text\", \"Segoe UI\","
	+ " \"Malgun Gothic\", sans-serif";

const LIGHT_VANILLA_COLOR = "#f3e5ab";
const DARK_VANILLA_COLOR = "#d1bea8";
const CREAM_COLOR = "#fcf5d8";
const DEEP_GOLD_COLOR = "#d4be6b";
const DEEP_BROWN_COLOR = "#3b3524";

const SELECTION_COLOR = "#8b6914";
const SNAP_GUIDE_COLOR = "rgba(139, 105, 20, 0.9)";
const HOVER_COLOR = "#dccbb4";
const MENU_HOVER_COLOR = "#e6d8bf";
const SELECTED_ROW_TEXT_COLOR = DEEP_BROWN_COLOR;
const CANVAS_BACKGROUND_COLOR = "#b8a58a";
const PREVIEW_LETTERBOX_COLOR = "#8a7a63";
const DOCUMENT_BACKGROUND_COLOR = "#fcf5d8";
const PIVOT_COLOR = "#0091b8";
const PIVOT_SHADOW_COLOR = "#f7f0da";
const PIVOT_MARK_SIZE = 9;
const ANCHOR_COLOR = "#1f8f24";
const ANCHOR_MARK_SIZE = 6;
const GRID_MINOR_COLOR = "rgba(90, 74, 34, 0.12)";
const GRID_MAJOR_COLOR = "rgba(90, 74, 34, 0.26)";

// 편집기 색 테마. 바탕 표면을 Dark Vanilla 로 깔고 Vanilla 를 강조에 쓴다.
//   Light Vanilla #F3E5AB (강조) / Dark Vanilla #D1BEA8 (바탕) / 크림 #FCF5D8 / 짙은 금색 #D4BE6B
const VANILLA_THEME_COLORS = {
	background: "#c4b096",
	panel: DARK_VANILLA_COLOR,
	toolbar: "#c9b599",
	border: "#a89579",
	text: DEEP_BROWN_COLOR,
	textDim: "#6f6349",
	accent: LIGHT_VANILLA_COLOR,
	accentHover: CREAM_COLOR,
	inputBg: "#ece0c8",
	resizer: "#b9a689",
	resizerHover: "#8b6914",
};

// 크기 조절 손잡이 8방향.
const RESIZE_HANDLE_DEFINITIONS = [
	{ id: "topLeft", ratioX: 0, ratioY: 0, moveLeft: true, moveTop: true, sizeX: -1, sizeY: -1, cursor: "nwse-resize" },
	{ id: "top", ratioX: 0.5, ratioY: 0, moveLeft: false, moveTop: true, sizeX: 0, sizeY: -1, cursor: "ns-resize" },
	{ id: "topRight", ratioX: 1, ratioY: 0, moveLeft: false, moveTop: true, sizeX: 1, sizeY: -1, cursor: "nesw-resize" },
	{ id: "left", ratioX: 0, ratioY: 0.5, moveLeft: true, moveTop: false, sizeX: -1, sizeY: 0, cursor: "ew-resize" },
	{ id: "right", ratioX: 1, ratioY: 0.5, moveLeft: false, moveTop: false, sizeX: 1, sizeY: 0, cursor: "ew-resize" },
	{ id: "bottomLeft", ratioX: 0, ratioY: 1, moveLeft: true, moveTop: false, sizeX: -1, sizeY: 1, cursor: "nesw-resize" },
	{ id: "bottom", ratioX: 0.5, ratioY: 1, moveLeft: false, moveTop: false, sizeX: 0, sizeY: 1, cursor: "ns-resize" },
	{ id: "bottomRight", ratioX: 1, ratioY: 1, moveLeft: false, moveTop: false, sizeX: 1, sizeY: 1, cursor: "nwse-resize" },
];

const HANDLE_SIZE = 8;
const SNAP_DISTANCE = 6;
const UNDO_LIMIT = 64;
const DEFAULT_DOCUMENT_WIDTH = 960;
const DEFAULT_DOCUMENT_HEIGHT = 640;
const GRID_SIZE = 20;
const GRID_MINIMUM_SCREEN_STEP = 8;
const ZOOM_MINIMUM = 0.1;
const ZOOM_MAXIMUM = 8;
const ZOOM_STEP = 1.1;
// 메뉴 막대 구성. (일반 데스크톱 응용 프로그램과 같은 배치)
const MENU_DEFINITIONS = [
	{
		title: "File",
		items: [
			{ id: "newDocument", label: "New", shortcut: "Ctrl+N" },
			{ id: "load", label: "Open...", shortcut: "Ctrl+O" },
			{ id: "save", label: "Save", shortcut: "Ctrl+S" },
			{ id: "saveAs", label: "Save As...", shortcut: "Ctrl+Shift+S" },
		],
	},
	{
		title: "Edit",
		items: [
			{ id: "undo", label: "Undo", shortcut: "Ctrl+Z" },
			{ id: "redo", label: "Redo", shortcut: "Ctrl+Shift+Z" },
			{ separator: true },
			{ id: "duplicate", label: "Duplicate", shortcut: "Ctrl+D" },
			{ id: "deleteNode", label: "Delete", shortcut: "Delete" },
			{ separator: true },
			{ id: "bringToFront", label: "Bring to Front" },
			{ id: "sendToBack", label: "Send to Back" },
		],
	},
	{
		title: "View",
		items: [
			{ id: "showEditView", label: "Edit View", shortcut: "Ctrl+1" },
			{ id: "showRenderView", label: "Render View", shortcut: "Ctrl+2" },
			{ separator: true },
			{ id: "zoomIn", label: "Zoom In", shortcut: "Ctrl+=" },
			{ id: "zoomOut", label: "Zoom Out", shortcut: "Ctrl+-" },
			{ id: "zoomToFit", label: "Zoom to Fit", shortcut: "Ctrl+0" },
			{ id: "zoomActualSize", label: "Actual Size", shortcut: "Ctrl+9" },
			{ separator: true },
			{ id: "toggleGrid", label: "Show Grid", shortcut: "Ctrl+G" },
		],
	},
];


// 속성 목록에서 빼는 이름. (다른 객체를 가리키거나 편집 대상이 아닌 것)
const PROPERTY_EXCLUDE_NAMES = new System.Set([
	"Parent", "Node", "Owner", "Scene", "Content", "Children", "AllComponents", "Name",
	"Component", "Components", "ComponentType", "Root", "Graphic", "Camera", "Target", "GizmoVisible",
]);


//==============================================================================
// 전역 함수 목록.
//==============================================================================
//==============================================================================
// 엔진이 내보내는 컴포넌트 종류 수집.
// - 엔진을 올리면 새로 추가된 컴포넌트가 그대로 목록에 나타난다.
//==============================================================================
/**
 * @returns { object[] }
 */
function collectComponentClassList() {
	const classList = [];
	for (const exportName of System.Object.keys(Engine)) {
		const candidateClass = Engine[exportName];
		if (typeof candidateClass !== "function" || !candidateClass.prototype) {
			continue;
		}
		if (!(candidateClass.prototype instanceof Component)) {
			continue;
		}
		classList.push({ name: exportName, componentClass: candidateClass });
	}
	classList.sort((leftItem, rightItem) => {
		return (leftItem.name < rightItem.name) ? -1 : 1;
	});
	return classList;
}


//==============================================================================
// 편집 가능한 속성 수집. (getXxx / setXxx 짝을 찾는다)
//==============================================================================
/**
 * @param { object } targetObject
 * @returns { object[] }
 */
function collectEditableProperties(targetObject) {
	const propertyList = [];
	const visitedNameSet = new System.Set();
	let prototypeObject = System.Object.getPrototypeOf(targetObject);
	while (prototypeObject && prototypeObject !== System.Object.prototype) {
		const memberNameList = System.Object.getOwnPropertyNames(prototypeObject);
		const currentLevelList = [];
		for (const memberName of memberNameList) {
			let baseName = "";
			if (memberName.indexOf("get") === 0) {
				baseName = memberName.substring(3);
			}
			else if (memberName.indexOf("is") === 0) {
				baseName = memberName.substring(2);
			}
			else {
				continue;
			}
			if (baseName.length === 0 || visitedNameSet.has(baseName) || PROPERTY_EXCLUDE_NAMES.has(baseName)) {
				continue;
			}
			const setterName = "set" + baseName;
			if (typeof targetObject[setterName] !== "function") {
				continue;
			}
			const getterFunction = prototypeObject[memberName];
			if (typeof getterFunction !== "function" || getterFunction.length !== 0) {
				continue;
			}
			visitedNameSet.add(baseName);
			currentLevelList.push({ name: baseName, getterName: memberName, setterName: setterName });
		}
		propertyList.unshift(...currentLevelList);
		prototypeObject = System.Object.getPrototypeOf(prototypeObject);
	}
	return propertyList;
}


//==============================================================================
// 종류 이름에 맞는 아이콘 그림 반환.
//==============================================================================
/**
 * @param { string } iconName
 * @returns { string }
 */
function createIconMarkup(iconName) {
	const shapeMarkup = ICON_SHAPES[iconName] ? ICON_SHAPES[iconName] : ICON_SHAPES.empty;
	return "<svg width='16' height='16' viewBox='0 0 14 14' xmlns='http://www.w3.org/2000/svg'>" + shapeMarkup + "</svg>";
}


//==============================================================================
// 속성 이름을 보기 좋게 띄어쓴다. (LocalPosition -> Local Position)
//==============================================================================
/**
 * @param { string } propertyName
 * @returns { string }
 */
function formatPropertyLabel(propertyName) {
	return propertyName.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}


//==============================================================================
// UI 편집기.
// - 창 구성과 조작 UI 는 DOM(Pane) 으로 만들고, 편집 화면과 결과 화면만 엔진이 그린다.
// - 편집 화면: 배치와 선택 표시를 함께 보여 준다.
// - 결과 화면: 편집 표시 없이 실제로 보이는 모습만 그린다.
//==============================================================================
export class UIEditor {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WorldNode } */ #documentRootNode;
	/** @private @type { WorldNode | null } */ #selectedNode;
	/** @private @type { HTMLCanvasElement } */ #editorCanvas;
	/** @private @type { HTMLCanvasElement } */ #previewCanvas;
	/** @private @type { Graphic } */ #editorGraphic;
	/** @private @type { Graphic } */ #previewGraphic;
	/** @private @type { HTMLElement } */ #hierarchyTreeElement;
	/** @private @type { HTMLElement } */ #inspectorBodyElement;
	/** @private @type { HTMLElement } */ #statusTextElement;
	/** @private @type { string[] } */ #undoStack;
	/** @private @type { string[] } */ #redoStack;
	/** @private @type { string } */ #dragMode;
	/** @private @type { Vector2 } */ #dragStartPointer;
	/** @private @type { Vector2 } */ #dragStartPosition;
	/** @private @type { Vector2 } */ #dragStartSize;
	/** @private @type { object | null } */ #activeHandle;
	/** @private @type { object[] } */ #snapGuideList;
	/** @private @type { number } */ #nodeSerialNumber;
	/** @private @type { number | null } */ #zoomScale;
	/** @private @type { Vector2 } */ #panOffset;
	/** @private @type { Vector2 } */ #panStartPointer;
	/** @private @type { Vector2 } */ #panStartOffset;
	/** @private @type { boolean } */ #isGridVisible;
	/** @private @type { string } */ #activeViewName;
	/** @private @type { HTMLElement } */ #editorHolderElement;
	/** @private @type { HTMLElement } */ #previewHolderElement;
	/** @private @type { HTMLElement } */ #viewTitleElement;
	/** @private @type { HTMLElement } */ #viewToggleElement;
	/** @private @type { HTMLElement[] } */ #menuTitleElementList;
	/** @private @type { number } */ #openMenuIndex;
	/** @private @type { string } */ #renderScaleMode;
	/** @private @type { string } */ #documentFileName;
	/** @private @type { Map } */ #hierarchyRowNodeMap;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		this.#documentRootNode = null;
		this.#selectedNode = null;
		this.#editorCanvas = null;
		this.#previewCanvas = null;
		this.#editorGraphic = null;
		this.#previewGraphic = null;
		this.#hierarchyTreeElement = null;
		this.#inspectorBodyElement = null;
		this.#statusTextElement = null;
		this.#undoStack = [];
		this.#redoStack = [];
		this.#dragMode = "none";
		this.#dragStartPointer = Vector2.zero();
		this.#dragStartPosition = Vector2.zero();
		this.#dragStartSize = Vector2.zero();
		this.#activeHandle = null;
		this.#snapGuideList = [];
		this.#nodeSerialNumber = 0;
		this.#zoomScale = null;
		this.#panOffset = Vector2.zero();
		this.#panStartPointer = Vector2.zero();
		this.#panStartOffset = Vector2.zero();
		this.#isGridVisible = true;
		this.#activeViewName = "edit";
		this.#editorHolderElement = null;
		this.#previewHolderElement = null;
		this.#viewTitleElement = null;
		this.#viewToggleElement = null;
		this.#menuTitleElementList = [];
		this.#openMenuIndex = -1;
		this.#renderScaleMode = "fit";
		this.#documentFileName = "ui.uiasset.json";
		this.#hierarchyRowNodeMap = new System.Map();
	}

	//==============================================================================
	// 실행.
	//==============================================================================
	run() {
		this.createDocument();
		this.buildLayout();
		this.rebuildHierarchy();
		this.rebuildInspector();
		this.refreshStatus();
		this.startRenderLoop();
	}

	//==============================================================================
	// 빈 문서 생성.
	//==============================================================================
	createDocument() {
		const rootNode = new WorldNode();
		rootNode.setName("Root");
		rootNode.setPivot(Pivot.topLeft.clone());
		rootNode.setAnchor(Pivot.topLeft.clone());
		rootNode.setContentSize(Vector2.create(DEFAULT_DOCUMENT_WIDTH, DEFAULT_DOCUMENT_HEIGHT));
		const backgroundPaint = rootNode.addComponent(Paint);
		backgroundPaint.setColor(new Color(0.988, 0.961, 0.847, 1));
		this.#documentRootNode = rootNode;
		this.#selectedNode = null;
	}

	//==============================================================================
	// 창 구성. (툴바 / 좌측 / 편집·결과 화면 / 인스펙터 / 상태줄)
	//==============================================================================
	buildLayout() {
		const rootPane = new Pane({ direction: "vertical" });

		// --- 메뉴 막대 ---
		const menuBarPane = new Pane({ size: 28, minSize: 28, maxSize: 28, isResizable: false });
		const menuBarElement = this.createMenuBarElement();
		menuBarPane.getContainer().appendChild(menuBarElement);

		// --- 가운데 영역 ---
		const mainPane = new Pane({ direction: "horizontal", size: "flex" });

		// 좌측: 컴포넌트 + 계층.
		const leftPane = new Pane({ direction: "vertical", size: 240, minSize: 170 });
		const componentsPane = new Pane({ size: 232, minSize: 120 });
		const componentsElement = this.createSectionElement("COMPONENTS", () => {
			const menuItems = [];
			for (const definition of PALETTE_DEFINITIONS) {
				menuItems.push({
					id: "addWidget." + definition.id,
					label: "Add " + definition.label,
					action: () => {
						this.addWidgetNode(definition.id);
						this.rebuildHierarchy();
					},
				});
			}
			return menuItems;
		});
		const paletteListElement = PaneStyle.create("div", "", { style: { flex: "1", overflowY: "auto", position: "relative" } });
		for (const definition of PALETTE_DEFINITIONS) {
			const rowElement = this.createListRowElement(definition.id, definition.label);
			rowElement.addEventListener("click", () => {
				this.addWidgetNode(definition.id);
			});
			rowElement.draggable = true;
			rowElement.addEventListener("dragstart", (dragEvent) => {
				dragEvent.dataTransfer.setData("text/plain", PALETTE_DRAG_PREFIX + definition.id);
				dragEvent.dataTransfer.effectAllowed = "copy";
			});
			paletteListElement.appendChild(rowElement);
		}
		componentsElement.appendChild(paletteListElement);
		componentsPane.getContainer().appendChild(componentsElement);

		const hierarchyPane = new Pane({ size: "flex", minSize: 120 });
		const hierarchyElement = this.createSectionElement("HIERARCHY", () => {
			return [
				{
					id: "clearSelection",
					label: "Clear Selection",
					action: () => {
						this.selectNode(null);
					},
				},
				{ separator: true },
				{ id: "duplicate", label: "Duplicate", shortcut: "Ctrl+D" },
				{ id: "deleteNode", label: "Delete", shortcut: "Delete" },
				{ separator: true },
				{ id: "newDocument", label: "New Document", shortcut: "Ctrl+N" },
			];
		});
		this.#hierarchyTreeElement = PaneStyle.create("div", "", { style: { flex: "1", overflowY: "auto", position: "relative" } });
		hierarchyElement.appendChild(this.#hierarchyTreeElement);
		hierarchyPane.getContainer().appendChild(hierarchyElement);

		leftPane.addPane(componentsPane);
		leftPane.addPane(hierarchyPane);

		// 가운데: 편집 화면과 결과 화면을 탭으로 전환한다.
		const centerPane = new Pane({ size: "flex", minSize: 200 });
		const centerElement = PaneStyle.create("div", "", {
			style: { display: "flex", flexDirection: "column", backgroundColor: PaneTheme.color.background },
		});
		const viewHeaderElement = PaneStyle.create("div", "", {
			style: {
				position: "relative",
				width: "100%",
				height: "26px",
				flex: "0 0 26px",
				backgroundColor: PaneTheme.color.panel,
				borderBottom: "1px solid " + PaneTheme.color.border,
				display: "flex",
				alignItems: "center",
				padding: "0 6px 0 10px",
			},
		});
		this.#viewTitleElement = PaneStyle.create("span", "", {
			text: "VIEW",
			style: {
				position: "relative",
				width: "auto",
				height: "auto",
				flex: "1",
				fontSize: "12px",
				fontWeight: "bold",
				letterSpacing: "0.4px",
				color: PaneTheme.color.textDim,
			},
		});
		const viewMoreElement = PaneStyle.create("div", "", {
			text: "⋯",
			style: {
				position: "relative",
				width: "22px",
				height: "18px",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				fontSize: "15px",
				color: PaneTheme.color.textDim,
				cursor: "pointer",
				borderRadius: "3px",
				userSelect: "none",
			},
		});
		viewMoreElement.addEventListener("mouseenter", () => {
			viewMoreElement.style.backgroundColor = HOVER_COLOR;
			viewMoreElement.style.color = PaneTheme.color.text;
		});
		viewMoreElement.addEventListener("mouseleave", () => {
			viewMoreElement.style.backgroundColor = "transparent";
			viewMoreElement.style.color = PaneTheme.color.textDim;
		});
		viewMoreElement.addEventListener("click", (mouseEvent) => {
			mouseEvent.stopPropagation();
			const buttonRect = viewMoreElement.getBoundingClientRect();
			this.openMenuPanelAt(buttonRect.right - 200, buttonRect.bottom + 2, [
				{ id: "showEditView", label: "Edit View", shortcut: "Ctrl+1" },
				{ id: "showRenderView", label: "Render View", shortcut: "Ctrl+2" },
				{ separator: true },
				{ id: "renderScaleActual", label: "Actual Size (1:1)" },
				{ id: "renderScaleFit", label: "Fit to View" },
				{ id: "renderScaleStretch", label: "Stretch to View" },
			]);
		});
		this.#viewToggleElement = PaneStyle.create("div", "", {
			style: {
				position: "relative",
				width: "22px",
				height: "20px",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				marginRight: "2px",
				color: PaneTheme.color.text,
				cursor: "pointer",
				borderRadius: "4px",
				userSelect: "none",
			},
		});
		this.#viewToggleElement.addEventListener("mouseenter", () => {
			this.#viewToggleElement.style.backgroundColor = MENU_HOVER_COLOR;
		});
		this.#viewToggleElement.addEventListener("mouseleave", () => {
			this.#viewToggleElement.style.backgroundColor = "transparent";
		});
		this.#viewToggleElement.addEventListener("click", (mouseEvent) => {
			mouseEvent.stopPropagation();
			this.setActiveView(this.#activeViewName === "edit" ? "render" : "edit");
		});

		viewHeaderElement.appendChild(this.#viewTitleElement);
		viewHeaderElement.appendChild(this.#viewToggleElement);
		viewHeaderElement.appendChild(viewMoreElement);

		const canvasAreaElement = PaneStyle.create("div", "", {
			style: { position: "relative", width: "100%", height: "auto", flex: "1", overflow: "hidden" },
		});
		this.#editorHolderElement = this.createCanvasHolderElement(CANVAS_BACKGROUND_COLOR);
		this.#previewHolderElement = this.createCanvasHolderElement(CANVAS_BACKGROUND_COLOR);
		this.#editorCanvas = this.#editorHolderElement.firstChild;
		this.#previewCanvas = this.#previewHolderElement.firstChild;
		canvasAreaElement.appendChild(this.#editorHolderElement);
		canvasAreaElement.appendChild(this.#previewHolderElement);

		centerElement.appendChild(viewHeaderElement);
		centerElement.appendChild(canvasAreaElement);
		centerPane.getContainer().appendChild(centerElement);

		// 우측: 인스펙터.
		const inspectorPane = new Pane({ size: 300, minSize: 180 });
		const inspectorElement = this.createSectionElement("INSPECTOR", () => {
			const menuItems = [];
			menuItems.push({
				id: "addComponentFromSection",
				label: "Add Component...",
				action: () => {
					const bodyRect = this.#inspectorBodyElement.getBoundingClientRect();
					this.openAddComponentMenu(bodyRect.left + 20, bodyRect.top + 20);
				},
			});
			menuItems.push({ separator: true });
			menuItems.push({
				id: "clearSelection",
				label: "Clear Selection",
				action: () => {
					this.selectNode(null);
				},
			});
			return menuItems;
		});
		this.#inspectorBodyElement = PaneStyle.create("div", "", { style: { flex: "1", overflowY: "auto", position: "relative" } });
		inspectorElement.appendChild(this.#inspectorBodyElement);
		inspectorPane.getContainer().appendChild(inspectorElement);

		mainPane.addPane(leftPane);
		mainPane.addPane(centerPane);
		mainPane.addPane(inspectorPane);

		// --- 상태줄 ---
		const statusPane = new Pane({ size: 24, minSize: 24, maxSize: 24, isResizable: false });
		const statusElement = PaneStyle.create("div", "", {
			style: {
				backgroundColor: PaneTheme.color.toolbar,
				borderTop: "1px solid " + PaneTheme.color.border,
				display: "flex",
				alignItems: "center",
				padding: "0 12px",
				fontSize: "12px",
				color: PaneTheme.color.textDim,
			},
		});
		this.#statusTextElement = PaneStyle.create("span", "", { text: "", style: { position: "relative", width: "auto", height: "auto" } });
		statusElement.appendChild(this.#statusTextElement);
		statusPane.getContainer().appendChild(statusElement);

		rootPane.addPane(menuBarPane);
		rootPane.addPane(mainPane);
		rootPane.addPane(statusPane);
		rootPane.attachTo(System.document.body);

		this.#editorGraphic = new Graphic(this.#editorCanvas);
		this.#previewGraphic = new Graphic(this.#previewCanvas);
		this.setActiveView("edit");
		this.bindEditorPointerEvents();
		this.bindKeyboardEvents();

		// 편집기 전용 메뉴만 쓰도록 웹 기본 오른쪽 단추 메뉴를 막는다.
		System.document.addEventListener("contextmenu", (mouseEvent) => {
			mouseEvent.preventDefault();
		});

		// 메뉴 바깥을 누르면 접는다.
		System.window.addEventListener("mousedown", () => {
			const openedPanel = System.document.getElementById("uieditorMenuPanel");
			if (openedPanel || this.#openMenuIndex >= 0) {
				this.closeMenuDropdown();
			}
		});
	}

	//==============================================================================
	// 메뉴 막대 생성.
	//==============================================================================
	/**
	 * @returns { HTMLElement }
	 */
	createMenuBarElement() {
		const menuBarElement = PaneStyle.create("div", "", {
			style: {
				backgroundColor: PaneTheme.color.toolbar,
				borderBottom: "1px solid " + PaneTheme.color.border,
				display: "flex",
				alignItems: "stretch",
				padding: "0 4px",
			},
		});
		this.#menuTitleElementList = [];
		for (let menuIndex = 0; menuIndex < MENU_DEFINITIONS.length; ++menuIndex) {
			const menuDefinition = MENU_DEFINITIONS[menuIndex];
			const titleElement = PaneStyle.create("div", "", {
				text: menuDefinition.title,
				style: {
					position: "relative",
					width: "auto",
					height: "100%",
					display: "flex",
					alignItems: "center",
					padding: "0 10px",
					fontSize: "13px",
					color: PaneTheme.color.text,
					cursor: "default",
					userSelect: "none",
				},
			});
			const currentMenuIndex = menuIndex;
			titleElement.addEventListener("mousedown", (mouseEvent) => {
				mouseEvent.preventDefault();
				mouseEvent.stopPropagation();
				if (this.#openMenuIndex === currentMenuIndex) {
					this.closeMenuDropdown();
					return;
				}
				this.openMenuDropdown(currentMenuIndex);
			});
			titleElement.addEventListener("mouseenter", () => {
				if (this.#openMenuIndex >= 0 && this.#openMenuIndex !== currentMenuIndex) {
					this.openMenuDropdown(currentMenuIndex);
					return;
				}
				if (this.#openMenuIndex !== currentMenuIndex) {
					titleElement.style.backgroundColor = MENU_HOVER_COLOR;
				}
			});
			titleElement.addEventListener("mouseleave", () => {
				if (this.#openMenuIndex !== currentMenuIndex) {
					titleElement.style.backgroundColor = "transparent";
				}
			});
			this.#menuTitleElementList.push(titleElement);
			menuBarElement.appendChild(titleElement);
		}
		return menuBarElement;
	}

	//==============================================================================
	// 메뉴 패널 생성. (메뉴 막대와 오른쪽 단추 메뉴가 함께 쓴다)
	//==============================================================================
	/**
	 * @param { object[] } menuItems
	 * @returns { HTMLElement }
	 */
	createMenuPanelElement(menuItems) {
		const panelElement = System.document.createElement("div");
		panelElement.id = "uieditorMenuPanel";
		panelElement.style.cssText = "position:fixed;z-index:9999;min-width:196px;padding:4px 0;"
			+ "background:" + PaneTheme.color.toolbar + ";border:1px solid " + PaneTheme.color.border + ";"
			+ "border-radius:4px;box-shadow:0 6px 18px rgba(0,0,0,0.5);font-size:13px;color:" + PaneTheme.color.text + ";"
			+ "font-family:" + PaneTheme.font.family + ";";
		panelElement.addEventListener("mousedown", (mouseEvent) => {
			mouseEvent.stopPropagation();
		});
		for (const menuItem of menuItems) {
			if (menuItem.separator) {
				const separatorElement = System.document.createElement("div");
				separatorElement.style.cssText = "height:1px;margin:4px 8px;background:" + PaneTheme.color.border + ";";
				panelElement.appendChild(separatorElement);
				continue;
			}
			const itemElement = System.document.createElement("div");
			itemElement.style.cssText = "display:flex;align-items:center;padding:5px 12px 5px 8px;cursor:pointer;white-space:nowrap;";

			const checkElement = System.document.createElement("span");
			checkElement.style.cssText = "width:16px;flex:0 0 16px;color:" + SELECTION_COLOR + ";";
			checkElement.innerText = this.isCommandChecked(menuItem.id) ? "✓" : "";
			itemElement.appendChild(checkElement);

			const labelElement = System.document.createElement("span");
			labelElement.style.cssText = "flex:1;";
			labelElement.innerText = menuItem.label;
			itemElement.appendChild(labelElement);

			if (menuItem.shortcut) {
				const shortcutElement = System.document.createElement("span");
				shortcutElement.style.cssText = "margin-left:24px;color:" + PaneTheme.color.textDim + ";font-size:12px;";
				shortcutElement.innerText = menuItem.shortcut;
				itemElement.appendChild(shortcutElement);
			}

			itemElement.addEventListener("mouseenter", () => {
				itemElement.style.backgroundColor = MENU_HOVER_COLOR;
			});
			itemElement.addEventListener("mouseleave", () => {
				itemElement.style.backgroundColor = "transparent";
			});
			itemElement.addEventListener("click", () => {
				this.closeMenuDropdown();
				if (menuItem.action) {
					menuItem.action();
					return;
				}
				this.executeCommand(menuItem.id);
			});
			panelElement.appendChild(itemElement);
		}
		return panelElement;
	}

	//==============================================================================
	// 메뉴 펼치기.
	//==============================================================================
	/**
	 * @param { number } menuIndex
	 */
	openMenuDropdown(menuIndex) {
		this.closeMenuDropdown();
		const titleElement = this.#menuTitleElementList[menuIndex];
		const titleRect = titleElement.getBoundingClientRect();
		const panelElement = this.createMenuPanelElement(MENU_DEFINITIONS[menuIndex].items);
		panelElement.style.left = System.Math.round(titleRect.left) + "px";
		panelElement.style.top = System.Math.round(titleRect.bottom) + "px";
		System.document.body.appendChild(panelElement);
		titleElement.style.backgroundColor = MENU_HOVER_COLOR;
		this.#openMenuIndex = menuIndex;
	}

	//==============================================================================
	// 좌표를 지정해 메뉴 펼치기. (머리말 더보기 단추 등에서 쓴다)
	//==============================================================================
	/**
	 * @param { number } clientX
	 * @param { number } clientY
	 * @param { object[] } menuItems
	 */
	openMenuPanelAt(clientX, clientY, menuItems) {
		this.closeMenuDropdown();
		const panelElement = this.createMenuPanelElement(menuItems);
		panelElement.style.left = System.Math.round(clientX) + "px";
		panelElement.style.top = System.Math.round(clientY) + "px";
		System.document.body.appendChild(panelElement);
	}

	//==============================================================================
	// 메뉴 접기.
	//==============================================================================
	closeMenuDropdown() {
		const existingPanel = System.document.getElementById("uieditorMenuPanel");
		if (existingPanel) {
			existingPanel.remove();
		}
		if (this.#openMenuIndex >= 0) {
			this.#menuTitleElementList[this.#openMenuIndex].style.backgroundColor = "transparent";
		}
		this.#openMenuIndex = -1;
	}

	//==============================================================================
	// 캔버스 자리 생성.
	//==============================================================================
	/**
	 * @param { string } backgroundColorText
	 * @returns { HTMLElement }
	 */
	createCanvasHolderElement(backgroundColorText) {
		const holderElement = PaneStyle.create("div", "", { style: { backgroundColor: backgroundColorText } });
		const canvasElement = PaneStyle.create("canvas", "");
		holderElement.appendChild(canvasElement);
		return holderElement;
	}

	//==============================================================================
	// 보이는 화면 전환.
	//==============================================================================
	/**
	 * @param { string } viewName
	 */
	setActiveView(viewName) {
		this.#activeViewName = viewName;
		const isEditorActive = (viewName === "edit");
		this.#editorHolderElement.style.display = isEditorActive ? "block" : "none";
		this.#previewHolderElement.style.display = isEditorActive ? "none" : "block";
		const renderModeLabel = { actual: "1:1", fit: "FIT", stretch: "STRETCH" }[this.#renderScaleMode];
		this.#viewTitleElement.innerText = isEditorActive ? "VIEW" : ("VIEW - " + renderModeLabel);
		this.#viewToggleElement.innerHTML = createIconMarkup(isEditorActive ? "renderMode" : "editMode");
		this.#viewToggleElement.title = isEditorActive ? "결과 화면 보기" : "편집 화면으로";
		this.refreshStatus();
	}

	//==============================================================================
	// 제목이 붙은 세로 구획 생성.
	//==============================================================================
	/**
	 * @param { string } titleText
	 * @returns { HTMLElement }
	 */
	createSectionElement(titleText, menuBuilder) {
		const sectionElement = PaneStyle.create("div", "panel", { style: { display: "flex", flexDirection: "column", padding: "0" } });
		const titleElement = PaneStyle.create("div", "", {
			text: titleText,
			style: {
				position: "relative",
				width: "auto",
				height: "26px",
				lineHeight: "26px",
				padding: "0 10px",
				fontSize: "12px",
				fontWeight: "bold",
				color: PaneTheme.color.textDim,
				backgroundColor: PaneTheme.color.toolbar,
				borderBottom: "1px solid " + PaneTheme.color.border,
			},
		});
		sectionElement.appendChild(titleElement);
		if (menuBuilder) {
			titleElement.style.display = "flex";
			titleElement.style.alignItems = "center";
			titleElement.style.paddingRight = "6px";
			const spacerElement = PaneStyle.create("div", "", {
				style: { position: "relative", width: "auto", height: "auto", flex: "1" },
			});
			const moreElement = PaneStyle.create("div", "", {
				text: "\u22EF",
				style: {
					position: "relative", width: "20px", height: "16px",
					display: "flex", alignItems: "center", justifyContent: "center",
					fontSize: "14px", color: PaneTheme.color.textDim,
					cursor: "pointer", borderRadius: "3px", userSelect: "none",
				},
			});
			moreElement.addEventListener("mouseenter", () => {
				moreElement.style.backgroundColor = MENU_HOVER_COLOR;
			});
			moreElement.addEventListener("mouseleave", () => {
				moreElement.style.backgroundColor = "transparent";
			});
			moreElement.addEventListener("click", (mouseEvent) => {
				mouseEvent.stopPropagation();
				const buttonRect = moreElement.getBoundingClientRect();
				this.openMenuPanelAt(buttonRect.right - 200, buttonRect.bottom + 2, menuBuilder());
			});
			titleElement.appendChild(spacerElement);
			titleElement.appendChild(moreElement);
		}
		return sectionElement;
	}

	//==============================================================================
	// 목록 한 줄 생성. (기호 + 이름)
	//==============================================================================
	/**
	 * @param { string } glyphText
	 * @param { string } labelText
	 * @returns { HTMLElement }
	 */
	createListRowElement(glyphText, labelText) {
		const rowElement = PaneStyle.create("div", "", {
			style: {
				position: "relative",
				width: "auto",
				height: "auto",
				display: "flex",
				alignItems: "center",
				gap: "6px",
				padding: "4px 10px",
				fontSize: "14px",
				color: PaneTheme.color.text,
				cursor: "pointer",
				userSelect: "none",
			},
		});
		const glyphElement = PaneStyle.create("span", "", {
			style: {
				position: "relative", width: "16px", height: "16px", flexShrink: "0",
				display: "flex", alignItems: "center", justifyContent: "center", color: SELECTION_COLOR,
			},
		});
		glyphElement.innerHTML = createIconMarkup(glyphText);
		const labelElement = PaneStyle.create("span", "", {
			text: labelText,
			style: { position: "relative", width: "auto", height: "auto" },
		});
		rowElement.appendChild(glyphElement);
		rowElement.appendChild(labelElement);
		rowElement.addEventListener("mouseenter", () => {
			if (rowElement.dataset.selected !== "true") {
				rowElement.style.backgroundColor = HOVER_COLOR;
			}
		});
		rowElement.addEventListener("mouseleave", () => {
			if (rowElement.dataset.selected !== "true") {
				rowElement.style.backgroundColor = "transparent";
			}
		});
		return rowElement;
	}

	//==============================================================================
	// 그리기 루프 시작. (편집 화면과 결과 화면을 각각 그린다)
	//==============================================================================
	startRenderLoop() {
		const renderFrame = () => {
			if (this.#activeViewName === "edit") {
				this.renderEditorView();
			}
			else {
				this.renderPreviewView();
			}
			System.requestAnimationFrame(renderFrame);
		};
		System.requestAnimationFrame(renderFrame);
	}

	//==============================================================================
	// 캔버스 크기 맞추기. (표시 크기에 맞춰 그리기 버퍼를 갱신)
	//==============================================================================
	/**
	 * @param { HTMLCanvasElement } canvasElement
	 * @returns { boolean }
	 */
	resizeCanvasToDisplay(canvasElement) {
		const devicePixelRatio = System.Math.min(System.window.devicePixelRatio || 1, 2);
		const displayWidth = System.Math.floor(canvasElement.clientWidth * devicePixelRatio);
		const displayHeight = System.Math.floor(canvasElement.clientHeight * devicePixelRatio);
		if (displayWidth <= 0 || displayHeight <= 0) {
			return false;
		}
		if (canvasElement.width !== displayWidth || canvasElement.height !== displayHeight) {
			canvasElement.width = displayWidth;
			canvasElement.height = displayHeight;
		}
		return true;
	}

	//==============================================================================
	// 편집 화면 그리기. (문서 + 선택 표시 + 스냅 안내선)
	//==============================================================================
	renderEditorView() {
		if (!this.resizeCanvasToDisplay(this.#editorCanvas)) {
			return;
		}
		const graphic = this.#editorGraphic;
		const devicePixelRatio = System.Math.min(System.window.devicePixelRatio || 1, 2);
		graphic.applySettings(null);
		graphic.scale(devicePixelRatio, devicePixelRatio);

		const viewSize = this.getEditorViewSize();
		graphic.setFillColor(CANVAS_BACKGROUND_COLOR);
		graphic.drawRect(Rect.create(0, 0, viewSize.x, viewSize.y));

		const editorTransform = this.getEditorTransform();

		// 격자를 바탕에 깐다.
		this.drawGrid(graphic, editorTransform);
		graphic.pushState();
		graphic.translate(editorTransform.originX, editorTransform.originY);
		graphic.scale(editorTransform.scale, editorTransform.scale);
		graphic.drawNode(this.#documentRootNode);
		graphic.popState();

		this.drawSnapGuides(graphic, editorTransform);
		this.drawSelectionOverlay(graphic, editorTransform);
	}

	//==============================================================================
	// 결과 화면 그리기. (편집 표시 없이 문서만)
	//==============================================================================
	renderPreviewView() {
		if (!this.resizeCanvasToDisplay(this.#previewCanvas)) {
			return;
		}
		const graphic = this.#previewGraphic;
		const documentSize = this.getDocumentSize();
		const devicePixelRatio = System.Math.min(System.window.devicePixelRatio || 1, 2);
		graphic.applySettings(null);
		graphic.scale(devicePixelRatio, devicePixelRatio);

		const viewWidth = this.#previewCanvas.clientWidth;
		const viewHeight = this.#previewCanvas.clientHeight;
		graphic.setFillColor(PREVIEW_LETTERBOX_COLOR);
		graphic.drawRect(Rect.create(0, 0, viewWidth, viewHeight));

		// 표시 방식에 따라 배율과 자리를 정한다.
		let scaleX = 1;
		let scaleY = 1;
		if (this.#renderScaleMode === "fit") {
			const fitRatio = System.Math.min(viewWidth / documentSize.x, viewHeight / documentSize.y);
			scaleX = fitRatio;
			scaleY = fitRatio;
		}
		else if (this.#renderScaleMode === "stretch") {
			scaleX = viewWidth / documentSize.x;
			scaleY = viewHeight / documentSize.y;
		}
		const offsetX = System.Math.round((viewWidth - documentSize.x * scaleX) * 0.5);
		const offsetY = System.Math.round((viewHeight - documentSize.y * scaleY) * 0.5);

		graphic.pushState();
		graphic.translate(offsetX, offsetY);
		graphic.scale(scaleX, scaleY);
		graphic.drawNode(this.#documentRootNode);
		graphic.popState();
	}

	//==============================================================================
	// 편집 화면 크기 반환. (CSS 픽셀 기준)
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getEditorViewSize() {
		return Vector2.create(this.#editorCanvas.clientWidth, this.#editorCanvas.clientHeight);
	}

	//==============================================================================
	// 편집 화면 변환 반환. (문서 전체가 보이도록 맞춘 배율과 좌상단 위치)
	//==============================================================================
	/**
	 * @returns { object }
	 */
	getEditorTransform() {
		const viewSize = this.getEditorViewSize();
		const documentSize = this.getDocumentSize();
		const scaleRatio = (this.#zoomScale !== null) ? this.#zoomScale : this.getFitScale();
		const originX = System.Math.round((viewSize.x - documentSize.x * scaleRatio) * 0.5 + this.#panOffset.x);
		const originY = System.Math.round((viewSize.y - documentSize.y * scaleRatio) * 0.5 + this.#panOffset.y);
		return { scale: scaleRatio, originX: originX, originY: originY };
	}

	//==============================================================================
	// 문서 크기 반환. (뿌리 노드의 크기가 곧 문서 크기다)
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getDocumentSize() {
		if (!this.#documentRootNode) {
			return Vector2.create(DEFAULT_DOCUMENT_WIDTH, DEFAULT_DOCUMENT_HEIGHT);
		}
		return this.#documentRootNode.getContentSize();
	}

	//==============================================================================
	// 문서 전체가 들어오는 배율 계산.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getFitScale() {
		const viewSize = this.getEditorViewSize();
		const documentSize = this.getDocumentSize();
		const marginSize = 48;
		const widthRatio = (viewSize.x - marginSize) / documentSize.x;
		const heightRatio = (viewSize.y - marginSize) / documentSize.y;
		return System.Math.max(ZOOM_MINIMUM, System.Math.min(1, System.Math.min(widthRatio, heightRatio)));
	}

	//==============================================================================
	// 배율 지정. (화면상 기준점의 문서 좌표를 유지한다)
	//==============================================================================
	/**
	 * @param { number } nextScale
	 * @param { number } focusClientX
	 * @param { number } focusClientY
	 */
	setZoomScale(nextScale, focusClientX, focusClientY) {
		const currentTransform = this.getEditorTransform();
		const canvasRect = this.#editorCanvas.getBoundingClientRect();
		const focusX = focusClientX - canvasRect.left;
		const focusY = focusClientY - canvasRect.top;
		const documentX = (focusX - currentTransform.originX) / currentTransform.scale;
		const documentY = (focusY - currentTransform.originY) / currentTransform.scale;
		const clampedScale = System.Math.max(ZOOM_MINIMUM, System.Math.min(ZOOM_MAXIMUM, nextScale));
		const viewSize = this.getEditorViewSize();
		const documentSize = this.getDocumentSize();
		this.#zoomScale = clampedScale;
		this.#panOffset = Vector2.create(
			focusX - documentX * clampedScale - (viewSize.x - documentSize.x * clampedScale) * 0.5,
			focusY - documentY * clampedScale - (viewSize.y - documentSize.y * clampedScale) * 0.5);
		this.refreshStatus();
	}

	//==============================================================================
	// 화면 중앙을 기준으로 배율 변경.
	//==============================================================================
	/**
	 * @param { number } stepRatio
	 */
	zoomByStep(stepRatio) {
		const canvasRect = this.#editorCanvas.getBoundingClientRect();
		const currentTransform = this.getEditorTransform();
		const centerX = canvasRect.left + canvasRect.width * 0.5;
		const centerY = canvasRect.top + canvasRect.height * 0.5;
		this.setZoomScale(currentTransform.scale * stepRatio, centerX, centerY);
	}

	//==============================================================================
	// 자동 맞춤 배율을 고정 배율로 바꾼다. (화면 이동 전에 기준을 잡는다)
	//==============================================================================
	lockZoomScale() {
		if (this.#zoomScale !== null) {
			return;
		}
		this.#zoomScale = this.getFitScale();
		this.#panOffset = Vector2.zero();
	}

	//==============================================================================
	// 선택 표시 그리기. (테두리 + 8방향 손잡이 + 치수)
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 * @param { object } editorTransform
	 */
	drawSelectionOverlay(graphic, editorTransform) {
		const selectedNode = this.#selectedNode;
		if (!selectedNode) {
			return;
		}
		const worldBounds = selectedNode.getWorldBounds();
		const boundsLeft = editorTransform.originX + worldBounds.left * editorTransform.scale;
		const boundsTop = editorTransform.originY + worldBounds.top * editorTransform.scale;
		const boundsWidth = worldBounds.width * editorTransform.scale;
		const boundsHeight = worldBounds.height * editorTransform.scale;

		graphic.setFillColor(SELECTION_COLOR);
		graphic.drawRect(Rect.create(boundsLeft, boundsTop, boundsWidth, 1));
		graphic.drawRect(Rect.create(boundsLeft, boundsTop + boundsHeight - 1, boundsWidth, 1));
		graphic.drawRect(Rect.create(boundsLeft, boundsTop, 1, boundsHeight));
		graphic.drawRect(Rect.create(boundsLeft + boundsWidth - 1, boundsTop, 1, boundsHeight));

		// 앵커 자리. (부모 영역 안의 기준점 — 여기를 기준으로 Anchored Position 이 정해진다)
		const parentNode = selectedNode.getParent();
		if (parentNode) {
			const parentBounds = parentNode.getWorldBounds();
			const anchor = selectedNode.getAnchor();
			const anchorX = System.Math.round(editorTransform.originX + (parentBounds.left + parentBounds.width * anchor.x) * editorTransform.scale);
			const anchorY = System.Math.round(editorTransform.originY + (parentBounds.top + parentBounds.height * anchor.y) * editorTransform.scale);
			graphic.setFillColor(PIVOT_SHADOW_COLOR);
			graphic.drawRect(Rect.create(anchorX - ANCHOR_MARK_SIZE - 1, anchorY - 2, ANCHOR_MARK_SIZE * 2 + 3, 5));
			graphic.drawRect(Rect.create(anchorX - 2, anchorY - ANCHOR_MARK_SIZE - 1, 5, ANCHOR_MARK_SIZE * 2 + 3));
			graphic.setFillColor(ANCHOR_COLOR);
			graphic.drawRect(Rect.create(anchorX - ANCHOR_MARK_SIZE, anchorY, ANCHOR_MARK_SIZE * 2 + 1, 1));
			graphic.drawRect(Rect.create(anchorX, anchorY - ANCHOR_MARK_SIZE, 1, ANCHOR_MARK_SIZE * 2 + 1));
		}

		// 피벗 자리. (어떤 바탕에서도 보이도록 어두운 테두리 위에 밝은 십자를 얹는다)
		const pivot = selectedNode.getPivot();
		const pivotX = System.Math.round(boundsLeft + boundsWidth * pivot.x);
		const pivotY = System.Math.round(boundsTop + boundsHeight * pivot.y);
		graphic.setFillColor(PIVOT_SHADOW_COLOR);
		graphic.drawRect(Rect.create(pivotX - PIVOT_MARK_SIZE, pivotY - 2, PIVOT_MARK_SIZE * 2 + 1, 5));
		graphic.drawRect(Rect.create(pivotX - 2, pivotY - PIVOT_MARK_SIZE, 5, PIVOT_MARK_SIZE * 2 + 1));
		graphic.setFillColor(PIVOT_COLOR);
		graphic.drawRect(Rect.create(pivotX - PIVOT_MARK_SIZE + 1, pivotY, PIVOT_MARK_SIZE * 2 - 1, 1));
		graphic.drawRect(Rect.create(pivotX, pivotY - PIVOT_MARK_SIZE + 1, 1, PIVOT_MARK_SIZE * 2 - 1));
		graphic.drawRect(Rect.create(pivotX - 2, pivotY - 2, 5, 5));

		for (const handleDefinition of RESIZE_HANDLE_DEFINITIONS) {
			const handleX = boundsLeft + boundsWidth * handleDefinition.ratioX - HANDLE_SIZE * 0.5;
			const handleY = boundsTop + boundsHeight * handleDefinition.ratioY - HANDLE_SIZE * 0.5;
			graphic.setFillColor("#1e1e1e");
			graphic.drawRect(Rect.create(handleX, handleY, HANDLE_SIZE, HANDLE_SIZE));
			graphic.setFillColor(SELECTION_COLOR);
			graphic.drawRect(Rect.create(handleX + 1, handleY + 1, HANDLE_SIZE - 2, HANDLE_SIZE - 2));
		}

		const localPosition = selectedNode.getLocalPosition();
		const contentSize = selectedNode.getContentSize();
		const badgeText = System.Math.round(localPosition.x) + ", " + System.Math.round(localPosition.y)
			+ "   " + System.Math.round(contentSize.x) + " x " + System.Math.round(contentSize.y);
		graphic.setFontString("11px sans-serif");
		graphic.setTextAlign("left");
		graphic.setTextBaseline("middle");
		const badgeWidth = badgeText.length * 6.2 + 12;
		graphic.setFillColor("rgba(30, 30, 30, 0.94)");
		graphic.drawRect(Rect.create(boundsLeft, boundsTop - 20, badgeWidth, 17));
		graphic.setFillColor(SELECTION_COLOR);
		graphic.drawFillText(badgeText, boundsLeft + 6, boundsTop - 12);
	}

	//==============================================================================
	// 문서 영역 격자 그리기.
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 * @param { object } editorTransform
	 */
	drawGrid(graphic, editorTransform) {
		if (!this.#isGridVisible) {
			return;
		}
		const documentSize = this.getDocumentSize();

		// 축소해도 선이 뭉치지 않도록 화면상 간격이 확보될 때까지 격자 간격을 키운다.
		let gridStep = GRID_SIZE;
		while (gridStep * editorTransform.scale < GRID_MINIMUM_SCREEN_STEP) {
			gridStep *= 2;
		}
		const screenStep = gridStep * editorTransform.scale;
		const viewSize = this.getEditorViewSize();

		// 문서 원점을 기준 삼되 편집 화면 전체를 덮는다.
		const firstColumnIndex = System.Math.ceil(-editorTransform.originX / screenStep);
		const lastColumnIndex = System.Math.floor((viewSize.x - editorTransform.originX) / screenStep);
		for (let columnIndex = firstColumnIndex; columnIndex <= lastColumnIndex; ++columnIndex) {
			const isMajorLine = (columnIndex % 5 === 0);
			graphic.setFillColor(isMajorLine ? GRID_MAJOR_COLOR : GRID_MINOR_COLOR);
			const screenX = System.Math.round(editorTransform.originX + columnIndex * screenStep);
			graphic.drawRect(Rect.create(screenX, 0, 1, viewSize.y));
		}
		const firstRowIndex = System.Math.ceil(-editorTransform.originY / screenStep);
		const lastRowIndex = System.Math.floor((viewSize.y - editorTransform.originY) / screenStep);
		for (let rowIndex = firstRowIndex; rowIndex <= lastRowIndex; ++rowIndex) {
			const isMajorLine = (rowIndex % 5 === 0);
			graphic.setFillColor(isMajorLine ? GRID_MAJOR_COLOR : GRID_MINOR_COLOR);
			const screenY = System.Math.round(editorTransform.originY + rowIndex * screenStep);
			graphic.drawRect(Rect.create(0, screenY, viewSize.x, 1));
		}
	}

	//==============================================================================
	// 스냅 안내선 그리기.
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 * @param { object } editorTransform
	 */
	drawSnapGuides(graphic, editorTransform) {
		const documentSize = this.getDocumentSize();
		graphic.setFillColor(SNAP_GUIDE_COLOR);
		for (const snapGuide of this.#snapGuideList) {
			if (snapGuide.axis === "vertical") {
				graphic.drawRect(Rect.create(editorTransform.originX + snapGuide.value * editorTransform.scale,
					editorTransform.originY, 1, documentSize.y * editorTransform.scale));
			}
			else {
				graphic.drawRect(Rect.create(editorTransform.originX,
					editorTransform.originY + snapGuide.value * editorTransform.scale, documentSize.x * editorTransform.scale, 1));
			}
		}
	}

	//==============================================================================
	// 편집 화면 입력 연결.
	//==============================================================================
	bindEditorPointerEvents() {
		const canvasElement = this.#editorCanvas;
		canvasElement.addEventListener("mousedown", (mouseEvent) => {
			if (mouseEvent.button === 1) {
				mouseEvent.preventDefault();
				this.beginPan(mouseEvent);
				return;
			}
			this.handlePointerDown(this.readCanvasPointer(mouseEvent));
		});
		canvasElement.addEventListener("dblclick", (mouseEvent) => {
			this.selectNextOverlappedNode(this.readCanvasPointer(mouseEvent));
		});
		canvasElement.addEventListener("dragover", (dragEvent) => {
			dragEvent.preventDefault();
			dragEvent.dataTransfer.dropEffect = "copy";
		});
		canvasElement.addEventListener("drop", (dragEvent) => {
			dragEvent.preventDefault();
			const transferText = dragEvent.dataTransfer.getData("text/plain");
			if (transferText.indexOf(PALETTE_DRAG_PREFIX) !== 0) {
				return;
			}
			const widgetKind = transferText.substring(PALETTE_DRAG_PREFIX.length);
			const dropPosition = this.readCanvasPointer(dragEvent);
			this.addWidgetNode(widgetKind, dropPosition);
			this.rebuildHierarchy();
		});
		canvasElement.addEventListener("wheel", (wheelEvent) => {
			wheelEvent.preventDefault();
			const currentTransform = this.getEditorTransform();
			const stepRatio = (wheelEvent.deltaY < 0) ? ZOOM_STEP : (1 / ZOOM_STEP);
			this.setZoomScale(currentTransform.scale * stepRatio, wheelEvent.clientX, wheelEvent.clientY);
		}, { passive: false });
		System.window.addEventListener("mousemove", (mouseEvent) => {
			if (this.#dragMode === "pan") {
				this.updatePan(mouseEvent);
				return;
			}
			this.handlePointerMove(this.readCanvasPointer(mouseEvent));
		});
		System.window.addEventListener("mouseup", () => {
			this.handlePointerUp();
		});
		canvasElement.addEventListener("contextmenu", (mouseEvent) => {
			mouseEvent.preventDefault();
			this.openContextMenu(mouseEvent.clientX, mouseEvent.clientY);
		});
	}

	//==============================================================================
	// 마우스 좌표를 문서 좌표로 변환.
	//==============================================================================
	/**
	 * @param { MouseEvent } mouseEvent
	 * @returns { Vector2 }
	 */
	readCanvasPointer(mouseEvent) {
		const canvasRect = this.#editorCanvas.getBoundingClientRect();
		const editorTransform = this.getEditorTransform();
		const pointerX = (mouseEvent.clientX - canvasRect.left - editorTransform.originX) / editorTransform.scale;
		const pointerY = (mouseEvent.clientY - canvasRect.top - editorTransform.originY) / editorTransform.scale;
		return Vector2.create(pointerX, pointerY);
	}

	//==============================================================================
	// 화면 이동 시작.
	//==============================================================================
	/**
	 * @param { MouseEvent } mouseEvent
	 */
	beginPan(mouseEvent) {
		this.lockZoomScale();
		this.#dragMode = "pan";
		this.#panStartPointer = Vector2.create(mouseEvent.clientX, mouseEvent.clientY);
		this.#panStartOffset = Vector2.create(this.#panOffset.x, this.#panOffset.y);
	}

	//==============================================================================
	// 화면 이동 갱신.
	//==============================================================================
	/**
	 * @param { MouseEvent } mouseEvent
	 */
	updatePan(mouseEvent) {
		const movedX = mouseEvent.clientX - this.#panStartPointer.x;
		const movedY = mouseEvent.clientY - this.#panStartPointer.y;
		this.#panOffset = Vector2.create(this.#panStartOffset.x + movedX, this.#panStartOffset.y + movedY);
	}

	//==============================================================================
	// 마우스 누름.
	//==============================================================================
	/**
	 * @param { Vector2 } pointerPosition
	 */
	handlePointerDown(pointerPosition) {
		this.#dragStartPointer = pointerPosition;

		const selectedNode = this.#selectedNode;
		if (selectedNode) {
			const handleDefinition = this.findHandleAt(selectedNode, pointerPosition);
			if (handleDefinition) {
				this.pushUndoSnapshot();
				this.#dragMode = "resize";
				this.#activeHandle = handleDefinition;
				const localPosition = selectedNode.getLocalPosition();
				const contentSize = selectedNode.getContentSize();
				this.#dragStartPosition = Vector2.create(localPosition.x, localPosition.y);
				this.#dragStartSize = Vector2.create(contentSize.x, contentSize.y);
				return;
			}
		}

		const hitNode = this.findTopmostNodeAt(this.#documentRootNode, pointerPosition);
		this.selectNode(hitNode);
		if (hitNode) {
			this.pushUndoSnapshot();
			this.#dragMode = "move";
			const localPosition = hitNode.getLocalPosition();
			this.#dragStartPosition = Vector2.create(localPosition.x, localPosition.y);
		}
	}

	//==============================================================================
	// 마우스 이동. (커서 모양 + 이동/크기 조절)
	//==============================================================================
	/**
	 * @param { Vector2 } pointerPosition
	 */
	handlePointerMove(pointerPosition) {
		const selectedNode = this.#selectedNode;
		if (this.#dragMode === "none") {
			this.applyCursor(pointerPosition);
			return;
		}
		if (!selectedNode) {
			return;
		}
		const deltaX = pointerPosition.x - this.#dragStartPointer.x;
		const deltaY = pointerPosition.y - this.#dragStartPointer.y;

		if (this.#dragMode === "move") {
			const movedPosition = Vector2.create(this.#dragStartPosition.x + deltaX, this.#dragStartPosition.y + deltaY);
			selectedNode.setLocalPosition(this.applySnap(selectedNode, movedPosition));
		}
		else if (this.#dragMode === "resize" && this.#activeHandle) {
			const handleDefinition = this.#activeHandle;
			const nextWidth = System.Math.max(8, this.#dragStartSize.x + deltaX * handleDefinition.sizeX);
			const nextHeight = System.Math.max(8, this.#dragStartSize.y + deltaY * handleDefinition.sizeY);
			let nextX = this.#dragStartPosition.x;
			let nextY = this.#dragStartPosition.y;
			if (handleDefinition.moveLeft) {
				nextX = this.#dragStartPosition.x + (this.#dragStartSize.x - nextWidth);
			}
			if (handleDefinition.moveTop) {
				nextY = this.#dragStartPosition.y + (this.#dragStartSize.y - nextHeight);
			}
			selectedNode.setLocalPosition(Vector2.create(nextX, nextY));
			selectedNode.setContentSize(Vector2.create(nextWidth, nextHeight));
		}
		this.rebuildInspector();
		this.refreshStatus();
	}

	//==============================================================================
	// 마우스 뗌.
	//==============================================================================
	handlePointerUp() {
		this.#dragMode = "none";
		this.#activeHandle = null;
		this.#snapGuideList = [];
	}

	//==============================================================================
	// 커서 모양 적용.
	//==============================================================================
	/**
	 * @param { Vector2 } pointerPosition
	 */
	applyCursor(pointerPosition) {
		const selectedNode = this.#selectedNode;
		if (selectedNode) {
			const handleDefinition = this.findHandleAt(selectedNode, pointerPosition);
			if (handleDefinition) {
				this.#editorCanvas.style.cursor = handleDefinition.cursor;
				return;
			}
		}
		const hitNode = this.findTopmostNodeAt(this.#documentRootNode, pointerPosition);
		this.#editorCanvas.style.cursor = hitNode ? "move" : "default";
	}

	//==============================================================================
	// 손잡이 찾기.
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @param { Vector2 } pointerPosition
	 * @returns { object | null }
	 */
	findHandleAt(node, pointerPosition) {
		const worldBounds = node.getWorldBounds();
		const editorTransform = this.getEditorTransform();

		// 화면상 손잡이 크기를 문서 좌표로 환산하되, 얇은 노드에서 가운데까지 손잡이로 먹지 않도록 크기에 비례해 줄인다.
		const screenGrabDistance = HANDLE_SIZE / editorTransform.scale;
		const grabDistanceX = System.Math.max(2, System.Math.min(screenGrabDistance, worldBounds.width / 3));
		const grabDistanceY = System.Math.max(2, System.Math.min(screenGrabDistance, worldBounds.height / 3));
		for (const handleDefinition of RESIZE_HANDLE_DEFINITIONS) {
			const handleX = worldBounds.left + worldBounds.width * handleDefinition.ratioX;
			const handleY = worldBounds.top + worldBounds.height * handleDefinition.ratioY;
			if (System.Math.abs(pointerPosition.x - handleX) <= grabDistanceX && System.Math.abs(pointerPosition.y - handleY) <= grabDistanceY) {
				return handleDefinition;
			}
		}
		return null;
	}

	//==============================================================================
	// 같은 자리에 겹친 노드 가운데 지금 고른 것의 다음 것을 고른다.
	//==============================================================================
	/**
	 * @param { Vector2 } pointerPosition
	 */
	selectNextOverlappedNode(pointerPosition) {
		const overlappedList = [];
		this.collectNodesAt(this.#documentRootNode, pointerPosition, overlappedList);
		if (overlappedList.length === 0) {
			this.selectNode(null);
			return;
		}
		const currentIndex = overlappedList.indexOf(this.#selectedNode);
		const nextIndex = (currentIndex + 1) % overlappedList.length;
		this.selectNode(overlappedList[nextIndex]);
	}

	//==============================================================================
	// 좌표에 걸리는 노드를 앞에서 뒤 차례로 모은다.
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @param { Vector2 } pointerPosition
	 * @param { WorldNode[] } resultList
	 */
	collectNodesAt(node, pointerPosition, resultList) {
		const childNodeList = node.getChildren();
		for (let childIndex = childNodeList.length - 1; childIndex >= 0; --childIndex) {
			this.collectNodesAt(childNodeList[childIndex], pointerPosition, resultList);
		}
		const worldBounds = node.getWorldBounds();
		const isInside = pointerPosition.x >= worldBounds.left && pointerPosition.x <= worldBounds.left + worldBounds.width
			&& pointerPosition.y >= worldBounds.top && pointerPosition.y <= worldBounds.top + worldBounds.height;
		if (isInside && !this.isWidgetContentNode(node)) {
			resultList.push(node);
		}
	}

	//==============================================================================
	// 위젯이 스스로 만든 속 노드인지 검사. (편집 대상이 아니다)
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @returns { boolean }
	 */
	isWidgetContentNode(node) {
		if (node.getName().length === 0) {
			return true;
		}
		const parentNode = node.getParent();
		if (!parentNode) {
			return false;
		}
		for (const component of parentNode.getAllComponents()) {
			if (component instanceof UIView && component.getContent() === node) {
				return true;
			}
		}
		return false;
	}

	//==============================================================================
	// 좌표에 놓인 가장 위 노드 찾기.
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @param { Vector2 } pointerPosition
	 * @returns { WorldNode | null }
	 */
	findTopmostNodeAt(node, pointerPosition) {
		const childNodeList = node.getChildren();
		for (let childIndex = childNodeList.length - 1; childIndex >= 0; --childIndex) {
			const foundNode = this.findTopmostNodeAt(childNodeList[childIndex], pointerPosition);
			if (foundNode) {
				return foundNode;
			}
		}
		const worldBounds = node.getWorldBounds();
		const isInside = pointerPosition.x >= worldBounds.left && pointerPosition.x <= worldBounds.left + worldBounds.width
			&& pointerPosition.y >= worldBounds.top && pointerPosition.y <= worldBounds.top + worldBounds.height;
		if (isInside && this.isWidgetContentNode(node)) {
			return null;
		}
		return isInside ? node : null;
	}

	//==============================================================================
	// 스냅 적용.
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
		const parentSize = parentNode.getContentSize();
		const targetSize = targetNode.getContentSize();
		const verticalCandidates = [0, parentSize.x * 0.5, parentSize.x];
		const horizontalCandidates = [0, parentSize.y * 0.5, parentSize.y];
		for (const siblingNode of parentNode.getChildren()) {
			if (siblingNode === targetNode) {
				continue;
			}
			const siblingPosition = siblingNode.getLocalPosition();
			const siblingSize = siblingNode.getContentSize();
			verticalCandidates.push(siblingPosition.x, siblingPosition.x + siblingSize.x * 0.5, siblingPosition.x + siblingSize.x);
			horizontalCandidates.push(siblingPosition.y, siblingPosition.y + siblingSize.y * 0.5, siblingPosition.y + siblingSize.y);
		}
		const snappedX = this.findSnappedValue(desiredPosition.x, targetSize.x, verticalCandidates, "vertical");
		const snappedY = this.findSnappedValue(desiredPosition.y, targetSize.y, horizontalCandidates, "horizontal");
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
		const editorTransform = this.getEditorTransform();
		let bestDistance = SNAP_DISTANCE / editorTransform.scale;
		let bestValue = originValue;
		let bestGuide = -1;
		for (const edgeOffset of edgeOffsets) {
			for (const candidateValue of candidateList) {
				const distance = System.Math.abs(originValue + edgeOffset - candidateValue);
				if (distance < bestDistance) {
					bestDistance = distance;
					bestValue = candidateValue - edgeOffset;
					bestGuide = candidateValue;
				}
			}
		}
		if (bestGuide >= 0) {
			this.#snapGuideList.push({ axis: axisName, value: bestGuide });
		}
		return bestValue;
	}

	//==============================================================================
	// 단축키 연결.
	//==============================================================================
	bindKeyboardEvents() {
		System.window.addEventListener("keydown", (keyboardEvent) => {
			const isCommandKey = keyboardEvent.ctrlKey || keyboardEvent.metaKey;
			const loweredKey = keyboardEvent.key.toLowerCase();
			if (isCommandKey && loweredKey === "z") {
				if (keyboardEvent.shiftKey) {
					this.executeCommand("redo");
				}
				else {
					this.executeCommand("undo");
				}
				keyboardEvent.preventDefault();
				return;
			}
			if (isCommandKey && loweredKey === "d") {
				this.executeCommand("duplicate");
				keyboardEvent.preventDefault();
				return;
			}
			if (keyboardEvent.key === "F2" && this.#selectedNode) {
				const rowElement = this.findHierarchyRowElement(this.#selectedNode);
				if (rowElement) {
					this.beginRenameNode(rowElement, this.#selectedNode);
				}
				keyboardEvent.preventDefault();
				return;
			}
			if (keyboardEvent.key === "Delete") {
				this.executeCommand("deleteNode");
				keyboardEvent.preventDefault();
				return;
			}
			if (keyboardEvent.key.indexOf("Arrow") === 0 && this.#selectedNode) {
				const moveAmount = keyboardEvent.shiftKey ? 10 : 1;
				const localPosition = this.#selectedNode.getLocalPosition();
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
				this.#selectedNode.setLocalPosition(Vector2.create(localPosition.x + moveX, localPosition.y + moveY));
				this.rebuildInspector();
				this.refreshStatus();
				keyboardEvent.preventDefault();
			}
		});
	}

	//==============================================================================
	// 우클릭 메뉴.
	//==============================================================================
	/**
	 * @param { number } clientX
	 * @param { number } clientY
	 */
	openContextMenu(clientX, clientY) {
		this.openMenuPanelAt(clientX, clientY, [
			{ id: "duplicate", label: "Duplicate", shortcut: "Ctrl+D" },
			{ id: "deleteNode", label: "Delete", shortcut: "Delete" },
			{ separator: true },
			{ id: "bringToFront", label: "Bring to Front" },
			{ id: "sendToBack", label: "Send to Back" },
		]);
	}

	//==============================================================================
	// 명령 실행.
	//==============================================================================
	/**
	 * @param { string } commandId
	 */
	executeCommand(commandId) {
		if (commandId === "newDocument") {
			this.pushUndoSnapshot();
			this.createDocument();
			this.rebuildHierarchy();
			this.rebuildInspector();
			this.refreshStatus();
		}
		else if (commandId === "save") {
			this.saveDocumentAs();
		}
		else if (commandId === "saveAs") {
			this.saveDocumentAs();
		}
		else if (commandId === "load") {
			this.loadDocument();
		}
		else if (commandId === "undo") {
			this.undoDocument();
		}
		else if (commandId === "redo") {
			this.redoDocument();
		}
		else if (commandId === "duplicate") {
			this.duplicateSelectedNode();
		}
		else if (commandId === "deleteNode") {
			this.deleteSelectedNode();
		}
		else if (commandId === "bringToFront" || commandId === "sendToBack") {
			this.reorderSelectedNode(commandId === "bringToFront");
		}
		else if (commandId === "showEditView") {
			this.setActiveView("edit");
		}
		else if (commandId === "showRenderView") {
			this.setActiveView("render");
		}
		else if (commandId === "zoomIn") {
			this.zoomByStep(ZOOM_STEP);
		}
		else if (commandId === "zoomOut") {
			this.zoomByStep(1 / ZOOM_STEP);
		}
		else if (commandId === "zoomToFit") {
			this.#zoomScale = null;
			this.#panOffset = Vector2.zero();
			this.refreshStatus();
		}
		else if (commandId === "zoomActualSize") {
			const canvasRect = this.#editorCanvas.getBoundingClientRect();
			this.setZoomScale(1, canvasRect.left + canvasRect.width * 0.5, canvasRect.top + canvasRect.height * 0.5);
		}
		else if (commandId === "toggleGrid") {
			this.#isGridVisible = !this.#isGridVisible;
		}
		else if (commandId === "renderScaleActual") {
			this.#renderScaleMode = "actual";
			this.setActiveView("render");
		}
		else if (commandId === "renderScaleFit") {
			this.#renderScaleMode = "fit";
			this.setActiveView("render");
		}
		else if (commandId === "renderScaleStretch") {
			this.#renderScaleMode = "stretch";
			this.setActiveView("render");
		}
	}

	//==============================================================================
	// 메뉴 항목의 선택 표시 여부.
	//==============================================================================
	/**
	 * @param { string } commandId
	 * @returns { boolean }
	 */
	isCommandChecked(commandId) {
		if (commandId === "showEditView") {
			return this.#activeViewName === "edit";
		}
		if (commandId === "showRenderView") {
			return this.#activeViewName === "render";
		}
		if (commandId === "toggleGrid") {
			return this.#isGridVisible;
		}
		if (commandId === "renderScaleActual") {
			return this.#renderScaleMode === "actual";
		}
		if (commandId === "renderScaleFit") {
			return this.#renderScaleMode === "fit";
		}
		if (commandId === "renderScaleStretch") {
			return this.#renderScaleMode === "stretch";
		}
		return false;
	}

	//==============================================================================
	// 요소 추가.
	//==============================================================================
	/**
	 * @param { string } widgetKind
	 */
	addWidgetNode(widgetKind, dropPosition) {
		this.pushUndoSnapshot();
		this.#nodeSerialNumber += 1;

		// 노드 자체가 위젯인 종류는 그 노드로 만든다.
		let newNode = null;
		if (widgetKind === "inputField") {
			newNode = new UIInputField();
		}
		else if (widgetKind === "scrollBar") {
			newNode = new UIScrollBar();
		}
		else {
			newNode = new WorldNode();
		}
		newNode.setPivot(Pivot.topLeft.clone());
		newNode.setAnchor(Pivot.topLeft.clone());
		newNode.setLocalPosition(Vector2.create(60, 60));

		if (widgetKind === "text") {
			newNode.setName("Label" + this.#nodeSerialNumber);
			newNode.setContentSize(Vector2.create(200, 36));
			const label = newNode.addComponent(UILabel);
			label.setText("Label");
			label.setFontSize(20);
			label.setTextColor(new Color(0.231, 0.208, 0.141, 1));
		}
		else if (widgetKind === "button") {
			newNode.setName("Button" + this.#nodeSerialNumber);
			newNode.setContentSize(Vector2.create(180, 52));
			newNode.setInteractable(true);
			const paint = newNode.addComponent(Paint);
			paint.setColor(new Color(0.831, 0.745, 0.420, 1));
			paint.setRoundSize(6);
			newNode.addComponent(UIButton);
			const label = newNode.addComponent(UILabel);
			label.setText("Button");
			label.setFontSize(18);
			label.setTextColor(new Color(0.231, 0.208, 0.141, 1));
		}
		else if (widgetKind === "scrollView") {
			newNode.setName("ScrollView" + this.#nodeSerialNumber);
			newNode.setContentSize(Vector2.create(320, 220));
			newNode.setInteractable(true);
			const paint = newNode.addComponent(Paint);
			paint.setColor(new Color(0.949, 0.918, 0.800, 1));
			paint.setRoundSize(4);
			const scrollView = newNode.addComponent(UIScrollView);
			scrollView.setScrollContentSize(Vector2.create(320, 660));
		}
		else if (widgetKind === "progress") {
			newNode.setName("Progress" + this.#nodeSerialNumber);
			newNode.setContentSize(Vector2.create(260, 20));
			const progressView = newNode.addComponent(UIProgressView);
			progressView.setRange(0, 1);
			progressView.setValue(0.6);
		}
		else if (widgetKind === "slider") {
			newNode.setName("Slider" + this.#nodeSerialNumber);
			newNode.setContentSize(Vector2.create(260, 28));
			newNode.setInteractable(true);
			newNode.addComponent(UISlider);
		}
		else if (widgetKind === "divider") {
			newNode.setName("Divider" + this.#nodeSerialNumber);
			newNode.setContentSize(Vector2.create(260, 1));
			const paint = newNode.addComponent(Paint);
			paint.setColor(new Color(0.788, 0.706, 0.549, 1));
		}
		else if (widgetKind === "richText") {
			newNode.setName("RichText" + this.#nodeSerialNumber);
			newNode.setContentSize(Vector2.create(240, 40));
			const richText = newNode.addComponent(RichText);
			richText.setText("Rich Text");
			richText.setFontSize(18);
		}
		else if (widgetKind === "image") {
			newNode.setName("Image" + this.#nodeSerialNumber);
			newNode.setContentSize(Vector2.create(160, 160));
			const paint = newNode.addComponent(Paint);
			paint.setColor(new Color(0.902, 0.855, 0.694, 1));
			newNode.addComponent(UIImageView);
		}
		else if (widgetKind === "toggleButton") {
			newNode.setName("Toggle" + this.#nodeSerialNumber);
			newNode.setContentSize(Vector2.create(180, 52));
			newNode.setInteractable(true);
			const paint = newNode.addComponent(Paint);
			paint.setColor(new Color(0.831, 0.745, 0.420, 1));
			paint.setRoundSize(6);
			newNode.addComponent(UIToggleButton);
			const label = newNode.addComponent(UILabel);
			label.setText("Toggle");
			label.setFontSize(18);
			label.setTextColor(new Color(0.231, 0.208, 0.141, 1));
		}
		else if (widgetKind === "inputField") {
			newNode.setName("InputField" + this.#nodeSerialNumber);
			newNode.setContentSize(Vector2.create(260, 40));
			newNode.setInteractable(true);
		}
		else if (widgetKind === "snapScrollView") {
			newNode.setName("SnapScrollView" + this.#nodeSerialNumber);
			newNode.setContentSize(Vector2.create(320, 220));
			newNode.setInteractable(true);
			const paint = newNode.addComponent(Paint);
			paint.setColor(new Color(0.949, 0.918, 0.800, 1));
			paint.setRoundSize(4);
			const snapScrollView = newNode.addComponent(UISnapScrollView);
			snapScrollView.setScrollContentSize(Vector2.create(960, 220));
		}
		else if (widgetKind === "scrollBar") {
			newNode.setName("ScrollBar" + this.#nodeSerialNumber);
			newNode.setContentSize(Vector2.create(12, 220));
			newNode.setInteractable(true);
		}
		else if (widgetKind === "empty") {
			newNode.setName("Node" + this.#nodeSerialNumber);
			newNode.setContentSize(Vector2.create(120, 80));
		}
		else if (widgetKind === "mask") {
			newNode.setName("Mask" + this.#nodeSerialNumber);
			newNode.setContentSize(Vector2.create(240, 180));
			newNode.addComponent(Mask);
		}
		else {
			newNode.setName("Panel" + this.#nodeSerialNumber);
			newNode.setContentSize(Vector2.create(220, 140));
			const paint = newNode.addComponent(Paint);
			paint.setColor(new Color(0.902, 0.855, 0.694, 1));
			paint.setRoundSize(4);
		}

		let parentNode = this.findContainerNodeFor(this.#selectedNode);
		if (dropPosition) {
			const hitNode = this.findTopmostNodeAt(this.#documentRootNode, dropPosition);
			parentNode = this.findContainerNodeFor(hitNode);
		}
		parentNode.addChild(newNode);

		if (dropPosition) {
			// 놓은 자리를 가운데로 삼는다.
			const contentSize = newNode.getContentSize();
			newNode.setPosition(Vector2.create(dropPosition.x - contentSize.x * 0.5, dropPosition.y - contentSize.y * 0.5));
		}
		else {
			// 같은 자리에 겹쳐 쌓이지 않도록 형제 수만큼 어긋나게 놓는다.
			const siblingCount = parentNode.getChildren().length - 1;
			const cascadeOffset = (siblingCount % 8) * 20;
			newNode.setLocalPosition(Vector2.create(60 + cascadeOffset, 60 + cascadeOffset));
		}

		this.rebuildHierarchy();
		this.selectNode(newNode);
	}

	//==============================================================================
	// 새 노드를 담을 부모 찾기. (컨테이너면 그 안, 위젯이면 그 형제로)
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @returns { WorldNode }
	 */
	findContainerNodeFor(node) {
		if (!node) {
			return this.#documentRootNode;
		}
		if (node === this.#documentRootNode) {
			return node;
		}
		const componentList = node.getAllComponents();
		const hasScrollView = componentList.some((component) => component instanceof UIScrollView);
		if (hasScrollView) {
			return node;
		}
		const hasWidget = componentList.some((component) => component instanceof UIView);
		if (!hasWidget) {
			return node;
		}
		const parentNode = node.getParent();
		return parentNode ? parentNode : this.#documentRootNode;
	}

	//==============================================================================
	// 선택.
	//==============================================================================
	/**
	 * @param { WorldNode | null } node
	 */
	selectNode(node) {
		this.#selectedNode = node;
		this.refreshHierarchySelection();
		this.rebuildInspector();
		this.refreshStatus();
	}

	//==============================================================================
	// 계층에서 고른 줄 표시만 갈아 준다.
	// - 줄을 다시 만들면 두 번 누르기가 성립하지 않으므로 표시만 손댄다.
	//==============================================================================
	refreshHierarchySelection() {
		for (const [rowElement, mappedNode] of this.#hierarchyRowNodeMap) {
			const isSelectedRow = (mappedNode === this.#selectedNode);
			rowElement.dataset.selected = isSelectedRow ? "true" : "false";
			rowElement.style.backgroundColor = isSelectedRow ? PaneTheme.color.accent : "transparent";
			const rowTextColor = isSelectedRow ? SELECTED_ROW_TEXT_COLOR : PaneTheme.color.text;
			rowElement.style.color = rowTextColor;
			rowElement.children[0].style.color = isSelectedRow ? SELECTED_ROW_TEXT_COLOR : SELECTION_COLOR;
			rowElement.children[1].style.color = rowTextColor;
		}
	}

	//==============================================================================
	// 계층 목록 재구성.
	//==============================================================================
	rebuildHierarchy() {
		const treeElement = this.#hierarchyTreeElement;
		if (!treeElement) {
			return;
		}
		treeElement.innerHTML = "";
		this.#hierarchyRowNodeMap = new System.Map();
		const flatList = [];
		this.collectHierarchyRows(this.#documentRootNode, 0, flatList);
		for (const entry of flatList) {
			const rowElement = this.createListRowElement(this.findNodeGlyph(entry.node), entry.node.getName());
			rowElement.style.paddingLeft = (10 + entry.depth * 16) + "px";
			if (entry.node === this.#selectedNode) {
				rowElement.dataset.selected = "true";
				rowElement.style.backgroundColor = PaneTheme.color.accent;
				rowElement.style.color = SELECTED_ROW_TEXT_COLOR;
				for (const childElement of rowElement.children) {
					childElement.style.color = SELECTED_ROW_TEXT_COLOR;
				}
			}
			rowElement.addEventListener("click", () => {
				this.selectNode(entry.node);
			});
			rowElement.addEventListener("dblclick", (mouseEvent) => {
				mouseEvent.preventDefault();
				mouseEvent.stopPropagation();
				this.beginRenameNode(rowElement, entry.node);
			});
			rowElement.addEventListener("contextmenu", (mouseEvent) => {
				mouseEvent.preventDefault();
				mouseEvent.stopPropagation();
				this.selectNode(entry.node);
				this.openHierarchyContextMenu(mouseEvent.clientX, mouseEvent.clientY, entry.node);
			});
			this.bindHierarchyDragEvents(rowElement, entry.node);
			this.#hierarchyRowNodeMap.set(rowElement, entry.node);
			treeElement.appendChild(rowElement);
		}

		this.bindHierarchyTreeEvents(treeElement);
	}

	//==============================================================================
	// 노드가 놓인 계층 줄 찾기.
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @returns { HTMLElement | null }
	 */
	findHierarchyRowElement(node) {
		for (const [rowElement, mappedNode] of this.#hierarchyRowNodeMap) {
			if (mappedNode === node) {
				return rowElement;
			}
		}
		return null;
	}

	//==============================================================================
	// 계층 영역 자체의 조작. (목록을 다시 만들어도 한 번만 붙인다)
	//==============================================================================
	/**
	 * @param { HTMLElement } treeElement
	 */
	bindHierarchyTreeEvents(treeElement) {
		if (treeElement.dataset.eventsBound === "true") {
			return;
		}
		treeElement.dataset.eventsBound = "true";

		// 빈 자리를 누르면 고른 것을 푼다.
		treeElement.addEventListener("mousedown", (mouseEvent) => {
			if (mouseEvent.target === treeElement) {
				this.selectNode(null);
			}
		});

		// 빈 자리에 놓으면 문서 뿌리에 붙인다.
		treeElement.addEventListener("dragover", (dragEvent) => {
			dragEvent.preventDefault();
			dragEvent.dataTransfer.dropEffect = this.readDropEffect(dragEvent);
		});
		treeElement.addEventListener("drop", (dragEvent) => {
			dragEvent.preventDefault();
			this.handleHierarchyDrop(dragEvent, this.#documentRootNode, "inside");
		});
	}

	//==============================================================================
	// 끌고 온 것에 맞는 놓기 방식. (팔레트는 복사, 계층은 옮김)
	//==============================================================================
	/**
	 * @param { DragEvent } dragEvent
	 * @returns { string }
	 */
	readDropEffect(dragEvent) {
		const effectAllowed = dragEvent.dataTransfer.effectAllowed;
		if (effectAllowed === "copy") {
			return "copy";
		}
		return "move";
	}

	//==============================================================================
	// 계층 줄에서 이름 고치기. (줄을 입력칸으로 바꾼다)
	//==============================================================================
	/**
	 * @param { HTMLElement } rowElement
	 * @param { WorldNode } node
	 */
	beginRenameNode(rowElement, node) {
		const labelElement = rowElement.children[1];
		if (!labelElement) {
			return;
		}
		const inputElement = System.document.createElement("input");
		inputElement.type = "text";
		inputElement.value = node.getName();
		inputElement.style.cssText = "flex:1;min-width:0;background:" + PaneTheme.color.inputBg
			+ ";border:1px solid " + SELECTION_COLOR + ";color:" + PaneTheme.color.text
			+ ";font-size:14px;padding:1px 4px;border-radius:2px;outline:none;";
		labelElement.style.display = "none";
		rowElement.insertBefore(inputElement, labelElement);
		rowElement.draggable = false;
		inputElement.focus();
		inputElement.select();

		let isFinished = false;
		const finishRename = (isAccepted) => {
			if (isFinished) {
				return;
			}
			isFinished = true;
			const inputText = inputElement.value.trim();
			inputElement.remove();
			labelElement.style.display = "";
			rowElement.draggable = (node !== this.#documentRootNode);
			if (!isAccepted || inputText.length === 0 || inputText === node.getName()) {
				return;
			}
			this.pushUndoSnapshot();
			node.setName(inputText);
			this.rebuildHierarchy();
			this.rebuildInspector();
			this.refreshStatus();
		};
		inputElement.addEventListener("keydown", (keyboardEvent) => {
			keyboardEvent.stopPropagation();
			if (keyboardEvent.key === "Enter") {
				finishRename(true);
			}
			else if (keyboardEvent.key === "Escape") {
				finishRename(false);
			}
		});
		inputElement.addEventListener("blur", () => {
			finishRename(true);
		});
		inputElement.addEventListener("mousedown", (mouseEvent) => {
			mouseEvent.stopPropagation();
		});
	}

	//==============================================================================
	// 계층 줄의 끌어 놓기 처리.
	//==============================================================================
	/**
	 * @param { HTMLElement } rowElement
	 * @param { WorldNode } node
	 */
	bindHierarchyDragEvents(rowElement, node) {
		if (node !== this.#documentRootNode) {
			rowElement.draggable = true;
			rowElement.addEventListener("dragstart", (dragEvent) => {
				dragEvent.dataTransfer.setData("text/plain", HIERARCHY_DRAG_PREFIX + this.findNodePath(node));
				dragEvent.dataTransfer.effectAllowed = "move";
				dragEvent.stopPropagation();
			});
		}
		rowElement.addEventListener("dragover", (dragEvent) => {
			dragEvent.preventDefault();
			dragEvent.stopPropagation();
			dragEvent.dataTransfer.dropEffect = this.readDropEffect(dragEvent);
			const rowRect = rowElement.getBoundingClientRect();
			const dropKind = this.readHierarchyDropKind(dragEvent.clientY, rowRect);
			if (dropKind === "inside") {
				rowElement.style.backgroundColor = MENU_HOVER_COLOR;
				rowElement.style.borderTop = "1px solid transparent";
				rowElement.style.borderBottom = "1px solid transparent";
			}
			else {
				rowElement.style.borderTop = (dropKind === "before") ? "1px solid " + SELECTION_COLOR : "1px solid transparent";
				rowElement.style.borderBottom = (dropKind === "after") ? "1px solid " + SELECTION_COLOR : "1px solid transparent";
			}
		});
		rowElement.addEventListener("dragleave", () => {
			rowElement.style.borderTop = "1px solid transparent";
			rowElement.style.borderBottom = "1px solid transparent";
			if (rowElement.dataset.selected !== "true") {
				rowElement.style.backgroundColor = "transparent";
			}
		});
		rowElement.addEventListener("drop", (dragEvent) => {
			dragEvent.preventDefault();
			dragEvent.stopPropagation();
			const rowRect = rowElement.getBoundingClientRect();
			const dropKind = this.readHierarchyDropKind(dragEvent.clientY, rowRect);
			this.handleHierarchyDrop(dragEvent, node, dropKind);
		});
	}

	//==============================================================================
	// 줄의 어느 위치에 놓았는지 판정. (위 / 안 / 아래)
	//==============================================================================
	/**
	 * @param { number } clientY
	 * @param { DOMRect } rowRect
	 * @returns { string }
	 */
	readHierarchyDropKind(clientY, rowRect) {
		const localRatio = (clientY - rowRect.top) / rowRect.height;
		if (localRatio < 0.28) {
			return "before";
		}
		if (localRatio > 0.72) {
			return "after";
		}
		return "inside";
	}

	//==============================================================================
	// 계층에 놓았을 때 처리. (팔레트에서 오면 생성, 계층에서 오면 부모 바꾸기)
	//==============================================================================
	/**
	 * @param { DragEvent } dragEvent
	 * @param { WorldNode } targetNode
	 * @param { string } dropKind
	 */
	handleHierarchyDrop(dragEvent, targetNode, dropKind) {
		const transferText = dragEvent.dataTransfer.getData("text/plain");
		if (transferText.indexOf(PALETTE_DRAG_PREFIX) === 0) {
			const widgetKind = transferText.substring(PALETTE_DRAG_PREFIX.length);
			const parentNode = (dropKind === "inside") ? targetNode : targetNode.getParent();
			this.selectNode(parentNode ? parentNode : this.#documentRootNode);
			this.addWidgetNode(widgetKind);
			this.rebuildHierarchy();
			return;
		}
		if (transferText.indexOf(HIERARCHY_DRAG_PREFIX) !== 0) {
			return;
		}
		const movedNode = this.findNodeByPath(transferText.substring(HIERARCHY_DRAG_PREFIX.length));
		if (!movedNode || movedNode === targetNode || this.isAncestorNode(movedNode, targetNode)) {
			this.rebuildHierarchy();
			return;
		}
		const parentNode = (dropKind === "inside") ? targetNode : targetNode.getParent();
		if (!parentNode) {
			this.rebuildHierarchy();
			return;
		}
		this.pushUndoSnapshot();
		const worldPosition = movedNode.getPosition();
		parentNode.addChild(movedNode);
		movedNode.setPosition(worldPosition);
		if (dropKind !== "inside") {
			const siblingList = parentNode.getChildren();
			const targetIndex = siblingList.indexOf(targetNode);
			const nextIndex = (dropKind === "before") ? targetIndex : targetIndex + 1;
			movedNode.setSiblingIndex(System.Math.max(0, nextIndex));
		}
		this.rebuildHierarchy();
		this.rebuildInspector();
		this.refreshStatus();
	}

	//==============================================================================
	// 어떤 노드가 다른 노드의 조상인지 검사.
	//==============================================================================
	/**
	 * @param { WorldNode } ancestorNode
	 * @param { WorldNode } node
	 * @returns { boolean }
	 */
	isAncestorNode(ancestorNode, node) {
		let currentNode = node;
		while (currentNode) {
			if (currentNode === ancestorNode) {
				return true;
			}
			currentNode = currentNode.getParent();
		}
		return false;
	}

	//==============================================================================
	// 노드 위치를 자식 번호 경로로 나타낸다. (끌어 놓기에서 노드를 다시 찾기 위해 쓴다)
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @returns { string }
	 */
	findNodePath(node) {
		const indexList = [];
		let currentNode = node;
		while (currentNode && currentNode !== this.#documentRootNode) {
			const parentNode = currentNode.getParent();
			if (!parentNode) {
				break;
			}
			indexList.unshift(parentNode.getChildren().indexOf(currentNode));
			currentNode = parentNode;
		}
		return indexList.join(".");
	}

	//==============================================================================
	// 자식 번호 경로로 노드 찾기.
	//==============================================================================
	/**
	 * @param { string } pathText
	 * @returns { WorldNode | null }
	 */
	findNodeByPath(pathText) {
		if (pathText.length === 0) {
			return this.#documentRootNode;
		}
		let currentNode = this.#documentRootNode;
		for (const indexText of pathText.split(".")) {
			const childList = currentNode.getChildren();
			const childIndex = System.Number(indexText);
			if (!childList[childIndex]) {
				return null;
			}
			currentNode = childList[childIndex];
		}
		return currentNode;
	}

	//==============================================================================
	// 계층 전용 오른쪽 단추 메뉴.
	//==============================================================================
	/**
	 * @param { number } clientX
	 * @param { number } clientY
	 * @param { WorldNode } node
	 */
	openHierarchyContextMenu(clientX, clientY, node) {
		const isRootNode = (node === this.#documentRootNode);
		const menuItems = [];
		menuItems.push({
			id: "addChildPanel",
			label: "Add Child",
			action: () => {
				this.selectNode(node);
				this.openAddWidgetMenu(clientX + 12, clientY + 12);
			},
		});
		menuItems.push({
			id: "addComponentHere",
			label: "Add Component...",
			action: () => {
				this.selectNode(node);
				this.openAddComponentMenu(clientX + 12, clientY + 12);
			},
		});
		if (!isRootNode) {
			menuItems.push({ separator: true });
			menuItems.push({ id: "duplicate", label: "Duplicate", shortcut: "Ctrl+D" });
			menuItems.push({ id: "deleteNode", label: "Delete", shortcut: "Delete" });
			menuItems.push({ separator: true });
			menuItems.push({ id: "bringToFront", label: "Bring to Front" });
			menuItems.push({ id: "sendToBack", label: "Send to Back" });
			menuItems.push({ separator: true });
			menuItems.push({
				id: "unparentNode",
				label: "Move to Root",
				action: () => {
					const parentNode = node.getParent();
					if (!parentNode || parentNode === this.#documentRootNode) {
						return;
					}
					this.pushUndoSnapshot();
					const worldPosition = node.getPosition();
					this.#documentRootNode.addChild(node);
					node.setPosition(worldPosition);
					this.rebuildHierarchy();
					this.rebuildInspector();
				},
			});
		}
		menuItems.push({ separator: true });
		menuItems.push({
			id: "renameNode",
			label: "Rename",
			shortcut: "F2",
			action: () => {
				const rowElement = this.findHierarchyRowElement(node);
				if (rowElement) {
					this.beginRenameNode(rowElement, node);
				}
			},
		});
		this.openMenuPanelAt(clientX, clientY, menuItems);
	}

	//==============================================================================
	// 자식 추가 메뉴. (팔레트와 같은 목록)
	//==============================================================================
	/**
	 * @param { number } clientX
	 * @param { number } clientY
	 */
	openAddWidgetMenu(clientX, clientY) {
		const menuItems = [];
		for (const definition of PALETTE_DEFINITIONS) {
			menuItems.push({
				id: "addWidget." + definition.id,
				label: definition.label,
				action: () => {
					this.addWidgetNode(definition.id);
					this.rebuildHierarchy();
				},
			});
		}
		this.openMenuPanelAt(clientX, clientY, menuItems);
	}

	//==============================================================================
	// 계층 행 수집. (위젯 내부 content 는 건너뛰고 그 자식만 올린다)
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @param { number } depth
	 * @param { object[] } outputList
	 */
	collectHierarchyRows(node, depth, outputList) {
		outputList.push({ node: node, depth: depth });
		const contentNodeSet = new System.Set();
		for (const component of node.getAllComponents()) {
			if (typeof component.getContent === "function") {
				const contentNode = component.getContent();
				if (contentNode) {
					contentNodeSet.add(contentNode);
				}
			}
		}
		for (const childNode of node.getChildren()) {
			if (contentNodeSet.has(childNode)) {
				for (const grandChildNode of childNode.getChildren()) {
					this.collectHierarchyRows(grandChildNode, depth + 1, outputList);
				}
				continue;
			}

			// 위젯이 제 안에서 만든 노드는 이름을 붙이지 않는다. 편집 대상이 아니므로 감춘다.
			if (childNode.getName().length === 0) {
				continue;
			}
			this.collectHierarchyRows(childNode, depth + 1, outputList);
		}
	}

	//==============================================================================
	// 노드 기호.
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @returns { string }
	 */
	findNodeGlyph(node) {
		return this.findNodePaletteId(node);
	}

	//==============================================================================
	// 노드가 어느 팔레트 종류인지 되짚는다.
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @returns { string }
	 */
	findNodePaletteId(node) {
		const nodeTypeName = node.constructor.name;
		for (const lookupItem of NODE_KIND_LOOKUP) {
			if (lookupItem.typeName === nodeTypeName) {
				return lookupItem.paletteId;
			}
		}
		const componentNameSet = new System.Set();
		for (const component of node.getAllComponents()) {
			componentNameSet.add(component.constructor.name);
		}
		for (const lookupItem of NODE_KIND_LOOKUP) {
			if (componentNameSet.has(lookupItem.typeName)) {
				return lookupItem.paletteId;
			}
		}
		return "empty";
	}

	//==============================================================================
	// 인스펙터 재구성.
	//==============================================================================
	rebuildInspector() {
		const bodyElement = this.#inspectorBodyElement;
		if (!bodyElement) {
			return;
		}
		bodyElement.innerHTML = "";
		const selectedNode = this.#selectedNode;
		if (!selectedNode) {
			const emptyElement = PaneStyle.create("div", "", {
				text: "선택된 요소가 없습니다.",
				style: { position: "relative", width: "auto", height: "auto", padding: "12px 10px", fontSize: "13px", color: PaneTheme.color.textDim },
			});
			bodyElement.appendChild(emptyElement);
			return;
		}

		// 노드 자체의 공개 속성.
		bodyElement.appendChild(this.createInspectorGroupElement(selectedNode.constructor.name, null));
		this.appendTextRow(bodyElement, "Name", selectedNode.getName(), (inputText) => {
			selectedNode.setName(inputText);
			this.rebuildHierarchy();
			this.refreshStatus();
		});
		this.appendReflectedProperties(bodyElement, selectedNode);

		// 붙어 있는 컴포넌트 목록.
		const componentList = selectedNode.getAllComponents();
		const generatedTypeSet = UIDocument.collectGeneratedComponentTypes(componentList);
		for (const component of componentList) {
			const componentTypeName = component.constructor.name;
			if (generatedTypeSet.has(componentTypeName)) {
				continue;
			}
			bodyElement.appendChild(this.createInspectorGroupElement(componentTypeName, component));
			this.appendReflectedProperties(bodyElement, component);
		}

		bodyElement.appendChild(this.createAddComponentElement());
	}

	//==============================================================================
	// 대상의 편집 가능한 속성을 값 종류에 맞는 줄로 만든다.
	//==============================================================================
	/**
	 * @param { HTMLElement } bodyElement
	 * @param { object } targetObject
	 */
	appendReflectedProperties(bodyElement, targetObject) {
		const propertyList = collectEditableProperties(targetObject);
		for (const property of propertyList) {
			let currentValue = null;
			try {
				currentValue = targetObject[property.getterName]();
			}
			catch (exception) {
				continue;
			}
			const labelText = formatPropertyLabel(property.name);
			if (typeof currentValue === "number") {
				this.appendNumberRow(bodyElement, labelText, currentValue, 1, (value) => {
					targetObject[property.setterName](value);
					this.refreshStatus();
				});
			}
			else if (typeof currentValue === "string") {
				this.appendTextRow(bodyElement, labelText, currentValue, (inputText) => {
					targetObject[property.setterName](inputText);
				});
			}
			else if (typeof currentValue === "boolean") {
				this.appendBooleanRow(bodyElement, labelText, currentValue, (isChecked) => {
					targetObject[property.setterName](isChecked);
				});
			}
			else if (currentValue instanceof Color) {
				this.appendColorRow(bodyElement, labelText, currentValue, (color) => {
					targetObject[property.setterName](color);
				});
			}
			else if (currentValue instanceof Vector2) {
				this.appendVector2Row(bodyElement, labelText, currentValue, (vector) => {
					targetObject[property.setterName](vector);
					this.refreshStatus();
				});
			}
			else if (property.name.endsWith("Node")) {
				this.appendNodeReferenceRow(bodyElement, labelText, currentValue, (node) => {
					targetObject[property.setterName](node);
				});
			}
		}
	}

	//==============================================================================
	// 다른 노드를 가리키는 속성 줄.
	// - 문서에는 UI 뿌리 기준 절대 경로로 적힌다.
	//==============================================================================
	/**
	 * @param { HTMLElement } parentElement
	 * @param { string } labelText
	 * @param { WorldNode } currentNode
	 * @param { Function } changeHandler
	 */
	appendNodeReferenceRow(parentElement, labelText, currentNode, changeHandler) {
		const rowElement = this.createPropertyRowElement(parentElement, labelText);
		const buttonElement = PaneStyle.create("div", "", {
			text: currentNode ? UIDocument.findNodePath(this.#documentRootNode, currentNode) : "(none)",
			style: {
				position: "relative", width: "auto", height: "auto", flex: "1",
				padding: "3px 6px", fontSize: "13px",
				color: currentNode ? PaneTheme.color.text : PaneTheme.color.textDim,
				backgroundColor: PaneTheme.color.inputBg,
				border: "1px solid " + PaneTheme.color.border,
				borderRadius: "2px", cursor: "pointer",
				overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
			},
		});
		buttonElement.addEventListener("click", (mouseEvent) => {
			mouseEvent.stopPropagation();
			const buttonRect = buttonElement.getBoundingClientRect();
			const menuItems = [];
			menuItems.push({
				id: "clearNodeReference",
				label: "(none)",
				action: () => {
					this.pushUndoSnapshot();
					changeHandler(null);
					this.rebuildInspector();
				},
			});
			const flatList = [];
			this.collectHierarchyRows(this.#documentRootNode, 0, flatList);
			for (const entry of flatList) {
				if (entry.node === this.#documentRootNode) {
					continue;
				}
				menuItems.push({
					id: "pickNode." + entry.node.getName(),
					label: UIDocument.findNodePath(this.#documentRootNode, entry.node),
					action: () => {
						this.pushUndoSnapshot();
						changeHandler(entry.node);
						this.rebuildInspector();
					},
				});
			}
			this.openMenuPanelAt(buttonRect.left, buttonRect.bottom + 2, menuItems);
		});
		rowElement.appendChild(buttonElement);
	}

	//==============================================================================
	// 참 / 거짓 속성 줄.
	//==============================================================================
	/**
	 * @param { HTMLElement } parentElement
	 * @param { string } labelText
	 * @param { boolean } currentValue
	 * @param { Function } changeHandler
	 */
	appendBooleanRow(parentElement, labelText, currentValue, changeHandler) {
		const rowElement = this.createPropertyRowElement(parentElement, labelText);
		const checkElement = System.document.createElement("input");
		checkElement.type = "checkbox";
		checkElement.checked = currentValue;
		checkElement.style.cssText = "width:14px;height:14px;accent-color:" + SELECTION_COLOR + ";cursor:pointer;";
		checkElement.addEventListener("change", () => {
			this.pushUndoSnapshot();
			changeHandler(checkElement.checked);
		});
		rowElement.appendChild(checkElement);
	}

	//==============================================================================
	// 두 값 좌표 속성 줄.
	//==============================================================================
	/**
	 * @param { HTMLElement } parentElement
	 * @param { string } labelText
	 * @param { Vector2 } currentValue
	 * @param { Function } changeHandler
	 */
	appendVector2Row(parentElement, labelText, currentValue, changeHandler) {
		const rowElement = this.createPropertyRowElement(parentElement, labelText);
		const inputElementList = [];
		for (let axisIndex = 0; axisIndex < 2; ++axisIndex) {
			const inputElement = System.document.createElement("input");
			inputElement.type = "text";
			inputElement.value = this.composeNumberText((axisIndex === 0) ? currentValue.x : currentValue.y);
			inputElement.style.cssText = "flex:1;min-width:0;background:" + PaneTheme.color.inputBg + ";border:1px solid "
				+ PaneTheme.color.border + ";color:" + PaneTheme.color.text + ";font-size:13px;padding:3px 6px;border-radius:2px;";
			inputElement.addEventListener("change", () => {
				const parsedX = System.parseFloat(inputElementList[0].value);
				const parsedY = System.parseFloat(inputElementList[1].value);
				if (System.isNaN(parsedX) || System.isNaN(parsedY)) {
					return;
				}
				this.pushUndoSnapshot();
				changeHandler(Vector2.create(parsedX, parsedY));
			});
			inputElementList.push(inputElement);
			rowElement.appendChild(inputElement);
		}
	}

	//==============================================================================
	// 컴포넌트 추가 단추.
	//==============================================================================
	/**
	 * @returns { HTMLElement }
	 */
	createAddComponentElement() {
		const holderElement = PaneStyle.create("div", "", {
			style: { position: "relative", width: "auto", height: "auto", padding: "10px" },
		});
		const buttonElement = PaneStyle.create("div", "", {
			text: "+ Add Component",
			style: {
				position: "relative", width: "auto", height: "auto",
				padding: "6px 0", textAlign: "center",
				fontSize: "13px", color: PaneTheme.color.text,
				backgroundColor: PaneTheme.color.inputBg,
				border: "1px solid " + PaneTheme.color.border,
				borderRadius: "3px", cursor: "pointer", userSelect: "none",
			},
		});
		buttonElement.addEventListener("mouseenter", () => {
			buttonElement.style.backgroundColor = MENU_HOVER_COLOR;
		});
		buttonElement.addEventListener("mouseleave", () => {
			buttonElement.style.backgroundColor = PaneTheme.color.inputBg;
		});
		buttonElement.addEventListener("click", (mouseEvent) => {
			mouseEvent.stopPropagation();
			const buttonRect = buttonElement.getBoundingClientRect();
			this.openAddComponentMenu(buttonRect.left, buttonRect.bottom + 2);
		});
		holderElement.appendChild(buttonElement);
		return holderElement;
	}

	//==============================================================================
	// 컴포넌트 추가 메뉴 열기.
	//==============================================================================
	/**
	 * @param { number } clientX
	 * @param { number } clientY
	 */
	openAddComponentMenu(clientX, clientY) {
		const selectedNode = this.#selectedNode;
		if (!selectedNode) {
			return;
		}
		const menuItems = [];
		for (const classItem of collectComponentClassList()) {
			menuItems.push({
				id: "addComponent." + classItem.name,
				label: classItem.name,
				action: () => {
					this.pushUndoSnapshot();
					selectedNode.addComponent(classItem.componentClass);
					this.rebuildInspector();
					this.rebuildHierarchy();
				},
			});
		}
		this.openMenuPanelAt(clientX, clientY, menuItems);
	}

	//==============================================================================
	// 컴포넌트 제거.
	//==============================================================================
	/**
	 * @param { Component } component
	 */
	removeComponentFromSelectedNode(component) {
		const selectedNode = this.#selectedNode;
		if (!selectedNode) {
			return;
		}
		this.pushUndoSnapshot();
		selectedNode.removeComponent(component);
		this.rebuildInspector();
		this.rebuildHierarchy();
	}

	//==============================================================================
	// 인스펙터 그룹 제목.
	//==============================================================================
	/**
	 * @param { string } titleText
	 * @returns { HTMLElement }
	 */
	createInspectorGroupElement(titleText, component) {
		const groupElement = PaneStyle.create("div", "", {
			style: {
				position: "relative", width: "auto", height: "auto",
				display: "flex", alignItems: "center",
				padding: "6px 6px 6px 10px", marginTop: "2px",
				backgroundColor: PaneTheme.color.toolbar,
				borderTop: "1px solid " + PaneTheme.color.border,
				borderBottom: "1px solid " + PaneTheme.color.border,
			},
		});
		const titleElement = PaneStyle.create("span", "", {
			text: titleText,
			style: {
				position: "relative", width: "auto", height: "auto", flex: "1",
				fontSize: "12px", fontWeight: "bold", color: SELECTION_COLOR,
			},
		});
		groupElement.appendChild(titleElement);

		if (component) {
			const moreElement = PaneStyle.create("div", "", {
				text: "\u22EF",
				style: {
					position: "relative", width: "20px", height: "16px",
					display: "flex", alignItems: "center", justifyContent: "center",
					fontSize: "14px", color: PaneTheme.color.textDim,
					cursor: "pointer", borderRadius: "3px", userSelect: "none",
				},
			});
			moreElement.addEventListener("mouseenter", () => {
				moreElement.style.backgroundColor = MENU_HOVER_COLOR;
			});
			moreElement.addEventListener("mouseleave", () => {
				moreElement.style.backgroundColor = "transparent";
			});
			moreElement.addEventListener("click", (mouseEvent) => {
				mouseEvent.stopPropagation();
				const buttonRect = moreElement.getBoundingClientRect();
				this.openMenuPanelAt(buttonRect.right - 190, buttonRect.bottom + 2, [
					{
						id: "removeComponent",
						label: "Remove Component",
						action: () => {
							this.removeComponentFromSelectedNode(component);
						},
					},
				]);
			});
			groupElement.appendChild(moreElement);
		}
		return groupElement;
	}

	//==============================================================================
	// 속성 한 줄의 공통 틀.
	//==============================================================================
	/**
	 * @param { HTMLElement } parentElement
	 * @param { string } labelText
	 * @returns { HTMLElement }
	 */
	createPropertyRowElement(parentElement, labelText) {
		const rowElement = PaneStyle.create("div", "", {
			style: {
				position: "relative", width: "auto", height: "auto",
				display: "flex", alignItems: "center", gap: "8px", padding: "4px 10px",
			},
		});
		const labelElement = PaneStyle.create("span", "", {
			text: labelText,
			style: { position: "relative", width: "88px", height: "auto", fontSize: "13px", color: PaneTheme.color.text, flexShrink: "0" },
		});
		rowElement.appendChild(labelElement);
		parentElement.appendChild(rowElement);
		return rowElement;
	}

	//==============================================================================
	// 숫자 속성 줄. (직접 입력 + 라벨 좌우 끌기)
	//==============================================================================
	/**
	 * @param { HTMLElement } parentElement
	 * @param { string } labelText
	 * @param { number } currentValue
	 * @param { number } stepAmount
	 * @param { function(number): void } applyCallback
	 */
	appendNumberRow(parentElement, labelText, currentValue, stepAmount, applyCallback) {
		const rowElement = this.createPropertyRowElement(parentElement, labelText);
		const inputElement = PaneStyle.create("input", "input", { type: "text" });
		inputElement.style.position = "relative";
		inputElement.style.width = "100%";
		inputElement.value = this.composeNumberText(currentValue);

		const commitValue = () => {
			const parsedValue = System.Number(inputElement.value);
			if (System.Number.isFinite(parsedValue)) {
				this.pushUndoSnapshot();
				applyCallback(parsedValue);
				this.refreshStatus();
			}
			else {
				inputElement.value = this.composeNumberText(currentValue);
			}
		};
		inputElement.addEventListener("change", commitValue);
		inputElement.addEventListener("keydown", (keyboardEvent) => {
			if (keyboardEvent.key === "Enter") {
				inputElement.blur();
			}
			keyboardEvent.stopPropagation();
		});

		const labelElement = rowElement.firstChild;
		labelElement.style.cursor = "ew-resize";
		labelElement.addEventListener("mousedown", (mouseEvent) => {
			mouseEvent.preventDefault();
			const startX = mouseEvent.clientX;
			const startValue = System.Number(inputElement.value) || 0;
			this.pushUndoSnapshot();
			const onMouseMove = (moveEvent) => {
				let nextValue = startValue + (moveEvent.clientX - startX) * stepAmount;
				if (stepAmount >= 1) {
					nextValue = System.Math.round(nextValue);
				}
				inputElement.value = this.composeNumberText(nextValue);
				applyCallback(nextValue);
				this.refreshStatus();
			};
			const onMouseUp = () => {
				System.window.removeEventListener("mousemove", onMouseMove);
				System.window.removeEventListener("mouseup", onMouseUp);
			};
			System.window.addEventListener("mousemove", onMouseMove);
			System.window.addEventListener("mouseup", onMouseUp);
		});

		rowElement.appendChild(inputElement);
	}

	//==============================================================================
	// 글자 속성 줄.
	//==============================================================================
	/**
	 * @param { HTMLElement } parentElement
	 * @param { string } labelText
	 * @param { string } currentText
	 * @param { function(string): void } applyCallback
	 */
	appendTextRow(parentElement, labelText, currentText, applyCallback) {
		const rowElement = this.createPropertyRowElement(parentElement, labelText);
		const inputElement = PaneStyle.create("input", "input", { type: "text" });
		inputElement.style.position = "relative";
		inputElement.style.width = "100%";
		inputElement.value = currentText;
		inputElement.addEventListener("change", () => {
			this.pushUndoSnapshot();
			applyCallback(inputElement.value);
		});
		inputElement.addEventListener("keydown", (keyboardEvent) => {
			if (keyboardEvent.key === "Enter") {
				inputElement.blur();
			}
			keyboardEvent.stopPropagation();
		});
		rowElement.appendChild(inputElement);
	}

	//==============================================================================
	// 색상 속성 줄.
	//==============================================================================
	/**
	 * @param { HTMLElement } parentElement
	 * @param { string } labelText
	 * @param { Color } currentColor
	 * @param { function(Color): void } applyCallback
	 */
	appendColorRow(parentElement, labelText, currentColor, applyCallback) {
		const rowElement = this.createPropertyRowElement(parentElement, labelText);
		const colorInputElement = PaneStyle.create("input", "", { type: "color" });
		colorInputElement.style.cssText = "position:relative;width:34px;height:22px;padding:0;border:1px solid "
			+ PaneTheme.color.border + ";background:transparent;cursor:pointer;flex-shrink:0;";
		colorInputElement.value = currentColor.toHEXString().substring(0, 7);

		const alphaInputElement = PaneStyle.create("input", "input", { type: "text" });
		alphaInputElement.style.position = "relative";
		alphaInputElement.style.width = "100%";
		alphaInputElement.value = currentColor.alpha.toFixed(2);

		const commitColor = () => {
			const parsedColor = Color.createFromHEX(colorInputElement.value);
			const parsedAlpha = System.Number(alphaInputElement.value);
			if (parsedColor) {
				parsedColor.alpha = System.Number.isFinite(parsedAlpha) ? System.Math.max(0, System.Math.min(1, parsedAlpha)) : currentColor.alpha;
				this.pushUndoSnapshot();
				applyCallback(parsedColor);
			}
		};
		colorInputElement.addEventListener("input", commitColor);
		alphaInputElement.addEventListener("change", commitColor);
		alphaInputElement.addEventListener("keydown", (keyboardEvent) => {
			keyboardEvent.stopPropagation();
		});

		rowElement.appendChild(colorInputElement);
		rowElement.appendChild(alphaInputElement);
	}

	//==============================================================================
	// 숫자 표기.
	//==============================================================================
	/**
	 * @param { number } value
	 * @returns { string }
	 */
	composeNumberText(value) {
		const isInteger = System.Math.abs(value - System.Math.round(value)) < 0.0001;
		return isInteger ? String(System.Math.round(value)) : value.toFixed(2);
	}

	//==============================================================================
	// 상태줄 갱신.
	//==============================================================================
	refreshStatus() {
		if (!this.#statusTextElement) {
			return;
		}
		const selectedNode = this.#selectedNode;
		let statusText = "선택 없음";
		if (selectedNode) {
			const localPosition = selectedNode.getLocalPosition();
			const contentSize = selectedNode.getContentSize();
			const componentNameList = selectedNode.getAllComponents().map((component) => component.constructor.name);
			statusText = selectedNode.getName()
				+ "    X " + System.Math.round(localPosition.x) + "  Y " + System.Math.round(localPosition.y)
				+ "    W " + System.Math.round(contentSize.x) + "  H " + System.Math.round(contentSize.y);
			if (componentNameList.length > 0) {
				statusText += "    [" + componentNameList.join(", ") + "]";
			}
		}
		const documentSize = this.getDocumentSize();
		statusText += "        문서 " + System.Math.round(documentSize.x) + " x " + System.Math.round(documentSize.y);
		if (this.#activeViewName === "edit") {
			const editorTransform = this.#editorCanvas ? this.getEditorTransform() : { scale: 1 };
			statusText += "    배율 " + System.Math.round(editorTransform.scale * 100) + "%";
		}
		else {
			const renderModeText = { actual: "1:1 실제 크기", fit: "비율 맞춤", stretch: "늘려 채움" }[this.#renderScaleMode];
			statusText += "    결과 화면 " + renderModeText;
		}
		this.#statusTextElement.innerText = statusText;
	}

	//==============================================================================
	// 되돌리기 스냅샷 저장.
	//==============================================================================
	pushUndoSnapshot() {
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
		this.#redoStack.push(UIDocument.toJsonText(this.#documentRootNode, false));
		this.replaceDocument(this.#undoStack.pop());
	}

	//==============================================================================
	// 다시 실행.
	//==============================================================================
	redoDocument() {
		if (this.#redoStack.length === 0) {
			return;
		}
		this.#undoStack.push(UIDocument.toJsonText(this.#documentRootNode, false));
		this.replaceDocument(this.#redoStack.pop());
	}

	//==============================================================================
	// 문서 교체.
	//==============================================================================
	/**
	 * @param { string } jsonText
	 */
	replaceDocument(jsonText) {
		this.#documentRootNode = UIDocument.fromJsonText(jsonText);
		this.#documentRootNode.setPivot(Pivot.topLeft.clone());
		this.#documentRootNode.setAnchor(Pivot.topLeft.clone());
		this.#selectedNode = null;
		this.rebuildHierarchy();
		this.rebuildInspector();
		this.refreshStatus();
	}

	//==============================================================================
	// 복제.
	//==============================================================================
	duplicateSelectedNode() {
		const selectedNode = this.#selectedNode;
		if (!selectedNode || selectedNode === this.#documentRootNode) {
			return;
		}
		const parentNode = selectedNode.getParent();
		if (!parentNode) {
			return;
		}
		this.pushUndoSnapshot();
		const copiedNode = UIDocument.deserializeNode(UIDocument.serializeNode(selectedNode));
		this.#nodeSerialNumber += 1;
		copiedNode.setName(selectedNode.getName() + "_copy" + this.#nodeSerialNumber);
		const localPosition = selectedNode.getLocalPosition();
		copiedNode.setLocalPosition(Vector2.create(localPosition.x + 16, localPosition.y + 16));
		parentNode.addChild(copiedNode);
		this.rebuildHierarchy();
		this.selectNode(copiedNode);
	}

	//==============================================================================
	// 삭제.
	//==============================================================================
	deleteSelectedNode() {
		const selectedNode = this.#selectedNode;
		if (!selectedNode || selectedNode === this.#documentRootNode) {
			return;
		}
		const parentNode = selectedNode.getParent();
		if (!parentNode) {
			return;
		}
		this.pushUndoSnapshot();
		parentNode.removeChild(selectedNode);
		this.rebuildHierarchy();
		this.selectNode(null);
	}

	//==============================================================================
	// 그리는 순서 변경.
	//==============================================================================
	/**
	 * @param { boolean } isBringToFront
	 */
	reorderSelectedNode(isBringToFront) {
		const selectedNode = this.#selectedNode;
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
	}

	//==============================================================================
	// 저장.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	saveDocument(fileName) {
		const jsonText = UIDocument.toJsonText(this.#documentRootNode);
		const blob = new System.Blob([jsonText], { type: "application/json" });
		const objectUrl = System.URL.createObjectURL(blob);
		const anchorElement = System.document.createElement("a");
		anchorElement.href = objectUrl;
		anchorElement.download = fileName ? fileName : this.#documentFileName;
		System.document.body.appendChild(anchorElement);
		anchorElement.click();
		System.document.body.removeChild(anchorElement);
		System.URL.revokeObjectURL(objectUrl);
		return jsonText;
	}

	//==============================================================================
	// 다른 이름으로 저장. (이름을 물어본 뒤 내려받는다)
	//==============================================================================
	saveDocumentAs() {
		this.openInputDialog("다른 이름으로 저장", "파일 이름", this.#documentFileName, (inputText) => {
			let fileName = inputText.trim();
			if (fileName.length === 0) {
				return;
			}
			if (!fileName.endsWith(".json")) {
				fileName += ".uiasset.json";
			}
			this.#documentFileName = fileName;
			this.saveDocument(fileName);
			this.refreshStatus();
		});
	}

	//==============================================================================
	// 한 줄 입력 대화 상자.
	//==============================================================================
	/**
	 * @param { string } titleText
	 * @param { string } labelText
	 * @param { string } currentText
	 * @param { Function } acceptHandler
	 */
	openInputDialog(titleText, labelText, currentText, acceptHandler) {
		const existingDialog = System.document.getElementById("uieditorDialog");
		if (existingDialog) {
			existingDialog.remove();
		}
		const backdropElement = System.document.createElement("div");
		backdropElement.id = "uieditorDialog";
		backdropElement.style.cssText = "position:fixed;left:0;top:0;width:100%;height:100%;z-index:10000;"
			+ "background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;"
			+ "font-family:" + PaneTheme.font.family + ";";

		const panelElement = System.document.createElement("div");
		panelElement.style.cssText = "min-width:340px;padding:16px 18px 14px 18px;border-radius:6px;"
			+ "background:" + PaneTheme.color.panel + ";border:1px solid " + PaneTheme.color.border + ";"
			+ "box-shadow:0 10px 30px rgba(0,0,0,0.55);color:" + PaneTheme.color.text + ";";

		const titleElement = System.document.createElement("div");
		titleElement.innerText = titleText;
		titleElement.style.cssText = "font-size:14px;font-weight:bold;color:" + SELECTION_COLOR + ";margin-bottom:12px;";
		panelElement.appendChild(titleElement);

		const fieldLabelElement = System.document.createElement("div");
		fieldLabelElement.innerText = labelText;
		fieldLabelElement.style.cssText = "font-size:12px;color:" + PaneTheme.color.textDim + ";margin-bottom:4px;";
		panelElement.appendChild(fieldLabelElement);

		const inputElement = System.document.createElement("input");
		inputElement.type = "text";
		inputElement.value = currentText;
		inputElement.style.cssText = "width:100%;box-sizing:border-box;padding:6px 8px;font-size:14px;border-radius:3px;"
			+ "background:" + PaneTheme.color.inputBg + ";border:1px solid " + PaneTheme.color.border + ";"
			+ "color:" + PaneTheme.color.text + ";outline:none;";
		panelElement.appendChild(inputElement);

		const buttonRowElement = System.document.createElement("div");
		buttonRowElement.style.cssText = "display:flex;justify-content:flex-end;gap:8px;margin-top:14px;";
		const cancelElement = this.createDialogButtonElement("취소", false);
		const acceptElement = this.createDialogButtonElement("저장", true);
		buttonRowElement.appendChild(cancelElement);
		buttonRowElement.appendChild(acceptElement);
		panelElement.appendChild(buttonRowElement);

		backdropElement.appendChild(panelElement);
		System.document.body.appendChild(backdropElement);
		inputElement.focus();
		inputElement.select();

		const closeDialog = () => {
			backdropElement.remove();
		};
		cancelElement.addEventListener("click", closeDialog);
		acceptElement.addEventListener("click", () => {
			const inputText = inputElement.value;
			closeDialog();
			acceptHandler(inputText);
		});
		inputElement.addEventListener("keydown", (keyboardEvent) => {
			keyboardEvent.stopPropagation();
			if (keyboardEvent.key === "Enter") {
				const inputText = inputElement.value;
				closeDialog();
				acceptHandler(inputText);
			}
			else if (keyboardEvent.key === "Escape") {
				closeDialog();
			}
		});
		backdropElement.addEventListener("mousedown", (mouseEvent) => {
			if (mouseEvent.target === backdropElement) {
				closeDialog();
			}
		});
	}

	//==============================================================================
	// 대화 상자 단추.
	//==============================================================================
	/**
	 * @param { string } labelText
	 * @param { boolean } isPrimary
	 * @returns { HTMLElement }
	 */
	createDialogButtonElement(labelText, isPrimary) {
		const buttonElement = System.document.createElement("div");
		buttonElement.innerText = labelText;
		buttonElement.style.cssText = "padding:6px 16px;font-size:13px;border-radius:3px;cursor:pointer;user-select:none;"
			+ "border:1px solid " + PaneTheme.color.border + ";"
			+ (isPrimary
				? ("background:" + SELECTION_COLOR + ";color:" + SELECTED_ROW_TEXT_COLOR + ";border-color:" + SELECTION_COLOR + ";")
				: ("background:" + PaneTheme.color.inputBg + ";color:" + PaneTheme.color.text + ";"));
		return buttonElement;
	}

	//==============================================================================
	// 열기.
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
				this.pushUndoSnapshot();
				this.replaceDocument(fileReader.result);
			};
			fileReader.readAsText(selectedFile);
		});
		inputElement.click();
	}

	//==============================================================================
	// 문서 루트 반환. (검증용)
	//==============================================================================
	/**
	 * @returns { WorldNode }
	 */
	getDocumentRootNode() {
		return this.#documentRootNode;
	}

	//==============================================================================
	// 선택 노드 반환. (검증용)
	//==============================================================================
	/**
	 * @returns { WorldNode | null }
	 */
	getSelectedNode() {
		return this.#selectedNode;
	}
}


//==============================================================================
// 편집기 실행.
//==============================================================================
for (const colorName of System.Object.keys(VANILLA_THEME_COLORS)) {
	PaneTheme.color[colorName] = VANILLA_THEME_COLORS[colorName];
}
PaneTheme.size.resizer = 3;
PaneTheme.font.family = EDITOR_FONT_FAMILY;
PaneTheme.font.size = "14px";

// 스크롤 막대 모양을 편집기 하나로 맞춘다.
const editorStyleElement = System.document.createElement("style");
editorStyleElement.innerText = "* { scrollbar-width: thin; scrollbar-color: " + VANILLA_THEME_COLORS.border + " transparent; }"
	+ "::-webkit-scrollbar { width: 10px; height: 10px; }"
	+ "::-webkit-scrollbar-track { background: transparent; }"
	+ "::-webkit-scrollbar-thumb { background: " + VANILLA_THEME_COLORS.border + "; border-radius: 5px;"
	+ " border: 2px solid transparent; background-clip: padding-box; }"
	+ "::-webkit-scrollbar-thumb:hover { background: " + VANILLA_THEME_COLORS.accentHover + "; background-clip: padding-box; }"
	+ "::-webkit-scrollbar-corner { background: transparent; }";
System.document.head.appendChild(editorStyleElement);

// 엔진이 내보내는 노드와 컴포넌트를 문서 형식에 등록한다.
// 엔진을 올리면 새로 들어온 종류가 그대로 저장/복원 대상이 된다.
for (const exportName of System.Object.keys(Engine)) {
	const candidateType = Engine[exportName];
	if (typeof candidateType !== "function" || !candidateType.prototype) {
		continue;
	}
	if (candidateType.prototype instanceof Component) {
		UIDocument.registerComponentType(exportName, candidateType);
	}
	else if (candidateType === WorldNode || candidateType.prototype instanceof WorldNode) {
		UIDocument.registerNodeType(exportName, candidateType);
	}
}

const uiEditor = new UIEditor();
System.uiEditor = uiEditor;
System.document.title = "vanilla.js - UI Editor";
uiEditor.run();
