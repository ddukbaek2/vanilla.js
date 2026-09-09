//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Engine, EngineConfiguration } from "../../src/core/engine.js";
import { Scene } from "../../src/core/scene.js";
import { WorldNode } from "../../src/core/node/worldnode.js";
import { Vector2 } from "../../src/base/vector2.js";
import { Pivot } from "../../src/base/pivot.js";
import { Rect } from "../../src/base/rect.js";
import { ViewScaleMode } from "../../src/core/viewmanager.js";
import { ParticleSystem } from "../../src/effect/particlesystem.js";
import { ShaderSpriteEffect } from "../../src/effect/shadersprite.js";
import {
	Timeline, TIMELINE_EASING_NAMES, TIMELINE_PROPERTY_DEFINITIONS, TIMELINE_NODE_DEFAULTS, resolveTimelineEasing, parseTimelineColor, composeTimelineColor,
} from "../../src/experimental/animation/timeline.js";
import { Pane, PaneStyle, PaneTheme } from "../../src/web/pane.js";
import {
	EditorTheme, applyEditorTheme, setEditorCommandHandler, wrapEditorIconMarkup,
	openEditorMenuPanelAt, createEditorSectionElement, createEditorListRowElement, setEditorListRowSelected,
	createEditorHeaderButtonElement, setEditorHeaderButtonSelected, createEditorGroupElement, createEditorPropertyRowElement,
	appendEditorNumberRow, appendEditorTextRow, appendEditorColorRow, appendEditorBooleanRow, appendEditorSelectRow,
	createEditorButtonElement, buildEditorWindowLayout, openEditorInputDialog,
	EDITOR_ICON_SHAPES, createEditorHeaderIconElement, setEditorHeaderIconActive,
} from "../common/editorkit.js";
import {
	NODE_KIND_DEFINITIONS, ANIMATABLE_PROPERTY_TABLE, PROPERTY_DESCRIPTION_FIELD, EVENT_VALUE_TABLE,
	QUICK_EASING_DEFINITIONS, BEZIER_PRESET_DEFINITIONS, PARTICLE_PRESET_TABLE, composeParticleDescription,
	createNodeDescription, cloneDeep, createDefaultDocument,
} from "./timelinedocument.js";
import { TimelinePanel } from "./timelinepanel.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 목록에 쓰는 그림 아이콘. (14x14 기준, 색은 글자색을 따른다)
const ICON_SHAPES = {
	group: EDITOR_ICON_SHAPES.folder,
	paint: "<rect x='2' y='2.5' width='10' height='9' rx='1.5' fill='currentColor'/>",
	sprite: EDITOR_ICON_SHAPES.image,
	text: "<path d='M2.5 3h9M7 3v8.5M5 11.5h4' stroke='currentColor' stroke-width='1.6' fill='none' stroke-linecap='round'/>",
	particle: "<circle cx='7' cy='7' r='2.2' fill='currentColor'/><circle cx='3' cy='3.6' r='1.2' fill='currentColor' opacity='0.7'/><circle cx='11.2' cy='4.4' r='1' fill='currentColor' opacity='0.55'/><circle cx='10.4' cy='10.8' r='1.3' fill='currentColor' opacity='0.7'/><circle cx='3.4' cy='10.4' r='0.9' fill='currentColor' opacity='0.5'/>",
	sound: "<path d='M2.5 5.5h2.5l3-2.5v8l-3-2.5H2.5z' fill='currentColor'/><path d='M9.5 4.5c1.4 1.4 1.4 3.6 0 5M11 3c2.2 2.2 2.2 5.8 0 8' stroke='currentColor' stroke-width='1.2' fill='none' stroke-linecap='round'/>",
	audio: "<path d='M2.5 5.5h2.5l3-2.5v8l-3-2.5H2.5z' fill='currentColor'/>",
	key: "<path d='M7 1.8l5.2 5.2-5.2 5.2-5.2-5.2z' fill='currentColor'/>",
};

const UNDO_LIMIT = 64;
const PLAYBACK_SPEED_LIST = [0.25, 0.5, 1, 2];
const BLEND_MODE_LIST = ["source-over", "lighter", "multiply", "screen"];
const TEXT_ALIGN_LIST = ["left", "center", "right"];

// 메뉴 막대 구성. (일반 데스크톱 응용 프로그램과 같은 배치)
const MENU_DEFINITIONS = [
	{
		title: "File",
		items: [
			{ id: "newDocument", label: "New", shortcut: "Ctrl+Alt+N" },
			{ id: "load", label: "Open...", shortcut: "Ctrl+O" },
			{ id: "save", label: "Save", shortcut: "Ctrl+S" },
			{ id: "saveAs", label: "Save As...", shortcut: "Ctrl+Shift+S" },
			{ separator: true },
			{ id: "importImages", label: "Import Images..." },
			{ id: "importAudio", label: "Import Audio..." },
			{ separator: true },
			{ id: "copyUsage", label: "Copy Usage Code" },
		],
	},
	{
		title: "Edit",
		items: [
			{ id: "undo", label: "Undo", shortcut: "Ctrl+Z" },
			{ id: "redo", label: "Redo", shortcut: "Ctrl+Y" },
			{ separator: true },
			{ id: "cutKeys", label: "Cut Keys", shortcut: "Ctrl+X" },
			{ id: "copyKeys", label: "Copy Keys", shortcut: "Ctrl+C" },
			{ id: "pasteKeys", label: "Paste Keys at Playhead", shortcut: "Ctrl+V" },
			{ id: "selectAllKeys", label: "Select All Keys", shortcut: "Ctrl+A" },
			{ separator: true },
			{ id: "duplicateNode", label: "Duplicate Node", shortcut: "Ctrl+D" },
			{ id: "renameNode", label: "Rename Node..." },
			{ id: "deleteSelection", label: "Delete", shortcut: "Delete" },
		],
	},
	{
		title: "Track",
		items: [
			{ id: "addKey", label: "Add Key at Playhead", shortcut: "K" },
			{ id: "deleteKeys", label: "Delete Selected Keys" },
			{ id: "deleteTrack", label: "Delete Selected Track" },
			{ separator: true },
			{ id: "addMarker", label: "Add Marker at Playhead", shortcut: "M" },
			{ separator: true },
			{ id: "timeScaleKeys", label: "Time Scale Selected Keys..." },
			{ id: "reverseKeys", label: "Reverse Selected Keys" },
			{ id: "setDurationHere", label: "Set Duration at Playhead" },
		],
	},
	{
		title: "Playback",
		items: [
			{ id: "togglePlay", label: "Play / Pause", shortcut: "Space" },
			{ id: "stop", label: "Stop", shortcut: "Shift+Space" },
			{ id: "goToStart", label: "Go to Start", shortcut: "Home" },
			{ id: "goToEnd", label: "Go to End", shortcut: "End" },
			{ id: "previousFrame", label: "Previous Frame", shortcut: "←" },
			{ id: "nextFrame", label: "Next Frame", shortcut: "→" },
			{ separator: true },
			{ id: "toggleLoop", label: "Loop" },
			{ id: "speed.0.25", label: "Speed 0.25x" },
			{ id: "speed.0.5", label: "Speed 0.5x" },
			{ id: "speed.1", label: "Speed 1x" },
			{ id: "speed.2", label: "Speed 2x" },
		],
	},
	{
		title: "View",
		items: [
			{ id: "toggleGrid", label: "Show Grid", shortcut: "G" },
			{ id: "toggleSnap", label: "Snap to Frames" },
			{ id: "toggleCurves", label: "Show Curves", shortcut: "C" },
			{ id: "toggleAutoKey", label: "Auto Key (Record)", shortcut: "R" },
			{ separator: true },
			{ id: "zoomToFit", label: "Zoom Timeline to Fit", shortcut: "F" },
		],
	},
];


//==============================================================================
// 프리뷰 씬.
//==============================================================================
class PreviewScene extends Scene {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { Function } */ #createdEvent;
	/** @type { Function } */ #tickEvent;
	/** @type { Function } */ #backgroundEvent;
	/** @type { Function } */ #overlayEvent;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor(createdEvent, tickEvent, backgroundEvent, overlayEvent) {
		super();
		this.#createdEvent = createdEvent;
		this.#tickEvent = tickEvent;
		this.#backgroundEvent = backgroundEvent;
		this.#overlayEvent = overlayEvent;
	}

	//==============================================================================
	// 씬 구성.
	//==============================================================================
	create() {
		super.create();
		this.#createdEvent(this);
	}

	//==============================================================================
	// 바탕 그리기.
	//==============================================================================
	preDraw(graphic) {
		super.preDraw(graphic);
		this.#backgroundEvent(graphic);
	}

	//==============================================================================
	// 덧그리기.
	//==============================================================================
	postDraw(graphic) {
		super.postDraw(graphic);
		this.#overlayEvent(graphic);
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	tick(timeDelta) {
		super.tick(timeDelta);
		this.#tickEvent(timeDelta);
	}
}


//==============================================================================
// 타임라인 편집기.
// - 창 구성과 조작 UI 는 DOM(Pane) 으로 만들고, 프리뷰 화면만 엔진이 그린다.
// - 문서는 무대 노드 + 트랙(키프레임) + 마커로 이루어진 .timeline.json 이며 Timeline 런타임이 그대로 재생한다.
// - 유니티 타임라인 / 언리얼 시퀀서의 쓰임새: 노드별 묶음 트랙, 도프 시트 + 커브, 자동 키, 이벤트 / 사운드 트랙, 마커, 되돌리기.
//==============================================================================
class TimelineEditor {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object } */ #document;
	/** @private @type { Timeline | null } */ #timeline;
	/** @private @type { string } */ #fileName;
	/** @private @type { Engine | null } */ #engine;
	/** @private @type { WorldNode | null } */ #stageRootNode;
	/** @private @type { System.Map } */ #nodeTable;
	/** @private @type { object[] } */ #imageAssets;
	/** @private @type { object[] } */ #audioAssets;
	/** @private @type { System.Map } */ #imageElementTable;
	/** @private @type { string | null } */ #selectedNodeName;
	/** @private @type { object | null } */ #selectedTrack;
	/** @private @type { System.Set } */ #selectedKeys;
	/** @private @type { object | null } */ #selectedMarker;
	/** @private @type { number } */ #playhead;
	/** @private @type { boolean } */ #isPlaying;
	/** @private @type { number } */ #playbackSpeed;
	/** @private @type { boolean } */ #isAutoKey;
	/** @private @type { boolean } */ #isSnap;
	/** @private @type { boolean } */ #isCurveVisible;
	/** @private @type { boolean } */ #isGridVisible;
	/** @private @type { boolean } */ #isEditView;
	/** @private @type { string[] } */ #undoStack;
	/** @private @type { string[] } */ #redoStack;
	/** @private @type { object[] } */ #clipboardKeys;
	/** @private @type { TimelinePanel | null } */ #timelinePanel;
	/** @private @type { HTMLElement | null } */ #hierarchyListElement;
	/** @private @type { HTMLElement | null } */ #assetListElement;
	/** @private @type { HTMLElement | null } */ #inspectorBodyElement;
	/** @private @type { HTMLElement | null } */ #statusTextElement;
	/** @private @type { HTMLElement | null } */ #playButtonElement;
	/** @private @type { HTMLElement | null } */ #autoKeyButtonElement;
	/** @private @type { HTMLElement | null } */ #gridToggleElement;
	/** @private @type { HTMLElement | null } */ #viewToggleElement;
	/** @private @type { HTMLElement | null } */ #timeLabelElement;
	/** @private @type { HTMLCanvasElement | null } */ #previewCanvasElement;
	/** @private @type { HTMLInputElement | null } */ #fileInputElement;
	/** @private @type { HTMLInputElement | null } */ #imageInputElement;
	/** @private @type { HTMLInputElement | null } */ #audioInputElement;
	/** @private @type { object | null } */ #viewDragState;
	/** @private @type { boolean } */ #isInspectorDirty;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		this.#document = TimelineEditor.normalizeDocument(createDefaultDocument());
		this.#timeline = null;
		this.#fileName = "titlecard.timeline.json";
		this.#engine = null;
		this.#stageRootNode = null;
		this.#nodeTable = new System.Map();
		this.#imageAssets = [];
		this.#audioAssets = [];
		this.#imageElementTable = new System.Map();
		this.#selectedNodeName = null;
		this.#selectedTrack = null;
		this.#selectedKeys = new System.Set();
		this.#selectedMarker = null;
		this.#playhead = 0;
		this.#isPlaying = false;
		this.#playbackSpeed = 1;
		this.#isAutoKey = false;
		this.#isSnap = true;
		this.#isCurveVisible = true;
		this.#isGridVisible = true;
		this.#isEditView = true;
		this.#undoStack = [];
		this.#redoStack = [];
		this.#clipboardKeys = [];
		this.#timelinePanel = null;
		this.#hierarchyListElement = null;
		this.#assetListElement = null;
		this.#inspectorBodyElement = null;
		this.#statusTextElement = null;
		this.#playButtonElement = null;
		this.#autoKeyButtonElement = null;
		this.#gridToggleElement = null;
		this.#viewToggleElement = null;
		this.#timeLabelElement = null;
		this.#previewCanvasElement = null;
		this.#fileInputElement = null;
		this.#imageInputElement = null;
		this.#audioInputElement = null;
		this.#viewDragState = null;
		this.#isInspectorDirty = false;
	}

	//==============================================================================
	// 실행.
	//==============================================================================
	run() {
		this.buildLayout();
		this.startEngine();
	}

	//==============================================================================
	// 창 구성.
	//==============================================================================
	buildLayout() {
		const mainPane = new Pane({ direction: "horizontal", size: "flex" });

		// 좌측: 팔레트 + 계층 + 애셋.
		const leftPane = new Pane({ direction: "vertical", size: 236, minSize: 170 });
		const palettePane = new Pane({ size: 196, minSize: 100 });
		const paletteElement = createEditorSectionElement("ADD NODE", null);
		const paletteListElement = PaneStyle.create("div", "", { style: { flex: "1", overflowY: "auto", position: "relative" } });
		for (const kindDefinition of NODE_KIND_DEFINITIONS) {
			const rowElement = createEditorListRowElement(wrapEditorIconMarkup(ICON_SHAPES[kindDefinition.type]), kindDefinition.label);
			rowElement.addEventListener("click", () => {
				this.addNode(kindDefinition.type, this.#selectedNodeName);
			});
			paletteListElement.appendChild(rowElement);
		}
		paletteElement.appendChild(paletteListElement);
		palettePane.getContainer().appendChild(paletteElement);

		const hierarchyPane = new Pane({ size: "flex", minSize: 120 });
		const hierarchyElement = createEditorSectionElement("HIERARCHY", () => {
			return [
				{ id: "clearSelection", label: "Clear Selection", action: () => { this.selectNode(null); } },
				{ separator: true },
				{ id: "duplicateNode", label: "Duplicate", shortcut: "Ctrl+D" },
				{ id: "renameNode", label: "Rename..." },
				{ id: "deleteSelection", label: "Delete", shortcut: "Delete" },
			];
		});
		this.#hierarchyListElement = PaneStyle.create("div", "", { style: { flex: "1", overflowY: "auto", position: "relative" } });
		this.#hierarchyListElement.addEventListener("contextmenu", (mouseEvent) => {
			mouseEvent.preventDefault();
		});
		hierarchyElement.appendChild(this.#hierarchyListElement);
		hierarchyPane.getContainer().appendChild(hierarchyElement);

		const assetsPane = new Pane({ size: 180, minSize: 100 });
		const assetsElement = createEditorSectionElement("ASSETS", () => {
			return [
				{ id: "importImages", label: "Import Images..." },
				{ id: "importAudio", label: "Import Audio..." },
			];
		});
		this.#assetListElement = PaneStyle.create("div", "", { style: { flex: "1", overflowY: "auto", position: "relative" } });
		assetsElement.appendChild(this.#assetListElement);
		assetsPane.getContainer().appendChild(assetsElement);

		leftPane.addPane(palettePane);
		leftPane.addPane(hierarchyPane);
		leftPane.addPane(assetsPane);

		// 중앙: 프리뷰 + 타임라인.
		const centerPane = new Pane({ direction: "vertical", size: "flex", minSize: 300 });
		const previewPane = new Pane({ size: "flex", minSize: 160 });
		const previewElement = createEditorSectionElement("VIEW", null);
		const previewTitleElement = previewElement.firstChild;
		previewTitleElement.style.display = "flex";
		previewTitleElement.style.alignItems = "center";
		previewTitleElement.style.paddingRight = "6px";
		const previewSpacerElement = PaneStyle.create("div", "", { style: { position: "relative", width: "auto", height: "auto", flex: "1" } });
		this.#timeLabelElement = PaneStyle.create("span", "", {
			text: "00:00:00",
			style: { position: "relative", width: "auto", height: "auto", fontSize: "11px", color: EditorTheme.accentColor, marginRight: "8px", letterSpacing: "0.5px" },
		});
		this.#gridToggleElement = createEditorHeaderIconElement(EDITOR_ICON_SHAPES.grid, "Show Grid");
		this.#gridToggleElement.addEventListener("click", () => {
			this.#isGridVisible = !this.#isGridVisible;
			this.refreshViewToggles();
		});
		this.#viewToggleElement = createEditorHeaderIconElement(EDITOR_ICON_SHAPES.previewMode, "Render View");
		this.#viewToggleElement.addEventListener("click", () => {
			this.#isEditView = !this.#isEditView;
			this.refreshViewToggles();
		});
		const startButtonElement = createEditorHeaderButtonElement("|◀");
		startButtonElement.title = "Go to Start (Home)";
		startButtonElement.addEventListener("click", () => {
			this.executeCommand("goToStart");
		});
		this.#playButtonElement = createEditorHeaderButtonElement("PLAY");
		this.#playButtonElement.addEventListener("click", () => {
			this.togglePlay();
		});
		const stopButtonElement = createEditorHeaderButtonElement("STOP");
		stopButtonElement.addEventListener("click", () => {
			this.stopPlayback();
		});
		this.#autoKeyButtonElement = createEditorHeaderButtonElement("● AUTO KEY");
		this.#autoKeyButtonElement.title = "Record property edits as keys at the playhead (R)";
		this.#autoKeyButtonElement.addEventListener("click", () => {
			this.executeCommand("toggleAutoKey");
		});
		previewTitleElement.appendChild(previewSpacerElement);
		previewTitleElement.appendChild(this.#timeLabelElement);
		previewTitleElement.appendChild(this.#gridToggleElement);
		previewTitleElement.appendChild(this.#viewToggleElement);
		previewTitleElement.appendChild(startButtonElement);
		previewTitleElement.appendChild(this.#playButtonElement);
		previewTitleElement.appendChild(stopButtonElement);
		previewTitleElement.appendChild(this.#autoKeyButtonElement);
		const canvasHolderElement = PaneStyle.create("div", "", {
			style: { position: "relative", width: "auto", height: "auto", flex: "1", backgroundColor: "rgb(16, 17, 20)", overflow: "hidden" },
		});
		this.#previewCanvasElement = PaneStyle.create("canvas", "", { id: "previewCanvas" });
		this.#previewCanvasElement.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;display:block;";
		canvasHolderElement.appendChild(this.#previewCanvasElement);
		previewElement.appendChild(canvasHolderElement);
		previewPane.getContainer().appendChild(previewElement);
		const resizeObserver = new System.ResizeObserver(() => {
			if (this.#engine) {
				this.#engine.resize();
			}
		});
		resizeObserver.observe(canvasHolderElement);
		this.bindViewPointerEvents();

		const timelinePane = new Pane({ size: 300, minSize: 120 });
		const timelineElement = createEditorSectionElement("TIMELINE", () => {
			return this.composeAddTrackMenuItems().concat([
				{ separator: true },
				{ id: "addMarker", label: "Add Marker at Playhead", shortcut: "M" },
				{ id: "zoomToFit", label: "Zoom to Fit", shortcut: "F" },
			]);
		});
		const timelineTitleElement = timelineElement.firstChild;
		const addTrackButtonElement = createEditorHeaderButtonElement("+ TRACK");
		addTrackButtonElement.addEventListener("click", (mouseEvent) => {
			mouseEvent.stopPropagation();
			const buttonRect = addTrackButtonElement.getBoundingClientRect();
			openEditorMenuPanelAt(buttonRect.left, buttonRect.bottom + 2, this.composeAddTrackMenuItems());
		});
		const curveButtonElement = createEditorHeaderButtonElement("CURVES");
		curveButtonElement.addEventListener("click", () => {
			this.executeCommand("toggleCurves");
		});
		const snapButtonElement = createEditorHeaderButtonElement("SNAP");
		snapButtonElement.addEventListener("click", () => {
			this.executeCommand("toggleSnap");
		});
		this.#curveButtonElement = curveButtonElement;
		this.#snapButtonElement = snapButtonElement;
		timelineTitleElement.insertBefore(addTrackButtonElement, timelineTitleElement.lastChild);
		timelineTitleElement.insertBefore(curveButtonElement, timelineTitleElement.lastChild);
		timelineTitleElement.insertBefore(snapButtonElement, timelineTitleElement.lastChild);
		const timelineHolderElement = PaneStyle.create("div", "", {
			style: { position: "relative", width: "auto", height: "auto", flex: "1", overflow: "hidden" },
		});
		timelineElement.appendChild(timelineHolderElement);
		timelinePane.getContainer().appendChild(timelineElement);
		this.#timelinePanel = new TimelinePanel(timelineHolderElement, this);

		centerPane.addPane(previewPane);
		centerPane.addPane(timelinePane);

		// 우측: 인스펙터.
		const inspectorPane = new Pane({ size: 340, minSize: 220 });
		const inspectorElement = createEditorSectionElement("INSPECTOR", null);
		this.#inspectorBodyElement = PaneStyle.create("div", "", {
			style: { flex: "1", overflowY: "auto", position: "relative", paddingBottom: "40px" },
		});
		inspectorElement.appendChild(this.#inspectorBodyElement);
		inspectorPane.getContainer().appendChild(inspectorElement);

		mainPane.addPane(leftPane);
		mainPane.addPane(centerPane);
		mainPane.addPane(inspectorPane);

		// --- 메뉴 막대 + 상태줄 공통 조립 ---
		const windowLayout = buildEditorWindowLayout(MENU_DEFINITIONS, mainPane);
		const rootPane = windowLayout.rootPane;
		this.#statusTextElement = windowLayout.statusTextElement;
		rootPane.setCallback(() => {
			if (this.#engine) {
				this.#engine.resize();
			}
			if (this.#timelinePanel) {
				this.#timelinePanel.resize();
			}
		});
		rootPane.attachTo(System.document.body);

		// 파일 입력.
		this.#fileInputElement = this.createFileInput(".json", false, async (fileList) => {
			const selectedFile = fileList[0];
			if (selectedFile) {
				const jsonText = await selectedFile.text();
				this.loadDocumentText(jsonText, selectedFile.name);
			}
		});
		this.#imageInputElement = this.createFileInput("image/*", true, async (fileList) => {
			for (const selectedFile of fileList) {
				await this.importImageAsset(selectedFile);
			}
			this.rebuildAssetList();
			this.rebuildInspector();
		});
		this.#audioInputElement = this.createFileInput("audio/*", true, async (fileList) => {
			for (const selectedFile of fileList) {
				await this.importAudioAsset(selectedFile);
			}
			this.rebuildAssetList();
			this.rebuildInspector();
		});

		this.bindKeyboard();
		this.refreshViewToggles();
		this.refreshPlaybackButtons();
	}

	/** @private @type { HTMLElement | null } */ #curveButtonElement;
	/** @private @type { HTMLElement | null } */ #snapButtonElement;

	//==============================================================================
	// 숨은 파일 입력 생성.
	//==============================================================================
	/**
	 * @param { string } acceptText
	 * @param { boolean } isMultiple
	 * @param { Function } changeHandler
	 * @returns { HTMLInputElement }
	 */
	createFileInput(acceptText, isMultiple, changeHandler) {
		const inputElement = System.document.createElement("input");
		inputElement.type = "file";
		inputElement.accept = acceptText;
		inputElement.multiple = isMultiple;
		inputElement.style.display = "none";
		inputElement.addEventListener("change", async () => {
			await changeHandler(inputElement.files);
			inputElement.value = "";
		});
		System.document.body.appendChild(inputElement);
		return inputElement;
	}

	//==============================================================================
	// 단축키.
	//==============================================================================
	bindKeyboard() {
		System.window.addEventListener("keydown", (keyboardEvent) => {
			const targetTag = keyboardEvent.target.tagName;
			const isTypingTarget = (targetTag === "INPUT" || targetTag === "TEXTAREA" || targetTag === "SELECT");
			const key = keyboardEvent.key.toLowerCase();
			const isControl = keyboardEvent.ctrlKey || keyboardEvent.metaKey;
			if (isControl && keyboardEvent.altKey && key === "n") {
				keyboardEvent.preventDefault();
				this.executeCommand("newDocument");
				return;
			}
			if (isControl && keyboardEvent.shiftKey && key === "s") {
				keyboardEvent.preventDefault();
				this.executeCommand("saveAs");
				return;
			}
			if (isControl && key === "s") {
				keyboardEvent.preventDefault();
				this.executeCommand("save");
				return;
			}
			if (isControl && key === "o") {
				keyboardEvent.preventDefault();
				this.executeCommand("load");
				return;
			}
			if (isTypingTarget) {
				return;
			}
			if (isControl && key === "z") {
				keyboardEvent.preventDefault();
				this.executeCommand(keyboardEvent.shiftKey ? "redo" : "undo");
				return;
			}
			if (isControl && key === "y") {
				keyboardEvent.preventDefault();
				this.executeCommand("redo");
				return;
			}
			if (isControl && key === "c") {
				keyboardEvent.preventDefault();
				this.executeCommand("copyKeys");
				return;
			}
			if (isControl && key === "x") {
				keyboardEvent.preventDefault();
				this.executeCommand("cutKeys");
				return;
			}
			if (isControl && key === "v") {
				keyboardEvent.preventDefault();
				this.executeCommand("pasteKeys");
				return;
			}
			if (isControl && key === "a") {
				keyboardEvent.preventDefault();
				this.executeCommand("selectAllKeys");
				return;
			}
			if (isControl && key === "d") {
				keyboardEvent.preventDefault();
				this.executeCommand("duplicateNode");
				return;
			}
			switch (keyboardEvent.key) {
				case " ": {
					keyboardEvent.preventDefault();
					this.executeCommand(keyboardEvent.shiftKey ? "stop" : "togglePlay");
					break;
				}
				case "Delete":
				case "Backspace": {
					keyboardEvent.preventDefault();
					this.executeCommand("deleteSelection");
					break;
				}
				case "Home": {
					this.executeCommand("goToStart");
					break;
				}
				case "End": {
					this.executeCommand("goToEnd");
					break;
				}
				case "ArrowLeft": {
					keyboardEvent.preventDefault();
					this.stepFrame(keyboardEvent.shiftKey ? -10 : -1);
					break;
				}
				case "ArrowRight": {
					keyboardEvent.preventDefault();
					this.stepFrame(keyboardEvent.shiftKey ? 10 : 1);
					break;
				}
				case "Escape": {
					this.setSelectedKeys(new System.Set(), this.#selectedTrack);
					break;
				}
				default: {
					if (key === "k") {
						this.executeCommand("addKey");
					}
					else if (key === "m") {
						this.executeCommand("addMarker");
					}
					else if (key === "r") {
						this.executeCommand("toggleAutoKey");
					}
					else if (key === "c") {
						this.executeCommand("toggleCurves");
					}
					else if (key === "g") {
						this.executeCommand("toggleGrid");
					}
					else if (key === "f") {
						this.executeCommand("zoomToFit");
					}
					break;
				}
			}
		});
	}

	//==============================================================================
	// 메뉴 명령 실행.
	//==============================================================================
	/**
	 * @param { string } commandId
	 */
	executeCommand(commandId) {
		if (commandId.startsWith("speed.")) {
			this.#playbackSpeed = System.Number(commandId.substring(6));
			if (this.#timeline) {
				this.#timeline.setSpeed(this.#playbackSpeed);
			}
			this.refreshStatus();
			return;
		}
		switch (commandId) {
			case "newDocument": {
				this.loadDocument(createDefaultDocument(), "titlecard.timeline.json");
				break;
			}
			case "save": {
				this.saveDocument(this.#fileName);
				break;
			}
			case "saveAs": {
				openEditorInputDialog("Save As", "File name", this.#fileName, (inputText) => {
					const fileName = inputText.trim();
					if (fileName) {
						this.#fileName = fileName;
						this.saveDocument(fileName);
					}
				});
				break;
			}
			case "load": {
				this.#fileInputElement.click();
				break;
			}
			case "importImages": {
				this.#imageInputElement.click();
				break;
			}
			case "importAudio": {
				this.#audioInputElement.click();
				break;
			}
			case "copyUsage": {
				this.copyUsageCode();
				break;
			}
			case "undo": {
				this.undo();
				break;
			}
			case "redo": {
				this.redo();
				break;
			}
			case "cutKeys": {
				this.copySelectedKeys();
				this.deleteSelectedKeys();
				break;
			}
			case "copyKeys": {
				this.copySelectedKeys();
				break;
			}
			case "pasteKeys": {
				this.pasteKeys(this.#playhead);
				break;
			}
			case "selectAllKeys": {
				this.selectAllKeys();
				break;
			}
			case "duplicateNode": {
				this.duplicateNode(this.#selectedNodeName);
				break;
			}
			case "renameNode": {
				this.renameNode(this.#selectedNodeName);
				break;
			}
			case "deleteSelection": {
				this.deleteSelection();
				break;
			}
			case "addKey": {
				this.addKeyForSelection();
				break;
			}
			case "deleteKeys": {
				this.deleteSelectedKeys();
				break;
			}
			case "deleteTrack": {
				this.deleteTrack(this.#selectedTrack);
				break;
			}
			case "addMarker": {
				this.addMarkerAt(this.#playhead);
				break;
			}
			case "timeScaleKeys": {
				this.timeScaleSelectedKeys();
				break;
			}
			case "reverseKeys": {
				this.reverseSelectedKeys();
				break;
			}
			case "setDurationHere": {
				this.pushUndo();
				this.#document.duration = System.Math.max(1 / this.getFrameRate(), this.#playhead);
				this.afterDocumentChanged();
				break;
			}
			case "togglePlay": {
				this.togglePlay();
				break;
			}
			case "stop": {
				this.stopPlayback();
				break;
			}
			case "goToStart": {
				this.setPlayhead(0, false);
				break;
			}
			case "goToEnd": {
				this.setPlayhead(this.getDuration(), false);
				break;
			}
			case "previousFrame": {
				this.stepFrame(-1);
				break;
			}
			case "nextFrame": {
				this.stepFrame(1);
				break;
			}
			case "toggleLoop": {
				this.pushUndo();
				this.#document.loop = !this.#document.loop;
				this.afterDocumentChanged();
				break;
			}
			case "toggleGrid": {
				this.#isGridVisible = !this.#isGridVisible;
				this.refreshViewToggles();
				break;
			}
			case "toggleSnap": {
				this.#isSnap = !this.#isSnap;
				this.refreshPlaybackButtons();
				break;
			}
			case "toggleCurves": {
				this.#isCurveVisible = !this.#isCurveVisible;
				this.refreshPlaybackButtons();
				this.#timelinePanel.requestDraw();
				break;
			}
			case "toggleAutoKey": {
				this.#isAutoKey = !this.#isAutoKey;
				this.refreshPlaybackButtons();
				this.rebuildInspector();
				break;
			}
			case "zoomToFit": {
				this.#timelinePanel.zoomToFit();
				break;
			}
			default: {
				break;
			}
		}
	}

	//==============================================================================
	// 메뉴 체크 상태.
	//==============================================================================
	/**
	 * @param { string } commandId
	 * @returns { boolean }
	 */
	isCommandChecked(commandId) {
		switch (commandId) {
			case "toggleLoop": {
				return this.#document.loop === true;
			}
			case "toggleGrid": {
				return this.#isGridVisible;
			}
			case "toggleSnap": {
				return this.#isSnap;
			}
			case "toggleCurves": {
				return this.#isCurveVisible;
			}
			case "toggleAutoKey": {
				return this.#isAutoKey;
			}
			default: {
				if (commandId.startsWith("speed.")) {
					return System.Number(commandId.substring(6)) === this.#playbackSpeed;
				}
				return false;
			}
		}
	}

	//==============================================================================
	// 문서 접근.
	//==============================================================================
	/**
	 * @returns { object }
	 */
	getDocument() {
		return this.#document;
	}

	/**
	 * @returns { number }
	 */
	getDuration() {
		const duration = System.Number(this.#document.duration);
		return System.Number.isFinite(duration) && duration > 0 ? duration : 0;
	}

	/**
	 * @returns { number }
	 */
	getFrameRate() {
		const frameRate = System.Number(this.#document.frameRate);
		return System.Number.isFinite(frameRate) && frameRate > 0 ? frameRate : 30;
	}

	/**
	 * @param { string } nodeName
	 * @returns { object | null }
	 */
	findNodeDescription(nodeName) {
		return this.#document.stage.nodes.find((nodeDescription) => nodeDescription.name === nodeName) || null;
	}

	/**
	 * @param { string } nodeName
	 * @param { string } property
	 * @returns { object | null }
	 */
	findTrack(nodeName, property) {
		return this.#document.tracks.find((track) => track.target === nodeName && track.property === property) || null;
	}

	//==============================================================================
	// 문서 읽기 / 저장.
	//==============================================================================
	/**
	 * @param { string } jsonText
	 * @param { string } fileName
	 */
	loadDocumentText(jsonText, fileName) {
		try {
			const parsedDocument = System.JSON.parse(jsonText);
			this.loadDocument(parsedDocument, fileName);
		}
		catch (error) {
			this.#statusTextElement.innerText = "Failed to open: " + error.message;
		}
	}

	//==============================================================================
	// 문서 정규화. (빠진 필드를 기본값으로 채운다 — 손으로 쓴 문서 / 생성기 출력도 그대로 연다)
	//==============================================================================
	/**
	 * @param { object } document
	 * @returns { object }
	 */
	static normalizeDocument(document) {
		const normalized = System.Object.assign({ name: "Timeline", duration: 3, frameRate: 30, loop: true }, document);
		normalized.stage = System.Object.assign({ width: 960, height: 540, backgroundColor: "#101114ff", nodes: [] }, document.stage ? document.stage : {});
		normalized.stage.nodes = (System.Array.isArray(normalized.stage.nodes) ? normalized.stage.nodes : []).map((nodeDescription, nodeIndex) => {
			const filled = System.Object.assign({}, TIMELINE_NODE_DEFAULTS, nodeDescription);
			if (!filled.name) {
				filled.name = "Node " + (nodeIndex + 1);
			}
			return filled;
		});
		normalized.tracks = (System.Array.isArray(normalized.tracks) ? normalized.tracks : []).map((track) => {
			return System.Object.assign({ target: "", property: "x", keys: [] }, track, { keys: System.Array.isArray(track.keys) ? track.keys : [] });
		});
		normalized.markers = System.Array.isArray(normalized.markers) ? normalized.markers : [];
		return normalized;
	}

	/**
	 * @param { object } document
	 * @param { string } fileName
	 */
	loadDocument(document, fileName) {
		this.#document = TimelineEditor.normalizeDocument(document);
		this.#fileName = fileName;
		this.#undoStack = [];
		this.#redoStack = [];
		this.#selectedNodeName = null;
		this.#selectedTrack = null;
		this.#selectedKeys = new System.Set();
		this.#selectedMarker = null;
		this.#isPlaying = false;
		this.#playhead = 0;
		this.collectEmbeddedAssets();
		this.rebuildStage();
		this.rebuildAssetList();
		this.afterDocumentChanged();
		this.#timelinePanel.zoomToFit();
	}

	/**
	 * @param { string } fileName
	 */
	saveDocument(fileName) {
		const jsonText = System.JSON.stringify(this.#document, null, "\t");
		const blob = new System.Blob([jsonText], { type: "application/json" });
		const anchorElement = System.document.createElement("a");
		anchorElement.href = System.URL.createObjectURL(blob);
		anchorElement.download = fileName;
		anchorElement.click();
		System.URL.revokeObjectURL(anchorElement.href);
		this.refreshStatus();
	}

	//==============================================================================
	// 사용 코드 복사. (샘플에서 그대로 쓰는 재생 코드)
	//==============================================================================
	copyUsageCode() {
		const usageText = [
			"const timeline = await Timeline.loadFromUrl(\"./assets/" + this.#fileName + "\");",
			"timeline.buildStage(stageNode, (imageName) => imageTable[imageName]);",
			"timeline.setMarkerHandler((markerName) => { /* \"" + (this.#document.markers[0] ? this.#document.markers[0].name : "hit") + "\" */ });",
			"timeline.play();",
			"// 매 프레임: timeline.tick(timeDelta);",
		].join("\n");
		if (System.navigator.clipboard) {
			System.navigator.clipboard.writeText(usageText);
		}
		this.#statusTextElement.innerText = "Usage code copied.";
	}

	//==============================================================================
	// 문서에 박힌 데이터 주소 애셋 수집. (열어 온 문서의 이미지 / 오디오를 애셋 목록에 올린다)
	//==============================================================================
	collectEmbeddedAssets() {
		let imageCounter = 0;
		let audioCounter = 0;
		for (const nodeDescription of this.#document.stage.nodes) {
			if (nodeDescription.image && nodeDescription.image.startsWith("data:") && !this.#imageAssets.some((asset) => asset.dataUrl === nodeDescription.image)) {
				imageCounter += 1;
				const imageElement = new System.Image();
				imageElement.src = nodeDescription.image;
				this.#imageAssets.push({ name: nodeDescription.name + " image " + imageCounter, dataUrl: nodeDescription.image, imageElement: imageElement });
				this.#imageElementTable.set(nodeDescription.image, imageElement);
			}
			if (nodeDescription.audio && nodeDescription.audio.startsWith("data:") && !this.#audioAssets.some((asset) => asset.dataUrl === nodeDescription.audio)) {
				audioCounter += 1;
				this.#audioAssets.push({ name: nodeDescription.name + " audio " + audioCounter, dataUrl: nodeDescription.audio });
			}
		}
	}

	//==============================================================================
	// 되돌리기.
	//==============================================================================
	pushUndo() {
		this.#undoStack.push(System.JSON.stringify(this.#document));
		if (this.#undoStack.length > UNDO_LIMIT) {
			this.#undoStack.shift();
		}
		this.#redoStack = [];
	}

	undo() {
		const snapshot = this.#undoStack.pop();
		if (!snapshot) {
			return;
		}
		this.#redoStack.push(System.JSON.stringify(this.#document));
		this.restoreSnapshot(snapshot);
	}

	redo() {
		const snapshot = this.#redoStack.pop();
		if (!snapshot) {
			return;
		}
		this.#undoStack.push(System.JSON.stringify(this.#document));
		this.restoreSnapshot(snapshot);
	}

	/**
	 * @param { string } snapshot
	 */
	restoreSnapshot(snapshot) {
		const selectedNodeName = this.#selectedNodeName;
		const selectedTrackTarget = this.#selectedTrack ? this.#selectedTrack.target : null;
		const selectedTrackProperty = this.#selectedTrack ? this.#selectedTrack.property : null;
		this.#document = System.JSON.parse(snapshot);
		this.#selectedKeys = new System.Set();
		this.#selectedMarker = null;
		this.#selectedNodeName = this.findNodeDescription(selectedNodeName) ? selectedNodeName : null;
		this.#selectedTrack = selectedTrackTarget ? this.findTrack(selectedTrackTarget, selectedTrackProperty) : null;
		this.rebuildStage();
		this.afterDocumentChanged();
	}

	//==============================================================================
	// 편집 시작 / 끝. (타임라인 패널이 끌기 전에 부른다)
	//==============================================================================
	/**
	 * @param { string } label
	 */
	beginEdit(label) {
		this.pushUndo();
	}

	endEdit() {
		this.onKeysChanged();
		this.rebuildInspector();
	}

	//==============================================================================
	// 문서가 바뀐 뒤 공통 갱신. (런타임 다시 컴파일 + 화면 + 목록)
	//==============================================================================
	afterDocumentChanged() {
		if (this.#timeline) {
			this.#timeline.invalidate();
			this.#timeline.setSpeed(this.#playbackSpeed);
		}
		this.#playhead = System.Math.min(this.#playhead, this.getDuration());
		this.evaluateAtPlayhead();
		this.rebuildHierarchy();
		this.rebuildInspector();
		this.refreshStatus();
		this.refreshPlaybackButtons();
		if (this.#timelinePanel) {
			this.#timelinePanel.requestDraw();
		}
	}

	onKeysChanged() {
		if (this.#timeline) {
			this.#timeline.invalidate();
		}
		this.evaluateAtPlayhead();
		this.refreshStatus();
		this.#timelinePanel.requestDraw();
		this.#isInspectorDirty = true;
	}

	onMarkersChanged() {
		this.#timelinePanel.requestDraw();
		this.#isInspectorDirty = true;
	}

	//==============================================================================
	// 무대 재구성. (문서의 노드로 엔진 노드를 다시 만든다)
	//==============================================================================
	rebuildStage() {
		if (!this.#stageRootNode) {
			return;
		}
		for (const node of this.#nodeTable.values()) {
			Timeline.stopSound(node);
		}
		this.#stageRootNode.removeChildren();
		this.#nodeTable = new System.Map();
		this.#timeline = new Timeline(this.#document);
		this.#timeline.setSpeed(this.#playbackSpeed);
		this.#timeline.setCompleteHandler(() => {
			this.#isPlaying = false;
			this.refreshPlaybackButtons();
		});
		this.#nodeTable = this.#timeline.buildStage(this.#stageRootNode, (imageName) => {
			return this.resolveImage(imageName);
		});
		const stageSize = Vector2.create(this.#document.stage.width, this.#document.stage.height);
		this.#stageRootNode.setContentSize(stageSize);
		if (this.#engine) {
			const viewManager = this.#engine.getViewManager();
			viewManager.applyReferenceResolutionSize(stageSize);
			this.#engine.resize();
		}
		this.evaluateAtPlayhead();
	}

	/**
	 * @param { string } imageName
	 * @returns { HTMLImageElement | null }
	 */
	resolveImage(imageName) {
		if (this.#imageElementTable.has(imageName)) {
			return this.#imageElementTable.get(imageName);
		}
		const asset = this.#imageAssets.find((imageAsset) => imageAsset.name === imageName);
		return asset ? asset.imageElement : null;
	}

	/**
	 * @param { string } nodeName
	 */
	refreshNodeFromDescription(nodeName) {
		const node = this.#nodeTable.get(nodeName);
		const description = this.findNodeDescription(nodeName);
		if (node && description) {
			Timeline.applyStageNodeDescription(node, description, (imageName) => {
				return this.resolveImage(imageName);
			});
		}
		this.evaluateAtPlayhead();
	}

	evaluateAtPlayhead() {
		if (this.#timeline) {
			this.#timeline.evaluate(this.#playhead);
		}
	}

	//==============================================================================
	// 노드 추가 / 복제 / 이름 바꾸기 / 삭제 / 차례 이동.
	//==============================================================================
	/**
	 * @param { string } baseName
	 * @returns { string }
	 */
	composeUniqueName(baseName) {
		let candidateName = baseName;
		let counter = 1;
		while (this.findNodeDescription(candidateName)) {
			counter += 1;
			candidateName = baseName + " " + counter;
		}
		return candidateName;
	}

	/**
	 * @param { string } type
	 * @param { string | null } parentName
	 */
	addNode(type, parentName) {
		this.pushUndo();
		const kindDefinition = NODE_KIND_DEFINITIONS.find((definition) => definition.type === type);
		const description = createNodeDescription(type, this.composeUniqueName(kindDefinition.label));
		const parentDescription = parentName ? this.findNodeDescription(parentName) : null;
		description.parent = parentDescription ? parentDescription.name : null;
		description.x = parentDescription ? parentDescription.width / 2 : this.#document.stage.width / 2;
		description.y = parentDescription ? parentDescription.height / 2 : this.#document.stage.height / 2;
		this.#document.stage.nodes.push(description);
		this.rebuildStage();
		this.#selectedNodeName = description.name;
		this.#selectedTrack = null;
		this.afterDocumentChanged();
	}

	/**
	 * @param { string | null } nodeName
	 */
	duplicateNode(nodeName) {
		const description = nodeName ? this.findNodeDescription(nodeName) : null;
		if (!description) {
			return;
		}
		this.pushUndo();
		const clonedDescription = cloneDeep(description);
		clonedDescription.name = this.composeUniqueName(description.name);
		clonedDescription.x += 20;
		clonedDescription.y += 20;
		const sourceIndex = this.#document.stage.nodes.indexOf(description);
		this.#document.stage.nodes.splice(sourceIndex + 1, 0, clonedDescription);
		for (const track of this.#document.tracks.slice()) {
			if (track.target === description.name) {
				const clonedTrack = cloneDeep(track);
				clonedTrack.target = clonedDescription.name;
				this.#document.tracks.push(clonedTrack);
			}
		}
		this.rebuildStage();
		this.#selectedNodeName = clonedDescription.name;
		this.#selectedTrack = null;
		this.afterDocumentChanged();
	}

	/**
	 * @param { string | null } nodeName
	 */
	renameNode(nodeName) {
		const description = nodeName ? this.findNodeDescription(nodeName) : null;
		if (!description) {
			return;
		}
		openEditorInputDialog("Rename", "Node name", description.name, (inputText) => {
			const newName = inputText.trim();
			if (!newName || newName === description.name || this.findNodeDescription(newName)) {
				return;
			}
			this.pushUndo();
			const oldName = description.name;
			description.name = newName;
			for (const otherDescription of this.#document.stage.nodes) {
				if (otherDescription.parent === oldName) {
					otherDescription.parent = newName;
				}
			}
			for (const track of this.#document.tracks) {
				if (track.target === oldName) {
					track.target = newName;
				}
			}
			this.#selectedNodeName = newName;
			this.rebuildStage();
			this.afterDocumentChanged();
		}, "Rename");
	}

	/**
	 * @param { string | null } nodeName
	 */
	deleteNode(nodeName) {
		const description = nodeName ? this.findNodeDescription(nodeName) : null;
		if (!description) {
			return;
		}
		this.pushUndo();
		const removeNames = new System.Set([description.name]);
		let isGrowing = true;
		while (isGrowing) {
			isGrowing = false;
			for (const otherDescription of this.#document.stage.nodes) {
				if (otherDescription.parent && removeNames.has(otherDescription.parent) && !removeNames.has(otherDescription.name)) {
					removeNames.add(otherDescription.name);
					isGrowing = true;
				}
			}
		}
		this.#document.stage.nodes = this.#document.stage.nodes.filter((otherDescription) => !removeNames.has(otherDescription.name));
		this.#document.tracks = this.#document.tracks.filter((track) => !removeNames.has(track.target));
		this.#selectedNodeName = null;
		this.#selectedTrack = null;
		this.#selectedKeys = new System.Set();
		this.rebuildStage();
		this.afterDocumentChanged();
	}

	/**
	 * @param { string } nodeName
	 * @param { number } delta
	 */
	moveNode(nodeName, delta) {
		const nodes = this.#document.stage.nodes;
		const index = nodes.findIndex((nodeDescription) => nodeDescription.name === nodeName);
		const targetIndex = index + delta;
		if (index < 0 || targetIndex < 0 || targetIndex >= nodes.length) {
			return;
		}
		this.pushUndo();
		const [movedDescription] = nodes.splice(index, 1);
		nodes.splice(targetIndex, 0, movedDescription);
		this.rebuildStage();
		this.afterDocumentChanged();
	}

	/**
	 * @param { string } nodeName
	 * @param { string | null } parentName
	 */
	reparentNode(nodeName, parentName) {
		const description = this.findNodeDescription(nodeName);
		if (!description) {
			return;
		}
		let ancestorName = parentName;
		while (ancestorName) {
			if (ancestorName === nodeName) {
				return;
			}
			const ancestorDescription = this.findNodeDescription(ancestorName);
			ancestorName = ancestorDescription ? ancestorDescription.parent : null;
		}
		this.pushUndo();
		description.parent = parentName;
		this.rebuildStage();
		this.afterDocumentChanged();
	}

	//==============================================================================
	// 선택.
	//==============================================================================
	/**
	 * @param { string | null } nodeName
	 */
	selectNode(nodeName) {
		this.#selectedNodeName = nodeName;
		if (this.#selectedTrack && this.#selectedTrack.target !== nodeName) {
			this.#selectedTrack = null;
			this.#selectedKeys = new System.Set();
		}
		this.#selectedMarker = null;
		this.rebuildHierarchy();
		this.rebuildInspector();
		this.refreshStatus();
		this.#timelinePanel.requestDraw();
	}

	/**
	 * @param { object | null } track
	 */
	selectTrack(track) {
		this.#selectedTrack = track;
		this.#selectedKeys = new System.Set();
		this.#selectedMarker = null;
		if (track) {
			this.#selectedNodeName = track.target;
		}
		this.rebuildHierarchy();
		this.rebuildInspector();
		this.refreshStatus();
		if (track) {
			this.#timelinePanel.ensureTrackVisible(track);
		}
		this.#timelinePanel.requestDraw();
	}

	/**
	 * @param { System.Set } keySet
	 * @param { object | null } track
	 */
	setSelectedKeys(keySet, track) {
		this.#selectedKeys = keySet;
		this.#selectedMarker = null;
		if (track) {
			this.#selectedTrack = track;
			this.#selectedNodeName = track.target;
		}
		this.rebuildHierarchy();
		this.rebuildInspector();
		this.refreshStatus();
		this.#timelinePanel.requestDraw();
	}

	/**
	 * @param { object | null } marker
	 */
	selectMarker(marker) {
		this.#selectedMarker = marker;
		if (marker) {
			this.#selectedKeys = new System.Set();
		}
		this.rebuildInspector();
		this.#timelinePanel.requestDraw();
	}

	getSelectedKeys() {
		return this.#selectedKeys;
	}

	getSelectedTrack() {
		return this.#selectedTrack;
	}

	getSelectedNodeName() {
		return this.#selectedNodeName;
	}

	getSelectedMarker() {
		return this.#selectedMarker;
	}

	isSnapEnabled() {
		return this.#isSnap;
	}

	isCurveVisible() {
		return this.#isCurveVisible;
	}

	focusPanel() {
		if (System.document.activeElement && System.document.activeElement.blur) {
			System.document.activeElement.blur();
		}
	}

	/**
	 * @param { object } track
	 * @returns { string }
	 */
	getTrackLabel(track) {
		const definition = TIMELINE_PROPERTY_DEFINITIONS[track.property];
		return definition ? definition.label : track.property;
	}

	//==============================================================================
	// 트랙 / 키 편집.
	//==============================================================================
	/**
	 * @param { string } nodeName
	 * @param { string } property
	 * @returns { object }
	 */
	ensureTrack(nodeName, property) {
		let track = this.findTrack(nodeName, property);
		if (!track) {
			track = { target: nodeName, property: property, keys: [] };
			this.#document.tracks.push(track);
		}
		return track;
	}

	/**
	 * @param { object } track
	 * @param { number } time
	 * @param { * } value
	 * @returns { object }
	 */
	insertKey(track, time, value) {
		const frameRate = this.getFrameRate();
		const existingKey = track.keys.find((key) => System.Math.abs(key.time - time) < 0.5 / frameRate);
		if (existingKey) {
			existingKey.value = value;
			return existingKey;
		}
		const sortedKeys = track.keys.slice().sort((left, right) => left.time - right.time);
		const previousKey = sortedKeys.filter((key) => key.time < time).pop();
		const isStepProperty = track.property === "event" || track.property === "visible" || track.property === "text";
		const newKey = { time: time, value: value, easing: isStepProperty ? "step" : (previousKey ? previousKey.easing : "cubic.inOut") };
		track.keys.push(newKey);
		return newKey;
	}

	/**
	 * @param { string } nodeName
	 * @param { string } property
	 * @returns { * }
	 */
	getCurrentValue(nodeName, property) {
		const track = this.findTrack(nodeName, property);
		if (track && track.keys.length > 0) {
			return Timeline.sampleTrack(track, this.#playhead);
		}
		const description = this.findNodeDescription(nodeName);
		if (!description) {
			return 0;
		}
		const fieldName = PROPERTY_DESCRIPTION_FIELD[property] === undefined ? property : PROPERTY_DESCRIPTION_FIELD[property];
		if (property === "number") {
			const parsed = System.Number(description.text);
			return System.Number.isFinite(parsed) ? parsed : 0;
		}
		if (property === "visibleCharacters") {
			return description.text ? description.text.length : 0;
		}
		if (property === "event") {
			const eventList = EVENT_VALUE_TABLE[description.type] ? EVENT_VALUE_TABLE[description.type] : EVENT_VALUE_TABLE.default;
			return eventList[0];
		}
		if (fieldName === null) {
			return 0;
		}
		const value = description[fieldName];
		return value === undefined ? 0 : value;
	}

	/**
	 * @param { string } nodeName
	 * @param { string } property
	 * @param { * } value
	 * @param { boolean } isForceKey
	 */
	recordProperty(nodeName, property, value, isForceKey = false) {
		const description = this.findNodeDescription(nodeName);
		if (!description) {
			return;
		}
		const track = this.findTrack(nodeName, property);
		const isKeyed = isForceKey || this.#isAutoKey || (track && track.keys.length > 0);
		if (isKeyed && ANIMATABLE_PROPERTY_TABLE[description.type].includes(property)) {
			const targetTrack = this.ensureTrack(nodeName, property);
			const key = this.insertKey(targetTrack, this.#playhead, value);
			if (targetTrack.keys.length === 1 && property !== "event") {
				this.applyBaseValue(description, property, value);
			}
			this.#selectedTrack = targetTrack;
			this.#selectedKeys = new System.Set([key]);
		}
		else {
			this.applyBaseValue(description, property, value);
		}
		if (this.#timeline) {
			this.#timeline.invalidate();
		}
		this.refreshNodeFromDescription(nodeName);
		this.#timelinePanel.requestDraw();
		this.refreshStatus();
	}

	/**
	 * @param { object } description
	 * @param { string } property
	 * @param { * } value
	 */
	applyBaseValue(description, property, value) {
		const fieldName = PROPERTY_DESCRIPTION_FIELD[property] === undefined ? property : PROPERTY_DESCRIPTION_FIELD[property];
		if (property === "number") {
			description.text = String(System.Math.round(value));
			return;
		}
		if (fieldName === null) {
			return;
		}
		description[fieldName] = value;
	}

	/**
	 * @param { object } track
	 * @param { number } time
	 */
	addKeyAt(track, time) {
		this.pushUndo();
		const value = this.getCurrentValueAtTime(track, time);
		const key = this.insertKey(track, time, value);
		this.#selectedTrack = track;
		this.#selectedNodeName = track.target;
		this.#selectedKeys = new System.Set([key]);
		this.onKeysChanged();
		this.rebuildInspector();
	}

	/**
	 * @param { object } track
	 * @param { number } time
	 * @returns { * }
	 */
	getCurrentValueAtTime(track, time) {
		if (track.keys.length > 0) {
			return Timeline.sampleTrack(track, time);
		}
		return this.getCurrentValue(track.target, track.property);
	}

	/**
	 * @param { object } track
	 */
	addKeyAtPlayhead(track) {
		this.addKeyAt(track, this.#playhead);
	}

	addKeyForSelection() {
		if (this.#selectedTrack) {
			this.addKeyAtPlayhead(this.#selectedTrack);
			return;
		}
		const description = this.#selectedNodeName ? this.findNodeDescription(this.#selectedNodeName) : null;
		if (!description) {
			this.#statusTextElement.innerText = "Select a track or node first.";
			return;
		}
		this.pushUndo();
		for (const property of ["x", "y", "scaleX", "scaleY", "rotation", "opacity"]) {
			if (!ANIMATABLE_PROPERTY_TABLE[description.type].includes(property)) {
				continue;
			}
			const track = this.ensureTrack(description.name, property);
			this.insertKey(track, this.#playhead, this.getCurrentValue(description.name, property));
		}
		this.onKeysChanged();
		this.rebuildInspector();
	}

	/**
	 * @param { string } nodeName
	 * @param { string } property
	 */
	addTrackForProperty(nodeName, property) {
		this.pushUndo();
		const track = this.ensureTrack(nodeName, property);
		const key = this.insertKey(track, this.#playhead, this.getCurrentValue(nodeName, property));
		this.#selectedNodeName = nodeName;
		this.#selectedTrack = track;
		this.#selectedKeys = new System.Set([key]);
		this.onKeysChanged();
		this.rebuildHierarchy();
		this.rebuildInspector();
	}

	deleteSelectedKeys() {
		if (this.#selectedKeys.size === 0) {
			return;
		}
		this.pushUndo();
		for (const track of this.#document.tracks) {
			track.keys = track.keys.filter((key) => !this.#selectedKeys.has(key));
		}
		this.#selectedKeys = new System.Set();
		this.onKeysChanged();
		this.rebuildInspector();
	}

	/**
	 * @param { object | null } track
	 */
	deleteTrack(track) {
		if (!track) {
			return;
		}
		this.pushUndo();
		this.#document.tracks = this.#document.tracks.filter((otherTrack) => otherTrack !== track);
		this.#selectedTrack = null;
		this.#selectedKeys = new System.Set();
		this.afterDocumentChanged();
	}

	/**
	 * @param { object } track
	 */
	toggleTrackEnabled(track) {
		this.pushUndo();
		track.enabled = track.enabled === false;
		this.onKeysChanged();
		this.rebuildInspector();
	}

	deleteSelection() {
		if (this.#selectedKeys.size > 0) {
			this.deleteSelectedKeys();
			return;
		}
		if (this.#selectedMarker) {
			this.deleteMarker(this.#selectedMarker);
			return;
		}
		if (this.#selectedTrack) {
			this.deleteTrack(this.#selectedTrack);
			return;
		}
		this.deleteNode(this.#selectedNodeName);
	}

	selectAllKeys() {
		const keySet = new System.Set();
		const trackList = this.#selectedTrack ? [this.#selectedTrack] : this.#document.tracks;
		for (const track of trackList) {
			for (const key of track.keys) {
				keySet.add(key);
			}
		}
		this.setSelectedKeys(keySet, this.#selectedTrack);
	}

	copySelectedKeys() {
		this.#clipboardKeys = [];
		let earliestTime = System.Infinity;
		for (const track of this.#document.tracks) {
			for (const key of track.keys) {
				if (this.#selectedKeys.has(key)) {
					earliestTime = System.Math.min(earliestTime, key.time);
					this.#clipboardKeys.push({ target: track.target, property: track.property, key: cloneDeep(key) });
				}
			}
		}
		for (const entry of this.#clipboardKeys) {
			entry.key.time -= earliestTime;
		}
		this.refreshStatus();
	}

	/**
	 * @param { number } time
	 */
	pasteKeys(time) {
		if (this.#clipboardKeys.length === 0) {
			return;
		}
		this.pushUndo();
		const pastedKeys = new System.Set();
		const isSingleTrackClipboard = this.#clipboardKeys.every((entry) => entry.target === this.#clipboardKeys[0].target && entry.property === this.#clipboardKeys[0].property);
		for (const entry of this.#clipboardKeys) {
			let track = this.findTrack(entry.target, entry.property);
			if (isSingleTrackClipboard && this.#selectedTrack && this.#selectedTrack.property === entry.property) {
				track = this.#selectedTrack;
			}
			if (!track) {
				track = this.ensureTrack(entry.target, entry.property);
			}
			const key = this.insertKey(track, System.Math.min(this.getDuration(), time + entry.key.time), entry.key.value);
			key.easing = entry.key.easing;
			if (entry.key.curve) {
				key.curve = entry.key.curve.slice();
			}
			pastedKeys.add(key);
		}
		this.#selectedKeys = pastedKeys;
		this.onKeysChanged();
		this.rebuildInspector();
	}

	/**
	 * @param { string } easing
	 */
	setEasingForSelection(easing) {
		if (this.#selectedKeys.size === 0) {
			return;
		}
		this.pushUndo();
		for (const key of this.#selectedKeys) {
			key.easing = easing;
			if (easing === "bezier" && !key.curve) {
				key.curve = [0.42, 0, 0.58, 1];
			}
		}
		this.onKeysChanged();
		this.rebuildInspector();
	}

	timeScaleSelectedKeys() {
		if (this.#selectedKeys.size < 2) {
			this.#statusTextElement.innerText = "Select two or more keys.";
			return;
		}
		openEditorInputDialog("Time Scale", "Scale factor (1 = unchanged)", "1.5", (inputText) => {
			const factor = System.Number(inputText);
			if (!System.Number.isFinite(factor) || factor <= 0) {
				return;
			}
			this.pushUndo();
			let earliestTime = System.Infinity;
			for (const key of this.#selectedKeys) {
				earliestTime = System.Math.min(earliestTime, key.time);
			}
			for (const key of this.#selectedKeys) {
				key.time = System.Math.min(this.getDuration(), earliestTime + (key.time - earliestTime) * factor);
			}
			this.onKeysChanged();
			this.rebuildInspector();
		}, "Apply");
	}

	reverseSelectedKeys() {
		if (this.#selectedKeys.size < 2) {
			return;
		}
		this.pushUndo();
		let earliestTime = System.Infinity;
		let latestTime = -System.Infinity;
		for (const key of this.#selectedKeys) {
			earliestTime = System.Math.min(earliestTime, key.time);
			latestTime = System.Math.max(latestTime, key.time);
		}
		for (const key of this.#selectedKeys) {
			key.time = earliestTime + (latestTime - key.time);
		}
		this.onKeysChanged();
		this.rebuildInspector();
	}

	//==============================================================================
	// 마커.
	//==============================================================================
	/**
	 * @param { number } time
	 */
	addMarkerAt(time) {
		this.pushUndo();
		const marker = { time: time, name: "marker " + (this.#document.markers.length + 1) };
		this.#document.markers.push(marker);
		this.#selectedMarker = marker;
		this.#selectedKeys = new System.Set();
		this.onMarkersChanged();
		this.rebuildInspector();
	}

	/**
	 * @param { object } marker
	 */
	renameMarker(marker) {
		openEditorInputDialog("Marker", "Marker name", marker.name, (inputText) => {
			const newName = inputText.trim();
			if (newName) {
				this.pushUndo();
				marker.name = newName;
				this.onMarkersChanged();
				this.rebuildInspector();
			}
		}, "Rename");
	}

	/**
	 * @param { object } marker
	 */
	deleteMarker(marker) {
		this.pushUndo();
		this.#document.markers = this.#document.markers.filter((otherMarker) => otherMarker !== marker);
		this.#selectedMarker = null;
		this.onMarkersChanged();
		this.rebuildInspector();
	}

	//==============================================================================
	// 재생.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getPlayhead() {
		return this.#playhead;
	}

	/**
	 * @param { number } time
	 * @param { boolean } isScrubbing
	 */
	setPlayhead(time, isScrubbing) {
		this.#playhead = System.Math.max(0, System.Math.min(this.getDuration(), time));
		if (this.#timeline) {
			this.#timeline.seek(this.#playhead);
		}
		this.refreshTimeLabel();
		this.#timelinePanel.requestDraw();
		if (!isScrubbing) {
			this.rebuildInspector();
		}
		else {
			this.#isInspectorDirty = true;
		}
	}

	/**
	 * @param { number } frameDelta
	 */
	stepFrame(frameDelta) {
		const frameRate = this.getFrameRate();
		const currentFrame = System.Math.round(this.#playhead * frameRate);
		this.setPlayhead((currentFrame + frameDelta) / frameRate, false);
	}

	togglePlay() {
		if (!this.#timeline) {
			return;
		}
		if (this.#isPlaying) {
			this.#timeline.pause();
			this.#isPlaying = false;
		}
		else {
			if (this.#engine) {
				const audioManager = this.#engine.getAudioManager();
				if (audioManager) {
					audioManager.markUserGesture();
					audioManager.resumeContext();
				}
			}
			if (this.#playhead >= this.getDuration()) {
				this.#playhead = 0;
			}
			this.#timeline.seek(this.#playhead);
			this.#timeline.setSpeed(this.#playbackSpeed);
			this.#timeline.play();
			this.#isPlaying = true;
		}
		this.refreshPlaybackButtons();
	}

	stopPlayback() {
		if (this.#timeline) {
			this.#timeline.stop();
		}
		this.#isPlaying = false;
		this.#playhead = 0;
		this.refreshPlaybackButtons();
		this.refreshTimeLabel();
		this.#timelinePanel.requestDraw();
		this.rebuildInspector();
	}

	/**
	 * @param { number } timeDelta
	 */
	onTick(timeDelta) {
		if (this.#isPlaying && this.#timeline) {
			this.#timeline.tick(timeDelta);
			this.#playhead = this.#timeline.getTime();
			this.#timelinePanel.ensureTimeVisible(this.#playhead);
			this.#timelinePanel.requestDraw();
			this.refreshTimeLabel();
			if (!this.#timeline.isPlaying()) {
				this.#isPlaying = false;
				this.refreshPlaybackButtons();
				this.rebuildInspector();
			}
		}
		else if (this.#isInspectorDirty) {
			this.#isInspectorDirty = false;
			this.rebuildInspector();
		}
	}

	refreshTimeLabel() {
		if (this.#timeLabelElement) {
			this.#timeLabelElement.innerText = this.#timelinePanel.formatTimecode(this.#playhead, this.getFrameRate()) + "  /  " + this.#timelinePanel.formatTimecode(this.getDuration(), this.getFrameRate());
		}
	}

	refreshPlaybackButtons() {
		if (this.#playButtonElement) {
			this.#playButtonElement.innerText = this.#isPlaying ? "PAUSE" : "PLAY";
			setEditorHeaderButtonSelected(this.#playButtonElement, this.#isPlaying);
		}
		if (this.#autoKeyButtonElement) {
			setEditorHeaderButtonSelected(this.#autoKeyButtonElement, this.#isAutoKey);
			if (this.#isAutoKey) {
				this.#autoKeyButtonElement.style.backgroundColor = "#c0392b";
				this.#autoKeyButtonElement.style.color = "#ffffff";
			}
		}
		if (this.#curveButtonElement) {
			setEditorHeaderButtonSelected(this.#curveButtonElement, this.#isCurveVisible);
		}
		if (this.#snapButtonElement) {
			setEditorHeaderButtonSelected(this.#snapButtonElement, this.#isSnap);
		}
		this.refreshTimeLabel();
	}

	refreshViewToggles() {
		setEditorHeaderIconActive(this.#gridToggleElement, this.#isGridVisible && this.#isEditView);
		setEditorHeaderIconActive(this.#viewToggleElement, this.#isEditView === false);
	}

	//==============================================================================
	// 타임라인 컨텍스트 메뉴. (히트 정보에 따라 다르다)
	//==============================================================================
	/**
	 * @param { object } hit
	 * @param { number } clientX
	 * @param { number } clientY
	 */
	openTimelineContextMenu(hit, clientX, clientY) {
		const menuItems = [];
		if (hit.area === "key") {
			menuItems.push({ id: "copyKeys", label: "Copy Keys", shortcut: "Ctrl+C" });
			menuItems.push({ id: "cutKeys", label: "Cut Keys", shortcut: "Ctrl+X" });
			menuItems.push({ id: "deleteKeys", label: "Delete Keys", shortcut: "Delete" });
			menuItems.push({ separator: true });
			for (const easingDefinition of QUICK_EASING_DEFINITIONS) {
				menuItems.push({ id: "easing." + easingDefinition.easing, label: "Easing: " + easingDefinition.label, action: () => { this.setEasingForSelection(easingDefinition.easing); } });
			}
			menuItems.push({ id: "easing.bezier", label: "Easing: Bezier (Custom)", action: () => { this.setEasingForSelection("bezier"); } });
			menuItems.push({ separator: true });
			menuItems.push({ id: "goToKey", label: "Move Playhead Here", action: () => { this.setPlayhead(hit.key.time, false); } });
		}
		else if (hit.row && hit.row.kind === "track") {
			const track = hit.row.track;
			menuItems.push({ id: "addKeyHere", label: "Add Key Here", action: () => { this.addKeyAt(track, hit.time); } });
			menuItems.push({ id: "pasteHere", label: "Paste Keys Here", action: () => { this.pasteKeys(hit.time); } });
			menuItems.push({ separator: true });
			menuItems.push({ id: "toggleTrack", label: track.enabled === false ? "Enable Track" : "Mute Track", action: () => { this.toggleTrackEnabled(track); } });
			menuItems.push({ id: "selectTrackKeys", label: "Select All Keys in Track", action: () => { this.setSelectedKeys(new System.Set(track.keys), track); } });
			menuItems.push({ id: "deleteTrack", label: "Delete Track" });
		}
		else if (hit.row && hit.row.kind === "group") {
			menuItems.push({ id: "selectNode", label: "Select Node", action: () => { this.selectNode(hit.row.nodeName); } });
			menuItems.push({ separator: true });
			const description = this.findNodeDescription(hit.row.nodeName);
			if (description) {
				for (const property of ANIMATABLE_PROPERTY_TABLE[description.type]) {
					if (!this.findTrack(description.name, property)) {
						const definition = TIMELINE_PROPERTY_DEFINITIONS[property];
						menuItems.push({ id: "addTrack." + property, label: "Add Track: " + (definition ? definition.label : property), action: () => { this.addTrackForProperty(description.name, property); } });
					}
				}
			}
		}
		else if (hit.area === "marker") {
			menuItems.push({ id: "renameMarker", label: "Rename Marker...", action: () => { this.renameMarker(hit.marker); } });
			menuItems.push({ id: "goToMarker", label: "Move Playhead Here", action: () => { this.setPlayhead(hit.marker.time, false); } });
			menuItems.push({ separator: true });
			menuItems.push({ id: "deleteMarker", label: "Delete Marker", action: () => { this.deleteMarker(hit.marker); } });
		}
		else if (hit.area === "ruler") {
			menuItems.push({ id: "addMarkerHere", label: "Add Marker Here", action: () => { this.addMarkerAt(hit.time); } });
			menuItems.push({ id: "setDurationHere2", label: "Set Duration Here", action: () => {
				this.pushUndo();
				this.#document.duration = System.Math.max(1 / this.getFrameRate(), hit.time);
				this.afterDocumentChanged();
			} });
			menuItems.push({ id: "goHere", label: "Move Playhead Here", action: () => { this.setPlayhead(hit.time, false); } });
		}
		else {
			menuItems.push(...this.composeAddTrackMenuItems());
			menuItems.push({ separator: true });
			menuItems.push({ id: "pasteKeys", label: "Paste Keys at Playhead", shortcut: "Ctrl+V" });
			menuItems.push({ id: "zoomToFit", label: "Zoom to Fit", shortcut: "F" });
		}
		openEditorMenuPanelAt(clientX, clientY, menuItems);
	}

	/**
	 * @returns { object[] }
	 */
	composeAddTrackMenuItems() {
		const description = this.#selectedNodeName ? this.findNodeDescription(this.#selectedNodeName) : null;
		if (!description) {
			return [{ id: "noNode", label: "Select a node to add tracks", action: () => {} }];
		}
		const menuItems = [];
		for (const property of ANIMATABLE_PROPERTY_TABLE[description.type]) {
			const definition = TIMELINE_PROPERTY_DEFINITIONS[property];
			const hasTrack = this.findTrack(description.name, property) !== null;
			menuItems.push({
				id: "addTrack." + property,
				label: (hasTrack ? "Key " : "Add Track: ") + (definition ? definition.label : property),
				action: () => {
					this.addTrackForProperty(description.name, property);
				},
			});
		}
		return menuItems;
	}

	//==============================================================================
	// 계층 목록.
	//==============================================================================
	rebuildHierarchy() {
		if (!this.#hierarchyListElement) {
			return;
		}
		this.#hierarchyListElement.textContent = "";
		const stageRowElement = createEditorListRowElement(wrapEditorIconMarkup(EDITOR_ICON_SHAPES.node), "Stage " + this.#document.stage.width + "×" + this.#document.stage.height);
		stageRowElement.addEventListener("click", () => {
			this.selectNode(null);
		});
		this.#hierarchyListElement.appendChild(stageRowElement);

		const appendChildren = (parentName, depth) => {
			for (const description of this.#document.stage.nodes) {
				if ((description.parent || null) !== parentName) {
					continue;
				}
				const rowElement = createEditorListRowElement(wrapEditorIconMarkup(ICON_SHAPES[description.type] || ICON_SHAPES.group), description.name);
				rowElement.style.paddingLeft = (30 + depth * 16) + "px";
				setEditorListRowSelected(rowElement, description.name === this.#selectedNodeName);
				const trackCount = this.#document.tracks.filter((track) => track.target === description.name).length;
				if (trackCount > 0) {
					const badgeElement = PaneStyle.create("span", "", {
						text: String(trackCount),
						style: { position: "relative", width: "auto", height: "auto", marginLeft: "auto", fontSize: "10px", color: EditorTheme.accentColor },
					});
					rowElement.appendChild(badgeElement);
				}
				if (description.visible === false) {
					rowElement.style.opacity = "0.5";
				}
				rowElement.addEventListener("click", () => {
					this.selectNode(description.name);
				});
				rowElement.addEventListener("contextmenu", (mouseEvent) => {
					mouseEvent.preventDefault();
					mouseEvent.stopPropagation();
					this.selectNode(description.name);
					this.openNodeContextMenu(description, mouseEvent.clientX, mouseEvent.clientY);
				});
				this.#hierarchyListElement.appendChild(rowElement);
				appendChildren(description.name, depth + 1);
			}
		};
		appendChildren(null, 0);
	}

	/**
	 * @param { object } description
	 * @param { number } clientX
	 * @param { number } clientY
	 */
	openNodeContextMenu(description, clientX, clientY) {
		const menuItems = [];
		for (const kindDefinition of NODE_KIND_DEFINITIONS) {
			menuItems.push({ id: "addChild." + kindDefinition.type, label: "Add Child " + kindDefinition.label, action: () => { this.addNode(kindDefinition.type, description.name); } });
		}
		menuItems.push({ separator: true });
		menuItems.push({ id: "keyAll", label: "Key Transform at Playhead", shortcut: "K", action: () => { this.addKeyForSelection(); } });
		menuItems.push({ separator: true });
		menuItems.push({ id: "duplicateNode", label: "Duplicate", shortcut: "Ctrl+D" });
		menuItems.push({ id: "renameNode", label: "Rename..." });
		menuItems.push({ id: "moveUp", label: "Move Up (Draw Earlier)", action: () => { this.moveNode(description.name, -1); } });
		menuItems.push({ id: "moveDown", label: "Move Down (Draw Later)", action: () => { this.moveNode(description.name, 1); } });
		menuItems.push({ id: "toggleVisible", label: description.visible === false ? "Show" : "Hide", action: () => { this.pushUndo(); description.visible = description.visible === false; this.refreshNodeFromDescription(description.name); this.afterDocumentChanged(); } });
		menuItems.push({ separator: true });
		menuItems.push({ id: "deleteSelection", label: "Delete", shortcut: "Delete" });
		openEditorMenuPanelAt(clientX, clientY, menuItems);
	}

	//==============================================================================
	// 애셋. (이미지 / 오디오 — 데이터 주소로 문서에 박힌다)
	//==============================================================================
	/**
	 * @param { File } imageFile
	 */
	importImageAsset(imageFile) {
		return new System.Promise((resolve) => {
			const fileReader = new System.FileReader();
			fileReader.onload = () => {
				const imageElement = new System.Image();
				imageElement.onload = () => {
					this.#imageAssets.push({ name: imageFile.name, dataUrl: fileReader.result, imageElement: imageElement });
					this.#imageElementTable.set(fileReader.result, imageElement);
					resolve();
				};
				imageElement.onerror = () => {
					resolve();
				};
				imageElement.src = fileReader.result;
			};
			fileReader.readAsDataURL(imageFile);
		});
	}

	/**
	 * @param { File } audioFile
	 */
	importAudioAsset(audioFile) {
		return new System.Promise((resolve) => {
			const fileReader = new System.FileReader();
			fileReader.onload = () => {
				this.#audioAssets.push({ name: audioFile.name, dataUrl: fileReader.result });
				resolve();
			};
			fileReader.readAsDataURL(audioFile);
		});
	}

	rebuildAssetList() {
		if (!this.#assetListElement) {
			return;
		}
		this.#assetListElement.textContent = "";
		const appendAssetRow = (iconMarkup, asset, applyHandler, removeHandler) => {
			const rowElement = createEditorListRowElement(iconMarkup, asset.name);
			rowElement.addEventListener("click", applyHandler);
			rowElement.addEventListener("contextmenu", (mouseEvent) => {
				mouseEvent.preventDefault();
				mouseEvent.stopPropagation();
				openEditorMenuPanelAt(mouseEvent.clientX, mouseEvent.clientY, [
					{ id: "applyAsset", label: "Apply to Selected Node", action: applyHandler },
					{ separator: true },
					{ id: "removeAsset", label: "Remove from List", action: removeHandler },
				]);
			});
			this.#assetListElement.appendChild(rowElement);
		};
		for (const asset of this.#imageAssets) {
			appendAssetRow(wrapEditorIconMarkup(EDITOR_ICON_SHAPES.image), asset, () => {
				this.applyImageToSelectedNode(asset);
			}, () => {
				this.#imageAssets = this.#imageAssets.filter((otherAsset) => otherAsset !== asset);
				this.rebuildAssetList();
			});
		}
		for (const asset of this.#audioAssets) {
			appendAssetRow(wrapEditorIconMarkup(ICON_SHAPES.audio), asset, () => {
				this.applyAudioToSelectedNode(asset);
			}, () => {
				this.#audioAssets = this.#audioAssets.filter((otherAsset) => otherAsset !== asset);
				this.rebuildAssetList();
			});
		}
		if (this.#imageAssets.length === 0 && this.#audioAssets.length === 0) {
			const emptyElement = PaneStyle.create("div", "", {
				text: "Import images / audio from the ⋯ menu.",
				style: { position: "relative", width: "auto", height: "auto", padding: "10px 14px", fontSize: "12px", color: PaneTheme.color.textDim },
			});
			this.#assetListElement.appendChild(emptyElement);
		}
	}

	/**
	 * @param { object } asset
	 */
	applyImageToSelectedNode(asset) {
		const description = this.#selectedNodeName ? this.findNodeDescription(this.#selectedNodeName) : null;
		if (!description) {
			this.#statusTextElement.innerText = "Select a node in the hierarchy first.";
			return;
		}
		this.pushUndo();
		if (description.type !== "sprite") {
			description.type = "sprite";
			description.color = "#ffffff00";
			this.rebuildStage();
		}
		description.image = asset.dataUrl;
		this.refreshNodeFromDescription(description.name);
		this.afterDocumentChanged();
	}

	/**
	 * @param { object } asset
	 */
	applyAudioToSelectedNode(asset) {
		const description = this.#selectedNodeName ? this.findNodeDescription(this.#selectedNodeName) : null;
		if (!description) {
			this.#statusTextElement.innerText = "Select a node in the hierarchy first.";
			return;
		}
		this.pushUndo();
		if (description.type !== "sound") {
			description.type = "sound";
			this.rebuildStage();
		}
		description.audio = asset.dataUrl;
		this.refreshNodeFromDescription(description.name);
		this.afterDocumentChanged();
	}

	//==============================================================================
	// 상태줄.
	//==============================================================================
	refreshStatus() {
		if (!this.#statusTextElement) {
			return;
		}
		let keyCount = 0;
		for (const track of this.#document.tracks) {
			keyCount += track.keys.length;
		}
		const selectionText = this.#selectedTrack
			? (this.#selectedTrack.target + " · " + this.getTrackLabel(this.#selectedTrack) + (this.#selectedKeys.size > 0 ? " · " + this.#selectedKeys.size + " key(s)" : ""))
			: (this.#selectedNodeName ? this.#selectedNodeName : "No selection");
		this.#statusTextElement.innerText = this.#fileName + "    " + selectionText
			+ "    nodes " + this.#document.stage.nodes.length + "    tracks " + this.#document.tracks.length + "    keys " + keyCount
			+ "    " + this.#playbackSpeed + "x" + (this.#isAutoKey ? "    ● RECORDING" : "");
	}

	//==============================================================================
	// 인스펙터 묶음 추가.
	//==============================================================================
	/**
	 * @param { string } titleText
	 * @param { Function | null } menuBuilder
	 * @returns { HTMLElement }
	 */
	appendInspectorGroup(titleText, menuBuilder = null) {
		const groupBodyElement = PaneStyle.create("div", "", { style: { position: "relative", width: "auto", height: "auto" } });
		const groupElement = createEditorGroupElement(titleText, groupBodyElement, menuBuilder);
		this.#inspectorBodyElement.appendChild(groupElement);
		this.#inspectorBodyElement.appendChild(groupBodyElement);
		return groupBodyElement;
	}

	//==============================================================================
	// 속성 줄 끝의 키 단추. (◆ — 트랙 없음: 흐림 / 트랙 있음: 테두리 / 재생 헤드에 키: 채움)
	//==============================================================================
	/**
	 * @param { HTMLElement } rowElement
	 * @param { string } nodeName
	 * @param { string } property
	 */
	appendKeyButton(rowElement, nodeName, property) {
		const track = this.findTrack(nodeName, property);
		const frameRate = this.getFrameRate();
		const hasKeyAtPlayhead = track ? track.keys.some((key) => System.Math.abs(key.time - this.#playhead) < 0.5 / frameRate) : false;
		const buttonElement = PaneStyle.create("span", "", {
			text: "◆",
			style: {
				position: "relative", width: "16px", height: "auto", flexShrink: "0", textAlign: "center",
				fontSize: "12px", cursor: "pointer", userSelect: "none",
				color: hasKeyAtPlayhead ? EditorTheme.accentColor : (track ? EditorTheme.accentColor : "#4a4a4a"),
				opacity: hasKeyAtPlayhead ? "1" : (track ? "0.55" : "1"),
			},
		});
		buttonElement.title = hasKeyAtPlayhead ? "Remove key at playhead" : "Add key at playhead";
		buttonElement.addEventListener("click", (mouseEvent) => {
			mouseEvent.stopPropagation();
			if (hasKeyAtPlayhead) {
				this.pushUndo();
				track.keys = track.keys.filter((key) => System.Math.abs(key.time - this.#playhead) >= 0.5 / frameRate);
				this.onKeysChanged();
				this.rebuildInspector();
			}
			else {
				this.addTrackForProperty(nodeName, property);
			}
		});
		rowElement.appendChild(buttonElement);
	}

	//==============================================================================
	// 인스펙터 전체 구성.
	//==============================================================================
	rebuildInspector() {
		if (!this.#inspectorBodyElement) {
			return;
		}
		const scrollTop = this.#inspectorBodyElement.scrollTop;
		this.#inspectorBodyElement.textContent = "";
		this.buildClipInspector();
		const description = this.#selectedNodeName ? this.findNodeDescription(this.#selectedNodeName) : null;
		if (description) {
			this.buildNodeInspector(description);
		}
		if (this.#selectedTrack) {
			this.buildTrackInspector(this.#selectedTrack);
		}
		if (this.#selectedKeys.size > 0) {
			this.buildKeyInspector();
		}
		if (this.#selectedMarker) {
			this.buildMarkerInspector(this.#selectedMarker);
		}
		this.#inspectorBodyElement.scrollTop = scrollTop;
	}

	buildClipInspector() {
		const clipBodyElement = this.appendInspectorGroup("CLIP");
		const document = this.#document;
		appendEditorTextRow(clipBodyElement, "Name", document.name || "", (value) => {
			document.name = value;
			this.refreshStatus();
		}, () => { this.pushUndo(); });
		appendEditorNumberRow(clipBodyElement, "Duration (s)", this.getDuration(), 0.1, (value) => {
			document.duration = System.Math.max(0.1, value);
			this.afterDocumentChanged();
		}, () => { this.pushUndo(); });
		appendEditorNumberRow(clipBodyElement, "Frame Rate", this.getFrameRate(), 1, (value) => {
			document.frameRate = System.Math.max(1, System.Math.round(value));
			this.afterDocumentChanged();
		}, () => { this.pushUndo(); });
		appendEditorBooleanRow(clipBodyElement, "Loop", document.loop === true, (value) => {
			document.loop = value;
			this.afterDocumentChanged();
		}, () => { this.pushUndo(); });
		appendEditorNumberRow(clipBodyElement, "Stage Width", document.stage.width, 1, (value) => {
			document.stage.width = System.Math.max(16, System.Math.round(value));
			this.rebuildStage();
			this.afterDocumentChanged();
		}, () => { this.pushUndo(); });
		appendEditorNumberRow(clipBodyElement, "Stage Height", document.stage.height, 1, (value) => {
			document.stage.height = System.Math.max(16, System.Math.round(value));
			this.rebuildStage();
			this.afterDocumentChanged();
		}, () => { this.pushUndo(); });
		const backgroundChannels = parseTimelineColor(document.stage.backgroundColor);
		appendEditorColorRow(clipBodyElement, "Background", composeTimelineColor(backgroundChannels).substring(0, 7), backgroundChannels[3], (hexText, alphaValue) => {
			const channels = parseTimelineColor(hexText);
			channels[3] = alphaValue;
			document.stage.backgroundColor = composeTimelineColor(channels);
		}, () => { this.pushUndo(); });
	}

	/**
	 * @param { object } description
	 */
	buildNodeInspector(description) {
		const nodeName = description.name;
		const nodeBodyElement = this.appendInspectorGroup("NODE · " + description.type.toUpperCase(), () => {
			return this.composeAddTrackMenuItems();
		});
		appendEditorTextRow(nodeBodyElement, "Name", description.name, (value) => {
			const newName = value.trim();
			if (!newName || newName === description.name || this.findNodeDescription(newName)) {
				this.rebuildInspector();
				return;
			}
			this.pushUndo();
			const oldName = description.name;
			description.name = newName;
			for (const otherDescription of this.#document.stage.nodes) {
				if (otherDescription.parent === oldName) {
					otherDescription.parent = newName;
				}
			}
			for (const track of this.#document.tracks) {
				if (track.target === oldName) {
					track.target = newName;
				}
			}
			this.#selectedNodeName = newName;
			this.rebuildStage();
			this.afterDocumentChanged();
		});
		const parentOptions = ["(stage)"].concat(this.#document.stage.nodes.filter((otherDescription) => otherDescription.name !== nodeName).map((otherDescription) => otherDescription.name));
		appendEditorSelectRow(nodeBodyElement, "Parent", parentOptions, description.parent ? description.parent : "(stage)", (value) => {
			this.reparentNode(nodeName, value === "(stage)" ? null : value);
		});
		appendEditorSelectRow(nodeBodyElement, "Type", NODE_KIND_DEFINITIONS.map((definition) => definition.type), description.type, (value) => {
			this.pushUndo();
			description.type = value;
			if (value === "particle" && !description.particle) {
				description.particle = composeParticleDescription("Sparkle");
			}
			this.rebuildStage();
			this.afterDocumentChanged();
		});

		const animatableList = ANIMATABLE_PROPERTY_TABLE[description.type];
		const appendAnimatedNumber = (parentElement, labelText, property, stepAmount) => {
			const rowElement = appendEditorNumberRow(parentElement, labelText, System.Number(this.getCurrentValue(nodeName, property)), stepAmount, (value) => {
				this.recordProperty(nodeName, property, value);
			}, () => { this.pushUndo(); });
			if (animatableList.includes(property)) {
				this.appendKeyButton(rowElement, nodeName, property);
			}
			return rowElement;
		};

		const transformBodyElement = this.appendInspectorGroup("TRANSFORM");
		appendAnimatedNumber(transformBodyElement, "X", "x", 1);
		appendAnimatedNumber(transformBodyElement, "Y", "y", 1);
		if (description.type !== "sound") {
			appendAnimatedNumber(transformBodyElement, "Width", "width", 1);
			appendAnimatedNumber(transformBodyElement, "Height", "height", 1);
			appendAnimatedNumber(transformBodyElement, "Scale X", "scaleX", 0.01);
			appendAnimatedNumber(transformBodyElement, "Scale Y", "scaleY", 0.01);
			appendAnimatedNumber(transformBodyElement, "Rotation", "rotation", 1);
			appendAnimatedNumber(transformBodyElement, "Opacity", "opacity", 0.01);
			appendEditorNumberRow(transformBodyElement, "Pivot X", description.pivotX, 0.01, (value) => {
				description.pivotX = value;
				this.refreshNodeFromDescription(nodeName);
			}, () => { this.pushUndo(); });
			appendEditorNumberRow(transformBodyElement, "Pivot Y", description.pivotY, 0.01, (value) => {
				description.pivotY = value;
				this.refreshNodeFromDescription(nodeName);
			}, () => { this.pushUndo(); });
			const visibleRowElement = appendEditorBooleanRow(transformBodyElement, "Visible", this.getCurrentValue(nodeName, "visible") !== false, (value) => {
				this.recordProperty(nodeName, "visible", value);
				this.rebuildHierarchy();
			}, () => { this.pushUndo(); });
			this.appendKeyButton(visibleRowElement, nodeName, "visible");
		}

		if (description.type === "paint" || description.type === "text" || description.type === "sprite") {
			const appearanceBodyElement = this.appendInspectorGroup(description.type === "text" ? "TEXT" : (description.type === "sprite" ? "SPRITE" : "PAINT"));
			const colorChannels = parseTimelineColor(String(this.getCurrentValue(nodeName, "color")));
			const colorRowElement = appendEditorColorRow(appearanceBodyElement, description.type === "sprite" ? "Tint" : "Color", composeTimelineColor(colorChannels).substring(0, 7), colorChannels[3], (hexText, alphaValue) => {
				const channels = parseTimelineColor(hexText);
				channels[3] = alphaValue;
				this.recordProperty(nodeName, "color", composeTimelineColor(channels));
			}, () => { this.pushUndo(); });
			this.appendKeyButton(colorRowElement, nodeName, "color");
			if (description.type === "paint") {
				appendEditorNumberRow(appearanceBodyElement, "Round Size", description.roundSize, 1, (value) => {
					description.roundSize = System.Math.max(0, value);
					this.refreshNodeFromDescription(nodeName);
				}, () => { this.pushUndo(); });
			}
			if (description.type === "text") {
				const textRowElement = appendEditorTextRow(appearanceBodyElement, "Text", String(this.getCurrentValue(nodeName, "text")), (value) => {
					this.recordProperty(nodeName, "text", value);
				}, () => { this.pushUndo(); });
				this.appendKeyButton(textRowElement, nodeName, "text");
				const numberRowElement = appendEditorNumberRow(appearanceBodyElement, "Number", System.Number(this.getCurrentValue(nodeName, "number")), 1, (value) => {
					this.recordProperty(nodeName, "number", value, true);
				}, () => { this.pushUndo(); });
				numberRowElement.title = "Counts up as text (rounded)";
				this.appendKeyButton(numberRowElement, nodeName, "number");
				appendAnimatedNumber(appearanceBodyElement, "Font Size", "fontSize", 1);
				const visibleCharactersRowElement = appendEditorNumberRow(appearanceBodyElement, "Visible Chars", System.Number(this.getCurrentValue(nodeName, "visibleCharacters")), 1, (value) => {
					this.recordProperty(nodeName, "visibleCharacters", System.Math.round(value), true);
				}, () => { this.pushUndo(); });
				visibleCharactersRowElement.title = "Typewriter reveal — key from 0 to the text length";
				this.appendKeyButton(visibleCharactersRowElement, nodeName, "visibleCharacters");
				appendEditorBooleanRow(appearanceBodyElement, "Bold", description.bold === true, (value) => {
					description.bold = value;
					this.refreshNodeFromDescription(nodeName);
				}, () => { this.pushUndo(); });
				appendEditorSelectRow(appearanceBodyElement, "Align", TEXT_ALIGN_LIST, description.textAlign, (value) => {
					this.pushUndo();
					description.textAlign = value;
					this.refreshNodeFromDescription(nodeName);
				});
			}
			if (description.type === "sprite") {
				const imageOptions = ["(none)"].concat(this.#imageAssets.map((asset) => asset.name));
				const currentImageAsset = this.#imageAssets.find((asset) => asset.dataUrl === description.image || asset.name === description.image);
				appendEditorSelectRow(appearanceBodyElement, "Image", imageOptions, currentImageAsset ? currentImageAsset.name : "(none)", (value) => {
					this.pushUndo();
					const asset = this.#imageAssets.find((imageAsset) => imageAsset.name === value);
					description.image = asset ? asset.dataUrl : "";
					this.refreshNodeFromDescription(nodeName);
				});
				appendEditorNumberRow(appearanceBodyElement, "Frame Columns", description.frameColumns, 1, (value) => {
					description.frameColumns = System.Math.max(1, System.Math.round(value));
					this.refreshNodeFromDescription(nodeName);
				}, () => { this.pushUndo(); });
				appendEditorNumberRow(appearanceBodyElement, "Frame Rows", description.frameRows, 1, (value) => {
					description.frameRows = System.Math.max(1, System.Math.round(value));
					this.refreshNodeFromDescription(nodeName);
				}, () => { this.pushUndo(); });
				appendAnimatedNumber(appearanceBodyElement, "Frame", "frame", 1);
				appendEditorSelectRow(appearanceBodyElement, "Blend", BLEND_MODE_LIST, description.blendMode, (value) => {
					this.pushUndo();
					description.blendMode = value;
					this.refreshNodeFromDescription(nodeName);
				});
				const effectBodyElement = this.appendInspectorGroup("SHADER EFFECT");
				appendEditorSelectRow(effectBodyElement, "Effect", System.Object.keys(ShaderSpriteEffect), description.effect, (value) => {
					this.pushUndo();
					description.effect = value;
					description.effectColor = "";
					this.refreshNodeFromDescription(nodeName);
					this.rebuildInspector();
				});
				appendAnimatedNumber(effectBodyElement, "Progress", "effect", 0.01);
				const effectColorChannels = parseTimelineColor(description.effectColor ? description.effectColor : "#ffffffff");
				appendEditorColorRow(effectBodyElement, "Effect Color", composeTimelineColor(effectColorChannels).substring(0, 7), effectColorChannels[3], (hexText, alphaValue) => {
					const channels = parseTimelineColor(hexText);
					channels[3] = alphaValue;
					description.effectColor = composeTimelineColor(channels);
					this.refreshNodeFromDescription(nodeName);
				}, () => { this.pushUndo(); });
			}
		}

		if (description.type === "particle") {
			const particleBodyElement = this.appendInspectorGroup("PARTICLE");
			const particleDescription = description.particle ? description.particle : composeParticleDescription("Sparkle");
			description.particle = particleDescription;
			appendEditorSelectRow(particleBodyElement, "Preset", System.Object.keys(PARTICLE_PRESET_TABLE), particleDescription.preset ? particleDescription.preset : "Fire", (value) => {
				this.pushUndo();
				description.particle = composeParticleDescription(value);
				this.refreshNodeFromDescription(nodeName);
				this.rebuildInspector();
			});
			appendEditorNumberRow(particleBodyElement, "Emission Rate", particleDescription.emissionRate, 1, (value) => {
				particleDescription.emissionRate = System.Math.max(0, value);
				this.refreshNodeFromDescription(nodeName);
			}, () => { this.pushUndo(); });
			appendEditorBooleanRow(particleBodyElement, "Looping", particleDescription.looping !== false, (value) => {
				particleDescription.looping = value;
				this.refreshNodeFromDescription(nodeName);
			}, () => { this.pushUndo(); });
			appendEditorNumberRow(particleBodyElement, "Duration", particleDescription.duration, 0.1, (value) => {
				particleDescription.duration = System.Math.max(0.1, value);
				this.refreshNodeFromDescription(nodeName);
			}, () => { this.pushUndo(); });
			const hintElement = PaneStyle.create("div", "", {
				text: "Use an Event track (play / stop / emit:N) to fire this system on the timeline. Full editing lives in the Particle Editor (.vfx.json).",
				style: { position: "relative", width: "auto", height: "auto", padding: "6px 12px 8px 12px", fontSize: "11px", lineHeight: "1.4", color: PaneTheme.color.textDim },
			});
			particleBodyElement.appendChild(hintElement);
		}

		if (description.type === "sound") {
			const soundBodyElement = this.appendInspectorGroup("SOUND");
			const audioOptions = ["(none)"].concat(this.#audioAssets.map((asset) => asset.name));
			const currentAudioAsset = this.#audioAssets.find((asset) => asset.dataUrl === description.audio || asset.name === description.audio);
			appendEditorSelectRow(soundBodyElement, "Audio", audioOptions, currentAudioAsset ? currentAudioAsset.name : "(none)", (value) => {
				this.pushUndo();
				const asset = this.#audioAssets.find((audioAsset) => audioAsset.name === value);
				description.audio = asset ? asset.dataUrl : "";
				this.refreshNodeFromDescription(nodeName);
			});
			appendEditorNumberRow(soundBodyElement, "Volume", description.volume, 0.01, (value) => {
				description.volume = System.Math.max(0, System.Math.min(1, value));
				this.refreshNodeFromDescription(nodeName);
			}, () => { this.pushUndo(); });
		}

		// 이벤트. (모든 종류)
		const eventBodyElement = this.appendInspectorGroup("EVENT");
		const eventList = EVENT_VALUE_TABLE[description.type] ? EVENT_VALUE_TABLE[description.type] : EVENT_VALUE_TABLE.default;
		const eventTrack = this.findTrack(nodeName, "event");
		const eventKeyAtPlayhead = eventTrack ? eventTrack.keys.find((key) => System.Math.abs(key.time - this.#playhead) < 0.5 / this.getFrameRate()) : null;
		const eventRowElement = appendEditorSelectRow(eventBodyElement, "At Playhead", eventList.concat(eventList.includes("custom") ? [] : ["custom"]), eventKeyAtPlayhead ? (eventList.includes(String(eventKeyAtPlayhead.value)) ? String(eventKeyAtPlayhead.value) : "custom") : eventList[0], (value) => {
			if (value === "custom") {
				openEditorInputDialog("Event", "Event value (e.g. emit:40 / trigger)", eventKeyAtPlayhead ? String(eventKeyAtPlayhead.value) : "", (inputText) => {
					const eventValue = inputText.trim();
					if (eventValue) {
						this.pushUndo();
						this.recordProperty(nodeName, "event", eventValue, true);
						this.rebuildInspector();
					}
				}, "Add");
				return;
			}
			this.pushUndo();
			this.recordProperty(nodeName, "event", value, true);
			this.rebuildInspector();
		});
		this.appendKeyButton(eventRowElement, nodeName, "event");
	}

	/**
	 * @param { object } track
	 */
	buildTrackInspector(track) {
		const trackBodyElement = this.appendInspectorGroup("TRACK");
		const targetRowElement = createEditorPropertyRowElement(trackBodyElement, "Target");
		targetRowElement.appendChild(PaneStyle.create("span", "", { text: track.target + " · " + this.getTrackLabel(track), style: { position: "relative", width: "auto", height: "auto", fontSize: "13px", color: EditorTheme.inkColor } }));
		appendEditorBooleanRow(trackBodyElement, "Enabled", track.enabled !== false, (value) => {
			track.enabled = value;
			this.onKeysChanged();
		}, () => { this.pushUndo(); });
		const countRowElement = createEditorPropertyRowElement(trackBodyElement, "Keys");
		countRowElement.appendChild(PaneStyle.create("span", "", { text: String(track.keys.length), style: { position: "relative", width: "auto", height: "auto", fontSize: "13px", color: EditorTheme.inkColor } }));
		const buttonRowElement = PaneStyle.create("div", "", { style: { position: "relative", width: "auto", height: "auto", display: "flex", gap: "8px", padding: "8px 12px" } });
		const keyButtonElement = createEditorButtonElement("Add Key", true);
		keyButtonElement.addEventListener("click", () => {
			this.addKeyAtPlayhead(track);
		});
		const selectButtonElement = createEditorButtonElement("Select Keys", false);
		selectButtonElement.addEventListener("click", () => {
			this.setSelectedKeys(new System.Set(track.keys), track);
		});
		const deleteButtonElement = createEditorButtonElement("Delete Track", false);
		deleteButtonElement.addEventListener("click", () => {
			this.deleteTrack(track);
		});
		buttonRowElement.appendChild(keyButtonElement);
		buttonRowElement.appendChild(selectButtonElement);
		buttonRowElement.appendChild(deleteButtonElement);
		trackBodyElement.appendChild(buttonRowElement);
	}

	buildKeyInspector() {
		const keyList = [];
		let keyTrack = null;
		for (const track of this.#document.tracks) {
			for (const key of track.keys) {
				if (this.#selectedKeys.has(key)) {
					keyList.push(key);
					keyTrack = keyTrack ? keyTrack : track;
				}
			}
		}
		if (keyList.length === 0 || !keyTrack) {
			return;
		}
		const firstKey = keyList[0];
		const isSingle = keyList.length === 1;
		const keyBodyElement = this.appendInspectorGroup(isSingle ? "KEY" : "KEYS (" + keyList.length + ")");
		const definition = TIMELINE_PROPERTY_DEFINITIONS[keyTrack.property];
		const kind = definition ? definition.kind : "number";
		const applyToKeys = (applyHandler) => {
			for (const key of keyList) {
				applyHandler(key);
			}
			this.onKeysChanged();
		};
		appendEditorNumberRow(keyBodyElement, "Time (s)", firstKey.time, 0.01, (value) => {
			const deltaTime = value - firstKey.time;
			applyToKeys((key) => {
				key.time = System.Math.max(0, System.Math.min(this.getDuration(), key.time + deltaTime));
			});
		}, () => { this.pushUndo(); });
		appendEditorNumberRow(keyBodyElement, "Frame", System.Math.round(firstKey.time * this.getFrameRate()), 1, (value) => {
			const deltaTime = value / this.getFrameRate() - firstKey.time;
			applyToKeys((key) => {
				key.time = System.Math.max(0, System.Math.min(this.getDuration(), key.time + deltaTime));
			});
		}, () => { this.pushUndo(); });
		if (kind === "number") {
			appendEditorNumberRow(keyBodyElement, "Value", System.Number(firstKey.value), 0.01, (value) => {
				applyToKeys((key) => {
					key.value = value;
				});
			}, () => { this.pushUndo(); });
		}
		else if (kind === "color") {
			const channels = parseTimelineColor(String(firstKey.value));
			appendEditorColorRow(keyBodyElement, "Value", composeTimelineColor(channels).substring(0, 7), channels[3], (hexText, alphaValue) => {
				const nextChannels = parseTimelineColor(hexText);
				nextChannels[3] = alphaValue;
				applyToKeys((key) => {
					key.value = composeTimelineColor(nextChannels);
				});
			}, () => { this.pushUndo(); });
		}
		else if (kind === "boolean") {
			appendEditorBooleanRow(keyBodyElement, "Value", firstKey.value === true || firstKey.value === "true", (value) => {
				applyToKeys((key) => {
					key.value = value;
				});
			}, () => { this.pushUndo(); });
		}
		else {
			appendEditorTextRow(keyBodyElement, "Value", String(firstKey.value), (value) => {
				applyToKeys((key) => {
					key.value = value;
				});
			}, () => { this.pushUndo(); });
		}
		if (kind === "number" || kind === "color") {
			appendEditorSelectRow(keyBodyElement, "Easing", TIMELINE_EASING_NAMES, firstKey.easing ? firstKey.easing : "linear", (value) => {
				this.pushUndo();
				applyToKeys((key) => {
					key.easing = value;
					if (value === "bezier" && !key.curve) {
						key.curve = [0.42, 0, 0.58, 1];
					}
				});
				this.rebuildInspector();
			});
			if (firstKey.easing === "bezier") {
				const curve = firstKey.curve ? firstKey.curve : [0.42, 0, 0.58, 1];
				firstKey.curve = curve;
				const curveLabels = ["X1", "Y1", "X2", "Y2"];
				curveLabels.forEach((labelText, curveIndex) => {
					appendEditorNumberRow(keyBodyElement, "Control " + labelText, curve[curveIndex], 0.01, (value) => {
						const clamped = (curveIndex % 2 === 0) ? System.Math.max(0, System.Math.min(1, value)) : value;
						applyToKeys((key) => {
							key.curve = key.curve ? key.curve : [0.42, 0, 0.58, 1];
							key.curve[curveIndex] = clamped;
						});
						this.drawEasingPreview(previewCanvasElement, firstKey);
					}, () => { this.pushUndo(); });
				});
				const presetRowElement = PaneStyle.create("div", "", { style: { position: "relative", width: "auto", height: "auto", display: "flex", flexWrap: "wrap", gap: "6px", padding: "8px 12px" } });
				for (const presetDefinition of BEZIER_PRESET_DEFINITIONS) {
					const presetButtonElement = createEditorButtonElement(presetDefinition.label, false);
					presetButtonElement.style.padding = "3px 9px";
					presetButtonElement.style.fontSize = "12px";
					presetButtonElement.addEventListener("click", () => {
						this.pushUndo();
						applyToKeys((key) => {
							key.curve = presetDefinition.curve.slice();
						});
						this.rebuildInspector();
					});
					presetRowElement.appendChild(presetButtonElement);
				}
				keyBodyElement.appendChild(presetRowElement);
			}
			const previewCanvasElement = System.document.createElement("canvas");
			previewCanvasElement.width = 240;
			previewCanvasElement.height = 120;
			previewCanvasElement.style.cssText = "display:block;width:240px;height:120px;margin:4px 12px 10px 12px;border:1px solid " + EditorTheme.borderColor + ";border-radius:4px;background:#141414;";
			keyBodyElement.appendChild(previewCanvasElement);
			this.drawEasingPreview(previewCanvasElement, firstKey);
		}
		const jumpRowElement = PaneStyle.create("div", "", { style: { position: "relative", width: "auto", height: "auto", display: "flex", gap: "8px", padding: "4px 12px 8px 12px" } });
		const jumpButtonElement = createEditorButtonElement("Playhead to Key", false);
		jumpButtonElement.addEventListener("click", () => {
			this.setPlayhead(firstKey.time, false);
		});
		const deleteButtonElement = createEditorButtonElement("Delete", false);
		deleteButtonElement.addEventListener("click", () => {
			this.deleteSelectedKeys();
		});
		jumpRowElement.appendChild(jumpButtonElement);
		jumpRowElement.appendChild(deleteButtonElement);
		keyBodyElement.appendChild(jumpRowElement);
	}

	/**
	 * @param { HTMLCanvasElement } canvasElement
	 * @param { object } key
	 */
	drawEasingPreview(canvasElement, key) {
		const context = canvasElement.getContext("2d");
		const width = canvasElement.width;
		const height = canvasElement.height;
		context.clearRect(0, 0, width, height);
		context.strokeStyle = "rgba(255, 255, 255, 0.08)";
		for (let lineIndex = 1; lineIndex < 4; ++lineIndex) {
			context.beginPath();
			context.moveTo(0, height * lineIndex / 4);
			context.lineTo(width, height * lineIndex / 4);
			context.moveTo(width * lineIndex / 4, 0);
			context.lineTo(width * lineIndex / 4, height);
			context.stroke();
		}
		const easingFunction = resolveTimelineEasing(key.easing, key.curve);
		const padding = 16;
		context.strokeStyle = EditorTheme.accentColor;
		context.lineWidth = 2;
		context.beginPath();
		for (let x = 0; x <= width; x += 2) {
			const progress = x / width;
			const eased = easingFunction(progress);
			const y = height - padding - eased * (height - padding * 2);
			if (x === 0) {
				context.moveTo(x, y);
			}
			else {
				context.lineTo(x, y);
			}
		}
		context.stroke();
		context.fillStyle = EditorTheme.inkDimColor;
		context.font = "10px " + EditorTheme.fontFamily;
		context.fillText(key.easing ? key.easing : "linear", 6, 12);
	}

	/**
	 * @param { object } marker
	 */
	buildMarkerInspector(marker) {
		const markerBodyElement = this.appendInspectorGroup("MARKER");
		appendEditorTextRow(markerBodyElement, "Name", marker.name, (value) => {
			marker.name = value.trim() || marker.name;
			this.onMarkersChanged();
		}, () => { this.pushUndo(); });
		appendEditorNumberRow(markerBodyElement, "Time (s)", marker.time, 0.01, (value) => {
			marker.time = System.Math.max(0, System.Math.min(this.getDuration(), value));
			this.onMarkersChanged();
		}, () => { this.pushUndo(); });
		const buttonRowElement = PaneStyle.create("div", "", { style: { position: "relative", width: "auto", height: "auto", display: "flex", gap: "8px", padding: "8px 12px" } });
		const deleteButtonElement = createEditorButtonElement("Delete Marker", false);
		deleteButtonElement.addEventListener("click", () => {
			this.deleteMarker(marker);
		});
		buttonRowElement.appendChild(deleteButtonElement);
		markerBodyElement.appendChild(buttonRowElement);
	}

	//==============================================================================
	// 프리뷰 화면 입력. (노드 선택 / 끌어 옮기기 — 자동 키 / 트랙이 있으면 키가 된다)
	//==============================================================================
	bindViewPointerEvents() {
		const canvasElement = this.#previewCanvasElement;
		const toViewPosition = (pointerEvent) => {
			const canvasRect = canvasElement.getBoundingClientRect();
			const viewManager = this.#engine.getViewManager();
			return viewManager.canvasPositionToViewPosition(Vector2.create(pointerEvent.clientX - canvasRect.left, pointerEvent.clientY - canvasRect.top));
		};
		canvasElement.addEventListener("pointerdown", (pointerEvent) => {
			if (!this.#engine || pointerEvent.button !== 0) {
				return;
			}
			this.focusPanel();
			const viewPosition = toViewPosition(pointerEvent);
			const hitName = this.hitTestStage(viewPosition);
			if (hitName !== this.#selectedNodeName) {
				this.selectNode(hitName);
			}
			if (hitName) {
				canvasElement.setPointerCapture(pointerEvent.pointerId);
				this.#viewDragState = {
					nodeName: hitName,
					startView: viewPosition,
					startX: System.Number(this.getCurrentValue(hitName, "x")),
					startY: System.Number(this.getCurrentValue(hitName, "y")),
					isMoved: false,
				};
			}
		});
		canvasElement.addEventListener("pointermove", (pointerEvent) => {
			const dragState = this.#viewDragState;
			if (!dragState) {
				return;
			}
			const viewPosition = toViewPosition(pointerEvent);
			const deltaX = viewPosition.x - dragState.startView.x;
			const deltaY = viewPosition.y - dragState.startView.y;
			if (!dragState.isMoved && System.Math.abs(deltaX) < 2 && System.Math.abs(deltaY) < 2) {
				return;
			}
			if (!dragState.isMoved) {
				dragState.isMoved = true;
				this.pushUndo();
			}
			const parentScale = this.computeParentScale(dragState.nodeName);
			this.recordProperty(dragState.nodeName, "x", System.Math.round(dragState.startX + deltaX / parentScale.x));
			this.recordProperty(dragState.nodeName, "y", System.Math.round(dragState.startY + deltaY / parentScale.y));
			this.#isInspectorDirty = true;
		});
		const finishDrag = () => {
			if (this.#viewDragState && this.#viewDragState.isMoved) {
				this.rebuildInspector();
			}
			this.#viewDragState = null;
		};
		canvasElement.addEventListener("pointerup", finishDrag);
		canvasElement.addEventListener("pointercancel", finishDrag);
		canvasElement.addEventListener("contextmenu", (mouseEvent) => {
			mouseEvent.preventDefault();
			const description = this.#selectedNodeName ? this.findNodeDescription(this.#selectedNodeName) : null;
			if (description) {
				this.openNodeContextMenu(description, mouseEvent.clientX, mouseEvent.clientY);
			}
			else {
				const menuItems = [];
				for (const kindDefinition of NODE_KIND_DEFINITIONS) {
					menuItems.push({ id: "add." + kindDefinition.type, label: "Add " + kindDefinition.label, action: () => { this.addNode(kindDefinition.type, null); } });
				}
				openEditorMenuPanelAt(mouseEvent.clientX, mouseEvent.clientY, menuItems);
			}
		});
	}

	/**
	 * @param { string } nodeName
	 * @returns { Vector2 }
	 */
	computeParentScale(nodeName) {
		const description = this.findNodeDescription(nodeName);
		let scaleX = 1;
		let scaleY = 1;
		let parentName = description ? description.parent : null;
		while (parentName) {
			const parentDescription = this.findNodeDescription(parentName);
			if (!parentDescription) {
				break;
			}
			scaleX *= System.Number(this.getCurrentValue(parentDescription.name, "scaleX")) || 1;
			scaleY *= System.Number(this.getCurrentValue(parentDescription.name, "scaleY")) || 1;
			parentName = parentDescription.parent;
		}
		return Vector2.create(scaleX === 0 ? 1 : scaleX, scaleY === 0 ? 1 : scaleY);
	}

	/**
	 * @param { Vector2 } viewPosition
	 * @returns { string | null }
	 */
	hitTestStage(viewPosition) {
		const nodes = this.#document.stage.nodes;
		for (let nodeIndex = nodes.length - 1; nodeIndex >= 0; --nodeIndex) {
			const description = nodes[nodeIndex];
			const node = this.#nodeTable.get(description.name);
			if (!node || !node.isActiveInHierarchy()) {
				continue;
			}
			if (node.contains(viewPosition)) {
				return description.name;
			}
		}
		return null;
	}

	//==============================================================================
	// 프리뷰 바탕 / 덧그리기.
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 */
	drawViewBackground(graphic) {
		const viewManager = this.#engine.getViewManager();
		const canvasNativeSize = viewManager.getCanvasNativeSize();
		viewManager.applyCanvasNativeRect(graphic);
		graphic.setFillColor("rgb(16, 17, 20)");
		graphic.drawRect(Rect.create(0, 0, canvasNativeSize.x, canvasNativeSize.y));
		viewManager.applyViewRect(graphic);
		const backgroundChannels = parseTimelineColor(this.#document.stage.backgroundColor);
		graphic.setFillColor("rgba(" + System.Math.round(backgroundChannels[0] * 255) + "," + System.Math.round(backgroundChannels[1] * 255) + "," + System.Math.round(backgroundChannels[2] * 255) + "," + backgroundChannels[3] + ")");
		graphic.drawRect(Rect.create(0, 0, this.#document.stage.width, this.#document.stage.height));
	}

	/**
	 * @param { Graphic } graphic
	 */
	drawViewOverlay(graphic) {
		if (this.#isEditView === false) {
			return;
		}
		const stageWidth = this.#document.stage.width;
		const stageHeight = this.#document.stage.height;
		if (this.#isGridVisible) {
			const gridSize = 50;
			graphic.setStrokeColor("rgba(255, 255, 255, 0.05)");
			for (let x = 0; x <= stageWidth; x += gridSize) {
				graphic.drawLine([Vector2.create(x, 0), Vector2.create(x, stageHeight)], 1);
			}
			for (let y = 0; y <= stageHeight; y += gridSize) {
				graphic.drawLine([Vector2.create(0, y), Vector2.create(stageWidth, y)], 1);
			}
		}
		graphic.setStrokeColor("rgba(255, 255, 255, 0.18)");
		graphic.drawStrokeRect(Rect.create(0, 0, stageWidth, stageHeight), 1);

		// 선택 노드 테두리 + 피벗.
		const selectedNode = this.#selectedNodeName ? this.#nodeTable.get(this.#selectedNodeName) : null;
		if (selectedNode) {
			const corners = selectedNode.getWorldCorners();
			graphic.setStrokeColor(EditorTheme.accentColor);
			graphic.drawLineLoop(corners, 1.5);
			const pivotPosition = selectedNode.getPosition();
			graphic.setStrokeColor("rgba(212, 176, 106, 0.9)");
			graphic.drawLine([Vector2.create(pivotPosition.x - 7, pivotPosition.y), Vector2.create(pivotPosition.x + 7, pivotPosition.y)], 1.5);
			graphic.drawLine([Vector2.create(pivotPosition.x, pivotPosition.y - 7), Vector2.create(pivotPosition.x, pivotPosition.y + 7)], 1.5);
		}
	}

	//==============================================================================
	// 엔진 실행.
	//==============================================================================
	startEngine() {
		const engineConfiguration = new EngineConfiguration();
		engineConfiguration.referenceResolutionSize = Vector2.create(this.#document.stage.width, this.#document.stage.height);
		engineConfiguration.canvasId = "previewCanvas";
		engineConfiguration.autoResizeOnWindowResize = false;
		this.#engine = new Engine(engineConfiguration);
		Timeline.setAudioManager(this.#engine.getAudioManager());
		const previewScene = new PreviewScene((scene) => {
			const rootNode = scene.getRoot();
			rootNode.setPivot(Pivot.topLeft.clone());
			rootNode.setAnchor(Pivot.topLeft.clone());
			this.#stageRootNode = new WorldNode();
			this.#stageRootNode.setName("Stage");
			this.#stageRootNode.setPivot(Pivot.topLeft.clone());
			this.#stageRootNode.setAnchor(Pivot.topLeft.clone());
			this.#stageRootNode.setLocalPosition(Vector2.create(0, 0));
			rootNode.addChild(this.#stageRootNode);
			const viewManager = this.#engine.getViewManager();
			viewManager.setViewScaleMode(ViewScaleMode.stretchShort);
			this.collectEmbeddedAssets();
			this.rebuildStage();
			this.rebuildAssetList();
			this.afterDocumentChanged();
			this.#timelinePanel.zoomToFit();
		}, (timeDelta) => {
			this.onTick(timeDelta);
		}, (graphic) => {
			this.drawViewBackground(graphic);
		}, (graphic) => {
			this.drawViewOverlay(graphic);
		});
		this.#engine.run(previewScene);
	}
}


//==============================================================================
// 편집기 실행.
//==============================================================================
applyEditorTheme();

const timelineEditor = new TimelineEditor();
setEditorCommandHandler((commandId) => {
	timelineEditor.executeCommand(commandId);
}, (commandId) => {
	return timelineEditor.isCommandChecked(commandId);
});
System.timelineEditor = timelineEditor;
System.document.title = "vanilla.js - Timeline Editor";
timelineEditor.run();
