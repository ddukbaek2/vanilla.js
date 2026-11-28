//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Matrix4 } from "../../base/matrix4.js";
import { ShaderProgram, reportShaderBuildFailure } from "../../core/graphic/shaderprogram.js";
import { WebGLStateCache } from "../../core/graphic/webglstatecache.js";
import { ColorSpace, readColorSpace, readEngineColorSpace, addColorSpaceDefine } from "../../core/graphic/colorspace.js";
import { VERTEX_FLOAT_COUNT, SKIN_FLOAT_COUNT } from "./meshbuilder.js";
import { ToonLightSet, TOON_MAXIMUM_POINT_LIGHTS, TOON_MAXIMUM_BAND_STEPS } from "./toonlightset.js";
import { ToonMaterial, ToonInstanceLayout, ToonBlendMode, ToonMatcapBlend, ToonBufferUsage, TOON_INSTANCE_MATRIX_NAME, TOON_INSTANCE_TINT_NAME } from "./toonmaterial.js";


/**
 * @example <caption>그늘, 림, 하이라이트, 점광과 스포트라이트를 걸고 한 프레임 그리기</caption>
 * import { ToonRenderer, MeshBuilder, createSphereGeometry, createBoxGeometry, Matrix4, Vector3 } from "./vanilla.js";
 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
 * const renderer = new ToonRenderer(webGL2RenderingContext);
 * const builder = new MeshBuilder();
 * builder.addPart(createSphereGeometry(0.5, 32, 20), Matrix4.createTranslation(0, 0.5, 0), "#f0c8a0", { hasOutline: true });
 * builder.addPart(createBoxGeometry(3, 0.1, 3), Matrix4.createTranslation(0, -0.05, 0), "#708090", { hasOutline: false });
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
// - 행렬은 아핀 3x4 로 읽는다. 아래 줄 네 칸(원소 3, 7, 11, 15)은 인스턴스 빛남(sRGB r, g, b 와 선형 세기)이다. (Godot MultiMesh, 유니티 BatchRendererGroup 의 3x4 행렬 꼴)
//   Matrix4 원소를 그대로 담으면 아래 줄이 0, 0, 0, 1 이라 빛남이 없다.
export const TOON_INSTANCE_FLOAT_COUNT = 20;

// 해 그림자 치우침. (ShadowMap.setBias 의 텍셀 단위 값에 곱하는 PCF 반지름, 기울기 비례 치우침의 텍셀 배수, 기울기 상한)
// - 3x3 PCF 는 가운데에서 1.5 텍셀까지 읽으므로 깊이와 노멀 치우침에 1.5 를 곱한다. (유니티 URP ShadowUtils 의 soft shadow kernel radius, Low 3x3 이 1.5)
// - 기울기 비례 치우침은 텍셀 하나 안에서 면의 깊이가 바뀌는 몫(텍셀 크기 x tan(빛과 노멀 사이 각))에 2.5 를 곱한다. (URP 가 HDRP 기본값과 같다고 적은 slope scale 2.5)
// - 기울기는 10(약 84 도)에서 자른다. (빛과 거의 나란한 면에서 치우침이 끝없이 커지지 않게, 언리얼의 MaxSlopeDepthBias 와 같은 자리)
const SHADOW_FILTER_RADIUS = 1.5;
const SHADOW_SLOPE_BIAS = 2.5;
const SHADOW_MAXIMUM_SLOPE = 10;

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
// 모서리 어둠(화면 공간 AO) 텍스처 유닛. (조각 셰이더 유닛 16 개를 머티리얼까지 다 쓰므로 그 뒤, WebGL2 가 보장하는 합친 유닛 32 안)
const AMBIENT_OCCLUSION_TEXTURE_UNIT = 16;

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
 * import { ToonRenderer, ToonMaterial, ToonProgramKind, MeshBuilder, createBoxGeometry, Matrix4, Vector3 } from "./vanilla.js";
 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
 * const material = new ToonMaterial({ name: "pulse", uniformChunk: "uniform float pulse;", surfaceChunk: "void applySurface(inout ToonSurface surface) { surface.emission += vec3(pulse); }" });
 * const builder = new MeshBuilder();
 * builder.addPart(createBoxGeometry(1, 1, 1), Matrix4.createIdentity(), "#d06060", { hasOutline: true });
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

// 프레임 블록. (프로그램마다 올리던 프레임 값을 std140 블록 하나로, 패스마다 한 번 올리고 바인딩 2 에 묶는다, 차례와 자리는 writeFrameBlockValues)
// - 몸, 바깥선, 깊이 프로그램의 정점과 조각 셰이더가 모두 같은 선언을 쓴다. (float 배열은 std140 에서 칸마다 vec4 자리)
const FRAME_BLOCK_CHUNK = `layout(std140) uniform ToonFrame {
	mat4 viewProjectionMatrix;
	mat4 lightViewProjectionMatrix;
	vec4 cameraPosition;
	vec3 cameraForward;
	float hdrOutput;
	mat3 viewRotation;
	vec3 outlineDistanceScale;
	float shadowEnabled;
	vec2 cameraRoll;
	vec2 outlineFadeDistance;
	float shadowStrength;
	float shadowTexelSize;
	vec2 ambientOcclusionOrigin;
	vec4 localShadowAtlas;
	vec4 localShadowPositions[4];
	vec4 localShadowForwards[4];
	vec4 localShadowUps[4];
	float localShadowTiles[4];
	float pointLightShadowSlots[8];
	vec4 shadowBias;
	float ambientOcclusionDirectLightingStrength;
};
`;

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
// - 인스턴스 행렬은 아핀 3x4 로 짓고, 네 열의 w(행렬의 아래 줄)는 인스턴스 빛남으로 읽는다. (TOON_INSTANCE_FLOAT_COUNT 머리말)
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
	return mat4(vec4(instanceMatrix0.xyz, 0.0), vec4(instanceMatrix1.xyz, 0.0), vec4(instanceMatrix2.xyz, 0.0), vec4(instanceMatrix3.xyz, 1.0));
}
vec4 readInstanceTint() {
	if (instanced < 0.5) {
		return vec4(1.0);
	}
	return instanceTint;
}
vec4 readInstanceEmissive() {
	if (instanced < 0.5 || instanced > 1.5) {
		return vec4(0.0);
	}
	return vec4(instanceMatrix0.w, instanceMatrix1.w, instanceMatrix2.w, instanceMatrix3.w);
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
	vec4 emissive;
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
	vertex.emissive = readInstanceEmissive();
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
const SOLID_VERTEX_BODY = `out vec3 worldPosition;
out vec3 localPosition;
out vec3 worldNormal;
out vec3 surfaceColor;
out vec2 surfaceMaterial;
out vec4 surfaceDetail;
out vec2 surfaceUv;
out vec2 surfaceUv1;
out vec4 surfaceTint;
out vec4 surfaceEmissive;
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
	surfaceEmissive = vertex.emissive;
	// 해 그림자 치우침. (노멀 쪽으로 밀어 읽고, 깊이와 기울기 비례 몫만큼 빛 쪽으로 당겨 견준다, shadowBias 는 x 깊이, y 노멀 월드 거리, z 기울기 깊이, w 기울기 상한)
	vec3 shadowLightDirection = normalize(vec3(lightViewProjectionMatrix[0][2], lightViewProjectionMatrix[1][2], lightViewProjectionMatrix[2][2]));
	float shadowCosine = clamp(abs(dot(worldNormal, shadowLightDirection)), 0.0001, 1.0);
	float shadowSlope = min(sqrt(1.0 - shadowCosine * shadowCosine) / shadowCosine, shadowBias.w);
	lightSpacePosition = lightViewProjectionMatrix * vec4(position.xyz + worldNormal * shadowBias.y, 1.0);
	lightSpacePosition.z -= 2.0 * (shadowBias.x + shadowBias.z * shadowSlope) * lightSpacePosition.w;
	gl_Position = viewProjectionMatrix * position;
}
`;

// 몸을 그리는 조각 셰이더의 머리. (유니폼, 표면과 빛 구조, 공용 함수)
const SOLID_FRAGMENT_HEAD = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
${FRAME_BLOCK_CHUNK}in vec3 worldPosition;
in vec3 localPosition;
in vec3 worldNormal;
in vec3 surfaceColor;
in vec2 surfaceMaterial;
in vec4 surfaceDetail;
in vec2 surfaceUv;
in vec2 surfaceUv1;
in vec4 surfaceTint;
in vec4 surfaceEmissive;
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
uniform sampler2DShadow localShadowTexture;
uniform vec4 lightColorUsage;
uniform vec3 lightColorUsageExtra;
uniform vec4 shadeRimLight;
#ifdef TOON_AMBIENT_OCCLUSION
uniform sampler2D ambientOcclusionTexture;
#endif
layout(std140) uniform ToonDrawMaterial {
	vec4 tintColor;
	vec4 emissiveColor;
	vec4 uvTransform;
	vec4 decalUvTransform;
	vec4 decalColor;
	vec4 angelRingSettings;
	vec3 textureEnabled;
	float tintAmount;
	vec3 matcapSettings;
	float alpha;
	vec3 angelRingColor;
	float glowScale;
	vec2 highlightScale;
	float colorScale;
	float softEdge;
	float alphaCutoff;
	float premultipliedOutput;
	float receivesShadow;
	float shadeOffset;
};
uniform sampler2D baseColorTexture;
uniform sampler2D emissiveTexture;
uniform sampler2D decalTexture;
uniform sampler2D matcapTexture;
uniform sampler2D angelRingTexture;
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
#ifdef VANILLA_COLOR_SPACE_LINEAR
vec3 toLinear(vec3 color) {
	vec3 value = max(color, vec3(0.0));
	return mix(value / 12.92, pow((value + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), value));
}
vec3 toSurfaceColor(vec3 color) {
	return toLinear(color);
}
vec3 toOutput(vec3 color) {
	if (hdrOutput > 0.5) {
		return max(color, vec3(0.0));
	}
	vec3 value = clamp(color, 0.0, 1.0);
	return mix(value * 12.92, 1.055 * pow(value, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), value));
}
#else
vec3 toLinear(vec3 color) {
	return pow(color, vec3(2.2));
}
vec3 toSurfaceColor(vec3 color) {
	return color;
}
vec3 toOutput(vec3 color) {
	if (hdrOutput > 0.5) {
		return max(color, vec3(0.0));
	}
	return pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2));
}
#endif
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
			lit += texture(shadowTexture, vec3(projected.xy + vec2(float(offsetX), float(offsetY)) * shadowTexelSize, projected.z));
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
#ifdef VANILLA_COLOR_SPACE_LINEAR
		return textureLod(rampTexture, vec2(clamp(coordinate, 0.0, 1.0), 0.5), 0.0).rgb;
#else
		return toLinear(textureLod(rampTexture, vec2(clamp(coordinate, 0.0, 1.0), 0.5), 0.0).rgb);
#endif
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
vec3 readShadeRampWithWidth(float coordinate, float edgeWidth) {
	if (rampTextureEnabled > 0.5) {
#ifdef VANILLA_COLOR_SPACE_LINEAR
		return textureLod(rampTexture, vec2(clamp(coordinate, 0.0, 1.0), 0.5), 0.0).rgb;
#else
		return toLinear(textureLod(rampTexture, vec2(clamp(coordinate, 0.0, 1.0), 0.5), 0.0).rgb);
#endif
	}
	if (shadeStopCount < 2) {
		return vec3(clamp(coordinate, 0.0, 1.0));
	}
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
#ifdef VANILLA_COLOR_SPACE_LINEAR
		bottom = readLuminance(textureLod(rampTexture, vec2(0.0, 0.5), 0.0).rgb);
		top = readLuminance(textureLod(rampTexture, vec2(1.0, 0.5), 0.0).rgb);
#else
		bottom = readLuminance(toLinear(textureLod(rampTexture, vec2(0.0, 0.5), 0.0).rgb));
		top = readLuminance(toLinear(textureLod(rampTexture, vec2(1.0, 0.5), 0.0).rgb));
#endif
	}
	else if (shadeStopCount < 2) {
		return clamp(cosine, 0.0, 1.0);
	}
	else {
		bottom = readLuminance(shadeStopColors[0]);
		// 마지막 칸은 고리로 찾는다. (색 칸이 0 개일 때 동적 첨자 shadeStopColors[shadeStopCount - 1] 읽기가 아이폰 SE2 (A13) 의 GPU 프로세스를 죽였다)
		top = readLuminance(shadeStopColors[0]);
		for (int index = 1; index < 8; ++index) {
			if (index < shadeStopCount) {
				top = readLuminance(shadeStopColors[index]);
			}
		}
	}
	return clamp((readLuminance(rampColor) - bottom) / max(top - bottom, 0.0001), 0.0, 1.0);
}
float readToonSpecular(vec3 normal, vec3 toLight, vec3 viewDirection) {
	vec3 halfway = normalize(toLight + viewDirection);
	float blinn = pow(max(dot(normal, halfway), 0.0), specularLight.y);
	float edgeWidth = max(fwidth(blinn), 0.0001);
	return mix(smoothstep(0.5 - edgeWidth, 0.5 + edgeWidth, blinn), blinn, specularLight.z);
}
float readToonSpecularWithWidth(float blinn, float edgeWidth) {
	return mix(smoothstep(0.5 - edgeWidth, 0.5 + edgeWidth, blinn), blinn, specularLight.z);
}
vec3 readViewDirection() {
	if (cameraPosition.w > 0.5) {
		return normalize(cameraPosition.xyz - worldPosition);
	}
	return -cameraForward;
}
float readAmbientOcclusion() {
#ifdef TOON_AMBIENT_OCCLUSION
	if (alpha * tintColor.a < 1.0) {
		return 1.0;
	}
	vec4 occlusion = texelFetch(ambientOcclusionTexture, ivec2(gl_FragCoord.xy - ambientOcclusionOrigin), 0);
	float depth = dot(floor(occlusion.gba * 255.0 + 0.5), vec3(65536.0, 256.0, 1.0)) / 16777215.0;
	return abs(depth - gl_FragCoord.z) <= 0.0000153 ? occlusion.r : 1.0;
#else
	return 1.0;
#endif
}
`;

// 몸을 그리는 조각 셰이더의 몸통. (표면 → 표면 조각 → 틴트 → 빛 → 빛 조각 → 합치기)
const SOLID_FRAGMENT_BODY = `ToonSurface readSurface() {
	ToonSurface surface;
#ifdef VANILLA_COLOR_SPACE_LINEAR
	vec3 color = toLinear(surfaceColor) * toLinear(surfaceTint.rgb);
#else
	vec3 color = surfaceColor * surfaceTint.rgb;
#endif
	float opacity = alpha * tintColor.a * surfaceTint.a;
	vec2 uv = surfaceUv * uvTransform.zw + uvTransform.xy;
	if (textureEnabled.x > 0.5) {
		vec4 texel = texture(baseColorTexture, uv);
		color *= texel.rgb;
		opacity *= texel.a;
	}
	vec3 emission = toLinear(emissiveColor.rgb) * emissiveColor.a;
#ifdef VANILLA_COLOR_SPACE_LINEAR
	if (textureEnabled.y > 0.5) {
		emission *= texture(emissiveTexture, uv).rgb;
	}
	if (textureEnabled.z > 0.5) {
		vec4 decal = texture(decalTexture, surfaceUv * decalUvTransform.zw + decalUvTransform.xy);
		vec3 decalTint = decal.rgb * toLinear(decalColor.rgb);
		color = mix(color, decalTint, decal.a);
		emission += decalTint * decal.a * decalColor.a;
	}
#else
	if (textureEnabled.y > 0.5) {
		emission *= toLinear(texture(emissiveTexture, uv).rgb);
	}
	if (textureEnabled.z > 0.5) {
		vec4 decal = texture(decalTexture, surfaceUv * decalUvTransform.zw + decalUvTransform.xy);
		vec3 decalTint = decal.rgb * decalColor.rgb;
		color = mix(color, decalTint, decal.a);
		emission += toLinear(decalTint) * decal.a * decalColor.a;
	}
#endif
	surface.baseColor = color;
	surface.alpha = opacity;
	surface.emission = emission + toLinear(surfaceEmissive.rgb) * surfaceEmissive.a;
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
#ifdef TOON_AMBIENT_OCCLUSION
	// 직접 빛의 가림. (1 - 몫 x (1 - 보임), 칸을 고른 뒤 해, 채움빛, 점광의 확산과 반사광에 곱한다, 몫 0 이나 트인 곳은 정확히 1)
	float ambientOcclusion = readAmbientOcclusion();
	float directOcclusion = 1.0 - ambientOcclusionDirectLightingStrength * (1.0 - ambientOcclusion);
#else
	const float directOcclusion = 1.0;
#endif
	vec3 sunLight = sunRamp * directOcclusion * mix(readLightColor(sunLightColor, lightColorUsage.y), readLightColor(sunLightColor, lightColorUsage.x), sunLevel);
#ifdef TOON_AMBIENT_OCCLUSION
	vec3 irradiance = sunLight + mix(groundColor, skyColor, normal.y * 0.5 + 0.5) * ambientOcclusion;
#else
	vec3 irradiance = sunLight + mix(groundColor, skyColor, normal.y * 0.5 + 0.5);
#endif
	if (hasSpecular) {
		specularSum += readLightColor(sunLightColor, lightColorUsage.z) * directOcclusion * readToonSpecular(normal, toSun, viewDirection) * sunLevel;
	}
	vec3 toFill = -normalize(fillDirection);
	float fillCosine = dot(normal, toFill);
	irradiance += readLightColor(readLimitedDirectionalColor(fillColor), lightColorUsage.x) * directOcclusion * readShadeLevel(readShadeRamp(readToonCoordinate(fillCosine, surface.shadeOffset)), fillCosine);
	for (int index = 0; index < 8; ++index) {
		if (index >= pointLightCount) {
			break;
		}
		vec3 toLight = pointLightPositions[index].xyz - surface.worldPosition;
		float lightDistance = length(toLight);
		vec3 lightDirection = toLight / max(lightDistance, 0.0001);
		float lightRange = pointLightPositions[index].w;
		vec3 shape = pointLightShapes[index];
		float lightShadow = 1.0;
		int shadowSlot = int(pointLightShadowSlots[index] + 0.5) - 1;
		if (shadowSlot >= 0 && receivesShadow > 0.5) {
			lightShadow = readLocalShadow(shadowSlot, surface.worldPosition, normal);
		}
		float cosine = (dot(normal, lightDirection) + shape.z) / (1.0 + shape.z);
		float rampCoordinate = readToonCoordinate(cosine, surface.shadeOffset) * lightShadow;
		// 도함수(fwidth)는 갈래 안에서 셈하면 쿼드 이웃이 건너뛴 화소에서 정해지지 않으니 모든 화소가 함께 도는 여기서 셈한다.
		float rampEdgeWidth = max(fwidth(rampCoordinate), 0.0001);
		float blinn = 0.0;
		float specularEdgeWidth = 1.0;
		if (hasSpecular) {
			blinn = pow(max(dot(normal, normalize(lightDirection + viewDirection)), 0.0), specularLight.y);
			specularEdgeWidth = max(fwidth(blinn), 0.0001);
		}
		// 반지름 밖(window 가 정확히 0)이면 이 빛의 기여가 0 이라 도함수 없는 무거운 셈을 건너뛴다.
		if (lightRange > 0.0 && shape.y > 0.0 && lightDistance >= lightRange) {
			continue;
		}
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
		float level = readShadeLevel(readShadeRampWithWidth(rampCoordinate, rampEdgeWidth), cosine * lightShadow);
		vec3 pointColor = readLimitedLocalColor(pointLightColors[index] * falloff);
		irradiance += readLightColor(pointColor, lightColorUsage.x) * directOcclusion * level;
		if (hasSpecular) {
			specularSum += readLightColor(pointColor, lightColorUsage.z) * directOcclusion * readToonSpecularWithWidth(blinn, specularEdgeWidth) * level;
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
#ifdef VANILLA_COLOR_SPACE_LINEAR
	vec3 tintLinear = toLinear(tintColor.rgb);
	vec3 albedo = tintAmount < 0.0 ? surface.baseColor * tintLinear : mix(surface.baseColor, tintLinear, tintAmount);
#else
	vec3 tintedColor = tintAmount < 0.0 ? surface.baseColor * tintColor.rgb : mix(surface.baseColor, tintColor.rgb, tintAmount);
	vec3 albedo = toLinear(tintedColor);
#endif
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
#ifdef VANILLA_COLOR_SPACE_LINEAR
		vec3 matcap = texture(matcapTexture, vec2(viewNormal.x * 0.5 + 0.5, 0.5 - viewNormal.y * 0.5)).rgb * mix(vec3(1.0), sunLightColor, lightColorUsageExtra.y);
#else
		vec3 matcap = toLinear(texture(matcapTexture, vec2(viewNormal.x * 0.5 + 0.5, 0.5 - viewNormal.y * 0.5)).rgb) * mix(vec3(1.0), sunLightColor, lightColorUsageExtra.y);
#endif
		color = matcapSettings.z > 0.5 ? color + matcap * matcapSettings.y : color * mix(vec3(1.0), matcap, matcapSettings.y);
	}
	if (angelRingSettings.x > 0.5) {
		vec2 ringOffset = mix(viewNormal, vec3(0.0, 0.0, 1.0), angelRingSettings.y).xy * 0.5;
		vec2 ringNormal = vec2(ringOffset.x * cameraRoll.x + ringOffset.y * cameraRoll.y, ringOffset.y * cameraRoll.x - ringOffset.x * cameraRoll.y) + 0.5;
		vec2 ringUv = vec2(ringNormal.x, 1.0 - mix(1.0 - surface.uv1.y, ringNormal.y, angelRingSettings.z));
		vec4 ring = texture(angelRingTexture, ringUv);
#ifdef VANILLA_COLOR_SPACE_LINEAR
		vec3 ringColor = ring.rgb * angelRingColor * mix(vec3(1.0), sunLightColor, lightColorUsageExtra.z);
#else
		vec3 ringColor = toLinear(ring.rgb) * angelRingColor * mix(vec3(1.0), sunLightColor, lightColorUsageExtra.z);
#endif
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
const OUTLINE_VERTEX_BODY = `layout(std140) uniform ToonDrawOutline {
	vec4 outlineColor;
	vec3 outlineLightColor;
	float outlineWidthScale;
	float outlineOffsetZ;
	float alpha;
	float premultipliedOutput;
};
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
${FRAME_BLOCK_CHUNK}in float outlineTint;
layout(std140) uniform ToonDrawOutline {
	vec4 outlineColor;
	vec3 outlineLightColor;
	float outlineWidthScale;
	float outlineOffsetZ;
	float alpha;
	float premultipliedOutput;
};
out vec4 fragmentColor;
#ifdef VANILLA_COLOR_SPACE_LINEAR
vec3 toLinear(vec3 color) {
	vec3 value = max(color, vec3(0.0));
	return mix(value / 12.92, pow((value + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), value));
}
#endif
void main() {
#ifdef VANILLA_COLOR_SPACE_LINEAR
	vec3 color = (hdrOutput > 0.5 ? toLinear(outlineColor.rgb) : outlineColor.rgb) * outlineLightColor;
#else
	vec3 color = (hdrOutput > 0.5 ? pow(outlineColor.rgb, vec3(2.2)) : outlineColor.rgb) * outlineLightColor;
#endif
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
 * @param { boolean } [isAmbientOcclusion] - 몸 조각 셰이더에 TOON_AMBIENT_OCCLUSION 을 정의해 모서리 어둠 텍스처를 바탕빛에 곱할지. (기본 false)
 * @param { string } [colorSpace] - 색 공간. (ColorSpace, 기본은 엔진의 색 공간, linear 면 소스마다 #define VANILLA_COLOR_SPACE_LINEAR 1 이 들어간다)
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
export function composeToonProgramSources(material, instanceLayout, isAmbientOcclusion = false, colorSpace = readEngineColorSpace()) {
	const vertexChunk = material !== null && material.getVertexChunk() !== "" ? material.getVertexChunk() : DEFAULT_VERTEX_CHUNK;
	const uniformChunk = material !== null ? material.getUniformChunk() : "";
	const surfaceChunk = material !== null && material.getSurfaceChunk() !== "" ? material.getSurfaceChunk() : DEFAULT_SURFACE_CHUNK;
	const lightChunk = material !== null && material.getLightChunk() !== "" ? material.getLightChunk() : DEFAULT_LIGHT_CHUNK;
	const instanceChunk = instanceLayout !== null ? instanceLayout.readDeclarationSource() : "";
	const vertexHead = VERTEX_HEAD_CHUNK + FRAME_BLOCK_CHUNK + VERTEX_COMMON_CHUNK + instanceChunk + VERTEX_STRUCT_CHUNK + vertexChunk;
	const attributeLocationTable = System.Object.assign({}, TOON_ATTRIBUTE_LOCATIONS);
	if (instanceLayout !== null) {
		for (const attribute of instanceLayout.getAttributes()) {
			if (attribute.location >= 0) {
				attributeLocationTable[attribute.name] = attribute.location;
			}
		}
	}
	return {
		solidVertexShader: addColorSpaceDefine(vertexHead + SOLID_VERTEX_BODY, colorSpace),
		solidFragmentShader: addColorSpaceDefine((isAmbientOcclusion ? SOLID_FRAGMENT_HEAD.replace("#version 300 es\n", "#version 300 es\n#define TOON_AMBIENT_OCCLUSION\n") : SOLID_FRAGMENT_HEAD) + uniformChunk + surfaceChunk + lightChunk + SOLID_FRAGMENT_BODY, colorSpace),
		outlineVertexShader: addColorSpaceDefine(vertexHead + OUTLINE_VERTEX_BODY, colorSpace),
		outlineFragmentShader: addColorSpaceDefine(OUTLINE_FRAGMENT_SHADER, colorSpace),
		depthVertexShader: addColorSpaceDefine(vertexHead + DEPTH_VERTEX_BODY, colorSpace),
		depthFragmentShader: addColorSpaceDefine(DEPTH_FRAGMENT_SHADER, colorSpace),
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
		const length = readHypot(plane[0], plane[1], plane[2]);
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
// 세 수의 Math.hypot. (V8 의 Math.hypot 과 같은 셈과 차례라 비트가 같다, 인자 배열을 짓지 않는다)
// - V8 은 인자마다 절댓값 배열을 지어 큰 값으로 나눈 제곱을 카핸 합으로 더하고 sqrt 에 큰 값을 곱한다. (Infinity 가 있으면 Infinity, NaN 이 있으면 NaN, 모두 0 이면 0)
//   그리기마다 부르는 거르기와 바깥선 굵기에서 Math.hypot 이 부를 때마다 메모리를 잡아 이것으로 바꾼다. (노드 25 에서 5 백만 쌍 비트 같음)
//==============================================================================
/**
 * @param { number } x - 첫 수.
 * @param { number } y - 둘째 수.
 * @param { number } z - 셋째 수.
 * @returns { number } Math.hypot(x, y, z) 와 같은 값.
 */
export function readHypot(x, y, z) {
	const absoluteX = System.Math.abs(x);
	const absoluteY = System.Math.abs(y);
	const absoluteZ = System.Math.abs(z);
	if (absoluteX === System.Infinity || absoluteY === System.Infinity || absoluteZ === System.Infinity) {
		return System.Infinity;
	}
	if (absoluteX !== absoluteX || absoluteY !== absoluteY || absoluteZ !== absoluteZ) {
		return System.NaN;
	}
	let maximum = absoluteX;
	if (absoluteY > maximum) {
		maximum = absoluteY;
	}
	if (absoluteZ > maximum) {
		maximum = absoluteZ;
	}
	if (maximum === 0) {
		return 0;
	}
	let sum = 0;
	let compensation = 0;
	let normalized = absoluteX / maximum;
	let summand = normalized * normalized - compensation;
	let preliminary = sum + summand;
	compensation = (preliminary - sum) - summand;
	sum = preliminary;
	normalized = absoluteY / maximum;
	summand = normalized * normalized - compensation;
	preliminary = sum + summand;
	compensation = (preliminary - sum) - summand;
	sum = preliminary;
	normalized = absoluteZ / maximum;
	summand = normalized * normalized - compensation;
	preliminary = sum + summand;
	sum = preliminary;
	return System.Math.sqrt(sum) * maximum;
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
	// readDeterminant(열 0, 열 1, 열 2) 와 같은 셈, 같은 차례. (배열을 짓지 않는다)
	return elements[0] * (elements[5] * elements[10] - elements[6] * elements[9]) - elements[1] * (elements[4] * elements[10] - elements[6] * elements[8]) + elements[2] * (elements[4] * elements[9] - elements[5] * elements[8]);
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
	const forwardLength = readHypot(forward[0], forward[1], forward[2]);
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
	const rightLength = readHypot(right[0], right[1], right[2]);
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
	const axisLength = readHypot(rightAxis[0], rightAxis[1], rightAxis[2]);
	const rightLength = readHypot(right[0], right[1], right[2]);
	if (axisLength < 0.000001 || rightLength < 0.000001) {
		return 0;
	}
	const cosine = (rightAxis[0] * right[0] + rightAxis[1] * right[1] + rightAxis[2] * right[2]) / (axisLength * rightLength);
	const roll = System.Math.acos(System.Math.max(-1, System.Math.min(1, cosine)));
	const direction = right[1] < 0 ? -1 : 1;
	return -(direction * roll);
}

//==============================================================================
// 해 그림자 치우침 셈하기. (ShadowMap 의 텍셀 단위 치우침을 셰이더가 쓰는 깊이와 월드 거리로)
// - 텍셀 하나의 월드 크기는 2 / (빛 행렬 첫 줄의 길이 x 해상도), 월드 1 의 깊이(0 ~ 1)는 셋째 줄의 길이 / 2. (직교 빛 행렬, 보기 부분은 강체)
//   유니티 URP 가 방향광의 텍셀 크기를 2 / 투영 m00 / 해상도로 셈하는 것과 같다.
//==============================================================================
/**
 * @param { Matrix4 } lightViewProjectionMatrix - 빛 보기 투영 행렬.
 * @param { number } resolution - 그림자 판 한 변의 텍셀 수.
 * @param { number } depthBias - 깊이 치우침. (텍셀 단위)
 * @param { number } normalBias - 노멀 치우침. (텍셀 단위)
 * @returns { Array<number> } [깊이 치우침 (0 ~ 1 깊이), 노멀 치우침 (월드 거리), 기울기 1 의 치우침 (0 ~ 1 깊이), 기울기 상한]
 */
export function readShadowBias(lightViewProjectionMatrix, resolution, depthBias, normalBias) {
	const elements = lightViewProjectionMatrix.getElements();
	const widthScale = readHypot(elements[0], elements[4], elements[8]);
	const depthScale = readHypot(elements[2], elements[6], elements[10]) * 0.5;
	const texelWorldSize = 2 / (System.Math.max(widthScale, 1e-6) * System.Math.max(1, resolution));
	return [depthBias * SHADOW_FILTER_RADIUS * texelWorldSize * depthScale, normalBias * SHADOW_FILTER_RADIUS * texelWorldSize, SHADOW_SLOPE_BIAS * texelWorldSize * depthScale, SHADOW_MAXIMUM_SLOPE];
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
 * import { readOutlineVertexData, MeshBuilder, createBoxGeometry, Matrix4 } from "./vanilla.js";
 * const builder = new MeshBuilder();
 * builder.addPart(createBoxGeometry(1, 1, 1), Matrix4.createIdentity(), "#a0a0a0", { outlineWidth: 0.02 });
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
 * import { ToonRenderer, MeshBuilder, createSphereGeometry, createReflectionMatrix, Matrix4, Vector3 } from "./vanilla.js";
 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
 * const builder = new MeshBuilder();
 * builder.addPart(createSphereGeometry(0.4, 24, 16), Matrix4.createIdentity(), "#e0a060", { hasOutline: true });
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
	const length = readHypot(planeNormal[0], planeNormal[1], planeNormal[2]);
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
	const scaleX = readHypot(elements[0], elements[1], elements[2]);
	const scaleY = readHypot(elements[4], elements[5], elements[6]);
	const scaleZ = readHypot(elements[8], elements[9], elements[10]);
	return System.Math.max(scaleX, scaleY, scaleZ);
}


//==============================================================================
// 인스턴스 버퍼 전체의 경계. (꼴에 행렬이 있을 때만, 자리들의 상자 가운데와 가장 먼 자리까지의 거리, 가장 큰 크기)
// - 어느 모형으로 그려도 쓰도록 모형의 경계 구는 그릴 때 더한다. (readInstanceBufferSphere)
//==============================================================================
/**
 * @param { ToonInstanceLayout } instanceLayout - 버퍼의 인스턴스 꼴.
 * @param { Float32Array } data - 꼴의 수 개수씩 인스턴스를 이어 담은 수.
 * @returns { object | null } { center: [x, y, z], radius, scale }. (행렬이 없거나 인스턴스가 없으면 null)
 */
function readInstanceBounds(instanceLayout, data) {
	if (!instanceLayout.hasMatrix()) {
		return null;
	}
	const floatCount = instanceLayout.getFloatCount();
	const instanceCount = System.Math.floor(data.length / floatCount);
	if (instanceCount <= 0) {
		return null;
	}
	let matrixOffset = 0;
	for (const attribute of instanceLayout.getAttributes()) {
		if (attribute.name === TOON_INSTANCE_MATRIX_NAME) {
			matrixOffset = attribute.offset;
		}
	}
	const minimum = [System.Infinity, System.Infinity, System.Infinity];
	const maximum = [-System.Infinity, -System.Infinity, -System.Infinity];
	let scale = 0;
	for (let instanceIndex = 0; instanceIndex < instanceCount; ++instanceIndex) {
		const offset = instanceIndex * floatCount + matrixOffset;
		for (let axis = 0; axis < 3; ++axis) {
			const value = data[offset + 12 + axis];
			minimum[axis] = System.Math.min(minimum[axis], value);
			maximum[axis] = System.Math.max(maximum[axis], value);
		}
		scale = System.Math.max(scale, readMaximumScale(data.subarray(offset, offset + 16)));
	}
	const center = [(minimum[0] + maximum[0]) * 0.5, (minimum[1] + maximum[1]) * 0.5, (minimum[2] + maximum[2]) * 0.5];
	let radius = 0;
	for (let instanceIndex = 0; instanceIndex < instanceCount; ++instanceIndex) {
		const offset = instanceIndex * floatCount + matrixOffset;
		radius = System.Math.max(radius, readHypot(data[offset + 12] - center[0], data[offset + 13] - center[1], data[offset + 14] - center[2]));
	}
	return { center: center, radius: radius, scale: scale };
}


//==============================================================================
// 모형을 인스턴스 버퍼로 그릴 때의 월드 경계 구. (버퍼의 경계에 모형의 경계 구를 가장 큰 크기로 더한 것, 걸러도 빠지는 화소가 없다)
//==============================================================================
/**
 * @param { object } mesh - ToonRenderer.createMesh 의 결과.
 * @param { object } instanceBuffer - ToonRenderer.createInstanceBuffer 의 결과.
 * @returns { Array<number> | null } [x, y, z, 반지름]. (꼴에 행렬이 없어 경계를 모르면 null)
 * @example <caption>나무 버퍼 전체가 화면에 드는지 보기</caption>
 * import { ToonRenderer, MeshBuilder, createCylinderGeometry, readInstanceBufferSphere, Matrix4 } from "./vanilla.js";
 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
 * const builder = new MeshBuilder();
 * builder.addPart(createCylinderGeometry(0.02, 0.4, 1, 8), Matrix4.createTranslation(0, 0.5, 0), "#4a8040");
 * const treeMesh = renderer.createMesh(builder.readArrays());
 * const instanceLayout = renderer.createInstanceLayout([{ name: "instanceMatrix", size: 16 }]);
 * const data = new Float32Array(16 * 2);
 * data.set(Matrix4.createTranslation(-3, 0, 0).getElements(), 0);
 * data.set(Matrix4.createTranslation(3, 0, 0).getElements(), 16);
 * const sphere = readInstanceBufferSphere(treeMesh, renderer.createInstanceBuffer(instanceLayout, data));
 * if (sphere === null || sphere[0] !== 0 || sphere[3] < 3) {
 * 	throw new Error("bounds failed");
 * }
 */
export function readInstanceBufferSphere(mesh, instanceBuffer) {
	const sphere = [0, 0, 0, 0];
	return writeInstanceBufferSphere(sphere, mesh, instanceBuffer) ? sphere : null;
}

//==============================================================================
// 인스턴스 버퍼를 모형으로 그릴 때의 경계 구를 주어진 배열에 쓰기. (readInstanceBufferSphere 와 같은 값, 새 배열을 짓지 않는다)
//==============================================================================
/**
 * @param { Array<number> | Float32Array | Float64Array } sphere - 쓸 칸. ([x, y, z, 반지름], 넷 이상)
 * @param { object } mesh - createMesh 의 결과.
 * @param { object } instanceBuffer - createInstanceBuffer 의 결과.
 * @returns { boolean } 행렬이 없어 경계가 없으면 false. (그때는 sphere 를 고치지 않는다)
 * @example <caption>프레임마다 같은 칸에 경계 구 쓰기</caption>
 * import { ToonRenderer, MeshBuilder, createBoxGeometry, writeInstanceBufferSphere, Matrix4 } from "./vanilla.js";
 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
 * const builder = new MeshBuilder();
 * builder.addPart(createBoxGeometry(1, 1, 1), Matrix4.createIdentity(), "#808080");
 * const boxMesh = renderer.createMesh(builder.readArrays());
 * const instanceLayout = renderer.createInstanceLayout([{ name: "instanceMatrix", size: 16 }]);
 * const data = new Float32Array(16 * 2);
 * data.set(Matrix4.createTranslation(-2, 0, 0).getElements(), 0);
 * data.set(Matrix4.createTranslation(2, 0, 0).getElements(), 16);
 * const sphere = [0, 0, 0, 0];
 * if (!writeInstanceBufferSphere(sphere, boxMesh, renderer.createInstanceBuffer(instanceLayout, data)) || sphere[3] < 2) {
 * 	throw new Error("bounds failed");
 * }
 */
export function writeInstanceBufferSphere(sphere, mesh, instanceBuffer) {
	const bounds = instanceBuffer.bounds;
	if (bounds === null) {
		return false;
	}
	const center = mesh.boundingCenter;
	const meshReach = readHypot(center[0], center[1], center[2]) + mesh.boundingRadius;
	sphere[0] = bounds.center[0];
	sphere[1] = bounds.center[1];
	sphere[2] = bounds.center[2];
	sphere[3] = bounds.radius + bounds.scale * meshReach;
	return true;
}


//==============================================================================
// 구가 절두체 안에 드는지. (extractFrustumPlanes 의 면 여섯)
//==============================================================================
/**
 * @param { Array<Array<number>> } frustumPlanes - extractFrustumPlanes 의 결과.
 * @param { Array<number> } sphere - [x, y, z, 반지름].
 * @returns { boolean } 절두체 안에 들거나 걸치면 true.
 * @example <caption>카메라 앞뒤의 구 가르기</caption>
 * import { extractFrustumPlanes, isSphereInFrustum, Matrix4, Vector3 } from "./vanilla.js";
 * const viewProjectionMatrix = Matrix4.createPerspective(0.8, 1, 0.1, 50);
 * viewProjectionMatrix.multiply(Matrix4.createLookAt(Vector3.create(0, 0, 5), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0)));
 * const planes = extractFrustumPlanes(viewProjectionMatrix);
 * if (!isSphereInFrustum(planes, [0, 0, 0, 1]) || isSphereInFrustum(planes, [0, 0, 20, 1])) {
 * 	throw new Error("unexpected culling");
 * }
 */
export function isSphereInFrustum(frustumPlanes, sphere) {
	for (let planeIndex = 0; planeIndex < frustumPlanes.length; ++planeIndex) {
		const plane = frustumPlanes[planeIndex];
		if (plane[0] * sphere[0] + plane[1] * sphere[1] + plane[2] * sphere[2] + plane[3] < -sphere[3]) {
			return false;
		}
	}
	return true;
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
		radius = System.Math.max(radius, readHypot(positions[offset] - center[0], positions[offset + 1] - center[1], positions[offset + 2] - center[2]));
	}
	return { center: center, radius: radius };
}


//==============================================================================
// 두 수가 GL 에 같은 값으로 올라가는지. (0 과 -0 을 가르고, NaN 은 늘 다르다고 본다)
//==============================================================================
/**
 * @param { number } value - 기억한 값.
 * @param { number } other - 새 값.
 * @returns { boolean } 같으면 참.
 */
function isSameNumber(value, other) {
	return value === other && (value !== 0 || 1 / value === 1 / other);
}

//==============================================================================
// 몸의 뼈대 어트리뷰트를 지금 묶인 버텍스 어레이에 붙이기. (렌더러 메서드와 선의 판이 같이 쓴다)
//==============================================================================
function attachSkinAttributes(webGL2RenderingContext, skinBuffer) {
	const stride = SKIN_FLOAT_COUNT * 4;
	webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, skinBuffer);
	webGL2RenderingContext.enableVertexAttribArray(TOON_ATTRIBUTE_LOCATIONS.vertexJoints);
	webGL2RenderingContext.vertexAttribPointer(TOON_ATTRIBUTE_LOCATIONS.vertexJoints, 4, webGL2RenderingContext.FLOAT, false, stride, 0);
	webGL2RenderingContext.enableVertexAttribArray(TOON_ATTRIBUTE_LOCATIONS.vertexWeights);
	webGL2RenderingContext.vertexAttribPointer(TOON_ATTRIBUTE_LOCATIONS.vertexWeights, 4, webGL2RenderingContext.FLOAT, false, stride, 16);
}

//==============================================================================
// 몸의 꼭짓점, 뼈대, UV 어트리뷰트와 번호 버퍼를 지금 묶인 버텍스 어레이에 붙이기.
//==============================================================================
function attachBodyAttributes(webGL2RenderingContext, mesh) {
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
		attachSkinAttributes(webGL2RenderingContext, mesh.skinBuffer);
	}
	if (mesh.uvBuffer !== null) {
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, mesh.uvBuffer);
		webGL2RenderingContext.enableVertexAttribArray(TOON_ATTRIBUTE_LOCATIONS.vertexUv);
		webGL2RenderingContext.vertexAttribPointer(TOON_ATTRIBUTE_LOCATIONS.vertexUv, mesh.hasSecondUv ? 4 : 2, webGL2RenderingContext.FLOAT, false, mesh.hasSecondUv ? 16 : 8, 0);
	}
	webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ELEMENT_ARRAY_BUFFER, mesh.bodyIndexBuffer);
}

//==============================================================================
// 인스턴스 버퍼를 지금 묶인 버텍스 어레이의 인스턴스 어트리뷰트로. (행렬 네 줄, 틴트, 인스턴스마다 하나씩)
//==============================================================================
function attachInstanceAttributes(webGL2RenderingContext, instanceBuffer) {
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
// 모형의 몸과 인스턴스 버퍼 하나를 묶은 버텍스 어레이 짓기. (선의 판이 몸 묶음 자리와 따로 쓰는 인스턴스 버퍼용, 드로우 호출을 몸과 같이 묶음 자리로 둔다)
//==============================================================================
export function createMeshInstanceVertexArray(webGL2RenderingContext, mesh, instanceBuffer) {
	const vertexArray = webGL2RenderingContext.createVertexArray();
	webGL2RenderingContext.bindVertexArray(vertexArray);
	attachBodyAttributes(webGL2RenderingContext, mesh);
	attachInstanceAttributes(webGL2RenderingContext, instanceBuffer);
	webGL2RenderingContext.bindVertexArray(null);
	return vertexArray;
}


//==============================================================================
// 전역 상수 목록. (재질 블록)
// - 몸 프로그램의 재질 값(틴트, 빛남, 텍스처 쓰기, 무늬 옮김, 반사 세기 같은 것)은 std140 유니폼 블록 ToonDrawMaterial 하나에 담는다. (유니티 SRP Batcher 의 UnityPerMaterial 꼴)
//   값이 같은 블록은 하나만 지어 두고(GPU 버퍼) 그리기마다 bindBufferBase 하나로 고른다. 바뀐 값은 새 블록을 지어 올린다. (그리기마다 유니폼 스물을 올리지 않는다)
// - float 자리는 셰이더의 블록 선언 차례와 같다. (vec4 여섯, vec3 셋 + float 셋, vec2 + float 둘, float 넷 = 44)
//==============================================================================
// - 바깥선 껍데기 프로그램의 값(선 색, 굵기 배, 깊이 밀기, 빛 색, 알파)도 같은 꼴의 블록 ToonDrawOutline 에 담는다. (vec4, vec3 + float, float 셋 = 12)
const MATERIAL_BLOCK_NAME = "ToonDrawMaterial";
const MATERIAL_BLOCK_BINDING = 0; // 재질 블록의 바인딩 자리.
const MATERIAL_BLOCK_FLOAT_COUNT = 44;
const OUTLINE_BLOCK_NAME = "ToonDrawOutline";
const OUTLINE_BLOCK_BINDING = 1;
const OUTLINE_BLOCK_FLOAT_COUNT = 12;
const FRAME_BLOCK_NAME = "ToonFrame"; // 프레임 블록. (FRAME_BLOCK_CHUNK)
const FRAME_BLOCK_BINDING = 2;
const FRAME_BLOCK_FLOAT_COUNT = 172;
const MATERIAL_BLOCK_LIMIT = 1024; // 블록 갈래마다 기억할 블록 수. (넘으면 오래 안 쓴 블록 하나를 내보내고 그 버퍼에 새 값을 bufferSubData 로 쓴다, 갈래를 통째 지우지 않는다)
const FRAME_RING_SLOT_COUNT = 1; // 프레임 블록 장(유니폼 버퍼 하나)마다 칸 수. (하나면 장을 통째 bindBufferBase 로 묶어 멈춘 장면의 GL 호출이 값마다 버퍼를 짓던 꼴과 같다, 여럿이면 칸을 bindBufferRange 로 고른다)
// - 칸 여덟(UNIFORM_BUFFER_OFFSET_ALIGNMENT 맞춤, 패스마다 다른 자리를 bindBufferRange)으로 재 보니 멈춘 로비와 광부 꼴의 GPU 프로세스 가운데가 0.1 ~ 0.4 ms 늘어 하나로 둔다. (헤드리스 크롬, 맥미니, 2026-11-28)
const FRAME_RING_LATENCY = 8; // 장을 다시 쓰기 전에 아무 칸도 안 쓰고 지나야 할 beginFrame 수. (GPU 가 아직 읽는 장을 고치지 않는다, 그림자와 선의 판까지 화면 한 장에 beginFrame 이 둘셋이라 화면 세 장 남짓)
const BATCH_SLOT_MESH_LIMIT = 8; // 묶음 자리마다 버텍스 어레이를 지어 둘 모형 수. (넘으면 그 자리의 것을 모두 지우고 다시)
const DRAW_PART_OUTLINE = 1; // drawWithCount 가 그릴 것: 바깥선 껍데기.
const DRAW_PART_BODY = 2; // 몸.
const DRAW_PART_ALL = 3;
const WHITE_COLOR = System.Object.freeze([1, 1, 1, 1]);
const BLACK_COLOR = System.Object.freeze([0, 0, 0]);
const IDENTITY_UV_TRANSFORM = System.Object.freeze([0, 0, 1, 1]);
const IDENTITY_ELEMENTS = new Matrix4().getElements(); // 인스턴스 버퍼 그리기의 모형 행렬. (단위 행렬, 고치지 않는다, 그리기마다 짓지 않게)
const INSTANCE_BUFFER_SPHERE = [0, 0, 0, 0]; // 인스턴스 버퍼 거르기의 경계 구 칸. (다시 쓴다)
export const EMPTY_OPTIONS = System.Object.freeze({}); // 꼴을 주지 않은 그리기의 꼴. (그리기마다 새 빈 객체를 짓지 않아 렌더러가 기억한 푼 칸을 같이 쓴다)


//==============================================================================
// 재질 블록 값 쓰기. (그리기 꼴을 ToonDrawMaterial 의 float 44 로 푼다, 기본값은 drawMesh 머리말과 같다)
//==============================================================================
/**
 * @param { Float32Array } values - 쓸 칸. (MATERIAL_BLOCK_FLOAT_COUNT)
 * @param { object } options - 그리기 꼴.
 */
function writeMaterialBlockValues(values, options) {
	const tintColor = options.tintColor !== undefined ? options.tintColor : WHITE_COLOR;
	const emissiveColor = options.emissiveColor !== undefined ? options.emissiveColor : BLACK_COLOR;
	const uvTransform = options.uvTransform !== undefined ? options.uvTransform : IDENTITY_UV_TRANSFORM;
	const decalUvTransform = options.decalUvTransform !== undefined ? options.decalUvTransform : IDENTITY_UV_TRANSFORM;
	const decalColor = options.decalColor !== undefined ? options.decalColor : WHITE_COLOR;
	const angelRingColor = options.angelRingColor !== undefined ? options.angelRingColor : WHITE_COLOR;
	values[0] = tintColor[0];
	values[1] = tintColor[1];
	values[2] = tintColor[2];
	values[3] = tintColor[3];
	values[4] = emissiveColor[0];
	values[5] = emissiveColor[1];
	values[6] = emissiveColor[2];
	values[7] = options.emissiveIntensity !== undefined ? options.emissiveIntensity : 1;
	values[8] = uvTransform[0];
	values[9] = uvTransform[1];
	values[10] = uvTransform[2];
	values[11] = uvTransform[3];
	values[12] = decalUvTransform[0];
	values[13] = decalUvTransform[1];
	values[14] = decalUvTransform[2];
	values[15] = decalUvTransform[3];
	values[16] = decalColor[0];
	values[17] = decalColor[1];
	values[18] = decalColor[2];
	values[19] = options.decalEmission !== undefined ? options.decalEmission : 0;
	values[20] = isTextureGiven(options.angelRingTexture) ? 1 : 0;
	values[21] = options.angelRingOffsetU !== undefined ? options.angelRingOffsetU : 0;
	values[22] = options.angelRingOffsetV !== undefined ? options.angelRingOffsetV : 0.3;
	values[23] = options.isAngelRingAlpha === true ? 1 : 0;
	values[24] = isTextureGiven(options.baseColorTexture) ? 1 : 0;
	values[25] = isTextureGiven(options.emissiveTexture) ? 1 : 0;
	values[26] = isTextureGiven(options.decalTexture) ? 1 : 0;
	values[27] = options.tintAmount !== undefined && options.tintAmount !== null ? System.Math.max(0, System.Math.min(1, options.tintAmount)) : -1;
	values[28] = isTextureGiven(options.matcapTexture) ? 1 : 0;
	values[29] = options.matcapStrength !== undefined ? options.matcapStrength : 1;
	values[30] = options.matcapBlend === ToonMatcapBlend.add ? 1 : 0;
	values[31] = options.alpha !== undefined ? options.alpha : 1;
	values[32] = angelRingColor[0];
	values[33] = angelRingColor[1];
	values[34] = angelRingColor[2];
	values[35] = options.glowScale !== undefined ? options.glowScale : 1;
	values[36] = options.specularScale !== undefined ? System.Math.max(0, options.specularScale) : 1;
	values[37] = options.rimScale !== undefined ? System.Math.max(0, options.rimScale) : 1;
	values[38] = options.colorScale !== undefined ? options.colorScale : 1;
	values[39] = options.softEdge !== undefined ? options.softEdge : 0;
	values[40] = options.alphaCutoff !== undefined ? options.alphaCutoff : 0;
	values[41] = options.blendMode !== undefined && options.blendMode !== ToonBlendMode.alpha ? 1 : 0;
	values[42] = options.receivesShadow !== false ? 1 : 0;
	values[43] = options.shadeOffset !== undefined ? options.shadeOffset : 0;
}

//==============================================================================
// 텍스처를 주었는지. (undefined 와 null 은 안 줌)
//==============================================================================
/**
 * @param { WebGLTexture | null | undefined } texture - 텍스처.
 * @returns { boolean } 주었으면 참.
 */
function isTextureGiven(texture) {
	return texture !== undefined && texture !== null;
}

//==============================================================================
// 재질 블록 값의 해시. (FNV-1a, float 의 비트로)
//==============================================================================
/**
 * @param { Uint32Array } bits - 재질 블록 값의 비트.
 * @returns { number } 해시.
 */
function readMaterialBlockHash(bits) {
	let hash = 2166136261;
	for (let index = 0; index < bits.length; ++index) {
		hash = System.Math.imul(hash ^ bits[index], 16777619);
	}
	return hash >>> 0;
}

//==============================================================================
// 같은 비트인지. (재질 블록 값 둘, NaN 과 -0 도 비트로 가른다)
//==============================================================================
/**
 * @param { Uint32Array } bits - 앞의 값.
 * @param { Uint32Array } other - 지금 값.
 * @returns { boolean } 모두 같으면 참.
 */
function isSameBits(bits, other) {
	for (let index = 0; index < bits.length; ++index) {
		if (bits[index] !== other[index]) {
			return false;
		}
	}
	return true;
}

//==============================================================================
// 블록 갈래 짓기. (값이 같은 유니폼 블록을 하나씩 기억하는 칸)
//==============================================================================
/**
 * @param { number } binding - 블록의 바인딩 자리.
 * @param { number } floatCount - 블록의 float 수.
 * @returns { object } { binding, values Float32Array, bits Uint32Array, table Map<해시, Array<{ buffer, bits, hash, isUsed }>>, count, boundBlock, blocks (지은 차례, 내보낼 것을 고르는 고리), hand }
 */
function createBlockCache(binding, floatCount) {
	const values = new System.Float32Array(floatCount);
	return { binding: binding, values: values, bits: new System.Uint32Array(values.buffer), table: new System.Map(), count: 0, boundBlock: null, blocks: [], hand: 0 };
}

//==============================================================================
// 프레임 블록 고리 짓기. (ToonFrame 을 장(유니폼 버퍼)마다 FRAME_RING_SLOT_COUNT 칸에 쓰고 패스마다 고른다)
// - 칸이 여럿이면 칸 자리는 UNIFORM_BUFFER_OFFSET_ALIGNMENT 에 맞춘다. 값이 같은 칸이 있으면 다시 쓰고(올림 없음), 새 값은 이 프레임에 고른 장의 다음 칸에 bufferSubData 로 쓴다.
// - 장은 FRAME_RING_LATENCY 프레임 동안 아무 칸도 쓰지 않은 것만 다시 쓴다. (모자라면 새 장을 짓는다, 값마다 버퍼를 짓고 한꺼번에 지우지 않는다)
//==============================================================================
/**
 * @param { number } alignment - UNIFORM_BUFFER_OFFSET_ALIGNMENT. (바이트)
 * @returns { object } { values Float32Array, bits Uint32Array, stride (칸 사이 바이트), pages Array<{ buffer, bits, hashes, count, useFrame, writeFrame }>, writePage, boundBuffer, boundOffset }
 */
function createFrameRing(alignment) {
	const values = new System.Float32Array(FRAME_BLOCK_FLOAT_COUNT);
	const stride = System.Math.ceil(FRAME_BLOCK_FLOAT_COUNT * 4 / alignment) * alignment;
	return { values: values, bits: new System.Uint32Array(values.buffer), stride: stride, pages: [], writePage: null, boundBuffer: null, boundOffset: -1 };
}

//==============================================================================
// 장의 한 칸이 값과 같은 비트인지.
//==============================================================================
/**
 * @param { Uint32Array } pageBits - 장의 칸 값 사본. (칸마다 FRAME_BLOCK_FLOAT_COUNT)
 * @param { number } start - 칸의 첫 자리.
 * @param { Uint32Array } bits - 견줄 값.
 * @returns { boolean } 같으면 참.
 */
function isSameBitsAt(pageBits, start, bits) {
	for (let index = 0; index < bits.length; ++index) {
		if (pageBits[start + index] !== bits[index]) {
			return false;
		}
	}
	return true;
}

//==============================================================================
// 전역 상수 목록. (그리기 꼴을 푼 칸, readDrawEntry)
// - 그리기마다 꼴 객체의 칸을 이름으로 찾아 읽지 않게 한 번 풀어 번호로 읽는 배열에 둔다. (그리기 줄도 같이 읽는다)
//==============================================================================
export const DRAW_STATE_MATERIAL = 0; // ToonMaterial 이나 null.
export const DRAW_STATE_JOINT_MATRICES = 1; // Float32Array 나 null.
export const DRAW_STATE_INDEX_START = 2; // 꼴의 indexStart. (없으면 0)
export const DRAW_STATE_INDEX_COUNT = 3; // 꼴의 indexCount. (없거나 0 이하면 -1)
const DRAW_STATE_OUTLINE_INDEX_START = 4;
const DRAW_STATE_OUTLINE_INDEX_COUNT = 5;
export const DRAW_STATE_IS_MIRRORED = 6; // -1 행렬로 가림, 1 뒤집음, 0 안 뒤집음.
const DRAW_STATE_ON_BEFORE_DRAW = 7; // 함수나 null.
export const DRAW_STATE_IS_TRANSPARENT = 8; // alpha 나 틴트 알파가 1 보다 작거나 섞는 방식이 곧은 알파가 아님.
const DRAW_STATE_ALPHA = 9;
const DRAW_STATE_BLEND_MODE = 10;
export const DRAW_STATE_HAS_OUTLINE = 11; // hasOutline 이 false 가 아님.
const DRAW_STATE_IS_BODY_DRAWN = 12; // isBodyDrawn 이 false 가 아님.
const DRAW_STATE_LIGHT_SET = 13; // ToonLightSet 이나 null.
export const DRAW_STATE_BASE_COLOR_TEXTURE = 14; // 텍스처 다섯. (없으면 null)
const DRAW_STATE_EMISSIVE_TEXTURE = 15;
const DRAW_STATE_DECAL_TEXTURE = 16;
const DRAW_STATE_MATCAP_TEXTURE = 17;
const DRAW_STATE_ANGEL_RING_TEXTURE = 18;
const DRAW_STATE_TEXTURES = 19; // { 유니폼 이름: 텍스처 } 이나 null. (안은 그리기마다 읽는다)
const DRAW_STATE_OUTLINE_COLOR = 20; // 꼴의 outlineColor 나 null.
const DRAW_STATE_OUTLINE_WIDTH_SCALE = 21;
const DRAW_STATE_OUTLINE_OFFSET_Z = 22;
const DRAW_STATE_PREMULTIPLIED_OUTPUT = 23;
export const DRAW_STATE_IS_CULLED = 24; // isCulled 가 false 가 아님.
export const DRAW_STATE_CASTS_SHADOW = 25; // castsShadow 가 false 가 아님.
export const DRAW_STATE_LINE_ID = 26; // 수면 그 번호, 아니면 null.
export const DRAW_STATE_GROUP = 27; // group 이나 null.
export const DRAW_STATE_IS_DEPTH_PREPASSED = 28;
const DRAW_STATE_COUNT = 29;

//==============================================================================
// 자동 인스턴싱으로 묶을 수 있는 푼 칸인지. (그리기 줄이 같은 모형, 같은 재질 블록의 이어진 것을 drawMeshBatch 한 번으로 그린다)
// - 선 번호, 묶음, 깊이 먼저, 그림자 드리우기, 거르기 말고 모든 칸이 같아야 한다. (거르기는 그리기 줄이 하나씩 먼저 한다)
// - 뼈대 행렬, 그리기 앞 함수가 있거나 비치는 것은 묶지 않는다. (그리기마다 다를 수 있다)
//==============================================================================
/**
 * @param { Array<any> } state - readDrawEntry 의 푼 칸.
 * @param { Array<any> } other - 견줄 푼 칸.
 * @returns { boolean } 묶을 수 있으면 true.
 */
export function isSameBatchState(state, other) {
	if (state === other) {
		return state[DRAW_STATE_JOINT_MATRICES] === null && state[DRAW_STATE_ON_BEFORE_DRAW] === null && !state[DRAW_STATE_IS_TRANSPARENT];
	}
	if (state[DRAW_STATE_JOINT_MATRICES] !== null || state[DRAW_STATE_ON_BEFORE_DRAW] !== null || state[DRAW_STATE_IS_TRANSPARENT]) {
		return false;
	}
	for (let index = 0; index < DRAW_STATE_COUNT; ++index) {
		if (index === DRAW_STATE_LINE_ID || index === DRAW_STATE_GROUP || index === DRAW_STATE_IS_DEPTH_PREPASSED || index === DRAW_STATE_CASTS_SHADOW || index === DRAW_STATE_IS_CULLED) {
			continue;
		}
		if (state[index] !== other[index]) {
			return false;
		}
	}
	return true;
}

//==============================================================================
// 그리기 꼴 풀기. (칸마다 한 번 읽어 DRAW_STATE_ 자리에 둔다, 기본값은 drawMesh 머리말과 같다)
//==============================================================================
/**
 * @param { Array<any> } state - 쓸 칸. (DRAW_STATE_COUNT)
 * @param { object } options - 그리기 꼴.
 */
function writeDrawState(state, options) {
	const readTexture = (texture) => {
		return texture !== undefined ? texture : null;
	};
	const tintColor = options.tintColor !== undefined ? options.tintColor : WHITE_COLOR;
	const alpha = options.alpha !== undefined ? options.alpha : 1;
	const blendMode = options.blendMode !== undefined ? options.blendMode : ToonBlendMode.alpha;
	const indexCount = options.indexCount;
	const outlineIndexCount = options.outlineIndexCount;
	const isMirrored = options.isMirrored;
	const onBeforeDraw = options.onBeforeDraw;
	const textures = options.textures;
	const outlineColor = options.outlineColor;
	const outlineWidthScale = options.outlineWidthScale;
	const lineId = options.lineId;
	const group = options.group;
	state[DRAW_STATE_MATERIAL] = options.material !== undefined ? options.material : null;
	state[DRAW_STATE_JOINT_MATRICES] = options.jointMatrices !== undefined ? options.jointMatrices : null;
	state[DRAW_STATE_INDEX_START] = options.indexStart !== undefined ? options.indexStart : 0;
	state[DRAW_STATE_INDEX_COUNT] = indexCount !== undefined && indexCount > 0 ? indexCount : -1;
	state[DRAW_STATE_OUTLINE_INDEX_START] = options.outlineIndexStart !== undefined ? options.outlineIndexStart : 0;
	state[DRAW_STATE_OUTLINE_INDEX_COUNT] = outlineIndexCount !== undefined && outlineIndexCount > 0 ? outlineIndexCount : -1;
	state[DRAW_STATE_IS_MIRRORED] = isMirrored !== undefined ? (isMirrored === true ? 1 : 0) : -1;
	state[DRAW_STATE_ON_BEFORE_DRAW] = typeof onBeforeDraw === "function" ? onBeforeDraw : null;
	state[DRAW_STATE_IS_TRANSPARENT] = alpha < 1 || tintColor[3] < 1 || blendMode !== ToonBlendMode.alpha;
	state[DRAW_STATE_ALPHA] = alpha;
	state[DRAW_STATE_BLEND_MODE] = blendMode;
	state[DRAW_STATE_HAS_OUTLINE] = options.hasOutline !== false;
	state[DRAW_STATE_IS_BODY_DRAWN] = options.isBodyDrawn !== false;
	state[DRAW_STATE_LIGHT_SET] = options.lightSet !== undefined && options.lightSet !== null ? options.lightSet : null;
	state[DRAW_STATE_BASE_COLOR_TEXTURE] = readTexture(options.baseColorTexture);
	state[DRAW_STATE_EMISSIVE_TEXTURE] = readTexture(options.emissiveTexture);
	state[DRAW_STATE_DECAL_TEXTURE] = readTexture(options.decalTexture);
	state[DRAW_STATE_MATCAP_TEXTURE] = readTexture(options.matcapTexture);
	state[DRAW_STATE_ANGEL_RING_TEXTURE] = readTexture(options.angelRingTexture);
	state[DRAW_STATE_TEXTURES] = textures !== undefined && textures !== null ? textures : null;
	state[DRAW_STATE_OUTLINE_COLOR] = outlineColor !== undefined && outlineColor !== null ? outlineColor : null;
	state[DRAW_STATE_OUTLINE_WIDTH_SCALE] = outlineWidthScale !== undefined ? System.Math.max(0, outlineWidthScale) : 1;
	state[DRAW_STATE_OUTLINE_OFFSET_Z] = options.outlineOffsetZ !== undefined ? options.outlineOffsetZ : 0;
	state[DRAW_STATE_PREMULTIPLIED_OUTPUT] = blendMode !== ToonBlendMode.alpha ? 1 : 0;
	state[DRAW_STATE_IS_CULLED] = options.isCulled !== false;
	state[DRAW_STATE_CASTS_SHADOW] = options.castsShadow !== false;
	state[DRAW_STATE_LINE_ID] = typeof lineId === "number" ? lineId : null;
	state[DRAW_STATE_GROUP] = group !== undefined && group !== null ? group : null;
	state[DRAW_STATE_IS_DEPTH_PREPASSED] = options.isDepthPrepassed === true;
}

//==============================================================================
// 수 배열인지. (틴트 같은 칸, 값의 내용까지 견줄 것)
//==============================================================================
/**
 * @param { any } value - 꼴의 칸 값.
 * @returns { boolean } 배열이나 Float32Array, Float64Array 면 참.
 */
function isNumberArray(value) {
	return value instanceof System.Array || value instanceof System.Float32Array || value instanceof System.Float64Array;
}

//==============================================================================
// 꼴 객체의 얕은 사본 쓰기. (칸 이름, 값, 넷 이하의 수 배열(색, 무늬 옮김)의 내용을 for-in 차례로, 이름으로 칸을 찾아 읽지 않는다)
// - 본 행렬 같은 긴 배열은 참조만 견준다. (그 내용은 그리기마다 올리며 견준다)
//==============================================================================
/**
 * @param { object } entry - 블록 기억 칸. ({ keys, values, numbers })
 * @param { object } options - 그리기 꼴.
 */
function writeOptionsSnapshot(entry, options) {
	const keys = entry.keys;
	const values = entry.values;
	const numbers = entry.numbers;
	keys.length = 0;
	values.length = 0;
	numbers.length = 0;
	for (const key in options) {
		const value = options[key];
		keys.push(key);
		values.push(value);
		if (isNumberArray(value) && value.length <= 4) {
			numbers.push(value.length);
			for (let index = 0; index < value.length; ++index) {
				numbers.push(value[index]);
			}
		}
	}
}

//==============================================================================
// 꼴 객체가 얕은 사본과 같은지. (칸 이름과 차례, 값의 참조, 수 배열의 내용이 모두 같으면 참, 그 자리에서 고친 틴트 배열도 가린다)
//==============================================================================
/**
 * @param { object } entry - 블록 기억 칸.
 * @param { object } options - 그리기 꼴.
 * @returns { boolean } 같으면 참.
 */
function isSameOptionsSnapshot(entry, options) {
	const keys = entry.keys;
	const values = entry.values;
	const numbers = entry.numbers;
	let index = 0;
	let numberIndex = 0;
	for (const key in options) {
		if (index >= keys.length || keys[index] !== key) {
			return false;
		}
		const value = options[key];
		if (value !== values[index]) {
			return false;
		}
		if (isNumberArray(value) && value.length <= 4) {
			if (numbers[numberIndex] !== value.length) {
				return false;
			}
			numberIndex += 1;
			for (let elementIndex = 0; elementIndex < value.length; ++elementIndex) {
				if (!isSameNumber(numbers[numberIndex], value[elementIndex])) {
					return false;
				}
				numberIndex += 1;
			}
		}
		index += 1;
	}
	return index === keys.length;
}


//==============================================================================
// 툰 렌더러. (MeshBuilder 와 readGlbArrays 의 배열을 한 색 재질과 바깥선으로 그린다)
// - 빛: ToonLightSet 하나를 기본으로 든다. 해(방향과 색, 그림자), 하늘색과 땅색의 바탕빛, 채움 빛, 점광과 스포트라이트(TOON_MAXIMUM_POINT_LIGHTS 까지), 림 빛, 하이라이트, 빛 꼴(÷π).
//   셀 셰이딩은 그늘 램프다. (유니티 툰 셰이더의 바탕, 1 차 그늘, 2 차 그늘과 Step, Feather, 그림자는 그늘 색으로 들어간다, 경계는 fwidth 로 계단 없이, 램프 텍스처도 된다)
//   해는 램프 색을 통째로, 채움 빛과 점광과 스포트라이트는 램프의 밝기 단계를 받는다. 하이라이트와 림은 단단한 툰 꼴에서 부드러운 꼴까지. 셈은 ToonLightSet 머리말에 있다.
//   setLight, setSunDirection, setFillLight, setShade, setShadeRamp, clearShadeRamp, setBandCount, setBandRamp, setRampTexture, setRimLight, setSpecular, setPointLights, setPointLightLimit,
//   setLightModel 은 기본 묶음을 고친다. 그리기마다 options.lightSet 으로 다른 묶음(createLightSet)을 줄 수 있다. (재질마다 그늘 색이 다를 때)
// - 노멀: 모형 행렬과 본 행렬의 왼쪽 위 3x3 의 역행렬의 전치로 옮긴다. (늘이고 줄인 모형도 빛이 맞다, 정점 조각이 고친 행렬도 같다)
// - 재질: 꼭짓점의 색(sRGB), 빛남(바탕색에 곱해 더함), 빛을 받지 않음. 꼭짓점 UV(arrays.uvData, 2 씩)가 있으면 텍스처를 읽는다.
// - 그리기 꼴(options, 기본값이면 지금까지와 같은 화면):
//   tintColor [r, g, b, a] sRGB 와 alpha. tintAmount 를 주면(0 ~ 1) 틴트를 곱하지 않고 sRGB 로 섞는다. (맞은 번쩍임, 고장 빨강, 선형 색 공간은 선형으로 섞는다)
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
//   오래 두는 인스턴스는 createInstanceLayout 과 createInstanceBuffer 로 영구 버퍼를 짓고 drawMeshInstanceBuffer 로 그린다. (버퍼 전체의 경계로 통째 거름, 머티리얼 정점 조각이 사용자 어트리뷰트를 읽음)
//   고칠 때는 updateInstanceBuffer(전체) 나 updateInstanceBufferRange(일부, bufferSubData). 몸, 바깥선 껍데기, 그림자, 화면 공간 바깥선의 선의 판이 같은 GPU 버퍼를 같이 쓴다.
// - 화면 밖 거르기: 모형의 경계 구를 보기와 투영의 절두체에 대어 밖이면 그리지 않는다. (인스턴스는 하나씩 걸러 남은 것만 올린다)
// - 그림자: ShadowMap 에 beginShadowPass 와 drawMesh 로 드리우고, setShadow 로 받는다. (3x3 PCF, 치우침은 ShadowMap.setBias 의 텍셀 단위 값에 텍셀 크기와 기울기를 곱한다)
//   점광과 스포트라이트 그림자는 ShadowAtlas 에 beginShadowAtlasPass, 칸마다 setShadowAtlasTile 과 drawMesh 로 드리우고, setLocalShadows 로 받는다. (점광은 큐브 여섯 칸, 스포트라이트는 원근 한 칸)
//   그 빛의 받는 몫에 그림자를 곱해 그늘 램프에 넣는다. (해와 같은 꼴) castsShadow 가 true 인 점광만 칸을 받는다. (SHADOW_ATLAS_MAXIMUM_LIGHTS 까지)
//   그림자를 받지 않을 때도 두 그림자 유닛에 1x1 비교 깊이 텍스처를 묶는다. (sampler2DShadow 유닛에 깊이 텍스처가 없으면 맥 드라이버가 알리고, 색 텍스처가 묶여 있으면 WebGL 이 그리기를 거부한다)
// - HDR: setHdrOutput(true) 면 감마를 걸지 않은 선형 색을 낸다. 실수 렌더 타겟(ToonPostProcess)에 그리고 블룸과 톤매핑으로 마무리한다.
// - 사용: createMesh(arrays) → 매 프레임 beginFrame(보기와 투영) → drawMesh / drawMeshInstanced → endFrame() → 다 쓰면 deleteMesh.
//   beginFrame 이 앞의 그리기 상태(섞기, 깊이, 면 가리기, 프로그램, 버텍스 어레이)를 적어 두고 깊이 시험과 면 가리기를 켜며, endFrame 이 적어 둔 상태로 돌린다.
//   (엔진 2D 그리기 사이에 끼울 때, 그 전에 Graphic.flushBatch)
//   beginFrameWithMatrices(보기, 투영) 는 두 행렬로 시작한다. (직교 원 행렬 카메라) 카메라의 자리와 보기 돌림(하이라이트, 림, 소프트 엣지, 매트캡)은 보기와 투영에서 읽는다.
// - 프로그램마다 프레임 값(보기와 투영, 카메라, 그림자, HDR)과 빛 묶음은 바뀔 때만 올린다. 그리기마다 바뀌는 값(모형 행렬, 틴트, 텍스처)만 매번 올린다.
// - readProgramSources(material, instanceLayout) 로 ShaderWarmer 에 넘길 소스를 준다.
// - 노드 사각형 안에 그리기: setScreenRect(x, y, 너비, 높이) 를 주면 beginFrame 이 보기와 투영의 클립 공간을 그 사각형으로 옮기고 가위로 밖을 자른다.
//   사각형은 beginFrame 때의 뷰포트(보통 드로잉 버퍼 전체) 안의 픽셀이고 왼쪽 위가 원점이다. (2D 노드의 draw 에서 graphic.getTransformMatrix 로 셈한 자리)
//   화면 밖 거르기는 옮기기 전의 절두체로 한다. endFrame 이 가위를 푼다. 카메라의 가로 세로 비는 사각형의 비로 맞춘다. (Camera3D.setAspectRatio)
// - beginFrameWithCamera(Camera3D) 는 카메라의 보기와 투영으로 beginFrame 을 부른다. 2D 표시(Camera3D.projectToView)와 같은 카메라를 쓴다.
// - drawMeshOutline 은 바깥선 껍데기만 그린다. (ToonDrawQueue 가 불투명한 몸을 다 그린 뒤 바깥선을 몰아 그릴 때, 그린 수는 세지 않는다)
// - 텍스처: createTexture(그림이나 { width, height, data }, { isMipmapped, isRepeated, isFiltered, isColorData }) 로 RGBA 텍스처를 짓는다. UV (0, 0) 이 그림의 왼쪽 위다. (glTF 와 같음)
// - 색 공간: 생성의 options.colorSpace(기본은 엔진의 EngineConfiguration.colorSpace, 엔진이 없으면 gamma)로 정하고 바뀌지 않는다. (getColorSpace)
//   gamma(기본): 넘기는 색(꼭짓점 색, 틴트, 빛남 색, 데칼 색, 바깥선 색)과 색 텍스처는 sRGB 이고 바탕색, 틴트, 데칼은 sRGB 로 곱하고 섞은 뒤 pow(색, 2.2) 로 선형으로 바꿔 빛을 셈한다.
//     화면에 낼 때 pow(1 / 2.2) 를 건다. (HDR 출력이면 선형 그대로)
//   linear: 색 텍스처를 sRGB 형식으로 올려 GPU 가 선형으로 풀고, 넘기는 색은 sRGB 표준 곡선(IEC 61966-2-1)으로 선형으로 바꿔 곱하고 섞는다. 화면에 낼 때 같은 곡선으로 sRGB 로 바꾼다.
//     셰이더 소스마다 #define VANILLA_COLOR_SPACE_LINEAR 1 이 들어간다. (ToonPostProcess, ToonScreenOutline 도 같은 값으로 짓는다)
// - 텍스처 유닛: 점광 그림자 아틀라스 0, 램프 1, 매트캡 2, 해 그림자 3, 바탕색 4, 빛남 5, 데칼 6, 천사 고리 7, 머티리얼 8 ~ 15. 유닛 0 의 묶음은 beginFrame 이 적어 두고 endFrame 이 돌린다.
//   유닛마다 묶인 텍스처가 같으면 묶지 않고, 고른 유닛도 그리기마다 0 으로 되돌리지 않는다. (고른 유닛은 endFrame 이 돌린다, 단계 콜백과 onBeforeDraw 에는 유닛 0 을 고른 채 넘긴다)
// - 2 번 UV: 배열에 uv1Data 가 있으면 vertexUv 가 (UV, 2 번 UV) 넷이다. 셰이더 조각은 ToonSurface.uv1 로 읽는다. (없으면 (0, 1))
// - 빛 색 쓰기(setLightColorUsage), 그늘 쪽 림(setShadeRimLight), 빛 세기 막기(setLightIntensityLimited)는 빛 묶음(ToonLightSet)에 둔다.
//==============================================================================
/**
 * @example <caption>해와 바깥선 색을 정해 그린 뒤 통계를 읽고 치우기</caption>
 * import { ToonRenderer, MeshBuilder, createCapsuleGeometry, Matrix4, Vector3 } from "./vanilla.js";
 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
 * const renderer = new ToonRenderer(webGL2RenderingContext);
 * renderer.setLight([-0.4, -1, -0.3], [1, 0.96, 0.9], [0.45, 0.5, 0.6], [0.25, 0.22, 0.2]);
 * renderer.setOutlineColor([0.1, 0.06, 0.08, 1]);
 * const builder = new MeshBuilder();
 * builder.addPart(createCapsuleGeometry(0.3, 0.6, 8, 16), Matrix4.createIdentity(), "#a0d0a0", { outlineWidth: 0.02 });
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
	/** @private @type { object | null } */ #ambientOcclusionInput; // 모서리 어둠. ({ texture, origin [x, y] 이번 프레임 뷰포트의 왼쪽 아래, directLightingStrength 직접 빛에 미치는 몫 }, null 이면 기본 몸 프로그램)
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
	/** @private @type { Array<object> } */ #batchSlots; // 자동 인스턴싱 묶음 자리. ({ buffer, values, count, vertexArrays }, 그리기 줄이 프레임마다 같은 차례로 고르고 값이 같으면 다시 올리지 않는다)
	/** @private @type { Array<object> } */ #shadowBatchSlots; // 그림자 패스의 묶음 자리.
	/** @private @type { object } */ #frameBlocks; // 프레임 블록(ToonFrame) 고리. (createFrameRing, 장의 칸마다 한 패스의 값, GPU 가 읽는 장은 고치지 않는다)
	/** @private @type { object | null } */ #frameBlock; // 지금 frameSerial 의 프레임 블록이 든 장.
	/** @private @type { number } */ #frameBlockOffset; // 그 장 안의 칸 자리. (바이트)
	/** @private @type { number } */ #frameBlockSerial; // #frameBlock 을 고른 frameSerial. (같으면 다시 고르지 않는다)
	/** @private @type { number } */ #frameNumber; // beginFrame 마다 오르는 번호. (프레임 블록 장을 다시 쓸 수 있는지 가른다)
	/** @private @type { WebGLStateCache } */ #stateCache; // 컨텍스트의 GL 상태 기억. (같은 프로그램, 텍스처, 버텍스 어레이, 감김을 다시 걸지 않을 때 묻는다)
	/** @private @type { WeakMap<ShaderProgram, Map<string, object>> } */ #uniformSlotTable; // 프로그램마다 유니폼 이름별 위치와 마지막으로 올린 값.
	/** @private @type { number } */ #uniformSerial; // 올린 유니폼 값이 아직 맞는 판 번호. (바뀌면 모든 프로그램의 기억한 값을 잊는다)
	/** @private @type { ShaderProgram | null } */ #slotTableProgram; // 마지막으로 찾은 유니폼 칸 표의 프로그램. (같은 프로그램이 이어지면 표를 다시 찾지 않는다)
	/** @private @type { Map<string, object> | null } */ #slotTable;
	/** @private @type { number } */ #trustSerial; // 그리기 줄이 꼴을 고치지 않는다고 맡긴 판 번호. (beginTrustedOptions 마다 오른다)
	/** @private @type { boolean } */ #isTrusting; // 지금 맡긴 판인지. (맡긴 판에서 한 번 견준 꼴은 다시 견주지 않는다)
	/** @private @type { WeakMap<object, object> } */ #drawEntryOfOptions; // 그리기 꼴 객체 → { keys, values, numbers (얕은 사본), state (푼 칸), materialBlock, outlineBlock, outlineStates }
	/** @private @type { number } */ #drawEntryGeneration; // 블록 갈래를 지운 판 번호. (그리기 줄의 칸과 ToonDrawItem 이 쥔 기억 칸의 블록이 지운 것을 가리키지 않게, clearBlockCache 마다 오른다)
	/** @private @type { object | null } */ #hintOptions; // 그리기 줄이 지금 그리는 담은 칸의 꼴 객체. (readDrawEntry 가 #hintEntry 를 바로 쓴다, 맡긴 판에서만)
	/** @private @type { object | null } */ #hintEntry; // 그 칸이 푼 기억 칸.
	/** @private @type { Float32Array } */ #batchModelElements; // drawMeshBatch 의 첫 인스턴스 행렬 칸. (다시 쓴다)
	/** @private @type { object } */ #materialBlocks; // 몸의 재질 블록 갈래. (createBlockCache)
	/** @private @type { object } */ #outlineBlocks; // 바깥선 껍데기의 블록 갈래.
	/** @private @type { object | null } */ #lastProgramKey; // 마지막으로 찾은 프로그램 셋의 머티리얼과 인스턴스 꼴. ({ material, instanceLayout, programSet })
	/** @private @type { string } */ #colorSpace; // 색 공간. (ColorSpace, 생성 때 정함, 프로그램의 정의와 색 텍스처 형식을 가른다)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext - 그릴 WebGL2 렌더링 컨텍스트.
	 * @param { object | null } [options] - { colorSpace (ColorSpace, 기본은 엔진의 색 공간 EngineConfiguration.colorSpace, 엔진이 없으면 gamma) }
	 */
	constructor(webGL2RenderingContext, options = null) {
		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#colorSpace = options !== null && options.colorSpace !== undefined ? readColorSpace(options.colorSpace) : readEngineColorSpace();
		this.#stateCache = WebGLStateCache.attach(webGL2RenderingContext);
		this.#uniformSlotTable = new System.WeakMap();
		this.#uniformSerial = 1;
		this.#slotTableProgram = null;
		this.#slotTable = null;
		this.#drawEntryOfOptions = new System.WeakMap();
		this.#drawEntryGeneration = 1;
		this.#hintOptions = null;
		this.#hintEntry = null;
		this.#batchModelElements = new System.Float32Array(16);
		this.#trustSerial = 1;
		this.#isTrusting = false;
		this.#materialBlocks = createBlockCache(MATERIAL_BLOCK_BINDING, MATERIAL_BLOCK_FLOAT_COUNT);
		this.#outlineBlocks = createBlockCache(OUTLINE_BLOCK_BINDING, OUTLINE_BLOCK_FLOAT_COUNT);
		this.#lastProgramKey = null;
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
		this.#ambientOcclusionInput = null;
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
		this.#batchSlots = [];
		this.#shadowBatchSlots = [];
		const offsetAlignment = webGL2RenderingContext.getParameter(webGL2RenderingContext.UNIFORM_BUFFER_OFFSET_ALIGNMENT);
		this.#frameBlocks = createFrameRing(typeof offsetAlignment === "number" && offsetAlignment > 0 ? offsetAlignment : 256);
		this.#frameBlock = null;
		this.#frameBlockOffset = 0;
		this.#frameBlockSerial = 0;
		this.#frameNumber = 0;
	}

	//==============================================================================
	// 셰이더 소스 반환. (ShaderWarmer 로 미리 링크할 때, 머티리얼과 인스턴스 꼴이 없으면 기본 프로그램)
	//==============================================================================
	/**
	 * @static
	 * @param { ToonMaterial | null } [material] - 셰이더 조각을 끼울 머티리얼. (기본 null)
	 * @param { ToonInstanceLayout | null } [instanceLayout] - 인스턴스 꼴. (기본 null)
	 * @param { boolean } [isAmbientOcclusion] - 모서리 어둠을 켠 프레임의 몸 프로그램인지. (기본 false, setAmbientOcclusionTexture 로 텍스처를 건 프레임은 이 몸 프로그램을 쓴다)
	 * @param { string } [colorSpace] - 색 공간. (ColorSpace, 기본은 엔진의 색 공간, 렌더러가 짓는 것과 같은 값을 준다)
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
	static readProgramSources(material = null, instanceLayout = null, isAmbientOcclusion = false, colorSpace = readEngineColorSpace()) {
		const sources = composeToonProgramSources(material, instanceLayout, isAmbientOcclusion, colorSpace);
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
	 * @param { object | null } [baseProgramSet] - 모서리 어둠 몸 프로그램만 짓고 바깥선과 그림자 깊이는 이 칸의 것을 같이 쓸 때. (기본 null)
	 * @returns { object } 세 프로그램 칸. ({ solid, outline, depth } 마다 { program, kind, frameSerial, lightSet, lightVersion }, 같이 쓰면 isAmbientOcclusion true)
	 * @private
	 */
	createProgramSet(material, instanceLayout, baseProgramSet = null) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const sources = composeToonProgramSources(material, instanceLayout, baseProgramSet !== null, this.#colorSpace);
		const programList = [];
		try {
			programList.push(new ShaderProgram(webGL2RenderingContext, sources.solidVertexShader, sources.solidFragmentShader, sources.attributeLocationTable));
			if (baseProgramSet === null) {
				programList.push(new ShaderProgram(webGL2RenderingContext, sources.outlineVertexShader, sources.outlineFragmentShader, sources.attributeLocationTable));
				programList.push(new ShaderProgram(webGL2RenderingContext, sources.depthVertexShader, sources.depthFragmentShader, sources.attributeLocationTable));
			}
		}
		catch (error) {
			for (const shaderProgram of programList) {
				webGL2RenderingContext.deleteProgram(shaderProgram.getProgram());
			}
			throw error;
		}
		const solidProgram = programList[0];
		const previousProgram = webGL2RenderingContext.getParameter(webGL2RenderingContext.CURRENT_PROGRAM);
		solidProgram.useProgram();
		webGL2RenderingContext.uniform1i(solidProgram.getUniformLocation("shadowTexture"), SHADOW_TEXTURE_UNIT);
		webGL2RenderingContext.uniform1i(solidProgram.getUniformLocation("baseColorTexture"), BASE_COLOR_TEXTURE_UNIT);
		webGL2RenderingContext.uniform1i(solidProgram.getUniformLocation("emissiveTexture"), EMISSIVE_TEXTURE_UNIT);
		webGL2RenderingContext.uniform1i(solidProgram.getUniformLocation("decalTexture"), DECAL_TEXTURE_UNIT);
		webGL2RenderingContext.uniform1i(solidProgram.getUniformLocation("rampTexture"), RAMP_TEXTURE_UNIT);
		webGL2RenderingContext.uniform1i(solidProgram.getUniformLocation("matcapTexture"), MATCAP_TEXTURE_UNIT);
		webGL2RenderingContext.uniform1i(solidProgram.getUniformLocation("localShadowTexture"), LOCAL_SHADOW_TEXTURE_UNIT);
		webGL2RenderingContext.uniform1i(solidProgram.getUniformLocation("angelRingTexture"), ANGEL_RING_TEXTURE_UNIT);
		if (baseProgramSet !== null) {
			webGL2RenderingContext.uniform1i(solidProgram.getUniformLocation("ambientOcclusionTexture"), AMBIENT_OCCLUSION_TEXTURE_UNIT);
		}
		const bindBlock = (shaderProgram, blockName, binding) => {
			const blockIndex = webGL2RenderingContext.getUniformBlockIndex(shaderProgram.getProgram(), blockName);
			if (blockIndex !== webGL2RenderingContext.INVALID_INDEX) {
				webGL2RenderingContext.uniformBlockBinding(shaderProgram.getProgram(), blockIndex, binding);
			}
		};
		bindBlock(solidProgram, MATERIAL_BLOCK_NAME, MATERIAL_BLOCK_BINDING);
		for (const shaderProgram of programList) {
			bindBlock(shaderProgram, FRAME_BLOCK_NAME, FRAME_BLOCK_BINDING);
		}
		const createEntry = (shaderProgram, kind) => {
			return { program: shaderProgram, kind: kind, lightSet: null, lightVersion: -1 };
		};
		if (baseProgramSet !== null) {
			webGL2RenderingContext.useProgram(previousProgram);
			return { solid: createEntry(solidProgram, ToonProgramKind.solid), outline: baseProgramSet.outline, depth: baseProgramSet.depth, isAmbientOcclusion: true };
		}
		bindBlock(programList[1], OUTLINE_BLOCK_NAME, OUTLINE_BLOCK_BINDING);
		webGL2RenderingContext.useProgram(previousProgram);
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
		return this.readProgramSetVariant(material, instanceLayout, this.#ambientOcclusionInput !== null);
	}

	//==============================================================================
	// 머티리얼과 인스턴스 꼴과 모서리 어둠 변형의 프로그램 반환. (readProgramSet 이 부른다)
	//==============================================================================
	/**
	 * @param { ToonMaterial | null } material - 머티리얼. (null 이면 빈 조각)
	 * @param { ToonInstanceLayout | null } instanceLayout - 인스턴스 꼴. (null 이면 없음)
	 * @param { boolean } isAmbientOcclusion - 모서리 어둠 몸 프로그램인지.
	 * @returns { object | null } { solid, outline, depth } 프로그램 칸. (짓지 못했으면 null)
	 * @private
	 */
	readProgramSetVariant(material, instanceLayout, isAmbientOcclusion) {
		if (material === null && instanceLayout === null && !isAmbientOcclusion) {
			return this.#defaultProgramSet;
		}
		// 정렬한 그리기 줄은 같은 머티리얼이 이어진다. 마지막에 찾은 것이면 열쇠 글을 짓지 않는다.
		const lastProgramKey = this.#lastProgramKey;
		if (lastProgramKey !== null && lastProgramKey.material === material && lastProgramKey.instanceLayout === instanceLayout && lastProgramKey.isAmbientOcclusion === isAmbientOcclusion) {
			return lastProgramKey.programSet;
		}
		const baseKey = `${material !== null ? material.getId() : 0}/${instanceLayout !== null ? instanceLayout.getId() : 0}`;
		const key = isAmbientOcclusion ? `${baseKey}/ao` : baseKey;
		if (this.#programSets.has(key)) {
			const programSet = this.#programSets.get(key);
			this.#lastProgramKey = { material: material, instanceLayout: instanceLayout, isAmbientOcclusion: isAmbientOcclusion, programSet: programSet };
			return programSet;
		}
		// 모서리 어둠 몸 프로그램은 바깥선과 그림자 깊이를 기본 칸과 같이 쓴다. 짓지 못하면 (머티리얼 텍스처가 조각 셰이더 유닛을 다 쓴 기기 같은) 모서리 어둠 없이 기본 칸으로 그린다.
		let baseProgramSet = null;
		if (isAmbientOcclusion) {
			baseProgramSet = this.readProgramSetVariant(material, instanceLayout, false);
			if (baseProgramSet === null) {
				// 컨텍스트를 잃은 탓이면 기억하지 않는다. (되살린 뒤 다시 짓는다)
				if (!this.getWebGL2RenderingContext().isContextLost()) {
					this.#programSets.set(key, null);
				}
				return null;
			}
		}
		let programSet = null;
		try {
			programSet = this.createProgramSet(material, instanceLayout, baseProgramSet);
		}
		catch (error) {
			const name = material !== null && material.getName() !== "" ? material.getName() : key;
			System.console.error(`ToonRenderer: 머티리얼 ${name} 의 셰이더를 짓지 못했습니다.`, error);
			// 셰이더 탓이면 게임에 한 번 알리고 기억한다. 컨텍스트를 잃은 탓이면 알리지도 기억하지도 않고, 되살린 뒤 다시 짓는다.
			if (!reportShaderBuildFailure(this.getWebGL2RenderingContext(), `ToonRenderer.${name}`, error)) {
				return null;
			}
			if (baseProgramSet !== null) {
				programSet = { solid: baseProgramSet.solid, outline: baseProgramSet.outline, depth: baseProgramSet.depth, isAmbientOcclusion: true, isShared: true };
			}
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
		this.#lastProgramKey = null;
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
		// 모서리 어둠 칸은 몸만 제 것이다. (바깥선과 그림자 깊이는 기본 칸이 지운다, 짓지 못해 기본 칸을 빌린 것은 몸도 빌린 것)
		if (programSet.isAmbientOcclusion === true) {
			if (programSet.isShared !== true) {
				webGL2RenderingContext.deleteProgram(programSet.solid.program.getProgram());
			}
			return;
		}
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
	 * @returns { object } 인스턴스 버퍼. ({ layout, buffer, usage, floatCount, vertexArrays, generation, bounds, data, renderer })
	 * generation 은 고치거나 지울 때마다 1 씩 는다. (그림자 캐시가 버퍼 바뀜을 안다) bounds 는 버퍼 전체의 경계다. (꼴에 행렬이 있을 때만, 아니면 null)
	 * data 는 경계를 다시 셀 사본이다. (행렬이 있을 때만, 고치지 않는다) 그리는 길(drawMeshInstanceBuffer, ToonScreenOutline.drawMeshInstanceBuffer, ToonDrawQueue.addMeshInstanceBuffer)이 모두 이 한 GPU 버퍼를 같이 쓰고 다시 올리지 않는다.
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
		const copy = instanceLayout.hasMatrix() ? new System.Float32Array(data) : null;
		return { layout: instanceLayout, buffer: buffer, usage: glUsage, floatCount: data.length, vertexArrays: new Map(), generation: 0, bounds: readInstanceBounds(instanceLayout, data), data: copy, renderer: this };
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
		instanceBuffer.data = instanceBuffer.layout.hasMatrix() ? new System.Float32Array(data) : null;
		instanceBuffer.bounds = readInstanceBounds(instanceBuffer.layout, data);
		instanceBuffer.generation += 1;
	}

	//==============================================================================
	// 인스턴스 버퍼의 일부 고치기. (firstInstance 번째부터 data 의 인스턴스 수만큼만 올림, bufferSubData)
	//==============================================================================
	/**
	 * @param { object } instanceBuffer - createInstanceBuffer 의 결과.
	 * @param { number } firstInstance - 고칠 첫 인스턴스 번호. (0 부터)
	 * @param { Float32Array } data - 꼴의 수 개수씩 고칠 인스턴스를 이어 담은 수. (버퍼에 든 인스턴스 수를 넘으면 던진다, 늘리려면 updateInstanceBuffer)
	 * @example <caption>바위 하나만 옮기고 다시 올리지 않고 그리기</caption>
	 * import { ToonRenderer, MeshBuilder, createOctahedronGeometry, Matrix4, Vector3 } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * const builder = new MeshBuilder();
	 * builder.addPart(createOctahedronGeometry(0.3), Matrix4.createIdentity(), "#909098");
	 * const rockMesh = renderer.createMesh(builder.readArrays());
	 * const instanceLayout = renderer.createInstanceLayout([{ name: "instanceMatrix", size: 16 }, { name: "instanceTint", size: 4 }]);
	 * const data = new Float32Array(20 * 3);
	 * for (let index = 0; index < 3; ++index) {
	 * 	data.set(Matrix4.createTranslation(index - 1, 0, 0).getElements(), index * 20);
	 * 	data.set([1, 1, 1, 1], index * 20 + 16);
	 * }
	 * const instanceBuffer = renderer.createInstanceBuffer(instanceLayout, data, "dynamic");
	 * const moved = new Float32Array(20);
	 * moved.set(Matrix4.createTranslation(0, 0.5, 0).getElements(), 0);
	 * moved.set([1, 0.6, 0.6, 1], 16);
	 * renderer.updateInstanceBufferRange(instanceBuffer, 1, moved);
	 * renderer.beginFrameWithMatrices(Matrix4.createLookAt(Vector3.create(0, 2, 4), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0)), Matrix4.createPerspective(0.8, 1, 0.1, 30));
	 * renderer.drawMeshInstanceBuffer(rockMesh, instanceBuffer, 3);
	 * renderer.endFrame();
	 * if (instanceBuffer.generation !== 1) {
	 * 	throw new Error("generation failed");
	 * }
	 */
	updateInstanceBufferRange(instanceBuffer, firstInstance, data) {
		const layoutFloatCount = instanceBuffer.layout.getFloatCount();
		const floatOffset = firstInstance * layoutFloatCount;
		if (!System.Number.isInteger(firstInstance) || firstInstance < 0 || data.length % layoutFloatCount !== 0 || floatOffset + data.length > instanceBuffer.floatCount) {
			throw new System.Error(`인스턴스 버퍼의 고칠 자리가 맞지 않습니다: ${firstInstance} 번부터 수 ${data.length} 개 (버퍼의 수 ${instanceBuffer.floatCount} 개)`);
		}
		if (data.length === 0) {
			return;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, instanceBuffer.buffer);
		webGL2RenderingContext.bufferSubData(webGL2RenderingContext.ARRAY_BUFFER, floatOffset * 4, data);
		if (instanceBuffer.data !== null) {
			instanceBuffer.data.set(data, floatOffset);
			instanceBuffer.bounds = readInstanceBounds(instanceBuffer.layout, instanceBuffer.data);
		}
		instanceBuffer.generation += 1;
	}

	//==============================================================================
	// 인스턴스 버퍼 지우기. (그 버퍼로 지은 버텍스 어레이도, 모형보다 먼저 지운다, 지운 버퍼로 그리면 아무것도 그리지 않는다)
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
		instanceBuffer.buffer = null;
		instanceBuffer.floatCount = 0;
		instanceBuffer.data = null;
		instanceBuffer.bounds = null;
		instanceBuffer.generation += 1;
	}

	//==============================================================================
	// 텍스처 짓기. (ImageBitmap, 캔버스, 이미지, ImageData 나 { width, height, data: Uint8Array RGBA })
	// - 선형 색 공간(ColorSpace.linear)이면 색 텍스처(바탕색, 빛남, 데칼, 매트캡, 천사 고리, 램프)를 sRGB 형식(SRGB8_ALPHA8)으로 올린다.
	//   GPU 가 읽을 때 선형으로 풀어 거르기와 밉맵이 선형 공간에서 일어나고, 셰이더는 받은 값을 선형 색으로 그대로 쓴다. (유니티, 언리얼의 sRGB 텍스처와 같음)
	//   노멀, 마스크, 번호 같은 자료 텍스처는 isColorData: false 로 RGBA8 에 그대로 올린다. (머티리얼 조각이 읽는 자료)
	// - 감마 색 공간(기본)은 isColorData 와 상관없이 RGBA 로 올리고 셰이더가 색 텍스처를 pow 2.2 로 선형으로 바꾼다. (지금까지와 같음)
	//==============================================================================
	/**
	 * @param { object } source - ImageBitmap, 캔버스, 이미지, ImageData 나 { width, height, data }.
	 * @param { object } [options] - { isMipmapped (기본 true), isRepeated (기본 true, false 면 가장자리 붙임), isFiltered (기본 true, false 면 가까운 화소), isColorData (기본 true 면 색, false 면 노멀이나 마스크 같은 자료, 선형 색 공간에서만 가른다) }
	 * @returns { WebGLTexture } 지은 RGBA 텍스처.
	 * @example <caption>캔버스에 그린 무늬를 바탕색 텍스처로 쓰기</caption>
	 * import { ToonRenderer, MeshBuilder, createBoxGeometry, Matrix4, Vector3 } from "./vanilla.js";
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
	 * const builder = new MeshBuilder();
	 * builder.addPart(createBoxGeometry(1, 1, 1), Matrix4.createIdentity(), "#ffffff", { hasOutline: true });
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
		// 선형 색 공간의 색 텍스처는 sRGB 형식으로 올려 GPU 가 선형으로 풀어 읽게 한다. (감마 색 공간은 지금까지처럼 RGBA)
		let internalFormat = webGL2RenderingContext.RGBA;
		if (this.#colorSpace === ColorSpace.linear) {
			internalFormat = options.isColorData !== false ? webGL2RenderingContext.SRGB8_ALPHA8 : webGL2RenderingContext.RGBA8;
		}
		const texture = webGL2RenderingContext.createTexture();
		const isPremultiplied = webGL2RenderingContext.getParameter(webGL2RenderingContext.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
		const isFlipped = webGL2RenderingContext.getParameter(webGL2RenderingContext.UNPACK_FLIP_Y_WEBGL);
		webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
		webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_FLIP_Y_WEBGL, false);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + BASE_COLOR_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, texture);
		if (System.ArrayBuffer.isView(source.data) && typeof source.width === "number" && typeof source.height === "number") {
			webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, internalFormat, source.width, source.height, 0, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, new System.Uint8Array(source.data.buffer, source.data.byteOffset, source.data.byteLength));
		}
		else {
			webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, internalFormat, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, source);
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
	// 모형 올리기. (MeshBuilder.readArrays 나 readGlbArrays 의 결과, 몸이 비면 null)
	//==============================================================================
	/**
	 * @param { object } arrays - MeshBuilder.readArrays 나 readGlbArrays 의 결과.
	 * @returns { object | null } GPU 에 올린 모형. (몸의 꼭짓점 번호가 비면 null)
	 * @example <caption>부품 둘을 한 모형으로 올리고 다 쓰면 지우기</caption>
	 * import { ToonRenderer, MeshBuilder, createBoxGeometry, createSphereGeometry, Matrix4 } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * const builder = new MeshBuilder();
	 * builder.addPart(createBoxGeometry(0.8, 1, 0.5), Matrix4.createTranslation(0, 0.5, 0), "#6080c0", { hasOutline: true });
	 * builder.addPart(createSphereGeometry(0.3, 20, 14), Matrix4.createTranslation(0, 1.3, 0), "#f0d0b0", { hasOutline: true });
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
		attachBodyAttributes(this.getWebGL2RenderingContext(), mesh);
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
		attachSkinAttributes(this.getWebGL2RenderingContext(), skinBuffer);
	}

	//==============================================================================
	// 인스턴스 버퍼를 지금 묶인 버텍스 어레이의 인스턴스 어트리뷰트로. (행렬 네 줄, 틴트, 인스턴스마다 하나씩)
	//==============================================================================
	/**
	 * @param { WebGLBuffer } instanceBuffer - 인스턴스마다 행렬 16 과 틴트 4 를 담은 버퍼.
	 * @private
	 */
	attachInstanceAttributes(instanceBuffer) {
		attachInstanceAttributes(this.getWebGL2RenderingContext(), instanceBuffer);
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
		this.#lastProgramKey = null;
		this.clearBlockCache(this.#materialBlocks);
		this.clearBlockCache(this.#outlineBlocks);
		webGL2RenderingContext.deleteTexture(this.#emptyShadowTexture);
		webGL2RenderingContext.deleteTexture(this.#whiteTexture);
		for (const page of this.#frameBlocks.pages) {
			webGL2RenderingContext.deleteBuffer(page.buffer);
		}
		this.#frameBlocks.pages.length = 0;
		this.#frameBlocks.writePage = null;
		this.#frameBlocks.boundBuffer = null;
		this.#frameBlock = null;
		for (const slot of this.#batchSlots.concat(this.#shadowBatchSlots)) {
			this.deleteBatchVertexArrays(slot, null);
			webGL2RenderingContext.deleteBuffer(slot.buffer);
		}
		this.#batchSlots.length = 0;
		this.#shadowBatchSlots.length = 0;
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
		for (const slot of this.#batchSlots.concat(this.#shadowBatchSlots)) {
			this.deleteBatchVertexArrays(slot, mesh);
		}
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
	// 유닛 0 에 묶인 텍스처 읽기. (지금 고른 유닛은 그대로 둔다, 이미 유닛 0 이면 고르지 않는다)
	//==============================================================================
	/**
	 * @returns { WebGLTexture | null } 유닛 0 의 텍스처. (없으면 null)
	 * @private
	 */
	readFirstUnitTexture() {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const activeTexture = webGL2RenderingContext.getParameter(webGL2RenderingContext.ACTIVE_TEXTURE);
		if (activeTexture === webGL2RenderingContext.TEXTURE0) {
			return webGL2RenderingContext.getParameter(webGL2RenderingContext.TEXTURE_BINDING_2D);
		}
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
		this.forgetAllUniformValues();
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
		// 유닛 0 의 묶음과 고른 유닛. (상태 캐시가 이미 그렇다고 기억하면 건너뛴다)
		this.bindTexture2D(0, savedState.firstUnitTexture);
		this.applyActiveTexture(savedState.activeTexture);
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
		this.forgetAllUniformValues();
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
		this.#frameNumber += 1;
		this.saveState();
		this.applyScreenRect();
		this.applyFrameState();
		const ambientOcclusionInput = this.#ambientOcclusionInput;
		if (ambientOcclusionInput !== null) {
			const webGL2RenderingContext = this.getWebGL2RenderingContext();
			const viewport = webGL2RenderingContext.getParameter(webGL2RenderingContext.VIEWPORT);
			ambientOcclusionInput.origin = [viewport[0], viewport[1]];
		}
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
	 * import { ToonRenderer, MeshBuilder, createCylinderGeometry, Camera3D, Matrix4, Vector3 } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * const builder = new MeshBuilder();
	 * builder.addPart(createCylinderGeometry(0.4, 0.4, 1, 24), Matrix4.createIdentity(), "#c0a0e0", { hasOutline: true });
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
	 * import { ToonRenderer, MeshBuilder, createOctahedronGeometry, Matrix4, Vector3 } from "./vanilla.js";
	 * const canvas = document.createElement("canvas");
	 * canvas.width = 320;
	 * canvas.height = 240;
	 * const renderer = new ToonRenderer(canvas.getContext("webgl2"));
	 * const builder = new MeshBuilder();
	 * builder.addPart(createOctahedronGeometry(0.6), Matrix4.createIdentity(), "#60c0a0", { hasOutline: true });
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
	 * import { ToonRenderer, MeshBuilder, createBoxGeometry, ShadowMap, Matrix4, Vector3 } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const renderer = new ToonRenderer(webGL2RenderingContext);
	 * const builder = new MeshBuilder();
	 * builder.addPart(createBoxGeometry(0.6, 0.6, 0.6), Matrix4.createTranslation(0, 0.6, 0), "#e0b080", { hasOutline: true });
	 * builder.addPart(createBoxGeometry(4, 0.1, 4), Matrix4.createTranslation(0, -0.05, 0), "#a0b0a0", { hasOutline: false });
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
		this.forgetAllUniformValues();
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
	 * import { ToonRenderer, MeshBuilder, createBoxGeometry, ShadowAtlas, Matrix4 } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const renderer = new ToonRenderer(webGL2RenderingContext);
	 * const builder = new MeshBuilder();
	 * builder.addPart(createBoxGeometry(1, 1, 1), Matrix4.createTranslation(0, 0.5, 0), "#c0a080", { hasOutline: false });
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
		this.forgetAllUniformValues();
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
		const frustumPlanes = this.#frustumPlanes;
		for (let planeIndex = 0; planeIndex < frustumPlanes.length; ++planeIndex) {
			const plane = frustumPlanes[planeIndex];
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
	 * import { ToonRenderer, MeshBuilder, createRoundedBoxGeometry, Matrix4, Vector3 } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * const builder = new MeshBuilder();
	 * builder.addPart(createRoundedBoxGeometry(0.8, 0.8, 0.8, 4, 0.1), Matrix4.createIdentity(), "#e0e0e0", { hasOutline: true });
	 * const mesh = renderer.createMesh(builder.readArrays());
	 * renderer.beginFrameWithMatrices(Matrix4.createLookAt(Vector3.create(0, 1.5, 4), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0)), Matrix4.createPerspective(0.8, 1, 0.1, 20));
	 * renderer.drawMesh(mesh, Matrix4.createTranslation(-1, 0, 0), { tintColor: [1, 0.6, 0.6, 1], outlineColor: [0.4, 0.05, 0.05, 1], outlineWidthScale: 1.5 });
	 * renderer.drawMesh(mesh, Matrix4.createTranslation(0, 0, 0), { tintColor: [1, 0.2, 0.2, 1], tintAmount: 0.7, shadeOffset: 0.2 });
	 * renderer.drawMesh(mesh, Matrix4.createTranslation(1, 0, 0), { alpha: 0.5, softEdge: 1.5, hasOutline: false });
	 * renderer.endFrame();
	 */
	drawMesh(mesh, modelMatrix, options = EMPTY_OPTIONS) {
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
	 * @param { Array<object> } instances - { modelMatrix: Matrix4, tintColor: [r, g, b, a], emissiveColor: [r, g, b], emissiveIntensity: number } 의 배열.
	 * 틴트는 곱하는 sRGB 와 알파(기본 1), emissiveColor 는 그 인스턴스에 더하는 빛남 sRGB(기본 없음, 명암과 무늬 위에 더해 그 인스턴스만 밝힘), emissiveIntensity 는 빛남의 선형 배(기본 1).
	 * 모형 행렬은 아핀으로 읽는다. (TOON_INSTANCE_FLOAT_COUNT 머리말)
	 * @param { object } [options] - drawMesh 와 같다. (모든 인스턴스에 같게 건다)
	 * @example <caption>같은 바위 스무 개를 인스턴스마다 다른 틴트로</caption>
	 * import { ToonRenderer, MeshBuilder, createOctahedronGeometry, Matrix4, Vector3 } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * const builder = new MeshBuilder();
	 * builder.addPart(createOctahedronGeometry(0.3), Matrix4.createIdentity(), "#909098", { hasOutline: true });
	 * const rockMesh = renderer.createMesh(builder.readArrays());
	 * const instances = [];
	 * for (let index = 0; index < 20; ++index) {
	 * 	const shade = 0.7 + (index % 4) * 0.1;
	 * 	instances.push({ modelMatrix: Matrix4.createTranslation(index % 5 - 2, 0, Math.floor(index / 5) - 2), tintColor: [shade, shade, shade, 1] });
	 * }
	 * renderer.beginFrameWithMatrices(Matrix4.createLookAt(Vector3.create(0, 4, 6), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0)), Matrix4.createPerspective(0.8, 1, 0.1, 30));
	 * renderer.drawMeshInstanced(rockMesh, instances, { specularScale: 0 });
	 * renderer.endFrame();
	 * @example <caption>인스턴스 하나만 빛남을 더해 밝히기</caption>
	 * import { ToonRenderer, MeshBuilder, createOctahedronGeometry, Matrix4, Vector3 } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * const builder = new MeshBuilder();
	 * builder.addPart(createOctahedronGeometry(0.3), Matrix4.createIdentity(), "#909098", { hasOutline: true });
	 * const rockMesh = renderer.createMesh(builder.readArrays());
	 * const instances = [0, 1, 2].map((index) => ({ modelMatrix: Matrix4.createTranslation(index - 1, 0, 0) }));
	 * instances[1].emissiveColor = [1, 0.85, 0.3];
	 * instances[1].emissiveIntensity = 0.35;
	 * renderer.beginFrameWithMatrices(Matrix4.createLookAt(Vector3.create(0, 2, 3), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0)), Matrix4.createPerspective(0.8, 1, 0.1, 30));
	 * renderer.drawMeshInstanced(rockMesh, instances);
	 * renderer.endFrame();
	 */
	drawMeshInstanced(mesh, instances, options = EMPTY_OPTIONS) {
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
			const emissiveColor = instance.emissiveColor !== undefined ? instance.emissiveColor : null;
			instanceData[offset + 3] = emissiveColor !== null ? emissiveColor[0] : 0;
			instanceData[offset + 7] = emissiveColor !== null ? emissiveColor[1] : 0;
			instanceData[offset + 11] = emissiveColor !== null ? emissiveColor[2] : 0;
			instanceData[offset + 15] = emissiveColor !== null && instance.emissiveIntensity !== undefined ? instance.emissiveIntensity : 1;
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
	// 영구 인스턴스 버퍼로 그리기. (버퍼 전체의 경계로 통째 거른다, instanceCount 개, 꼴에 행렬이 없으면 정점 조각이 자리를 정하고 거르지 않는다)
	//==============================================================================
	/**
	 * @param { object } mesh - createMesh 의 결과.
	 * @param { object } instanceBuffer - createInstanceBuffer 의 결과.
	 * @param { number } instanceCount - 그릴 인스턴스 수. (버퍼에 든 수를 넘으면 자른다)
	 * @param { object } [options] - drawMesh 와 같다. (material 의 정점 조각이 사용자 어트리뷰트를 읽는다, isCulled 가 false 면 거르지 않는다)
	 * @example <caption>자리만 담은 영구 버퍼로 풀숲 그리기</caption>
	 * import { ToonRenderer, MeshBuilder, createCylinderGeometry, Matrix4, Vector3 } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * const builder = new MeshBuilder();
	 * builder.addPart(createCylinderGeometry(0.02, 0.15, 0.6, 6), Matrix4.createTranslation(0, 0.3, 0), "#60a050", { hasOutline: true });
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
	drawMeshInstanceBuffer(mesh, instanceBuffer, instanceCount, options = EMPTY_OPTIONS) {
		if (mesh === null || instanceCount <= 0) {
			return;
		}
		const maximumCount = System.Math.floor(instanceBuffer.floatCount / System.Math.max(1, instanceBuffer.layout.getFloatCount()));
		const count = System.Math.min(instanceCount, maximumCount);
		if (count <= 0) {
			return;
		}
		if (options.isCulled !== false && writeInstanceBufferSphere(INSTANCE_BUFFER_SPHERE, mesh, instanceBuffer) && !isSphereInFrustum(this.#frustumPlanes, INSTANCE_BUFFER_SPHERE)) {
			this.#frameStatistics.culledObjectCount += count;
			return;
		}
		this.#frameStatistics.drawnObjectCount += count;
		this.drawWithCount(mesh, IDENTITY_ELEMENTS, count, options, instanceBuffer);
	}

	//==============================================================================
	// 모형 하나의 바깥선만 그리기. (거르지도 세지도 않는다, 껍데기가 없거나 hasOutline 이 false 면 그리지 않는다)
	//==============================================================================
	/**
	 * @param { object } mesh - createMesh 의 결과.
	 * @param { Matrix4 } modelMatrix - 모형 행렬.
	 * @param { object } [options] - drawMesh 와 같다.
	 */
	drawMeshOutline(mesh, modelMatrix, options = EMPTY_OPTIONS) {
		if (mesh === null || mesh.outlineVertexArray === null || options.hasOutline === false || this.#isShadowPass) {
			return;
		}
		this.drawWithCount(mesh, modelMatrix.getElements(), 0, options, null, DRAW_PART_OUTLINE);
	}

	//==============================================================================
	// 모형 하나의 몸만 그리기. (바깥선 껍데기 없이, 거르지 않고 그린 수만 센다, 그리기 줄이 거른 뒤 부른다)
	//==============================================================================
	/**
	 * @param { object } mesh - createMesh 의 결과.
	 * @param { Matrix4 } modelMatrix - 모형 행렬.
	 * @param { object } [options] - drawMesh 와 같다.
	 * @private
	 */
	drawMeshBody(mesh, modelMatrix, options = EMPTY_OPTIONS) {
		if (mesh === null) {
			return;
		}
		this.#frameStatistics.drawnObjectCount += 1;
		this.drawWithCount(mesh, modelMatrix.getElements(), 0, options, null, DRAW_PART_BODY);
	}

	//==============================================================================
	// 꼴의 재질 블록 읽기. (값이 같은 꼴은 같은 블록, 그리기 줄이 정렬과 자동 인스턴싱의 열쇠로 쓴다)
	//==============================================================================
	/**
	 * @param { object } options - 그리기 꼴.
	 * @returns { object } 재질 블록. (값이 같으면 같은 객체)
	 * @private
	 */
	readMaterialBlock(options) {
		return this.readEntryMaterialBlock(this.readDrawEntry(options), options);
	}

	//==============================================================================
	// 기억 칸의 재질 블록 읽기. (readMaterialBlock 과 같다, 그리기 줄이 이미 푼 기억 칸으로)
	//==============================================================================
	/**
	 * @param { object } drawEntry - readDrawEntry 나 writeHeldDrawEntry 의 결과.
	 * @param { object } options - 그 칸을 푼 꼴.
	 * @returns { object } 재질 블록.
	 * @private
	 */
	readEntryMaterialBlock(drawEntry, options) {
		if (drawEntry.materialBlock === null || drawEntry.materialBlock.buffer === null) {
			writeMaterialBlockValues(this.#materialBlocks.values, options);
			drawEntry.materialBlock = this.readUniformBlock(this.#materialBlocks);
		}
		return drawEntry.materialBlock;
	}

	//==============================================================================
	// 같은 모형과 꼴의 여럿을 인스턴스 그리기 한 번으로. (그리기 줄의 자동 인스턴싱, 유니티 GPU 인스턴싱과 언리얼 auto-instancing 꼴, 거른 뒤 부른다)
	// - 행렬을 묶음 자리의 인스턴스 버퍼에 담고 drawElementsInstanced 하나로 그린다. 틴트는 1, 빛남은 0 이라 그리기마다 그린 것과 화면이 같다.
	//   (instanced 1 은 보통 그리기와 같은 프로그램의 같은 셈이고 모형 행렬만 어트리뷰트에서 읽는다, 행렬은 아핀)
	// - 묶음 자리(slot)는 그리기 줄이 프레임마다 같은 차례로 준다. 자리의 값이 앞과 같으면 다시 올리지 않는다. (몸과 바깥선 껍데기가 같은 자리, 움직이지 않는 것은 올림 없음)
	// - 감기는 첫 행렬로 가린다. (그리기 줄이 감기가 같은 것만 묶는다)
	//==============================================================================
	/**
	 * @param { object } mesh - createMesh 의 결과.
	 * @param { Array<Matrix4> } modelMatrixList - 모형 행렬 목록.
	 * @param { number } start - 목록에서 그릴 첫 자리.
	 * @param { number } count - 그릴 수.
	 * @param { object } options - 모두에 같은 그리기 꼴. (isSameBatchState 로 견준 것)
	 * @param { number } parts - 그릴 것. (1 바깥선 껍데기, 2 몸, 3 둘 다, 그림자 패스면 깊이)
	 * @param { number } slotIndex - 묶음 자리 번호. (그림자 패스는 따로 센다)
	 * @private
	 */
	drawMeshBatch(mesh, modelMatrixList, start, count, options, parts, slotIndex) {
		if (mesh === null || count <= 0) {
			return;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const floatCount = count * TOON_INSTANCE_FLOAT_COUNT;
		if (this.#instanceData.length < floatCount) {
			this.#instanceData = new System.Float32Array(floatCount);
		}
		const instanceData = this.#instanceData;
		for (let index = 0; index < count; ++index) {
			const offset = index * TOON_INSTANCE_FLOAT_COUNT;
			instanceData.set(modelMatrixList[start + index].getElements(), offset);
			instanceData[offset + 3] = 0;
			instanceData[offset + 7] = 0;
			instanceData[offset + 11] = 0;
			instanceData[offset + 15] = 1;
			instanceData[offset + 16] = 1;
			instanceData[offset + 17] = 1;
			instanceData[offset + 18] = 1;
			instanceData[offset + 19] = 1;
		}
		if ((parts & DRAW_PART_BODY) !== 0) {
			this.#frameStatistics.drawnObjectCount += count;
		}
		const slots = this.#isShadowPass ? this.#shadowBatchSlots : this.#batchSlots;
		let slot = slots[slotIndex];
		if (slot === undefined) {
			slot = { buffer: webGL2RenderingContext.createBuffer(), values: new System.Float32Array(0), count: 0, vertexArrays: new Map() };
			slots[slotIndex] = slot;
		}
		let isSame = slot.count === count;
		if (isSame) {
			const values = slot.values;
			for (let index = 0; index < floatCount; ++index) {
				if (!isSameNumber(values[index], instanceData[index])) {
					isSame = false;
					break;
				}
			}
		}
		if (!isSame) {
			if (slot.values.length < floatCount) {
				slot.values = new System.Float32Array(floatCount);
			}
			const values = slot.values;
			for (let index = 0; index < floatCount; ++index) {
				values[index] = instanceData[index];
			}
			slot.count = count;
			webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, slot.buffer);
			// WebGL2 의 bufferData(대상, 자료, 쓰임, 시작, 수) 로 앞의 floatCount 만 올린다. (subarray 를 짓지 않는다)
			webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, instanceData, webGL2RenderingContext.DYNAMIC_DRAW, 0, floatCount);
		}
		let vertexArrays = slot.vertexArrays.get(mesh);
		if (vertexArrays === undefined) {
			if (slot.vertexArrays.size >= BATCH_SLOT_MESH_LIMIT) {
				this.deleteBatchVertexArrays(slot, null);
			}
			vertexArrays = this.createBatchVertexArrays(mesh, slot.buffer);
			slot.vertexArrays.set(mesh, vertexArrays);
		}
		// 첫 인스턴스의 행렬. (감기와 스킨 없는 그리기의 모형 행렬 칸, 다시 쓰는 칸에 옮긴다)
		const batchElements = this.#batchModelElements;
		for (let index = 0; index < 16; ++index) {
			batchElements[index] = instanceData[index];
		}
		this.drawWithCount(mesh, batchElements, count, options, null, parts, vertexArrays);
	}

	//==============================================================================
	// 모형과 묶음 자리의 버퍼를 함께 묶은 버텍스 어레이 짓기. (모형의 버텍스 어레이와 같은 꼴, 인스턴스 어트리뷰트만 자리의 버퍼에서)
	//==============================================================================
	/**
	 * @param { object } mesh - createMesh 의 결과.
	 * @param { WebGLBuffer } buffer - 묶음 자리의 인스턴스 버퍼. (TOON_INSTANCE_FLOAT_COUNT 걸음)
	 * @returns { object } 몸과 바깥선의 버텍스 어레이. ({ body, outline }, 껍데기가 없으면 outline 은 null)
	 * @private
	 */
	createBatchVertexArrays(mesh, buffer) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const body = webGL2RenderingContext.createVertexArray();
		webGL2RenderingContext.bindVertexArray(body);
		this.attachBodyAttributes(mesh);
		this.attachInstanceAttributes(buffer);
		let outline = null;
		if (mesh.outlineVertexArray !== null) {
			outline = webGL2RenderingContext.createVertexArray();
			webGL2RenderingContext.bindVertexArray(outline);
			this.attachOutlineAttributes(mesh);
			this.attachInstanceAttributes(buffer);
		}
		webGL2RenderingContext.bindVertexArray(null);
		return { body: body, outline: outline };
	}

	//==============================================================================
	// 묶음 자리의 버텍스 어레이 지우기. (mesh 가 null 이면 그 자리의 것 모두)
	//==============================================================================
	/**
	 * @param { object } slot - 묶음 자리.
	 * @param { object | null } mesh - 지울 모형. (null 이면 모두)
	 * @private
	 */
	deleteBatchVertexArrays(slot, mesh) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		for (const [slotMesh, vertexArrays] of slot.vertexArrays) {
			if (mesh !== null && slotMesh !== mesh) {
				continue;
			}
			webGL2RenderingContext.deleteVertexArray(vertexArrays.body);
			if (vertexArrays.outline !== null) {
				webGL2RenderingContext.deleteVertexArray(vertexArrays.outline);
			}
			slot.vertexArrays.delete(slotMesh);
		}
	}

	//==============================================================================
	// 프로그램의 프레임 값 올리기. (보기와 투영, 카메라, HDR, 그림자, 바깥선 거리, 점광 그림자, 모서리 어둠 원점을 프레임 블록 ToonFrame 하나로, 패스마다 한 번 고르고 묶였으면 건너뛴다)
	//==============================================================================
	/**
	 * @param { object } entry - 프로그램 칸. (세 프로그램이 같은 블록을 읽는다)
	 * @private
	 */
	uploadFrameUniforms(entry) {
		// 패스(frameSerial)마다 값을 한 번 써서 같은 값의 칸을 찾거나 고리의 새 칸에 쓴다. (패스마다 다른 칸, GPU 가 읽는 장은 고치지 않는다, 카메라와 빛이 그대로면 올림이 없다, 버퍼를 값마다 짓지 않는다)
		const frameBlocks = this.#frameBlocks;
		if (this.#frameBlockSerial !== this.#frameSerial || this.#frameBlock === null) {
			this.#frameBlockSerial = this.#frameSerial;
			this.writeFrameBlockValues(frameBlocks.values);
			this.selectFrameSlot(frameBlocks);
		}
		const page = this.#frameBlock;
		if (frameBlocks.boundBuffer !== page.buffer || frameBlocks.boundOffset !== this.#frameBlockOffset) {
			const webGL2RenderingContext = this.getWebGL2RenderingContext();
			if (FRAME_RING_SLOT_COUNT === 1) {
				webGL2RenderingContext.bindBufferBase(webGL2RenderingContext.UNIFORM_BUFFER, FRAME_BLOCK_BINDING, page.buffer);
			}
			else {
				webGL2RenderingContext.bindBufferRange(webGL2RenderingContext.UNIFORM_BUFFER, FRAME_BLOCK_BINDING, page.buffer, this.#frameBlockOffset, FRAME_BLOCK_FLOAT_COUNT * 4);
			}
			frameBlocks.boundBuffer = page.buffer;
			frameBlocks.boundOffset = this.#frameBlockOffset;
		}
	}

	//==============================================================================
	// 프레임 블록 칸 고르기. (값이 같은 칸이 있으면 그것, 없으면 이 프레임의 장 다음 칸에 bufferSubData, #frameBlock 과 #frameBlockOffset 에 둔다)
	//==============================================================================
	/**
	 * @param { object } frameRing - createFrameRing 의 결과. (values 에 이번 값을 써 둔 것)
	 * @private
	 */
	selectFrameSlot(frameRing) {
		const bits = frameRing.bits;
		const hash = readMaterialBlockHash(bits);
		const frameNumber = this.#frameNumber;
		const pages = frameRing.pages;
		for (let pageIndex = 0; pageIndex < pages.length; ++pageIndex) {
			const page = pages[pageIndex];
			for (let slot = 0; slot < page.count; ++slot) {
				if (page.hashes[slot] === hash && isSameBitsAt(page.bits, slot * FRAME_BLOCK_FLOAT_COUNT, bits)) {
					page.useFrame = frameNumber;
					this.#frameBlock = page;
					this.#frameBlockOffset = slot * frameRing.stride;
					return;
				}
			}
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		let page = frameRing.writePage;
		if (page === null || page.writeFrame !== frameNumber || page.count >= FRAME_RING_SLOT_COUNT) {
			// 이 프레임에 쓸 장: FRAME_RING_LATENCY 프레임 동안 쓰지 않은 장 가운데 가장 오래된 것을 비워 쓴다. (없으면 새로)
			page = null;
			for (let pageIndex = 0; pageIndex < pages.length; ++pageIndex) {
				const candidate = pages[pageIndex];
				if (frameNumber - candidate.useFrame >= FRAME_RING_LATENCY && (page === null || candidate.useFrame < page.useFrame)) {
					page = candidate;
				}
			}
			if (page === null) {
				const buffer = webGL2RenderingContext.createBuffer();
				webGL2RenderingContext.bindBuffer(webGL2RenderingContext.UNIFORM_BUFFER, buffer);
				webGL2RenderingContext.bufferData(webGL2RenderingContext.UNIFORM_BUFFER, frameRing.stride * (FRAME_RING_SLOT_COUNT - 1) + FRAME_BLOCK_FLOAT_COUNT * 4, webGL2RenderingContext.STATIC_DRAW); // 칸 하나면 블록 크기 그대로. (값마다 짓던 버퍼와 같은 크기와 쓰임, 다시 쓰는 것은 FRAME_RING_LATENCY 뒤라 드물다)
				webGL2RenderingContext.bindBuffer(webGL2RenderingContext.UNIFORM_BUFFER, null);
				page = { buffer: buffer, bits: new System.Uint32Array(FRAME_RING_SLOT_COUNT * FRAME_BLOCK_FLOAT_COUNT), hashes: new System.Array(FRAME_RING_SLOT_COUNT).fill(0), count: 0, useFrame: frameNumber, writeFrame: frameNumber };
				pages.push(page);
			}
			page.count = 0;
			page.writeFrame = frameNumber;
			frameRing.writePage = page;
		}
		const slot = page.count;
		page.bits.set(bits, slot * FRAME_BLOCK_FLOAT_COUNT);
		page.hashes[slot] = hash;
		page.count = slot + 1;
		page.useFrame = frameNumber;
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.UNIFORM_BUFFER, page.buffer);
		webGL2RenderingContext.bufferSubData(webGL2RenderingContext.UNIFORM_BUFFER, slot * frameRing.stride, bits);
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.UNIFORM_BUFFER, null);
		this.#frameBlock = page;
		this.#frameBlockOffset = slot * frameRing.stride;
	}

	//==============================================================================
	// 프레임 블록의 값 쓰기. (FRAME_BLOCK_CHUNK 의 std140 자리, 그림자나 점광 그림자가 없으면 그 행렬, 치우침과 아틀라스 칸은 앞의 값 그대로)
	//==============================================================================
	/**
	 * @param { Float32Array } values - 쓸 곳. (FRAME_BLOCK_FLOAT_COUNT)
	 * @private
	 */
	writeFrameBlockValues(values) {
		values.set(this.#viewProjectionElements, 0);
		const shadowInput = this.#shadowInput;
		if (shadowInput !== null) {
			values.set(shadowInput.lightViewProjectionMatrix.getElements(), 16);
		}
		const cameraPosition = this.#cameraPosition;
		const cameraForward = this.#cameraForward;
		values[32] = cameraPosition[0];
		values[33] = cameraPosition[1];
		values[34] = cameraPosition[2];
		values[35] = cameraPosition[3];
		values[36] = cameraForward[0];
		values[37] = cameraForward[1];
		values[38] = cameraForward[2];
		values[39] = this.#isHdrOutput ? 1 : 0;
		const viewRotation = this.#viewRotationElements;
		for (let column = 0; column < 3; ++column) {
			values[40 + column * 4] = viewRotation[column * 3];
			values[41 + column * 4] = viewRotation[column * 3 + 1];
			values[42 + column * 4] = viewRotation[column * 3 + 2];
		}
		const outlineDistanceScale = this.#outlineDistanceScale;
		values[52] = outlineDistanceScale[0];
		values[53] = outlineDistanceScale[1];
		values[54] = outlineDistanceScale[2];
		values[55] = shadowInput !== null ? 1 : 0;
		values[56] = System.Math.cos(this.#cameraRoll);
		values[57] = System.Math.sin(this.#cameraRoll);
		values[58] = this.#outlineFadeDistance[0];
		values[59] = this.#outlineFadeDistance[1];
		if (shadowInput !== null) {
			values[60] = shadowInput.strength;
			values[61] = 1 / System.Math.max(1, shadowInput.resolution);
			// 해 그림자 치우침. (x 깊이, y 노멀 월드 거리, z 기울기 깊이, w 기울기 상한, readShadowBias)
			const shadowBias = shadowInput.bias;
			values[164] = shadowBias[0];
			values[165] = shadowBias[1];
			values[166] = shadowBias[2];
			values[167] = shadowBias[3];
		}
		// 모서리 어둠 텍스처의 화면 원점. (이번 프레임 뷰포트의 왼쪽 아래, 걸지 않았으면 0)
		const ambientOcclusionInput = this.#ambientOcclusionInput;
		values[62] = ambientOcclusionInput !== null ? ambientOcclusionInput.origin[0] : 0;
		values[63] = ambientOcclusionInput !== null ? ambientOcclusionInput.origin[1] : 0;
		// 모서리 어둠이 직접 빛에 미치는 몫. (걸지 않았으면 0)
		values[168] = ambientOcclusionInput !== null ? ambientOcclusionInput.directLightingStrength : 0;
		// 점광 그림자. (칸 넷의 자리, 앞, 위, 첫 칸과 점광마다의 칸 번호, 없으면 0)
		const localShadowInput = this.#localShadowInput;
		values.fill(0, 68, 164);
		if (localShadowInput !== null) {
			values[64] = localShadowInput.gridSize;
			values[65] = localShadowInput.tileSize;
			values[66] = localShadowInput.texelSize;
			values[67] = localShadowInput.strength;
			localShadowInput.lights.forEach((light, slot) => {
				if (light.lightIndex < TOON_MAXIMUM_POINT_LIGHTS) {
					values[132 + light.lightIndex * 4] = slot + 1;
				}
				const offset = slot * 4;
				values[68 + offset] = light.position[0];
				values[69 + offset] = light.position[1];
				values[70 + offset] = light.position[2];
				values[71 + offset] = light.near;
				values[84 + offset] = light.forward[0];
				values[85 + offset] = light.forward[1];
				values[86 + offset] = light.forward[2];
				values[87 + offset] = light.far;
				values[100 + offset] = light.up[0];
				values[101 + offset] = light.up[1];
				values[102 + offset] = light.up[2];
				values[103 + offset] = light.tangent;
				values[116 + offset] = light.firstTile;
			});
		}
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
		this.writeUniformMatrix4(shaderProgram, "modelMatrix", modelElements);
		this.writeUniformFloats(shaderProgram, "instanced", 1, instancedMode);
		this.writeUniformFloats(shaderProgram, "skinned", 1, isSkinned ? 1 : 0);
		if (isSkinned) {
			const jointFloatCount = System.Math.floor(System.Math.min(jointMatrices.length, TOON_MAXIMUM_JOINTS * 16) / 16) * 16;
			const jointValues = jointMatrices.length === jointFloatCount ? jointMatrices : jointMatrices.subarray(0, jointFloatCount);
			this.writeUniformMatrix4(shaderProgram, "jointMatrices", jointValues);
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
		this.bindTexture2D(unit, texture !== undefined && texture !== null ? texture : this.#whiteTexture);
	}

	//==============================================================================
	// 텍스처 유닛에 2D 텍스처 묶기. (상태 캐시가 이미 묶였다고 기억하면 건너뛰고, 유닛도 다를 때만 고른다)
	//==============================================================================
	/**
	 * @param { number } unit - 텍스처 유닛 번호.
	 * @param { WebGLTexture | null } texture - 묶을 텍스처.
	 * @private
	 */
	bindTexture2D(unit, texture) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const stateCache = this.#stateCache;
		const textureUnit = webGL2RenderingContext.TEXTURE0 + unit;
		if (stateCache.isTextureBound(textureUnit, webGL2RenderingContext.TEXTURE_2D, texture)) {
			return;
		}
		if (!stateCache.isActiveTexture(textureUnit)) {
			webGL2RenderingContext.activeTexture(textureUnit);
		}
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, texture);
	}

	//==============================================================================
	// 텍스처 유닛 고르기. (상태 캐시가 이미 같은 유닛이라고 기억하면 GL 에 다시 걸지 않는다)
	//==============================================================================
	/**
	 * @param { number } textureUnit - 고를 유닛. (TEXTURE0 + 번호)
	 * @private
	 */
	applyActiveTexture(textureUnit) {
		if (!this.#stateCache.isActiveTexture(textureUnit)) {
			this.getWebGL2RenderingContext().activeTexture(textureUnit);
		}
	}

	//==============================================================================
	// 앞면 감김 방향 걸기. (상태 캐시가 같은 값이라고 기억하면 건너뛴다)
	//==============================================================================
	/**
	 * @param { number } mode - 앞면 감김 방향. (CW, CCW)
	 * @private
	 */
	applyFrontFace(mode) {
		if (!this.#stateCache.isFrontFace(mode)) {
			this.getWebGL2RenderingContext().frontFace(mode);
		}
	}

	//==============================================================================
	// 가릴 면 걸기. (상태 캐시가 같은 값이라고 기억하면 건너뛴다)
	//==============================================================================
	/**
	 * @param { number } mode - 가릴 면. (FRONT, BACK)
	 * @private
	 */
	applyCullFace(mode) {
		if (!this.#stateCache.isCullFace(mode)) {
			this.getWebGL2RenderingContext().cullFace(mode);
		}
	}

	//==============================================================================
	// 버텍스 어레이 묶기. (상태 캐시가 같은 것이라고 기억하면 건너뛴다)
	//==============================================================================
	/**
	 * @param { WebGLVertexArrayObject | null } vertexArray - 묶을 버텍스 어레이.
	 * @private
	 */
	applyVertexArray(vertexArray) {
		if (!this.#stateCache.isVertexArrayBound(vertexArray)) {
			this.getWebGL2RenderingContext().bindVertexArray(vertexArray);
		}
	}

	//==============================================================================
	// 유니폼 값 기억하며 올리기. (프로그램마다 이름별로 마지막에 올린 값을 기억해 같은 값이면 GL 에 다시 올리지 않는다)
	// - 유니폼 값은 프로그램에 남으므로 프로그램이 같은 동안 같은 값은 다시 올릴 필요가 없다. (three.js 의 WebGLUniforms 캐시와 같은 꼴)
	// - 렌더러 밖의 코드가 같은 유니폼을 바꿨을 수 있는 때는 기억을 잊는다:
	//   프레임과 그림자 판의 시작, applyFrameState(단계 콜백과 화면 공간 바깥선 뒤), 상태 되돌리기, 그 프로그램의 onBeforeDraw 를 부른 뒤.
	// - 값은 주어진 수 그대로 견준다. (0 과 -0 도 가른다, NaN 은 늘 다시 올린다) 셰이더에서 빠진 유니폼(위치 null)은 올리지 않는다.
	//==============================================================================
	/**
	 * @param { ShaderProgram } shaderProgram - 유니폼을 가진 프로그램.
	 * @param { string } uniformName - 유니폼 이름.
	 * @returns { object } 그 유니폼의 칸. ({ location, serial, values, count(배열의 쓴 수) })
	 * @private
	 */
	readUniformSlot(shaderProgram, uniformName) {
		let slotTable = shaderProgram === this.#slotTableProgram ? this.#slotTable : this.#uniformSlotTable.get(shaderProgram);
		if (slotTable === undefined) {
			slotTable = new System.Map();
			this.#uniformSlotTable.set(shaderProgram, slotTable);
		}
		this.#slotTableProgram = shaderProgram;
		this.#slotTable = slotTable;
		let slot = slotTable.get(uniformName);
		if (slot === undefined) {
			slot = { location: shaderProgram.getUniformLocation(uniformName), serial: 0, values: null, count: 0 };
			slotTable.set(uniformName, slot);
		}
		return slot;
	}

	//==============================================================================
	// 모든 프로그램의 기억한 유니폼 값 잊기. (다음 그리기가 모두 다시 올린다)
	//==============================================================================
	/**
	 * @private
	 */
	forgetAllUniformValues() {
		this.#uniformSerial += 1;
		this.#materialBlocks.boundBlock = null;
		this.#outlineBlocks.boundBlock = null;
		this.#frameBlocks.boundBuffer = null;
	}

	//==============================================================================
	// 그리기 꼴 객체의 푼 칸 읽기. (앞의 그리기와 꼴 객체의 얕은 사본이 같으면 앞서 푼 것을 쓰고, 다르면 다시 푼다)
	// - 게임이 프레임마다 같은 꼴 객체를 넘기면 칸을 이름으로 찾아 풀지 않는다. (for-in 으로 있는 칸만 견준다, 난독화로 이름 읽기가 비싼 빌드에서도 싸다)
	// - 꼴 객체의 값을 그 자리에서 고치거나(틴트 같은 넷 이하 수 배열의 수까지) 칸을 더하고 빼면 다르다고 보고 다시 푼다. 재질 블록도 다시 고른다.
	//   꼴 객체는 평범한 객체다. (클래스의 get 칸은 견주지 못한다) 그리기 줄(ToonDrawQueue)도 이것으로 꼴을 읽는다.
	//==============================================================================
	/**
	 * @param { object } options - 그리기 꼴.
	 * @returns { object } { state (DRAW_STATE_ 자리의 배열), materialBlock, outlineBlock, ... }
	 * @private
	 */
	readDrawEntry(options) {
		if (options === this.#hintOptions) {
			return this.readHeldDrawEntry(this.#hintEntry);
		}
		let entry = this.#drawEntryOfOptions.get(options);
		if (entry === undefined) {
			entry = this.createDrawEntry();
			this.#drawEntryOfOptions.set(options, entry);
			return this.writeKnownDrawEntry(entry, options);
		}
		return this.readKnownDrawEntry(entry, options);
	}

	//==============================================================================
	// 꼴 객체마다 기억한 칸을 맞추기. (readDrawEntry 의 기억이 있는 갈래, findDrawEntry 가 기억 칸을 이미 찾았을 때 바로 부른다)
	//==============================================================================
	/**
	 * @param { object } entry - 꼴 객체마다 기억한 칸.
	 * @param { object } options - 그리기 꼴.
	 * @returns { object } entry.
	 * @private
	 */
	readKnownDrawEntry(entry, options) {
		if (this.#isTrusting && entry.trustSerial === this.#trustSerial) {
			return entry;
		}
		if (isSameOptionsSnapshot(entry, options)) {
			entry.trustSerial = this.#isTrusting ? this.#trustSerial : 0;
			return entry;
		}
		return this.writeKnownDrawEntry(entry, options);
	}

	//==============================================================================
	// 꼴 객체마다 기억한 칸을 새로 풀기. (값이 달라졌거나 처음 지은 칸, 재질 블록은 다시 고른다)
	//==============================================================================
	/**
	 * @param { object } entry - 꼴 객체마다 기억한 칸.
	 * @param { object } options - 그리기 꼴.
	 * @returns { object } entry.
	 * @private
	 */
	writeKnownDrawEntry(entry, options) {
		writeOptionsSnapshot(entry, options);
		writeDrawState(entry.state, options);
		entry.materialBlock = null;
		entry.outlineBlock = null;
		entry.trustSerial = this.#isTrusting ? this.#trustSerial : 0;
		return entry;
	}

	//==============================================================================
	// 꼴 객체마다 기억한 칸 찾기. (readDrawEntry 와 같은데 기억한 것이 없으면 짓지 않고 null)
	// - 그리기 줄이 처음 보는 꼴 객체(게임이 프레임마다 새로 짓는 꼴)는 꼴 객체마다 기억하지 않고 담은 칸이 쥔 기억 칸에 푼다. (writeHeldDrawEntry)
	//==============================================================================
	/**
	 * @param { object } options - 그리기 꼴.
	 * @returns { object | null } 기억 칸이나 null.
	 * @private
	 */
	findDrawEntry(options) {
		const entry = this.#drawEntryOfOptions.get(options);
		if (entry === undefined) {
			return null;
		}
		if (options === this.#hintOptions) {
			return this.readHeldDrawEntry(this.#hintEntry);
		}
		return this.readKnownDrawEntry(entry, options);
	}

	//==============================================================================
	// 기억 칸 짓기. (readDrawEntry 의 칸과 같은 꼴, 아직 푼 것이 없다)
	//==============================================================================
	/**
	 * @returns { object } 기억 칸.
	 * @private
	 */
	createDrawEntry() {
		return { keys: [], values: [], numbers: [], state: new System.Array(DRAW_STATE_COUNT), materialBlock: null, outlineBlock: null, outlineColor: null, outlineLightSet: null, outlineLightVersion: -1, trustSerial: 0, options: null, generation: this.#drawEntryGeneration };
	}

	//==============================================================================
	// 쥔 기억 칸 맞추기. (그리기 줄의 담은 칸과 ToonDrawItem 이 꼴 객체와 상관없이 쥐는 칸, 꼴 객체마다 기억하지 않는다)
	// - entry 가 null 이면 짓는다. isChanged 면 견주지 않고 다시 푼다. (ToonDrawItem 의 바뀜 표시)
	//   아니면 얕은 사본과 견주어 다를 때만 다시 푼다. 같으면 푼 칸과 재질 블록을 그대로 쓴다. (게임이 프레임마다 값이 같은 새 꼴 객체를 지어도 할당 없음)
	//==============================================================================
	/**
	 * @param { object | null } entry - 쥔 기억 칸이나 null.
	 * @param { object } options - 그리기 꼴.
	 * @param { boolean } isChanged - 꼴이 바뀐 것을 알면 true. (견주지 않는다)
	 * @returns { object } 기억 칸. (entry 가 null 이면 새 칸)
	 * @private
	 */
	writeHeldDrawEntry(entry, options, isChanged) {
		if (entry === null) {
			entry = this.createDrawEntry();
			isChanged = true;
		}
		this.readHeldDrawEntry(entry);
		if (isChanged || !isSameOptionsSnapshot(entry, options)) {
			writeOptionsSnapshot(entry, options);
			writeDrawState(entry.state, options);
			entry.materialBlock = null;
			entry.outlineBlock = null;
		}
		entry.options = options;
		return entry;
	}

	//==============================================================================
	// 쥔 기억 칸 그대로 쓰기. (블록 갈래를 지운 뒤면 블록만 잊는다)
	//==============================================================================
	/**
	 * @param { object } entry - 쥔 기억 칸.
	 * @returns { object } entry.
	 * @private
	 */
	readHeldDrawEntry(entry) {
		if (entry.generation !== this.#drawEntryGeneration) {
			entry.materialBlock = null;
			entry.outlineBlock = null;
			entry.generation = this.#drawEntryGeneration;
		}
		return entry;
	}

	//==============================================================================
	// 그리기 줄이 지금 그리는 칸 알리기. (맡긴 판에서 그 꼴 객체의 readDrawEntry 가 칸의 기억을 바로 쓴다, null 이면 푼다)
	//==============================================================================
	/**
	 * @param { object | null } options - 담은 칸의 꼴 객체.
	 * @param { object | null } entry - 그 칸이 이번 프레임에 푼 기억 칸.
	 * @private
	 */
	setDrawEntryHint(options, entry) {
		this.#hintOptions = this.#isTrusting ? options : null;
		this.#hintEntry = this.#isTrusting ? entry : null;
	}

	//==============================================================================
	// 꼴을 고치지 않는 판 맡기 시작과 끝. (그리기 줄이 draw, drawShadows 동안 부른다, 맡긴 판에서는 꼴 객체마다 한 번만 견준다)
	// - 그리기 줄은 draw 를 부를 때까지 담은 꼴을 고치지 않는다(ToonDrawQueue 머리말). 단계 콜백을 부르는 동안은 멈춘다(pauseTrustedOptions).
	//==============================================================================
	/**
	 * @private
	 */
	beginTrustedOptions() {
		this.#trustSerial += 1;
		this.#isTrusting = true;
	}

	//==============================================================================
	// 맡긴 판 끝. (그리기 줄이 draw, drawShadows 끝에 try/finally 로 부른다)
	//==============================================================================
	/**
	 * @private
	 */
	endTrustedOptions() {
		this.#isTrusting = false;
		this.#hintOptions = null;
		this.#hintEntry = null;
	}

	//==============================================================================
	// 맡긴 판 멈추기와 다시. (단계 콜백이 렌더러로 바로 그리는 동안 멈춘다)
	//==============================================================================
	/**
	 * @param { boolean } isPaused - 멈출지. (false 면 같은 판으로 다시)
	 * @private
	 */
	pauseTrustedOptions(isPaused) {
		if (isPaused) {
			// 단계 콜백에는 지금까지처럼 유닛 0 을 고른 채 넘긴다. (그리기는 유닛을 0 으로 되돌리지 않는다)
			this.applyActiveTexture(this.getWebGL2RenderingContext().TEXTURE0);
		}
		this.#isTrusting = !isPaused;
		this.#hintOptions = null;
		this.#hintEntry = null;
	}

	//==============================================================================
	// 블록 묶기. (그 바인딩 자리에 이미 묶였으면 건너뛴다)
	//==============================================================================
	/**
	 * @param { object } blockCache - createBlockCache 의 결과.
	 * @param { object } block - readUniformBlock 의 결과.
	 * @private
	 */
	bindBlock(blockCache, block) {
		block.isUsed = true; // 내보낼 블록 고르기의 쓴 표시. (readUniformBlock)
		if (block !== blockCache.boundBlock) {
			const webGL2RenderingContext = this.getWebGL2RenderingContext();
			webGL2RenderingContext.bindBufferBase(webGL2RenderingContext.UNIFORM_BUFFER, blockCache.binding, block.buffer);
			blockCache.boundBlock = block;
		}
	}

	//==============================================================================
	// 값이 같은 블록 찾기. (없으면 지어 올린다, MATERIAL_BLOCK_LIMIT 에 닿으면 오래 안 쓴 블록 하나를 내보내고 그 버퍼에 새 값을 쓴다)
	// - 내보낼 블록은 시계 꼴(second chance)로 고른다: 지은 차례의 고리를 돌며 쓴 표시(bindBlock)가 있으면 지우고 넘어가고, 없으면 그것을 내보낸다.
	// - 내보낸 블록은 buffer 가 null 이 된다. 그것을 쥔 기억 칸은 다음 그리기에 값을 다시 푼다. (갈래를 통째 지우거나 꼴 기억을 비우지 않는다)
	//==============================================================================
	/**
	 * @param { object } blockCache - createBlockCache 의 결과.
	 * @returns { object } { buffer, bits, hash, isUsed }
	 * @private
	 */
	readUniformBlock(blockCache) {
		const bits = blockCache.bits;
		const hash = readMaterialBlockHash(bits);
		let blockList = blockCache.table.get(hash);
		if (blockList !== undefined) {
			for (const block of blockList) {
				if (isSameBits(block.bits, bits)) {
					return block;
				}
			}
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const blocks = blockCache.blocks;
		let block = null;
		if (blocks.length >= MATERIAL_BLOCK_LIMIT) {
			const victim = this.evictUniformBlock(blockCache);
			block = { buffer: victim.buffer, bits: bits.slice(), hash: hash, isUsed: true };
			victim.buffer = null;
			blocks[blockCache.hand] = block;
			blockCache.hand = (blockCache.hand + 1) % blocks.length;
			blockList = blockCache.table.get(hash);
			webGL2RenderingContext.bindBuffer(webGL2RenderingContext.UNIFORM_BUFFER, block.buffer);
			webGL2RenderingContext.bufferSubData(webGL2RenderingContext.UNIFORM_BUFFER, 0, bits);
			webGL2RenderingContext.bindBuffer(webGL2RenderingContext.UNIFORM_BUFFER, null);
		}
		else {
			const buffer = webGL2RenderingContext.createBuffer();
			webGL2RenderingContext.bindBuffer(webGL2RenderingContext.UNIFORM_BUFFER, buffer);
			webGL2RenderingContext.bufferData(webGL2RenderingContext.UNIFORM_BUFFER, bits, webGL2RenderingContext.STATIC_DRAW);
			webGL2RenderingContext.bindBuffer(webGL2RenderingContext.UNIFORM_BUFFER, null);
			block = { buffer: buffer, bits: bits.slice(), hash: hash, isUsed: true };
			blocks.push(block);
			blockCache.count += 1;
		}
		if (blockList === undefined) {
			blockList = [];
			blockCache.table.set(hash, blockList);
		}
		blockList.push(block);
		return block;
	}

	//==============================================================================
	// 내보낼 블록 고르기. (시계 꼴, 고른 블록은 해시 칸에서 빼고 돌려준다, 버퍼는 지우지 않는다)
	//==============================================================================
	/**
	 * @param { object } blockCache - createBlockCache 의 결과. (blocks 가 MATERIAL_BLOCK_LIMIT 개)
	 * @returns { object } 내보낼 블록. (blocks[blockCache.hand] 자리)
	 * @private
	 */
	evictUniformBlock(blockCache) {
		const blocks = blockCache.blocks;
		for (;;) {
			const block = blocks[blockCache.hand];
			if (block.isUsed) {
				block.isUsed = false;
				blockCache.hand = (blockCache.hand + 1) % blocks.length;
				continue;
			}
			const blockList = blockCache.table.get(block.hash);
			const index = blockList.indexOf(block);
			blockList[index] = blockList[blockList.length - 1];
			blockList.pop();
			if (blockList.length === 0) {
				blockCache.table.delete(block.hash);
			}
			if (blockCache.boundBlock === block) {
				blockCache.boundBlock = null;
			}
			return block;
		}
	}

	//==============================================================================
	// 블록 갈래 모두 지우기.
	//==============================================================================
	/**
	 * @param { object } blockCache - createBlockCache 의 결과.
	 * @private
	 */
	clearBlockCache(blockCache) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		for (const blockList of blockCache.table.values()) {
			for (const block of blockList) {
				webGL2RenderingContext.deleteBuffer(block.buffer);
				block.buffer = null;
			}
		}
		blockCache.table.clear();
		blockCache.blocks.length = 0;
		blockCache.hand = 0;
		blockCache.count = 0;
		blockCache.boundBlock = null;
		this.#drawEntryOfOptions = new System.WeakMap(); // 꼴마다 기억한 블록이 지운 것을 가리키지 않게.
		this.#drawEntryGeneration += 1; // 쥔 기억 칸도. (readHeldDrawEntry)
	}

	//==============================================================================
	// 한 프로그램의 기억한 유니폼 값 잊기. (onBeforeDraw 뒤)
	//==============================================================================
	/**
	 * @param { ShaderProgram } shaderProgram - 잊을 프로그램.
	 * @private
	 */
	forgetUniformValues(shaderProgram) {
		const slotTable = this.#uniformSlotTable.get(shaderProgram);
		if (slotTable === undefined) {
			return;
		}
		for (const slot of slotTable.values()) {
			slot.serial = 0;
		}
	}

	//==============================================================================
	// float 유니폼 하나 올리기. (uniform1f ~ uniform4f, 같은 값이면 건너뛴다)
	//==============================================================================
	/**
	 * @param { ShaderProgram } shaderProgram - 지금 쓰는 프로그램.
	 * @param { string } uniformName - 유니폼 이름.
	 * @param { number } componentCount - 성분 수. (1 ~ 4)
	 * @param { number } x - 첫 성분.
	 * @param { number } [y] - 둘째 성분.
	 * @param { number } [z] - 셋째 성분.
	 * @param { number } [w] - 넷째 성분.
	 * @private
	 */
	writeUniformFloats(shaderProgram, uniformName, componentCount, x, y = 0, z = 0, w = 0) {
		const slot = this.readUniformSlot(shaderProgram, uniformName);
		const location = slot.location;
		if (location === null) {
			return;
		}
		let values = slot.values;
		if (slot.serial === this.#uniformSerial && isSameNumber(values[0], x) && isSameNumber(values[1], y) && isSameNumber(values[2], z) && isSameNumber(values[3], w)) {
			return;
		}
		if (values === null) {
			values = new System.Float64Array(4);
			slot.values = values;
		}
		values[0] = x;
		values[1] = y;
		values[2] = z;
		values[3] = w;
		slot.serial = this.#uniformSerial;
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		switch (componentCount) {
			case 1:
				webGL2RenderingContext.uniform1f(location, x);
				break;
			case 2:
				webGL2RenderingContext.uniform2f(location, x, y);
				break;
			case 3:
				webGL2RenderingContext.uniform3f(location, x, y, z);
				break;
			default:
				webGL2RenderingContext.uniform4f(location, x, y, z, w);
				break;
		}
	}

	//==============================================================================
	// int 유니폼 하나 올리기. (uniform1i, 같은 값이면 건너뛴다)
	//==============================================================================
	/**
	 * @param { ShaderProgram } shaderProgram - 지금 쓰는 프로그램.
	 * @param { string } uniformName - 유니폼 이름.
	 * @param { number } value - 값.
	 * @private
	 */
	writeUniform1i(shaderProgram, uniformName, value) {
		const slot = this.readUniformSlot(shaderProgram, uniformName);
		const location = slot.location;
		if (location === null) {
			return;
		}
		if (slot.serial === this.#uniformSerial && slot.values[0] === value) {
			return;
		}
		if (slot.values === null) {
			slot.values = new System.Float64Array(1);
		}
		slot.values[0] = value;
		slot.serial = this.#uniformSerial;
		this.getWebGL2RenderingContext().uniform1i(location, value);
	}

	//==============================================================================
	// mat4 유니폼이나 그 배열 올리기. (uniformMatrix4fv, 전치 없음, 같은 값이면 건너뛴다)
	//==============================================================================
	/**
	 * @param { ShaderProgram } shaderProgram - 지금 쓰는 프로그램.
	 * @param { string } uniformName - 유니폼 이름.
	 * @param { ArrayLike<number> } elements - 행렬의 수. (16 의 배수)
	 * @private
	 */
	writeUniformMatrix4(shaderProgram, uniformName, elements) {
		const slot = this.readUniformSlot(shaderProgram, uniformName);
		const location = slot.location;
		if (location === null) {
			return;
		}
		const elementCount = elements.length;
		let values = slot.values;
		if (slot.serial === this.#uniformSerial && slot.count === elementCount) {
			let isSame = true;
			for (let index = 0; index < elementCount; ++index) {
				if (!isSameNumber(values[index], elements[index])) {
					isSame = false;
					break;
				}
			}
			if (isSame) {
				return;
			}
		}
		if (values === null || values.length < elementCount) {
			// 길이가 다른 배열(뼈 수가 다른 모형)이 번갈아 와도 다시 만들지 않게 가장 긴 것에 맞춰 둔다.
			values = new System.Float32Array(elementCount);
			slot.values = values;
		}
		values.set(elements);
		slot.count = elementCount;
		slot.serial = this.#uniformSerial;
		this.getWebGL2RenderingContext().uniformMatrix4fv(location, false, elements);
	}

	//==============================================================================
	// 삼각형 범위 그리기. (instanceCount 가 0 이면 보통, 아니면 인스턴스로, 수가 0 이하면 그리지 않는다)
	//==============================================================================
	/**
	 * @param { number } start - 첫 번호 자리.
	 * @param { number } count - 번호 수.
	 * @param { number } instanceCount - 인스턴스 수. (0 이면 보통 그리기)
	 * @private
	 */
	drawElementRange(start, count, instanceCount) {
		if (count <= 0) {
			return;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		if (instanceCount > 0) {
			webGL2RenderingContext.drawElementsInstanced(webGL2RenderingContext.TRIANGLES, count, webGL2RenderingContext.UNSIGNED_INT, start * 4, instanceCount);
		}
		else {
			webGL2RenderingContext.drawElements(webGL2RenderingContext.TRIANGLES, count, webGL2RenderingContext.UNSIGNED_INT, start * 4);
		}
		this.#frameStatistics.drawCallCount += 1;
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
	 * @param { number } [parts] - 그릴 것. (DRAW_PART_OUTLINE 바깥선 껍데기, DRAW_PART_BODY 몸, 기본 둘 다, 꼴의 hasOutline, isBodyDrawn 이 false 면 그것도 뺀다)
	 * @param { object | null } [vertexArrays] - 모형 대신 쓸 버텍스 어레이. ({ body, outline }, 자동 인스턴싱의 묶음 자리, 기본 null)
	 */
	drawWithCount(mesh, modelElements, instanceCount, options, instanceBuffer, parts = DRAW_PART_ALL, vertexArrays = null) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const drawEntry = this.readDrawEntry(options);
		const state = drawEntry.state;
		const material = state[DRAW_STATE_MATERIAL];
		const instanceLayout = instanceBuffer !== null ? instanceBuffer.layout : null;
		const programSet = this.readProgramSet(material, instanceLayout);
		if (programSet === null) {
			return;
		}
		const jointMatrices = state[DRAW_STATE_JOINT_MATRICES];
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
		if (vertexArrays !== null) {
			bodyVertexArray = vertexArrays.body;
			outlineVertexArray = vertexArrays.outline;
		}
		const indexStart = System.Math.max(0, System.Math.min(mesh.bodyIndexCount, state[DRAW_STATE_INDEX_START]));
		const indexCount = state[DRAW_STATE_INDEX_COUNT] > 0 ? System.Math.min(state[DRAW_STATE_INDEX_COUNT], mesh.bodyIndexCount - indexStart) : mesh.bodyIndexCount - indexStart;
		const outlineIndexStart = System.Math.max(0, System.Math.min(mesh.outlineIndexCount, state[DRAW_STATE_OUTLINE_INDEX_START]));
		const outlineIndexCount = state[DRAW_STATE_OUTLINE_INDEX_COUNT] > 0 ? System.Math.min(state[DRAW_STATE_OUTLINE_INDEX_COUNT], mesh.outlineIndexCount - outlineIndexStart) : mesh.outlineIndexCount - outlineIndexStart;
		const isMirroredDraw = state[DRAW_STATE_IS_MIRRORED] >= 0 ? state[DRAW_STATE_IS_MIRRORED] === 1 : readMatrixDeterminant(modelElements) < 0;
		const isMirrored = isMirroredDraw !== this.#isFrameMirrored;
		this.applyFrontFace(isMirrored ? webGL2RenderingContext.CW : webGL2RenderingContext.CCW);
		const onBeforeDraw = state[DRAW_STATE_ON_BEFORE_DRAW];

		// 그림자 패스. (몸의 깊이만)
		if (this.#isShadowPass) {
			const depthEntry = programSet.depth;
			depthEntry.program.useProgram();
			this.uploadFrameUniforms(depthEntry);
			this.uploadDrawUniforms(depthEntry.program, modelElements, isSkinned, instancedMode, jointMatrices);
			if (onBeforeDraw !== null) {
				onBeforeDraw(depthEntry.program, webGL2RenderingContext, ToonProgramKind.depth);
				this.forgetUniformValues(depthEntry.program);
			}
			this.applyVertexArray(bodyVertexArray);
			this.drawElementRange(indexStart, indexCount, instanceCount);
			this.applyFrontFace(webGL2RenderingContext.CCW);
			return;
		}

		const alpha = state[DRAW_STATE_ALPHA];
		const blendMode = state[DRAW_STATE_BLEND_MODE];
		const hasOutline = (parts & DRAW_PART_OUTLINE) !== 0 && state[DRAW_STATE_HAS_OUTLINE] && outlineVertexArray !== null;
		const isTransparent = state[DRAW_STATE_IS_TRANSPARENT];
		const premultipliedOutput = state[DRAW_STATE_PREMULTIPLIED_OUTPUT];
		if (isTransparent) {
			// 알파 칸은 덮은 정도(미리 곱한 알파의 over)로 쌓는다. (유니티 Blend SrcAlpha OneMinusSrcAlpha, One OneMinusSrcAlpha 와 같다)
			// 캔버스(알파 없음)에는 색이 같고, 투명하게 비운 판(ToonView3D 렌더 스케일, 투명도 층)에 그려 얹을 때 아래가 맞게 비친다.
			// 더하기는 덮지 않으므로 알파를 바꾸지 않는다.
			webGL2RenderingContext.enable(webGL2RenderingContext.BLEND);
			if (blendMode === ToonBlendMode.additive) {
				webGL2RenderingContext.blendFuncSeparate(webGL2RenderingContext.ONE, webGL2RenderingContext.ONE, webGL2RenderingContext.ZERO, webGL2RenderingContext.ONE);
			}
			else if (blendMode === ToonBlendMode.premultiplied) {
				webGL2RenderingContext.blendFunc(webGL2RenderingContext.ONE, webGL2RenderingContext.ONE_MINUS_SRC_ALPHA);
			}
			else {
				webGL2RenderingContext.blendFuncSeparate(webGL2RenderingContext.SRC_ALPHA, webGL2RenderingContext.ONE_MINUS_SRC_ALPHA, webGL2RenderingContext.ONE, webGL2RenderingContext.ONE_MINUS_SRC_ALPHA);
			}
		}

		// 바깥선. (껍데기의 뒷면만)
		if (hasOutline) {
			const outlineEntry = programSet.outline;
			const outlineProgram = outlineEntry.program;
			outlineProgram.useProgram();
			this.uploadFrameUniforms(outlineEntry);
			this.uploadDrawUniforms(outlineProgram, modelElements, isSkinned, instancedMode, jointMatrices);
			// 선 값은 블록 하나로. (몸의 재질 블록과 같은 꼴)
			const outlineBlocks = this.#outlineBlocks;
			const outlineLightSet = state[DRAW_STATE_LIGHT_SET] !== null ? state[DRAW_STATE_LIGHT_SET] : this.#lightSet;
			const outlineLightVersion = outlineLightSet.getVersion();
			if (drawEntry.outlineBlock === null || drawEntry.outlineBlock.buffer === null || drawEntry.outlineColor !== this.#outlineColor || drawEntry.outlineLightSet !== outlineLightSet || drawEntry.outlineLightVersion !== outlineLightVersion) {
				const outlineColor = state[DRAW_STATE_OUTLINE_COLOR] !== null ? state[DRAW_STATE_OUTLINE_COLOR] : this.#outlineColor;
				const outlineLightColor = outlineLightSet.getLightColorUsage().outline ? readOutlineLightColor(outlineLightSet.getSunColor()) : WHITE_COLOR;
				const outlineValues = outlineBlocks.values;
				outlineValues[0] = outlineColor[0];
				outlineValues[1] = outlineColor[1];
				outlineValues[2] = outlineColor[2];
				outlineValues[3] = outlineColor.length > 3 ? outlineColor[3] : 1;
				outlineValues[4] = outlineLightColor[0];
				outlineValues[5] = outlineLightColor[1];
				outlineValues[6] = outlineLightColor[2];
				outlineValues[7] = state[DRAW_STATE_OUTLINE_WIDTH_SCALE];
				outlineValues[8] = state[DRAW_STATE_OUTLINE_OFFSET_Z];
				outlineValues[9] = alpha;
				outlineValues[10] = premultipliedOutput;
				outlineValues[11] = 0;
				drawEntry.outlineBlock = this.readUniformBlock(outlineBlocks);
				drawEntry.outlineColor = this.#outlineColor;
				drawEntry.outlineLightSet = outlineLightSet;
				drawEntry.outlineLightVersion = outlineLightVersion;
			}
			this.bindBlock(outlineBlocks, drawEntry.outlineBlock);
			if (onBeforeDraw !== null) {
				onBeforeDraw(outlineProgram, webGL2RenderingContext, ToonProgramKind.outline);
				this.forgetUniformValues(outlineProgram);
			}
			this.applyCullFace(webGL2RenderingContext.FRONT);
			this.applyVertexArray(outlineVertexArray);
			this.drawElementRange(outlineIndexStart, outlineIndexCount, instanceCount);
		}
		if ((parts & DRAW_PART_BODY) === 0 || !state[DRAW_STATE_IS_BODY_DRAWN]) {
			if (isTransparent) {
				webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);
			}
			this.applyCullFace(webGL2RenderingContext.BACK);
			this.applyFrontFace(webGL2RenderingContext.CCW);
			return;
		}

		// 몸.
		const solidEntry = programSet.solid;
		const solidProgram = solidEntry.program;
		solidProgram.useProgram();
		this.uploadFrameUniforms(solidEntry);
		const lightSet = state[DRAW_STATE_LIGHT_SET] !== null ? state[DRAW_STATE_LIGHT_SET] : this.#lightSet;
		this.uploadLightUniforms(solidEntry, lightSet);
		this.uploadDrawUniforms(solidProgram, modelElements, isSkinned, instancedMode, jointMatrices);
		// 재질 값은 블록 하나로. (값이 같은 블록은 하나, 그리기마다 bindBufferBase 하나)
		const materialBlocks = this.#materialBlocks;
		if (drawEntry.materialBlock === null || drawEntry.materialBlock.buffer === null) { // 내보낸 블록이면 다시. (readUniformBlock)
			writeMaterialBlockValues(materialBlocks.values, options);
			drawEntry.materialBlock = this.readUniformBlock(materialBlocks);
		}
		this.bindBlock(materialBlocks, drawEntry.materialBlock);
		const baseColorTexture = state[DRAW_STATE_BASE_COLOR_TEXTURE];
		const emissiveTexture = state[DRAW_STATE_EMISSIVE_TEXTURE];
		const decalTexture = state[DRAW_STATE_DECAL_TEXTURE];
		const matcapTexture = state[DRAW_STATE_MATCAP_TEXTURE];
		const angelRingTexture = state[DRAW_STATE_ANGEL_RING_TEXTURE];
		const shadowInput = this.#shadowInput;
		this.bindTexture2D(SHADOW_TEXTURE_UNIT, shadowInput !== null ? shadowInput.depthTexture : this.#emptyShadowTexture);
		this.bindTextureUnit(BASE_COLOR_TEXTURE_UNIT, baseColorTexture);
		this.bindTextureUnit(EMISSIVE_TEXTURE_UNIT, emissiveTexture);
		this.bindTextureUnit(DECAL_TEXTURE_UNIT, decalTexture);
		this.bindTextureUnit(RAMP_TEXTURE_UNIT, lightSet.getRampTexture());
		this.bindTextureUnit(MATCAP_TEXTURE_UNIT, matcapTexture);
		this.bindTextureUnit(ANGEL_RING_TEXTURE_UNIT, angelRingTexture);
		this.bindTexture2D(LOCAL_SHADOW_TEXTURE_UNIT, this.#localShadowInput !== null ? this.#localShadowInput.depthTexture : this.#emptyShadowTexture);
		if (this.#ambientOcclusionInput !== null) {
			this.bindTexture2D(AMBIENT_OCCLUSION_TEXTURE_UNIT, this.#ambientOcclusionInput.texture);
		}
		if (state[DRAW_STATE_TEXTURES] !== null) {
			let unit = FIRST_MATERIAL_TEXTURE_UNIT;
			for (const [uniformName, texture] of System.Object.entries(state[DRAW_STATE_TEXTURES])) {
				if (unit >= FIRST_MATERIAL_TEXTURE_UNIT + TOON_MAXIMUM_MATERIAL_TEXTURES) {
					break;
				}
				this.bindTextureUnit(unit, texture);
				this.writeUniform1i(solidProgram, uniformName, unit);
				unit += 1;
			}
		}
		// 고른 유닛은 그리기마다 0 으로 되돌리지 않는다. (다음 그리기가 같은 유닛만 바꾸면 activeTexture 없이 bindTexture 하나로, 프레임 끝에 restoreState 가 돌린다)
		if (onBeforeDraw !== null) {
			// 확장 콜백에는 지금까지처럼 유닛 0 을 고른 채 넘긴다.
			this.applyActiveTexture(webGL2RenderingContext.TEXTURE0);
			onBeforeDraw(solidProgram, webGL2RenderingContext, ToonProgramKind.solid);
			this.forgetUniformValues(solidProgram);
		}
		this.applyCullFace(webGL2RenderingContext.BACK);
		this.applyVertexArray(bodyVertexArray);
		this.drawElementRange(indexStart, indexCount, instanceCount);
		if (isTransparent) {
			webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);
		}
		this.applyFrontFace(webGL2RenderingContext.CCW);
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
	 * import { ToonRenderer, MeshBuilder, createSphereGeometry, Matrix4, Vector3 } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * renderer.setShade({ step: 0.55, feather: 0.01, color: [0.85, 0.62, 0.6], secondStep: 0.25, secondFeather: 0.01, secondColor: [0.6, 0.42, 0.45], isHalfLambert: true });
	 * const builder = new MeshBuilder();
	 * builder.addPart(createSphereGeometry(0.5, 32, 20), Matrix4.createIdentity(), "#f8e0d0", { hasOutline: true });
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
	 * import { ToonRenderer, MeshBuilder, createTorusGeometry, Matrix4, Vector3 } from "./vanilla.js";
	 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"));
	 * const rampData = new Uint8Array([60, 50, 110, 255, 110, 100, 160, 255, 200, 185, 215, 255, 255, 255, 255, 255]);
	 * const rampTexture = renderer.createTexture({ width: 4, height: 1, data: rampData }, { isMipmapped: false, isRepeated: false, isFiltered: false });
	 * renderer.setRampTexture(rampTexture, true);
	 * const builder = new MeshBuilder();
	 * builder.addPart(createTorusGeometry(0.4, 0.15, 16, 32), Matrix4.createIdentity(), "#ffffff", { hasOutline: true });
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
	 * import { ToonRenderer, MeshBuilder, createSphereGeometry, ShadowMap, Matrix4, Vector3 } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const renderer = new ToonRenderer(webGL2RenderingContext);
	 * const builder = new MeshBuilder();
	 * builder.addPart(createSphereGeometry(0.3, 20, 14), Matrix4.createIdentity(), "#ffe080", { glow: 1, hasOutline: false });
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
		const lightViewProjectionMatrix = shadowMap.getLightViewProjectionMatrix();
		const resolution = shadowMap.getResolution();
		this.#shadowInput = { depthTexture: shadowMap.getDepthTexture(), lightViewProjectionMatrix: lightViewProjectionMatrix, resolution: resolution, strength: strength, bias: readShadowBias(lightViewProjectionMatrix, resolution, shadowMap.getDepthBias(), shadowMap.getNormalBias()) };
	}

	//==============================================================================
	// 모서리 어둠 텍스처 설정. (ToonPostProcess.drawAmbientOcclusion 의 결과나 null, 다음 beginFrame 부터)
	// - 텍스처를 건 동안 몸은 모서리 어둠 몸 프로그램(TOON_AMBIENT_OCCLUSION)으로 그리고, 화면 자리의 보임을 바탕빛(하늘과 땅 빛)에 곱한다.
	// - 직접 빛 몫(directLightingStrength, 0 ~ 1)이 0 보다 크면 해, 채움빛, 점광과 스포트라이트의 확산과 반사광에도 1 - 몫 x (1 - 보임) 을 곱한다. (유니티 URP SSAO 의 Direct Lighting Strength 꼴)
	//   칸(밝기 단계)을 고른 뒤에 곱해 칸 경계 자리는 옮겨 가지 않는다. 테두리빛, 빛남, 매트캡, 천사 고리는 그대로다. 몫 0 이면 바탕빛에만 곱한다.
	// - 비치는 것(alpha 나 틴트 알파가 1 보다 작음)과 텍스처의 깊이와 다른 면(선의 판에 없던 것)은 곱하지 않는다.
	// - null 이면 기본 몸 프로그램으로 돌아가 텍스처를 읽지 않는다. (끈 화면은 건 적이 없을 때와 같다)
	// - 머티리얼 텍스처 8 개를 다 쓰는 머티리얼은 조각 셰이더 유닛이 16 개인 기기에서 모서리 어둠 없이 그린다.
	//==============================================================================
	/**
	 * @param { WebGLTexture | null } texture - 선의 판 크기의 RGBA8. (r 보임, gba 깊이 24 비트, null 이면 끈다)
	 * @param { number } [directLightingStrength] - 직접 빛에 미치는 몫 0 ~ 1. (기본 0, 바탕빛에만 곱함)
	 * @example <caption>모서리 어둠을 걸고 그린 뒤 풀기</caption>
	 * import { ToonRenderer } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const renderer = new ToonRenderer(webGL2RenderingContext);
	 * const texture = webGL2RenderingContext.createTexture();
	 * webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, texture);
	 * webGL2RenderingContext.texStorage2D(webGL2RenderingContext.TEXTURE_2D, 1, webGL2RenderingContext.RGBA8, 300, 150);
	 * renderer.setAmbientOcclusionTexture(texture, 0.5);
	 * if (renderer.getAmbientOcclusionTexture() !== texture || renderer.getAmbientOcclusionDirectLightingStrength() !== 0.5) {
	 * 	throw new Error("ambient occlusion texture is not set");
	 * }
	 * renderer.setAmbientOcclusionTexture(null);
	 */
	setAmbientOcclusionTexture(texture, directLightingStrength = 0) {
		this.#frameSerial += 1;
		this.#lastProgramKey = null;
		this.#ambientOcclusionInput = texture !== null && texture !== undefined ? { texture: texture, origin: [0, 0], directLightingStrength: System.Math.max(0, System.Math.min(1, directLightingStrength)) } : null;
	}

	//==============================================================================
	// 모서리 어둠이 직접 빛에 미치는 몫 반환. (setAmbientOcclusionTexture 의 둘째 인자, 걸지 않았으면 0)
	//==============================================================================
	/**
	 * @returns { number } 0 ~ 1.
	 */
	getAmbientOcclusionDirectLightingStrength() {
		return this.#ambientOcclusionInput !== null ? this.#ambientOcclusionInput.directLightingStrength : 0;
	}

	//==============================================================================
	// 모서리 어둠 텍스처 반환. (걸지 않았으면 null)
	//==============================================================================
	/**
	 * @returns { WebGLTexture | null } setAmbientOcclusionTexture 로 건 텍스처.
	 */
	getAmbientOcclusionTexture() {
		return this.#ambientOcclusionInput !== null ? this.#ambientOcclusionInput.texture : null;
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
	// 색 공간 반환. (생성 때 정한 값, 바뀌지 않는다)
	//==============================================================================
	/**
	 * @returns { string } ColorSpace.gamma 나 ColorSpace.linear.
	 * @example <caption>선형 색 공간 렌더러를 짓고 같은 값으로 후처리와 화면 바깥선 짓기</caption>
	 * import { ToonRenderer, ToonPostProcess, ToonScreenOutline, ColorSpace } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const renderer = new ToonRenderer(webGL2RenderingContext, { colorSpace: ColorSpace.linear });
	 * const postProcess = new ToonPostProcess(webGL2RenderingContext, 320, 180, { colorSpace: renderer.getColorSpace() });
	 * const screenOutline = new ToonScreenOutline(webGL2RenderingContext, { colorSpace: renderer.getColorSpace() });
	 * if (renderer.getColorSpace() !== ColorSpace.linear || postProcess.getColorSpace() !== ColorSpace.linear || screenOutline.getColorSpace() !== ColorSpace.linear) {
	 * 	throw new Error("color space is not linear");
	 * }
	 */
	getColorSpace() {
		return this.#colorSpace;
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
