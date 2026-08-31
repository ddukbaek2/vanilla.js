//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { WorldNode } from "../core/node/worldnode.js";
import { Vector2 } from "../base/vector2.js";
import { Color } from "../base/color.js";
import { Pivot } from "../base/pivot.js";
import { Paint } from "../core/component/paint.js";
import { UILabel } from "./uilabel.js";
import { UIButton } from "./uibutton.js";


//==============================================================================
// 드롭다운. (콤보박스)
// - 닫힌 머리 단추에 현재 값이 보이고, 누르면 아래로 선택지 목록이 펼쳐진다.
// - 사용:
//     const dropdown = new UIDropdown({ width: 180, height: 30 });
//     dropdown.setOptionList(["Dark", "Light", "System"]);
//     dropdown.setChangedEvent((self) => { self.getSelectedText(); });
//     panelNode.addChild(dropdown);
//==============================================================================
export class UIDropdown extends WorldNode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { string[] } */ #optionList;
	/** @private @type { number } */ #selectedIndex;
	/** @private @type { boolean } */ #isOpen;
	/** @private @type { Function | null } */ #changedEvent;
	/** @private @type { UILabel } */ #headerLabel;
	/** @private @type { UILabel } */ #arrowLabel;
	/** @private @type { WorldNode } */ #popupNode;
	/** @private @type { number } */ #optionHeight;
	/** @private @type { Color } */ #popupColor;
	/** @private @type { Color } */ #textColor;
	/** @private @type { Color } */ #highlightColor;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { object } options { width = 180, height = 30, optionHeight = 28, fontSize = 12,
	 *                             baseColor?, popupColor?, highlightColor?, textColor? }
	 */
	constructor(options = {}) {
		super();

		const width = (options.width !== undefined) ? options.width : 180;
		const height = (options.height !== undefined) ? options.height : 30;
		this.#optionHeight = (options.optionHeight !== undefined) ? options.optionHeight : 28;
		const fontSize = (options.fontSize !== undefined) ? options.fontSize : 12;
		const baseColor = options.baseColor ? options.baseColor : new Color(0.114, 0.141, 0.212, 1);
		this.#popupColor = options.popupColor ? options.popupColor : new Color(0.086, 0.106, 0.165, 1);
		this.#highlightColor = options.highlightColor ? options.highlightColor : new Color(0.424, 0.482, 1, 0.25);
		this.#textColor = options.textColor ? options.textColor : new Color(0.91, 0.925, 0.957, 1);

		this.#optionList = [];
		this.#selectedIndex = 0;
		this.#isOpen = false;
		this.#changedEvent = null;

		this.setName("UIDropdown");
		this.setPivot(Pivot.topLeft.clone());
		this.setAnchor(Pivot.topLeft.clone());
		this.setContentSize(Vector2.create(width, height));
		this.setInteractable(true);

		// 머리 단추.
		const headerPaint = this.addComponent(Paint);
		headerPaint.setColor(baseColor);
		headerPaint.setRoundSize(8);
		const headerButton = this.addComponent(UIButton);
		headerButton.setClickedEvent(() => {
			this.setOpen(!this.#isOpen);
		});
		this.#headerLabel = this.addComponent(UILabel);
		this.#headerLabel.setText("");
		this.#headerLabel.setFontSize(fontSize);
		this.#headerLabel.setTextColor(this.#textColor);

		// 펼침 화살표.
		const arrowNode = new WorldNode();
		arrowNode.setName("DropdownArrow");
		arrowNode.setPivot(Pivot.topLeft.clone());
		arrowNode.setAnchor(Pivot.topLeft.clone());
		arrowNode.setContentSize(Vector2.create(20, height));
		arrowNode.setLocalPosition(Vector2.create(width - 22, 0));
		this.#arrowLabel = arrowNode.addComponent(UILabel);
		this.#arrowLabel.setText("▾");
		this.#arrowLabel.setFontSize(fontSize);
		this.#arrowLabel.setTextColor(this.#textColor);
		this.addChild(arrowNode);

		// 펼침 목록. (닫혀 있으면 비활성)
		this.#popupNode = new WorldNode();
		this.#popupNode.setName("DropdownPopup");
		this.#popupNode.setPivot(Pivot.topLeft.clone());
		this.#popupNode.setAnchor(Pivot.topLeft.clone());
		this.#popupNode.setLocalPosition(Vector2.create(0, height + 4));
		this.#popupNode.setActive(false);
		const popupPaint = this.#popupNode.addComponent(Paint);
		popupPaint.setColor(this.#popupColor);
		popupPaint.setRoundSize(8);
		this.addChild(this.#popupNode);
	}

	//==============================================================================
	// 선택지 목록 설정. (펼침 목록 행을 다시 만든다)
	//==============================================================================
	/**
	 * @param { string[] } optionList
	 */
	setOptionList(optionList) {
		this.#optionList = optionList.slice();
		this.#selectedIndex = System.Math.min(this.#selectedIndex, System.Math.max(0, this.#optionList.length - 1));

		// 기존 행 제거.
		const childList = this.#popupNode.getChildren().slice();
		for (const childNode of childList) {
			this.#popupNode.removeChild(childNode);
		}

		const contentSize = this.getContentSize();
		this.#popupNode.setContentSize(Vector2.create(contentSize.x, this.#optionList.length * this.#optionHeight + 8));
		for (let optionIndex = 0; optionIndex < this.#optionList.length; ++optionIndex) {
			const rowNode = new WorldNode();
			rowNode.setName("DropdownOption" + optionIndex);
			rowNode.setPivot(Pivot.topLeft.clone());
			rowNode.setAnchor(Pivot.topLeft.clone());
			rowNode.setContentSize(Vector2.create(contentSize.x - 8, this.#optionHeight));
			rowNode.setLocalPosition(Vector2.create(4, 4 + optionIndex * this.#optionHeight));
			rowNode.setInteractable(true);
			const rowPaint = rowNode.addComponent(Paint);
			rowPaint.setColor(new Color(0, 0, 0, 0));
			rowPaint.setRoundSize(6);
			const rowButton = rowNode.addComponent(UIButton);
			rowButton.setPressedTintColor(new Color(1, 1, 1, 0.08));
			rowButton.setClickedEvent(() => {
				this.selectIndex(optionIndex);
			});
			const rowLabel = rowNode.addComponent(UILabel);
			rowLabel.setText(this.#optionList[optionIndex]);
			rowLabel.setFontSize(this.#headerLabel.getFontSize ? this.#headerLabel.getFontSize() : 12);
			rowLabel.setTextColor(this.#textColor);
			this.#popupNode.addChild(rowNode);
		}
		this.refreshHeader();
		this.refreshHighlight();
	}

	//==============================================================================
	// 선택 처리.
	//==============================================================================
	/**
	 * @param { number } optionIndex
	 */
	selectIndex(optionIndex) {
		if (optionIndex < 0 || optionIndex >= this.#optionList.length) {
			return;
		}
		const isChanged = (this.#selectedIndex !== optionIndex);
		this.#selectedIndex = optionIndex;
		this.setOpen(false);
		this.refreshHeader();
		this.refreshHighlight();
		if (isChanged && this.#changedEvent) {
			this.#changedEvent(this);
		}
	}

	//==============================================================================
	// 펼침 / 접힘.
	//==============================================================================
	/**
	 * @param { boolean } isOpen
	 */
	setOpen(isOpen) {
		this.#isOpen = isOpen;
		this.#popupNode.setActive(isOpen);
		this.#arrowLabel.setText(isOpen ? "▴" : "▾");
	}

	//==============================================================================
	// 머리 글 갱신.
	//==============================================================================
	/**
	 * @private
	 */
	refreshHeader() {
		const selectedText = this.#optionList[this.#selectedIndex];
		this.#headerLabel.setText(selectedText !== undefined ? selectedText : "");
	}

	//==============================================================================
	// 선택 행 강조 갱신.
	//==============================================================================
	/**
	 * @private
	 */
	refreshHighlight() {
		const rowList = this.#popupNode.getChildren();
		for (let rowIndex = 0; rowIndex < rowList.length; ++rowIndex) {
			const paintComponents = rowList[rowIndex].getComponents(Paint);
			if (paintComponents.length > 0) {
				paintComponents[0].setColor(rowIndex === this.#selectedIndex ? this.#highlightColor.clone() : new Color(0, 0, 0, 0));
			}
		}
	}

	//==============================================================================
	// 설정 / 조회 메서드 목록.
	//==============================================================================
	/** @param { Function } changedEvent (self) */
	setChangedEvent(changedEvent) {
		this.#changedEvent = changedEvent;
	}

	/** @param { number } selectedIndex */
	setSelectedIndex(selectedIndex) {
		this.#selectedIndex = System.Math.max(0, System.Math.min(selectedIndex, this.#optionList.length - 1));
		this.refreshHeader();
		this.refreshHighlight();
	}

	/** @returns { number } */
	getSelectedIndex() {
		return this.#selectedIndex;
	}

	/** @returns { string } */
	getSelectedText() {
		const selectedText = this.#optionList[this.#selectedIndex];
		return selectedText !== undefined ? selectedText : "";
	}

	/** @returns { boolean } */
	isOpen() {
		return this.#isOpen;
	}
}
