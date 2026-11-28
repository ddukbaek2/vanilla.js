//==============================================================================
// 저장 시험: LocalStorage, PersistedStore, JSON 쓰기 글. (node tests/misc/storage.test.mjs)
// - 러스트 판 짝: src/misc/localstorage.rs 의 number_text_matches_java_script, storage_round_trip_through_file(파일 대신 맵 저장소),
//   json_round_trip, backend_and_memory_fallback,
//   src/misc/persistedstore.rs 의 store_round_trip_and_version, store_storage_backend, array_state_merges_with_index_keys,
//   keeps_lone_surrogate_written_by_original,
//   src/misc/storagetext.rs 의 stringifies_like_js_json_stringify, matches_serde_json_without_lone_surrogate, keeps_escaped_lone_surrogate.
// - node 에는 window.localStorage 가 없어 맵으로 지은 저장소(Storage 꼴)를 window.localStorage 로 둔다.
// - JSON 쓰기 글은 러스트 판 storagetext 가 원본 JSON.stringify 와 글자까지 같게 내야 하는 기대 글이다. (여기서는 원본 쪽 값이 맞는지 본다)
//==============================================================================
import { LocalStorage } from "../../src/misc/localstorage.js";
import { PersistedStore } from "../../src/misc/persistedstore.js";
import { check, checkEqual, checkJson, finish } from "../testcheck.mjs";

// 맵 저장소. (브라우저 Storage 꼴: getItem, setItem, removeItem, key, length, clear)
function createMapStorage(isBlocked = false) {
	const itemMap = new Map();
	return {
		itemMap,
		getItem(key) {
			return itemMap.has(key) ? itemMap.get(key) : null;
		},
		setItem(key, value) {
			if (isBlocked) {
				throw new Error("blocked");
			}
			itemMap.set(key, String(value));
		},
		removeItem(key) {
			itemMap.delete(key);
		},
		key(index) {
			return Array.from(itemMap.keys())[index] ?? null;
		},
		get length() {
			return itemMap.size;
		},
		clear() {
			itemMap.clear();
		},
	};
}
const windowStorage = createMapStorage();
globalThis.window = globalThis.window || {};
Object.defineProperty(globalThis.window, "localStorage", { value: windowStorage, configurable: true });

// JSON.stringify 글. (러스트 판 storagetext 의 기대 글)
const numberValue = JSON.parse(String.raw`{"b":1.0,"10":2,"2":-0.0,"a":[1e21,1e-7,123456789012345680000,0.000001,1.5e-7,5e-324,1.7976931348623157e308,100,1e16],"01":"x","4294967295":0,"4294967294":1}`);
checkEqual(JSON.stringify(numberValue), String.raw`{"2":0,"10":2,"4294967294":1,"b":1,"a":[1e+21,1e-7,123456789012345680000,0.000001,1.5e-7,5e-324,1.7976931348623157e+308,100,10000000000000000],"01":"x","4294967295":0}`, "JSON.stringify number");
checkEqual(JSON.stringify(numberValue, null, "\t"), "{\n\t\"2\": 0,\n\t\"10\": 2,\n\t\"4294967294\": 1,\n\t\"b\": 1,\n\t\"a\": [\n\t\t1e+21,\n\t\t1e-7,\n\t\t123456789012345680000,\n\t\t0.000001,\n\t\t1.5e-7,\n\t\t5e-324,\n\t\t1.7976931348623157e+308,\n\t\t100,\n\t\t10000000000000000\n\t],\n\t\"01\": \"x\",\n\t\"4294967295\": 0\n}", "JSON.stringify number 띄어쓰기 " + "\t");
const nestedValue = JSON.parse(String.raw`[[],{},[{}],{"k":[1,{"z":null}]},"\u001f\u007f\u2028"]`);
checkEqual(JSON.stringify(nestedValue), "[[],{},[{}],{\"k\":[1,{\"z\":null}]},\"\\u001f\u{7f}\u{2028}\"]", "JSON.stringify nested");
checkEqual(JSON.stringify(nestedValue, null, "\t"), "[\n\t[],\n\t{},\n\t[\n\t\t{}\n\t],\n\t{\n\t\t\"k\": [\n\t\t\t1,\n\t\t\t{\n\t\t\t\t\"z\": null\n\t\t\t}\n\t\t]\n\t},\n\t\"\\u001f\u{7f}\u{2028}\"\n]", "JSON.stringify nested 띄어쓰기 " + "\t");
checkEqual(JSON.stringify(nestedValue, null, "12345678901234"), "[\n1234567890[],\n1234567890{},\n1234567890[\n12345678901234567890{}\n1234567890],\n1234567890{\n12345678901234567890\"k\": [\n1234567890123456789012345678901,\n123456789012345678901234567890{\n1234567890123456789012345678901234567890\"z\": null\n123456789012345678901234567890}\n12345678901234567890]\n1234567890},\n1234567890\"\\u001f\u{7f}\u{2028}\"\n]", "JSON.stringify nested 띄어쓰기 " + "12345678901234");
checkEqual(JSON.stringify(nestedValue, null, ""), JSON.stringify(nestedValue), "빈 띄어쓰기");
checkEqual(JSON.stringify("a\"b\\\n\u{1}\u{7f}"), "\"a\\\"b\\\\\\n\\u0001\u{7f}\"", "글 따옴표");
const serdeText = "{ \"name\" : \"가나 😀 \\\"q\\\" \\n\\t\\u0001/\\/\", \"list\": [1, -2.5, 3e2, 0.1, true, false, null, {\"a\": []}], \"empty\": {}, \"big\": 12345678901234567890 }";
checkEqual(JSON.stringify(JSON.parse(serdeText)), "{\"name\":\"가나 😀 \\\"q\\\" \\n\\t\\u0001//\",\"list\":[1,-2.5,300,0.1,true,false,null,{\"a\":[]}],\"empty\":{},\"big\":12345678901234567000}", "JSON 다시 쓰기");
for (const brokenText of ["", "{", "[1,]", "{\"a\":1,}", "01", "1.", ".5", "\"a\nb\"", "\"\\x\"", "nul", "[1] 2", "\ufeff{}", "+1"]) {
	let isError = false;
	try {
		JSON.parse(brokenText);
	}
	catch (error) {
		isError = true;
	}
	check(isError, JSON.stringify(brokenText) + " 는 틀린 JSON");
}
const surrogateStoredText = "{\"version\":1,\"state\":{\"name\":\"a\\ud83d\",\"list\":[\"\\ude00b\",\"ok\"]}}";
checkEqual(JSON.stringify(JSON.parse(surrogateStoredText)), surrogateStoredText, "짝 없는 서로게이트 다시 쓰기");

// 숫자 글: 원본 String(수), Number(글).
const numberFormatList = [[1, "1"], [1.5, "1.5"], [-0, "0"], [NaN, "NaN"], [-Infinity, "-Infinity"], [1e21, "1e+21"], [1.5e21, "1.5e+21"], [123456789012345680000, "123456789012345680000"], [1e-7, "1e-7"], [0.000001, "0.000001"], [-2.5e-8, "-2.5e-8"], [0.1 + 0.2, "0.30000000000000004"]];
for (const [numberValue, expectedText] of numberFormatList) {
	LocalStorage.setNumber("number", numberValue);
	checkEqual(LocalStorage.getString("number"), expectedText, "setNumber(" + numberValue + ")");
}
const numberParseList = [[" 12 ", 12], ["Infinity", Infinity], ["abc", NaN], ["inf", NaN], ["0x10", 16], ["0X1f", 31], ["0o17", 15], ["0b101", 5], ["-0x10", NaN], ["0x", NaN], ["0x1g", NaN],
	["0x20000000000001", 9007199254740992], ["0x20000000000003", 9007199254740996], ["1.", 1], [".5", 0.5], ["+.5e1", 5], ["1E+2", 100], ["00012", 12], ["-0", -0], ["-Infinity", -Infinity],
	["1e", NaN], [".", NaN], ["1_000", NaN], ["12px", NaN], ["infinity", NaN], ["\ufeff\u30007\u2028", 7], ["\u00857", NaN], ["1e400", Infinity]];
for (const [numberText, expectedValue] of numberParseList) {
	LocalStorage.setString("number", numberText);
	checkEqual(LocalStorage.getNumber("number"), expectedValue, "getNumber(" + JSON.stringify(numberText) + ")");
}
LocalStorage.remove("number");

// 쓰고 다시 읽기, 기본값은 저장하지 않음, 접두사 지우기, 키 목록.
LocalStorage.setString("game.name", "바닐라");
LocalStorage.setBoolean("game.sound", false);
LocalStorage.setNumber("game.best", 1234.5);
LocalStorage.setString("other", "x");
checkEqual(LocalStorage.getString("game.name", ""), "바닐라", "getString");
checkEqual(LocalStorage.getBoolean("game.sound", true), false, "getBoolean");
checkEqual(LocalStorage.getNumber("game.best", 0), 1234.5, "getNumber");
checkEqual(LocalStorage.containsKey("other"), true, "containsKey");
checkEqual(LocalStorage.getNumber("game.level", 3), 3, "없는 getNumber 기본값");
checkEqual(LocalStorage.getString("game.level", "9"), "9", "없는 getString 기본값");
checkEqual(LocalStorage.getBoolean("game.vibration", true), true, "없는 getBoolean 기본값");
checkEqual(LocalStorage.containsKey("game.vibration"), false, "기본값은 저장하지 않음");
LocalStorage.setNumber("game.level", 3);
LocalStorage.setBoolean("game.vibration", true);
checkJson(LocalStorage.getKeys(), ["game.best", "game.level", "game.name", "game.sound", "game.vibration", "other"], "getKeys 정렬");
checkEqual(LocalStorage.clearByPrefix("game."), 5, "clearByPrefix");
checkEqual(LocalStorage.clearByPrefix(""), 0, "빈 접두사 clearByPrefix");
checkJson(LocalStorage.getKeys(), ["other"], "접두사 지운 뒤 키");
LocalStorage.remove("other");
checkEqual(LocalStorage.containsKey("other"), false, "remove");
LocalStorage.setString("again", "1");
LocalStorage.clear();
checkJson(LocalStorage.getKeys(), [], "clear");

// JSON 읽기와 쓰기. (깨진 글은 기본값)
LocalStorage.setJson("table", { a: 1, b: [2, 3] });
checkEqual(LocalStorage.getJson("table", null).b[1], 3, "getJson");
LocalStorage.setString("broken", "{not json");
checkEqual(LocalStorage.getJson("broken", "default"), "default", "깨진 getJson");
checkEqual(LocalStorage.getJson("missing", 7), 7, "없는 getJson");
LocalStorage.clear();

// 저장소 갈아 끼우기와 막혔을 때 메모리로 대신하기.
const backendStorage = createMapStorage();
backendStorage.getKeys = () => Array.from(backendStorage.itemMap.keys());
LocalStorage.setBackend(backendStorage);
checkEqual(LocalStorage.getBackend(), backendStorage, "getBackend");
LocalStorage.setString("game.a", "1");
LocalStorage.setNumber("game.b", 2);
LocalStorage.setString("other", "x");
checkEqual(backendStorage.itemMap.get("game.a"), "1", "갈아 끼운 저장소에 씀");
checkJson(LocalStorage.getKeys(), ["game.a", "game.b", "other"], "갈아 끼운 저장소 키");
checkEqual(LocalStorage.clearByPrefix("game."), 2, "갈아 끼운 저장소 clearByPrefix");
LocalStorage.clear();
checkEqual(backendStorage.itemMap.size, 0, "갈아 끼운 저장소 clear");
const blockedStorage = createMapStorage(true);
blockedStorage.getKeys = () => Array.from(blockedStorage.itemMap.keys());
LocalStorage.setBackend(blockedStorage);
const originalWarn = console.warn;
console.warn = () => {};
checkEqual(LocalStorage.setItem("save", "slot1"), false, "막힌 저장소 setItem");
console.warn = originalWarn;
checkEqual(LocalStorage.isMemoryFallback(), true, "메모리로 대신함");
checkEqual(LocalStorage.getString("save", ""), "slot1", "메모리 값 읽기");
checkJson(LocalStorage.getKeys(), ["save"], "메모리 값 키");
LocalStorage.remove("save");
checkEqual(LocalStorage.containsKey("save"), false, "메모리 값 지우기");
LocalStorage.setBackend(null);
checkEqual(LocalStorage.getBackend(), null, "되돌린 getBackend");
checkEqual(LocalStorage.isMemoryFallback(), false, "되돌리면 메모리 대신 끝");
LocalStorage.clear();

// PersistedStore: 저장, 다시 읽기, 병합, 구독, 판 번호가 다르면 기본값.
{
	const store = new PersistedStore("game.settings", { volume: 0.8, isMuted: false }, 2);
	checkEqual(store.get().volume, 0.8, "기본 volume");
	let notifyCount = 0;
	const subscription = store.subscribe((state) => {
		check(state.volume !== undefined, "알림 상태에 volume");
		notifyCount++;
	});
	store.set({ volume: 0.5, language: "ko" });
	checkEqual(notifyCount, 1, "set 알림");
	checkEqual(store.get().isMuted, false, "병합 뒤 isMuted");
	const reloadedStore = new PersistedStore("game.settings", { volume: 0.8, isMuted: false, isVibration: true }, 2);
	checkJson([reloadedStore.get().volume, reloadedStore.get().language, reloadedStore.get().isVibration], [0.5, "ko", true], "다시 읽기");
	checkJson(new PersistedStore("game.settings", { volume: 0.8 }, 3).get(), { volume: 0.8 }, "판 번호가 다르면 기본값");
	LocalStorage.setString("game.broken", "{not json");
	checkJson(new PersistedStore("game.broken", { count: 1 }, 1).get(), { count: 1 }, "깨진 글이면 기본값");
	store.unsubscribe(subscription);
	store.reset();
	checkEqual(notifyCount, 1, "구독을 끊은 뒤 알림 없음");
	checkJson(store.get(), { volume: 0.8, isMuted: false }, "reset");
	checkEqual(store.getStorageKey(), "game.settings", "getStorageKey");
}

// PersistedStore 저장소 하나만 다른 곳에 두기. (갈아 끼우면 다시 읽고 알린다)
{
	const store = new PersistedStore("settings", { volume: 1 }, 1);
	store.set({ volume: 0.5 });
	let notifiedVolume = null;
	store.subscribe((state) => {
		notifiedVolume = state.volume;
	});
	const storeBackend = createMapStorage();
	store.setStorageBackend(storeBackend);
	checkEqual(store.getStorageBackend().getItem("settings"), null, "새 저장소는 비어 있음");
	checkEqual(store.get().volume, 1, "갈아 끼우면 다시 읽음");
	checkEqual(notifiedVolume, 1, "갈아 끼우면 알림");
	store.set({ volume: 0.25 });
	checkEqual(storeBackend.itemMap.get("settings"), "{\"version\":1,\"state\":{\"volume\":0.25}}", "갈아 끼운 저장소 글");
	store.setStorageBackend(null);
	checkEqual(store.get().volume, 0.5, "되돌리면 기본 저장소 값");
}

// 배열은 Object.assign 처럼 번호 키로 섞고, 번호 키를 앞에 둔다.
{
	LocalStorage.setString("game.array", "{\"version\":1,\"state\":[\"x\",\"y\"]}");
	const store = new PersistedStore("game.array", { b: 1, z: 0 }, 1);
	checkEqual(JSON.stringify(store.get()), "{\"0\":\"x\",\"1\":\"y\",\"b\":1,\"z\":0}", "배열 상태 섞기");
	checkEqual(store.readStoredText(), "{\"version\":1,\"state\":[\"x\",\"y\"]}", "저장 글 그대로");
	store.set(["w"]);
	checkJson([store.get()["0"], store.get()["1"]], ["w", "y"], "배열 set");
	store.set({ 10: true, 2: false, a: null });
	checkEqual(JSON.stringify(store.get()), "{\"0\":\"w\",\"1\":\"y\",\"2\":false,\"10\":true,\"b\":1,\"z\":0,\"a\":null}", "번호 키 앞");
	store.replace(7);
	checkJson(store.get(), {}, "객체가 아닌 replace 는 빈 상태");
}

// 원본이 저장한 짝 없는 서로게이트가 든 글.
{
	LocalStorage.setString("game.profile", "{\"version\":1,\"state\":{\"name\":\"a\\ud83d\",\"best\":3}}");
	const store = new PersistedStore("game.profile", { name: "", best: 0 }, 1);
	checkEqual(store.get().best, 3, "서로게이트 글 best");
	checkEqual(store.get().name, "a\ud83d", "원본은 짝 없는 서로게이트를 그대로 든다 (러스트 판은 보이는 값이 대체 문자)");
	store.set({ best: 4 });
	checkEqual(store.readStoredText(), "{\"version\":1,\"state\":{\"name\":\"a\\ud83d\",\"best\":4}}", "다른 칸 고친 뒤 글");
	store.set({ name: "b" });
	checkEqual(store.readStoredText(), "{\"version\":1,\"state\":{\"name\":\"b\",\"best\":4}}", "고친 칸 글");
}

finish("tests/misc/storage.test.mjs");
