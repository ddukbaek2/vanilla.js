//==============================================================================
// 포함 모듈 목록.
//==============================================================================
// 옮긴 원문: Box2D 3 의 셈에서 옮김, MIT, THIRD_PARTY_LICENSES.md
const System = globalThis;
import { Object } from "../../base/object.js";
import { Vector2 } from "../../base/vector2.js";
import { FixedStepper } from "../../misc/fixedstepper.js";
import { AABB2D } from "../spatial/aabb2d.js";
import { DynamicTree } from "../spatial/dynamictree.js";
import { PhysicsMath2D } from "./physicsmath2d.js";
import { ShapeType2D, Segment2D, Circle2D, Capsule2D, Polygon2D } from "./geometry2d.js";
import { BodyId2D, ShapeId2D, JointId2D } from "./physicsid2d.js";
import { BodyType2D, BodyDefinition2D, BodyData, Body2D, updateBodyCenter } from "./body2d.js";
import { ShapeDefinition2D, ChainDefinition2D, QueryFilter2D, ShapeData, Shape2D, setShapeGeometry, computeShapeMass, computeShapeAabb, computeShapeExtent, shouldFiltersCollide } from "./shape2d.js";
import { WorldShape, Manifold, fillWorldShape, collideShapes, rayCastWorldShape, testPointInWorldShape } from "./narrowphase2d.js";
import { StepContext, SolverBody, Contact, makeSoftness, prepareContact, warmStartContact, solveContact, applyContactRestitution, integrateRotation } from "./solver2d.js";
import { JointType2D, DistanceJointDefinition2D, RevoluteJointDefinition2D, WeldJointDefinition2D, WheelJointDefinition2D, JointData, Joint2D, prepareJoint, warmStartJoint, solveJoint } from "./joint2d.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 닿음 짝 열쇠의 위쪽 배수. (작은 모양 번호 x 이 값 + 큰 모양 번호)
const CONTACT_KEY_MULTIPLIER = 4294967296;
// 한 하위 걸음에 도는 가장 큰 각도. (Box2D 의 B2_MAX_ROTATION = 0.25 파이)
const MAXIMUM_ROTATION = 0.25 * System.Math.PI;
// 잠들기 전에 가만히 있어야 하는 시간. (초, Box2D 의 B2_TIME_TO_SLEEP)
const TIME_TO_SLEEP = 0.5;


//==============================================================================
// 월드 정의. (PhysicsWorld2D 에 넘기는 값)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - lengthUnitsPerMeter 는 1 미터가 몇 길이 단위인지다. 화소로 쓰면 50 처럼 준다. 허용 오차(0.005 m), 앞질러 보기 거리, 뚱뚱한 상자 여유,
//   잠들 속력 같은 안쪽 길이와 아래 기본값이 이 값에 맞춰진다. (Box2D 의 b2SetLengthUnitsPerMeter 와 같은 뜻)
// - 엔진 화면은 y 가 아래로 커서 기본 중력은 (0, 10 x lengthUnitsPerMeter) 다.
//==============================================================================
/**
 * @example <caption>화소 단위 월드 정의</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const worldDefinition = new Experimental.WorldDefinition2D(50);
 * console.log(worldDefinition.gravity.y, worldDefinition.restitutionThreshold, worldDefinition.contactHertz);
 */
export class WorldDefinition2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { number } */ lengthUnitsPerMeter; // 1 미터의 길이 단위 수.
	/** @type { Vector2 } */ gravity; // 중력 가속도. (길이 단위 / 초의 제곱)
	/** @type { boolean } */ enableSleep; // 잠자기를 쓸지. (기본 참)
	/** @type { number } */ contactHertz; // 닿음의 부드러움 진동수. (기본 30)
	/** @type { number } */ contactDampingRatio; // 닿음의 감쇠비. (기본 10)
	/** @type { number } */ jointHertz; // 관절의 부드러움 진동수. (기본 60)
	/** @type { number } */ jointDampingRatio; // 관절의 감쇠비. (기본 2)
	/** @type { number } */ restitutionThreshold; // 이 속력보다 느리게 부딪히면 튀지 않는다. (기본 1 m/s)
	/** @type { number } */ maximumContactPushSpeed; // 겹침을 밀어내는 가장 큰 속력. (기본 3 m/s)
	/** @type { number } */ maximumLinearSpeed; // 몸의 가장 큰 속력. (기본 400 m/s)

	//==============================================================================
	// 생성. (Box2D 3.0 의 기본값을 lengthUnitsPerMeter 에 맞춘다)
	//==============================================================================
	/**
	 * @constructor
	 * @param { number } lengthUnitsPerMeter 1 미터의 길이 단위 수. (기본 1, 0 보다 커야 한다)
	 */
	constructor(lengthUnitsPerMeter = 1) {
		super();
		const unitsPerMeter = lengthUnitsPerMeter > 0 ? lengthUnitsPerMeter : 1;
		this.lengthUnitsPerMeter = unitsPerMeter;
		this.gravity = Vector2.create(0, 10 * unitsPerMeter);
		this.enableSleep = true;
		this.contactHertz = 30;
		this.contactDampingRatio = 10;
		this.jointHertz = 60;
		this.jointDampingRatio = 2;
		this.restitutionThreshold = 1 * unitsPerMeter;
		this.maximumContactPushSpeed = 3 * unitsPerMeter;
		this.maximumLinearSpeed = 400 * unitsPerMeter;
	}
}


//==============================================================================
// 닿음 사건. (닿기 시작하거나 끝난 모양 짝)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
//==============================================================================
/**
 * @example <caption>닿기 시작한 짝 읽기</caption>
 * import { Vector2 } from "./import.js";
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const world = new Experimental.PhysicsWorld2D(new Experimental.WorldDefinition2D(1));
 * const groundId = world.createBody(new Experimental.BodyDefinition2D());
 * world.createShape(groundId, new Experimental.ShapeDefinition2D(), Experimental.Polygon2D.makeBox(5, 0.5));
 * const ballDefinition = new Experimental.BodyDefinition2D();
 * ballDefinition.type = Experimental.BodyType2D.dynamic;
 * ballDefinition.position = Vector2.create(0, -1);
 * const ballId = world.createBody(ballDefinition);
 * world.createShape(ballId, new Experimental.ShapeDefinition2D(), Experimental.Circle2D.create(Vector2.zero(), 0.25));
 * let beginCount = 0;
 * for (let index = 0; index < 60; ++index) {
 * 	world.step(1 / 60, 4);
 * 	beginCount += world.getContactBeginEvents().length;
 * }
 * console.log(beginCount);
 */
export class ContactEvent2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { ShapeId2D } */ shapeIdA; // 첫 모양.
	/** @type { ShapeId2D } */ shapeIdB; // 둘째 모양.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { ShapeId2D } shapeIdA 첫 모양.
	 * @param { ShapeId2D } shapeIdB 둘째 모양.
	 */
	constructor(shapeIdA, shapeIdB) {
		super();
		this.shapeIdA = shapeIdA;
		this.shapeIdB = shapeIdB;
	}
}


//==============================================================================
// 센서 사건. (센서에 들어오거나 나간 모양)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
//==============================================================================
/**
 * @example <caption>센서 사건 만들기</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const sensorEvent = new Experimental.SensorEvent2D(new Experimental.ShapeId2D(0, 0), new Experimental.ShapeId2D(1, 0));
 * console.log(sensorEvent.sensorShapeId.getIndex(), sensorEvent.visitorShapeId.getIndex());
 */
export class SensorEvent2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { ShapeId2D } */ sensorShapeId; // 센서 모양.
	/** @type { ShapeId2D } */ visitorShapeId; // 들어오거나 나간 모양.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { ShapeId2D } sensorShapeId 센서 모양.
	 * @param { ShapeId2D } visitorShapeId 들어오거나 나간 모양.
	 */
	constructor(sensorShapeId, visitorShapeId) {
		super();
		this.sensorShapeId = sensorShapeId;
		this.visitorShapeId = visitorShapeId;
	}
}


//==============================================================================
// 광선 결과.
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
//==============================================================================
/**
 * @example <caption>광선 결과 만들기</caption>
 * import { Vector2 } from "./import.js";
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const rayResult = new Experimental.RayResult2D(new Experimental.ShapeId2D(0, 0), Vector2.create(1, 2), Vector2.create(0, -1), 0.5);
 * console.log(rayResult.point.x, rayResult.normal.y, rayResult.fraction);
 */
export class RayResult2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { ShapeId2D } */ shapeId; // 맞은 모양.
	/** @type { Vector2 } */ point; // 맞은 점. (월드)
	/** @type { Vector2 } */ normal; // 맞은 겉면의 바깥쪽 법선.
	/** @type { number } */ fraction; // 광선 위 몫. (0 이면 시작점, 1 이면 끝점)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { ShapeId2D } shapeId 맞은 모양.
	 * @param { Vector2 } point 맞은 점.
	 * @param { Vector2 } normal 법선.
	 * @param { number } fraction 광선 위 몫.
	 */
	constructor(shapeId, point, normal, fraction) {
		super();
		this.shapeId = shapeId;
		this.point = point;
		this.normal = normal;
		this.fraction = fraction;
	}
}


//==============================================================================
// 월드 상태. (안에서 쓴다)
//==============================================================================
class WorldState extends Object {
	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.lengthUnitsPerMeter = 1;
		this.gravityX = 0;
		this.gravityY = 0;
		this.enableSleep = true;
		this.contactHertz = 30;
		this.contactDampingRatio = 10;
		this.jointHertz = 60;
		this.jointDampingRatio = 2;
		this.restitutionThreshold = 1;
		this.maximumContactPushSpeed = 3;
		this.maximumLinearSpeed = 400;
		this.linearSlop = 0.005;
		this.speculativeDistance = 0.02;
		this.aabbMargin = 0.05;
		this.sleepThreshold = 0.05;
		this.bodyDataList = [];
		this.bodyList = [];
		this.bodyGenerationList = [];
		this.bodyFreeList = [];
		this.shapeDataList = [];
		this.shapeList = [];
		this.shapeGenerationList = [];
		this.shapeFreeList = [];
		this.jointDataList = [];
		this.jointList = [];
		this.jointGenerationList = [];
		this.jointFreeList = [];
		this.contactList = [];
		this.contactFreeList = [];
		this.contactTable = new System.Map();
		this.tree = new DynamicTree();
		this.moveBuffer = [];
		this.shapeMovedList = [];
		this.solverBodyList = [];
		this.solverBodyCount = 0;
		this.worldShapeA = new WorldShape();
		this.worldShapeB = new WorldShape();
		this.scratchManifold = new Manifold();
		this.contactBeginEventList = [];
		this.contactEndEventList = [];
		this.sensorBeginEventList = [];
		this.sensorEndEventList = [];
		this.fixedStepper = new FixedStepper(1 / 60, 5);
		this.subStepCount = 4;
		this.interpolationAlpha = 1;
		this.lastTimeStep = 0;
	}
}


//==============================================================================
// 2D 물리 월드.
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 강체(정적, 운동학, 동적), 모양(원, 캡슐, 선분, 볼록 다각형, 사슬), 관절(거리, 회전, 용접, 바퀴)을 들고 걸음을 돌린다.
//   기능은 Box2D 3(Erin Catto)와 유니티 2D 물리(Rigidbody2D, Collider2D)를 기준으로 했다.
// - 넓은 단계는 동적 AABB 나무(DynamicTree), 좁은 단계는 분리축과 변 자르기, 풀이기는 부드러운 걸음(하위 걸음, 웜 스타트, 부드러운 구속, 이완, 반발),
//   붙어 있는 몸끼리 섬으로 묶어 가만히 있으면 섬째 재운다.
// - 결정론: 셈은 모두 f64 이고 삼각 함수는 직접 짰다. 같은 차례로 만들고 같은 step 을 부르면 러스트 vanilla-engine 의 같은 월드와 결과가 비트까지 같다.
// - step(timeStep, subStepCount) 는 그 시간만큼 한 걸음, advance(timeDelta) 는 고정 걸음(FixedStepper)으로 쌓아 돌리고 그리기 보간 몫을 돌려준다.
// - 사건(닿음 시작과 끝, 센서 들어옴과 나감)은 step 마다 새로 모이고 다음 step 까지 읽을 수 있다.
// - 아직 없는 것: 연속 충돌(빠른 총알이 얇은 벽을 뚫지 않게 하는 TOI), 한쪽 면 사슬, 프리즘, 모터, 마우스 관절, 몸 종류 바꾸기, 여러 스레드.
//==============================================================================
/**
 * @example <caption>상자를 떨어뜨려 땅에 쌓기</caption>
 * import { Vector2 } from "./import.js";
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const world = new Experimental.PhysicsWorld2D(new Experimental.WorldDefinition2D(1));
 * const groundId = world.createBody(new Experimental.BodyDefinition2D());
 * world.createShape(groundId, new Experimental.ShapeDefinition2D(), Experimental.Segment2D.create(Vector2.create(-10, 0), Vector2.create(10, 0)));
 * const boxIdList = [];
 * for (let index = 0; index < 3; ++index) {
 * 	const bodyDefinition = new Experimental.BodyDefinition2D();
 * 	bodyDefinition.type = Experimental.BodyType2D.dynamic;
 * 	bodyDefinition.position = Vector2.create(0, -0.5 - index * 1.1);
 * 	const bodyId = world.createBody(bodyDefinition);
 * 	world.createShape(bodyId, new Experimental.ShapeDefinition2D(), Experimental.Polygon2D.makeBox(0.5, 0.5));
 * 	boxIdList.push(bodyId);
 * }
 * for (let index = 0; index < 180; ++index) {
 * 	world.step(1 / 60, 4);
 * }
 * const topBody = world.getBody(boxIdList[2]);
 * console.log(topBody.getPosition().y.toFixed(2), topBody.isAwake());
 */
export class PhysicsWorld2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WorldState } */ #state;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { WorldDefinition2D } worldDefinition 월드 정의. (없으면 기본값)
	 */
	constructor(worldDefinition = new WorldDefinition2D()) {
		super();
		const state = new WorldState();
		this.#state = state;
		const unitsPerMeter = worldDefinition.lengthUnitsPerMeter > 0 ? worldDefinition.lengthUnitsPerMeter : 1;
		state.lengthUnitsPerMeter = unitsPerMeter;
		state.gravityX = worldDefinition.gravity.x;
		state.gravityY = worldDefinition.gravity.y;
		state.enableSleep = worldDefinition.enableSleep;
		state.contactHertz = System.Math.max(0, worldDefinition.contactHertz);
		state.contactDampingRatio = System.Math.max(0, worldDefinition.contactDampingRatio);
		state.jointHertz = System.Math.max(0, worldDefinition.jointHertz);
		state.jointDampingRatio = System.Math.max(0, worldDefinition.jointDampingRatio);
		state.restitutionThreshold = System.Math.max(0, worldDefinition.restitutionThreshold);
		state.maximumContactPushSpeed = System.Math.max(0, worldDefinition.maximumContactPushSpeed);
		state.maximumLinearSpeed = System.Math.max(0, worldDefinition.maximumLinearSpeed);
		state.linearSlop = 0.005 * unitsPerMeter;
		state.speculativeDistance = 4 * state.linearSlop;
		state.aabbMargin = 0.05 * unitsPerMeter;
		state.sleepThreshold = 0.05 * unitsPerMeter;
	}

	//==============================================================================
	// 월드 상태 반환. (안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @returns { WorldState }
	 */
	getState() {
		return this.#state;
	}

	//==============================================================================
	// 1 미터의 길이 단위 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 1 미터의 길이 단위 수.
	 */
	getLengthUnitsPerMeter() {
		const state = this.getState();
		return state.lengthUnitsPerMeter;
	}

	//==============================================================================
	// 중력 설정. (잠든 몸은 깨우지 않는다)
	//==============================================================================
	/**
	 * @param { Vector2 } gravity 중력 가속도.
	 */
	setGravity(gravity) {
		const state = this.getState();
		state.gravityX = gravity.x;
		state.gravityY = gravity.y;
	}

	//==============================================================================
	// 중력 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 중력 가속도.
	 */
	getGravity() {
		const state = this.getState();
		return Vector2.create(state.gravityX, state.gravityY);
	}

	//==============================================================================
	// 잠자기를 쓸지 설정. (끄면 모든 몸을 깨운다)
	//==============================================================================
	/**
	 * @param { boolean } enableSleep 잠자기를 쓸지.
	 */
	setSleepEnabled(enableSleep) {
		const state = this.getState();
		state.enableSleep = enableSleep;
		if (!enableSleep) {
			for (const bodyData of state.bodyDataList) {
				if (bodyData !== null && bodyData.type !== BodyType2D.static) {
					bodyData.isAwake = true;
					bodyData.sleepTime = 0;
				}
			}
		}
	}

	//==============================================================================
	// 잠자기를 쓰는지.
	//==============================================================================
	/**
	 * @returns { boolean } 잠자기를 쓰면 참.
	 */
	isSleepEnabled() {
		const state = this.getState();
		return state.enableSleep;
	}

	//==============================================================================
	// 넓은 단계 나무 반환. (살펴보기용, 바꾸지 않는다)
	//==============================================================================
	/**
	 * @returns { DynamicTree } 모양의 뚱뚱한 상자를 든 나무.
	 */
	getBroadPhaseTree() {
		const state = this.getState();
		return state.tree;
	}

	//==============================================================================
	// 몸 만들기.
	//==============================================================================
	/**
	 * @param { BodyDefinition2D } bodyDefinition 몸 정의.
	 * @returns { BodyId2D } 새 몸의 아이디.
	 */
	createBody(bodyDefinition) {
		const state = this.getState();
		let index = state.bodyDataList.length;
		if (state.bodyFreeList.length > 0) {
			index = state.bodyFreeList.pop();
		}
		else {
			state.bodyDataList.push(null);
			state.bodyList.push(null);
			state.bodyGenerationList.push(0);
		}
		const generation = state.bodyGenerationList[index];
		const data = new BodyData();
		data.id = new BodyId2D(index, generation);
		data.type = bodyDefinition.type;
		const rotation = PhysicsMath2D.computeRotation(bodyDefinition.angle);
		data.positionX = bodyDefinition.position.x;
		data.positionY = bodyDefinition.position.y;
		data.rotationCosine = rotation.cosine;
		data.rotationSine = rotation.sine;
		data.previousPositionX = data.positionX;
		data.previousPositionY = data.positionY;
		data.previousRotationCosine = data.rotationCosine;
		data.previousRotationSine = data.rotationSine;
		updateBodyCenter(data);
		if (data.type !== BodyType2D.static) {
			data.linearVelocityX = bodyDefinition.linearVelocity.x;
			data.linearVelocityY = bodyDefinition.linearVelocity.y;
			data.angularVelocity = bodyDefinition.isFixedRotation ? 0 : bodyDefinition.angularVelocity;
		}
		data.linearDamping = System.Math.max(0, bodyDefinition.linearDamping);
		data.angularDamping = System.Math.max(0, bodyDefinition.angularDamping);
		data.gravityScale = bodyDefinition.gravityScale;
		data.enableSleep = bodyDefinition.enableSleep;
		data.isAwake = data.type !== BodyType2D.static && bodyDefinition.isAwake;
		data.isFixedRotation = bodyDefinition.isFixedRotation;
		data.userData = bodyDefinition.userData;
		state.bodyDataList[index] = data;
		state.bodyList[index] = new Body2D(data);
		this.updateBodyMass(index);
		return data.id;
	}

	//==============================================================================
	// 몸 없애기. (붙은 관절과 모양도 없앤다)
	//==============================================================================
	/**
	 * @param { BodyId2D } bodyId 없앨 몸.
	 */
	destroyBody(bodyId) {
		const state = this.getState();
		const index = this.resolveBodyIndex(bodyId);
		if (index < 0) {
			return;
		}
		const data = state.bodyDataList[index];
		for (let jointIndex = 0; jointIndex < state.jointDataList.length; ++jointIndex) {
			const jointData = state.jointDataList[jointIndex];
			if (jointData !== null && (jointData.bodyIndexA === index || jointData.bodyIndexB === index)) {
				this.destroyJoint(jointData.id);
			}
		}
		const shapeIdList = data.shapeIdList.slice();
		for (const shapeId of shapeIdList) {
			this.destroyShapeInternal(shapeId, false);
		}
		state.bodyDataList[index] = null;
		state.bodyList[index] = null;
		state.bodyGenerationList[index] += 1;
		state.bodyFreeList.push(index);
	}

	//==============================================================================
	// 몸 아이디의 칸 번호. (없거나 세대가 다르면 -1, 안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @param { BodyId2D } bodyId
	 * @returns { number }
	 */
	resolveBodyIndex(bodyId) {
		const state = this.getState();
		if (!(bodyId instanceof BodyId2D)) {
			return -1;
		}
		const index = bodyId.getIndex();
		const generation = bodyId.getGeneration();
		if (index < 0 || index >= state.bodyDataList.length || state.bodyDataList[index] === null || state.bodyGenerationList[index] !== generation) {
			return -1;
		}
		return index;
	}

	//==============================================================================
	// 몸 반환.
	//==============================================================================
	/**
	 * @param { BodyId2D } bodyId 몸 아이디.
	 * @returns { Body2D | null } 몸. (없으면 null)
	 */
	getBody(bodyId) {
		const state = this.getState();
		const index = this.resolveBodyIndex(bodyId);
		if (index < 0) {
			return null;
		}
		return state.bodyList[index];
	}

	//==============================================================================
	// 살아 있는 몸 아이디 목록. (칸 차례)
	//==============================================================================
	/**
	 * @returns { BodyId2D[] } 몸 아이디 목록.
	 */
	getBodyIds() {
		const state = this.getState();
		const bodyIdList = [];
		for (const data of state.bodyDataList) {
			if (data !== null) {
				bodyIdList.push(data.id);
			}
		}
		return bodyIdList;
	}

	//==============================================================================
	// 몸의 질량, 질량 중심, 회전 관성 다시 셈. (안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @param { number } bodyIndex
	 */
	updateBodyMass(bodyIndex) {
		const state = this.getState();
		const data = state.bodyDataList[bodyIndex];
		data.isMassDirty = false;
		data.mass = 0;
		data.inverseMass = 0;
		data.rotationalInertia = 0;
		data.inverseInertia = 0;
		data.maximumExtent = 0;
		const oldCenterX = data.centerX;
		const oldCenterY = data.centerY;
		data.localCenterX = 0;
		data.localCenterY = 0;
		if (data.type !== BodyType2D.dynamic) {
			updateBodyCenter(data);
			for (const shapeId of data.shapeIdList) {
				const shapeData = state.shapeDataList[shapeId.getIndex()];
				data.maximumExtent = System.Math.max(data.maximumExtent, computeShapeExtent(shapeData, 0, 0));
			}
			return;
		}
		let mass = 0;
		let localCenterX = 0;
		let localCenterY = 0;
		let rotationalInertia = 0;
		for (const shapeId of data.shapeIdList) {
			const shapeData = state.shapeDataList[shapeId.getIndex()];
			if (shapeData.density === 0) {
				continue;
			}
			const massData = computeShapeMass(shapeData);
			mass += massData[0];
			localCenterX += massData[0] * massData[1];
			localCenterY += massData[0] * massData[2];
			rotationalInertia += massData[3] + massData[0] * (massData[1] * massData[1] + massData[2] * massData[2]);
		}
		if (mass > 0) {
			data.mass = mass;
			data.inverseMass = 1 / mass;
			localCenterX = localCenterX * data.inverseMass;
			localCenterY = localCenterY * data.inverseMass;
		}
		else {
			// 질량이 없는 동적 몸은 1 로 둔다. (떨어지기는 하되 돌지 않는다)
			data.mass = 1;
			data.inverseMass = 1;
			rotationalInertia = 0;
		}
		if (rotationalInertia > 0 && !data.isFixedRotation) {
			data.rotationalInertia = rotationalInertia - data.mass * (localCenterX * localCenterX + localCenterY * localCenterY);
			data.inverseInertia = data.rotationalInertia > 0 ? 1 / data.rotationalInertia : 0;
		}
		data.localCenterX = localCenterX;
		data.localCenterY = localCenterY;
		updateBodyCenter(data);
		// 질량 중심이 옮겨졌으면 원점의 속도가 그대로이게 질량 중심 속도를 고친다.
		data.linearVelocityX += -data.angularVelocity * (data.centerY - oldCenterY);
		data.linearVelocityY += data.angularVelocity * (data.centerX - oldCenterX);
		for (const shapeId of data.shapeIdList) {
			const shapeData = state.shapeDataList[shapeId.getIndex()];
			data.maximumExtent = System.Math.max(data.maximumExtent, computeShapeExtent(shapeData, localCenterX, localCenterY));
		}
	}

	//==============================================================================
	// 모양 만들기.
	//==============================================================================
	/**
	 * @param { BodyId2D } bodyId 붙일 몸.
	 * @param { ShapeDefinition2D } shapeDefinition 모양 정의.
	 * @param { Circle2D | Capsule2D | Segment2D | Polygon2D } geometry 모양. (몸 기준)
	 * @returns { ShapeId2D | null } 새 모양 아이디. (몸이 없거나 모양이 잘못되면 null)
	 */
	createShape(bodyId, shapeDefinition, geometry) {
		const state = this.getState();
		const bodyIndex = this.resolveBodyIndex(bodyId);
		if (bodyIndex < 0) {
			return null;
		}
		const data = new ShapeData();
		const isValid = setShapeGeometry(data, geometry);
		if (!isValid) {
			return null;
		}
		let index = state.shapeDataList.length;
		if (state.shapeFreeList.length > 0) {
			index = state.shapeFreeList.pop();
		}
		else {
			state.shapeDataList.push(null);
			state.shapeList.push(null);
			state.shapeGenerationList.push(0);
			state.shapeMovedList.push(false);
		}
		const generation = state.shapeGenerationList[index];
		const bodyData = state.bodyDataList[bodyIndex];
		data.id = new ShapeId2D(index, generation);
		data.bodyIndex = bodyIndex;
		data.density = System.Math.max(0, shapeDefinition.density);
		data.friction = System.Math.max(0, shapeDefinition.friction);
		data.restitution = System.Math.max(0, shapeDefinition.restitution);
		data.categoryBits = shapeDefinition.filter.categoryBits >>> 0;
		data.maskBits = shapeDefinition.filter.maskBits >>> 0;
		data.groupIndex = shapeDefinition.filter.groupIndex;
		data.isSensor = shapeDefinition.isSensor;
		data.enableSensorEvents = shapeDefinition.enableSensorEvents;
		data.enableContactEvents = shapeDefinition.enableContactEvents;
		data.userData = shapeDefinition.userData;
		state.shapeDataList[index] = data;
		state.shapeList[index] = new Shape2D(data, bodyData.id);
		bodyData.shapeIdList.push(data.id);

		computeShapeAabb(data, bodyData.positionX, bodyData.positionY, bodyData.rotationCosine, bodyData.rotationSine, data.aabb);
		const margin = bodyData.type === BodyType2D.static ? 0 : state.aabbMargin;
		data.fatAabb.set(data.aabb.minX - margin, data.aabb.minY - margin, data.aabb.maxX + margin, data.aabb.maxY + margin);
		data.proxyId = state.tree.createProxy(data.fatAabb, 0xffffffff, index);
		state.shapeMovedList[index] = false;
		this.pushMovedShape(index);
		this.updateBodyMass(bodyIndex);
		return data.id;
	}

	//==============================================================================
	// 사슬 만들기. (이은 선분 모양들, 선분마다 모양 아이디)
	//==============================================================================
	/**
	 * @param { BodyId2D } bodyId 붙일 몸.
	 * @param { ChainDefinition2D } chainDefinition 사슬 정의.
	 * @returns { ShapeId2D[] } 선분 모양 아이디 목록. (몸이 없거나 점이 2 개보다 적으면 빈 목록)
	 */
	createChain(bodyId, chainDefinition) {
		const shapeIdList = [];
		const pointCount = chainDefinition.points.length;
		if (pointCount < 2) {
			return shapeIdList;
		}
		const shapeDefinition = new ShapeDefinition2D();
		shapeDefinition.density = 0;
		shapeDefinition.friction = chainDefinition.friction;
		shapeDefinition.restitution = chainDefinition.restitution;
		shapeDefinition.filter = chainDefinition.filter.clone();
		shapeDefinition.userData = chainDefinition.userData;
		const segmentCount = chainDefinition.isLoop && pointCount > 2 ? pointCount : pointCount - 1;
		for (let index = 0; index < segmentCount; ++index) {
			const point1 = chainDefinition.points[index];
			const point2 = chainDefinition.points[(index + 1) % pointCount];
			const segment = Segment2D.create(point1, point2);
			const shapeId = this.createShape(bodyId, shapeDefinition, segment);
			if (shapeId !== null) {
				shapeIdList.push(shapeId);
			}
		}
		return shapeIdList;
	}

	//==============================================================================
	// 모양 없애기. (닿음을 지우고 몸의 질량을 다시 셈한다)
	//==============================================================================
	/**
	 * @param { ShapeId2D } shapeId 없앨 모양.
	 */
	destroyShape(shapeId) {
		this.destroyShapeInternal(shapeId, true);
	}

	//==============================================================================
	// 모양 없애기. (updateMass 가 거짓이면 질량을 다시 셈하지 않는다, 안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @param { ShapeId2D } shapeId
	 * @param { boolean } updateMass
	 */
	destroyShapeInternal(shapeId, updateMass) {
		const state = this.getState();
		const index = this.resolveShapeIndex(shapeId);
		if (index < 0) {
			return;
		}
		const data = state.shapeDataList[index];
		for (let contactIndex = 0; contactIndex < state.contactList.length; ++contactIndex) {
			const contact = state.contactList[contactIndex];
			if (contact.isAlive && (contact.shapeIndexA === index || contact.shapeIndexB === index)) {
				this.wakeBodyIndex(contact.bodyIndexA);
				this.wakeBodyIndex(contact.bodyIndexB);
				this.destroyContact(contactIndex);
			}
		}
		state.tree.destroyProxy(data.proxyId);
		const bodyData = state.bodyDataList[data.bodyIndex];
		const listIndex = bodyData.shapeIdList.indexOf(data.id);
		if (listIndex >= 0) {
			bodyData.shapeIdList.splice(listIndex, 1);
		}
		state.shapeDataList[index] = null;
		state.shapeList[index] = null;
		state.shapeGenerationList[index] += 1;
		state.shapeMovedList[index] = false;
		state.shapeFreeList.push(index);
		if (updateMass) {
			this.updateBodyMass(data.bodyIndex);
		}
	}

	//==============================================================================
	// 모양 아이디의 칸 번호. (없거나 세대가 다르면 -1, 안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @param { ShapeId2D } shapeId
	 * @returns { number }
	 */
	resolveShapeIndex(shapeId) {
		const state = this.getState();
		if (!(shapeId instanceof ShapeId2D)) {
			return -1;
		}
		const index = shapeId.getIndex();
		const generation = shapeId.getGeneration();
		if (index < 0 || index >= state.shapeDataList.length || state.shapeDataList[index] === null || state.shapeGenerationList[index] !== generation) {
			return -1;
		}
		return index;
	}

	//==============================================================================
	// 모양 반환.
	//==============================================================================
	/**
	 * @param { ShapeId2D } shapeId 모양 아이디.
	 * @returns { Shape2D | null } 모양. (없으면 null)
	 */
	getShape(shapeId) {
		const state = this.getState();
		const index = this.resolveShapeIndex(shapeId);
		if (index < 0) {
			return null;
		}
		return state.shapeList[index];
	}

	//==============================================================================
	// 옮겨진 모양을 짝 찾기 목록에 넣기. (안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @param { number } shapeIndex
	 */
	pushMovedShape(shapeIndex) {
		const state = this.getState();
		if (state.shapeMovedList[shapeIndex]) {
			return;
		}
		state.shapeMovedList[shapeIndex] = true;
		state.moveBuffer.push(shapeIndex);
	}

	//==============================================================================
	// 몸 깨우기. (칸 번호, 안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @param { number } bodyIndex
	 */
	wakeBodyIndex(bodyIndex) {
		const state = this.getState();
		const data = state.bodyDataList[bodyIndex];
		if (data === null || data.type === BodyType2D.static) {
			return;
		}
		data.isAwake = true;
		data.sleepTime = 0;
	}

	//==============================================================================
	// 관절 만들기. (공통, 안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @param { number } type
	 * @param { object } definition
	 * @returns { JointData | null }
	 */
	createJointInternal(type, definition) {
		const state = this.getState();
		const bodyIndexA = this.resolveBodyIndex(definition.bodyIdA);
		const bodyIndexB = this.resolveBodyIndex(definition.bodyIdB);
		if (bodyIndexA < 0 || bodyIndexB < 0 || bodyIndexA === bodyIndexB) {
			return null;
		}
		let index = state.jointDataList.length;
		if (state.jointFreeList.length > 0) {
			index = state.jointFreeList.pop();
		}
		else {
			state.jointDataList.push(null);
			state.jointList.push(null);
			state.jointGenerationList.push(0);
		}
		const generation = state.jointGenerationList[index];
		const data = new JointData();
		data.id = new JointId2D(index, generation);
		data.type = type;
		data.bodyIndexA = bodyIndexA;
		data.bodyIndexB = bodyIndexB;
		data.bodyIdA = state.bodyDataList[bodyIndexA].id;
		data.bodyIdB = state.bodyDataList[bodyIndexB].id;
		data.localAnchorAX = definition.localAnchorA.x;
		data.localAnchorAY = definition.localAnchorA.y;
		data.localAnchorBX = definition.localAnchorB.x;
		data.localAnchorBY = definition.localAnchorB.y;
		data.collideConnected = definition.collideConnected;
		data.userData = definition.userData;
		state.jointDataList[index] = data;
		state.jointList[index] = new Joint2D(data);

		// 서로 부딪히지 않는 관절이면 이미 있는 두 몸 사이 닿음을 지운다.
		if (!data.collideConnected) {
			for (let contactIndex = 0; contactIndex < state.contactList.length; ++contactIndex) {
				const contact = state.contactList[contactIndex];
				if (!contact.isAlive) {
					continue;
				}
				const isPair = (contact.bodyIndexA === bodyIndexA && contact.bodyIndexB === bodyIndexB) || (contact.bodyIndexA === bodyIndexB && contact.bodyIndexB === bodyIndexA);
				if (isPair) {
					this.destroyContact(contactIndex);
				}
			}
		}
		this.wakeBodyIndex(bodyIndexA);
		this.wakeBodyIndex(bodyIndexB);
		return data;
	}

	//==============================================================================
	// 거리 관절 만들기.
	//==============================================================================
	/**
	 * @param { DistanceJointDefinition2D } definition 거리 관절 정의.
	 * @returns { JointId2D | null } 새 관절 아이디. (몸이 없으면 null)
	 */
	createDistanceJoint(definition) {
		const data = this.createJointInternal(JointType2D.distance, definition);
		if (data === null) {
			return null;
		}
		const state = this.getState();
		data.length = System.Math.max(state.linearSlop, definition.length);
		data.minLength = System.Math.max(0, System.Math.min(definition.minLength, definition.maxLength));
		data.maxLength = System.Math.max(definition.minLength, definition.maxLength);
		data.enableSpring = definition.enableSpring;
		data.hertz = System.Math.max(0, definition.hertz);
		data.dampingRatio = System.Math.max(0, definition.dampingRatio);
		data.enableLimit = definition.enableLimit;
		return data.id;
	}

	//==============================================================================
	// 회전 관절 만들기.
	//==============================================================================
	/**
	 * @param { RevoluteJointDefinition2D } definition 회전 관절 정의.
	 * @returns { JointId2D | null } 새 관절 아이디. (몸이 없으면 null)
	 */
	createRevoluteJoint(definition) {
		const data = this.createJointInternal(JointType2D.revolute, definition);
		if (data === null) {
			return null;
		}
		data.referenceAngle = PhysicsMath2D.unwindAngle(definition.referenceAngle);
		data.enableSpring = definition.enableSpring;
		data.hertz = System.Math.max(0, definition.hertz);
		data.dampingRatio = System.Math.max(0, definition.dampingRatio);
		data.enableMotor = definition.enableMotor;
		data.maxMotorTorque = System.Math.max(0, definition.maxMotorTorque);
		data.motorSpeed = definition.motorSpeed;
		data.enableLimit = definition.enableLimit;
		data.lowerLimit = System.Math.min(definition.lowerAngle, definition.upperAngle);
		data.upperLimit = System.Math.max(definition.lowerAngle, definition.upperAngle);
		return data.id;
	}

	//==============================================================================
	// 용접 관절 만들기.
	//==============================================================================
	/**
	 * @param { WeldJointDefinition2D } definition 용접 관절 정의.
	 * @returns { JointId2D | null } 새 관절 아이디. (몸이 없으면 null)
	 */
	createWeldJoint(definition) {
		const data = this.createJointInternal(JointType2D.weld, definition);
		if (data === null) {
			return null;
		}
		data.referenceAngle = PhysicsMath2D.unwindAngle(definition.referenceAngle);
		data.linearHertz = System.Math.max(0, definition.linearHertz);
		data.linearDampingRatio = System.Math.max(0, definition.linearDampingRatio);
		data.angularHertz = System.Math.max(0, definition.angularHertz);
		data.angularDampingRatio = System.Math.max(0, definition.angularDampingRatio);
		return data.id;
	}

	//==============================================================================
	// 바퀴 관절 만들기.
	//==============================================================================
	/**
	 * @param { WheelJointDefinition2D } definition 바퀴 관절 정의.
	 * @returns { JointId2D | null } 새 관절 아이디. (몸이 없거나 축 길이가 0 이면 null)
	 */
	createWheelJoint(definition) {
		const axisLength = System.Math.sqrt(definition.localAxisA.x * definition.localAxisA.x + definition.localAxisA.y * definition.localAxisA.y);
		if (!(axisLength > 0)) {
			return null;
		}
		const data = this.createJointInternal(JointType2D.wheel, definition);
		if (data === null) {
			return null;
		}
		data.localAxisAX = definition.localAxisA.x / axisLength;
		data.localAxisAY = definition.localAxisA.y / axisLength;
		data.enableSpring = definition.enableSpring;
		data.hertz = System.Math.max(0, definition.hertz);
		data.dampingRatio = System.Math.max(0, definition.dampingRatio);
		data.enableMotor = definition.enableMotor;
		data.maxMotorTorque = System.Math.max(0, definition.maxMotorTorque);
		data.motorSpeed = definition.motorSpeed;
		data.enableLimit = definition.enableLimit;
		data.lowerLimit = System.Math.min(definition.lowerTranslation, definition.upperTranslation);
		data.upperLimit = System.Math.max(definition.lowerTranslation, definition.upperTranslation);
		return data.id;
	}

	//==============================================================================
	// 관절 없애기. (두 몸을 깨우고, 서로 부딪히지 않던 관절이면 다시 짝을 찾는다)
	//==============================================================================
	/**
	 * @param { JointId2D } jointId 없앨 관절.
	 */
	destroyJoint(jointId) {
		const state = this.getState();
		const index = this.resolveJointIndex(jointId);
		if (index < 0) {
			return;
		}
		const data = state.jointDataList[index];
		this.wakeBodyIndex(data.bodyIndexA);
		this.wakeBodyIndex(data.bodyIndexB);
		if (!data.collideConnected) {
			const bodyIndexList = [data.bodyIndexA, data.bodyIndexB];
			for (const bodyIndex of bodyIndexList) {
				const bodyData = state.bodyDataList[bodyIndex];
				for (const shapeId of bodyData.shapeIdList) {
					this.pushMovedShape(shapeId.getIndex());
				}
			}
		}
		state.jointDataList[index] = null;
		state.jointList[index] = null;
		state.jointGenerationList[index] += 1;
		state.jointFreeList.push(index);
	}

	//==============================================================================
	// 관절 아이디의 칸 번호. (없거나 세대가 다르면 -1, 안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @param { JointId2D } jointId
	 * @returns { number }
	 */
	resolveJointIndex(jointId) {
		const state = this.getState();
		if (!(jointId instanceof JointId2D)) {
			return -1;
		}
		const index = jointId.getIndex();
		const generation = jointId.getGeneration();
		if (index < 0 || index >= state.jointDataList.length || state.jointDataList[index] === null || state.jointGenerationList[index] !== generation) {
			return -1;
		}
		return index;
	}

	//==============================================================================
	// 관절 반환.
	//==============================================================================
	/**
	 * @param { JointId2D } jointId 관절 아이디.
	 * @returns { Joint2D | null } 관절. (없으면 null)
	 */
	getJoint(jointId) {
		const state = this.getState();
		const index = this.resolveJointIndex(jointId);
		if (index < 0) {
			return null;
		}
		return state.jointList[index];
	}

	//==============================================================================
	// 살아 있는 관절 아이디 목록. (칸 차례)
	//==============================================================================
	/**
	 * @returns { JointId2D[] } 관절 아이디 목록.
	 */
	getJointIds() {
		const state = this.getState();
		const jointIdList = [];
		for (const data of state.jointDataList) {
			if (data !== null) {
				jointIdList.push(data.id);
			}
		}
		return jointIdList;
	}

	//==============================================================================
	// 몸 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 살아 있는 몸 수.
	 */
	getBodyCount() {
		const state = this.getState();
		return state.bodyDataList.length - state.bodyFreeList.length;
	}

	//==============================================================================
	// 깨어 있는 몸 수 반환. (정적 몸 빼고)
	//==============================================================================
	/**
	 * @returns { number } 깨어 있는 몸 수.
	 */
	getAwakeBodyCount() {
		const state = this.getState();
		let count = 0;
		for (const data of state.bodyDataList) {
			if (data !== null && data.type !== BodyType2D.static && data.isAwake) {
				count += 1;
			}
		}
		return count;
	}

	//==============================================================================
	// 모양 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 살아 있는 모양 수.
	 */
	getShapeCount() {
		const state = this.getState();
		return state.shapeDataList.length - state.shapeFreeList.length;
	}

	//==============================================================================
	// 관절 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 살아 있는 관절 수.
	 */
	getJointCount() {
		const state = this.getState();
		return state.jointDataList.length - state.jointFreeList.length;
	}

	//==============================================================================
	// 닿음 수 반환. (뚱뚱한 상자가 겹친 짝, 닿지 않은 것과 센서 포함)
	//==============================================================================
	/**
	 * @returns { number } 닿음 수.
	 */
	getContactCount() {
		const state = this.getState();
		return state.contactList.length - state.contactFreeList.length;
	}

	//==============================================================================
	// 지난 걸음의 닿기 시작 사건 목록. (다음 step 까지 쓴다)
	//==============================================================================
	/**
	 * @returns { ContactEvent2D[] } 닿기 시작 사건.
	 */
	getContactBeginEvents() {
		const state = this.getState();
		return state.contactBeginEventList;
	}

	//==============================================================================
	// 지난 걸음의 닿기 끝 사건 목록. (모양을 없애 끝난 것 포함)
	//==============================================================================
	/**
	 * @returns { ContactEvent2D[] } 닿기 끝 사건.
	 */
	getContactEndEvents() {
		const state = this.getState();
		return state.contactEndEventList;
	}

	//==============================================================================
	// 지난 걸음의 센서 들어옴 사건 목록. (다음 step 까지 쓴다)
	//==============================================================================
	/**
	 * @returns { SensorEvent2D[] } 센서 들어옴 사건.
	 */
	getSensorBeginEvents() {
		const state = this.getState();
		return state.sensorBeginEventList;
	}

	//==============================================================================
	// 지난 걸음의 센서 나감 사건 목록. (센서나 모양을 없애 나간 것 포함)
	//==============================================================================
	/**
	 * @returns { SensorEvent2D[] } 센서 나감 사건.
	 */
	getSensorEndEvents() {
		const state = this.getState();
		return state.sensorEndEventList;
	}

	//==============================================================================
	// 고정 걸음 시간 설정. (advance 가 쓴다, 기본 1 / 60)
	//==============================================================================
	/**
	 * @param { number } stepSeconds 한 걸음의 시간. (초)
	 */
	setFixedStepSeconds(stepSeconds) {
		const state = this.getState();
		state.fixedStepper.setStepSeconds(stepSeconds);
	}

	//==============================================================================
	// 고정 걸음 시간 반환.
	//==============================================================================
	/**
	 * @returns { number } 한 걸음의 시간. (초)
	 */
	getFixedStepSeconds() {
		const state = this.getState();
		return state.fixedStepper.getStepSeconds();
	}

	//==============================================================================
	// 하위 걸음 수 설정. (advance 가 쓴다, 기본 4, 1 이상)
	//==============================================================================
	/**
	 * @param { number } subStepCount 한 걸음의 하위 걸음 수.
	 */
	setSubStepCount(subStepCount) {
		const state = this.getState();
		state.subStepCount = System.Math.max(1, System.Math.floor(subStepCount));
	}

	//==============================================================================
	// 하위 걸음 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 한 걸음의 하위 걸음 수.
	 */
	getSubStepCount() {
		const state = this.getState();
		return state.subStepCount;
	}

	//==============================================================================
	// 프레임 시간만큼 고정 걸음으로 나아가기. (그리기 보간 몫을 돌려준다)
	//==============================================================================
	/**
	 * @param { number } timeDelta 이번 프레임의 시간. (초)
	 * @returns { number } 앞 걸음과 지금 걸음 사이 몫. (0 ~ 1, Body2D.getInterpolatedPosition 에 준다)
	 */
	advance(timeDelta) {
		const state = this.getState();
		const subStepCount = state.subStepCount;
		state.interpolationAlpha = state.fixedStepper.advance(timeDelta, (stepSeconds) => {
			this.step(stepSeconds, subStepCount);
		});
		return state.interpolationAlpha;
	}

	//==============================================================================
	// 지난 advance 의 보간 몫 반환.
	//==============================================================================
	/**
	 * @returns { number } 보간 몫. (0 ~ 1)
	 */
	getInterpolationAlpha() {
		const state = this.getState();
		return state.interpolationAlpha;
	}

	//==============================================================================
	// 한 걸음. (짝 찾기, 닿음점, 섬과 깨우기, 풀이, 잠자기)
	//==============================================================================
	/**
	 * @param { number } timeStep 걸음 시간. (초, 0 이면 닿음만 고친다)
	 * @param { number } subStepCount 하위 걸음 수. (1 이상, 보통 4)
	 */
	step(timeStep, subStepCount) {
		const state = this.getState();
		state.contactBeginEventList = [];
		state.contactEndEventList = [];
		state.sensorBeginEventList = [];
		state.sensorEndEventList = [];
		for (const data of state.bodyDataList) {
			if (data === null) {
				continue;
			}
			data.previousPositionX = data.positionX;
			data.previousPositionY = data.positionY;
			data.previousRotationCosine = data.rotationCosine;
			data.previousRotationSine = data.rotationSine;
		}
		this.applyPendingChanges();
		this.updatePairs();
		this.collide();
		if (!(timeStep > 0)) {
			return;
		}
		state.lastTimeStep = timeStep;
		const stepCount = System.Math.max(1, System.Math.floor(subStepCount));
		const context = new StepContext();
		context.timeStep = timeStep;
		context.inverseTimeStep = 1 / timeStep;
		context.subStepTime = timeStep / stepCount;
		context.inverseSubStepTime = stepCount * context.inverseTimeStep;
		const contactHertz = System.Math.min(state.contactHertz, 0.25 * context.inverseSubStepTime);
		const jointHertz = System.Math.min(state.jointHertz, 0.125 * context.inverseSubStepTime);
		context.contactSoftness = makeSoftness(contactHertz, state.contactDampingRatio, context.subStepTime);
		context.staticSoftness = makeSoftness(2 * contactHertz, state.contactDampingRatio, context.subStepTime);
		context.jointSoftness = makeSoftness(jointHertz, state.jointDampingRatio, context.subStepTime);
		context.restitutionThreshold = state.restitutionThreshold;
		context.maximumBiasVelocity = state.maximumContactPushSpeed;
		context.maximumLinearSpeed = state.maximumLinearSpeed;
		context.maximumAngularSpeed = MAXIMUM_ROTATION * context.inverseSubStepTime;
		context.gravityX = state.gravityX;
		context.gravityY = state.gravityY;
		context.contactHertz = contactHertz;
		context.jointDampingRatio = state.jointDampingRatio;
		this.solve(context, stepCount);
	}

	//==============================================================================
	// 걸음 사이에 바뀐 것 반영. (질량, 관절 깨우기, 거르기, 순간 이동, 안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 */
	applyPendingChanges() {
		const state = this.getState();
		for (let bodyIndex = 0; bodyIndex < state.bodyDataList.length; ++bodyIndex) {
			const data = state.bodyDataList[bodyIndex];
			if (data !== null && data.isMassDirty) {
				this.updateBodyMass(bodyIndex);
			}
		}
		for (const jointData of state.jointDataList) {
			if (jointData !== null && jointData.isWakeRequested) {
				jointData.isWakeRequested = false;
				this.wakeBodyIndex(jointData.bodyIndexA);
				this.wakeBodyIndex(jointData.bodyIndexB);
			}
		}
		for (let shapeIndex = 0; shapeIndex < state.shapeDataList.length; ++shapeIndex) {
			const shapeData = state.shapeDataList[shapeIndex];
			if (shapeData === null || !shapeData.isFilterDirty) {
				continue;
			}
			shapeData.isFilterDirty = false;
			for (let contactIndex = 0; contactIndex < state.contactList.length; ++contactIndex) {
				const contact = state.contactList[contactIndex];
				if (contact.isAlive && (contact.shapeIndexA === shapeIndex || contact.shapeIndexB === shapeIndex)) {
					const shouldCollide = this.shouldShapesCollide(contact.shapeIndexA, contact.shapeIndexB);
					if (!shouldCollide) {
						this.destroyContact(contactIndex);
					}
				}
			}
			this.pushMovedShape(shapeIndex);
		}
		this.synchronizeTransformChanges();
	}

	//==============================================================================
	// 순간 이동한 몸의 모양 상자와 나무 고치기. (안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 */
	synchronizeTransformChanges() {
		const state = this.getState();
		for (const data of state.bodyDataList) {
			if (data === null || !data.isTransformDirty) {
				continue;
			}
			data.isTransformDirty = false;
			for (const shapeId of data.shapeIdList) {
				this.synchronizeShape(shapeId.getIndex(), true);
			}
		}
	}

	//==============================================================================
	// 모양의 상자를 몸 자리로 고치고, 뚱뚱한 상자를 벗어났으면 나무에서 옮기기. (안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @param { number } shapeIndex
	 * @param { boolean } isForced 벗어나지 않아도 다시 넣을지.
	 */
	synchronizeShape(shapeIndex, isForced) {
		const state = this.getState();
		const shapeData = state.shapeDataList[shapeIndex];
		const bodyData = state.bodyDataList[shapeData.bodyIndex];
		computeShapeAabb(shapeData, bodyData.positionX, bodyData.positionY, bodyData.rotationCosine, bodyData.rotationSine, shapeData.aabb);
		const isContained = shapeData.fatAabb.contains(shapeData.aabb);
		if (isContained && !isForced) {
			return;
		}
		const margin = bodyData.type === BodyType2D.static ? 0 : state.aabbMargin;
		const aabb = shapeData.aabb;
		shapeData.fatAabb.set(aabb.minX - margin, aabb.minY - margin, aabb.maxX + margin, aabb.maxY + margin);
		state.tree.moveProxy(shapeData.proxyId, shapeData.fatAabb);
		this.pushMovedShape(shapeIndex);
	}

	//==============================================================================
	// 두 모양이 닿음을 가질 수 있는지. (안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @param { number } shapeIndexA
	 * @param { number } shapeIndexB
	 * @returns { boolean }
	 */
	shouldShapesCollide(shapeIndexA, shapeIndexB) {
		const state = this.getState();
		const shapeA = state.shapeDataList[shapeIndexA];
		const shapeB = state.shapeDataList[shapeIndexB];
		if (shapeA.bodyIndex === shapeB.bodyIndex) {
			return false;
		}
		if (shapeA.type === ShapeType2D.segment && shapeB.type === ShapeType2D.segment) {
			return false;
		}
		const bodyA = state.bodyDataList[shapeA.bodyIndex];
		const bodyB = state.bodyDataList[shapeB.bodyIndex];
		if (bodyA.type !== BodyType2D.dynamic && bodyB.type !== BodyType2D.dynamic) {
			return false;
		}
		if (shapeA.isSensor && shapeB.isSensor) {
			return false;
		}
		if ((shapeA.isSensor && !shapeB.enableSensorEvents) || (shapeB.isSensor && !shapeA.enableSensorEvents)) {
			return false;
		}
		const isFilterPassed = shouldFiltersCollide(shapeA.categoryBits, shapeA.maskBits, shapeA.groupIndex, shapeB.categoryBits, shapeB.maskBits, shapeB.groupIndex);
		if (!isFilterPassed) {
			return false;
		}
		for (const jointData of state.jointDataList) {
			if (jointData === null || jointData.collideConnected) {
				continue;
			}
			if ((jointData.bodyIndexA === shapeA.bodyIndex && jointData.bodyIndexB === shapeB.bodyIndex) || (jointData.bodyIndexA === shapeB.bodyIndex && jointData.bodyIndexB === shapeA.bodyIndex)) {
				return false;
			}
		}
		return true;
	}

	//==============================================================================
	// 옮겨진 모양의 새 짝 찾기. (나무 질의, 열쇠 차례로 닿음을 만든다, 안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 */
	updatePairs() {
		const state = this.getState();
		const tree = state.tree;
		const keyList = [];
		for (const shapeIndex of state.moveBuffer) {
			const shapeData = state.shapeDataList[shapeIndex];
			if (shapeData === null || !state.shapeMovedList[shapeIndex]) {
				continue;
			}
			tree.query(shapeData.fatAabb, 0xffffffff, (proxyId) => {
				const otherIndex = tree.getUserData(proxyId);
				if (otherIndex === shapeIndex) {
					return true;
				}
				// 둘 다 옮겨졌으면 번호가 작은 쪽에서 한 번만 넣는다.
				if (state.shapeMovedList[otherIndex] && otherIndex < shapeIndex) {
					return true;
				}
				const minimumIndex = System.Math.min(shapeIndex, otherIndex);
				const maximumIndex = System.Math.max(shapeIndex, otherIndex);
				keyList.push(minimumIndex * CONTACT_KEY_MULTIPLIER + maximumIndex);
				return true;
			});
		}
		for (const shapeIndex of state.moveBuffer) {
			state.shapeMovedList[shapeIndex] = false;
		}
		state.moveBuffer = [];
		keyList.sort((first, second) => first - second);
		let previousKey = -1;
		for (const key of keyList) {
			if (key === previousKey) {
				continue;
			}
			previousKey = key;
			if (state.contactTable.has(key)) {
				continue;
			}
			const shapeIndexA = System.Math.floor(key / CONTACT_KEY_MULTIPLIER);
			const shapeIndexB = key - shapeIndexA * CONTACT_KEY_MULTIPLIER;
			const shouldCollide = this.shouldShapesCollide(shapeIndexA, shapeIndexB);
			if (!shouldCollide) {
				continue;
			}
			this.createContact(shapeIndexA, shapeIndexB, key);
		}
	}

	//==============================================================================
	// 닿음 만들기. (원은 늘 B 쪽, 안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @param { number } shapeIndex1
	 * @param { number } shapeIndex2
	 * @param { number } key
	 */
	createContact(shapeIndex1, shapeIndex2, key) {
		const state = this.getState();
		let shapeIndexA = shapeIndex1;
		let shapeIndexB = shapeIndex2;
		if (state.shapeDataList[shapeIndexA].type === ShapeType2D.circle && state.shapeDataList[shapeIndexB].type !== ShapeType2D.circle) {
			shapeIndexA = shapeIndex2;
			shapeIndexB = shapeIndex1;
		}
		let index = state.contactList.length;
		let contact = null;
		if (state.contactFreeList.length > 0) {
			index = state.contactFreeList.pop();
			contact = state.contactList[index];
		}
		else {
			contact = new Contact();
			state.contactList.push(contact);
		}
		const shapeA = state.shapeDataList[shapeIndexA];
		const shapeB = state.shapeDataList[shapeIndexB];
		contact.shapeIndexA = shapeIndexA;
		contact.shapeIndexB = shapeIndexB;
		contact.bodyIndexA = shapeA.bodyIndex;
		contact.bodyIndexB = shapeB.bodyIndex;
		contact.key = key;
		contact.isSensor = shapeA.isSensor || shapeB.isSensor;
		contact.isTouching = false;
		contact.isAlive = true;
		contact.manifold.pointCount = 0;
		state.contactTable.set(key, index);
	}

	//==============================================================================
	// 닿음 지우기. (닿아 있었으면 끝 사건을 낸다, 안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @param { number } contactIndex
	 */
	destroyContact(contactIndex) {
		const state = this.getState();
		const contact = state.contactList[contactIndex];
		if (contact.isTouching) {
			this.pushEndEvent(contact);
		}
		state.contactTable.delete(contact.key);
		contact.isAlive = false;
		contact.isTouching = false;
		contact.manifold.pointCount = 0;
		state.contactFreeList.push(contactIndex);
	}

	//==============================================================================
	// 닿음이 끝난 사건 넣기. (센서면 센서 나감, 안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @param { Contact } contact
	 */
	pushEndEvent(contact) {
		const state = this.getState();
		const shapeA = state.shapeDataList[contact.shapeIndexA];
		const shapeB = state.shapeDataList[contact.shapeIndexB];
		if (contact.isSensor) {
			const sensorShape = shapeA.isSensor ? shapeA : shapeB;
			const visitorShape = shapeA.isSensor ? shapeB : shapeA;
			if (visitorShape.enableSensorEvents) {
				state.sensorEndEventList.push(new SensorEvent2D(sensorShape.id, visitorShape.id));
			}
			return;
		}
		if (shapeA.enableContactEvents || shapeB.enableContactEvents) {
			state.contactEndEventList.push(new ContactEvent2D(shapeA.id, shapeB.id));
		}
	}

	//==============================================================================
	// 닿음점 고치기. (깨어 있는 몸이 낀 닿음만, 안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 */
	collide() {
		const state = this.getState();
		const worldShapeA = state.worldShapeA;
		const worldShapeB = state.worldShapeB;
		const oldIdList = [0, 0];
		const oldNormalImpulseList = [0, 0];
		const oldTangentImpulseList = [0, 0];
		for (let contactIndex = 0; contactIndex < state.contactList.length; ++contactIndex) {
			const contact = state.contactList[contactIndex];
			if (!contact.isAlive) {
				continue;
			}
			const shapeA = state.shapeDataList[contact.shapeIndexA];
			const shapeB = state.shapeDataList[contact.shapeIndexB];
			const bodyA = state.bodyDataList[contact.bodyIndexA];
			const bodyB = state.bodyDataList[contact.bodyIndexB];
			const isActiveA = bodyA.type !== BodyType2D.static && bodyA.isAwake;
			const isActiveB = bodyB.type !== BodyType2D.static && bodyB.isAwake;
			if (!isActiveA && !isActiveB) {
				continue;
			}
			const isOverlapped = shapeA.fatAabb.overlaps(shapeB.fatAabb);
			if (!isOverlapped) {
				this.destroyContact(contactIndex);
				continue;
			}
			fillWorldShape(shapeA, bodyA.positionX, bodyA.positionY, bodyA.rotationCosine, bodyA.rotationSine, worldShapeA);
			fillWorldShape(shapeB, bodyB.positionX, bodyB.positionY, bodyB.rotationCosine, bodyB.rotationSine, worldShapeB);
			const wasTouching = contact.isTouching;
			if (contact.isSensor) {
				const manifold = state.scratchManifold;
				collideShapes(worldShapeA, worldShapeB, 0, state.linearSlop, manifold);
				let isTouching = false;
				for (let pointIndex = 0; pointIndex < manifold.pointCount; ++pointIndex) {
					if (manifold.points[pointIndex].separation < 0) {
						isTouching = true;
					}
				}
				contact.isTouching = isTouching;
				if (isTouching && !wasTouching) {
					const sensorShape = shapeA.isSensor ? shapeA : shapeB;
					const visitorShape = shapeA.isSensor ? shapeB : shapeA;
					if (visitorShape.enableSensorEvents) {
						state.sensorBeginEventList.push(new SensorEvent2D(sensorShape.id, visitorShape.id));
					}
				}
				else if (!isTouching && wasTouching) {
					this.pushEndEvent(contact);
				}
				continue;
			}
			const manifold = contact.manifold;
			const oldPointCount = manifold.pointCount;
			for (let pointIndex = 0; pointIndex < oldPointCount; ++pointIndex) {
				oldIdList[pointIndex] = manifold.points[pointIndex].id;
				oldNormalImpulseList[pointIndex] = manifold.points[pointIndex].normalImpulse;
				oldTangentImpulseList[pointIndex] = manifold.points[pointIndex].tangentImpulse;
			}
			collideShapes(worldShapeA, worldShapeB, state.speculativeDistance, state.linearSlop, manifold);
			for (let pointIndex = 0; pointIndex < manifold.pointCount; ++pointIndex) {
				const manifoldPoint = manifold.points[pointIndex];
				manifoldPoint.normalImpulse = 0;
				manifoldPoint.tangentImpulse = 0;
				for (let oldIndex = 0; oldIndex < oldPointCount; ++oldIndex) {
					if (oldIdList[oldIndex] === manifoldPoint.id) {
						manifoldPoint.normalImpulse = oldNormalImpulseList[oldIndex];
						manifoldPoint.tangentImpulse = oldTangentImpulseList[oldIndex];
						break;
					}
				}
			}
			const isTouching = manifold.pointCount > 0;
			contact.isTouching = isTouching;
			if (isTouching && !wasTouching) {
				if (shapeA.enableContactEvents || shapeB.enableContactEvents) {
					state.contactBeginEventList.push(new ContactEvent2D(shapeA.id, shapeB.id));
				}
			}
			else if (!isTouching && wasTouching) {
				this.pushEndEvent(contact);
			}
		}
	}

	//==============================================================================
	// 섬의 뿌리 찾기. (경로 반 줄이기, 안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @param { number } bodyIndex
	 * @returns { number }
	 */
	findIslandRoot(bodyIndex) {
		const state = this.getState();
		const bodyDataList = state.bodyDataList;
		let index = bodyIndex;
		while (bodyDataList[index].islandParent !== index) {
			const parent = bodyDataList[index].islandParent;
			bodyDataList[index].islandParent = bodyDataList[parent].islandParent;
			index = bodyDataList[index].islandParent;
		}
		return index;
	}

	//==============================================================================
	// 두 몸의 섬 잇기. (번호가 작은 뿌리 쪽으로, 안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @param { number } bodyIndexA
	 * @param { number } bodyIndexB
	 */
	linkIslands(bodyIndexA, bodyIndexB) {
		const state = this.getState();
		const rootA = this.findIslandRoot(bodyIndexA);
		const rootB = this.findIslandRoot(bodyIndexB);
		if (rootA === rootB) {
			return;
		}
		if (rootA < rootB) {
			state.bodyDataList[rootB].islandParent = rootA;
		}
		else {
			state.bodyDataList[rootA].islandParent = rootB;
		}
	}

	//==============================================================================
	// 풀이. (섬 짓기와 깨우기, 하위 걸음, 반발, 몸 마무리, 잠자기, 안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @param { StepContext } context
	 * @param { number } subStepCount
	 */
	solve(context, subStepCount) {
		const state = this.getState();
		const bodyDataList = state.bodyDataList;

		// 섬. (닿은 닿음과 관절로 이은 정적 아닌 몸들)
		for (let bodyIndex = 0; bodyIndex < bodyDataList.length; ++bodyIndex) {
			const data = bodyDataList[bodyIndex];
			if (data !== null) {
				data.islandParent = data.type === BodyType2D.static ? -1 : bodyIndex;
			}
		}
		for (const contact of state.contactList) {
			if (!contact.isAlive || contact.isSensor || !contact.isTouching) {
				continue;
			}
			if (bodyDataList[contact.bodyIndexA].islandParent < 0 || bodyDataList[contact.bodyIndexB].islandParent < 0) {
				continue;
			}
			this.linkIslands(contact.bodyIndexA, contact.bodyIndexB);
		}
		for (const jointData of state.jointDataList) {
			if (jointData === null) {
				continue;
			}
			if (bodyDataList[jointData.bodyIndexA].islandParent < 0 || bodyDataList[jointData.bodyIndexB].islandParent < 0) {
				continue;
			}
			this.linkIslands(jointData.bodyIndexA, jointData.bodyIndexB);
		}
		// 깨어 있는 몸이 하나라도 있는 섬은 모두 깨운다.
		const islandAwakeList = new System.Array(bodyDataList.length).fill(false);
		for (let bodyIndex = 0; bodyIndex < bodyDataList.length; ++bodyIndex) {
			const data = bodyDataList[bodyIndex];
			if (data !== null && data.islandParent >= 0 && data.isAwake) {
				const root = this.findIslandRoot(bodyIndex);
				islandAwakeList[root] = true;
			}
		}
		for (let bodyIndex = 0; bodyIndex < bodyDataList.length; ++bodyIndex) {
			const data = bodyDataList[bodyIndex];
			if (data !== null && data.islandParent >= 0 && !data.isAwake) {
				const root = this.findIslandRoot(bodyIndex);
				if (islandAwakeList[root]) {
					data.isAwake = true;
					data.sleepTime = 0;
				}
			}
		}

		// 풀이 몸.
		const solverBodyList = state.solverBodyList;
		let solverBodyCount = 0;
		for (let bodyIndex = 0; bodyIndex < bodyDataList.length; ++bodyIndex) {
			const data = bodyDataList[bodyIndex];
			if (data === null) {
				continue;
			}
			data.solverIndex = -1;
			if (data.type === BodyType2D.static || !data.isAwake) {
				continue;
			}
			if (solverBodyCount >= solverBodyList.length) {
				solverBodyList.push(new SolverBody());
			}
			const solverBody = solverBodyList[solverBodyCount];
			solverBody.bodyIndex = bodyIndex;
			solverBody.linearVelocityX = data.linearVelocityX;
			solverBody.linearVelocityY = data.linearVelocityY;
			solverBody.angularVelocity = data.angularVelocity;
			solverBody.deltaPositionX = 0;
			solverBody.deltaPositionY = 0;
			solverBody.deltaRotationCosine = 1;
			solverBody.deltaRotationSine = 0;
			solverBody.inverseMass = data.inverseMass;
			solverBody.inverseInertia = data.inverseInertia;
			data.solverIndex = solverBodyCount;
			solverBodyCount += 1;
		}
		state.solverBodyCount = solverBodyCount;

		// 닿음과 관절 준비.
		const activeContactList = [];
		for (const contact of state.contactList) {
			if (!contact.isAlive || contact.isSensor || !contact.isTouching) {
				continue;
			}
			const bodyA = bodyDataList[contact.bodyIndexA];
			const bodyB = bodyDataList[contact.bodyIndexB];
			if (bodyA.solverIndex < 0 && bodyB.solverIndex < 0) {
				continue;
			}
			const shapeA = state.shapeDataList[contact.shapeIndexA];
			const shapeB = state.shapeDataList[contact.shapeIndexB];
			contact.friction = System.Math.sqrt(shapeA.friction * shapeB.friction);
			contact.restitution = System.Math.max(shapeA.restitution, shapeB.restitution);
			prepareContact(contact, bodyA, bodyB, solverBodyList, context);
			activeContactList.push(contact);
		}
		const activeJointList = [];
		for (const jointData of state.jointDataList) {
			if (jointData === null) {
				continue;
			}
			const bodyA = bodyDataList[jointData.bodyIndexA];
			const bodyB = bodyDataList[jointData.bodyIndexB];
			if (bodyA.solverIndex < 0 && bodyB.solverIndex < 0) {
				continue;
			}
			prepareJoint(jointData, bodyA, bodyB, solverBodyList, context);
			activeJointList.push(jointData);
		}

		// 하위 걸음.
		const subStepTime = context.subStepTime;
		for (let subStepIndex = 0; subStepIndex < subStepCount; ++subStepIndex) {
			this.integrateVelocities(context);
			for (const jointData of activeJointList) {
				warmStartJoint(jointData, solverBodyList);
			}
			for (const contact of activeContactList) {
				warmStartContact(contact, solverBodyList);
			}
			for (const jointData of activeJointList) {
				solveJoint(jointData, solverBodyList, context, true);
			}
			for (const contact of activeContactList) {
				solveContact(contact, solverBodyList, context, true);
			}
			for (let solverIndex = 0; solverIndex < solverBodyCount; ++solverIndex) {
				const solverBody = solverBodyList[solverIndex];
				const rotation = integrateRotation(solverBody.deltaRotationCosine, solverBody.deltaRotationSine, subStepTime * solverBody.angularVelocity);
				solverBody.deltaRotationCosine = rotation[0];
				solverBody.deltaRotationSine = rotation[1];
				solverBody.deltaPositionX = solverBody.deltaPositionX + subStepTime * solverBody.linearVelocityX;
				solverBody.deltaPositionY = solverBody.deltaPositionY + subStepTime * solverBody.linearVelocityY;
			}
			for (const jointData of activeJointList) {
				solveJoint(jointData, solverBodyList, context, false);
			}
			for (const contact of activeContactList) {
				solveContact(contact, solverBodyList, context, false);
			}
		}
		for (const contact of activeContactList) {
			applyContactRestitution(contact, solverBodyList, context);
		}

		// 몸 마무리. (자리, 상자, 잠들 시간)
		const timeStep = context.timeStep;
		const inverseTimeStep = context.inverseTimeStep;
		for (let solverIndex = 0; solverIndex < solverBodyCount; ++solverIndex) {
			const solverBody = solverBodyList[solverIndex];
			const data = bodyDataList[solverBody.bodyIndex];
			data.linearVelocityX = solverBody.linearVelocityX;
			data.linearVelocityY = solverBody.linearVelocityY;
			data.angularVelocity = solverBody.angularVelocity;
			data.centerX = data.centerX + solverBody.deltaPositionX;
			data.centerY = data.centerY + solverBody.deltaPositionY;
			const cosine = solverBody.deltaRotationCosine * data.rotationCosine - solverBody.deltaRotationSine * data.rotationSine;
			const sine = solverBody.deltaRotationSine * data.rotationCosine + solverBody.deltaRotationCosine * data.rotationSine;
			const magnitude = System.Math.sqrt(cosine * cosine + sine * sine);
			const inverseMagnitude = magnitude > 0 ? 1 / magnitude : 0;
			data.rotationCosine = cosine * inverseMagnitude;
			data.rotationSine = sine * inverseMagnitude;
			data.positionX = data.centerX - (data.rotationCosine * data.localCenterX - data.rotationSine * data.localCenterY);
			data.positionY = data.centerY - (data.rotationSine * data.localCenterX + data.rotationCosine * data.localCenterY);
			data.forceX = 0;
			data.forceY = 0;
			data.torque = 0;

			const speed = System.Math.sqrt(data.linearVelocityX * data.linearVelocityX + data.linearVelocityY * data.linearVelocityY);
			const maximumVelocity = speed + System.Math.abs(data.angularVelocity) * data.maximumExtent;
			const deltaLength = System.Math.sqrt(solverBody.deltaPositionX * solverBody.deltaPositionX + solverBody.deltaPositionY * solverBody.deltaPositionY);
			const maximumDeltaPosition = deltaLength + System.Math.abs(solverBody.deltaRotationSine) * data.maximumExtent;
			// 밀어내기로 움직인 것도 본다. (다른 구속이 계속 밀고 있을 수 있다)
			const sleepVelocity = System.Math.max(maximumVelocity, 0.5 * inverseTimeStep * maximumDeltaPosition);
			if (!state.enableSleep || !data.enableSleep || sleepVelocity > state.sleepThreshold) {
				data.sleepTime = 0;
			}
			else {
				data.sleepTime += timeStep;
			}
			for (const shapeId of data.shapeIdList) {
				this.synchronizeShape(shapeId.getIndex(), false);
			}
		}

		// 잠자기. (섬의 모든 몸이 충분히 가만히 있었으면 섬째 재운다)
		if (!state.enableSleep) {
			return;
		}
		const islandSleepTimeList = new System.Array(bodyDataList.length).fill(System.Number.POSITIVE_INFINITY);
		for (let bodyIndex = 0; bodyIndex < bodyDataList.length; ++bodyIndex) {
			const data = bodyDataList[bodyIndex];
			if (data === null || data.islandParent < 0) {
				continue;
			}
			const root = this.findIslandRoot(bodyIndex);
			islandSleepTimeList[root] = System.Math.min(islandSleepTimeList[root], data.sleepTime);
		}
		for (let bodyIndex = 0; bodyIndex < bodyDataList.length; ++bodyIndex) {
			const data = bodyDataList[bodyIndex];
			if (data === null || data.islandParent < 0 || !data.isAwake) {
				continue;
			}
			const root = this.findIslandRoot(bodyIndex);
			if (islandSleepTimeList[root] >= TIME_TO_SLEEP) {
				data.isAwake = false;
				data.linearVelocityX = 0;
				data.linearVelocityY = 0;
				data.angularVelocity = 0;
			}
		}
	}

	//==============================================================================
	// 속도 적분. (중력, 힘, 감쇠, 속력 한도, 동적 몸만, 안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @param { StepContext } context
	 */
	integrateVelocities(context) {
		const state = this.getState();
		const subStepTime = context.subStepTime;
		const maximumLinearSpeed = context.maximumLinearSpeed;
		const maximumAngularSpeed = context.maximumAngularSpeed;
		for (let solverIndex = 0; solverIndex < state.solverBodyCount; ++solverIndex) {
			const solverBody = state.solverBodyList[solverIndex];
			if (solverBody.inverseMass === 0) {
				continue;
			}
			const data = state.bodyDataList[solverBody.bodyIndex];
			const linearDampingFactor = 1 / (1 + subStepTime * data.linearDamping);
			const angularDampingFactor = 1 / (1 + subStepTime * data.angularDamping);
			const linearVelocityDeltaX = subStepTime * solverBody.inverseMass * (data.forceX + data.mass * data.gravityScale * context.gravityX);
			const linearVelocityDeltaY = subStepTime * solverBody.inverseMass * (data.forceY + data.mass * data.gravityScale * context.gravityY);
			const angularVelocityDelta = subStepTime * solverBody.inverseInertia * data.torque;
			let velocityX = linearVelocityDeltaX + linearDampingFactor * solverBody.linearVelocityX;
			let velocityY = linearVelocityDeltaY + linearDampingFactor * solverBody.linearVelocityY;
			let angularVelocity = angularVelocityDelta + angularDampingFactor * solverBody.angularVelocity;
			const speedSquared = velocityX * velocityX + velocityY * velocityY;
			if (speedSquared > maximumLinearSpeed * maximumLinearSpeed) {
				const ratio = maximumLinearSpeed / System.Math.sqrt(speedSquared);
				velocityX = velocityX * ratio;
				velocityY = velocityY * ratio;
			}
			if (angularVelocity * angularVelocity > maximumAngularSpeed * maximumAngularSpeed) {
				angularVelocity = angularVelocity > 0 ? maximumAngularSpeed : -maximumAngularSpeed;
			}
			solverBody.linearVelocityX = velocityX;
			solverBody.linearVelocityY = velocityY;
			solverBody.angularVelocity = angularVelocity;
		}
	}

	//==============================================================================
	// 모양이 질의 거르기를 지나는지. (안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @param { ShapeData } shapeData
	 * @param { QueryFilter2D } queryFilter
	 * @returns { boolean }
	 */
	isQueryPassed(shapeData, queryFilter) {
		return (shapeData.categoryBits & queryFilter.maskBits) !== 0 && (shapeData.maskBits & queryFilter.categoryBits) !== 0;
	}

	//==============================================================================
	// 광선 쏘기. (지나는 모양마다 callback, 센서는 맞지 않는다)
	// - callback(shapeId, point, normal, fraction) 이 돌려주는 값: 0 이면 멈춘다, 음수면 그 모양을 무시한다,
	//   그 밖에는 그 몫으로 광선을 줄인다. 가장 가까운 것만 원하면 fraction 을, 모두 원하면 1 을 돌려준다.
	//==============================================================================
	/**
	 * @param { Vector2 } origin 시작점.
	 * @param { Vector2 } translation 끝점까지의 이동.
	 * @param { QueryFilter2D } queryFilter 질의 거르기.
	 * @param { Function } callback (shapeId, point, normal, fraction) => number
	 */
	castRay(origin, translation, queryFilter, callback) {
		const state = this.getState();
		this.synchronizeTransformChanges();
		const worldShape = state.worldShapeA;
		const tree = state.tree;
		tree.rayCast(origin.x, origin.y, translation.x, translation.y, 0xffffffff, (proxyId, maximumFraction) => {
			const shapeIndex = tree.getUserData(proxyId);
			const shapeData = state.shapeDataList[shapeIndex];
			const isPassed = this.isQueryPassed(shapeData, queryFilter);
			if (shapeData.isSensor || !isPassed) {
				return -1;
			}
			const bodyData = state.bodyDataList[shapeData.bodyIndex];
			fillWorldShape(shapeData, bodyData.positionX, bodyData.positionY, bodyData.rotationCosine, bodyData.rotationSine, worldShape);
			const hit = rayCastWorldShape(worldShape, origin.x, origin.y, translation.x, translation.y, maximumFraction);
			if (hit === null) {
				return -1;
			}
			const point = Vector2.create(hit[1], hit[2]);
			const normal = Vector2.create(hit[3], hit[4]);
			return callback(shapeData.id, point, normal, hit[0]);
		});
	}

	//==============================================================================
	// 가장 가까운 맞음 찾기.
	//==============================================================================
	/**
	 * @param { Vector2 } origin 시작점.
	 * @param { Vector2 } translation 끝점까지의 이동.
	 * @param { QueryFilter2D } queryFilter 질의 거르기.
	 * @returns { RayResult2D | null } 가장 가까운 맞음. (없으면 null)
	 */
	castRayClosest(origin, translation, queryFilter) {
		let closestResult = null;
		this.castRay(origin, translation, queryFilter, (shapeId, point, normal, fraction) => {
			closestResult = new RayResult2D(shapeId, point, normal, fraction);
			return fraction;
		});
		return closestResult;
	}

	//==============================================================================
	// 상자와 겹치는 모양 찾기. (모양의 경계 상자로 본다, callback 이 거짓이면 멈춘다)
	//==============================================================================
	/**
	 * @param { AABB2D } aabb 찾을 상자.
	 * @param { QueryFilter2D } queryFilter 질의 거르기.
	 * @param { Function } callback (shapeId) => boolean
	 */
	overlapAabb(aabb, queryFilter, callback) {
		const state = this.getState();
		this.synchronizeTransformChanges();
		const tree = state.tree;
		tree.query(aabb, 0xffffffff, (proxyId) => {
			const shapeIndex = tree.getUserData(proxyId);
			const shapeData = state.shapeDataList[shapeIndex];
			const isPassed = this.isQueryPassed(shapeData, queryFilter);
			const isOverlapped = shapeData.aabb.overlaps(aabb);
			if (!isPassed || !isOverlapped) {
				return true;
			}
			return callback(shapeData.id) !== false;
		});
	}

	//==============================================================================
	// 점을 담은 모양 찾기. (callback 이 거짓이면 멈춘다)
	//==============================================================================
	/**
	 * @param { Vector2 } point 월드 점.
	 * @param { QueryFilter2D } queryFilter 질의 거르기.
	 * @param { Function } callback (shapeId) => boolean
	 */
	overlapPoint(point, queryFilter, callback) {
		const state = this.getState();
		this.synchronizeTransformChanges();
		const tree = state.tree;
		const worldShape = state.worldShapeA;
		const pointAabb = AABB2D.create(point.x, point.y, point.x, point.y);
		tree.query(pointAabb, 0xffffffff, (proxyId) => {
			const shapeIndex = tree.getUserData(proxyId);
			const shapeData = state.shapeDataList[shapeIndex];
			const isPassed = this.isQueryPassed(shapeData, queryFilter);
			if (!isPassed) {
				return true;
			}
			const bodyData = state.bodyDataList[shapeData.bodyIndex];
			fillWorldShape(shapeData, bodyData.positionX, bodyData.positionY, bodyData.rotationCosine, bodyData.rotationSine, worldShape);
			const isInside = testPointInWorldShape(worldShape, point.x, point.y);
			if (!isInside) {
				return true;
			}
			return callback(shapeData.id) !== false;
		});
	}

	//==============================================================================
	// 모양과 겹치는 모양 찾기. (닿기만 한 것은 빼고 파고든 것만, callback 이 거짓이면 멈춘다)
	//==============================================================================
	/**
	 * @param { Circle2D | Capsule2D | Segment2D | Polygon2D } geometry 질의 모양. (position, angle 기준)
	 * @param { Vector2 } position 질의 모양의 자리.
	 * @param { number } angle 질의 모양의 돌림. (라디안)
	 * @param { QueryFilter2D } queryFilter 질의 거르기.
	 * @param { Function } callback (shapeId) => boolean
	 */
	overlapShape(geometry, position, angle, queryFilter, callback) {
		const state = this.getState();
		this.synchronizeTransformChanges();
		const queryData = new ShapeData();
		const isValid = setShapeGeometry(queryData, geometry);
		if (!isValid) {
			return;
		}
		const rotation = PhysicsMath2D.computeRotation(angle);
		const queryShape = new WorldShape();
		fillWorldShape(queryData, position.x, position.y, rotation.cosine, rotation.sine, queryShape);
		computeShapeAabb(queryData, position.x, position.y, rotation.cosine, rotation.sine, queryData.aabb);
		const tree = state.tree;
		const worldShape = state.worldShapeA;
		const manifold = state.scratchManifold;
		tree.query(queryData.aabb, 0xffffffff, (proxyId) => {
			const shapeIndex = tree.getUserData(proxyId);
			const shapeData = state.shapeDataList[shapeIndex];
			const isPassed = this.isQueryPassed(shapeData, queryFilter);
			if (!isPassed) {
				return true;
			}
			if (shapeData.type === ShapeType2D.segment && queryData.type === ShapeType2D.segment) {
				return true;
			}
			const bodyData = state.bodyDataList[shapeData.bodyIndex];
			fillWorldShape(shapeData, bodyData.positionX, bodyData.positionY, bodyData.rotationCosine, bodyData.rotationSine, worldShape);
			if (shapeData.type === ShapeType2D.circle && queryData.type !== ShapeType2D.circle) {
				collideShapes(queryShape, worldShape, 0, state.linearSlop, manifold);
			}
			else {
				collideShapes(worldShape, queryShape, 0, state.linearSlop, manifold);
			}
			let isOverlapped = false;
			for (let pointIndex = 0; pointIndex < manifold.pointCount; ++pointIndex) {
				if (manifold.points[pointIndex].separation < 0) {
					isOverlapped = true;
				}
			}
			if (!isOverlapped) {
				return true;
			}
			return callback(shapeData.id) !== false;
		});
	}
}
