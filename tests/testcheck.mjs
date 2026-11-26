//==============================================================================
// 원본 시험이 같이 쓰는 확인 도구. (tests/<분야>/<이름>.test.mjs 가 불러 쓴다)
// - check 는 틀리면 바로 던져 node 가 0 이 아닌 값으로 끝난다.
// - checkNear 는 러스트 판 시험의 허용 오차(f32 셈 차이)와 같은 값을 넘겨 쓴다.
// - knownDifference 는 원본 기대값이 러스트 판 시험 값과 다른 것(두 엔진 차이)을 시험에서 빼지 않고 건너뛰며 찍는다.
//   (두 엔진 차이는 원본을 고치지 않고 따로 맞춘다. 맞춘 뒤에는 check 로 바꾼다)
//==============================================================================
let checkCount = 0;
const knownDifferenceList = [];

//==============================================================================
// 조건 확인.
//==============================================================================
/**
 * @param { boolean } condition 참이어야 하는 조건.
 * @param { string } message 틀렸을 때 낼 글.
 */
export function check(condition, message) {
	checkCount++;
	if (!condition) {
		throw new Error("시험 실패: " + message);
	}
}

//==============================================================================
// 같은 값 확인. (=== 비교, NaN 은 NaN 과 같다고 본다)
//==============================================================================
/**
 * @param { any } actualValue 실제 값.
 * @param { any } expectedValue 기대값.
 * @param { string } message 틀렸을 때 낼 글.
 */
export function checkEqual(actualValue, expectedValue, message) {
	const isSame = Object.is(actualValue, expectedValue) || actualValue === expectedValue;
	check(isSame, message + ": " + String(actualValue) + " (기대 " + String(expectedValue) + ")");
}

//==============================================================================
// 허용 오차 안에서 같은 값 확인. (숫자 하나 또는 숫자 배열)
//==============================================================================
/**
 * @param { number | ArrayLike<number> } actualValue 실제 값.
 * @param { number | ArrayLike<number> } expectedValue 기대값.
 * @param { number } tolerance 허용 오차.
 * @param { string } message 틀렸을 때 낼 글.
 */
export function checkNear(actualValue, expectedValue, tolerance, message) {
	if (typeof expectedValue === "number") {
		const isNear = Number.isNaN(expectedValue) ? Number.isNaN(actualValue) : Math.abs(actualValue - expectedValue) <= tolerance;
		check(isNear, message + ": " + actualValue + " (기대 " + expectedValue + ")");
		return;
	}
	check(actualValue.length === expectedValue.length, message + ": 길이 " + actualValue.length + " (기대 " + expectedValue.length + ")");
	for (let index = 0; index < expectedValue.length; index++) {
		const isNear = Math.abs(actualValue[index] - expectedValue[index]) <= tolerance;
		check(isNear, message + "[" + index + "]: " + actualValue[index] + " (기대 " + expectedValue[index] + ", 전체 " + Array.from(actualValue).join(", ") + ")");
	}
}

//==============================================================================
// 같은 자료 확인. (JSON 글로 바꿔 비교)
//==============================================================================
/**
 * @param { any } actualValue 실제 값.
 * @param { any } expectedValue 기대값.
 * @param { string } message 틀렸을 때 낼 글.
 */
export function checkJson(actualValue, expectedValue, message) {
	const actualText = JSON.stringify(actualValue);
	const expectedText = JSON.stringify(expectedValue);
	check(actualText === expectedText, message + ": " + actualText + " (기대 " + expectedText + ")");
}

//==============================================================================
// 두 엔진 차이 기록. (원본 값이 러스트 판 시험 값과 다른 것, 실패로 치지 않고 건너뛴다)
//==============================================================================
/**
 * @param { string } rustTestName 짝인 러스트 시험 이름. (파일 경로::시험 이름)
 * @param { string } detail 무엇이 어떻게 다른지.
 * @param { any } originalValue 원본이 낸 값.
 * @param { any } rustValue 러스트 판 시험이 지키는 값.
 */
export function knownDifference(rustTestName, detail, originalValue, rustValue) {
	knownDifferenceList.push({ rustTestName, detail, originalValue, rustValue });
	console.log("두 엔진 차이(건너뜀): " + rustTestName + ": " + detail + " (원본 " + JSON.stringify(originalValue) + ", 러스트 " + JSON.stringify(rustValue) + ")");
}

//==============================================================================
// 끝 보고. (시험 파일 맨 끝에서 부른다)
//==============================================================================
/**
 * @param { string } testName 시험 이름.
 */
export function finish(testName) {
	const differenceText = knownDifferenceList.length > 0 ? ", 두 엔진 차이 " + knownDifferenceList.length + " 건 건너뜀" : "";
	console.log(testName + " 통과 (" + checkCount + " 건 확인" + differenceText + ")");
}
