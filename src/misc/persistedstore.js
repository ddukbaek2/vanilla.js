//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { LocalStorage } from "./localstorage.js";


//==============================================================================
// 지속 저장소.
// - 하나의 키에 상태 객체를 JSON 으로 저장하고, 바뀔 때 구독자에게 알린다.
// - 판 번호(version)가 다르거나 파싱에 실패하면 기본값으로 되돌아간다.
// - 점수판 / 사용자 설정처럼 "localStorage + JSON + 리스너" 골격이 반복되던 것을 표준화했다.
//==============================================================================
export class PersistedStore extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { string } */ #storageKey;
	/** @private @type { number } */ #version;
	/** @private @type { object } */ #defaultState;
	/** @private @type { object } */ #state;
	/** @private @type { Set } */ #subscriberSet;
	/** @private @type { { getItem: Function, setItem: Function, removeItem: Function } | null } */ #storageBackend; // 이 저장소만 쓰는 곳. (null 이면 LocalStorage)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { string } storageKey
	 * @param { object } defaultState
	 * @param { number } version
	 */
	constructor(storageKey, defaultState = {}, version = 1) {
		super();

		this.#storageKey = storageKey;
		this.#version = version;
		this.#defaultState = defaultState;
		this.#storageBackend = null;
		this.#state = this.readFromStorage();
		this.#subscriberSet = new System.Set();
	}

	//==============================================================================
	// 상태 반환. (복사본이 아니므로 직접 고치지 말고 set() 을 쓴다)
	//==============================================================================
	/**
	 * @returns { object }
	 */
	get() {
		return this.#state;
	}

	//==============================================================================
	// 상태 일부 갱신. (얕은 병합 후 저장하고 구독자에게 알린다)
	//==============================================================================
	/**
	 * @param { object } partialState
	 */
	set(partialState) {
		this.#state = System.Object.assign({}, this.#state, partialState);
		this.writeToStorage();
		this.notify();
	}

	//==============================================================================
	// 상태 전체 교체.
	//==============================================================================
	/**
	 * @param { object } nextState
	 */
	replace(nextState) {
		this.#state = System.Object.assign({}, nextState);
		this.writeToStorage();
		this.notify();
	}

	//==============================================================================
	// 기본값으로 초기화.
	//==============================================================================
	reset() {
		this.replace(this.#defaultState);
	}

	//==============================================================================
	// 구독. (해지 함수를 반환)
	//==============================================================================
	/**
	 * @param { Function } subscriber (state) => void
	 * @returns { Function }
	 */
	subscribe(subscriber) {
		this.#subscriberSet.add(subscriber);
		return () => {
			this.#subscriberSet.delete(subscriber);
		};
	}

	//==============================================================================
	// 구독자 알림.
	//==============================================================================
	notify() {
		for (const subscriber of this.#subscriberSet) {
			subscriber(this.#state);
		}
	}

	//==============================================================================
	// 저장소에서 읽기.
	//==============================================================================
	/**
	 * @returns { object }
	 */
	readFromStorage() {
		const storedText = this.readStoredText();
		if (storedText.length === 0) {
			return System.Object.assign({}, this.#defaultState);
		}
		try {
			const parsed = System.JSON.parse(storedText);
			if (!parsed || parsed.version !== this.#version || typeof parsed.state !== "object" || parsed.state === null) {
				return System.Object.assign({}, this.#defaultState);
			}

			// 기본값에 없던 키가 저장돼 있어도 살리고, 새로 생긴 기본 키는 기본값으로 채운다.
			return System.Object.assign({}, this.#defaultState, parsed.state);
		}
		catch (parseError) {
			return System.Object.assign({}, this.#defaultState);
		}
	}

	//==============================================================================
	// 저장소에 쓰기.
	//==============================================================================
	writeToStorage() {
		const payload = { version: this.#version, state: this.#state };
		const payloadText = System.JSON.stringify(payload);
		const storageBackend = this.getStorageBackend();
		if (storageBackend === null) {
			LocalStorage.setString(this.#storageKey, payloadText);
			return;
		}
		try {
			storageBackend.setItem(this.#storageKey, payloadText);
		}
		catch (error) {
			console.warn(`[PersistedStore] 저장소에 쓰지 못했습니다: ${this.#storageKey}`, error);
		}
	}

	//==============================================================================
	// 저장된 글 읽기. (없거나 못 읽으면 빈 글)
	//==============================================================================
	/**
	 * @returns { string }
	 */
	readStoredText() {
		const storageBackend = this.getStorageBackend();
		if (storageBackend === null) {
			return LocalStorage.getString(this.#storageKey, "");
		}
		try {
			const storedText = storageBackend.getItem(this.#storageKey);
			return typeof storedText === "string" ? storedText : "";
		}
		catch (error) {
			return "";
		}
	}

	//==============================================================================
	// 이 저장소만 쓰는 곳 갈아 끼우기. (null 이면 LocalStorage, 플랫폼의 저장소처럼 getItem, setItem, removeItem 을 가진 객체)
	// - 갈아 끼운 곳에서 상태를 다시 읽고 구독자에게 알린다. 저장된 것이 없으면 기본값이다.
	//==============================================================================
	/**
	 * @param { { getItem: Function, setItem: Function, removeItem: Function } | null } storageBackend
	 */
	setStorageBackend(storageBackend) {
		this.#storageBackend = storageBackend === undefined ? null : storageBackend;
		this.#state = this.readFromStorage();
		this.notify();
	}

	//==============================================================================
	// 이 저장소만 쓰는 곳 반환. (없으면 null)
	//==============================================================================
	/**
	 * @returns { object | null }
	 */
	getStorageBackend() {
		return this.#storageBackend;
	}

	//==============================================================================
	// 저장 키 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getStorageKey() {
		return this.#storageKey;
	}
}
