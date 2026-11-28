//==============================================================================
// 2D 물리 초안의 두 엔진 견주기. (vanilla.js 와 러스트 vanilla-engine 이 같은 장면에 같은 수를 내는지)
// - 실행: node tools/physics2dcompare.mjs                     장면을 돌려 덤프를 찍는다.
//         node tools/physics2dcompare.mjs --write <파일>       덤프를 파일에 쓴다. (러스트 저장소의 src/experimental/physics2d/comparison.txt)
//         node tools/physics2dcompare.mjs --check <파일>       파일과 견준다. 다르면 첫 다른 줄을 찍고 끝 코드 1.
// - 장면: 땅 선분과 사슬, 상자 피라미드, 튀는 공, 캡슐, 둥근 육각형, 회전 관절 사슬, 바퀴 관절 수레, 거리 용수철, 용접, 센서, 운동학 발판,
//   충격과 순간 이동. 600 걸음(1/60 초, 하위 걸음 4) 동안 걸음마다 사건 수를 적고, 100 걸음마다 질의(가장 가까운 광선, 모든 광선, 상자, 점, 모양 겹침)를 적고,
//   끝에 몸마다 자리, 회전, 속도를 f64 비트(16 진수)로 적는다.
// - 러스트 쪽은 src/experimental/physics2d/tests.rs 의 같은 장면이 이 파일과 견준다. (cargo test)
//==============================================================================
import { Vector2 } from "../import.js";
import * as Experimental from "../src/experimental/experimental.js";
import * as fs from "node:fs";

const System = globalThis;
const E = Experimental;

//==============================================================================
// f64 를 16 진수 비트로.
//==============================================================================
function toBits(value) {
	const dataView = new System.DataView(new System.ArrayBuffer(8));
	dataView.setFloat64(0, value);
	return dataView.getBigUint64(0).toString(16).padStart(16, "0");
}

//==============================================================================
// 동적 몸 하나 만들기.
//==============================================================================
function createDynamicBody(world, x, y, angle) {
	const bodyDefinition = new E.BodyDefinition2D();
	bodyDefinition.type = E.BodyType2D.dynamic;
	bodyDefinition.position = Vector2.create(x, y);
	bodyDefinition.angle = angle;
	return world.createBody(bodyDefinition);
}

//==============================================================================
// 장면을 돌려 덤프 글을 돌려준다.
//==============================================================================
export function runComparisonScene() {
	const lineList = [];
	const world = new E.PhysicsWorld2D(new E.WorldDefinition2D(1));
	const shapeDefinition = new E.ShapeDefinition2D();

	// 땅.
	const groundId = world.createBody(new E.BodyDefinition2D());
	world.createShape(groundId, shapeDefinition, E.Segment2D.create(Vector2.create(-30, 0), Vector2.create(30, 0)));
	const chainDefinition = new E.ChainDefinition2D();
	chainDefinition.points = [Vector2.create(-30, -6), Vector2.create(-26, -1), Vector2.create(-22, 0)];
	world.createChain(groundId, chainDefinition);
	world.createShape(groundId, shapeDefinition, E.Polygon2D.makeOffsetBox(1, 0.25, Vector2.create(12, -2), 0.3));

	// 피라미드.
	const rowCount = 6;
	for (let row = 0; row < rowCount; ++row) {
		for (let column = 0; column < rowCount - row; ++column) {
			const x = (column - (rowCount - row) * 0.5) * 0.9 + 0.45;
			const y = -0.4 - row * 0.9;
			const bodyId = createDynamicBody(world, x, y, 0);
			world.createShape(bodyId, shapeDefinition, E.Polygon2D.makeBox(0.4, 0.4));
		}
	}

	// 튀는 공.
	const ballDefinition = new E.ShapeDefinition2D();
	ballDefinition.restitution = 0.4;
	ballDefinition.friction = 0.3;
	for (let index = 0; index < 5; ++index) {
		const bodyId = createDynamicBody(world, 6 + index * 0.7, -3 - index * 1.3, 0);
		world.createShape(bodyId, ballDefinition, E.Circle2D.create(Vector2.zero(), 0.3));
	}

	// 캡슐과 둥근 육각형.
	for (let index = 0; index < 3; ++index) {
		const bodyId = createDynamicBody(world, -6 + index * 1.5, -2 - index, 0.2 * index);
		world.createShape(bodyId, shapeDefinition, E.Capsule2D.create(Vector2.create(-0.5, 0), Vector2.create(0.5, 0), 0.2));
	}
	const hexagonPointList = [];
	for (let index = 0; index < 6; ++index) {
		const rotation = E.PhysicsMath2D.computeRotation(index * System.Math.PI / 3);
		hexagonPointList.push(Vector2.create(0.5 * rotation.cosine, 0.5 * rotation.sine));
	}
	const hexagon = E.Polygon2D.makePolygon(hexagonPointList, 0.05);
	const hexagonId = createDynamicBody(world, -9, -4, 0.1);
	world.createShape(hexagonId, shapeDefinition, hexagon);

	// 회전 관절 사슬.
	const anchorId = world.createBody(new E.BodyDefinition2D());
	let previousId = anchorId;
	for (let index = 0; index < 6; ++index) {
		const linkId = createDynamicBody(world, -14 + index * 0.8 + 0.4, -8, 0);
		world.createShape(linkId, shapeDefinition, E.Capsule2D.create(Vector2.create(-0.4, 0), Vector2.create(0.4, 0), 0.1));
		const jointDefinition = new E.RevoluteJointDefinition2D();
		jointDefinition.bodyIdA = previousId;
		jointDefinition.bodyIdB = linkId;
		jointDefinition.localAnchorA = previousId === anchorId ? Vector2.create(-14, -8) : Vector2.create(0.4, 0);
		jointDefinition.localAnchorB = Vector2.create(-0.4, 0);
		if (index === 0) {
			jointDefinition.enableLimit = true;
			jointDefinition.lowerAngle = -0.5;
			jointDefinition.upperAngle = 1.2;
		}
		world.createRevoluteJoint(jointDefinition);
		previousId = linkId;
	}

	// 수레.
	const chassisId = createDynamicBody(world, 16, -1.2, 0);
	world.createShape(chassisId, shapeDefinition, E.Polygon2D.makeBox(1, 0.25));
	for (let index = 0; index < 2; ++index) {
		const offsetX = index === 0 ? -0.7 : 0.7;
		const wheelId = createDynamicBody(world, 16 + offsetX, -0.5, 0);
		world.createShape(wheelId, shapeDefinition, E.Circle2D.create(Vector2.zero(), 0.35));
		const wheelDefinition = new E.WheelJointDefinition2D();
		wheelDefinition.bodyIdA = chassisId;
		wheelDefinition.bodyIdB = wheelId;
		wheelDefinition.localAnchorA = Vector2.create(offsetX, 0.7);
		wheelDefinition.hertz = 5;
		wheelDefinition.dampingRatio = 0.7;
		wheelDefinition.enableMotor = true;
		wheelDefinition.motorSpeed = -4;
		wheelDefinition.maxMotorTorque = 10;
		wheelDefinition.enableLimit = true;
		wheelDefinition.lowerTranslation = -0.3;
		wheelDefinition.upperTranslation = 0.3;
		world.createWheelJoint(wheelDefinition);
	}

	// 거리 용수철과 용접.
	const bobId = createDynamicBody(world, -18, -6, 0);
	world.createShape(bobId, shapeDefinition, E.Circle2D.create(Vector2.zero(), 0.25));
	const distanceDefinition = new E.DistanceJointDefinition2D();
	distanceDefinition.bodyIdA = anchorId;
	distanceDefinition.bodyIdB = bobId;
	distanceDefinition.localAnchorA = Vector2.create(-18, -9);
	distanceDefinition.length = 2;
	distanceDefinition.enableSpring = true;
	distanceDefinition.hertz = 2;
	distanceDefinition.dampingRatio = 0.2;
	distanceDefinition.enableLimit = true;
	distanceDefinition.minLength = 1;
	distanceDefinition.maxLength = 3;
	world.createDistanceJoint(distanceDefinition);
	const ropeBobId = createDynamicBody(world, -20, -7, 0);
	world.createShape(ropeBobId, shapeDefinition, E.Polygon2D.makeBox(0.2, 0.2));
	const ropeDefinition = new E.DistanceJointDefinition2D();
	ropeDefinition.bodyIdA = anchorId;
	ropeDefinition.bodyIdB = ropeBobId;
	ropeDefinition.localAnchorA = Vector2.create(-21, -9);
	ropeDefinition.length = 2.5;
	world.createDistanceJoint(ropeDefinition);
	const weldAId = createDynamicBody(world, 3, -6, 0);
	world.createShape(weldAId, shapeDefinition, E.Polygon2D.makeBox(0.5, 0.2));
	const weldBId = createDynamicBody(world, 4, -6, 0);
	world.createShape(weldBId, shapeDefinition, E.Polygon2D.makeBox(0.5, 0.2));
	const weldDefinition = new E.WeldJointDefinition2D();
	weldDefinition.bodyIdA = weldAId;
	weldDefinition.bodyIdB = weldBId;
	weldDefinition.localAnchorA = Vector2.create(0.5, 0);
	weldDefinition.localAnchorB = Vector2.create(-0.5, 0);
	weldDefinition.angularHertz = 3;
	weldDefinition.angularDampingRatio = 0.5;
	world.createWeldJoint(weldDefinition);

	// 센서와 운동학 발판.
	const sensorBodyId = world.createBody(new E.BodyDefinition2D());
	const sensorDefinition = new E.ShapeDefinition2D();
	sensorDefinition.isSensor = true;
	world.createShape(sensorBodyId, sensorDefinition, E.Polygon2D.makeOffsetBox(2, 1, Vector2.create(7.5, -1.5), 0));
	const platformDefinition = new E.BodyDefinition2D();
	platformDefinition.type = E.BodyType2D.kinematic;
	platformDefinition.position = Vector2.create(-3, -5);
	platformDefinition.linearVelocity = Vector2.create(1, 0);
	const platformId = world.createBody(platformDefinition);
	world.createShape(platformId, shapeDefinition, E.Polygon2D.makeBox(1.5, 0.2));
	const riderId = createDynamicBody(world, -3, -5.6, 0);
	world.createShape(riderId, shapeDefinition, E.Polygon2D.makeBox(0.3, 0.3));

	// 걸음.
	const queryFilter = new E.QueryFilter2D();
	for (let stepIndex = 0; stepIndex < 600; ++stepIndex) {
		if (stepIndex === 30) {
			const body = world.getBody(riderId);
			body.applyLinearImpulse(Vector2.create(0.5, -1), body.getWorldPoint(Vector2.create(0.1, 0)), true);
		}
		if (stepIndex % 120 === 60) {
			const platform = world.getBody(platformId);
			const velocity = platform.getLinearVelocity();
			platform.setLinearVelocity(Vector2.create(-velocity.x, 0));
		}
		if (stepIndex === 200) {
			const body = world.getBody(bobId);
			body.setTransform(Vector2.create(-17, -7), 0.5);
		}
		world.step(1 / 60, 4);
		const beginCount = world.getContactBeginEvents().length;
		const endCount = world.getContactEndEvents().length;
		const sensorBeginCount = world.getSensorBeginEvents().length;
		const sensorEndCount = world.getSensorEndEvents().length;
		if (beginCount + endCount + sensorBeginCount + sensorEndCount > 0) {
			lineList.push("step " + stepIndex + " events " + beginCount + " " + endCount + " " + sensorBeginCount + " " + sensorEndCount);
		}
		if (stepIndex % 100 === 99) {
			const hit = world.castRayClosest(Vector2.create(-30, -0.2), Vector2.create(60, 0), queryFilter);
			if (hit === null) {
				lineList.push("step " + stepIndex + " ray none");
			}
			else {
				lineList.push("step " + stepIndex + " ray " + hit.shapeId.getIndex() + " " + toBits(hit.fraction) + " " + toBits(hit.point.x) + " " + toBits(hit.normal.x) + " " + toBits(hit.normal.y));
			}
			lineList.push("step " + stepIndex + " awake " + world.getAwakeBodyCount() + " contacts " + world.getContactCount());
			// 질의: 모든 광선 맞음(돌려준 값 1 로 끝까지), 상자, 점, 모양 겹침. (부른 차례대로 모양 번호)
			const rayHitList = [];
			world.castRay(Vector2.create(-8, -3), Vector2.create(20, 2.5), queryFilter, (shapeId, point, normal, fraction) => {
				rayHitList.push(shapeId.getIndex() + ":" + toBits(fraction) + ":" + toBits(point.y) + ":" + toBits(normal.x));
				return 1;
			});
			lineList.push("step " + stepIndex + " rays " + rayHitList.join(" "));
			const aabbList = [];
			world.overlapAabb(E.AABB2D.create(-3, -4, 3, 0.5), queryFilter, (shapeId) => {
				aabbList.push(shapeId.getIndex());
				return true;
			});
			lineList.push("step " + stepIndex + " aabb " + aabbList.join(" "));
			const pointList = [];
			world.overlapPoint(Vector2.create(0.2, -0.5), queryFilter, (shapeId) => {
				pointList.push(shapeId.getIndex());
				return true;
			});
			lineList.push("step " + stepIndex + " point " + pointList.join(" "));
			const shapeList = [];
			world.overlapShape(E.Circle2D.create(Vector2.zero(), 1.2), Vector2.create(-1, -1.5), 0.3, queryFilter, (shapeId) => {
				shapeList.push(shapeId.getIndex());
				return shapeList.length < 4;
			});
			lineList.push("step " + stepIndex + " shape " + shapeList.join(" "));
		}
	}
	for (const bodyId of world.getBodyIds()) {
		const body = world.getBody(bodyId);
		const position = body.getPosition();
		const rotation = body.getRotation();
		const velocity = body.getLinearVelocity();
		const angularVelocity = body.getAngularVelocity();
		lineList.push("body " + bodyId.getIndex() + " " + toBits(position.x) + " " + toBits(position.y) + " " + toBits(rotation.cosine) + " " + toBits(rotation.sine) + " " + toBits(velocity.x) + " " + toBits(velocity.y) + " " + toBits(angularVelocity) + " " + (body.isAwake() ? 1 : 0));
	}
	const tree = world.getBroadPhaseTree();
	lineList.push("tree " + tree.getProxyCount() + " " + tree.getHeight() + " " + toBits(tree.getAreaRatio()));
	return lineList.join("\n") + "\n";
}

//==============================================================================
// 시작.
//==============================================================================
const argumentList = System.process.argv.slice(2);
const dumpText = runComparisonScene();
if (argumentList[0] === "--write" && argumentList[1]) {
	fs.writeFileSync(argumentList[1], dumpText);
	console.log("썼다: " + argumentList[1] + " (" + dumpText.split("\n").length + " 줄)");
}
else if (argumentList[0] === "--check" && argumentList[1]) {
	const expectedText = fs.readFileSync(argumentList[1], "utf8");
	if (expectedText === dumpText) {
		console.log("같다: " + dumpText.split("\n").length + " 줄");
	}
	else {
		const expectedLineList = expectedText.split("\n");
		const actualLineList = dumpText.split("\n");
		for (let index = 0; index < System.Math.max(expectedLineList.length, actualLineList.length); ++index) {
			if (expectedLineList[index] !== actualLineList[index]) {
				console.log("다르다 " + (index + 1) + " 줄\n  파일: " + expectedLineList[index] + "\n  JS:   " + actualLineList[index]);
				break;
			}
		}
		System.process.exit(1);
	}
}
else {
	System.process.stdout.write(dumpText);
}
