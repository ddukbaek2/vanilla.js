//==============================================================================
// 포함 모듈 목록.
//==============================================================================
// 옮긴 원문: Box2D 3 의 셈에서 옮김, MIT, THIRD_PARTY_LICENSES.md
const System = globalThis;
import { Object } from "../../base/object.js";
import { Manifold } from "./narrowphase2d.js";


//==============================================================================
// 2D 물리의 풀이기. (안에서 쓴다, 공개 API 아님)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - Box2D 3 의 부드러운 걸음(Soft Step)과 같은 꼴이다. 한 걸음을 하위 걸음 여럿으로 나누고, 하위 걸음마다
//   속도 적분, 웜 스타트, 부드러운 구속으로 풀기(겹침을 밀어내는 치우침 포함), 자리 적분, 치우침 없이 이완하기를 한다.
//   하위 걸음이 끝나면 반발을 한 번 주고 충격을 다음 걸음의 웜 스타트로 남긴다. (box2d.org/posts/2024/02/solver2d)
// - 부드러운 구속은 고유 진동수(헤르츠)와 감쇠비로 정한다. (Erin Catto, GDC 2011 Soft Constraints)
// - 러스트 vanilla-engine 의 experimental::physics2d::solver2d 와 같은 셈, 같은 차례다.
//==============================================================================


//==============================================================================
// 부드러움. (치우침 비율, 질량 배율, 충격 배율)
//==============================================================================
export class Softness extends Object {
	//==============================================================================
	// 생성. (단단함)
	//==============================================================================
	constructor() {
		super();
		this.biasRate = 0;
		this.massScale = 1;
		this.impulseScale = 0;
	}
}

//==============================================================================
// 헤르츠와 감쇠비로 부드러움 짓기. (헤르츠가 0 이면 단단함)
//==============================================================================
/**
 * @param { number } hertz 고유 진동수.
 * @param { number } dampingRatio 감쇠비.
 * @param { number } subStepTime 하위 걸음 시간.
 * @returns { Softness }
 */
export function makeSoftness(hertz, dampingRatio, subStepTime) {
	const softness = new Softness();
	if (hertz === 0) {
		return softness;
	}
	const omega = 2 * System.Math.PI * hertz;
	const factor1 = 2 * dampingRatio + subStepTime * omega;
	const factor2 = subStepTime * omega * factor1;
	const factor3 = 1 / (1 + factor2);
	softness.biasRate = omega / factor1;
	softness.massScale = factor2 * factor3;
	softness.impulseScale = factor3;
	return softness;
}


//==============================================================================
// 걸음 값. (한 걸음 동안 같은 값)
//==============================================================================
export class StepContext extends Object {
	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.timeStep = 0;
		this.inverseTimeStep = 0;
		this.subStepTime = 0;
		this.inverseSubStepTime = 0;
		this.contactSoftness = new Softness();
		this.staticSoftness = new Softness();
		this.jointSoftness = new Softness();
		this.restitutionThreshold = 0;
		this.maximumBiasVelocity = 0;
		this.maximumLinearSpeed = 0;
		this.maximumAngularSpeed = 0;
		this.gravityX = 0;
		this.gravityY = 0;
		this.contactHertz = 0;
		this.jointDampingRatio = 0;
	}
}


//==============================================================================
// 풀이 몸. (깨어 있는 정적 아닌 몸 하나의 걸음 동안 값)
//==============================================================================
export class SolverBody extends Object {
	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.bodyIndex = -1;
		this.linearVelocityX = 0;
		this.linearVelocityY = 0;
		this.angularVelocity = 0;
		this.deltaPositionX = 0;
		this.deltaPositionY = 0;
		this.deltaRotationCosine = 1;
		this.deltaRotationSine = 0;
		this.inverseMass = 0;
		this.inverseInertia = 0;
	}
}

// 정적 몸 자리의 풀이 몸. (읽기만 한다)
export const STATIC_SOLVER_BODY = new SolverBody();


//==============================================================================
// 닿음. (넓은 단계가 찾은 모양 짝 하나)
//==============================================================================
export class Contact extends Object {
	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.shapeIndexA = -1;
		this.shapeIndexB = -1;
		this.bodyIndexA = -1;
		this.bodyIndexB = -1;
		this.key = 0;
		this.isSensor = false;
		this.isTouching = false;
		this.isAlive = false;
		this.manifold = new Manifold();
		this.friction = 0;
		this.restitution = 0;
		this.softness = new Softness();
		this.solverIndexA = -1;
		this.solverIndexB = -1;
		this.inverseMassA = 0;
		this.inverseMassB = 0;
		this.inverseInertiaA = 0;
		this.inverseInertiaB = 0;
	}
}

//==============================================================================
// 닿음 풀이 준비. (닿음점의 팔, 유효 질량, 반발용 처음 속도)
//==============================================================================
/**
 * @param { Contact } contact
 * @param { object } bodyDataA BodyData.
 * @param { object } bodyDataB BodyData.
 * @param { SolverBody[] } solverBodyList
 * @param { StepContext } context
 */
export function prepareContact(contact, bodyDataA, bodyDataB, solverBodyList, context) {
	contact.solverIndexA = bodyDataA.solverIndex;
	contact.solverIndexB = bodyDataB.solverIndex;
	const solverBodyA = contact.solverIndexA >= 0 ? solverBodyList[contact.solverIndexA] : STATIC_SOLVER_BODY;
	const solverBodyB = contact.solverIndexB >= 0 ? solverBodyList[contact.solverIndexB] : STATIC_SOLVER_BODY;
	const inverseMassA = solverBodyA.inverseMass;
	const inverseMassB = solverBodyB.inverseMass;
	const inverseInertiaA = solverBodyA.inverseInertia;
	const inverseInertiaB = solverBodyB.inverseInertia;
	contact.inverseMassA = inverseMassA;
	contact.inverseMassB = inverseMassB;
	contact.inverseInertiaA = inverseInertiaA;
	contact.inverseInertiaB = inverseInertiaB;
	contact.softness = (inverseMassA === 0 || inverseMassB === 0) ? context.staticSoftness : context.contactSoftness;

	const manifold = contact.manifold;
	const normalX = manifold.normalX;
	const normalY = manifold.normalY;
	const tangentX = normalY;
	const tangentY = -normalX;
	const velocityAX = solverBodyA.linearVelocityX;
	const velocityAY = solverBodyA.linearVelocityY;
	const angularVelocityA = solverBodyA.angularVelocity;
	const velocityBX = solverBodyB.linearVelocityX;
	const velocityBY = solverBodyB.linearVelocityY;
	const angularVelocityB = solverBodyB.angularVelocity;
	for (let pointIndex = 0; pointIndex < manifold.pointCount; ++pointIndex) {
		const manifoldPoint = manifold.points[pointIndex];
		const anchorAX = manifoldPoint.pointX - bodyDataA.centerX;
		const anchorAY = manifoldPoint.pointY - bodyDataA.centerY;
		const anchorBX = manifoldPoint.pointX - bodyDataB.centerX;
		const anchorBY = manifoldPoint.pointY - bodyDataB.centerY;
		manifoldPoint.anchorAX = anchorAX;
		manifoldPoint.anchorAY = anchorAY;
		manifoldPoint.anchorBX = anchorBX;
		manifoldPoint.anchorBY = anchorBY;
		manifoldPoint.baseSeparation = manifoldPoint.separation - ((anchorBX - anchorAX) * normalX + (anchorBY - anchorAY) * normalY);
		const crossNormalA = anchorAX * normalY - anchorAY * normalX;
		const crossNormalB = anchorBX * normalY - anchorBY * normalX;
		const normalMassInverse = inverseMassA + inverseMassB + inverseInertiaA * crossNormalA * crossNormalA + inverseInertiaB * crossNormalB * crossNormalB;
		manifoldPoint.normalMass = normalMassInverse > 0 ? 1 / normalMassInverse : 0;
		const crossTangentA = anchorAX * tangentY - anchorAY * tangentX;
		const crossTangentB = anchorBX * tangentY - anchorBY * tangentX;
		const tangentMassInverse = inverseMassA + inverseMassB + inverseInertiaA * crossTangentA * crossTangentA + inverseInertiaB * crossTangentB * crossTangentB;
		manifoldPoint.tangentMass = tangentMassInverse > 0 ? 1 / tangentMassInverse : 0;
		const relativeVelocityX = velocityBX - angularVelocityB * anchorBY - velocityAX + angularVelocityA * anchorAY;
		const relativeVelocityY = velocityBY + angularVelocityB * anchorBX - velocityAY - angularVelocityA * anchorAX;
		manifoldPoint.relativeVelocity = normalX * relativeVelocityX + normalY * relativeVelocityY;
		manifoldPoint.maximumNormalImpulse = 0;
	}
}

//==============================================================================
// 닿음 웜 스타트. (앞 걸음의 충격을 먼저 준다)
//==============================================================================
/**
 * @param { Contact } contact
 * @param { SolverBody[] } solverBodyList
 */
export function warmStartContact(contact, solverBodyList) {
	const solverBodyA = contact.solverIndexA >= 0 ? solverBodyList[contact.solverIndexA] : STATIC_SOLVER_BODY;
	const solverBodyB = contact.solverIndexB >= 0 ? solverBodyList[contact.solverIndexB] : STATIC_SOLVER_BODY;
	const inverseMassA = contact.inverseMassA;
	const inverseMassB = contact.inverseMassB;
	const inverseInertiaA = contact.inverseInertiaA;
	const inverseInertiaB = contact.inverseInertiaB;
	let velocityAX = solverBodyA.linearVelocityX;
	let velocityAY = solverBodyA.linearVelocityY;
	let angularVelocityA = solverBodyA.angularVelocity;
	let velocityBX = solverBodyB.linearVelocityX;
	let velocityBY = solverBodyB.linearVelocityY;
	let angularVelocityB = solverBodyB.angularVelocity;
	const manifold = contact.manifold;
	const normalX = manifold.normalX;
	const normalY = manifold.normalY;
	const tangentX = normalY;
	const tangentY = -normalX;
	for (let pointIndex = 0; pointIndex < manifold.pointCount; ++pointIndex) {
		const manifoldPoint = manifold.points[pointIndex];
		const impulseX = manifoldPoint.normalImpulse * normalX + manifoldPoint.tangentImpulse * tangentX;
		const impulseY = manifoldPoint.normalImpulse * normalY + manifoldPoint.tangentImpulse * tangentY;
		angularVelocityA -= inverseInertiaA * (manifoldPoint.anchorAX * impulseY - manifoldPoint.anchorAY * impulseX);
		velocityAX -= inverseMassA * impulseX;
		velocityAY -= inverseMassA * impulseY;
		angularVelocityB += inverseInertiaB * (manifoldPoint.anchorBX * impulseY - manifoldPoint.anchorBY * impulseX);
		velocityBX += inverseMassB * impulseX;
		velocityBY += inverseMassB * impulseY;
	}
	if (contact.solverIndexA >= 0) {
		solverBodyA.linearVelocityX = velocityAX;
		solverBodyA.linearVelocityY = velocityAY;
		solverBodyA.angularVelocity = angularVelocityA;
	}
	if (contact.solverIndexB >= 0) {
		solverBodyB.linearVelocityX = velocityBX;
		solverBodyB.linearVelocityY = velocityBY;
		solverBodyB.angularVelocity = angularVelocityB;
	}
}

//==============================================================================
// 닿음 풀기. (useBias 면 겹침을 부드럽게 밀어내고, 아니면 속도만 맞춘다(이완))
//==============================================================================
/**
 * @param { Contact } contact
 * @param { SolverBody[] } solverBodyList
 * @param { StepContext } context
 * @param { boolean } useBias
 */
export function solveContact(contact, solverBodyList, context, useBias) {
	const solverBodyA = contact.solverIndexA >= 0 ? solverBodyList[contact.solverIndexA] : STATIC_SOLVER_BODY;
	const solverBodyB = contact.solverIndexB >= 0 ? solverBodyList[contact.solverIndexB] : STATIC_SOLVER_BODY;
	const inverseMassA = contact.inverseMassA;
	const inverseMassB = contact.inverseMassB;
	const inverseInertiaA = contact.inverseInertiaA;
	const inverseInertiaB = contact.inverseInertiaB;
	let velocityAX = solverBodyA.linearVelocityX;
	let velocityAY = solverBodyA.linearVelocityY;
	let angularVelocityA = solverBodyA.angularVelocity;
	let velocityBX = solverBodyB.linearVelocityX;
	let velocityBY = solverBodyB.linearVelocityY;
	let angularVelocityB = solverBodyB.angularVelocity;
	const deltaPositionX = solverBodyB.deltaPositionX - solverBodyA.deltaPositionX;
	const deltaPositionY = solverBodyB.deltaPositionY - solverBodyA.deltaPositionY;
	const rotationCosineA = solverBodyA.deltaRotationCosine;
	const rotationSineA = solverBodyA.deltaRotationSine;
	const rotationCosineB = solverBodyB.deltaRotationCosine;
	const rotationSineB = solverBodyB.deltaRotationSine;
	const manifold = contact.manifold;
	const normalX = manifold.normalX;
	const normalY = manifold.normalY;
	const tangentX = normalY;
	const tangentY = -normalX;
	const softness = contact.softness;
	const inverseSubStepTime = context.inverseSubStepTime;
	const maximumBiasVelocity = context.maximumBiasVelocity;

	// 밀어내기.
	for (let pointIndex = 0; pointIndex < manifold.pointCount; ++pointIndex) {
		const manifoldPoint = manifold.points[pointIndex];
		const anchorAX = manifoldPoint.anchorAX;
		const anchorAY = manifoldPoint.anchorAY;
		const anchorBX = manifoldPoint.anchorBX;
		const anchorBY = manifoldPoint.anchorBY;
		// 지금 떨어진 거리. (걸음 처음부터 몸이 옮기고 돈 만큼)
		const rotatedAX = rotationCosineA * anchorAX - rotationSineA * anchorAY;
		const rotatedAY = rotationSineA * anchorAX + rotationCosineA * anchorAY;
		const rotatedBX = rotationCosineB * anchorBX - rotationSineB * anchorBY;
		const rotatedBY = rotationSineB * anchorBX + rotationCosineB * anchorBY;
		const currentSeparation = (deltaPositionX + rotatedBX - rotatedAX) * normalX + (deltaPositionY + rotatedBY - rotatedAY) * normalY + manifoldPoint.baseSeparation;
		let velocityBias = 0;
		let massScale = 1;
		let impulseScale = 0;
		if (currentSeparation > 0) {
			// 앞질러 보기. (닿기 전이면 닿을 만큼만 다가가게 한다)
			velocityBias = currentSeparation * inverseSubStepTime;
		}
		else if (useBias) {
			velocityBias = System.Math.max(softness.biasRate * currentSeparation, -maximumBiasVelocity);
			massScale = softness.massScale;
			impulseScale = softness.impulseScale;
		}
		const relativeVelocityX = velocityBX - angularVelocityB * anchorBY - velocityAX + angularVelocityA * anchorAY;
		const relativeVelocityY = velocityBY + angularVelocityB * anchorBX - velocityAY - angularVelocityA * anchorAX;
		const normalVelocity = normalX * relativeVelocityX + normalY * relativeVelocityY;
		let impulse = -manifoldPoint.normalMass * massScale * (normalVelocity + velocityBias) - impulseScale * manifoldPoint.normalImpulse;
		const newImpulse = System.Math.max(manifoldPoint.normalImpulse + impulse, 0);
		impulse = newImpulse - manifoldPoint.normalImpulse;
		manifoldPoint.normalImpulse = newImpulse;
		manifoldPoint.maximumNormalImpulse = System.Math.max(manifoldPoint.maximumNormalImpulse, impulse);
		const impulseX = impulse * normalX;
		const impulseY = impulse * normalY;
		velocityAX -= inverseMassA * impulseX;
		velocityAY -= inverseMassA * impulseY;
		angularVelocityA -= inverseInertiaA * (anchorAX * impulseY - anchorAY * impulseX);
		velocityBX += inverseMassB * impulseX;
		velocityBY += inverseMassB * impulseY;
		angularVelocityB += inverseInertiaB * (anchorBX * impulseY - anchorBY * impulseX);
	}

	// 마찰.
	const friction = contact.friction;
	for (let pointIndex = 0; pointIndex < manifold.pointCount; ++pointIndex) {
		const manifoldPoint = manifold.points[pointIndex];
		const anchorAX = manifoldPoint.anchorAX;
		const anchorAY = manifoldPoint.anchorAY;
		const anchorBX = manifoldPoint.anchorBX;
		const anchorBY = manifoldPoint.anchorBY;
		const relativeVelocityX = velocityBX - angularVelocityB * anchorBY - velocityAX + angularVelocityA * anchorAY;
		const relativeVelocityY = velocityBY + angularVelocityB * anchorBX - velocityAY - angularVelocityA * anchorAX;
		const tangentVelocity = tangentX * relativeVelocityX + tangentY * relativeVelocityY;
		let impulse = -manifoldPoint.tangentMass * tangentVelocity;
		const maximumFriction = friction * manifoldPoint.normalImpulse;
		const newImpulse = System.Math.max(-maximumFriction, System.Math.min(manifoldPoint.tangentImpulse + impulse, maximumFriction));
		impulse = newImpulse - manifoldPoint.tangentImpulse;
		manifoldPoint.tangentImpulse = newImpulse;
		const impulseX = impulse * tangentX;
		const impulseY = impulse * tangentY;
		velocityAX -= inverseMassA * impulseX;
		velocityAY -= inverseMassA * impulseY;
		angularVelocityA -= inverseInertiaA * (anchorAX * impulseY - anchorAY * impulseX);
		velocityBX += inverseMassB * impulseX;
		velocityBY += inverseMassB * impulseY;
		angularVelocityB += inverseInertiaB * (anchorBX * impulseY - anchorBY * impulseX);
	}

	if (contact.solverIndexA >= 0) {
		solverBodyA.linearVelocityX = velocityAX;
		solverBodyA.linearVelocityY = velocityAY;
		solverBodyA.angularVelocity = angularVelocityA;
	}
	if (contact.solverIndexB >= 0) {
		solverBodyB.linearVelocityX = velocityBX;
		solverBodyB.linearVelocityY = velocityBY;
		solverBodyB.angularVelocity = angularVelocityB;
	}
}

//==============================================================================
// 반발. (하위 걸음이 끝난 뒤 한 번, 처음 다가오던 속력이 문턱보다 크고 실제로 밀어낸 점만)
//==============================================================================
/**
 * @param { Contact } contact
 * @param { SolverBody[] } solverBodyList
 * @param { StepContext } context
 */
export function applyContactRestitution(contact, solverBodyList, context) {
	const restitution = contact.restitution;
	if (restitution === 0) {
		return;
	}
	const solverBodyA = contact.solverIndexA >= 0 ? solverBodyList[contact.solverIndexA] : STATIC_SOLVER_BODY;
	const solverBodyB = contact.solverIndexB >= 0 ? solverBodyList[contact.solverIndexB] : STATIC_SOLVER_BODY;
	const inverseMassA = contact.inverseMassA;
	const inverseMassB = contact.inverseMassB;
	const inverseInertiaA = contact.inverseInertiaA;
	const inverseInertiaB = contact.inverseInertiaB;
	let velocityAX = solverBodyA.linearVelocityX;
	let velocityAY = solverBodyA.linearVelocityY;
	let angularVelocityA = solverBodyA.angularVelocity;
	let velocityBX = solverBodyB.linearVelocityX;
	let velocityBY = solverBodyB.linearVelocityY;
	let angularVelocityB = solverBodyB.angularVelocity;
	const manifold = contact.manifold;
	const normalX = manifold.normalX;
	const normalY = manifold.normalY;
	const threshold = context.restitutionThreshold;
	for (let pointIndex = 0; pointIndex < manifold.pointCount; ++pointIndex) {
		const manifoldPoint = manifold.points[pointIndex];
		if (manifoldPoint.relativeVelocity > -threshold || manifoldPoint.maximumNormalImpulse === 0) {
			continue;
		}
		const anchorAX = manifoldPoint.anchorAX;
		const anchorAY = manifoldPoint.anchorAY;
		const anchorBX = manifoldPoint.anchorBX;
		const anchorBY = manifoldPoint.anchorBY;
		const relativeVelocityX = velocityBX - angularVelocityB * anchorBY - velocityAX + angularVelocityA * anchorAY;
		const relativeVelocityY = velocityBY + angularVelocityB * anchorBX - velocityAY - angularVelocityA * anchorAX;
		const normalVelocity = normalX * relativeVelocityX + normalY * relativeVelocityY;
		let impulse = -manifoldPoint.normalMass * (normalVelocity + restitution * manifoldPoint.relativeVelocity);
		const newImpulse = System.Math.max(manifoldPoint.normalImpulse + impulse, 0);
		impulse = newImpulse - manifoldPoint.normalImpulse;
		manifoldPoint.normalImpulse = newImpulse;
		manifoldPoint.maximumNormalImpulse = System.Math.max(manifoldPoint.maximumNormalImpulse, impulse);
		const impulseX = impulse * normalX;
		const impulseY = impulse * normalY;
		velocityAX -= inverseMassA * impulseX;
		velocityAY -= inverseMassA * impulseY;
		angularVelocityA -= inverseInertiaA * (anchorAX * impulseY - anchorAY * impulseX);
		velocityBX += inverseMassB * impulseX;
		velocityBY += inverseMassB * impulseY;
		angularVelocityB += inverseInertiaB * (anchorBX * impulseY - anchorBY * impulseX);
	}
	if (contact.solverIndexA >= 0) {
		solverBodyA.linearVelocityX = velocityAX;
		solverBodyA.linearVelocityY = velocityAY;
		solverBodyA.angularVelocity = angularVelocityA;
	}
	if (contact.solverIndexB >= 0) {
		solverBodyB.linearVelocityX = velocityBX;
		solverBodyB.linearVelocityY = velocityBY;
		solverBodyB.angularVelocity = angularVelocityB;
	}
}

//==============================================================================
// 회전을 각도 변화만큼 돌리고 길이를 1 로 맞추기. ([코사인, 사인])
//==============================================================================
/**
 * @param { number } cosine
 * @param { number } sine
 * @param { number } deltaAngle
 * @returns { number[] }
 */
export function integrateRotation(cosine, sine, deltaAngle) {
	const nextCosine = cosine - deltaAngle * sine;
	const nextSine = sine + deltaAngle * cosine;
	const magnitude = System.Math.sqrt(nextCosine * nextCosine + nextSine * nextSine);
	const inverseMagnitude = magnitude > 0 ? 1 / magnitude : 0;
	return [nextCosine * inverseMagnitude, nextSine * inverseMagnitude];
}
