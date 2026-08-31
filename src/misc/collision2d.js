//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";


//==============================================================================
// 2D 충돌 유틸.
// - 원-원 겹침 분리(밀어내기)와 반경 최근접 탐색처럼 액션 게임마다 재발명되던 판정을 모았다.
//==============================================================================
export class Collision2D extends Object {
	//==============================================================================
	// 원-원 겹침 검사. (정적)
	//==============================================================================
	/**
	 * @param { Vector2 } positionA
	 * @param { number } radiusA
	 * @param { Vector2 } positionB
	 * @param { number } radiusB
	 * @returns { boolean }
	 */
	static testCircleOverlap(positionA, radiusA, positionB, radiusB) {
		const differenceX = positionB.x - positionA.x;
		const differenceY = positionB.y - positionA.y;
		const radiusSum = radiusA + radiusB;
		return differenceX * differenceX + differenceY * differenceY < radiusSum * radiusSum;
	}

	//==============================================================================
	// 원-원 겹침 분리. (정적)
	// - 겹쳐 있으면 서로 절반씩 밀어낼 이동량을 반환한다. 안 겹치면 null.
	// - isStaticB 가 참이면 B 는 고정물로 보고 A 만 전체 거리를 밀린다.
	// - 두 중심이 정확히 같으면 임의의 축(x)으로 밀어낸다.
	//==============================================================================
	/**
	 * @param { Vector2 } positionA
	 * @param { number } radiusA
	 * @param { Vector2 } positionB
	 * @param { number } radiusB
	 * @param { boolean } isStaticB
	 * @returns { object | null } { pushA: Vector2, pushB: Vector2 }
	 */
	static resolveCircleOverlap(positionA, radiusA, positionB, radiusB, isStaticB = false) {
		const differenceX = positionB.x - positionA.x;
		const differenceY = positionB.y - positionA.y;
		const radiusSum = radiusA + radiusB;
		const distanceSquared = differenceX * differenceX + differenceY * differenceY;
		if (distanceSquared >= radiusSum * radiusSum) {
			return null;
		}
		const distance = System.Math.sqrt(distanceSquared);
		let directionX = 1;
		let directionY = 0;
		if (distance > 0.000001) {
			directionX = differenceX / distance;
			directionY = differenceY / distance;
		}
		const overlapDepth = radiusSum - distance;
		if (isStaticB) {
			return {
				pushA: Vector2.create(-directionX * overlapDepth, -directionY * overlapDepth),
				pushB: Vector2.create(0, 0),
			};
		}
		const halfDepth = overlapDepth * 0.5;
		return {
			pushA: Vector2.create(-directionX * halfDepth, -directionY * halfDepth),
			pushB: Vector2.create(directionX * halfDepth, directionY * halfDepth),
		};
	}

	//==============================================================================
	// 반경 안 최근접 대상 찾기. (정적)
	// - 투사체 명중 판정처럼 "중심에서 radius 안에 있는 것 중 가장 가까운 것" 을 찾는다.
	//==============================================================================
	/**
	 * @template T
	 * @param { T[] } targetList
	 * @param { Function } getPositionHandler (target) => Vector2
	 * @param { Vector2 } center
	 * @param { number } radius
	 * @returns { T | null }
	 */
	static findNearestInRadius(targetList, getPositionHandler, center, radius) {
		let nearestTarget = null;
		let nearestDistanceSquared = radius * radius;
		for (const target of targetList) {
			const targetPosition = getPositionHandler(target);
			const differenceX = targetPosition.x - center.x;
			const differenceY = targetPosition.y - center.y;
			const distanceSquared = differenceX * differenceX + differenceY * differenceY;
			if (distanceSquared <= nearestDistanceSquared) {
				nearestDistanceSquared = distanceSquared;
				nearestTarget = target;
			}
		}
		return nearestTarget;
	}

	//==============================================================================
	// 점-원 포함 검사. (정적)
	//==============================================================================
	/**
	 * @param { Vector2 } point
	 * @param { Vector2 } center
	 * @param { number } radius
	 * @returns { boolean }
	 */
	static testPointInCircle(point, center, radius) {
		const differenceX = point.x - center.x;
		const differenceY = point.y - center.y;
		return differenceX * differenceX + differenceY * differenceY <= radius * radius;
	}
}
