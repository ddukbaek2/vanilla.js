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
/**
 * @example <caption>탄환 빌리고 되돌리기</caption>
 * import { ObjectPool } from "./build/vanilla.js";
 *
 * const bulletPool = new ObjectPool(() => {
 * 	return { x: 0, y: 0, isAlive: false };
 * }, (bullet) => {
 * 	bullet.isAlive = false;
 * }, 4);
 * const bullet = bulletPool.acquire();
 * bullet.isAlive = true;
 * console.log(bulletPool.getFreeCount(), bulletPool.getTotalCount());
 * bulletPool.release(bullet);
 * console.log(bulletPool.getFreeCount(), bullet.isAlive);
 */
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
	 * @returns { object } 놀고 있던 객체. (마지막에 되돌린 것부터 꺼내고, 없으면 createHandler 로 새로 만든다)
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
	 * @param { object } instance 되돌릴 객체. (null 이나 undefined 면 무시한다, 이미 되돌린 객체인지는 가리지 않는다)
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
	 * @returns { number } 되돌려 쌓여 있는 객체 수.
	 */
	getFreeCount() {
		return this.#freeList.length;
	}

	//==============================================================================
	// 지금까지 만든 전체 객체 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 만든 객체 수. (미리 만든 것도 들고 clear() 해도 줄지 않는다)
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
