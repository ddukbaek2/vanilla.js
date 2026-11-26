//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Asset, AssetType } from "../core/asset.js";


//==============================================================================
// 폰트 애셋.
//==============================================================================
/**
 * @example <caption>글꼴 파일을 읽어 글꼴 목록에 올리기</caption>
 * import { FontAsset } from "./build/vanilla.js";
 *
 * const fontAsset = new FontAsset();
 * await fontAsset.loadFont("DOSGothic", "examples/assets/DOSGothic.woff", { weight: "normal", style: "normal" });
 * console.log(fontAsset.family, fontAsset.isLoaded(), document.fonts.check("16px DOSGothic"));
 */
export class FontAsset extends Asset
{
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { string } */ family = ""; // 등록한 글꼴 패밀리 이름. (읽기 전에는 빈 글)
	/** @type { FontFace } */ fontFace = null; // 등록한 FontFace. (읽기 전이나 언로드 뒤에는 null)

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
	// 비동기 애셋 로드. (파일 이름을 글꼴 패밀리 이름으로 loadFont 한다)
	//==============================================================================
	/**
	 * @override
	 * @param { string } assetPath 글꼴 파일 경로. (파일 이름에서 확장자를 뗀 것이 패밀리 이름이 된다, "assets/DOSGothic.woff" 면 "DOSGothic")
	 * @returns { Promise<void> } 글꼴을 읽어 document.fonts 에 올리면 풀리는 프로미스. (이미 읽었으면 바로 풀린다, 읽지 못하면 거부된다)
	 * @example <caption>파일 이름을 패밀리 이름으로 글꼴 올리기</caption>
	 * import { FontAsset } from "./build/vanilla.js";
	 *
	 * const fontAsset = new FontAsset();
	 * await fontAsset.load("examples/assets/DOSGothic.woff");
	 * console.log(fontAsset.family, fontAsset.isLoaded(), document.fonts.check("16px DOSGothic"));
	 */
	async load(assetPath) {
		const family = readFontFamilyFromPath(assetPath);
		await this.loadFont(family, assetPath, null);
	}

	//==============================================================================
	// 비동기 애셋 로드.
	//==============================================================================
	/**
	 * @param { string } family 등록할 글꼴 패밀리 이름. (CSS font-family 로 쓴다)
	 * @param { string } assetPath 글꼴 파일 경로.
	 * @param { object } descriptors FontFace 서술자. (weight, style, stretch, unicodeRange, display 등)
	 * @returns { Promise<void> } 글꼴을 읽어 document.fonts 에 올리면 풀리는 프로미스. (이미 읽었으면 바로 풀린다, 읽지 못하면 거부된다)
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
	// 이미 가진 글꼴 바이트로 읽기. (ttf, otf, woff, woff2, 다 읽히면 document.fonts 에 family 이름으로 오른다)
	//==============================================================================
	/**
	 * @param { string } family 등록할 글꼴 패밀리 이름. (CSS font-family 로 쓴다)
	 * @param { ArrayBuffer | ArrayBufferView } bytes 글꼴 파일의 바이트. (넘긴 것은 바뀌지 않는다)
	 * @param { object } descriptors FontFace 서술자. (weight, style 등, 없으면 생략)
	 * @example <caption>받아 둔 바이트로 글꼴 올리기</caption>
	 * import { FontAsset } from "./build/vanilla.js";
	 *
	 * const response = await fetch("examples/assets/DOSGothic.woff");
	 * const bytes = await response.arrayBuffer();
	 * const fontAsset = new FontAsset();
	 * await fontAsset.loadFontFromBytes("DOSGothicBytes", bytes);
	 * console.log(fontAsset.family, fontAsset.isLoaded());
	 */
	async loadFontFromBytes(family, bytes, descriptors) {
		if (this.fontFace) {
			return;
		}
		this.family = family;
		const fontFaceDescriptors = descriptors === undefined || descriptors === null ? {} : descriptors;
		const arrayBuffer = copyToArrayBuffer(bytes);
		this.fontFace = new FontFace(this.family, arrayBuffer, fontFaceDescriptors);
		await this.fontFace.load();
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

//==============================================================================
// 글꼴 파일 경로의 패밀리 이름. (쿼리와 조각을 떼고 마지막 경로 조각에서 확장자를 뗀다)
//==============================================================================
/**
 * @param { string } assetPath
 * @returns { string }
 */
function readFontFamilyFromPath(assetPath) {
	let path = assetPath.split("?")[0];
	path = path.split("#")[0];
	const slashIndex = path.lastIndexOf("/");
	const fileName = slashIndex >= 0 ? path.substring(slashIndex + 1) : path;
	const dotIndex = fileName.lastIndexOf(".");
	return dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName;
}

//==============================================================================
// 바이트를 새 ArrayBuffer 로 복사. (ArrayBuffer 나 Uint8Array 같은 형식 배열, 디코딩이 받은 버퍼를 떼어 가도 넘긴 쪽은 그대로다)
//==============================================================================
/**
 * @param { ArrayBuffer | ArrayBufferView } bytes
 * @returns { ArrayBuffer }
 */
function copyToArrayBuffer(bytes) {
	if (bytes instanceof ArrayBuffer) {
		return bytes.slice(0);
	}
	const byteOffset = bytes.byteOffset;
	const byteLength = bytes.byteLength;
	return bytes.buffer.slice(byteOffset, byteOffset + byteLength);
}
