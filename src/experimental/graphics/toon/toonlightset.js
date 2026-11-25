//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 한 그리기에 받는 점광 수의 상한. (셰이더의 유니폼 배열 크기)
export const TOON_MAXIMUM_POINT_LIGHTS = 8;

// 띠 램프 칸 수의 상한. (문턱은 하나 적다)
export const TOON_MAXIMUM_BAND_STEPS = 8;

// 빛 묶음마다 다른 번호를 주는 셈. (렌더러가 프로그램마다 마지막으로 올린 묶음을 가린다)
let nextLightSetId = 1;


//==============================================================================
// 3 수 벡터 길이를 1 로. (길이 0 이면 아래쪽)
//==============================================================================
/**
 * @param { Array<number> } direction
 * @returns { Array<number> }
 */
function normalizeDirection(direction) {
	const length = System.Math.hypot(direction[0], direction[1], direction[2]);
	if (length <= 0) {
		return [0, -1, 0];
	}
	return [direction[0] / length, direction[1] / length, direction[2] / length];
}


//==============================================================================
// 툰 빛 묶음. (ToonRenderer 가 몸을 칠할 빛 값을 한 덩어리로 든다)
// - 렌더러는 기본 묶음 하나를 들고, setLight 같은 렌더러의 빛 설정은 그 묶음을 고친다. 그리기마다 options.lightSet 으로 다른 묶음을 줄 수 있다. (판과 모형의 빛이 다를 때)
// - 해: 방향(sunDirection)은 빛이 나아가는 쪽이다. 해에서 나와 면으로 가는 방향이고, 면에서 해 쪽을 가리키는 방향의 반대다. (three.js DirectionalLight 의 position 에서 target 으로 가는 쪽)
//   면이 받는 몫은 max(dot(N, -sunDirection), 0) 이다. 위에서 내리쬐면 [0, -1, 0] 이다.
// - 바탕빛: 하늘색과 땅색을 노멀의 위아래(N.y x 0.5 + 0.5)로 섞는다. (반구 빛)
// - 채움 빛(fill): 그림자를 받지 않는 둘째 방향광. 방향의 뜻은 해와 같다. 기본 색 0 이면 없다.
// - 림 빛(rim): 보는 쪽과 노멀이 비껴갈수록 세지는 테 빛 pow(1 - max(dot(N, V), 0), power). 빛처럼 바탕색에 곱한다. 기본 세기 0 이면 없다.
// - 정반사: 해의 블린-퐁 pow(max(dot(N, H), 0), exponent) x strength. 그림자를 받는다. 기본 0 이면 없다.
// - 점광: TOON_MAXIMUM_POINT_LIGHTS 까지. { position, color(선형), intensity, range, decay, rangeExponent, wrap }
//   감쇠는 창 x 거리 감쇠다. 창은 range 가 0 보다 크면 (1 - (거리 / range)^rangeExponent) 를 0 ~ 1 로 막아 제곱, 0 이면 1. 거리 감쇠는 decay 가 0 보다 크면 1 / max(거리^decay, 0.01), 0 이면 1.
//   기본(decay 2, rangeExponent 4)은 three.js 와 언리얼, 고도 4 의 점광 꼴이다. decay 0, rangeExponent 1 이면 (1 - 거리 / range)^2 꼴(고도 3 의 감쇠 1)이 된다.
//   받는 몫은 감싸기(wrap) 빛 (dot(N, L) + wrap) / (1 + wrap) 이다. (0 이면 램버트, GPU Gems 1 의 wrap lighting)
// - 띠: setBandCount(n) 은 해가 받는 몫을 n 칸으로 반올림한다. (0 이면 부드럽게, 지금까지의 기본)
//   setBandRamp(문턱, 값, 반 램버트) 는 몫을 문턱으로 갈라 칸마다의 값을 쓴다. 반 램버트면 dot x 0.5 + 0.5 를, 아니면 max(dot, 0) 을 문턱에 댄다. 램프가 있으면 띠 칸 수는 쓰지 않는다. 점광의 받는 몫에도 같은 띠를 건다.
// - 빛 꼴: setLightModel({ isEnergyNormalized }) 가 true 면 바탕색 x 빛을 π 로 나눈다. (램버트 BRDF 의 정석, 빛 세기를 조도로 주는 three.js 의 물리 빛, glTF 빛과 같은 약속)
//   그때 정반사는 정규화한 블린-퐁 (exponent + 8) / 8π 를 곱한다. 기본 false 면 지금까지처럼 바탕색 x 빛이다.
// - 색은 모두 선형 색이다. (HDR 이면 1 을 넘어도 된다)
// - 고치면 판 번호(getVersion)가 오른다. 렌더러는 묶음과 판 번호가 같으면 다시 올리지 않는다.
//==============================================================================
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
	/** @private @type { number } */ #specularStrength;
	/** @private @type { number } */ #specularExponent;
	/** @private @type { Array<object> } */ #pointLights;
	/** @private @type { number } */ #pointLightLimit;
	/** @private @type { number } */ #bandCount;
	/** @private @type { Array<number> } */ #bandThresholds;
	/** @private @type { Array<number> } */ #bandValues;
	/** @private @type { boolean } */ #isBandHalfLambert;
	/** @private @type { boolean } */ #isEnergyNormalized;

	//==============================================================================
	// 생성. (ToonRenderer 의 기본 빛과 같은 값)
	//==============================================================================
	constructor() {
		this.#id = nextLightSetId;
		nextLightSetId += 1;
		this.#version = 0;
		this.#sunDirection = [-0.4, -1.0, -0.3];
		this.#sunColor = [0.9, 0.85, 0.8];
		this.#skyColor = [0.45, 0.5, 0.6];
		this.#groundColor = [0.2, 0.18, 0.16];
		this.#fillDirection = [0, -1, 0];
		this.#fillColor = [0, 0, 0];
		this.#rimColor = [0, 0, 0];
		this.#rimPower = 0;
		this.#specularStrength = 0;
		this.#specularExponent = 48;
		this.#pointLights = [];
		this.#pointLightLimit = TOON_MAXIMUM_POINT_LIGHTS;
		this.#bandCount = 0;
		this.#bandThresholds = [];
		this.#bandValues = [];
		this.#isBandHalfLambert = false;
		this.#isEnergyNormalized = false;
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
	 * @returns { number }
	 */
	getId() {
		return this.#id;
	}

	//==============================================================================
	// 판 번호 반환. (고칠 때마다 오른다)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getVersion() {
		return this.#version;
	}

	//==============================================================================
	// 해와 바탕빛 설정. (해가 비추는 방향, 해의 색, 하늘색, 땅색)
	//==============================================================================
	/**
	 * @param { Array<number> } sunDirection
	 * @param { Array<number> } sunColor
	 * @param { Array<number> } skyColor
	 * @param { Array<number> } groundColor
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
	 * @param { Array<number> } sunDirection
	 */
	setSunDirection(sunDirection) {
		this.#sunDirection = sunDirection.slice();
		this.markChanged();
	}

	//==============================================================================
	// 해가 비추는 방향 반환. (ShadowMap.updateLightMatrix 에 그대로 넘긴다)
	//==============================================================================
	/**
	 * @returns { Array<number> }
	 */
	getSunDirection() {
		return this.#sunDirection;
	}

	//==============================================================================
	// 해의 색 반환.
	//==============================================================================
	/**
	 * @returns { Array<number> }
	 */
	getSunColor() {
		return this.#sunColor;
	}

	//==============================================================================
	// 하늘색 반환.
	//==============================================================================
	/**
	 * @returns { Array<number> }
	 */
	getSkyColor() {
		return this.#skyColor;
	}

	//==============================================================================
	// 땅색 반환.
	//==============================================================================
	/**
	 * @returns { Array<number> }
	 */
	getGroundColor() {
		return this.#groundColor;
	}

	//==============================================================================
	// 채움 빛 설정. (빛이 나아가는 방향과 색, 색이 0 이면 없음)
	//==============================================================================
	/**
	 * @param { Array<number> } fillDirection
	 * @param { Array<number> } fillColor
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
	// 림 빛 설정. (색과 거듭제곱, 거듭제곱이 0 이하면 없음)
	//==============================================================================
	/**
	 * @param { Array<number> } rimColor
	 * @param { number } rimPower
	 */
	setRimLight(rimColor, rimPower) {
		this.#rimColor = rimColor.slice();
		this.#rimPower = System.Math.max(0, rimPower);
		this.markChanged();
	}

	//==============================================================================
	// 림 빛 반환.
	//==============================================================================
	/**
	 * @returns { object } { color, power }
	 */
	getRimLight() {
		return { color: this.#rimColor, power: this.#rimPower };
	}

	//==============================================================================
	// 정반사 설정. (세기 0 이면 없음, 지수 기본 48)
	//==============================================================================
	/**
	 * @param { number } specularStrength
	 * @param { number } [specularExponent]
	 */
	setSpecular(specularStrength, specularExponent = 48) {
		this.#specularStrength = System.Math.max(0, specularStrength);
		this.#specularExponent = System.Math.max(1, specularExponent);
		this.markChanged();
	}

	//==============================================================================
	// 정반사 반환.
	//==============================================================================
	/**
	 * @returns { object } { strength, exponent }
	 */
	getSpecular() {
		return { strength: this.#specularStrength, exponent: this.#specularExponent };
	}

	//==============================================================================
	// 점광 설정. (TOON_MAXIMUM_POINT_LIGHTS 를 넘는 것은 버린다)
	//==============================================================================
	/**
	 * @param { Array<object> } pointLights { position [x, y, z], color [r, g, b] 선형, intensity (기본 1), range (기본 0 = 끝없음), decay (기본 2), rangeExponent (기본 4), wrap (기본 0) }
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
			};
		});
		this.markChanged();
	}

	//==============================================================================
	// 점광 반환. (설정한 것 그대로, 한도로 자르기 전)
	//==============================================================================
	/**
	 * @returns { Array<object> }
	 */
	getPointLights() {
		return this.#pointLights;
	}

	//==============================================================================
	// 셰이더에 넣을 점광 수의 한도 설정. (0 ~ TOON_MAXIMUM_POINT_LIGHTS, 가벼운 길에서 줄인다)
	//==============================================================================
	/**
	 * @param { number } pointLightLimit
	 */
	setPointLightLimit(pointLightLimit) {
		this.#pointLightLimit = System.Math.max(0, System.Math.min(TOON_MAXIMUM_POINT_LIGHTS, System.Math.floor(pointLightLimit)));
		this.markChanged();
	}

	//==============================================================================
	// 셰이더에 넣을 점광 수. (설정한 수와 한도 가운데 작은 것)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getPointLightCount() {
		return System.Math.min(this.#pointLights.length, this.#pointLightLimit);
	}

	//==============================================================================
	// 셀 셰이딩 칸 수 설정. (0 이면 부드럽게)
	//==============================================================================
	/**
	 * @param { number } bandCount
	 */
	setBandCount(bandCount) {
		this.#bandCount = System.Math.max(0, System.Math.floor(bandCount));
		this.markChanged();
	}

	//==============================================================================
	// 셀 셰이딩 칸 수 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getBandCount() {
		return this.#bandCount;
	}

	//==============================================================================
	// 띠 램프 설정. (문턱은 값보다 하나 적다, 값은 TOON_MAXIMUM_BAND_STEPS 까지, 값이 비면 끈다)
	//==============================================================================
	/**
	 * @param { Array<number> } thresholds 오름차순 문턱.
	 * @param { Array<number> } values 칸마다의 받는 몫. (첫 문턱 밑이 첫 값, 마지막 문턱 위가 마지막 값)
	 * @param { boolean } isHalfLambert dot x 0.5 + 0.5 를 문턱에 댈지.
	 */
	setBandRamp(thresholds, values, isHalfLambert) {
		const valueCount = System.Math.min(values.length, TOON_MAXIMUM_BAND_STEPS);
		this.#bandValues = values.slice(0, valueCount);
		this.#bandThresholds = thresholds.slice(0, System.Math.max(0, valueCount - 1));
		while (this.#bandThresholds.length < valueCount - 1) {
			this.#bandThresholds.push(1e9);
		}
		this.#isBandHalfLambert = isHalfLambert;
		this.markChanged();
	}

	//==============================================================================
	// 띠 램프 끄기.
	//==============================================================================
	clearBandRamp() {
		this.#bandThresholds = [];
		this.#bandValues = [];
		this.#isBandHalfLambert = false;
		this.markChanged();
	}

	//==============================================================================
	// 띠 램프 반환. (값이 비면 꺼짐)
	//==============================================================================
	/**
	 * @returns { object } { thresholds, values, isHalfLambert }
	 */
	getBandRamp() {
		return { thresholds: this.#bandThresholds, values: this.#bandValues, isHalfLambert: this.#isBandHalfLambert };
	}

	//==============================================================================
	// 빛 꼴 설정. ({ isEnergyNormalized } 바탕색 x 빛을 π 로 나눌지)
	//==============================================================================
	/**
	 * @param { object } lightModel
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
