//==============================================================================
// 포함 모듈 목록.
//==============================================================================
// 옮긴 원문: 크로미엄 third_party/blink/renderer/core/editing/state_machines/backspace_state_machine.cc, third_party/blink/renderer/core/editing/position_units_word.cc 에서 옮김, BSD-3-Clause, THIRD_PARTY_LICENSES.md
const System = globalThis;
import { Vector2 } from "../base/vector2.js";
import { Rect } from "../base/rect.js";
import { Pivot } from "../base/pivot.js";
import { Color } from "../base/color.js";
import { WorldNode } from "../core/node/worldnode.js";
import { Component } from "../core/component.js";
import { Paint } from "../core/component/paint.js";
import { UILabel } from "./uilabel.js";
import { buildFontString } from "../core/component/text.js";
import { FontAsset } from "../resource/fontasset.js";


//==============================================================================
// 문맥 메뉴 항목. (잘라내기 / 복사 / 붙여넣기, requestMenuAction 이 받는다)
//==============================================================================
export const UIInputFieldMenuAction = {
	cut: "cut", // 잘라내기.
	copy: "copy", // 복사.
	paste: "paste", // 붙여넣기.
};


//==============================================================================
// 입력 필드 (캔버스 기반).
// - 텍스트 렌더링은 UILabel 자식 노드 두 개로 (값 라벨 + 플레이스홀더 라벨).
// - 클릭/드래그/커서 이동/선택은 모두 캔버스 측에서 직접 처리.
// - DOM <input> 사용 여부는 옵션 (setUseDOMInput, 기본 false). true 일 때만 한글 IME /
//   모바일 소프트 키보드 / 시스템 클립보드가 동작. false 면 ASCII 위주 키보드 직접 처리.
// - 우클릭 시 컨텍스트 메뉴 (잘라내기 / 복사 / 붙여넣기).
// - 커서 이동과 Delete 는 크롬처럼 글자 묶음 단위, 뒤로 지우기는 블링크 BackspaceStateMachine 처럼 코드 포인트 하나(이모지 묶음은 통째로).
// - DOM 입력은 크롬 입력 칸처럼 마우스로 두 번 누르면 낱말(윈도우는 뒤 공백까지), 세 번 누르면 글 전체를 고른다. (누름 수는 mousedown 의 detail)
// - 캔버스 모드의 낱말 이동과 지우기는 크롬처럼 윈도우와 리눅스는 Ctrl, 맥은 Option 과 왼쪽, 오른쪽 화살표, Backspace, Delete 다. (블링크 NextWordPosition, PreviousWordPosition)
//==============================================================================
/**
 * @example <caption>이름 입력칸 만들기</caption>
 * import { Engine, EngineConfiguration, UIScene, UIInputField, Vector2 } from "./build/vanilla.js";
 *
 * class MainScene extends UIScene {
 * 	constructor() {
 * 		super();
 * 		this.setLoadingMinDurationMs(0);
 * 	}
 *
 * 	initialize(engine) {
 * 		super.initialize(engine);
 * 		const inputField = new UIInputField();
 * 		inputField.setEngine(engine);
 * 		inputField.setLocalPosition(Vector2.create(40, 40));
 * 		inputField.setContentSize(Vector2.create(320, 56));
 * 		inputField.setPlaceholder("Your name");
 * 		inputField.setMaxLength(16);
 * 		inputField.setOnChange((value) => {
 * 			console.log("change", value);
 * 		});
 * 		inputField.setOnSubmit((value) => {
 * 			console.log("submit", value);
 * 		});
 * 		const root = this.getRoot();
 * 		root.addChild(inputField);
 * 		inputField.attach();
 * 		inputField.setText("Player");
 * 		console.log(inputField.getText(), inputField.getCursorIndex());
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
export class UIInputField extends WorldNode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { * } */ #engine;
	/** @private @type { boolean } */ #useDOMInput;
	/** @private @type { boolean } */ #useTouchEndFocus; // 손을 뗄 때(touchend)도 포커스를 줄지. (기본 false, setUseTouchEndFocus)
	/** @private @type { boolean } */ #useDirectTouch; // DOM 입력을 필드 위에서 직접 누르게 할지. (기본 false, setUseDirectTouch)
	/** @private @type { HTMLInputElement | null } */ #domInput;
	/** @private @type { Function | null } */ #canvasKeydownHandler;
	/** @private @type { Function | null } */ #canvasFocusHandler;
	/** @private @type { Function | null } */ #contextMenuHandler;
	/** @private @type { HTMLElement | null } */ #contextMenuElement;
	/** @private @type { Function | null } */ #contextMenuDismissHandler;
	/** @private @type { string | null } */ #pendingMenuAction; // 다음 tick 에 할 문맥 메뉴 항목. (UIInputFieldMenuAction, null 이면 없음)

	/** @private @type { string } */ #value;
	/** @private @type { string } */ #composition;
	/** @private @type { boolean } */ #isComposing;
	/** @private @type { number } */ #cursorIndex;
	/** @private @type { number } */ #selectionStart;
	/** @private @type { number } */ #dragStartIndex;
	/** @private @type { number } */ #pointerClickCount; // 마지막 캔버스 mousedown 을 브라우저가 센 수. (detail, DOM 입력의 두 번, 세 번 누르기)
	/** @private @type { object | null } */ #dragGranularity; // 두 번, 세 번 누른 뒤 끌기의 단위와 처음 고른 범위. ({ granularity, start, end }, null 이면 글자 단위)
	/** @private @type { boolean } */ #focused;
	/** @private @type { boolean } */ #isFocusedWithoutActivation; // 사용자 활성화가 한 번도 없던 때에 얻은 포커스인지. (모바일 브라우저가 키보드를 띄우지 않음)
	/** @private @type { number } */ #blinkTimer;
	/** @private @type { boolean } */ #cursorVisible;

	/** @private @type { number } */ #fontSize;
	/** @private @type { FontFace | null } */ #fontFace;
	/** @private @type { number } */ #padding;
	/** @private @type { string } */ #placeholder;
	/** @private @type { number } */ #maxLength;

	/** @private @type { (value: string) => void | null } */ #onChangeCallback;
	/** @private @type { (value: string) => void | null } */ #onSubmitCallback;

	/** @private @type { Paint } */ #bgPaint;
	/** @private @type { number } */ #bgRoundSize;
	/** @private @type { Color } */ #textColor;
	/** @private @type { Color } */ #placeholderColor;
	/** @private @type { Color } */ #cursorColor;
	/** @private @type { Color } */ #compositionUnderlineColor;
	/** @private @type { Color } */ #focusBorderColor;
	/** @private @type { number } */ #focusBorderWidth;
	/** @private @type { Color } */ #selectionColor;

	/** @private @type { WorldNode } */ #textTextNode;
	/** @private @type { UILabel } */ #textUILabel;
	/** @private @type { WorldNode } */ #placeholderTextNode;
	/** @private @type { UILabel } */ #placeholderUILabel;
	/** @private @type { WorldNode } */ #overlayNode;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setPivot(Pivot.topLeft);
		this.setAnchor(Pivot.topLeft);
		this.setInteractable(true);

		this.#engine = null;
		this.#useDOMInput = false;
		this.#useTouchEndFocus = false;
		this.#useDirectTouch = false;
		this.#domInput = null;
		this.#canvasKeydownHandler = null;
		this.#canvasFocusHandler = null;
		this.#contextMenuHandler = null;
		this.#contextMenuElement = null;
		this.#contextMenuDismissHandler = null;
		this.#pendingMenuAction = null;

		this.#value = "";
		this.#composition = "";
		this.#isComposing = false;
		this.#cursorIndex = 0;
		this.#selectionStart = 0;
		this.#dragStartIndex = -1;
		this.#pointerClickCount = 1;
		this.#dragGranularity = null;
		this.#focused = false;
		this.#isFocusedWithoutActivation = false;
		this.#blinkTimer = 0;
		this.#cursorVisible = true;

		this.#fontSize = 28;
		this.#fontFace = null;
		this.#padding = 16;
		this.#placeholder = "";
		this.#maxLength = 0;

		this.#onChangeCallback = null;
		this.#onSubmitCallback = null;

		this.#textColor = Color.createFromHEX("#222222");
		this.#placeholderColor = Color.createFromHEX("#999999");
		this.#cursorColor = Color.createFromHEX("#5b8def");
		this.#compositionUnderlineColor = Color.createFromHEX("#5b8def");
		this.#focusBorderColor = Color.createFromHEX("#f97316");
		this.#focusBorderWidth = 3;
		this.#selectionColor = new Color(91 / 255, 141 / 255, 239 / 255, 0.35);
		this.#bgRoundSize = 8;

		// 1) 배경 (드로 순서: 가장 먼저).
		this.#bgPaint = this.addComponent(Paint);
		this.#bgPaint.setRoundSize(this.#bgRoundSize);
		this.#bgPaint.setColor(Color.createFromHEX("#ffffff"));

		// 2) 선택 영역 하이라이트 (자식보다 먼저 그려져 텍스트 뒤에 깔리도록 컴포넌트로).
		this.addComponent(BackgroundLayerRenderer);

		// 3) 플레이스홀더 라벨 (자식 노드). 배경은 투명, 안 그러면 UIView.draw 가
		//    contentSize 전체를 흰색으로 채워서 그 아래 깔린 selection 하이라이트가 가려진다.
		this.#placeholderTextNode = new WorldNode();
		this.#placeholderTextNode.setPivot(Pivot.topLeft);
		this.#placeholderTextNode.setAnchor(Pivot.topLeft);
		this.#placeholderUILabel = this.#placeholderTextNode.addComponent(UILabel);
		this.#placeholderUILabel.setBackgroundColor(Color.transparent());
		this.#placeholderUILabel.setText("");
		this.#placeholderUILabel.setFontSize(this.#fontSize);
		this.#placeholderUILabel.setTextAlign("left");
		this.#placeholderUILabel.setTextBaseline("middle");
		this.#placeholderUILabel.setTextColor(this.#placeholderColor);
		this.addChild(this.#placeholderTextNode);

		// 4) 값 라벨 (자식 노드). 배경 투명 (위 동일 이유).
		this.#textTextNode = new WorldNode();
		this.#textTextNode.setPivot(Pivot.topLeft);
		this.#textTextNode.setAnchor(Pivot.topLeft);
		this.#textUILabel = this.#textTextNode.addComponent(UILabel);
		this.#textUILabel.setBackgroundColor(Color.transparent());
		this.#textUILabel.setText("");
		this.#textUILabel.setFontSize(this.#fontSize);
		this.#textUILabel.setTextAlign("left");
		this.#textUILabel.setTextBaseline("middle");
		this.#textUILabel.setTextColor(this.#textColor);
		this.addChild(this.#textTextNode);

		// 5) 오버레이 (커서 + 조합문자 밑줄 + 포커스 테두리). 자식이라 텍스트 위에 그려진다.
		this.#overlayNode = new WorldNode();
		this.#overlayNode.setPivot(Pivot.topLeft);
		this.#overlayNode.setAnchor(Pivot.topLeft);
		this.#overlayNode.addComponent(OverlayLayerRenderer);
		this.addChild(this.#overlayNode);

		this.refreshTexts();
	}

	//==============================================================================
	// 설정.
	//==============================================================================
	/**
	 * @param { Engine } engine 엔진. (DOM 입력의 자리, 캔버스 사건, 문맥 메뉴에 쓴다, attach 전에 준다)
	 */
	setEngine(engine) { this.#engine = engine; }
	//==============================================================================
	// DOM 입력 사용 설정. (attach 때 보므로 그 전에 정한다)
	//==============================================================================
	/**
	 * @param { boolean } use 참이면 숨은 DOM input 으로 글을 받는다. (한글 IME, 모바일 화면 키보드, 시스템 클립보드가 된다, 기본 거짓)
	 * @example <caption>모바일 키보드와 IME 로 받는 입력칸</caption>
	 * import { Engine, EngineConfiguration, UIScene, UIInputField, Vector2 } from "./build/vanilla.js";
	 *
	 * class MainScene extends UIScene {
	 * 	constructor() {
	 * 		super();
	 * 		this.setLoadingMinDurationMs(0);
	 * 	}
	 *
	 * 	initialize(engine) {
	 * 		super.initialize(engine);
	 * 		const inputField = new UIInputField();
	 * 		inputField.setEngine(engine);
	 * 		inputField.setUseDOMInput(true);
	 * 		inputField.setUseTouchEndFocus(true);
	 * 		inputField.setLocalPosition(Vector2.create(40, 40));
	 * 		inputField.setContentSize(Vector2.create(320, 56));
	 * 		inputField.setPlaceholder("Message");
	 * 		const root = this.getRoot();
	 * 		root.addChild(inputField);
	 * 		inputField.attach();
	 * 		console.log(inputField.isUsingDOMInput(), inputField.isFocused());
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
	setUseDOMInput(use) { this.#useDOMInput = !!use; }
	//==============================================================================
	// DOM 입력 사용 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } DOM 입력을 쓰면 참.
	 */
	isUsingDOMInput() { return this.#useDOMInput; }
	// DOM 입력일 때 손을 뗄 때(touchend)도 포커스를 줄지. (기본 false, 꺼져 있으면 touchstart 에서만 준다)
	// 켜면 사용자 활성화가 한 번도 없던 때(페이지의 첫 touchstart)에 얻은 포커스를 손을 뗄 때 다시 줘,
	// 그런 포커스에 키보드를 띄우지 않는 브라우저(안드로이드 크롬, 웹뷰)에서도 키보드가 뜨게 한다.
	/**
	 * @param { boolean } use 참이면 touchend 에서도 포커스를 준다. (기본 거짓)
	 */
	setUseTouchEndFocus(use) { this.#useTouchEndFocus = !!use; }
	//==============================================================================
	// touchend 포커스 사용 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } touchend 에서도 포커스를 주면 참.
	 */
	isUsingTouchEndFocus() { return this.#useTouchEndFocus; }
	// DOM 입력을 필드 위에서 손가락(마우스)이 직접 누르게 할지. (기본 false, 꺼져 있으면 DOM 입력은 누름을 받지 않고 캔버스가 포커스를 준다)
	// 켜면 필드가 보이는 동안 투명한 DOM 입력이 필드 자리에서 누름을 받아, 브라우저의 기본 동작으로 포커스(다른 출처의 iframe 이면 그 프레임까지)와
	// 키보드를 연다. 코드로 준 포커스를 받지 않는 웹뷰(앱 안의 iframe 등)에서 쓴다. 포커스를 받으면 커서는 글 끝에 둔다.
	/**
	 * @param { boolean } use 참이면 투명한 DOM 입력이 필드 자리에서 누름을 직접 받는다. (기본 거짓)
	 */
	setUseDirectTouch(use) { this.#useDirectTouch = !!use; }
	//==============================================================================
	// 직접 누름 사용 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } DOM 입력이 누름을 직접 받으면 참.
	 */
	isUsingDirectTouch() { return this.#useDirectTouch; }

	//==============================================================================
	// 값 설정. (최대 길이를 넘으면 서로게이트 쌍을 쪼개지 않는 데까지 자르고 커서를 끝에 둔다, 바뀜 콜백은 부르지 않는다)
	//==============================================================================
	/**
	 * @param { string } text 넣을 글. (거짓 값이면 빈 글, 그 밖은 String 으로 바꾼다)
	 */
	setText(text) {
		this.#value = String(text || "");
		if (this.#maxLength > 0) {
			this.#value = limitTextLength(this.#value, this.#maxLength);
		}
		this.#cursorIndex = this.#value.length;
		this.#selectionStart = this.#cursorIndex;
		if (this.#domInput) this.#domInput.value = this.#value;
		this.refreshTexts();
	}
	//==============================================================================
	// 값 반환.
	//==============================================================================
	/**
	 * @returns { string } 입력한 글. (조합 중인 글은 빠진다)
	 */
	getText() { return this.#value; }

	//==============================================================================
	// 플레이스홀더 설정.
	//==============================================================================
	/**
	 * @param { string } text 값이 비었을 때 보일 글. (거짓 값이면 빈 글)
	 */
	setPlaceholder(text) {
		this.#placeholder = String(text || "");
		this.refreshTexts();
	}
	//==============================================================================
	// 최대 길이 설정.
	//==============================================================================
	/**
	 * @param { number } n 최대 글자 수. (글의 length 로 센다, 소수는 버린다, 0 이하면 제한하지 않는다, 지금 값은 자르지 않는다)
	 */
	setMaxLength(n) {
		this.#maxLength = n | 0;
		if (this.#domInput) {
			if (this.#maxLength > 0) this.#domInput.maxLength = this.#maxLength;
			else this.#domInput.removeAttribute("maxlength");
		}
	}
	//==============================================================================
	// 글자 크기 설정.
	//==============================================================================
	/**
	 * @param { number } size 글자 크기. (내용 크기 단위, 기본 28)
	 */
	setFontSize(size) {
		this.#fontSize = size;
		this.#textUILabel.setFontSize(size);
		this.#placeholderUILabel.setFontSize(size);
	}
	//==============================================================================
	// 글꼴 설정.
	//==============================================================================
	/**
	 * @param { FontFace | FontAsset | null } font 글꼴. (FontAsset 이면 그 fontFace, null 이나 undefined 면 시스템 글꼴, 그 밖의 꼴은 무시한다)
	 */
	setFont(font) {
		if (font === null || font === undefined) {
			this.#fontFace = null;
		}
		else if (font instanceof System.FontFace) {
			this.#fontFace = font;
		}
		else if (font instanceof FontAsset) {
			this.#fontFace = font.fontFace;
		}
		else {
			return;
		}
		this.#textUILabel.setFont(font);
		this.#placeholderUILabel.setFont(font);
	}
	//==============================================================================
	// 안쪽 여백 설정.
	//==============================================================================
	/**
	 * @param { number } padding 왼쪽과 오른쪽 안쪽 여백. (내용 크기 단위, 기본 16)
	 */
	setPadding(padding) { this.#padding = padding; }

	//==============================================================================
	// 배경색 설정.
	//==============================================================================
	/**
	 * @param { Color | string } color 배경색. (기본 흰색)
	 */
	setBackgroundColor(color) { this.#bgPaint.setColor(color); }
	//==============================================================================
	// 모서리 둥글기 설정.
	//==============================================================================
	/**
	 * @param { number } roundSize 배경과 포커스 테두리의 모서리 반지름. (기본 8)
	 */
	setRoundSize(roundSize) {
		this.#bgRoundSize = roundSize;
		this.#bgPaint.setRoundSize(roundSize);
	}
	//==============================================================================
	// 글자 색 설정.
	//==============================================================================
	/**
	 * @param { Color } color 값 글자의 색. (기본 #222222)
	 */
	setTextColor(color) {
		this.#textColor = color;
		this.#textUILabel.setTextColor(color);
	}
	//==============================================================================
	// 플레이스홀더 색 설정.
	//==============================================================================
	/**
	 * @param { Color } color 플레이스홀더 글자의 색. (기본 #999999)
	 */
	setPlaceholderColor(color) {
		this.#placeholderColor = color;
		this.#placeholderUILabel.setTextColor(color);
	}
	//==============================================================================
	// 커서 색 설정. (조합 중 밑줄 색도 함께 바꾼다)
	//==============================================================================
	/**
	 * @param { Color } color 커서와 조합 밑줄의 색. (기본 #5b8def)
	 */
	setCursorColor(color) {
		this.#cursorColor = color;
		this.#compositionUnderlineColor = color;
	}
	//==============================================================================
	// 포커스 테두리 색 설정.
	//==============================================================================
	/**
	 * @param { Color } color 포커스 테두리 색. (기본 #f97316)
	 */
	setFocusBorderColor(color) { this.#focusBorderColor = color; }
	//==============================================================================
	// 포커스 테두리 두께 설정.
	//==============================================================================
	/**
	 * @param { number } width 포커스 테두리 두께. (0 이하면 그리지 않는다, 기본 3)
	 */
	setFocusBorderWidth(width) { this.#focusBorderWidth = width; }
	//==============================================================================
	// 선택 영역 색 설정.
	//==============================================================================
	/**
	 * @param { Color } color 선택 영역을 칠할 색. (기본 알파 0.35 의 파랑)
	 */
	setSelectionColor(color) { this.#selectionColor = color; }

	//==============================================================================
	// 플레이스홀더 반환.
	//==============================================================================
	/**
	 * @returns { string } 플레이스홀더 글.
	 */
	getPlaceholder() { return this.#placeholder; }
	//==============================================================================
	// 최대 길이 반환.
	//==============================================================================
	/**
	 * @returns { number } 최대 글자 수. (0 이면 제한하지 않는다)
	 */
	getMaxLength() { return this.#maxLength; }
	//==============================================================================
	// 글자 크기 반환.
	//==============================================================================
	/**
	 * @returns { number } 글자 크기.
	 */
	getFontSize() { return this.#fontSize; }
	//==============================================================================
	// 안쪽 여백 반환.
	//==============================================================================
	/**
	 * @returns { number } 왼쪽과 오른쪽 안쪽 여백.
	 */
	getPadding() { return this.#padding; }
	//==============================================================================
	// 배경색 반환.
	//==============================================================================
	/**
	 * @returns { Color } 배경색.
	 */
	getBackgroundColor() { return this.#bgPaint.getColor(); }
	//==============================================================================
	// 모서리 둥글기 반환.
	//==============================================================================
	/**
	 * @returns { number } 배경의 모서리 반지름.
	 */
	getRoundSize() { return this.#bgRoundSize; }
	//==============================================================================
	// 글자 색 반환.
	//==============================================================================
	/**
	 * @returns { Color } 값 글자의 색.
	 */
	getTextColor() { return this.#textColor; }
	//==============================================================================
	// 플레이스홀더 색 반환.
	//==============================================================================
	/**
	 * @returns { Color } 플레이스홀더 글자의 색.
	 */
	getPlaceholderColor() { return this.#placeholderColor; }
	//==============================================================================
	// 커서 색 반환.
	//==============================================================================
	/**
	 * @returns { Color } 커서 색.
	 */
	getCursorColor() { return this.#cursorColor; }
	//==============================================================================
	// 커서 자리 반환.
	//==============================================================================
	/**
	 * @returns { number } 커서 자리. (값 안의 글자 위치, 0 ~ 값 길이)
	 */
	getCursorIndex() { return this.#cursorIndex; }
	//==============================================================================
	// 선택 시작 자리 반환.
	//==============================================================================
	/**
	 * @returns { number } 선택의 고정 끝. (커서 자리와 같으면 선택이 없다)
	 */
	getSelectionStart() { return this.#selectionStart; }
	//==============================================================================
	// 조합 중인 글 반환.
	//==============================================================================
	/**
	 * @returns { string } IME 가 조합 중인 글. (없으면 빈 글)
	 */
	getComposition() { return this.#composition; }

	//==============================================================================
	// 보이는 글 반환. (값의 커서 자리에 조합 글을 끼운 것)
	//==============================================================================
	/**
	 * @returns { string } 보이는 글.
	 */
	getDisplayText() {
		const before = this.#value.slice(0, this.#cursorIndex);
		const after = this.#value.slice(this.#cursorIndex);
		return before + this.#composition + after;
	}
	//==============================================================================
	// IME 조합 중인지.
	//==============================================================================
	/**
	 * @returns { boolean } 조합 중이면 참.
	 */
	isComposing() { return this.#isComposing; }

	//==============================================================================
	// 바뀜 콜백 설정.
	//==============================================================================
	/**
	 * @param { (value: string) => void } callback 사용자 입력으로 값이 바뀔 때마다 부를 함수. (인자는 새 값, setText 로 바꿀 때는 부르지 않는다, null 이면 부르지 않는다)
	 */
	setOnChange(callback) { this.#onChangeCallback = callback; }
	//==============================================================================
	// 제출 콜백 설정.
	//==============================================================================
	/**
	 * @param { (value: string) => void } callback 포커스된 채 Enter 를 누르면 부를 함수. (인자는 지금 값, null 이면 부르지 않는다)
	 */
	setOnSubmit(callback) { this.#onSubmitCallback = callback; }

	//==============================================================================
	// 렌더 상태 스냅샷 (오버레이/배경 렌더러가 읽음).
	//==============================================================================
	/**
	 * @returns { object } 그릴 때 쓸 상태를 담은 새 객체. ({ value, composition, cursorIndex, selectionStart, focused, cursorVisible, fontSize, fontFace, padding, cursorColor, compositionUnderlineColor, focusBorderColor, focusBorderWidth, selectionColor, bgRoundSize })
	 */
	getRenderState() {
		return {
			value: this.#value,
			composition: this.#composition,
			cursorIndex: this.#cursorIndex,
			selectionStart: this.#selectionStart,
			focused: this.#focused,
			cursorVisible: this.#cursorVisible,
			fontSize: this.#fontSize,
			fontFace: this.#fontFace,
			padding: this.#padding,
			cursorColor: this.#cursorColor,
			compositionUnderlineColor: this.#compositionUnderlineColor,
			focusBorderColor: this.#focusBorderColor,
			focusBorderWidth: this.#focusBorderWidth,
			selectionColor: this.#selectionColor,
			bgRoundSize: this.#bgRoundSize,
		};
	}

	//==============================================================================
	// 입력 라이프사이클: 활성화(attach) / 비활성화(detach).
	//==============================================================================
	attach() {
		if (this.#useDOMInput) this.attachDOMInput();
		else this.attachCanvasKeyboard();
		this.attachContextMenuHandler();
	}
	//==============================================================================
	// 입력 끄기. (DOM 입력, 키보드, 문맥 메뉴 사건을 떼고 메뉴를 닫는다)
	//==============================================================================
	detach() {
		this.detachDOMInput();
		this.detachCanvasKeyboard();
		this.detachContextMenuHandler();
		this.hideContextMenu();
	}

	//==============================================================================
	// 외부 API.
	//==============================================================================
	focus() {
		if (this.#useDOMInput) {
			if (this.#domInput) this.#domInput.focus();
			// DOM input 의 focus 이벤트가 #focused 를 true 로 설정.
		}
		else {
			this.handleFocus();
		}
	}
	//==============================================================================
	// 포커스 풀기.
	//==============================================================================
	blur() {
		if (this.#useDOMInput && this.#domInput) this.#domInput.blur();
		else this.handleBlur();
	}
	//==============================================================================
	// 포커스 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 포커스를 가졌으면 참.
	 */
	isFocused() { return this.#focused; }

	//==============================================================================
	// 모두 선택.
	//==============================================================================
	selectAll() {
		this.#selectionStart = 0;
		this.#cursorIndex = this.#value.length;
		if (this.#domInput) this.#domInput.setSelectionRange(0, this.#value.length);
	}

	//==============================================================================
	// 매 프레임: 라벨 위치 / 텍스트 동기, DOM 위치 동기, 커서 깜빡임, selection 폴링.
	//==============================================================================
	/**
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
		// 부탁받은 문맥 메뉴 항목.
		if (this.#pendingMenuAction !== null) {
			const menuAction = this.#pendingMenuAction;
			this.#pendingMenuAction = null;
			this.performMenuAction(menuAction);
		}
		this.refreshTextPositions();
		if (this.#domInput) {
			this.layoutDOMInput();
			// 키보드 네비게이션 (화살표/Home/End/Shift+...) 은 input 이벤트가 안 뜨므로 polling.
			// 단, 캔버스 드래그 중에는 우리가 매 프레임 setSelectionRange 로 DOM 을 덮어쓰는
			// 중이므로 폴링하지 않는다. (안 그러면 cursor 가 항상 max 로 끌려간다.)
			// 그리고 우리 selection 범위 [min, max] 와 DOM 의 [start, end] 가 일치하면 굳이
			// 동기화하지 않는다. (forward/backward 방향 정보가 우리 쪽에만 있어 보존됨.)
			if (this.#focused && !this.#isComposing && this.#dragStartIndex < 0) {
				const selEnd = this.#domInput.selectionEnd;
				const selStart = this.#domInput.selectionStart;
				if (typeof selEnd === "number" && typeof selStart === "number") {
					const ourMin = System.Math.min(this.#cursorIndex, this.#selectionStart);
					const ourMax = System.Math.max(this.#cursorIndex, this.#selectionStart);
					if (selStart !== ourMin || selEnd !== ourMax) {
						this.#cursorIndex = selEnd;
						this.#selectionStart = selStart;
						this.#blinkTimer = 0;
						this.#cursorVisible = true;
					}
				}
			}
		}
		if (this.#focused) {
			this.#blinkTimer += timeDelta;
			if (this.#blinkTimer >= 0.5) {
				this.#blinkTimer = 0;
				this.#cursorVisible = !this.#cursorVisible;
			}
		}
		else {
			this.#cursorVisible = true;
		}
	}

	//==============================================================================
	// 캔버스 측 터치 (포지션 기반 커서 / 드래그 선택). pointer-events: none 인 DOM input
	// 이 클릭을 가로채지 않으므로 항상 여기로 들어옴.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 누른 자리. (뷰 좌표)
	 */
	touchPress(viewInputPosition) {
		this.focus();
		this.hideContextMenu();
		const localX = viewInputPosition.x - this.getPosition().x;
		const index = this.measureIndexAtLocalX(localX);
		this.#dragStartIndex = index;
		this.#cursorIndex = index;
		this.#selectionStart = index;
		this.#dragGranularity = null;
		// DOM 입력은 크롬 입력 칸처럼 두 번 누르면 낱말(윈도우는 뒤 공백까지), 세 번 누르면 글 전체(한 줄의 문단)를 고른다. (블링크 SelectionController)
		const clickCount = this.#domInput ? this.#pointerClickCount : 1;
		if (clickCount >= 2) {
			const range = clickCount === 2 ? findWordRangeAt(this.#value, index) : { start: 0, end: this.#value.length };
			if (clickCount === 2 && isWindowsPlatform() && range.end > range.start) {
				range.end = skipTrailingWhitespace(this.#value, range.end);
			}
			this.#selectionStart = range.start;
			this.#cursorIndex = range.end;
			this.#dragGranularity = { granularity: clickCount === 2 ? "word" : "paragraph", start: range.start, end: range.end };
		}
		if (this.#domInput) {
			const selectionStart = System.Math.min(this.#selectionStart, this.#cursorIndex);
			const selectionEnd = System.Math.max(this.#selectionStart, this.#cursorIndex);
			this.#domInput.setSelectionRange(selectionStart, selectionEnd);
		}
		this.#blinkTimer = 0;
		this.#cursorVisible = true;
	}
	//==============================================================================
	// 터치 이동. (누른 자리부터 지금 자리까지 선택한다)
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 옮긴 자리. (뷰 좌표)
	 */
	touchMove(viewInputPosition) {
		if (this.#dragStartIndex < 0) return;
		const localX = viewInputPosition.x - this.getPosition().x;
		const index = this.measureIndexAtLocalX(localX);
		// 앵커 = 처음 누른 지점, 커서 = 지금 마우스 위치. (좌/우 어느 쪽으로 드래그해도
		// 커서가 마우스를 따라간다.) DOM API 는 start ≤ end 를 요구하므로 변환.
		this.#selectionStart = this.#dragStartIndex;
		this.#cursorIndex = index;
		// 두 번, 세 번 누른 뒤 끌기는 블링크 ExtendSelectionAsDirectional 처럼 처음 범위를 지키고 끄는 자리의 낱말(문단) 끝까지 넓힌다.
		const dragGranularity = this.#dragGranularity;
		if (dragGranularity) {
			const unitRange = dragGranularity.granularity === "word" ? findWordRangeAt(this.#value, index) : { start: 0, end: this.#value.length };
			if (index < dragGranularity.start) {
				this.#selectionStart = dragGranularity.end;
				this.#cursorIndex = unitRange.start;
			}
			else {
				this.#selectionStart = dragGranularity.start;
				this.#cursorIndex = System.Math.max(unitRange.end, dragGranularity.end);
			}
		}
		if (this.#domInput) {
			const selStart = System.Math.min(this.#selectionStart, this.#cursorIndex);
			const selEnd = System.Math.max(this.#selectionStart, this.#cursorIndex);
			this.#domInput.setSelectionRange(selStart, selEnd);
		}
		this.#blinkTimer = 0;
		this.#cursorVisible = true;
	}
	//==============================================================================
	// 터치 뗌. (끌어 선택하기를 끝낸다)
	//==============================================================================
	touchRelease() { this.#dragStartIndex = -1; }
	//==============================================================================
	// 터치 취소. (끌어 선택하기를 끝낸다)
	//==============================================================================
	touchCancel() { this.#dragStartIndex = -1; }

	//==============================================================================
	// localX(노드 로컬 X) → 문자 인덱스. 측정은 오프스크린 2D ctx 로.
	//   (메인 캔버스는 WebGL2 컨텍스트라 2D 측정 불가)
	//==============================================================================
	/**
	 * @param { number } localX 노드 안의 X. (내용 영역 왼쪽이 0)
	 * @returns { number } 그 자리에 가장 가까운 글자 묶음 경계. (UTF-16 단위, 0 ~ 값 길이, 잴 컨텍스트가 없으면 값 길이)
	 */
	measureIndexAtLocalX(localX) {
		const value = this.#value;
		if (value.length === 0) return 0;
		const ctx = this.getMeasureContext();
		if (!ctx) return value.length;
		ctx.save();
		ctx.font = buildFontString(this.#fontFace, this.#fontSize, false, false);
		const targetX = localX - this.#padding;
		if (targetX <= 0) {
			ctx.restore();
			return 0;
		}
		let prevWidth = 0;
		let previousBoundary = 0;
		let result = value.length;
		const boundaryList = collectGraphemeBoundaries(value);
		for (let boundaryIndex = 1; boundaryIndex < boundaryList.length; ++boundaryIndex) {
			const boundary = boundaryList[boundaryIndex];
			const width = ctx.measureText(value.slice(0, boundary)).width;
			if (width >= targetX) {
				result = (targetX - prevWidth) < (width - targetX) ? previousBoundary : boundary;
				break;
			}
			prevWidth = width;
			previousBoundary = boundary;
		}
		ctx.restore();
		return result;
	}

	//==============================================================================
	// 글 너비를 잴 2D 컨텍스트 반환. (모듈이 함께 쓰는 오프스크린 캔버스)
	//==============================================================================
	/**
	 * @returns { CanvasRenderingContext2D | null } 2D 컨텍스트. (캔버스를 만들 수 없으면 null)
	 */
	getMeasureContext() {
		return getOffscreenMeasureContext();
	}

	//==============================================================================
	// 라벨(UILabel) 갱신.
	// - 값이 비어있으면 textText 숨김 + placeholder 표시.
	// - 조합 중이면 (value + composition) 을 textText 에 합성 표시.
	//==============================================================================
	refreshTexts() {
		const hasValue = this.#value.length > 0 || this.#composition.length > 0;
		this.#placeholderTextNode.setActive(!hasValue);
		this.#textTextNode.setActive(hasValue);
		if (hasValue) {
			const before = this.#value.slice(0, this.#cursorIndex);
			const after = this.#value.slice(this.#cursorIndex);
			this.#textUILabel.setText(before + this.#composition + after);
		}
		this.#placeholderUILabel.setText(this.#placeholder);
	}

	//==============================================================================
	// 라벨과 오버레이 노드의 자리, 크기 맞추기. (내용 크기가 0 이면 하지 않는다)
	//==============================================================================
	refreshTextPositions() {
		const size = this.getContentSize();
		if (size.x <= 0 || size.y <= 0) return;
		const inner = Vector2.create(System.Math.max(0, size.x - this.#padding * 2), size.y);
		this.#textTextNode.setLocalPosition(Vector2.create(this.#padding, 0));
		this.#textTextNode.setContentSize(inner);
		this.#placeholderTextNode.setLocalPosition(Vector2.create(this.#padding, 0));
		this.#placeholderTextNode.setContentSize(inner);
		this.#overlayNode.setLocalPosition(Vector2.zero());
		this.#overlayNode.setContentSize(size);
	}

	//==============================================================================
	// DOM <input> (옵션).
	//==============================================================================
	attachDOMInput() {
		if (this.#domInput) return;
		const doc = System.document;
		ensureGlobalHiddenInputStyle(doc);

		const input = doc.createElement("input");
		input.type = "text";
		input.value = this.#value;
		if (this.#maxLength > 0) input.maxLength = this.#maxLength;
		input.autocomplete = "off";
		input.spellcheck = false;
		input.className = "uiinputfield-hidden";

		const style = input.style;
		style.position = "absolute";
		style.left = "-9999px";
		style.top = "-9999px";
		style.width = "1px";
		style.height = "1px";
		style.zIndex = "1000";
		style.pointerEvents = "none";
		style.boxSizing = "border-box";
		style.outline = "none";
		style.border = "none";
		style.background = "transparent";
		style.color = "transparent";
		style.caretColor = "transparent";
		style.textShadow = "none";
		style.boxShadow = "none";
		style.padding = "0";
		style.margin = "0";
		style.fontFamily = "inherit";
		style.webkitTapHighlightColor = "transparent";
		style.fontSize = "16px"; // iOS 줌인 방지.

		input.addEventListener("focus", () => this.handleFocus());
		input.addEventListener("blur", () => this.handleBlur());
		input.addEventListener("input", () => this.handleDOMInputEvent());
		input.addEventListener("compositionstart", () => { this.#isComposing = true; });
		input.addEventListener("compositionupdate", (event) => {
			this.#composition = (event && event.data) ? event.data : "";
			this.refreshTexts();
		});
		input.addEventListener("compositionend", () => {
			this.#isComposing = false;
			this.#composition = "";
			this.handleDOMInputEvent();
		});
		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				if (this.#onSubmitCallback) this.#onSubmitCallback(this.#value);
			}
		});

		doc.body.appendChild(input);
		this.#domInput = input;
		this.layoutDOMInput();

		// iOS Safari 의 모바일 키보드 정책: input.focus() 호출이 사용자 제스처
		// (touchstart / click) 의 콜스택 안에서 발생해야 키보드가 뜬다. 엔진의
		// touchPress 는 rAF 루프에서 dispatch 되어 gesture context 가 끊기므로,
		// 캔버스 touchstart 에 직접 동기 핸들러를 달아 hit-test 통과 시 즉시
		// focus 를 호출한다.
		this.attachCanvasFocusHandler();
	}

	//==============================================================================
	// DOM 입력 떼기. (캔버스 포커스 핸들러도 떼고 포커스와 조합을 푼다)
	//==============================================================================
	detachDOMInput() {
		this.detachCanvasFocusHandler();
		if (!this.#domInput) return;
		try {
			if (this.#domInput.parentNode) this.#domInput.parentNode.removeChild(this.#domInput);
		}
		catch (error) { /* 무시 */ }
		this.#domInput = null;
		this.#focused = false;
		this.#composition = "";
		this.#isComposing = false;
	}

	//==============================================================================
	// 캔버스 touchstart 동기 focus 핸들러 등록.
	// - 엔진의 touchPress 가 rAF 에서 dispatch 되어 iOS 가 gesture 만료로 키보드
	//   호출을 막는 문제를 우회한다.
	// - hit-test 통과 시: 동기 focus → 키보드 표시.
	// - hit-test 실패 (필드 바깥 터치) 시: 현재 focus 상태면 blur → 키보드 숨김.
	// - setUseTouchEndFocus(true) 일 때만 touchend 에서도 hit-test 통과 시 focus
	//   한다. touchstart 는 사용자 활성화를 주지 않아, 페이지의 첫 터치가 필드면
	//   안드로이드 크롬(웹뷰, 다른 출처의 iframe 포함)이 focus 는 받되 키보드를
	//   띄우지 않는다. 그때 얻은 포커스면 (활성화를 주는) touchend 에서 blur 뒤
	//   다시 focus 해 키보드를 띄운다. 꺼져 있으면 touchend 는 아무것도 하지 않는다.
	//==============================================================================
	attachCanvasFocusHandler() {
		if (this.#canvasFocusHandler) return;
		const engine = this.#engine;
		if (!engine) return;
		const viewManager = engine.getViewManager();
		if (!viewManager) return;
		const canvas = viewManager.getCanvas();
		if (!canvas) return;
		this.#canvasFocusHandler = (pointerEvent) => {
			const isRelease = pointerEvent.type === "touchend";
			if (isRelease && !this.#useTouchEndFocus) return;
			let clientX;
			let clientY;
			const changedTouches = pointerEvent.changedTouches;
			if (changedTouches && changedTouches.length > 0) {
				clientX = changedTouches[0].clientX;
				clientY = changedTouches[0].clientY;
			}
			else if (typeof pointerEvent.clientX === "number" && typeof pointerEvent.clientY === "number") {
				clientX = pointerEvent.clientX;
				clientY = pointerEvent.clientY;
			}
			else {
				return;
			}
			if (!this.#domInput) return;
			// 브라우저가 센 누름 수. (mousedown 의 detail, 손가락은 1)
			if (pointerEvent.type === "mousedown") {
				this.#pointerClickCount = System.Math.max(1, pointerEvent.detail || 1);
			}
			else if (pointerEvent.type === "touchstart") {
				this.#pointerClickCount = 1;
			}
			const canvasRect = canvas.getBoundingClientRect();
			const canvasPosition = Vector2.create(clientX - canvasRect.left, clientY - canvasRect.top);
			const viewInputPosition = viewManager.canvasPositionToViewPosition(canvasPosition);
			const isVisibleInHierarchy = (typeof this.isVisibleInHierarchy === "function") ? this.isVisibleInHierarchy() : true;
			const isInside = isVisibleInHierarchy && this.contains(viewInputPosition);
			if (isInside) {
				if (isRelease && this.#focused && this.#isFocusedWithoutActivation) {
					this.#domInput.blur();
				}
				this.#domInput.focus();
			}
			else if (this.#focused && !isRelease) {
				this.#domInput.blur();
			}
		};
		canvas.addEventListener("touchstart", this.#canvasFocusHandler, { passive: true });
		canvas.addEventListener("touchend", this.#canvasFocusHandler, { passive: true });
		canvas.addEventListener("mousedown", this.#canvasFocusHandler, { passive: true });
	}

	//==============================================================================
	// 캔버스 touchstart 동기 focus 핸들러 해제.
	//==============================================================================
	detachCanvasFocusHandler() {
		if (!this.#canvasFocusHandler) return;
		const engine = this.#engine;
		if (engine) {
			const viewManager = engine.getViewManager();
			if (viewManager) {
				const canvas = viewManager.getCanvas();
				if (canvas) {
					canvas.removeEventListener("touchstart", this.#canvasFocusHandler);
					canvas.removeEventListener("touchend", this.#canvasFocusHandler);
					canvas.removeEventListener("mousedown", this.#canvasFocusHandler);
				}
			}
		}
		this.#canvasFocusHandler = null;
	}

	//==============================================================================
	// DOM 입력을 필드의 화면 자리에 맞추기. (직접 누름이면 보이는 동안만 누름을 받는다)
	//==============================================================================
	layoutDOMInput() {
		if (!this.#domInput || !this.#engine) return;
		const viewManager = this.#engine.getViewManager();
		const canvas = viewManager.getCanvas();
		if (!canvas) return;
		const canvasRect = canvas.getBoundingClientRect();
		const targetScale = viewManager.getTargetResolutionScale() || 1;

		// 숨은 입력은 body 에 붙은 absolute 라 문서 좌표다. (getBoundingClientRect 는 뷰포트 좌표라 스크롤한 만큼 더한다)
		const scrollX = System.scrollX || 0;
		const scrollY = System.scrollY || 0;
		const globalPos = this.getPosition();
		const contentSize = this.getContentSize();
		this.#domInput.style.left = `${canvasRect.left + scrollX + globalPos.x * targetScale}px`;
		this.#domInput.style.top = `${canvasRect.top + scrollY + globalPos.y * targetScale}px`;
		this.#domInput.style.width = `${contentSize.x * targetScale}px`;
		this.#domInput.style.height = `${contentSize.y * targetScale}px`;
		if (this.#useDirectTouch) {
			const isVisibleInHierarchy = (typeof this.isVisibleInHierarchy === "function") ? this.isVisibleInHierarchy() : true;
			const pointerEvents = isVisibleInHierarchy ? "auto" : "none";
			if (this.#domInput.style.pointerEvents !== pointerEvents) {
				this.#domInput.style.pointerEvents = pointerEvents;
				this.#domInput.style.userSelect = "text";
				this.#domInput.style.webkitUserSelect = "text";
			}
		}
	}

	//==============================================================================
	// DOM 입력의 값 받기. (조합 중이 아니고 값이 바뀌었으면 담고 바뀜 콜백을 부른다)
	//==============================================================================
	handleDOMInputEvent() {
		if (!this.#domInput) return;
		if (this.#isComposing) return;
		const next = this.#domInput.value;
		if (next === this.#value) return;
		this.#value = next;
		const sel = this.#domInput.selectionEnd;
		this.#cursorIndex = (typeof sel === "number") ? sel : this.#value.length;
		this.#selectionStart = this.#cursorIndex;
		this.#blinkTimer = 0;
		this.#cursorVisible = true;
		this.refreshTexts();
		if (this.#onChangeCallback) this.#onChangeCallback(this.#value);
	}

	//==============================================================================
	// 캔버스 모드 키보드 (DOM input 미사용 시).
	//==============================================================================
	attachCanvasKeyboard() {
		if (this.#canvasKeydownHandler) return;
		this.#canvasKeydownHandler = (event) => this.handleCanvasKeydown(event);
		System.document.addEventListener("keydown", this.#canvasKeydownHandler);
	}
	//==============================================================================
	// 캔버스 모드 키보드 사건 떼기.
	//==============================================================================
	detachCanvasKeyboard() {
		if (!this.#canvasKeydownHandler) return;
		System.document.removeEventListener("keydown", this.#canvasKeydownHandler);
		this.#canvasKeydownHandler = null;
	}
	//==============================================================================
	// 캔버스 모드 키 입력 처리. (포커스일 때만, Ctrl 이나 Cmd 와 A, C, X, V, 지우기, 화살표, Home, End, Enter, 글자 한 개)
	//==============================================================================
	/**
	 * @param { KeyboardEvent } event 문서의 keydown 사건.
	 */
	handleCanvasKeydown(event) {
		if (!this.#focused) return;
		const wordCommand = findWordEditCommand(event);
		if (wordCommand) {
			event.preventDefault();
			this.#performWordEditCommand(wordCommand, event.shiftKey);
			this.#blinkTimer = 0;
			this.#cursorVisible = true;
			return;
		}
		const ctrl = event.ctrlKey || event.metaKey;

		if (ctrl) {
			const key = event.key.toLowerCase();
			if (key === "a") { event.preventDefault(); this.selectAll(); return; }
			if (key === "c") { event.preventDefault(); this.copy(); return; }
			if (key === "x") { event.preventDefault(); this.cut(); return; }
			if (key === "v") { event.preventDefault(); this.paste(); return; }
			return;
		}

		if (event.key === "Backspace") {
			event.preventDefault();
			if (this.hasSelection()) {
				this.replaceSelection("");
			}
			else if (this.#cursorIndex > 0) {
				const deletionStart = findBackwardDeletionBoundary(this.#value, this.#cursorIndex);
				this.deleteRange(deletionStart, this.#cursorIndex);
			}
		}
		else if (event.key === "Delete") {
			event.preventDefault();
			if (this.hasSelection()) {
				this.replaceSelection("");
			}
			else if (this.#cursorIndex < this.#value.length) {
				this.deleteCharAt(this.#cursorIndex);
			}
		}
		else if (event.key === "ArrowLeft") {
			event.preventDefault();
			const selectionRange = this.getSelectionRange();
			if (selectionRange && !event.shiftKey) {
				this.moveCursor(selectionRange.start, false);
			}
			else {
				const previousIndex = findPreviousGraphemeBoundary(this.#value, this.#cursorIndex);
				this.moveCursor(previousIndex, event.shiftKey);
			}
		}
		else if (event.key === "ArrowRight") {
			event.preventDefault();
			const selectionRange = this.getSelectionRange();
			if (selectionRange && !event.shiftKey) {
				this.moveCursor(selectionRange.end, false);
			}
			else {
				const nextIndex = findNextGraphemeBoundary(this.#value, this.#cursorIndex);
				this.moveCursor(nextIndex, event.shiftKey);
			}
		}
		else if (event.key === "Home") {
			event.preventDefault();
			this.moveCursor(0, event.shiftKey);
		}
		else if (event.key === "End") {
			event.preventDefault();
			this.moveCursor(this.#value.length, event.shiftKey);
		}
		else if (event.key === "Enter") {
			event.preventDefault();
			if (this.#onSubmitCallback) this.#onSubmitCallback(this.#value);
		}
		else if (event.key.length === 1 && !event.altKey) {
			event.preventDefault();
			this.replaceSelection(event.key);
		}
		this.#blinkTimer = 0;
		this.#cursorVisible = true;
	}
	//==============================================================================
	// 낱말 이동과 지우기 하기. (블링크 SelectionModifier 의 kWord 와 TypingCommand 의 낱말 지우기)
	// - 옮기기는 선택이 있어도 커서(focus) 자리에서 찾는다. 오른쪽은 윈도우만 뒤 공백을 건너뛴다. (ShouldSkipSpaceWhenMovingRight)
	// - 맥은 고른 것을 낱말로 넓히다 고정 끝을 넘으면 고정 끝에서 멈춘다. (ShouldExtendSelectionByWordOrLineAcrossCaret)
	// - 지우기는 고른 것이 있으면 고른 것만 지운다. 없으면 커서에서 낱말 자리까지 지우고, 낱말 자리가 커서와 같으면 글자 묶음 하나를 지운다. (킬 링 지우기 규칙)
	//==============================================================================
	/**
	 * @param { string } command 명령. ("moveWordLeft", "moveWordRight", "deleteWordBackward", "deleteWordForward")
	 * @param { boolean } isShiftKey 옮기기에서 참이면 선택의 고정 끝을 두고 선택을 늘린다.
	 */
	#performWordEditCommand(command, isShiftKey) {
		const value = this.#value;
		const cursorIndex = this.#cursorIndex;
		if (command === "moveWordLeft" || command === "moveWordRight") {
			let targetIndex = command === "moveWordRight" ? findNextWordPosition(value, cursorIndex, isWindowsPlatform()) : findPreviousWordPosition(value, cursorIndex);
			const anchorIndex = this.#selectionStart;
			if (isShiftKey && isMacPlatform() && anchorIndex !== cursorIndex && (anchorIndex <= cursorIndex) !== (anchorIndex <= targetIndex)) {
				targetIndex = anchorIndex;
			}
			this.moveCursor(targetIndex, isShiftKey);
			return;
		}
		if (this.hasSelection()) {
			this.replaceSelection("");
			return;
		}
		if (command === "deleteWordForward") {
			let endIndex = findNextWordPosition(value, cursorIndex, isWindowsPlatform());
			if (endIndex === cursorIndex) {
				endIndex = findNextGraphemeBoundary(value, cursorIndex);
			}
			this.deleteRange(cursorIndex, endIndex);
		}
		else {
			let startIndex = findPreviousWordPosition(value, cursorIndex);
			if (startIndex === cursorIndex) {
				startIndex = findPreviousGraphemeBoundary(value, cursorIndex);
			}
			this.deleteRange(startIndex, cursorIndex);
		}
	}
	//==============================================================================
	// 커서 옮기기.
	//==============================================================================
	/**
	 * @param { number } newIndex 옮길 자리. (UTF-16 단위, 0 ~ 값 길이로 자른다, 서로게이트 쌍 가운데면 그 글자 뒤로 본다)
	 * @param { boolean } extendSelection 참이면 선택의 고정 끝을 두고 선택을 늘린다.
	 */
	moveCursor(newIndex, extendSelection) {
		let clamped = System.Math.max(0, System.Math.min(this.#value.length, newIndex));
		if (isInsideSurrogatePair(this.#value, clamped)) {
			clamped += 1;
		}
		this.#cursorIndex = clamped;
		if (!extendSelection) this.#selectionStart = clamped;
		this.refreshTexts();
	}
	//==============================================================================
	// 한 글자 지우기. (그 자리부터 글자 묶음 하나, 크롬 Delete 키처럼 이모지나 결합 부호를 쪼개지 않는다, 바뀜 콜백을 부른다)
	//==============================================================================
	/**
	 * @param { number } index 지울 글자의 자리. (UTF-16 단위)
	 */
	deleteCharAt(index) {
		const endIndex = findNextGraphemeBoundary(this.#value, index);
		this.deleteRange(index, endIndex);
	}
	//==============================================================================
	// 글 범위 지우기. (커서는 지운 자리로 당기고 선택은 접는다, 바뀜 콜백을 부른다)
	//==============================================================================
	/**
	 * @param { number } startIndex 지울 범위의 앞. (UTF-16 단위)
	 * @param { number } endIndex 지울 범위의 뒤. (UTF-16 단위, 앞보다 크지 않으면 아무것도 하지 않는다)
	 */
	deleteRange(startIndex, endIndex) {
		const start = System.Math.max(0, startIndex);
		const end = System.Math.min(this.#value.length, endIndex);
		if (end <= start) {
			return;
		}
		this.#value = this.#value.slice(0, start) + this.#value.slice(end);
		if (this.#cursorIndex >= end) {
			this.#cursorIndex -= end - start;
		}
		else if (this.#cursorIndex > start) {
			this.#cursorIndex = start;
		}
		this.#selectionStart = this.#cursorIndex;
		this.refreshTexts();
		if (this.#onChangeCallback) {
			this.#onChangeCallback(this.#value);
		}
	}

	//==============================================================================
	// 포커스 / 블러 핸들러 (DOM/캔버스 모드 공용).
	//==============================================================================
	handleFocus() {
		this.#focused = true;
		this.#isFocusedWithoutActivation = !hasStickyUserActivation();
		this.#blinkTimer = 0;
		this.#cursorVisible = true;
		// 직접 누름이면 브라우저가 투명한 글자의 누른 자리에 커서를 두므로, 그 뒤에 글 끝으로 옮긴다. (캔버스의 글자와 자리가 다르다)
		if (this.#useDirectTouch && this.#domInput) {
			const input = this.#domInput;
			System.setTimeout(() => {
				if (this.#domInput !== input) return;
				const length = input.value.length;
				input.setSelectionRange(length, length);
			}, 0);
		}
	}
	//==============================================================================
	// 포커스 잃음 처리. (문맥 메뉴를 닫는다)
	//==============================================================================
	handleBlur() {
		this.#focused = false;
		this.hideContextMenu();
	}

	//==============================================================================
	// 선택 / 클립보드.
	//==============================================================================
	/**
	 * @returns { boolean } 선택한 글이 있으면 참.
	 */
	hasSelection() { return this.#cursorIndex !== this.#selectionStart; }
	//==============================================================================
	// 선택 범위 반환.
	//==============================================================================
	/**
	 * @returns { { start: number, end: number } | null } 선택 범위. (start 가 작은 쪽, 선택이 없으면 null)
	 */
	getSelectionRange() {
		if (!this.hasSelection()) return null;
		return {
			start: System.Math.min(this.#cursorIndex, this.#selectionStart),
			end: System.Math.max(this.#cursorIndex, this.#selectionStart),
		};
	}
	//==============================================================================
	// 선택한 글 반환.
	//==============================================================================
	/**
	 * @returns { string } 선택한 글. (없으면 빈 글)
	 */
	getSelectionText() {
		const range = this.getSelectionRange();
		if (!range) return "";
		return this.#value.slice(range.start, range.end);
	}
	//==============================================================================
	// 선택을 글로 바꾸기. (선택이 없으면 커서 자리에 끼운다, 바뀜 콜백을 부른다)
	// - 최대 길이가 있으면 블링크 입력 칸처럼 넣는 글을 남은 길이까지만 넣는다. (서로게이트 쌍은 쪼개지 않는다)
	//==============================================================================
	/**
	 * @param { string } text 넣을 글. (빈 글이면 선택을 지운다)
	 */
	replaceSelection(text) {
		const range = this.getSelectionRange() || { start: this.#cursorIndex, end: this.#cursorIndex };
		let insertedText = text;
		if (this.#maxLength > 0) {
			const appendableLength = System.Math.max(0, this.#maxLength - (this.#value.length - (range.end - range.start)));
			insertedText = limitTextLength(text, appendableLength);
		}
		const next = this.#value.slice(0, range.start) + insertedText + this.#value.slice(range.end);
		this.#value = next;
		this.#cursorIndex = System.Math.min(range.start + insertedText.length, next.length);
		this.#selectionStart = this.#cursorIndex;
		if (this.#domInput) {
			this.#domInput.value = this.#value;
			this.#domInput.setSelectionRange(this.#cursorIndex, this.#cursorIndex);
		}
		this.refreshTexts();
		if (this.#onChangeCallback) this.#onChangeCallback(this.#value);
	}

	//==============================================================================
	// 잘라내기. (선택한 글을 클립보드에 쓰고 지운다, 선택이 없으면 아무것도 하지 않는다)
	//==============================================================================
	cut() {
		if (!this.hasSelection()) return;
		const text = this.getSelectionText();
		this.writeClipboard(text);
		this.replaceSelection("");
	}
	//==============================================================================
	// 복사. (선택한 글을 클립보드에 쓴다, 선택이 없으면 아무것도 하지 않는다)
	//==============================================================================
	copy() {
		if (!this.hasSelection()) return;
		this.writeClipboard(this.getSelectionText());
	}
	//==============================================================================
	// 붙여넣기. (클립보드 글을 비동기로 읽어 선택 자리에 넣는다, 읽지 못하거나 비었으면 무시한다)
	//==============================================================================
	paste() {
		this.readClipboard().then((text) => {
			if (typeof text === "string" && text.length > 0) {
				this.replaceSelection(text);
			}
		}).catch(() => { /* 무시 */ });
	}

	//==============================================================================
	// 문맥 메뉴 항목 부탁. (다음 tick 에 한다, UIInputFieldMenuAction)
	//==============================================================================
	/**
	 * @param { string } menuAction 할 항목. (UIInputFieldMenuAction 의 값)
	 * @example <caption>게임의 메뉴에서 복사 부탁하기</caption>
	 * import { Engine, EngineConfiguration, UIScene, UIInputField, UIInputFieldMenuAction, Vector2 } from "./build/vanilla.js";
	 *
	 * class MainScene extends UIScene {
	 * 	constructor() {
	 * 		super();
	 * 		this.setLoadingMinDurationMs(0);
	 * 	}
	 *
	 * 	initialize(engine) {
	 * 		super.initialize(engine);
	 * 		const inputField = new UIInputField();
	 * 		inputField.setEngine(engine);
	 * 		inputField.setLocalPosition(Vector2.create(40, 40));
	 * 		inputField.setContentSize(Vector2.create(320, 56));
	 * 		const root = this.getRoot();
	 * 		root.addChild(inputField);
	 * 		inputField.attach();
	 * 		inputField.setText("Invite code 1234");
	 * 		inputField.selectAll();
	 * 		inputField.requestMenuAction(UIInputFieldMenuAction.copy);
	 * 		console.log(inputField.getSelectionText());
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
	requestMenuAction(menuAction) {
		this.#pendingMenuAction = menuAction;
	}

	//==============================================================================
	// 문맥 메뉴 항목 하기.
	//==============================================================================
	/**
	 * @param { string } menuAction 할 항목. (UIInputFieldMenuAction 의 값, 그 밖이면 아무것도 하지 않는다)
	 */
	performMenuAction(menuAction) {
		switch (menuAction) {
			case UIInputFieldMenuAction.cut: {
				this.cut();
				break;
			}
			case UIInputFieldMenuAction.copy: {
				this.copy();
				break;
			}
			case UIInputFieldMenuAction.paste: {
				this.paste();
				break;
			}
		}
	}
	//==============================================================================
	// 클립보드에 쓰기. (navigator.clipboard 가 없거나 막히면 무시한다)
	//==============================================================================
	/**
	 * @param { string } text 쓸 글.
	 */
	writeClipboard(text) {
		try {
			if (System.navigator && System.navigator.clipboard) {
				System.navigator.clipboard.writeText(text).catch(() => {});
			}
		}
		catch (error) { /* 무시 */ }
	}
	//==============================================================================
	// 클립보드 읽기.
	//==============================================================================
	/**
	 * @returns { Promise<string> } 클립보드 글로 풀리는 프로미스. (navigator.clipboard 가 없으면 빈 글, 읽기가 막히면 거부될 수 있다)
	 */
	readClipboard() {
		try {
			if (System.navigator && System.navigator.clipboard) {
				return System.navigator.clipboard.readText();
			}
		}
		catch (error) { /* 무시 */ }
		return System.Promise.resolve("");
	}

	//==============================================================================
	// 컨텍스트 메뉴 (우클릭).
	//==============================================================================
	attachContextMenuHandler() {
		if (!this.#engine || this.#contextMenuHandler) return;
		const canvas = this.#engine.getViewManager().getCanvas();
		if (!canvas) return;
		this.#contextMenuHandler = (event) => this.handleContextMenuEvent(event);
		canvas.addEventListener("contextmenu", this.#contextMenuHandler);
	}
	//==============================================================================
	// 캔버스의 contextmenu 사건 떼기.
	//==============================================================================
	detachContextMenuHandler() {
		if (!this.#contextMenuHandler || !this.#engine) return;
		const canvas = this.#engine.getViewManager().getCanvas();
		if (canvas) canvas.removeEventListener("contextmenu", this.#contextMenuHandler);
		this.#contextMenuHandler = null;
	}
	//==============================================================================
	// 우클릭 처리. (필드 안이면 기본 메뉴를 막고 포커스한 뒤 문맥 메뉴를 띄운다)
	//==============================================================================
	/**
	 * @param { MouseEvent } event 캔버스의 contextmenu 사건.
	 */
	handleContextMenuEvent(event) {
		if (!this.#engine) return;
		const viewManager = this.#engine.getViewManager();
		const canvas = viewManager.getCanvas();
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const canvasNative = Vector2.create(event.clientX - rect.left, event.clientY - rect.top);
		const viewPos = viewManager.canvasPositionToViewPosition(canvasNative);
		if (!this.contains(viewPos)) return;
		event.preventDefault();
		event.stopPropagation();
		this.focus();
		this.showContextMenu(event.clientX, event.clientY);
	}
	//==============================================================================
	// 문맥 메뉴 띄우기. (잘라내기, 복사, 붙여넣기 DOM 메뉴, 메뉴 밖을 누르면 닫는다)
	// - 메뉴는 body 에 붙은 absolute 라 문서 좌표로 놓는다. (뷰포트 좌표인 clientX, clientY 에 스크롤한 만큼 더한다)
	//==============================================================================
	/**
	 * @param { number } clientX 메뉴 왼쪽 위의 X. (CSS 픽셀, 뷰포트 좌표 clientX)
	 * @param { number } clientY 메뉴 왼쪽 위의 Y. (CSS 픽셀, 뷰포트 좌표 clientY)
	 */
	showContextMenu(clientX, clientY) {
		this.hideContextMenu();
		const doc = System.document;
		const scrollX = System.scrollX || 0;
		const scrollY = System.scrollY || 0;
		const menu = doc.createElement("div");
		menu.style.position = "absolute";
		menu.style.left = `${clientX + scrollX}px`;
		menu.style.top = `${clientY + scrollY}px`;
		menu.style.zIndex = "10000";
		menu.style.background = "#ffffff";
		menu.style.color = "#222222";
		menu.style.border = "1px solid #cccccc";
		menu.style.borderRadius = "8px";
		menu.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.18)";
		menu.style.padding = "4px 0";
		menu.style.fontFamily = "system-ui, -apple-system, sans-serif";
		menu.style.fontSize = "14px";
		menu.style.minWidth = "140px";
		menu.style.userSelect = "none";

		const hasSel = this.hasSelection();
		const items = [
			{ text: "잘라내기", enabled: hasSel,  action: () => this.cut() },
			{ text: "복사",     enabled: hasSel,  action: () => this.copy() },
			{ text: "붙여넣기", enabled: true,    action: () => this.paste() },
		];
		for (const item of items) {
			const button = doc.createElement("div");
			button.textContent = item.text;
			button.style.padding = "8px 16px";
			button.style.cursor = item.enabled ? "pointer" : "default";
			button.style.color = item.enabled ? "#222222" : "#aaaaaa";
			if (item.enabled) {
				button.addEventListener("mouseenter", () => { button.style.background = "#eef2ff"; });
				button.addEventListener("mouseleave", () => { button.style.background = "transparent"; });
				button.addEventListener("mousedown", (event) => { event.preventDefault(); event.stopPropagation(); });
				button.addEventListener("click", (event) => {
					event.preventDefault();
					event.stopPropagation();
					item.action();
					this.hideContextMenu();
				});
			}
			menu.appendChild(button);
		}
		doc.body.appendChild(menu);
		this.#contextMenuElement = menu;

		// 메뉴 밖 클릭으로 닫기. 다음 tick 부터 (현재 클릭이 dismiss 로 처리되지 않게).
		System.setTimeout(() => {
			const dismissHandler = (event) => {
				if (this.#contextMenuElement && !this.#contextMenuElement.contains(event.target)) {
					this.hideContextMenu();
				}
			};
			this.#contextMenuDismissHandler = dismissHandler;
			doc.addEventListener("pointerdown", dismissHandler, true);
		}, 0);
	}
	//==============================================================================
	// 문맥 메뉴 닫기.
	//==============================================================================
	hideContextMenu() {
		if (this.#contextMenuElement) {
			try {
				if (this.#contextMenuElement.parentNode) {
					this.#contextMenuElement.parentNode.removeChild(this.#contextMenuElement);
				}
			}
			catch (error) { /* 무시 */ }
			this.#contextMenuElement = null;
		}
		if (this.#contextMenuDismissHandler) {
			System.document.removeEventListener("pointerdown", this.#contextMenuDismissHandler, true);
			this.#contextMenuDismissHandler = null;
		}
	}
}


//==============================================================================
// 텍스트보다 먼저 그려지는 레이어 (선택 영역 하이라이트).
//==============================================================================
class BackgroundLayerRenderer extends Component {
	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setComponentType("UIInputFieldBgLayer");
	}
	//==============================================================================
	// 출력. (선택 영역 하이라이트, 조합 중이면 그리지 않는다)
	//==============================================================================
	/**
	 * @param { Graphic } graphic 그래픽.
	 */
	draw(graphic) {
		const node = this.getNode();
		if (!node || typeof node.getRenderState !== "function") return;
		const state = node.getRenderState();
		const contentSize = node.getContentSize();
		if (contentSize.x <= 0 || contentSize.y <= 0) return;
		// 선택 영역 (조합 중엔 표시 안 함).
		if (state.composition.length === 0 && state.selectionStart !== state.cursorIndex) {
			graphic.pushState();
			graphic.setFontString(buildFontString(state.fontFace, state.fontSize, false, false));
			const selStart = System.Math.min(state.selectionStart, state.cursorIndex);
			const selEnd = System.Math.max(state.selectionStart, state.cursorIndex);
			const startX = state.padding + graphic.measureText(state.value.slice(0, selStart)).width;
			const endX = state.padding + graphic.measureText(state.value.slice(0, selEnd)).width;
			const halfH = state.fontSize * 0.65;
			const drawY = contentSize.y * 0.5;
			graphic.setFillColor(state.selectionColor.toHEXString());
			graphic.drawRect(Rect.create(startX, drawY - halfH, endX - startX, halfH * 2));
			graphic.popState();
		}
	}
}


//==============================================================================
// 텍스트 위에 그려지는 레이어 (조합문자 밑줄 + 커서 + 포커스 테두리).
// - UIInputField 의 자식 노드에 부착되어 텍스트 라벨보다 늦게 그려진다.
//==============================================================================
class OverlayLayerRenderer extends Component {
	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setComponentType("UIInputFieldOverlayLayer");
	}
	//==============================================================================
	// 출력. (조합 밑줄, 커서, 포커스 테두리)
	//==============================================================================
	/**
	 * @param { Graphic } graphic 그래픽.
	 */
	draw(graphic) {
		const node = this.getNode();
		if (!node) return;
		const parent = typeof node.getParent === "function" ? node.getParent() : null;
		if (!parent || typeof parent.getRenderState !== "function") return;
		const state = parent.getRenderState();
		const contentSize = node.getContentSize();
		if (contentSize.x <= 0 || contentSize.y <= 0) return;

		graphic.pushState();
		graphic.setFontString(buildFontString(state.fontFace, state.fontSize, false, false));
		const drawY = contentSize.y * 0.5;
		const padding = state.padding;
		const before = state.value.slice(0, state.cursorIndex);

		// 조합 중 밑줄.
		if (state.composition.length > 0) {
			const beforeWidth = graphic.measureText(before).width;
			const compWidth = graphic.measureText(state.composition).width;
			const underlineY = drawY + state.fontSize * 0.55;
			graphic.setStrokeColor(state.compositionUnderlineColor.toHEXString());
			graphic.drawLine([
				Vector2.create(padding + beforeWidth, underlineY),
				Vector2.create(padding + beforeWidth + compWidth, underlineY),
			], 2);
		}

		// 커서.
		if (state.focused && state.cursorVisible) {
			const cursorBeforeText = before + state.composition;
			const cursorX = padding + graphic.measureText(cursorBeforeText).width;
			const halfHeight = state.fontSize * 0.6;
			graphic.setStrokeColor(state.cursorColor.toHEXString());
			graphic.drawLine([
				Vector2.create(cursorX, drawY - halfHeight),
				Vector2.create(cursorX, drawY + halfHeight),
			], 2);
		}

		// 포커스 테두리.
		if (state.focused && state.focusBorderWidth > 0) {
			const w = state.focusBorderWidth;
			const inset = w * 0.5;
			graphic.setStrokeColor(state.focusBorderColor.toHEXString());
			const x = inset;
			const y = inset;
			const rectW = contentSize.x - w;
			const rectH = contentSize.y - w;
			const radius = System.Math.max(0, state.bgRoundSize - inset);
			graphic.drawStrokeRoundRect(Rect.create(x, y, rectW, rectH), radius, w);
		}

		graphic.popState();
	}
}


//==============================================================================
// 글자 묶음(확장 자소 묶음, UAX #29) 나누개. (Intl.Segmenter 가 없는 브라우저는 null, 처음 부를 때 만든다)
//==============================================================================
let graphemeSegmenter = undefined;
//==============================================================================
// 글자 묶음 나누개 반환.
//==============================================================================
/**
 * @returns { Intl.Segmenter | null }
 */
function getGraphemeSegmenter() {
	if (graphemeSegmenter === undefined) {
		const intl = System.Intl;
		const segmenterClass = intl ? intl.Segmenter : undefined;
		graphemeSegmenter = typeof segmenterClass === "function" ? new segmenterClass(undefined, { granularity: "grapheme" }) : null;
	}
	return graphemeSegmenter;
}

//==============================================================================
// 자리가 서로게이트 쌍 가운데인지. (앞 글자가 앞 서로게이트, 뒤 글자가 뒤 서로게이트)
//==============================================================================
/**
 * @param { string } text 글.
 * @param { number } index UTF-16 자리.
 * @returns { boolean }
 */
function isInsideSurrogatePair(text, index) {
	if (index <= 0 || index >= text.length) {
		return false;
	}
	const previousCodeUnit = text.charCodeAt(index - 1);
	const nextCodeUnit = text.charCodeAt(index);
	return previousCodeUnit >= 0xD800 && previousCodeUnit <= 0xDBFF && nextCodeUnit >= 0xDC00 && nextCodeUnit <= 0xDFFF;
}

//==============================================================================
// 앞 글자 묶음 경계. (크롬 왼쪽 화살표의 PositionMoveType::kGraphemeCluster, Intl.Segmenter 가 없으면 코드 포인트 단위)
//==============================================================================
/**
 * @param { string } text 글.
 * @param { number } index UTF-16 자리.
 * @returns { number } 앞 경계의 UTF-16 자리. (0 이면 0)
 */
function findPreviousGraphemeBoundary(text, index) {
	if (index <= 0) {
		return 0;
	}
	const segmenter = getGraphemeSegmenter();
	if (segmenter) {
		const segment = segmenter.segment(text).containing(index - 1);
		return segment ? segment.index : index - 1;
	}
	return isInsideSurrogatePair(text, index - 1) ? index - 2 : index - 1;
}

//==============================================================================
// 뒤 글자 묶음 경계. (크롬 오른쪽 화살표와 Delete 키의 PositionMoveType::kGraphemeCluster, Intl.Segmenter 가 없으면 코드 포인트 단위)
//==============================================================================
/**
 * @param { string } text 글.
 * @param { number } index UTF-16 자리.
 * @returns { number } 뒤 경계의 UTF-16 자리. (글 끝이면 글 길이)
 */
function findNextGraphemeBoundary(text, index) {
	if (index >= text.length) {
		return text.length;
	}
	const segmenter = getGraphemeSegmenter();
	if (segmenter) {
		const segment = segmenter.segment(text).containing(index);
		return segment ? segment.index + segment.segment.length : index + 1;
	}
	return isInsideSurrogatePair(text, index + 1) ? index + 2 : index + 1;
}

//==============================================================================
// 글자 묶음 경계 목록. (0 과 글 길이를 넣는다, Intl.Segmenter 가 없으면 코드 포인트 경계)
//==============================================================================
/**
 * @param { string } text 글.
 * @returns { number[] } 경계의 UTF-16 자리 목록. (오름차순)
 */
function collectGraphemeBoundaries(text) {
	const boundaryList = [0];
	let index = 0;
	while (index < text.length) {
		index = findNextGraphemeBoundary(text, index);
		boundaryList.push(index);
	}
	return boundaryList;
}

/** 뒤로 지우기 상태. (블링크 backspace_state_machine.cc 의 BackspaceState) */
const BackspaceState = {
	start: 0,
	beforeLineFeed: 1,
	beforeKeycap: 2,
	beforeVariationSelectorAndKeycap: 3,
	beforeEmojiModifier: 4,
	beforeVariationSelectorAndEmojiModifier: 5,
	beforeVariationSelector: 6,
	beforeZeroWidthJoinerEmoji: 7,
	beforeZeroWidthJoiner: 8,
	beforeVariationSelectorAndZeroWidthJoiner: 9,
	oddNumberedRegionalIndicator: 10,
	evenNumberedRegionalIndicator: 11,
	beforeTagTerm: 12,
	inTagSequence: 13,
};
const VARIATION_SELECTOR_PATTERN = /^\p{Variation_Selector}$/u;
const REGIONAL_INDICATOR_PATTERN = /^\p{Regional_Indicator}$/u;
const EXTENDED_PICTOGRAPHIC_GB11_PATTERN = /^[\p{Extended_Pictographic}\p{Emoji}]$/u;
const EMOJI_MODIFIER_BASE_PATTERN = /^\p{Emoji_Modifier_Base}$/u;
const MARK_PATTERN = /^\p{M}$/u;

//==============================================================================
// 뒤로 지우기(Backspace)로 지울 범위의 앞. (블링크 BackspaceStateMachine 을 옮긴 것)
// - 크롬은 뒤로 지우기를 글자 묶음이 아니라 코드 포인트 하나씩 지운다. 다만 CR LF, 이모지 표현 선택자(VS)와 그 바탕,
//   피부색 조정자와 그 바탕, ZWJ 로 이은 이모지, 국기(지역 표시 글자 둘), 키캡, 태그 묶음은 통째로 지운다.
// - VS 앞 글자의 결합 등급(canonical combining class)이 0 인지는 브라우저가 알려 주지 않아 결합 부호(일반 범주 M)가 아닌지로 본다.
//==============================================================================
/**
 * @param { string } text 글.
 * @param { number } index 커서의 UTF-16 자리.
 * @returns { number } 지울 범위 앞의 UTF-16 자리.
 */
function findBackwardDeletionBoundary(text, index) {
	let state = BackspaceState.start;
	let deleteCount = 0;
	let lastSeenVariationSelectorCount = 0;
	let isProcessingTagSequenceBase = false;
	let position = index;
	while (position > 0) {
		let codePointLength = 1;
		if (isInsideSurrogatePair(text, position - 1)) {
			codePointLength = 2;
		}
		const codePoint = text.codePointAt(position - codePointLength);
		const character = System.String.fromCodePoint(codePoint);
		position -= codePointLength;
		const isVariationSelector = VARIATION_SELECTOR_PATTERN.test(character);
		const isExtendedPictographic = EXTENDED_PICTOGRAPHIC_GB11_PATTERN.test(character);
		const isEmojiModifier = codePoint >= 0x1F3FB && codePoint <= 0x1F3FF;
		const isKeycapBase = (codePoint >= 0x30 && codePoint <= 0x39) || codePoint === 0x23 || codePoint === 0x2A;
		const isTagSequence = (codePoint >= 0xE0030 && codePoint <= 0xE0039) || (codePoint >= 0xE0061 && codePoint <= 0xE007A);
		let isFinished = false;
		switch (state) {
			case BackspaceState.start: {
				deleteCount = codePointLength;
				if (codePoint === 0x0A) {
					state = BackspaceState.beforeLineFeed;
				}
				else if (isVariationSelector) {
					state = BackspaceState.beforeVariationSelector;
				}
				else if (REGIONAL_INDICATOR_PATTERN.test(character)) {
					state = BackspaceState.oddNumberedRegionalIndicator;
				}
				else if (isEmojiModifier) {
					state = BackspaceState.beforeEmojiModifier;
				}
				else if (isExtendedPictographic) {
					state = BackspaceState.beforeZeroWidthJoinerEmoji;
				}
				else if (codePoint === 0x20E3) {
					state = BackspaceState.beforeKeycap;
				}
				else if (codePoint === 0xE007F) {
					state = BackspaceState.beforeTagTerm;
				}
				else {
					isFinished = true;
				}
				break;
			}
			case BackspaceState.beforeLineFeed: {
				if (codePoint === 0x0D) {
					deleteCount += 1;
				}
				isFinished = true;
				break;
			}
			case BackspaceState.beforeKeycap: {
				if (isVariationSelector) {
					lastSeenVariationSelectorCount = codePointLength;
					state = BackspaceState.beforeVariationSelectorAndKeycap;
				}
				else {
					if (isKeycapBase) {
						deleteCount += codePointLength;
					}
					isFinished = true;
				}
				break;
			}
			case BackspaceState.beforeVariationSelectorAndKeycap: {
				if (isKeycapBase) {
					deleteCount += lastSeenVariationSelectorCount + codePointLength;
				}
				isFinished = true;
				break;
			}
			case BackspaceState.beforeEmojiModifier: {
				if (isVariationSelector) {
					lastSeenVariationSelectorCount = codePointLength;
					state = BackspaceState.beforeVariationSelectorAndEmojiModifier;
				}
				else if (EMOJI_MODIFIER_BASE_PATTERN.test(character)) {
					deleteCount += codePointLength;
					if (isProcessingTagSequenceBase) {
						isFinished = true;
					}
					else {
						state = BackspaceState.beforeZeroWidthJoinerEmoji;
					}
				}
				else {
					isFinished = true;
				}
				break;
			}
			case BackspaceState.beforeVariationSelectorAndEmojiModifier: {
				if (EMOJI_MODIFIER_BASE_PATTERN.test(character)) {
					deleteCount += lastSeenVariationSelectorCount + codePointLength;
				}
				isFinished = true;
				break;
			}
			case BackspaceState.beforeVariationSelector: {
				if (isExtendedPictographic) {
					deleteCount += codePointLength;
					if (isProcessingTagSequenceBase) {
						isFinished = true;
					}
					else {
						state = BackspaceState.beforeZeroWidthJoinerEmoji;
					}
				}
				else {
					if (!isVariationSelector && !MARK_PATTERN.test(character)) {
						deleteCount += codePointLength;
					}
					isFinished = true;
				}
				break;
			}
			case BackspaceState.beforeZeroWidthJoinerEmoji: {
				if (codePoint === 0x200D) {
					state = BackspaceState.beforeZeroWidthJoiner;
				}
				else {
					isFinished = true;
				}
				break;
			}
			case BackspaceState.beforeZeroWidthJoiner: {
				if (isExtendedPictographic) {
					deleteCount += codePointLength + 1;
					state = isEmojiModifier ? BackspaceState.beforeEmojiModifier : BackspaceState.beforeZeroWidthJoinerEmoji;
				}
				else if (isVariationSelector) {
					lastSeenVariationSelectorCount = codePointLength;
					state = BackspaceState.beforeVariationSelectorAndZeroWidthJoiner;
				}
				else {
					isFinished = true;
				}
				break;
			}
			case BackspaceState.beforeVariationSelectorAndZeroWidthJoiner: {
				if (isExtendedPictographic) {
					deleteCount += codePointLength + 1 + lastSeenVariationSelectorCount;
					lastSeenVariationSelectorCount = 0;
					state = BackspaceState.beforeZeroWidthJoinerEmoji;
				}
				else {
					isFinished = true;
				}
				break;
			}
			case BackspaceState.oddNumberedRegionalIndicator: {
				if (REGIONAL_INDICATOR_PATTERN.test(character)) {
					deleteCount += 2;
					state = BackspaceState.evenNumberedRegionalIndicator;
				}
				else {
					isFinished = true;
				}
				break;
			}
			case BackspaceState.evenNumberedRegionalIndicator: {
				if (REGIONAL_INDICATOR_PATTERN.test(character)) {
					deleteCount -= 2;
					state = BackspaceState.oddNumberedRegionalIndicator;
				}
				else {
					isFinished = true;
				}
				break;
			}
			case BackspaceState.beforeTagTerm: {
				if (isTagSequence) {
					deleteCount += codePointLength;
					state = BackspaceState.inTagSequence;
				}
				else {
					isFinished = true;
				}
				break;
			}
			case BackspaceState.inTagSequence: {
				if (isTagSequence) {
					deleteCount += codePointLength;
				}
				else if (isEmojiModifier) {
					deleteCount += codePointLength;
					isProcessingTagSequenceBase = true;
					state = BackspaceState.beforeEmojiModifier;
				}
				else if (isVariationSelector) {
					deleteCount += codePointLength;
					isProcessingTagSequenceBase = true;
					state = BackspaceState.beforeVariationSelector;
				}
				else {
					if (isExtendedPictographic) {
						deleteCount += codePointLength;
					}
					isFinished = true;
				}
				break;
			}
		}
		if (isFinished) {
			break;
		}
	}
	return System.Math.max(0, index - deleteCount);
}

//==============================================================================
// 낱말 나누개. (Intl.Segmenter 의 granularity "word", 크롬은 ICU 낱말 나누기라 블링크 WordBreakIterator 와 같다, 없으면 null)
//==============================================================================
let wordSegmenter = undefined;
//==============================================================================
// 낱말 경계 목록. (0 과 글 길이를 넣는다, 오름차순, 크롬 낱말 나누기와 같게)
// - Intl.Segmenter 경계에 크로미엄 ICU 의 wordbrk.patch 규칙을 더한다. 크롬은 마침표(U+002E, U+FF0E)를 숫자 사이에서만 잇고, 쌍점(U+003A, U+FE55, U+FF1A)은 잇지 않는다.
//   (크롬의 Intl.Segmenter 는 이미 그렇고, 다른 브라우저도 크롬과 같게 나눈다)
// - 나누개가 없으면 0 과 글 길이만.
//==============================================================================
/**
 * @param { string } text 글.
 * @returns { number[] } 낱말 경계 자리 목록. (UTF-16 단위)
 */
function collectWordBoundaries(text) {
	if (wordSegmenter === undefined) {
		const intl = System.Intl;
		const segmenterClass = intl ? intl.Segmenter : undefined;
		wordSegmenter = typeof segmenterClass === "function" ? new segmenterClass(undefined, { granularity: "word" }) : null;
	}
	const boundarySet = new Set([0, text.length]);
	if (!wordSegmenter) {
		return Array.from(boundarySet).sort((left, right) => left - right);
	}
	for (const segment of wordSegmenter.segment(text)) {
		boundarySet.add(segment.index);
	}
	for (let index = 0; index < text.length; index += 1) {
		const codeUnit = text.charCodeAt(index);
		const isFullStop = codeUnit === 0x2E || codeUnit === 0xFF0E;
		const isColon = codeUnit === 0x3A || codeUnit === 0xFE55 || codeUnit === 0xFF1A;
		if (!isFullStop && !isColon) {
			continue;
		}
		if (isFullStop && /\p{Nd}/u.test(text.charAt(index - 1)) && /\p{Nd}/u.test(text.charAt(index + 1))) {
			continue;
		}
		boundarySet.add(index);
		boundarySet.add(index + 1);
	}
	return Array.from(boundarySet).sort((left, right) => left - right);
}
//==============================================================================
// 자리의 낱말 범위. (블링크 selection_adjuster.cc 의 ExpandWithGranularity kWord)
// - 공백 덩어리도 한 조각이라 공백을 누르면 공백을 고른다. 경계 자리는 뒤 조각을 고르고, 글 끝이면 앞 조각을 고른다. (ChooseWordSide)
//==============================================================================
/**
 * @param { string } text 글.
 * @param { number } index 누른 자리. (UTF-16 단위)
 * @returns { { start: number, end: number } } 낱말 범위. (UTF-16 단위, 나누개가 없으면 글 전체)
 */
function findWordRangeAt(text, index) {
	const boundaryList = collectWordBoundaries(text);
	if (text.length === 0) {
		return { start: 0, end: 0 };
	}
	const probeIndex = index >= text.length ? text.length - 1 : index;
	for (let boundaryIndex = 0; boundaryIndex + 1 < boundaryList.length; boundaryIndex += 1) {
		if (boundaryList[boundaryIndex] <= probeIndex && probeIndex < boundaryList[boundaryIndex + 1]) {
			return { start: boundaryList[boundaryIndex], end: boundaryList[boundaryIndex + 1] };
		}
	}
	return { start: index, end: index };
}

//==============================================================================
// 뒤 공백 건너뛰기. (블링크 visible_units.cc 의 SkipWhitespace: 공백과 NBSP 는 넘고 줄바꿈에서 멈춘다)
//==============================================================================
/**
 * @param { string } text 글.
 * @param { number } index 시작 자리. (UTF-16 단위)
 * @returns { number } 공백 뒤 자리.
 */
function skipTrailingWhitespace(text, index) {
	let position = index;
	while (position < text.length) {
		const character = text.charAt(position);
		if (character === "\n" || !(/\s/u.test(character) || character === "\u00A0")) {
			break;
		}
		position += 1;
	}
	return position;
}

//==============================================================================
// 윈도우인지. (navigator.platform 이 Win 으로 시작, 크롬 윈도우는 두 번 누른 낱말에 뒤 공백을 붙인다)
//==============================================================================
/**
 * @returns { boolean }
 */
function isWindowsPlatform() {
	const navigator = System.navigator;
	const platform = navigator && typeof navigator.platform === "string" ? navigator.platform : "";
	return platform.startsWith("Win");
}

//==============================================================================
// 맥인지. (navigator.platform 이 Mac 으로 시작, 크롬 맥의 키 묶음과 낱말 고르기 규칙)
//==============================================================================
/**
 * @returns { boolean }
 */
function isMacPlatform() {
	const navigator = System.navigator;
	const platform = navigator && typeof navigator.platform === "string" ? navigator.platform : "";
	return platform.startsWith("Mac");
}

//==============================================================================
// 낱말 이동과 지우기 키의 명령. (없으면 null)
// - 맥이 아니면 블링크 editing_behavior.cc 의 키 표: Ctrl 과 왼쪽, 오른쪽(Shift 와 함께면 고르기), Ctrl 과 Backspace, Delete.
// - 맥은 키 묶음 StandardKeyBinding.dict: Option 과 왼쪽, 오른쪽(moveWordLeft, moveWordRight, Shift 와 함께면 고르기), Option 과 Backspace, Option, Ctrl 과 Backspace(deleteWordBackward),
//   Option 과 Delete(deleteWordForward), Option, Ctrl 과 B, F(moveWordBackward, moveWordForward, Shift 와 함께면 고르기).
//==============================================================================
/**
 * @param { KeyboardEvent } event 문서의 keydown 사건.
 * @returns { string | null } 명령. ("moveWordLeft", "moveWordRight", "deleteWordBackward", "deleteWordForward")
 */
function findWordEditCommand(event) {
	const key = event.key;
	if (isMacPlatform()) {
		if (!event.altKey || event.metaKey) {
			return null;
		}
		if (event.ctrlKey) {
			if (key === "Backspace" && !event.shiftKey) {
				return "deleteWordBackward";
			}
			if (event.code === "KeyB") {
				return "moveWordLeft";
			}
			if (event.code === "KeyF") {
				return "moveWordRight";
			}
			return null;
		}
	}
	else if (!event.ctrlKey || event.altKey || event.metaKey) {
		return null;
	}
	if (key === "ArrowLeft") {
		return "moveWordLeft";
	}
	if (key === "ArrowRight") {
		return "moveWordRight";
	}
	if (key === "Backspace" && !event.shiftKey) {
		return "deleteWordBackward";
	}
	if (key === "Delete" && !event.shiftKey) {
		return "deleteWordForward";
	}
	return null;
}

//==============================================================================
// 양방향 분류가 WS 인 글자. (유니코드 DerivedBidiClass.txt 의 WS 17 글자, 블링크 SkipWhitespaceIfNeeded 의 kWhiteSpaceNeutral)
//==============================================================================
const WHITESPACE_NEUTRAL_CODE_UNIT_SET = new Set([0x0C, 0x20, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A, 0x2028, 0x205F, 0x3000]);
//==============================================================================
// 서로게이트 단위인지.
//==============================================================================
/**
 * @param { number } codeUnit UTF-16 단위. (글 밖이면 0)
 * @returns { boolean }
 */
function isSurrogateCodeUnit(codeUnit) {
	return codeUnit >= 0xD800 && codeUnit <= 0xDFFF;
}
//==============================================================================
// 줄바꿈인지. (블링크 position_units_word.cc 의 IsLineBreak: LF, CR)
//==============================================================================
/**
 * @param { number } codeUnit UTF-16 단위. (글 밖이면 0)
 * @returns { boolean }
 */
function isLineBreakCodeUnit(codeUnit) {
	return codeUnit === 0x0A || codeUnit === 0x0D;
}
//==============================================================================
// 편집 공백인지. (블링크 editing_utilities.h 의 IsWhitespace: NBSP, 공백, 줄바꿈, 탭)
//==============================================================================
/**
 * @param { number } codeUnit UTF-16 단위. (글 밖이면 0)
 * @returns { boolean }
 */
function isEditingWhitespaceCodeUnit(codeUnit) {
	return codeUnit === 0xA0 || codeUnit === 0x20 || codeUnit === 0x0A || codeUnit === 0x09;
}
//==============================================================================
// 낱말이 끊기는 글자인지. (블링크 IsWordBreak: 찍히는 글자(ICU u_isprint, 일반 범주 C 가 아님)이면서 편집 공백이 아니거나, 서로게이트, 줄바꿈, 밑줄)
//==============================================================================
/**
 * @param { number } codeUnit UTF-16 단위. (글 밖이면 0)
 * @returns { boolean }
 */
function isWordBreakCodeUnit(codeUnit) {
	if (isSurrogateCodeUnit(codeUnit) || isLineBreakCodeUnit(codeUnit) || codeUnit === 0x5F) {
		return true;
	}
	return !/\p{C}/u.test(System.String.fromCharCode(codeUnit)) && !isEditingWhitespaceCodeUnit(codeUnit);
}
//==============================================================================
// 문장 부호나 기호인지. (블링크 IsWordBoundary: ICU u_ispunct(일반 범주 P), 기호(일반 범주 S), 서로게이트)
//==============================================================================
/**
 * @param { number } codeUnit UTF-16 단위. (글 밖이면 0)
 * @returns { boolean }
 */
function isWordBoundaryCodeUnit(codeUnit) {
	return isSurrogateCodeUnit(codeUnit) || /[\p{P}\p{S}]/u.test(System.String.fromCharCode(codeUnit));
}
//==============================================================================
// 글자나 숫자인지. (ICU u_isalnum: 일반 범주 L 과 Nd, 서로게이트는 아니다)
//==============================================================================
/**
 * @param { number } codeUnit UTF-16 단위. (글 밖이면 0)
 * @returns { boolean }
 */
function isAlphanumericCodeUnit(codeUnit) {
	return !isSurrogateCodeUnit(codeUnit) && /[\p{L}\p{Nd}]/u.test(System.String.fromCharCode(codeUnit));
}
//==============================================================================
// 글 자리의 UTF-16 단위. (글 밖이면 0, WTF::String 의 operator[] 처럼)
//==============================================================================
/**
 * @param { string } text 글.
 * @param { number } index 자리.
 * @returns { number }
 */
function readCodeUnit(text, index) {
	return index >= 0 && index < text.length ? text.charCodeAt(index) : 0;
}

//==============================================================================
// 낱말 자리를 찾는 글 묶음의 시작 목록. (블링크 TextSegments 가 한 번에 보는 글 묶음)
// - 크롬 textarea 는 줄바꿈을 br 로 두어, 줄바꿈 뒤에 글자가 오는 자리마다 묶음이 나뉜다. (헤드리스 크롬 158 textarea 의 Option + 화살표 자리와 같다)
//==============================================================================
/**
 * @param { string } text 글.
 * @returns { number[] } 묶음 시작 자리 목록. (UTF-16 단위, 0 부터 오름차순)
 */
function collectWordSearchRunStarts(text) {
	const runStartList = [0];
	for (let index = 1; index < text.length; index += 1) {
		if (text.charCodeAt(index - 1) === 0x0A && text.charCodeAt(index) !== 0x0A) {
			runStartList.push(index);
		}
	}
	return runStartList;
}
//==============================================================================
// 묶음 하나에서 다음 낱말 자리. (블링크 position_units_word.cc 의 NextWordPositionInternal 의 Finder::Find)
// - 윈도우(isSkipSpaces)는 뒤 공백을 건너뛰고, 공백 뒤 문장 부호에서 멈춘다. (WordSkipSpacesPunctuationFix 는 stable)
//==============================================================================
/**
 * @param { string } runText 묶음 글.
 * @param { number[] } boundaryList 묶음 안의 낱말 경계. (0 과 묶음 길이를 넣는다)
 * @param { number } offset 찾기 시작할 묶음 안 자리.
 * @param { boolean } isSkipSpaces 뒤 공백을 건너뛸지. (PlatformWordBehavior::kWordSkipSpaces)
 * @param { boolean } isFirstTime 커서가 든 묶음인지.
 * @returns { number } 묶음 안 자리. (이 묶음에 없으면 -1)
 */
function findNextWordInRun(runText, boundaryList, offset, isSkipSpaces, isFirstTime) {
	const length = runText.length;
	const skipWhitespace = (position) => {
		if (isSkipSpaces) {
			for (let runner = position; runner < length; runner += 1) {
				const codeUnit = runText.charCodeAt(runner);
				if (!(isEditingWhitespaceCodeUnit(codeUnit) || WHITESPACE_NEUTRAL_CODE_UNIT_SET.has(codeUnit)) || isLineBreakCodeUnit(codeUnit)) {
					return runner;
				}
			}
		}
		return position;
	};
	if (!isFirstTime && offset < length && isWordBreakCodeUnit(readCodeUnit(runText, offset))) {
		return skipWhitespace(offset);
	}
	if (offset >= length) {
		return -1;
	}
	let punctuationRunner = -1;
	for (const runner of boundaryList) {
		if (runner <= offset) {
			continue;
		}
		const codeUnit = readCodeUnit(runText, runner);
		const previousCodeUnit = readCodeUnit(runText, runner - 1);
		if (isLineBreakCodeUnit(codeUnit)) {
			return skipWhitespace(punctuationRunner >= 0 ? punctuationRunner : runner);
		}
		if (runner < length && isWordBoundaryCodeUnit(codeUnit)) {
			if (isAlphanumericCodeUnit(previousCodeUnit)) {
				return skipWhitespace(runner);
			}
			if (isSkipSpaces && punctuationRunner < 0 && isEditingWhitespaceCodeUnit(previousCodeUnit)) {
				punctuationRunner = runner;
			}
			continue;
		}
		if (punctuationRunner >= 0) {
			return skipWhitespace(punctuationRunner);
		}
		if (runner < length && isWordBreakCodeUnit(previousCodeUnit)) {
			return skipWhitespace(runner);
		}
		if (isSkipSpaces && runner < length && isEditingWhitespaceCodeUnit(previousCodeUnit) && isWordBreakCodeUnit(codeUnit)) {
			return skipWhitespace(runner);
		}
	}
	return runText.charCodeAt(length - 1) !== 0x0A ? length : -1;
}
//==============================================================================
// 묶음 하나에서 앞 낱말 자리. (블링크 position_units_word.cc 의 PreviousWordPositionInternal 의 Finder::Find)
//==============================================================================
/**
 * @param { string } runText 묶음 글.
 * @param { number[] } boundaryList 묶음 안의 낱말 경계. (0 과 묶음 길이를 넣는다)
 * @param { number } offset 찾기 시작할 묶음 안 자리.
 * @param { boolean } isFirstTime 커서가 든 묶음인지.
 * @returns { number } 묶음 안 자리. (이 묶음에 없으면 -1)
 */
function findPreviousWordInRun(runText, boundaryList, offset, isFirstTime) {
	const length = runText.length;
	if (!isFirstTime && length > 0 && offset <= length && isWordBreakCodeUnit(readCodeUnit(runText, offset - 1))) {
		return offset;
	}
	if (offset === 0 || length === 0) {
		return -1;
	}
	let punctuationRunner = -1;
	for (let boundaryIndex = boundaryList.length - 1; boundaryIndex >= 0; boundaryIndex -= 1) {
		const runner = boundaryList[boundaryIndex];
		if (runner >= offset) {
			continue;
		}
		const codeUnit = readCodeUnit(runText, runner);
		if (runner < length && isWordBoundaryCodeUnit(codeUnit)) {
			if (isAlphanumericCodeUnit(readCodeUnit(runText, runner - 1))) {
				return runner;
			}
			punctuationRunner = runner;
			continue;
		}
		if (punctuationRunner >= 0) {
			return punctuationRunner;
		}
		if (runner < length && isWordBreakCodeUnit(codeUnit)) {
			return runner;
		}
	}
	return 0;
}
//==============================================================================
// 묶음 안의 낱말 경계. (묶음 시작을 0 으로, 0 과 묶음 길이를 넣는다)
//==============================================================================
/**
 * @param { number[] } boundaryList 글 전체의 낱말 경계.
 * @param { number } runStart 묶음 시작.
 * @param { number } runEnd 묶음 끝.
 * @returns { number[] }
 */
function collectRunBoundaries(boundaryList, runStart, runEnd) {
	const runBoundaryList = [0];
	for (const boundary of boundaryList) {
		if (boundary > runStart && boundary < runEnd) {
			runBoundaryList.push(boundary - runStart);
		}
	}
	runBoundaryList.push(runEnd - runStart);
	return runBoundaryList;
}
//==============================================================================
// 다음 낱말 자리. (크롬 오른쪽 낱말 이동과 앞으로 낱말 지우기, 블링크 NextWordPosition)
// - 맥과 리눅스는 지금 낱말의 끝("abc| def|"), 윈도우는 뒤 공백을 건너뛴 다음 낱말 앞("abc |def")이다. (editing_behavior.h 의 ShouldSkipSpaceWhenMovingRight)
// - 줄 끝에서는 다음 줄 앞으로 간다. 글 끝이면 글 길이.
//==============================================================================
/**
 * @param { string } text 글.
 * @param { number } index 커서 자리. (UTF-16 단위)
 * @param { boolean } isSkipSpaces 뒤 공백을 건너뛸지. (윈도우면 참)
 * @returns { number } 다음 낱말 자리. (UTF-16 단위)
 */
function findNextWordPosition(text, index, isSkipSpaces) {
	const position = System.Math.max(0, System.Math.min(text.length, index));
	const boundaryList = collectWordBoundaries(text);
	const runStartList = collectWordSearchRunStarts(text);
	let runIndex = runStartList.length - 1;
	while (runIndex > 0 && runStartList[runIndex] > position) {
		runIndex -= 1;
	}
	for (let isFirstTime = true; runIndex < runStartList.length; runIndex += 1) {
		const runStart = runStartList[runIndex];
		const runEnd = runIndex + 1 < runStartList.length ? runStartList[runIndex + 1] : text.length;
		const offset = isFirstTime ? position - runStart : 0;
		const found = findNextWordInRun(text.slice(runStart, runEnd), collectRunBoundaries(boundaryList, runStart, runEnd), offset, isSkipSpaces, isFirstTime);
		if (found >= 0) {
			return runStart + found;
		}
		isFirstTime = false;
	}
	return text.length;
}
//==============================================================================
// 앞 낱말 자리. (크롬 왼쪽 낱말 이동과 뒤로 낱말 지우기, 블링크 PreviousWordPosition, 모든 플랫폼에서 낱말 앞 "|abc |def")
// - textarea 처럼 글자가 있는 줄의 앞에서는 앞 줄로 넘어가지 않는다. 글 앞이면 0.
//==============================================================================
/**
 * @param { string } text 글.
 * @param { number } index 커서 자리. (UTF-16 단위)
 * @returns { number } 앞 낱말 자리. (UTF-16 단위)
 */
function findPreviousWordPosition(text, index) {
	const position = System.Math.max(0, System.Math.min(text.length, index));
	const boundaryList = collectWordBoundaries(text);
	const runStartList = collectWordSearchRunStarts(text);
	let runIndex = runStartList.length - 1;
	while (runIndex > 0 && runStartList[runIndex] > position) {
		runIndex -= 1;
	}
	for (let isFirstTime = true; runIndex >= 0; runIndex -= 1) {
		const runStart = runStartList[runIndex];
		const runEnd = runIndex + 1 < runStartList.length ? runStartList[runIndex + 1] : text.length;
		const offset = isFirstTime ? position - runStart : runEnd - runStart;
		const found = findPreviousWordInRun(text.slice(runStart, runEnd), collectRunBoundaries(boundaryList, runStart, runEnd), offset, isFirstTime);
		if (found >= 0) {
			return runStart + found;
		}
		isFirstTime = false;
	}
	return 0;
}

//==============================================================================
// 글을 최대 길이로 자르기. (UTF-16 단위, 끝이 앞 서로게이트면 하나 더 줄인다, 블링크 text_field_input_type.cc 의 LimitLength)
//==============================================================================
/**
 * @param { string } text 글.
 * @param { number } maxLength 최대 길이. (UTF-16 단위)
 * @returns { string } 자른 글.
 */
function limitTextLength(text, maxLength) {
	let newLength = System.Math.min(maxLength, text.length);
	if (newLength === text.length) {
		return text;
	}
	if (newLength > 0) {
		const lastCodeUnit = text.charCodeAt(newLength - 1);
		if (lastCodeUnit >= 0xD800 && lastCodeUnit <= 0xDBFF) {
			newLength -= 1;
		}
	}
	return text.slice(0, newLength);
}


//==============================================================================
// 이 페이지에 사용자 활성화(누름, 키 입력)가 한 번이라도 있었는지.
// (navigator.userActivation 이 없는 브라우저는 있었던 것으로 본다)
//==============================================================================
function hasStickyUserActivation() {
	const navigator = System.navigator;
	const userActivation = navigator ? navigator.userActivation : undefined;
	if (!userActivation) {
		return true;
	}
	return userActivation.hasBeenActive;
}


//==============================================================================
// 측정용 오프스크린 캔버스 ctx (엔진 미주입 폴백).
//==============================================================================
let offscreenMeasureCanvas = null;
//==============================================================================
// 측정용 오프스크린 2D 컨텍스트 반환. (처음 부를 때 캔버스를 만든다, 못 만들면 null)
//==============================================================================
/**
 * @returns { CanvasRenderingContext2D | null }
 */
function getOffscreenMeasureContext() {
	if (!offscreenMeasureCanvas) {
		try { offscreenMeasureCanvas = System.document.createElement("canvas"); }
		catch (error) { return null; }
	}
	return offscreenMeasureCanvas.getContext("2d");
}


//==============================================================================
// 한 번만 주입되는 글로벌 스타일 (DOM input 의 하이라이트/플레이스홀더 등 차단).
//==============================================================================
const GLOBAL_STYLE_ID = "uiinputfield-hidden-style";
//==============================================================================
// 숨은 입력칸 스타일을 문서에 한 번만 넣기. (같은 id 의 style 이 있으면 넣지 않는다)
//==============================================================================
/**
 * @param { Document } doc 문서.
 */
function ensureGlobalHiddenInputStyle(doc) {
	if (doc.getElementById(GLOBAL_STYLE_ID)) return;
	const style = doc.createElement("style");
	style.id = GLOBAL_STYLE_ID;
	style.textContent = `
input.uiinputfield-hidden::selection { background: transparent; color: transparent; }
input.uiinputfield-hidden::-moz-selection { background: transparent; color: transparent; }
input.uiinputfield-hidden::placeholder { color: transparent; }
input.uiinputfield-hidden::-webkit-input-placeholder { color: transparent; }
input.uiinputfield-hidden:-ms-input-placeholder { color: transparent; }
input.uiinputfield-hidden::-ms-clear { display: none; }
input.uiinputfield-hidden::-ms-reveal { display: none; }
input.uiinputfield-hidden:-webkit-autofill,
input.uiinputfield-hidden:-webkit-autofill:hover,
input.uiinputfield-hidden:-webkit-autofill:focus { -webkit-text-fill-color: transparent !important; transition: background-color 9999s ease-in-out 0s; }
`;
	doc.head.appendChild(style);
}
