//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Rect } from "../base/rect.js";


//==============================================================================
// GL2D.
//==============================================================================
class GL2D {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { CanvasRenderingContext2D } */ #canvasRenderingContext;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { CanvasRenderingContext2D } canvasRenderingContext 
	 */
	constructor(canvasRenderingContext) {
		this.#canvasRenderingContext = canvasRenderingContext;
	}

	//==============================================================================
	// glIdentity.
	//==============================================================================
	glIdentity() {
		if (this.#canvasRenderingContext === null || this.#canvasRenderingContext instanceof CanvasRenderingContext2D === false) {
			return;
		}

		// this.canvasRenderingContext.setTransform(1, 0, 0, 1, 0, 0);
		this.#canvasRenderingContext.resetTransform();
	}

	//==============================================================================
	// glTranslate.
	//==============================================================================
	glTranslate(x, y) {
		if (this.#canvasRenderingContext === null || this.#canvasRenderingContext instanceof CanvasRenderingContext2D === false) {
			return;
		}

		this.#canvasRenderingContext.translate(x, y);	
	}

	//==============================================================================
	// glScale.
	//==============================================================================
	glScale(x, y) {
		if (this.#canvasRenderingContext === null || this.#canvasRenderingContext instanceof CanvasRenderingContext2D === false) {
			return;
		}

		this.#canvasRenderingContext.scale(x, y);
	}

	//==============================================================================
	// glRotate.
	//==============================================================================
	glRotate(radian) {
		if (this.#canvasRenderingContext === null || this.#canvasRenderingContext instanceof CanvasRenderingContext2D === false) {
			return;
		}

		this.#canvasRenderingContext.rotate(radian);
	}

	//==============================================================================
	// glTransform.
	//==============================================================================
	glTransform(matrix) {
		if (this.#canvasRenderingContext === null || this.#canvasRenderingContext instanceof CanvasRenderingContext2D === false) {
			return;
		}

		this.#canvasRenderingContext.transform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
	}

	//==============================================================================
	// glViewport.
	//==============================================================================
	glViewport(x, y, width, height) {
		if (this.#canvasRenderingContext === null || this.#canvasRenderingContext instanceof CanvasRenderingContext2D === false) {
			return;
		}

		this.#canvasRenderingContext.viewport(x, y, width, height);
	}

	//==============================================================================
	// glClearColor.
	//==============================================================================
	glClearColor(r, g, b, a) {
		if (this.#canvasRenderingContext === null || this.#canvasRenderingContext instanceof CanvasRenderingContext2D === false) {
			return;
		}

		this.#canvasRenderingContext.clearColor(r, g, b, a);
	}

	//==============================================================================
	// glPushMatrix.
	//==============================================================================
	glPushMatrix() {
		if (this.#canvasRenderingContext === null || this.#canvasRenderingContext instanceof CanvasRenderingContext2D === false) {
			return;
		}

		this.#canvasRenderingContext.save();
	}

	//==============================================================================
	// glPopMatrix.
	//==============================================================================
	glPopMatrix() {
		if (this.#canvasRenderingContext === null || this.#canvasRenderingContext instanceof CanvasRenderingContext2D === false) {
			return;
		}

		this.#canvasRenderingContext.restore();
	}
}