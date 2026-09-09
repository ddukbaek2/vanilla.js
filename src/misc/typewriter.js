//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";


//==============================================================================
// 타자기 연출 러너.
// - Text / UILabel 처럼 setVisibleCharacterCount() 를 가진 대상의 글자를
//   초당 지정 속도로 한 자씩 드러낸다. (비주얼노벨 / RPG 대사 연출)
// - 사용:
//     const typewriter = new Typewriter(label, { charactersPerSecond: 30 });
//     typewriter.start("안녕하세요. 모험을 시작합니다.");
//     // 매 프레임: typewriter.tick(timeDelta);
//     // 입력에서: typewriter.isFinished() ? next() : typewriter.skipToEnd();
//==============================================================================
export class Typewriter extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object } */ #target;
	/** @private @type { string } */ #fullText;
	/** @private @type { number } */ #revealedCount;
	/** @private @type { number } */ #charactersPerSecond;
	/** @private @type { number } */ #fastForwardMultiplier;
	/** @private @type { boolean } */ #isFastForward;
	/** @private @type { boolean } */ #isFinished;
	/** @private @type { Function | null } */ #characterRevealedEvent;
	/** @private @type { Function | null } */ #completeEvent;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { object } target setVisibleCharacterCount() 를 가진 대상. (Text / UILabel)
	 * @param { object } options { charactersPerSecond = 30, fastForwardMultiplier = 8 }
	 */
	constructor(target, options = {}) {
		super();

		this.#target = target;
		this.#fullText = "";
		this.#revealedCount = 0;
		this.#charactersPerSecond = (options.charactersPerSecond !== undefined) ? options.charactersPerSecond : 30;
		this.#fastForwardMultiplier = (options.fastForwardMultiplier !== undefined) ? options.fastForwardMultiplier : 8;
		this.#isFastForward = false;
		this.#isFinished = true;
		this.#characterRevealedEvent = null;
		this.#completeEvent = null;
	}

	//==============================================================================
	// 시작.
	// - text 를 넘기면 대상의 setText 도 함께 부른다. 안 넘기면 대상의 현재 글을 쓴다.
	//==============================================================================
	/**
	 * @param { string | null } text
	 */
	start(text = null) {
		if (text !== null && typeof this.#target.setText === "function") {
			this.#target.setText(text);
		}
		this.#fullText = (typeof this.#target.getText === "function") ? this.#target.getText() : (text ? text : "");
		this.#revealedCount = 0;
		this.#isFinished = (this.#fullText.length === 0);
		this.#isFastForward = false;
		this.#target.setVisibleCharacterCount(0);
		if (this.#isFinished) {
			this.#target.setVisibleCharacterCount(-1);
		}
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		if (this.#isFinished) {
			return;
		}
		const speed = this.#charactersPerSecond * (this.#isFastForward ? this.#fastForwardMultiplier : 1);
		const previousWholeCount = System.Math.floor(this.#revealedCount);
		this.#revealedCount = System.Math.min(this.#fullText.length, this.#revealedCount + speed * timeDelta);
		const currentWholeCount = System.Math.floor(this.#revealedCount);
		if (currentWholeCount !== previousWholeCount) {
			this.#target.setVisibleCharacterCount(currentWholeCount);
			if (this.#characterRevealedEvent) {
				for (let index = previousWholeCount; index < currentWholeCount; ++index) {
					this.#characterRevealedEvent(this.#fullText[index], index);
				}
			}
		}
		if (this.#revealedCount >= this.#fullText.length) {
			this.finish();
		}
	}

	//==============================================================================
	// 곧바로 끝까지 드러내기.
	//==============================================================================
	skipToEnd() {
		if (this.#isFinished) {
			return;
		}
		this.#revealedCount = this.#fullText.length;
		this.finish();
	}

	//==============================================================================
	// 완료 처리.
	//==============================================================================
	/**
	 * @private
	 */
	finish() {
		this.#isFinished = true;
		this.#target.setVisibleCharacterCount(-1);
		if (this.#completeEvent) {
			this.#completeEvent();
		}
	}

	//==============================================================================
	// 완료 여부.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isFinished() {
		return this.#isFinished;
	}

	//==============================================================================
	// 빨리 감기 설정. (누르고 있는 동안 등)
	//==============================================================================
	/**
	 * @param { boolean } isFastForward
	 */
	setFastForward(isFastForward) {
		this.#isFastForward = isFastForward;
	}

	//==============================================================================
	// 속도 설정. (초당 글자 수)
	//==============================================================================
	/**
	 * @param { number } charactersPerSecond
	 */
	setCharactersPerSecond(charactersPerSecond) {
		this.#charactersPerSecond = charactersPerSecond;
	}

	//==============================================================================
	// 글자 공개 알림 설정. (character, index) => void
	//==============================================================================
	/**
	 * @param { Function } characterRevealedEvent
	 */
	setCharacterRevealedEvent(characterRevealedEvent) {
		this.#characterRevealedEvent = characterRevealedEvent;
	}

	//==============================================================================
	// 완료 알림 설정.
	//==============================================================================
	/**
	 * @param { Function } completeEvent
	 */
	setCompleteEvent(completeEvent) {
		this.#completeEvent = completeEvent;
	}
}
