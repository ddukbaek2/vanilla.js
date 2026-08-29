//==============================================================================
// UI 쇼케이스 애셋 생성기.
// - UIEditor 가 저장하는 uiasset(json) 과 같은 형식으로 화면 여섯 벌을 만든다.
// - 실행: node examples/uishowcase/generate.mjs
//==============================================================================
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
const OUTPUT_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), "assets");
const DOCUMENT_WIDTH = 960;
const DOCUMENT_HEIGHT = 640;
const NAVIGATION_HEIGHT = 64;

const COLOR_BACKGROUND = "#0f1320";
const COLOR_SURFACE = "#141a2a";
const COLOR_CARD = "#1b2233";
const COLOR_CARD_RAISED = "#232c42";
const COLOR_CHIP = "#202a40";
const COLOR_TEXT = "#f2f5fa";
const COLOR_TEXT_DIM = "#8a94a8";
const COLOR_INDIGO = "#5b6cff";
const COLOR_CYAN = "#33d1ff";
const COLOR_PINK = "#ff5c8a";
const COLOR_MINT = "#3ddc84";
const COLOR_AMBER = "#ffb347";
const COLOR_VIOLET = "#b57bff";
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

function label(text, fontSize, textColor) {
	return { type: "UILabel", text: text, fontSize: fontSize, textColor: textColor, backgroundColor: COLOR_TRANSPARENT };
}

function button(pressedAlpha = 0.28) {
	return { type: "UIButton", pressedTintColor: [0, 0, 0, pressedAlpha] };
}

function toggle() {
	return { type: "UIToggleButton", pressedTintColor: [0, 0, 0, 0.25] };
}

function scrollView(contentWidth, contentHeight) {
	return {
		type: "UIScrollView",
		scrollContentSize: [contentWidth, contentHeight],
		scrollMode: "elastic",
		dragSensitivity: 1,
		backgroundColor: COLOR_TRANSPARENT,
	};
}

function progress(value) {
	return { type: "UIProgressView", value: value, minValue: 0, maxValue: 1 };
}

function slider(value) {
	return { type: "UISlider", value: value };
}

//==============================================================================
// 자주 쓰는 조합.
//==============================================================================
function textNode(name, x, y, width, height, text, fontSize, textColor) {
	return makeNode(name, x, y, width, height, { components: [label(text, fontSize, textColor)] });
}

function buttonNode(name, x, y, width, height, text, fillColor, roundSize, fontSize = 16, textColor = color(COLOR_TEXT)) {
	return makeNode(name, x, y, width, height, {
		interactable: true,
		components: [paint(fillColor, roundSize), button(), label(text, fontSize, textColor)],
	});
}

function chipNode(name, x, y, width, text, textColor) {
	return makeNode(name, x, y, width, 32, {
		components: [paint(color(COLOR_CHIP), 16)],
		children: [textNode(name + "Label", 0, 0, width, 32, text, 15, textColor)],
	});
}

function writeDocument(fileName, rootNode) {
	const documentData = { version: 1, root: rootNode };
	writeFileSync(join(OUTPUT_DIRECTORY, fileName), JSON.stringify(documentData, null, "\t") + "\n", "utf8");
	console.log("wrote " + fileName);
}


//==============================================================================
// 홈 화면. (헤더 + 세로 스크롤 목록 + 오른쪽 일일 패널)
//==============================================================================
function buildHome() {
	const cardDefinitions = [
		{ title: "Sunrise Valley", subtitle: "Adventure  ·  12 stages", accent: COLOR_INDIGO, glyph: "S" },
		{ title: "Neon Arena", subtitle: "PvP  ·  Season 4", accent: COLOR_CYAN, glyph: "N" },
		{ title: "Crystal Mine", subtitle: "Idle  ·  x2 boost active", accent: COLOR_PINK, glyph: "C" },
		{ title: "Sky Garden", subtitle: "Puzzle  ·  48 levels", accent: COLOR_MINT, glyph: "G" },
		{ title: "Iron Legion", subtitle: "Strategy  ·  Co-op raid", accent: COLOR_AMBER, glyph: "L" },
		{ title: "Deep Abyss", subtitle: "Roguelike  ·  Hard mode", accent: COLOR_VIOLET, glyph: "A" },
	];
	const cardHeight = 118;
	const cardGap = 12;
	const listWidth = 632;
	const cardNodes = cardDefinitions.map((definition, index) => {
		const cardY = index * (cardHeight + cardGap);
		return makeNode("Card" + index, 0, cardY, listWidth, cardHeight, {
			components: [paint(color(COLOR_CARD), 14)],
			children: [
				makeNode("Stripe" + index, 0, 0, 6, cardHeight, { components: [paint(color(definition.accent), 3)] }),
				makeNode("Icon" + index, 22, 20, 78, 78, {
					components: [paint(color(definition.accent), 18)],
					children: [textNode("IconGlyph" + index, 0, 0, 78, 78, definition.glyph, 34, color("#0f1320"))],
				}),
				textNode("CardTitle" + index, 120, 24, 320, 30, definition.title, 21, color(COLOR_TEXT)),
				textNode("CardSubtitle" + index, 120, 60, 360, 24, definition.subtitle, 14, color(COLOR_TEXT_DIM)),
				buttonNode("OpenButton" + index, 500, 36, 108, 46, "OPEN", color(definition.accent), 12, 16, color("#0f1320")),
			],
		});
	});
	const listContentHeight = cardDefinitions.length * (cardHeight + cardGap) - cardGap;

	const dailyRows = [
		{ name: "Energy", value: 0.72, accent: COLOR_MINT, caption: "72 / 100" },
		{ name: "Quest", value: 0.4, accent: COLOR_CYAN, caption: "2 / 5" },
		{ name: "Season Pass", value: 0.88, accent: COLOR_AMBER, caption: "Lv. 44" },
	];
	const dailyRowNodes = [];
	dailyRows.forEach((row, index) => {
		const rowY = 64 + index * 92;
		dailyRowNodes.push(textNode("Daily" + row.name.replace(" ", "") + "Label", 22, rowY, 140, 22, row.name, 15, color(COLOR_TEXT)));
		dailyRowNodes.push(textNode("Daily" + row.name.replace(" ", "") + "Caption", 140, rowY, 94, 22, row.caption, 13, color(COLOR_TEXT_DIM)));
		dailyRowNodes.push(makeNode("Daily" + row.name.replace(" ", "") + "Bar", 22, rowY + 34, 212, 12, {
			components: [progress(row.value)],
		}));
	});

	const rootNode = makeNode("Home", 0, 0, DOCUMENT_WIDTH, DOCUMENT_HEIGHT, {
		components: [paint(color(COLOR_BACKGROUND))],
		children: [
			makeNode("Header", 0, 0, DOCUMENT_WIDTH, 72, {
				components: [paint(color(COLOR_SURFACE))],
				children: [
					textNode("Title", 24, 18, 340, 36, "VANILLA  SHOWCASE", 22, color(COLOR_TEXT)),
					textNode("Subtitle", 366, 24, 200, 24, "UI assets demo", 13, color(COLOR_TEXT_DIM)),
					chipNode("CoinChip", 700, 20, 112, "◆ 12,480", color(COLOR_AMBER)),
					chipNode("GemChip", 822, 20, 114, "● 1,250", color(COLOR_CYAN)),
				],
			}),
			makeNode("CardList", 24, 92, listWidth, 468, {
				interactable: true,
				components: [scrollView(listWidth, listContentHeight)],
				contentChildren: cardNodes,
			}),
			makeNode("DailyPanel", 680, 92, 256, 468, {
				components: [paint(color(COLOR_SURFACE), 16)],
				children: [
					textNode("DailyTitle", 22, 18, 120, 26, "DAILY", 15, color(COLOR_TEXT_DIM)),
					...dailyRowNodes,
					buttonNode("ClaimButton", 22, 396, 212, 50, "CLAIM REWARD", color(COLOR_INDIGO), 14, 15),
				],
			}),
		],
	});
	writeDocument("home.uiasset.json", rootNode);
}


//==============================================================================
// 상점 화면. (가로 스크롤 추천 띠 + 격자 상품)
//==============================================================================
function buildShop() {
	const featuredDefinitions = [
		{ title: "Starter Pack", price: "◆ 240", accent: COLOR_INDIGO },
		{ title: "Weekend Boost", price: "◆ 120", accent: COLOR_PINK },
		{ title: "Gem Bundle", price: "● 90", accent: COLOR_CYAN },
		{ title: "Legend Skin", price: "● 480", accent: COLOR_VIOLET },
		{ title: "Energy Refill", price: "◆ 60", accent: COLOR_MINT },
		{ title: "Season Ticket", price: "● 320", accent: COLOR_AMBER },
	];
	const tileWidth = 250;
	const tileGap = 12;
	const featuredNodes = featuredDefinitions.map((definition, index) => {
		return makeNode("Featured" + index, index * (tileWidth + tileGap), 0, tileWidth, 136, {
			components: [paint(color(definition.accent), 16)],
			children: [
				textNode("FeaturedTitle" + index, 18, 18, 214, 28, definition.title, 19, color("#0f1320")),
				textNode("FeaturedCaption" + index, 18, 50, 214, 22, "Limited  ·  2d 14h left", 13, color("#0f1320", 0.75)),
				buttonNode("FeaturedBuy" + index, 18, 84, 110, 36, definition.price, color("#0f1320", 0.85), 10, 14),
			],
		});
	});
	const featuredContentWidth = featuredDefinitions.length * (tileWidth + tileGap) - tileGap;

	const itemDefinitions = [
		{ title: "Health Potion", caption: "Restores 50 HP", price: 120, accent: COLOR_PINK },
		{ title: "Mana Crystal", caption: "Restores 30 MP", price: 150, accent: COLOR_CYAN },
		{ title: "Lucky Charm", caption: "+10% drop rate", price: 300, accent: COLOR_AMBER },
		{ title: "Iron Shield", caption: "+12 defense", price: 420, accent: COLOR_INDIGO },
		{ title: "Swift Boots", caption: "+8% speed", price: 380, accent: COLOR_MINT },
		{ title: "Mystery Box", caption: "Random reward", price: 999, accent: COLOR_VIOLET },
	];
	const itemNodes = itemDefinitions.map((definition, index) => {
		const column = index % 3;
		const row = Math.floor(index / 3);
		const itemX = 24 + column * 311;
		const itemY = 262 + row * 152;
		return makeNode("Item" + index, itemX, itemY, 290, 140, {
			components: [paint(color(COLOR_CARD), 14)],
			children: [
				makeNode("ItemIcon" + index, 18, 18, 56, 56, { components: [paint(color(definition.accent), 14)] }),
				textNode("ItemTitle" + index, 90, 20, 184, 26, definition.title, 17, color(COLOR_TEXT)),
				textNode("ItemCaption" + index, 90, 48, 184, 22, definition.caption, 13, color(COLOR_TEXT_DIM)),
				buttonNode("BuyButton" + index, 18, 90, 254, 36, "BUY  ◆ " + definition.price, color(COLOR_CARD_RAISED), 10, 14),
			],
		});
	});

	const rootNode = makeNode("Shop", 0, 0, DOCUMENT_WIDTH, DOCUMENT_HEIGHT, {
		components: [paint(color(COLOR_BACKGROUND))],
		children: [
			makeNode("Header", 0, 0, DOCUMENT_WIDTH, 72, {
				components: [paint(color(COLOR_SURFACE))],
				children: [
					textNode("Title", 24, 18, 160, 36, "SHOP", 22, color(COLOR_TEXT)),
					textNode("Subtitle", 184, 24, 300, 24, "Featured deals refresh daily", 13, color(COLOR_TEXT_DIM)),
					chipNode("CoinChip", 700, 20, 112, "◆ 12,480", color(COLOR_AMBER)),
					chipNode("GemChip", 822, 20, 114, "● 1,250", color(COLOR_CYAN)),
				],
			}),
			textNode("FeaturedLabel", 24, 88, 200, 22, "FEATURED", 13, color(COLOR_TEXT_DIM)),
			makeNode("FeaturedList", 24, 112, 912, 136, {
				interactable: true,
				components: [scrollView(featuredContentWidth, 136)],
				contentChildren: featuredNodes,
			}),
			...itemNodes,
		],
	});
	writeDocument("shop.uiasset.json", rootNode);
}


//==============================================================================
// 설정 화면. (슬라이더 / 토글 / 진행바 / 초기화)
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
		const rowY = 70 + index * 60;
		rowNodes.push(makeNode("Row" + definition.name, 24, rowY, 552, 54, {
			components: [paint(color(COLOR_CARD), 12)],
			children: [
				textNode(definition.name + "Label", 20, 0, 200, 54, definition.name, 16, color(COLOR_TEXT)),
			],
		}));
		const rowNode = rowNodes[rowNodes.length - 1];
		if (definition.kind === "slider") {
			rowNode.children.push(textNode(definition.name + "Caption", 216, 0, 60, 54, definition.caption, 13, color(COLOR_TEXT_DIM)));
			rowNode.children.push(makeNode(definition.name + "Slider", 290, 13, 240, 28, {
				interactable: true,
				components: [slider(definition.value)],
			}));
		}
		else if (definition.kind === "toggle") {
			rowNode.children.push(makeNode(definition.name + "Toggle", 466, 11, 66, 32, {
				interactable: true,
				components: [paint(color(definition.on ? COLOR_MINT : "#3a4560"), 16), toggle(), label(definition.on ? "ON" : "OFF", 12, color("#0f1320"))],
			}));
		}
		else {
			rowNode.children.push(textNode(definition.name + "Caption", 216, 0, 120, 54, definition.caption, 13, color(COLOR_TEXT_DIM)));
			rowNode.children.push(makeNode(definition.name + "Bar", 350, 21, 180, 12, { components: [progress(definition.value)] }));
		}
	});

	const rootNode = makeNode("Settings", 0, 0, DOCUMENT_WIDTH, DOCUMENT_HEIGHT, {
		components: [paint(color(COLOR_BACKGROUND))],
		children: [
			makeNode("Header", 0, 0, DOCUMENT_WIDTH, 72, {
				components: [paint(color(COLOR_SURFACE))],
				children: [
					textNode("Title", 24, 18, 200, 36, "SETTINGS", 22, color(COLOR_TEXT)),
					textNode("Subtitle", 224, 24, 300, 24, "Changes apply immediately", 13, color(COLOR_TEXT_DIM)),
				],
			}),
			makeNode("SettingsPanel", 180, 96, 600, 424, {
				components: [paint(color(COLOR_SURFACE), 18)],
				children: [
					textNode("PanelTitle", 24, 22, 200, 26, "PREFERENCES", 13, color(COLOR_TEXT_DIM)),
					...rowNodes,
					buttonNode("ResetButton", 24, 372, 552, 40, "RESET TO DEFAULTS", color(COLOR_CARD_RAISED), 12, 14),
				],
			}),
		],
	});
	writeDocument("settings.uiasset.json", rootNode);
}


//==============================================================================
// 아래 탐색 막대. (모든 화면 위에 항상 보인다)
//==============================================================================
function buildNavigation() {
	const navigationDefinitions = ["HOME", "SHOP", "SETTINGS", "PROFILE"];
	const navigationNodes = navigationDefinitions.map((title, index) => {
		return makeNode("Nav" + title, 35 + index * 230, 12, 200, 40, {
			interactable: true,
			components: [paint(color(COLOR_CARD), 12), button()],
			children: [
				makeNode("NavActive" + title, 0, 0, 200, 40, { active: index === 0, components: [paint(color(COLOR_INDIGO), 12)] }),
				textNode("NavLabel" + title, 0, 0, 200, 40, title, 14, color(COLOR_TEXT)),
			],
		});
	});
	const rootNode = makeNode("Navigation", 0, DOCUMENT_HEIGHT - NAVIGATION_HEIGHT, DOCUMENT_WIDTH, NAVIGATION_HEIGHT, {
		components: [paint(color(COLOR_SURFACE))],
		children: [
			makeNode("NavigationLine", 0, 0, DOCUMENT_WIDTH, 1, { components: [paint(color("#2a3450"))] }),
			...navigationNodes,
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
				components: [paint(color("#05070c", 0.62)), button(0)],
			}),
			makeNode("Dialog", DOCUMENT_WIDTH * 0.5, DOCUMENT_HEIGHT * 0.5 - 10, 420, 250, {
				pivot: [0.5, 0.5],
				components: [paint(color(COLOR_CARD), 20)],
				children: [
					makeNode("DialogAccent", 0, 0, 420, 6, { components: [paint(color(COLOR_INDIGO), 3)] }),
					textNode("DialogTitle", 28, 30, 364, 32, "Open this content?", 22, color(COLOR_TEXT)),
					textNode("DialogMessage", 28, 74, 364, 60, "It will use 10 energy.", 15, color(COLOR_TEXT_DIM)),
					buttonNode("CancelButton", 28, 168, 174, 52, "CANCEL", color(COLOR_CARD_RAISED), 14, 15),
					buttonNode("ConfirmButton", 218, 168, 174, 52, "CONFIRM", color(COLOR_INDIGO), 14, 15),
				],
			}),
		],
	});
	writeDocument("popup.uiasset.json", rootNode);
}


//==============================================================================
// 토스트. (아래에서 떠오르는 알약)
//==============================================================================
function buildToast() {
	const rootNode = makeNode("Toast", DOCUMENT_WIDTH * 0.5, 548, 400, 48, {
		pivot: [0.5, 0.5],
		components: [paint(color(COLOR_CHIP), 24)],
		children: [
			makeNode("ToastAccent", 14, 16, 16, 16, { components: [paint(color(COLOR_MINT), 8)] }),
			textNode("ToastLabel", 36, 0, 350, 48, "Done.", 15, color(COLOR_TEXT)),
		],
	});
	writeDocument("toast.uiasset.json", rootNode);
}


//==============================================================================
// 실행.
//==============================================================================
mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
buildHome();
buildShop();
buildSettings();
buildNavigation();
buildPopup();
buildToast();
