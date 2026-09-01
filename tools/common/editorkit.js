//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Pane, PaneStyle, PaneTheme } from "../../src/web/pane.js";


//==============================================================================
// 편집기 공통 테마. (VSCode Dark Modern 계열 — 모든 도구가 이 값 하나를 쓴다)
//==============================================================================
export const EditorTheme = {
	fontFamily: "Inter, -apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"SF Pro Display\","
		+ " \"Segoe UI Variable Text\", \"Segoe UI\", Pretendard, \"Apple SD Gothic Neo\", \"Malgun Gothic\", Roboto, sans-serif",
	accentColor: "#0078d4",
	accentSoftColor: "#04395e",
	inkColor: "#cccccc",
	inkDimColor: "#9d9d9d",
	iconColor: "#85b6ea",
	borderColor: "#2b2b2b",
	borderSoftColor: "rgba(255, 255, 255, 0.045)",
	rowHeight: "26px",
	hoverColor: "#2a2d2e",
	menuHoverColor: "#04395e",
	selectedRowTextColor: "#ffffff",
	backgroundColor: "#1f1f1f",
	panelColor: "#181818",
	groupColor: "#202020",
	inputBackgroundColor: "#313131",
	canvasBackgroundColor: "#1f1f1f",
	successColor: "#3ddc84",
	errorColor: "#f44336",
};

// PaneTheme 에 씌우는 편집기 색.
const EDITOR_PANE_COLORS = {
	background: EditorTheme.backgroundColor,
	panel: EditorTheme.panelColor,
	toolbar: EditorTheme.panelColor,
	border: EditorTheme.borderColor,
	text: EditorTheme.inkColor,
	textDim: EditorTheme.inkDimColor,
	accent: EditorTheme.accentSoftColor,
	accentHover: EditorTheme.accentColor,
	inputBg: EditorTheme.inputBackgroundColor,
	resizer: EditorTheme.borderColor,
	resizerHover: EditorTheme.accentColor,
	success: EditorTheme.successColor,
	error: EditorTheme.errorColor,
};


//==============================================================================
// 공통 커맨드 핸들러. (도구가 시작 시 한 번 등록한다)
//==============================================================================
let editorExecuteCommand = null;
let editorIsCommandChecked = null;

/**
 * @param { function(string): void } executeCommand
 * @param { function(string): boolean } isCommandChecked
 */
export function setEditorCommandHandler(executeCommand, isCommandChecked) {
	editorExecuteCommand = executeCommand;
	editorIsCommandChecked = isCommandChecked;
}


//==============================================================================
// 테마 적용. (PaneTheme 갱신 + 전역 스크롤 막대/글꼴 스타일 주입)
//==============================================================================
export function applyEditorTheme() {
	for (const colorName of System.Object.keys(EDITOR_PANE_COLORS)) {
		PaneTheme.color[colorName] = EDITOR_PANE_COLORS[colorName];
	}
	PaneTheme.size.resizer = 3;
	PaneTheme.font.family = EditorTheme.fontFamily;
	PaneTheme.font.size = "13px";

	const editorStyleElement = System.document.createElement("style");
	editorStyleElement.innerText = "* { scrollbar-width: thin; scrollbar-color: rgba(121, 121, 121, 0.4) transparent; }"
		+ "::-webkit-scrollbar { width: 10px; height: 10px; }"
		+ "::-webkit-scrollbar-track { background: transparent; }"
		+ "::-webkit-scrollbar-thumb { background: rgba(121, 121, 121, 0.4); }"
		+ "::-webkit-scrollbar-thumb:hover { background: rgba(121, 121, 121, 0.7); }"
		+ "::-webkit-scrollbar-corner { background: transparent; }"
		+ "input[type=checkbox] { accent-color: " + EditorTheme.accentColor + "; }"
		+ "body { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }";
	System.document.head.appendChild(editorStyleElement);
}


//==============================================================================
// 그림 아이콘 감싸기. (14x14 기준, 색은 글자색을 따른다)
//==============================================================================
/**
 * @param { string } shapeMarkup
 * @returns { string }
 */
export function wrapEditorIconMarkup(shapeMarkup) {
	return "<svg width='18' height='18' viewBox='0 0 14 14' xmlns='http://www.w3.org/2000/svg'>" + shapeMarkup + "</svg>";
}


//==============================================================================
// 메뉴 패널 생성. (메뉴 막대와 오른쪽 단추 메뉴가 함께 쓴다)
//==============================================================================
/**
 * @param { object[] } menuItems
 * @returns { HTMLElement }
 */
function createEditorMenuPanelElement(menuItems) {
	const panelElement = System.document.createElement("div");
	panelElement.id = "editorMenuPanel";
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
		checkElement.style.cssText = "width:16px;flex:0 0 16px;color:" + EditorTheme.accentColor + ";";
		const isChecked = editorIsCommandChecked ? editorIsCommandChecked(menuItem.id) : false;
		checkElement.innerText = isChecked ? "✓" : "";
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
			itemElement.style.backgroundColor = EditorTheme.menuHoverColor;
		});
		itemElement.addEventListener("mouseleave", () => {
			itemElement.style.backgroundColor = "transparent";
		});
		itemElement.addEventListener("click", () => {
			closeEditorMenuPanel();
			if (menuItem.action) {
				menuItem.action();
				return;
			}
			if (editorExecuteCommand) {
				editorExecuteCommand(menuItem.id);
			}
		});
		panelElement.appendChild(itemElement);
	}
	return panelElement;
}


//==============================================================================
// 좌표를 지정해 메뉴 펼치기. (머리말 더보기 단추와 오른쪽 단추 메뉴가 쓴다)
//==============================================================================
/**
 * @param { number } clientX
 * @param { number } clientY
 * @param { object[] } menuItems
 */
export function openEditorMenuPanelAt(clientX, clientY, menuItems) {
	closeEditorMenuPanel();
	const panelElement = createEditorMenuPanelElement(menuItems);
	panelElement.style.left = System.Math.round(clientX) + "px";
	panelElement.style.top = System.Math.round(clientY) + "px";
	System.document.body.appendChild(panelElement);
}


//==============================================================================
// 메뉴 접기.
//==============================================================================
export function closeEditorMenuPanel() {
	const existingPanel = System.document.getElementById("editorMenuPanel");
	if (existingPanel) {
		existingPanel.remove();
	}
	if (openMenuCloseHandler) {
		openMenuCloseHandler();
	}
}

// 열려 있는 메뉴 막대 항목을 되돌리는 손잡이.
let openMenuCloseHandler = null;

// 메뉴 바깥을 누르면 접는다.
System.window.addEventListener("mousedown", () => {
	const openedPanel = System.document.getElementById("editorMenuPanel");
	if (openedPanel || openMenuCloseHandler) {
		closeEditorMenuPanel();
	}
});


//==============================================================================
// 메뉴 막대 생성. (일반 데스크톱 응용 프로그램과 같은 배치)
//==============================================================================
/**
 * @param { object[] } menuDefinitions
 * @returns { HTMLElement }
 */
export function createEditorMenuBarElement(menuDefinitions) {
	const menuBarElement = PaneStyle.create("div", "", {
		style: {
			backgroundColor: PaneTheme.color.toolbar,
			borderBottom: "1px solid " + PaneTheme.color.border,
			display: "flex",
			alignItems: "stretch",
			padding: "0 4px",
		},
	});
	const menuTitleElementList = [];
	let openMenuIndex = -1;

	const closeDropdown = () => {
		if (openMenuIndex >= 0) {
			menuTitleElementList[openMenuIndex].style.backgroundColor = "transparent";
		}
		openMenuIndex = -1;
		openMenuCloseHandler = null;
	};
	const openDropdown = (menuIndex) => {
		closeEditorMenuPanel();
		const titleElement = menuTitleElementList[menuIndex];
		const titleRect = titleElement.getBoundingClientRect();
		const panelElement = createEditorMenuPanelElement(menuDefinitions[menuIndex].items);
		panelElement.style.left = System.Math.round(titleRect.left) + "px";
		panelElement.style.top = System.Math.round(titleRect.bottom) + "px";
		System.document.body.appendChild(panelElement);
		titleElement.style.backgroundColor = EditorTheme.menuHoverColor;
		openMenuIndex = menuIndex;
		openMenuCloseHandler = closeDropdown;
	};

	for (let menuIndex = 0; menuIndex < menuDefinitions.length; ++menuIndex) {
		const menuDefinition = menuDefinitions[menuIndex];
		const titleElement = PaneStyle.create("div", "", {
			text: menuDefinition.title,
			style: {
				position: "relative",
				width: "auto",
				height: "22px",
				margin: "auto 2px",
				display: "flex",
				alignItems: "center",
				padding: "0 10px",
				fontSize: "13px",
				borderRadius: "4px",
				color: PaneTheme.color.text,
				cursor: "default",
				userSelect: "none",
			},
		});
		const currentMenuIndex = menuIndex;
		titleElement.addEventListener("mousedown", (mouseEvent) => {
			mouseEvent.preventDefault();
			mouseEvent.stopPropagation();
			if (openMenuIndex === currentMenuIndex) {
				closeEditorMenuPanel();
				return;
			}
			openDropdown(currentMenuIndex);
		});
		titleElement.addEventListener("mouseenter", () => {
			if (openMenuIndex >= 0 && openMenuIndex !== currentMenuIndex) {
				openDropdown(currentMenuIndex);
				return;
			}
			if (openMenuIndex !== currentMenuIndex) {
				titleElement.style.backgroundColor = EditorTheme.menuHoverColor;
			}
		});
		titleElement.addEventListener("mouseleave", () => {
			if (openMenuIndex !== currentMenuIndex) {
				titleElement.style.backgroundColor = "transparent";
			}
		});
		menuTitleElementList.push(titleElement);
		menuBarElement.appendChild(titleElement);
	}
	return menuBarElement;
}


//==============================================================================
// 제목이 붙은 세로 구획 생성.
//==============================================================================
/**
 * @param { string } titleText
 * @param { function(): object[] } menuBuilder
 * @returns { HTMLElement }
 */
export function createEditorSectionElement(titleText, menuBuilder) {
	const sectionElement = PaneStyle.create("div", "panel", { style: { display: "flex", flexDirection: "column", padding: "0" } });
	const titleElement = PaneStyle.create("div", "", {
		text: titleText,
		style: {
			position: "relative",
			width: "auto",
			height: "30px",
			lineHeight: "30px",
			padding: "0 12px",
			fontSize: "11px",
			fontWeight: "600",
			letterSpacing: "0.8px",
			color: "#bbbbbb",
			backgroundColor: PaneTheme.color.toolbar,
			borderBottom: "1px solid " + PaneTheme.color.border,
			flexShrink: "0",
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
			text: "⋯",
			style: {
				position: "relative", width: "20px", height: "16px",
				display: "flex", alignItems: "center", justifyContent: "center",
				fontSize: "14px", color: PaneTheme.color.textDim,
				cursor: "pointer", borderRadius: "3px", userSelect: "none",
			},
		});
		moreElement.addEventListener("mouseenter", () => {
			moreElement.style.backgroundColor = EditorTheme.menuHoverColor;
		});
		moreElement.addEventListener("mouseleave", () => {
			moreElement.style.backgroundColor = "transparent";
		});
		moreElement.addEventListener("click", (mouseEvent) => {
			mouseEvent.stopPropagation();
			const buttonRect = moreElement.getBoundingClientRect();
			openEditorMenuPanelAt(buttonRect.right - 200, buttonRect.bottom + 2, menuBuilder());
		});
		titleElement.appendChild(spacerElement);
		titleElement.appendChild(moreElement);
	}
	return sectionElement;
}


//==============================================================================
// 구획 머리말에 놓는 작은 글자 단추. (재생 조작 등)
//==============================================================================
/**
 * @param { string } labelText
 * @returns { HTMLElement }
 */
export function createEditorHeaderButtonElement(labelText) {
	const buttonElement = PaneStyle.create("div", "", {
		text: labelText,
		style: {
			position: "relative", width: "auto", height: "20px",
			display: "flex", alignItems: "center", padding: "0 8px", marginLeft: "4px",
			fontSize: "11px", fontWeight: "600", letterSpacing: "0.4px",
			color: PaneTheme.color.textDim, borderRadius: "3px",
			cursor: "pointer", userSelect: "none",
		},
	});
	buttonElement.addEventListener("mouseenter", () => {
		if (buttonElement.dataset.selected !== "true") {
			buttonElement.style.backgroundColor = EditorTheme.menuHoverColor;
		}
	});
	buttonElement.addEventListener("mouseleave", () => {
		if (buttonElement.dataset.selected !== "true") {
			buttonElement.style.backgroundColor = "transparent";
		}
	});
	return buttonElement;
}

/**
 * @param { HTMLElement } buttonElement
 * @param { boolean } isSelected
 */
export function setEditorHeaderButtonSelected(buttonElement, isSelected) {
	buttonElement.dataset.selected = isSelected ? "true" : "false";
	buttonElement.style.backgroundColor = isSelected ? EditorTheme.accentColor : "transparent";
	buttonElement.style.color = isSelected ? EditorTheme.selectedRowTextColor : PaneTheme.color.textDim;
}


//==============================================================================
// 목록 한 줄 생성. (기호 + 이름)
//==============================================================================
/**
 * @param { string } glyphMarkup
 * @param { string } labelText
 * @returns { HTMLElement }
 */
export function createEditorListRowElement(glyphMarkup, labelText) {
	const rowElement = PaneStyle.create("div", "", {
		style: {
			position: "relative",
			width: "auto",
			height: EditorTheme.rowHeight,
			flexShrink: "0",
			display: "flex",
			alignItems: "center",
			gap: "8px",
			padding: "0 12px",
			fontSize: "13px",
			color: PaneTheme.color.text,
			cursor: "pointer",
			userSelect: "none",
			borderLeft: "3px solid transparent",
			whiteSpace: "nowrap",
			overflow: "hidden",
		},
	});
	const glyphElement = PaneStyle.create("span", "", {
		style: {
			position: "relative", width: "18px", height: "18px", flexShrink: "0",
			display: "flex", alignItems: "center", justifyContent: "center", color: EditorTheme.iconColor,
		},
	});
	glyphElement.innerHTML = glyphMarkup;
	const labelElement = PaneStyle.create("span", "", {
		text: labelText,
		style: {
			position: "relative", width: "auto", height: "auto",
			overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
		},
	});
	rowElement.appendChild(glyphElement);
	rowElement.appendChild(labelElement);
	rowElement.addEventListener("mouseenter", () => {
		if (rowElement.dataset.selected !== "true") {
			rowElement.style.backgroundColor = EditorTheme.hoverColor;
		}
	});
	rowElement.addEventListener("mouseleave", () => {
		if (rowElement.dataset.selected !== "true") {
			rowElement.style.backgroundColor = "transparent";
		}
	});
	return rowElement;
}

/**
 * @param { HTMLElement } rowElement
 * @param { boolean } isSelected
 */
export function setEditorListRowSelected(rowElement, isSelected) {
	rowElement.dataset.selected = isSelected ? "true" : "false";
	rowElement.style.backgroundColor = isSelected ? EditorTheme.accentSoftColor : "transparent";
	rowElement.style.borderLeftColor = isSelected ? EditorTheme.accentColor : "transparent";
	rowElement.style.color = isSelected ? EditorTheme.selectedRowTextColor : PaneTheme.color.text;
}


//==============================================================================
// 상태줄 생성. (창 맨 아래 한 줄)
//==============================================================================
/**
 * @returns { { statusBarElement: HTMLElement, statusTextElement: HTMLElement } }
 */
export function createEditorStatusBarElement() {
	const statusBarElement = PaneStyle.create("div", "", {
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
	const statusTextElement = PaneStyle.create("span", "", {
		text: "",
		style: {
			position: "relative", width: "auto", height: "auto",
			whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
		},
	});
	statusBarElement.appendChild(statusTextElement);
	return { statusBarElement: statusBarElement, statusTextElement: statusTextElement };
}


//==============================================================================
// 입력 상자 꾸미기.
//==============================================================================
/**
 * @param { HTMLInputElement } inputElement
 */
export function decorateEditorInputElement(inputElement) {
	inputElement.style.cssText = "flex:1;min-width:0;height:24px;box-sizing:border-box;padding:0 7px;"
		+ "font-family:" + EditorTheme.fontFamily + ";font-size:13px;border-radius:3px;outline:none;"
		+ "background:" + PaneTheme.color.inputBg + ";color:" + PaneTheme.color.text + ";"
		+ "border:1px solid " + EditorTheme.borderColor + ";";
	inputElement.addEventListener("focus", () => {
		inputElement.style.borderColor = EditorTheme.accentColor;
		inputElement.style.boxShadow = "0 0 0 1px " + EditorTheme.accentColor + " inset";
	});
	inputElement.addEventListener("blur", () => {
		inputElement.style.borderColor = EditorTheme.borderColor;
		inputElement.style.boxShadow = "none";
	});
}


//==============================================================================
// 글자 단추 생성. (대화 상자와 도구 단추가 함께 쓴다)
//==============================================================================
/**
 * @param { string } labelText
 * @param { boolean } isPrimary
 * @returns { HTMLElement }
 */
export function createEditorButtonElement(labelText, isPrimary) {
	const buttonElement = System.document.createElement("div");
	buttonElement.innerText = labelText;
	buttonElement.style.cssText = "padding:6px 16px;font-size:13px;border-radius:3px;cursor:pointer;user-select:none;"
		+ "border:1px solid " + PaneTheme.color.border + ";"
		+ (isPrimary
			? ("background:" + EditorTheme.accentColor + ";color:" + EditorTheme.selectedRowTextColor + ";border-color:" + EditorTheme.accentColor + ";")
			: ("background:" + PaneTheme.color.inputBg + ";color:" + PaneTheme.color.text + ";"));
	buttonElement.addEventListener("mouseenter", () => {
		buttonElement.style.filter = "brightness(1.15)";
	});
	buttonElement.addEventListener("mouseleave", () => {
		buttonElement.style.filter = "none";
	});
	return buttonElement;
}


//==============================================================================
// 인스펙터 묶음 머리말 생성. (접기 + 더보기 메뉴)
//==============================================================================
/**
 * @param { string } titleText
 * @param { HTMLElement } groupBodyElement
 * @param { function(): object[] } menuBuilder
 * @returns { HTMLElement }
 */
export function createEditorGroupElement(titleText, groupBodyElement, menuBuilder) {
	const groupElement = PaneStyle.create("div", "", {
		style: {
			position: "relative", width: "auto", height: "30px", flexShrink: "0",
			display: "flex", alignItems: "center",
			padding: "0 8px 0 8px", marginTop: "8px",
			backgroundColor: EditorTheme.groupColor,
			borderTop: "1px solid " + EditorTheme.borderColor,
			borderBottom: "1px solid " + EditorTheme.borderSoftColor,
			cursor: "pointer", userSelect: "none",
		},
	});

	const foldElement = PaneStyle.create("span", "", {
		text: "▾",
		style: {
			position: "relative", width: "14px", height: "auto", flexShrink: "0",
			fontSize: "12px", color: PaneTheme.color.textDim, textAlign: "center",
		},
	});
	groupElement.appendChild(foldElement);

	const titleElement = PaneStyle.create("span", "", {
		text: titleText,
		style: {
			position: "relative", width: "auto", height: "auto", flex: "1",
			fontSize: "13px", fontWeight: "600", color: EditorTheme.inkColor,
		},
	});
	groupElement.appendChild(titleElement);

	if (groupBodyElement) {
		groupElement.addEventListener("click", () => {
			const isFolded = (groupBodyElement.style.display === "none");
			groupBodyElement.style.display = isFolded ? "" : "none";
			foldElement.innerText = isFolded ? "▾" : "▸";
		});
	}

	if (menuBuilder) {
		const moreElement = PaneStyle.create("div", "", {
			text: "⋯",
			style: {
				position: "relative", width: "20px", height: "18px", flexShrink: "0",
				display: "flex", alignItems: "center", justifyContent: "center",
				fontSize: "14px", color: PaneTheme.color.textDim,
				cursor: "pointer", borderRadius: "3px", userSelect: "none",
			},
		});
		moreElement.addEventListener("mouseenter", () => {
			moreElement.style.backgroundColor = EditorTheme.menuHoverColor;
		});
		moreElement.addEventListener("mouseleave", () => {
			moreElement.style.backgroundColor = "transparent";
		});
		moreElement.addEventListener("click", (mouseEvent) => {
			mouseEvent.stopPropagation();
			const buttonRect = moreElement.getBoundingClientRect();
			openEditorMenuPanelAt(buttonRect.right - 190, buttonRect.bottom + 2, menuBuilder());
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
export function createEditorPropertyRowElement(parentElement, labelText) {
	const rowElement = PaneStyle.create("div", "", {
		style: {
			position: "relative", width: "auto", height: "auto",
			display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px",
			borderBottom: "1px solid " + EditorTheme.borderSoftColor,
		},
	});
	const labelElement = PaneStyle.create("span", "", {
		text: labelText,
		style: {
			position: "relative", width: "104px", height: "auto", flexShrink: "0",
			fontSize: "13px", color: PaneTheme.color.textDim, lineHeight: "1.3",
		},
	});
	rowElement.appendChild(labelElement);
	parentElement.appendChild(rowElement);
	return rowElement;
}


//==============================================================================
// 숫자 표기.
//==============================================================================
/**
 * @param { number } value
 * @returns { string }
 */
export function composeEditorNumberText(value) {
	const isInteger = System.Math.abs(value - System.Math.round(value)) < 0.0001;
	return isInteger ? String(System.Math.round(value)) : value.toFixed(2);
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
 * @param { Function } beginEditCallback - 값 변경 직전에 한 번 불린다. (되돌리기 기록 등)
 * @returns { HTMLElement }
 */
export function appendEditorNumberRow(parentElement, labelText, currentValue, stepAmount, applyCallback, beginEditCallback) {
	const rowElement = createEditorPropertyRowElement(parentElement, labelText);
	const inputElement = PaneStyle.create("input", "input", { type: "text" });
	inputElement.style.position = "relative";
	inputElement.style.width = "100%";
	inputElement.value = composeEditorNumberText(currentValue);

	const commitValue = () => {
		const parsedValue = System.Number(inputElement.value);
		if (System.Number.isFinite(parsedValue)) {
			if (beginEditCallback) {
				beginEditCallback();
			}
			applyCallback(parsedValue);
		}
		else {
			inputElement.value = composeEditorNumberText(currentValue);
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
		if (beginEditCallback) {
			beginEditCallback();
		}
		const onMouseMove = (moveEvent) => {
			let nextValue = startValue + (moveEvent.clientX - startX) * stepAmount;
			if (stepAmount >= 1) {
				nextValue = System.Math.round(nextValue);
			}
			inputElement.value = composeEditorNumberText(nextValue);
			applyCallback(nextValue);
		};
		const onMouseUp = () => {
			System.window.removeEventListener("mousemove", onMouseMove);
			System.window.removeEventListener("mouseup", onMouseUp);
		};
		System.window.addEventListener("mousemove", onMouseMove);
		System.window.addEventListener("mouseup", onMouseUp);
	});

	rowElement.appendChild(inputElement);
	return rowElement;
}


//==============================================================================
// 글자 속성 줄.
//==============================================================================
/**
 * @param { HTMLElement } parentElement
 * @param { string } labelText
 * @param { string } currentText
 * @param { function(string): void } applyCallback
 * @param { Function } beginEditCallback
 * @returns { HTMLElement }
 */
export function appendEditorTextRow(parentElement, labelText, currentText, applyCallback, beginEditCallback) {
	const rowElement = createEditorPropertyRowElement(parentElement, labelText);
	const inputElement = PaneStyle.create("input", "input", { type: "text" });
	inputElement.style.position = "relative";
	inputElement.style.width = "100%";
	inputElement.value = currentText;
	inputElement.addEventListener("change", () => {
		if (beginEditCallback) {
			beginEditCallback();
		}
		applyCallback(inputElement.value);
	});
	inputElement.addEventListener("keydown", (keyboardEvent) => {
		if (keyboardEvent.key === "Enter") {
			inputElement.blur();
		}
		keyboardEvent.stopPropagation();
	});
	rowElement.appendChild(inputElement);
	return rowElement;
}


//==============================================================================
// 색상 속성 줄. (16진 색 + 불투명도)
//==============================================================================
/**
 * @param { HTMLElement } parentElement
 * @param { string } labelText
 * @param { string } hexText - "#rrggbb"
 * @param { number } alphaValue - 0 ~ 1
 * @param { function(string, number): void } applyCallback
 * @param { Function } beginEditCallback
 * @returns { HTMLElement }
 */
export function appendEditorColorRow(parentElement, labelText, hexText, alphaValue, applyCallback, beginEditCallback) {
	const rowElement = createEditorPropertyRowElement(parentElement, labelText);
	const colorInputElement = PaneStyle.create("input", "", { type: "color" });
	colorInputElement.style.cssText = "position:relative;width:34px;height:22px;padding:0;border:1px solid "
		+ PaneTheme.color.border + ";background:transparent;cursor:pointer;flex-shrink:0;";
	colorInputElement.value = hexText;

	const alphaInputElement = PaneStyle.create("input", "input", { type: "text" });
	alphaInputElement.style.position = "relative";
	alphaInputElement.style.width = "100%";
	alphaInputElement.value = alphaValue.toFixed(2);

	const commitColor = () => {
		const parsedAlpha = System.Number(alphaInputElement.value);
		const clampedAlpha = System.Number.isFinite(parsedAlpha) ? System.Math.max(0, System.Math.min(1, parsedAlpha)) : alphaValue;
		if (beginEditCallback) {
			beginEditCallback();
		}
		applyCallback(colorInputElement.value, clampedAlpha);
	};
	colorInputElement.addEventListener("input", commitColor);
	alphaInputElement.addEventListener("change", commitColor);
	alphaInputElement.addEventListener("keydown", (keyboardEvent) => {
		keyboardEvent.stopPropagation();
	});

	rowElement.appendChild(colorInputElement);
	rowElement.appendChild(alphaInputElement);
	return rowElement;
}


//==============================================================================
// 참 거짓 속성 줄.
//==============================================================================
/**
 * @param { HTMLElement } parentElement
 * @param { string } labelText
 * @param { boolean } currentValue
 * @param { function(boolean): void } changeHandler
 * @param { Function } beginEditCallback
 * @returns { HTMLElement }
 */
export function appendEditorBooleanRow(parentElement, labelText, currentValue, changeHandler, beginEditCallback) {
	const rowElement = createEditorPropertyRowElement(parentElement, labelText);
	const checkElement = System.document.createElement("input");
	checkElement.type = "checkbox";
	checkElement.checked = currentValue;
	checkElement.style.cssText = "width:14px;height:14px;accent-color:" + EditorTheme.accentColor + ";cursor:pointer;";
	checkElement.addEventListener("change", () => {
		if (beginEditCallback) {
			beginEditCallback();
		}
		changeHandler(checkElement.checked);
	});
	rowElement.appendChild(checkElement);
	return rowElement;
}


//==============================================================================
// 선택 목록 속성 줄.
//==============================================================================
/**
 * @param { HTMLElement } parentElement
 * @param { string } labelText
 * @param { string[] } optionList
 * @param { string } currentValue
 * @param { function(string): void } changeHandler
 * @returns { HTMLElement }
 */
export function appendEditorSelectRow(parentElement, labelText, optionList, currentValue, changeHandler) {
	const rowElement = createEditorPropertyRowElement(parentElement, labelText);
	const selectElement = System.document.createElement("select");
	selectElement.style.cssText = "flex:1;min-width:0;height:24px;box-sizing:border-box;padding:0 4px;"
		+ "font-family:" + EditorTheme.fontFamily + ";font-size:13px;border-radius:3px;outline:none;"
		+ "background:" + PaneTheme.color.inputBg + ";color:" + PaneTheme.color.text + ";"
		+ "border:1px solid " + EditorTheme.borderColor + ";cursor:pointer;";
	for (const optionValue of optionList) {
		const optionElement = System.document.createElement("option");
		optionElement.value = optionValue;
		optionElement.textContent = optionValue;
		selectElement.appendChild(optionElement);
	}
	selectElement.value = currentValue;
	selectElement.addEventListener("change", () => {
		changeHandler(selectElement.value);
	});
	rowElement.appendChild(selectElement);
	return rowElement;
}


//==============================================================================
// 도구 창 공통 조립. (메뉴 막대 + 본문 + 상태줄)
//==============================================================================
/**
 * @param { object[] } menuDefinitions
 * @param { Pane } mainPane
 * @returns { { rootPane: Pane, statusTextElement: HTMLElement } }
 */
export function buildEditorWindowLayout(menuDefinitions, mainPane) {
	const rootPane = new Pane({ direction: "vertical" });

	const menuBarPane = new Pane({ size: 30, minSize: 30, maxSize: 30, isResizable: false });
	const menuBarElement = createEditorMenuBarElement(menuDefinitions);
	menuBarPane.getContainer().appendChild(menuBarElement);

	const statusPane = new Pane({ size: 24, minSize: 24, maxSize: 24, isResizable: false });
	const statusBarParts = createEditorStatusBarElement();
	statusPane.getContainer().appendChild(statusBarParts.statusBarElement);

	rootPane.addPane(menuBarPane);
	rootPane.addPane(mainPane);
	rootPane.addPane(statusPane);
	return { rootPane: rootPane, statusTextElement: statusBarParts.statusTextElement };
}
