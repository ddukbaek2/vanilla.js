//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { UIButton } from "./uibutton.js";
import { Color } from "../base/color.js";


//==============================================================================
// 토글 버튼 컴포넌트.
//==============================================================================
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
		this.setComponentType('ToggleButton');
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
	 * @param { number } timeDelta
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
	 * @param { function(UIToggleButton): void } callback
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
	 * @param { boolean } isOn
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
	 * @returns { boolean }
	 */
	getIsOn() {
		return this.#isOn;
	}

	//==============================================================================
	// 켜짐 틴트 색상 설정.
	//==============================================================================
	/**
	 * @param { Color } color
	 */
	setOnTintColor(color) {
		this.#onTintColor = color;
		super.setPressedTintColor(color);
	}

	//==============================================================================
	// 켜짐 틴트 색상 반환.
	//==============================================================================
	/**
	 * @returns { Color }
	 */
	getOnTintColor() {
		return this.#onTintColor;
	}

	//==============================================================================
	// 토글 이벤트 설정.
	//==============================================================================
	/**
	 * @param { function(UIToggleButton): void } callback
	 */
	setToggledEvent(callback) {
		this.#toggledEvent = callback;
	}

	//==============================================================================
	// 토글 이벤트 반환.
	//==============================================================================
	/**
	 * @returns { function(UIToggleButton): void }
	 */
	getToggledEvent() {
		return this.#toggledEvent;
	}
}
