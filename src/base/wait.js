//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
// const WaitForSeconds = (seconds) => new Promise(resolve => setTimeout(resolve, seconds * 1000));


//==============================================================================
// 일정 시간 동안 비동기 대기.
//==============================================================================
/**
 * @param { number } seconds
 * @returns { System.Promise<void> }
 */
export async function seconds(seconds) {
	const promise = new System.Promise(resolve => System.setTimeout(resolve, seconds * 1000));
	await promise;
}

//==============================================================================
// 한 프레임 비동기 대기.
//==============================================================================
/**
 * @returns { System.Promise<void> }
 */
export async function nextFrame() {
	new Promise(resolve => System.window.requestAnimationFrame(resolve));
}