//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Node } from "../base/node.js";
import { Rect } from "../base/rect.js";
import { Vector2 } from "../base/vector2.js";
import { Engine } from "./engine.js";
import { Color } from "../base/color.js";
import { TransformNode } from "./node/transformnode.js";
import { TransformMatrix } from "../base/transformmatrix.js";
import { ShaderProgram } from "./graphic/shaderprogram.js";
import { ImageTextureCache } from "./graphic/imagetexturecache.js";
import { TextStringTextureCache } from "./graphic/textstringtexturecache.js";
import { WebGLStateCache } from "./graphic/webglstatecache.js";
import * as Math from "../base/math.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 버텍스 셰이더. (픽셀 좌표 → 클립 좌표)
const VERTEXSHADER_SOURCE = `#version 300 es
in vec2 vertexPosition;
in vec2 vertexTextureCoordinate;
uniform mat3 projectionMatrix;
uniform mat3 modelMatrix;
out vec2 fragmentTextureCoordinate;
void main() {
	vec3 transformedPosition = projectionMatrix * (modelMatrix * vec3(vertexPosition, 1.0));
	gl_Position = vec4(transformedPosition.xy, 0.0, 1.0);
	fragmentTextureCoordinate = vertexTextureCoordinate;
}
`;

// 프래그먼트 셰이더. (프리멀티플라이드 알파 출력)
// - 단색 도형은 1x1 흰색 텍스처를 바인드해 같은 경로로 처리한다.
// - tintColor 는 이미지 실루엣(알파) 안쪽에만 색을 덮는 틴트. (alpha 0 이면 비활성)
// - textureLodBias 는 밉맵 단계를 고를 때 더하는 값. (setImageMipmapBias, 음수면 더 큰 단계를 골라 또렷해진다)
const FRAGMENTSHADER_SOURCE = `#version 300 es
precision highp float;
in vec2 fragmentTextureCoordinate;
uniform sampler2D mainTexture;
uniform vec4 mainColor;
uniform vec4 tintColor;
uniform float globalAlpha;
uniform float textureLodBias;
out vec4 outputColor;
void main() {
	vec4 textureColor = texture(mainTexture, fragmentTextureCoordinate, textureLodBias);
	vec3 tintedColor = mix(textureColor.rgb, tintColor.rgb * textureColor.a, tintColor.a);
	float finalAlpha = textureColor.a * mainColor.a * globalAlpha;
	vec3 finalColor = tintedColor * mainColor.rgb * mainColor.a * globalAlpha;
	outputColor = vec4(finalColor, finalAlpha);
}
`;

// 버텍스 1개당 float 수. (x, y, u, v)
// 파티클 배치 버텍스 셰이더. (정점마다 색을 실어 한 번의 드로우로 수백 개를 그린다)
const PARTICLE_VERTEXSHADER_SOURCE = `#version 300 es
in vec2 vertexPosition;
in vec2 vertexTextureCoordinate;
in vec4 vertexColor;
uniform mat3 projectionMatrix;
uniform mat3 modelMatrix;
out vec2 fragmentTextureCoordinate;
out vec4 fragmentColor;
void main() {
	vec3 transformedPosition = projectionMatrix * (modelMatrix * vec3(vertexPosition, 1.0));
	gl_Position = vec4(transformedPosition.xy, 0.0, 1.0);
	fragmentTextureCoordinate = vertexTextureCoordinate;
	fragmentColor = vertexColor;
}
`;

// 파티클 배치 프래그먼트 셰이더. (프리멀티플라이드 알파 출력)
const PARTICLE_FRAGMENTSHADER_SOURCE = `#version 300 es
precision highp float;
in vec2 fragmentTextureCoordinate;
in vec4 fragmentColor;
uniform sampler2D mainTexture;
uniform float globalAlpha;
uniform float textureLodBias;
out vec4 outputColor;
void main() {
	vec4 textureColor = texture(mainTexture, fragmentTextureCoordinate, textureLodBias);
	float finalAlpha = textureColor.a * fragmentColor.a * globalAlpha;
	vec3 finalColor = textureColor.rgb * fragmentColor.rgb * fragmentColor.a * globalAlpha;
	outputColor = vec4(finalColor, finalAlpha);
}
`;

// 스프라이트 묶어 그리기 버텍스 셰이더. (정점은 쌓을 때 이미 디바이스 픽셀 좌표로 바꿔 둔다)
const BATCH_VERTEXSHADER_SOURCE = `#version 300 es
in vec2 vertexPosition;
in vec2 vertexTextureCoordinate;
in vec4 vertexColor;
in vec4 vertexTintColor;
uniform mat3 projectionMatrix;
out vec2 fragmentTextureCoordinate;
out vec4 fragmentColor;
out vec4 fragmentTintColor;
void main() {
	vec3 transformedPosition = projectionMatrix * vec3(vertexPosition, 1.0);
	gl_Position = vec4(transformedPosition.xy, 0.0, 1.0);
	fragmentTextureCoordinate = vertexTextureCoordinate;
	fragmentColor = vertexColor;
	fragmentTintColor = vertexTintColor;
}
`;

// 스프라이트 묶어 그리기 프래그먼트 셰이더. (기본 셰이더와 같은 셈. 정점 색은 mainColor.rgb * mainColor.a * globalAlpha 와 mainColor.a * globalAlpha)
const BATCH_FRAGMENTSHADER_SOURCE = `#version 300 es
precision highp float;
in vec2 fragmentTextureCoordinate;
in vec4 fragmentColor;
in vec4 fragmentTintColor;
uniform sampler2D mainTexture;
uniform float textureLodBias;
out vec4 outputColor;
void main() {
	vec4 textureColor = texture(mainTexture, fragmentTextureCoordinate, textureLodBias);
	vec3 tintedColor = mix(textureColor.rgb, fragmentTintColor.rgb * textureColor.a, fragmentTintColor.a);
	outputColor = vec4(tintedColor * fragmentColor.rgb, textureColor.a * fragmentColor.a);
}
`;

// 셰이더 섞기 함수. (고정 블렌딩으로 안 되는 블렌드 모드에서 그릴 영역 아래와 섞는다, 러스트 판과 같은 글)
// - backdropTexture 는 그리기 직전에 지금 프레임버퍼에서 그릴 영역만 떠 온 것이다. (프레임버퍼와 같은 크기와 형식, 프리멀티플라이드)
// - 공식은 W3C Compositing and Blending Level 1 (https://www.w3.org/TR/compositing-1/, 2024-03-21 후보 권고안) 그대로다.
//   10.1 분리 섞기: multiply = Cb x Cs, overlay = HardLight(Cs, Cb), darken = min, lighten = max, color-dodge, color-burn, hard-light, soft-light (D(Cb) 포함), difference, exclusion.
//   10.2 비분리 섞기: hue, saturation, color, luminosity. (Lum = 0.3 R + 0.59 G + 0.11 B, ClipColor, SetLum, Sat, SetSat)
//   섞은 색은 범위로 자른다. (10 장 "The result of the mixing formula must be clamped")
// - 6 장 일반식대로 Cs' = (1 - αb) x Cs + αb x B(Cb, Cs) 로 섞은 색을 (Cs' x αs, αs) 로 내보내고,
//   그 뒤 source-over 합성 co = cs' + cb x (1 - αs) 는 고정 블렌딩(ONE, ONE_MINUS_SRC_ALPHA)이 한다.
// - blendModeIndex 는 SHADER_BLEND_MODE_INDEX_TABLE 의 번호다. multiply 는 렌더 타겟에 그릴 때만 MULTIPLY_SHADER_BLEND_MODE_INDEX 로 섞는다.
const BLEND_FUNCTION_SOURCE = `uniform highp sampler2D backdropTexture;
uniform int blendModeIndex;

float blendColorDodge(float backdropValue, float sourceValue) {
	if (backdropValue == 0.0) {
		return 0.0;
	}
	if (sourceValue == 1.0) {
		return 1.0;
	}
	return min(1.0, backdropValue / (1.0 - sourceValue));
}

float blendColorBurn(float backdropValue, float sourceValue) {
	if (backdropValue == 1.0) {
		return 1.0;
	}
	if (sourceValue == 0.0) {
		return 0.0;
	}
	return 1.0 - min(1.0, (1.0 - backdropValue) / sourceValue);
}

float blendHardLight(float backdropValue, float sourceValue) {
	if (sourceValue <= 0.5) {
		return backdropValue * 2.0 * sourceValue;
	}
	float screenValue = 2.0 * sourceValue - 1.0;
	return backdropValue + screenValue - backdropValue * screenValue;
}

float blendSoftLight(float backdropValue, float sourceValue) {
	if (sourceValue <= 0.5) {
		return backdropValue - (1.0 - 2.0 * sourceValue) * backdropValue * (1.0 - backdropValue);
	}
	float darkenedValue = sqrt(backdropValue);
	if (backdropValue <= 0.25) {
		darkenedValue = ((16.0 * backdropValue - 12.0) * backdropValue + 4.0) * backdropValue;
	}
	return backdropValue + (2.0 * sourceValue - 1.0) * (darkenedValue - backdropValue);
}

float getLuminosity(vec3 color) {
	return 0.3 * color.r + 0.59 * color.g + 0.11 * color.b;
}

vec3 clipColor(vec3 color) {
	float luminosity = getLuminosity(color);
	float minimumValue = min(min(color.r, color.g), color.b);
	float maximumValue = max(max(color.r, color.g), color.b);
	vec3 clippedColor = color;
	if (minimumValue < 0.0) {
		clippedColor = luminosity + (clippedColor - luminosity) * luminosity / (luminosity - minimumValue);
	}
	if (maximumValue > 1.0) {
		clippedColor = luminosity + (clippedColor - luminosity) * (1.0 - luminosity) / (maximumValue - luminosity);
	}
	return clippedColor;
}

vec3 setLuminosity(vec3 color, float luminosity) {
	float luminosityDelta = luminosity - getLuminosity(color);
	return clipColor(color + luminosityDelta);
}

float getSaturation(vec3 color) {
	return max(max(color.r, color.g), color.b) - min(min(color.r, color.g), color.b);
}

vec3 setSaturation(vec3 color, float saturation) {
	float minimumValue = min(min(color.r, color.g), color.b);
	float maximumValue = max(max(color.r, color.g), color.b);
	if (maximumValue > minimumValue) {
		return (color - minimumValue) * saturation / (maximumValue - minimumValue);
	}
	return vec3(0.0);
}

vec3 blendColors(vec3 backdropColor, vec3 sourceColor) {
	if (blendModeIndex == 1) {
		return min(backdropColor, sourceColor);
	}
	if (blendModeIndex == 2) {
		return max(backdropColor, sourceColor);
	}
	if (blendModeIndex == 3) {
		return vec3(blendHardLight(sourceColor.r, backdropColor.r), blendHardLight(sourceColor.g, backdropColor.g), blendHardLight(sourceColor.b, backdropColor.b));
	}
	if (blendModeIndex == 4) {
		return vec3(blendColorDodge(backdropColor.r, sourceColor.r), blendColorDodge(backdropColor.g, sourceColor.g), blendColorDodge(backdropColor.b, sourceColor.b));
	}
	if (blendModeIndex == 5) {
		return vec3(blendColorBurn(backdropColor.r, sourceColor.r), blendColorBurn(backdropColor.g, sourceColor.g), blendColorBurn(backdropColor.b, sourceColor.b));
	}
	if (blendModeIndex == 6) {
		return vec3(blendHardLight(backdropColor.r, sourceColor.r), blendHardLight(backdropColor.g, sourceColor.g), blendHardLight(backdropColor.b, sourceColor.b));
	}
	if (blendModeIndex == 7) {
		return vec3(blendSoftLight(backdropColor.r, sourceColor.r), blendSoftLight(backdropColor.g, sourceColor.g), blendSoftLight(backdropColor.b, sourceColor.b));
	}
	if (blendModeIndex == 8) {
		return abs(backdropColor - sourceColor);
	}
	if (blendModeIndex == 9) {
		return backdropColor + sourceColor - 2.0 * backdropColor * sourceColor;
	}
	if (blendModeIndex == 10) {
		return setLuminosity(setSaturation(sourceColor, getSaturation(backdropColor)), getLuminosity(backdropColor));
	}
	if (blendModeIndex == 11) {
		return setLuminosity(setSaturation(backdropColor, getSaturation(sourceColor)), getLuminosity(backdropColor));
	}
	if (blendModeIndex == 12) {
		return setLuminosity(sourceColor, getLuminosity(backdropColor));
	}
	if (blendModeIndex == 13) {
		return setLuminosity(backdropColor, getLuminosity(sourceColor));
	}
	if (blendModeIndex == 14) {
		return backdropColor * sourceColor;
	}
	return sourceColor;
}

vec4 blendWithBackdrop(vec4 sourceColor) {
	vec4 backdropColor = texelFetch(backdropTexture, ivec2(gl_FragCoord.xy), 0);
	float sourceAlpha = clamp(sourceColor.a, 0.0, 1.0);
	float backdropAlpha = clamp(backdropColor.a, 0.0, 1.0);
	vec3 straightSourceColor = vec3(0.0);
	if (sourceAlpha > 0.0) {
		straightSourceColor = clamp(sourceColor.rgb / sourceAlpha, 0.0, 1.0);
	}
	vec3 straightBackdropColor = vec3(0.0);
	if (backdropAlpha > 0.0) {
		straightBackdropColor = clamp(backdropColor.rgb / backdropAlpha, 0.0, 1.0);
	}
	vec3 mixedColor = clamp(blendColors(straightBackdropColor, straightSourceColor), 0.0, 1.0);
	vec3 blendedColor = (1.0 - backdropAlpha) * straightSourceColor + backdropAlpha * mixedColor;
	return vec4(blendedColor * sourceAlpha, sourceAlpha);
}
`;

// 셰이더 섞기 프래그먼트 셰이더. (기본 셰이더와 같은 색 셈 뒤 그릴 영역 아래와 섞는다)
const BLEND_FRAGMENTSHADER_SOURCE = `#version 300 es
precision highp float;
in vec2 fragmentTextureCoordinate;
uniform sampler2D mainTexture;
uniform vec4 mainColor;
uniform vec4 tintColor;
uniform float globalAlpha;
uniform float textureLodBias;
out vec4 outputColor;
${BLEND_FUNCTION_SOURCE}
void main() {
	vec4 textureColor = texture(mainTexture, fragmentTextureCoordinate, textureLodBias);
	vec3 tintedColor = mix(textureColor.rgb, tintColor.rgb * textureColor.a, tintColor.a);
	float finalAlpha = textureColor.a * mainColor.a * globalAlpha;
	vec3 finalColor = tintedColor * mainColor.rgb * mainColor.a * globalAlpha;
	outputColor = blendWithBackdrop(vec4(finalColor, finalAlpha));
}
`;

// 파티클 셰이더 섞기 프래그먼트 셰이더. (파티클 셰이더와 같은 색 셈 뒤 그릴 영역 아래와 섞는다)
const PARTICLE_BLEND_FRAGMENTSHADER_SOURCE = `#version 300 es
precision highp float;
in vec2 fragmentTextureCoordinate;
in vec4 fragmentColor;
uniform sampler2D mainTexture;
uniform float globalAlpha;
uniform float textureLodBias;
out vec4 outputColor;
${BLEND_FUNCTION_SOURCE}
void main() {
	vec4 textureColor = texture(mainTexture, fragmentTextureCoordinate, textureLodBias);
	float finalAlpha = textureColor.a * fragmentColor.a * globalAlpha;
	vec3 finalColor = textureColor.rgb * fragmentColor.rgb * fragmentColor.a * globalAlpha;
	outputColor = blendWithBackdrop(vec4(finalColor, finalAlpha));
}
`;

// 셰이더로 섞는 블렌드 모드와 그 번호. (BLEND_FUNCTION_SOURCE 의 blendModeIndex, 0 은 고정 블렌딩)
// - darken, lighten 도 셰이더로 섞는다. blendEquation MIN / MAX 는 계수 없이 min(cs, cb), max(cs, cb) 를 내는데,
//   W3C 식을 프리멀티플라이드로 풀면 darken 은 cs + cb - max(cs x αb, cb x αs), lighten 은 cs + cb - min(cs x αb, cb x αs) 라서 소스나 바탕이 반투명이면 같지 않다.
//   (불투명한 바탕 cb = 0.2 에 검정을 알파 0.5 로 그리면 W3C darken 은 0.1, MIN 은 0. 흰색을 알파 0.5 로 그리면 W3C lighten 은 0.6, MAX 는 0.5)
const SHADER_BLEND_MODE_INDEX_TABLE = new Map([
	["darken", 1],
	["lighten", 2],
	["overlay", 3],
	["color-dodge", 4],
	["color-burn", 5],
	["hard-light", 6],
	["soft-light", 7],
	["difference", 8],
	["exclusion", 9],
	["hue", 10],
	["saturation", 11],
	["color", 12],
	["luminosity", 13],
]);

// multiply 를 셰이더로 섞을 때의 번호. (BLEND_FUNCTION_SOURCE 의 blendModeIndex)
// - multiply 는 고정 블렌딩(DST_COLOR, ONE_MINUS_SRC_ALPHA)이 바탕이 불투명할 때만 W3C 식과 같다. 바탕 알파가 1 보다 작으면 cs x (1 - αb) 항이 빠지고
//   알파가 바탕 알파로 남는다. 기본 프레임버퍼(alpha: false)는 바탕 알파가 늘 1 이라 고정 블렌딩으로 그리고, 렌더 타겟에 그릴 때만 이 번호로 셰이더로 섞는다.
const MULTIPLY_SHADER_BLEND_MODE_INDEX = 14;

// 덧그림 칸을 비우는 색. (투명한 검정)
const TRANSPARENT_CLEAR_VALUE_LIST = new Float32Array([0, 0, 0, 0]);

// 셰이더 섞기로 파티클을 그릴 때 한 번에 그리는 쿼드 수 상한. (서로 겹치지 않는 쿼드끼리 한 번 떠 와 함께 그린다, 겹침을 따질 때 견주는 수)
const SHADER_BLEND_PARTICLE_GROUP_CAPACITY = 32;

const FLOATS_PER_VERTEX = 4;
const PARTICLE_FLOATS_PER_VERTEX = 8; // x, y, u, v, r, g, b, a
const PARTICLE_VERTEX_CAPACITY = 8192;
const BATCH_FLOATS_PER_VERTEX = 12; // x, y, u, v, r, g, b, a, tintR, tintG, tintB, tintA
const BATCH_VERTEX_CAPACITY = 16384;

// 스크래치 버텍스 버퍼 용량. (버텍스 수)
const VERTEX_CAPACITY = 4096;

// 라운드 사각형 / 원의 코너 아크 분할 수.
const CORNER_SEGMENT_COUNT = 8;

// 라운드 사각형 경로의 점 수. (코너 4개, 코너마다 분할 수 + 1)
const ROUND_RECT_POSITION_COUNT = 4 * (CORNER_SEGMENT_COUNT + 1);

// 라운드 사각형 경로의 점마다 단위 원의 cos / sin. (우상 → 우하 → 좌하 → 좌상 코너, 각도가 늘 같으므로 처음에 한 번만 구한다)
const ROUND_RECT_COSINE_TABLE = new System.Float64Array(ROUND_RECT_POSITION_COUNT);
const ROUND_RECT_SINE_TABLE = new System.Float64Array(ROUND_RECT_POSITION_COUNT);
const ROUND_RECT_CORNER_START_RADIAN_LIST = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
for (let cornerIndex = 0; cornerIndex < 4; ++cornerIndex) {
	const startRadian = ROUND_RECT_CORNER_START_RADIAN_LIST[cornerIndex];
	for (let segmentIndex = 0; segmentIndex <= CORNER_SEGMENT_COUNT; ++segmentIndex) {
		const positionIndex = cornerIndex * (CORNER_SEGMENT_COUNT + 1) + segmentIndex;
		const radian = startRadian + (Math.PI / 2) * (segmentIndex / CORNER_SEGMENT_COUNT);
		ROUND_RECT_COSINE_TABLE[positionIndex] = Math.cos(radian);
		ROUND_RECT_SINE_TABLE[positionIndex] = Math.sin(radian);
	}
}

// 라운드 사각형 경로 좌표를 적어 두고 고쳐 쓰는 칸. (x, y 차례)
const ROUND_RECT_POSITION_DATA = new System.Float64Array(ROUND_RECT_POSITION_COUNT * 2);

// 텍스트 베이크 스케일 상한. (과도한 확대 굽기 방지)
const MAXIMUM_TEXT_BAKE_SCALE = 8;
const DEFAULT_TEXT_BAKE_SCALE_STEP = 0.25;

// 오른쪽에서 왼쪽으로 쓰는 글자. (히브리, 아랍, 시리아, 타나, 은코, 사마리아, 만다 문자와 표시형, 보조 평면의 오른쪽에서 왼쪽 문자)
const RIGHT_TO_LEFT_CHARACTER_PATTERN = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF\u{10800}-\u{10FFF}\u{1E800}-\u{1EFFF}]/u;
// 방향이 강한 글자. (글자 갈래의 문자, 방향 표시 문자 LRM / RLM / ALM)
const STRONG_DIRECTION_CHARACTER_PATTERN = /[\p{L}\u200E\u200F\u061C]/u;


//==============================================================================
// 글의 첫 강한 방향. ("ltr" 또는 "rtl", 글자 갈래 문자와 LRM, RLM, ALM 가운데 처음 것, 없으면 "ltr". setTextDirection("auto") 가 쓴다)
//==============================================================================
/**
 * @param { string } text 볼 글. (비었으면 "ltr")
 * @returns { string } "ltr" 또는 "rtl".
 */
export function detectTextDirection(text) {
	if (!text) {
		return "ltr";
	}
	for (const character of text) {
		if (!STRONG_DIRECTION_CHARACTER_PATTERN.test(character)) {
			continue;
		}
		if (character === "\u200E") {
			return "ltr";
		}
		const isRightToLeft = RIGHT_TO_LEFT_CHARACTER_PATTERN.test(character) || character === "\u200F" || character === "\u061C";
		return isRightToLeft ? "rtl" : "ltr";
	}
	return "ltr";
}


//==============================================================================
// 색상 값을 Color 인스턴스로 변환.
// - Color / "#rrggbb(aa)" / "rgb(a)(...)" 지원. 그 외는 흰색.
//==============================================================================
/**
 * @param { Color | string } colorValue
 * @returns { Color }
 */
function parseColorValue(colorValue) {
	if (colorValue instanceof Color) {
		return colorValue.clone();
	}
	if (typeof colorValue === "string") {
		// 같은 문자열은 풀어 둔 색을 나눠 쓴다. (Graphic 은 받은 색을 고치지 않는다)
		return Color.fromCache(colorValue);
	}
	return Color.white();
}


//==============================================================================
// 그래픽.
// - Canvas 의 WebGL2 렌더링 컨텍스트를 통해 출력하는 렌더러.
// - Canvas2D 시절의 좌표계(좌상 원점, 픽셀 단위)와 상태 모델(변환/알파 스택)을
//   그대로 재현한다. 모든 드로우는 drawVertices() 한 지점으로 수렴한다.
//==============================================================================
/**
 * @example <caption>씬의 draw 에서 도형과 글 그리기</caption>
 * import { Engine, EngineConfiguration, Scene, Vector2, Rect } from "./build/vanilla.js";
 *
 * class MainScene extends Scene {
 * 	draw(graphic) {
 * 		super.draw(graphic);
 * 		graphic.setFillColor("#203040");
 * 		graphic.drawRoundRect(Rect.create(40, 40, 260, 160), 16);
 * 		graphic.setStrokeColor("#ffcc00");
 * 		graphic.drawStrokeCircle(Vector2.create(460, 120), 60, 4);
 * 		graphic.setFillColor("#ffffff");
 * 		graphic.setFontString("24px sans-serif");
 * 		graphic.setTextAlign("center");
 * 		graphic.setTextBaseline("middle");
 * 		graphic.drawFillText("Graphic", 170, 120);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
export class Graphic extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { HTMLCanvasElement } */ #canvas;
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { boolean } */ #isForceGizmosVisible;
	/** @private @type { boolean } */ #isImageSmoothingEnabled;
	/** @private @type { boolean } */ #isImageMipmapEnabled;
	/** @private @type { number } */ #imageMipmapBias;
	/** @private @type { string } */ #imageSmoothingQuality;
	/** @private @type { ShaderProgram } */ #shaderProgram;
	/** @private @type { ShaderProgram | null } */ #shaderProgramOverride; // 드로우에 잠시 바꿔 끼우는 프로그램. (ShaderSprite 등)
	/** @private @type { WebGLVertexArrayObject } */ #vertexArray;
	/** @private @type { WebGLBuffer } */ #vertexBuffer;
	/** @private @type { Float32Array } */ #vertexData;
	/** @private @type { WebGLTexture } */ #whiteTexture;
	/** @private @type { ShaderProgram | null } */ #particleShaderProgram; // 파티클 배치 전용. (지연 생성)
	/** @private @type { WebGLVertexArrayObject | null } */ #particleVertexArray;
	/** @private @type { WebGLBuffer | null } */ #particleVertexBuffer;
	/** @private @type { Float32Array | null } */ #particleVertexData;
	/** @private @type { WebGLTexture | null } */ #softDiscTexture; // 부드러운 원 스프라이트. (지연 생성)
	/** @private @type { boolean } */ #isSpriteBatchingEnabled; // 같은 텍스처의 연이은 드로우를 한 번에 그릴지.
	/** @private @type { ShaderProgram | null } */ #batchShaderProgram; // 묶어 그리기 전용. (지연 생성)
	/** @private @type { WebGLVertexArrayObject | null } */ #batchVertexArray;
	/** @private @type { WebGLBuffer | null } */ #batchVertexBuffer;
	/** @private @type { Float32Array | null } */ #batchVertexData;
	/** @private @type { number } */ #batchVertexCount; // 쌓여서 아직 그리지 않은 정점 수.
	/** @private @type { WebGLTexture | null } */ #batchTexture; // 쌓인 정점이 쓰는 텍스처.
	/** @private @type { ImageTextureCache } */ #imageTextureCache;
	/** @private @type { TextStringTextureCache } */ #textStringTextureCache;
	/** @private @type { TransformMatrix } */ #transformMatrix;
	/** @private @type { object[] } */ #stateStack;
	/** @private @type { object[] } */ #stateSnapshotPool; // 상태 저장 칸. (스택 깊이마다 하나씩 만들어 두고 고쳐 쓴다)
	/** @private @type { number } */ #globalAlpha;
	/** @private @type { string } */ #blendMode;
	/** @private @type { Map<string, number[]> } */ #blendFunctionTable;
	/** @private @type { Set<string> } */ #warnedBlendModes;
	/** @private @type { number } */ #shaderBlendModeIndex; // 지금 블렌드 모드의 셰이더 섞기 번호. (0 이면 고정 블렌딩)
	/** @private @type { ShaderProgram | null } */ #blendShaderProgram; // 셰이더 섞기 전용. (지연 생성)
	/** @private @type { ShaderProgram | null } */ #particleBlendShaderProgram; // 파티클 셰이더 섞기 전용. (지연 생성)
	/** @private @type { Map<number, object> } */ #backdropTargetTable; // 그릴 영역 아래를 떠 올 칸. (텍스처 형식 → { texture, framebuffer, width, height })
	/** @private @type { Map<WebGLFramebuffer | null, number> } */ #framebufferFormatTable; // 프레임버퍼마다 색 텍스처 형식. (프레임마다 잊는다)
	/** @private @type { object | null } */ #layerTarget; // 바꿔 끼운 셰이더로 먼저 그려 둘 칸. ({ texture, framebuffer, width, height }, 지연 생성)
	/** @private @type { object[] } */ #opacityLayerStack; // 열린 투명도 층. ({ target, previousFramebuffer, globalAlpha }, beginOpacityLayer 가 쌓는다)
	/** @private @type { object[] } */ #opacityLayerTargetPool; // 다 쓴 투명도 층 칸. ({ texture, framebuffer, stencilRenderbuffer, width, height }, 다시 쓴다)
	/** @private @type { object } */ #backdropRect; // 떠 올 영역. ({ x, y, width, height } GL 픽셀, 왼쪽 아래 원점, 고쳐 쓴다)
	/** @private @type { WebGLTexture | null } */ #boundBackdropTexture; // 1 번 텍스처 유닛에 마지막으로 묶은 텍스처. (null 이면 모른다)
	/** @private @type { boolean } */ #isStencilRecording; // 스텐실에 자르기 영역을 적는 중인지. (색을 쓰지 않으므로 섞지 않는다)
	/** @private @type { TransformMatrix } */ #identityTransformMatrix; // 덧그림 칸을 옮겨 그릴 때 쓰는 단위 행렬.
	/** @private @type { object[] } */ #particleGroupRectList; // 셰이더 섞기로 함께 그릴 파티클 쿼드의 영역. (SHADER_BLEND_PARTICLE_GROUP_CAPACITY 칸, 고쳐 쓴다)
	/** @private @type { Color } */ #fillColor;
	/** @private @type { Color } */ #strokeColor;
	/** @private @type { Color } */ #whiteColor;
	/** @private @type { Color | null } */ #imageTintColor;
	/** @private @type { string } */ #fontString;
	/** @private @type { string } */ #textAlign;
	/** @private @type { string } */ #textBaseline;
	/** @private @type { string } */ #textDirection;
	/** @private @type { object[] } */ #clipStack;
	/** @private @type { object[] } */ #clipEntryPool; // 클립 영역 칸. (클립 깊이마다 하나씩 만들어 두고 고쳐 쓴다)
	/** @private @type { Float32Array } */ #projectionMatrixArray;
	/** @private @type { Float32Array } */ #modelMatrixArray;
	/** @private @type { ShaderProgram | null } */ #uniformLocationProgram; // 아래 유니폼 자리를 찾아 둔 셰이더 프로그램.
	/** @private @type { WebGLUniformLocation | null } */ #modelMatrixLocation;
	/** @private @type { WebGLUniformLocation | null } */ #mainColorLocation;
	/** @private @type { WebGLUniformLocation | null } */ #tintColorLocation;
	/** @private @type { WebGLUniformLocation | null } */ #globalAlphaLocation;
	/** @private @type { boolean } */ #isUploadedUniformKnown; // 기본 프로그램에 마지막으로 올린 틴트와 전역 투명도를 알고 있는지.
	/** @private @type { number[] } */ #uploadedTintColorValueList; // 기본 프로그램에 마지막으로 올린 틴트. (r, g, b, a)
	/** @private @type { number } */ #uploadedGlobalAlpha; // 기본 프로그램에 마지막으로 올린 전역 투명도.
	/** @private @type { number } */ #appliedViewportWidth;
	/** @private @type { number } */ #appliedViewportHeight;
	/** @private @type { number } */ #textBakeScaleStep; // 텍스트 베이크 스케일 양자화 단위. (0 이면 양자화하지 않음)
	/** @private @type { number } */ #textBakeMotionScaleStep; // 배율이 움직이는 노드의 텍스트 베이크 스케일 양자화 단위. (textBakeScaleStep 이 0 일 때만 쓴다)
	/** @private @type { boolean } */ #isTextBakeScaleMoving; // 지금 그리는 노드의 배율이 지난 프레임과 달라 움직이는 중인지.
	/** @private @type { boolean } */ #isTextPixelSnapEnabled; // 텍스트 쿼드를 디바이스 픽셀 격자에 맞출지.
	/** @private @type { number } */ #drawCallCount; // 이번 프레임의 드로우 콜 수.
	/** @private @type { number } */ #drawVertexCount; // 이번 프레임에 그린 정점 수.
	/** @private @type { number } */ #lastFrameDrawCallCount; // 지난 프레임의 드로우 콜 수.
	/** @private @type { number } */ #lastFrameDrawVertexCount; // 지난 프레임에 그린 정점 수.
	/** @private @type { boolean } */ #isCullingEnabled; // 화면 밖 노드의 컴포넌트 그리기를 건너뛸지.
	/** @private @type { number } */ #culledNodeCount; // 이번 프레임에 화면 밖이라 컴포넌트를 건너뛴 노드 수.
	/** @private @type { number } */ #lastFrameCulledNodeCount; // 지난 프레임에 화면 밖이라 컴포넌트를 건너뛴 노드 수.
	/** @private @type { ShaderProgram | null } */ #boundShaderProgram; // 마지막으로 쓰게 한 셰이더 프로그램. (null 이면 모른다)
	/** @private @type { WebGLTexture | null } */ #boundTexture; // 0 번 텍스처 유닛에 마지막으로 묶은 텍스처. (null 이면 모른다)
	/** @private @type { WebGLStateCache } */ #webGLStateCache; // 컨텍스트의 GL 상태 기억. (getParameter, isEnabled 를 GL 에 묻지 않고 답한다)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { HTMLCanvasElement } canvas 그릴 캔버스. (WebGL2 컨텍스트를 얻지 못하면 오류를 던진다)
	 * @param { boolean } preserveDrawingBuffer 프레임이 끝난 뒤에도 그린 것을 캔버스에 남길지. (true 일 때만 남긴다)
	 * @param { boolean } [antialias] 캔버스의 멀티샘플 안티에일리어싱을 켤지. (기본 true, false 일 때만 끈다)
	 */
	constructor(canvas, preserveDrawingBuffer, antialias = true) {
		super();

		// preserveDrawingBuffer 를 켜면 프레임이 끝난 뒤에도 그린 것이 캔버스에 남는다.
		// 캔버스 위에 후처리를 얹는 프로젝트가 그 그림을 읽어 쓴다. (엔진 설정에서 켠다)
		// antialias 를 끄면 캔버스의 멀티샘플을 쓰지 않는다. (엔진 설정에서 끈다, 고해상도 모바일에서 리졸브 비용을 아낀다)
		const webGL2RenderingContext = canvas.getContext("webgl2", {
			alpha: false,
			stencil: true,
			antialias: antialias !== false,
			premultipliedAlpha: true,
			preserveDrawingBuffer: preserveDrawingBuffer === true,
		}); // WebGL2RenderingContext
		if (!webGL2RenderingContext) {
			throw new Error("WebGL2 Not Supported.");
		}

		this.#canvas = canvas;
		this.#webGL2RenderingContext = webGL2RenderingContext;
		// 그리는 중에 GL 상태를 읽지 않게 컨텍스트의 상태 함수를 가로채 기억한다. (다른 GL 호출보다 먼저 건다)
		this.#webGLStateCache = WebGLStateCache.attach(webGL2RenderingContext);
		this.#boundShaderProgram = null;
		this.#boundTexture = null;

		// 컨텍스트를 잃거나 되살리면 GL 의 묶음이 처음으로 돌아가므로 기억을 잊는다.
		const contextChangeCallback = () => {
			this.invalidateRenderStateCache();
		};
		canvas.addEventListener("webglcontextlost", contextChangeCallback);
		canvas.addEventListener("webglcontextrestored", contextChangeCallback);
		this.#isForceGizmosVisible = false;
		this.#isImageSmoothingEnabled = true;
		this.#isImageMipmapEnabled = false;
		this.#imageMipmapBias = 0;
		this.#imageSmoothingQuality = "high";

		// 셰이더 프로그램.
		this.#shaderProgram = new ShaderProgram(webGL2RenderingContext, VERTEXSHADER_SOURCE, FRAGMENTSHADER_SOURCE);
		this.#shaderProgramOverride = null;

		// 버텍스 어레이 / 버텍스 버퍼. (스트리밍, 인터리브 x/y/u/v)
		this.#vertexData = new Float32Array(VERTEX_CAPACITY * FLOATS_PER_VERTEX);
		this.#vertexArray = webGL2RenderingContext.createVertexArray();
		this.#vertexBuffer = webGL2RenderingContext.createBuffer();
		webGL2RenderingContext.bindVertexArray(this.#vertexArray);
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.#vertexBuffer);
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, this.#vertexData.byteLength, webGL2RenderingContext.DYNAMIC_DRAW);
		const shaderProgram = this.getShaderProgram();
		const vertexPositionLocation = shaderProgram.getAttributeLocation("vertexPosition");
		const vertexTextureCoordinateLocation = shaderProgram.getAttributeLocation("vertexTextureCoordinate");
		const strideBytes = FLOATS_PER_VERTEX * 4;
		webGL2RenderingContext.enableVertexAttribArray(vertexPositionLocation);
		webGL2RenderingContext.vertexAttribPointer(vertexPositionLocation, 2, webGL2RenderingContext.FLOAT, false, strideBytes, 0);
		webGL2RenderingContext.enableVertexAttribArray(vertexTextureCoordinateLocation);
		webGL2RenderingContext.vertexAttribPointer(vertexTextureCoordinateLocation, 2, webGL2RenderingContext.FLOAT, false, strideBytes, 8);
		webGL2RenderingContext.bindVertexArray(null);

		// 단색 도형용 1x1 흰색 텍스처.
		this.#whiteTexture = webGL2RenderingContext.createTexture();
		this.bindTexture(this.#whiteTexture);
		const whitePixel = new Uint8Array([255, 255, 255, 255]);
		webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.RGBA, 1, 1, 0, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, whitePixel);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, webGL2RenderingContext.NEAREST);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, webGL2RenderingContext.NEAREST);

		// 파티클 배치 자원. (처음 쓸 때 만든다)
		this.#particleShaderProgram = null;
		this.#particleVertexArray = null;
		this.#particleVertexBuffer = null;
		this.#particleVertexData = null;
		this.#softDiscTexture = null;

		// 묶어 그리기 자원. (켤 때 만든다)
		this.#isSpriteBatchingEnabled = false;
		this.#batchShaderProgram = null;
		this.#batchVertexArray = null;
		this.#batchVertexBuffer = null;
		this.#batchVertexData = null;
		this.#batchVertexCount = 0;
		this.#batchTexture = null;

		// 캐시. (캐시가 텍스처를 묶을 때도 이 Graphic 이 묶은 텍스처를 기억하게 묶는 함수를 넘긴다)
		const textureBinder = (texture) => {
			this.bindTexture(texture);
		};
		this.#imageTextureCache = new ImageTextureCache(webGL2RenderingContext, textureBinder);
		this.#textStringTextureCache = new TextStringTextureCache(webGL2RenderingContext, textureBinder);

		// 상태.
		this.#transformMatrix = new TransformMatrix();
		this.#stateStack = [];
		this.#stateSnapshotPool = [];
		this.#globalAlpha = 1.0;
		this.#blendMode = "source-over";
		this.#warnedBlendModes = new Set();
		this.#shaderBlendModeIndex = 0;
		this.#blendShaderProgram = null;
		this.#particleBlendShaderProgram = null;
		this.#backdropTargetTable = new Map();
		this.#framebufferFormatTable = new Map();
		this.#layerTarget = null;
		this.#opacityLayerStack = [];
		this.#opacityLayerTargetPool = [];
		this.#backdropRect = { x: 0, y: 0, width: 0, height: 0 };
		this.#boundBackdropTexture = null;
		this.#isStencilRecording = false;
		this.#identityTransformMatrix = new TransformMatrix();
		this.#particleGroupRectList = [];
		for (let rectIndex = 0; rectIndex < SHADER_BLEND_PARTICLE_GROUP_CAPACITY; ++rectIndex) {
			this.#particleGroupRectList.push({ x: 0, y: 0, width: 0, height: 0 });
		}
		this.#fillColor = Color.black();
		this.#strokeColor = Color.black();
		this.#whiteColor = Color.white();
		this.#imageTintColor = null;
		this.#fontString = "10px sans-serif";
		this.#textAlign = "start";
		this.#textDirection = "inherit";
		this.#textBaseline = "alphabetic";
		this.#clipStack = [];
		this.#clipEntryPool = [];
		this.#projectionMatrixArray = new Float32Array(9);
		this.#modelMatrixArray = new Float32Array(9);
		this.#uniformLocationProgram = null;
		this.#modelMatrixLocation = null;
		this.#mainColorLocation = null;
		this.#tintColorLocation = null;
		this.#globalAlphaLocation = null;
		this.#isUploadedUniformKnown = false;
		this.#uploadedTintColorValueList = [0, 0, 0, 0];
		this.#uploadedGlobalAlpha = 1.0;
		this.#appliedViewportWidth = 0;
		this.#appliedViewportHeight = 0;
		this.#textBakeScaleStep = DEFAULT_TEXT_BAKE_SCALE_STEP;
		this.#textBakeMotionScaleStep = DEFAULT_TEXT_BAKE_SCALE_STEP;
		this.#isTextBakeScaleMoving = false;
		this.#isTextPixelSnapEnabled = false;
		this.#drawCallCount = 0;
		this.#drawVertexCount = 0;
		this.#lastFrameDrawCallCount = 0;
		this.#lastFrameDrawVertexCount = 0;
		this.#isCullingEnabled = false;
		this.#culledNodeCount = 0;
		this.#lastFrameCulledNodeCount = 0;

		// 블렌드 함수 매핑 테이블. (프리멀티플라이드 알파 기준)
		// - 고정 블렌딩으로 재현 가능한 모드만 등록. 그 외(SHADER_BLEND_MODE_INDEX_TABLE)는 셰이더로 섞는다.
		// - 포터 더프 연산자는 W3C Compositing and Blending Level 1 의 9.1 장 Fa, Fb 를 그대로 계수로 쓴다. (co = cs x Fa + cb x Fb, 알파도 같은 계수라 blendFunc 하나로 된다)
		//   source-out: Fa = 1 - αb, Fb = 0 / source-atop: Fa = αb, Fb = 1 - αs / destination-atop: Fa = 1 - αb, Fb = αs / xor: Fa = 1 - αb, Fb = 1 - αs
		this.#blendFunctionTable = new Map([
			["source-over", [webGL2RenderingContext.ONE, webGL2RenderingContext.ONE_MINUS_SRC_ALPHA]],
			["lighter", [webGL2RenderingContext.ONE, webGL2RenderingContext.ONE]],
			["multiply", [webGL2RenderingContext.DST_COLOR, webGL2RenderingContext.ONE_MINUS_SRC_ALPHA]],
			["screen", [webGL2RenderingContext.ONE, webGL2RenderingContext.ONE_MINUS_SRC_COLOR]],
			["destination-over", [webGL2RenderingContext.ONE_MINUS_DST_ALPHA, webGL2RenderingContext.ONE]],
			["destination-out", [webGL2RenderingContext.ZERO, webGL2RenderingContext.ONE_MINUS_SRC_ALPHA]],
			["source-in", [webGL2RenderingContext.DST_ALPHA, webGL2RenderingContext.ZERO]],
			["destination-in", [webGL2RenderingContext.ZERO, webGL2RenderingContext.SRC_ALPHA]],
			["copy", [webGL2RenderingContext.ONE, webGL2RenderingContext.ZERO]],
			["source-out", [webGL2RenderingContext.ONE_MINUS_DST_ALPHA, webGL2RenderingContext.ZERO]],
			["source-atop", [webGL2RenderingContext.DST_ALPHA, webGL2RenderingContext.ONE_MINUS_SRC_ALPHA]],
			["destination-atop", [webGL2RenderingContext.ONE_MINUS_DST_ALPHA, webGL2RenderingContext.SRC_ALPHA]],
			["xor", [webGL2RenderingContext.ONE_MINUS_DST_ALPHA, webGL2RenderingContext.ONE_MINUS_SRC_ALPHA]],
		]);

		// 고정 렌더 상태.
		webGL2RenderingContext.enable(webGL2RenderingContext.BLEND);
		webGL2RenderingContext.blendFunc(webGL2RenderingContext.ONE, webGL2RenderingContext.ONE_MINUS_SRC_ALPHA);
		webGL2RenderingContext.disable(webGL2RenderingContext.DEPTH_TEST);
		webGL2RenderingContext.disable(webGL2RenderingContext.CULL_FACE);

		// 텍스처 유닛 고정.
		this.useShaderProgram(shaderProgram);
		const mainTextureLocation = shaderProgram.getUniformLocation("mainTexture");
		webGL2RenderingContext.uniform1i(mainTextureLocation, 0);
		this.applyImageMipmapBias(shaderProgram);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);

		// 묶어 그리기와 화면 밖 거르기는 기본으로 켠다. (지금 엔진을 쓰는 게임들이 묶어 그리기를 켜고 돌았고, 거르기는 내용 영역 안에만 그린다고 알린 컴포넌트만 거른다)
		this.setSpriteBatchingEnabled(true);
		this.setCullingEnabled(true);
	}

	//==============================================================================
	// 설정 반영. (매 프레임 시작 시 엔진이 호출)
	// - 캔버스 크기 변화 감지 및 뷰포트/프로젝션 갱신.
	// - 프레임 시작 기준 상태로 리셋.
	//==============================================================================
	/**
	 * @param { Engine } engine 엔진.
	 */
	applySettings(engine) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		this.#shaderProgramOverride = null;
		const shaderProgram = this.getShaderProgram();

		// 뷰포트/프로젝션 갱신.
		const drawingBufferWidth = webGL2RenderingContext.drawingBufferWidth;
		const drawingBufferHeight = webGL2RenderingContext.drawingBufferHeight;
		if (drawingBufferWidth !== this.#appliedViewportWidth || drawingBufferHeight !== this.#appliedViewportHeight) {
			webGL2RenderingContext.viewport(0, 0, drawingBufferWidth, drawingBufferHeight);
			this.#projectionMatrixArray[0] = 2 / drawingBufferWidth;
			this.#projectionMatrixArray[1] = 0;
			this.#projectionMatrixArray[2] = 0;
			this.#projectionMatrixArray[3] = 0;
			this.#projectionMatrixArray[4] = -2 / drawingBufferHeight;
			this.#projectionMatrixArray[5] = 0;
			this.#projectionMatrixArray[6] = -1;
			this.#projectionMatrixArray[7] = 1;
			this.#projectionMatrixArray[8] = 1;
			this.#appliedViewportWidth = drawingBufferWidth;
			this.#appliedViewportHeight = drawingBufferHeight;
		}

		// 프로그램/버퍼 바인딩 및 프로젝션 업로드.
		// 프레임 사이에 바깥 WebGL(3D 패스, 애셋 올리기 등)이 프로그램과 텍스처를 바꿨을 수 있으므로 기억을 잊고 시작한다.
		this.invalidateRenderStateCache();
		this.useShaderProgram(shaderProgram);
		webGL2RenderingContext.bindVertexArray(this.getVertexArray());
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.getVertexBuffer());
		const projectionMatrixLocation = shaderProgram.getUniformLocation("projectionMatrix");
		webGL2RenderingContext.uniformMatrix3fv(projectionMatrixLocation, false, this.#projectionMatrixArray);

		// 프레임 시작 기준 상태로 리셋.
		// 프레임버퍼의 색 형식은 프레임 사이에 렌더 타겟을 다시 만들었을 수 있어 잊는다.
		this.#stateStack.length = 0;
		this.#isUploadedUniformKnown = false;
		this.#framebufferFormatTable.clear();
		this.#transformMatrix.setIdentity();
		this.#globalAlpha = 1.0;
		this.#imageTintColor = null;
		this.setBlendMode("source-over");

		// 클리핑 상태 리셋. (비정상 종료로 스택이 남아 있어도 복구)
		if (this.#clipStack.length > 0) {
			this.#clipStack.length = 0;
			webGL2RenderingContext.disable(webGL2RenderingContext.STENCIL_TEST);
		}
		webGL2RenderingContext.clearStencil(0);
		webGL2RenderingContext.clear(webGL2RenderingContext.STENCIL_BUFFER_BIT);
	}

	//==============================================================================
	// 이미지 스무딩 활성화 여부 설정.
	// - 도트(픽셀) 스프라이트 게임은 false 로 설정해 선명하게 렌더링.
	//==============================================================================
	/**
	 * @param { boolean } value 참이면 이미지를 부드럽게(LINEAR), 거짓이면 또렷하게(NEAREST) 뽑는다.
	 */
	setImageSmoothingEnabled(value) {
		this.#isImageSmoothingEnabled = value;
	}

	//==============================================================================
	// 이미지 스무딩 활성화 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 이미지 스무딩이 켜졌으면 참.
	 */
	isImageSmoothingEnabled() {
		return this.#isImageSmoothingEnabled;
	}

	//==============================================================================
	// 이미지 밉맵 활성화 여부 설정. (기본 false)
	// - 켜면 스무딩이 켜진 이미지 텍스처에 밉맵을 만들고 축소 필터를 LINEAR_MIPMAP_LINEAR 로 한다.
	// - 큰 그림(아틀라스 등)을 크게 줄여 그릴 때 가장자리의 계단과 자글거림이 줄어든다.
	// - 아틀라스는 그림 둘레의 여백(늘여 붙인 가장자리)이 넉넉해야 작은 밉맵 단계에서 옆 그림이 번져 들지 않는다.
	//==============================================================================
	/**
	 * @param { boolean } value 이미지 밉맵을 켤지.
	 */
	setImageMipmapEnabled(value) {
		this.#isImageMipmapEnabled = value;
	}

	//==============================================================================
	// 이미지 밉맵 활성화 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 이미지 밉맵이 켜졌으면 참.
	 */
	isImageMipmapEnabled() {
		return this.#isImageMipmapEnabled;
	}

	//==============================================================================
	// 이미지 밉맵 단계 보정 설정. (기본 0)
	// - 밉맵 단계를 고를 때 더하는 값. 음수면 한 단계 큰 그림 쪽을 골라 또렷해지고, 너무 작으면 다시 자글거린다. (-0.5 안팎)
	// - 기본 셰이더(낱장, 묶어 그리기, 파티클)에 적용한다. 바꿔 끼운 셰이더는 textureLodBias 유니폼이 있으면 받는다.
	//==============================================================================
	/**
	 * @param { number } value 밉맵 단계에 더할 값. (음수면 또렷해진다)
	 */
	setImageMipmapBias(value) {
		this.flushSpriteBatch();
		this.#imageMipmapBias = value;
		const shaderPrograms = [this.#shaderProgram, this.#batchShaderProgram, this.#particleShaderProgram, this.#blendShaderProgram, this.#particleBlendShaderProgram, this.#shaderProgramOverride];
		for (const shaderProgram of shaderPrograms) {
			if (!shaderProgram) {
				continue;
			}
			this.useShaderProgram(shaderProgram);
			this.applyImageMipmapBias(shaderProgram);
		}
		const activeShaderProgram = this.getShaderProgram();
		this.useShaderProgram(activeShaderProgram);
	}

	//==============================================================================
	// 이미지 밉맵 단계 보정 반환.
	//==============================================================================
	/**
	 * @returns { number } 밉맵 단계 보정 값.
	 */
	getImageMipmapBias() {
		return this.#imageMipmapBias;
	}

	//==============================================================================
	// 사용 중인 셰이더 프로그램에 밉맵 단계 보정 적용. (유니폼이 없는 프로그램은 넘어간다)
	//==============================================================================
	/**
	 * @private
	 * @param { ShaderProgram } shaderProgram
	 */
	applyImageMipmapBias(shaderProgram) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const textureLodBiasLocation = shaderProgram.getUniformLocation("textureLodBias");
		if (textureLodBiasLocation === null) {
			return;
		}
		const imageMipmapBias = this.getImageMipmapBias();
		webGL2RenderingContext.uniform1f(textureLodBiasLocation, imageMipmapBias);
	}

	//==============================================================================
	// 이미지 스무딩 퀄리티 설정. ("low", "medium", "high")
	// - WebGL2 에서는 LINEAR/NEAREST 이분법이라 보관만 한다.
	//==============================================================================
	/**
	 * @param { string } value "low", "medium", "high" 가운데. (보관만 한다)
	 */
	setImageSmoothingQuality(value) {
		this.#imageSmoothingQuality = value;
	}

	//==============================================================================
	// 이미지 스무딩 퀄리티 반환. ("low", "medium", "high", 처음은 "high")
	//==============================================================================
	/**
	 * @returns { string } 이미지 스무딩 퀄리티.
	 */
	getImageSmoothingQuality() {
		return this.#imageSmoothingQuality;
	}

	//==============================================================================
	// 모든 기즈모 강제 표시 설정.
	//==============================================================================
	/**
	 * @param { boolean } isForceGizmosVisible 참이면 노드마다의 설정과 상관없이 모든 기즈모를 그린다.
	 */
	setForceGizmosVisible(isForceGizmosVisible) {
		this.#isForceGizmosVisible = isForceGizmosVisible;
	}

	//==============================================================================
	// 모든 기즈모 강제 표시 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 모든 기즈모를 강제로 그리면 참.
	 */
	isForceGizmosVisible() {
		return this.#isForceGizmosVisible;
	}

	//==============================================================================
	// 상태 저장. (변환/알파/블렌드/색상/폰트/틴트, Canvas2D save 대응)
	//==============================================================================
	/**
	 * @example <caption>상태를 저장하고 돌려 그리기</caption>
	 * import { Engine, EngineConfiguration, Scene, Vector2, Rect } from "./build/vanilla.js";
	 *
	 * class MainScene extends Scene {
	 * 	draw(graphic) {
	 * 		super.draw(graphic);
	 * 		graphic.pushState();
	 * 		graphic.translate(320, 180);
	 * 		graphic.rotate(Math.PI / 6);
	 * 		graphic.setGlobalAlpha(0.5);
	 * 		graphic.setFillColor("#ff6600");
	 * 		graphic.drawRect(Rect.create(-50, -50, 100, 100));
	 * 		graphic.popState();
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	pushState() {
		// 저장할 때마다 행렬 복제본과 상태 객체를 새로 만들지 않고, 스택 깊이마다 만들어 둔 칸에 적는다.
		const depth = this.#stateStack.length;
		let stateSnapshot = this.#stateSnapshotPool[depth];
		if (stateSnapshot === undefined) {
			stateSnapshot = {
				transformMatrix: null,
				matrixA: 1,
				matrixB: 0,
				matrixC: 0,
				matrixD: 1,
				matrixE: 0,
				matrixF: 0,
				globalAlpha: 1.0,
				blendMode: "",
				fillColor: null,
				strokeColor: null,
				imageTintColor: null,
				fontString: "",
				textAlign: "",
				textBaseline: "",
				textDirection: "",
			};
			this.#stateSnapshotPool.push(stateSnapshot);
		}

		// 행렬은 지금 행렬 객체와 그 값을 적는다. (복원할 때 이 객체에 값을 되돌려 적고 다시 지금 행렬로 삼는다)
		const transformMatrix = this.#transformMatrix;
		stateSnapshot.transformMatrix = transformMatrix;
		stateSnapshot.matrixA = transformMatrix.a;
		stateSnapshot.matrixB = transformMatrix.b;
		stateSnapshot.matrixC = transformMatrix.c;
		stateSnapshot.matrixD = transformMatrix.d;
		stateSnapshot.matrixE = transformMatrix.e;
		stateSnapshot.matrixF = transformMatrix.f;
		stateSnapshot.globalAlpha = this.#globalAlpha;
		stateSnapshot.blendMode = this.#blendMode;
		stateSnapshot.fillColor = this.#fillColor;
		stateSnapshot.strokeColor = this.#strokeColor;
		stateSnapshot.imageTintColor = this.#imageTintColor;
		stateSnapshot.fontString = this.#fontString;
		stateSnapshot.textAlign = this.#textAlign;
		stateSnapshot.textBaseline = this.#textBaseline;
		stateSnapshot.textDirection = this.#textDirection;
		this.#stateStack.push(stateSnapshot);
	}

	//==============================================================================
	// 상태 복원. (Canvas2D restore 대응)
	//==============================================================================
	popState() {
		const stateSnapshot = this.#stateStack.pop();
		if (!stateSnapshot) {
			return;
		}

		const transformMatrix = stateSnapshot.transformMatrix;
		transformMatrix.setTransform(stateSnapshot.matrixA, stateSnapshot.matrixB, stateSnapshot.matrixC, stateSnapshot.matrixD, stateSnapshot.matrixE, stateSnapshot.matrixF);
		this.#transformMatrix = transformMatrix;
		stateSnapshot.transformMatrix = null;
		this.#globalAlpha = stateSnapshot.globalAlpha;
		this.#fillColor = stateSnapshot.fillColor;
		this.#strokeColor = stateSnapshot.strokeColor;
		this.#imageTintColor = stateSnapshot.imageTintColor;
		this.#fontString = stateSnapshot.fontString;
		this.#textAlign = stateSnapshot.textAlign;
		this.#textBaseline = stateSnapshot.textBaseline;
		this.#textDirection = stateSnapshot.textDirection;
		if (this.#blendMode !== stateSnapshot.blendMode) {
			this.setBlendMode(stateSnapshot.blendMode);
		}
	}

	//==============================================================================
	// 이동 변환 누적.
	//==============================================================================
	/**
	 * @param { number } x X 이동량.
	 * @param { number } y Y 이동량.
	 */
	translate(x, y) {
		this.#transformMatrix.translate(x, y);
	}

	//==============================================================================
	// 회전 변환 누적.
	//==============================================================================
	/**
	 * @param { number } radian 회전각. (라디안, 양수면 화면에서 시계 방향)
	 */
	rotate(radian) {
		this.#transformMatrix.rotate(radian);
	}

	//==============================================================================
	// 크기 변환 누적.
	//==============================================================================
	/**
	 * @param { number } x X 배율.
	 * @param { number } y Y 배율.
	 */
	scale(x, y) {
		this.#transformMatrix.scale(x, y);
	}

	//==============================================================================
	// 변환 행렬 직접 설정. (Canvas2D setTransform(a, b, c, d, e, f) 대응)
	//==============================================================================
	/**
	 * @param { number } a 가로 배율. (x' = a x + c y + e)
	 * @param { number } b 세로 기울임. (y' = b x + d y + f)
	 * @param { number } c 가로 기울임. (x' = a x + c y + e)
	 * @param { number } d 세로 배율. (y' = b x + d y + f)
	 * @param { number } e 가로 이동. (x' = a x + c y + e)
	 * @param { number } f 세로 이동. (y' = b x + d y + f)
	 */
	setTransform(a, b, c, d, e, f) {
		this.#transformMatrix.setTransform(a, b, c, d, e, f);
	}

	//==============================================================================
	// 변환 행렬 초기화.
	//==============================================================================
	resetTransform() {
		this.#transformMatrix.setIdentity();
	}

	//==============================================================================
	// 현재 변환 행렬 반환.
	//==============================================================================
	/**
	 * @returns { TransformMatrix } 지금 변환 행렬. (Graphic 이 들고 고쳐 쓰므로 값을 남기려면 복제한다)
	 */
	getTransformMatrix() {
		return this.#transformMatrix;
	}

	//==============================================================================
	// 전역 투명도 설정.
	//==============================================================================
	/**
	 * @param { number } value 전역 투명도. (0 ~ 1 로 자른다)
	 */
	setGlobalAlpha(value) {
		this.#globalAlpha = Math.clamp01(value);
	}

	//==============================================================================
	// 전역 투명도 반환.
	//==============================================================================
	/**
	 * @returns { number } 전역 투명도. (0 ~ 1)
	 */
	getGlobalAlpha() {
		return this.#globalAlpha;
	}

	//==============================================================================
	// 전역 투명도 곱셈 누적. (노드 트리의 투명도 상속용)
	//==============================================================================
	/**
	 * @param { number } value 곱할 투명도. (곱한 값은 0 ~ 1 로 자른다)
	 */
	multiplyGlobalAlpha(value) {
		this.#globalAlpha = Math.clamp01(this.#globalAlpha * value);
	}

	//==============================================================================
	// 블렌드 모드 설정. (SpriteBlendMode 문자열 수용, Canvas2D globalCompositeOperation 26 가지)
	// - 고정 블렌딩으로 되는 13 가지(포터 더프 연산자, lighter, multiply, screen)는 blendFunc 로 건다.
	// - 나머지 13 가지(overlay, darken, lighten, color-dodge, color-burn, hard-light, soft-light, difference, exclusion, hue, saturation, color, luminosity)는
	//   그리기마다 그릴 영역 아래를 떠 와 셰이더로 섞는다. 이 모드에서는 묶어 그리지 않고, 그리기 하나에 영역 복사 한 번과 드로우 콜 한 번이 든다.
	//   (바꿔 끼운 셰이더로 그릴 때는 덧그림 칸에 먼저 그리고 옮기므로 드로우 콜이 두 번)
	// - multiply 는 렌더 타겟(프레임버퍼를 묶은 동안)에 그릴 때만 셰이더로 섞는다. (getDrawShaderBlendModeIndex)
	// - 모르는 이름은 source-over 로 그린다.
	//==============================================================================
	/**
	 * @param { string } blendMode 블렌드 모드. (Canvas2D globalCompositeOperation 이름, 모르는 이름은 한 번 경고하고 source-over 로 그린다)
	 * @example <caption>더하기 섞기로 빛 겹치기</caption>
	 * import { Engine, EngineConfiguration, Scene, Vector2 } from "./build/vanilla.js";
	 *
	 * class MainScene extends Scene {
	 * 	draw(graphic) {
	 * 		super.draw(graphic);
	 * 		graphic.setBlendMode("lighter");
	 * 		graphic.setFillColor("rgba(255, 80, 80, 0.8)");
	 * 		graphic.drawCircle(Vector2.create(280, 180), 80);
	 * 		graphic.setFillColor("rgba(80, 80, 255, 0.8)");
	 * 		graphic.drawCircle(Vector2.create(360, 180), 80);
	 * 		graphic.setBlendMode("source-over");
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 * @exampleImage blend-modes.webp
	 */
	setBlendMode(blendMode) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		let blendFunction = this.#blendFunctionTable.get(blendMode);
		let shaderBlendModeIndex = 0;
		if (!blendFunction) {
			if (SHADER_BLEND_MODE_INDEX_TABLE.has(blendMode)) {
				shaderBlendModeIndex = SHADER_BLEND_MODE_INDEX_TABLE.get(blendMode);
			}
			else if (!this.#warnedBlendModes.has(blendMode)) {
				this.#warnedBlendModes.add(blendMode);
				console.warn(`Graphic: unknown blend mode "${blendMode}", drawing with "source-over".`);
			}

			// 셰이더로 섞은 색은 source-over 로 합성한다.
			blendFunction = this.#blendFunctionTable.get("source-over");
		}

		// 블렌드가 바뀌면 그 전에 쌓인 것을 먼저 그린다.
		if (blendMode !== this.#blendMode) {
			this.flushSpriteBatch();
		}
		this.#blendMode = blendMode;
		this.#shaderBlendModeIndex = shaderBlendModeIndex;
		webGL2RenderingContext.blendFunc(blendFunction[0], blendFunction[1]);
	}

	//==============================================================================
	// 블렌드 모드 반환.
	//==============================================================================
	/**
	 * @returns { string } 블렌드 모드. (프레임마다 "source-over" 로 돌아간다)
	 */
	getBlendMode() {
		return this.#blendMode;
	}

	//==============================================================================
	// 이번 그리기의 셰이더 섞기 번호. (0 이면 고정 블렌딩)
	// - multiply 는 기본 프레임버퍼에서는 고정 블렌딩으로 그리고(묶어 그리기도 그대로), 렌더 타겟에 그릴 때만 셰이더로 섞는다. (MULTIPLY_SHADER_BLEND_MODE_INDEX)
	//==============================================================================
	/**
	 * @private
	 * @returns { number }
	 */
	getDrawShaderBlendModeIndex() {
		if (this.#blendMode !== "multiply") {
			return this.#shaderBlendModeIndex;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const framebuffer = webGL2RenderingContext.getParameter(webGL2RenderingContext.FRAMEBUFFER_BINDING);
		if (framebuffer === null) {
			return 0;
		}
		return MULTIPLY_SHADER_BLEND_MODE_INDEX;
	}

	//==============================================================================
	// 셰이더 섞기의 합성 계수로 바꾸거나 되돌리기. (셰이더로 섞은 색은 source-over 로 합성한다)
	// - 셰이더로만 섞는 13 가지는 setBlendMode 가 이미 source-over 계수를 걸어 두므로 그대로 둔다.
	//   multiply 는 고정 블렌딩 계수가 걸려 있어, 렌더 타겟에서 셰이더로 섞는 동안만 source-over 로 바꾸고(isShaderBlending 이 true) 다 그린 뒤 되돌린다.
	//==============================================================================
	/**
	 * @private
	 * @param { boolean } isShaderBlending
	 */
	applyShaderBlendCompositeFunction(isShaderBlending) {
		const blendMode = this.#blendMode;
		if (blendMode !== "multiply") {
			return;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const blendFunction = isShaderBlending ? this.#blendFunctionTable.get("source-over") : this.#blendFunctionTable.get(blendMode);
		webGL2RenderingContext.blendFunc(blendFunction[0], blendFunction[1]);
	}

	//==============================================================================
	// 이미지 틴트 색상 설정. (null 이면 해제)
	// - 이미지 실루엣(알파) 안쪽에만 tint.alpha 비율로 색을 덮는다.
	//==============================================================================
	/**
	 * @param { Color | null } color 틴트 색. (사본을 둔다, Color 가 아니면 해제)
	 */
	setImageTintColor(color) {
		if (color instanceof Color) {
			this.#imageTintColor = color.clone();
		}
		else {
			this.#imageTintColor = null;
		}
	}

	//==============================================================================
	// 이미지 틴트 색상 반환.
	//==============================================================================
	/**
	 * @returns { Color | null } 틴트 색. (없으면 null)
	 */
	getImageTintColor() {
		return this.#imageTintColor;
	}

	//==============================================================================
	// 색상 설정.
	//==============================================================================
	/**
	 * @param { Color | string } color 채우기 색. (Color 나 "#rrggbb(aa)", "rgb(a)(...)" 글, 거짓 값이면 바꾸지 않는다)
	 */
	setFillColor(color) {
		if (color) {
			this.#fillColor = parseColorValue(color);
		}
	}

	//==============================================================================
	// 채우기 색상 반환.
	//==============================================================================
	/**
	 * @returns { Color } 채우기 색. (처음은 검정)
	 */
	getFillColor() {
		return this.#fillColor;
	}

	//==============================================================================
	// 색상 설정.
	//==============================================================================
	/**
	 * @param { Color | string } color 선 색. (Color 나 "#rrggbb(aa)", "rgb(a)(...)" 글, 거짓 값이면 바꾸지 않는다)
	 */
	setStrokeColor(color) {
		if (color) {
			this.#strokeColor = parseColorValue(color);
		}
	}

	//==============================================================================
	// 선 색상 반환.
	//==============================================================================
	/**
	 * @returns { Color } 선 색. (처음은 검정)
	 */
	getStrokeColor() {
		return this.#strokeColor;
	}

	//==============================================================================
	// 버텍스 데이터에 쿼드(삼각형 2개, 버텍스 6개) 기록.
	// - 기록 후의 오프셋(플로트 단위)을 반환.
	//==============================================================================
	/**
	 * @param { number } offset 적기 시작할 자리. (플로트 단위)
	 * @param { number } leftX 왼쪽 X.
	 * @param { number } topY 위 Y.
	 * @param { number } rightX 오른쪽 X.
	 * @param { number } bottomY 아래 Y.
	 * @param { number } leftU 왼쪽 U. (0 ~ 1)
	 * @param { number } topV 위 V. (0 ~ 1)
	 * @param { number } rightU 오른쪽 U. (0 ~ 1)
	 * @param { number } bottomV 아래 V. (0 ~ 1)
	 * @returns { number } 적은 뒤의 자리. (플로트 단위, offset 에 24 를 더한 값)
	 */
	writeQuad(offset, leftX, topY, rightX, bottomY, leftU, topV, rightU, bottomV) {
		const vertexData = this.getVertexData();
		vertexData[offset++] = leftX;
		vertexData[offset++] = topY;
		vertexData[offset++] = leftU;
		vertexData[offset++] = topV;
		vertexData[offset++] = rightX;
		vertexData[offset++] = topY;
		vertexData[offset++] = rightU;
		vertexData[offset++] = topV;
		vertexData[offset++] = leftX;
		vertexData[offset++] = bottomY;
		vertexData[offset++] = leftU;
		vertexData[offset++] = bottomV;
		vertexData[offset++] = leftX;
		vertexData[offset++] = bottomY;
		vertexData[offset++] = leftU;
		vertexData[offset++] = bottomV;
		vertexData[offset++] = rightX;
		vertexData[offset++] = topY;
		vertexData[offset++] = rightU;
		vertexData[offset++] = topV;
		vertexData[offset++] = rightX;
		vertexData[offset++] = bottomY;
		vertexData[offset++] = rightU;
		vertexData[offset++] = bottomV;
		return offset;
	}

	//==============================================================================
	// 기록된 버텍스 출력. (모든 드로우가 수렴하는 단일 지점, 추후 배칭 삽입 지점)
	//==============================================================================
	/**
	 * @param { number } vertexCount 그릴 정점 수. (getVertexData 에 적은 것, 0 이하면 그리지 않는다)
	 * @param { WebGLTexture } texture 쓸 텍스처.
	 * @param { Color } color 곱할 색.
	 * @example <caption>정점을 직접 적어 그리기</caption>
	 * import { Engine, EngineConfiguration, Scene, Vector2, Color } from "./build/vanilla.js";
	 *
	 * class MainScene extends Scene {
	 * 	draw(graphic) {
	 * 		super.draw(graphic);
	 * 		const floatCount = graphic.writeQuad(0, 100, 100, 300, 200, 0, 0, 1, 1);
	 * 		const whiteTexture = graphic.getWhiteTexture();
	 * 		const color = Color.createFromHEX("#ff00ff");
	 * 		graphic.drawVertices(floatCount / 4, whiteTexture, color);
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	drawVertices(vertexCount, texture, color) {
		if (vertexCount <= 0) {
			return;
		}

		// 셰이더 섞기 모드는 그리기마다 그 아래를 떠 와 섞으므로 묶지 않는다. (스텐실에 자르기 영역을 적을 때는 색을 쓰지 않으므로 그냥 그린다)
		const shaderBlendModeIndex = this.#isStencilRecording ? 0 : this.getDrawShaderBlendModeIndex();
		const isShaderBlendDraw = shaderBlendModeIndex > 0;

		// 묶어 그리기가 켜져 있으면 쌓아 두었다가 텍스처나 상태가 바뀔 때 한 번에 그린다. (바꿔 끼운 셰이더는 제 유니폼을 쓰므로 바로 그린다)
		if (this.#isSpriteBatchingEnabled && this.#shaderProgramOverride === null && !isShaderBlendDraw && vertexCount <= BATCH_VERTEX_CAPACITY) {
			this.appendSpriteBatch(vertexCount, texture, color);
			return;
		}
		this.flushSpriteBatch();
		if (isShaderBlendDraw) {
			this.applyShaderBlendCompositeFunction(true);
			this.drawVerticesWithShaderBlend(vertexCount, texture, color, shaderBlendModeIndex);
			this.applyShaderBlendCompositeFunction(false);
			return;
		}

		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const shaderProgram = this.getShaderProgram();

		// 버텍스 업로드. bufferSubData 로 덮어쓰지 않고, 쓸 만큼만 새 저장소를 잡으며 올린다. (고아 처리)
		// 드로우 콜마다 같은 버퍼를 오프셋 0 부터 덮어쓰면 GPU 가 지난 콜의 데이터를 아직 읽는 중이라,
		// 사파리(ANGLE → Metal)는 콜마다 CPU 를 세워 GPU 가 끝나기를 기다린다. 드로우 콜 45, 정점 1000 남짓에도
		// 아이폰 10 fps, 맥 22 fps 가 나오고 크롬만 멀쩡한 증상이 이것이다. (크롬은 드라이버가 알아서 복사해 넘긴다)
		// bufferData 는 부를 때마다 새 저장소를 만들어 지난 콜과 겹치지 않고, 브라우저가 저장소를 돌려쓰므로 할당 비용은 작다.
		const vertexData = this.getVertexData();
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, vertexData, webGL2RenderingContext.DYNAMIC_DRAW, 0, vertexCount * FLOATS_PER_VERTEX);

		// 유니폼 업로드. (묶어 그리기와 파티클 그리기는 제 프로그램을 쓰고 되돌리지 않으므로, 여기서 이 프로그램을 쓰게 한다)
		this.useShaderProgram(shaderProgram);
		this.uploadDrawUniforms(shaderProgram, color);

		// 텍스처 바인드 및 출력.
		this.bindTexture(texture);
		webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLES, 0, vertexCount);
		this.#drawCallCount += 1;
		this.#drawVertexCount += vertexCount;
	}

	//==============================================================================
	// 기록된 버텍스를 셰이더 섞기로 출력. (drawVertices 가 셰이더 섞기 모드에서 부른다)
	// - 그릴 영역(정점의 경계 상자)만 지금 프레임버퍼에서 떠 온 뒤 섞기 셰이더로 그린다.
	// - 바꿔 끼운 셰이더(ShaderSprite 등)는 섞기 함수를 모르므로, 그 셰이더로 덧그림 칸에 먼저 그리고 그 칸을 섞기 셰이더로 옮긴다.
	//   덧그림 칸에는 스텐실이 없어 자르기는 옮겨 그릴 때 걸린다.
	//==============================================================================
	/**
	 * @private
	 * @param { number } vertexCount
	 * @param { WebGLTexture } texture
	 * @param { Color } color
	 * @param { number } shaderBlendModeIndex
	 */
	drawVerticesWithShaderBlend(vertexCount, texture, color, shaderBlendModeIndex) {
		const vertexData = this.getVertexData();
		const backdropRect = this.#backdropRect;
		const isVisible = this.measureBackdropRect(vertexData, FLOATS_PER_VERTEX, 0, vertexCount, backdropRect);
		if (!isVisible) {
			return;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const framebuffer = webGL2RenderingContext.getParameter(webGL2RenderingContext.FRAMEBUFFER_BINDING);
		this.copyBackdrop(framebuffer, backdropRect);
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, vertexData, webGL2RenderingContext.DYNAMIC_DRAW, 0, vertexCount * FLOATS_PER_VERTEX);

		const shaderProgramOverride = this.#shaderProgramOverride;
		if (shaderProgramOverride === null) {
			this.drawWithBlendShaderProgram(vertexCount, texture, color, shaderBlendModeIndex);
			return;
		}

		// 바꿔 끼운 셰이더로 덧그림 칸의 그릴 영역을 비우고 그린다.
		const layerTarget = this.ensureLayerTarget(framebuffer);
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, layerTarget.framebuffer);
		webGL2RenderingContext.enable(webGL2RenderingContext.SCISSOR_TEST);
		webGL2RenderingContext.scissor(backdropRect.x, backdropRect.y, backdropRect.width, backdropRect.height);
		webGL2RenderingContext.clearBufferfv(webGL2RenderingContext.COLOR, 0, TRANSPARENT_CLEAR_VALUE_LIST);
		webGL2RenderingContext.disable(webGL2RenderingContext.SCISSOR_TEST);
		this.useShaderProgram(shaderProgramOverride);
		this.uploadDrawUniforms(shaderProgramOverride, color);
		this.bindTexture(texture);
		webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLES, 0, vertexCount);
		this.#drawCallCount += 1;
		this.#drawVertexCount += vertexCount;
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, framebuffer);

		// 덧그림 칸의 그릴 영역을 단위 행렬, 흰색, 틴트 없이 섞어 옮긴다. (칸은 화면과 같은 크기라 디바이스 픽셀 그대로 짚는다)
		const viewportWidth = this.#appliedViewportWidth;
		const viewportHeight = this.#appliedViewportHeight;
		const leftX = backdropRect.x;
		const rightX = backdropRect.x + backdropRect.width;
		const topY = viewportHeight - (backdropRect.y + backdropRect.height);
		const bottomY = viewportHeight - backdropRect.y;
		const layerVertexCount = this.writeQuad(0, leftX, topY, rightX, bottomY, leftX / viewportWidth, (viewportHeight - topY) / viewportHeight, rightX / viewportWidth, (viewportHeight - bottomY) / viewportHeight) / FLOATS_PER_VERTEX;
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, vertexData, webGL2RenderingContext.DYNAMIC_DRAW, 0, layerVertexCount * FLOATS_PER_VERTEX);
		const transformMatrix = this.#transformMatrix;
		const globalAlpha = this.#globalAlpha;
		const imageTintColor = this.#imageTintColor;
		this.#transformMatrix = this.#identityTransformMatrix;
		this.#globalAlpha = 1.0;
		this.#imageTintColor = null;
		const whiteColor = this.getWhiteColor();
		this.drawWithBlendShaderProgram(layerVertexCount, layerTarget.texture, whiteColor, shaderBlendModeIndex);
		this.#transformMatrix = transformMatrix;
		this.#globalAlpha = globalAlpha;
		this.#imageTintColor = imageTintColor;
	}

	//==============================================================================
	// 올려 둔 버텍스를 섞기 셰이더로 그리기. (그릴 영역 아래는 이미 떠 와 1 번 유닛에 묶여 있다)
	//==============================================================================
	/**
	 * @private
	 * @param { number } vertexCount
	 * @param { WebGLTexture } texture
	 * @param { Color } color
	 * @param { number } shaderBlendModeIndex
	 */
	drawWithBlendShaderProgram(vertexCount, texture, color, shaderBlendModeIndex) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const blendShaderProgram = this.ensureBlendShaderProgram();
		this.useShaderProgram(blendShaderProgram);
		const projectionMatrixLocation = blendShaderProgram.getUniformLocation("projectionMatrix");
		webGL2RenderingContext.uniformMatrix3fv(projectionMatrixLocation, false, this.#projectionMatrixArray);
		const blendModeIndexLocation = blendShaderProgram.getUniformLocation("blendModeIndex");
		webGL2RenderingContext.uniform1i(blendModeIndexLocation, shaderBlendModeIndex);
		this.uploadDrawUniforms(blendShaderProgram, color);
		this.bindTexture(texture);
		webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLES, 0, vertexCount);
		this.#drawCallCount += 1;
		this.#drawVertexCount += vertexCount;
	}

	//==============================================================================
	// 정점들이 덮는 영역을 떠 올 영역으로 적기. (지금 변환으로 옮긴 경계 상자를 픽셀 경계로 넓히고 화면으로 자른다)
	// - 적는 영역은 GL 픽셀(왼쪽 아래 원점)이다. 화면에 걸치지 않으면 false.
	//==============================================================================
	/**
	 * @private
	 * @param { Float32Array } vertexData
	 * @param { number } floatsPerVertex
	 * @param { number } firstVertexIndex
	 * @param { number } vertexCount
	 * @param { object } backdropRect
	 * @returns { boolean }
	 */
	measureBackdropRect(vertexData, floatsPerVertex, firstVertexIndex, vertexCount, backdropRect) {
		const transformMatrix = this.#transformMatrix;
		const matrixA = transformMatrix.a;
		const matrixB = transformMatrix.b;
		const matrixC = transformMatrix.c;
		const matrixD = transformMatrix.d;
		const matrixE = transformMatrix.e;
		const matrixF = transformMatrix.f;
		let minimumX = System.Infinity;
		let minimumY = System.Infinity;
		let maximumX = -System.Infinity;
		let maximumY = -System.Infinity;
		let offset = firstVertexIndex * floatsPerVertex;
		for (let vertexIndex = 0; vertexIndex < vertexCount; ++vertexIndex) {
			const positionX = vertexData[offset];
			const positionY = vertexData[offset + 1];
			const deviceX = matrixA * positionX + matrixC * positionY + matrixE;
			const deviceY = matrixB * positionX + matrixD * positionY + matrixF;
			minimumX = System.Math.min(minimumX, deviceX);
			minimumY = System.Math.min(minimumY, deviceY);
			maximumX = System.Math.max(maximumX, deviceX);
			maximumY = System.Math.max(maximumY, deviceY);
			offset += floatsPerVertex;
		}
		const viewportWidth = this.#appliedViewportWidth;
		const viewportHeight = this.#appliedViewportHeight;
		const leftX = System.Math.max(0, System.Math.floor(minimumX));
		const topY = System.Math.max(0, System.Math.floor(minimumY));
		const rightX = System.Math.min(viewportWidth, System.Math.ceil(maximumX));
		const bottomY = System.Math.min(viewportHeight, System.Math.ceil(maximumY));
		if (!(rightX > leftX && bottomY > topY)) {
			return false;
		}
		backdropRect.x = leftX;
		backdropRect.y = viewportHeight - bottomY;
		backdropRect.width = rightX - leftX;
		backdropRect.height = bottomY - topY;
		return true;
	}

	//==============================================================================
	// 그릴 영역 아래 떠 오기. (지금 프레임버퍼의 그 영역을 같은 형식, 같은 자리의 칸에 blitFramebuffer 로 옮기고 1 번 유닛에 묶는다)
	// - 같은 자리로 옮기므로 멀티샘플 기본 프레임버퍼(안티에일리어싱)에서도 된다. copyTexSubImage2D 는 멀티샘플에서 안 된다.
	// - 렌더 타겟에 그리는 중이어도 그 색 텍스처를 바로 읽지 않고 떠 온다. 그리는 대상의 텍스처를 셰이더가 읽으면 피드백 루프라 WebGL 이 그리기를 막는다.
	//==============================================================================
	/**
	 * @private
	 * @param { WebGLFramebuffer | null } framebuffer
	 * @param { object } backdropRect
	 */
	copyBackdrop(framebuffer, backdropRect) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const backdropTarget = this.ensureBackdropTarget(framebuffer);
		const leftX = backdropRect.x;
		const bottomY = backdropRect.y;
		const rightX = backdropRect.x + backdropRect.width;
		const topY = backdropRect.y + backdropRect.height;
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.READ_FRAMEBUFFER, framebuffer);
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.DRAW_FRAMEBUFFER, backdropTarget.framebuffer);
		webGL2RenderingContext.blitFramebuffer(leftX, bottomY, rightX, topY, leftX, bottomY, rightX, topY, webGL2RenderingContext.COLOR_BUFFER_BIT, webGL2RenderingContext.NEAREST);
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, framebuffer);
		if (backdropTarget.texture !== this.#boundBackdropTexture) {
			webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE1);
			webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, backdropTarget.texture);
			webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
			this.#boundBackdropTexture = backdropTarget.texture;
		}
	}

	//==============================================================================
	// 프레임버퍼의 색 텍스처 형식 읽기. (기본 프레임버퍼는 alpha: false 라 RGB8, 렌더 타겟은 RGBA8 이나 실수 RGBA16F / RGBA32F)
	//==============================================================================
	/**
	 * @private
	 * @param { WebGLFramebuffer | null } framebuffer
	 * @returns { number }
	 */
	readFramebufferFormat(framebuffer) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const attachment = framebuffer === null ? webGL2RenderingContext.BACK : webGL2RenderingContext.COLOR_ATTACHMENT0;
		const componentType = webGL2RenderingContext.getFramebufferAttachmentParameter(webGL2RenderingContext.FRAMEBUFFER, attachment, webGL2RenderingContext.FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE);
		if (componentType === webGL2RenderingContext.FLOAT) {
			const redSize = webGL2RenderingContext.getFramebufferAttachmentParameter(webGL2RenderingContext.FRAMEBUFFER, attachment, webGL2RenderingContext.FRAMEBUFFER_ATTACHMENT_RED_SIZE);
			return redSize > 16 ? webGL2RenderingContext.RGBA32F : webGL2RenderingContext.RGBA16F;
		}
		const alphaSize = webGL2RenderingContext.getFramebufferAttachmentParameter(webGL2RenderingContext.FRAMEBUFFER, attachment, webGL2RenderingContext.FRAMEBUFFER_ATTACHMENT_ALPHA_SIZE);
		return alphaSize > 0 ? webGL2RenderingContext.RGBA8 : webGL2RenderingContext.RGB8;
	}

	//==============================================================================
	// 그릴 영역 아래를 떠 올 칸 준비. (지금 프레임버퍼와 같은 형식, 화면과 같은 크기. 형식마다 하나, 크기가 바뀌면 다시 만든다)
	//==============================================================================
	/**
	 * @private
	 * @param { WebGLFramebuffer | null } framebuffer
	 * @returns { object }
	 */
	ensureBackdropTarget(framebuffer) {
		let internalFormat = this.#framebufferFormatTable.get(framebuffer);
		if (internalFormat === undefined) {
			internalFormat = this.readFramebufferFormat(framebuffer);
			this.#framebufferFormatTable.set(framebuffer, internalFormat);
		}
		const viewportWidth = this.#appliedViewportWidth;
		const viewportHeight = this.#appliedViewportHeight;
		let backdropTarget = this.#backdropTargetTable.get(internalFormat);
		if (backdropTarget === undefined || backdropTarget.width !== viewportWidth || backdropTarget.height !== viewportHeight) {
			if (backdropTarget !== undefined) {
				this.destroyOffscreenTarget(backdropTarget);
			}
			backdropTarget = this.createOffscreenTarget(framebuffer, internalFormat, viewportWidth, viewportHeight);
			this.#backdropTargetTable.set(internalFormat, backdropTarget);
		}
		return backdropTarget;
	}

	//==============================================================================
	// 바꿔 끼운 셰이더로 먼저 그려 둘 덧그림 칸 준비. (화면과 같은 크기, 크기가 바뀌면 다시 만든다)
	// - 실수 색을 그릴 수 있으면(EXT_color_buffer_float) RGBA16F 로 만든다. RGBA8 이면 옮길 때 프리멀티플라이드를 되돌리며 알파가 작은 가장자리의 색이 8 비트로 뭉개져,
	//   color-dodge, color-burn, hue 처럼 나눗셈이 든 섞기가 바꿔 끼우지 않은 그리기와 15 단계까지 달라졌다. (RGBA16F 는 거의 2 단계 안)
	//==============================================================================
	/**
	 * @private
	 * @param { WebGLFramebuffer | null } framebuffer
	 * @returns { object }
	 */
	ensureLayerTarget(framebuffer) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const viewportWidth = this.#appliedViewportWidth;
		const viewportHeight = this.#appliedViewportHeight;
		let layerTarget = this.#layerTarget;
		if (layerTarget === null || layerTarget.width !== viewportWidth || layerTarget.height !== viewportHeight) {
			if (layerTarget !== null) {
				this.destroyOffscreenTarget(layerTarget);
			}
			const colorBufferFloatExtension = webGL2RenderingContext.getExtension("EXT_color_buffer_float");
			const internalFormat = colorBufferFloatExtension ? webGL2RenderingContext.RGBA16F : webGL2RenderingContext.RGBA8;
			layerTarget = this.createOffscreenTarget(framebuffer, internalFormat, viewportWidth, viewportHeight);
			this.#layerTarget = layerTarget;
		}
		return layerTarget;
	}

	//==============================================================================
	// 오프스크린 칸 만들기. (색 텍스처 하나를 붙인 프레임버퍼, 거르기 NEAREST. 만든 뒤 framebuffer 를 다시 묶는다)
	//==============================================================================
	/**
	 * @private
	 * @param { WebGLFramebuffer | null } framebuffer
	 * @param { number } internalFormat
	 * @param { number } width
	 * @param { number } height
	 * @returns { object }
	 */
	createOffscreenTarget(framebuffer, internalFormat, width, height) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		let pixelFormat = webGL2RenderingContext.RGBA;
		let pixelType = webGL2RenderingContext.UNSIGNED_BYTE;
		if (internalFormat === webGL2RenderingContext.RGB8) {
			pixelFormat = webGL2RenderingContext.RGB;
		}
		else if (internalFormat === webGL2RenderingContext.RGBA16F) {
			pixelType = webGL2RenderingContext.HALF_FLOAT;
		}
		else if (internalFormat === webGL2RenderingContext.RGBA32F) {
			pixelType = webGL2RenderingContext.FLOAT;
		}
		const texture = webGL2RenderingContext.createTexture();
		this.bindTexture(texture);
		webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, internalFormat, width, height, 0, pixelFormat, pixelType, null);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, webGL2RenderingContext.NEAREST);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, webGL2RenderingContext.NEAREST);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);
		const targetFramebuffer = webGL2RenderingContext.createFramebuffer();
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, targetFramebuffer);
		webGL2RenderingContext.framebufferTexture2D(webGL2RenderingContext.FRAMEBUFFER, webGL2RenderingContext.COLOR_ATTACHMENT0, webGL2RenderingContext.TEXTURE_2D, texture, 0);
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, framebuffer);
		return { texture: texture, framebuffer: targetFramebuffer, width: width, height: height };
	}

	//==============================================================================
	// 오프스크린 칸 지우기. (지운 텍스처를 묶었다고 기억하면 잊는다)
	//==============================================================================
	/**
	 * @private
	 * @param { object } offscreenTarget
	 */
	destroyOffscreenTarget(offscreenTarget) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		if (offscreenTarget.texture === this.#boundTexture) {
			this.#boundTexture = null;
		}
		if (offscreenTarget.texture === this.#boundBackdropTexture) {
			this.#boundBackdropTexture = null;
		}
		webGL2RenderingContext.deleteFramebuffer(offscreenTarget.framebuffer);
		webGL2RenderingContext.deleteTexture(offscreenTarget.texture);
	}

	//==============================================================================
	// 섞기 셰이더 프로그램 준비. (기본 버텍스 셰이더, 어트리뷰트 위치를 기본 프로그램과 같게 고정해 기본 버텍스 어레이를 같이 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @returns { ShaderProgram }
	 */
	ensureBlendShaderProgram() {
		if (this.#blendShaderProgram) {
			return this.#blendShaderProgram;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const shaderProgram = this.#shaderProgram;
		const attributeLocationTable = {
			vertexPosition: shaderProgram.getAttributeLocation("vertexPosition"),
			vertexTextureCoordinate: shaderProgram.getAttributeLocation("vertexTextureCoordinate"),
		};
		const blendShaderProgram = new ShaderProgram(webGL2RenderingContext, VERTEXSHADER_SOURCE, BLEND_FRAGMENTSHADER_SOURCE, attributeLocationTable);
		this.useShaderProgram(blendShaderProgram);
		this.applyBlendTextureUnits(blendShaderProgram);
		this.#blendShaderProgram = blendShaderProgram;
		return blendShaderProgram;
	}

	//==============================================================================
	// 파티클 섞기 셰이더 프로그램 준비. (파티클 버텍스 셰이더, 어트리뷰트 위치를 파티클 프로그램과 같게 고정해 파티클 버텍스 어레이를 같이 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @returns { ShaderProgram }
	 */
	ensureParticleBlendShaderProgram() {
		if (this.#particleBlendShaderProgram) {
			return this.#particleBlendShaderProgram;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const particleShaderProgram = this.#particleShaderProgram;
		const attributeLocationTable = {
			vertexPosition: particleShaderProgram.getAttributeLocation("vertexPosition"),
			vertexTextureCoordinate: particleShaderProgram.getAttributeLocation("vertexTextureCoordinate"),
			vertexColor: particleShaderProgram.getAttributeLocation("vertexColor"),
		};
		const particleBlendShaderProgram = new ShaderProgram(webGL2RenderingContext, PARTICLE_VERTEXSHADER_SOURCE, PARTICLE_BLEND_FRAGMENTSHADER_SOURCE, attributeLocationTable);
		this.useShaderProgram(particleBlendShaderProgram);
		this.applyBlendTextureUnits(particleBlendShaderProgram);
		this.#particleBlendShaderProgram = particleBlendShaderProgram;
		return particleBlendShaderProgram;
	}

	//==============================================================================
	// 사용 중인 섞기 셰이더 프로그램에 텍스처 유닛(그릴 그림 0 번, 떠 온 아래 1 번)과 밉맵 단계 보정 걸기.
	//==============================================================================
	/**
	 * @private
	 * @param { ShaderProgram } shaderProgram
	 */
	applyBlendTextureUnits(shaderProgram) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const mainTextureLocation = shaderProgram.getUniformLocation("mainTexture");
		webGL2RenderingContext.uniform1i(mainTextureLocation, 0);
		const backdropTextureLocation = shaderProgram.getUniformLocation("backdropTexture");
		webGL2RenderingContext.uniform1i(backdropTextureLocation, 1);
		this.applyImageMipmapBias(shaderProgram);
	}

	//==============================================================================
	// 드로우 콜 하나의 유니폼 업로드. (drawVertices 가 부른다)
	// - 유니폼 자리는 셰이더 프로그램이 바뀔 때만 다시 찾는다.
	// - 기본 프로그램의 틴트와 전역 투명도는 지난번에 올린 값과 같으면 다시 올리지 않는다. (프레임 시작과 프로그램이 바뀔 때 잊는다)
	// - 바꿔 끼운 셰이더 프로그램에는 늘 올린다.
	//==============================================================================
	/**
	 * @param { ShaderProgram } shaderProgram 올릴 셰이더 프로그램.
	 * @param { Color } color mainColor 로 올릴 색.
	 */
	uploadDrawUniforms(shaderProgram, color) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		if (shaderProgram !== this.#uniformLocationProgram) {
			this.#uniformLocationProgram = shaderProgram;
			this.#modelMatrixLocation = shaderProgram.getUniformLocation("modelMatrix");
			this.#mainColorLocation = shaderProgram.getUniformLocation("mainColor");
			this.#tintColorLocation = shaderProgram.getUniformLocation("tintColor");
			this.#globalAlphaLocation = shaderProgram.getUniformLocation("globalAlpha");
			this.#isUploadedUniformKnown = false;
		}

		this.#transformMatrix.writeToFloat32Array(this.#modelMatrixArray);
		webGL2RenderingContext.uniformMatrix3fv(this.#modelMatrixLocation, false, this.#modelMatrixArray);
		webGL2RenderingContext.uniform4f(this.#mainColorLocation, color.red, color.green, color.blue, color.alpha);

		// 틴트. (없으면 0, 0, 0, 0)
		const imageTintColor = this.getImageTintColor();
		let tintRed = 0;
		let tintGreen = 0;
		let tintBlue = 0;
		let tintAlpha = 0;
		if (imageTintColor) {
			tintRed = imageTintColor.red;
			tintGreen = imageTintColor.green;
			tintBlue = imageTintColor.blue;
			tintAlpha = imageTintColor.alpha;
		}
		const globalAlpha = this.getGlobalAlpha();

		const isDefaultProgram = shaderProgram === this.#shaderProgram;
		const isUploadedUniformKnown = isDefaultProgram && this.#isUploadedUniformKnown;
		const uploadedTintColorValueList = this.#uploadedTintColorValueList;
		const isSameTintColor = isUploadedUniformKnown && uploadedTintColorValueList[0] === tintRed && uploadedTintColorValueList[1] === tintGreen && uploadedTintColorValueList[2] === tintBlue && uploadedTintColorValueList[3] === tintAlpha;
		if (!isSameTintColor) {
			webGL2RenderingContext.uniform4f(this.#tintColorLocation, tintRed, tintGreen, tintBlue, tintAlpha);
		}
		const isSameGlobalAlpha = isUploadedUniformKnown && this.#uploadedGlobalAlpha === globalAlpha;
		if (!isSameGlobalAlpha) {
			webGL2RenderingContext.uniform1f(this.#globalAlphaLocation, globalAlpha);
		}

		if (isDefaultProgram) {
			uploadedTintColorValueList[0] = tintRed;
			uploadedTintColorValueList[1] = tintGreen;
			uploadedTintColorValueList[2] = tintBlue;
			uploadedTintColorValueList[3] = tintAlpha;
			this.#uploadedGlobalAlpha = globalAlpha;
			this.#isUploadedUniformKnown = true;
		}
	}

	//==============================================================================
	// 프레임 그리기 통계 시작.
	// - 엔진이 매 프레임 씬을 그리기 전에 부른다. 지난 프레임의 드로우 콜 / 정점 수를 넘겨 두고 이번 프레임 값을 비운다.
	// - 2D 경로(drawVertices, drawColoredQuads)만 센다. 3D 렌더러와 화면 효과 패스는 세지 않는다.
	//==============================================================================
	beginFrameStatistics() {
		this.#lastFrameDrawCallCount = this.#drawCallCount;
		this.#lastFrameDrawVertexCount = this.#drawVertexCount;
		this.#lastFrameCulledNodeCount = this.#culledNodeCount;
		this.#drawCallCount = 0;
		this.#drawVertexCount = 0;
		this.#culledNodeCount = 0;
	}

	//==============================================================================
	// 지난 프레임의 드로우 콜 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 지난 프레임의 드로우 콜 수.
	 */
	getLastFrameDrawCallCount() {
		return this.#lastFrameDrawCallCount;
	}

	//==============================================================================
	// 지난 프레임에 그린 정점 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 지난 프레임에 그린 정점 수.
	 */
	getLastFrameVertexCount() {
		return this.#lastFrameDrawVertexCount;
	}

	//==============================================================================
	// 지난 프레임에 그린 삼각형 수 반환. (모든 드로우 콜이 삼각형 목록이다)
	//==============================================================================
	/**
	 * @returns { number } 지난 프레임에 그린 삼각형 수.
	 */
	getLastFrameTriangleCount() {
		const lastFrameVertexCount = this.getLastFrameVertexCount();
		return System.Math.floor(lastFrameVertexCount / 3);
	}

	//==============================================================================
	// 화면 밖 거르기 설정. (기본 true)
	// - 켜면 WorldNode 가 컴포넌트를 그리기 전에, 켜진 컴포넌트가 모두 내용 영역 안에서만 그린다고 알리면(Component.isDrawnInsideContent)
	//   내용 영역이 화면 밖일 때 그 노드의 컴포넌트 그리기를 건너뛴다. 자식은 저마다 따로 보고 그대로 그린다.
	// - 판정은 그릴 때의 지금 변환(부모의 위치, 배율, 회전과 pushState 로 건 것 모두)으로 옮긴 영역의 경계 상자로 한다.
	// - 알리지 않는 컴포넌트(기본, 글자, 파티클, 직접 만든 컴포넌트)가 하나라도 켜져 있으면 그 노드는 거르지 않는다. draw 를 덮어쓴 노드도 거르지 않는다.
	//==============================================================================
	/**
	 * @param { boolean } isCullingEnabled 화면 밖 거르기를 켤지. (true 일 때만 켠다)
	 */
	setCullingEnabled(isCullingEnabled) {
		this.#isCullingEnabled = isCullingEnabled === true;
	}

	//==============================================================================
	// 화면 밖 거르기 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 화면 밖 거르기가 켜졌으면 참.
	 */
	isCullingEnabled() {
		return this.#isCullingEnabled;
	}

	//==============================================================================
	// 지금 변환으로 옮긴 사각형이 화면(드로잉 버퍼)에 걸치는지 반환. (네 꼭짓점을 옮긴 경계 상자로 본다)
	// - 투영과 같은 디바이스 픽셀 좌표로 보므로 클립 공간 밖인지와 같다. (뷰포트를 줄여 그려도 맞다)
	// - 뷰포트를 아직 정하지 않았으면(applySettings 전) 걸치는 것으로 본다.
	//==============================================================================
	/**
	 * @param { Rect } rect 지금 변환으로 옮기기 전의 사각형. (로컬 좌표)
	 * @returns { boolean } 화면에 걸치면 참.
	 */
	isLocalRectVisible(rect) {
		const viewportWidth = this.#appliedViewportWidth;
		const viewportHeight = this.#appliedViewportHeight;
		if (viewportWidth <= 0 || viewportHeight <= 0) {
			return true;
		}
		const transformMatrix = this.#transformMatrix;
		const matrixA = transformMatrix.a;
		const matrixB = transformMatrix.b;
		const matrixC = transformMatrix.c;
		const matrixD = transformMatrix.d;
		const matrixE = transformMatrix.e;
		const matrixF = transformMatrix.f;
		const leftX = rect.position.x;
		const topY = rect.position.y;
		const rightX = leftX + rect.size.x;
		const bottomY = topY + rect.size.y;

		// 네 꼭짓점. (왼쪽 위, 오른쪽 위, 왼쪽 아래, 오른쪽 아래)
		const leftTopX = matrixA * leftX + matrixC * topY + matrixE;
		const leftTopY = matrixB * leftX + matrixD * topY + matrixF;
		const rightTopX = matrixA * rightX + matrixC * topY + matrixE;
		const rightTopY = matrixB * rightX + matrixD * topY + matrixF;
		const leftBottomX = matrixA * leftX + matrixC * bottomY + matrixE;
		const leftBottomY = matrixB * leftX + matrixD * bottomY + matrixF;
		const rightBottomX = matrixA * rightX + matrixC * bottomY + matrixE;
		const rightBottomY = matrixB * rightX + matrixD * bottomY + matrixF;
		const minimumX = System.Math.min(leftTopX, rightTopX, leftBottomX, rightBottomX);
		const maximumX = System.Math.max(leftTopX, rightTopX, leftBottomX, rightBottomX);
		const minimumY = System.Math.min(leftTopY, rightTopY, leftBottomY, rightBottomY);
		const maximumY = System.Math.max(leftTopY, rightTopY, leftBottomY, rightBottomY);
		return maximumX >= 0 && maximumY >= 0 && minimumX <= viewportWidth && minimumY <= viewportHeight;
	}

	//==============================================================================
	// 이번 프레임에 화면 밖이라 컴포넌트를 건너뛴 노드 수 더하기. (WorldNode 가 부른다)
	//==============================================================================
	/**
	 * @param { number } culledNodeCount 더할 노드 수.
	 */
	addCulledNodeCount(culledNodeCount) {
		this.#culledNodeCount += culledNodeCount;
	}

	//==============================================================================
	// 지난 프레임에 화면 밖이라 컴포넌트를 건너뛴 노드 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 지난 프레임에 건너뛴 노드 수.
	 */
	getLastFrameCulledNodeCount() {
		return this.#lastFrameCulledNodeCount;
	}

	//==============================================================================
	// 스프라이트 묶어 그리기 설정.
	// - 켜면 같은 텍스처를 쓰는 연이은 드로우(이미지, 도형, 글자)를 정점에 변환과 색을 실어 쌓아 두었다가 한 번의 드로우 콜로 그린다.
	// - 텍스처, 블렌드, 클리핑, 바꿔 끼운 셰이더가 바뀌거나 버퍼가 차면 그때까지 쌓인 것을 그리고, 프레임 끝에 엔진이 남은 것을 그린다.
	// - 여러 그림을 한 장(아틀라스)에 모아 두면 드로우 콜이 크게 준다.
	// - 켠 채로 WebGL 을 직접 다루는 패스(외부 렌더러 등)를 끼울 때는 그 전에 flushSpriteBatch() 를 부른다.
	//==============================================================================
	/**
	 * @param { boolean } isSpriteBatchingEnabled 묶어 그리기를 켤지. (true 일 때만 켠다, 끄면 쌓인 것을 먼저 그린다)
	 */
	setSpriteBatchingEnabled(isSpriteBatchingEnabled) {
		if (!isSpriteBatchingEnabled) {
			this.flushSpriteBatch();
		}
		else {
			this.ensureSpriteBatchResources();
		}
		this.#isSpriteBatchingEnabled = isSpriteBatchingEnabled === true;
	}

	//==============================================================================
	// 스프라이트 묶어 그리기 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 묶어 그리기가 켜졌으면 참.
	 */
	isSpriteBatchingEnabled() {
		return this.#isSpriteBatchingEnabled;
	}

	//==============================================================================
	// 묶어 그리기 자원 준비. (셰이더 / 버텍스 어레이)
	//==============================================================================
	/**
	 * @private
	 */
	ensureSpriteBatchResources() {
		if (this.#batchShaderProgram) {
			return;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		this.#batchShaderProgram = new ShaderProgram(webGL2RenderingContext, BATCH_VERTEXSHADER_SOURCE, BATCH_FRAGMENTSHADER_SOURCE);
		this.#batchVertexData = new Float32Array(BATCH_VERTEX_CAPACITY * BATCH_FLOATS_PER_VERTEX);
		this.#batchVertexArray = webGL2RenderingContext.createVertexArray();
		this.#batchVertexBuffer = webGL2RenderingContext.createBuffer();
		webGL2RenderingContext.bindVertexArray(this.#batchVertexArray);
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.#batchVertexBuffer);
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, this.#batchVertexData.byteLength, webGL2RenderingContext.DYNAMIC_DRAW);
		const positionLocation = this.#batchShaderProgram.getAttributeLocation("vertexPosition");
		const textureCoordinateLocation = this.#batchShaderProgram.getAttributeLocation("vertexTextureCoordinate");
		const colorLocation = this.#batchShaderProgram.getAttributeLocation("vertexColor");
		const tintColorLocation = this.#batchShaderProgram.getAttributeLocation("vertexTintColor");
		const strideBytes = BATCH_FLOATS_PER_VERTEX * 4;
		webGL2RenderingContext.enableVertexAttribArray(positionLocation);
		webGL2RenderingContext.vertexAttribPointer(positionLocation, 2, webGL2RenderingContext.FLOAT, false, strideBytes, 0);
		webGL2RenderingContext.enableVertexAttribArray(textureCoordinateLocation);
		webGL2RenderingContext.vertexAttribPointer(textureCoordinateLocation, 2, webGL2RenderingContext.FLOAT, false, strideBytes, 8);
		webGL2RenderingContext.enableVertexAttribArray(colorLocation);
		webGL2RenderingContext.vertexAttribPointer(colorLocation, 4, webGL2RenderingContext.FLOAT, false, strideBytes, 16);
		webGL2RenderingContext.enableVertexAttribArray(tintColorLocation);
		webGL2RenderingContext.vertexAttribPointer(tintColorLocation, 4, webGL2RenderingContext.FLOAT, false, strideBytes, 32);
		webGL2RenderingContext.bindVertexArray(null);
		this.useShaderProgram(this.#batchShaderProgram);
		const mainTextureLocation = this.#batchShaderProgram.getUniformLocation("mainTexture");
		webGL2RenderingContext.uniform1i(mainTextureLocation, 0);
		this.applyImageMipmapBias(this.#batchShaderProgram);
		const activeShaderProgram = this.getShaderProgram();
		this.useShaderProgram(activeShaderProgram);
		webGL2RenderingContext.bindVertexArray(this.getVertexArray());
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.#vertexBuffer);
	}

	//==============================================================================
	// 스크래치 버텍스(x, y, u, v)를 묶음에 쌓기. (지금 변환으로 디바이스 좌표를 셈하고 색과 틴트를 정점마다 싣는다)
	//==============================================================================
	/**
	 * @private
	 * @param { number } vertexCount
	 * @param { WebGLTexture } texture
	 * @param { Color } color
	 */
	appendSpriteBatch(vertexCount, texture, color) {
		this.ensureSpriteBatchResources();
		if (texture !== this.#batchTexture || this.#batchVertexCount + vertexCount > BATCH_VERTEX_CAPACITY) {
			this.flushSpriteBatch();
			this.#batchTexture = texture;
		}

		// 기본 셰이더와 같은 색 셈을 정점 색 하나로 미리 곱해 둔다.
		const globalAlpha = this.getGlobalAlpha();
		const colorAlpha = color.alpha * globalAlpha;
		const colorRed = color.red * colorAlpha;
		const colorGreen = color.green * colorAlpha;
		const colorBlue = color.blue * colorAlpha;
		const imageTintColor = this.getImageTintColor();
		let tintRed = 0;
		let tintGreen = 0;
		let tintBlue = 0;
		let tintAlpha = 0;
		if (imageTintColor) {
			tintRed = imageTintColor.red;
			tintGreen = imageTintColor.green;
			tintBlue = imageTintColor.blue;
			tintAlpha = imageTintColor.alpha;
		}

		const transformMatrix = this.#transformMatrix;
		const matrixA = transformMatrix.a;
		const matrixB = transformMatrix.b;
		const matrixC = transformMatrix.c;
		const matrixD = transformMatrix.d;
		const matrixE = transformMatrix.e;
		const matrixF = transformMatrix.f;
		const vertexData = this.getVertexData();
		const batchVertexData = this.#batchVertexData;
		let sourceOffset = 0;
		let targetOffset = this.#batchVertexCount * BATCH_FLOATS_PER_VERTEX;
		for (let vertexIndex = 0; vertexIndex < vertexCount; ++vertexIndex) {
			const positionX = vertexData[sourceOffset];
			const positionY = vertexData[sourceOffset + 1];
			batchVertexData[targetOffset] = matrixA * positionX + matrixC * positionY + matrixE;
			batchVertexData[targetOffset + 1] = matrixB * positionX + matrixD * positionY + matrixF;
			batchVertexData[targetOffset + 2] = vertexData[sourceOffset + 2];
			batchVertexData[targetOffset + 3] = vertexData[sourceOffset + 3];
			batchVertexData[targetOffset + 4] = colorRed;
			batchVertexData[targetOffset + 5] = colorGreen;
			batchVertexData[targetOffset + 6] = colorBlue;
			batchVertexData[targetOffset + 7] = colorAlpha;
			batchVertexData[targetOffset + 8] = tintRed;
			batchVertexData[targetOffset + 9] = tintGreen;
			batchVertexData[targetOffset + 10] = tintBlue;
			batchVertexData[targetOffset + 11] = tintAlpha;
			sourceOffset += FLOATS_PER_VERTEX;
			targetOffset += BATCH_FLOATS_PER_VERTEX;
		}
		this.#batchVertexCount += vertexCount;
	}

	//==============================================================================
	// 쌓인 묶음 그리기. (쌓인 것이 없으면 아무것도 하지 않는다)
	//==============================================================================
	flushSpriteBatch() {
		const batchVertexCount = this.#batchVertexCount;
		if (batchVertexCount <= 0) {
			return;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();

		this.useShaderProgram(this.#batchShaderProgram);
		webGL2RenderingContext.bindVertexArray(this.#batchVertexArray);
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.#batchVertexBuffer);
		// drawVertices 와 같은 까닭으로 bufferSubData 대신 bufferData 로 새 저장소를 잡으며 올린다. (사파리 드로우 콜 동기 대기)
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, this.#batchVertexData, webGL2RenderingContext.DYNAMIC_DRAW, 0, batchVertexCount * BATCH_FLOATS_PER_VERTEX);
		const projectionMatrixLocation = this.#batchShaderProgram.getUniformLocation("projectionMatrix");
		webGL2RenderingContext.uniformMatrix3fv(projectionMatrixLocation, false, this.#projectionMatrixArray);
		this.bindTexture(this.#batchTexture);
		webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLES, 0, batchVertexCount);
		this.#drawCallCount += 1;
		this.#drawVertexCount += batchVertexCount;
		this.#batchVertexCount = 0;
		this.#batchTexture = null;

		// 기본 경로 상태 복원.
		// 셰이더 프로그램은 되돌리지 않는다. 다음에 그리는 쪽이 제 프로그램을 쓰게 해, 묶음을 잇달아 그릴 때 프로그램을 오가지 않는다.
		webGL2RenderingContext.bindVertexArray(this.getVertexArray());
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.#vertexBuffer);
	}

	//==============================================================================
	// 파티클 배치 자원 준비. (셰이더 / 버텍스 어레이 / 부드러운 원 텍스처)
	//==============================================================================
	/**
	 * @private
	 */
	ensureParticleBatchResources() {
		if (this.#particleShaderProgram) {
			return;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		this.#particleShaderProgram = new ShaderProgram(webGL2RenderingContext, PARTICLE_VERTEXSHADER_SOURCE, PARTICLE_FRAGMENTSHADER_SOURCE);
		this.#particleVertexData = new Float32Array(PARTICLE_VERTEX_CAPACITY * PARTICLE_FLOATS_PER_VERTEX);
		this.#particleVertexArray = webGL2RenderingContext.createVertexArray();
		this.#particleVertexBuffer = webGL2RenderingContext.createBuffer();
		webGL2RenderingContext.bindVertexArray(this.#particleVertexArray);
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.#particleVertexBuffer);
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, this.#particleVertexData.byteLength, webGL2RenderingContext.DYNAMIC_DRAW);
		const positionLocation = this.#particleShaderProgram.getAttributeLocation("vertexPosition");
		const textureCoordinateLocation = this.#particleShaderProgram.getAttributeLocation("vertexTextureCoordinate");
		const colorLocation = this.#particleShaderProgram.getAttributeLocation("vertexColor");
		const strideBytes = PARTICLE_FLOATS_PER_VERTEX * 4;
		webGL2RenderingContext.enableVertexAttribArray(positionLocation);
		webGL2RenderingContext.vertexAttribPointer(positionLocation, 2, webGL2RenderingContext.FLOAT, false, strideBytes, 0);
		webGL2RenderingContext.enableVertexAttribArray(textureCoordinateLocation);
		webGL2RenderingContext.vertexAttribPointer(textureCoordinateLocation, 2, webGL2RenderingContext.FLOAT, false, strideBytes, 8);
		webGL2RenderingContext.enableVertexAttribArray(colorLocation);
		webGL2RenderingContext.vertexAttribPointer(colorLocation, 4, webGL2RenderingContext.FLOAT, false, strideBytes, 16);
		webGL2RenderingContext.bindVertexArray(null);
		this.useShaderProgram(this.#particleShaderProgram);
		const mainTextureLocation = this.#particleShaderProgram.getUniformLocation("mainTexture");
		webGL2RenderingContext.uniform1i(mainTextureLocation, 0);
		this.applyImageMipmapBias(this.#particleShaderProgram);
		const activeShaderProgram = this.getShaderProgram();
		this.useShaderProgram(activeShaderProgram);
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.#vertexBuffer);
	}

	//==============================================================================
	// 파티클 배치 버텍스 배열 반환. (필요 시 증설, x, y, u, v, r, g, b, a 인터리브)
	//==============================================================================
	/**
	 * @param { number } minimumFloatCount 적어도 필요한 플로트 수. (모자라면 두 배씩 늘린다)
	 * @returns { Float32Array } 파티클 정점 배열. (정점마다 x, y, u, v, r, g, b, a, 늘리면 새 배열이다)
	 */
	getParticleVertexData(minimumFloatCount) {
		this.ensureParticleBatchResources();
		if (this.#particleVertexData.length < minimumFloatCount) {
			let nextLength = this.#particleVertexData.length;
			while (nextLength < minimumFloatCount) {
				nextLength *= 2;
			}
			this.#particleVertexData = new Float32Array(nextLength);
			const webGL2RenderingContext = this.getWebGL2RenderingContext();
			webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.#particleVertexBuffer);
			webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, this.#particleVertexData.byteLength, webGL2RenderingContext.DYNAMIC_DRAW);
			webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.#vertexBuffer);
		}
		return this.#particleVertexData;
	}

	//==============================================================================
	// 파티클 배치 출력. (getParticleVertexData 에 채운 정점을 한 번에 그린다)
	//==============================================================================
	/**
	 * @param { number } vertexCount 그릴 정점 수. (0 이하면 그리지 않는다)
	 * @param { WebGLTexture } texture 쓸 텍스처. (getSoftDiscTexture 같은)
	 * @example <caption>정점마다 색을 실은 쿼드 한 번에 그리기</caption>
	 * import { Engine, EngineConfiguration, Scene, Vector2 } from "./build/vanilla.js";
	 *
	 * const COLOR_LIST = [[1, 0.3, 0.3], [0.3, 1, 0.3], [0.3, 0.5, 1]];
	 * const CORNER_LIST = [[0, 0], [1, 0], [0, 1], [0, 1], [1, 0], [1, 1]];
	 *
	 * class MainScene extends Scene {
	 * 	draw(graphic) {
	 * 		super.draw(graphic);
	 * 		const quadCount = COLOR_LIST.length;
	 * 		const vertexData = graphic.getParticleVertexData(quadCount * 6 * 8);
	 * 		let offset = 0;
	 * 		for (let quadIndex = 0; quadIndex < quadCount; ++quadIndex) {
	 * 			const leftX = 120 + quadIndex * 150;
	 * 			const topY = 140;
	 * 			const size = 80;
	 * 			const color = COLOR_LIST[quadIndex];
	 * 			for (const corner of CORNER_LIST) {
	 * 				vertexData[offset++] = leftX + corner[0] * size;
	 * 				vertexData[offset++] = topY + corner[1] * size;
	 * 				vertexData[offset++] = corner[0];
	 * 				vertexData[offset++] = corner[1];
	 * 				vertexData[offset++] = color[0];
	 * 				vertexData[offset++] = color[1];
	 * 				vertexData[offset++] = color[2];
	 * 				vertexData[offset++] = 1;
	 * 			}
	 * 		}
	 * 		const softDiscTexture = graphic.getSoftDiscTexture();
	 * 		graphic.drawColoredQuads(quadCount * 6, softDiscTexture);
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	drawColoredQuads(vertexCount, texture) {
		if (vertexCount <= 0) {
			return;
		}
		this.flushSpriteBatch();
		this.ensureParticleBatchResources();
		const webGL2RenderingContext = this.getWebGL2RenderingContext();

		// 셰이더 섞기 모드는 섞기 프로그램으로 그린다.
		const shaderBlendModeIndex = this.getDrawShaderBlendModeIndex();
		const isShaderBlendDraw = shaderBlendModeIndex > 0;
		const particleShaderProgram = isShaderBlendDraw ? this.ensureParticleBlendShaderProgram() : this.#particleShaderProgram;
		this.useShaderProgram(particleShaderProgram);
		webGL2RenderingContext.bindVertexArray(this.#particleVertexArray);
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.#particleVertexBuffer);
		// drawVertices 와 같은 까닭으로 bufferSubData 대신 bufferData 로 새 저장소를 잡으며 올린다. (사파리 드로우 콜 동기 대기)
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, this.#particleVertexData, webGL2RenderingContext.DYNAMIC_DRAW, 0, vertexCount * PARTICLE_FLOATS_PER_VERTEX);

		const projectionMatrixLocation = particleShaderProgram.getUniformLocation("projectionMatrix");
		webGL2RenderingContext.uniformMatrix3fv(projectionMatrixLocation, false, this.#projectionMatrixArray);
		this.#transformMatrix.writeToFloat32Array(this.#modelMatrixArray);
		const modelMatrixLocation = particleShaderProgram.getUniformLocation("modelMatrix");
		webGL2RenderingContext.uniformMatrix3fv(modelMatrixLocation, false, this.#modelMatrixArray);
		const globalAlphaLocation = particleShaderProgram.getUniformLocation("globalAlpha");
		webGL2RenderingContext.uniform1f(globalAlphaLocation, this.getGlobalAlpha());

		if (isShaderBlendDraw) {
			const blendModeIndexLocation = particleShaderProgram.getUniformLocation("blendModeIndex");
			webGL2RenderingContext.uniform1i(blendModeIndexLocation, shaderBlendModeIndex);
			this.applyShaderBlendCompositeFunction(true);
			this.drawColoredQuadGroups(vertexCount, texture);
			this.applyShaderBlendCompositeFunction(false);
		}
		else {
			this.bindTexture(texture);
			webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLES, 0, vertexCount);
			this.#drawCallCount += 1;
			this.#drawVertexCount += vertexCount;
		}

		// 기본 경로 상태 복원.
		// 셰이더 프로그램은 되돌리지 않는다. (flushSpriteBatch 와 같다, 다음에 그리는 쪽이 제 프로그램을 쓰게 한다)
		webGL2RenderingContext.bindVertexArray(this.getVertexArray());
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.#vertexBuffer);
	}

	//==============================================================================
	// 올려 둔 파티클 쿼드를 셰이더 섞기로 그리기. (drawColoredQuads 가 섞기 프로그램을 쓰게 한 뒤 부른다)
	// - Canvas2D 처럼 쿼드마다 앞 쿼드가 그린 위에 섞이도록, 서로 겹치지 않는 쿼드를 앞에서부터 모아 그 영역을 한 번 떠 와 함께 그린다.
	//   모은 쿼드와 겹치는 쿼드가 나오거나 SHADER_BLEND_PARTICLE_GROUP_CAPACITY 개가 차면 거기서 끊는다. (모두 겹치면 쿼드 하나에 복사 한 번, 드로우 콜 한 번)
	//==============================================================================
	/**
	 * @private
	 * @param { number } vertexCount
	 * @param { WebGLTexture } texture
	 */
	drawColoredQuadGroups(vertexCount, texture) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const framebuffer = webGL2RenderingContext.getParameter(webGL2RenderingContext.FRAMEBUFFER_BINDING);
		const particleVertexData = this.#particleVertexData;
		const quadRect = this.#backdropRect;
		const groupRectList = this.#particleGroupRectList;
		const groupRect = { x: 0, y: 0, width: 0, height: 0 };
		const quadCount = System.Math.floor(vertexCount / 6);
		let groupStartQuadIndex = 0;
		let groupRectCount = 0;
		const drawGroup = (endQuadIndex) => {
			if (groupRectCount > 0) {
				// 떠 올 칸을 처음 만들 때 0 번 유닛을 쓰므로 그림은 떠 온 뒤에 묶는다.
				this.copyBackdrop(framebuffer, groupRect);
				this.bindTexture(texture);
				const groupVertexCount = (endQuadIndex - groupStartQuadIndex) * 6;
				webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLES, groupStartQuadIndex * 6, groupVertexCount);
				this.#drawCallCount += 1;
				this.#drawVertexCount += groupVertexCount;
			}
			groupStartQuadIndex = endQuadIndex;
			groupRectCount = 0;
		};
		for (let quadIndex = 0; quadIndex < quadCount; ++quadIndex) {
			const isVisible = this.measureBackdropRect(particleVertexData, PARTICLE_FLOATS_PER_VERTEX, quadIndex * 6, 6, quadRect);
			if (!isVisible) {
				continue;
			}
			let isOverlapped = groupRectCount >= SHADER_BLEND_PARTICLE_GROUP_CAPACITY;
			for (let rectIndex = 0; rectIndex < groupRectCount && !isOverlapped; ++rectIndex) {
				const rect = groupRectList[rectIndex];
				isOverlapped = quadRect.x < rect.x + rect.width && rect.x < quadRect.x + quadRect.width && quadRect.y < rect.y + rect.height && rect.y < quadRect.y + quadRect.height;
			}
			if (isOverlapped) {
				drawGroup(quadIndex);
			}

			// 영역을 모은다. (모은 영역 전체의 경계 상자를 떠 온다)
			const rect = groupRectList[groupRectCount];
			rect.x = quadRect.x;
			rect.y = quadRect.y;
			rect.width = quadRect.width;
			rect.height = quadRect.height;
			if (groupRectCount === 0) {
				groupRect.x = quadRect.x;
				groupRect.y = quadRect.y;
				groupRect.width = quadRect.width;
				groupRect.height = quadRect.height;
			}
			else {
				const leftX = System.Math.min(groupRect.x, quadRect.x);
				const bottomY = System.Math.min(groupRect.y, quadRect.y);
				const rightX = System.Math.max(groupRect.x + groupRect.width, quadRect.x + quadRect.width);
				const topY = System.Math.max(groupRect.y + groupRect.height, quadRect.y + quadRect.height);
				groupRect.x = leftX;
				groupRect.y = bottomY;
				groupRect.width = rightX - leftX;
				groupRect.height = topY - bottomY;
			}
			groupRectCount += 1;
		}
		drawGroup(quadCount);
	}

	//==============================================================================
	// 부드러운 원 텍스처 반환. (가장자리가 잦아드는 64x64 원, 파티클 기본 스프라이트)
	//==============================================================================
	/**
	 * @returns { WebGLTexture } 부드러운 원 텍스처. (처음 부를 때 만든다)
	 */
	getSoftDiscTexture() {
		if (this.#softDiscTexture) {
			return this.#softDiscTexture;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const textureSize = 64;
		const pixels = new System.Uint8Array(textureSize * textureSize * 4);
		const halfSize = textureSize * 0.5;
		for (let pixelY = 0; pixelY < textureSize; ++pixelY) {
			for (let pixelX = 0; pixelX < textureSize; ++pixelX) {
				const deltaX = (pixelX + 0.5 - halfSize) / halfSize;
				const deltaY = (pixelY + 0.5 - halfSize) / halfSize;
				const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

				// 중심은 꽉 차고 가장자리에서 부드럽게 사라진다.
				let alphaRatio = 1 - (distance - 0.7) / 0.3;
				alphaRatio = Math.max(0, Math.min(1, alphaRatio));
				alphaRatio = alphaRatio * alphaRatio * (3 - 2 * alphaRatio);
				const byteValue = Math.round(alphaRatio * 255);
				const pixelOffset = (pixelY * textureSize + pixelX) * 4;
				pixels[pixelOffset] = byteValue;
				pixels[pixelOffset + 1] = byteValue;
				pixels[pixelOffset + 2] = byteValue;
				pixels[pixelOffset + 3] = byteValue;
			}
		}
		this.#softDiscTexture = webGL2RenderingContext.createTexture();
		this.bindTexture(this.#softDiscTexture);
		webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.RGBA, textureSize, textureSize, 0, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, pixels);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, webGL2RenderingContext.LINEAR);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, webGL2RenderingContext.LINEAR);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);
		return this.#softDiscTexture;
	}

	//==============================================================================
	// 선 출력.
	// - setStrokeColor()
	//==============================================================================
	/**
	 * @param { Vector2[] } positions 선이 지날 점 목록. (2 개보다 적으면 그리지 않는다)
	 * @param { number } size 선 굵기. (기본 1)
	 */
	drawLine(positions, size = 1) {
		this.drawPolyline(positions, size, false);
	}

	//==============================================================================
	// 닫힌 선 출력. (마지막 점과 첫 점을 잇는 루프)
	// - setStrokeColor()
	//==============================================================================
	/**
	 * @param { Vector2[] } positions 선이 지날 점 목록. (2 개보다 적으면 그리지 않는다)
	 * @param { number } size 선 굵기. (기본 1)
	 */
	drawLineLoop(positions, size = 1) {
		this.drawPolyline(positions, size, true);
	}

	//==============================================================================
	// 폴리라인 출력. (세그먼트별 두께 확장 쿼드)
	// - 내부 조인트는 반두께 연장으로 이음새를 메운다.
	// - 정점 버퍼가 차면 쌓인 것을 그리고 비운 뒤 이어 적는다. (점이 많아도 선분을 버리지 않는다)
	//==============================================================================
	/**
	 * @param { Vector2[] } positions 선이 지날 점 목록. (2 개보다 적으면 그리지 않는다)
	 * @param { number } size 선 굵기.
	 * @param { boolean } isClosed 참이면 마지막 점과 첫 점을 잇는다.
	 */
	drawPolyline(positions, size, isClosed) {
		if (!positions || positions.length < 2) {
			return;
		}

		const halfSize = size / 2;
		const strokeColor = this.getStrokeColor();
		const whiteTexture = this.getWhiteTexture();
		const vertexData = this.getVertexData();
		const segmentCount = isClosed ? positions.length : positions.length - 1;
		let offset = 0;
		let vertexCount = 0;
		for (let segmentIndex = 0; segmentIndex < segmentCount; ++segmentIndex) {
			const startPosition = positions[segmentIndex];
			const endPosition = positions[(segmentIndex + 1) % positions.length];
			const deltaX = endPosition.x - startPosition.x;
			const deltaY = endPosition.y - startPosition.y;
			const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
			if (length <= 0) {
				continue;
			}

			const directionX = deltaX / length;
			const directionY = deltaY / length;
			const normalX = -directionY * halfSize;
			const normalY = directionX * halfSize;

			// 내부 조인트 이음새 메움. (열린 선의 양 끝은 연장하지 않음)
			const hasStartJoint = isClosed || segmentIndex > 0;
			const hasEndJoint = isClosed || segmentIndex < segmentCount - 1;
			const startExtension = hasStartJoint ? halfSize : 0;
			const endExtension = hasEndJoint ? halfSize : 0;
			const extendedStartX = startPosition.x - directionX * startExtension;
			const extendedStartY = startPosition.y - directionY * startExtension;
			const extendedEndX = endPosition.x + directionX * endExtension;
			const extendedEndY = endPosition.y + directionY * endExtension;

			// 쿼드(삼각형 2개) 기록.
			if ((vertexCount + 6) * FLOATS_PER_VERTEX > vertexData.length) {
				this.drawVertices(vertexCount, whiteTexture, strokeColor);
				offset = 0;
				vertexCount = 0;
			}
			vertexData[offset++] = extendedStartX + normalX;
			vertexData[offset++] = extendedStartY + normalY;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = extendedEndX + normalX;
			vertexData[offset++] = extendedEndY + normalY;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = extendedStartX - normalX;
			vertexData[offset++] = extendedStartY - normalY;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = extendedStartX - normalX;
			vertexData[offset++] = extendedStartY - normalY;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = extendedEndX + normalX;
			vertexData[offset++] = extendedEndY + normalY;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = extendedEndX - normalX;
			vertexData[offset++] = extendedEndY - normalY;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexCount += 6;
		}

		this.drawVertices(vertexCount, whiteTexture, strokeColor);
	}

	//==============================================================================
	// 사각형 출력.
	// - setFillColor()
	//==============================================================================
	/**
	 * @param { Rect } rect 칠할 사각형.
	 */
	drawRect(rect) {
		const leftX = rect.position.x;
		const topY = rect.position.y;
		const rightX = leftX + rect.size.x;
		const bottomY = topY + rect.size.y;
		const vertexCountOffset = this.writeQuad(0, leftX, topY, rightX, bottomY, 0.5, 0.5, 0.5, 0.5);
		const fillColor = this.getFillColor();
		this.drawVertices(vertexCountOffset / FLOATS_PER_VERTEX, this.getWhiteTexture(), fillColor);
	}

	//==============================================================================
	// 사각형 외곽선 출력. (Canvas2D strokeRect 대응, 선 중심이 경계선 위)
	// - setStrokeColor()
	//==============================================================================
	/**
	 * @param { Rect } rect 테를 그릴 사각형.
	 * @param { number } lineWidth 선 굵기. (기본 1)
	 */
	drawStrokeRect(rect, lineWidth = 1) {
		const leftX = rect.position.x;
		const topY = rect.position.y;
		const rightX = leftX + rect.size.x;
		const bottomY = topY + rect.size.y;
		const positions = [
			Vector2.create(leftX, topY),
			Vector2.create(rightX, topY),
			Vector2.create(rightX, bottomY),
			Vector2.create(leftX, bottomY),
		];
		this.drawLineLoop(positions, lineWidth);
	}

	//==============================================================================
	// 라운드 사각형 경로 좌표 목록 생성. (시계 방향, 볼록 다각형)
	//==============================================================================
	/**
	 * @param { Rect } rect 사각형.
	 * @param { number } roundSize 모서리 반지름. (짧은 변의 반을 넘으면 반으로 자른다)
	 * @returns { Vector2[] } 경로의 점 목록. (새 배열)
	 */
	buildRoundRectPositions(rect, roundSize) {
		this.writeRoundRectPositionData(rect, roundSize);
		const positions = [];
		for (let positionIndex = 0; positionIndex < ROUND_RECT_POSITION_COUNT; ++positionIndex) {
			const positionX = ROUND_RECT_POSITION_DATA[positionIndex * 2];
			const positionY = ROUND_RECT_POSITION_DATA[positionIndex * 2 + 1];
			positions.push(Vector2.create(positionX, positionY));
		}
		return positions;
	}

	//==============================================================================
	// 라운드 사각형 경로 좌표를 ROUND_RECT_POSITION_DATA 에 적는다. (시계 방향, 볼록 다각형, x, y 차례)
	// - 점마다의 cos / sin 은 처음에 구해 둔 표를 쓴다.
	//==============================================================================
	/**
	 * @param { Rect } rect 사각형.
	 * @param { number } roundSize 모서리 반지름. (짧은 변의 반을 넘으면 반으로 자른다)
	 */
	writeRoundRectPositionData(rect, roundSize) {
		const leftX = rect.position.x;
		const topY = rect.position.y;
		const rightX = leftX + rect.size.x;
		const bottomY = topY + rect.size.y;
		const clampedRoundSize = Math.min(roundSize, Math.min(Math.abs(rect.size.x), Math.abs(rect.size.y)) / 2);

		// 코너 중심 4개. (우상 → 우하 → 좌하 → 좌상)
		const rightCenterX = rightX - clampedRoundSize;
		const leftCenterX = leftX + clampedRoundSize;
		const topCenterY = topY + clampedRoundSize;
		const bottomCenterY = bottomY - clampedRoundSize;
		for (let cornerIndex = 0; cornerIndex < 4; ++cornerIndex) {
			let centerX = leftCenterX;
			if (cornerIndex < 2) {
				centerX = rightCenterX;
			}
			let centerY = topCenterY;
			if (cornerIndex === 1 || cornerIndex === 2) {
				centerY = bottomCenterY;
			}
			for (let segmentIndex = 0; segmentIndex <= CORNER_SEGMENT_COUNT; ++segmentIndex) {
				const positionIndex = cornerIndex * (CORNER_SEGMENT_COUNT + 1) + segmentIndex;
				ROUND_RECT_POSITION_DATA[positionIndex * 2] = centerX + ROUND_RECT_COSINE_TABLE[positionIndex] * clampedRoundSize;
				ROUND_RECT_POSITION_DATA[positionIndex * 2 + 1] = centerY + ROUND_RECT_SINE_TABLE[positionIndex] * clampedRoundSize;
			}
		}
	}

	//==============================================================================
	// 볼록 다각형 채움 출력. (첫 점 기준 팬 분할)
	// - 정점 버퍼가 차면 쌓인 삼각형을 그리고 비운 뒤 이어 적는다. (점이 많아도 삼각형을 버리지 않는다)
	//==============================================================================
	/**
	 * @param { Vector2[] } positions 볼록 다각형의 점 목록. (3 개보다 적으면 그리지 않는다)
	 * @param { Color } color 칠할 색.
	 */
	drawConvexPolygon(positions, color) {
		if (!positions || positions.length < 3) {
			return;
		}

		const whiteTexture = this.getWhiteTexture();
		const vertexData = this.getVertexData();
		let offset = 0;
		let vertexCount = 0;
		const firstPosition = positions[0];
		for (let positionIndex = 1; positionIndex < positions.length - 1; ++positionIndex) {
			if ((vertexCount + 3) * FLOATS_PER_VERTEX > vertexData.length) {
				this.drawVertices(vertexCount, whiteTexture, color);
				offset = 0;
				vertexCount = 0;
			}
			const secondPosition = positions[positionIndex];
			const thirdPosition = positions[positionIndex + 1];
			vertexData[offset++] = firstPosition.x;
			vertexData[offset++] = firstPosition.y;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = secondPosition.x;
			vertexData[offset++] = secondPosition.y;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = thirdPosition.x;
			vertexData[offset++] = thirdPosition.y;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexCount += 3;
		}

		this.drawVertices(vertexCount, whiteTexture, color);
	}

	//==============================================================================
	// 라운드 사각형 출력.
	// - setFillColor()
	//==============================================================================
	/**
	 * @param { Rect } rect 칠할 사각형.
	 * @param { number } roundSize 모서리 반지름. (0 이하면 각진 사각형, 짧은 변의 반을 넘으면 반으로 자른다)
	 */
	drawRoundRect(rect, roundSize) {
		if (roundSize > 0) {
			// 점 배열을 만들지 않고 적어 둔 좌표로 바로 그린다.
			this.writeRoundRectPositionData(rect, roundSize);
			const fillColor = this.getFillColor();
			this.drawRoundRectPositionData(fillColor);
		}
		else {
			this.drawRect(rect);
		}
	}

	//==============================================================================
	// ROUND_RECT_POSITION_DATA 에 적힌 라운드 사각형 채움 출력. (첫 점 기준 팬 분할, drawConvexPolygon 과 같은 삼각형)
	//==============================================================================
	/**
	 * @param { Color } color 칠할 색.
	 */
	drawRoundRectPositionData(color) {
		const vertexData = this.getVertexData();
		let offset = 0;
		let vertexCount = 0;
		const firstX = ROUND_RECT_POSITION_DATA[0];
		const firstY = ROUND_RECT_POSITION_DATA[1];
		for (let positionIndex = 1; positionIndex < ROUND_RECT_POSITION_COUNT - 1; ++positionIndex) {
			if ((vertexCount + 3) * FLOATS_PER_VERTEX > vertexData.length) {
				break;
			}
			vertexData[offset++] = firstX;
			vertexData[offset++] = firstY;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = ROUND_RECT_POSITION_DATA[positionIndex * 2];
			vertexData[offset++] = ROUND_RECT_POSITION_DATA[positionIndex * 2 + 1];
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = ROUND_RECT_POSITION_DATA[positionIndex * 2 + 2];
			vertexData[offset++] = ROUND_RECT_POSITION_DATA[positionIndex * 2 + 3];
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexCount += 3;
		}

		this.drawVertices(vertexCount, this.getWhiteTexture(), color);
	}

	//==============================================================================
	// 라운드 사각형 외곽선 출력.
	// - setStrokeColor()
	//==============================================================================
	/**
	 * @param { Rect } rect 테를 그릴 사각형.
	 * @param { number } roundSize 모서리 반지름. (0 이하면 각진 사각형, 짧은 변의 반을 넘으면 반으로 자른다)
	 * @param { number } lineWidth 선 굵기. (기본 1)
	 */
	drawStrokeRoundRect(rect, roundSize, lineWidth = 1) {
		if (roundSize > 0) {
			const positions = this.buildRoundRectPositions(rect, roundSize);
			this.drawLineLoop(positions, lineWidth);
		}
		else {
			this.drawStrokeRect(rect, lineWidth);
		}
	}

	//==============================================================================
	// 원 출력.
	// - setFillColor()
	//==============================================================================
	/**
	 * @param { Vector2 } center 가운데.
	 * @param { number } radius 반지름. (0 이하면 그리지 않는다)
	 */
	drawCircle(center, radius) {
		if (radius <= 0) {
			return;
		}

		// 화면상 크기에 비례한 분할 수. (16 ~ 64)
		const maximumScale = this.#transformMatrix.getMaximumScale();
		const segmentCount = Math.clamp(Math.ceil(radius * maximumScale * 0.5), 16, 64);
		const positions = [];
		for (let segmentIndex = 0; segmentIndex < segmentCount; ++segmentIndex) {
			const radian = (Math.PI * 2) * (segmentIndex / segmentCount);
			const positionX = center.x + Math.cos(radian) * radius;
			const positionY = center.y + Math.sin(radian) * radius;
			positions.push(Vector2.create(positionX, positionY));
		}

		const fillColor = this.getFillColor();
		this.drawConvexPolygon(positions, fillColor);
	}

	//==============================================================================
	// 원 외곽선 출력.
	// - setStrokeColor()
	//==============================================================================
	/**
	 * @param { Vector2 } center 가운데.
	 * @param { number } radius 반지름. (0 이하면 그리지 않는다)
	 * @param { number } lineWidth 선 굵기. (기본 1)
	 */
	drawStrokeCircle(center, radius, lineWidth = 1) {
		if (radius <= 0) {
			return;
		}

		// 화면상 크기에 비례한 분할 수. (16 ~ 64)
		const maximumScale = this.#transformMatrix.getMaximumScale();
		const segmentCount = Math.clamp(Math.ceil(radius * maximumScale * 0.5), 16, 64);
		const positions = [];
		for (let segmentIndex = 0; segmentIndex < segmentCount; ++segmentIndex) {
			const radian = (Math.PI * 2) * (segmentIndex / segmentCount);
			const positionX = center.x + Math.cos(radian) * radius;
			const positionY = center.y + Math.sin(radian) * radius;
			positions.push(Vector2.create(positionX, positionY));
		}

		this.drawLineLoop(positions, lineWidth);
	}

	//==============================================================================
	// 고리(띠) 출력. (안쪽 반지름과 바깥 반지름 사이를 startRadian 부터 endRadian 까지 칠한다)
	// - setFillColor()
	// - 각도는 라디안, 0 이 오른쪽이고 화면에서 시계 방향으로 는다. (12 시에서 시작하려면 -PI / 2)
	// - 조각마다 네모 하나를 겹치지 않게 이어 붙여 한 번에 그리므로, 반투명 색이어도 조각의 이음매가 짙어지지 않는다.
	// - 조각 수는 drawCircle 처럼 화면에서의 바깥 반지름을 따라 정하고(한 바퀴 16 ~ 64), 그리는 각도만큼만 쓴다.
	//==============================================================================
	/**
	 * @param { Vector2 } center 가운데.
	 * @param { number } innerRadius 안쪽 반지름.
	 * @param { number } outerRadius 바깥 반지름. (0 이하이거나 안쪽 반지름 이하면 그리지 않는다)
	 * @param { number } startRadian 기본 0.
	 * @param { number } endRadian 기본 PI * 2.
	 * @example <caption>12 시부터 시계 방향으로 고리 채우기</caption>
	 * import { Engine, EngineConfiguration, Scene, Vector2 } from "./build/vanilla.js";
	 *
	 * class MainScene extends Scene {
	 * 	draw(graphic) {
	 * 		super.draw(graphic);
	 * 		const center = Vector2.create(320, 180);
	 * 		const progress = 0.7;
	 * 		const startRadian = -Math.PI / 2;
	 * 		graphic.setFillColor("#44dd88");
	 * 		graphic.drawRing(center, 50, 70, startRadian, startRadian + Math.PI * 2 * progress);
	 * 		graphic.setStrokeColor("#ffffff");
	 * 		graphic.drawArc(center, 90, startRadian, startRadian + Math.PI, 3);
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	drawRing(center, innerRadius, outerRadius, startRadian = 0, endRadian = Math.PI * 2) {
		const fillColor = this.getFillColor();
		this.drawRingWithColor(center.x, center.y, innerRadius, outerRadius, startRadian, endRadian, fillColor);
	}

	//==============================================================================
	// 호 출력. (반지름을 따라 lineWidth 두께의 선으로 startRadian 부터 endRadian 까지)
	// - setStrokeColor()
	// - 각도와 조각 수는 drawRing 과 같다. 선의 두께 가운데가 반지름에 온다.
	//==============================================================================
	/**
	 * @param { Vector2 } center 가운데.
	 * @param { number } radius 반지름. (선 굵기의 가운데)
	 * @param { number } startRadian 시작 각. (라디안)
	 * @param { number } endRadian 끝 각. (라디안)
	 * @param { number } lineWidth 기본 1.
	 */
	drawArc(center, radius, startRadian, endRadian, lineWidth = 1) {
		const halfWidth = lineWidth * 0.5;
		const strokeColor = this.getStrokeColor();
		this.drawRingWithColor(center.x, center.y, System.Math.max(0, radius - halfWidth), radius + halfWidth, startRadian, endRadian, strokeColor);
	}

	//==============================================================================
	// 고리 출력의 셈. (drawRing, drawArc 가 부른다)
	//==============================================================================
	/**
	 * @param { number } centerX 가운데 X.
	 * @param { number } centerY 가운데 Y.
	 * @param { number } innerRadius 안쪽 반지름.
	 * @param { number } outerRadius 바깥 반지름. (0 이하이거나 안쪽 반지름 이하면 그리지 않는다)
	 * @param { number } startRadian 시작 각. (라디안)
	 * @param { number } endRadian 끝 각. (라디안, 시작 각과 같으면 그리지 않는다, 한 바퀴를 넘으면 한 바퀴로 자른다)
	 * @param { Color } color 칠할 색.
	 */
	drawRingWithColor(centerX, centerY, innerRadius, outerRadius, startRadian, endRadian, color) {
		const spanRadian = endRadian - startRadian;
		if (outerRadius <= 0 || outerRadius <= innerRadius || spanRadian === 0) {
			return;
		}
		const fullRadian = Math.PI * 2;
		const clampedSpanRadian = Math.clamp(spanRadian, -fullRadian, fullRadian);
		const maximumScale = this.#transformMatrix.getMaximumScale();
		const fullSegmentCount = Math.clamp(Math.ceil(outerRadius * maximumScale * 0.5), 16, 64);
		const segmentCount = System.Math.max(1, Math.ceil(fullSegmentCount * System.Math.abs(clampedSpanRadian) / fullRadian));
		const vertexData = this.getVertexData();
		let offset = 0;
		let vertexCount = 0;
		let previousCosine = System.Math.cos(startRadian);
		let previousSine = System.Math.sin(startRadian);
		for (let segmentIndex = 1; segmentIndex <= segmentCount; ++segmentIndex) {
			if ((vertexCount + 6) * FLOATS_PER_VERTEX > vertexData.length) {
				break;
			}
			const radian = startRadian + clampedSpanRadian * (segmentIndex / segmentCount);
			const cosine = System.Math.cos(radian);
			const sine = System.Math.sin(radian);
			const previousInnerX = centerX + previousCosine * innerRadius;
			const previousInnerY = centerY + previousSine * innerRadius;
			const previousOuterX = centerX + previousCosine * outerRadius;
			const previousOuterY = centerY + previousSine * outerRadius;
			const innerX = centerX + cosine * innerRadius;
			const innerY = centerY + sine * innerRadius;
			const outerX = centerX + cosine * outerRadius;
			const outerY = centerY + sine * outerRadius;
			vertexData[offset++] = previousInnerX;
			vertexData[offset++] = previousInnerY;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = previousOuterX;
			vertexData[offset++] = previousOuterY;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = outerX;
			vertexData[offset++] = outerY;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = previousInnerX;
			vertexData[offset++] = previousInnerY;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = outerX;
			vertexData[offset++] = outerY;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = innerX;
			vertexData[offset++] = innerY;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexCount += 6;
			previousCosine = cosine;
			previousSine = sine;
		}
		this.drawVertices(vertexCount, this.getWhiteTexture(), color);
	}

	//==============================================================================
	// 선분 여럿 출력. (위치 배열 하나에 선분마다 x0, y0, x1, y1 넷씩, 한 번에 그린다)
	// - setStrokeColor()
	// - 선분마다 두께만큼 넓힌 네모 하나다. (drawLine 과 달리 이음새를 메우지 않는다, 따로 떨어진 선분 용)
	// - Vector2 배열을 만들지 않고 숫자 배열(Array, Float32Array)을 그대로 읽는다. 길이가 0 인 선분은 건너뛴다.
	// - 정점 버퍼가 차면 거기까지 그리고 이어서 담는다. (묶어 그리기가 켜져 있으면 같은 텍스처라 한 번의 드로우 콜로 이어진다)
	//==============================================================================
	/**
	 * @param { number[] | Float32Array } positionValues 선분마다 x0, y0, x1, y1 넷씩 놓인 숫자 배열. (넷보다 적으면 그리지 않는다)
	 * @param { number } size 기본 1.
	 * @example <caption>격자 선 한 번에 그리기</caption>
	 * import { Engine, EngineConfiguration, Scene, Vector2 } from "./build/vanilla.js";
	 *
	 * class MainScene extends Scene {
	 * 	draw(graphic) {
	 * 		super.draw(graphic);
	 * 		const positionValues = [];
	 * 		for (let x = 0; x <= 640; x += 40) {
	 * 			positionValues.push(x, 0, x, 360);
	 * 		}
	 * 		for (let y = 0; y <= 360; y += 40) {
	 * 			positionValues.push(0, y, 640, y);
	 * 		}
	 * 		graphic.setStrokeColor("rgba(255, 255, 255, 0.3)");
	 * 		graphic.drawLineSegments(positionValues, 1);
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	drawLineSegments(positionValues, size = 1) {
		if (!positionValues || positionValues.length < 4) {
			return;
		}
		const halfSize = size / 2;
		const strokeColor = this.getStrokeColor();
		const whiteTexture = this.getWhiteTexture();
		const vertexData = this.getVertexData();
		let offset = 0;
		let vertexCount = 0;
		const segmentCount = System.Math.floor(positionValues.length / 4);
		for (let segmentIndex = 0; segmentIndex < segmentCount; ++segmentIndex) {
			const valueIndex = segmentIndex * 4;
			const startX = positionValues[valueIndex];
			const startY = positionValues[valueIndex + 1];
			const endX = positionValues[valueIndex + 2];
			const endY = positionValues[valueIndex + 3];
			const deltaX = endX - startX;
			const deltaY = endY - startY;
			const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
			if (!(length > 0)) {
				continue;
			}
			if ((vertexCount + 6) * FLOATS_PER_VERTEX > vertexData.length) {
				this.drawVertices(vertexCount, whiteTexture, strokeColor);
				offset = 0;
				vertexCount = 0;
			}
			const normalX = -deltaY / length * halfSize;
			const normalY = deltaX / length * halfSize;
			vertexData[offset++] = startX + normalX;
			vertexData[offset++] = startY + normalY;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = endX + normalX;
			vertexData[offset++] = endY + normalY;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = startX - normalX;
			vertexData[offset++] = startY - normalY;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = startX - normalX;
			vertexData[offset++] = startY - normalY;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = endX + normalX;
			vertexData[offset++] = endY + normalY;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = endX - normalX;
			vertexData[offset++] = endY - normalY;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexCount += 6;
		}
		this.drawVertices(vertexCount, whiteTexture, strokeColor);
	}

	//==============================================================================
	// 이미지 출력.
	// - setFillColor() Not Supported.
	//==============================================================================
	/**
	 * @param { HTMLImageElement | HTMLCanvasElement } image 그릴 그림. (null 이나 undefined 면 오류를 던진다)
	 * @param { Vector2 } position 그릴 왼쪽 위.
	 * @param { Vector2 } contentSize 그릴 크기. (음수면 뒤집힌다)
	 */
	drawImage(image, position, contentSize) {
		if (image === null || image === undefined){
			throw new Error("image is null");
		}

		this.drawImageWithSourceAndDestination(image,
			0, 0, image.width, image.height,
			position.x, position.y, contentSize.x, contentSize.y);
	}

	//==============================================================================
	// 이미지의 일부만 출력.
	// - setFillColor() Not Supported.
	//==============================================================================
	/**
	 * @param { HTMLImageElement | HTMLCanvasElement } image 그릴 그림. (null 이나 undefined 면 오류를 던진다)
	 * @param { Vector2 } position 그릴 왼쪽 위.
	 * @param { Vector2 } contentSize 그릴 크기. (음수면 뒤집힌다)
	 * @param { Rect } imageRect 그림 안에서 그릴 영역. (픽셀, null 이거나 비었으면 그림 전체)
	 */
	drawImageWithImageRect(image, position, contentSize, imageRect) {
		if (image === null || image === undefined){
			throw new Error("image is null");
		}

		if (imageRect === null || imageRect === undefined || imageRect.isZero()) {
			// 영역이 없으면 사각 영역을 새로 만들지 않고 그림 전체를 바로 그린다.
			this.drawImageWithSourceAndDestination(image,
				0, 0, image.width, image.height,
				position.x, position.y, contentSize.x, contentSize.y);
			return;
		}

		this.drawImageWithSourceAndDestination(image,
			imageRect.position.x, imageRect.position.y, imageRect.size.x, imageRect.size.y,
			position.x, position.y, contentSize.x, contentSize.y);
	}

	//==============================================================================
	// 이미지의 소스 영역을 지정 영역에 출력. (Canvas2D drawImage 9인자 대응)
	//==============================================================================
	/**
	 * @param { HTMLImageElement | HTMLCanvasElement } image 그릴 그림. (아직 불러오지 않아 크기가 0 이면 그리지 않는다)
	 * @param { number } sourceX 그림 안의 왼쪽. (픽셀)
	 * @param { number } sourceY 그림 안의 위. (픽셀)
	 * @param { number } sourceWidth 그림 안의 너비. (픽셀)
	 * @param { number } sourceHeight 그림 안의 높이. (픽셀)
	 * @param { number } destinationX 그릴 왼쪽.
	 * @param { number } destinationY 그릴 위.
	 * @param { number } destinationWidth 그릴 너비. (음수면 뒤집힌다)
	 * @param { number } destinationHeight 그릴 높이. (음수면 뒤집힌다)
	 * @example <caption>그림의 한 조각 그리기</caption>
	 * import { Engine, EngineConfiguration, Scene, Vector2, ImageAsset } from "./build/vanilla.js";
	 *
	 * class MainScene extends Scene {
	 * 	async load(engine) {
	 * 		await super.load(engine);
	 * 		this.imageAsset = new ImageAsset();
	 * 		await this.imageAsset.load("examples/assets/spritesheet.png");
	 * 	}
	 *
	 * 	draw(graphic) {
	 * 		super.draw(graphic);
	 * 		const image = this.imageAsset.image;
	 * 		graphic.drawImageWithSourceAndDestination(image, 200, 0, 200, 200, 220, 80, 200, 200);
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	drawImageWithSourceAndDestination(image, sourceX, sourceY, sourceWidth, sourceHeight, destinationX, destinationY, destinationWidth, destinationHeight) {
		const imageTextureCache = this.getImageTextureCache();
		const isImageSmoothingEnabled = this.isImageSmoothingEnabled();
		const isImageMipmapEnabled = this.isImageMipmapEnabled();
		const texture = imageTextureCache.getTexture(image, isImageSmoothingEnabled, isImageMipmapEnabled);
		if (!texture) {
			return;
		}

		const imageWidth = image.width;
		const imageHeight = image.height;
		const leftU = sourceX / imageWidth;
		const topV = sourceY / imageHeight;
		const rightU = (sourceX + sourceWidth) / imageWidth;
		const bottomV = (sourceY + sourceHeight) / imageHeight;
		const vertexCountOffset = this.writeQuad(0,
			destinationX, destinationY,
			destinationX + destinationWidth, destinationY + destinationHeight,
			leftU, topV, rightU, bottomV);
		const whiteColor = this.getWhiteColor();
		this.drawVertices(vertexCountOffset / FLOATS_PER_VERTEX, texture, whiteColor);
	}

	//==============================================================================
	// 이미지 나인패치 출력.
	// - setFillColor() Not Supported.
	//==============================================================================
	/**
	 * @static
	 * @param { HTMLImageElement | HTMLCanvasElement } image 그릴 그림.
	 * @param { Vector2 } position 그릴 왼쪽 위. (내림한다)
	 * @param { Vector2 } size 그릴 크기. (올림한다, 경계 두께 합보다 작으면 그 합)
	 * @param { Rect } nineSlice 나인 슬라이스 경계. (position.x 왼쪽, position.y 위, size.x 오른쪽, size.y 아래 두께, 픽셀)
	 */
	drawImageWithNineSlice(image, position, size, nineSlice) {
		const sw = image.width;
		const sh = image.height;
		const dx = Math.floor(position.x);
		const dy = Math.floor(position.y);
		const left = nineSlice.position.x;
		const top = nineSlice.position.y;
		const right = nineSlice.size.x;
		const bottom = nineSlice.size.y;

		// 최소 사이즈 제한 적용.
		const dw = Math.max(Math.ceil(size.x), left + right);
		const dh = Math.max(Math.ceil(size.y), top + bottom);

		const hasHorizontal = left > 0 || right > 0;
		const hasVertical = top > 0 || bottom > 0;

		if (hasHorizontal && hasVertical) {
			// 가로세로 다 쪼개기.
			const centerSrcW = sw - left - right;
			const centerSrcH = sh - top - bottom;
			const centerDstW = dw - left - right;
			const centerDstH = dh - top - bottom;

			// 위쪽.
			this.drawImageWithSourceAndDestination(image, 0, 0, left, top, dx, dy, left + 1, top + 1);
			this.drawImageWithSourceAndDestination(image, left, 0, centerSrcW, top, dx + left, dy, centerDstW + 1, top + 1);
			this.drawImageWithSourceAndDestination(image, sw - right, 0, right, top, dx + dw - right, dy, right, top + 1);

			// 가운데쪽.
			this.drawImageWithSourceAndDestination(image, 0, top, left, centerSrcH, dx, dy + top, left + 1, centerDstH + 1);
			this.drawImageWithSourceAndDestination(image, left, top, centerSrcW, centerSrcH, dx + left, dy + top, centerDstW + 1, centerDstH + 1);
			this.drawImageWithSourceAndDestination(image, sw - right, top, right, centerSrcH, dx + dw - right, dy + top, right, centerDstH + 1);

			// 아래쪽.
			this.drawImageWithSourceAndDestination(image, 0, sh - bottom, left, bottom, dx, dy + dh - bottom, left + 1, bottom);
			this.drawImageWithSourceAndDestination(image, left, sh - bottom, centerSrcW, bottom, dx + left, dy + dh - bottom, centerDstW + 1, bottom);
			this.drawImageWithSourceAndDestination(image, sw - right, sh - bottom, right, bottom, dx + dw - right, dy + dh - bottom, right, bottom);
		}
		else if (hasHorizontal) {
			// 가로만 쪼개기.
			const centerSrcW = sw - left - right;
			const centerDstW = dw - left - right;

			this.drawImageWithSourceAndDestination(image, 0, 0, left, sh, dx, dy, left + 1, dh);
			this.drawImageWithSourceAndDestination(image, left, 0, centerSrcW, sh, dx + left, dy, centerDstW + 1, dh);
			this.drawImageWithSourceAndDestination(image, sw - right, 0, right, sh, dx + dw - right, dy, right, dh);
		}
		else if (hasVertical) {
			// 세로만 쪼개기.
			const centerSrcH = sh - top - bottom;
			const centerDstH = dh - top - bottom;

			this.drawImageWithSourceAndDestination(image, 0, 0, sw, top, dx, dy, dw, top + 1);
			this.drawImageWithSourceAndDestination(image, 0, top, sw, centerSrcH, dx, dy + top, dw, centerDstH + 1);
			this.drawImageWithSourceAndDestination(image, 0, sh - bottom, sw, bottom, dx, dy + dh - bottom, dw, bottom);
		}
		else {
			// 쪼개기 없음.
			this.drawImageWithSourceAndDestination(image, 0, 0, sw, sh, dx, dy, dw, dh);
		}
	}

	//==============================================================================
	// 폰트 문자열 설정. (Canvas2D font 대응, 예: "16px DOSGothic")
	//==============================================================================
	/**
	 * @param { string } fontString CSS 글꼴 글. (예: "16px DOSGothic", 비었으면 바꾸지 않는다)
	 */
	setFontString(fontString) {
		if (fontString) {
			this.#fontString = fontString;
		}
	}

	//==============================================================================
	// 폰트 문자열 반환.
	//==============================================================================
	/**
	 * @returns { string } CSS 글꼴 글. (처음은 "10px sans-serif")
	 */
	getFontString() {
		return this.#fontString;
	}

	//==============================================================================
	// 텍스트 가로 정렬 설정. ("left" | "center" | "right" | "start" | "end")
	//==============================================================================
	/**
	 * @param { string } textAlign 가로 정렬. (비었으면 바꾸지 않는다)
	 */
	setTextAlign(textAlign) {
		if (textAlign) {
			this.#textAlign = textAlign;
		}
	}

	//==============================================================================
	// 텍스트 가로 정렬 반환.
	//==============================================================================
	/**
	 * @returns { string } 가로 정렬. (처음은 "start")
	 */
	getTextAlign() {
		return this.#textAlign;
	}

	//==============================================================================
	// 텍스트 방향 설정. ("inherit" | "ltr" | "rtl" | "auto", Canvas2D direction 대응)
	// - 문단의 방향이다. 글자 안의 순서(양방향 알고리즘)와 정렬 "start" / "end" 의 왼쪽, 오른쪽이 이것을 따른다.
	// - "inherit" 는 "ltr" 로 본다. (기본, 지금까지와 같다)
	// - "auto" 는 문자열마다 처음 나오는 방향이 강한 글자로 정한다. (HTML 의 dir="auto", 없으면 "ltr") 사용자가 쓴 글(닉네임 등)에 쓴다.
	//==============================================================================
	/**
	 * @param { string } textDirection 글 방향. (비었으면 바꾸지 않는다)
	 */
	setTextDirection(textDirection) {
		if (textDirection) {
			this.#textDirection = textDirection;
		}
	}

	//==============================================================================
	// 텍스트 방향 반환.
	//==============================================================================
	/**
	 * @returns { string } 글 방향. (처음은 "inherit")
	 */
	getTextDirection() {
		return this.#textDirection;
	}

	//==============================================================================
	// 문자열의 실제 방향 계산. ("ltr" 또는 "rtl", "auto" 는 처음 나오는 방향이 강한 글자로)
	//==============================================================================
	/**
	 * @param { string } text 방향을 정할 글. ("auto" 일 때만 본다)
	 * @returns { string } "ltr" 또는 "rtl".
	 */
	resolveTextDirection(text) {
		const textDirection = this.getTextDirection();
		if (textDirection === "rtl") {
			return "rtl";
		}
		if (textDirection !== "auto") {
			return "ltr";
		}
		return detectTextDirection(text);
	}

	//==============================================================================
	// 실제 가로 정렬 계산. ("start" / "end" 를 방향에 따라 "left" / "right" 로)
	//==============================================================================
	/**
	 * @param { string } textAlign 정렬. ("left", "center", "right", "start", "end", 모르는 값은 "left")
	 * @param { string } textDirection "ltr" 또는 "rtl".
	 * @returns { string } "left" | "center" | "right"
	 */
	resolveTextAlign(textAlign, textDirection) {
		if (textAlign === "start") {
			return textDirection === "rtl" ? "right" : "left";
		}
		if (textAlign === "end") {
			return textDirection === "rtl" ? "left" : "right";
		}
		if (textAlign === "center" || textAlign === "right") {
			return textAlign;
		}
		return "left";
	}

	//==============================================================================
	// 텍스트 베이스라인 설정. ("top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom")
	//==============================================================================
	/**
	 * @param { string } textBaseline 세로 기준. (비었으면 바꾸지 않는다)
	 */
	setTextBaseline(textBaseline) {
		if (textBaseline) {
			this.#textBaseline = textBaseline;
		}
	}

	//==============================================================================
	// 텍스트 베이스라인 반환.
	//==============================================================================
	/**
	 * @returns { string } 세로 기준. (처음은 "alphabetic")
	 */
	getTextBaseline() {
		return this.#textBaseline;
	}

	//==============================================================================
	// 문자열 측정. (현재 폰트 기준, Canvas2D measureText 대응)
	//==============================================================================
	/**
	 * @param { string } text 잴 글.
	 * @returns { TextMetrics } 지금 글꼴로 잰 치수. (캐시가 나눠 쓰므로 고치지 않는다)
	 */
	measureText(text) {
		const textStringTextureCache = this.getTextStringTextureCache();
		const fontString = this.getFontString();
		return textStringTextureCache.measureText(fontString, text);
	}

	//==============================================================================
	// 텍스트 베이크 스케일 양자화 단위 설정.
	// - 기본 0.25. 확대 축소가 잦은 글자가 스케일마다 새로 구워지지 않게 묶는다.
	// - 0 이면 양자화하지 않고 실제 스케일 그대로 굽는다. (스케일이 고정된 UI 글자를 늘리지 않고 1:1 로 그릴 때)
	//==============================================================================
	/**
	 * @param { number } textBakeScaleStep 양자화 단위. (음수는 0, 0 이면 양자화하지 않는다)
	 */
	setTextBakeScaleStep(textBakeScaleStep) {
		this.#textBakeScaleStep = Math.max(0, textBakeScaleStep);
	}

	//==============================================================================
	// 텍스트 베이크 스케일 양자화 단위 반환.
	//==============================================================================
	/**
	 * @returns { number } 양자화 단위.
	 */
	getTextBakeScaleStep() {
		return this.#textBakeScaleStep;
	}

	//==============================================================================
	// 배율이 움직이는 노드의 텍스트 베이크 스케일 양자화 단위 설정. (기본 0.25)
	// - 양자화 단위(setTextBakeScaleStep)가 0 일 때, 그리는 노드의 변환 배율이 지난 프레임과 다르면(확대 움직임, 팝업, 트윈, 카메라 확대)
	//   이 단위로 묶은 배율로 굽는다. 프레임마다 다른 배율로 새로 굽지 않는다.
	// - 배율이 멈추면(지난 프레임과 같으면) 정확한 배율로 다시 구워 1:1 로 또렷하다.
	// - 0 이면 움직이는 동안에도 묶지 않는다. (지금까지와 같다)
	//==============================================================================
	/**
	 * @param { number } textBakeMotionScaleStep 움직이는 동안의 양자화 단위. (음수는 0, 0 이면 묶지 않는다)
	 */
	setTextBakeMotionScaleStep(textBakeMotionScaleStep) {
		this.#textBakeMotionScaleStep = Math.max(0, textBakeMotionScaleStep);
	}

	//==============================================================================
	// 배율이 움직이는 노드의 텍스트 베이크 스케일 양자화 단위 반환.
	//==============================================================================
	/**
	 * @returns { number } 움직이는 동안의 양자화 단위.
	 */
	getTextBakeMotionScaleStep() {
		return this.#textBakeMotionScaleStep;
	}

	//==============================================================================
	// 지금 그리는 노드의 배율이 움직이는 중인지 설정. (drawNode 가 정한다, 노드 밖에서 직접 그릴 때 부르는 쪽이 정할 수 있다)
	//==============================================================================
	/**
	 * @param { boolean } isTextBakeScaleMoving 배율이 움직이는 중인지. (true 일 때만 움직이는 것으로 본다)
	 */
	setTextBakeScaleMoving(isTextBakeScaleMoving) {
		this.#isTextBakeScaleMoving = isTextBakeScaleMoving === true;
	}

	//==============================================================================
	// 지금 그리는 노드의 배율이 움직이는 중인지 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 배율이 움직이는 중이면 참.
	 */
	isTextBakeScaleMoving() {
		return this.#isTextBakeScaleMoving;
	}

	//==============================================================================
	// 노드의 변환 배율이 지난 프레임과 달라 움직이는 중인지 셈하고 기억하기. (drawNode 가 pushTransform 뒤에 부른다)
	// - 양자화 단위가 0 이 아니면 늘 묶어 굽으므로 셈하지 않는다.
	// - 처음 그리는 노드는 움직이지 않는 것으로 본다. (첫 프레임에 두 번 굽지 않게)
	//==============================================================================
	/**
	 * @param { TransformNode } node 그리는 노드. (지금 배율을 노드에 적어 둔다)
	 * @returns { boolean } 배율이 지난 프레임과 달라 움직이는 중이면 참.
	 */
	readNodeTextBakeScaleMoving(node) {
		if (this.#textBakeScaleStep > 0 || this.#textBakeMotionScaleStep <= 0 || typeof node.getLastDrawnMaximumScale !== "function") {
			return false;
		}
		const maximumScale = this.#transformMatrix.getMaximumScale();
		const lastDrawnMaximumScale = node.getLastDrawnMaximumScale();
		node.setLastDrawnMaximumScale(maximumScale);
		return lastDrawnMaximumScale > 0 && lastDrawnMaximumScale !== maximumScale;
	}

	//==============================================================================
	// 텍스트 픽셀 스냅 설정.
	// - 켜면 회전 / 기울임이 없는 변환에서 글자 쿼드의 왼쪽 위를 디바이스 픽셀 격자에 맞춘다.
	// - 베이크 스케일이 실제 스케일과 같을 때(setTextBakeScaleStep(0)) 텍셀과 픽셀이 1:1 로 맞아 가장 선명하다.
	//==============================================================================
	/**
	 * @param { boolean } isTextPixelSnapEnabled 글자 쿼드를 디바이스 픽셀 격자에 맞출지.
	 * @example <caption>UI 글자를 1:1 로 또렷하게</caption>
	 * import { Engine, EngineConfiguration, Scene, Vector2 } from "./build/vanilla.js";
	 *
	 * class MainScene extends Scene {
	 * 	initialize(engine) {
	 * 		const graphic = engine.getGraphic();
	 * 		graphic.setTextBakeScaleStep(0);
	 * 		graphic.setTextPixelSnapEnabled(true);
	 * 	}
	 *
	 * 	draw(graphic) {
	 * 		super.draw(graphic);
	 * 		graphic.setFillColor("#ffffff");
	 * 		graphic.setFontString("16px sans-serif");
	 * 		graphic.setTextAlign("left");
	 * 		graphic.setTextBaseline("top");
	 * 		graphic.drawFillText("Score 12345", 20, 20);
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	setTextPixelSnapEnabled(isTextPixelSnapEnabled) {
		this.#isTextPixelSnapEnabled = isTextPixelSnapEnabled;
	}

	//==============================================================================
	// 텍스트 픽셀 스냅 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 텍스트 픽셀 스냅이 켜졌으면 참.
	 */
	isTextPixelSnapEnabled() {
		return this.#isTextPixelSnapEnabled;
	}

	//==============================================================================
	// 텍스트 베이크 스케일 계산. (현재 변환 행렬 기반, 양자화 단위는 setTextBakeScaleStep)
	//==============================================================================
	/**
	 * @returns { number } 굽는 배율. (0.25 ~ 8)
	 */
	calculateTextBakeScale(){
		const maximumScale = this.#transformMatrix.getMaximumScale();
		let textBakeScaleStep = this.getTextBakeScaleStep();
		if (textBakeScaleStep <= 0 && this.isTextBakeScaleMoving()) {
			textBakeScaleStep = this.getTextBakeMotionScaleStep();
		}
		const quantizedScale = textBakeScaleStep > 0 ? Math.round(maximumScale / textBakeScaleStep) * textBakeScaleStep : maximumScale;
		return Math.clamp(quantizedScale, 0.25, MAXIMUM_TEXT_BAKE_SCALE);
	}

	//==============================================================================
	// 문자열 텍스처 엔트리를 정렬/베이스라인에 맞춰 쿼드로 출력.
	//==============================================================================
	/**
	 * @param { object } entry 문자열 텍스처 엔트리. (TextStringTextureCache.getEntry)
	 * @param { number } x 기준 X. (정렬의 기준점)
	 * @param { number } y 기준 Y. (세로 기준의 자리)
	 * @param { Color | null } color - 흰색으로 구운 글자에 곱할 색. (null 이면 흰색 그대로)
	 * @param { string } textDirection - 정렬 "start" / "end" 를 가를 방향. ("ltr" 또는 "rtl", 기본 "ltr")
	 */
	drawTextEntry(entry, x, y, color = null, textDirection = "ltr") {
		// 가로 정렬 오프셋.
		const textAlign = this.resolveTextAlign(this.getTextAlign(), textDirection);
		let alignOffset = 0;
		if (textAlign === "center") {
			alignOffset = -entry.advanceWidth / 2;
		}
		else if (textAlign === "right") {
			alignOffset = -entry.advanceWidth;
		}

		// 요청 베이스라인 → 알파벳 베이스라인 오프셋.
		const textBaseline = this.getTextBaseline();
		let baselineOffset = 0;
		if (textBaseline === "top") {
			baselineOffset = entry.fontAscent;
		}
		else if (textBaseline === "hanging") {
			baselineOffset = entry.fontAscent * 0.8;
		}
		else if (textBaseline === "middle") {
			baselineOffset = (entry.fontAscent - entry.fontDescent) / 2;
		}
		else if (textBaseline === "ideographic" || textBaseline === "bottom") {
			baselineOffset = -entry.fontDescent;
		}

		let quadX = x + alignOffset - entry.penOffsetX;
		let quadY = y + baselineOffset - entry.baselineOffsetY;

		// 픽셀 스냅. (회전 / 기울임이 없을 때만, 쿼드의 왼쪽 위를 디바이스 픽셀에 맞춘다)
		const isTextPixelSnapEnabled = this.isTextPixelSnapEnabled();
		const transformMatrix = this.#transformMatrix;
		if (isTextPixelSnapEnabled && transformMatrix.b === 0 && transformMatrix.c === 0 && transformMatrix.a > 0 && transformMatrix.d > 0) {
			const devicePoint = transformMatrix.transformPoint(quadX, quadY);
			quadX += (Math.round(devicePoint.x) - devicePoint.x) / transformMatrix.a;
			quadY += (Math.round(devicePoint.y) - devicePoint.y) / transformMatrix.d;
		}

		const vertexCountOffset = this.writeQuad(0,
			quadX, quadY,
			quadX + entry.quadWidth, quadY + entry.quadHeight,
			0, 0, 1, 1);
		const whiteColor = this.getWhiteColor();
		this.drawVertices(vertexCountOffset / FLOATS_PER_VERTEX, entry.texture, color ? color : whiteColor);
	}

	//==============================================================================
	// 텍스트 채움 출력. (Canvas2D fillText 대응)
	// - setFillColor() / setFontString() / setTextAlign() / setTextBaseline()
	//==============================================================================
	/**
	 * @param { string } text 그릴 글. (비었으면 그리지 않는다)
	 * @param { number } x 기준 X. (정렬의 기준점)
	 * @param { number } y 기준 Y. (세로 기준의 자리)
	 */
	drawFillText(text, x, y) {
		if (!text) {
			return;
		}

		// 글자는 흰색으로 굽고 그릴 때 색을 곱한다. (색이 바뀌어도 다시 굽지 않는다, 틴트 전환 / 색 애니메이션)
		const textStringTextureCache = this.getTextStringTextureCache();
		const fontString = this.getFontString();
		const fillColor = this.getFillColor();
		const bakeScale = this.calculateTextBakeScale();
		const textDirection = this.resolveTextDirection(text);
		const entry = textStringTextureCache.getEntry("fill", text, fontString, "#ffffff", 0, bakeScale, textDirection);
		if (!entry) {
			return;
		}

		this.drawTextEntry(entry, x, y, fillColor, textDirection);
	}

	//==============================================================================
	// 텍스트 외곽선 출력. (Canvas2D strokeText 대응)
	// - setStrokeColor() / setFontString() / setTextAlign() / setTextBaseline()
	//==============================================================================
	/**
	 * @param { string } text 그릴 글. (비었으면 그리지 않는다)
	 * @param { number } x 기준 X. (정렬의 기준점)
	 * @param { number } y 기준 Y. (세로 기준의 자리)
	 * @param { number } lineWidth 선 굵기. (기본 1)
	 */
	drawStrokeText(text, x, y, lineWidth = 1) {
		if (!text) {
			return;
		}

		const textStringTextureCache = this.getTextStringTextureCache();
		const fontString = this.getFontString();
		const strokeColor = this.getStrokeColor();
		const bakeScale = this.calculateTextBakeScale();
		const textDirection = this.resolveTextDirection(text);
		const entry = textStringTextureCache.getEntry("stroke", text, fontString, "#ffffff", lineWidth, bakeScale, textDirection);
		if (!entry) {
			return;
		}

		this.drawTextEntry(entry, x, y, strokeColor, textDirection);
	}

	//==============================================================================
	// 노드 출력.
	//==============================================================================
	/**
	 * @param { TransformNode } node 그릴 노드. (null 이거나 꺼져 있으면 그리지 않는다)
	 */
	drawNode(node) {
		if (node === null || node == undefined || !node.isActive()) {
			return;
		}

		// 그리다 예외가 나도 넣은 변환을 꺼내 변환 스택을 맞춘다. (예외는 그대로 위로 간다)
		node.pushTransform(this);
		try {
			// 배율이 움직이는 노드의 글은 묶은 배율로 굽는다. (자식은 저마다 다시 정한다, 다 그리면 푼다)
			this.#isTextBakeScaleMoving = this.readNodeTextBakeScaleMoving(node);
			node.draw(this);
			this.#isTextBakeScaleMoving = false;

			const isForceGizmosVisible = this.isForceGizmosVisible();
			const isGizmoVisible = isForceGizmosVisible || node.isGizmoVisible();
			if (isGizmoVisible) {
				node.drawGizmos(this);
			}
		}
		finally {
			this.#isTextBakeScaleMoving = false;
			node.popTransform(this);
		}
	}

	//==============================================================================
	// 출력 영역 제한 시작.
	// - 스텐실 버퍼 기반이라 회전/스케일이 걸린 영역도 정확히 잘린다.
	// - roundSize 를 주면 둥근 사각형으로 잘린다. (Paint 의 roundSize 와 같은 값이면 배경과 정확히 맞는다)
	//==============================================================================
	/**
	 * @param { Rect } rect 자를 사각형. (지금 변환으로 옮기기 전의 로컬 좌표)
	 * @param { number } roundSize 모서리 반지름. (기본 0, 0 이하면 각진 사각형)
	 * @example <caption>둥근 사각형 안으로 잘라 그리기</caption>
	 * import { Engine, EngineConfiguration, Scene, Vector2, Rect } from "./build/vanilla.js";
	 *
	 * class MainScene extends Scene {
	 * 	draw(graphic) {
	 * 		super.draw(graphic);
	 * 		graphic.beginClipRect(Rect.create(100, 60, 200, 200), 24);
	 * 		graphic.setFillColor("#3399ff");
	 * 		graphic.drawCircle(Vector2.create(300, 160), 120);
	 * 		graphic.endClipRect();
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	beginClipRect(rect, roundSize = 0) {
		// 상태 저장. (Canvas2D save 대응)
		this.pushState();

		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const previousClipDepth = this.#clipStack.length;

		// 영역과 변환은 복제본을 새로 만들지 않고, 클립 깊이마다 만들어 둔 칸에 값을 적는다.
		let clipEntry = this.#clipEntryPool[previousClipDepth];
		if (clipEntry === undefined) {
			clipEntry = {
				rect: new Rect(),
				roundSize: 0,
				transformMatrix: new TransformMatrix(),
			};
			this.#clipEntryPool.push(clipEntry);
		}
		clipEntry.rect.position.set(rect.position.x, rect.position.y);
		clipEntry.rect.size.set(rect.size.x, rect.size.y);
		clipEntry.roundSize = roundSize;
		clipEntry.transformMatrix.copyFrom(this.#transformMatrix);
		this.#clipStack.push(clipEntry);

		// 클리핑 전에 쌓인 것을 먼저 그린다. (스텐실 상태가 바뀌기 전)
		this.flushSpriteBatch();
		if (previousClipDepth === 0) {
			webGL2RenderingContext.enable(webGL2RenderingContext.STENCIL_TEST);
		}

		// 스텐실에 클립 영역 기록. (색상 출력 없이 INCR)
		webGL2RenderingContext.colorMask(false, false, false, false);
		webGL2RenderingContext.stencilFunc(webGL2RenderingContext.ALWAYS, 0, 0xFF);
		webGL2RenderingContext.stencilOp(webGL2RenderingContext.KEEP, webGL2RenderingContext.KEEP, webGL2RenderingContext.INCR);
		this.#isStencilRecording = true;
		if (roundSize > 0) {
			this.drawRoundRect(rect, roundSize);
		}
		else {
			this.drawRect(rect);
		}
		this.flushSpriteBatch();
		this.#isStencilRecording = false;
		webGL2RenderingContext.colorMask(true, true, true, true);
		webGL2RenderingContext.stencilOp(webGL2RenderingContext.KEEP, webGL2RenderingContext.KEEP, webGL2RenderingContext.KEEP);
		webGL2RenderingContext.stencilFunc(webGL2RenderingContext.EQUAL, previousClipDepth + 1, 0xFF);
	}

	//==============================================================================
	// 투명도 층 시작. (CSS opacity, 어도비 투명도 묶음처럼 endOpacityLayer 까지 그린 것을 따로 칸에 모았다가 지금 전역 알파로 한 번에 얹는다)
	// - 층 안의 그림은 서로 겹친 자리가 비치지 않는다. (노드마다 투명도를 곱해 따로 얹으면 겹친 자리에서 아래 그림이 비친다)
	// - 층 안은 전역 알파 1 에서 시작한다. 층 칸은 화면과 같은 크기의 RGBA8 이고 스텐실을 지금 자르기 깊이로 채워 둬 층 안의 자르기도 그대로 된다.
	//   바깥 자르기는 얹을 때 걸린다. 층은 겹쳐 열 수 있다. 칸을 지을 수 없으면 층 없이 그대로 그린다.
	// - 노드는 setOpacityLayer 를 켜고 투명도가 1 보다 작으면 그 노드와 자손을 층으로 그린다.
	//==============================================================================
	/**
	 * @example <caption>겹친 두 사각형을 묶어 반투명하게 (겹친 자리에서 아래 사각형이 비치지 않는다)</caption>
	 * import { Engine, EngineConfiguration, Scene, Vector2, Rect } from "./build/vanilla.js";
	 *
	 * class MainScene extends Scene {
	 * 	draw(graphic) {
	 * 		super.draw(graphic);
	 * 		graphic.pushState();
	 * 		graphic.setGlobalAlpha(0.5);
	 * 		graphic.beginOpacityLayer();
	 * 		graphic.setFillColor("#ff0000");
	 * 		graphic.drawRect(Rect.create(100, 100, 200, 100));
	 * 		graphic.setFillColor("#0000ff");
	 * 		graphic.drawRect(Rect.create(200, 150, 200, 100));
	 * 		graphic.endOpacityLayer();
	 * 		graphic.popState();
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	beginOpacityLayer() {
		this.flushSpriteBatch();
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const previousFramebuffer = webGL2RenderingContext.getParameter(webGL2RenderingContext.FRAMEBUFFER_BINDING);
		const globalAlpha = this.#globalAlpha;
		const target = this.acquireOpacityLayerTarget(previousFramebuffer);
		if (target !== null) {
			webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, target.framebuffer);
			webGL2RenderingContext.colorMask(true, true, true, true);
			webGL2RenderingContext.stencilMask(0xFF);
			webGL2RenderingContext.clearBufferfv(webGL2RenderingContext.COLOR, 0, TRANSPARENT_CLEAR_VALUE_LIST);
			webGL2RenderingContext.clearBufferiv(webGL2RenderingContext.STENCIL, 0, new Int32Array([this.#clipStack.length]));
			this.#globalAlpha = 1.0;
		}
		this.#opacityLayerStack.push({ target, previousFramebuffer, globalAlpha });
	}

	//==============================================================================
	// 투명도 층 끝. (beginOpacityLayer 뒤에 그린 것을 앞 프레임버퍼에 층을 열 때의 전역 알파로 얹는다)
	//==============================================================================
	endOpacityLayer() {
		const opacityLayer = this.#opacityLayerStack.pop();
		if (opacityLayer === undefined) {
			return;
		}
		this.flushSpriteBatch();
		this.#globalAlpha = opacityLayer.globalAlpha;
		const target = opacityLayer.target;
		if (target === null) {
			return;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, opacityLayer.previousFramebuffer);

		// 층 칸을 단위 행렬, 흰색, 틴트 없이 source-over 로 얹는다. (칸은 화면과 같은 크기라 디바이스 픽셀 그대로 짚는다, 텍스처는 아래가 0 행)
		const viewportWidth = this.#appliedViewportWidth;
		const viewportHeight = this.#appliedViewportHeight;
		const transformMatrix = this.#transformMatrix;
		const imageTintColor = this.#imageTintColor;
		const blendMode = this.#blendMode;
		this.#transformMatrix = this.#identityTransformMatrix;
		this.#imageTintColor = null;
		this.setBlendMode("source-over");
		const vertexCount = this.writeQuad(0, 0, 0, viewportWidth, viewportHeight, 0, 1, 1, 0) / FLOATS_PER_VERTEX;
		this.drawVertices(vertexCount, target.texture, this.getWhiteColor());
		this.flushSpriteBatch();
		this.setBlendMode(blendMode);
		this.#transformMatrix = transformMatrix;
		this.#imageTintColor = imageTintColor;
		this.#opacityLayerTargetPool.push(target);
	}

	//==============================================================================
	// 투명도 층 칸 꺼내기. (모아 둔 것에서 화면 크기와 같은 것, 없으면 짓는다. 못 지으면 null)
	//==============================================================================
	/**
	 * @private
	 * @param { WebGLFramebuffer | null } framebuffer 다 지은 뒤 다시 묶을 프레임버퍼.
	 * @returns { object | null }
	 */
	acquireOpacityLayerTarget(framebuffer) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const viewportWidth = this.#appliedViewportWidth;
		const viewportHeight = this.#appliedViewportHeight;
		while (this.#opacityLayerTargetPool.length > 0) {
			const target = this.#opacityLayerTargetPool.pop();
			if (target.width === viewportWidth && target.height === viewportHeight) {
				return target;
			}
			this.destroyOpacityLayerTarget(target);
		}
		const target = this.createOffscreenTarget(framebuffer, webGL2RenderingContext.RGBA8, viewportWidth, viewportHeight);
		const stencilRenderbuffer = webGL2RenderingContext.createRenderbuffer();
		webGL2RenderingContext.bindRenderbuffer(webGL2RenderingContext.RENDERBUFFER, stencilRenderbuffer);
		webGL2RenderingContext.renderbufferStorage(webGL2RenderingContext.RENDERBUFFER, webGL2RenderingContext.DEPTH24_STENCIL8, viewportWidth, viewportHeight);
		webGL2RenderingContext.bindRenderbuffer(webGL2RenderingContext.RENDERBUFFER, null);
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, target.framebuffer);
		webGL2RenderingContext.framebufferRenderbuffer(webGL2RenderingContext.FRAMEBUFFER, webGL2RenderingContext.DEPTH_STENCIL_ATTACHMENT, webGL2RenderingContext.RENDERBUFFER, stencilRenderbuffer);
		const status = webGL2RenderingContext.checkFramebufferStatus(webGL2RenderingContext.FRAMEBUFFER);
		webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, framebuffer);
		const opacityLayerTarget = { texture: target.texture, framebuffer: target.framebuffer, stencilRenderbuffer, width: viewportWidth, height: viewportHeight };
		if (status !== webGL2RenderingContext.FRAMEBUFFER_COMPLETE) {
			console.error("Graphic: opacity layer failed: framebuffer status 0x" + status.toString(16));
			this.destroyOpacityLayerTarget(opacityLayerTarget);
			return null;
		}
		return opacityLayerTarget;
	}

	//==============================================================================
	// 투명도 층 칸 지우기.
	//==============================================================================
	/**
	 * @private
	 * @param { object } target
	 */
	destroyOpacityLayerTarget(target) {
		this.destroyOffscreenTarget(target);
		this.getWebGL2RenderingContext().deleteRenderbuffer(target.stencilRenderbuffer);
	}

	//==============================================================================
	// 출력 영역 제한 종료.
	//==============================================================================
	endClipRect() {
		const clipEntry = this.#clipStack.pop();
		if (!clipEntry) {
			return;
		}

		const webGL2RenderingContext = this.getWebGL2RenderingContext();

		// 기록 시점의 변환 행렬로 같은 영역을 DECR 해 스텐실 원복.
		// (begin 과 end 사이에 변환이 바뀌었을 수 있으므로 스냅샷 사용)
		// 칸은 다음 클립이 고쳐 쓰므로 지금 행렬 객체로 삼지 않고 값만 옮겨 적는다. (아래 popState 가 begin 때의 행렬로 되돌린다)
		this.flushSpriteBatch();
		this.#transformMatrix.copyFrom(clipEntry.transformMatrix);
		webGL2RenderingContext.colorMask(false, false, false, false);
		webGL2RenderingContext.stencilFunc(webGL2RenderingContext.ALWAYS, 0, 0xFF);
		webGL2RenderingContext.stencilOp(webGL2RenderingContext.KEEP, webGL2RenderingContext.KEEP, webGL2RenderingContext.DECR);
		this.#isStencilRecording = true;
		if (clipEntry.roundSize > 0) {
			this.drawRoundRect(clipEntry.rect, clipEntry.roundSize);
		}
		else {
			this.drawRect(clipEntry.rect);
		}
		this.flushSpriteBatch();
		this.#isStencilRecording = false;
		webGL2RenderingContext.colorMask(true, true, true, true);
		webGL2RenderingContext.stencilOp(webGL2RenderingContext.KEEP, webGL2RenderingContext.KEEP, webGL2RenderingContext.KEEP);

		const clipDepth = this.#clipStack.length;
		if (clipDepth === 0) {
			webGL2RenderingContext.disable(webGL2RenderingContext.STENCIL_TEST);
		}
		else {
			webGL2RenderingContext.stencilFunc(webGL2RenderingContext.EQUAL, clipDepth, 0xFF);
		}

		// 상태 복원. (Canvas2D restore 대응)
		this.popState();
	}

	//==============================================================================
	// 캔버스 반환.
	//==============================================================================
	/**
	 * @returns { HTMLCanvasElement } 캔버스.
	 */
	getCanvas() {
		return this.#canvas;
	}

	//==============================================================================
	// WebGL2 렌더링 컨텍스트 반환.
	//==============================================================================
	/**
	 * @returns { WebGL2RenderingContext } WebGL2 렌더링 컨텍스트.
	 */
	getWebGL2RenderingContext() {
		return this.#webGL2RenderingContext;
	}

	//==============================================================================
	// 지금 그리는 프레임 버퍼 반환. (null 이면 캔버스, GL 에 묻지 않고 기억한 값)
	//==============================================================================
	/**
	 * @returns { WebGLFramebuffer | null } 지금 묶인 그리기 프레임 버퍼. (null 이면 캔버스의 기본 프레임 버퍼)
	 * @example <caption>바깥 패스에서 렌더 타깃을 바꿨다가 되돌리기</caption>
	 * import { Engine, EngineConfiguration, Scene, Vector2 } from "./build/vanilla.js";
	 *
	 * class MainScene extends Scene {
	 * 	draw(graphic) {
	 * 		super.draw(graphic);
	 * 		graphic.runExternalPass((webGL2RenderingContext) => {
	 * 			const previousFramebuffer = graphic.getCurrentFramebuffer();
	 * 			const framebuffer = webGL2RenderingContext.createFramebuffer();
	 * 			webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, framebuffer);
	 * 			webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, previousFramebuffer);
	 * 			webGL2RenderingContext.deleteFramebuffer(framebuffer);
	 * 		}, { clearDepth: false });
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	getCurrentFramebuffer() {
		return this.#webGLStateCache.getDrawFramebuffer();
	}

	//==============================================================================
	// 지금 뷰포트 반환. (디바이스 픽셀, GL 처럼 왼쪽 아래가 원점, GL 에 묻지 않고 기억한 값)
	//==============================================================================
	/**
	 * @returns { Rect } 지금 뷰포트. (위치 x, y 와 크기 너비, 높이, 새 Rect)
	 * @example <caption>지금 뷰포트 크기 읽기</caption>
	 * import { Engine, EngineConfiguration, Scene, Vector2 } from "./build/vanilla.js";
	 *
	 * class MainScene extends Scene {
	 * 	draw(graphic) {
	 * 		super.draw(graphic);
	 * 		const viewport = graphic.getCurrentViewport();
	 * 		console.log(viewport.position.x, viewport.position.y, viewport.width, viewport.height);
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	getCurrentViewport() {
		const viewport = this.#webGLStateCache.getViewport();
		return Rect.create(viewport[0], viewport[1], viewport[2], viewport[3]);
	}

	//==============================================================================
	// GL 상태 기억 다시 맞추기. (three.js 의 resetState 처럼 바깥 GL 코드가 상태를 바꾼 뒤 부른다)
	// - 엔진은 컨텍스트의 상태 함수(bindFramebuffer, viewport, enable 같은 것)를 가로채 기억하므로, 같은 컨텍스트 객체로 부른 것은 따로 알리지 않아도 된다.
	// - 프로토타입 함수를 직접 부르는 것처럼 가로채지 못한 길로 바꿨을 때 부른다. 기억을 모두 잊고 다음에 읽을 때 GL 에 한 번씩 묻는다.
	//   마지막으로 쓰게 한 프로그램과 묶은 텍스처의 기억도 잊는다. (invalidateRenderStateCache)
	//==============================================================================
	/**
	 * @example <caption>가로채지 못한 길로 상태를 바꾼 뒤 기억 맞추기</caption>
	 * import { Engine, EngineConfiguration, Scene, Vector2 } from "./build/vanilla.js";
	 *
	 * class MainScene extends Scene {
	 * 	draw(graphic) {
	 * 		super.draw(graphic);
	 * 		graphic.runExternalPass((webGL2RenderingContext) => {
	 * 			WebGL2RenderingContext.prototype.viewport.call(webGL2RenderingContext, 0, 0, 64, 64);
	 * 			graphic.resetGLStateCache();
	 * 			console.log(graphic.getCurrentViewport().width);
	 * 		}, { clearDepth: false });
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	resetGLStateCache() {
		this.#webGLStateCache.reset();
		this.invalidateRenderStateCache();
	}

	//==============================================================================
	// 드로잉 버퍼 너비 반환. (픽셀, 마지막으로 맞춘 뷰포트)
	//==============================================================================
	/**
	 * @returns { number } 드로잉 버퍼 너비. (픽셀)
	 */
	getDrawingBufferWidth() {
		return this.#appliedViewportWidth;
	}

	//==============================================================================
	// 드로잉 버퍼 높이 반환. (픽셀, 마지막으로 맞춘 뷰포트)
	//==============================================================================
	/**
	 * @returns { number } 드로잉 버퍼 높이. (픽셀)
	 */
	getDrawingBufferHeight() {
		return this.#appliedViewportHeight;
	}

	//==============================================================================
	// 지금 그린 화면 읽기. (너비, 높이, 위에서 아래로 놓인 RGBA. 화면을 넘기기 전에 부른다)
	// - 캔버스처럼 불투명으로 본다. (알파 255)
	//==============================================================================
	/**
	 * @returns { { width: number, height: number, pixels: Uint8Array } } 화면 픽셀. ({ width, height, pixels }, pixels 는 위 줄부터 RGBA, 알파 255)
	 */
	readFramebufferPixels() {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const width = System.Math.max(0, this.#appliedViewportWidth);
		const height = System.Math.max(0, this.#appliedViewportHeight);
		const rowByteCount = width * 4;
		const bottomUpPixels = new System.Uint8Array(rowByteCount * height);
		webGL2RenderingContext.pixelStorei(webGL2RenderingContext.PACK_ALIGNMENT, 1);
		webGL2RenderingContext.readPixels(0, 0, width, height, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, bottomUpPixels);
		const topDownPixels = new System.Uint8Array(rowByteCount * height);
		for (let rowIndex = 0; rowIndex < height; rowIndex++) {
			const sourceStart = (height - 1 - rowIndex) * rowByteCount;
			topDownPixels.set(bottomUpPixels.subarray(sourceStart, sourceStart + rowByteCount), rowIndex * rowByteCount);
		}
		for (let alphaIndex = 3; alphaIndex < topDownPixels.length; alphaIndex += 4) {
			topDownPixels[alphaIndex] = 255;
		}
		return { width: width, height: height, pixels: topDownPixels };
	}

	//==============================================================================
	// 셰이더 프로그램 반환.
	//==============================================================================
	/**
	 * @returns { ShaderProgram } 지금 쓰는 셰이더 프로그램. (바꿔 끼운 것이 있으면 그것)
	 */
	getShaderProgram() {
		if (this.#shaderProgramOverride) {
			return this.#shaderProgramOverride;
		}
		return this.#shaderProgram;
	}

	//==============================================================================
	// 셰이더 프로그램 바꿔 끼우기. (null 이면 기본 프로그램으로 복귀)
	// - 기본 프로그램과 같은 어트리뷰트 위치 / 유니폼 이름(projectionMatrix, modelMatrix, mainColor, tintColor, globalAlpha, mainTexture)을 갖춰야 한다.
	//==============================================================================
	/**
	 * @param { ShaderProgram | null } shaderProgram 바꿔 끼울 셰이더 프로그램. (null 이면 기본 프로그램)
	 */
	setShaderProgramOverride(shaderProgram) {
		this.flushSpriteBatch();
		this.#shaderProgramOverride = shaderProgram;
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const activeShaderProgram = this.getShaderProgram();
		this.useShaderProgram(activeShaderProgram);
		const projectionMatrixLocation = activeShaderProgram.getUniformLocation("projectionMatrix");
		webGL2RenderingContext.uniformMatrix3fv(projectionMatrixLocation, false, this.#projectionMatrixArray);
		const mainTextureLocation = activeShaderProgram.getUniformLocation("mainTexture");
		webGL2RenderingContext.uniform1i(mainTextureLocation, 0);
		this.applyImageMipmapBias(activeShaderProgram);
	}

	//==============================================================================
	// 렌더 상태 복구. (외부 WebGL 패스가 프로그램 / 버텍스 어레이 / 뷰포트를 바꾼 뒤 Graphic 출력을 이어갈 때)
	// - 마지막으로 쓰게 한 프로그램과 묶은 텍스처의 기억도 잊는다. (invalidateRenderStateCache)
	//==============================================================================
	restoreRenderState() {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.viewport(0, 0, this.#appliedViewportWidth, this.#appliedViewportHeight);
		this.invalidateRenderStateCache();
		const shaderProgram = this.getShaderProgram();
		this.useShaderProgram(shaderProgram);
		webGL2RenderingContext.bindVertexArray(this.getVertexArray());
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.getVertexBuffer());
		const projectionMatrixLocation = shaderProgram.getUniformLocation("projectionMatrix");
		webGL2RenderingContext.uniformMatrix3fv(projectionMatrixLocation, false, this.#projectionMatrixArray);
		const mainTextureLocation = shaderProgram.getUniformLocation("mainTexture");
		webGL2RenderingContext.uniform1i(mainTextureLocation, 0);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		webGL2RenderingContext.enable(webGL2RenderingContext.BLEND);
		webGL2RenderingContext.disable(webGL2RenderingContext.DEPTH_TEST);
		webGL2RenderingContext.disable(webGL2RenderingContext.CULL_FACE);
		const blendMode = this.getBlendMode();
		this.setBlendMode(blendMode);
	}

	//==============================================================================
	// 셰이더 프로그램 쓰게 하기. (마지막으로 쓰게 한 것과 같으면 다시 걸지 않는다)
	//==============================================================================
	/**
	 * @param { ShaderProgram } shaderProgram 쓸 셰이더 프로그램.
	 */
	useShaderProgram(shaderProgram) {
		if (shaderProgram === this.#boundShaderProgram) {
			return;
		}
		shaderProgram.use();
		this.#boundShaderProgram = shaderProgram;
	}

	//==============================================================================
	// 0 번 텍스처 유닛에 텍스처 묶기. (마지막으로 묶은 것과 같으면 다시 묶지 않는다)
	//==============================================================================
	/**
	 * @param { WebGLTexture } texture 묶을 텍스처.
	 */
	bindTexture(texture) {
		if (texture === this.#boundTexture) {
			return;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, texture);
		this.#boundTexture = texture;
	}

	//==============================================================================
	// 묶음 기억 잊기.
	// - Graphic 은 마지막으로 쓰게 한 셰이더 프로그램과 0 번 유닛에 묶은 텍스처(셰이더 섞기 모드면 1 번 유닛에 묶은 떠 온 아래도)를 기억해, 같으면 다시 걸지 않는다.
	// - Graphic 을 거치지 않고 WebGL 로 프로그램이나 텍스처를 바꾼 뒤 Graphic 출력을 이어갈 때 부른다.
	//   (restoreRenderState, applySettings 와 컨텍스트를 잃거나 되살릴 때는 스스로 잊는다)
	//==============================================================================
	invalidateRenderStateCache() {
		this.#boundShaderProgram = null;
		this.#boundTexture = null;
		this.#boundBackdropTexture = null;
	}

	//==============================================================================
	// 깊이 버퍼 비우기. (2D 그리기 사이에 3D 를 끼우기 전에)
	// - 자르기(beginClipRect, 스텐실)를 건 뒤 그리는 도중에 깊이를 비우면 갤럭시 폴드3(Adreno 660)의 드라이버가 3D 를 하나도 그리지 못한 일이 있다.
	//   자르기 안에 3D 를 그릴 노드는 beginClipRect 앞에서 이것을 부르고, runExternalPass 에는 clearDepth: false 를 준다.
	//==============================================================================
	clearDepthBuffer() {
		this.flushSpriteBatch();
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.depthMask(true);
		webGL2RenderingContext.clear(webGL2RenderingContext.DEPTH_BUFFER_BIT);
	}

	//==============================================================================
	// 2D 그리기 사이에 WebGL 패스 끼우기. (앞의 2D 묶음을 그리고, 상태 기억을 잊고, 깊이를 비운 뒤 callback, 끝나면 restoreRenderState)
	// - callback 은 WebGL2 컨텍스트를 받아 프로그램, 버텍스 어레이, 뷰포트, 섞기, 깊이, 면 가리기를 마음대로 바꿔도 된다. (스텐실 자르기는 그대로 걸려 있고, 스텐실 상태는 되돌리지 않으므로 바꾸지 않는다)
	// - callback 이 던지면 상태를 되돌린 뒤 다시 던진다.
	//==============================================================================
	/**
	 * @param { Function } callback (webGL2RenderingContext) => any
	 * @param { object } [options] { clearDepth 깊이를 비울지 (기본 true, 자르기 안이면 clearDepthBuffer 머리말) }
	 * @returns { any } callback 이 돌려준 것.
	 * @example <caption>2D 사이에 WebGL 직접 그리기 끼우기</caption>
	 * import { Engine, EngineConfiguration, Scene, Vector2, Rect } from "./build/vanilla.js";
	 *
	 * class MainScene extends Scene {
	 * 	draw(graphic) {
	 * 		super.draw(graphic);
	 * 		graphic.setFillColor("#888888");
	 * 		graphic.drawRect(Rect.create(0, 0, 640, 360));
	 * 		graphic.runExternalPass((webGL2RenderingContext) => {
	 * 			webGL2RenderingContext.enable(webGL2RenderingContext.SCISSOR_TEST);
	 * 			webGL2RenderingContext.scissor(20, 20, 100, 100);
	 * 			webGL2RenderingContext.clearColor(0.2, 0.4, 0.8, 1);
	 * 			webGL2RenderingContext.clear(webGL2RenderingContext.COLOR_BUFFER_BIT);
	 * 			webGL2RenderingContext.disable(webGL2RenderingContext.SCISSOR_TEST);
	 * 		}, { clearDepth: false });
	 * 		graphic.setFillColor("#ffffff");
	 * 		graphic.drawCircle(Vector2.create(320, 180), 40);
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	runExternalPass(callback, options = {}) {
		const isDepthCleared = options.clearDepth !== false;
		this.flushSpriteBatch();
		if (isDepthCleared) {
			this.clearDepthBuffer();
		}
		this.invalidateRenderStateCache();
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		try {
			return callback(webGL2RenderingContext);
		}
		finally {
			this.restoreRenderState();
		}
	}

	//==============================================================================
	// 버텍스 어레이 반환.
	//==============================================================================
	/**
	 * @returns { WebGLVertexArrayObject } 버텍스 어레이.
	 */
	getVertexArray() {
		return this.#vertexArray;
	}

	//==============================================================================
	// 버텍스 버퍼 반환.
	//==============================================================================
	/**
	 * @returns { WebGLBuffer } 버텍스 버퍼.
	 */
	getVertexBuffer() {
		return this.#vertexBuffer;
	}

	//==============================================================================
	// 스크래치 버텍스 데이터 반환.
	//==============================================================================
	/**
	 * @returns { Float32Array } 스크래치 버텍스 데이터. (정점마다 x, y, u, v)
	 */
	getVertexData() {
		return this.#vertexData;
	}

	//==============================================================================
	// 흰색 텍스처 반환. (단색 도형용)
	//==============================================================================
	/**
	 * @returns { WebGLTexture } 1x1 흰색 텍스처.
	 */
	getWhiteTexture() {
		return this.#whiteTexture;
	}

	//==============================================================================
	// 흰색 색상 반환. (이미지/텍스트 출력용 기본 색상)
	//==============================================================================
	/**
	 * @returns { Color } 흰색. (나눠 쓰므로 고치지 않는다)
	 */
	getWhiteColor() {
		return this.#whiteColor;
	}

	//==============================================================================
	// 이미지 텍스처 캐시 반환.
	//==============================================================================
	/**
	 * @returns { ImageTextureCache } 이미지 텍스처 캐시.
	 */
	getImageTextureCache() {
		return this.#imageTextureCache;
	}

	//==============================================================================
	// 문자열 텍스처 캐시 반환.
	//==============================================================================
	/**
	 * @returns { TextStringTextureCache } 문자열 텍스처 캐시.
	 */
	getTextStringTextureCache() {
		return this.#textStringTextureCache;
	}
}
