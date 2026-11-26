//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";


//==============================================================================
// 셋 (중복 불허 집합).
//==============================================================================
/**
 * @template T
 * @class
 * @example <caption>합집합과 교집합</caption>
 * import { Set } from "./build/vanilla.js";
 *
 * const left = new Set();
 * left.add(1);
 * left.add(2);
 * left.add(2);
 * const right = new Set();
 * right.add(2);
 * right.add(3);
 * console.log(left.getCount(), left.union(right).toArray(), left.intersection(right).toArray(), left.difference(right).toArray());
 */
export class Set extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Set<T> } */ #items;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.#items = new System.Set();
	}

	//==============================================================================
	// 데이터 추가.
	//==============================================================================
	/**
	 * @param { T } item 더할 요소. (이미 있으면 그대로)
	 */
	add(item) {
		this.#items.add(item);
	}

	//==============================================================================
	// 데이터 제거.
	//==============================================================================
	/**
	 * @param { T } item 지울 요소.
	 * @returns { boolean } 있어서 지웠으면 참.
	 */
	remove(item) {
		return this.#items.delete(item);
	}

	//==============================================================================
	// 요소 포함 여부 반환.
	//==============================================================================
	/**
	 * @param { T } item 찾을 요소.
	 * @returns { boolean } 있으면 참.
	 */
	contains(item) {
		return this.#items.has(item);
	}

	//==============================================================================
	// 합집합. (Union)
	//==============================================================================
	/**
	 * @param { Set<T> } otherSet 합칠 다른 셋.
	 * @returns { Set<T> } 두 셋의 요소를 모두 담은 새 셋.
	 */
	union(otherSet) {
		const resultSet = new Set();
		for (const item of this.#items) {
			resultSet.add(item);
		}
		for (const item of otherSet.toArray()) {
			resultSet.add(item);
		}
		return resultSet;
	}

	//==============================================================================
	// 교집합. (Intersection)
	//==============================================================================
	/**
	 * @param { Set<T> } otherSet 견줄 다른 셋.
	 * @returns { Set<T> } 두 셋에 모두 있는 요소만 담은 새 셋.
	 */
	intersection(otherSet) {
		const resultSet = new Set();
		for (const item of this.#items) {
			if (otherSet.contains(item)) {
				resultSet.add(item);
			}
		}
		return resultSet;
	}

	//==============================================================================
	// 차집합. (Difference)
	//==============================================================================
	/**
	 * @param { Set<T> } otherSet 뺄 다른 셋.
	 * @returns { Set<T> } 이 셋에만 있고 다른 셋에는 없는 요소를 담은 새 셋.
	 */
	difference(otherSet) {
		const resultSet = new Set();
		for (const item of this.#items) {
			if (!otherSet.contains(item)) {
				resultSet.add(item);
			}
		}
		return resultSet;
	}

	//==============================================================================
	// 대칭 차집합 (여집합). (Symmetric Difference)
	//==============================================================================
	/**
	 * @param { Set<T> } otherSet 견줄 다른 셋.
	 * @returns { Set<T> } 두 셋 가운데 한쪽에만 있는 요소를 담은 새 셋.
	 */
	symmetricDifference(otherSet) {
		const resultSet = new Set();
		for (const item of this.#items) {
			if (!otherSet.contains(item)) {
				resultSet.add(item);
			}
		}
		for (const item of otherSet.toArray()) {
			if (!this.contains(item)) {
				resultSet.add(item);
			}
		}
		return resultSet;
	}

	//==============================================================================
	// 전체 제거.
	//==============================================================================
	clear() {
		this.#items.clear();
	}

	//==============================================================================
	// 요소 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 요소 수.
	 */
	getCount() {
		return this.#items.size;
	}

	//==============================================================================
	// 전체 요소 배열 반환.
	//==============================================================================
	/**
	 * @returns { T[] } 넣은 차례의 요소를 담은 새 배열.
	 */
	toArray() {
		return Array.from(this.#items);
	}
}