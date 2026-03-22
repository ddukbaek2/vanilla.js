//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VObject } from "../base/object.js";
import { VVector2 } from "../base/vector2.js";
import { VRect } from "../base/rect.js";


//==============================================================================
// 출력 도우미.
//==============================================================================
export class VDrawHelper extends VObject {
	//==============================================================================
	// 사각형 출력.
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasContext,
	 * @param { VRect } rect 
	 * @param { string } color 
	 * @param { number } opacity 
	 */
	static drawRect(canvasContext, rect = VRect.zero(), color = "#ffffff", opacity = 1.0) {
		if (canvasContext === null || canvasContext instanceof CanvasRenderingContext2D === false) {
			throw new Error("canvasContext is null");
		}

		canvasContext.globalAlpha = opacity;
		canvasContext.fillStyle = color;
		canvasContext.fillRect(rect.position.x, rect.position.y, rect.size.x, rect.size.y);
		canvasContext.globalAlpha = 1.0;
	}

}