//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import * as Math from "../base/math.js";
import { Color } from "../base/color.js";
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Graphic } from "../core/graphic.js";


//==============================================================================
// 가상 패드 상태.
//==============================================================================
const VirtualPadState = {
	none: "wait",
	pressed: "pressed",
	move: "move",
	released: "released",
}


//==============================================================================
// 가상 패드.
//==============================================================================
/**
 * @class
 * @example <caption>장면의 터치를 넘겨 가상 패드로 방향 읽기</caption>
 * import { Engine, EngineConfiguration, Scene, VirtualPad, Vector2, Color } from "./build/vanilla.js";
 *
 * const virtualPad = new VirtualPad();
 * virtualPad.setPadPosition(Vector2.create(120, 240));
 * virtualPad.setPadRadius(80);
 * virtualPad.setBallRadius(30);
 * virtualPad.setPadColor(new Color(0, 0, 0, 0.4));
 * virtualPad.setBallColor(new Color(1, 1, 1, 0.8));
 * virtualPad.setBallMoveEvent((normalizedDirection, pullStrength) => {
 * 	const moveX = (normalizedDirection.x * 2 - 1) * pullStrength;
 * 	const moveY = (normalizedDirection.y * 2 - 1) * pullStrength;
 * 	console.log(moveX.toFixed(2), moveY.toFixed(2));
 * });
 *
 * class MainScene extends Scene {
 * 	tick(timeDelta) {
 * 		super.tick(timeDelta);
 * 		virtualPad.tick(timeDelta);
 * 	}
 *
 * 	draw(graphic) {
 * 		super.draw(graphic);
 * 		virtualPad.draw(graphic);
 * 	}
 *
 * 	touchPress(viewInputPosition) {
 * 		super.touchPress(viewInputPosition);
 * 		virtualPad.touchPress(viewInputPosition);
 * 	}
 *
 * 	touchMove(viewInputPosition) {
 * 		super.touchMove(viewInputPosition);
 * 		virtualPad.touchMove(viewInputPosition);
 * 	}
 *
 * 	touchRelease(viewInputPosition) {
 * 		super.touchRelease(viewInputPosition);
 * 		virtualPad.touchRelease(viewInputPosition);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
export class VirtualPad extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { VirtualPadState } */ #virtualPadState;
	/** @private @type { Vector2 } */ #padPosition;
	/** @private @type { number } */ #padRadius;
	/** @private @type { Color } */ #padColor;
	/** @private @type { Vector2 } */ #ballPosition;
	/** @private @type { number } */ #ballRadius;
	/** @private @type { Color } */ #ballColor;
	/** @private @type { number } */ #ballReturnSpeed;
	/** @private @type { function(Vector2, number): void | null } */ #ballMoveEvent;
	
	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();

		this.#virtualPadState = VirtualPadState.none;

		this.#padPosition = Vector2.zero();
		this.#padRadius = 200;
		this.#padColor = new Color(0, 0, 0, 1);

		this.#ballPosition = Vector2.zero();
		this.#ballRadius = 50;
		this.#ballColor = new Color(1, 1, 1, 1);

		this.#ballReturnSpeed = 1600;

		this.#ballMoveEvent = null;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 */
	tick(timeDelta) {
		const virtualPadState = this.getVirtualPadState();
		if (virtualPadState === VirtualPadState.none) {
			return;
		}

		const padPosition = this.getPadPosition();
		const padRadius = this.getPadRadius();
		const ballPosition = this.getBallPosition();
		const moveDelta = ballPosition.subtract(padPosition); // 패드중점 기준에서 터치위치.
		const distance = moveDelta.length();
		const direction = moveDelta.normalize();

		// 터치 누르고 드래그: 볼 이동.
		if (virtualPadState === VirtualPadState.pressed || virtualPadState === VirtualPadState.move) {
			// 볼 중심이 패드를 못 넘어가도록 가두기.
			if (distance > padRadius) {
				this.#ballPosition = padPosition.add(direction.multiply(padRadius));
			}

			// 이벤트 발행 - direction (0~1, 0~1), pullStrength (0~1).
			if (this.#ballMoveEvent !== null) {
				const clampedDistance = Math.min(distance, padRadius);
				const pullStrength = clampedDistance / padRadius;
				const normalizedDirectionX = (direction.x + 1) / 2;
				const normalizedDirectionY = (direction.y + 1) / 2;
				const normalizedDirection = Vector2.create(normalizedDirectionX, normalizedDirectionY);
				this.#ballMoveEvent(normalizedDirection, pullStrength);
			}
		}
		// 터치 뗌: 패드 중심으로 부드럽게 빠르게 돌아가기.
		else if (virtualPadState === VirtualPadState.released) {
			const returnSpeedDelta = this.#ballReturnSpeed * timeDelta;
			if (distance > returnSpeedDelta) {
				const returnMoveDelta = direction.multiply(returnSpeedDelta);
				const currentBallPosition = this.getBallPosition();
				this.#ballPosition = currentBallPosition.subtract(returnMoveDelta);

				if (this.#ballMoveEvent !== null) {
					const updatedBallPosition = this.getBallPosition();
					const returnedMoveDelta = updatedBallPosition.subtract(padPosition);
					const returnedDistance = returnedMoveDelta.length();
					const pullStrength = Math.clamp01(returnedDistance / padRadius);
					const normalizedDirectionX = (direction.x + 1) / 2;
					const normalizedDirectionY = (direction.y + 1) / 2;
					const normalizedDirection = Vector2.create(normalizedDirectionX, normalizedDirectionY);
					this.#ballMoveEvent(normalizedDirection, pullStrength);
				}
			}
			else {
				this.#ballPosition = padPosition.clone();
				this.#virtualPadState = VirtualPadState.none;

				if (this.#ballMoveEvent !== null) {
					const neutralDirection = Vector2.create(0.5, 0.5);
					this.#ballMoveEvent(neutralDirection, 0);
				}
			}
		}
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Grpahic } graphic 그릴 그래픽.
	 */
	draw(graphic) {
		const padPosition = this.getPadPosition();
		const padRadius = this.getPadRadius();
		const padColor = this.getPadColor();
		const padColorString = padColor.toRGBAString();

		// 바깥 원.
		graphic.setFillColor(padColorString);
		graphic.drawCircle(padPosition, padRadius);

		const ballPosition = this.getBallPosition();
		const ballRadius = this.getBallRadius();
		const ballColor = this.getBallColor();
		const ballColorString = ballColor.toRGBAString();

		// 내부 원.
		graphic.setFillColor(ballColorString);
		graphic.drawCircle(ballPosition, ballRadius);
	}

	//==============================================================================
	// 터치 누름.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 누른 자리. (뷰 좌표, 구슬을 이 자리로 옮긴다)
	 */
	touchPress(viewInputPosition) {
		this.#virtualPadState = VirtualPadState.pressed;
		this.#ballPosition = viewInputPosition;
	}

	//==============================================================================
	// 터치 드래그.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 끌고 있는 자리. (뷰 좌표, 패드 반지름 밖이면 tick 이 구슬을 테두리에 가둔다)
	 */
	touchMove(viewInputPosition) {
		this.#virtualPadState = VirtualPadState.move;
		this.#ballPosition = viewInputPosition;
	}

	//==============================================================================
	// 터치 뗌.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 뗀 자리. (쓰지 않는다, 구슬은 tick 에서 패드 가운데로 돌아간다)
	 */
	touchRelease(viewInputPosition) {
		this.#virtualPadState = VirtualPadState.released;
		// this.#ballPosition = viewInputPosition;
	}

	//==============================================================================
	// 터치 취소.
	//==============================================================================
	touchCancel() {
		this.#virtualPadState = VirtualPadState.released;
		// this.#ballPosition = viewInputPosition;
	}

	//==============================================================================
	// 가상 패드 상태 반환.
	//==============================================================================
	/**
	 * @returns { VirtualPadState } 지금 상태. ("wait", "pressed", "move", "released")
	 */
	getVirtualPadState() {
		return this.#virtualPadState;
	}

	//==============================================================================
	// 구슬 이동 이벤트 함수 설정.
	//==============================================================================
	/**
	 * @param { Function } callback 구슬이 움직일 때 부를 함수. (normalizedDirection, pullStrength) => void, 방향은 축마다 0 ~ 1 (0.5 가 가운데), 당김은 0 ~ 1
	 * @example <caption>엔진 없이 끌고 놓아 알림 값 보기</caption>
	 * import { VirtualPad, Vector2 } from "./build/vanilla.js";
	 *
	 * const virtualPad = new VirtualPad();
	 * virtualPad.setPadPosition(Vector2.create(100, 100));
	 * virtualPad.setPadRadius(50);
	 * virtualPad.setBallMoveEvent((normalizedDirection, pullStrength) => {
	 * 	console.log(normalizedDirection.x.toFixed(2), normalizedDirection.y.toFixed(2), pullStrength.toFixed(2));
	 * });
	 * virtualPad.touchPress(Vector2.create(100, 100));
	 * virtualPad.touchMove(Vector2.create(200, 100));
	 * virtualPad.tick(1 / 60);
	 * virtualPad.touchRelease(Vector2.create(200, 100));
	 * virtualPad.tick(1 / 60);
	 * virtualPad.tick(1 / 60);
	 * console.log(virtualPad.getVirtualPadState());
	 */
	setBallMoveEvent(callback) {
		this.#ballMoveEvent = callback;
	}

	//==============================================================================
	// 패드 위치 설정.
	//==============================================================================
	/**
	 * @param { Function } callback 패드 가운데 자리. (구슬도 이 자리로 옮긴다)
	 */
	setPadPosition(padPosition) {
		this.#padPosition = padPosition;
		this.#ballPosition = padPosition;
	}

	//==============================================================================
	// 패드 위치 반환.
	//==============================================================================
	/**
	 * @returns { Color } 패드 가운데 자리.
	 */
	getPadPosition() {
		return this.#padPosition;
	}

	//==============================================================================
	// 패드 크기 설정.
	//==============================================================================
	/**
	 * @param { Function } callback 패드 반지름. (픽셀, 기본 200)
	 */
	setPadRadius(padRadius) {
		this.#padRadius = padRadius;
	}

	//==============================================================================
	// 패드 크기 반환.
	//==============================================================================
	/**
	 * @returns { Color } 패드 반지름. (픽셀)
	 */
	getPadRadius() {
		return this.#padRadius;
	}

	//==============================================================================
	// 구슬 위치 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 구슬 가운데 자리.
	 */
	getBallPosition() {
		return this.#ballPosition;
	}

	//==============================================================================
	// 구슬 크기 설정.
	//==============================================================================
	/**
	 * @param { Function } callback 구슬 반지름. (픽셀, 기본 50)
	 */
	setBallRadius(ballRadius) {
		this.#ballRadius = ballRadius;
	}

	//==============================================================================
	// 구슬 크기 반환.
	//==============================================================================
	/**
	 * @returns { Color } 구슬 반지름. (픽셀)
	 */
	getBallRadius() {
		return this.#ballRadius;
	}

	//==============================================================================
	// 패드 색상 설정.
	//==============================================================================
	/**
	 * @param { Color | string } padColor 패드 색. (기본 검정)
	 */
	setPadColor(padColor) {
		padColor = Color.from(padColor);
		this.#padColor = padColor;
	}

	//==============================================================================
	// 패드 색상 반환.
	//==============================================================================
	/**
	 * @returns { Color } 패드 색.
	 */
	getPadColor() {
		return this.#padColor;
	}

	//==============================================================================
	// 구슬 색상 설정.
	//==============================================================================
	/**
	 * @param { Color | string } ballColor 구슬 색. (기본 흰색)
	 */
	setBallColor(ballColor) {
		ballColor = Color.from(ballColor);
		this.#ballColor = ballColor;
	}

	//==============================================================================
	// 구슬 색상 반환.
	//==============================================================================
	/**
	 * @returns { Color } 구슬 색.
	 */
	getBallColor() {
		return this.#ballColor;
	}
}