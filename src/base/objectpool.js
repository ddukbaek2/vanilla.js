//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "./object.js";


//==============================================================================
// 오브젝트 풀.
// - 매 프레임 생성 / 해제되는 객체(탄환, 이펙트 등)를 재사용해 GC 압박을 줄인다.
// - acquire() 로 빌리고 release() 로 되돌린다. 되돌릴 때 resetHandler 가 상태를 비운다.
//==============================================================================
export class ObjectPool extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Function } */ #createHandler;
	/** @private @type { Function | null } */ #resetHandler;
	/** @private @type { object[] } */ #freeList;
	/** @private @type { number } */ #totalCount;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { Function } createHandler 새 객체를 만드는 함수.
	 * @param { Function | null } resetHandler 되돌릴 때 상태를 비우는 함수. (객체를 인자로 받는다)
	 * @param { number } preloadCount 미리 만들어 둘 개수.
	 */
	constructor(createHandler, resetHandler = null, preloadCount = 0) {
		super();

		this.#createHandler = createHandler;
		this.#resetHandler = resetHandler;
		this.#freeList = [];
		this.#totalCount = 0;

		for (let index = 0; index < preloadCount; ++index) {
			this.#freeList.push(this.#createHandler());
			this.#totalCount += 1;
		}
	}

	//==============================================================================
	// 빌리기. (없으면 새로 만든다)
	//==============================================================================
	/**
	 * @returns { object }
	 */
	acquire() {
		if (this.#freeList.length > 0) {
			return this.#freeList.pop();
		}
		this.#totalCount += 1;
		return this.#createHandler();
	}

	//==============================================================================
	// 되돌리기.
	//==============================================================================
	/**
	 * @param { object } instance
	 */
	release(instance) {
		if (instance === null || instance === undefined) {
			return;
		}
		if (this.#resetHandler) {
			this.#resetHandler(instance);
		}
		this.#freeList.push(instance);
	}

	//==============================================================================
	// 놀고 있는 객체 수 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getFreeCount() {
		return this.#freeList.length;
	}

	//==============================================================================
	// 지금까지 만든 전체 객체 수 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getTotalCount() {
		return this.#totalCount;
	}

	//==============================================================================
	// 풀 비우기.
	//==============================================================================
	clear() {
		this.#freeList.length = 0;
	}
}
