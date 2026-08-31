//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";


//==============================================================================
// 2D 조향 유틸.
// - "멀면 다가가고, 사거리 안이면 거리를 유지하며 좌우로 선회" 하는 전투 AI 이동처럼
//   자주 재발명되는 조향 계산을 순수 함수로 모았다. 반환값은 목표 속도 벡터다.
//==============================================================================
export class Steering2D extends Object {
	//==============================================================================
	// 목표를 향해 다가가는 속도 반환. (정적)
	//==============================================================================
	/**
	 * @param { Vector2 } position
	 * @param { Vector2 } targetPosition
	 * @param { number } speed
	 * @returns { Vector2 }
	 */
	static seek(position, targetPosition, speed) {
		const differenceX = targetPosition.x - position.x;
		const differenceY = targetPosition.y - position.y;
		const distance = System.Math.sqrt(differenceX * differenceX + differenceY * differenceY);
		if (distance < 0.000001) {
			return Vector2.zero();
		}
		return Vector2.create(differenceX / distance * speed, differenceY / distance * speed);
	}

	//==============================================================================
	// 사거리를 유지하며 선회하는 속도 반환. (정적)
	// - 사거리보다 멀면 접근, 가까우면 후퇴 성분을 섞고,
	//   접선 방향으로 sin 파형 좌우 선회(strafe)를 더해 살아 있는 움직임을 만든다.
	//==============================================================================
	/**
	 * @param { Vector2 } position
	 * @param { Vector2 } targetPosition
	 * @param { number } preferredRange 유지하려는 거리.
	 * @param { number } speed
	 * @param { number } elapsedSeconds 선회 위상에 쓰는 누적 시간.
	 * @param { number } strafeRate 선회 파형 각속도. (기본 1.7)
	 * @returns { Vector2 }
	 */
	static orbitAtRange(position, targetPosition, preferredRange, speed, elapsedSeconds, strafeRate = 1.7) {
		const differenceX = targetPosition.x - position.x;
		const differenceY = targetPosition.y - position.y;
		const distance = System.Math.sqrt(differenceX * differenceX + differenceY * differenceY);
		if (distance < 0.000001) {
			return Vector2.create(speed, 0);
		}
		const forwardX = differenceX / distance;
		const forwardY = differenceY / distance;
		const sideX = -forwardY;
		const sideY = forwardX;

		// 사거리 대비 오차를 -1 ~ 1 로 눌러 접근 / 후퇴 성분을 만든다.
		const rangeError = System.Math.max(-1, System.Math.min(1, (distance - preferredRange) / preferredRange));
		const strafeAmount = System.Math.sin(elapsedSeconds * strafeRate);
		const desiredX = forwardX * rangeError + sideX * strafeAmount;
		const desiredY = forwardY * rangeError + sideY * strafeAmount;
		const desiredLength = System.Math.sqrt(desiredX * desiredX + desiredY * desiredY);
		if (desiredLength < 0.000001) {
			return Vector2.zero();
		}
		return Vector2.create(desiredX / desiredLength * speed, desiredY / desiredLength * speed);
	}
}
