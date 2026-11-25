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
/**
 * @example <caption>오른쪽으로 걷다가 누르면 뛰어오르기</caption>
 * import { Engine, EngineConfiguration, Scene, WorldNode, Paint, PlatformerBody, Vector2, Pivot } from "./build/vanilla.js";
 *
 * const playerNode = new WorldNode();
 * const paint = playerNode.addComponent(Paint);
 * paint.setColor("#ffcc00");
 * const platformerBody = playerNode.addComponent(PlatformerBody);
 * platformerBody.setGroundY(300);
 * platformerBody.setHorizontalBounds(40, 600);
 * platformerBody.setVelocityX(120);
 * platformerBody.setLandedEvent(() => {
 * 	console.log("landed");
 * });
 *
 * class MainScene extends Scene {
 * 	initialize(engine) {
 * 		super.initialize(engine);
 * 		playerNode.setPivot(Pivot.bottomCenter);
 * 		playerNode.setLocalPosition(Vector2.create(80, 100));
 * 		playerNode.setContentSize(Vector2.create(32, 48));
 * 		const root = this.getRoot();
 * 		root.addChild(playerNode);
 * 	}
 *
 * 	touchPress(viewInputPosition) {
 * 		super.touchPress(viewInputPosition);
 * 		platformerBody.jump(-720);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
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
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
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
	// 도약. (접지 중일 때만, 위쪽이 음수 속도)
	//==============================================================================
	/**
	 * @param { number } jumpSpeed 음수면 위로.
	 * @returns { boolean } 도약 성공 여부.
	 * @example <caption>엔진 없이 한 번 뛰어 가장 높이 오른 자리 재기</caption>
	 * import { WorldNode, PlatformerBody } from "./build/vanilla.js";
	 *
	 * const node = new WorldNode();
	 * const platformerBody = node.addComponent(PlatformerBody);
	 * platformerBody.setGroundY(0);
	 * platformerBody.tick(1 / 60);
	 * console.log(platformerBody.isGrounded(), platformerBody.jump(-600));
	 * let highestY = 0;
	 * for (let frame = 0; frame < 60; ++frame) {
	 * 	platformerBody.tick(1 / 60);
	 * 	const position = node.getLocalPosition();
	 * 	highestY = Math.min(highestY, position.y);
	 * }
	 * console.log(highestY.toFixed(1), platformerBody.isGrounded());
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
	/** @param { number } velocityX 가로 속도. (픽셀 / 초) */
	setVelocityX(velocityX) {
		this.#velocity = Vector2.create(velocityX, this.#velocity.y);
	}

	//==============================================================================
	// 세로 속도 설정. (픽셀 / 초, 아래쪽이 양수)
	//==============================================================================
	/** @param { number } velocityY 세로 속도. (픽셀 / 초, 위쪽이 음수) */
	setVelocityY(velocityY) {
		this.#velocity = Vector2.create(this.#velocity.x, velocityY);
	}

	//==============================================================================
	// 속도 반환. (픽셀 / 초)
	//==============================================================================
	/** @returns { Vector2 } 속도. (픽셀 / 초, 아래쪽이 양수) */
	getVelocity() {
		return this.#velocity;
	}

	//==============================================================================
	// 중력 가속도 설정. (픽셀 / 초², 아래쪽이 양수, 기본 2000)
	//==============================================================================
	/** @param { number } gravity 중력 가속도. (픽셀 / 초², 아래쪽이 양수) */
	setGravity(gravity) {
		this.#gravity = gravity;
	}

	//==============================================================================
	// 중력 가속도 반환. (픽셀 / 초²)
	//==============================================================================
	/** @returns { number } 중력 가속도. (픽셀 / 초²) */
	getGravity() {
		return this.#gravity;
	}

	//==============================================================================
	// 바닥 높이 설정. (노드가 이 Y 아래로 내려가지 않는다, 기본 0)
	//==============================================================================
	/** @param { number } groundY 바닥의 Y. (부모 기준 지역 좌표) */
	setGroundY(groundY) {
		this.#groundY = groundY;
	}

	//==============================================================================
	// 바닥 높이 반환.
	//==============================================================================
	/** @returns { number } 바닥의 Y. (부모 기준 지역 좌표) */
	getGroundY() {
		return this.#groundY;
	}

	//==============================================================================
	// 좌우 이동 경계 설정. (null 이면 해당 방향 제한 없음)
	//==============================================================================
	/**
	 * @param { number | null } leftBound 왼쪽 경계 X. (null 이면 제한 없음)
	 * @param { number | null } rightBound 오른쪽 경계 X. (null 이면 제한 없음)
	 */
	setHorizontalBounds(leftBound, rightBound) {
		this.#leftBound = leftBound;
		this.#rightBound = rightBound;
	}

	//==============================================================================
	// 바닥에 닿아 있는지 여부.
	//==============================================================================
	/** @returns { boolean } 바닥에 닿아 있으면 참. */
	isGrounded() {
		return this.#isGrounded;
	}

	//==============================================================================
	// 착지 알림 설정. (공중에서 바닥에 닿는 순간)
	//==============================================================================
	/**
	 * @param { Function } landedEvent 공중에서 바닥에 닿는 순간 부를 함수. () => void
	 */
	setLandedEvent(landedEvent) {
		this.#landedEvent = landedEvent;
	}
}
