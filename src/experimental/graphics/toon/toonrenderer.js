//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Matrix4 } from "../../../base/matrix4.js";
import { ShaderProgram } from "../../../core/graphic/shaderprogram.js";
import { VERTEX_FLOAT_COUNT, SKIN_FLOAT_COUNT } from "./meshbuilder.js";
import { ToonLightSet, TOON_MAXIMUM_POINT_LIGHTS, TOON_MAXIMUM_BAND_STEPS } from "./toonlightset.js";
import { ToonMaterial, ToonInstanceLayout, ToonBlendMode, ToonBufferUsage, TOON_INSTANCE_MATRIX_NAME, TOON_INSTANCE_TINT_NAME } from "./toonmaterial.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 한 모형이 쓰는 뼈대 수의 상한. (셰이더의 유니폼 배열 크기, 엔진 SkinnedModelRenderer 와 같은 96)
export const TOON_MAXIMUM_JOINTS = 96;

// 인스턴스 하나의 수 개수. (행렬 16, 틴트 4)
export const TOON_INSTANCE_FLOAT_COUNT = 20;

// 텍스처 유닛. (그림자, 바탕색, 빛남, 데칼, 머티리얼 텍스처는 7 부터 15 까지)
const SHADOW_TEXTURE_UNIT = 3;
const BASE_COLOR_TEXTURE_UNIT = 4;
const EMISSIVE_TEXTURE_UNIT = 5;
const DECAL_TEXTURE_UNIT = 6;
const FIRST_MATERIAL_TEXTURE_UNIT = 7;

// 머티리얼이 그리기마다 묶을 수 있는 텍스처 수의 상한. (유닛 7 ~ 15)
export const TOON_MAXIMUM_MATERIAL_TEXTURES = 9;

// 어트리뷰트 자리. (모든 프로그램이 같은 자리를 쓴다, 인스턴스 꼴의 사용자 어트리뷰트는 13 부터)
export const TOON_ATTRIBUTE_LOCATIONS = System.Object.freeze({
	vertexPosition: 0,
	vertexNormal: 1,
	vertexColor: 2,
	vertexMaterial: 3,
	vertexDetail: 4,
	vertexJoints: 5,
	vertexWeights: 6,
	instanceMatrix0: 7,
	instanceMatrix1: 8,
	instanceMatrix2: 9,
	instanceMatrix3: 10,
	instanceTint: 11,
	vertexUv: 12,
});

// 그리기의 프로그램 종류. (onBeforeDraw 의 셋째 인자)
export const ToonProgramKind = System.Object.freeze({
	solid: "solid",
	outline: "outline",
	depth: "depth",
});

// 세 정점 셰이더의 머리. (몸에만 있는 어트리뷰트도 모두 적는다, 바깥선 버텍스 어레이에 없는 것은 기본값으로 읽힘)
const VERTEX_HEAD_CHUNK = `#version 300 es
in vec3 vertexPosition;
in vec3 vertexNormal;
in vec3 vertexColor;
in vec2 vertexMaterial;
in vec4 vertexDetail;
in vec2 vertexUv;
`;

// 꼭짓점을 본으로 움직이고 인스턴스 행렬을 고르는 셰이더 조각.
// - instanced: 0 이면 인스턴스 아님, 1 이면 인스턴스 행렬과 틴트, 2 면 인스턴스 틴트만(모형 행렬은 유니폼).
const VERTEX_COMMON_CHUNK = `in vec4 vertexJoints;
in vec4 vertexWeights;
in vec4 instanceMatrix0;
in vec4 instanceMatrix1;
in vec4 instanceMatrix2;
in vec4 instanceMatrix3;
in vec4 instanceTint;
uniform mat4 jointMatrices[96];
uniform float skinned;
uniform float instanced;
uniform mat4 viewProjectionMatrix;
uniform mat4 modelMatrix;
mat4 readSkinMatrix() {
	if (skinned < 0.5) {
		return mat4(1.0);
	}
	return jointMatrices[int(vertexJoints.x)] * vertexWeights.x + jointMatrices[int(vertexJoints.y)] * vertexWeights.y + jointMatrices[int(vertexJoints.z)] * vertexWeights.z + jointMatrices[int(vertexJoints.w)] * vertexWeights.w;
}
mat4 readModelMatrix() {
	if (instanced < 0.5 || instanced > 1.5) {
		return modelMatrix;
	}
	return mat4(instanceMatrix0, instanceMatrix1, instanceMatrix2, instanceMatrix3);
}
vec4 readInstanceTint() {
	if (instanced < 0.5) {
		return vec4(1.0);
	}
	return instanceTint;
}
`;

// 정점 조각이 고칠 꼭짓점. (월드로 옮기기 전)
const VERTEX_STRUCT_CHUNK = `struct ToonVertex {
	vec3 localPosition;
	vec3 localNormal;
	vec3 color;
	vec2 material;
	vec4 detail;
	vec2 uv;
	vec4 tint;
	mat4 modelMatrix;
};
ToonVertex readVertex() {
	ToonVertex vertex;
	vertex.localPosition = vertexPosition;
	vertex.localNormal = vertexNormal;
	vertex.color = vertexColor;
	vertex.material = vertexMaterial;
	vertex.detail = vertexDetail;
	vertex.uv = vertexUv;
	vertex.tint = readInstanceTint();
	vertex.modelMatrix = readModelMatrix();
	return vertex;
}
`;

// 머티리얼에 조각이 없을 때의 빈 함수.
const DEFAULT_VERTEX_CHUNK = `void applyVertex(inout ToonVertex vertex) {
}
`;
const DEFAULT_SURFACE_CHUNK = `void applySurface(inout ToonSurface surface) {
}
`;
const DEFAULT_LIGHT_CHUNK = `void applyLight(ToonSurface surface, inout ToonLighting lighting) {
}
`;

// 몸을 그리는 정점 셰이더의 몸통.
const SOLID_VERTEX_BODY = `uniform mat4 lightViewProjectionMatrix;
out vec3 worldPosition;
out vec3 localPosition;
out vec3 worldNormal;
out vec3 surfaceColor;
out vec2 surfaceMaterial;
out vec4 surfaceDetail;
out vec2 surfaceUv;
out vec4 surfaceTint;
out vec4 lightSpacePosition;
void main() {
	ToonVertex vertex = readVertex();
	applyVertex(vertex);
	mat4 skinMatrix = readSkinMatrix();
	mat4 objectMatrix = vertex.modelMatrix;
	vec4 position = objectMatrix * skinMatrix * vec4(vertex.localPosition, 1.0);
	worldPosition = position.xyz;
	localPosition = vertex.localPosition;
	worldNormal = normalize(mat3(objectMatrix) * mat3(skinMatrix) * vertex.localNormal);
	surfaceColor = vertex.color;
	surfaceMaterial = vertex.material;
	surfaceDetail = vertex.detail;
	surfaceUv = vertex.uv;
	surfaceTint = vertex.tint;
	lightSpacePosition = lightViewProjectionMatrix * vec4(position.xyz + worldNormal * 0.02, 1.0);
	gl_Position = viewProjectionMatrix * position;
}
`;

// 몸을 그리는 조각 셰이더의 머리. (유니폼, 표면과 빛 구조, 공용 함수)
const SOLID_FRAGMENT_HEAD = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 worldPosition;
in vec3 localPosition;
in vec3 worldNormal;
in vec3 surfaceColor;
in vec2 surfaceMaterial;
in vec4 surfaceDetail;
in vec2 surfaceUv;
in vec4 surfaceTint;
in vec4 lightSpacePosition;
uniform vec3 sunDirection;
uniform vec3 sunColor;
uniform vec3 skyColor;
uniform vec3 groundColor;
uniform vec3 fillDirection;
uniform vec3 fillColor;
uniform vec4 rimLight;
uniform vec2 specularLight;
uniform float energyNormalized;
uniform float bandCount;
uniform int bandRampCount;
uniform float bandRampHalfLambert;
uniform float bandRampThresholds[7];
uniform float bandRampValues[8];
uniform int pointLightCount;
uniform vec4 pointLightPositions[8];
uniform vec3 pointLightColors[8];
uniform vec3 pointLightShapes[8];
uniform vec4 cameraPosition;
uniform vec3 cameraForward;
uniform vec4 tintColor;
uniform float tintAmount;
uniform float alpha;
uniform float glowScale;
uniform float colorScale;
uniform vec4 emissiveColor;
uniform float softEdge;
uniform float alphaCutoff;
uniform float premultipliedOutput;
uniform float hdrOutput;
uniform vec3 textureEnabled;
uniform sampler2D baseColorTexture;
uniform sampler2D emissiveTexture;
uniform sampler2D decalTexture;
uniform vec4 uvTransform;
uniform vec4 decalUvTransform;
uniform vec4 decalColor;
uniform float shadowEnabled;
uniform float shadowStrength;
uniform float shadowTexelSize;
uniform sampler2DShadow shadowTexture;
out vec4 fragmentColor;
const float RECIPROCAL_PI = 0.3183098862;
struct ToonSurface {
	vec3 baseColor;
	float alpha;
	vec3 emission;
	vec3 normal;
	float glow;
	bool isUnlit;
	vec4 detail;
	vec2 uv;
	vec3 localPosition;
	vec3 worldPosition;
	vec3 viewDirection;
};
struct ToonLighting {
	vec3 irradiance;
	vec3 specular;
	float shadow;
};
vec3 toLinear(vec3 color) {
	return pow(color, vec3(2.2));
}
vec3 toOutput(vec3 color) {
	if (hdrOutput > 0.5) {
		return max(color, vec3(0.0));
	}
	return pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2));
}
float readShadow() {
	if (shadowEnabled < 0.5) {
		return 1.0;
	}
	vec3 projected = lightSpacePosition.xyz / lightSpacePosition.w * 0.5 + 0.5;
	if (projected.x < 0.0 || projected.x > 1.0 || projected.y < 0.0 || projected.y > 1.0 || projected.z > 1.0) {
		return 1.0;
	}
	float lit = 0.0;
	for (int offsetY = -1; offsetY <= 1; ++offsetY) {
		for (int offsetX = -1; offsetX <= 1; ++offsetX) {
			lit += texture(shadowTexture, vec3(projected.xy + vec2(float(offsetX), float(offsetY)) * shadowTexelSize, projected.z - 0.0015));
		}
	}
	return mix(1.0, lit / 9.0, shadowStrength);
}
float readBandRamp(float cosine) {
	float coordinate = bandRampHalfLambert > 0.5 ? cosine * 0.5 + 0.5 : max(cosine, 0.0);
	for (int index = 0; index < 7; ++index) {
		if (index >= bandRampCount - 1) {
			break;
		}
		if (coordinate < bandRampThresholds[index]) {
			return bandRampValues[index];
		}
	}
	return bandRampValues[max(bandRampCount - 1, 0)];
}
float readDirectFacing(float cosine) {
	if (bandRampCount > 0) {
		return readBandRamp(cosine);
	}
	float facing = max(cosine, 0.0);
	if (bandCount > 0.5) {
		facing = floor(facing * bandCount + 0.5) / bandCount;
	}
	return facing;
}
vec3 readViewDirection() {
	if (cameraPosition.w > 0.5) {
		return normalize(cameraPosition.xyz - worldPosition);
	}
	return -cameraForward;
}
`;

// 몸을 그리는 조각 셰이더의 몸통. (표면 → 표면 조각 → 틴트 → 빛 → 빛 조각 → 합치기)
const SOLID_FRAGMENT_BODY = `ToonSurface readSurface() {
	ToonSurface surface;
	vec3 color = surfaceColor * surfaceTint.rgb;
	float opacity = alpha * tintColor.a * surfaceTint.a;
	vec2 uv = surfaceUv * uvTransform.zw + uvTransform.xy;
	if (textureEnabled.x > 0.5) {
		vec4 texel = texture(baseColorTexture, uv);
		color *= texel.rgb;
		opacity *= texel.a;
	}
	vec3 emission = toLinear(emissiveColor.rgb) * emissiveColor.a;
	if (textureEnabled.y > 0.5) {
		emission *= toLinear(texture(emissiveTexture, uv).rgb);
	}
	if (textureEnabled.z > 0.5) {
		vec4 decal = texture(decalTexture, surfaceUv * decalUvTransform.zw + decalUvTransform.xy);
		vec3 decalTint = decal.rgb * decalColor.rgb;
		color = mix(color, decalTint, decal.a);
		emission += toLinear(decalTint) * decal.a * decalColor.a;
	}
	surface.baseColor = color;
	surface.alpha = opacity;
	surface.emission = emission;
	surface.normal = normalize(worldNormal);
	surface.glow = surfaceMaterial.x;
	surface.isUnlit = surfaceMaterial.y > 0.5;
	surface.detail = surfaceDetail;
	surface.uv = surfaceUv;
	surface.localPosition = localPosition;
	surface.worldPosition = worldPosition;
	surface.viewDirection = readViewDirection();
	return surface;
}
ToonLighting readLighting(ToonSurface surface) {
	ToonLighting lighting;
	vec3 normal = surface.normal;
	float shadow = readShadow();
	vec3 toSun = -normalize(sunDirection);
	float sunCosine = dot(normal, toSun);
	float sunFacing;
	if (bandRampCount > 0) {
		sunFacing = readBandRamp(sunCosine) * shadow;
	}
	else {
		sunFacing = max(sunCosine, 0.0) * shadow;
		if (bandCount > 0.5) {
			sunFacing = floor(sunFacing * bandCount + 0.5) / bandCount;
		}
	}
	vec3 irradiance = sunColor * sunFacing + mix(groundColor, skyColor, normal.y * 0.5 + 0.5);
	irradiance += fillColor * max(dot(normal, -normalize(fillDirection)), 0.0);
	if (rimLight.a > 0.0) {
		irradiance += rimLight.rgb * pow(1.0 - clamp(dot(normal, surface.viewDirection), 0.0, 1.0), rimLight.a);
	}
	for (int index = 0; index < 8; ++index) {
		if (index >= pointLightCount) {
			break;
		}
		vec3 toLight = pointLightPositions[index].xyz - surface.worldPosition;
		float lightDistance = length(toLight);
		float lightRange = pointLightPositions[index].w;
		vec3 shape = pointLightShapes[index];
		float window = 1.0;
		if (lightRange > 0.0) {
			window = clamp(1.0 - pow(lightDistance / lightRange, shape.y), 0.0, 1.0);
			window *= window;
		}
		float falloff = shape.x > 0.0 ? window / max(pow(lightDistance, shape.x), 0.01) : window;
		float cosine = dot(normal, toLight / max(lightDistance, 0.0001));
		irradiance += pointLightColors[index] * readDirectFacing((cosine + shape.z) / (1.0 + shape.z)) * falloff;
	}
	lighting.irradiance = irradiance;
	lighting.specular = vec3(0.0);
	if (specularLight.x > 0.0) {
		vec3 halfway = normalize(toSun + surface.viewDirection);
		float specularNormalization = energyNormalized > 0.5 ? (specularLight.y + 8.0) * RECIPROCAL_PI / 8.0 : 1.0;
		lighting.specular = sunColor * pow(max(dot(normal, halfway), 0.0), specularLight.y) * specularLight.x * specularNormalization * shadow;
	}
	lighting.shadow = shadow;
	return lighting;
}
void main() {
	ToonSurface surface = readSurface();
	applySurface(surface);
	if (alphaCutoff > 0.0 && surface.alpha < alphaCutoff) {
		discard;
	}
	vec3 tintedColor = tintAmount < 0.0 ? surface.baseColor * tintColor.rgb : mix(surface.baseColor, tintColor.rgb, tintAmount);
	vec3 albedo = toLinear(tintedColor);
	vec3 emission = surface.emission + albedo * surface.glow * glowScale;
	vec3 color;
	if (surface.isUnlit) {
		color = albedo + emission;
	}
	else {
		ToonLighting lighting = readLighting(surface);
		applyLight(surface, lighting);
		float diffuseScale = energyNormalized > 0.5 ? RECIPROCAL_PI : 1.0;
		color = albedo * lighting.irradiance * diffuseScale + lighting.specular + emission;
	}
	float opacity = surface.alpha;
	if (softEdge > 0.0) {
		opacity *= pow(abs(dot(surface.normal, surface.viewDirection)), softEdge);
	}
	vec3 outputColor = toOutput(color * colorScale);
	if (premultipliedOutput > 0.5) {
		outputColor *= opacity;
	}
	fragmentColor = vec4(outputColor, opacity);
}
`;

// 바깥선 껍데기를 그리는 셰이더. (껍데기는 뒷면만 그려 몸 둘레에 테로 보인다)
const OUTLINE_VERTEX_BODY = `out float outlineTint;
void main() {
	ToonVertex vertex = readVertex();
	applyVertex(vertex);
	mat4 skinMatrix = readSkinMatrix();
	outlineTint = vertex.tint.a;
	gl_Position = viewProjectionMatrix * vertex.modelMatrix * skinMatrix * vec4(vertex.localPosition, 1.0);
}
`;
const OUTLINE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in float outlineTint;
uniform vec4 outlineColor;
uniform float alpha;
uniform float hdrOutput;
uniform float premultipliedOutput;
out vec4 fragmentColor;
void main() {
	vec3 color = hdrOutput > 0.5 ? pow(outlineColor.rgb, vec3(2.2)) : outlineColor.rgb;
	float outputAlpha = outlineColor.a * alpha * outlineTint;
	if (premultipliedOutput > 0.5) {
		color *= outputAlpha;
	}
	fragmentColor = vec4(color, outputAlpha);
}
`;

// 그림자 깊이를 그리는 셰이더.
const DEPTH_VERTEX_BODY = `void main() {
	ToonVertex vertex = readVertex();
	applyVertex(vertex);
	gl_Position = viewProjectionMatrix * vertex.modelMatrix * readSkinMatrix() * vec4(vertex.localPosition, 1.0);
}
`;
const DEPTH_FRAGMENT_SHADER = `#version 300 es
precision highp float;
void main() {
}
`;


//==============================================================================
// 머티리얼과 인스턴스 꼴로 세 프로그램의 소스 짓기. (둘 다 null 이면 기본 프로그램)
//==============================================================================
/**
 * @param { ToonMaterial | null } material
 * @param { ToonInstanceLayout | null } instanceLayout
 * @returns { object } { solidVertexShader, solidFragmentShader, outlineVertexShader, outlineFragmentShader, depthVertexShader, depthFragmentShader, attributeLocationTable }
 */
export function composeToonProgramSources(material, instanceLayout) {
	const vertexChunk = material !== null && material.getVertexChunk() !== "" ? material.getVertexChunk() : DEFAULT_VERTEX_CHUNK;
	const uniformChunk = material !== null ? material.getUniformChunk() : "";
	const surfaceChunk = material !== null && material.getSurfaceChunk() !== "" ? material.getSurfaceChunk() : DEFAULT_SURFACE_CHUNK;
	const lightChunk = material !== null && material.getLightChunk() !== "" ? material.getLightChunk() : DEFAULT_LIGHT_CHUNK;
	const instanceChunk = instanceLayout !== null ? instanceLayout.readDeclarationSource() : "";
	const vertexHead = VERTEX_HEAD_CHUNK + VERTEX_COMMON_CHUNK + instanceChunk + VERTEX_STRUCT_CHUNK + vertexChunk;
	const attributeLocationTable = System.Object.assign({}, TOON_ATTRIBUTE_LOCATIONS);
	if (instanceLayout !== null) {
		for (const attribute of instanceLayout.getAttributes()) {
			if (attribute.location >= 0) {
				attributeLocationTable[attribute.name] = attribute.location;
			}
		}
	}
	return {
		solidVertexShader: vertexHead + SOLID_VERTEX_BODY,
		solidFragmentShader: SOLID_FRAGMENT_HEAD + uniformChunk + surfaceChunk + lightChunk + SOLID_FRAGMENT_BODY,
		outlineVertexShader: vertexHead + OUTLINE_VERTEX_BODY,
		outlineFragmentShader: OUTLINE_FRAGMENT_SHADER,
		depthVertexShader: vertexHead + DEPTH_VERTEX_BODY,
		depthFragmentShader: DEPTH_FRAGMENT_SHADER,
		attributeLocationTable: attributeLocationTable,
	};
}


//==============================================================================
// 보기와 투영 행렬에서 절두체의 면 여섯. (ax + by + cz + d >= 0 이 안쪽, 정규화)
//==============================================================================
/**
 * @param { Matrix4 } matrix
 * @returns { Array<Array<number>> }
 */
export function extractFrustumPlanes(matrix) {
	const elements = matrix.getElements();
	const readRow = (rowIndex) => {
		return [elements[rowIndex], elements[4 + rowIndex], elements[8 + rowIndex], elements[12 + rowIndex]];
	};
	const row0 = readRow(0);
	const row1 = readRow(1);
	const row2 = readRow(2);
	const row3 = readRow(3);
	const combine = (first, second, sign) => {
		return [first[0] + second[0] * sign, first[1] + second[1] * sign, first[2] + second[2] * sign, first[3] + second[3] * sign];
	};
	const planes = [combine(row3, row0, 1), combine(row3, row0, -1), combine(row3, row1, 1), combine(row3, row1, -1), combine(row3, row2, 1), combine(row3, row2, -1)];
	for (const plane of planes) {
		const length = System.Math.hypot(plane[0], plane[1], plane[2]);
		if (length > 0) {
			plane[0] /= length;
			plane[1] /= length;
			plane[2] /= length;
			plane[3] /= length;
		}
	}
	return planes;
}


//==============================================================================
// 세 벡터를 행으로 둔 3x3 의 행렬식.
//==============================================================================
/**
 * @param { ArrayLike<number> } first
 * @param { ArrayLike<number> } second
 * @param { ArrayLike<number> } third
 * @returns { number }
 */
function readDeterminant(first, second, third) {
	return first[0] * (second[1] * third[2] - second[2] * third[1]) - first[1] * (second[0] * third[2] - second[2] * third[0]) + first[2] * (second[0] * third[1] - second[1] * third[0]);
}


//==============================================================================
// 모형 행렬 왼쪽 위 3x3 의 행렬식. (음수면 거울에 비친 행렬, 감기가 뒤집힌다)
//==============================================================================
/**
 * @param { ArrayLike<number> } elements Matrix4 의 수. (열 차례)
 * @returns { number }
 */
export function readMatrixDeterminant(elements) {
	return readDeterminant([elements[0], elements[1], elements[2]], [elements[4], elements[5], elements[6]], [elements[8], elements[9], elements[10]]);
}


//==============================================================================
// 보기와 투영 행렬에서 카메라 읽기. (원근이면 눈의 자리, 직교면 보는 방향, 행렬이 거울에 비친 것인지)
// - 원근: 클립 x, y, w 가 모두 0 이 되는 점이 눈이다. (행 0, 1, 3 의 연립 방정식)
// - 직교: 행 3 의 xyz 가 0 이라 눈이 무한히 멀다. 보는 방향은 행 0, 1 의 외적을 깊이가 느는 쪽으로 둔다.
// - 보통의 투영(가까운 면 < 먼 면)은 왼쪽 위 3x3 의 행렬식이 음수다. 양수면 보기 행렬이 거울에 비친 것이다.
//==============================================================================
/**
 * @param { ArrayLike<number> } elements
 * @returns { object } { position [x, y, z, w(1 원근, 0 직교)], forward [x, y, z], isMirrored }
 */
export function readFrameCamera(elements) {
	const readRow = (rowIndex) => {
		return [elements[rowIndex], elements[4 + rowIndex], elements[8 + rowIndex], elements[12 + rowIndex]];
	};
	const row0 = readRow(0);
	const row1 = readRow(1);
	const row2 = readRow(2);
	const row3 = readRow(3);
	const isMirrored = readDeterminant(row0, row1, row2) > 0;
	let forward = [row0[1] * row1[2] - row0[2] * row1[1], row0[2] * row1[0] - row0[0] * row1[2], row0[0] * row1[1] - row0[1] * row1[0]];
	const forwardLength = System.Math.hypot(forward[0], forward[1], forward[2]);
	if (forwardLength > 0) {
		forward = [forward[0] / forwardLength, forward[1] / forwardLength, forward[2] / forwardLength];
	}
	if (forward[0] * row2[0] + forward[1] * row2[1] + forward[2] * row2[2] < 0) {
		forward = [-forward[0], -forward[1], -forward[2]];
	}
	const determinant = readDeterminant(row0, row1, row3);
	if (System.Math.abs(determinant) < 1e-12) {
		return { position: [0, 0, 0, 0], forward: forward, isMirrored: isMirrored };
	}
	const constant = [-row0[3], -row1[3], -row3[3]];
	const positionX = readDeterminant([constant[0], row0[1], row0[2]], [constant[1], row1[1], row1[2]], [constant[2], row3[1], row3[2]]) / determinant;
	const positionY = readDeterminant([row0[0], constant[0], row0[2]], [row1[0], constant[1], row1[2]], [row3[0], constant[2], row3[2]]) / determinant;
	const positionZ = readDeterminant([row0[0], row0[1], constant[0]], [row1[0], row1[1], constant[1]], [row3[0], row3[1], constant[2]]) / determinant;
	return { position: [positionX, positionY, positionZ, 1], forward: forward, isMirrored: isMirrored };
}


//==============================================================================
// 평면에 비친 행렬 짓기. (평면 위 한 점과 노멀, 평면 거울의 모형이나 보기 행렬에 곱한다)
// - 비친 행렬로 그리면 감기가 뒤집힌다. ToonRenderer 는 모형 행렬의 행렬식이 음수면 스스로 앞면을 뒤집는다. (options.isMirrored 로 정할 수도 있다)
//==============================================================================
/**
 * @param { Array<number> } planePoint [x, y, z]
 * @param { Array<number> } planeNormal [x, y, z]
 * @returns { Matrix4 }
 */
export function createReflectionMatrix(planePoint, planeNormal) {
	const length = System.Math.hypot(planeNormal[0], planeNormal[1], planeNormal[2]);
	const normalX = length > 0 ? planeNormal[0] / length : 0;
	const normalY = length > 0 ? planeNormal[1] / length : 1;
	const normalZ = length > 0 ? planeNormal[2] / length : 0;
	const distance = normalX * planePoint[0] + normalY * planePoint[1] + normalZ * planePoint[2];
	const matrix = Matrix4.createIdentity();
	const elements = matrix.getElements();
	elements[0] = 1 - 2 * normalX * normalX;
	elements[1] = -2 * normalX * normalY;
	elements[2] = -2 * normalX * normalZ;
	elements[4] = -2 * normalY * normalX;
	elements[5] = 1 - 2 * normalY * normalY;
	elements[6] = -2 * normalY * normalZ;
	elements[8] = -2 * normalZ * normalX;
	elements[9] = -2 * normalZ * normalY;
	elements[10] = 1 - 2 * normalZ * normalZ;
	elements[12] = 2 * distance * normalX;
	elements[13] = 2 * distance * normalY;
	elements[14] = 2 * distance * normalZ;
	return matrix;
}


//==============================================================================
// 행렬의 가장 큰 크기. (세 축 길이 가운데 큰 것)
//==============================================================================
/**
 * @param { Float32Array } elements
 * @returns { number }
 */
function readMaximumScale(elements) {
	const scaleX = System.Math.hypot(elements[0], elements[1], elements[2]);
	const scaleY = System.Math.hypot(elements[4], elements[5], elements[6]);
	const scaleZ = System.Math.hypot(elements[8], elements[9], elements[10]);
	return System.Math.max(scaleX, scaleY, scaleZ);
}


//==============================================================================
// 꼭짓점 배열의 경계 구. (stride 마다 앞 셋이 자리, 가운데는 상자의 가운데)
//==============================================================================
/**
 * @param { Float32Array } positions
 * @param { number } stride
 * @returns { object } { center, radius }
 */
function readBoundingSphere(positions, stride) {
	const minimum = [System.Infinity, System.Infinity, System.Infinity];
	const maximum = [-System.Infinity, -System.Infinity, -System.Infinity];
	for (let offset = 0; offset + 3 <= positions.length; offset += stride) {
		for (let axis = 0; axis < 3; ++axis) {
			minimum[axis] = System.Math.min(minimum[axis], positions[offset + axis]);
			maximum[axis] = System.Math.max(maximum[axis], positions[offset + axis]);
		}
	}
	if (minimum[0] > maximum[0]) {
		return { center: [0, 0, 0], radius: 0 };
	}
	const center = [(minimum[0] + maximum[0]) * 0.5, (minimum[1] + maximum[1]) * 0.5, (minimum[2] + maximum[2]) * 0.5];
	let radius = 0;
	for (let offset = 0; offset + 3 <= positions.length; offset += stride) {
		radius = System.Math.max(radius, System.Math.hypot(positions[offset] - center[0], positions[offset + 1] - center[1], positions[offset + 2] - center[2]));
	}
	return { center: center, radius: radius };
}


//==============================================================================
// 툰 렌더러. (ToonMesh 와 ToonGlb 의 배열을 한 색 재질과 바깥선으로 그린다)
// - 빛: ToonLightSet 하나를 기본으로 든다. 해(방향과 색), 하늘색과 땅색의 바탕빛, 채움 빛, 림 빛, 정반사, 점광(TOON_MAXIMUM_POINT_LIGHTS 까지), 띠(칸 수나 램프), 빛 꼴(÷π).
//   setLight, setSunDirection, setFillLight, setRimLight, setSpecular, setPointLights, setPointLightLimit, setBandCount, setBandRamp, setLightModel 은 기본 묶음을 고친다.
//   그리기마다 options.lightSet 으로 다른 묶음(createLightSet)을 줄 수 있다. 해 방향의 뜻(빛이 나아가는 쪽)은 ToonLightSet 머리말에 있다.
// - 재질: 꼭짓점의 색(sRGB), 빛남(바탕색에 곱해 더함), 빛을 받지 않음. 꼭짓점 UV(arrays.uvData, 2 씩)가 있으면 텍스처를 읽는다.
// - 그리기 꼴(options, 기본값이면 지금까지와 같은 화면):
//   tintColor [r, g, b, a] sRGB 와 alpha. tintAmount 를 주면(0 ~ 1) 틴트를 곱하지 않고 sRGB 로 섞는다. (맞은 번쩍임, 고장 빨강)
//   glowScale 꼭짓점 빛남의 배(기본 1), colorScale 마지막 선형 색의 배(기본 1, 거울에 비친 모습을 어둡게), emissiveColor [r, g, b] sRGB 와 emissiveIntensity(선형 배, 기본 1, 색 기본 검정).
//   baseColorTexture(바탕색에 곱함, 알파는 불투명도에), emissiveTexture(빛남 색에 곱함), uvTransform [u 옮김, v 옮김, u 배, v 배] (KHR_texture_transform 의 offset, scale).
//   decalTexture 는 바탕색 위에 알파로 덮는다(색 = 텍스처 x decalColor). decalEmission 만큼 그 색으로 빛난다. decalUvTransform 은 묶음 그림의 한 칸을 고를 때.
//   alphaCutoff 는 불투명도가 그보다 작은 화소를 버린다. (0 이면 끔, glTF MASK)
//   blendMode: ToonBlendMode.alpha(기본, 곧은 알파), premultiplied(미리 곱한 알파), additive(더하기). alpha 가 아니면 비치는 것으로 그린다.
//   softEdge 는 pow(|dot(N, V)|, softEdge) 를 불투명도에 곱해 가장자리를 엷게 한다. (0 이면 끔, 프레넬 꼴)
//   isMirrored 는 감기를 뒤집어 그린다. 주지 않으면 모형 행렬의 행렬식이 음수일 때 스스로 뒤집는다. 보기 행렬이 거울에 비쳤으면 그것도 더해 뒤집는다.
//   indexStart, indexCount 는 몸의 꼭짓점 번호 가운데 그 자리만 그린다. (GLB 재질 범위, 숨긴 부분) outlineIndexStart, outlineIndexCount 는 바깥선 껍데기.
//   material(ToonMaterial), textures({ 유니폼 이름: 텍스처 }), onBeforeDraw(program, webGL2RenderingContext, ToonProgramKind) 는 확장 자리다. (toonmaterial.js 머리말)
//   lightSet(ToonLightSet) 은 그 그리기의 빛 묶음이다.
// - 바깥선: MeshBuilder 가 지은 껍데기를 뒷면만 그린다.
// - 뼈대: writeSkinPose 가 셈한 본 행렬을 drawMesh 에 넘긴다. (TOON_MAXIMUM_JOINTS 까지)
// - GPU 인스턴싱: drawMeshInstanced 로 같은 모형 여럿을 인스턴스마다 행렬과 틴트로 한 번에 그린다. (몸과 바깥선 모두, 그릴 때마다 걸러서 올림)
//   오래 두는 인스턴스는 createInstanceLayout 과 createInstanceBuffer 로 영구 버퍼를 짓고 drawMeshInstanceBuffer 로 그린다. (거르지 않음, 머티리얼 정점 조각이 사용자 어트리뷰트를 읽음)
// - 화면 밖 거르기: 모형의 경계 구를 보기와 투영의 절두체에 대어 밖이면 그리지 않는다. (인스턴스는 하나씩 걸러 남은 것만 올린다)
// - 그림자: ShadowMap 에 beginShadowPass 와 drawMesh 로 드리우고, setShadow 로 받는다. (3x3 PCF)
//   그림자를 받지 않을 때도 그림자 유닛에 1x1 비교 깊이 텍스처를 묶는다. (sampler2DShadow 유닛에 깊이 텍스처가 없으면 맥 드라이버가 알리고, 색 텍스처가 묶여 있으면 WebGL 이 그리기를 거부한다)
// - HDR: setHdrOutput(true) 면 감마를 걸지 않은 선형 색을 낸다. 실수 렌더 타겟(ToonPostProcess)에 그리고 블룸과 톤매핑으로 마무리한다.
// - 사용: createMesh(arrays) → 매 프레임 beginFrame(보기와 투영) → drawMesh / drawMeshInstanced → endFrame() → 다 쓰면 deleteMesh.
//   beginFrame 이 앞의 그리기 상태(섞기, 깊이, 면 가리기, 프로그램, 버텍스 어레이)를 적어 두고 깊이 시험과 면 가리기를 켜며, endFrame 이 적어 둔 상태로 돌린다.
//   (엔진 2D 그리기 사이에 끼울 때, 그 전에 Graphic.flushSpriteBatch)
//   beginFrameWithMatrices(보기, 투영) 는 두 행렬로 시작한다. (직교 원 행렬 카메라) 카메라의 자리(정반사, 림, 소프트 엣지)는 보기와 투영에서 읽는다.
// - 프로그램마다 프레임 값(보기와 투영, 카메라, 그림자, HDR)과 빛 묶음은 바뀔 때만 올린다. 그리기마다 바뀌는 값(모형 행렬, 틴트, 텍스처)만 매번 올린다.
// - readProgramSources(material, instanceLayout) 로 ShaderWarmer 에 넘길 소스를 준다.
// - 노드 사각형 안에 그리기: setScreenRect(x, y, 너비, 높이) 를 주면 beginFrame 이 보기와 투영의 클립 공간을 그 사각형으로 옮기고 가위로 밖을 자른다.
//   사각형은 beginFrame 때의 뷰포트(보통 드로잉 버퍼 전체) 안의 픽셀이고 왼쪽 위가 원점이다. (2D 노드의 draw 에서 graphic.getTransformMatrix 로 셈한 자리)
//   화면 밖 거르기는 옮기기 전의 절두체로 한다. endFrame 이 가위를 푼다. 카메라의 가로 세로 비는 사각형의 비로 맞춘다. (Camera3D.setAspectRatio)
// - beginFrameWithCamera(Camera3D) 는 카메라의 보기와 투영으로 beginFrame 을 부른다. 2D 표시(Camera3D.projectToView)와 같은 카메라를 쓴다.
// - drawMeshOutline 은 바깥선 껍데기만 그린다. (ToonDrawQueue 가 불투명한 몸을 다 그린 뒤 바깥선을 몰아 그릴 때, 그린 수는 세지 않는다)
// - 텍스처: createTexture(그림이나 { width, height, data }, { isMipmapped, isRepeated, isFiltered }) 로 RGBA 텍스처를 짓는다. UV (0, 0) 이 그림의 왼쪽 위다. (glTF 와 같음)
//==============================================================================
export class ToonRenderer {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { Map<string, object | null> } */ #programSets; // "머티리얼 번호/인스턴스 꼴 번호" → { solid, outline, depth } (짓지 못했으면 null)
	/** @private @type { object } */ #defaultProgramSet;
	/** @private @type { WebGLTexture } */ #emptyShadowTexture; // 그림자를 받지 않을 때 그림자 유닛에 묶는 1x1 비교 깊이 텍스처. (깊이 1 이라 늘 빛을 받음)
	/** @private @type { WebGLTexture } */ #whiteTexture; // 텍스처를 주지 않은 바탕색, 빛남, 데칼 유닛에 묶는 1x1 흰 텍스처.
	/** @private @type { Float32Array } */ #viewProjectionElements; // 이번 프레임의 보기와 투영.
	/** @private @type { Array<Array<number>> } */ #frustumPlanes; // 절두체의 면 여섯.
	/** @private @type { Array<number> } */ #cameraPosition; // 눈의 자리. ([x, y, z, 1] 원근, [0, 0, 0, 0] 직교)
	/** @private @type { Array<number> } */ #cameraForward; // 보는 방향.
	/** @private @type { boolean } */ #isFrameMirrored; // 보기 행렬이 거울에 비쳤는지.
	/** @private @type { ToonLightSet } */ #lightSet; // 기본 빛 묶음.
	/** @private @type { Array<number> } */ #outlineColor; // 바깥선 색. (sRGB, 알파)
	/** @private @type { boolean } */ #isHdrOutput; // 선형 색을 낼지.
	/** @private @type { object | null } */ #shadowInput; // 받을 그림자. ({ depthTexture, lightViewProjectionMatrix, resolution, strength })
	/** @private @type { boolean } */ #isShadowPass; // 그림자 깊이 패스 중인지.
	/** @private @type { number } */ #frameSerial; // 프레임 값이 바뀔 때마다 오르는 번호. (프로그램마다 마지막으로 올린 번호와 견준다)
	/** @private @type { object | null } */ #savedState; // 앞의 그리기 상태. (끝이 돌린다)
	/** @private @type { Float32Array } */ #instanceData; // 인스턴스 올리기 칸. (모자라면 늘린다)
	/** @private @type { object } */ #frameStatistics; // 한 프레임의 그린 수와 거른 수와 드로우콜.
	/** @private @type { object | null } */ #screenRect; // 그릴 화면 사각형. ({ x, y, width, height } 뷰포트 픽셀, 왼쪽 위 원점, null 이면 뷰포트 전체)
	/** @private @type { boolean } */ #isScissorApplied; // beginFrame 이 가위를 켰는지.
	/** @private @type { Float32Array } */ #pointPositionValues; // 점광 유니폼 올리기 칸.
	/** @private @type { Float32Array } */ #pointColorValues;
	/** @private @type { Float32Array } */ #pointShapeValues;
	/** @private @type { Float32Array } */ #bandThresholdValues;
	/** @private @type { Float32Array } */ #bandValueValues;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext
	 */
	constructor(webGL2RenderingContext) {
		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#programSets = new Map();
		this.#emptyShadowTexture = this.createEmptyShadowTexture();
		this.#whiteTexture = this.createTexture({ width: 1, height: 1, data: new System.Uint8Array([255, 255, 255, 255]) }, { isMipmapped: false });
		this.#defaultProgramSet = this.createProgramSet(null, null);
		this.#programSets.set("0/0", this.#defaultProgramSet);
		const identityMatrix = Matrix4.createIdentity();
		this.#viewProjectionElements = new System.Float32Array(identityMatrix.getElements());
		this.#frustumPlanes = extractFrustumPlanes(identityMatrix);
		this.#cameraPosition = [0, 0, 0, 0];
		this.#cameraForward = [0, 0, -1];
		this.#isFrameMirrored = false;
		this.#lightSet = new ToonLightSet();
		this.#outlineColor = [0.05, 0.05, 0.08, 1];
		this.#isHdrOutput = false;
		this.#shadowInput = null;
		this.#isShadowPass = false;
		this.#frameSerial = 1;
		this.#savedState = null;
		this.#instanceData = new System.Float32Array(TOON_INSTANCE_FLOAT_COUNT * 64);
		this.#frameStatistics = { drawCallCount: 0, drawnObjectCount: 0, culledObjectCount: 0 };
		this.#screenRect = null;
		this.#isScissorApplied = false;
		this.#pointPositionValues = new System.Float32Array(TOON_MAXIMUM_POINT_LIGHTS * 4);
		this.#pointColorValues = new System.Float32Array(TOON_MAXIMUM_POINT_LIGHTS * 3);
		this.#pointShapeValues = new System.Float32Array(TOON_MAXIMUM_POINT_LIGHTS * 3);
		this.#bandThresholdValues = new System.Float32Array(TOON_MAXIMUM_BAND_STEPS - 1);
		this.#bandValueValues = new System.Float32Array(TOON_MAXIMUM_BAND_STEPS);
	}

	//==============================================================================
	// 셰이더 소스 반환. (ShaderWarmer 로 미리 링크할 때, 머티리얼과 인스턴스 꼴이 없으면 기본 프로그램)
	//==============================================================================
	/**
	 * @static
	 * @param { ToonMaterial | null } [material]
	 * @param { ToonInstanceLayout | null } [instanceLayout]
	 * @returns { Array<object> } { vertexShader, fragmentShader, attributeLocationTable } 의 배열. (몸, 바깥선, 그림자 깊이)
	 */
	static readProgramSources(material = null, instanceLayout = null) {
		const sources = composeToonProgramSources(material, instanceLayout);
		return [
			{ vertexShader: sources.solidVertexShader, fragmentShader: sources.solidFragmentShader, attributeLocationTable: sources.attributeLocationTable },
			{ vertexShader: sources.outlineVertexShader, fragmentShader: sources.outlineFragmentShader, attributeLocationTable: sources.attributeLocationTable },
			{ vertexShader: sources.depthVertexShader, fragmentShader: sources.depthFragmentShader, attributeLocationTable: sources.attributeLocationTable },
		];
	}

	//==============================================================================
	// 세 프로그램 짓기. (짓지 못하면 던진다)
	//==============================================================================
	/**
	 * @param { ToonMaterial | null } material
	 * @param { ToonInstanceLayout | null } instanceLayout
	 * @returns { object } { solid, outline, depth } 마다 { program, kind, frameSerial, lightSet, lightVersion }
	 */
	createProgramSet(material, instanceLayout) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const sources = composeToonProgramSources(material, instanceLayout);
		const programList = [];
		try {
			programList.push(new ShaderProgram(webGL2RenderingContext, sources.solidVertexShader, sources.solidFragmentShader, sources.attributeLocationTable));
			programList.push(new ShaderProgram(webGL2RenderingContext, sources.outlineVertexShader, sources.outlineFragmentShader, sources.attributeLocationTable));
			programList.push(new ShaderProgram(webGL2RenderingContext, sources.depthVertexShader, sources.depthFragmentShader, sources.attributeLocationTable));
		}
		catch (error) {
			for (const shaderProgram of programList) {
				webGL2RenderingContext.deleteProgram(shaderProgram.getProgram());
			}
			throw error;
		}
		const solidProgram = programList[0];
		const previousProgram = webGL2RenderingContext.getParameter(webGL2RenderingContext.CURRENT_PROGRAM);
		solidProgram.use();
		webGL2RenderingContext.uniform1i(solidProgram.getUniformLocation("shadowTexture"), SHADOW_TEXTURE_UNIT);
		webGL2RenderingContext.uniform1i(solidProgram.getUniformLocation("baseColorTexture"), BASE_COLOR_TEXTURE_UNIT);
		webGL2RenderingContext.uniform1i(solidProgram.getUniformLocation("emissiveTexture"), EMISSIVE_TEXTURE_UNIT);
		webGL2RenderingContext.uniform1i(solidProgram.getUniformLocation("decalTexture"), DECAL_TEXTURE_UNIT);
		webGL2RenderingContext.useProgram(previousProgram);
		const createEntry = (shaderProgram, kind) => {
			return { program: shaderProgram, kind: kind, frameSerial: 0, lightSet: null, lightVersion: -1 };
		};
		return { solid: createEntry(solidProgram, ToonProgramKind.solid), outline: createEntry(programList[1], ToonProgramKind.outline), depth: createEntry(programList[2], ToonProgramKind.depth) };
	}

	//==============================================================================
	// 머티리얼과 인스턴스 꼴의 프로그램 반환. (없으면 짓고, 짓지 못한 것은 알리고 null 을 기억해 다시 짓지 않는다)
	//==============================================================================
	/**
	 * @param { ToonMaterial | null } material
	 * @param { ToonInstanceLayout | null } instanceLayout
	 * @returns { object | null }
	 */
	readProgramSet(material, instanceLayout) {
		if (material === null && instanceLayout === null) {
			return this.#defaultProgramSet;
		}
		const key = `${material !== null ? material.getId() : 0}/${instanceLayout !== null ? instanceLayout.getId() : 0}`;
		if (this.#programSets.has(key)) {
			return this.#programSets.get(key);
		}
		let programSet = null;
		try {
			programSet = this.createProgramSet(material, instanceLayout);
		}
		catch (error) {
			const name = material !== null && material.getName() !== "" ? material.getName() : key;
			System.console.error(`ToonRenderer: 머티리얼 ${name} 의 셰이더를 짓지 못했습니다.`, error);
		}
		this.#programSets.set(key, programSet);
		return programSet;
	}

	//==============================================================================
	// 머티리얼 짓기. (셰이더 조각, toonmaterial.js 머리말)
	//==============================================================================
	/**
	 * @param { object } chunks - { name, uniformChunk, surfaceChunk, lightChunk, vertexChunk }
	 * @returns { ToonMaterial }
	 */
	createMaterial(chunks) {
		return new ToonMaterial(chunks);
	}

	//==============================================================================
	// 머티리얼의 프로그램을 미리 짓기. (처음 그릴 때의 멈춤을 피할 때, 짓지 못하면 false)
	//==============================================================================
	/**
	 * @param { ToonMaterial | null } material
	 * @param { ToonInstanceLayout | null } [instanceLayout]
	 * @returns { boolean }
	 */
	prepareMaterial(material, instanceLayout = null) {
		return this.readProgramSet(material, instanceLayout) !== null;
	}

	//==============================================================================
	// 머티리얼의 프로그램 지우기. (모든 인스턴스 꼴의 것, 다시 그리면 새로 짓는다)
	//==============================================================================
	/**
	 * @param { ToonMaterial } material
	 */
	deleteMaterial(material) {
		const prefix = `${material.getId()}/`;
		for (const [key, programSet] of System.Array.from(this.#programSets.entries())) {
			if (!key.startsWith(prefix)) {
				continue;
			}
			this.deleteProgramSet(programSet);
			this.#programSets.delete(key);
		}
	}

	//==============================================================================
	// 세 프로그램 지우기.
	//==============================================================================
	/**
	 * @param { object | null } programSet
	 */
	deleteProgramSet(programSet) {
		if (programSet === null) {
			return;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.deleteProgram(programSet.solid.program.getProgram());
		webGL2RenderingContext.deleteProgram(programSet.outline.program.getProgram());
		webGL2RenderingContext.deleteProgram(programSet.depth.program.getProgram());
	}

	//==============================================================================
	// 빛 묶음 짓기. (그리기마다 options.lightSet 으로 줄 것, 기본 빛과 같은 값으로 시작)
	//==============================================================================
	/**
	 * @returns { ToonLightSet }
	 */
	createLightSet() {
		return new ToonLightSet();
	}

	//==============================================================================
	// 기본 빛 묶음 반환.
	//==============================================================================
	/**
	 * @returns { ToonLightSet }
	 */
	getLightSet() {
		return this.#lightSet;
	}

	//==============================================================================
	// 인스턴스 꼴 짓기. ([{ name, size }], toonmaterial.js 의 ToonInstanceLayout)
	//==============================================================================
	/**
	 * @param { Array<object> } attributes
	 * @returns { ToonInstanceLayout }
	 */
	createInstanceLayout(attributes) {
		return new ToonInstanceLayout(attributes);
	}

	//==============================================================================
	// 영구 인스턴스 버퍼 짓기. (꼴의 수 개수씩 담은 data, ToonBufferUsage.static 이면 한 번 올리고 오래 그림)
	//==============================================================================
	/**
	 * @param { ToonInstanceLayout } instanceLayout
	 * @param { Float32Array } data
	 * @param { string } [usage] - ToonBufferUsage
	 * @returns { object } { layout, buffer, usage, floatCount, vertexArrays }
	 */
	createInstanceBuffer(instanceLayout, data, usage = ToonBufferUsage.static) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const glUsage = usage === ToonBufferUsage.dynamic ? webGL2RenderingContext.DYNAMIC_DRAW : webGL2RenderingContext.STATIC_DRAW;
		const buffer = this.createArrayBuffer(data, glUsage);
		return { layout: instanceLayout, buffer: buffer, usage: glUsage, floatCount: data.length, vertexArrays: new Map() };
	}

	//==============================================================================
	// 인스턴스 버퍼 고치기. (전체를 다시 올림)
	//==============================================================================
	/**
	 * @param { object } instanceBuffer - createInstanceBuffer 의 결과.
	 * @param { Float32Array } data
	 */
	updateInstanceBuffer(instanceBuffer, data) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, instanceBuffer.buffer);
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, data, instanceBuffer.usage);
		instanceBuffer.floatCount = data.length;
	}

	//==============================================================================
	// 인스턴스 버퍼 지우기. (그 버퍼로 지은 버텍스 어레이도, 모형보다 먼저 지운다)
	//==============================================================================
	/**
	 * @param { object } instanceBuffer
	 */
	deleteInstanceBuffer(instanceBuffer) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		for (const vertexArrays of instanceBuffer.vertexArrays.values()) {
			webGL2RenderingContext.deleteVertexArray(vertexArrays.body);
			if (vertexArrays.outline !== null) {
				webGL2RenderingContext.deleteVertexArray(vertexArrays.outline);
			}
		}
		instanceBuffer.vertexArrays.clear();
		webGL2RenderingContext.deleteBuffer(instanceBuffer.buffer);
	}

	//==============================================================================
	// 텍스처 짓기. (ImageBitmap, 캔버스, 이미지, ImageData 나 { width, height, data: Uint8Array RGBA })
	//==============================================================================
	/**
	 * @param { object } source
	 * @param { object } [options] - { isMipmapped (기본 true), isRepeated (기본 true, false 면 가장자리 붙임), isFiltered (기본 true, false 면 가까운 화소) }
	 * @returns { WebGLTexture }
	 */
	createTexture(source, options = {}) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const isMipmapped = options.isMipmapped !== false;
		const isRepeated = options.isRepeated !== false;
		const isFiltered = options.isFiltered !== false;
		const texture = webGL2RenderingContext.createTexture();
		const isPremultiplied = webGL2RenderingContext.getParameter(webGL2RenderingContext.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
		const isFlipped = webGL2RenderingContext.getParameter(webGL2RenderingContext.UNPACK_FLIP_Y_WEBGL);
		webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
		webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_FLIP_Y_WEBGL, false);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + BASE_COLOR_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, texture);
		if (System.ArrayBuffer.isView(source.data) && typeof source.width === "number" && typeof source.height === "number") {
			webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.RGBA, source.width, source.height, 0, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, new System.Uint8Array(source.data.buffer, source.data.byteOffset, source.data.byteLength));
		}
		else {
			webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.RGBA, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, source);
		}
		const wrap = isRepeated ? webGL2RenderingContext.REPEAT : webGL2RenderingContext.CLAMP_TO_EDGE;
		const magnifyFilter = isFiltered ? webGL2RenderingContext.LINEAR : webGL2RenderingContext.NEAREST;
		let minifyFilter = magnifyFilter;
		if (isMipmapped) {
			webGL2RenderingContext.generateMipmap(webGL2RenderingContext.TEXTURE_2D);
			minifyFilter = isFiltered ? webGL2RenderingContext.LINEAR_MIPMAP_LINEAR : webGL2RenderingContext.NEAREST_MIPMAP_NEAREST;
		}
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, minifyFilter);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, magnifyFilter);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, wrap);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, wrap);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, null);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_PREMULTIPLY_ALPHA_WEBGL, isPremultiplied);
		webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_FLIP_Y_WEBGL, isFlipped);
		return texture;
	}

	//==============================================================================
	// 텍스처 지우기.
	//==============================================================================
	/**
	 * @param { WebGLTexture | null } texture
	 */
	deleteTexture(texture) {
		if (texture === null) {
			return;
		}
		this.getWebGL2RenderingContext().deleteTexture(texture);
	}

	//==============================================================================
	// 모형 올리기. (MeshBuilder.readArrays 나 ToonGlb.readGlbArrays 의 결과, 몸이 비면 null)
	//==============================================================================
	/**
	 * @param { object } arrays
	 * @returns { object | null }
	 */
	createMesh(arrays) {
		if (arrays.indexData.length === 0) {
			return null;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const buffers = [];
		const isSkinned = arrays.skinData !== undefined && arrays.skinData !== null && arrays.skinData.length > 0;
		const vertexCount = System.Math.floor(arrays.vertexData.length / VERTEX_FLOAT_COUNT);
		const hasUv = arrays.uvData !== undefined && arrays.uvData !== null && vertexCount > 0 && arrays.uvData.length >= vertexCount * 2;
		const boundingSphere = readBoundingSphere(arrays.vertexData, VERTEX_FLOAT_COUNT);
		const boundingRadius = isSkinned ? boundingSphere.radius * 1.5 : boundingSphere.radius;

		// 인스턴스 버퍼. (보통 그리기에서도 인스턴스 어트리뷰트가 켜져 있으므로 한 인스턴스 분량을 늘 채워 둔다)
		const defaultInstance = new System.Float32Array(TOON_INSTANCE_FLOAT_COUNT);
		defaultInstance.set(Matrix4.createIdentity().getElements(), 0);
		defaultInstance.set([1, 1, 1, 1], 16);
		const instanceBuffer = this.createArrayBuffer(defaultInstance, webGL2RenderingContext.DYNAMIC_DRAW);
		const mesh = {
			bodyVertexArray: null,
			bodyIndexCount: arrays.indexData.length,
			outlineVertexArray: null,
			outlineIndexCount: 0,
			instanceBuffer: instanceBuffer,
			buffers: buffers,
			isSkinned: isSkinned,
			hasUv: hasUv,
			boundingCenter: boundingSphere.center,
			boundingRadius: boundingRadius,
			vertexBuffer: null,
			skinBuffer: null,
			uvBuffer: null,
			bodyIndexBuffer: null,
			outlineBuffer: null,
			outlineSkinBuffer: null,
			outlineIndexBuffer: null,
		};

		// 몸.
		mesh.vertexBuffer = this.createArrayBuffer(arrays.vertexData, webGL2RenderingContext.STATIC_DRAW);
		buffers.push(mesh.vertexBuffer);
		if (isSkinned) {
			mesh.skinBuffer = this.createArrayBuffer(arrays.skinData, webGL2RenderingContext.STATIC_DRAW);
			buffers.push(mesh.skinBuffer);
		}
		if (hasUv) {
			mesh.uvBuffer = this.createArrayBuffer(arrays.uvData.length === vertexCount * 2 ? arrays.uvData : arrays.uvData.subarray(0, vertexCount * 2), webGL2RenderingContext.STATIC_DRAW);
			buffers.push(mesh.uvBuffer);
		}
		mesh.bodyVertexArray = webGL2RenderingContext.createVertexArray();
		webGL2RenderingContext.bindVertexArray(mesh.bodyVertexArray);
		mesh.bodyIndexBuffer = this.createIndexBuffer(arrays.indexData);
		buffers.push(mesh.bodyIndexBuffer);
		this.attachBodyAttributes(mesh);
		this.attachInstanceAttributes(instanceBuffer);

		// 바깥선 껍데기. (자리만)
		const outlineIndexData = arrays.outlineIndexData;
		if (outlineIndexData !== undefined && outlineIndexData !== null && outlineIndexData.length > 0) {
			mesh.outlineBuffer = this.createArrayBuffer(arrays.outlineVertexData, webGL2RenderingContext.STATIC_DRAW);
			buffers.push(mesh.outlineBuffer);
			const outlineSkinData = arrays.outlineSkinData;
			if (isSkinned && outlineSkinData !== undefined && outlineSkinData.length > 0) {
				mesh.outlineSkinBuffer = this.createArrayBuffer(outlineSkinData, webGL2RenderingContext.STATIC_DRAW);
				buffers.push(mesh.outlineSkinBuffer);
			}
			mesh.outlineVertexArray = webGL2RenderingContext.createVertexArray();
			webGL2RenderingContext.bindVertexArray(mesh.outlineVertexArray);
			mesh.outlineIndexBuffer = this.createIndexBuffer(outlineIndexData);
			buffers.push(mesh.outlineIndexBuffer);
			this.attachOutlineAttributes(mesh);
			this.attachInstanceAttributes(instanceBuffer);
			mesh.outlineIndexCount = outlineIndexData.length;
		}
		webGL2RenderingContext.bindVertexArray(null);
		buffers.push(instanceBuffer);
		return mesh;
	}

	//==============================================================================
	// 꼭짓점 버퍼 만들기.
	//==============================================================================
	/**
	 * @param { Float32Array } data
	 * @param { number } usage
	 * @returns { WebGLBuffer }
	 */
	createArrayBuffer(data, usage) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const buffer = webGL2RenderingContext.createBuffer();
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, buffer);
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, data, usage);
		return buffer;
	}

	//==============================================================================
	// 번호 버퍼 만들기. (지금 묶인 버텍스 어레이에 붙는다)
	//==============================================================================
	/**
	 * @param { Uint32Array } data
	 * @returns { WebGLBuffer }
	 */
	createIndexBuffer(data) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const buffer = webGL2RenderingContext.createBuffer();
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ELEMENT_ARRAY_BUFFER, buffer);
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ELEMENT_ARRAY_BUFFER, data, webGL2RenderingContext.STATIC_DRAW);
		return buffer;
	}

	//==============================================================================
	// 몸의 꼭짓점, 뼈대, UV 어트리뷰트와 번호 버퍼를 지금 묶인 버텍스 어레이에 붙이기.
	//==============================================================================
	/**
	 * @param { object } mesh
	 */
	attachBodyAttributes(mesh) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const stride = VERTEX_FLOAT_COUNT * 4;
		const attributeLayouts = [
			[TOON_ATTRIBUTE_LOCATIONS.vertexPosition, 3, 0],
			[TOON_ATTRIBUTE_LOCATIONS.vertexNormal, 3, 12],
			[TOON_ATTRIBUTE_LOCATIONS.vertexColor, 3, 24],
			[TOON_ATTRIBUTE_LOCATIONS.vertexMaterial, 2, 36],
			[TOON_ATTRIBUTE_LOCATIONS.vertexDetail, 4, 44],
		];
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, mesh.vertexBuffer);
		for (const attributeLayout of attributeLayouts) {
			webGL2RenderingContext.enableVertexAttribArray(attributeLayout[0]);
			webGL2RenderingContext.vertexAttribPointer(attributeLayout[0], attributeLayout[1], webGL2RenderingContext.FLOAT, false, stride, attributeLayout[2]);
		}
		if (mesh.skinBuffer !== null) {
			this.attachSkinAttributes(mesh.skinBuffer);
		}
		if (mesh.uvBuffer !== null) {
			webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, mesh.uvBuffer);
			webGL2RenderingContext.enableVertexAttribArray(TOON_ATTRIBUTE_LOCATIONS.vertexUv);
			webGL2RenderingContext.vertexAttribPointer(TOON_ATTRIBUTE_LOCATIONS.vertexUv, 2, webGL2RenderingContext.FLOAT, false, 8, 0);
		}
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ELEMENT_ARRAY_BUFFER, mesh.bodyIndexBuffer);
	}

	//==============================================================================
	// 바깥선 껍데기의 자리, 뼈대 어트리뷰트와 번호 버퍼를 지금 묶인 버텍스 어레이에 붙이기.
	//==============================================================================
	/**
	 * @param { object } mesh
	 */
	attachOutlineAttributes(mesh) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, mesh.outlineBuffer);
		webGL2RenderingContext.enableVertexAttribArray(TOON_ATTRIBUTE_LOCATIONS.vertexPosition);
		webGL2RenderingContext.vertexAttribPointer(TOON_ATTRIBUTE_LOCATIONS.vertexPosition, 3, webGL2RenderingContext.FLOAT, false, 12, 0);
		if (mesh.outlineSkinBuffer !== null) {
			this.attachSkinAttributes(mesh.outlineSkinBuffer);
		}
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ELEMENT_ARRAY_BUFFER, mesh.outlineIndexBuffer);
	}

	//==============================================================================
	// 뼈대 번호와 무게의 버퍼를 지금 묶인 버텍스 어레이에 어트리뷰트로 붙이기.
	//==============================================================================
	/**
	 * @param { WebGLBuffer } skinBuffer
	 */
	attachSkinAttributes(skinBuffer) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const stride = SKIN_FLOAT_COUNT * 4;
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, skinBuffer);
		webGL2RenderingContext.enableVertexAttribArray(TOON_ATTRIBUTE_LOCATIONS.vertexJoints);
		webGL2RenderingContext.vertexAttribPointer(TOON_ATTRIBUTE_LOCATIONS.vertexJoints, 4, webGL2RenderingContext.FLOAT, false, stride, 0);
		webGL2RenderingContext.enableVertexAttribArray(TOON_ATTRIBUTE_LOCATIONS.vertexWeights);
		webGL2RenderingContext.vertexAttribPointer(TOON_ATTRIBUTE_LOCATIONS.vertexWeights, 4, webGL2RenderingContext.FLOAT, false, stride, 16);
	}

	//==============================================================================
	// 인스턴스 버퍼를 지금 묶인 버텍스 어레이의 인스턴스 어트리뷰트로. (행렬 네 줄, 틴트, 인스턴스마다 하나씩)
	//==============================================================================
	/**
	 * @param { WebGLBuffer } instanceBuffer
	 */
	attachInstanceAttributes(instanceBuffer) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const stride = TOON_INSTANCE_FLOAT_COUNT * 4;
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, instanceBuffer);
		for (let columnIndex = 0; columnIndex < 5; ++columnIndex) {
			const location = TOON_ATTRIBUTE_LOCATIONS.instanceMatrix0 + columnIndex;
			webGL2RenderingContext.enableVertexAttribArray(location);
			webGL2RenderingContext.vertexAttribPointer(location, 4, webGL2RenderingContext.FLOAT, false, stride, columnIndex * 16);
			webGL2RenderingContext.vertexAttribDivisor(location, 1);
		}
	}

	//==============================================================================
	// 인스턴스 꼴의 버퍼를 지금 묶인 버텍스 어레이의 인스턴스 어트리뷰트로.
	//==============================================================================
	/**
	 * @param { ToonInstanceLayout } instanceLayout
	 * @param { WebGLBuffer } buffer
	 */
	attachLayoutAttributes(instanceLayout, buffer) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const stride = instanceLayout.getFloatCount() * 4;
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, buffer);
		const attach = (location, size, floatOffset) => {
			webGL2RenderingContext.enableVertexAttribArray(location);
			webGL2RenderingContext.vertexAttribPointer(location, size, webGL2RenderingContext.FLOAT, false, stride, floatOffset * 4);
			webGL2RenderingContext.vertexAttribDivisor(location, 1);
		};
		for (const attribute of instanceLayout.getAttributes()) {
			if (attribute.name === TOON_INSTANCE_MATRIX_NAME) {
				for (let columnIndex = 0; columnIndex < 4; ++columnIndex) {
					attach(TOON_ATTRIBUTE_LOCATIONS.instanceMatrix0 + columnIndex, 4, attribute.offset + columnIndex * 4);
				}
			}
			else if (attribute.name === TOON_INSTANCE_TINT_NAME) {
				attach(TOON_ATTRIBUTE_LOCATIONS.instanceTint, 4, attribute.offset);
			}
			else {
				attach(attribute.location, attribute.size, attribute.offset);
			}
		}
	}

	//==============================================================================
	// 모형과 인스턴스 버퍼를 함께 묶은 버텍스 어레이. (처음 그릴 때 짓고 인스턴스 버퍼에 담아 둔다)
	//==============================================================================
	/**
	 * @param { object } mesh
	 * @param { object } instanceBuffer
	 * @returns { object } { body, outline }
	 */
	readInstanceVertexArrays(mesh, instanceBuffer) {
		const existing = instanceBuffer.vertexArrays.get(mesh);
		if (existing !== undefined) {
			return existing;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const body = webGL2RenderingContext.createVertexArray();
		webGL2RenderingContext.bindVertexArray(body);
		this.attachBodyAttributes(mesh);
		this.attachLayoutAttributes(instanceBuffer.layout, instanceBuffer.buffer);
		let outline = null;
		if (mesh.outlineVertexArray !== null) {
			outline = webGL2RenderingContext.createVertexArray();
			webGL2RenderingContext.bindVertexArray(outline);
			this.attachOutlineAttributes(mesh);
			this.attachLayoutAttributes(instanceBuffer.layout, instanceBuffer.buffer);
		}
		webGL2RenderingContext.bindVertexArray(null);
		const vertexArrays = { body: body, outline: outline };
		instanceBuffer.vertexArrays.set(mesh, vertexArrays);
		return vertexArrays;
	}

	//==============================================================================
	// 빈 그림자 텍스처 짓기. (1x1 깊이 1, 비교 샘플링)
	//==============================================================================
	/**
	 * @returns { WebGLTexture }
	 */
	createEmptyShadowTexture() {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const texture = webGL2RenderingContext.createTexture();
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + SHADOW_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, texture);
		webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.DEPTH_COMPONENT24, 1, 1, 0, webGL2RenderingContext.DEPTH_COMPONENT, webGL2RenderingContext.UNSIGNED_INT, new System.Uint32Array([0xffffffff]));
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, webGL2RenderingContext.NEAREST);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, webGL2RenderingContext.NEAREST);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_COMPARE_MODE, webGL2RenderingContext.COMPARE_REF_TO_TEXTURE);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_COMPARE_FUNC, webGL2RenderingContext.LEQUAL);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, null);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		return texture;
	}

	//==============================================================================
	// 렌더러 지우기. (모든 프로그램과 빈 텍스처, 모형과 인스턴스 버퍼와 텍스처는 따로)
	//==============================================================================
	destroy() {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		for (const programSet of this.#programSets.values()) {
			this.deleteProgramSet(programSet);
		}
		this.#programSets.clear();
		webGL2RenderingContext.deleteTexture(this.#emptyShadowTexture);
		webGL2RenderingContext.deleteTexture(this.#whiteTexture);
	}

	//==============================================================================
	// 모형 지우기.
	//==============================================================================
	/**
	 * @param { object | null } mesh
	 */
	deleteMesh(mesh) {
		if (mesh === null) {
			return;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.deleteVertexArray(mesh.bodyVertexArray);
		if (mesh.outlineVertexArray !== null) {
			webGL2RenderingContext.deleteVertexArray(mesh.outlineVertexArray);
		}
		for (const buffer of mesh.buffers) {
			webGL2RenderingContext.deleteBuffer(buffer);
		}
	}

	//==============================================================================
	// 그리기 전의 상태 적어 두기.
	//==============================================================================
	saveState() {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		this.#savedState = {
			isBlendEnabled: webGL2RenderingContext.isEnabled(webGL2RenderingContext.BLEND),
			isDepthTestEnabled: webGL2RenderingContext.isEnabled(webGL2RenderingContext.DEPTH_TEST),
			isCullFaceEnabled: webGL2RenderingContext.isEnabled(webGL2RenderingContext.CULL_FACE),
			depthMask: webGL2RenderingContext.getParameter(webGL2RenderingContext.DEPTH_WRITEMASK),
			blendSourceRGB: webGL2RenderingContext.getParameter(webGL2RenderingContext.BLEND_SRC_RGB),
			blendDestinationRGB: webGL2RenderingContext.getParameter(webGL2RenderingContext.BLEND_DST_RGB),
			blendSourceAlpha: webGL2RenderingContext.getParameter(webGL2RenderingContext.BLEND_SRC_ALPHA),
			blendDestinationAlpha: webGL2RenderingContext.getParameter(webGL2RenderingContext.BLEND_DST_ALPHA),
			program: webGL2RenderingContext.getParameter(webGL2RenderingContext.CURRENT_PROGRAM),
			vertexArray: webGL2RenderingContext.getParameter(webGL2RenderingContext.VERTEX_ARRAY_BINDING),
			viewport: webGL2RenderingContext.getParameter(webGL2RenderingContext.VIEWPORT),
			framebuffer: webGL2RenderingContext.getParameter(webGL2RenderingContext.FRAMEBUFFER_BINDING),
		};
	}

	//==============================================================================
	// 적어 둔 상태로 돌리기.
	//==============================================================================
	/**
	 * @param { boolean } isFramebufferRestored - 프레임버퍼와 뷰포트도 돌릴지.
	 */
	restoreState(isFramebufferRestored) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const savedState = this.#savedState;
		webGL2RenderingContext.cullFace(webGL2RenderingContext.BACK);
		webGL2RenderingContext.frontFace(webGL2RenderingContext.CCW);
		webGL2RenderingContext.colorMask(true, true, true, true);
		if (savedState === null) {
			return;
		}
		if (isFramebufferRestored) {
			const viewport = savedState.viewport;
			webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, savedState.framebuffer);
			webGL2RenderingContext.viewport(viewport[0], viewport[1], viewport[2], viewport[3]);
		}
		webGL2RenderingContext.bindVertexArray(savedState.vertexArray);
		webGL2RenderingContext.useProgram(savedState.program);
		webGL2RenderingContext.depthMask(savedState.depthMask);
		webGL2RenderingContext.blendFuncSeparate(savedState.blendSourceRGB, savedState.blendDestinationRGB, savedState.blendSourceAlpha, savedState.blendDestinationAlpha);
		this.applyCapability(webGL2RenderingContext.BLEND, savedState.isBlendEnabled);
		this.applyCapability(webGL2RenderingContext.DEPTH_TEST, savedState.isDepthTestEnabled);
		this.applyCapability(webGL2RenderingContext.CULL_FACE, savedState.isCullFaceEnabled);
		this.#savedState = null;
	}

	//==============================================================================
	// 그리기 기능 켜고 끄기.
	//==============================================================================
	/**
	 * @param { GLenum } capability
	 * @param { boolean } isEnabled
	 */
	applyCapability(capability, isEnabled) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		if (isEnabled) {
			webGL2RenderingContext.enable(capability);
		}
		else {
			webGL2RenderingContext.disable(capability);
		}
	}

	//==============================================================================
	// 프레임의 그리기 상태 걸기. (섞기 끔, 깊이 시험 LEQUAL 과 쓰기, 뒷면 가리기, 앞면 CCW, ToonDrawQueue 가 단계 콜백 뒤에 다시 건다)
	//==============================================================================
	applyFrameState() {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);
		webGL2RenderingContext.enable(webGL2RenderingContext.DEPTH_TEST);
		webGL2RenderingContext.depthFunc(webGL2RenderingContext.LEQUAL);
		webGL2RenderingContext.depthMask(true);
		webGL2RenderingContext.enable(webGL2RenderingContext.CULL_FACE);
		webGL2RenderingContext.cullFace(webGL2RenderingContext.BACK);
		webGL2RenderingContext.frontFace(webGL2RenderingContext.CCW);
		webGL2RenderingContext.colorMask(true, true, true, true);
	}

	//==============================================================================
	// 프레임 시작. (보기와 투영과 절두체를 정하고, 앞의 상태를 적어 둔 뒤 깊이 시험과 면 가리기를 켠다, 깊이를 비우는 것은 부르는 쪽이 정한다)
	//==============================================================================
	/**
	 * @param { Matrix4 } viewProjectionMatrix
	 */
	beginFrame(viewProjectionMatrix) {
		const elements = viewProjectionMatrix.getElements();
		this.#viewProjectionElements.set(elements);
		this.#frustumPlanes = extractFrustumPlanes(viewProjectionMatrix);
		const frameCamera = readFrameCamera(elements);
		this.#cameraPosition = frameCamera.position;
		this.#cameraForward = frameCamera.forward;
		this.#isFrameMirrored = frameCamera.isMirrored;
		this.#frameStatistics = { drawCallCount: 0, drawnObjectCount: 0, culledObjectCount: 0 };
		this.#isShadowPass = false;
		this.#frameSerial += 1;
		this.saveState();
		this.applyScreenRect();
		this.applyFrameState();
	}

	//==============================================================================
	// 프레임 끝. (적어 둔 상태로 돌린다)
	//==============================================================================
	endFrame() {
		this.releaseScreenRect();
		this.restoreState(false);
	}

	//==============================================================================
	// 카메라로 프레임 시작. (Camera3D 의 보기와 투영으로 beginFrame)
	//==============================================================================
	/**
	 * @param { object } camera - Camera3D
	 */
	beginFrameWithCamera(camera) {
		const viewProjectionMatrix = camera.getViewProjectionMatrix();
		this.beginFrame(viewProjectionMatrix);
	}

	//==============================================================================
	// 보기와 투영 행렬로 프레임 시작. (Camera3D 없이, 투영 x 보기로 beginFrame)
	//==============================================================================
	/**
	 * @param { Matrix4 } viewMatrix
	 * @param { Matrix4 } projectionMatrix
	 */
	beginFrameWithMatrices(viewMatrix, projectionMatrix) {
		const viewProjectionMatrix = projectionMatrix.clone();
		viewProjectionMatrix.multiply(viewMatrix);
		this.beginFrame(viewProjectionMatrix);
	}

	//==============================================================================
	// 이번 프레임의 카메라 반환. (보기와 투영에서 읽은 것)
	//==============================================================================
	/**
	 * @returns { object } { position [x, y, z, w(1 원근, 0 직교)], forward, isMirrored }
	 */
	getFrameCamera() {
		return { position: this.#cameraPosition, forward: this.#cameraForward, isMirrored: this.#isFrameMirrored };
	}

	//==============================================================================
	// 그릴 화면 사각형 설정. (뷰포트 픽셀, 왼쪽 위 원점, 다음 beginFrame 부터)
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @param { number } width
	 * @param { number } height
	 */
	setScreenRect(x, y, width, height) {
		this.#screenRect = { x: x, y: y, width: System.Math.max(0, width), height: System.Math.max(0, height) };
	}

	//==============================================================================
	// 그릴 화면 사각형 풀기. (뷰포트 전체에 그림)
	//==============================================================================
	clearScreenRect() {
		this.#screenRect = null;
	}

	//==============================================================================
	// 그릴 화면 사각형 반환. (없으면 null)
	//==============================================================================
	/**
	 * @returns { object | null } { x, y, width, height }
	 */
	getScreenRect() {
		return this.#screenRect;
	}

	//==============================================================================
	// 화면 사각형 걸기. (beginFrame 이 상태를 적은 뒤, 클립 x, y 에 사각형의 비를 곱하고 자리를 더한 뒤 가위를 켠다)
	//==============================================================================
	applyScreenRect() {
		const screenRect = this.#screenRect;
		const savedState = this.#savedState;
		if (screenRect === null || savedState === null) {
			return;
		}
		const viewport = savedState.viewport;
		const viewportWidth = System.Math.max(1, viewport[2]);
		const viewportHeight = System.Math.max(1, viewport[3]);
		const scaleX = screenRect.width / viewportWidth;
		const scaleY = screenRect.height / viewportHeight;
		const offsetX = (screenRect.x * 2 + screenRect.width) / viewportWidth - 1;
		const offsetY = 1 - (screenRect.y * 2 + screenRect.height) / viewportHeight;
		const elements = this.#viewProjectionElements;
		for (let columnIndex = 0; columnIndex < 4; ++columnIndex) {
			const clipW = elements[columnIndex * 4 + 3];
			elements[columnIndex * 4] = elements[columnIndex * 4] * scaleX + clipW * offsetX;
			elements[columnIndex * 4 + 1] = elements[columnIndex * 4 + 1] * scaleY + clipW * offsetY;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const scissorLeft = System.Math.floor(screenRect.x);
		const scissorBottom = System.Math.floor(viewportHeight - screenRect.y - screenRect.height);
		const scissorRight = System.Math.ceil(screenRect.x + screenRect.width);
		const scissorTop = System.Math.ceil(viewportHeight - screenRect.y);
		webGL2RenderingContext.enable(webGL2RenderingContext.SCISSOR_TEST);
		webGL2RenderingContext.scissor(viewport[0] + scissorLeft, viewport[1] + scissorBottom, scissorRight - scissorLeft, scissorTop - scissorBottom);
		this.#isScissorApplied = true;
	}

	//==============================================================================
	// 화면 사각형의 가위 풀기. (applyScreenRect 가 켰을 때만)
	//==============================================================================
	releaseScreenRect() {
		if (!this.#isScissorApplied) {
			return;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.disable(webGL2RenderingContext.SCISSOR_TEST);
		this.#isScissorApplied = false;
	}

	//==============================================================================
	// 그림자 깊이 패스 시작. (ShadowMap 의 프레임버퍼에 빛의 보기와 투영으로, 앞의 프레임버퍼와 뷰포트는 endShadowPass 가 돌린다)
	//==============================================================================
	/**
	 * @param { object } shadowMap - ShadowMap
	 */
	beginShadowPass(shadowMap) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		this.saveState();
		const lightViewProjectionMatrix = shadowMap.getLightViewProjectionMatrix();
		this.#viewProjectionElements.set(lightViewProjectionMatrix.getElements());
		this.#frustumPlanes = extractFrustumPlanes(lightViewProjectionMatrix);
		this.#isShadowPass = true;
		this.#isFrameMirrored = false;
		this.#frameSerial += 1;
		shadowMap.beginRender();
		webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);
		webGL2RenderingContext.depthFunc(webGL2RenderingContext.LEQUAL);
		webGL2RenderingContext.enable(webGL2RenderingContext.CULL_FACE);
		webGL2RenderingContext.cullFace(webGL2RenderingContext.BACK);
	}

	//==============================================================================
	// 그림자 깊이 패스 끝. (프레임버퍼와 뷰포트와 상태를 돌린다)
	//==============================================================================
	endShadowPass() {
		this.#isShadowPass = false;
		this.#frameSerial += 1;
		this.restoreState(true);
	}

	//==============================================================================
	// 경계 구가 절두체 안에 드는지. (모형 행렬로 옮긴 가운데, 가장 큰 크기를 곱한 반지름)
	//==============================================================================
	/**
	 * @param { object } mesh
	 * @param { Float32Array } modelElements
	 * @returns { boolean }
	 */
	isVisible(mesh, modelElements) {
		const center = mesh.boundingCenter;
		const centerX = modelElements[0] * center[0] + modelElements[4] * center[1] + modelElements[8] * center[2] + modelElements[12];
		const centerY = modelElements[1] * center[0] + modelElements[5] * center[1] + modelElements[9] * center[2] + modelElements[13];
		const centerZ = modelElements[2] * center[0] + modelElements[6] * center[1] + modelElements[10] * center[2] + modelElements[14];
		const radius = mesh.boundingRadius * readMaximumScale(modelElements);
		for (const plane of this.#frustumPlanes) {
			if (plane[0] * centerX + plane[1] * centerY + plane[2] * centerZ + plane[3] < -radius) {
				return false;
			}
		}
		return true;
	}

	//==============================================================================
	// 모형 하나 그리기. (그림자 패스면 깊이만, 화면 밖이면 건너뛴다)
	//==============================================================================
	/**
	 * @param { object } mesh - createMesh 의 결과.
	 * @param { Matrix4 } modelMatrix
	 * @param { object } [options] - 클래스 머리말의 그리기 꼴과 jointMatrices Float32Array, hasOutline (기본 true), isCulled (기본 true)
	 */
	drawMesh(mesh, modelMatrix, options = {}) {
		if (mesh === null) {
			return;
		}
		const modelElements = modelMatrix.getElements();
		const isCulled = options.isCulled !== false;
		if (isCulled && !this.isVisible(mesh, modelElements)) {
			this.#frameStatistics.culledObjectCount += 1;
			return;
		}
		this.#frameStatistics.drawnObjectCount += 1;
		this.drawWithCount(mesh, modelElements, 0, options, null);
	}

	//==============================================================================
	// 같은 모형 여럿을 한 번에 그리기. (GPU 인스턴싱, 화면 밖 인스턴스는 걸러 남은 것만 올린다, 뼈대 모형은 같은 자세)
	//==============================================================================
	/**
	 * @param { object } mesh
	 * @param { Array<object> } instances - { modelMatrix: Matrix4, tintColor: [r, g, b, a] } 의 배열.
	 * @param { object } [options]
	 */
	drawMeshInstanced(mesh, instances, options = {}) {
		if (mesh === null) {
			return;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const isCulled = options.isCulled !== false;
		if (this.#instanceData.length < instances.length * TOON_INSTANCE_FLOAT_COUNT) {
			this.#instanceData = new System.Float32Array(instances.length * TOON_INSTANCE_FLOAT_COUNT);
		}
		const instanceData = this.#instanceData;
		let instanceCount = 0;
		for (const instance of instances) {
			const modelElements = instance.modelMatrix.getElements();
			if (isCulled && !this.isVisible(mesh, modelElements)) {
				this.#frameStatistics.culledObjectCount += 1;
				continue;
			}
			const offset = instanceCount * TOON_INSTANCE_FLOAT_COUNT;
			instanceData.set(modelElements, offset);
			const tintColor = instance.tintColor !== undefined ? instance.tintColor : [1, 1, 1, 1];
			instanceData[offset + 16] = tintColor[0];
			instanceData[offset + 17] = tintColor[1];
			instanceData[offset + 18] = tintColor[2];
			instanceData[offset + 19] = tintColor[3];
			instanceCount += 1;
		}
		this.#frameStatistics.drawnObjectCount += instanceCount;
		if (instanceCount === 0) {
			return;
		}
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, mesh.instanceBuffer);
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, instanceData.subarray(0, instanceCount * TOON_INSTANCE_FLOAT_COUNT), webGL2RenderingContext.DYNAMIC_DRAW);
		// 감기는 첫 인스턴스의 행렬로 가린다. (options.isMirrored 를 주면 그것)
		const mirrorElements = instanceData.subarray(0, 16);
		this.drawWithCount(mesh, mirrorElements, instanceCount, options, null);
	}

	//==============================================================================
	// 영구 인스턴스 버퍼로 그리기. (거르지 않음, instanceCount 개, 꼴에 행렬이 없으면 정점 조각이 자리를 정한다)
	//==============================================================================
	/**
	 * @param { object } mesh
	 * @param { object } instanceBuffer - createInstanceBuffer 의 결과.
	 * @param { number } instanceCount
	 * @param { object } [options]
	 */
	drawMeshInstanceBuffer(mesh, instanceBuffer, instanceCount, options = {}) {
		if (mesh === null || instanceCount <= 0) {
			return;
		}
		const maximumCount = System.Math.floor(instanceBuffer.floatCount / System.Math.max(1, instanceBuffer.layout.getFloatCount()));
		const count = System.Math.min(instanceCount, maximumCount);
		if (count <= 0) {
			return;
		}
		this.#frameStatistics.drawnObjectCount += count;
		this.drawWithCount(mesh, Matrix4.createIdentity().getElements(), count, options, instanceBuffer);
	}

	//==============================================================================
	// 모형 하나의 바깥선만 그리기. (거르지도 세지도 않는다, 껍데기가 없거나 hasOutline 이 false 면 그리지 않는다)
	//==============================================================================
	/**
	 * @param { object } mesh
	 * @param { Matrix4 } modelMatrix
	 * @param { object } [options] - drawMesh 와 같다.
	 */
	drawMeshOutline(mesh, modelMatrix, options = {}) {
		if (mesh === null || mesh.outlineVertexArray === null || options.hasOutline === false || this.#isShadowPass) {
			return;
		}
		const outlineOptions = System.Object.assign({}, options, { isBodyDrawn: false });
		this.drawWithCount(mesh, modelMatrix.getElements(), 0, outlineOptions, null);
	}

	//==============================================================================
	// 프로그램의 프레임 값 올리기. (보기와 투영, 카메라, HDR, 그림자, 바깥선 색, 이번 프레임에 이미 올렸으면 건너뛴다)
	//==============================================================================
	/**
	 * @param { object } entry - 프로그램 칸.
	 */
	uploadFrameUniforms(entry) {
		if (entry.frameSerial === this.#frameSerial) {
			return;
		}
		entry.frameSerial = this.#frameSerial;
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const shaderProgram = entry.program;
		webGL2RenderingContext.uniformMatrix4fv(shaderProgram.getUniformLocation("viewProjectionMatrix"), false, this.#viewProjectionElements);
		if (entry.kind === ToonProgramKind.outline) {
			const outlineColor = this.#outlineColor;
			webGL2RenderingContext.uniform4f(shaderProgram.getUniformLocation("outlineColor"), outlineColor[0], outlineColor[1], outlineColor[2], outlineColor[3]);
			webGL2RenderingContext.uniform1f(shaderProgram.getUniformLocation("hdrOutput"), this.#isHdrOutput ? 1 : 0);
			return;
		}
		if (entry.kind !== ToonProgramKind.solid) {
			return;
		}
		const cameraPosition = this.#cameraPosition;
		const cameraForward = this.#cameraForward;
		webGL2RenderingContext.uniform4f(shaderProgram.getUniformLocation("cameraPosition"), cameraPosition[0], cameraPosition[1], cameraPosition[2], cameraPosition[3]);
		webGL2RenderingContext.uniform3f(shaderProgram.getUniformLocation("cameraForward"), cameraForward[0], cameraForward[1], cameraForward[2]);
		webGL2RenderingContext.uniform1f(shaderProgram.getUniformLocation("hdrOutput"), this.#isHdrOutput ? 1 : 0);
		const shadowInput = this.#shadowInput;
		if (shadowInput !== null) {
			webGL2RenderingContext.uniform1f(shaderProgram.getUniformLocation("shadowEnabled"), 1);
			webGL2RenderingContext.uniform1f(shaderProgram.getUniformLocation("shadowStrength"), shadowInput.strength);
			webGL2RenderingContext.uniform1f(shaderProgram.getUniformLocation("shadowTexelSize"), 1 / System.Math.max(1, shadowInput.resolution));
			webGL2RenderingContext.uniformMatrix4fv(shaderProgram.getUniformLocation("lightViewProjectionMatrix"), false, shadowInput.lightViewProjectionMatrix.getElements());
		}
		else {
			webGL2RenderingContext.uniform1f(shaderProgram.getUniformLocation("shadowEnabled"), 0);
		}
	}

	//==============================================================================
	// 몸 프로그램의 빛 묶음 올리기. (같은 묶음, 같은 판이면 건너뛴다)
	//==============================================================================
	/**
	 * @param { object } entry
	 * @param { ToonLightSet } lightSet
	 */
	uploadLightUniforms(entry, lightSet) {
		if (entry.lightSet === lightSet && entry.lightVersion === lightSet.getVersion()) {
			return;
		}
		entry.lightSet = lightSet;
		entry.lightVersion = lightSet.getVersion();
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const shaderProgram = entry.program;
		const sunDirection = lightSet.getSunDirection();
		const sunColor = lightSet.getSunColor();
		const skyColor = lightSet.getSkyColor();
		const groundColor = lightSet.getGroundColor();
		const fillLight = lightSet.getFillLight();
		const rimLight = lightSet.getRimLight();
		const specular = lightSet.getSpecular();
		const bandRamp = lightSet.getBandRamp();
		webGL2RenderingContext.uniform3f(shaderProgram.getUniformLocation("sunDirection"), sunDirection[0], sunDirection[1], sunDirection[2]);
		webGL2RenderingContext.uniform3f(shaderProgram.getUniformLocation("sunColor"), sunColor[0], sunColor[1], sunColor[2]);
		webGL2RenderingContext.uniform3f(shaderProgram.getUniformLocation("skyColor"), skyColor[0], skyColor[1], skyColor[2]);
		webGL2RenderingContext.uniform3f(shaderProgram.getUniformLocation("groundColor"), groundColor[0], groundColor[1], groundColor[2]);
		webGL2RenderingContext.uniform3f(shaderProgram.getUniformLocation("fillDirection"), fillLight.direction[0], fillLight.direction[1], fillLight.direction[2]);
		webGL2RenderingContext.uniform3f(shaderProgram.getUniformLocation("fillColor"), fillLight.color[0], fillLight.color[1], fillLight.color[2]);
		webGL2RenderingContext.uniform4f(shaderProgram.getUniformLocation("rimLight"), rimLight.color[0], rimLight.color[1], rimLight.color[2], rimLight.power);
		webGL2RenderingContext.uniform2f(shaderProgram.getUniformLocation("specularLight"), specular.strength, specular.exponent);
		webGL2RenderingContext.uniform1f(shaderProgram.getUniformLocation("energyNormalized"), lightSet.getLightModel().isEnergyNormalized ? 1 : 0);
		webGL2RenderingContext.uniform1f(shaderProgram.getUniformLocation("bandCount"), lightSet.getBandCount());
		const thresholdValues = this.#bandThresholdValues;
		const bandValues = this.#bandValueValues;
		thresholdValues.fill(0);
		bandValues.fill(0);
		thresholdValues.set(bandRamp.thresholds);
		bandValues.set(bandRamp.values);
		webGL2RenderingContext.uniform1i(shaderProgram.getUniformLocation("bandRampCount"), bandRamp.values.length);
		webGL2RenderingContext.uniform1f(shaderProgram.getUniformLocation("bandRampHalfLambert"), bandRamp.isHalfLambert ? 1 : 0);
		webGL2RenderingContext.uniform1fv(shaderProgram.getUniformLocation("bandRampThresholds"), thresholdValues);
		webGL2RenderingContext.uniform1fv(shaderProgram.getUniformLocation("bandRampValues"), bandValues);
		const pointLights = lightSet.getPointLights();
		const pointLightCount = lightSet.getPointLightCount();
		const positionValues = this.#pointPositionValues;
		const colorValues = this.#pointColorValues;
		const shapeValues = this.#pointShapeValues;
		positionValues.fill(0);
		colorValues.fill(0);
		shapeValues.fill(0);
		for (let lightIndex = 0; lightIndex < pointLightCount; ++lightIndex) {
			const pointLight = pointLights[lightIndex];
			positionValues.set([pointLight.position[0], pointLight.position[1], pointLight.position[2], pointLight.range], lightIndex * 4);
			colorValues.set([pointLight.color[0] * pointLight.intensity, pointLight.color[1] * pointLight.intensity, pointLight.color[2] * pointLight.intensity], lightIndex * 3);
			shapeValues.set([pointLight.decay, pointLight.rangeExponent, pointLight.wrap], lightIndex * 3);
		}
		webGL2RenderingContext.uniform1i(shaderProgram.getUniformLocation("pointLightCount"), pointLightCount);
		webGL2RenderingContext.uniform4fv(shaderProgram.getUniformLocation("pointLightPositions"), positionValues);
		webGL2RenderingContext.uniform3fv(shaderProgram.getUniformLocation("pointLightColors"), colorValues);
		webGL2RenderingContext.uniform3fv(shaderProgram.getUniformLocation("pointLightShapes"), shapeValues);
	}

	//==============================================================================
	// 그리기마다의 공용 유니폼 올리기. (모형 행렬, 뼈대, 인스턴싱)
	//==============================================================================
	/**
	 * @param { ShaderProgram } shaderProgram
	 * @param { ArrayLike<number> } modelElements
	 * @param { boolean } isSkinned
	 * @param { number } instancedMode - 0 아님, 1 인스턴스 행렬과 틴트, 2 인스턴스 틴트만
	 * @param { Float32Array | null } jointMatrices
	 */
	uploadDrawUniforms(shaderProgram, modelElements, isSkinned, instancedMode, jointMatrices) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.uniformMatrix4fv(shaderProgram.getUniformLocation("modelMatrix"), false, modelElements);
		webGL2RenderingContext.uniform1f(shaderProgram.getUniformLocation("instanced"), instancedMode);
		webGL2RenderingContext.uniform1f(shaderProgram.getUniformLocation("skinned"), isSkinned ? 1 : 0);
		if (isSkinned) {
			const jointFloatCount = System.Math.floor(System.Math.min(jointMatrices.length, TOON_MAXIMUM_JOINTS * 16) / 16) * 16;
			const jointValues = jointMatrices.length === jointFloatCount ? jointMatrices : jointMatrices.subarray(0, jointFloatCount);
			webGL2RenderingContext.uniformMatrix4fv(shaderProgram.getUniformLocation("jointMatrices"), false, jointValues);
		}
	}

	//==============================================================================
	// 텍스처 유닛에 묶기. (없으면 흰 텍스처)
	//==============================================================================
	/**
	 * @param { number } unit
	 * @param { WebGLTexture | null | undefined } texture
	 */
	bindTextureUnit(unit, texture) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + unit);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, texture !== undefined && texture !== null ? texture : this.#whiteTexture);
	}

	//==============================================================================
	// 그리기 본체. (instanceCount 가 0 이면 보통, 아니면 인스턴스로, instanceBuffer 가 있으면 그 꼴로)
	//==============================================================================
	/**
	 * @param { object } mesh
	 * @param { ArrayLike<number> } modelElements
	 * @param { number } instanceCount
	 * @param { object } options
	 * @param { object | null } instanceBuffer
	 */
	drawWithCount(mesh, modelElements, instanceCount, options, instanceBuffer) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const material = options.material !== undefined ? options.material : null;
		const instanceLayout = instanceBuffer !== null ? instanceBuffer.layout : null;
		const programSet = this.readProgramSet(material, instanceLayout);
		if (programSet === null) {
			return;
		}
		const jointMatrices = options.jointMatrices !== undefined ? options.jointMatrices : null;
		const isSkinned = mesh.isSkinned && jointMatrices !== null;
		const isInstanced = instanceCount > 0;
		let instancedMode = isInstanced ? 1 : 0;
		let bodyVertexArray = mesh.bodyVertexArray;
		let outlineVertexArray = mesh.outlineVertexArray;
		if (instanceBuffer !== null) {
			const vertexArrays = this.readInstanceVertexArrays(mesh, instanceBuffer);
			bodyVertexArray = vertexArrays.body;
			outlineVertexArray = vertexArrays.outline;
			instancedMode = instanceLayout.hasMatrix() ? 1 : 2;
			if (!instanceLayout.hasTint()) {
				webGL2RenderingContext.vertexAttrib4f(TOON_ATTRIBUTE_LOCATIONS.instanceTint, 1, 1, 1, 1);
			}
		}
		const indexStart = System.Math.max(0, System.Math.min(mesh.bodyIndexCount, options.indexStart !== undefined ? options.indexStart : 0));
		const indexCount = options.indexCount !== undefined && options.indexCount > 0 ? System.Math.min(options.indexCount, mesh.bodyIndexCount - indexStart) : mesh.bodyIndexCount - indexStart;
		const outlineIndexStart = System.Math.max(0, System.Math.min(mesh.outlineIndexCount, options.outlineIndexStart !== undefined ? options.outlineIndexStart : 0));
		const outlineIndexCount = options.outlineIndexCount !== undefined && options.outlineIndexCount > 0 ? System.Math.min(options.outlineIndexCount, mesh.outlineIndexCount - outlineIndexStart) : mesh.outlineIndexCount - outlineIndexStart;
		const isMirroredDraw = options.isMirrored !== undefined ? options.isMirrored === true : readMatrixDeterminant(modelElements) < 0;
		const isMirrored = isMirroredDraw !== this.#isFrameMirrored;
		webGL2RenderingContext.frontFace(isMirrored ? webGL2RenderingContext.CW : webGL2RenderingContext.CCW);
		const onBeforeDraw = typeof options.onBeforeDraw === "function" ? options.onBeforeDraw : null;
		const drawElements = (start, count) => {
			if (count <= 0) {
				return;
			}
			if (isInstanced) {
				webGL2RenderingContext.drawElementsInstanced(webGL2RenderingContext.TRIANGLES, count, webGL2RenderingContext.UNSIGNED_INT, start * 4, instanceCount);
			}
			else {
				webGL2RenderingContext.drawElements(webGL2RenderingContext.TRIANGLES, count, webGL2RenderingContext.UNSIGNED_INT, start * 4);
			}
			this.#frameStatistics.drawCallCount += 1;
		};

		// 그림자 패스. (몸의 깊이만)
		if (this.#isShadowPass) {
			const depthEntry = programSet.depth;
			depthEntry.program.use();
			this.uploadFrameUniforms(depthEntry);
			this.uploadDrawUniforms(depthEntry.program, modelElements, isSkinned, instancedMode, jointMatrices);
			if (onBeforeDraw !== null) {
				onBeforeDraw(depthEntry.program, webGL2RenderingContext, ToonProgramKind.depth);
			}
			webGL2RenderingContext.bindVertexArray(bodyVertexArray);
			drawElements(indexStart, indexCount);
			webGL2RenderingContext.frontFace(webGL2RenderingContext.CCW);
			return;
		}

		const tintColor = options.tintColor !== undefined ? options.tintColor : [1, 1, 1, 1];
		const alpha = options.alpha !== undefined ? options.alpha : 1;
		const blendMode = options.blendMode !== undefined ? options.blendMode : ToonBlendMode.alpha;
		const hasOutline = options.hasOutline !== false && outlineVertexArray !== null;
		const isTransparent = alpha < 1 || tintColor[3] < 1 || blendMode !== ToonBlendMode.alpha;
		const premultipliedOutput = blendMode !== ToonBlendMode.alpha ? 1 : 0;
		if (isTransparent) {
			webGL2RenderingContext.enable(webGL2RenderingContext.BLEND);
			if (blendMode === ToonBlendMode.additive) {
				webGL2RenderingContext.blendFunc(webGL2RenderingContext.ONE, webGL2RenderingContext.ONE);
			}
			else if (blendMode === ToonBlendMode.premultiplied) {
				webGL2RenderingContext.blendFunc(webGL2RenderingContext.ONE, webGL2RenderingContext.ONE_MINUS_SRC_ALPHA);
			}
			else {
				webGL2RenderingContext.blendFunc(webGL2RenderingContext.SRC_ALPHA, webGL2RenderingContext.ONE_MINUS_SRC_ALPHA);
			}
		}

		// 바깥선. (껍데기의 뒷면만)
		if (hasOutline) {
			const outlineEntry = programSet.outline;
			const outlineProgram = outlineEntry.program;
			outlineProgram.use();
			this.uploadFrameUniforms(outlineEntry);
			this.uploadDrawUniforms(outlineProgram, modelElements, isSkinned, instancedMode, jointMatrices);
			webGL2RenderingContext.uniform1f(outlineProgram.getUniformLocation("alpha"), alpha);
			webGL2RenderingContext.uniform1f(outlineProgram.getUniformLocation("premultipliedOutput"), premultipliedOutput);
			if (onBeforeDraw !== null) {
				onBeforeDraw(outlineProgram, webGL2RenderingContext, ToonProgramKind.outline);
			}
			webGL2RenderingContext.cullFace(webGL2RenderingContext.FRONT);
			webGL2RenderingContext.bindVertexArray(outlineVertexArray);
			drawElements(outlineIndexStart, outlineIndexCount);
		}
		if (options.isBodyDrawn === false) {
			if (isTransparent) {
				webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);
			}
			webGL2RenderingContext.cullFace(webGL2RenderingContext.BACK);
			webGL2RenderingContext.frontFace(webGL2RenderingContext.CCW);
			return;
		}

		// 몸.
		const solidEntry = programSet.solid;
		const solidProgram = solidEntry.program;
		solidProgram.use();
		this.uploadFrameUniforms(solidEntry);
		this.uploadLightUniforms(solidEntry, options.lightSet !== undefined && options.lightSet !== null ? options.lightSet : this.#lightSet);
		this.uploadDrawUniforms(solidProgram, modelElements, isSkinned, instancedMode, jointMatrices);
		const emissiveColor = options.emissiveColor !== undefined ? options.emissiveColor : [0, 0, 0];
		const decalColor = options.decalColor !== undefined ? options.decalColor : [1, 1, 1];
		const uvTransform = options.uvTransform !== undefined ? options.uvTransform : [0, 0, 1, 1];
		const decalUvTransform = options.decalUvTransform !== undefined ? options.decalUvTransform : [0, 0, 1, 1];
		const baseColorTexture = options.baseColorTexture !== undefined ? options.baseColorTexture : null;
		const emissiveTexture = options.emissiveTexture !== undefined ? options.emissiveTexture : null;
		const decalTexture = options.decalTexture !== undefined ? options.decalTexture : null;
		webGL2RenderingContext.uniform4f(solidProgram.getUniformLocation("tintColor"), tintColor[0], tintColor[1], tintColor[2], tintColor[3]);
		webGL2RenderingContext.uniform1f(solidProgram.getUniformLocation("tintAmount"), options.tintAmount !== undefined && options.tintAmount !== null ? System.Math.max(0, System.Math.min(1, options.tintAmount)) : -1);
		webGL2RenderingContext.uniform1f(solidProgram.getUniformLocation("alpha"), alpha);
		webGL2RenderingContext.uniform1f(solidProgram.getUniformLocation("glowScale"), options.glowScale !== undefined ? options.glowScale : 1);
		webGL2RenderingContext.uniform1f(solidProgram.getUniformLocation("colorScale"), options.colorScale !== undefined ? options.colorScale : 1);
		webGL2RenderingContext.uniform4f(solidProgram.getUniformLocation("emissiveColor"), emissiveColor[0], emissiveColor[1], emissiveColor[2], options.emissiveIntensity !== undefined ? options.emissiveIntensity : 1);
		webGL2RenderingContext.uniform1f(solidProgram.getUniformLocation("softEdge"), options.softEdge !== undefined ? options.softEdge : 0);
		webGL2RenderingContext.uniform1f(solidProgram.getUniformLocation("alphaCutoff"), options.alphaCutoff !== undefined ? options.alphaCutoff : 0);
		webGL2RenderingContext.uniform1f(solidProgram.getUniformLocation("premultipliedOutput"), premultipliedOutput);
		webGL2RenderingContext.uniform3f(solidProgram.getUniformLocation("textureEnabled"), baseColorTexture !== null ? 1 : 0, emissiveTexture !== null ? 1 : 0, decalTexture !== null ? 1 : 0);
		webGL2RenderingContext.uniform4f(solidProgram.getUniformLocation("uvTransform"), uvTransform[0], uvTransform[1], uvTransform[2], uvTransform[3]);
		webGL2RenderingContext.uniform4f(solidProgram.getUniformLocation("decalUvTransform"), decalUvTransform[0], decalUvTransform[1], decalUvTransform[2], decalUvTransform[3]);
		webGL2RenderingContext.uniform4f(solidProgram.getUniformLocation("decalColor"), decalColor[0], decalColor[1], decalColor[2], options.decalEmission !== undefined ? options.decalEmission : 0);
		const shadowInput = this.#shadowInput;
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + SHADOW_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, shadowInput !== null ? shadowInput.depthTexture : this.#emptyShadowTexture);
		this.bindTextureUnit(BASE_COLOR_TEXTURE_UNIT, baseColorTexture);
		this.bindTextureUnit(EMISSIVE_TEXTURE_UNIT, emissiveTexture);
		this.bindTextureUnit(DECAL_TEXTURE_UNIT, decalTexture);
		if (options.textures !== undefined && options.textures !== null) {
			let unit = FIRST_MATERIAL_TEXTURE_UNIT;
			for (const [uniformName, texture] of System.Object.entries(options.textures)) {
				if (unit >= FIRST_MATERIAL_TEXTURE_UNIT + TOON_MAXIMUM_MATERIAL_TEXTURES) {
					break;
				}
				this.bindTextureUnit(unit, texture);
				webGL2RenderingContext.uniform1i(solidProgram.getUniformLocation(uniformName), unit);
				unit += 1;
			}
		}
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		if (onBeforeDraw !== null) {
			onBeforeDraw(solidProgram, webGL2RenderingContext, ToonProgramKind.solid);
		}
		webGL2RenderingContext.cullFace(webGL2RenderingContext.BACK);
		webGL2RenderingContext.bindVertexArray(bodyVertexArray);
		drawElements(indexStart, indexCount);
		if (isTransparent) {
			webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);
		}
		webGL2RenderingContext.frontFace(webGL2RenderingContext.CCW);
	}

	//==============================================================================
	// 빛 설정. (해가 비추는 방향, 해의 색, 하늘색, 땅색, 모두 선형 색 0 ~, HDR 이면 1 을 넘어도 된다, 기본 빛 묶음)
	//==============================================================================
	/**
	 * @param { Array<number> } sunDirection
	 * @param { Array<number> } sunColor
	 * @param { Array<number> } skyColor
	 * @param { Array<number> } groundColor
	 */
	setLight(sunDirection, sunColor, skyColor, groundColor) {
		this.#lightSet.setLight(sunDirection, sunColor, skyColor, groundColor);
	}

	//==============================================================================
	// 해가 비추는 방향 설정. (빛이 나아가는 쪽, ToonLightSet 머리말)
	//==============================================================================
	/**
	 * @param { Array<number> } sunDirection
	 */
	setSunDirection(sunDirection) {
		this.#lightSet.setSunDirection(sunDirection);
	}

	//==============================================================================
	// 해가 비추는 방향 반환. (ShadowMap.updateLightMatrix 에 넘긴다)
	//==============================================================================
	/**
	 * @returns { Array<number> }
	 */
	getSunDirection() {
		return this.#lightSet.getSunDirection();
	}

	//==============================================================================
	// 채움 빛 설정. (빛이 나아가는 방향과 선형 색)
	//==============================================================================
	/**
	 * @param { Array<number> } fillDirection
	 * @param { Array<number> } fillColor
	 */
	setFillLight(fillDirection, fillColor) {
		this.#lightSet.setFillLight(fillDirection, fillColor);
	}

	//==============================================================================
	// 림 빛 설정. (선형 색과 거듭제곱)
	//==============================================================================
	/**
	 * @param { Array<number> } rimColor
	 * @param { number } rimPower
	 */
	setRimLight(rimColor, rimPower) {
		this.#lightSet.setRimLight(rimColor, rimPower);
	}

	//==============================================================================
	// 정반사 설정. (세기와 지수)
	//==============================================================================
	/**
	 * @param { number } specularStrength
	 * @param { number } [specularExponent]
	 */
	setSpecular(specularStrength, specularExponent = 48) {
		this.#lightSet.setSpecular(specularStrength, specularExponent);
	}

	//==============================================================================
	// 점광 설정. (ToonLightSet.setPointLights)
	//==============================================================================
	/**
	 * @param { Array<object> } pointLights
	 */
	setPointLights(pointLights) {
		this.#lightSet.setPointLights(pointLights);
	}

	//==============================================================================
	// 점광 수의 한도 설정.
	//==============================================================================
	/**
	 * @param { number } pointLightLimit
	 */
	setPointLightLimit(pointLightLimit) {
		this.#lightSet.setPointLightLimit(pointLightLimit);
	}

	//==============================================================================
	// 셀 셰이딩 칸 수 설정. (0 이면 부드럽게)
	//==============================================================================
	/**
	 * @param { number } bandCount
	 */
	setBandCount(bandCount) {
		this.#lightSet.setBandCount(bandCount);
	}

	//==============================================================================
	// 띠 램프 설정. (ToonLightSet.setBandRamp)
	//==============================================================================
	/**
	 * @param { Array<number> } thresholds
	 * @param { Array<number> } values
	 * @param { boolean } isHalfLambert
	 */
	setBandRamp(thresholds, values, isHalfLambert) {
		this.#lightSet.setBandRamp(thresholds, values, isHalfLambert);
	}

	//==============================================================================
	// 띠 램프 끄기.
	//==============================================================================
	clearBandRamp() {
		this.#lightSet.clearBandRamp();
	}

	//==============================================================================
	// 빛 꼴 설정. ({ isEnergyNormalized })
	//==============================================================================
	/**
	 * @param { object } lightModel
	 */
	setLightModel(lightModel) {
		this.#lightSet.setLightModel(lightModel);
	}

	//==============================================================================
	// 바깥선 색 설정. (sRGB 0 ~ 1 과 알파)
	//==============================================================================
	/**
	 * @param { Array<number> } outlineColor - [r, g, b, a]
	 */
	setOutlineColor(outlineColor) {
		this.#outlineColor = outlineColor.slice();
		this.#frameSerial += 1;
	}

	//==============================================================================
	// HDR 출력 설정. (true 면 감마를 걸지 않은 선형 색을 낸다)
	//==============================================================================
	/**
	 * @param { boolean } isHdrOutput
	 */
	setHdrOutput(isHdrOutput) {
		this.#isHdrOutput = isHdrOutput;
		this.#frameSerial += 1;
	}

	//==============================================================================
	// 받을 그림자 설정. (ShadowMap 이나 null, 세기 0 ~ 1)
	//==============================================================================
	/**
	 * @param { object | null } shadowMap - ShadowMap
	 * @param { number } strength
	 */
	setShadow(shadowMap, strength = 0.6) {
		this.#frameSerial += 1;
		if (shadowMap === null) {
			this.#shadowInput = null;
			return;
		}
		this.#shadowInput = { depthTexture: shadowMap.getDepthTexture(), lightViewProjectionMatrix: shadowMap.getLightViewProjectionMatrix(), resolution: shadowMap.getResolution(), strength: strength };
	}

	//==============================================================================
	// 이번 프레임의 그린 수와 거른 수와 드로우콜.
	//==============================================================================
	/**
	 * @returns { object } { drawCallCount, drawnObjectCount, culledObjectCount }
	 */
	getFrameStatistics() {
		return this.#frameStatistics;
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
	// 몸 프로그램 반환. (머티리얼을 주면 그 머티리얼의 것, 짓지 못했으면 null)
	//==============================================================================
	/**
	 * @param { ToonMaterial | null } [material]
	 * @returns { ShaderProgram | null }
	 */
	getSolidProgram(material = null) {
		const programSet = this.readProgramSet(material, null);
		return programSet !== null ? programSet.solid.program : null;
	}

	//==============================================================================
	// 바깥선 프로그램 반환.
	//==============================================================================
	/**
	 * @param { ToonMaterial | null } [material]
	 * @returns { ShaderProgram | null }
	 */
	getOutlineProgram(material = null) {
		const programSet = this.readProgramSet(material, null);
		return programSet !== null ? programSet.outline.program : null;
	}

	//==============================================================================
	// 그림자 깊이 프로그램 반환.
	//==============================================================================
	/**
	 * @param { ToonMaterial | null } [material]
	 * @returns { ShaderProgram | null }
	 */
	getDepthProgram(material = null) {
		const programSet = this.readProgramSet(material, null);
		return programSet !== null ? programSet.depth.program : null;
	}
}
