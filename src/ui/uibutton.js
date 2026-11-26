//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Enum } from "../base/identifier.js";
import { Graphic } from "../core/graphic.js";
import { UIControl } from "./uicontrol.js";
import { Color } from "../base/color.js";
import * as Math from "../base/math.js";
import { Sprite } from "../core/component/sprite.js";
import { Text } from "../core/component/text.js";
import { Paint } from "../core/component/paint.js";
import { UIImageView } from "./uiimageview.js";
import { UILabel } from "./uilabel.js";
import { PointerCursor } from "../core/pointercursor.js";


//==============================================================================
// 버튼 상태.
//==============================================================================
export const ButtonState = {
	normal: Enum.begin(), // 평상시 상태.
	hover: Enum.auto(), // 포인터가 올라간 상태.
	pressed: Enum.auto(), // 눌려 있는 상태.
	released: Enum.auto(), // 막 뗀 상태.
	disabled: Enum.auto() // 눌러도 반응하지 않는 상태.
};


//==============================================================================
// 버튼.
//==============================================================================
/**
 * @example <caption>글자가 있는 단추 만들기</caption>
 * import { Engine, EngineConfiguration, UIScene, UIButton, UILabel, Paint, WorldNode, Pivot, Vector2, Color } from "./build/vanilla.js";
 *
 * class MainScene extends UIScene {
 * 	constructor() {
 * 		super();
 * 		this.setLoadingMinDurationMs(0);
 * 	}
 *
 * 	initialize(engine) {
 * 		super.initialize(engine);
 * 		const buttonNode = new WorldNode();
 * 		buttonNode.setPivot(Pivot.topLeft);
 * 		buttonNode.setAnchor(Pivot.topLeft);
 * 		buttonNode.setLocalPosition(Vector2.create(40, 40));
 * 		buttonNode.setContentSize(Vector2.create(200, 60));
 * 		const paint = buttonNode.addComponent(Paint);
 * 		paint.setColor(new Color(0.2, 0.45, 0.85, 1));
 * 		paint.setRoundSize(12);
 * 		const label = buttonNode.addComponent(UILabel);
 * 		label.setText("Start");
 * 		label.setFontSize(24);
 * 		const button = buttonNode.addComponent(UIButton);
 * 		button.setPressedTintColor(new Color(0, 0, 0, 0.35));
 * 		button.setTransitionDuration(0.15);
 * 		button.setClickedEvent((clickedButton) => {
 * 			console.log("start", clickedButton.getButtonState());
 * 		});
 * 		const root = this.getRoot();
 * 		root.addChild(buttonNode);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * engineConfiguration.canvasId = "mainCanvas";
 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
 * engineConfiguration.autoResizeOnWindowResize = true;
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
export class UIButton extends UIControl {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { ButtonState } */ #buttonState;
	/** @private @type { function(UIButton): boolean } */ #clickEvent;
	/** @private @type { function(UIButton): void } */ #pressedEvent;
	/** @private @type { function(UIButton): void } */ #releasedEvent;
	/** @private @type { function(UIButton): void } */ #clickedEvent;
	/** @private @type { boolean } */ #isPressTracking;
	/** @private @type { number } */ #minimumPressedSeconds; // 눌린 그림을 보여 줄 최소 시간. (0 이면 즉시)
	/** @private @type { number } */ #pressedElapsedSeconds; // 이번 누름이 이어진 시간.
	/** @private @type { object | null } */ #pendingRelease; // 최소 시간을 채우려고 미뤄 둔 뗌 처리.
	/** @private @type { function(UIButton): void } */ #longPressedEvent; // 길게 누름 알림. (한 번만)
	/** @private @type { number } */ #longPressSeconds; // 길게 누름 판정 시간.
	/** @private @type { boolean } */ #hasLongPressFired; // 이번 누름에서 길게 누름이 발화했는지.
	/** @private @type { Color } */ #pressedTintColor;
	/** @private @type { Color } */ #hoverTintColor;
	/** @private @type { function(UIButton): void } */ #hoverEvent;
	/** @private @type { number } */ #transitionDuration;
	/** @private @type { number } */ #tintProgress;
	/** @private @type { Array } */ #colorEntries;
	/** @private @type { boolean } */ #isInteractable;
	/** @private @type { Color } */ #disabledTintColor;
	/** @private @type { Set } */ #tintExcludedNodes;       // 이 Set 에 든 노드는 자신과 모든 자손 노드까지 트랜지션에서 제외.
	/** @private @type { Set } */ #tintExcludedComponents;  // 이 Set 에 든 컴포넌트만 개별 제외.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @construct
	 */
	constructor() {
		super();
		this.setComponentType("Button");
		this.#buttonState = ButtonState.normal;
		this.#clickEvent = null;
		this.#pressedEvent = null;
		this.#releasedEvent = null;
		this.#clickedEvent = null;
		this.#isPressTracking = false;
		this.#minimumPressedSeconds = 0;
		this.#pressedElapsedSeconds = 0;
		this.#pendingRelease = null;
		this.#longPressedEvent = null;
		this.#longPressSeconds = 0.5;
		this.#hasLongPressFired = false;
		this.#pressedTintColor = new Color(0, 0, 0, 0.3);
		this.#hoverTintColor = new Color(1, 1, 1, 0.12);
		this.#hoverEvent = null;
		this.#transitionDuration = 0.3;
		this.#tintProgress = 0;
		this.#colorEntries = [];
		this.#isInteractable = true;
		this.#disabledTintColor = new Color(0, 0, 0, 0.5);
		this.#tintExcludedNodes = new Set();
		this.#tintExcludedComponents = new Set();
	}

	//==============================================================================
	// 트랜지션 대상에서 노드를 제외. 해당 노드 자신과 모든 자손 노드의 컴포넌트가
	// 색상 수집에서 제외된다.
	//==============================================================================
	/**
	 * @param { ComponentNode } node 틴트에서 뺄 노드. (자손 노드까지 빠진다)
	 * @example <caption>단추 안의 배지는 틴트하지 않기</caption>
	 * import { Engine, EngineConfiguration, UIScene, UIButton, Paint, WorldNode, Pivot, Vector2, Color } from "./build/vanilla.js";
	 *
	 * class MainScene extends UIScene {
	 * 	constructor() {
	 * 		super();
	 * 		this.setLoadingMinDurationMs(0);
	 * 	}
	 *
	 * 	initialize(engine) {
	 * 		super.initialize(engine);
	 * 		const buttonNode = new WorldNode();
	 * 		buttonNode.setPivot(Pivot.topLeft);
	 * 		buttonNode.setAnchor(Pivot.topLeft);
	 * 		buttonNode.setLocalPosition(Vector2.create(40, 40));
	 * 		buttonNode.setContentSize(Vector2.create(200, 60));
	 * 		const paint = buttonNode.addComponent(Paint);
	 * 		paint.setColor(new Color(0.2, 0.45, 0.85, 1));
	 *
	 * 		const badgeNode = new WorldNode();
	 * 		badgeNode.setPivot(Pivot.topLeft);
	 * 		badgeNode.setAnchor(Pivot.topLeft);
	 * 		badgeNode.setLocalPosition(Vector2.create(176, -8));
	 * 		badgeNode.setContentSize(Vector2.create(24, 24));
	 * 		const badgePaint = badgeNode.addComponent(Paint);
	 * 		badgePaint.setColor(new Color(0.9, 0.2, 0.2, 1));
	 * 		badgePaint.setRoundSize(12);
	 * 		buttonNode.addChild(badgeNode);
	 *
	 * 		const button = buttonNode.addComponent(UIButton);
	 * 		button.excludeNodeFromTint(badgeNode);
	 * 		const root = this.getRoot();
	 * 		root.addChild(buttonNode);
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.canvasId = "mainCanvas";
	 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
	 * engineConfiguration.autoResizeOnWindowResize = true;
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	excludeNodeFromTint(node) {
		this.#tintExcludedNodes.add(node);
	}

	//==============================================================================
	// 트랜지션 대상에서 특정 컴포넌트만 제외.
	//==============================================================================
	/**
	 * @param { Component } component 틴트에서 뺄 컴포넌트.
	 */
	excludeComponentFromTint(component) {
		this.#tintExcludedComponents.add(component);
	}

	//==============================================================================
	// 제외 목록 초기화.
	//==============================================================================
	clearTintExclusions() {
		this.#tintExcludedNodes.clear();
		this.#tintExcludedComponents.clear();
	}

	//==============================================================================
	// 노드에 붙음. (노드의 isInteractable 을 자동 활성화, WorldNode 와 UINode)
	//==============================================================================
	/**
	 * @override
	 * @param { ComponentNode } node 붙을 노드.
	 */
	attach(node) {
		super.attach(node);
		if (typeof node.setInteractable === "function") {
			node.setInteractable(true);
		}
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
		if (this.#isPressTracking) {
			this.#pressedElapsedSeconds += timeDelta;

			// 길게 누름. (임계 시간을 넘기는 순간 한 번만 알린다)
			if (this.#longPressedEvent && !this.#hasLongPressFired && this.#pressedElapsedSeconds >= this.#longPressSeconds) {
				this.#hasLongPressFired = true;
				this.#longPressedEvent(this);
			}
		}

		// 최소 눌림 표시 시간을 채우려고 미뤄 둔 뗌 처리를 마저 한다.
		if (this.#pendingRelease) {
			this.#pendingRelease.remainSeconds -= timeDelta;
			if (this.#pendingRelease.remainSeconds <= 0) {
				const releasePosition = this.#pendingRelease.viewInputPosition;
				this.#pendingRelease = null;
				this.performRelease(releasePosition);
			}
		}
		this.updateHoverState();
		this.updateTintTransition(timeDelta);

		// 마우스가 올라 있거나 누르는 중이면 커서에 알린다. (PointerCursor 가 켜져 있을 때만 커서가 바뀐다)
		const buttonState = this.getButtonState();
		if (this.getInteractable() && (buttonState === ButtonState.hover || buttonState === ButtonState.pressed)) {
			const pointerCursor = PointerCursor.getInstance();
			pointerCursor.markOverButton();
		}
	}

	//==============================================================================
	// 마우스 오버 상태 갱신.
	// - 누르고 있는 중이거나 사용 불가일 때는 건드리지 않는다.
	// - 엔진 인스턴스는 전역 접근자로 얻어 순환 참조를 만들지 않는다.
	//==============================================================================
	updateHoverState() {
		if (!this.getInteractable()) {
			return;
		}
		const currentButtonState = this.getButtonState();
		if (currentButtonState === ButtonState.pressed || currentButtonState === ButtonState.disabled) {
			return;
		}
		const engine = System.vanillaEngine;
		if (!engine) {
			return;
		}
		const node = this.getNode();
		if (!node) {
			return;
		}
		const inputManager = engine.getInputManager();
		const viewInputPosition = inputManager.getViewInputPosition();
		const isHovering = node.contains(viewInputPosition);
		if (isHovering && currentButtonState !== ButtonState.hover) {
			this.setButtonState(ButtonState.hover);
			this.collectColorTargets();
			this.#tintProgress = 0;
			const hoverEvent = this.getHoverEvent();
			if (hoverEvent) {
				hoverEvent(this);
			}
		}
		else if (!isHovering && currentButtonState === ButtonState.hover) {
			this.setButtonState(ButtonState.normal);
			this.collectColorTargets();
			this.#tintProgress = 0;
		}
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic 그래픽.
	 */
	draw(graphic) {
		// super.draw(graphic);
	}

	//==============================================================================
	// 터치 누름. (TouchRaycaster → WorldNode → Button)
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 누른 자리. (뷰 좌표)
	 */
	touchPress(viewInputPosition) {
		if (!this.getInteractable()) {
			return;
		}
		this.#isPressTracking = true;
		this.#pressedElapsedSeconds = 0;
		this.#pendingRelease = null;
		this.#hasLongPressFired = false;
		this.setButtonState(ButtonState.pressed);
		this.collectColorTargets();
		const pressedEvent = this.getPressedEvent();
		if (pressedEvent) {
			pressedEvent(this);
		}
	}

	//==============================================================================
	// 터치 뗌. (TouchRaycaster → WorldNode → Button)
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 뗀 자리. (뷰 좌표)
	 */
	touchRelease(viewInputPosition) {
		if (!this.getInteractable()) {
			return;
		}
		if (!this.#isPressTracking) {
			return;
		}
		this.#isPressTracking = false;

		// 최소 눌림 표시 시간을 아직 못 채웠으면, 그만큼 눌린 모습을 유지한 뒤 처리한다.
		if (this.#minimumPressedSeconds > 0 && this.#pressedElapsedSeconds < this.#minimumPressedSeconds) {
			this.#pendingRelease = {
				viewInputPosition: viewInputPosition,
				remainSeconds: this.#minimumPressedSeconds - this.#pressedElapsedSeconds,
			};
			return;
		}
		this.performRelease(viewInputPosition);
	}

	//==============================================================================
	// 뗌 처리 본문.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 뗀 자리. (뷰 좌표, 노드 안이면 클릭으로 친다)
	 */
	performRelease(viewInputPosition) {
		this.setButtonState(ButtonState.released);
		this.#tintProgress = 0;
		this.applyTintProgress(0);
		const releasedEvent = this.getReleasedEvent();
		if (releasedEvent) {
			releasedEvent(this);
		}
		const node = this.getNode();
		const isInsideBounds = node.contains(viewInputPosition);
		if (isInsideBounds && !this.#hasLongPressFired) {
			this.fireClickEvents();
		}
		this.setButtonState(ButtonState.normal);
	}

	//==============================================================================
	// 클릭 알림만 부르기. (누르지 않고 클릭이 난 것처럼 clicked, click 차례로, UIHitArea 가 넓힌 자리의 클릭을 넘길 때)
	//==============================================================================
	fireClickEvents() {
		const clickedEvent = this.getClickedEvent();
		if (clickedEvent) {
			clickedEvent(this);
		}
		const clickEvent = this.getClickEvent();
		if (clickEvent) {
			clickEvent(this);
		}
	}

	//==============================================================================
	// 터치 취소. (TouchRaycaster → WorldNode → Button)
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 취소된 때의 자리. (뷰 좌표)
	 */
	touchCancel(viewInputPosition) {
		this.#pendingRelease = null;
		if (!this.#isPressTracking) {
			return;
		}
		this.#isPressTracking = false;
		this.#tintProgress = 0;
		this.applyTintProgress(0);
		this.setButtonState(ButtonState.normal);
	}

	//==============================================================================
	// 틴트 트랜지션 갱신.
	//==============================================================================
	/** @private */
	updateTintTransition(timeDelta) {
		if (!this.getInteractable()) {
			this.applyDisabledTint();
			return;
		}
		const buttonState = this.getButtonState();
		const isPressed = buttonState === ButtonState.pressed;
		const isHovering = buttonState === ButtonState.hover;
		const transitionDuration = this.getTransitionDuration();

		if (isPressed || isHovering) {
			this.#tintProgress = Math.min(this.#tintProgress + timeDelta / transitionDuration, 1);
		}
		else {
			this.#tintProgress = Math.max(this.#tintProgress - timeDelta / transitionDuration, 0);
		}

		this.applyTintProgress(this.#tintProgress);
	}

	//==============================================================================
	// 틴트 적용.
	//==============================================================================
	/**
	 * @param { number } progress 틴트 정도. (0 이면 원래 색, 1 이면 틴트 색을 다 씌운다)
	 */
	applyTintProgress(progress) {
		const pressedTintColor = this.getButtonState() === ButtonState.hover ? this.getHoverTintColor() : this.getPressedTintColor();
		for (const colorEntry of this.#colorEntries) {
			if (colorEntry.type === "sprite" || colorEntry.type === "imageview") {
				const overlayAlpha = Math.lerp(0, pressedTintColor.alpha, progress);
				const overlayColor = new Color(pressedTintColor.red, pressedTintColor.green, pressedTintColor.blue, overlayAlpha);
				colorEntry.component.setColor(overlayColor);
			}
			else if (colorEntry.type === "text" || colorEntry.type === "richtext" || colorEntry.type === "uilabel") {
				const originalColor = colorEntry.originalColor;
				const tintedRed = Math.lerp(originalColor.red, pressedTintColor.red, pressedTintColor.alpha * progress);
				const tintedGreen = Math.lerp(originalColor.green, pressedTintColor.green, pressedTintColor.alpha * progress);
				const tintedBlue = Math.lerp(originalColor.blue, pressedTintColor.blue, pressedTintColor.alpha * progress);
				const tintedColor = new Color(tintedRed, tintedGreen, tintedBlue, originalColor.alpha);
				colorEntry.component.setTextColor(tintedColor);
			}
			else if (colorEntry.type === "paint") {
				const originalColor = colorEntry.originalColor;
				const tintedRed = Math.lerp(originalColor.red, pressedTintColor.red, pressedTintColor.alpha * progress);
				const tintedGreen = Math.lerp(originalColor.green, pressedTintColor.green, pressedTintColor.alpha * progress);
				const tintedBlue = Math.lerp(originalColor.blue, pressedTintColor.blue, pressedTintColor.alpha * progress);
				const tintedColor = new Color(tintedRed, tintedGreen, tintedBlue, originalColor.alpha);
				colorEntry.component.setColor(tintedColor);
			}
		}
	}

	//==============================================================================
	// 비활성화 틴트 적용.
	//==============================================================================
	/** @private */
	applyDisabledTint() {
		const disabledTintColor = this.#disabledTintColor;
		for (const colorEntry of this.#colorEntries) {
			if (colorEntry.type === "sprite" || colorEntry.type === "imageview") {
				const overlayColor = new Color(disabledTintColor.red, disabledTintColor.green, disabledTintColor.blue, disabledTintColor.alpha);
				colorEntry.component.setColor(overlayColor);
			}
		}
	}

	//==============================================================================
	// 색상 대상 수집.
	//==============================================================================
	collectColorTargets() {
		this.#colorEntries = [];
		const node = this.getNode();
		if (!node) {
			return;
		}
		this.collectFromNode(node);
	}

	//==============================================================================
	// 노드에서 색상 대상 재귀 수집.
	// - excludeNodeFromTint 로 등록된 노드는 자신과 자손까지 통째로 건너뛴다.
	// - excludeComponentFromTint 로 등록된 컴포넌트는 개별적으로 제외한다.
	//==============================================================================
	/**
	 * @param { ComponentNode } node 훑을 노드. (자식들도 차례로 훑는다)
	 */
	collectFromNode(node) {
		if (this.#tintExcludedNodes.has(node)) {
			return;
		}

		// 노드에 UIImageView 가 있으면 wrapper 를 통해 색을 제어한다.
		// (UIImageView 는 attach 시 내부 Sprite 를 자동 부착하므로
		//  wrapper 가 있는 경우 raw Sprite 를 별도로 잡지 않고 wrapper 만 다룬다)
		const imageViews = node.getComponents(UIImageView);
		if (imageViews.length > 0) {
			for (const imageView of imageViews) {
				if (this.#tintExcludedComponents.has(imageView)) continue;
				this.#colorEntries.push({ type: "imageview", component: imageView });
			}
		}
		else {
			const sprites = node.getComponents(Sprite);
			for (const sprite of sprites) {
				if (this.#tintExcludedComponents.has(sprite)) continue;
				this.#colorEntries.push({ type: "sprite", component: sprite });
			}
		}

		// Paint (단색 배경) 도 라벨처럼 originalColor 를 보관해두고 lerp 한다.
		const paints = node.getComponents(Paint);
		for (const paint of paints) {
			if (this.#tintExcludedComponents.has(paint)) continue;
			const originalColor = paint.getColor();
			const copiedColor = new Color(originalColor.red, originalColor.green, originalColor.blue, originalColor.alpha);
			this.#colorEntries.push({ type: "paint", component: paint, originalColor: copiedColor });
		}

		// 라벨도 동일. UILabel wrapper 가 있으면 wrapper 만, 없으면 raw Text 처리.
		const uiTexts = node.getComponents(UILabel);
		if (uiTexts.length > 0) {
			for (const uiText of uiTexts) {
				if (this.#tintExcludedComponents.has(uiText)) continue;
				const originalColor = uiText.getTextColor();
				const copiedColor = new Color(originalColor.red, originalColor.green, originalColor.blue, originalColor.alpha);
				this.#colorEntries.push({ type: "uilabel", component: uiText, originalColor: copiedColor });
			}
		}
		else {
			const labelComponents = node.getComponents(Text);
			for (const labelComponent of labelComponents) {
				if (this.#tintExcludedComponents.has(labelComponent)) continue;
				const originalColor = labelComponent.getTextColor();
				const copiedColor = new Color(originalColor.red, originalColor.green, originalColor.blue, originalColor.alpha);
				this.#colorEntries.push({ type: "text", component: labelComponent, originalColor: copiedColor });
			}
		}

		const children = node.getChildren();
		for (const child of children) {
			this.collectFromNode(child);
		}
	}

	//==============================================================================
	// 버튼 상태 변경.
	//==============================================================================
	/**
	 * @param { ButtonState } buttonState 버튼 상태. (ButtonState 의 값)
	 */
	setButtonState(buttonState) {
		if (this.getButtonState() === buttonState) {
			return;
		}
		const previousButtonState = this.getButtonState();
		this.#buttonState = buttonState;
	}

	//==============================================================================
	// 버튼 상태 반환.
	//==============================================================================
	/**
	 * @returns { ButtonState } 지금 버튼 상태. (ButtonState 의 값)
	 */
	getButtonState() {
		return this.#buttonState;
	}

	//==============================================================================
	// 길게 누름 알림 설정. (임계 시간을 넘기면 한 번 알리고, 그 누름의 클릭은 삼킨다)
	//==============================================================================
	/**
	 * @param { function(UIButton): void } longPressedEvent 길게 누르면 한 번 부를 함수. (인자는 이 버튼, null 이면 길게 누름을 보지 않는다)
	 * @example <caption>길게 누르면 지우고 짧게 누르면 열기</caption>
	 * import { Engine, EngineConfiguration, UIScene, UIButton, Paint, WorldNode, Pivot, Vector2, Color } from "./build/vanilla.js";
	 *
	 * class MainScene extends UIScene {
	 * 	constructor() {
	 * 		super();
	 * 		this.setLoadingMinDurationMs(0);
	 * 		this.button = null;
	 * 	}
	 *
	 * 	initialize(engine) {
	 * 		super.initialize(engine);
	 * 		const itemNode = new WorldNode();
	 * 		itemNode.setPivot(Pivot.topLeft);
	 * 		itemNode.setAnchor(Pivot.topLeft);
	 * 		itemNode.setLocalPosition(Vector2.create(40, 40));
	 * 		itemNode.setContentSize(Vector2.create(96, 96));
	 * 		const paint = itemNode.addComponent(Paint);
	 * 		paint.setColor(new Color(0.3, 0.3, 0.35, 1));
	 * 		const button = itemNode.addComponent(UIButton);
	 * 		button.setLongPressSeconds(0.8);
	 * 		button.setLongPressedEvent(() => {
	 * 			console.log("delete item");
	 * 		});
	 * 		button.setClickedEvent(() => {
	 * 			console.log("open item");
	 * 		});
	 * 		this.button = button;
	 * 		const root = this.getRoot();
	 * 		root.addChild(itemNode);
	 * 	}
	 *
	 * 	tick(timeDelta) {
	 * 		super.tick(timeDelta);
	 * 		if (this.button !== null) {
	 * 			const pressedSeconds = this.button.getPressedElapsedSeconds();
	 * 			const longPressSeconds = this.button.getLongPressSeconds();
	 * 			const gaugeRatio = Math.min(1, pressedSeconds / longPressSeconds);
	 * 			if (gaugeRatio > 0) {
	 * 				console.log("hold", gaugeRatio);
	 * 			}
	 * 		}
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.canvasId = "mainCanvas";
	 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
	 * engineConfiguration.autoResizeOnWindowResize = true;
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	setLongPressedEvent(longPressedEvent) {
		this.#longPressedEvent = longPressedEvent;
	}

	//==============================================================================
	// 길게 누름 판정 시간 설정. (초)
	//==============================================================================
	/**
	 * @param { number } longPressSeconds 길게 누름으로 볼 시간. (초, 기본 0.5)
	 */
	setLongPressSeconds(longPressSeconds) {
		this.#longPressSeconds = longPressSeconds;
	}

	//==============================================================================
	// 이번 누름이 이어진 시간 반환. (게이지 연출용)
	//==============================================================================
	/**
	 * @returns { number } 이번 누름이 이어진 시간. (초, 누르고 있지 않으면 0)
	 */
	getPressedElapsedSeconds() {
		return this.#isPressTracking ? this.#pressedElapsedSeconds : 0;
	}

	//==============================================================================
	// 길게 누름 판정 시간 반환.
	//==============================================================================
	/**
	 * @returns { number } 길게 누름 판정 시간. (초)
	 */
	getLongPressSeconds() {
		return this.#longPressSeconds;
	}

	//==============================================================================
	// 최소 눌림 표시 시간 설정. (짧게 톡 눌러도 이 시간만큼 눌린 모습을 보인 뒤 클릭을 부른다)
	//==============================================================================
	/**
	 * @param { number } minimumPressedSeconds 눌린 모습을 보여 줄 가장 짧은 시간. (초, 0 보다 작으면 0, 기본 0 이면 바로)
	 */
	setMinimumPressedSeconds(minimumPressedSeconds) {
		this.#minimumPressedSeconds = System.Math.max(0, minimumPressedSeconds);
	}

	//==============================================================================
	// 최소 눌림 표시 시간 반환.
	//==============================================================================
	/**
	 * @returns { number } 최소 눌림 표시 시간. (초)
	 */
	getMinimumPressedSeconds() {
		return this.#minimumPressedSeconds;
	}

	//==============================================================================
	// 클릭 이벤트 설정.
	//==============================================================================
	/**
	 * @param { function(UIButton): boolean } callback 클릭이 나면 클릭됨 이벤트 다음에 부를 함수. (인자는 이 버튼, 돌려준 값은 쓰지 않는다, null 이면 부르지 않는다)
	 */
	setClickEvent(callback) {
		this.#clickEvent = callback;
	}

	//==============================================================================
	// 클릭 이벤트 설정.
	//==============================================================================
	/**
	 * @param { ButtonState } buttonState 버튼 상태. (지금은 쓰지 않는다)
	 * @param { function(UIButton): boolean } callback 그 상태에 걸 함수. (지금은 담지 않는다)
	 */
	setStateEvent(buttonState, callback) {
		// this.#clickEvent = callback;
		switch (buttonState) {
			case ButtonState.normal: {
					break;
				}
		}
	}

	//==============================================================================
	// 클릭 이벤트 반환.
	//==============================================================================
	/**
	 * @returns { function(UIButton): boolean } 클릭 이벤트 함수. (없으면 null)
	 */
	getClickEvent() {
		return this.#clickEvent;
	}

	//==============================================================================
	// 누름 이벤트 설정.
	//==============================================================================
	/**
	 * @param { function(UIButton): void } callback 누르면 부를 함수. (인자는 이 버튼, 누를 수 없는 상태면 부르지 않는다)
	 */
	setPressedEvent(callback) {
		this.#pressedEvent = callback;
	}

	//==============================================================================
	// 누름 이벤트 반환.
	//==============================================================================
	/**
	 * @returns { function(UIButton): void } 누름 이벤트 함수. (없으면 null)
	 */
	getPressedEvent() {
		return this.#pressedEvent;
	}

	//==============================================================================
	// 뗌 이벤트 설정.
	//==============================================================================
	/**
	 * @param { function(UIButton): void } callback 누른 뒤 떼면 부를 함수. (인자는 이 버튼, 노드 밖에서 떼도 부른다)
	 */
	setReleasedEvent(callback) {
		this.#releasedEvent = callback;
	}

	//==============================================================================
	// 뗌 이벤트 반환.
	//==============================================================================
	/**
	 * @returns { function(UIButton): void } 뗌 이벤트 함수. (없으면 null)
	 */
	getReleasedEvent() {
		return this.#releasedEvent;
	}

	//==============================================================================
	// 클릭됨 이벤트 설정.
	//==============================================================================
	/**
	 * @param { function(UIButton): void } callback 누른 뒤 노드 안에서 떼면 부를 함수. (인자는 이 버튼, 길게 누름을 알렸으면 부르지 않는다, null 이면 부르지 않는다)
	 */
	setClickedEvent(callback) {
		this.#clickedEvent = callback;
	}

	//==============================================================================
	// 클릭됨 이벤트 반환.
	//==============================================================================
	/**
	 * @returns { function(UIButton): void } 클릭됨 이벤트 함수. (없으면 null)
	 */
	getClickedEvent() {
		return this.#clickedEvent;
	}

	//==============================================================================
	// 눌림 틴트 색상 설정.
	//==============================================================================
	/**
	 * @param { Color } color 마우스가 올라 있을 때 덮을 틴트 색. (사본을 담는다, 기본 new Color(1, 1, 1, 0.12))
	 */
	setHoverTintColor(color) {
		this.#hoverTintColor = color.clone();
	}

	//==============================================================================
	// 오버 틴트 색상 반환.
	//==============================================================================
	/**
	 * @returns { Color } 오버 틴트 색.
	 */
	getHoverTintColor() {
		return this.#hoverTintColor;
	}

	//==============================================================================
	// 오버 진입 이벤트 설정.
	//==============================================================================
	/**
	 * @param { function(UIButton): void } callback 마우스가 노드 위로 들어오면 부를 함수. (인자는 이 버튼)
	 */
	setHoverEvent(callback) {
		this.#hoverEvent = callback;
	}

	//==============================================================================
	// 오버 진입 이벤트 반환.
	//==============================================================================
	/**
	 * @returns { function(UIButton): void } 오버 진입 이벤트 함수. (없으면 null)
	 */
	getHoverEvent() {
		return this.#hoverEvent;
	}

	//==============================================================================
	// 눌림 틴트 색상 설정.
	//==============================================================================
	/**
	 * @param { Color } color 누르는 동안 덮을 틴트 색. (기본 new Color(0, 0, 0, 0.3))
	 */
	setPressedTintColor(color) {
		this.#pressedTintColor = color;
	}

	//==============================================================================
	// 눌림 틴트 색상 반환.
	//==============================================================================
	/**
	 * @returns { Color } 눌림 틴트 색.
	 */
	getPressedTintColor() {
		return this.#pressedTintColor;
	}

	//==============================================================================
	// 트랜지션 지속 시간 설정.
	//==============================================================================
	/**
	 * @param { number } duration 틴트가 다 씌워지거나 걷히는 데 걸리는 시간. (초, 기본 0.3)
	 */
	setTransitionDuration(duration) {
		this.#transitionDuration = duration;
	}

	//==============================================================================
	// 트랜지션 지속 시간 반환.
	//==============================================================================
	/**
	 * @returns { number } 트랜지션 지속 시간. (초)
	 */
	getTransitionDuration() {
		return this.#transitionDuration;
	}

	//==============================================================================
	// 활성화 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } isInteractable 거짓이면 누름을 받지 않고 스프라이트에 비활성 틴트를 덮는다. (기본 참)
	 */
	setInteractable(isInteractable) {
		if (this.getInteractable() === isInteractable) {
			return;
		}
		this.#isInteractable = isInteractable;
		if (!isInteractable) {
			this.collectColorTargets();
			this.setButtonState(ButtonState.disabled);
		}
		else {
			this.#tintProgress = 0;
			this.applyTintProgress(0);
			this.setButtonState(ButtonState.normal);
		}
	}

	//==============================================================================
	// 활성화 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 누름을 받으면 참.
	 */
	getInteractable() {
		return this.#isInteractable;
	}
}
