//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { splitGraphemes } from "../core/component/text.js";


//==============================================================================
// 타자기 연출 러너.
// - Text / UILabel 처럼 setVisibleCharacterCount() 를 가진 대상의 글자를
//   초당 지정 속도로 한 자씩 드러낸다. (비주얼노벨 / RPG 대사 연출)
// - 사용:
//     const typewriter = new Typewriter(label, { charactersPerSecond: 30 });
//     typewriter.start("안녕하세요. 모험을 시작합니다.");
//     // 매 프레임: typewriter.tick(timeDelta);
//     // 입력에서: typewriter.isFinished() ? next() : typewriter.skipToEnd();
// - 글자는 글자 묶음(받침, 결합 부호, 이모지 묶음을 한 자로) 단위로 센다. 글자 공개 알림은 (글자 묶음, 번호) 를 받는다.
//==============================================================================
/**
 * @example <caption>라벨에 대사를 한 자씩 드러내고 누르면 건너뛰기</caption>
 * import { Engine, EngineConfiguration, Scene, WorldNode, UILabel, Pivot, Vector2, Typewriter } from "./build/vanilla.js";
 *
 * const labelNode = new WorldNode();
 * const label = labelNode.addComponent(UILabel);
 * const typewriter = new Typewriter(label, { charactersPerSecond: 20 });
 *
 * class MainScene extends Scene {
 * 	initialize(engine) {
 * 		super.initialize(engine);
 * 		labelNode.setPivot(Pivot.topLeft);
 * 		labelNode.setLocalPosition(Vector2.create(40, 40));
 * 		labelNode.setContentSize(Vector2.create(560, 40));
 * 		const root = this.getRoot();
 * 		root.addChild(labelNode);
 * 		typewriter.setCompleteEvent(() => {
 * 			console.log("complete");
 * 		});
 * 		typewriter.start("Hello, adventurer. Your journey begins.");
 * 	}
 *
 * 	tick(timeDelta) {
 * 		super.tick(timeDelta);
 * 		typewriter.tick(timeDelta);
 * 	}
 *
 * 	touchPress(viewInputPosition) {
 * 		super.touchPress(viewInputPosition);
 * 		if (!typewriter.isFinished()) {
 * 			typewriter.skipToEnd();
 * 		}
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
export class Typewriter extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object } */ #target;
	/** @private @type { string[] } */ #fullText; // 글자 묶음 목록.
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
		this.#fullText = [];
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
	 * @param { string | null } text 드러낼 글. (null 이면 대상의 지금 글)
	 */
	start(text = null) {
		if (text !== null && typeof this.#target.setText === "function") {
			this.#target.setText(text);
		}
		this.#fullText = splitGraphemes((typeof this.#target.getText === "function") ? this.#target.getText() : (text ? text : ""));
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
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
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
	 * @returns { boolean } 다 드러냈으면 참. (start 전에도 참)
	 */
	isFinished() {
		return this.#isFinished;
	}

	//==============================================================================
	// 빨리 감기 설정. (누르고 있는 동안 등)
	//==============================================================================
	/**
	 * @param { boolean } isFastForward 참이면 fastForwardMultiplier 배로 빨리 드러낸다.
	 */
	setFastForward(isFastForward) {
		this.#isFastForward = isFastForward;
	}

	//==============================================================================
	// 속도 설정. (초당 글자 수)
	//==============================================================================
	/**
	 * @param { number } charactersPerSecond 초당 드러낼 글자 수.
	 */
	setCharactersPerSecond(charactersPerSecond) {
		this.#charactersPerSecond = charactersPerSecond;
	}

	//==============================================================================
	// 글자 공개 알림 설정. (character, index) => void
	//==============================================================================
	/**
	 * @param { Function } characterRevealedEvent 글자 하나가 드러날 때마다 부를 함수. (character, index) => void
	 * @example <caption>글자가 드러날 때마다 알림 받기</caption>
	 * import { Typewriter } from "./build/vanilla.js";
	 *
	 * const target = {
	 * 	text: "",
	 * 	visibleCharacterCount: -1,
	 * 	setText(text) {
	 * 		this.text = text;
	 * 	},
	 * 	getText() {
	 * 		return this.text;
	 * 	},
	 * 	setVisibleCharacterCount(visibleCharacterCount) {
	 * 		this.visibleCharacterCount = visibleCharacterCount;
	 * 	},
	 * };
	 * const typewriter = new Typewriter(target, { charactersPerSecond: 10 });
	 * typewriter.setCharacterRevealedEvent((character, index) => {
	 * 	console.log(index, character);
	 * });
	 * typewriter.start("Hi!");
	 * typewriter.tick(0.25);
	 * console.log(target.visibleCharacterCount, typewriter.isFinished());
	 * typewriter.tick(0.1);
	 * console.log(target.visibleCharacterCount, typewriter.isFinished());
	 */
	setCharacterRevealedEvent(characterRevealedEvent) {
		this.#characterRevealedEvent = characterRevealedEvent;
	}

	//==============================================================================
	// 완료 알림 설정.
	//==============================================================================
	/**
	 * @param { Function } completeEvent 다 드러났을 때 부를 함수. () => void
	 */
	setCompleteEvent(completeEvent) {
		this.#completeEvent = completeEvent;
	}
}
