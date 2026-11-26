//==============================================================================
// 모달 질문 창. (게임이 부르던 브라우저 window.alert, window.confirm, window.prompt 자리, 러스트 판 core/modaldialog.rs 와 같다)
// - 엔진이 캔버스 위에 크롬 탭 모달 대화 상자(JavaScriptTabModalDialogViewViews)와 같은 질문 창을 그린다. (브라우저 창을 띄우지 않는다)
//   - 자리: 캔버스 안쪽 가로 가운데, 위 끝. 제목은 "이 페이지 내용:" (브라우저 화면 언어, core/browseruitext.js) 닫기 X 는 없다.
//   - alert 는 확인만, confirm 과 prompt 는 확인과 취소. 기본 단추는 확인이다. 단추 차례는 크롬처럼 윈도우 `[확인][취소]`, 그 밖 `[취소][확인]`.
//   - prompt 입력 칸은 기본값을 넣고 모두 고른 채로 초점을 받는다. Enter 는 확인, Escape 는 취소.
//   - 떠 있는 동안 씬을 갱신하지 않고(그리기는 멈춘 화면 그대로), 키보드 초점은 창이 가진다. 닫히면 눌린 키와 단추를 비우고 초점을 돌려준다.
//   - 입력 칸 글은 숨긴 DOM 입력이 받는다(IME, 편집 키, 되돌리기). 누르고 끌어 커서와 선택을 정한다.
//   - 여러 개를 한 프레임에 부르면 차례로 띄운다.
// - 그림자는 크롬 bubble_border 의 두 겹(아래로 2, 흐림 8 과 12)을 views 시그마의 가우스로 구워 그린다. (core/blurshadow.js)
//==============================================================================


//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Rect } from "../base/rect.js";
import { Vector2 } from "../base/vector2.js";
import { Color } from "../base/color.js";
import { PlatformType, SYSTEM_FONT_STRING } from "../base/platform.js";
import { BlurredRoundRectShadow, viewsShadowBlurToSigma } from "./blurshadow.js";
import { BrowserUiText, readBrowserUiText } from "./browseruitext.js";
const System = globalThis;


//==============================================================================
// 질문 창 종류. (window.alert, window.confirm, window.prompt)
//==============================================================================
/** @enum { string } */
export const ModalDialogKind = System.Object.freeze({
	alert: "alert", // 알림 창. (확인만 있다)
	confirm: "confirm", // 확인 창. (확인과 취소)
	prompt: "prompt", // 입력 창. (입력 칸과 확인과 취소)
});


//==============================================================================
// 질문 창의 답. (러스트 판 ModalDialogResult 의 Confirmed(글), Cancelled)
//==============================================================================
/**
 * @example <caption>확인한 답과 취소한 답 읽기</caption>
 * import { ModalDialogResult } from "./build/vanilla.js";
 *
 * const confirmed = ModalDialogResult.confirmed("hello");
 * const cancelled = ModalDialogResult.cancelled();
 * console.log(confirmed.isConfirmed(), confirmed.getText(), cancelled.isConfirmed());
 */
export class ModalDialogResult {
	/** @private @type { boolean } */ #isConfirmed; // 확인했는지.
	/** @private @type { string } */ #text; // 확인한 글. (prompt 는 입력한 글, alert 와 confirm 은 빈 글)

	//==============================================================================
	// 생성. (confirmed, cancelled 로 만든다)
	//==============================================================================
	/**
	 * @param { boolean } isConfirmed 확인했으면 참.
	 * @param { string } text 확인한 글.
	 */
	constructor(isConfirmed, text) {
		this.#isConfirmed = isConfirmed;
		this.#text = text;
	}

	//==============================================================================
	// 확인한 답.
	//==============================================================================
	/**
	 * @param { string } text 확인한 글. (prompt 는 입력한 글, alert 와 confirm 은 빈 글)
	 * @returns { ModalDialogResult } 확인한 답.
	 */
	static confirmed(text) {
		return new ModalDialogResult(true, text);
	}

	//==============================================================================
	// 취소한 답. (prompt 의 null, confirm 의 false)
	//==============================================================================
	/**
	 * @returns { ModalDialogResult } 취소한 답.
	 */
	static cancelled() {
		return new ModalDialogResult(false, "");
	}

	//==============================================================================
	// 확인했는지 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 확인했으면 참.
	 */
	isConfirmed() {
		return this.#isConfirmed;
	}

	//==============================================================================
	// 확인한 글 반환.
	//==============================================================================
	/**
	 * @returns { string } 확인한 글. (취소했으면 빈 글)
	 */
	getText() {
		return this.#text;
	}
}


//==============================================================================
// 질문 창 손잡이. (러스트 판 ModalDialogHandle)
// - 답하면 끝나고(isFinished), 답은 getResult, isConfirmed, getPromptText 로 읽는다.
// - Engine.alert, Engine.confirm, Engine.prompt 가 엔진이 그린 질문 창을 띄우고 돌려준다. (러스트 판 Engine::alert, confirm, prompt 와 같다)
// - 창에 답하면 끝난다. 두 엔진 모두 끝난 뒤 부를 함수는 setCallback 으로 건다.
// - await 하는 꼴은 Engine.alertAsync, confirmAsync, promptAsync 다.
// - 캔버스가 없는 곳(node)에서는 그 자리에서 alert 는 확인, confirm 과 prompt 는 취소로 끝난다.
//==============================================================================
/**
 * @example <caption>단추를 누르면 확인 창을 띄우고 답에 따라 지우기 (await 꼴과 손잡이 꼴)</caption>
 * import { Engine, EngineConfiguration } from "./build/vanilla.js";
 * const engine = new Engine(new EngineConfiguration());
 * async function deleteSaveData() {
 * 	if (await engine.confirmAsync("Delete the save data?")) {
 * 		console.log("deleted");
 * 	}
 * }
 * function askName() {
 * 	engine.prompt("Name?", "Hero").setCallback((result) => {
 * 		console.log(result.isConfirmed() ? result.getText() : "cancelled");
 * 	});
 * }
 * console.log(typeof deleteSaveData, typeof askName, engine.isModalDialogOpen()); // function function false
 */
export class ModalDialogHandle {
	/** @private @type { ModalDialogResult | null } */ #result; // 답. (끝나기 전이면 null)
	/** @private @type { Function | null } */ #callback; // 끝난 뒤 부를 함수.

	//==============================================================================
	// 생성. (답을 기다리는 손잡이)
	//==============================================================================
	constructor() {
		this.#result = null;
		this.#callback = null;
	}

	//==============================================================================
	// 끝난 손잡이 만들기.
	//==============================================================================
	/**
	 * @private
	 * @param { ModalDialogResult } result 답.
	 * @returns { ModalDialogHandle } 끝난 손잡이.
	 */
	static createFinished(result) {
		const modalDialogHandle = new ModalDialogHandle();
		modalDialogHandle.finish(result);
		return modalDialogHandle;
	}

	//==============================================================================
	// 답 넣기. (끝난 뒤 부를 함수가 있으면 부른다, 두 번째부터는 무시)
	//==============================================================================
	/**
	 * @private
	 * @param { ModalDialogResult } result 답.
	 */
	finish(result) {
		if (this.#result !== null) {
			return;
		}
		this.#result = result;
		const callback = this.#callback;
		this.#callback = null;
		if (callback) {
			callback(result);
		}
	}

	//==============================================================================
	// 끝났는지 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 답했으면 참.
	 */
	isFinished() {
		return this.#result !== null;
	}

	//==============================================================================
	// 답 반환.
	//==============================================================================
	/**
	 * @returns { ModalDialogResult | null } 답. (끝나기 전이면 null)
	 */
	getResult() {
		return this.#result;
	}

	//==============================================================================
	// 확인했는지 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 끝났고 확인했으면 참.
	 */
	isConfirmed() {
		return this.#result !== null && this.#result.isConfirmed();
	}

	//==============================================================================
	// 입력한 글 반환. (prompt)
	//==============================================================================
	/**
	 * @returns { string | null } 확인한 글. (끝나기 전이거나 취소했으면 null)
	 */
	getPromptText() {
		if (this.#result === null || !this.#result.isConfirmed()) {
			return null;
		}
		return this.#result.getText();
	}

	//==============================================================================
	// 끝난 뒤 부를 함수 걸기. (이미 끝났으면 그 자리에서 부른다)
	//==============================================================================
	/**
	 * @param { Function } callback (result: ModalDialogResult) => void
	 */
	setCallback(callback) {
		if (this.#result !== null) {
			callback(this.#result);
			return;
		}
		this.#callback = callback;
	}
}


//==============================================================================
// 질문 창 모양. (러스트 판 desktop_dialog 와 같은 크롬 main 의 값)
// - MessageBoxView 폭 400, 안쪽 20, 제목 500 16px 줄 24, 본문 13px 줄 20, 제목과 본문 사이 8, 본문과 입력 칸 사이 8,
//   아래 여백 입력 칸이 있으면 24 없으면 16, 단추 사이 8, 단추 최소 폭 64 안쪽 16 글 500 13px 알약 꼴, 입력 칸 안쪽 10 모서리 8, 대화 상자 모서리 12.
//==============================================================================
const DEFAULT_PROMPT_MAXIMUM_LENGTH = 2000; // 크롬 prompt 기본값의 최대 길이. (kDefaultPromptMaxSize)
const MESSAGE_MAXIMUM_ROW_COUNT = 24; // 묻는 글의 최대 줄 수. (kMessageTextMaxRows)
const MESSAGE_MAXIMUM_COLUMN_COUNT = 80; // 묻는 글의 줄 글자 수. (kMessageTextMaxCols)
const CURSOR_BLINK_SECONDS = 0.5;
const DIALOG_WIDTH = 400;
const DIALOG_MARGIN = 8;
const DIALOG_PADDING_TOP = 20;
const DIALOG_PADDING_SIDE = 20;
const DIALOG_PADDING_BOTTOM = 20;
const DIALOG_CORNER_RADIUS = 12;
const TITLE_FONT_STRING = `500 16px ${SYSTEM_FONT_STRING}`;
const TITLE_LINE_HEIGHT = 24;
const MESSAGE_FONT_STRING = `13px ${SYSTEM_FONT_STRING}`;
const FIELD_FONT_STRING = `13px ${SYSTEM_FONT_STRING}`;
const MESSAGE_LINE_HEIGHT = 20;
const TITLE_MESSAGE_GAP = 8;
const MESSAGE_FIELD_GAP = 8;
const CONTENT_BOTTOM_WITH_FIELD = 24;
const CONTENT_BOTTOM_WITHOUT_FIELD = 16;
const FIELD_HEIGHT = 36;
const FIELD_PADDING_X = 10;
const FIELD_CORNER_RADIUS = 8;
const BUTTON_HEIGHT = 36;
const BUTTON_MINIMUM_WIDTH = 64;
const BUTTON_PADDING_X = 16;
const BUTTON_GAP = 8;
const BUTTON_FONT_STRING = `500 13px ${SYSTEM_FONT_STRING}`;
const COLOR_DIALOG_BACKGROUND = "#ffffff";
const COLOR_DIALOG_BORDER = "#e1e3e1";
const COLOR_TITLE = "#1f1f1f";
const COLOR_MESSAGE = "#1f1f1f";
const COLOR_FOCUS_RING = "#0b57d0";
const COLOR_SELECTION = "#d3e3fd";
const COLOR_PRIMARY_BUTTON = "#0b57d0";
const COLOR_PRIMARY_BUTTON_TEXT = "#ffffff";
const COLOR_SECONDARY_BUTTON_BORDER = "#a8c7fa";
const COLOR_SECONDARY_BUTTON_TEXT = "#0b57d0";
const COLOR_BUTTON_HOVER = new Color(0, 0, 0, 0.08);
// 그림자. (bubble_border.cc 의 두 겹: 아래로 2, 흐림 8 과 12, kGoogleGrey800 #3C4043 의 알파 0x33 과 0x1A. 맥은 운영체제가 그려 테두리가 없다)
const SHADOW_LAYER_LIST = [[8, 0x33], [12, 0x1A]];
const SHADOW_OFFSET_Y = 2;
// 단추.
const DialogButton = System.Object.freeze({
	ok: "ok",
	cancel: "cancel",
});


//==============================================================================
// 묻는 글 자르기. (줄 수와 줄 글자 수)
//==============================================================================
function limitMessage(message) {
	return System.String(message).split("\n").slice(0, MESSAGE_MAXIMUM_ROW_COUNT).map((line) => System.Array.from(line).slice(0, MESSAGE_MAXIMUM_COLUMN_COUNT).join("")).join("\n");
}


//==============================================================================
// 글을 폭에 맞춰 줄로 나누기. (공백에서 나누고, 공백 없이 넘치면 글자에서 나눈다. 줄바꿈 문자는 지킨다, 러스트 판 wrap_lines)
//==============================================================================
function wrapLines(graphic, fontString, text, maximumWidth) {
	graphic.setFontString(fontString);
	const measure = (line) => graphic.measureText(line.trimEnd()).width;
	const lineList = [];
	for (const paragraph of text.split("\n")) {
		let currentLine = "";
		const wordList = paragraph.match(/[^ ]* ?/g).filter((word) => word.length > 0);
		for (const word of wordList) {
			const candidate = currentLine + word;
			if (currentLine.length === 0 || measure(candidate) <= maximumWidth) {
				currentLine = candidate;
				if (measure(currentLine) <= maximumWidth) {
					continue;
				}
			}
			else {
				lineList.push(currentLine.trimEnd());
				currentLine = word;
			}
			// 한 낱말이 폭을 넘으면 글자에서 나눈다.
			let characterLine = "";
			for (const character of currentLine) {
				const characterCandidate = characterLine + character;
				if (characterLine.length > 0 && measure(characterCandidate) > maximumWidth) {
					lineList.push(characterLine);
					characterLine = character;
				}
				else {
					characterLine = characterCandidate;
				}
			}
			currentLine = characterLine;
		}
		lineList.push(currentLine.trimEnd());
	}
	return lineList;
}


//==============================================================================
// 점이 사각형 안에 있는지.
//==============================================================================
function isInside(rect, position) {
	return position.x >= rect.left && position.x < rect.left + rect.width && position.y >= rect.top && position.y < rect.top + rect.height;
}


//==============================================================================
// 단추 글. (브라우저 화면 언어의 확인, 취소)
//==============================================================================
function readButtonText(button) {
	return readBrowserUiText(button === DialogButton.ok ? BrowserUiText.ok : BrowserUiText.cancel);
}


//==============================================================================
// 떠 있는 질문 창 하나. (러스트 판 ModalDialog, 엔진이 목록으로 들고 맨 앞을 갱신하고 그린다)
//==============================================================================
export class ModalDialog {
	/** @private @type { string } */ #kind; // 종류. (ModalDialogKind)
	/** @private @type { string } */ #message; // 묻는 글. (줄 수와 줄 글자 수를 자른 것)
	/** @private @type { ModalDialogHandle } */ #handle; // 답을 넣을 손잡이.
	/** @private @type { string } */ #platformName; // 단추 차례와 테두리를 정할 플랫폼 이름. (PlatformType)
	/** @private @type { HTMLInputElement | null } */ #inputElement; // 글과 키를 받는 숨긴 DOM 입력.
	/** @private @type { Element | null } */ #previousFocusElement; // 띄우기 전 초점을 가진 요소. (닫으면 돌려준다)
	/** @private @type { Function | null } */ #mouseDownHandler; // 떠 있는 동안 문서의 mousedown 기본 동작(초점 옮기기)을 막는 손잡이.
	/** @private @type { boolean | null } */ #keyAnswer; // Enter, Escape 로 정한 답. (없으면 null)
	/** @private @type { string } */ #compositionText; // 조합 중인 글.
	/** @private @type { object | null } */ #layout; // 마지막으로 셈한 자리.
	/** @private @type { string | null } */ #pressedButton; // 누른 단추.
	/** @private @type { string | null } */ #hoveredButton; // 마우스 아래 단추.
	/** @private @type { number } */ #dragStartIndex; // 입력 칸을 끌기 시작한 글자 자리. (없으면 -1)
	/** @private @type { number } */ #textScrollX; // 입력 칸 글의 가로 밀림. (커서가 보이게)
	/** @private @type { number } */ #blinkTimer; // 커서 깜빡임 시간.
	/** @private @type { boolean } */ #isCursorVisible; // 커서가 보이는지.
	/** @private @type { BlurredRoundRectShadow[] } */ #shadowList; // 그림자 두 겹의 구운 그림.

	//==============================================================================
	// 생성. (prompt 는 기본값을 넣고 모두 고른다. 크롬처럼 커서는 글 맨 앞 쪽에 둔다)
	//==============================================================================
	/**
	 * @param { string } kind 종류. (ModalDialogKind 의 값)
	 * @param { string } message 묻는 글.
	 * @param { string } defaultValue prompt 입력 칸의 기본값.
	 * @param { ModalDialogHandle } handle 답을 넣을 손잡이.
	 * @param { string } platformName 플랫폼 이름. (PlatformType 의 값, 윈도우면 확인이 앞)
	 */
	constructor(kind, message, defaultValue, handle, platformName) {
		this.#kind = kind;
		this.#message = limitMessage(message);
		this.#handle = handle;
		this.#platformName = platformName;
		this.#inputElement = null;
		this.#previousFocusElement = null;
		this.#mouseDownHandler = null;
		this.#keyAnswer = null;
		this.#compositionText = "";
		this.#layout = null;
		this.#pressedButton = null;
		this.#hoveredButton = null;
		this.#dragStartIndex = -1;
		this.#textScrollX = 0;
		this.#blinkTimer = 0;
		this.#isCursorVisible = true;
		this.#shadowList = [new BlurredRoundRectShadow(), new BlurredRoundRectShadow()];
		this.#defaultValue = kind === ModalDialogKind.prompt ? System.Array.from(System.String(defaultValue)).slice(0, DEFAULT_PROMPT_MAXIMUM_LENGTH).join("") : "";
	}
	/** @private @type { string } */ #defaultValue; // prompt 기본값.

	//==============================================================================
	// 단추 목록. (크롬 kIsOkButtonLeading: 윈도우는 확인이 앞, 그 밖은 취소가 앞)
	//==============================================================================
	readButtonList() {
		if (this.#kind === ModalDialogKind.alert) {
			return [DialogButton.ok];
		}
		if (this.#platformName === PlatformType.windows) {
			return [DialogButton.ok, DialogButton.cancel];
		}
		return [DialogButton.cancel, DialogButton.ok];
	}

	//==============================================================================
	// 입력 칸 글. (숨긴 DOM 입력이 없으면 기본값)
	//==============================================================================
	getText() {
		return this.#inputElement ? this.#inputElement.value : this.#defaultValue;
	}

	//==============================================================================
	// 숨긴 DOM 입력 붙이기. (창이 맨 앞이 될 때 한 번, 키보드 초점을 가져온다)
	//==============================================================================
	open() {
		if (this.#inputElement || !System.document || !System.document.body) {
			return;
		}
		const doc = System.document;
		this.#previousFocusElement = doc.activeElement;
		const input = doc.createElement("input");
		input.type = "text";
		input.setAttribute("aria-label", this.#message);
		input.maxLength = DEFAULT_PROMPT_MAXIMUM_LENGTH;
		input.readOnly = this.#kind !== ModalDialogKind.prompt;
		input.style.position = "fixed";
		input.style.left = "0px";
		input.style.top = "0px";
		input.style.width = "1px";
		input.style.height = "1px";
		input.style.opacity = "0";
		input.style.border = "0";
		input.style.padding = "0";
		input.style.zIndex = "-1";
		input.value = this.#defaultValue;
		// 키는 창만 받는다. (페이지의 키 손잡이와 엔진 입력에 넘기지 않는다, 크롬 창이 초점을 가져가 페이지에 키가 가지 않는 것과 같다)
		input.addEventListener("keyup", (event) => { event.stopPropagation(); });
		input.addEventListener("keypress", (event) => { event.stopPropagation(); });
		input.addEventListener("keydown", (event) => {
			event.stopPropagation();
			if (event.isComposing) {
				return;
			}
			if (event.key === "Enter") {
				this.#keyAnswer = true;
				event.preventDefault();
			}
			else if (event.key === "Escape") {
				this.#keyAnswer = false;
				event.preventDefault();
			}
		});
		input.addEventListener("compositionupdate", (event) => { this.#compositionText = event.data || ""; });
		input.addEventListener("compositionend", () => { this.#compositionText = ""; });
		input.addEventListener("input", () => { this.resetCursorBlink(); });
		doc.body.appendChild(input);
		this.#inputElement = input;
		input.focus({ preventScroll: true });
		input.setSelectionRange(0, input.value.length, "backward");
		// 떠 있는 동안 페이지 어디를 눌러도 초점이 창에서 빠지지 않게 한다.
		this.#mouseDownHandler = (event) => { event.preventDefault(); };
		doc.addEventListener("mousedown", this.#mouseDownHandler, true);
	}

	//==============================================================================
	// 숨긴 DOM 입력 떼기. (초점을 띄우기 전 요소에 돌려준다)
	//==============================================================================
	close() {
		const doc = System.document;
		if (this.#mouseDownHandler && doc) {
			doc.removeEventListener("mousedown", this.#mouseDownHandler, true);
			this.#mouseDownHandler = null;
		}
		const input = this.#inputElement;
		if (input) {
			this.#defaultValue = input.value;
			this.#inputElement = null;
			input.blur();
			if (input.parentNode) {
				input.parentNode.removeChild(input);
			}
		}
		const previousFocusElement = this.#previousFocusElement;
		this.#previousFocusElement = null;
		if (previousFocusElement && typeof previousFocusElement.focus === "function" && previousFocusElement !== doc.body) {
			previousFocusElement.focus({ preventScroll: true });
		}
	}

	//==============================================================================
	// 답. (확인이면 prompt 는 입력한 글)
	//==============================================================================
	buildResult(isConfirmed) {
		if (!isConfirmed) {
			return ModalDialogResult.cancelled();
		}
		if (this.#kind === ModalDialogKind.prompt) {
			return ModalDialogResult.confirmed(this.getText());
		}
		return ModalDialogResult.confirmed("");
	}

	//==============================================================================
	// 커서 깜빡임을 처음부터.
	//==============================================================================
	resetCursorBlink() {
		this.#blinkTimer = 0;
		this.#isCursorVisible = true;
	}

	//==============================================================================
	// 입력 칸 안 가로 자리의 글자 자리. (글자 가운데보다 오른쪽이면 다음 자리)
	//==============================================================================
	findCharacterIndexAt(graphic, localX) {
		const text = this.getText();
		graphic.setFontString(FIELD_FONT_STRING);
		let previousWidth = 0;
		let index = 0;
		for (const character of text) {
			const width = graphic.measureText(text.slice(0, index + character.length)).width;
			if (localX < (previousWidth + width) * 0.5) {
				return index;
			}
			previousWidth = width;
			index += character.length;
		}
		return text.length;
	}

	//==============================================================================
	// 자리 셈. (캔버스 안쪽 가로 가운데 위 끝, 폭은 캔버스보다 넓지 않게, 러스트 판 calculate_layout)
	//==============================================================================
	calculateLayout(graphic, canvasNativeSize) {
		const boxWidth = System.Math.min(DIALOG_WIDTH, System.Math.max(canvasNativeSize.x - DIALOG_MARGIN * 2, 160));
		const contentWidth = boxWidth - DIALOG_PADDING_SIDE * 2;
		const titleLineList = wrapLines(graphic, TITLE_FONT_STRING, readBrowserUiText(BrowserUiText.pageSays), contentWidth);
		const messageLineList = this.#message.length === 0 ? [] : wrapLines(graphic, MESSAGE_FONT_STRING, this.#message, contentWidth);
		const boxX = System.Math.max((canvasNativeSize.x - boxWidth) * 0.5, 0);
		const boxY = 0;
		const titleTop = boxY + DIALOG_PADDING_TOP;
		let contentBottom = titleTop + TITLE_LINE_HEIGHT * titleLineList.length + TITLE_MESSAGE_GAP;
		const messageTop = contentBottom;
		if (messageLineList.length > 0) {
			contentBottom = messageTop + MESSAGE_LINE_HEIGHT * messageLineList.length;
		}
		let fieldRect = null;
		if (this.#kind === ModalDialogKind.prompt) {
			fieldRect = Rect.create(boxX + DIALOG_PADDING_SIDE, contentBottom + MESSAGE_FIELD_GAP, contentWidth, FIELD_HEIGHT);
			contentBottom = fieldRect.top + FIELD_HEIGHT + CONTENT_BOTTOM_WITH_FIELD;
		}
		else {
			contentBottom += CONTENT_BOTTOM_WITHOUT_FIELD;
		}
		const buttonTop = contentBottom;
		const buttonRectList = [];
		let buttonRight = boxX + boxWidth - DIALOG_PADDING_SIDE;
		graphic.setFontString(BUTTON_FONT_STRING);
		for (const button of this.readButtonList().reverse()) {
			const textWidth = graphic.measureText(readButtonText(button)).width;
			const buttonWidth = System.Math.max(System.Math.ceil(textWidth + BUTTON_PADDING_X * 2), BUTTON_MINIMUM_WIDTH);
			buttonRectList.unshift([button, Rect.create(buttonRight - buttonWidth, buttonTop, buttonWidth, BUTTON_HEIGHT)]);
			buttonRight -= buttonWidth + BUTTON_GAP;
		}
		const boxHeight = buttonTop + BUTTON_HEIGHT + DIALOG_PADDING_BOTTOM - boxY;
		return { boxRect: Rect.create(boxX, boxY, boxWidth, boxHeight), titleLineList, titleTop, messageLineList, messageTop, fieldRect, buttonRectList };
	}

	//==============================================================================
	// 갱신. (엔진이 프레임마다 씬 대신 부른다, 답이 정해지면 참거짓, 아니면 null, 러스트 판 tick_modal_dialog)
	//==============================================================================
	/**
	 * @param { InputManager } inputManager 입력.
	 * @param { Graphic } graphic 글 폭을 잴 그래픽.
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 * @returns { boolean | null } 답. (확인이면 참, 취소면 거짓, 아직이면 null)
	 */
	tick(inputManager, graphic, timeDelta) {
		this.open();
		let answer = this.#keyAnswer;
		const input = this.#inputElement;
		if (input && System.document.activeElement !== input) {
			input.focus({ preventScroll: true });
		}
		// 누르기. (단추는 눌렀다 그 위에서 떼면, 입력 칸은 눌러 커서를 두고 끌어 고른다)
		const pointerPosition = inputManager.getCanvasNativeInputPosition();
		const layout = this.#layout;
		if (layout) {
			const hovered = layout.buttonRectList.find(([, buttonRect]) => isInside(buttonRect, pointerPosition));
			this.#hoveredButton = hovered ? hovered[0] : null;
			if (inputManager.isTouchPressed()) {
				this.#pressedButton = this.#hoveredButton;
				if (layout.fieldRect && input && isInside(layout.fieldRect, pointerPosition)) {
					const characterIndex = this.findCharacterIndexAt(graphic, pointerPosition.x - layout.fieldRect.left - FIELD_PADDING_X + this.#textScrollX);
					input.setSelectionRange(characterIndex, characterIndex);
					this.#dragStartIndex = characterIndex;
					this.resetCursorBlink();
				}
			}
			else if (inputManager.isTouchDown() && this.#dragStartIndex >= 0 && layout.fieldRect && input) {
				const characterIndex = this.findCharacterIndexAt(graphic, pointerPosition.x - layout.fieldRect.left - FIELD_PADDING_X + this.#textScrollX);
				const startIndex = System.Math.min(this.#dragStartIndex, characterIndex);
				const endIndex = System.Math.max(this.#dragStartIndex, characterIndex);
				input.setSelectionRange(startIndex, endIndex, characterIndex < this.#dragStartIndex ? "backward" : "forward");
			}
			if (inputManager.isTouchReleased()) {
				if (this.#pressedButton !== null && this.#pressedButton === this.#hoveredButton) {
					answer = this.#pressedButton === DialogButton.ok;
				}
				this.#pressedButton = null;
				this.#dragStartIndex = -1;
			}
		}
		// 커서 깜빡임.
		this.#blinkTimer += timeDelta;
		if (this.#blinkTimer >= CURSOR_BLINK_SECONDS) {
			this.#blinkTimer = 0;
			this.#isCursorVisible = !this.#isCursorVisible;
		}
		// 숨긴 입력을 입력 칸 자리에 둔다. (IME 후보 창 자리)
		if (input && layout && layout.fieldRect) {
			input.style.left = `${layout.fieldRect.left}px`;
			input.style.top = `${layout.fieldRect.top}px`;
		}
		return answer;
	}

	//==============================================================================
	// 마우스가 단추 위인지.
	//==============================================================================
	isPointerOverButton() {
		return this.#hoveredButton !== null;
	}

	//==============================================================================
	// 그리기. (씬과 개발 정보 위에, 캔버스 안쪽 CSS 픽셀 좌표로, 러스트 판 draw_modal_dialog)
	//==============================================================================
	/**
	 * @param { Graphic } graphic 그래픽. (캔버스 안쪽 CSS 픽셀 좌표를 걸어 둔다)
	 * @param { Vector2 } canvasNativeSize 캔버스 안쪽 크기. (CSS 픽셀)
	 */
	draw(graphic, canvasNativeSize) {
		const layout = this.calculateLayout(graphic, canvasNativeSize);
		graphic.pushState();
		// 그림자와 바탕. (bubble_border.cc 의 두 겹을 views 시그마의 가우스로, 맥 말고는 1px 테두리)
		const boxRect = layout.boxRect;
		for (let shadowIndex = 0; shadowIndex < SHADOW_LAYER_LIST.length; ++shadowIndex) {
			const [shadowBlur, shadowAlpha] = SHADOW_LAYER_LIST[shadowIndex];
			const shadowColor = new Color(60 / 255, 64 / 255, 67 / 255, shadowAlpha / 255);
			this.#shadowList[shadowIndex].draw(graphic, boxRect, DIALOG_CORNER_RADIUS, Vector2.create(0, SHADOW_OFFSET_Y), viewsShadowBlurToSigma(shadowBlur), shadowColor);
		}
		graphic.setFillColor(COLOR_DIALOG_BACKGROUND);
		graphic.drawRoundRect(boxRect, DIALOG_CORNER_RADIUS);
		if (this.#platformName !== PlatformType.macOS) {
			graphic.setStrokeColor(COLOR_DIALOG_BORDER);
			graphic.drawStrokeRoundRect(Rect.create(boxRect.left + 0.5, boxRect.top + 0.5, boxRect.width - 1, boxRect.height - 1), DIALOG_CORNER_RADIUS - 0.5, 1);
		}
		// 제목과 묻는 글.
		const contentX = boxRect.left + DIALOG_PADDING_SIDE;
		graphic.setTextAlign("left");
		graphic.setTextBaseline("middle");
		graphic.setFontString(TITLE_FONT_STRING);
		graphic.setFillColor(COLOR_TITLE);
		layout.titleLineList.forEach((line, lineIndex) => graphic.drawFillText(line, contentX, layout.titleTop + TITLE_LINE_HEIGHT * (lineIndex + 0.5)));
		graphic.setFontString(MESSAGE_FONT_STRING);
		graphic.setFillColor(COLOR_MESSAGE);
		layout.messageLineList.forEach((line, lineIndex) => graphic.drawFillText(line, contentX, layout.messageTop + MESSAGE_LINE_HEIGHT * (lineIndex + 0.5)));
		// 입력 칸. (초점 테두리, 선택, 글, 조합 밑줄, 커서)
		const fieldRect = layout.fieldRect;
		if (fieldRect) {
			graphic.setFillColor(COLOR_DIALOG_BACKGROUND);
			graphic.drawRoundRect(fieldRect, FIELD_CORNER_RADIUS);
			graphic.setStrokeColor(COLOR_FOCUS_RING);
			graphic.drawStrokeRoundRect(Rect.create(fieldRect.left + 1, fieldRect.top + 1, fieldRect.width - 2, fieldRect.height - 2), FIELD_CORNER_RADIUS - 1, 2);
			graphic.setFontString(FIELD_FONT_STRING);
			const text = this.getText();
			const input = this.#inputElement;
			const selectionStart = input ? input.selectionStart : 0;
			const selectionEnd = input ? input.selectionEnd : text.length;
			const cursorIndex = input && input.selectionDirection === "backward" ? selectionStart : selectionEnd;
			const caretWidth = graphic.measureText(text.slice(0, cursorIndex)).width;
			const innerWidth = fieldRect.width - FIELD_PADDING_X * 2;
			if (caretWidth - this.#textScrollX > innerWidth) {
				this.#textScrollX = caretWidth - innerWidth;
			}
			if (caretWidth < this.#textScrollX) {
				this.#textScrollX = caretWidth;
			}
			const textX = fieldRect.left + FIELD_PADDING_X - this.#textScrollX;
			const middleY = fieldRect.top + fieldRect.height * 0.5;
			graphic.beginClipRect(Rect.create(fieldRect.left + 2, fieldRect.top + 2, fieldRect.width - 4, fieldRect.height - 4), 0);
			const isComposing = this.#compositionText.length > 0;
			if (!isComposing && selectionStart !== selectionEnd) {
				const startWidth = graphic.measureText(text.slice(0, selectionStart)).width;
				const endWidth = graphic.measureText(text.slice(0, selectionEnd)).width;
				graphic.setFillColor(COLOR_SELECTION);
				graphic.drawRect(Rect.create(textX + startWidth, middleY - 9, endWidth - startWidth, 18));
			}
			graphic.setFillColor(COLOR_TITLE);
			graphic.drawFillText(text, textX, middleY);
			if (isComposing) {
				const compositionStart = graphic.measureText(text.slice(0, System.Math.max(cursorIndex - this.#compositionText.length, 0))).width;
				graphic.drawRect(Rect.create(textX + compositionStart, middleY + 8, caretWidth - compositionStart, 1));
			}
			if (this.#isCursorVisible && (isComposing || selectionStart === selectionEnd)) {
				graphic.drawRect(Rect.create(textX + caretWidth, middleY - 9, 1, 18));
			}
			graphic.endClipRect();
		}
		// 단추. (기본 단추는 확인)
		graphic.setFontString(BUTTON_FONT_STRING);
		graphic.setTextAlign("center");
		for (const [button, buttonRect] of layout.buttonRectList) {
			const isPrimary = button === DialogButton.ok;
			const cornerRadius = BUTTON_HEIGHT * 0.5;
			if (isPrimary) {
				graphic.setFillColor(COLOR_PRIMARY_BUTTON);
				graphic.drawRoundRect(buttonRect, cornerRadius);
			}
			else {
				graphic.setFillColor(COLOR_DIALOG_BACKGROUND);
				graphic.drawRoundRect(buttonRect, cornerRadius);
				graphic.setStrokeColor(COLOR_SECONDARY_BUTTON_BORDER);
				graphic.drawStrokeRoundRect(Rect.create(buttonRect.left + 0.5, buttonRect.top + 0.5, buttonRect.width - 1, buttonRect.height - 1), cornerRadius - 0.5, 1);
			}
			if (this.#hoveredButton === button) {
				graphic.setFillColor(COLOR_BUTTON_HOVER);
				graphic.drawRoundRect(buttonRect, cornerRadius);
			}
			graphic.setFillColor(isPrimary ? COLOR_PRIMARY_BUTTON_TEXT : COLOR_SECONDARY_BUTTON_TEXT);
			graphic.drawFillText(readButtonText(button), buttonRect.left + buttonRect.width * 0.5, buttonRect.top + buttonRect.height * 0.5);
		}
		graphic.popState();
		this.#layout = layout;
	}

	//==============================================================================
	// 답을 넣는다. (숨긴 입력을 떼고 손잡이를 끝낸다)
	//==============================================================================
	finish(isConfirmed) {
		const result = this.buildResult(isConfirmed);
		this.close();
		this.#handle.finish(result);
	}
}
