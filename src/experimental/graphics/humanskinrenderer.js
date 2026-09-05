//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { SkinnedModelRenderer } from "./skinnedmodelrenderer.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 인체 피부 프래그먼트 셰이더. (선형 HDR — 화면 공간 SSS 를 위해 조도 / 알베도 / 스펙큘러를 분리 출력)
// - 조명: 방향광 3개(0번은 섀도우 맵 수신) + 3색 반구 앰비언트 + 조명 방향의 소프트박스 반사 환경.
// - 노멀: 탄젠트 노멀 맵 + 고해상도 높이 맵 미분 디테일(모공/잔주름) + 캐비티 차폐.
// - 스펙큘러: 피부 F0(0.028) 이중 로브 GGX + 잔털(스침각 시인) + 환경 BRDF 근사.
// - 출력 0: 확산 조도(rgb) + SSS 마스크(a) / 1: 선형 알베도(rgb) + 커버리지(a) / 2: 스펙큘러(rgb).
const SKIN_FRAGMENTSHADER_SOURCE = `#version 300 es
precision highp float;
in vec3 worldPosition;
in vec3 worldNormal;
in vec2 fragmentTextureCoordinate;
in vec4 lightSpacePosition;
uniform sampler2D baseColorTexture;
uniform sampler2D normalTexture;
uniform sampler2D specularTexture;
uniform sampler2D occlusionTexture;
uniform sampler2D detailHeightTexture;
uniform vec3 baseColorFactor;
uniform highp sampler2DShadow shadowMapTexture;
uniform float shadowStrength;
uniform float shadowTexelSize;
uniform vec3 cameraPosition;
uniform vec3 lightDirections[3];
uniform vec3 lightColors[3];
uniform vec3 ambientSkyColor;
uniform vec3 ambientHorizonColor;
uniform vec3 ambientGroundColor;
uniform float normalStrength;
uniform float detailStrength;
uniform float detailTexelSize;
uniform float cavityStrength;
uniform vec2 roughnessRange;
uniform float specularStrength;
uniform float sheenStrength;
uniform float subsurfaceAmount;
layout(location = 0) out vec4 irradianceOutput;
layout(location = 1) out vec4 albedoOutput;
layout(location = 2) out vec4 specularOutput;

const float PI = 3.14159265;

float sampleShadowFactor() {
	vec3 projected = lightSpacePosition.xyz / lightSpacePosition.w;
	projected = projected * 0.5 + 0.5;
	if (projected.x < 0.0 || projected.x > 1.0 || projected.y < 0.0 || projected.y > 1.0 || projected.z > 1.0) {
		return 1.0;
	}
	float shadowSum = 0.0;
	for (int offsetY = -2; offsetY <= 2; ++offsetY) {
		for (int offsetX = -2; offsetX <= 2; ++offsetX) {
			vec2 tapOffset = vec2(float(offsetX), float(offsetY)) * shadowTexelSize * 1.2;
			shadowSum += texture(shadowMapTexture, vec3(projected.xy + tapOffset, projected.z - 0.0022));
		}
	}
	return shadowSum / 25.0;
}

// 화면 공간 미분 코탄젠트 프레임. (탄젠트 어트리뷰트 불필요)
mat3 computeTangentFrame(vec3 geometryNormal) {
	vec3 positionDx = dFdx(worldPosition);
	vec3 positionDy = dFdy(worldPosition);
	vec2 textureDx = dFdx(fragmentTextureCoordinate);
	vec2 textureDy = dFdy(fragmentTextureCoordinate);
	vec3 perpendicularX = cross(positionDy, geometryNormal);
	vec3 perpendicularY = cross(geometryNormal, positionDx);
	vec3 tangent = perpendicularX * textureDx.x + perpendicularY * textureDy.x;
	vec3 bitangent = perpendicularX * textureDx.y + perpendicularY * textureDy.y;
	float maxLengthSquared = max(dot(tangent, tangent), dot(bitangent, bitangent));
	if (maxLengthSquared < 1e-16) {
		return mat3(vec3(1.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0), geometryNormal);
	}
	float inverseLength = inversesqrt(maxLengthSquared);
	return mat3(tangent * inverseLength, bitangent * inverseLength, geometryNormal);
}

// GGX 스펙큘러 로브. (분포 x 가시성 — 프레넬 제외)
float specularLobe(float normalDotHalf, float normalDotLight, float normalDotView, float roughness) {
	float alpha = roughness * roughness;
	float alphaSquared = alpha * alpha;
	float distributionDenominator = normalDotHalf * normalDotHalf * (alphaSquared - 1.0) + 1.0;
	float distribution = alphaSquared / (PI * distributionDenominator * distributionDenominator);
	float geometryK = alpha * 0.5;
	float visibilityLight = normalDotLight / (normalDotLight * (1.0 - geometryK) + geometryK);
	float visibilityView = normalDotView / (normalDotView * (1.0 - geometryK) + geometryK);
	return distribution * visibilityLight * visibilityView / max(4.0 * normalDotLight * normalDotView, 0.0001);
}

// 스튜디오 반사 환경. (3색 반구 + 조명 방향의 소프트박스 — 러프니스만큼 넓어진다)
vec3 studioEnvironment(vec3 direction, float roughness) {
	float upness = direction.y;
	vec3 environment = upness > 0.0 ? mix(ambientHorizonColor, ambientSkyColor, upness) : mix(ambientHorizonColor, ambientGroundColor, -upness);
	for (int lightIndex = 0; lightIndex < 3; ++lightIndex) {
		float cosine = dot(direction, normalize(lightDirections[lightIndex]));
		float innerCosine = mix(0.985, 0.55, roughness);
		float outerCosine = mix(0.92, 0.1, roughness);
		environment += lightColors[lightIndex] * smoothstep(outerCosine, innerCosine, cosine) * 0.09;
	}
	return environment;
}

void main() {
	vec2 textureCoordinate = fragmentTextureCoordinate;
	vec3 albedo = texture(baseColorTexture, textureCoordinate).rgb * baseColorFactor;
	float specularMap = texture(specularTexture, textureCoordinate).r;
	float occlusion = texture(occlusionTexture, textureCoordinate).r;

	vec3 geometryNormal = normalize(worldNormal);
	vec3 viewDirection = normalize(cameraPosition - worldPosition);
	if (dot(geometryNormal, viewDirection) < 0.0) {
		geometryNormal = -geometryNormal;
	}
	mat3 tangentFrame = computeTangentFrame(geometryNormal);

	// 노멀 맵 + 높이 맵 미분 디테일. (UDN 합성)
	vec3 tangentNormal = texture(normalTexture, textureCoordinate).xyz * 2.0 - 1.0;
	tangentNormal.xy *= normalStrength;
	float heightLeft = texture(detailHeightTexture, textureCoordinate - vec2(detailTexelSize, 0.0)).r;
	float heightRight = texture(detailHeightTexture, textureCoordinate + vec2(detailTexelSize, 0.0)).r;
	float heightDown = texture(detailHeightTexture, textureCoordinate - vec2(0.0, detailTexelSize)).r;
	float heightUp = texture(detailHeightTexture, textureCoordinate + vec2(0.0, detailTexelSize)).r;
	vec2 heightGradient = vec2(heightRight - heightLeft, heightUp - heightDown);
	vec3 detailNormal = normalize(vec3(-heightGradient * detailStrength, 1.0));
	vec3 combinedTangentNormal = normalize(vec3(tangentNormal.xy + detailNormal.xy, tangentNormal.z * detailNormal.z));
	vec3 surfaceNormal = normalize(tangentFrame * combinedTangentNormal);
	vec3 diffuseNormal = normalize(mix(geometryNormal, surfaceNormal, 0.7));

	// 캐비티. (높이 - 저역 높이 — 모공/주름 골 차폐)
	float heightCenter = texture(detailHeightTexture, textureCoordinate).r;
	float heightAverage = textureLod(detailHeightTexture, textureCoordinate, 4.0).r;
	float cavity = clamp(1.0 + (heightCenter - heightAverage) * cavityStrength, 0.2, 1.0);

	// 러프니스 / 피부 F0. (스펙큘러 맵이 밝을수록 매끈하고 반사가 강한 부위 — 입술 / 콧등)
	float roughness = clamp(mix(roughnessRange.y, roughnessRange.x, specularMap), 0.03, 1.0);
	float fresnelBase = 0.028 * specularStrength * mix(0.6, 1.4, specularMap);
	float normalDotView = max(dot(surfaceNormal, viewDirection), 0.0001);
	float geometryDotView = max(dot(geometryNormal, viewDirection), 0.0);

	float shadowFactor = 1.0;
	if (shadowStrength > 0.001) {
		shadowFactor = mix(1.0, sampleShadowFactor(), shadowStrength);
	}

	// 직접광. (확산 조도는 부드러운 노멀, 스펙큘러는 디테일 노멀)
	vec3 irradiance = vec3(0.0);
	vec3 specular = vec3(0.0);
	for (int lightIndex = 0; lightIndex < 3; ++lightIndex) {
		vec3 lightDirection = normalize(lightDirections[lightIndex]);
		vec3 lightColor = lightColors[lightIndex];
		float lightShadow = lightIndex == 0 ? shadowFactor : 1.0;
		float diffuseDotLight = max(dot(diffuseNormal, lightDirection), 0.0);
		irradiance += lightColor * diffuseDotLight * lightShadow;

		float normalDotLight = max(dot(surfaceNormal, lightDirection), 0.0);
		if (normalDotLight > 0.0) {
			vec3 halfVector = normalize(viewDirection + lightDirection);
			float normalDotHalf = max(dot(surfaceNormal, halfVector), 0.0);
			float viewDotHalf = max(dot(viewDirection, halfVector), 0.0);
			float fresnel = fresnelBase + (1.0 - fresnelBase) * pow(1.0 - viewDotHalf, 5.0);
			float lobeWide = specularLobe(normalDotHalf, normalDotLight, normalDotView, roughness);
			float lobeTight = specularLobe(normalDotHalf, normalDotLight, normalDotView, clamp(roughness * 0.5, 0.03, 1.0));
			specular += lightColor * fresnel * (0.75 * lobeWide + 0.25 * lobeTight) * PI * normalDotLight * lightShadow;
		}

		// 잔털. (스침각에서 빛을 감싸는 옅은 산란 — 림 라이트에 특히 반응)
		float wrapDotLight = max(dot(geometryNormal, lightDirection) * 0.5 + 0.5, 0.0);
		specular += lightColor * pow(1.0 - geometryDotView, 4.0) * wrapDotLight * sheenStrength * lightShadow;
	}

	// 앰비언트 확산 + 환경 반사. (Karis 환경 BRDF 근사)
	float upness = diffuseNormal.y;
	vec3 ambient = upness > 0.0 ? mix(ambientHorizonColor, ambientSkyColor, upness) : mix(ambientHorizonColor, ambientGroundColor, -upness);
	irradiance += ambient * occlusion * mix(1.0, cavity, 0.5);
	vec3 reflection = reflect(-viewDirection, surfaceNormal);
	vec3 environment = studioEnvironment(reflection, roughness);
	vec4 coefficient0 = vec4(-1.0, -0.0275, -0.572, 0.022);
	vec4 coefficient1 = vec4(1.0, 0.0425, 1.04, -0.04);
	vec4 roughnessTerm = roughness * coefficient0 + coefficient1;
	float a004 = min(roughnessTerm.x * roughnessTerm.x, exp2(-9.28 * normalDotView)) * roughnessTerm.x + roughnessTerm.y;
	vec2 environmentScaleBias = vec2(-1.04, 1.04) * a004 + roughnessTerm.zw;
	specular += environment * (fresnelBase * environmentScaleBias.x + environmentScaleBias.y) * occlusion;
	specular *= cavity;

	irradianceOutput = vec4(irradiance, subsurfaceAmount);
	albedoOutput = vec4(albedo, 1.0);
	specularOutput = vec4(specular, 1.0);
}
`;

// 추가 텍스처 유닛. (머티리얼 기본 슬롯 밖 — 높이 디테일 맵)
export const SKIN_TEXTURE_UNIT_DETAILHEIGHT = 9;


//==============================================================================
// 인체 피부 렌더러. (SkinnedModelRenderer 의 스키닝/모프 버텍스 경로 위에 피부 셰이딩 템플릿을 세운다)
// - 선형 HDR 로 조도 / 알베도 / 스펙큘러를 MRT 로 나눠 출력하고, 합성은 SubsurfaceScatteringEffect 이후 호출자가 한다.
// - 환경 상태: 조명 3개(0번 = 키 라이트, 섀도우 수신) / 3색 반구 앰비언트 / 노멀·디테일·러프니스·스펙큘러 파라미터.
//==============================================================================
export class HumanSkinRenderer extends SkinnedModelRenderer {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Float32Array } */ #lightDirections;
	/** @private @type { Float32Array } */ #lightColors;
	/** @private @type { number[] } */ #ambientSkyColor;
	/** @private @type { number[] } */ #ambientHorizonColor;
	/** @private @type { number[] } */ #ambientGroundColor;
	/** @private @type { number } */ #normalStrength;
	/** @private @type { number } */ #detailStrength;
	/** @private @type { number } */ #detailTexelSize;
	/** @private @type { number } */ #cavityStrength;
	/** @private @type { number[] } */ #roughnessRange;
	/** @private @type { number } */ #specularStrength;
	/** @private @type { number } */ #sheenStrength;
	/** @private @type { number } */ #subsurfaceAmount;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext
	 */
	constructor(webGL2RenderingContext) {
		super(webGL2RenderingContext, SKIN_FRAGMENTSHADER_SOURCE);

		this.#lightDirections = new System.Float32Array(9);
		this.#lightColors = new System.Float32Array(9);
		this.#ambientSkyColor = [0.34, 0.36, 0.42];
		this.#ambientHorizonColor = [0.16, 0.15, 0.16];
		this.#ambientGroundColor = [0.05, 0.04, 0.045];
		this.#normalStrength = 1;
		this.#detailStrength = 6;
		this.#detailTexelSize = 1 / 4096;
		this.#cavityStrength = 6;
		this.#roughnessRange = [0.32, 0.62];
		this.#specularStrength = 1;
		this.#sheenStrength = 0.35;
		this.#subsurfaceAmount = 1;

		// 기본 3점 조명. (키: 좌상 전방 난색 / 필: 우측 한색 약광 / 림: 우후방 상단 백색)
		this.setLight(0, 0.45, 0.6, 0.65, 1.0, 0.93, 0.85, 3.2);
		this.setLight(1, -0.7, 0.15, 0.6, 0.55, 0.65, 0.85, 0.8);
		this.setLight(2, 0.5, 0.4, -0.75, 0.9, 0.95, 1.0, 2.2);
	}

	//==============================================================================
	// 출력. (피부 유니폼 설정 후 기반 렌더러의 드로어블 순회)
	//==============================================================================
	/**
	 * @override
	 * @param { SkinnedModel } skinnedModel
	 * @param { Float32Array } viewProjectionElements
	 * @param { Float32Array } modelMatrixElements
	 * @param { number } cameraX
	 * @param { number } cameraY
	 * @param { number } cameraZ
	 */
	draw(skinnedModel, viewProjectionElements, modelMatrixElements, cameraX, cameraY, cameraZ) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const shaderProgram = this.getShaderProgram();
		shaderProgram.use();
		const lightDirectionsLocation = shaderProgram.getUniformLocation("lightDirections[0]");
		webGL2RenderingContext.uniform3fv(lightDirectionsLocation, this.#lightDirections);
		const lightColorsLocation = shaderProgram.getUniformLocation("lightColors[0]");
		webGL2RenderingContext.uniform3fv(lightColorsLocation, this.#lightColors);
		const ambientSkyColorLocation = shaderProgram.getUniformLocation("ambientSkyColor");
		webGL2RenderingContext.uniform3f(ambientSkyColorLocation, this.#ambientSkyColor[0], this.#ambientSkyColor[1], this.#ambientSkyColor[2]);
		const ambientHorizonColorLocation = shaderProgram.getUniformLocation("ambientHorizonColor");
		webGL2RenderingContext.uniform3f(ambientHorizonColorLocation, this.#ambientHorizonColor[0], this.#ambientHorizonColor[1], this.#ambientHorizonColor[2]);
		const ambientGroundColorLocation = shaderProgram.getUniformLocation("ambientGroundColor");
		webGL2RenderingContext.uniform3f(ambientGroundColorLocation, this.#ambientGroundColor[0], this.#ambientGroundColor[1], this.#ambientGroundColor[2]);
		const normalStrengthLocation = shaderProgram.getUniformLocation("normalStrength");
		webGL2RenderingContext.uniform1f(normalStrengthLocation, this.#normalStrength);
		const detailStrengthLocation = shaderProgram.getUniformLocation("detailStrength");
		webGL2RenderingContext.uniform1f(detailStrengthLocation, this.#detailStrength);
		const detailTexelSizeLocation = shaderProgram.getUniformLocation("detailTexelSize");
		webGL2RenderingContext.uniform1f(detailTexelSizeLocation, this.#detailTexelSize);
		const cavityStrengthLocation = shaderProgram.getUniformLocation("cavityStrength");
		webGL2RenderingContext.uniform1f(cavityStrengthLocation, this.#cavityStrength);
		const roughnessRangeLocation = shaderProgram.getUniformLocation("roughnessRange");
		webGL2RenderingContext.uniform2f(roughnessRangeLocation, this.#roughnessRange[0], this.#roughnessRange[1]);
		const specularStrengthLocation = shaderProgram.getUniformLocation("specularStrength");
		webGL2RenderingContext.uniform1f(specularStrengthLocation, this.#specularStrength);
		const sheenStrengthLocation = shaderProgram.getUniformLocation("sheenStrength");
		webGL2RenderingContext.uniform1f(sheenStrengthLocation, this.#sheenStrength);
		const subsurfaceAmountLocation = shaderProgram.getUniformLocation("subsurfaceAmount");
		webGL2RenderingContext.uniform1f(subsurfaceAmountLocation, this.#subsurfaceAmount);
		super.draw(skinnedModel, viewProjectionElements, modelMatrixElements, cameraX, cameraY, cameraZ);
	}

	//==============================================================================
	// 조명 설정. (0 = 키 라이트: 섀도우 맵 수신 / 1 = 필 / 2 = 림 — 방향은 표면에서 빛을 향하는 벡터)
	//==============================================================================
	/**
	 * @param { number } lightIndex
	 * @param { number } directionX
	 * @param { number } directionY
	 * @param { number } directionZ
	 * @param { number } red
	 * @param { number } green
	 * @param { number } blue
	 * @param { number } intensity
	 */
	setLight(lightIndex, directionX, directionY, directionZ, red, green, blue, intensity) {
		const directionLength = System.Math.sqrt(directionX * directionX + directionY * directionY + directionZ * directionZ);
		const safeLength = directionLength > 0 ? directionLength : 1;
		this.#lightDirections[lightIndex * 3] = directionX / safeLength;
		this.#lightDirections[lightIndex * 3 + 1] = directionY / safeLength;
		this.#lightDirections[lightIndex * 3 + 2] = directionZ / safeLength;
		this.#lightColors[lightIndex * 3] = red * intensity;
		this.#lightColors[lightIndex * 3 + 1] = green * intensity;
		this.#lightColors[lightIndex * 3 + 2] = blue * intensity;
	}

	//==============================================================================
	// 앰비언트 3색 설정. (하늘 / 지평 / 바닥 — 선형 색)
	//==============================================================================
	/**
	 * @param { number[] } skyColor
	 * @param { number[] } horizonColor
	 * @param { number[] } groundColor
	 */
	setAmbientColors(skyColor, horizonColor, groundColor) {
		this.#ambientSkyColor = skyColor.slice(0, 3);
		this.#ambientHorizonColor = horizonColor.slice(0, 3);
		this.#ambientGroundColor = groundColor.slice(0, 3);
	}

	//==============================================================================
	// 노멀 맵 강도 설정. (1 = 원본, 크면 주름이 깊어진다)
	//==============================================================================
	/**
	 * @param { number } normalStrength
	 */
	setNormalStrength(normalStrength) {
		this.#normalStrength = normalStrength;
	}

	//==============================================================================
	// 높이 디테일 강도 설정. (0 = 디테일 노멀 없음)
	//==============================================================================
	/**
	 * @param { number } detailStrength
	 */
	setDetailStrength(detailStrength) {
		this.#detailStrength = detailStrength;
	}

	//==============================================================================
	// 높이 디테일 텍셀 크기 설정. (1 / 높이 맵 해상도)
	//==============================================================================
	/**
	 * @param { number } detailTexelSize
	 */
	setDetailTexelSize(detailTexelSize) {
		this.#detailTexelSize = detailTexelSize;
	}

	//==============================================================================
	// 캐비티 강도 설정. (0 = 차폐 없음)
	//==============================================================================
	/**
	 * @param { number } cavityStrength
	 */
	setCavityStrength(cavityStrength) {
		this.#cavityStrength = cavityStrength;
	}

	//==============================================================================
	// 러프니스 범위 설정. (스펙큘러 맵 1 → 최소, 0 → 최대)
	//==============================================================================
	/**
	 * @param { number } minimumRoughness
	 * @param { number } maximumRoughness
	 */
	setRoughnessRange(minimumRoughness, maximumRoughness) {
		this.#roughnessRange = [minimumRoughness, maximumRoughness];
	}

	//==============================================================================
	// 스펙큘러 강도 설정. (피부 F0 배율)
	//==============================================================================
	/**
	 * @param { number } specularStrength
	 */
	setSpecularStrength(specularStrength) {
		this.#specularStrength = specularStrength;
	}

	//==============================================================================
	// 잔털 산란 강도 설정.
	//==============================================================================
	/**
	 * @param { number } sheenStrength
	 */
	setSheenStrength(sheenStrength) {
		this.#sheenStrength = sheenStrength;
	}

	//==============================================================================
	// SSS 마스크 강도 설정. (조도 출력 알파 — 0 이면 화면 공간 산란에서 제외)
	//==============================================================================
	/**
	 * @param { number } subsurfaceAmount
	 */
	setSubsurfaceAmount(subsurfaceAmount) {
		this.#subsurfaceAmount = subsurfaceAmount;
	}
}
