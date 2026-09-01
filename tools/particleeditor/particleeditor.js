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
	createEditorSectionElement, createEditorListRowElement, setEditorListRowSelected,
	createEditorHeaderButtonElement, createEditorGroupElement, createEditorPropertyRowElement,
	appendEditorNumberRow, appendEditorColorRow, appendEditorBooleanRow, appendEditorSelectRow,
	decorateEditorInputElement, createEditorButtonElement, buildEditorWindowLayout,
} from "../common/editorkit.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 목록에 쓰는 그림 아이콘. (14x14 기준, 색은 글자색을 따른다)
const PRESET_ICON_MARKUP = "<circle cx='7' cy='7' r='2.2' fill='currentColor'/>"
	+ "<circle cx='3' cy='3.6' r='1.2' fill='currentColor' opacity='0.7'/>"
	+ "<circle cx='11.2' cy='4.4' r='1' fill='currentColor' opacity='0.55'/>"
	+ "<circle cx='10.4' cy='10.8' r='1.3' fill='currentColor' opacity='0.7'/>"
	+ "<circle cx='3.4' cy='10.4' r='0.9' fill='currentColor' opacity='0.5'/>";

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
			{ id: "newDescription", label: "New", shortcut: "Ctrl+Alt+N" },
			{ id: "load", label: "Open...", shortcut: "Ctrl+O" },
			{ id: "save", label: "Save", shortcut: "Ctrl+S" },
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

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor(createdEvent, tickEvent) {
		super();
		this.#createdEvent = createdEvent;
		this.#tickEvent = tickEvent;
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
// - description 을 진실의 원천으로 삼고 값이 바뀌면 즉시 ParticleSystem 에 반영한다.
//==============================================================================
class ParticleEditor {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object } */ #description;
	/** @private @type { ParticleSystem | null } */ #particleSystem;
	/** @private @type { Engine | null } */ #engine;
	/** @private @type { string } */ #presetName;
	/** @private @type { Map } */ #presetRowMap;
	/** @private @type { HTMLElement | null } */ #inspectorBodyElement;
	/** @private @type { HTMLElement | null } */ #gradientContainerElement;
	/** @private @type { HTMLElement | null } */ #statusTextElement;
	/** @private @type { HTMLInputElement | null } */ #fileInputElement;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		this.#description = System.JSON.parse(System.JSON.stringify(DEFAULT_DESCRIPTION));
		this.#particleSystem = null;
		this.#engine = null;
		this.#presetName = "Fire";
		this.#presetRowMap = new System.Map();
		this.#inspectorBodyElement = null;
		this.#gradientContainerElement = null;
		this.#statusTextElement = null;
		this.#fileInputElement = null;
	}

	//==============================================================================
	// 실행.
	//==============================================================================
	run() {
		this.buildLayout();
		this.selectPresetRow("Fire");
		this.buildInspector();
		this.startEngine();
	}

	//==============================================================================
	// 창 구성.
	//==============================================================================
	buildLayout() {
		// --- 가운데 영역 ---
		const mainPane = new Pane({ direction: "horizontal", size: "flex" });

		// 좌측: 프리셋 목록.
		const presetPane = new Pane({ size: 240, minSize: 170 });
		const presetElement = createEditorSectionElement("PRESETS", null);
		const presetListElement = PaneStyle.create("div", "", { style: { flex: "1", overflowY: "auto", position: "relative" } });
		const presetIconMarkup = wrapEditorIconMarkup(PRESET_ICON_MARKUP);
		for (const presetName of System.Object.keys(PRESET_TABLE)) {
			const rowElement = createEditorListRowElement(presetIconMarkup, presetName);
			rowElement.addEventListener("click", () => {
				this.applyPreset(presetName);
			});
			this.#presetRowMap.set(presetName, rowElement);
			presetListElement.appendChild(rowElement);
		}
		presetElement.appendChild(presetListElement);
		presetPane.getContainer().appendChild(presetElement);

		// 중앙: 프리뷰.
		const previewPane = new Pane({ size: "flex", minSize: 200 });
		const previewElement = createEditorSectionElement("PREVIEW", null);
		const previewTitleElement = previewElement.firstChild;
		previewTitleElement.style.display = "flex";
		previewTitleElement.style.alignItems = "center";
		previewTitleElement.style.paddingRight = "6px";
		const previewSpacerElement = PaneStyle.create("div", "", {
			style: { position: "relative", width: "auto", height: "auto", flex: "1" },
		});
		const restartButtonElement = createEditorHeaderButtonElement("RESTART");
		restartButtonElement.addEventListener("click", () => {
			this.restartParticleSystem();
		});
		const burstButtonElement = createEditorHeaderButtonElement("BURST x60");
		burstButtonElement.addEventListener("click", () => {
			this.emitBurst();
		});
		previewTitleElement.appendChild(previewSpacerElement);
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

		mainPane.addPane(presetPane);
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
			const baseDescription = System.JSON.parse(System.JSON.stringify(DEFAULT_DESCRIPTION));
			this.#description = System.Object.assign(baseDescription, System.JSON.parse(jsonText));
			this.selectPresetRow(null);
			this.applyToSystem();
			this.buildInspector();
		});
		System.document.body.appendChild(this.#fileInputElement);

		// 단축키.
		System.window.addEventListener("keydown", (keyboardEvent) => {
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
			if (keyboardEvent.key === " " && keyboardEvent.target === System.document.body) {
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
			case "newDescription": {
				this.applyPreset("Fire");
				break;
			}
			case "save": {
				const jsonText = System.JSON.stringify(this.#description, null, "\t");
				const blob = new System.Blob([jsonText], { type: "application/json" });
				const anchorElement = System.document.createElement("a");
				anchorElement.href = System.URL.createObjectURL(blob);
				anchorElement.download = "effect.vfx.json";
				anchorElement.click();
				System.URL.revokeObjectURL(anchorElement.href);
				break;
			}
			case "load": {
				this.#fileInputElement.click();
				break;
			}
			case "restart": {
				this.restartParticleSystem();
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
	// 프리셋 적용.
	//==============================================================================
	/**
	 * @param { string } presetName
	 */
	applyPreset(presetName) {
		this.#description = System.JSON.parse(System.JSON.stringify(DEFAULT_DESCRIPTION));
		const presetOverride = PRESET_TABLE[presetName];
		if (presetOverride) {
			const clonedOverride = System.JSON.parse(System.JSON.stringify(presetOverride));
			System.Object.assign(this.#description, clonedOverride);
		}
		this.selectPresetRow(presetName);
		this.applyToSystem();
		this.buildInspector();
	}

	//==============================================================================
	// 프리셋 목록 선택 표시.
	//==============================================================================
	/**
	 * @param { string | null } presetName
	 */
	selectPresetRow(presetName) {
		this.#presetName = presetName;
		for (const [rowPresetName, rowElement] of this.#presetRowMap) {
			setEditorListRowSelected(rowElement, rowPresetName === presetName);
		}
		this.refreshStatus();
	}

	//==============================================================================
	// 서술을 파티클 시스템에 반영.
	//==============================================================================
	applyToSystem() {
		if (this.#particleSystem) {
			this.#particleSystem.applyDescription(this.#description);
		}
	}

	//==============================================================================
	// 파티클 시스템 재시작.
	//==============================================================================
	restartParticleSystem() {
		if (this.#particleSystem) {
			this.#particleSystem.stop(true);
			this.#particleSystem.applyDescription(this.#description);
			this.#particleSystem.play();
		}
	}

	//==============================================================================
	// 버스트 방출.
	//==============================================================================
	emitBurst() {
		if (this.#particleSystem) {
			this.#particleSystem.emit(60);
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
		if (this.#particleSystem) {
			particleCount = this.#particleSystem.getParticleCount();
		}
		const presetText = this.#presetName ? this.#presetName : "Custom";
		this.#statusTextElement.innerText = presetText + "  |  particles " + particleCount
			+ "  |  runtime: particleSystem.applyDescription(JSON.parse(text))";
	}

	//==============================================================================
	// 그라디언트 키 목록 재구성.
	//==============================================================================
	rebuildGradientRows() {
		this.#gradientContainerElement.textContent = "";
		this.#description.colorOverLifetime.forEach((gradientKey, keyIndex) => {
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
				this.#description.colorOverLifetime.sort((left, right) => left.time - right.time);
				this.applyToSystem();
			};
			timeInputElement.addEventListener("change", () => {
				commitKey();
				this.rebuildGradientRows();
			});
			colorInputElement.addEventListener("input", commitKey);
			alphaInputElement.addEventListener("change", commitKey);
			removeButtonElement.addEventListener("click", () => {
				this.#description.colorOverLifetime.splice(keyIndex, 1);
				this.applyToSystem();
				this.rebuildGradientRows();
			});
			rowElement.appendChild(timeInputElement);
			rowElement.appendChild(colorInputElement);
			rowElement.appendChild(alphaInputElement);
			rowElement.appendChild(removeButtonElement);
			this.#gradientContainerElement.appendChild(rowElement);
		});
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
	// 인스펙터 전체 구성.
	//==============================================================================
	buildInspector() {
		this.#inspectorBodyElement.textContent = "";
		const description = this.#description;
		const applyChange = () => {
			this.applyToSystem();
		};

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
		this.#gradientContainerElement = PaneStyle.create("div", "", {
			style: { position: "relative", width: "auto", height: "auto" },
		});
		gradientBodyElement.appendChild(this.#gradientContainerElement);
		const addKeyRowElement = PaneStyle.create("div", "", {
			style: { position: "relative", width: "auto", height: "auto", padding: "8px 12px" },
		});
		const addKeyButtonElement = createEditorButtonElement("Add Key", false);
		addKeyButtonElement.style.display = "inline-block";
		addKeyButtonElement.addEventListener("click", () => {
			description.colorOverLifetime.push({ time: 1, color: [1, 1, 1, 0] });
			applyChange();
			this.rebuildGradientRows();
		});
		addKeyRowElement.appendChild(addKeyButtonElement);
		gradientBodyElement.appendChild(addKeyRowElement);
		this.rebuildGradientRows();

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
			this.buildInspector();
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
		appendEditorSelectRow(renderBodyElement, "Shape", ["circle", "rect", "streak"], description.renderShape, (value) => {
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
			const emitterNode = new WorldNode();
			emitterNode.setName("Emitter");
			emitterNode.setPivot(Pivot.topLeft.clone());
			emitterNode.setAnchor(Pivot.topLeft.clone());
			emitterNode.setLocalPosition(Vector2.create(480, 300));
			rootNode.addChild(emitterNode);
			this.#particleSystem = emitterNode.addComponent(ParticleSystem);
			this.#particleSystem.applyDescription(this.#description);
		}, () => {
			this.refreshStatus();
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
