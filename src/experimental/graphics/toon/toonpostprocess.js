//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { RenderTarget } from "../rendertarget.js";
import { BloomEffect } from "../bloomeffect.js";
import { FullscreenPass } from "../fullscreenpass.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
const COMPOSITE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 fragmentTextureCoordinate;
uniform sampler2D sceneTexture;
uniform sampler2D bloomTexture;
uniform float bloomStrength;
uniform float exposure;
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
	vec3 color = pow(mapTone(scene + bloom * bloomStrength), vec3(1.0 / 2.2));
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
// - RenderTarget(반정밀 실수 색, 깊이), BloomEffect, FullscreenPass 를 엮는다.
// - 사용: ToonRenderer.setHdrOutput(true) 뒤 begin(바탕 선형 색) → ToonRenderer 로 그리기 → end(낼 프레임버퍼, 뷰포트)
//   end 는 블룸을 셈하고 톤매핑한 색을 낼 프레임버퍼(null 이면 화면)에 그린다.
// - 톤매핑은 ACES 근사(Narkowicz)다. 노출(setExposure)을 곱한 뒤 매핑하고 sRGB 감마를 건다.
// - 색 보정: 감마를 건 뒤 채도, 색조(밝기 1 로 맞춘 색을 곱함), 안개빛(어두운 곳을 그 색 쪽으로), 대비, 가장자리 어둡게 차례로 건다. (setColorGrade, setVignette)
//   기본은 채도 1, 대비 1, 색조 0, 안개빛 0, 가장자리 0 이라 보정이 없다.
// - 노드 사각형 안에 낼 때: resize(사각형 너비, 높이) → begin → 그리기(ToonRenderer 의 화면 사각형은 풀어 둔다) → end(null, [x, 드로잉 버퍼 높이 - y - 높이, 너비, 높이]).
//==============================================================================
export class ToonPostProcess {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { RenderTarget } */ #sceneRenderTarget;
	/** @private @type { BloomEffect } */ #bloomEffect;
	/** @private @type { FullscreenPass } */ #compositePass;
	/** @private @type { number } */ #exposure;
	/** @private @type { number } */ #bloomStrength;
	/** @private @type { boolean } */ #isBloomEnabled;
	/** @private @type { number } */ #saturation;
	/** @private @type { number } */ #contrast;
	/** @private @type { Array<number> } */ #toneColor; // 밝기 1 로 맞춘 곱.
	/** @private @type { number } */ #toneAmount;
	/** @private @type { Array<number> } */ #hazeColor;
	/** @private @type { number } */ #hazeAmount;
	/** @private @type { number } */ #vignetteStrength;

	//==============================================================================
	// 생성. (화면 픽셀 크기)
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext
	 * @param { number } width
	 * @param { number } height
	 */
	constructor(webGL2RenderingContext, width, height) {
		this.#webGL2RenderingContext = webGL2RenderingContext;
		webGL2RenderingContext.getExtension("EXT_color_buffer_float");
		webGL2RenderingContext.getExtension("EXT_color_buffer_half_float");
		this.#sceneRenderTarget = new RenderTarget(webGL2RenderingContext, System.Math.max(1, width), System.Math.max(1, height), true, { colorAttachmentCount: 1, useFloatColor: true, useDepthTexture: false });
		this.#bloomEffect = new BloomEffect(webGL2RenderingContext);
		this.#bloomEffect.resize(System.Math.max(1, width), System.Math.max(1, height));
		this.#bloomEffect.setThreshold(0.9, 1.6);
		this.#compositePass = new FullscreenPass(webGL2RenderingContext, COMPOSITE_FRAGMENT_SHADER);
		this.#exposure = 1;
		this.#bloomStrength = 0.6;
		this.#isBloomEnabled = true;
		this.#saturation = 1;
		this.#contrast = 1;
		this.#toneColor = [1, 1, 1];
		this.#toneAmount = 0;
		this.#hazeColor = [0, 0, 0];
		this.#hazeAmount = 0;
		this.#vignetteStrength = 0;
	}

	//==============================================================================
	// 크기 바꾸기. (같으면 그대로)
	//==============================================================================
	/**
	 * @param { number } width
	 * @param { number } height
	 */
	resize(width, height) {
		const sceneRenderTarget = this.#sceneRenderTarget;
		const safeWidth = System.Math.max(1, width);
		const safeHeight = System.Math.max(1, height);
		if (sceneRenderTarget.getWidth() === safeWidth && sceneRenderTarget.getHeight() === safeHeight) {
			return;
		}
		sceneRenderTarget.resize(safeWidth, safeHeight);
		this.#bloomEffect.resize(safeWidth, safeHeight);
	}

	//==============================================================================
	// 씬 그리기 시작. (실수 렌더 타겟을 묶고 바탕 선형 색과 깊이로 비운다)
	//==============================================================================
	/**
	 * @param { Array<number> } clearColor - [r, g, b] 선형 색.
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
	// 마무리. (블룸 → 톤매핑해 낼 프레임버퍼에, viewport 는 [x, y, 너비, 높이])
	//==============================================================================
	/**
	 * @param { WebGLFramebuffer | null } outputFramebuffer
	 * @param { Array<number> } viewport
	 */
	end(outputFramebuffer, viewport) {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const sceneTexture = this.#sceneRenderTarget.getColorTexture(0);
		const isBloomEnabled = this.#isBloomEnabled;
		if (isBloomEnabled) {
			this.#bloomEffect.render(sceneTexture);
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
		const bloomTexture = isBloomEnabled ? this.#bloomEffect.getResultTexture() : sceneTexture;
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, bloomTexture);
		webGL2RenderingContext.uniform1i(compositePass.getUniformLocation("bloomTexture"), 1);
		webGL2RenderingContext.uniform1f(compositePass.getUniformLocation("bloomStrength"), isBloomEnabled ? this.#bloomStrength : 0);
		webGL2RenderingContext.uniform1f(compositePass.getUniformLocation("exposure"), this.#exposure);
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
	// 블룸 설정. (켜기, 세기, 밝은 곳을 뽑는 문턱의 시작과 끝)
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
		this.#compositePass.destroy();
	}
}
