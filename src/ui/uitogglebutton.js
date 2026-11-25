//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { UIButton } from "./uibutton.js";
import { Color } from "../base/color.js";


//==============================================================================
// 토글 버튼 컴포넌트.
//==============================================================================
/**
 * @example <caption>누를 때마다 켜고 끄는 단추</caption>
 * import { Engine, EngineConfiguration, UIScene, UIToggleButton, UILabel, Paint, WorldNode, Pivot, Vector2, Color } from "./build/vanilla.js";
 *
 * class MainScene extends UIScene {
 * 	constructor() {
 * 		super();
 * 		this.setLoadingMinDurationMs(0);
 * 	}
 *
 * 	initialize(engine) {
 * 		super.initialize(engine);
 * 		const toggleNode = new WorldNode();
 * 		toggleNode.setPivot(Pivot.topLeft);
 * 		toggleNode.setAnchor(Pivot.topLeft);
 * 		toggleNode.setLocalPosition(Vector2.create(40, 40));
 * 		toggleNode.setContentSize(Vector2.create(180, 56));
 * 		const paint = toggleNode.addComponent(Paint);
 * 		paint.setColor(new Color(0.25, 0.6, 0.35, 1));
 * 		paint.setRoundSize(12);
 * 		const label = toggleNode.addComponent(UILabel);
 * 		label.setText("Sound");
 * 		label.setFontSize(20);
 * 		const toggleButton = toggleNode.addComponent(UIToggleButton);
 * 		toggleButton.setOnTintColor(new Color(0, 0, 0, 0.4));
 * 		toggleButton.setToggledEvent((button) => {
 * 			console.log("sound on", button.getIsOn());
 * 		});
 * 		const root = this.getRoot();
 * 		root.addChild(toggleNode);
 * 		toggleButton.setIsOn(true);
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
export class UIToggleButton extends UIButton {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { boolean } */ #isOn;
	/** @private @type { Color } */ #onTintColor;
	/** @private @type { function(UIToggleButton): void } */ #toggledEvent;
	/** @private @type { function(UIToggleButton): void } */ #externalClickedEvent;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @construct
	 */
	constructor() {
		super();
		this.setComponentType("ToggleButton");
		this.#isOn = false;
		this.#onTintColor = new Color(0, 0, 0, 0.3);
		this.#toggledEvent = null;
		this.#externalClickedEvent = null;

		super.setClickedEvent(this.#onClicked.bind(this));
	}

	//==============================================================================
	// 틴트 트랜지션 갱신 (오버라이드: 켜짐 상태 고정).
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 */
	updateTintTransition(timeDelta) {
		const isOn = this.getIsOn();
		if (isOn) {
			super.applyTintProgress(1);
			return;
		}
		super.updateTintTransition(timeDelta);
	}

	//==============================================================================
	// 클릭 이벤트 설정 (오버라이드: 외부 콜백 별도 저장).
	//==============================================================================
	/**
	 * @override
	 * @param { function(UIToggleButton): void } callback 클릭으로 켜짐이 바뀐 뒤 부를 함수. (토글 이벤트 다음에 부른다, null 이면 부르지 않는다)
	 */
	setClickedEvent(callback) {
		this.#externalClickedEvent = callback;
	}

	//==============================================================================
	// 클릭 처리.
	//==============================================================================
	/** @private */
	#onClicked() {
		this.#isOn = !this.getIsOn();
		super.collectColorTargets();
		const isOn = this.getIsOn();
		super.applyTintProgress(isOn ? 1 : 0);
		const toggledEvent = this.getToggledEvent();
		if (toggledEvent) {
			toggledEvent(this);
		}
		if (this.#externalClickedEvent) {
			this.#externalClickedEvent(this);
		}
	}

	//==============================================================================
	// 켜짐 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } isOn 켜짐 여부. (토글 이벤트와 클릭 이벤트는 부르지 않는다)
	 */
	setIsOn(isOn) {
		if (this.getIsOn() === isOn) {
			return;
		}
		this.#isOn = isOn;
		super.collectColorTargets();
		const currentIsOn = this.getIsOn();
		super.applyTintProgress(currentIsOn ? 1 : 0);
	}

	//==============================================================================
	// 켜짐 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 켜져 있으면 참.
	 */
	getIsOn() {
		return this.#isOn;
	}

	//==============================================================================
	// 켜짐 틴트 색상 설정.
	//==============================================================================
	/**
	 * @param { Color } color 켜져 있을 때 덮을 틴트 색. (눌림 틴트 색도 이 색이 된다, 기본 new Color(0, 0, 0, 0.3))
	 */
	setOnTintColor(color) {
		this.#onTintColor = color;
		super.setPressedTintColor(color);
	}

	//==============================================================================
	// 켜짐 틴트 색상 반환.
	//==============================================================================
	/**
	 * @returns { Color } 켜짐 틴트 색.
	 */
	getOnTintColor() {
		return this.#onTintColor;
	}

	//==============================================================================
	// 토글 이벤트 설정.
	//==============================================================================
	/**
	 * @param { function(UIToggleButton): void } callback 클릭으로 켜짐이 바뀌면 부를 함수. (인자는 이 버튼, null 이면 부르지 않는다)
	 */
	setToggledEvent(callback) {
		this.#toggledEvent = callback;
	}

	//==============================================================================
	// 토글 이벤트 반환.
	//==============================================================================
	/**
	 * @returns { function(UIToggleButton): void } 토글 이벤트 함수. (없으면 null)
	 */
	getToggledEvent() {
		return this.#toggledEvent;
	}
}
