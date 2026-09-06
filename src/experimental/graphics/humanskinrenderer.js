//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { SkinnedModelRenderer, MORPH_GLSL } from "./skinnedmodelrenderer.js";
import { ShaderProgram } from "../../core/graphic/shaderprogram.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 셰이딩 모드. (머티리얼마다 setMaterialShading 으로 지정 — 같은 셰이더 안에서 분기)
export const SKIN_SHADING_SKIN = 0;
export const SKIN_SHADING_EYE = 1;
export const SKIN_SHADING_HAIR = 2;
export const SKIN_SHADING_OCCLUSION = 3;
export const SKIN_SHADING_FLUID = 4;

// 추가 텍스처 유닛. (머티리얼 기본 슬롯 0 / 2~8 과 섀도우 1, 모프 15 를 피한 9~14)
// - 피부: 9 높이 디테일, 10 마이크로(노멀 rgb + 캐비티 a), 11 주름 마스크 아틀라스(4x4), 12 주름 노멀 아틀라스(2x2), 13 주름 색 아틀라스(2x2)
// - 눈: 12 홍채 색, 13 홍채 노멀 / 머리카락: 12 카드 탄젠트(rgb) + 가닥 좌표(a)
export const SKIN_TEXTURE_UNIT_DETAILHEIGHT = 9;
export const SKIN_TEXTURE_UNIT_MICRO = 10;
export const SKIN_TEXTURE_UNIT_MASKATLAS = 11;
export const SKIN_TEXTURE_UNIT_LAYERNORMAL = 12;
export const SKIN_TEXTURE_UNIT_LAYERCOLOR = 13;
export const SKIN_TEXTURE_UNIT_AUXILIARY = 14;

// 주름 마스크 채널 수. (4x4 아틀라스 x RGBA — 채널마다 주름 맵 1 / 2 / 3 기여 가중치 vec3)
export const WRINKLE_CHANNEL_COUNT = 64;

// 섀도우 포아송 표본. (회전 노이즈로 흩어 부드러운 반영)
const SHADOW_SAMPLE_COUNT = 12;

// 인체 피부 프래그먼트 셰이더. (선형 HDR — 화면 공간 SSS 를 위해 조도 / 알베도 / 스펙큘러를 분리 출력)
// - 조명: 방향광 3개(0번은 섀도우 맵 수신) + 3색 반구 앰비언트 + 조명 방향의 소프트박스 반사 환경.
// - 피부: 노멀 맵 + 표정 주름 맵(마스크 아틀라스 가중 혼합) + 타일링 마이크로 노멀 / 캐비티 + 높이 미분 디테일, 이중 로브 GGX, 잔털.
// - 눈: 각막 굴절 시차로 홍채를 샘플링, 홍채 노멀 / 림버스 / 동공, 각막 유리 하이라이트 + 환경 반사, 공막 정맥 노멀.
// - 머리카락: 카드 탄젠트 아틀라스로 Kajiya-Kay 이중 로브 이방성 하이라이트, 뿌리 차폐, 투과 역광, 컷아웃 + 프린지 블렌드 2패스.
// - 차폐 / 유체: 블렌드 패스 전용 — 눈꺼풀 차폐 메시는 조도만 어둡게, 눈물선 / 침은 스펙큘러만 얹는다.
// - 출력 0: 확산 조도(rgb) + SSS 마스크(a) / 1: 선형 알베도(rgb) + 커버리지(a) / 2: 스펙큘러(rgb) / 3: 월드 노멀(rgb).
const SKIN_FRAGMENTSHADER_SOURCE = `#version 300 es
precision highp float;
in vec3 worldPosition;
in vec3 worldNormal;
in vec2 fragmentTextureCoordinate;
in vec4 lightSpacePosition;
uniform sampler2D baseColorTexture;
uniform sampler2D normalTexture;
uniform sampler2D specularTexture;
uniform sampler2D metallicRoughnessTexture;
uniform sampler2D occlusionTexture;
uniform sampler2D opacityTexture;
uniform sampler2D detailHeightTexture;
uniform sampler2D microTexture;
uniform sampler2D maskAtlasTexture;
uniform sampler2D layerNormalTexture;
uniform sampler2D layerColorTexture;
uniform sampler2D auxiliaryTexture;
uniform vec3 baseColorFactor;
uniform float roughnessFactor;
uniform int useAlphaCutout;
uniform float subsurfaceFactor;
uniform int shadingMode;
uniform int passMode;
uniform highp sampler2DShadow shadowMapTexture;
uniform float shadowStrength;
uniform float shadowTexelSize;
uniform float shadowSoftness;
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
uniform float microTiling;
uniform float microStrength;
uniform int useWrinkleMaps;
uniform vec3 wrinkleChannelWeights[${WRINKLE_CHANNEL_COUNT}];
uniform float wrinkleNormalStrength;
uniform float wrinkleColorStrength;
uniform float eyeIrisRadius;
uniform float eyePupilRadius;
uniform float eyeIrisDepth;
uniform vec3 hairSpecularShift;
uniform vec3 hairSpecularPower;
uniform vec3 hairSpecularIntensity;
uniform float hairRootShade;
layout(location = 0) out vec4 irradianceOutput;
layout(location = 1) out vec4 albedoOutput;
layout(location = 2) out vec4 specularOutput;
layout(location = 3) out vec4 normalOutput;

const float PI = 3.14159265;

// 포아송 원판. (12 표본 — 프래그먼트마다 회전)
const vec2 POISSON_DISK[${SHADOW_SAMPLE_COUNT}] = vec2[](
	vec2(-0.326, -0.406), vec2(-0.840, -0.074), vec2(-0.696, 0.457), vec2(-0.203, 0.621),
	vec2(0.962, -0.195), vec2(0.473, -0.480), vec2(0.519, 0.767), vec2(0.185, -0.893),
	vec2(0.507, 0.064), vec2(0.896, 0.412), vec2(-0.322, -0.933), vec2(-0.792, -0.598));

float interleavedGradientNoise(vec2 screenPosition) {
	return fract(52.9829189 * fract(dot(screenPosition, vec2(0.06711056, 0.00583715))));
}

// 섀도우. (회전 포아송 PCF — 비교 샘플러, 경사 비례 바이어스)
float sampleShadowFactor(float normalDotLight) {
	vec3 projected = lightSpacePosition.xyz / lightSpacePosition.w;
	projected = projected * 0.5 + 0.5;
	if (projected.x < 0.0 || projected.x > 1.0 || projected.y < 0.0 || projected.y > 1.0 || projected.z > 1.0) {
		return 1.0;
	}
	float bias = 0.0012 + 0.0035 * (1.0 - normalDotLight);
	float angle = interleavedGradientNoise(gl_FragCoord.xy) * 2.0 * PI;
	float cosine = cos(angle);
	float sine = sin(angle);
	mat2 rotation = mat2(cosine, sine, -sine, cosine);
	float radius = shadowTexelSize * shadowSoftness;
	float shadowSum = 0.0;
	for (int sampleIndex = 0; sampleIndex < ${SHADOW_SAMPLE_COUNT}; ++sampleIndex) {
		vec2 tapOffset = rotation * POISSON_DISK[sampleIndex] * radius;
		shadowSum += texture(shadowMapTexture, vec3(projected.xy + tapOffset, projected.z - bias));
	}
	return shadowSum / float(${SHADOW_SAMPLE_COUNT});
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

// 환경 BRDF 근사. (Karis)
vec2 environmentBrdf(float roughness, float normalDotView) {
	vec4 coefficient0 = vec4(-1.0, -0.0275, -0.572, 0.022);
	vec4 coefficient1 = vec4(1.0, 0.0425, 1.04, -0.04);
	vec4 roughnessTerm = roughness * coefficient0 + coefficient1;
	float a004 = min(roughnessTerm.x * roughnessTerm.x, exp2(-9.28 * normalDotView)) * roughnessTerm.x + roughnessTerm.y;
	return vec2(-1.04, 1.04) * a004 + roughnessTerm.zw;
}

vec3 hemisphereAmbient(vec3 direction) {
	float upness = direction.y;
	return upness > 0.0 ? mix(ambientHorizonColor, ambientSkyColor, upness) : mix(ambientHorizonColor, ambientGroundColor, -upness);
}

// sRGB → 선형. (색 텍스처는 8비트 sRGB 로 올리고 여기서 디코드한다)
vec3 decodeSrgb(vec3 encoded) {
	return pow(max(encoded, vec3(0.0)), vec3(2.2));
}

// UDN 노멀 합성. (탄젠트 공간 xy 누적)
vec3 blendTangentNormal(vec3 baseNormal, vec2 detailXy) {
	return normalize(vec3(baseNormal.xy + detailXy, baseNormal.z));
}

// 주름 맵 가중치. (마스크 아틀라스 4x4 타일 x RGBA 채널 → 주름 맵 1 / 2 / 3 기여 합)
vec3 wrinkleWeights(vec2 textureCoordinate) {
	vec3 weights = vec3(0.0);
	for (int tileIndex = 0; tileIndex < 16; ++tileIndex) {
		vec2 tileOffset = vec2(float(tileIndex % 4), float(tileIndex / 4)) * 0.25;
		vec4 mask = texture(maskAtlasTexture, textureCoordinate * 0.25 + tileOffset);
		weights += mask.r * wrinkleChannelWeights[tileIndex * 4];
		weights += mask.g * wrinkleChannelWeights[tileIndex * 4 + 1];
		weights += mask.b * wrinkleChannelWeights[tileIndex * 4 + 2];
		weights += mask.a * wrinkleChannelWeights[tileIndex * 4 + 3];
	}
	return clamp(weights, 0.0, 1.0);
}

// 2x2 아틀라스 타일 좌표. (0 좌하, 1 우하, 2 좌상)
vec2 layerTileCoordinate(vec2 textureCoordinate, int tileIndex) {
	return textureCoordinate * 0.5 + vec2(float(tileIndex % 2), float(tileIndex / 2)) * 0.5;
}

//==============================================================================
// 피부.
//==============================================================================
void shadeSkin(vec2 textureCoordinate, vec3 geometryNormal, vec3 viewDirection, mat3 tangentFrame) {
	vec3 albedo = decodeSrgb(texture(baseColorTexture, textureCoordinate).rgb);
	float specularMap = texture(specularTexture, textureCoordinate).r;
	float roughnessMap = texture(metallicRoughnessTexture, textureCoordinate).g;
	float occlusion = texture(occlusionTexture, textureCoordinate).r;
	vec3 tangentNormal = texture(normalTexture, textureCoordinate).xyz * 2.0 - 1.0;
	tangentNormal.xy *= normalStrength;
	tangentNormal = normalize(tangentNormal);

	// 표정 주름. (마스크 가중치만큼 주름 노멀을 UDN 합성하고 주름 색으로 알베도를 당긴다)
	if (useWrinkleMaps == 1) {
		vec3 weights = wrinkleWeights(textureCoordinate);
		for (int layerIndex = 0; layerIndex < 3; ++layerIndex) {
			float weight = weights[layerIndex];
			if (weight < 0.002) {
				continue;
			}
			vec2 tileCoordinate = layerTileCoordinate(textureCoordinate, layerIndex);
			vec3 wrinkleNormal = texture(layerNormalTexture, tileCoordinate).xyz * 2.0 - 1.0;
			tangentNormal = blendTangentNormal(tangentNormal, wrinkleNormal.xy * weight * wrinkleNormalStrength);
			// 주름 색 맵은 중간 회색(0.5) 기준의 오버레이 — 가중치만큼 밝기 / 색 변화를 곱한다
			vec3 wrinkleColor = texture(layerColorTexture, tileCoordinate).rgb;
			albedo *= decodeSrgb(mix(vec3(0.5), wrinkleColor, weight * wrinkleColorStrength) * 2.0);
		}
	}

	// 마이크로 노멀 / 캐비티. (타일링 — 모공 사이 미세 요철)
	vec4 micro = texture(microTexture, textureCoordinate * microTiling);
	vec2 microNormalXy = (micro.xy * 2.0 - 1.0) * microStrength;
	float microCavity = mix(1.0, micro.a, microStrength * 0.6);

	// 높이 맵 미분 디테일. (모공 캐비티 높이)
	float heightLeft = texture(detailHeightTexture, textureCoordinate - vec2(detailTexelSize, 0.0)).r;
	float heightRight = texture(detailHeightTexture, textureCoordinate + vec2(detailTexelSize, 0.0)).r;
	float heightDown = texture(detailHeightTexture, textureCoordinate - vec2(0.0, detailTexelSize)).r;
	float heightUp = texture(detailHeightTexture, textureCoordinate + vec2(0.0, detailTexelSize)).r;
	vec2 heightGradient = vec2(heightRight - heightLeft, heightUp - heightDown);
	vec3 combinedTangentNormal = blendTangentNormal(tangentNormal, -heightGradient * detailStrength + microNormalXy);
	vec3 surfaceNormal = normalize(tangentFrame * combinedTangentNormal);
	vec3 diffuseNormal = normalize(mix(geometryNormal, normalize(tangentFrame * tangentNormal), 0.75));

	// 캐비티. (높이 - 저역 높이 — 모공 / 주름 골 차폐)
	float heightCenter = texture(detailHeightTexture, textureCoordinate).r;
	float heightAverage = textureLod(detailHeightTexture, textureCoordinate, 4.0).r;
	float cavity = clamp(1.0 + (heightCenter - heightAverage) * cavityStrength, 0.2, 1.0) * microCavity;

	// 러프니스 / 피부 F0. (골은 거칠고 스펙큘러 맵이 밝은 부위(입술 / 콧등)는 매끈)
	float roughness = mix(roughnessRange.y, roughnessRange.x, specularMap) * roughnessMap * roughnessFactor;
	roughness = clamp(roughness * mix(1.25, 0.9, cavity), 0.03, 1.0);
	float fresnelBase = 0.028 * specularStrength * mix(0.6, 1.4, specularMap);
	float normalDotView = max(dot(surfaceNormal, viewDirection), 0.0001);
	float geometryDotView = max(dot(geometryNormal, viewDirection), 0.0);

	float keyDotLight = max(dot(diffuseNormal, normalize(lightDirections[0])), 0.0);
	float shadowFactor = 1.0;
	if (shadowStrength > 0.001) {
		shadowFactor = mix(1.0, sampleShadowFactor(keyDotLight), shadowStrength);
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

	// 앰비언트 확산 + 환경 반사.
	irradiance += hemisphereAmbient(diffuseNormal) * occlusion * mix(1.0, cavity, 0.5);
	vec3 reflection = reflect(-viewDirection, surfaceNormal);
	vec3 environment = studioEnvironment(reflection, roughness);
	vec2 environmentScaleBias = environmentBrdf(roughness, normalDotView);
	specular += environment * (fresnelBase * environmentScaleBias.x + environmentScaleBias.y) * occlusion;
	specular *= cavity;

	irradianceOutput = vec4(irradiance, subsurfaceAmount * subsurfaceFactor);
	albedoOutput = vec4(albedo * baseColorFactor, 1.0);
	specularOutput = vec4(specular, 1.0);
	normalOutput = vec4(surfaceNormal, 1.0);
}

//==============================================================================
// 눈. (기본 색 = 공막, 12 = 홍채 색, 13 = 홍채 노멀, 노멀 맵 = 공막 정맥 — UV 중심이 동공)
//==============================================================================
void shadeEye(vec2 textureCoordinate, vec3 geometryNormal, vec3 viewDirection, mat3 tangentFrame) {
	vec2 centered = textureCoordinate - vec2(0.5);
	float radial = length(centered);
	float corneaMask = 1.0 - smoothstep(eyeIrisRadius * 0.95, eyeIrisRadius * 1.25, radial);

	// 각막 굴절 시차. (굴절된 시선을 탄젠트 공간으로 내려 홍채 평면 깊이만큼 UV 를 민다)
	vec3 refracted = refract(-viewDirection, geometryNormal, 1.0 / 1.376);
	vec3 refractedTangent = transpose(tangentFrame) * refracted;
	vec2 parallax = refractedTangent.xy / max(-refractedTangent.z, 0.25) * eyeIrisDepth * corneaMask;
	vec2 irisCoordinate = textureCoordinate + parallax;
	vec2 irisCentered = irisCoordinate - vec2(0.5);
	float irisRadial = length(irisCentered);
	vec2 irisTextureCoordinate = irisCentered / (eyeIrisRadius * 2.0) + vec2(0.5);
	vec4 irisSample = texture(layerColorTexture, irisTextureCoordinate);
	vec3 irisColor = decodeSrgb(irisSample.rgb);
	float irisMask = (1.0 - smoothstep(eyeIrisRadius * 0.97, eyeIrisRadius * 1.03, irisRadial)) * corneaMask;
	float limbus = smoothstep(eyeIrisRadius * 0.72, eyeIrisRadius * 1.0, irisRadial);
	irisColor *= mix(1.0, 0.25, limbus);
	float pupil = 1.0 - smoothstep(eyePupilRadius * 0.8, eyePupilRadius * 1.15, irisRadial);
	irisColor = mix(irisColor, vec3(0.002), pupil);

	vec3 scleraColor = decodeSrgb(texture(baseColorTexture, textureCoordinate).rgb);
	vec3 albedo = mix(scleraColor, irisColor, irisMask);

	// 노멀. (공막 정맥 + 홍채 요철 — 각막 하이라이트는 매끈한 기하 노멀)
	vec3 scleraNormal = texture(normalTexture, textureCoordinate).xyz * 2.0 - 1.0;
	scleraNormal.xy *= 0.5 * (1.0 - corneaMask);
	vec3 irisNormal = texture(layerNormalTexture, irisTextureCoordinate).xyz * 2.0 - 1.0;
	vec3 diffuseTangentNormal = normalize(vec3(scleraNormal.xy + irisNormal.xy * irisMask * 0.8, 1.0));
	vec3 diffuseNormal = normalize(tangentFrame * diffuseTangentNormal);
	vec3 corneaNormal = normalize(mix(normalize(tangentFrame * normalize(vec3(scleraNormal.xy, 1.0))), geometryNormal, corneaMask));

	// 홍채 안쪽 자기 차폐. (림버스 쪽 어둡고 동공 쪽으로 파여 있는 느낌)
	float irisDepthShade = mix(1.0, 0.65 + 0.35 * (1.0 - limbus), irisMask);

	float normalDotView = max(dot(corneaNormal, viewDirection), 0.0001);
	float fresnelBase = 0.025;
	float corneaRoughness = mix(0.16, 0.035, corneaMask);
	vec3 irradiance = vec3(0.0);
	vec3 specular = vec3(0.0);
	for (int lightIndex = 0; lightIndex < 3; ++lightIndex) {
		vec3 lightDirection = normalize(lightDirections[lightIndex]);
		vec3 lightColor = lightColors[lightIndex];
		// 홍채는 각막 안쪽에서 굴절된 빛을 받아 밝기가 넓게 퍼진다
		float diffuseDotLight = max(dot(diffuseNormal, lightDirection), 0.0);
		float wrapped = max(dot(diffuseNormal, lightDirection) * 0.6 + 0.4, 0.0);
		irradiance += lightColor * mix(diffuseDotLight, wrapped, irisMask);

		float normalDotLight = max(dot(corneaNormal, lightDirection), 0.0);
		if (normalDotLight > 0.0) {
			vec3 halfVector = normalize(viewDirection + lightDirection);
			float normalDotHalf = max(dot(corneaNormal, halfVector), 0.0);
			float viewDotHalf = max(dot(viewDirection, halfVector), 0.0);
			float fresnel = fresnelBase + (1.0 - fresnelBase) * pow(1.0 - viewDotHalf, 5.0);
			specular += lightColor * fresnel * specularLobe(normalDotHalf, normalDotLight, normalDotView, corneaRoughness) * PI * normalDotLight;
		}
	}
	irradiance += hemisphereAmbient(diffuseNormal) * 1.1;
	irradiance *= irisDepthShade;
	vec3 reflection = reflect(-viewDirection, corneaNormal);
	vec3 environment = studioEnvironment(reflection, corneaRoughness);
	vec2 environmentScaleBias = environmentBrdf(corneaRoughness, normalDotView);
	specular += environment * (fresnelBase * environmentScaleBias.x + environmentScaleBias.y) * 1.4;

	irradianceOutput = vec4(irradiance * albedo * baseColorFactor, 0.0);
	albedoOutput = vec4(1.0, 1.0, 1.0, 1.0);
	specularOutput = vec4(specular, 1.0);
	normalOutput = vec4(corneaNormal, 1.0);
}

//==============================================================================
// 머리카락. (기본 색 rgb + 커버리지 a, 12 = 카드 탄젠트 rgb + 가닥 좌표 a)
//==============================================================================
void shadeHair(vec2 textureCoordinate, vec3 geometryNormal, vec3 viewDirection, mat3 tangentFrame, float coverage) {
	vec3 albedo = decodeSrgb(texture(baseColorTexture, textureCoordinate).rgb) * baseColorFactor;
	vec4 tangentSample = texture(layerNormalTexture, textureCoordinate);
	vec3 cardTangent = tangentSample.xyz * 2.0 - 1.0;
	vec3 strandTangent = normalize(tangentFrame * cardTangent);
	float strandCoordinate = tangentSample.a;

	// 뿌리 차폐. (두피 쪽 가닥은 겹쳐서 어둡다)
	float rootShade = mix(1.0 - hairRootShade, 1.0, smoothstep(0.0, 0.6, strandCoordinate));
	albedo *= rootShade;

	float keyDotLight = max(dot(geometryNormal, normalize(lightDirections[0])) * 0.5 + 0.5, 0.0);
	float shadowFactor = 1.0;
	if (shadowStrength > 0.001) {
		shadowFactor = mix(1.0, sampleShadowFactor(keyDotLight), shadowStrength * 0.85);
	}

	vec3 irradiance = vec3(0.0);
	vec3 specular = vec3(0.0);
	for (int lightIndex = 0; lightIndex < 3; ++lightIndex) {
		vec3 lightDirection = normalize(lightDirections[lightIndex]);
		vec3 lightColor = lightColors[lightIndex];
		float lightShadow = lightIndex == 0 ? shadowFactor : 1.0;

		// 확산. (Kajiya 가닥 확산과 감싼 램버트를 섞어 카드 티가 덜 나게)
		float tangentDotLight = dot(strandTangent, lightDirection);
		float strandDiffuse = sqrt(max(1.0 - tangentDotLight * tangentDotLight, 0.0));
		float wrappedDiffuse = max(dot(geometryNormal, lightDirection) * 0.5 + 0.5, 0.0);
		irradiance += lightColor * mix(strandDiffuse, wrappedDiffuse, 0.55) * 0.55 * lightShadow;

		// 이방성 하이라이트. (뿌리 쪽으로 민 백색 1차 로브 + 끝 쪽으로 민 색 2차 로브)
		vec3 halfVector = normalize(viewDirection + lightDirection);
		vec3 shiftedPrimary = normalize(strandTangent + geometryNormal * hairSpecularShift.x);
		vec3 shiftedSecondary = normalize(strandTangent + geometryNormal * hairSpecularShift.y);
		float tangentDotHalfPrimary = dot(shiftedPrimary, halfVector);
		float tangentDotHalfSecondary = dot(shiftedSecondary, halfVector);
		float lobePrimary = pow(sqrt(max(1.0 - tangentDotHalfPrimary * tangentDotHalfPrimary, 0.0)), hairSpecularPower.x);
		float lobeSecondary = pow(sqrt(max(1.0 - tangentDotHalfSecondary * tangentDotHalfSecondary, 0.0)), hairSpecularPower.y);
		float lightWrap = smoothstep(-0.35, 0.35, dot(geometryNormal, lightDirection));
		specular += lightColor * (lobePrimary * hairSpecularIntensity.x + lobeSecondary * hairSpecularIntensity.y * albedo) * lightWrap * lightShadow;

		// 투과 역광. (빛을 등진 가닥이 비쳐 보인다)
		float backlight = pow(max(dot(viewDirection, -lightDirection), 0.0), 6.0);
		specular += lightColor * albedo * backlight * hairSpecularIntensity.z * lightShadow;
	}
	irradiance += hemisphereAmbient(geometryNormal) * rootShade;

	// 프린지 블렌드 패스: 조도는 커버리지만큼 줄이고(알파만 기여) 색은 스펙큘러 버퍼에 얹는다 → (1 - a) x 바닥 + a x 머리카락
	if (passMode == 1) {
		irradianceOutput = vec4(0.0, 0.0, 0.0, coverage);
		albedoOutput = vec4(0.0, 0.0, 0.0, 0.0);
		specularOutput = vec4(irradiance * albedo + specular, coverage);
		normalOutput = vec4(0.0, 0.0, 0.0, 0.0);
		return;
	}
	irradianceOutput = vec4(irradiance * albedo, 0.0);
	albedoOutput = vec4(1.0, 1.0, 1.0, 1.0);
	specularOutput = vec4(specular, 1.0);
	normalOutput = vec4(geometryNormal, 1.0);
}

//==============================================================================
// 차폐 / 유체. (블렌드 패스 — 차폐는 조도만 어둡게, 유체는 스펙큘러만 얹는다)
//==============================================================================
void shadeOverlay(vec2 textureCoordinate, vec3 geometryNormal, vec3 viewDirection) {
	if (shadingMode == ${SKIN_SHADING_OCCLUSION}) {
		float darkness = texture(baseColorTexture, textureCoordinate).a * baseColorFactor.x;
		irradianceOutput = vec4(0.0, 0.0, 0.0, darkness);
		albedoOutput = vec4(0.0, 0.0, 0.0, 0.0);
		specularOutput = vec4(0.0, 0.0, 0.0, darkness * 0.6);
		normalOutput = vec4(0.0, 0.0, 0.0, 0.0);
		return;
	}
	float normalDotView = max(dot(geometryNormal, viewDirection), 0.0001);
	float fresnelBase = 0.02;
	vec3 specular = vec3(0.0);
	for (int lightIndex = 0; lightIndex < 3; ++lightIndex) {
		vec3 lightDirection = normalize(lightDirections[lightIndex]);
		float normalDotLight = max(dot(geometryNormal, lightDirection), 0.0);
		if (normalDotLight > 0.0) {
			vec3 halfVector = normalize(viewDirection + lightDirection);
			float normalDotHalf = max(dot(geometryNormal, halfVector), 0.0);
			float viewDotHalf = max(dot(viewDirection, halfVector), 0.0);
			float fresnel = fresnelBase + (1.0 - fresnelBase) * pow(1.0 - viewDotHalf, 5.0);
			specular += lightColors[lightIndex] * fresnel * specularLobe(normalDotHalf, normalDotLight, normalDotView, 0.08) * PI * normalDotLight;
		}
	}
	vec3 reflection = reflect(-viewDirection, geometryNormal);
	vec2 environmentScaleBias = environmentBrdf(0.08, normalDotView);
	specular += studioEnvironment(reflection, 0.08) * (fresnelBase * environmentScaleBias.x + environmentScaleBias.y);
	float coverage = texture(baseColorTexture, textureCoordinate).a * baseColorFactor.x;
	irradianceOutput = vec4(0.0, 0.0, 0.0, 0.0);
	albedoOutput = vec4(0.0, 0.0, 0.0, 0.0);
	specularOutput = vec4(specular * 2.0, 0.5 * coverage);
	normalOutput = vec4(0.0, 0.0, 0.0, 0.0);
}

void main() {
	vec2 textureCoordinate = fragmentTextureCoordinate;

	// 커버리지. (머리카락은 기본 색 알파, 그 외 컷아웃 머티리얼은 오파시티 텍스처 알파)
	float coverage = 1.0;
	if (shadingMode == ${SKIN_SHADING_HAIR}) {
		coverage = texture(baseColorTexture, textureCoordinate).a;
		if (passMode == 0 && coverage < 0.5) {
			discard;
		}
		if (passMode == 1 && (coverage >= 0.5 || coverage < 0.03)) {
			discard;
		}
		coverage = passMode == 1 ? coverage * 2.0 : 1.0;
	}
	else if (useAlphaCutout == 1) {
		float opacity = texture(opacityTexture, textureCoordinate).a;
		if (opacity < 0.5) {
			discard;
		}
	}

	vec3 geometryNormal = normalize(worldNormal);
	vec3 viewDirection = normalize(cameraPosition - worldPosition);
	if (dot(geometryNormal, viewDirection) < 0.0) {
		geometryNormal = -geometryNormal;
	}
	mat3 tangentFrame = computeTangentFrame(geometryNormal);

	if (shadingMode == ${SKIN_SHADING_EYE}) {
		shadeEye(textureCoordinate, geometryNormal, viewDirection, tangentFrame);
	}
	else if (shadingMode == ${SKIN_SHADING_HAIR}) {
		shadeHair(textureCoordinate, geometryNormal, viewDirection, tangentFrame, coverage);
	}
	else if (shadingMode >= ${SKIN_SHADING_OCCLUSION}) {
		shadeOverlay(textureCoordinate, geometryNormal, viewDirection);
	}
	else {
		shadeSkin(textureCoordinate, geometryNormal, viewDirection, tangentFrame);
	}
}
`;

// 컷아웃 깊이 버텍스 셰이더. (섀도우 맵 캐스팅 — 머리카락 / 속눈썹의 투명 영역을 오파시티로 제거하기 위해 UV 를 넘긴다)
const CUTOUT_DEPTH_VERTEXSHADER_SOURCE = `#version 300 es
layout(location = 0) in vec3 vertexPosition;
layout(location = 2) in vec2 vertexTextureCoordinate;
layout(location = 3) in uvec4 vertexJoints;
layout(location = 4) in vec4 vertexWeights;
uniform mat4 modelMatrix;
uniform mat4 lightViewProjectionMatrix;
uniform mat4 jointMatrices[96];
out vec2 fragmentTextureCoordinate;
${MORPH_GLSL}
void main() {
	vec3 morphedPosition = vertexPosition;
	vec3 morphedNormal = vec3(0.0, 1.0, 0.0);
	applyMorphTargets(morphedPosition, morphedNormal);
	mat4 skinMatrix = vertexWeights.x * jointMatrices[vertexJoints.x]
		+ vertexWeights.y * jointMatrices[vertexJoints.y]
		+ vertexWeights.z * jointMatrices[vertexJoints.z]
		+ vertexWeights.w * jointMatrices[vertexJoints.w];
	fragmentTextureCoordinate = vertexTextureCoordinate;
	gl_Position = lightViewProjectionMatrix * modelMatrix * skinMatrix * vec4(morphedPosition, 1.0);
}
`;

// 컷아웃 깊이 프래그먼트 셰이더. (커버리지 텍스처 알파 0.5 미만 제거)
const CUTOUT_DEPTH_FRAGMENTSHADER_SOURCE = `#version 300 es
precision highp float;
in vec2 fragmentTextureCoordinate;
uniform sampler2D coverageTexture;
void main() {
	if (texture(coverageTexture, fragmentTextureCoordinate).a < 0.5) {
		discard;
	}
}
`;


//==============================================================================
// 인체 피부 렌더러. (SkinnedModelRenderer 의 스키닝/모프 버텍스 경로 위에 피부 / 눈 / 머리카락 셰이딩 템플릿을 세운다)
// - 선형 HDR 로 조도 / 알베도 / 스펙큘러 / 노멀을 MRT 로 나눠 출력하고, 합성은 SubsurfaceScatteringEffect 이후 호출자가 한다.
// - 머티리얼마다 셰이딩 모드를 등록한다(setMaterialShading). 불투명 패스(draw)는 피부 / 눈 / 머리카락 컷아웃,
//   블렌드 패스(drawBlended)는 머리카락 프린지 / 차폐 / 유체를 그린다 (호출자가 블렌드 상태를 잡는다).
// - 환경 상태: 조명 3개(0번 = 키 라이트, 섀도우 수신) / 3색 반구 앰비언트 / 노멀·디테일·러프니스·스펙큘러·주름·마이크로·눈·머리카락 파라미터.
//==============================================================================
export class HumanSkinRenderer extends SkinnedModelRenderer {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { ShaderProgram } */ #cutoutDepthShaderProgram;
	/** @private @type { Map<Material, number> } */ #materialShadingModes;
	/** @private @type { WebGLTexture | null } */ #shadowMapTexture;
	/** @private @type { Float32Array | null } */ #lightViewProjectionElements;
	/** @private @type { number } */ #shadowStrength;
	/** @private @type { number } */ #shadowTexelSize;
	/** @private @type { number } */ #shadowSoftness;
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
	/** @private @type { number } */ #microTiling;
	/** @private @type { number } */ #microStrength;
	/** @private @type { boolean } */ #useWrinkleMaps;
	/** @private @type { Float32Array } */ #wrinkleChannelWeights;
	/** @private @type { number } */ #wrinkleNormalStrength;
	/** @private @type { number } */ #wrinkleColorStrength;
	/** @private @type { number } */ #eyeIrisRadius;
	/** @private @type { number } */ #eyePupilRadius;
	/** @private @type { number } */ #eyeIrisDepth;
	/** @private @type { number[] } */ #hairSpecularShift;
	/** @private @type { number[] } */ #hairSpecularPower;
	/** @private @type { number[] } */ #hairSpecularIntensity;
	/** @private @type { number } */ #hairRootShade;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext
	 */
	constructor(webGL2RenderingContext) {
		super(webGL2RenderingContext, SKIN_FRAGMENTSHADER_SOURCE);

		this.#cutoutDepthShaderProgram = new ShaderProgram(webGL2RenderingContext, CUTOUT_DEPTH_VERTEXSHADER_SOURCE.trim(), CUTOUT_DEPTH_FRAGMENTSHADER_SOURCE.trim());
		this.#materialShadingModes = new System.Map();
		this.#shadowMapTexture = null;
		this.#lightViewProjectionElements = null;
		this.#shadowStrength = 0;
		this.#shadowTexelSize = 1 / 2048;
		this.#shadowSoftness = 2.5;
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
		this.#microTiling = 0;
		this.#microStrength = 0;
		this.#useWrinkleMaps = false;
		this.#wrinkleChannelWeights = new System.Float32Array(WRINKLE_CHANNEL_COUNT * 3);
		this.#wrinkleNormalStrength = 1;
		this.#wrinkleColorStrength = 1;
		this.#eyeIrisRadius = 0.133;
		this.#eyePupilRadius = 0.04;
		this.#eyeIrisDepth = 0.05;
		this.#hairSpecularShift = [-0.12, 0.14, 0];
		this.#hairSpecularPower = [180, 28, 0];
		this.#hairSpecularIntensity = [0.35, 0.5, 0.25];
		this.#hairRootShade = 0.45;

		// 기본 3점 조명. (키: 좌상 전방 난색 / 필: 우측 한색 약광 / 림: 우후방 상단 백색)
		this.setLight(0, 0.45, 0.6, 0.65, 1.0, 0.93, 0.85, 3.2);
		this.setLight(1, -0.7, 0.15, 0.6, 0.55, 0.65, 0.85, 0.8);
		this.setLight(2, 0.5, 0.4, -0.75, 0.9, 0.95, 1.0, 2.2);
	}

	//==============================================================================
	// 불투명 패스 출력. (피부 / 눈 / 머리카락 컷아웃 — 깊이 쓰기)
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
		this.drawPass(skinnedModel, viewProjectionElements, modelMatrixElements, cameraX, cameraY, cameraZ, 0);
	}

	//==============================================================================
	// 블렌드 패스 출력. (머리카락 프린지 / 차폐 / 유체 — 호출자가 블렌드 켜고 깊이 쓰기를 끈 뒤 호출)
	//==============================================================================
	/**
	 * @param { SkinnedModel } skinnedModel
	 * @param { Float32Array } viewProjectionElements
	 * @param { Float32Array } modelMatrixElements
	 * @param { number } cameraX
	 * @param { number } cameraY
	 * @param { number } cameraZ
	 */
	drawBlended(skinnedModel, viewProjectionElements, modelMatrixElements, cameraX, cameraY, cameraZ) {
		this.drawPass(skinnedModel, viewProjectionElements, modelMatrixElements, cameraX, cameraY, cameraZ, 1);
	}

	//==============================================================================
	// 패스 출력. (공통 유니폼 → 드로어블 순회 — 패스에 맞는 셰이딩 모드만)
	//==============================================================================
	/**
	 * @param { SkinnedModel } skinnedModel
	 * @param { Float32Array } viewProjectionElements
	 * @param { Float32Array } modelMatrixElements
	 * @param { number } cameraX
	 * @param { number } cameraY
	 * @param { number } cameraZ
	 * @param { number } passMode 0 = 불투명, 1 = 블렌드.
	 */
	drawPass(skinnedModel, viewProjectionElements, modelMatrixElements, cameraX, cameraY, cameraZ, passMode) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const shaderProgram = this.getShaderProgram();
		shaderProgram.use();
		const viewProjectionLocation = shaderProgram.getUniformLocation("viewProjectionMatrix");
		webGL2RenderingContext.uniformMatrix4fv(viewProjectionLocation, false, viewProjectionElements);
		const modelMatrixLocation = shaderProgram.getUniformLocation("modelMatrix");
		webGL2RenderingContext.uniformMatrix4fv(modelMatrixLocation, false, modelMatrixElements);
		const cameraPositionLocation = shaderProgram.getUniformLocation("cameraPosition");
		webGL2RenderingContext.uniform3f(cameraPositionLocation, cameraX, cameraY, cameraZ);
		this.applyEnvironmentUniforms(shaderProgram);
		this.applyShadowUniforms(shaderProgram);
		const passModeLocation = shaderProgram.getUniformLocation("passMode");
		webGL2RenderingContext.uniform1i(passModeLocation, passMode);
		const shadingModeLocation = shaderProgram.getUniformLocation("shadingMode");

		const jointMatricesLocation = shaderProgram.getUniformLocation("jointMatrices[0]");
		const skinList = skinnedModel.getSkinList();
		const drawableList = skinnedModel.getDrawableList();
		for (const drawable of drawableList) {
			const shadingMode = this.getMaterialShadingMode(drawable.material);
			const isOverlay = shadingMode >= SKIN_SHADING_OCCLUSION;
			const isHair = shadingMode === SKIN_SHADING_HAIR;
			if (passMode === 0 && isOverlay) {
				continue;
			}
			if (passMode === 1 && !isOverlay && !isHair) {
				continue;
			}
			const skin = skinList[drawable.skinIndex];
			webGL2RenderingContext.uniformMatrix4fv(jointMatricesLocation, false, skin.jointMatrixArray);
			this.applyMorphUniforms(shaderProgram, drawable);
			webGL2RenderingContext.uniform1i(shadingModeLocation, shadingMode);
			drawable.material.apply();
			webGL2RenderingContext.bindVertexArray(drawable.vertexArray);
			if (drawable.isIndexed) {
				webGL2RenderingContext.drawElements(webGL2RenderingContext.TRIANGLES, drawable.indexCount, drawable.indexComponentType, drawable.indexByteOffset);
			}
			else {
				webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLES, 0, drawable.vertexCount);
			}
		}
		webGL2RenderingContext.bindVertexArray(null);
	}

	//==============================================================================
	// 깊이 패스 출력. (섀도우 맵 캐스팅 — 컷아웃 / 머리카락 머티리얼은 커버리지 텍스처로 투명 영역 제거, 차폐 / 유체는 제외)
	//==============================================================================
	/**
	 * @override
	 * @param { SkinnedModel } skinnedModel
	 * @param { Float32Array } lightViewProjectionElements
	 * @param { Float32Array } modelMatrixElements
	 */
	drawDepth(skinnedModel, lightViewProjectionElements, modelMatrixElements) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const skinList = skinnedModel.getSkinList();
		const drawableList = skinnedModel.getDrawableList();
		const depthShaderProgram = this.getDepthShaderProgram();
		const cutoutDepthShaderProgram = this.getCutoutDepthShaderProgram();
		for (const shaderProgram of [depthShaderProgram, cutoutDepthShaderProgram]) {
			const useCutout = shaderProgram === cutoutDepthShaderProgram;
			shaderProgram.use();
			const lightViewProjectionLocation = shaderProgram.getUniformLocation("lightViewProjectionMatrix");
			webGL2RenderingContext.uniformMatrix4fv(lightViewProjectionLocation, false, lightViewProjectionElements);
			const modelMatrixLocation = shaderProgram.getUniformLocation("modelMatrix");
			webGL2RenderingContext.uniformMatrix4fv(modelMatrixLocation, false, modelMatrixElements);
			const jointMatricesLocation = shaderProgram.getUniformLocation("jointMatrices[0]");
			const coverageTextureLocation = shaderProgram.getUniformLocation("coverageTexture");
			for (const drawable of drawableList) {
				const shadingMode = this.getMaterialShadingMode(drawable.material);
				if (shadingMode >= SKIN_SHADING_OCCLUSION) {
					continue;
				}
				const material = drawable.material;
				const useAlphaCutout = material.getUseAlphaCutout();
				const needsCutout = shadingMode === SKIN_SHADING_HAIR || useAlphaCutout;
				if (needsCutout !== useCutout) {
					continue;
				}
				const skin = skinList[drawable.skinIndex];
				webGL2RenderingContext.uniformMatrix4fv(jointMatricesLocation, false, skin.jointMatrixArray);
				this.applyMorphUniforms(shaderProgram, drawable);
				if (useCutout) {
					// 커버리지 텍스처. (머리카락은 기본 색 알파, 그 외는 오파시티 텍스처)
					const textureBindings = material.getTextureBindings();
					const coverageName = shadingMode === SKIN_SHADING_HAIR ? "baseColorTexture" : "opacityTexture";
					for (const binding of textureBindings) {
						if (binding[0] === coverageName) {
							webGL2RenderingContext.uniform1i(coverageTextureLocation, 0);
							webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
							webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, binding[2]);
						}
					}
				}
				webGL2RenderingContext.bindVertexArray(drawable.vertexArray);
				if (drawable.isIndexed) {
					webGL2RenderingContext.drawElements(webGL2RenderingContext.TRIANGLES, drawable.indexCount, drawable.indexComponentType, drawable.indexByteOffset);
				}
				else {
					webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLES, 0, drawable.vertexCount);
				}
			}
		}
		webGL2RenderingContext.bindVertexArray(null);
	}

	//==============================================================================
	// 환경 유니폼 적용. (조명 / 앰비언트 / 피부 / 주름 / 마이크로 / 눈 / 머리카락 파라미터)
	//==============================================================================
	/**
	 * @param { ShaderProgram } shaderProgram
	 */
	applyEnvironmentUniforms(shaderProgram) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
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
		const microTilingLocation = shaderProgram.getUniformLocation("microTiling");
		webGL2RenderingContext.uniform1f(microTilingLocation, this.#microTiling);
		const microStrengthLocation = shaderProgram.getUniformLocation("microStrength");
		webGL2RenderingContext.uniform1f(microStrengthLocation, this.#microStrength);
		const useWrinkleMapsLocation = shaderProgram.getUniformLocation("useWrinkleMaps");
		webGL2RenderingContext.uniform1i(useWrinkleMapsLocation, this.#useWrinkleMaps ? 1 : 0);
		const wrinkleChannelWeightsLocation = shaderProgram.getUniformLocation("wrinkleChannelWeights[0]");
		webGL2RenderingContext.uniform3fv(wrinkleChannelWeightsLocation, this.#wrinkleChannelWeights);
		const wrinkleNormalStrengthLocation = shaderProgram.getUniformLocation("wrinkleNormalStrength");
		webGL2RenderingContext.uniform1f(wrinkleNormalStrengthLocation, this.#wrinkleNormalStrength);
		const wrinkleColorStrengthLocation = shaderProgram.getUniformLocation("wrinkleColorStrength");
		webGL2RenderingContext.uniform1f(wrinkleColorStrengthLocation, this.#wrinkleColorStrength);
		const eyeIrisRadiusLocation = shaderProgram.getUniformLocation("eyeIrisRadius");
		webGL2RenderingContext.uniform1f(eyeIrisRadiusLocation, this.#eyeIrisRadius);
		const eyePupilRadiusLocation = shaderProgram.getUniformLocation("eyePupilRadius");
		webGL2RenderingContext.uniform1f(eyePupilRadiusLocation, this.#eyePupilRadius);
		const eyeIrisDepthLocation = shaderProgram.getUniformLocation("eyeIrisDepth");
		webGL2RenderingContext.uniform1f(eyeIrisDepthLocation, this.#eyeIrisDepth);
		const hairSpecularShiftLocation = shaderProgram.getUniformLocation("hairSpecularShift");
		webGL2RenderingContext.uniform3f(hairSpecularShiftLocation, this.#hairSpecularShift[0], this.#hairSpecularShift[1], this.#hairSpecularShift[2]);
		const hairSpecularPowerLocation = shaderProgram.getUniformLocation("hairSpecularPower");
		webGL2RenderingContext.uniform3f(hairSpecularPowerLocation, this.#hairSpecularPower[0], this.#hairSpecularPower[1], this.#hairSpecularPower[2]);
		const hairSpecularIntensityLocation = shaderProgram.getUniformLocation("hairSpecularIntensity");
		webGL2RenderingContext.uniform3f(hairSpecularIntensityLocation, this.#hairSpecularIntensity[0], this.#hairSpecularIntensity[1], this.#hairSpecularIntensity[2]);
		const hairRootShadeLocation = shaderProgram.getUniformLocation("hairRootShade");
		webGL2RenderingContext.uniform1f(hairRootShadeLocation, this.#hairRootShade);
	}

	//==============================================================================
	// 섀도우 유니폼 적용. (섀도우 샘플러 타입 불일치로 드로우가 무효화되지 않도록 강도와 무관하게 항상 바인드)
	//==============================================================================
	/**
	 * @param { ShaderProgram } shaderProgram
	 */
	applyShadowUniforms(shaderProgram) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const shadowMapTextureLocation = shaderProgram.getUniformLocation("shadowMapTexture");
		webGL2RenderingContext.uniform1i(shadowMapTextureLocation, 1);
		const shadowStrengthLocation = shaderProgram.getUniformLocation("shadowStrength");
		const shadowSoftnessLocation = shaderProgram.getUniformLocation("shadowSoftness");
		webGL2RenderingContext.uniform1f(shadowSoftnessLocation, this.#shadowSoftness);
		if (this.#shadowMapTexture && this.#lightViewProjectionElements) {
			const lightViewProjectionLocation = shaderProgram.getUniformLocation("lightViewProjectionMatrix");
			webGL2RenderingContext.uniformMatrix4fv(lightViewProjectionLocation, false, this.#lightViewProjectionElements);
			const shadowTexelSizeLocation = shaderProgram.getUniformLocation("shadowTexelSize");
			webGL2RenderingContext.uniform1f(shadowTexelSizeLocation, this.#shadowTexelSize);
			webGL2RenderingContext.uniform1f(shadowStrengthLocation, this.#shadowStrength);
			webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE1);
			webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, this.#shadowMapTexture);
			webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		}
		else {
			webGL2RenderingContext.uniform1f(shadowStrengthLocation, 0);
		}
	}

	//==============================================================================
	// 섀도우 맵 설정. (본 패스에서 그림자 수신 — 기반 렌더러에도 전달)
	//==============================================================================
	/**
	 * @override
	 * @param { WebGLTexture | null } shadowMapTexture
	 * @param { Float32Array | null } lightViewProjectionElements
	 * @param { number } texelSize
	 */
	setShadowMap(shadowMapTexture, lightViewProjectionElements, texelSize) {
		super.setShadowMap(shadowMapTexture, lightViewProjectionElements, texelSize);
		this.#shadowMapTexture = shadowMapTexture;
		this.#lightViewProjectionElements = lightViewProjectionElements;
		this.#shadowTexelSize = texelSize;
	}

	//==============================================================================
	// 그림자 강도 설정. (0 = 수신 안 함)
	//==============================================================================
	/**
	 * @override
	 * @param { number } shadowStrength
	 */
	setShadowStrength(shadowStrength) {
		super.setShadowStrength(shadowStrength);
		this.#shadowStrength = shadowStrength;
	}

	//==============================================================================
	// 그림자 부드러움 설정. (포아송 반경 — 섀도우 텍셀 단위)
	//==============================================================================
	/**
	 * @param { number } shadowSoftness
	 */
	setShadowSoftness(shadowSoftness) {
		this.#shadowSoftness = shadowSoftness;
	}

	//==============================================================================
	// 머티리얼 셰이딩 모드 등록. (등록하지 않은 머티리얼은 피부)
	//==============================================================================
	/**
	 * @param { Material } material
	 * @param { number } shadingMode
	 */
	setMaterialShading(material, shadingMode) {
		this.#materialShadingModes.set(material, shadingMode);
	}

	//==============================================================================
	// 머티리얼 셰이딩 모드 반환.
	//==============================================================================
	/**
	 * @param { Material } material
	 * @returns { number }
	 */
	getMaterialShadingMode(material) {
		const shadingMode = this.#materialShadingModes.get(material);
		return shadingMode !== undefined ? shadingMode : SKIN_SHADING_SKIN;
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

	//==============================================================================
	// 마이크로 노멀 설정. (타일링 횟수 / 강도 — 0 이면 사용 안 함)
	//==============================================================================
	/**
	 * @param { number } microTiling
	 * @param { number } microStrength
	 */
	setMicroDetail(microTiling, microStrength) {
		this.#microTiling = microTiling;
		this.#microStrength = microStrength;
	}

	//==============================================================================
	// 주름 맵 사용 설정. (마스크 아틀라스 / 주름 노멀 / 색 아틀라스가 머티리얼에 붙어 있어야 한다)
	//==============================================================================
	/**
	 * @param { boolean } useWrinkleMaps
	 * @param { number } normalStrength
	 * @param { number } colorStrength
	 */
	setWrinkleMaps(useWrinkleMaps, normalStrength, colorStrength) {
		this.#useWrinkleMaps = useWrinkleMaps;
		this.#wrinkleNormalStrength = normalStrength;
		this.#wrinkleColorStrength = colorStrength;
	}

	//==============================================================================
	// 주름 채널 가중치 설정. (채널 = 마스크 아틀라스 타일 x 4 + RGBA 순서, 값 = 주름 맵 1 / 2 / 3 기여)
	//==============================================================================
	/**
	 * @param { number } channelIndex
	 * @param { number } weight1
	 * @param { number } weight2
	 * @param { number } weight3
	 */
	setWrinkleChannelWeight(channelIndex, weight1, weight2, weight3) {
		this.#wrinkleChannelWeights[channelIndex * 3] = weight1;
		this.#wrinkleChannelWeights[channelIndex * 3 + 1] = weight2;
		this.#wrinkleChannelWeights[channelIndex * 3 + 2] = weight3;
	}

	//==============================================================================
	// 눈 파라미터 설정. (UV 단위 — 홍채 반경 / 동공 반경 / 홍채 평면 깊이)
	//==============================================================================
	/**
	 * @param { number } irisRadius
	 * @param { number } pupilRadius
	 * @param { number } irisDepth
	 */
	setEyeParameters(irisRadius, pupilRadius, irisDepth) {
		this.#eyeIrisRadius = irisRadius;
		this.#eyePupilRadius = pupilRadius;
		this.#eyeIrisDepth = irisDepth;
	}

	//==============================================================================
	// 머리카락 파라미터 설정. (1차 / 2차 로브 시프트 · 지수 · 강도, 투과 강도, 뿌리 차폐)
	//==============================================================================
	/**
	 * @param { number[] } specularShift [1차, 2차]
	 * @param { number[] } specularPower [1차, 2차]
	 * @param { number[] } specularIntensity [1차, 2차, 투과]
	 * @param { number } rootShade
	 */
	setHairParameters(specularShift, specularPower, specularIntensity, rootShade) {
		this.#hairSpecularShift = [specularShift[0], specularShift[1], 0];
		this.#hairSpecularPower = [specularPower[0], specularPower[1], 0];
		this.#hairSpecularIntensity = specularIntensity.slice(0, 3);
		this.#hairRootShade = rootShade;
	}

	//==============================================================================
	// 컷아웃 깊이 셰이더 프로그램 반환.
	//==============================================================================
	/**
	 * @returns { ShaderProgram }
	 */
	getCutoutDepthShaderProgram() {
		return this.#cutoutDepthShaderProgram;
	}
}
