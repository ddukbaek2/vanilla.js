//==============================================================================
// 세이브 슬롯 초안 시험. (node tests/experimental/savegame.test.mjs)
// - 칸 쓰기와 읽기, 판 옮기기 사슬, 원자적 쓰기 끊김 흉내, 체크섬, 내보내기와 들여오기, 자동 저장, 클라우드 자리. (러스트 판 시험과 같은 값)
// - 기록 꼴이 러스트 판(vanilla-engine)과 글자까지 같은지 본다. (ORIGINAL_RECORD_TEXT 는 두 저장소의 시험에 같이 있다)
//==============================================================================
import { Experimental } from "../../import.js";

const { SaveGameManager, SaveGameError, SaveSlotOptions, SaveStorage, MemorySaveStorage, SaveCloudProvider, calculateCrc32 } = Experimental;
let checkCount = 0;
function check(condition, message) {
	checkCount++;
	if (!condition) {
		throw new Error("시험 실패: " + message);
	}
}
function isSameJson(left, right) {
	return JSON.stringify(left) === JSON.stringify(right);
}

// 쓰기 끊김과 반쯤 쓰기를 흉내 내는 저장소.
class SharedStorage extends SaveStorage {
	storage = new MemorySaveStorage();
	isWriteFailing = false;
	tornWriteLength = null;
	readText(key) {
		return this.storage.readText(key);
	}
	writeText(key, text) {
		if (this.isWriteFailing) {
			return false;
		}
		if (this.tornWriteLength !== null) {
			this.storage.writeText(key, Array.from(text).slice(0, this.tornWriteLength).join(""));
			return true;
		}
		return this.storage.writeText(key, text);
	}
	removeText(key) {
		this.storage.removeText(key);
	}
	listKeys(prefix) {
		return this.storage.listKeys(prefix);
	}
}

function createManager(currentVersion) {
	const storage = new SharedStorage();
	const saveGameManager = new SaveGameManager("test", currentVersion);
	saveGameManager.setStorage(storage);
	let clock = 1000000;
	saveGameManager.setTimeProvider(() => {
		clock += 1000;
		return clock;
	});
	return { saveGameManager, storage };
}

function createOptions(name, previewImage = "", metadata = {}) {
	const options = new SaveSlotOptions();
	options.name = name;
	options.previewImage = previewImage;
	options.metadata = metadata;
	return options;
}

//==============================================================================
// CRC-32 와 기록 꼴.
//==============================================================================
check(calculateCrc32("123456789") === 0xCBF43926, "CRC-32 검사 값");
check(calculateCrc32("") === 0, "빈 글 CRC-32");
const ORIGINAL_RECORD_TEXT = "VSAVE1 08bf5351\n{\"format\":\"vanilla-save\",\"formatVersion\":1,\"slotId\":\"slot1\",\"sequence\":1,\"name\":\"첫 칸\",\"savedTime\":1764100000000,\"version\":1,\"previewImage\":\"\",\"byteSize\":48,\"metadata\":{\"playSeconds\":75}}\n{\"hp\":10,\"name\":\"모험가\",\"items\":[\"검\",0.5]}";
{
	const storage = new SharedStorage();
	const saveGameManager = new SaveGameManager("fixture", 1);
	saveGameManager.setStorage(storage);
	saveGameManager.setTimeProvider(() => 1764100000000);
	saveGameManager.save("slot1", { hp: 10, name: "모험가", items: ["검", 0.5] }, createOptions("첫 칸", "", { playSeconds: 75 }));
	check(storage.readText("fixture.slot.slot1.0") === ORIGINAL_RECORD_TEXT, "러스트 판과 같은 기록 글");
	storage.storage.writeText("fixture.slot.slot2.1", ORIGINAL_RECORD_TEXT);
	check(saveGameManager.load("slot2").error === SaveGameError.Corrupted, "칸 이름이 다른 기록");
	check(saveGameManager.load("slot1").data.items[1] === 0.5, "기록 읽기");
}

//==============================================================================
// 칸 쓰기와 읽기, 두 키 번갈아 쓰기, 목록 차례, 지우기.
//==============================================================================
{
	const { saveGameManager, storage } = createManager(1);
	const options = createOptions("첫 칸", "data:image/png;base64,AA==", { playSeconds: 75 });
	const first = saveGameManager.save("slot1", { hp: 10 }, options);
	check(first.isSuccess && first.info.sequence === 1 && first.info.byteSize === "{\"hp\":10}".length, "첫 저장");
	check(saveGameManager.save("slot1", { hp: 7 }, options).info.sequence === 2, "둘째 저장");
	check(storage.readText("test.slot.slot1.0") !== null && storage.readText("test.slot.slot1.1") !== null, "두 키");
	saveGameManager.save("slot2", [1, 2, 3], new SaveSlotOptions());
	const result = saveGameManager.load("slot1");
	check(isSameJson(result.data, { hp: 7 }) && result.info.metadata.playSeconds === 75 && !result.isRecoveredFromBackup, "읽기");
	check(isSameJson(saveGameManager.listSlots().map((info) => info.slotId), ["slot2", "slot1"]), "목록 차례");
	check(saveGameManager.load("slot3").error === SaveGameError.NotFound, "없는 칸");
	check(saveGameManager.save("bad id", 1, options).error === SaveGameError.InvalidSlotId, "틀린 칸 이름");
	check(saveGameManager.save("slot4", undefined, options).error === SaveGameError.InvalidData, "JSON 이 안 되는 자료");
	saveGameManager.delete("slot1");
	check(!saveGameManager.exists("slot1"), "지우기");
}

//==============================================================================
// 판 옮기기 사슬, 새 판 세이브 거절, 빠진 함수와 실패한 함수.
//==============================================================================
{
	const { saveGameManager: oldManager, storage } = createManager(1);
	oldManager.save("slot1", { gold: 5 }, new SaveSlotOptions());
	const newManager = new SaveGameManager("test", 3);
	newManager.setStorage(storage);
	const missing = newManager.load("slot1");
	check(missing.error === SaveGameError.MissingMigration && missing.detail.fromVersion === 1, "빠진 옮기기");
	newManager.addMigration(1, (data) => {
		data.coins = data.gold;
		data.gold = null;
		return data;
	});
	newManager.addMigration(2, (data) => {
		data.gems = 0;
		return data;
	});
	const migrated = newManager.load("slot1");
	check(isSameJson(migrated.data, { gold: null, coins: 5, gems: 0 }) && migrated.migratedFromVersion === 1, "옮기기 사슬");
	newManager.addMigration(2, () => {
		throw new Error("깨진 판");
	});
	const failed = newManager.load("slot1");
	check(failed.error === SaveGameError.MigrationFailed && failed.detail.fromVersion === 2 && failed.detail.message === "깨진 판", "실패한 옮기기");
	newManager.save("slot2", {}, new SaveSlotOptions());
	const newer = oldManager.load("slot2");
	check(newer.error === SaveGameError.NewerVersion && newer.detail.version === 3 && newer.detail.currentVersion === 1, "새 판 거절");
}

//==============================================================================
// 원자적 쓰기: 쓰기 실패와 쓰다 끊긴 기록에도 앞 저장이 남는다. 체크섬이 바뀐 바이트를 잡는다.
//==============================================================================
{
	const { saveGameManager, storage } = createManager(1);
	saveGameManager.save("slot1", { stage: 1 }, new SaveSlotOptions());
	storage.isWriteFailing = true;
	check(saveGameManager.save("slot1", { stage: 2 }, new SaveSlotOptions()).error === SaveGameError.WriteFailed, "쓰기 실패");
	storage.isWriteFailing = false;
	check(saveGameManager.load("slot1").data.stage === 1, "실패 뒤 앞 저장");
	storage.tornWriteLength = 30;
	saveGameManager.save("slot1", { stage: 3 }, new SaveSlotOptions());
	storage.tornWriteLength = null;
	const recovered = saveGameManager.load("slot1");
	check(recovered.data.stage === 1 && recovered.isRecoveredFromBackup, "끊긴 기록 뒤 앞 저장");
	check(saveGameManager.save("slot1", { stage: 4 }, new SaveSlotOptions()).info.sequence === 2, "순번 잇기");
	check(saveGameManager.load("slot1").data.stage === 4, "새 저장");
	const key = "test.slot.slot1.1";
	storage.storage.writeText(key, storage.readText(key).replace("\"stage\":4", "\"stage\":5"));
	check(saveGameManager.load("slot1").data.stage === 1, "바뀐 바이트");
	storage.storage.writeText("test.slot.slot1.0", "VSAVE1 00000000\n{}\n{}");
	check(saveGameManager.load("slot1").error === SaveGameError.Corrupted, "모두 깨짐");
	check(saveGameManager.listSlots()[0].isCorrupted, "깨진 칸 목록");
}

//==============================================================================
// 내보내기와 들여오기, 깨진 글 거절, 자동 저장 간격, 클라우드 올리기와 받기.
//==============================================================================
{
	const { saveGameManager } = createManager(1);
	saveGameManager.save("slot1", { name: "모험가", items: ["검", "방패"] }, createOptions("내보낼 칸"));
	const exported = saveGameManager.exportSlot("slot1");
	const imported = saveGameManager.importSlot("slot9", exported.text);
	check(imported.isSuccess && imported.info.name === "내보낼 칸", "들여오기");
	check(saveGameManager.load("slot9").data.items[1] === "방패", "들인 칸 읽기");
	check(saveGameManager.importSlot("slot8", exported.text.replace("모험가", "도적")).error === SaveGameError.InvalidImport, "깨진 글");
	check(saveGameManager.importSlot("slot8", "{}").error === SaveGameError.InvalidImport, "틀린 꼴");
	let counter = 0;
	saveGameManager.setAutosave("auto", 10, new SaveSlotOptions(), () => {
		counter++;
		return { count: counter };
	});
	check(saveGameManager.update(4) === null && saveGameManager.update(4) === null, "자동 저장 전");
	check(saveGameManager.update(4).isSuccess, "자동 저장");
	check(saveGameManager.update(9) === null, "자동 저장 다시 잼");
	check(saveGameManager.load("auto").data.count === 1, "자동 저장 자료");
	check(saveGameManager.saveAutosaveNow().isSuccess && saveGameManager.load("auto").data.count === 2, "지금 자동 저장");
	class MemoryCloud extends SaveCloudProvider {
		textBySlot = new Map();
		upload(slotId, exportedText) {
			this.textBySlot.set(slotId, exportedText);
			return true;
		}
		download(slotId) {
			return this.textBySlot.has(slotId) ? this.textBySlot.get(slotId) : null;
		}
		remove(slotId) {
			this.textBySlot.delete(slotId);
		}
		listSlotIds() {
			return Array.from(this.textBySlot.keys());
		}
	}
	const cloud = new MemoryCloud();
	saveGameManager.setCloudProvider(cloud);
	saveGameManager.save("cloud", { from: "this" }, new SaveSlotOptions());
	check(cloud.textBySlot.has("cloud"), "클라우드 올리기");
	check(!saveGameManager.pullFromCloud("cloud").isImported, "더 새 것 없음");
	const { saveGameManager: otherManager } = createManager(1);
	otherManager.setTimeProvider(() => 9000000);
	otherManager.save("cloud", { from: "other" }, new SaveSlotOptions());
	cloud.textBySlot.set("cloud", otherManager.exportSlot("cloud").text);
	check(saveGameManager.pullFromCloud("cloud").isImported, "클라우드 받기");
	check(saveGameManager.load("cloud").data.from === "other", "받은 자료");
	saveGameManager.delete("cloud");
	check(!cloud.textBySlot.has("cloud"), "클라우드 지우기");
}
console.log(`세이브 슬롯 시험 ${checkCount} 개 통과`);
