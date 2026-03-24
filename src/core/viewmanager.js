//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Rect } from "../base/rect.js";
import { Engine } from "./engine.js";
import { Enum } from "../misc/identifier.js";


//==============================================================================
// 뷰 스케일 모드.
//==============================================================================
export const ViewScaleMode = {
	referenceResolution: Enum.begin(), // 기준 해상도를 사용하여 출력.
	canvasResolution: Enum.auto(), // 화면 해상도를 사용하여 출력.
	stretchWidth: Enum.auto(), // 기준 해상도의 가로축을 기준으로 양쪽 비율을 유지한채 화면에 해당 축을 늘여 붙임.
	stretchHeight: Enum.auto(), // 기준 해상도의 세로축을 기준으로 양쪽 비율을 유지한채 화면에 해당 축을 늘여 붙임.
	stretchAuto: Enum.auto(), // 기준 해상도에서 더 짧은쪽의 축을 기준으로 양쪽 비율을 유지한채 화면에 해당 축을 늘여 붙임.
};

//==============================================================================
// 뷰 매니저.
//==============================================================================
export class ViewManager extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { ViewScaleMode } */ #viewScaleMode;
	/** @private @type { number } */ #devicePixelRatio; // 장치의 화면 배율.
	/** @private @type { number } */ #targetResolutionScale; // 기준 해상도와 화면 해상도 사이의 크기 배율.
	/** @private @type { Vector2 } */ #clientSize; // 전체 화면 영역. (devicePixelRatio 반영 전)
	/** @private @type { Vector2 } */ #canvasSize; // 전체 화면 영역. (devicePixelRatio 반영 후)
	/** @private @type { Vector2 } */ #referenceResolutionSize; // 기준 화면 영역.
	/** @private @type { Rect } */ #viewRect; // 실제 사용 화면 영역.


	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { Engine } engine
	 * @param { Vector2 } referenceResolutionSize
	 */
	constructor(engine, referenceResolutionSize) {
		super();
		this.#viewScaleMode = ViewScaleMode.referenceResolution;
		this.#devicePixelRatio = 1;
		this.#targetResolutionScale = 1;
		this.#clientSize = Vector2.zero();
		this.#canvasSize = Vector2.zero();
		this.#referenceResolutionSize = referenceResolutionSize;
		this.#viewRect = Rect.zero();

		this.calculateViewScale();
	}
	
	//==============================================================================
	// 뷰 영역 계산.
	//==============================================================================
	calculateViewScale() {
		// 캔버스 크기 설정.
		const devicePixelRatio = System.window.devicePixelRatio || 1;
		const clientSize = Vector2.create(System.window.innerWidth, System.window.innerHeight);
		const canvasSize = Vector2.create(Math.round(clientSize.x * devicePixelRatio), Math.round(clientSize.y * devicePixelRatio));
		this.#devicePixelRatio = devicePixelRatio;
		this.#clientSize = clientSize;
		this.#canvasSize = canvasSize;

		// 뷰 영역 설정.
		switch (this.#viewScaleMode) {
			case ViewScaleMode.referenceResolution: {
					const targetResolutionScale = 1.0; // 늘이지 않음.
					const viewWidth = Math.round(this.#referenceResolutionSize.x * targetResolutionScale);
					const viewHeight = Math.round(this.#referenceResolutionSize.y * targetResolutionScale);
					const viewX = Math.floor((clientSize.x - viewWidth) * 0.5);
					const viewY = Math.floor((clientSize.y - viewHeight) * 0.5);
					this.#targetResolutionScale = targetResolutionScale;
					this.#viewRect.position.set(viewX, viewY);
					this.#viewRect.size.set(viewWidth, viewHeight);
					break;
				}
			case ViewScaleMode.canvasResolution: {
					const targetResolutionScale = 1.0; // 늘이지 않음.
					const viewX = 0; // Math.floor(clientSize.x * 0.5);
					const viewY = 0; // Math.floor(clientSize.y * 0.5);
					const viewWidth = Math.round(clientSize.x * targetResolutionScale);
					const viewHeight = Math.round(clientSize.y * targetResolutionScale);
					this.#targetResolutionScale = targetResolutionScale;
					this.#viewRect.position.set(viewX, viewY);
					this.#viewRect.size.set(viewWidth, viewHeight);
					break;
				}
			case ViewScaleMode.stretchWidth: {
					const targetResolutionScale = clientSize.x / this.#referenceResolutionSize.x;
					const viewWidth = Math.round(this.#referenceResolutionSize.x * targetResolutionScale);
					const viewHeight = Math.round(this.#referenceResolutionSize.y * targetResolutionScale);
					const viewX = Math.floor((clientSize.x - viewWidth) * 0.5);
					const viewY = Math.floor((clientSize.y - viewHeight) * 0.5);
					this.#targetResolutionScale = targetResolutionScale;
					this.#viewRect.position.set(viewX, viewY);
					this.#viewRect.size.set(viewWidth, viewHeight);
					break;
				}
			case ViewScaleMode.stretchHeight: {
					const targetResolutionScale = clientSize.y / this.#referenceResolutionSize.y;
					const viewWidth = Math.round(this.#referenceResolutionSize.x * targetResolutionScale);
					const viewHeight = Math.round(this.#referenceResolutionSize.y * targetResolutionScale);
					const viewX = Math.floor((clientSize.x - viewWidth) * 0.5);
					const viewY = Math.floor((clientSize.y - viewHeight) * 0.5);
					this.#targetResolutionScale = targetResolutionScale;
					this.#viewRect.position.set(viewX, viewY);
					this.#viewRect.size.set(viewWidth, viewHeight);
					break;
				}
			case ViewScaleMode.stretchAuto: {
					const targetResolutionScale = Math.min(clientSize.x / this.#referenceResolutionSize.x, clientSize.y / this.#referenceResolutionSize.y);
					const viewWidth = Math.round(this.#referenceResolutionSize.x * targetResolutionScale);
					const viewHeight = Math.round(this.#referenceResolutionSize.y * targetResolutionScale);
					const viewX = Math.floor((clientSize.x - viewWidth) * 0.5);
					const viewY = Math.floor((clientSize.y - viewHeight) * 0.5);
					this.#targetResolutionScale = targetResolutionScale;
					this.#viewRect.position.set(viewX, viewY);
					this.#viewRect.size.set(viewWidth, viewHeight);
					break;
				}
		}
	}

	//==============================================================================
	// 좌표계 적용.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @param { CanvasRenderingContext2D } canvasContext
	 * @param { number } scaleX
	 * @param { number } scaleY
	 * @param { number } skewX
	 * @param { number } skewY
	 * @param { number } translateX
	 * @param { number } translateY
	* 
	 */
	applyTransform(canvasContext, scaleX, scaleY, skewX, skewY, translateX, translateY){
		canvasContext.setTransform(scaleX, skewY, skewX, scaleY, translateX, translateY); // DOMMatrix2DInit
	}

	//==============================================================================
	// 화면 전체 영역 적용.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @param { CanvasRenderingContext2D } canvasContext
	 */
	applyCanvasRect(canvasContext) {
		const scaleX = 1; // a
		const scaleY = 1; // d
		const skewX = 0; // c
		const skewY = 0; // b
		const translateX = 0; // e
		const translateY = 0; // f
		// canvasContext.setTransform(1, 0, 0, 1, 0, 0); // 기본.
		this.applyTransform(canvasContext, scaleX, scaleY, skewX, skewY, translateX, translateY);
	}

	//==============================================================================
	// 실제 사용 영역 적용.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @param { CanvasRenderingContext2D } canvasContext
	 */
	applyViewRect(canvasContext) {
		const devicePixelRatio = this.#devicePixelRatio;
		const scaleX = this.#targetResolutionScale * devicePixelRatio;
		const scaleY = this.#targetResolutionScale * devicePixelRatio;
		const skewX = 0;
		const skewY = 0;
		const translateX = this.#viewRect.position.x * devicePixelRatio;
		const translateY = this.#viewRect.position.y * devicePixelRatio;
		this.applyTransform(canvasContext, scaleX, scaleY, skewX, skewY, translateX, translateY);
	}

	//==============================================================================
	// 대상 좌표가 사용 영역 안에 존재하는지 여부.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @param { Vector2 } worldPosition
	 * @returns { boolean }
	 */
	containsViewRect(worldPosition) {
		// return (
		// 	worldPosition.x >= this.viewRect.position.x &&
		// 	worldPosition.x <= this.viewRect.position.x + this.viewRect.size.x &&
		// 	worldPosition.y >= this.viewRect.position.y &&
		// 	worldPosition.y <= this.viewRect.position.y + this.viewRect.size.y
		// );
		return this.#viewRect.contains(worldPosition);
	}

	//==============================================================================
	// 뷰 스케일 모드 설정.
	//==============================================================================
	/**
	 * @param { ViewScaleMode } viewScaleMode
	 */
	setViewScaleMode(viewScaleMode) {
		if (this.#viewScaleMode === viewScaleMode) {
			return;
		}
		this.#viewScaleMode = viewScaleMode;
		this.calculateViewScale();
	}

	//==============================================================================
	// 뷰 스케일 모드 반환.
	//==============================================================================
	/**
	 * @returns { ViewScaleMode }
	 */
	getViewScaleMode() {
		return this.#viewScaleMode;
	}

	//==============================================================================
	// 기본 전체 화면 크기 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getClientSize() {
		return this.#clientSize;
	}

	//==============================================================================
	// 최종 전체 화면 크기 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getCanvasSize() {
		return this.#canvasSize;
	}

	//==============================================================================
	// 기준 화면 크기 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getReferenceResolutionSize() {
		return this.#referenceResolutionSize;
	}

	//==============================================================================
	// 실제 사용 화면 영역 반환.
	//==============================================================================
	/**
	 * @returns { Rect }
	 */
	getViewRect() {
		return this.#viewRect;
	}
}