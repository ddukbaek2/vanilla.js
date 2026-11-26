//==============================================================================
// 포함 모듈 목록.
//==============================================================================
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
// - Engine.alert, Engine.confirm, Engine.prompt 가 브라우저 window.alert, confirm, prompt 를 부르고 돌려준다. (러스트 판 Engine::alert, confirm, prompt 와 같다)
// - 브라우저가 창을 띄우고 답할 때까지 페이지를 멈춘 뒤 돌려준 값을 손잡이에 넣는다. (그 자리에서 끝난다, 러스트 웹 판과 같다)
//   러스트 데스크탑 판은 엔진이 창을 그려 답할 때 끝난다. 두 엔진 모두 끝난 뒤 부를 함수는 setCallback 으로 건다.
// - await 하는 꼴은 Engine.alertAsync, confirmAsync, promptAsync 다.
// - 브라우저 함수가 없는 곳(node)에서는 alert 는 확인, confirm 과 prompt 는 취소로 끝난다.
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
// 브라우저 질문 창 띄우기. (끝난 손잡이를 돌려준다)
//==============================================================================
/**
 * @param { string } kind ModalDialogKind 의 값.
 * @param { string } message 물을 글.
 * @param { string } defaultValue prompt 입력 칸의 기본값.
 * @returns { ModalDialogHandle } 끝난 손잡이.
 */
export function showBrowserDialog(kind, message, defaultValue) {
	if (kind === ModalDialogKind.alert) {
		if (typeof System.alert === "function") {
			System.alert(message);
		}
		return ModalDialogHandle.createFinished(ModalDialogResult.confirmed(""));
	}
	if (kind === ModalDialogKind.confirm) {
		const isConfirmed = typeof System.confirm === "function" && System.confirm(message) === true;
		return ModalDialogHandle.createFinished(isConfirmed ? ModalDialogResult.confirmed("") : ModalDialogResult.cancelled());
	}
	const text = typeof System.prompt === "function" ? System.prompt(message, defaultValue) : null;
	return ModalDialogHandle.createFinished(text === null || text === undefined ? ModalDialogResult.cancelled() : ModalDialogResult.confirmed(text));
}
