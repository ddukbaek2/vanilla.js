//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Engine, EngineConfiguration, WorldNode, Vector2, Pivot, Color, Paint, Sprite, Text, UIDocument } from "../../import.js";
import { EDITOR_STYLE_TEXT } from "./editorstyle.js";
import { EditorScene, EditorTool, HandleKind, HANDLE_LENGTH } from "./editorscene.js";
import { ProjectPanel, ASSET_DRAG_TYPE } from "./projectpanel.js";
import { HierarchyPanel } from "./hierarchypanel.js";
import { InspectorPanel } from "./inspectorpanel.js";
import { ModelPreview } from "./modelpreview.js";
import { DockLayout } from "./docklayout.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 되돌리기 기록의 최대 칸 수.
const UNDO_LIMIT = 200;

// 같은 값을 잇달아 바꿀 때 한 칸으로 묶는 시간. (밀리초)
const UNDO_MERGE_MILLISECONDS = 600;

// 콘솔 최대 줄 수.
const CONSOLE_LINE_LIMIT = 500;

// 지난 작업을 브라우저에 남겨 두는 열쇠. (다시 열면 되살린다)
const AUTOSAVE_STORAGE_KEY = "vanillaVisualEditor.autosave";

// 창 배치를 브라우저에 남겨 두는 열쇠.
const DOCK_STORAGE_KEY = "vanillaVisualEditor.dockLayout";

// 처음 창 배치. (하이어라키 왼쪽, 씬과 게임 가운데, 프로젝트와 콘솔 아래, 인스펙터 오른쪽)
const DEFAULT_DOCK_TREE = {
	kind: "split", direction: "row", weights: [1150, 320], children: [
		{
			kind: "split", direction: "column", weights: [3, 1.15], children: [
				{
					kind: "split", direction: "row", weights: [250, 900], children: [
						{ kind: "group", windowIds: ["hierarchy"], activeId: "hierarchy" },
						{ kind: "group", windowIds: ["scene", "game"], activeId: "scene" },
					],
				},
				{ kind: "group", windowIds: ["project", "console"], activeId: "project" },
			],
		},
		{ kind: "group", windowIds: ["inspector"], activeId: "inspector" },
	],
};

// 새 씬을 저장할 기본 경로.
const DEFAULT_SCENE_PATH = "scenes/untitled.scene.json";

// 만들기 메뉴의 노드 종류. (이름, 만드는 함수)
const NODE_PRESET_LIST = [
	{
		label: "빈 노드", create: (node) => {
			node.setContentSize(Vector2.create(100, 100));
		},
	},
	{
		label: "Paint (사각형)", create: (node) => {
			node.setContentSize(Vector2.create(200, 120));
			const paint = node.addComponent(Paint);
			paint.setColor(new Color(0.3, 0.55, 1, 1));
			paint.setRoundSize(12);
		},
	},
	{
		label: "Sprite", create: (node) => {
			node.setContentSize(Vector2.create(128, 128));
			node.addComponent(Sprite);
		},
	},
	{
		label: "Text", create: (node) => {
			node.setContentSize(Vector2.create(240, 48));
			const text = node.addComponent(Text);
			text.setText("Text");
			text.setFontSize(32);
			text.setTextColor(new Color(1, 1, 1, 1));
		},
	},
];


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
// 바이트 수를 읽기 쉬운 글로.
//==============================================================================
/**
 * @param { number } byteCount
 * @returns { string }
 */
function formatByteCount(byteCount) {
	if (byteCount < 1024) {
		return `${byteCount} B`;
	}
	if (byteCount < 1024 * 1024) {
		return `${(byteCount / 1024).toFixed(1)} KB`;
	}
	return `${(byteCount / 1024 / 1024).toFixed(2)} MB`;
}


//==============================================================================
// 비주얼 에디터. (유니티처럼 씬을 짓고, 애셋을 다루고, 저장하고, 재생해 본다)
// - 화면: 위 메뉴와 도구 막대 밑에 도킹 창들(Hierarchy, Scene, Game, Inspector, Project, Console).
//   창 탭을 끌어 다른 창에 탭으로 합치거나 위아래양옆으로 나누어 붙인다. (docklayout.js)
// - 씬은 UIDocument 형식(.scene.json)으로 저장한다. 게임은 UIDocument.fromJsonText 로 그대로 읽는다.
//   에디터만 쓰는 값(frameSize)은 같은 JSON 에 함께 둔다. (UIDocument 는 모르는 키를 무시한다)
// - 되돌리기는 바꾸기 전 문서 전체를 JSON 으로 남기는 방식이다. 고른 노드는 자식 차례 경로로 되찾는다.
// - 재생은 문서를 남겨 두고 노드를 갱신하다가, 멈추면 남겨 둔 문서로 되돌린다. (유니티처럼 재생 중 바꾼 것은 사라진다)
//==============================================================================
export class VisualEditor {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object } */ #elements; // 화면 요소 모음.
	/** @private @type { Engine } */ #engine;
	/** @private @type { EditorScene } */ #scene;
	/** @private @type { ProjectPanel } */ #projectPanel;
	/** @private @type { HierarchyPanel } */ #hierarchyPanel;
	/** @private @type { InspectorPanel } */ #inspectorPanel;
	/** @private @type { Array<object> } */ #undoList; // { label, jsonText, selectionPath }
	/** @private @type { Array<object> } */ #redoList;
	/** @private @type { object } */ #lastChange; // { label, node, time } 잇단 바꾸기 묶기.
	/** @private @type { string } */ #scenePath;
	/** @private @type { boolean } */ #isDirty;
	/** @private @type { string | null } */ #playSnapshot; // 재생 전 문서.
	/** @private @type { object | null } */ #dragState; // 씬 뷰에서 끄는 중인 것.
	/** @private @type { boolean } */ #isSpaceDown;
	/** @private @type { HTMLElement | null } */ #contextMenuElement;
	/** @private @type { number } */ #nodeCounter;
	/** @private @type { object | null } */ #clipboardNodeData; // 복사한 노드. (UIDocument.serializeNode 결과)
	/** @private @type { number } */ #autosaveTimer;
	/** @private @type { object | null } */ #savedCameraState; // 게임 뷰로 가기 전 씬 뷰 카메라.
	/** @private @type { DockLayout | null } */ #dockLayout; // 창 도킹 배치.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		this.#undoList = [];
		this.#redoList = [];
		this.#lastChange = { label: "", node: null, time: 0 };
		this.#scenePath = "";
		this.#isDirty = false;
		this.#playSnapshot = null;
		this.#dragState = null;
		this.#isSpaceDown = false;
		this.#contextMenuElement = null;
		this.#nodeCounter = 0;
		this.#clipboardNodeData = null;
		this.#autosaveTimer = 0;
		this.#savedCameraState = null;
		this.#dockLayout = null;
	}

	//==============================================================================
	// 시작. (화면 짓기, 패널, 엔진)
	//==============================================================================
	start() {
		const styleElement = createElement("style");
		styleElement.textContent = EDITOR_STYLE_TEXT;
		System.document.head.append(styleElement);
		this.#elements = this.buildLayout();
		this.hookConsole();
		const elements = this.#elements;
		this.#projectPanel = new ProjectPanel(elements.projectFolders, elements.projectAssets, {
			selectAsset: (asset) => {
				this.showAsset(asset);
			},
			openAsset: (asset) => {
				this.openAsset(asset);
			},
			changed: () => {
				this.updateStatus();
				this.log(`애셋 ${this.#projectPanel.getAssetCount()}개를 읽었다.`);
			},
		});
		UIDocument.setImageResolver((path) => {
			return this.#projectPanel.readImage(path);
		});
		this.#hierarchyPanel = new HierarchyPanel(elements.hierarchyBody, {
			select: (node) => {
				this.select(node);
			},
			move: (node, parentNode, index) => {
				this.moveNode(node, parentNode, index);
			},
			rename: (node, name) => {
				this.change("이름 바꾸기", () => {
					node.setName(name);
				});
			},
			contextMenu: (node, x, y) => {
				this.showNodeContextMenu(node, x, y);
			},
		});
		this.#inspectorPanel = new InspectorPanel(elements.inspectorBody, {
			change: (label, apply) => {
				this.change(label, apply);
			},
			readImage: (path) => {
				return this.#projectPanel.readImage(path);
			},
			addComponent: (node, typeName) => {
				this.addComponent(node, typeName);
			},
			removeComponent: (node, component) => {
				this.change(`${component.constructor.name} 빼기`, () => {
					node.removeComponent(component);
				}, true);
			},
		});

		// 엔진. (씬 뷰 캔버스, 크기는 패널을 따른다)
		const engineConfiguration = new EngineConfiguration();
		engineConfiguration.canvasId = "editorCanvas";
		engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
		engineConfiguration.autoResizeOnWindowResize = false;
		this.#engine = new Engine(engineConfiguration);
		this.#scene = new EditorScene();
		this.#scene.setReadyEvent(() => {
			if (!this.restoreAutosave()) {
				this.createStarterScene();
			}
			this.placeViewCanvas();
			this.refreshAll();
			this.log("에디터를 시작했다. File > 프로젝트 폴더 열기로 애셋 폴더를 연다.");
		});
		this.#engine.run(this.#scene);
		const resizeObserver = new System.ResizeObserver(() => {
			// 가려진 탭에 있으면 크기가 0 이 되므로 그때는 그대로 둔다.
			if (elements.canvasHolder.clientWidth > 0 && elements.canvasHolder.clientHeight > 0) {
				this.#engine.resize();
			}
		});
		resizeObserver.observe(elements.canvasHolder);
		this.setupSceneInput();
		this.setupKeyboard();
		System.window.addEventListener("beforeunload", (beforeUnloadEvent) => {
			if (this.#isDirty) {
				beforeUnloadEvent.preventDefault();
			}
		});
		System.setInterval(() => {
			this.updateOverlay();
		}, 250);
	}

	//==============================================================================
	// 화면 짓기. (위 메뉴와 도구 막대, 가운데 도킹 창들, 아래 상태 줄)
	// - 창마다 내용 요소와 탭 줄 오른쪽 도구 요소를 만들어 도킹 배치에 넘긴다.
	// - Scene 창과 Game 창은 캔버스 하나를 나누어 쓴다. 고른 쪽으로 캔버스를 옮겨 달고, 다른 쪽에는 안내를 둔다.
	//==============================================================================
	/**
	 * @returns { object }
	 */
	buildLayout() {
		const rootElement = createElement("div", "editorRoot");
		const menuBar = createElement("div", "menuBar");
		const toolBar = createElement("div", "toolBar");
		const dockRootElement = createElement("div", "dockRoot");
		const statusBar = createElement("div", "statusBar");
		rootElement.append(menuBar, toolBar, dockRootElement, statusBar);
		System.document.body.append(rootElement);

		// Hierarchy.
		const hierarchyContent = createElement("div", "panel hierarchyPanel");
		const hierarchyAddButton = createElement("button", "smallButton", "＋");
		hierarchyAddButton.title = "노드 만들기";
		const hierarchySearch = createElement("input", "inspectorNameInput hierarchySearch");
		hierarchySearch.placeholder = "찾기";
		hierarchySearch.addEventListener("input", () => {
			this.#hierarchyPanel.setFilterText(hierarchySearch.value.trim());
		});
		hierarchySearch.addEventListener("keydown", (keyboardEvent) => {
			keyboardEvent.stopPropagation();
		});
		const hierarchyBody = createElement("div", "panelBody");
		hierarchyContent.append(hierarchySearch, hierarchyBody);
		hierarchyAddButton.addEventListener("click", (mouseEvent) => {
			mouseEvent.stopPropagation();
			const buttonRect = hierarchyAddButton.getBoundingClientRect();
			this.showNodeContextMenu(null, buttonRect.left, buttonRect.bottom);
		});

		// Scene 과 Game. (캔버스 하나를 나누어 쓴다)
		const canvasHolder = createElement("div", "sceneCanvasHolder");
		const canvasElement = createElement("canvas");
		canvasElement.id = "editorCanvas";
		canvasElement.tabIndex = 0;
		const sceneTitle = createElement("div", "sceneTitleOverlay");
		const sceneOverlay = createElement("div", "sceneOverlay");
		canvasHolder.append(canvasElement, sceneTitle, sceneOverlay);
		const viewHostTable = {};
		for (const windowId of ["scene", "game"]) {
			const viewContent = createElement("div", `panel ${windowId}ViewPanel`);
			const viewHost = createElement("div", "viewHost");
			const placeholder = createElement("div", "viewPlaceholder", windowId === "scene" ? "씬 뷰는 지금 Game 창에 있다.\n누르면 여기로 옮긴다." : "게임 뷰는 지금 Scene 창에 있다.\n누르면 여기로 옮긴다.");
			placeholder.style.whiteSpace = "pre-line";
			placeholder.addEventListener("click", () => {
				this.setGameView(windowId === "game");
			});
			viewHost.append(placeholder);
			viewContent.append(viewHost);
			viewHostTable[windowId] = { content: viewContent, host: viewHost, placeholder };
		}

		// Inspector.
		const inspectorContent = createElement("div", "panel inspectorPanel");
		const inspectorBody = createElement("div", "panelBody");
		inspectorContent.append(inspectorBody);

		// Project.
		const projectContent = createElement("div", "panel projectPanel");
		const projectButtons = createElement("div", "windowToolButtons");
		const openFolderButton = createElement("button", "smallButton", "폴더 열기");
		openFolderButton.addEventListener("click", () => {
			this.openProjectFolder();
		});
		const importButton = createElement("button", "smallButton", "가져오기");
		importButton.title = "파일을 지금 폴더로 가져온다";
		importButton.addEventListener("click", () => {
			this.importAssetFiles();
		});
		const rescanButton = createElement("button", "smallButton", "새로 고침");
		rescanButton.addEventListener("click", () => {
			this.#projectPanel.rescan();
		});
		projectButtons.append(openFolderButton, importButton, rescanButton);
		const projectBody = createElement("div", "panelBody projectBody");
		const projectFolders = createElement("div", "projectFolders");
		const projectAssets = createElement("div", "projectAssets");
		projectBody.append(projectFolders, projectAssets);
		projectContent.append(projectBody);

		// Console.
		const consoleContent = createElement("div", "panel consolePanel");
		const consoleClearButton = createElement("button", "smallButton", "지우기");
		const consoleBody = createElement("div", "panelBody consoleBody");
		consoleContent.append(consoleBody);
		consoleClearButton.addEventListener("click", () => {
			consoleBody.textContent = "";
		});

		const elements = {
			rootElement, menuBar, toolBar, dockRootElement, hierarchyBody, sceneTitle, canvasHolder, canvasElement, sceneOverlay,
			inspectorBody, projectFolders, projectAssets, consoleBody, statusBar, toolButtons: {}, playButton: null,
			viewHostTable, viewWindowId: "",
		};
		this.#elements = elements;

		// 도킹 배치. (처음 모양은 하이어라키 왼쪽, 씬 가운데, 인스펙터 오른쪽, 프로젝트와 콘솔 아래)
		const windowList = [
			{ id: "hierarchy", title: "Hierarchy", contentElement: hierarchyContent, toolElement: hierarchyAddButton, homeSide: "left" },
			{ id: "scene", title: "Scene", contentElement: viewHostTable.scene.content, isClosable: false, homeSide: "center" },
			{ id: "game", title: "Game", contentElement: viewHostTable.game.content, homeSide: "center", homeNeighborId: "scene" },
			{ id: "inspector", title: "Inspector", contentElement: inspectorContent, homeSide: "right" },
			{ id: "project", title: "Project", contentElement: projectContent, toolElement: projectButtons, homeSide: "bottom", homeNeighborId: "console" },
			{ id: "console", title: "Console", contentElement: consoleContent, toolElement: consoleClearButton, homeSide: "bottom", homeNeighborId: "project" },
		];
		this.#dockLayout = new DockLayout(dockRootElement, windowList, DEFAULT_DOCK_TREE, DOCK_STORAGE_KEY, {
			activate: (windowId) => {
				if (windowId === "scene" || windowId === "game") {
					this.attachViewCanvas(windowId);
				}
			},
			rendered: () => {
				this.placeViewCanvas();
			},
		});
		this.#dockLayout.render();
		this.buildMenu(menuBar);
		this.buildToolBar(toolBar, elements);
		return elements;
	}

	//==============================================================================
	// 캔버스를 둘 창 정하기. (지금 단 창이 가려졌는데 다른 쪽이 보이면 그쪽으로 옮긴다)
	//==============================================================================
	placeViewCanvas() {
		const elements = this.#elements;
		const dockLayout = this.#dockLayout;
		if (!elements || !dockLayout) {
			return;
		}
		let windowId = elements.viewWindowId || "scene";
		if (!dockLayout.isWindowOpen(windowId)) {
			windowId = "scene";
		}
		const otherId = windowId === "scene" ? "game" : "scene";
		if (!dockLayout.isWindowVisible(windowId) && dockLayout.isWindowVisible(otherId)) {
			windowId = otherId;
		}
		this.attachViewCanvas(windowId);
	}

	//==============================================================================
	// 캔버스를 Scene 창이나 Game 창에 달기. (게임 뷰 여부도 맞춘다)
	//==============================================================================
	/**
	 * @param { string } windowId scene, game
	 */
	attachViewCanvas(windowId) {
		const elements = this.#elements;
		const viewHostTable = elements.viewHostTable;
		const host = viewHostTable[windowId].host;
		if (elements.canvasHolder.parentElement !== host) {
			host.append(elements.canvasHolder);
		}
		viewHostTable.scene.placeholder.style.display = windowId === "scene" ? "none" : "";
		viewHostTable.game.placeholder.style.display = windowId === "game" ? "none" : "";
		elements.viewWindowId = windowId;
		if (this.#scene) {
			this.applyGameView(windowId === "game");
		}
	}

	//==============================================================================
	// 메뉴 짓기.
	//==============================================================================
	/**
	 * @param { HTMLElement } menuBar
	 */
	buildMenu(menuBar) {
		const menuList = [
			{
				title: "File", commands: [
					{ label: "새 씬", shortcut: "Ctrl+N", run: () => this.newScene() },
					{ label: "프로젝트 폴더 열기", shortcut: "", run: () => this.openProjectFolder() },
					{ label: "씬 파일 열기", shortcut: "Ctrl+O", run: () => this.openSceneFile() },
					null,
					{ label: "씬 저장", shortcut: "Ctrl+S", run: () => this.saveScene(false) },
					{ label: "다른 이름으로 저장", shortcut: "Ctrl+Shift+S", run: () => this.saveScene(true) },
					null,
					{ label: "애셋 가져오기", shortcut: "", run: () => this.importAssetFiles() },
					{ label: "고른 노드를 프리팹으로 저장", shortcut: "", run: () => this.saveSelectedAsPrefab() },
				],
			},
			{
				title: "Edit", commands: [
					{ label: "되돌리기", shortcut: "Ctrl+Z", run: () => this.undo() },
					{ label: "다시 하기", shortcut: "Ctrl+Shift+Z", run: () => this.redo() },
					null,
					{ label: "복사", shortcut: "Ctrl+C", run: () => this.copySelected() },
					{ label: "붙여넣기", shortcut: "Ctrl+V", run: () => this.pasteNode() },
					{ label: "복제", shortcut: "Ctrl+D", run: () => this.duplicateSelected() },
					{ label: "지우기", shortcut: "Delete", run: () => this.deleteSelected() },
					null,
					{ label: "재생 / 멈춤", shortcut: "Ctrl+P", run: () => this.togglePlay() },
				],
			},
			{
				title: "Node", commands: NODE_PRESET_LIST.map((preset) => {
					return { label: `${preset.label} 만들기`, shortcut: "", run: () => this.createNode(preset, null) };
				}),
			},
			{
				title: "View", commands: [
					{ label: "씬 뷰 / 게임 뷰", shortcut: "Tab", run: () => this.setGameView(!this.#scene.isGameView()) },
					{ label: "화면 틀 맞추기", shortcut: "Home", run: () => this.#scene.frameDocument() },
					{ label: "고른 노드로", shortcut: "F", run: () => this.#scene.frameSelected() },
					null,
					{ label: "화면 틀 크기", shortcut: "", run: () => this.askFrameSize() },
				],
			},
			{
				title: "Window", commands: [
					{ label: "Hierarchy", shortcut: "", run: () => this.#dockLayout.activateWindow("hierarchy") },
					{ label: "Scene", shortcut: "", run: () => this.setGameView(false) },
					{ label: "Game", shortcut: "", run: () => this.setGameView(true) },
					{ label: "Inspector", shortcut: "", run: () => this.#dockLayout.activateWindow("inspector") },
					{ label: "Project", shortcut: "", run: () => this.#dockLayout.activateWindow("project") },
					{ label: "Console", shortcut: "", run: () => this.#dockLayout.activateWindow("console") },
					null,
					{ label: "창 배치 되돌리기", shortcut: "", run: () => this.#dockLayout.resetLayout() },
				],
			},
		];
		let openMenuElement = null;
		const closeMenu = () => {
			if (openMenuElement !== null) {
				openMenuElement.classList.remove("isOpen");
				openMenuElement = null;
			}
		};
		for (const menu of menuList) {
			const menuElement = createElement("div", "menuItem", menu.title);
			const popupElement = createElement("div", "menuPopup");
			for (const command of menu.commands) {
				if (command === null) {
					popupElement.append(createElement("div", "menuSeparator"));
					continue;
				}
				const commandElement = createElement("div", "menuCommand");
				commandElement.append(createElement("span", "", command.label), createElement("span", "menuShortcut", command.shortcut));
				commandElement.addEventListener("click", (mouseEvent) => {
					mouseEvent.stopPropagation();
					closeMenu();
					command.run();
				});
				popupElement.append(commandElement);
			}
			menuElement.append(popupElement);
			menuElement.addEventListener("click", (mouseEvent) => {
				mouseEvent.stopPropagation();
				const isOpen = menuElement === openMenuElement;
				closeMenu();
				if (!isOpen) {
					menuElement.classList.add("isOpen");
					openMenuElement = menuElement;
				}
			});
			menuElement.addEventListener("mouseenter", () => {
				if (openMenuElement !== null && openMenuElement !== menuElement) {
					closeMenu();
					menuElement.classList.add("isOpen");
					openMenuElement = menuElement;
				}
			});
			menuBar.append(menuElement);
		}
		System.document.addEventListener("click", () => {
			closeMenu();
			this.closeContextMenu();
		});
	}

	//==============================================================================
	// 도구 막대 짓기. (도구, 재생, 저장)
	//==============================================================================
	/**
	 * @param { HTMLElement } toolBar
	 * @param { object } elements
	 */
	buildToolBar(toolBar, elements) {
		const toolGroup = createElement("div", "toolGroup");
		const toolList = [
			{ tool: EditorTool.hand, label: "✋", title: "밀기 (Q)" },
			{ tool: EditorTool.move, label: "✥", title: "옮기기 (W)" },
			{ tool: EditorTool.rotate, label: "⟳", title: "돌리기 (E)" },
			{ tool: EditorTool.scale, label: "⤢", title: "키우기 (R)" },
		];
		for (const toolItem of toolList) {
			const buttonElement = createElement("button", "toolButton", toolItem.label);
			buttonElement.title = toolItem.title;
			buttonElement.addEventListener("click", () => {
				this.setTool(toolItem.tool);
			});
			elements.toolButtons[toolItem.tool] = buttonElement;
			toolGroup.append(buttonElement);
		}
		const playGroup = createElement("div", "toolGroup");
		const playButton = createElement("button", "toolButton", "▶ 재생");
		playButton.title = "재생 / 멈춤 (Ctrl+P)";
		playButton.addEventListener("click", () => {
			this.togglePlay();
		});
		elements.playButton = playButton;
		playGroup.append(playButton);
		const fileGroup = createElement("div", "toolGroup");
		const saveButton = createElement("button", "toolButton", "저장");
		saveButton.title = "씬 저장 (Ctrl+S)";
		saveButton.addEventListener("click", () => {
			this.saveScene(false);
		});
		const undoButton = createElement("button", "toolButton", "↶");
		undoButton.title = "되돌리기 (Ctrl+Z)";
		undoButton.addEventListener("click", () => {
			this.undo();
		});
		const redoButton = createElement("button", "toolButton", "↷");
		redoButton.title = "다시 하기 (Ctrl+Shift+Z)";
		redoButton.addEventListener("click", () => {
			this.redo();
		});
		fileGroup.append(saveButton, undoButton, redoButton);
		toolBar.append(toolGroup, createElement("div", "toolSpacer"), playGroup, createElement("div", "toolSpacer"), fileGroup);
		toolGroup.querySelector("button:nth-child(2)").classList.add("isActive");
	}

	//==============================================================================
	// 처음 씬. (틀 가운데 제목 글과 사각형 하나)
	//==============================================================================
	createStarterScene() {
		const documentRoot = this.#scene.getDocumentRoot();
		const frameSize = this.#scene.getFrameSize();
		const panelNode = new WorldNode();
		panelNode.setName("Panel");
		panelNode.setContentSize(Vector2.create(520, 300));
		panelNode.setLocalPosition(Vector2.create(frameSize.x * 0.5, frameSize.y * 0.5));
		const paint = panelNode.addComponent(Paint);
		paint.setColor(new Color(0.22, 0.4, 0.75, 1));
		paint.setRoundSize(24);
		documentRoot.addChild(panelNode);
		const titleNode = new WorldNode();
		titleNode.setName("Title");
		titleNode.setContentSize(Vector2.create(440, 60));
		titleNode.setLocalPosition(Vector2.create(260, 110));
		const text = titleNode.addComponent(Text);
		text.setText("vanilla.js");
		text.setFontSize(48);
		text.setTextColor(new Color(1, 1, 1, 1));
		panelNode.addChild(titleNode);
		this.#scenePath = "";
		this.#isDirty = false;
	}

	//==============================================================================
	// 값 바꾸기. (되돌리기 한 칸을 남기고 적용, 같은 것을 잇달아 바꾸면 한 칸으로 묶는다)
	//==============================================================================
	/**
	 * @param { string } label
	 * @param { function(): void } apply
	 * @param { boolean } isStructural - 노드나 컴포넌트가 늘거나 줄면 true. (패널을 다시 짓는다)
	 */
	change(label, apply, isStructural = false) {
		const selectedNode = this.#scene.getSelectedNode();
		const now = System.performance.now();
		const lastChange = this.#lastChange;
		const isMerged = !isStructural && lastChange.label === label && lastChange.node === selectedNode && now - lastChange.time < UNDO_MERGE_MILLISECONDS;
		if (!isMerged) {
			this.recordUndo(label);
		}
		this.#lastChange = { label: label, node: selectedNode, time: now };
		try {
			apply();
		}
		catch (error) {
			this.log(`${label}: ${error.message}`, "error");
		}
		this.markDirty();
		if (isStructural) {
			this.refreshAll();
		}
		else {
			this.#inspectorPanel.refresh();
			this.#hierarchyPanel.render(this.#scene.getDocumentRoot(), this.#scene.getSelectedNode());
		}
	}

	//==============================================================================
	// 되돌리기 한 칸 남기기. (지금 문서 전체)
	//==============================================================================
	/**
	 * @param { string } label
	 */
	recordUndo(label) {
		this.#undoList.push(this.captureState(label));
		if (this.#undoList.length > UNDO_LIMIT) {
			this.#undoList.shift();
		}
		this.#redoList.length = 0;
	}

	//==============================================================================
	// 지금 문서와 고른 노드 남기기.
	//==============================================================================
	/**
	 * @param { string } label
	 * @returns { object }
	 */
	captureState(label) {
		const documentRoot = this.#scene.getDocumentRoot();
		return {
			label: label,
			jsonText: UIDocument.toJsonText(documentRoot, false),
			selectionPath: this.findIndexPath(this.#scene.getSelectedNode()),
		};
	}

	//==============================================================================
	// 남긴 문서로 되돌리기.
	//==============================================================================
	/**
	 * @param { object } state
	 */
	restoreState(state) {
		const documentRoot = UIDocument.fromJsonText(state.jsonText);
		this.#scene.replaceDocumentRoot(documentRoot);
		this.#scene.setSelectedNode(this.findNodeByIndexPath(state.selectionPath));
		this.#lastChange = { label: "", node: null, time: 0 };
		this.refreshAll();
	}

	//==============================================================================
	// 되돌리기와 다시 하기.
	//==============================================================================
	undo() {
		const state = this.#undoList.pop();
		if (!state) {
			return;
		}
		this.#redoList.push(this.captureState(state.label));
		this.restoreState(state);
		this.markDirty();
		this.log(`되돌림: ${state.label}`);
	}

	redo() {
		const state = this.#redoList.pop();
		if (!state) {
			return;
		}
		this.#undoList.push(this.captureState(state.label));
		this.restoreState(state);
		this.markDirty();
		this.log(`다시 함: ${state.label}`);
	}

	//==============================================================================
	// 노드의 자식 차례 경로. (문서 루트부터, 이름이 겹쳐도 하나로 정해진다)
	//==============================================================================
	/**
	 * @param { WorldNode | null } node
	 * @returns { Array<number> | null }
	 */
	findIndexPath(node) {
		if (node === null) {
			return null;
		}
		const documentRoot = this.#scene.getDocumentRoot();
		const indexPath = [];
		let currentNode = node;
		while (currentNode !== null && currentNode !== undefined && currentNode !== documentRoot) {
			const parentNode = currentNode.getParent();
			if (!parentNode) {
				return null;
			}
			indexPath.unshift(parentNode.getChildren().indexOf(currentNode));
			currentNode = parentNode;
		}
		return currentNode === documentRoot ? indexPath : null;
	}

	//==============================================================================
	// 자식 차례 경로로 노드 찾기.
	//==============================================================================
	/**
	 * @param { Array<number> | null } indexPath
	 * @returns { WorldNode | null }
	 */
	findNodeByIndexPath(indexPath) {
		if (indexPath === null) {
			return null;
		}
		let currentNode = this.#scene.getDocumentRoot();
		for (const childIndex of indexPath) {
			const childNodeList = currentNode.getChildren();
			if (childIndex < 0 || childIndex >= childNodeList.length) {
				return null;
			}
			currentNode = childNodeList[childIndex];
		}
		return currentNode;
	}

	//==============================================================================
	// 노드 고르기.
	//==============================================================================
	/**
	 * @param { WorldNode | null } node
	 */
	select(node) {
		if (node === this.#scene.getSelectedNode()) {
			return;
		}
		this.#scene.setSelectedNode(node);
		this.#lastChange = { label: "", node: null, time: 0 };
		if (node !== null) {
			this.#hierarchyPanel.revealNode(node);
		}
		this.#hierarchyPanel.render(this.#scene.getDocumentRoot(), node);
		this.#inspectorPanel.render(node);
		this.updateStatus();
	}

	//==============================================================================
	// 노드 만들기. (부모가 없으면 고른 노드 밑, 그것도 없으면 맨 위, 화면 가운데에)
	//==============================================================================
	/**
	 * @param { object } preset
	 * @param { WorldNode | null } parentNode
	 * @returns { WorldNode }
	 */
	createNode(preset, parentNode) {
		const node = new WorldNode();
		this.#nodeCounter += 1;
		node.setName(preset.label.split(" ")[0].replace("빈", "Node") + this.#nodeCounter);
		preset.create(node);
		this.change(`${preset.label} 만들기`, () => {
			const targetParent = parentNode || this.#scene.getDocumentRoot();
			targetParent.addChild(node);
			const viewSize = this.#engine.getViewManager().getViewSize();
			this.placeAtViewPosition(node, Vector2.create(viewSize.x * 0.5, viewSize.y * 0.5));
			this.#scene.setSelectedNode(node);
		}, true);
		return node;
	}

	//==============================================================================
	// 노드를 화면 위치로 옮기기. (부모의 회전과 크기를 풀어 지역 위치로)
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @param { Vector2 } viewPosition
	 */
	placeAtViewPosition(node, viewPosition) {
		const currentPosition = node.getPosition();
		const localDelta = this.worldDeltaToLocal(node, viewPosition.x - currentPosition.x, viewPosition.y - currentPosition.y);
		const localPosition = node.getLocalPosition();
		node.setLocalPosition(Vector2.create(System.Math.round(localPosition.x + localDelta.x), System.Math.round(localPosition.y + localDelta.y)));
	}

	//==============================================================================
	// 화면에서의 움직임을 부모 기준 움직임으로.
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @param { number } deltaX
	 * @param { number } deltaY
	 * @returns { Vector2 }
	 */
	worldDeltaToLocal(node, deltaX, deltaY) {
		const parentNode = node.getParent();
		if (!parentNode) {
			return Vector2.create(deltaX, deltaY);
		}
		const radian = -parentNode.getRotation() * System.Math.PI / 180;
		const cosine = System.Math.cos(radian);
		const sine = System.Math.sin(radian);
		const parentScale = parentNode.getScale();
		const rotatedX = deltaX * cosine - deltaY * sine;
		const rotatedY = deltaX * sine + deltaY * cosine;
		return Vector2.create(parentScale.x !== 0 ? rotatedX / parentScale.x : 0, parentScale.y !== 0 ? rotatedY / parentScale.y : 0);
	}

	//==============================================================================
	// 노드 옮기기. (부모와 차례, 화면 위치는 지킨다)
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @param { WorldNode } parentNode
	 * @param { number } index
	 */
	moveNode(node, parentNode, index) {
		this.change("부모 바꾸기", () => {
			const worldPosition = node.getPosition();
			const oldParent = node.getParent();
			let targetIndex = index;
			if (oldParent === parentNode && oldParent.getChildren().indexOf(node) < index) {
				targetIndex -= 1;
			}
			if (oldParent !== parentNode) {
				parentNode.addChild(node);
				this.placeAtViewPosition(node, worldPosition);
			}
			node.setSiblingIndex(targetIndex);
		}, true);
	}

	//==============================================================================
	// 컴포넌트 더하기.
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @param { string } typeName
	 */
	addComponent(node, typeName) {
		const componentType = UIDocument.getComponentType(typeName);
		if (!componentType) {
			return;
		}
		this.change(`${typeName} 더하기`, () => {
			node.addComponent(componentType);
		}, true);
	}

	//==============================================================================
	// 고른 노드 복제. (바로 뒤 형제로)
	//==============================================================================
	duplicateSelected() {
		const selectedNode = this.#scene.getSelectedNode();
		if (selectedNode === null) {
			return;
		}
		this.change("복제", () => {
			const nodeData = UIDocument.serializeNode(selectedNode);
			const copiedNode = UIDocument.deserializeNode(nodeData);
			const parentNode = selectedNode.getParent();
			parentNode.addChild(copiedNode);
			copiedNode.setSiblingIndex(parentNode.getChildren().indexOf(selectedNode) + 1);
			const localPosition = copiedNode.getLocalPosition();
			copiedNode.setLocalPosition(Vector2.create(localPosition.x + 20, localPosition.y + 20));
			copiedNode.setName(`${selectedNode.getName()} (복제)`);
			this.#scene.setSelectedNode(copiedNode);
		}, true);
	}

	//==============================================================================
	// 고른 노드 지우기.
	//==============================================================================
	deleteSelected() {
		const selectedNode = this.#scene.getSelectedNode();
		if (selectedNode === null) {
			return;
		}
		this.change("지우기", () => {
			selectedNode.getParent().removeChild(selectedNode);
			this.#scene.setSelectedNode(null);
		}, true);
	}

	//==============================================================================
	// 노드 오른쪽 클릭 메뉴.
	//==============================================================================
	/**
	 * @param { WorldNode | null } node
	 * @param { number } x
	 * @param { number } y
	 */
	showNodeContextMenu(node, x, y) {
		const commandList = NODE_PRESET_LIST.map((preset) => {
			return { label: node === null ? `${preset.label} 만들기` : `자식으로 ${preset.label}`, run: () => this.createNode(preset, node) };
		});
		if (node !== null) {
			commandList.push(null);
			commandList.push({ label: "복사", run: () => this.copySelected() });
			commandList.push({ label: "붙여넣기", run: () => this.pasteNode() });
			commandList.push({ label: "복제", run: () => this.duplicateSelected() });
			commandList.push({ label: "프리팹으로 저장", run: () => this.saveSelectedAsPrefab() });
			commandList.push({ label: "지우기", run: () => this.deleteSelected() });
			commandList.push({ label: "고른 노드로 보기", run: () => this.#scene.frameSelected() });
		}
		this.showContextMenu(commandList, x, y);
	}

	//==============================================================================
	// 떠 있는 메뉴 띄우기.
	//==============================================================================
	/**
	 * @param { Array<object | null> } commandList - { label, run } 또는 null(구분선)
	 * @param { number } x
	 * @param { number } y
	 */
	showContextMenu(commandList, x, y) {
		this.closeContextMenu();
		const menuElement = createElement("div", "contextMenu");
		for (const command of commandList) {
			if (command === null) {
				menuElement.append(createElement("div", "menuSeparator"));
				continue;
			}
			const commandElement = createElement("div", "menuCommand", command.label);
			commandElement.addEventListener("click", (mouseEvent) => {
				mouseEvent.stopPropagation();
				this.closeContextMenu();
				command.run();
			});
			menuElement.append(commandElement);
		}
		menuElement.style.left = `${x}px`;
		menuElement.style.top = `${y}px`;
		System.document.body.append(menuElement);
		const menuRect = menuElement.getBoundingClientRect();
		if (menuRect.bottom > System.window.innerHeight) {
			menuElement.style.top = `${System.Math.max(0, y - menuRect.height)}px`;
		}
		this.#contextMenuElement = menuElement;
		menuElement.addEventListener("click", (mouseEvent) => {
			mouseEvent.stopPropagation();
		});
	}

	closeContextMenu() {
		if (this.#contextMenuElement !== null) {
			this.#contextMenuElement.remove();
			this.#contextMenuElement = null;
		}
	}

	//==============================================================================
	// 씬 뷰 입력. (고르기, 손잡이 끌기, 밀기, 키우기, 애셋 놓기)
	//==============================================================================
	setupSceneInput() {
		const canvasElement = this.#elements.canvasElement;
		const readViewPosition = (pointerEvent) => {
			const canvasRect = canvasElement.getBoundingClientRect();
			return Vector2.create(pointerEvent.clientX - canvasRect.left, pointerEvent.clientY - canvasRect.top);
		};
		canvasElement.addEventListener("contextmenu", (mouseEvent) => {
			mouseEvent.preventDefault();
		});
		canvasElement.addEventListener("pointerdown", (pointerEvent) => {
			canvasElement.focus();
			this.closeContextMenu();
			const scene = this.#scene;
			const viewPosition = readViewPosition(pointerEvent);
			canvasElement.setPointerCapture(pointerEvent.pointerId);
			if (scene.isGameView()) {
				return;
			}
			const isPan = pointerEvent.button === 1 || pointerEvent.button === 2 || this.#isSpaceDown || scene.getTool() === EditorTool.hand;
			if (isPan) {
				this.#dragState = { kind: "pan", lastPosition: viewPosition };
				return;
			}
			if (pointerEvent.button !== 0) {
				return;
			}
			let handleKind = scene.pickHandle(viewPosition);
			if (handleKind === HandleKind.none) {
				const pickedNode = scene.pickNode(viewPosition);
				this.select(pickedNode);
				if (pickedNode === null) {
					this.#dragState = null;
					return;
				}
				handleKind = scene.getTool() === EditorTool.move ? HandleKind.moveFree : HandleKind.none;
				if (handleKind === HandleKind.none) {
					return;
				}
			}
			const node = scene.getSelectedNode();
			this.#dragState = {
				kind: "handle",
				handleKind: handleKind,
				node: node,
				startPosition: viewPosition,
				startLocalPosition: node.getLocalPosition().clone(),
				startLocalScale: node.getLocalScale().clone(),
				startLocalRotation: node.getLocalRotation(),
				startAngle: System.Math.atan2(viewPosition.y - node.getPosition().y, viewPosition.x - node.getPosition().x),
				isRecorded: false,
			};
		});
		canvasElement.addEventListener("pointermove", (pointerEvent) => {
			const viewPosition = readViewPosition(pointerEvent);
			const dragState = this.#dragState;
			if (dragState === null) {
				this.#scene.setHoverNode(this.#scene.isGameView() ? null : this.#scene.pickNode(viewPosition));
				return;
			}
			if (dragState.kind === "pan") {
				this.#scene.panCamera(viewPosition.x - dragState.lastPosition.x, viewPosition.y - dragState.lastPosition.y);
				dragState.lastPosition = viewPosition;
				return;
			}
			this.dragHandle(dragState, viewPosition, pointerEvent);
		});
		const endDrag = () => {
			const dragState = this.#dragState;
			this.#dragState = null;
			if (dragState !== null && dragState.kind === "handle" && dragState.isRecorded) {
				this.#inspectorPanel.refresh();
			}
		};
		canvasElement.addEventListener("pointerup", endDrag);
		canvasElement.addEventListener("pointercancel", endDrag);
		canvasElement.addEventListener("pointerleave", () => {
			this.#scene.setHoverNode(null);
		});
		canvasElement.addEventListener("wheel", (wheelEvent) => {
			wheelEvent.preventDefault();
			const viewPosition = readViewPosition(wheelEvent);
			if (wheelEvent.ctrlKey || wheelEvent.metaKey || System.Math.abs(wheelEvent.deltaX) < 1) {
				const zoomRatio = System.Math.exp(-wheelEvent.deltaY * (wheelEvent.ctrlKey ? 0.01 : 0.0015));
				this.#scene.zoomCamera(zoomRatio, viewPosition);
			}
			else {
				this.#scene.panCamera(-wheelEvent.deltaX, -wheelEvent.deltaY);
			}
		}, { passive: false });

		// 애셋 놓기. (그림은 Sprite 노드로, 씬은 열기)
		canvasElement.addEventListener("dragover", (dragEvent) => {
			if (dragEvent.dataTransfer.types.includes(ASSET_DRAG_TYPE)) {
				dragEvent.preventDefault();
				dragEvent.dataTransfer.dropEffect = "copy";
			}
		});
		canvasElement.addEventListener("drop", (dragEvent) => {
			const path = dragEvent.dataTransfer.getData(ASSET_DRAG_TYPE);
			const asset = this.#projectPanel.findAsset(path);
			if (asset === null) {
				return;
			}
			dragEvent.preventDefault();
			const viewPosition = readViewPosition(dragEvent);
			if (asset.kind === "image") {
				this.createSpriteFromAsset(asset, viewPosition);
			}
			else if (asset.kind === "scene") {
				this.openAsset(asset);
			}
			else if (asset.kind === "prefab") {
				this.instantiatePrefab(asset, viewPosition);
			}
			else {
				this.log(`${asset.kind} 애셋은 씬에 바로 놓을 수 없다: ${asset.path}`, "warning");
			}
		});
	}

	//==============================================================================
	// 손잡이 끌기. (처음 움직일 때 되돌리기 한 칸, Ctrl 은 격자 맞춤, Shift 는 15 도 맞춤)
	//==============================================================================
	/**
	 * @param { object } dragState
	 * @param { Vector2 } viewPosition
	 * @param { PointerEvent } pointerEvent
	 */
	dragHandle(dragState, viewPosition, pointerEvent) {
		const node = dragState.node;
		const deltaX = viewPosition.x - dragState.startPosition.x;
		const deltaY = viewPosition.y - dragState.startPosition.y;
		if (!dragState.isRecorded) {
			if (System.Math.abs(deltaX) + System.Math.abs(deltaY) < 2) {
				return;
			}
			this.recordUndo("손잡이로 바꾸기");
			dragState.isRecorded = true;
		}
		const isSnap = pointerEvent.ctrlKey || pointerEvent.metaKey;
		const handleKind = dragState.handleKind;
		if (handleKind === HandleKind.moveFree || handleKind === HandleKind.moveX || handleKind === HandleKind.moveY) {
			const localDelta = this.worldDeltaToLocal(node, handleKind === HandleKind.moveY ? 0 : deltaX, handleKind === HandleKind.moveX ? 0 : deltaY);
			let nextX = dragState.startLocalPosition.x + localDelta.x;
			let nextY = dragState.startLocalPosition.y + localDelta.y;
			if (isSnap) {
				nextX = System.Math.round(nextX / 10) * 10;
				nextY = System.Math.round(nextY / 10) * 10;
			}
			else {
				nextX = System.Math.round(nextX);
				nextY = System.Math.round(nextY);
			}
			node.setLocalPosition(Vector2.create(nextX, nextY));
		}
		else if (handleKind === HandleKind.rotate) {
			const origin = node.getPosition();
			const angle = System.Math.atan2(viewPosition.y - origin.y, viewPosition.x - origin.x);
			let nextRotation = dragState.startLocalRotation + (angle - dragState.startAngle) * 180 / System.Math.PI;
			nextRotation = pointerEvent.shiftKey ? System.Math.round(nextRotation / 15) * 15 : System.Math.round(nextRotation * 10) / 10;
			node.setLocalRotation(nextRotation);
		}
		else {
			const startScale = dragState.startLocalScale;
			let ratioX = 1;
			let ratioY = 1;
			if (handleKind === HandleKind.scaleX) {
				ratioX = 1 + deltaX / HANDLE_LENGTH;
			}
			else if (handleKind === HandleKind.scaleY) {
				ratioY = 1 - deltaY / HANDLE_LENGTH;
			}
			else {
				ratioX = 1 + (deltaX - deltaY) / HANDLE_LENGTH;
				ratioY = ratioX;
			}
			const roundScale = (value) => {
				return isSnap ? System.Math.round(value * 10) / 10 : System.Math.round(value * 1000) / 1000;
			};
			node.setLocalScale(Vector2.create(roundScale(startScale.x * ratioX), roundScale(startScale.y * ratioY)));
		}
		this.markDirty();
		this.#inspectorPanel.refresh();
	}

	//==============================================================================
	// 그림 애셋으로 Sprite 노드 만들기.
	//==============================================================================
	/**
	 * @param { object } asset
	 * @param { Vector2 } viewPosition
	 */
	createSpriteFromAsset(asset, viewPosition) {
		const image = this.#projectPanel.readImage(asset.path);
		if (image === null) {
			this.log(`그림을 읽지 못했다: ${asset.path}`, "error");
			return;
		}
		const node = new WorldNode();
		node.setName(asset.name.replace(/\.[^.]+$/, ""));
		node.setContentSize(Vector2.create(image.naturalWidth, image.naturalHeight));
		const sprite = node.addComponent(Sprite);
		sprite.setImagePath(asset.path);
		sprite.setImage(image);
		const selectedNode = this.#scene.getSelectedNode();
		this.change("그림 놓기", () => {
			const parentNode = selectedNode !== null ? selectedNode : this.#scene.getDocumentRoot();
			parentNode.addChild(node);
			this.placeAtViewPosition(node, viewPosition);
			this.#scene.setSelectedNode(node);
		}, true);
	}

	//==============================================================================
	// 키보드. (도구, 단축키, 스페이스 밀기)
	//==============================================================================
	setupKeyboard() {
		System.document.addEventListener("keydown", (keyboardEvent) => {
			const targetElement = keyboardEvent.target;
			if (targetElement && (targetElement.tagName === "INPUT" || targetElement.tagName === "TEXTAREA" || targetElement.tagName === "SELECT")) {
				return;
			}
			const isCommand = keyboardEvent.ctrlKey || keyboardEvent.metaKey;
			const key = keyboardEvent.key.toLowerCase();
			let isHandled = true;
			if (isCommand && key === "z") {
				if (keyboardEvent.shiftKey) {
					this.redo();
				}
				else {
					this.undo();
				}
			}
			else if (isCommand && key === "y") {
				this.redo();
			}
			else if (isCommand && key === "s") {
				this.saveScene(keyboardEvent.shiftKey);
			}
			else if (isCommand && key === "o") {
				this.openSceneFile();
			}
			else if (isCommand && key === "n") {
				this.newScene();
			}
			else if (isCommand && key === "c") {
				this.copySelected();
			}
			else if (isCommand && key === "v") {
				this.pasteNode();
			}
			else if (isCommand && key === "d") {
				this.duplicateSelected();
			}
			else if (isCommand && key === "p") {
				this.togglePlay();
			}
			else if (isCommand) {
				isHandled = false;
			}
			else if (key === "delete" || key === "backspace") {
				this.deleteSelected();
			}
			else if (key === "q") {
				this.setTool(EditorTool.hand);
			}
			else if (key === "w") {
				this.setTool(EditorTool.move);
			}
			else if (key === "e") {
				this.setTool(EditorTool.rotate);
			}
			else if (key === "r") {
				this.setTool(EditorTool.scale);
			}
			else if (key === "f") {
				this.#scene.frameSelected();
			}
			else if (key === "tab") {
				this.setGameView(!this.#scene.isGameView());
			}
			else if (key === "home") {
				this.#scene.frameDocument();
			}
			else if (key === "escape") {
				this.select(null);
			}
			else if (key === " ") {
				this.#isSpaceDown = true;
			}
			else if (key.startsWith("arrow") && this.#scene.getSelectedNode() !== null) {
				const step = keyboardEvent.shiftKey ? 10 : 1;
				const offsetX = key === "arrowleft" ? -step : (key === "arrowright" ? step : 0);
				const offsetY = key === "arrowup" ? -step : (key === "arrowdown" ? step : 0);
				const node = this.#scene.getSelectedNode();
				this.change("화살표로 옮기기", () => {
					const localPosition = node.getLocalPosition();
					node.setLocalPosition(Vector2.create(localPosition.x + offsetX, localPosition.y + offsetY));
				});
			}
			else {
				isHandled = false;
			}
			if (isHandled) {
				keyboardEvent.preventDefault();
			}
		});
		System.document.addEventListener("keyup", (keyboardEvent) => {
			if (keyboardEvent.key === " ") {
				this.#isSpaceDown = false;
			}
		});
	}

	//==============================================================================
	// 도구 바꾸기.
	//==============================================================================
	/**
	 * @param { string } tool
	 */
	setTool(tool) {
		this.#scene.setTool(tool);
		for (const [buttonTool, buttonElement] of System.Object.entries(this.#elements.toolButtons)) {
			buttonElement.classList.toggle("isActive", buttonTool === tool);
		}
	}

	//==============================================================================
	// 재생과 멈춤. (멈추면 재생 전 문서로 되돌린다)
	//==============================================================================
	togglePlay() {
		const scene = this.#scene;
		const playButton = this.#elements.playButton;
		if (!scene.isPlaying()) {
			this.#playSnapshot = UIDocument.toJsonText(scene.getDocumentRoot(), false);
			scene.setPlaying(true);
			playButton.classList.add("isPlaying");
			playButton.textContent = "■ 멈춤";
			this.setGameView(true);
			this.log("재생을 시작했다. 멈추면 재생 중 바꾼 것은 되돌아간다.");
		}
		else {
			scene.setPlaying(false);
			playButton.classList.remove("isPlaying");
			playButton.textContent = "▶ 재생";
			this.setGameView(false);
			if (this.#playSnapshot !== null) {
				const selectionPath = this.findIndexPath(scene.getSelectedNode());
				this.restoreState({ label: "재생", jsonText: this.#playSnapshot, selectionPath: selectionPath });
				this.#playSnapshot = null;
			}
			this.log("재생을 멈췄다.");
		}
	}

	//==============================================================================
	// 새 씬.
	//==============================================================================
	newScene() {
		if (this.#isDirty && !System.window.confirm("저장하지 않은 바꾼 것이 있다. 새 씬을 열까?")) {
			return;
		}
		this.#scene.replaceDocumentRoot(this.#scene.createDocumentRoot());
		this.#undoList.length = 0;
		this.#redoList.length = 0;
		this.#scenePath = "";
		this.#isDirty = false;
		this.refreshAll();
		this.scheduleAutosave();
		this.log("새 씬을 만들었다.");
	}

	//==============================================================================
	// 프로젝트 폴더 열기. (안 되는 브라우저면 끌어다 놓기를 알린다)
	//==============================================================================
	async openProjectFolder() {
		try {
			const isOpened = await this.#projectPanel.openFolder();
			if (!isOpened) {
				this.log("이 브라우저는 폴더 열기를 지원하지 않는다. 애셋 폴더를 프로젝트 패널에 끌어다 놓는다. (저장은 내려받기로 한다)", "warning");
			}
		}
		catch (error) {
			if (error.name !== "AbortError") {
				this.log(`폴더를 열지 못했다: ${error.message}`, "error");
			}
		}
	}

	//==============================================================================
	// 씬 파일 열기. (파일 고르기)
	//==============================================================================
	openSceneFile() {
		const inputElement = createElement("input");
		inputElement.type = "file";
		inputElement.accept = ".json";
		inputElement.addEventListener("change", async () => {
			const file = inputElement.files[0];
			if (file) {
				this.loadSceneText(await file.text(), file.name);
			}
		});
		inputElement.click();
	}

	//==============================================================================
	// 씬 글 읽어 열기.
	//==============================================================================
	/**
	 * @param { string } jsonText
	 * @param { string } path
	 */
	loadSceneText(jsonText, path) {
		try {
			const documentData = System.JSON.parse(jsonText);
			const documentRoot = UIDocument.fromJsonText(jsonText);
			if (System.Array.isArray(documentData.frameSize)) {
				this.#scene.setFrameSize(Vector2.create(documentData.frameSize[0], documentData.frameSize[1]));
			}
			if (this.#scene.isPlaying()) {
				this.togglePlay();
			}
			this.#scene.replaceDocumentRoot(documentRoot);
			this.#scene.frameDocument();
			this.#undoList.length = 0;
			this.#redoList.length = 0;
			this.#scenePath = path;
			this.#isDirty = false;
			this.refreshAll();
			this.log(`씬을 열었다: ${path}`);
		}
		catch (error) {
			this.log(`씬을 열지 못했다: ${path}: ${error.message}`, "error");
		}
	}

	//==============================================================================
	// 씬 저장. (폴더가 열려 있으면 그 안에, 아니면 내려받기)
	//==============================================================================
	/**
	 * @param { boolean } isSaveAs
	 */
	async saveScene(isSaveAs) {
		let scenePath = this.#scenePath;
		if (isSaveAs || scenePath === "") {
			const answer = System.window.prompt("씬 파일 경로 (프로젝트 폴더 기준)", scenePath || DEFAULT_SCENE_PATH);
			if (!answer) {
				return;
			}
			scenePath = answer.endsWith(".json") ? answer : `${answer}.scene.json`;
		}
		const jsonText = this.buildSceneJsonText();
		try {
			const savedTo = await this.#projectPanel.writeTextFile(scenePath, jsonText);
			this.#scenePath = scenePath;
			this.#isDirty = false;
			this.updateStatus();
			this.log(savedTo === "folder" ? `씬을 저장했다: ${scenePath}` : `씬을 내려받았다: ${scenePath} (폴더를 열면 그 안에 바로 저장한다)`);
		}
		catch (error) {
			this.log(`저장하지 못했다: ${error.message}`, "error");
		}
	}

	//==============================================================================
	// 씬 파일 글. (UIDocument 문서에 에디터 값 frameSize 를 얹는다)
	//==============================================================================
	/**
	 * @returns { string }
	 */
	buildSceneJsonText() {
		const documentData = System.JSON.parse(UIDocument.toJsonText(this.#scene.getDocumentRoot(), false));
		const frameSize = this.#scene.getFrameSize();
		documentData.frameSize = [frameSize.x, frameSize.y];
		return System.JSON.stringify(documentData, null, "\t");
	}

	//==============================================================================
	// 고른 노드 복사.
	//==============================================================================
	copySelected() {
		const selectedNode = this.#scene.getSelectedNode();
		if (selectedNode === null) {
			return;
		}
		this.#clipboardNodeData = UIDocument.serializeNode(selectedNode);
		this.log(`복사했다: ${selectedNode.getName()}`);
	}

	//==============================================================================
	// 붙여넣기. (고른 노드의 바로 뒤 형제로, 고른 것이 없으면 맨 위에)
	//==============================================================================
	pasteNode() {
		const nodeData = this.#clipboardNodeData;
		if (nodeData === null) {
			return;
		}
		const selectedNode = this.#scene.getSelectedNode();
		this.change("붙여넣기", () => {
			const pastedNode = UIDocument.deserializeNode(nodeData);
			const parentNode = selectedNode !== null ? selectedNode.getParent() : this.#scene.getDocumentRoot();
			parentNode.addChild(pastedNode);
			if (selectedNode !== null) {
				pastedNode.setSiblingIndex(parentNode.getChildren().indexOf(selectedNode) + 1);
			}
			this.#scene.setSelectedNode(pastedNode);
		}, true);
	}

	//==============================================================================
	// 고른 노드를 프리팹 애셋으로 저장. (prefabs/이름.prefab.json, UIDocument 문서 하나)
	//==============================================================================
	async saveSelectedAsPrefab() {
		const selectedNode = this.#scene.getSelectedNode();
		if (selectedNode === null) {
			this.log("프리팹으로 저장할 노드를 먼저 고른다.", "warning");
			return;
		}
		const safeName = (selectedNode.getName() || "Prefab").replace(/[\\/:*?"<>|]/g, "_");
		const prefabPath = `prefabs/${safeName}.prefab.json`;
		try {
			const savedTo = await this.#projectPanel.writeTextFile(prefabPath, UIDocument.toJsonText(selectedNode, true));
			this.log(savedTo === "folder" ? `프리팹을 저장했다: ${prefabPath}` : `프리팹을 내려받았다: ${prefabPath}`);
		}
		catch (error) {
			this.log(`프리팹을 저장하지 못했다: ${error.message}`, "error");
		}
	}

	//==============================================================================
	// 프리팹 애셋 꺼내기. (화면 위치에, 고른 노드가 있으면 그 밑에)
	//==============================================================================
	/**
	 * @param { object } asset
	 * @param { Vector2 } viewPosition
	 */
	async instantiatePrefab(asset, viewPosition) {
		let prefabNode = null;
		try {
			prefabNode = UIDocument.fromJsonText(await asset.file.text());
		}
		catch (error) {
			this.log(`프리팹을 읽지 못했다: ${asset.path}: ${error.message}`, "error");
			return;
		}
		const selectedNode = this.#scene.getSelectedNode();
		this.change("프리팹 꺼내기", () => {
			const parentNode = selectedNode !== null ? selectedNode : this.#scene.getDocumentRoot();
			parentNode.addChild(prefabNode);
			this.placeAtViewPosition(prefabNode, viewPosition);
			this.#scene.setSelectedNode(prefabNode);
		}, true);
	}

	//==============================================================================
	// 애셋 파일 가져오기. (파일 고르기, 프로젝트 패널의 지금 폴더로)
	//==============================================================================
	importAssetFiles() {
		const inputElement = createElement("input");
		inputElement.type = "file";
		inputElement.multiple = true;
		inputElement.addEventListener("change", async () => {
			const fileList = System.Array.from(inputElement.files);
			if (fileList.length === 0) {
				return;
			}
			try {
				await this.#projectPanel.importFiles(fileList);
				this.log(`파일 ${fileList.length}개를 가져왔다.`);
			}
			catch (error) {
				this.log(`가져오지 못했다: ${error.message}`, "error");
			}
		});
		inputElement.click();
	}

	//==============================================================================
	// 씬 뷰와 게임 뷰 바꾸기.
	//==============================================================================
	/**
	 * @param { boolean } isGameView
	 */
	setGameView(isGameView) {
		const windowId = isGameView ? "game" : "scene";
		this.#dockLayout.activateWindow(windowId);
		this.attachViewCanvas(windowId);
	}

	//==============================================================================
	// 씬 카메라를 게임 뷰나 씬 뷰로. (게임 뷰는 화면 틀을 꽉 채우고, 씬 뷰로 오면 전 카메라로 되돌린다)
	//==============================================================================
	/**
	 * @param { boolean } isGameView
	 */
	applyGameView(isGameView) {
		const scene = this.#scene;
		if (scene.isGameView() === isGameView) {
			return;
		}
		const cameraNode = scene.getCameraNode();
		if (isGameView) {
			this.#savedCameraState = { position: cameraNode.getLocalPosition().clone(), scale: cameraNode.getLocalScale().clone() };
		}
		scene.setGameView(isGameView);
		if (isGameView) {
			scene.frameDocument();
		}
		else if (this.#savedCameraState !== null) {
			cameraNode.setLocalPosition(this.#savedCameraState.position);
			cameraNode.setLocalScale(this.#savedCameraState.scale);
		}
	}

	//==============================================================================
	// 화면 틀 크기 묻기.
	//==============================================================================
	askFrameSize() {
		const frameSize = this.#scene.getFrameSize();
		const answer = System.window.prompt("화면 틀 크기 (가로x세로)", `${frameSize.x}x${frameSize.y}`);
		const match = answer ? answer.match(/^\s*(\d+)\s*[x×*, ]\s*(\d+)\s*$/) : null;
		if (match === null) {
			return;
		}
		this.#scene.setFrameSize(Vector2.create(System.Number(match[1]), System.Number(match[2])));
		this.#scene.frameDocument();
		this.markDirty();
	}

	//==============================================================================
	// 애셋 열기. (두 번 누르기, 씬이면 열고 소리면 들려 준다)
	//==============================================================================
	/**
	 * @param { object } asset
	 */
	async openAsset(asset) {
		if (asset.kind === "scene") {
			if (this.#isDirty && !System.window.confirm("저장하지 않은 바꾼 것이 있다. 이 씬을 열까?")) {
				return;
			}
			this.loadSceneText(await asset.file.text(), asset.path);
		}
		else if (asset.kind === "audio") {
			new System.Audio(asset.url).play();
		}
		else if (asset.kind === "prefab") {
			const viewSize = this.#engine.getViewManager().getViewSize();
			this.instantiatePrefab(asset, Vector2.create(viewSize.x * 0.5, viewSize.y * 0.5));
		}
		else {
			this.showAsset(asset);
		}
	}

	//==============================================================================
	// 애셋 미리보기. (인스펙터 자리에)
	//==============================================================================
	/**
	 * @param { object } asset
	 */
	async showAsset(asset) {
		this.#scene.setSelectedNode(null);
		this.#hierarchyPanel.render(this.#scene.getDocumentRoot(), null);
		const inspectorBody = this.#elements.inspectorBody;
		inspectorBody.textContent = "";
		const previewElement = createElement("div", "assetPreview");
		const titleElement = createElement("div", "inspectorSectionHeader", asset.name);
		inspectorBody.append(titleElement, previewElement);
		const infoLines = [`경로: ${asset.path}`, `종류: ${asset.kind}`, `크기: ${formatByteCount(asset.file.size)}`];
		if (asset.kind === "image") {
			const image = this.#projectPanel.readImage(asset.path);
			if (image !== null) {
				infoLines.push(`해상도: ${image.naturalWidth} x ${image.naturalHeight}`);
			}
			const imageElement = createElement("img");
			imageElement.src = asset.url;
			previewElement.append(imageElement);
			infoLines.push("씬 뷰나 Sprite 의 Image 칸에 끌어다 놓는다.");
		}
		else if (asset.kind === "audio") {
			const audioElement = createElement("audio");
			audioElement.controls = true;
			audioElement.src = asset.url;
			audioElement.style.width = "100%";
			previewElement.append(audioElement);
		}
		else if (asset.kind === "json" || asset.kind === "scene" || asset.kind === "prefab" || asset.kind === "text") {
			const text = await asset.file.text();
			const preElement = createElement("pre", "", text.length > 20000 ? `${text.substring(0, 20000)}\n…` : text);
			previewElement.append(preElement);
			if (asset.kind === "scene") {
				infoLines.push("두 번 누르면 씬을 연다.");
			}
			else if (asset.kind === "prefab") {
				infoLines.push("씬 뷰에 끌어다 놓거나 두 번 누르면 꺼낸다.");
			}
		}
		else if (asset.kind === "font") {
			const fontName = `editorPreview${System.Math.floor(System.Math.random() * 1e9)}`;
			try {
				const fontFace = new System.FontFace(fontName, `url(${asset.url})`);
				await fontFace.load();
				System.document.fonts.add(fontFace);
				const sampleElement = createElement("div", "", "가나다라 ABC abc 0123");
				sampleElement.style.fontFamily = fontName;
				sampleElement.style.fontSize = "28px";
				sampleElement.style.padding = "8px 0";
				previewElement.append(sampleElement);
			}
			catch (error) {
				infoLines.push(`글꼴을 읽지 못했다: ${error.message}`);
			}
		}
		else if (asset.kind === "model") {
			infoLines.push(...(await this.readModelInfo(asset)));
			if (asset.name.toLowerCase().endsWith(".glb")) {
				const previewCanvas = createElement("canvas", "modelPreviewCanvas");
				previewElement.append(previewCanvas);
				try {
					const modelPreview = new ModelPreview(previewCanvas);
					const modelInfo = modelPreview.load(await asset.file.arrayBuffer());
					infoLines.push(`꼭짓점: ${modelInfo.vertexCount}개, 삼각형: ${modelInfo.triangleCount}개`);
					infoLines.push(`모델 크기: ${modelInfo.size.map((value) => value.toFixed(2)).join(" x ")}`);
					infoLines.push("미리보기를 끌면 돌아간다.");
				}
				catch (error) {
					previewCanvas.remove();
					infoLines.push(`미리보기를 그리지 못했다: ${error.message}`);
				}
			}
		}
		for (const line of infoLines) {
			previewElement.append(createElement("div", "fieldLabel", line));
		}
	}

	//==============================================================================
	// GLB 정보 읽기. (메시, 노드, 뼈대, 애니메이션 수)
	//==============================================================================
	/**
	 * @param { object } asset
	 * @returns { Promise<Array<string>> }
	 */
	async readModelInfo(asset) {
		if (!asset.name.toLowerCase().endsWith(".glb")) {
			return [];
		}
		try {
			const arrayBuffer = await asset.file.arrayBuffer();
			const dataView = new System.DataView(arrayBuffer);
			const jsonLength = dataView.getUint32(12, true);
			const jsonText = new System.TextDecoder().decode(new System.Uint8Array(arrayBuffer, 20, jsonLength));
			const gltf = System.JSON.parse(jsonText);
			const animationNameList = (gltf.animations || []).map((animation, animationIndex) => animation.name || `#${animationIndex}`);
			const jointCount = (gltf.skins || []).reduce((total, skin) => total + skin.joints.length, 0);
			return [
				`메시: ${(gltf.meshes || []).length}개`,
				`노드: ${(gltf.nodes || []).length}개`,
				`뼈: ${jointCount}개`,
				`애니메이션: ${animationNameList.length > 0 ? animationNameList.join(", ") : "없음"}`,
			];
		}
		catch (error) {
			return [`GLB 를 읽지 못했다: ${error.message}`];
		}
	}

	//==============================================================================
	// 바뀐 표시.
	//==============================================================================
	markDirty() {
		if (!this.#isDirty) {
			this.#isDirty = true;
			this.updateStatus();
		}
		this.scheduleAutosave();
	}

	//==============================================================================
	// 자동 보관 예약. (바꾸고 1 초 뒤 브라우저 저장소에, 재생 중에는 남기지 않는다)
	//==============================================================================
	scheduleAutosave() {
		System.clearTimeout(this.#autosaveTimer);
		this.#autosaveTimer = System.setTimeout(() => {
			if (this.#scene.isPlaying()) {
				return;
			}
			try {
				const autosaveData = {
					scenePath: this.#scenePath,
					isDirty: this.#isDirty,
					jsonText: this.buildSceneJsonText(),
				};
				System.localStorage.setItem(AUTOSAVE_STORAGE_KEY, System.JSON.stringify(autosaveData));
			}
			catch (exception) {
				// 저장소를 쓸 수 없으면(사생활 보호 창, 꽉 참) 자동 보관만 건너뛴다.
			}
		}, 1000);
	}

	//==============================================================================
	// 자동 보관 되살리기. (있으면 true)
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	restoreAutosave() {
		let autosaveText = null;
		try {
			autosaveText = System.localStorage.getItem(AUTOSAVE_STORAGE_KEY);
		}
		catch (exception) {
			return false;
		}
		if (!autosaveText) {
			return false;
		}
		try {
			const autosaveData = System.JSON.parse(autosaveText);
			this.loadSceneText(autosaveData.jsonText, autosaveData.scenePath || "");
			this.#isDirty = autosaveData.isDirty === true;
			this.log("지난번에 하던 씬을 되살렸다. (브라우저 자동 보관)");
			return true;
		}
		catch (exception) {
			return false;
		}
	}

	//==============================================================================
	// 패널 모두 다시 짓기.
	//==============================================================================
	refreshAll() {
		const scene = this.#scene;
		this.#hierarchyPanel.render(scene.getDocumentRoot(), scene.getSelectedNode());
		this.#inspectorPanel.render(scene.getSelectedNode());
		this.updateStatus();
	}

	//==============================================================================
	// 상태 줄과 씬 제목.
	//==============================================================================
	updateStatus() {
		const elements = this.#elements;
		const scenePath = this.#scenePath || "Untitled";
		elements.sceneTitle.textContent = `${scenePath}${this.#isDirty ? " *" : ""}`;
		System.document.title = `${scenePath}${this.#isDirty ? " *" : ""} - vanilla.js Editor`;
		let nodeCount = 0;
		const countNodes = (node) => {
			for (const childNode of node.getChildren()) {
				nodeCount += 1;
				countNodes(childNode);
			}
		};
		if (this.#scene) {
			countNodes(this.#scene.getDocumentRoot());
		}
		const projectName = this.#projectPanel ? this.#projectPanel.getProjectName() : "";
		const statusList = [
			projectName !== "" ? `프로젝트: ${projectName}${this.#projectPanel.hasDirectory() ? "" : " (읽기만)"}` : "프로젝트 없음",
			`노드 ${nodeCount}개`,
			`되돌리기 ${this.#undoList.length}칸`,
		];
		elements.statusBar.textContent = statusList.join("   |   ");
	}

	//==============================================================================
	// 씬 뷰 위 글. (배율과 화면 틀)
	//==============================================================================
	updateOverlay() {
		const scene = this.#scene;
		if (!scene || !scene.getCameraNode()) {
			return;
		}
		const frameSize = scene.getFrameSize();
		const toolName = { hand: "밀기", move: "옮기기", rotate: "돌리기", scale: "키우기" }[scene.getTool()];
		this.#elements.sceneOverlay.textContent = `${System.Math.round(scene.getZoom() * 100)}%   ${frameSize.x} x ${frameSize.y}   ${toolName}${scene.isPlaying() ? "   재생 중" : ""}`;
	}

	//==============================================================================
	// 콘솔에 적기.
	//==============================================================================
	/**
	 * @param { string } text
	 * @param { string } level - "log", "warning", "error"
	 */
	log(text, level = "log") {
		const consoleBody = this.#elements.consoleBody;
		const now = new System.Date();
		const timeText = `${System.String(now.getHours()).padStart(2, "0")}:${System.String(now.getMinutes()).padStart(2, "0")}:${System.String(now.getSeconds()).padStart(2, "0")}`;
		const lineElement = createElement("div", "consoleLine" + (level === "warning" ? " isWarning" : (level === "error" ? " isError" : "")), `[${timeText}] ${text}`);
		consoleBody.append(lineElement);
		while (consoleBody.childElementCount > CONSOLE_LINE_LIMIT) {
			consoleBody.firstChild.remove();
		}
		consoleBody.scrollTop = consoleBody.scrollHeight;
		if (level === "error" && this.#dockLayout !== null) {
			this.#dockLayout.setWindowAlert("console", true);
		}
	}

	//==============================================================================
	// 브라우저 콘솔의 경고와 오류도 에디터 콘솔에. (원래 출력은 그대로)
	//==============================================================================
	hookConsole() {
		const originalWarn = System.console.warn.bind(System.console);
		const originalError = System.console.error.bind(System.console);
		const formatArguments = (argumentList) => {
			return argumentList.map((argument) => {
				if (argument instanceof System.Error) {
					return argument.stack || argument.message;
				}
				return typeof argument === "object" ? System.String(argument) : System.String(argument);
			}).join(" ");
		};
		System.console.warn = (...argumentList) => {
			originalWarn(...argumentList);
			this.log(formatArguments(argumentList), "warning");
		};
		System.console.error = (...argumentList) => {
			originalError(...argumentList);
			this.log(formatArguments(argumentList), "error");
		};
		System.window.addEventListener("error", (errorEvent) => {
			this.log(errorEvent.message, "error");
		});
	}

	//==============================================================================
	// 시험용 손잡이. (자동 시험이 에디터 안을 들여다볼 때)
	//==============================================================================
	/**
	 * @returns { object }
	 */
	getTestHandles() {
		return {
			scene: this.#scene,
			projectPanel: this.#projectPanel,
			undoCount: () => this.#undoList.length,
			redoCount: () => this.#redoList.length,
			select: (node) => this.select(node),
			undo: () => this.undo(),
			redo: () => this.redo(),
			duplicate: () => this.duplicateSelected(),
			remove: () => this.deleteSelected(),
			togglePlay: () => this.togglePlay(),
			createNode: (presetIndex) => this.createNode(NODE_PRESET_LIST[presetIndex], null),
			loadSceneText: (jsonText, path) => this.loadSceneText(jsonText, path),
			saveText: () => UIDocument.toJsonText(this.#scene.getDocumentRoot(), true),
			showAsset: (asset) => this.showAsset(asset),
			copy: () => this.copySelected(),
			paste: () => this.pasteNode(),
			setGameView: (isGameView) => this.setGameView(isGameView),
			dockLayout: this.#dockLayout,
			instantiatePrefab: (asset, position) => this.instantiatePrefab(asset, position),
		};
	}
}


//==============================================================================
// 시작.
//==============================================================================
const visualEditor = new VisualEditor();
System.visualEditor = visualEditor;
if (System.document.readyState === "loading") {
	System.document.addEventListener("DOMContentLoaded", () => {
		visualEditor.start();
	});
}
else {
	visualEditor.start();
}
