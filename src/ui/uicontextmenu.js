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
// 컨텍스트 메뉴. (우클릭 / 길게 누름 메뉴)
// - show(position, itemList) 로 항목 목록을 그 자리에 띄운다.
//   바깥을 누르면 닫히고, 항목을 누르면 처리기를 부르고 닫힌다.
// - 씬 뿌리의 맨 위(마지막 자식)에 addChild 해 두고 쓴다.
// - 사용:
//     const contextMenu = new UIContextMenu();
//     scene.getRoot().addChild(contextMenu);
//     contextMenu.show(viewPosition, [
//         { text: "복사", handler: () => {} },
//         { text: "삭제", handler: () => {} },
//     ]);
//==============================================================================
export class UIContextMenu extends WorldNode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WorldNode } */ #overlayNode;
	/** @private @type { WorldNode } */ #panelNode;
	/** @private @type { number } */ #menuWidth;
	/** @private @type { number } */ #itemHeight;
	/** @private @type { number } */ #fontSize;
	/** @private @type { Color } */ #panelColor;
	/** @private @type { Color } */ #textColor;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { object } options { menuWidth = 168, itemHeight = 28, fontSize = 12, panelColor?, textColor? }
	 */
	constructor(options = {}) {
		super();

		this.#menuWidth = (options.menuWidth !== undefined) ? options.menuWidth : 168;
		this.#itemHeight = (options.itemHeight !== undefined) ? options.itemHeight : 28;
		this.#fontSize = (options.fontSize !== undefined) ? options.fontSize : 12;
		this.#panelColor = options.panelColor ? options.panelColor : new Color(0.086, 0.106, 0.165, 1);
		this.#textColor = options.textColor ? options.textColor : new Color(0.91, 0.925, 0.957, 1);

		this.setName("UIContextMenu");
		this.setPivot(Pivot.topLeft.clone());
		this.setAnchor(Pivot.topLeft.clone());
		this.setActive(false);

		// 바깥 누름 감지 막. (투명)
		this.#overlayNode = new WorldNode();
		this.#overlayNode.setName("ContextMenuOverlay");
		this.#overlayNode.setPivot(Pivot.topLeft.clone());
		this.#overlayNode.setAnchor(Pivot.topLeft.clone());
		this.#overlayNode.setInteractable(true);
		const overlayButton = this.#overlayNode.addComponent(UIButton);
		overlayButton.setPressedTintColor(new Color(0, 0, 0, 0));
		overlayButton.setClickedEvent(() => {
			this.close();
		});
		this.addChild(this.#overlayNode);

		// 메뉴 판.
		this.#panelNode = new WorldNode();
		this.#panelNode.setName("ContextMenuPanel");
		this.#panelNode.setPivot(Pivot.topLeft.clone());
		this.#panelNode.setAnchor(Pivot.topLeft.clone());
		const panelPaint = this.#panelNode.addComponent(Paint);
		panelPaint.setColor(this.#panelColor);
		panelPaint.setRoundSize(8);
		this.addChild(this.#panelNode);
	}

	//==============================================================================
	// 메뉴 열기.
	// - itemList: [{ text, handler?, isDisabled? }]
	//==============================================================================
	/**
	 * @param { Vector2 } position 뷰 좌표. (메뉴 좌상단)
	 * @param { object[] } itemList
	 */
	show(position, itemList) {
		// 이전 행 제거 후 다시 만든다. (항목 수가 적어 부담 없음)
		const childList = this.#panelNode.getChildren().slice();
		for (const childNode of childList) {
			this.#panelNode.removeChild(childNode);
		}

		const panelHeight = itemList.length * this.#itemHeight + 8;
		this.#panelNode.setContentSize(Vector2.create(this.#menuWidth, panelHeight));

		for (let itemIndex = 0; itemIndex < itemList.length; ++itemIndex) {
			const itemData = itemList[itemIndex];
			const rowNode = new WorldNode();
			rowNode.setName("ContextMenuItem" + itemIndex);
			rowNode.setPivot(Pivot.topLeft.clone());
			rowNode.setAnchor(Pivot.topLeft.clone());
			rowNode.setContentSize(Vector2.create(this.#menuWidth - 8, this.#itemHeight));
			rowNode.setLocalPosition(Vector2.create(4, 4 + itemIndex * this.#itemHeight));
			rowNode.setInteractable(true);
			const rowPaint = rowNode.addComponent(Paint);
			rowPaint.setColor(new Color(0, 0, 0, 0));
			rowPaint.setRoundSize(6);
			const rowButton = rowNode.addComponent(UIButton);
			rowButton.setPressedTintColor(new Color(1, 1, 1, 0.08));
			if (itemData.isDisabled) {
				rowButton.setInteractable(false);
			}
			else {
				rowButton.setClickedEvent(() => {
					this.close();
					if (itemData.handler) {
						itemData.handler();
					}
				});
			}
			const rowLabel = rowNode.addComponent(UILabel);
			rowLabel.setText(itemData.text);
			rowLabel.setFontSize(this.#fontSize);
			rowLabel.setTextAlign("left");
			rowLabel.setTextColor(itemData.isDisabled ? new Color(0.4, 0.43, 0.5, 1) : this.#textColor);
			this.#panelNode.addChild(rowNode);
		}

		// 부모 크기에 맞춰 막을 깔고, 메뉴가 화면 밖으로 나가지 않게 붙인다.
		const parentNode = this.getParent();
		let areaWidth = 960;
		let areaHeight = 640;
		if (parentNode) {
			const parentSize = parentNode.getContentSize();
			if (parentSize.x > 0 && parentSize.y > 0) {
				areaWidth = parentSize.x;
				areaHeight = parentSize.y;
			}
		}
		this.setContentSize(Vector2.create(areaWidth, areaHeight));
		this.#overlayNode.setContentSize(Vector2.create(areaWidth, areaHeight));
		const menuX = System.Math.min(position.x, areaWidth - this.#menuWidth - 4);
		const menuY = System.Math.min(position.y, areaHeight - panelHeight - 4);
		this.#panelNode.setLocalPosition(Vector2.create(menuX, menuY));

		this.setActive(true);
	}

	//==============================================================================
	// 닫기.
	//==============================================================================
	close() {
		this.setActive(false);
	}

	//==============================================================================
	// 표시 중 여부.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isShowing() {
		return this.isActive();
	}
}
