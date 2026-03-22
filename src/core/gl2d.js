//==============================================================================
// 포함 모듈 목록.
//==============================================================================
// import { VObject } from "../base/object.js";
// import { VVector2 } from "../base/vector2.js";
// import { VRect } from "../base/rect.js";


//==============================================================================
// GL2D.
//==============================================================================
class GL2D {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { CanvasRenderingContext2D } */ #canvasContext;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { CanvasRenderingContext2D } canvasContext 
	 */
	constructor(canvasContext) {
		this.#canvasContext = canvasContext;
	}

	//==============================================================================
	// glIdentity.
	//==============================================================================
	glIdentity() {
		if (this.#canvasContext === null || this.#canvasContext instanceof CanvasRenderingContext2D === false) {
			return;
		}

		// this.canvasContext.setTransform(1, 0, 0, 1, 0, 0);
		this.#canvasContext.resetTransform();
	}

	//==============================================================================
	// glTranslate.
	//==============================================================================
	glTranslate(x, y) {
		if (this.#canvasContext === null || this.#canvasContext instanceof CanvasRenderingContext2D === false) {
			return;
		}

		this.#canvasContext.translate(x, y);	
	}

	//==============================================================================
	// glScale.
	//==============================================================================
	glScale(x, y) {
		if (this.#canvasContext === null || this.#canvasContext instanceof CanvasRenderingContext2D === false) {
			return;
		}

		this.#canvasContext.scale(x, y);
	}

	//==============================================================================
	// glRotate.
	//==============================================================================
	glRotate(radian) {
		if (this.#canvasContext === null || this.#canvasContext instanceof CanvasRenderingContext2D === false) {
			return;
		}

		this.#canvasContext.rotate(radian);
	}

	//==============================================================================
	// glTransform.
	//==============================================================================
	glTransform(matrix) {
		if (this.#canvasContext === null || this.#canvasContext instanceof CanvasRenderingContext2D === false) {
			return;
		}

		this.#canvasContext.transform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
	}

	//==============================================================================
	// glViewport.
	//==============================================================================
	glViewport(x, y, width, height) {
		if (this.#canvasContext === null || this.#canvasContext instanceof CanvasRenderingContext2D === false) {
			return;
		}

		this.#canvasContext.viewport(x, y, width, height);
	}

	//==============================================================================
	// glClearColor.
	//==============================================================================
	glClearColor(r, g, b, a) {
		if (this.#canvasContext === null || this.#canvasContext instanceof CanvasRenderingContext2D === false) {
			return;
		}

		this.#canvasContext.clearColor(r, g, b, a);
	}

	//==============================================================================
	// glPushMatrix.
	//==============================================================================
	glPushMatrix() {
		if (this.#canvasContext === null || this.#canvasContext instanceof CanvasRenderingContext2D === false) {
			return;
		}

		this.#canvasContext.save();
	}

	//==============================================================================
	// glPopMatrix.
	//==============================================================================
	glPopMatrix() {
		if (this.#canvasContext === null || this.#canvasContext instanceof CanvasRenderingContext2D === false) {
			return;
		}

		this.#canvasContext.restore();
	}
}