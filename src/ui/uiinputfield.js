//==============================================================================
// 포함 모듈 목록.
//==============================================================================
// 옮긴 원문: 크로미엄 third_party/blink/renderer/core/editing/state_machines/backspace_state_machine.cc, third_party/blink/renderer/core/editing/position_units_word.cc 에서 옮김, BSD-3-Clause, THIRD_PARTY_LICENSES.md
const System = globalThis;
import { Vector2 } from "../base/vector2.js";
import { Rect } from "../base/rect.js";
import { Pivot } from "../base/pivot.js";
import { Color } from "../base/color.js";
import { Engine } from "../core/engine.js";
import { WorldNode } from "../core/node/worldnode.js";
import { Component } from "../core/component.js";
import { Paint } from "../core/component/paint.js";
import { UILabel } from "./uilabel.js";
import { buildFontString, getMeasurementCanvasRenderingContext } from "../core/component/text.js";
import { FontAsset } from "../resource/fontasset.js";
import { BlurredRoundRectShadow, cssBlurRadiusToSigma } from "../core/blurshadow.js";


//==============================================================================
// 문맥 메뉴 항목. (잘라내기 / 복사 / 붙여넣기 / 모두 선택, requestMenuAction 이 받는다)
//==============================================================================
export const UIInputFieldMenuAction = {
	cut: "cut", // 잘라내기.
	copy: "copy", // 복사.
	paste: "paste", // 붙여넣기.
	selectAll: "selectAll", // 모두 선택.
};

//==============================================================================
// 되돌리기 묶음 종류. (블링크 TypingCommand 와 붙여넣기, 러스트 판 TextEditKind)
//==============================================================================
const TextEditKind = {
	insertText: "insertText", // 글자 넣기. (열린 묶음이 있으면 종류를 가리지 않고 그 묶음에 붙고, 묶음은 글자 넣기가 된다)
	deleteBackward: "deleteBackward", // 뒤로 지우기. (열린 묶음이 뒤로 지우기일 때만 붙고, 아니면 새 묶음)
	deleteForward: "deleteForward", // 앞으로 지우기. (열린 묶음이 앞으로 지우기일 때만 붙고, 아니면 새 묶음)
	paste: "paste", // 붙여넣기와 잘라내기, 낱말 지우기 키로 고른 것 지우기. (늘 따로 한 묶음이고, 그 뒤 글자 넣기도 새 묶음)
	deleteWordBackward: "deleteWordBackward", // 낱말 뒤로 지우기. (늘 새 묶음이고, 그 뒤 뒤로 지우기와 글자 넣기는 이 묶음에 붙는다)
	deleteWordForward: "deleteWordForward", // 낱말 앞으로 지우기. (늘 새 묶음이고, 그 뒤 앞으로 지우기와 글자 넣기는 이 묶음에 붙는다)
};
/** 되돌리기 깊이. (블링크 undo_stack.cc 의 kMaximumUndoStackDepth) */
const MAXIMUM_UNDO_DEPTH = 1000;
/** 기본 탭 크기. (CSS tab-size 의 처음 값 8) */
const DEFAULT_TAB_SIZE = 8;
/** 여러 줄 필드의 얹는 스크롤 막대 썸 두께. (러스트 판 TEXT_AREA_SCROLLBAR_THICKNESS) */
const TEXT_AREA_SCROLLBAR_THICKNESS = 8;
/** 여러 줄 필드의 썸 가장 짧은 길이. */
const TEXT_AREA_SCROLLBAR_MINIMUM_THUMB_LENGTH = 20;
/** DOM 입력 beforeinput 의 inputType → 되돌리기 묶음 종류. (없는 종류는 붙여넣기처럼 따로 한 묶음) */
const DOM_INPUT_EDIT_KIND_TABLE = {
	insertText: TextEditKind.insertText,
	insertReplacementText: TextEditKind.insertText,
	insertLineBreak: TextEditKind.insertText,
	insertParagraph: TextEditKind.insertText,
	insertCompositionText: TextEditKind.insertText,
	deleteContentBackward: TextEditKind.deleteBackward,
	deleteContentForward: TextEditKind.deleteForward,
	deleteWordBackward: TextEditKind.deleteWordBackward,
	deleteWordForward: TextEditKind.deleteWordForward,
	deleteSoftLineBackward: TextEditKind.deleteWordBackward,
	deleteSoftLineForward: TextEditKind.deleteWordForward,
	deleteHardLineBackward: TextEditKind.deleteWordBackward,
	deleteHardLineForward: TextEditKind.deleteWordForward,
};


//==============================================================================
// 입력 필드 (캔버스 기반).
// - 텍스트 렌더링은 UILabel 자식 노드 두 개로 (값 라벨 + 플레이스홀더 라벨).
// - 클릭/드래그/커서 이동/선택은 모두 캔버스 측에서 직접 처리.
// - DOM <input> 사용 여부는 옵션 (setUseDOMInput, 기본 false). true 일 때만 한글 IME /
//   모바일 소프트 키보드 / 시스템 클립보드가 동작. false 면 ASCII 위주 키보드 직접 처리.
// - 우클릭 시 컨텍스트 메뉴 (잘라내기 / 복사 / 붙여넣기 / 모두 선택). 직접 누름(setUseDirectTouch) 필드도 브라우저 편집 칸 메뉴 대신 같은 메뉴다.
// - 커서 이동과 Delete 는 크롬처럼 글자 묶음 단위, 뒤로 지우기는 블링크 BackspaceStateMachine 처럼 코드 포인트 하나(이모지 묶음은 통째로).
// - DOM 입력은 크롬 입력 칸처럼 마우스로 두 번 누르면 낱말(윈도우는 뒤 공백까지), 세 번 누르면 글 전체를 고른다. (누름 수는 mousedown 의 detail)
// - 캔버스 모드의 낱말 이동과 지우기는 크롬처럼 윈도우와 리눅스는 Ctrl, 맥은 Option 과 왼쪽, 오른쪽 화살표, Backspace, Delete 다. (블링크 NextWordPosition, PreviousWordPosition)
// - 되돌리기와 다시 하기는 두 모드 모두 엔진이 이력을 맡는다. (러스트 판 TextEditBuffer 와 같은 블링크 묶음 규칙: 이어 친 글자는 한 번에, 커서를 옮기거나 선택을 바꾸면 끊긴다,
//   새 편집은 다시 하기 목록을 지운다, setText 는 목록을 비운다) 키는 Ctrl(맥은 Cmd) + Z, Ctrl(맥은 Cmd) + Shift + Z, 윈도우와 리눅스는 Ctrl + Y, 윈도우는 Alt + Backspace 도.
//   DOM 입력은 브라우저의 되돌리기 키와 historyUndo, historyRedo 를 막고 엔진 이력으로 한다. IME 조합 중에는 되돌리지 않는다.
// - setMultiline(true) 면 크롬 textarea 같은 여러 줄 입력이다. (DOM 입력은 숨긴 textarea) 글은 white-space: pre-wrap, overflow-wrap: break-word 처럼
//   줄바꿈 문자와 폭으로 나눈다. 줄 나눔 자리는 크롬 자신의 줄 나누기에서 읽는다. (러스트 판 ui/textarealayout.rs 와 같은 셈)
//   Enter 는 줄을 넣고, 위아래와 page 는 엔진 배치로 옮기고, Home 과 End 는 보이는 줄의 앞과 끝, Ctrl(맥은 Cmd) + Home, End 는 글 앞과 끝이다. 넘치면 커서가 보이게 스크롤한다.
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
	/** @private @type { WorldNode | null } */ #contextMenuNode; // 엔진이 그린 문맥 메뉴 노드. (루트의 마지막 자식, 없으면 null)
	/** @private @type { Function | null } */ #contextMenuMouseDownHandler; // 메뉴 위 mousedown 의 기본 동작(입력 칸 포커스 빼기)을 막는 손잡이.
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

	/** @private @type { object[] } */ #undoList; // 되돌릴 때 돌아갈 값과 선택 목록. ({ value, selectionStart, cursorIndex })
	/** @private @type { object[] } */ #redoList; // 다시 할 때 돌아갈 값과 선택 목록.
	/** @private @type { string | null } */ #openEditKind; // 열린 되돌리기 묶음의 종류. (TextEditKind, null 이면 다음 편집은 새 묶음)
	/** @private @type { object | null } */ #pendingDOMEdit; // DOM 입력의 beforeinput 이 남긴 편집. ({ editKind, snapshot }, input 에서 이력에 쌓는다)
	/** @private @type { object | null } */ #compositionSnapshot; // IME 조합을 시작할 때의 값과 선택. (조합이 값을 바꾸면 글자 넣기 묶음으로 쌓는다)

	/** @private @type { boolean } */ #isMultilineEnabled; // 여러 줄인지. (크롬 textarea 처럼)
	/** @private @type { number | null } */ #lineHeight; // 줄 높이. (null 이면 CSS normal)
	/** @private @type { number } */ #tabSize; // 탭 크기. (공백 몇 개 폭, CSS tab-size)
	/** @private @type { number } */ #scrollTop; // 위로 굴려 넘긴 만큼. (textarea scrollTop)
	/** @private @type { number | null } */ #preferredCaretX; // 위아래 이동이 지키는 가로 자리. (블링크 x_pos_for_vertical_arrow_navigation)
	/** @private @type { boolean } */ #isCaretUpstream; // 폭으로 나뉜 자리의 커서를 앞 줄 끝에 보일지. (블링크의 위쪽 친화)
	/** @private @type { string | null } */ #caretRevealRequest; // 다음 배치에서 커서가 보이게 스크롤할지. ("ifNeeded", "always", null)
	/** @private @type { TextAreaLayout | null } */ #textAreaLayout; // 여러 줄 배치.
	/** @private @type { string | null } */ #textAreaLayoutKey; // 여러 줄 배치의 열쇠. (보인 글, 폰트, 폭, 줄 높이, 탭 크기)
	/** @private @type { object | null } */ #scrollbarDragStart; // 썸을 끄는 중이면 { startY, startScrollTop }. (노드 좌표 y 와 그때 scrollTop)
	/** @private @type { number } */ #textAreaScrollbarGutter; // 클래식 스크롤 막대가 차지한 폭. (여러 줄 필드, 얹는 막대거나 넘치지 않으면 0)
	/** @private @type { Component | null } */ #textAreaWheelReceiver; // 여러 줄일 때만 붙는 휠 받기 컴포넌트. (TextAreaWheelReceiver)

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
		this.#contextMenuNode = null;
		this.#contextMenuMouseDownHandler = null;
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

		this.#undoList = [];
		this.#redoList = [];
		this.#openEditKind = null;
		this.#pendingDOMEdit = null;
		this.#compositionSnapshot = null;

		this.#isMultilineEnabled = false;
		this.#lineHeight = null;
		this.#tabSize = DEFAULT_TAB_SIZE;
		this.#scrollTop = 0;
		this.#preferredCaretX = null;
		this.#isCaretUpstream = false;
		this.#caretRevealRequest = null;
		this.#textAreaLayout = null;
		this.#textAreaLayoutKey = null;
		this.#textAreaWheelReceiver = null;
		this.#textAreaScrollbarGutter = 0;
		this.#scrollbarDragStart = null;

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
	 * @param { Engine } engine 엔진. (DOM 입력의 자리, 캔버스 사건, 문맥 메뉴에 쓴다, 주지 않으면 Engine.getEngine() 을 쓴다)
	 */
	setEngine(engine) { this.#engine = engine; }
	//==============================================================================
	// 쓸 엔진 찾기. (setEngine 으로 준 엔진, 없으면 마지막으로 만든 엔진 Engine.getEngine())
	//==============================================================================
	/**
	 * @returns { Engine | null } 쓸 엔진. (없으면 null)
	 * @private
	 */
	#resolveEngine() {
		if (this.#engine) return this.#engine;
		const engine = Engine.getEngine();
		return engine ? engine : null;
	}
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
	// 그 DOM 입력의 오른쪽 클릭은 브라우저 편집 칸 메뉴 대신 다른 필드와 같은 엔진 문맥 메뉴를 띄운다. (러스트 데스크탑과 같은 항목)
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
	// 여러 줄 설정. (크롬 textarea 처럼, DOM 입력은 숨긴 textarea 를 쓴다, 바꾸면 스크롤을 처음으로)
	// - 여러 줄이면 Enter 가 줄을 넣고(제출 콜백을 부르지 않는다), 글을 폭에 맞춰 나누고, 위아래로 옮기고, 넘치면 스크롤한다.
	// - UI 문서에 적는 원본 필드 속성이 아니다. (러스트 판도 반사에서 뺀다)
	//==============================================================================
	/**
	 * @param { boolean } isMultiline 참이면 여러 줄, 거짓이면 한 줄. (처음 거짓)
	 * @example <caption>여러 줄 메모 칸</caption>
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
	 * 		inputField.setMultiline(true);
	 * 		inputField.setTabSize(4);
	 * 		inputField.setLineHeight(32);
	 * 		inputField.setLocalPosition(Vector2.create(40, 40));
	 * 		inputField.setContentSize(Vector2.create(320, 160));
	 * 		inputField.setPlaceholder("Memo");
	 * 		const root = this.getRoot();
	 * 		root.addChild(inputField);
	 * 		inputField.attach();
	 * 		inputField.setText("first line\nsecond line");
	 * 		console.log(inputField.isMultiline(), inputField.getLineHeight(), inputField.getTabSize());
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
	setMultiline(isMultiline) {
		const isChanged = this.#isMultilineEnabled !== !!isMultiline;
		this.#isMultilineEnabled = !!isMultiline;
		this.#textAreaLayoutKey = null;
		this.#scrollTop = 0;
		this.#preferredCaretX = null;
		this.#isCaretUpstream = false;
		// 휠은 여러 줄일 때만 받는다. (한 줄 필드는 부모 스크롤 칸이 받는다)
		if (this.#isMultilineEnabled && !this.#textAreaWheelReceiver) {
			this.#textAreaWheelReceiver = this.addComponent(TextAreaWheelReceiver);
		}
		else if (!this.#isMultilineEnabled && this.#textAreaWheelReceiver) {
			this.removeComponent(this.#textAreaWheelReceiver);
			this.#textAreaWheelReceiver = null;
		}
		this.refreshTexts();
		// 붙인 DOM 입력은 input 과 textarea 를 바꿔 단다. (포커스를 가졌으면 다시 준다)
		if (isChanged && this.#domInput) {
			const wasFocused = this.#focused;
			this.detachDOMInput();
			this.attachDOMInput();
			if (wasFocused) this.focus();
		}
	}
	//==============================================================================
	// 여러 줄인지.
	//==============================================================================
	/**
	 * @returns { boolean } 여러 줄이면 참.
	 */
	isMultiline() { return this.#isMultilineEnabled; }
	//==============================================================================
	// 줄 높이 설정. (여러 줄 필드, null 이면 CSS normal 이다. 크롬처럼 첫째 글꼴의 위아래 길이와 줄 사이로 셈한다)
	//==============================================================================
	/**
	 * @param { number | null } lineHeight 줄 높이. (내용 크기 단위, null 이면 CSS normal)
	 */
	setLineHeight(lineHeight) {
		this.#lineHeight = (typeof lineHeight === "number" && System.Number.isFinite(lineHeight)) ? lineHeight : null;
		this.#textAreaLayoutKey = null;
	}
	//==============================================================================
	// 줄 높이 반환. (여러 줄 필드)
	//==============================================================================
	/**
	 * @returns { number } 줄 높이. (정하지 않았으면 CSS normal 로 잰 값, 잴 문서가 없으면 글꼴 크기의 1.2 배를 반올림한 값)
	 */
	getLineHeight() {
		if (this.#lineHeight !== null) return this.#lineHeight;
		const normalLineHeight = measureNormalLineHeight(buildFontString(this.#fontFace, this.#fontSize, false, false));
		return normalLineHeight !== null ? normalLineHeight : System.Math.round(this.#fontSize * 1.2);
	}
	//==============================================================================
	// 탭 크기 설정. (여러 줄 필드, 공백 몇 개 폭, CSS tab-size)
	//==============================================================================
	/**
	 * @param { number } tabSize 탭 크기. (공백 몇 개 폭, 음수는 0, 기본 8)
	 */
	setTabSize(tabSize) {
		this.#tabSize = System.Math.max(0, System.Number(tabSize) || 0);
		this.#textAreaLayoutKey = null;
		if (this.#domInput) this.#domInput.style.tabSize = String(this.#tabSize);
	}
	//==============================================================================
	// 탭 크기 반환.
	//==============================================================================
	/**
	 * @returns { number } 탭 크기. (공백 몇 개 폭)
	 */
	getTabSize() { return this.#tabSize; }
	//==============================================================================
	// 위로 굴려 넘긴 만큼 반환. (여러 줄 필드, textarea scrollTop)
	//==============================================================================
	/**
	 * @returns { number } 위로 넘긴 만큼. (내용 크기 단위)
	 */
	getScrollTop() { return this.#scrollTop; }
	//==============================================================================
	// 위로 굴려 넘기기. (여러 줄 필드, 다음 그리기에서 글 끝 안으로 줄인다)
	//==============================================================================
	/**
	 * @param { number } scrollTop 위로 넘길 만큼. (내용 크기 단위, 음수는 0)
	 */
	setScrollTop(scrollTop) { this.#scrollTop = System.Math.max(0, System.Number(scrollTop) || 0); }
	//==============================================================================
	// 되돌릴 것이 있는지.
	//==============================================================================
	/**
	 * @returns { boolean } 되돌릴 묶음이 있으면 참.
	 * @example <caption>이어 친 글자를 한 번에 되돌리기</caption>
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
	 * 		const root = this.getRoot();
	 * 		root.addChild(inputField);
	 * 		inputField.attach();
	 * 		inputField.replaceSelection("a");
	 * 		inputField.replaceSelection("b");
	 * 		console.log(inputField.getText(), inputField.canUndo(), inputField.canRedo());
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
	canUndo() { return this.#undoList.length > 0; }
	//==============================================================================
	// 다시 할 것이 있는지.
	//==============================================================================
	/**
	 * @returns { boolean } 다시 할 묶음이 있으면 참.
	 */
	canRedo() { return this.#redoList.length > 0; }

	//==============================================================================
	// 지금 값과 선택. (되돌리기 이력에 쌓는 꼴)
	//==============================================================================
	/**
	 * @returns { { value: string, selectionStart: number, cursorIndex: number } } 값과 선택.
	 * @private
	 */
	#createSnapshot() {
		return { value: this.#value, selectionStart: this.#selectionStart, cursorIndex: this.#cursorIndex };
	}
	//==============================================================================
	// DOM 입력의 지금 값과 선택. (고정 끝과 움직이는 끝은 selectionDirection 으로 가른다)
	//==============================================================================
	/**
	 * @returns { { value: string, selectionStart: number, cursorIndex: number } } 값과 선택.
	 * @private
	 */
	#createDOMSnapshot() {
		const input = this.#domInput;
		const start = typeof input.selectionStart === "number" ? input.selectionStart : input.value.length;
		const end = typeof input.selectionEnd === "number" ? input.selectionEnd : start;
		const isBackward = input.selectionDirection === "backward";
		return { value: input.value, selectionStart: isBackward ? end : start, cursorIndex: isBackward ? start : end };
	}
	//==============================================================================
	// 편집 시작 알리기. (고치기 전에 부른다, 러스트 판 TextEditBuffer::begin_edit)
	// - 열린 묶음이 있으면 글자 넣기는 종류를 가리지 않고 그 묶음에 붙고, 뒤로(앞으로) 지우기는 같은 지우기 묶음에만 붙는다.
	// - 새 묶음이면 고치기 전 값을 되돌리기 목록에 쌓고 다시 하기 목록을 지운다. 붙여넣기 묶음은 바로 닫는다.
	//==============================================================================
	/**
	 * @param { string } editKind 할 편집의 묶음 종류. (TextEditKind)
	 * @param { object | null } snapshot 쌓을 고치기 전 값과 선택. (null 이면 지금 값과 선택)
	 * @private
	 */
	#beginEdit(editKind, snapshot = null) {
		const openEditKind = this.#openEditKind;
		if (openEditKind !== null && editKind === TextEditKind.insertText) {
			this.#openEditKind = TextEditKind.insertText;
			return;
		}
		if ((openEditKind === TextEditKind.deleteBackward && editKind === TextEditKind.deleteBackward) || (openEditKind === TextEditKind.deleteForward && editKind === TextEditKind.deleteForward)) {
			return;
		}
		this.#undoList.push(snapshot ? snapshot : this.#createSnapshot());
		if (this.#undoList.length > MAXIMUM_UNDO_DEPTH) {
			this.#undoList.shift();
		}
		this.#redoList.length = 0;
		if (editKind === TextEditKind.paste) {
			this.#openEditKind = null;
		}
		else if (editKind === TextEditKind.deleteWordBackward) {
			this.#openEditKind = TextEditKind.deleteBackward;
		}
		else if (editKind === TextEditKind.deleteWordForward) {
			this.#openEditKind = TextEditKind.deleteForward;
		}
		else {
			this.#openEditKind = editKind;
		}
	}
	//==============================================================================
	// 되돌리기나 다시 하기. (조합 중이면 하지 않는다, 했으면 DOM 입력과 맞추고 바뀜 콜백을 부른다)
	//==============================================================================
	/**
	 * @param { boolean } isRedo 참이면 다시 하기, 거짓이면 되돌리기.
	 * @returns { boolean } 했으면 참.
	 * @private
	 */
	#applyEditHistory(isRedo) {
		if (this.#isComposing) return false;
		this.#openEditKind = null;
		const sourceList = isRedo ? this.#redoList : this.#undoList;
		const targetList = isRedo ? this.#undoList : this.#redoList;
		if (sourceList.length === 0) return false;
		const snapshot = sourceList.pop();
		targetList.push(this.#createSnapshot());
		this.#value = snapshot.value;
		this.#selectionStart = snapshot.selectionStart;
		this.#cursorIndex = snapshot.cursorIndex;
		this.#pendingDOMEdit = null;
		if (this.#domInput) {
			this.#domInput.value = this.#value;
			this.#syncDOMSelection();
		}
		this.#preferredCaretX = null;
		this.#isCaretUpstream = false;
		this.#requestCaretReveal("ifNeeded");
		this.#blinkTimer = 0;
		this.#cursorVisible = true;
		this.refreshTexts();
		if (this.#onChangeCallback) this.#onChangeCallback(this.#value);
		return true;
	}
	//==============================================================================
	// DOM 입력의 선택을 엔진 선택에 맞추기. (고정 끝이 뒤면 backward)
	//==============================================================================
	/** @private */
	#syncDOMSelection() {
		if (!this.#domInput) return;
		const start = System.Math.min(this.#selectionStart, this.#cursorIndex);
		const end = System.Math.max(this.#selectionStart, this.#cursorIndex);
		this.#domInput.setSelectionRange(start, end, this.#cursorIndex < this.#selectionStart ? "backward" : "forward");
	}

	//==============================================================================
	// 커서가 보이게 스크롤하기를 부탁. (여러 줄 필드, 다음 배치에서 한다, "always" 가 "ifNeeded" 보다 앞선다)
	//==============================================================================
	/**
	 * @param { string } revealKind "ifNeeded" 면 벗어났을 때만, "always" 면 늘. (블링크 RevealSelection)
	 * @private
	 */
	#requestCaretReveal(revealKind) {
		if (!this.#isMultilineEnabled) return;
		if (this.#caretRevealRequest !== "always") this.#caretRevealRequest = revealKind;
	}
	//==============================================================================
	// 보이는 글의 커서 자리. (조합 중이면 조합 글 뒤)
	//==============================================================================
	/**
	 * @returns { number } 자리. (UTF-16 단위)
	 * @private
	 */
	#getDisplayCursorIndex() { return this.#getCompositionStart() + this.#composition.length; }
	//==============================================================================
	// 조합 글이 들어갈 값의 자리. (조합 중이면 고른 글의 앞, 아니면 커서)
	// - 고른 채 조합하면 DOM 입력은 고른 글을 조합 글로 갈음한다. 보이는 글은 [고른 글 앞, 조합 글, 고른 글 뒤] 다.
	//==============================================================================
	/**
	 * @returns { number } 자리. (UTF-16 단위)
	 * @private
	 */
	#getCompositionStart() { return this.#composition.length > 0 ? System.Math.min(this.#selectionStart, this.#cursorIndex) : this.#cursorIndex; }
	//==============================================================================
	// 조합 글이 갈음할 값의 끝. (조합 중이면 고른 글의 뒤, 아니면 커서)
	//==============================================================================
	/**
	 * @returns { number } 자리. (UTF-16 단위)
	 * @private
	 */
	#getCompositionEnd() { return this.#composition.length > 0 ? System.Math.max(this.#selectionStart, this.#cursorIndex) : this.#cursorIndex; }
	//==============================================================================
	// 여러 줄 배치 맞추기. (보인 글, 폰트, 폭, 줄 높이, 탭 크기가 바뀌었을 때만 다시 짓는다)
	// - 크롬 textarea 는 overflow: auto 라, 클래식 스크롤 막대(윈도우, 리눅스, 맥 클래식 설정)는 넘칠 때 테두리 안쪽의 막대 두께만큼 글 폭을 줄인다.
	//   막대 없이 지어 보고 넘치면 막대 자리를 덜고 다시 짓는다. (러스트 판 ensure_text_area_layout)
	//==============================================================================
	/**
	 * @returns { TextAreaLayout } 줄 배치.
	 * @private
	 */
	#ensureTextAreaLayout() {
		const contentSize = this.getContentSize();
		const metrics = readClassicScrollbarMetrics();
		const scrollbarThickness = metrics ? metrics.thickness : 0;
		// 폭이 좁으면 글이 길어질 뿐이라, 막대를 둬도 넘치지 않으면 막대 없이도 넘치지 않는다. 지난 칸부터 본다.
		let scrollbarGutter = this.#textAreaScrollbarGutter > 0 ? scrollbarThickness : 0;
		let layout = null;
		for (let passIndex = 0; passIndex < 2; ++passIndex) {
			layout = this.#buildTextAreaLayoutWithGutter(contentSize, scrollbarGutter);
			this.#textAreaScrollbarGutter = scrollbarGutter;
			const isOverflowing = layout.getContentHeight() + this.#padding * 2 > contentSize.y + 0.5;
			const wantedGutter = isOverflowing ? scrollbarThickness : 0;
			if (wantedGutter === scrollbarGutter) {
				break;
			}
			scrollbarGutter = wantedGutter;
		}
		return layout;
	}
	//==============================================================================
	// 막대 자리를 던 폭으로 여러 줄 배치 짓기. (열쇠가 같으면 지난 배치)
	// - 글 폭은 그릴 때와 같은 2D 캔버스 measureText 로 잰다. 줄 폭은 내용 폭에서 좌우 여백과 막대 자리를 뺀 것이다.
	//==============================================================================
	/**
	 * @param { Vector2 } contentSize 노드 크기.
	 * @param { number } scrollbarGutter 막대 자리.
	 * @returns { TextAreaLayout } 줄 배치.
	 * @private
	 */
	#buildTextAreaLayoutWithGutter(contentSize, scrollbarGutter) {
		const displayText = this.getDisplayText();
		const fontString = buildFontString(this.#fontFace, this.#fontSize, false, false);
		const wrapWidth = System.Math.max(0, contentSize.x - this.#padding * 2 - scrollbarGutter);
		const lineHeight = this.getLineHeight();
		const layoutKey = `${fontString}\u0000${wrapWidth}\u0000${lineHeight}\u0000${this.#tabSize}\u0000${displayText}`;
		if (this.#textAreaLayout && this.#textAreaLayoutKey === layoutKey) {
			return this.#textAreaLayout;
		}
		const context = this.getMeasureContext();
		const fontSize = this.#fontSize;
		if (context) {
			context.save();
			context.font = fontString;
		}
		const measureWidth = (measuredText) => (context ? context.measureText(measuredText).width : measuredText.length * fontSize * 0.55);
		const tabWidth = measureWidth(" ") * this.#tabSize;
		this.#textAreaLayout = buildTextAreaLayout(displayText, wrapWidth, lineHeight, tabWidth, measureWidth);
		if (context) {
			context.restore();
		}
		this.#textAreaLayoutKey = layoutKey;
		return this.#textAreaLayout;
	}
	//==============================================================================
	// 스크롤할 수 있는 끝. (글 높이 + 위아래 여백 - 노드 높이)
	//==============================================================================
	/**
	 * @param { number } contentHeight 노드 높이.
	 * @returns { number } 끝.
	 * @private
	 */
	#getMaximumScrollTop(contentHeight) {
		const layout = this.#ensureTextAreaLayout();
		return System.Math.max(0, layout.getContentHeight() + this.#padding * 2 - contentHeight);
	}
	//==============================================================================
	// 커서가 보이게 스크롤. (블링크 RevealSelection: 맥이 아니면 ifNeeded 는 가장자리, always 는 맨 위. 맥은 가운데)
	//==============================================================================
	/** @private */
	#applyCaretReveal() {
		const revealKind = this.#caretRevealRequest;
		this.#caretRevealRequest = null;
		if (revealKind === null) return;
		const contentHeight = this.getContentSize().y;
		const layout = this.#ensureTextAreaLayout();
		const caretPosition = layout.getCaretPosition(this.#getDisplayCursorIndex(), this.#isCaretUpstream);
		const caretTop = this.#padding + caretPosition.top;
		const caretBottom = caretTop + layout.lineHeight;
		const isVisible = caretTop >= this.#scrollTop && caretBottom <= this.#scrollTop + contentHeight;
		const isCenterAlign = isMacPlatform();
		if (revealKind === "always") {
			this.#scrollTop = isCenterAlign ? (caretTop + caretBottom - contentHeight) * 0.5 : caretTop;
		}
		else if (isCenterAlign) {
			if (!isVisible) this.#scrollTop = (caretTop + caretBottom - contentHeight) * 0.5;
		}
		else if (caretTop < this.#scrollTop) {
			this.#scrollTop = caretTop;
		}
		else if (caretBottom > this.#scrollTop + contentHeight) {
			this.#scrollTop = caretBottom - contentHeight;
		}
		this.#scrollTop = System.Math.max(0, System.Math.min(this.#getMaximumScrollTop(contentHeight), this.#scrollTop));
	}
	//==============================================================================
	// 위아래로 커서 옮기기. (블링크 MoveUp, MoveDown, MovePageUp, MovePageDown)
	// - 가로 자리는 첫 위아래 이동 때의 커서 x 를 지킨다. 첫 줄 위는 글 앞, 마지막 줄 아래는 글 끝.
	// - page: 보이는 높이의 87.5%(맥은 높이 - 40 과 견줘 큰 쪽) 안의 가장 먼 줄로 옮기고 그 줄을 맨 위로 스크롤한다.
	//==============================================================================
	/**
	 * @param { string } key "ArrowUp", "ArrowDown", "PageUp", "PageDown".
	 * @param { boolean } isShift 참이면 선택을 늘린다.
	 * @private
	 */
	#moveCaretVertically(key, isShift) {
		const layout = this.#ensureTextAreaLayout();
		const cursorIndex = this.#cursorIndex;
		const caretX = layout.getCaretPosition(cursorIndex, this.#isCaretUpstream).x;
		const preferredX = this.#preferredCaretX !== null ? this.#preferredCaretX : caretX;
		let target = null;
		let revealKind = "ifNeeded";
		if (key === "ArrowUp" || key === "ArrowDown") {
			target = layout.moveVertically(cursorIndex, this.#isCaretUpstream, preferredX, key === "ArrowUp" ? -1 : 1);
		}
		else {
			const pageStep = calculatePageStep(this.getContentSize().y);
			const lineCount = System.Math.max(1, System.Math.floor(pageStep / System.Math.max(1, layout.lineHeight)));
			const lineIndex = layout.findLineIndex(cursorIndex, this.#isCaretUpstream);
			const lastLineIndex = System.Math.max(0, layout.lineList.length - 1);
			const targetLine = key === "PageUp" ? System.Math.max(0, lineIndex - lineCount) : System.Math.min(lastLineIndex, lineIndex + lineCount);
			target = layout.findCharacterIndexInLine(targetLine, preferredX);
			revealKind = "always";
		}
		this.moveCursor(target.index, isShift);
		this.#isCaretUpstream = target.isUpstream;
		this.#preferredCaretX = preferredX;
		this.#requestCaretReveal(revealKind);
	}
	//==============================================================================
	// 보이는 줄의 앞이나 끝으로 옮기기. (블링크 MoveToBeginningOfLine, MoveToEndOfLine 의 kLineBoundary)
	//==============================================================================
	/**
	 * @param { boolean } isEnd 참이면 끝, 거짓이면 앞.
	 * @param { boolean } isShift 참이면 선택을 늘린다.
	 * @private
	 */
	#moveCaretToLineBoundary(isEnd, isShift) {
		const layout = this.#ensureTextAreaLayout();
		const lineIndex = layout.findLineIndex(this.#cursorIndex, this.#isCaretUpstream);
		const target = layout.getLineBoundary(lineIndex, isEnd);
		this.moveCursor(target.index, isShift);
		this.#isCaretUpstream = target.isUpstream;
		this.#requestCaretReveal("ifNeeded");
	}
	//==============================================================================
	// 여러 줄 필드에서 노드 자리 → 글자 자리. ({ index, isUpstream })
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 뷰 좌표.
	 * @returns { { index: number, isUpstream: boolean } } 자리와 위쪽 친화.
	 * @private
	 */
	#findTextAreaIndexAt(viewInputPosition) {
		const layout = this.#ensureTextAreaLayout();
		const position = this.getPosition();
		return layout.findCharacterIndexAt(viewInputPosition.x - position.x - this.#padding, viewInputPosition.y - position.y - this.#padding + this.#scrollTop);
	}
	//==============================================================================
	// 휠로 넘기기. (여러 줄 필드, 글 끝 안으로 줄인다, 러스트 판 wheel)
	//==============================================================================
	/**
	 * @param { number } deltaY 휠의 세로 값. (아래가 +)
	 * @returns { boolean } 넘겼으면 참.
	 * @private
	 */
	scrollTextAreaByWheel(deltaY) {
		if (!this.#isMultilineEnabled) return false;
		const previousScrollTop = this.#scrollTop;
		this.#scrollTop = System.Math.max(0, System.Math.min(this.#getMaximumScrollTop(this.getContentSize().y), this.#scrollTop + deltaY));
		return this.#scrollTop !== previousScrollTop;
	}
	//==============================================================================
	// 여러 줄 필드의 스크롤 높이. (글 높이 + 위아래 여백, textarea scrollHeight)
	//==============================================================================
	/**
	 * @returns { Vector2 } 넘겨 볼 내용 크기. (폭은 노드 폭)
	 * @private
	 */
	getTextAreaScrollContentSize() {
		const layout = this.#ensureTextAreaLayout();
		return Vector2.create(this.getContentSize().x, layout.getContentHeight() + this.#padding * 2);
	}
	//==============================================================================
	// 여러 줄 필드의 보이는 줄 범위 목록. (시험과 확인용, 줄마다 { start, end, isHardBreak })
	//==============================================================================
	/**
	 * @returns { { start: number, end: number, isHardBreak: boolean }[] } 줄 범위. (UTF-16 단위)
	 * @private
	 */
	getTextAreaLineRangeList() {
		return this.#ensureTextAreaLayout().lineList.map((line) => ({ start: line.start, end: line.end, isHardBreak: line.isHardBreak }));
	}
	//==============================================================================
	// 여러 줄 그리기. (바탕 층: 선택 → 글. 덮개 층: 조합 밑줄 → 커서 → 썸. 안쪽만 그리게 자른다)
	//==============================================================================
	/**
	 * @param { Graphic } graphic 그래픽.
	 * @param { boolean } isOverlay 참이면 덮개 층, 거짓이면 바탕 층.
	 * @private
	 */
	drawMultilineLayer(graphic, isOverlay) {
		const contentSize = this.getContentSize();
		if (contentSize.x <= 0 || contentSize.y <= 0) return;
		const layout = this.#ensureTextAreaLayout();
		if (!isOverlay) {
			this.#applyCaretReveal();
			this.#scrollTop = System.Math.max(0, System.Math.min(this.#getMaximumScrollTop(contentSize.y), this.#scrollTop));
		}
		const padding = this.#padding;
		const originY = padding - this.#scrollTop;
		const lineHeight = layout.lineHeight;
		graphic.pushState();
		graphic.setFontString(buildFontString(this.#fontFace, this.#fontSize, false, false));
		graphic.beginClipRect(Rect.create(0, 0, contentSize.x, contentSize.y), this.#bgRoundSize);
		if (!isOverlay) {
			// 선택. (조합 중엔 그리지 않는다)
			if (this.#composition.length === 0 && this.hasSelection()) {
				const range = this.getSelectionRange();
				graphic.setFillColor(this.#selectionColor.toHEXString());
				for (const selectionRect of layout.buildSelectionRectList(range.start, range.end)) {
					graphic.drawRect(Rect.create(padding + selectionRect.position.x, originY + selectionRect.position.y, selectionRect.size.x, selectionRect.size.y));
				}
			}
			// 글. (값이나 조합 글이 있으면 줄마다, 없으면 첫 줄에 안내 글, 탭은 탭 자리에서 이어 그린다)
			graphic.setTextAlign("left");
			graphic.setTextBaseline("middle");
			const displayText = this.getDisplayText();
			if (displayText.length > 0) {
				graphic.setFillColor(this.#textColor.toHEXString());
				for (const line of layout.lineList) {
					const lineY = originY + line.top + lineHeight * 0.5;
					if (lineY + lineHeight < 0 || lineY - lineHeight > contentSize.y) continue;
					const lineText = displayText.slice(line.start, line.end);
					let pieceOffset = 0;
					for (const piece of lineText.split("\t")) {
						if (piece.length > 0) {
							graphic.drawFillText(piece, padding + line.offsets[pieceOffset], lineY);
						}
						pieceOffset += piece.length + 1;
					}
				}
			}
			else if (this.#placeholder.length > 0) {
				graphic.setFillColor(this.#placeholderColor.toHEXString());
				graphic.drawFillText(this.#placeholder, padding, originY + lineHeight * 0.5);
			}
		}
		else {
			// 조합 밑줄. (조합 글이 걸친 줄마다)
			const compositionLength = this.#composition.length;
			if (compositionLength > 0) {
				const compositionStart = this.#getCompositionStart();
				const compositionEnd = compositionStart + compositionLength;
				graphic.setStrokeColor(this.#compositionUnderlineColor.toHEXString());
				for (let lineIndex = 0; lineIndex < layout.lineList.length; ++lineIndex) {
					const line = layout.lineList[lineIndex];
					const segmentStart = System.Math.max(compositionStart, line.start);
					const segmentEnd = System.Math.min(compositionEnd, line.end);
					if (segmentStart >= segmentEnd) continue;
					const underlineY = originY + line.top + lineHeight * 0.5 + this.#fontSize * 0.55;
					graphic.drawLine([
						Vector2.create(padding + layout.getXInLine(lineIndex, segmentStart), underlineY),
						Vector2.create(padding + layout.getXInLine(lineIndex, segmentEnd), underlineY),
					], 2);
				}
			}
			// 커서.
			if (this.#focused && this.#cursorVisible) {
				const caretPosition = layout.getCaretPosition(this.#getDisplayCursorIndex(), this.#isCaretUpstream && compositionLength === 0);
				const caretX = padding + caretPosition.x;
				const caretCenterY = originY + caretPosition.top + lineHeight * 0.5;
				const halfHeight = this.#fontSize * 0.6;
				graphic.setStrokeColor(this.#cursorColor.toHEXString());
				graphic.drawLine([Vector2.create(caretX, caretCenterY - halfHeight), Vector2.create(caretX, caretCenterY + halfHeight)], 2);
			}
		}
		graphic.endClipRect();
		// 썸. (넘칠 때)
		if (isOverlay) {
			const thumbRect = this.#calculateTextAreaThumbRect();
			if (thumbRect) {
				graphic.setFillColor(new Color(121 / 255, 121 / 255, 121 / 255, 0.4).toHEXString());
				graphic.drawRect(thumbRect);
			}
		}
		graphic.popState();
	}
	//==============================================================================
	// 여러 줄 필드의 스크롤 막대 썸 자리. (노드 좌표, 넘치지 않으면 null, 러스트 판 calculate_text_area_thumb_rect)
	// - 클래식 막대면 막대 칸 안, 양끝 단추 사이의 크롬 치수 썸이고, 아니면 오른쪽 끝의 얹는 썸이다.
	//==============================================================================
	/**
	 * @returns { Rect | null } 썸 사각형.
	 * @private
	 */
	#calculateTextAreaThumbRect() {
		const contentSize = this.getContentSize();
		const layout = this.#ensureTextAreaLayout();
		const scrollHeight = layout.getContentHeight() + this.#padding * 2;
		if (scrollHeight <= contentSize.y + 0.5 || contentSize.y <= 0) {
			return null;
		}
		if (this.#textAreaScrollbarGutter > 0) {
			const metrics = readClassicScrollbarMetrics();
			const thumbSpan = metrics ? calculateClassicThumbSpan(metrics, contentSize.y, contentSize.y, scrollHeight, this.#scrollTop) : null;
			if (!thumbSpan) {
				return null;
			}
			const trackLeft = contentSize.x - this.#textAreaScrollbarGutter;
			return Rect.create(trackLeft + metrics.thumbCrossOffset, thumbSpan.start + metrics.thumbLengthInset, metrics.thumbThickness, System.Math.max(0, thumbSpan.length - metrics.thumbLengthInset * 2));
		}
		const thumbLength = System.Math.min(contentSize.y, System.Math.max(TEXT_AREA_SCROLLBAR_MINIMUM_THUMB_LENGTH, contentSize.y * contentSize.y / scrollHeight));
		const maximumScrollTop = scrollHeight - contentSize.y;
		const thumbTop = (contentSize.y - thumbLength) * System.Math.max(0, System.Math.min(1, this.#scrollTop / maximumScrollTop));
		return Rect.create(contentSize.x - TEXT_AREA_SCROLLBAR_THICKNESS, thumbTop, TEXT_AREA_SCROLLBAR_THICKNESS, thumbLength);
	}
	//==============================================================================
	// 썸 끌기. (썸을 옮긴 만큼을 글 높이의 비로 넘긴다, 러스트 판 touch_move 의 scrollbar_drag_start 갈래)
	//==============================================================================
	/**
	 * @param { number } localY 지금 노드 좌표 y.
	 * @private
	 */
	#dragTextAreaThumb(localY) {
		const contentSize = this.getContentSize();
		const layout = this.#ensureTextAreaLayout();
		const scrollHeight = layout.getContentHeight() + this.#padding * 2;
		const metrics = this.#textAreaScrollbarGutter > 0 ? readClassicScrollbarMetrics() : null;
		let trackRoom = 1;
		if (metrics) {
			const thumbRoom = System.Math.max(1, contentSize.y - metrics.buttonLength * 2);
			const thumbLength = System.Math.min(thumbRoom, System.Math.max(metrics.thumbMinimumLength, System.Math.round(thumbRoom * contentSize.y / System.Math.max(1, scrollHeight))));
			trackRoom = System.Math.max(1, thumbRoom - thumbLength);
		}
		else {
			const thumbLength = System.Math.min(contentSize.y, System.Math.max(TEXT_AREA_SCROLLBAR_MINIMUM_THUMB_LENGTH, contentSize.y * contentSize.y / System.Math.max(1, scrollHeight)));
			trackRoom = System.Math.max(1, contentSize.y - thumbLength);
		}
		const maximumScrollTop = this.#getMaximumScrollTop(contentSize.y);
		const dragStart = this.#scrollbarDragStart;
		this.#scrollTop = System.Math.max(0, System.Math.min(maximumScrollTop, dragStart.startScrollTop + (localY - dragStart.startY) / trackRoom * maximumScrollTop));
	}

	//==============================================================================
	// 값 설정. (최대 길이를 넘으면 서로게이트 쌍을 쪼개지 않는 데까지 자르고 커서를 끝에 둔다, 바뀜 콜백은 부르지 않는다, 되돌리기와 다시 하기 목록과 조합 중인 글을 비운다)
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
		// 코드로 넣은 값은 되돌리기와 다시 하기 목록을 비운다. (DOM 입력의 value 를 넣을 때 브라우저가 하는 것과 같다)
		this.#undoList.length = 0;
		this.#redoList.length = 0;
		this.#openEditKind = null;
		this.#pendingDOMEdit = null;
		this.#preferredCaretX = null;
		this.#isCaretUpstream = false;
		// 조합 중이었으면 조합을 버린다. (조합 글은 바꾸기 전 값에 끼운 것이다, 남겨 두면 확정이 오지 않을 때 조합 상태에 갇혀 되돌리기와 선택 맞추기가 멈춘다)
		this.#isComposing = false;
		this.#composition = "";
		this.#compositionSnapshot = null;
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
	 * @param { Color | string } color 값 글자의 색. (기본 #222222)
	 */
	setTextColor(color) {
		color = Color.from(color);
		this.#textColor = color;
		this.#textUILabel.setTextColor(color);
	}
	//==============================================================================
	// 플레이스홀더 색 설정.
	//==============================================================================
	/**
	 * @param { Color | string } color 플레이스홀더 글자의 색. (기본 #999999)
	 */
	setPlaceholderColor(color) {
		color = Color.from(color);
		this.#placeholderColor = color;
		this.#placeholderUILabel.setTextColor(color);
	}
	//==============================================================================
	// 커서 색 설정. (조합 중 밑줄 색도 함께 바꾼다)
	//==============================================================================
	/**
	 * @param { Color | string } color 커서와 조합 밑줄의 색. (기본 #5b8def)
	 */
	setCursorColor(color) {
		color = Color.from(color);
		this.#cursorColor = color;
		this.#compositionUnderlineColor = color;
	}
	//==============================================================================
	// 포커스 테두리 색 설정.
	//==============================================================================
	/**
	 * @param { Color | string } color 포커스 테두리 색. (기본 #f97316)
	 */
	setFocusBorderColor(color) { this.#focusBorderColor = Color.from(color); }
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
	 * @param { Color | string } color 선택 영역을 칠할 색. (기본 알파 0.35 의 파랑)
	 */
	setSelectionColor(color) { this.#selectionColor = Color.from(color); }

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
	// 보이는 글 반환. (값의 커서 자리에 조합 글을 끼운 것, 고른 채 조합하면 고른 글 자리를 조합 글로 갈음한 것)
	//==============================================================================
	/**
	 * @returns { string } 보이는 글. (조합 중이 아니면 값 그대로)
	 */
	getDisplayText() {
		const before = this.#value.slice(0, this.#getCompositionStart());
		const after = this.#value.slice(this.#getCompositionEnd());
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
	 * @returns { object } 그릴 때 쓸 상태를 담은 새 객체. ({ value, composition, compositionStart, cursorIndex, selectionStart, focused, cursorVisible, fontSize, fontFace, padding, cursorColor, compositionUnderlineColor, focusBorderColor, focusBorderWidth, selectionColor, bgRoundSize })
	 * @private
	 */
	getRenderState() {
		return {
			value: this.#value,
			composition: this.#composition,
			compositionStart: this.#getCompositionStart(),
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
		this.#openEditKind = null;
		this.#preferredCaretX = null;
		this.#isCaretUpstream = false;
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
						const isBackward = this.#domInput.selectionDirection === "backward";
						this.#cursorIndex = isBackward ? selStart : selEnd;
						this.#selectionStart = isBackward ? selEnd : selStart;
						this.#openEditKind = null;
						this.#preferredCaretX = null;
						this.#isCaretUpstream = false;
						this.#requestCaretReveal("ifNeeded");
						this.#blinkTimer = 0;
						this.#cursorVisible = true;
					}
				}
			}
		}
		// 여러 줄: 커서가 보이게 스크롤. (그리기 전에도 스크롤 자리가 맞게 tick 에서 한다)
		if (this.#isMultilineEnabled && this.#caretRevealRequest !== null) {
			this.#applyCaretReveal();
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
		this.#scrollbarDragStart = null;
		if (this.#isMultilineEnabled) {
			// 썸을 누르면 끌어 스크롤한다. (선택은 그대로)
			const thumbRect = this.#calculateTextAreaThumbRect();
			const localPosition = Vector2.create(viewInputPosition.x - this.getPosition().x, viewInputPosition.y - this.getPosition().y);
			if (thumbRect && localPosition.x >= thumbRect.position.x && localPosition.y >= thumbRect.position.y && localPosition.y <= thumbRect.position.y + thumbRect.size.y) {
				this.#scrollbarDragStart = { startY: localPosition.y, startScrollTop: this.#scrollTop };
				return;
			}
		}
		let index = 0;
		this.#openEditKind = null;
		this.#preferredCaretX = null;
		this.#isCaretUpstream = false;
		if (this.#isMultilineEnabled) {
			const target = this.#findTextAreaIndexAt(viewInputPosition);
			index = target.index;
			this.#isCaretUpstream = target.isUpstream;
		}
		else {
			const localX = viewInputPosition.x - this.getPosition().x;
			index = this.measureIndexAtLocalX(localX);
		}
		this.#dragStartIndex = index;
		this.#cursorIndex = index;
		this.#selectionStart = index;
		this.#dragGranularity = null;
		// DOM 입력은 크롬 입력 칸처럼 두 번 누르면 낱말(윈도우는 뒤 공백까지), 세 번 누르면 글 전체(한 줄의 문단)를 고른다. (블링크 SelectionController)
		const clickCount = this.#domInput ? this.#pointerClickCount : 1;
		if (clickCount >= 2) {
			const range = clickCount === 2 ? findWordRangeAt(this.#value, index) : findParagraphRangeAt(this.#value, index);
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
		this.#requestCaretReveal("ifNeeded");
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
		if (this.#scrollbarDragStart) {
			this.#dragTextAreaThumb(viewInputPosition.y - this.getPosition().y);
			return;
		}
		if (this.#dragStartIndex < 0) return;
		let index = 0;
		if (this.#isMultilineEnabled) {
			const target = this.#findTextAreaIndexAt(viewInputPosition);
			index = target.index;
			this.#isCaretUpstream = target.isUpstream;
		}
		else {
			const localX = viewInputPosition.x - this.getPosition().x;
			index = this.measureIndexAtLocalX(localX);
		}
		// 앵커 = 처음 누른 지점, 커서 = 지금 마우스 위치. (좌/우 어느 쪽으로 드래그해도
		// 커서가 마우스를 따라간다.) DOM API 는 start ≤ end 를 요구하므로 변환.
		this.#selectionStart = this.#dragStartIndex;
		this.#cursorIndex = index;
		// 두 번, 세 번 누른 뒤 끌기는 블링크 ExtendSelectionAsDirectional 처럼 처음 범위를 지키고 끄는 자리의 낱말(문단) 끝까지 넓힌다.
		const dragGranularity = this.#dragGranularity;
		if (dragGranularity) {
			const unitRange = dragGranularity.granularity === "word" ? findWordRangeAt(this.#value, index) : findParagraphRangeAt(this.#value, index);
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
		this.#requestCaretReveal("ifNeeded");
		this.#blinkTimer = 0;
		this.#cursorVisible = true;
	}
	//==============================================================================
	// 터치 뗌. (끌어 선택하기를 끝낸다)
	//==============================================================================
	touchRelease() {
		this.#dragStartIndex = -1;
		this.#scrollbarDragStart = null;
	}
	//==============================================================================
	// 터치 취소. (끌어 선택하기를 끝낸다)
	//==============================================================================
	touchCancel() {
		this.#dragStartIndex = -1;
		this.#scrollbarDragStart = null;
	}

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
	 * @private
	 */
	getMeasureContext() {
		return getOffscreenMeasureContext();
	}

	//==============================================================================
	// 라벨(UILabel) 갱신.
	// - 값이 비어있으면 textText 숨김 + placeholder 표시.
	// - 조합 중이면 (value + composition) 을 textText 에 합성 표시.
	//==============================================================================
	/** @private */
	refreshTexts() {
		// 여러 줄은 줄 배치대로 필드가 직접 그린다. (drawMultilineLayer)
		if (this.#isMultilineEnabled) {
			this.#placeholderTextNode.setActive(false);
			this.#textTextNode.setActive(false);
			return;
		}
		const hasValue = this.#value.length > 0 || this.#composition.length > 0;
		this.#placeholderTextNode.setActive(!hasValue);
		this.#textTextNode.setActive(hasValue);
		if (hasValue) {
			this.#textUILabel.setText(this.getDisplayText());
		}
		this.#placeholderUILabel.setText(this.#placeholder);
	}

	//==============================================================================
	// 라벨과 오버레이 노드의 자리, 크기 맞추기. (내용 크기가 0 이면 하지 않는다)
	//==============================================================================
	/** @private */
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
	/** @private */
	attachDOMInput() {
		if (this.#domInput) return;
		const doc = System.document;
		ensureGlobalHiddenInputStyle(doc);

		// 여러 줄은 숨긴 textarea 다. (크롬 textarea 의 조합, 줄바꿈 넣기)
		const input = doc.createElement(this.#isMultilineEnabled ? "textarea" : "input");
		if (!this.#isMultilineEnabled) input.type = "text";
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
		if (this.#isMultilineEnabled) {
			style.resize = "none";
			style.overflow = "hidden";
			style.whiteSpace = "pre-wrap";
			style.tabSize = String(this.#tabSize);
		}

		input.addEventListener("focus", () => this.handleFocus());
		input.addEventListener("blur", () => this.handleBlur());
		input.addEventListener("beforeinput", (event) => this.handleDOMBeforeInputEvent(event));
		input.addEventListener("input", (event) => this.handleDOMInputEvent(event));
		input.addEventListener("compositionstart", () => this.handleDOMCompositionStartEvent());
		input.addEventListener("compositionupdate", (event) => {
			this.#composition = (event && event.data) ? event.data : "";
			this.refreshTexts();
		});
		input.addEventListener("compositionend", () => {
			this.#isComposing = false;
			this.#composition = "";
			if (this.#compositionSnapshot) {
				this.#pendingDOMEdit = { editKind: TextEditKind.insertText, snapshot: this.#compositionSnapshot };
				this.#compositionSnapshot = null;
			}
			this.handleDOMInputEvent();
		});
		input.addEventListener("keydown", (event) => this.handleDOMKeydownEvent(event));
		// 직접 누름이면 오른쪽 클릭이 이 DOM 입력에 온다. 브라우저 편집 칸 메뉴를 막고 캔버스 누름과 같은 엔진 문맥 메뉴를 띄운다.
		input.addEventListener("contextmenu", (event) => this.handleDOMInputContextMenuEvent(event));

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
	/** @private */
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
	/** @private */
	attachCanvasFocusHandler() {
		if (this.#canvasFocusHandler) return;
		const engine = this.#resolveEngine();
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
			// 문맥 메뉴 위는 밖으로 치지 않는다. (러스트 판 blur_on_outside_press 와 같다)
			if (!isInside && this.#isViewPositionInsideContextMenu(viewInputPosition)) {
				return;
			}
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
	/** @private */
	detachCanvasFocusHandler() {
		if (!this.#canvasFocusHandler) return;
		const engine = this.#resolveEngine();
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
	/** @private */
	layoutDOMInput() {
		if (!this.#domInput || !this.#resolveEngine()) return;
		const viewManager = this.#resolveEngine().getViewManager();
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
	// - 브라우저 되돌리기가 beforeinput 없이 바로 돌았으면(크롬은 되돌릴 것이 남지 않은 묶음에서 그렇다) DOM 을 엔진 값으로 되돌리고 엔진 이력으로 한다.
	//==============================================================================
	/**
	 * @param { InputEvent } event input 사건. (조합을 끝낼 때처럼 사건 없이 부르면 inputType 을 보지 않는다)
	 * @private
	 */
	handleDOMInputEvent(event) {
		if (!this.#domInput) return;
		const inputType = event ? event.inputType : "";
		if (inputType === "historyUndo" || inputType === "historyRedo") {
			this.#pendingDOMEdit = null;
			this.#domInput.value = this.#value;
			this.#syncDOMSelection();
			if (!this.#isComposing) this.#applyEditHistory(inputType === "historyRedo");
			return;
		}
		if (this.#isComposing) return;
		const next = this.#domInput.value;
		const pendingDOMEdit = this.#pendingDOMEdit;
		this.#pendingDOMEdit = null;
		if (next === this.#value) return;
		// 되돌리기 이력. (beforeinput 이 남긴 종류와 고치기 전 값, 없으면 엔진 값으로 따로 한 묶음)
		if (pendingDOMEdit) {
			this.#beginEdit(pendingDOMEdit.editKind, pendingDOMEdit.snapshot);
		}
		else {
			this.#beginEdit(TextEditKind.paste);
		}
		this.#value = next;
		const sel = this.#domInput.selectionEnd;
		this.#cursorIndex = (typeof sel === "number") ? sel : this.#value.length;
		this.#selectionStart = this.#cursorIndex;
		this.#preferredCaretX = null;
		this.#isCaretUpstream = false;
		this.#requestCaretReveal("ifNeeded");
		this.#blinkTimer = 0;
		this.#cursorVisible = true;
		this.refreshTexts();
		if (this.#onChangeCallback) this.#onChangeCallback(this.#value);
	}


	//==============================================================================
	// DOM 입력의 compositionstart. (조합을 시작할 때의 값과 선택을 남기고, 엔진 선택을 DOM 선택에 맞춘다)
	// - 조합이 값을 바꾸면 compositionend 가 이 값으로 글자 넣기 묶음을 쌓는다.
	// - DOM 선택이 엔진 선택과 다르면(틱이 맞추기 전에 키로 옮기거나 골랐으면) 엔진 선택을 맞추고 묶음을 끊는다. (beforeinput 과 같다)
	//   맞추지 않으면 확정 글이 앞 치기 묶음에 붙어 되돌리기가 바꾸기 전 값을 건너뛰고, 조합 중 보이는 글이 옛 커서 자리에 끼인다.
	//==============================================================================
	/**
	 * @private
	 */
	handleDOMCompositionStartEvent() {
		const snapshot = this.#createDOMSnapshot();
		this.#compositionSnapshot = snapshot;
		this.#isComposing = true;
		const domStart = System.Math.min(snapshot.selectionStart, snapshot.cursorIndex);
		const domEnd = System.Math.max(snapshot.selectionStart, snapshot.cursorIndex);
		const engineStart = System.Math.min(this.#selectionStart, this.#cursorIndex);
		const engineEnd = System.Math.max(this.#selectionStart, this.#cursorIndex);
		if (domStart !== engineStart || domEnd !== engineEnd) {
			this.#selectionStart = snapshot.selectionStart;
			this.#cursorIndex = snapshot.cursorIndex;
			this.#openEditKind = null;
			this.#preferredCaretX = null;
			this.#isCaretUpstream = false;
		}
	}
	//==============================================================================
	// DOM 입력의 beforeinput. (브라우저 되돌리기를 막고 엔진 이력으로 하고, 편집이면 묶음 종류와 고치기 전 값을 남긴다)
	// - historyUndo, historyRedo 는 막고 엔진 이력으로 한다. (조합 중이면 막기만 한다)
	// - 조합 중의 insertCompositionText 는 남기지 않는다. (compositionend 가 조합 전 값으로 남긴다)
	// - DOM 선택이 엔진 선택과 다르면(그 사이 키로 옮겼으면) 묶음을 끊는다.
	//==============================================================================
	/**
	 * @param { InputEvent } event beforeinput 사건.
	 * @private
	 */
	handleDOMBeforeInputEvent(event) {
		const inputType = event.inputType;
		if (inputType === "historyUndo" || inputType === "historyRedo") {
			event.preventDefault();
			if (!this.#isComposing && !event.isComposing) this.#applyEditHistory(inputType === "historyRedo");
			return;
		}
		if (this.#isComposing || event.isComposing || !this.#domInput) return;
		const snapshot = this.#createDOMSnapshot();
		const domStart = System.Math.min(snapshot.selectionStart, snapshot.cursorIndex);
		const domEnd = System.Math.max(snapshot.selectionStart, snapshot.cursorIndex);
		const engineStart = System.Math.min(this.#selectionStart, this.#cursorIndex);
		const engineEnd = System.Math.max(this.#selectionStart, this.#cursorIndex);
		if (domStart !== engineStart || domEnd !== engineEnd) this.#openEditKind = null;
		const editKind = DOM_INPUT_EDIT_KIND_TABLE[inputType];
		this.#pendingDOMEdit = { editKind: editKind ? editKind : TextEditKind.paste, snapshot };
	}
	//==============================================================================
	// DOM 입력의 keydown. (되돌리기 키, Enter, 여러 줄의 보이는 줄 이동 키)
	// - 되돌리기, 다시 하기 키는 브라우저 되돌리기를 막고 엔진 이력으로 한다. (조합 중이면 브라우저에 맡긴다)
	// - Enter 는 한 줄이면 막고 제출 콜백을 부르고, 여러 줄이면 textarea 가 줄을 넣는다.
	// - 여러 줄의 위아래, page, Home, End 는 엔진 배치(캔버스에 그린 줄)로 옮긴다. (숨긴 textarea 의 줄과 다르다)
	//==============================================================================
	/**
	 * @param { KeyboardEvent } event keydown 사건.
	 * @private
	 */
	handleDOMKeydownEvent(event) {
		if (event.isComposing || this.#isComposing) return;
		const historyCommand = findHistoryCommand(event);
		if (historyCommand) {
			event.preventDefault();
			this.#applyEditHistory(historyCommand === "redo");
			return;
		}
		if (event.key === "Enter") {
			if (this.#isMultilineEnabled) return;
			event.preventDefault();
			if (this.#onSubmitCallback) this.#onSubmitCallback(this.#value);
			return;
		}
		if (!this.#isMultilineEnabled) return;
		// 엔진 선택을 DOM 선택에 맞춘 뒤 옮긴다. (그 사이 브라우저가 옮긴 것)
		const snapshot = this.#createDOMSnapshot();
		if (snapshot.selectionStart !== this.#selectionStart || snapshot.cursorIndex !== this.#cursorIndex) {
			this.#selectionStart = snapshot.selectionStart;
			this.#cursorIndex = snapshot.cursorIndex;
			this.#preferredCaretX = null;
			this.#isCaretUpstream = false;
		}
		if (this.#handleMultilineNavigationKey(event)) {
			event.preventDefault();
			this.#blinkTimer = 0;
			this.#cursorVisible = true;
		}
	}
	//==============================================================================
	// 여러 줄의 보이는 줄 이동 키. (엔진 배치로 옮긴다, 한 키를 했으면 참, 러스트 판 handle_edit_key 의 여러 줄 갈래와 같다)
	// - 위아래는 첫 위아래 이동의 가로 자리를 지킨다. PageUp, PageDown 은 한 화면 안의 가장 먼 줄로 옮긴다. (맥은 Option 과 함께, 혼자면 커서를 두고 한 화면 넘긴다)
	// - Home, End 는 보이는 줄의 앞과 끝이다. (맥은 Cmd + 왼쪽, 오른쪽. 맥 Home, End 는 크롬 맥처럼 커서를 두고 처음과 끝으로 넘기고, 넘길 것이 없으면 줄 앞과 끝, Shift 와 함께면 글 앞과 끝까지 고른다)
	// - 글 앞과 끝은 Ctrl + Home, End, 맥은 Cmd + 위, 아래다.
	//==============================================================================
	/**
	 * @param { KeyboardEvent } event keydown 사건.
	 * @returns { boolean } 한 키면 참.
	 * @private
	 */
	#handleMultilineNavigationKey(event) {
		const key = event.key;
		const isMac = isMacPlatform();
		const isShift = event.shiftKey;
		const isVerticalKey = key === "ArrowUp" || key === "ArrowDown" || key === "PageUp" || key === "PageDown";
		const isScrollKey = isMac && !event.altKey && !event.metaKey && !event.ctrlKey && (key === "Home" || key === "End" || key === "PageUp" || key === "PageDown");
		if (!isVerticalKey && !isScrollKey) {
			this.#preferredCaretX = null;
			this.#isCaretUpstream = false;
		}
		const isDocumentStartKey = isMac ? (event.metaKey && key === "ArrowUp") : (event.ctrlKey && key === "Home");
		const isDocumentEndKey = isMac ? (event.metaKey && key === "ArrowDown") : (event.ctrlKey && key === "End");
		if (isDocumentStartKey || isDocumentEndKey) {
			this.#preferredCaretX = null;
			this.#isCaretUpstream = false;
			this.moveCursor(isDocumentStartKey ? 0 : this.#value.length, isShift);
			return true;
		}
		if (isMac && event.metaKey && !event.ctrlKey && !event.altKey && (key === "ArrowLeft" || key === "ArrowRight")) {
			this.#moveCaretToLineBoundary(key === "ArrowRight", isShift);
			return true;
		}
		if (event.metaKey || event.ctrlKey) {
			return false;
		}
		if ((key === "ArrowUp" || key === "ArrowDown") && !event.altKey) {
			this.#moveCaretVertically(key, isShift);
			return true;
		}
		if (key === "PageUp" || key === "PageDown") {
			if (isMac && !event.altKey) {
				// 맥 PageUp, PageDown: 커서를 두고 한 화면만큼 넘긴다. (cc ScrollUtils::CalculatePageStep)
				const contentHeight = this.getContentSize().y;
				const direction = key === "PageUp" ? -1 : 1;
				this.#scrollTop = System.Math.max(0, System.Math.min(this.#getMaximumScrollTop(contentHeight), this.#scrollTop + calculatePageStep(contentHeight) * direction));
				return true;
			}
			if (isMac === event.altKey) {
				this.#moveCaretVertically(key, isShift);
				return true;
			}
			return false;
		}
		if ((key === "Home" || key === "End") && !event.altKey) {
			const isEnd = key === "End";
			if (isMac) {
				// 맥 Home, End: 넘길 것이 있으면 커서를 두고 처음과 끝으로 넘긴다. 없으면 줄 앞과 끝, Shift 와 함께면 글 앞과 끝까지 고른다.
				if (!isShift) {
					const contentHeight = this.getContentSize().y;
					const targetScrollTop = isEnd ? this.#getMaximumScrollTop(contentHeight) : 0;
					if (System.Math.abs(targetScrollTop - this.#scrollTop) > 0) {
						this.#scrollTop = targetScrollTop;
						return true;
					}
				}
				this.#preferredCaretX = null;
				this.#isCaretUpstream = false;
				if (isShift) {
					this.moveCursor(isEnd ? this.#value.length : 0, true);
					return true;
				}
			}
			this.#moveCaretToLineBoundary(isEnd, isShift);
			return true;
		}
		return false;
	}

	//==============================================================================
	// 캔버스 모드 키보드 (DOM input 미사용 시).
	//==============================================================================
	/** @private */
	attachCanvasKeyboard() {
		if (this.#canvasKeydownHandler) return;
		this.#canvasKeydownHandler = (event) => this.handleCanvasKeydown(event);
		System.document.addEventListener("keydown", this.#canvasKeydownHandler);
	}
	//==============================================================================
	// 캔버스 모드 키보드 사건 떼기.
	//==============================================================================
	/** @private */
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
		const historyCommand = findHistoryCommand(event);
		if (historyCommand) {
			event.preventDefault();
			this.#applyEditHistory(historyCommand === "redo");
			this.#blinkTimer = 0;
			this.#cursorVisible = true;
			return;
		}
		if (this.#isMultilineEnabled && this.#handleMultilineNavigationKey(event)) {
			event.preventDefault();
			this.#blinkTimer = 0;
			this.#cursorVisible = true;
			return;
		}
		this.#preferredCaretX = null;
		this.#isCaretUpstream = false;
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
				this.#replaceSelectionWithEdit("", TextEditKind.deleteBackward);
			}
			else if (this.#cursorIndex > 0) {
				const deletionStart = findBackwardDeletionBoundary(this.#value, this.#cursorIndex);
				this.deleteRange(deletionStart, this.#cursorIndex, TextEditKind.deleteBackward);
			}
		}
		else if (event.key === "Delete") {
			event.preventDefault();
			if (this.hasSelection()) {
				this.#replaceSelectionWithEdit("", TextEditKind.deleteForward);
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
			if (this.#isMultilineEnabled) {
				// 줄 넣기. (블링크 InsertNewline, 글자 넣기 묶음에 붙는다)
				this.#replaceSelectionWithEdit("\n", TextEditKind.insertText);
			}
			else if (this.#onSubmitCallback) {
				this.#onSubmitCallback(this.#value);
			}
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
			// 고른 것 지우기는 따로 한 되돌리기 묶음이다. (블링크 DeleteSelectionCommand)
			this.#replaceSelectionWithEdit("", TextEditKind.paste);
			return;
		}
		if (command === "deleteWordForward") {
			let endIndex = findNextWordPosition(value, cursorIndex, isWindowsPlatform());
			if (endIndex === cursorIndex) {
				endIndex = findNextGraphemeBoundary(value, cursorIndex);
			}
			this.deleteRange(cursorIndex, endIndex, TextEditKind.deleteWordForward);
		}
		else {
			let startIndex = findPreviousWordPosition(value, cursorIndex);
			if (startIndex === cursorIndex) {
				startIndex = findPreviousGraphemeBoundary(value, cursorIndex);
			}
			this.deleteRange(startIndex, cursorIndex, TextEditKind.deleteWordBackward);
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
		// 커서를 옮기면 되돌리기 묶음이 끊긴다. (블링크: 선택이 바뀌면 열린 TypingCommand 를 닫는다)
		this.#openEditKind = null;
		this.#requestCaretReveal("ifNeeded");
		if (this.#domInput) this.#syncDOMSelection();
		this.refreshTexts();
	}
	//==============================================================================
	// 한 글자 지우기. (그 자리부터 글자 묶음 하나, 크롬 Delete 키처럼 이모지나 결합 부호를 쪼개지 않는다, 바뀜 콜백을 부른다)
	//==============================================================================
	/**
	 * @param { number } index 지울 글자의 자리. (UTF-16 단위)
	 * @private
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
	 * @param { string } editKind 되돌리기 묶음 종류. (TextEditKind, 주지 않으면 앞으로 지우기)
	 * @private
	 */
	deleteRange(startIndex, endIndex, editKind = TextEditKind.deleteForward) {
		const start = System.Math.max(0, startIndex);
		const end = System.Math.min(this.#value.length, endIndex);
		if (end <= start) {
			return;
		}
		this.#beginEdit(editKind);
		this.#value = this.#value.slice(0, start) + this.#value.slice(end);
		if (this.#cursorIndex >= end) {
			this.#cursorIndex -= end - start;
		}
		else if (this.#cursorIndex > start) {
			this.#cursorIndex = start;
		}
		this.#selectionStart = this.#cursorIndex;
		this.#preferredCaretX = null;
		this.#isCaretUpstream = false;
		this.#requestCaretReveal("ifNeeded");
		this.refreshTexts();
		if (this.#onChangeCallback) {
			this.#onChangeCallback(this.#value);
		}
	}

	//==============================================================================
	// 포커스 / 블러 핸들러 (DOM/캔버스 모드 공용).
	//==============================================================================
	/** @private */
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
	/** @private */
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
	 * @param { string } text 넣을 글. (빈 글이면 선택을 지운다, 글자 넣기 되돌리기 묶음이다)
	 */
	replaceSelection(text) {
		this.#replaceSelectionWithEdit(text, TextEditKind.insertText);
	}
	//==============================================================================
	// 선택을 글로 바꾸기. (되돌리기 묶음 종류와 함께, 여러 줄은 넣는 글의 CR 과 CRLF 를 LF 로 바꾼다)
	//==============================================================================
	/**
	 * @param { string } text 넣을 글.
	 * @param { string } editKind 되돌리기 묶음 종류. (TextEditKind)
	 * @private
	 */
	#replaceSelectionWithEdit(text, editKind) {
		const sanitizedText = this.#isMultilineEnabled ? String(text).replace(/\r\n?/g, "\n") : String(text);
		const range = this.getSelectionRange() || { start: this.#cursorIndex, end: this.#cursorIndex };
		this.#beginEdit(editKind);
		text = sanitizedText;
		let insertedText = text;
		if (this.#maxLength > 0) {
			const appendableLength = System.Math.max(0, this.#maxLength - (this.#value.length - (range.end - range.start)));
			insertedText = limitTextLength(text, appendableLength);
		}
		const next = this.#value.slice(0, range.start) + insertedText + this.#value.slice(range.end);
		this.#value = next;
		this.#cursorIndex = System.Math.min(range.start + insertedText.length, next.length);
		this.#selectionStart = this.#cursorIndex;
		this.#pendingDOMEdit = null;
		if (this.#domInput) {
			this.#domInput.value = this.#value;
			this.#domInput.setSelectionRange(this.#cursorIndex, this.#cursorIndex);
		}
		this.#preferredCaretX = null;
		this.#isCaretUpstream = false;
		this.#requestCaretReveal("ifNeeded");
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
		this.#replaceSelectionWithEdit("", TextEditKind.paste);
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
				this.#replaceSelectionWithEdit(text, TextEditKind.paste);
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
	 * @private
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
			case UIInputFieldMenuAction.selectAll: {
				this.selectAll();
				break;
			}
		}
	}
	//==============================================================================
	// 클립보드에 쓰기. (navigator.clipboard 가 없거나 막히면 무시한다)
	//==============================================================================
	/**
	 * @param { string } text 쓸 글.
	 * @private
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
	 * @private
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
	/** @private */
	attachContextMenuHandler() {
		if (!this.#resolveEngine() || this.#contextMenuHandler) return;
		const canvas = this.#resolveEngine().getViewManager().getCanvas();
		if (!canvas) return;
		this.#contextMenuHandler = (event) => this.handleContextMenuEvent(event);
		canvas.addEventListener("contextmenu", this.#contextMenuHandler);
	}
	//==============================================================================
	// 캔버스의 contextmenu 사건 떼기.
	//==============================================================================
	/** @private */
	detachContextMenuHandler() {
		if (!this.#contextMenuHandler || !this.#resolveEngine()) return;
		const canvas = this.#resolveEngine().getViewManager().getCanvas();
		if (canvas) canvas.removeEventListener("contextmenu", this.#contextMenuHandler);
		this.#contextMenuHandler = null;
	}
	//==============================================================================
	// 우클릭 처리. (필드 안이면 기본 메뉴를 막고 포커스한 뒤 문맥 메뉴를 띄운다, 밖이면 띄운 메뉴를 닫는다)
	//==============================================================================
	/**
	 * @param { MouseEvent } event 캔버스의 contextmenu 사건.
	 * @private
	 */
	handleContextMenuEvent(event) {
		if (!this.#resolveEngine()) return;
		const viewPosition = this.#convertClientPositionToViewPosition(event.clientX, event.clientY);
		if (viewPosition === null) return;
		if (!this.contains(viewPosition)) {
			// 메뉴 위의 오른쪽 클릭은 브라우저 메뉴를 막기만 하고, 그 밖이면 띄운 메뉴를 닫는다.
			if (this.#isViewPositionInsideContextMenu(viewPosition)) {
				event.preventDefault();
			}
			else {
				this.hideContextMenu();
			}
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		this.focus();
		this.showContextMenu(viewPosition);
	}
	//==============================================================================
	// 직접 누름 DOM 입력의 오른쪽 클릭 처리. (브라우저 편집 칸 메뉴를 막고 엔진 문맥 메뉴를 띄운다)
	//==============================================================================
	/**
	 * @param { MouseEvent } event DOM 입력의 contextmenu 사건.
	 * @private
	 */
	handleDOMInputContextMenuEvent(event) {
		if (!this.#useDirectTouch) return;
		event.preventDefault();
		event.stopPropagation();
		const viewPosition = this.#convertClientPositionToViewPosition(event.clientX, event.clientY);
		if (viewPosition === null) return;
		this.focus();
		this.showContextMenu(viewPosition);
	}
	//==============================================================================
	// 뷰포트 좌표(clientX, clientY)를 뷰 좌표로. (캔버스가 없으면 null)
	//==============================================================================
	/**
	 * @param { number } clientX 뷰포트 X. (CSS 픽셀)
	 * @param { number } clientY 뷰포트 Y. (CSS 픽셀)
	 * @returns { Vector2 | null } 뷰 좌표. (엔진이나 캔버스가 없으면 null)
	 */
	#convertClientPositionToViewPosition(clientX, clientY) {
		if (!this.#resolveEngine()) return null;
		const viewManager = this.#resolveEngine().getViewManager();
		const canvas = viewManager.getCanvas();
		if (!canvas) return null;
		const rect = canvas.getBoundingClientRect();
		return viewManager.canvasPositionToViewPosition(Vector2.create(clientX - rect.left, clientY - rect.top));
	}
	//==============================================================================
	// 문맥 메뉴 띄우기. (엔진이 그린 잘라내기, 복사, 붙여넣기, 모두 선택 메뉴, 러스트 판 show_context_menu 와 같다)
	// - 루트의 마지막 자식 노드(UIInputFieldContextMenu 컴포넌트)로 만들어 위에 그린다. 메뉴 왼쪽 위가 누른 자리다.
	// - 메뉴 밖을 누르거나, 필드가 포커스를 잃거나 트리에서 빠지면 닫힌다.
	//==============================================================================
	/**
	 * @param { Vector2 } viewPosition 메뉴 왼쪽 위. (뷰 좌표)
	 */
	showContextMenu(viewPosition) {
		this.hideContextMenu();
		let root = this;
		while (root.getParent() !== null) {
			root = root.getParent();
		}
		if (root === this || typeof root.convertViewToLocal !== "function") return;
		const menuNode = new WorldNode();
		menuNode.setName("uiInputFieldContextMenu");
		menuNode.setPivot(Pivot.topLeft);
		menuNode.setAnchor(Pivot.topLeft);
		menuNode.setLocalPosition(root.convertViewToLocal(viewPosition));
		menuNode.setContentSize(Vector2.create(CONTEXT_MENU_WIDTH, CONTEXT_MENU_PADDING_Y * 2 + CONTEXT_MENU_ITEM_HEIGHT * CONTEXT_MENU_ITEM_LIST.length));
		root.addChild(menuNode);
		const menu = menuNode.addComponent(UIInputFieldContextMenu);
		menu.initialize(this, this.#resolveEngine(), this.hasSelection(), this.#value.length > 0);
		this.#contextMenuNode = menuNode;
		// 메뉴 위 mousedown 은 입력 칸 포커스를 빼지 않게 기본 동작을 막는다. (메뉴 항목을 누르는 동안 입력 칸이 포커스를 잃어 메뉴가 닫히지 않게)
		const canvas = this.#resolveEngine() ? this.#resolveEngine().getViewManager().getCanvas() : null;
		if (canvas && !this.#contextMenuMouseDownHandler) {
			this.#contextMenuMouseDownHandler = (event) => {
				const position = this.#convertClientPositionToViewPosition(event.clientX, event.clientY);
				if (position !== null && this.#isViewPositionInsideContextMenu(position)) {
					event.preventDefault();
				}
			};
			canvas.addEventListener("mousedown", this.#contextMenuMouseDownHandler);
		}
	}
	//==============================================================================
	// 문맥 메뉴 닫기. (러스트 판 hide_context_menu 와 같다)
	//==============================================================================
	/** @private */
	hideContextMenu() {
		const menuNode = this.#contextMenuNode;
		this.#contextMenuNode = null;
		if (menuNode && menuNode.getParent() !== null) {
			menuNode.getParent().removeChild(menuNode);
		}
		if (this.#contextMenuMouseDownHandler) {
			const canvas = this.#resolveEngine() ? this.#resolveEngine().getViewManager().getCanvas() : null;
			if (canvas) {
				canvas.removeEventListener("mousedown", this.#contextMenuMouseDownHandler);
			}
			this.#contextMenuMouseDownHandler = null;
		}
	}
	//==============================================================================
	// 뷰 좌표가 띄운 문맥 메뉴 안인지.
	//==============================================================================
	/**
	 * @param { Vector2 } viewPosition 볼 뷰 좌표.
	 * @returns { boolean } 메뉴가 떠 있고 그 안이면 참.
	 */
	#isViewPositionInsideContextMenu(viewPosition) {
		const menuNode = this.#contextMenuNode;
		return menuNode !== null && menuNode.getParent() !== null && menuNode.contains(viewPosition);
	}
}


//==============================================================================
// 문맥 메뉴 크기. (러스트 판과 같다: 폭 140, 위아래 여백 4, 항목 높이 34(글자 14px 와 위아래 여백 8), 글 왼쪽 여백 16)
//==============================================================================
const CONTEXT_MENU_WIDTH = 140;
const CONTEXT_MENU_PADDING_Y = 4;
const CONTEXT_MENU_ITEM_HEIGHT = 34;
const CONTEXT_MENU_ITEM_PADDING_X = 16;
const CONTEXT_MENU_FONT_SIZE = 14;
// 문맥 메뉴 항목. (글, 항목, 차례)
const CONTEXT_MENU_ITEM_LIST = [
	["잘라내기", UIInputFieldMenuAction.cut],
	["복사", UIInputFieldMenuAction.copy],
	["붙여넣기", UIInputFieldMenuAction.paste],
	["모두 선택", UIInputFieldMenuAction.selectAll],
];
// 문맥 메뉴 그림자 색. (CSS box-shadow 0 4px 16px rgba(0, 0, 0, 0.18) 의 색)
const CONTEXT_MENU_SHADOW_COLOR = new Color(0, 0, 0, 0.18);


//==============================================================================
// 엔진이 그린 문맥 메뉴. (러스트 판 UIInputFieldContextMenu 와 같다)
// - 루트의 자식 노드에 붙는다. 항목을 누르면 주인 필드에 항목을 부탁하고(다음 tick 에 한다) 스스로 닫는다.
// - 메뉴 밖을 누르거나, 다른 자리에 문맥 메뉴를 부르거나, 주인 필드가 포커스를 잃거나 트리에서 빠지면 스스로 닫는다.
// - 그림자는 CSS box-shadow 0 4px 16px rgba(0, 0, 0, 0.18) 을 블링크처럼 시그마 8 의 가우스로 구워 그린다. (core/blurshadow.js)
//==============================================================================
class UIInputFieldContextMenu extends Component {
	/** @private @type { UIInputField | null } */ #ownerField; // 주인 필드.
	/** @private @type { Engine | null } */ #engine; // 입력을 읽을 엔진.
	/** @private @type { boolean } */ #isSelectionAvailable; // 고른 글이 있는지. (잘라내기, 복사)
	/** @private @type { boolean } */ #isTextAvailable; // 글이 있는지. (모두 선택)
	/** @private @type { number } */ #hoveredItemIndex; // 마우스 아래 항목 자리. (없으면 -1)
	/** @private @type { boolean } */ #isFirstTick; // 띄운 첫 tick 인지. (띄운 누름을 밖 누름으로 치지 않는다)
	/** @private @type { BlurredRoundRectShadow } */ #shadow; // 그림자의 구운 그림.

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setComponentType("UIInputFieldContextMenu");
		this.#ownerField = null;
		this.#engine = null;
		this.#isSelectionAvailable = false;
		this.#isTextAvailable = false;
		this.#hoveredItemIndex = -1;
		this.#isFirstTick = true;
		this.#shadow = new BlurredRoundRectShadow();
	}

	//==============================================================================
	// 그리는 사각형. (흰 판은 내용 영역, 그림자가 시그마 8 의 세 배와 기기 한 픽셀만큼 사방으로, 아래로 4 만큼 더 넘친다)
	//==============================================================================
	calculateDrawnRect(rect) {
		const node = this.getNode();
		if (!node) return false;
		const contentSize = node.getContentSize();
		const shadowMargin = cssBlurRadiusToSigma(16) * 3 + 2;
		rect.position.set(-shadowMargin, -shadowMargin);
		rect.size.set(contentSize.x + shadowMargin * 2, contentSize.y + shadowMargin * 2 + 4);
		return true;
	}

	//==============================================================================
	// 주인과 항목 상태 넣기. (선택이 없으면 잘라내기와 복사, 글이 없으면 모두 선택은 흐리게)
	//==============================================================================
	initialize(ownerField, engine, isSelectionAvailable, isTextAvailable) {
		this.#ownerField = ownerField;
		this.#engine = engine;
		this.#isSelectionAvailable = isSelectionAvailable;
		this.#isTextAvailable = isTextAvailable;
		const node = this.getNode();
		if (node) {
			node.setInteractable(true);
		}
	}

	//==============================================================================
	// 항목을 쓸 수 있는지.
	//==============================================================================
	isItemEnabled(menuAction) {
		if (menuAction === UIInputFieldMenuAction.cut || menuAction === UIInputFieldMenuAction.copy) {
			return this.#isSelectionAvailable;
		}
		if (menuAction === UIInputFieldMenuAction.selectAll) {
			return this.#isTextAvailable;
		}
		return true;
	}

	//==============================================================================
	// 뷰 좌표 아래 항목 자리. (없으면 -1)
	//==============================================================================
	findItemIndex(viewPosition) {
		const node = this.getNode();
		if (!node || !node.contains(viewPosition)) {
			return -1;
		}
		const localPosition = node.convertViewToLocal(viewPosition);
		if (localPosition.x < 0 || localPosition.x > CONTEXT_MENU_WIDTH) {
			return -1;
		}
		const itemY = localPosition.y - CONTEXT_MENU_PADDING_Y;
		if (itemY < 0) {
			return -1;
		}
		const itemIndex = System.Math.floor(itemY / CONTEXT_MENU_ITEM_HEIGHT);
		if (itemIndex >= CONTEXT_MENU_ITEM_LIST.length) {
			return -1;
		}
		return itemIndex;
	}

	//==============================================================================
	// 메뉴 닫기. (주인 필드가 노드를 뗀다)
	//==============================================================================
	close() {
		if (this.#ownerField) {
			this.#ownerField.hideContextMenu();
		}
		const node = this.getNode();
		if (node && node.getParent() !== null) {
			node.getParent().removeChild(node);
		}
	}

	//==============================================================================
	// 갱신. (필드가 포커스를 잃었거나 메뉴 밖을 누르면 닫고, 마우스 아래 항목을 둔다)
	//==============================================================================
	/**
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 */
	tick(timeDelta) {
		const ownerField = this.#ownerField;
		const isOwnerReady = ownerField !== null && ownerField.isFocused() && ownerField.getParent() !== null;
		if (!isOwnerReady || !this.#engine) {
			this.close();
			return;
		}
		const inputManager = this.#engine.getInputManager();
		const viewInputPosition = inputManager.getViewInputPosition();
		this.#hoveredItemIndex = this.findItemIndex(viewInputPosition);
		if (!this.#isFirstTick) {
			const node = this.getNode();
			const isPressedOutside = inputManager.isTouchPressed() && !(node && node.contains(viewInputPosition));
			if (isPressedOutside) {
				this.close();
				return;
			}
		}
		this.#isFirstTick = false;
	}

	//==============================================================================
	// 누름. (쓸 수 있는 항목이면 필드에 그 항목을 부탁하고 닫는다)
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 누른 자리. (뷰 좌표)
	 */
	touchPress(viewInputPosition) {
		const itemIndex = this.findItemIndex(viewInputPosition);
		if (itemIndex < 0) {
			return;
		}
		const menuAction = CONTEXT_MENU_ITEM_LIST[itemIndex][1];
		if (!this.isItemEnabled(menuAction)) {
			return;
		}
		if (this.#ownerField) {
			this.#ownerField.requestMenuAction(menuAction);
		}
		this.close();
	}

	//==============================================================================
	// 그리기. (그림자, 흰 판, 테두리, 항목 글, 마우스 아래 항목 바탕)
	//==============================================================================
	/**
	 * @param { Graphic } graphic 그래픽.
	 */
	draw(graphic) {
		const node = this.getNode();
		if (!node) return;
		const contentSize = node.getContentSize();
		const menuRect = Rect.create(0, 0, contentSize.x, contentSize.y);
		graphic.pushState();
		// CSS box-shadow 0 4px 16px rgba(0, 0, 0, 0.18) 을 블링크처럼 시그마 8 의 가우스로. (테두리 상자 모양)
		this.#shadow.draw(graphic, menuRect, 8, Vector2.create(0, 4), cssBlurRadiusToSigma(16), CONTEXT_MENU_SHADOW_COLOR);
		graphic.setFillColor("#ffffff");
		graphic.drawRoundRect(menuRect, 8);
		graphic.setStrokeColor("#cccccc");
		graphic.drawStrokeRoundRect(Rect.create(0.5, 0.5, contentSize.x - 1, contentSize.y - 1), 7.5, 1);
		graphic.setFontString(buildFontString(null, CONTEXT_MENU_FONT_SIZE, false, false));
		graphic.setTextAlign("left");
		graphic.setTextBaseline("middle");
		for (let itemIndex = 0; itemIndex < CONTEXT_MENU_ITEM_LIST.length; ++itemIndex) {
			const [itemText, menuAction] = CONTEXT_MENU_ITEM_LIST[itemIndex];
			const itemTop = CONTEXT_MENU_PADDING_Y + itemIndex * CONTEXT_MENU_ITEM_HEIGHT;
			const isEnabled = this.isItemEnabled(menuAction);
			if (isEnabled && this.#hoveredItemIndex === itemIndex) {
				graphic.setFillColor("#eef2ff");
				graphic.drawRect(Rect.create(1, itemTop, contentSize.x - 2, CONTEXT_MENU_ITEM_HEIGHT));
			}
			graphic.setFillColor(isEnabled ? "#222222" : "#aaaaaa");
			graphic.drawFillText(itemText, CONTEXT_MENU_ITEM_PADDING_X, itemTop + CONTEXT_MENU_ITEM_HEIGHT * 0.5);
		}
		graphic.popState();
	}
}


//==============================================================================
// 여러 줄 필드의 휠 받기. (TouchRaycaster 가 휠을 넘기는 스크롤 칸 꼴, 여러 줄일 때만 필드에 붙는다)
//==============================================================================
class TextAreaWheelReceiver extends Component {
	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setComponentType("UIInputFieldWheelReceiver");
	}
	//==============================================================================
	// 휠 받기. (필드의 scrollTop 을 휠 세로 값만큼 넘긴다)
	//==============================================================================
	/**
	 * @param { Vector2 } delta 휠 값. (아래가 +y)
	 */
	wheel(delta) {
		const node = this.getNode();
		if (!delta || !node || typeof node.scrollTextAreaByWheel !== "function") return;
		node.scrollTextAreaByWheel(delta.y);
	}
	//==============================================================================
	// 넘겨 볼 내용 크기. (필드의 글 높이 + 위아래 여백)
	//==============================================================================
	/**
	 * @returns { Vector2 } 내용 크기.
	 */
	getScrollContentSize() {
		const node = this.getNode();
		if (!node || typeof node.getTextAreaScrollContentSize !== "function") return Vector2.zero();
		return node.getTextAreaScrollContentSize();
	}
}


//==============================================================================
// 한 줄 필드의 바탕 층과 덮개 층이 그리는 사각형 적기. (선택, 조합 밑줄, 커서는 안쪽 여백에서 보이는 글 너비까지 가로로 넘칠 수 있다)
// - 가로는 내용 폭과 안쪽 여백 + 보이는 글(값에 조합 글을 끼운 것) 너비를 합치고, 세로는 내용 높이와 가운데에서 글꼴 크기만큼씩.
// - 여러 줄은 내용 영역으로 잘라 그리므로 내용 영역. 커서와 밑줄 굵기(2)만큼 넓혀 본다. 잴 수 없으면 false.
//==============================================================================
/**
 * @param { UIInputField } field 주인 필드.
 * @param { Vector2 } contentSize 그리는 노드의 내용 크기.
 * @param { Rect } rect 그리는 사각형을 적을 곳.
 * @returns { boolean } 적었으면 참.
 */
function writeInputLayerDrawnRect(field, contentSize, rect) {
	let minimumX = System.Math.min(0, contentSize.x);
	let maximumX = System.Math.max(0, contentSize.x);
	let minimumY = System.Math.min(0, contentSize.y);
	let maximumY = System.Math.max(0, contentSize.y);
	if (!field.isMultiline()) {
		const state = field.getRenderState();
		const measurementContext = getMeasurementCanvasRenderingContext();
		if (measurementContext === null) {
			return false;
		}
		measurementContext.save();
		measurementContext.font = buildFontString(state.fontFace, state.fontSize, false, false);
		const textWidth = measurementContext.measureText(field.getDisplayText()).width;
		measurementContext.restore();
		minimumX = System.Math.min(minimumX, state.padding);
		maximumX = System.Math.max(maximumX, state.padding + textWidth);
		minimumY = System.Math.min(minimumY, contentSize.y * 0.5 - state.fontSize);
		maximumY = System.Math.max(maximumY, contentSize.y * 0.5 + state.fontSize);
	}
	rect.position.set(minimumX - 2, minimumY - 2);
	rect.size.set(maximumX - minimumX + 4, maximumY - minimumY + 4);
	return true;
}

//==============================================================================
// 한 줄 필드의 층이 그리는 사각형을 정하는 값의 열쇠. (보이는 글, 글꼴, 안쪽 여백, 여러 줄인지, 바뀌면 층이 그리는 사각형을 다시 셈하게 한다)
//==============================================================================
/**
 * @param { UIInputField } field 주인 필드.
 * @returns { string } 열쇠.
 */
function readInputLayerDrawnRectKey(field) {
	const state = field.getRenderState();
	const fontFamily = (state.fontFace && state.fontFace.family) ? state.fontFace.family : String(state.fontFace);
	return field.isMultiline() + "|" + state.fontSize + "|" + fontFamily + "|" + state.padding + "|" + field.getDisplayText();
}

//==============================================================================
// 텍스트보다 먼저 그려지는 레이어 (선택 영역 하이라이트).
//==============================================================================
class BackgroundLayerRenderer extends Component {
	/** @private @type { string } */ #drawnRectKey = ""; // 그리는 사각형을 셈한 값의 열쇠.
	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setComponentType("UIInputFieldBgLayer");
	}
	//==============================================================================
	// 매 프레임. (보이는 글, 글꼴, 여백이 바뀌면 그리는 사각형을 다시 셈하게 한다)
	//==============================================================================
	tick(timeDelta) {
		const node = this.getNode();
		if (!node || typeof node.getRenderState !== "function") return;
		const drawnRectKey = readInputLayerDrawnRectKey(node);
		if (drawnRectKey !== this.#drawnRectKey) {
			this.#drawnRectKey = drawnRectKey;
			this.markDrawnRectDirty();
		}
	}
	//==============================================================================
	// 그리는 사각형. (writeInputLayerDrawnRect)
	//==============================================================================
	calculateDrawnRect(rect) {
		const node = this.getNode();
		if (!node || typeof node.getRenderState !== "function") return false;
		return writeInputLayerDrawnRect(node, node.getContentSize(), rect);
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
		if (node.isMultiline()) {
			node.drawMultilineLayer(graphic, false);
			return;
		}
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
	/** @private @type { string } */ #drawnRectKey = ""; // 그리는 사각형을 셈한 값의 열쇠.
	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setComponentType("UIInputFieldOverlayLayer");
	}
	//==============================================================================
	// 매 프레임. (주인 필드의 보이는 글, 글꼴, 여백이 바뀌면 그리는 사각형을 다시 셈하게 한다)
	//==============================================================================
	tick(timeDelta) {
		const node = this.getNode();
		const parent = node && typeof node.getParent === "function" ? node.getParent() : null;
		if (!parent || typeof parent.getRenderState !== "function") return;
		const drawnRectKey = readInputLayerDrawnRectKey(parent);
		if (drawnRectKey !== this.#drawnRectKey) {
			this.#drawnRectKey = drawnRectKey;
			this.markDrawnRectDirty();
		}
	}
	//==============================================================================
	// 그리는 사각형. (주인 필드의 글로, writeInputLayerDrawnRect)
	//==============================================================================
	calculateDrawnRect(rect) {
		const node = this.getNode();
		const parent = node && typeof node.getParent === "function" ? node.getParent() : null;
		if (!parent || typeof parent.getRenderState !== "function") return false;
		return writeInputLayerDrawnRect(parent, node.getContentSize(), rect);
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
		const isMultiline = parent.isMultiline();
		if (isMultiline) {
			parent.drawMultilineLayer(graphic, true);
		}

		graphic.pushState();
		graphic.setFontString(buildFontString(state.fontFace, state.fontSize, false, false));
		const drawY = contentSize.y * 0.5;
		const padding = state.padding;
		const before = state.value.slice(0, state.composition.length > 0 ? state.compositionStart : state.cursorIndex);

		// 조합 중 밑줄.
		if (!isMultiline && state.composition.length > 0) {
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
		if (!isMultiline && state.focused && state.cursorVisible) {
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
// 자리의 문단 범위. (블링크 ExpandWithGranularity 의 kParagraph: 문단 끝의 줄바꿈까지 넣는다, 글 끝의 빈 줄이면 앞 문단, 러스트 판 find_paragraph_range_at)
//==============================================================================
/**
 * @param { string } text 글.
 * @param { number } index 자리. (UTF-16 단위)
 * @returns { { start: number, end: number } } 문단 범위.
 */
function findParagraphRangeAt(text, index) {
	const clampedIndex = System.Math.max(0, System.Math.min(text.length, index));
	let startProbe = clampedIndex;
	if (clampedIndex === text.length && clampedIndex > 0 && text.charCodeAt(clampedIndex - 1) === 0x0A) {
		startProbe = clampedIndex - 1;
	}
	const previousLineBreak = startProbe > 0 ? text.lastIndexOf("\n", startProbe - 1) : -1;
	const nextLineBreak = text.indexOf("\n", clampedIndex);
	return { start: previousLineBreak + 1, end: nextLineBreak < 0 ? text.length : nextLineBreak + 1 };
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
textarea.uiinputfield-hidden::selection { background: transparent; color: transparent; }
textarea.uiinputfield-hidden::placeholder { color: transparent; }
textarea.uiinputfield-hidden::-webkit-scrollbar { display: none; }
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


//==============================================================================
// 되돌리기, 다시 하기 키 찾기. (러스트 판 desktop/textinput.rs 의 translate_shortcut_key 와 같은 키)
// - 맥은 Cmd + Z 가 되돌리기, Cmd + Shift + Z 가 다시 하기다.
// - 윈도우와 리눅스는 Ctrl + Z 가 되돌리기, Ctrl + Shift + Z 와 Ctrl + Y 가 다시 하기다. 윈도우는 Alt + Backspace(Shift 와 함께면 다시 하기)도.
// - 글자 키는 글자가 라틴 낱자가 아닌 자판(한글 같은)이면 물리 키(code)로 본다.
//==============================================================================
/**
 * @param { KeyboardEvent } event 키 사건.
 * @returns { "undo" | "redo" | null } 명령. (되돌리기 키가 아니면 null)
 */
function findHistoryCommand(event) {
	const key = typeof event.key === "string" ? event.key : "";
	if (isWindowsPlatform() && event.altKey && !event.ctrlKey && !event.metaKey && key === "Backspace") {
		return event.shiftKey ? "redo" : "undo";
	}
	const isMac = isMacPlatform();
	const isCommandHeld = isMac ? (event.metaKey && !event.ctrlKey) : (event.ctrlKey && !event.metaKey);
	if (!isCommandHeld || event.altKey) return null;
	const lowerKey = key.toLowerCase();
	const isLatinLetter = /^[a-z]$/.test(lowerKey);
	const isZ = lowerKey === "z" || (!isLatinLetter && event.code === "KeyZ");
	const isY = lowerKey === "y" || (!isLatinLetter && event.code === "KeyY");
	if (isZ) return event.shiftKey ? "redo" : "undo";
	if (isY && !isMac && !event.shiftKey) return "redo";
	return null;
}


//==============================================================================
// CSS normal 줄 높이 재기. (크롬이 그 폰트의 첫째 글꼴로 셈한 line-height: normal, 러스트 판 웹 systemfont.rs 의 measure_normal_line_height 와 같은 재기)
// - 숨긴 div 에 글자 하나를 두고 높이를 읽는다. 폰트 문자열마다 한 번 재고, 글꼴을 새로 불러오면 다시 잰다.
//==============================================================================
/**
 * @param { string } fontString Canvas2D font 꼴의 폰트 문자열.
 * @returns { number | null } 줄 높이. (잴 문서가 없거나 0 이면 null)
 */
function measureNormalLineHeight(fontString) {
	const doc = System.document;
	if (!doc || !doc.body) return null;
	const fontSet = doc.fonts;
	const fontSetSize = fontSet && typeof fontSet.size === "number" ? fontSet.size : 0;
	const tableKey = `${fontString}|${fontSetSize}|${fontSet && fontSet.status ? fontSet.status : ""}`;
	if (normalLineHeightTable.has(tableKey)) return normalLineHeightTable.get(tableKey);
	const probeElement = doc.createElement("div");
	const style = probeElement.style;
	style.position = "absolute";
	style.visibility = "hidden";
	style.left = "-10000px";
	style.top = "-10000px";
	style.margin = "0";
	style.padding = "0";
	style.border = "0";
	style.whiteSpace = "pre";
	style.font = fontString;
	style.lineHeight = "normal";
	probeElement.textContent = "x";
	doc.body.appendChild(probeElement);
	const lineHeight = probeElement.getBoundingClientRect().height;
	probeElement.remove();
	if (!(lineHeight > 0)) return null;
	normalLineHeightTable.set(tableKey, lineHeight);
	return lineHeight;
}
/** 잰 CSS normal 줄 높이. (폰트 문자열과 글꼴 상태 → 높이) */
const normalLineHeightTable = new Map();


/** 잰 클래식 스크롤 막대 두께. (null 이면 아직 재지 않았다) */
let classicScrollbarThickness = null;
//==============================================================================
// 클래식 스크롤 막대 치수 읽기. (러스트 판 web/pane.rs 의 read_classic_scrollbar_metrics 웹 갈래, 얹는 막대면 null)
// - 브라우저가 놓은 막대 두께(overflow: scroll 인 요소의 offsetWidth - clientWidth)를 읽는다. 0 이면 얹는 막대다.
// - 단추, 썸 두께, 썸 가장 짧은 길이는 크롬 Aura 막대(두께 15, 단추 18, 썸 9, 가장 짧은 길이 17)를 두께에 비례해 줄인다.
//==============================================================================
/**
 * @returns { { thickness: number, buttonLength: number, thumbThickness: number, thumbCrossOffset: number, thumbMinimumLength: number, thumbLengthInset: number } | null } 치수.
 */
function readClassicScrollbarMetrics() {
	if (classicScrollbarThickness === null) {
		classicScrollbarThickness = 0;
		const doc = System.document;
		if (doc && doc.body) {
			const probeElement = doc.createElement("div");
			const style = probeElement.style;
			style.position = "absolute";
			style.visibility = "hidden";
			style.left = "-10000px";
			style.top = "-10000px";
			style.width = "100px";
			style.height = "100px";
			style.overflow = "scroll";
			style.scrollbarWidth = "auto";
			doc.body.appendChild(probeElement);
			classicScrollbarThickness = System.Math.max(0, probeElement.offsetWidth - probeElement.clientWidth);
			probeElement.remove();
		}
	}
	const thickness = classicScrollbarThickness;
	if (thickness <= 0) {
		return null;
	}
	const proportion = thickness / 15;
	const thumbThickness = System.Math.floor(9 * proportion);
	return {
		thickness,
		buttonLength: System.Math.floor(18 * proportion),
		thumbThickness,
		thumbCrossOffset: System.Math.floor((thickness - thumbThickness) * 0.5),
		thumbMinimumLength: System.Math.floor(17 * proportion),
		thumbLengthInset: 0,
	};
}
//==============================================================================
// 클래식 막대의 썸 자리. (러스트 판 calculate_classic_thumb_span, 넘치지 않거나 썸 칸이 모자라면 null)
//==============================================================================
/**
 * @param { object } metrics readClassicScrollbarMetrics 의 치수.
 * @param { number } trackLength 막대 길이.
 * @param { number } viewportLength 보이는 길이.
 * @param { number } extentLength 내용 길이.
 * @param { number } offset 넘긴 만큼.
 * @returns { { start: number, length: number } | null } 썸 시작과 길이.
 */
function calculateClassicThumbSpan(metrics, trackLength, viewportLength, extentLength, offset) {
	const thumbRoom = trackLength - metrics.buttonLength * 2;
	if (extentLength <= viewportLength + 0.5 || thumbRoom < metrics.thumbMinimumLength || viewportLength <= 0) {
		return null;
	}
	const thumbLength = System.Math.min(thumbRoom, System.Math.max(metrics.thumbMinimumLength, System.Math.round(thumbRoom * viewportLength / extentLength)));
	const maximumOffset = extentLength - viewportLength;
	const thumbStart = metrics.buttonLength + (thumbRoom - thumbLength) * System.Math.max(0, System.Math.min(1, offset / maximumOffset));
	return { start: thumbStart, length: thumbLength };
}


//==============================================================================
// 탭을 넣어 폭 재기. (startX 에서 시작해 끝 x, 탭은 다음 탭 자리로, 러스트 판 measure_with_tabs)
//==============================================================================
/**
 * @param { string } text 잴 글.
 * @param { number } startX 시작 x.
 * @param { number } tabWidth 탭 폭. (0 이하면 탭은 폭이 없다)
 * @param { (text: string) => number } measureWidth 글 폭 재기.
 * @returns { number } 끝 x.
 */
function measureWithTabs(text, startX, tabWidth, measureWidth) {
	let x = startX;
	const pieceList = text.split("\t");
	for (let pieceIndex = 0; pieceIndex < pieceList.length; ++pieceIndex) {
		if (pieceIndex > 0) {
			x = advanceToTabStop(x, tabWidth);
		}
		if (pieceList[pieceIndex].length > 0) {
			x += measureWidth(pieceList[pieceIndex]);
		}
	}
	return x;
}
//==============================================================================
// 다음 탭 자리. (지금 x 보다 큰 첫 배수, 탭 폭이 0 이하면 그대로)
//==============================================================================
/**
 * @param { number } x 지금 x.
 * @param { number } tabWidth 탭 폭.
 * @returns { number } 다음 탭 자리.
 */
function advanceToTabStop(x, tabWidth) {
	if (tabWidth <= 0) {
		return x;
	}
	return (System.Math.floor(x / tabWidth) + 1) * tabWidth;
}
//==============================================================================
// 줄 끝 공백을 뺀 글. (pre-wrap 의 매달리는 공백, 공백과 U+3000)
//==============================================================================
/**
 * @param { string } text 글.
 * @returns { string } 끝 공백을 뺀 글.
 */
function trimHangingSpaces(text) {
	let end = text.length;
	while (end > 0 && (text.charCodeAt(end - 1) === 0x20 || text.charCodeAt(end - 1) === 0x3000)) {
		--end;
	}
	return text.slice(0, end);
}


/** 문단 → 줄 나눔 자리 목록. (크롬에서 읽은 것, 많아지면 비운다) */
const lineBreakListCache = new Map();
/** 줄 나눔 자리 캐시의 크기 한도. */
const LINE_BREAK_LIST_CACHE_LIMIT = 512;
/** 줄 나눔 자리를 읽는 숨긴 div. (처음 부를 때 만든다) */
let lineBreakMirrorElement = null;
//==============================================================================
// 문단의 줄 나눔 자리. (UTF-16 자리, 0 과 끝은 빼고 차례대로, 그 자리에서 새 줄이 시작될 수 있다)
// - 크롬 textarea 와 같은 줄 나누기다. 원본은 크롬 위에서 돌아서 크롬 자신의 줄 나누기를 읽는다:
//   1px 폭 white-space: pre-wrap 칸에 문단을 두면 나눌 수 있는 자리마다 줄이 바뀐다. 줄이 바뀌는 첫 글자의 자리가 나눔 자리다.
//   (러스트 판 textarealayout.rs 의 find_line_break_list 가 크롬 158 에서 이렇게 뜬 값과 같은지 시험한다)
// - 문서가 없으면(node) 공백 뭉치 뒤에서만 나눈다.
//==============================================================================
/**
 * @param { string } paragraph 줄바꿈 문자가 없는 문단.
 * @returns { number[] } 나눔 자리 목록. (오름차순)
 */
function findLineBreakList(paragraph) {
	const cachedBreakList = lineBreakListCache.get(paragraph);
	if (cachedBreakList) {
		return cachedBreakList;
	}
	let breakList = findLineBreakListFromDocument(paragraph);
	if (!breakList) {
		breakList = findLineBreakListAfterSpaces(paragraph);
	}
	if (lineBreakListCache.size >= LINE_BREAK_LIST_CACHE_LIMIT) {
		lineBreakListCache.clear();
	}
	lineBreakListCache.set(paragraph, breakList);
	return breakList;
}
//==============================================================================
// 크롬의 줄 나누기로 나눔 자리 읽기. (문서가 없으면 null)
//==============================================================================
/**
 * @param { string } paragraph 줄바꿈 문자가 없는 문단.
 * @returns { number[] | null } 나눔 자리 목록.
 */
function findLineBreakListFromDocument(paragraph) {
	const doc = System.document;
	if (!doc || !doc.body || typeof doc.createRange !== "function") {
		return null;
	}
	if (!lineBreakMirrorElement || !lineBreakMirrorElement.isConnected) {
		const element = doc.createElement("div");
		element.setAttribute("aria-hidden", "true");
		const style = element.style;
		style.position = "absolute";
		style.visibility = "hidden";
		style.pointerEvents = "none";
		style.left = "-10000px";
		style.top = "-10000px";
		style.width = "1px";
		style.margin = "0";
		style.padding = "0";
		style.border = "0";
		style.font = "16px sans-serif";
		style.whiteSpace = "pre-wrap";
		style.overflowWrap = "normal";
		style.wordBreak = "normal";
		style.lineBreak = "auto";
		element.appendChild(doc.createTextNode(""));
		doc.body.appendChild(element);
		lineBreakMirrorElement = element;
	}
	const textNode = lineBreakMirrorElement.firstChild;
	textNode.data = paragraph;
	const range = doc.createRange();
	const breakList = [];
	let previousTop = null;
	let index = 0;
	while (index < paragraph.length) {
		const step = isInsideSurrogatePair(paragraph, index + 1) ? 2 : 1;
		range.setStart(textNode, index);
		range.setEnd(textNode, index + step);
		const rectList = range.getClientRects();
		if (rectList.length > 0) {
			const top = rectList[0].top;
			if (previousTop !== null && top > previousTop + 0.5) {
				breakList.push(index);
			}
			previousTop = top;
		}
		index += step;
	}
	textNode.data = "";
	return breakList;
}
//==============================================================================
// 공백 뭉치 뒤 나눔 자리. (문서가 없을 때 갈음, 공백과 탭 뒤에 공백이 아닌 글자가 오는 자리)
//==============================================================================
/**
 * @param { string } paragraph 줄바꿈 문자가 없는 문단.
 * @returns { number[] } 나눔 자리 목록.
 */
function findLineBreakListAfterSpaces(paragraph) {
	const breakList = [];
	for (let index = 1; index < paragraph.length; ++index) {
		const previousCodeUnit = paragraph.charCodeAt(index - 1);
		const codeUnit = paragraph.charCodeAt(index);
		const isPreviousSpace = previousCodeUnit === 0x20 || previousCodeUnit === 0x09;
		const isSpace = codeUnit === 0x20 || codeUnit === 0x09;
		if (isPreviousSpace && !isSpace) {
			breakList.push(index);
		}
	}
	return breakList;
}


//==============================================================================
// 여러 줄 배치. (러스트 판 ui/textarealayout.rs 의 TextAreaLayout, 자리는 UTF-16 단위)
// - lineList 의 줄마다 { start, end, top, offsets, graphemeBoundaryList, isHardBreak }.
//   offsets[i] 는 start + i 자리의 x, graphemeBoundaryList 는 start 기준 글자 묶음 경계(0 과 end - start 를 넣는다)다.
//==============================================================================
class TextAreaLayout {
	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { object[] } lineList 보이는 줄 목록.
	 * @param { number } lineHeight 줄 높이.
	 */
	constructor(lineList, lineHeight) {
		this.lineList = lineList;
		this.lineHeight = lineHeight;
	}
	//==============================================================================
	// 글 높이. (줄 수 x 줄 높이)
	//==============================================================================
	/**
	 * @returns { number } 글 높이.
	 */
	getContentHeight() {
		return this.lineList.length * this.lineHeight;
	}
	//==============================================================================
	// 자리가 있는 줄. (폭으로 나뉜 자리는 isUpstream 이면 앞 줄, 아니면 다음 줄)
	//==============================================================================
	/**
	 * @param { number } characterIndex 자리.
	 * @param { boolean } isUpstream 폭으로 나뉜 자리를 앞 줄 끝으로 볼지.
	 * @returns { number } 줄 번호.
	 */
	findLineIndex(characterIndex, isUpstream) {
		const lineList = this.lineList;
		if (lineList.length === 0) {
			return 0;
		}
		for (let lineIndex = 0; lineIndex < lineList.length; ++lineIndex) {
			const line = lineList[lineIndex];
			if (characterIndex < line.end) {
				return lineIndex;
			}
			if (characterIndex === line.end) {
				const isSoftBoundary = !line.isHardBreak && lineIndex + 1 < lineList.length;
				if (isSoftBoundary && !isUpstream) {
					return lineIndex + 1;
				}
				return lineIndex;
			}
		}
		return lineList.length - 1;
	}
	//==============================================================================
	// 자리의 x. (그 줄의 글자 경계)
	//==============================================================================
	/**
	 * @param { number } lineIndex 줄 번호.
	 * @param { number } characterIndex 자리.
	 * @returns { number } x. (글 영역 기준)
	 */
	getXInLine(lineIndex, characterIndex) {
		const line = this.lineList[lineIndex];
		if (!line) {
			return 0;
		}
		const localIndex = System.Math.max(line.start, System.Math.min(line.end, characterIndex)) - line.start;
		const offset = line.offsets[localIndex];
		return typeof offset === "number" ? offset : 0;
	}
	//==============================================================================
	// 커서 자리. ({ x, top }, 글 영역 기준)
	//==============================================================================
	/**
	 * @param { number } characterIndex 자리.
	 * @param { boolean } isUpstream 폭으로 나뉜 자리를 앞 줄 끝으로 볼지.
	 * @returns { { x: number, top: number } } 커서의 x 와 줄 위 y.
	 */
	getCaretPosition(characterIndex, isUpstream) {
		const lineIndex = this.findLineIndex(characterIndex, isUpstream);
		const line = this.lineList[lineIndex];
		return { x: this.getXInLine(lineIndex, characterIndex), top: line ? line.top : 0 };
	}
	//==============================================================================
	// 줄 안 x 에 가까운 자리. (줄 끝을 넘으면 줄 끝이고, 폭으로 나뉜 줄이면 이 줄에 남게 isUpstream)
	//==============================================================================
	/**
	 * @param { number } lineIndex 줄 번호.
	 * @param { number } x 글 영역 x.
	 * @returns { { index: number, isUpstream: boolean } } 자리와 위쪽 친화.
	 */
	findCharacterIndexInLine(lineIndex, x) {
		const line = this.lineList[lineIndex];
		if (!line) {
			return { index: 0, isUpstream: false };
		}
		const localIndex = findBoundaryIndexAtOffset(line.offsets, line.graphemeBoundaryList, x);
		const characterIndex = line.start + localIndex;
		const isSoftEnd = characterIndex === line.end && !line.isHardBreak && lineIndex + 1 < this.lineList.length;
		return { index: characterIndex, isUpstream: isSoftEnd };
	}
	//==============================================================================
	// 글 영역 (x, y) 에 가까운 자리. (위로 넘으면 첫 줄, 아래로 넘으면 마지막 줄)
	//==============================================================================
	/**
	 * @param { number } x 글 영역 x.
	 * @param { number } y 글 영역 y.
	 * @returns { { index: number, isUpstream: boolean } } 자리와 위쪽 친화.
	 */
	findCharacterIndexAt(x, y) {
		if (this.lineList.length === 0 || this.lineHeight <= 0) {
			return { index: 0, isUpstream: false };
		}
		const lineIndex = System.Math.min(this.lineList.length - 1, System.Math.max(0, System.Math.floor(y / this.lineHeight)));
		return this.findCharacterIndexInLine(lineIndex, x);
	}
	//==============================================================================
	// 줄 위아래로 옮긴 자리. (lineDelta 만큼, 가로 자리는 preferredX, 첫 줄 위는 글 앞, 마지막 줄 아래는 글 끝)
	//==============================================================================
	/**
	 * @param { number } characterIndex 지금 자리.
	 * @param { boolean } isUpstream 지금 자리의 위쪽 친화.
	 * @param { number } preferredX 지킬 가로 자리.
	 * @param { number } lineDelta 옮길 줄 수. (위는 음수)
	 * @returns { { index: number, isUpstream: boolean } } 옮긴 자리와 위쪽 친화.
	 */
	moveVertically(characterIndex, isUpstream, preferredX, lineDelta) {
		if (this.lineList.length === 0) {
			return { index: 0, isUpstream: false };
		}
		const targetIndex = this.findLineIndex(characterIndex, isUpstream) + lineDelta;
		if (targetIndex < 0) {
			return { index: 0, isUpstream: false };
		}
		if (targetIndex >= this.lineList.length) {
			return { index: this.lineList[this.lineList.length - 1].end, isUpstream: false };
		}
		return this.findCharacterIndexInLine(targetIndex, preferredX);
	}
	//==============================================================================
	// 줄의 앞 자리와 끝 자리. (끝은 폭으로 나뉜 줄이면 이 줄에 남게 isUpstream)
	//==============================================================================
	/**
	 * @param { number } lineIndex 줄 번호.
	 * @param { boolean } isEnd 참이면 끝, 거짓이면 앞.
	 * @returns { { index: number, isUpstream: boolean } } 자리와 위쪽 친화.
	 */
	getLineBoundary(lineIndex, isEnd) {
		const line = this.lineList[lineIndex];
		if (!line) {
			return { index: 0, isUpstream: false };
		}
		if (isEnd) {
			return { index: line.end, isUpstream: !line.isHardBreak && lineIndex + 1 < this.lineList.length };
		}
		return { index: line.start, isUpstream: false };
	}
	//==============================================================================
	// 선택 사각형들. (줄마다 하나, 글 영역 기준, 줄바꿈까지 고른 빈 줄도 0 폭으로 넣는다)
	//==============================================================================
	/**
	 * @param { number } startIndex 선택 앞.
	 * @param { number } endIndex 선택 뒤.
	 * @returns { Rect[] } 사각형 목록.
	 */
	buildSelectionRectList(startIndex, endIndex) {
		const rectList = [];
		if (startIndex >= endIndex) {
			return rectList;
		}
		for (let lineIndex = 0; lineIndex < this.lineList.length; ++lineIndex) {
			const line = this.lineList[lineIndex];
			const lineSelectionStart = System.Math.max(startIndex, line.start);
			const lineSelectionEnd = System.Math.min(endIndex, line.end);
			const isLineBreakSelected = line.isHardBreak && startIndex <= line.end && endIndex > line.end;
			if (lineSelectionStart > lineSelectionEnd || (lineSelectionStart === lineSelectionEnd && !isLineBreakSelected)) {
				continue;
			}
			const startX = this.getXInLine(lineIndex, lineSelectionStart);
			const endX = this.getXInLine(lineIndex, lineSelectionEnd);
			rectList.push(Rect.create(startX, line.top, System.Math.max(0, endX - startX), this.lineHeight));
		}
		return rectList;
	}
}
//==============================================================================
// 줄 배치 짓기. (폭이 0 이하면 줄바꿈 문자로만 나눈다, 러스트 판 build_text_area_layout)
// - 줄바꿈 문자로 문단을 나누고, 문단마다 넘지 않는 가장 먼 나눔 자리에서 줄을 끊는다. (줄 끝 공백은 매달려 폭에 넣지 않는다)
// - 첫 조각이 넘치면 글자 묶음 사이에서 끊는다. (overflow-wrap: break-word, 적어도 한 묶음)
//==============================================================================
/**
 * @param { string } text 보이는 글.
 * @param { number } wrapWidth 줄 폭.
 * @param { number } lineHeight 줄 높이.
 * @param { number } tabWidth 탭 폭.
 * @param { (text: string) => number } measureWidth 글 폭 재기.
 * @returns { TextAreaLayout } 줄 배치.
 */
function buildTextAreaLayout(text, wrapWidth, lineHeight, tabWidth, measureWidth) {
	const lineList = [];
	const paragraphList = text.split("\n");
	let paragraphStart = 0;
	for (let paragraphIndex = 0; paragraphIndex < paragraphList.length; ++paragraphIndex) {
		const paragraph = paragraphList[paragraphIndex];
		const isLastParagraph = paragraphIndex + 1 === paragraphList.length;
		const pieceList = [];
		if (paragraph.length === 0 || wrapWidth <= 0) {
			pieceList.push([0, paragraph.length]);
		}
		else {
			const breakList = findLineBreakList(paragraph);
			let lineStart = 0;
			while (lineStart < paragraph.length) {
				// 넘지 않는 가장 먼 나눔 자리.
				let bestEnd = -1;
				const candidateList = breakList.filter((breakIndex) => breakIndex > lineStart);
				candidateList.push(paragraph.length);
				for (const breakIndex of candidateList) {
					const candidateWidth = measureWithTabs(trimHangingSpaces(paragraph.slice(lineStart, breakIndex)), 0, tabWidth, measureWidth);
					if (candidateWidth <= wrapWidth) {
						bestEnd = breakIndex;
					}
					else {
						break;
					}
				}
				let lineEnd = bestEnd;
				if (bestEnd < 0) {
					// 첫 조각이 넘친다: 글자 묶음 사이에서 나눈다. (적어도 한 묶음)
					let graphemeEnd = lineStart;
					while (graphemeEnd < paragraph.length) {
						const nextEnd = findNextGraphemeBoundary(paragraph, graphemeEnd);
						if (graphemeEnd > lineStart && measureWithTabs(paragraph.slice(lineStart, nextEnd), 0, tabWidth, measureWidth) > wrapWidth) {
							break;
						}
						graphemeEnd = nextEnd;
					}
					lineEnd = graphemeEnd;
				}
				pieceList.push([lineStart, lineEnd]);
				lineStart = lineEnd;
			}
		}
		for (let pieceIndex = 0; pieceIndex < pieceList.length; ++pieceIndex) {
			const pieceStart = pieceList[pieceIndex][0];
			const pieceEnd = pieceList[pieceIndex][1];
			const pieceText = paragraph.slice(pieceStart, pieceEnd);
			const offsets = [0];
			for (let index = 1; index <= pieceText.length; ++index) {
				// 서로게이트 쌍 가운데는 앞 자리와 같은 x. (커서는 글자 묶음 경계에만 선다)
				offsets.push(isInsideSurrogatePair(pieceText, index) ? offsets[index - 1] : measureWithTabs(pieceText.slice(0, index), 0, tabWidth, measureWidth));
			}
			lineList.push({
				start: paragraphStart + pieceStart,
				end: paragraphStart + pieceEnd,
				top: lineList.length * lineHeight,
				offsets,
				graphemeBoundaryList: collectGraphemeBoundaries(pieceText),
				isHardBreak: pieceIndex + 1 === pieceList.length && !isLastParagraph,
			});
		}
		paragraphStart += paragraph.length + 1;
	}
	return new TextAreaLayout(lineList, lineHeight);
}
//==============================================================================
// 글자 묶음 경계 가운데 x 에 가까운 자리. (크롬처럼 커서는 글자 묶음 경계에만 선다, 러스트 판 find_boundary_index_at_offset)
//==============================================================================
/**
 * @param { number[] } offsets offsets[i] 는 앞 i 자리의 폭.
 * @param { number[] } boundaryList 0 과 끝을 넣은 경계 목록. (오름차순)
 * @param { number } targetX 찾을 x.
 * @returns { number } 가장 가까운 경계.
 */
function findBoundaryIndexAtOffset(offsets, boundaryList, targetX) {
	const lastBoundary = boundaryList.length > 0 ? boundaryList[boundaryList.length - 1] : 0;
	if (boundaryList.length < 2 || targetX <= 0) {
		return 0;
	}
	const readOffset = (boundary) => (boundary < offsets.length ? offsets[boundary] : (offsets.length > 0 ? offsets[offsets.length - 1] : 0));
	for (let pairIndex = 1; pairIndex < boundaryList.length; ++pairIndex) {
		const width = readOffset(boundaryList[pairIndex]);
		if (width >= targetX) {
			const previousWidth = readOffset(boundaryList[pairIndex - 1]);
			if (targetX - previousWidth < width - targetX) {
				return boundaryList[pairIndex - 1];
			}
			return boundaryList[pairIndex];
		}
	}
	return lastBoundary;
}
//==============================================================================
// page 이동 거리. (보이는 높이의 87.5%, 맥은 높이 - 40 과 견줘 큰 쪽, cc ScrollUtils::CalculatePageStep)
//==============================================================================
/**
 * @param { number } visibleHeight 보이는 높이.
 * @returns { number } 거리.
 */
function calculatePageStep(visibleHeight) {
	const pageStep = visibleHeight * 0.875;
	return isMacPlatform() ? System.Math.max(pageStep, visibleHeight - 40) : pageStep;
}
