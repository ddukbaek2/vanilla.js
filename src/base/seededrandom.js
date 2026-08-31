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
	 * @param { number } seed
	 */
	constructor(seed = 1) {
		super();

		this.#state = (seed >>> 0) || 1;
	}

	//==============================================================================
	// 시드 재설정.
	//==============================================================================
	/**
	 * @param { number } seed
	 */
	setSeed(seed) {
		this.#state = (seed >>> 0) || 1;
	}

	//==============================================================================
	// 현재 내부 상태 반환. (저장 / 복원용)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getState() {
		return this.#state;
	}

	//==============================================================================
	// 내부 상태 복원.
	//==============================================================================
	/**
	 * @param { number } state
	 */
	setState(state) {
		this.#state = state >>> 0;
	}

	//==============================================================================
	// 0 이상 1 미만의 난수 반환.
	//==============================================================================
	/**
	 * @returns { number }
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
	 * @param { number } minValue
	 * @param { number } maxValue
	 * @returns { number }
	 */
	nextRange(minValue, maxValue) {
		const value = minValue + (maxValue - minValue) * this.nextValue();
		return value;
	}

	//==============================================================================
	// min 이상 max 이하의 정수 난수 반환.
	//==============================================================================
	/**
	 * @param { number } minValue
	 * @param { number } maxValue
	 * @returns { number }
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
	 * @param { T[] } array
	 * @returns { T | undefined }
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
	 * @param { T[] } array
	 * @returns { T[] }
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
	 * @param { number } dateNumber
	 * @param { number } baseSeed
	 * @returns { number }
	 */
	static createDailySeed(dateNumber, baseSeed = 0x9E3779B1) {
		const mixed = (baseSeed ^ System.Math.imul(dateNumber >>> 0, 0x9E3779B1)) >>> 0;
		return mixed || 1;
	}

	//==============================================================================
	// 오늘 날짜의 시드 난수 생성. (정적)
	//==============================================================================
	/**
	 * @param { Date } date
	 * @param { number } baseSeed
	 * @returns { SeededRandom }
	 */
	static fromDate(date = new System.Date(), baseSeed = 0x9E3779B1) {
		const dateNumber = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
		return new SeededRandom(SeededRandom.createDailySeed(dateNumber, baseSeed));
	}
}
