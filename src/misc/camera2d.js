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
// - position 은 카메라가 바라보는 월드 좌표(화면 가운데), zoom 은 확대 배율, rotation 은 화면 가운데를 축으로 도는 각도(도)다.
//   rotation 만큼 월드가 화면에서 돈다. (experimental/camera.js 의 begin 이 scale 뒤 rotate 를 거는 것과 같은 방향)
// - 사용:
//     camera.setViewSize(viewSize);            // 매 프레임 또는 리사이즈 시
//     camera.follow([heroPosition], 6);        // 추적 (선택)
//     camera.tick(timeDelta);
//     camera.applyTransform(graphic);          // 월드 그리기 전에
//     ...월드 렌더...
//     graphic.popState 는 pushState 를 쓴 쪽에서.
//     또는 camera.begin(graphic); ...월드 렌더... camera.end(graphic);   // pushState + applyTransform / popState
//==============================================================================
export class Camera2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Vector2 } */ #position;
	/** @private @type { number } */ #zoom;
	/** @private @type { number } */ #rotation;
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
		this.#rotation = 0;
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
	// 화면 픽셀 단위 팬. (드래그 팬 — 줌과 회전을 반영해 월드 이동량으로 환산)
	//==============================================================================
	/**
	 * @param { number } screenDeltaX
	 * @param { number } screenDeltaY
	 */
	panByScreen(screenDeltaX, screenDeltaY) {
		const worldDelta = this.convertScreenDeltaToWorld(screenDeltaX, screenDeltaY);
		this.#position = Vector2.create(
			this.#position.x - worldDelta.x,
			this.#position.y - worldDelta.y);
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
		const worldVelocity = this.convertScreenDeltaToWorld(screenVelocityX, screenVelocityY);
		this.#velocity = Vector2.create(-worldVelocity.x, -worldVelocity.y);
	}

	//==============================================================================
	// 화면 픽셀 이동량 → 월드 이동량. (회전을 되돌리고 줌으로 나눈다)
	//==============================================================================
	/**
	 * @param { number } screenDeltaX
	 * @param { number } screenDeltaY
	 * @returns { Vector2 }
	 */
	convertScreenDeltaToWorld(screenDeltaX, screenDeltaY) {
		const radian = Math.degreeToRadian(this.#rotation);
		const cosine = System.Math.cos(radian);
		const sine = System.Math.sin(radian);
		const unrotatedX = screenDeltaX * cosine + screenDeltaY * sine;
		const unrotatedY = -screenDeltaX * sine + screenDeltaY * cosine;
		return Vector2.create(unrotatedX / this.#zoom, unrotatedY / this.#zoom);
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
		graphic.rotate(Math.degreeToRadian(this.#rotation));
		graphic.translate(-this.#position.x, -this.#position.y);
	}

	//==============================================================================
	// 그리기 시작. (상태를 쌓고 변환을 건다, experimental/camera.js 의 begin)
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 */
	begin(graphic) {
		graphic.pushState();
		this.applyTransform(graphic);
	}

	//==============================================================================
	// 그리기 끝. (begin 이 쌓은 상태를 되돌린다, experimental/camera.js 의 end)
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 */
	end(graphic) {
		graphic.popState();
	}

	//==============================================================================
	// 화면 좌표 → 월드 좌표.
	//==============================================================================
	/**
	 * @param { Vector2 } screenPosition
	 * @returns { Vector2 }
	 */
	screenToWorld(screenPosition) {
		const screenDeltaX = screenPosition.x - this.#viewSize.x * 0.5;
		const screenDeltaY = screenPosition.y - this.#viewSize.y * 0.5;
		const worldDelta = this.convertScreenDeltaToWorld(screenDeltaX, screenDeltaY);
		return Vector2.create(worldDelta.x + this.#position.x, worldDelta.y + this.#position.y);
	}

	//==============================================================================
	// 월드 좌표 → 화면 좌표.
	//==============================================================================
	/**
	 * @param { Vector2 } worldPosition
	 * @returns { Vector2 }
	 */
	worldToScreen(worldPosition) {
		const radian = Math.degreeToRadian(this.#rotation);
		const cosine = System.Math.cos(radian);
		const sine = System.Math.sin(radian);
		const scaledX = (worldPosition.x - this.#position.x) * this.#zoom;
		const scaledY = (worldPosition.y - this.#position.y) * this.#zoom;
		return Vector2.create(
			scaledX * cosine - scaledY * sine + this.#viewSize.x * 0.5,
			scaledX * sine + scaledY * cosine + this.#viewSize.y * 0.5);
	}

	//==============================================================================
	// 화면에 보이는 월드 영역의 반 너비, 반 높이. (돌아간 뷰를 감싸는 축 정렬 상자)
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getVisibleHalfExtent() {
		const halfViewWidth = this.#viewSize.x * 0.5 / this.#zoom;
		const halfViewHeight = this.#viewSize.y * 0.5 / this.#zoom;
		const radian = Math.degreeToRadian(this.#rotation);
		const cosine = System.Math.abs(System.Math.cos(radian));
		const sine = System.Math.abs(System.Math.sin(radian));
		return Vector2.create(halfViewWidth * cosine + halfViewHeight * sine, halfViewWidth * sine + halfViewHeight * cosine);
	}

	//==============================================================================
	// 월드 경계로 클램프.
	// - 보이는 영역이 경계 안에 들게 한다. 보이는 영역이 경계보다 크면(줌아웃) 축 가운데에 맞춘다.
	// - 돌아가 있으면 돌아간 뷰를 감싸는 축 정렬 상자로 잰다.
	//==============================================================================
	clampToBounds() {
		if (!this.#worldBounds) {
			return;
		}
		const visibleHalfExtent = this.getVisibleHalfExtent();
		const halfViewWidth = visibleHalfExtent.x;
		const halfViewHeight = visibleHalfExtent.y;
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

	/** @param { number } rotation 도. (화면 가운데를 축으로 돈다) */
	setRotation(rotation) {
		this.#rotation = rotation;
		this.clampToBounds();
	}

	/** @returns { number } */
	getRotation() {
		return this.#rotation;
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
