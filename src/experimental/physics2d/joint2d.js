//==============================================================================
// 포함 모듈 목록.
//==============================================================================
// 옮긴 원문: Box2D 3 의 셈에서 옮김, MIT, THIRD_PARTY_LICENSES.md
const System = globalThis;
import { Object } from "../../base/object.js";
import { Vector2 } from "../../base/vector2.js";
import { PhysicsMath2D } from "./physicsmath2d.js";
import { BodyId2D, JointId2D } from "./physicsid2d.js";
import { Softness, makeSoftness, STATIC_SOLVER_BODY } from "./solver2d.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 길이 한도의 기본 위쪽. (사실상 끝이 없다)
const HUGE_LENGTH = 1e18;


//==============================================================================
// 관절의 종류.
//==============================================================================
/** @enum { number } */
export const JointType2D = System.Object.freeze({
	distance: 0, // 거리. (두 점 사이 길이를 지키거나 용수철, 밧줄)
	revolute: 1, // 회전. (한 점을 공유하고 돈다, 경첩, 모터와 각도 한도)
	weld: 2, // 용접. (자리와 각도를 함께 묶는다, 부드럽게 할 수 있다)
	wheel: 3, // 바퀴. (축 위에서 용수철로 오르내리고 돈다, 수레의 바퀴)
});


//==============================================================================
// 거리 관절 정의.
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - enableSpring 이 거짓이면 두 닻 사이 길이를 단단히 지킨다. 참이면 hertz, dampingRatio 의 용수철이고, hertz 가 0 이면 한도(minLength, maxLength)만 남는 밧줄이다.
//==============================================================================
/**
 * @example <caption>천장에 매단 추</caption>
 * import { Vector2 } from "./import.js";
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const world = new Experimental.PhysicsWorld2D(new Experimental.WorldDefinition2D(1));
 * const ceilingId = world.createBody(new Experimental.BodyDefinition2D());
 * const bobDefinition = new Experimental.BodyDefinition2D();
 * bobDefinition.type = Experimental.BodyType2D.dynamic;
 * bobDefinition.position = Vector2.create(3, 0);
 * const bobId = world.createBody(bobDefinition);
 * world.createShape(bobId, new Experimental.ShapeDefinition2D(), Experimental.Circle2D.create(Vector2.zero(), 0.25));
 * const jointDefinition = new Experimental.DistanceJointDefinition2D();
 * jointDefinition.bodyIdA = ceilingId;
 * jointDefinition.bodyIdB = bobId;
 * jointDefinition.length = 3;
 * world.createDistanceJoint(jointDefinition);
 * for (let index = 0; index < 60; ++index) {
 * 	world.step(1 / 60, 4);
 * }
 * const position = world.getBody(bobId).getPosition();
 * console.log(Math.hypot(position.x, position.y).toFixed(3));
 */
export class DistanceJointDefinition2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { BodyId2D | null } */ bodyIdA; // 첫 몸.
	/** @type { BodyId2D | null } */ bodyIdB; // 둘째 몸.
	/** @type { Vector2 } */ localAnchorA; // 첫 몸 기준 닻.
	/** @type { Vector2 } */ localAnchorB; // 둘째 몸 기준 닻.
	/** @type { number } */ length; // 쉬는 길이. (기본 1)
	/** @type { boolean } */ enableSpring; // 용수철로 할지. (기본 거짓)
	/** @type { number } */ hertz; // 용수철 진동수. (헤르츠, 기본 0)
	/** @type { number } */ dampingRatio; // 용수철 감쇠비. (기본 0)
	/** @type { boolean } */ enableLimit; // 길이 한도를 쓸지. (용수철일 때만, 기본 거짓)
	/** @type { number } */ minLength; // 가장 짧은 길이.
	/** @type { number } */ maxLength; // 가장 긴 길이.
	/** @type { boolean } */ collideConnected; // 두 몸끼리 부딪힐지. (기본 거짓)
	/** @type { any } */ userData; // 사용자 값.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.bodyIdA = null;
		this.bodyIdB = null;
		this.localAnchorA = Vector2.zero();
		this.localAnchorB = Vector2.zero();
		this.length = 1;
		this.enableSpring = false;
		this.hertz = 0;
		this.dampingRatio = 0;
		this.enableLimit = false;
		this.minLength = 0;
		this.maxLength = HUGE_LENGTH;
		this.collideConnected = false;
		this.userData = null;
	}
}


//==============================================================================
// 회전 관절 정의.
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 두 몸의 닻이 한 점에 겹치고 그 둘레로 돈다. 관절 각도는 (B 의 돌림 - A 의 돌림 - referenceAngle) 이다.
//==============================================================================
/**
 * @example <caption>모터로 도는 바퀴</caption>
 * import { Vector2 } from "./import.js";
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const world = new Experimental.PhysicsWorld2D(new Experimental.WorldDefinition2D(1));
 * const groundId = world.createBody(new Experimental.BodyDefinition2D());
 * const wheelDefinition = new Experimental.BodyDefinition2D();
 * wheelDefinition.type = Experimental.BodyType2D.dynamic;
 * const wheelId = world.createBody(wheelDefinition);
 * world.createShape(wheelId, new Experimental.ShapeDefinition2D(), Experimental.Circle2D.create(Vector2.zero(), 0.5));
 * const jointDefinition = new Experimental.RevoluteJointDefinition2D();
 * jointDefinition.bodyIdA = groundId;
 * jointDefinition.bodyIdB = wheelId;
 * jointDefinition.enableMotor = true;
 * jointDefinition.motorSpeed = 2;
 * jointDefinition.maxMotorTorque = 100;
 * world.createRevoluteJoint(jointDefinition);
 * for (let index = 0; index < 30; ++index) {
 * 	world.step(1 / 60, 4);
 * }
 * console.log(world.getBody(wheelId).getAngularVelocity().toFixed(3));
 */
export class RevoluteJointDefinition2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { BodyId2D | null } */ bodyIdA; // 첫 몸.
	/** @type { BodyId2D | null } */ bodyIdB; // 둘째 몸.
	/** @type { Vector2 } */ localAnchorA; // 첫 몸 기준 닻.
	/** @type { Vector2 } */ localAnchorB; // 둘째 몸 기준 닻.
	/** @type { number } */ referenceAngle; // 관절 각도 0 일 때 B 와 A 의 돌림 차이. (라디안)
	/** @type { boolean } */ enableSpring; // 각도 용수철을 쓸지. (관절 각도 0 쪽으로)
	/** @type { number } */ hertz; // 용수철 진동수. (헤르츠)
	/** @type { number } */ dampingRatio; // 용수철 감쇠비.
	/** @type { boolean } */ enableMotor; // 모터를 쓸지.
	/** @type { number } */ maxMotorTorque; // 모터의 가장 큰 돌림힘.
	/** @type { number } */ motorSpeed; // 모터 각속도. (초당 라디안)
	/** @type { boolean } */ enableLimit; // 각도 한도를 쓸지.
	/** @type { number } */ lowerAngle; // 가장 작은 관절 각도. (라디안)
	/** @type { number } */ upperAngle; // 가장 큰 관절 각도. (라디안)
	/** @type { boolean } */ collideConnected; // 두 몸끼리 부딪힐지. (기본 거짓)
	/** @type { any } */ userData; // 사용자 값.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.bodyIdA = null;
		this.bodyIdB = null;
		this.localAnchorA = Vector2.zero();
		this.localAnchorB = Vector2.zero();
		this.referenceAngle = 0;
		this.enableSpring = false;
		this.hertz = 0;
		this.dampingRatio = 0;
		this.enableMotor = false;
		this.maxMotorTorque = 0;
		this.motorSpeed = 0;
		this.enableLimit = false;
		this.lowerAngle = 0;
		this.upperAngle = 0;
		this.collideConnected = false;
		this.userData = null;
	}
}


//==============================================================================
// 용접 관절 정의.
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 헤르츠가 0 이면 단단히 묶는다. 0 보다 크면 그 진동수의 용수철로 휜다. (나뭇가지, 출렁이는 다리)
//==============================================================================
/**
 * @example <caption>두 상자를 붙이기</caption>
 * import { Vector2 } from "./import.js";
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const world = new Experimental.PhysicsWorld2D(new Experimental.WorldDefinition2D(1));
 * const firstId = world.createBody(new Experimental.BodyDefinition2D());
 * const secondDefinition = new Experimental.BodyDefinition2D();
 * secondDefinition.type = Experimental.BodyType2D.dynamic;
 * secondDefinition.position = Vector2.create(1, 0);
 * const secondId = world.createBody(secondDefinition);
 * world.createShape(secondId, new Experimental.ShapeDefinition2D(), Experimental.Polygon2D.makeBox(0.5, 0.5));
 * const jointDefinition = new Experimental.WeldJointDefinition2D();
 * jointDefinition.bodyIdA = firstId;
 * jointDefinition.bodyIdB = secondId;
 * jointDefinition.localAnchorA = Vector2.create(0.5, 0);
 * jointDefinition.localAnchorB = Vector2.create(-0.5, 0);
 * world.createWeldJoint(jointDefinition);
 * for (let index = 0; index < 60; ++index) {
 * 	world.step(1 / 60, 4);
 * }
 * console.log(world.getBody(secondId).getPosition().y.toFixed(3));
 */
export class WeldJointDefinition2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { BodyId2D | null } */ bodyIdA; // 첫 몸.
	/** @type { BodyId2D | null } */ bodyIdB; // 둘째 몸.
	/** @type { Vector2 } */ localAnchorA; // 첫 몸 기준 닻.
	/** @type { Vector2 } */ localAnchorB; // 둘째 몸 기준 닻.
	/** @type { number } */ referenceAngle; // 묶을 때 B 와 A 의 돌림 차이. (라디안)
	/** @type { number } */ linearHertz; // 자리 용수철 진동수. (0 이면 단단함)
	/** @type { number } */ linearDampingRatio; // 자리 용수철 감쇠비.
	/** @type { number } */ angularHertz; // 각도 용수철 진동수. (0 이면 단단함)
	/** @type { number } */ angularDampingRatio; // 각도 용수철 감쇠비.
	/** @type { boolean } */ collideConnected; // 두 몸끼리 부딪힐지. (기본 거짓)
	/** @type { any } */ userData; // 사용자 값.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.bodyIdA = null;
		this.bodyIdB = null;
		this.localAnchorA = Vector2.zero();
		this.localAnchorB = Vector2.zero();
		this.referenceAngle = 0;
		this.linearHertz = 0;
		this.linearDampingRatio = 0;
		this.angularHertz = 0;
		this.angularDampingRatio = 0;
		this.collideConnected = false;
		this.userData = null;
	}
}


//==============================================================================
// 바퀴 관절 정의.
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - B 의 닻이 A 의 축(localAxisA) 위에만 있고 축을 따라 용수철로 오르내린다. B 는 자유롭게 돌고 모터로 돌릴 수 있다.
//==============================================================================
/**
 * @example <caption>수레 바퀴</caption>
 * import { Vector2 } from "./import.js";
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const jointDefinition = new Experimental.WheelJointDefinition2D();
 * jointDefinition.localAxisA = Vector2.create(0, 1);
 * jointDefinition.hertz = 4;
 * jointDefinition.dampingRatio = 0.7;
 * jointDefinition.enableMotor = true;
 * jointDefinition.motorSpeed = 10;
 * jointDefinition.maxMotorTorque = 50;
 * console.log(jointDefinition.enableSpring, jointDefinition.hertz);
 */
export class WheelJointDefinition2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { BodyId2D | null } */ bodyIdA; // 차체 몸.
	/** @type { BodyId2D | null } */ bodyIdB; // 바퀴 몸.
	/** @type { Vector2 } */ localAnchorA; // 차체 기준 닻.
	/** @type { Vector2 } */ localAnchorB; // 바퀴 기준 닻.
	/** @type { Vector2 } */ localAxisA; // 차체 기준 오르내림 축. (단위 길이로 맞춘다)
	/** @type { boolean } */ enableSpring; // 축 용수철을 쓸지. (기본 참)
	/** @type { number } */ hertz; // 용수철 진동수. (기본 1)
	/** @type { number } */ dampingRatio; // 용수철 감쇠비. (기본 0.7)
	/** @type { boolean } */ enableMotor; // 모터를 쓸지.
	/** @type { number } */ maxMotorTorque; // 모터의 가장 큰 돌림힘.
	/** @type { number } */ motorSpeed; // 모터 각속도. (초당 라디안)
	/** @type { boolean } */ enableLimit; // 축 위 자리 한도를 쓸지.
	/** @type { number } */ lowerTranslation; // 가장 작은 축 위 자리.
	/** @type { number } */ upperTranslation; // 가장 큰 축 위 자리.
	/** @type { boolean } */ collideConnected; // 두 몸끼리 부딪힐지. (기본 거짓)
	/** @type { any } */ userData; // 사용자 값.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.bodyIdA = null;
		this.bodyIdB = null;
		this.localAnchorA = Vector2.zero();
		this.localAnchorB = Vector2.zero();
		this.localAxisA = Vector2.create(0, 1);
		this.enableSpring = true;
		this.hertz = 1;
		this.dampingRatio = 0.7;
		this.enableMotor = false;
		this.maxMotorTorque = 0;
		this.motorSpeed = 0;
		this.enableLimit = false;
		this.lowerTranslation = 0;
		this.upperTranslation = 0;
		this.collideConnected = false;
		this.userData = null;
	}
}


//==============================================================================
// 관절 자료. (월드가 셈에 쓰는 값, 종류에 쓰지 않는 칸은 0, 안에서 쓴다)
//==============================================================================
export class JointData extends Object {
	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.id = null;
		this.type = JointType2D.distance;
		this.bodyIndexA = -1;
		this.bodyIndexB = -1;
		this.bodyIdA = null;
		this.bodyIdB = null;
		this.localAnchorAX = 0;
		this.localAnchorAY = 0;
		this.localAnchorBX = 0;
		this.localAnchorBY = 0;
		this.referenceAngle = 0;
		this.collideConnected = false;
		this.userData = null;
		this.isWakeRequested = false;
		// 설정.
		this.length = 1;
		this.minLength = 0;
		this.maxLength = HUGE_LENGTH;
		this.enableSpring = false;
		this.hertz = 0;
		this.dampingRatio = 0;
		this.enableMotor = false;
		this.maxMotorTorque = 0;
		this.motorSpeed = 0;
		this.enableLimit = false;
		this.lowerLimit = 0;
		this.upperLimit = 0;
		this.linearHertz = 0;
		this.linearDampingRatio = 0;
		this.angularHertz = 0;
		this.angularDampingRatio = 0;
		this.localAxisAX = 0;
		this.localAxisAY = 1;
		// 쌓인 충격.
		this.linearImpulseX = 0;
		this.linearImpulseY = 0;
		this.angularImpulse = 0;
		this.axialImpulse = 0;
		this.springImpulse = 0;
		this.motorImpulse = 0;
		this.lowerImpulse = 0;
		this.upperImpulse = 0;
		this.perpendicularImpulse = 0;
		// 풀이 준비 값.
		this.solverIndexA = -1;
		this.solverIndexB = -1;
		this.inverseMassA = 0;
		this.inverseMassB = 0;
		this.inverseInertiaA = 0;
		this.inverseInertiaB = 0;
		this.frameAX = 0;
		this.frameAY = 0;
		this.frameBX = 0;
		this.frameBY = 0;
		this.deltaCenterX = 0;
		this.deltaCenterY = 0;
		this.deltaAngle = 0;
		this.axisAX = 0;
		this.axisAY = 0;
		this.axialMass = 0;
		this.perpendicularMass = 0;
		this.motorMass = 0;
		this.springSoftness = new Softness();
		this.linearSoftness = new Softness();
		this.angularSoftness = new Softness();
		this.distanceSoftness = new Softness();
	}
}


//==============================================================================
// 관절. (두 몸을 잇는 구속 하나)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - PhysicsWorld2D.createDistanceJoint 같은 함수로 만들고 getJoint(jointId) 로 얻는다. 직접 만들지 않는다.
// - 설정을 바꾸면 다음 걸음 앞에서 두 몸을 깨운다.
//==============================================================================
/**
 * @example <caption>모터 속도 바꾸기</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const world = new Experimental.PhysicsWorld2D(new Experimental.WorldDefinition2D(1));
 * const groundId = world.createBody(new Experimental.BodyDefinition2D());
 * const bodyDefinition = new Experimental.BodyDefinition2D();
 * bodyDefinition.type = Experimental.BodyType2D.dynamic;
 * const bodyId = world.createBody(bodyDefinition);
 * const jointDefinition = new Experimental.RevoluteJointDefinition2D();
 * jointDefinition.bodyIdA = groundId;
 * jointDefinition.bodyIdB = bodyId;
 * const joint = world.getJoint(world.createRevoluteJoint(jointDefinition));
 * joint.setMotorEnabled(true);
 * joint.setMaxMotorTorque(10);
 * joint.setMotorSpeed(-1.5);
 * console.log(joint.isMotorEnabled(), joint.getMotorSpeed());
 */
export class Joint2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { JointData } */ #data;

	//==============================================================================
	// 생성. (월드가 만든다)
	//==============================================================================
	/**
	 * @constructor
	 * @param { JointData } data 관절 자료.
	 */
	constructor(data) {
		super();
		this.#data = data;
	}

	//==============================================================================
	// 관절 자료 반환. (안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @returns { JointData }
	 */
	getData() {
		return this.#data;
	}

	//==============================================================================
	// 아이디 반환.
	//==============================================================================
	/**
	 * @returns { JointId2D } 이 관절의 아이디.
	 */
	getId() {
		const data = this.getData();
		return data.id;
	}

	//==============================================================================
	// 종류 반환.
	//==============================================================================
	/**
	 * @returns { number } JointType2D 값.
	 */
	getType() {
		const data = this.getData();
		return data.type;
	}

	//==============================================================================
	// 첫 몸 아이디 반환.
	//==============================================================================
	/**
	 * @returns { BodyId2D } 첫 몸 아이디.
	 */
	getBodyIdA() {
		const data = this.getData();
		return data.bodyIdA;
	}

	//==============================================================================
	// 둘째 몸 아이디 반환.
	//==============================================================================
	/**
	 * @returns { BodyId2D } 둘째 몸 아이디.
	 */
	getBodyIdB() {
		const data = this.getData();
		return data.bodyIdB;
	}

	//==============================================================================
	// 첫 몸 기준 닻 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 첫 몸 기준 닻.
	 */
	getLocalAnchorA() {
		const data = this.getData();
		return Vector2.create(data.localAnchorAX, data.localAnchorAY);
	}

	//==============================================================================
	// 둘째 몸 기준 닻 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 둘째 몸 기준 닻.
	 */
	getLocalAnchorB() {
		const data = this.getData();
		return Vector2.create(data.localAnchorBX, data.localAnchorBY);
	}

	//==============================================================================
	// 쉬는 길이 설정. (거리 관절)
	//==============================================================================
	/**
	 * @param { number } length 쉬는 길이.
	 */
	setLength(length) {
		const data = this.getData();
		data.length = System.Math.max(0, length);
		data.isWakeRequested = true;
	}

	//==============================================================================
	// 쉬는 길이 반환. (거리 관절)
	//==============================================================================
	/**
	 * @returns { number } 쉬는 길이.
	 */
	getLength() {
		const data = this.getData();
		return data.length;
	}

	//==============================================================================
	// 용수철을 쓸지 설정. (거리, 회전, 바퀴 관절)
	//==============================================================================
	/**
	 * @param { boolean } enableSpring 용수철을 쓸지.
	 */
	setSpringEnabled(enableSpring) {
		const data = this.getData();
		data.enableSpring = enableSpring;
		data.isWakeRequested = true;
	}

	//==============================================================================
	// 용수철을 쓰는지.
	//==============================================================================
	/**
	 * @returns { boolean } 용수철을 쓰면 참.
	 */
	isSpringEnabled() {
		const data = this.getData();
		return data.enableSpring;
	}

	//==============================================================================
	// 용수철 진동수 설정. (헤르츠)
	//==============================================================================
	/**
	 * @param { number } hertz 진동수.
	 */
	setSpringHertz(hertz) {
		const data = this.getData();
		data.hertz = System.Math.max(0, hertz);
		data.isWakeRequested = true;
	}

	//==============================================================================
	// 용수철 감쇠비 설정.
	//==============================================================================
	/**
	 * @param { number } dampingRatio 감쇠비.
	 */
	setSpringDampingRatio(dampingRatio) {
		const data = this.getData();
		data.dampingRatio = System.Math.max(0, dampingRatio);
		data.isWakeRequested = true;
	}

	//==============================================================================
	// 모터를 쓸지 설정. (회전, 바퀴 관절)
	//==============================================================================
	/**
	 * @param { boolean } enableMotor 모터를 쓸지.
	 */
	setMotorEnabled(enableMotor) {
		const data = this.getData();
		data.enableMotor = enableMotor;
		data.isWakeRequested = true;
	}

	//==============================================================================
	// 모터를 쓰는지.
	//==============================================================================
	/**
	 * @returns { boolean } 모터를 쓰면 참.
	 */
	isMotorEnabled() {
		const data = this.getData();
		return data.enableMotor;
	}

	//==============================================================================
	// 모터 각속도 설정. (초당 라디안)
	//==============================================================================
	/**
	 * @param { number } motorSpeed 모터 각속도.
	 */
	setMotorSpeed(motorSpeed) {
		const data = this.getData();
		data.motorSpeed = motorSpeed;
		data.isWakeRequested = true;
	}

	//==============================================================================
	// 모터 각속도 반환.
	//==============================================================================
	/**
	 * @returns { number } 모터 각속도.
	 */
	getMotorSpeed() {
		const data = this.getData();
		return data.motorSpeed;
	}

	//==============================================================================
	// 모터의 가장 큰 돌림힘 설정.
	//==============================================================================
	/**
	 * @param { number } maxMotorTorque 가장 큰 돌림힘.
	 */
	setMaxMotorTorque(maxMotorTorque) {
		const data = this.getData();
		data.maxMotorTorque = System.Math.max(0, maxMotorTorque);
		data.isWakeRequested = true;
	}

	//==============================================================================
	// 지난 걸음의 모터 돌림힘 반환. (모터 충격 / 걸음 시간)
	//==============================================================================
	/**
	 * @param { number } inverseTimeStep 1 / 걸음 시간.
	 * @returns { number } 모터 돌림힘.
	 */
	getMotorTorque(inverseTimeStep) {
		const data = this.getData();
		return inverseTimeStep * data.motorImpulse;
	}

	//==============================================================================
	// 한도를 쓸지 설정. (거리, 회전, 바퀴 관절)
	//==============================================================================
	/**
	 * @param { boolean } enableLimit 한도를 쓸지.
	 */
	setLimitEnabled(enableLimit) {
		const data = this.getData();
		data.enableLimit = enableLimit;
		data.isWakeRequested = true;
	}

	//==============================================================================
	// 한도를 쓰는지.
	//==============================================================================
	/**
	 * @returns { boolean } 한도를 쓰면 참.
	 */
	isLimitEnabled() {
		const data = this.getData();
		return data.enableLimit;
	}

	//==============================================================================
	// 한도 설정. (거리 관절은 길이, 회전 관절은 각도(라디안), 바퀴 관절은 축 위 자리)
	//==============================================================================
	/**
	 * @param { number } lower 아래 한도.
	 * @param { number } upper 위 한도. (lower 보다 작으면 둘을 바꾼다)
	 */
	setLimits(lower, upper) {
		const data = this.getData();
		const minimum = System.Math.min(lower, upper);
		const maximum = System.Math.max(lower, upper);
		if (data.type === JointType2D.distance) {
			data.minLength = System.Math.max(0, minimum);
			data.maxLength = maximum;
		}
		else {
			data.lowerLimit = minimum;
			data.upperLimit = maximum;
		}
		data.isWakeRequested = true;
	}

	//==============================================================================
	// 아래 한도 반환.
	//==============================================================================
	/**
	 * @returns { number } 아래 한도.
	 */
	getLowerLimit() {
		const data = this.getData();
		if (data.type === JointType2D.distance) {
			return data.minLength;
		}
		return data.lowerLimit;
	}

	//==============================================================================
	// 위 한도 반환.
	//==============================================================================
	/**
	 * @returns { number } 위 한도.
	 */
	getUpperLimit() {
		const data = this.getData();
		if (data.type === JointType2D.distance) {
			return data.maxLength;
		}
		return data.upperLimit;
	}

	//==============================================================================
	// 용접의 자리 용수철 설정. (헤르츠가 0 이면 단단함)
	//==============================================================================
	/**
	 * @param { number } hertz 진동수.
	 * @param { number } dampingRatio 감쇠비.
	 */
	setLinearSpring(hertz, dampingRatio) {
		const data = this.getData();
		data.linearHertz = System.Math.max(0, hertz);
		data.linearDampingRatio = System.Math.max(0, dampingRatio);
		data.isWakeRequested = true;
	}

	//==============================================================================
	// 용접의 각도 용수철 설정. (헤르츠가 0 이면 단단함)
	//==============================================================================
	/**
	 * @param { number } hertz 진동수.
	 * @param { number } dampingRatio 감쇠비.
	 */
	setAngularSpring(hertz, dampingRatio) {
		const data = this.getData();
		data.angularHertz = System.Math.max(0, hertz);
		data.angularDampingRatio = System.Math.max(0, dampingRatio);
		data.isWakeRequested = true;
	}

	//==============================================================================
	// 사용자 값 설정.
	//==============================================================================
	/**
	 * @param { any } userData 사용자 값.
	 */
	setUserData(userData) {
		const data = this.getData();
		data.userData = userData;
	}

	//==============================================================================
	// 사용자 값 반환.
	//==============================================================================
	/**
	 * @returns { any } 사용자 값.
	 */
	getUserData() {
		const data = this.getData();
		return data.userData;
	}
}

//==============================================================================
// B 회전과 A 회전 사이 각도. (결정론 아크탄젠트)
//==============================================================================
/**
 * @param { number } cosineB
 * @param { number } sineB
 * @param { number } cosineA
 * @param { number } sineA
 * @returns { number }
 */
export function computeRelativeAngle(cosineB, sineB, cosineA, sineA) {
	const sine = sineB * cosineA - cosineB * sineA;
	const cosine = cosineB * cosineA + sineB * sineA;
	return PhysicsMath2D.computeAtan2(sine, cosine);
}

//==============================================================================
// 2x2 대칭 행렬 풀기. ([x, y])
//==============================================================================
/**
 * @param { number } a11
 * @param { number } a12
 * @param { number } a22
 * @param { number } bx
 * @param { number } by
 * @returns { number[] }
 */
function solveSymmetric22(a11, a12, a22, bx, by) {
	let determinant = a11 * a22 - a12 * a12;
	if (determinant !== 0) {
		determinant = 1 / determinant;
	}
	return [determinant * (a22 * bx - a12 * by), determinant * (a11 * by - a12 * bx)];
}

//==============================================================================
// 관절 풀이 준비.
//==============================================================================
/**
 * @param { JointData } joint
 * @param { object } bodyDataA BodyData.
 * @param { object } bodyDataB BodyData.
 * @param { object[] } solverBodyList SolverBody[].
 * @param { object } context StepContext.
 */
export function prepareJoint(joint, bodyDataA, bodyDataB, solverBodyList, context) {
	joint.solverIndexA = bodyDataA.solverIndex;
	joint.solverIndexB = bodyDataB.solverIndex;
	const solverBodyA = joint.solverIndexA >= 0 ? solverBodyList[joint.solverIndexA] : STATIC_SOLVER_BODY;
	const solverBodyB = joint.solverIndexB >= 0 ? solverBodyList[joint.solverIndexB] : STATIC_SOLVER_BODY;
	const inverseMassA = solverBodyA.inverseMass;
	const inverseMassB = solverBodyB.inverseMass;
	const inverseInertiaA = solverBodyA.inverseInertia;
	const inverseInertiaB = solverBodyB.inverseInertia;
	joint.inverseMassA = inverseMassA;
	joint.inverseMassB = inverseMassB;
	joint.inverseInertiaA = inverseInertiaA;
	joint.inverseInertiaB = inverseInertiaB;

	// 닻. (질량 중심 기준, 월드 방향)
	const localOffsetAX = joint.localAnchorAX - bodyDataA.localCenterX;
	const localOffsetAY = joint.localAnchorAY - bodyDataA.localCenterY;
	const localOffsetBX = joint.localAnchorBX - bodyDataB.localCenterX;
	const localOffsetBY = joint.localAnchorBY - bodyDataB.localCenterY;
	joint.frameAX = bodyDataA.rotationCosine * localOffsetAX - bodyDataA.rotationSine * localOffsetAY;
	joint.frameAY = bodyDataA.rotationSine * localOffsetAX + bodyDataA.rotationCosine * localOffsetAY;
	joint.frameBX = bodyDataB.rotationCosine * localOffsetBX - bodyDataB.rotationSine * localOffsetBY;
	joint.frameBY = bodyDataB.rotationSine * localOffsetBX + bodyDataB.rotationCosine * localOffsetBY;
	joint.deltaCenterX = bodyDataB.centerX - bodyDataA.centerX;
	joint.deltaCenterY = bodyDataB.centerY - bodyDataA.centerY;
	const relativeAngle = computeRelativeAngle(bodyDataB.rotationCosine, bodyDataB.rotationSine, bodyDataA.rotationCosine, bodyDataA.rotationSine);
	joint.deltaAngle = PhysicsMath2D.unwindAngle(relativeAngle - joint.referenceAngle);
	const angularMassInverse = inverseInertiaA + inverseInertiaB;
	const subStepTime = context.subStepTime;

	if (joint.type === JointType2D.distance) {
		const separationX = joint.frameBX - joint.frameAX + joint.deltaCenterX;
		const separationY = joint.frameBY - joint.frameAY + joint.deltaCenterY;
		const separationLength = System.Math.sqrt(separationX * separationX + separationY * separationY);
		let axisX = 0;
		let axisY = 0;
		if (separationLength > 0) {
			axisX = separationX / separationLength;
			axisY = separationY / separationLength;
		}
		const crossA = joint.frameAX * axisY - joint.frameAY * axisX;
		const crossB = joint.frameBX * axisY - joint.frameBY * axisX;
		const massInverse = inverseMassA + inverseMassB + inverseInertiaA * crossA * crossA + inverseInertiaB * crossB * crossB;
		joint.axialMass = massInverse > 0 ? 1 / massInverse : 0;
		joint.distanceSoftness = makeSoftness(2 * context.contactHertz, context.jointDampingRatio, subStepTime);
		joint.springSoftness = makeSoftness(joint.hertz, joint.dampingRatio, subStepTime);
	}
	else if (joint.type === JointType2D.revolute) {
		joint.axialMass = angularMassInverse > 0 ? 1 / angularMassInverse : 0;
		joint.springSoftness = makeSoftness(joint.hertz, joint.dampingRatio, subStepTime);
	}
	else if (joint.type === JointType2D.weld) {
		joint.axialMass = angularMassInverse > 0 ? 1 / angularMassInverse : 0;
		joint.linearSoftness = joint.linearHertz === 0 ? context.jointSoftness : makeSoftness(joint.linearHertz, joint.linearDampingRatio, subStepTime);
		joint.angularSoftness = joint.angularHertz === 0 ? context.jointSoftness : makeSoftness(joint.angularHertz, joint.angularDampingRatio, subStepTime);
	}
	else {
		joint.axisAX = bodyDataA.rotationCosine * joint.localAxisAX - bodyDataA.rotationSine * joint.localAxisAY;
		joint.axisAY = bodyDataA.rotationSine * joint.localAxisAX + bodyDataA.rotationCosine * joint.localAxisAY;
		const offsetX = joint.deltaCenterX + joint.frameBX - joint.frameAX;
		const offsetY = joint.deltaCenterY + joint.frameBY - joint.frameAY;
		const perpendicularX = -joint.axisAY;
		const perpendicularY = joint.axisAX;
		const perpendicularCrossA = (offsetX + joint.frameAX) * perpendicularY - (offsetY + joint.frameAY) * perpendicularX;
		const perpendicularCrossB = joint.frameBX * perpendicularY - joint.frameBY * perpendicularX;
		const perpendicularMassInverse = inverseMassA + inverseMassB + inverseInertiaA * perpendicularCrossA * perpendicularCrossA + inverseInertiaB * perpendicularCrossB * perpendicularCrossB;
		joint.perpendicularMass = perpendicularMassInverse > 0 ? 1 / perpendicularMassInverse : 0;
		const axialCrossA = (offsetX + joint.frameAX) * joint.axisAY - (offsetY + joint.frameAY) * joint.axisAX;
		const axialCrossB = joint.frameBX * joint.axisAY - joint.frameBY * joint.axisAX;
		const axialMassInverse = inverseMassA + inverseMassB + inverseInertiaA * axialCrossA * axialCrossA + inverseInertiaB * axialCrossB * axialCrossB;
		joint.axialMass = axialMassInverse > 0 ? 1 / axialMassInverse : 0;
		joint.motorMass = angularMassInverse > 0 ? 1 / angularMassInverse : 0;
		joint.springSoftness = makeSoftness(joint.hertz, joint.dampingRatio, subStepTime);
	}
}

//==============================================================================
// 관절 웜 스타트.
//==============================================================================
/**
 * @param { JointData } joint
 * @param { object[] } solverBodyList SolverBody[].
 */
export function warmStartJoint(joint, solverBodyList) {
	const solverBodyA = joint.solverIndexA >= 0 ? solverBodyList[joint.solverIndexA] : STATIC_SOLVER_BODY;
	const solverBodyB = joint.solverIndexB >= 0 ? solverBodyList[joint.solverIndexB] : STATIC_SOLVER_BODY;
	const inverseMassA = joint.inverseMassA;
	const inverseMassB = joint.inverseMassB;
	const inverseInertiaA = joint.inverseInertiaA;
	const inverseInertiaB = joint.inverseInertiaB;
	const anchorAX = solverBodyA.deltaRotationCosine * joint.frameAX - solverBodyA.deltaRotationSine * joint.frameAY;
	const anchorAY = solverBodyA.deltaRotationSine * joint.frameAX + solverBodyA.deltaRotationCosine * joint.frameAY;
	const anchorBX = solverBodyB.deltaRotationCosine * joint.frameBX - solverBodyB.deltaRotationSine * joint.frameBY;
	const anchorBY = solverBodyB.deltaRotationSine * joint.frameBX + solverBodyB.deltaRotationCosine * joint.frameBY;
	let impulseX = 0;
	let impulseY = 0;
	let angularImpulseA = 0;
	let angularImpulseB = 0;

	if (joint.type === JointType2D.distance) {
		const separationX = solverBodyB.deltaPositionX - solverBodyA.deltaPositionX + joint.deltaCenterX + anchorBX - anchorAX;
		const separationY = solverBodyB.deltaPositionY - solverBodyA.deltaPositionY + joint.deltaCenterY + anchorBY - anchorAY;
		const separationLength = System.Math.sqrt(separationX * separationX + separationY * separationY);
		let axisX = 0;
		let axisY = 0;
		if (separationLength > 0) {
			axisX = separationX / separationLength;
			axisY = separationY / separationLength;
		}
		const axialImpulse = joint.axialImpulse + joint.lowerImpulse - joint.upperImpulse;
		impulseX = axialImpulse * axisX;
		impulseY = axialImpulse * axisY;
		angularImpulseA = anchorAX * impulseY - anchorAY * impulseX;
		angularImpulseB = anchorBX * impulseY - anchorBY * impulseX;
	}
	else if (joint.type === JointType2D.revolute) {
		const axialImpulse = joint.springImpulse + joint.motorImpulse + joint.lowerImpulse - joint.upperImpulse;
		impulseX = joint.linearImpulseX;
		impulseY = joint.linearImpulseY;
		angularImpulseA = anchorAX * impulseY - anchorAY * impulseX + axialImpulse;
		angularImpulseB = anchorBX * impulseY - anchorBY * impulseX + axialImpulse;
	}
	else if (joint.type === JointType2D.weld) {
		impulseX = joint.linearImpulseX;
		impulseY = joint.linearImpulseY;
		angularImpulseA = anchorAX * impulseY - anchorAY * impulseX + joint.angularImpulse;
		angularImpulseB = anchorBX * impulseY - anchorBY * impulseX + joint.angularImpulse;
	}
	else {
		const offsetX = solverBodyB.deltaPositionX - solverBodyA.deltaPositionX + joint.deltaCenterX + anchorBX - anchorAX;
		const offsetY = solverBodyB.deltaPositionY - solverBodyA.deltaPositionY + joint.deltaCenterY + anchorBY - anchorAY;
		const axisX = solverBodyA.deltaRotationCosine * joint.axisAX - solverBodyA.deltaRotationSine * joint.axisAY;
		const axisY = solverBodyA.deltaRotationSine * joint.axisAX + solverBodyA.deltaRotationCosine * joint.axisAY;
		const perpendicularX = -axisY;
		const perpendicularY = axisX;
		const axialCrossA = (offsetX + anchorAX) * axisY - (offsetY + anchorAY) * axisX;
		const axialCrossB = anchorBX * axisY - anchorBY * axisX;
		const perpendicularCrossA = (offsetX + anchorAX) * perpendicularY - (offsetY + anchorAY) * perpendicularX;
		const perpendicularCrossB = anchorBX * perpendicularY - anchorBY * perpendicularX;
		const axialImpulse = joint.springImpulse + joint.lowerImpulse - joint.upperImpulse;
		impulseX = axialImpulse * axisX + joint.perpendicularImpulse * perpendicularX;
		impulseY = axialImpulse * axisY + joint.perpendicularImpulse * perpendicularY;
		angularImpulseA = axialImpulse * axialCrossA + joint.perpendicularImpulse * perpendicularCrossA + joint.motorImpulse;
		angularImpulseB = axialImpulse * axialCrossB + joint.perpendicularImpulse * perpendicularCrossB + joint.motorImpulse;
	}

	if (joint.solverIndexA >= 0) {
		solverBodyA.linearVelocityX -= inverseMassA * impulseX;
		solverBodyA.linearVelocityY -= inverseMassA * impulseY;
		solverBodyA.angularVelocity -= inverseInertiaA * angularImpulseA;
	}
	if (joint.solverIndexB >= 0) {
		solverBodyB.linearVelocityX += inverseMassB * impulseX;
		solverBodyB.linearVelocityY += inverseMassB * impulseY;
		solverBodyB.angularVelocity += inverseInertiaB * angularImpulseB;
	}
}

//==============================================================================
// 관절 풀기. (useBias 면 어긋남을 부드럽게 바로잡고, 아니면 속도만 맞춘다)
//==============================================================================
/**
 * @param { JointData } joint
 * @param { object[] } solverBodyList SolverBody[].
 * @param { object } context StepContext.
 * @param { boolean } useBias
 */
export function solveJoint(joint, solverBodyList, context, useBias) {
	const solverBodyA = joint.solverIndexA >= 0 ? solverBodyList[joint.solverIndexA] : STATIC_SOLVER_BODY;
	const solverBodyB = joint.solverIndexB >= 0 ? solverBodyList[joint.solverIndexB] : STATIC_SOLVER_BODY;
	const inverseMassA = joint.inverseMassA;
	const inverseMassB = joint.inverseMassB;
	const inverseInertiaA = joint.inverseInertiaA;
	const inverseInertiaB = joint.inverseInertiaB;
	let velocityAX = solverBodyA.linearVelocityX;
	let velocityAY = solverBodyA.linearVelocityY;
	let angularVelocityA = solverBodyA.angularVelocity;
	let velocityBX = solverBodyB.linearVelocityX;
	let velocityBY = solverBodyB.linearVelocityY;
	let angularVelocityB = solverBodyB.angularVelocity;
	const anchorAX = solverBodyA.deltaRotationCosine * joint.frameAX - solverBodyA.deltaRotationSine * joint.frameAY;
	const anchorAY = solverBodyA.deltaRotationSine * joint.frameAX + solverBodyA.deltaRotationCosine * joint.frameAY;
	const anchorBX = solverBodyB.deltaRotationCosine * joint.frameBX - solverBodyB.deltaRotationSine * joint.frameBY;
	const anchorBY = solverBodyB.deltaRotationSine * joint.frameBX + solverBodyB.deltaRotationCosine * joint.frameBY;
	const deltaPositionX = solverBodyB.deltaPositionX - solverBodyA.deltaPositionX;
	const deltaPositionY = solverBodyB.deltaPositionY - solverBodyA.deltaPositionY;
	const isFixedRotation = inverseInertiaA + inverseInertiaB === 0;
	const jointSoftness = context.jointSoftness;
	const inverseSubStepTime = context.inverseSubStepTime;
	const subStepTime = context.subStepTime;

	if (joint.type === JointType2D.distance) {
		const separationX = deltaPositionX + joint.deltaCenterX + anchorBX - anchorAX;
		const separationY = deltaPositionY + joint.deltaCenterY + anchorBY - anchorAY;
		const length = System.Math.sqrt(separationX * separationX + separationY * separationY);
		let axisX = 0;
		let axisY = 0;
		if (length > 0) {
			axisX = separationX / length;
			axisY = separationY / length;
		}
		const crossA = anchorAX * axisY - anchorAY * axisX;
		const crossB = anchorBX * axisY - anchorBY * axisX;
		const axialMass = joint.axialMass;
		const isSoft = joint.enableSpring && (joint.minLength < joint.maxLength || !joint.enableLimit);
		if (isSoft) {
			if (joint.hertz > 0) {
				const relativeVelocityX = velocityBX - angularVelocityB * anchorBY - velocityAX + angularVelocityA * anchorAY;
				const relativeVelocityY = velocityBY + angularVelocityB * anchorBX - velocityAY - angularVelocityA * anchorAX;
				const speed = axisX * relativeVelocityX + axisY * relativeVelocityY;
				const springSoftness = joint.springSoftness;
				const bias = springSoftness.biasRate * (length - joint.length);
				const impulse = -springSoftness.massScale * axialMass * (speed + bias) - springSoftness.impulseScale * joint.axialImpulse;
				joint.axialImpulse += impulse;
				velocityAX -= inverseMassA * impulse * axisX;
				velocityAY -= inverseMassA * impulse * axisY;
				angularVelocityA -= inverseInertiaA * impulse * crossA;
				velocityBX += inverseMassB * impulse * axisX;
				velocityBY += inverseMassB * impulse * axisY;
				angularVelocityB += inverseInertiaB * impulse * crossB;
			}
			if (joint.enableLimit) {
				for (let side = 0; side < 2; ++side) {
					const sign = side === 0 ? 1 : -1;
					const constraint = side === 0 ? length - joint.minLength : joint.maxLength - length;
					let bias = 0;
					let massScale = 1;
					let impulseScale = 0;
					if (constraint > 0) {
						bias = constraint * inverseSubStepTime;
					}
					else if (useBias) {
						bias = jointSoftness.biasRate * constraint;
						massScale = jointSoftness.massScale;
						impulseScale = jointSoftness.impulseScale;
					}
					const relativeVelocityX = velocityBX - angularVelocityB * anchorBY - velocityAX + angularVelocityA * anchorAY;
					const relativeVelocityY = velocityBY + angularVelocityB * anchorBX - velocityAY - angularVelocityA * anchorAX;
					const speed = sign * (axisX * relativeVelocityX + axisY * relativeVelocityY);
					const oldImpulse = side === 0 ? joint.lowerImpulse : joint.upperImpulse;
					let impulse = -massScale * axialMass * (speed + bias) - impulseScale * oldImpulse;
					const newImpulse = System.Math.max(oldImpulse + impulse, 0);
					impulse = newImpulse - oldImpulse;
					if (side === 0) {
						joint.lowerImpulse = newImpulse;
					}
					else {
						joint.upperImpulse = newImpulse;
					}
					const appliedImpulse = sign * impulse;
					velocityAX -= inverseMassA * appliedImpulse * axisX;
					velocityAY -= inverseMassA * appliedImpulse * axisY;
					angularVelocityA -= inverseInertiaA * appliedImpulse * crossA;
					velocityBX += inverseMassB * appliedImpulse * axisX;
					velocityBY += inverseMassB * appliedImpulse * axisY;
					angularVelocityB += inverseInertiaB * appliedImpulse * crossB;
				}
			}
		}
		else {
			const relativeVelocityX = velocityBX - angularVelocityB * anchorBY - velocityAX + angularVelocityA * anchorAY;
			const relativeVelocityY = velocityBY + angularVelocityB * anchorBX - velocityAY - angularVelocityA * anchorAX;
			const speed = axisX * relativeVelocityX + axisY * relativeVelocityY;
			let bias = 0;
			let massScale = 1;
			let impulseScale = 0;
			if (useBias) {
				const distanceSoftness = joint.distanceSoftness;
				bias = distanceSoftness.biasRate * (length - joint.length);
				massScale = distanceSoftness.massScale;
				impulseScale = distanceSoftness.impulseScale;
			}
			const impulse = -massScale * axialMass * (speed + bias) - impulseScale * joint.axialImpulse;
			joint.axialImpulse += impulse;
			velocityAX -= inverseMassA * impulse * axisX;
			velocityAY -= inverseMassA * impulse * axisY;
			angularVelocityA -= inverseInertiaA * impulse * crossA;
			velocityBX += inverseMassB * impulse * axisX;
			velocityBY += inverseMassB * impulse * axisY;
			angularVelocityB += inverseInertiaB * impulse * crossB;
		}
	}
	else if (joint.type === JointType2D.revolute || joint.type === JointType2D.weld) {
		const relativeAngle = computeRelativeAngle(solverBodyB.deltaRotationCosine, solverBodyB.deltaRotationSine, solverBodyA.deltaRotationCosine, solverBodyA.deltaRotationSine);
		if (joint.type === JointType2D.revolute) {
			// 각도 용수철.
			if (joint.enableSpring && !isFixedRotation) {
				const springSoftness = joint.springSoftness;
				const angle = relativeAngle + joint.deltaAngle;
				const bias = springSoftness.biasRate * angle;
				const angularSpeed = angularVelocityB - angularVelocityA;
				const impulse = -springSoftness.massScale * joint.axialMass * (angularSpeed + bias) - springSoftness.impulseScale * joint.springImpulse;
				joint.springImpulse += impulse;
				angularVelocityA -= inverseInertiaA * impulse;
				angularVelocityB += inverseInertiaB * impulse;
			}
			// 모터.
			if (joint.enableMotor && !isFixedRotation) {
				const angularSpeed = angularVelocityB - angularVelocityA - joint.motorSpeed;
				let impulse = -joint.axialMass * angularSpeed;
				const oldImpulse = joint.motorImpulse;
				const maximumImpulse = subStepTime * joint.maxMotorTorque;
				joint.motorImpulse = System.Math.max(-maximumImpulse, System.Math.min(oldImpulse + impulse, maximumImpulse));
				impulse = joint.motorImpulse - oldImpulse;
				angularVelocityA -= inverseInertiaA * impulse;
				angularVelocityB += inverseInertiaB * impulse;
			}
			// 각도 한도.
			if (joint.enableLimit && !isFixedRotation) {
				const jointAngle = PhysicsMath2D.unwindAngle(joint.deltaAngle + relativeAngle);
				for (let side = 0; side < 2; ++side) {
					const sign = side === 0 ? 1 : -1;
					const constraint = side === 0 ? jointAngle - joint.lowerLimit : joint.upperLimit - jointAngle;
					let bias = 0;
					let massScale = 1;
					let impulseScale = 0;
					if (constraint > 0) {
						bias = constraint * inverseSubStepTime;
					}
					else if (useBias) {
						bias = jointSoftness.biasRate * constraint;
						massScale = jointSoftness.massScale;
						impulseScale = jointSoftness.impulseScale;
					}
					const angularSpeed = sign * (angularVelocityB - angularVelocityA);
					const oldImpulse = side === 0 ? joint.lowerImpulse : joint.upperImpulse;
					let impulse = -joint.axialMass * massScale * (angularSpeed + bias) - impulseScale * oldImpulse;
					const newImpulse = System.Math.max(oldImpulse + impulse, 0);
					impulse = newImpulse - oldImpulse;
					if (side === 0) {
						joint.lowerImpulse = newImpulse;
					}
					else {
						joint.upperImpulse = newImpulse;
					}
					angularVelocityA -= inverseInertiaA * sign * impulse;
					angularVelocityB += inverseInertiaB * sign * impulse;
				}
			}
		}
		else {
			// 용접 각도.
			let bias = 0;
			let massScale = 1;
			let impulseScale = 0;
			if (useBias || joint.angularHertz > 0) {
				const angularSoftness = joint.angularSoftness;
				bias = angularSoftness.biasRate * (relativeAngle + joint.deltaAngle);
				massScale = angularSoftness.massScale;
				impulseScale = angularSoftness.impulseScale;
			}
			const angularSpeed = angularVelocityB - angularVelocityA;
			const impulse = -joint.axialMass * massScale * (angularSpeed + bias) - impulseScale * joint.angularImpulse;
			joint.angularImpulse += impulse;
			angularVelocityA -= inverseInertiaA * impulse;
			angularVelocityB += inverseInertiaB * impulse;
		}

		// 점 맞추기. (두 닻이 한 점)
		let biasX = 0;
		let biasY = 0;
		let massScale = 1;
		let impulseScale = 0;
		const pointSoftness = joint.type === JointType2D.weld ? joint.linearSoftness : jointSoftness;
		const isPointBiased = useBias || (joint.type === JointType2D.weld && joint.linearHertz > 0);
		if (isPointBiased) {
			const separationX = deltaPositionX + anchorBX - anchorAX + joint.deltaCenterX;
			const separationY = deltaPositionY + anchorBY - anchorAY + joint.deltaCenterY;
			biasX = pointSoftness.biasRate * separationX;
			biasY = pointSoftness.biasRate * separationY;
			massScale = pointSoftness.massScale;
			impulseScale = pointSoftness.impulseScale;
		}
		const relativeVelocityX = velocityBX - angularVelocityB * anchorBY - velocityAX + angularVelocityA * anchorAY;
		const relativeVelocityY = velocityBY + angularVelocityB * anchorBX - velocityAY - angularVelocityA * anchorAX;
		const k11 = inverseMassA + inverseMassB + anchorAY * anchorAY * inverseInertiaA + anchorBY * anchorBY * inverseInertiaB;
		const k12 = -anchorAY * anchorAX * inverseInertiaA - anchorBY * anchorBX * inverseInertiaB;
		const k22 = inverseMassA + inverseMassB + anchorAX * anchorAX * inverseInertiaA + anchorBX * anchorBX * inverseInertiaB;
		const solution = solveSymmetric22(k11, k12, k22, relativeVelocityX + biasX, relativeVelocityY + biasY);
		const impulseX = -massScale * solution[0] - impulseScale * joint.linearImpulseX;
		const impulseY = -massScale * solution[1] - impulseScale * joint.linearImpulseY;
		joint.linearImpulseX += impulseX;
		joint.linearImpulseY += impulseY;
		velocityAX -= inverseMassA * impulseX;
		velocityAY -= inverseMassA * impulseY;
		angularVelocityA -= inverseInertiaA * (anchorAX * impulseY - anchorAY * impulseX);
		velocityBX += inverseMassB * impulseX;
		velocityBY += inverseMassB * impulseY;
		angularVelocityB += inverseInertiaB * (anchorBX * impulseY - anchorBY * impulseX);
	}
	else {
		// 바퀴.
		const offsetX = deltaPositionX + joint.deltaCenterX + anchorBX - anchorAX;
		const offsetY = deltaPositionY + joint.deltaCenterY + anchorBY - anchorAY;
		const axisX = solverBodyA.deltaRotationCosine * joint.axisAX - solverBodyA.deltaRotationSine * joint.axisAY;
		const axisY = solverBodyA.deltaRotationSine * joint.axisAX + solverBodyA.deltaRotationCosine * joint.axisAY;
		const translation = axisX * offsetX + axisY * offsetY;
		const axialCrossA = (offsetX + anchorAX) * axisY - (offsetY + anchorAY) * axisX;
		const axialCrossB = anchorBX * axisY - anchorBY * axisX;

		// 모터.
		if (joint.enableMotor && !isFixedRotation) {
			const angularSpeed = angularVelocityB - angularVelocityA - joint.motorSpeed;
			let impulse = -joint.motorMass * angularSpeed;
			const oldImpulse = joint.motorImpulse;
			const maximumImpulse = subStepTime * joint.maxMotorTorque;
			joint.motorImpulse = System.Math.max(-maximumImpulse, System.Math.min(oldImpulse + impulse, maximumImpulse));
			impulse = joint.motorImpulse - oldImpulse;
			angularVelocityA -= inverseInertiaA * impulse;
			angularVelocityB += inverseInertiaB * impulse;
		}
		// 축 용수철. (진짜 용수철이라 이완에도 준다)
		if (joint.enableSpring) {
			const springSoftness = joint.springSoftness;
			const bias = springSoftness.biasRate * translation;
			const speed = axisX * (velocityBX - velocityAX) + axisY * (velocityBY - velocityAY) + axialCrossB * angularVelocityB - axialCrossA * angularVelocityA;
			const impulse = -springSoftness.massScale * joint.axialMass * (speed + bias) - springSoftness.impulseScale * joint.springImpulse;
			joint.springImpulse += impulse;
			velocityAX -= inverseMassA * impulse * axisX;
			velocityAY -= inverseMassA * impulse * axisY;
			angularVelocityA -= inverseInertiaA * impulse * axialCrossA;
			velocityBX += inverseMassB * impulse * axisX;
			velocityBY += inverseMassB * impulse * axisY;
			angularVelocityB += inverseInertiaB * impulse * axialCrossB;
		}
		// 축 위 자리 한도.
		if (joint.enableLimit) {
			for (let side = 0; side < 2; ++side) {
				const sign = side === 0 ? 1 : -1;
				const constraint = side === 0 ? translation - joint.lowerLimit : joint.upperLimit - translation;
				let bias = 0;
				let massScale = 1;
				let impulseScale = 0;
				if (constraint > 0) {
					bias = constraint * inverseSubStepTime;
				}
				else if (useBias) {
					bias = jointSoftness.biasRate * constraint;
					massScale = jointSoftness.massScale;
					impulseScale = jointSoftness.impulseScale;
				}
				const speed = sign * (axisX * (velocityBX - velocityAX) + axisY * (velocityBY - velocityAY) + axialCrossB * angularVelocityB - axialCrossA * angularVelocityA);
				const oldImpulse = side === 0 ? joint.lowerImpulse : joint.upperImpulse;
				let impulse = -joint.axialMass * massScale * (speed + bias) - impulseScale * oldImpulse;
				const newImpulse = System.Math.max(oldImpulse + impulse, 0);
				impulse = newImpulse - oldImpulse;
				if (side === 0) {
					joint.lowerImpulse = newImpulse;
				}
				else {
					joint.upperImpulse = newImpulse;
				}
				const appliedImpulse = sign * impulse;
				velocityAX -= inverseMassA * appliedImpulse * axisX;
				velocityAY -= inverseMassA * appliedImpulse * axisY;
				angularVelocityA -= inverseInertiaA * appliedImpulse * axialCrossA;
				velocityBX += inverseMassB * appliedImpulse * axisX;
				velocityBY += inverseMassB * appliedImpulse * axisY;
				angularVelocityB += inverseInertiaB * appliedImpulse * axialCrossB;
			}
		}
		// 축에서 벗어나지 않게.
		const perpendicularX = -axisY;
		const perpendicularY = axisX;
		let bias = 0;
		let massScale = 1;
		let impulseScale = 0;
		if (useBias) {
			bias = jointSoftness.biasRate * (perpendicularX * offsetX + perpendicularY * offsetY);
			massScale = jointSoftness.massScale;
			impulseScale = jointSoftness.impulseScale;
		}
		const perpendicularCrossA = (offsetX + anchorAX) * perpendicularY - (offsetY + anchorAY) * perpendicularX;
		const perpendicularCrossB = anchorBX * perpendicularY - anchorBY * perpendicularX;
		const speed = perpendicularX * (velocityBX - velocityAX) + perpendicularY * (velocityBY - velocityAY) + perpendicularCrossB * angularVelocityB - perpendicularCrossA * angularVelocityA;
		const impulse = -massScale * joint.perpendicularMass * (speed + bias) - impulseScale * joint.perpendicularImpulse;
		joint.perpendicularImpulse += impulse;
		velocityAX -= inverseMassA * impulse * perpendicularX;
		velocityAY -= inverseMassA * impulse * perpendicularY;
		angularVelocityA -= inverseInertiaA * impulse * perpendicularCrossA;
		velocityBX += inverseMassB * impulse * perpendicularX;
		velocityBY += inverseMassB * impulse * perpendicularY;
		angularVelocityB += inverseInertiaB * impulse * perpendicularCrossB;
	}

	if (joint.solverIndexA >= 0) {
		solverBodyA.linearVelocityX = velocityAX;
		solverBodyA.linearVelocityY = velocityAY;
		solverBodyA.angularVelocity = angularVelocityA;
	}
	if (joint.solverIndexB >= 0) {
		solverBodyB.linearVelocityX = velocityBX;
		solverBodyB.linearVelocityY = velocityBY;
		solverBodyB.angularVelocity = angularVelocityB;
	}
}
