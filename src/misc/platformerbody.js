//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Component } from "../core/component.js";
import { Vector2 } from "../base/vector2.js";


//==============================================================================
// 플랫포머 물리 컴포넌트.
// - 중력 적분 + 바닥 접지 + 좌우 이동 경계처럼 횡스크롤 게임이 재발명하던
//   최소 물리(운동학)를 담는다. 노드의 로컬 위치를 직접 움직인다.
// - 사용:
//     const body = node.addComponent(PlatformerBody);
//     body.setGroundY(560);
//     body.setHorizontalBounds(40, 920);
//     // 이동: body.setVelocityX(±speed), 도약: body.jump(-720)
//==============================================================================
export class PlatformerBody extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Vector2 } */ #velocity;
	/** @private @type { number } */ #gravity;
	/** @private @type { number } */ #groundY;
	/** @private @type { number | null } */ #leftBound;
	/** @private @type { number | null } */ #rightBound;
	/** @private @type { boolean } */ #isGrounded;
	/** @private @type { Function | null } */ #landedEvent;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setComponentType("PlatformerBody");
		this.#velocity = Vector2.zero();
		this.#gravity = 2000;
		this.#groundY = 0;
		this.#leftBound = null;
		this.#rightBound = null;
		this.#isGrounded = false;
		this.#landedEvent = null;
	}

	//==============================================================================
	// 갱신. (속도 적분 → 중력 → 접지 → 경계)
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
		const node = this.getNode();
		if (!node) {
			return;
		}
		this.#velocity = Vector2.create(this.#velocity.x, this.#velocity.y + this.#gravity * timeDelta);

		const currentPosition = node.getLocalPosition();
		let nextX = currentPosition.x + this.#velocity.x * timeDelta;
		let nextY = currentPosition.y + this.#velocity.y * timeDelta;

		// 접지.
		const wasGrounded = this.#isGrounded;
		if (nextY >= this.#groundY) {
			nextY = this.#groundY;
			this.#velocity = Vector2.create(this.#velocity.x, 0);
			this.#isGrounded = true;
			if (!wasGrounded && this.#landedEvent) {
				this.#landedEvent();
			}
		}
		else {
			this.#isGrounded = false;
		}

		// 좌우 경계.
		if (this.#leftBound !== null && nextX < this.#leftBound) {
			nextX = this.#leftBound;
		}
		if (this.#rightBound !== null && nextX > this.#rightBound) {
			nextX = this.#rightBound;
		}
		node.setLocalPosition(Vector2.create(nextX, nextY));
	}

	//==============================================================================
	// 도약. (접지 중일 때만 — 위쪽이 음수 속도)
	//==============================================================================
	/**
	 * @param { number } jumpSpeed 음수면 위로.
	 * @returns { boolean } 도약 성공 여부.
	 */
	jump(jumpSpeed) {
		if (!this.#isGrounded) {
			return false;
		}
		this.#velocity = Vector2.create(this.#velocity.x, jumpSpeed);
		this.#isGrounded = false;
		return true;
	}

	//==============================================================================
	// 접근자.
	//==============================================================================
	/** @param { number } velocityX */
	setVelocityX(velocityX) {
		this.#velocity = Vector2.create(velocityX, this.#velocity.y);
	}

	/** @param { number } velocityY */
	setVelocityY(velocityY) {
		this.#velocity = Vector2.create(this.#velocity.x, velocityY);
	}

	/** @returns { Vector2 } */
	getVelocity() {
		return this.#velocity;
	}

	/** @param { number } gravity */
	setGravity(gravity) {
		this.#gravity = gravity;
	}

	/** @returns { number } */
	getGravity() {
		return this.#gravity;
	}

	/** @param { number } groundY */
	setGroundY(groundY) {
		this.#groundY = groundY;
	}

	/** @returns { number } */
	getGroundY() {
		return this.#groundY;
	}

	//==============================================================================
	// 좌우 이동 경계 설정. (null 이면 해당 방향 제한 없음)
	//==============================================================================
	/**
	 * @param { number | null } leftBound
	 * @param { number | null } rightBound
	 */
	setHorizontalBounds(leftBound, rightBound) {
		this.#leftBound = leftBound;
		this.#rightBound = rightBound;
	}

	/** @returns { boolean } */
	isGrounded() {
		return this.#isGrounded;
	}

	//==============================================================================
	// 착지 알림 설정. (공중에서 바닥에 닿는 순간)
	//==============================================================================
	/**
	 * @param { Function } landedEvent
	 */
	setLandedEvent(landedEvent) {
		this.#landedEvent = landedEvent;
	}
}
