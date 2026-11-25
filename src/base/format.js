//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 표기 유틸.
// - 재화 / 점수 표기처럼 어느 게임에서나 반복되는 숫자 문자열 처리를 모았다.
//==============================================================================

/**
 * @example <caption>점수, 재화, 시간 표기</caption>
 * import { Format } from "./build/vanilla.js";
 *
 * console.log(Format.formatNumber(12480));
 * console.log(Format.formatCompactNumber(5600000));
 * console.log(Format.formatPaddedNumber(7, 3));
 * console.log(Format.formatMinutesSeconds(75));
 */

//==============================================================================
// 천 단위 구분 기호를 붙여 반환. (12480 -> "12,480")
//==============================================================================
/**
 * @param { number } value 표기할 수.
 * @param { string } locale 로케일. (기본 "en-US")
 * @returns { string } 천 단위 구분 기호를 붙인 문자열. (toLocaleString 을 따른다)
 */
export function formatNumber(value, locale = "en-US") {
	return value.toLocaleString(locale);
}

//==============================================================================
// 천 단위 구분 + 단위 접미사. (1200000, "원" -> "1,200,000원")
//==============================================================================
/**
 * @param { number } value 표기할 수.
 * @param { string } unitSuffix 뒤에 붙일 단위.
 * @param { string } locale 로케일. (기본 "ko-KR")
 * @returns { string } 천 단위 구분 기호와 단위를 붙인 문자열.
 */
export function formatNumberWithUnit(value, unitSuffix, locale = "ko-KR") {
	return value.toLocaleString(locale) + unitSuffix;
}

//==============================================================================
// 큰 수를 짧게 줄여 반환. (1234 -> "1.2K", 5600000 -> "5.6M")
//==============================================================================
/**
 * @param { number } value 표기할 수. (절대값이 1000 미만이면 줄이지 않고, 음수는 앞에 - 를 붙인다)
 * @param { number } fractionDigits 소수 자릿수. (기본 1, 끝의 0 은 뺀다)
 * @returns { string } K, M, B 를 붙여 줄인 문자열.
 */
export function formatCompactNumber(value, fractionDigits = 1) {
	const absoluteValue = System.Math.abs(value);
	const sign = value < 0 ? "-" : "";
	if (absoluteValue >= 1000000000) {
		return sign + trimTrailingZero((absoluteValue / 1000000000).toFixed(fractionDigits)) + "B";
	}
	if (absoluteValue >= 1000000) {
		return sign + trimTrailingZero((absoluteValue / 1000000).toFixed(fractionDigits)) + "M";
	}
	if (absoluteValue >= 1000) {
		return sign + trimTrailingZero((absoluteValue / 1000).toFixed(fractionDigits)) + "K";
	}
	return sign + String(absoluteValue);
}

//==============================================================================
// 값을 범위로 자르고 자릿수를 0 으로 채워 반환. (7세그먼트 카운터 표기 등)
// - formatPaddedNumber(7, 3) -> "007", formatPaddedNumber(-5, 3) -> "-05"
//==============================================================================
/**
 * @param { number } value 표기할 수.
 * @param { number } digitCount 전체 자릿수. (음수면 - 기호도 한 자리로 센다)
 * @param { number } minValue 아래 끝. (기본 -Infinity)
 * @param { number } maxValue 위 끝. (기본 Infinity)
 * @returns { string } 범위로 자르고 앞을 0 으로 채운 문자열. (자릿수보다 길면 자르지 않는다)
 */
export function formatPaddedNumber(value, digitCount, minValue = -Infinity, maxValue = Infinity) {
	const clampedValue = System.Math.min(maxValue, System.Math.max(minValue, value));
	if (clampedValue < 0) {
		const digitText = String(-clampedValue).padStart(digitCount - 1, "0");
		return "-" + digitText;
	}
	return String(clampedValue).padStart(digitCount, "0");
}

//==============================================================================
// 초를 "분:초" 표기로 반환. (75 -> "1:15")
//==============================================================================
/**
 * @param { number } totalSeconds 전체 초. (소수는 버리고 음수는 0 으로 친다)
 * @returns { string } "분:초" 문자열. (초는 두 자리, 분은 60 을 넘어도 그대로)
 */
export function formatMinutesSeconds(totalSeconds) {
	const flooredSeconds = System.Math.max(0, System.Math.floor(totalSeconds));
	const minutes = System.Math.floor(flooredSeconds / 60);
	const seconds = flooredSeconds % 60;
	return minutes + ":" + String(seconds).padStart(2, "0");
}

//==============================================================================
// 소수 표기의 꼬리 0 제거. ("1.0" -> "1")
//==============================================================================
/**
 * @param { string } numberText
 * @returns { string }
 */
function trimTrailingZero(numberText) {
	if (numberText.indexOf(".") < 0) {
		return numberText;
	}
	let trimmedText = numberText;
	while (trimmedText.endsWith("0")) {
		trimmedText = trimmedText.substring(0, trimmedText.length - 1);
	}
	if (trimmedText.endsWith(".")) {
		trimmedText = trimmedText.substring(0, trimmedText.length - 1);
	}
	return trimmedText;
}
