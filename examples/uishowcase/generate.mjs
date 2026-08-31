//==============================================================================
// UI 쇼케이스 애셋 생성기.
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
const DOCUMENT_WIDTH = 1440;
const DOCUMENT_HEIGHT = 900;
const RAIL_WIDTH = 216;
const CONTENT_X = 240;

const COLOR_BACKGROUND = "#0b0e17";
const COLOR_SURFACE = "#10141f";
const COLOR_CARD = "#161b29";
const COLOR_CARD_RAISED = "#1d2436";
const COLOR_HAIRLINE = "#232b3d";
const COLOR_TEXT = "#e8ecf4";
const COLOR_TEXT_DIM = "#7c8598";
const COLOR_TEXT_FAINT = "#4a5468";
const COLOR_INDIGO = "#6c7bff";
const COLOR_CYAN = "#38d6ff";
const COLOR_AMBER = "#f0b35c";
const COLOR_MINT = "#43dd8f";
const COLOR_RED = "#ef5350";
const COLOR_INK = "#0b0e17";
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

function button(pressedAlpha = 0.3) {
	return { type: "UIButton", pressedTintColor: [0, 0, 0, pressedAlpha] };
}

function toggle() {
	return { type: "UIToggleButton", pressedTintColor: [0, 0, 0, 0.25] };
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
	return { type: "UISlider", value: value, thumbRadius: 7, trackThickness: 4 };
}

//==============================================================================
// 자주 쓰는 조합.
//==============================================================================
function textNode(name, x, y, width, height, text, fontSize, textColor, textAlign = "left", textBaseline = "middle") {
	return makeNode(name, x, y, width, height, { components: [label(text, fontSize, textColor, textAlign, textBaseline)] });
}

function buttonNode(name, x, y, width, height, text, fillColor, roundSize, fontSize = 13, textColor = color(COLOR_TEXT)) {
	return makeNode(name, x, y, width, height, {
		interactable: true,
		components: [paint(fillColor, roundSize), button(), label(text, fontSize, textColor)],
	});
}

function chipNode(name, x, y, width, text, textColor) {
	return makeNode(name, x, y, width, 28, {
		components: [paint(color(COLOR_CARD_RAISED), 14)],
		children: [textNode(name + "Label", 0, 0, width, 28, text, 12, textColor, "center")],
	});
}

function hairline(name, x, y, width, height) {
	return makeNode(name, x, y, width, height, { components: [paint(color(COLOR_HAIRLINE))] });
}

function sectionLabel(name, x, y, text) {
	return textNode(name, x, y, 300, 18, text, 11, color(COLOR_TEXT_FAINT));
}

//==============================================================================
// 화면 헤더. (제목 + 부제 + 우측 재화 칩)
//==============================================================================
function headerNodes(titleText, subtitleText) {
	return [
		textNode("Title", CONTENT_X, 26, 320, 30, titleText, 21, color(COLOR_TEXT)),
		textNode("Subtitle", CONTENT_X + 4, 58, 400, 16, subtitleText, 12, color(COLOR_TEXT_DIM)),
		chipNode("CoinChip", 1186, 28, 110, "◆ 12,480", color(COLOR_AMBER)),
		chipNode("GemChip", 1306, 28, 104, "● 1,250", color(COLOR_CYAN)),
	];
}

function writeDocument(fileName, rootNode) {
	const documentData = { version: 1, root: rootNode };
	writeFileSync(join(OUTPUT_DIRECTORY, fileName), JSON.stringify(documentData, null, "\t") + "\n", "utf8");
	console.log("wrote " + fileName);
}


//==============================================================================
// 홈 화면. (카드 목록 템플릿 + 오른쪽 일일 / 시즌 패널)
//==============================================================================
function buildHome() {

	// 카드 목록 템플릿. 실제 항목은 코드가 데이터로 채운다.
	const cardTemplate = makeNode("CardTemplate", 0, 0, 792, 84, {
		components: [paint(color(COLOR_CARD), 10)],
		children: [
			makeNode("CardStripe", 0, 0, 3, 84, { components: [paint(color(COLOR_INDIGO), 1.5)] }),
			makeNode("CardIcon", 16, 14, 56, 56, {
				components: [paint(color(COLOR_INDIGO), 12)],
				children: [textNode("CardGlyph", 0, 0, 56, 56, "S", 24, color(COLOR_INK), "center")],
			}),
			textNode("CardTitle", 88, 16, 360, 22, "Title", 15, color(COLOR_TEXT)),
			textNode("CardSubtitle", 88, 44, 420, 18, "Subtitle", 12, color(COLOR_TEXT_DIM)),
			textNode("CardMeta", 560, 16, 120, 18, "", 11, color(COLOR_TEXT_FAINT), "right"),
			buttonNode("CardOpenButton", 692, 26, 84, 32, "OPEN", color(COLOR_CARD_RAISED), 8, 12),
		],
	});

	const dailyRows = [
		{ name: "Energy", value: 0.72, caption: "72 / 100" },
		{ name: "Quest", value: 0.4, caption: "2 / 5" },
		{ name: "SeasonPass", label: "Season Pass", value: 0.88, caption: "Lv. 44" },
	];
	const dailyRowNodes = [];
	dailyRows.forEach((row, index) => {
		const rowY = 44 + index * 58;
		const rowLabel = row.label ? row.label : row.name;
		dailyRowNodes.push(textNode("Daily" + row.name + "Label", 18, rowY, 140, 16, rowLabel, 12, color(COLOR_TEXT)));
		dailyRowNodes.push(textNode("Daily" + row.name + "Caption", 158, rowY, 190, 16, row.caption, 11, color(COLOR_TEXT_DIM), "right"));
		dailyRowNodes.push(makeNode("Daily" + row.name + "Bar", 18, rowY + 24, 330, 8, {
			components: [progress(row.value)],
		}));
	});

	const rootNode = makeNode("Home", 0, 0, DOCUMENT_WIDTH, DOCUMENT_HEIGHT, {
		components: [paint(color(COLOR_BACKGROUND))],
		children: [
			...headerNodes("HOME", "Everything below the fold is data-driven."),
			sectionLabel("CardListLabel", CONTENT_X, 92, "GAME MODES"),
			makeNode("CardList", CONTENT_X, 114, 792, 762, {
				interactable: true,
				components: [scrollView(792, 762, false, true)],
				contentChildren: [cardTemplate],
			}),
			makeNode("DailyPanel", 1050, 114, 366, 268, {
				components: [paint(color(COLOR_SURFACE), 12)],
				children: [
					sectionLabel("DailyTitle", 18, 14, "DAILY"),
					...dailyRowNodes,
					buttonNode("ClaimButton", 18, 218, 330, 34, "CLAIM REWARD", color(COLOR_INDIGO), 8, 12),
				],
			}),
			makeNode("SeasonPanel", 1050, 394, 366, 232, {
				components: [paint(color(COLOR_SURFACE), 12)],
				children: [
					sectionLabel("SeasonTitle", 18, 14, "ARENA SEASON"),
					textNode("ArenaRating", 18, 40, 160, 30, "2,148", 24, color(COLOR_TEXT)),
					textNode("ArenaRatingCaption", 18, 74, 200, 16, "Rating  ·  Diamond II", 11, color(COLOR_TEXT_DIM)),
					textNode("ArenaWinLabel", 18, 108, 160, 16, "Win rate vs season", 11, color(COLOR_TEXT_FAINT)),
					makeNode("ArenaVersusBar", 18, 130, 330, 10, { components: [progress(0.63)] }),
					textNode("ArenaWinCaption", 18, 148, 120, 16, "W 63%", 11, color(COLOR_MINT)),
					textNode("ArenaLossCaption", 268, 148, 80, 16, "L 37%", 11, color(COLOR_RED), "right"),
					hairline("SeasonHairline", 18, 178, 330, 1),
					textNode("SeasonEndsLabel", 18, 190, 200, 16, "Season ends in", 11, color(COLOR_TEXT_FAINT)),
					textNode("SeasonEndsValue", 218, 188, 130, 18, "12d 06:41", 12, color(COLOR_TEXT), "right"),
				],
			}),
			makeNode("TipPanel", 1050, 638, 366, 238, {
				components: [paint(color(COLOR_SURFACE), 12)],
				children: [
					sectionLabel("TipTitle", 18, 14, "DIALOGUE"),
					textNode("TipBody", 18, 38, 330, 150, "", 12, color(COLOR_TEXT_DIM), "left", "top"),
					buttonNode("TipNextButton", 18, 190, 330, 32, "NEXT", color(COLOR_CARD_RAISED), 8, 12),
				],
			}),
		],
	});
	writeDocument("home.uiasset.json", rootNode);
}


//==============================================================================
// 상점 화면. (가로 추천 띠 템플릿 + 세로 상품 목록 템플릿 + 구매 기록 패널)
//==============================================================================
function buildShop() {

	// 추천 띠 템플릿.
	const featuredTemplate = makeNode("FeaturedTemplate", 0, 0, 208, 118, {
		components: [paint(color(COLOR_CARD_RAISED), 12)],
		children: [
			makeNode("FeaturedStripe", 0, 0, 208, 3, { components: [paint(color(COLOR_INDIGO), 1.5)] }),
			textNode("FeaturedTitle", 14, 14, 180, 20, "Pack", 14, color(COLOR_TEXT)),
			textNode("FeaturedCaption", 14, 38, 180, 16, "Limited", 11, color(COLOR_TEXT_DIM)),
			buttonNode("FeaturedBuy", 14, 74, 96, 30, "◆ 240", color(COLOR_INDIGO), 8, 12),
		],
	});

	// 상품 목록 템플릿. (수백 건이 이 한 줄을 재활용한다)
	const itemTemplate = makeNode("ItemTemplate", 0, 0, 792, 56, {
		components: [paint(color(COLOR_CARD), 8)],
		children: [
			makeNode("ItemIcon", 12, 10, 36, 36, { components: [paint(color(COLOR_INDIGO), 9)] }),
			textNode("ItemTitle", 62, 8, 380, 20, "Item", 13, color(COLOR_TEXT)),
			textNode("ItemCaption", 62, 30, 420, 16, "Caption", 11, color(COLOR_TEXT_DIM)),
			buttonNode("ItemBuyButton", 676, 13, 104, 30, "◆ 120", color(COLOR_CARD_RAISED), 8, 12),
		],
	});

	const purchaseRowNodes = [];
	for (let rowIndex = 0; rowIndex < 9; ++rowIndex) {
		purchaseRowNodes.push(textNode("PurchaseRow" + rowIndex, 18, 40 + rowIndex * 24, 330, 18, "", 11, color(COLOR_TEXT_DIM)));
	}

	const rootNode = makeNode("Shop", 0, 0, DOCUMENT_WIDTH, DOCUMENT_HEIGHT, {
		components: [paint(color(COLOR_BACKGROUND))],
		children: [
			...headerNodes("SHOP", "500 items, one template, recycled nodes."),
			sectionLabel("FeaturedLabel", CONTENT_X, 92, "FEATURED"),
			makeNode("FeaturedList", CONTENT_X, 114, 1176, 118, {
				interactable: true,
				components: [scrollView(1176, 118, true, false)],
				contentChildren: [featuredTemplate],
			}),
			sectionLabel("ItemsLabel", CONTENT_X, 254, "ALL ITEMS"),
			textNode("ItemsCountCaption", CONTENT_X + 90, 252, 240, 18, "", 11, color(COLOR_TEXT_DIM)),
			makeNode("ItemList", CONTENT_X, 276, 792, 600, {
				interactable: true,
				components: [scrollView(792, 600, false, true)],
				contentChildren: [itemTemplate],
			}),
			makeNode("PurchasePanel", 1050, 276, 366, 320, {
				components: [paint(color(COLOR_SURFACE), 12)],
				children: [
					sectionLabel("PurchaseTitle", 18, 14, "RECENT PURCHASES"),
					...purchaseRowNodes,
					hairline("PurchaseHairline", 18, 262, 330, 1),
					textNode("PurchaseTotalLabel", 18, 276, 160, 18, "Total spent", 11, color(COLOR_TEXT_FAINT)),
					textNode("PurchaseTotalValue", 178, 274, 170, 20, "◆ 0", 13, color(COLOR_AMBER), "right"),
				],
			}),
			makeNode("HintPanel", 1050, 608, 366, 268, {
				components: [paint(color(COLOR_SURFACE), 12)],
				children: [
					sectionLabel("HintTitle", 18, 14, "HOW IT WORKS"),
					textNode("HintBody", 18, 38, 330, 210,
						"The item list holds one template node.\nRows are created only for the visible range\nand recycled while scrolling.\nReaching the end loads the next page.", 12, color(COLOR_TEXT_DIM), "left", "top"),
				],
			}),
		],
	});
	writeDocument("shop.uiasset.json", rootNode);
}


//==============================================================================
// 설정 화면. (슬라이더 / 토글 / 진행바 / 초기화 + 정보 패널)
//==============================================================================
function buildSettings() {
	const rowNodes = [];
	const rowDefinitions = [
		{ kind: "slider", name: "Music", caption: "70%", value: 0.7 },
		{ kind: "slider", name: "Sound", caption: "85%", value: 0.85 },
		{ kind: "toggle", name: "Vibration", on: true },
		{ kind: "toggle", name: "Notifications", on: false },
		{ kind: "progress", name: "Storage", caption: "3.2 GB / 8 GB", value: 0.4 },
	];
	rowDefinitions.forEach((definition, index) => {
		const rowY = 40 + index * 50;
		rowNodes.push(makeNode("Row" + definition.name, 18, rowY, 720, 44, {
			components: [paint(color(COLOR_CARD), 8)],
			children: [
				textNode(definition.name + "Label", 16, 0, 180, 44, definition.name, 13, color(COLOR_TEXT)),
			],
		}));
		const rowNode = rowNodes[rowNodes.length - 1];
		if (definition.kind === "slider") {
			rowNode.children.push(textNode(definition.name + "Caption", 200, 0, 60, 44, definition.caption, 11, color(COLOR_TEXT_DIM)));
			rowNode.children.push(makeNode(definition.name + "Slider", 420, 10, 280, 24, {
				interactable: true,
				components: [slider(definition.value)],
			}));
		}
		else if (definition.kind === "toggle") {
			rowNode.children.push(makeNode(definition.name + "Toggle", 646, 9, 58, 26, {
				interactable: true,
				components: [paint(color(definition.on ? COLOR_MINT : "#333d54"), 13), toggle(), label(definition.on ? "ON" : "OFF", 10, color(COLOR_INK))],
			}));
		}
		else {
			rowNode.children.push(textNode(definition.name + "Caption", 200, 0, 130, 44, definition.caption, 11, color(COLOR_TEXT_DIM)));
			rowNode.children.push(makeNode(definition.name + "Bar", 420, 17, 280, 10, { components: [progress(definition.value)] }));
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
		const rowY = 40 + index * 30;
		aboutRowNodes.push(textNode("About" + row.name + "Label", 18, rowY, 110, 18, row.name, 11, color(COLOR_TEXT_FAINT)));
		aboutRowNodes.push(textNode("About" + row.name + "Value", 128, rowY - 1, 220, 20, row.value, 12, color(COLOR_TEXT)));
	});

	const rootNode = makeNode("Settings", 0, 0, DOCUMENT_WIDTH, DOCUMENT_HEIGHT, {
		components: [paint(color(COLOR_BACKGROUND))],
		children: [
			...headerNodes("SETTINGS", "Changes apply immediately."),
			makeNode("SettingsPanel", CONTENT_X, 114, 756, 360, {
				components: [paint(color(COLOR_SURFACE), 12)],
				children: [
					sectionLabel("PanelTitle", 18, 14, "PREFERENCES"),
					...rowNodes,
					buttonNode("ResetButton", 18, 300, 720, 36, "RESET TO DEFAULTS", color(COLOR_CARD_RAISED), 8, 12),
				],
			}),
			makeNode("AboutPanel", 1050, 114, 366, 180, {
				components: [paint(color(COLOR_SURFACE), 12)],
				children: [
					sectionLabel("AboutTitle", 18, 14, "ABOUT"),
					...aboutRowNodes,
				],
			}),
		],
	});
	writeDocument("settings.uiasset.json", rootNode);
}


//==============================================================================
// 왼쪽 레일. (모든 화면 위에 항상 보인다)
//==============================================================================
function buildNavigation() {
	const navigationDefinitions = ["HOME", "SHOP", "SETTINGS", "PROFILE"];
	const navigationNodes = navigationDefinitions.map((title, index) => {
		return makeNode("Nav" + title, 16, 128 + index * 48, RAIL_WIDTH - 32, 40, {
			interactable: true,
			components: [paint(COLOR_TRANSPARENT, 10), button(0.2)],
			children: [
				makeNode("NavActive" + title, 0, 0, RAIL_WIDTH - 32, 40, { active: index === 0, components: [paint(color(COLOR_INDIGO), 10)] }),
				textNode("NavLabel" + title, 0, 0, RAIL_WIDTH - 32, 40, title, 12, color(COLOR_TEXT), "center"),
			],
		});
	});
	const rootNode = makeNode("Navigation", 0, 0, RAIL_WIDTH, DOCUMENT_HEIGHT, {
		components: [paint(color(COLOR_SURFACE))],
		children: [
			hairline("RailHairline", RAIL_WIDTH - 1, 0, 1, DOCUMENT_HEIGHT),
			textNode("Brand", 24, 30, 168, 26, "VANILLA", 19, color(COLOR_TEXT)),
			textNode("BrandCaption", 25, 58, 168, 16, "UI SHOWCASE", 10, color(COLOR_TEXT_FAINT)),
			hairline("BrandHairline", 16, 104, RAIL_WIDTH - 32, 1),
			...navigationNodes,
			textNode("RailVersion", 24, DOCUMENT_HEIGHT - 40, 168, 16, "vanilla.js  ·  0.4.0", 10, color(COLOR_TEXT_FAINT)),
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
				components: [paint(color("#04060b", 0.66)), button(0)],
			}),
			makeNode("Dialog", DOCUMENT_WIDTH * 0.5, DOCUMENT_HEIGHT * 0.5 - 10, 400, 216, {
				pivot: [0.5, 0.5],
				components: [paint(color(COLOR_CARD), 14)],
				children: [
					makeNode("DialogAccent", 0, 0, 400, 3, { components: [paint(color(COLOR_INDIGO), 1.5)] }),
					textNode("DialogTitle", 24, 24, 352, 26, "Open this content?", 17, color(COLOR_TEXT)),
					textNode("DialogMessage", 24, 60, 352, 56, "It will use 10 energy.", 13, color(COLOR_TEXT_DIM), "left", "top"),
					buttonNode("CancelButton", 24, 148, 170, 44, "CANCEL", color(COLOR_CARD_RAISED), 10, 13),
					buttonNode("ConfirmButton", 206, 148, 170, 44, "CONFIRM", color(COLOR_INDIGO), 10, 13),
				],
			}),
		],
	});
	writeDocument("popup.uiasset.json", rootNode);
}


//==============================================================================
// 실행.
//==============================================================================
buildHome();
buildShop();
buildSettings();
buildNavigation();
buildPopup();
