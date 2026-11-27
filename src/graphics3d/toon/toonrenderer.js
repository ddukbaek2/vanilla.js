//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Matrix4 } from "../../base/matrix4.js";
import { ShaderProgram } from "../../core/graphic/shaderprogram.js";
import { VERTEX_FLOAT_COUNT, SKIN_FLOAT_COUNT } from "./meshbuilder.js";
import { ToonLightSet, TOON_MAXIMUM_POINT_LIGHTS, TOON_MAXIMUM_BAND_STEPS } from "./toonlightset.js";
import { SHADOW_ATLAS_MAXIMUM_LIGHTS } from "../shadowmap.js";
import { ToonMaterial, ToonInstanceLayout, ToonBlendMode, ToonMatcapBlend, ToonBufferUsage, TOON_INSTANCE_MATRIX_NAME, TOON_INSTANCE_TINT_NAME } from "./toonmaterial.js";


/**
 * @example <caption>그늘, 림, 하이라이트, 점광과 스포트라이트를 걸고 한 프레임 그리기</caption>
 * import { ToonRenderer, ToonMesh, Matrix4, Vector3 } from "./vanilla.js";
 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
 * const renderer = new ToonRenderer(webGL2RenderingContext);
 * const builder = new ToonMesh.MeshBuilder();
 * builder.addPart(ToonMesh.createSphereGeometry(0.5, 32, 20), Matrix4.createTranslation(0, 0.5, 0), "#f0c8a0", { hasOutline: true });
 * builder.addPart(ToonMesh.createBoxGeometry(3, 0.1, 3), Matrix4.createTranslation(0, -0.05, 0), "#708090", { hasOutline: false });
 * const mesh = renderer.createMesh(builder.readArrays());
 * renderer.setShade({ step: 0.5, feather: 0.02, color: [0.6, 0.55, 0.75], secondStep: 0.2, secondFeather: 0.02, secondColor: [0.4, 0.36, 0.55], isHalfLambert: true });
 * renderer.setRimLight([0.5, 0.55, 0.7], 3, 0.2, 1);
 * renderer.setSpecular(0.6, 64, 0, [1, 1, 1]);
 * renderer.setPointLights([
 * 	{ position: [1.5, 1.5, 1], color: [1, 0.7, 0.4], intensity: 2, range: 5 },
 * 	{ position: [0, 3, 0], color: [0.6, 0.8, 1], intensity: 3, range: 6, direction: [0, -1, 0], innerConeAngle: 0.3, outerConeAngle: 0.6 },
 * ]);
 * const matcapTexture = renderer.createTexture({ width: 2, height: 2, data: new Uint8Array([60, 60, 70, 255, 255, 255, 255, 255, 60, 60, 70, 255, 160, 160, 180, 255]) }, { isMipmapped: false, isRepeated: false });
 * const viewMatrix = Matrix4.createLookAt(Vector3.create(2, 2, 3), Vector3.create(0, 0.4, 0), Vector3.create(0, 1, 0));
 * const projectionMatrix = Matrix4.createPerspective(Math.PI / 4, 1, 0.1, 100);
 * renderer.beginFrameWithMatrices(viewMatrix, projectionMatrix);
 * renderer.drawMesh(mesh, Matrix4.createIdentity(), { receivesShadow: false, specularScale: 1.5, matcapTexture: matcapTexture, matcapStrength: 0.5 });
 * renderer.endFrame();
 */


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 한 모형이 쓰는 뼈대 수의 상한. (셰이더의 유니폼 배열 크기, 엔진 SkinnedModelRenderer 와 같은 96)
export const TOON_MAXIMUM_JOINTS = 96;

// 인스턴스 하나의 수 개수. (행렬 16, 틴트 4)
export const TOON_INSTANCE_FLOAT_COUNT = 20;

// 텍스처 유닛. (점광 그림자 아틀라스 0, 램프, 매트캡, 해 그림자, 바탕색, 빛남, 데칼, 천사 고리, 머티리얼 텍스처는 8 부터 15 까지)
// - 유닛 0 은 엔진 2D 가 기억하는 유닛이라 beginFrame 이 묶음을 적어 두고 endFrame 이 돌린다.
const LOCAL_SHADOW_TEXTURE_UNIT = 0;
const RAMP_TEXTURE_UNIT = 1;
const MATCAP_TEXTURE_UNIT = 2;
const SHADOW_TEXTURE_UNIT = 3;
const BASE_COLOR_TEXTURE_UNIT = 4;
const EMISSIVE_TEXTURE_UNIT = 5;
const DECAL_TEXTURE_UNIT = 6;
const ANGEL_RING_TEXTURE_UNIT = 7;
const FIRST_MATERIAL_TEXTURE_UNIT = 8;

// 머티리얼이 그리기마다 묶을 수 있는 텍스처 수의 상한. (유닛 8 ~ 15)
export const TOON_MAXIMUM_MATERIAL_TEXTURES = 8;

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

/**
 * 그리기의 프로그램 종류. (onBeforeDraw 의 셋째 인자)
 * @example <caption>몸 프로그램에만 머티리얼 유니폼 쓰기</caption>
 * import { ToonRenderer, ToonMaterial, ToonProgramKind, ToonMesh, Matrix4, Vector3 } from "./vanilla.js";
 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
 * const material = new ToonMaterial({ name: "pulse", uniformChunk: "uniform float pulse;", surfaceChunk: "void applySurface(inout ToonSurface surface) { surface.emission += vec3(pulse); }" });
 * const builder = new ToonMesh.MeshBuilder();
 * builder.addPart(ToonMesh.createBoxGeometry(1, 1, 1), Matrix4.createIdentity(), "#d06060", { hasOutline: true });
 * const mesh = renderer.createMesh(builder.readArrays());
 * renderer.beginFrameWithMatrices(Matrix4.createLookAt(Vector3.create(2, 2, 3), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0)), Matrix4.createPerspective(0.8, 1, 0.1, 20));
 * renderer.drawMesh(mesh, Matrix4.createIdentity(), {
 * 	material: material,
 * 	onBeforeDraw: (program, context, kind) => {
 * 		if (kind === ToonProgramKind.solid) {
 * 			context.uniform1f(program.getUniformLocation("pulse"), 0.3);
 * 		}
 * 	},
 * });
 * renderer.endFrame();
 */
export const ToonProgramKind = System.Object.freeze({
	solid: "solid", // 몸.
	outline: "outline", // 바깥선 껍데기.
	depth: "depth", // 그림자 깊이.
});

// 세 정점 셰이더의 머리. (몸에만 있는 어트리뷰트도 모두 적는다, 바깥선 버텍스 어레이에 없는 것은 기본값으로 읽힘)
const VERTEX_HEAD_CHUNK = `#version 300 es
in vec3 vertexPosition;
in vec3 vertexNormal;
in vec3 vertexColor;
in vec2 vertexMaterial;
in vec4 vertexDetail;
in vec4 vertexUv;
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
	vec2 uv1;
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
	vertex.uv = vertexUv.xy;
	vertex.uv1 = vertexUv.zw;
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
out vec2 surfaceUv1;
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
	worldNormal = normalize(transpose(inverse(mat3(objectMatrix) * mat3(skinMatrix))) * vertex.localNormal);
	surfaceColor = vertex.color;
	surfaceMaterial = vertex.material;
	surfaceDetail = vertex.detail;
	surfaceUv = vertex.uv;
	surfaceUv1 = vertex.uv1;
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
in vec2 surfaceUv1;
in vec4 surfaceTint;
in vec4 lightSpacePosition;
uniform vec3 sunDirection;
uniform vec3 sunColor;
uniform vec3 skyColor;
uniform vec3 groundColor;
uniform vec3 fillDirection;
uniform vec3 fillColor;
uniform vec4 rimLight;
uniform vec2 rimShape;
uniform vec3 specularLight;
uniform vec3 specularColor;
uniform float energyNormalized;
uniform float lightIntensityLimit;
uniform int shadeStopCount;
uniform float shadeStopPositions[8];
uniform float shadeStopFeathers[8];
uniform vec3 shadeStopColors[8];
uniform float shadeHalfLambert;
uniform float rampTextureEnabled;
uniform sampler2D rampTexture;
uniform int pointLightCount;
uniform vec4 pointLightPositions[8];
uniform vec3 pointLightColors[8];
uniform vec3 pointLightShapes[8];
uniform vec4 pointLightSpots[8];
uniform vec2 pointLightCones[8];
uniform float pointLightShadowSlots[8];
uniform vec4 localShadowAtlas;
uniform vec4 localShadowPositions[4];
uniform vec4 localShadowForwards[4];
uniform vec4 localShadowUps[4];
uniform float localShadowTiles[4];
uniform sampler2DShadow localShadowTexture;
uniform vec4 lightColorUsage;
uniform vec3 lightColorUsageExtra;
uniform vec4 shadeRimLight;
uniform vec4 cameraPosition;
uniform vec3 cameraForward;
uniform mat3 viewRotation;
uniform vec2 cameraRoll;
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
uniform float receivesShadow;
uniform float shadeOffset;
uniform vec2 highlightScale;
uniform vec3 matcapSettings;
uniform sampler2D matcapTexture;
uniform vec4 angelRingSettings;
uniform vec3 angelRingColor;
uniform sampler2D angelRingTexture;
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
	vec2 uv1;
	vec3 localPosition;
	vec3 worldPosition;
	vec3 viewDirection;
	float shadeOffset;
	float specularMask;
	float rimMask;
};
struct ToonLighting {
	vec3 irradiance;
	vec3 specular;
	vec3 rim;
	float shadow;
	float sunLevel;
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
float readLuminance(vec3 color) {
	return dot(color, vec3(0.2126, 0.7152, 0.0722));
}
float readLightIntensity(vec3 color) {
	return dot(color, vec3(0.299, 0.587, 0.114));
}
vec3 readLimitedDirectionalColor(vec3 color) {
	float energyScale = energyNormalized > 0.5 ? RECIPROCAL_PI : 1.0;
	return lightIntensityLimit > 0.5 ? clamp(color * energyScale, 0.0, 1.0) / energyScale : color;
}
vec3 readLimitedLocalColor(vec3 color) {
	float energyScale = energyNormalized > 0.5 ? RECIPROCAL_PI : 1.0;
	return lightIntensityLimit > 0.5 ? color * min(1.0, 1.0 / max(0.001, readLightIntensity(color * energyScale))) : color;
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
float readLocalShadow(int slot, vec3 position, vec3 normal) {
	vec4 lightPosition = localShadowPositions[slot];
	vec4 forwardFar = localShadowForwards[slot];
	vec4 upTangent = localShadowUps[slot];
	float tile = localShadowTiles[slot];
	vec3 toPoint = position - lightPosition.xyz;
	vec3 forward = forwardFar.xyz;
	vec3 up = upTangent.xyz;
	float tangent = upTangent.w;
	if (tangent <= 0.0) {
		vec3 magnitude = abs(toPoint);
		if (magnitude.x >= magnitude.y && magnitude.x >= magnitude.z) {
			forward = vec3(toPoint.x >= 0.0 ? 1.0 : -1.0, 0.0, 0.0);
			up = vec3(0.0, 1.0, 0.0);
			tile += toPoint.x >= 0.0 ? 0.0 : 1.0;
		}
		else if (magnitude.y >= magnitude.z) {
			forward = vec3(0.0, toPoint.y >= 0.0 ? 1.0 : -1.0, 0.0);
			up = vec3(0.0, 0.0, 1.0);
			tile += toPoint.y >= 0.0 ? 2.0 : 3.0;
		}
		else {
			forward = vec3(0.0, 0.0, toPoint.z >= 0.0 ? 1.0 : -1.0);
			up = vec3(0.0, 1.0, 0.0);
			tile += toPoint.z >= 0.0 ? 4.0 : 5.0;
		}
		tangent = 1.0;
	}
	float near = lightPosition.w;
	float far = forwardFar.w;
	float tileSize = localShadowAtlas.y;
	float texel = localShadowAtlas.z;
	float along = dot(forward, toPoint);
	if (along <= near || along >= far) {
		return 1.0;
	}
	float slope = 1.0 - clamp(dot(normal, -normalize(toPoint)), 0.0, 1.0);
	vec3 offsetPoint = toPoint + normal * (2.0 * along * tangent * texel / tileSize) * (1.0 + 3.0 * slope);
	along = max(dot(forward, offsetPoint), near);
	vec3 right = cross(forward, up);
	vec2 projected = vec2(dot(right, offsetPoint), dot(up, offsetPoint)) / (along * tangent);
	if (abs(projected.x) > 1.0 || abs(projected.y) > 1.0) {
		return 1.0;
	}
	float depth = ((far + near) / (far - near) - 2.0 * far * near / ((far - near) * along)) * 0.5 + 0.5 - 0.0005;
	float grid = localShadowAtlas.x;
	vec2 origin = vec2(mod(tile, grid), floor(tile / grid)) * tileSize;
	vec2 center = origin + (projected * 0.5 + 0.5) * tileSize;
	vec2 low = origin + vec2(texel * 1.5);
	vec2 high = origin + vec2(tileSize - texel * 1.5);
	float lit = 0.0;
	for (int offsetY = -1; offsetY <= 1; ++offsetY) {
		for (int offsetX = -1; offsetX <= 1; ++offsetX) {
			lit += texture(localShadowTexture, vec3(clamp(center + vec2(float(offsetX), float(offsetY)) * texel, low, high), depth));
		}
	}
	return mix(1.0, lit / 9.0, localShadowAtlas.w);
}
vec3 readLightColor(vec3 color, float usage) {
	return mix(vec3(readLightIntensity(color)), color, usage);
}
float readToonCoordinate(float cosine, float offset) {
	return (shadeHalfLambert > 0.5 ? cosine * 0.5 + 0.5 : max(cosine, 0.0)) + offset;
}
vec3 readShadeRamp(float coordinate) {
	if (rampTextureEnabled > 0.5) {
		return toLinear(textureLod(rampTexture, vec2(clamp(coordinate, 0.0, 1.0), 0.5), 0.0).rgb);
	}
	if (shadeStopCount < 2) {
		return vec3(clamp(coordinate, 0.0, 1.0));
	}
	float edgeWidth = max(fwidth(coordinate), 0.0001);
	vec3 color = shadeStopColors[0];
	for (int index = 1; index < 8; ++index) {
		if (index >= shadeStopCount) {
			break;
		}
		float feather = max(shadeStopFeathers[index], edgeWidth);
		color = mix(color, shadeStopColors[index], clamp((coordinate - shadeStopPositions[index] + feather) / feather, 0.0, 1.0));
	}
	return color;
}
float readShadeLevel(vec3 rampColor, float cosine) {
	float bottom;
	float top;
	if (rampTextureEnabled > 0.5) {
		bottom = readLuminance(toLinear(textureLod(rampTexture, vec2(0.0, 0.5), 0.0).rgb));
		top = readLuminance(toLinear(textureLod(rampTexture, vec2(1.0, 0.5), 0.0).rgb));
	}
	else if (shadeStopCount < 2) {
		return clamp(cosine, 0.0, 1.0);
	}
	else {
		bottom = readLuminance(shadeStopColors[0]);
		top = readLuminance(shadeStopColors[shadeStopCount - 1]);
	}
	return clamp((readLuminance(rampColor) - bottom) / max(top - bottom, 0.0001), 0.0, 1.0);
}
float readToonSpecular(vec3 normal, vec3 toLight, vec3 viewDirection) {
	vec3 halfway = normalize(toLight + viewDirection);
	float blinn = pow(max(dot(normal, halfway), 0.0), specularLight.y);
	float edgeWidth = max(fwidth(blinn), 0.0001);
	return mix(smoothstep(0.5 - edgeWidth, 0.5 + edgeWidth, blinn), blinn, specularLight.z);
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
	surface.uv1 = surfaceUv1;
	surface.localPosition = localPosition;
	surface.worldPosition = worldPosition;
	surface.viewDirection = readViewDirection();
	surface.shadeOffset = shadeOffset;
	surface.specularMask = highlightScale.x;
	surface.rimMask = highlightScale.y;
	return surface;
}
ToonLighting readLighting(ToonSurface surface) {
	ToonLighting lighting;
	vec3 normal = surface.normal;
	vec3 viewDirection = surface.viewDirection;
	float shadow = receivesShadow > 0.5 ? readShadow() : 1.0;
	float specularNormalization = energyNormalized > 0.5 ? (specularLight.y + 8.0) * RECIPROCAL_PI / 8.0 : 1.0;
	bool hasSpecular = specularLight.x > 0.0;
	vec3 specularSum = vec3(0.0);
	vec3 sunLightColor = readLimitedDirectionalColor(sunColor);
	vec3 toSun = -normalize(sunDirection);
	float sunCosine = dot(normal, toSun);
	vec3 sunRamp = readShadeRamp(readToonCoordinate(sunCosine, surface.shadeOffset) * shadow);
	float sunLevel = readShadeLevel(sunRamp, sunCosine * shadow);
	vec3 sunLight = sunRamp * mix(readLightColor(sunLightColor, lightColorUsage.y), readLightColor(sunLightColor, lightColorUsage.x), sunLevel);
	vec3 irradiance = sunLight + mix(groundColor, skyColor, normal.y * 0.5 + 0.5);
	if (hasSpecular) {
		specularSum += readLightColor(sunLightColor, lightColorUsage.z) * readToonSpecular(normal, toSun, viewDirection) * sunLevel;
	}
	vec3 toFill = -normalize(fillDirection);
	float fillCosine = dot(normal, toFill);
	irradiance += readLightColor(readLimitedDirectionalColor(fillColor), lightColorUsage.x) * readShadeLevel(readShadeRamp(readToonCoordinate(fillCosine, surface.shadeOffset)), fillCosine);
	for (int index = 0; index < 8; ++index) {
		if (index >= pointLightCount) {
			break;
		}
		vec3 toLight = pointLightPositions[index].xyz - surface.worldPosition;
		float lightDistance = length(toLight);
		vec3 lightDirection = toLight / max(lightDistance, 0.0001);
		float lightRange = pointLightPositions[index].w;
		vec3 shape = pointLightShapes[index];
		float window = 1.0;
		if (lightRange > 0.0) {
			window = clamp(1.0 - pow(lightDistance / lightRange, shape.y), 0.0, 1.0);
			window *= window;
		}
		float falloff = shape.x > 0.0 ? window / max(pow(lightDistance, shape.x), 0.01) : window;
		vec4 spot = pointLightSpots[index];
		if (spot.w > 0.5) {
			vec2 cone = pointLightCones[index];
			float angular = clamp(dot(spot.xyz, -lightDirection) * cone.x + cone.y, 0.0, 1.0);
			falloff *= angular * angular;
		}
		float lightShadow = 1.0;
		int shadowSlot = int(pointLightShadowSlots[index] + 0.5) - 1;
		if (shadowSlot >= 0 && receivesShadow > 0.5) {
			lightShadow = readLocalShadow(shadowSlot, surface.worldPosition, normal);
		}
		float cosine = (dot(normal, lightDirection) + shape.z) / (1.0 + shape.z);
		float level = readShadeLevel(readShadeRamp(readToonCoordinate(cosine, surface.shadeOffset) * lightShadow), cosine * lightShadow);
		vec3 pointColor = readLimitedLocalColor(pointLightColors[index] * falloff);
		irradiance += readLightColor(pointColor, lightColorUsage.x) * level;
		if (hasSpecular) {
			specularSum += readLightColor(pointColor, lightColorUsage.z) * readToonSpecular(normal, lightDirection, viewDirection) * level;
		}
	}
	lighting.irradiance = irradiance;
	lighting.specular = hasSpecular ? specularSum * specularColor * specularLight.x * specularNormalization : vec3(0.0);
	lighting.rim = vec3(0.0);
	if (rimLight.a > 0.0) {
		float rimTerm = pow(1.0 - clamp(dot(normal, viewDirection), 0.0, 1.0), rimLight.a);
		float edgeWidth = max(fwidth(rimTerm), 0.0001);
		float rim = mix(smoothstep(0.5 - edgeWidth, 0.5 + edgeWidth, rimTerm), rimTerm, rimShape.x);
		lighting.rim = rimLight.rgb * mix(vec3(1.0), sunLightColor, lightColorUsage.w) * rim * mix(1.0, sunLevel, rimShape.y);
	}
	if (shadeRimLight.a > 0.0) {
		float shadeRimTerm = pow(1.0 - clamp(dot(normal, viewDirection), 0.0, 1.0), shadeRimLight.a);
		float edgeWidth = max(fwidth(shadeRimTerm), 0.0001);
		float shadeRim = mix(smoothstep(0.5 - edgeWidth, 0.5 + edgeWidth, shadeRimTerm), shadeRimTerm, rimShape.x);
		lighting.rim += shadeRimLight.rgb * mix(vec3(1.0), sunLightColor, lightColorUsageExtra.x) * clamp(shadeRim - (sunCosine * 0.5 + 0.5), 0.0, 1.0);
	}
	lighting.shadow = shadow;
	lighting.sunLevel = sunLevel;
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
		color = albedo * lighting.irradiance * diffuseScale + lighting.specular * surface.specularMask + lighting.rim * surface.rimMask + emission;
	}
	vec3 viewNormal = normalize(viewRotation * surface.normal);
	vec3 sunLightColor = readLimitedDirectionalColor(sunColor);
	if (matcapSettings.x > 0.5) {
		vec3 matcap = toLinear(texture(matcapTexture, vec2(viewNormal.x * 0.5 + 0.5, 0.5 - viewNormal.y * 0.5)).rgb) * mix(vec3(1.0), sunLightColor, lightColorUsageExtra.y);
		color = matcapSettings.z > 0.5 ? color + matcap * matcapSettings.y : color * mix(vec3(1.0), matcap, matcapSettings.y);
	}
	if (angelRingSettings.x > 0.5) {
		vec2 ringOffset = mix(viewNormal, vec3(0.0, 0.0, 1.0), angelRingSettings.y).xy * 0.5;
		vec2 ringNormal = vec2(ringOffset.x * cameraRoll.x + ringOffset.y * cameraRoll.y, ringOffset.y * cameraRoll.x - ringOffset.x * cameraRoll.y) + 0.5;
		vec2 ringUv = vec2(ringNormal.x, 1.0 - mix(1.0 - surface.uv1.y, ringNormal.y, angelRingSettings.z));
		vec4 ring = texture(angelRingTexture, ringUv);
		vec3 ringColor = toLinear(ring.rgb) * angelRingColor * mix(vec3(1.0), sunLightColor, lightColorUsageExtra.z);
		color = angelRingSettings.w > 0.5 ? color * (1.0 - ring.a) + ringColor * ring.a : color + ringColor;
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
const OUTLINE_VERTEX_BODY = `uniform float outlineWidthScale;
uniform vec3 outlineDistanceScale;
uniform vec2 outlineFadeDistance;
uniform float outlineOffsetZ;
uniform vec4 cameraPosition;
uniform vec3 cameraForward;
out float outlineTint;
void main() {
	ToonVertex vertex = readVertex();
	applyVertex(vertex);
	mat4 objectMatrix = vertex.modelMatrix * readSkinMatrix();
	vec3 basePosition = (objectMatrix * vec4(vertex.localPosition, 1.0)).xyz;
	vec3 offset = mat3(objectMatrix) * vertex.localNormal;
	float scale = outlineWidthScale;
	if (outlineDistanceScale.x > 0.0 && cameraPosition.w > 0.5) {
		scale *= clamp(distance(cameraPosition.xyz, basePosition) / outlineDistanceScale.x, outlineDistanceScale.y, outlineDistanceScale.z);
	}
	if (outlineFadeDistance.y > outlineFadeDistance.x && cameraPosition.w > 0.5) {
		scale *= smoothstep(outlineFadeDistance.y, outlineFadeDistance.x, distance(cameraPosition.xyz, vertex.modelMatrix[3].xyz));
	}
	vec3 position = basePosition + offset * scale;
	vec3 awayFromCamera = cameraPosition.w > 0.5 ? normalize(position - cameraPosition.xyz) : cameraForward;
	outlineTint = vertex.tint.a;
	gl_Position = viewProjectionMatrix * vec4(position + awayFromCamera * outlineOffsetZ, 1.0);
}
`;
const OUTLINE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in float outlineTint;
uniform vec4 outlineColor;
uniform vec3 outlineLightColor;
uniform float alpha;
uniform float hdrOutput;
uniform float premultipliedOutput;
out vec4 fragmentColor;
void main() {
	vec3 color = (hdrOutput > 0.5 ? pow(outlineColor.rgb, vec3(2.2)) : outlineColor.rgb) * outlineLightColor;
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
 * @param { ToonMaterial | null } material - 셰이더 조각을 끼울 머티리얼. (null 이면 빈 조각)
 * @param { ToonInstanceLayout | null } instanceLayout - 사용자 어트리뷰트를 선언할 인스턴스 꼴. (null 이면 없음)
 * @returns { object } 세 프로그램의 소스와 어트리뷰트 자리. ({ solidVertexShader, solidFragmentShader, outlineVertexShader, outlineFragmentShader, depthVertexShader, depthFragmentShader, attributeLocationTable })
 * @example <caption>머티리얼과 인스턴스 꼴로 지은 몸 프로그램을 직접 컴파일해 보기</caption>
 * import { composeToonProgramSources, ToonMaterial, ToonInstanceLayout } from "./vanilla.js";
 * const material = new ToonMaterial({ name: "sway", vertexChunk: "void applyVertex(inout ToonVertex vertex) { vertex.localPosition.x += instanceSway * vertex.localPosition.y; }" });
 * const instanceLayout = new ToonInstanceLayout([{ name: "instanceMatrix", size: 16 }, { name: "instanceSway", size: 1 }]);
 * const sources = composeToonProgramSources(material, instanceLayout);
 * const context = document.createElement("canvas").getContext("webgl2");
 * const shader = context.createShader(context.VERTEX_SHADER);
 * context.shaderSource(shader, sources.solidVertexShader);
 * context.compileShader(shader);
 * if (!context.getShaderParameter(shader, context.COMPILE_STATUS) || sources.attributeLocationTable.instanceSway !== 13) {
 * 	throw new Error(context.getShaderInfoLog(shader));
 * }
 * context.deleteShader(shader);
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
 * @param { Matrix4 } matrix - 보기와 투영 행렬. (투영 x 보기)
 * @returns { Array<Array<number>> } 면 여섯의 [a, b, c, d]. (왼쪽, 오른쪽, 아래, 위, 가까운 면, 먼 면)
 * @example <caption>구가 절두체 안에 드는지 보기</caption>
 * import { extractFrustumPlanes, Matrix4, Vector3 } from "./vanilla.js";
 * const viewProjectionMatrix = Matrix4.createPerspective(0.8, 16 / 9, 0.1, 50);
 * viewProjectionMatrix.multiply(Matrix4.createLookAt(Vector3.create(0, 2, 6), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0)));
 * const planes = extractFrustumPlanes(viewProjectionMatrix);
 * const isSphereVisible = (center, radius) => planes.every((plane) => plane[0] * center[0] + plane[1] * center[1] + plane[2] * center[2] + plane[3] >= -radius);
 * if (!isSphereVisible([0, 0, 0], 1) || isSphereVisible([0, 0, 80], 1)) {
 * 	throw new Error("unexpected culling");
 * }
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
 * @param { ArrayLike<number> } first - 첫 행. ([x, y, z] 이 앞 셋)
 * @param { ArrayLike<number> } second - 둘째 행.
 * @param { ArrayLike<number> } third - 셋째 행.
 * @returns { number } 행렬식.
 */
function readDeterminant(first, second, third) {
	return first[0] * (second[1] * third[2] - second[2] * third[1]) - first[1] * (second[0] * third[2] - second[2] * third[0]) + first[2] * (second[0] * third[1] - second[1] * third[0]);
}


//==============================================================================
// 모형 행렬 왼쪽 위 3x3 의 행렬식. (음수면 거울에 비친 행렬, 감기가 뒤집힌다)
//==============================================================================
/**
 * @param { ArrayLike<number> } elements - Matrix4 의 수. (열 차례)
 * @returns { number } 왼쪽 위 3x3 의 행렬식. (음수면 거울에 비친 행렬)
 * @example <caption>음수 크기로 뒤집힌 모형 행렬 가리기</caption>
 * import { readMatrixDeterminant, Matrix4 } from "./vanilla.js";
 * const modelMatrix = Matrix4.createTranslation(1, 0, 0);
 * modelMatrix.multiply(Matrix4.createScale(-1, 1, 1));
 * const isMirrored = readMatrixDeterminant(modelMatrix.getElements()) < 0;
 * if (!isMirrored) {
 * 	throw new Error("expected a mirrored matrix");
 * }
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
 * @param { ArrayLike<number> } elements - 보기와 투영 행렬의 수 16. (열 차례)
 * @returns { object } 읽은 카메라. ({ position [x, y, z, w(1 원근, 0 직교)], forward [x, y, z], isMirrored })
 * @example <caption>보기와 투영 행렬에서 눈의 자리와 보는 방향 읽기</caption>
 * import { readFrameCamera, Matrix4, Vector3 } from "./vanilla.js";
 * const viewProjectionMatrix = Matrix4.createPerspective(0.8, 16 / 9, 0.1, 100);
 * viewProjectionMatrix.multiply(Matrix4.createLookAt(Vector3.create(0, 2, 5), Vector3.create(0, 2, 0), Vector3.create(0, 1, 0)));
 * const frameCamera = readFrameCamera(viewProjectionMatrix.getElements());
 * const isPerspective = frameCamera.position[3] === 1;
 * if (!isPerspective || Math.abs(frameCamera.position[2] - 5) > 0.001 || frameCamera.forward[2] > -0.999 || frameCamera.isMirrored) {
 * 	throw new Error("unexpected camera");
 * }
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
// 보기와 투영 행렬에서 보기 돌림 3x3 읽기. (열 차례, 행이 오른쪽, 위, 뒤, 매트캡의 보기 공간 노멀을 셀 때)
// - 오른쪽은 행 0 의 xyz 에서 보는 방향 몫을 뺀 것이다. (대칭 원근과 직교, 화면 사각형으로 옮긴 투영 모두)
//==============================================================================
/**
 * @param { ArrayLike<number> } elements - 보기와 투영 행렬의 수 16.
 * @param { Array<number> } forward - 보는 방향. (readFrameCamera 의 forward)
 * @returns { Array<number> } mat3 의 수 9. (열 차례)
 * @example <caption>월드 노멀을 보기 공간으로 옮기기</caption>
 * import { readFrameCamera, readViewRotation, Matrix4, Vector3 } from "./vanilla.js";
 * const viewProjectionMatrix = Matrix4.createPerspective(0.8, 1, 0.1, 100);
 * viewProjectionMatrix.multiply(Matrix4.createLookAt(Vector3.create(3, 1, 3), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0)));
 * const elements = viewProjectionMatrix.getElements();
 * const rotation = readViewRotation(elements, readFrameCamera(elements).forward);
 * const normal = [0, 1, 0];
 * const viewNormal = [0, 1, 2].map((row) => rotation[row] * normal[0] + rotation[3 + row] * normal[1] + rotation[6 + row] * normal[2]);
 * const matcapUv = [viewNormal[0] * 0.5 + 0.5, viewNormal[1] * 0.5 + 0.5];
 */
export function readViewRotation(elements, forward) {
	const rowX = [elements[0], elements[4], elements[8]];
	const along = rowX[0] * forward[0] + rowX[1] * forward[1] + rowX[2] * forward[2];
	let right = [rowX[0] - forward[0] * along, rowX[1] - forward[1] * along, rowX[2] - forward[2] * along];
	const rightLength = System.Math.hypot(right[0], right[1], right[2]);
	right = rightLength > 0.000001 ? [right[0] / rightLength, right[1] / rightLength, right[2] / rightLength] : [1, 0, 0];
	const up = [right[1] * forward[2] - right[2] * forward[1], right[2] * forward[0] - right[0] * forward[2], right[0] * forward[1] - right[1] * forward[0]];
	return [right[0], up[0], -forward[0], right[1], up[1], -forward[1], right[2], up[2], -forward[2]];
}

//==============================================================================
// 카메라 기울임을 되돌리는 각 읽기. (유니티 툰 셰이더의 천사 고리 Camera Rolling Stabilizer 와 같은 셈)
// - 카메라 오른쪽(보기 돌림의 행 0)과 수평 오른쪽 축이 이루는 각 roll, 오른쪽의 y 가 음수면 쪽 dir 이 -1, 돌려주는 각은 -(dir x roll) 이다.
// - 유니티는 왼손 좌표라 수평 오른쪽 축이 cross(뒤, 위) 이고, 엔진은 오른손 좌표라 같은 쪽이 cross(앞, 위) 다. 거울에 비친 프레임이면 축을 뒤집는다. (유니티 툰 셰이더의 mirrorFlag)
// - 바로 위나 아래를 보면 수평 축이 없어 0 이다.
//==============================================================================
/**
 * @param { Float32Array | Array<number> } viewRotationElements - mat3 의 수 9. (readViewRotation 의 결과, 열 차례)
 * @param { boolean } isMirrored - 보기 행렬이 거울에 비쳤는지. (readFrameCamera 의 isMirrored)
 * @returns { number } 천사 고리 UV 를 (0.5, 0.5) 둘레로 돌릴 각. (라디안)
 * @example <caption>오른쪽으로 0.3 라디안 기운 카메라의 되돌림 각</caption>
 * import { readCameraRoll } from "./vanilla.js";
 * const roll = 0.3;
 * const rotation = [Math.cos(roll), -Math.sin(roll), 0, Math.sin(roll), Math.cos(roll), 0, 0, 0, 1];
 * const angle = readCameraRoll(rotation, false);
 * if (Math.abs(angle + roll) > 0.0001) {
 * 	throw new Error("unexpected camera roll");
 * }
 */
export function readCameraRoll(viewRotationElements, isMirrored) {
	const right = [viewRotationElements[0], viewRotationElements[3], viewRotationElements[6]];
	const forward = [-viewRotationElements[2], -viewRotationElements[5], -viewRotationElements[8]];
	const axisSign = isMirrored ? -1 : 1;
	const rightAxis = [-forward[2] * axisSign, 0, forward[0] * axisSign];
	const axisLength = System.Math.hypot(rightAxis[0], rightAxis[1], rightAxis[2]);
	const rightLength = System.Math.hypot(right[0], right[1], right[2]);
	if (axisLength < 0.000001 || rightLength < 0.000001) {
		return 0;
	}
	const cosine = (rightAxis[0] * right[0] + rightAxis[1] * right[1] + rightAxis[2] * right[2]) / (axisLength * rightLength);
	const roll = System.Math.acos(System.Math.max(-1, System.Math.min(1, cosine)));
	const direction = right[1] < 0 ? -1 : 1;
	return -(direction * roll);
}

//==============================================================================
// 껍데기 바깥선에 곱할 해의 색 읽기. (유니티 툰 셰이더 바깥선과 같이 세기가 1 이상이면 세기로 나눈다, 세기는 0.299 R + 0.587 G + 0.114 B)
//==============================================================================
/**
 * @param { Array<number> } sunColor - 해의 선형 색.
 * @returns { Array<number> } 곱할 선형 색.
 */
function readOutlineLightColor(sunColor) {
	const intensity = 0.299 * sunColor[0] + 0.587 * sunColor[1] + 0.114 * sunColor[2];
	return intensity < 1 ? sunColor.slice() : [sunColor[0] / intensity, sunColor[1] / intensity, sunColor[2] / intensity];
}

//==============================================================================
// UV 꼭짓점 배열 짓기. (2 번 UV 가 없으면 점마다 UV 2, 있으면 UV 와 2 번 UV 를 섞어 4)
// - 셰이더의 vertexUv 는 vec4 다. 2 개만 올리면 zw 는 (0, 1) 로 읽힌다.
//==============================================================================
/**
 * @param { Float32Array } uvData - UV. (점마다 2)
 * @param { Float32Array | null } uv1Data - 2 번 UV. (점마다 2, 없으면 null)
 * @param { number } vertexCount - 점 수.
 * @returns { Float32Array } 점마다 2 나 4.
 * @example <caption>UV 와 2 번 UV 를 한 배열로 섞기</caption>
 * import { readUvData } from "./vanilla.js";
 * const uvData = new Float32Array([0, 0, 1, 0, 1, 1]);
 * const uv1Data = new Float32Array([0.5, 0.5, 0.6, 0.5, 0.6, 0.6]);
 * const data = readUvData(uvData, uv1Data, 3);
 * if (data.length !== 12 || data[2] !== 0.5 || data[7] !== 0.5) {
 * 	throw new Error("unexpected uv data");
 * }
 */
export function readUvData(uvData, uv1Data, vertexCount) {
	if (uv1Data === null) {
		return uvData.length === vertexCount * 2 ? uvData : uvData.subarray(0, vertexCount * 2);
	}
	const data = new System.Float32Array(vertexCount * 4);
	for (let vertexIndex = 0; vertexIndex < vertexCount; ++vertexIndex) {
		data[vertexIndex * 4] = uvData[vertexIndex * 2];
		data[vertexIndex * 4 + 1] = uvData[vertexIndex * 2 + 1];
		data[vertexIndex * 4 + 2] = uv1Data[vertexIndex * 2];
		data[vertexIndex * 4 + 3] = uv1Data[vertexIndex * 2 + 1];
	}
	return data;
}

//==============================================================================
// 껍데기 꼭짓점 배열 짓기. (점마다 바탕 자리 3 과 미는 쪽 3, 미는 쪽은 사본 자리 - 바탕 자리)
// - 바탕 자리가 없거나 길이가 다르면(GLB 에 지어 둔 껍데기) 사본 자리를 바탕으로 두고 미는 쪽은 0 이다. (굵기 배를 걸지 않는다)
//==============================================================================
/**
 * @param { Float32Array } outlineVertexData - 지은 굵기로 민 사본 자리. (3 씩)
 * @param { Float32Array | undefined | null } outlineBaseData - 밀기 전 바탕 자리. (3 씩)
 * @returns { Float32Array } 점마다 6 개.
 * @example <caption>MeshBuilder 의 껍데기를 바탕 자리와 미는 쪽으로 풀기</caption>
 * import { readOutlineVertexData, ToonMesh, Matrix4 } from "./vanilla.js";
 * const builder = new ToonMesh.MeshBuilder();
 * builder.addPart(ToonMesh.createBoxGeometry(1, 1, 1), Matrix4.createIdentity(), "#a0a0a0", { outlineWidth: 0.02 });
 * const arrays = builder.readArrays();
 * const outlineData = readOutlineVertexData(arrays.outlineVertexData, arrays.outlineBaseData);
 * const firstPush = Math.hypot(outlineData[3], outlineData[4], outlineData[5]);
 * if (outlineData.length !== arrays.outlineVertexData.length * 2 || firstPush <= 0) {
 * 	throw new Error("unexpected outline data");
 * }
 */
export function readOutlineVertexData(outlineVertexData, outlineBaseData) {
	const pointCount = System.Math.floor(outlineVertexData.length / 3);
	const hasBase = outlineBaseData !== undefined && outlineBaseData !== null && outlineBaseData.length === outlineVertexData.length;
	const data = new System.Float32Array(pointCount * 6);
	for (let pointIndex = 0; pointIndex < pointCount; ++pointIndex) {
		for (let axis = 0; axis < 3; ++axis) {
			const outlineValue = outlineVertexData[pointIndex * 3 + axis];
			const baseValue = hasBase ? outlineBaseData[pointIndex * 3 + axis] : outlineValue;
			data[pointIndex * 6 + axis] = baseValue;
			data[pointIndex * 6 + 3 + axis] = outlineValue - baseValue;
		}
	}
	return data;
}

//==============================================================================
// 평면에 비친 행렬 짓기. (평면 위 한 점과 노멀, 평면 거울의 모형이나 보기 행렬에 곱한다)
// - 비친 행렬로 그리면 감기가 뒤집힌다. ToonRenderer 는 모형 행렬의 행렬식이 음수면 스스로 앞면을 뒤집는다. (options.isMirrored 로 정할 수도 있다)
//==============================================================================
/**
 * @param { Array<number> } planePoint - 평면 위 한 점. ([x, y, z])
 * @param { Array<number> } planeNormal - 평면의 노멀. ([x, y, z], 길이는 상관없다)
 * @returns { Matrix4 } 평면에 비친 행렬.
 * @example <caption>바닥 거울에 비친 모습을 어둡게 그리기</caption>
 * import { ToonRenderer, ToonMesh, createReflectionMatrix, Matrix4, Vector3 } from "./vanilla.js";
 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
 * const builder = new ToonMesh.MeshBuilder();
 * builder.addPart(ToonMesh.createSphereGeometry(0.4, 24, 16), Matrix4.createIdentity(), "#e0a060", { hasOutline: true });
 * const mesh = renderer.createMesh(builder.readArrays());
 * const modelMatrix = Matrix4.createTranslation(0, 0.6, 0);
 * const mirroredMatrix = createReflectionMatrix([0, 0, 0], [0, 1, 0]);
 * mirroredMatrix.multiply(modelMatrix);
 * renderer.beginFrameWithMatrices(Matrix4.createLookAt(Vector3.create(0, 1.5, 3), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0)), Matrix4.createPerspective(0.8, 1, 0.1, 20));
 * renderer.drawMesh(mesh, mirroredMatrix, { colorScale: 0.4, hasOutline: false });
 * renderer.drawMesh(mesh, modelMatrix);
 * renderer.endFrame();
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
 * @param { Float32Array } elements - 모형 행렬의 수 16.
 * @returns { number } 세 축 길이 가운데 가장 큰 것.
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
 * @param { Float32Array } positions - 꼭짓점 배열.
 * @param { number } stride - 꼭짓점 하나의 수 개수.
 * @returns { object } 경계 구. ({ center, radius })
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
// - 빛: ToonLightSet 하나를 기본으로 든다. 해(방향과 색, 그림자), 하늘색과 땅색의 바탕빛, 채움 빛, 점광과 스포트라이트(TOON_MAXIMUM_POINT_LIGHTS 까지), 림 빛, 하이라이트, 빛 꼴(÷π).
//   셀 셰이딩은 그늘 램프다. (유니티 툰 셰이더의 바탕, 1 차 그늘, 2 차 그늘과 Step, Feather, 그림자는 그늘 색으로 들어간다, 경계는 fwidth 로 계단 없이, 램프 텍스처도 된다)
//   해는 램프 색을 통째로, 채움 빛과 점광과 스포트라이트는 램프의 밝기 단계를 받는다. 하이라이트와 림은 단단한 툰 꼴에서 부드러운 꼴까지. 셈은 ToonLightSet 머리말에 있다.
//   setLight, setSunDirection, setFillLight, setShade, setShadeRamp, clearShadeRamp, setBandCount, setBandRamp, setRampTexture, setRimLight, setSpecular, setPointLights, setPointLightLimit,
//   setLightModel 은 기본 묶음을 고친다. 그리기마다 options.lightSet 으로 다른 묶음(createLightSet)을 줄 수 있다. (재질마다 그늘 색이 다를 때)
// - 노멀: 모형 행렬과 본 행렬의 왼쪽 위 3x3 의 역행렬의 전치로 옮긴다. (늘이고 줄인 모형도 빛이 맞다, 정점 조각이 고친 행렬도 같다)
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
//   receivesShadow (기본 true) 가 false 면 해의 그림자를 보지 않는다. shadeOffset 은 빛을 받는 몫에 더해 그늘 경계를 옮긴다. (길티기어 Xrd 의 꼭짓점 색 문턱, 유니티 툰 셰이더의 Shading Grade Map 꼴)
//   specularScale, rimScale (기본 1) 은 그 그리기의 하이라이트와 림 배다. (0 이면 없음, 재질마다의 세기)
//   matcapTexture 는 보기 공간 노멀로 읽는 매트캡이다. matcapStrength (기본 1), matcapBlend (ToonMatcapBlend.multiply 기본, add)
//   outlineColor [r, g, b, a] sRGB 는 그 그리기의 껍데기 바깥선 색 (주지 않으면 setOutlineColor), outlineWidthScale (기본 1) 은 지은 굵기의 배다.
//   outlineOffsetZ (기본 0) 는 껍데기를 카메라에서 먼 쪽으로 미는 월드 길이다. (몸 앞으로 비치지 않게, 유니티 툰 셰이더의 Offset Z)
//   angelRingTexture 는 천사 고리 텍스처다. u 는 보기 공간 노멀의 x, v 는 2 번 UV 의 y 와 보기 노멀의 y 를 angelRingOffsetV (기본 0.3) 로 섞은 것이다. (유니티 툰 셰이더의 Angel Ring)
//   angelRingColor [r, g, b] (선형 배, 기본 흰색), angelRingOffsetU (0 ~ 0.5, 기본 0), isAngelRingAlpha (기본 false 면 더하고 true 면 텍스처 알파로 덮는다)
//   천사 고리 UV 는 카메라 기울임만큼 되돌려 돌린다. (readCameraRoll, 유니티 툰 셰이더의 Camera Rolling Stabilizer, 카메라를 기울여도 고리는 머리에 붙어 있다)
//   lineId, hasScreenOutline, hasCreaseLine 은 ToonDrawQueue 가 화면 공간 바깥선에 넘기는 값이다. (렌더러는 읽지 않는다)
// - 바깥선 껍데기(inverted hull): MeshBuilder 가 지은 껍데기의 바탕 자리와 미는 쪽(지은 굵기, 같은 자리의 노멀을 평균한 쪽)을 올리고, 셰이더가 outlineWidthScale 만큼 밀어 뒷면만 그린다.
//   setOutlineDistanceScale(기준 거리, 가장 작은 배, 가장 큰 배) 를 주면 카메라까지의 거리 / 기준 거리 를 굵기에 곱해 화면 굵기를 맞춘다. (원근만)
//   setOutlineFadeDistance(가까운 거리, 먼 거리) 를 주면 모형의 자리에서 카메라까지가 먼 거리에 다가갈수록 굵기가 0 이 된다. (smoothstep, 유니티 툰 셰이더의 Nearest, Farthest Distance)
//   껍데기 색은 빛 묶음의 outline 빛 색 쓰기가 켜져 있으면(기본) 해의 색을 곱한다. (세기가 1 이상이면 세기로 나눈 색, 유니티 툰 셰이더 바깥선과 같다)
// - 뼈대: writeSkinPose 가 셈한 본 행렬을 drawMesh 에 넘긴다. (TOON_MAXIMUM_JOINTS 까지)
// - GPU 인스턴싱: drawMeshInstanced 로 같은 모형 여럿을 인스턴스마다 행렬과 틴트로 한 번에 그린다. (몸과 바깥선 모두, 그릴 때마다 걸러서 올림)
//   오래 두는 인스턴스는 createInstanceLayout 과 createInstanceBuffer 로 영구 버퍼를 짓고 drawMeshInstanceBuffer 로 그린다. (거르지 않음, 머티리얼 정점 조각이 사용자 어트리뷰트를 읽음)
// - 화면 밖 거르기: 모형의 경계 구를 보기와 투영의 절두체에 대어 밖이면 그리지 않는다. (인스턴스는 하나씩 걸러 남은 것만 올린다)
// - 그림자: ShadowMap 에 beginShadowPass 와 drawMesh 로 드리우고, setShadow 로 받는다. (3x3 PCF)
//   점광과 스포트라이트 그림자는 ShadowAtlas 에 beginShadowAtlasPass, 칸마다 setShadowAtlasTile 과 drawMesh 로 드리우고, setLocalShadows 로 받는다. (점광은 큐브 여섯 칸, 스포트라이트는 원근 한 칸)
//   그 빛의 받는 몫에 그림자를 곱해 그늘 램프에 넣는다. (해와 같은 꼴) castsShadow 가 true 인 점광만 칸을 받는다. (SHADOW_ATLAS_MAXIMUM_LIGHTS 까지)
//   그림자를 받지 않을 때도 두 그림자 유닛에 1x1 비교 깊이 텍스처를 묶는다. (sampler2DShadow 유닛에 깊이 텍스처가 없으면 맥 드라이버가 알리고, 색 텍스처가 묶여 있으면 WebGL 이 그리기를 거부한다)
// - HDR: setHdrOutput(true) 면 감마를 걸지 않은 선형 색을 낸다. 실수 렌더 타겟(ToonPostProcess)에 그리고 블룸과 톤매핑으로 마무리한다.
// - 사용: createMesh(arrays) → 매 프레임 beginFrame(보기와 투영) → drawMesh / drawMeshInstanced → endFrame() → 다 쓰면 deleteMesh.
//   beginFrame 이 앞의 그리기 상태(섞기, 깊이, 면 가리기, 프로그램, 버텍스 어레이)를 적어 두고 깊이 시험과 면 가리기를 켜며, endFrame 이 적어 둔 상태로 돌린다.
//   (엔진 2D 그리기 사이에 끼울 때, 그 전에 Graphic.flushSpriteBatch)
//   beginFrameWithMatrices(보기, 투영) 는 두 행렬로 시작한다. (직교 원 행렬 카메라) 카메라의 자리와 보기 돌림(하이라이트, 림, 소프트 엣지, 매트캡)은 보기와 투영에서 읽는다.
// - 프로그램마다 프레임 값(보기와 투영, 카메라, 그림자, HDR)과 빛 묶음은 바뀔 때만 올린다. 그리기마다 바뀌는 값(모형 행렬, 틴트, 텍스처)만 매번 올린다.
// - readProgramSources(material, instanceLayout) 로 ShaderWarmer 에 넘길 소스를 준다.
// - 노드 사각형 안에 그리기: setScreenRect(x, y, 너비, 높이) 를 주면 beginFrame 이 보기와 투영의 클립 공간을 그 사각형으로 옮기고 가위로 밖을 자른다.
//   사각형은 beginFrame 때의 뷰포트(보통 드로잉 버퍼 전체) 안의 픽셀이고 왼쪽 위가 원점이다. (2D 노드의 draw 에서 graphic.getTransformMatrix 로 셈한 자리)
//   화면 밖 거르기는 옮기기 전의 절두체로 한다. endFrame 이 가위를 푼다. 카메라의 가로 세로 비는 사각형의 비로 맞춘다. (Camera3D.setAspectRatio)
// - beginFrameWithCamera(Camera3D) 는 카메라의 보기와 투영으로 beginFrame 을 부른다. 2D 표시(Camera3D.projectToView)와 같은 카메라를 쓴다.
// - drawMeshOutline 은 바깥선 껍데기만 그린다. (ToonDrawQueue 가 불투명한 몸을 다 그린 뒤 바깥선을 몰아 그릴 때, 그린 수는 세지 않는다)
// - 텍스처: createTexture(그림이나 { width, height, data }, { isMipmapped, isRepeated, isFiltered }) 로 RGBA 텍스처를 짓는다. UV (0, 0) 이 그림의 왼쪽 위다. (glTF 와 같음)
// - 텍스처 유닛: 점광 그림자 아틀라스 0, 램프 1, 매트캡 2, 해 그림자 3, 바탕색 4, 빛남 5, 데칼 6, 천사 고리 7, 머티리얼 8 ~ 15. 유닛 0 의 묶음은 beginFrame 이 적어 두고 endFrame 이 돌린다.
// - 2 번 UV: 배열에 uv1Data 가 있으면 vertexUv 가 (UV, 2 번 UV) 넷이다. 셰이더 조각은 ToonSurface.uv1 로 읽는다. (없으면 (0, 1))
// - 빛 색 쓰기(setLightColorUsage), 그늘 쪽 림(setShadeRimLight), 빛 세기 막기(setLightIntensityLimited)는 빛 묶음(ToonLightSet)에 둔다.
//==============================================================================
/**
 * @example <caption>해와 바깥선 색을 정해 그린 뒤 통계를 읽고 치우기</caption>
 * import { ToonRenderer, ToonMesh, Matrix4, Vector3 } from "./vanilla.js";
 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
 * const renderer = new ToonRenderer(webGL2RenderingContext);
 * renderer.setLight([-0.4, -1, -0.3], [1, 0.96, 0.9], [0.45, 0.5, 0.6], [0.25, 0.22, 0.2]);
 * renderer.setOutlineColor([0.1, 0.06, 0.08, 1]);
 * const builder = new ToonMesh.MeshBuilder();
 * builder.addPart(ToonMesh.createCapsuleGeometry(0.3, 0.6, 8, 16), Matrix4.createIdentity(), "#a0d0a0", { outlineWidth: 0.02 });
 * const mesh = renderer.createMesh(builder.readArrays());
 * webGL2RenderingContext.clearColor(0.9, 0.9, 0.95, 1);
 * webGL2RenderingContext.clear(webGL2RenderingContext.COLOR_BUFFER_BIT | webGL2RenderingContext.DEPTH_BUFFER_BIT);
 * renderer.beginFrameWithMatrices(Matrix4.createLookAt(Vector3.create(0, 1, 3), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0)), Matrix4.createPerspective(0.8, 1, 0.1, 20));
 * renderer.drawMesh(mesh, Matrix4.createIdentity());
 * renderer.drawMesh(mesh, Matrix4.createTranslation(0, 0, 50));
 * renderer.endFrame();
 * const statistics = renderer.getFrameStatistics();
 * if (statistics.drawnObjectCount !== 1 || statistics.culledObjectCount !== 1) {
 * 	throw new Error("unexpected statistics");
 * }
 * renderer.deleteMesh(mesh);
 * renderer.destroy();
 */
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
	/** @private @type { Float32Array } */ #pointSpotValues;
	/** @private @type { Float32Array } */ #pointConeValues;
	/** @private @type { Float32Array } */ #shadePositionValues; // 그늘 램프 유니폼 올리기 칸.
	/** @private @type { Float32Array } */ #shadeFeatherValues;
	/** @private @type { Float32Array } */ #shadeColorValues;
	/** @private @type { Float32Array } */ #viewRotationElements; // 이번 프레임의 보기 돌림 3x3. (매트캡의 보기 공간 노멀)
	/** @private @type { number } */ #cameraRoll; // 이번 프레임의 카메라 기울임을 되돌리는 각. (라디안, 천사 고리)
	/** @private @type { Array<number> } */ #outlineDistanceScale; // 껍데기 바깥선의 거리 배. ([기준 거리 (0 이면 끔), 가장 작은 배, 가장 큰 배])
	/** @private @type { Array<number> } */ #outlineFadeDistance; // 껍데기 바깥선이 사라지는 거리. ([가까운 거리 (지은 굵기), 먼 거리 (0), 먼 거리가 가까운 거리 이하면 끔])
	/** @private @type { object | null } */ #localShadowInput; // 받을 점광과 스포트라이트 그림자. ({ depthTexture, lights, gridSize, tileSize, texelSize, strength })
	/** @private @type { Float32Array } */ #pointShadowSlotValues; // 점광마다의 그림자 칸 번호 + 1. (0 이면 없음)
	/** @private @type { Float32Array } */ #localShadowPositionValues;
	/** @private @type { Float32Array } */ #localShadowForwardValues;
	/** @private @type { Float32Array } */ #localShadowUpValues;
	/** @private @type { Float32Array } */ #localShadowTileValues;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext - 그릴 WebGL2 렌더링 컨텍스트.
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
		this.#pointSpotValues = new System.Float32Array(TOON_MAXIMUM_POINT_LIGHTS * 4);
		this.#pointConeValues = new System.Float32Array(TOON_MAXIMUM_POINT_LIGHTS * 2);
		this.#shadePositionValues = new System.Float32Array(TOON_MAXIMUM_BAND_STEPS);
		this.#shadeFeatherValues = new System.Float32Array(TOON_MAXIMUM_BAND_STEPS);
		this.#shadeColorValues = new System.Float32Array(TOON_MAXIMUM_BAND_STEPS * 3);
		this.#viewRotationElements = new System.Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
		this.#cameraRoll = 0;
		this.#outlineDistanceScale = [0, 0.5, 4];
		this.#outlineFadeDistance = [0, 0];
		this.#localShadowInput = null;
		this.#pointShadowSlotValues = new System.Float32Array(TOON_MAXIMUM_POINT_LIGHTS);
		this.#localShadowPositionValues = new System.Float32Array(SHADOW_ATLAS_MAXIMUM_LIGHTS * 4);
		this.#localShadowForwardValues = new System.Float32Array(SHADOW_ATLAS_MAXIMUM_LIGHTS * 4);
		this.#localShadowUpValues = new System.Float32Array(SHADOW_ATLAS_MAXIMUM_LIGHTS * 4);
		this.#localShadowTileValues = new System.Float32Array(SHADOW_ATLAS_MAXIMUM_LIGHTS);
	}

	//==============================================================================
	// 셰이더 소스 반환. (ShaderWarmer 로 미리 링크할 때, 머티리얼과 인스턴스 꼴이 없으면 기본 프로그램)
	//==============================================================================
	/**
	 * @static
	 * @param { ToonMaterial | null } [material] - 셰이더 조각을 끼울 머티리얼. (기본 null)
	 * @param { ToonInstanceLayout | null } [instanceLayout] - 인스턴스 꼴. (기본 null)
	 * @returns { Array<object> } { vertexShader, fragmentShader, attributeLocationTable } 의 배열. (몸, 바깥선, 그림자 깊이)
	 * @example <caption>로딩 동안 기본과 머티리얼의 프로그램을 뒤에서 링크해 두기</caption>
	 * import { ToonRenderer, ToonMaterial, ShaderWarmer } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const material = new ToonMaterial({ name: "warm", surfaceChunk: "void applySurface(inout ToonSurface surface) { surface.baseColor *= vec3(1.1, 1.0, 0.9); }" });
	 * const shaderWarmer = new ShaderWarmer(webGL2RenderingContext, ToonRenderer.readProgramSources().concat(ToonRenderer.readProgramSources(material)));
	 * shaderWarmer.update();
	 * const renderer = new ToonRenderer(webGL2RenderingContext);
	 * renderer.prepareMaterial(material);
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
	 * @param { ToonMaterial | null } material - 머티리얼. (null 이면 빈 조각)
	 * @param { ToonInstanceLayout | null } instanceLayout - 인스턴스 꼴. (null 이면 없음)
	 * @returns { object } 세 프로그램 칸. ({ solid, outline, depth } 마다 { program, kind, frameSerial, lightSet, lightVersion })
	 * @private
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
		webGL2RenderingContext.uniform1i(solidProgram.getUniformLocation("rampTexture"), RAMP_TEXTURE_UNIT);
		webGL2RenderingContext.uniform1i(solidProgram.getUniformLocation("matcapTexture"), MATCAP_TEXTURE_UNIT);
		webGL2RenderingContext.uniform1i(solidProgram.getUniformLocation("localShadowTexture"), LOCAL_SHADOW_TEXTURE_UNIT);
		webGL2RenderingContext.uniform1i(solidProgram.getUniformLocation("angelRingTexture"), ANGEL_RING_TEXTURE_UNIT);
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
	 * @param { ToonMaterial | null } material - 머티리얼. (null 이면 빈 조각)
	 * @param { ToonInstanceLayout | null } instanceLayout - 인스턴스 꼴. (null 이면 없음)
	 * @returns { object | null } { solid, outline, depth } 프로그램 칸. (짓지 못했으면 null)
	 * @private
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
	 * @param { object } chunks - { name, uniformChunk, surfaceChunk, lightChunk, vertexChunk } (없는 칸은 빈 글)
	 * @returns { ToonMaterial } 지은 머티리얼.
	 */
	createMaterial(chunks) {
		return new ToonMaterial(chunks);
	}

	//==============================================================================
	// 머티리얼의 프로그램을 미리 짓기. (처음 그릴 때의 멈춤을 피할 때, 짓지 못하면 false)
	//==============================================================================
	/**
	 * @param { ToonMaterial | null } material - 미리 지을 머티리얼. (null 이면 기본 프로그램)
	 * @param { ToonInstanceLayout | null } [instanceLayout] - 함께 쓸 인스턴스 꼴. (기본 null)
	 * @returns { boolean } 짓지 못하면 false.
	 * @example <caption>불러오는 동안 머티리얼 프로그램을 미리 짓기</caption>
	 * import { ToonRenderer } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * const material = renderer.createMaterial({
	 * 	name: "checker",
	 * 	surfaceChunk: "void applySurface(inout ToonSurface surface) { vec3 cell = floor(surface.worldPosition * 4.0); surface.baseColor *= mod(cell.x + cell.y + cell.z, 2.0) < 1.0 ? 0.7 : 1.0; }",
	 * });
	 * const instanceLayout = renderer.createInstanceLayout([{ name: "instanceMatrix", size: 16 }, { name: "instanceTint", size: 4 }]);
	 * const isReady = renderer.prepareMaterial(material) && renderer.prepareMaterial(material, instanceLayout);
	 * if (!isReady) {
	 * 	renderer.deleteMaterial(material);
	 * }
	 */
	prepareMaterial(material, instanceLayout = null) {
		return this.readProgramSet(material, instanceLayout) !== null;
	}

	//==============================================================================
	// 머티리얼의 프로그램 지우기. (모든 인스턴스 꼴의 것, 다시 그리면 새로 짓는다)
	//==============================================================================
	/**
	 * @param { ToonMaterial } material - 프로그램을 지울 머티리얼.
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
	 * @param { object | null } programSet - createProgramSet 의 결과. (null 이면 하지 않는다)
	 * @private
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
	 * @returns { ToonLightSet } 기본 빛과 같은 값으로 시작하는 새 빛 묶음.
	 */
	createLightSet() {
		return new ToonLightSet();
	}

	//==============================================================================
	// 기본 빛 묶음 반환.
	//==============================================================================
	/**
	 * @returns { ToonLightSet } 기본 빛 묶음.
	 */
	getLightSet() {
		return this.#lightSet;
	}

	//==============================================================================
	// 인스턴스 꼴 짓기. ([{ name, size }], toonmaterial.js 의 ToonInstanceLayout)
	//==============================================================================
	/**
	 * @param { Array<object> } attributes - { name, size } 의 배열.
	 * @returns { ToonInstanceLayout } 지은 인스턴스 꼴.
	 * @example <caption>자리와 색만 담는 꼴을 정점 조각과 짝짓기</caption>
	 * import { ToonRenderer } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * const instanceLayout = renderer.createInstanceLayout([{ name: "instanceOffset", size: 3 }, { name: "instanceTint", size: 4 }]);
	 * const material = renderer.createMaterial({
	 * 	name: "offset",
	 * 	vertexChunk: "void applyVertex(inout ToonVertex vertex) { vertex.modelMatrix[3].xyz += instanceOffset; }",
	 * });
	 * if (!renderer.prepareMaterial(material, instanceLayout) || instanceLayout.getFloatCount() !== 7) {
	 * 	throw new Error("layout failed");
	 * }
	 */
	createInstanceLayout(attributes) {
		return new ToonInstanceLayout(attributes);
	}

	//==============================================================================
	// 영구 인스턴스 버퍼 짓기. (꼴의 수 개수씩 담은 data, ToonBufferUsage.static 이면 한 번 올리고 오래 그림)
	//==============================================================================
	/**
	 * @param { ToonInstanceLayout } instanceLayout - 인스턴스 하나의 꼴.
	 * @param { Float32Array } data - 꼴의 수 개수씩 인스턴스를 이어 담은 수.
	 * @param { string } [usage] - ToonBufferUsage 의 값. (기본 static)
	 * @returns { object } 인스턴스 버퍼. ({ layout, buffer, usage, floatCount, vertexArrays })
	 * @example <caption>나무 아홉 그루의 행렬과 틴트를 한 번 올리기</caption>
	 * import { ToonRenderer, Matrix4 } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * const instanceLayout = renderer.createInstanceLayout([{ name: "instanceMatrix", size: 16 }, { name: "instanceTint", size: 4 }]);
	 * const floatCount = instanceLayout.getFloatCount();
	 * const data = new Float32Array(floatCount * 9);
	 * for (let index = 0; index < 9; ++index) {
	 * 	data.set(Matrix4.createTranslation(index % 3 - 1, 0, Math.floor(index / 3) - 1).getElements(), index * floatCount);
	 * 	data.set([1, 1 - index * 0.05, 1, 1], index * floatCount + 16);
	 * }
	 * const instanceBuffer = renderer.createInstanceBuffer(instanceLayout, data);
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
	 * @param { Float32Array } data - 새 수. (인스턴스 수가 바뀌어도 된다)
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
	 * @param { object } instanceBuffer - createInstanceBuffer 의 결과.
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
	 * @param { object } source - ImageBitmap, 캔버스, 이미지, ImageData 나 { width, height, data }.
	 * @param { object } [options] - { isMipmapped (기본 true), isRepeated (기본 true, false 면 가장자리 붙임), isFiltered (기본 true, false 면 가까운 화소) }
	 * @returns { WebGLTexture } 지은 RGBA 텍스처.
	 * @example <caption>캔버스에 그린 무늬를 바탕색 텍스처로 쓰기</caption>
	 * import { ToonRenderer, ToonMesh, Matrix4, Vector3 } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * const canvas = document.createElement("canvas");
	 * canvas.width = 64;
	 * canvas.height = 64;
	 * const context = canvas.getContext("2d");
	 * context.fillStyle = "#f0e0c0";
	 * context.fillRect(0, 0, 64, 64);
	 * context.fillStyle = "#c04040";
	 * context.fillRect(0, 0, 32, 32);
	 * const baseColorTexture = renderer.createTexture(canvas, { isRepeated: true });
	 * const builder = new ToonMesh.MeshBuilder();
	 * builder.addPart(ToonMesh.createBoxGeometry(1, 1, 1), Matrix4.createIdentity(), "#ffffff", { hasOutline: true });
	 * const mesh = renderer.createMesh(builder.readArrays());
	 * renderer.beginFrameWithMatrices(Matrix4.createLookAt(Vector3.create(2, 2, 3), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0)), Matrix4.createPerspective(0.8, 1, 0.1, 20));
	 * renderer.drawMesh(mesh, Matrix4.createIdentity(), { baseColorTexture: baseColorTexture, uvTransform: [0, 0, 2, 2] });
	 * renderer.endFrame();
	 * renderer.deleteTexture(baseColorTexture);
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
	 * @param { WebGLTexture | null } texture - 지울 텍스처. (null 이면 하지 않는다)
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
	 * @param { object } arrays - MeshBuilder.readArrays 나 ToonGlb.readGlbArrays 의 결과.
	 * @returns { object | null } GPU 에 올린 모형. (몸의 꼭짓점 번호가 비면 null)
	 * @example <caption>부품 둘을 한 모형으로 올리고 다 쓰면 지우기</caption>
	 * import { ToonRenderer, ToonMesh, Matrix4 } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * const builder = new ToonMesh.MeshBuilder();
	 * builder.addPart(ToonMesh.createBoxGeometry(0.8, 1, 0.5), Matrix4.createTranslation(0, 0.5, 0), "#6080c0", { hasOutline: true });
	 * builder.addPart(ToonMesh.createSphereGeometry(0.3, 20, 14), Matrix4.createTranslation(0, 1.3, 0), "#f0d0b0", { hasOutline: true });
	 * const mesh = renderer.createMesh(builder.readArrays());
	 * if (mesh === null) {
	 * 	throw new Error("empty mesh");
	 * }
	 * renderer.deleteMesh(mesh);
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
		const hasSecondUv = hasUv && arrays.uv1Data !== undefined && arrays.uv1Data !== null && arrays.uv1Data.length >= vertexCount * 2;
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
			hasSecondUv: hasSecondUv,
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
			mesh.uvBuffer = this.createArrayBuffer(readUvData(arrays.uvData, hasSecondUv ? arrays.uv1Data : null, vertexCount), webGL2RenderingContext.STATIC_DRAW);
			buffers.push(mesh.uvBuffer);
		}
		mesh.bodyVertexArray = webGL2RenderingContext.createVertexArray();
		webGL2RenderingContext.bindVertexArray(mesh.bodyVertexArray);
		mesh.bodyIndexBuffer = this.createIndexBuffer(arrays.indexData);
		buffers.push(mesh.bodyIndexBuffer);
		this.attachBodyAttributes(mesh);
		this.attachInstanceAttributes(instanceBuffer);

		// 바깥선 껍데기. (바탕 자리 3 과 미는 쪽 3, 미는 쪽은 지은 굵기의 사본 자리 - 바탕 자리, 바탕이 없으면 0)
		const outlineIndexData = arrays.outlineIndexData;
		if (outlineIndexData !== undefined && outlineIndexData !== null && outlineIndexData.length > 0) {
			mesh.outlineBuffer = this.createArrayBuffer(readOutlineVertexData(arrays.outlineVertexData, arrays.outlineBaseData), webGL2RenderingContext.STATIC_DRAW);
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
	 * @param { Float32Array } data - 올릴 수.
	 * @param { number } usage - STATIC_DRAW 나 DYNAMIC_DRAW.
	 * @returns { WebGLBuffer } 지은 꼭짓점 버퍼.
	 * @private
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
	 * @param { Uint32Array } data - 꼭짓점 번호.
	 * @returns { WebGLBuffer } 지은 번호 버퍼.
	 * @private
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
	 * @param { object } mesh - createMesh 가 짓는 모형.
	 * @private
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
			webGL2RenderingContext.vertexAttribPointer(TOON_ATTRIBUTE_LOCATIONS.vertexUv, mesh.hasSecondUv ? 4 : 2, webGL2RenderingContext.FLOAT, false, mesh.hasSecondUv ? 16 : 8, 0);
		}
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ELEMENT_ARRAY_BUFFER, mesh.bodyIndexBuffer);
	}

	//==============================================================================
	// 바깥선 껍데기의 자리, 뼈대 어트리뷰트와 번호 버퍼를 지금 묶인 버텍스 어레이에 붙이기.
	//==============================================================================
	/**
	 * @param { object } mesh - createMesh 가 짓는 모형. (껍데기가 있는 것)
	 * @private
	 */
	attachOutlineAttributes(mesh) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, mesh.outlineBuffer);
		webGL2RenderingContext.enableVertexAttribArray(TOON_ATTRIBUTE_LOCATIONS.vertexPosition);
		webGL2RenderingContext.vertexAttribPointer(TOON_ATTRIBUTE_LOCATIONS.vertexPosition, 3, webGL2RenderingContext.FLOAT, false, 24, 0);
		webGL2RenderingContext.enableVertexAttribArray(TOON_ATTRIBUTE_LOCATIONS.vertexNormal);
		webGL2RenderingContext.vertexAttribPointer(TOON_ATTRIBUTE_LOCATIONS.vertexNormal, 3, webGL2RenderingContext.FLOAT, false, 24, 12);
		if (mesh.outlineSkinBuffer !== null) {
			this.attachSkinAttributes(mesh.outlineSkinBuffer);
		}
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ELEMENT_ARRAY_BUFFER, mesh.outlineIndexBuffer);
	}

	//==============================================================================
	// 뼈대 번호와 무게의 버퍼를 지금 묶인 버텍스 어레이에 어트리뷰트로 붙이기.
	//==============================================================================
	/**
	 * @param { WebGLBuffer } skinBuffer - 꼭짓점마다 뼈대 번호 4 와 무게 4 를 담은 버퍼.
	 * @private
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
	 * @param { WebGLBuffer } instanceBuffer - 인스턴스마다 행렬 16 과 틴트 4 를 담은 버퍼.
	 * @private
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
	 * @param { ToonInstanceLayout } instanceLayout - 버퍼의 인스턴스 꼴.
	 * @param { WebGLBuffer } buffer - 그 꼴로 담은 버퍼.
	 * @private
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
	 * @param { object } mesh - createMesh 의 결과.
	 * @param { object } instanceBuffer - createInstanceBuffer 의 결과.
	 * @returns { object } 몸과 바깥선의 버텍스 어레이. ({ body, outline }, 껍데기가 없으면 outline 은 null)
	 * @private
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
	 * @returns { WebGLTexture } 1x1 비교 깊이 텍스처.
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
	 * @param { object | null } mesh - createMesh 의 결과. (null 이면 하지 않는다)
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
			activeTexture: webGL2RenderingContext.getParameter(webGL2RenderingContext.ACTIVE_TEXTURE),
			firstUnitTexture: this.readFirstUnitTexture(),
		};
	}

	//==============================================================================
	// 유닛 0 에 묶인 텍스처 읽기. (지금 고른 유닛은 그대로 둔다)
	//==============================================================================
	/**
	 * @returns { WebGLTexture | null } 유닛 0 의 텍스처. (없으면 null)
	 * @private
	 */
	readFirstUnitTexture() {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const activeTexture = webGL2RenderingContext.getParameter(webGL2RenderingContext.ACTIVE_TEXTURE);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		const texture = webGL2RenderingContext.getParameter(webGL2RenderingContext.TEXTURE_BINDING_2D);
		webGL2RenderingContext.activeTexture(activeTexture);
		return texture;
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
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, savedState.firstUnitTexture);
		webGL2RenderingContext.activeTexture(savedState.activeTexture);
		this.#savedState = null;
	}

	//==============================================================================
	// 그리기 기능 켜고 끄기.
	//==============================================================================
	/**
	 * @param { GLenum } capability - WebGL 기능. (BLEND, DEPTH_TEST 같은)
	 * @param { boolean } isEnabled - 켤지.
	 * @private
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
	 * @param { Matrix4 } viewProjectionMatrix - 보기와 투영 행렬. (투영 x 보기)
	 */
	beginFrame(viewProjectionMatrix) {
		const elements = viewProjectionMatrix.getElements();
		this.#viewProjectionElements.set(elements);
		this.#frustumPlanes = extractFrustumPlanes(viewProjectionMatrix);
		const frameCamera = readFrameCamera(elements);
		this.#cameraPosition = frameCamera.position;
		this.#cameraForward = frameCamera.forward;
		this.#isFrameMirrored = frameCamera.isMirrored;
		this.#viewRotationElements.set(readViewRotation(elements, frameCamera.forward));
		this.#cameraRoll = readCameraRoll(this.#viewRotationElements, frameCamera.isMirrored);
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
	 * @param { object } camera - Camera3D. (보기와 투영을 읽는다)
	 * @example <caption>Camera3D 로 프레임 시작하기</caption>
	 * import { ToonRenderer, ToonMesh, Camera3D, Matrix4, Vector3 } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * const builder = new ToonMesh.MeshBuilder();
	 * builder.addPart(ToonMesh.createCylinderGeometry(0.4, 0.4, 1, 24), Matrix4.createIdentity(), "#c0a0e0", { hasOutline: true });
	 * const mesh = renderer.createMesh(builder.readArrays());
	 * const camera = new Camera3D();
	 * camera.setPerspective(0.8, 0.1, 100);
	 * camera.lookAt(Vector3.create(0, 1.5, 4), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
	 * renderer.beginFrameWithCamera(camera);
	 * renderer.drawMesh(mesh, Matrix4.createIdentity());
	 * renderer.endFrame();
	 */
	beginFrameWithCamera(camera) {
		const viewProjectionMatrix = camera.getViewProjectionMatrix();
		this.beginFrame(viewProjectionMatrix);
	}

	//==============================================================================
	// 보기와 투영 행렬로 프레임 시작. (Camera3D 없이, 투영 x 보기로 beginFrame)
	//==============================================================================
	/**
	 * @param { Matrix4 } viewMatrix - 보기 행렬.
	 * @param { Matrix4 } projectionMatrix - 투영 행렬.
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
	 * @returns { object } 이번 프레임의 카메라. ({ position [x, y, z, w(1 원근, 0 직교)], forward, isMirrored })
	 */
	getFrameCamera() {
		return { position: this.#cameraPosition, forward: this.#cameraForward, isMirrored: this.#isFrameMirrored };
	}

	//==============================================================================
	// 그릴 화면 사각형 설정. (뷰포트 픽셀, 왼쪽 위 원점, 다음 beginFrame 부터)
	//==============================================================================
	/**
	 * @param { number } x - 왼쪽 끝. (뷰포트 픽셀)
	 * @param { number } y - 위쪽 끝. (뷰포트 픽셀, 위가 0)
	 * @param { number } width - 너비. (픽셀)
	 * @param { number } height - 높이. (픽셀)
	 * @example <caption>드로잉 버퍼 오른쪽 위 사각형에만 미리보기 그리기</caption>
	 * import { ToonRenderer, ToonMesh, Matrix4, Vector3 } from "./vanilla.js";
	 * const canvas = document.createElement("canvas");
	 * canvas.width = 320;
	 * canvas.height = 240;
	 * const renderer = new ToonRenderer(canvas.getContext("webgl2"));
	 * const builder = new ToonMesh.MeshBuilder();
	 * builder.addPart(ToonMesh.createOctahedronGeometry(0.6), Matrix4.createIdentity(), "#60c0a0", { hasOutline: true });
	 * const mesh = renderer.createMesh(builder.readArrays());
	 * renderer.setScreenRect(200, 16, 104, 78);
	 * renderer.beginFrameWithMatrices(Matrix4.createLookAt(Vector3.create(0, 1, 3), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0)), Matrix4.createPerspective(0.8, 104 / 78, 0.1, 20));
	 * renderer.drawMesh(mesh, Matrix4.createIdentity());
	 * renderer.endFrame();
	 * renderer.clearScreenRect();
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
	 * @returns { object | null } 그릴 화면 사각형. ({ x, y, width, height }, 없으면 null)
	 */
	getScreenRect() {
		return this.#screenRect;
	}

	//==============================================================================
	// 화면 사각형 걸기. (beginFrame 이 상태를 적은 뒤, 클립 x, y 에 사각형의 비를 곱하고 자리를 더한 뒤 가위를 켠다)
	//==============================================================================
	/** @private */
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
	/** @private */
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
	 * @param { object } shadowMap - ShadowMap. (깊이를 그릴 곳, updateLightMatrix 로 빛 행렬을 정해 둔다)
	 * @example <caption>해의 그림자를 ShadowMap 에 드리우고 받기</caption>
	 * import { ToonRenderer, ToonMesh, ShadowMap, Matrix4, Vector3 } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const renderer = new ToonRenderer(webGL2RenderingContext);
	 * const builder = new ToonMesh.MeshBuilder();
	 * builder.addPart(ToonMesh.createBoxGeometry(0.6, 0.6, 0.6), Matrix4.createTranslation(0, 0.6, 0), "#e0b080", { hasOutline: true });
	 * builder.addPart(ToonMesh.createBoxGeometry(4, 0.1, 4), Matrix4.createTranslation(0, -0.05, 0), "#a0b0a0", { hasOutline: false });
	 * const mesh = renderer.createMesh(builder.readArrays());
	 * const shadowMap = new ShadowMap(webGL2RenderingContext, 1024);
	 * const sunDirection = renderer.getSunDirection();
	 * shadowMap.updateLightMatrix(Vector3.create(0, 0, 0), Vector3.create(sunDirection[0], sunDirection[1], sunDirection[2]), 3, 0.5, 20);
	 * renderer.beginShadowPass(shadowMap);
	 * renderer.drawMesh(mesh, Matrix4.createIdentity());
	 * renderer.endShadowPass();
	 * renderer.setShadow(shadowMap, 0.7);
	 * renderer.beginFrameWithMatrices(Matrix4.createLookAt(Vector3.create(2, 3, 4), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0)), Matrix4.createPerspective(0.8, 1, 0.1, 30));
	 * renderer.drawMesh(mesh, Matrix4.createIdentity());
	 * renderer.endFrame();
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
	// 그림자 아틀라스 깊이 패스 시작. (아틀라스를 묶어 비우고 앞의 상태를 적어 둔다, 칸마다 setShadowAtlasTile 뒤에 drawMesh 가 깊이만 그린다, 끝은 endShadowPass)
	//==============================================================================
	/**
	 * @param { object } shadowAtlas - ShadowAtlas.
	 * @example <caption>점광 그림자 아틀라스의 칸마다 깊이 그리기</caption>
	 * import { ToonRenderer, ToonMesh, ShadowAtlas, Matrix4 } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const renderer = new ToonRenderer(webGL2RenderingContext);
	 * const builder = new ToonMesh.MeshBuilder();
	 * builder.addPart(ToonMesh.createBoxGeometry(1, 1, 1), Matrix4.createTranslation(0, 0.5, 0), "#c0a080", { hasOutline: false });
	 * const mesh = renderer.createMesh(builder.readArrays());
	 * renderer.setPointLights([{ position: [0, 2.5, 1], color: [1, 0.8, 0.6], intensity: 3, range: 8, castsShadow: true }]);
	 * const shadowAtlas = new ShadowAtlas(webGL2RenderingContext, 1024);
	 * shadowAtlas.updateLights(renderer.getLightSet().getPointLights());
	 * renderer.beginShadowAtlasPass(shadowAtlas);
	 * for (let tileIndex = 0; tileIndex < shadowAtlas.getTileCount(); ++tileIndex) {
	 * 	renderer.setShadowAtlasTile(shadowAtlas, tileIndex);
	 * 	renderer.drawMesh(mesh, Matrix4.createIdentity());
	 * }
	 * renderer.endShadowPass();
	 * renderer.setLocalShadows(shadowAtlas, 1);
	 */
	beginShadowAtlasPass(shadowAtlas) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		this.saveState();
		this.#isShadowPass = true;
		this.#isFrameMirrored = false;
		this.#frameSerial += 1;
		shadowAtlas.beginRender();
		webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);
		webGL2RenderingContext.depthFunc(webGL2RenderingContext.LEQUAL);
		webGL2RenderingContext.enable(webGL2RenderingContext.CULL_FACE);
		webGL2RenderingContext.cullFace(webGL2RenderingContext.BACK);
	}

	//==============================================================================
	// 그림자 아틀라스의 칸 고르기. (그 칸의 보기와 투영과 절두체, 뷰포트를 건다, beginShadowAtlasPass 와 endShadowPass 사이)
	//==============================================================================
	/**
	 * @param { object } shadowAtlas - ShadowAtlas.
	 * @param { number } tileIndex - 칸 번호.
	 */
	setShadowAtlasTile(shadowAtlas, tileIndex) {
		const viewProjectionMatrix = shadowAtlas.getTile(tileIndex).viewProjectionMatrix;
		this.#viewProjectionElements.set(viewProjectionMatrix.getElements());
		this.#frustumPlanes = extractFrustumPlanes(viewProjectionMatrix);
		this.#frameSerial += 1;
		shadowAtlas.beginTile(tileIndex);
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
	 * @param { object } mesh - createMesh 의 결과.
	 * @param { Float32Array } modelElements - 모형 행렬의 수 16.
	 * @returns { boolean } 절두체 안에 들면 true.
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
	 * @param { Matrix4 } modelMatrix - 모형 행렬.
	 * @param { object } [options] - 클래스 머리말의 그리기 꼴과 jointMatrices Float32Array, hasOutline (기본 true), isCulled (기본 true)
	 * @example <caption>틴트, 바깥선 색과 굵기, 반투명을 그리기마다 바꾸기</caption>
	 * import { ToonRenderer, ToonMesh, Matrix4, Vector3 } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * const builder = new ToonMesh.MeshBuilder();
	 * builder.addPart(ToonMesh.createRoundedBoxGeometry(0.8, 0.8, 0.8, 4, 0.1), Matrix4.createIdentity(), "#e0e0e0", { hasOutline: true });
	 * const mesh = renderer.createMesh(builder.readArrays());
	 * renderer.beginFrameWithMatrices(Matrix4.createLookAt(Vector3.create(0, 1.5, 4), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0)), Matrix4.createPerspective(0.8, 1, 0.1, 20));
	 * renderer.drawMesh(mesh, Matrix4.createTranslation(-1, 0, 0), { tintColor: [1, 0.6, 0.6, 1], outlineColor: [0.4, 0.05, 0.05, 1], outlineWidthScale: 1.5 });
	 * renderer.drawMesh(mesh, Matrix4.createTranslation(0, 0, 0), { tintColor: [1, 0.2, 0.2, 1], tintAmount: 0.7, shadeOffset: 0.2 });
	 * renderer.drawMesh(mesh, Matrix4.createTranslation(1, 0, 0), { alpha: 0.5, softEdge: 1.5, hasOutline: false });
	 * renderer.endFrame();
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
	 * @param { object } mesh - createMesh 의 결과.
	 * @param { Array<object> } instances - { modelMatrix: Matrix4, tintColor: [r, g, b, a] } 의 배열.
	 * @param { object } [options] - drawMesh 와 같다. (모든 인스턴스에 같게 건다)
	 * @example <caption>같은 바위 스무 개를 인스턴스마다 다른 틴트로</caption>
	 * import { ToonRenderer, ToonMesh, Matrix4, Vector3 } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * const builder = new ToonMesh.MeshBuilder();
	 * builder.addPart(ToonMesh.createOctahedronGeometry(0.3), Matrix4.createIdentity(), "#909098", { hasOutline: true });
	 * const rockMesh = renderer.createMesh(builder.readArrays());
	 * const instances = [];
	 * for (let index = 0; index < 20; ++index) {
	 * 	const shade = 0.7 + (index % 4) * 0.1;
	 * 	instances.push({ modelMatrix: Matrix4.createTranslation(index % 5 - 2, 0, Math.floor(index / 5) - 2), tintColor: [shade, shade, shade, 1] });
	 * }
	 * renderer.beginFrameWithMatrices(Matrix4.createLookAt(Vector3.create(0, 4, 6), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0)), Matrix4.createPerspective(0.8, 1, 0.1, 30));
	 * renderer.drawMeshInstanced(rockMesh, instances, { specularScale: 0 });
	 * renderer.endFrame();
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
	 * @param { object } mesh - createMesh 의 결과.
	 * @param { object } instanceBuffer - createInstanceBuffer 의 결과.
	 * @param { number } instanceCount - 그릴 인스턴스 수. (버퍼에 든 수를 넘으면 자른다)
	 * @param { object } [options] - drawMesh 와 같다. (material 의 정점 조각이 사용자 어트리뷰트를 읽는다)
	 * @example <caption>자리만 담은 영구 버퍼로 풀숲 그리기</caption>
	 * import { ToonRenderer, ToonMesh, Matrix4, Vector3 } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * const builder = new ToonMesh.MeshBuilder();
	 * builder.addPart(ToonMesh.createCylinderGeometry(0.02, 0.15, 0.6, 6), Matrix4.createTranslation(0, 0.3, 0), "#60a050", { hasOutline: true });
	 * const grassMesh = renderer.createMesh(builder.readArrays());
	 * const instanceLayout = renderer.createInstanceLayout([{ name: "instanceOffset", size: 3 }]);
	 * const material = renderer.createMaterial({ name: "grass", vertexChunk: "void applyVertex(inout ToonVertex vertex) { vertex.modelMatrix[3].xyz += instanceOffset; }" });
	 * const data = new Float32Array(3 * 50);
	 * for (let index = 0; index < 50; ++index) {
	 * 	data.set([(index % 10) * 0.4 - 2, 0, Math.floor(index / 10) * 0.4 - 1], index * 3);
	 * }
	 * const instanceBuffer = renderer.createInstanceBuffer(instanceLayout, data);
	 * renderer.beginFrameWithMatrices(Matrix4.createLookAt(Vector3.create(0, 3, 5), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0)), Matrix4.createPerspective(0.8, 1, 0.1, 30));
	 * renderer.drawMeshInstanceBuffer(grassMesh, instanceBuffer, 50, { material: material });
	 * renderer.endFrame();
	 * renderer.deleteInstanceBuffer(instanceBuffer);
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
	 * @param { object } mesh - createMesh 의 결과.
	 * @param { Matrix4 } modelMatrix - 모형 행렬.
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
	 * @private
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
			const cameraPosition = this.#cameraPosition;
			const outlineDistanceScale = this.#outlineDistanceScale;
			webGL2RenderingContext.uniform4f(shaderProgram.getUniformLocation("cameraPosition"), cameraPosition[0], cameraPosition[1], cameraPosition[2], cameraPosition[3]);
			webGL2RenderingContext.uniform3f(shaderProgram.getUniformLocation("outlineDistanceScale"), outlineDistanceScale[0], outlineDistanceScale[1], outlineDistanceScale[2]);
			webGL2RenderingContext.uniform2f(shaderProgram.getUniformLocation("outlineFadeDistance"), this.#outlineFadeDistance[0], this.#outlineFadeDistance[1]);
			webGL2RenderingContext.uniform3f(shaderProgram.getUniformLocation("cameraForward"), this.#cameraForward[0], this.#cameraForward[1], this.#cameraForward[2]);
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
		webGL2RenderingContext.uniformMatrix3fv(shaderProgram.getUniformLocation("viewRotation"), false, this.#viewRotationElements);
		webGL2RenderingContext.uniform2f(shaderProgram.getUniformLocation("cameraRoll"), System.Math.cos(this.#cameraRoll), System.Math.sin(this.#cameraRoll));
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
		this.uploadLocalShadowUniforms(shaderProgram);
	}

	//==============================================================================
	// 점광과 스포트라이트 그림자 올리기. (아틀라스의 빛마다 자리, 바탕, 거리, 첫 칸과 점광마다의 칸 번호)
	//==============================================================================
	/**
	 * @param { ShaderProgram } shaderProgram - 몸 프로그램.
	 * @private
	 */
	uploadLocalShadowUniforms(shaderProgram) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const localShadowInput = this.#localShadowInput;
		const slotValues = this.#pointShadowSlotValues;
		const positionValues = this.#localShadowPositionValues;
		const forwardValues = this.#localShadowForwardValues;
		const upValues = this.#localShadowUpValues;
		const tileValues = this.#localShadowTileValues;
		slotValues.fill(0);
		positionValues.fill(0);
		forwardValues.fill(0);
		upValues.fill(0);
		tileValues.fill(0);
		if (localShadowInput !== null) {
			localShadowInput.lights.forEach((light, slot) => {
				if (light.lightIndex < TOON_MAXIMUM_POINT_LIGHTS) {
					slotValues[light.lightIndex] = slot + 1;
				}
				positionValues.set([light.position[0], light.position[1], light.position[2], light.near], slot * 4);
				forwardValues.set([light.forward[0], light.forward[1], light.forward[2], light.far], slot * 4);
				upValues.set([light.up[0], light.up[1], light.up[2], light.tangent], slot * 4);
				tileValues[slot] = light.firstTile;
			});
			webGL2RenderingContext.uniform4f(shaderProgram.getUniformLocation("localShadowAtlas"), localShadowInput.gridSize, localShadowInput.tileSize, localShadowInput.texelSize, localShadowInput.strength);
		}
		webGL2RenderingContext.uniform1fv(shaderProgram.getUniformLocation("pointLightShadowSlots"), slotValues);
		webGL2RenderingContext.uniform4fv(shaderProgram.getUniformLocation("localShadowPositions"), positionValues);
		webGL2RenderingContext.uniform4fv(shaderProgram.getUniformLocation("localShadowForwards"), forwardValues);
		webGL2RenderingContext.uniform4fv(shaderProgram.getUniformLocation("localShadowUps"), upValues);
		webGL2RenderingContext.uniform1fv(shaderProgram.getUniformLocation("localShadowTiles"), tileValues);
	}

	//==============================================================================
	// 몸 프로그램의 빛 묶음 올리기. (같은 묶음, 같은 판이면 건너뛴다)
	//==============================================================================
	/**
	 * @param { object } entry - 몸 프로그램 칸.
	 * @param { ToonLightSet } lightSet - 올릴 빛 묶음.
	 * @private
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
		const shadeRamp = lightSet.getShadeRamp();
		webGL2RenderingContext.uniform3f(shaderProgram.getUniformLocation("sunDirection"), sunDirection[0], sunDirection[1], sunDirection[2]);
		webGL2RenderingContext.uniform3f(shaderProgram.getUniformLocation("sunColor"), sunColor[0], sunColor[1], sunColor[2]);
		webGL2RenderingContext.uniform3f(shaderProgram.getUniformLocation("skyColor"), skyColor[0], skyColor[1], skyColor[2]);
		webGL2RenderingContext.uniform3f(shaderProgram.getUniformLocation("groundColor"), groundColor[0], groundColor[1], groundColor[2]);
		webGL2RenderingContext.uniform3f(shaderProgram.getUniformLocation("fillDirection"), fillLight.direction[0], fillLight.direction[1], fillLight.direction[2]);
		webGL2RenderingContext.uniform3f(shaderProgram.getUniformLocation("fillColor"), fillLight.color[0], fillLight.color[1], fillLight.color[2]);
		webGL2RenderingContext.uniform4f(shaderProgram.getUniformLocation("rimLight"), rimLight.color[0], rimLight.color[1], rimLight.color[2], rimLight.power);
		webGL2RenderingContext.uniform2f(shaderProgram.getUniformLocation("rimShape"), rimLight.feather, rimLight.lightMask);
		const shadeRimLight = lightSet.getShadeRimLight();
		webGL2RenderingContext.uniform4f(shaderProgram.getUniformLocation("shadeRimLight"), shadeRimLight.color[0], shadeRimLight.color[1], shadeRimLight.color[2], shadeRimLight.power);
		const lightColorUsage = lightSet.getLightColorUsage();
		const readUsage = (isUsed) => {
			return isUsed ? 1 : 0;
		};
		webGL2RenderingContext.uniform4f(shaderProgram.getUniformLocation("lightColorUsage"), readUsage(lightColorUsage.base), readUsage(lightColorUsage.shade), readUsage(lightColorUsage.highlight), readUsage(lightColorUsage.rim));
		webGL2RenderingContext.uniform3f(shaderProgram.getUniformLocation("lightColorUsageExtra"), readUsage(lightColorUsage.shadeRim), readUsage(lightColorUsage.matcap), readUsage(lightColorUsage.angelRing));
		webGL2RenderingContext.uniform3f(shaderProgram.getUniformLocation("specularLight"), specular.strength, specular.exponent, specular.feather);
		webGL2RenderingContext.uniform3f(shaderProgram.getUniformLocation("specularColor"), specular.color[0], specular.color[1], specular.color[2]);
		webGL2RenderingContext.uniform1f(shaderProgram.getUniformLocation("energyNormalized"), lightSet.getLightModel().isEnergyNormalized ? 1 : 0);
		webGL2RenderingContext.uniform1f(shaderProgram.getUniformLocation("lightIntensityLimit"), lightSet.isLightIntensityLimited() ? 1 : 0);
		const shadePositionValues = this.#shadePositionValues;
		const shadeFeatherValues = this.#shadeFeatherValues;
		const shadeColorValues = this.#shadeColorValues;
		shadePositionValues.fill(0);
		shadeFeatherValues.fill(0);
		shadeColorValues.fill(0);
		const shadeStopCount = shadeRamp.positions.length;
		for (let stopIndex = 0; stopIndex < shadeStopCount; ++stopIndex) {
			shadePositionValues[stopIndex] = shadeRamp.positions[stopIndex];
			shadeFeatherValues[stopIndex] = shadeRamp.feathers[stopIndex];
			shadeColorValues.set(shadeRamp.colors[stopIndex], stopIndex * 3);
		}
		webGL2RenderingContext.uniform1i(shaderProgram.getUniformLocation("shadeStopCount"), shadeStopCount);
		webGL2RenderingContext.uniform1fv(shaderProgram.getUniformLocation("shadeStopPositions"), shadePositionValues);
		webGL2RenderingContext.uniform1fv(shaderProgram.getUniformLocation("shadeStopFeathers"), shadeFeatherValues);
		webGL2RenderingContext.uniform3fv(shaderProgram.getUniformLocation("shadeStopColors"), shadeColorValues);
		webGL2RenderingContext.uniform1f(shaderProgram.getUniformLocation("shadeHalfLambert"), shadeRamp.isHalfLambert ? 1 : 0);
		webGL2RenderingContext.uniform1f(shaderProgram.getUniformLocation("rampTextureEnabled"), lightSet.getRampTexture() !== null ? 1 : 0);
		const pointLights = lightSet.getPointLights();
		const pointLightCount = lightSet.getPointLightCount();
		const positionValues = this.#pointPositionValues;
		const colorValues = this.#pointColorValues;
		const shapeValues = this.#pointShapeValues;
		const spotValues = this.#pointSpotValues;
		const coneValues = this.#pointConeValues;
		positionValues.fill(0);
		colorValues.fill(0);
		shapeValues.fill(0);
		spotValues.fill(0);
		coneValues.fill(0);
		for (let lightIndex = 0; lightIndex < pointLightCount; ++lightIndex) {
			const pointLight = pointLights[lightIndex];
			positionValues.set([pointLight.position[0], pointLight.position[1], pointLight.position[2], pointLight.range], lightIndex * 4);
			colorValues.set([pointLight.color[0] * pointLight.intensity, pointLight.color[1] * pointLight.intensity, pointLight.color[2] * pointLight.intensity], lightIndex * 3);
			shapeValues.set([pointLight.decay, pointLight.rangeExponent, pointLight.wrap], lightIndex * 3);
			if (pointLight.direction !== null) {
				const outerCosine = System.Math.cos(pointLight.outerConeAngle);
				const coneScale = 1 / System.Math.max(0.001, System.Math.cos(System.Math.min(pointLight.innerConeAngle, pointLight.outerConeAngle)) - outerCosine);
				spotValues.set([pointLight.direction[0], pointLight.direction[1], pointLight.direction[2], 1], lightIndex * 4);
				coneValues.set([coneScale, -outerCosine * coneScale], lightIndex * 2);
			}
		}
		webGL2RenderingContext.uniform1i(shaderProgram.getUniformLocation("pointLightCount"), pointLightCount);
		webGL2RenderingContext.uniform4fv(shaderProgram.getUniformLocation("pointLightPositions"), positionValues);
		webGL2RenderingContext.uniform3fv(shaderProgram.getUniformLocation("pointLightColors"), colorValues);
		webGL2RenderingContext.uniform3fv(shaderProgram.getUniformLocation("pointLightShapes"), shapeValues);
		webGL2RenderingContext.uniform4fv(shaderProgram.getUniformLocation("pointLightSpots"), spotValues);
		webGL2RenderingContext.uniform2fv(shaderProgram.getUniformLocation("pointLightCones"), coneValues);
	}

	//==============================================================================
	// 그리기마다의 공용 유니폼 올리기. (모형 행렬, 뼈대, 인스턴싱)
	//==============================================================================
	/**
	 * @param { ShaderProgram } shaderProgram - 지금 쓰는 프로그램.
	 * @param { ArrayLike<number> } modelElements - 모형 행렬의 수 16.
	 * @param { boolean } isSkinned - 뼈대로 움직일지.
	 * @param { number } instancedMode - 0 아님, 1 인스턴스 행렬과 틴트, 2 인스턴스 틴트만
	 * @param { Float32Array | null } jointMatrices - 본 행렬의 수. (뼈대가 아니면 null)
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
	 * @param { number } unit - 텍스처 유닛 번호.
	 * @param { WebGLTexture | null | undefined } texture - 묶을 텍스처. (없으면 흰 텍스처)
	 * @private
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
	 * @param { object } mesh - createMesh 의 결과.
	 * @param { ArrayLike<number> } modelElements - 모형 행렬의 수 16. (인스턴스면 감기를 가릴 첫 행렬)
	 * @param { number } instanceCount - 인스턴스 수. (0 이면 보통 그리기)
	 * @param { object } options - drawMesh 의 그리기 꼴.
	 * @param { object | null } instanceBuffer - createInstanceBuffer 의 결과. (없으면 null)
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
			const outlineColor = options.outlineColor !== undefined && options.outlineColor !== null ? options.outlineColor : this.#outlineColor;
			webGL2RenderingContext.uniform4f(outlineProgram.getUniformLocation("outlineColor"), outlineColor[0], outlineColor[1], outlineColor[2], outlineColor.length > 3 ? outlineColor[3] : 1);
			webGL2RenderingContext.uniform1f(outlineProgram.getUniformLocation("outlineWidthScale"), options.outlineWidthScale !== undefined ? System.Math.max(0, options.outlineWidthScale) : 1);
			webGL2RenderingContext.uniform1f(outlineProgram.getUniformLocation("outlineOffsetZ"), options.outlineOffsetZ !== undefined ? options.outlineOffsetZ : 0);
			const outlineLightSet = options.lightSet !== undefined && options.lightSet !== null ? options.lightSet : this.#lightSet;
			const outlineLightColor = outlineLightSet.getLightColorUsage().outline ? readOutlineLightColor(outlineLightSet.getSunColor()) : [1, 1, 1];
			webGL2RenderingContext.uniform3f(outlineProgram.getUniformLocation("outlineLightColor"), outlineLightColor[0], outlineLightColor[1], outlineLightColor[2]);
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
		const lightSet = options.lightSet !== undefined && options.lightSet !== null ? options.lightSet : this.#lightSet;
		this.uploadLightUniforms(solidEntry, lightSet);
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
		const matcapTexture = options.matcapTexture !== undefined ? options.matcapTexture : null;
		webGL2RenderingContext.uniform1f(solidProgram.getUniformLocation("receivesShadow"), options.receivesShadow !== false ? 1 : 0);
		webGL2RenderingContext.uniform1f(solidProgram.getUniformLocation("shadeOffset"), options.shadeOffset !== undefined ? options.shadeOffset : 0);
		webGL2RenderingContext.uniform2f(solidProgram.getUniformLocation("highlightScale"), options.specularScale !== undefined ? System.Math.max(0, options.specularScale) : 1, options.rimScale !== undefined ? System.Math.max(0, options.rimScale) : 1);
		webGL2RenderingContext.uniform3f(solidProgram.getUniformLocation("matcapSettings"), matcapTexture !== null ? 1 : 0, options.matcapStrength !== undefined ? options.matcapStrength : 1, options.matcapBlend === ToonMatcapBlend.add ? 1 : 0);
		const angelRingTexture = options.angelRingTexture !== undefined ? options.angelRingTexture : null;
		const angelRingColor = options.angelRingColor !== undefined ? options.angelRingColor : [1, 1, 1];
		webGL2RenderingContext.uniform4f(solidProgram.getUniformLocation("angelRingSettings"), angelRingTexture !== null ? 1 : 0, options.angelRingOffsetU !== undefined ? options.angelRingOffsetU : 0, options.angelRingOffsetV !== undefined ? options.angelRingOffsetV : 0.3, options.isAngelRingAlpha === true ? 1 : 0);
		webGL2RenderingContext.uniform3f(solidProgram.getUniformLocation("angelRingColor"), angelRingColor[0], angelRingColor[1], angelRingColor[2]);
		const shadowInput = this.#shadowInput;
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + SHADOW_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, shadowInput !== null ? shadowInput.depthTexture : this.#emptyShadowTexture);
		this.bindTextureUnit(BASE_COLOR_TEXTURE_UNIT, baseColorTexture);
		this.bindTextureUnit(EMISSIVE_TEXTURE_UNIT, emissiveTexture);
		this.bindTextureUnit(DECAL_TEXTURE_UNIT, decalTexture);
		this.bindTextureUnit(RAMP_TEXTURE_UNIT, lightSet.getRampTexture());
		this.bindTextureUnit(MATCAP_TEXTURE_UNIT, matcapTexture);
		this.bindTextureUnit(ANGEL_RING_TEXTURE_UNIT, angelRingTexture);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + LOCAL_SHADOW_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, this.#localShadowInput !== null ? this.#localShadowInput.depthTexture : this.#emptyShadowTexture);
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
	 * @param { Array<number> } sunDirection - 해가 비추는 방향. ([x, y, z], 빛이 나아가는 쪽)
	 * @param { Array<number> } sunColor - 해의 선형 색.
	 * @param { Array<number> } skyColor - 위에서 오는 바탕빛의 선형 색.
	 * @param { Array<number> } groundColor - 아래에서 오는 바탕빛의 선형 색.
	 */
	setLight(sunDirection, sunColor, skyColor, groundColor) {
		this.#lightSet.setLight(sunDirection, sunColor, skyColor, groundColor);
	}

	//==============================================================================
	// 해가 비추는 방향 설정. (빛이 나아가는 쪽, ToonLightSet 머리말)
	//==============================================================================
	/**
	 * @param { Array<number> } sunDirection - 빛이 나아가는 방향. ([x, y, z])
	 */
	setSunDirection(sunDirection) {
		this.#lightSet.setSunDirection(sunDirection);
	}

	//==============================================================================
	// 해가 비추는 방향 반환. (ShadowMap.updateLightMatrix 에 넘긴다)
	//==============================================================================
	/**
	 * @returns { Array<number> } 해가 비추는 방향. ([x, y, z])
	 */
	getSunDirection() {
		return this.#lightSet.getSunDirection();
	}

	//==============================================================================
	// 채움 빛 설정. (빛이 나아가는 방향과 선형 색)
	//==============================================================================
	/**
	 * @param { Array<number> } fillDirection - 빛이 나아가는 방향. ([x, y, z])
	 * @param { Array<number> } fillColor - 선형 색. (0 이면 없음)
	 */
	setFillLight(fillDirection, fillColor) {
		this.#lightSet.setFillLight(fillDirection, fillColor);
	}

	//==============================================================================
	// 림 빛 설정. (ToonLightSet.setRimLight)
	//==============================================================================
	/**
	 * @param { Array<number> } rimColor - 더할 선형 색.
	 * @param { number } rimPower - 거듭제곱. (0 이면 없음)
	 * @param { number } [rimFeather] - 0 단단한 테 ~ 1 부드러운 테. (기본 1)
	 * @param { number } [rimLightMask] - 1 이면 해를 받는 쪽에만. (기본 0)
	 */
	setRimLight(rimColor, rimPower, rimFeather = 1, rimLightMask = 0) {
		this.#lightSet.setRimLight(rimColor, rimPower, rimFeather, rimLightMask);
	}

	//==============================================================================
	// 하이라이트 설정. (ToonLightSet.setSpecular)
	//==============================================================================
	/**
	 * @param { number } specularStrength - 세기. (0 이면 없음)
	 * @param { number } [specularExponent] - 블린 퐁 지수. (기본 48)
	 * @param { number } [specularFeather] - 0 단단한 점 ~ 1 부드러운 빛. (기본 0)
	 * @param { Array<number> } [specularColor] - 선형 색. (기본 흰색)
	 */
	setSpecular(specularStrength, specularExponent = 48, specularFeather = 0, specularColor = [1, 1, 1]) {
		this.#lightSet.setSpecular(specularStrength, specularExponent, specularFeather, specularColor);
	}

	//==============================================================================
	// 점광과 스포트라이트 설정. (ToonLightSet.setPointLights)
	//==============================================================================
	/**
	 * @param { Array<object> } pointLights - ToonLightSet.setPointLights 의 꼴.
	 */
	setPointLights(pointLights) {
		this.#lightSet.setPointLights(pointLights);
	}

	//==============================================================================
	// 점광 수의 한도 설정. (ToonLightSet.setPointLightLimit)
	//==============================================================================
	/**
	 * @param { number } pointLightLimit - 받을 점광 수. (0 ~ TOON_MAXIMUM_POINT_LIGHTS)
	 */
	setPointLightLimit(pointLightLimit) {
		this.#lightSet.setPointLightLimit(pointLightLimit);
	}

	//==============================================================================
	// 그늘 셋 설정. (ToonLightSet.setShade, 유니티 툰 셰이더의 바탕, 1 차 그늘, 2 차 그늘)
	//==============================================================================
	/**
	 * @param { object } shade - 바탕에서 1 차, 2 차 그늘로 넘어가는 문턱, 부드러움, 색. ({ step, feather, color, secondStep, secondFeather, secondColor, isHalfLambert })
	 * @example <caption>밝은 피부와 그늘 두 단계를 단단하게 가르기</caption>
	 * import { ToonRenderer, ToonMesh, Matrix4, Vector3 } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * renderer.setShade({ step: 0.55, feather: 0.01, color: [0.85, 0.62, 0.6], secondStep: 0.25, secondFeather: 0.01, secondColor: [0.6, 0.42, 0.45], isHalfLambert: true });
	 * const builder = new ToonMesh.MeshBuilder();
	 * builder.addPart(ToonMesh.createSphereGeometry(0.5, 32, 20), Matrix4.createIdentity(), "#f8e0d0", { hasOutline: true });
	 * const mesh = renderer.createMesh(builder.readArrays());
	 * renderer.beginFrameWithMatrices(Matrix4.createLookAt(Vector3.create(0, 0, 3), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0)), Matrix4.createPerspective(0.8, 1, 0.1, 20));
	 * renderer.drawMesh(mesh, Matrix4.createIdentity());
	 * renderer.endFrame();
	 */
	setShade(shade) {
		this.#lightSet.setShade(shade);
	}

	//==============================================================================
	// 그늘 램프 설정. (ToonLightSet.setShadeRamp)
	//==============================================================================
	/**
	 * @param { Array<number> } positions - 칸마다의 자리.
	 * @param { Array<Array<number>> } colors - 칸마다의 선형 배.
	 * @param { Array<number> } feathers - 칸마다의 부드러움.
	 * @param { boolean } isHalfLambert - 반 램버트로 셀지.
	 * @example <caption>세 칸 그늘 램프를 기본 빛 묶음에 주기</caption>
	 * import { ToonRenderer } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * renderer.setShadeRamp([0, 0.4, 0.62], [[0.3, 0.3, 0.45], [0.62, 0.6, 0.75], [1, 1, 1]], [0, 0.05, 0.02], true);
	 * const shadeRamp = renderer.getLightSet().getShadeRamp();
	 * if (shadeRamp.positions.length !== 3) {
	 * 	throw new Error("ramp not set");
	 * }
	 */
	setShadeRamp(positions, colors, feathers, isHalfLambert) {
		this.#lightSet.setShadeRamp(positions, colors, feathers, isHalfLambert);
	}

	//==============================================================================
	// 그늘 램프 끄기. (부드러운 램버트)
	//==============================================================================
	clearShadeRamp() {
		this.#lightSet.clearShadeRamp();
	}

	//==============================================================================
	// 고른 칸 설정. (ToonLightSet.setBandCount, 0 이면 부드럽게)
	//==============================================================================
	/**
	 * @param { number } bandCount - 칸 수.
	 */
	setBandCount(bandCount) {
		this.#lightSet.setBandCount(bandCount);
	}

	//==============================================================================
	// 회색 칸 램프 설정. (ToonLightSet.setBandRamp)
	//==============================================================================
	/**
	 * @param { Array<number> } thresholds - 오름차순 문턱.
	 * @param { Array<number> } values - 칸마다의 받는 몫.
	 * @param { boolean } isHalfLambert - 반 램버트로 셀지.
	 * @example <caption>그늘, 중간, 빛 세 칸의 회색 램프</caption>
	 * import { ToonRenderer } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * renderer.setBandRamp([0.3, 0.7], [0.35, 0.7, 1], false);
	 * renderer.setRimLight([0.4, 0.4, 0.5], 4, 0, 1);
	 * renderer.setSpecular(0.5, 32, 0);
	 */
	setBandRamp(thresholds, values, isHalfLambert) {
		this.#lightSet.setBandRamp(thresholds, values, isHalfLambert);
	}

	//==============================================================================
	// 램프 텍스처 설정. (ToonLightSet.setRampTexture, null 이면 칸으로)
	//==============================================================================
	/**
	 * @param { WebGLTexture | null } rampTexture - createTexture 로 지은 램프 텍스처나 null.
	 * @param { boolean } [isHalfLambert] - 반 램버트로 셀지. (기본 true)
	 * @example <caption>네 칸 램프 텍스처로 그늘 색을 주고 다시 칸으로 돌리기</caption>
	 * import { ToonRenderer, ToonMesh, Matrix4, Vector3 } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * const rampData = new Uint8Array([60, 50, 110, 255, 110, 100, 160, 255, 200, 185, 215, 255, 255, 255, 255, 255]);
	 * const rampTexture = renderer.createTexture({ width: 4, height: 1, data: rampData }, { isMipmapped: false, isRepeated: false, isFiltered: false });
	 * renderer.setRampTexture(rampTexture, true);
	 * const builder = new ToonMesh.MeshBuilder();
	 * builder.addPart(ToonMesh.createTorusGeometry(0.4, 0.15, 16, 32), Matrix4.createIdentity(), "#ffffff", { hasOutline: true });
	 * const mesh = renderer.createMesh(builder.readArrays());
	 * renderer.beginFrameWithMatrices(Matrix4.createLookAt(Vector3.create(0, 1, 3), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0)), Matrix4.createPerspective(0.8, 1, 0.1, 20));
	 * renderer.drawMesh(mesh, Matrix4.createIdentity());
	 * renderer.endFrame();
	 * renderer.setRampTexture(null);
	 * renderer.deleteTexture(rampTexture);
	 */
	setRampTexture(rampTexture, isHalfLambert = true) {
		this.#lightSet.setRampTexture(rampTexture, isHalfLambert);
	}

	//==============================================================================
	// 빛 꼴 설정. ({ isEnergyNormalized })
	//==============================================================================
	/**
	 * @param { object } lightModel - { isEnergyNormalized } (true 면 바탕색 x 빛을 π 로 나눈다)
	 * @example <caption>물리 빛 세기로 해와 점광 주기</caption>
	 * import { ToonRenderer } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * renderer.setLightModel({ isEnergyNormalized: true });
	 * renderer.setLight([-0.3, -1, -0.4], [3.14, 3.0, 2.8], [0.4, 0.45, 0.55], [0.2, 0.18, 0.16]);
	 * renderer.setPointLights([{ position: [0, 2, 1], color: [1, 0.8, 0.6], intensity: 30, range: 8 }]);
	 */
	setLightModel(lightModel) {
		this.#lightSet.setLightModel(lightModel);
	}

	//==============================================================================
	// 바깥선 색 설정. (sRGB 0 ~ 1 과 알파)
	//==============================================================================
	/**
	 * @param { Array<number> } outlineColor - [r, g, b, a] (sRGB 0 ~ 1 과 알파)
	 */
	setOutlineColor(outlineColor) {
		this.#outlineColor = outlineColor.slice();
		this.#frameSerial += 1;
	}

	//==============================================================================
	// 껍데기 바깥선의 거리 배 설정. (기준 거리에서 지은 굵기, 멀면 그만큼 굵게 밀어 화면 굵기를 맞춘다, 배는 가장 작은 것과 큰 것 사이, 기준 거리 0 이면 끔)
	// - 원근 카메라에서만 건다. 꼭짓점마다 카메라까지의 거리 / 기준 거리 를 굵기에 곱한다. (길티기어 Xrd 처럼 거리와 상관없이 비슷한 화면 굵기)
	//==============================================================================
	/**
	 * @param { number } referenceDistance - 지은 굵기 그대로인 거리. (0 이면 끔)
	 * @param { number } [minimumScale] - 가장 작은 배. (기본 0.5)
	 * @param { number } [maximumScale] - 가장 큰 배. (기본 4)
	 * @example <caption>6 미터에서 지은 굵기로 화면 굵기 맞추기</caption>
	 * import { ToonRenderer } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * renderer.setOutlineDistanceScale(6, 0.4, 3);
	 */
	setOutlineDistanceScale(referenceDistance, minimumScale = 0.5, maximumScale = 4) {
		this.#outlineDistanceScale = [System.Math.max(0, referenceDistance), System.Math.max(0, minimumScale), System.Math.max(System.Math.max(0, minimumScale), maximumScale)];
		this.#frameSerial += 1;
	}

	//==============================================================================
	// 껍데기 바깥선이 멀면 사라지는 거리 설정. (가까운 거리 이하는 지은 굵기, 먼 거리 이상은 0, 사이는 smoothstep, 먼 거리가 가까운 거리 이하면 끔)
	// - 유니티 툰 셰이더의 Nearest Distance, Farthest Distance 와 같은 꼴이다. 모형 행렬의 자리에서 카메라까지의 거리로 본다. (원근만)
	//==============================================================================
	/**
	 * @param { number } nearDistance - 지은 굵기 그대로인 거리.
	 * @param { number } farDistance - 굵기가 0 이 되는 거리.
	 * @example <caption>20 미터 밖에서 껍데기 바깥선이 사라지게</caption>
	 * import { ToonRenderer } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * renderer.setOutlineFadeDistance(8, 20);
	 */
	setOutlineFadeDistance(nearDistance, farDistance) {
		this.#outlineFadeDistance = [System.Math.max(0, nearDistance), System.Math.max(0, farDistance)];
		this.#frameSerial += 1;
	}

	//==============================================================================
	// 껍데기 바깥선이 사라지는 거리 반환.
	//==============================================================================
	/**
	 * @returns { Array<number> } [가까운 거리, 먼 거리]
	 */
	getOutlineFadeDistance() {
		return this.#outlineFadeDistance.slice();
	}

	//==============================================================================
	// 받을 점광과 스포트라이트 그림자 설정. (ShadowAtlas 나 null, 세기 0 ~ 1, 아틀라스는 기본 빛 묶음의 점광 목록으로 지은 것)
	//==============================================================================
	/**
	 * @param { object | null } shadowAtlas - ShadowAtlas 나 null.
	 * @param { number } [strength] - 그림자 세기. (기본 1)
	 * @example <caption>스포트라이트 그림자를 아틀라스로 받기</caption>
	 * import { ToonRenderer, ShadowAtlas } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const renderer = new ToonRenderer(webGL2RenderingContext);
	 * renderer.setPointLights([{ position: [0, 3, 0], color: [1, 0.9, 0.8], intensity: 4, range: 8, direction: [0, -1, 0], innerConeAngle: 0.3, outerConeAngle: 0.6, castsShadow: true }]);
	 * const shadowAtlas = new ShadowAtlas(webGL2RenderingContext, 1024);
	 * shadowAtlas.updateLights(renderer.getLightSet().getPointLights());
	 * renderer.setLocalShadows(shadowAtlas, 0.8);
	 * renderer.setLocalShadows(null);
	 */
	setLocalShadows(shadowAtlas, strength = 1) {
		this.#frameSerial += 1;
		if (shadowAtlas === null) {
			this.#localShadowInput = null;
			return;
		}
		const resolution = shadowAtlas.getResolution();
		this.#localShadowInput = { depthTexture: shadowAtlas.getDepthTexture(), lights: shadowAtlas.getLights(), gridSize: shadowAtlas.getGridSize(), tileSize: shadowAtlas.getTileSize() / resolution, texelSize: 1 / resolution, strength: System.Math.max(0, System.Math.min(1, strength)) };
	}

	//==============================================================================
	// 빛 색 쓰기 설정. (ToonLightSet.setLightColorUsage)
	//==============================================================================
	/**
	 * @param { object } lightColorUsage - { base, shade, highlight, rim, shadeRim, matcap, angelRing, outline } (주지 않은 것은 그대로)
	 * @example <caption>림과 껍데기 바깥선은 해의 색에 물들지 않게</caption>
	 * import { ToonRenderer } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * renderer.setLightColorUsage({ rim: false, outline: false });
	 */
	setLightColorUsage(lightColorUsage) {
		this.#lightSet.setLightColorUsage(lightColorUsage);
	}

	//==============================================================================
	// 빛 세기 막기 설정. (ToonLightSet.setLightIntensityLimited)
	//==============================================================================
	/**
	 * @param { boolean } isLimited - true 면 빛마다 받은 몫을 1 로 막는다. (기본 true)
	 * @example <caption>HDR 블룸에 쓰려고 센 해를 막지 않기</caption>
	 * import { ToonRenderer } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * renderer.setLight([-0.4, -1, -0.3], [3, 2.8, 2.6], [0.4, 0.45, 0.55], [0.2, 0.18, 0.16]);
	 * renderer.setLightIntensityLimited(false);
	 */
	setLightIntensityLimited(isLimited) {
		this.#lightSet.setLightIntensityLimited(isLimited);
	}

	//==============================================================================
	// 그늘 쪽 림 빛 설정. (ToonLightSet.setShadeRimLight)
	//==============================================================================
	/**
	 * @param { Array<number> } shadeRimColor - 더할 선형 색.
	 * @param { number } shadeRimPower - 거듭제곱. (0 이면 없음)
	 * @example <caption>해와 등진 쪽에 푸른 테</caption>
	 * import { ToonRenderer } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * renderer.setShadeRimLight([0.18, 0.3, 0.62], 2.2);
	 */
	setShadeRimLight(shadeRimColor, shadeRimPower) {
		this.#lightSet.setShadeRimLight(shadeRimColor, shadeRimPower);
	}

	//==============================================================================
	// 껍데기 바깥선의 거리 배 반환.
	//==============================================================================
	/**
	 * @returns { Array<number> } [기준 거리, 가장 작은 배, 가장 큰 배]
	 */
	getOutlineDistanceScale() {
		return this.#outlineDistanceScale.slice();
	}

	//==============================================================================
	// HDR 출력 설정. (true 면 감마를 걸지 않은 선형 색을 낸다)
	//==============================================================================
	/**
	 * @param { boolean } isHdrOutput - true 면 감마를 걸지 않은 선형 색을 낸다.
	 */
	setHdrOutput(isHdrOutput) {
		this.#isHdrOutput = isHdrOutput;
		this.#frameSerial += 1;
	}

	//==============================================================================
	// 받을 그림자 설정. (ShadowMap 이나 null, 세기 0 ~ 1)
	//==============================================================================
	/**
	 * @param { object | null } shadowMap - 받을 ShadowMap. (null 이면 그림자를 받지 않는다)
	 * @param { number } [strength] - 그림자 세기 0 ~ 1. (기본 0.6)
	 * @example <caption>그림자를 받되 공중의 빛 구슬은 받지 않게 하기</caption>
	 * import { ToonRenderer, ToonMesh, ShadowMap, Matrix4, Vector3 } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const renderer = new ToonRenderer(webGL2RenderingContext);
	 * const builder = new ToonMesh.MeshBuilder();
	 * builder.addPart(ToonMesh.createSphereGeometry(0.3, 20, 14), Matrix4.createIdentity(), "#ffe080", { glow: 1, hasOutline: false });
	 * const mesh = renderer.createMesh(builder.readArrays());
	 * const shadowMap = new ShadowMap(webGL2RenderingContext, 512);
	 * shadowMap.updateLightMatrix(Vector3.create(0, 0, 0), Vector3.create(-0.3, -1, -0.2), 4, 0.5, 20);
	 * renderer.setShadow(shadowMap, 0.8);
	 * renderer.beginFrameWithMatrices(Matrix4.createLookAt(Vector3.create(0, 1, 3), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0)), Matrix4.createPerspective(0.8, 1, 0.1, 20));
	 * renderer.drawMesh(mesh, Matrix4.createTranslation(0, 1, 0), { receivesShadow: false });
	 * renderer.endFrame();
	 * renderer.setShadow(null);
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
	 * @returns { object } 이번 프레임의 셈. ({ drawCallCount, drawnObjectCount, culledObjectCount })
	 */
	getFrameStatistics() {
		return this.#frameStatistics;
	}

	//==============================================================================
	// 렌더링 컨텍스트 반환.
	//==============================================================================
	/**
	 * @returns { WebGL2RenderingContext } 그리는 컨텍스트.
	 */
	getWebGL2RenderingContext() {
		return this.#webGL2RenderingContext;
	}

	//==============================================================================
	// 몸 프로그램 반환. (머티리얼을 주면 그 머티리얼의 것, 짓지 못했으면 null)
	//==============================================================================
	/**
	 * @param { ToonMaterial | null } [material] - 머티리얼. (기본 null 이면 기본 프로그램)
	 * @returns { ShaderProgram | null } 몸 프로그램. (짓지 못했으면 null)
	 */
	getSolidProgram(material = null) {
		const programSet = this.readProgramSet(material, null);
		return programSet !== null ? programSet.solid.program : null;
	}

	//==============================================================================
	// 바깥선 프로그램 반환.
	//==============================================================================
	/**
	 * @param { ToonMaterial | null } [material] - 머티리얼. (기본 null 이면 기본 프로그램)
	 * @returns { ShaderProgram | null } 바깥선 프로그램. (짓지 못했으면 null)
	 */
	getOutlineProgram(material = null) {
		const programSet = this.readProgramSet(material, null);
		return programSet !== null ? programSet.outline.program : null;
	}

	//==============================================================================
	// 그림자 깊이 프로그램 반환.
	//==============================================================================
	/**
	 * @param { ToonMaterial | null } [material] - 머티리얼. (기본 null 이면 기본 프로그램)
	 * @returns { ShaderProgram | null } 그림자 깊이 프로그램. (짓지 못했으면 null)
	 */
	getDepthProgram(material = null) {
		const programSet = this.readProgramSet(material, null);
		return programSet !== null ? programSet.depth.program : null;
	}
}
