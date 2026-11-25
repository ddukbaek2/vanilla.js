//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
// const WaitForSeconds = (seconds) => new Promise(resolve => setTimeout(resolve, seconds * 1000));


//==============================================================================
// 비동기 대기 함수 모음. (await 로 초나 프레임을 기다린다)
//==============================================================================

/**
 * @example <caption>잠깐 기다렸다가 이어 하기</caption>
 * import { Wait } from "./build/vanilla.js";
 *
 * const startTime = performance.now();
 * await Wait.seconds(0.2);
 * const elapsedMilliseconds = performance.now() - startTime;
 * console.log(elapsedMilliseconds >= 190);
 */

//==============================================================================
// 일정 시간 동안 비동기 대기.
//==============================================================================
/**
 * @param { number } seconds 기다릴 시간. (초, setTimeout 으로 잰다)
 * @returns { System.Promise<void> } 시간이 지나면 끝나는 프로미스.
 */
export async function seconds(seconds) {
	const promise = new System.Promise(resolve => System.setTimeout(resolve, seconds * 1000));
	await promise;
}

//==============================================================================
// 한 프레임 비동기 대기.
//==============================================================================
/**
 * @returns { System.Promise<void> } 다음 requestAnimationFrame 이 불리면 끝나는 프로미스. (브라우저에서만, window 가 없으면 거부된다)
 * @example <caption>다음 프레임까지 기다리기</caption>
 * import { Wait } from "./build/vanilla.js";
 *
 * await Wait.nextFrame();
 * await Wait.nextFrame();
 * console.log("two frames later");
 */
export async function nextFrame() {
	const promise = new System.Promise(resolve => System.window.requestAnimationFrame(resolve));
	await promise;
}