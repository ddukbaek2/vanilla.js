//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


/**
 * @example <caption>그늘 색 두 단계와 단단한 하이라이트, 림, 스포트라이트를 건 빛 묶음</caption>
 * import { ToonLightSet } from "./vanilla.js";
 * const lightSet = new ToonLightSet();
 * lightSet.setLight([-0.4, -1, -0.3], [0.85, 0.82, 0.78], [0.3, 0.33, 0.42], [0.16, 0.15, 0.14]);
 * lightSet.setShade({ step: 0.5, feather: 0.02, color: [0.55, 0.52, 0.7], secondStep: 0.25, secondFeather: 0.02, secondColor: [0.36, 0.33, 0.52] });
 * lightSet.setSpecular(0.6, 64, 0);
 * lightSet.setRimLight([0.5, 0.55, 0.7], 3, 0.2, 1);
 * lightSet.setPointLights([{ position: [0, 3, 0], color: [1, 0.8, 0.6], intensity: 3, range: 6, direction: [0, -1, 0], innerConeAngle: 0.3, outerConeAngle: 0.6 }]);
 */


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 한 그리기에 받는 점광과 스포트라이트 수의 상한. (셰이더의 유니폼 배열 크기)
export const TOON_MAXIMUM_POINT_LIGHTS = 8;

// 그늘 램프 칸 수의 상한. (셰이더의 유니폼 배열 크기)
export const TOON_MAXIMUM_BAND_STEPS = 8;

// 빛 묶음마다 다른 번호를 주는 셈. (렌더러가 프로그램마다 마지막으로 올린 묶음을 가린다)
let nextLightSetId = 1;


//==============================================================================
// 3 수 벡터 길이를 1 로. (길이 0 이면 아래쪽)
//==============================================================================
/**
 * @param { Array<number> } direction - [x, y, z].
 * @returns { Array<number> } 길이 1 인 [x, y, z].
 */
function normalizeDirection(direction) {
	const length = System.Math.hypot(direction[0], direction[1], direction[2]);
	if (length <= 0) {
		return [0, -1, 0];
	}
	return [direction[0] / length, direction[1] / length, direction[2] / length];
}


//==============================================================================
// 툰 빛 묶음. (ToonRenderer 가 몸을 칠할 빛과 툰 빛 반응을 한 덩어리로 든다)
// - 렌더러는 기본 묶음 하나를 들고, setLight 같은 렌더러의 빛 설정은 그 묶음을 고친다. 그리기마다 options.lightSet 으로 다른 묶음을 줄 수 있다. (재질마다 그늘 색이 다를 때)
// - 해(주광): 방향(sunDirection)은 빛이 나아가는 쪽이다. 면에서 해 쪽을 가리키는 방향의 반대다. (위에서 내리쬐면 [0, -1, 0]) 그림자를 받는다.
// - 바탕빛: 하늘색과 땅색을 노멀의 위아래(N.y x 0.5 + 0.5)로 섞는다. (반구 빛)
// - 그늘 램프(셀 셰이딩): 빛을 받는 몫 x 를 램프에 대어 색을 고른다. x 는 반 램버트면 dot(N, L) x 0.5 + 0.5, 아니면 max(dot(N, L), 0) 이고,
//   그리기의 shadeOffset 을 더한 뒤 해는 그림자(받는 몫 0 ~ 1)를 곱한다. (그림자가 검정이 아니라 그늘 색으로 들어간다, 유니티 툰 셰이더의 System Shadows)
//   램프는 칸(stop)마다 자리, 색(선형 배), 부드러움이다. 칸 i 의 색은 x 가 (자리 - 부드러움) 에서 자리까지 오를 때 앞 칸 색에서 넘어간다. (유니티 툰 셰이더의 Step 과 Feather)
//   부드러움이 화소 하나 너비(fwidth)보다 작으면 그 너비로 막아 경계가 계단지지 않는다.
//   setShade 는 바탕, 1 차 그늘, 2 차 그늘 셋(유니티 툰 셰이더의 Base, 1st Shade, 2nd Shade)으로, setShadeRamp 는 칸을 바로, setBandCount 는 고른 칸으로, setBandRamp 는 회색 칸으로 램프를 짓는다.
//   setRampTexture 를 주면 칸 대신 그 텍스처의 가로(x 를 u 로, v 는 0.5)를 읽는다. (팀 포트리스 2 의 warp, 원신과 붕괴의 램프 텍스처)
//   칸이 없으면(clearShadeRamp, setBandCount(0)) 부드러운 램버트다.
// - 빛마다: 해는 램프 색을 통째로 받아 그늘도 해의 색으로 물든다. 채움 빛, 점광, 스포트라이트는 램프의 밝기 단계(바닥 칸이 0, 맨 위 칸이 1)를 받아 등진 면을 밝히지 않는다.
// - 채움 빛(fill): 그림자를 받지 않는 둘째 방향광. 방향의 뜻은 해와 같다. 기본 색 0 이면 없다.
// - 하이라이트(정반사): 블린 퐁 pow(max(dot(N, H), 0), exponent) 를 0.5 에서 가른 단단한 점(부드러움 0)에서 그대로의 부드러운 빛(부드러움 1)까지. 색 x 세기 x 빛 색 x 빛을 받는 단계.
//   해와 점광, 스포트라이트 모두에 선다. 기본 세기 0 이면 없다.
// - 림 빛(rim): pow(1 - max(dot(N, V), 0), power) 를 0.5 에서 가른 단단한 테(부드러움 0)에서 부드러운 테(1)까지. lightMask 가 1 이면 해를 받는 쪽에만. 바탕색과 상관없이 더한다.
//   그늘 쪽 림(setShadeRimLight)은 같은 테를 해와 등진 쪽에 (테 - (dot(N, L) x 0.5 + 0.5)) 만큼 더한다. (유니티 툰 셰이더의 Antipodean(Ap) Rim Light)
// - 빛 색 쓰기(setLightColorUsage): 색마다 빛 색을 곱할지 고른다. 끄면 그 색은 빛의 밝기(휘도)만 받고, 림과 매트캡과 천사 고리와 바깥선은 빛을 받지 않는다. (유니티 툰 셰이더의 Is_LightColor_*, 기본 모두 켬)
// - 점광과 스포트라이트: TOON_MAXIMUM_POINT_LIGHTS 까지. { position, color(선형), intensity, range, decay, rangeExponent, wrap, direction, innerConeAngle, outerConeAngle, castsShadow, shadowNear }
//   castsShadow 가 true 인 빛은 ShadowAtlas.updateLights 가 그림자 칸을 준다. (점광은 큐브 여섯 면, 스포트라이트는 원근 한 칸, 먼 거리는 range, 가까운 거리는 shadowNear 기본 0.05)
//   감쇠는 창 x 거리 감쇠다. 창은 range 가 0 보다 크면 (1 - (거리 / range)^rangeExponent) 를 0 ~ 1 로 막아 제곱, 0 이면 1. 거리 감쇠는 decay 가 0 보다 크면 1 / max(거리^decay, 0.01), 0 이면 1.
//   기본(decay 2, rangeExponent 4)은 three.js 와 언리얼, 고도 4 의 점광 꼴이다.
//   direction(빛이 나아가는 쪽)을 주면 스포트라이트다. 각 감쇠는 glTF KHR_lights_punctual 꼴로 clamp(cos 각 x scale + offset, 0, 1) 의 제곱이다. (innerConeAngle 기본 0, outerConeAngle 기본 π/4, 라디안)
//   받는 몫은 감싸기(wrap) (dot(N, L) + wrap) / (1 + wrap) 이다. (0 이면 램버트, GPU Gems 1 의 wrap lighting)
// - 빛 꼴: setLightModel({ isEnergyNormalized }) 가 true 면 바탕색 x 빛을 π 로 나누고 하이라이트에 (exponent + 8) / 8π 를 곱한다. (물리 빛 세기를 조도로 주는 약속)
// - 색은 모두 선형 색이다. (HDR 이면 1 을 넘어도 된다) 램프 텍스처는 sRGB 로 보고 선형으로 바꿔 읽는다.
// - 고치면 판 번호(getVersion)가 오른다. 렌더러는 묶음과 판 번호가 같으면 다시 올리지 않는다.
//==============================================================================
/**
 * @example <caption>재질마다 다른 그늘 색을 빛 묶음으로 주기</caption>
 * import { ToonRenderer, ToonMesh, Matrix4, Vector3 } from "./vanilla.js";
 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
 * const renderer = new ToonRenderer(webGL2RenderingContext);
 * const skinLightSet = renderer.createLightSet();
 * skinLightSet.setShade({ step: 0.55, feather: 0.04, color: [0.86, 0.6, 0.6] });
 * const builder = new ToonMesh.MeshBuilder();
 * builder.addPart(ToonMesh.createSphereGeometry(0.5, 32, 20), Matrix4.createIdentity(), "#f0d0c0", { hasOutline: false });
 * const mesh = renderer.createMesh(builder.readArrays());
 * renderer.beginFrameWithMatrices(Matrix4.createLookAt(Vector3.create(0, 0, 3), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0)), Matrix4.createPerspective(0.8, 1, 0.1, 10));
 * renderer.drawMesh(mesh, Matrix4.createIdentity(), { lightSet: skinLightSet });
 * renderer.endFrame();
 */
export class ToonLightSet {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #id;
	/** @private @type { number } */ #version;
	/** @private @type { Array<number> } */ #sunDirection;
	/** @private @type { Array<number> } */ #sunColor;
	/** @private @type { Array<number> } */ #skyColor;
	/** @private @type { Array<number> } */ #groundColor;
	/** @private @type { Array<number> } */ #fillDirection;
	/** @private @type { Array<number> } */ #fillColor;
	/** @private @type { Array<number> } */ #rimColor;
	/** @private @type { number } */ #rimPower;
	/** @private @type { number } */ #rimFeather;
	/** @private @type { number } */ #rimLightMask;
	/** @private @type { Array<number> } */ #shadeRimColor;
	/** @private @type { number } */ #shadeRimPower;
	/** @private @type { object } */ #lightColorUsage; // { base, shade, highlight, rim, shadeRim, matcap, angelRing, outline }
	/** @private @type { number } */ #specularStrength;
	/** @private @type { number } */ #specularExponent;
	/** @private @type { number } */ #specularFeather;
	/** @private @type { Array<number> } */ #specularColor;
	/** @private @type { Array<object> } */ #pointLights;
	/** @private @type { number } */ #pointLightLimit;
	/** @private @type { Array<number> } */ #shadePositions; // 램프 칸의 자리. (첫 칸은 쓰지 않는다)
	/** @private @type { Array<Array<number>> } */ #shadeColors; // 램프 칸의 색. (선형 배)
	/** @private @type { Array<number> } */ #shadeFeathers; // 램프 칸의 부드러움. (첫 칸은 쓰지 않는다)
	/** @private @type { boolean } */ #isShadeHalfLambert;
	/** @private @type { WebGLTexture | null } */ #rampTexture;
	/** @private @type { boolean } */ #isEnergyNormalized;

	//==============================================================================
	// 생성. (기본은 반 램버트 0.5 에서 갈리는 두 단계 그늘, 그늘 색은 서늘한 보라)
	//==============================================================================
	constructor() {
		this.#id = nextLightSetId;
		nextLightSetId += 1;
		this.#version = 0;
		this.#sunDirection = [-0.4, -1.0, -0.3];
		this.#sunColor = [0.84, 0.8, 0.74];
		this.#skyColor = [0.3, 0.33, 0.42];
		this.#groundColor = [0.17, 0.16, 0.15];
		this.#fillDirection = [0, -1, 0];
		this.#fillColor = [0, 0, 0];
		this.#rimColor = [0, 0, 0];
		this.#rimPower = 0;
		this.#rimFeather = 1;
		this.#rimLightMask = 0;
		this.#shadeRimColor = [0, 0, 0];
		this.#shadeRimPower = 0;
		this.#lightColorUsage = { base: true, shade: true, highlight: true, rim: true, shadeRim: true, matcap: true, angelRing: true, outline: true };
		this.#specularStrength = 0;
		this.#specularExponent = 48;
		this.#specularFeather = 0;
		this.#specularColor = [1, 1, 1];
		this.#pointLights = [];
		this.#pointLightLimit = TOON_MAXIMUM_POINT_LIGHTS;
		this.#shadePositions = [];
		this.#shadeColors = [];
		this.#shadeFeathers = [];
		this.#isShadeHalfLambert = true;
		this.#rampTexture = null;
		this.#isEnergyNormalized = false;
		this.setShade({});
	}

	//==============================================================================
	// 고친 판 올리기.
	//==============================================================================
	markChanged() {
		this.#version += 1;
	}

	//==============================================================================
	// 번호 반환. (묶음마다 다르다)
	//==============================================================================
	/**
	 * @returns { number } 묶음 번호.
	 */
	getId() {
		return this.#id;
	}

	//==============================================================================
	// 판 번호 반환. (고칠 때마다 오른다)
	//==============================================================================
	/**
	 * @returns { number } 판 번호.
	 */
	getVersion() {
		return this.#version;
	}

	//==============================================================================
	// 해와 바탕빛 설정. (해가 비추는 방향, 해의 색, 하늘색, 땅색, 모두 선형)
	//==============================================================================
	/**
	 * @param { Array<number> } sunDirection - 빛이 나아가는 쪽. [x, y, z]
	 * @param { Array<number> } sunColor - 해의 선형 색과 세기. [r, g, b]
	 * @param { Array<number> } skyColor - 위를 보는 면의 바탕빛. [r, g, b]
	 * @param { Array<number> } groundColor - 아래를 보는 면의 바탕빛. [r, g, b]
	 */
	setLight(sunDirection, sunColor, skyColor, groundColor) {
		this.#sunDirection = sunDirection.slice();
		this.#sunColor = sunColor.slice();
		this.#skyColor = skyColor.slice();
		this.#groundColor = groundColor.slice();
		this.markChanged();
	}

	//==============================================================================
	// 해가 비추는 방향 설정. (빛이 나아가는 쪽, 면에서 해 쪽 방향이면 부호를 뒤집어 준다)
	//==============================================================================
	/**
	 * @param { Array<number> } sunDirection - [x, y, z]
	 */
	setSunDirection(sunDirection) {
		this.#sunDirection = sunDirection.slice();
		this.markChanged();
	}

	//==============================================================================
	// 해가 비추는 방향 반환. (ShadowMap.updateLightMatrix 에 그대로 넘긴다)
	//==============================================================================
	/**
	 * @returns { Array<number> } [x, y, z]
	 */
	getSunDirection() {
		return this.#sunDirection;
	}

	//==============================================================================
	// 해의 색 반환.
	//==============================================================================
	/**
	 * @returns { Array<number> } 선형 [r, g, b].
	 */
	getSunColor() {
		return this.#sunColor;
	}

	//==============================================================================
	// 하늘색 반환.
	//==============================================================================
	/**
	 * @returns { Array<number> } 선형 [r, g, b].
	 */
	getSkyColor() {
		return this.#skyColor;
	}

	//==============================================================================
	// 땅색 반환.
	//==============================================================================
	/**
	 * @returns { Array<number> } 선형 [r, g, b].
	 */
	getGroundColor() {
		return this.#groundColor;
	}

	//==============================================================================
	// 채움 빛 설정. (빛이 나아가는 방향과 선형 색, 색이 0 이면 없음, 그림자를 받지 않음)
	//==============================================================================
	/**
	 * @param { Array<number> } fillDirection - 빛이 나아가는 쪽. [x, y, z]
	 * @param { Array<number> } fillColor - 선형 [r, g, b].
	 */
	setFillLight(fillDirection, fillColor) {
		this.#fillDirection = normalizeDirection(fillDirection);
		this.#fillColor = fillColor.slice();
		this.markChanged();
	}

	//==============================================================================
	// 채움 빛 반환.
	//==============================================================================
	/**
	 * @returns { object } { direction, color }
	 */
	getFillLight() {
		return { direction: this.#fillDirection, color: this.#fillColor };
	}

	//==============================================================================
	// 림 빛 설정. (선형 색, 거듭제곱, 부드러움 0 ~ 1, 해를 받는 쪽에만 둘 몫 0 ~ 1, 거듭제곱이 0 이하면 없음)
	//==============================================================================
	/**
	 * @param { Array<number> } rimColor - 더할 선형 색. [r, g, b]
	 * @param { number } rimPower - 거듭제곱. (클수록 테가 가늘다, 0 이면 없음)
	 * @param { number } [rimFeather] - 0 이면 단단한 테, 1 이면 부드러운 테. (기본 1)
	 * @param { number } [rimLightMask] - 1 이면 해를 받는 쪽에만 테를 둔다. (기본 0)
	 * @example <caption>해 쪽에만 서는 단단한 테</caption>
	 * import { ToonLightSet } from "./vanilla.js";
	 * const lightSet = new ToonLightSet();
	 * lightSet.setRimLight([0.6, 0.65, 0.8], 2.5, 0, 1);
	 */
	setRimLight(rimColor, rimPower, rimFeather = 1, rimLightMask = 0) {
		this.#rimColor = rimColor.slice();
		this.#rimPower = System.Math.max(0, rimPower);
		this.#rimFeather = System.Math.max(0, System.Math.min(1, rimFeather));
		this.#rimLightMask = System.Math.max(0, System.Math.min(1, rimLightMask));
		this.markChanged();
	}

	//==============================================================================
	// 림 빛 반환.
	//==============================================================================
	/**
	 * @returns { object } { color, power, feather, lightMask }
	 */
	getRimLight() {
		return { color: this.#rimColor, power: this.#rimPower, feather: this.#rimFeather, lightMask: this.#rimLightMask };
	}

	//==============================================================================
	// 그늘 쪽 림 빛 설정. (해와 등진 쪽의 테, 선형 색, 거듭제곱, 부드러움은 setRimLight 의 것을 같이 쓴다, 거듭제곱이 0 이하면 없음)
	//==============================================================================
	/**
	 * @param { Array<number> } shadeRimColor - 더할 선형 색. [r, g, b]
	 * @param { number } shadeRimPower - 거듭제곱. (0 이면 없음)
	 * @example <caption>그늘 쪽에 푸른 테</caption>
	 * import { ToonLightSet } from "./vanilla.js";
	 * const lightSet = new ToonLightSet();
	 * lightSet.setRimLight([0.8, 0.75, 0.6], 3, 0.1, 1);
	 * lightSet.setShadeRimLight([0.2, 0.3, 0.6], 2.5);
	 */
	setShadeRimLight(shadeRimColor, shadeRimPower) {
		this.#shadeRimColor = shadeRimColor.slice();
		this.#shadeRimPower = System.Math.max(0, shadeRimPower);
		this.markChanged();
	}

	//==============================================================================
	// 그늘 쪽 림 빛 반환.
	//==============================================================================
	/**
	 * @returns { object } { color, power }
	 */
	getShadeRimLight() {
		return { color: this.#shadeRimColor, power: this.#shadeRimPower };
	}

	//==============================================================================
	// 빛 색 쓰기 설정. (색마다 빛 색을 곱할지, 주지 않은 것은 그대로)
	// - base 바탕, shade 그늘, highlight 하이라이트, rim 림, shadeRim 그늘 쪽 림, matcap 매트캡, angelRing 천사 고리, outline 껍데기 바깥선.
	// - 바탕, 그늘, 하이라이트는 끄면 빛의 휘도(회색)를 받고, 나머지는 끄면 빛을 받지 않는다. (유니티 툰 셰이더 소스의 lightIntensity 와 1)
	//==============================================================================
	/**
	 * @param { object } lightColorUsage - { base, shade, highlight, rim, shadeRim, matcap, angelRing, outline } 의 참 거짓.
	 * @example <caption>그늘과 바깥선은 빛 색에 물들지 않게</caption>
	 * import { ToonLightSet } from "./vanilla.js";
	 * const lightSet = new ToonLightSet();
	 * lightSet.setLightColorUsage({ shade: false, outline: false });
	 */
	setLightColorUsage(lightColorUsage) {
		for (const key of System.Object.keys(this.#lightColorUsage)) {
			if (lightColorUsage[key] !== undefined) {
				this.#lightColorUsage[key] = lightColorUsage[key] === true;
			}
		}
		this.markChanged();
	}

	//==============================================================================
	// 빛 색 쓰기 반환.
	//==============================================================================
	/**
	 * @returns { object } { base, shade, highlight, rim, shadeRim, matcap, angelRing, outline }
	 */
	getLightColorUsage() {
		return System.Object.assign({}, this.#lightColorUsage);
	}

	//==============================================================================
	// 하이라이트(정반사) 설정. (세기 0 이면 없음, 지수가 클수록 작은 점, 부드러움 0 이면 단단한 툰 점, 1 이면 부드러운 블린 퐁)
	//==============================================================================
	/**
	 * @param { number } specularStrength - 세기. (0 이면 없음)
	 * @param { number } [specularExponent] - 블린 퐁 지수. (기본 48)
	 * @param { number } [specularFeather] - 0 ~ 1. (기본 0, 단단한 점)
	 * @param { Array<number> } [specularColor] - 선형 [r, g, b]. (기본 흰색)
	 * @example <caption>부드러운 하이라이트</caption>
	 * import { ToonLightSet } from "./vanilla.js";
	 * const lightSet = new ToonLightSet();
	 * lightSet.setSpecular(0.4, 32, 1, [1, 0.95, 0.9]);
	 */
	setSpecular(specularStrength, specularExponent = 48, specularFeather = 0, specularColor = [1, 1, 1]) {
		this.#specularStrength = System.Math.max(0, specularStrength);
		this.#specularExponent = System.Math.max(1, specularExponent);
		this.#specularFeather = System.Math.max(0, System.Math.min(1, specularFeather));
		this.#specularColor = specularColor.slice();
		this.markChanged();
	}

	//==============================================================================
	// 하이라이트 반환.
	//==============================================================================
	/**
	 * @returns { object } { strength, exponent, feather, color }
	 */
	getSpecular() {
		return { strength: this.#specularStrength, exponent: this.#specularExponent, feather: this.#specularFeather, color: this.#specularColor };
	}

	//==============================================================================
	// 점광과 스포트라이트 설정. (TOON_MAXIMUM_POINT_LIGHTS 를 넘는 것은 버린다, direction 을 주면 스포트라이트)
	//==============================================================================
	/**
	 * @param { Array<object> } pointLights - { position [x, y, z], color [r, g, b] 선형, intensity (기본 1), range (기본 0 = 끝없음), decay (기본 2), rangeExponent (기본 4), wrap (기본 0),
	 *   direction [x, y, z] (빛이 나아가는 쪽, 주면 스포트라이트), innerConeAngle (기본 0), outerConeAngle (기본 π/4), castsShadow (기본 false), shadowNear (기본 0.05) } 의 배열.
	 * @example <caption>아래를 비추는 스포트라이트 하나</caption>
	 * import { ToonLightSet } from "./vanilla.js";
	 * const lightSet = new ToonLightSet();
	 * lightSet.setPointLights([{ position: [0, 4, 0], color: [1, 0.9, 0.7], intensity: 4, range: 8, direction: [0, -1, 0], innerConeAngle: 0.25, outerConeAngle: 0.5 }]);
	 */
	setPointLights(pointLights) {
		this.#pointLights = pointLights.slice(0, TOON_MAXIMUM_POINT_LIGHTS).map((pointLight) => {
			return {
				position: pointLight.position.slice(),
				color: pointLight.color !== undefined ? pointLight.color.slice() : [1, 1, 1],
				intensity: pointLight.intensity !== undefined ? pointLight.intensity : 1,
				range: pointLight.range !== undefined ? System.Math.max(0, pointLight.range) : 0,
				decay: pointLight.decay !== undefined ? System.Math.max(0, pointLight.decay) : 2,
				rangeExponent: pointLight.rangeExponent !== undefined ? System.Math.max(0.0001, pointLight.rangeExponent) : 4,
				wrap: pointLight.wrap !== undefined ? System.Math.max(0, pointLight.wrap) : 0,
				direction: pointLight.direction !== undefined && pointLight.direction !== null ? normalizeDirection(pointLight.direction) : null,
				innerConeAngle: pointLight.innerConeAngle !== undefined ? System.Math.max(0, pointLight.innerConeAngle) : 0,
				outerConeAngle: pointLight.outerConeAngle !== undefined ? System.Math.max(0.0001, pointLight.outerConeAngle) : System.Math.PI / 4,
				castsShadow: pointLight.castsShadow === true,
				shadowNear: pointLight.shadowNear !== undefined ? System.Math.max(0.001, pointLight.shadowNear) : 0.05,
			};
		});
		this.markChanged();
	}

	//==============================================================================
	// 점광 반환. (설정한 것 그대로, 한도로 자르기 전)
	//==============================================================================
	/**
	 * @returns { Array<object> } setPointLights 가 채운 꼴의 배열.
	 */
	getPointLights() {
		return this.#pointLights;
	}

	//==============================================================================
	// 셰이더에 넣을 점광 수의 한도 설정. (0 ~ TOON_MAXIMUM_POINT_LIGHTS, 가벼운 길에서 줄인다)
	//==============================================================================
	/**
	 * @param { number } pointLightLimit - 한도.
	 */
	setPointLightLimit(pointLightLimit) {
		this.#pointLightLimit = System.Math.max(0, System.Math.min(TOON_MAXIMUM_POINT_LIGHTS, System.Math.floor(pointLightLimit)));
		this.markChanged();
	}

	//==============================================================================
	// 셰이더에 넣을 점광 수. (설정한 수와 한도 가운데 작은 것)
	//==============================================================================
	/**
	 * @returns { number } 셰이더에 넣을 점광 수.
	 */
	getPointLightCount() {
		return System.Math.min(this.#pointLights.length, this.#pointLightLimit);
	}

	//==============================================================================
	// 그늘 셋 설정. (유니티 툰 셰이더의 바탕, 1 차 그늘, 2 차 그늘과 그 경계의 Step, Feather)
	// - step 은 바탕과 1 차 그늘의 경계, secondStep 은 1 차와 2 차 그늘의 경계다. (빛을 받는 몫 x 의 자리, 반 램버트면 0.5 가 해와 직각인 면)
	// - 색은 바탕색과 빛에 곱하는 선형 배다. 바탕은 흰색 [1, 1, 1].
	// - secondStep 이 0 이하면 2 차 그늘이 없다. (기본 0)
	//==============================================================================
	/**
	 * @param { object } shade - { step (기본 0.5), feather (기본 0.02), color (기본 [0.5, 0.48, 0.66]), secondStep (기본 0), secondFeather (기본 0.02), secondColor (기본 [0.32, 0.3, 0.48]), isHalfLambert (기본 true) }
	 * @example <caption>따뜻한 1 차 그늘과 짙은 2 차 그늘</caption>
	 * import { ToonLightSet } from "./vanilla.js";
	 * const lightSet = new ToonLightSet();
	 * lightSet.setShade({ step: 0.5, feather: 0.03, color: [0.8, 0.62, 0.6], secondStep: 0.2, secondFeather: 0.03, secondColor: [0.5, 0.36, 0.42] });
	 */
	setShade(shade) {
		const step = shade.step !== undefined ? shade.step : 0.5;
		const feather = shade.feather !== undefined ? shade.feather : 0.02;
		const color = shade.color !== undefined ? shade.color : [0.5, 0.48, 0.66];
		const secondStep = shade.secondStep !== undefined ? shade.secondStep : 0;
		const secondFeather = shade.secondFeather !== undefined ? shade.secondFeather : 0.02;
		const secondColor = shade.secondColor !== undefined ? shade.secondColor : [0.32, 0.3, 0.48];
		const isHalfLambert = shade.isHalfLambert !== undefined ? shade.isHalfLambert === true : true;
		if (secondStep > 0) {
			this.setShadeRamp([0, secondStep, step], [secondColor, color, [1, 1, 1]], [0, secondFeather, feather], isHalfLambert);
			return;
		}
		this.setShadeRamp([0, step], [color, [1, 1, 1]], [0, feather], isHalfLambert);
	}

	//==============================================================================
	// 그늘 램프 설정. (칸마다 자리, 선형 색, 부드러움, 칸은 2 ~ TOON_MAXIMUM_BAND_STEPS, 비우면 부드러운 램버트)
	// - 칸은 자리의 오름차순이다. 첫 칸의 자리와 부드러움은 쓰지 않는다. (x 가 둘째 칸 밑이면 첫 칸 색)
	//==============================================================================
	/**
	 * @param { Array<number> } positions - 칸마다의 자리. (빛을 받는 몫 x)
	 * @param { Array<Array<number>> } colors - 칸마다의 선형 [r, g, b] 배.
	 * @param { Array<number> } feathers - 칸마다의 부드러움. (그 칸으로 넘어가는 너비)
	 * @param { boolean } isHalfLambert - x 를 dot x 0.5 + 0.5 로 셀지. (아니면 max(dot, 0))
	 * @example <caption>세 칸 램프를 바로 주기</caption>
	 * import { ToonLightSet } from "./vanilla.js";
	 * const lightSet = new ToonLightSet();
	 * lightSet.setShadeRamp([0, 0.4, 0.62], [[0.3, 0.3, 0.45], [0.62, 0.6, 0.75], [1, 1, 1]], [0, 0.05, 0.02], true);
	 */
	setShadeRamp(positions, colors, feathers, isHalfLambert) {
		const stopCount = System.Math.min(positions.length, colors.length, TOON_MAXIMUM_BAND_STEPS);
		if (stopCount < 2) {
			this.#shadePositions = [];
			this.#shadeColors = [];
			this.#shadeFeathers = [];
		}
		else {
			this.#shadePositions = positions.slice(0, stopCount);
			this.#shadeColors = colors.slice(0, stopCount).map((color) => {
				return [color[0], color[1], color[2]];
			});
			this.#shadeFeathers = [];
			for (let stopIndex = 0; stopIndex < stopCount; ++stopIndex) {
				this.#shadeFeathers.push(feathers[stopIndex] !== undefined ? System.Math.max(0, feathers[stopIndex]) : 0);
			}
		}
		this.#isShadeHalfLambert = isHalfLambert === true;
		this.markChanged();
	}

	//==============================================================================
	// 그늘 램프 끄기. (부드러운 램버트)
	//==============================================================================
	clearShadeRamp() {
		this.setShadeRamp([], [], [], false);
	}

	//==============================================================================
	// 그늘 램프 반환. (칸이 비면 부드러운 램버트)
	//==============================================================================
	/**
	 * @returns { object } { positions, colors, feathers, isHalfLambert }
	 */
	getShadeRamp() {
		return { positions: this.#shadePositions, colors: this.#shadeColors, feathers: this.#shadeFeathers, isHalfLambert: this.#isShadeHalfLambert };
	}

	//==============================================================================
	// 고른 칸 설정. (max(dot(N, L), 0) 을 칸 수로 반올림한 회색 칸, 1 ~ TOON_MAXIMUM_BAND_STEPS - 1, 0 이면 부드러운 램버트)
	//==============================================================================
	/**
	 * @param { number } bandCount - 칸 수. (0 이면 부드럽게)
	 */
	setBandCount(bandCount) {
		const count = System.Math.max(0, System.Math.min(TOON_MAXIMUM_BAND_STEPS - 1, System.Math.floor(bandCount)));
		if (count === 0) {
			this.clearShadeRamp();
			return;
		}
		const positions = [0];
		const colors = [[0, 0, 0]];
		const feathers = [0];
		for (let bandIndex = 1; bandIndex <= count; ++bandIndex) {
			const value = bandIndex / count;
			positions.push((bandIndex - 0.5) / count);
			colors.push([value, value, value]);
			feathers.push(0);
		}
		this.setShadeRamp(positions, colors, feathers, false);
	}

	//==============================================================================
	// 회색 칸 램프 설정. (문턱은 값보다 하나 적다, 값은 TOON_MAXIMUM_BAND_STEPS 까지, 첫 문턱 밑이 첫 값, 마지막 문턱 위가 마지막 값)
	//==============================================================================
	/**
	 * @param { Array<number> } thresholds - 오름차순 문턱.
	 * @param { Array<number> } values - 칸마다의 받는 몫.
	 * @param { boolean } isHalfLambert - dot x 0.5 + 0.5 를 문턱에 댈지.
	 */
	setBandRamp(thresholds, values, isHalfLambert) {
		const valueCount = System.Math.min(values.length, TOON_MAXIMUM_BAND_STEPS);
		const positions = [0];
		const colors = [];
		const feathers = [0];
		for (let valueIndex = 0; valueIndex < valueCount; ++valueIndex) {
			colors.push([values[valueIndex], values[valueIndex], values[valueIndex]]);
			if (valueIndex > 0) {
				positions.push(thresholds[valueIndex - 1] !== undefined ? thresholds[valueIndex - 1] : 1e9);
				feathers.push(0);
			}
		}
		this.setShadeRamp(positions, colors, feathers, isHalfLambert);
	}

	//==============================================================================
	// 램프 텍스처 설정. (칸 대신 텍스처의 가로를 읽는다, null 이면 칸으로, ToonRenderer.createTexture 로 지은 것)
	// - x 를 u 로 v 0.5 를 읽는다. 왼쪽이 그늘, 오른쪽이 빛. sRGB 로 보고 선형으로 바꾼다. 늘이지 않게 isRepeated: false 로 짓는다.
	//==============================================================================
	/**
	 * @param { WebGLTexture | null } rampTexture - 램프 텍스처나 null.
	 * @param { boolean } [isHalfLambert] - x 를 반 램버트로 셀지. (기본 true)
	 * @example <caption>코드로 그린 네 칸 램프 텍스처</caption>
	 * import { ToonRenderer } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const renderer = new ToonRenderer(webGL2RenderingContext);
	 * const data = new Uint8Array([70, 60, 120, 255, 120, 110, 170, 255, 200, 190, 220, 255, 255, 255, 255, 255]);
	 * const rampTexture = renderer.createTexture({ width: 4, height: 1, data: data }, { isMipmapped: false, isRepeated: false, isFiltered: false });
	 * renderer.getLightSet().setRampTexture(rampTexture);
	 */
	setRampTexture(rampTexture, isHalfLambert = true) {
		this.#rampTexture = rampTexture;
		this.#isShadeHalfLambert = isHalfLambert === true;
		this.markChanged();
	}

	//==============================================================================
	// 램프 텍스처 반환. (없으면 null)
	//==============================================================================
	/**
	 * @returns { WebGLTexture | null } 램프 텍스처. (없으면 null)
	 */
	getRampTexture() {
		return this.#rampTexture;
	}

	//==============================================================================
	// 빛 꼴 설정. ({ isEnergyNormalized } 바탕색 x 빛을 π 로 나눌지)
	//==============================================================================
	/**
	 * @param { object } lightModel - { isEnergyNormalized }
	 */
	setLightModel(lightModel) {
		this.#isEnergyNormalized = lightModel.isEnergyNormalized === true;
		this.markChanged();
	}

	//==============================================================================
	// 빛 꼴 반환.
	//==============================================================================
	/**
	 * @returns { object } { isEnergyNormalized }
	 */
	getLightModel() {
		return { isEnergyNormalized: this.#isEnergyNormalized };
	}
}
