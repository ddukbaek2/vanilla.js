//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";


//==============================================================================
// 카메라 클래스.
//==============================================================================
/**
 * 게임 월드를 비추는 카메라 클래스입니다.
 * 위치, 줌, 회전 기능을 제공하며 렌더링 컨텍스트에 변환을 적용합니다.
 */
export class Camera extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Vector2 } */ #position; // 카메라가 바라보는 중심 위치.
	/** @private @type { number } */ #zoom; // 확대/축소 비율.
	/** @private @type { number } */ #rotation; // 회전 각도 (라디안).

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.#position = Vector2.zero();
		this.#zoom = 1.0;
		this.#rotation = 0;
	}

	//==============================================================================
	// 설정.
	//==============================================================================
	/**
	 * 카메라의 위치를 설정합니다.
	 * @param { number } x 
	 * @param { number } y 
	 */
	setPosition(x, y) {
		this.#position.set(x, y);
	}

	/**
	 * @returns { Vector2 }
	 */
	getPosition() {
		return this.#position;
	}

	/**
	 * 카메라의 줌 비율을 설정합니다.
	 * @param { number } value 
	 */
	setZoom(value) {
		this.#zoom = Math.max(0.01, value); // 0 이하 방지.
	}

	/**
	 * @returns { number }
	 */
	getZoom() {
		return this.#zoom;
	}

	/**
	 * 카메라의 회전 각도를 설정합니다.
	 * @param { number } radians 
	 */
	setRotation(radians) {
		this.#rotation = radians;
	}

	/**
	 * @returns { number }
	 */
	getRotation() {
		return this.#rotation;
	}

	//==============================================================================
	// 조작.
	//==============================================================================
	/**
	 * 현재 위치에서 상대적으로 이동합니다.
	 * @param { number } dx 
	 * @param { number } dy 
	 */
	move(dx, dy) {
		this.#position.x += dx;
		this.#position.y += dy;
	}

	/**
	 * 현재 줌에 값을 더합니다.
	 * @param { number } delta 
	 */
	zoomBy(delta) {
		this.setZoom(this.#zoom + delta);
	}

	/**
	 * 현재 각도에 값을 더합니다.
	 * @param { number } deltaRadians 
	 */
	rotate(deltaRadians) {
		this.#rotation += deltaRadians;
	}

	//==============================================================================
	// 적용.
	//==============================================================================
	/**
	 * 캔버스 컨텍스트에 카메라 변환을 적용합니다.
	 * @param { CanvasRenderingContext2D } canvasContext 
	 * @param { Vector2 } viewportSize 캔버스의 실제 해상도 (중점 정렬용)
	 */
	apply(canvasContext, viewportSize) {
		// 1. 화면 중앙으로 원점 이동.
		canvasContext.translate(viewportSize.x / 2, viewportSize.y / 2);

		// 2. 줌 적용.
		canvasContext.scale(this.#zoom, this.#zoom);

		// 3. 회전 적용.
		canvasContext.rotate(this.#rotation);

		// 4. 카메라 위치(중심점)만큼 월드 좌표 역이동.
		canvasContext.translate(-this.#position.x, -this.#position.y);
	}
}