//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";


//==============================================================================
// 로컬 스토리지.
//==============================================================================
export class LocalStorage extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================


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
	// 전체 제거.
	//==============================================================================
	static clear() {
		System.window.localStorage.clear();
	}

	//==============================================================================
	// 문자열 값 설정.
	//==============================================================================
	/**
	 * @param { string } key 
	 * @param { string } stringValue
	 */
	static setString(key, stringValue) {
		System.window.localStorage.setItem(key, stringValue);
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
		System.window.localStorage.removeItem(key);
	}

	//==============================================================================
	// 문자열 값 반환.
	//==============================================================================
	/**
	 * @param { string } key 
	 * @param { string } defaultStringValue 
	 * @returns { string }
	 */
	static getString(key, defaultStringValue = "") {
		const value = System.window.localStorage.getItem(key);
		if (value === null || value === undefined) {
			LocalStorage.setString(key, defaultStringValue);
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
			LocalStorage.setBoolean(key, defaultBooleanValue);
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
			LocalStorage.setNumber(key, defaultNumberValue);
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
	static containsKey(key) {
		return System.window.localStorage.getItem(key) !== null;
	}

	//==============================================================================
	// 모든 키 반환.
	//==============================================================================
	/**
	 * @returns { string[] }
	 */
	static getKeys() {
		const keys = [];
		for (let i = 0; i < System.window.localStorage.length; ++i) {
			const key = System.window.localStorage.key(i);
			keys.push(key);
		}
		keys.sort();
		return keys;
	}
}