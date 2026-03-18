//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VAsset } from "../core/asset.js";


//==============================================================================
// 폰트 애셋.
//==============================================================================
export class VFontAsset extends VAsset
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
		// super.assetPath = "";
		// super.isLoaded = false;
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
		if (super.isLoaded) {
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
		await super.load(assetPath);

		if (this.fontFace)
			return Promise.resolve();
		
		this.family = family;
		this.AssetPath = assetPath;

		// this.FontFace = new FontFace(this.Family, `url(${this.AssetPath}) format("woff2")`);
		this.fontFace = new FontFace(this.family, `url(${this.AssetPath})`);
		await this.fontFace.load();

		// 브라우저 폰트셋 등록.
		document.fonts.add(this.fontFace);
		super.IsLoaded = true;
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
		if (this.fontFace == null)
			return;

		document.fonts.delete(this.fontFace);
		this.fontFace = null;
		super.IsLoaded = false;
	}
}