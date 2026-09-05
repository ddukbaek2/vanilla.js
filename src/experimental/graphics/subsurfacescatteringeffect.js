//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";
import { RenderTarget } from "./rendertarget.js";
import { FullscreenPass } from "./fullscreenpass.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 커널 샘플 수. (중앙 1 + 양측 — 홀수)
const KERNEL_SAMPLE_COUNT = 17;

// 커널 오프셋 범위. (확산 프로파일 단위 — 셰이더에서 산란 폭으로 정규화)
const KERNEL_RANGE = 3;

// 분리형 산란 블러 패스. (깊이 인식 — 표면이 갈라지는 곳은 중앙 색으로 되돌린다)
const SCATTER_FRAGMENTSHADER_SOURCE = `#version 300 es
precision highp float;
in vec2 fragmentTextureCoordinate;
uniform sampler2D sourceTexture;
uniform sampler2D depthTexture;
uniform vec2 blurDirection;
uniform vec4 kernel[${KERNEL_SAMPLE_COUNT}];
uniform float scatterWidth;
uniform float distanceToProjectionWindow;
uniform float aspectRatio;
uniform vec2 depthRange;
out vec4 outputColor;

float linearizeDepth(float depthSample) {
	float nearDistance = depthRange.x;
	float farDistance = depthRange.y;
	float normalizedDepth = depthSample * 2.0 - 1.0;
	return 2.0 * nearDistance * farDistance / (farDistance + nearDistance - normalizedDepth * (farDistance - nearDistance));
}

void main() {
	vec4 centerSample = texture(sourceTexture, fragmentTextureCoordinate);
	float centerMask = centerSample.a;
	if (centerMask < 0.001) {
		outputColor = centerSample;
		return;
	}
	float centerDepth = linearizeDepth(texture(depthTexture, fragmentTextureCoordinate).r);

	// 화면 공간 스텝. (산란 폭을 투영 창 거리 / 깊이로 화면 크기에 맞춤, 가로는 화면비 보정)
	float projectedScale = distanceToProjectionWindow / centerDepth;
	vec2 finalStep = scatterWidth * projectedScale * blurDirection * centerMask / float(${KERNEL_RANGE});
	finalStep.x /= aspectRatio;

	vec3 color = centerSample.rgb * kernel[0].rgb;
	for (int sampleIndex = 1; sampleIndex < ${KERNEL_SAMPLE_COUNT}; ++sampleIndex) {
		vec2 sampleCoordinate = fragmentTextureCoordinate + kernel[sampleIndex].w * finalStep;
		vec4 sampleColor = texture(sourceTexture, sampleCoordinate);
		float sampleDepth = linearizeDepth(texture(depthTexture, sampleCoordinate).r);
		float depthDelta = abs(centerDepth - sampleDepth);
		float surfaceBreak = smoothstep(0.0, scatterWidth * 2.0, depthDelta);
		surfaceBreak = max(surfaceBreak, 1.0 - sampleColor.a);
		vec3 blendedColor = mix(sampleColor.rgb, centerSample.rgb, surfaceBreak);
		color += blendedColor * kernel[sampleIndex].rgb;
	}
	outputColor = vec4(color, centerMask);
}
`;


//==============================================================================
// 화면 공간 서브서피스 스캐터링. (분리형 — 확산 조도 버퍼를 깊이 인식 가로/세로 블러)
// - 피부 확산 프로파일(가우시안 합)로 채널별 커널을 만들고, 산란 폭(월드 단위)을 깊이에 맞춰 화면에 투영한다.
// - render() 입력은 알파에 산란 마스크를 담은 조도 텍스처와 같은 패스의 깊이 텍스처. 결과는 getResultTexture().
//==============================================================================
export class SubsurfaceScatteringEffect extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { FullscreenPass } */ #scatterPass;
	/** @private @type { RenderTarget } */ #pingRenderTarget;
	/** @private @type { RenderTarget } */ #pongRenderTarget;
	/** @private @type { Float32Array } */ #kernel;
	/** @private @type { number } */ #scatterWidth;
	/** @private @type { number[] } */ #falloffColor;
	/** @private @type { number[] } */ #strengthColor;

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
		this.#scatterPass = new FullscreenPass(webGL2RenderingContext, SCATTER_FRAGMENTSHADER_SOURCE);
		this.#pingRenderTarget = new RenderTarget(webGL2RenderingContext, 2, 2, false, { useFloatColor: true });
		this.#pongRenderTarget = new RenderTarget(webGL2RenderingContext, 2, 2, false, { useFloatColor: true });
		this.#scatterWidth = 0.2;
		this.#falloffColor = [1.0, 0.37, 0.3];
		this.#strengthColor = [0.48, 0.41, 0.28];
		this.#kernel = new System.Float32Array(KERNEL_SAMPLE_COUNT * 4);
		this.computeKernel();
	}

	//==============================================================================
	// 커널 계산. (피부 확산 프로파일을 오프셋 구간 넓이로 적분 — 중앙 샘플을 0번에)
	//==============================================================================
	computeKernel() {
		const sampleCount = KERNEL_SAMPLE_COUNT;
		const falloffColor = this.getFalloffColor();
		const strengthColor = this.getStrengthColor();

		// 채널별 확산 프로파일. (가우시안 합 — 분산은 폴오프 색으로 채널마다 늘어난다)
		function evaluateGaussian(variance, distance, channelIndex) {
			const scaledDistance = distance / (0.001 + falloffColor[channelIndex]);
			return System.Math.exp(-(scaledDistance * scaledDistance) / (2 * variance)) / (2 * System.Math.PI * variance);
		}
		function evaluateProfile(distance, channelIndex) {
			return 0.100 * evaluateGaussian(0.0484, distance, channelIndex)
				+ 0.118 * evaluateGaussian(0.187, distance, channelIndex)
				+ 0.113 * evaluateGaussian(0.567, distance, channelIndex)
				+ 0.358 * evaluateGaussian(1.99, distance, channelIndex)
				+ 0.078 * evaluateGaussian(7.41, distance, channelIndex);
		}

		// 오프셋. (중앙에 촘촘하게 — 부호 있는 제곱 분포)
		const offsets = [];
		const step = (KERNEL_RANGE * 2) / (sampleCount - 1);
		for (let sampleIndex = 0; sampleIndex < sampleCount; ++sampleIndex) {
			const linearOffset = -KERNEL_RANGE + sampleIndex * step;
			const sign = linearOffset < 0 ? -1 : 1;
			const normalizedOffset = System.Math.abs(linearOffset) / KERNEL_RANGE;
			offsets.push(KERNEL_RANGE * sign * normalizedOffset * normalizedOffset);
		}

		// 가중치. (프로파일 x 구간 넓이)
		const weights = [];
		for (let sampleIndex = 0; sampleIndex < sampleCount; ++sampleIndex) {
			const leftWidth = sampleIndex > 0 ? System.Math.abs(offsets[sampleIndex] - offsets[sampleIndex - 1]) : 0;
			const rightWidth = sampleIndex < sampleCount - 1 ? System.Math.abs(offsets[sampleIndex] - offsets[sampleIndex + 1]) : 0;
			const area = (leftWidth + rightWidth) * 0.5;
			const weight = [];
			for (let channelIndex = 0; channelIndex < 3; ++channelIndex) {
				weight.push(evaluateProfile(offsets[sampleIndex], channelIndex) * area);
			}
			weights.push(weight);
		}

		// 중앙 샘플을 0번으로 이동.
		const centerIndex = (sampleCount - 1) / 2;
		const orderedOffsets = [offsets[centerIndex]];
		const orderedWeights = [weights[centerIndex]];
		for (let sampleIndex = 0; sampleIndex < sampleCount; ++sampleIndex) {
			if (sampleIndex !== centerIndex) {
				orderedOffsets.push(offsets[sampleIndex]);
				orderedWeights.push(weights[sampleIndex]);
			}
		}

		// 채널별 정규화 + 강도 적용. (중앙 = (1 - 강도) + 강도 x 가중, 나머지 = 강도 x 가중)
		for (let channelIndex = 0; channelIndex < 3; ++channelIndex) {
			let weightSum = 0;
			for (let sampleIndex = 0; sampleIndex < sampleCount; ++sampleIndex) {
				weightSum += orderedWeights[sampleIndex][channelIndex];
			}
			for (let sampleIndex = 0; sampleIndex < sampleCount; ++sampleIndex) {
				const normalizedWeight = orderedWeights[sampleIndex][channelIndex] / weightSum;
				const strength = strengthColor[channelIndex];
				const finalWeight = sampleIndex === 0 ? (1 - strength) + strength * normalizedWeight : strength * normalizedWeight;
				this.#kernel[sampleIndex * 4 + channelIndex] = finalWeight;
			}
		}
		for (let sampleIndex = 0; sampleIndex < sampleCount; ++sampleIndex) {
			this.#kernel[sampleIndex * 4 + 3] = orderedOffsets[sampleIndex];
		}
	}

	//==============================================================================
	// 크기 변경. (조도 버퍼 해상도 기준 — 전체 해상도 실수 타겟 2장)
	//==============================================================================
	/**
	 * @param { number } width
	 * @param { number } height
	 */
	resize(width, height) {
		this.#pingRenderTarget.resize(width, height);
		this.#pongRenderTarget.resize(width, height);
	}

	//==============================================================================
	// 산란 렌더링. (가로 → 핑, 세로 → 퐁 — 결과는 getResultTexture())
	// - 부수 효과: 깊이/블렌드 비활성, TEXTURE0 활성, 프레임버퍼 바인드가 변경된다.
	//==============================================================================
	/**
	 * @param { WebGLTexture } irradianceTexture 알파에 산란 마스크를 담은 조도 텍스처.
	 * @param { WebGLTexture } depthTexture 같은 패스의 깊이 텍스처.
	 * @param { number } fieldOfViewRadian 세로 시야각.
	 * @param { number } aspectRatio
	 * @param { number } nearDistance
	 * @param { number } farDistance
	 */
	render(irradianceTexture, depthTexture, fieldOfViewRadian, aspectRatio, nearDistance, farDistance) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.disable(webGL2RenderingContext.DEPTH_TEST);
		webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);

		const scatterPass = this.getScatterPass();
		scatterPass.use();
		const sourceTextureLocation = scatterPass.getUniformLocation("sourceTexture");
		webGL2RenderingContext.uniform1i(sourceTextureLocation, 0);
		const depthTextureLocation = scatterPass.getUniformLocation("depthTexture");
		webGL2RenderingContext.uniform1i(depthTextureLocation, 1);
		const kernelLocation = scatterPass.getUniformLocation("kernel[0]");
		webGL2RenderingContext.uniform4fv(kernelLocation, this.#kernel);
		const scatterWidthLocation = scatterPass.getUniformLocation("scatterWidth");
		webGL2RenderingContext.uniform1f(scatterWidthLocation, this.getScatterWidth());
		const distanceToProjectionWindowLocation = scatterPass.getUniformLocation("distanceToProjectionWindow");
		webGL2RenderingContext.uniform1f(distanceToProjectionWindowLocation, 1 / System.Math.tan(fieldOfViewRadian * 0.5));
		const aspectRatioLocation = scatterPass.getUniformLocation("aspectRatio");
		webGL2RenderingContext.uniform1f(aspectRatioLocation, aspectRatio);
		const depthRangeLocation = scatterPass.getUniformLocation("depthRange");
		webGL2RenderingContext.uniform2f(depthRangeLocation, nearDistance, farDistance);
		const blurDirectionLocation = scatterPass.getUniformLocation("blurDirection");

		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE1);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, depthTexture);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);

		// 1. 가로. (조도 → 핑)
		const pingRenderTarget = this.getPingRenderTarget();
		pingRenderTarget.bind();
		webGL2RenderingContext.uniform2f(blurDirectionLocation, 1, 0);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, irradianceTexture);
		scatterPass.draw();

		// 2. 세로. (핑 → 퐁)
		const pongRenderTarget = this.getPongRenderTarget();
		pongRenderTarget.bind();
		webGL2RenderingContext.uniform2f(blurDirectionLocation, 0, 1);
		const pingColorTexture = pingRenderTarget.getColorTexture();
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, pingColorTexture);
		scatterPass.draw();

		// 깊이 텍스처 해제. (유닛 1 은 섀도우 샘플러 전용 — 비교 모드 없는 텍스처가 남으면 이후 드로우가 무효화된다)
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE1);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, null);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
	}

	//==============================================================================
	// 결과 텍스처 반환. (render() 이후)
	//==============================================================================
	/**
	 * @returns { WebGLTexture | null }
	 */
	getResultTexture() {
		const pongRenderTarget = this.getPongRenderTarget();
		const resultTexture = pongRenderTarget.getColorTexture();
		return resultTexture;
	}

	//==============================================================================
	// 산란 폭 설정. (월드 단위 — 커널 전체 반경)
	//==============================================================================
	/**
	 * @param { number } scatterWidth
	 */
	setScatterWidth(scatterWidth) {
		this.#scatterWidth = scatterWidth;
	}

	//==============================================================================
	// 산란 폭 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getScatterWidth() {
		return this.#scatterWidth;
	}

	//==============================================================================
	// 확산 프로파일 설정. (채널별 폴오프 / 강도 — 피부 기본 (1, 0.37, 0.3) / (0.48, 0.41, 0.28))
	//==============================================================================
	/**
	 * @param { number[] } falloffColor
	 * @param { number[] } strengthColor
	 */
	setProfile(falloffColor, strengthColor) {
		this.#falloffColor = falloffColor.slice(0, 3);
		this.#strengthColor = strengthColor.slice(0, 3);
		this.computeKernel();
	}

	//==============================================================================
	// 폴오프 색 반환.
	//==============================================================================
	/**
	 * @returns { number[] }
	 */
	getFalloffColor() {
		return this.#falloffColor;
	}

	//==============================================================================
	// 강도 색 반환.
	//==============================================================================
	/**
	 * @returns { number[] }
	 */
	getStrengthColor() {
		return this.#strengthColor;
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
	// 산란 패스 반환.
	//==============================================================================
	/**
	 * @returns { FullscreenPass }
	 */
	getScatterPass() {
		return this.#scatterPass;
	}

	//==============================================================================
	// 핑 렌더 타겟 반환. (가로 블러 결과)
	//==============================================================================
	/**
	 * @returns { RenderTarget }
	 */
	getPingRenderTarget() {
		return this.#pingRenderTarget;
	}

	//==============================================================================
	// 퐁 렌더 타겟 반환. (최종 결과 보관)
	//==============================================================================
	/**
	 * @returns { RenderTarget }
	 */
	getPongRenderTarget() {
		return this.#pongRenderTarget;
	}
}
