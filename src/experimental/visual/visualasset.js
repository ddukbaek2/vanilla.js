//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Asset, AssetType } from "../../core/asset.js";
import { Visual } from "./visual.js";


//==============================================================================
// 비주얼 애셋.
//==============================================================================
export class VisualAsset extends Asset {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Visual } */ #visual;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setAssetType(AssetType.visual);
		this.#visual = null;
	}

	//==============================================================================
	// 비동기 애셋 로드.
	//==============================================================================
	/**
	 * @override
	 * @param { string } assetPath 
	 */
	async load(assetPath) {

		// 이미 로드 된 상태라면.
		const isLoaded = this.isLoaded();
		if (isLoaded) {
			return Promise.resolve();
		}

		await super.load(assetPath);
		// this.image = new System.window.Image();
		// this.image.src = assetPath;

		// 불러오기.
		await new Promise((resolve, reject) => {
			// this.image.onload = () => {
			// 	this.setLoaded(true);
			// 	resolve();
			// };
			// this.image.onerror = () => {
			// 	reject(new Error(`Load fail: ${assetPath}`));
			// }
            resolve();
		});
	}
}