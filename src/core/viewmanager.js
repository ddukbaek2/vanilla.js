//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Rect } from "../base/rect.js";
import { Engine } from "./engine.js";
// import { Enum } from "../misc/identifier.js";


//==============================================================================
// 뷰 스케일 모드.
//==============================================================================
export const ViewScaleMode = {
	referenceResolution: "referenceResolution", // Enum.begin(), // 기준 해상도를 사용하여 출력.
	canvasResolution: "canvasResolution", // Enum.auto(), // 화면 해상도를 사용하여 출력.
	stretchWidth: "stretchWidth", // Enum.auto(), // 기준 해상도의 가로축을 기준으로 양쪽 비율을 유지한채 화면에 해당 축을 늘여 붙임.
	stretchHeight: "stretchHeight", // Enum.auto(), // 기준 해상도의 세로축을 기준으로 양쪽 비율을 유지한채 화면에 해당 축을 늘여 붙임.
	stretchAuto: "stretchAuto", // Enum.auto(), // 기준 해상도에서 더 짧은쪽의 축을 기준으로 양쪽 비율을 유지한채 화면에 해당 축을 늘여 붙임.
};

//==============================================================================
// 뷰 매니저.
//==============================================================================
export class ViewManager extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { HTMLCanvasElement } */ #canvas; // 캔버스.
	/** @private @type { number } */ #devicePixelRatio; // 장치의 화면 배율.
	/** @private @type { number } */ #targetResolutionScale; // 기준 해상도와 화면 해상도 사이의 크기 배율.
	/** @private @type { Vector2 } */ #clientNativeSize; // 웹페이지 전체 영역.
	/** @private @type { Vector2 } */ #canvasNativeSize; // 캔버스의 전체 영역.
	/** @private @type { Vector2 } */ #canvasPixelSize; // 캔버스 영역 내부의 픽셀 렌더링 기준 전체 화면 영역.
	/** @private @type { ViewScaleMode } */ #viewScaleMode; // 스케일 모드.
	/** @private @type { Vector2 } */ #referenceResolutionSize; // 기준 화면 영역.
	/** @private @type { Vector2 } */ #screenSize; // 스케일 모드가 반영된 전체 화면 영역.	
	/** @private @type { Rect } */ #viewRect; // 스케일 모드가 반영된 실제 화면 영역.


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
		this.#canvas = null;
		this.#devicePixelRatio = 1;
		this.#targetResolutionScale = 1;
		this.#clientNativeSize = Vector2.zero();
		this.#canvasNativeSize = Vector2.zero();
		this.#canvasPixelSize = Vector2.zero();
		this.#viewScaleMode = ViewScaleMode.referenceResolution;
		this.#referenceResolutionSize = referenceResolutionSize;
		this.#screenSize = Vector2.zero();
		this.#viewRect = Rect.zero();

		// 이시점에서 호출하면 캔버스가 없음.
		// this.calculateViewRect();
	}
	
	//==============================================================================
	// 뷰 영역 계산.
	//==============================================================================
	calculateViewRect() {
		// 캔버스 크기 설정.
		const canvas = this.getCanvas();
		const devicePixelRatio = System.window.devicePixelRatio || 1;
		const clientNativeSize = Vector2.create(System.window.innerWidth, System.window.innerHeight);

		// 이슈: 실제 브라우저 리사이즈 후 바로 캔버스 크기를 가져왔을 때 실제 크기와 달라 오차가 발생되는 경우가 존재. (임시 방편으로 화면 전체 사이즈로 강제 처리)
		// const canvasNativeRect = canvas.getBoundingClientRect();
		// const canvasNativeSize = Vector2.create(Math.round(canvasNativeRect.width), Math.round(canvasNativeRect.height));
		const canvasNativeSize = Vector2.create(clientNativeSize.x, clientNativeSize.y);
		const canvasPixelSize = Vector2.create(Math.round(canvasNativeSize.x * devicePixelRatio), Math.round(canvasNativeSize.y * devicePixelRatio));
		this.#devicePixelRatio = devicePixelRatio;
		this.#clientNativeSize = clientNativeSize;
		this.#canvasNativeSize = canvasNativeSize;
		this.#canvasPixelSize = canvasPixelSize;
	
		// 캔버스 렌더링 사이즈 조정.
		this.#canvas.width = canvasPixelSize.x; 
		this.#canvas.height = canvasPixelSize.y;
		this.#canvas.style.width = `${clientNativeSize.x}px`;
		this.#canvas.style.height = `${clientNativeSize.y}px`;

		// 뷰 영역 설정.
		switch (this.#viewScaleMode) {
			case ViewScaleMode.referenceResolution: {
					const targetResolutionScale = 1.0; // 늘이지 않음.
					const viewWidth = Math.round(this.#referenceResolutionSize.x * targetResolutionScale);
					const viewHeight = Math.round(this.#referenceResolutionSize.y * targetResolutionScale);
					const viewX = Math.floor((canvasNativeSize.x - viewWidth) * 0.5);
					const viewY = Math.floor((canvasNativeSize.y - viewHeight) * 0.5);
					this.#targetResolutionScale = targetResolutionScale;
					this.#screenSize = this.#canvasNativeSize.divide(targetResolutionScale);
					this.#screenSize.x = Math.round(this.#screenSize.x);
					this.#screenSize.y = Math.round(this.#screenSize.y);
					this.#viewRect.position.set(viewX, viewY);
					this.#viewRect.size.set(viewWidth, viewHeight);
					break;
				}
			case ViewScaleMode.canvasResolution: {
					const targetResolutionScale = 1.0; // 늘이지 않음.
					const viewX = 0; // Math.floor(clientSize.x * 0.5);
					const viewY = 0; // Math.floor(clientSize.y * 0.5);
					const viewWidth = Math.round(canvasNativeSize.x * targetResolutionScale);
					const viewHeight = Math.round(canvasNativeSize.y * targetResolutionScale);
					this.#targetResolutionScale = targetResolutionScale;
					this.#screenSize = this.#canvasNativeSize.divide(targetResolutionScale);
					this.#screenSize.x = Math.round(this.#screenSize.x);
					this.#screenSize.y = Math.round(this.#screenSize.y);
					this.#viewRect.position.set(viewX, viewY);
					this.#viewRect.size.set(viewWidth, viewHeight);
					break;
				}
			case ViewScaleMode.stretchWidth: {
					const targetResolutionScale = canvasNativeSize.x / this.#referenceResolutionSize.x;
					const viewWidth = Math.round(this.#referenceResolutionSize.x * targetResolutionScale);
					const viewHeight = Math.round(this.#referenceResolutionSize.y * targetResolutionScale);
					const viewX = Math.floor((canvasNativeSize.x - viewWidth) * 0.5);
					const viewY = Math.floor((canvasNativeSize.y - viewHeight) * 0.5);
					this.#targetResolutionScale = targetResolutionScale;
					this.#screenSize = this.#canvasNativeSize.divide(targetResolutionScale);
					this.#screenSize.x = Math.round(this.#screenSize.x);
					this.#screenSize.y = Math.round(this.#screenSize.y);
					this.#viewRect.position.set(viewX, viewY);
					this.#viewRect.size.set(viewWidth, viewHeight);
					break;
				}
			case ViewScaleMode.stretchHeight: {
					const targetResolutionScale = canvasNativeSize.y / this.#referenceResolutionSize.y;
					const viewWidth = Math.round(this.#referenceResolutionSize.x * targetResolutionScale);
					const viewHeight = Math.round(this.#referenceResolutionSize.y * targetResolutionScale);
					const viewX = Math.floor((canvasNativeSize.x - viewWidth) * 0.5);
					const viewY = Math.floor((canvasNativeSize.y - viewHeight) * 0.5);
					this.#targetResolutionScale = targetResolutionScale;
					this.#screenSize = this.#canvasNativeSize.divide(targetResolutionScale);
					this.#screenSize.x = Math.round(this.#screenSize.x);
					this.#screenSize.y = Math.round(this.#screenSize.y);
					this.#viewRect.position.set(viewX, viewY);
					this.#viewRect.size.set(viewWidth, viewHeight);
					break;
				}
			case ViewScaleMode.stretchAuto: {
					const targetResolutionScale = Math.min(canvasNativeSize.x / this.#referenceResolutionSize.x, canvasNativeSize.y / this.#referenceResolutionSize.y);
					const viewWidth = Math.round(this.#referenceResolutionSize.x * targetResolutionScale);
					const viewHeight = Math.round(this.#referenceResolutionSize.y * targetResolutionScale);
					const viewX = Math.floor((canvasNativeSize.x - viewWidth) * 0.5);
					const viewY = Math.floor((canvasNativeSize.y - viewHeight) * 0.5);
					this.#targetResolutionScale = targetResolutionScale;
					this.#screenSize = this.#canvasNativeSize.divide(targetResolutionScale);
					this.#screenSize.x = Math.round(this.#screenSize.x);
					this.#screenSize.y = Math.round(this.#screenSize.y);
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
	applyCanvasPixelRect(canvasContext) {
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
	// 캔버스 설정.
	//==============================================================================
	/**
	 * @param { HTMLCanvasElement } canvas 
	 */
	setCanvas(canvas) {
		this.#canvas = canvas;
	}

	//==============================================================================
	// 캔버스 반환.
	//==============================================================================
	/**
	 * @returns { HTMLCanvasElement }
	 */
	getCanvas() {
		return this.#canvas;
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
		this.calculateViewRect();
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
	// 웹페이지의 전체 크기 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } clientNativeSize
	 */
	setClientNativeSize(clientNativeSize) {
		this.#clientNativeSize = clientNativeSize;
	}

	//==============================================================================
	// 웹페이지의 전체 크기 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getClientNativeSize() {
		return this.#clientNativeSize;
	}

	//==============================================================================
	// 캔버스의 요소 크기 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } canvasNativeSize
	 */
	setCanvasNativeSize(canvasNativeSize) {
		this.#canvasNativeSize = canvasNativeSize;
	}

	//==============================================================================
	// 캔버스의 요소 크기 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getCanvasNativeSize() {
		return this.#canvasNativeSize;
	}

	//==============================================================================
	// 캔버스의 픽셀 렌더링용 화면 크기 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getCanvasPixelSize() {
		return this.#canvasPixelSize;
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
	// 화면 전체 영역 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getScreenSize() {
		return this.#screenSize;
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

	//==============================================================================
	// 배율 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getTargetResolutionScale() {
		return this.#targetResolutionScale;
	}

	//==============================================================================
	// 클라이언트 좌표를 뷰 좌표로 변환.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @param { Vector2 } clientPoint
	 * @returns { Vector2 }
	 */
	transformToViewPoint(clientPoint) {
		const relativeX = clientPoint.x - this.#viewRect.position.x;
		const relativeY = clientPoint.y - this.#viewRect.position.y;

		const scale = this.#targetResolutionScale;
		if (scale === 0) {
			return Vector2.zero();
		}

		const viewX = relativeX / scale;
		const viewY = relativeY / scale;

		return Vector2.create(viewX, viewY);
	}
}