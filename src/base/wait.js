//==============================================================================
// 포함 모듈 목록.
//==============================================================================
// const WaitForSeconds = (seconds) => new Promise(resolve => setTimeout(resolve, seconds * 1000));


//==============================================================================
// 일정 시간 동안 비동기 대기.
//==============================================================================
/**
 * @param { number } seconds
 * @returns { Promise<void> }
 */
export async function seconds(seconds) {
	const promise = new Promise(resolve => setTimeout(resolve, seconds * 1000));
	await promise;
}