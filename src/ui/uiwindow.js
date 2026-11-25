//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../base/vector2.js";
import { Color } from "../base/color.js";
import { Pivot } from "../base/pivot.js";
import { Rect } from "../base/rect.js";
import { WorldNode } from "../core/node/worldnode.js";
import { Paint } from "../core/component/paint.js";
import { UIButton } from "./uibutton.js";
import { PopupMotion } from "./popupmotion.js";


// 기본 모양. (창의 가로 한계, 영역 가장자리와 띄우는 거리, 판의 처음 세로, 둥근 정도, 판과 어둠의 색)
const DEFAULT_MAXIMUM_WIDTH = 480;
const DEFAULT_MARGIN = 16;
const DEFAULT_PANEL_HEIGHT = 240;
const DEFAULT_PANEL_ROUND_SIZE = 16;
const DEFAULT_PANEL_COLOR = new Color(0.13, 0.15, 0.2, 1);
const DEFAULT_DIM_COLOR = new Color(0, 0, 0, 0.55);


//==============================================================================
// 창 쌓기의 창 하나. (UIWindowLayer 가 띄우고 치운다)
// - 영역 전체를 어둡게 덮고(뒤로 누름이 가지 않는다) 가운데에 판을 띄운다. 어둠은 세이프에어리어(setViewBleed)까지 덮는다.
// - 판은 영역의 가로에 맞춰 넓어지되 maximumWidth 를 넘지 않는다. 세로는 layoutContent 가 돌려준 값이고, 영역보다 크면 판을 통째로 줄인다.
// - 열고 닫는 움직임은 PopupMotion 이다. 닫는 움직임이 끝나면 창 층이 떼어 낸다. (그동안은 누름을 받지 않는다)
// - 바깥(어둠)을 누르면 닫힌다. 창마다 setOutsideCloseEnabled 로 끈다. 창 층의 closeTopWindow(뒤로 가기)도 이 값을 따른다.
// - 노드 구성: 창(영역 크기) ├ 어둠(dimNode, Paint + UIButton) └ 틀(frameNode, 판 가운데 피봇, 움직임 배율) └ 판(panelNode, Paint 한 장, 내용은 여기)
// - 판 모양(그림자, 테, 글로시 같은 꾸밈)은 게임 몫이다. 게임은 이 클래스를 상속해 생성자에서 꾸밈 노드를 틀에 붙이고
//   (판 뒤에 둘 것은 setSiblingIndex(0)), layoutPanel 을 덮어써 판 크기에 맞춰 놓는다. 기본 판 Paint 는 getPanelPaint() 로 바꾸거나 끈다.
//   움직임 모양(아래에서 올라오는 판 등)은 applyMotion 을 덮어쓴다.
// - 내용은 파생 클래스가 layoutContent(panelWidth) 에서 판 안에 놓고 판의 세로를 돌려준다. (기본은 setPanelHeight 의 값)
// - 사용:
//     const window = new UIWindow("settings");
//     window.getPanelNode().addChild(contentNode);
//     windowLayer.openWindow(window);
//     window.close();
//==============================================================================
/**
 * @example <caption>내용을 놓는 창을 상속해 띄우기</caption>
 * import { Engine, EngineConfiguration, UIScene, UIWindow, UIWindowLayer, UILabel, WorldNode, Pivot, Vector2 } from "./build/vanilla.js";
 *
 * class NoticeWindow extends UIWindow {
 * 	#messageNode;
 *
 * 	constructor(name, messageText) {
 * 		super(name);
 * 		const messageNode = new WorldNode();
 * 		messageNode.setPivot(Pivot.topLeft.clone());
 * 		messageNode.setAnchor(Pivot.topLeft.clone());
 * 		const messageLabel = messageNode.addComponent(UILabel);
 * 		messageLabel.setText(messageText);
 * 		messageLabel.setFontSize(18);
 * 		const panelNode = this.getPanelNode();
 * 		panelNode.addChild(messageNode);
 * 		this.#messageNode = messageNode;
 * 	}
 *
 * 	getMessageNode() {
 * 		return this.#messageNode;
 * 	}
 *
 * 	layoutContent(panelWidth) {
 * 		const messageNode = this.getMessageNode();
 * 		messageNode.setLocalPosition(Vector2.create(24, 24));
 * 		messageNode.setContentSize(Vector2.create(panelWidth - 48, 64));
 * 		return 112;
 * 	}
 * }
 *
 * class WindowScene extends UIScene {
 * 	initialize(engine) {
 * 		super.initialize(engine);
 * 		const root = this.getRoot();
 * 		const rootSize = root.getContentSize();
 * 		const windowLayer = new UIWindowLayer();
 * 		root.addChild(windowLayer);
 * 		windowLayer.setViewSize(rootSize.x, rootSize.y);
 * 		const noticeWindow = new NoticeWindow("notice", "New items arrived in the shop.");
 * 		noticeWindow.setMaximumWidth(360);
 * 		noticeWindow.setOutsideCloseEnabled(false);
 * 		windowLayer.openWindow(noticeWindow);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * const scene = new WindowScene();
 * scene.setLoadingMinDurationMs(0);
 * engine.run(scene);
 */
export class UIWindow extends WorldNode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WorldNode } */ #dimNode; // 바깥을 덮는 어둠. (누름을 삼킴)
	/** @private @type { Paint } */ #dimPaint;
	/** @private @type { WorldNode } */ #frameNode; // 판과 꾸밈을 담아 움직임 배율을 받는 노드.
	/** @private @type { WorldNode } */ #panelNode; // 판. (내용을 붙이는 곳)
	/** @private @type { Paint } */ #panelPaint;
	/** @private @type { PopupMotion } */ #popupMotion;
	/** @private @type { boolean } */ #isOutsideCloseEnabled;
	/** @private @type { Function | null } */ #closeEvent; // 창 층에서 내려갈 때 부른다.
	/** @private @type { * } */ #windowLayer; // 띄운 창 층. (띄우기 전이나 내려간 뒤에는 null)
	/** @private @type { number } */ #viewWidth; // 마지막으로 받은 영역의 크기. (UI 층 단위)
	/** @private @type { number } */ #viewHeight;
	/** @private @type { object } */ #viewBleed; // 영역 밖으로 더 덮는 너비. { top, right, bottom, left }
	/** @private @type { number } */ #maximumWidth;
	/** @private @type { number } */ #margin;
	/** @private @type { number } */ #panelHeight; // layoutContent 기본값이 돌려주는 판의 세로.
	/** @private @type { Rect } */ #panelRect; // 마지막으로 놓은 판의 자리. (움직임을 걸기 전, 줄인 배율을 곱한 크기)
	/** @private @type { number } */ #panelScale; // 판이 영역보다 커서 줄인 배율. (1 이하)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { string } name 창 이름. (UIWindowLayer.findWindow 로 찾는다)
	 */
	constructor(name = "UIWindow") {
		super();
		this.setName(name);
		this.setPivot(Pivot.topLeft.clone());
		this.setAnchor(Pivot.topLeft.clone());
		this.#isOutsideCloseEnabled = true;
		this.#closeEvent = null;
		this.#windowLayer = null;
		this.#viewWidth = 1;
		this.#viewHeight = 1;
		this.#viewBleed = { top: 0, right: 0, bottom: 0, left: 0 };
		this.#maximumWidth = DEFAULT_MAXIMUM_WIDTH;
		this.#margin = DEFAULT_MARGIN;
		this.#panelHeight = DEFAULT_PANEL_HEIGHT;
		this.#panelRect = Rect.create(0, 0, 1, 1);
		this.#panelScale = 1;

		// 바깥. (누름을 삼키고, 바깥 닫기가 켜져 있으면 닫는다)
		const dimNode = new WorldNode();
		dimNode.setName(name + "Dim");
		dimNode.setPivot(Pivot.topLeft.clone());
		dimNode.setAnchor(Pivot.topLeft.clone());
		dimNode.setInteractable(true);
		const dimPaint = dimNode.addComponent(Paint);
		dimPaint.setColor(DEFAULT_DIM_COLOR.clone());
		const dimButton = dimNode.addComponent(UIButton);
		dimButton.excludeComponentFromTint(dimPaint);
		dimButton.setClickedEvent(() => {
			if (this.isOutsideCloseEnabled()) {
				this.close();
			}
		});
		this.addChild(dimNode);
		this.#dimNode = dimNode;
		this.#dimPaint = dimPaint;

		// 틀. (판 가운데를 두고 커지고 준다)
		const frameNode = new WorldNode();
		frameNode.setName(name + "Frame");
		frameNode.setPivot(Pivot.middleCenter.clone());
		frameNode.setAnchor(Pivot.topLeft.clone());
		this.addChild(frameNode);
		this.#frameNode = frameNode;

		// 판. (누름을 삼켜 바깥 닫기로 닫히지 않게 한다)
		const panelNode = new WorldNode();
		panelNode.setName(name + "Panel");
		panelNode.setPivot(Pivot.topLeft.clone());
		panelNode.setAnchor(Pivot.topLeft.clone());
		panelNode.setInteractable(true);
		const panelPaint = panelNode.addComponent(Paint);
		panelPaint.setColor(DEFAULT_PANEL_COLOR.clone());
		panelPaint.setRoundSize(DEFAULT_PANEL_ROUND_SIZE);
		frameNode.addChild(panelNode);
		this.#panelNode = panelNode;
		this.#panelPaint = panelPaint;

		// 움직임. (창 층이 띄울 때 연다)
		this.#popupMotion = new PopupMotion();
	}

	//==============================================================================
	// 판 노드 반환. (내용을 여기에 붙인다)
	//==============================================================================
	/**
	 * @returns { WorldNode } 판 노드.
	 */
	getPanelNode() {
		return this.#panelNode;
	}

	//==============================================================================
	// 판의 Paint 반환. (색, 둥근 정도를 바꾸거나 setEnable(false) 로 끄고 게임의 판을 쓴다)
	//==============================================================================
	/**
	 * @returns { Paint } 판의 Paint.
	 */
	getPanelPaint() {
		return this.#panelPaint;
	}

	//==============================================================================
	// 틀 노드 반환. (판과 함께 커지고 주는 꾸밈을 붙이는 곳)
	//==============================================================================
	/**
	 * @returns { WorldNode } 틀 노드. (판의 가운데가 피봇)
	 */
	getFrameNode() {
		return this.#frameNode;
	}

	//==============================================================================
	// 어둠 노드 반환.
	//==============================================================================
	/**
	 * @returns { WorldNode } 어둠 노드.
	 */
	getDimNode() {
		return this.#dimNode;
	}

	//==============================================================================
	// 어둠의 Paint 반환. (색을 바꾼다)
	//==============================================================================
	/**
	 * @returns { Paint } 어둠의 Paint.
	 */
	getDimPaint() {
		return this.#dimPaint;
	}

	//==============================================================================
	// 어둠 색 설정. (어둠의 Paint 색을 바꾼다)
	//==============================================================================
	/**
	 * @param { Color | string } dimColor 어둠 색. (기본 검정 알파 0.55, 움직임이 알파를 0 ~ 1 배로 곱한다)
	 */
	setDimColor(dimColor) {
		this.#dimPaint.setColor(dimColor);
	}

	//==============================================================================
	// 판 색 설정. (판의 Paint 색을 바꾼다)
	//==============================================================================
	/**
	 * @param { Color | string } panelColor 판 색.
	 */
	setPanelColor(panelColor) {
		this.#panelPaint.setColor(panelColor);
	}

	//==============================================================================
	// 움직임 반환. (setInstantEnabled 로 움직임 없이 열고 닫는다)
	//==============================================================================
	/**
	 * @returns { PopupMotion } 이 창의 움직임.
	 */
	getPopupMotion() {
		return this.#popupMotion;
	}

	//==============================================================================
	// 바깥 누르기(와 창 층의 closeTopWindow)로 닫히는지 설정. (기본 true)
	//==============================================================================
	/**
	 * @param { boolean } isOutsideCloseEnabled 참이면 바깥을 누르거나 closeTopWindow 로 닫힌다.
	 */
	setOutsideCloseEnabled(isOutsideCloseEnabled) {
		this.#isOutsideCloseEnabled = isOutsideCloseEnabled;
	}

	//==============================================================================
	// 바깥 누르기로 닫히는지.
	//==============================================================================
	/**
	 * @returns { boolean } 바깥 누르기로 닫히면 참.
	 */
	isOutsideCloseEnabled() {
		return this.#isOutsideCloseEnabled;
	}

	//==============================================================================
	// 창 층에서 내려갈 때 알림 설정. (닫기 단추, 바깥 누르기, closeAllWindows 모두)
	//==============================================================================
	/**
	 * @param { Function | null } closeEvent () => void
	 */
	setCloseEvent(closeEvent) {
		this.#closeEvent = closeEvent;
	}

	//==============================================================================
	// 창의 가로 한계 설정. (영역이 좁으면 그보다 좁아진다)
	//==============================================================================
	/**
	 * @param { number } maximumWidth 판 너비의 한계. (UI 층 단위, 1 보다 작으면 1, 기본 480)
	 */
	setMaximumWidth(maximumWidth) {
		this.#maximumWidth = System.Math.max(1, maximumWidth);
	}

	//==============================================================================
	// 창의 가로 한계 반환.
	//==============================================================================
	/**
	 * @returns { number } 판 너비의 한계. (UI 층 단위)
	 */
	getMaximumWidth() {
		return this.#maximumWidth;
	}

	//==============================================================================
	// 영역 가장자리와 판 사이 거리 설정.
	//==============================================================================
	/**
	 * @param { number } margin 영역 가장자리와 판 사이 거리. (UI 층 단위, 음수면 0, 기본 16)
	 */
	setMargin(margin) {
		this.#margin = System.Math.max(0, margin);
	}

	//==============================================================================
	// 영역 가장자리와 판 사이 거리 반환.
	//==============================================================================
	/**
	 * @returns { number } 영역 가장자리와 판 사이 거리. (UI 층 단위)
	 */
	getMargin() {
		return this.#margin;
	}

	//==============================================================================
	// 판의 세로 설정. (layoutContent 를 덮어쓰지 않은 창이 쓴다)
	//==============================================================================
	/**
	 * @param { number } panelHeight 판의 세로. (UI 층 단위, 1 보다 작으면 1, 기본 240)
	 */
	setPanelHeight(panelHeight) {
		this.#panelHeight = System.Math.max(1, panelHeight);
	}

	//==============================================================================
	// 판의 세로 반환.
	//==============================================================================
	/**
	 * @returns { number } setPanelHeight 로 정한 판의 세로. (UI 층 단위)
	 */
	getPanelHeight() {
		return this.#panelHeight;
	}

	//==============================================================================
	// 마지막으로 받은 영역의 너비. (UI 층 단위)
	//==============================================================================
	/**
	 * @returns { number } 영역의 너비. (UI 층 단위, 받기 전이면 1)
	 */
	getViewWidth() {
		return this.#viewWidth;
	}

	//==============================================================================
	// 마지막으로 받은 영역의 높이. (UI 층 단위, 내용이 세로를 채우는 창이 쓴다)
	//==============================================================================
	/**
	 * @returns { number } 영역의 높이. (UI 층 단위, 받기 전이면 1)
	 */
	getViewHeight() {
		return this.#viewHeight;
	}

	//==============================================================================
	// 영역 밖으로 더 덮는 너비 반환. { top, right, bottom, left }
	//==============================================================================
	/**
	 * @returns { object } 덮는 너비. ({ top, right, bottom, left }, UI 층 단위, 복사하지 않은 원본)
	 */
	getViewBleed() {
		return this.#viewBleed;
	}

	//==============================================================================
	// 마지막으로 놓은 판의 자리. (창 좌표, 움직임 전, 줄인 배율을 곱한 크기)
	//==============================================================================
	/**
	 * @returns { Rect } 판의 자리. (창 좌표)
	 */
	getPanelRect() {
		return this.#panelRect;
	}

	//==============================================================================
	// 판이 영역보다 커서 줄인 배율. (1 이하)
	//==============================================================================
	/**
	 * @returns { number } 줄인 배율. (0 초과 1 이하)
	 */
	getPanelScale() {
		return this.#panelScale;
	}

	//==============================================================================
	// 띄운 창 층 반환. (띄우기 전이나 내려간 뒤면 null)
	//==============================================================================
	/**
	 * @returns { * } 띄운 UIWindowLayer. (없으면 null)
	 */
	getWindowLayer() {
		return this.#windowLayer;
	}

	//==============================================================================
	// 띄운 창 층 설정. (창 층이 부른다)
	//==============================================================================
	/**
	 * @param { * } windowLayer 띄운 UIWindowLayer. (내려가면 null)
	 */
	setWindowLayer(windowLayer) {
		this.#windowLayer = windowLayer;
	}

	//==============================================================================
	// 닫기. (창 층에서 내린다. 닫는 움직임이 끝나면 떼어 낸다, 띄우지 않았으면 아무 일도 없다)
	//==============================================================================
	close() {
		const windowLayer = this.getWindowLayer();
		if (windowLayer !== null) {
			windowLayer.closeWindow(this);
		}
	}

	//==============================================================================
	// 창 층에서 내려감. (창 층이 부른다, 파생 클래스가 덮어쓰면 super 를 부른다)
	//==============================================================================
	/**
	 * @virtual
	 */
	handleClosed() {
		if (this.#closeEvent !== null) {
			this.#closeEvent();
		}
	}

	//==============================================================================
	// 영역 밖으로 더 덮는 너비 알리기. (세이프에어리어, UI 층 단위, 어둠이 그 밑까지 덮는다)
	//==============================================================================
	/**
	 * @param { number } top 위로 더 덮는 너비. (UI 층 단위, 음수면 0)
	 * @param { number } right 오른쪽으로 더 덮는 너비. (UI 층 단위, 음수면 0)
	 * @param { number } bottom 아래로 더 덮는 너비. (UI 층 단위, 음수면 0)
	 * @param { number } left 왼쪽으로 더 덮는 너비. (UI 층 단위, 음수면 0)
	 */
	setViewBleed(top, right, bottom, left) {
		this.#viewBleed.top = System.Math.max(0, top);
		this.#viewBleed.right = System.Math.max(0, right);
		this.#viewBleed.bottom = System.Math.max(0, bottom);
		this.#viewBleed.left = System.Math.max(0, left);
		this.placeDimNode();
	}

	//==============================================================================
	// 어둠 놓기. (영역과 그 밖의 세이프에어리어까지)
	//==============================================================================
	placeDimNode() {
		const viewBleed = this.getViewBleed();
		const viewWidth = this.getViewWidth();
		const viewHeight = this.getViewHeight();
		const dimNode = this.getDimNode();
		dimNode.setLocalPosition(Vector2.create(-viewBleed.left, -viewBleed.top));
		dimNode.setContentSize(Vector2.create(viewWidth + viewBleed.left + viewBleed.right, viewHeight + viewBleed.top + viewBleed.bottom));
	}

	//==============================================================================
	// 영역의 크기 알리기. (어둠을 덮고, 판의 가로를 정해 내용을 놓은 뒤 가운데에 둔다)
	//==============================================================================
	/**
	 * @param { number } viewWidth UI 층 단위.
	 * @param { number } viewHeight 영역의 높이. (UI 층 단위, 1 보다 작으면 1)
	 */
	setViewSize(viewWidth, viewHeight) {
		this.#viewWidth = System.Math.max(1, viewWidth);
		this.#viewHeight = System.Math.max(1, viewHeight);
		this.refreshLayout();
	}

	//==============================================================================
	// 다시 놓기. (내용이 바뀌어 판의 세로가 달라질 때, 마지막 영역의 크기로)
	//==============================================================================
	refreshLayout() {
		const viewWidth = this.getViewWidth();
		const viewHeight = this.getViewHeight();
		const margin = this.getMargin();
		this.setContentSize(Vector2.create(viewWidth, viewHeight));
		this.placeDimNode();
		const maximumWidth = this.getMaximumWidth();
		const panelWidth = System.Math.max(1, System.Math.min(viewWidth - margin * 2, maximumWidth));
		const panelHeight = System.Math.max(1, this.layoutContent(panelWidth));
		// 판이 영역보다 키가 크면 통째로 줄인다. (배치는 그대로, 글자와 단추가 함께 작아진다)
		const availableHeight = System.Math.max(1, viewHeight - margin * 2);
		const panelScale = (panelHeight > availableHeight) ? (availableHeight / panelHeight) : 1;
		const scaledWidth = panelWidth * panelScale;
		const scaledHeight = panelHeight * panelScale;
		const panelLeft = (viewWidth - scaledWidth) * 0.5;
		const panelTop = System.Math.max(margin * panelScale, (viewHeight - scaledHeight) * 0.5);
		this.#panelRect = Rect.create(panelLeft, panelTop, scaledWidth, scaledHeight);
		this.#panelScale = panelScale;
		const frameNode = this.getFrameNode();
		frameNode.setContentSize(Vector2.create(panelWidth, panelHeight));
		frameNode.setLocalPosition(Vector2.create(panelLeft + scaledWidth * 0.5, panelTop + scaledHeight * 0.5));
		this.layoutPanel(panelWidth, panelHeight);
		this.applyMotion();
	}

	//==============================================================================
	// 내용 놓기. (파생 클래스가 덮어써 판 안에 내용을 놓고 판의 세로를 돌려준다)
	//==============================================================================
	/**
	 * @virtual
	 * @param { number } panelWidth 판의 너비. (UI 층 단위, 영역 너비에서 여백을 뺀 값과 가로 한계 가운데 작은 것)
	 * @returns { number } 판의 세로. (UI 층 단위, 기본은 getPanelHeight)
	 */
	layoutContent(panelWidth) {
		return this.getPanelHeight();
	}

	//==============================================================================
	// 판 놓기. (판의 크기를 정한다, 꾸밈을 단 파생 클래스가 덮어써 super 를 부른 뒤 꾸밈을 놓는다)
	//==============================================================================
	/**
	 * @virtual
	 * @param { number } panelWidth 판의 너비. (UI 층 단위, 줄이기 전)
	 * @param { number } panelHeight 판의 세로. (UI 층 단위, 줄이기 전)
	 */
	layoutPanel(panelWidth, panelHeight) {
		const panelNode = this.getPanelNode();
		panelNode.setLocalPosition(Vector2.create(0, 0));
		panelNode.setContentSize(Vector2.create(panelWidth, panelHeight));
	}

	//==============================================================================
	// 움직임을 틀과 어둠에 걸기. (틀 배율 = 줄인 배율 x 움직임 배율, 어둠 진하기 = 움직임 비율, 파생 클래스가 덮어써 모양을 바꾼다)
	//==============================================================================
	/**
	 * @virtual
	 */
	applyMotion() {
		const popupMotion = this.getPopupMotion();
		const motionScale = popupMotion.getScale();
		const dimRatio = popupMotion.getDimRatio();
		const frameScale = this.getPanelScale() * motionScale;
		const frameNode = this.getFrameNode();
		frameNode.setLocalScale(Vector2.create(frameScale, frameScale));
		const dimNode = this.getDimNode();
		dimNode.setLocalOpacity(dimRatio);
	}

	//==============================================================================
	// 여는 움직임 시작. (창 층이 띄울 때 부른다)
	//==============================================================================
	startOpenMotion() {
		this.#dimNode.setInteractable(true);
		this.#panelNode.setInteractable(true);
		this.#popupMotion.open();
		this.applyMotion();
	}

	//==============================================================================
	// 닫는 움직임 시작. (창 층이 내릴 때 부른다, 그동안은 누름을 받지 않는다)
	//==============================================================================
	startCloseMotion() {
		this.#dimNode.setInteractable(false);
		this.#panelNode.setInteractable(false);
		this.#popupMotion.close();
		this.applyMotion();
	}

	//==============================================================================
	// 닫는 움직임이 끝났는지. (창 층이 떼어 낼 때를 본다)
	//==============================================================================
	/**
	 * @returns { boolean } 움직임이 닫힘 상태면 참.
	 */
	isCloseMotionFinished() {
		const popupMotion = this.getPopupMotion();
		return !popupMotion.isVisible();
	}

	//==============================================================================
	// 매 프레임. (자식 다음에 움직임)
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
		if (!this.isActive()) {
			return;
		}
		this.#popupMotion.tick(timeDelta);
		this.applyMotion();
	}

	//==============================================================================
	// 다른 창에 덮였는지 알리기. (맨 위의 창만 보인다, 기본은 덮이면 숨고 드러나면 다시 보인다)
	// - DOM 입력처럼 캔버스 밖에 붙인 것이 있으면 파생 클래스가 덮어써 함께 치운다.
	//==============================================================================
	/**
	 * @virtual
	 * @param { boolean } isCovered 참이면 다른 창에 덮였다.
	 */
	setCovered(isCovered) {
		this.setActive(!isCovered);
	}

	//==============================================================================
	// 마우스 휠. (맨 위의 창이면 창 층이 먼저 준다, 받았으면 true, 파생 클래스가 덮어쓴다)
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } viewInputPosition 입력 위치. (뷰 좌표)
	 * @param { Vector2 } wheelDelta 휠 누적값.
	 * @returns { boolean } 받았으면 참. (기본은 늘 거짓)
	 */
	handleWheel(viewInputPosition, wheelDelta) {
		return false;
	}

	//==============================================================================
	// 떼어 낼 때. (DOM 입력처럼 엔진 밖에 붙인 것을 정리한다, 파생 클래스가 덮어쓴다)
	//==============================================================================
	/**
	 * @virtual
	 */
	dispose() {
	}
}
