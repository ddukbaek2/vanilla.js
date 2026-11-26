//==============================================================================
// 2D 물리 초안 시험. (node tests/experimental/physics2d.test.mjs)
// - 두 엔진 비교 장면은 tools/physics2dcompare.mjs --check 로 따로 본다. (러스트 판 comparison.txt 와 비트까지 같은지)
// - 러스트 판 src/experimental/physics2d/tests.rs 의 deterministic_math_accuracy, stack_converges_and_sleeps, queries_and_filters(광선, 거르기, 점, 상자, 모양 겹침)와
//   같은 입력, 같은 기댓값을 본다.
//==============================================================================
import { Vector2 } from "../../import.js";
import * as Experimental from "../../src/experimental/experimental.js";

const E = Experimental;
let checkCount = 0;
function check(condition, message) {
	checkCount++;
	if (!condition) {
		throw new Error("시험 실패: " + message);
	}
}
function createDynamicBody(world, x, y, angle) {
	const bodyDefinition = new E.BodyDefinition2D();
	bodyDefinition.type = E.BodyType2D.dynamic;
	bodyDefinition.position = Vector2.create(x, y);
	bodyDefinition.angle = angle;
	return world.createBody(bodyDefinition);
}

// 결정론 삼각 함수는 표준과 1e-14 안이다.
for (let index = 0; index < 20000; ++index) {
	const angle = (index / 20000 - 0.5) * 40;
	const rotation = E.PhysicsMath2D.computeRotation(angle);
	if (Math.abs(rotation.cosine - Math.cos(angle)) >= 1e-14 || Math.abs(rotation.sine - Math.sin(angle)) >= 1e-14) {
		check(false, "cos, sin " + angle);
	}
	const y = Math.sin(angle * 1.3) * (1 + index % 7);
	const x = Math.cos(angle * 0.7) * (1 + index % 5);
	if (Math.abs(E.PhysicsMath2D.computeAtan2(y, x) - Math.atan2(y, x)) >= 1e-14) {
		check(false, "atan2 " + y + " " + x);
	}
}
check(E.PhysicsMath2D.computeAtan2(0, 0) === 0 && E.PhysicsMath2D.computeAtan2(0, -1) === Math.PI, "atan2 모서리");
check(Math.abs(E.PhysicsMath2D.unwindAngle(-7) - (-7 + 2 * Math.PI)) < 1e-15, "각 감기");

// 상자 쌓기가 무너지지 않고 잠든다.
{
	const world = new E.PhysicsWorld2D(new E.WorldDefinition2D(1));
	const groundId = world.createBody(new E.BodyDefinition2D());
	world.createShape(groundId, new E.ShapeDefinition2D(), E.Segment2D.create(Vector2.create(-40, 0), Vector2.create(40, 0)));
	const rowCount = 12;
	let topId = groundId;
	for (let row = 0; row < rowCount; ++row) {
		for (let column = 0; column < rowCount - row; ++column) {
			topId = createDynamicBody(world, (column - (rowCount - row) / 2) + 0.5, -0.5 - row * 1.05, 0);
			world.createShape(topId, new E.ShapeDefinition2D(), E.Polygon2D.makeBox(0.45, 0.45));
		}
	}
	let sleepStep = null;
	for (let stepIndex = 0; stepIndex < 900; ++stepIndex) {
		world.step(1 / 60, 4);
		if (sleepStep === null && world.getAwakeBodyCount() === 0) {
			sleepStep = stepIndex;
		}
	}
	const top = world.getBody(topId).getPosition();
	const expectedTopY = -0.45 - (rowCount - 1) * 0.9;
	check(Math.abs(top.x) < 0.2 && Math.abs(top.y - expectedTopY) < 0.08, "꼭대기 " + top.x + " " + top.y);
	check(sleepStep !== null, "잠듦");
	check(world.getBroadPhaseTree().validate(), "넓은 단계 나무");
}

// 광선, 거르기, 점, 상자, 모양 겹침.
{
	const worldDefinition = new E.WorldDefinition2D(1);
	worldDefinition.gravity = Vector2.create(0, 0);
	const world = new E.PhysicsWorld2D(worldDefinition);
	const bodyId = world.createBody(new E.BodyDefinition2D());
	const boxId = world.createShape(bodyId, new E.ShapeDefinition2D(), E.Polygon2D.makeOffsetBox(1, 1, Vector2.create(5, 0), 0));
	const circleDefinition = new E.ShapeDefinition2D();
	circleDefinition.filter.categoryBits = 0x0002;
	const circleId = world.createShape(bodyId, circleDefinition, E.Circle2D.create(Vector2.create(10, 0), 1));
	const capsuleId = world.createShape(bodyId, new E.ShapeDefinition2D(), E.Capsule2D.create(Vector2.create(15, -1), Vector2.create(15, 1), 0.5));
	const allFilter = new E.QueryFilter2D();
	const hit = world.castRayClosest(Vector2.create(0, 0), Vector2.create(20, 0), allFilter);
	check(hit !== null && hit.shapeId.equals(boxId) && Math.abs(hit.point.x - 4) < 1e-12 && hit.normal.x === -1 && hit.normal.y === 0, "가장 가까운 광선");
	const hitList = [];
	world.castRay(Vector2.create(0, 0), Vector2.create(20, 0), allFilter, (shapeId, point) => {
		hitList.push([shapeId, point.x]);
		return 1;
	});
	hitList.sort((first, second) => first[1] - second[1]);
	check(hitList.length === 3 && hitList[1][0].equals(circleId) && Math.abs(hitList[2][1] - 14.5) < 1e-12 && hitList[2][0].equals(capsuleId), "모든 광선");
	const noCircleFilter = new E.QueryFilter2D();
	noCircleFilter.maskBits = ~0x0002 >>> 0;
	let count = 0;
	world.castRay(Vector2.create(8, 0), Vector2.create(4, 0), noCircleFilter, () => {
		count++;
		return 1;
	});
	check(count === 0, "분류 거르기");
	const pointHits = [];
	world.overlapPoint(Vector2.create(15.3, 1.2), allFilter, (shapeId) => {
		pointHits.push(shapeId);
		return true;
	});
	check(pointHits.length === 1 && pointHits[0].equals(capsuleId), "점 겹침");
	const aabbHits = [];
	world.overlapAabb(E.AABB2D.create(5.5, -0.1, 9.5, 0.1), allFilter, (shapeId) => {
		aabbHits.push(shapeId);
		return true;
	});
	aabbHits.sort((first, second) => first.getIndex() - second.getIndex());
	check(aabbHits.length === 2 && aabbHits[0].equals(boxId) && aabbHits[1].equals(circleId), "상자 겹침");
	const shapeHits = [];
	world.overlapShape(E.Circle2D.create(Vector2.create(0, 0), 0.6), Vector2.create(10, 1.5), 0, allFilter, (shapeId) => {
		shapeHits.push(shapeId);
		return true;
	});
	check(shapeHits.length === 1 && shapeHits[0].equals(circleId), "모양 겹침");
}

console.log(`2D 물리 시험 ${checkCount} 개 통과`);
