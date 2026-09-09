//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Rect } from "../base/rect.js";
import * as Math from "../base/math.js";


//==============================================================================
// 2D 카메라.
// - 여러 게임이 제각각 만들던 "추적 + 월드 경계 클램프 + 드래그 팬 + 커서 고정 줌 + 관성" 을 모았다.
// - position 은 카메라가 바라보는 월드 좌표(화면 가운데), zoom 은 확대 배율이다.
// - 사용:
//     camera.setViewSize(viewSize);            // 매 프레임 또는 리사이즈 시
//     camera.follow([heroPosition], 6);        // 추적 (선택)
//     camera.tick(timeDelta);
//     camera.applyTransform(graphic);          // 월드 그리기 전에
//     ...월드 렌더...
//     graphic.popState 는 pushState 를 쓴 쪽에서.
//==============================================================================
export class Camera2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Vector2 } */ #position;
	/** @private @type { number } */ #zoom;
	/** @private @type { Vector2 } */ #viewSize;
	/** @private @type { Rect | null } */ #worldBounds;
	/** @private @type { Vector2 } */ #velocity;
	/** @private @type { number } */ #inertiaDamping;
	/** @private @type { number } */ #minZoom;
	/** @private @type { number } */ #maxZoom;
	/** @private @type { object | null } */ #tweenState;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();

		this.#position = Vector2.zero();
		this.#zoom = 1;
		this.#viewSize = Vector2.create(960, 640);
		this.#worldBounds = null;
		this.#velocity = Vector2.zero();
		this.#inertiaDamping = 6;
		this.#minZoom = 0.1;
		this.#maxZoom = 8;
		this.#tweenState = null;
	}

	//==============================================================================
	// 갱신. (관성 이동 + 이동 트윈 + 경계 클램프)
	//==============================================================================
	/**
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		// 관성.
		if (this.#velocity.x !== 0 || this.#velocity.y !== 0) {
			this.#position = Vector2.create(
				this.#position.x + this.#velocity.x * timeDelta,
				this.#position.y + this.#velocity.y * timeDelta);
			const damping = System.Math.exp(-this.#inertiaDamping * timeDelta);
			this.#velocity = Vector2.create(this.#velocity.x * damping, this.#velocity.y * damping);
			if (System.Math.abs(this.#velocity.x) < 1 && System.Math.abs(this.#velocity.y) < 1) {
				this.#velocity = Vector2.zero();
			}
		}

		// 이동 트윈. (줌은 등비 보간으로 미끄러짐 없이)
		if (this.#tweenState) {
			const tween = this.#tweenState;
			tween.elapsedSeconds += timeDelta;
			const linearRatio = System.Math.min(1, tween.elapsedSeconds / tween.duration);
			const easedRatio = 1 - System.Math.pow(1 - linearRatio, 3);
			this.#zoom = tween.fromZoom * System.Math.pow(tween.toZoom / tween.fromZoom, easedRatio);
			this.#position = Vector2.create(
				Math.lerp(tween.fromPosition.x, tween.toPosition.x, easedRatio),
				Math.lerp(tween.fromPosition.y, tween.toPosition.y, easedRatio));
			if (linearRatio >= 1) {
				this.#tweenState = null;
			}
		}

		this.clampToBounds();
	}

	//==============================================================================
	// 대상 추적. (여러 대상이면 중점을 따라간다 — 프레임 독립 지수 감쇠)
	//==============================================================================
	/**
	 * @param { Vector2[] } targetPositions
	 * @param { number } rate 추적 속도. (클수록 빨리 붙는다)
	 * @param { number } timeDelta
	 */
	follow(targetPositions, rate, timeDelta) {
		if (!targetPositions || targetPositions.length === 0) {
			return;
		}
		let centerX = 0;
		let centerY = 0;
		for (const targetPosition of targetPositions) {
			centerX += targetPosition.x;
			centerY += targetPosition.y;
		}
		centerX /= targetPositions.length;
		centerY /= targetPositions.length;
		this.#position = Vector2.create(
			Math.approach(this.#position.x, centerX, rate, timeDelta),
			Math.approach(this.#position.y, centerY, rate, timeDelta));
	}

	//==============================================================================
	// 화면 픽셀 단위 팬. (드래그 팬 — 줌을 반영해 월드 이동량으로 환산)
	//==============================================================================
	/**
	 * @param { number } screenDeltaX
	 * @param { number } screenDeltaY
	 */
	panByScreen(screenDeltaX, screenDeltaY) {
		this.#position = Vector2.create(
			this.#position.x - screenDeltaX / this.#zoom,
			this.#position.y - screenDeltaY / this.#zoom);
		this.clampToBounds();
	}

	//==============================================================================
	// 관성 던지기. (드래그를 놓을 때 화면 픽셀 속도를 넘긴다)
	//==============================================================================
	/**
	 * @param { number } screenVelocityX
	 * @param { number } screenVelocityY
	 */
	fling(screenVelocityX, screenVelocityY) {
		this.#velocity = Vector2.create(-screenVelocityX / this.#zoom, -screenVelocityY / this.#zoom);
	}

	//==============================================================================
	// 화면 기준점을 고정한 줌. (휠 / 핀치 — anchorScreen 아래의 월드 지점이 움직이지 않는다)
	//==============================================================================
	/**
	 * @param { Vector2 } anchorScreen 화면 좌표. (뷰 좌상단 기준)
	 * @param { number } zoomFactor 곱할 배율. (1.1 = 10% 확대)
	 */
	zoomAt(anchorScreen, zoomFactor) {
		const previousZoom = this.#zoom;
		const nextZoom = Math.clamp(previousZoom * zoomFactor, this.#minZoom, this.#maxZoom);
		if (nextZoom === previousZoom) {
			return;
		}
		const anchorWorld = this.screenToWorld(anchorScreen);
		this.#zoom = nextZoom;
		const anchorWorldAfter = this.screenToWorld(anchorScreen);
		this.#position = Vector2.create(
			this.#position.x + (anchorWorld.x - anchorWorldAfter.x),
			this.#position.y + (anchorWorld.y - anchorWorldAfter.y));
		this.clampToBounds();
	}

	//==============================================================================
	// 위치 / 줌으로 이동 트윈 시작.
	//==============================================================================
	/**
	 * @param { Vector2 } targetPosition
	 * @param { number } targetZoom
	 * @param { number } duration
	 */
	tweenTo(targetPosition, targetZoom, duration = 0.4) {
		this.#velocity = Vector2.zero();
		this.#tweenState = {
			fromPosition: Vector2.create(this.#position.x, this.#position.y),
			toPosition: Vector2.create(targetPosition.x, targetPosition.y),
			fromZoom: this.#zoom,
			toZoom: Math.clamp(targetZoom, this.#minZoom, this.#maxZoom),
			duration: System.Math.max(0.0001, duration),
			elapsedSeconds: 0,
		};
	}

	//==============================================================================
	// 그리기 변환 적용. (호출한 쪽에서 pushState / popState 로 감싼다)
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 */
	applyTransform(graphic) {
		graphic.translate(this.#viewSize.x * 0.5, this.#viewSize.y * 0.5);
		graphic.scale(this.#zoom, this.#zoom);
		graphic.translate(-this.#position.x, -this.#position.y);
	}

	//==============================================================================
	// 화면 좌표 → 월드 좌표.
	//==============================================================================
	/**
	 * @param { Vector2 } screenPosition
	 * @returns { Vector2 }
	 */
	screenToWorld(screenPosition) {
		return Vector2.create(
			(screenPosition.x - this.#viewSize.x * 0.5) / this.#zoom + this.#position.x,
			(screenPosition.y - this.#viewSize.y * 0.5) / this.#zoom + this.#position.y);
	}

	//==============================================================================
	// 월드 좌표 → 화면 좌표.
	//==============================================================================
	/**
	 * @param { Vector2 } worldPosition
	 * @returns { Vector2 }
	 */
	worldToScreen(worldPosition) {
		return Vector2.create(
			(worldPosition.x - this.#position.x) * this.#zoom + this.#viewSize.x * 0.5,
			(worldPosition.y - this.#position.y) * this.#zoom + this.#viewSize.y * 0.5);
	}

	//==============================================================================
	// 월드 경계로 클램프.
	// - 뷰가 경계보다 크면(줌아웃) 축 가운데에 맞춘다.
	//==============================================================================
	clampToBounds() {
		if (!this.#worldBounds) {
			return;
		}
		const halfViewWidth = this.#viewSize.x * 0.5 / this.#zoom;
		const halfViewHeight = this.#viewSize.y * 0.5 / this.#zoom;
		const bounds = this.#worldBounds;
		let clampedX;
		if (halfViewWidth * 2 >= bounds.size.x) {
			clampedX = bounds.position.x + bounds.size.x * 0.5;
		}
		else {
			clampedX = Math.clamp(this.#position.x, bounds.position.x + halfViewWidth, bounds.position.x + bounds.size.x - halfViewWidth);
		}
		let clampedY;
		if (halfViewHeight * 2 >= bounds.size.y) {
			clampedY = bounds.position.y + bounds.size.y * 0.5;
		}
		else {
			clampedY = Math.clamp(this.#position.y, bounds.position.y + halfViewHeight, bounds.position.y + bounds.size.y - halfViewHeight);
		}
		this.#position = Vector2.create(clampedX, clampedY);
	}

	//==============================================================================
	// 접근자.
	//==============================================================================
	/** @param { Vector2 } position */
	setPosition(position) {
		this.#position = Vector2.create(position.x, position.y);
		this.clampToBounds();
	}

	/** @returns { Vector2 } */
	getPosition() {
		return this.#position;
	}

	/** @param { number } zoom */
	setZoom(zoom) {
		this.#zoom = Math.clamp(zoom, this.#minZoom, this.#maxZoom);
		this.clampToBounds();
	}

	/** @returns { number } */
	getZoom() {
		return this.#zoom;
	}

	/** @param { Vector2 } viewSize */
	setViewSize(viewSize) {
		this.#viewSize = Vector2.create(viewSize.x, viewSize.y);
	}

	/** @returns { Vector2 } */
	getViewSize() {
		return this.#viewSize;
	}

	/** @param { Rect | null } worldBounds */
	setWorldBounds(worldBounds) {
		this.#worldBounds = worldBounds;
		this.clampToBounds();
	}

	/** @returns { Rect | null } */
	getWorldBounds() {
		return this.#worldBounds;
	}

	/** @param { number } minZoom @param { number } maxZoom */
	setZoomRange(minZoom, maxZoom) {
		this.#minZoom = minZoom;
		this.#maxZoom = maxZoom;
		this.setZoom(this.#zoom);
	}

	/** @param { number } inertiaDamping */
	setInertiaDamping(inertiaDamping) {
		this.#inertiaDamping = inertiaDamping;
	}

	/** @returns { boolean } */
	isTweening() {
		return this.#tweenState !== null;
	}

	//==============================================================================
	// 관성 정지.
	//==============================================================================
	stopInertia() {
		this.#velocity = Vector2.zero();
	}
}
