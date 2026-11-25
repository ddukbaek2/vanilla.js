//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";


//==============================================================================
// 공유 클래스.
//==============================================================================
/**
 * @example <caption>상속해서 하나뿐인 인스턴스 쓰기</caption>
 * import { Singleton } from "./build/vanilla.js";
 *
 * class ScoreBoard extends Singleton {
 * 	constructor() {
 * 		super();
 * 		this.score = 0;
 * 	}
 * }
 *
 * const scoreBoard = ScoreBoard.getInstance();
 * scoreBoard.score += 10;
 * const sameScoreBoard = ScoreBoard.getInstance();
 * console.log(scoreBoard === sameScoreBoard, sameScoreBoard.score);
 */
export class Singleton extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @static @type { Map } */ static #instances = new Map();

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		const T = this.constructor;
		if (Singleton.#instances.has(T)) {
			return Singleton.#instances.get(T);
		}

		// 등록.
		Singleton.#instances.set(T, this);
	}

	//==============================================================================
	// 공유 인스턴스 반환.
	//==============================================================================
	/**
	 * @static
	 * @returns { Singleton } 부른 클래스의 공유 인스턴스. (없으면 인자 없이 만들어 등록한다)
	 */
	static getInstance() {
		const T = this;
		if (!Singleton.#instances.has(T)) {
			const obj = new T();
		}
		return Singleton.#instances.get(T);
	}
}