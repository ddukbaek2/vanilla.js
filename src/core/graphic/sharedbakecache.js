//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 아무도 쓰지 않는 구운 그림을 남겨 두는 수. (넘으면 오래 안 쓴 것부터 버린다)
const MAXIMUM_IDLE_BAKE_COUNT = 128;


//==============================================================================
// 구운 그림 나눠 쓰기. (ShadowText, ShadowImage, SoftShade)
// - 같은 모양(열쇠)이면 한 번만 굽고 여러 컴포넌트가 같은 캔버스를 그린다. 텍스처도 캔버스마다 하나라 함께 준다.
// - 열쇠마다 쓰는 컴포넌트 수(참조 수)를 센다. 쓰는 컴포넌트가 있는 것은 버리지 않는다.
// - 아무도 쓰지 않게 된 것은 바로 버리지 않고 남겨 둔다. (같은 모양이 곧 다시 오면 굽지 않는다) MAXIMUM_IDLE_BAKE_COUNT 를 넘으면 오래 안 쓴 것부터 버린다.
// - 컴포넌트는 열쇠가 바뀌거나 노드에서 떨어질 때 놓는다. 놓지 않고 수거된 컴포넌트는 FinalizationRegistry 가 대신 놓는다. (지원하지 않는 환경이면 남는다)
// - 버린 캔버스의 텍스처는 ImageTextureCache 가 캔버스와 함께 수거한다.
//==============================================================================
const bakeEntries = new System.Map(); // 열쇠 → { bake, referenceCount } (넣은 차례가 쓴 차례, 앞이 오래된 것)
let idleBakeCount = 0;
const holderRegistry = (typeof System.FinalizationRegistry === "function") ? new System.FinalizationRegistry((bakeKey) => {
	dereferenceBake(bakeKey);
}) : null;


//==============================================================================
// 구운 그림 쥐기. (열쇠에 구운 것이 없으면 createBake 로 굽는다)
// - holder 는 쥐는 컴포넌트다. 한 컴포넌트는 한 번에 열쇠 하나만 쥔다. (새로 쥐기 전에 releaseSharedBake 로 놓는다)
// - 돌려준 것은 여럿이 나눠 쓰므로 고치지 않는다.
//==============================================================================
/**
 * @param { string } bakeKey
 * @param { object } holder
 * @param { () => object | null } createBake
 * @returns { object | null }
 */
export function acquireSharedBake(bakeKey, holder, createBake) {
	let bakeEntry = bakeEntries.get(bakeKey);
	if (bakeEntry === undefined) {
		const bake = createBake();
		bakeEntry = { bake: bake, referenceCount: 0 };
	}
	else {
		bakeEntries.delete(bakeKey);
		if (bakeEntry.referenceCount === 0) {
			idleBakeCount -= 1;
		}
	}
	bakeEntry.referenceCount += 1;
	bakeEntries.set(bakeKey, bakeEntry);
	if (holderRegistry !== null) {
		holderRegistry.register(holder, bakeKey, holder);
	}
	return bakeEntry.bake;
}

//==============================================================================
// 구운 그림 놓기. (쥔 열쇠, 빈 열쇠면 아무것도 하지 않는다)
//==============================================================================
/**
 * @param { string } bakeKey
 * @param { object } holder
 */
export function releaseSharedBake(bakeKey, holder) {
	if (bakeKey === "") {
		return;
	}
	if (holderRegistry !== null) {
		holderRegistry.unregister(holder);
	}
	dereferenceBake(bakeKey);
}

//==============================================================================
// 참조 수 하나 줄이기. (0 이 되면 남겨 두고, 남긴 것이 넘치면 오래 안 쓴 것부터 버린다)
//==============================================================================
/**
 * @param { string } bakeKey
 */
function dereferenceBake(bakeKey) {
	const bakeEntry = bakeEntries.get(bakeKey);
	if (bakeEntry === undefined || bakeEntry.referenceCount <= 0) {
		return;
	}
	bakeEntry.referenceCount -= 1;
	if (bakeEntry.referenceCount > 0) {
		return;
	}
	idleBakeCount += 1;
	if (idleBakeCount <= MAXIMUM_IDLE_BAKE_COUNT) {
		return;
	}
	for (const [entryKey, entry] of bakeEntries) {
		if (idleBakeCount <= MAXIMUM_IDLE_BAKE_COUNT) {
			break;
		}
		if (entry.referenceCount > 0) {
			continue;
		}
		bakeEntries.delete(entryKey);
		idleBakeCount -= 1;
	}
}

//==============================================================================
// 지금 들고 있는 구운 그림 수와 그 가운데 아무도 쓰지 않는 수. (시험과 통계용)
//==============================================================================
/**
 * @returns { { bakeCount: number, idleBakeCount: number } }
 */
export function readSharedBakeCount() {
	return { bakeCount: bakeEntries.size, idleBakeCount: idleBakeCount };
}
