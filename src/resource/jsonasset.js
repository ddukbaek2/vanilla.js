//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { TextAsset } from "../resource/textasset.js";
import { AssetType } from "../core/asset.js";


//==============================================================================
// JSON 데이터 애셋.
//==============================================================================
/**
 * @example <caption>JSON 파일 읽고 항목 보기</caption>
 * import { JsonAsset } from "./build/vanilla.js";
 *
 * const jsonAsset = new JsonAsset();
 * await jsonAsset.load("examples/oldface/assets/expressions.json");
 * if (jsonAsset.isLoaded()) {
 * 	const expressionNames = Object.keys(jsonAsset.data);
 * 	console.log(expressionNames.length, jsonAsset.data.serious.BrowDownLeft);
 * }
 */
export class JsonAsset extends TextAsset
{
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { System.Object | null } */ data; // 해석한 JSON 값. (읽기 전이나 해석이 실패하면 null)

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
	 * @param { string } assetPath JSON 파일 경로. (이미 읽혔으면 아무것도 하지 않는다)
	 * @returns { Promise<void> } 끝나면 풀리는 프로미스. (받기나 해석이 실패해도 거부하지 않고 console.error 로 알린 뒤 읽히지 않은 채로 둔다)
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
	 * @param { ArrayBuffer | ArrayBufferView } bytes JSON 파일의 바이트. (UTF-8)
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