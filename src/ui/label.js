//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VVector2 } from "../base/vector2.js";
import { VRenderer } from "../core/renderer.js";
import { UINode } from "./uinode.js";
import { VFontAsset } from "../core/fontasset.js";


//==============================================================================
// UI 레이블.
//==============================================================================
export class UILabel extends UINode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { VFontAsset } */ fontAsset = null;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.fontAsset = null;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta 
	 */
	update(timeDelta) {
		super.update(timeDelta);
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @override
	 * @param { VRenderer } renderer 
	 */
	draw(renderer) {
		// super.draw(renderer);

		// const view = getEngine
		const canvasContext = renderer.getCanvasContext();
		const SYSTEM_FONT_STRING = '-apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
		canvasContext.fillStyle = "#000000";
		canvasContext.font = `bold 64px ${SYSTEM_FONT_STRING}`;
		canvasContext.textAlign = "center";
		canvasContext.fillText(`${this.Score}`, engine.width / 2, 236);
	}
}