//==============================================================================
// 더 낮은 수 반환.
//==============================================================================
/**
 * @param { number } left
 * @param { number } right
 * @returns { number }
 */
export function min(left, right)
{
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
 * @param { number } min
 * @param { number } max
 * @returns { number }
 */
export function clamp(value, min, max) {
	return max(min, min(max, value));
}

//==============================================================================
// 선형 보간.
//==============================================================================
/**
 * @param { number } a 
 * @param { number } b 
 * @param { number } t 
 * @returns { number }
 */
export function lerp(a, b, t) {
	return a * (1 - t) + b * t;
}