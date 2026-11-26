//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";


//==============================================================================
// 애셋 타입.
//==============================================================================
export const AssetType = System.Object.freeze({
	none: "none",
	image: "image",
	audio: "audio",
	json: "json",
	text: "text",
	font: "font",
	blob: "blob",
	bunch: "bunch",
	visual: "visual",
});


//==============================================================================
// 애셋.
//==============================================================================
/**
 * @example <caption>이미지 애셋을 읽고 상태 보기</caption>
 * import { ImageAsset } from "./build/vanilla.js";
 *
 * const imageAsset = new ImageAsset();
 * await imageAsset.load("examples/assets/spritesheet.png");
 * console.log(imageAsset.getAssetType(), imageAsset.getAssetPath(), imageAsset.isLoaded());
 * imageAsset.unload();
 * console.log(imageAsset.isLoaded(), imageAsset.getAssetPath());
 */
export class Asset extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { string } */ #assetPath;
	/** @private @type { boolean } */ #isLoaded;
	/** @private @type { string } */ #assetType;

	
	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();

		this.#assetPath = "";
		this.#isLoaded = false;
		this.#assetType = AssetType.none;
	}

	//==============================================================================
	// 비동기 애셋 로드.
	//==============================================================================
	/**
	 * @virtual
	 * @param { string } assetPath 애셋 경로. (이미 로드되었으면 아무것도 하지 않는다)
	 * @returns { Promise<void> } 경로를 정하면 풀리는 프로미스. (이 기반 함수는 읽지 않고 로드 상태도 바꾸지 않는다)
	 */
	async load(assetPath) {
		const isLoaded = this.isLoaded();
		if (isLoaded) {
			return;
		}

		this.setAssetPath(assetPath);
		System.Promise.resolve();
	}

	//==============================================================================
	// 애셋 언로드.
	// - 그 자리에서 끝나고 아무것도 돌려주지 않는다. (로드되어 있었든 아니든 같다, 덮어쓴 하위 클래스와 같다)
	//==============================================================================
	/**
	 * @virtual
	 */
	unload() {
		const isLoaded = this.isLoaded();
		if (!isLoaded) {
			return;
		}

		this.setAssetPath("");
		this.setLoaded(false);
	}

	//==============================================================================
	// 애셋 타입 설정.
	//==============================================================================
	/**
	 * @param { string } assetType 애셋 타입 이름. ("image", "audio", "json", "text", "font", "blob" 같은, 하위 클래스가 생성자에서 정한다)
	 */
	setAssetType(assetType) {
		this.#assetType = assetType;
	}

	//==============================================================================
	// 애셋 타입 반환.
	//==============================================================================
	/**
	 * @returns { string } 애셋 타입 이름. (정하지 않았으면 "none")
	 */
	getAssetType() {
		return this.#assetType;
	}

	//==============================================================================
	// 로드 경로 설정.
	//==============================================================================
	/**
	 * @param { string } assetPath 로드 경로.
	 */
	setAssetPath(assetPath) {
		this.#assetPath = assetPath;
	}

	//==============================================================================
	// 로드 경로 반환.
	//==============================================================================
	/**
	 * @returns { string } 로드 경로. (로드 전이나 언로드 뒤에는 빈 글)
	 */
	getAssetPath() {
		return this.#assetPath;
	}

	//==============================================================================
	// 로드 되었는지 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } isLoaded 로드 되었으면 참.
	 */
	setLoaded(isLoaded) {
		this.#isLoaded = isLoaded;
	}

	//==============================================================================
	// 로드 되었는지 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 로드 되었으면 참.
	 */
	isLoaded() {
		return this.#isLoaded;
	}
}