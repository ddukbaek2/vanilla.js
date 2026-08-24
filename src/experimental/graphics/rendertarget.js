//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";


//==============================================================================
// 렌더 타겟. (오프스크린 프레임버퍼 + 컬러 텍스처 [+ 깊이 렌더버퍼])
// - 포스트 프로세싱 체인의 기본 단위.
//==============================================================================
export class RenderTarget extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { WebGLFramebuffer | null } */ #framebuffer;
	/** @private @type { WebGLTexture | null } */ #colorTexture;
	/** @private @type { WebGLRenderbuffer | null } */ #depthRenderbuffer;
	/** @private @type { number } */ #width;
	/** @private @type { number } */ #height;
	/** @private @type { boolean } */ #useDepth;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext
	 * @param { number } width
	 * @param { number } height
	 * @param { boolean } useDepth
	 */
	constructor(webGL2RenderingContext, width, height, useDepth) {
		super();

		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#framebuffer = null;
		this.#colorTexture = null;
		this.#depthRenderbuffer = null;
		this.#width = 0;
		this.#height = 0;
		this.#useDepth = useDepth;
		this.resize(width, height);
	}

	//==============================================================================
	// 크기 변경. (같은 크기면 무시, 다르면 리소스 재생성)
	//==============================================================================
	/**
	 * @param { number } width
	 * @param { number } height
	 */
	resize(width, height) {
		const currentWidth = this.getWidth();
		const currentHeight = this.getHeight();
		if (width === currentWidth && height === currentHeight) {
			return;
		}

		this.destroy();

		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const colorTexture = webGL2RenderingContext.createTexture();
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, colorTexture);
		webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.RGBA8, width, height, 0, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, null);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, webGL2RenderingContext.LINEAR);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, webGL2RenderingContext.LINEAR);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);

		const framebuffer = webGL2RenderingContext.createFramebuffer();
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, framebuffer);
		webGL2RenderingContext.framebufferTexture2D(webGL2RenderingContext.FRAMEBUFFER, webGL2RenderingContext.COLOR_ATTACHMENT0, webGL2RenderingContext.TEXTURE_2D, colorTexture, 0);

		let depthRenderbuffer = null;
		if (this.#useDepth) {
			depthRenderbuffer = webGL2RenderingContext.createRenderbuffer();
			webGL2RenderingContext.bindRenderbuffer(webGL2RenderingContext.RENDERBUFFER, depthRenderbuffer);
			webGL2RenderingContext.renderbufferStorage(webGL2RenderingContext.RENDERBUFFER, webGL2RenderingContext.DEPTH_COMPONENT16, width, height);
			webGL2RenderingContext.framebufferRenderbuffer(webGL2RenderingContext.FRAMEBUFFER, webGL2RenderingContext.DEPTH_ATTACHMENT, webGL2RenderingContext.RENDERBUFFER, depthRenderbuffer);
		}

		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, null);

		this.#framebuffer = framebuffer;
		this.#colorTexture = colorTexture;
		this.#depthRenderbuffer = depthRenderbuffer;
		this.#width = width;
		this.#height = height;
	}

	//==============================================================================
	// 렌더링 대상으로 바인드. (프레임버퍼 + 뷰포트)
	//==============================================================================
	bind() {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const framebuffer = this.getFramebuffer();
		const width = this.getWidth();
		const height = this.getHeight();
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, framebuffer);
		webGL2RenderingContext.viewport(0, 0, width, height);
	}

	//==============================================================================
	// 파괴. (GL 리소스 해제)
	//==============================================================================
	/**
	 * @override
	 */
	destroy() {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		if (this.#framebuffer) {
			webGL2RenderingContext.deleteFramebuffer(this.#framebuffer);
			this.#framebuffer = null;
		}
		if (this.#colorTexture) {
			webGL2RenderingContext.deleteTexture(this.#colorTexture);
			this.#colorTexture = null;
		}
		if (this.#depthRenderbuffer) {
			webGL2RenderingContext.deleteRenderbuffer(this.#depthRenderbuffer);
			this.#depthRenderbuffer = null;
		}
		this.#width = 0;
		this.#height = 0;
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

	//==============================================================================
	// 프레임버퍼 반환.
	//==============================================================================
	/**
	 * @returns { WebGLFramebuffer | null }
	 */
	getFramebuffer() {
		return this.#framebuffer;
	}

	//==============================================================================
	// 컬러 텍스처 반환.
	//==============================================================================
	/**
	 * @returns { WebGLTexture | null }
	 */
	getColorTexture() {
		return this.#colorTexture;
	}

	//==============================================================================
	// 가로 크기 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getWidth() {
		return this.#width;
	}

	//==============================================================================
	// 세로 크기 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getHeight() {
		return this.#height;
	}
}
