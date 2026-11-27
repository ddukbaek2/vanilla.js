//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


/**
 * @example <caption>머티리얼 조각에서 색 공간마다 sRGB 색을 바탕색에 섞기</caption>
 * import { ToonRenderer, ToonMaterial, ColorSpace, composeToonProgramSources } from "./vanilla.js";
 * const material = new ToonMaterial({
 * 	name: "stripe",
 * 	uniformChunk: "uniform vec3 stripeColor;\n",
 * 	surfaceChunk: `void applySurface(inout ToonSurface surface) {
 * 	float stripe = step(0.5, fract(surface.uv.x * 8.0));
 * #ifdef VANILLA_COLOR_SPACE_LINEAR
 * 	surface.baseColor = mix(surface.baseColor, toLinear(stripeColor), stripe);
 * #else
 * 	surface.baseColor = mix(surface.baseColor, stripeColor, stripe);
 * #endif
 * }`,
 * });
 * const renderer = new ToonRenderer(document.createElement("canvas").getContext("webgl2"), { colorSpace: ColorSpace.linear });
 * renderer.prepareMaterial(material);
 * if (!composeToonProgramSources(material, null, renderer.getColorSpace()).solidFragmentShader.includes("#define VANILLA_COLOR_SPACE_LINEAR 1")) {
 * 	throw new Error("linear define is missing");
 * }
 */


//==============================================================================
// 색 공간. (게임마다 3D 빛 셈을 어느 공간에서 할지 고르는 칸, 유니티 Player Settings 의 Color Space 꼴)
// - gamma(기본): 지금까지의 길이다. 색 텍스처를 RGBA 로 올리고 셰이더가 pow(색, 2.2) 근사로 선형으로 바꿔 빛을 셈하고 pow(1 / 2.2) 로 화면 색을 낸다.
//   바탕색, 틴트, 데칼은 감마를 건 색(sRGB) 그대로 곱하고 섞는다. 이미 나온 게임의 화면이 바뀌지 않는다.
// - linear: 3D 의 정석 길이다. 색 텍스처(바탕색, 빛남, 데칼, 매트캡, 천사 고리, 램프)를 SRGB8_ALPHA8 로 올려 GPU 가 선형으로 풀어 읽고
//   (거르기와 밉맵이 선형 공간) 넘기는 색(꼭짓점 색, 틴트, 빛남 색, 데칼 색, 바깥선 색)은 sRGB 표준 곡선(IEC 61966-2-1)으로 선형으로 바꿔
//   곱하고 섞는다. 화면에 낼 때도 같은 곡선으로 sRGB 로 바꾼다. 노멀, 마스크 같은 자료 텍스처는 선형 그대로. (ToonRenderer.createTexture 의 isColorData: false)
// - 게임은 EngineConfiguration.colorSpace 로 한 번 고른다. 툰 렌더러, 후처리, 화면 바깥선, GLB 읽기는 따로 주지 않으면 엔진의 값을 따른다.
//   (엔진을 만들지 않은 페이지는 gamma) 고른 값은 짓는 때 정해지고 그 뒤에 바뀌지 않는다. (프로그램과 텍스처 형식이 갈리므로)
// - 2D(Graphic 의 2D 묶음, 글자, UI)는 어느 값이든 지금처럼 감마 공간(sRGB 값 그대로)에서 섞고 합성한다. 이 칸은 3D(툰) 길만 가른다.
// - 셰이더: linear 면 엔진이 짓는 3D 셰이더의 #version 다음 줄에 #define VANILLA_COLOR_SPACE_LINEAR 1 이 들어간다.
//   머티리얼 조각은 #ifdef VANILLA_COLOR_SPACE_LINEAR 로 가를 수 있다. (유니티 셰이더의 UNITY_COLORSPACE_GAMMA 와 같은 쓰임)
//==============================================================================


//==============================================================================
// 색 공간 종류.
//==============================================================================
/**
 * @example <caption>3D 를 선형 색 공간으로 그리는 게임의 엔진 설정</caption>
 * import { Engine, EngineConfiguration, ColorSpace, Scene, Vector2 } from "./vanilla.js";
 * const engineConfiguration = new EngineConfiguration();
 * engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
 * engineConfiguration.colorSpace = ColorSpace.linear;
 * const engine = new Engine(engineConfiguration);
 * if (engine.getColorSpace() !== ColorSpace.linear || engine.getGraphic().getColorSpace() !== ColorSpace.linear) {
 * 	throw new Error("color space is not linear");
 * }
 */
export const ColorSpace = System.Object.freeze({
	gamma: "gamma", // 감마 공간. (기본, 지금까지의 화면, pow 2.2 근사)
	linear: "linear", // 선형 공간. (sRGB 텍스처, sRGB 표준 곡선, 3D 의 정석)
});

// linear 일 때 셰이더 #version 다음 줄에 넣는 정의.
const LINEAR_DEFINE_LINE = "#define VANILLA_COLOR_SPACE_LINEAR 1\n";


//==============================================================================
// 값을 색 공간으로 읽기. (ColorSpace.linear 만 linear, 그 밖은 모두 gamma)
//==============================================================================
/**
 * @param { string } value - 색 공간 값.
 * @returns { string } ColorSpace.linear 나 ColorSpace.gamma.
 * @example <caption>모르는 값은 gamma 로</caption>
 * import { ColorSpace, readColorSpace } from "./src/core/graphic/colorspace.js";
 * if (readColorSpace("linear") !== ColorSpace.linear || readColorSpace("srgb") !== ColorSpace.gamma || readColorSpace(undefined) !== ColorSpace.gamma) {
 * 	throw new Error("unexpected color space");
 * }
 */
export function readColorSpace(value) {
	return value === ColorSpace.linear ? ColorSpace.linear : ColorSpace.gamma;
}

//==============================================================================
// 엔진의 색 공간 읽기. (마지막으로 만든 엔진의 EngineConfiguration.colorSpace, 엔진이 없으면 gamma)
// - 툰 렌더러, 후처리, 화면 바깥선, GLB 읽기가 따로 받지 않을 때 쓰는 기본값이다.
//==============================================================================
/**
 * @returns { string } ColorSpace.linear 나 ColorSpace.gamma.
 * @example <caption>엔진이 없는 페이지는 gamma</caption>
 * import { ColorSpace, readEngineColorSpace } from "./src/core/graphic/colorspace.js";
 * if (globalThis.vanillaEngine === undefined && readEngineColorSpace() !== ColorSpace.gamma) {
 * 	throw new Error("unexpected color space");
 * }
 */
export function readEngineColorSpace() {
	const engine = System.vanillaEngine;
	if (engine === undefined || engine === null || typeof engine.getColorSpace !== "function") {
		return ColorSpace.gamma;
	}
	return readColorSpace(engine.getColorSpace());
}

//==============================================================================
// 셰이더 소스에 색 공간 정의 넣기. (linear 면 첫 줄 #version 다음에 #define VANILLA_COLOR_SPACE_LINEAR 1, gamma 면 그대로)
//==============================================================================
/**
 * @param { string } source - #version 줄로 시작하는 GLSL 소스.
 * @param { string } colorSpace - ColorSpace 값.
 * @returns { string } 정의를 넣은 소스. (gamma 면 같은 글)
 * @example <caption>linear 소스에만 정의가 들어간다</caption>
 * import { ColorSpace, addColorSpaceDefine } from "./src/core/graphic/colorspace.js";
 * const source = "#version 300 es\nprecision highp float;\n";
 * if (addColorSpaceDefine(source, ColorSpace.gamma) !== source || !addColorSpaceDefine(source, ColorSpace.linear).startsWith("#version 300 es\n#define VANILLA_COLOR_SPACE_LINEAR 1\n")) {
 * 	throw new Error("unexpected define");
 * }
 */
export function addColorSpaceDefine(source, colorSpace) {
	if (readColorSpace(colorSpace) !== ColorSpace.linear) {
		return source;
	}
	const lineEnd = source.indexOf("\n");
	if (lineEnd < 0 || !source.startsWith("#version")) {
		return LINEAR_DEFINE_LINE + source;
	}
	return source.slice(0, lineEnd + 1) + LINEAR_DEFINE_LINE + source.slice(lineEnd + 1);
}
