//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Asset, AssetType } from "../core/asset.js";


//==============================================================================
// 블롭 애셋. (바이너리)
//==============================================================================
/**
 * @example <caption>파일을 블롭으로 받기</caption>
 * import { BlobAsset } from "./build/vanilla.js";
 *
 * const blobAsset = new BlobAsset();
 * await blobAsset.load("examples/assets/beep.wav");
 * const blob = blobAsset.getBlob();
 * console.log(blob.size, blob.type, blobAsset.isLoaded());
 */
export class BlobAsset extends Asset {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Blob } */ #blob;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setAssetType(AssetType.blob);
		this.#blob = null;
	}

   //==============================================================================
	// 비동기 애셋 로드.
	//==============================================================================
	/**
	 * @override
	 * @param { string } assetPath 파일 경로. (이미 읽혔으면 아무것도 하지 않는다)
	 * @returns { Promise<void> } 다 받으면 풀리는 프로미스. (실패 응답이면 console.error 로 알리고 거부된다)
	 */
	async load(assetPath) {

		// 이미 로드 된 상태라면.
		const isLoaded = this.isLoaded();
		if (isLoaded) {
			return Promise.resolve();
		}

		await super.load(assetPath);
		const response = await System.fetch(assetPath);
		// 실패 응답(404 등)은 받지 못한 것으로 친다.
		if (!response.ok) {
			console.error(`Error loading blob: ${assetPath}`);
			throw new System.Error(`HTTP ${response.status}`);
		}
		this.#blob = await response.blob();
        this.setLoaded(true);
	}

	//==============================================================================
	// 이미 가진 바이트로 읽기. (이미 읽혔어도 새 바이트로 바꾼다)
	//==============================================================================
	/**
	 * @param { string } assetPath getAssetPath 에 쓸 이름.
	 * @param { ArrayBuffer | ArrayBufferView | Blob } bytes 파일의 바이트. (Blob 이면 그대로 쓰고, 아니면 Blob 으로 감싼다)
	 */
	loadFromBytes(assetPath, bytes) {
		this.setAssetPath(assetPath);
		this.#blob = bytes instanceof System.Blob ? bytes : new System.Blob([bytes]);
		this.setLoaded(true);
	}

	//==============================================================================
	// 블롭 반환.
	//==============================================================================
	/**
	 * @returns { Blob } 받은 블롭. (읽기 전이면 null)
	 */ 
    getBlob() {
        return this.#blob;
    }
}