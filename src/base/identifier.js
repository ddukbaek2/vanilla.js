//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "./object.js";


//==============================================================================
// 식별자 생성기.
//==============================================================================
/**
 * @example <caption>번호 차례로 나눠 주기</caption>
 * import { Identifier } from "./build/vanilla.js";
 *
 * const identifier = new Identifier(1000, 1);
 * const firstId = identifier.auto();
 * const secondId = identifier.auto();
 * const jumpedId = identifier.auto(10);
 * console.log(firstId, secondId, jumpedId);
 *
 * identifier.reset();
 * const restartedId = identifier.auto();
 * console.log(restartedId);
 */
export class Identifier extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #initialSerialNumber; // 처음 값.
	/** @private @type { number } */ #serialNumber; // 누적.
	/** @private @type { number } */ #increaseNumber; // 증가.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { number} initialSerialNumber 처음 값. (기본 0, 첫 auto() 는 이 값에 증가량을 더해 돌려준다)
	 * @param { number} initialIncreaseNumber auto() 한 번에 더할 기본 증가량. (기본 1)
	 */
	constructor(initialSerialNumber = 0, initialIncreaseNumber = 1) {
		super();
		this.#initialSerialNumber = initialSerialNumber;
		this.#serialNumber = initialSerialNumber;
		this.#increaseNumber = initialIncreaseNumber;
	}

	//==============================================================================
	// 초기 상태로 되돌림. (처음 값부터 다시 센다)
	//==============================================================================
	reset() {
		this.#serialNumber = this.#initialSerialNumber;
	}

	//==============================================================================
	// 호출마다 (1 or custom)씩 증가되는 식별자 반환.
	//==============================================================================
	/**
	 * @description 아이디 자동 생성 후 반환.
	 * @param { number } increaseNumber 이번에만 더할 증가량. (0 이거나 생략하면 기본 증가량)
	 * @returns { number } 더한 뒤의 식별자.
	 */
	auto(increaseNumber = 0) {
		if (increaseNumber) {
			this.#serialNumber += increaseNumber;
		}
		else {
			this.#serialNumber += this.#increaseNumber
		}
		return this.#serialNumber;
	}
}


//==============================================================================
// 열거 식별자 생성기.
//==============================================================================
/**
 * @example <caption>상태 열거 만들기</caption>
 * import { Enum } from "./build/vanilla.js";
 *
 * const GameState = {
 * 	ready: Enum.begin(),
 * 	playing: Enum.auto(),
 * 	gameOver: Enum.auto()
 * };
 * Enum.readonly(GameState);
 * console.log(GameState.ready, GameState.gameOver, Object.isFrozen(GameState));
 */
export class Enum extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @static @type { Identifier } */ static #identifier = new Identifier(0, 1);

	//==============================================================================
	// 시작값으로 출발.
	//==============================================================================
	/**
	 * @static
	 * @returns { number } 처음부터 다시 센 첫 값. (늘 1)
	 */
	static begin() {
		Enum.#identifier.reset();
		return Enum.auto();
	}

	//==============================================================================
	// 값을 증가시켜서 반환.
	//==============================================================================
	/**
	 * @static
	 * @returns { number } 하나 늘린 값.
	 */
	static auto() {
		return Enum.#identifier.auto();
	}

	//==============================================================================
	// 고정 열거체 생성.
	//==============================================================================
	/**
	 * @static
	 * @param { object } dictionary 얼릴 열거 객체. (그 자리에서 Object.freeze 한다)
	 * @returns { object } 얼린 dictionary 그 객체. (Object.freeze 처럼 받은 객체를 그대로 돌려준다)
	 */
	static readonly(dictionary) {
		const frozenDictionary = System.Object.freeze(dictionary);
		return frozenDictionary;
	}
}