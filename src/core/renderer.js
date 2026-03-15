//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VObject } from "../base/object.js";
import { VRect } from "../base/rect.js";
import { VVector2 } from "../base/vector2.js";
import { VEngine } from "./engine.js";
// import { VNode } from "./node.js";


//==============================================================================
// 렌더러.
//==============================================================================
export class VRenderer extends VObject {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @public @type { VEngine } */ #engine;
	/** @public @type { CanvasRenderingContext2D } */ #canvasContext;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { VEngine } engine 
	 */
	constructor(engine) {
		super();
		this.#engine = engine;
		this.#canvasContext = engine.canvasContext;
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @type { VNode } node
	 */
	draw(node) {
		if (node === null) {
			return;
		}
		
		node.preDraw(this);
		node.draw(this);
		node.postDraw(this);
	}

	//==============================================================================
	// 사각형 렌더링.
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
		// canvasContext.globalAlpha = 1.0;
	}

	//==============================================================================
	// 이미지 렌더링.
	//==============================================================================
	/**
	 * @param { VVector2 } position
	 * @param { VVector2 } size
	 * @param { number } rotation,
	 * @param { Image } image,
	 * @param { string } color 
	 * @param { number } opacity 
	 */
	drawImage(image, position = VVector2.zero(), size = VVector2.zero(), rotation = 0.0, color = "#ffffff", opacity = 1.0) {
		if (image === null){
			throw new Error("image is null");
		}

		const engine = this.#engine;
		const canvasContext = this.#canvasContext;
		canvasContext.globalAlpha = opacity;
		canvasContext.fillStyle = color;
		canvasContext.rotate(rotation);
		if (size === VVector2.zero()) {
			canvasContext.drawImage(image, position.x, position.y, image.width, image.height);
		}
		else {
			canvasContext.drawImage(image, position.x, position.y, size.x, size.y);
		}
		// this.#canvasContext.globalAlpha = 1.0;
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