//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { LocalStorage } from "../../misc/localstorage.js";


//==============================================================================
// 세이브 기록을 글로 두는 곳. (러스트 판의 SaveStorage 트레이트 자리, 이 꼴을 따르는 객체면 된다)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 한 키에 쓰기는 다 되거나 안 되거나여야 한다. (localStorage.setItem, 임시 파일 뒤 이름 바꾸기) SaveGameManager 는 그 위에서 두 키를 번갈아 쓴다.
// - 기본 구현은 아무것도 두지 않는다. 하위 클래스가 네 함수를 다시 정의한다.
//==============================================================================
/**
 * @example <caption>내 저장소 만들기</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * class ConsoleSaveStorage extends Experimental.SaveStorage {
 * 	writeText(key, text) {
 * 		console.log(key, text.length);
 * 		return true;
 * 	}
 * }
 *
 * const storage = new ConsoleSaveStorage();
 * console.log(storage.writeText("save.slot.a.0", "text"), storage.readText("save.slot.a.0"));
 */
export class SaveStorage {
	//==============================================================================
	// 읽기.
	//==============================================================================
	/**
	 * @virtual
	 * @param { string } key 키.
	 * @returns { string | null } 저장된 글. (없거나 못 읽으면 null)
	 */
	readText(key) {
		return null;
	}

	//==============================================================================
	// 쓰기.
	//==============================================================================
	/**
	 * @virtual
	 * @param { string } key 키.
	 * @param { string } text 쓸 글.
	 * @returns { boolean } 오래 남는 곳에 썼으면 참.
	 */
	writeText(key, text) {
		return false;
	}

	//==============================================================================
	// 지우기.
	//==============================================================================
	/**
	 * @virtual
	 * @param { string } key 지울 키.
	 */
	removeText(key) {
		// 지우기.
	}

	//==============================================================================
	// 앞머리가 같은 키를 모두 읽기.
	//==============================================================================
	/**
	 * @virtual
	 * @param { string } prefix 앞머리.
	 * @returns { string[] } 정렬한 키 목록.
	 */
	listKeys(prefix) {
		return [];
	}
}


//==============================================================================
// 엔진 LocalStorage 위의 저장소. (기본, 브라우저 localStorage)
// - LocalStorage 가 막혀 메모리에 대신 두면 writeText 가 거짓을 돌려준다. (이 페이지가 살아 있는 동안은 읽힌다)
//==============================================================================
/**
 * @example <caption>LocalStorage 에 쓰고 읽기</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const storage = new Experimental.LocalSaveStorage();
 * storage.writeText("example.savestorage.key", "value");
 * console.log(storage.readText("example.savestorage.key"), storage.listKeys("example.savestorage.").length);
 * storage.removeText("example.savestorage.key");
 */
export class LocalSaveStorage extends SaveStorage {
	//==============================================================================
	// 읽기.
	//==============================================================================
	/**
	 * @param { string } key 키.
	 * @returns { string | null } 저장된 글. (없으면 null)
	 */
	readText(key) {
		return LocalStorage.getItem(key);
	}

	//==============================================================================
	// 쓰기.
	//==============================================================================
	/**
	 * @param { string } key 키.
	 * @param { string } text 쓸 글.
	 * @returns { boolean } 저장소에 썼으면 참. (메모리에 대신 뒀으면 거짓)
	 */
	writeText(key, text) {
		return LocalStorage.setItem(key, text);
	}

	//==============================================================================
	// 지우기.
	//==============================================================================
	/**
	 * @param { string } key 지울 키.
	 */
	removeText(key) {
		LocalStorage.removeItem(key);
	}

	//==============================================================================
	// 앞머리가 같은 키를 모두 읽기.
	//==============================================================================
	/**
	 * @param { string } prefix 앞머리.
	 * @returns { string[] } 정렬한 키 목록.
	 */
	listKeys(prefix) {
		return LocalStorage.getKeys().filter((key) => key.startsWith(prefix));
	}
}


//==============================================================================
// 메모리에만 두는 저장소. (시험, 끄면 없어진다)
//==============================================================================
/**
 * @example <caption>메모리 저장소의 키 목록</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const storage = new Experimental.MemorySaveStorage();
 * storage.writeText("save.slot.a.0", "text");
 * console.log(storage.listKeys("save.slot."));
 */
export class MemorySaveStorage extends SaveStorage {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Map<string, string> } */ #textByKey;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.#textByKey = new System.Map();
	}

	//==============================================================================
	// 읽기.
	//==============================================================================
	/**
	 * @param { string } key 키.
	 * @returns { string | null } 저장된 글. (없으면 null)
	 */
	readText(key) {
		return this.#textByKey.has(key) ? this.#textByKey.get(key) : null;
	}

	//==============================================================================
	// 쓰기.
	//==============================================================================
	/**
	 * @param { string } key 키.
	 * @param { string } text 쓸 글.
	 * @returns { boolean } 늘 참.
	 */
	writeText(key, text) {
		this.#textByKey.set(key, text);
		return true;
	}

	//==============================================================================
	// 지우기.
	//==============================================================================
	/**
	 * @param { string } key 지울 키.
	 */
	removeText(key) {
		this.#textByKey.delete(key);
	}

	//==============================================================================
	// 앞머리가 같은 키를 모두 읽기.
	//==============================================================================
	/**
	 * @param { string } prefix 앞머리.
	 * @returns { string[] } 정렬한 키 목록.
	 */
	listKeys(prefix) {
		const keys = System.Array.from(this.#textByKey.keys()).filter((key) => key.startsWith(prefix));
		keys.sort();
		return keys;
	}
}


//==============================================================================
// 클라우드 저장을 꽂을 자리. (인터페이스만, 스팀 클라우드 같은 것을 게임이나 플랫폼 묶음이 하위 클래스로 구현한다)
// - 주고받는 글은 SaveGameManager.exportSlot 의 JSON 이다. (체크섬이 들어 있어 받은 쪽이 깨졌는지 본다)
// - 함수는 동기다. 비동기 SDK 는 받아 둔 값을 돌려주는 식으로 감싼다.
//==============================================================================
/**
 * @example <caption>메모리 클라우드</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * class MemoryCloud extends Experimental.SaveCloudProvider {
 * 	textBySlot = new Map();
 * 	upload(slotId, exportedText) {
 * 		this.textBySlot.set(slotId, exportedText);
 * 		return true;
 * 	}
 * 	download(slotId) {
 * 		return this.textBySlot.get(slotId) ?? null;
 * 	}
 * 	remove(slotId) {
 * 		this.textBySlot.delete(slotId);
 * 	}
 * 	listSlotIds() {
 * 		return Array.from(this.textBySlot.keys());
 * 	}
 * }
 *
 * const cloud = new MemoryCloud();
 * console.log(cloud.upload("slot1", "{}"), cloud.listSlotIds());
 */
export class SaveCloudProvider {
	//==============================================================================
	// 올리기. (저장이 끝날 때마다 부른다)
	//==============================================================================
	/**
	 * @virtual
	 * @param { string } slotId 칸 이름.
	 * @param { string } exportedText exportSlot 의 JSON.
	 * @returns { boolean } 올렸으면 참.
	 */
	upload(slotId, exportedText) {
		return false;
	}

	//==============================================================================
	// 내려받기.
	//==============================================================================
	/**
	 * @virtual
	 * @param { string } slotId 칸 이름.
	 * @returns { string | null } exportSlot 의 JSON. (없으면 null)
	 */
	download(slotId) {
		return null;
	}

	//==============================================================================
	// 지우기. (칸을 지울 때 부른다)
	//==============================================================================
	/**
	 * @virtual
	 * @param { string } slotId 칸 이름.
	 */
	remove(slotId) {
		// 지우기.
	}

	//==============================================================================
	// 클라우드에 있는 칸 이름을 모두 읽기.
	//==============================================================================
	/**
	 * @virtual
	 * @returns { string[] } 칸 이름 목록.
	 */
	listSlotIds() {
		return [];
	}
}
