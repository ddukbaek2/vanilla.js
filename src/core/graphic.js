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
// 그래픽.
// - Canvas에서 가져와 사용 할 수 있는 렌더링컨텍스트.
//==============================================================================
export class Graphic extends Object {
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
		super();
		this.#canvasRenderingContext = canvasRenderingContext;
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
		const canvasRenderingContext = this.getCanvasRenderingContext();
		canvasRenderingContext.imageSmoothingEnabled = true;
		canvasRenderingContext.imageSmoothingQuality = "high";
	}

	//==============================================================================
	// 색상 설정.
	//==============================================================================
	/**
	 * @param { Color | string | CanvasGradient | CanvasPattern } color
	 */
	setFillColor(color) {
		const canvasRenderingContext = this.getCanvasRenderingContext();
		if (canvasRenderingContext) {
			if (color) {
				if (color instanceof Color) {
				const colorString = color.toHEXString();
				canvasRenderingContext.fillStyle = colorString;
				}
				else {
					canvasRenderingContext.fillStyle = color;
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
		const canvasRenderingContext = this.getCanvasRenderingContext();
		if (canvasRenderingContext) {
			if (color) {
				if (color instanceof Color) {
					const colorString = color.toHEXString();
					canvasRenderingContext.strokeStyle = colorString;
				}
				else {
					canvasRenderingContext.strokeStyle = color;
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
		const canvasRenderingContext = this.getCanvasRenderingContext();
		if (canvasRenderingContext) {
			canvasRenderingContext.lineWidth = size;
			canvasRenderingContext.beginPath();
			canvasRenderingContext.moveTo(positions[0].x, positions[0].y);
			for (let i = 1; i < positions.length; ++i) {
				canvasRenderingContext.lineTo(positions[i].x, positions[i].y);				
			}
			canvasRenderingContext.stroke();
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
		const canvasRenderingContext = this.getCanvasRenderingContext();
		if (canvasRenderingContext) {
			canvasRenderingContext.fillRect(rect.position.x, rect.position.y, rect.size.x, rect.size.y);
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
		const canvasRenderingContext = this.getCanvasRenderingContext();
		if (canvasRenderingContext) {
			canvasRenderingContext.beginPath();
			canvasRenderingContext.arc(center.x, center.y, radius, 0, Math.PI * 2);
			canvasRenderingContext.fill();
		}
	}

	//==============================================================================
	// 이미지 출력.
	// - setFillColor() Not Supported.
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

		const canvasRenderingContext = this.getCanvasRenderingContext();
		if (canvasRenderingContext) {
			canvasRenderingContext.drawImage(image, position.x, position.y, contentSize.x, contentSize.y);
		}
	}

	//==============================================================================
	// 범위를 지정하는 이미지 출력.
	// - setFillColor() Not Supported.
	//==============================================================================
	/**
	 * @param { HTMLImageElement | HTMLCanvasElement } image
	 * @param { Vector2 } position
	 * @param { Vector2 } contentSize
	 * @param { Rect } sourceRect
	 */
	drawImageWithSourceRect(image, position, contentSize, sourceRect) {
		if (image === null){
			throw new Error("image is null");
		}

		const canvasRenderingContext = this.getCanvasRenderingContext();
		if (canvasRenderingContext) {
			if (sourceRect === null || sourceRect.equals(Rect.zero())) {
				sourceRect = Rect.create(0, 0, image.width, image.height);
			}

			canvasRenderingContext.drawImage(image, 
				sourceRect.position.x, sourceRect.position.y, sourceRect.size.x, sourceRect.size.y,
				position.x, position.y, contentSize.x, contentSize.y);
		}
	}

	//==============================================================================
	// 이미지 나인패치 출력.
	// - setFillColor() Not Supported.
	//==============================================================================
	/**
	 * @static
	 * @param { HTMLImageElement | HTMLCanvasElement } image
	 * @param { Vector2 } position
	 * @param { Vector2 } size
	 * @param { Rect } nineslice
	 */
	drawImageWithNineslice(image, position, size, nineslice) {
		const canvasRenderingContext = this.getCanvasRenderingContext();
		const sw = image.width;
		const sh = image.height;
		const dx = Math.floor(position.x);
		const dy = Math.floor(position.y);
		const dw = Math.ceil(size.x);
		const dh = Math.ceil(size.y);
		const left = nineslice.position.x;
		const top = nineslice.position.y;
		const right = nineslice.size.x;
		const bottom = nineslice.size.y;

		const hasHorizontal = left > 0 || right > 0;
		const hasVertical = top > 0 || bottom > 0;

		if (hasHorizontal && hasVertical) {
			// 가로세로 다 쪼개기.
			const centerSrcW = sw - left - right;
			const centerSrcH = sh - top - bottom;
			const centerDstW = dw - left - right;
			const centerDstH = dh - top - bottom;

			// 위쪽.
			canvasRenderingContext.drawImage(image, 0, 0, left, top, dx, dy, left + 1, top + 1);
			canvasRenderingContext.drawImage(image, left, 0, centerSrcW, top, dx + left, dy, centerDstW + 1, top + 1);
			canvasRenderingContext.drawImage(image, sw - right, 0, right, top, dx + dw - right, dy, right, top + 1);

			// 가운데쪽.
			canvasRenderingContext.drawImage(image, 0, top, left, centerSrcH, dx, dy + top, left + 1, centerDstH + 1);
			canvasRenderingContext.drawImage(image, left, top, centerSrcW, centerSrcH, dx + left, dy + top, centerDstW + 1, centerDstH + 1);
			canvasRenderingContext.drawImage(image, sw - right, top, right, centerSrcH, dx + dw - right, dy + top, right, centerDstH + 1);

			// 아래쪽.
			canvasRenderingContext.drawImage(image, 0, sh - bottom, left, bottom, dx, dy + dh - bottom, left + 1, bottom);
			canvasRenderingContext.drawImage(image, left, sh - bottom, centerSrcW, bottom, dx + left, dy + dh - bottom, centerDstW + 1, bottom);
			canvasRenderingContext.drawImage(image, sw - right, sh - bottom, right, bottom, dx + dw - right, dy + dh - bottom, right, bottom);
		}
		else if (hasHorizontal) {
			// 가로만 쪼개기.
			const centerSrcW = sw - left - right;
			const centerDstW = dw - left - right;

			canvasRenderingContext.drawImage(image, 0, 0, left, sh, dx, dy, left + 1, dh);
			canvasRenderingContext.drawImage(image, left, 0, centerSrcW, sh, dx + left, dy, centerDstW + 1, dh);
			canvasRenderingContext.drawImage(image, sw - right, 0, right, sh, dx + dw - right, dy, right, dh);
		}
		else if (hasVertical) {
			// 세로만 쪼개기.
			const centerSrcH = sh - top - bottom;
			const centerDstH = dh - top - bottom;

			canvasRenderingContext.drawImage(image, 0, 0, sw, top, dx, dy, dw, top + 1);
			canvasRenderingContext.drawImage(image, 0, top, sw, centerSrcH, dx, dy + top, dw, centerDstH + 1);
			canvasRenderingContext.drawImage(image, 0, sh - bottom, sw, bottom, dx, dy + dh - bottom, dw, bottom);
		}
		else {
			// 쪼개기 없음.
			canvasRenderingContext.drawImage(image, 0, 0, sw, sh, dx, dy, dw, dh);
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
			node.drawGizmo(this);
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
		const canvasRenderingContext = this.getCanvasRenderingContext();
		canvasRenderingContext.save();
		canvasRenderingContext.beginPath();
		canvasRenderingContext.rect(rect.position.x, rect.position.y, rect.size.x, rect.size.y); // left, top, width, height.
		canvasRenderingContext.clip();
	}

	//==============================================================================
	// 출력 영역 제한 종료.
	//==============================================================================
	endClipRect() {
		const canvasRenderingContext = this.getCanvasRenderingContext();
		canvasRenderingContext.restore();
	}

	//==============================================================================
	// 캔버스 렌더링 컨텍스트 반환.
	//==============================================================================
	/**
	 * @returns { CanvasRenderingContext2D }
	 */
	getCanvasRenderingContext() {
		return this.#canvasRenderingContext;
	}
}