//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../base/vector2.js";
import { Pivot } from "../base/pivot.js";
import { Color } from "../base/color.js";
import { WorldNode } from "../core/node/worldnode.js";
import { Component } from "../core/component.js";
import { Paint } from "../core/component/paint.js";
import { UILabel } from "./uilabel.js";
import { SYSTEM_FONT_STRING } from "../base/platform.js";


//==============================================================================
// 입력 필드 (캔버스 기반).
// - 텍스트 렌더링은 UILabel 자식 노드 두 개로 (값 라벨 + 플레이스홀더 라벨).
// - 클릭/드래그/커서 이동/선택은 모두 캔버스 측에서 직접 처리.
// - DOM <input> 사용 여부는 옵션 (setUseDOMInput, 기본 false). true 일 때만 한글 IME /
//   모바일 소프트 키보드 / 시스템 클립보드가 동작. false 면 ASCII 위주 키보드 직접 처리.
// - 우클릭 시 컨텍스트 메뉴 (잘라내기 / 복사 / 붙여넣기).
//==============================================================================
export class UIInputField extends WorldNode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { * } */ #engine;
	/** @private @type { boolean } */ #useDOMInput;
	/** @private @type { HTMLInputElement | null } */ #domInput;
	/** @private @type { Function | null } */ #canvasKeydownHandler;
	/** @private @type { Function | null } */ #contextMenuHandler;
	/** @private @type { HTMLElement | null } */ #contextMenuElement;
	/** @private @type { Function | null } */ #contextMenuDismissHandler;

	/** @private @type { string } */ #value;
	/** @private @type { string } */ #composition;
	/** @private @type { boolean } */ #isComposing;
	/** @private @type { number } */ #cursorIndex;
	/** @private @type { number } */ #selectionStart;
	/** @private @type { number } */ #dragStartIndex;
	/** @private @type { boolean } */ #focused;
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

	/** @private @type { WorldNode } */ #textLabelNode;
	/** @private @type { UILabel } */ #textUILabel;
	/** @private @type { WorldNode } */ #placeholderLabelNode;
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
		this.#domInput = null;
		this.#canvasKeydownHandler = null;
		this.#contextMenuHandler = null;
		this.#contextMenuElement = null;
		this.#contextMenuDismissHandler = null;

		this.#value = "";
		this.#composition = "";
		this.#isComposing = false;
		this.#cursorIndex = 0;
		this.#selectionStart = 0;
		this.#dragStartIndex = -1;
		this.#focused = false;
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

		// 3) 플레이스홀더 라벨 (자식 노드). 배경은 투명 — 안 그러면 UIView.draw 가
		//    contentSize 전체를 흰색으로 채워서 그 아래 깔린 selection 하이라이트가 가려진다.
		this.#placeholderLabelNode = new WorldNode();
		this.#placeholderLabelNode.setPivot(Pivot.topLeft);
		this.#placeholderLabelNode.setAnchor(Pivot.topLeft);
		this.#placeholderUILabel = this.#placeholderLabelNode.addComponent(UILabel);
		this.#placeholderUILabel.setBackgroundColor(Color.transparent());
		this.#placeholderUILabel.setText("");
		this.#placeholderUILabel.setFontSize(this.#fontSize);
		this.#placeholderUILabel.setTextAlign("left");
		this.#placeholderUILabel.setTextBaseline("middle");
		this.#placeholderUILabel.setTextColor(this.#placeholderColor);
		this.addChild(this.#placeholderLabelNode);

		// 4) 값 라벨 (자식 노드). 배경 투명 (위 동일 이유).
		this.#textLabelNode = new WorldNode();
		this.#textLabelNode.setPivot(Pivot.topLeft);
		this.#textLabelNode.setAnchor(Pivot.topLeft);
		this.#textUILabel = this.#textLabelNode.addComponent(UILabel);
		this.#textUILabel.setBackgroundColor(Color.transparent());
		this.#textUILabel.setText("");
		this.#textUILabel.setFontSize(this.#fontSize);
		this.#textUILabel.setTextAlign("left");
		this.#textUILabel.setTextBaseline("middle");
		this.#textUILabel.setTextColor(this.#textColor);
		this.addChild(this.#textLabelNode);

		// 5) 오버레이 (커서 + 조합문자 밑줄 + 포커스 테두리). 자식이라 텍스트 위에 그려진다.
		this.#overlayNode = new WorldNode();
		this.#overlayNode.setPivot(Pivot.topLeft);
		this.#overlayNode.setAnchor(Pivot.topLeft);
		this.#overlayNode.addComponent(OverlayLayerRenderer);
		this.addChild(this.#overlayNode);

		this.refreshLabels();
	}

	//==============================================================================
	// 설정.
	//==============================================================================
	setEngine(engine) { this.#engine = engine; }
	setUseDOMInput(use) { this.#useDOMInput = !!use; }
	isUsingDOMInput() { return this.#useDOMInput; }

	setText(text) {
		this.#value = String(text || "");
		if (this.#maxLength > 0 && this.#value.length > this.#maxLength) {
			this.#value = this.#value.slice(0, this.#maxLength);
		}
		this.#cursorIndex = this.#value.length;
		this.#selectionStart = this.#cursorIndex;
		if (this.#domInput) this.#domInput.value = this.#value;
		this.refreshLabels();
	}
	getText() { return this.#value; }

	setPlaceholder(text) {
		this.#placeholder = String(text || "");
		this.refreshLabels();
	}
	setMaxLength(n) {
		this.#maxLength = n | 0;
		if (this.#domInput) {
			if (this.#maxLength > 0) this.#domInput.maxLength = this.#maxLength;
			else this.#domInput.removeAttribute("maxlength");
		}
	}
	setFontSize(size) {
		this.#fontSize = size;
		this.#textUILabel.setFontSize(size);
		this.#placeholderUILabel.setFontSize(size);
	}
	setFont(fontFace) {
		this.#fontFace = fontFace;
		this.#textUILabel.setFont(fontFace);
		this.#placeholderUILabel.setFont(fontFace);
	}
	setPadding(padding) { this.#padding = padding; }

	setBackgroundColor(color) { this.#bgPaint.setColor(color); }
	setRoundSize(roundSize) {
		this.#bgRoundSize = roundSize;
		this.#bgPaint.setRoundSize(roundSize);
	}
	setTextColor(color) {
		this.#textColor = color;
		this.#textUILabel.setTextColor(color);
	}
	setPlaceholderColor(color) {
		this.#placeholderColor = color;
		this.#placeholderUILabel.setTextColor(color);
	}
	setCursorColor(color) {
		this.#cursorColor = color;
		this.#compositionUnderlineColor = color;
	}
	setFocusBorderColor(color) { this.#focusBorderColor = color; }
	setFocusBorderWidth(width) { this.#focusBorderWidth = width; }
	setSelectionColor(color) { this.#selectionColor = color; }

	setOnChange(callback) { this.#onChangeCallback = callback; }
	setOnSubmit(callback) { this.#onSubmitCallback = callback; }

	//==============================================================================
	// 렌더 상태 스냅샷 (오버레이/배경 렌더러가 읽음).
	//==============================================================================
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
	blur() {
		if (this.#useDOMInput && this.#domInput) this.#domInput.blur();
		else this.handleBlur();
	}
	isFocused() { return this.#focused; }

	selectAll() {
		this.#selectionStart = 0;
		this.#cursorIndex = this.#value.length;
		if (this.#domInput) this.#domInput.setSelectionRange(0, this.#value.length);
	}

	//==============================================================================
	// 매 프레임: 라벨 위치 / 텍스트 동기, DOM 위치 동기, 커서 깜빡임, selection 폴링.
	//==============================================================================
	tick(timeDelta) {
		super.tick(timeDelta);
		this.refreshLabelPositions();
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
	touchPress(viewInputPosition) {
		this.focus();
		this.hideContextMenu();
		const localX = viewInputPosition.x - this.getPosition().x;
		const index = this.measureIndexAtLocalX(localX);
		this.#dragStartIndex = index;
		this.#cursorIndex = index;
		this.#selectionStart = index;
		if (this.#domInput) this.#domInput.setSelectionRange(index, index);
		this.#blinkTimer = 0;
		this.#cursorVisible = true;
	}
	touchMove(viewInputPosition) {
		if (this.#dragStartIndex < 0) return;
		const localX = viewInputPosition.x - this.getPosition().x;
		const index = this.measureIndexAtLocalX(localX);
		// 앵커 = 처음 누른 지점, 커서 = 지금 마우스 위치. (좌/우 어느 쪽으로 드래그해도
		// 커서가 마우스를 따라간다.) DOM API 는 start ≤ end 를 요구하므로 변환.
		this.#selectionStart = this.#dragStartIndex;
		this.#cursorIndex = index;
		if (this.#domInput) {
			const selStart = System.Math.min(this.#dragStartIndex, index);
			const selEnd = System.Math.max(this.#dragStartIndex, index);
			this.#domInput.setSelectionRange(selStart, selEnd);
		}
		this.#blinkTimer = 0;
		this.#cursorVisible = true;
	}
	touchRelease() { this.#dragStartIndex = -1; }
	touchCancel() { this.#dragStartIndex = -1; }

	//==============================================================================
	// localX(노드 로컬 X) → 문자 인덱스. 측정은 엔진 메인 캔버스 ctx 로
	//   (실 렌더와 동일 폰트 보장).
	//==============================================================================
	measureIndexAtLocalX(localX) {
		const value = this.#value;
		if (value.length === 0) return 0;
		const ctx = this.getMeasureContext();
		if (!ctx) return value.length;
		ctx.save();
		const fontFamily = this.#fontFace ? this.#fontFace.family : SYSTEM_FONT_STRING;
		ctx.font = `${this.#fontSize}px ${fontFamily}`;
		const targetX = localX - this.#padding;
		if (targetX <= 0) {
			ctx.restore();
			return 0;
		}
		let prevWidth = 0;
		let result = value.length;
		for (let i = 1; i <= value.length; ++i) {
			const width = ctx.measureText(value.slice(0, i)).width;
			if (width >= targetX) {
				result = (targetX - prevWidth) < (width - targetX) ? (i - 1) : i;
				break;
			}
			prevWidth = width;
		}
		ctx.restore();
		return result;
	}

	getMeasureContext() {
		if (this.#engine) {
			const canvas = this.#engine.getViewManager().getCanvas();
			if (canvas) return canvas.getContext("2d");
		}
		return getOffscreenMeasureContext();
	}

	//==============================================================================
	// 라벨(UILabel) 갱신.
	// - 값이 비어있으면 textLabel 숨김 + placeholder 표시.
	// - 조합 중이면 (value + composition) 을 textLabel 에 합성 표시.
	//==============================================================================
	refreshLabels() {
		const hasValue = this.#value.length > 0 || this.#composition.length > 0;
		this.#placeholderLabelNode.setActive(!hasValue);
		this.#textLabelNode.setActive(hasValue);
		if (hasValue) {
			const before = this.#value.slice(0, this.#cursorIndex);
			const after = this.#value.slice(this.#cursorIndex);
			this.#textUILabel.setText(before + this.#composition + after);
		}
		this.#placeholderUILabel.setText(this.#placeholder);
	}

	refreshLabelPositions() {
		const size = this.getContentSize();
		if (size.x <= 0 || size.y <= 0) return;
		const inner = Vector2.create(System.Math.max(0, size.x - this.#padding * 2), size.y);
		this.#textLabelNode.setLocalPosition(Vector2.create(this.#padding, 0));
		this.#textLabelNode.setContentSize(inner);
		this.#placeholderLabelNode.setLocalPosition(Vector2.create(this.#padding, 0));
		this.#placeholderLabelNode.setContentSize(inner);
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
			this.refreshLabels();
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
	}

	detachDOMInput() {
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

	layoutDOMInput() {
		if (!this.#domInput || !this.#engine) return;
		const viewManager = this.#engine.getViewManager();
		const canvas = viewManager.getCanvas();
		if (!canvas) return;
		const canvasRect = canvas.getBoundingClientRect();
		const targetScale = viewManager.getTargetResolutionScale() || 1;

		const globalPos = this.getPosition();
		const contentSize = this.getContentSize();
		this.#domInput.style.left = `${canvasRect.left + globalPos.x * targetScale}px`;
		this.#domInput.style.top = `${canvasRect.top + globalPos.y * targetScale}px`;
		this.#domInput.style.width = `${contentSize.x * targetScale}px`;
		this.#domInput.style.height = `${contentSize.y * targetScale}px`;
	}

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
		this.refreshLabels();
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
	detachCanvasKeyboard() {
		if (!this.#canvasKeydownHandler) return;
		System.document.removeEventListener("keydown", this.#canvasKeydownHandler);
		this.#canvasKeydownHandler = null;
	}
	handleCanvasKeydown(event) {
		if (!this.#focused) return;
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
			if (this.hasSelection()) this.replaceSelection("");
			else if (this.#cursorIndex > 0) this.deleteCharAt(this.#cursorIndex - 1);
		}
		else if (event.key === "Delete") {
			event.preventDefault();
			if (this.hasSelection()) this.replaceSelection("");
			else if (this.#cursorIndex < this.#value.length) this.deleteCharAt(this.#cursorIndex);
		}
		else if (event.key === "ArrowLeft") {
			event.preventDefault();
			this.moveCursor(this.#cursorIndex - 1, event.shiftKey);
		}
		else if (event.key === "ArrowRight") {
			event.preventDefault();
			this.moveCursor(this.#cursorIndex + 1, event.shiftKey);
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
	moveCursor(newIndex, extendSelection) {
		const clamped = System.Math.max(0, System.Math.min(this.#value.length, newIndex));
		this.#cursorIndex = clamped;
		if (!extendSelection) this.#selectionStart = clamped;
		this.refreshLabels();
	}
	deleteCharAt(index) {
		this.#value = this.#value.slice(0, index) + this.#value.slice(index + 1);
		if (this.#cursorIndex > index) this.#cursorIndex -= 1;
		this.#selectionStart = this.#cursorIndex;
		this.refreshLabels();
		if (this.#onChangeCallback) this.#onChangeCallback(this.#value);
	}

	//==============================================================================
	// 포커스 / 블러 핸들러 (DOM/캔버스 모드 공용).
	//==============================================================================
	handleFocus() {
		this.#focused = true;
		this.#blinkTimer = 0;
		this.#cursorVisible = true;
	}
	handleBlur() {
		this.#focused = false;
		this.hideContextMenu();
	}

	//==============================================================================
	// 선택 / 클립보드.
	//==============================================================================
	hasSelection() { return this.#cursorIndex !== this.#selectionStart; }
	getSelectionRange() {
		if (!this.hasSelection()) return null;
		return {
			start: System.Math.min(this.#cursorIndex, this.#selectionStart),
			end: System.Math.max(this.#cursorIndex, this.#selectionStart),
		};
	}
	getSelectionText() {
		const range = this.getSelectionRange();
		if (!range) return "";
		return this.#value.slice(range.start, range.end);
	}
	replaceSelection(text) {
		const range = this.getSelectionRange() || { start: this.#cursorIndex, end: this.#cursorIndex };
		let next = this.#value.slice(0, range.start) + text + this.#value.slice(range.end);
		if (this.#maxLength > 0 && next.length > this.#maxLength) next = next.slice(0, this.#maxLength);
		this.#value = next;
		this.#cursorIndex = range.start + text.length;
		this.#selectionStart = this.#cursorIndex;
		if (this.#domInput) {
			this.#domInput.value = this.#value;
			this.#domInput.setSelectionRange(this.#cursorIndex, this.#cursorIndex);
		}
		this.refreshLabels();
		if (this.#onChangeCallback) this.#onChangeCallback(this.#value);
	}

	cut() {
		if (!this.hasSelection()) return;
		const text = this.getSelectionText();
		this.writeClipboard(text);
		this.replaceSelection("");
	}
	copy() {
		if (!this.hasSelection()) return;
		this.writeClipboard(this.getSelectionText());
	}
	paste() {
		this.readClipboard().then((text) => {
			if (typeof text === "string" && text.length > 0) {
				this.replaceSelection(text);
			}
		}).catch(() => { /* 무시 */ });
	}
	writeClipboard(text) {
		try {
			if (System.navigator && System.navigator.clipboard) {
				System.navigator.clipboard.writeText(text).catch(() => {});
			}
		}
		catch (error) { /* 무시 */ }
	}
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
	detachContextMenuHandler() {
		if (!this.#contextMenuHandler || !this.#engine) return;
		const canvas = this.#engine.getViewManager().getCanvas();
		if (canvas) canvas.removeEventListener("contextmenu", this.#contextMenuHandler);
		this.#contextMenuHandler = null;
	}
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
	showContextMenu(clientX, clientY) {
		this.hideContextMenu();
		const doc = System.document;
		const menu = doc.createElement("div");
		menu.style.position = "absolute";
		menu.style.left = `${clientX}px`;
		menu.style.top = `${clientY}px`;
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
			{ label: "잘라내기", enabled: hasSel,  action: () => this.cut() },
			{ label: "복사",     enabled: hasSel,  action: () => this.copy() },
			{ label: "붙여넣기", enabled: true,    action: () => this.paste() },
		];
		for (const item of items) {
			const button = doc.createElement("div");
			button.textContent = item.label;
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
	constructor() {
		super();
		this.setComponentType("UIInputFieldBgLayer");
	}
	draw(graphic) {
		const node = this.getNode();
		if (!node || typeof node.getRenderState !== "function") return;
		const state = node.getRenderState();
		const contentSize = node.getContentSize();
		if (contentSize.x <= 0 || contentSize.y <= 0) return;
		// 선택 영역 (조합 중엔 표시 안 함).
		if (state.composition.length === 0 && state.selectionStart !== state.cursorIndex) {
			const ctx = graphic.getCanvasRenderingContext();
			ctx.save();
			const fontFamily = state.fontFace ? state.fontFace.family : SYSTEM_FONT_STRING;
			ctx.font = `${state.fontSize}px ${fontFamily}`;
			const selStart = System.Math.min(state.selectionStart, state.cursorIndex);
			const selEnd = System.Math.max(state.selectionStart, state.cursorIndex);
			const startX = state.padding + ctx.measureText(state.value.slice(0, selStart)).width;
			const endX = state.padding + ctx.measureText(state.value.slice(0, selEnd)).width;
			const halfH = state.fontSize * 0.65;
			const drawY = contentSize.y * 0.5;
			ctx.fillStyle = state.selectionColor.toHEXString();
			ctx.fillRect(startX, drawY - halfH, endX - startX, halfH * 2);
			ctx.restore();
		}
	}
}


//==============================================================================
// 텍스트 위에 그려지는 레이어 (조합문자 밑줄 + 커서 + 포커스 테두리).
// - UIInputField 의 자식 노드에 부착되어 텍스트 라벨보다 늦게 그려진다.
//==============================================================================
class OverlayLayerRenderer extends Component {
	constructor() {
		super();
		this.setComponentType("UIInputFieldOverlayLayer");
	}
	draw(graphic) {
		const node = this.getNode();
		if (!node) return;
		const parent = typeof node.getParent === "function" ? node.getParent() : null;
		if (!parent || typeof parent.getRenderState !== "function") return;
		const state = parent.getRenderState();
		const contentSize = node.getContentSize();
		if (contentSize.x <= 0 || contentSize.y <= 0) return;

		const ctx = graphic.getCanvasRenderingContext();
		ctx.save();
		const fontFamily = state.fontFace ? state.fontFace.family : SYSTEM_FONT_STRING;
		ctx.font = `${state.fontSize}px ${fontFamily}`;
		const drawY = contentSize.y * 0.5;
		const padding = state.padding;
		const before = state.value.slice(0, state.cursorIndex);

		// 조합 중 밑줄.
		if (state.composition.length > 0) {
			const beforeWidth = ctx.measureText(before).width;
			const compWidth = ctx.measureText(state.composition).width;
			const underlineY = drawY + state.fontSize * 0.55;
			ctx.strokeStyle = state.compositionUnderlineColor.toHEXString();
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(padding + beforeWidth, underlineY);
			ctx.lineTo(padding + beforeWidth + compWidth, underlineY);
			ctx.stroke();
		}

		// 커서.
		if (state.focused && state.cursorVisible) {
			const cursorBeforeText = before + state.composition;
			const cursorX = padding + ctx.measureText(cursorBeforeText).width;
			const halfHeight = state.fontSize * 0.6;
			ctx.strokeStyle = state.cursorColor.toHEXString();
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(cursorX, drawY - halfHeight);
			ctx.lineTo(cursorX, drawY + halfHeight);
			ctx.stroke();
		}

		// 포커스 테두리.
		if (state.focused && state.focusBorderWidth > 0) {
			const w = state.focusBorderWidth;
			const inset = w * 0.5;
			ctx.strokeStyle = state.focusBorderColor.toHEXString();
			ctx.lineWidth = w;
			const x = inset;
			const y = inset;
			const rectW = contentSize.x - w;
			const rectH = contentSize.y - w;
			const radius = System.Math.max(0, state.bgRoundSize - inset);
			ctx.beginPath();
			if (typeof ctx.roundRect === "function") {
				ctx.roundRect(x, y, rectW, rectH, radius);
			}
			else {
				ctx.rect(x, y, rectW, rectH);
			}
			ctx.stroke();
		}

		ctx.restore();
	}
}


//==============================================================================
// 측정용 오프스크린 캔버스 ctx (엔진 미주입 폴백).
//==============================================================================
let offscreenMeasureCanvas = null;
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
