//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { WorldNode } from "../core/node/worldnode.js";
import { Vector2 } from "../base/vector2.js";
import { Color } from "../base/color.js";
import { Pivot } from "../base/pivot.js";
import * as Math from "../base/math.js";
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
/**
 * @example <caption>화질 고르기 드롭다운</caption>
 * import { Engine, EngineConfiguration, UIScene, UIDropdown, Color, Vector2 } from "./build/vanilla.js";
 *
 * class DropdownScene extends UIScene {
 * 	create() {
 * 		super.create();
 * 		const dropdown = new UIDropdown({ width: 200, height: 32, fontSize: 14, highlightColor: new Color(0.3, 0.8, 1, 0.3) });
 * 		dropdown.setOptionList(["Low", "Medium", "High", "Ultra"]);
 * 		dropdown.setSelectedIndex(2);
 * 		dropdown.setChangedEvent((self) => {
 * 			const selectedText = self.getSelectedText();
 * 			console.log(selectedText);
 * 		});
 * 		dropdown.setLocalPosition(Vector2.create(220, 80));
 * 		const root = this.getRoot();
 * 		root.addChild(dropdown);
 * 		dropdown.setOpen(true);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * const scene = new DropdownScene();
 * scene.setLoadingMinDurationMs(0);
 * engine.run(scene);
 */
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

		// 머리 단추 틴트가 펼침 목록 행까지 닿지 않게 한다. (닿으면 머리 단추가 눌렀을 때 담아 둔 옛 행 색을 매 tick 다시 써서 선택 강조가 덮인다)
		headerButton.excludeNodeFromTint(this.#popupNode);
	}

	//==============================================================================
	// 선택지 목록 설정. (펼침 목록 행을 다시 만든다)
	//==============================================================================
	/**
	 * @param { string[] } optionList 선택지 글 목록. (복사해 쥔다, 선택 순서가 목록 밖이면 마지막으로 줄인다)
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
	 * @param { number } optionIndex 고를 선택지 순서. (목록 밖이면 아무것도 하지 않는다, 고르면 목록을 접고 바뀌었을 때만 changedEvent 를 부른다)
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
	// - 펼칠 때 목록을 트리 뿌리로 옮겨 나중에 그려지는 형제 노드에 가려지지 않게 한다. (접으면 되돌린다)
	//==============================================================================
	/**
	 * @param { boolean } isOpen 참이면 펼친다.
	 */
	setOpen(isOpen) {
		this.#isOpen = isOpen;
		if (isOpen) {
			this.attachPopupToRoot();
		}
		else {
			this.detachPopupFromRoot();
		}
		this.#popupNode.setActive(isOpen);
		this.#arrowLabel.setText(isOpen ? "▴" : "▾");
	}

	//==============================================================================
	// 펼침 목록을 트리 뿌리로 이동. (머리 단추 아래 월드 위치를 뿌리 로컬 좌표로 환산)
	//==============================================================================
	/**
	 * @private
	 */
	attachPopupToRoot() {
		let rootNode = this;
		while (rootNode.getParent()) {
			rootNode = rootNode.getParent();
		}
		if (rootNode === this || !(rootNode instanceof WorldNode)) {
			return;
		}
		const worldCorners = this.getWorldCorners();
		const bottomLeft = worldCorners[3];
		const rootPosition = rootNode.getPosition();
		const rootContentSize = rootNode.getContentSize();
		const rootPivot = rootNode.getPivot();
		const rootScale = rootNode.getScale();
		const rootRadian = Math.degreeToRadian(rootNode.getRotation());
		const cosRadian = Math.cos(rootRadian);
		const sinRadian = Math.sin(rootRadian);
		const offsetX = bottomLeft.x - rootPosition.x;
		const offsetY = bottomLeft.y + 4 - rootPosition.y;
		const unrotatedX = offsetX * cosRadian + offsetY * sinRadian;
		const unrotatedY = -offsetX * sinRadian + offsetY * cosRadian;
		const safeScaleX = rootScale.x !== 0 ? rootScale.x : 1;
		const safeScaleY = rootScale.y !== 0 ? rootScale.y : 1;
		const localX = unrotatedX / safeScaleX + rootContentSize.x * rootPivot.x;
		const localY = unrotatedY / safeScaleY + rootContentSize.y * rootPivot.y;
		this.removeChild(this.#popupNode);
		rootNode.addChild(this.#popupNode);
		this.#popupNode.setLocalPosition(Vector2.create(localX, localY));
	}

	//==============================================================================
	// 펼침 목록을 머리 단추 아래로 되돌림.
	//==============================================================================
	/**
	 * @private
	 */
	detachPopupFromRoot() {
		const popupParent = this.#popupNode.getParent();
		if (popupParent === this) {
			return;
		}
		if (popupParent) {
			popupParent.removeChild(this.#popupNode);
		}
		this.addChild(this.#popupNode);
		const contentSize = this.getContentSize();
		this.#popupNode.setLocalPosition(Vector2.create(0, contentSize.y + 4));
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
			// 행 단추가 틴트 원래 색을 새 강조 색으로 다시 담게 한다. (다시 펼쳤을 때 옛 색으로 덮지 않게)
			const rowButton = rowList[rowIndex].getComponent(UIButton);
			if (rowButton) {
				rowButton.collectColorTargets();
			}
		}
	}

	//==============================================================================
	// 설정 / 조회 메서드 목록.
	//==============================================================================

	//==============================================================================
	// 선택이 바뀌었을 때 처리기 설정. (selectIndex 로 다른 것을 골랐을 때만, setSelectedIndex 로는 부르지 않는다)
	//==============================================================================
	/**
	 * @param { Function } changedEvent (self)
	 * @example <caption>고른 선택지 받기</caption>
	 * import { UIDropdown } from "./build/vanilla.js";
	 *
	 * const dropdown = new UIDropdown({ width: 160 });
	 * dropdown.setOptionList(["Low", "Medium", "High"]);
	 * dropdown.setChangedEvent((self) => {
	 * 	const selectedText = self.getSelectedText();
	 * 	console.log(selectedText);
	 * });
	 * dropdown.setSelectedIndex(1);
	 * dropdown.selectIndex(2);
	 */
	setChangedEvent(changedEvent) {
		this.#changedEvent = changedEvent;
	}

	//==============================================================================
	// 선택 순서 설정. (처리기를 부르지 않고 머리 글과 강조만 바꾼다)
	//==============================================================================
	/** @param { number } selectedIndex 선택 순서. (0 ~ 선택지 수 - 1 로 자른다) */
	setSelectedIndex(selectedIndex) {
		this.#selectedIndex = System.Math.max(0, System.Math.min(selectedIndex, this.#optionList.length - 1));
		this.refreshHeader();
		this.refreshHighlight();
	}

	//==============================================================================
	// 선택 순서 반환.
	//==============================================================================
	/** @returns { number } 선택 순서. (선택지가 없어도 0) */
	getSelectedIndex() {
		return this.#selectedIndex;
	}

	//==============================================================================
	// 고른 선택지 글 반환.
	//==============================================================================
	/** @returns { string } 고른 선택지 글. (선택지가 없으면 빈 글) */
	getSelectedText() {
		const selectedText = this.#optionList[this.#selectedIndex];
		return selectedText !== undefined ? selectedText : "";
	}

	//==============================================================================
	// 펼쳐져 있는지 반환.
	//==============================================================================
	/** @returns { boolean } 펼쳐져 있으면 참. */
	isOpen() {
		return this.#isOpen;
	}

	//==============================================================================
	// 선택지 목록 반환.
	//==============================================================================
	/**
	 * @returns { string[] } 선택지 글 목록. (setOptionList 로 준 차례, 고쳐 쓰지 않는다)
	 */
	getOptionList() {
		return this.#optionList;
	}

	//==============================================================================
	// 펼침 목록 노드 반환. (펼친 동안은 트리 뿌리의 자식)
	//==============================================================================
	/**
	 * @returns { WorldNode } 펼침 목록 노드.
	 */
	getPopupNode() {
		return this.#popupNode;
	}

	//==============================================================================
	// 선택지 행 노드 목록 반환. (선택지 차례, setOptionList 마다 다시 만든다)
	//==============================================================================
	/**
	 * @returns { WorldNode[] } 행 노드. (새 배열)
	 * @example <caption>선택지 행 노드를 읽어 둘째 행을 누른 것처럼 고르기</caption>
	 * import { UIDropdown } from "./build/vanilla.js";
	 *
	 * const dropdown = new UIDropdown({ width: 160 });
	 * dropdown.setOptionList(["Low", "Medium", "High"]);
	 * const optionNodes = dropdown.getOptionNodes();
	 * console.log(optionNodes.length, optionNodes[1].getName(), dropdown.getOptionList()[1]);
	 * dropdown.selectIndex(1);
	 * console.log(dropdown.getSelectedText());
	 */
	getOptionNodes() {
		return this.#popupNode.getChildren().slice();
	}
}
