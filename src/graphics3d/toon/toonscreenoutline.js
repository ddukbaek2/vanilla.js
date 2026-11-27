//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { ShaderProgram } from "../../core/graphic/shaderprogram.js";
import { TOON_ATTRIBUTE_LOCATIONS, TOON_MAXIMUM_JOINTS, TOON_INSTANCE_FLOAT_COUNT, extractFrustumPlanes, readMatrixDeterminant } from "./toonrenderer.js";


/**
 * @example <caption>툰 화면 공간 바깥선을 한 프레임에 긋기</caption>
 * import { ToonRenderer, ToonScreenOutline, ToonOutlineWidthUnit, ToonMesh, Matrix4, Vector3 } from "./vanilla.js";
 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
 * const renderer = new ToonRenderer(webGL2RenderingContext);
 * const outline = new ToonScreenOutline(webGL2RenderingContext);
 * outline.setWidth(2, ToonOutlineWidthUnit.pixel);
 * outline.setCrease(50, 1, 0.8);
 * const builder = new ToonMesh.MeshBuilder();
 * builder.addPart(ToonMesh.createBoxGeometry(1, 1, 1), Matrix4.createIdentity(), "#e0c8a8", { hasOutline: false });
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

// 선 번호의 상한. (선의 판에 14 비트로 쓴다, 0 은 빈 곳)
export const TOON_SCREEN_OUTLINE_MAXIMUM_LINE_ID = 16383;

// 씨앗 판에서 씨앗이 없다는 값. (부호 없는 16 비트의 끝)
const NO_SEED = 65535;

// 인스턴스 그리기의 modelMatrix 자리. (단위 행렬)
const IDENTITY_ELEMENTS = new System.Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

// 선의 판과 씨앗 판을 묶는 텍스처 유닛. (툰 렌더러의 그림자 유닛 3 과 겹치지 않게)
const LINE_TEXTURE_UNIT = 5;
const DEPTH_TEXTURE_UNIT = 6;

// 선의 판에 노멀과 선 번호를 그리는 셰이더. (툰 렌더러의 몸 버텍스 어레이를 그대로 쓴다, 인스턴스는 틴트 칸의 x 를 번호로 읽을 수 있다)
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
	mat4 objectMatrix = instanced > 0.5 ? mat4(instanceMatrix0, instanceMatrix1, instanceMatrix2, instanceMatrix3) : modelMatrix;
	worldNormal = transpose(inverse(mat3(objectMatrix) * mat3(skinMatrix))) * vertexNormal;
	surfaceLineId = instanced > 0.5 && instanceLineIds > 0.5 ? instanceTint.x : lineId;
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
// - 바깥 선: 한쪽이 빈 곳, 번호가 다름, 같은 번호라도 서로의 접평면에서 깊이 문턱보다 떨어짐. (가린 쪽의 꼴을 따르고, 맞닿은 두 번호는 한쪽만 켜져 있어도 긋는다)
// - 꺾임 선: 같은 번호이고 떨어지지 않았는데 두 노멀이 꺾임 각보다 더 벌어짐. (비스듬한 면과 둥근 면은 접평면 안이라 바깥 선으로 잡히지 않는다)
const SEED_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D lineTexture;
uniform highp sampler2D depthTexture;
uniform mat3 viewRotation;
uniform vec4 projectionScale;
uniform vec4 projectionDepth;
uniform float isPerspective;
uniform float depthThreshold;
uniform float creaseCosine;
out uvec4 fragmentSeed;
const uint NO_SEED = 65535u;
const ivec2 SIDES[4] = ivec2[4](ivec2(1, 0), ivec2(-1, 0), ivec2(0, 1), ivec2(0, -1));
struct LinePixel {
	float id;
	float flags;
	vec3 normal;
	vec3 position;
	float footprint;
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
	}
	else {
		float viewZ = (clipDepth - projectionDepth.y) / projectionDepth.x;
		result.position = vec3((clipPoint.x - projectionDepth.z) / projectionScale.x, (clipPoint.y - projectionDepth.w) / projectionScale.y, viewZ);
		result.footprint = 2.0 / (projectionScale.y * size.y);
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
	vec3 offset = second.position - first.position;
	float planeDistance = min(abs(dot(offset, first.normal)), abs(dot(offset, second.normal)));
	bool isSeparated = planeDistance > depthThreshold + 2.0 * max(first.footprint, second.footprint);
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
const COMPOSITE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;
uniform highp usampler2D seedTexture;
uniform vec4 viewportRect;
uniform vec2 pointScale;
uniform vec2 lineWidths;
uniform float creaseOpacity;
uniform vec4 outlineColor;
uniform float hdrOutput;
out vec4 fragmentColor;
const uint NO_SEED = 65535u;
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
void main() {
	ivec2 size = textureSize(seedTexture, 0);
	vec2 toOutput = vec2(1.0);
	vec2 point = gl_FragCoord.xy - viewportRect.xy - 0.5;
	ivec2 basePixel = ivec2(floor((point + 0.5) / pointScale - 0.5));
	float contourDistance = 1.0e9;
	float creaseDistance = 1.0e9;
	for (int offsetY = 0; offsetY <= 1; ++offsetY) {
		for (int offsetX = 0; offsetX <= 1; ++offsetX) {
			ivec2 samplePixel = clamp(basePixel + ivec2(offsetX, offsetY), ivec2(0), size - 1);
			uvec4 seed = texelFetch(seedTexture, samplePixel, 0);
			contourDistance = min(contourDistance, readSeedDistance(point, seed.xy, toOutput));
			creaseDistance = min(creaseDistance, readSeedDistance(point, seed.zw, toOutput));
		}
	}
	float contour = lineWidths.x > 0.0 ? clamp(lineWidths.x * 0.5 - contourDistance + 0.5, 0.0, 1.0) : 0.0;
	float crease = lineWidths.y > 0.0 ? clamp(lineWidths.y * 0.5 - creaseDistance + 0.5, 0.0, 1.0) * creaseOpacity : 0.0;
	float strength = max(contour, crease) * outlineColor.a;
	if (strength < 0.004) {
		discard;
	}
	vec3 color = hdrOutput > 0.5 ? pow(outlineColor.rgb, vec3(2.2)) : outlineColor.rgb;
	fragmentColor = vec4(color * strength, strength);
}
`;


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
// 툰 화면 공간 바깥선. (노멀, 선 번호, 깊이를 선의 판에 그리고, 바로 이웃 사이의 경계에서 선을 잡아 점프 플러딩으로 넓힌 뒤 거리로 덮는 몫을 셈해 섞는다)
// - 선의 판: ToonRenderer 의 createMesh 결과를 같은 행렬로 한 번 더 그려 노멀(팔면체 접기), 선 번호(14 비트), 꼴(바깥 선, 꺾임 선을 켤지)과 깊이를 쓴다.
// - 잡기: 화소와 바로 이웃 넷 사이의 경계마다 한 번 본다. 선은 화소가 아니라 화소 사이의 경계 가운데에 선다. (같은 경계를 두 번 긋지 않는다)
//   바깥 선은 빈 곳과 맞닿은 실루엣, 다른 번호와 맞닿은 곳, 같은 번호라도 서로의 접평면에서 깊이 문턱보다 떨어진 곳(가려진 실루엣)이다.
//   꺾임 선은 같은 번호 안에서 이웃한 두 노멀이 꺾임 각보다 더 벌어진 곳이다. 화소 하나 사이의 노멀만 보므로 둥근 면의 실루엣 둘레나 비스듬한 면에 띠가 서지 않는다.
//   깊이를 접평면 거리로 견주므로 비스듬히 보는 바닥에 가짜 선이 서지 않는다. 문턱에 그 깊이의 화소 크기 두 배를 더해 먼 것도 같은 뜻이 된다.
// - 넓히기: 경계 토막까지의 거리를 점프 플러딩으로 퍼뜨린다. 굵기에 상관없이 걸음 수는 log2 이고, 바깥 선과 꺾임 선은 따로 퍼뜨려 굵기를 따로 준다.
// - 섞기: 그리는 영역의 화소마다 가장 가까운 경계까지의 거리로 clamp(굵기 / 2 - 거리 + 0.5, 0, 1) 만큼 덮는다. (가장자리가 부드럽고, 넓히기 판을 줄여도 계단과 점선이 없다)
// - 모형마다: drawMesh 의 hasScreenOutline 이 false 면 그 모형은 선을 내지 않고 뒤의 선만 가린다. hasCreaseLine 이 false 면 꺾임 선만 끈다.
// - 굵기: setWidth 와 setCrease 의 굵기는 선 하나의 굵기다. (경계를 가운데로 양쪽에 반씩) 단위는 ToonOutlineWidthUnit, 한 픽셀 밑으로 내리지 않는다.
// - 깊이: 투영 행렬로 직교와 원근을 가리고, 깊이를 보기 공간 자리로 풀어 견준다. (화면 사각형처럼 클립 x, y 를 옮긴 투영도 된다)
// - 값: setResolutionScale 로 넓히기(점프 플러딩) 판을 줄인다. (폰의 가벼운 길) 선의 판과 씨앗은 그리는 영역 해상도라 줄여도 선 자리는 그대로다.
// - 사용: 매 프레임 beginLineIds(보기, 투영) → drawMesh / drawMeshInstanced → endLineIds() (씨앗과 넓히기까지 셈) → 툰 몸 그리기 → drawOutline().
//   beginLineIds 는 그때의 뷰포트를 그리는 영역으로 적어 두고, 선의 판을 그 크기에 맞춰 짓는다. endLineIds 와 drawOutline 이 프레임버퍼, 뷰포트, 상태를 돌린다.
//   ToonDrawQueue.setScreenOutline 으로 맡기면 그리기 줄이 이 차례를 스스로 한다. (엔진 2D 그리기 사이에 끼울 때, 그 전에 Graphic.flushSpriteBatch)
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
	/** @private @type { WebGLVertexArrayObject } */ #emptyVertexArray; // 화면 세모용 빈 버텍스 어레이.
	/** @private @type { object | null } */ #lineTarget; // 선의 판. ({ framebuffer, lineTexture, depthTexture, seedFramebuffer, seedTexture, jumpFloodFramebuffers, jumpFloodTextures, jumpFloodIndex, width, height, jumpFloodWidth, jumpFloodHeight })
	/** @private @type { Array<number> } */ #color; // 선 색. (sRGB, 알파)
	/** @private @type { number } */ #width; // 바깥 선 굵기.
	/** @private @type { string } */ #widthUnit;
	/** @private @type { number } */ #focusDistance; // 원근에서 월드 굵기를 픽셀로 셀 거리. (0 이면 그린 모형의 평균 거리)
	/** @private @type { number } */ #depthThreshold; // 같은 번호를 떨어진 것으로 칠 접평면 거리. (월드 길이)
	/** @private @type { number } */ #creaseCosine;
	/** @private @type { number } */ #creaseWidth; // 꺾임 선 굵기. (바깥 선과 같은 단위)
	/** @private @type { number } */ #creaseOpacity;
	/** @private @type { number } */ #resolutionScale;
	/** @private @type { boolean } */ #isHdrOutput;
	/** @private @type { object | null } */ #frame; // 이번 프레임의 카메라. ({ viewProjectionElements, viewElements, projectionElements, frustumPlanes, isPerspective, viewport })
	/** @private @type { object | null } */ #savedState; // beginLineIds 앞의 그리기 상태.
	/** @private @type { Float32Array } */ #instanceData;
	/** @private @type { number } */ #drawnDistanceSum; // 이번 프레임에 그린 모형의 거리 합과 수. (초점 거리를 주지 않았을 때)
	/** @private @type { number } */ #drawnDistanceCount;
	/** @private @type { Array<number> } */ #lineWidths; // 이번 프레임의 바깥 선과 꺾임 선 굵기. (그리는 영역 픽셀)

	//==============================================================================
	// 생성. (다섯 프로그램과 빈 버텍스 어레이를 짓는다, 선의 판은 첫 beginLineIds 에서)
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext - 툰 렌더러와 같은 컨텍스트.
	 */
	constructor(webGL2RenderingContext) {
		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#lineProgram = new ShaderProgram(webGL2RenderingContext, LINE_VERTEX_SHADER, LINE_FRAGMENT_SHADER, TOON_ATTRIBUTE_LOCATIONS);
		this.#seedProgram = new ShaderProgram(webGL2RenderingContext, SCREEN_TRIANGLE_VERTEX_SHADER, SEED_FRAGMENT_SHADER, {});
		this.#seedGatherProgram = new ShaderProgram(webGL2RenderingContext, SCREEN_TRIANGLE_VERTEX_SHADER, SEED_GATHER_FRAGMENT_SHADER, {});
		this.#jumpFloodProgram = new ShaderProgram(webGL2RenderingContext, SCREEN_TRIANGLE_VERTEX_SHADER, JUMP_FLOOD_FRAGMENT_SHADER, {});
		this.#compositeProgram = new ShaderProgram(webGL2RenderingContext, SCREEN_TRIANGLE_VERTEX_SHADER, COMPOSITE_FRAGMENT_SHADER, {});
		this.#emptyVertexArray = webGL2RenderingContext.createVertexArray();
		this.#lineTarget = null;
		this.#color = [0.08, 0.07, 0.1, 1];
		this.#width = 2;
		this.#widthUnit = ToonOutlineWidthUnit.pixel;
		this.#focusDistance = 0;
		this.#depthThreshold = 0.05;
		this.#creaseCosine = System.Math.cos(System.Math.PI / 3);
		this.#creaseWidth = 1;
		this.#creaseOpacity = 1;
		this.#resolutionScale = 1;
		this.#isHdrOutput = false;
		this.#frame = null;
		this.#savedState = null;
		this.#instanceData = new System.Float32Array(TOON_INSTANCE_FLOAT_COUNT * 64);
		this.#drawnDistanceSum = 0;
		this.#drawnDistanceCount = 0;
		this.#lineWidths = [2, 1];
	}

	//==============================================================================
	// 셰이더 소스 반환. (ShaderWarmer 로 미리 링크할 때)
	//==============================================================================
	/**
	 * @static
	 * @returns { Array<object> } { vertexShader, fragmentShader, attributeLocationTable } 다섯. (번호, 씨앗, 모으기, 넓히기, 섞기)
	 * @example <caption>셰이더를 미리 링크할 목록에 넣기</caption>
	 * import { ToonScreenOutline } from "./vanilla.js";
	 * const sources = ToonScreenOutline.readProgramSources();
	 * const vertexShaders = sources.map((source) => source.vertexShader);
	 */
	static readProgramSources() {
		return [
			{ vertexShader: LINE_VERTEX_SHADER, fragmentShader: LINE_FRAGMENT_SHADER, attributeLocationTable: TOON_ATTRIBUTE_LOCATIONS },
			{ vertexShader: SCREEN_TRIANGLE_VERTEX_SHADER, fragmentShader: SEED_FRAGMENT_SHADER, attributeLocationTable: {} },
			{ vertexShader: SCREEN_TRIANGLE_VERTEX_SHADER, fragmentShader: SEED_GATHER_FRAGMENT_SHADER, attributeLocationTable: {} },
			{ vertexShader: SCREEN_TRIANGLE_VERTEX_SHADER, fragmentShader: JUMP_FLOOD_FRAGMENT_SHADER, attributeLocationTable: {} },
			{ vertexShader: SCREEN_TRIANGLE_VERTEX_SHADER, fragmentShader: COMPOSITE_FRAGMENT_SHADER, attributeLocationTable: {} },
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
	// 깊이 문턱 설정. (같은 번호의 이웃 화소가 서로의 접평면에서 이만큼 넘게 떨어지면 가려진 실루엣으로 긋는다, 월드 길이)
	// - 그 깊이의 화소 크기 두 배를 더해 쓴다. 장면의 크기에 맞춘다. (사람 크기 장면이면 0.02 ~ 0.1)
	//==============================================================================
	/**
	 * @param { number } depthThreshold - 접평면 거리 문턱. (월드 길이)
	 */
	setDepthThreshold(depthThreshold) {
		this.#depthThreshold = System.Math.max(0, depthThreshold);
	}

	//==============================================================================
	// 넓히기 판의 해상도 몫 설정. (그리는 영역에 대한 몫 0.25 ~ 1, 폰의 가벼운 길은 낮춘다)
	// - 선의 판과 씨앗은 늘 그리는 영역 해상도로 잡는다. 점프 플러딩만 줄인 판에서 하고, 씨앗 자리는 그리는 영역 화소 좌표 그대로 넣어 거리로 섞는다.
	//   그래서 줄여도 선 자리는 그리는 영역의 화소 경계이고 계단과 점선이 없다. 줄이면 넓히기의 값(걸음 수 x 화소 수)이 몫의 제곱으로 준다.
	//==============================================================================
	/**
	 * @param { number } resolutionScale - 0.25 ~ 1.
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
	 * @returns { object | null } { lineTexture (노멀과 번호 RGBA8), depthTexture (깊이 24), seedTexture (온 해상도 씨앗 RGBA16UI), jumpFloodTextures (넓히기 판 RGBA16UI 둘), jumpFloodIndex (넓히기를 마친 쪽), width, height, jumpFloodWidth, jumpFloodHeight }
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
		const lineTarget = this.readLineTarget(width, height, System.Math.max(1, System.Math.ceil(width * this.#resolutionScale)), System.Math.max(1, System.Math.ceil(height * this.#resolutionScale)));
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
		return true;
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
	 * import { ToonRenderer, ToonScreenOutline, ToonMesh, Matrix4, Vector3 } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const renderer = new ToonRenderer(webGL2RenderingContext);
	 * const outline = new ToonScreenOutline(webGL2RenderingContext);
	 * const floorBuilder = new ToonMesh.MeshBuilder();
	 * floorBuilder.addPart(ToonMesh.createBoxGeometry(6, 0.2, 6), Matrix4.createTranslation(0, -0.1, 0), "#506070", { hasOutline: false });
	 * const floorMesh = renderer.createMesh(floorBuilder.readArrays());
	 * const crystalBuilder = new ToonMesh.MeshBuilder();
	 * crystalBuilder.addPart(ToonMesh.createOctahedronGeometry(0.5), Matrix4.createTranslation(0, 0.5, 0), "#90d0ff", { hasOutline: false });
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
		this.drawWithCount(mesh, modelElements, 0, lineId, false, isMirrored, options);
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
	 * import { ToonRenderer, ToonScreenOutline, ToonMesh, Matrix4, Vector3 } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const renderer = new ToonRenderer(webGL2RenderingContext);
	 * const outline = new ToonScreenOutline(webGL2RenderingContext);
	 * const builder = new ToonMesh.MeshBuilder();
	 * builder.addPart(ToonMesh.createOctahedronGeometry(0.3), Matrix4.createIdentity(), "#a89880", { hasOutline: false });
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
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, instanceData.subarray(0, instanceCount * TOON_INSTANCE_FLOAT_COUNT), webGL2RenderingContext.DYNAMIC_DRAW);
		this.drawWithCount(mesh, IDENTITY_ELEMENTS, instanceCount, lineId, true, options.isMirrored === true, options);
	}

	//==============================================================================
	// 번호 그리기 본체.
	//==============================================================================
	/**
	 * @param { object } mesh - ToonRenderer.createMesh 의 결과.
	 * @param { Float32Array } modelElements - 모형 행렬의 수 16.
	 * @param { number } instanceCount - 0 이면 보통 그리기.
	 * @param { number } lineId - 공통 번호.
	 * @param { boolean } isInstanceLineId - 인스턴스의 번호를 읽을지.
	 * @param { boolean } isMirrored - 감기를 뒤집어 그릴지.
	 * @param { object } options - drawMesh 의 꼴.
	 */
	drawWithCount(mesh, modelElements, instanceCount, lineId, isInstanceLineId, isMirrored, options) {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const lineProgram = this.#lineProgram;
		const jointMatrices = options.jointMatrices !== undefined ? options.jointMatrices : null;
		const isSkinned = mesh.isSkinned && jointMatrices !== null;
		const lineFlags = (options.hasCreaseLine !== false ? 1 : 0) + (options.hasScreenOutline !== false ? 2 : 0);
		webGL2RenderingContext.uniformMatrix4fv(lineProgram.getUniformLocation("modelMatrix"), false, modelElements);
		webGL2RenderingContext.uniform1f(lineProgram.getUniformLocation("instanced"), instanceCount > 0 ? 1 : 0);
		webGL2RenderingContext.uniform1f(lineProgram.getUniformLocation("instanceLineIds"), isInstanceLineId ? 1 : 0);
		webGL2RenderingContext.uniform1f(lineProgram.getUniformLocation("skinned"), isSkinned ? 1 : 0);
		webGL2RenderingContext.uniform1f(lineProgram.getUniformLocation("lineId"), System.Math.max(0, System.Math.min(TOON_SCREEN_OUTLINE_MAXIMUM_LINE_ID, lineId)));
		webGL2RenderingContext.uniform1f(lineProgram.getUniformLocation("lineFlags"), lineFlags);
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
		webGL2RenderingContext.bindVertexArray(mesh.bodyVertexArray);
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
	// 번호 그리기 끝. (씨앗을 고르고 점프 플러딩으로 넓힌 뒤, 프레임버퍼와 뷰포트와 상태를 돌린다)
	//==============================================================================
	endLineIds() {
		if (this.#savedState === null) {
			return;
		}
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const lineTarget = this.#lineTarget;
		const frame = this.#frame;
		const lineWidths = this.readLineWidths();
		this.#lineWidths = lineWidths;
		webGL2RenderingContext.bindVertexArray(this.#emptyVertexArray);
		webGL2RenderingContext.viewport(0, 0, lineTarget.width, lineTarget.height);
		webGL2RenderingContext.disable(webGL2RenderingContext.DEPTH_TEST);
		webGL2RenderingContext.depthMask(false);
		webGL2RenderingContext.disable(webGL2RenderingContext.CULL_FACE);
		webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);

		// 1. 씨앗 고르기.
		const seedProgram = this.#seedProgram;
		const projectionElements = frame.projectionElements;
		const viewElements = frame.viewElements;
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, lineTarget.seedFramebuffer);
		seedProgram.useProgram();
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + LINE_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, lineTarget.lineTexture);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + DEPTH_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, lineTarget.depthTexture);
		webGL2RenderingContext.uniform1i(seedProgram.getUniformLocation("lineTexture"), LINE_TEXTURE_UNIT);
		webGL2RenderingContext.uniform1i(seedProgram.getUniformLocation("depthTexture"), DEPTH_TEXTURE_UNIT);
		webGL2RenderingContext.uniformMatrix3fv(seedProgram.getUniformLocation("viewRotation"), false, [viewElements[0], viewElements[1], viewElements[2], viewElements[4], viewElements[5], viewElements[6], viewElements[8], viewElements[9], viewElements[10]]);
		webGL2RenderingContext.uniform4f(seedProgram.getUniformLocation("projectionScale"), projectionElements[0], projectionElements[5], projectionElements[8], projectionElements[9]);
		webGL2RenderingContext.uniform4f(seedProgram.getUniformLocation("projectionDepth"), projectionElements[10], projectionElements[14], projectionElements[12], projectionElements[13]);
		webGL2RenderingContext.uniform1f(seedProgram.getUniformLocation("isPerspective"), frame.isPerspective ? 1 : 0);
		webGL2RenderingContext.uniform1f(seedProgram.getUniformLocation("depthThreshold"), this.#depthThreshold);
		webGL2RenderingContext.uniform1f(seedProgram.getUniformLocation("creaseCosine"), lineWidths[1] > 0 ? this.#creaseCosine : -2);
		webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLES, 0, 3);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + DEPTH_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, null);

		// 2. 넓히기 판으로 모으기. (줄인 판이면 칸마다 가장 가까운 씨앗)
		const pointScaleX = lineTarget.width / lineTarget.jumpFloodWidth;
		const pointScaleY = lineTarget.height / lineTarget.jumpFloodHeight;
		const seedGatherProgram = this.#seedGatherProgram;
		webGL2RenderingContext.viewport(0, 0, lineTarget.jumpFloodWidth, lineTarget.jumpFloodHeight);
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, lineTarget.jumpFloodFramebuffers[0]);
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
		const reach = (System.Math.max(lineWidths[0], lineWidths[1]) * 0.5 + 0.5) / System.Math.min(pointScaleX, pointScaleY) + 1.5;
		let seedIndex = 0;
		for (const stepSize of readJumpFloodSteps(reach)) {
			webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, lineTarget.jumpFloodFramebuffers[1 - seedIndex]);
			webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + LINE_TEXTURE_UNIT);
			webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, lineTarget.jumpFloodTextures[seedIndex]);
			webGL2RenderingContext.uniform1i(jumpFloodProgram.getUniformLocation("stepSize"), stepSize);
			webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLES, 0, 3);
			seedIndex = 1 - seedIndex;
		}
		lineTarget.jumpFloodIndex = seedIndex;
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + LINE_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, null);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		webGL2RenderingContext.bindVertexArray(null);
		this.restoreState();
	}

	//==============================================================================
	// 바깥선 긋기. (넓힌 씨앗 판으로 beginLineIds 때의 그리는 영역에 섞는다, 깊이는 보지도 쓰지도 않는다, 스텐실은 그대로)
	//==============================================================================
	drawOutline() {
		const lineTarget = this.#lineTarget;
		const frame = this.#frame;
		if (lineTarget === null || frame === null) {
			return;
		}
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		this.saveState();
		const viewport = frame.viewport;
		webGL2RenderingContext.viewport(viewport[0], viewport[1], viewport[2], viewport[3]);
		webGL2RenderingContext.disable(webGL2RenderingContext.DEPTH_TEST);
		webGL2RenderingContext.depthMask(false);
		webGL2RenderingContext.disable(webGL2RenderingContext.CULL_FACE);
		webGL2RenderingContext.enable(webGL2RenderingContext.BLEND);
		webGL2RenderingContext.blendFunc(webGL2RenderingContext.ONE, webGL2RenderingContext.ONE_MINUS_SRC_ALPHA);
		const compositeProgram = this.#compositeProgram;
		compositeProgram.useProgram();
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + LINE_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, lineTarget.jumpFloodTextures[lineTarget.jumpFloodIndex]);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		const color = this.#color;
		const lineWidths = this.#lineWidths;
		webGL2RenderingContext.uniform1i(compositeProgram.getUniformLocation("seedTexture"), LINE_TEXTURE_UNIT);
		webGL2RenderingContext.uniform4f(compositeProgram.getUniformLocation("viewportRect"), viewport[0], viewport[1], System.Math.max(1, viewport[2]), System.Math.max(1, viewport[3]));
		webGL2RenderingContext.uniform2f(compositeProgram.getUniformLocation("pointScale"), lineTarget.width / lineTarget.jumpFloodWidth, lineTarget.height / lineTarget.jumpFloodHeight);
		webGL2RenderingContext.uniform2f(compositeProgram.getUniformLocation("lineWidths"), lineWidths[0], lineWidths[1]);
		webGL2RenderingContext.uniform1f(compositeProgram.getUniformLocation("creaseOpacity"), this.#creaseOpacity);
		webGL2RenderingContext.uniform4f(compositeProgram.getUniformLocation("outlineColor"), color[0], color[1], color[2], color[3]);
		webGL2RenderingContext.uniform1f(compositeProgram.getUniformLocation("hdrOutput"), this.#isHdrOutput ? 1 : 0);
		webGL2RenderingContext.bindVertexArray(this.#emptyVertexArray);
		webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLES, 0, 3);
		webGL2RenderingContext.bindVertexArray(null);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + LINE_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, null);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		this.restoreState();
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
		const scaleX = System.Math.hypot(modelElements[0], modelElements[1], modelElements[2]);
		const scaleY = System.Math.hypot(modelElements[4], modelElements[5], modelElements[6]);
		const scaleZ = System.Math.hypot(modelElements[8], modelElements[9], modelElements[10]);
		const radius = mesh.boundingRadius * System.Math.max(scaleX, scaleY, scaleZ);
		for (const plane of this.#frame.frustumPlanes) {
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
		const createTexture = (internalFormat, format, type, textureWidth, textureHeight) => {
			const texture = webGL2RenderingContext.createTexture();
			webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, texture);
			webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, internalFormat, textureWidth, textureHeight, 0, format, type, null);
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, webGL2RenderingContext.NEAREST);
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, webGL2RenderingContext.NEAREST);
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);
			return texture;
		};
		const createFramebuffer = (colorTexture, depthTexture) => {
			const framebuffer = webGL2RenderingContext.createFramebuffer();
			webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, framebuffer);
			webGL2RenderingContext.framebufferTexture2D(webGL2RenderingContext.FRAMEBUFFER, webGL2RenderingContext.COLOR_ATTACHMENT0, webGL2RenderingContext.TEXTURE_2D, colorTexture, 0);
			if (depthTexture !== null) {
				webGL2RenderingContext.framebufferTexture2D(webGL2RenderingContext.FRAMEBUFFER, webGL2RenderingContext.DEPTH_ATTACHMENT, webGL2RenderingContext.TEXTURE_2D, depthTexture, 0);
			}
			return framebuffer;
		};
		const lineTexture = createTexture(webGL2RenderingContext.RGBA8, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, width, height);
		const depthTexture = createTexture(webGL2RenderingContext.DEPTH_COMPONENT24, webGL2RenderingContext.DEPTH_COMPONENT, webGL2RenderingContext.UNSIGNED_INT, width, height);
		const seedTexture = createTexture(webGL2RenderingContext.RGBA16UI, webGL2RenderingContext.RGBA_INTEGER, webGL2RenderingContext.UNSIGNED_SHORT, width, height);
		const jumpFloodTextures = [
			createTexture(webGL2RenderingContext.RGBA16UI, webGL2RenderingContext.RGBA_INTEGER, webGL2RenderingContext.UNSIGNED_SHORT, jumpFloodWidth, jumpFloodHeight),
			createTexture(webGL2RenderingContext.RGBA16UI, webGL2RenderingContext.RGBA_INTEGER, webGL2RenderingContext.UNSIGNED_SHORT, jumpFloodWidth, jumpFloodHeight),
		];
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, previousTexture);
		const isFramebufferComplete = () => {
			return webGL2RenderingContext.checkFramebufferStatus(webGL2RenderingContext.FRAMEBUFFER) === webGL2RenderingContext.FRAMEBUFFER_COMPLETE;
		};
		const framebuffer = createFramebuffer(lineTexture, depthTexture);
		let isComplete = isFramebufferComplete();
		const seedFramebuffer = createFramebuffer(seedTexture, null);
		isComplete = isComplete && isFramebufferComplete();
		const jumpFloodFramebuffers = [];
		for (const jumpFloodTexture of jumpFloodTextures) {
			jumpFloodFramebuffers.push(createFramebuffer(jumpFloodTexture, null));
			isComplete = isComplete && isFramebufferComplete();
		}
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, previousFramebuffer);
		this.#lineTarget = { framebuffer: framebuffer, lineTexture: lineTexture, depthTexture: depthTexture, seedFramebuffer: seedFramebuffer, seedTexture: seedTexture, jumpFloodFramebuffers: jumpFloodFramebuffers, jumpFloodTextures: jumpFloodTextures, jumpFloodIndex: 0, width: width, height: height, jumpFloodWidth: jumpFloodWidth, jumpFloodHeight: jumpFloodHeight };
		if (!isComplete) {
			this.deleteLineTarget();
			return null;
		}
		return this.#lineTarget;
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
		webGL2RenderingContext.deleteFramebuffer(lineTarget.framebuffer);
		webGL2RenderingContext.deleteFramebuffer(lineTarget.seedFramebuffer);
		for (const jumpFloodFramebuffer of lineTarget.jumpFloodFramebuffers) {
			webGL2RenderingContext.deleteFramebuffer(jumpFloodFramebuffer);
		}
		webGL2RenderingContext.deleteTexture(lineTarget.lineTexture);
		webGL2RenderingContext.deleteTexture(lineTarget.depthTexture);
		webGL2RenderingContext.deleteTexture(lineTarget.seedTexture);
		for (const jumpFloodTexture of lineTarget.jumpFloodTextures) {
			webGL2RenderingContext.deleteTexture(jumpFloodTexture);
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
	// 다 쓴 뒤 지우기. (선의 판, 버텍스 어레이, 프로그램 다섯)
	//==============================================================================
	destroy() {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		this.deleteLineTarget();
		webGL2RenderingContext.deleteVertexArray(this.#emptyVertexArray);
		webGL2RenderingContext.deleteProgram(this.#lineProgram.getProgram());
		webGL2RenderingContext.deleteProgram(this.#seedProgram.getProgram());
		webGL2RenderingContext.deleteProgram(this.#seedGatherProgram.getProgram());
		webGL2RenderingContext.deleteProgram(this.#jumpFloodProgram.getProgram());
		webGL2RenderingContext.deleteProgram(this.#compositeProgram.getProgram());
	}
}
