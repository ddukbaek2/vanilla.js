//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Object } from "../../base/object.js";


//==============================================================================
// 이미지 텍스처 캐시.
// - HTMLImageElement / HTMLCanvasElement / OffscreenCanvas 를 WebGLTexture 로
//   업로드하고 WeakMap 으로 캐시한다. (원본이 수거되면 엔트리도 함께 수거)
//==============================================================================
export class ImageTextureCache extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { WeakMap<object, { texture: WebGLTexture, isSmoothingApplied: boolean }> } */ #entries;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext
	 */
	constructor(webGL2RenderingContext) {
		super();

		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#entries = new WeakMap();
	}

	//==============================================================================
	// 이미지에 대응하는 텍스처 반환. (없으면 업로드 후 반환)
	// - 아직 로드되지 않은 이미지(크기 0)는 null 을 반환한다.
	//==============================================================================
	/**
	 * @param { HTMLImageElement | HTMLCanvasElement | OffscreenCanvas } image
	 * @param { boolean } isSmoothingEnabled
	 * @returns { WebGLTexture | null }
	 */
	getTexture(image, isSmoothingEnabled) {
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
			webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, texture);
			webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
			webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.RGBA, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, image);
			webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);
			entry = { texture: texture, isSmoothingApplied: !isSmoothingEnabled };
			this.#entries.set(image, entry);
		}
		else {
			webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, entry.texture);
		}

		// 스무딩 설정이 바뀌었으면 바인드 시점에 필터를 지연 재적용.
		if (entry.isSmoothingApplied !== isSmoothingEnabled) {
			const filter = isSmoothingEnabled ? webGL2RenderingContext.LINEAR : webGL2RenderingContext.NEAREST;
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, filter);
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, filter);
			entry.isSmoothingApplied = isSmoothingEnabled;
		}

		return entry.texture;
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
