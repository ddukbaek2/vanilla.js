//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../base/vector2.js";
import { Color } from "../base/color.js";
import { Pivot } from "../base/pivot.js";
import { WorldNode } from "../core/node/worldnode.js";
import { Paint } from "../core/component/paint.js";
import { Text } from "../core/component/text.js";
import { UILabel } from "./uilabel.js";
import { UIButton } from "./uibutton.js";
import { UIScrollView } from "./uiscrollview.js";
import { UIWindow } from "./uiwindow.js";


// 기본 모양. (판 안쪽 여백, 줄 사이, 제목 높이와 글 크기, 글 크기와 줄 간격, 단추 높이와 사이, 둥근 정도)
const CONFIRM_PADDING = 24;
const CONFIRM_ROW_GAP = 16;
const CONFIRM_TITLE_HEIGHT = 32;
const CONFIRM_TITLE_FONT_SIZE = 22;
const CONFIRM_MESSAGE_FONT_SIZE = 17;
const CONFIRM_LINE_SPACING = 1.35;
const CONFIRM_BUTTON_HEIGHT = 52;
const CONFIRM_BUTTON_GAP = 12;
const CONFIRM_BUTTON_ROUND_SIZE = 12;
// 글 칸이 영역에 비해 아무리 좁아도 지키는 세로. (넘는 것은 스크롤)
const CONFIRM_MINIMUM_MESSAGE_HEIGHT = 40;
const CONFIRM_TEXT_COLOR = new Color(0.96, 0.97, 1, 1);
const CONFIRM_CANCEL_COLOR = new Color(0.22, 0.25, 0.32, 1);
const CONFIRM_ACCENT_COLOR = new Color(0.23, 0.51, 0.96, 1);


//==============================================================================
// 확인 창. (제목, 묻는 글, 취소와 확인 두 단추)
// - UIWindow 라 UIWindowLayer 로 띄운다. 묻는 글은 판의 너비에서 줄을 바꾸고 줄 수에 맞춰 판의 세로가 정해진다.
//   글이 길어 영역의 세로를 넘으면 글 칸만 스크롤되고 두 단추는 늘 보인다.
// - 단추는 왼쪽이 취소, 오른쪽이 확인(강조)이다. 오른쪽에서 왼쪽 언어(setRightToLeft)면 차례를 뒤집는다.
// - 확인을 누르면 확인 알림 뒤 닫힌다. 취소, 바깥 누르기, closeTopWindow, closeAllWindows 로 닫히면 취소 알림이다.
// - 판 모양은 UIWindow 와 같다. 단추와 글의 색은 getConfirmButtonNode() 들로 꺼내 바꾼다.
// - 사용:
//     const confirmWindow = new UIConfirmWindow("quit", { title: "나가기", message: "정말 나갈까요?", cancelText: "취소", confirmText: "나가기" });
//     confirmWindow.setConfirmEvent(() => { leave(); });
//     windowLayer.openWindow(confirmWindow);
//==============================================================================
/**
 * @example <caption>나가기를 묻는 확인 창</caption>
 * import { Engine, EngineConfiguration, UIScene, UIConfirmWindow, UIWindowLayer } from "./build/vanilla.js";
 *
 * class ConfirmScene extends UIScene {
 * 	initialize(engine) {
 * 		super.initialize(engine);
 * 		const root = this.getRoot();
 * 		const rootSize = root.getContentSize();
 * 		const windowLayer = new UIWindowLayer();
 * 		root.addChild(windowLayer);
 * 		windowLayer.setViewSize(rootSize.x, rootSize.y);
 *
 * 		const confirmWindow = new UIConfirmWindow("quit", { title: "Quit", message: "Your progress is saved. Quit the game now?", cancelText: "Stay", confirmText: "Quit" });
 * 		confirmWindow.setConfirmEvent(() => {
 * 			console.log("quit");
 * 		});
 * 		confirmWindow.setCancelEvent(() => {
 * 			console.log("stay");
 * 		});
 * 		windowLayer.openWindow(confirmWindow);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * const scene = new ConfirmScene();
 * scene.setLoadingMinDurationMs(0);
 * engine.run(scene);
 */
export class UIConfirmWindow extends UIWindow {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WorldNode } */ #titleNode;
	/** @private @type { UILabel } */ #titleLabel;
	/** @private @type { WorldNode } */ #messageScrollNode; // 묻는 글을 담는 스크롤 칸.
	/** @private @type { UIScrollView } */ #messageScrollView;
	/** @private @type { WorldNode } */ #messageNode;
	/** @private @type { UILabel } */ #messageLabel;
	/** @private @type { WorldNode } */ #cancelButtonNode;
	/** @private @type { WorldNode } */ #confirmButtonNode;
	/** @private @type { Function | null } */ #confirmEvent;
	/** @private @type { Function | null } */ #cancelEvent;
	/** @private @type { boolean } */ #isConfirmed; // 확인으로 닫히는지. (아니면 닫힐 때 취소 알림)
	/** @private @type { boolean } */ #isRightToLeft;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { string } name 창 이름.
	 * @param { object } options { title = "", message = "", cancelText = "취소", confirmText = "확인" }
	 */
	constructor(name = "UIConfirmWindow", options = {}) {
		super(name);
		const title = (options.title !== undefined) ? options.title : "";
		const message = (options.message !== undefined) ? options.message : "";
		const cancelText = (options.cancelText !== undefined) ? options.cancelText : "취소";
		const confirmText = (options.confirmText !== undefined) ? options.confirmText : "확인";
		this.#confirmEvent = null;
		this.#cancelEvent = null;
		this.#isConfirmed = false;
		this.#isRightToLeft = false;
		const panelNode = this.getPanelNode();

		// 제목. (비면 숨김)
		this.#titleNode = UIConfirmWindow.createBoxNode(name + "Title");
		this.#titleLabel = this.#titleNode.addComponent(UILabel);
		this.#titleLabel.setFontSize(CONFIRM_TITLE_FONT_SIZE);
		this.#titleLabel.setBold(true);
		this.#titleLabel.setTextColor(CONFIRM_TEXT_COLOR.clone());
		panelNode.addChild(this.#titleNode);

		// 묻는 글. (스크롤 칸 안)
		this.#messageScrollNode = UIConfirmWindow.createBoxNode(name + "MessageScroll");
		this.#messageScrollView = this.#messageScrollNode.addComponent(UIScrollView);
		this.#messageScrollView.setHorizontal(false);
		panelNode.addChild(this.#messageScrollNode);
		this.#messageNode = UIConfirmWindow.createBoxNode(name + "Message");
		this.#messageLabel = this.#messageNode.addComponent(UILabel);
		this.#messageLabel.setFontSize(CONFIRM_MESSAGE_FONT_SIZE);
		this.#messageLabel.setTextColor(CONFIRM_TEXT_COLOR.clone());
		this.#messageLabel.setTextBaseline("top");
		this.#messageLabel.setLineSpacing(CONFIRM_LINE_SPACING);
		const messageContentNode = this.#messageScrollView.getContent();
		messageContentNode.addChild(this.#messageNode);

		// 단추.
		this.#cancelButtonNode = UIConfirmWindow.createButtonNode(name + "Cancel", cancelText, CONFIRM_CANCEL_COLOR.clone());
		const cancelButton = this.#cancelButtonNode.getComponent(UIButton);
		cancelButton.setClickedEvent(() => {
			this.close();
		});
		panelNode.addChild(this.#cancelButtonNode);
		this.#confirmButtonNode = UIConfirmWindow.createButtonNode(name + "Confirm", confirmText, CONFIRM_ACCENT_COLOR.clone());
		const confirmButton = this.#confirmButtonNode.getComponent(UIButton);
		confirmButton.setClickedEvent(() => {
			this.confirm();
		});
		panelNode.addChild(this.#confirmButtonNode);

		this.setTitle(title);
		this.setMessage(message);
	}

	//==============================================================================
	// 왼쪽 위 피봇의 빈 노드 만들기.
	//==============================================================================
	/**
	 * @param { string } nodeName 노드 이름.
	 * @returns { WorldNode } 피봇과 앵커가 왼쪽 위인 새 노드.
	 */
	static createBoxNode(nodeName) {
		const node = new WorldNode();
		node.setName(nodeName);
		node.setPivot(Pivot.topLeft.clone());
		node.setAnchor(Pivot.topLeft.clone());
		return node;
	}

	//==============================================================================
	// 단추 노드 만들기. (둥근 Paint + UIButton + UILabel)
	//==============================================================================
	/**
	 * @param { string } nodeName 노드 이름.
	 * @param { string } labelText 단추 글.
	 * @param { Color } fillColor 단추 바탕 색.
	 * @returns { WorldNode } 단추 노드. (세로 52, 가로는 layoutContent 가 정한다)
	 */
	static createButtonNode(nodeName, labelText, fillColor) {
		const buttonNode = UIConfirmWindow.createBoxNode(nodeName);
		buttonNode.setContentSize(Vector2.create(1, CONFIRM_BUTTON_HEIGHT));
		buttonNode.setInteractable(true);
		const paint = buttonNode.addComponent(Paint);
		paint.setColor(fillColor);
		paint.setRoundSize(CONFIRM_BUTTON_ROUND_SIZE);
		buttonNode.addComponent(UIButton);
		const label = buttonNode.addComponent(UILabel);
		label.setText(labelText);
		label.setFontSize(CONFIRM_MESSAGE_FONT_SIZE);
		label.setTextColor(CONFIRM_TEXT_COLOR.clone());
		return buttonNode;
	}

	//==============================================================================
	// 제목 설정. (빈 글이면 제목 줄을 없앤다, 떠 있으면 다시 놓는다)
	//==============================================================================
	/**
	 * @param { string } title 제목 글.
	 */
	setTitle(title) {
		this.#titleLabel.setText(title);
		this.#titleNode.setActive(title !== "");
		this.refreshIfOpen();
	}

	//==============================================================================
	// 묻는 글 설정. (떠 있으면 다시 놓는다)
	//==============================================================================
	/**
	 * @param { string } message 묻는 글. (판의 너비에서 줄을 바꾼다)
	 */
	setMessage(message) {
		this.#messageLabel.setText(message);
		this.refreshIfOpen();
	}

	//==============================================================================
	// 단추 글 설정.
	//==============================================================================
	/**
	 * @param { string } cancelText 취소 단추 글.
	 * @param { string } confirmText 확인 단추 글.
	 */
	setButtonTexts(cancelText, confirmText) {
		const cancelLabel = this.#cancelButtonNode.getComponent(UILabel);
		cancelLabel.setText(cancelText);
		const confirmLabel = this.#confirmButtonNode.getComponent(UILabel);
		confirmLabel.setText(confirmText);
	}

	//==============================================================================
	// 오른쪽에서 왼쪽 언어인지 설정. (참이면 취소가 오른쪽, 확인이 왼쪽, 글은 오른쪽에서 왼쪽으로)
	//==============================================================================
	/**
	 * @param { boolean } isRightToLeft 참이면 오른쪽에서 왼쪽 언어.
	 */
	setRightToLeft(isRightToLeft) {
		this.#isRightToLeft = isRightToLeft;
		const textDirection = isRightToLeft ? "rtl" : "inherit";
		this.#titleLabel.setTextDirection(textDirection);
		this.#messageLabel.setTextDirection(textDirection);
		this.refreshIfOpen();
	}

	//==============================================================================
	// 오른쪽에서 왼쪽 언어인지.
	//==============================================================================
	/**
	 * @returns { boolean } 오른쪽에서 왼쪽 언어면 참.
	 */
	isRightToLeft() {
		return this.#isRightToLeft;
	}

	//==============================================================================
	// 확인 알림 설정.
	//==============================================================================
	/**
	 * @param { Function | null } confirmEvent () => void
	 */
	setConfirmEvent(confirmEvent) {
		this.#confirmEvent = confirmEvent;
	}

	//==============================================================================
	// 취소 알림 설정. (취소 단추, 바깥 누르기, 창 층이 닫을 때)
	//==============================================================================
	/**
	 * @param { Function | null } cancelEvent () => void
	 */
	setCancelEvent(cancelEvent) {
		this.#cancelEvent = cancelEvent;
	}

	//==============================================================================
	// 확인. (확인 알림을 부르고 닫는다, 떠 있지 않으면 아무 일도 없다)
	//==============================================================================
	confirm() {
		if (this.getWindowLayer() === null || this.#isConfirmed) {
			return;
		}
		this.#isConfirmed = true;
		if (this.#confirmEvent !== null) {
			this.#confirmEvent();
		}
		this.close();
	}

	//==============================================================================
	// 창 층에서 내려감. (확인이 아니면 취소 알림)
	//==============================================================================
	/**
	 * @override
	 */
	handleClosed() {
		super.handleClosed();
		const isConfirmed = this.#isConfirmed;
		this.#isConfirmed = false;
		if (!isConfirmed && this.#cancelEvent !== null) {
			this.#cancelEvent();
		}
	}

	//==============================================================================
	// 떠 있으면 다시 놓기.
	//==============================================================================
	refreshIfOpen() {
		if (this.getWindowLayer() !== null) {
			this.refreshLayout();
		}
	}

	//==============================================================================
	// 제목 노드 반환.
	//==============================================================================
	/**
	 * @returns { WorldNode } 제목 노드. (UILabel 이 붙어 있다)
	 */
	getTitleNode() {
		return this.#titleNode;
	}

	//==============================================================================
	// 묻는 글 노드 반환.
	//==============================================================================
	/**
	 * @returns { WorldNode } 묻는 글 노드. (UILabel 이 붙어 있다)
	 */
	getMessageNode() {
		return this.#messageNode;
	}

	//==============================================================================
	// 묻는 글의 스크롤 칸 반환.
	//==============================================================================
	/**
	 * @returns { UIScrollView } 묻는 글의 스크롤 칸. (세로로만 끈다)
	 */
	getMessageScrollView() {
		return this.#messageScrollView;
	}

	//==============================================================================
	// 취소 단추 노드 반환.
	//==============================================================================
	/**
	 * @returns { WorldNode } 취소 단추 노드. (Paint, UIButton, UILabel 이 붙어 있다)
	 */
	getCancelButtonNode() {
		return this.#cancelButtonNode;
	}

	//==============================================================================
	// 확인 단추 노드 반환.
	//==============================================================================
	/**
	 * @returns { WorldNode } 확인 단추 노드. (Paint, UIButton, UILabel 이 붙어 있다)
	 */
	getConfirmButtonNode() {
		return this.#confirmButtonNode;
	}

	//==============================================================================
	// 그 너비로 줄을 바꿨을 때 묻는 글의 세로.
	//==============================================================================
	/**
	 * @param { number } textWidth 줄을 바꿀 너비. (UI 층 단위, 글의 줄바꿈 너비로도 넣는다)
	 * @returns { number } 묻는 글의 세로. (UI 층 단위, 올림)
	 */
	measureMessageHeight(textWidth) {
		this.#messageLabel.setWordWrapWidth(textWidth);
		const messageText = this.#messageNode.getComponent(Text);
		const wrappedSize = messageText.measureWrappedSize();
		return System.Math.ceil(wrappedSize.height);
	}

	//==============================================================================
	// 내용 놓기. (제목 → 글 스크롤 칸 → 두 단추, 판의 세로를 돌려준다)
	//==============================================================================
	/**
	 * @override
	 * @param { number } panelWidth 판의 너비. (UI 층 단위)
	 * @returns { number } 판의 세로. (UI 층 단위, 여백, 제목, 글 칸, 단추 줄을 더한 값)
	 */
	layoutContent(panelWidth) {
		const innerWidth = System.Math.max(1, panelWidth - CONFIRM_PADDING * 2);
		let top = CONFIRM_PADDING;
		if (this.#titleNode.isActive()) {
			this.#titleNode.setLocalPosition(Vector2.create(CONFIRM_PADDING, top));
			this.#titleNode.setContentSize(Vector2.create(innerWidth, CONFIRM_TITLE_HEIGHT));
			top += CONFIRM_TITLE_HEIGHT + CONFIRM_ROW_GAP;
		}
		// 글 칸은 영역의 세로에서 위와 단추 줄을 뺀 만큼까지, 넘는 글은 스크롤한다.
		const buttonsHeight = CONFIRM_ROW_GAP + CONFIRM_BUTTON_HEIGHT + CONFIRM_PADDING;
		const viewHeight = this.getViewHeight();
		const margin = this.getMargin();
		const availableHeight = System.Math.max(CONFIRM_MINIMUM_MESSAGE_HEIGHT, viewHeight - margin * 2 - top - buttonsHeight);
		const messageHeight = System.Math.max(1, this.measureMessageHeight(innerWidth));
		const scrollHeight = System.Math.min(messageHeight, availableHeight);
		this.#messageNode.setLocalPosition(Vector2.create(0, 0));
		this.#messageNode.setContentSize(Vector2.create(innerWidth, messageHeight));
		this.#messageScrollNode.setLocalPosition(Vector2.create(CONFIRM_PADDING, top));
		this.#messageScrollNode.setContentSize(Vector2.create(innerWidth, scrollHeight));
		this.#messageScrollView.setScrollContentSize(Vector2.create(innerWidth, messageHeight));
		this.#messageScrollView.setScrollOffset(Vector2.zero());
		top += scrollHeight + CONFIRM_ROW_GAP;
		// 단추. (오른쪽에서 왼쪽 언어면 차례를 뒤집는다)
		const buttonWidth = System.Math.max(1, (innerWidth - CONFIRM_BUTTON_GAP) * 0.5);
		const leftButtonLeft = CONFIRM_PADDING;
		const rightButtonLeft = CONFIRM_PADDING + buttonWidth + CONFIRM_BUTTON_GAP;
		const cancelLeft = this.isRightToLeft() ? rightButtonLeft : leftButtonLeft;
		const confirmLeft = this.isRightToLeft() ? leftButtonLeft : rightButtonLeft;
		this.#cancelButtonNode.setLocalPosition(Vector2.create(cancelLeft, top));
		this.#cancelButtonNode.setContentSize(Vector2.create(buttonWidth, CONFIRM_BUTTON_HEIGHT));
		this.#confirmButtonNode.setLocalPosition(Vector2.create(confirmLeft, top));
		this.#confirmButtonNode.setContentSize(Vector2.create(buttonWidth, CONFIRM_BUTTON_HEIGHT));
		top += CONFIRM_BUTTON_HEIGHT + CONFIRM_PADDING;
		return top;
	}
}
