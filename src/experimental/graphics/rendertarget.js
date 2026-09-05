//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";


//==============================================================================
// 렌더 타겟. (오프스크린 프레임버퍼 + 컬러 텍스처 [+ 깊이 렌더버퍼 / 깊이 텍스처])
// - 포스트 프로세싱 체인의 기본 단위.
// - 옵션으로 다중 컬러 어태치먼트(MRT) / 반정밀 실수 컬러(HDR) / 깊이 텍스처를 켤 수 있다.
//   { colorAttachmentCount: 1, useFloatColor: false, useDepthTexture: false }
//==============================================================================
export class RenderTarget extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { WebGLFramebuffer | null } */ #framebuffer;
	/** @private @type { WebGLTexture[] } */ #colorTextureList;
	/** @private @type { WebGLRenderbuffer | null } */ #depthRenderbuffer;
	/** @private @type { WebGLTexture | null } */ #depthTexture;
	/** @private @type { number } */ #width;
	/** @private @type { number } */ #height;
	/** @private @type { boolean } */ #useDepth;
	/** @private @type { number } */ #colorAttachmentCount;
	/** @private @type { boolean } */ #useFloatColor;
	/** @private @type { boolean } */ #useDepthTexture;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext
	 * @param { number } width
	 * @param { number } height
	 * @param { boolean } useDepth
	 * @param { object | null } options
	 */
	constructor(webGL2RenderingContext, width, height, useDepth, options = null) {
		super();

		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#framebuffer = null;
		this.#colorTextureList = [];
		this.#depthRenderbuffer = null;
		this.#depthTexture = null;
		this.#width = 0;
		this.#height = 0;
		this.#useDepth = useDepth;
		this.#colorAttachmentCount = options && options.colorAttachmentCount ? options.colorAttachmentCount : 1;
		this.#useFloatColor = options ? options.useFloatColor === true : false;
		this.#useDepthTexture = options ? options.useDepthTexture === true : false;

		// 실수 컬러 렌더링 확장. (RGBA16F 를 컬러 어태치먼트로 쓰려면 필요)
		if (this.#useFloatColor) {
			webGL2RenderingContext.getExtension("EXT_color_buffer_float");
		}

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
		const framebuffer = webGL2RenderingContext.createFramebuffer();
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, framebuffer);

		// 컬러 어태치먼트. (개수만큼 텍스처 생성 — 실수 컬러는 RGBA16F)
		const useFloatColor = this.getUseFloatColor();
		const internalFormat = useFloatColor ? webGL2RenderingContext.RGBA16F : webGL2RenderingContext.RGBA8;
		const componentType = useFloatColor ? webGL2RenderingContext.HALF_FLOAT : webGL2RenderingContext.UNSIGNED_BYTE;
		const colorAttachmentCount = this.getColorAttachmentCount();
		const colorTextureList = [];
		const drawBufferList = [];
		for (let attachmentIndex = 0; attachmentIndex < colorAttachmentCount; ++attachmentIndex) {
			const colorTexture = webGL2RenderingContext.createTexture();
			webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, colorTexture);
			webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, internalFormat, width, height, 0, webGL2RenderingContext.RGBA, componentType, null);
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, webGL2RenderingContext.LINEAR);
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, webGL2RenderingContext.LINEAR);
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);
			const attachmentPoint = webGL2RenderingContext.COLOR_ATTACHMENT0 + attachmentIndex;
			webGL2RenderingContext.framebufferTexture2D(webGL2RenderingContext.FRAMEBUFFER, attachmentPoint, webGL2RenderingContext.TEXTURE_2D, colorTexture, 0);
			colorTextureList.push(colorTexture);
			drawBufferList.push(attachmentPoint);
		}
		if (colorAttachmentCount > 1) {
			webGL2RenderingContext.drawBuffers(drawBufferList);
		}

		// 깊이 어태치먼트. (텍스처 — 이후 패스에서 샘플링 가능 / 렌더버퍼 — 깊이 테스트 전용)
		let depthRenderbuffer = null;
		let depthTexture = null;
		if (this.#useDepth) {
			if (this.getUseDepthTexture()) {
				depthTexture = webGL2RenderingContext.createTexture();
				webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, depthTexture);
				webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.DEPTH_COMPONENT24, width, height, 0, webGL2RenderingContext.DEPTH_COMPONENT, webGL2RenderingContext.UNSIGNED_INT, null);
				webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, webGL2RenderingContext.NEAREST);
				webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, webGL2RenderingContext.NEAREST);
				webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
				webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);
				webGL2RenderingContext.framebufferTexture2D(webGL2RenderingContext.FRAMEBUFFER, webGL2RenderingContext.DEPTH_ATTACHMENT, webGL2RenderingContext.TEXTURE_2D, depthTexture, 0);
			}
			else {
				depthRenderbuffer = webGL2RenderingContext.createRenderbuffer();
				webGL2RenderingContext.bindRenderbuffer(webGL2RenderingContext.RENDERBUFFER, depthRenderbuffer);
				webGL2RenderingContext.renderbufferStorage(webGL2RenderingContext.RENDERBUFFER, webGL2RenderingContext.DEPTH_COMPONENT16, width, height);
				webGL2RenderingContext.framebufferRenderbuffer(webGL2RenderingContext.FRAMEBUFFER, webGL2RenderingContext.DEPTH_ATTACHMENT, webGL2RenderingContext.RENDERBUFFER, depthRenderbuffer);
			}
		}

		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, null);

		this.#framebuffer = framebuffer;
		this.#colorTextureList = colorTextureList;
		this.#depthRenderbuffer = depthRenderbuffer;
		this.#depthTexture = depthTexture;
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
		for (const colorTexture of this.#colorTextureList) {
			webGL2RenderingContext.deleteTexture(colorTexture);
		}
		this.#colorTextureList = [];
		if (this.#depthRenderbuffer) {
			webGL2RenderingContext.deleteRenderbuffer(this.#depthRenderbuffer);
			this.#depthRenderbuffer = null;
		}
		if (this.#depthTexture) {
			webGL2RenderingContext.deleteTexture(this.#depthTexture);
			this.#depthTexture = null;
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
	// 컬러 텍스처 반환. (어태치먼트 인덱스 — 기본 0)
	//==============================================================================
	/**
	 * @param { number } attachmentIndex
	 * @returns { WebGLTexture | null }
	 */
	getColorTexture(attachmentIndex = 0) {
		const colorTexture = this.#colorTextureList[attachmentIndex];
		return colorTexture ? colorTexture : null;
	}

	//==============================================================================
	// 깊이 텍스처 반환. (useDepthTexture 옵션일 때만 존재)
	//==============================================================================
	/**
	 * @returns { WebGLTexture | null }
	 */
	getDepthTexture() {
		return this.#depthTexture;
	}

	//==============================================================================
	// 컬러 어태치먼트 개수 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getColorAttachmentCount() {
		return this.#colorAttachmentCount;
	}

	//==============================================================================
	// 실수 컬러 사용 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	getUseFloatColor() {
		return this.#useFloatColor;
	}

	//==============================================================================
	// 깊이 텍스처 사용 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	getUseDepthTexture() {
		return this.#useDepthTexture;
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
