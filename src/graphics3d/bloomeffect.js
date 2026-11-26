//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { RenderTarget } from "./rendertarget.js";
import { FullscreenPass } from "../core/fullscreenpass.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 밝은 영역 추출 패스. (씬 → 하프 해상도)
const BRIGHTPASS_FRAGMENTSHADER_SOURCE = `#version 300 es
precision highp float;
in vec2 fragmentTextureCoordinate;
uniform sampler2D sceneTexture;
uniform vec2 thresholdRange;
out vec4 outputColor;
void main() {
	vec3 sceneColor = texture(sceneTexture, fragmentTextureCoordinate).rgb;
	float brightness = max(max(sceneColor.r, sceneColor.g), sceneColor.b);
	float extractFactor = smoothstep(thresholdRange.x, thresholdRange.y, brightness);
	outputColor = vec4(sceneColor * extractFactor, 1.0);
}
`;

// 9탭 가우시안 블러 패스. (가로/세로 분리)
const BLUR_FRAGMENTSHADER_SOURCE = `#version 300 es
precision highp float;
in vec2 fragmentTextureCoordinate;
uniform sampler2D sourceTexture;
uniform vec2 blurDirection; // (1/width, 0) 또는 (0, 1/height)
out vec4 outputColor;
void main() {
	float weights[5] = float[5](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
	vec3 color = texture(sourceTexture, fragmentTextureCoordinate).rgb * weights[0];
	for (int tapIndex = 1; tapIndex < 5; ++tapIndex) {
		vec2 tapOffset = blurDirection * float(tapIndex) * 1.6;
		color += texture(sourceTexture, fragmentTextureCoordinate + tapOffset).rgb * weights[tapIndex];
		color += texture(sourceTexture, fragmentTextureCoordinate - tapOffset).rgb * weights[tapIndex];
	}
	outputColor = vec4(color, 1.0);
}
`;


//==============================================================================
// 블룸 이펙트. (밝은 영역 추출 → 하프 해상도 가우시안 블러 핑퐁)
// - render() 결과 텍스처를 최종 합성 패스에서 가산하는 방식으로 사용한다.
// - 주고받는 판은 기본 RGBA8 이라 1 을 넘는 밝은 값이 잘린다. setUseFloatColor(true) 면 RGBA16F 로 지어 HDR 값을 그대로 흐린다.
//==============================================================================
/**
 * @example <caption>씬 텍스처에서 블룸을 뽑아 화면에 더하기</caption>
 * import { BloomEffect, RenderTarget, FullscreenPass } from "./build/vanilla.js";
 *
 * const width = 320;
 * const height = 180;
 * const canvas = document.createElement("canvas");
 * canvas.width = width;
 * canvas.height = height;
 * document.body.appendChild(canvas);
 * const webGL2RenderingContext = canvas.getContext("webgl2");
 * const sceneRenderTarget = new RenderTarget(webGL2RenderingContext, width, height, true);
 * sceneRenderTarget.bind();
 * webGL2RenderingContext.clearColor(1.0, 0.9, 0.6, 1.0);
 * webGL2RenderingContext.clear(webGL2RenderingContext.COLOR_BUFFER_BIT | webGL2RenderingContext.DEPTH_BUFFER_BIT);
 *
 * const bloomEffect = new BloomEffect(webGL2RenderingContext);
 * bloomEffect.resize(width, height);
 * bloomEffect.setThreshold(0.6, 0.9);
 * bloomEffect.setIterationCount(3);
 * const sceneColorTexture = sceneRenderTarget.getColorTexture();
 * bloomEffect.render(sceneColorTexture);
 * const bloomTexture = bloomEffect.getResultTexture();
 *
 * const compositeShaderSource = `#version 300 es
 * precision highp float;
 * in vec2 fragmentTextureCoordinate;
 * uniform sampler2D sceneTexture;
 * uniform sampler2D bloomTexture;
 * out vec4 outputColor;
 * void main() {
 * 	vec3 sceneColor = texture(sceneTexture, fragmentTextureCoordinate).rgb;
 * 	vec3 bloomColor = texture(bloomTexture, fragmentTextureCoordinate).rgb;
 * 	outputColor = vec4(sceneColor + bloomColor * 0.8, 1.0);
 * }
 * `;
 * const compositePass = new FullscreenPass(webGL2RenderingContext, compositeShaderSource);
 * webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, null);
 * webGL2RenderingContext.viewport(0, 0, width, height);
 * compositePass.use();
 * const sceneTextureLocation = compositePass.getUniformLocation("sceneTexture");
 * const bloomTextureLocation = compositePass.getUniformLocation("bloomTexture");
 * webGL2RenderingContext.uniform1i(sceneTextureLocation, 0);
 * webGL2RenderingContext.uniform1i(bloomTextureLocation, 1);
 * webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
 * webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, sceneColorTexture);
 * webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE1);
 * webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, bloomTexture);
 * compositePass.draw();
 * webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
 */
export class BloomEffect extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { FullscreenPass } */ #brightPass;
	/** @private @type { FullscreenPass } */ #blurPass;
	/** @private @type { RenderTarget } */ #pingRenderTarget;
	/** @private @type { RenderTarget } */ #pongRenderTarget;
	/** @private @type { number } */ #thresholdStart;
	/** @private @type { number } */ #thresholdEnd;
	/** @private @type { number } */ #iterationCount;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext WebGL2 렌더링 컨텍스트.
	 */
	constructor(webGL2RenderingContext) {
		super();

		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#brightPass = new FullscreenPass(webGL2RenderingContext, BRIGHTPASS_FRAGMENTSHADER_SOURCE);
		this.#blurPass = new FullscreenPass(webGL2RenderingContext, BLUR_FRAGMENTSHADER_SOURCE);
		this.#pingRenderTarget = new RenderTarget(webGL2RenderingContext, 2, 2, false);
		this.#pongRenderTarget = new RenderTarget(webGL2RenderingContext, 2, 2, false);
		this.#thresholdStart = 0.5;
		this.#thresholdEnd = 0.95;
		this.#iterationCount = 2;
	}

	//==============================================================================
	// 크기 변경. (씬 해상도 기준, 내부는 하프 해상도)
	//==============================================================================
	/**
	 * @param { number } sceneWidth 씬 가로 크기. (픽셀, 내부 판은 그 반이고 최소 1)
	 * @param { number } sceneHeight 씬 세로 크기. (픽셀, 내부 판은 그 반이고 최소 1)
	 */
	resize(sceneWidth, sceneHeight) {
		const halfWidth = System.Math.max(1, sceneWidth >> 1);
		const halfHeight = System.Math.max(1, sceneHeight >> 1);
		this.#pingRenderTarget.resize(halfWidth, halfHeight);
		this.#pongRenderTarget.resize(halfWidth, halfHeight);
	}

	//==============================================================================
	// 블룸 렌더링. (호출 후 결과는 getResultTexture())
	// - 부수 효과: 깊이/블렌드 비활성, TEXTURE0 활성, 프레임버퍼 바인드가 변경된다.
	//==============================================================================
	/**
	 * @param { WebGLTexture } sceneColorTexture 밝은 영역을 뽑을 씬 컬러 텍스처.
	 */
	render(sceneColorTexture) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.disable(webGL2RenderingContext.DEPTH_TEST);
		webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);

		// 1. 밝은 영역 추출. (씬 → 핑)
		const pingRenderTarget = this.getPingRenderTarget();
		const pongRenderTarget = this.getPongRenderTarget();
		pingRenderTarget.bind();
		const brightPass = this.getBrightPass();
		brightPass.use();
		const brightSceneTextureLocation = brightPass.getUniformLocation("sceneTexture");
		webGL2RenderingContext.uniform1i(brightSceneTextureLocation, 0);
		const brightThresholdRangeLocation = brightPass.getUniformLocation("thresholdRange");
		webGL2RenderingContext.uniform2f(brightThresholdRangeLocation, this.#thresholdStart, this.#thresholdEnd);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, sceneColorTexture);
		brightPass.draw();

		// 2. 가로/세로 가우시안 블러 핑퐁.
		const blurPass = this.getBlurPass();
		blurPass.use();
		const blurSourceTextureLocation = blurPass.getUniformLocation("sourceTexture");
		webGL2RenderingContext.uniform1i(blurSourceTextureLocation, 0);
		const blurDirectionLocation = blurPass.getUniformLocation("blurDirection");
		const iterationCount = this.getIterationCount();
		for (let blurIndex = 0; blurIndex < iterationCount; ++blurIndex) {
			// 가로. (핑 → 퐁)
			pongRenderTarget.bind();
			const pingWidth = pingRenderTarget.getWidth();
			webGL2RenderingContext.uniform2f(blurDirectionLocation, 1 / pingWidth, 0);
			const pingColorTexture = pingRenderTarget.getColorTexture();
			webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, pingColorTexture);
			blurPass.draw();

			// 세로. (퐁 → 핑)
			pingRenderTarget.bind();
			const pongHeight = pongRenderTarget.getHeight();
			webGL2RenderingContext.uniform2f(blurDirectionLocation, 0, 1 / pongHeight);
			const pongColorTexture = pongRenderTarget.getColorTexture();
			webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, pongColorTexture);
			blurPass.draw();
		}
	}

	//==============================================================================
	// 결과 텍스처 반환. (render() 이후)
	//==============================================================================
	/**
	 * @returns { WebGLTexture | null } 흐린 결과 텍스처. (핑 판의 컬러 텍스처)
	 */
	getResultTexture() {
		const pingRenderTarget = this.getPingRenderTarget();
		const resultTexture = pingRenderTarget.getColorTexture();
		return resultTexture;
	}

	//==============================================================================
	// 추출 임계값 설정. (씬 밝기 특성에 맞게 조정)
	//==============================================================================
	/**
	 * @param { number } thresholdStart 이 밝기부터 뽑기 시작한다. (세 채널 가운데 가장 큰 값, 기본 0.5)
	 * @param { number } thresholdEnd 이 밝기 이상은 그대로 뽑는다. (사이는 smoothstep, 기본 0.95)
	 */
	setThreshold(thresholdStart, thresholdEnd) {
		this.#thresholdStart = thresholdStart;
		this.#thresholdEnd = thresholdEnd;
	}

	//==============================================================================
	// 블러 반복 횟수 설정.
	//==============================================================================
	/**
	 * @param { number } iterationCount 가로, 세로 블러 한 쌍을 되풀이할 횟수. (기본 2, 0 이면 뽑기만)
	 */
	setIterationCount(iterationCount) {
		this.#iterationCount = iterationCount;
	}

	//==============================================================================
	// 실수 컬러 설정. (true 면 주고받는 판을 RGBA16F 로 다시 지어 1 을 넘는 밝은 값이 잘리지 않는다, 기본 false 는 RGBA8, 같으면 그대로)
	//==============================================================================
	/**
	 * @param { boolean } useFloatColor 참이면 RGBA16F, 거짓이면 RGBA8.
	 */
	setUseFloatColor(useFloatColor) {
		if (this.getUseFloatColor() === useFloatColor) {
			return;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const pingRenderTarget = this.getPingRenderTarget();
		const pongRenderTarget = this.getPongRenderTarget();
		const width = System.Math.max(1, pingRenderTarget.getWidth());
		const height = System.Math.max(1, pingRenderTarget.getHeight());
		pingRenderTarget.destroy();
		pongRenderTarget.destroy();
		this.#pingRenderTarget = new RenderTarget(webGL2RenderingContext, width, height, false, { useFloatColor: useFloatColor });
		this.#pongRenderTarget = new RenderTarget(webGL2RenderingContext, width, height, false, { useFloatColor: useFloatColor });
	}

	//==============================================================================
	// 실수 컬러 사용 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 주고받는 판이 RGBA16F 면 참.
	 */
	getUseFloatColor() {
		const pingRenderTarget = this.getPingRenderTarget();
		return pingRenderTarget.getUseFloatColor();
	}

	//==============================================================================
	// 블러 반복 횟수 반환.
	//==============================================================================
	/**
	 * @returns { number } 블러 반복 횟수.
	 */
	getIterationCount() {
		return this.#iterationCount;
	}

	//==============================================================================
	// 파괴. (GL 리소스 해제)
	//==============================================================================
	/**
	 * @override
	 */
	destroy() {
		this.#pingRenderTarget.destroy();
		this.#pongRenderTarget.destroy();
		this.#brightPass.destroy();
		this.#blurPass.destroy();
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
	// 밝은 영역 추출 패스 반환.
	//==============================================================================
	/**
	 * @returns { FullscreenPass } 밝은 영역 추출 패스.
	 */
	getBrightPass() {
		return this.#brightPass;
	}

	//==============================================================================
	// 블러 패스 반환.
	//==============================================================================
	/**
	 * @returns { FullscreenPass } 가우시안 블러 패스.
	 */
	getBlurPass() {
		return this.#blurPass;
	}

	//==============================================================================
	// 핑 렌더 타겟 반환. (최종 결과 보관)
	//==============================================================================
	/**
	 * @returns { RenderTarget } 핑 렌더 타겟. (결과를 담는다)
	 */
	getPingRenderTarget() {
		return this.#pingRenderTarget;
	}

	//==============================================================================
	// 퐁 렌더 타겟 반환.
	//==============================================================================
	/**
	 * @returns { RenderTarget } 퐁 렌더 타겟. (가로 블러 중간 결과)
	 */
	getPongRenderTarget() {
		return this.#pongRenderTarget;
	}
}
