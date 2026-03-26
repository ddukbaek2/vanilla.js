//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Object } from "../base/object.js";
import { Node } from "./node.js";
import { Rect } from "../base/rect.js";
import { Vector2 } from "../base/vector2.js";
import { Engine } from "./engine.js";


//==============================================================================
// 렌더러.
//==============================================================================
export class Renderer extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { CanvasRenderingContext2D } */ #canvasContext;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { Engine } engine
	 * @param { CanvasRenderingContext2D } canvasContext
	 */
	constructor(engine, canvasContext) {
		super();
		this.#canvasContext = canvasContext;
	}

	//==============================================================================
	// 설정 반영.
	//==============================================================================
	/**
	 * @param { Engine } engine
	 */
	applySettings(engine) {
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
	 * @param { Rect } rect 
	 * @param { string } color 
	 * @param { number } opacity 
	 */
	drawRect(rect, color = "#ffffff", opacity = 1.0) {
		const canvasContext = this.getCanvasContext();
		const originalOpacity = canvasContext.globalAlpha;
		canvasContext.beginPath();
		canvasContext.globalAlpha = opacity;
		canvasContext.fillStyle = color;
		canvasContext.fillRect(rect.position.x, rect.position.y, rect.size.x, rect.size.y);
		canvasContext.globalAlpha = originalOpacity;
	}

	//==============================================================================
	// 이미지 출력.
	//==============================================================================
	/**
	 * @param { HTMLImageElement } image
	 * @param { Vector2 } position
	 * @param { Vector2 } size
	 * @param { Rect } source
	 * @param { number } rotation
	 * @param { string } color 
	 * @param { number } opacity 
	 */
	drawImage(image, position = Vector2.zero(), size = Vector2.zero(), source = Rect.zero(), rotation = 0.0, color = "#ffffff", opacity = 1.0) {
		if (image === null){
			throw new Error("image is null");
		}

		const canvasContext = this.getCanvasContext();
		canvasContext.globalAlpha = opacity;
		canvasContext.fillStyle = color;
		canvasContext.rotate(rotation);
		// if (size === Vector2.zero()) {
		// 	canvasContext.drawImage(image, position.x, position.y, image.width, image.height);
		// }
		// else if (slices === null || slices == Rect.zero()) {
		// 	canvasContext.drawImage(image, position.x, position.y, size.x, size.y);
		// }
		// else {
		// 	canvasContext.drawImage(image, slices.position.x, slices.position.y, slices.size.x, slices.size.y, position.x, position.y, size.x, size.y);
		// }
		if (source === null || source.equals(Rect.zero())) {
			source = Rect.create(0, 0, image.width, image.height);
		}

		canvasContext.drawImage(image, source.position.x, source.position.y, source.size.x, source.size.y, position.x, position.y, size.x, size.y);
		// this.#canvasContext.globalAlpha = 1.0;
	}

	//==============================================================================
	// 이미지 나인패치 출력.
	//==============================================================================
	/**
	 * @static
	 * @param { HTMLImageElement } image
	 * @param { Vector2 } position
	 * @param { Vector2 } size
	 * @param { Rect } patch
	 */
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
	 * @param { Node } node
	 */
	drawNode(node) {
		if (node === null || !node.isActive()) {
			return;
		}

		try {
			node.beginCanvasState(this);
			node.draw(this);
			// node.drawGizmos(this);
			for (const child of node.getChildren()) {
				this.drawNode(child);
			}
			node.endCanvasState(this);
		}
		catch (error) {
			throw error;
		}
	}

	//==============================================================================
	// 출력 영역 제한 시작.
	//==============================================================================
	/**
	 * @type { Rect } rect
	 */
	beginClip(rect) {
		const canvasContext = this.getCanvasContext();
		canvasContext.save();
		canvasContext.beginPath();
		canvasContext.rect(rect.position.x, rect.position.y, rect.size.x, rect.size.y); // left, top, width, height.
		canvasContext.clip();
	}

	//==============================================================================
	// 출력 영역 제한 종료.
	//==============================================================================
	endClip() {
		const canvasContext = this.getCanvasContext();
		canvasContext.restore();
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