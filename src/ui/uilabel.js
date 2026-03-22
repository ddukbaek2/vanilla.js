//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VVector2 } from "../base/vector2.js";
import { VRenderer } from "../core/renderer.js";
import { UINode } from "./uinode.js";
import { VFontAsset } from "../resource/fontasset.js";


//==============================================================================
// UI 레이블.
//==============================================================================
export class UILabel extends UINode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { FontFace } */ #font;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.#font = null;
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
		super.draw(renderer);
		// const view =
		const position = super.getPosition();
		const size = super.getContentSize();

		const canvasContext = renderer.getCanvasContext();
		const SYSTEM_FONT_STRING = '-apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
		canvasContext.fillStyle = "#000000";
		canvasContext.font = `bold 64px ${SYSTEM_FONT_STRING}`;
		canvasContext.textAlign = "center";
		canvasContext.fillText(`${this.Score}`, position.x, position.y, size.x, size.y);
	}

	//==============================================================================
	// 폰트 설정.
	//==============================================================================
	/**
	 * @param { FontFace | VFontAsset } font 
	 */
	setFont(font) {
		if (font === null) {
			this.#font = null;
		}
		else if (font instanceof FontFace) {
			this.#font = font;
		}
		else if (font instanceof VFontAsset) {
			this.#font = font.fontFace;
		}
	}

	//==============================================================================
	// 폰트 반환.
	//==============================================================================
	/**
	 * @returns { FontFace } 
	 */
	getFont() {
		return this.#font
	}
}