//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { ShaderProgram } from "../../core/graphic/shaderprogram.js";
import { TOON_ATTRIBUTE_LOCATIONS, TOON_MAXIMUM_JOINTS, TOON_INSTANCE_FLOAT_COUNT, extractFrustumPlanes, readMatrixDeterminant, writeInstanceBufferSphere, isSphereInFrustum, readHypot, createMeshInstanceVertexArray } from "./toonrenderer.js";
import { TOON_INSTANCE_MATRIX_NAME, TOON_INSTANCE_LINE_ID_LOCATION } from "./toonmaterial.js";
import { readColorSpace, readEngineColorSpace, addColorSpaceDefine } from "../../core/graphic/colorspace.js";


/**
 * @example <caption>툰 화면 공간 바깥선을 한 프레임에 긋기</caption>
 * import { ToonRenderer, ToonScreenOutline, ToonOutlineWidthUnit, MeshBuilder, createBoxGeometry, Matrix4, Vector3 } from "./vanilla.js";
 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
 * const renderer = new ToonRenderer(webGL2RenderingContext);
 * const outline = new ToonScreenOutline(webGL2RenderingContext);
 * outline.setWidth(2, ToonOutlineWidthUnit.pixel);
 * outline.setCrease(50, 1, 0.8);
 * const builder = new MeshBuilder();
 * builder.addPart(createBoxGeometry(1, 1, 1), Matrix4.createIdentity(), "#e0c8a8", { hasOutline: false });
 * const mesh = renderer.createMesh(builder.readArrays());
 * const viewMatrix = Matrix4.createLookAt(Vector3.create(2, 2, 3), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
 * const projectionMatrix = Matrix4.createPerspective(Math.PI / 4, 1, 0.1, 100);
 * const modelMatrix = Matrix4.createIdentity();
 * if (outline.beginLineIds(viewMatrix, projectionMatrix)) {
 * 	outline.drawMesh(mesh, modelMatrix, 1);
 * 	outline.endLineIds();
 * }
 * renderer.beginFrameWithMatrices(viewMatrix, projectionMatrix);
 * renderer.drawMesh(mesh, modelMatrix);
 * renderer.endFrame();
 * outline.drawOutline();
 * @exampleImage toon-style.webp
 */


//==============================================================================
// 전역 상수 목록.
//==============================================================================
/**
 * 굵기의 단위.
 * - world: 월드 길이. (직교는 투영의 세로 배율로, 원근은 초점 거리에서 화면 픽셀로 셈해 멀수록 가늘어진다)
 * - pixel: 그리는 영역의 픽셀. (거리와 상관없이 같은 굵기)
 * @example <caption>월드 길이로 굵기 주기</caption>
 * import { ToonScreenOutline, ToonOutlineWidthUnit } from "./vanilla.js";
 * const outline = new ToonScreenOutline(document.createElement("canvas").getContext("webgl2"));
 * outline.setWidth(0.02, ToonOutlineWidthUnit.world);
 * outline.setFocusDistance(6);
 */
export const ToonOutlineWidthUnit = System.Object.freeze({
	world: "world", // 월드 길이. (멀수록 가늘어진다)
	pixel: "pixel", // 그리는 영역의 픽셀. (거리와 상관없이 같은 굵기)
});

// 판을 덮어쓰기 앞에 비울 값. (정수 판은 uiv, 곱한 색 판은 fv)
const ZERO_CLEAR_VALUE = new System.Uint32Array(4);
const ZERO_CLEAR_FLOAT_VALUE = new System.Float32Array(4);

// 선 번호의 상한. (선의 판에 14 비트로 쓴다, 0 은 빈 곳)
export const TOON_SCREEN_OUTLINE_MAXIMUM_LINE_ID = 16383;

// 씨앗 판에서 씨앗이 없다는 값. (부호 없는 16 비트의 끝)
const NO_SEED = 65535;
const BATCH_SLOT_MESH_LIMIT = 8; // 묶음 자리마다 버텍스 어레이를 지어 둘 모형 수. (넘으면 그 자리의 것을 모두 지우고 다시, 몸 묶음 자리와 같은 값)

// 인스턴스 그리기의 modelMatrix 자리. (단위 행렬)
const IDENTITY_ELEMENTS = new System.Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const INSTANCE_BUFFER_SPHERE = [0, 0, 0, 0]; // 인스턴스 버퍼 거르기의 경계 구 칸. (다시 쓴다, 그리기마다 짓지 않게)

// 선의 판과 씨앗 판을 묶는 텍스처 유닛. (툰 렌더러의 그림자 유닛 3 과 겹치지 않게, 섞기는 번호 색 표를 4, 선의 판을 6, 깊이를 7 에)
const LINE_TEXTURE_UNIT = 5;
const DEPTH_TEXTURE_UNIT = 6;
const LINE_COLOR_TEXTURE_UNIT = 4;
const COMPOSITE_LINE_TEXTURE_UNIT = 6;
const COMPOSITE_DEPTH_TEXTURE_UNIT = 7;

// 가는 선 길의 가장 큰 굵기. (그리는 영역 픽셀, 2 x sqrt(4.5) - 1 = 약 3.24)
// - 덮는 몫이 0 보다 크려면 거리가 굵기 / 2 + 0.5 보다 작아야 한다. 이 굵기까지는 덮는 토막이 모두 화소 하나 거리(0.5, 0.71)나 두 칸 사이(1.5, 1.58)에 있고,
//   그 토막은 둘레 3 x 3 화소의 첫 경계(씨앗)에 든다. 섞기가 그 아홉을 점프 플러딩 마지막 걸음과 같은 차례로 본다. 이보다 굵으면 점프 플러딩 길로 간다. (광부 키우기 1.7 ~ 2.7, 기본 2)
const THIN_LINE_MAXIMUM_WIDTH = 2 * System.Math.sqrt(4.5) - 1;

// 번호 색 표 텍스처의 너비. (선 번호 0 ~ TOON_SCREEN_OUTLINE_MAXIMUM_LINE_ID 를 128 x 128 칸에 하나씩, 번호 % 128 이 x, 번호 / 128 이 y)
const LINE_COLOR_TABLE_WIDTH = 128;

// 선의 판에 노멀과 선 번호를 그리는 셰이더. (툰 렌더러의 몸 버텍스 어레이를 그대로 쓴다)
// - instanceLineIds: 0 이면 공통 번호, 1 이면 틴트 칸의 x (drawMeshInstanced 가 담은 것), 2 면 인스턴스 버퍼의 instanceLineId (drawMeshInstanceBuffer).
const LINE_VERTEX_SHADER = `#version 300 es
in vec3 vertexPosition;
in vec3 vertexNormal;
in vec4 vertexJoints;
in vec4 vertexWeights;
in vec4 instanceMatrix0;
in vec4 instanceMatrix1;
in vec4 instanceMatrix2;
in vec4 instanceMatrix3;
in vec4 instanceTint;
in float instanceLineId;
uniform mat4 jointMatrices[${TOON_MAXIMUM_JOINTS}];
uniform float skinned;
uniform float instanced;
uniform float instanceLineIds;
uniform mat4 viewProjectionMatrix;
uniform mat4 modelMatrix;
uniform float lineId;
out vec3 worldNormal;
flat out float surfaceLineId;
mat4 readSkinMatrix() {
	if (skinned < 0.5) {
		return mat4(1.0);
	}
	return jointMatrices[int(vertexJoints.x)] * vertexWeights.x + jointMatrices[int(vertexJoints.y)] * vertexWeights.y + jointMatrices[int(vertexJoints.z)] * vertexWeights.z + jointMatrices[int(vertexJoints.w)] * vertexWeights.w;
}
void main() {
	mat4 skinMatrix = readSkinMatrix();
	mat4 objectMatrix = instanced > 0.5 ? mat4(vec4(instanceMatrix0.xyz, 0.0), vec4(instanceMatrix1.xyz, 0.0), vec4(instanceMatrix2.xyz, 0.0), vec4(instanceMatrix3.xyz, 1.0)) : modelMatrix;
	worldNormal = transpose(inverse(mat3(objectMatrix) * mat3(skinMatrix))) * vertexNormal;
	surfaceLineId = instanced < 0.5 || instanceLineIds < 0.5 ? lineId : (instanceLineIds < 1.5 ? instanceTint.x : instanceLineId);
	gl_Position = viewProjectionMatrix * objectMatrix * skinMatrix * vec4(vertexPosition, 1.0);
}
`;
// 노멀은 팔면체로 접어 rg, 번호는 낮은 8 비트를 b, 높은 6 비트와 꼴 2 비트(꺾임 선 64, 바깥 선 128)를 a 에 쓴다.
const LINE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 worldNormal;
flat in float surfaceLineId;
uniform float lineFlags;
out vec4 fragmentLine;
vec2 wrapOctahedron(vec2 value) {
	return (1.0 - abs(value.yx)) * vec2(value.x >= 0.0 ? 1.0 : -1.0, value.y >= 0.0 ? 1.0 : -1.0);
}
void main() {
	vec3 normal = normalize(worldNormal);
	normal /= abs(normal.x) + abs(normal.y) + abs(normal.z);
	vec2 folded = normal.y >= 0.0 ? normal.xz : wrapOctahedron(normal.xz);
	float lowPart = mod(surfaceLineId, 256.0);
	float highPart = mod(floor(surfaceLineId / 256.0), 64.0);
	fragmentLine = vec4(folded * 0.5 + 0.5, lowPart / 255.0, (highPart + lineFlags * 64.0) / 255.0);
}
`;
// 화면을 덮는 세모 하나.
const SCREEN_TRIANGLE_VERTEX_SHADER = `#version 300 es
const vec2 TRIANGLE_POINTS[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() {
	gl_Position = vec4(TRIANGLE_POINTS[gl_VertexID], 0.0, 1.0);
}
`;
// 씨앗을 고르는 셰이더. (화소와 바로 이웃 넷 사이의 경계마다 선인지 보고, 선이면 그 경계의 가운데를 씨앗으로 쓴다)
// - 씨앗은 반 화소 단위 자리다. (x 가 홀수면 가로 이웃 사이의 세로 경계, y 가 홀수면 세로 이웃 사이의 가로 경계) rg 는 바깥 선, ba 는 꺾임 선.
// - 같은 경계를 양쪽 화소가 함께 씨앗으로 들어도 선은 경계 한가운데 하나다. (선을 화소가 아니라 화소 사이에 둔다)
// - 바깥 선: 한쪽이 빈 곳, 번호가 다름, 같은 번호라도 가린 화소가 가려진 화소의 접평면에서 깊이 문턱과 오차 여유를 더한 것보다 떨어짐. (가린 쪽의 꼴을 따르고, 맞닿은 두 번호는 한쪽만 켜져 있어도 긋는다)
//   가려진 쪽의 접평면만 쓴다. 가린 쪽이 둥근 면의 실루엣이면 그 접평면이 시선을 품어, 뒤의 면이 얼마나 떨어져 있든 거리가 화소 한 칸 밑으로 줄기 때문이다.
//   오차 여유는 이어진 면에서도 생기는 거리의 오차를 잰 것이다: 노멀 8 비트 팔면체의 각 오차 x 두 자리 사이 거리(면이 비스듬할수록 길다), 꺾인 줄을 사이에 둔 두 화소의 화소 한 칸 x 두 노멀이 벌어진 사인, 깊이 24 비트 한 칸.
//   거기에 여유 배율(setDepthMargin)을 곱한다. 두 면이 나란한 턱은 꺾임 몫이 0 이라 화소 한 칸보다 낮아도 잡힌다.
// - 꺾임 선: 같은 번호이고 떨어지지 않았는데 두 노멀이 꺾임 각보다 더 벌어짐. (비스듬한 면과 둥근 면은 접평면 안이라 바깥 선으로 잡히지 않는다)
// - 경계를 보는 함수(readPixel, readEdge)는 가는 선의 씨앗 쪽 판 셰이더와 같이 쓴다. (LINE_EDGE_SHADER_PART)
const LINE_EDGE_SHADER_PART = `precision highp float;
precision highp int;
uniform highp sampler2D lineTexture;
uniform highp sampler2D depthTexture;
uniform mat3 viewRotation;
uniform vec4 projectionScale;
uniform vec4 projectionDepth;
uniform float isPerspective;
uniform float depthThreshold;
uniform float depthMargin;
uniform float creaseCosine;
const float NORMAL_ERROR = 0.0165;
const float DEPTH_STEP = 1.0 / 16777215.0;
const ivec2 SIDES[4] = ivec2[4](ivec2(1, 0), ivec2(-1, 0), ivec2(0, 1), ivec2(0, -1));
struct LinePixel {
	float id;
	float flags;
	vec3 normal;
	vec3 position;
	float footprint;
	float depthError;
};
vec3 readNormal(vec2 encoded) {
	vec2 folded = encoded * 2.0 - 1.0;
	vec3 normal = vec3(folded.x, 1.0 - abs(folded.x) - abs(folded.y), folded.y);
	float fold = max(-normal.y, 0.0);
	normal.x += normal.x >= 0.0 ? -fold : fold;
	normal.z += normal.z >= 0.0 ? -fold : fold;
	return normalize(normal);
}
LinePixel readPixel(ivec2 pixel, vec2 size) {
	vec4 value = texelFetch(lineTexture, pixel, 0);
	float highPart = floor(value.a * 255.0 + 0.5);
	LinePixel result;
	result.id = floor(value.b * 255.0 + 0.5) + mod(highPart, 64.0) * 256.0;
	result.flags = floor(highPart / 64.0);
	result.normal = normalize(viewRotation * readNormal(value.rg));
	float clipDepth = texelFetch(depthTexture, pixel, 0).r * 2.0 - 1.0;
	vec2 clipPoint = (vec2(pixel) + 0.5) / size * 2.0 - 1.0;
	if (isPerspective > 0.5) {
		float viewZ = -projectionDepth.y / (clipDepth + projectionDepth.x);
		result.position = vec3(-viewZ * (clipPoint.x + projectionScale.z) / projectionScale.x, -viewZ * (clipPoint.y + projectionScale.w) / projectionScale.y, viewZ);
		result.footprint = -viewZ * 2.0 / (projectionScale.y * size.y);
		result.depthError = DEPTH_STEP * viewZ * viewZ / abs(projectionDepth.y) * length(result.position) / max(-viewZ, 1e-6);
	}
	else {
		float viewZ = (clipDepth - projectionDepth.y) / projectionDepth.x;
		result.position = vec3((clipPoint.x - projectionDepth.z) / projectionScale.x, (clipPoint.y - projectionDepth.w) / projectionScale.y, viewZ);
		result.footprint = 2.0 / (projectionScale.y * size.y);
		result.depthError = DEPTH_STEP / abs(projectionDepth.x);
	}
	return result;
}
bool hasContour(float flags) {
	return flags >= 1.5;
}
bool hasCrease(float flags) {
	return mod(flags, 2.0) > 0.5;
}
int readEdge(LinePixel first, LinePixel second) {
	if (first.id < 0.5 && second.id < 0.5) {
		return 0;
	}
	bool isFirstNearer = second.id < 0.5 || (first.id > 0.5 && first.position.z >= second.position.z);
	float nearFlags = isFirstNearer ? first.flags : second.flags;
	float farId = isFirstNearer ? second.id : first.id;
	if (farId < 0.5) {
		return hasContour(nearFlags) ? 2 : 0;
	}
	LinePixel nearPixel = first;
	LinePixel farPixel = second;
	if (!isFirstNearer) {
		nearPixel = second;
		farPixel = first;
	}
	vec3 offset = nearPixel.position - farPixel.position;
	float planeDistance = abs(dot(offset, farPixel.normal));
	float pixelError = length(offset) * NORMAL_ERROR + nearPixel.footprint * length(cross(nearPixel.normal, farPixel.normal)) + nearPixel.depthError + farPixel.depthError;
	bool isSeparated = planeDistance > depthThreshold + depthMargin * pixelError;
	if (isSeparated) {
		return hasContour(nearFlags) ? 2 : 0;
	}
	if (abs(first.id - second.id) > 0.5) {
		return hasContour(first.flags) || hasContour(second.flags) ? 2 : 0;
	}
	if (hasCrease(nearFlags) && dot(first.normal, second.normal) < creaseCosine) {
		return 1;
	}
	return 0;
}
`;
const SEED_FRAGMENT_SHADER = `#version 300 es
${LINE_EDGE_SHADER_PART}out uvec4 fragmentSeed;
const uint NO_SEED = 65535u;
void main() {
	ivec2 size = textureSize(lineTexture, 0);
	vec2 sizeValue = vec2(size);
	ivec2 pixel = ivec2(gl_FragCoord.xy);
	LinePixel center = readPixel(pixel, sizeValue);
	uvec2 contourSeed = uvec2(NO_SEED);
	uvec2 creaseSeed = uvec2(NO_SEED);
	for (int index = 0; index < 4; ++index) {
		ivec2 neighborPixel = pixel + SIDES[index];
		if (neighborPixel.x < 0 || neighborPixel.y < 0 || neighborPixel.x >= size.x || neighborPixel.y >= size.y) {
			continue;
		}
		int edge = readEdge(center, readPixel(neighborPixel, sizeValue));
		uvec2 seed = uvec2(pixel * 2 + SIDES[index]);
		if (edge == 2 && contourSeed.x == NO_SEED) {
			contourSeed = seed;
		}
		if (edge == 1 && creaseSeed.x == NO_SEED) {
			creaseSeed = seed;
		}
	}
	fragmentSeed = uvec4(contourSeed, creaseSeed);
}
`;
// 가는 선의 씨앗 쪽 판을 고르는 셰이더. (씨앗 셰이더와 같은 차례로 화소마다 바깥 선과 꺾임 선의 첫 경계 쪽을 고르고, 씨앗 자리 대신 쪽 번호만 담는다)
// - 아래 3 비트는 바깥 선, 그 위 3 비트는 꺾임 선의 쪽이다. 0 은 없음, 1 ~ 4 는 SIDES 차례(오른쪽, 왼쪽, 위, 아래)에서 처음 선이 선 쪽. (R8UI 한 바이트)
// - 씨앗은 화소 * 2 + 쪽이므로 씨앗 판과 같은 것을 한 바이트에 담는다. (씨앗 판은 RGBA16UI 8 바이트)
const EDGE_MASK_FRAGMENT_SHADER = `#version 300 es
${LINE_EDGE_SHADER_PART}out uint fragmentMask;
void main() {
	ivec2 size = textureSize(lineTexture, 0);
	vec2 sizeValue = vec2(size);
	ivec2 pixel = ivec2(gl_FragCoord.xy);
	LinePixel center = readPixel(pixel, sizeValue);
	uint contourSide = 0u;
	uint creaseSide = 0u;
	for (int index = 0; index < 4; ++index) {
		ivec2 neighborPixel = pixel + SIDES[index];
		if (neighborPixel.x < 0 || neighborPixel.y < 0 || neighborPixel.x >= size.x || neighborPixel.y >= size.y) {
			continue;
		}
		int edge = readEdge(center, readPixel(neighborPixel, sizeValue));
		if (edge == 2 && contourSide == 0u) {
			contourSide = uint(index + 1);
		}
		if (edge == 1 && creaseSide == 0u) {
			creaseSide = uint(index + 1);
		}
	}
	fragmentMask = contourSide | (creaseSide << 3u);
}
`;
// 온 해상도 씨앗을 넓히기 판으로 모으는 셰이더. (넓히기 판 한 칸이 덮는 씨앗 판 칸들 가운데 칸 가운데에 가장 가까운 씨앗을 고른다, 줄이지 않으면 그대로 옮김)
const SEED_GATHER_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;
uniform highp usampler2D seedTexture;
uniform vec2 pointScale;
out uvec4 fragmentSeed;
const uint NO_SEED = 65535u;
float readSeedDistance(vec2 point, uvec2 seed) {
	if (seed.x == NO_SEED) {
		return 1.0e9;
	}
	vec2 offset = abs(point - vec2(seed) * 0.5);
	if ((seed.x & 1u) == 1u) {
		offset.y = max(offset.y - 0.5, 0.0);
	}
	else {
		offset.x = max(offset.x - 0.5, 0.0);
	}
	return length(offset);
}
void main() {
	ivec2 size = textureSize(seedTexture, 0);
	ivec2 pixel = ivec2(gl_FragCoord.xy);
	vec2 point = (vec2(pixel) + 0.5) * pointScale - 0.5;
	ivec2 start = ivec2(floor(vec2(pixel) * pointScale));
	ivec2 end = min(ivec2(ceil((vec2(pixel) + 1.0) * pointScale)), size);
	uvec4 best = uvec4(NO_SEED);
	float bestContour = 1.0e9;
	float bestCrease = 1.0e9;
	for (int offsetY = 0; offsetY < 5; ++offsetY) {
		for (int offsetX = 0; offsetX < 5; ++offsetX) {
			ivec2 samplePixel = start + ivec2(offsetX, offsetY);
			if (samplePixel.x >= end.x || samplePixel.y >= end.y) {
				continue;
			}
			uvec4 seed = texelFetch(seedTexture, samplePixel, 0);
			float contourDistance = readSeedDistance(point, seed.xy);
			if (contourDistance < bestContour) {
				bestContour = contourDistance;
				best.xy = seed.xy;
			}
			float creaseDistance = readSeedDistance(point, seed.zw);
			if (creaseDistance < bestCrease) {
				bestCrease = creaseDistance;
				best.zw = seed.zw;
			}
		}
	}
	fragmentSeed = best;
}
`;
// 씨앗 판의 가까운 씨앗을 넓히는 점프 플러딩 한 번. (stepSize 떨어진 이웃 여덟과 자기를 보고 경계 토막까지 가장 가까운 씨앗을 남긴다)
// - 넓히기 판은 줄인 판일 수 있다. 칸 가운데를 그리는 영역 화소 좌표(pointScale 배)로 옮겨 재므로 씨앗 자리는 늘 그리는 영역 화소다.
const JUMP_FLOOD_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;
uniform highp usampler2D seedTexture;
uniform int stepSize;
uniform vec2 pointScale;
out uvec4 fragmentSeed;
const uint NO_SEED = 65535u;
float readSeedDistance(vec2 point, uvec2 seed) {
	if (seed.x == NO_SEED) {
		return 1.0e9;
	}
	vec2 offset = abs(point - vec2(seed) * 0.5);
	if ((seed.x & 1u) == 1u) {
		offset.y = max(offset.y - 0.5, 0.0);
	}
	else {
		offset.x = max(offset.x - 0.5, 0.0);
	}
	return length(offset);
}
void main() {
	ivec2 size = textureSize(seedTexture, 0);
	ivec2 pixel = ivec2(gl_FragCoord.xy);
	vec2 point = (vec2(pixel) + 0.5) * pointScale - 0.5;
	uvec4 best = uvec4(NO_SEED);
	float bestContour = 1.0e9;
	float bestCrease = 1.0e9;
	for (int offsetY = -1; offsetY <= 1; ++offsetY) {
		for (int offsetX = -1; offsetX <= 1; ++offsetX) {
			ivec2 samplePixel = pixel + ivec2(offsetX, offsetY) * stepSize;
			if (samplePixel.x < 0 || samplePixel.y < 0 || samplePixel.x >= size.x || samplePixel.y >= size.y) {
				continue;
			}
			uvec4 seed = texelFetch(seedTexture, samplePixel, 0);
			float contourDistance = readSeedDistance(point, seed.xy);
			if (contourDistance < bestContour) {
				bestContour = contourDistance;
				best.xy = seed.xy;
			}
			float creaseDistance = readSeedDistance(point, seed.zw);
			if (creaseDistance < bestCrease) {
				bestCrease = creaseDistance;
				best.zw = seed.zw;
			}
		}
	}
	fragmentSeed = best;
}
`;
// 그리는 영역의 화소마다 가까운 씨앗까지의 거리(그리는 영역 픽셀)로 선이 덮는 몫을 셈해 섞는 셰이더. (미리 곱한 알파)
// - 넓히기 판에서 둘레 2x2 칸의 씨앗을 보고 경계 토막까지의 거리를 그리는 영역 화소로 잰다. 씨앗이 그리는 영역 화소의 경계라 넓히기 판을 줄여도 계단과 점선이 없다.
// - 덮는 몫은 clamp(굵기 / 2 - 거리 + 0.5, 0, 1) 이다. (픽셀 상자로 거른 선, 가장자리가 부드럽다)
// - 번호 색 표를 켜면(lineColorEnabled) 가장 가까운 씨앗의 경계 양쪽 화소에서 앞쪽(깊이가 작은 쪽, 한쪽이 빈 곳이면 다른 쪽) 번호를 읽어 표에서 색을 찾는다.
//   표의 알파가 0 이면 표에 없는 번호라 선 색 그대로다. 바깥 선과 꺾임 선이 따로 찾고, 더 진한 쪽의 색을 쓴다.
// - 색 찾기, 거리, 덮는 몫을 색으로 쓰는 앞부분(COMPOSITE_SHADER_PART)은 가는 선 섞기와 같이 쓴다.
const COMPOSITE_SHADER_PART = `precision highp float;
precision highp int;
uniform highp sampler2D lineTexture;
uniform highp sampler2D depthTexture;
uniform highp sampler2D lineColorTexture;
uniform float lineColorEnabled;
uniform vec4 viewportRect;
uniform vec2 lineWidths;
uniform float creaseOpacity;
uniform vec4 outlineColor;
uniform float hdrOutput;
uniform vec2 lineScale; // 선의 판 화소 수 / 그리는 영역 화소 수. (1 이면 같은 해상도)
out vec4 fragmentColor;
const uint NO_SEED = 65535u;
float readLineId(ivec2 pixel) {
	vec4 value = texelFetch(lineTexture, pixel, 0);
	return floor(value.b * 255.0 + 0.5) + mod(floor(value.a * 255.0 + 0.5), 64.0) * 256.0;
}
vec4 readSeedColor(uvec2 seed) {
	if (seed.x == NO_SEED) {
		return outlineColor;
	}
	ivec2 size = textureSize(lineTexture, 0);
	ivec2 firstPixel = clamp(ivec2(seed >> 1u), ivec2(0), size - 1);
	ivec2 secondPixel = clamp(ivec2((seed + 1u) >> 1u), ivec2(0), size - 1);
	float firstId = readLineId(firstPixel);
	float secondId = readLineId(secondPixel);
	bool isFirstNearer = secondId < 0.5 || (firstId > 0.5 && texelFetch(depthTexture, firstPixel, 0).r <= texelFetch(depthTexture, secondPixel, 0).r);
	int id = int(isFirstNearer ? firstId : secondId);
	vec4 tableColor = texelFetch(lineColorTexture, ivec2(id % ${LINE_COLOR_TABLE_WIDTH}, id / ${LINE_COLOR_TABLE_WIDTH}), 0);
	return tableColor.a > 0.0 ? tableColor : outlineColor;
}
float readSeedDistance(vec2 point, uvec2 seed, vec2 toOutput) {
	if (seed.x == NO_SEED) {
		return 1.0e9;
	}
	vec2 offset = abs(point - vec2(seed) * 0.5);
	if ((seed.x & 1u) == 1u) {
		offset.y = max(offset.y - 0.5, 0.0);
	}
	else {
		offset.x = max(offset.x - 0.5, 0.0);
	}
	return length(offset * toOutput);
}
void writeLineColor(float contourDistance, float creaseDistance, uvec2 contourSeed, uvec2 creaseSeed) {
	float contour = lineWidths.x > 0.0 ? clamp(lineWidths.x * 0.5 - contourDistance + 0.5, 0.0, 1.0) : 0.0;
	float crease = lineWidths.y > 0.0 ? clamp(lineWidths.y * 0.5 - creaseDistance + 0.5, 0.0, 1.0) * creaseOpacity : 0.0;
	vec4 lineColor = outlineColor;
	float strength = max(contour, crease) * outlineColor.a;
	if (lineColorEnabled > 0.5 && max(contour, crease) > 0.0) {
		vec4 contourColor = contour > 0.0 ? readSeedColor(contourSeed) : outlineColor;
		vec4 creaseColor = crease > 0.0 ? readSeedColor(creaseSeed) : outlineColor;
		float contourStrength = contour * contourColor.a;
		float creaseStrength = crease * creaseColor.a;
		lineColor = contourStrength >= creaseStrength ? contourColor : creaseColor;
		strength = max(contourStrength, creaseStrength);
	}
	if (strength < 0.004) {
#ifdef VANILLA_COVERAGE_PASS
		fragmentColor = vec4(0.0);
		return;
#else
		discard;
#endif
	}
#ifdef VANILLA_COLOR_SPACE_LINEAR
	vec3 linearColor = max(lineColor.rgb, vec3(0.0));
	linearColor = mix(linearColor / 12.92, pow((linearColor + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), linearColor));
	vec3 color = hdrOutput > 0.5 ? linearColor : lineColor.rgb;
#else
	vec3 color = hdrOutput > 0.5 ? pow(lineColor.rgb, vec3(2.2)) : lineColor.rgb;
#endif
	fragmentColor = vec4(color * strength, strength);
}
`;
const COMPOSITE_FRAGMENT_SHADER = `#version 300 es
${COMPOSITE_SHADER_PART}uniform highp usampler2D seedTexture;
uniform vec2 pointScale;
void main() {
	ivec2 size = textureSize(seedTexture, 0);
	vec2 toOutput = 1.0 / lineScale;
	vec2 point = (gl_FragCoord.xy - viewportRect.xy) * lineScale - 0.5;
	ivec2 basePixel = ivec2(floor((point + 0.5) / pointScale - 0.5));
	float contourDistance = 1.0e9;
	float creaseDistance = 1.0e9;
	uvec2 contourSeed = uvec2(NO_SEED);
	uvec2 creaseSeed = uvec2(NO_SEED);
	for (int offsetY = 0; offsetY <= 1; ++offsetY) {
		for (int offsetX = 0; offsetX <= 1; ++offsetX) {
			ivec2 samplePixel = clamp(basePixel + ivec2(offsetX, offsetY), ivec2(0), size - 1);
			uvec4 seed = texelFetch(seedTexture, samplePixel, 0);
			float sampleContourDistance = readSeedDistance(point, seed.xy, toOutput);
			if (sampleContourDistance < contourDistance) {
				contourDistance = sampleContourDistance;
				contourSeed = seed.xy;
			}
			float sampleCreaseDistance = readSeedDistance(point, seed.zw, toOutput);
			if (sampleCreaseDistance < creaseDistance) {
				creaseDistance = sampleCreaseDistance;
				creaseSeed = seed.zw;
			}
		}
	}
	writeLineColor(contourDistance, creaseDistance, contourSeed, creaseSeed);
}
`;
// 가는 선을 한 패스로 섞는 셰이더. (점프 플러딩 없이 둘레 3 x 3 화소의 씨앗을 점프 플러딩 마지막 걸음과 같은 차례로 보고 가장 가까운 것까지의 거리로 덮는 몫을 셈한다)
// - 화소 q 의 씨앗은 q * 2 + 쪽이다. 아래 줄부터, 줄 안은 왼쪽부터 보고 거리가 더 작을 때만 바꾼다. (점프 플러딩 걸음 1 과 같은 차례, 같은 거리면 먼저 본 것)
//   그래서 선 색이 다른 두 번호가 맞닿아 같은 거리 토막이 여럿인 자리도 점프 플러딩 길과 거의 같은 쪽을 고른다. (앞 걸음에서 씨앗을 넘겨받은 빈 화소만 다를 수 있다)
// - 씨앗에서 화소까지의 자리는 고리 칸마다 정해진 반 정수라 거리가 정확하다. 거리는 제곱으로 견주고 끝에 한 번 sqrt 한다. 고르기는 갈래 없이 고른다.
// - 색 찾기와 덮는 몫은 점프 플러딩 길과 같은 함수다.
const THIN_COMPOSITE_FRAGMENT_SHADER = `#version 300 es
${COMPOSITE_SHADER_PART}uniform highp usampler2D edgeMaskTexture;
const vec2 SIDE_OFFSETS[5] = vec2[5](vec2(0.0, 0.0), vec2(1.0, 0.0), vec2(-1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, -1.0));
float readSideDistance(vec2 base, vec2 side) {
	vec2 offset = max(abs(base + side * 0.5) - abs(side.yx) * 0.5, vec2(0.0));
#ifdef VANILLA_COVERAGE_PASS
	offset *= 1.0 / lineScale;
#endif
	return dot(offset, offset);
}
void main() {
	ivec2 size = textureSize(lineTexture, 0);
#ifdef VANILLA_COVERAGE_PASS
	vec2 point = gl_FragCoord.xy - 0.5;
#else
	vec2 point = gl_FragCoord.xy - viewportRect.xy - 0.5;
#endif
	ivec2 pixel = ivec2(floor(point + 0.5));
	float contourDistance = 1.0e18;
	float creaseDistance = 1.0e18;
	uvec2 contourSeed = uvec2(NO_SEED);
	uvec2 creaseSeed = uvec2(NO_SEED);
	for (int offsetY = -1; offsetY <= 1; ++offsetY) {
		for (int offsetX = -1; offsetX <= 1; ++offsetX) {
			ivec2 wantedPixel = pixel + ivec2(offsetX, offsetY);
			ivec2 samplePixel = clamp(wantedPixel, ivec2(0), size - 1);
			uint sides = texelFetch(edgeMaskTexture, samplePixel, 0).r;
			sides = samplePixel == wantedPixel ? sides : 0u;
			uint contourSide = sides & 7u;
			uint creaseSide = (sides >> 3u) & 7u;
			vec2 base = vec2(samplePixel) - point;
			vec2 contourOffset = SIDE_OFFSETS[contourSide];
			vec2 creaseOffset = SIDE_OFFSETS[creaseSide];
			float sampleContourDistance = readSideDistance(base, contourOffset);
			float sampleCreaseDistance = readSideDistance(base, creaseOffset);
			bool isTaken = contourSide != 0u && sampleContourDistance < contourDistance;
			contourDistance = isTaken ? sampleContourDistance : contourDistance;
			contourSeed = isTaken ? uvec2(samplePixel * 2 + ivec2(contourOffset)) : contourSeed;
			isTaken = creaseSide != 0u && sampleCreaseDistance < creaseDistance;
			creaseDistance = isTaken ? sampleCreaseDistance : creaseDistance;
			creaseSeed = isTaken ? uvec2(samplePixel * 2 + ivec2(creaseOffset)) : creaseSeed;
		}
	}
	writeLineColor(sqrt(contourDistance), sqrt(creaseDistance), contourSeed, creaseSeed);
}
`;


// 줄인 선의 판의 덮는 몫 판(RGBA8, 곱한 색)을 그리는 영역에 쌍선형으로 한 번 읽어 섞는 셰이더. (선의 판을 줄였을 때의 가는 선 길의 마지막 패스, 읽기 한 번)
const COVERAGE_BLIT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform highp sampler2D coverageTexture;
uniform vec4 viewportRect;
out vec4 fragmentColor;
void main() {
	vec4 color = texture(coverageTexture, (gl_FragCoord.xy - viewportRect.xy) / viewportRect.zw);
	if (color.a < 0.004) {
		discard;
	}
	fragmentColor = color;
}
`;
// 가는 선의 덮는 몫을 줄인 선의 판 해상도에서 한 번 셈하는 프로그램의 소스. (가는 선 섞기 셰이더와 같은 셈, discard 대신 0 을 쓴다)
function addCoveragePassDefine(source) {
	const lineEnd = source.indexOf("\n");
	return source.slice(0, lineEnd + 1) + "#define VANILLA_COVERAGE_PASS\n" + source.slice(lineEnd + 1);
}


//==============================================================================
// 점프 플러딩의 걸음 목록. (씨앗을 reach 화소까지 넓히는 데 드는 걸음, 큰 것부터 반씩 줄여 1 까지)
// - 걸음 k, k/2, ..., 1 은 씨앗을 2k - 1 화소까지 옮긴다. (Rong, Tan 2006)
//==============================================================================
/**
 * @param { number } reach - 씨앗을 옮길 거리. (선의 판 픽셀)
 * @returns { Array<number> } 큰 것부터 1 까지의 걸음.
 * @example <caption>4 화소까지 넓히는 걸음</caption>
 * import { readJumpFloodSteps } from "./vanilla.js";
 * const steps = readJumpFloodSteps(4);
 */
export function readJumpFloodSteps(reach) {
	const distance = System.Math.max(1, System.Math.ceil(reach));
	let step = 1;
	while (step * 2 - 1 < distance) {
		step *= 2;
	}
	const steps = [];
	while (step >= 1) {
		steps.push(step);
		step = System.Math.floor(step / 2);
	}
	return steps;
}


//==============================================================================
// 0 ~ 1 색을 바이트로. (선 색 표의 칸, 반올림)
//==============================================================================
/**
 * @param { number } value - 0 ~ 1 의 값.
 * @returns { number } 0 ~ 255.
 */
function readColorByte(value) {
	return System.Math.round(System.Math.max(0, System.Math.min(1, value)) * 255);
}


//==============================================================================
// 툰 화면 공간 바깥선. (노멀, 선 번호, 깊이를 선의 판에 그리고, 바로 이웃 사이의 경계에서 선을 잡아 가는 선은 둘레 칸을 바로 보고, 굵은 선은 점프 플러딩으로 넓힌 뒤 거리로 덮는 몫을 셈해 섞는다)
// - 선의 판: ToonRenderer 의 createMesh 결과를 같은 행렬로 한 번 더 그려 노멀(팔면체 접기), 선 번호(14 비트), 꼴(바깥 선, 꺾임 선을 켤지)과 깊이를 쓴다.
// - 잡기: 화소와 바로 이웃 넷 사이의 경계마다 한 번 본다. 선은 화소가 아니라 화소 사이의 경계 가운데에 선다. (같은 경계를 두 번 긋지 않는다)
//   바깥 선은 빈 곳과 맞닿은 실루엣, 다른 번호와 맞닿은 곳, 같은 번호라도 가린 화소가 가려진 화소의 접평면에서 깊이 문턱과 오차 여유보다 떨어진 곳(가려진 실루엣)이다.
//   꺾임 선은 같은 번호 안에서 이웃한 두 노멀이 꺾임 각보다 더 벌어진 곳이다. 화소 하나 사이의 노멀만 보므로 둥근 면의 실루엣 둘레나 비스듬한 면에 띠가 서지 않는다.
//   깊이를 접평면 거리로 견주므로 비스듬히 보는 바닥에 가짜 선이 서지 않는다. 문턱에 잰 오차(노멀 8 비트 각 오차 x 두 자리 사이 거리, 꺾임의 화소 한 칸 x 사인, 깊이 24 비트 한 칸) x 배율을 더해 먼 것도 같은 뜻이 되고, 나란한 낮은 턱은 화소 한 칸보다 낮아도 잡힌다.
// - 가는 선(굵기 약 3.24 픽셀까지): 씨앗 고르기와 같은 차례로 화소마다 첫 경계 쪽(R8UI 한 바이트)을 고르고, 섞기가 둘레 3 x 3 화소의 씨앗을 점프 플러딩 마지막 걸음과 같은 차례로 보아 가장 가까운 것까지의 거리를 잰다.
//   화면 전체 패스가 씨앗 쪽 판 하나와 섞기 하나다. (모바일 타일 GPU 에서 패스 수와 판 대역폭이 굵은 선 길의 몇 분의 1)
// - 넓히기(굵은 선): 경계 토막까지의 거리를 점프 플러딩으로 퍼뜨린다. 굵기에 상관없이 걸음 수는 log2 이고, 바깥 선과 꺾임 선은 따로 퍼뜨려 굵기를 따로 준다.
// - 섞기: 그리는 영역의 화소마다 가장 가까운 경계까지의 거리로 clamp(굵기 / 2 - 거리 + 0.5, 0, 1) 만큼 덮는다. (가장자리가 부드럽고, 넓히기 판을 줄여도 계단과 점선이 없다)
// - 모형마다: drawMesh 의 hasScreenOutline 이 false 면 그 모형은 선을 내지 않고 뒤의 선만 가린다. hasCreaseLine 이 false 면 꺾임 선만 끈다.
// - 번호마다 색: setLineColor 로 번호마다 선 색을 준다. (언리얼 Custom Stencil 꼴, 맞닿은 선은 앞쪽 번호의 색, 표에 없는 번호와 표가 빈 때는 setColor 의 색 그대로)
// - 굵기: setWidth 와 setCrease 의 굵기는 선 하나의 굵기다. (경계를 가운데로 양쪽에 반씩) 단위는 ToonOutlineWidthUnit, 한 픽셀 밑으로 내리지 않는다.
// - 깊이: 투영 행렬로 직교와 원근을 가리고, 깊이를 보기 공간 자리로 풀어 견준다. (화면 사각형처럼 클립 x, y 를 옮긴 투영도 된다)
// - 값: setResolutionScale 로 섞기 앞의 모든 판(선의 판, 가면, 씨앗, 넓히기 판)을 줄인다. (기본 1 은 그리는 영역 그대로, 줄이면 가는 선은 선의 판 해상도에서 덮는 몫 판 하나를 셈해 쌍선형으로 한 번 읽어 섞는다)
// - 인스턴스: drawMeshInstanced 는 인스턴스 배열을 걸러 그때 올린다. drawMeshInstanceBuffer 는 ToonRenderer.createInstanceBuffer 의 버퍼를 몸과 같이 쓰고 다시 올리지 않는다.
//   버퍼의 인스턴스마다 번호는 꼴의 instanceLineId 칸에서 읽는다. (없으면 공통 번호)
// - 사용: 매 프레임 beginLineIds(보기, 투영) → drawMesh / drawMeshInstanced / drawMeshInstanceBuffer → endLineIds() (씨앗과 넓히기까지 셈) → 툰 몸 그리기 → drawOutline().
//   beginLineIds 는 그때의 뷰포트를 그리는 영역으로 적어 두고, 선의 판을 그 크기에 맞춰 짓는다. endLineIds 와 drawOutline 이 프레임버퍼, 뷰포트, 상태를 돌린다.
//   ToonDrawQueue.setScreenOutline 으로 맡기면 그리기 줄이 이 차례를 스스로 한다. (엔진 2D 그리기 사이에 끼울 때, 그 전에 Graphic.flushBatch)
//==============================================================================
/**
 * @example <caption>꺾임 선 없이 실루엣만 굵게</caption>
 * import { ToonScreenOutline, ToonOutlineWidthUnit } from "./vanilla.js";
 * const outline = new ToonScreenOutline(document.createElement("canvas").getContext("webgl2"));
 * outline.setColor([0.1, 0.08, 0.12, 1]);
 * outline.setWidth(3, ToonOutlineWidthUnit.pixel);
 * outline.setCrease(180);
 * outline.setResolutionScale(0.5);
 */
export class ToonScreenOutline {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { ShaderProgram } */ #lineProgram;
	/** @private @type { ShaderProgram } */ #seedProgram;
	/** @private @type { ShaderProgram } */ #seedGatherProgram;
	/** @private @type { ShaderProgram } */ #jumpFloodProgram;
	/** @private @type { ShaderProgram } */ #compositeProgram;
	/** @private @type { ShaderProgram } */ #edgeMaskProgram; // 가는 선의 씨앗 쪽 판 고르기.
	/** @private @type { ShaderProgram } */ #thinCompositeProgram; // 가는 선을 한 패스로 섞기.
	/** @private @type { ShaderProgram } */ #thinCoverageProgram; // 줄인 선의 판에서 가는 선의 덮는 몫 셈하기.
	/** @private @type { ShaderProgram } */ #coverageBlitProgram; // 덮는 몫 판을 쌍선형으로 읽어 섞기.
	/** @private @type { string } */ #colorSpace; // 색 공간. (ColorSpace, 생성 때 정함, HDR 출력에서 선 색을 선형으로 바꾸는 곡선)
	/** @private @type { WebGLVertexArrayObject } */ #emptyVertexArray; // 화면 세모용 빈 버텍스 어레이.
	/** @private @type { object | null } */ #lineTarget; // 선의 판. ({ framebuffer, lineTexture, depthTexture, edgeMaskFramebuffer, edgeMaskTexture, seedFramebuffer, seedTexture, jumpFloodFramebuffers, jumpFloodTextures, jumpFloodIndex, outlinePath, width, height, jumpFloodWidth, jumpFloodHeight })
	/** @private @type { Array<number> } */ #color; // 선 색. (sRGB, 알파)
	/** @private @type { number } */ #width; // 바깥 선 굵기.
	/** @private @type { string } */ #widthUnit;
	/** @private @type { number } */ #focusDistance; // 원근에서 월드 굵기를 픽셀로 셀 거리. (0 이면 그린 모형의 평균 거리)
	/** @private @type { number } */ #depthThreshold; // 같은 번호를 떨어진 것으로 칠 접평면 거리. (월드 길이, 면에 수직)
	/** @private @type { number } */ #depthMargin; // 깊이 문턱에 더하는 오차 여유의 배율. (잰 오차의 몇 배)
	/** @private @type { number } */ #creaseCosine;
	/** @private @type { number } */ #creaseWidth; // 꺾임 선 굵기. (바깥 선과 같은 단위)
	/** @private @type { number } */ #creaseOpacity;
	/** @private @type { number } */ #resolutionScale;
	/** @private @type { boolean } */ #isHdrOutput;
	/** @private @type { object | null } */ #frame; // 이번 프레임의 카메라. ({ viewProjectionElements, viewElements, projectionElements, frustumPlanes, isPerspective, viewport })
	/** @private @type { object | null } */ #savedState; // beginLineIds 앞의 그리기 상태.
	/** @private @type { Float32Array } */ #instanceData;
	/** @private @type { Array<object> } */ #batchSlots; // 자동 인스턴싱 묶음 자리. ({ buffer, values, count, vertexArrays }, 그리기 줄이 프레임마다 같은 차례로 주고 값이 같으면 다시 올리지 않는다)
	/** @private @type { Float32Array } */ #lineUniformValues; // 선의 판에 올린 instanced, instanceLineIds, skinned, lineFlags. (같으면 건너뜀, beginLineIds 가 잊는다)
	/** @private @type { number } */ #drawnDistanceSum; // 이번 프레임에 그린 모형의 거리 합과 수. (초점 거리를 주지 않았을 때)
	/** @private @type { number } */ #drawnDistanceCount;
	/** @private @type { Array<number> } */ #lineWidths; // 이번 프레임의 바깥 선과 꺾임 선 굵기. (그리는 영역 픽셀)
	/** @private @type { Uint8Array } */ #lineColorTable; // 번호마다의 선 색. (번호 x 4 자리의 sRGB 와 알파 바이트, 알파 0 은 표에 없음)
	/** @private @type { number } */ #lineColorCount; // 표에 넣은 번호 수. (0 이면 섞을 때 표를 보지 않는다)
	/** @private @type { WebGLTexture | null } */ #lineColorTexture; // 번호 색 표 텍스처. (처음 넣을 때 짓는다)
	/** @private @type { boolean } */ #isLineColorTableDirty; // 표를 텍스처에 다시 올릴지.
	/** @private @type { Uint32Array } */ #lineColorWords; // #lineColorTable 을 4 바이트씩 본 것. (올린 표와 견줄 때)
	/** @private @type { Uint32Array | null } */ #uploadedLineColorTable; // 텍스처에 마지막으로 올린 표. (처음 올리기 전에는 null)

	//==============================================================================
	// 생성. (아홉 프로그램과 빈 버텍스 어레이를 짓는다, 선의 판은 첫 beginLineIds 에서)
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext - 툰 렌더러와 같은 컨텍스트.
	 * @param { object | null } [options] - { colorSpace (ColorSpace, 기본은 엔진의 색 공간, ToonRenderer 와 같은 값) }
	 */
	constructor(webGL2RenderingContext, options = null) {
		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#colorSpace = options !== null && options.colorSpace !== undefined ? readColorSpace(options.colorSpace) : readEngineColorSpace();
		this.#lineProgram = new ShaderProgram(webGL2RenderingContext, LINE_VERTEX_SHADER, LINE_FRAGMENT_SHADER, System.Object.assign({ instanceLineId: TOON_INSTANCE_LINE_ID_LOCATION }, TOON_ATTRIBUTE_LOCATIONS));
		this.#seedProgram = new ShaderProgram(webGL2RenderingContext, SCREEN_TRIANGLE_VERTEX_SHADER, SEED_FRAGMENT_SHADER, {});
		this.#seedGatherProgram = new ShaderProgram(webGL2RenderingContext, SCREEN_TRIANGLE_VERTEX_SHADER, SEED_GATHER_FRAGMENT_SHADER, {});
		this.#jumpFloodProgram = new ShaderProgram(webGL2RenderingContext, SCREEN_TRIANGLE_VERTEX_SHADER, JUMP_FLOOD_FRAGMENT_SHADER, {});
		this.#compositeProgram = new ShaderProgram(webGL2RenderingContext, SCREEN_TRIANGLE_VERTEX_SHADER, addColorSpaceDefine(COMPOSITE_FRAGMENT_SHADER, this.#colorSpace), {});
		this.#edgeMaskProgram = new ShaderProgram(webGL2RenderingContext, SCREEN_TRIANGLE_VERTEX_SHADER, EDGE_MASK_FRAGMENT_SHADER, {});
		this.#thinCompositeProgram = new ShaderProgram(webGL2RenderingContext, SCREEN_TRIANGLE_VERTEX_SHADER, addColorSpaceDefine(THIN_COMPOSITE_FRAGMENT_SHADER, this.#colorSpace), {});
		this.#thinCoverageProgram = new ShaderProgram(webGL2RenderingContext, SCREEN_TRIANGLE_VERTEX_SHADER, addCoveragePassDefine(addColorSpaceDefine(THIN_COMPOSITE_FRAGMENT_SHADER, this.#colorSpace)), {});
		this.#coverageBlitProgram = new ShaderProgram(webGL2RenderingContext, SCREEN_TRIANGLE_VERTEX_SHADER, COVERAGE_BLIT_FRAGMENT_SHADER, {});
		this.#emptyVertexArray = webGL2RenderingContext.createVertexArray();
		this.#lineTarget = null;
		this.#color = [0.08, 0.07, 0.1, 1];
		this.#width = 2;
		this.#widthUnit = ToonOutlineWidthUnit.pixel;
		this.#focusDistance = 0;
		this.#depthThreshold = 0.05;
		this.#depthMargin = 2;
		this.#creaseCosine = System.Math.cos(System.Math.PI / 3);
		this.#creaseWidth = 1;
		this.#creaseOpacity = 1;
		this.#resolutionScale = 1;
		this.#isHdrOutput = false;
		this.#frame = null;
		this.#savedState = null;
		this.#instanceData = new System.Float32Array(TOON_INSTANCE_FLOAT_COUNT * 64);
		this.#batchSlots = [];
		this.#lineUniformValues = new System.Float32Array([System.NaN, System.NaN, System.NaN, System.NaN]);
		this.#drawnDistanceSum = 0;
		this.#drawnDistanceCount = 0;
		this.#lineWidths = [2, 1];
		this.#lineColorTable = new System.Uint8Array((TOON_SCREEN_OUTLINE_MAXIMUM_LINE_ID + 1) * 4);
		this.#lineColorWords = new System.Uint32Array(this.#lineColorTable.buffer);
		this.#uploadedLineColorTable = null;
		this.#lineColorCount = 0;
		this.#lineColorTexture = null;
		this.#isLineColorTableDirty = false;
	}

	//==============================================================================
	// 셰이더 소스 반환. (ShaderWarmer 로 미리 링크할 때)
	//==============================================================================
	/**
	 * @static
	 * @param { string } [colorSpace] - 색 공간. (ColorSpace, 기본은 엔진의 색 공간, 지을 ToonScreenOutline 과 같은 값을 준다)
	 * @returns { Array<object> } { vertexShader, fragmentShader, attributeLocationTable } 아홉. (번호, 씨앗, 모으기, 넓히기, 섞기, 가는 선의 씨앗 쪽 판, 가는 선 섞기, 줄인 판의 가는 선 덮는 몫, 덮는 몫 판 섞기)
	 * @example <caption>셰이더를 미리 링크할 목록에 넣기</caption>
	 * import { ToonScreenOutline } from "./vanilla.js";
	 * const sources = ToonScreenOutline.readProgramSources();
	 * const vertexShaders = sources.map((source) => source.vertexShader);
	 */
	static readProgramSources(colorSpace = readEngineColorSpace()) {
		return [
			{ vertexShader: LINE_VERTEX_SHADER, fragmentShader: LINE_FRAGMENT_SHADER, attributeLocationTable: TOON_ATTRIBUTE_LOCATIONS },
			{ vertexShader: SCREEN_TRIANGLE_VERTEX_SHADER, fragmentShader: SEED_FRAGMENT_SHADER, attributeLocationTable: {} },
			{ vertexShader: SCREEN_TRIANGLE_VERTEX_SHADER, fragmentShader: SEED_GATHER_FRAGMENT_SHADER, attributeLocationTable: {} },
			{ vertexShader: SCREEN_TRIANGLE_VERTEX_SHADER, fragmentShader: JUMP_FLOOD_FRAGMENT_SHADER, attributeLocationTable: {} },
			{ vertexShader: SCREEN_TRIANGLE_VERTEX_SHADER, fragmentShader: addColorSpaceDefine(COMPOSITE_FRAGMENT_SHADER, colorSpace), attributeLocationTable: {} },
			{ vertexShader: SCREEN_TRIANGLE_VERTEX_SHADER, fragmentShader: EDGE_MASK_FRAGMENT_SHADER, attributeLocationTable: {} },
			{ vertexShader: SCREEN_TRIANGLE_VERTEX_SHADER, fragmentShader: addColorSpaceDefine(THIN_COMPOSITE_FRAGMENT_SHADER, colorSpace), attributeLocationTable: {} },
			{ vertexShader: SCREEN_TRIANGLE_VERTEX_SHADER, fragmentShader: addCoveragePassDefine(addColorSpaceDefine(THIN_COMPOSITE_FRAGMENT_SHADER, colorSpace)), attributeLocationTable: {} },
			{ vertexShader: SCREEN_TRIANGLE_VERTEX_SHADER, fragmentShader: COVERAGE_BLIT_FRAGMENT_SHADER, attributeLocationTable: {} },
		];
	}

	//==============================================================================
	// 선 색 설정. (sRGB 0 ~ 1 과 알파, 바깥 선과 꺾임 선이 같이 쓴다)
	//==============================================================================
	/**
	 * @param { Array<number> } color - [r, g, b, a] 의 sRGB. (a 를 빼면 1)
	 */
	setColor(color) {
		this.#color = [color[0], color[1], color[2], color.length > 3 ? color[3] : 1];
	}

	//==============================================================================
	// 번호마다 선 색 설정. (그 번호의 모형이 앞에 선 바깥 선과 꺾임 선을 이 색으로, 표에 없는 번호는 setColor 의 색 그대로)
	// - 언리얼 Custom Stencil 의 후처리 바깥선처럼 선의 판에 이미 있는 번호로 색을 고른다. 고른 모형을 강조하거나 편마다 색을 달리할 때.
	// - 표는 선 번호 전부(1 ~ TOON_SCREEN_OUTLINE_MAXIMUM_LINE_ID)를 덮는 128 x 128 찾기 텍스처다. 넣는 번호 수에 상한이 없고, 화소마다 한 번 읽는다.
	// - 두 번호가 맞닿은 선은 앞(카메라에 가까운) 쪽 번호의 색이다. 색은 sRGB 8 비트로 담고, 알파 0 은 1/255 로 담는다. (표에 없음과 가르려고, 보이지 않는 것은 같다)
	//==============================================================================
	/**
	 * @param { number } lineId - 1 ~ TOON_SCREEN_OUTLINE_MAXIMUM_LINE_ID. (drawMesh 와 drawMeshInstanced 에 준 번호, 범위 밖이면 하지 않는다)
	 * @param { Array<number> } color - [r, g, b, a] 의 sRGB 0 ~ 1. (a 를 빼면 1)
	 * @example <caption>가리킨 바위 하나의 선만 노랗게</caption>
	 * import { ToonRenderer, ToonScreenOutline, MeshBuilder, createOctahedronGeometry, Matrix4, Vector3 } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const renderer = new ToonRenderer(webGL2RenderingContext);
	 * const outline = new ToonScreenOutline(webGL2RenderingContext);
	 * const builder = new MeshBuilder();
	 * builder.addPart(createOctahedronGeometry(0.3), Matrix4.createIdentity(), "#a89880", { hasOutline: false });
	 * const rockMesh = renderer.createMesh(builder.readArrays());
	 * const instances = [0, 1, 2].map((index) => ({ modelMatrix: Matrix4.createTranslation(index * 0.7, 0, 0), lineId: 10 + index }));
	 * outline.setLineColor(11, [1, 0.85, 0.2, 1]);
	 * const viewMatrix = Matrix4.createLookAt(Vector3.create(0.7, 2, 3), Vector3.create(0.7, 0, 0), Vector3.create(0, 1, 0));
	 * const projectionMatrix = Matrix4.createPerspective(Math.PI / 4, 1, 0.1, 100);
	 * if (outline.beginLineIds(viewMatrix, projectionMatrix)) {
	 * 	outline.drawMeshInstanced(rockMesh, instances, 10);
	 * 	outline.endLineIds();
	 * }
	 * renderer.beginFrameWithMatrices(viewMatrix, projectionMatrix);
	 * renderer.drawMeshInstanced(rockMesh, instances);
	 * renderer.endFrame();
	 * outline.drawOutline();
	 */
	setLineColor(lineId, color) {
		if (!System.Number.isInteger(lineId) || lineId < 1 || lineId > TOON_SCREEN_OUTLINE_MAXIMUM_LINE_ID) {
			return;
		}
		const table = this.#lineColorTable;
		const offset = lineId * 4;
		const red = readColorByte(color[0]);
		const green = readColorByte(color[1]);
		const blue = readColorByte(color[2]);
		const alpha = System.Math.max(1, readColorByte(color.length > 3 ? color[3] : 1));
		// 같은 색이면 표를 다시 올리지 않는다. (게임이 프레임마다 같은 색을 다시 걸어도)
		if (table[offset] === red && table[offset + 1] === green && table[offset + 2] === blue && table[offset + 3] === alpha) {
			return;
		}
		if (table[offset + 3] === 0) {
			this.#lineColorCount += 1;
		}
		table[offset] = red;
		table[offset + 1] = green;
		table[offset + 2] = blue;
		table[offset + 3] = alpha;
		this.#isLineColorTableDirty = true;
	}

	//==============================================================================
	// 번호 하나를 색 표에서 빼기. (그 번호의 선은 setColor 의 색으로 돌아간다)
	//==============================================================================
	/**
	 * @param { number } lineId - setLineColor 에 준 번호.
	 */
	removeLineColor(lineId) {
		if (!System.Number.isInteger(lineId) || lineId < 1 || lineId > TOON_SCREEN_OUTLINE_MAXIMUM_LINE_ID) {
			return;
		}
		const table = this.#lineColorTable;
		const offset = lineId * 4;
		if (table[offset + 3] === 0) {
			return;
		}
		table.fill(0, offset, offset + 4);
		this.#lineColorCount -= 1;
		this.#isLineColorTableDirty = true;
	}

	//==============================================================================
	// 색 표 비우기. (모든 선이 setColor 의 색으로 돌아간다)
	//==============================================================================
	/**
	 * @example <caption>프레임마다 강조할 번호를 다시 넣기</caption>
	 * import { ToonScreenOutline } from "./vanilla.js";
	 * const outline = new ToonScreenOutline(document.createElement("canvas").getContext("webgl2"));
	 * outline.clearLineColors();
	 * outline.setLineColor(3, [1, 1, 1, 1]);
	 * outline.setLineColor(7, [1, 0.3, 0.2, 1]);
	 * const count = outline.getLineColorCount();
	 */
	clearLineColors() {
		if (this.#lineColorCount === 0) {
			return;
		}
		this.#lineColorTable.fill(0);
		this.#lineColorCount = 0;
		this.#isLineColorTableDirty = true;
	}

	//==============================================================================
	// 색 표에 든 번호 수 반환.
	//==============================================================================
	/**
	 * @returns { number } setLineColor 로 넣고 빼지 않은 번호 수.
	 */
	getLineColorCount() {
		return this.#lineColorCount;
	}

	//==============================================================================
	// 바깥 선 굵기 설정. (실루엣과 다른 번호와 맞닿은 곳의 선, 반지름이 아니라 선 하나의 굵기, 0 이면 긋지 않음)
	// - 꺾임 선 굵기도 이 단위로 센다.
	//==============================================================================
	/**
	 * @param { number } width - 선 하나의 굵기. (경계를 가운데로 양쪽에 반씩)
	 * @param { string } [unit] - ToonOutlineWidthUnit. (기본 pixel)
	 */
	setWidth(width, unit = ToonOutlineWidthUnit.pixel) {
		this.#width = System.Math.max(0, width);
		this.#widthUnit = unit;
	}

	//==============================================================================
	// 꺾임 선 설정. (같은 번호 안에서 이웃한 면이 이 각(도)보다 더 꺾이면 선, 굵기는 setWidth 의 단위, 진하기 0 ~ 1)
	//==============================================================================
	/**
	 * @param { number } angleDegrees - 꺾임 각. (180 이면 꺾임 선을 긋지 않는다)
	 * @param { number } [width] - 꺾임 선 하나의 굵기. (기본 1, 0 이면 긋지 않는다)
	 * @param { number } [opacity] - 꺾임 선의 진하기. (기본 1, 선 색의 알파에 곱한다)
	 * @example <caption>잔 면은 두고 큰 모서리만 엷게</caption>
	 * import { ToonScreenOutline } from "./vanilla.js";
	 * const outline = new ToonScreenOutline(document.createElement("canvas").getContext("webgl2"));
	 * outline.setCrease(75, 1.5, 0.6);
	 */
	setCrease(angleDegrees, width = 1, opacity = 1) {
		this.#creaseCosine = System.Math.cos(System.Math.min(180, System.Math.max(0, angleDegrees)) * System.Math.PI / 180);
		this.#creaseWidth = System.Math.max(0, width);
		this.#creaseOpacity = System.Math.max(0, System.Math.min(1, opacity));
	}

	//==============================================================================
	// 초점 거리 설정. (원근 카메라에서 월드 굵기를 픽셀로 셀 거리, 보통 카메라에서 보는 점까지, 0 이면 그린 모형들의 평균 거리)
	//==============================================================================
	/**
	 * @param { number } focusDistance - 카메라에서의 거리. (월드 길이)
	 */
	setFocusDistance(focusDistance) {
		this.#focusDistance = System.Math.max(0, focusDistance);
	}

	//==============================================================================
	// 깊이 문턱 설정. (같은 번호의 이웃 화소 가운데 가린 쪽이 가려진 쪽의 접평면에서 이만큼 넘게 떨어지면 가려진 실루엣으로 긋는다, 월드 길이)
	// - depthThreshold 는 면에 수직인 거리이고, 화소 여유가 더해진다. (setDepthMargin 의 배율 x 잰 오차, 오차는 화소 크기와 면의 기울기를 따른다)
	// - 장면의 크기에 맞춘다. (사람 크기 장면이면 0.02 ~ 0.1, 0 이면 오차 여유만으로 가른다)
	//==============================================================================
	/**
	 * @example <caption>낮은 턱까지 실루엣으로 긋기</caption>
	 * import { ToonScreenOutline } from "./vanilla.js";
	 * const outline = new ToonScreenOutline(document.createElement("canvas").getContext("webgl2"));
	 * outline.setDepthThreshold(0.01);
	 * console.log(outline.getDepthThreshold());
	 * @param { number } depthThreshold - 접평면 거리 문턱. (월드 길이, 면에 수직, 0 이상)
	 */
	setDepthThreshold(depthThreshold) {
		this.#depthThreshold = System.Math.max(0, depthThreshold);
	}

	//==============================================================================
	// 깊이 문턱 반환. (월드 길이, 면에 수직)
	//==============================================================================
	/**
	 * @example <caption>기본 깊이 문턱 읽기</caption>
	 * import { ToonScreenOutline } from "./vanilla.js";
	 * const outline = new ToonScreenOutline(document.createElement("canvas").getContext("webgl2"));
	 * console.log(outline.getDepthThreshold()); // 0.05
	 * @returns { number } 접평면 거리 문턱. (월드 길이)
	 */
	getDepthThreshold() {
		return this.#depthThreshold;
	}

	//==============================================================================
	// 깊이 여유 배율 설정. (깊이 문턱에 더하는 화소 여유가 잰 오차의 몇 배인지, 기본 2)
	// - 이어진 면에서도 생기는 접평면 거리의 오차를 화소마다 잰다. 노멀 8 비트 팔면체의 각 오차(0.0165 rad) x 두 화소 자리 사이 거리(면이 비스듬할수록 길다), 꺾인 줄을 사이에 둔 두 화소의 화소 한 칸 x 두 노멀이 벌어진 사인, 깊이 24 비트 한 칸.
	// - 두 면이 나란한 낮은 턱은 꺾임 몫이 0 이라 화소 한 칸보다 낮아도 잡힌다. 둥근 면을 굵은 다각형으로 지어 보간 노멀이 면에서 크게 벗어나는 모형에서 깊이 문턱을 아주 낮추면 잔선이 생기니, 그때 배율을 올린다.
	// - 0 이면 깊이 문턱만으로 가른다.
	//==============================================================================
	/**
	 * @example <caption>여유를 줄여 낮은 턱을 더 잡기</caption>
	 * import { ToonScreenOutline } from "./vanilla.js";
	 * const outline = new ToonScreenOutline(document.createElement("canvas").getContext("webgl2"));
	 * outline.setDepthThreshold(0.02);
	 * outline.setDepthMargin(1);
	 * console.log(outline.getDepthMargin()); // 1
	 * @param { number } depthMargin - 잰 오차에 곱할 배율. (0 이상)
	 */
	setDepthMargin(depthMargin) {
		this.#depthMargin = System.Math.max(0, depthMargin);
	}

	//==============================================================================
	// 깊이 여유 배율 반환.
	//==============================================================================
	/**
	 * @example <caption>기본 깊이 여유 배율 읽기</caption>
	 * import { ToonScreenOutline } from "./vanilla.js";
	 * const outline = new ToonScreenOutline(document.createElement("canvas").getContext("webgl2"));
	 * console.log(outline.getDepthMargin()); // 2
	 * @returns { number } 잰 오차에 곱할 배율.
	 */
	getDepthMargin() {
		return this.#depthMargin;
	}

	//==============================================================================
	// 선의 판 해상도 몫 설정. (그리는 영역에 대한 몫 0.25 ~ 1, 기본 1, 폰과 태블릿의 가벼운 길은 낮춘다)
	// - 이름대로 섞기 앞의 모든 판(선의 판 = 노멀과 번호와 깊이, 가면, 씨앗, 넓히기 판)을 그리는 영역 x 몫 크기로 잡는다. 선의 판은 몫만큼 작은 해상도로 한 번 더 그려지므로 값이 몫의 제곱으로 준다.
	//   기본 1 은 그리는 영역과 같은 크기라 화면이 바이트까지 그대로다.
	// - 몫이 1 보다 작을 때 가는 선(굵기 x 몫이 약 3.24 선의 판 픽셀 이하)은 선의 판 해상도에서 덮는 몫(진하기와 번호 색을 곱한 RGBA8)을 한 번 셈하고, 마지막 섞기가 그것을 쌍선형으로 한 번 읽는다. (읽기 9 에서 1)
	//   굵은 선은 선의 판 해상도에서 점프 플러딩을 하고 섞을 때 거리를 그리는 영역 픽셀로 곱해 잰다. 어느 길이든 선 굵기는 그리는 영역 픽셀(setWidth)이고 선 자리는 몫이 작을수록 가장자리가 부드러워진다.
	// - getLineTarget() 의 lineTexture, depthTexture 해상도는 그리는 영역 x 몫이다. (광부의 lineTexture 약속 RGBA8, b 와 a 아래 6 비트 번호, a 위 2 비트 깃발, 굵기 0 이면 선의 판만은 그대로, 해상도만 그리는 영역과 다를 수 있다)
	// - CSS 화소당 1.5 화소로 맞추려면 몫 = 1.5 / (그리는 버퍼 화소 / CSS 화소) 로 준다. 엔진 해상도 설정이 그리는 버퍼를 묶어 devicePixelRatio 와 다를 수 있어 캔버스의 width / clientWidth 로 센다.
	//==============================================================================
	/**
	 * @param { number } resolutionScale - 0.25 ~ 1. (1 이면 그리는 영역 해상도 그대로)
	 * @example <caption>CSS 화소당 선의 판 1.5 화소로 맞추기</caption>
	 * import { ToonScreenOutline } from "./vanilla.js";
	 * const canvas = document.createElement("canvas");
	 * canvas.width = 750;
	 * canvas.height = 990;
	 * canvas.style.width = "375px";
	 * const outline = new ToonScreenOutline(canvas.getContext("webgl2"));
	 * const bufferPixelPerCssPixel = canvas.width / 375;
	 * outline.setResolutionScale(1.5 / bufferPixelPerCssPixel);
	 */
	setResolutionScale(resolutionScale) {
		this.#resolutionScale = System.Math.max(0.25, System.Math.min(1, resolutionScale));
	}

	//==============================================================================
	// HDR 출력 설정. (true 면 선 색을 선형으로 바꿔 섞는다, ToonRenderer.setHdrOutput 과 맞춘다)
	//==============================================================================
	/**
	 * @param { boolean } isHdrOutput - true 면 선 색을 선형으로 바꿔 섞는다.
	 */
	setHdrOutput(isHdrOutput) {
		this.#isHdrOutput = isHdrOutput;
	}

	//==============================================================================
	// 색 공간 반환. (생성 때 정한 값, HDR 출력에서 선 색을 선형으로 바꾸는 곡선, gamma 는 pow 2.2, linear 는 sRGB 표준 곡선)
	//==============================================================================
	/**
	 * @returns { string } ColorSpace.gamma 나 ColorSpace.linear.
	 * @example <caption>렌더러와 같은 색 공간으로 지은 화면 바깥선</caption>
	 * import { ToonRenderer, ToonScreenOutline, ColorSpace } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const renderer = new ToonRenderer(webGL2RenderingContext);
	 * const screenOutline = new ToonScreenOutline(webGL2RenderingContext, { colorSpace: renderer.getColorSpace() });
	 * if (screenOutline.getColorSpace() !== ColorSpace.gamma) {
	 * 	throw new Error("default color space is not gamma");
	 * }
	 */
	getColorSpace() {
		return this.#colorSpace;
	}

	//==============================================================================
	// 이번 프레임의 선 굵기 반환. ([바깥 선, 꺾임 선] 의 그리는 영역 픽셀, endLineIds 뒤에 정해짐)
	//==============================================================================
	/**
	 * @returns { Array<number> } [바깥 선 굵기, 꺾임 선 굵기]. (긋지 않으면 0)
	 */
	getLineWidths() {
		return this.#lineWidths.slice();
	}

	//==============================================================================
	// 선의 판 반환. (없으면 null)
	//==============================================================================
	/**
	 * @returns { object | null } { lineTexture (노멀과 번호 RGBA8), depthTexture (깊이 24), edgeMaskTexture (가는 선의 씨앗 쪽 판 R8UI, 아래 3 비트 바깥 선, 위 3 비트 꺾임 선의 첫 경계 쪽 0 없음, 1 오른쪽, 2 왼쪽, 3 위, 4 아래), seedTexture (온 해상도 씨앗 RGBA16UI, 굵은 선을 긋기 전에는 null), jumpFloodTextures (넓히기 판 RGBA16UI 둘, 굵은 선을 긋기 전에는 빔), jumpFloodIndex (넓히기를 마친 쪽, 점프 플러딩을 안 했으면 -1), coverageTexture (선의 판을 줄였을 때 가는 선의 덮는 몫 RGBA8 곱한 색, 줄여 가는 선을 그을 때 짓기 전에는 null), outlinePath (이번 프레임의 길 "none", "thin", "thinScaled", "jumpFlood"), width, height (선의 판 해상도, 그리는 영역 x setResolutionScale 의 몫), jumpFloodWidth, jumpFloodHeight (선의 판과 같다) }
	 */
	getLineTarget() {
		return this.#lineTarget;
	}

	//==============================================================================
	// 번호 그리기 시작. (지금 뷰포트를 그리는 영역으로 적고, 선의 판을 묶어 비운다)
	//==============================================================================
	/**
	 * @param { Matrix4 } viewMatrix - 보기 행렬.
	 * @param { Matrix4 } projectionMatrix - 투영 행렬. (원근이나 직교)
	 * @returns { boolean } 선의 판을 짓지 못했으면 false. (그때 drawMesh 는 아무것도 하지 않는다)
	 */
	beginLineIds(viewMatrix, projectionMatrix) {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const viewElements = viewMatrix.getElements();
		const projectionElements = projectionMatrix.getElements();
		const viewport = webGL2RenderingContext.getParameter(webGL2RenderingContext.VIEWPORT);
		const viewProjectionMatrix = projectionMatrix.clone();
		viewProjectionMatrix.multiply(viewMatrix);
		this.#frame = {
			viewProjectionElements: new System.Float32Array(viewProjectionMatrix.getElements()),
			viewElements: new System.Float32Array(viewElements),
			projectionElements: new System.Float32Array(projectionElements),
			frustumPlanes: extractFrustumPlanes(viewProjectionMatrix),
			isPerspective: System.Math.abs(projectionElements[11]) > 0.5,
			viewport: [viewport[0], viewport[1], viewport[2], viewport[3]],
		};
		this.#drawnDistanceSum = 0;
		this.#drawnDistanceCount = 0;
		const width = System.Math.max(1, viewport[2]);
		const height = System.Math.max(1, viewport[3]);
		const lineWidth = System.Math.max(1, System.Math.ceil(width * this.#resolutionScale));
		const lineHeight = System.Math.max(1, System.Math.ceil(height * this.#resolutionScale));
		const lineTarget = this.readLineTarget(lineWidth, lineHeight, lineWidth, lineHeight);
		if (lineTarget === null) {
			return false;
		}
		this.saveState();
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, lineTarget.framebuffer);
		webGL2RenderingContext.viewport(0, 0, lineTarget.width, lineTarget.height);
		webGL2RenderingContext.disable(webGL2RenderingContext.SCISSOR_TEST);
		webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);
		webGL2RenderingContext.clearColor(0, 0, 0, 0);
		webGL2RenderingContext.depthMask(true);
		webGL2RenderingContext.clear(webGL2RenderingContext.COLOR_BUFFER_BIT | webGL2RenderingContext.DEPTH_BUFFER_BIT);
		webGL2RenderingContext.enable(webGL2RenderingContext.DEPTH_TEST);
		webGL2RenderingContext.depthFunc(webGL2RenderingContext.LEQUAL);
		webGL2RenderingContext.enable(webGL2RenderingContext.CULL_FACE);
		webGL2RenderingContext.cullFace(webGL2RenderingContext.BACK);
		webGL2RenderingContext.frontFace(webGL2RenderingContext.CCW);
		const lineProgram = this.#lineProgram;
		lineProgram.useProgram();
		webGL2RenderingContext.uniformMatrix4fv(lineProgram.getUniformLocation("viewProjectionMatrix"), false, this.#frame.viewProjectionElements);
		this.#lineUniformValues.fill(System.NaN);
		return true;
	}

	//==============================================================================
	// 모형 하나를 그릴지 가리고 초점 거리에 더하기. (drawMesh 가 그리기 앞에 하는 것, 그리기 줄이 담은 차례로 부르고 그리기는 drawMeshBatch 로 몰아 한다)
	//==============================================================================
	/**
	 * @param { object } mesh - ToonRenderer.createMesh 의 결과.
	 * @param { Float32Array } modelElements - 모형 행렬의 수 16.
	 * @param { boolean } isCulled - 화면 밖을 거르는지.
	 * @returns { boolean } 그릴 것이면 true.
	 * @private
	 */
	acceptMesh(mesh, modelElements, isCulled) {
		if (this.#savedState === null || (isCulled && !this.isVisible(mesh, modelElements))) {
			return false;
		}
		this.addDrawnDistance(mesh, modelElements);
		return true;
	}

	//==============================================================================
	// 같은 모형과 꼴의 여럿의 번호를 인스턴스 그리기 한 번으로. (그리기 줄의 자동 인스턴싱, acceptMesh 로 고른 것, 감기는 뒤집지 않은 것만)
	// - 번호는 인스턴스마다 틴트 칸의 x 로. (drawMeshInstanced 와 같은 길, 하나면 보통 그리기)
	//==============================================================================
	/**
	 * @param { object } mesh - ToonRenderer.createMesh 의 결과.
	 * @param { Array<Matrix4> } modelMatrixList - 모형 행렬 목록.
	 * @param { Array<number> } lineIdList - 번호 목록. (행렬과 같은 자리)
	 * @param { number } start - 목록에서 그릴 첫 자리.
	 * @param { number } count - 그릴 수.
	 * @param { object } options - 모두에 같은 그리기 꼴.
	 * @param { number } slotIndex - 묶음 자리 번호. (그리기 줄이 프레임마다 같은 차례로 준다)
	 * @private
	 */
	drawMeshBatch(mesh, modelMatrixList, lineIdList, start, count, options, slotIndex) {
		if (this.#savedState === null || count <= 0) {
			return;
		}
		if (count === 1) {
			this.drawWithCount(mesh, modelMatrixList[start].getElements(), 0, lineIdList[start], 0, false, options, mesh.bodyVertexArray);
			return;
		}
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		if (this.#instanceData.length < count * TOON_INSTANCE_FLOAT_COUNT) {
			this.#instanceData = new System.Float32Array(count * TOON_INSTANCE_FLOAT_COUNT);
		}
		const instanceData = this.#instanceData;
		for (let index = 0; index < count; ++index) {
			const offset = index * TOON_INSTANCE_FLOAT_COUNT;
			instanceData.set(modelMatrixList[start + index].getElements(), offset);
			instanceData[offset + 16] = System.Math.max(0, System.Math.min(TOON_SCREEN_OUTLINE_MAXIMUM_LINE_ID, lineIdList[start + index]));
			instanceData[offset + 17] = 0;
			instanceData[offset + 18] = 0;
			instanceData[offset + 19] = 1;
		}
		// 묶음 자리의 값이 앞 프레임과 같으면 다시 올리지 않는다. (멈춘 장면은 올림 없음, 몸 묶음 자리와 같은 꼴)
		const floatCount = count * TOON_INSTANCE_FLOAT_COUNT;
		let slot = this.#batchSlots[slotIndex];
		if (slot === undefined) {
			slot = { buffer: webGL2RenderingContext.createBuffer(), values: new System.Float32Array(0), count: 0, vertexArrays: new System.Map() };
			this.#batchSlots[slotIndex] = slot;
		}
		let isSame = slot.count === count;
		if (isSame) {
			const values = slot.values;
			for (let index = 0; index < floatCount; ++index) {
				const value = values[index];
				const other = instanceData[index];
				if (value !== other || (value === 0 && 1 / value !== 1 / other)) {
					isSame = false;
					break;
				}
			}
		}
		if (!isSame) {
			if (slot.values.length < floatCount) {
				slot.values = new System.Float32Array(floatCount);
			}
			slot.values.set(instanceData.subarray(0, floatCount));
			slot.count = count;
			webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, slot.buffer);
			webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, instanceData, webGL2RenderingContext.DYNAMIC_DRAW, 0, floatCount); // 앞의 칸만. (subarray 를 짓지 않는다)
		}
		let vertexArray = slot.vertexArrays.get(mesh);
		if (vertexArray === undefined) {
			if (slot.vertexArrays.size >= BATCH_SLOT_MESH_LIMIT) {
				for (const oldVertexArray of slot.vertexArrays.values()) {
					webGL2RenderingContext.deleteVertexArray(oldVertexArray);
				}
				slot.vertexArrays.clear();
			}
			vertexArray = createMeshInstanceVertexArray(webGL2RenderingContext, mesh, slot.buffer);
			slot.vertexArrays.set(mesh, vertexArray);
		}
		this.drawWithCount(mesh, IDENTITY_ELEMENTS, count, lineIdList[start], 1, false, options, vertexArray);
	}

	//==============================================================================
	// 모형 하나의 번호 그리기. (ToonRenderer.drawMesh 와 같은 행렬과 자세, 화면 밖이면 건너뛴다)
	//==============================================================================
	/**
	 * @param { object | null } mesh - ToonRenderer.createMesh 의 결과.
	 * @param { Matrix4 } modelMatrix - 모형 행렬.
	 * @param { number } lineId - 1 ~ TOON_SCREEN_OUTLINE_MAXIMUM_LINE_ID. (0 은 빈 곳이라 쓰지 않는다, 같은 번호끼리 맞닿은 곳은 긋지 않는다)
	 * @param { object } [options] - { jointMatrices Float32Array, isCulled (기본 true), indexStart, indexCount (몸 번호 버퍼의 일부만), isMirrored (주지 않으면 행렬식으로), hasScreenOutline (기본 true, false 면 선은 내지 않고 가리기만), hasCreaseLine (기본 true) }
	 * @example <caption>바닥은 선 없이 가리기만, 결정은 꺾임 선 없이</caption>
	 * import { ToonRenderer, ToonScreenOutline, MeshBuilder, createBoxGeometry, createOctahedronGeometry, Matrix4, Vector3 } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const renderer = new ToonRenderer(webGL2RenderingContext);
	 * const outline = new ToonScreenOutline(webGL2RenderingContext);
	 * const floorBuilder = new MeshBuilder();
	 * floorBuilder.addPart(createBoxGeometry(6, 0.2, 6), Matrix4.createTranslation(0, -0.1, 0), "#506070", { hasOutline: false });
	 * const floorMesh = renderer.createMesh(floorBuilder.readArrays());
	 * const crystalBuilder = new MeshBuilder();
	 * crystalBuilder.addPart(createOctahedronGeometry(0.5), Matrix4.createTranslation(0, 0.5, 0), "#90d0ff", { hasOutline: false });
	 * const crystalMesh = renderer.createMesh(crystalBuilder.readArrays());
	 * const viewMatrix = Matrix4.createLookAt(Vector3.create(3, 3, 4), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
	 * const projectionMatrix = Matrix4.createPerspective(Math.PI / 4, 1, 0.1, 100);
	 * if (outline.beginLineIds(viewMatrix, projectionMatrix)) {
	 * 	outline.drawMesh(floorMesh, Matrix4.createIdentity(), 1, { hasScreenOutline: false });
	 * 	outline.drawMesh(crystalMesh, Matrix4.createIdentity(), 2, { hasCreaseLine: false });
	 * 	outline.endLineIds();
	 * }
	 */
	drawMesh(mesh, modelMatrix, lineId, options = {}) {
		if (mesh === null || mesh === undefined || this.#savedState === null) {
			return;
		}
		const modelElements = modelMatrix.getElements();
		if (options.isCulled !== false && !this.isVisible(mesh, modelElements)) {
			return;
		}
		this.addDrawnDistance(mesh, modelElements);
		const isMirrored = options.isMirrored !== undefined ? options.isMirrored : readMatrixDeterminant(modelElements) < 0;
		this.drawWithCount(mesh, modelElements, 0, lineId, 0, isMirrored, options, mesh.bodyVertexArray);
	}

	//==============================================================================
	// 같은 모형 여럿의 번호를 한 번에 그리기. (인스턴스에 lineId 가 있으면 그 번호, 없으면 공통 번호)
	//==============================================================================
	/**
	 * @param { object | null } mesh - ToonRenderer.createMesh 의 결과.
	 * @param { Array<object> } instances - { modelMatrix: Matrix4, lineId: number (선택) } 의 배열.
	 * @param { number } lineId - 공통 번호.
	 * @param { object } [options] - drawMesh 와 같다. (꼴은 모든 인스턴스에 같다)
	 * @example <caption>돌마다 다른 번호로 맞닿은 곳에도 선</caption>
	 * import { ToonRenderer, ToonScreenOutline, MeshBuilder, createOctahedronGeometry, Matrix4, Vector3 } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const renderer = new ToonRenderer(webGL2RenderingContext);
	 * const outline = new ToonScreenOutline(webGL2RenderingContext);
	 * const builder = new MeshBuilder();
	 * builder.addPart(createOctahedronGeometry(0.3), Matrix4.createIdentity(), "#a89880", { hasOutline: false });
	 * const rockMesh = renderer.createMesh(builder.readArrays());
	 * const instances = [0, 1, 2].map((index) => ({ modelMatrix: Matrix4.createTranslation(index * 0.5, 0, 0), lineId: 10 + index }));
	 * const viewMatrix = Matrix4.createLookAt(Vector3.create(0.5, 2, 3), Vector3.create(0.5, 0, 0), Vector3.create(0, 1, 0));
	 * const projectionMatrix = Matrix4.createPerspective(Math.PI / 4, 1, 0.1, 100);
	 * if (outline.beginLineIds(viewMatrix, projectionMatrix)) {
	 * 	outline.drawMeshInstanced(rockMesh, instances, 10);
	 * 	outline.endLineIds();
	 * }
	 */
	drawMeshInstanced(mesh, instances, lineId, options = {}) {
		if (mesh === null || mesh === undefined || this.#savedState === null) {
			return;
		}
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		if (this.#instanceData.length < instances.length * TOON_INSTANCE_FLOAT_COUNT) {
			this.#instanceData = new System.Float32Array(instances.length * TOON_INSTANCE_FLOAT_COUNT);
		}
		const instanceData = this.#instanceData;
		const isCulled = options.isCulled !== false;
		let instanceCount = 0;
		for (const instance of instances) {
			const modelElements = instance.modelMatrix.getElements();
			if (isCulled && !this.isVisible(mesh, modelElements)) {
				continue;
			}
			this.addDrawnDistance(mesh, modelElements);
			const offset = instanceCount * TOON_INSTANCE_FLOAT_COUNT;
			instanceData.set(modelElements, offset);
			instanceData[offset + 16] = typeof instance.lineId === "number" ? instance.lineId : lineId;
			instanceData[offset + 17] = 0;
			instanceData[offset + 18] = 0;
			instanceData[offset + 19] = 1;
			instanceCount += 1;
		}
		if (instanceCount === 0) {
			return;
		}
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, mesh.instanceBuffer);
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, instanceData, webGL2RenderingContext.DYNAMIC_DRAW, 0, instanceCount * TOON_INSTANCE_FLOAT_COUNT); // 앞의 칸만. (subarray 를 짓지 않는다)
		this.drawWithCount(mesh, IDENTITY_ELEMENTS, instanceCount, lineId, 1, options.isMirrored === true, options, mesh.bodyVertexArray);
	}

	//==============================================================================
	// 영구 인스턴스 버퍼로 번호 그리기. (몸과 같은 GPU 버퍼를 쓰고 다시 올리지 않는다, 버퍼 전체의 경계로 통째 거른다)
	// - 인스턴스마다 번호는 꼴의 instanceLineId 칸, 없으면 공통 번호. 꼴에 행렬이 없으면 자리를 몰라 그리지 않는다. (정점 조각은 선의 판에서 돌지 않는다)
	//==============================================================================
	/**
	 * @param { object | null } mesh - ToonRenderer.createMesh 의 결과.
	 * @param { object } instanceBuffer - ToonRenderer.createInstanceBuffer 의 결과. (지은 렌더러의 버텍스 어레이를 같이 쓴다)
	 * @param { number } instanceCount - 그릴 인스턴스 수. (버퍼에 든 수를 넘으면 자른다)
	 * @param { number } lineId - 공통 번호. (꼴에 instanceLineId 가 없을 때)
	 * @param { object } [options] - drawMesh 와 같다. (꼴은 모든 인스턴스에 같다)
	 * @example <caption>돌 버퍼 하나로 몸과 선의 판을 같이 그리기</caption>
	 * import { ToonRenderer, ToonScreenOutline, MeshBuilder, createOctahedronGeometry, Matrix4, Vector3 } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const renderer = new ToonRenderer(webGL2RenderingContext);
	 * const outline = new ToonScreenOutline(webGL2RenderingContext);
	 * const builder = new MeshBuilder();
	 * builder.addPart(createOctahedronGeometry(0.3), Matrix4.createIdentity(), "#a89880", { hasOutline: false });
	 * const rockMesh = renderer.createMesh(builder.readArrays());
	 * const instanceLayout = renderer.createInstanceLayout([{ name: "instanceMatrix", size: 16 }, { name: "instanceTint", size: 4 }, { name: "instanceLineId", size: 1 }]);
	 * const data = new Float32Array(21 * 3);
	 * for (let index = 0; index < 3; ++index) {
	 * 	data.set(Matrix4.createTranslation(index * 0.5, 0, 0).getElements(), index * 21);
	 * 	data.set([1, 1, 1, 1, 10 + index], index * 21 + 16);
	 * }
	 * const instanceBuffer = renderer.createInstanceBuffer(instanceLayout, data);
	 * const viewMatrix = Matrix4.createLookAt(Vector3.create(0.5, 2, 3), Vector3.create(0.5, 0, 0), Vector3.create(0, 1, 0));
	 * const projectionMatrix = Matrix4.createPerspective(Math.PI / 4, 1, 0.1, 100);
	 * if (outline.beginLineIds(viewMatrix, projectionMatrix)) {
	 * 	outline.drawMeshInstanceBuffer(rockMesh, instanceBuffer, 3, 10);
	 * 	outline.endLineIds();
	 * }
	 * renderer.beginFrameWithMatrices(viewMatrix, projectionMatrix);
	 * renderer.drawMeshInstanceBuffer(rockMesh, instanceBuffer, 3);
	 * renderer.endFrame();
	 * outline.drawOutline();
	 */
	drawMeshInstanceBuffer(mesh, instanceBuffer, instanceCount, lineId, options = {}) {
		if (mesh === null || mesh === undefined || this.#savedState === null || instanceBuffer.buffer === null) {
			return;
		}
		const instanceLayout = instanceBuffer.layout;
		if (!instanceLayout.hasMatrix()) {
			return;
		}
		const layoutFloatCount = instanceLayout.getFloatCount();
		const count = System.Math.min(instanceCount, System.Math.floor(instanceBuffer.floatCount / layoutFloatCount));
		if (count <= 0) {
			return;
		}
		const isCulled = options.isCulled !== false;
		if (isCulled && writeInstanceBufferSphere(INSTANCE_BUFFER_SPHERE, mesh, instanceBuffer) && !isSphereInFrustum(this.#frame.frustumPlanes, INSTANCE_BUFFER_SPHERE)) {
			return;
		}
		// 초점 거리를 모형 거리로 셀 때만 인스턴스마다의 거리를 더한다. (drawMeshInstanced 와 같은 굵기)
		if (this.#widthUnit === ToonOutlineWidthUnit.world && this.#focusDistance <= 0 && this.#frame.isPerspective && instanceBuffer.data !== null) {
			let matrixOffset = 0;
			for (const attribute of instanceLayout.getAttributes()) {
				if (attribute.name === TOON_INSTANCE_MATRIX_NAME) {
					matrixOffset = attribute.offset;
				}
			}
			for (let instanceIndex = 0; instanceIndex < count; ++instanceIndex) {
				const offset = instanceIndex * layoutFloatCount + matrixOffset;
				const modelElements = instanceBuffer.data.subarray(offset, offset + 16);
				if (!isCulled || this.isVisible(mesh, modelElements)) {
					this.addDrawnDistance(mesh, modelElements);
				}
			}
		}
		const vertexArrays = instanceBuffer.renderer.readInstanceVertexArrays(mesh, instanceBuffer);
		this.drawWithCount(mesh, IDENTITY_ELEMENTS, count, lineId, instanceLayout.hasLineId() ? 2 : 0, options.isMirrored === true, options, vertexArrays.body);
	}

	//==============================================================================
	// 번호 그리기 본체.
	//==============================================================================
	/**
	 * @param { object } mesh - ToonRenderer.createMesh 의 결과.
	 * @param { Float32Array } modelElements - 모형 행렬의 수 16.
	 * @param { number } instanceCount - 0 이면 보통 그리기.
	 * @param { number } lineId - 공통 번호.
	 * @param { number } lineIdSource - 번호를 읽을 곳. (0 공통 번호, 1 틴트 칸의 x, 2 인스턴스 버퍼의 instanceLineId)
	 * @param { boolean } isMirrored - 감기를 뒤집어 그릴지.
	 * @param { object } options - drawMesh 의 꼴.
	 * @param { WebGLVertexArrayObject } vertexArray - 그릴 버텍스 어레이. (모형의 몸이나 모형과 인스턴스 버퍼를 묶은 것)
	 */
	drawWithCount(mesh, modelElements, instanceCount, lineId, lineIdSource, isMirrored, options, vertexArray) {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const lineProgram = this.#lineProgram;
		const jointMatrices = options.jointMatrices !== undefined ? options.jointMatrices : null;
		const isSkinned = mesh.isSkinned && jointMatrices !== null;
		const lineFlags = (options.hasCreaseLine !== false ? 1 : 0) + (options.hasScreenOutline !== false ? 2 : 0);
		webGL2RenderingContext.uniformMatrix4fv(lineProgram.getUniformLocation("modelMatrix"), false, modelElements);
		// 그리기마다 거의 같은 넷은 바뀔 때만 올린다. (beginLineIds 가 잊는다)
		const lineUniformValues = this.#lineUniformValues;
		const instancedValue = instanceCount > 0 ? 1 : 0;
		const skinnedValue = isSkinned ? 1 : 0;
		if (lineUniformValues[0] !== instancedValue) {
			lineUniformValues[0] = instancedValue;
			webGL2RenderingContext.uniform1f(lineProgram.getUniformLocation("instanced"), instancedValue);
		}
		if (lineUniformValues[1] !== lineIdSource) {
			lineUniformValues[1] = lineIdSource;
			webGL2RenderingContext.uniform1f(lineProgram.getUniformLocation("instanceLineIds"), lineIdSource);
		}
		if (lineUniformValues[2] !== skinnedValue) {
			lineUniformValues[2] = skinnedValue;
			webGL2RenderingContext.uniform1f(lineProgram.getUniformLocation("skinned"), skinnedValue);
		}
		webGL2RenderingContext.uniform1f(lineProgram.getUniformLocation("lineId"), System.Math.max(0, System.Math.min(TOON_SCREEN_OUTLINE_MAXIMUM_LINE_ID, lineId)));
		if (lineUniformValues[3] !== lineFlags) {
			lineUniformValues[3] = lineFlags;
			webGL2RenderingContext.uniform1f(lineProgram.getUniformLocation("lineFlags"), lineFlags);
		}
		if (isSkinned) {
			const jointFloatCount = System.Math.floor(System.Math.min(jointMatrices.length, TOON_MAXIMUM_JOINTS * 16) / 16) * 16;
			const jointValues = jointMatrices.length === jointFloatCount ? jointMatrices : jointMatrices.subarray(0, jointFloatCount);
			webGL2RenderingContext.uniformMatrix4fv(lineProgram.getUniformLocation("jointMatrices"), false, jointValues);
		}
		const indexStart = options.indexStart !== undefined ? System.Math.max(0, options.indexStart) : 0;
		const indexCount = options.indexCount !== undefined ? System.Math.min(options.indexCount, mesh.bodyIndexCount - indexStart) : mesh.bodyIndexCount - indexStart;
		if (indexCount <= 0) {
			return;
		}
		if (isMirrored) {
			webGL2RenderingContext.frontFace(webGL2RenderingContext.CW);
		}
		webGL2RenderingContext.bindVertexArray(vertexArray);
		if (instanceCount > 0) {
			webGL2RenderingContext.drawElementsInstanced(webGL2RenderingContext.TRIANGLES, indexCount, webGL2RenderingContext.UNSIGNED_INT, indexStart * 4, instanceCount);
		}
		else {
			webGL2RenderingContext.drawElements(webGL2RenderingContext.TRIANGLES, indexCount, webGL2RenderingContext.UNSIGNED_INT, indexStart * 4);
		}
		if (isMirrored) {
			webGL2RenderingContext.frontFace(webGL2RenderingContext.CCW);
		}
	}

	//==============================================================================
	// 번호 그리기 끝. (가는 선은 씨앗 쪽 판 하나를 고르고, 굵은 선은 씨앗을 고르고 점프 플러딩으로 넓힌 뒤, 프레임버퍼와 뷰포트와 상태를 돌린다)
	// - 가는 선(굵기가 THIN_LINE_MAXIMUM_WIDTH 이하, 약 3.24 픽셀까지): 화면 전체 패스가 씨앗 쪽 판 하나다. 섞기가 둘레 3 x 3 화소의 씨앗을 본다. (씨앗, 모으기, 넓히기 없음)
	// - 굵은 선: 씨앗, 모으기, 넓히기 걸음마다 한 패스. (씨앗 판과 넓히기 판은 처음 굵은 선을 그을 때 짓는다)
	// - 판을 통째로 덮어쓰는 패스는 앞에 판 비우기(clearBufferuiv, clearBufferfv)를 불러 옛 내용을 읽어 들이지 않게 한다. (타일 GPU 의 판 불러오기를 없앰, invalidateFramebuffer 는 아이패드와 아이폰 사파리에서 프레임마다 약 10 ~ 25 ms 가 붙어 쓰지 않는다)
	//==============================================================================
	endLineIds() {
		if (this.#savedState === null) {
			return;
		}
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const lineTarget = this.#lineTarget;
		const lineWidths = this.readLineWidths();
		this.#lineWidths = lineWidths;
		lineTarget.jumpFloodIndex = -1;
		lineTarget.outlinePath = "none";
		// 바깥 선과 꺾임 선이 모두 0 이면 선의 판(노멀, 번호, 깊이)만 남긴다. (모서리 어둠의 미리 그리기, drawOutline 은 긋지 않는다)
		if (lineWidths[0] <= 0 && lineWidths[1] <= 0) {
			this.restoreState();
			return;
		}
		// 선의 판이 그리는 영역보다 작으면(setResolutionScale) 굵기를 선의 판 화소로 재어 가는 선 길을 가린다.
		const lineScaleX = lineTarget.width / System.Math.max(1, this.#frame.viewport[2]);
		const lineScaleY = lineTarget.height / System.Math.max(1, this.#frame.viewport[3]);
		const isScaled = lineTarget.width !== System.Math.max(1, this.#frame.viewport[2]) || lineTarget.height !== System.Math.max(1, this.#frame.viewport[3]);
		const isThinLine = System.Math.max(lineWidths[0], lineWidths[1]) * System.Math.min(lineScaleX, lineScaleY) <= THIN_LINE_MAXIMUM_WIDTH;
		if (!isThinLine && !this.readJumpFloodTarget(lineTarget)) {
			this.restoreState();
			return;
		}
		webGL2RenderingContext.bindVertexArray(this.#emptyVertexArray);
		webGL2RenderingContext.viewport(0, 0, lineTarget.width, lineTarget.height);
		webGL2RenderingContext.disable(webGL2RenderingContext.DEPTH_TEST);
		webGL2RenderingContext.depthMask(false);
		webGL2RenderingContext.disable(webGL2RenderingContext.CULL_FACE);
		webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);

		// 가는 선: 씨앗 쪽 판 고르기 한 패스.
		if (isThinLine) {
			webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, lineTarget.edgeMaskFramebuffer);
			webGL2RenderingContext.clearBufferuiv(webGL2RenderingContext.COLOR, 0, ZERO_CLEAR_VALUE);
			this.useEdgeProgram(this.#edgeMaskProgram, lineTarget, lineWidths);
			webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLES, 0, 3);
			lineTarget.outlinePath = "thin";
			if (isScaled && this.readCoverageTarget(lineTarget)) {
				this.drawThinCoverage(lineTarget, lineWidths, lineScaleX, lineScaleY);
				lineTarget.outlinePath = "thinScaled";
			}
			this.unbindEndTextures();
			this.restoreState();
			return;
		}

		// 1. 씨앗 고르기.
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, lineTarget.seedFramebuffer);
		webGL2RenderingContext.clearBufferuiv(webGL2RenderingContext.COLOR, 0, ZERO_CLEAR_VALUE);
		this.useEdgeProgram(this.#seedProgram, lineTarget, lineWidths);
		webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLES, 0, 3);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + DEPTH_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, null);

		// 2. 넓히기 판으로 모으기. (줄인 판이면 칸마다 가장 가까운 씨앗)
		const pointScaleX = lineTarget.width / lineTarget.jumpFloodWidth;
		const pointScaleY = lineTarget.height / lineTarget.jumpFloodHeight;
		const seedGatherProgram = this.#seedGatherProgram;
		webGL2RenderingContext.viewport(0, 0, lineTarget.jumpFloodWidth, lineTarget.jumpFloodHeight);
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, lineTarget.jumpFloodFramebuffers[0]);
		webGL2RenderingContext.clearBufferuiv(webGL2RenderingContext.COLOR, 0, ZERO_CLEAR_VALUE);
		seedGatherProgram.useProgram();
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + LINE_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, lineTarget.seedTexture);
		webGL2RenderingContext.uniform1i(seedGatherProgram.getUniformLocation("seedTexture"), LINE_TEXTURE_UNIT);
		webGL2RenderingContext.uniform2f(seedGatherProgram.getUniformLocation("pointScale"), pointScaleX, pointScaleY);
		webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLES, 0, 3);

		// 3. 점프 플러딩. (그리는 영역 굵기의 반과 덮는 몫의 반 픽셀을 넓히기 판 칸으로, 섞을 때 보는 2x2 칸만큼 더)
		const jumpFloodProgram = this.#jumpFloodProgram;
		jumpFloodProgram.useProgram();
		webGL2RenderingContext.uniform1i(jumpFloodProgram.getUniformLocation("seedTexture"), LINE_TEXTURE_UNIT);
		webGL2RenderingContext.uniform2f(jumpFloodProgram.getUniformLocation("pointScale"), pointScaleX, pointScaleY);
		const reach = (System.Math.max(lineWidths[0], lineWidths[1]) * 0.5 + 0.5) * System.Math.min(lineScaleX, lineScaleY) / System.Math.min(pointScaleX, pointScaleY) + 1.5;
		let seedIndex = 0;
		for (const stepSize of readJumpFloodSteps(reach)) {
			webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, lineTarget.jumpFloodFramebuffers[1 - seedIndex]);
			webGL2RenderingContext.clearBufferuiv(webGL2RenderingContext.COLOR, 0, ZERO_CLEAR_VALUE);
			webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + LINE_TEXTURE_UNIT);
			webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, lineTarget.jumpFloodTextures[seedIndex]);
			webGL2RenderingContext.uniform1i(jumpFloodProgram.getUniformLocation("stepSize"), stepSize);
			webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLES, 0, 3);
			seedIndex = 1 - seedIndex;
		}
		lineTarget.jumpFloodIndex = seedIndex;
		lineTarget.outlinePath = "jumpFlood";
		this.unbindEndTextures();
		this.restoreState();
	}

	//==============================================================================
	// 줄인 선의 판의 가는 선 덮는 몫 판 짓기. (RGBA8 곱한 색, 쌍선형, 처음 줄여 가는 선을 그을 때 한 번)
	//==============================================================================
	/**
	 * @param { object } lineTarget - 선의 판.
	 * @returns { boolean } 판이 있으면 true. (못 지으면 false, 그때 가는 선은 섞기 한 패스 길로 간다)
	 * @private
	 */
	readCoverageTarget(lineTarget) {
		if (lineTarget.coverageTexture !== null) {
			return true;
		}
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const previousTexture = webGL2RenderingContext.getParameter(webGL2RenderingContext.TEXTURE_BINDING_2D);
		const previousFramebuffer = webGL2RenderingContext.getParameter(webGL2RenderingContext.FRAMEBUFFER_BINDING);
		const texture = this.createTargetTexture(webGL2RenderingContext.RGBA8, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, lineTarget.width, lineTarget.height);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, webGL2RenderingContext.LINEAR);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, webGL2RenderingContext.LINEAR);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, previousTexture);
		const framebuffer = this.createTargetFramebuffer(texture, null);
		const isComplete = this.isFramebufferComplete();
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, previousFramebuffer);
		if (!isComplete) {
			webGL2RenderingContext.deleteFramebuffer(framebuffer);
			webGL2RenderingContext.deleteTexture(texture);
			return false;
		}
		lineTarget.coverageFramebuffer = framebuffer;
		lineTarget.coverageTexture = texture;
		return true;
	}

	//==============================================================================
	// 줄인 선의 판 해상도에서 가는 선의 덮는 몫(곱한 색)을 한 번 셈하기. (섞기와 같은 셈, 거리는 그리는 영역 화소로 잰다)
	//==============================================================================
	/**
	 * @param { object } lineTarget - 선의 판.
	 * @param { Array<number> } lineWidths - 이번 프레임의 [바깥 선, 꺾임 선] 굵기. (그리는 영역 픽셀)
	 * @param { number } lineScaleX - 선의 판 너비 / 그리는 영역 너비.
	 * @param { number } lineScaleY - 선의 판 높이 / 그리는 영역 높이.
	 * @private
	 */
	drawThinCoverage(lineTarget, lineWidths, lineScaleX, lineScaleY) {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const program = this.#thinCoverageProgram;
		const isLineColorEnabled = this.#lineColorCount > 0 && this.uploadLineColorTable();
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, lineTarget.coverageFramebuffer);
		webGL2RenderingContext.clearBufferfv(webGL2RenderingContext.COLOR, 0, ZERO_CLEAR_FLOAT_VALUE);
		program.useProgram();
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + LINE_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, lineTarget.edgeMaskTexture);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + COMPOSITE_LINE_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, lineTarget.lineTexture);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + COMPOSITE_DEPTH_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, lineTarget.depthTexture);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + LINE_COLOR_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, isLineColorEnabled ? this.#lineColorTexture : null);
		webGL2RenderingContext.uniform1i(program.getUniformLocation("edgeMaskTexture"), LINE_TEXTURE_UNIT);
		webGL2RenderingContext.uniform1i(program.getUniformLocation("lineTexture"), COMPOSITE_LINE_TEXTURE_UNIT);
		webGL2RenderingContext.uniform1i(program.getUniformLocation("depthTexture"), COMPOSITE_DEPTH_TEXTURE_UNIT);
		webGL2RenderingContext.uniform1i(program.getUniformLocation("lineColorTexture"), LINE_COLOR_TEXTURE_UNIT);
		webGL2RenderingContext.uniform1f(program.getUniformLocation("lineColorEnabled"), isLineColorEnabled ? 1 : 0);
		webGL2RenderingContext.uniform2f(program.getUniformLocation("lineScale"), lineScaleX, lineScaleY);
		webGL2RenderingContext.uniform2f(program.getUniformLocation("lineWidths"), lineWidths[0], lineWidths[1]);
		webGL2RenderingContext.uniform1f(program.getUniformLocation("creaseOpacity"), this.#creaseOpacity);
		const color = this.#color;
		webGL2RenderingContext.uniform4f(program.getUniformLocation("outlineColor"), color[0], color[1], color[2], color[3]);
		webGL2RenderingContext.uniform1f(program.getUniformLocation("hdrOutput"), this.#isHdrOutput ? 1 : 0);
		webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLES, 0, 3);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + LINE_COLOR_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, null);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + COMPOSITE_DEPTH_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, null);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
	}

	//==============================================================================
	// 경계를 보는 프로그램(씨앗, 가는 선의 씨앗 쪽 판)을 쓰고 선의 판, 깊이, 카메라, 문턱을 묶기.
	//==============================================================================
	/**
	 * @param { ShaderProgram } program - #seedProgram 이나 #edgeMaskProgram.
	 * @param { object } lineTarget - 선의 판.
	 * @param { Array<number> } lineWidths - 이번 프레임의 [바깥 선, 꺾임 선] 굵기.
	 * @private
	 */
	useEdgeProgram(program, lineTarget, lineWidths) {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const frame = this.#frame;
		const projectionElements = frame.projectionElements;
		const viewElements = frame.viewElements;
		program.useProgram();
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + LINE_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, lineTarget.lineTexture);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + DEPTH_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, lineTarget.depthTexture);
		webGL2RenderingContext.uniform1i(program.getUniformLocation("lineTexture"), LINE_TEXTURE_UNIT);
		webGL2RenderingContext.uniform1i(program.getUniformLocation("depthTexture"), DEPTH_TEXTURE_UNIT);
		webGL2RenderingContext.uniformMatrix3fv(program.getUniformLocation("viewRotation"), false, [viewElements[0], viewElements[1], viewElements[2], viewElements[4], viewElements[5], viewElements[6], viewElements[8], viewElements[9], viewElements[10]]);
		webGL2RenderingContext.uniform4f(program.getUniformLocation("projectionScale"), projectionElements[0], projectionElements[5], projectionElements[8], projectionElements[9]);
		webGL2RenderingContext.uniform4f(program.getUniformLocation("projectionDepth"), projectionElements[10], projectionElements[14], projectionElements[12], projectionElements[13]);
		webGL2RenderingContext.uniform1f(program.getUniformLocation("isPerspective"), frame.isPerspective ? 1 : 0);
		webGL2RenderingContext.uniform1f(program.getUniformLocation("depthThreshold"), this.#depthThreshold);
		webGL2RenderingContext.uniform1f(program.getUniformLocation("depthMargin"), this.#depthMargin);
		webGL2RenderingContext.uniform1f(program.getUniformLocation("creaseCosine"), lineWidths[1] > 0 ? this.#creaseCosine : -2);
	}

	//==============================================================================
	// endLineIds 가 묶은 텍스처 풀기. (선의 판 유닛과 깊이 유닛, 버텍스 어레이)
	//==============================================================================
	/**
	 * @private
	 */
	unbindEndTextures() {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		for (const textureUnit of [DEPTH_TEXTURE_UNIT, LINE_TEXTURE_UNIT]) {
			webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + textureUnit);
			webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, null);
		}
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		webGL2RenderingContext.bindVertexArray(null);
	}

	//==============================================================================
	// 바깥선 긋기. (가는 선은 씨앗 쪽 판, 굵은 선은 넓힌 씨앗 판으로 beginLineIds 때의 그리는 영역에 섞는다, 깊이는 보지도 쓰지도 않는다, 스텐실은 그대로)
	//==============================================================================
	drawOutline() {
		const lineTarget = this.#lineTarget;
		const frame = this.#frame;
		if (lineTarget === null || frame === null || lineTarget.outlinePath === "none") {
			return;
		}
		if (lineTarget.outlinePath === "thinScaled") {
			this.drawCoverageBlit(lineTarget);
			return;
		}
		const isThinLine = lineTarget.outlinePath === "thin";
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		this.saveState();
		const viewport = frame.viewport;
		webGL2RenderingContext.viewport(viewport[0], viewport[1], viewport[2], viewport[3]);
		webGL2RenderingContext.disable(webGL2RenderingContext.DEPTH_TEST);
		webGL2RenderingContext.depthMask(false);
		webGL2RenderingContext.disable(webGL2RenderingContext.CULL_FACE);
		webGL2RenderingContext.enable(webGL2RenderingContext.BLEND);
		webGL2RenderingContext.blendFunc(webGL2RenderingContext.ONE, webGL2RenderingContext.ONE_MINUS_SRC_ALPHA);
		const compositeProgram = isThinLine ? this.#thinCompositeProgram : this.#compositeProgram;
		compositeProgram.useProgram();
		const isLineColorEnabled = this.#lineColorCount > 0 && this.uploadLineColorTable();
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + LINE_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, isThinLine ? lineTarget.edgeMaskTexture : lineTarget.jumpFloodTextures[lineTarget.jumpFloodIndex]);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + COMPOSITE_LINE_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, lineTarget.lineTexture);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + COMPOSITE_DEPTH_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, lineTarget.depthTexture);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + LINE_COLOR_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, isLineColorEnabled ? this.#lineColorTexture : null);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		const color = this.#color;
		const lineWidths = this.#lineWidths;
		if (isThinLine) {
			webGL2RenderingContext.uniform1i(compositeProgram.getUniformLocation("edgeMaskTexture"), LINE_TEXTURE_UNIT);
		}
		else {
			webGL2RenderingContext.uniform1i(compositeProgram.getUniformLocation("seedTexture"), LINE_TEXTURE_UNIT);
			webGL2RenderingContext.uniform2f(compositeProgram.getUniformLocation("pointScale"), lineTarget.width / lineTarget.jumpFloodWidth, lineTarget.height / lineTarget.jumpFloodHeight);
			webGL2RenderingContext.uniform2f(compositeProgram.getUniformLocation("lineScale"), lineTarget.width / System.Math.max(1, viewport[2]), lineTarget.height / System.Math.max(1, viewport[3]));
		}
		webGL2RenderingContext.uniform1i(compositeProgram.getUniformLocation("lineTexture"), COMPOSITE_LINE_TEXTURE_UNIT);
		webGL2RenderingContext.uniform1i(compositeProgram.getUniformLocation("depthTexture"), COMPOSITE_DEPTH_TEXTURE_UNIT);
		webGL2RenderingContext.uniform1i(compositeProgram.getUniformLocation("lineColorTexture"), LINE_COLOR_TEXTURE_UNIT);
		webGL2RenderingContext.uniform1f(compositeProgram.getUniformLocation("lineColorEnabled"), isLineColorEnabled ? 1 : 0);
		webGL2RenderingContext.uniform4f(compositeProgram.getUniformLocation("viewportRect"), viewport[0], viewport[1], System.Math.max(1, viewport[2]), System.Math.max(1, viewport[3]));
		webGL2RenderingContext.uniform2f(compositeProgram.getUniformLocation("lineWidths"), lineWidths[0], lineWidths[1]);
		webGL2RenderingContext.uniform1f(compositeProgram.getUniformLocation("creaseOpacity"), this.#creaseOpacity);
		webGL2RenderingContext.uniform4f(compositeProgram.getUniformLocation("outlineColor"), color[0], color[1], color[2], color[3]);
		webGL2RenderingContext.uniform1f(compositeProgram.getUniformLocation("hdrOutput"), this.#isHdrOutput ? 1 : 0);
		webGL2RenderingContext.bindVertexArray(this.#emptyVertexArray);
		webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLES, 0, 3);
		webGL2RenderingContext.bindVertexArray(null);
		for (const textureUnit of [LINE_TEXTURE_UNIT, COMPOSITE_LINE_TEXTURE_UNIT, COMPOSITE_DEPTH_TEXTURE_UNIT, LINE_COLOR_TEXTURE_UNIT]) {
			webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + textureUnit);
			webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, null);
		}
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		this.restoreState();
	}

	//==============================================================================
	// 줄인 선의 판의 덮는 몫 판을 그리는 영역에 쌍선형으로 한 번 읽어 섞기.
	//==============================================================================
	/**
	 * @param { object } lineTarget - 선의 판. (outlinePath 가 "thinScaled")
	 * @private
	 */
	drawCoverageBlit(lineTarget) {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const viewport = this.#frame.viewport;
		this.saveState();
		webGL2RenderingContext.viewport(viewport[0], viewport[1], viewport[2], viewport[3]);
		webGL2RenderingContext.disable(webGL2RenderingContext.DEPTH_TEST);
		webGL2RenderingContext.depthMask(false);
		webGL2RenderingContext.disable(webGL2RenderingContext.CULL_FACE);
		webGL2RenderingContext.enable(webGL2RenderingContext.BLEND);
		webGL2RenderingContext.blendFunc(webGL2RenderingContext.ONE, webGL2RenderingContext.ONE_MINUS_SRC_ALPHA);
		const program = this.#coverageBlitProgram;
		program.useProgram();
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + LINE_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, lineTarget.coverageTexture);
		webGL2RenderingContext.uniform1i(program.getUniformLocation("coverageTexture"), LINE_TEXTURE_UNIT);
		webGL2RenderingContext.uniform4f(program.getUniformLocation("viewportRect"), viewport[0], viewport[1], System.Math.max(1, viewport[2]), System.Math.max(1, viewport[3]));
		webGL2RenderingContext.bindVertexArray(this.#emptyVertexArray);
		webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLES, 0, 3);
		webGL2RenderingContext.bindVertexArray(null);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, null);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		this.restoreState();
	}

	//==============================================================================
	// 번호 색 표를 텍스처에 올리기. (처음이면 짓고, 바뀐 때만 통째로 64 KB 를 올린다)
	//==============================================================================
	/**
	 * @returns { boolean } 텍스처가 있으면 true.
	 * @private
	 */
	uploadLineColorTable() {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		if (this.#lineColorTexture === null) {
			this.#lineColorTexture = webGL2RenderingContext.createTexture();
			if (this.#lineColorTexture === null) {
				return false;
			}
			this.#isLineColorTableDirty = true;
			this.#uploadedLineColorTable = null; // 새 텍스처에는 아직 올린 것이 없다.
		}
		if (!this.#isLineColorTableDirty) {
			return true;
		}
		this.#isLineColorTableDirty = false;
		// 올린 표와 같으면 올리지 않는다. (clearLineColors 뒤 같은 색을 다시 걸어 표가 그대로인 프레임, 4 바이트씩 견준다)
		const uploadedTable = this.#uploadedLineColorTable;
		if (uploadedTable !== null) {
			const words = this.#lineColorWords;
			let isSame = true;
			for (let index = 0; index < words.length; ++index) {
				if (words[index] !== uploadedTable[index]) {
					isSame = false;
					break;
				}
			}
			if (isSame) {
				return true;
			}
			uploadedTable.set(words);
		}
		else {
			this.#uploadedLineColorTable = this.#lineColorWords.slice();
		}
		const isFlipped = webGL2RenderingContext.getParameter(webGL2RenderingContext.UNPACK_FLIP_Y_WEBGL);
		const isPremultiplied = webGL2RenderingContext.getParameter(webGL2RenderingContext.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
		const unpackAlignment = webGL2RenderingContext.getParameter(webGL2RenderingContext.UNPACK_ALIGNMENT);
		webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_FLIP_Y_WEBGL, false);
		webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
		webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_ALIGNMENT, 4);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + LINE_COLOR_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, this.#lineColorTexture);
		const height = (TOON_SCREEN_OUTLINE_MAXIMUM_LINE_ID + 1) / LINE_COLOR_TABLE_WIDTH;
		webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.RGBA8, LINE_COLOR_TABLE_WIDTH, height, 0, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, this.#lineColorTable);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, webGL2RenderingContext.NEAREST);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, webGL2RenderingContext.NEAREST);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);
		webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_FLIP_Y_WEBGL, isFlipped);
		webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_PREMULTIPLY_ALPHA_WEBGL, isPremultiplied);
		webGL2RenderingContext.pixelStorei(webGL2RenderingContext.UNPACK_ALIGNMENT, unpackAlignment);
		this.#isLineColorTableDirty = false;
		return true;
	}

	//==============================================================================
	// 이번 프레임의 선 굵기 셈. ([바깥 선, 꺾임 선] 의 그리는 영역 픽셀, 0 이 아니면 한 픽셀 밑으로 내리지 않음)
	//==============================================================================
	/**
	 * @returns { Array<number> } [바깥 선 굵기, 꺾임 선 굵기].
	 */
	readLineWidths() {
		const frame = this.#frame;
		let pixelsPerUnit = 1;
		if (this.#widthUnit === ToonOutlineWidthUnit.world) {
			pixelsPerUnit = frame.viewport[3] * 0.5 * System.Math.abs(frame.projectionElements[5]);
			if (frame.isPerspective) {
				const averageDistance = this.#drawnDistanceCount > 0 ? this.#drawnDistanceSum / this.#drawnDistanceCount : 1;
				const focusDistance = this.#focusDistance > 0 ? this.#focusDistance : averageDistance;
				pixelsPerUnit /= System.Math.max(0.001, focusDistance);
			}
		}
		const toPixels = (width) => {
			return width > 0 ? System.Math.max(1, width * pixelsPerUnit) : 0;
		};
		return [toPixels(this.#width), toPixels(this.#creaseWidth)];
	}

	//==============================================================================
	// 그린 모형의 거리 더하기. (초점 거리를 주지 않은 원근에서 쓴다, 보기 공간의 앞쪽 거리)
	//==============================================================================
	/**
	 * @param { object } mesh - ToonRenderer.createMesh 의 결과.
	 * @param { Float32Array } modelElements - 모형 행렬의 수 16.
	 */
	addDrawnDistance(mesh, modelElements) {
		const center = mesh.boundingCenter;
		const viewElements = this.#frame.viewElements;
		const worldX = modelElements[0] * center[0] + modelElements[4] * center[1] + modelElements[8] * center[2] + modelElements[12];
		const worldY = modelElements[1] * center[0] + modelElements[5] * center[1] + modelElements[9] * center[2] + modelElements[13];
		const worldZ = modelElements[2] * center[0] + modelElements[6] * center[1] + modelElements[10] * center[2] + modelElements[14];
		const viewZ = viewElements[2] * worldX + viewElements[6] * worldY + viewElements[10] * worldZ + viewElements[14];
		if (viewZ < 0) {
			this.#drawnDistanceSum += -viewZ;
			this.#drawnDistanceCount += 1;
		}
	}

	//==============================================================================
	// 경계 구가 이번 프레임의 절두체 안에 드는지.
	//==============================================================================
	/**
	 * @param { object } mesh - ToonRenderer.createMesh 의 결과.
	 * @param { Float32Array } modelElements - 모형 행렬의 수 16.
	 * @returns { boolean } 절두체 안에 들면 true.
	 */
	isVisible(mesh, modelElements) {
		const center = mesh.boundingCenter;
		const centerX = modelElements[0] * center[0] + modelElements[4] * center[1] + modelElements[8] * center[2] + modelElements[12];
		const centerY = modelElements[1] * center[0] + modelElements[5] * center[1] + modelElements[9] * center[2] + modelElements[13];
		const centerZ = modelElements[2] * center[0] + modelElements[6] * center[1] + modelElements[10] * center[2] + modelElements[14];
		const scaleX = readHypot(modelElements[0], modelElements[1], modelElements[2]);
		const scaleY = readHypot(modelElements[4], modelElements[5], modelElements[6]);
		const scaleZ = readHypot(modelElements[8], modelElements[9], modelElements[10]);
		const radius = mesh.boundingRadius * System.Math.max(scaleX, scaleY, scaleZ);
		const frustumPlanes = this.#frame.frustumPlanes;
		for (let planeIndex = 0; planeIndex < frustumPlanes.length; ++planeIndex) {
			const plane = frustumPlanes[planeIndex];
			if (plane[0] * centerX + plane[1] * centerY + plane[2] * centerZ + plane[3] < -radius) {
				return false;
			}
		}
		return true;
	}

	//==============================================================================
	// 선의 판 읽기. (크기가 바뀌면 다시 지음, 그리는 영역 해상도의 노멀과 번호 RGBA8, 깊이 24, 씨앗 RGBA16UI 와 넓히기 판 RGBA16UI 둘, 짓지 못하면 null)
	//==============================================================================
	/**
	 * @param { number } width - 선의 판 너비. (그리는 영역 픽셀)
	 * @param { number } height - 선의 판 높이.
	 * @param { number } jumpFloodWidth - 넓히기 판 너비.
	 * @param { number } jumpFloodHeight - 넓히기 판 높이.
	 * @returns { object | null } 선의 판. (짓지 못하면 null)
	 */
	readLineTarget(width, height, jumpFloodWidth, jumpFloodHeight) {
		const existingTarget = this.#lineTarget;
		if (existingTarget !== null && existingTarget.width === width && existingTarget.height === height && existingTarget.jumpFloodWidth === jumpFloodWidth && existingTarget.jumpFloodHeight === jumpFloodHeight) {
			return existingTarget;
		}
		this.deleteLineTarget();
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const previousTexture = webGL2RenderingContext.getParameter(webGL2RenderingContext.TEXTURE_BINDING_2D);
		const previousFramebuffer = webGL2RenderingContext.getParameter(webGL2RenderingContext.FRAMEBUFFER_BINDING);
		const lineTexture = this.createTargetTexture(webGL2RenderingContext.RGBA8, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, width, height);
		const depthTexture = this.createTargetTexture(webGL2RenderingContext.DEPTH_COMPONENT24, webGL2RenderingContext.DEPTH_COMPONENT, webGL2RenderingContext.UNSIGNED_INT, width, height);
		const edgeMaskTexture = this.createTargetTexture(webGL2RenderingContext.R8UI, webGL2RenderingContext.RED_INTEGER, webGL2RenderingContext.UNSIGNED_BYTE, width, height);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, previousTexture);
		const framebuffer = this.createTargetFramebuffer(lineTexture, depthTexture);
		let isComplete = this.isFramebufferComplete();
		const edgeMaskFramebuffer = this.createTargetFramebuffer(edgeMaskTexture, null);
		isComplete = isComplete && this.isFramebufferComplete();
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, previousFramebuffer);
		this.#lineTarget = { framebuffer: framebuffer, lineTexture: lineTexture, depthTexture: depthTexture, edgeMaskFramebuffer: edgeMaskFramebuffer, edgeMaskTexture: edgeMaskTexture, seedFramebuffer: null, seedTexture: null, jumpFloodFramebuffers: [], jumpFloodTextures: [], jumpFloodIndex: -1, coverageFramebuffer: null, coverageTexture: null, outlinePath: "none", width: width, height: height, jumpFloodWidth: jumpFloodWidth, jumpFloodHeight: jumpFloodHeight };
		if (!isComplete) {
			this.deleteLineTarget();
			return null;
		}
		return this.#lineTarget;
	}

	//==============================================================================
	// 굵은 선의 씨앗 판과 넓히기 판 짓기. (처음 굵은 선을 그을 때 한 번, 가는 선만 쓰면 짓지 않는다)
	//==============================================================================
	/**
	 * @param { object } lineTarget - 선의 판.
	 * @returns { boolean } 판이 있으면 true. (짓지 못하면 false, 그 프레임은 긋지 않는다)
	 * @private
	 */
	readJumpFloodTarget(lineTarget) {
		if (lineTarget.seedTexture !== null) {
			return true;
		}
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const previousTexture = webGL2RenderingContext.getParameter(webGL2RenderingContext.TEXTURE_BINDING_2D);
		const previousFramebuffer = webGL2RenderingContext.getParameter(webGL2RenderingContext.FRAMEBUFFER_BINDING);
		lineTarget.seedTexture = this.createTargetTexture(webGL2RenderingContext.RGBA16UI, webGL2RenderingContext.RGBA_INTEGER, webGL2RenderingContext.UNSIGNED_SHORT, lineTarget.width, lineTarget.height);
		lineTarget.jumpFloodTextures = [
			this.createTargetTexture(webGL2RenderingContext.RGBA16UI, webGL2RenderingContext.RGBA_INTEGER, webGL2RenderingContext.UNSIGNED_SHORT, lineTarget.jumpFloodWidth, lineTarget.jumpFloodHeight),
			this.createTargetTexture(webGL2RenderingContext.RGBA16UI, webGL2RenderingContext.RGBA_INTEGER, webGL2RenderingContext.UNSIGNED_SHORT, lineTarget.jumpFloodWidth, lineTarget.jumpFloodHeight),
		];
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, previousTexture);
		lineTarget.seedFramebuffer = this.createTargetFramebuffer(lineTarget.seedTexture, null);
		let isComplete = this.isFramebufferComplete();
		for (const jumpFloodTexture of lineTarget.jumpFloodTextures) {
			lineTarget.jumpFloodFramebuffers.push(this.createTargetFramebuffer(jumpFloodTexture, null));
			isComplete = isComplete && this.isFramebufferComplete();
		}
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, previousFramebuffer);
		if (!isComplete) {
			this.deleteJumpFloodTarget(lineTarget);
			return false;
		}
		return true;
	}

	//==============================================================================
	// 선의 판 텍스처 하나 짓기. (가까운 칸 거르기, 가장자리 늘이기, 묶은 채로 둔다)
	//==============================================================================
	/**
	 * @param { number } internalFormat - 내부 형식.
	 * @param { number } format - 형식.
	 * @param { number } type - 자료형.
	 * @param { number } textureWidth - 너비.
	 * @param { number } textureHeight - 높이.
	 * @returns { WebGLTexture } 텍스처.
	 * @private
	 */
	createTargetTexture(internalFormat, format, type, textureWidth, textureHeight) {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const texture = webGL2RenderingContext.createTexture();
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, texture);
		webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, internalFormat, textureWidth, textureHeight, 0, format, type, null);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, webGL2RenderingContext.NEAREST);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, webGL2RenderingContext.NEAREST);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);
		return texture;
	}

	//==============================================================================
	// 선의 판 프레임버퍼 하나 짓기. (색 하나와 깊이, 묶은 채로 둔다)
	//==============================================================================
	/**
	 * @param { WebGLTexture } colorTexture - 색 텍스처.
	 * @param { WebGLTexture | null } depthTexture - 깊이 텍스처. (없으면 null)
	 * @returns { WebGLFramebuffer } 프레임버퍼.
	 * @private
	 */
	createTargetFramebuffer(colorTexture, depthTexture) {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const framebuffer = webGL2RenderingContext.createFramebuffer();
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, framebuffer);
		webGL2RenderingContext.framebufferTexture2D(webGL2RenderingContext.FRAMEBUFFER, webGL2RenderingContext.COLOR_ATTACHMENT0, webGL2RenderingContext.TEXTURE_2D, colorTexture, 0);
		if (depthTexture !== null) {
			webGL2RenderingContext.framebufferTexture2D(webGL2RenderingContext.FRAMEBUFFER, webGL2RenderingContext.DEPTH_ATTACHMENT, webGL2RenderingContext.TEXTURE_2D, depthTexture, 0);
		}
		return framebuffer;
	}

	//==============================================================================
	// 묶인 프레임버퍼가 다 됐는지.
	//==============================================================================
	/**
	 * @returns { boolean } 다 됐으면 true.
	 * @private
	 */
	isFramebufferComplete() {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		return webGL2RenderingContext.checkFramebufferStatus(webGL2RenderingContext.FRAMEBUFFER) === webGL2RenderingContext.FRAMEBUFFER_COMPLETE;
	}

	//==============================================================================
	// 굵은 선의 씨앗 판과 넓히기 판 지우기.
	//==============================================================================
	/**
	 * @param { object } lineTarget - 선의 판.
	 * @private
	 */
	deleteJumpFloodTarget(lineTarget) {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		webGL2RenderingContext.deleteFramebuffer(lineTarget.seedFramebuffer);
		for (const jumpFloodFramebuffer of lineTarget.jumpFloodFramebuffers) {
			webGL2RenderingContext.deleteFramebuffer(jumpFloodFramebuffer);
		}
		webGL2RenderingContext.deleteTexture(lineTarget.seedTexture);
		for (const jumpFloodTexture of lineTarget.jumpFloodTextures) {
			webGL2RenderingContext.deleteTexture(jumpFloodTexture);
		}
		lineTarget.seedFramebuffer = null;
		lineTarget.seedTexture = null;
		lineTarget.jumpFloodFramebuffers = [];
		lineTarget.jumpFloodTextures = [];
		lineTarget.jumpFloodIndex = -1;
	}

	//==============================================================================
	// 선의 판 지우기.
	//==============================================================================
	deleteLineTarget() {
		const lineTarget = this.#lineTarget;
		if (lineTarget === null) {
			return;
		}
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		this.deleteJumpFloodTarget(lineTarget);
		webGL2RenderingContext.deleteFramebuffer(lineTarget.framebuffer);
		webGL2RenderingContext.deleteFramebuffer(lineTarget.edgeMaskFramebuffer);
		webGL2RenderingContext.deleteTexture(lineTarget.lineTexture);
		webGL2RenderingContext.deleteTexture(lineTarget.depthTexture);
		webGL2RenderingContext.deleteTexture(lineTarget.edgeMaskTexture);
		if (lineTarget.coverageTexture !== null) {
			webGL2RenderingContext.deleteFramebuffer(lineTarget.coverageFramebuffer);
			webGL2RenderingContext.deleteTexture(lineTarget.coverageTexture);
		}
		this.#lineTarget = null;
	}

	//==============================================================================
	// 그리기 상태 적어 두기.
	//==============================================================================
	saveState() {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		this.#savedState = {
			isBlendEnabled: webGL2RenderingContext.isEnabled(webGL2RenderingContext.BLEND),
			isDepthTestEnabled: webGL2RenderingContext.isEnabled(webGL2RenderingContext.DEPTH_TEST),
			isCullFaceEnabled: webGL2RenderingContext.isEnabled(webGL2RenderingContext.CULL_FACE),
			isScissorTestEnabled: webGL2RenderingContext.isEnabled(webGL2RenderingContext.SCISSOR_TEST),
			depthMask: webGL2RenderingContext.getParameter(webGL2RenderingContext.DEPTH_WRITEMASK),
			depthFunction: webGL2RenderingContext.getParameter(webGL2RenderingContext.DEPTH_FUNC),
			frontFace: webGL2RenderingContext.getParameter(webGL2RenderingContext.FRONT_FACE),
			blendSourceRGB: webGL2RenderingContext.getParameter(webGL2RenderingContext.BLEND_SRC_RGB),
			blendDestinationRGB: webGL2RenderingContext.getParameter(webGL2RenderingContext.BLEND_DST_RGB),
			blendSourceAlpha: webGL2RenderingContext.getParameter(webGL2RenderingContext.BLEND_SRC_ALPHA),
			blendDestinationAlpha: webGL2RenderingContext.getParameter(webGL2RenderingContext.BLEND_DST_ALPHA),
			clearColor: webGL2RenderingContext.getParameter(webGL2RenderingContext.COLOR_CLEAR_VALUE),
			program: webGL2RenderingContext.getParameter(webGL2RenderingContext.CURRENT_PROGRAM),
			vertexArray: webGL2RenderingContext.getParameter(webGL2RenderingContext.VERTEX_ARRAY_BINDING),
			viewport: webGL2RenderingContext.getParameter(webGL2RenderingContext.VIEWPORT),
			framebuffer: webGL2RenderingContext.getParameter(webGL2RenderingContext.FRAMEBUFFER_BINDING),
		};
	}

	//==============================================================================
	// 적어 둔 상태로 돌리기.
	//==============================================================================
	restoreState() {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const savedState = this.#savedState;
		if (savedState === null) {
			return;
		}
		const viewport = savedState.viewport;
		const clearColor = savedState.clearColor;
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, savedState.framebuffer);
		webGL2RenderingContext.viewport(viewport[0], viewport[1], viewport[2], viewport[3]);
		webGL2RenderingContext.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
		webGL2RenderingContext.bindVertexArray(savedState.vertexArray);
		webGL2RenderingContext.useProgram(savedState.program);
		webGL2RenderingContext.depthMask(savedState.depthMask);
		webGL2RenderingContext.depthFunc(savedState.depthFunction);
		webGL2RenderingContext.frontFace(savedState.frontFace);
		webGL2RenderingContext.cullFace(webGL2RenderingContext.BACK);
		webGL2RenderingContext.blendFuncSeparate(savedState.blendSourceRGB, savedState.blendDestinationRGB, savedState.blendSourceAlpha, savedState.blendDestinationAlpha);
		const capabilities = [
			[webGL2RenderingContext.BLEND, savedState.isBlendEnabled],
			[webGL2RenderingContext.DEPTH_TEST, savedState.isDepthTestEnabled],
			[webGL2RenderingContext.CULL_FACE, savedState.isCullFaceEnabled],
			[webGL2RenderingContext.SCISSOR_TEST, savedState.isScissorTestEnabled],
		];
		for (const capability of capabilities) {
			if (capability[1]) {
				webGL2RenderingContext.enable(capability[0]);
			}
			else {
				webGL2RenderingContext.disable(capability[0]);
			}
		}
		this.#savedState = null;
	}

	//==============================================================================
	// 다 쓴 뒤 지우기. (선의 판, 버텍스 어레이, 프로그램 일곱)
	//==============================================================================
	destroy() {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		this.deleteLineTarget();
		if (this.#lineColorTexture !== null) {
			webGL2RenderingContext.deleteTexture(this.#lineColorTexture);
			this.#lineColorTexture = null;
		}
		webGL2RenderingContext.deleteVertexArray(this.#emptyVertexArray);
		for (const slot of this.#batchSlots) {
			for (const vertexArray of slot.vertexArrays.values()) {
				webGL2RenderingContext.deleteVertexArray(vertexArray);
			}
			webGL2RenderingContext.deleteBuffer(slot.buffer);
		}
		this.#batchSlots.length = 0;
		webGL2RenderingContext.deleteProgram(this.#lineProgram.getProgram());
		webGL2RenderingContext.deleteProgram(this.#seedProgram.getProgram());
		webGL2RenderingContext.deleteProgram(this.#seedGatherProgram.getProgram());
		webGL2RenderingContext.deleteProgram(this.#jumpFloodProgram.getProgram());
		webGL2RenderingContext.deleteProgram(this.#compositeProgram.getProgram());
		webGL2RenderingContext.deleteProgram(this.#edgeMaskProgram.getProgram());
		webGL2RenderingContext.deleteProgram(this.#thinCompositeProgram.getProgram());
		webGL2RenderingContext.deleteProgram(this.#thinCoverageProgram.getProgram());
		webGL2RenderingContext.deleteProgram(this.#coverageBlitProgram.getProgram());
	}
}
