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
	// 생성. (그 클래스의 인스턴스가 이미 있으면 던진다, getInstance 로 받는다)
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		const T = this.constructor;
		// 하위 클래스 생성자는 super() 가 다른 객체를 돌려줘도 그 객체에 제 필드와 생성자 몸통을 다시 돌려 첫 인스턴스를 덮어쓴다.
		// 그래서 이미 있던 인스턴스를 돌려주지 않고 두 번째 생성을 막는다.
		if (Singleton.#instances.has(T)) {
			throw new Error(`Singleton: ${T.name} instance already exists. Use getInstance().`);
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