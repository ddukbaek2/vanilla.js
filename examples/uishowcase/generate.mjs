//==============================================================================
// UI 쇼케이스 애셋 생성기. — "VANILLA CONSOLE" (서비스 관리 대시보드 앱)
// - UIEditor 가 저장하는 uiasset(json) 과 같은 형식으로 화면 다섯 벌을 만든다.
// - 목록 항목은 여기에 굽지 않는다. 각 목록에는 템플릿 한 줄만 두고,
//   실제 항목은 index.html 이 데이터로 UIListView 에 동적 생성한다.
// - 실행: node examples/uishowcase/generate.mjs
//==============================================================================
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
const OUTPUT_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), "assets");
const DOCUMENT_WIDTH = 1680;
const DOCUMENT_HEIGHT = 1000;
const RAIL_WIDTH = 200;
const CONTENT_X = 224;
const MAIN_WIDTH = 884;
const SIDE_X = 1124;
const SIDE_WIDTH = 340;

// 절제된 앱 팔레트. (단일 인디고 액센트 + 중립 톤, 상태색은 의미가 있을 때만)
const COLOR_BACKGROUND = "#0b0d12";
const COLOR_SURFACE = "#12151c";
const COLOR_CARD = "#171b24";
const COLOR_CARD_RAISED = "#1e2430";
const COLOR_HAIRLINE = "#262c38";
const COLOR_TEXT = "#e6e9ef";
const COLOR_TEXT_DIM = "#8a91a0";
const COLOR_TEXT_FAINT = "#545b69";
const COLOR_ACCENT = "#5b6cff";
const COLOR_POSITIVE = "#3fb27f";
const COLOR_NEGATIVE = "#d9564f";
const COLOR_INK = "#0b0d12";
const COLOR_TRANSPARENT = [1, 1, 1, 0];


//==============================================================================
// 전역 함수 목록.
//==============================================================================
//==============================================================================
// 색 문자열 -> [r, g, b, a]
//==============================================================================
function color(hexText, alpha = 1) {
	const red = parseInt(hexText.substring(1, 3), 16) / 255;
	const green = parseInt(hexText.substring(3, 5), 16) / 255;
	const blue = parseInt(hexText.substring(5, 7), 16) / 255;
	return [round3(red), round3(green), round3(blue), alpha];
}

function round3(value) {
	return Math.round(value * 1000) / 1000;
}

//==============================================================================
// 노드 하나.
//==============================================================================
function makeNode(name, x, y, width, height, options = {}) {
	const nodeData = {
		type: options.type ? options.type : "WorldNode",
		name: name,
		active: (options.active !== undefined) ? options.active : true,
		position: [x, y],
		scale: [1, 1],
		rotation: 0,
		opacity: (options.opacity !== undefined) ? options.opacity : 1,
		pivot: options.pivot ? options.pivot : [0, 0],
		anchor: [0, 0],
		contentSize: [width, height],
		interactable: options.interactable ? true : false,
		components: options.components ? options.components : [],
		children: options.children ? options.children : [],
	};
	if (options.contentChildren) {
		nodeData.contentChildren = options.contentChildren;
	}
	return nodeData;
}

//==============================================================================
// 컴포넌트들.
//==============================================================================
function paint(fillColor, roundSize = 0) {
	return { type: "Paint", color: fillColor, roundSize: roundSize };
}

function label(text, fontSize, textColor, textAlign = "center", textBaseline = "middle") {
	return { type: "UILabel", text: text, fontSize: fontSize, textColor: textColor, backgroundColor: COLOR_TRANSPARENT,
		textAlign: textAlign, textBaseline: textBaseline };
}

function button(pressedAlpha = 0.25) {
	return { type: "UIButton", pressedTintColor: [0, 0, 0, pressedAlpha] };
}

function toggle() {
	return { type: "UIToggleButton", pressedTintColor: [0, 0, 0, 0.2] };
}

function scrollView(contentWidth, contentHeight, isHorizontal, isVertical) {
	return {
		type: "UIScrollView",
		scrollContentSize: [contentWidth, contentHeight],
		scrollMode: "elastic",
		dragSensitivity: 1,
		horizontal: isHorizontal,
		vertical: isVertical,
		backgroundColor: COLOR_TRANSPARENT,
	};
}

function progress(value) {
	return { type: "UIProgressView", value: value, minValue: 0, maxValue: 1 };
}

function slider(value) {
	return { type: "UISlider", value: value, thumbRadius: 6, trackThickness: 4 };
}

//==============================================================================
// 자주 쓰는 조합.
//==============================================================================
function textNode(name, x, y, width, height, text, fontSize, textColor, textAlign = "left", textBaseline = "middle") {
	return makeNode(name, x, y, width, height, { components: [label(text, fontSize, textColor, textAlign, textBaseline)] });
}

function buttonNode(name, x, y, width, height, text, fillColor, roundSize, fontSize = 12, textColor = color(COLOR_TEXT)) {
	return makeNode(name, x, y, width, height, {
		interactable: true,
		components: [paint(fillColor, roundSize), button(), label(text, fontSize, textColor)],
	});
}

function hairline(name, x, y, width, height) {
	return makeNode(name, x, y, width, height, { components: [paint(color(COLOR_HAIRLINE))] });
}

function sectionLabel(name, x, y, text) {
	return textNode(name, x, y, 300, 16, text, 10, color(COLOR_TEXT_FAINT));
}

function panelNode(name, x, y, width, height, children) {
	return makeNode(name, x, y, width, height, {
		components: [paint(color(COLOR_SURFACE), 10)],
		children: children,
	});
}

//==============================================================================
// 화면 헤더. (제목 + 부제 + 우측 상태 칩)
//==============================================================================
function headerNodes(titleText, subtitleText) {
	return [
		textNode("Title", CONTENT_X, 22, 360, 26, titleText, 18, color(COLOR_TEXT)),
		textNode("Subtitle", CONTENT_X + 2, 50, 480, 14, subtitleText, 11, color(COLOR_TEXT_DIM)),
		makeNode("StatusChip", 1420, 26, 244, 26, {
			components: [paint(color(COLOR_CARD_RAISED), 13)],
			children: [textNode("StatusChipLabel", 0, 0, 244, 26, "●  All systems normal", 10.5, color(COLOR_POSITIVE), "center")],
		}),
	];
}

function writeDocument(fileName, rootNode) {
	const documentData = { version: 1, root: rootNode };
	writeFileSync(join(OUTPUT_DIRECTORY, fileName), JSON.stringify(documentData, null, "\t") + "\n", "utf8");
	console.log("wrote " + fileName);
}


//==============================================================================
// 대시보드 화면. (KPI + 실시간 차트 + 이벤트 목록 + 시스템 패널)
//==============================================================================
function buildDashboard() {
	const statNames = [
		{ key: "Revenue", title: "REVENUE (MTD)" },
		{ key: "Users", title: "ACTIVE USERS" },
		{ key: "Requests", title: "REQUESTS / MIN" },
		{ key: "Uptime", title: "UPTIME (90D)" },
	];
	const statCardNodes = statNames.map((definition, index) => {
		return makeNode("Stat" + definition.key, CONTENT_X + index * 228, 82, 212, 78, {
			components: [paint(color(COLOR_SURFACE), 10)],
			children: [
				textNode("Stat" + definition.key + "Title", 16, 12, 180, 14, definition.title, 9.5, color(COLOR_TEXT_FAINT)),
				textNode("Stat" + definition.key + "Value", 16, 30, 180, 24, "", 19, color(COLOR_TEXT)),
				textNode("Stat" + definition.key + "Delta", 16, 56, 180, 14, "", 10, color(COLOR_TEXT_DIM)),
			],
		});
	});

	// 이벤트 목록 템플릿. 실제 항목은 코드가 데이터로 채운다.
	const eventTemplate = makeNode("EventTemplate", 0, 0, MAIN_WIDTH - 32, 40, {
		components: [paint(color(COLOR_CARD), 8)],
		children: [
			textNode("EventTime", 14, 0, 64, 40, "", 10, color(COLOR_TEXT_FAINT)),
			textNode("EventText", 88, 0, 560, 40, "", 11.5, color(COLOR_TEXT)),
			textNode("EventTag", MAIN_WIDTH - 132, 0, 86, 40, "", 9.5, color(COLOR_TEXT_DIM), "right"),
		],
	});

	const systemRows = [
		{ name: "Cpu", title: "CPU", caption: "8 cores" },
		{ name: "Memory", title: "Memory", caption: "32 GB" },
		{ name: "Disk", title: "Disk", caption: "2 TB NVMe" },
	];
	const systemRowNodes = [];
	systemRows.forEach((row, index) => {
		const rowY = 34 + index * 46;
		systemRowNodes.push(textNode("System" + row.name + "Label", 16, rowY, 120, 14, row.title, 11, color(COLOR_TEXT)));
		systemRowNodes.push(textNode("System" + row.name + "Caption", 136, rowY, 188, 14, row.caption, 9.5, color(COLOR_TEXT_FAINT), "right"));
		systemRowNodes.push(makeNode("System" + row.name + "Bar", 16, rowY + 20, 308, 6, { components: [progress(0.3)] }));
	});

	const rootNode = makeNode("Dashboard", 0, 0, DOCUMENT_WIDTH, DOCUMENT_HEIGHT, {
		components: [paint(color(COLOR_BACKGROUND))],
		children: [
			...headerNodes("DASHBOARD", "Live metrics — charts update every second."),
			...statCardNodes,
			panelNode("ChartPanel", CONTENT_X, 176, MAIN_WIDTH, 300, [
				sectionLabel("ChartTitle", 16, 12, "REQUESTS PER SECOND"),
				textNode("ChartValue", MAIN_WIDTH - 156, 8, 140, 22, "", 15, color(COLOR_TEXT), "right"),
				makeNode("LiveChart", 16, 40, MAIN_WIDTH - 32, 244, {}),
			]),
			panelNode("BarPanel", SIDE_X, 176, SIDE_WIDTH, 300, [
				sectionLabel("BarTitle", 16, 12, "REVENUE · LAST 14 DAYS"),
				makeNode("RevenueBars", 16, 40, SIDE_WIDTH - 32, 220, {}),
				textNode("BarCaption", 16, 268, SIDE_WIDTH - 32, 14, "", 9.5, color(COLOR_TEXT_FAINT)),
			]),
			sectionLabel("EventsLabel", CONTENT_X, 496, "RECENT EVENTS"),
			makeNode("EventList", CONTENT_X, 518, MAIN_WIDTH, 458, {
				interactable: true,
				components: [scrollView(MAIN_WIDTH, 458, false, true)],
				contentChildren: [eventTemplate],
			}),
			panelNode("SystemPanel", SIDE_X, 518, SIDE_WIDTH, 458, [
				sectionLabel("SystemTitle", 16, 12, "SYSTEM"),
				...systemRowNodes,
				hairline("SystemHairline", 16, 182, SIDE_WIDTH - 32, 1),
				sectionLabel("IncidentTitle", 16, 196, "OPEN INCIDENTS"),
				textNode("IncidentValue", 16, 216, SIDE_WIDTH - 32, 20, "0", 16, color(COLOR_TEXT)),
				textNode("IncidentCaption", 16, 240, SIDE_WIDTH - 32, 14, "No incidents in the last 30 days.", 10, color(COLOR_TEXT_DIM)),
				hairline("NoticeHairline", 16, 268, SIDE_WIDTH - 32, 1),
				sectionLabel("NoticeTitle", 16, 282, "NOTES"),
				textNode("NoticeBody", 16, 304, SIDE_WIDTH - 32, 120,
					"Every panel on this screen is drawn by the\nvanilla.js engine - charts, lists and gauges\nare all engine components.", 10.5, color(COLOR_TEXT_DIM), "left", "top"),
			]),
		],
	});
	writeDocument("home.uiasset.json", rootNode);
}


//==============================================================================
// 스토어 화면. (추천 띠 + 카탈로그 목록 + 카트 + 최근 주문)
//==============================================================================
function buildStore() {

	// 추천 띠 템플릿.
	const featuredTemplate = makeNode("FeaturedTemplate", 0, 0, 196, 96, {
		components: [paint(color(COLOR_SURFACE), 10)],
		children: [
			textNode("FeaturedTitle", 14, 12, 168, 18, "", 12.5, color(COLOR_TEXT)),
			textNode("FeaturedCaption", 14, 34, 168, 14, "", 9.5, color(COLOR_TEXT_DIM)),
			textNode("FeaturedPrice", 14, 64, 100, 18, "", 12, color(COLOR_ACCENT)),
		],
	});

	// 카탈로그 목록 템플릿. (수백 건이 이 한 줄을 재활용한다)
	const itemTemplate = makeNode("ItemTemplate", 0, 0, MAIN_WIDTH - 32, 44, {
		components: [paint(color(COLOR_CARD), 8)],
		children: [
			makeNode("ItemIcon", 10, 8, 28, 28, {
				components: [paint(color(COLOR_CARD_RAISED), 7)],
				children: [textNode("ItemGlyph", 0, 0, 28, 28, "", 12, color(COLOR_TEXT_DIM), "center")],
			}),
			textNode("ItemTitle", 52, 4, 420, 20, "", 12, color(COLOR_TEXT)),
			textNode("ItemCaption", 52, 24, 480, 14, "", 9.5, color(COLOR_TEXT_FAINT)),
			textNode("ItemPrice", MAIN_WIDTH - 226, 0, 90, 44, "", 11.5, color(COLOR_TEXT_DIM), "right"),
			buttonNode("ItemAddButton", MAIN_WIDTH - 118, 9, 86, 26, "ADD", color(COLOR_CARD_RAISED), 7, 10.5),
		],
	});

	const cartRowNodes = [];
	for (let rowIndex = 0; rowIndex < 8; ++rowIndex) {
		cartRowNodes.push(textNode("CartRowName" + rowIndex, 16, 32 + rowIndex * 22, 220, 18, "", 10.5, color(COLOR_TEXT_DIM)));
		cartRowNodes.push(textNode("CartRowPrice" + rowIndex, 216, 32 + rowIndex * 22, 108, 18, "", 10.5, color(COLOR_TEXT_DIM), "right"));
	}
	const orderRowNodes = [];
	for (let rowIndex = 0; rowIndex < 8; ++rowIndex) {
		orderRowNodes.push(textNode("OrderRow" + rowIndex, 16, 32 + rowIndex * 22, SIDE_WIDTH - 32, 18, "", 10.5, color(COLOR_TEXT_DIM)));
	}

	const rootNode = makeNode("Store", 0, 0, DOCUMENT_WIDTH, DOCUMENT_HEIGHT, {
		components: [paint(color(COLOR_BACKGROUND))],
		children: [
			...headerNodes("STORE", "Add-ons for your workspace - one template, hundreds of rows."),
			sectionLabel("FeaturedLabel", CONTENT_X, 82, "FEATURED"),
			makeNode("FeaturedList", CONTENT_X, 102, 1192, 96, {
				interactable: true,
				components: [scrollView(1192, 96, true, false)],
				contentChildren: [featuredTemplate],
			}),
			sectionLabel("ItemsLabel", CONTENT_X, 222, "CATALOG"),
			textNode("ItemsCountCaption", CONTENT_X + 76, 220, 240, 18, "", 10, color(COLOR_TEXT_DIM)),
			makeNode("ItemList", CONTENT_X, 244, MAIN_WIDTH, 732, {
				interactable: true,
				components: [scrollView(MAIN_WIDTH, 732, false, true)],
				contentChildren: [itemTemplate],
			}),
			panelNode("CartPanel", SIDE_X, 244, SIDE_WIDTH, 348, [
				sectionLabel("CartTitle", 16, 12, "CART"),
				...cartRowNodes,
				hairline("CartHairline", 16, 240, SIDE_WIDTH - 32, 1),
				textNode("CartTotalLabel", 16, 252, 120, 18, "Total", 10.5, color(COLOR_TEXT_FAINT)),
				textNode("CartTotalValue", 176, 250, 148, 20, "$0.00", 13, color(COLOR_TEXT), "right"),
				buttonNode("CartClearButton", 16, 284, 148, 30, "CLEAR", color(COLOR_CARD_RAISED), 8, 10.5),
				buttonNode("CartCheckoutButton", 176, 284, 148, 30, "CHECKOUT", color(COLOR_ACCENT), 8, 10.5),
			]),
			panelNode("OrderPanel", SIDE_X, 608, SIDE_WIDTH, 368, [
				sectionLabel("OrderTitle", 16, 12, "RECENT ORDERS"),
				...orderRowNodes,
				textNode("OrderEmptyCaption", 16, 32, SIDE_WIDTH - 32, 18, "No orders yet.", 10.5, color(COLOR_TEXT_FAINT)),
			]),
		],
	});
	writeDocument("shop.uiasset.json", rootNode);
}


//==============================================================================
// 설정 화면. (슬라이더 / 토글 / 드롭다운 / 게이지 / 초기화 + 정보 패널)
//==============================================================================
function buildSettings() {
	const rowNodes = [];
	const rowDefinitions = [
		{ kind: "slider", name: "Scale", title: "Interface scale", caption: "100%", value: 0.5 },
		{ kind: "slider", name: "Sound", title: "Notification sound", caption: "60%", value: 0.6 },
		{ kind: "toggle", name: "Autosave", title: "Autosave", on: true },
		{ kind: "toggle", name: "Telemetry", title: "Usage telemetry", on: false },
		{ kind: "slot", name: "Theme", title: "Theme" },
		{ kind: "slot", name: "Region", title: "Region" },
		{ kind: "progress", name: "Storage", title: "Storage", caption: "3.2 GB / 8 GB", value: 0.4 },
	];
	rowDefinitions.forEach((definition, index) => {
		const rowY = 34 + index * 46;
		rowNodes.push(makeNode("Row" + definition.name, 16, rowY, 768, 40, {
			components: [paint(color(COLOR_CARD), 8)],
			children: [
				textNode(definition.name + "Label", 16, 0, 220, 40, definition.title, 11.5, color(COLOR_TEXT)),
			],
		}));
		const rowNode = rowNodes[rowNodes.length - 1];
		if (definition.kind === "slider") {
			rowNode.children.push(textNode(definition.name + "Caption", 240, 0, 60, 40, definition.caption, 10, color(COLOR_TEXT_DIM)));
			rowNode.children.push(makeNode(definition.name + "Slider", 480, 9, 264, 22, {
				interactable: true,
				components: [slider(definition.value)],
			}));
		}
		else if (definition.kind === "toggle") {
			rowNode.children.push(makeNode(definition.name + "Toggle", 696, 9, 52, 22, {
				interactable: true,
				components: [paint(color(definition.on ? COLOR_ACCENT : "#2c3442"), 11), toggle(), label(definition.on ? "ON" : "OFF", 8.5, color(COLOR_INK))],
			}));
		}
		else if (definition.kind === "slot") {
			rowNode.children.push(makeNode(definition.name + "DropdownSlot", 568, 6, 176, 28, {}));
		}
		else {
			rowNode.children.push(textNode(definition.name + "Caption", 240, 0, 140, 40, definition.caption, 10, color(COLOR_TEXT_DIM)));
			rowNode.children.push(makeNode(definition.name + "Bar", 480, 16, 264, 8, { components: [progress(definition.value)] }));
		}
	});

	const aboutRows = [
		{ name: "Version", value: "0.4.0-experimental" },
		{ name: "Renderer", value: "WebGL2" },
		{ name: "UI", value: "uiasset + UIListView" },
		{ name: "Audio", value: "BeepPlayer (synthesized)" },
	];
	const aboutRowNodes = [];
	aboutRows.forEach((row, index) => {
		const rowY = 34 + index * 26;
		aboutRowNodes.push(textNode("About" + row.name + "Label", 16, rowY, 100, 16, row.name, 10, color(COLOR_TEXT_FAINT)));
		aboutRowNodes.push(textNode("About" + row.name + "Value", 116, rowY - 1, 208, 18, row.value, 11, color(COLOR_TEXT)));
	});

	const rootNode = makeNode("Settings", 0, 0, DOCUMENT_WIDTH, DOCUMENT_HEIGHT, {
		components: [paint(color(COLOR_BACKGROUND))],
		children: [
			...headerNodes("SETTINGS", "Changes apply immediately."),
			panelNode("SettingsPanel", CONTENT_X, 82, 800, 420, [
				sectionLabel("PanelTitle", 16, 12, "PREFERENCES"),
				...rowNodes,
				buttonNode("ResetButton", 16, 366, 768, 32, "RESET TO DEFAULTS", color(COLOR_CARD_RAISED), 8, 11),
			]),
			panelNode("AboutPanel", SIDE_X, 82, SIDE_WIDTH, 160, [
				sectionLabel("AboutTitle", 16, 12, "ABOUT"),
				...aboutRowNodes,
			]),
		],
	});
	writeDocument("settings.uiasset.json", rootNode);
}


//==============================================================================
// 컴포넌트 화면. (버튼 상태 / 컨텍스트 메뉴 / 드래그 / 진행 표시 / 타자기 / 피드백)
//==============================================================================
function buildComponents() {
	const rootNode = makeNode("Components", 0, 0, DOCUMENT_WIDTH, DOCUMENT_HEIGHT, {
		components: [paint(color(COLOR_BACKGROUND))],
		children: [
			...headerNodes("COMPONENTS", "Every widget below is rendered by the engine."),
			panelNode("ButtonsPanel", CONTENT_X, 82, 430, 262, [
				sectionLabel("ButtonsTitle", 16, 12, "BUTTONS"),
				buttonNode("NormalButton", 16, 40, 190, 32, "DEFAULT", color(COLOR_ACCENT), 8, 11),
				textNode("NormalCaption", 222, 40, 190, 32, "hover / press tint", 9.5, color(COLOR_TEXT_FAINT)),
				buttonNode("DisabledButton", 16, 84, 190, 32, "DISABLED", color(COLOR_CARD_RAISED), 8, 11),
				textNode("DisabledCaption", 222, 84, 190, 32, "setInteractable(false)", 9.5, color(COLOR_TEXT_FAINT)),
				buttonNode("LongPressButton", 16, 128, 190, 32, "HOLD 1s", color(COLOR_CARD_RAISED), 8, 11),
				textNode("LongPressCaption", 222, 128, 190, 32, "long press event", 9.5, color(COLOR_TEXT_FAINT)),
				makeNode("LongPressBar", 16, 168, 190, 5, { components: [progress(0)] }),
				textNode("ButtonsResult", 16, 196, 398, 40, "", 10.5, color(COLOR_TEXT_DIM)),
			]),
			panelNode("MenuPanel", 674, 82, 430, 262, [
				sectionLabel("MenuTitle", 16, 12, "CONTEXT MENU"),
				makeNode("RightClickZone", 16, 40, 398, 150, {
					interactable: true,
					components: [paint(color(COLOR_CARD), 8)],
					children: [
						textNode("RightClickHint", 0, 0, 398, 150, "Right click here\n(or long press)", 11, color(COLOR_TEXT_FAINT), "center"),
					],
				}),
				textNode("MenuResult", 16, 204, 398, 32, "", 10.5, color(COLOR_TEXT_DIM)),
			]),
			panelNode("DragPanel", SIDE_X, 82, SIDE_WIDTH, 262, [
				sectionLabel("DragTitle", 16, 12, "DRAG & DROP"),
				makeNode("DragSlotA", 16, 150, 92, 66, { components: [paint(color(COLOR_CARD), 8)] }),
				makeNode("DragSlotB", 124, 150, 92, 66, { components: [paint(color(COLOR_CARD), 8)] }),
				makeNode("DragSlotC", 232, 150, 92, 66, { components: [paint(color(COLOR_CARD), 8)] }),
				textNode("DragResult", 16, 228, SIDE_WIDTH - 32, 20, "Drag chips into slots.", 10, color(COLOR_TEXT_FAINT)),
			]),
			panelNode("ProgressPanel", CONTENT_X, 360, 430, 220, [
				sectionLabel("ProgressTitle", 16, 12, "PROGRESS"),
				textNode("SpinnerCaption", 16, 40, 120, 60, "UISpinner", 10, color(COLOR_TEXT_FAINT)),
				textNode("ProgressCaption", 16, 124, 120, 20, "UIProgressView", 10, color(COLOR_TEXT_FAINT)),
				makeNode("LoopProgressBar", 16, 152, 398, 7, { components: [progress(0)] }),
				textNode("LoopProgressValue", 16, 172, 398, 18, "", 10, color(COLOR_TEXT_DIM)),
			]),
			panelNode("TypePanel", 674, 360, 430, 220, [
				sectionLabel("TypeTitle", 16, 12, "TYPEWRITER"),
				textNode("TypeBody", 16, 40, 398, 110, "", 11.5, color(COLOR_TEXT), "left", "top"),
				buttonNode("TypeReplayButton", 16, 168, 120, 30, "REPLAY", color(COLOR_CARD_RAISED), 8, 10.5),
			]),
			panelNode("FeedbackPanel", SIDE_X, 360, SIDE_WIDTH, 220, [
				sectionLabel("FeedbackTitle", 16, 12, "FEEDBACK"),
				buttonNode("ToastButton", 16, 40, SIDE_WIDTH - 32, 32, "SHOW TOAST", color(COLOR_CARD_RAISED), 8, 11),
				buttonNode("DialogButton", 16, 84, SIDE_WIDTH - 32, 32, "SHOW DIALOG", color(COLOR_CARD_RAISED), 8, 11),
				buttonNode("QueueToastButton", 16, 128, SIDE_WIDTH - 32, 32, "QUEUE 3 TOASTS", color(COLOR_CARD_RAISED), 8, 11),
				textNode("FeedbackCaption", 16, 172, SIDE_WIDTH - 32, 32, "Toast queueing / popup motion are\nengine widgets.", 9.5, color(COLOR_TEXT_FAINT), "left", "top"),
			]),
			panelNode("ChartsPanel", CONTENT_X, 596, 1240, 380, [
				sectionLabel("ChartsTitle", 16, 12, "CHARTS"),
				textNode("MiniLineCaption", 16, 36, 200, 16, "UILineChart", 10, color(COLOR_TEXT_FAINT)),
				makeNode("MiniLineChart", 16, 58, 592, 290, {}),
				textNode("MiniBarCaption", 632, 36, 200, 16, "UIBarChart", 10, color(COLOR_TEXT_FAINT)),
				makeNode("MiniBarChart", 632, 58, 592, 290, {}),
			]),
		],
	});
	writeDocument("components.uiasset.json", rootNode);
}


//==============================================================================
// 왼쪽 레일. (모든 화면 위에 항상 보인다)
//==============================================================================
function buildNavigation() {
	const navigationDefinitions = ["DASHBOARD", "STORE", "SETTINGS", "COMPONENTS"];
	const navigationNodes = navigationDefinitions.map((title, index) => {
		return makeNode("Nav" + title, 14, 108 + index * 42, RAIL_WIDTH - 28, 36, {
			interactable: true,
			components: [paint(COLOR_TRANSPARENT, 9), button(0.15)],
			children: [
				makeNode("NavActive" + title, 0, 0, RAIL_WIDTH - 28, 36, { active: index === 0, components: [paint(color(COLOR_ACCENT), 9)] }),
				textNode("NavLabel" + title, 0, 0, RAIL_WIDTH - 28, 36, title, 10.5, color(COLOR_TEXT), "center"),
			],
		});
	});
	const rootNode = makeNode("Navigation", 0, 0, RAIL_WIDTH, DOCUMENT_HEIGHT, {
		components: [paint(color(COLOR_SURFACE))],
		children: [
			hairline("RailHairline", RAIL_WIDTH - 1, 0, 1, DOCUMENT_HEIGHT),
			textNode("Brand", 22, 26, 156, 22, "VANILLA", 16, color(COLOR_TEXT)),
			textNode("BrandCaption", 23, 50, 156, 14, "CONSOLE", 9, color(COLOR_TEXT_FAINT)),
			hairline("BrandHairline", 14, 86, RAIL_WIDTH - 28, 1),
			...navigationNodes,
			textNode("RailVersion", 22, DOCUMENT_HEIGHT - 36, 156, 14, "vanilla.js  ·  0.4.0", 9, color(COLOR_TEXT_FAINT)),
		],
	});
	writeDocument("navigation.uiasset.json", rootNode);
}


//==============================================================================
// 팝업. (어둡게 가리는 막 + 가운데 대화 상자)
//==============================================================================
function buildPopup() {
	const rootNode = makeNode("Popup", 0, 0, DOCUMENT_WIDTH, DOCUMENT_HEIGHT, {
		children: [
			makeNode("Overlay", 0, 0, DOCUMENT_WIDTH, DOCUMENT_HEIGHT, {
				interactable: true,
				components: [paint(color("#04060a", 0.62)), button(0)],
			}),
			makeNode("Dialog", DOCUMENT_WIDTH * 0.5, DOCUMENT_HEIGHT * 0.5 - 10, 380, 196, {
				pivot: [0.5, 0.5],
				components: [paint(color(COLOR_CARD), 12)],
				children: [
					textNode("DialogTitle", 22, 20, 336, 22, "", 15, color(COLOR_TEXT)),
					textNode("DialogMessage", 22, 52, 336, 54, "", 11.5, color(COLOR_TEXT_DIM), "left", "top"),
					buttonNode("CancelButton", 22, 134, 162, 40, "CANCEL", color(COLOR_CARD_RAISED), 9, 11.5),
					buttonNode("ConfirmButton", 196, 134, 162, 40, "CONFIRM", color(COLOR_ACCENT), 9, 11.5),
				],
			}),
		],
	});
	writeDocument("popup.uiasset.json", rootNode);
}


//==============================================================================
// 실행.
//==============================================================================
buildDashboard();
buildStore();
buildSettings();
buildComponents();
buildNavigation();
buildPopup();
