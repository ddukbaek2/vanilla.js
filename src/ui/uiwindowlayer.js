//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../base/vector2.js";
import { Pivot } from "../base/pivot.js";
import { WorldNode } from "../core/node/worldnode.js";
import { UIWindow } from "./uiwindow.js";
import { UIScale } from "./uiscale.js";


//==============================================================================
// 창 층. (영역 위에 UIWindow 를 쌓는다)
// - 창을 띄우면 맨 위에 쌓고, 맨 위의 창만 보인다. 위의 창이 닫히면 아래 창이 다시 보인다.
// - 닫으면 목록에서 바로 빠져 누름과 덮임이 바로 풀리고, 닫는 움직임(PopupMotion)이 끝난 뒤에 떼어 낸다.
//   덮여 있던 창을 닫으면 움직임 없이 바로 떼어 낸다.
// - 이 층은 UI 배율(UIScale.read)만큼 커지고, 창에는 그만큼 나눈 영역의 크기와 세이프에어리어 너비를 알린다. (작은 화면에서도 글자가 읽히게)
//   setUIScaleOptions(null) 이면 키우지 않는다.
// - 창이 하나라도 떠 있는 동안은 놀이 밖이다. 창이 뜨고 닫힐 때 알리므로(setWindowChangeEvent) 게임이 놀이를 멈추고 이어 간다.
// - 휠은 맨 위의 창이 먼저 받는다(UIWindow.handleWheel), 받지 않으면 그 자리의 스크롤 뷰. GameScene 은 창 층 안을 가리킨 휠을 scrollWindowAt 으로 넘긴다.
// - 사용: (영역 노드의 맨 위 자식으로 두고, 영역 크기가 바뀔 때마다 알린다)
//     const windowLayer = new UIWindowLayer();
//     playAreaNode.addChild(windowLayer);
//     windowLayer.setViewSize(playAreaWidth, playAreaHeight);
//     windowLayer.setViewBleed(insets.top, insets.right, insets.bottom, insets.left);
//     windowLayer.setWindowChangeEvent(() => { game.setPaused(windowLayer.hasOpenWindow()); });
//     windowLayer.openWindow(new UIConfirmWindow("quit", { title: "나가기", message: "정말 나갈까요?" }));
//==============================================================================
export class UIWindowLayer extends WorldNode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { UIWindow[] } */ #windows; // 띄운 창. (아래에서 위로)
	/** @private @type { UIWindow[] } */ #closingWindows; // 닫는 움직임 중인 창. (끝나면 떼어 냄)
	/** @private @type { number } */ #viewWidth; // 영역의 크기. (부모 단위)
	/** @private @type { number } */ #viewHeight;
	/** @private @type { object } */ #viewBleed; // 영역 밖으로 더 덮는 너비. { top, right, bottom, left } (부모 단위)
	/** @private @type { object | null } */ #uiScaleOptions; // UIScale.read 에 넘기는 설정. (null 이면 키우지 않음)
	/** @private @type { number } */ #uiScale; // 지금의 UI 배율.
	/** @private @type { Function | null } */ #windowChangeEvent; // 창이 뜨거나 닫히면 부른다.

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setName("UIWindowLayer");
		this.setPivot(Pivot.topLeft.clone());
		this.setAnchor(Pivot.topLeft.clone());
		this.#windows = [];
		this.#closingWindows = [];
		this.#viewWidth = 1;
		this.#viewHeight = 1;
		this.#viewBleed = { top: 0, right: 0, bottom: 0, left: 0 };
		this.#uiScaleOptions = {};
		this.#uiScale = 1;
		this.#windowChangeEvent = null;
	}

	//==============================================================================
	// 창이 뜨거나 닫힐 때 알림 설정.
	//==============================================================================
	/**
	 * @param { Function | null } windowChangeEvent () => void
	 */
	setWindowChangeEvent(windowChangeEvent) {
		this.#windowChangeEvent = windowChangeEvent;
	}

	//==============================================================================
	// UI 배율 설정. (UIScale.read 의 options, null 이면 키우지 않는다, 기본은 {} 로 UIScale 기본값)
	//==============================================================================
	/**
	 * @param { object | null } uiScaleOptions
	 */
	setUIScaleOptions(uiScaleOptions) {
		this.#uiScaleOptions = uiScaleOptions;
		this.setViewSize(this.#viewWidth, this.#viewHeight);
	}

	//==============================================================================
	// 지금의 UI 배율.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getUIScale() {
		return this.#uiScale;
	}

	//==============================================================================
	// 창이 하나라도 떠 있는지. (닫는 움직임 중인 창은 셈하지 않는다)
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	hasOpenWindow() {
		return this.#windows.length > 0;
	}

	//==============================================================================
	// 떠 있는 창의 수.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getWindowCount() {
		return this.#windows.length;
	}

	//==============================================================================
	// 맨 위의 창. (없으면 null)
	//==============================================================================
	/**
	 * @returns { UIWindow | null }
	 */
	getTopWindow() {
		if (this.#windows.length === 0) {
			return null;
		}
		return this.#windows[this.#windows.length - 1];
	}

	//==============================================================================
	// 그 이름의 창. (떠 있는 것 가운데 위에서부터, 없으면 null)
	//==============================================================================
	/**
	 * @param { string } windowName
	 * @returns { UIWindow | null }
	 */
	findWindow(windowName) {
		for (let windowIndex = this.#windows.length - 1; windowIndex >= 0; --windowIndex) {
			const window = this.#windows[windowIndex];
			if (window.getName() === windowName) {
				return window;
			}
		}
		return null;
	}

	//==============================================================================
	// 영역의 크기 알리기. (UI 배율을 다시 읽고, 띄운 창을 모두 다시 놓는다)
	//==============================================================================
	/**
	 * @param { number } viewWidth 부모 단위.
	 * @param { number } viewHeight
	 */
	setViewSize(viewWidth, viewHeight) {
		this.#viewWidth = System.Math.max(1, viewWidth);
		this.#viewHeight = System.Math.max(1, viewHeight);
		const uiScaleOptions = this.#uiScaleOptions;
		this.#uiScale = (uiScaleOptions === null) ? 1 : UIScale.read(this.#viewWidth, this.#viewHeight, uiScaleOptions);
		const uiScale = this.getUIScale();
		this.setLocalScale(Vector2.create(uiScale, uiScale));
		this.setContentSize(Vector2.create(this.#viewWidth / uiScale, this.#viewHeight / uiScale));
		this.placeAllWindows();
	}

	//==============================================================================
	// 영역 밖으로 더 덮는 너비 알리기. (세이프에어리어, 부모 단위)
	//==============================================================================
	/**
	 * @param { number } top
	 * @param { number } right
	 * @param { number } bottom
	 * @param { number } left
	 */
	setViewBleed(top, right, bottom, left) {
		this.#viewBleed.top = System.Math.max(0, top);
		this.#viewBleed.right = System.Math.max(0, right);
		this.#viewBleed.bottom = System.Math.max(0, bottom);
		this.#viewBleed.left = System.Math.max(0, left);
		this.placeAllWindows();
	}

	//==============================================================================
	// 띄운 창과 닫는 중인 창을 모두 다시 놓기.
	//==============================================================================
	placeAllWindows() {
		for (const window of this.#windows) {
			this.placeWindow(window);
		}
		for (const window of this.#closingWindows) {
			this.placeWindow(window);
		}
	}

	//==============================================================================
	// 창 하나 놓기. (UI 배율로 나눈 영역의 크기와 덮는 너비를 알린다)
	//==============================================================================
	/**
	 * @param { UIWindow } window
	 */
	placeWindow(window) {
		const uiScale = this.getUIScale();
		const viewBleed = this.#viewBleed;
		window.setViewBleed(viewBleed.top / uiScale, viewBleed.right / uiScale, viewBleed.bottom / uiScale, viewBleed.left / uiScale);
		window.setViewSize(this.#viewWidth / uiScale, this.#viewHeight / uiScale);
	}

	//==============================================================================
	// 창 띄우기. (맨 위에 쌓는다, 이미 떠 있으면 맨 위로 올린다)
	//==============================================================================
	/**
	 * @param { UIWindow } window
	 */
	openWindow(window) {
		const windowIndex = this.#windows.indexOf(window);
		if (windowIndex >= 0) {
			this.#windows.splice(windowIndex, 1);
		}
		const closingIndex = this.#closingWindows.indexOf(window);
		if (closingIndex >= 0) {
			this.#closingWindows.splice(closingIndex, 1);
		}
		if (window.getParent() !== this) {
			this.addChild(window);
		}
		window.setSiblingIndex(this.getChildCount() - 1);
		window.setWindowLayer(this);
		this.#windows.push(window);
		this.placeWindow(window);
		window.startOpenMotion();
		this.refreshWindowCovers();
		this.notifyWindowChange();
	}

	//==============================================================================
	// 창 닫기. (목록에서 빼고 닫는 움직임을 시작한다, 떠 있지 않으면 아무 일도 없다)
	//==============================================================================
	/**
	 * @param { UIWindow } window
	 */
	closeWindow(window) {
		const windowIndex = this.#windows.indexOf(window);
		if (windowIndex < 0) {
			return;
		}
		this.#windows.splice(windowIndex, 1);
		// 덮여 숨은 창은 움직임을 보일 수 없으니 바로 떼어 낸다.
		const isCovered = !window.isActive();
		window.startCloseMotion();
		if (isCovered || window.isCloseMotionFinished()) {
			this.removeWindowNode(window);
		}
		else {
			this.#closingWindows.push(window);
		}
		this.refreshWindowCovers();
		window.handleClosed();
		this.notifyWindowChange();
	}

	//==============================================================================
	// 창 모두 닫기. (위에서부터)
	//==============================================================================
	closeAllWindows() {
		while (this.#windows.length > 0) {
			const topWindow = this.#windows[this.#windows.length - 1];
			this.closeWindow(topWindow);
		}
	}

	//==============================================================================
	// 맨 위의 창 닫기. (기기의 뒤로 가기 자리, 바깥 닫기를 끈 창이면 닫지 않는다, 닫았으면 true)
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	closeTopWindow() {
		const topWindow = this.getTopWindow();
		if (topWindow === null || !topWindow.isOutsideCloseEnabled()) {
			return false;
		}
		topWindow.close();
		return true;
	}

	//==============================================================================
	// 창 노드 떼어 내기.
	//==============================================================================
	/**
	 * @param { UIWindow } window
	 */
	removeWindowNode(window) {
		window.setWindowLayer(null);
		window.dispose();
		if (window.getParent() === this) {
			this.removeChild(window);
		}
	}

	//==============================================================================
	// 창 덮기. (맨 위의 창만 보이고 아래 창은 숨긴다)
	//==============================================================================
	refreshWindowCovers() {
		const topIndex = this.#windows.length - 1;
		for (let windowIndex = 0; windowIndex < this.#windows.length; ++windowIndex) {
			const window = this.#windows[windowIndex];
			window.setCovered(windowIndex !== topIndex);
		}
	}

	//==============================================================================
	// 창이 뜨거나 닫혔다고 알리기.
	//==============================================================================
	notifyWindowChange() {
		if (this.#windowChangeEvent !== null) {
			this.#windowChangeEvent();
		}
	}

	//==============================================================================
	// 매 프레임. (창들이 움직인 뒤 닫는 움직임이 끝난 창을 떼어 낸다)
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
		const closingWindows = this.#closingWindows.slice();
		for (const window of closingWindows) {
			if (window.isCloseMotionFinished()) {
				this.#closingWindows.splice(this.#closingWindows.indexOf(window), 1);
				this.removeWindowNode(window);
			}
		}
	}

	//==============================================================================
	// 마우스 휠을 맨 위의 창에 넘기기. (창이 받지 않으면 그 자리의 스크롤 뷰, 받았으면 true)
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition
	 * @param { Vector2 } wheelDelta
	 * @returns { boolean }
	 */
	scrollWindowAt(viewInputPosition, wheelDelta) {
		const topWindow = this.getTopWindow();
		if (topWindow === null) {
			return false;
		}
		const isHandled = topWindow.handleWheel(viewInputPosition, wheelDelta);
		if (isHandled) {
			return true;
		}
		const scrollView = UIWindowLayer.findScrollViewAt(topWindow, viewInputPosition);
		if (scrollView === null) {
			return false;
		}
		scrollView.wheel(wheelDelta);
		return true;
	}

	//==============================================================================
	// 그 자리를 덮는 맨 앞(나중에 그리는) 스크롤 뷰 찾기. (켜진 노드만, 없으면 null)
	// - UIScrollView 를 들이지 않으려고 TouchRaycaster 처럼 wheel 과 getScrollContentSize 가 있는 컴포넌트로 본다.
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @param { Vector2 } viewInputPosition
	 * @returns { * }
	 */
	static findScrollViewAt(node, viewInputPosition) {
		if (!node.isActive()) {
			return null;
		}
		const children = node.getChildren();
		for (let childIndex = children.length - 1; childIndex >= 0; --childIndex) {
			const child = children[childIndex];
			if (child instanceof WorldNode) {
				const childScrollView = UIWindowLayer.findScrollViewAt(child, viewInputPosition);
				if (childScrollView !== null) {
					return childScrollView;
				}
			}
		}
		if (!node.contains(viewInputPosition)) {
			return null;
		}
		const components = node.getAllComponents();
		for (const component of components) {
			if (component && component.isEnable() && typeof component.wheel === "function" && typeof component.getScrollContentSize === "function") {
				return component;
			}
		}
		return null;
	}

	//==============================================================================
	// 노드가 들어 있는 창 층 찾기. (자기부터 부모 쪽으로, 없으면 null)
	//==============================================================================
	/**
	 * @param { * } node
	 * @returns { UIWindowLayer | null }
	 */
	static findWindowLayerOf(node) {
		let currentNode = node;
		while (currentNode) {
			if (currentNode instanceof UIWindowLayer) {
				return currentNode;
			}
			currentNode = currentNode.getParent();
		}
		return null;
	}
}
