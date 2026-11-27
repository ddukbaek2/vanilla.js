//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Object } from "../../base/object.js";
import { DecodedImageStore } from "./decodedimagestore.js";


//==============================================================================
// 이미지 텍스처 캐시.
// - HTMLImageElement / HTMLCanvasElement / OffscreenCanvas 를 WebGLTexture 로
//   업로드하고 WeakMap 으로 캐시한다. (원본이 수거되면 엔트리도 함께 수거)
// - ImageAsset 이 미리 풀어 둔 ImageBitmap 이 있으면 그것을 올리고 닫는다. (DecodedImageStore, 그림 요소를 다시 풀지 않는다)
//   미리 푼 그림은 미리 곱한 알파, sRGB, 뒤집지 않음으로 지어 그림 요소를 올린 결과와 화소까지 같다.
//==============================================================================
export class ImageTextureCache extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { WeakMap<object, { texture: WebGLTexture, isSmoothingApplied: boolean, isMipmapApplied: boolean, hasMipmap: boolean }> } */ #entries;
	/** @private @type { ((texture: WebGLTexture) => void) | null } */ #textureBinder; // 텍스처를 묶는 함수. (주인 Graphic 이 묶은 텍스처를 기억하게 넘긴다, null 이면 바로 묶는다)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext
	 * @param { ((texture: WebGLTexture) => void) | null } textureBinder - 텍스처를 묶는 함수. (null 이면 바로 묶는다)
	 */
	constructor(webGL2RenderingContext, textureBinder = null) {
		super();

		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#entries = new WeakMap();
		this.#textureBinder = textureBinder;
	}

	//==============================================================================
	// 이미지에 대응하는 텍스처 반환. (없으면 업로드 후 반환)
	// - 아직 로드되지 않은 이미지(크기 0)는 null 을 반환한다.
	// - 밉맵은 스무딩이 켜졌을 때만 쓴다. 처음 필요할 때 한 번 만든다.
	//==============================================================================
	/**
	 * @param { HTMLImageElement | HTMLCanvasElement | OffscreenCanvas } image
	 * @param { boolean } isSmoothingEnabled
	 * @param { boolean } isMipmapEnabled 줄여 그릴 때 밉맵을 쓸지. (기본 false)
	 * @returns { WebGLTexture | null }
	 */
	getTexture(image, isSmoothingEnabled, isMipmapEnabled = false) {
		if (image === null || image === undefined) {
			return null;
		}
		if (!image.width || !image.height) {
			return null;
		}

		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		let entry = this.#entries.get(image);
		if (!entry) {
			const texture = webGL2RenderingContext.createTexture();
			this.bindTexture(texture);
			// 미리 푼 그림이 있으면 그것을 올린다. (ImageBitmap 은 UNPACK 설정을 보지 않고 지을 때의 설정을 따른다)
			const decodedImage = DecodedImageStore.take(image);
			webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
			webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.RGBA, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, decodedImage !== null ? decodedImage : image);
			webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
			if (decodedImage !== null) {
				decodedImage.close();
			}
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);
			entry = { texture: texture, isSmoothingApplied: !isSmoothingEnabled, isMipmapApplied: isMipmapEnabled, hasMipmap: false };
			this.#entries.set(image, entry);
		}

		// 스무딩이나 밉맵 설정이 바뀌었으면 바인드 시점에 필터를 지연 재적용.
		// 이때만 묶는다. 그리기 위해 묶는 것은 그리는 쪽(Graphic)이 한다.
		if (entry.isSmoothingApplied !== isSmoothingEnabled || entry.isMipmapApplied !== isMipmapEnabled) {
			this.bindTexture(entry.texture);
			const filter = isSmoothingEnabled ? webGL2RenderingContext.LINEAR : webGL2RenderingContext.NEAREST;
			let minificationFilter = filter;
			if (isSmoothingEnabled && isMipmapEnabled) {
				if (!entry.hasMipmap) {
					webGL2RenderingContext.generateMipmap(webGL2RenderingContext.TEXTURE_2D);
					entry.hasMipmap = true;
				}
				minificationFilter = webGL2RenderingContext.LINEAR_MIPMAP_LINEAR;
			}
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, minificationFilter);
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, filter);
			entry.isSmoothingApplied = isSmoothingEnabled;
			entry.isMipmapApplied = isMipmapEnabled;
		}

		return entry.texture;
	}

	//==============================================================================
	// 텍스처 묶기. (받은 묶는 함수가 있으면 그것으로)
	//==============================================================================
	/**
	 * @param { WebGLTexture } texture
	 */
	bindTexture(texture) {
		const textureBinder = this.#textureBinder;
		if (textureBinder) {
			textureBinder(texture);
			return;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, texture);
	}

	//==============================================================================
	// 렌더링 컨텍스트 반환.
	//==============================================================================
	/**
	 * @returns { WebGL2RenderingContext }
	 */
	getWebGL2RenderingContext() {
		return this.#webGL2RenderingContext;
	}
}
