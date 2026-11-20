//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../base/vector2.js";
import { Pivot } from "../base/pivot.js";
import { Color } from "../base/color.js";
import { WorldNode } from "../core/node/worldnode.js";
import { Paint } from "../core/component/paint.js";
import { Component } from "../core/component.js";
import { UIButton, ButtonState } from "./uibutton.js";
import { UIScrollView } from "./uiscrollview.js";
import { PointerCursor } from "../core/pointercursor.js";

// 단추 반응의 꼴.
//   - normal: 올리면 커지고, 누르는 동안 줄고, 떼면 통 튄다.
//   - inset: 창 안의 단추. 1 배를 넘게 커지지 않아 창 안쪽 여백을 넘지 않는다. 올리면 바탕이 밝아지고 안쪽에 흰 테가 서며, 누르면 조금 줄었다 돌아온다.
export const ButtonMotionStyle = System.Object.freeze({
	normal: "normal",
	inset: "inset",
});
// 꼴마다 올렸을 때, 누르는 동안의 크기와 그리로 가는 초, 떼었을 때 통 튀는 크기(보통 크기에 더해 올라갔다 돌아옴, 1 이면 튀지 않음), 올렸을 때 밝히는지.
const MOTION_STYLES = System.Object.freeze({
	[ButtonMotionStyle.normal]: { hoverScale: 1.06, hoverSeconds: 0.08, pressScale: 0.92, pressSeconds: 0.05, releaseScale: 1.04, isHoverLit: false },
	[ButtonMotionStyle.inset]: { hoverScale: 1, hoverSeconds: 0.08, pressScale: 0.96, pressSeconds: 0.08, releaseScale: 1, isHoverLit: true },
});
const RELEASE_SECONDS = 0.15;
// 밝힐 때 바탕을 흰색 쪽으로 섞는 비와 안쪽 테의 굵기와 색.
const LIT_LIGHTEN = 0.1;
const LIT_RING_WIDTH = 2;
const LIT_RING_COLOR = "rgba(255, 255, 255, 0.4)";
// 누를 수 없을 때 좌우로 흔들리는 폭과 초, 왕복 수.
const SHAKE_DISTANCE = 2;
const SHAKE_SECONDS = 0.25;
const SHAKE_COUNT = 3;
// 크기가 이만큼 보통에 가까우면 다 돌아온 것으로 본다.
const SCALE_EPSILON = 0.001;
// 노드 밑의 단추가 따를 꼴. (창이 제 판에 건다, setButtonMotionArea)
const areaStyles = new System.WeakMap();


//==============================================================================
// 단추 반응. (올리면 커지고, 누르는 동안 줄고, 떼면 통 튀고, 누를 수 없으면 흔들림, 창 안은 커지지 않음, 8.1 절)
//
// 단추 노드에 UIButton 다음으로 붙이면, 프레임마다 그 단추의 상태를 읽어 노드를 가운데를 두고 키우고 줄인다.
// 색은 건드리지 않는다. (글 단추의 바탕과 글자 색은 화면의 코드가 정하고, 그림 단추는 UIButton 의 tint 가 맡음)
// 손가락이 주된 기기는 올림을 쓰지 않는다. (뗀 뒤에도 손가락 자리가 남아 올린 채로 보이지 않게)
// 반응이 없을 때는 노드의 자리와 크기를 건드리지 않아, 다른 곳이 같은 노드를 키우는 연출(나타날 때의 통 튐)과 겹치지 않는다.
// 노드가 커져도 커진 자리가 처음 자리를 다 덮으므로, 올림 판정이 경계에서 떨지 않는다.
// 꼴은 setStyle 로 단추마다 정하거나, 비워 두면 위 노드 가운데 setButtonMotionArea 로 꼴을 건 가장 가까운 것을 따르고, 없으면 보통이다. (창 안은 inset)
// inset 꼴에서 올린 동안은 단추 노드의 맨 밑 자식으로 흰 테 판과 밝힌 바탕 판을 둔다. (바탕이 보이지 않는 단추는 밝히지 않음, 그 둘만은 이 부품이 색을 정함)
//==============================================================================
export class ButtonMotion extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { UIButton | null } */ #button; // 같은 노드의 단추.
	/** @private @type { number } */ #scale; // 지금 크기.
	/** @private @type { number } */ #releaseSeconds; // 통 튀기의 남은 초.
	/** @private @type { number } */ #shakeSeconds; // 흔들림의 남은 초.
	/** @private @type { boolean } */ #wasPressed; // 지난 프레임에 눌려 있었는지.
	/** @private @type { boolean } */ #isMoving; // 노드의 자리와 크기를 바꾸고 있는지. (다 돌아오면 한 번 되돌리고 멈춤)
	/** @private @type { Vector2 | null } */ #basePosition; // 반응하기 전 노드의 자리.
	/** @private @type { Vector2 | null } */ #appliedPosition; // 이 부품이 마지막으로 놓은 자리. (그 사이 화면이 다시 놓았는지 가림)
	/** @private @type { boolean } */ #isCoarse; // 손가락이 주된 기기인지.
	/** @private @type { function(WorldNode, boolean, boolean): void | null } */ #litHandler; // 밝힘을 맡는 함수. (단추 노드, 밝히는지, 누르는 중인지, null 이면 이 부품이 판을 둔다)
	/** @private @type { string } */ #style; // 이 단추의 꼴. (ButtonMotionStyle, 빈 글이면 위 노드에 건 꼴)
	/** @private @type { object | null } */ #litParts; // 올린 동안 밝히는 판. { ringNode, ringPaint, fillNode, fillPaint, fillColor } (처음 밝힐 때 만듦)
	/** @private @type { boolean } */ #isLit; // 지금 밝히고 있는지.
	/** @private @type { Color | null } */ #pressedTintColor; // 단추에 정한 눌림 색. (글로시 껍데기가 그리는 동안은 투명으로 바꿔 두므로 되돌릴 값, 처음 볼 때 읽음)
	/** @private @type { boolean } */ #isPressTintMuted; // 눌림 색을 투명으로 바꿔 두었는지.
	/** @private @type { UIScrollView | null | undefined } */ #scrollView; // 단추를 담은 가장 가까운 스크롤 칸. (없으면 null, 아직 찾지 않았으면 undefined)
	/** @private @type { boolean } */ #wasInputHeld; // 지난 프레임에 손이 눌려 있었는지.
	/** @private @type { object | null } */ #scrollHold; // 스크롤 칸 안에서 이 단추 위로 누름이 시작된 것. ({ x, y } 그때 스크롤 칸이 민 만큼, 아니면 null)

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setComponentType("ButtonMotion");
		this.#button = null;
		this.#scale = 1;
		this.#releaseSeconds = 0;
		this.#shakeSeconds = 0;
		this.#wasPressed = false;
		this.#isMoving = false;
		this.#basePosition = null;
		this.#appliedPosition = null;
		this.#isCoarse = PointerCursor.isCoarsePointer();
		this.#litHandler = null;
		this.#style = "";
		this.#litParts = null;
		this.#isLit = false;
		this.#pressedTintColor = null;
		this.#isPressTintMuted = false;
		this.#scrollView = undefined;
		this.#wasInputHeld = false;
		this.#scrollHold = null;
	}

	//==============================================================================
	// 이 단추의 꼴 정하기. (ButtonMotionStyle, 빈 글이면 위 노드에 건 꼴을 따름)
	//==============================================================================
	/**
	 * @param { string } style
	 */
	setStyle(style) {
		this.#style = style;
	}

	//==============================================================================
	// 이 단추가 따를 꼴. (정한 것, 없으면 위 노드에 건 가장 가까운 꼴, 그것도 없으면 보통)
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @returns { string }
	 */
	readMotionStyle(node) {
		if (this.#style !== "") {
			return this.#style;
		}
		let areaNode = node.getParent();
		while (areaNode !== null && areaNode !== undefined) {
			const areaStyle = areaStyles.get(areaNode);
			if (areaStyle !== undefined) {
				return areaStyle;
			}
			areaNode = areaNode.getParent();
		}
		return ButtonMotionStyle.normal;
	}

	//==============================================================================
	// 붙음. (같은 노드의 단추를 찾아 둠)
	//==============================================================================
	/**
	 * @override
	 * @param { WorldNode } node
	 */
	attach(node) {
		super.attach(node);
		const button = node.getComponent(UIButton);
		this.#button = button !== undefined ? button : null;
	}

	//==============================================================================
	// 누를 수 없을 때 흔들기. (누른 쪽에서 부른다)
	//==============================================================================
	shake() {
		this.#shakeSeconds = SHAKE_SECONDS;
	}

	//==============================================================================
	// 갱신. (단추 상태에 따라 크기를 맞추고, 노드의 가운데를 두고 놓음)
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		const button = this.#button;
		const node = this.getNode();
		if (button === null || button === undefined || node === null) {
			return;
		}
		const buttonState = button.getButtonState();
		const isPressed = buttonState === ButtonState.pressed || this.readScrollPressed(node, buttonState);
		const isHovered = buttonState === ButtonState.hover && !this.#isCoarse;
		// 꼴은 반응하는 동안만 읽는다. (위 노드를 거슬러 오르므로 가만히 있는 단추는 건너뜀)
		const isReacting = isPressed || isHovered || this.#wasPressed || this.#isMoving || this.#isLit;
		const motion = MOTION_STYLES[isReacting ? this.readMotionStyle(node) : ButtonMotionStyle.normal];
		// 눌렀다 떼었는데 손이 아직 단추 위면 누른 것이라 통 튄다. (밖으로 끌고 나가 뗀 것은 누르지 않은 것, 튀지 않는 꼴은 그대로 돌아옴)
		if (this.#wasPressed && !isPressed && buttonState !== ButtonState.disabled && this.isInputOver(node) && motion.releaseScale > 1) {
			this.#releaseSeconds = RELEASE_SECONDS;
		}
		this.#wasPressed = isPressed;
		let targetScale = 1;
		let seconds = motion.hoverSeconds;
		if (isPressed) {
			targetScale = motion.pressScale;
			seconds = motion.pressSeconds;
		}
		else if (isHovered) {
			targetScale = motion.hoverScale;
		}
		// 창 안 꼴은 마우스를 올린 동안 바탕을 밝히고 안쪽에 흰 테를 둔다. (손가락이 주된 기기는 밝히지 않음)
		const isLit = motion.isHoverLit && !this.#isCoarse && (isHovered || isPressed);
		this.placeLitParts(node, isLit, isPressed);
		const step = timeDelta > 0 ? System.Math.min(1, timeDelta / seconds) : 0;
		this.#scale += (targetScale - this.#scale) * step;
		let scale = this.#scale;
		if (this.#releaseSeconds > 0) {
			this.#releaseSeconds = System.Math.max(0, this.#releaseSeconds - timeDelta);
			const releaseRatio = 1 - this.#releaseSeconds / RELEASE_SECONDS;
			scale += (MOTION_STYLES[ButtonMotionStyle.normal].releaseScale - 1) * System.Math.sin(releaseRatio * System.Math.PI);
		}
		let shakeOffset = 0;
		if (this.#shakeSeconds > 0) {
			this.#shakeSeconds = System.Math.max(0, this.#shakeSeconds - timeDelta);
			const shakeRatio = 1 - this.#shakeSeconds / SHAKE_SECONDS;
			shakeOffset = System.Math.sin(shakeRatio * System.Math.PI * 2 * SHAKE_COUNT) * SHAKE_DISTANCE * (1 - shakeRatio);
		}
		const isResting = System.Math.abs(scale - 1) < SCALE_EPSILON && this.#releaseSeconds <= 0 && this.#shakeSeconds <= 0 && targetScale === 1;
		if (isResting && !this.#isMoving) {
			return;
		}
		this.placeAround(node, isResting ? 1 : scale, isResting ? 0 : shakeOffset);
		this.#isMoving = !isResting;
		if (isResting) {
			this.#scale = 1;
			this.#basePosition = null;
			this.#appliedPosition = null;
		}
	}

	//==============================================================================
	// 단추의 눌림 색을 투명으로 바꾸거나 되돌리기. (글로시 껍데기가 눌림을 그리는 동안 투명, 껍데기를 끄면 정한 색)
	//==============================================================================
	/**
	 * @param { boolean } isMuted
	 */
	mutePressTint(isMuted) {
		const button = this.#button;
		if (button === null || isMuted === this.#isPressTintMuted) {
			return;
		}
		if (this.#pressedTintColor === null) {
			const pressedTintColor = button.getPressedTintColor();
			this.#pressedTintColor = new Color(pressedTintColor.red, pressedTintColor.green, pressedTintColor.blue, pressedTintColor.alpha);
		}
		const savedTintColor = this.#pressedTintColor;
		const tintColor = isMuted ? new Color(savedTintColor.red, savedTintColor.green, savedTintColor.blue, 0) : new Color(savedTintColor.red, savedTintColor.green, savedTintColor.blue, savedTintColor.alpha);
		button.setPressedTintColor(tintColor);
		this.#isPressTintMuted = isMuted;
	}

	//==============================================================================
	// 스크롤 칸 안에서 누르고 있는지. (엔진은 스크롤 칸 안 단추에 누르는 동안 눌림을 주지 않으므로, 누름이 이 단추 위에서 시작했고 손이 아직 단추 위이며 스크롤 칸이 밀리지 않았으면 눌린 것으로 그림, 밀리기 시작하면 풂)
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @param { string } buttonState
	 * @returns { boolean }
	 */
	readScrollPressed(node, buttonState) {
		const scrollView = this.readScrollView(node);
		const engine = System.vanillaEngine;
		if (scrollView === null || !engine) {
			return false;
		}
		const inputManager = engine.getInputManager();
		const isInputHeld = inputManager.isTouchMoved();
		const isHoldStarted = isInputHeld && !this.#wasInputHeld;
		this.#wasInputHeld = isInputHeld;
		if (!isInputHeld || buttonState === ButtonState.disabled) {
			this.#scrollHold = null;
			return false;
		}
		const scrollOffset = scrollView.getScrollOffset();
		if (isHoldStarted) {
			this.#scrollHold = this.isInputOver(node) ? { x: scrollOffset.x, y: scrollOffset.y } : null;
		}
		const scrollHold = this.#scrollHold;
		if (scrollHold === null) {
			return false;
		}
		if (System.Math.abs(scrollOffset.x - scrollHold.x) > 1 || System.Math.abs(scrollOffset.y - scrollHold.y) > 1) {
			this.#scrollHold = null;
			return false;
		}
		return this.isInputOver(node);
	}

	//==============================================================================
	// 단추를 담은 가장 가까운 스크롤 칸. (처음 한 번 위 노드를 거슬러 찾아 둠, 없으면 null)
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @returns { UIScrollView | null }
	 */
	readScrollView(node) {
		if (this.#scrollView !== undefined) {
			return this.#scrollView;
		}
		let scrollView = null;
		let parentNode = node.getParent();
		while (parentNode !== null && parentNode !== undefined && scrollView === null) {
			const foundScrollView = typeof parentNode.getComponent === "function" ? parentNode.getComponent(UIScrollView) : undefined;
			if (foundScrollView !== null && foundScrollView !== undefined) {
				scrollView = foundScrollView;
			}
			parentNode = parentNode.getParent();
		}
		// 아직 창에 붙기 전이면 다음에 다시 찾는다.
		if (scrollView !== null || node.getParent() !== null) {
			this.#scrollView = scrollView;
		}
		return scrollView;
	}

	//==============================================================================
	// 밝힌 판 놓기. (흰 테 판은 단추 크기, 밝힌 바탕 판은 테 굵기만큼 안쪽, 둘 다 단추의 맨 밑 자식이라 글과 그림 밑)
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @param { boolean } isLit
	 * @param { boolean } isPressed
	 */
	placeLitParts(node, isLit, isPressed) {
		// 밝히는 함수를 걸었으면 그 함수가 같은 꼴로 밝힌다. (단추에 얹은 꾸밈이 제 모양으로 밝힐 때, 판을 따로 그리면 꾸밈과 다른 꼴이 비친다)
		// 그때는 단추의 눌림 색이 꾸밈을 덮지 않게 눌림 색을 투명으로 둔다.
		const litHandler = this.getLitHandler();
		const hasLitHandler = litHandler !== null;
		this.mutePressTint(hasLitHandler);
		if (hasLitHandler) {
			litHandler(node, isLit, isPressed);
			return;
		}
		const paint = isLit ? node.getComponent(Paint) : null;
		const color = paint !== null && paint !== undefined ? paint.getColor() : null;
		// 바탕이 보이지 않는 단추(누르는 자리만)는 밝히지 않는다.
		const isShown = color instanceof Color && color.alpha > 0;
		if (!isShown) {
			if (this.#isLit) {
				this.#isLit = false;
				this.#litParts.ringNode.setActive(false);
				this.#litParts.fillNode.setActive(false);
			}
			return;
		}
		if (this.#litParts === null) {
			this.#litParts = this.createLitParts(node);
		}
		const litParts = this.#litParts;
		const contentSize = node.getContentSize();
		const roundSize = paint.getRoundSize();
		litParts.ringNode.setActive(true);
		litParts.ringNode.setLocalPosition(Vector2.create(0, 0));
		litParts.ringNode.setContentSize(Vector2.create(contentSize.x, contentSize.y));
		litParts.ringPaint.setRoundSize(roundSize);
		const fillWidth = System.Math.max(0, contentSize.x - LIT_RING_WIDTH * 2);
		const fillHeight = System.Math.max(0, contentSize.y - LIT_RING_WIDTH * 2);
		litParts.fillNode.setActive(true);
		litParts.fillNode.setLocalPosition(Vector2.create(LIT_RING_WIDTH, LIT_RING_WIDTH));
		litParts.fillNode.setContentSize(Vector2.create(fillWidth, fillHeight));
		litParts.fillPaint.setRoundSize(System.Math.max(0, roundSize - LIT_RING_WIDTH));
		// 밝힌 바탕은 단추 바탕을 흰색 쪽으로 섞은 색. (화면의 코드가 바탕색을 바꿔도 따라감)
		const fillColor = litParts.fillColor;
		fillColor.red = color.red + (1 - color.red) * LIT_LIGHTEN;
		fillColor.green = color.green + (1 - color.green) * LIT_LIGHTEN;
		fillColor.blue = color.blue + (1 - color.blue) * LIT_LIGHTEN;
		fillColor.alpha = color.alpha;
		this.#isLit = true;
	}

	//==============================================================================
	// 밝힌 판 만들기. (단추 노드의 맨 밑 자식 둘, 단추의 눌림 색은 받지 않음)
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @returns { object } { ringNode, ringPaint, fillNode, fillPaint, fillColor }
	 */
	createLitParts(node) {
		const createLitNode = (name, siblingIndex) => {
			const litNode = new WorldNode();
			litNode.setName(node.getName() + name);
			litNode.setPivot(Pivot.topLeft);
			litNode.setAnchor(Pivot.topLeft);
			node.addChild(litNode);
			litNode.setSiblingIndex(siblingIndex);
			if (this.#button !== null) {
				this.#button.excludeNodeFromTint(litNode);
			}
			return litNode;
		};
		const ringNode = createLitNode("LitRing", 0);
		const ringPaint = ringNode.addComponent(Paint);
		ringPaint.setColor(LIT_RING_COLOR);
		const fillNode = createLitNode("LitFill", 1);
		const fillPaint = fillNode.addComponent(Paint);
		const fillColor = new Color(1, 1, 1, 1);
		fillPaint.setColor(fillColor);
		return { ringNode: ringNode, ringPaint: ringPaint, fillNode: fillNode, fillPaint: fillPaint, fillColor: fillColor };
	}

	//==============================================================================
	// 손(마우스나 손가락)이 노드 위인지.
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @returns { boolean }
	 */
	isInputOver(node) {
		const engine = System.vanillaEngine;
		if (!engine) {
			return false;
		}
		const inputManager = engine.getInputManager();
		const viewInputPosition = inputManager.getViewInputPosition();
		return node.contains(viewInputPosition);
	}

	//==============================================================================
	// 노드를 가운데를 두고 그 크기로 놓기. (노드는 왼쪽 위가 기준이라 커진 만큼 자리를 옮김)
	//   - 그 사이 화면이 노드를 다시 놓았으면(자리가 이 부품이 놓은 것과 다르면) 그 자리를 새 기준으로 삼는다.
	//==============================================================================
	/**
	 * @param { WorldNode } node
	 * @param { number } scale
	 * @param { number } shakeOffset
	 */
	placeAround(node, scale, shakeOffset) {
		const localPosition = node.getLocalPosition();
		const appliedPosition = this.#appliedPosition;
		const isMovedByLayout = appliedPosition === null || appliedPosition.x !== localPosition.x || appliedPosition.y !== localPosition.y;
		if (isMovedByLayout || this.#basePosition === null) {
			this.#basePosition = Vector2.create(localPosition.x, localPosition.y);
		}
		const basePosition = this.#basePosition;
		const contentSize = node.getContentSize();
		const positionX = basePosition.x - contentSize.x * (scale - 1) * 0.5 + shakeOffset;
		const positionY = basePosition.y - contentSize.y * (scale - 1) * 0.5;
		const position = Vector2.create(positionX, positionY);
		node.setLocalPosition(position);
		node.setLocalScale(Vector2.create(scale, scale));
		this.#appliedPosition = Vector2.create(positionX, positionY);
	}

	//==============================================================================
	// 밝힘을 맡는 함수 설정. (단추에 얹은 꾸밈이 제 모양으로 밝힐 때, null 이면 이 부품이 흰 테 판과 밝힌 바탕 판을 둔다)
	//==============================================================================
	/**
	 * @param { function(WorldNode, boolean, boolean): void | null } litHandler - (단추 노드, 밝히는지, 누르는 중인지)
	 */
	setLitHandler(litHandler) {
		this.#litHandler = litHandler;
	}

	//==============================================================================
	// 밝힘을 맡는 함수 반환.
	//==============================================================================
	/**
	 * @returns { function(WorldNode, boolean, boolean): void | null }
	 */
	getLitHandler() {
		return this.#litHandler;
	}
}

//==============================================================================
// 단추 노드에 반응 붙이기. (UIButton 이 이미 붙은 노드, ButtonMotion 을 돌려줌)
//==============================================================================
/**
 * @param { WorldNode } node
 * @returns { ButtonMotion }
 */
export function attachButtonMotion(node) {
	return node.addComponent(ButtonMotion);
}

//==============================================================================
// 노드 밑의 단추가 따를 꼴 걸기. (창이 제 판에 inset 을 걸면 그 안의 단추는 커지지 않음, 단추가 setStyle 로 정한 꼴이 먼저)
//==============================================================================
/**
 * @param { WorldNode } node
 * @param { string } style ButtonMotionStyle
 */
export function setButtonMotionArea(node, style) {
	areaStyles.set(node, style);
}

//==============================================================================
// 누를 수 없는 단추를 흔들기. (반응이 붙은 단추만, 그 밖은 아무 일도 없음)
//==============================================================================
/**
 * @param { WorldNode } node
 */
export function shakeButton(node) {
	const buttonMotion = node.getComponent(ButtonMotion);
	if (buttonMotion === null || buttonMotion === undefined) {
		return;
	}
	buttonMotion.shake();
}
