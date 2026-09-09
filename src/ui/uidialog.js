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
import { PopupMotion } from "./popupmotion.js";


//==============================================================================
// 확인 대화 상자.
// - 어둡게 가리는 막 + 가운데 카드 + 확인 / 취소 단추를 한 번의 show() 로 띄운다.
//   등장 / 퇴장은 PopupMotion(되튕김 확대 / 수축)으로 움직인다.
// - 막을 누르면 취소로 처리한다. onCancel 을 넘기지 않으면 확인만 있는 알림이 된다.
// - 씬 뿌리의 맨 위(마지막 자식)에 addChild 해 두고 쓴다.
// - 사용:
//     const dialog = new UIDialog();
//     scene.getRoot().addChild(dialog);
//     dialog.show("정말 삭제할까요?", { onConfirm: () => remove(), onCancel: () => {} });
//==============================================================================
export class UIDialog extends WorldNode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { PopupMotion } */ #popupMotion;
	/** @private @type { WorldNode } */ #overlayNode;
	/** @private @type { WorldNode } */ #panelNode;
	/** @private @type { UILabel } */ #messageLabel;
	/** @private @type { WorldNode } */ #confirmNode;
	/** @private @type { WorldNode } */ #cancelNode;
	/** @private @type { Function | null } */ #confirmHandler;
	/** @private @type { Function | null } */ #cancelHandler;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { object } options { width = 420, height = 240, confirmText = "확인", cancelText = "취소",
	 *                             panelColor?, accentColor?, textColor? }
	 */
	constructor(options = {}) {
		super();

		const panelWidth = (options.width !== undefined) ? options.width : 420;
		const panelHeight = (options.height !== undefined) ? options.height : 240;
		const panelColor = options.panelColor ? options.panelColor : new Color(0.13, 0.15, 0.2, 1);
		const accentColor = options.accentColor ? options.accentColor : new Color(0.23, 0.51, 0.96, 1);
		const textColor = options.textColor ? options.textColor : new Color(0.96, 0.97, 1, 1);

		this.setName("UIDialog");
		this.setPivot(Pivot.topLeft.clone());
		this.setAnchor(Pivot.topLeft.clone());
		this.setActive(false);
		this.#confirmHandler = null;
		this.#cancelHandler = null;

		// 어둡게 가리는 막. (누르면 취소)
		this.#overlayNode = new WorldNode();
		this.#overlayNode.setName("DialogOverlay");
		this.#overlayNode.setPivot(Pivot.topLeft.clone());
		this.#overlayNode.setAnchor(Pivot.topLeft.clone());
		this.#overlayNode.setInteractable(true);
		const overlayPaint = this.#overlayNode.addComponent(Paint);
		overlayPaint.setColor(new Color(0, 0, 0, 0.55));
		const overlayButton = this.#overlayNode.addComponent(UIButton);
		overlayButton.setPressedTintColor(new Color(0, 0, 0, 0));
		overlayButton.setClickedEvent(() => {
			this.dismiss(false);
		});
		this.addChild(this.#overlayNode);

		// 카드.
		this.#panelNode = new WorldNode();
		this.#panelNode.setName("DialogPanel");
		this.#panelNode.setPivot(Pivot.middleCenter.clone());
		this.#panelNode.setAnchor(Pivot.topLeft.clone());
		this.#panelNode.setContentSize(Vector2.create(panelWidth, panelHeight));
		const panelPaint = this.#panelNode.addComponent(Paint);
		panelPaint.setColor(panelColor);
		panelPaint.setRoundSize(18);
		this.addChild(this.#panelNode);

		// 메시지.
		const messageNode = new WorldNode();
		messageNode.setName("DialogMessage");
		messageNode.setPivot(Pivot.topLeft.clone());
		messageNode.setAnchor(Pivot.topLeft.clone());
		messageNode.setContentSize(Vector2.create(panelWidth - 56, panelHeight - 120));
		messageNode.setLocalPosition(Vector2.create(28, 24));
		this.#messageLabel = messageNode.addComponent(UILabel);
		this.#messageLabel.setText("");
		this.#messageLabel.setFontSize(17);
		this.#messageLabel.setTextColor(textColor);
		this.#messageLabel.setWordWrapWidth(panelWidth - 56);
		this.#panelNode.addChild(messageNode);

		// 단추.
		const buttonWidth = (panelWidth - 56 - 16) * 0.5;
		this.#cancelNode = this.createButtonNode("DialogCancel", options.cancelText ? options.cancelText : "취소",
			new Color(0.22, 0.25, 0.32, 1), textColor, buttonWidth);
		this.#cancelNode.setLocalPosition(Vector2.create(28, panelHeight - 76));
		this.#panelNode.addChild(this.#cancelNode);

		this.#confirmNode = this.createButtonNode("DialogConfirm", options.confirmText ? options.confirmText : "확인",
			accentColor, textColor, buttonWidth);
		this.#confirmNode.setLocalPosition(Vector2.create(28 + buttonWidth + 16, panelHeight - 76));
		this.#panelNode.addChild(this.#confirmNode);

		const cancelButton = this.#cancelNode.getComponents(UIButton)[0];
		cancelButton.setClickedEvent(() => {
			this.dismiss(false);
		});
		const confirmButton = this.#confirmNode.getComponents(UIButton)[0];
		confirmButton.setClickedEvent(() => {
			this.dismiss(true);
		});

		// 전환기.
		this.#popupMotion = new PopupMotion();
		this.#popupMotion.setClosedEvent(() => {
			this.setActive(false);
		});
	}

	//==============================================================================
	// 단추 노드 생성.
	//==============================================================================
	/**
	 * @private
	 * @param { string } nodeName
	 * @param { string } labelText
	 * @param { Color } fillColor
	 * @param { Color } textColor
	 * @param { number } buttonWidth
	 * @returns { WorldNode }
	 */
	createButtonNode(nodeName, labelText, fillColor, textColor, buttonWidth) {
		const buttonNode = new WorldNode();
		buttonNode.setName(nodeName);
		buttonNode.setPivot(Pivot.topLeft.clone());
		buttonNode.setAnchor(Pivot.topLeft.clone());
		buttonNode.setContentSize(Vector2.create(buttonWidth, 52));
		buttonNode.setInteractable(true);
		const paint = buttonNode.addComponent(Paint);
		paint.setColor(fillColor);
		paint.setRoundSize(14);
		buttonNode.addComponent(UIButton);
		const label = buttonNode.addComponent(UILabel);
		label.setText(labelText);
		label.setFontSize(16);
		label.setTextColor(textColor);
		return buttonNode;
	}

	//==============================================================================
	// 대화 상자 열기.
	// - onCancel 을 넘기지 않으면 취소 단추를 감추고 확인 단추를 가운데로 넓힌다.
	//==============================================================================
	/**
	 * @param { string } messageText
	 * @param { object } options { onConfirm?, onCancel?, confirmText?, cancelText? }
	 */
	show(messageText, options = {}) {
		this.#messageLabel.setText(messageText);
		this.#confirmHandler = options.onConfirm ? options.onConfirm : null;
		this.#cancelHandler = options.onCancel ? options.onCancel : null;
		if (options.confirmText) {
			this.#confirmNode.getComponents(UILabel)[0].setText(options.confirmText);
		}
		if (options.cancelText) {
			this.#cancelNode.getComponents(UILabel)[0].setText(options.cancelText);
		}

		const panelSize = this.#panelNode.getContentSize();
		const hasCancel = (options.onCancel !== undefined && options.onCancel !== null);
		const buttonWidth = (panelSize.x - 56 - 16) * 0.5;
		this.#cancelNode.setActive(hasCancel);
		if (hasCancel) {
			this.#confirmNode.setContentSize(Vector2.create(buttonWidth, 52));
			this.#confirmNode.setLocalPosition(Vector2.create(28 + buttonWidth + 16, panelSize.y - 76));
		}
		else {
			this.#confirmNode.setContentSize(Vector2.create(panelSize.x - 56, 52));
			this.#confirmNode.setLocalPosition(Vector2.create(28, panelSize.y - 76));
		}

		this.setActive(true);
		this.updateLayoutToParent();
		this.#popupMotion.open();
		this.applyMotion();
	}

	//==============================================================================
	// 닫기. (isConfirmed 에 따라 확인 / 취소 처리를 부른다)
	//==============================================================================
	/**
	 * @param { boolean } isConfirmed
	 */
	dismiss(isConfirmed) {
		if (!this.#popupMotion.isInteractive()) {
			return;
		}
		const handler = isConfirmed ? this.#confirmHandler : this.#cancelHandler;
		this.#confirmHandler = null;
		this.#cancelHandler = null;
		this.#popupMotion.close();
		if (handler) {
			handler();
		}
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
		this.#popupMotion.tick(timeDelta);
		this.applyMotion();
	}

	//==============================================================================
	// 전환기 산출값을 노드에 반영.
	//==============================================================================
	/**
	 * @private
	 */
	applyMotion() {
		this.#overlayNode.setLocalOpacity(this.#popupMotion.getDimRatio());
		const panelScale = this.#popupMotion.getScale();
		this.#panelNode.setLocalScale(Vector2.create(panelScale, panelScale));
	}

	//==============================================================================
	// 부모 크기에 맞춰 막과 카드 자리를 갱신.
	//==============================================================================
	/**
	 * @private
	 */
	updateLayoutToParent() {
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
		this.#overlayNode.setLocalPosition(Vector2.create(0, 0));
		this.#panelNode.setLocalPosition(Vector2.create(areaWidth * 0.5, areaHeight * 0.5));
	}

	//==============================================================================
	// 표시 중 여부.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isShowing() {
		return this.#popupMotion.isVisible();
	}

	//==============================================================================
	// 즉시 전환 여부 설정. (연출 없는 UI 톤)
	//==============================================================================
	/**
	 * @param { boolean } isInstantEnabled
	 */
	setInstantEnabled(isInstantEnabled) {
		this.#popupMotion.setInstantEnabled(isInstantEnabled);
	}
}
