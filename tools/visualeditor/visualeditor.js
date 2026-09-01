//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Colors } from "../../src/base/colors.js";
import { Vector2 } from "../../src/base/vector2.js";
import { Rect } from "../../src/base/rect.js";
import { Engine, EngineConfiguration } from "../../src/core/engine.js";
import { Scene } from "../../src/core/scene.js";
import { ViewScaleMode } from "../../src/core/viewmanager.js";
import { Graphic } from "../../src/core/graphic.js";
import { Pane, PaneStyle, PaneTheme } from "../../src/web/pane.js";
import {
	EditorTheme, applyEditorTheme, setEditorCommandHandler, wrapEditorIconMarkup,
	openEditorMenuPanelAt, createEditorSectionElement, createEditorListRowElement, setEditorListRowSelected,
	createEditorHeaderButtonElement, setEditorHeaderButtonSelected, createEditorPropertyRowElement,
	decorateEditorInputElement, createEditorButtonElement, buildEditorWindowLayout,
} from "../common/editorkit.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 목록에 쓰는 그림 아이콘. (14x14 기준, 색은 글자색을 따른다)
const ICON_SHAPES = {
	folder: "<path d='M1.5 3.5h4l1.2 1.6h5.8v6.4h-11z' fill='currentColor'/>",
	file: "<path d='M3.5 1.8h5l2.2 2.2v8.2h-7.2z' fill='none' stroke='currentColor' stroke-width='1.5'/>",
	node: "<path d='M7 1.8l5.2 5.2-5.2 5.2-5.2-5.2z' fill='currentColor'/>",
};

// 메뉴 막대 구성. (일반 데스크톱 응용 프로그램과 같은 배치)
const MENU_DEFINITIONS = [
	{
		title: "Playback",
		items: [
			{ id: "play", label: "Play", shortcut: "F5" },
			{ id: "pause", label: "Pause" },
			{ id: "stop", label: "Stop", shortcut: "Shift+F5" },
		],
	},
	{
		title: "View",
		items: [
			{ id: "resetLayout", label: "Reset Layout" },
		],
	},
];


//==============================================================================
// 게임뷰.
//==============================================================================
class GameView extends Scene {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { Function } */ #drawEvent;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.#drawEvent = null;
	}

	//==============================================================================
	// 초기화.
	//==============================================================================
	/**
	 * @param { Engine } engine
	 */
	initialize(engine) {
		super.initialize(engine);
		const viewManager = engine.getViewManager();
		viewManager.setViewScaleMode(ViewScaleMode.none);
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 */
	draw(graphic) {
		super.draw(graphic);
		const drawEvent = this.getDrawEvent();
		if (drawEvent !== null) {
			drawEvent(graphic);
		}
	}

	//==============================================================================
	// 출력 설정.
	//==============================================================================
	/**
	 * @param { function(Graphic): void } callback
	 */
	setDrawEvent(callback) {
		this.#drawEvent = callback;
	}

	//==============================================================================
	// 출력 반환.
	//==============================================================================
	/**
	 * @returns { function(Graphic): void }
	 */
	getDrawEvent() {
		return this.#drawEvent;
	}
}


//==============================================================================
// 비주얼 에디터.
// - 창 구성과 조작 UI 는 DOM(Pane) 으로 만들고, 게임 화면만 엔진이 그린다.
// - tick 스크립트를 즉시 컴파일해 파티클 무리에 적용한다.
//==============================================================================
class VisualEditor {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { System.Object } */ #inspector;
	/** @private @type { Engine } */ #engine;
	/** @private @type { GameView } */ #gameView;
	/** @private @type { Function } */ #scripting;
	/** @private @type { Proxy } */ #properties;
	/** @private @type { HTMLElement } */ #editor;
	/** @private @type { HTMLElement } */ #consolePane;
	/** @private @type { HTMLElement } */ #inspectorPropsContainer;
	/** @private @type { HTMLElement } */ #statusTextElement;
	/** @private @type { Array } */ #particles;
	/** @private @type { boolean } */ #isPlaying;
	/** @private @type { HTMLElement } */ #consoleSelectedItem;
	/** @private @type { HTMLElement } */ #playButtonElement;
	/** @private @type { HTMLElement } */ #pauseButtonElement;
	/** @private @type { HTMLElement } */ #stopButtonElement;
	/** @private @type { Pane } */ #rootPane;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		this.#inspector = { };
		this.#engine = null;
		this.#gameView = null;
		this.#scripting = null;
		this.#properties = null;
		this.#editor = null;
		this.#consolePane = null;
		this.#inspectorPropsContainer = null;
		this.#statusTextElement = null;
		this.#particles = [];
		this.#isPlaying = true;
		this.#consoleSelectedItem = null;
		this.#playButtonElement = null;
		this.#pauseButtonElement = null;
		this.#stopButtonElement = null;
		this.#rootPane = null;
	}

	//==============================================================================
	// 트리 한 줄 생성. (접기 화살표 + 기호 + 이름, 자식 컨테이너 포함)
	//==============================================================================
	/**
	 * @param { string } iconName
	 * @param { string } labelText
	 * @param { object } options - { dataType, hasChildren, isOpen, onSelect }
	 * @returns { HTMLElement }
	 */
	createTreeItemElement(iconName, labelText, options) {
		const wrapperElement = System.document.createElement("div");
		wrapperElement.dataset.type = options.dataType;
		wrapperElement.dataset.label = labelText;

		const glyphMarkup = wrapEditorIconMarkup(ICON_SHAPES[iconName]);
		const rowElement = createEditorListRowElement(glyphMarkup, labelText);
		rowElement.style.gap = "5px";
		rowElement.style.paddingLeft = "8px";
		wrapperElement.appendChild(rowElement);

		const foldElement = System.document.createElement("span");
		foldElement.innerText = "▸";
		foldElement.style.cssText = "font-size:10px;color:" + PaneTheme.color.textDim
			+ ";width:12px;flex-shrink:0;text-align:center;user-select:none;visibility:hidden;";
		rowElement.insertBefore(foldElement, rowElement.firstChild);

		const labelElement = rowElement.children[2];
		labelElement.dataset.role = "label";
		labelElement.style.flex = "1";

		const childContainerElement = System.document.createElement("div");
		childContainerElement.style.paddingLeft = "16px";
		childContainerElement.style.display = options.isOpen ? "block" : "none";
		wrapperElement.appendChild(childContainerElement);

		if (options.hasChildren) {
			foldElement.style.visibility = "visible";
			foldElement.innerText = options.isOpen ? "▾" : "▸";
			foldElement.style.cursor = "pointer";
		}
		foldElement.addEventListener("click", (mouseEvent) => {
			mouseEvent.stopPropagation();
			const isOpen = childContainerElement.style.display !== "none";
			childContainerElement.style.display = isOpen ? "none" : "block";
			foldElement.innerText = isOpen ? "▸" : "▾";
		});

		wrapperElement.addChild = (childItemElement) => {
			childContainerElement.appendChild(childItemElement);
			foldElement.style.visibility = "visible";
			const isOpen = childContainerElement.style.display !== "none";
			foldElement.innerText = isOpen ? "▾" : "▸";
			foldElement.style.cursor = "pointer";
		};

		rowElement.addEventListener("click", (mouseEvent) => {
			mouseEvent.stopPropagation();
			options.onSelect(rowElement, labelText);
		});
		return wrapperElement;
	}

	//==============================================================================
	// 창 구성.
	//==============================================================================
	initialize() {
		// --- 메인 편집 영역 (가로) ---
		const mainEditorPane = new Pane({ direction: "horizontal", size: "flex" });

		// [왼쪽 영역] 탐색기 + 하이어라키.
		const leftSidePane = new Pane({ direction: "vertical", size: 250, minSize: 150 });

		// 탐색기.
		const explorerPane = new Pane({ size: "50%", minSize: 100 });
		let explorerSelectedRow = null;
		const selectExplorerRow = (rowElement, labelText) => {
			if (explorerSelectedRow) {
				setEditorListRowSelected(explorerSelectedRow, false);
			}
			explorerSelectedRow = rowElement;
			setEditorListRowSelected(rowElement, true);
			this.setStatusText("Explorer > " + labelText);
		};
		const createTreeItem = (labelText, isFolder = false) => {
			return this.createTreeItemElement(isFolder ? "folder" : "file", labelText, {
				dataType: "tree-item",
				hasChildren: false,
				isOpen: false,
				onSelect: selectExplorerRow,
			});
		};
		const explorerElement = createEditorSectionElement("EXPLORER", () => {
			return [
				{
					id: "addExplorerItem",
					label: "Add Item...",
					action: () => {
						const newName = System.prompt("Item name:", "");
						if (newName) {
							explorerTree.appendChild(createTreeItem(newName));
						}
					},
				},
			];
		});
		const explorerTree = PaneStyle.create("div", "", { style: { flex: "1", overflowY: "auto", position: "relative" } });
		const assetsItem = createTreeItem("assets", true);
		assetsItem.addChild(createTreeItem("audio"));
		assetsItem.addChild(createTreeItem("images"));
		assetsItem.addChild(createTreeItem("fonts"));
		const sourceItem = createTreeItem("src", true);
		sourceItem.addChild(createTreeItem("utils.js"));
		sourceItem.addChild(createTreeItem("config.js"));
		explorerTree.append(assetsItem, sourceItem, createTreeItem("main.js"), createTreeItem("suika.js"), createTreeItem("Suika_Visual.json"));
		explorerTree.addEventListener("click", (mouseEvent) => {
			if (!mouseEvent.target.closest("[data-type=\"tree-item\"]")) {
				if (explorerSelectedRow) {
					setEditorListRowSelected(explorerSelectedRow, false);
					explorerSelectedRow = null;
				}
				this.setStatusText("No selection");
			}
		});
		explorerElement.appendChild(explorerTree);
		explorerPane.getContainer().appendChild(explorerElement);

		// 하이어라키.
		const hierarchyPane = new Pane({ size: "flex", minSize: 100 });
		let hierarchySelectedRow = null;
		const selectHierarchyRow = (rowElement, labelText) => {
			if (hierarchySelectedRow) {
				setEditorListRowSelected(hierarchySelectedRow, false);
			}
			hierarchySelectedRow = rowElement;
			setEditorListRowSelected(rowElement, true);
			this.setStatusText("Hierarchy > " + labelText);
		};
		const createHierarchyItem = (labelText) => {
			const wrapperElement = this.createTreeItemElement("node", labelText, {
				dataType: "hierarchy-item",
				hasChildren: false,
				isOpen: true,
				onSelect: selectHierarchyRow,
			});
			const rowElement = wrapperElement.firstChild;
			const activeButtonElement = System.document.createElement("button");
			activeButtonElement.innerText = "Active";
			activeButtonElement.dataset.active = "true";
			activeButtonElement.style.cssText = "font-size:10px;padding:1px 6px;border:none;border-radius:3px;cursor:pointer;"
				+ "background-color:" + PaneTheme.color.success + ";color:#10241a;flex-shrink:0;"
				+ "font-family:" + EditorTheme.fontFamily + ";font-weight:600;";
			activeButtonElement.addEventListener("click", (mouseEvent) => {
				mouseEvent.stopPropagation();
				const isActive = activeButtonElement.dataset.active === "true";
				activeButtonElement.dataset.active = isActive ? "false" : "true";
				activeButtonElement.innerText = isActive ? "Inactive" : "Active";
				activeButtonElement.style.backgroundColor = isActive ? PaneTheme.color.resizer : PaneTheme.color.success;
				activeButtonElement.style.color = isActive ? PaneTheme.color.textDim : "#10241a";
			});
			rowElement.appendChild(activeButtonElement);
			return wrapperElement;
		};
		const hierarchyElement = createEditorSectionElement("HIERARCHY", () => {
			return [
				{
					id: "addHierarchyItem",
					label: "Add Item...",
					action: () => {
						const newName = System.prompt("Item name:", "");
						if (newName) {
							hierarchyTree.appendChild(createHierarchyItem(newName));
						}
					},
				},
			];
		});
		const hierarchyTree = PaneStyle.create("div", "", { style: { flex: "1", overflowY: "auto", position: "relative" } });
		const visualRoot = createHierarchyItem("Visual Root");
		const backgroundLayer = createHierarchyItem("Background Layer");
		const particleEmitter = createHierarchyItem("Particle Emitter");
		const mainParticle = createHierarchyItem("Main Particle");
		const subParticle = createHierarchyItem("Sub Particle");
		const uiLayer = createHierarchyItem("UI Layer");
		particleEmitter.addChild(mainParticle);
		particleEmitter.addChild(subParticle);
		visualRoot.addChild(backgroundLayer);
		visualRoot.addChild(particleEmitter);
		visualRoot.addChild(uiLayer);
		hierarchyTree.appendChild(visualRoot);
		hierarchyTree.addEventListener("click", (mouseEvent) => {
			if (!mouseEvent.target.closest("[data-type=\"hierarchy-item\"]")) {
				if (hierarchySelectedRow) {
					setEditorListRowSelected(hierarchySelectedRow, false);
					hierarchySelectedRow = null;
				}
				this.setStatusText("No selection");
			}
		});
		hierarchyElement.appendChild(hierarchyTree);
		hierarchyPane.getContainer().appendChild(hierarchyElement);

		leftSidePane.addPane(explorerPane);
		leftSidePane.addPane(hierarchyPane);

		// [중앙] 코드 에디터.
		const codeEditorPane = new Pane({ size: 640, minSize: 150 });
		const codeEditorElement = createEditorSectionElement("SCRIPT", null);
		this.#editor = PaneStyle.create("textarea", "textarea", {
			id: "code-editor",
			style: { position: "relative", width: "auto", height: "auto", flex: "1" },
		});
		codeEditorElement.appendChild(this.#editor);
		codeEditorPane.getContainer().appendChild(codeEditorElement);

		// [중앙-우측] 게임 화면.
		const gameCanvasPane = new Pane({ size: "flex" });
		const gameCanvasElement = createEditorSectionElement("GAME VIEW", null);
		const gameCanvasTitleElement = gameCanvasElement.firstChild;
		gameCanvasTitleElement.style.display = "flex";
		gameCanvasTitleElement.style.alignItems = "center";
		gameCanvasTitleElement.style.paddingRight = "6px";
		const gameCanvasSpacerElement = PaneStyle.create("div", "", {
			style: { position: "relative", width: "auto", height: "auto", flex: "1" },
		});
		this.#playButtonElement = createEditorHeaderButtonElement("PLAY");
		this.#pauseButtonElement = createEditorHeaderButtonElement("PAUSE");
		this.#stopButtonElement = createEditorHeaderButtonElement("STOP");
		this.#playButtonElement.addEventListener("click", () => {
			this.executeCommand("play");
		});
		this.#pauseButtonElement.addEventListener("click", () => {
			this.executeCommand("pause");
		});
		this.#stopButtonElement.addEventListener("click", () => {
			this.executeCommand("stop");
		});
		gameCanvasTitleElement.appendChild(gameCanvasSpacerElement);
		gameCanvasTitleElement.appendChild(this.#playButtonElement);
		gameCanvasTitleElement.appendChild(this.#pauseButtonElement);
		gameCanvasTitleElement.appendChild(this.#stopButtonElement);
		const canvasHolderElement = PaneStyle.create("div", "", {
			style: { position: "relative", width: "auto", height: "auto", flex: "1", backgroundColor: "#000000", overflow: "hidden" },
		});
		const canvasElement = PaneStyle.create("canvas", "", { id: "game-canvas" });
		canvasHolderElement.appendChild(canvasElement);
		gameCanvasElement.appendChild(canvasHolderElement);
		gameCanvasPane.getContainer().appendChild(gameCanvasElement);

		// [오른쪽] 인스펙터.
		const inspectorSidePane = new Pane({ size: 300, minSize: 180 });
		const inspectorElement = createEditorSectionElement("INSPECTOR", null);
		this.#inspectorPropsContainer = PaneStyle.create("div", "", {
			id: "inspector-props",
			style: { flex: "1", overflowY: "auto", position: "relative" },
		});
		const addPropRowElement = PaneStyle.create("div", "", {
			style: {
				position: "relative", width: "auto", height: "auto", flexShrink: "0",
				display: "flex", alignItems: "center", gap: "6px", padding: "8px 12px",
				borderTop: "1px solid " + PaneTheme.color.border,
			},
		});
		const propertyNameInputElement = System.document.createElement("input");
		propertyNameInputElement.type = "text";
		propertyNameInputElement.placeholder = "Name";
		decorateEditorInputElement(propertyNameInputElement);
		const propertyValueInputElement = System.document.createElement("input");
		propertyValueInputElement.type = "text";
		propertyValueInputElement.placeholder = "Value";
		decorateEditorInputElement(propertyValueInputElement);
		propertyValueInputElement.style.flex = "0 0 60px";
		const addPropertyButtonElement = createEditorButtonElement("Add", true);
		addPropertyButtonElement.style.padding = "3px 12px";
		addPropRowElement.append(propertyNameInputElement, propertyValueInputElement, addPropertyButtonElement);
		inspectorElement.appendChild(this.#inspectorPropsContainer);
		inspectorElement.appendChild(addPropRowElement);
		inspectorSidePane.getContainer().appendChild(inspectorElement);

		mainEditorPane.addPane(leftSidePane);
		mainEditorPane.addPane(codeEditorPane);
		mainEditorPane.addPane(gameCanvasPane);
		mainEditorPane.addPane(inspectorSidePane);

		// --- 하단 콘솔 영역 ---
		const consoleBottomPane = new Pane({ size: 200, minSize: 50, resizableEdges: { top: true } });
		const consolePanelElement = createEditorSectionElement("CONSOLE", () => {
			return [
				{
					id: "clearConsole",
					label: "Clear All",
					action: () => {
						this.#consolePane.innerHTML = "";
					},
				},
			];
		});
		this.#consolePane = PaneStyle.create("div", "", {
			id: "console-pane",
			style: {
				position: "relative", flex: "1", overflowY: "auto", padding: "4px 0",
				fontFamily: PaneTheme.font.mono, fontSize: "12px", color: PaneTheme.color.success,
			},
		});
		consolePanelElement.appendChild(this.#consolePane);
		consoleBottomPane.getContainer().appendChild(consolePanelElement);

		// --- 가운데 영역 (편집 + 콘솔) ---
		const centerAreaPane = new Pane({ direction: "vertical", size: "flex" });
		centerAreaPane.addPane(mainEditorPane);
		centerAreaPane.addPane(consoleBottomPane);

		// --- 메뉴 막대 + 상태줄 공통 조립 ---
		const windowLayout = buildEditorWindowLayout(MENU_DEFINITIONS, centerAreaPane);
		this.#rootPane = windowLayout.rootPane;
		this.#statusTextElement = windowLayout.statusTextElement;
		this.setStatusText("No selection");

		this.#rootPane.setCallback(() => {
			if (this.#engine) {
				const graphic = this.#engine.getGraphic();
				this.#engine.resize();
				this.#gameView.draw(graphic);
			}
		});
		System.document.body.innerHTML = "";
		this.#rootPane.attachTo(System.document.body);

		// 콘솔 빈 곳을 누르면 선택 해제.
		this.#consolePane.addEventListener("click", (mouseEvent) => {
			if (mouseEvent.target === this.#consolePane) {
				if (this.#consoleSelectedItem) {
					this.#consoleSelectedItem.style.backgroundColor = "transparent";
					this.#consoleSelectedItem = null;
				}
				this.setStatusText("No selection");
			}
		});

		// 오른쪽 단추 메뉴.
		const findContextTarget = (mouseEventTarget, dataType) => {
			let target = mouseEventTarget;
			while (target && target.dataset.type !== dataType) {
				target = target.parentElement;
			}
			return target || null;
		};
		explorerTree.addEventListener("contextmenu", (mouseEvent) => {
			mouseEvent.preventDefault();
			const contextTarget = findContextTarget(mouseEvent.target, "tree-item");
			openEditorMenuPanelAt(mouseEvent.clientX, mouseEvent.clientY, [
				{
					id: "addExplorerItem",
					label: "Add",
					action: () => {
						const newName = System.prompt("Item name:", "");
						if (newName) {
							explorerTree.appendChild(createTreeItem(newName));
						}
					},
				},
				{
					id: "renameExplorerItem",
					label: "Rename",
					action: () => {
						if (!contextTarget) {
							return;
						}
						const currentName = contextTarget.dataset.label;
						const newName = System.prompt("New name:", currentName);
						if (newName) {
							contextTarget.querySelector("[data-role=\"label\"]").innerText = newName;
							contextTarget.dataset.label = newName;
						}
					},
				},
				{
					id: "removeExplorerItem",
					label: "Remove",
					action: () => {
						if (contextTarget) {
							contextTarget.remove();
						}
					},
				},
			]);
		});
		hierarchyTree.addEventListener("contextmenu", (mouseEvent) => {
			mouseEvent.preventDefault();
			const contextTarget = findContextTarget(mouseEvent.target, "hierarchy-item");
			openEditorMenuPanelAt(mouseEvent.clientX, mouseEvent.clientY, [
				{
					id: "addHierarchyItem",
					label: "Add",
					action: () => {
						const newName = System.prompt("Item name:", "");
						if (newName) {
							hierarchyTree.appendChild(createHierarchyItem(newName));
						}
					},
				},
				{
					id: "renameHierarchyItem",
					label: "Rename",
					action: () => {
						if (!contextTarget) {
							return;
						}
						const currentName = contextTarget.dataset.label;
						const newName = System.prompt("New name:", currentName);
						if (newName) {
							contextTarget.querySelector("[data-role=\"label\"]").innerText = newName;
							contextTarget.dataset.label = newName;
						}
					},
				},
				{
					id: "removeHierarchyItem",
					label: "Remove",
					action: () => {
						if (contextTarget) {
							contextTarget.remove();
						}
					},
				},
			]);
		});
		this.#consolePane.addEventListener("contextmenu", (mouseEvent) => {
			mouseEvent.preventDefault();
			openEditorMenuPanelAt(mouseEvent.clientX, mouseEvent.clientY, [
				{
					id: "clearConsole",
					label: "Clear All",
					action: () => {
						this.#consolePane.innerHTML = "";
					},
				},
			]);
		});

		// 엔진 설정.
		const engineConfiguration = new EngineConfiguration();
		engineConfiguration.referenceResolutionSize = Vector2.create(1280, 800);
		engineConfiguration.canvasId = "game-canvas";
		engineConfiguration.autoResizeOnWindowResize = false;
		engineConfiguration.useStatistics = true;
		this.#engine = new Engine(engineConfiguration);
		this.#gameView = new GameView();
		this.#engine.run(this.#gameView);

		// 이벤트 연동.
		addPropertyButtonElement.addEventListener("click", () => {
			const propertyName = propertyNameInputElement.value.trim();
			const rawValueText = propertyValueInputElement.value;
			const parsedValue = this.parsePropertyValue(rawValueText);
			if (propertyName && !this.#properties.hasOwnProperty(propertyName)) {
				this.addProperty(propertyName, parsedValue);
				propertyNameInputElement.value = "";
				propertyValueInputElement.value = "";
			}
		});

		this.setupGlobalEvents();
		this.setupDataBinding();
		this.addProperty("speed", 1.0);
		this.addProperty("gravity", 0.1);

		this.#editor.addEventListener("input", () => {
			this.compileCode();
		});
	}

	//==============================================================================
	// 메뉴 명령 실행.
	//==============================================================================
	/**
	 * @param { string } commandId
	 */
	executeCommand(commandId) {
		switch (commandId) {
			case "play": {
				this.compileCode();
				this.initParticles();
				this.#isPlaying = true;
				this.updateButtonState("play");
				this.#gameView.setDrawEvent(this.drawOnPlayState.bind(this));
				this.printConsole("Playback started.");
				break;
			}
			case "pause": {
				this.#isPlaying = false;
				this.updateButtonState("pause");
				this.printConsole("Playback paused.");
				break;
			}
			case "stop": {
				this.#isPlaying = false;
				this.initParticles();
				this.updateButtonState("stop");
				this.#gameView.setDrawEvent(this.drawOnStopState.bind(this));
				this.printConsole("Playback stopped.");
				break;
			}
			case "resetLayout": {
				this.#rootPane.resetLayout();
				this.#rootPane.refresh();
				if (this.#engine) {
					const graphic = this.#engine.getGraphic();
					this.#engine.resize();
					this.#gameView.draw(graphic);
				}
				break;
			}
			default: {
				break;
			}
		}
	}

	//==============================================================================
	// 재생 단추 상태 표시.
	//==============================================================================
	/**
	 * @param { string } activeCommandId
	 */
	updateButtonState(activeCommandId) {
		setEditorHeaderButtonSelected(this.#playButtonElement, activeCommandId === "play");
		setEditorHeaderButtonSelected(this.#pauseButtonElement, activeCommandId === "pause");
		setEditorHeaderButtonSelected(this.#stopButtonElement, activeCommandId === "stop");
	}

	//==============================================================================
	// 상태줄 갱신.
	//==============================================================================
	/**
	 * @param { string } statusText
	 */
	setStatusText(statusText) {
		if (this.#statusTextElement) {
			this.#statusTextElement.innerText = statusText;
		}
	}

	//==============================================================================
	// 값 글자 해석. (참 거짓 / 숫자 / 글자)
	//==============================================================================
	/**
	 * @param { string } rawValueText
	 * @returns { * }
	 */
	parsePropertyValue(rawValueText) {
		const trimmedText = rawValueText.trim();
		if (trimmedText === "true") {
			return true;
		}
		if (trimmedText === "false") {
			return false;
		}
		if (trimmedText !== "" && !System.isNaN(System.Number(trimmedText))) {
			return System.Number(trimmedText);
		}
		return rawValueText;
	}

	//==============================================================================
	// 이벤트 설정.
	//==============================================================================
	setupGlobalEvents() {
		System.window.addEventListener("keydown", (keyboardEvent) => {
			if (keyboardEvent.ctrlKey && ["=", "-", "+", "0"].includes(keyboardEvent.key)) {
				keyboardEvent.preventDefault();
			}
		});
		System.window.addEventListener("wheel", (wheelEvent) => {
			if (wheelEvent.ctrlKey) {
				wheelEvent.preventDefault();
			}
		}, { passive: false });
	}

	//==============================================================================
	// 프로퍼티 데이터 초기화.
	//==============================================================================
	setupDataBinding() {
		const self = this;
		this.#properties = new System.Proxy({}, {
			set: function(target, key, value) {
				if (target[key] !== value) {
					target[key] = value;
					const inspectorUI = self.getInspectorUI();
					if (inspectorUI[key] && System.document.activeElement !== inspectorUI[key]) {
						inspectorUI[key].value = value;
					}
				}
				return true;
			}
		});
	}

	//==============================================================================
	// 인스펙터 프로퍼티 추가.
	//==============================================================================
	addProperty(name, value) {
		this.#properties[name] = value;
		const container = this.#inspectorPropsContainer;
		if (!container) {
			return;
		}
		const rowElement = createEditorPropertyRowElement(container, name);
		rowElement.id = `prop-row-${name}`;
		const inputElement = System.document.createElement("input");
		inputElement.type = "text";
		inputElement.value = value;
		decorateEditorInputElement(inputElement);
		inputElement.addEventListener("input", (inputEvent) => {
			const parsedValue = this.parsePropertyValue(inputEvent.target.value);
			this.#properties[name] = parsedValue;
		});
		const removeButtonElement = createEditorButtonElement("X", false);
		removeButtonElement.style.padding = "2px 8px";
		removeButtonElement.style.fontSize = "12px";
		removeButtonElement.style.flexShrink = "0";
		removeButtonElement.addEventListener("click", () => {
			this.removeProperty(name);
		});
		rowElement.appendChild(inputElement);
		rowElement.appendChild(removeButtonElement);

		// 추가.
		this.#inspector[name] = inputElement;
	}

	//==============================================================================
	// 인스펙터 프로퍼티 제거.
	//==============================================================================
	removeProperty(name) {
		const rowElement = System.document.getElementById(`prop-row-${name}`);
		if (rowElement) {
			rowElement.remove();
		}
		delete this.#properties[name];
		delete this.#inspector[name];
	}

	//==============================================================================
	// 파티클 목록 초기화.
	//==============================================================================
	initParticles() {
		const viewManager = this.#engine.getViewManager();
		const canvasNativeSize = viewManager.getCanvasNativeSize();
		this.#particles = [];
		for (let particleIndex = 0; particleIndex < 200; ++particleIndex) {
			this.#particles.push({
				x: canvasNativeSize.x / 2,
				y: canvasNativeSize.y / 2,
				vx: (System.Math.random() - 0.5) * 10,
				vy: (System.Math.random() - 0.5) * 10,
				color: `hsl(${System.Math.random() * 360}, 100%, 60%)`
			});
		}
	}

	//==============================================================================
	// 콘솔 출력.
	//==============================================================================
	printConsole(message, isError = false) {
		const now = new System.Date();
		const hours = String(now.getHours()).padStart(2, "0");
		const minutes = String(now.getMinutes()).padStart(2, "0");
		const seconds = String(now.getSeconds()).padStart(2, "0");
		const timestamp = `[${hours}:${minutes}:${seconds}]`;
		const textColor = isError ? PaneTheme.color.error : PaneTheme.color.success;
		const lineElement = System.document.createElement("div");
		lineElement.style.color = textColor;
		lineElement.style.padding = "2px 12px";
		lineElement.style.whiteSpace = "pre-wrap";
		lineElement.style.cursor = "pointer";
		lineElement.innerText = `${timestamp} ${message}`;
		lineElement.addEventListener("mouseenter", () => {
			if (lineElement !== this.#consoleSelectedItem) {
				lineElement.style.backgroundColor = EditorTheme.hoverColor;
			}
		});
		lineElement.addEventListener("mouseleave", () => {
			if (lineElement !== this.#consoleSelectedItem) {
				lineElement.style.backgroundColor = "transparent";
			}
		});
		lineElement.addEventListener("click", (mouseEvent) => {
			mouseEvent.stopPropagation();
			if (this.#consoleSelectedItem) {
				this.#consoleSelectedItem.style.backgroundColor = "transparent";
			}
			this.#consoleSelectedItem = lineElement;
			lineElement.style.backgroundColor = EditorTheme.accentSoftColor;
			this.setStatusText(`Console > ${timestamp} ${message}`);
		});
		this.#consolePane.appendChild(lineElement);
		this.#consolePane.scrollTop = this.#consolePane.scrollHeight;
	}

	//==============================================================================
	// 코드 확인.
	//==============================================================================
	compileCode() {
		try {
			const buildFunction = new System.Function(this.#editor.value + "\nreturn tick;");
			this.#scripting = buildFunction();
			if (typeof this.#scripting !== "function") {
				throw new System.Error("tick function is not defined.");
			}
			this.printConsole("Compiled successfully.");
		}
		catch (error) {
			this.printConsole("Compile error:\n" + error.message, true);
		}
	}

	//==============================================================================
	// 바탕 그리기. (배경 + 격자)
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 */
	drawBackground(graphic) {
		const viewManager = this.#engine.getViewManager();
		const canvasNativeSize = viewManager.getCanvasNativeSize();
		viewManager.applyCanvasNativeRect(graphic);
		graphic.setFillColor(Colors.darkVanilla);
		graphic.drawRect(Rect.create(0, 0, canvasNativeSize.x, canvasNativeSize.y));
		const gridSize = 50;
		const subGridSize = 10;
		graphic.setStrokeColor("rgba(0, 0, 0, 0.05)");
		for (let x = 0; x <= canvasNativeSize.x; x += subGridSize) {
			graphic.drawLine([Vector2.create(x, 0), Vector2.create(x, canvasNativeSize.y)], 0.5);
		}
		for (let y = 0; y <= canvasNativeSize.y; y += subGridSize) {
			graphic.drawLine([Vector2.create(0, y), Vector2.create(canvasNativeSize.x, y)], 0.5);
		}
		graphic.setStrokeColor("rgba(0, 0, 0, 0.08)");
		for (let x = 0; x <= canvasNativeSize.x; x += gridSize) {
			graphic.drawLine([Vector2.create(x, 0), Vector2.create(x, canvasNativeSize.y)], 1);
		}
		for (let y = 0; y <= canvasNativeSize.y; y += gridSize) {
			graphic.drawLine([Vector2.create(0, y), Vector2.create(canvasNativeSize.x, y)], 1);
		}
	}

	//==============================================================================
	// 재생 상태 출력.
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 */
	drawOnPlayState(graphic) {
		this.drawBackground(graphic);
		const viewManager = this.#engine.getViewManager();
		const canvasNativeSize = viewManager.getCanvasNativeSize();
		for (const particle of this.#particles) {
			if (this.#isPlaying && this.#scripting !== null) {
				try {
					this.#scripting(particle, this.#properties, canvasNativeSize);
				}
				catch (error) {
					this.printConsole("Runtime error:\n" + error.message, true);
					this.#isPlaying = false;
				}
			}
			graphic.setFillColor(particle.color);
			graphic.drawCircle(Vector2.create(particle.x, particle.y), 3);
		}
	}

	//==============================================================================
	// 정지 상태 출력.
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 */
	drawOnStopState(graphic) {
		this.drawBackground(graphic);
	}

	//==============================================================================
	// 실행.
	//==============================================================================
	run() {
		this.initialize();
		this.#editor.value = `
function tick(particle, properties, canvasSize) {
	particle.x += particle.vx * properties.speed;
	particle.y += particle.vy * properties.speed;
	particle.vy += properties.gravity;
	if (particle.x < 0 || particle.x > canvasSize.x) {
		particle.vx *= -1;
		particle.x = particle.x < 0 ? 0 : canvasSize.x;
	}
	if (particle.y < 0 || particle.y > canvasSize.y) {
		particle.vy *= -1;
		particle.y = particle.y < 0 ? 0 : canvasSize.y;
	}
}`;
		this.initParticles();
		this.compileCode();
		this.#gameView.setDrawEvent(this.drawOnStopState.bind(this));
		this.updateButtonState("stop");
	}

	//==============================================================================
	// 인스펙터 목록 반환.
	//==============================================================================
	getInspectorUI() {
		return this.#inspector;
	}
}


//==============================================================================
// 편집기 실행.
//==============================================================================
applyEditorTheme();

const visualEditor = new VisualEditor();
setEditorCommandHandler((commandId) => {
	visualEditor.executeCommand(commandId);
}, (commandId) => {
	return false;
});
System.visualEditor = visualEditor;
System.document.title = "vanilla.js - Visual Editor";
visualEditor.run();
