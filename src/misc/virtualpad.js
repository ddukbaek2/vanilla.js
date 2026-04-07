//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import * as Math from "../base/math.js";
import { Color } from "../base/color.js";
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Graphic } from "../core/graphic.js";
import { ITickable } from "../core/interface/itickable.js";
import { IDrawable } from "../core/interface/idrawable.js";
import { ITouchable } from "../core/interface/itouchable.js";


//==============================================================================
// 가상 패드 상태.
//==============================================================================
const VirtualPadState = {
	none: 'wait',
	pressed: 'pressed',
	move: 'move',
	released: 'released',
}


//==============================================================================
// 가상 패드.
//==============================================================================
/**
 * @class
 * @implements { IDrawable }
 * @implements { ITickable }
 * @implements { ITouchable }
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
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		const virtualPadState = this.getVirtualPadState();
		if (virtualPadState === VirtualPadState.none) {
			return;
		}

		const padPosition = this.getPadPosition();
		const padRadius = this.getPadRadius();
		const moveDelta = this.#ballPosition.subtract(padPosition); // 패드중점 기준에서 터치위치.
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
				this.#ballPosition = this.#ballPosition.subtract(returnMoveDelta);

				if (this.#ballMoveEvent !== null) {
					const returnedMoveDelta = this.#ballPosition.subtract(padPosition);
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
	 * @param { Grpahic } graphic
	 */
	draw(graphic) {
		const canvasRenderingContext = graphic.getCanvasRenderingContext();

		const padPosition = this.getPadPosition();
		const padRadius = this.getPadRadius();
		const padColor = this.getPadColor();
		const padColorString = padColor.toRGBAString();

		// 바깥 원.
		canvasRenderingContext.fillStyle = padColorString;
		canvasRenderingContext.beginPath();
		canvasRenderingContext.arc(padPosition.x, padPosition.y, padRadius, 0, Math.PI * 2);
		canvasRenderingContext.fill();

		const ballPosition = this.getBallPosition();
		const ballRadius = this.getBallRadius();
		const ballColor = this.getBallColor();
		const ballColorString = ballColor.toRGBAString();

		// 내부 원.
		canvasRenderingContext.fillStyle = ballColorString;
		canvasRenderingContext.beginPath();
		canvasRenderingContext.arc(ballPosition.x, ballPosition.y, ballRadius, 0, Math.PI * 2);
		canvasRenderingContext.fill();
	}

	//==============================================================================
	// 터치 누름.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition
	 */
	touchPress(viewInputPosition) {
		this.#virtualPadState = VirtualPadState.pressed;
		this.#ballPosition = viewInputPosition;
	}

	//==============================================================================
	// 터치 드래그.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition
	 */
	touchMove(viewInputPosition) {
		this.#virtualPadState = VirtualPadState.move;
		this.#ballPosition = viewInputPosition;
	}

	//==============================================================================
	// 터치 뗌.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition
	 */
	touchRelease(viewInputPosition) {
		this.#virtualPadState = VirtualPadState.released;
		// this.#ballPosition = viewInputPosition;
	}

	//==============================================================================
	// 가상 패드 상태 반환.
	//==============================================================================
	/**
	 * @returns { VirtualPadState }
	 */
	getVirtualPadState() {
		return this.#virtualPadState;
	}

	//==============================================================================
	// 구슬 이동 이벤트 함수 설정.
	//==============================================================================
	/**
	 * @param { Function } callback
	 */
	setBallMoveEvent(callback) {
		this.#ballMoveEvent = callback;
	}

	//==============================================================================
	// 패드 위치 설정.
	//==============================================================================
	/**
	 * @param { Function } callback
	 */
	setPadPosition(padPosition) {
		this.#padPosition = padPosition;
		this.#ballPosition = padPosition;
	}

	//==============================================================================
	// 패드 위치 반환.
	//==============================================================================
	/**
	 * @returns { Color }
	 */
	getPadPosition() {
		return this.#padPosition;
	}

	//==============================================================================
	// 패드 크기 설정.
	//==============================================================================
	/**
	 * @param { Function } callback
	 */
	setPadRadius(padRadius) {
		this.#padRadius = padRadius;
	}

	//==============================================================================
	// 패드 크기 반환.
	//==============================================================================
	/**
	 * @returns { Color }
	 */
	getPadRadius() {
		return this.#padRadius;
	}

	//==============================================================================
	// 구슬 위치 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getBallPosition() {
		return this.#ballPosition;
	}

	//==============================================================================
	// 구슬 크기 설정.
	//==============================================================================
	/**
	 * @param { Function } callback
	 */
	setBallRadius(ballRadius) {
		this.#ballRadius = ballRadius;
	}

	//==============================================================================
	// 구슬 크기 반환.
	//==============================================================================
	/**
	 * @returns { Color }
	 */
	getBallRadius() {
		return this.#ballRadius;
	}

	//==============================================================================
	// 패드 색상 설정.
	//==============================================================================
	/**
	 * @param { Color } padColor
	 */
	setPadColor(padColor) {
		this.#padColor = padColor;
	}

	//==============================================================================
	// 패드 색상 반환.
	//==============================================================================
	/**
	 * @returns { Color }
	 */
	getPadColor() {
		return this.#padColor;
	}

	//==============================================================================
	// 구슬 색상 설정.
	//==============================================================================
	/**
	 * @param { Color } ballColor
	 */
	setBallColor(ballColor) {
		this.#ballColor = ballColor;
	}

	//==============================================================================
	// 구슬 색상 반환.
	//==============================================================================
	/**
	 * @returns { Color }
	 */
	getBallColor() {
		return this.#ballColor;
	}
}