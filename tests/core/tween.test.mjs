//==============================================================================
// 트윈과 감속 시험. (node tests/core/tween.test.mjs)
// - 러스트 판 짝: src/core/tween.rs 의 easing_matches_original_formulas, easing_endpoints_are_zero_and_one,
//   tween_waits_delay_then_interpolates_and_completes_once, tween_applies_easing, tween_skips_missing_and_mismatched_values,
//   tween_start_while_playing_does_not_restart, zero_duration_finishes_on_first_tick, node_tween_writes_through_node_tree,
//   node_tween_applies_each_property, node_tween_finishes_quietly_when_node_detached.
// - 감속 기준표는 러스트 판 시험의 표(원본 Tween.easingFunction 을 node 로 돌려 뽑은 값)와 같다. 허용 오차 2e-5 도 같다.
//==============================================================================
import { Tween, TweenProperty, applyTweenProperty } from "../../src/core/tween.js";
import { WorldNode } from "../../src/core/node/worldnode.js";
import { Vector2 } from "../../src/base/vector2.js";
import { check, checkEqual, checkJson, checkNear, finish } from "../testcheck.mjs";

const EASING_SAMPLE_PROGRESS_LIST = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
const EASING_REFERENCE_TABLE = [
	["linear", [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]],
	["quadratic.in", [0.000000000, 0.010000000, 0.062500000, 0.250000000, 0.562500000, 0.810000000, 1.000000000]],
	["quadratic.out", [0.000000000, 0.190000000, 0.437500000, 0.750000000, 0.937500000, 0.990000000, 1.000000000]],
	["quadratic.inOut", [0.000000000, 0.020000000, 0.125000000, 0.500000000, 0.875000000, 0.980000000, 1.000000000]],
	["cubic.in", [0.000000000, 0.001000000, 0.015625000, 0.125000000, 0.421875000, 0.729000000, 1.000000000]],
	["cubic.out", [0.000000000, 0.271000000, 0.578125000, 0.875000000, 0.984375000, 0.999000000, 1.000000000]],
	["cubic.inOut", [0.000000000, 0.004000000, 0.062500000, 0.500000000, 0.937500000, 0.996000000, 1.000000000]],
	["quartic.in", [0.000000000, 0.000100000, 0.003906250, 0.062500000, 0.316406250, 0.656100000, 1.000000000]],
	["quartic.out", [0.000000000, 0.343900000, 0.683593750, 0.937500000, 0.996093750, 0.999900000, 1.000000000]],
	["quartic.inOut", [0.000000000, 0.000800000, 0.031250000, 0.500000000, 0.968750000, 0.999200000, 1.000000000]],
	["quintic.in", [0.000000000, 0.000010000, 0.000976563, 0.031250000, 0.237304688, 0.590490000, 1.000000000]],
	["quintic.out", [0.000000000, 0.409510000, 0.762695313, 0.968750000, 0.999023438, 0.999990000, 1.000000000]],
	["quintic.inOut", [0.000000000, 0.000160000, 0.015625000, 0.500000000, 0.984375000, 0.999840000, 1.000000000]],
	["sinusoidal.in", [0.000000000, 0.012311659, 0.076120467, 0.292893219, 0.617316568, 0.843565535, 1.000000000]],
	["sinusoidal.out", [0.000000000, 0.156434465, 0.382683432, 0.707106781, 0.923879533, 0.987688341, 1.000000000]],
	["sinusoidal.inOut", [0.000000000, 0.024471742, 0.146446609, 0.500000000, 0.853553391, 0.975528258, 1.000000000]],
	["exponential.in", [0.000000000, 0.001953125, 0.005524272, 0.031250000, 0.176776695, 0.500000000, 1.000000000]],
	["exponential.out", [0.000000000, 0.500000000, 0.823223305, 0.968750000, 0.994475728, 0.998046875, 1.000000000]],
	["exponential.inOut", [0.000000000, 0.001953125, 0.015625000, 0.500000000, 0.984375000, 0.998046875, 1.000000000]],
	["circular.in", [0.000000000, 0.005012563, 0.031754163, 0.133974596, 0.338562172, 0.564110106, 1.000000000]],
	["circular.out", [0.000000000, 0.435889894, 0.661437828, 0.866025404, 0.968245837, 0.994987437, 1.000000000]],
	["circular.inOut", [0.000000000, 0.010102051, 0.066987298, 0.500000000, 0.933012702, 0.989897949, 1.000000000]],
	["elastic.in", [0.000000000, 0.000000000, 0.003906250, 0.000000000, -0.125000000, 0.000000000, 1.000000000]],
	["elastic.out", [0.000000000, 1.000000000, 1.125000000, 1.000000000, 0.996093750, 1.000000000, 1.000000000]],
	["elastic.inOut", [0.000000000, 0.001953125, 0.000000000, 0.500000000, 1.000000000, 0.998046875, 1.000000000]],
	["back.in", [0.000000000, -0.014314220, -0.064136563, -0.087697500, 0.182590312, 0.591172020, 1.000000000]],
	["back.out", [0.000000000, 0.408827980, 0.817409688, 1.087697500, 1.064136563, 1.014314220, 1.000000000]],
	["back.inOut", [0.000000000, -0.037518552, -0.099681844, 0.500000000, 1.099681844, 1.037518552, 1.000000000]],
	["bounce.in", [0.000000000, 0.011875000, 0.027343750, 0.234375000, 0.527343750, 0.924375000, 1.000000000]],
	["bounce.out", [0.000000000, 0.075625000, 0.472656250, 0.765625000, 0.972656250, 0.988125000, 1.000000000]],
	["bounce.inOut", [0.000000000, 0.030000000, 0.117187500, 0.500000000, 0.882812500, 0.970000000, 1.000000000]],
];

function findEasingFunction(easingName) {
	const [groupName, kindName] = easingName.split(".");
	const functionName = { in: "easeIn", out: "easeOut", inOut: "easeInOut" }[kindName];
	return kindName === undefined ? Tween.easingFunction[groupName] : Tween.easingFunction[groupName][functionName];
}

// 감속 값이 기준표와 같고, 모든 감속은 0 에서 0, 1 에서 1.
for (const [easingName, expectedValueList] of EASING_REFERENCE_TABLE) {
	const easingFunction = findEasingFunction(easingName);
	check(typeof easingFunction === "function", "감속 함수 " + easingName);
	checkNear(EASING_SAMPLE_PROGRESS_LIST.map((progress) => easingFunction(progress)), expectedValueList, 2e-5, easingName);
	checkNear(easingFunction(0), 0, 1e-6, easingName + " (0)");
	checkNear(easingFunction(1), 1, 1e-6, easingName + " (1)");
}

// start 전에는 돌지 않고, 대기 시간이 지나면 진행률대로 보간하고, 끝나면 완료 콜백을 한 번 부른다.
const updateLog = [];
let completeCount = 0;
const delayTween = new Tween({ value: 10 }).to({ value: 20 }, 1).delay(0.5);
delayTween.setUpdate((values) => updateLog.push(values.value));
delayTween.setComplete(() => completeCount++);
delayTween.tick(0.25);
checkEqual(updateLog.length, 0, "start 전 갱신 없음");
checkEqual(delayTween.isFinished(), false, "start 전 끝나지 않음");
delayTween.start();
delayTween.tick(0.25);
checkEqual(updateLog.length, 0, "대기 중 갱신 없음");
delayTween.tick(0.25);
delayTween.tick(0.5);
checkEqual(completeCount, 0, "끝나기 전 완료 없음");
delayTween.tick(0.75);
checkJson(updateLog, [10, 15, 20], "대기 뒤 보간");
checkEqual(delayTween.isFinished(), true, "끝남");
checkEqual(completeCount, 1, "완료 한 번");
delayTween.tick(1);
checkEqual(updateLog.length, 3, "끝난 뒤 갱신 없음");
checkEqual(completeCount, 1, "끝난 뒤 완료 없음");

// 감속을 걸면 진행률 대신 감속 값으로 보간한다. 아무 함수나 감속으로 쓸 수 있다.
let easedValue = 0;
const easingTween = new Tween({ value: 0 }).to({ value: 100 }, 2).easing(Tween.easingFunction.quadratic.easeIn);
easingTween.setUpdate((values) => {
	easedValue = values.value;
});
easingTween.start();
easingTween.tick(1);
checkNear(easedValue, 25, 1e-4, "quadratic.in 감속 보간");
let stepValue = -1;
const stepTween = new Tween({ value: 0 }).to({ value: 100 }, 2).easing(() => 0);
stepTween.setUpdate((values) => {
	stepValue = values.value;
});
stepTween.start();
stepTween.tick(1);
checkEqual(stepValue, 0, "아무 함수 감속");

// 시작값에 없는 이름과 종류가 다른 이름은 건너뛰고, 목표값 순서로 담는다. Vector2 도 보간한다.
let skippedValues = null;
const skipTween = new Tween({ first: 1, vector: Vector2.zero(), mismatched: 5 }).to({ vector: Vector2.create(2, 4), missing: 1, mismatched: Vector2.one(), first: 3 }, 1);
skipTween.setUpdate((values) => {
	skippedValues = values;
});
skipTween.start();
skipTween.tick(0.5);
checkJson(Object.keys(skippedValues), ["vector", "first"], "건너뛴 뒤 이름 순서");
checkNear([skippedValues.vector.x, skippedValues.vector.y], [1, 2], 1e-4, "Vector2 보간");
checkNear(skippedValues.first, 2, 1e-4, "숫자 보간");

// 재생 중에 start 해도 처음부터 다시 하지 않는다. 끝난 뒤 start 하면 처음부터 다시 간다. stop 은 완료 콜백을 부르지 않는다.
let restartValue = -1;
let restartCompleteCount = 0;
const restartTween = new Tween({ value: 0 }).to({ value: 1 }, 1);
restartTween.setUpdate((values) => {
	restartValue = values.value;
});
restartTween.setComplete(() => restartCompleteCount++);
restartTween.start();
restartTween.tick(0.5);
restartTween.start();
restartTween.tick(0.5);
checkEqual(restartTween.isFinished(), true, "재생 중 start 는 다시 하지 않음");
restartTween.start();
checkEqual(restartTween.isFinished(), false, "끝난 뒤 start");
restartTween.tick(0.25);
checkNear(restartValue, 0.25, 1e-4, "처음부터 다시");
restartTween.stop();
checkEqual(restartTween.isFinished(), true, "stop 은 끝남");
checkEqual(restartCompleteCount, 1, "stop 은 완료 콜백 없음");

// 길이가 0 이면 첫 tick 에 끝난다.
let zeroValue = -1;
const zeroTween = new Tween({ value: 0 }).to({ value: 8 }, 0);
zeroTween.setUpdate((values) => {
	zeroValue = values.value;
});
zeroTween.start();
zeroTween.tick(0);
checkEqual(zeroTween.isFinished(), true, "길이 0 은 첫 tick 에 끝남");
checkEqual(zeroValue, 8, "길이 0 은 목표값");

// 노드 트윈은 tick 마다 노드 속성에 쓴다. (원본 노드 생성자는 이름을 받지 않는다)
function createNode(name) {
	const node = new WorldNode();
	node.setName(name);
	return node;
}

const rootNode = createNode("root");
const moverNode = createNode("mover");
rootNode.addChild(moverNode);
const nodeTween = Tween.createNodeTween(moverNode, TweenProperty.localPosition, Vector2.zero(), Vector2.create(100, 50), 1);
checkEqual(nodeTween.getTarget(), moverNode, "노드 트윈 대상");
nodeTween.start();
nodeTween.tick(0.5);
checkNear([moverNode.getLocalPosition().x, moverNode.getLocalPosition().y], [50, 25], 1e-4, "노드 트윈 반");
nodeTween.tick(0.5);
checkNear([moverNode.getLocalPosition().x, moverNode.getLocalPosition().y], [100, 50], 1e-4, "노드 트윈 끝");
checkEqual(nodeTween.isFinished(), true, "노드 트윈 끝남");

// Vector2 속성에 숫자를 주면 두 축에 같이 쓰고, 숫자 속성에 Vector2 를 주면 쓰지 않는다.
const targetNode = createNode("target");
rootNode.addChild(targetNode);
let customValue = 0;
const propertyTween = new Tween({ localScale: 0, localRotation: 0, localOpacity: 1, contentSize: Vector2.create(10, 20), custom: 0 })
	.to({ localScale: 2, localRotation: 90, localOpacity: 0, contentSize: Vector2.create(30, 40), custom: 4 }, 1)
	.setTarget(targetNode);
propertyTween.setUpdate((values) => {
	customValue = values.custom;
});
propertyTween.start();
propertyTween.tick(0.5);
checkNear([targetNode.getLocalScale().x, targetNode.getLocalScale().y], [1, 1], 1e-4, "localScale 숫자는 두 축");
checkNear(targetNode.getLocalRotation(), 45, 1e-4, "localRotation");
checkNear(targetNode.getLocalOpacity(), 0.5, 1e-4, "localOpacity");
checkNear([targetNode.getContentSize().x, targetNode.getContentSize().y], [20, 30], 1e-4, "contentSize");
checkNear(customValue, 2, 1e-4, "노드 속성이 아닌 값");
const rotationNode = createNode("rotation");
applyTweenProperty(rotationNode, TweenProperty.localRotation, Vector2.one());
checkEqual(rotationNode.getLocalRotation(), 0, "숫자 속성에 Vector2 는 쓰지 않음");
checkEqual(TweenProperty.localOpacity, "localOpacity", "TweenProperty 이름");
checkEqual(TweenProperty.custom, undefined, "없는 TweenProperty");

// 대상 노드가 처음 돈 때의 트리에서 떨어지면 콜백 없이 끝난다. 맨 위 노드는 부모를 따라 올라간 끝이다.
const parentNode = createNode("parent");
const detachedNode = createNode("detached");
rootNode.addChild(parentNode);
parentNode.addChild(detachedNode);
checkEqual(Tween.findRootNode(detachedNode), rootNode, "맨 위 노드");
let detachedCompleteCount = 0;
const detachedTween = Tween.createNodeTween(detachedNode, TweenProperty.localPosition, Vector2.zero(), Vector2.create(10, 0), 1);
detachedTween.setComplete(() => detachedCompleteCount++);
detachedTween.start();
detachedTween.tick(0.25);
checkEqual(detachedTween.isFinished(), false, "떼기 전 끝나지 않음");
rootNode.removeChild(parentNode);
checkEqual(Tween.findRootNode(detachedNode), parentNode, "뗀 뒤 맨 위 노드");
detachedTween.tick(0.25);
checkEqual(detachedTween.isFinished(), true, "뗀 뒤 끝남");
checkEqual(detachedCompleteCount, 0, "뗀 뒤 완료 없음");
checkNear(detachedNode.getLocalPosition().x, 2.5, 1e-4, "뗀 뒤 위치는 그대로");

finish("tests/core/tween.test.mjs");
