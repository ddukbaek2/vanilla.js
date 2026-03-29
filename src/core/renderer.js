//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Object } from "../base/object.js";
import { Node } from "./node.js";
import { Rect } from "../base/rect.js";
import { Vector2 } from "../base/vector2.js";
import { Engine } from "./engine.js";
import { Color } from "../base/color.js";


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
	// 색상 설정.
	//==============================================================================
	/**
	 * @param { Color | string | CanvasGradient | CanvasPattern } color
	 */
	setFillColor(color) {
		const canvasContext = this.getCanvasContext();
		if (canvasContext) {
			if (color) {
				if (color instanceof Color) {
				const colorString = color.toHEXString();
				canvasContext.fillStyle = colorString;
				}
				else {
					canvasContext.fillStyle = color;
				}
			}
		}		
	}

	//==============================================================================
	// 색상 설정.
	//==============================================================================
	/**
	 * @param { Color | string | CanvasGradient | CanvasPattern } color
	 */
	setStrokeColor(color) {
		const canvasContext = this.getCanvasContext();
		if (canvasContext) {
			if (color) {
				if (color instanceof Color) {
					const colorString = color.toHEXString();
					canvasContext.strokeStyle = colorString;
				}
				else {
					canvasContext.strokeStyle = color;
				}
			}
		}		
	}

	//==============================================================================
	// 선 출력.
	// - setStrokeColor()
	//==============================================================================
	/**
	 * @param { Vector2[] } positions
	 */
	drawLine(positions, size = 1) {
		const canvasContext = this.getCanvasContext();
		if (canvasContext) {
			canvasContext.lineWidth = size;
			canvasContext.beginPath();
			canvasContext.moveTo(positions[0].x, positions[0].y);
			for (let i = 1; i < positions.length; ++i) {
				canvasContext.lineTo(positions[i].x, positions[i].y);				
			}
			canvasContext.stroke();
		}		
	}

	//==============================================================================
	// 사각형 출력.
	// - setFillColor()
	//==============================================================================
	/**
	 * @param { Rect } rect 
	//  * @param { string } color 
	//  * @param { number } opacity 
	 */
	drawRect(rect) {
		const canvasContext = this.getCanvasContext();
		if (canvasContext) {
			canvasContext.fillRect(rect.position.x, rect.position.y, rect.size.x, rect.size.y);
		}
	}

	//==============================================================================
	// 원 출력.
	// - setFillColor()
	//==============================================================================
	/**
	 * @param { Vector2 } center
	 * @param { number } radius 
	 */
	drawCircle(center, radius) {
		const canvasContext = this.getCanvasContext();
		if (canvasContext) {
			canvasContext.beginPath();
			canvasContext.arc(center.x, center.y, radius, 0, Math.PI * 2);
			canvasContext.fill();
		}
	}

	//==============================================================================
	// 이미지 출력.
	// - setFillColor()
	//==============================================================================
	/**
	 * @param { HTMLImageElement | HTMLCanvasElement } image
	 * @param { Vector2 } position
	 * @param { Vector2 } contentSize
	 */
	drawImage(image, position, contentSize) {
		if (image === null){
			throw new Error("image is null");
		}

		const canvasContext = this.getCanvasContext();
		if (canvasContext) {
			canvasContext.drawImage(image, position.x, position.y, contentSize.x, contentSize.y);
		}
	}

	//==============================================================================
	// 이미지 출력2.
	// - setFillColor()
	//==============================================================================
	/**
	 * @param { HTMLImageElement | HTMLCanvasElement } image
	 * @param { Vector2 } position
	 * @param { Vector2 } contentSize
	 * @param { Rect } source
	 */
	drawImage2(image, position, contentSize, source) {
		if (image === null){
			throw new Error("image is null");
		}

		const canvasContext = this.getCanvasContext();
		if (canvasContext) {
			if (source === null || source.equals(Rect.zero())) {
				source = Rect.create(0, 0, image.width, image.height);
			}

			canvasContext.drawImage(image, 
				source.position.x, source.position.y, source.size.x, source.size.y,
				position.x, position.y, contentSize.x, contentSize.y);
		}
	}

	//==============================================================================
	// 이미지 나인패치 출력.
	//==============================================================================
	/**
	 * @static
	 * @param { HTMLImageElement | HTMLCanvasElement } image
	 * @param { Vector2 } position
	 * @param { Vector2 } size
	 * @param { Rect } ninepatch
	 */
	drawImageNinePatch(image, position, size, ninepatch) {
		const canvasContext = this.getCanvasContext();
		const sw = image.width;
		const sh = image.height;
		const dx = Math.floor(position.x);
		const dy = Math.floor(position.y);
		const dw = Math.ceil(size.x);
		const dh = Math.ceil(size.y);
		const left = ninepatch.position.x;
		const top = ninepatch.position.y;
		const right = ninepatch.size.x;
		const bottom = ninepatch.size.y;

		const hasHorizontal = left > 0 || right > 0;
		const hasVertical = top > 0 || bottom > 0;

		if (hasHorizontal && hasVertical) {
			// 가로세로 다 쪼개기.
			const centerSrcW = sw - left - right;
			const centerSrcH = sh - top - bottom;
			const centerDstW = dw - left - right;
			const centerDstH = dh - top - bottom;

			// 위쪽.
			canvasContext.drawImage(image, 0, 0, left, top, dx, dy, left + 1, top + 1);
			canvasContext.drawImage(image, left, 0, centerSrcW, top, dx + left, dy, centerDstW + 1, top + 1);
			canvasContext.drawImage(image, sw - right, 0, right, top, dx + dw - right, dy, right, top + 1);

			// 가운데쪽.
			canvasContext.drawImage(image, 0, top, left, centerSrcH, dx, dy + top, left + 1, centerDstH + 1);
			canvasContext.drawImage(image, left, top, centerSrcW, centerSrcH, dx + left, dy + top, centerDstW + 1, centerDstH + 1);
			canvasContext.drawImage(image, sw - right, top, right, centerSrcH, dx + dw - right, dy + top, right, centerDstH + 1);

			// 아래쪽.
			canvasContext.drawImage(image, 0, sh - bottom, left, bottom, dx, dy + dh - bottom, left + 1, bottom);
			canvasContext.drawImage(image, left, sh - bottom, centerSrcW, bottom, dx + left, dy + dh - bottom, centerDstW + 1, bottom);
			canvasContext.drawImage(image, sw - right, sh - bottom, right, bottom, dx + dw - right, dy + dh - bottom, right, bottom);
		}
		else if (hasHorizontal) {
			// 가로만 쪼개기.
			const centerSrcW = sw - left - right;
			const centerDstW = dw - left - right;

			canvasContext.drawImage(image, 0, 0, left, sh, dx, dy, left + 1, dh);
			canvasContext.drawImage(image, left, 0, centerSrcW, sh, dx + left, dy, centerDstW + 1, dh);
			canvasContext.drawImage(image, sw - right, 0, right, sh, dx + dw - right, dy, right, dh);
		}
		else if (hasVertical) {
			// 세로만 쪼개기.
			const centerSrcH = sh - top - bottom;
			const centerDstH = dh - top - bottom;

			canvasContext.drawImage(image, 0, 0, sw, top, dx, dy, dw, top + 1);
			canvasContext.drawImage(image, 0, top, sw, centerSrcH, dx, dy + top, dw, centerDstH + 1);
			canvasContext.drawImage(image, 0, sh - bottom, sw, bottom, dx, dy + dh - bottom, dw, bottom);
		}
		else {
			// 쪼개기 없음.
			canvasContext.drawImage(image, 0, 0, sw, sh, dx, dy, dw, dh);
		}
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
			node.drawGizmos(this);
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
	beginClipRect(rect) {
		const canvasContext = this.getCanvasContext();
		canvasContext.save();
		canvasContext.beginPath();
		canvasContext.rect(rect.position.x, rect.position.y, rect.size.x, rect.size.y); // left, top, width, height.
		canvasContext.clip();
	}

	//==============================================================================
	// 출력 영역 제한 종료.
	//==============================================================================
	endClipRect() {
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