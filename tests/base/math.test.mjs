//==============================================================================
// 수학 함수와 시드 난수 시험. (node tests/base/math.test.mjs)
// - 러스트 판 짝: src/base/math.rs 의 minimum_maximum_and_round, random_int_pick_and_shuffle,
//   shuffle_with_given_random_function, approach_and_move_towards, standard_functions_follow_original,
//   src/base/seededrandom.rs 의 sequence_matches_original, integer_and_range_match_original,
//   shuffle_and_pick_match_original, daily_seed_matches_original, save_and_restore_state.
// - 기대값은 러스트 판 시험과 같은 값이다. (러스트 판은 원본을 node 로 돌려 찍은 값을 지킨다)
//==============================================================================
import * as VanillaMath from "../../src/base/math.js";
import { SeededRandom } from "../../src/base/seededrandom.js";
import { check, checkEqual, checkJson, checkNear, finish } from "../testcheck.mjs";

// min, max, round. (NaN 이 끼면 둘째 값, 반은 +무한대 쪽, 무한대는 그대로)
checkEqual(VanillaMath.min(2, 1), 1, "min");
checkEqual(VanillaMath.max(2, 1), 2, "max");
check(Number.isNaN(VanillaMath.min(1, NaN)), "min(1, NaN) 은 NaN");
checkEqual(VanillaMath.min(NaN, 1), 1, "min(NaN, 1)");
checkEqual(VanillaMath.max(NaN, 1), 1, "max(NaN, 1)");
const roundCaseList = [[2.5, 3], [-2.5, -2], [-2.6, -3], [-2.4, -2], [0.5, 1], [-0.5, 0], [1.5, 2], [-1.5, -1], [7, 7]];
for (const [value, expectedValue] of roundCaseList) {
	check(VanillaMath.round(value) === expectedValue, "round(" + value + ") = " + VanillaMath.round(value));
}
checkEqual(VanillaMath.round(Infinity), Infinity, "round(무한대)");
checkEqual(VanillaMath.round(-Infinity), -Infinity, "round(-무한대)");
check(Number.isNaN(VanillaMath.round(NaN)), "round(NaN)");
checkEqual(VanillaMath.PositiveInfinity, Infinity, "PositiveInfinity");
checkEqual(VanillaMath.NegativeInfinity, -Infinity, "NegativeInfinity");

// 정수 난수는 양 끝 포함, 빈 배열 뽑기는 없음, 섞기는 원소를 잃지 않는다.
const seenList = [false, false, false, false];
for (let index = 0; index < 2000; index++) {
	const value = VanillaMath.randomInt(-1, 2);
	check(value >= -1 && value <= 2 && Number.isInteger(value), "randomInt 범위: " + value);
	seenList[value + 1] = true;
}
check(seenList.every((isSeen) => isSeen), "randomInt 양 끝 포함");
checkEqual(VanillaMath.randomInt(5, 5), 5, "randomInt(5, 5)");
check(VanillaMath.pickRandom([]) === undefined || VanillaMath.pickRandom([]) === null, "빈 배열 pickRandom");
checkEqual(VanillaMath.pickRandom([42]), 42, "하나짜리 pickRandom");
const numberList = Array.from({ length: 50 }, (value, index) => index);
VanillaMath.shuffle(numberList);
checkJson(numberList.slice().sort((left, right) => left - right), Array.from({ length: 50 }, (value, index) => index), "shuffle 원소 보존");

// 넘긴 난수 함수로 섞기. ([1, 2, 3, 4] 를 늘 0 이면 [2, 3, 4, 1], 늘 0.999 면 그대로)
const zeroList = [1, 2, 3, 4];
VanillaMath.shuffle(zeroList, () => 0);
checkJson(zeroList, [2, 3, 4, 1], "늘 0 으로 섞기");
const nearOneList = [1, 2, 3, 4];
VanillaMath.shuffle(nearOneList, () => 0.999);
checkJson(nearOneList, [1, 2, 3, 4], "늘 0.999 로 섞기");
VanillaMath.shuffle([], () => 0.5);

// 지수 감쇠 추종과 일정 속도 옮기기.
checkEqual(VanillaMath.approach(0, 10, 5, 0), 0, "approach 시간 0");
checkNear(VanillaMath.approach(0, 10, 1, 1), 10 * (1 - Math.exp(-1)), 1e-5, "approach 1 초");
checkEqual(VanillaMath.moveTowards(0, 10, 3), 3, "moveTowards +");
checkEqual(VanillaMath.moveTowards(0, -10, 3), -3, "moveTowards -");
checkEqual(VanillaMath.moveTowards(9, 10, 3), 10, "moveTowards 넘지 않음");
checkEqual(VanillaMath.moveTowards(10, 10, 0), 10, "moveTowards 같음");

// 원본 이름의 표준 함수들.
checkEqual(VanillaMath.floor(-1.5), -2, "floor");
checkEqual(VanillaMath.ceil(-1.5), -1, "ceil");
checkEqual(VanillaMath.floor(Infinity), Infinity, "floor(무한대)");
checkEqual(VanillaMath.ceil(-Infinity), -Infinity, "ceil(-무한대)");
checkEqual(VanillaMath.sqrt(1e6), 1000, "sqrt");
check(Number.isNaN(VanillaMath.sqrt(-1)), "sqrt(-1)");
checkEqual(VanillaMath.abs(-3), 3, "abs");
checkNear(VanillaMath.sin(VanillaMath.PI / 2), 1, 1e-6, "sin");
checkNear(VanillaMath.cos(VanillaMath.PI), -1, 1e-6, "cos");
checkNear(VanillaMath.tan(VanillaMath.PI / 4), 1, 1e-6, "tan");
checkNear(VanillaMath.asin(1), VanillaMath.PI / 2, 1e-6, "asin");
checkNear(VanillaMath.acos(-1), VanillaMath.PI, 1e-6, "acos");
check(Number.isNaN(VanillaMath.asin(2)), "asin(2)");
checkEqual(VanillaMath.pow(2, 10), 1024, "pow");
checkEqual(VanillaMath.pow(4, 0.5), 2, "pow 0.5");
checkEqual(VanillaMath.pow(2, -1), 0.5, "pow -1");
checkNear(VanillaMath.radianToDegree(VanillaMath.PI), 180, 1e-4, "radianToDegree");

// 시드마다 첫 6 개 값과 상태. (f64 비트까지 같음)
const sequenceCaseList = [
	[1, [0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741, 0.9683778982143849, 0.281103502959013], [1831565814, 3663131627, 1199730144, 3031295957, 567894474, 2399460287]],
	[12345, [0.9797282677609473, 0.3067522644996643, 0.484205421525985, 0.817934412509203, 0.5094283693470061, 0.34747186047025025], [1831578158, 3663143971, 1199742488, 3031308301, 567906818, 2399472631]],
	[0, [0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741, 0.9683778982143849, 0.281103502959013], [1831565814, 3663131627, 1199730144, 3031295957, 567894474, 2399460287]],
	[4294967295, [0.8964226141106337, 0.189478256739676, 0.7156526781618595, 0.9440599093213677, 0.8452364315744489, 0.5391399988438934], [1831565812, 3663131625, 1199730142, 3031295955, 567894472, 2399460285]],
	[0x9E3779B1, [0.5464560757391155, 0.45955629041418433, 0.2470416973810643, 0.5192999374121428, 0.8892884191591293, 0.702441792236641], [191034278, 2022600091, 3854165904, 1390764421, 3222330234, 758928751]],
];
for (const [seed, valueList, stateList] of sequenceCaseList) {
	const seededRandom = new SeededRandom(seed);
	for (let index = 0; index < valueList.length; index++) {
		checkEqual(seededRandom.nextValue(), valueList[index], "시드 " + seed + " 값 " + index);
		checkEqual(seededRandom.getState(), stateList[index], "시드 " + seed + " 상태 " + index);
	}
}

// nextInt, nextRange. (시드 777, nextInt(-5, 5) 10 번 뒤 nextRange(-2.5, 7.25) 5 번)
const rangeRandom = new SeededRandom(777);
checkJson(Array.from({ length: 10 }, () => rangeRandom.nextInt(-5, 5)), [2, -5, -3, -4, 1, -1, -3, 3, 1, 3], "nextInt");
for (const expectedRange of [4.358857887156773, 5.77185053244466, -1.1563375356490724, 4.196428792027291, 2.8847969832713716]) {
	checkEqual(rangeRandom.nextRange(-2.5, 7.25), expectedRange, "nextRange");
}
checkEqual(rangeRandom.getState(), 1703684196, "nextRange 뒤 상태");

// shuffle, pick. (시드 42, 0 ~ 9 섞은 뒤 a ~ d 에서 하나)
const shuffleRandom = new SeededRandom(42);
const shuffleList = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
shuffleRandom.shuffle(shuffleList);
checkJson(shuffleList, [0, 7, 3, 5, 2, 1, 8, 9, 4, 6], "SeededRandom.shuffle");
checkEqual(shuffleRandom.pick(["a", "b", "c", "d"]), "b", "SeededRandom.pick");
const emptyPick = shuffleRandom.pick([]);
check(emptyPick === undefined || emptyPick === null, "빈 배열 SeededRandom.pick: " + emptyPick);

// 날짜 시드.
checkEqual(SeededRandom.createDailySeed(20261117), 1951175260, "createDailySeed(20261117)");
checkEqual(SeededRandom.createDailySeed(20260831, 12345), 679594006, "createDailySeed(20260831, 12345)");
checkEqual(SeededRandom.fromDate(new Date(2026, 10, 17)).getState(), 1951175260, "fromDate(2026 년 11 월 17 일)");

// 상태 저장과 복원, 시드 재설정.
const stateRandom = new SeededRandom();
stateRandom.nextValue();
const savedState = stateRandom.getState();
const firstValueList = [stateRandom.nextValue(), stateRandom.nextValue()];
stateRandom.setState(savedState);
checkJson([stateRandom.nextValue(), stateRandom.nextValue()], firstValueList, "상태 복원");
stateRandom.setSeed(0);
checkEqual(stateRandom.getState(), 1, "setSeed(0) 은 1");
stateRandom.setState(0);
checkEqual(stateRandom.getState(), 0, "setState(0)");

finish("tests/base/math.test.mjs");
