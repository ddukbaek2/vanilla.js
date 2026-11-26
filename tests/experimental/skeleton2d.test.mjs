//==============================================================================
// 2D 뼈대 초안 시험. (node tests/experimental/skeleton2d.test.mjs)
// - examples/skeleton2d/skeleton2dcheck.mjs(러스트 판 experimental/skeleton2d 시험과 같은 입력, 같은 기댓값)를 돌리고,
//   IK 번호 찾기를 러스트 판 ik_two_bone_and_one_bone 과 같은 값으로 본다.
//==============================================================================
import { spawnSync } from "node:child_process";
import path from "node:path";
import url from "node:url";
import * as Experimental from "../../src/experimental/experimental.js";

const { Skeleton2DData, Skeleton2D } = Experimental;
let checkCount = 0;
function check(condition, message) {
	checkCount++;
	if (!condition) {
		throw new Error("시험 실패: " + message);
	}
}

// 예제의 셈 확인. (러스트 판 시험과 같은 값)
const repositoryPath = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");
const checkResult = spawnSync(process.execPath, [path.join(repositoryPath, "examples/skeleton2d/skeleton2dcheck.mjs")], { encoding: "utf8" });
check(checkResult.status === 0, "examples/skeleton2d/skeleton2dcheck.mjs: " + checkResult.stdout.slice(-300) + checkResult.stderr.slice(-300));

// IK 번호 찾기. (없으면 -1)
const aimData = Skeleton2DData.createFromJson({
	bones: [{ name: "root", rotation: 30 }, { name: "arm", parent: "root", length: 10 }, { name: "target", parent: "root", x: 0, y: 10 }],
	ik: [{ name: "aim", bones: ["arm"], target: "target", mix: 0.5 }],
});
const aimSkeleton = new Skeleton2D(aimData);
check(aimSkeleton.findIkConstraintIndex("aim") === 0 && aimSkeleton.findIkConstraintIndex("none") === -1, "IK 번호 찾기");

console.log(`2D 뼈대 시험 ${checkCount} 개 통과`);
