//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Rect } from "../base/rect.js";
import { Engine } from "./engine.js";


//==============================================================================
// 뷰 매니저.
//==============================================================================
export class ViewManager extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @public @type { number } */ devicePixelRatio; // 장치의 화면 배율.
	/** @public @type { number } */ scale; // 크기 배율.
	/** @public @type { Vector2 } */ #clientSize; // 전체 화면 영역. (devicePixelRatio 반영 전)
	/** @public @type { Vector2 } */ #canvasSize; // 전체 화면 영역. (devicePixelRatio 반영 후)
	/** @public @type { Vector2 } */ #referenceResolutionSize; // 기준 화면 영역.
	/** @public @type { Rect } */ #viewRect; // 실제 사용 화면 영역.


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
		this.devicePixelRatio = 1;
		this.scale = 1;
		this.#clientSize = Vector2.zero();
		this.#canvasSize = Vector2.zero();
		this.#referenceResolutionSize = referenceResolutionSize;
		this.#viewRect = Rect.zero();
	}
	
	//==============================================================================
	// 갱신.
	//==============================================================================
	update() {
		// 캔버스 요소 설정.
		const devicePixelRatio = System.window.devicePixelRatio || 1;
		const clientSize = Vector2.create(System.window.innerWidth, System.window.innerHeight);
		const canvasSize = Vector2.create(Math.round(clientSize.x * devicePixelRatio), Math.round(clientSize.y * devicePixelRatio));
		this.devicePixelRatio = devicePixelRatio;
		this.#clientSize = clientSize;
		this.#canvasSize = canvasSize;

		// 뷰 영역 설정.
		const scale = Math.min(clientSize.x / this.#referenceResolutionSize.x, clientSize.y / this.#referenceResolutionSize.y);
		const viewWidth = Math.round(this.#referenceResolutionSize.x * scale);
		const viewHeight = Math.round(this.#referenceResolutionSize.y * scale);
		const viewX = Math.floor((clientSize.x - viewWidth) * 0.5);
		const viewY = Math.floor((clientSize.y - viewHeight) * 0.5);
		this.scale = scale;
		this.#viewRect.position.x = viewX;
		this.#viewRect.position.y = viewY;
		this.#viewRect.size.x = viewWidth;
		this.#viewRect.size.y = viewHeight;

	}

	//==============================================================================
	// 화면 전체 영역 좌표 적용.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @param { CanvasRenderingContext2D } canvasContext
	 */
	applyCanvasSize(canvasContext) {
		const scaleX = 1;
		const scaleY = 1;
		const skewX = 0;
		const skewY = 0;
		const translateX = 0;
		const translateY = 0;
		// canvasContext.setTransform(1, 0, 0, 1, 0, 0);
		canvasContext.setTransform(scaleX, skewY, skewX, scaleY, translateX, translateY); // DOMMatrix2DInit
	}

	//==============================================================================
	// 게임 영역 좌표 적용.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @param { CanvasRenderingContext2D } canvasContext
	 */
	applyViewRect(canvasContext) {
		const devicePixelRatio = this.devicePixelRatio;
		const scaleX = this.scale * devicePixelRatio;
		const scaleY = this.scale * devicePixelRatio;
		const skewX = 0;
		const skewY = 0;
		const translateX = this.#viewRect.position.x * devicePixelRatio;
		const translateY = this.#viewRect.position.y * devicePixelRatio;
		canvasContext.setTransform(scaleX, skewY, skewX, scaleY, translateX, translateY); // DOMMatrix2DInit
	}

	//==============================================================================
	// 대상 좌표가 클라이언트 영역 안에 존재하는지 여부.
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