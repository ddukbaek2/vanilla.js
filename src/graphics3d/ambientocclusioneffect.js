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
// 반구 표본 수. (프래그먼트마다 회전 노이즈로 흩는다)
const SAMPLE_COUNT = 16;

// 차폐 패스. (깊이 + 월드 노멀 → 뷰 공간 반구 표본으로 차폐율, 결과 r 에 가시율)
const OCCLUSION_FRAGMENTSHADER_SOURCE = `#version 300 es
precision highp float;
in vec2 fragmentTextureCoordinate;
uniform sampler2D depthTexture;
uniform sampler2D normalTexture;
uniform mat3 viewRotation;
uniform vec2 depthRange;
uniform vec2 projectionScale;
uniform vec3 sampleKernel[${SAMPLE_COUNT}];
uniform float radius;
uniform float intensity;
uniform float bias;
out vec4 outputColor;

const float PI = 3.14159265;

float linearizeDepth(float depthSample) {
	float nearDistance = depthRange.x;
	float farDistance = depthRange.y;
	float normalizedDepth = depthSample * 2.0 - 1.0;
	return 2.0 * nearDistance * farDistance / (farDistance + nearDistance - normalizedDepth * (farDistance - nearDistance));
}

// 화면 좌표 + 선형 깊이 → 뷰 공간 위치. (카메라가 -z 를 본다)
vec3 reconstructViewPosition(vec2 textureCoordinate, float linearDepth) {
	vec2 normalized = textureCoordinate * 2.0 - 1.0;
	return vec3(normalized * projectionScale * linearDepth, -linearDepth);
}

float interleavedGradientNoise(vec2 screenPosition) {
	return fract(52.9829189 * fract(dot(screenPosition, vec2(0.06711056, 0.00583715))));
}

void main() {
	float depthSample = texture(depthTexture, fragmentTextureCoordinate).r;
	if (depthSample >= 1.0) {
		outputColor = vec4(1.0);
		return;
	}
	float linearDepth = linearizeDepth(depthSample);
	vec3 viewPosition = reconstructViewPosition(fragmentTextureCoordinate, linearDepth);
	vec4 normalSample = texture(normalTexture, fragmentTextureCoordinate);
	if (normalSample.a < 0.5) {
		outputColor = vec4(1.0);
		return;
	}
	vec3 viewNormal = normalize(viewRotation * normalSample.xyz);

	// 노멀 기준 반구 프레임. (회전 노이즈로 표본 방향을 흩는다)
	float angle = interleavedGradientNoise(gl_FragCoord.xy) * 2.0 * PI;
	vec3 randomVector = vec3(cos(angle), sin(angle), 0.0);
	vec3 tangent = normalize(randomVector - viewNormal * dot(randomVector, viewNormal));
	vec3 bitangent = cross(viewNormal, tangent);
	mat3 hemisphereFrame = mat3(tangent, bitangent, viewNormal);

	float occlusion = 0.0;
	for (int sampleIndex = 0; sampleIndex < ${SAMPLE_COUNT}; ++sampleIndex) {
		vec3 samplePosition = viewPosition + hemisphereFrame * sampleKernel[sampleIndex] * radius;
		// 표본을 화면에 투영해 그 자리의 실제 깊이와 비교
		vec2 sampleCoordinate = (samplePosition.xy / projectionScale) / -samplePosition.z * 0.5 + 0.5;
		if (sampleCoordinate.x < 0.0 || sampleCoordinate.x > 1.0 || sampleCoordinate.y < 0.0 || sampleCoordinate.y > 1.0) {
			continue;
		}
		float sceneDepth = linearizeDepth(texture(depthTexture, sampleCoordinate).r);
		float rangeCheck = smoothstep(0.0, 1.0, radius / max(abs(linearDepth - sceneDepth), 0.0001));
		occlusion += (sceneDepth <= -samplePosition.z - bias ? 1.0 : 0.0) * rangeCheck;
	}
	float visibility = 1.0 - occlusion / float(${SAMPLE_COUNT}) * intensity;
	outputColor = vec4(clamp(visibility, 0.0, 1.0), linearDepth, 0.0, 1.0);
}
`;

// 분리형 깊이 인식 블러. (노이즈 제거, 깊이 차가 큰 표본은 제외)
const BLUR_FRAGMENTSHADER_SOURCE = `#version 300 es
precision highp float;
in vec2 fragmentTextureCoordinate;
uniform sampler2D sourceTexture;
uniform vec2 blurDirection;
uniform vec2 texelSize;
out vec4 outputColor;

void main() {
	vec2 center = texture(sourceTexture, fragmentTextureCoordinate).rg;
	float weightSum = 1.0;
	float visibilitySum = center.r;
	for (int offset = 1; offset <= 4; ++offset) {
		for (int sign = -1; sign <= 1; sign += 2) {
			vec2 sampleCoordinate = fragmentTextureCoordinate + blurDirection * texelSize * float(offset * sign);
			vec2 sampleValue = texture(sourceTexture, sampleCoordinate).rg;
			float depthWeight = 1.0 - smoothstep(0.0, center.g * 0.05, abs(sampleValue.g - center.g));
			visibilitySum += sampleValue.r * depthWeight;
			weightSum += depthWeight;
		}
	}
	outputColor = vec4(visibilitySum / weightSum, center.g, 0.0, 1.0);
}
`;


//==============================================================================
// 화면 공간 앰비언트 오클루전. (깊이 + 노멀 버퍼 → 반구 표본 차폐 → 깊이 인식 블러)
// - render() 입력은 본 패스의 깊이 텍스처와 월드 노멀 텍스처(알파 = 커버리지), 카메라의 뷰 회전 / 투영 파라미터.
//   결과는 getResultTexture() 의 r 채널 가시율(1 = 차폐 없음).
//==============================================================================
/**
 * @example <caption>깊이와 노멀 텍스처로 차폐 구하기</caption>
 * import { AmbientOcclusionEffect, RenderTarget, Camera3D, Vector3 } from "./build/vanilla.js";
 *
 * const width = 640;
 * const height = 360;
 * const canvas = document.createElement("canvas");
 * const webGL2RenderingContext = canvas.getContext("webgl2");
 * const geometryRenderTarget = new RenderTarget(webGL2RenderingContext, width, height, true, { useDepthTexture: true });
 * geometryRenderTarget.bind();
 * webGL2RenderingContext.clearColor(0.0, 1.0, 0.0, 1.0);
 * webGL2RenderingContext.clear(webGL2RenderingContext.COLOR_BUFFER_BIT | webGL2RenderingContext.DEPTH_BUFFER_BIT);
 *
 * const camera = new Camera3D();
 * camera.setPerspective(0.8, 0.1, 100);
 * camera.setAspectRatio(width / height);
 * const eyePosition = Vector3.create(0, 2, 6);
 * const targetPosition = Vector3.create(0, 0, 0);
 * camera.lookAt(eyePosition, targetPosition);
 * const viewMatrix = camera.getViewMatrix();
 * const viewMatrixElements = viewMatrix.getElements();
 * const fieldOfView = camera.getFieldOfView();
 * const aspectRatio = camera.getAspectRatio();
 * const nearDistance = camera.getNearDistance();
 * const farDistance = camera.getFarDistance();
 *
 * const ambientOcclusionEffect = new AmbientOcclusionEffect(webGL2RenderingContext);
 * ambientOcclusionEffect.setScale(0.5);
 * ambientOcclusionEffect.resize(width, height);
 * ambientOcclusionEffect.setParameters(0.5, 1.2, 0.01);
 * const depthTexture = geometryRenderTarget.getDepthTexture();
 * const normalTexture = geometryRenderTarget.getColorTexture();
 * ambientOcclusionEffect.render(depthTexture, normalTexture, viewMatrixElements, fieldOfView, aspectRatio, nearDistance, farDistance);
 * const visibilityTexture = ambientOcclusionEffect.getResultTexture();
 * console.log(visibilityTexture !== null);
 * ambientOcclusionEffect.destroy();
 * geometryRenderTarget.destroy();
 */
export class AmbientOcclusionEffect extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { FullscreenPass } */ #occlusionPass;
	/** @private @type { FullscreenPass } */ #blurPass;
	/** @private @type { RenderTarget } */ #occlusionRenderTarget;
	/** @private @type { RenderTarget } */ #pingRenderTarget;
	/** @private @type { RenderTarget } */ #pongRenderTarget;
	/** @private @type { Float32Array } */ #sampleKernel;
	/** @private @type { number } */ #radius;
	/** @private @type { number } */ #intensity;
	/** @private @type { number } */ #bias;
	/** @private @type { number } */ #scale;

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
		this.#occlusionPass = new FullscreenPass(webGL2RenderingContext, OCCLUSION_FRAGMENTSHADER_SOURCE);
		this.#blurPass = new FullscreenPass(webGL2RenderingContext, BLUR_FRAGMENTSHADER_SOURCE);
		this.#occlusionRenderTarget = new RenderTarget(webGL2RenderingContext, 2, 2, false, { useFloatColor: true });
		this.#pingRenderTarget = new RenderTarget(webGL2RenderingContext, 2, 2, false, { useFloatColor: true });
		this.#pongRenderTarget = new RenderTarget(webGL2RenderingContext, 2, 2, false, { useFloatColor: true });
		this.#radius = 0.03;
		this.#intensity = 1.0;
		this.#bias = 0.002;
		this.#scale = 0.5;
		this.#sampleKernel = new System.Float32Array(SAMPLE_COUNT * 3);
		this.computeKernel();
	}

	//==============================================================================
	// 표본 커널 계산. (반구 안에 고르게, 중심 쪽에 더 촘촘히)
	//==============================================================================
	computeKernel() {
		this.#sampleKernel = AmbientOcclusionEffect.buildSampleKernel();
	}

	//==============================================================================
	// 표본 커널 만들기. (WebGL 무관, 황금각 나선, 높이 고르게, 크기 0.15 ~ 1 제곱 분포)
	//==============================================================================
	/**
	 * @returns { Float32Array } 표본마다 x, y, z.
	 */
	static buildSampleKernel() {
		const sampleKernel = new System.Float32Array(SAMPLE_COUNT * 3);
		for (let sampleIndex = 0; sampleIndex < SAMPLE_COUNT; ++sampleIndex) {
			const goldenAngle = 2.39996323;
			const angle = sampleIndex * goldenAngle;
			const height = (sampleIndex + 0.5) / SAMPLE_COUNT;
			const ring = System.Math.sqrt(1 - height * height);
			let scale = (sampleIndex + 1) / SAMPLE_COUNT;
			scale = 0.15 + 0.85 * scale * scale;
			sampleKernel[sampleIndex * 3] = System.Math.cos(angle) * ring * scale;
			sampleKernel[sampleIndex * 3 + 1] = System.Math.sin(angle) * ring * scale;
			sampleKernel[sampleIndex * 3 + 2] = height * scale;
		}
		return sampleKernel;
	}

	//==============================================================================
	// 크기 변경. (본 패스 해상도, 내부는 축소 배율 적용)
	//==============================================================================
	/**
	 * @param { number } width 본 패스 가로 크기. (픽셀, 내부 판은 배율을 곱해 내리고 최소 1)
	 * @param { number } height 본 패스 세로 크기. (픽셀, 내부 판은 배율을 곱해 내리고 최소 1)
	 */
	resize(width, height) {
		const scale = this.getScale();
		const scaledWidth = System.Math.max(1, System.Math.floor(width * scale));
		const scaledHeight = System.Math.max(1, System.Math.floor(height * scale));
		this.#occlusionRenderTarget.resize(scaledWidth, scaledHeight);
		this.#pingRenderTarget.resize(scaledWidth, scaledHeight);
		this.#pongRenderTarget.resize(scaledWidth, scaledHeight);
	}

	//==============================================================================
	// 차폐 렌더링. (차폐 → 가로 블러 → 세로 블러, 결과는 getResultTexture())
	// - 부수 효과: 깊이/블렌드 비활성, TEXTURE0 활성, 프레임버퍼 바인드가 변경된다.
	//==============================================================================
	/**
	 * @param { WebGLTexture } depthTexture 본 패스 깊이 텍스처.
	 * @param { WebGLTexture } normalTexture 월드 노멀 텍스처. (알파 = 커버리지)
	 * @param { Float32Array } viewMatrixElements 뷰 행렬 원소. (열 우선 4x4)
	 * @param { number } fieldOfViewRadian 세로 시야각.
	 * @param { number } aspectRatio 가로 세로 비. (너비 / 높이)
	 * @param { number } nearDistance 카메라의 가까운 거리. (깊이를 선형으로 풀 때 쓴다)
	 * @param { number } farDistance 카메라의 먼 거리. (깊이를 선형으로 풀 때 쓴다)
	 */
	render(depthTexture, normalTexture, viewMatrixElements, fieldOfViewRadian, aspectRatio, nearDistance, farDistance) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.disable(webGL2RenderingContext.DEPTH_TEST);
		webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);

		// 1. 차폐.
		const occlusionPass = this.getOcclusionPass();
		occlusionPass.use();
		const depthTextureLocation = occlusionPass.getUniformLocation("depthTexture");
		webGL2RenderingContext.uniform1i(depthTextureLocation, 0);
		const normalTextureLocation = occlusionPass.getUniformLocation("normalTexture");
		webGL2RenderingContext.uniform1i(normalTextureLocation, 2);
		const viewRotation = new System.Float32Array([
			viewMatrixElements[0], viewMatrixElements[1], viewMatrixElements[2],
			viewMatrixElements[4], viewMatrixElements[5], viewMatrixElements[6],
			viewMatrixElements[8], viewMatrixElements[9], viewMatrixElements[10],
		]);
		const viewRotationLocation = occlusionPass.getUniformLocation("viewRotation");
		webGL2RenderingContext.uniformMatrix3fv(viewRotationLocation, false, viewRotation);
		const depthRangeLocation = occlusionPass.getUniformLocation("depthRange");
		webGL2RenderingContext.uniform2f(depthRangeLocation, nearDistance, farDistance);
		const tangentHalfFieldOfView = System.Math.tan(fieldOfViewRadian * 0.5);
		const projectionScaleLocation = occlusionPass.getUniformLocation("projectionScale");
		webGL2RenderingContext.uniform2f(projectionScaleLocation, tangentHalfFieldOfView * aspectRatio, tangentHalfFieldOfView);
		const sampleKernelLocation = occlusionPass.getUniformLocation("sampleKernel[0]");
		webGL2RenderingContext.uniform3fv(sampleKernelLocation, this.#sampleKernel);
		const radiusLocation = occlusionPass.getUniformLocation("radius");
		webGL2RenderingContext.uniform1f(radiusLocation, this.getRadius());
		const intensityLocation = occlusionPass.getUniformLocation("intensity");
		webGL2RenderingContext.uniform1f(intensityLocation, this.getIntensity());
		const biasLocation = occlusionPass.getUniformLocation("bias");
		webGL2RenderingContext.uniform1f(biasLocation, this.getBias());
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE2);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, normalTexture);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, depthTexture);
		const occlusionRenderTarget = this.getOcclusionRenderTarget();
		occlusionRenderTarget.bind();
		occlusionPass.draw();

		// 2. 블러. (가로 → 핑, 세로 → 퐁)
		const blurPass = this.getBlurPass();
		blurPass.use();
		const sourceTextureLocation = blurPass.getUniformLocation("sourceTexture");
		webGL2RenderingContext.uniform1i(sourceTextureLocation, 0);
		const texelSizeLocation = blurPass.getUniformLocation("texelSize");
		const occlusionWidth = occlusionRenderTarget.getWidth();
		const occlusionHeight = occlusionRenderTarget.getHeight();
		webGL2RenderingContext.uniform2f(texelSizeLocation, 1 / occlusionWidth, 1 / occlusionHeight);
		const blurDirectionLocation = blurPass.getUniformLocation("blurDirection");
		const pingRenderTarget = this.getPingRenderTarget();
		pingRenderTarget.bind();
		webGL2RenderingContext.uniform2f(blurDirectionLocation, 1, 0);
		const occlusionTexture = occlusionRenderTarget.getColorTexture();
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, occlusionTexture);
		blurPass.draw();
		const pongRenderTarget = this.getPongRenderTarget();
		pongRenderTarget.bind();
		webGL2RenderingContext.uniform2f(blurDirectionLocation, 0, 1);
		const pingTexture = pingRenderTarget.getColorTexture();
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, pingTexture);
		blurPass.draw();

		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE2);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, null);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
	}

	//==============================================================================
	// 결과 텍스처 반환. (render() 이후, r 가시율)
	//==============================================================================
	/**
	 * @returns { WebGLTexture | null } 가시율 텍스처. (r 이 가시율 0 ~ 1 이고 1 이면 차폐 없음, g 는 선형 깊이)
	 */
	getResultTexture() {
		const pongRenderTarget = this.getPongRenderTarget();
		const resultTexture = pongRenderTarget.getColorTexture();
		return resultTexture;
	}

	//==============================================================================
	// 파라미터 설정. (표본 반경(월드) / 강도 / 깊이 바이어스)
	//==============================================================================
	/**
	 * @param { number } radius 표본 반경. (뷰 공간 월드 단위, 기본 0.03)
	 * @param { number } intensity 차폐 세기 배율. (기본 1)
	 * @param { number } bias 깊이 비교 바이어스. (월드 단위, 제 면 차폐를 막는다, 기본 0.002)
	 */
	setParameters(radius, intensity, bias) {
		this.#radius = radius;
		this.#intensity = intensity;
		this.#bias = bias;
	}

	//==============================================================================
	// 내부 해상도 배율 설정. (resize 전에 호출)
	//==============================================================================
	/**
	 * @param { number } scale 내부 해상도 배율. (본 패스 크기에 곱한다, 기본 0.5, 다음 resize 부터 쓴다)
	 */
	setScale(scale) {
		this.#scale = scale;
	}

	//==============================================================================
	// 파괴. (GL 리소스 해제)
	//==============================================================================
	/**
	 * @override
	 */
	destroy() {
		this.#occlusionRenderTarget.destroy();
		this.#pingRenderTarget.destroy();
		this.#pongRenderTarget.destroy();
		this.#occlusionPass.destroy();
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
	// 차폐 패스 반환.
	//==============================================================================
	/**
	 * @returns { FullscreenPass } 차폐 패스.
	 */
	getOcclusionPass() {
		return this.#occlusionPass;
	}

	//==============================================================================
	// 블러 패스 반환.
	//==============================================================================
	/**
	 * @returns { FullscreenPass } 깊이 인식 블러 패스.
	 */
	getBlurPass() {
		return this.#blurPass;
	}

	//==============================================================================
	// 차폐 렌더 타겟 반환.
	//==============================================================================
	/**
	 * @returns { RenderTarget } 차폐 결과 렌더 타겟. (RGBA16F)
	 */
	getOcclusionRenderTarget() {
		return this.#occlusionRenderTarget;
	}

	//==============================================================================
	// 핑 렌더 타겟 반환. (가로 블러 결과)
	//==============================================================================
	/**
	 * @returns { RenderTarget } 가로 블러 결과 렌더 타겟.
	 */
	getPingRenderTarget() {
		return this.#pingRenderTarget;
	}

	//==============================================================================
	// 퐁 렌더 타겟 반환. (최종 결과 보관)
	//==============================================================================
	/**
	 * @returns { RenderTarget } 세로 블러 결과 렌더 타겟. (최종 결과)
	 */
	getPongRenderTarget() {
		return this.#pongRenderTarget;
	}

	//==============================================================================
	// 표본 반경 반환.
	//==============================================================================
	/**
	 * @returns { number } 표본 반경. (뷰 공간 월드 단위)
	 */
	getRadius() {
		return this.#radius;
	}

	//==============================================================================
	// 강도 반환.
	//==============================================================================
	/**
	 * @returns { number } 차폐 세기 배율.
	 */
	getIntensity() {
		return this.#intensity;
	}

	//==============================================================================
	// 깊이 바이어스 반환.
	//==============================================================================
	/**
	 * @returns { number } 깊이 비교 바이어스. (월드 단위)
	 */
	getBias() {
		return this.#bias;
	}

	//==============================================================================
	// 내부 해상도 배율 반환.
	//==============================================================================
	/**
	 * @returns { number } 내부 해상도 배율.
	 */
	getScale() {
		return this.#scale;
	}
}
