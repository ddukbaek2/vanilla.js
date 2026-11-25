//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 수학 함수 모음. (보간, 범위 제한, 반올림, 삼각 함수, 난수, 추종)
// - 엔진의 Math 를 불러오면 그 이름 안에서는 자바스크립트 내장 Math 가 가려진다.
//==============================================================================

/**
 * @example <caption>각도 바꾸기, 범위 자르기, 보간, 주사위</caption>
 * import { Math } from "./build/vanilla.js";
 *
 * const radian = Math.degreeToRadian(90);
 * const sine = Math.sin(radian);
 * const clamped = Math.clamp(150, 0, 100);
 * const middle = Math.lerp(0, 10, 0.5);
 * const dice = Math.randomInt(1, 6);
 * console.log(sine, clamped, middle, dice);
 */

//==============================================================================
// 파이 반환.
//==============================================================================
/**
 * @type { number }
 */
export const PI = 3.141592653589793;

//==============================================================================
// 최대값 반환.
//==============================================================================
/**
 * @type { number }
 */
export const PositiveInfinity = Infinity;

//==============================================================================
// 최소값 반환.
//==============================================================================
/**
 * @type { number }
 */
export const NegativeInfinity = -Infinity;

//==============================================================================
// 더 낮은 수 반환.
//==============================================================================
/**
 * @param { number } left 비교할 첫 수.
 * @param { number } right 비교할 둘째 수.
 * @returns { number } 둘 가운데 작은 수.
 */
export function min(left, right) {
	return left < right ? left : right;
}

//==============================================================================
// 더 높은 수 반환.
//==============================================================================
/**
 * @param { number } left 비교할 첫 수.
 * @param { number } right 비교할 둘째 수.
 * @returns { number } 둘 가운데 큰 수.
 */
export function max(left, right) {
	return left > right ? left : right;
}

//==============================================================================
// 범위 제한.
//==============================================================================
/**
 * @param { number } value 자를 값.
 * @param { number } minValue 아래 끝.
 * @param { number } maxValue 위 끝. (minValue 보다 작으면 minValue 가 이긴다)
 * @returns { number } minValue 이상 maxValue 이하로 자른 값.
 */
export function clamp(value, minValue, maxValue) {
	return max(minValue, min(maxValue, value));
}

//==============================================================================
// 범위 제한.
//==============================================================================
/**
 * @param { number } value 자를 값.
 * @param { number } minValue
 * @param { number } maxValue
 * @returns { number } 0 이상 1 이하로 자른 값.
 */
export function clamp01(value) {
	return max(0.0, min(1.0, value));
}

//==============================================================================
// 선형 보간.
//==============================================================================
/**
 * @param { number } source 시작 값. (normalizedTime 이 0 일 때)
 * @param { number } destination 끝 값. (normalizedTime 이 1 일 때)
 * @param { number } normalizedTime 보간 비율. (0 ~ 1, 자르지 않아 범위 밖이면 그 너머로 늘어난다)
 * @returns { number } 보간한 값.
 */
export function lerp(source, destination, normalizedTime) {
	return source * (1 - normalizedTime) + destination * normalizedTime;
}

//==============================================================================
// 랜덤 반환. (0 ~ 1)
//==============================================================================
/**
 * @returns { number } 0 이상 1 미만의 난수.
 */
export function random() {
	return System.Math.random();
}

//==============================================================================
// 내림값 반환.
//==============================================================================
/**
 * @param { number } value 내릴 수.
 * @returns { number } value 이하의 가장 큰 정수. (무한대와 NaN 은 그대로)
 */
export function floor(value) {
	// 무한대는 그대로. (value % 1 이 NaN 이 된다)
	if (!System.Number.isFinite(value)) {
		return value;
	}
	const r = value % 1;
	return value < 0 && r !== 0 ? value - r - 1 : value - r;
};

//==============================================================================
// 올림값 반환.
//==============================================================================
/**
 * @param { number } value 올릴 수.
 * @returns { number } value 이상의 가장 작은 정수. (무한대와 NaN 은 그대로)
 */
export function ceil(value) {
	// 무한대는 그대로. (value % 1 이 NaN 이 된다)
	if (!System.Number.isFinite(value)) {
		return value;
	}
	const r = value % 1;
	return value > 0 && r !== 0 ? value - r + 1 : value - r;
};

//==============================================================================
// 반올림값 반환.
//==============================================================================
/**
 * @param { number } value 반올림할 수.
 * @returns { number } 가장 가까운 정수. (.5 는 큰 쪽으로 가서 -2.5 는 -2, 무한대와 NaN 은 그대로)
 */
export function round(value) {
	// 무한대는 그대로. (value % 1 이 NaN 이 된다)
	if (!System.Number.isFinite(value)) {
		return value;
	}
	const r = value % 1;
	if (value >= 0) {
		return r >= 0.5 ? value - r + 1 : value - r;
	}
	else {
		return r < -0.5 ? value - r - 1 : value - r;
	}
};

//==============================================================================
// 2제곱근값 반환.
//==============================================================================
/**
 * @param { number } value 제곱근을 구할 수.
 * @returns { number } 제곱근. (음수면 NaN)
 */
export function sqrt(value) {
	// 내장 제곱근을 쓴다. (음수는 NaN, 반복 근사는 큰 수에서 정확하지 않다)
	return System.Math.sqrt(value);
};

//==============================================================================
// 절대값 반환.
//==============================================================================
/**
 * @param { number } value 절대값을 구할 수.
 * @returns { number } 절대값.
 */
export function abs(value) {
	if (value < 0) {
		return -value;
	}
	return value;
}

//==============================================================================
// 사인 반환.
//==============================================================================
/**
 * @param { number } value 각도. (라디안)
 * @returns { number } 사인 값. (테일러 급수 10 항으로 근사)
 */
export function sin(value) {
	let val = value % (2 * PI);
	if (val > PI) val -= 2 * PI;
	if (val < -PI) val += 2 * PI;
	let result = 0;
	let term = val;
	for (let i = 1; i <= 10; ++i) {
		result += term;
		term *= -val * val / (2 * i * (2 * i + 1));
	}
	return result;
};

//==============================================================================
// 코사인 반환.
//==============================================================================
/**
 * @param { number } value 각도. (라디안)
 * @returns { number } 코사인 값. (테일러 급수 10 항으로 근사)
 */
export function cos(value) {
	let val = value % (2 * PI);
	if (val > PI) val -= 2 * PI;
	if (val < -PI) val += 2 * PI;
	let result = 0;
	let term = 1;
	for (let i = 1; i <= 10; ++i) {
		result += term;
		term *= -val * val / ((2 * i - 1) * 2 * i);
	}
	return result;
};

//==============================================================================
// 탄젠트 반환.
//==============================================================================
/**
 * @param { number } value 각도. (라디안)
 * @returns { number } 탄젠트 값. (sin / cos)
 */
export function tan(value) {
	const result = sin(value) / cos(value);
	return result;
};

//==============================================================================
// 아크사인 반환.
//==============================================================================
/**
 * @param { number } value 사인 값. (-1 ~ 1)
 * @returns { number } 아크사인. (라디안, 범위 밖이면 NaN)
 */
export function asin(value) {
	// 내장 아크사인을 쓴다. (범위 밖은 NaN, 급수 근사는 ±1 가까이에서 정확하지 않다)
	return System.Math.asin(value);
}

//==============================================================================
// 아크코사인 반환.
//==============================================================================
/**
 * @param { number } value 코사인 값. (-1 ~ 1)
 * @returns { number } 아크코사인. (라디안, 범위 밖이면 NaN)
 */
export function acos(value) {
	// 내장 아크코사인을 쓴다. (범위 밖은 NaN)
	return System.Math.acos(value);
}

//==============================================================================
// 거듭제곱값 반환.
//==============================================================================
/**
 * @param { number } base 밑.
 * @param { number } exponent 지수.
 * @returns { number } base 의 exponent 제곱.
 */
export function pow(base, exponent) {
	// 내장 거듭제곱을 쓴다. (지수가 분수나 음수여도 맞다)
	return System.Math.pow(base, exponent);
}

//==============================================================================
// 디그리를 라디안으로 변환하여 반환.
//==============================================================================
/**
 * @param { number } degree 각도. (도)
 * @returns { number } 라디안으로 바꾼 각도.
 */
export function degreeToRadian(degree) {
	const radian = degree * (PI / 180);
	return radian;
}

//==============================================================================
// 라디안을 디그리로 변환하여 반환.
//==============================================================================
/**
 * @param { number } radian 각도. (라디안)
 * @returns { number } 도로 바꾼 각도.
 */
export function radianToDegree(radian) {
	const degree = radian / (PI / 180);
	return degree;
}

//==============================================================================
// min 이상 max 미만의 실수 난수 반환.
//==============================================================================
/**
 * @param { number } minValue 아래 끝. (포함)
 * @param { number } maxValue 위 끝. (포함하지 않는다)
 * @returns { number } minValue 이상 maxValue 미만의 실수.
 */
export function randomRange(minValue, maxValue) {
	const value = minValue + (maxValue - minValue) * random();
	return value;
}

//==============================================================================
// min 이상 max 이하의 정수 난수 반환.
//==============================================================================
/**
 * @param { number } minValue 아래 끝. (정수, 포함)
 * @param { number } maxValue 위 끝. (정수, 포함)
 * @returns { number } minValue 이상 maxValue 이하의 정수.
 */
export function randomInt(minValue, maxValue) {
	const value = minValue + floor(random() * (maxValue - minValue + 1));
	return value;
}

//==============================================================================
// 배열에서 무작위로 하나 뽑아 반환.
//==============================================================================
/**
 * @template T
 * @param { T[] } array 뽑을 배열.
 * @returns { T | undefined } 뽑은 항목. (배열이 비었거나 없으면 undefined)
 */
export function pickRandom(array) {
	if (!array || array.length === 0) {
		return undefined;
	}
	const index = randomInt(0, array.length - 1);
	return array[index];
}

//==============================================================================
// 배열 제자리 셔플. (Fisher-Yates)
// - randomFunction 을 넘기면 그 난수를 쓴다. (SeededRandom 의 nextValue 등)
//==============================================================================
/**
 * @template T
 * @param { T[] } array 섞을 배열. (그 자리에서 바뀐다)
 * @param { Function } randomFunction 0 이상 1 미만을 반환하는 함수.
 * @returns { T[] } 섞은 같은 배열.
  * @example <caption>시드 난수로 늘 같은 차례로 섞기</caption>
  * import { Math, SeededRandom } from "./build/vanilla.js";
  *
  * const seededRandom = new SeededRandom(7);
  * const cardList = [1, 2, 3, 4, 5];
  * Math.shuffle(cardList, () => seededRandom.nextValue());
  * console.log(cardList);
 */
export function shuffle(array, randomFunction = random) {
	for (let index = array.length - 1; index > 0; --index) {
		const swapIndex = floor(randomFunction() * (index + 1));
		const temporary = array[index];
		array[index] = array[swapIndex];
		array[swapIndex] = temporary;
	}
	return array;
}

//==============================================================================
// 프레임률 독립 지수 감쇠 추종.
// - 목표가 도중에 바뀌어도 튀지 않고 부드럽게 따라간다. (여러 게임이 재발명하던 공식)
// - rate 가 클수록 빨리 붙는다. current + (target - current) * (1 - e^(-rate * dt))
//==============================================================================
/**
 * @param { number } currentValue 지금 값.
 * @param { number } targetValue 목표 값.
 * @param { number } rate 따라붙는 빠르기. (초당, 0 이상, 클수록 빨리 붙는다)
 * @param { number } timeDelta 지난 프레임과의 간격. (초)
 * @returns { number } 목표 쪽으로 옮긴 값. (목표를 지나치지 않는다)
  * @example <caption>카메라가 목표를 부드럽게 따라가기</caption>
  * import { Math } from "./build/vanilla.js";
  *
  * const targetX = 100;
  * const timeDelta = 1 / 60;
  * let cameraX = 0;
  * for (let frame = 0; frame < 60; ++frame) {
  * 	cameraX = Math.approach(cameraX, targetX, 5, timeDelta);
  * }
  * console.log(cameraX);
 */
export function approach(currentValue, targetValue, rate, timeDelta) {
	const blendRatio = 1 - System.Math.exp(-rate * timeDelta);
	return currentValue + (targetValue - currentValue) * blendRatio;
}

//==============================================================================
// 값을 일정 속도로 목표까지 이동. (지나치지 않는다)
//==============================================================================
/**
 * @param { number } currentValue 지금 값.
 * @param { number } targetValue 목표 값.
 * @param { number } maxDelta 한 번에 옮길 최대 양. (0 이상, 초당 속도면 timeDelta 를 곱해 넘긴다)
 * @returns { number } 목표 쪽으로 최대 maxDelta 만큼 옮긴 값. (목표를 지나치지 않는다)
  * @example <caption>일정한 속도로 목표까지 옮기기</caption>
  * import { Math } from "./build/vanilla.js";
  *
  * const speed = 4;
  * const timeDelta = 0.5;
  * let value = 0;
  * for (let step = 0; step < 4; ++step) {
  * 	value = Math.moveTowards(value, 5, speed * timeDelta);
  * 	console.log(value);
  * }
 */
export function moveTowards(currentValue, targetValue, maxDelta) {
	const difference = targetValue - currentValue;
	if (abs(difference) <= maxDelta) {
		return targetValue;
	}
	return currentValue + (difference > 0 ? maxDelta : -maxDelta);
}

//==============================================================================
// 이징: 바깥으로 감속하는 2차 곡선. (0 이면 0, 1 이면 1)
//==============================================================================
/**
 * @param { number } time 진행 비율. (0 ~ 1)
 * @returns { number } 감속 곡선을 거친 비율. (0 ~ 1)
 */
export function easeOutQuad(time) {
	return 1 - (1 - time) * (1 - time);
}
