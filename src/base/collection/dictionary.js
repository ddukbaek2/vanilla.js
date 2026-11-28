//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";


//==============================================================================
// 딕셔너리.
//==============================================================================
/**
 * @template K, V
 * @class
 * @example <caption>키로 넣고 꺼내기</caption>
 * import { Dictionary } from "./build/vanilla.js";
 *
 * const dictionary = new Dictionary();
 * dictionary.add("hp", 100);
 * dictionary.add("mp", 40);
 * dictionary.add("hp", 80);
 * dictionary.remove("mp");
 * console.log(dictionary.get("hp"), dictionary.contains("mp"), dictionary.getCount(), dictionary.getKeys());
 */
export class Dictionary extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Map<K, V> } */ #items;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.#items = new Map();
	}

	//==============================================================================
	// 전체 제거.
	//==============================================================================
	clear() {
		this.#items.clear();
	}

	//==============================================================================
	// 추가.
	//==============================================================================
	/**
	 * @param { K } key 키.
	 * @param { V } value 값. (같은 키가 있으면 덮어쓴다)
	 */
	add(key, value) {
		this.#items.set(key, value);
	}

	//==============================================================================
	// 제거.
	//==============================================================================
	/**
	 * @param { K } key 지울 키.
	 * @returns { boolean } 있어서 지웠으면 참.
	 */
	remove(key) {
		return this.#items.delete(key);
	}

	//==============================================================================
	// 요소 검색.
	//==============================================================================
	/**
	 * @param { function(V, K, Dictionary<K, V>): boolean } predicate 맞는 항목에 참을 돌려주는 함수. (Map.prototype.forEach 처럼 값, 키, 이 딕셔너리를 받는다)
	 * @returns { { key: K, value: V } | null } 처음 맞는 항목의 키와 값. 없으면 null.
	 * @example <caption>값으로 항목 찾기</caption>
	 * import { Dictionary } from "./build/vanilla.js";
	 *
	 * const dictionary = new Dictionary();
	 * dictionary.add("sword", 30);
	 * dictionary.add("shield", 10);
	 * const found = dictionary.find((value) => value > 20);
	 * console.log(found.key, found.value);
	 */
	find(predicate) {
		const items = this.getItems();
		for (const [key, value] of items) {
			if (predicate(value, key, this)) {
				return {
					key,
					value
				};
			}
		}
		return null;
	}

	//==============================================================================
	// 요소 검색.
	//==============================================================================
	/**
	 * @param { function(V, K, Dictionary<K, V>): boolean } predicate 맞는 항목에 참을 돌려주는 함수. (Map.prototype.forEach 처럼 값, 키, 이 딕셔너리를 받는다)
	 * @returns { { key: K, value: V }[] } 맞는 항목의 키와 값을 모두 담은 새 배열.
	 */
	findAll(predicate) {
		const result = [];
		const allItems = this.getItems();
		for (const [key, value] of allItems) {
			if (predicate(value, key, this)) {
				result.push({
					key,
					value
				});
			}
		}
		return result;
	}

	//==============================================================================
	// 요소가 포함되어있는지 여부 반환.
	//==============================================================================
	/**
	 * @param { K } key 찾을 키.
	 * @returns { boolean } 키가 있으면 참.
	 */
	contains(key) {
		return this.#items.has(key);
	}

	//==============================================================================
	// 요소 반환.
	//==============================================================================
	/**
	 * @param { K } key 찾을 키.
	 * @returns { V } 그 키의 값. 없으면 undefined.
	 */
	get(key) {
		// if (typeof key !== "string") {
		// 	key = `${key}`;
		// }
		return this.#items.get(key);
	}

	//==============================================================================
	// 요소 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 항목 수.
	 */
	getCount() {
		return this.#items.size;
	}

	//==============================================================================
	// 전체 요소 반환.
	//==============================================================================
	/**
	 * @returns { Map<K, V> } 안쪽 Map. (복사본이 아니다)
	 */
	getItems() {
		return this.#items;
	}

	//==============================================================================
	// 전체 키 반환.
	//==============================================================================
	/**
	 * @returns { K[] } 넣은 차례의 키를 담은 새 배열.
	 */
	getKeys() {
		const items = this.getItems();
		return Array.from(items.keys());
	}

	//==============================================================================
	// 전체 값 반환.
	//==============================================================================
	/**
	 * @returns { V[] } 넣은 차례의 값을 담은 새 배열.
	 */
	getValues() {
		const items = this.getItems();
		return Array.from(items.values());
	}
}