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
	// 카메라 시작.
	//==============================================================================
	/**
	 * 카메라 변환을 시작하고 캔버스 상태를 저장합니다.
	 * 이후 그려지는 오브젝트들은 카메라의 영향을 받습니다.
	 * @param { CanvasRenderingContext2D } canvasContext 
	 * @param { Vector2 } viewportSize 캔버스의 실제 해상도 (중점 정렬용)
	 */
	begin(canvasContext, viewportSize) {
		// 1. 현재 캔버스 상태(Transform 등)를 안전하게 저장.
		canvasContext.save();

		// 2. 화면 중앙으로 원점 이동.
		canvasContext.translate(viewportSize.x / 2, viewportSize.y / 2);

		// 3. 줌 적용.
		canvasContext.scale(this.#zoom, this.#zoom);

		// 4. 회전 적용.
		canvasContext.rotate(this.#rotation);

		// 5. 카메라 위치(중심점)만큼 월드 좌표 역이동.
		canvasContext.translate(-this.#position.x, -this.#position.y);
	}

	//==============================================================================
	// 카메라 종료.
	//==============================================================================
	/**
	 * 카메라 변환을 종료하고 캔버스 상태를 원래대로 복원합니다.
	 * 이후 그려지는 오브젝트들(예: 고정 UI)은 카메라의 영향을 받지 않습니다.
	 * @param { CanvasRenderingContext2D } canvasContext 
	 */
	end(canvasContext) {
		// begin()에서 저장했던 상태로 캔버스를 롤백.
		canvasContext.restore();
	}
}