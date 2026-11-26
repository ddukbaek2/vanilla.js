//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";


//==============================================================================
// 렌더 타겟. (오프스크린 프레임버퍼 + 컬러 텍스처 [+ 깊이 렌더버퍼 / 깊이 텍스처])
// - 포스트 프로세싱 체인의 기본 단위.
// - 옵션으로 다중 컬러 어태치먼트(MRT) / 반정밀 실수 컬러(HDR) / 깊이 텍스처 / 멀티샘플 / 깊이 비트를 켤 수 있다.
//   { colorAttachmentCount: 1, useFloatColor: false, useDepthTexture: false, sampleCount: 0, depthBits: 16 }
// - sampleCount 가 2 이상이면 멀티샘플(MSAA) 렌더버퍼에 그리고 resolve() 가 컬러 텍스처(와 깊이 텍스처)로 푼다.
//   기기가 받는 수(MAX_SAMPLES, 포맷마다 받는 표본 수)를 넘으면 그 밑의 가장 큰 수로 줄이고, 못 받거나 프레임버퍼가 완성되지 않으면 멀티샘플 없이 짓는다. (getSampleCount)
//   멀티샘플이면 getFramebuffer 는 그리는 멀티샘플 프레임버퍼, getResolveFramebuffer 는 텍스처가 붙은 프레임버퍼다. 텍스처를 읽기 전에 resolve() 를 부른다.
// - depthBits 는 깊이 렌더버퍼의 비트 수(16 이나 24)다. 깊이 텍스처는 늘 24 비트다. 멀티샘플이면서 깊이 텍스처를 쓰면 멀티샘플 깊이도 24 비트로 지어 그대로 푼다.
//==============================================================================
/**
 * @example <caption>멀티샘플 렌더 타겟에 그리고 텍스처로 풀기</caption>
 * import { RenderTarget } from "./build/vanilla.js";
 *
 * const canvas = document.createElement("canvas");
 * const webGL2RenderingContext = canvas.getContext("webgl2");
 * const renderTarget = new RenderTarget(webGL2RenderingContext, 256, 256, true, { useDepthTexture: true, sampleCount: 4 });
 * renderTarget.bind();
 * webGL2RenderingContext.clearColor(0.2, 0.4, 0.8, 1.0);
 * webGL2RenderingContext.clear(webGL2RenderingContext.COLOR_BUFFER_BIT | webGL2RenderingContext.DEPTH_BUFFER_BIT);
 * renderTarget.resolve();
 * webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, null);
 * const sampleCount = renderTarget.getSampleCount();
 * const colorTexture = renderTarget.getColorTexture();
 * const depthTexture = renderTarget.getDepthTexture();
 * console.log(sampleCount, colorTexture !== null, depthTexture !== null);
 * renderTarget.destroy();
 */
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
	/** @private @type { number } */ #requestedSampleCount; // 옵션으로 받은 표본 수.
	/** @private @type { number } */ #sampleCount; // 실제로 지은 표본 수. (0 이면 멀티샘플 없음)
	/** @private @type { number } */ #depthBits;
	/** @private @type { WebGLFramebuffer | null } */ #multisampleFramebuffer;
	/** @private @type { WebGLRenderbuffer[] } */ #multisampleColorRenderbufferList;
	/** @private @type { WebGLRenderbuffer | null } */ #multisampleDepthRenderbuffer;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext WebGL2 렌더링 컨텍스트.
	 * @param { number } width 가로 크기. (픽셀)
	 * @param { number } height 세로 크기. (픽셀)
	 * @param { boolean } useDepth 깊이 어태치먼트를 붙일지.
	 * @param { object | null } options { colorAttachmentCount = 1, useFloatColor = false, useDepthTexture = false, sampleCount = 0, depthBits = 16 } (null 이면 모두 기본값)
	 * @example <caption>컬러 어태치먼트 둘(MRT)과 실수 컬러</caption>
	 * import { RenderTarget } from "./build/vanilla.js";
	 *
	 * const canvas = document.createElement("canvas");
	 * const webGL2RenderingContext = canvas.getContext("webgl2");
	 * const renderTarget = new RenderTarget(webGL2RenderingContext, 320, 180, true, { colorAttachmentCount: 2, useFloatColor: true });
	 * const firstTexture = renderTarget.getColorTexture(0);
	 * const secondTexture = renderTarget.getColorTexture(1);
	 * console.log(firstTexture !== null, secondTexture !== null);
	 * renderTarget.resize(640, 360);
	 * const width = renderTarget.getWidth();
	 * const height = renderTarget.getHeight();
	 * console.log(width, height);
	 * renderTarget.destroy();
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
		this.#requestedSampleCount = options && options.sampleCount ? System.Math.max(0, System.Math.floor(options.sampleCount)) : 0;
		this.#sampleCount = 0;
		this.#depthBits = options && options.depthBits === 24 ? 24 : 16;
		this.#multisampleFramebuffer = null;
		this.#multisampleColorRenderbufferList = [];
		this.#multisampleDepthRenderbuffer = null;

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
	 * @param { number } width 새 가로 크기. (픽셀)
	 * @param { number } height 새 세로 크기. (픽셀)
	 */
	resize(width, height) {
		const currentWidth = this.getWidth();
		const currentHeight = this.getHeight();
		if (width === currentWidth && height === currentHeight) {
			return;
		}

		this.destroy();

		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const useFloatColor = this.getUseFloatColor();
		const internalFormat = useFloatColor ? webGL2RenderingContext.RGBA16F : webGL2RenderingContext.RGBA8;
		const componentType = useFloatColor ? webGL2RenderingContext.HALF_FLOAT : webGL2RenderingContext.UNSIGNED_BYTE;
		const colorAttachmentCount = this.getColorAttachmentCount();
		const depthRenderbufferFormat = this.getDepthBits() === 24 ? webGL2RenderingContext.DEPTH_COMPONENT24 : webGL2RenderingContext.DEPTH_COMPONENT16;

		// 멀티샘플 프레임버퍼. (컬러 렌더버퍼 개수만큼과 깊이 렌더버퍼, 완성되지 않으면 지우고 멀티샘플 없이)
		const multisampleDepthFormat = this.getUseDepthTexture() ? webGL2RenderingContext.DEPTH_COMPONENT24 : depthRenderbufferFormat;
		const formatList = this.#useDepth ? [internalFormat, multisampleDepthFormat] : [internalFormat];
		let sampleCount = this.readSupportedSampleCount(this.#requestedSampleCount, formatList);
		if (sampleCount > 0) {
			const multisampleFramebuffer = webGL2RenderingContext.createFramebuffer();
			webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, multisampleFramebuffer);
			const multisampleColorRenderbufferList = [];
			const multisampleDrawBufferList = [];
			for (let attachmentIndex = 0; attachmentIndex < colorAttachmentCount; ++attachmentIndex) {
				const colorRenderbuffer = webGL2RenderingContext.createRenderbuffer();
				webGL2RenderingContext.bindRenderbuffer(webGL2RenderingContext.RENDERBUFFER, colorRenderbuffer);
				webGL2RenderingContext.renderbufferStorageMultisample(webGL2RenderingContext.RENDERBUFFER, sampleCount, internalFormat, width, height);
				const attachmentPoint = webGL2RenderingContext.COLOR_ATTACHMENT0 + attachmentIndex;
				webGL2RenderingContext.framebufferRenderbuffer(webGL2RenderingContext.FRAMEBUFFER, attachmentPoint, webGL2RenderingContext.RENDERBUFFER, colorRenderbuffer);
				multisampleColorRenderbufferList.push(colorRenderbuffer);
				multisampleDrawBufferList.push(attachmentPoint);
			}
			if (colorAttachmentCount > 1) {
				webGL2RenderingContext.drawBuffers(multisampleDrawBufferList);
			}
			let multisampleDepthRenderbuffer = null;
			if (this.#useDepth) {
				multisampleDepthRenderbuffer = webGL2RenderingContext.createRenderbuffer();
				webGL2RenderingContext.bindRenderbuffer(webGL2RenderingContext.RENDERBUFFER, multisampleDepthRenderbuffer);
				webGL2RenderingContext.renderbufferStorageMultisample(webGL2RenderingContext.RENDERBUFFER, sampleCount, multisampleDepthFormat, width, height);
				webGL2RenderingContext.framebufferRenderbuffer(webGL2RenderingContext.FRAMEBUFFER, webGL2RenderingContext.DEPTH_ATTACHMENT, webGL2RenderingContext.RENDERBUFFER, multisampleDepthRenderbuffer);
			}
			webGL2RenderingContext.bindRenderbuffer(webGL2RenderingContext.RENDERBUFFER, null);
			this.#multisampleFramebuffer = multisampleFramebuffer;
			this.#multisampleColorRenderbufferList = multisampleColorRenderbufferList;
			this.#multisampleDepthRenderbuffer = multisampleDepthRenderbuffer;
			const framebufferStatus = webGL2RenderingContext.checkFramebufferStatus(webGL2RenderingContext.FRAMEBUFFER);
			if (framebufferStatus !== webGL2RenderingContext.FRAMEBUFFER_COMPLETE) {
				this.destroyMultisample();
				sampleCount = 0;
			}
		}
		this.#sampleCount = sampleCount;

		const framebuffer = webGL2RenderingContext.createFramebuffer();
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, framebuffer);

		// 컬러 어태치먼트. (개수만큼 텍스처 생성, 실수 컬러는 RGBA16F)
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

		// 깊이 어태치먼트. (텍스처, 이후 패스에서 샘플링 가능 / 렌더버퍼, 깊이 테스트 전용, 멀티샘플이면 깊이 시험은 멀티샘플 쪽이 맡아 렌더버퍼는 짓지 않는다)
		let depthRenderbuffer = null;
		let depthTexture = null;
		if (this.#useDepth && (this.getUseDepthTexture() || sampleCount === 0)) {
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
				webGL2RenderingContext.renderbufferStorage(webGL2RenderingContext.RENDERBUFFER, depthRenderbufferFormat, width, height);
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
	// 기기가 받는 표본 수. (요청 수를 MAX_SAMPLES 와 포맷마다 받는 표본 수 밑의 가장 큰 수로, 2 밑이면 0)
	//==============================================================================
	/**
	 * @param { number } requestedSampleCount 요청한 표본 수.
	 * @param { Array<number> } internalFormatList 렌더버퍼 내부 포맷 목록. (모든 포맷이 받는 수로 줄인다)
	 * @returns { number } 기기가 받는 표본 수. (2 밑이면 0)
	 */
	readSupportedSampleCount(requestedSampleCount, internalFormatList) {
		if (requestedSampleCount < 2) {
			return 0;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const maximumSampleCount = webGL2RenderingContext.getParameter(webGL2RenderingContext.MAX_SAMPLES);
		let sampleCount = System.Math.min(requestedSampleCount, maximumSampleCount);
		for (const internalFormat of internalFormatList) {
			const supportedSampleCountList = webGL2RenderingContext.getInternalformatParameter(webGL2RenderingContext.RENDERBUFFER, internalFormat, webGL2RenderingContext.SAMPLES);
			let bestSampleCount = 0;
			if (supportedSampleCountList) {
				for (const supportedSampleCount of supportedSampleCountList) {
					if (supportedSampleCount <= sampleCount && supportedSampleCount > bestSampleCount) {
						bestSampleCount = supportedSampleCount;
					}
				}
			}
			sampleCount = bestSampleCount;
		}
		return sampleCount >= 2 ? sampleCount : 0;
	}

	//==============================================================================
	// 멀티샘플을 텍스처로 풀기. (멀티샘플이 아니면 아무것도 하지 않음, 컬러 어태치먼트마다와 깊이 텍스처, 묶여 있던 프레임버퍼로 돌림)
	//==============================================================================
	resolve() {
		const multisampleFramebuffer = this.#multisampleFramebuffer;
		if (multisampleFramebuffer === null) {
			return;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const previousFramebuffer = webGL2RenderingContext.getParameter(webGL2RenderingContext.FRAMEBUFFER_BINDING);
		const width = this.getWidth();
		const height = this.getHeight();
		const colorAttachmentCount = this.getColorAttachmentCount();
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.READ_FRAMEBUFFER, multisampleFramebuffer);
		const resolveFramebuffer = this.getResolveFramebuffer();
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.DRAW_FRAMEBUFFER, resolveFramebuffer);
		if (colorAttachmentCount > 1) {
			const drawBufferList = [];
			for (let attachmentIndex = 0; attachmentIndex < colorAttachmentCount; ++attachmentIndex) {
				for (let bufferIndex = 0; bufferIndex < colorAttachmentCount; ++bufferIndex) {
					drawBufferList[bufferIndex] = bufferIndex === attachmentIndex ? webGL2RenderingContext.COLOR_ATTACHMENT0 + bufferIndex : webGL2RenderingContext.NONE;
				}
				webGL2RenderingContext.readBuffer(webGL2RenderingContext.COLOR_ATTACHMENT0 + attachmentIndex);
				webGL2RenderingContext.drawBuffers(drawBufferList);
				webGL2RenderingContext.blitFramebuffer(0, 0, width, height, 0, 0, width, height, webGL2RenderingContext.COLOR_BUFFER_BIT, webGL2RenderingContext.NEAREST);
			}
			for (let bufferIndex = 0; bufferIndex < colorAttachmentCount; ++bufferIndex) {
				drawBufferList[bufferIndex] = webGL2RenderingContext.COLOR_ATTACHMENT0 + bufferIndex;
			}
			webGL2RenderingContext.readBuffer(webGL2RenderingContext.COLOR_ATTACHMENT0);
			webGL2RenderingContext.drawBuffers(drawBufferList);
		}
		else {
			webGL2RenderingContext.blitFramebuffer(0, 0, width, height, 0, 0, width, height, webGL2RenderingContext.COLOR_BUFFER_BIT, webGL2RenderingContext.NEAREST);
		}
		const depthTexture = this.getDepthTexture();
		if (depthTexture !== null) {
			webGL2RenderingContext.blitFramebuffer(0, 0, width, height, 0, 0, width, height, webGL2RenderingContext.DEPTH_BUFFER_BIT, webGL2RenderingContext.NEAREST);
		}
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, previousFramebuffer);
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
		this.destroyMultisample();
		this.#width = 0;
		this.#height = 0;
	}

	//==============================================================================
	// 멀티샘플 프레임버퍼와 렌더버퍼 지우기.
	//==============================================================================
	destroyMultisample() {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		if (this.#multisampleFramebuffer) {
			webGL2RenderingContext.deleteFramebuffer(this.#multisampleFramebuffer);
			this.#multisampleFramebuffer = null;
		}
		for (const colorRenderbuffer of this.#multisampleColorRenderbufferList) {
			webGL2RenderingContext.deleteRenderbuffer(colorRenderbuffer);
		}
		this.#multisampleColorRenderbufferList = [];
		if (this.#multisampleDepthRenderbuffer) {
			webGL2RenderingContext.deleteRenderbuffer(this.#multisampleDepthRenderbuffer);
			this.#multisampleDepthRenderbuffer = null;
		}
		this.#sampleCount = 0;
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
	// 프레임버퍼 반환. (그리는 프레임버퍼, 멀티샘플이면 멀티샘플 프레임버퍼)
	//==============================================================================
	/**
	 * @returns { WebGLFramebuffer | null } 그리는 프레임버퍼. (멀티샘플이면 멀티샘플 프레임버퍼, 파괴 뒤면 null)
	 */
	getFramebuffer() {
		return this.#multisampleFramebuffer !== null ? this.#multisampleFramebuffer : this.#framebuffer;
	}

	//==============================================================================
	// 텍스처가 붙은 프레임버퍼 반환. (멀티샘플이 아니면 getFramebuffer 와 같음)
	//==============================================================================
	/**
	 * @returns { WebGLFramebuffer | null } 컬러 텍스처가 붙은 프레임버퍼. (파괴 뒤면 null)
	 */
	getResolveFramebuffer() {
		return this.#framebuffer;
	}

	//==============================================================================
	// 실제로 지은 표본 수 반환. (0 이면 멀티샘플 없음)
	//==============================================================================
	/**
	 * @returns { number } 실제로 지은 표본 수. (0 이면 멀티샘플 없음)
	 */
	getSampleCount() {
		return this.#sampleCount;
	}

	//==============================================================================
	// 깊이 렌더버퍼 비트 수 반환. (16 이나 24)
	//==============================================================================
	/**
	 * @returns { number } 깊이 렌더버퍼 비트 수. (16 이나 24)
	 */
	getDepthBits() {
		return this.#depthBits;
	}

	//==============================================================================
	// 컬러 텍스처 반환. (어태치먼트 인덱스, 기본 0)
	//==============================================================================
	/**
	 * @param { number } attachmentIndex 컬러 어태치먼트 번호. (기본 0)
	 * @returns { WebGLTexture | null } 컬러 텍스처. (번호가 범위 밖이면 null)
	 */
	getColorTexture(attachmentIndex = 0) {
		const colorTexture = this.#colorTextureList[attachmentIndex];
		return colorTexture ? colorTexture : null;
	}

	//==============================================================================
	// 깊이 텍스처 반환. (useDepthTexture 옵션일 때만 존재)
	//==============================================================================
	/**
	 * @returns { WebGLTexture | null } 깊이 텍스처. (useDepth 와 useDepthTexture 를 함께 켰을 때만, 아니면 null)
	 */
	getDepthTexture() {
		return this.#depthTexture;
	}

	//==============================================================================
	// 컬러 어태치먼트 개수 반환.
	//==============================================================================
	/**
	 * @returns { number } 컬러 어태치먼트 개수.
	 */
	getColorAttachmentCount() {
		return this.#colorAttachmentCount;
	}

	//==============================================================================
	// 실수 컬러 사용 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 컬러가 RGBA16F 면 참.
	 */
	getUseFloatColor() {
		return this.#useFloatColor;
	}

	//==============================================================================
	// 깊이 텍스처 사용 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 깊이 텍스처를 쓰면 참.
	 */
	getUseDepthTexture() {
		return this.#useDepthTexture;
	}

	//==============================================================================
	// 가로 크기 반환.
	//==============================================================================
	/**
	 * @returns { number } 가로 크기. (픽셀, 파괴 뒤면 0)
	 */
	getWidth() {
		return this.#width;
	}

	//==============================================================================
	// 세로 크기 반환.
	//==============================================================================
	/**
	 * @returns { number } 세로 크기. (픽셀, 파괴 뒤면 0)
	 */
	getHeight() {
		return this.#height;
	}
}
