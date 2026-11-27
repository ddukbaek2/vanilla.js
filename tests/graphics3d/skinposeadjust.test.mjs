//==============================================================================
// writeSkinPose 의 뼈 고침 고리(poseAdjust)와 adjustBones 시험. (node tests/graphics3d/skinposeadjust.test.mjs)
// - 러스트 판 짝: src/graphics3d/toon/glbmeshreader.rs 의 write_skin_pose 고리 시험. (옮길 때 같은 값을 본다)
// - 파일은 examples/ancientmountain/assets/fox.glb.
// - 고리가 없거나 아무것도 고치지 않으면 지금과 비트까지 같고, 한 뼈를 고치면 그 뼈와 그 아래만 바뀌는지 본다.
//==============================================================================
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { readGlbArrays, writeSkinPose, adjustBones, BoneModifyMode } from "../../src/graphics3d/toon/glbmeshreader.js";
import { check, checkEqual, checkNear, finish } from "../testcheck.mjs";

const repositoryPath = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");
const foxBuffer = fs.readFileSync(path.join(repositoryPath, "examples/ancientmountain/assets/fox.glb"));
const skeleton = readGlbArrays(foxBuffer.buffer.slice(foxBuffer.byteOffset, foxBuffer.byteOffset + foxBuffer.byteLength)).skeleton;
check(skeleton !== null, "여우 뼈대");
const jointCount = skeleton.joints.length;

function writePose(animationName, time, poseAdjust) {
	const target = new Float32Array(jointCount * 16);
	writeSkinPose(skeleton, animationName, time, target, null, null, poseAdjust);
	return target;
}

function isSameArray(left, right) {
	return left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
}

// 그 노드와 그 아래 노드 차례들.
function readSubtree(rootIndex) {
	const indices = new Set([rootIndex]);
	let isGrowing = true;
	while (isGrowing) {
		isGrowing = false;
		skeleton.nodes.forEach((node, nodeIndex) => {
			if (!indices.has(nodeIndex) && indices.has(node.parentIndex)) {
				indices.add(nodeIndex);
				isGrowing = true;
			}
		});
	}
	return indices;
}

// 본마다 같은지. ([본 차례마다 같으면 true])
function compareJoints(left, right) {
	const sameList = [];
	for (let jointIndex = 0; jointIndex < jointCount; ++jointIndex) {
		sameList.push(isSameArray(left.subarray(jointIndex * 16, jointIndex * 16 + 16), right.subarray(jointIndex * 16, jointIndex * 16 + 16)));
	}
	return sameList;
}

const basePose = writePose("Run", 0.3, null);

// 고리가 없거나, 아무것도 고치지 않는 고리, 빈 표, 무게 0 이면 지금과 비트까지 같다.
{
	const plainTarget = new Float32Array(jointCount * 16);
	writeSkinPose(skeleton, "Run", 0.3, plainTarget);
	check(isSameArray(basePose, plainTarget), "인자 없음과 null 고리가 같음");
	check(isSameArray(basePose, writePose("Run", 0.3, () => {})), "빈 고리는 그대로");
	check(isSameArray(basePose, writePose("Run", 0.3, [])), "빈 표는 그대로");
	check(isSameArray(basePose, writePose("Run", 0.3, [{ name: "b_Tail02_013", rotation: [0.3, 0, 0, 0.95], weight: 0 }])), "무게 0 은 그대로");
	check(isSameArray(basePose, writePose("Run", 0.3, [{ name: "없는 뼈", translation: [1, 2, 3] }])), "못 찾은 뼈는 건너뜀");
}

// 꼬리 둘째 마디를 고치면 그 마디와 그 아래 본만 바뀌고 나머지 스킨 행렬은 비트까지 같다.
{
	const tailIndex = skeleton.nodes.findIndex((node) => node.name === "b_Tail02_013");
	check(tailIndex >= 0, "꼬리 둘째 마디");
	const subtree = readSubtree(tailIndex);
	const half = 0.4;
	const turn = [Math.sin(half), 0, 0, Math.cos(half)];
	const tablePose = writePose("Run", 0.3, [{ name: "b_Tail02_013", rotation: turn, mode: BoneModifyMode.add }]);
	const sameList = compareJoints(basePose, tablePose);
	let changedCount = 0;
	for (let jointIndex = 0; jointIndex < jointCount; ++jointIndex) {
		const isInSubtree = subtree.has(skeleton.joints[jointIndex]);
		if (isInSubtree) {
			check(!sameList[jointIndex], "고친 뼈 아래 본 " + jointIndex + " 이 바뀜");
			++changedCount;
		}
		else {
			check(sameList[jointIndex], "고치지 않은 본 " + jointIndex + " 은 그대로");
		}
	}
	check(changedCount >= 1, "바뀐 본 수 " + changedCount);
	// 번호로 준 것과 이름으로 준 것이 같다.
	check(isSameArray(tablePose, writePose("Run", 0.3, [{ nodeIndex: tailIndex, rotation: turn }])), "번호와 이름이 같음");
	// 표의 add 돌림은 그 뼈의 공간에서 뒤에 곱한 것(q x 준 돌림)과 같다.
	const hookPose = writePose("Run", 0.3, (locals) => {
		const [x, y, z, w] = locals[tailIndex].rotation;
		const [turnX, , , turnW] = turn;
		locals[tailIndex].rotation = [w * turnX + x * turnW, y * turnW + z * turnX, z * turnW - y * turnX, w * turnW - x * turnX];
	});
	for (let index = 0; index < tablePose.length; ++index) {
		checkNear(tablePose[index], hookPose[index], 1e-5, "표와 고리가 같음 " + index);
	}
}

// 고리가 움직임이 없는 노드의 배열을 제자리에서 고쳐도 뼈대의 쉬는 자세는 바뀌지 않는다.
{
	const animatedNodes = new Set(skeleton.animations["Run"].channels.map((channel) => channel.nodeIndex));
	const stillIndex = skeleton.nodes.findIndex((node, nodeIndex) => !animatedNodes.has(nodeIndex) && node.matrix === null);
	check(stillIndex >= 0, "움직임이 없는 노드");
	const restTranslation = Array.from(skeleton.nodes[stillIndex].translation);
	const movedPose = writePose("Run", 0.3, (locals) => {
		locals[stillIndex].translation[1] += 5;
	});
	check(!isSameArray(basePose, movedPose), "제자리 고침이 자세에 걸림");
	check(isSameArray(Array.from(skeleton.nodes[stillIndex].translation), restTranslation), "쉬는 자세 배열은 그대로");
	check(isSameArray(basePose, writePose("Run", 0.3, null)), "다음 자세도 그대로");
}

// replace 와 weight: 바꾸기는 그 값, 무게 반은 앞과 뒤의 가운데.
{
	const hipIndex = skeleton.nodes.findIndex((node) => node.name === "b_Hip_01");
	const readLocal = (poseAdjust) => {
		let captured = null;
		writePose("Run", 0.3, (locals, poseSkeleton) => {
			adjustBones(locals, poseSkeleton, poseAdjust);
			captured = { translation: Array.from(locals[hipIndex].translation), rotation: Array.from(locals[hipIndex].rotation), scale: Array.from(locals[hipIndex].scale) };
		});
		return captured;
	};
	const before = readLocal([]);
	const replaced = readLocal([{ name: "b_Hip_01", translation: [1, 2, 3], rotation: [0, 0, 0, 2], scale: [2, 2, 2], mode: BoneModifyMode.replace }]);
	checkEqual(JSON.stringify(replaced), JSON.stringify({ translation: [1, 2, 3], rotation: [0, 0, 0, 1], scale: [2, 2, 2] }), "바꾸기");
	const halfAdded = readLocal([{ name: "b_Hip_01", translation: [0, 4, 0], scale: [3, 1, 1], weight: 0.5 }]);
	checkNear(halfAdded.translation[1], before.translation[1] + 2, 1e-9, "무게 반 자리");
	checkNear(halfAdded.scale[0], before.scale[0] * 2, 1e-9, "무게 반 크기");
	checkNear(halfAdded.translation[0], before.translation[0], 1e-12, "준 칸 밖 자리는 그대로");
	// 고침은 차례대로 걸린다.
	const twice = readLocal([{ name: "b_Hip_01", translation: [0, 1, 0] }, { name: "b_Hip_01", translation: [0, 1, 0] }]);
	checkNear(twice.translation[1], before.translation[1] + 2, 1e-9, "두 고침 차례대로");
}

finish("skinposeadjust");
