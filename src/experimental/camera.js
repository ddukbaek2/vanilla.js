//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import * as Math from "../base/math.js";
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";


//==============================================================================
// 카메라 클래스.
//==============================================================================
/**
 * 게임 월드를 비추는 카메라 클래스입니다.
 * 위치, 줌, 회전 기능을 제공하며 렌더링 컨텍스트에 변환을 적용합니다.
 * @example <caption>캔버스 그리기에 카메라 변환 씌우기</caption>
 * import { Camera, Vector2 } from "./build/vanilla.js";
 *
 * const canvas = document.createElement("canvas");
 * canvas.width = 320;
 * canvas.height = 180;
 * const canvasRenderingContext = canvas.getContext("2d");
 * const camera = new Camera();
 * const position = Vector2.create(40, 20);
 * camera.setPosition(position);
 * camera.setZoom(2);
 * camera.setRotation(15);
 * camera.begin(canvasRenderingContext);
 * canvasRenderingContext.fillStyle = "#ff8800";
 * canvasRenderingContext.fillRect(40, 20, 16, 16);
 * camera.end(canvasRenderingContext);
 * console.log(camera.getZoom(), camera.getRotation());
 */
export class Camera extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Vector2 } */ #position; // 카메라가 바라보는 중심 위치.
	/** @private @type { number } */ #zoom; // 확대/축소 비율.
	/** @private @type { number } */ #rotation; // 회전 각도.

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
	// 시작.
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext 변환을 걸 2D 컨텍스트. (save 한 뒤 줌, 회전, 위치 차례로 건다. 없으면 아무것도 하지 않는다)
	 */
	begin(canvasRenderingContext) {
		if (canvasRenderingContext) {
			const position = this.getPosition();
			const zoom = this.getZoom();
			const rotation = this.getRotation();
			const radian = Math.degreeToRadian(rotation);

			canvasRenderingContext.save();
			// canvasRenderingContext.translate(viewportSize.x / 2, viewportSize.y / 2);
			canvasRenderingContext.scale(zoom, zoom);
			canvasRenderingContext.rotate(radian);
			canvasRenderingContext.translate(-position.x, -position.y);
		}
	}

	//==============================================================================
	// 종료.
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext begin 에 넘긴 2D 컨텍스트. (restore 한다. 없으면 아무것도 하지 않는다)
	 */
	end(canvasRenderingContext) {
		if (canvasRenderingContext) {
			canvasRenderingContext.restore();
		}
	}

	//==============================================================================
	// 이동 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } position 화면 왼쪽 위에 올 월드 위치. (픽셀, 복사하지 않고 그대로 쥔다)
	 */
	setPosition(position) {
		this.#position = position;
	}

	//==============================================================================
	// 이동 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 카메라 위치. (복사본이 아니다)
	 */
	getPosition() {
		return this.#position;
	}

	//==============================================================================
	// 줌 설정.
	//==============================================================================
	/**
	 * @param { number } zoom 확대 배율. (1 이 원래 크기, 0.001 보다 작으면 0.001)
	 */
	setZoom(zoom) {
		this.#zoom = Math.max(0.001, zoom);
	}

	//==============================================================================
	// 줌 반환.
	//==============================================================================
	/**
	 * @returns { number } 확대 배율.
	 */
	getZoom() {
		return this.#zoom;
	}

	//==============================================================================
	// 회전 설정.
	//==============================================================================
	/**
	 * @param { number } rotation 회전 각도. (도)
	 */
	setRotation(rotation) {
		this.#rotation = rotation;
	}

	//==============================================================================
	// 회전 반환.
	//==============================================================================
	/**
	 * @returns { number } 회전 각도. (도)
	 */
	getRotation() {
		return this.#rotation;
	}
}