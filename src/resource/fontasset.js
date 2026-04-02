//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Asset } from "../core/asset.js";


//==============================================================================
// 폰트 애셋.
//==============================================================================
export class FontAsset extends Asset
{
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { string } */ family = "";
	/** @type { FontFace } */ fontFace = null;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.family = "";
		this.fontFace = null;
	}

	//==============================================================================
	// 비동기 애셋 로드.
	//==============================================================================
	/**
	 * @override
	 * @param { string } assetPath 
	 */
	async load(assetPath) {
		await super.load(assetPath);

		// 이미 로드 된 상태라면.
		const isLoaded = this.isLoaded();
		if (isLoaded) {
			return Promise.resolve();
		}
	}

	//==============================================================================
	// 비동기 애셋 로드.
	//==============================================================================
	/**
	 * @param { string } family 
	 * @param { string } assetPath 
	 */
	async loadFont(family, assetPath) {

		if (this.fontFace) {
			return Promise.resolve();
		}

		await super.load(assetPath);
		this.family = family;

		// this.FontFace = new FontFace(this.Family, `url(${this.AssetPath}) format("woff2")`);
		// const assetPath = this.getAssetPath();
		this.fontFace = new FontFace(this.family, `url(${assetPath})`);
		await this.fontFace.load();

		// 브라우저 폰트셋 등록.
		document.fonts.add(this.fontFace);
		this.setLoaded(true);
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
		if (this.fontFace == null || this.fontFace === undefined)
			return;

		document.fonts.delete(this.fontFace);
		this.fontFace = null;
		this.setLoaded(false);
	}
}