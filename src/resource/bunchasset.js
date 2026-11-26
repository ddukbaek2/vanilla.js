//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Asset, AssetType } from "../core/asset.js";
import { BlobAsset } from "../resource/blobasset.js";


//==============================================================================
// 묶음 애셋.
//==============================================================================
/**
 * @example <caption>파일을 바이트 덩어리로 읽기</caption>
 * import { BunchAsset } from "./build/vanilla.js";
 *
 * const bunchAsset = new BunchAsset();
 * await bunchAsset.load("examples/assets/beep.wav");
 * const blob = bunchAsset.getBlob();
 * console.log(bunchAsset.getAssetType(), bunchAsset.isLoaded(), blob.size);
 */
export class BunchAsset extends BlobAsset {
    //==============================================================================
    // 멤버 변수 목록.
    //==============================================================================
    // /** @private @type { Blob } */ #blob;

    //==============================================================================
    // 생성.
    //==============================================================================
    constructor() {
        super();
        this.setAssetType(AssetType.bunch);
        // this.#blob = null;
    }

   //==============================================================================
	// 비동기 애셋 로드.
	//==============================================================================
	/**
	 * @override
	 * @param { string } assetPath 읽을 파일 주소. (BlobAsset.load 로 받아 Blob 으로 둔다)
	 */
	async load(assetPath) {
		await super.load(assetPath);
	}
}