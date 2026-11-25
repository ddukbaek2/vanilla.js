//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


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
 * @param { number } left
 * @param { number } right
 * @returns { number }
 */
export function min(left, right) {
	return left < right ? left : right;
}

//==============================================================================
// 더 높은 수 반환.
//==============================================================================
/**
 * @param { number } left
 * @param { number } right
 * @returns { number }
 */
export function max(left, right) {
	return left > right ? left : right;
}

//==============================================================================
// 범위 제한.
//==============================================================================
/**
 * @param { number } value
 * @param { number } minValue
 * @param { number } maxValue
 * @returns { number }
 */
export function clamp(value, minValue, maxValue) {
	return max(minValue, min(maxValue, value));
}

//==============================================================================
// 범위 제한.
//==============================================================================
/**
 * @param { number } value
 * @param { number } minValue
 * @param { number } maxValue
 * @returns { number }
 */
export function clamp01(value) {
	return max(0.0, min(1.0, value));
}

//==============================================================================
// 선형 보간.
//==============================================================================
/**
 * @param { number } source 
 * @param { number } destination 
 * @param { number } normalizedTime 
 * @returns { number }
 */
export function lerp(source, destination, normalizedTime) {
	return source * (1 - normalizedTime) + destination * normalizedTime;
}

//==============================================================================
// 랜덤 반환. (0 ~ 1)
//==============================================================================
/**
 * @returns { number }
 */
export function random() {
	return System.Math.random();
}

//==============================================================================
// 내림값 반환.
//==============================================================================
/**
 * @param { number } value
 * @returns { number }
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
 * @param { number } value
 * @returns { number }
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
 * @param { number } value
 * @returns { number }
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
 * @param { number } value
 * @returns { number }
 */
export function sqrt(value) {
	// 내장 제곱근을 쓴다. (음수는 NaN, 반복 근사는 큰 수에서 정확하지 않다)
	return System.Math.sqrt(value);
};

//==============================================================================
// 절대값 반환.
//==============================================================================
/**
 * @param { number } value
 * @returns { number }
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
 * @param { number } value
 * @returns { number }
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
 * @param { number } value
 * @returns { number }
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
 * @param { number } value
 * @returns { number }
 */
export function tan(value) {
	const result = sin(value) / cos(value);
	return result;
};

//==============================================================================
// 아크사인 반환.
//==============================================================================
/**
 * @param { number } value
 * @returns { number }
 */
export function asin(value) {
	// 내장 아크사인을 쓴다. (범위 밖은 NaN, 급수 근사는 ±1 가까이에서 정확하지 않다)
	return System.Math.asin(value);
}

//==============================================================================
// 아크코사인 반환.
//==============================================================================
/**
 * @param { number } value
 * @returns { number }
 */
export function acos(value) {
	// 내장 아크코사인을 쓴다. (범위 밖은 NaN)
	return System.Math.acos(value);
}

//==============================================================================
// 거듭제곱값 반환.
//==============================================================================
/**
 * @param { number } base
 * @param { number } exponent
 * @returns { number }
 */
export function pow(base, exponent) {
	// 내장 거듭제곱을 쓴다. (지수가 분수나 음수여도 맞다)
	return System.Math.pow(base, exponent);
}

//==============================================================================
// 디그리를 라디안으로 변환하여 반환.
//==============================================================================
/**
 * @param { number } degree
 * @returns { number }
 */
export function degreeToRadian(degree) {
	const radian = degree * (PI / 180);
	return radian;
}

//==============================================================================
// 라디안을 디그리로 변환하여 반환.
//==============================================================================
/**
 * @param { number } radian
 * @returns { number }
 */
export function radianToDegree(radian) {
	const degree = radian / (PI / 180);
	return degree;
}

//==============================================================================
// min 이상 max 미만의 실수 난수 반환.
//==============================================================================
/**
 * @param { number } minValue
 * @param { number } maxValue
 * @returns { number }
 */
export function randomRange(minValue, maxValue) {
	const value = minValue + (maxValue - minValue) * random();
	return value;
}

//==============================================================================
// min 이상 max 이하의 정수 난수 반환.
//==============================================================================
/**
 * @param { number } minValue
 * @param { number } maxValue
 * @returns { number }
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
 * @param { T[] } array
 * @returns { T | undefined }
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
 * @param { T[] } array
 * @param { Function } randomFunction 0 이상 1 미만을 반환하는 함수.
 * @returns { T[] }
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
 * @param { number } currentValue
 * @param { number } targetValue
 * @param { number } rate
 * @param { number } timeDelta
 * @returns { number }
 */
export function approach(currentValue, targetValue, rate, timeDelta) {
	const blendRatio = 1 - System.Math.exp(-rate * timeDelta);
	return currentValue + (targetValue - currentValue) * blendRatio;
}

//==============================================================================
// 값을 일정 속도로 목표까지 이동. (지나치지 않는다)
//==============================================================================
/**
 * @param { number } currentValue
 * @param { number } targetValue
 * @param { number } maxDelta
 * @returns { number }
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
 * @param { number } time
 * @returns { number }
 */
export function easeOutQuad(time) {
	return 1 - (1 - time) * (1 - time);
}
