//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";
import { Vector2 } from "../../base/vector2.js";
import { PhysicsMath2D, Rotation2D } from "./physicsmath2d.js";
import { BodyId2D, ShapeId2D } from "./physicsid2d.js";


//==============================================================================
// 몸의 종류.
//==============================================================================
/** @enum { number } */
export const BodyType2D = System.Object.freeze({
	static: 0, // 정적. (움직이지 않고 질량이 무한한 것처럼 군다, 땅과 벽)
	kinematic: 1, // 운동학. (속도대로만 움직이고 힘과 부딪힘에 밀리지 않는다, 움직이는 발판)
	dynamic: 2, // 동적. (힘, 중력, 부딪힘으로 움직인다)
});


//==============================================================================
// 몸 정의. (createBody 에 넘기는 값)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
//==============================================================================
/**
 * @example <caption>떨어지는 동적 몸 정의</caption>
 * import { Experimental, Vector2 } from "./build/vanilla.js";
 *
 * const bodyDefinition = new Experimental.BodyDefinition2D();
 * bodyDefinition.type = Experimental.BodyType2D.dynamic;
 * bodyDefinition.position = Vector2.create(100, 50);
 * bodyDefinition.angle = 0.3;
 * console.log(bodyDefinition.gravityScale, bodyDefinition.enableSleep);
 */
export class BodyDefinition2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { number } */ type; // BodyType2D 값. (기본 정적)
	/** @type { Vector2 } */ position; // 몸의 원점 자리. (월드)
	/** @type { number } */ angle; // 돌림. (라디안)
	/** @type { Vector2 } */ linearVelocity; // 처음 선속도. (원점의 속도가 아니라 질량 중심의 속도)
	/** @type { number } */ angularVelocity; // 처음 각속도. (초당 라디안)
	/** @type { number } */ linearDamping; // 선속도 감쇠. (기본 0)
	/** @type { number } */ angularDamping; // 각속도 감쇠. (기본 0)
	/** @type { number } */ gravityScale; // 중력 배율. (기본 1)
	/** @type { boolean } */ enableSleep; // 잠들 수 있는지. (기본 참)
	/** @type { boolean } */ isAwake; // 깨어 있는 채로 시작할지. (기본 참)
	/** @type { boolean } */ isFixedRotation; // 돌지 않게 할지. (기본 거짓)
	/** @type { any } */ userData; // 사용자 값.

	//==============================================================================
	// 생성. (원점의 정적 몸)
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.type = BodyType2D.static;
		this.position = Vector2.zero();
		this.angle = 0;
		this.linearVelocity = Vector2.zero();
		this.angularVelocity = 0;
		this.linearDamping = 0;
		this.angularDamping = 0;
		this.gravityScale = 1;
		this.enableSleep = true;
		this.isAwake = true;
		this.isFixedRotation = false;
		this.userData = null;
	}
}


//==============================================================================
// 몸 자료. (월드가 셈에 쓰는 값, 안에서 쓴다)
//==============================================================================
export class BodyData extends Object {
	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.id = null;
		this.type = BodyType2D.static;
		this.positionX = 0;
		this.positionY = 0;
		this.rotationCosine = 1;
		this.rotationSine = 0;
		this.centerX = 0;
		this.centerY = 0;
		this.localCenterX = 0;
		this.localCenterY = 0;
		this.previousPositionX = 0;
		this.previousPositionY = 0;
		this.previousRotationCosine = 1;
		this.previousRotationSine = 0;
		this.linearVelocityX = 0;
		this.linearVelocityY = 0;
		this.angularVelocity = 0;
		this.forceX = 0;
		this.forceY = 0;
		this.torque = 0;
		this.mass = 0;
		this.inverseMass = 0;
		this.rotationalInertia = 0;
		this.inverseInertia = 0;
		this.linearDamping = 0;
		this.angularDamping = 0;
		this.gravityScale = 1;
		this.isAwake = true;
		this.enableSleep = true;
		this.sleepTime = 0;
		this.isFixedRotation = false;
		this.isTransformDirty = false;
		this.isMassDirty = false;
		this.maximumExtent = 0;
		this.shapeIdList = [];
		this.userData = null;
		this.solverIndex = -1;
		this.islandParent = -1;
	}
}

//==============================================================================
// 몸의 질량 중심을 원점과 회전에서 다시 셈. (안에서 쓴다)
//==============================================================================
/**
 * @param { BodyData } data
 */
export function updateBodyCenter(data) {
	data.centerX = data.rotationCosine * data.localCenterX - data.rotationSine * data.localCenterY + data.positionX;
	data.centerY = data.rotationSine * data.localCenterX + data.rotationCosine * data.localCenterY + data.positionY;
}


//==============================================================================
// 몸. (강체 하나)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - PhysicsWorld2D.createBody 로 만들고 getBody(bodyId) 로 얻는다. 직접 만들지 않는다.
// - 자리는 몸의 원점, 속도는 질량 중심의 속도다. (Box2D, 유니티 Rigidbody2D 와 같다)
// - 속도, 힘, 자리를 바꾸면 몸이 깬다. 잠든 섬의 다른 몸도 다음 걸음에 같이 깬다.
//==============================================================================
/**
 * @example <caption>몸에 힘과 충격 주기</caption>
 * import { Experimental, Vector2 } from "./build/vanilla.js";
 *
 * const world = new Experimental.PhysicsWorld2D(new Experimental.WorldDefinition2D(1));
 * const bodyDefinition = new Experimental.BodyDefinition2D();
 * bodyDefinition.type = Experimental.BodyType2D.dynamic;
 * const bodyId = world.createBody(bodyDefinition);
 * world.createShape(bodyId, new Experimental.ShapeDefinition2D(), Experimental.Polygon2D.makeBox(0.5, 0.5));
 * const body = world.getBody(bodyId);
 * body.applyLinearImpulseToCenter(Vector2.create(2, 0), true);
 * world.step(1 / 60, 4);
 * console.log(body.getMass(), body.getLinearVelocity().x.toFixed(3), body.getPosition().y.toFixed(4));
 */
export class Body2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { BodyData } */ #data;

	//==============================================================================
	// 생성. (월드가 만든다)
	//==============================================================================
	/**
	 * @constructor
	 * @param { BodyData } data 몸 자료.
	 */
	constructor(data) {
		super();
		this.#data = data;
	}

	//==============================================================================
	// 몸 자료 반환. (안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @returns { BodyData }
	 */
	getData() {
		return this.#data;
	}

	//==============================================================================
	// 아이디 반환.
	//==============================================================================
	/**
	 * @returns { BodyId2D } 이 몸의 아이디.
	 */
	getId() {
		const data = this.getData();
		return data.id;
	}

	//==============================================================================
	// 종류 반환.
	//==============================================================================
	/**
	 * @returns { number } BodyType2D 값.
	 */
	getType() {
		const data = this.getData();
		return data.type;
	}

	//==============================================================================
	// 원점 자리 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 몸 원점의 월드 자리.
	 */
	getPosition() {
		const data = this.getData();
		return Vector2.create(data.positionX, data.positionY);
	}

	//==============================================================================
	// 돌림 반환. (결정론 아크탄젠트)
	//==============================================================================
	/**
	 * @returns { number } 각도. (라디안, -파이 ~ 파이)
	 */
	getAngle() {
		const data = this.getData();
		return PhysicsMath2D.computeAtan2(data.rotationSine, data.rotationCosine);
	}

	//==============================================================================
	// 회전 반환. (코사인, 사인)
	//==============================================================================
	/**
	 * @returns { Rotation2D } 회전.
	 */
	getRotation() {
		const data = this.getData();
		return Rotation2D.create(data.rotationCosine, data.rotationSine);
	}

	//==============================================================================
	// 자리와 돌림을 바로 옮기기. (순간 이동, 몸을 깨운다)
	//==============================================================================
	/**
	 * @param { Vector2 } position 원점의 새 자리.
	 * @param { number } angle 새 돌림. (라디안)
	 */
	setTransform(position, angle) {
		const data = this.getData();
		const rotation = PhysicsMath2D.computeRotation(angle);
		data.positionX = position.x;
		data.positionY = position.y;
		data.rotationCosine = rotation.cosine;
		data.rotationSine = rotation.sine;
		data.previousPositionX = data.positionX;
		data.previousPositionY = data.positionY;
		data.previousRotationCosine = data.rotationCosine;
		data.previousRotationSine = data.rotationSine;
		updateBodyCenter(data);
		data.isTransformDirty = true;
		this.wake();
	}

	//==============================================================================
	// 운동학 몸을 다음 걸음에 목표 자리로 옮길 속도 정하기. (유니티 MovePosition, Box2D b2Body_SetTargetTransform 과 같은 쓰임)
	//==============================================================================
	/**
	 * @param { Vector2 } position 목표 원점 자리.
	 * @param { number } angle 목표 돌림. (라디안)
	 * @param { number } timeStep 다음 걸음의 시간. (초)
	 */
	setTargetTransform(position, angle, timeStep) {
		const data = this.getData();
		if (data.type === BodyType2D.static || !(timeStep > 0)) {
			return;
		}
		const rotation = PhysicsMath2D.computeRotation(angle);
		const targetCenterX = rotation.cosine * data.localCenterX - rotation.sine * data.localCenterY + position.x;
		const targetCenterY = rotation.sine * data.localCenterX + rotation.cosine * data.localCenterY + position.y;
		const inverseTimeStep = 1 / timeStep;
		data.linearVelocityX = inverseTimeStep * (targetCenterX - data.centerX);
		data.linearVelocityY = inverseTimeStep * (targetCenterY - data.centerY);
		const relativeSine = rotation.sine * data.rotationCosine - rotation.cosine * data.rotationSine;
		const relativeCosine = rotation.cosine * data.rotationCosine + rotation.sine * data.rotationSine;
		data.angularVelocity = inverseTimeStep * PhysicsMath2D.computeAtan2(relativeSine, relativeCosine);
		this.wake();
	}

	//==============================================================================
	// 질량 중심의 월드 자리 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 질량 중심. (월드)
	 */
	getWorldCenterOfMass() {
		const data = this.getData();
		return Vector2.create(data.centerX, data.centerY);
	}

	//==============================================================================
	// 질량 중심의 몸 기준 자리 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 질량 중심. (몸 기준)
	 */
	getLocalCenterOfMass() {
		const data = this.getData();
		return Vector2.create(data.localCenterX, data.localCenterY);
	}

	//==============================================================================
	// 선속도 설정. (정적 몸은 무시, 0 이 아니면 깨운다)
	//==============================================================================
	/**
	 * @param { Vector2 } linearVelocity 질량 중심의 새 속도.
	 */
	setLinearVelocity(linearVelocity) {
		const data = this.getData();
		if (data.type === BodyType2D.static) {
			return;
		}
		if (linearVelocity.x * linearVelocity.x + linearVelocity.y * linearVelocity.y > 0) {
			this.wake();
		}
		data.linearVelocityX = linearVelocity.x;
		data.linearVelocityY = linearVelocity.y;
	}

	//==============================================================================
	// 선속도 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 질량 중심의 속도.
	 */
	getLinearVelocity() {
		const data = this.getData();
		return Vector2.create(data.linearVelocityX, data.linearVelocityY);
	}

	//==============================================================================
	// 각속도 설정. (정적 몸과 돌지 않는 몸은 무시, 0 이 아니면 깨운다)
	//==============================================================================
	/**
	 * @param { number } angularVelocity 새 각속도. (초당 라디안)
	 */
	setAngularVelocity(angularVelocity) {
		const data = this.getData();
		if (data.type === BodyType2D.static || data.isFixedRotation) {
			return;
		}
		if (angularVelocity !== 0) {
			this.wake();
		}
		data.angularVelocity = angularVelocity;
	}

	//==============================================================================
	// 각속도 반환.
	//==============================================================================
	/**
	 * @returns { number } 각속도. (초당 라디안)
	 */
	getAngularVelocity() {
		const data = this.getData();
		return data.angularVelocity;
	}

	//==============================================================================
	// 월드 점의 속도 반환. (선속도 + 각속도 x 질량 중심에서 그 점까지)
	//==============================================================================
	/**
	 * @param { Vector2 } worldPoint 월드 점.
	 * @returns { Vector2 } 그 점의 속도.
	 */
	getWorldPointVelocity(worldPoint) {
		const data = this.getData();
		const offsetX = worldPoint.x - data.centerX;
		const offsetY = worldPoint.y - data.centerY;
		return Vector2.create(data.linearVelocityX - data.angularVelocity * offsetY, data.linearVelocityY + data.angularVelocity * offsetX);
	}

	//==============================================================================
	// 힘을 월드 점에 주기. (동적 몸만, 다음 걸음 동안 걸리고 걸음 뒤에 지운다)
	// - wake 가 거짓이고 몸이 잠들어 있으면 주지 않는다.
	//==============================================================================
	/**
	 * @param { Vector2 } force 힘. (월드)
	 * @param { Vector2 } worldPoint 힘을 주는 월드 점.
	 * @param { boolean } wake 몸을 깨울지.
	 */
	applyForce(force, worldPoint, wake) {
		const data = this.getData();
		const isApplied = this.prepareApply(wake);
		if (!isApplied) {
			return;
		}
		data.forceX += force.x;
		data.forceY += force.y;
		data.torque += (worldPoint.x - data.centerX) * force.y - (worldPoint.y - data.centerY) * force.x;
	}

	//==============================================================================
	// 힘을 질량 중심에 주기. (동적 몸만)
	//==============================================================================
	/**
	 * @param { Vector2 } force 힘. (월드)
	 * @param { boolean } wake 몸을 깨울지.
	 */
	applyForceToCenter(force, wake) {
		const data = this.getData();
		const isApplied = this.prepareApply(wake);
		if (!isApplied) {
			return;
		}
		data.forceX += force.x;
		data.forceY += force.y;
	}

	//==============================================================================
	// 돌림힘 주기. (동적 몸만)
	//==============================================================================
	/**
	 * @param { number } torque 돌림힘.
	 * @param { boolean } wake 몸을 깨울지.
	 */
	applyTorque(torque, wake) {
		const data = this.getData();
		const isApplied = this.prepareApply(wake);
		if (!isApplied) {
			return;
		}
		data.torque += torque;
	}

	//==============================================================================
	// 충격을 월드 점에 주기. (동적 몸만, 속도를 바로 바꾼다)
	//==============================================================================
	/**
	 * @param { Vector2 } impulse 충격. (월드)
	 * @param { Vector2 } worldPoint 충격을 주는 월드 점.
	 * @param { boolean } wake 몸을 깨울지.
	 */
	applyLinearImpulse(impulse, worldPoint, wake) {
		const data = this.getData();
		const isApplied = this.prepareApply(wake);
		if (!isApplied) {
			return;
		}
		data.linearVelocityX += data.inverseMass * impulse.x;
		data.linearVelocityY += data.inverseMass * impulse.y;
		data.angularVelocity += data.inverseInertia * ((worldPoint.x - data.centerX) * impulse.y - (worldPoint.y - data.centerY) * impulse.x);
	}

	//==============================================================================
	// 충격을 질량 중심에 주기. (동적 몸만)
	//==============================================================================
	/**
	 * @param { Vector2 } impulse 충격. (월드)
	 * @param { boolean } wake 몸을 깨울지.
	 */
	applyLinearImpulseToCenter(impulse, wake) {
		const data = this.getData();
		const isApplied = this.prepareApply(wake);
		if (!isApplied) {
			return;
		}
		data.linearVelocityX += data.inverseMass * impulse.x;
		data.linearVelocityY += data.inverseMass * impulse.y;
	}

	//==============================================================================
	// 각 충격 주기. (동적 몸만)
	//==============================================================================
	/**
	 * @param { number } impulse 각 충격.
	 * @param { boolean } wake 몸을 깨울지.
	 */
	applyAngularImpulse(impulse, wake) {
		const data = this.getData();
		const isApplied = this.prepareApply(wake);
		if (!isApplied) {
			return;
		}
		data.angularVelocity += data.inverseInertia * impulse;
	}

	//==============================================================================
	// 힘이나 충격을 줄 수 있는지 보고 필요하면 깨우기. (안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @param { boolean } wake
	 * @returns { boolean }
	 */
	prepareApply(wake) {
		const data = this.getData();
		if (data.type !== BodyType2D.dynamic) {
			return false;
		}
		if (wake) {
			this.wake();
		}
		return data.isAwake;
	}

	//==============================================================================
	// 질량 반환.
	//==============================================================================
	/**
	 * @returns { number } 질량. (정적, 운동학 몸은 0)
	 */
	getMass() {
		const data = this.getData();
		return data.mass;
	}

	//==============================================================================
	// 질량 중심에 대한 회전 관성 반환.
	//==============================================================================
	/**
	 * @returns { number } 회전 관성.
	 */
	getRotationalInertia() {
		const data = this.getData();
		return data.rotationalInertia;
	}

	//==============================================================================
	// 선속도 감쇠 설정.
	//==============================================================================
	/**
	 * @param { number } linearDamping 선속도 감쇠. (0 이상)
	 */
	setLinearDamping(linearDamping) {
		const data = this.getData();
		data.linearDamping = System.Math.max(0, linearDamping);
	}

	//==============================================================================
	// 선속도 감쇠 반환.
	//==============================================================================
	/**
	 * @returns { number } 선속도 감쇠.
	 */
	getLinearDamping() {
		const data = this.getData();
		return data.linearDamping;
	}

	//==============================================================================
	// 각속도 감쇠 설정.
	//==============================================================================
	/**
	 * @param { number } angularDamping 각속도 감쇠. (0 이상)
	 */
	setAngularDamping(angularDamping) {
		const data = this.getData();
		data.angularDamping = System.Math.max(0, angularDamping);
	}

	//==============================================================================
	// 각속도 감쇠 반환.
	//==============================================================================
	/**
	 * @returns { number } 각속도 감쇠.
	 */
	getAngularDamping() {
		const data = this.getData();
		return data.angularDamping;
	}

	//==============================================================================
	// 중력 배율 설정.
	//==============================================================================
	/**
	 * @param { number } gravityScale 중력 배율.
	 */
	setGravityScale(gravityScale) {
		const data = this.getData();
		data.gravityScale = gravityScale;
	}

	//==============================================================================
	// 중력 배율 반환.
	//==============================================================================
	/**
	 * @returns { number } 중력 배율.
	 */
	getGravityScale() {
		const data = this.getData();
		return data.gravityScale;
	}

	//==============================================================================
	// 깨어 있는지.
	//==============================================================================
	/**
	 * @returns { boolean } 깨어 있으면 참.
	 */
	isAwake() {
		const data = this.getData();
		return data.isAwake;
	}

	//==============================================================================
	// 깨우거나 재우기. (재우면 속도를 0 으로 두고, 섬의 다른 몸이 깨어 있으면 다음 걸음에 다시 깬다)
	//==============================================================================
	/**
	 * @param { boolean } isAwake 깨울지.
	 */
	setAwake(isAwake) {
		const data = this.getData();
		if (data.type === BodyType2D.static) {
			return;
		}
		if (isAwake) {
			this.wake();
			return;
		}
		data.isAwake = false;
		data.sleepTime = 0;
		data.linearVelocityX = 0;
		data.linearVelocityY = 0;
		data.angularVelocity = 0;
		data.forceX = 0;
		data.forceY = 0;
		data.torque = 0;
	}

	//==============================================================================
	// 깨우기. (잠든 시간을 지운다, 안에서도 쓴다)
	//==============================================================================
	/**
	 * @private
	 */
	wake() {
		const data = this.getData();
		if (data.type === BodyType2D.static) {
			return;
		}
		data.isAwake = true;
		data.sleepTime = 0;
	}

	//==============================================================================
	// 잠들 수 있게 할지 설정. (끄면 깨운다)
	//==============================================================================
	/**
	 * @param { boolean } enableSleep 잠들 수 있게 할지.
	 */
	setSleepEnabled(enableSleep) {
		const data = this.getData();
		data.enableSleep = enableSleep;
		if (!enableSleep) {
			this.wake();
		}
	}

	//==============================================================================
	// 잠들 수 있는지.
	//==============================================================================
	/**
	 * @returns { boolean } 잠들 수 있으면 참.
	 */
	isSleepEnabled() {
		const data = this.getData();
		return data.enableSleep;
	}

	//==============================================================================
	// 돌지 않게 할지 설정. (다음 걸음 앞에서 회전 관성을 다시 셈한다)
	//==============================================================================
	/**
	 * @param { boolean } isFixedRotation 돌지 않게 할지.
	 */
	setFixedRotation(isFixedRotation) {
		const data = this.getData();
		data.isFixedRotation = isFixedRotation;
		data.isMassDirty = true;
		if (isFixedRotation) {
			data.angularVelocity = 0;
		}
		this.wake();
	}

	//==============================================================================
	// 돌지 않는지.
	//==============================================================================
	/**
	 * @returns { boolean } 돌지 않게 했으면 참.
	 */
	isFixedRotation() {
		const data = this.getData();
		return data.isFixedRotation;
	}

	//==============================================================================
	// 붙은 모양 아이디 목록 반환. (복사본, 붙인 차례)
	//==============================================================================
	/**
	 * @returns { ShapeId2D[] } 모양 아이디 목록.
	 */
	getShapeIds() {
		const data = this.getData();
		return data.shapeIdList.slice();
	}

	//==============================================================================
	// 몸 기준 점을 월드 점으로.
	//==============================================================================
	/**
	 * @param { Vector2 } localPoint 몸 기준 점.
	 * @returns { Vector2 } 월드 점.
	 */
	getWorldPoint(localPoint) {
		const data = this.getData();
		return Vector2.create(data.rotationCosine * localPoint.x - data.rotationSine * localPoint.y + data.positionX, data.rotationSine * localPoint.x + data.rotationCosine * localPoint.y + data.positionY);
	}

	//==============================================================================
	// 월드 점을 몸 기준 점으로.
	//==============================================================================
	/**
	 * @param { Vector2 } worldPoint 월드 점.
	 * @returns { Vector2 } 몸 기준 점.
	 */
	getLocalPoint(worldPoint) {
		const data = this.getData();
		const offsetX = worldPoint.x - data.positionX;
		const offsetY = worldPoint.y - data.positionY;
		return Vector2.create(data.rotationCosine * offsetX + data.rotationSine * offsetY, -data.rotationSine * offsetX + data.rotationCosine * offsetY);
	}

	//==============================================================================
	// 몸 기준 방향을 월드 방향으로.
	//==============================================================================
	/**
	 * @param { Vector2 } localVector 몸 기준 방향.
	 * @returns { Vector2 } 월드 방향.
	 */
	getWorldVector(localVector) {
		const data = this.getData();
		return Vector2.create(data.rotationCosine * localVector.x - data.rotationSine * localVector.y, data.rotationSine * localVector.x + data.rotationCosine * localVector.y);
	}

	//==============================================================================
	// 월드 방향을 몸 기준 방향으로.
	//==============================================================================
	/**
	 * @param { Vector2 } worldVector 월드 방향.
	 * @returns { Vector2 } 몸 기준 방향.
	 */
	getLocalVector(worldVector) {
		const data = this.getData();
		return Vector2.create(data.rotationCosine * worldVector.x + data.rotationSine * worldVector.y, -data.rotationSine * worldVector.x + data.rotationCosine * worldVector.y);
	}

	//==============================================================================
	// 앞 걸음과 지금 걸음 사이의 원점 자리. (그리기 보간, alpha 는 PhysicsWorld2D.advance 가 돌려준 몫)
	//==============================================================================
	/**
	 * @param { number } alpha 섞는 몫. (0 이면 앞 걸음, 1 이면 지금 걸음)
	 * @returns { Vector2 } 보간한 자리.
	 */
	getInterpolatedPosition(alpha) {
		const data = this.getData();
		return Vector2.create(data.previousPositionX + alpha * (data.positionX - data.previousPositionX), data.previousPositionY + alpha * (data.positionY - data.previousPositionY));
	}

	//==============================================================================
	// 앞 걸음과 지금 걸음 사이의 돌림. (회전을 섞어 길이를 맞춘 뒤 각도로)
	//==============================================================================
	/**
	 * @param { number } alpha 섞는 몫. (0 이면 앞 걸음, 1 이면 지금 걸음)
	 * @returns { number } 보간한 각도. (라디안)
	 */
	getInterpolatedAngle(alpha) {
		const data = this.getData();
		const cosine = data.previousRotationCosine + alpha * (data.rotationCosine - data.previousRotationCosine);
		const sine = data.previousRotationSine + alpha * (data.rotationSine - data.previousRotationSine);
		return PhysicsMath2D.computeAtan2(sine, cosine);
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
