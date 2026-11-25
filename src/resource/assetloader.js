//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { AudioAsset } from "./audioasset.js";
import { BlobAsset } from "./blobasset.js";
import { FontAsset } from "./fontasset.js";
import { ImageAsset } from "./imageasset.js";
import { JsonAsset } from "./jsonasset.js";
import { TextAsset } from "./textasset.js";

// 함께 받는 수의 기본값. (브라우저가 한 출처에 여는 연결 수 근처)
const DEFAULT_CONCURRENCY = 6;


//==============================================================================
// 애셋 함께 받기.
// - 그림, JSON, 글, 바이너리, 소리, 글꼴, 직접 만든 받기(addTask)를 목록에 넣고 load() 로 한꺼번에 받는다.
//   동시에 받는 수는 setConcurrency 로 정한다. (하나씩 기다리면 받기와 풀기가 줄지어 늦어진다)
// - 실패한 것도 끝난 것으로 쳐서 멈추지 않는다. 실패는 getFailedList() 에 { path, error } 로 남는다.
// - 진행률은 끝난 수 / 전체 수다. (getProgress, 받은 수 getLoadedCount, 끝난 수 getFinishedCount, 전체 getTotalCount)
//   바뀔 때마다 setProgressHandler 로 건 함수를, 다 끝나면 setCompleteHandler 로 건 함수를 부른다.
// - 받는 동안 더 넣은 것도 같은 load 가 받는다. 다 끝난 뒤 더 넣으면 load() 를 다시 부른다.
// - 쓰기:
//     const assetLoader = new AssetLoader();
//     assetLoader.setConcurrency(8);
//     const titleImageAsset = assetLoader.addImage("assets/title.png");
//     const stageJsonAsset = assetLoader.addJson("assets/stage.json");
//     gameScene.trackAssetLoader(assetLoader);     // GameScene 로딩 막대가 진행률을 따라간다
//     await assetLoader.load();
//==============================================================================
export class AssetLoader extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #concurrency;
	/** @private @type { Array<object> } */ #entryList; // { path, loadFunction, asset, isFinished }
	/** @private @type { number } */ #nextEntryIndex;
	/** @private @type { number } */ #finishedCount;
	/** @private @type { number } */ #loadedCount;
	/** @private @type { Array<{ path: string, error: any }> } */ #failedList;
	/** @private @type { Promise<Array<object>> | null } */ #loadPromise;
	/** @private @type { ((progress: number, finishedCount: number, totalCount: number) => void) | null } */ #progressHandler;
	/** @private @type { ((failedList: Array<object>) => void) | null } */ #completeHandler;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.#concurrency = DEFAULT_CONCURRENCY;
		this.#entryList = [];
		this.#nextEntryIndex = 0;
		this.#finishedCount = 0;
		this.#loadedCount = 0;
		this.#failedList = [];
		this.#loadPromise = null;
		this.#progressHandler = null;
		this.#completeHandler = null;
	}

	//==============================================================================
	// 동시에 받는 수 설정. (1 이상, 소수는 버린다. 받는 중에 바꾸면 다음 load 부터)
	//==============================================================================
	/**
	 * @param { number } concurrency
	 */
	setConcurrency(concurrency) {
		if (typeof concurrency !== "number" || !System.Number.isFinite(concurrency)) {
			return;
		}
		this.#concurrency = System.Math.max(1, System.Math.floor(concurrency));
	}

	//==============================================================================
	// 동시에 받는 수 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getConcurrency() {
		return this.#concurrency;
	}

	//==============================================================================
	// 그림 넣기.
	//==============================================================================
	/**
	 * @param { string } path
	 * @returns { ImageAsset }
	 */
	addImage(path) {
		const imageAsset = new ImageAsset();
		this.addAsset(imageAsset, path);
		return imageAsset;
	}

	//==============================================================================
	// JSON 넣기.
	//==============================================================================
	/**
	 * @param { string } path
	 * @returns { JsonAsset }
	 */
	addJson(path) {
		const jsonAsset = new JsonAsset();
		this.addAsset(jsonAsset, path);
		return jsonAsset;
	}

	//==============================================================================
	// 글 넣기.
	//==============================================================================
	/**
	 * @param { string } path
	 * @returns { TextAsset }
	 */
	addText(path) {
		const textAsset = new TextAsset();
		this.addAsset(textAsset, path);
		return textAsset;
	}

	//==============================================================================
	// 바이너리 넣기.
	//==============================================================================
	/**
	 * @param { string } path
	 * @returns { BlobAsset }
	 */
	addBlob(path) {
		const blobAsset = new BlobAsset();
		this.addAsset(blobAsset, path);
		return blobAsset;
	}

	//==============================================================================
	// 소리 넣기. (AudioContext 가 없는 브라우저에서는 실패로 친다)
	//==============================================================================
	/**
	 * @param { string } path
	 * @returns { AudioAsset }
	 */
	addAudio(path) {
		const audioAsset = new AudioAsset();
		this.addAsset(audioAsset, path);
		return audioAsset;
	}

	//==============================================================================
	// 글꼴 넣기. (받으면 document.fonts 에 family 이름으로 오른다, FontAsset.loadFont)
	//==============================================================================
	/**
	 * @param { string } family
	 * @param { string } path
	 * @param { object } descriptors FontFace 서술자. (weight, style 등, 없으면 생략)
	 * @returns { FontAsset }
	 */
	addFont(family, path, descriptors) {
		const fontAsset = new FontAsset();
		const loadFunction = async () => {
			await fontAsset.loadFont(family, path, descriptors);
		};
		this.addEntry(path, loadFunction, fontAsset);
		return fontAsset;
	}

	//==============================================================================
	// 애셋 넣기. (asset.load(path) 로 받는 Asset 파생, 다 받은 뒤 isLoaded() 가 거짓이면 실패로 친다)
	//==============================================================================
	/**
	 * @param { object } asset
	 * @param { string } path
	 * @returns { object } 넣은 애셋.
	 */
	addAsset(asset, path) {
		const loadFunction = async () => {
			await asset.load(path);
		};
		this.addEntry(path, loadFunction, asset);
		return asset;
	}

	//==============================================================================
	// 직접 만든 받기 넣기. (loadFunction 은 Promise 를 돌려주는 함수, 예외를 내면 실패로 친다)
	//==============================================================================
	/**
	 * @param { string } path 실패 목록과 진행에 보일 이름.
	 * @param { () => Promise<any> } loadFunction
	 */
	addTask(path, loadFunction) {
		this.addEntry(path, loadFunction, null);
	}

	//==============================================================================
	// 목록에 넣기.
	//==============================================================================
	/**
	 * @param { string } path
	 * @param { () => Promise<any> } loadFunction
	 * @param { object | null } asset
	 */
	addEntry(path, loadFunction, asset) {
		this.#entryList.push({ path: path, loadFunction: loadFunction, asset: asset, isFinished: false });
	}

	//==============================================================================
	// 받기. (넣은 것을 모두 받을 때까지 기다린다. 실패해도 예외를 내지 않고 실패 목록을 돌려준다)
	//==============================================================================
	/**
	 * @returns { Promise<Array<{ path: string, error: any }>> }
	 */
	load() {
		if (this.#loadPromise !== null) {
			return this.#loadPromise;
		}
		const loadPromise = this.runWorkers();
		this.#loadPromise = loadPromise;
		return loadPromise;
	}

	//==============================================================================
	// 받는 일꾼들 돌리기. (동시에 받는 수만큼 일꾼이 목록의 다음 것을 집어 받는다)
	//==============================================================================
	/**
	 * @returns { Promise<Array<object>> }
	 */
	async runWorkers() {
		const concurrency = this.getConcurrency();
		const remainingCount = this.#entryList.length - this.#nextEntryIndex;
		const workerCount = System.Math.min(concurrency, remainingCount);
		const workerList = [];
		for (let workerIndex = 0; workerIndex < workerCount; ++workerIndex) {
			workerList.push(this.runWorker());
		}
		await System.Promise.all(workerList);
		this.#loadPromise = null;
		this.notifyProgress();
		const failedList = this.getFailedList();
		const completeHandler = this.#completeHandler;
		if (completeHandler !== null) {
			try {
				completeHandler(failedList);
			}
			catch (error) {
				console.error(error);
			}
		}
		return failedList;
	}

	//==============================================================================
	// 일꾼 하나. (목록이 빌 때까지 하나씩 집어 받는다)
	//==============================================================================
	/**
	 * @returns { Promise<void> }
	 */
	async runWorker() {
		const entryList = this.#entryList;
		while (this.#nextEntryIndex < entryList.length) {
			const entry = entryList[this.#nextEntryIndex];
			this.#nextEntryIndex += 1;
			let loadError = null;
			try {
				await entry.loadFunction();
				if (entry.asset !== null && typeof entry.asset.isLoaded === "function" && !entry.asset.isLoaded()) {
					loadError = new System.Error(`Not loaded: ${entry.path}`);
				}
			}
			catch (error) {
				loadError = error === undefined || error === null ? new System.Error(`Load fail: ${entry.path}`) : error;
			}
			entry.isFinished = true;
			this.#finishedCount += 1;
			if (loadError === null) {
				this.#loadedCount += 1;
			}
			else {
				console.error(`[AssetLoader] 받지 못했습니다: ${entry.path}`, loadError);
				this.#failedList.push({ path: entry.path, error: loadError });
			}
			this.notifyProgress();
		}
	}

	//==============================================================================
	// 진행 알리기.
	//==============================================================================
	notifyProgress() {
		const progressHandler = this.#progressHandler;
		if (progressHandler === null) {
			return;
		}
		const progress = this.getProgress();
		const finishedCount = this.getFinishedCount();
		const totalCount = this.getTotalCount();
		try {
			progressHandler(progress, finishedCount, totalCount);
		}
		catch (error) {
			console.error(error);
		}
	}

	//==============================================================================
	// 진행 알림 함수 설정. ((progress, finishedCount, totalCount) => void, null 이면 끔)
	//==============================================================================
	/**
	 * @param { ((progress: number, finishedCount: number, totalCount: number) => void) | null } progressHandler
	 */
	setProgressHandler(progressHandler) {
		this.#progressHandler = progressHandler === undefined ? null : progressHandler;
	}

	//==============================================================================
	// 다 받음 알림 함수 설정. ((failedList) => void, null 이면 끔)
	//==============================================================================
	/**
	 * @param { ((failedList: Array<object>) => void) | null } completeHandler
	 */
	setCompleteHandler(completeHandler) {
		this.#completeHandler = completeHandler === undefined ? null : completeHandler;
	}

	//==============================================================================
	// 진행률. (끝난 수 / 전체 수, 넣은 것이 없으면 1)
	//==============================================================================
	/**
	 * @returns { number } 0 ~ 1
	 */
	getProgress() {
		const totalCount = this.getTotalCount();
		if (totalCount === 0) {
			return 1;
		}
		const finishedCount = this.getFinishedCount();
		return finishedCount / totalCount;
	}

	//==============================================================================
	// 전체 수.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getTotalCount() {
		return this.#entryList.length;
	}

	//==============================================================================
	// 끝난 수. (받은 것과 실패한 것)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getFinishedCount() {
		return this.#finishedCount;
	}

	//==============================================================================
	// 받은 수. (실패한 것은 빼고)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getLoadedCount() {
		return this.#loadedCount;
	}

	//==============================================================================
	// 실패 목록. ({ path, error } 의 복사본)
	//==============================================================================
	/**
	 * @returns { Array<{ path: string, error: any }> }
	 */
	getFailedList() {
		return this.#failedList.slice();
	}

	//==============================================================================
	// 넣은 것을 모두 받았는지. (실패 포함, 넣은 것이 없으면 true)
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isFinished() {
		const finishedCount = this.getFinishedCount();
		const totalCount = this.getTotalCount();
		return finishedCount >= totalCount;
	}
}
