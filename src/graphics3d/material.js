//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 텍스처 유닛 배치. (1번은 SkinnedModel 의 섀도우 맵 전용, 사용 금지)
const TEXTURE_UNIT_BASECOLOR = 0;
const TEXTURE_UNIT_NORMAL = 2;
const TEXTURE_UNIT_METALLICROUGHNESS = 3;
const TEXTURE_UNIT_GLOSSINESS = 4;
const TEXTURE_UNIT_OCCLUSION = 5;
const TEXTURE_UNIT_EMISSIVE = 6;
const TEXTURE_UNIT_SPECULAR = 7;
const TEXTURE_UNIT_OPACITY = 8;


//==============================================================================
// 머티리얼. (셰이더 템플릿 참조 + metallic-roughness PBR 파라미터/텍스처, 포맷 중립)
// - 셰이더(템플릿)를 참조하는 인스턴스로, 모델은 머티리얼 인스턴스를 적용만 한다.
// - 임포터가 만든 중립 머티리얼 서술(팩터 + 이미지 바이트)로부터 GL 텍스처를 생성한다.
// - FBX 의 스펙큘러/글로스 맵은 glossiness 경로로 러프니스를 근사한다.
//==============================================================================
/**
 * @example <caption>외부 텍스처로 머티리얼을 지어 모델에 입히기</caption>
 * import { Material, SkinnedModel, SkinnedModelRenderer } from "./build/vanilla.js";
 *
 * const canvas = document.createElement("canvas");
 * const webGL2RenderingContext = canvas.getContext("webgl2");
 * const skinnedModelRenderer = new SkinnedModelRenderer(webGL2RenderingContext);
 * const shaderProgram = skinnedModelRenderer.getShaderProgram();
 * const description = Material.createDefaultDescription();
 * description.baseColorFactor = [1.0, 0.8, 0.6];
 * description.roughnessFactor = 0.7;
 * description.baseColorImage = await Material.loadImageDescription("assets/icons/icon.png", { isColorData: true, anisotropy: 4 });
 * const material = await Material.createFromDescription(webGL2RenderingContext, shaderProgram, description);
 * const skinnedModel = await SkinnedModel.loadFromUrl(webGL2RenderingContext, "examples/ancientmountain/assets/fox.glb", skinnedModelRenderer);
 * skinnedModel.setMaterial(0, material);
 * const textureBindings = material.getTextureBindings();
 * console.log(textureBindings.length);
 */
export class Material extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { ShaderProgram } */ #shaderProgram;
	/** @private @type { number[] } */ #baseColorFactor;
	/** @private @type { number } */ #metallicFactor;
	/** @private @type { number } */ #roughnessFactor;
	/** @private @type { number[] } */ #emissiveFactor;
	/** @private @type { boolean } */ #useGlossiness;
	/** @private @type { boolean } */ #useAlphaCutout;
	/** @private @type { WebGLTexture } */ #baseColorTexture;
	/** @private @type { WebGLTexture } */ #normalTexture;
	/** @private @type { WebGLTexture } */ #metallicRoughnessTexture;
	/** @private @type { WebGLTexture } */ #glossinessTexture;
	/** @private @type { WebGLTexture } */ #occlusionTexture;
	/** @private @type { WebGLTexture } */ #emissiveTexture;
	/** @private @type { WebGLTexture } */ #specularTexture;
	/** @private @type { WebGLTexture } */ #opacityTexture;
	/** @private @type { Map<string, [number, WebGLTexture]> } */ #extraTextureBindings;
	/** @private @type { number } */ #subsurfaceFactor;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext WebGL2 렌더링 컨텍스트.
	 * @param { ShaderProgram } shaderProgram 유니폼을 넣을 셰이더 프로그램. (머티리얼 템플릿)
	 */
	constructor(webGL2RenderingContext, shaderProgram) {
		super();

		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#shaderProgram = shaderProgram;
		this.#extraTextureBindings = new System.Map();
		this.#subsurfaceFactor = 1;
		this.#baseColorFactor = [1, 1, 1];
		this.#metallicFactor = 1;
		this.#roughnessFactor = 1;
		this.#emissiveFactor = [0, 0, 0];
		this.#useGlossiness = false;
		this.#useAlphaCutout = false;
		this.#baseColorTexture = null;
		this.#normalTexture = null;
		this.#metallicRoughnessTexture = null;
		this.#glossinessTexture = null;
		this.#occlusionTexture = null;
		this.#emissiveTexture = null;
		this.#specularTexture = null;
		this.#opacityTexture = null;
	}

	//==============================================================================
	// 기본 머티리얼 서술 생성. (정적, 흰색 무광 비금속)
	//==============================================================================
	/**
	 * @returns { object } 기본 서술. ({ baseColorFactor, metallicFactor, roughnessFactor, emissiveFactor } 와 이미지 칸 8 개, 흰색, 메탈릭 0, 러프니스 1, 이미지는 모두 null)
	 */
	static createDefaultDescription() {
		const description = {
			baseColorFactor: [1, 1, 1],
			metallicFactor: 0,
			roughnessFactor: 1,
			emissiveFactor: [0, 0, 0],
			baseColorImage: null,
			normalImage: null,
			metallicRoughnessImage: null,
			glossinessImage: null,
			occlusionImage: null,
			emissiveImage: null,
			specularImage: null,
			opacityImage: null,
		};
		return description;
	}

	//==============================================================================
	// 중립 머티리얼 서술로부터 생성. (정적, 이미지 바이트 → GL 텍스처)
	//==============================================================================
	/**
	 * @param { WebGL2RenderingContext } webGL2RenderingContext WebGL2 렌더링 컨텍스트.
	 * @param { ShaderProgram } shaderProgram 참조할 셰이더 프로그램.
	 * @param { object } description 중립 머티리얼 서술. (createDefaultDescription 꼴, 이미지 칸이 null 이면 1x1 단색 텍스처)
	 * @returns { Promise<Material> } 텍스처까지 올린 머티리얼.
	 */
	static async createFromDescription(webGL2RenderingContext, shaderProgram, description) {
		const material = new Material(webGL2RenderingContext, shaderProgram);
		material.#baseColorFactor = description.baseColorFactor.slice();
		material.#metallicFactor = description.metallicFactor;
		material.#roughnessFactor = description.roughnessFactor;
		material.#emissiveFactor = description.emissiveFactor.slice();
		material.#useGlossiness = description.glossinessImage !== null;
		material.#useAlphaCutout = description.opacityImage !== null;
		material.#baseColorTexture = await material.createTexture(description.baseColorImage, [255, 255, 255, 255]);
		material.#normalTexture = await material.createTexture(description.normalImage, [128, 128, 255, 255]);
		material.#metallicRoughnessTexture = await material.createTexture(description.metallicRoughnessImage, [255, 255, 255, 255]);
		material.#glossinessTexture = await material.createTexture(description.glossinessImage, [255, 255, 255, 255]);
		material.#occlusionTexture = await material.createTexture(description.occlusionImage, [255, 255, 255, 255]);
		material.#emissiveTexture = await material.createTexture(description.emissiveImage, [255, 255, 255, 255]);
		material.#specularTexture = await material.createTexture(description.specularImage, [255, 255, 255, 255]);
		material.#opacityTexture = await material.createTexture(description.opacityImage, [255, 255, 255, 255]);
		return material;
	}

	//==============================================================================
	// 텍스처 생성. (이미지 서술 → GL 텍스처, 없으면 1x1 단색 대체)
	// - 이미지 서술: { bytes, mimeType, flipY } 또는 { source(캔버스/비트맵), flipY }
	// - isColorData: sRGB 로 저장된 색 텍스처, 하드웨어 디코드(SRGB8_ALPHA8)로 선형 공간 샘플링.
	// - anisotropy: 이방성 필터 단계. (확장 미지원 시 무시)
	//==============================================================================
	/**
	 * @param { object | null } imageDescription 이미지 서술. ({ bytes, mimeType, flipY, isColorData, anisotropy } 나 { source, flipY, isColorData, anisotropy }, null 이거나 비면 단색)
	 * @param { number[] } fallbackColor 이미지가 없을 때 쓸 1x1 색. ([r, g, b, a], 0 ~ 255)
	 * @returns { Promise<WebGLTexture> } 지은 GL 텍스처. (이미지면 밉맵과 반복 감싸기)
	 */
	async createTexture(imageDescription, fallbackColor) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const glTexture = webGL2RenderingContext.createTexture();
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, glTexture);
		const hasBytes = imageDescription && imageDescription.bytes && imageDescription.bytes.length > 0;
		const hasSource = imageDescription && imageDescription.source;
		if (!hasBytes && !hasSource) {
			webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.RGBA8, 1, 1, 0, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, new System.Uint8Array(fallbackColor));
			return glTexture;
		}
		let imageSource = imageDescription.source;
		if (!hasSource) {
			const blobOptions = imageDescription.mimeType ? { type: imageDescription.mimeType } : {};
			imageSource = new System.Blob([imageDescription.bytes], blobOptions);
		}
		// 픽셀은 파일 그대로 받는다. (브라우저 기본값은 알파를 곱하고 색 프로필을 바꾼다. 셰이더는 곧은 알파를 기대하므로
		// 그대로 두면 알파 0 텍셀 색이 검어져 머리카락 / 수염 카드 가장자리가 어두워진다)
		const bitmapOptions = { premultiplyAlpha: "none", colorSpaceConversion: "none" };
		if (imageDescription.flipY) {
			bitmapOptions.imageOrientation = "flipY";
		}
		const imageBitmap = await System.createImageBitmap(imageSource, bitmapOptions);
		const internalFormat = imageDescription.isColorData ? webGL2RenderingContext.SRGB8_ALPHA8 : webGL2RenderingContext.RGBA8;
		webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, internalFormat, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, imageBitmap);
		webGL2RenderingContext.generateMipmap(webGL2RenderingContext.TEXTURE_2D);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, webGL2RenderingContext.LINEAR_MIPMAP_LINEAR);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, webGL2RenderingContext.LINEAR);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.REPEAT);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.REPEAT);
		if (imageDescription.anisotropy) {
			const anisotropicExtension = webGL2RenderingContext.getExtension("EXT_texture_filter_anisotropic");
			if (anisotropicExtension) {
				const maximumAnisotropy = webGL2RenderingContext.getParameter(anisotropicExtension.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
				const anisotropy = System.Math.min(imageDescription.anisotropy, maximumAnisotropy);
				webGL2RenderingContext.texParameterf(webGL2RenderingContext.TEXTURE_2D, anisotropicExtension.TEXTURE_MAX_ANISOTROPY_EXT, anisotropy);
			}
		}
		return glTexture;
	}

	//==============================================================================
	// URL 로부터 이미지 서술 로드. (정적, 외부 텍스처 파일을 중립 이미지 서술로)
	// - options: { flipY, isColorData, anisotropy }
	//==============================================================================
	/**
	 * @param { string } url 텍스처 파일 주소.
	 * @param { object | null } options { flipY = false, isColorData = false, anisotropy = 0 } (null 이면 모두 기본값)
	 * @returns { Promise<object> } 이미지 서술. (응답이 실패면 오류를 던진다)
	 */
	static async loadImageDescription(url, options = null) {
		const response = await System.fetch(url);
		if (!response.ok) {
			throw new Error(`Material image load failed: ${url}`);
		}
		const arrayBuffer = await response.arrayBuffer();
		const contentType = response.headers.get("content-type");
		const imageDescription = Material.createImageDescription(new System.Uint8Array(arrayBuffer), contentType ? contentType : null, options);
		return imageDescription;
	}

	//==============================================================================
	// 바이트로부터 이미지 서술 만들기. (정적, loadImageDescription 의 fetch 뒤 부분, 번들이나 BlobAsset 으로 이미 받은 바이트)
	// - options: { flipY, isColorData, anisotropy }
	//==============================================================================
	/**
	 * @param { Uint8Array } bytes 이미지 파일 바이트.
	 * @param { string | null } mimeType 이미지 MIME 꼴. (null 이면 꼴 없이 Blob 을 짓는다)
	 * @param { object | null } options { flipY = false, isColorData = false, anisotropy = 0 } (null 이면 모두 기본값)
	 * @returns { object } 이미지 서술. ({ bytes, mimeType, flipY, isColorData, anisotropy })
	 * @example <caption>이미 받은 바이트로 이미지 서술 만들기</caption>
	 * import { Material } from "./build/vanilla.js";
	 *
	 * const response = await fetch("assets/icons/icon.png");
	 * const arrayBuffer = await response.arrayBuffer();
	 * const bytes = new Uint8Array(arrayBuffer);
	 * const imageDescription = Material.createImageDescription(bytes, "image/png", { flipY: true, isColorData: true });
	 * console.log(imageDescription.mimeType, imageDescription.flipY, imageDescription.anisotropy);
	 */
	static createImageDescription(bytes, mimeType = null, options = null) {
		const imageDescription = {
			bytes: bytes,
			mimeType: mimeType,
			flipY: options ? options.flipY === true : false,
			isColorData: options ? options.isColorData === true : false,
			anisotropy: options && options.anisotropy ? options.anisotropy : 0,
		};
		return imageDescription;
	}

	//==============================================================================
	// 추가 텍스처 설정. (셰이더 템플릿 고유 슬롯, 기본 슬롯 밖의 유니폼 이름 / 텍스처 유닛)
	// - 유닛 1 은 섀도우 맵 전용, 0 / 2~8 은 기본 슬롯이므로 9 이상을 사용한다.
	//==============================================================================
	/**
	 * @param { string } uniformName 셰이더의 sampler2D 유니폼 이름.
	 * @param { number } textureUnit 텍스처 유닛 번호. (9 이상)
	 * @param { WebGLTexture } glTexture 묶을 GL 텍스처. (destroy 가 지우지 않는다)
	 * @example <caption>셰이더 고유 슬롯에 텍스처 더하기</caption>
	 * import { Material, HumanSkinRenderer, SKIN_TEXTURE_UNIT_DETAILHEIGHT } from "./build/vanilla.js";
	 *
	 * const canvas = document.createElement("canvas");
	 * const webGL2RenderingContext = canvas.getContext("webgl2");
	 * const humanSkinRenderer = new HumanSkinRenderer(webGL2RenderingContext);
	 * const shaderProgram = humanSkinRenderer.getShaderProgram();
	 * const description = Material.createDefaultDescription();
	 * const material = await Material.createFromDescription(webGL2RenderingContext, shaderProgram, description);
	 * const heightImageDescription = await Material.loadImageDescription("assets/icons/icon.png");
	 * const heightTexture = await material.createTexture(heightImageDescription, [128, 128, 128, 255]);
	 * material.setTexture("detailHeightTexture", SKIN_TEXTURE_UNIT_DETAILHEIGHT, heightTexture);
	 * const textureBindings = material.getTextureBindings();
	 * console.log(textureBindings.length);
	 */
	setTexture(uniformName, textureUnit, glTexture) {
		this.#extraTextureBindings.set(uniformName, [textureUnit, glTexture]);
	}

	//==============================================================================
	// 적용. (참조 셰이더에 유니폼 설정 + 텍스처 유닛 바인드)
	//==============================================================================
	apply() {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const shaderProgram = this.getShaderProgram();
		const baseColorFactor = this.getBaseColorFactor();
		const baseColorFactorLocation = shaderProgram.getUniformLocation("baseColorFactor");
		webGL2RenderingContext.uniform3f(baseColorFactorLocation, baseColorFactor[0], baseColorFactor[1], baseColorFactor[2]);
		const metallicFactor = this.getMetallicFactor();
		const metallicFactorLocation = shaderProgram.getUniformLocation("metallicFactor");
		webGL2RenderingContext.uniform1f(metallicFactorLocation, metallicFactor);
		const roughnessFactor = this.getRoughnessFactor();
		const roughnessFactorLocation = shaderProgram.getUniformLocation("roughnessFactor");
		webGL2RenderingContext.uniform1f(roughnessFactorLocation, roughnessFactor);
		const emissiveFactor = this.getEmissiveFactor();
		const emissiveFactorLocation = shaderProgram.getUniformLocation("emissiveFactor");
		webGL2RenderingContext.uniform3f(emissiveFactorLocation, emissiveFactor[0], emissiveFactor[1], emissiveFactor[2]);
		const useGlossiness = this.getUseGlossiness();
		const useGlossinessLocation = shaderProgram.getUniformLocation("useGlossiness");
		webGL2RenderingContext.uniform1i(useGlossinessLocation, useGlossiness ? 1 : 0);
		const useAlphaCutout = this.getUseAlphaCutout();
		const useAlphaCutoutLocation = shaderProgram.getUniformLocation("useAlphaCutout");
		webGL2RenderingContext.uniform1i(useAlphaCutoutLocation, useAlphaCutout ? 1 : 0);
		const subsurfaceFactor = this.getSubsurfaceFactor();
		const subsurfaceFactorLocation = shaderProgram.getUniformLocation("subsurfaceFactor");
		webGL2RenderingContext.uniform1f(subsurfaceFactorLocation, subsurfaceFactor);

		const textureBindings = this.getTextureBindings();
		for (const binding of textureBindings) {
			const uniformLocation = shaderProgram.getUniformLocation(binding[0]);
			webGL2RenderingContext.uniform1i(uniformLocation, binding[1]);
			webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + binding[1]);
			webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, binding[2]);
		}
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
	}

	//==============================================================================
	// 참조 셰이더 프로그램 반환. (머티리얼 템플릿의 셰이더)
	//==============================================================================
	/**
	 * @returns { ShaderProgram } 참조 셰이더 프로그램.
	 */
	getShaderProgram() {
		return this.#shaderProgram;
	}

	//==============================================================================
	// 베이스 컬러 팩터 반환.
	//==============================================================================
	/**
	 * @returns { number[] } 베이스 컬러 팩터. ([r, g, b])
	 */
	getBaseColorFactor() {
		return this.#baseColorFactor;
	}

	//==============================================================================
	// 메탈릭 팩터 반환.
	//==============================================================================
	/**
	 * @returns { number } 메탈릭 팩터.
	 */
	getMetallicFactor() {
		return this.#metallicFactor;
	}

	//==============================================================================
	// 러프니스 팩터 반환.
	//==============================================================================
	/**
	 * @returns { number } 러프니스 팩터.
	 */
	getRoughnessFactor() {
		return this.#roughnessFactor;
	}

	//==============================================================================
	// 이미시브 팩터 반환.
	//==============================================================================
	/**
	 * @returns { number[] } 이미시브 팩터. ([r, g, b])
	 */
	getEmissiveFactor() {
		return this.#emissiveFactor;
	}

	//==============================================================================
	// 글로시니스 경로 사용 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 글로시니스 텍스처로 러프니스를 구하면 참.
	 */
	getUseGlossiness() {
		return this.#useGlossiness;
	}

	//==============================================================================
	// 서브서피스 팩터 설정. (피부 셰이더의 화면 공간 산란 마스크 배율, 눈 / 치아처럼 산란하지 않는 부위는 0)
	//==============================================================================
	/**
	 * @param { number } subsurfaceFactor 산란 마스크 배율. (기본 1, 산란하지 않는 부위는 0)
	 */
	setSubsurfaceFactor(subsurfaceFactor) {
		this.#subsurfaceFactor = subsurfaceFactor;
	}

	//==============================================================================
	// 서브서피스 팩터 반환.
	//==============================================================================
	/**
	 * @returns { number } 산란 마스크 배율.
	 */
	getSubsurfaceFactor() {
		return this.#subsurfaceFactor;
	}

	//==============================================================================
	// 알파 컷아웃 사용 여부 설정. (오파시티 텍스처를 나중에 붙인 머티리얼용)
	//==============================================================================
	/**
	 * @param { boolean } useAlphaCutout 참이면 알파 컷아웃을 쓴다.
	 */
	setUseAlphaCutout(useAlphaCutout) {
		this.#useAlphaCutout = useAlphaCutout;
	}

	//==============================================================================
	// 알파 컷아웃 사용 여부 반환. (오파시티 맵 보유 시, 머리카락/속눈썹 등)
	//==============================================================================
	/**
	 * @returns { boolean } 알파 컷아웃을 쓰면 참.
	 */
	getUseAlphaCutout() {
		return this.#useAlphaCutout;
	}

	//==============================================================================
	// 텍스처 바인딩 목록 반환. (유니폼 이름 / 텍스처 유닛 / GL 텍스처)
	//==============================================================================
	/**
	 * @returns { Array<[string, number, WebGLTexture]> } [유니폼 이름, 텍스처 유닛, GL 텍스처] 목록. (기본 슬롯 8 개 뒤에 setTexture 로 넣은 것)
	 */
	getTextureBindings() {
		const textureBindings = [
			["baseColorTexture", TEXTURE_UNIT_BASECOLOR, this.#baseColorTexture],
			["normalTexture", TEXTURE_UNIT_NORMAL, this.#normalTexture],
			["metallicRoughnessTexture", TEXTURE_UNIT_METALLICROUGHNESS, this.#metallicRoughnessTexture],
			["glossinessTexture", TEXTURE_UNIT_GLOSSINESS, this.#glossinessTexture],
			["occlusionTexture", TEXTURE_UNIT_OCCLUSION, this.#occlusionTexture],
			["emissiveTexture", TEXTURE_UNIT_EMISSIVE, this.#emissiveTexture],
			["specularTexture", TEXTURE_UNIT_SPECULAR, this.#specularTexture],
			["opacityTexture", TEXTURE_UNIT_OPACITY, this.#opacityTexture],
		];
		for (const [uniformName, binding] of this.#extraTextureBindings) {
			textureBindings.push([uniformName, binding[0], binding[1]]);
		}
		return textureBindings;
	}

	//==============================================================================
	// 렌더링 컨텍스트 반환.
	//==============================================================================
	/**
	 * @returns { WebGL2RenderingContext } 렌더링 컨텍스트.
	 */
	getWebGL2RenderingContext() {
		return this.#webGL2RenderingContext;
	}

	//==============================================================================
	// 파괴. (기본 슬롯 텍스처를 지운다, setTexture 로 넣은 추가 텍스처는 넣은 쪽 것이라 남긴다)
	//==============================================================================
	destroy() {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const ownedTextureList = [this.#baseColorTexture, this.#normalTexture, this.#metallicRoughnessTexture, this.#glossinessTexture, this.#occlusionTexture, this.#emissiveTexture, this.#specularTexture, this.#opacityTexture];
		for (const glTexture of ownedTextureList) {
			if (glTexture) {
				webGL2RenderingContext.deleteTexture(glTexture);
			}
		}
		this.#baseColorTexture = null;
		this.#normalTexture = null;
		this.#metallicRoughnessTexture = null;
		this.#glossinessTexture = null;
		this.#occlusionTexture = null;
		this.#emissiveTexture = null;
		this.#specularTexture = null;
		this.#opacityTexture = null;
	}
}
