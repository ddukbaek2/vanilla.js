//==============================================================================
// 2D 뼈대 초안 셈 확인. (node examples/skeleton2d/skeleton2dcheck.mjs)
// - 러스트 판 vanilla-engine 의 experimental/skeleton2d 시험(#[test])과 같은 입력, 같은 기댓값을 견준다.
//   월드 변환, 곡선 보간, 클립 걸기, 크로스페이드와 층, IK(뼈 하나, 둘, 꺾임 쪽, 세기), 스킨 꼭짓점, 엔진 JSON 과 DragonBones 읽기, 사건, 그리기 차례.
// - 모두 맞으면 "통과 N 개", 하나라도 틀리면 틀린 것을 찍고 끝 코드 1.
//==============================================================================
const System = globalThis;
const engineModule = await import("../../import.js");
const Experimental = engineModule.Experimental;
const fs = await import("node:fs");
const path = await import("node:path");
const url = await import("node:url");


//==============================================================================
// 전역 상수 목록.
//==============================================================================
const TOLERANCE = 0.0005;
const exampleDirectory = path.dirname(url.fileURLToPath(import.meta.url));
let passedCount = 0;
let failedCount = 0;


//==============================================================================
// 값 견주기.
//==============================================================================
function expectNear(label, actual, expected) {
	if (System.Math.abs(actual - expected) <= TOLERANCE) {
		passedCount += 1;
		return;
	}
	failedCount += 1;
	console.log(`틀림 ${label}: ${actual} (기댓값 ${expected})`);
}


//==============================================================================
// 같은지 견주기.
//==============================================================================
function expectEqual(label, actual, expected) {
	const actualText = System.JSON.stringify(actual);
	const expectedText = System.JSON.stringify(expected);
	if (actualText === expectedText) {
		passedCount += 1;
		return;
	}
	failedCount += 1;
	console.log(`틀림 ${label}: ${actualText} (기댓값 ${expectedText})`);
}


//==============================================================================
// 1. 월드 변환. (부모의 이동, 회전, 크기, 기울임을 물려받는다)
//==============================================================================
{
	const skeletonData = Experimental.Skeleton2DData.createFromJson({
		bones: [
			{ name: "root", x: 100, y: 50, rotation: 90, scaleX: 2 },
			{ name: "child", parent: "root", x: 10, rotation: -90 },
			{ name: "sheared", parent: "child", x: 5, shearY: 30 },
		],
	});
	const skeleton = new Experimental.Skeleton2D(skeletonData);
	skeleton.updateWorldTransform();
	const child = skeleton.findBone("child");
	const sheared = skeleton.findBone("sheared");
	expectNear("월드 child x", child.getWorldX(), 100);
	expectNear("월드 child y", child.getWorldY(), 70);
	expectNear("월드 child a", child.getWorldA(), 1);
	expectNear("월드 child d", child.getWorldD(), 2);
	expectNear("월드 sheared x", sheared.getWorldX(), 105);
	expectNear("월드 sheared y", sheared.getWorldY(), 70);
	expectNear("월드 sheared c", sheared.getWorldC(), -0.5);
	expectNear("월드 sheared d", sheared.getWorldD(), 1.7320508);
	const local = sheared.worldToLocal(110, 80);
	const back = sheared.localToWorld(local.x, local.y);
	expectNear("월드 되돌림 x", back.x, 110);
	expectNear("월드 되돌림 y", back.y, 80);
}


//==============================================================================
// 2. 곡선 보간.
//==============================================================================
{
	const curveType = Experimental.Skeleton2DCurveType;
	expectNear("곡선 선형", Experimental.evaluateSkeleton2DCurve(curveType.linear, null, 0.3), 0.3);
	expectNear("곡선 계단", Experimental.evaluateSkeleton2DCurve(curveType.stepped, null, 0.99), 0);
	expectNear("곡선 베지어 대칭", Experimental.evaluateSkeleton2DCurve(curveType.bezier, [0.42, 0, 0.58, 1], 0.5), 0.5);
	expectNear("곡선 베지어 ease", Experimental.evaluateSkeleton2DCurve(curveType.bezier, [0.25, 0.1, 0.25, 1], 0.5), 0.8024034);
	expectNear("곡선 베지어 끝", Experimental.evaluateSkeleton2DCurve(curveType.bezier, [0.25, 0.1, 0.25, 1], 1), 1);
}


//==============================================================================
// 3. 클립 걸기, 크로스페이드, 층.
//==============================================================================
{
	const skeletonData = Experimental.Skeleton2DData.createFromJson({
		bones: [{ name: "root" }, { name: "body", parent: "root", y: -20 }, { name: "leg", parent: "root", rotation: 90 }, { name: "arm", parent: "root" }],
		animations: {
			idle: { duration: 1, bones: { body: { translate: [{ time: 0, y: 0 }] } } },
			walk: {
				duration: 1,
				bones: {
					body: { translate: [{ time: 0, y: -10 }] },
					leg: { rotate: [{ time: 0, value: -20, curve: "stepped" }, { time: 0.5, value: 20, curve: [0.42, 0, 0.58, 1] }, { time: 1, value: -20 }] },
				},
			},
			wave: { bones: { arm: { rotate: [{ time: 0, value: 0 }, { time: 1, value: 80 }] } } },
		},
	});
	const skeleton = new Experimental.Skeleton2D(skeletonData);
	const animationState = new Experimental.Skeleton2DAnimationState(skeletonData);
	animationState.setAnimation(0, "idle", true, 0);
	animationState.update(0.5);
	animationState.setAnimation(0, "walk", true, 0.2);
	animationState.update(0.1);
	animationState.apply(skeleton);
	expectNear("크로스페이드 body y", skeleton.findBone("body").getY(), -25);
	expectNear("크로스페이드 leg 계단", skeleton.findBone("leg").getRotation(), 80);
	animationState.update(0.15);
	animationState.apply(skeleton);
	expectNear("크로스페이드 끝 body y", skeleton.findBone("body").getY(), -30);
	expectEqual("섞여 나간 항목 떼기", animationState.getTrack(0).getMixingFrom(), null);
	animationState.update(0.5);
	animationState.apply(skeleton);
	expectNear("베지어 키 leg", skeleton.findBone("leg").getRotation(), 90);
	animationState.setAnimation(1, "wave", true, 0);
	animationState.setTrackAlpha(1, 0.5);
	animationState.update(0.5);
	animationState.apply(skeleton);
	expectNear("층 몫 arm", skeleton.findBone("arm").getRotation(), 20);
	const pose = new Experimental.Skeleton2DPose(1, 0);
	const targetPose = new Experimental.Skeleton2DPose(1, 0);
	pose.getBoneValues()[2] = 170;
	targetPose.getBoneValues()[2] = -170;
	pose.blend(targetPose, 0.5);
	expectNear("짧은 쪽 회전 섞기", pose.getBoneValues()[2], 180);
}


//==============================================================================
// 4. IK. (뼈 둘이 닿는 목표, 꺾임 쪽, 닿지 않는 목표, 뼈 하나, 세기)
//==============================================================================
{
	const createArmData = (isBendPositive, targetX, targetY) => Experimental.Skeleton2DData.createFromJson({
		bones: [
			{ name: "root" },
			{ name: "upper", parent: "root", length: 50 },
			{ name: "lower", parent: "upper", x: 50, length: 50 },
			{ name: "target", parent: "root", x: targetX, y: targetY },
		],
		ik: [{ name: "armIk", bones: ["upper", "lower"], target: "target", bendPositive: isBendPositive }],
	});
	const positiveSkeleton = new Experimental.Skeleton2D(createArmData(true, 60, 40));
	positiveSkeleton.updateWorldTransform();
	const positiveTip = positiveSkeleton.findBone("lower").localToWorld(50, 0);
	expectNear("IK 둘 끝 x", positiveTip.x, 60);
	expectNear("IK 둘 끝 y", positiveTip.y, 40);
	expectNear("IK 둘 팔꿈치 x", positiveSkeleton.findBone("lower").getWorldX(), 49.2153785);
	expectNear("IK 둘 팔꿈치 y", positiveSkeleton.findBone("lower").getWorldY(), -8.8230677);
	expectNear("IK 둘 걸린 회전", positiveSkeleton.findBone("lower").getAppliedRotation(), 87.7075572);
	expectNear("IK 지역 회전 그대로", positiveSkeleton.findBone("lower").getRotation(), 0);
	const negativeSkeleton = new Experimental.Skeleton2D(createArmData(false, 60, 40));
	negativeSkeleton.updateWorldTransform();
	const negativeTip = negativeSkeleton.findBone("lower").localToWorld(50, 0);
	expectNear("IK 반대 꺾임 끝 x", negativeTip.x, 60);
	expectNear("IK 반대 꺾임 끝 y", negativeTip.y, 40);
	expectNear("IK 반대 꺾임 팔꿈치 x", negativeSkeleton.findBone("lower").getWorldX(), 10.7846215);
	expectNear("IK 반대 꺾임 팔꿈치 y", negativeSkeleton.findBone("lower").getWorldY(), 48.8230677);
	const farSkeleton = new Experimental.Skeleton2D(createArmData(true, 0, 300));
	farSkeleton.updateWorldTransform();
	const farTip = farSkeleton.findBone("lower").localToWorld(50, 0);
	expectNear("IK 닿지 않음 x", farTip.x, 0);
	expectNear("IK 닿지 않음 y", farTip.y, 100);
	const aimData = Experimental.Skeleton2DData.createFromJson({
		bones: [{ name: "root", rotation: 30 }, { name: "arm", parent: "root", length: 10 }, { name: "target", parent: "root", x: 0, y: 10 }],
		ik: [{ name: "aim", bones: ["arm"], target: "target", mix: 0.5 }],
	});
	const aimSkeleton = new Experimental.Skeleton2D(aimData);
	aimSkeleton.updateWorldTransform();
	expectNear("IK 하나 세기 반", aimSkeleton.findBone("arm").getWorldRotation(), 75);
	expectNear("IK 하나 걸린 회전", aimSkeleton.findBone("arm").getAppliedRotation(), 45);
}


//==============================================================================
// 5. 스킨 꼭짓점. (무게 반반, 한 뼈를 돌림)
//==============================================================================
{
	const skeletonData = Experimental.Skeleton2DData.createFromJson({
		bones: [{ name: "root" }, { name: "boneA", parent: "root" }, { name: "boneB", parent: "root", x: 100 }],
		slots: [{ name: "cloth", bone: "root", attachment: "cloth" }],
		skins: [{ name: "default", attachments: { cloth: { cloth: {
			type: "mesh", frame: "cloth",
			vertices: [0, 0, 100, 10, 100, -10],
			uvs: [0, 0.5, 1, 1, 1, 0],
			triangles: [0, 1, 2],
			weights: [["boneA", 1], ["boneA", 1, "boneB", 1], ["boneB", 2]],
		} } } }],
	});
	const skeleton = new Experimental.Skeleton2D(skeletonData);
	skeleton.findBone("boneB").setRotation(90);
	skeleton.updateWorldTransform();
	const positions = new Float64Array(6);
	const vertexCount = skeleton.computeAttachmentVertices(0, positions, 0, 0);
	expectEqual("스킨 꼭짓점 수", vertexCount, 3);
	expectNear("스킨 0 x", positions[0], 0);
	expectNear("스킨 1 x", positions[2], 95);
	expectNear("스킨 1 y", positions[3], 5);
	expectNear("스킨 2 x", positions[4], 110);
	expectNear("스킨 2 y", positions[5], 0);
	const regionData = Experimental.Skeleton2DData.createFromJson({
		bones: [{ name: "root" }, { name: "head", parent: "root", x: 10, rotation: 90 }],
		slots: [{ name: "head", bone: "head", attachment: "face" }],
		skins: [{ name: "default", attachments: { head: { face: { type: "region", x: 5, width: 20, height: 10, pivotX: 0, pivotY: 0.5 } } } }],
	});
	const regionSkeleton = new Experimental.Skeleton2D(regionData);
	regionSkeleton.updateWorldTransform();
	const regionPositions = new Float64Array(8);
	regionSkeleton.computeAttachmentVertices(0, regionPositions, 0, 0);
	expectNear("네모 왼쪽 위 x", regionPositions[0], 15);
	expectNear("네모 왼쪽 위 y", regionPositions[1], 5);
	expectNear("네모 오른쪽 아래 x", regionPositions[4], 5);
	expectNear("네모 오른쪽 아래 y", regionPositions[5], 25);
}


//==============================================================================
// 6. 사건과 그리기 차례, 붙임 시간줄.
//==============================================================================
{
	const skeletonData = Experimental.Skeleton2DData.createFromJson({
		bones: [{ name: "root" }],
		slots: [{ name: "back", bone: "root", attachment: "a" }, { name: "front", bone: "root" }],
		skins: [{ name: "default", attachments: { back: { a: { width: 1, height: 1 }, b: { width: 1, height: 1 } } } }],
		animations: {
			loop: {
				duration: 1,
				slots: { back: { attachment: [{ time: 0, name: "a" }, { time: 0.5, name: "b" }] } },
				drawOrder: [{ time: 0 }, { time: 0.5, order: ["front", "back"] }],
				events: [{ time: 0, name: "start" }, { time: 0.5, name: "middle", int: 3, float: 1.5, string: "x" }],
			},
		},
	});
	const skeleton = new Experimental.Skeleton2D(skeletonData);
	const animationState = new Experimental.Skeleton2DAnimationState(skeletonData);
	animationState.setAnimation(0, "loop", true, 0);
	animationState.update(0.25);
	const firstNames = animationState.takeEvents().map((firedEvent) => firedEvent.getEvent().getName());
	expectEqual("사건 처음", firstNames, ["start"]);
	animationState.update(0.5);
	animationState.apply(skeleton);
	const secondEvents = animationState.takeEvents();
	expectEqual("사건 가운데", secondEvents.map((firedEvent) => firedEvent.getEvent().getName()), ["middle"]);
	expectEqual("사건 값", [secondEvents[0].getEvent().getIntValue(), secondEvents[0].getEvent().getFloatValue(), secondEvents[0].getEvent().getStringValue()], [3, 1.5, "x"]);
	expectEqual("그리기 차례", skeleton.getDrawOrder(), [1, 0]);
	expectEqual("붙임 시간줄", skeleton.findSlot("back").getAttachmentName(), "b");
	animationState.update(1.5);
	expectEqual("사건 되풀이 두 번", animationState.takeEvents().map((firedEvent) => firedEvent.getEvent().getName()), ["start", "middle", "start"]);
}


//==============================================================================
// 7. DragonBones 읽기. (예제의 같은 캐릭터를 두 꼴로 읽어 같은 꼭짓점이 나오는지, 회전 키 펴기, zOrder, 곡선)
//==============================================================================
{
	const engineJson = System.JSON.parse(fs.readFileSync(path.join(exampleDirectory, "assets", "hero.skeleton.json"), "utf8"));
	const dragonBonesJson = System.JSON.parse(fs.readFileSync(path.join(exampleDirectory, "assets", "hero_ske.json"), "utf8"));
	const engineData = Experimental.Skeleton2DData.createFromJson(engineJson);
	const dragonBonesData = Experimental.Skeleton2DData.createFromDragonBones(dragonBonesJson, "hero");
	expectEqual("DragonBones 뼈 수", dragonBonesData.getBones().length, engineData.getBones().length);
	expectEqual("DragonBones 슬롯 수", dragonBonesData.getSlots().length, engineData.getSlots().length);
	const engineSkeleton = new Experimental.Skeleton2D(engineData);
	const dragonBonesSkeleton = new Experimental.Skeleton2D(dragonBonesData);
	const engineState = new Experimental.Skeleton2DAnimationState(engineData);
	const dragonBonesState = new Experimental.Skeleton2DAnimationState(dragonBonesData);
	engineState.setAnimation(0, "walk", true, 0);
	dragonBonesState.setAnimation(0, "walk", true, 0);
	let maximumDifference = 0;
	for (let step = 0; step < 40; ++step) {
		engineState.update(1 / 30);
		dragonBonesState.update(1 / 30);
		engineState.apply(engineSkeleton);
		dragonBonesState.apply(dragonBonesSkeleton);
		engineSkeleton.updateWorldTransform();
		dragonBonesSkeleton.updateWorldTransform();
		const slotCount = engineData.getSlots().length;
		for (let slotIndex = 0; slotIndex < slotCount; ++slotIndex) {
			const enginePositions = new Float64Array(256);
			const dragonBonesPositions = new Float64Array(256);
			const engineCount = engineSkeleton.computeAttachmentVertices(slotIndex, enginePositions, 16, 16);
			const dragonBonesCount = dragonBonesSkeleton.computeAttachmentVertices(slotIndex, dragonBonesPositions, 16, 16);
			if (engineCount !== dragonBonesCount) {
				maximumDifference = System.Number.POSITIVE_INFINITY;
				continue;
			}
			for (let valueIndex = 0; valueIndex < engineCount * 2; ++valueIndex) {
				maximumDifference = System.Math.max(maximumDifference, System.Math.abs(enginePositions[valueIndex] - dragonBonesPositions[valueIndex]));
			}
		}
	}
	expectNear("DragonBones 와 엔진 JSON 꼭짓점 차이", maximumDifference, 0);
	const unwrapData = Experimental.Skeleton2DData.createFromDragonBones({
		frameRate: 10,
		armature: [{
			name: "spin",
			bone: [{ name: "root" }, { name: "wheel", parent: "root", transform: { skX: 30, skY: 10 } }],
			slot: [{ name: "a", parent: "root" }, { name: "b", parent: "root" }, { name: "c", parent: "root" }],
			animation: [{
				name: "turn", duration: 30,
				bone: [{ name: "wheel", rotateFrame: [
					{ duration: 10, tweenEasing: 0, rotate: 170 },
					{ duration: 10, tweenEasing: 0, rotate: -170, clockwise: 1 },
					{ duration: 10, tweenEasing: 0.5, rotate: 10 },
					{ duration: 0, rotate: 0 },
				] }],
				zOrder: { frame: [{ duration: 10, zOrder: [2, -2] }, { duration: 0 }] },
			}],
		}],
	}, null);
	const wheelData = unwrapData.findBone("wheel");
	expectNear("DragonBones 회전 skY", wheelData.getRotation(), 10);
	expectNear("DragonBones 기울임 skX - skY", wheelData.getShearY(), 20);
	const turnAnimation = unwrapData.findAnimation("turn");
	expectNear("DragonBones 길이", turnAnimation.getDuration(), 3);
	const rotateTimeline = turnAnimation.getTimelines()[0];
	const sampled = [0];
	rotateTimeline.sampleValues(1, sampled);
	expectNear("DragonBones 가까운 쪽 펴기", sampled[0], 190);
	rotateTimeline.sampleValues(2, sampled);
	expectNear("DragonBones clockwise 한 바퀴", sampled[0], 370);
	rotateTimeline.sampleValues(2.5, sampled);
	expectNear("DragonBones QuadOut 반 세기", sampled[0], 370 + (360 - 370) * 0.625);
	const unwrapSkeleton = new Experimental.Skeleton2D(unwrapData);
	const unwrapState = new Experimental.Skeleton2DAnimationState(unwrapData);
	unwrapState.setAnimation(0, "turn", false, 0);
	unwrapState.update(0.5);
	unwrapState.apply(unwrapSkeleton);
	expectEqual("DragonBones zOrder", unwrapSkeleton.getDrawOrder(), [2, 0, 1]);
	unwrapState.update(1);
	unwrapState.apply(unwrapSkeleton);
	expectEqual("DragonBones zOrder 처음으로", unwrapSkeleton.getDrawOrder(), [0, 1, 2]);
}


//==============================================================================
// 8. 읽기 오류. (부모가 뒤에 있는 뼈)
//==============================================================================
{
	let errorMessage = "";
	try {
		Experimental.Skeleton2DData.createFromJson({ bones: [{ name: "child", parent: "root" }, { name: "root" }] });
	}
	catch (error) {
		errorMessage = error.message;
	}
	expectEqual("읽기 오류 글", errorMessage, "[Skeleton2D] 뼈 \"child\" 의 부모 \"root\" 가 앞에 없다. (부모가 앞에 와야 한다)");
}

console.log(`통과 ${passedCount} 개, 틀림 ${failedCount} 개`);
if (failedCount > 0) {
	process.exit(1);
}
