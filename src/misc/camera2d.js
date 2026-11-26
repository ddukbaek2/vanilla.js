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
//   rotation 만큼 월드가 화면에서 돈다. (deprecated/camera.js 의 begin 이 scale 뒤 rotate 를 거는 것과 같은 방향)
// - 사용:
//     camera.setViewSize(viewSize);            // 매 프레임 또는 리사이즈 시
//     camera.follow([heroPosition], 6);        // 추적 (선택)
//     camera.tick(timeDelta);
//     camera.applyTransform(graphic);          // 월드 그리기 전에
//     ...월드 렌더...
//     graphic.popState 는 pushState 를 쓴 쪽에서.
//     또는 camera.begin(graphic); ...월드 렌더... camera.end(graphic);   // pushState + applyTransform / popState
//==============================================================================
/**
 * @example <caption>끌어서 둘러보고 놓으면 관성으로 미끄러지는 월드</caption>
 * import { Engine, EngineConfiguration, Scene, Camera2D, Rect, Vector2, Colors } from "./build/vanilla.js";
 *
 * const camera = new Camera2D();
 * camera.setWorldBounds(Rect.create(0, 0, 2000, 1200));
 * camera.setPosition(Vector2.create(1000, 600));
 * let lastTouchPosition = null;
 * let lastTouchVelocity = Vector2.zero();
 *
 * class MainScene extends Scene {
 * 	tick(timeDelta) {
 * 		super.tick(timeDelta);
 * 		const engine = this.getEngine();
 * 		const viewManager = engine.getViewManager();
 * 		const viewSize = viewManager.getViewSize();
 * 		camera.setViewSize(viewSize);
 * 		camera.tick(timeDelta);
 * 	}
 *
 * 	draw(graphic) {
 * 		camera.begin(graphic);
 * 		graphic.setFillColor(Colors.white);
 * 		for (let column = 0; column < 10; ++column) {
 * 			for (let row = 0; row < 6; ++row) {
 * 				if ((column + row) % 2 === 0) {
 * 					graphic.drawRect(Rect.create(column * 200, row * 200, 200, 200));
 * 				}
 * 			}
 * 		}
 * 		camera.end(graphic);
 * 		super.draw(graphic);
 * 	}
 *
 * 	touchPress(viewInputPosition) {
 * 		super.touchPress(viewInputPosition);
 * 		camera.stopInertia();
 * 		lastTouchPosition = viewInputPosition.clone();
 * 	}
 *
 * 	touchMove(viewInputPosition) {
 * 		super.touchMove(viewInputPosition);
 * 		if (lastTouchPosition === null) {
 * 			return;
 * 		}
 * 		const delta = viewInputPosition.subtract(lastTouchPosition);
 * 		camera.panByScreen(delta.x, delta.y);
 * 		lastTouchVelocity = delta.multiply(60);
 * 		lastTouchPosition = viewInputPosition.clone();
 * 	}
 *
 * 	touchRelease(viewInputPosition) {
 * 		super.touchRelease(viewInputPosition);
 * 		camera.fling(lastTouchVelocity.x, lastTouchVelocity.y);
 * 		lastTouchPosition = null;
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
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
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
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
	// 대상 추적. (여러 대상이면 중점을 따라간다, 프레임 독립 지수 감쇠)
	//==============================================================================
	/**
	 * @param { Vector2[] } targetPositions 따라갈 대상들의 월드 위치. (빈 배열이면 그대로)
	 * @param { number } rate 추적 속도. (클수록 빨리 붙는다)
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 * @example <caption>두 캐릭터의 가운데를 따라가기</caption>
	 * import { Camera2D, Vector2 } from "./build/vanilla.js";
	 *
	 * const camera = new Camera2D();
	 * const heroPosition = Vector2.create(400, 300);
	 * const friendPosition = Vector2.create(600, 300);
	 * for (let frame = 0; frame < 60; ++frame) {
	 * 	camera.follow([heroPosition, friendPosition], 6, 1 / 60);
	 * 	camera.tick(1 / 60);
	 * }
	 * const position = camera.getPosition();
	 * console.log(position.x.toFixed(1), position.y.toFixed(1));
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
	// 화면 픽셀 단위 팬. (드래그 팬, 줌과 회전을 반영해 월드 이동량으로 환산)
	//==============================================================================
	/**
	 * @param { number } screenDeltaX 화면 가로 이동량. (픽셀, 끈 만큼 그대로 넘긴다)
	 * @param { number } screenDeltaY 화면 세로 이동량. (픽셀, 끈 만큼 그대로 넘긴다)
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
	 * @param { number } screenVelocityX 화면 가로 속도. (픽셀 / 초)
	 * @param { number } screenVelocityY 화면 세로 속도. (픽셀 / 초)
	 */
	fling(screenVelocityX, screenVelocityY) {
		const worldVelocity = this.convertScreenDeltaToWorld(screenVelocityX, screenVelocityY);
		this.#velocity = Vector2.create(-worldVelocity.x, -worldVelocity.y);
	}

	//==============================================================================
	// 화면 픽셀 이동량 → 월드 이동량. (회전을 되돌리고 줌으로 나눈다)
	//==============================================================================
	/**
	 * @param { number } screenDeltaX 화면 가로 이동량. (픽셀)
	 * @param { number } screenDeltaY 화면 세로 이동량. (픽셀)
	 * @returns { Vector2 } 월드 이동량.
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
	// 화면 기준점을 고정한 줌. (휠 / 핀치, anchorScreen 아래의 월드 지점이 움직이지 않는다)
	//==============================================================================
	/**
	 * @param { Vector2 } anchorScreen 화면 좌표. (뷰 좌상단 기준)
	 * @param { number } zoomFactor 곱할 배율. (1.1 = 10% 확대)
	 * @example <caption>커서 아래 지점을 붙잡은 채 확대하기</caption>
	 * import { Camera2D, Vector2 } from "./build/vanilla.js";
	 *
	 * const camera = new Camera2D();
	 * camera.setViewSize(Vector2.create(960, 640));
	 * const cursorPosition = Vector2.create(800, 100);
	 * const before = camera.screenToWorld(cursorPosition);
	 * camera.zoomAt(cursorPosition, 1.5);
	 * const after = camera.screenToWorld(cursorPosition);
	 * console.log(camera.getZoom(), before.x, before.y, after.x, after.y);
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
	 * @param { Vector2 } targetPosition 옮겨 갈 월드 위치.
	 * @param { number } targetZoom 옮겨 갈 배율. (줌 범위로 자른다)
	 * @param { number } duration 걸리는 시간. (초, 기본 0.4)
	 * @example <caption>0.5 초 동안 다른 자리로 옮겨 가며 확대하기</caption>
	 * import { Camera2D, Vector2 } from "./build/vanilla.js";
	 *
	 * const camera = new Camera2D();
	 * camera.tweenTo(Vector2.create(300, 200), 2, 0.5);
	 * while (camera.isTweening()) {
	 * 	camera.tick(1 / 60);
	 * }
	 * const position = camera.getPosition();
	 * console.log(position.x, position.y, camera.getZoom());
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
	 * @param { Graphic } graphic 변환을 걸 그래픽.
	 */
	applyTransform(graphic) {
		graphic.translate(this.#viewSize.x * 0.5, this.#viewSize.y * 0.5);
		graphic.scale(this.#zoom, this.#zoom);
		graphic.rotate(Math.degreeToRadian(this.#rotation));
		graphic.translate(-this.#position.x, -this.#position.y);
	}

	//==============================================================================
	// 그리기 시작. (상태를 쌓고 변환을 건다, deprecated/camera.js 의 begin)
	//==============================================================================
	/**
	 * @param { Graphic } graphic 그릴 그래픽.
	 */
	begin(graphic) {
		graphic.pushState();
		this.applyTransform(graphic);
	}

	//==============================================================================
	// 그리기 끝. (begin 이 쌓은 상태를 되돌린다, deprecated/camera.js 의 end)
	//==============================================================================
	/**
	 * @param { Graphic } graphic 그릴 그래픽.
	 */
	end(graphic) {
		graphic.popState();
	}

	//==============================================================================
	// 화면 좌표 → 월드 좌표.
	//==============================================================================
	/**
	 * @param { Vector2 } screenPosition 화면 좌표. (뷰 좌상단 기준)
	 * @returns { Vector2 } 월드 좌표.
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
	 * @param { Vector2 } worldPosition 월드 좌표.
	 * @returns { Vector2 } 화면 좌표. (뷰 좌상단 기준)
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
	 * @returns { Vector2 } 보이는 월드 영역의 반 너비, 반 높이.
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
	/** @param { Vector2 } position 바라볼 월드 위치. (월드 경계가 있으면 자른다) */
	setPosition(position) {
		this.#position = Vector2.create(position.x, position.y);
		this.clampToBounds();
	}

	//==============================================================================
	// 바라보는 월드 위치 반환. (화면 가운데)
	//==============================================================================
	/** @returns { Vector2 } 바라보는 월드 위치. */
	getPosition() {
		return this.#position;
	}

	//==============================================================================
	// 확대 배율 설정. (줌 범위로 자른다, 기본 1)
	//==============================================================================
	/** @param { number } zoom 확대 배율. */
	setZoom(zoom) {
		this.#zoom = Math.clamp(zoom, this.#minZoom, this.#maxZoom);
		this.clampToBounds();
	}

	//==============================================================================
	// 확대 배율 반환.
	//==============================================================================
	/** @returns { number } 확대 배율. */
	getZoom() {
		return this.#zoom;
	}

	//==============================================================================
	// 회전 각도 설정.
	//==============================================================================
	/** @param { number } rotation 도. (화면 가운데를 축으로 돈다) */
	setRotation(rotation) {
		this.#rotation = rotation;
		this.clampToBounds();
	}

	//==============================================================================
	// 회전 각도 반환. (도)
	//==============================================================================
	/** @returns { number } 회전 각도. (도) */
	getRotation() {
		return this.#rotation;
	}

	//==============================================================================
	// 화면 크기 설정. (화면 가운데를 잡는 데 쓴다, 기본 960 x 640)
	//==============================================================================
	/** @param { Vector2 } viewSize 화면 크기. (픽셀) */
	setViewSize(viewSize) {
		this.#viewSize = Vector2.create(viewSize.x, viewSize.y);
	}

	//==============================================================================
	// 화면 크기 반환.
	//==============================================================================
	/** @returns { Vector2 } 화면 크기. (픽셀) */
	getViewSize() {
		return this.#viewSize;
	}

	//==============================================================================
	// 월드 경계 설정. (보이는 영역이 이 안에 들게 자른다)
	//==============================================================================
	/** @param { Rect | null } worldBounds 월드 경계. (null 이면 자르지 않는다) */
	setWorldBounds(worldBounds) {
		this.#worldBounds = worldBounds;
		this.clampToBounds();
	}

	//==============================================================================
	// 월드 경계 반환.
	//==============================================================================
	/** @returns { Rect | null } 월드 경계. (없으면 null) */
	getWorldBounds() {
		return this.#worldBounds;
	}

	//==============================================================================
	// 줌 범위 설정. (지금 배율도 이 범위로 자른다, 기본 0.1 ~ 8)
	//==============================================================================
	/** @param { number } minZoom 최소 배율. @param { number } maxZoom 최대 배율. */
	setZoomRange(minZoom, maxZoom) {
		this.#minZoom = minZoom;
		this.#maxZoom = maxZoom;
		this.setZoom(this.#zoom);
	}

	//==============================================================================
	// 관성 감쇠 설정. (클수록 빨리 멈춘다, 기본 6)
	//==============================================================================
	/** @param { number } inertiaDamping 관성 감쇠. (초당 지수 감쇠 계수) */
	setInertiaDamping(inertiaDamping) {
		this.#inertiaDamping = inertiaDamping;
	}

	//==============================================================================
	// 이동 트윈 중인지 여부.
	//==============================================================================
	/** @returns { boolean } 이동 트윈 중이면 참. */
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
