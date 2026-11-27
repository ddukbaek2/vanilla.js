//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { RenderTarget } from "../rendertarget.js";
import { BloomEffect } from "../bloomeffect.js";
import { MultiLevelBloomEffect } from "../multilevelbloomeffect.js";
import { FullscreenPass } from "../../core/fullscreenpass.js";
import { Matrix4 } from "../../base/matrix4.js";
import { ToonScreenOutline } from "./toonscreenoutline.js";
import { readColorSpace, readEngineColorSpace, addColorSpaceDefine } from "../../core/graphic/colorspace.js";


/**
 * @example <caption>툰 장면을 실수 판에 그리고 블룸과 톤매핑으로 내기</caption>
 * import { ToonRenderer, ToonPostProcess, MeshBuilder, createSphereGeometry, Camera3D, Matrix4, Vector3 } from "./vanilla.js";
 * const canvas = Object.assign(document.createElement("canvas"), { width: 640, height: 360 });
 * const webGL2RenderingContext = canvas.getContext("webgl2");
 * const postProcess = new ToonPostProcess(webGL2RenderingContext, canvas.width, canvas.height, { sampleCount: 4 });
 * postProcess.setExposure(1.2);
 * postProcess.setBloom(true, 0.8, 0.9, 1.6);
 * const renderer = new ToonRenderer(webGL2RenderingContext);
 * renderer.setHdrOutput(postProcess.getUseFloatColor());
 * const builder = new MeshBuilder();
 * builder.addPart(createSphereGeometry(0.5, 32, 20), Matrix4.createIdentity(), "#ffd080", { glow: 2 });
 * const mesh = renderer.createMesh(builder.readArrays());
 * const camera = new Camera3D();
 * camera.setPerspective(0.8, 0.1, 100);
 * camera.setAspectRatio(canvas.width / canvas.height);
 * camera.lookAt(Vector3.create(0, 1, 3), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
 * postProcess.begin([0.02, 0.02, 0.04]);
 * renderer.beginFrameWithCamera(camera);
 * renderer.drawMesh(mesh, Matrix4.createIdentity());
 * renderer.endFrame();
 * postProcess.end(null, [0, 0, canvas.width, canvas.height]);
 */


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 판을 덮어쓰기 앞에 비울 값. (옛 내용을 읽어 들이지 않게 하는 비우기. invalidateFramebuffer 는 아이패드와 아이폰 사파리에서 프레임마다 수 ~ 수십 ms 가 붙어 쓰지 않는다)
const ZERO_CLEAR_FLOAT_VALUE = new System.Float32Array(4);
const COMPOSITE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 fragmentTextureCoordinate;
uniform sampler2D sceneTexture;
uniform sampler2D bloomTexture;
uniform sampler2D depthTexture;
uniform float bloomStrength;
uniform float exposure;
uniform float hdrInput;
uniform float brightness;
uniform vec4 litCenter;
uniform float litInnerRadius;
uniform mat4 inverseViewProjectionMatrix;
uniform float saturation;
uniform float contrast;
uniform vec3 toneColor;
uniform float toneAmount;
uniform vec3 hazeColor;
uniform float hazeAmount;
uniform float vignetteStrength;
out vec4 fragmentColor;
vec3 mapTone(vec3 color) {
	color *= exposure;
	return clamp((color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14), 0.0, 1.0);
}
#ifdef VANILLA_COLOR_SPACE_LINEAR
vec3 toOutput(vec3 color) {
	return mix(color * 12.92, 1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), color));
}
#endif
void main() {
	vec3 scene = texture(sceneTexture, fragmentTextureCoordinate).rgb;
	vec3 bloom = texture(bloomTexture, fragmentTextureCoordinate).rgb;
#ifdef VANILLA_COLOR_SPACE_LINEAR
	vec3 color = hdrInput > 0.5 ? toOutput(mapTone(scene + bloom * bloomStrength)) : clamp(scene + bloom * bloomStrength, 0.0, 1.0);
#else
	vec3 color = hdrInput > 0.5 ? pow(mapTone(scene + bloom * bloomStrength), vec3(1.0 / 2.2)) : clamp(scene + bloom * bloomStrength, 0.0, 1.0);
#endif
	float localBrightness = brightness;
	if (litCenter.w > 0.0) {
		float depth = texture(depthTexture, fragmentTextureCoordinate).r;
		vec4 worldPoint = inverseViewProjectionMatrix * vec4(fragmentTextureCoordinate * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
		float litDistance = length(worldPoint.xz / worldPoint.w - litCenter.xz);
		localBrightness = mix(brightness, 1.0, 1.0 - smoothstep(litInnerRadius, litCenter.w, litDistance));
	}
	color *= localBrightness;
	float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
	color = mix(vec3(luminance), color, saturation);
	color = mix(color, color * toneColor, toneAmount);
	color = mix(color, hazeColor, hazeAmount * (1.0 - luminance));
	color = (color - 0.5) * contrast + 0.5;
	vec2 centered = fragmentTextureCoordinate * 2.0 - 1.0;
	color *= 1.0 - vignetteStrength * smoothstep(0.45, 1.42, length(centered));
	fragmentColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

// 화면 공간 모서리 어둠(GTAO) 셰이더의 공용 머리. (선의 판의 노멀과 깊이를 읽는다)
// - 깊이는 역투영 행렬로 보기 공간 자리로 되돌려 원근과 직교를 함께 받는다. 노멀은 선의 판의 팔면체 노멀(월드)을 보기 회전으로 돌린다.
// - 반 해상도 칸 j 가 읽는 온 해상도 화소는 floor(j x 배 + 0.5) 다. (흐림과 키우기가 같은 화소를 다시 찾는다)
const AMBIENT_OCCLUSION_COMMON_CHUNK = `#version 300 es
precision highp float;
uniform sampler2D lineTexture;
uniform sampler2D depthTexture;
uniform mat4 inverseProjectionMatrix;
uniform mat3 viewRotation;
uniform vec2 sourceSize;
uniform vec2 sourceScale;
out vec4 fragmentColor;
float readDepth(ivec2 pixel) {
	return texelFetch(depthTexture, pixel, 0).r;
}
vec3 readViewPosition(ivec2 pixel, float depth) {
	vec2 point = (vec2(pixel) + 0.5) / sourceSize;
	vec4 position = inverseProjectionMatrix * vec4(point * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
	return position.xyz / position.w;
}
vec3 readViewNormal(ivec2 pixel) {
	vec2 folded = texelFetch(lineTexture, pixel, 0).rg * 2.0 - 1.0;
	vec3 normal = vec3(folded.x, 1.0 - abs(folded.x) - abs(folded.y), folded.y);
	float fold = max(-normal.y, 0.0);
	normal.x += normal.x >= 0.0 ? -fold : fold;
	normal.z += normal.z >= 0.0 ? -fold : fold;
	return normalize(viewRotation * normal);
}
ivec2 readSourcePixel(ivec2 cell) {
	return ivec2(floor(vec2(cell) * sourceScale + 0.5));
}
`;
// 반 해상도 GTAO. (Jimenez, Wu, Pesce, Jarabo 2016 "Practical Realtime Strategies for Accurate Indirect Occlusion" 의 지평선 적분)
// - 칸마다 화면 방향 조각 SLICE_COUNT 개를 돌려 양쪽으로 STEP_COUNT 걸음씩 가장 높은 지평선을 찾고, 투영한 노멀로 코사인 가중 보임을 닫힌 식으로 적분한다.
// - 조각 각과 걸음 자리는 인터리브드 그래디언트 잡음(Jimenez 2014)으로 칸마다 흩는다. 프레임마다 바꾸지 않으니 멈춘 화면은 그대로다. (뒤의 흐림이 잡음을 지운다)
// - 반지름 밖 표본은 0.6 반지름부터 반지름까지 줄여 가장 낮은 지평선 쪽으로 보낸다. (먼 벽이 가리지 않게)
// - 보임을 0.96 으로 나눠 1 에서 자른다. (트인 바닥과 볼록한 면은 정확히 1 이라 화면이 그대로다)
const AMBIENT_OCCLUSION_FRAGMENT_SHADER = AMBIENT_OCCLUSION_COMMON_CHUNK + `
uniform vec4 projectionRow;
uniform float isPerspective;
uniform float radius;
uniform float pixelsPerUnit;
const int SLICE_COUNT = 4;
const int STEP_COUNT = 6;
const float PI = 3.14159265;
const float HALF_PI = 1.57079633;
// 트인 면의 보임이 이 값 이상이면 1 로 본다. (8 비트 팔면체 노멀과 깊이 정밀도, 조각 넷의 잡음으로 평평하거나 볼록한 면이 0.98 쯤으로 셈해지는 것을 지운다)
const float SELF_OCCLUSION_LIMIT = 0.96;
float readNoise(vec2 pixel) {
	return fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
}
float readArc(float horizon, float normalAngle) {
	return 0.25 * (-cos(2.0 * horizon - normalAngle) + cos(normalAngle) + 2.0 * horizon * sin(normalAngle));
}
void main() {
	ivec2 cell = ivec2(gl_FragCoord.xy);
	ivec2 pixel = readSourcePixel(cell);
	float depth = readDepth(pixel);
	if (depth >= 1.0) {
		fragmentColor = vec4(1.0);
		return;
	}
	vec3 position = readViewPosition(pixel, depth);
	vec3 normal = readViewNormal(pixel);
	vec3 viewVector = isPerspective > 0.5 ? normalize(-position) : vec3(0.0, 0.0, 1.0);
	float radiusPixels = min(radius * pixelsPerUnit / max(dot(projectionRow, vec4(position, 1.0)), 0.0001), sourceSize.y * 0.25);
	if (radiusPixels < 1.0) {
		fragmentColor = vec4(1.0);
		return;
	}
	float sliceNoise = readNoise(gl_FragCoord.xy);
	float stepNoise = readNoise(gl_FragCoord.yx + vec2(23.0, 61.0));
	float falloffScale = 1.0 / (radius * 0.4);
	ivec2 maximumPixel = ivec2(sourceSize) - 1;
	vec2 center = vec2(pixel);
	float visibility = 0.0;
	for (int sliceIndex = 0; sliceIndex < SLICE_COUNT; ++sliceIndex) {
		float angle = (float(sliceIndex) + sliceNoise) * (PI / float(SLICE_COUNT));
		vec2 direction = vec2(cos(angle), sin(angle));
		vec3 directionVector = vec3(direction, 0.0);
		vec3 orthoDirection = directionVector - dot(directionVector, viewVector) * viewVector;
		vec3 axis = normalize(cross(directionVector, viewVector));
		vec3 projectedNormal = normal - axis * dot(normal, axis);
		float projectedLength = length(projectedNormal);
		float cosineNormal = clamp(dot(projectedNormal, viewVector) / max(projectedLength, 0.0001), -1.0, 1.0);
		float normalAngle = (dot(orthoDirection, projectedNormal) >= 0.0 ? 1.0 : -1.0) * acos(cosineNormal);
		float lowCosine0 = cos(normalAngle + HALF_PI);
		float lowCosine1 = cos(normalAngle - HALF_PI);
		float horizonCosine0 = lowCosine0;
		float horizonCosine1 = lowCosine1;
		for (int stepIndex = 0; stepIndex < STEP_COUNT; ++stepIndex) {
			float fraction = (float(stepIndex) + stepNoise) / float(STEP_COUNT);
			vec2 offset = direction * max(fraction * fraction * radiusPixels, float(stepIndex) + 1.0);
			ivec2 samplePixel0 = ivec2(floor(center + offset + 0.5));
			ivec2 samplePixel1 = ivec2(floor(center - offset + 0.5));
			if (all(greaterThanEqual(samplePixel0, ivec2(0))) && all(lessThanEqual(samplePixel0, maximumPixel))) {
				vec3 delta = readViewPosition(samplePixel0, readDepth(samplePixel0)) - position;
				float deltaLength = length(delta);
				float weight = clamp((radius - deltaLength) * falloffScale, 0.0, 1.0);
				horizonCosine0 = max(horizonCosine0, mix(lowCosine0, dot(delta, viewVector) / max(deltaLength, 0.0001), weight));
			}
			if (all(greaterThanEqual(samplePixel1, ivec2(0))) && all(lessThanEqual(samplePixel1, maximumPixel))) {
				vec3 delta = readViewPosition(samplePixel1, readDepth(samplePixel1)) - position;
				float deltaLength = length(delta);
				float weight = clamp((radius - deltaLength) * falloffScale, 0.0, 1.0);
				horizonCosine1 = max(horizonCosine1, mix(lowCosine1, dot(delta, viewVector) / max(deltaLength, 0.0001), weight));
			}
		}
		float horizon0 = normalAngle + min(acos(clamp(horizonCosine0, -1.0, 1.0)) - normalAngle, HALF_PI);
		float horizon1 = normalAngle + max(-acos(clamp(horizonCosine1, -1.0, 1.0)) - normalAngle, -HALF_PI);
		visibility += projectedLength * (readArc(horizon0, normalAngle) + readArc(horizon1, normalAngle));
	}
	fragmentColor = vec4(clamp(visibility / (float(SLICE_COUNT) * SELF_OCCLUSION_LIMIT), 0.0, 1.0), 0.0, 0.0, 1.0);
}
`;
// 가장자리 지키는 흐림의 무게. (탭 자리가 가운데의 접평면에서 떨어진 거리와 두 노멀의 각으로, Kopf 2007 joint bilateral 꼴)
const AMBIENT_OCCLUSION_WEIGHT_CHUNK = `
uniform float planeTolerance;
uniform sampler2D occlusionTexture;
uniform vec2 occlusionSize;
float readTapWeight(vec3 position, vec3 normal, ivec2 cell, out float occlusion) {
	ivec2 clampedCell = clamp(cell, ivec2(0), ivec2(occlusionSize) - 1);
	occlusion = texelFetch(occlusionTexture, clampedCell, 0).r;
	ivec2 pixel = readSourcePixel(clampedCell);
	float depth = readDepth(pixel);
	if (depth >= 1.0) {
		return 0.0;
	}
	vec3 tapPosition = readViewPosition(pixel, depth);
	float planeDistance = abs(dot(tapPosition - position, normal)) / planeTolerance;
	float normalWeight = pow(max(dot(readViewNormal(pixel), normal), 0.0), 8.0);
	return exp(-planeDistance * planeDistance) * normalWeight;
}
`;
// 가로, 세로 흐림. (반 해상도, 가우스 7 탭, 방향은 blurDirection)
const AMBIENT_OCCLUSION_BLUR_FRAGMENT_SHADER = AMBIENT_OCCLUSION_COMMON_CHUNK + AMBIENT_OCCLUSION_WEIGHT_CHUNK + `
uniform ivec2 blurDirection;
const float GAUSSIAN_WEIGHTS[4] = float[4](1.0, 0.8, 0.45, 0.2);
void main() {
	ivec2 cell = ivec2(gl_FragCoord.xy);
	ivec2 pixel = readSourcePixel(cell);
	float depth = readDepth(pixel);
	if (depth >= 1.0) {
		fragmentColor = vec4(1.0);
		return;
	}
	vec3 position = readViewPosition(pixel, depth);
	vec3 normal = readViewNormal(pixel);
	float occlusionSum = 0.0;
	float weightSum = 0.0;
	for (int offset = -3; offset <= 3; ++offset) {
		float occlusion;
		float weight = GAUSSIAN_WEIGHTS[abs(offset)] * readTapWeight(position, normal, cell + blurDirection * offset, occlusion);
		occlusionSum += occlusion * weight;
		weightSum += weight;
	}
	fragmentColor = vec4(weightSum > 0.0001 ? occlusionSum / weightSum : 1.0, 0.0, 0.0, 1.0);
}
`;
// 온 해상도로 키우기. (화소에서 가까운 반 해상도 2 x 2 칸을 쌍선형 무게에 화소의 깊이와 노멀로 고른 무게를 곱해 섞는다, 세기를 걸고 깊이 24 비트를 gba 에)
// - 가로와 세로 흐림은 반 해상도에서 끝났으니 온 해상도 화소는 탭 넷만 읽는다. (유니티 URP 의 SSAO 처럼 흐림은 줄인 판에서, 키울 때는 깊이를 보는 쌍선형)
// - 몸 셰이더가 제 깊이와 견주어 같은 면일 때만 읽는다. (비치는 것, 선의 판에 없는 것은 어둡히지 않는다)
const AMBIENT_OCCLUSION_UPSAMPLE_FRAGMENT_SHADER = AMBIENT_OCCLUSION_COMMON_CHUNK + AMBIENT_OCCLUSION_WEIGHT_CHUNK + `
uniform float intensity;
vec3 packDepth(float depth) {
	float value = floor(depth * 16777215.0 + 0.5);
	float high = floor(value / 65536.0);
	float middle = floor((value - high * 65536.0) / 256.0);
	return vec3(high, middle, value - high * 65536.0 - middle * 256.0) / 255.0;
}
void main() {
	ivec2 pixel = ivec2(gl_FragCoord.xy);
	float depth = readDepth(pixel);
	if (depth >= 1.0) {
		fragmentColor = vec4(1.0);
		return;
	}
	vec3 position = readViewPosition(pixel, depth);
	vec3 normal = readViewNormal(pixel);
	vec2 point = (gl_FragCoord.xy - 0.5) / sourceScale;
	ivec2 baseCell = ivec2(floor(point));
	vec2 fraction = point - vec2(baseCell);
	float occlusionSum = 0.0;
	float weightSum = 0.0;
	for (int index = 0; index < 4; ++index) {
		ivec2 corner = ivec2(index & 1, index >> 1);
		float bilinear = (corner.x == 1 ? fraction.x : 1.0 - fraction.x) * (corner.y == 1 ? fraction.y : 1.0 - fraction.y);
		float occlusion;
		float weight = (bilinear + 0.0001) * readTapWeight(position, normal, baseCell + corner, occlusion);
		occlusionSum += occlusion * weight;
		weightSum += weight;
	}
	float visibility = weightSum > 0.0001 ? occlusionSum / weightSum : 1.0;
	fragmentColor = vec4(1.0 - intensity * (1.0 - visibility), packDepth(depth));
}
`;

//==============================================================================
// 툰 HDR 마무리. (실수 렌더 타겟에 그린 선형 색을 블룸, 노출, 톤매핑, 감마로 화면에 낸다)
// - RenderTarget(반정밀 실수 색, 깊이), BloomEffect(또는 MultiLevelBloomEffect), FullscreenPass 를 엮는다.
// - 사용: ToonRenderer.setHdrOutput(true) 뒤 begin(바탕 선형 색) → ToonRenderer 로 그리기 → end(낼 프레임버퍼, 뷰포트)
//   end 는 (멀티샘플이면 풀고) 블룸을 셈하고 톤매핑한 색을 낼 프레임버퍼(null 이면 화면)에 그린다.
// - 생성 옵션: new ToonPostProcess(gl, 너비, 높이, { sampleCount, useFloatColor, depthBits, useDepthTexture }) (옵션이 없으면 지금과 같은 RGBA16F, 깊이 16, 멀티샘플 없음)
//   sampleCount 가 2 이상이면 씬을 멀티샘플(MSAA) 렌더버퍼에 그리고 end 앞에서 텍스처로 푼다. 기기가 받는 수로 줄인다. (getSampleCount, setSampleCount)
//   depthBits 24 는 깊이 24 비트. (먼 면이 먼 장면) useDepthTexture 는 씬 깊이를 텍스처로 남긴다. (setLitArea 가 쓴다)
// - 색 공간: 씬 렌더 타겟에는 선형 색을 쓴다. (ToonRenderer.setHdrOutput(true), ToonScreenOutline.setHdrOutput(true), ToonVfx 색도 선형으로 본다)
//   감마를 건 색 g 를 실수 판에 쓰고 합성에서 g^2.2 로 되돌리던 게임은 그 값을 미리 선형으로 바꿔 넘긴다. 색은 c^2.2, 감마 쪽에서 곱하던 밝기 배 k 는 선형 k^2.2 다.
//   (예: 1.37 은 선형 2, 1.6 은 2.81, 2.08 은 5, 밝기 1.6 에 배 1.6 이면 (1.6 x 1.6)^2.2 = 7.9) 블룸 문턱과 무릎은 선형 밝기다.
//   이 예는 감마 쪽(감마를 건 색 g)에서 곱하던 배일 때만 맞다. 선형 색에 곱하던 배와 블룸 문턱, 무릎처럼 처음부터 선형인 값은 바꾸지 않고 그대로 넘긴다.
// - 실수 판을 못 쓰는 기기: useFloatColor(기본 true)여도 ToonPostProcess.isFloatColorSupported 가 false 면 RGBA8 판으로 짓는다. (getUseFloatColor 가 false)
//   그때와 useFloatColor: false 는 LDR 길이다. 씬에는 화면 색(감마를 건 색, ToonRenderer.setHdrOutput(false))을 그리고, 합성은 톤매핑과 감마 없이 블룸을 더해 색 보정만 건다.
// - 블룸: 기본은 반 해상도 9 탭 가우시안(BloomEffect, 문턱 0.9 ~ 1.6, 주고받는 판 RGBA8, setBloomFloatColor 로 RGBA16F).
//   setBloomLevels(단 수, 문턱, 무릎) 로 단 수를 1 이상 주면 MultiLevelBloomEffect(반씩 줄였다 천막 꼴로 키우며 더함, 씬과 같은 정밀도의 판)로 바꾼다. 0 이면 기본으로 돌린다. 세기는 setBloom 이 둘 다에 쓴다.
// - 톤매핑은 ACES 근사(Krzysztof Narkowicz 2016, 원문이 CC0 또는 MIT 로 쓰게 함)다. 노출(setExposure)을 곱한 뒤 매핑하고 sRGB 감마를 건다.
//   감마 색 공간(기본)은 pow(1 / 2.2), 선형 색 공간(options.colorSpace 나 엔진의 ColorSpace.linear)은 sRGB 표준 곡선(IEC 61966-2-1)이다. (ToonRenderer 의 LDR 출력과 같은 곡선)
// - 색 보정: 감마를 건 뒤 밝기(setBrightness, 밝힌 자리 setLitArea 안은 1 쪽으로), 채도, 색조(밝기 1 로 맞춘 색을 곱함), 안개빛(어두운 곳을 그 색 쪽으로), 대비, 가장자리 어둡게 차례로 건다. (setColorGrade, setVignette)
//   기본은 밝기 1, 채도 1, 대비 1, 색조 0, 안개빛 0, 가장자리 0 이라 보정이 없다.
// - 해상도 배율: setResolutionScale(배율) 이면 씬 판을 출력 크기 x 배율로 짓고 end 의 뷰포트로 키워(선형 거르기) 낸다. (3D 만 낮춰 그리고 UI 는 기기 화소 그대로 둘 때, 기본 1)
// - 노드 사각형 안에 낼 때: resize(사각형 너비, 높이) → begin → 그리기(ToonRenderer 의 화면 사각형은 풀어 둔다) → end(null, [x, 드로잉 버퍼 높이 - y - 높이, 너비, 높이]).
// - 모서리 어둠(화면 공간 AO): setAmbientOcclusion(켬, 세기, 반지름, 해상도 배율, 직접 빛 몫) 로 켠다. (기본 꺼짐, 세기 0.5, 반지름 0.5 월드 길이, 반 해상도, 직접 빛 몫 0)
//   GTAO(Jimenez 2016)를 반 해상도로 셈하고, 접평면 거리와 노멀로 가장자리를 지키며 가로로 흐린 뒤 세로로 흐리며 온 해상도로 키운다. (잡음은 고정 무늬라 멈춘 화면은 흔들리지 않는다)
//   노멀과 깊이는 화면 바깥선(ToonScreenOutline)의 선의 판을 다시 쓴다. 바깥선이 없는 장면은 선은 긋지 않고 선의 판만 그리는 getAmbientOcclusionPrepass() 를 쓴다.
//   ToonDrawQueue.setPostProcess(이것) 이면 큐가 선의 판 뒤, 몸 앞에 drawAmbientOcclusion 을 부르고 렌더러에 결과를 건다. 몸 셰이더는 바탕빛(하늘과 땅 빛)에 곱하고, 직접 빛 몫만큼 해, 채움빛, 점광의 확산과 반사광에도 곱한다. (칸을 고른 뒤라 칸 경계는 그대로, 몫 0 이면 바탕빛에만)
//   엔진에 있던 AmbientOcclusionEffect 는 원근의 시야각과 가까운, 먼 면으로만 깊이를 풀고 RGB 월드 노멀과 커버리지 알파를 받는 반구 표본 꼴이라 직교 카메라와 선의 판(팔면체 노멀)에 맞지 않아 따로 짓는다.
//==============================================================================
/**
 * @example <caption>3D 만 낮춰 그리고 색 보정 걸기</caption>
 * import { ToonRenderer, ToonPostProcess } from "./vanilla.js";
 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
 * const postProcess = new ToonPostProcess(webGL2RenderingContext, 1280, 720, { depthBits: 24, useDepthTexture: true });
 * postProcess.setResolutionScale(0.75);
 * postProcess.setBloomLevels(5, 1, 0.25);
 * postProcess.setColorGrade(1.1, 1.05, [1, 0.9, 0.8], 0.3, [0.2, 0.25, 0.35], 0.15);
 * postProcess.setVignette(0.3);
 * const renderer = new ToonRenderer(webGL2RenderingContext);
 * renderer.setHdrOutput(postProcess.getUseFloatColor());
 */
export class ToonPostProcess {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { RenderTarget } */ #sceneRenderTarget;
	/** @private @type { BloomEffect } */ #bloomEffect;
	/** @private @type { MultiLevelBloomEffect | null } */ #multiLevelBloomEffect; // 단 수를 주면 쓰는 다단 블룸.
	/** @private @type { FullscreenPass } */ #compositePass;
	/** @private @type { boolean } */ #useFloatColor; // 씬 판이 실수인지. (HDR 길)
	/** @private @type { number } */ #requestedSampleCount;
	/** @private @type { number } */ #depthBits;
	/** @private @type { boolean } */ #useDepthTexture;
	/** @private @type { number } */ #outputWidth; // resize 로 받은 출력 크기.
	/** @private @type { number } */ #outputHeight;
	/** @private @type { number } */ #resolutionScale;
	/** @private @type { number } */ #exposure;
	/** @private @type { number } */ #bloomStrength;
	/** @private @type { boolean } */ #isBloomEnabled;
	/** @private @type { number } */ #bloomThreshold; // 다단 블룸의 문턱.
	/** @private @type { number } */ #bloomKnee; // 다단 블룸의 무릎.
	/** @private @type { number } */ #brightness;
	/** @private @type { object | null } */ #litArea; // 밝힌 자리. ({ center, innerRadius, outerRadius, inverseViewProjectionElements })
	/** @private @type { number } */ #saturation;
	/** @private @type { number } */ #contrast;
	/** @private @type { Array<number> } */ #toneColor; // 밝기 1 로 맞춘 곱.
	/** @private @type { number } */ #toneAmount;
	/** @private @type { Array<number> } */ #hazeColor;
	/** @private @type { number } */ #hazeAmount;
	/** @private @type { number } */ #vignetteStrength;
	/** @private @type { object } */ #ambientOcclusion; // 모서리 어둠 설정. ({ isEnabled, intensity, radius, resolutionScale, directLightingStrength })
	/** @private @type { object | null } */ #ambientOcclusionPasses; // 모서리 어둠의 세 패스. ({ occlusionPass, blurPass, upsamplePass }, 처음 셀 때 짓는다)
	/** @private @type { object | null } */ #ambientOcclusionTarget; // 모서리 어둠 판. ({ occlusionTexture, blurTexture, resultTexture 와 그 프레임버퍼, width, height, cellWidth, cellHeight })
	/** @private @type { ToonScreenOutline | null } */ #ambientOcclusionPrepass; // 바깥선이 없는 장면의 노멀과 깊이 미리 그리기. (선은 긋지 않는다)
	/** @private @type { string } */ #colorSpace; // 색 공간. (ColorSpace, 생성 때 정함, 톤매핑 뒤 화면 색의 곡선, gamma 는 pow 1 / 2.2, linear 는 sRGB 표준 곡선)

	//==============================================================================
	// 생성. (화면 픽셀 크기, 옵션 { sampleCount = 0, useFloatColor = true, depthBits = 16, useDepthTexture = false })
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext - 툰 렌더러와 같은 컨텍스트.
	 * @param { number } width - 출력 너비. (픽셀)
	 * @param { number } height - 출력 높이. (픽셀)
	 * @param { object | null } [options] - { sampleCount (기본 0), useFloatColor (기본 true), depthBits (16 이나 24), useDepthTexture (기본 false), colorSpace (ColorSpace, 기본은 엔진의 색 공간, ToonRenderer 와 같은 값) }
	 */
	constructor(webGL2RenderingContext, width, height, options = null) {
		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#colorSpace = options !== null && options.colorSpace !== undefined ? readColorSpace(options.colorSpace) : readEngineColorSpace();
		webGL2RenderingContext.getExtension("EXT_color_buffer_float");
		webGL2RenderingContext.getExtension("EXT_color_buffer_half_float");
		const isFloatColorRequested = options === null || options.useFloatColor !== false;
		this.#useFloatColor = isFloatColorRequested && ToonPostProcess.isFloatColorSupported(webGL2RenderingContext);
		this.#requestedSampleCount = options !== null && options.sampleCount ? options.sampleCount : 0;
		this.#depthBits = options !== null && options.depthBits === 24 ? 24 : 16;
		this.#useDepthTexture = options !== null && options.useDepthTexture === true;
		this.#outputWidth = System.Math.max(1, width);
		this.#outputHeight = System.Math.max(1, height);
		this.#resolutionScale = 1;
		this.#sceneRenderTarget = this.createSceneRenderTarget();
		this.#bloomEffect = new BloomEffect(webGL2RenderingContext);
		this.#bloomEffect.resize(System.Math.max(1, width), System.Math.max(1, height));
		this.#bloomEffect.setThreshold(0.9, 1.6);
		this.#multiLevelBloomEffect = null;
		this.#compositePass = new FullscreenPass(webGL2RenderingContext, addColorSpaceDefine(COMPOSITE_FRAGMENT_SHADER, this.#colorSpace));
		this.#exposure = 1;
		this.#bloomStrength = 0.6;
		this.#isBloomEnabled = true;
		this.#bloomThreshold = 1;
		this.#bloomKnee = 0.25;
		this.#brightness = 1;
		this.#litArea = null;
		this.#saturation = 1;
		this.#contrast = 1;
		this.#toneColor = [1, 1, 1];
		this.#toneAmount = 0;
		this.#hazeColor = [0, 0, 0];
		this.#hazeAmount = 0;
		this.#vignetteStrength = 0;
		this.#ambientOcclusion = { isEnabled: false, intensity: 0.5, radius: 0.5, resolutionScale: 0.5, directLightingStrength: 0 };
		this.#ambientOcclusionPasses = null;
		this.#ambientOcclusionTarget = null;
		this.#ambientOcclusionPrepass = null;
	}

	//==============================================================================
	// 실수 컬러 판을 그릴 수 있는지. (EXT_color_buffer_float 나 EXT_color_buffer_half_float 가 있고, 1 x 1 RGBA16F 를 붙인 프레임버퍼가 완성되는지)
	//==============================================================================
	/**
	 * @static
	 * @param { WebGL2RenderingContext } webGL2RenderingContext - 알아볼 컨텍스트.
	 * @returns { boolean } RGBA16F 판에 그릴 수 있으면 true.
	 * @example <caption>기기에 맞춰 HDR 길과 LDR 길 고르기</caption>
	 * import { ToonRenderer, ToonPostProcess } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const isHdr = ToonPostProcess.isFloatColorSupported(webGL2RenderingContext);
	 * const postProcess = new ToonPostProcess(webGL2RenderingContext, 640, 360, { useFloatColor: isHdr });
	 * const renderer = new ToonRenderer(webGL2RenderingContext);
	 * renderer.setHdrOutput(isHdr);
	 */
	static isFloatColorSupported(webGL2RenderingContext) {
		const floatExtension = webGL2RenderingContext.getExtension("EXT_color_buffer_float");
		const halfFloatExtension = webGL2RenderingContext.getExtension("EXT_color_buffer_half_float");
		if (floatExtension === null && halfFloatExtension === null) {
			return false;
		}
		const previousFramebuffer = webGL2RenderingContext.getParameter(webGL2RenderingContext.FRAMEBUFFER_BINDING);
		const previousTexture = webGL2RenderingContext.getParameter(webGL2RenderingContext.TEXTURE_BINDING_2D);
		const testTexture = webGL2RenderingContext.createTexture();
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, testTexture);
		webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.RGBA16F, 1, 1, 0, webGL2RenderingContext.RGBA, webGL2RenderingContext.HALF_FLOAT, null);
		const testFramebuffer = webGL2RenderingContext.createFramebuffer();
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, testFramebuffer);
		webGL2RenderingContext.framebufferTexture2D(webGL2RenderingContext.FRAMEBUFFER, webGL2RenderingContext.COLOR_ATTACHMENT0, webGL2RenderingContext.TEXTURE_2D, testTexture, 0);
		const isComplete = webGL2RenderingContext.checkFramebufferStatus(webGL2RenderingContext.FRAMEBUFFER) === webGL2RenderingContext.FRAMEBUFFER_COMPLETE;
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, previousFramebuffer);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, previousTexture);
		webGL2RenderingContext.deleteFramebuffer(testFramebuffer);
		webGL2RenderingContext.deleteTexture(testTexture);
		return isComplete;
	}

	//==============================================================================
	// 씬 렌더 타겟 짓기. (출력 크기 x 해상도 배율, 지금 옵션으로)
	//==============================================================================
	/**
	 * @returns { RenderTarget } 새로 지은 씬 렌더 타겟.
	 */
	createSceneRenderTarget() {
		const sceneWidth = this.readSceneWidth();
		const sceneHeight = this.readSceneHeight();
		const options = { colorAttachmentCount: 1, useFloatColor: this.#useFloatColor, useDepthTexture: this.#useDepthTexture, sampleCount: this.#requestedSampleCount, depthBits: this.#depthBits };
		return new RenderTarget(this.#webGL2RenderingContext, sceneWidth, sceneHeight, true, options);
	}

	//==============================================================================
	// 씬 판의 너비. (출력 너비 x 해상도 배율, 1 이상)
	//==============================================================================
	/**
	 * @returns { number } 씬 판의 너비. (픽셀)
	 */
	readSceneWidth() {
		return System.Math.max(1, System.Math.round(this.#outputWidth * this.#resolutionScale));
	}

	//==============================================================================
	// 씬 판의 높이. (출력 높이 x 해상도 배율, 1 이상)
	//==============================================================================
	/**
	 * @returns { number } 씬 판의 높이. (픽셀)
	 */
	readSceneHeight() {
		return System.Math.max(1, System.Math.round(this.#outputHeight * this.#resolutionScale));
	}

	//==============================================================================
	// 크기 바꾸기. (출력 크기, 씬 판은 해상도 배율을 곱함, 같으면 그대로)
	//==============================================================================
	/**
	 * @param { number } width - 출력 너비. (픽셀)
	 * @param { number } height - 출력 높이. (픽셀)
	 * @example <caption>캔버스 크기가 바뀔 때 맞추기</caption>
	 * import { ToonPostProcess } from "./vanilla.js";
	 * const canvas = document.createElement("canvas");
	 * const webGL2RenderingContext = canvas.getContext("webgl2");
	 * const postProcess = new ToonPostProcess(webGL2RenderingContext, canvas.width, canvas.height);
	 * canvas.width = 1280;
	 * canvas.height = 720;
	 * postProcess.resize(canvas.width, canvas.height);
	 */
	resize(width, height) {
		this.#outputWidth = System.Math.max(1, width);
		this.#outputHeight = System.Math.max(1, height);
		const sceneRenderTarget = this.#sceneRenderTarget;
		const sceneWidth = this.readSceneWidth();
		const sceneHeight = this.readSceneHeight();
		if (sceneRenderTarget.getWidth() === sceneWidth && sceneRenderTarget.getHeight() === sceneHeight) {
			return;
		}
		sceneRenderTarget.resize(sceneWidth, sceneHeight);
		this.#bloomEffect.resize(sceneWidth, sceneHeight);
		const multiLevelBloomEffect = this.#multiLevelBloomEffect;
		if (multiLevelBloomEffect !== null) {
			multiLevelBloomEffect.resize(sceneWidth, sceneHeight);
		}
	}

	//==============================================================================
	// 해상도 배율 설정. (씬 판 = 출력 크기 x 배율, 0.05 ~ 4, 기본 1)
	//==============================================================================
	/**
	 * @param { number } resolutionScale - 씬 판의 배율. (0.05 ~ 4)
	 * @example <caption>폰에서 3D 만 반 해상도로</caption>
	 * import { ToonPostProcess } from "./vanilla.js";
	 * const postProcess = new ToonPostProcess(document.createElement("canvas").getContext("webgl2"), 1080, 1920);
	 * postProcess.setResolutionScale(0.5);
	 * const resolutionScale = postProcess.getResolutionScale();
	 * const sceneWidth = postProcess.getSceneRenderTarget().getWidth();
	 */
	setResolutionScale(resolutionScale) {
		this.#resolutionScale = System.Math.max(0.05, System.Math.min(4, resolutionScale));
		this.resize(this.#outputWidth, this.#outputHeight);
	}

	//==============================================================================
	// 해상도 배율 반환.
	//==============================================================================
	/**
	 * @returns { number } 씬 판의 배율.
	 */
	getResolutionScale() {
		return this.#resolutionScale;
	}

	//==============================================================================
	// 멀티샘플 표본 수 설정. (2 밑이면 없음, 바뀌면 씬 판을 다시 짓는다)
	//==============================================================================
	/**
	 * @param { number } sampleCount - 멀티샘플 표본 수. (2 밑이면 멀티샘플 없음)
	 * @example <caption>설정에서 계단 줄이기를 켜고 실제 표본 수 읽기</caption>
	 * import { ToonPostProcess } from "./vanilla.js";
	 * const postProcess = new ToonPostProcess(document.createElement("canvas").getContext("webgl2"), 640, 360);
	 * postProcess.setSampleCount(4);
	 * const sampleCount = postProcess.getSampleCount();
	 * const isMultisampled = sampleCount >= 2;
	 */
	setSampleCount(sampleCount) {
		const safeSampleCount = System.Math.max(0, System.Math.floor(sampleCount));
		if (safeSampleCount === this.#requestedSampleCount) {
			return;
		}
		this.#requestedSampleCount = safeSampleCount;
		this.#sceneRenderTarget.destroy();
		this.#sceneRenderTarget = this.createSceneRenderTarget();
	}

	//==============================================================================
	// 실제로 쓰는 멀티샘플 표본 수 반환. (0 이면 없음)
	//==============================================================================
	/**
	 * @returns { number } 씬 판이 실제로 쓰는 표본 수. (기기가 받는 수로 줄인 것, 0 이면 없음)
	 */
	getSampleCount() {
		return this.#sceneRenderTarget.getSampleCount();
	}

	//==============================================================================
	// 씬 판이 실수인지 반환. (false 면 LDR 길)
	//==============================================================================
	/**
	 * @returns { boolean } 씬 판이 실수면 true. (ToonRenderer.setHdrOutput 에 그대로 넘긴다)
	 */
	getUseFloatColor() {
		return this.#useFloatColor;
	}

	//==============================================================================
	// 색 공간 반환. (생성 때 정한 값, 톤매핑 뒤 화면 색을 내는 곡선을 가른다)
	//==============================================================================
	/**
	 * @returns { string } ColorSpace.gamma 나 ColorSpace.linear.
	 * @example <caption>렌더러와 같은 색 공간으로 지은 후처리</caption>
	 * import { ToonRenderer, ToonPostProcess, ColorSpace } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const renderer = new ToonRenderer(webGL2RenderingContext, { colorSpace: ColorSpace.linear });
	 * const postProcess = new ToonPostProcess(webGL2RenderingContext, 320, 180, { colorSpace: renderer.getColorSpace() });
	 * if (postProcess.getColorSpace() !== ColorSpace.linear) {
	 * 	throw new Error("color space is not linear");
	 * }
	 */
	getColorSpace() {
		return this.#colorSpace;
	}

	//==============================================================================
	// 씬 그리기 시작. (씬 렌더 타겟을 묶고 바탕 색과 깊이로 비운다, HDR 길은 선형 색, LDR 길은 화면 색)
	//==============================================================================
	/**
	 * @param { Array<number> } clearColor - [r, g, b] 바탕 색. (HDR 길은 선형 색, LDR 길은 화면 색)
	 */
	begin(clearColor) {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const sceneRenderTarget = this.#sceneRenderTarget;
		sceneRenderTarget.bind();
		webGL2RenderingContext.viewport(0, 0, sceneRenderTarget.getWidth(), sceneRenderTarget.getHeight());
		webGL2RenderingContext.depthMask(true);
		webGL2RenderingContext.clearColor(clearColor[0], clearColor[1], clearColor[2], 1);
		webGL2RenderingContext.clear(webGL2RenderingContext.COLOR_BUFFER_BIT | webGL2RenderingContext.DEPTH_BUFFER_BIT);
	}

	//==============================================================================
	// 마무리. (멀티샘플이면 풂 → 블룸 → 톤매핑해 낼 프레임버퍼에, viewport 는 [x, y, 너비, 높이])
	//==============================================================================
	/**
	 * @param { WebGLFramebuffer | null } outputFramebuffer - 낼 프레임버퍼. (null 이면 화면)
	 * @param { Array<number> } viewport - [x, y, 너비, 높이] 낼 자리. (드로잉 버퍼 픽셀, 왼쪽 아래가 원점)
	 * @example <caption>왼쪽 위 원점의 사각형 안에 내기</caption>
	 * import { ToonPostProcess } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const screenRect = { x: 40, y: 20, width: 200, height: 120 };
	 * const postProcess = new ToonPostProcess(webGL2RenderingContext, screenRect.width, screenRect.height);
	 * postProcess.begin([0.05, 0.05, 0.08]);
	 * const bottomY = webGL2RenderingContext.drawingBufferHeight - screenRect.y - screenRect.height;
	 * postProcess.end(null, [screenRect.x, bottomY, screenRect.width, screenRect.height]);
	 */
	end(outputFramebuffer, viewport) {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const sceneRenderTarget = this.#sceneRenderTarget;
		sceneRenderTarget.resolve();
		const sceneTexture = sceneRenderTarget.getColorTexture(0);
		const isBloomEnabled = this.#isBloomEnabled;
		const multiLevelBloomEffect = this.#multiLevelBloomEffect;
		let bloomTexture = sceneTexture;
		if (isBloomEnabled) {
			if (multiLevelBloomEffect !== null) {
				multiLevelBloomEffect.render(sceneTexture);
				bloomTexture = multiLevelBloomEffect.getResultTexture();
			}
			else {
				this.#bloomEffect.render(sceneTexture);
				bloomTexture = this.#bloomEffect.getResultTexture();
			}
		}
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, outputFramebuffer);
		webGL2RenderingContext.viewport(viewport[0], viewport[1], viewport[2], viewport[3]);
		webGL2RenderingContext.disable(webGL2RenderingContext.DEPTH_TEST);
		webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);
		const compositePass = this.#compositePass;
		compositePass.useProgram();
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, sceneTexture);
		webGL2RenderingContext.uniform1i(compositePass.getUniformLocation("sceneTexture"), 0);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE1);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, bloomTexture);
		webGL2RenderingContext.uniform1i(compositePass.getUniformLocation("bloomTexture"), 1);
		const litArea = this.#litArea;
		const depthTexture = sceneRenderTarget.getDepthTexture();
		const isLitAreaApplied = litArea !== null && depthTexture !== null;
		// 깊이 칸. (밝힌 자리를 쓰지 않으면 읽지 않지만 빈 칸이면 드라이버가 알리므로 씬 텍스처를 묶어 둔다)
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE2);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, isLitAreaApplied ? depthTexture : sceneTexture);
		webGL2RenderingContext.uniform1i(compositePass.getUniformLocation("depthTexture"), 2);
		webGL2RenderingContext.uniform1f(compositePass.getUniformLocation("bloomStrength"), isBloomEnabled ? this.#bloomStrength : 0);
		webGL2RenderingContext.uniform1f(compositePass.getUniformLocation("exposure"), this.#exposure);
		webGL2RenderingContext.uniform1f(compositePass.getUniformLocation("hdrInput"), this.#useFloatColor ? 1 : 0);
		webGL2RenderingContext.uniform1f(compositePass.getUniformLocation("brightness"), this.#brightness);
		if (isLitAreaApplied) {
			const center = litArea.center;
			webGL2RenderingContext.uniform4f(compositePass.getUniformLocation("litCenter"), center[0], center[1], center[2], litArea.outerRadius);
			webGL2RenderingContext.uniform1f(compositePass.getUniformLocation("litInnerRadius"), litArea.innerRadius);
			webGL2RenderingContext.uniformMatrix4fv(compositePass.getUniformLocation("inverseViewProjectionMatrix"), false, litArea.inverseViewProjectionElements);
		}
		else {
			webGL2RenderingContext.uniform4f(compositePass.getUniformLocation("litCenter"), 0, 0, 0, 0);
		}
		const toneColor = this.#toneColor;
		const hazeColor = this.#hazeColor;
		webGL2RenderingContext.uniform1f(compositePass.getUniformLocation("saturation"), this.#saturation);
		webGL2RenderingContext.uniform1f(compositePass.getUniformLocation("contrast"), this.#contrast);
		webGL2RenderingContext.uniform3f(compositePass.getUniformLocation("toneColor"), toneColor[0], toneColor[1], toneColor[2]);
		webGL2RenderingContext.uniform1f(compositePass.getUniformLocation("toneAmount"), this.#toneAmount);
		webGL2RenderingContext.uniform3f(compositePass.getUniformLocation("hazeColor"), hazeColor[0], hazeColor[1], hazeColor[2]);
		webGL2RenderingContext.uniform1f(compositePass.getUniformLocation("hazeAmount"), this.#hazeAmount);
		webGL2RenderingContext.uniform1f(compositePass.getUniformLocation("vignetteStrength"), this.#vignetteStrength);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		compositePass.draw();
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE2);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, null);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
	}

	//==============================================================================
	// 노출 설정. (톤매핑 전에 곱한다, 1 이 기본)
	//==============================================================================
	/**
	 * @param { number } exposure - 노출 배. (0 이상, 1 이 기본)
	 */
	setExposure(exposure) {
		this.#exposure = System.Math.max(0, exposure);
	}

	//==============================================================================
	// 블룸 설정. (켜기, 세기, 밝은 곳을 뽑는 문턱의 시작과 끝, 문턱은 기본 9 탭 블룸에만 쓴다)
	//==============================================================================
	/**
	 * @param { boolean } isBloomEnabled - 블룸을 켤지.
	 * @param { number } bloomStrength - 블룸 세기. (씬 색에 더하는 배, 기본 0.6)
	 * @param { number } thresholdStart - 밝은 곳을 뽑기 시작하는 선형 밝기. (기본 0.9)
	 * @param { number } thresholdEnd - 다 뽑는 선형 밝기. (기본 1.6)
	 * @example <caption>빛나는 것만 은은하게 번지게</caption>
	 * import { ToonPostProcess } from "./vanilla.js";
	 * const postProcess = new ToonPostProcess(document.createElement("canvas").getContext("webgl2"), 640, 360);
	 * postProcess.setExposure(1.1);
	 * postProcess.setBloom(true, 0.5, 1.2, 2.5);
	 * postProcess.setBloomFloatColor(true);
	 */
	setBloom(isBloomEnabled, bloomStrength, thresholdStart, thresholdEnd) {
		this.#isBloomEnabled = isBloomEnabled;
		this.#bloomStrength = System.Math.max(0, bloomStrength);
		this.#bloomEffect.setThreshold(thresholdStart, thresholdEnd);
	}

	//==============================================================================
	// 블룸 단 수 설정. (0 이면 기본 9 탭 블룸, 1 이상이면 그 단 수의 다단 블룸, 문턱과 무릎은 다단 블룸의 선형 밝기)
	// - 다단 블룸 판은 씬 판과 같은 정밀도다. (HDR 길은 RGBA16F)
	//==============================================================================
	/**
	 * @param { number } levelCount - 단 수. (0 이면 기본 9 탭 블룸으로 돌린다)
	 * @param { number } threshold - 다단 블룸의 문턱. (선형 밝기)
	 * @param { number } knee - 문턱 둘레를 부드럽게 넘기는 폭. (선형 밝기)
	 * @example <caption>넓게 번지는 다단 블룸으로 바꿨다 되돌리기</caption>
	 * import { ToonPostProcess } from "./vanilla.js";
	 * const postProcess = new ToonPostProcess(document.createElement("canvas").getContext("webgl2"), 640, 360);
	 * postProcess.setBloomLevels(6, 1, 0.3);
	 * const levelCount = postProcess.getBloomLevelCount();
	 * postProcess.setBloomLevels(0, 1, 0.3);
	 */
	setBloomLevels(levelCount, threshold, knee) {
		this.#bloomThreshold = System.Math.max(0, threshold);
		this.#bloomKnee = System.Math.max(0, knee);
		const safeLevelCount = System.Math.max(0, System.Math.floor(levelCount));
		let multiLevelBloomEffect = this.#multiLevelBloomEffect;
		if (safeLevelCount === 0) {
			if (multiLevelBloomEffect !== null) {
				multiLevelBloomEffect.destroy();
				this.#multiLevelBloomEffect = null;
			}
			return;
		}
		if (multiLevelBloomEffect === null) {
			multiLevelBloomEffect = new MultiLevelBloomEffect(this.#webGL2RenderingContext, safeLevelCount, this.#useFloatColor);
			multiLevelBloomEffect.resize(this.readSceneWidth(), this.readSceneHeight());
			this.#multiLevelBloomEffect = multiLevelBloomEffect;
		}
		multiLevelBloomEffect.setLevelCount(safeLevelCount);
		multiLevelBloomEffect.setThreshold(this.#bloomThreshold, this.#bloomKnee);
	}

	//==============================================================================
	// 블룸 단 수 반환. (0 이면 기본 9 탭 블룸)
	//==============================================================================
	/**
	 * @returns { number } 다단 블룸의 단 수. (0 이면 기본 9 탭 블룸)
	 */
	getBloomLevelCount() {
		const multiLevelBloomEffect = this.#multiLevelBloomEffect;
		return multiLevelBloomEffect !== null ? multiLevelBloomEffect.getLevelCount() : 0;
	}

	//==============================================================================
	// 기본 9 탭 블룸의 주고받는 판을 실수로. (true 면 RGBA16F, 기본 false 는 RGBA8, 씬 판이 실수가 아니면 무시)
	//==============================================================================
	/**
	 * @param { boolean } isFloatColor - true 면 RGBA16F, false 면 RGBA8.
	 */
	setBloomFloatColor(isFloatColor) {
		this.#bloomEffect.setUseFloatColor(isFloatColor && this.#useFloatColor);
	}

	//==============================================================================
	// 밝기 설정. (색 보정 맨 앞에서 곱한다, 1 이 그대로)
	//==============================================================================
	/**
	 * @param { number } brightness - 밝기 배. (0 이상, 1 이 그대로)
	 */
	setBrightness(brightness) {
		this.#brightness = System.Math.max(0, brightness);
	}

	//==============================================================================
	// 밝힌 자리 설정. (그 자리에서 수평 거리 innerRadius 안은 밝기 1, outerRadius 밖은 setBrightness 의 밝기, 사이는 부드럽게)
	// - 씬 깊이 텍스처(옵션 useDepthTexture)와 그 프레임의 보기와 투영의 역행렬로 화소마다 월드 자리를 되짚는다. 깊이 텍스처가 없으면 무시한다.
	// - 카메라가 움직이면 프레임마다 다시 준다. 아무것도 그리지 않은 바탕은 먼 면의 자리로 셈한다.
	//==============================================================================
	/**
	 * @param { Array<number> } center [x, y, z]
	 * @param { number } innerRadius - 밝기 1 인 수평 반지름. (월드 길이)
	 * @param { number } outerRadius - 이 밖은 setBrightness 의 밝기인 수평 반지름. (월드 길이)
	 * @param { Matrix4 } inverseViewProjectionMatrix - 이번 프레임 보기와 투영의 역행렬.
	 * @example <caption>어두운 장면에서 손전등 둘레만 밝히기</caption>
	 * import { ToonPostProcess, Camera3D, Vector3 } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const postProcess = new ToonPostProcess(webGL2RenderingContext, 640, 360, { useDepthTexture: true });
	 * const camera = new Camera3D();
	 * camera.setPerspective(0.8, 0.1, 100);
	 * camera.lookAt(Vector3.create(0, 6, 8), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
	 * postProcess.setBrightness(0.35);
	 * postProcess.setLitArea([0, 0, 0], 2, 4, camera.getInverseViewProjectionMatrix());
	 */
	setLitArea(center, innerRadius, outerRadius, inverseViewProjectionMatrix) {
		const safeOuterRadius = System.Math.max(0.0001, outerRadius);
		this.#litArea = {
			center: [center[0], center[1], center[2]],
			innerRadius: System.Math.max(0, System.Math.min(innerRadius, safeOuterRadius)),
			outerRadius: safeOuterRadius,
			inverseViewProjectionElements: System.Float32Array.from(inverseViewProjectionMatrix.getElements()),
		};
	}

	//==============================================================================
	// 밝힌 자리 풀기.
	//==============================================================================
	clearLitArea() {
		this.#litArea = null;
	}

	//==============================================================================
	// 색 보정 설정. (채도와 대비는 1 이 그대로, 색조와 안개빛은 sRGB [r, g, b] 0 ~ 1 과 섞는 양 0 ~ 1)
	// - 색조 색은 밝기(Rec. 709)를 1 로 맞춰 곱하므로 밝기는 그대로 두고 빛깔만 물든다.
	// - 안개빛은 어두운 곳일수록 그 색 쪽으로 끌어올린다. (양 x (1 - 밝기))
	//==============================================================================
	/**
	 * @param { number } saturation - 채도. (1 이 그대로, 0 이면 흑백)
	 * @param { number } contrast - 대비. (1 이 그대로)
	 * @param { Array<number> } toneColor - [r, g, b] 색조 색. (sRGB 0 ~ 1, 밝기를 1 로 맞춰 곱한다)
	 * @param { number } toneAmount - 색조를 섞는 양. (0 ~ 1)
	 * @param { Array<number> } hazeColor - [r, g, b] 안개빛 색. (sRGB 0 ~ 1)
	 * @param { number } hazeAmount - 안개빛을 섞는 양. (0 ~ 1, 어두운 곳일수록 세다)
	 * @example <caption>해 질 녘처럼 따뜻하고 뿌연 색</caption>
	 * import { ToonPostProcess } from "./vanilla.js";
	 * const postProcess = new ToonPostProcess(document.createElement("canvas").getContext("webgl2"), 640, 360);
	 * postProcess.setBrightness(0.95);
	 * postProcess.setColorGrade(0.9, 1.1, [1, 0.75, 0.55], 0.35, [0.35, 0.25, 0.4], 0.2);
	 * postProcess.setVignette(0.25);
	 */
	setColorGrade(saturation, contrast, toneColor, toneAmount, hazeColor, hazeAmount) {
		const toneLuminance = toneColor[0] * 0.2126 + toneColor[1] * 0.7152 + toneColor[2] * 0.0722;
		const toneScale = toneLuminance > 0 ? 1 / toneLuminance : 1;
		this.#saturation = System.Math.max(0, saturation);
		this.#contrast = System.Math.max(0, contrast);
		this.#toneColor = [toneColor[0] * toneScale, toneColor[1] * toneScale, toneColor[2] * toneScale];
		this.#toneAmount = System.Math.max(0, System.Math.min(1, toneAmount));
		this.#hazeColor = [hazeColor[0], hazeColor[1], hazeColor[2]];
		this.#hazeAmount = System.Math.max(0, System.Math.min(1, hazeAmount));
	}

	//==============================================================================
	// 가장자리 어둡게 설정. (0 이 없음, 1 이면 구석이 까맣게)
	//==============================================================================
	/**
	 * @param { number } vignetteStrength - 가장자리를 어둡게 하는 세기. (0 이 없음, 1 이면 구석이 까맣게)
	 */
	setVignette(vignetteStrength) {
		this.#vignetteStrength = System.Math.max(0, vignetteStrength);
	}

	//==============================================================================
	// 모서리 어둠(화면 공간 AO) 설정. (기본 꺼짐, 켜면 drawAmbientOcclusion 이 셈하고 몸 셰이더가 바탕빛에 곱한다)
	// - 벽과 바닥이 만나는 곳, 물건 밑, 발밑이 엷게 어두워진다. 세기 1 이면 가린 만큼 다 어둡고 0.5 면 그 반이다.
	// - 직접 빛 몫은 해가 비추는 곳에서 얼마나 보일지다. (유니티 URP SSAO 의 Direct Lighting Strength, HDRP 의 directLightingStrength)
	//   0 이면 바탕빛에만 곱하고, 1 이면 해, 채움빛, 점광과 스포트라이트의 확산과 반사광에도 보임을 다 곱한다. 칸(밝기 단계)을 고른 뒤에 곱해 칸 경계 자리는 그대로다.
	//==============================================================================
	/**
	 * @param { boolean } isEnabled - 켤지.
	 * @param { number } [intensity] - 세기 0 ~ 1. (기본 0.5)
	 * @param { number } [radius] - 가림을 찾는 반지름. (월드 길이, 기본 0.5)
	 * @param { number } [resolutionScale] - 셈하는 해상도 배율 0.25 ~ 1. (기본 0.5, 흐림과 키우기는 선의 판 해상도)
	 * @param { number } [directLightingStrength] - 직접 빛에 미치는 몫 0 ~ 1. (기본 0, 바탕빛에만 곱함)
	 * @example <caption>바깥선 없는 장면에 모서리 어둠 켜기</caption>
	 * import { ToonRenderer, ToonPostProcess, ToonDrawQueue, MeshBuilder, createBoxGeometry, Camera3D, Matrix4, Vector3 } from "./vanilla.js";
	 * const canvas = Object.assign(document.createElement("canvas"), { width: 320, height: 180 });
	 * const webGL2RenderingContext = canvas.getContext("webgl2");
	 * const postProcess = new ToonPostProcess(webGL2RenderingContext, canvas.width, canvas.height, { depthBits: 24 });
	 * postProcess.setAmbientOcclusion(true, 0.5, 0.5, 0.5, 0.5);
	 * const renderer = new ToonRenderer(webGL2RenderingContext);
	 * renderer.setHdrOutput(postProcess.getUseFloatColor());
	 * const builder = new MeshBuilder();
	 * builder.addPart(createBoxGeometry(4, 0.2, 4), Matrix4.createTranslation(0, -0.1, 0), "#a0a8b0", { hasOutline: false });
	 * builder.addPart(createBoxGeometry(0.6, 0.6, 0.6), Matrix4.createTranslation(0, 0.3, 0), "#d08060", { hasOutline: false });
	 * const mesh = renderer.createMesh(builder.readArrays());
	 * const camera = new Camera3D();
	 * camera.setPerspective(0.8, 0.1, 50);
	 * camera.setAspectRatio(canvas.width / canvas.height);
	 * camera.lookAt(Vector3.create(2, 2.5, 3), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
	 * const queue = new ToonDrawQueue();
	 * queue.setPostProcess(postProcess);
	 * queue.addMesh(mesh, Matrix4.createIdentity());
	 * postProcess.begin([0.05, 0.05, 0.08]);
	 * queue.draw(renderer, camera);
	 * postProcess.end(null, [0, 0, canvas.width, canvas.height]);
	 * if (postProcess.getAmbientOcclusionTexture() === null || postProcess.getAmbientOcclusionDirectLightingStrength() !== 0.5) {
	 * 	throw new Error("ambient occlusion texture is missing");
	 * }
	 */
	setAmbientOcclusion(isEnabled, intensity = 0.5, radius = 0.5, resolutionScale = 0.5, directLightingStrength = 0) {
		this.#ambientOcclusion = {
			isEnabled: isEnabled === true,
			intensity: System.Math.max(0, System.Math.min(1, intensity)),
			radius: System.Math.max(0.0001, radius),
			resolutionScale: System.Math.max(0.25, System.Math.min(1, resolutionScale)),
			directLightingStrength: System.Math.max(0, System.Math.min(1, directLightingStrength)),
		};
	}

	//==============================================================================
	// 모서리 어둠 설정 반환.
	//==============================================================================
	/**
	 * @returns { object } { isEnabled, intensity, radius, resolutionScale, directLightingStrength } (새 객체)
	 */
	getAmbientOcclusion() {
		const ambientOcclusion = this.#ambientOcclusion;
		return { isEnabled: ambientOcclusion.isEnabled, intensity: ambientOcclusion.intensity, radius: ambientOcclusion.radius, resolutionScale: ambientOcclusion.resolutionScale, directLightingStrength: ambientOcclusion.directLightingStrength };
	}

	//==============================================================================
	// 모서리 어둠이 직접 빛에 미치는 몫 반환. (setAmbientOcclusion 의 다섯째 인자, 그리기 줄이 렌더러에 건다)
	//==============================================================================
	/**
	 * @returns { number } 0 ~ 1. (기본 0)
	 */
	getAmbientOcclusionDirectLightingStrength() {
		return this.#ambientOcclusion.directLightingStrength;
	}

	//==============================================================================
	// 모서리 어둠이 켜졌는지.
	//==============================================================================
	/**
	 * @returns { boolean } setAmbientOcclusion 으로 켰으면 true.
	 */
	isAmbientOcclusionEnabled() {
		return this.#ambientOcclusion.isEnabled;
	}

	//==============================================================================
	// 바깥선이 없는 장면의 노멀과 깊이 미리 그리기 반환. (선은 긋지 않는 ToonScreenOutline, 처음 부를 때 짓는다)
	//==============================================================================
	/**
	 * @returns { ToonScreenOutline } 선의 판만 그리는 화면 바깥선. (beginLineIds, drawMesh, endLineIds 로 그리고 getLineTarget 을 drawAmbientOcclusion 에 준다)
	 */
	getAmbientOcclusionPrepass() {
		if (this.#ambientOcclusionPrepass === null) {
			const prepass = new ToonScreenOutline(this.#webGL2RenderingContext, { colorSpace: this.#colorSpace });
			prepass.setWidth(0);
			prepass.setCrease(180, 0);
			this.#ambientOcclusionPrepass = prepass;
		}
		return this.#ambientOcclusionPrepass;
	}

	//==============================================================================
	// 모서리 어둠 셈하기. (선의 판의 노멀과 깊이로 반 해상도 GTAO → 가로 흐림 → 세로 흐림과 키우기, 꺼졌으면 null)
	// - 선의 판을 그린 뒤, 몸을 그리기 전에 부른다. 프레임버퍼, 뷰포트, 프로그램, 버텍스 어레이, 고른 유닛은 부르기 전으로 돌린다.
	// - 결과 텍스처는 선의 판 크기의 RGBA8 이다. (r 세기를 건 보임, gba 깊이 24 비트) ToonRenderer.setAmbientOcclusionTexture 에 준다.
	//==============================================================================
	/**
	 * @param { object } lineTarget - ToonScreenOutline.getLineTarget() 의 결과. ({ lineTexture, depthTexture, width, height })
	 * @param { Matrix4 } viewMatrix - 선의 판을 그린 보기 행렬.
	 * @param { Matrix4 } projectionMatrix - 선의 판을 그린 투영 행렬. (원근이나 직교)
	 * @returns { WebGLTexture | null } 결과 텍스처. (꺼졌거나 판을 짓지 못했으면 null)
	 * @example <caption>렌더러로 바로 그릴 때 선의 판, 모서리 어둠, 몸 차례로</caption>
	 * import { ToonRenderer, ToonPostProcess, MeshBuilder, createBoxGeometry, Matrix4, Vector3 } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const postProcess = new ToonPostProcess(webGL2RenderingContext, 300, 150, { depthBits: 24 });
	 * postProcess.setAmbientOcclusion(true);
	 * const renderer = new ToonRenderer(webGL2RenderingContext);
	 * const builder = new MeshBuilder();
	 * builder.addPart(createBoxGeometry(3, 0.2, 3), Matrix4.createIdentity(), "#909090", { hasOutline: false });
	 * const mesh = renderer.createMesh(builder.readArrays());
	 * const viewMatrix = Matrix4.createLookAt(Vector3.create(2, 3, 3), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
	 * const projectionMatrix = Matrix4.createOrthographic(-2, 2, -1, 1, 0.1, 20);
	 * postProcess.begin([0, 0, 0]);
	 * const prepass = postProcess.getAmbientOcclusionPrepass();
	 * if (prepass.beginLineIds(viewMatrix, projectionMatrix)) {
	 * 	prepass.drawMesh(mesh, Matrix4.createIdentity(), 1);
	 * 	prepass.endLineIds();
	 * }
	 * renderer.setAmbientOcclusionTexture(postProcess.drawAmbientOcclusion(prepass.getLineTarget(), viewMatrix, projectionMatrix));
	 * renderer.beginFrameWithMatrices(viewMatrix, projectionMatrix);
	 * renderer.drawMesh(mesh, Matrix4.createIdentity());
	 * renderer.endFrame();
	 * renderer.setAmbientOcclusionTexture(null);
	 * postProcess.end(null, [0, 0, 300, 150]);
	 */
	drawAmbientOcclusion(lineTarget, viewMatrix, projectionMatrix) {
		const ambientOcclusion = this.#ambientOcclusion;
		if (!ambientOcclusion.isEnabled || lineTarget === null) {
			return null;
		}
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const width = lineTarget.width;
		const height = lineTarget.height;
		const target = this.readAmbientOcclusionTarget(width, height, System.Math.max(1, System.Math.ceil(width * ambientOcclusion.resolutionScale)), System.Math.max(1, System.Math.ceil(height * ambientOcclusion.resolutionScale)));
		if (target === null) {
			return null;
		}
		const passes = this.readAmbientOcclusionPasses();
		const previousFramebuffer = webGL2RenderingContext.getParameter(webGL2RenderingContext.FRAMEBUFFER_BINDING);
		const previousViewport = webGL2RenderingContext.getParameter(webGL2RenderingContext.VIEWPORT);
		const previousProgram = webGL2RenderingContext.getParameter(webGL2RenderingContext.CURRENT_PROGRAM);
		const previousVertexArray = webGL2RenderingContext.getParameter(webGL2RenderingContext.VERTEX_ARRAY_BINDING);
		const previousActiveTexture = webGL2RenderingContext.getParameter(webGL2RenderingContext.ACTIVE_TEXTURE);
		const isDepthTestEnabled = webGL2RenderingContext.isEnabled(webGL2RenderingContext.DEPTH_TEST);
		const isBlendEnabled = webGL2RenderingContext.isEnabled(webGL2RenderingContext.BLEND);
		const isScissorTestEnabled = webGL2RenderingContext.isEnabled(webGL2RenderingContext.SCISSOR_TEST);
		const isCullFaceEnabled = webGL2RenderingContext.isEnabled(webGL2RenderingContext.CULL_FACE);
		webGL2RenderingContext.disable(webGL2RenderingContext.DEPTH_TEST);
		webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);
		webGL2RenderingContext.disable(webGL2RenderingContext.SCISSOR_TEST);
		webGL2RenderingContext.disable(webGL2RenderingContext.CULL_FACE);
		const viewElements = viewMatrix.getElements();
		const projectionElements = projectionMatrix.getElements();
		const inverseProjectionElements = Matrix4.createInverse(projectionMatrix).getElements();
		const viewRotation = [viewElements[0], viewElements[1], viewElements[2], viewElements[4], viewElements[5], viewElements[6], viewElements[8], viewElements[9], viewElements[10]];
		const sourceScaleX = width / target.cellWidth;
		const sourceScaleY = height / target.cellHeight;
		const bindCommon = (pass, occlusionTexture) => {
			pass.useProgram();
			webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
			webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, lineTarget.lineTexture);
			webGL2RenderingContext.uniform1i(pass.getUniformLocation("lineTexture"), 0);
			webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE1);
			webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, lineTarget.depthTexture);
			webGL2RenderingContext.uniform1i(pass.getUniformLocation("depthTexture"), 1);
			webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE2);
			webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, occlusionTexture);
			webGL2RenderingContext.uniform1i(pass.getUniformLocation("occlusionTexture"), 2);
			webGL2RenderingContext.uniformMatrix4fv(pass.getUniformLocation("inverseProjectionMatrix"), false, inverseProjectionElements);
			webGL2RenderingContext.uniformMatrix3fv(pass.getUniformLocation("viewRotation"), false, viewRotation);
			webGL2RenderingContext.uniform2f(pass.getUniformLocation("sourceSize"), width, height);
			webGL2RenderingContext.uniform2f(pass.getUniformLocation("sourceScale"), sourceScaleX, sourceScaleY);
			webGL2RenderingContext.uniform2f(pass.getUniformLocation("occlusionSize"), target.cellWidth, target.cellHeight);
			webGL2RenderingContext.uniform1f(pass.getUniformLocation("planeTolerance"), ambientOcclusion.radius * 0.1);
		};

		// 1. 반 해상도 GTAO. (빈 칸 유닛 2 에는 결과 판이 아닌 흐림 판을 묶어 둔다)
		// 세 패스 모두 판을 통째로 덮어쓰므로 앞에 판을 비운다. (타일 GPU 의 판 불러오기를 없앰)
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, target.occlusionFramebuffer);
		webGL2RenderingContext.clearBufferfv(webGL2RenderingContext.COLOR, 0, ZERO_CLEAR_FLOAT_VALUE);
		webGL2RenderingContext.viewport(0, 0, target.cellWidth, target.cellHeight);
		const occlusionPass = passes.occlusionPass;
		bindCommon(occlusionPass, target.blurTexture);
		webGL2RenderingContext.uniform4f(occlusionPass.getUniformLocation("projectionRow"), projectionElements[3], projectionElements[7], projectionElements[11], projectionElements[15]);
		webGL2RenderingContext.uniform1f(occlusionPass.getUniformLocation("isPerspective"), System.Math.abs(projectionElements[11]) > 0.5 ? 1 : 0);
		webGL2RenderingContext.uniform1f(occlusionPass.getUniformLocation("radius"), ambientOcclusion.radius);
		webGL2RenderingContext.uniform1f(occlusionPass.getUniformLocation("pixelsPerUnit"), 0.5 * System.Math.abs(projectionElements[0]) * width);
		occlusionPass.draw();

		// 2. 가로 흐림. (반 해상도, GTAO 판에서 흐림 판으로)
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, target.blurFramebuffer);
		webGL2RenderingContext.clearBufferfv(webGL2RenderingContext.COLOR, 0, ZERO_CLEAR_FLOAT_VALUE);
		bindCommon(passes.blurPass, target.occlusionTexture);
		webGL2RenderingContext.uniform2i(passes.blurPass.getUniformLocation("blurDirection"), 1, 0);
		passes.blurPass.draw();

		// 3. 세로 흐림. (반 해상도, 흐림 판에서 GTAO 판으로, 판 둘을 돌려 쓴다)
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, target.occlusionFramebuffer);
		webGL2RenderingContext.clearBufferfv(webGL2RenderingContext.COLOR, 0, ZERO_CLEAR_FLOAT_VALUE);
		bindCommon(passes.blurPass, target.blurTexture);
		webGL2RenderingContext.uniform2i(passes.blurPass.getUniformLocation("blurDirection"), 0, 1);
		passes.blurPass.draw();

		// 4. 키우기. (선의 판 해상도, 세기를 건다)
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, target.resultFramebuffer);
		webGL2RenderingContext.clearBufferfv(webGL2RenderingContext.COLOR, 0, ZERO_CLEAR_FLOAT_VALUE);
		webGL2RenderingContext.viewport(0, 0, width, height);
		const upsamplePass = passes.upsamplePass;
		bindCommon(upsamplePass, target.occlusionTexture);
		webGL2RenderingContext.uniform1f(upsamplePass.getUniformLocation("intensity"), ambientOcclusion.intensity);
		upsamplePass.draw();

		for (const unit of [2, 1, 0]) {
			webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + unit);
			webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, null);
		}
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, previousFramebuffer);
		webGL2RenderingContext.viewport(previousViewport[0], previousViewport[1], previousViewport[2], previousViewport[3]);
		webGL2RenderingContext.useProgram(previousProgram);
		webGL2RenderingContext.bindVertexArray(previousVertexArray);
		webGL2RenderingContext.activeTexture(previousActiveTexture);
		const restoreCapability = (capability, isEnabled) => {
			if (isEnabled) {
				webGL2RenderingContext.enable(capability);
			}
		};
		restoreCapability(webGL2RenderingContext.DEPTH_TEST, isDepthTestEnabled);
		restoreCapability(webGL2RenderingContext.BLEND, isBlendEnabled);
		restoreCapability(webGL2RenderingContext.SCISSOR_TEST, isScissorTestEnabled);
		restoreCapability(webGL2RenderingContext.CULL_FACE, isCullFaceEnabled);
		return target.resultTexture;
	}

	//==============================================================================
	// 모서리 어둠 결과 텍스처 반환. (아직 셈하지 않았거나 꺼졌으면 null)
	//==============================================================================
	/**
	 * @returns { WebGLTexture | null } 선의 판 크기의 RGBA8. (r 세기를 건 보임, gba 깊이 24 비트)
	 */
	getAmbientOcclusionTexture() {
		const target = this.#ambientOcclusionTarget;
		return this.#ambientOcclusion.isEnabled && target !== null ? target.resultTexture : null;
	}

	//==============================================================================
	// 모서리 어둠의 세 패스 반환. (처음 부를 때 짓는다)
	//==============================================================================
	/**
	 * @returns { object } { occlusionPass, blurPass, upsamplePass }
	 * @private
	 */
	readAmbientOcclusionPasses() {
		if (this.#ambientOcclusionPasses === null) {
			const webGL2RenderingContext = this.#webGL2RenderingContext;
			this.#ambientOcclusionPasses = {
				occlusionPass: new FullscreenPass(webGL2RenderingContext, AMBIENT_OCCLUSION_FRAGMENT_SHADER),
				blurPass: new FullscreenPass(webGL2RenderingContext, AMBIENT_OCCLUSION_BLUR_FRAGMENT_SHADER),
				upsamplePass: new FullscreenPass(webGL2RenderingContext, AMBIENT_OCCLUSION_UPSAMPLE_FRAGMENT_SHADER),
			};
		}
		return this.#ambientOcclusionPasses;
	}

	//==============================================================================
	// 모서리 어둠 판 반환. (크기가 같으면 있던 것, 다르면 다시 짓는다, 짓지 못하면 null)
	//==============================================================================
	/**
	 * @param { number } width - 선의 판 너비.
	 * @param { number } height - 선의 판 높이.
	 * @param { number } cellWidth - 셈하는 판 너비.
	 * @param { number } cellHeight - 셈하는 판 높이.
	 * @returns { object | null } 판. (짓지 못했으면 null)
	 * @private
	 */
	readAmbientOcclusionTarget(width, height, cellWidth, cellHeight) {
		const existingTarget = this.#ambientOcclusionTarget;
		if (existingTarget !== null && existingTarget.width === width && existingTarget.height === height && existingTarget.cellWidth === cellWidth && existingTarget.cellHeight === cellHeight) {
			return existingTarget;
		}
		this.deleteAmbientOcclusionTarget();
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const previousTexture = webGL2RenderingContext.getParameter(webGL2RenderingContext.TEXTURE_BINDING_2D);
		const previousFramebuffer = webGL2RenderingContext.getParameter(webGL2RenderingContext.FRAMEBUFFER_BINDING);
		let isComplete = true;
		const createLayer = (textureWidth, textureHeight) => {
			const texture = webGL2RenderingContext.createTexture();
			webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, texture);
			webGL2RenderingContext.texStorage2D(webGL2RenderingContext.TEXTURE_2D, 1, webGL2RenderingContext.RGBA8, textureWidth, textureHeight);
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, webGL2RenderingContext.NEAREST);
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, webGL2RenderingContext.NEAREST);
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
			webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);
			const framebuffer = webGL2RenderingContext.createFramebuffer();
			webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, framebuffer);
			webGL2RenderingContext.framebufferTexture2D(webGL2RenderingContext.FRAMEBUFFER, webGL2RenderingContext.COLOR_ATTACHMENT0, webGL2RenderingContext.TEXTURE_2D, texture, 0);
			isComplete = isComplete && webGL2RenderingContext.checkFramebufferStatus(webGL2RenderingContext.FRAMEBUFFER) === webGL2RenderingContext.FRAMEBUFFER_COMPLETE;
			return { texture: texture, framebuffer: framebuffer };
		};
		const occlusionLayer = createLayer(cellWidth, cellHeight);
		const blurLayer = createLayer(cellWidth, cellHeight);
		const resultLayer = createLayer(width, height);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, previousTexture);
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, previousFramebuffer);
		this.#ambientOcclusionTarget = {
			occlusionTexture: occlusionLayer.texture, occlusionFramebuffer: occlusionLayer.framebuffer,
			blurTexture: blurLayer.texture, blurFramebuffer: blurLayer.framebuffer,
			resultTexture: resultLayer.texture, resultFramebuffer: resultLayer.framebuffer,
			width: width, height: height, cellWidth: cellWidth, cellHeight: cellHeight,
		};
		if (!isComplete) {
			this.deleteAmbientOcclusionTarget();
			return null;
		}
		return this.#ambientOcclusionTarget;
	}

	//==============================================================================
	// 모서리 어둠 판 지우기.
	//==============================================================================
	/**
	 * @private
	 */
	deleteAmbientOcclusionTarget() {
		const target = this.#ambientOcclusionTarget;
		if (target === null) {
			return;
		}
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		for (const texture of [target.occlusionTexture, target.blurTexture, target.resultTexture]) {
			webGL2RenderingContext.deleteTexture(texture);
		}
		for (const framebuffer of [target.occlusionFramebuffer, target.blurFramebuffer, target.resultFramebuffer]) {
			webGL2RenderingContext.deleteFramebuffer(framebuffer);
		}
		this.#ambientOcclusionTarget = null;
	}

	//==============================================================================
	// 씬 렌더 타겟 반환. (다른 후처리를 끼울 때)
	//==============================================================================
	/**
	 * @returns { RenderTarget } 씬을 그리는 렌더 타겟. (해상도 배율이나 표본 수를 바꾸면 다시 지어질 수 있다)
	 * @example <caption>씬 색 텍스처를 다른 후처리에 넘기기</caption>
	 * import { ToonPostProcess } from "./vanilla.js";
	 * const postProcess = new ToonPostProcess(document.createElement("canvas").getContext("webgl2"), 640, 360);
	 * postProcess.begin([0, 0, 0]);
	 * const sceneRenderTarget = postProcess.getSceneRenderTarget();
	 * sceneRenderTarget.resolve();
	 * const sceneTexture = sceneRenderTarget.getColorTexture(0);
	 */
	getSceneRenderTarget() {
		return this.#sceneRenderTarget;
	}

	//==============================================================================
	// 지우기.
	//==============================================================================
	destroy() {
		this.#sceneRenderTarget.destroy();
		this.#bloomEffect.destroy();
		const multiLevelBloomEffect = this.#multiLevelBloomEffect;
		if (multiLevelBloomEffect !== null) {
			multiLevelBloomEffect.destroy();
			this.#multiLevelBloomEffect = null;
		}
		this.#compositePass.destroy();
		this.deleteAmbientOcclusionTarget();
		const ambientOcclusionPasses = this.#ambientOcclusionPasses;
		if (ambientOcclusionPasses !== null) {
			ambientOcclusionPasses.occlusionPass.destroy();
			ambientOcclusionPasses.blurPass.destroy();
			ambientOcclusionPasses.upsamplePass.destroy();
			this.#ambientOcclusionPasses = null;
		}
		if (this.#ambientOcclusionPrepass !== null) {
			this.#ambientOcclusionPrepass.destroy();
			this.#ambientOcclusionPrepass = null;
		}
	}
}
