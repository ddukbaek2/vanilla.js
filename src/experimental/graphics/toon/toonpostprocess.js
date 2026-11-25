//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { RenderTarget } from "../rendertarget.js";
import { BloomEffect } from "../bloomeffect.js";
import { MultiLevelBloomEffect } from "../multilevelbloomeffect.js";
import { FullscreenPass } from "../fullscreenpass.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
const COMPOSITE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 fragmentTextureCoordinate;
uniform sampler2D sceneTexture;
uniform sampler2D bloomTexture;
uniform sampler2D depthTexture;
uniform float bloomStrength;
uniform float exposure;
uniform float hdrInput;
uniform float brightness;
uniform vec4 litCenter;
uniform float litInnerRadius;
uniform mat4 inverseViewProjectionMatrix;
uniform float saturation;
uniform float contrast;
uniform vec3 toneColor;
uniform float toneAmount;
uniform vec3 hazeColor;
uniform float hazeAmount;
uniform float vignetteStrength;
out vec4 fragmentColor;
vec3 mapTone(vec3 color) {
	color *= exposure;
	return clamp((color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14), 0.0, 1.0);
}
void main() {
	vec3 scene = texture(sceneTexture, fragmentTextureCoordinate).rgb;
	vec3 bloom = texture(bloomTexture, fragmentTextureCoordinate).rgb;
	vec3 color = hdrInput > 0.5 ? pow(mapTone(scene + bloom * bloomStrength), vec3(1.0 / 2.2)) : clamp(scene + bloom * bloomStrength, 0.0, 1.0);
	float localBrightness = brightness;
	if (litCenter.w > 0.0) {
		float depth = texture(depthTexture, fragmentTextureCoordinate).r;
		vec4 worldPoint = inverseViewProjectionMatrix * vec4(fragmentTextureCoordinate * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
		float litDistance = length(worldPoint.xz / worldPoint.w - litCenter.xz);
		localBrightness = mix(brightness, 1.0, 1.0 - smoothstep(litInnerRadius, litCenter.w, litDistance));
	}
	color *= localBrightness;
	float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
	color = mix(vec3(luminance), color, saturation);
	color = mix(color, color * toneColor, toneAmount);
	color = mix(color, hazeColor, hazeAmount * (1.0 - luminance));
	color = (color - 0.5) * contrast + 0.5;
	vec2 centered = fragmentTextureCoordinate * 2.0 - 1.0;
	color *= 1.0 - vignetteStrength * smoothstep(0.45, 1.42, length(centered));
	fragmentColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;


//==============================================================================
// 툰 HDR 마무리. (실수 렌더 타겟에 그린 선형 색을 블룸, 노출, 톤매핑, 감마로 화면에 낸다)
// - RenderTarget(반정밀 실수 색, 깊이), BloomEffect(또는 MultiLevelBloomEffect), FullscreenPass 를 엮는다.
// - 사용: ToonRenderer.setHdrOutput(true) 뒤 begin(바탕 선형 색) → ToonRenderer 로 그리기 → end(낼 프레임버퍼, 뷰포트)
//   end 는 (멀티샘플이면 풀고) 블룸을 셈하고 톤매핑한 색을 낼 프레임버퍼(null 이면 화면)에 그린다.
// - 생성 옵션: new ToonPostProcess(gl, 너비, 높이, { sampleCount, useFloatColor, depthBits, useDepthTexture }) (옵션이 없으면 지금과 같은 RGBA16F, 깊이 16, 멀티샘플 없음)
//   sampleCount 가 2 이상이면 씬을 멀티샘플(MSAA) 렌더버퍼에 그리고 end 앞에서 텍스처로 푼다. 기기가 받는 수로 줄인다. (getSampleCount, setSampleCount)
//   depthBits 24 는 깊이 24 비트. (먼 면이 먼 장면) useDepthTexture 는 씬 깊이를 텍스처로 남긴다. (setLitArea 가 쓴다)
// - 색 공간: 씬 렌더 타겟에는 선형 색을 쓴다. (ToonRenderer.setHdrOutput(true), ToonScreenOutline.setHdrOutput(true), ToonVfx 색도 선형으로 본다)
//   감마를 건 색 g 를 실수 판에 쓰고 합성에서 g^2.2 로 되돌리던 게임은 그 값을 미리 선형으로 바꿔 넘긴다. 색은 c^2.2, 감마 쪽에서 곱하던 밝기 배 k 는 선형 k^2.2 다.
//   (예: 1.37 은 선형 2, 1.6 은 2.81, 2.08 은 5, 밝기 1.6 에 배 1.6 이면 (1.6 x 1.6)^2.2 = 7.9) 블룸 문턱과 무릎은 선형 밝기다.
// - 실수 판을 못 쓰는 기기: useFloatColor(기본 true)여도 ToonPostProcess.isFloatColorSupported 가 false 면 RGBA8 판으로 짓는다. (getUseFloatColor 가 false)
//   그때와 useFloatColor: false 는 LDR 길이다. 씬에는 화면 색(감마를 건 색, ToonRenderer.setHdrOutput(false))을 그리고, 합성은 톤매핑과 감마 없이 블룸을 더해 색 보정만 건다.
// - 블룸: 기본은 반 해상도 9 탭 가우시안(BloomEffect, 문턱 0.9 ~ 1.6, 주고받는 판 RGBA8, setBloomFloatColor 로 RGBA16F).
//   setBloomLevels(단 수, 문턱, 무릎) 로 단 수를 1 이상 주면 MultiLevelBloomEffect(반씩 줄였다 천막 꼴로 키우며 더함, 씬과 같은 정밀도의 판)로 바꾼다. 0 이면 기본으로 돌린다. 세기는 setBloom 이 둘 다에 쓴다.
// - 톤매핑은 ACES 근사(Narkowicz)다. 노출(setExposure)을 곱한 뒤 매핑하고 sRGB 감마를 건다.
// - 색 보정: 감마를 건 뒤 밝기(setBrightness, 밝힌 자리 setLitArea 안은 1 쪽으로), 채도, 색조(밝기 1 로 맞춘 색을 곱함), 안개빛(어두운 곳을 그 색 쪽으로), 대비, 가장자리 어둡게 차례로 건다. (setColorGrade, setVignette)
//   기본은 밝기 1, 채도 1, 대비 1, 색조 0, 안개빛 0, 가장자리 0 이라 보정이 없다.
// - 해상도 배율: setResolutionScale(배율) 이면 씬 판을 출력 크기 x 배율로 짓고 end 의 뷰포트로 키워(선형 거르기) 낸다. (3D 만 낮춰 그리고 UI 는 기기 화소 그대로 둘 때, 기본 1)
// - 노드 사각형 안에 낼 때: resize(사각형 너비, 높이) → begin → 그리기(ToonRenderer 의 화면 사각형은 풀어 둔다) → end(null, [x, 드로잉 버퍼 높이 - y - 높이, 너비, 높이]).
//==============================================================================
export class ToonPostProcess {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { RenderTarget } */ #sceneRenderTarget;
	/** @private @type { BloomEffect } */ #bloomEffect;
	/** @private @type { MultiLevelBloomEffect | null } */ #multiLevelBloomEffect; // 단 수를 주면 쓰는 다단 블룸.
	/** @private @type { FullscreenPass } */ #compositePass;
	/** @private @type { boolean } */ #useFloatColor; // 씬 판이 실수인지. (HDR 길)
	/** @private @type { number } */ #requestedSampleCount;
	/** @private @type { number } */ #depthBits;
	/** @private @type { boolean } */ #useDepthTexture;
	/** @private @type { number } */ #outputWidth; // resize 로 받은 출력 크기.
	/** @private @type { number } */ #outputHeight;
	/** @private @type { number } */ #resolutionScale;
	/** @private @type { number } */ #exposure;
	/** @private @type { number } */ #bloomStrength;
	/** @private @type { boolean } */ #isBloomEnabled;
	/** @private @type { number } */ #bloomThreshold; // 다단 블룸의 문턱.
	/** @private @type { number } */ #bloomKnee; // 다단 블룸의 무릎.
	/** @private @type { number } */ #brightness;
	/** @private @type { object | null } */ #litArea; // 밝힌 자리. ({ center, innerRadius, outerRadius, inverseViewProjectionElements })
	/** @private @type { number } */ #saturation;
	/** @private @type { number } */ #contrast;
	/** @private @type { Array<number> } */ #toneColor; // 밝기 1 로 맞춘 곱.
	/** @private @type { number } */ #toneAmount;
	/** @private @type { Array<number> } */ #hazeColor;
	/** @private @type { number } */ #hazeAmount;
	/** @private @type { number } */ #vignetteStrength;

	//==============================================================================
	// 생성. (화면 픽셀 크기, 옵션 { sampleCount = 0, useFloatColor = true, depthBits = 16, useDepthTexture = false })
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext
	 * @param { number } width
	 * @param { number } height
	 * @param { object | null } [options]
	 */
	constructor(webGL2RenderingContext, width, height, options = null) {
		this.#webGL2RenderingContext = webGL2RenderingContext;
		webGL2RenderingContext.getExtension("EXT_color_buffer_float");
		webGL2RenderingContext.getExtension("EXT_color_buffer_half_float");
		const isFloatColorRequested = options === null || options.useFloatColor !== false;
		this.#useFloatColor = isFloatColorRequested && ToonPostProcess.isFloatColorSupported(webGL2RenderingContext);
		this.#requestedSampleCount = options !== null && options.sampleCount ? options.sampleCount : 0;
		this.#depthBits = options !== null && options.depthBits === 24 ? 24 : 16;
		this.#useDepthTexture = options !== null && options.useDepthTexture === true;
		this.#outputWidth = System.Math.max(1, width);
		this.#outputHeight = System.Math.max(1, height);
		this.#resolutionScale = 1;
		this.#sceneRenderTarget = this.createSceneRenderTarget();
		this.#bloomEffect = new BloomEffect(webGL2RenderingContext);
		this.#bloomEffect.resize(System.Math.max(1, width), System.Math.max(1, height));
		this.#bloomEffect.setThreshold(0.9, 1.6);
		this.#multiLevelBloomEffect = null;
		this.#compositePass = new FullscreenPass(webGL2RenderingContext, COMPOSITE_FRAGMENT_SHADER);
		this.#exposure = 1;
		this.#bloomStrength = 0.6;
		this.#isBloomEnabled = true;
		this.#bloomThreshold = 1;
		this.#bloomKnee = 0.25;
		this.#brightness = 1;
		this.#litArea = null;
		this.#saturation = 1;
		this.#contrast = 1;
		this.#toneColor = [1, 1, 1];
		this.#toneAmount = 0;
		this.#hazeColor = [0, 0, 0];
		this.#hazeAmount = 0;
		this.#vignetteStrength = 0;
	}

	//==============================================================================
	// 실수 컬러 판을 그릴 수 있는지. (EXT_color_buffer_float 나 EXT_color_buffer_half_float 가 있고, 1 x 1 RGBA16F 를 붙인 프레임버퍼가 완성되는지)
	//==============================================================================
	/**
	 * @static
	 * @param { WebGL2RenderingContext } webGL2RenderingContext
	 * @returns { boolean }
	 */
	static isFloatColorSupported(webGL2RenderingContext) {
		const floatExtension = webGL2RenderingContext.getExtension("EXT_color_buffer_float");
		const halfFloatExtension = webGL2RenderingContext.getExtension("EXT_color_buffer_half_float");
		if (floatExtension === null && halfFloatExtension === null) {
			return false;
		}
		const previousFramebuffer = webGL2RenderingContext.getParameter(webGL2RenderingContext.FRAMEBUFFER_BINDING);
		const previousTexture = webGL2RenderingContext.getParameter(webGL2RenderingContext.TEXTURE_BINDING_2D);
		const testTexture = webGL2RenderingContext.createTexture();
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, testTexture);
		webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.RGBA16F, 1, 1, 0, webGL2RenderingContext.RGBA, webGL2RenderingContext.HALF_FLOAT, null);
		const testFramebuffer = webGL2RenderingContext.createFramebuffer();
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, testFramebuffer);
		webGL2RenderingContext.framebufferTexture2D(webGL2RenderingContext.FRAMEBUFFER, webGL2RenderingContext.COLOR_ATTACHMENT0, webGL2RenderingContext.TEXTURE_2D, testTexture, 0);
		const isComplete = webGL2RenderingContext.checkFramebufferStatus(webGL2RenderingContext.FRAMEBUFFER) === webGL2RenderingContext.FRAMEBUFFER_COMPLETE;
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, previousFramebuffer);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, previousTexture);
		webGL2RenderingContext.deleteFramebuffer(testFramebuffer);
		webGL2RenderingContext.deleteTexture(testTexture);
		return isComplete;
	}

	//==============================================================================
	// 씬 렌더 타겟 짓기. (출력 크기 x 해상도 배율, 지금 옵션으로)
	//==============================================================================
	/**
	 * @returns { RenderTarget }
	 */
	createSceneRenderTarget() {
		const sceneWidth = this.readSceneWidth();
		const sceneHeight = this.readSceneHeight();
		const options = { colorAttachmentCount: 1, useFloatColor: this.#useFloatColor, useDepthTexture: this.#useDepthTexture, sampleCount: this.#requestedSampleCount, depthBits: this.#depthBits };
		return new RenderTarget(this.#webGL2RenderingContext, sceneWidth, sceneHeight, true, options);
	}

	//==============================================================================
	// 씬 판의 너비. (출력 너비 x 해상도 배율, 1 이상)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	readSceneWidth() {
		return System.Math.max(1, System.Math.round(this.#outputWidth * this.#resolutionScale));
	}

	//==============================================================================
	// 씬 판의 높이. (출력 높이 x 해상도 배율, 1 이상)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	readSceneHeight() {
		return System.Math.max(1, System.Math.round(this.#outputHeight * this.#resolutionScale));
	}

	//==============================================================================
	// 크기 바꾸기. (출력 크기, 씬 판은 해상도 배율을 곱함, 같으면 그대로)
	//==============================================================================
	/**
	 * @param { number } width
	 * @param { number } height
	 */
	resize(width, height) {
		this.#outputWidth = System.Math.max(1, width);
		this.#outputHeight = System.Math.max(1, height);
		const sceneRenderTarget = this.#sceneRenderTarget;
		const sceneWidth = this.readSceneWidth();
		const sceneHeight = this.readSceneHeight();
		if (sceneRenderTarget.getWidth() === sceneWidth && sceneRenderTarget.getHeight() === sceneHeight) {
			return;
		}
		sceneRenderTarget.resize(sceneWidth, sceneHeight);
		this.#bloomEffect.resize(sceneWidth, sceneHeight);
		const multiLevelBloomEffect = this.#multiLevelBloomEffect;
		if (multiLevelBloomEffect !== null) {
			multiLevelBloomEffect.resize(sceneWidth, sceneHeight);
		}
	}

	//==============================================================================
	// 해상도 배율 설정. (씬 판 = 출력 크기 x 배율, 0.05 ~ 4, 기본 1)
	//==============================================================================
	/**
	 * @param { number } resolutionScale
	 */
	setResolutionScale(resolutionScale) {
		this.#resolutionScale = System.Math.max(0.05, System.Math.min(4, resolutionScale));
		this.resize(this.#outputWidth, this.#outputHeight);
	}

	//==============================================================================
	// 해상도 배율 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getResolutionScale() {
		return this.#resolutionScale;
	}

	//==============================================================================
	// 멀티샘플 표본 수 설정. (2 밑이면 없음, 바뀌면 씬 판을 다시 짓는다)
	//==============================================================================
	/**
	 * @param { number } sampleCount
	 */
	setSampleCount(sampleCount) {
		const safeSampleCount = System.Math.max(0, System.Math.floor(sampleCount));
		if (safeSampleCount === this.#requestedSampleCount) {
			return;
		}
		this.#requestedSampleCount = safeSampleCount;
		this.#sceneRenderTarget.destroy();
		this.#sceneRenderTarget = this.createSceneRenderTarget();
	}

	//==============================================================================
	// 실제로 쓰는 멀티샘플 표본 수 반환. (0 이면 없음)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getSampleCount() {
		return this.#sceneRenderTarget.getSampleCount();
	}

	//==============================================================================
	// 씬 판이 실수인지 반환. (false 면 LDR 길)
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	getUseFloatColor() {
		return this.#useFloatColor;
	}

	//==============================================================================
	// 씬 그리기 시작. (씬 렌더 타겟을 묶고 바탕 색과 깊이로 비운다, HDR 길은 선형 색, LDR 길은 화면 색)
	//==============================================================================
	/**
	 * @param { Array<number> } clearColor - [r, g, b]
	 */
	begin(clearColor) {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const sceneRenderTarget = this.#sceneRenderTarget;
		sceneRenderTarget.bind();
		webGL2RenderingContext.viewport(0, 0, sceneRenderTarget.getWidth(), sceneRenderTarget.getHeight());
		webGL2RenderingContext.depthMask(true);
		webGL2RenderingContext.clearColor(clearColor[0], clearColor[1], clearColor[2], 1);
		webGL2RenderingContext.clear(webGL2RenderingContext.COLOR_BUFFER_BIT | webGL2RenderingContext.DEPTH_BUFFER_BIT);
	}

	//==============================================================================
	// 마무리. (멀티샘플이면 풂 → 블룸 → 톤매핑해 낼 프레임버퍼에, viewport 는 [x, y, 너비, 높이])
	//==============================================================================
	/**
	 * @param { WebGLFramebuffer | null } outputFramebuffer
	 * @param { Array<number> } viewport
	 */
	end(outputFramebuffer, viewport) {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const sceneRenderTarget = this.#sceneRenderTarget;
		sceneRenderTarget.resolve();
		const sceneTexture = sceneRenderTarget.getColorTexture(0);
		const isBloomEnabled = this.#isBloomEnabled;
		const multiLevelBloomEffect = this.#multiLevelBloomEffect;
		let bloomTexture = sceneTexture;
		if (isBloomEnabled) {
			if (multiLevelBloomEffect !== null) {
				multiLevelBloomEffect.render(sceneTexture);
				bloomTexture = multiLevelBloomEffect.getResultTexture();
			}
			else {
				this.#bloomEffect.render(sceneTexture);
				bloomTexture = this.#bloomEffect.getResultTexture();
			}
		}
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, outputFramebuffer);
		webGL2RenderingContext.viewport(viewport[0], viewport[1], viewport[2], viewport[3]);
		webGL2RenderingContext.disable(webGL2RenderingContext.DEPTH_TEST);
		webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);
		const compositePass = this.#compositePass;
		compositePass.use();
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, sceneTexture);
		webGL2RenderingContext.uniform1i(compositePass.getUniformLocation("sceneTexture"), 0);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE1);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, bloomTexture);
		webGL2RenderingContext.uniform1i(compositePass.getUniformLocation("bloomTexture"), 1);
		const litArea = this.#litArea;
		const depthTexture = sceneRenderTarget.getDepthTexture();
		const isLitAreaApplied = litArea !== null && depthTexture !== null;
		// 깊이 칸. (밝힌 자리를 쓰지 않으면 읽지 않지만 빈 칸이면 드라이버가 알리므로 씬 텍스처를 묶어 둔다)
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE2);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, isLitAreaApplied ? depthTexture : sceneTexture);
		webGL2RenderingContext.uniform1i(compositePass.getUniformLocation("depthTexture"), 2);
		webGL2RenderingContext.uniform1f(compositePass.getUniformLocation("bloomStrength"), isBloomEnabled ? this.#bloomStrength : 0);
		webGL2RenderingContext.uniform1f(compositePass.getUniformLocation("exposure"), this.#exposure);
		webGL2RenderingContext.uniform1f(compositePass.getUniformLocation("hdrInput"), this.#useFloatColor ? 1 : 0);
		webGL2RenderingContext.uniform1f(compositePass.getUniformLocation("brightness"), this.#brightness);
		if (isLitAreaApplied) {
			const center = litArea.center;
			webGL2RenderingContext.uniform4f(compositePass.getUniformLocation("litCenter"), center[0], center[1], center[2], litArea.outerRadius);
			webGL2RenderingContext.uniform1f(compositePass.getUniformLocation("litInnerRadius"), litArea.innerRadius);
			webGL2RenderingContext.uniformMatrix4fv(compositePass.getUniformLocation("inverseViewProjectionMatrix"), false, litArea.inverseViewProjectionElements);
		}
		else {
			webGL2RenderingContext.uniform4f(compositePass.getUniformLocation("litCenter"), 0, 0, 0, 0);
		}
		const toneColor = this.#toneColor;
		const hazeColor = this.#hazeColor;
		webGL2RenderingContext.uniform1f(compositePass.getUniformLocation("saturation"), this.#saturation);
		webGL2RenderingContext.uniform1f(compositePass.getUniformLocation("contrast"), this.#contrast);
		webGL2RenderingContext.uniform3f(compositePass.getUniformLocation("toneColor"), toneColor[0], toneColor[1], toneColor[2]);
		webGL2RenderingContext.uniform1f(compositePass.getUniformLocation("toneAmount"), this.#toneAmount);
		webGL2RenderingContext.uniform3f(compositePass.getUniformLocation("hazeColor"), hazeColor[0], hazeColor[1], hazeColor[2]);
		webGL2RenderingContext.uniform1f(compositePass.getUniformLocation("hazeAmount"), this.#hazeAmount);
		webGL2RenderingContext.uniform1f(compositePass.getUniformLocation("vignetteStrength"), this.#vignetteStrength);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		compositePass.draw();
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE2);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, null);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
	}

	//==============================================================================
	// 노출 설정. (톤매핑 전에 곱한다, 1 이 기본)
	//==============================================================================
	/**
	 * @param { number } exposure
	 */
	setExposure(exposure) {
		this.#exposure = System.Math.max(0, exposure);
	}

	//==============================================================================
	// 블룸 설정. (켜기, 세기, 밝은 곳을 뽑는 문턱의 시작과 끝, 문턱은 기본 9 탭 블룸에만 쓴다)
	//==============================================================================
	/**
	 * @param { boolean } isBloomEnabled
	 * @param { number } bloomStrength
	 * @param { number } thresholdStart
	 * @param { number } thresholdEnd
	 */
	setBloom(isBloomEnabled, bloomStrength, thresholdStart, thresholdEnd) {
		this.#isBloomEnabled = isBloomEnabled;
		this.#bloomStrength = System.Math.max(0, bloomStrength);
		this.#bloomEffect.setThreshold(thresholdStart, thresholdEnd);
	}

	//==============================================================================
	// 블룸 단 수 설정. (0 이면 기본 9 탭 블룸, 1 이상이면 그 단 수의 다단 블룸, 문턱과 무릎은 다단 블룸의 선형 밝기)
	// - 다단 블룸 판은 씬 판과 같은 정밀도다. (HDR 길은 RGBA16F)
	//==============================================================================
	/**
	 * @param { number } levelCount
	 * @param { number } threshold
	 * @param { number } knee
	 */
	setBloomLevels(levelCount, threshold, knee) {
		this.#bloomThreshold = System.Math.max(0, threshold);
		this.#bloomKnee = System.Math.max(0, knee);
		const safeLevelCount = System.Math.max(0, System.Math.floor(levelCount));
		let multiLevelBloomEffect = this.#multiLevelBloomEffect;
		if (safeLevelCount === 0) {
			if (multiLevelBloomEffect !== null) {
				multiLevelBloomEffect.destroy();
				this.#multiLevelBloomEffect = null;
			}
			return;
		}
		if (multiLevelBloomEffect === null) {
			multiLevelBloomEffect = new MultiLevelBloomEffect(this.#webGL2RenderingContext, safeLevelCount, this.#useFloatColor);
			multiLevelBloomEffect.resize(this.readSceneWidth(), this.readSceneHeight());
			this.#multiLevelBloomEffect = multiLevelBloomEffect;
		}
		multiLevelBloomEffect.setLevelCount(safeLevelCount);
		multiLevelBloomEffect.setThreshold(this.#bloomThreshold, this.#bloomKnee);
	}

	//==============================================================================
	// 블룸 단 수 반환. (0 이면 기본 9 탭 블룸)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getBloomLevelCount() {
		const multiLevelBloomEffect = this.#multiLevelBloomEffect;
		return multiLevelBloomEffect !== null ? multiLevelBloomEffect.getLevelCount() : 0;
	}

	//==============================================================================
	// 기본 9 탭 블룸의 주고받는 판을 실수로. (true 면 RGBA16F, 기본 false 는 RGBA8, 씬 판이 실수가 아니면 무시)
	//==============================================================================
	/**
	 * @param { boolean } isFloatColor
	 */
	setBloomFloatColor(isFloatColor) {
		this.#bloomEffect.setUseFloatColor(isFloatColor && this.#useFloatColor);
	}

	//==============================================================================
	// 밝기 설정. (색 보정 맨 앞에서 곱한다, 1 이 그대로)
	//==============================================================================
	/**
	 * @param { number } brightness
	 */
	setBrightness(brightness) {
		this.#brightness = System.Math.max(0, brightness);
	}

	//==============================================================================
	// 밝힌 자리 설정. (그 자리에서 수평 거리 innerRadius 안은 밝기 1, outerRadius 밖은 setBrightness 의 밝기, 사이는 부드럽게)
	// - 씬 깊이 텍스처(옵션 useDepthTexture)와 그 프레임의 보기와 투영의 역행렬로 화소마다 월드 자리를 되짚는다. 깊이 텍스처가 없으면 무시한다.
	// - 카메라가 움직이면 프레임마다 다시 준다. 아무것도 그리지 않은 바탕은 먼 면의 자리로 셈한다.
	//==============================================================================
	/**
	 * @param { Array<number> } center [x, y, z]
	 * @param { number } innerRadius
	 * @param { number } outerRadius
	 * @param { Matrix4 } inverseViewProjectionMatrix
	 */
	setLitArea(center, innerRadius, outerRadius, inverseViewProjectionMatrix) {
		const safeOuterRadius = System.Math.max(0.0001, outerRadius);
		this.#litArea = {
			center: [center[0], center[1], center[2]],
			innerRadius: System.Math.max(0, System.Math.min(innerRadius, safeOuterRadius)),
			outerRadius: safeOuterRadius,
			inverseViewProjectionElements: System.Float32Array.from(inverseViewProjectionMatrix.getElements()),
		};
	}

	//==============================================================================
	// 밝힌 자리 풀기.
	//==============================================================================
	clearLitArea() {
		this.#litArea = null;
	}

	//==============================================================================
	// 색 보정 설정. (채도와 대비는 1 이 그대로, 색조와 안개빛은 sRGB [r, g, b] 0 ~ 1 과 섞는 양 0 ~ 1)
	// - 색조 색은 밝기(Rec. 709)를 1 로 맞춰 곱하므로 밝기는 그대로 두고 빛깔만 물든다.
	// - 안개빛은 어두운 곳일수록 그 색 쪽으로 끌어올린다. (양 x (1 - 밝기))
	//==============================================================================
	/**
	 * @param { number } saturation
	 * @param { number } contrast
	 * @param { Array<number> } toneColor
	 * @param { number } toneAmount
	 * @param { Array<number> } hazeColor
	 * @param { number } hazeAmount
	 */
	setColorGrade(saturation, contrast, toneColor, toneAmount, hazeColor, hazeAmount) {
		const toneLuminance = toneColor[0] * 0.2126 + toneColor[1] * 0.7152 + toneColor[2] * 0.0722;
		const toneScale = toneLuminance > 0 ? 1 / toneLuminance : 1;
		this.#saturation = System.Math.max(0, saturation);
		this.#contrast = System.Math.max(0, contrast);
		this.#toneColor = [toneColor[0] * toneScale, toneColor[1] * toneScale, toneColor[2] * toneScale];
		this.#toneAmount = System.Math.max(0, System.Math.min(1, toneAmount));
		this.#hazeColor = [hazeColor[0], hazeColor[1], hazeColor[2]];
		this.#hazeAmount = System.Math.max(0, System.Math.min(1, hazeAmount));
	}

	//==============================================================================
	// 가장자리 어둡게 설정. (0 이 없음, 1 이면 구석이 까맣게)
	//==============================================================================
	/**
	 * @param { number } vignetteStrength
	 */
	setVignette(vignetteStrength) {
		this.#vignetteStrength = System.Math.max(0, vignetteStrength);
	}

	//==============================================================================
	// 씬 렌더 타겟 반환. (다른 후처리를 끼울 때)
	//==============================================================================
	/**
	 * @returns { RenderTarget }
	 */
	getSceneRenderTarget() {
		return this.#sceneRenderTarget;
	}

	//==============================================================================
	// 지우기.
	//==============================================================================
	destroy() {
		this.#sceneRenderTarget.destroy();
		this.#bloomEffect.destroy();
		const multiLevelBloomEffect = this.#multiLevelBloomEffect;
		if (multiLevelBloomEffect !== null) {
			multiLevelBloomEffect.destroy();
			this.#multiLevelBloomEffect = null;
		}
		this.#compositePass.destroy();
	}
}
