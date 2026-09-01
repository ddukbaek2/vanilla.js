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
import { ParticleSystem } from "../../src/effect/particlesystem.js";
import { Pane, PaneStyle, PaneTheme } from "../../src/web/pane.js";
import {
	EditorTheme, applyEditorTheme, setEditorCommandHandler, wrapEditorIconMarkup,
	openEditorMenuPanelAt, createEditorSectionElement, createEditorListRowElement, setEditorListRowSelected,
	createEditorHeaderButtonElement, createEditorGroupElement, createEditorPropertyRowElement,
	appendEditorNumberRow, appendEditorTextRow, appendEditorColorRow, appendEditorBooleanRow, appendEditorSelectRow,
	decorateEditorInputElement, createEditorButtonElement, buildEditorWindowLayout, openEditorInputDialog,
	EDITOR_ICON_SHAPES, createEditorHeaderIconElement, setEditorHeaderIconActive,
} from "../common/editorkit.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 목록에 쓰는 그림 아이콘. (14x14 기준, 색은 글자색을 따른다)
const ICON_SHAPES = {
	preset: "<circle cx='7' cy='7' r='2.2' fill='currentColor'/>"
		+ "<circle cx='3' cy='3.6' r='1.2' fill='currentColor' opacity='0.7'/>"
		+ "<circle cx='11.2' cy='4.4' r='1' fill='currentColor' opacity='0.55'/>"
		+ "<circle cx='10.4' cy='10.8' r='1.3' fill='currentColor' opacity='0.7'/>"
		+ "<circle cx='3.4' cy='10.4' r='0.9' fill='currentColor' opacity='0.5'/>",
	system: "<path d='M7 1.8l5.2 5.2-5.2 5.2-5.2-5.2z' fill='none' stroke='currentColor' stroke-width='1.5'/>"
		+ "<circle cx='7' cy='7' r='1.6' fill='currentColor'/>",
};

// 기본 서술. (vfx 애셋 형식 — ParticleSystem.applyDescription 과 1:1)
const DEFAULT_DESCRIPTION = {
	looping: true,
	duration: 1,
	maxParticleCount: 800,
	emissionRate: 60,
	bursts: [],
	shape: "cone",
	shapeRadius: 20,
	coneAngle: 0.35,
	boxSize: [200, 100],
	edgeWidth: 400,
	lifetime: [0.6, 1.2],
	speed: [80, 180],
	size: [6, 14],
	rotation: [0, 0],
	angularVelocity: [0, 0],
	startColorA: [1, 0.75, 0.3, 1],
	startColorB: [1, 0.5, 0.12, 1],
	colorOverLifetime: [
		{ time: 0, color: [1, 1, 0.85, 1] },
		{ time: 0.5, color: [1, 0.6, 0.2, 0.9] },
		{ time: 1, color: [0.65, 0.1, 0.02, 0] },
	],
	sizeOverLifetime: [1, 0.3],
	gravity: [0, -110],
	damping: 1,
	attractor: null,
	wobble: [0, 4],
	renderShape: "circle",
	blendMode: "lighter",
	streakScale: 0.05,
	worldSpace: false,
};

// 프리셋 목록. (기본 서술에 덮어쓰는 값만 기록)
const PRESET_TABLE = {
	Fire: null, // 기본 서술 그대로.
	Snow: {
		emissionRate: 70, shape: "edge", edgeWidth: 700, lifetime: [5, 8], speed: [30, 70], size: [2.5, 6],
		gravity: [0, 12], damping: 0.1, wobble: [14, 1.4], renderShape: "circle", blendMode: "source-over",
		startColorA: [1, 1, 1, 0.95], startColorB: [0.8, 0.88, 1, 0.55], sizeOverLifetime: [1, 1],
		colorOverLifetime: [
			{ time: 0, color: [1, 1, 1, 0] }, { time: 0.06, color: [1, 1, 1, 1] },
			{ time: 0.92, color: [1, 1, 1, 1] }, { time: 1, color: [1, 1, 1, 0] },
		],
	},
	Rain: {
		emissionRate: 200, shape: "edge", edgeWidth: 760, lifetime: [0.8, 1.0], speed: [430, 540], size: [1.4, 2.2],
		gravity: [0, 0], damping: 0, wobble: [0, 4], renderShape: "streak", streakScale: 0.03, blendMode: "source-over",
		startColorA: [0.62, 0.74, 0.95, 0.55], startColorB: [0.75, 0.85, 1, 0.35], sizeOverLifetime: [1, 1],
		colorOverLifetime: [{ time: 0, color: [1, 1, 1, 1] }, { time: 1, color: [1, 1, 1, 1] }],
	},
	Confetti: {
		emissionRate: 0, bursts: [{ time: 0.1, count: 70 }], duration: 1.2, shape: "circle", shapeRadius: 10,
		lifetime: [1.6, 2.6], speed: [150, 380], size: [4.5, 8], rotation: [0, 6.28], angularVelocity: [2.2, 3.6],
		gravity: [0, 480], damping: 1.5, wobble: [8, 3], renderShape: "rect", blendMode: "source-over",
		startColorA: [1, 0.45, 0.55, 1], startColorB: [0.4, 0.75, 1, 1], sizeOverLifetime: [1, 1],
		colorOverLifetime: [
			{ time: 0, color: [1, 1, 1, 1] }, { time: 0.85, color: [1, 1, 1, 1] }, { time: 1, color: [1, 1, 1, 0] },
		],
	},
	Explosion: {
		emissionRate: 0, bursts: [{ time: 0.1, count: 70 }], duration: 1.6, shape: "circle", shapeRadius: 8,
		lifetime: [0.5, 1.2], speed: [240, 600], size: [2.5, 4.5], gravity: [0, 340], damping: 2.2,
		renderShape: "streak", streakScale: 0.045, blendMode: "lighter", wobble: [0, 4],
		startColorA: [1, 0.8, 0.35, 1], startColorB: [1, 0.5, 0.15, 1], sizeOverLifetime: [1, 0.6],
		colorOverLifetime: [{ time: 0, color: [1, 1, 1, 1] }, { time: 1, color: [1, 0.3, 0.05, 0] }],
	},
	Firework: {
		emissionRate: 0, bursts: [{ time: 0.1, count: 80 }], duration: 1.1, shape: "circle", shapeRadius: 4,
		lifetime: [1.0, 1.8], speed: [120, 330], size: [2.5, 4.5], gravity: [0, 140], damping: 1.1,
		renderShape: "circle", blendMode: "lighter", wobble: [0, 4],
		startColorA: [0.5, 0.8, 1, 1], startColorB: [1, 0.6, 0.8, 1], sizeOverLifetime: [1, 0.6],
		colorOverLifetime: [
			{ time: 0, color: [1, 1, 1, 1] }, { time: 0.7, color: [1, 1, 1, 0.9] }, { time: 1, color: [1, 1, 1, 0] },
		],
	},
	Sparkle: {
		emissionRate: 60, shape: "box", boxSize: [700, 380], lifetime: [1.2, 2.4], speed: [0, 8], size: [2, 7],
		gravity: [0, 0], damping: 0, renderShape: "circle", blendMode: "lighter", wobble: [0, 4],
		startColorA: [0.75, 0.85, 1, 1], startColorB: [1, 0.9, 0.7, 1], sizeOverLifetime: [0.4, 1.3],
		colorOverLifetime: [
			{ time: 0, color: [1, 1, 1, 0] }, { time: 0.3, color: [1, 1, 1, 1] }, { time: 1, color: [1, 1, 1, 0] },
		],
	},
	Bubbles: {
		emissionRate: 30, shape: "edge", edgeWidth: 620, lifetime: [2.6, 4.4], speed: [70, 130], size: [4, 14],
		gravity: [0, -30], damping: 0.2, wobble: [20, 2.4], renderShape: "circle", blendMode: "source-over",
		startColorA: [0.6, 0.85, 1, 0.5], startColorB: [0.8, 0.95, 1, 0.3], sizeOverLifetime: [0.7, 1.15],
		colorOverLifetime: [
			{ time: 0, color: [1, 1, 1, 0] }, { time: 0.1, color: [1, 1, 1, 1] },
			{ time: 0.85, color: [1, 1, 1, 1] }, { time: 1, color: [1, 1, 1, 0] },
		],
	},
	Vortex: {
		emissionRate: 140, shape: "circle", shapeRadius: 220, lifetime: [1.8, 3.2], speed: [10, 60], size: [2, 5],
		gravity: [0, 0], damping: 0.35, attractor: { x: 0, y: 0, strength: 170, swirl: 240 },
		renderShape: "circle", blendMode: "lighter", wobble: [0, 4],
		startColorA: [0.5, 0.7, 1, 1], startColorB: [0.8, 0.6, 1, 1], sizeOverLifetime: [1, 0.5],
		colorOverLifetime: [
			{ time: 0, color: [1, 1, 1, 0] }, { time: 0.15, color: [1, 1, 1, 1] },
			{ time: 0.85, color: [1, 1, 1, 0.9] }, { time: 1, color: [1, 1, 1, 0] },
		],
	},
};

// 메뉴 막대 구성. (일반 데스크톱 응용 프로그램과 같은 배치)
const MENU_DEFINITIONS = [
	{
		title: "File",
		items: [
			{ id: "newDocument", label: "New", shortcut: "Ctrl+Alt+N" },
			{ id: "load", label: "Open...", shortcut: "Ctrl+O" },
			{ id: "save", label: "Save", shortcut: "Ctrl+S" },
			{ id: "saveAs", label: "Save As...", shortcut: "Ctrl+Shift+S" },
		],
	},
	{
		title: "Edit",
		items: [
			{ id: "duplicateSystem", label: "Duplicate", shortcut: "Ctrl+D" },
			{ id: "renameSystem", label: "Rename..." },
			{ id: "deleteSystem", label: "Delete", shortcut: "Delete" },
		],
	},
	{
		title: "Playback",
		items: [
			{ id: "restart", label: "Restart" },
			{ id: "burst", label: "Emit Burst x60", shortcut: "Space" },
		],
	},
];


//==============================================================================
// 색 변환 도우미.
//==============================================================================
/**
 * @param { number[] } channels
 * @returns { string }
 */
function composeHexText(channels) {
	const toByte = (value) => System.Math.round(value * 255).toString(16).padStart(2, "0");
	return "#" + toByte(channels[0]) + toByte(channels[1]) + toByte(channels[2]);
}

/**
 * @param { string } hexText
 * @param { number } alphaValue
 * @returns { number[] }
 */
function parseHexChannels(hexText, alphaValue) {
	return [
		System.parseInt(hexText.substring(1, 3), 16) / 255,
		System.parseInt(hexText.substring(3, 5), 16) / 255,
		System.parseInt(hexText.substring(5, 7), 16) / 255,
		alphaValue,
	];
}


//==============================================================================
// 프리뷰 씬.
//==============================================================================
class PreviewScene extends Scene {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { Function } */ #createdEvent;
	/** @type { Function } */ #tickEvent;
	/** @type { Function } */ #overlayEvent;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor(createdEvent, tickEvent, overlayEvent) {
		super();
		this.#createdEvent = createdEvent;
		this.#tickEvent = tickEvent;
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
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		const canvasNativeSize = viewManager.getCanvasNativeSize();
		viewManager.applyCanvasNativeRect(graphic);
		graphic.setFillColor("rgb(16, 17, 20)");
		graphic.drawRect(Rect.create(0, 0, canvasNativeSize.x, canvasNativeSize.y));
		viewManager.applyViewRect(graphic);
		if (this.#overlayEvent) {
			this.#overlayEvent(graphic);
		}
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	tick(timeDelta) {
		super.tick(timeDelta);
		this.#tickEvent();
	}
}


//==============================================================================
// 파티클 편집기.
// - 창 구성과 조작 UI 는 DOM(Pane) 으로 만들고, 프리뷰 화면만 엔진이 그린다.
// - 문서는 파티클 시스템 목록(vfx 애셋)이고, 선택한 시스템을 인스펙터로 편집한다.
// - 애셋 형식: { systems: [{ name, ...서술 }] } — 구형(단일 서술)도 읽는다.
//==============================================================================
class ParticleEditor {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object[] } */ #systems;
	/** @private @type { number } */ #selectedIndex;
	/** @private @type { number } */ #systemNameCounter;
	/** @private @type { string } */ #assetFileName;
	/** @private @type { Engine | null } */ #engine;
	/** @private @type { WorldNode | null } */ #emitterNode;
	/** @private @type { HTMLElement | null } */ #hierarchyListElement;
	/** @private @type { HTMLElement | null } */ #inspectorBodyElement;
	/** @private @type { HTMLElement | null } */ #statusTextElement;
	/** @private @type { HTMLInputElement | null } */ #fileInputElement;
	/** @private @type { HTMLInputElement | null } */ #imageInputElement;
	/** @private @type { object[] } */ #assets;
	/** @private @type { HTMLElement | null } */ #assetListElement;
	/** @private @type { boolean } */ #isGridVisible;
	/** @private @type { boolean } */ #isEditView;
	/** @private @type { HTMLElement | null } */ #gridToggleElement;
	/** @private @type { HTMLElement | null } */ #viewToggleElement;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		this.#systems = [];
		this.#selectedIndex = -1;
		this.#systemNameCounter = 0;
		this.#assetFileName = "effect.vfx.json";
		this.#engine = null;
		this.#emitterNode = null;
		this.#hierarchyListElement = null;
		this.#inspectorBodyElement = null;
		this.#statusTextElement = null;
		this.#fileInputElement = null;
		this.#imageInputElement = null;
		this.#assets = [];
		this.#assetListElement = null;
		this.#isGridVisible = true;
		this.#isEditView = true;
		this.#gridToggleElement = null;
		this.#viewToggleElement = null;
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
		// --- 가운데 영역 ---
		const mainPane = new Pane({ direction: "horizontal", size: "flex" });

		// 좌측: 프리셋 팔레트 + 계층.
		const leftPane = new Pane({ direction: "vertical", size: 240, minSize: 170 });
		const presetPane = new Pane({ size: 320, minSize: 120 });
		const presetElement = createEditorSectionElement("PRESETS", () => {
			const menuItems = [];
			for (const presetName of System.Object.keys(PRESET_TABLE)) {
				menuItems.push({
					id: "addPreset." + presetName,
					label: "Add " + presetName,
					action: () => {
						this.addSystemFromPreset(presetName);
					},
				});
			}
			return menuItems;
		});
		const presetListElement = PaneStyle.create("div", "", { style: { flex: "1", overflowY: "auto", position: "relative" } });
		const presetIconMarkup = wrapEditorIconMarkup(ICON_SHAPES.preset);
		for (const presetName of System.Object.keys(PRESET_TABLE)) {
			const rowElement = createEditorListRowElement(presetIconMarkup, presetName);
			rowElement.addEventListener("click", () => {
				this.addSystemFromPreset(presetName);
			});
			presetListElement.appendChild(rowElement);
		}
		presetElement.appendChild(presetListElement);
		presetPane.getContainer().appendChild(presetElement);

		const hierarchyPane = new Pane({ size: "flex", minSize: 120 });
		const hierarchyElement = createEditorSectionElement("HIERARCHY", () => {
			return [
				{
					id: "clearSelection",
					label: "Clear Selection",
					action: () => {
						this.selectSystem(-1);
					},
				},
				{ separator: true },
				{ id: "duplicateSystem", label: "Duplicate", shortcut: "Ctrl+D" },
				{ id: "renameSystem", label: "Rename..." },
				{ id: "deleteSystem", label: "Delete", shortcut: "Delete" },
			];
		});
		this.#hierarchyListElement = PaneStyle.create("div", "", { style: { flex: "1", overflowY: "auto", position: "relative" } });
		this.#hierarchyListElement.addEventListener("contextmenu", (mouseEvent) => {
			mouseEvent.preventDefault();
		});
		hierarchyElement.appendChild(this.#hierarchyListElement);
		hierarchyPane.getContainer().appendChild(hierarchyElement);

		const assetsPane = new Pane({ size: 190, minSize: 110 });
		const assetsElement = createEditorSectionElement("ASSETS", () => {
			return [
				{
					id: "importImages",
					label: "Import Images...",
					action: () => {
						this.#imageInputElement.click();
					},
				},
			];
		});
		this.#assetListElement = PaneStyle.create("div", "", { style: { flex: "1", overflowY: "auto", position: "relative" } });
		assetsElement.appendChild(this.#assetListElement);
		assetsPane.getContainer().appendChild(assetsElement);

		leftPane.addPane(presetPane);
		leftPane.addPane(hierarchyPane);
		leftPane.addPane(assetsPane);

		// 중앙: 프리뷰.
		const previewPane = new Pane({ size: "flex", minSize: 200 });
		const previewElement = createEditorSectionElement("VIEW", null);
		const previewTitleElement = previewElement.firstChild;
		previewTitleElement.style.display = "flex";
		previewTitleElement.style.alignItems = "center";
		previewTitleElement.style.paddingRight = "6px";
		const previewSpacerElement = PaneStyle.create("div", "", {
			style: { position: "relative", width: "auto", height: "auto", flex: "1" },
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
		const restartButtonElement = createEditorHeaderButtonElement("RESTART");
		restartButtonElement.addEventListener("click", () => {
			this.restartAllSystems();
		});
		const burstButtonElement = createEditorHeaderButtonElement("BURST x60");
		burstButtonElement.addEventListener("click", () => {
			this.emitBurst();
		});
		previewTitleElement.appendChild(previewSpacerElement);
		previewTitleElement.appendChild(this.#gridToggleElement);
		previewTitleElement.appendChild(this.#viewToggleElement);
		previewTitleElement.appendChild(restartButtonElement);
		previewTitleElement.appendChild(burstButtonElement);
		const canvasHolderElement = PaneStyle.create("div", "", {
			style: { position: "relative", width: "auto", height: "auto", flex: "1", backgroundColor: "rgb(16, 17, 20)", overflow: "hidden" },
		});
		const canvasElement = PaneStyle.create("canvas", "", { id: "previewCanvas" });
		canvasHolderElement.appendChild(canvasElement);
		previewElement.appendChild(canvasHolderElement);
		previewPane.getContainer().appendChild(previewElement);

		// 우측: 인스펙터.
		const inspectorPane = new Pane({ size: 336, minSize: 220 });
		const inspectorElement = createEditorSectionElement("INSPECTOR", null);
		this.#inspectorBodyElement = PaneStyle.create("div", "", {
			style: { flex: "1", overflowY: "auto", position: "relative", paddingBottom: "40px" },
		});
		inspectorElement.appendChild(this.#inspectorBodyElement);
		inspectorPane.getContainer().appendChild(inspectorElement);

		mainPane.addPane(leftPane);
		mainPane.addPane(previewPane);
		mainPane.addPane(inspectorPane);

		// --- 메뉴 막대 + 상태줄 공통 조립 ---
		const windowLayout = buildEditorWindowLayout(MENU_DEFINITIONS, mainPane);
		const rootPane = windowLayout.rootPane;
		this.#statusTextElement = windowLayout.statusTextElement;
		rootPane.attachTo(System.document.body);

		// 파일 열기 입력.
		this.#fileInputElement = System.document.createElement("input");
		this.#fileInputElement.type = "file";
		this.#fileInputElement.accept = ".json";
		this.#fileInputElement.style.display = "none";
		this.#fileInputElement.addEventListener("change", async () => {
			const selectedFile = this.#fileInputElement.files[0];
			if (!selectedFile) {
				return;
			}
			const jsonText = await selectedFile.text();
			this.loadAssetText(jsonText, selectedFile.name);
			this.#fileInputElement.value = "";
		});
		System.document.body.appendChild(this.#fileInputElement);

		// 이미지 가져오기 입력.
		this.#imageInputElement = System.document.createElement("input");
		this.#imageInputElement.type = "file";
		this.#imageInputElement.accept = "image/*";
		this.#imageInputElement.multiple = true;
		this.#imageInputElement.style.display = "none";
		this.#imageInputElement.addEventListener("change", async () => {
			for (const selectedFile of this.#imageInputElement.files) {
				await this.importImageAsset(selectedFile);
			}
			this.#imageInputElement.value = "";
			this.rebuildAssetList();
		});
		System.document.body.appendChild(this.#imageInputElement);

		// 단축키.
		System.window.addEventListener("keydown", (keyboardEvent) => {
			const targetTag = keyboardEvent.target.tagName;
			const isTypingTarget = (targetTag === "INPUT" || targetTag === "TEXTAREA" || targetTag === "SELECT");
			if (keyboardEvent.ctrlKey && keyboardEvent.altKey && keyboardEvent.key.toLowerCase() === "n") {
				keyboardEvent.preventDefault();
				this.executeCommand("newDocument");
				return;
			}
			if (keyboardEvent.ctrlKey && keyboardEvent.shiftKey && keyboardEvent.key.toLowerCase() === "s") {
				keyboardEvent.preventDefault();
				this.executeCommand("saveAs");
				return;
			}
			if (keyboardEvent.ctrlKey && keyboardEvent.key.toLowerCase() === "s") {
				keyboardEvent.preventDefault();
				this.executeCommand("save");
				return;
			}
			if (keyboardEvent.ctrlKey && keyboardEvent.key.toLowerCase() === "o") {
				keyboardEvent.preventDefault();
				this.executeCommand("load");
				return;
			}
			if (isTypingTarget) {
				return;
			}
			if (keyboardEvent.ctrlKey && keyboardEvent.key.toLowerCase() === "d") {
				keyboardEvent.preventDefault();
				this.executeCommand("duplicateSystem");
				return;
			}
			if (keyboardEvent.key === "Delete") {
				this.executeCommand("deleteSystem");
				return;
			}
			if (keyboardEvent.key === " ") {
				keyboardEvent.preventDefault();
				this.emitBurst();
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
		switch (commandId) {
			case "newDocument": {
				this.clearSystems();
				this.#assetFileName = "effect.vfx.json";
				this.addSystemFromPreset("Fire");
				break;
			}
			case "save": {
				this.saveAsset(this.#assetFileName);
				break;
			}
			case "saveAs": {
				openEditorInputDialog("Save As", "File name", this.#assetFileName, (inputText) => {
					const fileName = inputText.trim();
					if (fileName) {
						this.#assetFileName = fileName;
						this.saveAsset(fileName);
					}
				});
				break;
			}
			case "load": {
				this.#fileInputElement.click();
				break;
			}
			case "duplicateSystem": {
				this.duplicateSelectedSystem();
				break;
			}
			case "renameSystem": {
				this.renameSelectedSystem();
				break;
			}
			case "deleteSystem": {
				this.deleteSelectedSystem();
				break;
			}
			case "restart": {
				this.restartAllSystems();
				break;
			}
			case "burst": {
				this.emitBurst();
				break;
			}
			default: {
				break;
			}
		}
	}

	//==============================================================================
	// 애셋 직렬화.
	//==============================================================================
	/**
	 * @returns { object }
	 */
	composeAsset() {
		const systemList = [];
		for (const systemEntry of this.#systems) {
			const clonedDescription = System.JSON.parse(System.JSON.stringify(systemEntry.description));
			systemList.push(System.Object.assign({ name: systemEntry.name }, clonedDescription));
		}
		return { systems: systemList };
	}

	//==============================================================================
	// 애셋 저장. (.vfx.json 내려받기)
	//==============================================================================
	/**
	 * @param { string } fileName
	 */
	saveAsset(fileName) {
		const asset = this.composeAsset();
		const jsonText = System.JSON.stringify(asset, null, "\t");
		const blob = new System.Blob([jsonText], { type: "application/json" });
		const anchorElement = System.document.createElement("a");
		anchorElement.href = System.URL.createObjectURL(blob);
		anchorElement.download = fileName;
		anchorElement.click();
		System.URL.revokeObjectURL(anchorElement.href);
		this.refreshStatus();
	}

	//==============================================================================
	// 애셋 읽기. (신형: { systems: [...] } / 구형: 단일 서술 객체)
	//==============================================================================
	/**
	 * @param { string } jsonText
	 * @param { string } fileName
	 */
	loadAssetText(jsonText, fileName) {
		const parsedAsset = System.JSON.parse(jsonText);
		this.clearSystems();
		this.#assetFileName = fileName;
		if (System.Array.isArray(parsedAsset.systems)) {
			for (const systemDescription of parsedAsset.systems) {
				const systemName = systemDescription.name ? systemDescription.name : this.composeSystemName("System");
				this.addSystem(systemName, systemDescription);
			}
		}
		else {
			this.addSystem(this.composeSystemName("System"), parsedAsset);
		}
		if (this.#systems.length > 0) {
			this.selectSystem(0);
		}
	}

	//==============================================================================
	// 시스템 이름 만들기. (중복을 피해 번호를 붙인다)
	//==============================================================================
	/**
	 * @param { string } baseName
	 * @returns { string }
	 */
	composeSystemName(baseName) {
		this.#systemNameCounter += 1;
		let candidateName = baseName;
		while (this.#systems.some((systemEntry) => systemEntry.name === candidateName)) {
			candidateName = baseName + " " + this.#systemNameCounter;
			this.#systemNameCounter += 1;
		}
		return candidateName;
	}

	//==============================================================================
	// 시스템 추가. (서술은 기본값 위에 덮어쓴다)
	//==============================================================================
	/**
	 * @param { string } systemName
	 * @param { object } overrideDescription
	 */
	addSystem(systemName, overrideDescription) {
		const description = System.JSON.parse(System.JSON.stringify(DEFAULT_DESCRIPTION));
		if (overrideDescription) {
			const clonedOverride = System.JSON.parse(System.JSON.stringify(overrideDescription));
			delete clonedOverride.name;
			System.Object.assign(description, clonedOverride);
		}
		const systemEntry = { name: systemName, description: description, node: null, particleSystem: null };
		this.#systems.push(systemEntry);
		this.attachSystemToScene(systemEntry);
		this.rebuildHierarchy();
		this.selectSystem(this.#systems.length - 1);
	}

	//==============================================================================
	// 프리셋으로 시스템 추가.
	//==============================================================================
	/**
	 * @param { string } presetName
	 */
	addSystemFromPreset(presetName) {
		const presetOverride = PRESET_TABLE[presetName];
		this.addSystem(this.composeSystemName(presetName), presetOverride);
	}

	//==============================================================================
	// 시스템을 씬에 붙이기.
	//==============================================================================
	/**
	 * @param { object } systemEntry
	 */
	attachSystemToScene(systemEntry) {
		if (!this.#emitterNode) {
			return;
		}
		const systemNode = new WorldNode();
		systemNode.setName(systemEntry.name);
		systemNode.setPivot(Pivot.topLeft.clone());
		systemNode.setAnchor(Pivot.topLeft.clone());
		systemNode.setLocalPosition(Vector2.create(0, 0));
		this.#emitterNode.addChild(systemNode);
		const particleSystem = systemNode.addComponent(ParticleSystem);
		particleSystem.applyDescription(systemEntry.description);
		systemEntry.node = systemNode;
		systemEntry.particleSystem = particleSystem;
		this.applyImageFromDescription(systemEntry);
	}

	//==============================================================================
	// 시스템 전부 제거.
	//==============================================================================
	clearSystems() {
		for (const systemEntry of this.#systems) {
			if (systemEntry.node && this.#emitterNode) {
				this.#emitterNode.removeChild(systemEntry.node);
			}
		}
		this.#systems = [];
		this.#selectedIndex = -1;
		this.#systemNameCounter = 0;
		this.rebuildHierarchy();
		this.rebuildInspector();
	}

	//==============================================================================
	// 선택 시스템 복제.
	//==============================================================================
	duplicateSelectedSystem() {
		const selectedEntry = this.getSelectedSystem();
		if (!selectedEntry) {
			return;
		}
		this.addSystem(this.composeSystemName(selectedEntry.name), selectedEntry.description);
	}

	//==============================================================================
	// 선택 시스템 이름 바꾸기.
	//==============================================================================
	renameSelectedSystem() {
		const selectedEntry = this.getSelectedSystem();
		if (!selectedEntry) {
			return;
		}
		openEditorInputDialog("Rename", "System name", selectedEntry.name, (inputText) => {
			const newName = inputText.trim();
			if (newName) {
				selectedEntry.name = newName;
				if (selectedEntry.node) {
					selectedEntry.node.setName(newName);
				}
				this.rebuildHierarchy();
				this.rebuildInspector();
				this.refreshStatus();
			}
		}, "Rename");
	}

	//==============================================================================
	// 선택 시스템 삭제.
	//==============================================================================
	deleteSelectedSystem() {
		const selectedEntry = this.getSelectedSystem();
		if (!selectedEntry) {
			return;
		}
		if (selectedEntry.node && this.#emitterNode) {
			this.#emitterNode.removeChild(selectedEntry.node);
		}
		this.#systems.splice(this.#selectedIndex, 1);
		const nextIndex = System.Math.min(this.#selectedIndex, this.#systems.length - 1);
		this.rebuildHierarchy();
		this.selectSystem(nextIndex);
	}

	//==============================================================================
	// 선택 시스템 반환.
	//==============================================================================
	/**
	 * @returns { object | null }
	 */
	getSelectedSystem() {
		if (this.#selectedIndex < 0 || this.#selectedIndex >= this.#systems.length) {
			return null;
		}
		return this.#systems[this.#selectedIndex];
	}

	//==============================================================================
	// 격자 / 화면 전환 표시 갱신.
	//==============================================================================
	refreshViewToggles() {
		setEditorHeaderIconActive(this.#gridToggleElement, this.#isGridVisible && this.#isEditView);
		setEditorHeaderIconActive(this.#viewToggleElement, this.#isEditView === false);
	}

	//==============================================================================
	// 편집 오버레이 그리기. (격자 + 이미터 표시 — 결과 화면에서는 그리지 않는다)
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 */
	drawViewOverlay(graphic) {
		if (this.#isEditView === false) {
			return;
		}
		const viewManager = this.#engine.getViewManager();
		const viewSize = viewManager.getViewSize();
		if (this.#isGridVisible) {
			const gridSize = 50;
			graphic.setStrokeColor("rgba(255, 255, 255, 0.05)");
			for (let x = 0; x <= viewSize.x; x += gridSize) {
				graphic.drawLine([Vector2.create(x, 0), Vector2.create(x, viewSize.y)], 1);
			}
			for (let y = 0; y <= viewSize.y; y += gridSize) {
				graphic.drawLine([Vector2.create(0, y), Vector2.create(viewSize.x, y)], 1);
			}
		}

		// 이미터 위치 십자 표시.
		if (this.#emitterNode) {
			const emitterPosition = this.#emitterNode.getLocalPosition();
			graphic.setStrokeColor("rgba(212, 176, 106, 0.8)");
			graphic.drawLine([Vector2.create(emitterPosition.x - 10, emitterPosition.y), Vector2.create(emitterPosition.x + 10, emitterPosition.y)], 1.5);
			graphic.drawLine([Vector2.create(emitterPosition.x, emitterPosition.y - 10), Vector2.create(emitterPosition.x, emitterPosition.y + 10)], 1.5);
		}
	}

	//==============================================================================
	// 이미지 애셋 가져오기. (데이터 주소로 읽어 목록에 담는다)
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
					this.#assets.push({ name: imageFile.name, dataUrl: fileReader.result, imageElement: imageElement });
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

	//==============================================================================
	// 애셋 목록 재구성.
	//==============================================================================
	rebuildAssetList() {
		this.#assetListElement.textContent = "";
		const imageIconMarkup = wrapEditorIconMarkup(EDITOR_ICON_SHAPES.image);
		for (let assetIndex = 0; assetIndex < this.#assets.length; ++assetIndex) {
			const assetEntry = this.#assets[assetIndex];
			const rowElement = createEditorListRowElement(imageIconMarkup, assetEntry.name);
			const currentIndex = assetIndex;
			rowElement.addEventListener("click", () => {
				this.applyAssetToSelectedSystem(currentIndex);
			});
			rowElement.addEventListener("contextmenu", (mouseEvent) => {
				mouseEvent.preventDefault();
				mouseEvent.stopPropagation();
				openEditorMenuPanelAt(mouseEvent.clientX, mouseEvent.clientY, [
					{
						id: "applyAsset",
						label: "Apply to Selected System",
						action: () => {
							this.applyAssetToSelectedSystem(currentIndex);
						},
					},
					{ separator: true },
					{
						id: "removeAsset",
						label: "Remove",
						action: () => {
							this.#assets.splice(currentIndex, 1);
							this.rebuildAssetList();
						},
					},
				]);
			});
			this.#assetListElement.appendChild(rowElement);
		}
	}

	//==============================================================================
	// 선택 시스템에 이미지 애셋 적용. (renderShape 를 image 로 바꾼다)
	//==============================================================================
	/**
	 * @param { number } assetIndex
	 */
	applyAssetToSelectedSystem(assetIndex) {
		const selectedEntry = this.getSelectedSystem();
		const assetEntry = this.#assets[assetIndex];
		if (!selectedEntry || !assetEntry) {
			this.#statusTextElement.innerText = "Select a system in the hierarchy first.";
			return;
		}
		selectedEntry.description.renderShape = "image";
		selectedEntry.description.imageDataUrl = assetEntry.dataUrl;
		this.applySelectedSystem();
		if (selectedEntry.particleSystem) {
			selectedEntry.particleSystem.setImage(assetEntry.imageElement);
		}
		this.rebuildInspector();
		this.refreshStatus();
	}

	//==============================================================================
	// 서술의 이미지 주소를 파티클 시스템에 반영. (파일에서 읽어온 문서용)
	//==============================================================================
	/**
	 * @param { object } systemEntry
	 */
	applyImageFromDescription(systemEntry) {
		if (!systemEntry.description.imageDataUrl || !systemEntry.particleSystem) {
			return;
		}
		const imageElement = new System.Image();
		imageElement.onload = () => {
			systemEntry.particleSystem.setImage(imageElement);
		};
		imageElement.src = systemEntry.description.imageDataUrl;
	}

	//==============================================================================
	// 계층 목록 재구성.
	//==============================================================================
	rebuildHierarchy() {
		if (!this.#hierarchyListElement) {
			return;
		}
		this.#hierarchyListElement.textContent = "";

		// 이미터 뿌리 줄. (누르면 선택을 푼다)
		const emitterIconMarkup = wrapEditorIconMarkup(EDITOR_ICON_SHAPES.node);
		const rootRowElement = createEditorListRowElement(emitterIconMarkup, "Emitter");
		rootRowElement.addEventListener("click", () => {
			this.selectSystem(-1);
		});
		this.#hierarchyListElement.appendChild(rootRowElement);

		const systemIconMarkup = wrapEditorIconMarkup(ICON_SHAPES.system);
		for (let systemIndex = 0; systemIndex < this.#systems.length; ++systemIndex) {
			const systemEntry = this.#systems[systemIndex];
			const rowElement = createEditorListRowElement(systemIconMarkup, systemEntry.name);
			rowElement.style.paddingLeft = "30px";
			setEditorListRowSelected(rowElement, systemIndex === this.#selectedIndex);
			const currentIndex = systemIndex;
			rowElement.addEventListener("click", () => {
				this.selectSystem(currentIndex);
			});
			rowElement.addEventListener("contextmenu", (mouseEvent) => {
				mouseEvent.preventDefault();
				mouseEvent.stopPropagation();
				this.selectSystem(currentIndex);
				openEditorMenuPanelAt(mouseEvent.clientX, mouseEvent.clientY, [
					{ id: "duplicateSystem", label: "Duplicate", shortcut: "Ctrl+D" },
					{ id: "renameSystem", label: "Rename..." },
					{ separator: true },
					{ id: "deleteSystem", label: "Delete", shortcut: "Delete" },
				]);
			});
			this.#hierarchyListElement.appendChild(rowElement);
		}
	}

	//==============================================================================
	// 시스템 선택.
	//==============================================================================
	/**
	 * @param { number } systemIndex
	 */
	selectSystem(systemIndex) {
		this.#selectedIndex = systemIndex;
		const rowElements = this.#hierarchyListElement.children;
		for (let rowIndex = 1; rowIndex < rowElements.length; ++rowIndex) {
			setEditorListRowSelected(rowElements[rowIndex], rowIndex - 1 === systemIndex);
		}
		this.rebuildInspector();
		this.refreshStatus();
	}

	//==============================================================================
	// 선택 시스템 서술 반영.
	//==============================================================================
	applySelectedSystem() {
		const selectedEntry = this.getSelectedSystem();
		if (selectedEntry && selectedEntry.particleSystem) {
			selectedEntry.particleSystem.applyDescription(selectedEntry.description);
		}
	}

	//==============================================================================
	// 전체 재시작.
	//==============================================================================
	restartAllSystems() {
		for (const systemEntry of this.#systems) {
			if (systemEntry.particleSystem) {
				systemEntry.particleSystem.stop(true);
				systemEntry.particleSystem.applyDescription(systemEntry.description);
				systemEntry.particleSystem.play();
			}
		}
	}

	//==============================================================================
	// 버스트 방출. (선택 시스템이 없으면 전체)
	//==============================================================================
	emitBurst() {
		const selectedEntry = this.getSelectedSystem();
		if (selectedEntry && selectedEntry.particleSystem) {
			selectedEntry.particleSystem.emit(60);
			return;
		}
		for (const systemEntry of this.#systems) {
			if (systemEntry.particleSystem) {
				systemEntry.particleSystem.emit(60);
			}
		}
	}

	//==============================================================================
	// 상태줄 갱신.
	//==============================================================================
	refreshStatus() {
		if (!this.#statusTextElement) {
			return;
		}
		let particleCount = 0;
		for (const systemEntry of this.#systems) {
			if (systemEntry.particleSystem) {
				particleCount += systemEntry.particleSystem.getParticleCount();
			}
		}
		const selectedEntry = this.getSelectedSystem();
		const selectionText = selectedEntry ? selectedEntry.name : "No selection";
		this.#statusTextElement.innerText = this.#assetFileName + "    " + selectionText
			+ "    systems " + this.#systems.length + "    particles " + particleCount;
	}

	//==============================================================================
	// 인스펙터 묶음 추가.
	//==============================================================================
	/**
	 * @param { string } titleText
	 * @returns { HTMLElement }
	 */
	appendInspectorGroup(titleText) {
		const groupBodyElement = PaneStyle.create("div", "", {
			style: { position: "relative", width: "auto", height: "auto" },
		});
		const groupElement = createEditorGroupElement(titleText, groupBodyElement, null);
		this.#inspectorBodyElement.appendChild(groupElement);
		this.#inspectorBodyElement.appendChild(groupBodyElement);
		return groupBodyElement;
	}

	//==============================================================================
	// 인스펙터 전체 구성. (선택 시스템의 서술 편집)
	//==============================================================================
	rebuildInspector() {
		this.#inspectorBodyElement.textContent = "";
		const selectedEntry = this.getSelectedSystem();
		if (!selectedEntry) {
			const emptyElement = PaneStyle.create("div", "", {
				text: "No selection.",
				style: {
					position: "relative", width: "auto", height: "auto",
					padding: "16px 14px", fontSize: "13px", color: PaneTheme.color.textDim,
				},
			});
			this.#inspectorBodyElement.appendChild(emptyElement);
			return;
		}
		const description = selectedEntry.description;
		const applyChange = () => {
			this.applySelectedSystem();
		};

		// 이름.
		const systemBodyElement = this.appendInspectorGroup("SYSTEM");
		appendEditorTextRow(systemBodyElement, "Name", selectedEntry.name, (nextName) => {
			const trimmedName = nextName.trim();
			if (trimmedName) {
				selectedEntry.name = trimmedName;
				if (selectedEntry.node) {
					selectedEntry.node.setName(trimmedName);
				}
				this.rebuildHierarchy();
				this.refreshStatus();
			}
		});

		// 방출.
		const emissionBodyElement = this.appendInspectorGroup("EMISSION");
		appendEditorNumberRow(emissionBodyElement, "Emission Rate", description.emissionRate, 1, (value) => {
			description.emissionRate = value;
			applyChange();
		});
		appendEditorBooleanRow(emissionBodyElement, "Looping", description.looping, (value) => {
			description.looping = value;
			applyChange();
		});
		appendEditorNumberRow(emissionBodyElement, "Duration", description.duration, 0.1, (value) => {
			description.duration = value;
			applyChange();
		});
		appendEditorNumberRow(emissionBodyElement, "Max Particles", description.maxParticleCount, 1, (value) => {
			description.maxParticleCount = value;
			applyChange();
		});

		// 모양.
		const shapeBodyElement = this.appendInspectorGroup("SHAPE");
		appendEditorSelectRow(shapeBodyElement, "Shape", ["point", "circle", "cone", "box", "edge"], description.shape, (value) => {
			description.shape = value;
			applyChange();
		});
		appendEditorNumberRow(shapeBodyElement, "Radius", description.shapeRadius, 1, (value) => {
			description.shapeRadius = value;
			applyChange();
		});
		appendEditorNumberRow(shapeBodyElement, "Cone Angle", description.coneAngle, 0.05, (value) => {
			description.coneAngle = value;
			applyChange();
		});
		appendEditorNumberRow(shapeBodyElement, "Box Width", description.boxSize[0], 1, (value) => {
			description.boxSize[0] = value;
			applyChange();
		});
		appendEditorNumberRow(shapeBodyElement, "Box Height", description.boxSize[1], 1, (value) => {
			description.boxSize[1] = value;
			applyChange();
		});
		appendEditorNumberRow(shapeBodyElement, "Edge Width", description.edgeWidth, 1, (value) => {
			description.edgeWidth = value;
			applyChange();
		});

		// 시작 범위.
		const startBodyElement = this.appendInspectorGroup("START RANGE");
		appendEditorNumberRow(startBodyElement, "Lifetime Min", description.lifetime[0], 0.1, (value) => {
			description.lifetime[0] = value;
			applyChange();
		});
		appendEditorNumberRow(startBodyElement, "Lifetime Max", description.lifetime[1], 0.1, (value) => {
			description.lifetime[1] = value;
			applyChange();
		});
		appendEditorNumberRow(startBodyElement, "Speed Min", description.speed[0], 1, (value) => {
			description.speed[0] = value;
			applyChange();
		});
		appendEditorNumberRow(startBodyElement, "Speed Max", description.speed[1], 1, (value) => {
			description.speed[1] = value;
			applyChange();
		});
		appendEditorNumberRow(startBodyElement, "Size Min", description.size[0], 0.5, (value) => {
			description.size[0] = value;
			applyChange();
		});
		appendEditorNumberRow(startBodyElement, "Size Max", description.size[1], 0.5, (value) => {
			description.size[1] = value;
			applyChange();
		});
		appendEditorNumberRow(startBodyElement, "Rotation Min", description.rotation[0], 0.1, (value) => {
			description.rotation[0] = value;
			applyChange();
		});
		appendEditorNumberRow(startBodyElement, "Rotation Max", description.rotation[1], 0.1, (value) => {
			description.rotation[1] = value;
			applyChange();
		});
		appendEditorNumberRow(startBodyElement, "Spin Min", description.angularVelocity[0], 0.2, (value) => {
			description.angularVelocity[0] = value;
			applyChange();
		});
		appendEditorNumberRow(startBodyElement, "Spin Max", description.angularVelocity[1], 0.2, (value) => {
			description.angularVelocity[1] = value;
			applyChange();
		});
		const startColorAHex = composeHexText(description.startColorA);
		appendEditorColorRow(startBodyElement, "Color A", startColorAHex, description.startColorA[3], (hexText, alphaValue) => {
			description.startColorA = parseHexChannels(hexText, alphaValue);
			applyChange();
		});
		const startColorBHex = composeHexText(description.startColorB);
		appendEditorColorRow(startBodyElement, "Color B", startColorBHex, description.startColorB[3], (hexText, alphaValue) => {
			description.startColorB = parseHexChannels(hexText, alphaValue);
			applyChange();
		});

		// 수명 그라디언트.
		const gradientBodyElement = this.appendInspectorGroup("COLOR OVER LIFETIME");
		const gradientContainerElement = PaneStyle.create("div", "", {
			style: { position: "relative", width: "auto", height: "auto" },
		});
		gradientBodyElement.appendChild(gradientContainerElement);
		const rebuildGradientRows = () => {
			gradientContainerElement.textContent = "";
			description.colorOverLifetime.forEach((gradientKey, keyIndex) => {
				const rowElement = PaneStyle.create("div", "", {
					style: {
						position: "relative", width: "auto", height: "auto",
						display: "flex", alignItems: "center", gap: "6px", padding: "5px 12px",
						borderBottom: "1px solid " + EditorTheme.borderSoftColor,
					},
				});
				const timeInputElement = System.document.createElement("input");
				timeInputElement.type = "text";
				timeInputElement.value = String(gradientKey.time);
				decorateEditorInputElement(timeInputElement);
				timeInputElement.style.flex = "0 0 52px";
				const colorInputElement = System.document.createElement("input");
				colorInputElement.type = "color";
				colorInputElement.value = composeHexText(gradientKey.color);
				colorInputElement.style.cssText = "position:relative;width:34px;height:22px;padding:0;border:1px solid "
					+ PaneTheme.color.border + ";background:transparent;cursor:pointer;flex-shrink:0;";
				const alphaInputElement = System.document.createElement("input");
				alphaInputElement.type = "text";
				alphaInputElement.value = String(gradientKey.color[3]);
				decorateEditorInputElement(alphaInputElement);
				alphaInputElement.style.flex = "0 0 52px";
				const removeButtonElement = createEditorButtonElement("Remove", false);
				removeButtonElement.style.padding = "2px 10px";
				removeButtonElement.style.fontSize = "12px";
				const commitKey = () => {
					const timeValue = System.Number.parseFloat(timeInputElement.value);
					const alphaValue = System.Number.parseFloat(alphaInputElement.value);
					gradientKey.time = System.Number.isFinite(timeValue) ? timeValue : gradientKey.time;
					const safeAlpha = System.Number.isFinite(alphaValue) ? alphaValue : 1;
					gradientKey.color = parseHexChannels(colorInputElement.value, safeAlpha);
					description.colorOverLifetime.sort((left, right) => left.time - right.time);
					applyChange();
				};
				timeInputElement.addEventListener("change", () => {
					commitKey();
					rebuildGradientRows();
				});
				colorInputElement.addEventListener("input", commitKey);
				alphaInputElement.addEventListener("change", commitKey);
				removeButtonElement.addEventListener("click", () => {
					description.colorOverLifetime.splice(keyIndex, 1);
					applyChange();
					rebuildGradientRows();
				});
				rowElement.appendChild(timeInputElement);
				rowElement.appendChild(colorInputElement);
				rowElement.appendChild(alphaInputElement);
				rowElement.appendChild(removeButtonElement);
				gradientContainerElement.appendChild(rowElement);
			});
		};
		const addKeyRowElement = PaneStyle.create("div", "", {
			style: { position: "relative", width: "auto", height: "auto", padding: "8px 12px" },
		});
		const addKeyButtonElement = createEditorButtonElement("Add Key", false);
		addKeyButtonElement.style.display = "inline-block";
		addKeyButtonElement.addEventListener("click", () => {
			description.colorOverLifetime.push({ time: 1, color: [1, 1, 1, 0] });
			applyChange();
			rebuildGradientRows();
		});
		addKeyRowElement.appendChild(addKeyButtonElement);
		gradientBodyElement.appendChild(addKeyRowElement);
		rebuildGradientRows();

		// 수명 크기.
		const sizeBodyElement = this.appendInspectorGroup("SIZE OVER LIFETIME");
		appendEditorNumberRow(sizeBodyElement, "Scale Start", description.sizeOverLifetime[0], 0.1, (value) => {
			description.sizeOverLifetime[0] = value;
			applyChange();
		});
		appendEditorNumberRow(sizeBodyElement, "Scale End", description.sizeOverLifetime[1], 0.1, (value) => {
			description.sizeOverLifetime[1] = value;
			applyChange();
		});

		// 물리.
		const physicsBodyElement = this.appendInspectorGroup("PHYSICS");
		appendEditorNumberRow(physicsBodyElement, "Gravity X", description.gravity[0], 1, (value) => {
			description.gravity[0] = value;
			applyChange();
		});
		appendEditorNumberRow(physicsBodyElement, "Gravity Y", description.gravity[1], 1, (value) => {
			description.gravity[1] = value;
			applyChange();
		});
		appendEditorNumberRow(physicsBodyElement, "Damping", description.damping, 0.1, (value) => {
			description.damping = value;
			applyChange();
		});
		appendEditorNumberRow(physicsBodyElement, "Wobble Width", description.wobble[0], 0.2, (value) => {
			description.wobble[0] = value;
			applyChange();
		});
		appendEditorNumberRow(physicsBodyElement, "Wobble Speed", description.wobble[1], 0.2, (value) => {
			description.wobble[1] = value;
			applyChange();
		});
		appendEditorBooleanRow(physicsBodyElement, "Attractor", description.attractor !== null, (isEnabled) => {
			description.attractor = isEnabled ? { x: 0, y: 0, strength: 170, swirl: 240 } : null;
			applyChange();
			this.rebuildInspector();
		});
		if (description.attractor) {
			appendEditorNumberRow(physicsBodyElement, "Center X", description.attractor.x, 1, (value) => {
				description.attractor.x = value;
				applyChange();
			});
			appendEditorNumberRow(physicsBodyElement, "Center Y", description.attractor.y, 1, (value) => {
				description.attractor.y = value;
				applyChange();
			});
			appendEditorNumberRow(physicsBodyElement, "Strength", description.attractor.strength, 1, (value) => {
				description.attractor.strength = value;
				applyChange();
			});
			appendEditorNumberRow(physicsBodyElement, "Swirl", description.attractor.swirl, 1, (value) => {
				description.attractor.swirl = value;
				applyChange();
			});
		}

		// 렌더.
		const renderBodyElement = this.appendInspectorGroup("RENDER");
		appendEditorSelectRow(renderBodyElement, "Shape", ["circle", "rect", "streak", "image"], description.renderShape, (value) => {
			description.renderShape = value;
			applyChange();
		});
		appendEditorSelectRow(renderBodyElement, "Blend", ["source-over", "lighter", "multiply", "screen"], description.blendMode, (value) => {
			description.blendMode = value;
			applyChange();
		});
		appendEditorNumberRow(renderBodyElement, "Streak Scale", description.streakScale, 0.005, (value) => {
			description.streakScale = value;
			applyChange();
		});
		appendEditorBooleanRow(renderBodyElement, "World Space", description.worldSpace, (value) => {
			description.worldSpace = value;
			applyChange();
		});
	}

	//==============================================================================
	// 엔진 실행.
	//==============================================================================
	startEngine() {
		const engineConfiguration = new EngineConfiguration();
		engineConfiguration.referenceResolutionSize = Vector2.create(960, 600);
		engineConfiguration.canvasId = "previewCanvas";
		// 캔버스가 프리뷰 패널 크기를 따르도록 창 전체 자동 리사이즈는 끈다.
		engineConfiguration.autoResizeOnWindowResize = false;
		this.#engine = new Engine(engineConfiguration);
		const previewScene = new PreviewScene((scene) => {
			const rootNode = scene.getRoot();
			rootNode.setPivot(Pivot.topLeft.clone());
			rootNode.setAnchor(Pivot.topLeft.clone());
			this.#emitterNode = new WorldNode();
			this.#emitterNode.setName("Emitter");
			this.#emitterNode.setPivot(Pivot.topLeft.clone());
			this.#emitterNode.setAnchor(Pivot.topLeft.clone());
			this.#emitterNode.setLocalPosition(Vector2.create(480, 300));
			rootNode.addChild(this.#emitterNode);

			// 씬 준비 후 기본 문서. (Fire 시스템 하나)
			this.addSystemFromPreset("Fire");
		}, () => {
			this.refreshStatus();
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

const particleEditor = new ParticleEditor();
setEditorCommandHandler((commandId) => {
	particleEditor.executeCommand(commandId);
}, (commandId) => {
	return false;
});
System.particleEditor = particleEditor;
System.document.title = "vanilla.js - Particle Editor";
particleEditor.run();
