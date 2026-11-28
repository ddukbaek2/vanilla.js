//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2, Color, UIDocument } from "../../import.js";
import { ASSET_DRAG_TYPE } from "./projectpanel.js";
import { SpriteDrawMode, SpriteBlendMode } from "../../src/core/component/sprite.js";
import { TextAlign, TextBaseline } from "../../src/core/component/text.js";
import { ButtonMotionStyle } from "../../src/ui/buttonmotion.js";
import { ProgressDirection } from "../../src/ui/uiprogressview.js";
import { ScrollMode } from "../../src/ui/uiscrollview.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 인스펙터에서 감추는 컴포넌트 속성. (변환 칸에 따로 있거나 편집할 뜻이 없는 것)
const HIDDEN_PROPERTY_NAMES = new System.Set([
	"Active", "Enabled", "Name", "Image", "Font", "Visible", "Dirty", "GizmoVisible", "ComponentType",
]);

// 정해진 값 가운데 고르는 속성. (속성 이름 → 고를 수 있는 값 목록, 고르기 칸으로 보인다)
const ENUM_VALUES_BY_PROPERTY = {
	SpriteDrawMode: System.Object.values(SpriteDrawMode),
	SpriteBlendMode: System.Object.values(SpriteBlendMode),
	TextAlign: System.Object.values(TextAlign),
	TextBaseline: System.Object.values(TextBaseline),
	TextDirection: ["inherit", "ltr", "rtl", "auto"],
	WrapMode: ["word", "char"],
	Style: System.Object.values(ButtonMotionStyle),
	Direction: System.Object.values(ProgressDirection),
	ScrollMode: System.Object.values(ScrollMode),
};


//==============================================================================
// 0 ~ 1 색을 #rrggbb 로.
//==============================================================================
/**
 * @param { Color } color
 * @returns { string }
 */
function colorToHexText(color) {
	const toHex = (value) => {
		const byteValue = System.Math.max(0, System.Math.min(255, System.Math.round(value * 255)));
		return byteValue.toString(16).padStart(2, "0");
	};
	return `#${toHex(color.red)}${toHex(color.green)}${toHex(color.blue)}`;
}

//==============================================================================
// #rrggbb 와 알파로 색.
//==============================================================================
/**
 * @param { string } hexText
 * @param { number } alpha
 * @returns { Color }
 */
function hexTextToColor(hexText, alpha) {
	const red = System.parseInt(hexText.substring(1, 3), 16) / 255;
	const green = System.parseInt(hexText.substring(3, 5), 16) / 255;
	const blue = System.parseInt(hexText.substring(5, 7), 16) / 255;
	return new Color(red, green, blue, alpha);
}

//==============================================================================
// 숫자를 칸에 보일 글로. (소수 넷째 자리까지)
//==============================================================================
/**
 * @param { number } value
 * @returns { string }
 */
function formatNumber(value) {
	return System.String(System.Math.round(value * 10000) / 10000);
}


//==============================================================================
// 인스펙터 패널. (고른 노드의 이름, 켜기, 변환, 컴포넌트 속성)
// - 컴포넌트 속성은 UIDocument.getReflectedProperties 로 모은 짝 맞는 get/set 이다.
//   값이 숫자, 글, 참거짓, Color, Vector2 이면 칸을 만든다. 그 밖의 값은 건너뛴다.
// - 값을 바꾸면 change(설명, 적용 함수) 알림으로 넘긴다. 되돌리기 기록은 에디터가 맡는다.
// - Sprite 의 그림은 프로젝트 패널의 그림 애셋을 끌어다 놓아 바꾼다.
//==============================================================================
export class InspectorPanel {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { HTMLElement } */ #bodyElement;
	/** @private @type { object | null } */ #node;
	/** @private @type { object } */ #eventHandlers; // { change(label, apply), readImage(path), addComponent(node, typeName), removeComponent(node, component), readComponentTypeNames() }
	/** @private @type { Array<function(): void> } */ #refreshList; // 칸마다 지금 값으로 다시 채우는 함수.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { HTMLElement } bodyElement
	 * @param { object } eventHandlers
	 */
	constructor(bodyElement, eventHandlers) {
		this.#bodyElement = bodyElement;
		this.#node = null;
		this.#eventHandlers = eventHandlers;
		this.#refreshList = [];
	}

	//==============================================================================
	// 노드로 다시 짓기. (null 이면 빈 안내)
	//==============================================================================
	/**
	 * @param { object | null } node
	 */
	render(node) {
		this.#node = node;
		this.#refreshList = [];
		const bodyElement = this.#bodyElement;
		bodyElement.textContent = "";
		if (node === null) {
			const noticeElement = System.document.createElement("div");
			noticeElement.className = "emptyNotice";
			noticeElement.textContent = "하이어라키나 씬 뷰에서 노드를 고르면 여기에서 편집한다.";
			bodyElement.append(noticeElement);
			return;
		}
		this.renderNodeSection(node);
		this.renderTransformSection(node);
		for (const component of node.getAllComponents()) {
			this.renderComponentSection(node, component);
		}
		this.renderAddComponent(node);
	}

	//==============================================================================
	// 칸 값만 다시 채우기. (손잡이로 끄는 동안처럼 구조는 그대로일 때, 포커스된 칸은 건드리지 않는다)
	//==============================================================================
	refresh() {
		for (const refreshFunction of this.#refreshList) {
			refreshFunction();
		}
	}

	//==============================================================================
	// 노드 칸. (켜기와 이름)
	//==============================================================================
	/**
	 * @param { object } node
	 */
	renderNodeSection(node) {
		const sectionElement = this.createSection("", null);
		const headerElement = sectionElement.firstChild;
		const activeElement = System.document.createElement("input");
		activeElement.type = "checkbox";
		activeElement.checked = node.isActive();
		activeElement.addEventListener("change", () => {
			const isActive = activeElement.checked;
			this.#eventHandlers.change("노드 켜기", () => {
				node.setActive(isActive);
			});
		});
		const nameElement = System.document.createElement("input");
		nameElement.className = "inspectorNameInput";
		nameElement.value = node.getName();
		nameElement.addEventListener("change", () => {
			const name = nameElement.value;
			this.#eventHandlers.change("이름 바꾸기", () => {
				node.setName(name);
			});
		});
		this.stopKeys(nameElement);
		headerElement.textContent = "";
		headerElement.append(activeElement, nameElement);
		this.#refreshList.push(() => {
			activeElement.checked = node.isActive();
			if (System.document.activeElement !== nameElement) {
				nameElement.value = node.getName();
			}
		});
	}

	//==============================================================================
	// 변환 칸. (위치, 회전, 크기, 피봇, 앵커, 내용 크기, 불투명도)
	//==============================================================================
	/**
	 * @param { object } node
	 */
	renderTransformSection(node) {
		const sectionElement = this.createSection("Transform", null);
		const sectionBody = sectionElement.lastChild;
		sectionBody.append(
			this.createVectorRow("Position", () => node.getLocalPosition(), (value) => node.setLocalPosition(value)),
			this.createNumberRow("Rotation", () => node.getLocalRotation(), (value) => node.setLocalRotation(value)),
			this.createVectorRow("Scale", () => node.getLocalScale(), (value) => node.setLocalScale(value)),
			this.createVectorRow("Content Size", () => node.getContentSize(), (value) => node.setContentSize(value)),
			this.createVectorRow("Pivot", () => node.getPivot(), (value) => node.setPivot(value)),
			this.createVectorRow("Anchor", () => node.getAnchor(), (value) => node.setAnchor(value)),
			this.createNumberRow("Opacity", () => node.getLocalOpacity(), (value) => node.setLocalOpacity(value)),
			this.createBooleanRow("Interactable", () => node.isInteractable(), (value) => node.setInteractable(value)),
		);
	}

	//==============================================================================
	// 컴포넌트 칸. (반사로 모은 속성, Sprite 면 그림 칸)
	//==============================================================================
	/**
	 * @param { object } node
	 * @param { object } component
	 */
	renderComponentSection(node, component) {
		const typeName = component.constructor.name;
		const removeButton = System.document.createElement("button");
		removeButton.className = "smallButton";
		removeButton.textContent = "✕";
		removeButton.title = "컴포넌트 빼기";
		removeButton.addEventListener("click", () => {
			this.#eventHandlers.removeComponent(node, component);
		});
		const sectionElement = this.createSection(typeName, removeButton);
		const sectionBody = sectionElement.lastChild;
		if (typeof component.setImage === "function" && typeof component.getImagePath === "function") {
			sectionBody.append(this.createImageRow(component));
		}
		const propertyList = UIDocument.getReflectedProperties(component);
		for (const property of propertyList) {
			if (HIDDEN_PROPERTY_NAMES.has(property.name)) {
				continue;
			}
			let currentValue = undefined;
			try {
				currentValue = component[property.getterName]();
			}
			catch (exception) {
				continue;
			}
			const getter = () => component[property.getterName]();
			const setter = (value) => component[property.setterName](value);
			const label = this.splitWords(property.name);
			let rowElement = null;
			if (typeof currentValue === "number") {
				rowElement = this.createNumberRow(label, getter, setter);
			}
			else if (typeof currentValue === "string" && ENUM_VALUES_BY_PROPERTY[property.name] !== undefined) {
				rowElement = this.createEnumRow(label, ENUM_VALUES_BY_PROPERTY[property.name], getter, setter);
			}
			else if (typeof currentValue === "string") {
				rowElement = this.createTextRow(label, getter, setter);
			}
			else if (typeof currentValue === "boolean") {
				rowElement = this.createBooleanRow(label, getter, setter);
			}
			else if (currentValue instanceof Color) {
				rowElement = this.createColorRow(label, getter, setter);
			}
			else if (currentValue instanceof Vector2) {
				rowElement = this.createVectorRow(label, getter, setter);
			}
			if (rowElement !== null) {
				sectionBody.append(rowElement);
			}
		}
	}

	//==============================================================================
	// 컴포넌트 더하기 줄.
	//==============================================================================
	/**
	 * @param { object } node
	 */
	renderAddComponent(node) {
		const selectElement = System.document.createElement("select");
		selectElement.className = "smallButton wideButton";
		const placeholderOption = System.document.createElement("option");
		placeholderOption.textContent = "＋ 컴포넌트 더하기";
		placeholderOption.value = "";
		selectElement.append(placeholderOption);
		for (const typeName of this.#eventHandlers.readComponentTypeNames()) {
			const optionElement = System.document.createElement("option");
			optionElement.textContent = typeName;
			optionElement.value = typeName;
			selectElement.append(optionElement);
		}
		selectElement.addEventListener("change", () => {
			const typeName = selectElement.value;
			selectElement.value = "";
			if (typeName !== "") {
				this.#eventHandlers.addComponent(node, typeName);
			}
		});
		this.#bodyElement.append(selectElement);
	}

	//==============================================================================
	// 칸 묶음 만들기. (머리와 몸, 몸은 lastChild)
	//==============================================================================
	/**
	 * @param { string } title
	 * @param { HTMLElement | null } headerExtraElement
	 * @returns { HTMLElement }
	 */
	createSection(title, headerExtraElement) {
		const sectionElement = System.document.createElement("div");
		sectionElement.className = "inspectorSection";
		const headerElement = System.document.createElement("div");
		headerElement.className = "inspectorSectionHeader";
		const titleElement = System.document.createElement("span");
		titleElement.className = "sectionTitle";
		titleElement.textContent = title;
		headerElement.append(titleElement);
		if (headerExtraElement !== null) {
			headerElement.append(headerExtraElement);
		}
		const bodyElement = System.document.createElement("div");
		bodyElement.className = "inspectorSectionBody";
		sectionElement.append(headerElement, bodyElement);
		this.#bodyElement.append(sectionElement);
		return sectionElement;
	}

	//==============================================================================
	// 이름표와 입력 자리가 있는 한 줄.
	//==============================================================================
	/**
	 * @param { string } label
	 * @returns { { rowElement: HTMLElement, inputsElement: HTMLElement } }
	 */
	createRow(label) {
		const rowElement = System.document.createElement("div");
		rowElement.className = "fieldRow";
		const labelElement = System.document.createElement("div");
		labelElement.className = "fieldLabel";
		labelElement.textContent = label;
		labelElement.title = label;
		const inputsElement = System.document.createElement("div");
		inputsElement.className = "fieldInputs";
		rowElement.append(labelElement, inputsElement);
		return { rowElement: rowElement, inputsElement: inputsElement };
	}

	//==============================================================================
	// 숫자 칸. (이름표를 좌우로 끌면 값이 바뀐다)
	//==============================================================================
	/**
	 * @param { string } label
	 * @param { function(): number } getter
	 * @param { function(number): void } setter
	 * @returns { HTMLElement }
	 */
	createNumberRow(label, getter, setter) {
		const { rowElement, inputsElement } = this.createRow(label);
		const inputElement = this.createNumberInput(getter(), (value) => {
			this.#eventHandlers.change(label, () => {
				setter(value);
			});
		});
		inputsElement.append(inputElement);
		this.attachLabelDrag(rowElement.firstChild, () => getter(), (value) => {
			this.#eventHandlers.change(label, () => {
				setter(value);
			});
		});
		this.#refreshList.push(() => {
			if (System.document.activeElement !== inputElement) {
				inputElement.value = formatNumber(getter());
			}
		});
		return rowElement;
	}

	//==============================================================================
	// Vector2 칸. (X, Y)
	//==============================================================================
	/**
	 * @param { string } label
	 * @param { function(): Vector2 } getter
	 * @param { function(Vector2): void } setter
	 * @returns { HTMLElement }
	 */
	createVectorRow(label, getter, setter) {
		const { rowElement, inputsElement } = this.createRow(label);
		const value = getter();
		const xInput = this.createNumberInput(value.x, (nextX) => {
			const currentValue = getter();
			this.#eventHandlers.change(label, () => {
				setter(Vector2.create(nextX, currentValue.y));
			});
		});
		const yInput = this.createNumberInput(value.y, (nextY) => {
			const currentValue = getter();
			this.#eventHandlers.change(label, () => {
				setter(Vector2.create(currentValue.x, nextY));
			});
		});
		const xAxis = System.document.createElement("span");
		xAxis.className = "fieldAxis";
		xAxis.textContent = "X";
		const yAxis = System.document.createElement("span");
		yAxis.className = "fieldAxis";
		yAxis.textContent = "Y";
		inputsElement.append(xAxis, xInput, yAxis, yInput);
		this.#refreshList.push(() => {
			const currentValue = getter();
			if (System.document.activeElement !== xInput) {
				xInput.value = formatNumber(currentValue.x);
			}
			if (System.document.activeElement !== yInput) {
				yInput.value = formatNumber(currentValue.y);
			}
		});
		return rowElement;
	}

	//==============================================================================
	// 글 칸.
	//==============================================================================
	/**
	 * @param { string } label
	 * @param { function(): string } getter
	 * @param { function(string): void } setter
	 * @returns { HTMLElement }
	 */
	createTextRow(label, getter, setter) {
		const { rowElement, inputsElement } = this.createRow(label);
		const inputElement = System.document.createElement("input");
		inputElement.type = "text";
		inputElement.value = getter();
		inputElement.addEventListener("change", () => {
			const text = inputElement.value;
			this.#eventHandlers.change(label, () => {
				setter(text);
			});
		});
		this.stopKeys(inputElement);
		inputsElement.append(inputElement);
		this.#refreshList.push(() => {
			if (System.document.activeElement !== inputElement) {
				inputElement.value = getter();
			}
		});
		return rowElement;
	}

	//==============================================================================
	// 고르기 칸. (정해진 값 가운데, 지금 값이 목록에 없으면 덧붙여 보인다)
	//==============================================================================
	/**
	 * @param { string } label
	 * @param { Array<string> } valueList
	 * @param { function(): string } getter
	 * @param { function(string): void } setter
	 * @returns { HTMLElement }
	 */
	createEnumRow(label, valueList, getter, setter) {
		const { rowElement, inputsElement } = this.createRow(label);
		const selectElement = System.document.createElement("select");
		const currentValue = getter();
		const optionValueList = valueList.includes(currentValue) ? valueList : [currentValue, ...valueList];
		for (const optionValue of optionValueList) {
			const optionElement = System.document.createElement("option");
			optionElement.value = optionValue;
			optionElement.textContent = optionValue;
			selectElement.append(optionElement);
		}
		selectElement.value = currentValue;
		selectElement.addEventListener("change", () => {
			const selectedValue = selectElement.value;
			this.#eventHandlers.change(label, () => {
				setter(selectedValue);
			});
		});
		inputsElement.append(selectElement);
		this.#refreshList.push(() => {
			selectElement.value = getter();
		});
		return rowElement;
	}

	//==============================================================================
	// 참거짓 칸.
	//==============================================================================
	/**
	 * @param { string } label
	 * @param { function(): boolean } getter
	 * @param { function(boolean): void } setter
	 * @returns { HTMLElement }
	 */
	createBooleanRow(label, getter, setter) {
		const { rowElement, inputsElement } = this.createRow(label);
		const inputElement = System.document.createElement("input");
		inputElement.type = "checkbox";
		inputElement.checked = getter();
		inputElement.addEventListener("change", () => {
			const isChecked = inputElement.checked;
			this.#eventHandlers.change(label, () => {
				setter(isChecked);
			});
		});
		inputsElement.append(inputElement);
		this.#refreshList.push(() => {
			inputElement.checked = getter();
		});
		return rowElement;
	}

	//==============================================================================
	// 색 칸. (색 고르기와 알파)
	//==============================================================================
	/**
	 * @param { string } label
	 * @param { function(): Color } getter
	 * @param { function(Color): void } setter
	 * @returns { HTMLElement }
	 */
	createColorRow(label, getter, setter) {
		const { rowElement, inputsElement } = this.createRow(label);
		const color = getter();
		const colorInput = System.document.createElement("input");
		colorInput.type = "color";
		colorInput.value = colorToHexText(color);
		const alphaInput = this.createNumberInput(color.alpha, (alpha) => {
			const hexText = colorInput.value;
			this.#eventHandlers.change(label, () => {
				setter(hexTextToColor(hexText, System.Math.max(0, System.Math.min(1, alpha))));
			});
		});
		alphaInput.step = "0.05";
		alphaInput.title = "알파";
		colorInput.addEventListener("change", () => {
			const hexText = colorInput.value;
			const alpha = getter().alpha;
			this.#eventHandlers.change(label, () => {
				setter(hexTextToColor(hexText, alpha));
			});
		});
		inputsElement.append(colorInput, alphaInput);
		this.#refreshList.push(() => {
			const currentColor = getter();
			colorInput.value = colorToHexText(currentColor);
			if (System.document.activeElement !== alphaInput) {
				alphaInput.value = formatNumber(currentColor.alpha);
			}
		});
		return rowElement;
	}

	//==============================================================================
	// 그림 칸. (그림 애셋을 끌어다 놓으면 바뀐다, 크기 맞추기 단추)
	//==============================================================================
	/**
	 * @param { object } component
	 * @returns { HTMLElement }
	 */
	createImageRow(component) {
		const { rowElement, inputsElement } = this.createRow("Image");
		const dropElement = System.document.createElement("div");
		dropElement.className = "dropField";
		dropElement.textContent = component.getImagePath() || "그림 애셋을 끌어다 놓기";
		dropElement.addEventListener("dragover", (dragEvent) => {
			if (dragEvent.dataTransfer.types.includes(ASSET_DRAG_TYPE)) {
				dragEvent.preventDefault();
				dropElement.classList.add("isDropTarget");
			}
		});
		dropElement.addEventListener("dragleave", () => {
			dropElement.classList.remove("isDropTarget");
		});
		dropElement.addEventListener("drop", (dragEvent) => {
			dropElement.classList.remove("isDropTarget");
			const path = dragEvent.dataTransfer.getData(ASSET_DRAG_TYPE);
			const image = this.#eventHandlers.readImage(path);
			if (image === null) {
				return;
			}
			dragEvent.preventDefault();
			this.#eventHandlers.change("그림 바꾸기", () => {
				component.setImagePath(path);
				component.setImage(image);
			});
		});
		const fitButton = System.document.createElement("button");
		fitButton.className = "smallButton";
		fitButton.textContent = "원래 크기";
		fitButton.title = "노드의 내용 크기를 그림 크기로";
		fitButton.addEventListener("click", () => {
			const image = component.getImagePath() ? this.#eventHandlers.readImage(component.getImagePath()) : null;
			const node = this.#node;
			if (image === null || node === null) {
				return;
			}
			this.#eventHandlers.change("원래 크기", () => {
				node.setContentSize(Vector2.create(image.naturalWidth, image.naturalHeight));
			});
		});
		inputsElement.append(dropElement, fitButton);
		return rowElement;
	}

	//==============================================================================
	// 숫자 입력 만들기. (Enter 나 포커스를 잃으면 적용)
	//==============================================================================
	/**
	 * @param { number } value
	 * @param { function(number): void } commit
	 * @returns { HTMLInputElement }
	 */
	createNumberInput(value, commit) {
		const inputElement = System.document.createElement("input");
		inputElement.type = "number";
		inputElement.step = "any";
		inputElement.value = formatNumber(value);
		inputElement.addEventListener("change", () => {
			const parsedValue = System.parseFloat(inputElement.value);
			if (System.Number.isFinite(parsedValue)) {
				commit(parsedValue);
			}
		});
		this.stopKeys(inputElement);
		return inputElement;
	}

	//==============================================================================
	// 이름표 끌기로 숫자 바꾸기. (한 번 끄는 것이 되돌리기 한 칸)
	//==============================================================================
	/**
	 * @param { HTMLElement } labelElement
	 * @param { function(): number } getter
	 * @param { function(number): void } commit
	 */
	attachLabelDrag(labelElement, getter, commit) {
		labelElement.style.cursor = "ew-resize";
		labelElement.addEventListener("pointerdown", (pointerEvent) => {
			const startX = pointerEvent.clientX;
			const startValue = getter();
			const step = pointerEvent.shiftKey ? 0.01 : (System.Math.abs(startValue) < 2 ? 0.01 : 1);
			labelElement.setPointerCapture(pointerEvent.pointerId);
			const moveListener = (moveEvent) => {
				const deltaX = moveEvent.clientX - startX;
				commit(startValue + deltaX * step);
				this.refresh();
			};
			const upListener = () => {
				labelElement.removeEventListener("pointermove", moveListener);
				labelElement.removeEventListener("pointerup", upListener);
			};
			labelElement.addEventListener("pointermove", moveListener);
			labelElement.addEventListener("pointerup", upListener);
		});
	}

	//==============================================================================
	// 글 칸에서 누른 키가 에디터 단축키로 새지 않게.
	//==============================================================================
	/**
	 * @param { HTMLElement } inputElement
	 */
	stopKeys(inputElement) {
		inputElement.addEventListener("keydown", (keyboardEvent) => {
			keyboardEvent.stopPropagation();
		});
	}

	//==============================================================================
	// "FontSize" → "Font Size".
	//==============================================================================
	/**
	 * @param { string } name
	 * @returns { string }
	 */
	splitWords(name) {
		return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
	}
}
