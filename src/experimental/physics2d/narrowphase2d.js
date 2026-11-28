//==============================================================================
// 포함 모듈 목록.
//==============================================================================
// 옮긴 원문: Box2D 3 의 셈에서 옮김, MIT, THIRD_PARTY_LICENSES.md
const System = globalThis;
import { Object } from "../../base/object.js";
import { ShapeType2D } from "./geometry2d.js";


//==============================================================================
// 2D 물리의 좁은 단계. (안에서 쓴다, 공개 API 아님)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 모양 짝의 닿음점(매니폴드), 광선, 점 판정을 월드 좌표에서 셈한다.
// - 캡슐과 선분은 꼭짓점 2 개짜리 둥근 다각형으로 보고, 다각형끼리는 분리축(SAT)으로 기준 변을 고른 뒤 맞은편 변을 잘라 닿음점을 낸다.
//   떨어진 채 꼭짓점끼리 가장 가까우면 선분 거리로 꼭짓점과 꼭짓점 사이 법선을 쓴다. (Erin Catto, GDC 2007 Contact Manifolds 와 Box2D 3 의 방식)
// - 러스트 vanilla-engine 의 experimental::physics2d::narrowphase2d 와 같은 셈, 같은 차례다.
//==============================================================================

// 길이를 나눌 때 0 으로 보는 아주 작은 값.
const NORMALIZE_EPSILON = 1e-12;


//==============================================================================
// 월드 좌표의 모양. (매 걸음 몸의 자리로 채운다)
//==============================================================================
export class WorldShape extends Object {
	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.type = ShapeType2D.circle;
		this.count = 0;
		this.vertexX = [0, 0, 0, 0, 0, 0, 0, 0];
		this.vertexY = [0, 0, 0, 0, 0, 0, 0, 0];
		this.normalX = [0, 0, 0, 0, 0, 0, 0, 0];
		this.normalY = [0, 0, 0, 0, 0, 0, 0, 0];
		this.radius = 0;
		this.centerX = 0;
		this.centerY = 0;
	}
}

//==============================================================================
// 모양 자료를 몸의 자리와 회전으로 월드 모양에 채우기.
//==============================================================================
/**
 * @param { object } shapeData ShapeData.
 * @param { number } positionX
 * @param { number } positionY
 * @param { number } cosine
 * @param { number } sine
 * @param { WorldShape } worldShape
 */
export function fillWorldShape(shapeData, positionX, positionY, cosine, sine, worldShape) {
	worldShape.type = shapeData.type;
	worldShape.count = shapeData.count;
	worldShape.radius = shapeData.radius;
	worldShape.centerX = cosine * shapeData.centerX - sine * shapeData.centerY + positionX;
	worldShape.centerY = sine * shapeData.centerX + cosine * shapeData.centerY + positionY;
	for (let index = 0; index < shapeData.count; ++index) {
		worldShape.vertexX[index] = cosine * shapeData.vertexX[index] - sine * shapeData.vertexY[index] + positionX;
		worldShape.vertexY[index] = sine * shapeData.vertexX[index] + cosine * shapeData.vertexY[index] + positionY;
		worldShape.normalX[index] = cosine * shapeData.normalX[index] - sine * shapeData.normalY[index];
		worldShape.normalY[index] = sine * shapeData.normalX[index] + cosine * shapeData.normalY[index];
	}
}


//==============================================================================
// 닿음점 하나.
//==============================================================================
export class ManifoldPoint extends Object {
	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.pointX = 0; // 두 겉면 사이 가운데의 월드 점.
		this.pointY = 0;
		this.separation = 0; // 겉면 사이 거리. (음수면 파고듦)
		this.id = 0; // 모양 특징 번호. (걸음 사이 웜 스타트 짝짓기)
		this.normalImpulse = 0;
		this.tangentImpulse = 0;
		this.maximumNormalImpulse = 0;
		// 풀이 준비 값.
		this.anchorAX = 0;
		this.anchorAY = 0;
		this.anchorBX = 0;
		this.anchorBY = 0;
		this.baseSeparation = 0;
		this.normalMass = 0;
		this.tangentMass = 0;
		this.relativeVelocity = 0;
	}
}


//==============================================================================
// 매니폴드. (모양 짝의 법선과 닿음점 0 ~ 2 개, 법선은 A 에서 B 쪽)
//==============================================================================
export class Manifold extends Object {
	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.normalX = 0;
		this.normalY = 0;
		this.pointCount = 0;
		this.points = [new ManifoldPoint(), new ManifoldPoint()];
	}
}

//==============================================================================
// 매니폴드 점 하나 적기.
//==============================================================================
/**
 * @param { Manifold } manifold
 * @param { number } pointX
 * @param { number } pointY
 * @param { number } separation
 * @param { number } id
 */
function pushManifoldPoint(manifold, pointX, pointY, separation, id) {
	const manifoldPoint = manifold.points[manifold.pointCount];
	manifoldPoint.pointX = pointX;
	manifoldPoint.pointY = pointY;
	manifoldPoint.separation = separation;
	manifoldPoint.id = id;
	manifold.pointCount += 1;
}

//==============================================================================
// 두 월드 모양의 매니폴드. (A 가 원이면 B 도 원이어야 한다. 원은 늘 B 쪽)
//==============================================================================
/**
 * @param { WorldShape } shapeA
 * @param { WorldShape } shapeB
 * @param { number } speculativeDistance 이 거리 안이면 떨어져 있어도 닿음점을 낸다.
 * @param { number } linearSlop 허용 오차 길이.
 * @param { Manifold } manifold 결과를 적을 곳.
 */
export function collideShapes(shapeA, shapeB, speculativeDistance, linearSlop, manifold) {
	manifold.pointCount = 0;
	if (shapeA.type === ShapeType2D.circle) {
		collideCircles(shapeA, shapeB, speculativeDistance, manifold);
		return;
	}
	if (shapeB.type === ShapeType2D.circle) {
		collidePolygonAndCircle(shapeA, shapeB, speculativeDistance, manifold);
		return;
	}
	collidePolygons(shapeA, shapeB, speculativeDistance, linearSlop, manifold);
}

//==============================================================================
// 원과 원.
//==============================================================================
/**
 * @param { WorldShape } shapeA
 * @param { WorldShape } shapeB
 * @param { number } speculativeDistance
 * @param { Manifold } manifold
 */
function collideCircles(shapeA, shapeB, speculativeDistance, manifold) {
	const differenceX = shapeB.centerX - shapeA.centerX;
	const differenceY = shapeB.centerY - shapeA.centerY;
	const distance = System.Math.sqrt(differenceX * differenceX + differenceY * differenceY);
	const separation = distance - shapeA.radius - shapeB.radius;
	if (separation > speculativeDistance) {
		return;
	}
	let normalX = 1;
	let normalY = 0;
	if (distance > NORMALIZE_EPSILON) {
		normalX = differenceX / distance;
		normalY = differenceY / distance;
	}
	const surfaceAX = shapeA.centerX + shapeA.radius * normalX;
	const surfaceAY = shapeA.centerY + shapeA.radius * normalY;
	const surfaceBX = shapeB.centerX - shapeB.radius * normalX;
	const surfaceBY = shapeB.centerY - shapeB.radius * normalY;
	manifold.normalX = normalX;
	manifold.normalY = normalY;
	pushManifoldPoint(manifold, 0.5 * (surfaceAX + surfaceBX), 0.5 * (surfaceAY + surfaceBY), separation, 0);
}

//==============================================================================
// 둥근 다각형(캡슐, 선분 포함)과 원.
//==============================================================================
/**
 * @param { WorldShape } shapeA
 * @param { WorldShape } shapeB
 * @param { number } speculativeDistance
 * @param { Manifold } manifold
 */
function collidePolygonAndCircle(shapeA, shapeB, speculativeDistance, manifold) {
	const centerX = shapeB.centerX;
	const centerY = shapeB.centerY;
	const radius = shapeA.radius + shapeB.radius;
	let separation = System.Number.NEGATIVE_INFINITY;
	let normalIndex = 0;
	for (let index = 0; index < shapeA.count; ++index) {
		const edgeSeparation = shapeA.normalX[index] * (centerX - shapeA.vertexX[index]) + shapeA.normalY[index] * (centerY - shapeA.vertexY[index]);
		if (edgeSeparation > separation) {
			separation = edgeSeparation;
			normalIndex = index;
		}
	}
	if (separation > radius + speculativeDistance) {
		return;
	}
	const nextIndex = (normalIndex + 1) % shapeA.count;
	const vertex1X = shapeA.vertexX[normalIndex];
	const vertex1Y = shapeA.vertexY[normalIndex];
	const vertex2X = shapeA.vertexX[nextIndex];
	const vertex2Y = shapeA.vertexY[nextIndex];
	const fraction1 = (centerX - vertex1X) * (vertex2X - vertex1X) + (centerY - vertex1Y) * (vertex2Y - vertex1Y);
	const fraction2 = (centerX - vertex2X) * (vertex1X - vertex2X) + (centerY - vertex2Y) * (vertex1Y - vertex2Y);

	let normalX = 0;
	let normalY = 0;
	let surfaceAX = 0;
	let surfaceAY = 0;
	if ((fraction1 < 0 || fraction2 < 0) && separation > NORMALIZE_EPSILON) {
		// 꼭짓점 쪽.
		const vertexX = fraction1 < 0 ? vertex1X : vertex2X;
		const vertexY = fraction1 < 0 ? vertex1Y : vertex2Y;
		const differenceX = centerX - vertexX;
		const differenceY = centerY - vertexY;
		const distance = System.Math.sqrt(differenceX * differenceX + differenceY * differenceY);
		if (distance > radius + speculativeDistance) {
			return;
		}
		normalX = differenceX / distance;
		normalY = differenceY / distance;
		surfaceAX = vertexX + shapeA.radius * normalX;
		surfaceAY = vertexY + shapeA.radius * normalY;
	}
	else {
		// 변 쪽.
		normalX = shapeA.normalX[normalIndex];
		normalY = shapeA.normalY[normalIndex];
		const centerDistance = (centerX - vertex1X) * normalX + (centerY - vertex1Y) * normalY;
		surfaceAX = centerX + (shapeA.radius - centerDistance) * normalX;
		surfaceAY = centerY + (shapeA.radius - centerDistance) * normalY;
	}
	const surfaceBX = centerX - shapeB.radius * normalX;
	const surfaceBY = centerY - shapeB.radius * normalY;
	manifold.normalX = normalX;
	manifold.normalY = normalY;
	const pointSeparation = (surfaceBX - surfaceAX) * normalX + (surfaceBY - surfaceAY) * normalY;
	pushManifoldPoint(manifold, 0.5 * (surfaceAX + surfaceBX), 0.5 * (surfaceAY + surfaceBY), pointSeparation, 0);
}

//==============================================================================
// shape1 의 변 가운데 shape2 의 꼭짓점이 가장 멀리 떨어진 변. ([변 번호, 떨어진 거리])
//==============================================================================
/**
 * @param { WorldShape } shape1
 * @param { WorldShape } shape2
 * @returns { number[] }
 */
function findMaximumSeparation(shape1, shape2) {
	let bestIndex = 0;
	let maximumSeparation = System.Number.NEGATIVE_INFINITY;
	for (let index = 0; index < shape1.count; ++index) {
		const normalX = shape1.normalX[index];
		const normalY = shape1.normalY[index];
		const vertexX = shape1.vertexX[index];
		const vertexY = shape1.vertexY[index];
		let minimumSeparation = System.Number.POSITIVE_INFINITY;
		for (let otherIndex = 0; otherIndex < shape2.count; ++otherIndex) {
			const separation = normalX * (shape2.vertexX[otherIndex] - vertexX) + normalY * (shape2.vertexY[otherIndex] - vertexY);
			if (separation < minimumSeparation) {
				minimumSeparation = separation;
			}
		}
		if (minimumSeparation > maximumSeparation) {
			maximumSeparation = minimumSeparation;
			bestIndex = index;
		}
	}
	return [bestIndex, maximumSeparation];
}

//==============================================================================
// 두 선분의 가장 가까운 점. (Ericson, Real-Time Collision Detection 5.1.9, [몫1, 몫2, 거리 제곱])
//==============================================================================
/**
 * @param { number } point1X
 * @param { number } point1Y
 * @param { number } end1X
 * @param { number } end1Y
 * @param { number } point2X
 * @param { number } point2Y
 * @param { number } end2X
 * @param { number } end2Y
 * @returns { number[] }
 */
export function computeSegmentDistance(point1X, point1Y, end1X, end1Y, point2X, point2Y, end2X, end2Y) {
	const direction1X = end1X - point1X;
	const direction1Y = end1Y - point1Y;
	const direction2X = end2X - point2X;
	const direction2Y = end2Y - point2Y;
	const offsetX = point1X - point2X;
	const offsetY = point1Y - point2Y;
	const lengthSquared1 = direction1X * direction1X + direction1Y * direction1Y;
	const lengthSquared2 = direction2X * direction2X + direction2Y * direction2Y;
	const offsetDot2 = direction2X * offsetX + direction2Y * offsetY;
	let fraction1 = 0;
	let fraction2 = 0;
	if (lengthSquared1 <= NORMALIZE_EPSILON && lengthSquared2 <= NORMALIZE_EPSILON) {
		fraction1 = 0;
		fraction2 = 0;
	}
	else if (lengthSquared1 <= NORMALIZE_EPSILON) {
		fraction1 = 0;
		fraction2 = clamp(offsetDot2 / lengthSquared2, 0, 1);
	}
	else {
		const offsetDot1 = direction1X * offsetX + direction1Y * offsetY;
		if (lengthSquared2 <= NORMALIZE_EPSILON) {
			fraction2 = 0;
			fraction1 = clamp(-offsetDot1 / lengthSquared1, 0, 1);
		}
		else {
			const directionDot = direction1X * direction2X + direction1Y * direction2Y;
			const denominator = lengthSquared1 * lengthSquared2 - directionDot * directionDot;
			if (denominator !== 0) {
				fraction1 = clamp((directionDot * offsetDot2 - offsetDot1 * lengthSquared2) / denominator, 0, 1);
			}
			else {
				fraction1 = 0;
			}
			fraction2 = (directionDot * fraction1 + offsetDot2) / lengthSquared2;
			if (fraction2 < 0) {
				fraction2 = 0;
				fraction1 = clamp(-offsetDot1 / lengthSquared1, 0, 1);
			}
			else if (fraction2 > 1) {
				fraction2 = 1;
				fraction1 = clamp((directionDot - offsetDot1) / lengthSquared1, 0, 1);
			}
		}
	}
	const closest1X = point1X + direction1X * fraction1;
	const closest1Y = point1Y + direction1Y * fraction1;
	const closest2X = point2X + direction2X * fraction2;
	const closest2Y = point2Y + direction2Y * fraction2;
	const differenceX = closest2X - closest1X;
	const differenceY = closest2Y - closest1Y;
	return [fraction1, fraction2, differenceX * differenceX + differenceY * differenceY];
}

//==============================================================================
// 값을 범위로 자르기.
//==============================================================================
/**
 * @param { number } value
 * @param { number } minimum
 * @param { number } maximum
 * @returns { number }
 */
function clamp(value, minimum, maximum) {
	if (value < minimum) {
		return minimum;
	}
	if (value > maximum) {
		return maximum;
	}
	return value;
}

//==============================================================================
// 둥근 다각형과 둥근 다각형. (캡슐과 선분 포함)
//==============================================================================
/**
 * @param { WorldShape } shapeA
 * @param { WorldShape } shapeB
 * @param { number } speculativeDistance
 * @param { number } linearSlop
 * @param { Manifold } manifold
 */
function collidePolygons(shapeA, shapeB, speculativeDistance, linearSlop, manifold) {
	const resultA = findMaximumSeparation(shapeA, shapeB);
	const resultB = findMaximumSeparation(shapeB, shapeA);
	const edgeA = resultA[0];
	const separationA = resultA[1];
	const edgeB = resultB[0];
	const separationB = resultB[1];
	const radius = shapeA.radius + shapeB.radius;
	if (separationA > speculativeDistance + radius || separationB > speculativeDistance + radius) {
		return;
	}

	// 기준 변. (B 쪽이 확실히 더 떨어졌을 때만 B 를 기준으로 삼아 걸음마다 바뀌어 떨지 않게)
	let isFlipped = false;
	let shape1 = shapeA;
	let shape2 = shapeB;
	let edge1 = edgeA;
	let separation = separationA;
	if (separationB > separationA + 0.1 * linearSlop) {
		isFlipped = true;
		shape1 = shapeB;
		shape2 = shapeA;
		edge1 = edgeB;
		separation = separationB;
	}

	// 맞은편 변. (기준 법선과 가장 반대로 향한 변)
	const referenceNormalX = shape1.normalX[edge1];
	const referenceNormalY = shape1.normalY[edge1];
	let edge2 = 0;
	let minimumDot = System.Number.POSITIVE_INFINITY;
	for (let index = 0; index < shape2.count; ++index) {
		const dot = referenceNormalX * shape2.normalX[index] + referenceNormalY * shape2.normalY[index];
		if (dot < minimumDot) {
			minimumDot = dot;
			edge2 = index;
		}
	}

	if (separation > 0.1 * linearSlop) {
		// 떨어져 있으면 두 변의 가장 가까운 점을 보고, 꼭짓점끼리면 그 사이 방향을 법선으로 쓴다.
		const index11 = edge1;
		const index12 = (edge1 + 1) % shape1.count;
		const index21 = edge2;
		const index22 = (edge2 + 1) % shape2.count;
		const distanceResult = computeSegmentDistance(shape1.vertexX[index11], shape1.vertexY[index11], shape1.vertexX[index12], shape1.vertexY[index12], shape2.vertexX[index21], shape2.vertexY[index21], shape2.vertexX[index22], shape2.vertexY[index22]);
		const fraction1 = distanceResult[0];
		const fraction2 = distanceResult[1];
		const distanceSquared = distanceResult[2];
		const isVertex1 = fraction1 === 0 || fraction1 === 1;
		const isVertex2 = fraction2 === 0 || fraction2 === 1;
		if (isVertex1 && isVertex2) {
			const vertexIndex1 = fraction1 === 0 ? index11 : index12;
			const vertexIndex2 = fraction2 === 0 ? index21 : index22;
			const vertex1X = shape1.vertexX[vertexIndex1];
			const vertex1Y = shape1.vertexY[vertexIndex1];
			const vertex2X = shape2.vertexX[vertexIndex2];
			const vertex2Y = shape2.vertexY[vertexIndex2];
			const distance = System.Math.sqrt(distanceSquared);
			if (distance > speculativeDistance + radius) {
				return;
			}
			if (distance > NORMALIZE_EPSILON) {
				let normalX = (vertex2X - vertex1X) / distance;
				let normalY = (vertex2Y - vertex1Y) / distance;
				const surface1X = vertex1X + shape1.radius * normalX;
				const surface1Y = vertex1Y + shape1.radius * normalY;
				const surface2X = vertex2X - shape2.radius * normalX;
				const surface2Y = vertex2Y - shape2.radius * normalY;
				let id = vertexIndex1 * 256 + vertexIndex2;
				if (isFlipped) {
					normalX = -normalX;
					normalY = -normalY;
					id = vertexIndex2 * 256 + vertexIndex1;
				}
				manifold.normalX = normalX;
				manifold.normalY = normalY;
				pushManifoldPoint(manifold, 0.5 * (surface1X + surface2X), 0.5 * (surface1Y + surface2Y), distance - radius, id);
				return;
			}
		}
	}
	clipPolygons(shape1, shape2, edge1, edge2, isFlipped, speculativeDistance, manifold);
}

//==============================================================================
// 기준 변의 옆면으로 맞은편 변을 잘라 닿음점 두 개를 내기.
//==============================================================================
/**
 * @param { WorldShape } shape1 기준 모양.
 * @param { WorldShape } shape2 맞은편 모양.
 * @param { number } edge1
 * @param { number } edge2
 * @param { boolean } isFlipped shape1 이 B 면 참.
 * @param { number } speculativeDistance
 * @param { Manifold } manifold
 */
function clipPolygons(shape1, shape2, edge1, edge2, isFlipped, speculativeDistance, manifold) {
	const index11 = edge1;
	const index12 = (edge1 + 1) % shape1.count;
	const index21 = edge2;
	const index22 = (edge2 + 1) % shape2.count;
	const vertex11X = shape1.vertexX[index11];
	const vertex11Y = shape1.vertexY[index11];
	const vertex12X = shape1.vertexX[index12];
	const vertex12Y = shape1.vertexY[index12];
	const vertex21X = shape2.vertexX[index21];
	const vertex21Y = shape2.vertexY[index21];
	const vertex22X = shape2.vertexX[index22];
	const vertex22Y = shape2.vertexY[index22];
	const normalX = shape1.normalX[index11];
	const normalY = shape1.normalY[index11];
	const tangentX = -normalY;
	const tangentY = normalX;

	const lower1 = 0;
	const upper1 = (vertex12X - vertex11X) * tangentX + (vertex12Y - vertex11Y) * tangentY;
	const upper2 = (vertex21X - vertex11X) * tangentX + (vertex21Y - vertex11Y) * tangentY;
	const lower2 = (vertex22X - vertex11X) * tangentX + (vertex22Y - vertex11Y) * tangentY;
	const span = upper2 - lower2;

	let lowerX = vertex22X;
	let lowerY = vertex22Y;
	if (lower2 < lower1 && span > NORMALIZE_EPSILON) {
		const fraction = clamp((lower1 - lower2) / span, 0, 1);
		lowerX = vertex22X + fraction * (vertex21X - vertex22X);
		lowerY = vertex22Y + fraction * (vertex21Y - vertex22Y);
	}
	let upperX = vertex21X;
	let upperY = vertex21Y;
	if (upper2 > upper1 && span > NORMALIZE_EPSILON) {
		const fraction = clamp((upper1 - lower2) / span, 0, 1);
		upperX = vertex22X + fraction * (vertex21X - vertex22X);
		upperY = vertex22Y + fraction * (vertex21Y - vertex22Y);
	}
	const separationLower = (lowerX - vertex11X) * normalX + (lowerY - vertex11Y) * normalY;
	const separationUpper = (upperX - vertex11X) * normalX + (upperY - vertex11Y) * normalY;
	// 두 겉면의 가운데로 옮긴다.
	const shiftLower = 0.5 * (shape1.radius - shape2.radius - separationLower);
	const shiftUpper = 0.5 * (shape1.radius - shape2.radius - separationUpper);
	lowerX += shiftLower * normalX;
	lowerY += shiftLower * normalY;
	upperX += shiftUpper * normalX;
	upperY += shiftUpper * normalY;
	const radius = shape1.radius + shape2.radius;

	if (!isFlipped) {
		manifold.normalX = normalX;
		manifold.normalY = normalY;
		if (separationLower - radius <= speculativeDistance) {
			pushManifoldPoint(manifold, lowerX, lowerY, separationLower - radius, index11 * 256 + index22);
		}
		if (separationUpper - radius <= speculativeDistance) {
			pushManifoldPoint(manifold, upperX, upperY, separationUpper - radius, index12 * 256 + index21);
		}
	}
	else {
		manifold.normalX = -normalX;
		manifold.normalY = -normalY;
		if (separationUpper - radius <= speculativeDistance) {
			pushManifoldPoint(manifold, upperX, upperY, separationUpper - radius, index21 * 256 + index12);
		}
		if (separationLower - radius <= speculativeDistance) {
			pushManifoldPoint(manifold, lowerX, lowerY, separationLower - radius, index22 * 256 + index11);
		}
	}
}

//==============================================================================
// 광선이 월드 모양에 맞는지. (맞으면 [몫, 맞은 점 x, y, 법선 x, y], 아니면 null. 시작점이 안에 있으면 맞지 않은 것으로 친다)
//==============================================================================
/**
 * @param { WorldShape } shape
 * @param { number } originX
 * @param { number } originY
 * @param { number } translationX
 * @param { number } translationY
 * @param { number } maximumFraction
 * @returns { number[] | null }
 */
export function rayCastWorldShape(shape, originX, originY, translationX, translationY, maximumFraction) {
	if (shape.type === ShapeType2D.circle) {
		return rayCastCircle(shape.centerX, shape.centerY, shape.radius, originX, originY, translationX, translationY, maximumFraction);
	}
	if (shape.radius > 0) {
		const isInside = testPointInWorldShape(shape, originX, originY);
		if (isInside) {
			return null;
		}
		let bestResult = null;
		let bestFraction = maximumFraction;
		for (let index = 0; index < shape.count; ++index) {
			const circleResult = rayCastCircle(shape.vertexX[index], shape.vertexY[index], shape.radius, originX, originY, translationX, translationY, bestFraction);
			if (circleResult !== null && circleResult[0] <= bestFraction) {
				bestFraction = circleResult[0];
				bestResult = circleResult;
			}
			const nextIndex = (index + 1) % shape.count;
			const normalX = shape.normalX[index];
			const normalY = shape.normalY[index];
			const edgeStartX = shape.vertexX[index] + shape.radius * normalX;
			const edgeStartY = shape.vertexY[index] + shape.radius * normalY;
			const edgeEndX = shape.vertexX[nextIndex] + shape.radius * normalX;
			const edgeEndY = shape.vertexY[nextIndex] + shape.radius * normalY;
			const edgeResult = rayCastOneSidedEdge(edgeStartX, edgeStartY, edgeEndX, edgeEndY, normalX, normalY, originX, originY, translationX, translationY, bestFraction);
			if (edgeResult !== null && edgeResult[0] <= bestFraction) {
				bestFraction = edgeResult[0];
				bestResult = edgeResult;
			}
		}
		return bestResult;
	}
	if (shape.count === 2) {
		return rayCastSegment(shape.vertexX[0], shape.vertexY[0], shape.vertexX[1], shape.vertexY[1], originX, originY, translationX, translationY, maximumFraction);
	}

	// 뾰족한 다각형. (Cyrus-Beck 자르기)
	let lower = 0;
	let upper = maximumFraction;
	let hitIndex = -1;
	for (let index = 0; index < shape.count; ++index) {
		const numerator = shape.normalX[index] * (shape.vertexX[index] - originX) + shape.normalY[index] * (shape.vertexY[index] - originY);
		const denominator = shape.normalX[index] * translationX + shape.normalY[index] * translationY;
		if (denominator === 0) {
			if (numerator < 0) {
				return null;
			}
		}
		else if (denominator < 0 && numerator < lower * denominator) {
			lower = numerator / denominator;
			hitIndex = index;
		}
		else if (denominator > 0 && numerator < upper * denominator) {
			upper = numerator / denominator;
		}
		if (upper < lower) {
			return null;
		}
	}
	if (hitIndex < 0) {
		return null;
	}
	return [lower, originX + lower * translationX, originY + lower * translationY, shape.normalX[hitIndex], shape.normalY[hitIndex]];
}

//==============================================================================
// 광선과 원.
//==============================================================================
/**
 * @param { number } centerX
 * @param { number } centerY
 * @param { number } radius
 * @param { number } originX
 * @param { number } originY
 * @param { number } translationX
 * @param { number } translationY
 * @param { number } maximumFraction
 * @returns { number[] | null }
 */
function rayCastCircle(centerX, centerY, radius, originX, originY, translationX, translationY, maximumFraction) {
	const offsetX = originX - centerX;
	const offsetY = originY - centerY;
	const length = System.Math.sqrt(translationX * translationX + translationY * translationY);
	if (length <= NORMALIZE_EPSILON) {
		return null;
	}
	const directionX = translationX / length;
	const directionY = translationY / length;
	// 광선 위에서 원 중심에 가장 가까운 점.
	const closestDistance = -(offsetX * directionX + offsetY * directionY);
	const closestX = offsetX + closestDistance * directionX;
	const closestY = offsetY + closestDistance * directionY;
	const closestSquared = closestX * closestX + closestY * closestY;
	const radiusSquared = radius * radius;
	if (closestSquared > radiusSquared) {
		return null;
	}
	const halfChord = System.Math.sqrt(radiusSquared - closestSquared);
	const hitDistance = closestDistance - halfChord;
	if (hitDistance < 0 || hitDistance > maximumFraction * length) {
		return null;
	}
	const hitX = originX + hitDistance * directionX;
	const hitY = originY + hitDistance * directionY;
	const normalX = (hitX - centerX) / radius;
	const normalY = (hitY - centerY) / radius;
	return [hitDistance / length, hitX, hitY, normalX, normalY];
}

//==============================================================================
// 광선과 양면 선분. (법선은 광선 쪽)
//==============================================================================
/**
 * @param { number } point1X
 * @param { number } point1Y
 * @param { number } point2X
 * @param { number } point2Y
 * @param { number } originX
 * @param { number } originY
 * @param { number } translationX
 * @param { number } translationY
 * @param { number } maximumFraction
 * @returns { number[] | null }
 */
function rayCastSegment(point1X, point1Y, point2X, point2Y, originX, originY, translationX, translationY, maximumFraction) {
	const edgeX = point2X - point1X;
	const edgeY = point2Y - point1Y;
	const edgeLength = System.Math.sqrt(edgeX * edgeX + edgeY * edgeY);
	if (edgeLength <= NORMALIZE_EPSILON) {
		return null;
	}
	let normalX = edgeY / edgeLength;
	let normalY = -edgeX / edgeLength;
	const numerator = normalX * (point1X - originX) + normalY * (point1Y - originY);
	const denominator = normalX * translationX + normalY * translationY;
	if (denominator === 0) {
		return null;
	}
	const fraction = numerator / denominator;
	if (fraction < 0 || fraction > maximumFraction) {
		return null;
	}
	const hitX = originX + fraction * translationX;
	const hitY = originY + fraction * translationY;
	const edgeFraction = ((hitX - point1X) * edgeX + (hitY - point1Y) * edgeY) / (edgeLength * edgeLength);
	if (edgeFraction < 0 || edgeFraction > 1) {
		return null;
	}
	if (numerator > 0) {
		normalX = -normalX;
		normalY = -normalY;
	}
	return [fraction, hitX, hitY, normalX, normalY];
}

//==============================================================================
// 광선과 한쪽 면 변. (normal 쪽 밖에서 들어오는 광선만)
//==============================================================================
/**
 * @param { number } startX
 * @param { number } startY
 * @param { number } endX
 * @param { number } endY
 * @param { number } normalX
 * @param { number } normalY
 * @param { number } originX
 * @param { number } originY
 * @param { number } translationX
 * @param { number } translationY
 * @param { number } maximumFraction
 * @returns { number[] | null }
 */
function rayCastOneSidedEdge(startX, startY, endX, endY, normalX, normalY, originX, originY, translationX, translationY, maximumFraction) {
	const numerator = normalX * (startX - originX) + normalY * (startY - originY);
	const denominator = normalX * translationX + normalY * translationY;
	if (denominator >= 0 || numerator > 0) {
		return null;
	}
	const fraction = numerator / denominator;
	if (fraction < 0 || fraction > maximumFraction) {
		return null;
	}
	const hitX = originX + fraction * translationX;
	const hitY = originY + fraction * translationY;
	const edgeX = endX - startX;
	const edgeY = endY - startY;
	const edgeLengthSquared = edgeX * edgeX + edgeY * edgeY;
	const edgeFraction = ((hitX - startX) * edgeX + (hitY - startY) * edgeY) / edgeLengthSquared;
	if (edgeFraction < 0 || edgeFraction > 1) {
		return null;
	}
	return [fraction, hitX, hitY, normalX, normalY];
}

//==============================================================================
// 점이 월드 모양 안에 있는지. (경계 위도 안)
//==============================================================================
/**
 * @param { WorldShape } shape
 * @param { number } pointX
 * @param { number } pointY
 * @returns { boolean }
 */
export function testPointInWorldShape(shape, pointX, pointY) {
	if (shape.type === ShapeType2D.circle) {
		const differenceX = pointX - shape.centerX;
		const differenceY = pointY - shape.centerY;
		return differenceX * differenceX + differenceY * differenceY <= shape.radius * shape.radius;
	}
	if (shape.count >= 3) {
		let maximumSeparation = System.Number.NEGATIVE_INFINITY;
		for (let index = 0; index < shape.count; ++index) {
			const separation = shape.normalX[index] * (pointX - shape.vertexX[index]) + shape.normalY[index] * (pointY - shape.vertexY[index]);
			maximumSeparation = System.Math.max(maximumSeparation, separation);
		}
		if (maximumSeparation <= 0) {
			return true;
		}
		if (shape.radius <= 0) {
			return false;
		}
	}
	else if (shape.radius <= 0) {
		return false;
	}
	// 둥근 겉면. (가장 가까운 변까지의 거리가 반지름 안)
	const radiusSquared = shape.radius * shape.radius;
	for (let index = 0; index < shape.count; ++index) {
		const nextIndex = (index + 1) % shape.count;
		const distanceResult = computeSegmentDistance(shape.vertexX[index], shape.vertexY[index], shape.vertexX[nextIndex], shape.vertexY[nextIndex], pointX, pointY, pointX, pointY);
		if (distanceResult[2] <= radiusSquared) {
			return true;
		}
	}
	return false;
}
