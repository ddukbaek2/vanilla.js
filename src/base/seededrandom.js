//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "./object.js";


//==============================================================================
// 시드 난수 생성기. (mulberry32)
// - 같은 시드에서 항상 같은 수열이 나오는 결정론적 난수.
// - 스테이지 생성 / 리플레이 / 대전 동기화처럼 재현이 필요한 곳에 쓴다.
// - 여러 게임이 xorshift32 / mulberry32 를 제각각 구현하던 것을 표준화했다.
//==============================================================================
/**
 * @example <caption>같은 시드로 같은 결과 다시 내기</caption>
 * import { SeededRandom } from "./build/vanilla.js";
 *
 * const seededRandom = new SeededRandom(12345);
 * const dice = seededRandom.nextInt(1, 6);
 * const angle = seededRandom.nextRange(0, 360);
 * const item = seededRandom.pick(["sword", "shield", "potion"]);
 * console.log(dice, angle, item);
 *
 * const replay = new SeededRandom(12345);
 * const replayDice = replay.nextInt(1, 6);
 * console.log(replayDice === dice);
 */
export class SeededRandom extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #state;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { number } seed 시드. (32 비트 부호 없는 정수로 바꾸고, 0 이면 1 을 쓴다)
	 */
	constructor(seed = 1) {
		super();

		this.#state = (seed >>> 0) || 1;
	}

	//==============================================================================
	// 시드 재설정.
	//==============================================================================
	/**
	 * @param { number } seed 시드. (32 비트 부호 없는 정수로 바꾸고, 0 이면 1 을 쓴다)
	 */
	setSeed(seed) {
		this.#state = (seed >>> 0) || 1;
	}

	//==============================================================================
	// 현재 내부 상태 반환. (저장 / 복원용)
	//==============================================================================
	/**
	 * @returns { number } 내부 상태. (32 비트 부호 없는 정수)
	 */
	getState() {
		return this.#state;
	}

	//==============================================================================
	// 내부 상태 복원.
	//==============================================================================
	/**
	 * @param { number } state getState() 로 받아 둔 상태.
	  * @example <caption>상태를 저장했다가 되돌리기</caption>
	  * import { SeededRandom } from "./build/vanilla.js";
	  *
	  * const seededRandom = new SeededRandom(99);
	  * const savedState = seededRandom.getState();
	  * const firstValue = seededRandom.nextValue();
	  * seededRandom.setState(savedState);
	  * const againValue = seededRandom.nextValue();
	  * console.log(firstValue === againValue);
	 */
	setState(state) {
		this.#state = state >>> 0;
	}

	//==============================================================================
	// 0 이상 1 미만의 난수 반환.
	//==============================================================================
	/**
	 * @returns { number } 0 이상 1 미만의 난수.
	 */
	nextValue() {
		this.#state = (this.#state + 0x6D2B79F5) >>> 0;
		let mixed = this.#state;
		mixed = System.Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
		mixed ^= mixed + System.Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
		const value = ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
		return value;
	}

	//==============================================================================
	// min 이상 max 미만의 실수 난수 반환.
	//==============================================================================
	/**
	 * @param { number } minValue 아래 끝. (포함)
	 * @param { number } maxValue 위 끝. (포함하지 않는다)
	 * @returns { number } minValue 이상 maxValue 미만의 실수.
	 */
	nextRange(minValue, maxValue) {
		const value = minValue + (maxValue - minValue) * this.nextValue();
		return value;
	}

	//==============================================================================
	// min 이상 max 이하의 정수 난수 반환.
	//==============================================================================
	/**
	 * @param { number } minValue 아래 끝. (정수, 포함)
	 * @param { number } maxValue 위 끝. (정수, 포함)
	 * @returns { number } minValue 이상 maxValue 이하의 정수.
	 */
	nextInt(minValue, maxValue) {
		const value = minValue + System.Math.floor(this.nextValue() * (maxValue - minValue + 1));
		return value;
	}

	//==============================================================================
	// 배열에서 하나 뽑기.
	//==============================================================================
	/**
	 * @template T
	 * @param { T[] } array 뽑을 배열.
	 * @returns { T | undefined } 뽑은 항목. (배열이 비었거나 없으면 undefined)
	 */
	pick(array) {
		if (!array || array.length === 0) {
			return undefined;
		}
		const index = this.nextInt(0, array.length - 1);
		return array[index];
	}

	//==============================================================================
	// 배열 제자리 셔플. (Fisher-Yates)
	//==============================================================================
	/**
	 * @template T
	 * @param { T[] } array 섞을 배열. (그 자리에서 바뀐다)
	 * @returns { T[] } 섞은 같은 배열.
	 */
	shuffle(array) {
		for (let index = array.length - 1; index > 0; --index) {
			const swapIndex = this.nextInt(0, index);
			const temporary = array[index];
			array[index] = array[swapIndex];
			array[swapIndex] = temporary;
		}
		return array;
	}

	//==============================================================================
	// 날짜 기반 시드 생성. (정적)
	// - 20260831 같은 YYYYMMDD 정수를 섞어, 같은 날짜면 어디서나 같은 시드가 나온다.
	//   데일리 챌린지 보드 생성 등에 쓴다.
	//==============================================================================
	/**
	 * @param { number } dateNumber YYYYMMDD 꼴의 날짜 정수. (20260831 같은)
	 * @param { number } baseSeed 섞을 바탕 시드. (기본 0x9E3779B1, 게임마다 다르게 주면 같은 날에도 다른 시드가 나온다)
	 * @returns { number } 시드. (32 비트 부호 없는 정수, 0 이면 1)
	 */
	static createDailySeed(dateNumber, baseSeed = 0x9E3779B1) {
		const mixed = (baseSeed ^ System.Math.imul(dateNumber >>> 0, 0x9E3779B1)) >>> 0;
		return mixed || 1;
	}

	//==============================================================================
	// 오늘 날짜의 시드 난수 생성. (정적)
	//==============================================================================
	/**
	 * @param { Date } date 날짜. (기본 지금, 기기의 지역 시각으로 연월일을 읽는다)
	 * @param { number } baseSeed 섞을 바탕 시드. (기본 0x9E3779B1, 게임마다 다르게 주면 같은 날에도 다른 시드가 나온다)
	 * @returns { SeededRandom } 그 날짜의 시드로 만든 시드 난수 생성기.
	  * @example <caption>데일리 챌린지 보드 만들기</caption>
	  * import { SeededRandom } from "./build/vanilla.js";
	  *
	  * const dailyRandom = SeededRandom.fromDate(new Date(2026, 7, 31));
	  * const dailySeed = SeededRandom.createDailySeed(20260831);
	  * const sameDayRandom = new SeededRandom(dailySeed);
	  * const boardValue = dailyRandom.nextInt(1, 100);
	  * const sameDayValue = sameDayRandom.nextInt(1, 100);
	  * console.log(boardValue === sameDayValue);
	 */
	static fromDate(date = new System.Date(), baseSeed = 0x9E3779B1) {
		const dateNumber = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
		return new SeededRandom(SeededRandom.createDailySeed(dateNumber, baseSeed));
	}
}
