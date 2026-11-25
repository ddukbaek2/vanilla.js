//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";


//==============================================================================
// 로컬 스토리지.
// - 기본 저장소는 브라우저의 window.localStorage 다. setBackend 로 다른 저장소(플랫폼 SDK 의 저장소 같은 것)로 갈아 끼울 수 있다.
// - 모든 접근을 try 로 감싼다. 저장소가 막혀 있거나(사생활 보호 창, 막은 쿠키) 가득 차서 못 쓰면 예외를 내지 않고
//   이 페이지가 살아 있는 동안 메모리에 대신 둔다. (그 값은 다시 켜면 없다, isMemoryFallback)
// - 읽기(getString, getBoolean, getNumber, getJson)는 없는 키에 기본값을 써 넣지 않는다.
//==============================================================================
export class LocalStorage extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { { getItem: Function, setItem: Function, removeItem: Function } | null } */ static #backend = null; // 갈아 끼운 저장소. (null 이면 window.localStorage)
	/** @private @type { Map<string, string> } */ static #memoryItemMap = new System.Map(); // 못 쓴 값을 대신 두는 곳.
	/** @private @type { boolean } */ static #isMemoryFallback = false; // 한 번이라도 메모리로 대신했는지.


	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
	}

	//==============================================================================
	// 저장소 갈아 끼우기. (null 이면 브라우저 window.localStorage 로 돌아간다)
	// - backend 는 getItem(key) → string | null, setItem(key, value), removeItem(key) 를 가진 객체다. (Storage 와 같은 꼴)
	// - 키 목록(getKeys, clearByPrefix)과 전체 제거(clear)를 쓰려면 getKeys() → string[] 를, 한 번에 지우려면 clear() 를 더 둔다.
	// - 갈아 끼우면 메모리에 대신 둔 값은 버린다.
	//==============================================================================
	/**
	 * @param { { getItem: Function, setItem: Function, removeItem: Function, getKeys?: Function, clear?: Function } | null } backend
	 */
	static setBackend(backend) {
		LocalStorage.#backend = backend === undefined ? null : backend;
		LocalStorage.#memoryItemMap.clear();
		LocalStorage.#isMemoryFallback = false;
	}

	//==============================================================================
	// 갈아 끼운 저장소 반환. (없으면 null)
	//==============================================================================
	/**
	 * @returns { object | null }
	 */
	static getBackend() {
		return LocalStorage.#backend;
	}

	//==============================================================================
	// 저장소를 못 써서 메모리로 대신한 적이 있는지.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	static isMemoryFallback() {
		return LocalStorage.#isMemoryFallback;
	}

	//==============================================================================
	// 지금 쓰는 저장소 반환. (갈아 끼운 것, 없으면 window.localStorage, 그것도 막혀 있으면 null)
	//==============================================================================
	/**
	 * @returns { object | null }
	 */
	static readStorage() {
		const backend = LocalStorage.getBackend();
		if (backend !== null) {
			return backend;
		}
		try {
			const storage = System.window.localStorage;
			return storage !== undefined && storage !== null ? storage : null;
		}
		catch (error) {
			return null;
		}
	}

	//==============================================================================
	// 값 하나 읽기. (없으면 null, 메모리에 대신 둔 값이 앞선다)
	//==============================================================================
	/**
	 * @param { string } key
	 * @returns { string | null }
	 */
	static getItem(key) {
		const memoryItemMap = LocalStorage.#memoryItemMap;
		if (memoryItemMap.has(key)) {
			return memoryItemMap.get(key);
		}
		const storage = LocalStorage.readStorage();
		if (storage === null) {
			return null;
		}
		try {
			const value = storage.getItem(key);
			if (value === null || value === undefined) {
				return null;
			}
			return System.String(value);
		}
		catch (error) {
			return null;
		}
	}

	//==============================================================================
	// 값 하나 쓰기. (저장소에 썼으면 true, 못 써서 메모리에 대신 뒀으면 false)
	//==============================================================================
	/**
	 * @param { string } key
	 * @param { string } value
	 * @returns { boolean }
	 */
	static setItem(key, value) {
		const memoryItemMap = LocalStorage.#memoryItemMap;
		const storage = LocalStorage.readStorage();
		if (storage !== null) {
			try {
				storage.setItem(key, value);
				memoryItemMap.delete(key);
				return true;
			}
			catch (error) {
				console.warn(`[LocalStorage] 저장소에 쓰지 못해 메모리에 둡니다: ${key}`, error);
			}
		}
		memoryItemMap.set(key, value);
		LocalStorage.#isMemoryFallback = true;
		return false;
	}

	//==============================================================================
	// 값 하나 지우기. (메모리에 대신 둔 값도 지운다)
	//==============================================================================
	/**
	 * @param { string } key
	 */
	static removeItem(key) {
		LocalStorage.#memoryItemMap.delete(key);
		const storage = LocalStorage.readStorage();
		if (storage === null) {
			return;
		}
		try {
			storage.removeItem(key);
		}
		catch (error) {
			console.warn(`[LocalStorage] 저장소에서 지우지 못했습니다: ${key}`, error);
		}
	}

	//==============================================================================
	// 전체 제거.
	//==============================================================================
	static clear() {
		LocalStorage.#memoryItemMap.clear();
		const storage = LocalStorage.readStorage();
		if (storage === null) {
			return;
		}
		try {
			if (typeof storage.clear === "function") {
				storage.clear();
				return;
			}
		}
		catch (error) {
			console.warn("[LocalStorage] 저장소를 비우지 못했습니다.", error);
			return;
		}
		const keys = LocalStorage.getKeys();
		for (const key of keys) {
			LocalStorage.removeItem(key);
		}
	}

	//==============================================================================
	// 문자열 값 설정.
	//==============================================================================
	/**
	 * @param { string } key 
	 * @param { string } stringValue
	 */
	static setString(key, stringValue) {
		LocalStorage.setItem(key, stringValue);
	}

	//==============================================================================
	// 논리 값 설정.
	//==============================================================================
	/**
	 * @param { string } key 
	 * @param { boolean } booleanValue
	 */
	static setBoolean(key, booleanValue) {
		LocalStorage.setString(key, booleanValue ? "true" : "false");
	}

	//==============================================================================
	// 숫자 값 설정.
	//==============================================================================
	/**
	 * @param { string } key 
	 * @param { number } numberValue
	 */
	static setNumber(key, numberValue) {
		LocalStorage.setString(key, String(numberValue));
	}

	//==============================================================================
	// 값 제거.
	//==============================================================================
	/**
	 * @param { string } key 
	 */
	static remove(key) {
		LocalStorage.removeItem(key);
	}

	//==============================================================================
	// 문자열 값 반환. (없으면 기본값, 저장소에는 쓰지 않는다)
	//==============================================================================
	/**
	 * @param { string } key 
	 * @param { string } defaultStringValue 
	 * @returns { string }
	 */
	static getString(key, defaultStringValue = "") {
		const value = LocalStorage.getItem(key);
		if (value === null || value === undefined) {
			return defaultStringValue;
		}
		
		return value;
	}

	//==============================================================================
	// 논리 값 반환.
	//==============================================================================
	/**
	 * @param { string } key 
	 * @param { boolean } defaultBooleanValue 
	 * @returns { boolean }
	 */
	static getBoolean(key, defaultBooleanValue = false) {
		const stringValue = LocalStorage.getString(key);
		if (stringValue === "") {
			return defaultBooleanValue;
		}
		else {
			return stringValue === "true";
		}
	}

	//==============================================================================
	// 숫자 값 반환.
	//==============================================================================
	/**
	 * @param { string } key 
	 * @param { number } defaultNumberValue 
	 * @returns { number }
	 */
	static getNumber(key, defaultNumberValue = 0) {
		const stringValue = LocalStorage.getString(key);
		if (stringValue === "") {
			return defaultNumberValue;
		}
		else {
			return Number(stringValue);
		}
	}

	//==============================================================================
	// 존재 여부 반환.
	//==============================================================================
	/**
	 * @param { string } key 
	 * @returns { boolean }
	 */
	//==============================================================================
	// 접두사로 시작하는 키 일괄 삭제. (정적)
	// - 게임 네임스페이스의 저장 데이터를 통째로 지울 때 쓴다.
	//==============================================================================
	/**
	 * @param { string } prefix
	 * @returns { number } 지운 키 수.
	 */
	static clearByPrefix(prefix) {
		if (!prefix) {
			return 0;
		}
		const keys = LocalStorage.getKeys();
		const removeKeyList = [];
		for (const key of keys) {
			if (key && key.indexOf(prefix) === 0) {
				removeKeyList.push(key);
			}
		}
		for (const key of removeKeyList) {
			LocalStorage.removeItem(key);
		}
		return removeKeyList.length;
	}

	static containsKey(key) {
		return LocalStorage.getItem(key) !== null;
	}

	//==============================================================================
	// 모든 키 반환.
	//==============================================================================
	/**
	 * @returns { string[] }
	 */
	static getKeys() {
		const keySet = new System.Set();
		const storage = LocalStorage.readStorage();
		if (storage !== null) {
			try {
				if (typeof storage.getKeys === "function") {
					const backendKeys = storage.getKeys();
					for (const key of backendKeys) {
						keySet.add(key);
					}
				}
				else if (typeof storage.key === "function") {
					for (let i = 0; i < storage.length; ++i) {
						const key = storage.key(i);
						if (key !== null && key !== undefined) {
							keySet.add(key);
						}
					}
				}
			}
			catch (error) {
				console.warn("[LocalStorage] 키 목록을 읽지 못했습니다.", error);
			}
		}
		for (const key of LocalStorage.#memoryItemMap.keys()) {
			keySet.add(key);
		}
		const keys = System.Array.from(keySet);
		keys.sort();
		return keys;
	}

	//==============================================================================
	// JSON 값 반환. (없거나 풀 수 없으면 기본값, 저장소에는 쓰지 않는다)
	//==============================================================================
	/**
	 * @param { string } key
	 * @param { any } defaultValue
	 * @returns { any }
	 */
	static getJson(key, defaultValue = null) {
		const stringValue = LocalStorage.getItem(key);
		if (stringValue === null || stringValue === "") {
			return defaultValue;
		}
		try {
			return System.JSON.parse(stringValue);
		}
		catch (error) {
			return defaultValue;
		}
	}

	//==============================================================================
	// JSON 값 설정. (JSON 글로 바꿔 쓴다. 바꿀 수 없는 값(순환 참조 등)이면 쓰지 않고 false)
	//==============================================================================
	/**
	 * @param { string } key
	 * @param { any } value
	 * @returns { boolean } 저장소에 썼는지. (메모리에 대신 뒀거나 바꿀 수 없으면 false)
	 */
	static setJson(key, value) {
		let stringValue = "";
		try {
			stringValue = System.JSON.stringify(value);
		}
		catch (error) {
			console.warn(`[LocalStorage] JSON 으로 바꿀 수 없는 값입니다: ${key}`, error);
			return false;
		}
		if (stringValue === undefined) {
			return false;
		}
		return LocalStorage.setItem(key, stringValue);
	}
}