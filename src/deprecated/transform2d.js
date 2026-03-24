// //==============================================================================
// // 포함 모듈 목록.
// //==============================================================================
// import { Object } from "../base/object.js";
// import { Vector2 } from "../base/vector2.js";


// //==============================================================================
// // 2D 월드 매트릭스.
// //==============================================================================
// export class VTransform2D extends Object {
// 	//==============================================================================
// 	// 멤버 변수 목록.
// 	//==============================================================================
// 	/** @private @type { Vector2 } */ #translation; // 이동.
// 	/** @private @type { Vector2 } */ #scale; // 크기.
// 	/** @private @type { Vector2 } */ #skew; // 기울임.

// 	//==============================================================================
// 	// 생성.
// 	//==============================================================================
// 	/**
// 	 * @constructor
// 	 */
// 	constructor() {
// 		super();
// 		this.#translation = Vector2.zero();
// 		this.#scale = Vector2.one();
// 		this.#skew = Vector2.zero();
// 	}

// 	//==============================================================================
// 	// 갱신.
// 	//==============================================================================
// 	/**
// 	 * @method
// 	 */
// 	update() {

// 	}

// 	//==============================================================================
// 	// 월드 행렬 적용.
// 	//==============================================================================
// 	/**
// 	 * @method
// 	 * @param { CanvasRenderingContext2D } canvasContext
// 	 */
// 	applyWorldMatrix(canvasContext) {
// 		if (canvasContext === null) {
// 			return;
// 		}
// 		if (canvasContext instanceof CanvasRenderingContext2D) {
// 			canvasContext.setTransform(this.#scale.x, this.#skew.y, this.#skew.x, this.#scale.y, this.#translation.x, this.#translation.y);
// 		}
// 	}

// 	//==============================================================================
// 	// 월드 행렬 반환.
// 	// [sx, rx, tx]
// 	// [ry, sy, ty]
// 	// [0, 0, 1]
// 	//==============================================================================
// 	/**
// 	 * @method
// 	 * @returns { number[] }
// 	 */
// 	setWorldMatrix(worldMatrix) {
// 		if (worldMatrix === null) {
// 			return;
// 		}
// 		else if (worldMatrix instanceof Array) {
// 			this.#scale.x = worldMatrix[0];
// 			this.#skew.y = worldMatrix[1];
// 			this.#skew.x = worldMatrix[2];
// 			this.#scale.y = worldMatrix[3];
// 			this.#translation.x = worldMatrix[4];
// 			this.#translation.y = worldMatrix[5];
// 		}
// 	}

// 	//==============================================================================
// 	// 월드 행렬 반환.
// 	// [sx, rx, tx]
// 	// [ry, sy, ty]
// 	// [0, 0, 1]
// 	//==============================================================================
// 	/**
// 	 * @method
// 	 * @returns { number[] }
// 	 */
// 	getWorldMatrix() {
// 		return [
// 			this.#scale.x, this.#skew.y, this.#skew.x, this.#scale.y, this.#translation.x, this.#translation.y
// 		];
// 	}
// }