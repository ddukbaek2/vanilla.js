//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";
import { ShaderProgram } from "../../core/graphic/shaderprogram.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 스키닝 버텍스 셰이더. (조인트 4개 가중 혼합 — 어트리뷰트 위치 고정)
const SKINNED_VERTEXSHADER_SOURCE = `#version 300 es
layout(location = 0) in vec3 vertexPosition;
layout(location = 1) in vec3 vertexNormal;
layout(location = 2) in vec2 vertexTextureCoordinate;
layout(location = 3) in uvec4 vertexJoints;
layout(location = 4) in vec4 vertexWeights;
uniform mat4 modelMatrix;
uniform mat4 viewProjectionMatrix;
uniform mat4 lightViewProjectionMatrix;
uniform mat4 jointMatrices[96];
out vec3 worldPosition;
out vec3 worldNormal;
out vec2 fragmentTextureCoordinate;
out vec4 lightSpacePosition;
void main() {
	mat4 skinMatrix = vertexWeights.x * jointMatrices[vertexJoints.x]
		+ vertexWeights.y * jointMatrices[vertexJoints.y]
		+ vertexWeights.z * jointMatrices[vertexJoints.z]
		+ vertexWeights.w * jointMatrices[vertexJoints.w];
	vec4 skinnedPosition = modelMatrix * skinMatrix * vec4(vertexPosition, 1.0);
	worldPosition = skinnedPosition.xyz;

	// 노멀 미보유 모델 가드. (비활성 어트리뷰트는 영벡터 — 위쪽으로 대체)
	vec3 safeNormal = dot(vertexNormal, vertexNormal) < 0.0001 ? vec3(0.0, 1.0, 0.0) : vertexNormal;
	worldNormal = normalize(mat3(modelMatrix) * mat3(skinMatrix) * safeNormal);
	fragmentTextureCoordinate = vertexTextureCoordinate;
	lightSpacePosition = lightViewProjectionMatrix * skinnedPosition;
	gl_Position = viewProjectionMatrix * skinnedPosition;
}
`;

// 스키닝 프래그먼트 셰이더. (metallic-roughness PBR + 태양/반구 라이팅 + 섀도우 맵 + 거리 안개)
// - 노멀 매핑은 화면 공간 미분 기반 코탄젠트 프레임 사용. (탄젠트 어트리뷰트 불필요)
// - FBX 스펙큘러/글로스 경로: useGlossiness=1 이면 러프니스 = 1 - 글로스, 스펙큘러 맵은 F0 변조.
const SKINNED_FRAGMENTSHADER_SOURCE = `#version 300 es
precision highp float;
in vec3 worldPosition;
in vec3 worldNormal;
in vec2 fragmentTextureCoordinate;
in vec4 lightSpacePosition;
uniform sampler2D baseColorTexture;
uniform sampler2D normalTexture;
uniform sampler2D metallicRoughnessTexture;
uniform sampler2D glossinessTexture;
uniform sampler2D occlusionTexture;
uniform sampler2D emissiveTexture;
uniform sampler2D specularTexture;
uniform sampler2D opacityTexture;
uniform vec3 baseColorFactor;
uniform float metallicFactor;
uniform float roughnessFactor;
uniform vec3 emissiveFactor;
uniform int useGlossiness;
uniform int useAlphaCutout;
uniform highp sampler2DShadow shadowMapTexture;
uniform float shadowStrength;
uniform float shadowTexelSize;
uniform vec3 sunDirection;
uniform vec3 cameraPosition;
uniform vec3 fogColor;
uniform vec2 fogRange;
out vec4 outputColor;

float sampleShadowFactor() {
	vec3 projected = lightSpacePosition.xyz / lightSpacePosition.w;
	projected = projected * 0.5 + 0.5;
	if (projected.x < 0.0 || projected.x > 1.0 || projected.y < 0.0 || projected.y > 1.0 || projected.z > 1.0) {
		return 1.0;
	}
	float shadowSum = 0.0;
	for (int offsetY = -1; offsetY <= 1; ++offsetY) {
		for (int offsetX = -1; offsetX <= 1; ++offsetX) {
			vec2 tapOffset = vec2(float(offsetX), float(offsetY)) * shadowTexelSize;
			shadowSum += texture(shadowMapTexture, vec3(projected.xy + tapOffset, projected.z - 0.0018));
		}
	}
	return shadowSum / 9.0;
}

vec3 applyNormalMap(vec3 geometryNormal) {
	vec3 tangentNormal = texture(normalTexture, fragmentTextureCoordinate).xyz * 2.0 - 1.0;
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
		return geometryNormal;
	}
	float inverseLength = inversesqrt(maxLengthSquared);
	mat3 tangentFrame = mat3(tangent * inverseLength, bitangent * inverseLength, geometryNormal);
	return normalize(tangentFrame * tangentNormal);
}

void main() {
	// 알파 컷아웃. (오파시티 맵 보유 재질 — 머리카락/속눈썹의 투명 영역 제거)
	if (useAlphaCutout == 1) {
		float opacity = texture(opacityTexture, fragmentTextureCoordinate).r;
		if (opacity < 0.5) {
			discard;
		}
	}

	vec3 albedo = texture(baseColorTexture, fragmentTextureCoordinate).rgb * baseColorFactor;
	float metallic = metallicFactor;
	float roughness = roughnessFactor;
	if (useGlossiness == 1) {
		float glossiness = texture(glossinessTexture, fragmentTextureCoordinate).r;
		roughness = clamp(roughnessFactor * (1.0 - glossiness), 0.045, 1.0);
	}
	else {
		vec4 metallicRoughnessSample = texture(metallicRoughnessTexture, fragmentTextureCoordinate);
		roughness = clamp(roughnessFactor * metallicRoughnessSample.g, 0.045, 1.0);
		metallic = metallicFactor * metallicRoughnessSample.b;
	}
	float occlusion = texture(occlusionTexture, fragmentTextureCoordinate).r;
	vec3 emissive = texture(emissiveTexture, fragmentTextureCoordinate).rgb * emissiveFactor;
	vec3 specularTint = texture(specularTexture, fragmentTextureCoordinate).rgb;

	vec3 geometryNormal = normalize(worldNormal);
	vec3 viewDirection = normalize(cameraPosition - worldPosition);
	if (dot(geometryNormal, viewDirection) < 0.0) {
		geometryNormal = -geometryNormal;
	}
	vec3 surfaceNormal = applyNormalMap(geometryNormal);

	float shadowFactor = 1.0;
	if (shadowStrength > 0.001) {
		shadowFactor = mix(1.0, sampleShadowFactor(), shadowStrength);
	}

	// 쿡-토런스 GGX 직접광. (태양)
	vec3 lightDirection = normalize(sunDirection);
	vec3 halfVector = normalize(viewDirection + lightDirection);
	float normalDotLight = max(dot(surfaceNormal, lightDirection), 0.0);
	float normalDotView = max(dot(surfaceNormal, viewDirection), 0.0001);
	float normalDotHalf = max(dot(surfaceNormal, halfVector), 0.0);
	float viewDotHalf = max(dot(viewDirection, halfVector), 0.0);
	float alpha = roughness * roughness;
	float alphaSquared = alpha * alpha;
	float distributionDenominator = normalDotHalf * normalDotHalf * (alphaSquared - 1.0) + 1.0;
	float distribution = alphaSquared / (3.14159265 * distributionDenominator * distributionDenominator);
	float geometryK = alpha * 0.5;
	float geometryTerm = (normalDotLight / (normalDotLight * (1.0 - geometryK) + geometryK)) * (normalDotView / (normalDotView * (1.0 - geometryK) + geometryK));
	vec3 fresnelBase = mix(vec3(0.04) * specularTint, albedo, metallic);
	vec3 fresnel = fresnelBase + (vec3(1.0) - fresnelBase) * pow(1.0 - viewDotHalf, 5.0);
	vec3 specular = fresnel * (distribution * geometryTerm / max(4.0 * normalDotView * normalDotLight, 0.0001));
	vec3 diffuse = albedo * (1.0 - metallic) * (vec3(1.0) - fresnel) / 3.14159265;
	vec3 sunColor = vec3(1.15, 1.05, 0.9) * 3.14159265;
	vec3 directLight = (diffuse + specular) * sunColor * normalDotLight * shadowFactor;

	// 반구 앰비언트 + 이미시브.
	vec3 skyAmbient = mix(vec3(0.3, 0.33, 0.36), vec3(0.52, 0.58, 0.66), surfaceNormal.y * 0.5 + 0.5);
	vec3 ambientLight = albedo * skyAmbient * (0.6 + 0.4 * shadowFactor) * occlusion;
	vec3 color = directLight + ambientLight + emissive;
	float viewDistance = distance(cameraPosition, worldPosition);
	float fogBlend = smoothstep(fogRange.x, fogRange.y, viewDistance);
	color = mix(color, fogColor, fogBlend);
	outputColor = vec4(color, 1.0);
}
`;

// 깊이 전용 스키닝 버텍스 셰이더. (섀도우 맵 캐스팅)
const SKINNED_DEPTH_VERTEXSHADER_SOURCE = `#version 300 es
layout(location = 0) in vec3 vertexPosition;
layout(location = 3) in uvec4 vertexJoints;
layout(location = 4) in vec4 vertexWeights;
uniform mat4 modelMatrix;
uniform mat4 lightViewProjectionMatrix;
uniform mat4 jointMatrices[96];
void main() {
	mat4 skinMatrix = vertexWeights.x * jointMatrices[vertexJoints.x]
		+ vertexWeights.y * jointMatrices[vertexJoints.y]
		+ vertexWeights.z * jointMatrices[vertexJoints.z]
		+ vertexWeights.w * jointMatrices[vertexJoints.w];
	gl_Position = lightViewProjectionMatrix * modelMatrix * skinMatrix * vec4(vertexPosition, 1.0);
}
`;

// 깊이 전용 프래그먼트 셰이더.
const SKINNED_DEPTH_FRAGMENTSHADER_SOURCE = `#version 300 es
precision highp float;
void main() {
}
`;


//==============================================================================
// 스킨드 모델 렌더러. (스키닝 PBR 셰이더 템플릿 + 환경 상태 소유 — 씬당 하나)
// - SkinnedModel 은 데이터/포즈만 갖고, 렌더링은 이 객체가 모델 인스턴스를 받아 수행한다.
// - 환경 상태(섀도우 맵 / 태양 / 안개)는 모델이 아닌 렌더러에 설정한다.
//==============================================================================
export class SkinnedModelRenderer extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { ShaderProgram } */ #shaderProgram;
	/** @private @type { ShaderProgram } */ #depthShaderProgram;
	/** @private @type { WebGLTexture | null } */ #shadowMapTexture;
	/** @private @type { Float32Array | null } */ #lightViewProjectionElements;
	/** @private @type { number } */ #shadowStrength;
	/** @private @type { number } */ #shadowTexelSize;
	/** @private @type { number[] } */ #sunDirection;
	/** @private @type { number[] } */ #fogColor;
	/** @private @type { number[] } */ #fogRange;

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
		this.#shaderProgram = new ShaderProgram(webGL2RenderingContext, SKINNED_VERTEXSHADER_SOURCE.trim(), SKINNED_FRAGMENTSHADER_SOURCE.trim());
		this.#depthShaderProgram = new ShaderProgram(webGL2RenderingContext, SKINNED_DEPTH_VERTEXSHADER_SOURCE.trim(), SKINNED_DEPTH_FRAGMENTSHADER_SOURCE.trim());
		this.#shadowMapTexture = null;
		this.#lightViewProjectionElements = null;
		this.#shadowStrength = 0;
		this.#shadowTexelSize = 1 / 2048;
		this.#sunDirection = [0, 1, 0];
		this.#fogColor = [0.8, 0.85, 0.92];
		this.#fogRange = [55, 250];
	}

	//==============================================================================
	// 출력. (모델 인스턴스의 드로어블 순회 — 머티리얼 적용 + 조인트 행렬 업로드)
	//==============================================================================
	/**
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
		const viewProjectionLocation = shaderProgram.getUniformLocation("viewProjectionMatrix");
		webGL2RenderingContext.uniformMatrix4fv(viewProjectionLocation, false, viewProjectionElements);
		const modelMatrixLocation = shaderProgram.getUniformLocation("modelMatrix");
		webGL2RenderingContext.uniformMatrix4fv(modelMatrixLocation, false, modelMatrixElements);
		const sunDirectionLocation = shaderProgram.getUniformLocation("sunDirection");
		webGL2RenderingContext.uniform3f(sunDirectionLocation, this.#sunDirection[0], this.#sunDirection[1], this.#sunDirection[2]);
		const cameraPositionLocation = shaderProgram.getUniformLocation("cameraPosition");
		webGL2RenderingContext.uniform3f(cameraPositionLocation, cameraX, cameraY, cameraZ);
		const fogColorLocation = shaderProgram.getUniformLocation("fogColor");
		webGL2RenderingContext.uniform3f(fogColorLocation, this.#fogColor[0], this.#fogColor[1], this.#fogColor[2]);
		const fogRangeLocation = shaderProgram.getUniformLocation("fogRange");
		webGL2RenderingContext.uniform2f(fogRangeLocation, this.#fogRange[0], this.#fogRange[1]);

		// 섀도우 맵 수신. (섀도우 샘플러 타입 불일치로 드로우가 무효화되지 않도록 강도와 무관하게 항상 바인드)
		const shadowStrengthLocation = shaderProgram.getUniformLocation("shadowStrength");
		if (this.#shadowMapTexture && this.#lightViewProjectionElements) {
			const lightViewProjectionLocation = shaderProgram.getUniformLocation("lightViewProjectionMatrix");
			webGL2RenderingContext.uniformMatrix4fv(lightViewProjectionLocation, false, this.#lightViewProjectionElements);
			const shadowMapTextureLocation = shaderProgram.getUniformLocation("shadowMapTexture");
			webGL2RenderingContext.uniform1i(shadowMapTextureLocation, 1);
			const shadowTexelSizeLocation = shaderProgram.getUniformLocation("shadowTexelSize");
			webGL2RenderingContext.uniform1f(shadowTexelSizeLocation, this.#shadowTexelSize);
			webGL2RenderingContext.uniform1f(shadowStrengthLocation, this.#shadowStrength);
			webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE1);
			webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, this.#shadowMapTexture);
			webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		}
		else {
			const shadowMapTextureLocation = shaderProgram.getUniformLocation("shadowMapTexture");
			webGL2RenderingContext.uniform1i(shadowMapTextureLocation, 1);
			webGL2RenderingContext.uniform1f(shadowStrengthLocation, 0);
		}

		const jointMatricesLocation = shaderProgram.getUniformLocation("jointMatrices[0]");
		const skinList = skinnedModel.getSkinList();
		const drawableList = skinnedModel.getDrawableList();
		for (const drawable of drawableList) {
			const skin = skinList[drawable.skinIndex];
			webGL2RenderingContext.uniformMatrix4fv(jointMatricesLocation, false, skin.jointMatrixArray);
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
	// 깊이 패스 출력. (섀도우 맵 캐스팅 — ShadowMap.beginRender() 이후 호출)
	//==============================================================================
	/**
	 * @param { SkinnedModel } skinnedModel
	 * @param { Float32Array } lightViewProjectionElements
	 * @param { Float32Array } modelMatrixElements
	 */
	drawDepth(skinnedModel, lightViewProjectionElements, modelMatrixElements) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const depthShaderProgram = this.getDepthShaderProgram();
		depthShaderProgram.use();
		const lightViewProjectionLocation = depthShaderProgram.getUniformLocation("lightViewProjectionMatrix");
		webGL2RenderingContext.uniformMatrix4fv(lightViewProjectionLocation, false, lightViewProjectionElements);
		const modelMatrixLocation = depthShaderProgram.getUniformLocation("modelMatrix");
		webGL2RenderingContext.uniformMatrix4fv(modelMatrixLocation, false, modelMatrixElements);
		const jointMatricesLocation = depthShaderProgram.getUniformLocation("jointMatrices[0]");
		const skinList = skinnedModel.getSkinList();
		const drawableList = skinnedModel.getDrawableList();
		for (const drawable of drawableList) {
			const skin = skinList[drawable.skinIndex];
			webGL2RenderingContext.uniformMatrix4fv(jointMatricesLocation, false, skin.jointMatrixArray);
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
	// 섀도우 맵 설정. (본 패스에서 그림자 수신)
	//==============================================================================
	/**
	 * @param { WebGLTexture | null } shadowMapTexture
	 * @param { Float32Array | null } lightViewProjectionElements
	 * @param { number } texelSize
	 */
	setShadowMap(shadowMapTexture, lightViewProjectionElements, texelSize) {
		this.#shadowMapTexture = shadowMapTexture;
		this.#lightViewProjectionElements = lightViewProjectionElements;
		this.#shadowTexelSize = texelSize;
	}

	//==============================================================================
	// 그림자 강도 설정. (0 = 수신 안 함)
	//==============================================================================
	/**
	 * @param { number } shadowStrength
	 */
	setShadowStrength(shadowStrength) {
		this.#shadowStrength = shadowStrength;
	}

	//==============================================================================
	// 태양 방향 설정.
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @param { number } z
	 */
	setSunDirection(x, y, z) {
		this.#sunDirection = [x, y, z];
	}

	//==============================================================================
	// 안개 색 설정.
	//==============================================================================
	/**
	 * @param { number } red
	 * @param { number } green
	 * @param { number } blue
	 */
	setFogColor(red, green, blue) {
		this.#fogColor = [red, green, blue];
	}

	//==============================================================================
	// 안개 거리 범위 설정.
	//==============================================================================
	/**
	 * @param { number } startDistance
	 * @param { number } endDistance
	 */
	setFogRange(startDistance, endDistance) {
		this.#fogRange = [startDistance, endDistance];
	}

	//==============================================================================
	// 셰이더 프로그램 반환. (스키닝 PBR 템플릿)
	//==============================================================================
	/**
	 * @returns { ShaderProgram }
	 */
	getShaderProgram() {
		return this.#shaderProgram;
	}

	//==============================================================================
	// 깊이 셰이더 프로그램 반환.
	//==============================================================================
	/**
	 * @returns { ShaderProgram }
	 */
	getDepthShaderProgram() {
		return this.#depthShaderProgram;
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
}
