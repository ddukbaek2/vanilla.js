//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { ShaderProgram } from "../../../core/graphic/shaderprogram.js";
import { TOON_ATTRIBUTE_LOCATIONS, TOON_MAXIMUM_JOINTS, TOON_INSTANCE_FLOAT_COUNT, extractFrustumPlanes } from "./toonrenderer.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 굵기의 단위.
export const ToonOutlineWidthUnit = System.Object.freeze({
	world: "world", // 월드 길이. (직교는 투영의 세로 배율로, 원근은 초점 거리에서 화면 픽셀로 셈)
	pixel: "pixel", // 그리는 버퍼의 픽셀.
});

// 볼 이웃의 수 상한. (OFFSETS 를 가까운 차례로, 3 픽셀 안)
export const TOON_SCREEN_OUTLINE_MAXIMUM_SAMPLES = 28;

// 꺾임 선을 볼 곧은 쪽의 수 상한.
export const TOON_SCREEN_OUTLINE_MAXIMUM_CREASE_SAMPLES = 4;

// 인스턴스 그리기의 modelMatrix 자리. (단위 행렬)
const IDENTITY_ELEMENTS = new System.Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

// 선의 판과 가면을 묶는 텍스처 유닛. (툰 렌더러의 그림자 유닛 3 과 겹치지 않게)
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
	worldNormal = mat3(objectMatrix) * mat3(skinMatrix) * vertexNormal;
	surfaceLineId = instanced > 0.5 && instanceLineIds > 0.5 ? instanceTint.x : lineId;
	gl_Position = viewProjectionMatrix * objectMatrix * skinMatrix * vec4(vertexPosition, 1.0);
}
`;
// 노멀은 팔면체로 접어 rg, 번호는 낮은 자리 b 와 높은 자리 a. (번호 0 은 빈 곳, 65535 까지)
const LINE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 worldNormal;
flat in float surfaceLineId;
out vec4 fragmentLine;
vec2 wrapOctahedron(vec2 value) {
	return (1.0 - abs(value.yx)) * vec2(value.x >= 0.0 ? 1.0 : -1.0, value.y >= 0.0 ? 1.0 : -1.0);
}
void main() {
	vec3 normal = normalize(worldNormal);
	normal /= abs(normal.x) + abs(normal.y) + abs(normal.z);
	vec2 folded = normal.y >= 0.0 ? normal.xz : wrapOctahedron(normal.xz);
	float lowPart = mod(surfaceLineId, 256.0);
	float highPart = floor(surfaceLineId / 256.0);
	fragmentLine = vec4(folded * 0.5 + 0.5, lowPart / 255.0, highPart / 255.0);
}
`;
// 화면을 덮는 세모 하나.
const SCREEN_TRIANGLE_VERTEX_SHADER = `#version 300 es
const vec2 TRIANGLE_POINTS[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() {
	gl_Position = vec4(TRIANGLE_POINTS[gl_VertexID], 0.0, 1.0);
}
`;
// 선의 판을 같은 크기로 한 번 훑어 선의 진하기를 가면에 쓰는 셰이더.
// - 바깥 선: 가장 가까운 선 낼 이웃(실루엣 앞, 다른 번호와 맞닿은 먼 쪽)까지의 거리로 굵기만큼 덮고 가장자리는 덮인 몫만큼 엷게, 처음 걸리면 그친다.
// - 몸의 맨 바깥 화소에도 반쯤 깐다. (MSAA 로 바탕과 섞인 가장자리가 선과 몸 사이에 비치지 않게)
// - 꺾임 선: 같은 번호 안에서 면이 creaseCosine 보다 더 꺾이면 creaseStrength 씩, creaseExtent 가 0 보다 크면 그만큼 더 간 점도 꺾인 면이어야 센다.
// - 깊이: 원근이면 가까운 면과 먼 면으로 풀어 거리로, 직교면 깊이 차에 depthRange 의 폭을 곱한다.
const LINE_MASK_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform highp sampler2D lineTexture;
uniform highp sampler2D depthTexture;
uniform float outlineRadius;
uniform float creaseRadius;
uniform float creaseStrength;
uniform float creaseCosine;
uniform float creaseExtent;
uniform float depthThreshold;
uniform float contactTolerance;
uniform float isPerspective;
uniform vec2 depthRange;
uniform int sampleCount;
uniform int creaseCount;
uniform vec3 viewDirection;
out vec4 fragmentMask;
const float FACING_MINIMUM = 0.25;
const float INNER_STRENGTH = 0.5;
const vec2 DIRECTIONS[4] = vec2[4](vec2(1.0, 0.0), vec2(-1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, -1.0));
const ivec2 OFFSETS[28] = ivec2[28](ivec2(1, 0), ivec2(-1, 0), ivec2(0, 1), ivec2(0, -1), ivec2(1, 1), ivec2(-1, 1), ivec2(1, -1), ivec2(-1, -1), ivec2(2, 0), ivec2(-2, 0), ivec2(0, 2), ivec2(0, -2), ivec2(2, 1), ivec2(-2, 1), ivec2(2, -1), ivec2(-2, -1), ivec2(1, 2), ivec2(-1, 2), ivec2(1, -2), ivec2(-1, -2), ivec2(2, 2), ivec2(-2, 2), ivec2(2, -2), ivec2(-2, -2), ivec2(3, 0), ivec2(-3, 0), ivec2(0, 3), ivec2(0, -3));
const float OFFSET_DISTANCES[28] = float[28](1.0000, 1.0000, 1.0000, 1.0000, 1.4142, 1.4142, 1.4142, 1.4142, 2.0000, 2.0000, 2.0000, 2.0000, 2.2361, 2.2361, 2.2361, 2.2361, 2.2361, 2.2361, 2.2361, 2.2361, 2.8284, 2.8284, 2.8284, 2.8284, 3.0000, 3.0000, 3.0000, 3.0000);
float readLineId(vec4 value) {
	return floor(value.b * 255.0 + 0.5) + floor(value.a * 255.0 + 0.5) * 256.0;
}
vec3 readNormal(vec4 value) {
	vec2 folded = value.rg * 2.0 - 1.0;
	vec3 normal = vec3(folded.x, 1.0 - abs(folded.x) - abs(folded.y), folded.y);
	float fold = max(-normal.y, 0.0);
	normal.x += normal.x >= 0.0 ? -fold : fold;
	normal.z += normal.z >= 0.0 ? -fold : fold;
	return normalize(normal);
}
float readDistance(ivec2 pixel) {
	float depth = texelFetch(depthTexture, pixel, 0).r;
	if (isPerspective < 0.5) {
		return depth * (depthRange.y - depthRange.x);
	}
	float clipDepth = depth * 2.0 - 1.0;
	return 2.0 * depthRange.x * depthRange.y / (depthRange.y + depthRange.x - clipDepth * (depthRange.y - depthRange.x));
}
bool readOutlineHit(vec4 sampleValue, float sampleDistance, float centerId, float centerDistance, float threshold) {
	float id = readLineId(sampleValue);
	if (id < 0.5) {
		return false;
	}
	if (centerId < 0.5) {
		return true;
	}
	float nearer = centerDistance - sampleDistance;
	if (nearer > threshold) {
		return true;
	}
	return abs(id - centerId) > 0.5 && nearer > -contactTolerance && (nearer > contactTolerance || centerId > id);
}
float readThreshold(vec4 value, float id) {
	float facing = id > 0.5 ? max(abs(dot(readNormal(value), viewDirection)), FACING_MINIMUM) : 1.0;
	return depthThreshold / facing;
}
void main() {
	ivec2 lastPixel = textureSize(depthTexture, 0) - 1;
	ivec2 center = ivec2(gl_FragCoord.xy);
	vec4 centerValue = texelFetch(lineTexture, center, 0);
	float centerId = readLineId(centerValue);
	float centerDistance = readDistance(center);
	vec3 centerNormal = readNormal(centerValue);
	float threshold = readThreshold(centerValue, centerId);
	float reach = outlineRadius + 1.0;
	float outerStrength = 0.0;
	float innerStrength = 0.0;
	for (int index = 0; index < 4; ++index) {
		ivec2 pixel = clamp(center + OFFSETS[index], ivec2(0), lastPixel);
		vec4 value = texelFetch(lineTexture, pixel, 0);
		float sampleDistance = readDistance(pixel);
		if (outerStrength <= 0.0 && readOutlineHit(value, sampleDistance, centerId, centerDistance, threshold)) {
			outerStrength = clamp(reach - OFFSET_DISTANCES[index], 0.0, 1.0);
		}
		float sampleId = readLineId(value);
		if (centerId > 0.5 && readOutlineHit(centerValue, centerDistance, sampleId, sampleDistance, readThreshold(value, sampleId))) {
			innerStrength = INNER_STRENGTH;
		}
	}
	for (int index = 4; index < ${TOON_SCREEN_OUTLINE_MAXIMUM_SAMPLES}; ++index) {
		if (outerStrength > 0.0 || index >= sampleCount || OFFSET_DISTANCES[index] >= reach) {
			break;
		}
		ivec2 pixel = clamp(center + OFFSETS[index], ivec2(0), lastPixel);
		vec4 value = texelFetch(lineTexture, pixel, 0);
		if (readOutlineHit(value, readDistance(pixel), centerId, centerDistance, threshold)) {
			outerStrength = clamp(reach - OFFSET_DISTANCES[index], 0.0, 1.0);
		}
	}
	float creaseHitCount = 0.0;
	if (outerStrength < 1.0 && centerId > 0.5) {
		for (int index = 0; index < ${TOON_SCREEN_OUTLINE_MAXIMUM_CREASE_SAMPLES}; ++index) {
			if (index >= creaseCount) {
				break;
			}
			ivec2 pixel = clamp(center + ivec2(round(DIRECTIONS[index] * creaseRadius)), ivec2(0), lastPixel);
			vec4 value = texelFetch(lineTexture, pixel, 0);
			if (abs(readLineId(value) - centerId) > 0.5) {
				continue;
			}
			float nearer = centerDistance - readDistance(pixel);
			if (abs(nearer) < threshold * 2.0 && dot(readNormal(value), centerNormal) < creaseCosine) {
				if (creaseExtent <= 0.0) {
					creaseHitCount += 1.0;
					continue;
				}
				ivec2 farPixel = clamp(center + ivec2(round(DIRECTIONS[index] * (creaseRadius + creaseExtent))), ivec2(0), lastPixel);
				vec4 farValue = texelFetch(lineTexture, farPixel, 0);
				if (abs(readLineId(farValue) - centerId) < 0.5 && dot(readNormal(farValue), centerNormal) < creaseCosine) {
					creaseHitCount += 1.0;
				}
			}
		}
	}
	fragmentMask = vec4(min(1.0, max(outerStrength, innerStrength) + creaseHitCount * creaseStrength), 0.0, 0.0, 1.0);
}
`;
// 가면을 그리는 영역 크기로 부드럽게 읽어 선인 곳만 섞는 셰이더. (미리 곱한 알파, 선이 아닌 곳은 버림)
const COMPOSITE_FRAGMENT_SHADER = `#version 300 es
precision mediump float;
uniform sampler2D maskTexture;
uniform vec4 viewportRect;
uniform vec4 outlineColor;
uniform float hdrOutput;
out vec4 fragmentColor;
void main() {
	float strength = texture(maskTexture, (gl_FragCoord.xy - viewportRect.xy) / viewportRect.zw).r * outlineColor.a;
	if (strength < 0.02) {
		discard;
	}
	vec3 color = hdrOutput > 0.5 ? pow(outlineColor.rgb, vec3(2.2)) : outlineColor.rgb;
	fragmentColor = vec4(color * strength, strength);
}
`;


//==============================================================================
// 툰 화면 공간 바깥선. (노멀, 선 번호, 깊이를 선의 판에 그리고 한 번 훑어 가면을 쓴 뒤 화면에 섞는다)
// - ToonRenderer 의 createMesh 결과를 같은 행렬로 한 번 더 그려 번호를 쓴다. 껍데기 바깥선(ToonRenderer)과 함께 써도 된다.
// - 선이 서는 곳: 앞에 있는 것의 실루엣 바깥, 다른 번호와 맞닿은 곳(먼 쪽, 깊이가 거의 같으면 번호가 큰 쪽), 한 번호 안에서 면이 꺾임 각보다 더 꺾이는 곳.
//   같은 번호끼리 맞닿은 곳은 긋지 않는다. 어느 모형, 어느 부품(indexStart, indexCount 범위)에 어떤 번호를 줄지는 부르는 쪽이 정한다.
// - 굵기: setWidth 로 월드 길이나 픽셀. 선의 판 픽셀로 셈해 한 픽셀 밑으로 내리지 않는다.
// - 깊이: 투영 행렬로 직교와 원근을 가린다. 원근은 깊이를 가까운 면과 먼 면으로 풀어 거리(미터)로 견준다.
// - 값: setResolutionScale 로 선의 판을 그리는 영역의 몫으로 줄이고(가면은 섞을 때 부드럽게 늘임), setSampleCount 로 볼 이웃 수를 줄인다(가벼운 길 4, 2).
// - 사용: 매 프레임 beginLineIds(보기, 투영) → drawMesh / drawMeshInstanced → endLineIds() (가면까지 셈) → 툰 몸 그리기 → drawOutline().
//   beginLineIds 는 그때의 뷰포트를 그리는 영역으로 적어 두고, 선의 판을 그 크기에 맞춰 짓는다. endLineIds 가 프레임버퍼, 뷰포트, 상태를 돌린다.
//   (엔진 2D 그리기 사이에 끼울 때, 그 전에 Graphic.flushSpriteBatch)
//==============================================================================
export class ToonScreenOutline {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { ShaderProgram } */ #lineProgram;
	/** @private @type { ShaderProgram } */ #maskProgram;
	/** @private @type { ShaderProgram } */ #compositeProgram;
	/** @private @type { WebGLVertexArrayObject } */ #emptyVertexArray; // 화면 세모용 빈 버텍스 어레이.
	/** @private @type { object | null } */ #lineTarget; // 선의 판. ({ framebuffer, lineTexture, depthTexture, maskFramebuffer, maskTexture, width, height })
	/** @private @type { Array<number> } */ #color; // 선 색. (sRGB, 알파)
	/** @private @type { number } */ #width;
	/** @private @type { string } */ #widthUnit;
	/** @private @type { number } */ #focusDistance; // 원근에서 월드 굵기를 픽셀로 셀 거리. (0 이면 그린 모형의 평균 거리)
	/** @private @type { number } */ #depthThreshold; // 실루엣으로 칠 깊이 차이. (월드 길이, 면이 화면을 볼 때)
	/** @private @type { number } */ #contactTolerance; // 맞닿은 두 번호의 깊이가 이만큼 안이면 번호가 큰 쪽에 그음.
	/** @private @type { number } */ #creaseCosine;
	/** @private @type { number } */ #creaseStrength;
	/** @private @type { number } */ #creaseExtent; // 꺾인 면이 이만큼(픽셀) 더 이어져야 꺾임 선을 그음. (0 이면 보지 않음)
	/** @private @type { number } */ #resolutionScale;
	/** @private @type { number } */ #sampleCount;
	/** @private @type { number } */ #creaseSampleCount;
	/** @private @type { boolean } */ #isHdrOutput;
	/** @private @type { object } */ #frame; // 이번 프레임의 카메라. ({ viewProjectionElements, viewElements, frustumPlanes, viewDirection, isPerspective, depthRange, projectionScale, viewport })
	/** @private @type { object | null } */ #savedState; // beginLineIds 앞의 그리기 상태.
	/** @private @type { Float32Array } */ #instanceData;
	/** @private @type { number } */ #drawnDistanceSum; // 이번 프레임에 그린 모형의 거리 합과 수. (초점 거리를 주지 않았을 때)
	/** @private @type { number } */ #drawnDistanceCount;
	/** @private @type { number } */ #outlineRadius; // 이번 프레임의 바깥선 반지름. (선의 판 픽셀)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext
	 */
	constructor(webGL2RenderingContext) {
		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#lineProgram = new ShaderProgram(webGL2RenderingContext, LINE_VERTEX_SHADER, LINE_FRAGMENT_SHADER, TOON_ATTRIBUTE_LOCATIONS);
		this.#maskProgram = new ShaderProgram(webGL2RenderingContext, SCREEN_TRIANGLE_VERTEX_SHADER, LINE_MASK_FRAGMENT_SHADER, {});
		this.#compositeProgram = new ShaderProgram(webGL2RenderingContext, SCREEN_TRIANGLE_VERTEX_SHADER, COMPOSITE_FRAGMENT_SHADER, {});
		this.#emptyVertexArray = webGL2RenderingContext.createVertexArray();
		this.#lineTarget = null;
		this.#color = [0.08, 0.07, 0.1, 1];
		this.#width = 1.5;
		this.#widthUnit = ToonOutlineWidthUnit.pixel;
		this.#focusDistance = 0;
		this.#depthThreshold = 0.05;
		this.#contactTolerance = 0.01;
		this.#creaseCosine = System.Math.cos(System.Math.PI / 3);
		this.#creaseStrength = 0.5;
		this.#creaseExtent = 2;
		this.#resolutionScale = 1;
		this.#sampleCount = TOON_SCREEN_OUTLINE_MAXIMUM_SAMPLES;
		this.#creaseSampleCount = TOON_SCREEN_OUTLINE_MAXIMUM_CREASE_SAMPLES;
		this.#isHdrOutput = false;
		this.#frame = null;
		this.#savedState = null;
		this.#instanceData = new System.Float32Array(TOON_INSTANCE_FLOAT_COUNT * 64);
		this.#drawnDistanceSum = 0;
		this.#drawnDistanceCount = 0;
		this.#outlineRadius = 1;
	}

	//==============================================================================
	// 셰이더 소스 반환. (ShaderWarmer 로 미리 링크할 때)
	//==============================================================================
	/**
	 * @static
	 * @returns { Array<object> } { vertexShader, fragmentShader, attributeLocationTable } 의 배열.
	 */
	static readProgramSources() {
		return [
			{ vertexShader: LINE_VERTEX_SHADER, fragmentShader: LINE_FRAGMENT_SHADER, attributeLocationTable: TOON_ATTRIBUTE_LOCATIONS },
			{ vertexShader: SCREEN_TRIANGLE_VERTEX_SHADER, fragmentShader: LINE_MASK_FRAGMENT_SHADER, attributeLocationTable: {} },
			{ vertexShader: SCREEN_TRIANGLE_VERTEX_SHADER, fragmentShader: COMPOSITE_FRAGMENT_SHADER, attributeLocationTable: {} },
		];
	}

	//==============================================================================
	// 선 색 설정. (sRGB 0 ~ 1 과 알파)
	//==============================================================================
	/**
	 * @param { Array<number> } color - [r, g, b, a]
	 */
	setColor(color) {
		this.#color = [color[0], color[1], color[2], color.length > 3 ? color[3] : 1];
	}

	//==============================================================================
	// 굵기 설정. (월드 길이나 픽셀, 반지름이 아니라 선 하나의 굵기)
	//==============================================================================
	/**
	 * @param { number } width
	 * @param { string } [unit] - ToonOutlineWidthUnit
	 */
	setWidth(width, unit = ToonOutlineWidthUnit.pixel) {
		this.#width = System.Math.max(0, width);
		this.#widthUnit = unit;
	}

	//==============================================================================
	// 초점 거리 설정. (원근 카메라에서 월드 굵기를 픽셀로 셀 거리, 보통 카메라에서 보는 점까지, 0 이면 그린 모형들의 평균 거리)
	//==============================================================================
	/**
	 * @param { number } focusDistance
	 */
	setFocusDistance(focusDistance) {
		this.#focusDistance = System.Math.max(0, focusDistance);
	}

	//==============================================================================
	// 깊이 문턱 설정. (실루엣으로 칠 깊이 차이와 맞닿음으로 칠 깊이 차이, 월드 길이, 장면의 크기에 맞춘다)
	//==============================================================================
	/**
	 * @param { number } depthThreshold - 면이 화면을 볼 때의 실루엣 깊이 차이. (비스듬하면 화면을 보는 정도로 나눔)
	 * @param { number } contactTolerance - 다른 번호와 맞닿은 두 면의 깊이가 이만큼 안이면 번호가 큰 쪽에만 긋는다.
	 */
	setDepthThreshold(depthThreshold, contactTolerance) {
		this.#depthThreshold = System.Math.max(0, depthThreshold);
		this.#contactTolerance = System.Math.max(0, contactTolerance);
	}

	//==============================================================================
	// 꺾임 선 설정. (면이 이 각(도)보다 더 꺾이면 선, 걸린 곳 하나의 진하기, 꺾인 면이 더 이어져야 할 픽셀)
	//==============================================================================
	/**
	 * @param { number } angleDegrees - 180 이면 꺾임 선을 긋지 않는다.
	 * @param { number } [strength]
	 * @param { number } [extentPixels] - 0 이면 좁은 면도 긋는다.
	 */
	setCrease(angleDegrees, strength = 0.5, extentPixels = 2) {
		this.#creaseCosine = System.Math.cos(System.Math.min(180, System.Math.max(0, angleDegrees)) * System.Math.PI / 180);
		this.#creaseStrength = System.Math.max(0, strength);
		this.#creaseExtent = System.Math.max(0, extentPixels);
	}

	//==============================================================================
	// 선의 판 해상도 몫 설정. (그리는 영역에 대한 몫 0.25 ~ 1, 폰의 가벼운 길은 낮춰 셈하고 섞을 때 늘인다)
	//==============================================================================
	/**
	 * @param { number } resolutionScale
	 */
	setResolutionScale(resolutionScale) {
		this.#resolutionScale = System.Math.max(0.25, System.Math.min(1, resolutionScale));
	}

	//==============================================================================
	// 볼 이웃 수 설정. (바깥선 4 ~ 28, 꺾임 선 0 ~ 4, 가벼운 길은 4 와 2)
	//==============================================================================
	/**
	 * @param { number } sampleCount
	 * @param { number } creaseSampleCount
	 */
	setSampleCount(sampleCount, creaseSampleCount) {
		this.#sampleCount = System.Math.max(4, System.Math.min(TOON_SCREEN_OUTLINE_MAXIMUM_SAMPLES, System.Math.floor(sampleCount)));
		this.#creaseSampleCount = System.Math.max(0, System.Math.min(TOON_SCREEN_OUTLINE_MAXIMUM_CREASE_SAMPLES, System.Math.floor(creaseSampleCount)));
	}

	//==============================================================================
	// HDR 출력 설정. (true 면 선 색을 선형으로 바꿔 섞는다, ToonRenderer.setHdrOutput 과 맞춘다)
	//==============================================================================
	/**
	 * @param { boolean } isHdrOutput
	 */
	setHdrOutput(isHdrOutput) {
		this.#isHdrOutput = isHdrOutput;
	}

	//==============================================================================
	// 이번 프레임의 바깥선 반지름 반환. (선의 판 픽셀, endLineIds 뒤에 정해짐)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getOutlineRadius() {
		return this.#outlineRadius;
	}

	//==============================================================================
	// 선의 판 반환. (없으면 null, { lineTexture, depthTexture, maskTexture, width, height })
	//==============================================================================
	/**
	 * @returns { object | null }
	 */
	getLineTarget() {
		return this.#lineTarget;
	}

	//==============================================================================
	// 번호 그리기 시작. (지금 뷰포트를 그리는 영역으로 적고, 선의 판을 묶어 비운다)
	//==============================================================================
	/**
	 * @param { Matrix4 } viewMatrix
	 * @param { Matrix4 } projectionMatrix
	 * @returns { boolean } 선의 판을 짓지 못했으면 false. (그때 drawMesh 는 아무것도 하지 않는다)
	 */
	beginLineIds(viewMatrix, projectionMatrix) {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const viewElements = viewMatrix.getElements();
		const projectionElements = projectionMatrix.getElements();
		const viewport = webGL2RenderingContext.getParameter(webGL2RenderingContext.VIEWPORT);
		const viewProjectionMatrix = projectionMatrix.clone();
		viewProjectionMatrix.multiply(viewMatrix);
		const isPerspective = System.Math.abs(projectionElements[11]) > 0.5;
		let depthRange = [0, 1];
		if (isPerspective) {
			depthRange = [projectionElements[14] / (projectionElements[10] - 1), projectionElements[14] / (projectionElements[10] + 1)];
		}
		else {
			const depthSpan = -2 / projectionElements[10];
			const depthCenter = projectionElements[14] / projectionElements[10];
			depthRange = [depthCenter - depthSpan * 0.5, depthCenter + depthSpan * 0.5];
		}
		const viewDirection = [-viewElements[2], -viewElements[6], -viewElements[10]];
		const viewDirectionLength = System.Math.max(0.000001, System.Math.hypot(viewDirection[0], viewDirection[1], viewDirection[2]));
		this.#frame = {
			viewProjectionElements: new System.Float32Array(viewProjectionMatrix.getElements()),
			viewElements: new System.Float32Array(viewElements),
			frustumPlanes: extractFrustumPlanes(viewProjectionMatrix),
			viewDirection: [viewDirection[0] / viewDirectionLength, viewDirection[1] / viewDirectionLength, viewDirection[2] / viewDirectionLength],
			isPerspective: isPerspective,
			depthRange: depthRange,
			projectionScale: System.Math.abs(projectionElements[5]),
			viewport: [viewport[0], viewport[1], viewport[2], viewport[3]],
		};
		this.#drawnDistanceSum = 0;
		this.#drawnDistanceCount = 0;
		const lineTarget = this.readLineTarget(System.Math.max(1, System.Math.ceil(viewport[2] * this.#resolutionScale)), System.Math.max(1, System.Math.ceil(viewport[3] * this.#resolutionScale)));
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
		lineProgram.use();
		webGL2RenderingContext.uniformMatrix4fv(lineProgram.getUniformLocation("viewProjectionMatrix"), false, this.#frame.viewProjectionElements);
		return true;
	}

	//==============================================================================
	// 모형 하나의 번호 그리기. (ToonRenderer.drawMesh 와 같은 행렬과 자세, 화면 밖이면 건너뛴다)
	//==============================================================================
	/**
	 * @param { object | null } mesh - ToonRenderer.createMesh 의 결과.
	 * @param { Matrix4 } modelMatrix
	 * @param { number } lineId - 1 ~ 65535. (0 은 빈 곳이라 쓰지 않는다)
	 * @param { object } [options] - { jointMatrices Float32Array, isCulled (기본 true), indexStart, indexCount (몸 번호 버퍼의 일부만, 부품에 다른 번호를 줄 때) }
	 */
	drawMesh(mesh, modelMatrix, lineId, options = {}) {
		if (mesh === null || this.#savedState === null) {
			return;
		}
		const modelElements = modelMatrix.getElements();
		if (options.isCulled !== false && !this.isVisible(mesh, modelElements)) {
			return;
		}
		this.addDrawnDistance(mesh, modelElements);
		this.drawWithCount(mesh, modelElements, 0, lineId, false, options);
	}

	//==============================================================================
	// 같은 모형 여럿의 번호를 한 번에 그리기. (인스턴스에 lineId 가 있으면 그 번호, 없으면 공통 번호)
	//==============================================================================
	/**
	 * @param { object | null } mesh
	 * @param { Array<object> } instances - { modelMatrix: Matrix4, lineId: number (선택) } 의 배열.
	 * @param { number } lineId - 공통 번호.
	 * @param { object } [options] - drawMesh 와 같다.
	 */
	drawMeshInstanced(mesh, instances, lineId, options = {}) {
		if (mesh === null || this.#savedState === null) {
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
		this.drawWithCount(mesh, IDENTITY_ELEMENTS, instanceCount, lineId, true, options);
	}

	//==============================================================================
	// 번호 그리기 본체.
	//==============================================================================
	/**
	 * @param { object } mesh
	 * @param { Float32Array } modelElements
	 * @param { number } instanceCount - 0 이면 보통 그리기.
	 * @param { number } lineId
	 * @param { boolean } isInstanceLineId - 인스턴스의 번호를 읽을지.
	 * @param { object } options
	 */
	drawWithCount(mesh, modelElements, instanceCount, lineId, isInstanceLineId, options) {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const lineProgram = this.#lineProgram;
		const jointMatrices = options.jointMatrices !== undefined ? options.jointMatrices : null;
		const isSkinned = mesh.isSkinned && jointMatrices !== null;
		webGL2RenderingContext.uniformMatrix4fv(lineProgram.getUniformLocation("modelMatrix"), false, modelElements);
		webGL2RenderingContext.uniform1f(lineProgram.getUniformLocation("instanced"), instanceCount > 0 ? 1 : 0);
		webGL2RenderingContext.uniform1f(lineProgram.getUniformLocation("instanceLineIds"), isInstanceLineId ? 1 : 0);
		webGL2RenderingContext.uniform1f(lineProgram.getUniformLocation("skinned"), isSkinned ? 1 : 0);
		webGL2RenderingContext.uniform1f(lineProgram.getUniformLocation("lineId"), lineId);
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
		webGL2RenderingContext.bindVertexArray(mesh.bodyVertexArray);
		if (instanceCount > 0) {
			webGL2RenderingContext.drawElementsInstanced(webGL2RenderingContext.TRIANGLES, indexCount, webGL2RenderingContext.UNSIGNED_INT, indexStart * 4, instanceCount);
		}
		else {
			webGL2RenderingContext.drawElements(webGL2RenderingContext.TRIANGLES, indexCount, webGL2RenderingContext.UNSIGNED_INT, indexStart * 4);
		}
	}

	//==============================================================================
	// 번호 그리기 끝. (선 찾기로 가면을 쓰고, 프레임버퍼와 뷰포트와 상태를 돌린다)
	//==============================================================================
	endLineIds() {
		if (this.#savedState === null) {
			return;
		}
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const lineTarget = this.#lineTarget;
		const frame = this.#frame;
		webGL2RenderingContext.bindVertexArray(null);
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, lineTarget.maskFramebuffer);
		webGL2RenderingContext.viewport(0, 0, lineTarget.width, lineTarget.height);
		webGL2RenderingContext.disable(webGL2RenderingContext.DEPTH_TEST);
		webGL2RenderingContext.depthMask(false);
		webGL2RenderingContext.disable(webGL2RenderingContext.CULL_FACE);
		webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);
		const maskProgram = this.#maskProgram;
		maskProgram.use();
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + LINE_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, lineTarget.lineTexture);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + DEPTH_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, lineTarget.depthTexture);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		const outlineRadius = this.readOutlineRadius();
		this.#outlineRadius = outlineRadius;
		const viewDirection = frame.viewDirection;
		webGL2RenderingContext.uniform1i(maskProgram.getUniformLocation("lineTexture"), LINE_TEXTURE_UNIT);
		webGL2RenderingContext.uniform1i(maskProgram.getUniformLocation("depthTexture"), DEPTH_TEXTURE_UNIT);
		webGL2RenderingContext.uniform1f(maskProgram.getUniformLocation("outlineRadius"), outlineRadius);
		webGL2RenderingContext.uniform1f(maskProgram.getUniformLocation("creaseRadius"), System.Math.max(1, outlineRadius * 0.5));
		webGL2RenderingContext.uniform1f(maskProgram.getUniformLocation("creaseStrength"), this.#creaseStrength);
		webGL2RenderingContext.uniform1f(maskProgram.getUniformLocation("creaseCosine"), this.#creaseCosine);
		webGL2RenderingContext.uniform1f(maskProgram.getUniformLocation("creaseExtent"), this.#creaseExtent);
		webGL2RenderingContext.uniform1f(maskProgram.getUniformLocation("depthThreshold"), this.#depthThreshold);
		webGL2RenderingContext.uniform1f(maskProgram.getUniformLocation("contactTolerance"), this.#contactTolerance);
		webGL2RenderingContext.uniform1f(maskProgram.getUniformLocation("isPerspective"), frame.isPerspective ? 1 : 0);
		webGL2RenderingContext.uniform2f(maskProgram.getUniformLocation("depthRange"), frame.depthRange[0], frame.depthRange[1]);
		webGL2RenderingContext.uniform1i(maskProgram.getUniformLocation("sampleCount"), this.#sampleCount);
		webGL2RenderingContext.uniform1i(maskProgram.getUniformLocation("creaseCount"), this.#creaseSampleCount);
		webGL2RenderingContext.uniform3f(maskProgram.getUniformLocation("viewDirection"), viewDirection[0], viewDirection[1], viewDirection[2]);
		webGL2RenderingContext.bindVertexArray(this.#emptyVertexArray);
		webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLES, 0, 3);
		webGL2RenderingContext.bindVertexArray(null);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + LINE_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, null);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + DEPTH_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, null);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		this.restoreState();
	}

	//==============================================================================
	// 바깥선 긋기. (가면을 beginLineIds 때의 그리는 영역에 섞는다, 깊이는 보지도 쓰지도 않는다, 스텐실은 그대로)
	//==============================================================================
	drawOutline() {
		const lineTarget = this.#lineTarget;
		const frame = this.#frame;
		if (lineTarget === null || frame === null) {
			return;
		}
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		this.saveState();
		webGL2RenderingContext.disable(webGL2RenderingContext.DEPTH_TEST);
		webGL2RenderingContext.depthMask(false);
		webGL2RenderingContext.disable(webGL2RenderingContext.CULL_FACE);
		webGL2RenderingContext.enable(webGL2RenderingContext.BLEND);
		webGL2RenderingContext.blendFunc(webGL2RenderingContext.ONE, webGL2RenderingContext.ONE_MINUS_SRC_ALPHA);
		const compositeProgram = this.#compositeProgram;
		compositeProgram.use();
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + LINE_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, lineTarget.maskTexture);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		const viewport = frame.viewport;
		const color = this.#color;
		webGL2RenderingContext.uniform1i(compositeProgram.getUniformLocation("maskTexture"), LINE_TEXTURE_UNIT);
		webGL2RenderingContext.uniform4f(compositeProgram.getUniformLocation("viewportRect"), viewport[0], viewport[1], System.Math.max(1, viewport[2]), System.Math.max(1, viewport[3]));
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
	// 바깥선 반지름 셈. (선의 판 픽셀, 한 픽셀 밑으로 내리지 않음)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	readOutlineRadius() {
		const frame = this.#frame;
		const lineTarget = this.#lineTarget;
		const scale = lineTarget.height / System.Math.max(1, frame.viewport[3]);
		if (this.#widthUnit === ToonOutlineWidthUnit.pixel) {
			return System.Math.max(1, this.#width * scale);
		}
		let pixelsPerUnit = frame.viewport[3] * 0.5 * frame.projectionScale;
		if (frame.isPerspective) {
			const averageDistance = this.#drawnDistanceCount > 0 ? this.#drawnDistanceSum / this.#drawnDistanceCount : 1;
			const focusDistance = this.#focusDistance > 0 ? this.#focusDistance : averageDistance;
			pixelsPerUnit /= System.Math.max(0.001, focusDistance);
		}
		return System.Math.max(1, this.#width * pixelsPerUnit * scale);
	}

	//==============================================================================
	// 그린 모형의 거리 더하기. (초점 거리를 주지 않은 원근에서 쓴다, 보기 공간의 앞쪽 거리)
	//==============================================================================
	/**
	 * @param { object } mesh
	 * @param { Float32Array } modelElements
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
	 * @param { object } mesh
	 * @param { Float32Array } modelElements
	 * @returns { boolean }
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
	// 선의 판 읽기. (크기가 바뀌면 다시 지음, 노멀과 번호 RGBA8 과 깊이 24, 가면 R8, 짓지 못하면 null)
	//==============================================================================
	/**
	 * @param { number } width
	 * @param { number } height
	 * @returns { object | null }
	 */
	readLineTarget(width, height) {
		const existingTarget = this.#lineTarget;
		if (existingTarget !== null && existingTarget.width === width && existingTarget.height === height) {
			return existingTarget;
		}
		this.deleteLineTarget();
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const previousTexture = webGL2RenderingContext.getParameter(webGL2RenderingContext.TEXTURE_BINDING_2D);
		const previousFramebuffer = webGL2RenderingContext.getParameter(webGL2RenderingContext.FRAMEBUFFER_BINDING);
		const createTexture = (internalFormat, format, type, filter) => {
			const texture = webGL2RenderingContext.createTexture();
			webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, texture);
			webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null);
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, filter);
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, filter);
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);
			return texture;
		};
		const lineTexture = createTexture(webGL2RenderingContext.RGBA8, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, webGL2RenderingContext.NEAREST);
		const depthTexture = createTexture(webGL2RenderingContext.DEPTH_COMPONENT24, webGL2RenderingContext.DEPTH_COMPONENT, webGL2RenderingContext.UNSIGNED_INT, webGL2RenderingContext.NEAREST);
		const maskTexture = createTexture(webGL2RenderingContext.R8, webGL2RenderingContext.RED, webGL2RenderingContext.UNSIGNED_BYTE, webGL2RenderingContext.LINEAR);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, previousTexture);
		const framebuffer = webGL2RenderingContext.createFramebuffer();
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, framebuffer);
		webGL2RenderingContext.framebufferTexture2D(webGL2RenderingContext.FRAMEBUFFER, webGL2RenderingContext.COLOR_ATTACHMENT0, webGL2RenderingContext.TEXTURE_2D, lineTexture, 0);
		webGL2RenderingContext.framebufferTexture2D(webGL2RenderingContext.FRAMEBUFFER, webGL2RenderingContext.DEPTH_ATTACHMENT, webGL2RenderingContext.TEXTURE_2D, depthTexture, 0);
		const status = webGL2RenderingContext.checkFramebufferStatus(webGL2RenderingContext.FRAMEBUFFER);
		const maskFramebuffer = webGL2RenderingContext.createFramebuffer();
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, maskFramebuffer);
		webGL2RenderingContext.framebufferTexture2D(webGL2RenderingContext.FRAMEBUFFER, webGL2RenderingContext.COLOR_ATTACHMENT0, webGL2RenderingContext.TEXTURE_2D, maskTexture, 0);
		const maskStatus = webGL2RenderingContext.checkFramebufferStatus(webGL2RenderingContext.FRAMEBUFFER);
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, previousFramebuffer);
		this.#lineTarget = { framebuffer: framebuffer, lineTexture: lineTexture, depthTexture: depthTexture, maskFramebuffer: maskFramebuffer, maskTexture: maskTexture, width: width, height: height };
		if (status !== webGL2RenderingContext.FRAMEBUFFER_COMPLETE || maskStatus !== webGL2RenderingContext.FRAMEBUFFER_COMPLETE) {
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
		webGL2RenderingContext.deleteFramebuffer(lineTarget.maskFramebuffer);
		webGL2RenderingContext.deleteTexture(lineTarget.lineTexture);
		webGL2RenderingContext.deleteTexture(lineTarget.depthTexture);
		webGL2RenderingContext.deleteTexture(lineTarget.maskTexture);
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
	// 다 쓴 뒤 지우기.
	//==============================================================================
	destroy() {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		this.deleteLineTarget();
		webGL2RenderingContext.deleteVertexArray(this.#emptyVertexArray);
		webGL2RenderingContext.deleteProgram(this.#lineProgram.getProgram());
		webGL2RenderingContext.deleteProgram(this.#maskProgram.getProgram());
		webGL2RenderingContext.deleteProgram(this.#compositeProgram.getProgram());
	}
}

