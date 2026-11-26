//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { LocalSaveStorage, SaveCloudProvider, SaveStorage } from "./savestorage.js";


// 기록 머리 줄의 표시와 형식 판.
const RECORD_MAGIC = "VSAVE1";
const RECORD_FORMAT = "vanilla-save";
const EXPORT_FORMAT = "vanilla-save-export";
const FORMAT_VERSION = 1;
// 칸 이름의 가장 긴 길이.
const MAXIMUM_SLOT_ID_LENGTH = 64;
// 칸 이름에 쓰는 글자. (영문, 숫자, _, -)
const SLOT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;


//==============================================================================
// 세이브 실패 까닭. (러스트 판 SaveGameError 의 이름과 같다, InvalidData 는 JS 만)
//==============================================================================
export const SaveGameError = System.Object.freeze({
	InvalidSlotId: "InvalidSlotId", // 칸 이름이 비었거나 쓸 수 없는 글자가 있다.
	NotFound: "NotFound", // 칸에 기록이 없다.
	Corrupted: "Corrupted", // 기록이 있으나 모두 깨졌다. (체크섬이 맞지 않거나 꼴이 틀림)
	NewerVersion: "NewerVersion", // 지금 판보다 새 판의 세이브다. (detail: { version, currentVersion })
	MissingMigration: "MissingMigration", // 이 판에서 다음 판으로 옮기는 함수가 없다. (detail: { fromVersion })
	MigrationFailed: "MigrationFailed", // 판 옮기는 함수가 실패했다. (detail: { fromVersion, message })
	WriteFailed: "WriteFailed", // 저장소에 쓰지 못했다. (LocalStorage 는 이 페이지가 살아 있는 동안 메모리에 대신 둔다)
	InvalidImport: "InvalidImport", // 들여올 글이 내보낸 꼴이 아니거나 깨졌다.
	InvalidData: "InvalidData", // 자료를 JSON 으로 바꿀 수 없다. (undefined, 순환, BigInt, JS 만)
});


// UTF-8 바꾸개.
const textEncoder = new System.TextEncoder();
// CRC-32 표. (처음 쓸 때 짓는다)
let crc32Table = null;


//==============================================================================
// CRC-32. (IEEE 802.3, 다항식 0xEDB88320 을 거꾸로 돌린 꼴, 처음과 끝에 0xFFFFFFFF, zlib crc32 와 같다, 글은 UTF-8 바이트로 셈한다)
//==============================================================================
/**
 * @param { string | Uint8Array } input 셀 글이나 바이트.
 * @returns { number } CRC-32 값. (0 ~ 0xFFFFFFFF)
 * @example <caption>잘 알려진 검사 값</caption>
 * import { Experimental } from "./build/vanilla.js";
 *
 * console.log(Experimental.calculateCrc32("123456789").toString(16));
 */
export function calculateCrc32(input) {
	if (crc32Table === null) {
		crc32Table = new System.Uint32Array(256);
		for (let index = 0; index < 256; ++index) {
			let value = index;
			for (let bit = 0; bit < 8; ++bit) {
				value = (value & 1) !== 0 ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
			}
			crc32Table[index] = value >>> 0;
		}
	}
	const bytes = typeof input === "string" ? textEncoder.encode(input) : input;
	let crc = 0xFFFFFFFF;
	for (let index = 0; index < bytes.length; ++index) {
		crc = crc32Table[(crc ^ bytes[index]) & 0xFF] ^ (crc >>> 8);
	}
	return (crc ^ 0xFFFFFFFF) >>> 0;
}


//==============================================================================
// 칸 하나의 머리. (러스트 판 SaveSlotInfo)
//==============================================================================
/**
 * @example <caption>빈 머리</caption>
 * import { Experimental } from "./build/vanilla.js";
 *
 * const info = new Experimental.SaveSlotInfo();
 * console.log(info.slotId, info.isCorrupted);
 */
export class SaveSlotInfo {
	/** @type { string } */ slotId = ""; // 칸 이름. (영문, 숫자, _, - 로 64 자까지)
	/** @type { string } */ name = ""; // 보이는 이름. (저장할 때 준 것)
	/** @type { number } */ savedTime = 0; // 저장한 시각. (1970-01-01 UTC 부터의 밀리초, Date.now())
	/** @type { number } */ version = 0; // 자료의 판.
	/** @type { string } */ previewImage = ""; // 미리보기 그림 자리. (데이터 URL 이나 애셋 경로 같은 글, 없으면 빈 글)
	/** @type { number } */ byteSize = 0; // 자료 JSON 의 UTF-8 바이트 수.
	/** @type { number } */ sequence = 0; // 쓴 차례. (칸마다 1 부터 오른다)
	/** @type { object } */ metadata = {}; // 게임이 정한 값. (놀이 시간, 장 이름 같은 것)
	/** @type { boolean } */ isCorrupted = false; // 읽을 수 있는 기록이 없는 칸인지. (두 키가 모두 깨짐, 나머지 칸은 빈 값)
}


//==============================================================================
// 저장할 때 주는 머리 값. (러스트 판 SaveSlotOptions)
//==============================================================================
/**
 * @example <caption>이름과 놀이 시간을 단 저장 값</caption>
 * import { Experimental } from "./build/vanilla.js";
 *
 * const options = new Experimental.SaveSlotOptions();
 * options.name = "Chapter 1";
 * options.metadata = { playSeconds: 600 };
 * console.log(options.name, options.previewImage === "");
 */
export class SaveSlotOptions {
	/** @type { string } */ name = ""; // 보이는 이름.
	/** @type { string } */ previewImage = ""; // 미리보기 그림 자리. (데이터 URL 이나 애셋 경로 같은 글)
	/** @type { object } */ metadata = {}; // 게임이 정한 값. (JSON 객체)
}


//==============================================================================
// 칸 이름 검사. (영문, 숫자, _, - 로 1 ~ 64 자)
//==============================================================================
function isValidSlotId(slotId) {
	return typeof slotId === "string" && slotId.length > 0 && slotId.length <= MAXIMUM_SLOT_ID_LENGTH && SLOT_ID_PATTERN.test(slotId);
}

//==============================================================================
// 머리 JSON 짓기. (러스트 판과 같은 칸 차례)
//==============================================================================
function buildHeaderText(info) {
	return System.JSON.stringify({
		format: RECORD_FORMAT,
		formatVersion: FORMAT_VERSION,
		slotId: info.slotId,
		sequence: info.sequence,
		name: info.name,
		savedTime: info.savedTime,
		version: info.version,
		previewImage: info.previewImage,
		byteSize: info.byteSize,
		metadata: info.metadata,
	});
}

//==============================================================================
// 기록 글 짓기. ("VSAVE1 <CRC-32 16진 8자>\n<머리>\n<자료>")
//==============================================================================
function buildRecordText(info, bodyText) {
	const content = buildHeaderText(info) + "\n" + bodyText;
	return RECORD_MAGIC + " " + calculateCrc32(content).toString(16).padStart(8, "0") + "\n" + content;
}

//==============================================================================
// 기록 글 풀기. (체크섬, 꼴, 칸 이름이 맞아야 한다. expectedSlotId 가 null 이면 칸 이름은 보지 않는다, 틀리면 null)
//==============================================================================
function parseRecordText(recordText, expectedSlotId) {
	if (typeof recordText !== "string") {
		return null;
	}
	const firstBreak = recordText.indexOf("\n");
	if (firstBreak < 0) {
		return null;
	}
	const firstLine = recordText.slice(0, firstBreak);
	const content = recordText.slice(firstBreak + 1);
	const space = firstLine.indexOf(" ");
	if (space < 0 || firstLine.slice(0, space) !== RECORD_MAGIC) {
		return null;
	}
	const checksumText = firstLine.slice(space + 1);
	if (!/^[0-9a-fA-F]{8}$/.test(checksumText) || System.parseInt(checksumText, 16) !== calculateCrc32(content)) {
		return null;
	}
	const secondBreak = content.indexOf("\n");
	if (secondBreak < 0) {
		return null;
	}
	let header;
	try {
		header = System.JSON.parse(content.slice(0, secondBreak));
	}
	catch (error) {
		return null;
	}
	if (header === null || typeof header !== "object" || header.format !== RECORD_FORMAT || header.formatVersion !== FORMAT_VERSION) {
		return null;
	}
	const isText = (value) => typeof value === "string";
	const isInteger = (value) => System.Number.isInteger(value) && value >= 0;
	if (!isText(header.slotId) || !isText(header.name) || !isText(header.previewImage) || !isInteger(header.savedTime) || !isInteger(header.version) || !isInteger(header.byteSize) || !isInteger(header.sequence)) {
		return null;
	}
	if (expectedSlotId !== null && header.slotId !== expectedSlotId) {
		return null;
	}
	const info = new SaveSlotInfo();
	info.slotId = header.slotId;
	info.name = header.name;
	info.savedTime = header.savedTime;
	info.version = header.version;
	info.previewImage = header.previewImage;
	info.byteSize = header.byteSize;
	info.sequence = header.sequence;
	info.metadata = header.metadata !== undefined ? header.metadata : {};
	return { info, bodyText: content.slice(secondBreak + 1), recordText };
}

//==============================================================================
// 내보내기 글 짓기. ({"format":"vanilla-save-export","formatVersion":1,"record":"..."})
//==============================================================================
function buildExportText(recordText) {
	return System.JSON.stringify({ format: EXPORT_FORMAT, formatVersion: FORMAT_VERSION, record: recordText });
}

//==============================================================================
// 내보내기 글 풀기. (꼴과 체크섬이 맞아야 한다, 틀리면 null)
//==============================================================================
function parseExportText(exportedText) {
	let exported;
	try {
		exported = System.JSON.parse(exportedText);
	}
	catch (error) {
		return null;
	}
	if (exported === null || typeof exported !== "object" || exported.format !== EXPORT_FORMAT || exported.formatVersion !== FORMAT_VERSION) {
		return null;
	}
	return parseRecordText(exported.record, null);
}

// 실패 결과 짓기.
function createFailure(error, detail = null) {
	return { isSuccess: false, error, detail };
}


//==============================================================================
// 세이브 슬롯 관리.
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 칸(slot)마다 JSON 자료 하나와 머리(이름, 저장 시각, 판, 미리보기 그림, 크기, 게임이 정한 metadata)를 둔다.
// - 기록 꼴: "VSAVE1 <CRC-32 16진 8자>\n<머리 JSON>\n<자료 JSON>". CRC-32 는 둘째 줄부터 끝까지의 UTF-8 에 대해 셈한다.
//   러스트 판(vanilla-engine)과 같은 꼴이라 두 엔진이 서로의 세이브를 읽는다. (같은 키를 쓰는 저장소일 때)
// - 원자적 쓰기: 칸마다 키 두 개(<이름공간>.slot.<칸>.0 과 .1)를 번갈아 쓴다. 새 기록은 앞 기록이 없는 쪽 키에 순번을 하나 올려 쓰고,
//   읽을 때는 체크섬이 맞는 것 가운데 순번이 가장 큰 것을 고른다. 쓰다 끊기거나(탭이 닫힘, 저장소가 가득 참) 기록이 깨져도 앞 저장이 남는다.
//   한 키 쓰기는 localStorage.setItem 처럼 다 되거나 안 되어야 한다.
// - 판 옮기기: 자료에 판(version)을 적고, 읽을 때 지금 판보다 낮으면 addMigration 으로 건 함수를 판마다 차례로 부른다. (v → v + 1)
//   지금 판보다 높은 세이브(새 판 게임이 쓴 것)는 읽지 않는다.
// - 자동 저장: setAutosave 로 칸, 간격, 자료를 주는 함수를 걸고 매 프레임 update 를 부른다.
// - 내보내기와 들여오기: exportSlot 은 기록을 그대로 담은 JSON 글, importSlot 은 체크섬을 보고 다른 칸에도 들인다.
// - 클라우드: setCloudProvider 로 SaveCloudProvider 를 꽂으면 저장마다 올리고, pullFromCloud 로 더 새 것을 받아 들인다. (인터페이스만)
// - 결과는 { isSuccess, error(SaveGameError 의 글이나 null), detail, ... } 객체다. (러스트 판의 Result 자리)
//==============================================================================
/**
 * @example <caption>칸에 저장하고 판 옮겨 읽기</caption>
 * import { Experimental } from "./build/vanilla.js";
 *
 * const saveGameManager = new Experimental.SaveGameManager("example", 2);
 * saveGameManager.setStorage(new Experimental.MemorySaveStorage());
 * saveGameManager.addMigration(1, (data) => {
 * 	data.coins = data.gold;
 * 	delete data.gold;
 * 	return data;
 * });
 * const options = new Experimental.SaveSlotOptions();
 * options.name = "Forest Gate";
 * const saveResult = saveGameManager.save("slot1", { coins: 120, level: 3 }, options);
 * const loadResult = saveGameManager.load("slot1");
 * console.log(saveResult.info.version, loadResult.data.coins, saveGameManager.listSlots()[0].name);
 * const exportResult = saveGameManager.exportSlot("slot1");
 * saveGameManager.importSlot("slot2", exportResult.text);
 * console.log(saveGameManager.exists("slot2"));
 */
export class SaveGameManager {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { string } */ #namespace; // 키 앞머리.
	/** @private @type { number } */ #currentVersion; // 지금 자료의 판.
	/** @private @type { SaveStorage } */ #storage;
	/** @private @type { Map<number, Function> } */ #migrationByVersion; // 판마다 옮기는 함수.
	/** @private @type { object | null } */ #autosave; // 자동 저장. ({ slotId, intervalSeconds, elapsedSeconds, options, dataProvider })
	/** @private @type { SaveCloudProvider | null } */ #cloudProvider;
	/** @private @type { function(): number | null } */ #timeProvider; // 시각을 주는 함수. (밀리초, null 이면 Date.now)

	//==============================================================================
	// 생성. (저장소는 엔진 LocalStorage)
	//==============================================================================
	/**
	 * @constructor
	 * @param { string } namespace 키 앞머리. (게임마다 다르게, 키는 <namespace>.slot.<칸>.0 과 .1)
	 * @param { number } currentVersion 지금 자료의 판. (1 부터, 자료 꼴을 바꿀 때마다 올리고 옮기는 함수를 건다)
	 */
	constructor(namespace, currentVersion) {
		this.#namespace = namespace;
		this.#currentVersion = currentVersion;
		this.#storage = new LocalSaveStorage();
		this.#migrationByVersion = new System.Map();
		this.#autosave = null;
		this.#cloudProvider = null;
		this.#timeProvider = null;
	}

	//==============================================================================
	// 저장소 바꾸기. (앞 저장소의 기록은 옮기지 않는다)
	//==============================================================================
	/**
	 * @param { SaveStorage } storage 새 저장소. (readText, writeText, removeText, listKeys 를 가진 객체)
	 */
	setStorage(storage) {
		this.#storage = storage;
	}

	//==============================================================================
	// 클라우드 꽂기. (null 이면 뺀다)
	//==============================================================================
	/**
	 * @param { SaveCloudProvider | null } cloudProvider 클라우드 저장 구현.
	 */
	setCloudProvider(cloudProvider) {
		this.#cloudProvider = cloudProvider;
	}

	//==============================================================================
	// 시각 함수 바꾸기. (null 이면 Date.now, 시험에서 고정한 시각을 줄 때)
	//==============================================================================
	/**
	 * @param { function(): number | null } timeProvider 1970-01-01 UTC 부터의 밀리초를 주는 함수.
	 */
	setTimeProvider(timeProvider) {
		this.#timeProvider = timeProvider;
	}

	//==============================================================================
	// 지금 자료의 판.
	//==============================================================================
	/**
	 * @returns { number } 만들 때 준 판.
	 */
	getCurrentVersion() {
		return this.#currentVersion;
	}

	//==============================================================================
	// 판 옮기는 함수 걸기. (fromVersion 의 자료를 받아 fromVersion + 1 의 자료를 돌려준다, 실패하면 던진다, 같은 판에 다시 걸면 바꾼다)
	//==============================================================================
	/**
	 * @param { number } fromVersion 옮길 판.
	 * @param { function(*): * } migration 옮기는 함수.
	 */
	addMigration(fromVersion, migration) {
		this.#migrationByVersion.set(fromVersion, migration);
	}

	//==============================================================================
	// 칸 키.
	//==============================================================================
	/**
	 * @private
	 * @param { string } slotId 칸 이름.
	 * @param { number } copyIndex 키 번호. (0 이나 1)
	 * @returns { string } 키.
	 */
	#createSlotKey(slotId, copyIndex) {
		return this.#namespace + ".slot." + slotId + "." + copyIndex;
	}

	//==============================================================================
	// 두 키의 기록. ({ record(깨졌거나 없으면 null), isPresent } 둘)
	//==============================================================================
	/**
	 * @private
	 * @param { string } slotId 칸 이름.
	 * @returns { object[] } 키 두 개의 읽은 결과.
	 */
	#readCopies(slotId) {
		return [0, 1].map((copyIndex) => {
			const recordText = this.#storage.readText(this.#createSlotKey(slotId, copyIndex));
			if (recordText === null || recordText === undefined) {
				return { record: null, isPresent: false };
			}
			return { record: parseRecordText(recordText, slotId), isPresent: true };
		});
	}

	//==============================================================================
	// 순번이 가장 큰 성한 기록의 키 번호. (없으면 -1)
	//==============================================================================
	/**
	 * @private
	 * @param { object[] } copies 두 키의 기록.
	 * @returns { number } 키 번호.
	 */
	#findNewestCopy(copies) {
		let newestIndex = -1;
		let newestSequence = -1;
		copies.forEach((copy, copyIndex) => {
			if (copy.record !== null && copy.record.info.sequence > newestSequence) {
				newestIndex = copyIndex;
				newestSequence = copy.record.info.sequence;
			}
		});
		return newestIndex;
	}

	//==============================================================================
	// 저장. (앞 기록이 없는 쪽 키에 순번을 올려 쓴다, 클라우드가 있으면 올린다)
	//==============================================================================
	/**
	 * @param { string } slotId 칸 이름. (영문, 숫자, _, - 로 64 자까지)
	 * @param { * } data 자료. (지금 판의 꼴, JSON 으로 바꿀 수 있어야 한다)
	 * @param { SaveSlotOptions } [options] 이름, 미리보기 그림, metadata.
	 * @returns { { isSuccess: boolean, error: string | null, detail: object | null, info: SaveSlotInfo | null } } 결과. (실패는 InvalidSlotId, InvalidData, WriteFailed)
	 */
	save(slotId, data, options = new SaveSlotOptions()) {
		if (!isValidSlotId(slotId)) {
			return { ...createFailure(SaveGameError.InvalidSlotId), info: null };
		}
		let bodyText;
		try {
			bodyText = System.JSON.stringify(data);
		}
		catch (error) {
			bodyText = undefined;
		}
		if (typeof bodyText !== "string") {
			return { ...createFailure(SaveGameError.InvalidData), info: null };
		}
		const info = new SaveSlotInfo();
		info.slotId = slotId;
		info.name = typeof options.name === "string" ? options.name : "";
		info.savedTime = System.Math.floor(this.#readTime());
		info.version = this.#currentVersion;
		info.previewImage = typeof options.previewImage === "string" ? options.previewImage : "";
		info.byteSize = textEncoder.encode(bodyText).length;
		const metadata = options.metadata;
		info.metadata = metadata !== null && typeof metadata === "object" && !System.Array.isArray(metadata) ? metadata : {};
		return this.#writeRecord(info, bodyText);
	}

	//==============================================================================
	// 지금 시각. (밀리초)
	//==============================================================================
	/**
	 * @private
	 * @returns { number } 밀리초.
	 */
	#readTime() {
		return this.#timeProvider !== null ? this.#timeProvider() : System.Date.now();
	}

	//==============================================================================
	// 다음 순번으로 앞 기록이 없는 쪽 키에 쓴다.
	//==============================================================================
	/**
	 * @private
	 * @param { SaveSlotInfo } info 머리. (순번은 여기서 정한다)
	 * @param { string } bodyText 자료 JSON.
	 * @returns { object } 저장 결과.
	 */
	#writeRecord(info, bodyText) {
		const copies = this.#readCopies(info.slotId);
		const newestIndex = this.#findNewestCopy(copies);
		const targetIndex = newestIndex < 0 ? 0 : 1 - newestIndex;
		info.sequence = newestIndex < 0 ? 1 : copies[newestIndex].record.info.sequence + 1;
		const recordText = buildRecordText(info, bodyText);
		if (!this.#storage.writeText(this.#createSlotKey(info.slotId, targetIndex), recordText)) {
			return { ...createFailure(SaveGameError.WriteFailed), info: null };
		}
		if (this.#cloudProvider !== null) {
			this.#cloudProvider.upload(info.slotId, buildExportText(recordText));
		}
		return { isSuccess: true, error: null, detail: null, info };
	}

	//==============================================================================
	// 읽기. (성한 기록 가운데 순번이 가장 큰 것, 판이 낮으면 옮긴다)
	//==============================================================================
	/**
	 * @param { string } slotId 칸 이름.
	 * @returns { { isSuccess: boolean, error: string | null, detail: object | null, data: *, info: SaveSlotInfo | null, isRecoveredFromBackup: boolean, migratedFromVersion: number | null } } 결과. (data 는 지금 판으로 옮긴 자료, info 의 판은 옮기기 전 판)
	 */
	load(slotId) {
		const fail = (error, detail = null) => ({ ...createFailure(error, detail), data: null, info: null, isRecoveredFromBackup: false, migratedFromVersion: null });
		if (!isValidSlotId(slotId)) {
			return fail(SaveGameError.InvalidSlotId);
		}
		const copies = this.#readCopies(slotId);
		const newestIndex = this.#findNewestCopy(copies);
		if (newestIndex < 0) {
			return fail(copies.some((copy) => copy.isPresent) ? SaveGameError.Corrupted : SaveGameError.NotFound);
		}
		const isRecoveredFromBackup = copies.some((copy) => copy.isPresent && copy.record === null);
		const record = copies[newestIndex].record;
		let data;
		try {
			data = System.JSON.parse(record.bodyText);
		}
		catch (error) {
			return fail(SaveGameError.Corrupted);
		}
		const version = record.info.version;
		const currentVersion = this.#currentVersion;
		if (version > currentVersion) {
			return fail(SaveGameError.NewerVersion, { version, currentVersion });
		}
		for (let fromVersion = version; fromVersion < currentVersion; ++fromVersion) {
			const migration = this.#migrationByVersion.get(fromVersion);
			if (migration === undefined) {
				return fail(SaveGameError.MissingMigration, { fromVersion });
			}
			try {
				data = migration(data);
			}
			catch (error) {
				return fail(SaveGameError.MigrationFailed, { fromVersion, message: System.String(error && error.message !== undefined ? error.message : error) });
			}
		}
		return { isSuccess: true, error: null, detail: null, data, info: record.info, isRecoveredFromBackup, migratedFromVersion: version < currentVersion ? version : null };
	}

	//==============================================================================
	// 칸 지우기. (두 키 모두, 클라우드가 있으면 거기서도)
	//==============================================================================
	/**
	 * @param { string } slotId 칸 이름.
	 */
	delete(slotId) {
		if (!isValidSlotId(slotId)) {
			return;
		}
		for (let copyIndex = 0; copyIndex < 2; ++copyIndex) {
			this.#storage.removeText(this.#createSlotKey(slotId, copyIndex));
		}
		if (this.#cloudProvider !== null) {
			this.#cloudProvider.remove(slotId);
		}
	}

	//==============================================================================
	// 칸에 기록이 있는지. (깨진 기록도 있는 것으로 친다)
	//==============================================================================
	/**
	 * @param { string } slotId 칸 이름.
	 * @returns { boolean } 두 키 가운데 하나라도 글이 있으면 참.
	 */
	exists(slotId) {
		if (!isValidSlotId(slotId)) {
			return false;
		}
		return [0, 1].some((copyIndex) => {
			const text = this.#storage.readText(this.#createSlotKey(slotId, copyIndex));
			return text !== null && text !== undefined;
		});
	}

	//==============================================================================
	// 칸 목록. (저장 시각이 늦은 차례, 같으면 칸 이름 차례. 읽을 기록이 없는 칸은 isCorrupted 로 맨 뒤에)
	//==============================================================================
	/**
	 * @returns { SaveSlotInfo[] } 칸마다 고른 기록의 머리.
	 */
	listSlots() {
		const prefix = this.#namespace + ".slot.";
		const slotIdList = [];
		for (const key of this.#storage.listKeys(prefix)) {
			const rest = key.slice(prefix.length);
			const dot = rest.lastIndexOf(".");
			if (dot < 0) {
				continue;
			}
			const slotId = rest.slice(0, dot);
			const copyText = rest.slice(dot + 1);
			if ((copyText === "0" || copyText === "1") && isValidSlotId(slotId) && !slotIdList.includes(slotId)) {
				slotIdList.push(slotId);
			}
		}
		const infoList = slotIdList.map((slotId) => {
			const copies = this.#readCopies(slotId);
			const newestIndex = this.#findNewestCopy(copies);
			if (newestIndex >= 0) {
				return copies[newestIndex].record.info;
			}
			const info = new SaveSlotInfo();
			info.slotId = slotId;
			info.isCorrupted = true;
			return info;
		});
		infoList.sort((left, right) => {
			if (left.isCorrupted !== right.isCorrupted) {
				return left.isCorrupted ? 1 : -1;
			}
			if (left.savedTime !== right.savedTime) {
				return right.savedTime - left.savedTime;
			}
			return left.slotId < right.slotId ? -1 : (left.slotId > right.slotId ? 1 : 0);
		});
		return infoList;
	}

	//==============================================================================
	// 내보내기. (고른 기록을 그대로 담은 JSON 글)
	//==============================================================================
	/**
	 * @param { string } slotId 칸 이름.
	 * @returns { { isSuccess: boolean, error: string | null, detail: object | null, text: string | null } } 결과. (text 는 {"format":"vanilla-save-export","formatVersion":1,"record":"..."})
	 */
	exportSlot(slotId) {
		if (!isValidSlotId(slotId)) {
			return { ...createFailure(SaveGameError.InvalidSlotId), text: null };
		}
		const copies = this.#readCopies(slotId);
		const newestIndex = this.#findNewestCopy(copies);
		if (newestIndex < 0) {
			return { ...createFailure(copies.some((copy) => copy.isPresent) ? SaveGameError.Corrupted : SaveGameError.NotFound), text: null };
		}
		return { isSuccess: true, error: null, detail: null, text: buildExportText(copies[newestIndex].record.recordText) };
	}

	//==============================================================================
	// 들여오기. (exportSlot 의 글을 체크섬으로 보고 slotId 칸의 새 기록으로 쓴다, 판은 그대로 두고 읽을 때 옮긴다)
	//==============================================================================
	/**
	 * @param { string } slotId 들일 칸 이름. (내보낸 칸과 달라도 된다)
	 * @param { string } exportedText exportSlot 의 JSON 글.
	 * @returns { { isSuccess: boolean, error: string | null, detail: object | null, info: SaveSlotInfo | null } } 결과. (글이 틀리면 InvalidImport, 새 판이면 NewerVersion)
	 */
	importSlot(slotId, exportedText) {
		if (!isValidSlotId(slotId)) {
			return { ...createFailure(SaveGameError.InvalidSlotId), info: null };
		}
		const record = parseExportText(exportedText);
		if (record === null) {
			return { ...createFailure(SaveGameError.InvalidImport), info: null };
		}
		if (record.info.version > this.#currentVersion) {
			return { ...createFailure(SaveGameError.NewerVersion, { version: record.info.version, currentVersion: this.#currentVersion }), info: null };
		}
		record.info.slotId = slotId;
		return this.#writeRecord(record.info, record.bodyText);
	}

	//==============================================================================
	// 클라우드에서 받기. (클라우드 기록이 칸의 기록보다 늦게 저장됐거나 칸이 비었으면 들인다)
	//==============================================================================
	/**
	 * @param { string } slotId 칸 이름.
	 * @returns { { isSuccess: boolean, error: string | null, detail: object | null, isImported: boolean } } 결과. (받은 글이 깨졌으면 InvalidImport)
	 */
	pullFromCloud(slotId) {
		if (!isValidSlotId(slotId)) {
			return { ...createFailure(SaveGameError.InvalidSlotId), isImported: false };
		}
		const cloudProvider = this.#cloudProvider;
		if (cloudProvider === null) {
			return { isSuccess: true, error: null, detail: null, isImported: false };
		}
		const exportedText = cloudProvider.download(slotId);
		if (exportedText === null || exportedText === undefined) {
			return { isSuccess: true, error: null, detail: null, isImported: false };
		}
		const record = parseExportText(exportedText);
		if (record === null) {
			return { ...createFailure(SaveGameError.InvalidImport), isImported: false };
		}
		const copies = this.#readCopies(slotId);
		const newestIndex = this.#findNewestCopy(copies);
		if (newestIndex >= 0 && record.info.savedTime <= copies[newestIndex].record.info.savedTime) {
			return { isSuccess: true, error: null, detail: null, isImported: false };
		}
		// 받은 것을 다시 올리지 않게 잠깐 뺀다.
		this.#cloudProvider = null;
		const result = this.importSlot(slotId, exportedText);
		this.#cloudProvider = cloudProvider;
		return { isSuccess: result.isSuccess, error: result.error, detail: result.detail, isImported: result.isSuccess };
	}

	//==============================================================================
	// 자동 저장 걸기. (update 가 간격마다 dataProvider 의 자료를 slotId 칸에 저장한다, 앞 설정은 바꾼다)
	//==============================================================================
	/**
	 * @param { string } slotId 칸 이름.
	 * @param { number } intervalSeconds 간격. (초, 0 보다 커야 한다)
	 * @param { SaveSlotOptions } options 저장할 때 쓸 이름, 미리보기 그림, metadata.
	 * @param { function(): * } dataProvider 저장할 자료를 주는 함수. (null 이나 undefined 를 돌려주면 이번에는 건너뛴다)
	 */
	setAutosave(slotId, intervalSeconds, options, dataProvider) {
		if (!(System.Number.isFinite(intervalSeconds) && intervalSeconds > 0)) {
			return;
		}
		this.#autosave = { slotId, intervalSeconds, elapsedSeconds: 0, options, dataProvider };
	}

	//==============================================================================
	// 자동 저장 끄기.
	//==============================================================================
	clearAutosave() {
		this.#autosave = null;
	}

	//==============================================================================
	// 자동 저장이 걸렸는지.
	//==============================================================================
	/**
	 * @returns { boolean } 걸려 있으면 참.
	 */
	isAutosaveEnabled() {
		return this.#autosave !== null;
	}

	//==============================================================================
	// 매 프레임 갱신. (자동 저장 시간을 재고 간격이 차면 저장한다)
	//==============================================================================
	/**
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 * @returns { object | null } 이번에 저장했으면 save 의 결과, 아니면 null.
	 */
	update(timeDelta) {
		const autosave = this.#autosave;
		if (autosave === null) {
			return null;
		}
		if (System.Number.isFinite(timeDelta) && timeDelta > 0) {
			autosave.elapsedSeconds += timeDelta;
		}
		if (autosave.elapsedSeconds < autosave.intervalSeconds) {
			return null;
		}
		return this.saveAutosaveNow();
	}

	//==============================================================================
	// 자동 저장을 지금 하기. (창을 닫거나 내리기 전에, 시간은 처음부터 다시 잰다)
	//==============================================================================
	/**
	 * @returns { object | null } 저장했으면 save 의 결과, 자동 저장이 없거나 자료가 없으면 null.
	 */
	saveAutosaveNow() {
		const autosave = this.#autosave;
		if (autosave === null) {
			return null;
		}
		autosave.elapsedSeconds = 0;
		const data = autosave.dataProvider();
		if (data === null || data === undefined) {
			return null;
		}
		return this.save(autosave.slotId, data, autosave.options);
	}
}
