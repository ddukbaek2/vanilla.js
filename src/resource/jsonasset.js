//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { TextAsset } from "../resource/textasset.js";
import { AssetType } from "../core/asset.js";


//==============================================================================
// JSON 데이터 애셋.
//==============================================================================
export class JsonAsset extends TextAsset
{
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { System.Object | null } */ data;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setAssetType(AssetType.json);
		this.data = null;
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
			return System.Promise.resolve();
		}

		// 로드.
		try {
			await super.load(assetPath);
			this.setLoaded(false);
			this.data = JSON.parse(this.text);
			this.setLoaded(true);
		}
		catch (error) {
			console.error(`Error loading json: ${assetPath}`, error);
		}
	}

	//==============================================================================
	// 이미 가진 바이트로 읽기. (UTF-8 JSON, 해석하지 못하면 알리고 읽히지 않은 것으로 둔다. load 와 같다)
	//==============================================================================
	/**
	 * @override
	 * @param { string } assetPath getAssetPath 에 쓸 이름.
	 * @param { ArrayBuffer | ArrayBufferView } bytes
	 */
	loadFromBytes(assetPath, bytes) {
		super.loadFromBytes(assetPath, bytes);
		this.setLoaded(false);
		this.data = null;
		try {
			this.data = JSON.parse(this.text);
			this.setLoaded(true);
		}
		catch (error) {
			console.error(`Error loading json: ${assetPath}`, error);
		}
	}

	//==============================================================================
	// 애셋 언로드.
	//==============================================================================
	/**
	 * @override
	 * @method
	 */
	unload() {
		super.unload();
		this.data = null;
	}
}