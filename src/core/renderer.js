//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VObject } from "../base/object.js";
import { VNode } from "./node.js";
import { VRect } from "../base/rect.js";
import { VVector2 } from "../base/vector2.js";
import { VEngine } from "./engine.js";



//==============================================================================
// 렌더러.
//==============================================================================
export class VRenderer extends VObject {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { VEngine } */ #engine;
	/** @private @type { CanvasRenderingContext2D } */ #canvasContext;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { VEngine } engine
	 * @param { CanvasRenderingContext2D } canvasContext
	 */
	constructor(engine, canvasContext) {
		super();
		this.#engine = engine;
		this.#canvasContext = canvasContext;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { VEngine } engine
	 */
	update(engine) {
		// 품질 갱신.
		// 왜 매 렌더링마다 실시간 업데이트를 하지 않으면 반영되지 않는지는 모름.
		const canvasContext = this.getCanvasContext();
		canvasContext.imageSmoothingEnabled = true;
		canvasContext.imageSmoothingQuality = "high";
	}

	//==============================================================================
	// 사각형 출력.
	//==============================================================================
	/**
	 * @param { VRect } rect 
	 * @param { string } color 
	 * @param { number } opacity 
	 */
	drawRect(rect, color = "#ffffff", opacity = 1.0) {
		const engine = this.#engine;
		const canvasContext = this.#canvasContext;
		canvasContext.globalAlpha = opacity;
		canvasContext.fillStyle = color;
		canvasContext.fillRect(rect.position.x, rect.position.y, rect.size.x, rect.size.y);
		canvasContext.globalAlpha = 1.0;
	}

	//==============================================================================
	// 이미지 출력.
	//==============================================================================
	/**
	 * @param { HTMLImageElement } image
	 * @param { VVector2 } position
	 * @param { VVector2 } size
	 * @param { VRect } slices
	 * @param { number } rotation
	 * @param { string } color 
	 * @param { number } opacity 
	 */
	drawImage(image, position = VVector2.zero(), size = VVector2.zero(), slices = null, rotation = 0.0, color = "#ffffff", opacity = 1.0) {
		if (image === null){
			throw new Error("image is null");
		}

		const engine = this.#engine;
		const canvasContext = this.#canvasContext;
		canvasContext.globalAlpha = opacity;
		canvasContext.fillStyle = color;
		canvasContext.rotate(rotation);
		// if (size === VVector2.zero()) {
		// 	canvasContext.drawImage(image, position.x, position.y, image.width, image.height);
		// }
		// else if (slices === null || slices == VRect.zero()) {
		// 	canvasContext.drawImage(image, position.x, position.y, size.x, size.y);
		// }
		// else {
		// 	canvasContext.drawImage(image, slices.position.x, slices.position.y, slices.size.x, slices.size.y, position.x, position.y, size.x, size.y);
		// }
		if (slices === null || slices == VRect.zero()) {
			slices = VRect.create(0, 0, image.width, image.height);
		}

		canvasContext.drawImage(image, slices.position.x, slices.position.y, slices.size.x, slices.size.y, position.x, position.y, size.x, size.y);
		// this.#canvasContext.globalAlpha = 1.0;
	}

	//==============================================================================
	// 이미지 나인패치 출력.
	//==============================================================================
	/**
	 * @static
	 * @param { HTMLImageElement } image
	 * @param { VVector2 } position
	 * @param { VVector2 } size
	 * @param { VRect } patch
	 */
	// drawImageNinePatch(image, position, size, patch) {
	// 	const canvasContext = this.getCanvasContext();
	// 	const sw = image.width;
	// 	const sh = image.height;
	// 	const dx = position.x;
	// 	const dy = position.y;
	// 	const dw = size.x;
	// 	const dh = size.y;
	// 	const left = patch.position.x;
	// 	const top = patch.position.y;
	// 	const right = patch.size.x;
	// 	const bottom = patch.size.y;
	// 	const centerSrcW = sw - left - right;
	// 	const centerSrcH = sh - top - bottom;
	// 	const centerDstW = dw - left - right;
	// 	const centerDstH = dh - top - bottom;

	// 	// 위쪽.
	// 	canvasContext.drawImage(image, 0, 0, left, top, dx, dy, left, top); // 왼쪽.
	// 	canvasContext.drawImage(image, left, 0, centerSrcW, top, dx + left, dy, centerDstW, top); // 가운데쪽.
	// 	canvasContext.drawImage(image, sw - right, 0, right, top, dx + dw - right, dy, right, top); // 오른쪽.

	// 	// 가운데쪽.
	// 	canvasContext.drawImage(image, 0, top, left, centerSrcH, dx, dy + top, left, centerDstH); // 왼쪽.
	// 	canvasContext.drawImage(image, left, top, centerSrcW, centerSrcH, dx + left, dy + top, centerDstW, centerDstH); // 가운데쪽.
	// 	canvasContext.drawImage(image, sw - right, top, right, centerSrcH, dx + dw - right, dy + top, right, centerDstH); // 오른쪽.

	// 	// 아래쪽.
	// 	canvasContext.drawImage(image, 0, sh - bottom, left, bottom, dx, dy + dh - bottom, left, bottom); // 왼쪽.
	// 	canvasContext.drawImage(image, left, sh - bottom, centerSrcW, bottom, dx + left, dy + dh - bottom, centerDstW, bottom); // 가운데쪽.
	// 	canvasContext.drawImage(image, sw - right, sh - bottom, right, bottom, dx + dw - right, dy + dh - bottom, right, bottom); // 오른쪽.
	// }
drawImageNinePatch(image, position, size, patch) {
		const canvasContext = this.getCanvasContext();
		const sw = image.width;
		const sh = image.height;
		const dx = Math.floor(position.x);
		const dy = Math.floor(position.y);
		const dw = Math.ceil(size.x);
		const dh = Math.ceil(size.y);
		const left = patch.position.x;
		const top = patch.position.y;
		const right = patch.size.x;
		const bottom = patch.size.y;
		const centerSrcW = sw - left - right;
		const centerSrcH = sh - top - bottom;
		const centerDstW = dw - left - right;
		const centerDstH = dh - top - bottom;

		// 위쪽.
		canvasContext.drawImage(image, 0, 0, left, top, dx, dy, left + 1, top + 1); 
		canvasContext.drawImage(image, left, 0, centerSrcW, top, dx + left, dy, centerDstW + 1, top + 1); 
		canvasContext.drawImage(image, sw - right, 0, right, top, dx + dw - right, dy, right + 1, top + 1); 

		// 가운데쪽.
		canvasContext.drawImage(image, 0, top, left, centerSrcH, dx, dy + top, left + 1, centerDstH + 1); 
		canvasContext.drawImage(image, left, top, centerSrcW, centerSrcH, dx + left, dy + top, centerDstW + 1, centerDstH + 1); 
		canvasContext.drawImage(image, sw - right, top, right, centerSrcH, dx + dw - right, dy + top, right + 1, centerDstH + 1); 

		// 아래쪽.
		canvasContext.drawImage(image, 0, sh - bottom, left, bottom, dx, dy + dh - bottom, left + 1, bottom + 1); 
		canvasContext.drawImage(image, left, sh - bottom, centerSrcW, bottom, dx + left, dy + dh - bottom, centerDstW + 1, bottom + 1); 
		canvasContext.drawImage(image, sw - right, sh - bottom, right, bottom, dx + dw - right, dy + dh - bottom, right + 1, bottom + 1); 
	}
	
	//==============================================================================
	// 노드 출력.
	//==============================================================================
	/**
	 * @type { VNode } node
	 */
	drawNode(node) {
		if (node === null) {
			return;
		}

		const engine = this.getEngine();

		node.beginDrawState(this);
		node.preDraw(this);
		node.draw(this);
		node.postDraw(this);
		node.endDrawState(this);
		
		if (engine.isDevelopment()) {
			node.drawGizmos(this);
		}

		// 자식 출력.
		for (const child in node.getChildren()) {
			this.drawNode(child);
		}
	}

	//==============================================================================
	// 출력 영역 제한 시작.
	//==============================================================================
	/**
	 * @type { VRect } rect
	 */
	beginClip(rect) {
		const engine = this.#engine;
		const canvasContext = this.#canvasContext;
		canvasContext.save();
		canvasContext.beginPath();
		canvasContext.rect(rect.position.x, rect.position.y, rect.size.x, rect.size.y); // left, top, width, height.
		canvasContext.clip();
	}

	//==============================================================================
	// 출력 영역 제한 종료.
	//==============================================================================
	endClip() {
		this.#canvasContext.restore();
	}
	
	//==============================================================================
	// 엔진 반환.
	//==============================================================================
	/**
	 * @returns { VEngine }
	 */
	getEngine() {
		return this.#engine;
	}

	//==============================================================================
	// 캔버스 렌더링 컨텍스트 반환.
	//==============================================================================
	/**
	 * @returns { CanvasRenderingContext2D }
	 */
	getCanvasContext() {
		return this.#canvasContext;
	}
}


class GL2D {
	constructor(canvasContext) {
		this.canvasContext = canvasContext;
	}
	glIdentity() {
		// this.canvasContext.setTransform(1, 0, 0, 1, 0, 0);
		this.canvasContext.resetTransform();
	}
	glTranslate(x, y) {
		this.canvasContext.translate(x, y);	
	}
	glScale(x, y) {
		this.canvasContext.scale(x, y);
	}
	glRotate(angle) {
		this.canvasContext.rotate(angle);
	}
	glTransform(matrix) {
		this.canvasContext.transform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
	}
	glViewport(x, y, width, height) {
		this.canvasContext.viewport(x, y, width, height);
	}
	glClearColor(r, g, b, a) {
		this.canvasContext.clearColor(r, g, b, a);
	}
	glPushMatrix() {
		this.canvasContext.save();
	}
	glPopMatrix() {
		this.canvasContext.restore();
	}

}