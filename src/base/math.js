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
	if (value < 0) {
		return NaN;
	}
	if (value === 0) {
		return 0;
	}

	let result =value > 1 ? value : 1;
	for (let i = 0; i < 10; ++i) {
		result = (result + value / result) / 2; // 바빌로니아법.
	}

	return result;
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
	if (value < -1 || value > 1) return NaN;
	if (value === 1) return Math.PI / 2;
	if (value === -1) return -Math.PI / 2;

	let result = value;
	let term = value;
	for (let i = 1; i < 100; i++) {
		term *= (value * value * (2 * i - 1) * (2 * i - 1)) / ((2 * i) * (2 * i + 1));
		result += term;
		if (Math.abs(term) < 1e-15) break;
	}
	return result;
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
	if (exponent === 0) return 1;
	if (exponent < 0) return 1 / pow(base, -exponent);

	let result = 1;
	let currentBase = base;
	let currentExponent = exponent;

	while (currentExponent > 0) {
		if (currentExponent % 2 === 1) {
			result *= currentBase;
		}
		currentBase *= currentBase;
		currentExponent = Math.floor(currentExponent / 2);
	}

	return result;
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