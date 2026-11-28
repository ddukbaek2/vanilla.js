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
/**
 * @example <caption>설정을 저장하고 바뀔 때 알림 받기</caption>
 * import { PersistedStore } from "./build/vanilla.js";
 *
 * const store = new PersistedStore("example.settings", { volume: 1, language: "en" }, 1);
 * const subscription = store.subscribe((state) => {
 * 	console.log("changed", state.volume);
 * });
 * store.set({ volume: 0.5 });
 * const state = store.get();
 * console.log(state.volume, state.language);
 * store.unsubscribe(subscription);
 * store.reset();
 */
export class PersistedStore extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { string } */ #storageKey;
	/** @private @type { number } */ #version;
	/** @private @type { object } */ #defaultState;
	/** @private @type { object } */ #state;
	/** @private @type { Set } */ #subscriberSet;
	/** @private @type { Map<Function, Function> } */ #subscriberBySubscription; // subscribe 가 돌려준 해지 함수 → 구독자.
	/** @private @type { { getItem: Function, setItem: Function, removeItem: Function } | null } */ #storageBackend; // 이 저장소만 쓰는 곳. (null 이면 LocalStorage)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { string } storageKey 상태를 둘 저장소 키.
	 * @param { object } defaultState 기본 상태. (저장된 것이 없거나 판이 다르면 이것을 복사해 쓴다)
	 * @param { number } version 저장 꼴의 판 번호. (저장된 판과 다르면 기본 상태로 되돌아간다)
	 */
	constructor(storageKey, defaultState = {}, version = 1) {
		super();

		this.#storageKey = storageKey;
		this.#version = version;
		this.#defaultState = defaultState;
		this.#storageBackend = null;
		this.#state = this.readFromStorage();
		this.#subscriberSet = new System.Set();
		this.#subscriberBySubscription = new System.Map();
	}

	//==============================================================================
	// 상태 반환. (복사본이 아니므로 직접 고치지 말고 set() 을 쓴다)
	//==============================================================================
	/**
	 * @returns { object } 지금 상태.
	 */
	get() {
		return this.#state;
	}

	//==============================================================================
	// 상태 일부 갱신. (얕은 병합 후 저장하고 구독자에게 알린다)
	//==============================================================================
	/**
	 * @param { object } partialState 바꿀 키와 값만 담은 객체.
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
	 * @param { object } nextState 새 상태. (얕게 복사해 쓴다)
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
	 * @returns { Function } 해지 함수. (부르면 구독을 푼다)
	 */
	subscribe(subscriber) {
		this.#subscriberSet.add(subscriber);
		const subscription = () => {
			this.#subscriberSet.delete(subscriber);
			this.#subscriberBySubscription.delete(subscription);
		};
		this.#subscriberBySubscription.set(subscription, subscriber);
		return subscription;
	}

	//==============================================================================
	// 구독 해지. (subscribe 가 돌려준 것을 넘긴다, 돌려받은 해지 함수를 부르는 것과 같다)
	//==============================================================================
	/**
	 * @param { Function } subscription subscribe 가 돌려준 해지 함수. (모르는 것이면 아무것도 하지 않는다)
	 */
	unsubscribe(subscription) {
		if (!this.#subscriberBySubscription.has(subscription)) {
			return;
		}
		subscription();
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
	 * @returns { object } 저장된 상태를 기본 상태 위에 덮은 새 객체. (없거나, 판이 다르거나, 풀 수 없으면 기본 상태의 복사본)
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
	 * @returns { string } 저장된 JSON 글. 없거나 못 읽으면 빈 글.
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
	 * @param { { getItem: Function, setItem: Function, removeItem: Function } | null } storageBackend 이 저장소만 쓸 곳. (null 이나 undefined 면 LocalStorage)
	 * @example <caption>플랫폼 저장소처럼 따로 둔 곳에 쓰기</caption>
	 * import { PersistedStore } from "./build/vanilla.js";
	 *
	 * const itemMap = new Map();
	 * const store = new PersistedStore("example.progress", { stage: 1 }, 1);
	 * store.setStorageBackend({
	 * 	getItem: (key) => {
	 * 		return itemMap.has(key) ? itemMap.get(key) : null;
	 * 	},
	 * 	setItem: (key, value) => {
	 * 		itemMap.set(key, value);
	 * 	},
	 * 	removeItem: (key) => {
	 * 		itemMap.delete(key);
	 * 	}
	 * });
	 * store.set({ stage: 3 });
	 * console.log(itemMap.get("example.progress"));
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
	 * @returns { object | null } 이 저장소만 쓰는 곳. 없으면 null.
	 */
	getStorageBackend() {
		return this.#storageBackend;
	}

	//==============================================================================
	// 저장 키 반환.
	//==============================================================================
	/**
	 * @returns { string } 저장소 키.
	 */
	getStorageKey() {
		return this.#storageKey;
	}
}
