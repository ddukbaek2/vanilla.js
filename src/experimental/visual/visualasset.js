//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Asset, AssetType } from "../../core/asset.js";
import { Visual } from "./visual.js";


//==============================================================================
// 비주얼 애셋.
//==============================================================================
/**
 * @example <caption>비주얼을 담는 애셋</caption>
 * import { VisualAsset, Visual } from "./build/vanilla.js";
 *
 * const visualAsset = new VisualAsset();
 * await visualAsset.load("examples/assets/spritesheet.png");
 * const visual = new Visual();
 * visualAsset.setVisual(visual);
 * console.log(visualAsset.getAssetType(), visualAsset.getAssetPath(), visualAsset.getVisual() === visual);
 */
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
	 * @param { string } assetPath 애셋 경로. (경로만 적고 파일은 읽지 않는다)
	 * @returns { Promise<void> } 끝나면 풀리는 약속.
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

	//==============================================================================
	// 비주얼 설정.
	//==============================================================================
	/**
	 * @param { Visual | null } visual 담을 비주얼. (null 이면 비운다)
	 */
	setVisual(visual) {
		this.#visual = visual;
	}

	//==============================================================================
	// 비주얼 반환. (없으면 null)
	//==============================================================================
	/**
	 * @returns { Visual | null } 담긴 비주얼.
	 */
	getVisual() {
		return this.#visual;
	}
}