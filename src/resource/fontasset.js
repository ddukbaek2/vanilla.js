//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Asset, AssetType } from "../core/asset.js";


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
		this.setAssetType(AssetType.font);
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
	 * @param { object } descriptors FontFace 서술자. (weight, style, stretch, unicodeRange, display 등)
	 */
	async loadFont(family, assetPath, descriptors) {

		if (this.fontFace) {
			return Promise.resolve();
		}

		await super.load(assetPath);
		this.family = family;

		// this.FontFace = new FontFace(this.Family, `url(${this.AssetPath}) format("woff2")`);
		// const assetPath = this.getAssetPath();
		// 서술자를 주지 않으면 굵기와 기울기가 모두 normal 로 등록된다.
		// 같은 패밀리에 굵기가 다른 파일을 여러 개 올릴 때는 반드시 주어야 나중 것이 앞 것을 덮지 않는다.
		const fontFaceDescriptors = descriptors === undefined || descriptors === null ? {} : descriptors;
		this.fontFace = new FontFace(this.family, `url(${assetPath})`, fontFaceDescriptors);
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
		if (this.fontFace === null || this.fontFace === undefined)
			return;

		document.fonts.delete(this.fontFace);
		this.fontFace = null;
		this.setLoaded(false);
	}
}