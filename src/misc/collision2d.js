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
/**
 * @example <caption>두 원의 겹침을 검사하고 밀어내기</caption>
 * import { Collision2D, Vector2 } from "./build/vanilla.js";
 *
 * let positionA = Vector2.create(0, 0);
 * let positionB = Vector2.create(15, 0);
 * console.log(Collision2D.testCircleOverlap(positionA, 10, positionB, 10));
 *
 * const push = Collision2D.resolveCircleOverlap(positionA, 10, positionB, 10);
 * if (push !== null) {
 * 	positionA = positionA.add(push.pushA);
 * 	positionB = positionB.add(push.pushB);
 * }
 * console.log(positionA.x, positionB.x);
 * console.log(Collision2D.testCircleOverlap(positionA, 10, positionB, 10));
 */
export class Collision2D extends Object {
	//==============================================================================
	// 원-원 겹침 검사. (정적)
	//==============================================================================
	/**
	 * @param { Vector2 } positionA 원 A 의 중심.
	 * @param { number } radiusA 원 A 의 반지름.
	 * @param { Vector2 } positionB 원 B 의 중심.
	 * @param { number } radiusB 원 B 의 반지름.
	 * @returns { boolean } 두 원이 겹치면 참. (딱 닿기만 하면 거짓)
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
	 * @param { Vector2 } positionA 원 A 의 중심.
	 * @param { number } radiusA 원 A 의 반지름.
	 * @param { Vector2 } positionB 원 B 의 중심.
	 * @param { number } radiusB 원 B 의 반지름.
	 * @param { boolean } isStaticB B 를 움직이지 않는 고정물로 볼지. (기본 거짓)
	 * @returns { object | null } { pushA: Vector2, pushB: Vector2 }
	 * @example <caption>고정된 벽 원에서 A 만 밀어내기</caption>
	 * import { Collision2D, Vector2 } from "./build/vanilla.js";
	 *
	 * let playerPosition = Vector2.create(18, 0);
	 * const wallPosition = Vector2.create(0, 0);
	 * const push = Collision2D.resolveCircleOverlap(playerPosition, 8, wallPosition, 12, true);
	 * if (push !== null) {
	 * 	playerPosition = playerPosition.add(push.pushA);
	 * }
	 * console.log(playerPosition.x, playerPosition.y);
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
	 * @param { T[] } targetList 찾을 대상 목록.
	 * @param { Function } getPositionHandler (target) => Vector2
	 * @param { Vector2 } center 찾기 중심.
	 * @param { number } radius 찾기 반지름. (경계 포함)
	 * @returns { T | null } 반경 안에서 가장 가까운 대상. (없으면 null, 거리가 같으면 뒤의 것)
	 * @example <caption>반경 안에서 가장 가까운 적 찾기</caption>
	 * import { Collision2D, Vector2 } from "./build/vanilla.js";
	 *
	 * const enemyList = [
	 * 	{ name: "slime", position: Vector2.create(40, 0) },
	 * 	{ name: "bat", position: Vector2.create(10, 5) },
	 * 	{ name: "golem", position: Vector2.create(300, 0) },
	 * ];
	 * const center = Vector2.create(0, 0);
	 * const nearest = Collision2D.findNearestInRadius(enemyList, (enemy) => enemy.position, center, 50);
	 * console.log(nearest.name);
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
	// 반경 안 최근접 대상 번호 찾기. (정적, findNearestInRadius 와 같은 판정으로 번호를 돌려준다, 없으면 -1)
	// - 거리가 같으면 뒤의 것이다.
	//==============================================================================
	/**
	 * @template T
	 * @param { T[] } targetList 찾을 대상 목록.
	 * @param { Function } getPositionHandler (target) => Vector2
	 * @param { Vector2 } center 찾기 중심.
	 * @param { number } radius 찾기 반지름. (경계 포함)
	 * @returns { number } 반경 안에서 가장 가까운 대상의 번호. (없으면 -1)
	 */
	static findNearestIndexInRadius(targetList, getPositionHandler, center, radius) {
		let nearestIndex = -1;
		let nearestDistanceSquared = radius * radius;
		for (let targetIndex = 0; targetIndex < targetList.length; ++targetIndex) {
			const target = targetList[targetIndex];
			const targetPosition = getPositionHandler(target);
			const differenceX = targetPosition.x - center.x;
			const differenceY = targetPosition.y - center.y;
			const distanceSquared = differenceX * differenceX + differenceY * differenceY;
			if (distanceSquared <= nearestDistanceSquared) {
				nearestDistanceSquared = distanceSquared;
				nearestIndex = targetIndex;
			}
		}
		return nearestIndex;
	}

	//==============================================================================
	// 점-원 포함 검사. (정적)
	//==============================================================================
	/**
	 * @param { Vector2 } point 검사할 점.
	 * @param { Vector2 } center 원의 중심.
	 * @param { number } radius 원의 반지름.
	 * @returns { boolean } 점이 원 안이나 경계 위에 있으면 참.
	 */
	static testPointInCircle(point, center, radius) {
		const differenceX = point.x - center.x;
		const differenceY = point.y - center.y;
		return differenceX * differenceX + differenceY * differenceY <= radius * radius;
	}
}
