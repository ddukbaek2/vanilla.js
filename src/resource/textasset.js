//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import * as Wait from "../base/wait.js";
import { Asset, AssetType } from "../core/asset.js";



//==============================================================================
// 텍스트 애셋.
//==============================================================================
export class TextAsset extends Asset
{
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { string } */ text;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setAssetType(AssetType.text);
		this.text = "";
	}

	//==============================================================================
	// 캐시 무효화 로드 여부 설정.
	// - 참이면 fetch 에 cache: "no-cache" 를 붙여, 배포 뒤 브라우저가 옛 데이터를
	//   계속 쓰는 문제를 막는다. (데이터 테이블 JSON 등)
	//==============================================================================
	/**
	 * @param { boolean } isNoCache
	 */
	setNoCache(isNoCache) {
		this.__isNoCache = isNoCache;
	}

	//==============================================================================
	// 캐시 무효화 로드 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isNoCache() {
		return this.__isNoCache === true;
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

		try {
			// 로드.
			await super.load(assetPath);
			const response = await System.fetch(assetPath, this.isNoCache() ? { cache: "no-cache" } : undefined);
			// 실패 응답(404 등)은 받지 못한 것으로 친다.
			if (!response.ok) {
				throw new System.Error(`HTTP ${response.status}`);
			}
			this.text = await response.text();
			this.setLoaded(true);
			// await Wait.nextFrame();
		}
		catch (error) {
			// 예외.
			console.error(`Error loading text: ${assetPath}`, error);
			throw error;
		}
	}

	//==============================================================================
	// 이미 가진 바이트로 읽기. (UTF-8 로 읽고, UTF-8 이 아닌 바이트는 대체 문자로 바꾼다, 이미 읽혔어도 새 바이트로 바꾼다)
	//==============================================================================
	/**
	 * @param { string } assetPath getAssetPath 에 쓸 이름.
	 * @param { ArrayBuffer | ArrayBufferView } bytes
	 */
	loadFromBytes(assetPath, bytes) {
		this.setAssetPath(assetPath);
		const textDecoder = new System.TextDecoder("utf-8");
		this.text = textDecoder.decode(bytes);
		this.setLoaded(true);
	}

	//==============================================================================
	// 애셋 언로드.
	//==============================================================================
	/**
	 * @override
	 */
	unload() {
		super.unload();
		this.text = "";
	}
}