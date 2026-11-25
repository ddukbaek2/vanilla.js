//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Rect } from "../base/rect.js";
import { Engine } from "./engine.js";
import { Graphic } from "./graphic.js";


//==============================================================================
// 뷰 스케일 모드.
//==============================================================================
export const ViewScaleMode = {
	// 사용안함 (웹브라우저 크기가 변경되면 뷰 영역도 변경됨)
	none: "none",

	 // 기준해상도로 뷰 영역 정의 (양쪽 축이 잘리거나 남을 수 있음)
	referenceResolution: "referenceResolution",

	// 기준해상도로 뷰 영역 정의 + 뷰의 비율을 유지한채 가로축으로 늘여붙임. (반대 축은 잘리거나 남을 수 있음)
	stretchWidth: "stretchWidth",

	// 기준해상도로 뷰 영역 정의 + 뷰의 비율을 유지한채 세로축으로 늘여붙임. (반대 축은 잘리거나 남을 수 있음)
	stretchHeight: "stretchHeight",

	 // 기준해상도로 뷰 영역 정의 + 뷰의 비율을 유지한채 가로세로 중에서 짧은 축으로 늘여붙임. (반대 축은 남을 수 있음)
	stretchShort: "stretchShort",

	// 가로를 화면 전체에 늘여붙임 (기준해상도 가로 = 항상 고정). 세로는 화면 비율에 따라 자동 산출. 양쪽 여백 없음. (대신 세로 해상도는 디스플레이에 따라 바뀜)
	stretchWidthExpandHeight: "stretchWidthExpandHeight",

	// 세로를 화면 전체에 늘여붙임 (기준해상도 세로 = 항상 고정). 가로는 화면 비율에 따라 자동 산출. 양쪽 여백 없음. (대신 가로 해상도는 디스플레이에 따라 바뀜)
	stretchHeightExpandWidth: "stretchHeightExpandWidth",

	// 짧은 축 기준 스케일. 긴 축도 화면 전체에 늘여붙임. 양쪽 여백 없음. (대신 긴 축 해상도는 디스플레이에 따라 바뀜)
	stretchShortExpandLong: "stretchShortExpandLong",
};


//==============================================================================
// 뷰 매니저.
// - clientNativeSize:	웹브라우저 전체 해상도 크기. (0,0 ~ canvasNativeSize.x, )
// - canvasNativeSize:	현재 렌더링되는 캔버스 요소의 해상도 크기. (웹브라우저 기준)
// - canvasPixelSize:	캔버스 요소 내부의 실제 렌더링 픽셀 해상도 크기. (캔버스의 크기 * 장치화면배율)
// - viewNativeRect:	실제 사용되는 뷰 영역. (클라이언트 영역 기준의 부분 영역)
// - viewSize:			실제 사용되는 뷰 크기. 
//==============================================================================
/**
 * @example <caption>뷰 스케일 모드를 정하고 좌표 바꾸기</caption>
 * import { Engine, EngineConfiguration, Scene, Vector2, ViewScaleMode } from "./build/vanilla.js";
 *
 * const engineConfiguration = new EngineConfiguration();
 * engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
 * engineConfiguration.autoResizeOnWindowResize = true;
 * const engine = new Engine(engineConfiguration);
 * const viewManager = engine.getViewManager();
 * viewManager.setViewScaleMode(ViewScaleMode.stretchShort);
 * engine.run(new Scene());
 * const viewSize = viewManager.getViewSize();
 * const viewNativeRect = viewManager.getViewNativeRect();
 * console.log(viewSize.x, viewSize.y, viewNativeRect.size.x, viewNativeRect.size.y);
 * const viewPosition = viewManager.convertClientToView(100, 100);
 * console.log(viewPosition.x, viewPosition.y);
 */
export class ViewManager extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { HTMLCanvasElement } */ #canvas; // 캔버스.
	/** @private @type { number } */ #devicePixelRatio; // 장치의 화면 배율.
	/** @private @type { number } */ #targetResolutionScale; // 기준 해상도와 화면 해상도 사이의 크기 배율.
	/** @private @type { number } */ #maxRenderPixelRatio; // 렌더에 쓸 devicePixelRatio 상한. (0 이면 제한 없음)
	/** @private @type { object | null } */ #safeAreaOverride; // 세이프에어리어 강제값. (CSS px)
	/** @private @type { HTMLElement | null } */ #safeAreaProbeElement; // env() 측정용 숨은 요소.
	/** @private @type { string[] } */ #ignoredSafeAreaSides; // 무시할 세이프에어리어 쪽. ("top", "right", "bottom", "left")
	/** @private @type { Vector2 } */ #clientNativeSize; // 웹페이지 전체 영역.
	/** @private @type { Vector2 } */ #canvasNativeSize; // 캔버스의 전체 영역. (기본 좌표계 기준)
	/** @private @type { Vector2 } */ #canvasPixelSize; // 캔버스 영역 내부의 픽셀 렌더링 기준 전체 화면 영역.

	/** @private @type { ViewScaleMode } */ #viewScaleMode; // 스케일 모드.
	/** @private @type { Vector2 } */ #referenceResolutionSize; // 기준 화면 크기.
	// /** @private @type { Vector2 } */ #screenSize; // 스케일 모드가 반영된 전체 화면 영역.	
	/** @private @type { Rect } */ #viewNativeRect; // 스케일 모드가 반영된 실제 화면 영역. (canvasNativeSize 내부의 실제 사각영역)
	/** @private @type { Vector2 } */ #viewSize; // 실제 사용 화면 크기.


	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { Engine } engine 기준 해상도를 읽을 엔진. (엔진 설정의 referenceResolutionSize)
	 */
	constructor(engine) {
		super();
		this.#canvas = null;
		this.#devicePixelRatio = 1.0;
		this.#targetResolutionScale = 1.0;
		this.#maxRenderPixelRatio = 0;
		this.#safeAreaOverride = null;
		this.#safeAreaProbeElement = null;
		this.#ignoredSafeAreaSides = [];
		this.#clientNativeSize = Vector2.zero();
		this.#canvasNativeSize = Vector2.zero();
		this.#canvasPixelSize = Vector2.zero();
		this.#viewScaleMode = ViewScaleMode.none;
		// this.#screenSize = Vector2.zero();
		this.#viewNativeRect = Rect.zero();
		this.#viewSize = Vector2.zero();

		// 설정: 기준 해상도.
		const engineConfiguration = engine.getEngineConfiguration();
		this.#referenceResolutionSize = engineConfiguration.referenceResolutionSize;

		// 이시점에서 호출하면 캔버스가 없음.
		// this.calculateViewRect();
	}
	
	//==============================================================================
	// 뷰 영역 계산.
	//==============================================================================
	calculateViewRect() {
		const canvas = this.getCanvas();
		if (canvas === null || canvas === undefined) {
			return;
		}
		let devicePixelRatio = System.window.devicePixelRatio || 1;
		if (this.#maxRenderPixelRatio > 0 && devicePixelRatio > this.#maxRenderPixelRatio) {
			devicePixelRatio = this.#maxRenderPixelRatio;
		}
		const clientNativeSize = Vector2.create(System.window.innerWidth, System.window.innerHeight);
		const canvasNativeRect = canvas.getBoundingClientRect();
		const canvasNativeSize = Vector2.create(Math.round(canvasNativeRect.width), Math.round(canvasNativeRect.height));
		const canvasPixelSize = Vector2.create(Math.round(canvasNativeSize.x * devicePixelRatio), Math.round(canvasNativeSize.y * devicePixelRatio));
		const referenceResolutionSize = this.getReferenceResolutionSize();
		this.#devicePixelRatio = devicePixelRatio;
		this.#clientNativeSize = clientNativeSize;
		this.#canvasNativeSize = canvasNativeSize;
		this.#canvasPixelSize = canvasPixelSize;
	
		// 캔버스 렌더링 사이즈 조정.
		this.#canvas.width = canvasPixelSize.x; 
		this.#canvas.height = canvasPixelSize.y;

		// 뷰 영역 설정.
		const viewScaleMode = this.getViewScaleMode();
		switch (viewScaleMode) {
			case ViewScaleMode.none: {
					const targetResolutionScale = 1.0; // 늘이지 않음.
					const viewX = 0;
					const viewY = 0;
					const viewWidth = Math.round(canvasNativeSize.x * targetResolutionScale);
					const viewHeight = Math.round(canvasNativeSize.y * targetResolutionScale);
					this.#targetResolutionScale = targetResolutionScale;
					// this.#screenSize = this.#canvasNativeSize.divide(targetResolutionScale);
					// this.#screenSize.x = Math.round(this.#screenSize.x);
					// this.#screenSize.y = Math.round(this.#screenSize.y);
					this.#viewNativeRect.position.set(viewX, viewY);
					this.#viewNativeRect.size.set(viewWidth, viewHeight);
					this.#viewSize.set(canvasNativeSize.x, canvasNativeSize.y);
					break;
				}
			case ViewScaleMode.referenceResolution: {
					const targetResolutionScale = 1.0; // 늘이지 않음.
					const viewWidth = Math.round(referenceResolutionSize.x * targetResolutionScale);
					const viewHeight = Math.round(referenceResolutionSize.y * targetResolutionScale);
					const viewX = Math.floor((canvasNativeSize.x - viewWidth) * 0.5);
					const viewY = Math.floor((canvasNativeSize.y - viewHeight) * 0.5);
					this.#targetResolutionScale = targetResolutionScale;
					// this.#screenSize = this.#canvasNativeSize.divide(targetResolutionScale);
					// this.#screenSize.x = Math.round(this.#screenSize.x);
					// this.#screenSize.y = Math.round(this.#screenSize.y);
					this.#viewNativeRect.position.set(viewX, viewY);
					this.#viewNativeRect.size.set(viewWidth, viewHeight);
					this.#viewSize.set(referenceResolutionSize.x, referenceResolutionSize.y);
					break;
				}
			case ViewScaleMode.stretchWidth: {
					const targetResolutionScale = canvasNativeSize.x / referenceResolutionSize.x;
					const viewWidth = Math.round(canvasNativeSize.x);
					const viewHeight = Math.round(referenceResolutionSize.y * targetResolutionScale);
					const viewX = 0;
					const viewY = Math.round((canvasNativeSize.y - viewHeight) * 0.5);
					this.#targetResolutionScale = targetResolutionScale;
					// this.#screenSize = this.#canvasNativeSize.divide(targetResolutionScale);
					// this.#screenSize.x = Math.round(this.#screenSize.x);
					// this.#screenSize.y = Math.round(this.#screenSize.y);
					this.#viewNativeRect.position.set(viewX, viewY);
					this.#viewNativeRect.size.set(viewWidth, viewHeight);
					this.#viewSize.set(referenceResolutionSize.x, referenceResolutionSize.y);
					break;
				}
			case ViewScaleMode.stretchHeight: {
					const targetResolutionScale = canvasNativeSize.y / referenceResolutionSize.y;
					const viewWidth = Math.round(referenceResolutionSize.x * targetResolutionScale);
					const viewHeight = Math.round(canvasNativeSize.y);
					const viewX = Math.round((canvasNativeSize.x - viewWidth) * 0.5);
					const viewY = 0;
					this.#targetResolutionScale = targetResolutionScale;
					// this.#screenSize = this.#canvasNativeSize.divide(targetResolutionScale);
					// this.#screenSize.x = Math.round(this.#screenSize.x);
					// this.#screenSize.y = Math.round(this.#screenSize.y);
					this.#viewNativeRect.position.set(viewX, viewY);
					this.#viewNativeRect.size.set(viewWidth, viewHeight);
					this.#viewSize.set(referenceResolutionSize.x, referenceResolutionSize.y);
					break;
				}
			case ViewScaleMode.stretchShort: {
					const targetResolutionScale = Math.min(canvasNativeSize.x / referenceResolutionSize.x, canvasNativeSize.y / referenceResolutionSize.y);
					const viewWidth = Math.round(referenceResolutionSize.x * targetResolutionScale);
					const viewHeight = Math.round(referenceResolutionSize.y * targetResolutionScale);
					const viewX = Math.round((canvasNativeSize.x - viewWidth) * 0.5);
					const viewY = Math.round((canvasNativeSize.y - viewHeight) * 0.5);
					this.#targetResolutionScale = targetResolutionScale;
					// this.#screenSize = this.#canvasNativeSize.divide(targetResolutionScale);
					// this.#screenSize.x = Math.round(this.#screenSize.x);
					// this.#screenSize.y = Math.round(this.#screenSize.y);
					this.#viewNativeRect.position.set(viewX, viewY);
					this.#viewNativeRect.size.set(viewWidth, viewHeight);
					this.#viewSize.set(referenceResolutionSize.x, referenceResolutionSize.y);
					break;
				}
			case ViewScaleMode.stretchWidthExpandHeight: {
					// 가로 스케일을 기준으로 고정, 세로는 화면 비율에 따라 자동 산출. 여백 없음.
					const targetResolutionScale = canvasNativeSize.x / referenceResolutionSize.x;
					const viewWidth = Math.round(canvasNativeSize.x);
					const viewHeight = Math.round(canvasNativeSize.y);
					const viewX = 0;
					const viewY = 0;
					this.#targetResolutionScale = targetResolutionScale;
					// this.#screenSize = this.#canvasNativeSize.divide(targetResolutionScale);
					// this.#screenSize.x = Math.round(this.#screenSize.x);
					// this.#screenSize.y = Math.round(this.#screenSize.y);
					this.#viewNativeRect.position.set(viewX, viewY);
					this.#viewNativeRect.size.set(viewWidth, viewHeight);
					const viewSizeX = Math.ceil(this.#viewNativeRect.size.x / targetResolutionScale);
					const viewSizeY = Math.ceil(this.#viewNativeRect.size.y / targetResolutionScale);
					this.#viewSize.set(viewSizeX, viewSizeY);
					break;
				}
			case ViewScaleMode.stretchHeightExpandWidth: {
					// 세로 스케일을 기준으로 고정, 가로는 화면 비율에 따라 자동 산출. 여백 없음.
					const targetResolutionScale = canvasNativeSize.y / referenceResolutionSize.y;
					const viewWidth = Math.round(canvasNativeSize.x);
					const viewHeight = Math.round(canvasNativeSize.y);
					const viewX = 0;
					const viewY = 0;
					this.#targetResolutionScale = targetResolutionScale;
					// this.#screenSize = this.#canvasNativeSize.divide(targetResolutionScale);
					// this.#screenSize.x = Math.round(this.#screenSize.x);
					// this.#screenSize.y = Math.round(this.#screenSize.y);
					this.#viewNativeRect.position.set(viewX, viewY);
					this.#viewNativeRect.size.set(viewWidth, viewHeight);
					const viewSizeX = Math.ceil(this.#viewNativeRect.size.x / targetResolutionScale);
					const viewSizeY = Math.ceil(this.#viewNativeRect.size.y / targetResolutionScale);
					this.#viewSize.set(viewSizeX, viewSizeY);
					break;
				}
			case ViewScaleMode.stretchShortExpandLong: {
					// 짧은 축 스케일을 기준으로 고정, 긴 축도 화면 전체에 늘여붙임. 여백 없음.
					const targetResolutionScale = Math.min(canvasNativeSize.x / referenceResolutionSize.x, canvasNativeSize.y / referenceResolutionSize.y);
					const viewWidth = Math.round(canvasNativeSize.x);
					const viewHeight = Math.round(canvasNativeSize.y);
					const viewX = 0;
					const viewY = 0;
					this.#targetResolutionScale = targetResolutionScale;
					// this.#screenSize = this.#canvasNativeSize.divide(targetResolutionScale);
					// this.#screenSize.x = Math.round(this.#screenSize.x);
					// this.#screenSize.y = Math.round(this.#screenSize.y);
					this.#viewNativeRect.position.set(viewX, viewY);
					this.#viewNativeRect.size.set(viewWidth, viewHeight);
					const viewSizeX = Math.ceil(this.#viewNativeRect.size.x / targetResolutionScale);
					const viewSizeY = Math.ceil(this.#viewNativeRect.size.y / targetResolutionScale);
					this.#viewSize.set(viewSizeX, viewSizeY);
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
	 * @param { Graphic } graphic 변환을 걸 그래픽.
	 * @param { number } scaleX 가로 배율. (a)
	 * @param { number } scaleY 세로 배율. (d)
	 * @param { number } skewX 가로 기울임. (c)
	 * @param { number } skewY 세로 기울임. (b)
	 * @param { number } translateX 가로 이동. (e, 캔버스 픽셀)
	 * @param { number } translateY 세로 이동. (f, 캔버스 픽셀)
	*
	 */
	applyTransform(graphic, scaleX, scaleY, skewX, skewY, translateX, translateY){
		graphic.setTransform(scaleX, skewY, skewX, scaleY, translateX, translateY); // DOMMatrix2DInit
	}

	//==============================================================================
	// 화면 전체 영역 적용.
	// - ViewScaleMode.none 이 아닐 경우 출력 전 해당 화면 해상도를 처리하기 위한 초기화.
	// - getCanvasNativeSize()
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @param { Graphic } graphic 변환을 걸 그래픽.
	 */
	applyCanvasNativeRect(graphic) {
		const devicePixelRatio = this.getDevicePixelRatio();
		const scaleX = 1 * devicePixelRatio; // a
		const scaleY = 1 * devicePixelRatio; // d
		const skewX = 0; // c
		const skewY = 0; // b
		const translateX = 0; // e
		const translateY = 0; // f
		// graphic.setTransform(1, 0, 0, 1, 0, 0); // 기본.
		this.applyTransform(graphic, scaleX, scaleY, skewX, skewY, translateX, translateY);
	}

	//==============================================================================
	// 뷰 영역 적용.
	// - ViewScaleMode.none 이 아닐 경우 출력 전 해당 화면 해상도를 처리하기 위한 초기화.
	// - ViewScaleMode.none은 getCanvasNativeSize()를 사용하고 그 외의 모드에서는 getReferenceResolutionSize()를 사용한다.
	// - getViewSize()를 사용하면 모드를 구분하지 않아도 자동으로 항상 모드에 적합한 뷰포트 해상도를 얻을 수 있다.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @param { Graphic } graphic 변환을 걸 그래픽.
	 */
	applyViewRect(graphic) {
		const devicePixelRatio = this.getDevicePixelRatio();
		const targetResolutionScale = this.getTargetResolutionScale();
		const viewNativeRect = this.getViewNativeRect();
		const scaleX = targetResolutionScale * devicePixelRatio;
		const scaleY = targetResolutionScale * devicePixelRatio;
		const skewX = 0;
		const skewY = 0;
		const translateX = viewNativeRect.position.x * devicePixelRatio;
		const translateY = viewNativeRect.position.y * devicePixelRatio;
		this.applyTransform(graphic, scaleX, scaleY, skewX, skewY, translateX, translateY);
	}

	//==============================================================================
	// 기준 해상도 크기 재설정.
	//==============================================================================
	/**
	 * @param { Vector2 } referenceResolutionSize 새 기준 해상도.
	 */
	applyReferenceResolutionSize(referenceResolutionSize) {
		this.#referenceResolutionSize = referenceResolutionSize;
		this.calculateViewRect();
	}

	//==============================================================================
	// 캔버스 설정.
	//==============================================================================
	/**
	 * @param { HTMLCanvasElement } canvas 엔진이 그리는 캔버스.
	 */
	setCanvas(canvas) {
		this.#canvas = canvas;
	}

	//==============================================================================
	// 캔버스 반환.
	//==============================================================================
	/**
	 * @returns { HTMLCanvasElement } 엔진이 그리는 캔버스.
	 */
	getCanvas() {
		return this.#canvas;
	}

	//==============================================================================
	// 디바이스의 실제 픽셀 개수 비율을 반환.
	//==============================================================================
	/**
	 * @returns { number } 렌더에 쓰는 장치 화면 배율. (상한을 걸었으면 그 값까지)
	 */
	getDevicePixelRatio() {
		return this.#devicePixelRatio;
	}

	//==============================================================================
	// 뷰 스케일 모드 설정.
	//==============================================================================
	/**
	 * @param { ViewScaleMode } viewScaleMode ViewScaleMode 의 값. (같으면 아무것도 하지 않고, 바뀌면 뷰 영역을 다시 셈한다)
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
	 * @returns { ViewScaleMode } ViewScaleMode 의 값.
	 */
	getViewScaleMode() {
		return this.#viewScaleMode;
	}

	//==============================================================================
	// 웹페이지의 전체 크기 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 창의 안쪽 크기. (CSS 픽셀, innerWidth, innerHeight)
	 */
	getClientNativeSize() {
		return this.#clientNativeSize;
	}

	//==============================================================================
	// 캔버스의 요소 크기 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 캔버스 요소의 크기. (CSS 픽셀, 반올림)
	 */
	getCanvasNativeSize() {
		return this.#canvasNativeSize;
	}

	//==============================================================================
	// 캔버스의 픽셀 렌더링용 화면 크기 반환. (실제 캔버스 내부 해상도. 엔진, 컨텐츠 로직에서는 사용할 필요 없음)
	//==============================================================================
	/**
	 * @returns { Vector2 } 캔버스의 렌더 픽셀 크기. (CSS 크기 x 장치 화면 배율)
	 */
	getCanvasPixelSize() {
		return this.#canvasPixelSize;
	}
	
	//==============================================================================
	// 기준 해상도 크기 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 기준 해상도.
	 */
	getReferenceResolutionSize() {
		return this.#referenceResolutionSize;
	}

	//==============================================================================
	// 실제 사용 해상도 크기 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 뷰 크기. (뷰 좌표, 뷰 스케일 모드에 따라 정해진다)
	 */
	getViewSize() {
		return this.#viewSize;
	}

	//==============================================================================
	// 뷰 한 단위가 화면에서 몇 CSS 픽셀인지 반환. (캔버스의 CSS 높이 / 뷰 높이, 못 재면 1)
	// - 뷰의 고정된 쪽은 늘 같은 길이라, 작은 화면(포털의 PC iframe 등)에서는 한 단위가 1 CSS 픽셀보다 한참 작아져 글자가 읽히지 않는다.
	//   UI 층만 키울 배율을 셈할 때 쓴다. (예: 최소 CSS 배율 / 이 값)
	//==============================================================================
	/**
	 * @returns { number } 뷰 한 단위의 CSS 픽셀 수. (못 재면 1)
	 */
	getCssPixelScale() {
		const canvas = this.getCanvas();
		const viewSize = this.getViewSize();
		if (!canvas) {
			return 1;
		}
		const canvasHeight = canvas.clientHeight;
		return viewSize.y > 0 && canvasHeight > 0 ? canvasHeight / viewSize.y : 1;
	}

	// //==============================================================================
	// // 화면 전체 영역 반환.
	// //==============================================================================
	// /**
	//  * @returns { Vector2 }
	//  */
	// getScreenSize() {
	// 	return this.#screenSize;
	// }

	//==============================================================================
	// 캔버스 안에서 뷰가 존재하는 실제 영역 반환. (값은 canvasNativeSize 기준)
	//==============================================================================
	/**
	 * @returns { Rect } 캔버스 안의 뷰 영역. (CSS 픽셀, 캔버스 왼쪽 위가 원점)
	 */
	getViewNativeRect() {
		return this.#viewNativeRect;
	}

	//==============================================================================
	// 배율 반환.
	//==============================================================================
	/**
	 * @returns { number } 기준 해상도에서 캔버스로 늘인 배율. (none, referenceResolution 은 1)
	 */
	getTargetResolutionScale() {
		return this.#targetResolutionScale;
	}

	//==============================================================================
	// 캔버스 좌표를 뷰 좌표로 변환.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @param { Vector2 } canvasPosition 캔버스 좌표. (캔버스 왼쪽 위가 원점, CSS 픽셀)
	 * @returns { Vector2 } 뷰 좌표. (반올림한 정수, 배율이 0 이면 (0, 0))
	 */
	canvasPositionToViewPosition(canvasPosition) {
		const devicePixelRatio = this.getDevicePixelRatio();
		const targetResolutionScale = this.getTargetResolutionScale();
		const totalScale = targetResolutionScale * devicePixelRatio;
		if (totalScale === 0) {
			return Vector2.zero();
		}

		const viewNativeRect = this.getViewNativeRect();
		const viewX = Math.round((canvasPosition.x * devicePixelRatio - viewNativeRect.position.x * devicePixelRatio) / totalScale);
		const viewY = Math.round((canvasPosition.y * devicePixelRatio - viewNativeRect.position.y * devicePixelRatio) / totalScale);
		return Vector2.create(viewX, viewY);
	}

	//==============================================================================
	// 화면(client) 좌표를 뷰 좌표로. (DOM 사건의 clientX, clientY 를 캔버스의 지금 자리로 빼서 canvasPositionToViewPosition 으로 바꾼다)
	//==============================================================================
	/**
	 * @param { number } clientX 클라이언트 X 좌표. (CSS 픽셀, clientX)
	 * @param { number } clientY 클라이언트 Y 좌표. (CSS 픽셀, clientY)
	 * @returns { Vector2 } 뷰 좌표. (반올림한 정수, 배율이 0 이면 (0, 0))
	 */
	convertClientToView(clientX, clientY) {
		const canvas = this.getCanvas();
		const canvasRect = canvas.getBoundingClientRect();
		const canvasPosition = Vector2.create(clientX - canvasRect.left, clientY - canvasRect.top);
		return this.canvasPositionToViewPosition(canvasPosition);
	}

	//==============================================================================
	// 렌더 배율 상한 설정.
	// - 고DPI 기기에서 캔버스가 과대해지는 것을 막는다. 0 이면 제한하지 않는다.
	//==============================================================================
	/**
	 * @param { number } maxRenderPixelRatio 렌더 배율 상한. (0 이면 제한하지 않고, 음수는 0)
	 */
	setMaxRenderPixelRatio(maxRenderPixelRatio) {
		this.#maxRenderPixelRatio = Math.max(0, maxRenderPixelRatio);
		this.calculateViewRect();
	}

	//==============================================================================
	// 렌더 배율 상한 반환.
	//==============================================================================
	/**
	 * @returns { number } 렌더 배율 상한. (0 이면 제한 없음)
	 */
	getMaxRenderPixelRatio() {
		return this.#maxRenderPixelRatio;
	}

	//==============================================================================
	// 종횡비에 맞는 뷰 스케일 모드 자동 선택.
	// - 화면이 기준 해상도보다 세로로 길면 가로를 고정하고 세로를 늘리고,
	//   가로로 길면 세로를 고정하고 가로를 늘린다. (여러 게임이 복붙하던 로직)
	//==============================================================================
	applyAspectViewScaleMode() {
		const referenceResolutionSize = this.getReferenceResolutionSize();
		const canvas = this.getCanvas();
		let screenWidth = System.window.innerWidth;
		let screenHeight = System.window.innerHeight;
		if (canvas) {
			const canvasNativeRect = canvas.getBoundingClientRect();
			if (canvasNativeRect.width > 0 && canvasNativeRect.height > 0) {
				screenWidth = canvasNativeRect.width;
				screenHeight = canvasNativeRect.height;
			}
		}
		const screenAspect = screenWidth / screenHeight;
		const referenceAspect = referenceResolutionSize.x / referenceResolutionSize.y;
		if (screenAspect < referenceAspect) {
			this.setViewScaleMode(ViewScaleMode.stretchWidthExpandHeight);
		}
		else {
			this.setViewScaleMode(ViewScaleMode.stretchHeightExpandWidth);
		}
	}

	//==============================================================================
	// 세이프에어리어 강제값 설정. (CSS px, 데스크톱에서 노치를 흉내 낼 때)
	//==============================================================================
	/**
	 * @param { object | null } insets { top, right, bottom, left }
	 */
	setSafeAreaOverride(insets) {
		this.#safeAreaOverride = insets;
	}

	//==============================================================================
	// 세이프에어리어 인셋 반환. (뷰 좌표)
	// - env(safe-area-inset-*) 를 숨은 요소의 padding 으로 실측해 뷰 좌표로 환산한다.
	// - 우선순위: setSafeAreaOverride() > URL ?safeArea=top,right,bottom,left > env() 실측.
	//==============================================================================
	/**
	 * @returns { object } { top, right, bottom, left }
	 * @example <caption>세이프에어리어를 흉내 내고 뷰 좌표로 읽기</caption>
	 * import { Engine, EngineConfiguration, Vector2, ViewScaleMode } from "./build/vanilla.js";
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
	 * const engine = new Engine(engineConfiguration);
	 * const viewManager = engine.getViewManager();
	 * viewManager.setViewScaleMode(ViewScaleMode.stretchShortExpandLong);
	 * viewManager.setSafeAreaOverride({ top: 44, right: 0, bottom: 34, left: 0 });
	 * viewManager.setIgnoredSafeAreaSides(["bottom"]);
	 * const insets = viewManager.getSafeAreaInsets();
	 * console.log(insets.top, insets.right, insets.bottom, insets.left);
	 */
	getSafeAreaInsets() {
		let cssInsets = this.#safeAreaOverride;
		if (!cssInsets) {
			cssInsets = this.readSafeAreaFromUrl();
		}
		if (!cssInsets) {
			cssInsets = this.readSafeAreaFromEnvironment();
		}
		const targetResolutionScale = this.getTargetResolutionScale();
		const scale = (targetResolutionScale > 0) ? (1 / targetResolutionScale) : 1;
		const insets = {
			top: cssInsets.top * scale,
			right: cssInsets.right * scale,
			bottom: cssInsets.bottom * scale,
			left: cssInsets.left * scale,
		};
		const ignoredSafeAreaSides = this.getIgnoredSafeAreaSides();
		for (const side of ignoredSafeAreaSides) {
			if (side in insets) {
				insets[side] = 0;
			}
		}
		return insets;
	}

	//==============================================================================
	// 무시할 세이프에어리어 쪽 설정. (getSafeAreaInsets 가 그 쪽을 0 으로 돌려준다, 빈 목록이면 모두 쓴다)
	// - 플랫폼의 앱이 그 쪽을 이미 비켜 그리는 웹뷰처럼, 어느 쪽을 무시할지는 게임이 정해 넘긴다.
	//==============================================================================
	/**
	 * @param { string[] } sides "top", "right", "bottom", "left" 가운데.
	 */
	setIgnoredSafeAreaSides(sides) {
		this.#ignoredSafeAreaSides = sides ? sides.slice() : [];
	}

	//==============================================================================
	// 무시할 세이프에어리어 쪽 반환.
	//==============================================================================
	/**
	 * @returns { string[] } 무시할 쪽 목록. ("top", "right", "bottom", "left" 가운데)
	 */
	getIgnoredSafeAreaSides() {
		return this.#ignoredSafeAreaSides;
	}

	//==============================================================================
	// URL 쿼리에서 세이프에어리어 읽기. (?safeArea=44,0,34,0)
	//==============================================================================
	/**
	 * @private
	 * @returns { object | null }
	 */
	readSafeAreaFromUrl() {
		try {
			const parameters = new System.URLSearchParams(System.window.location.search);
			const safeAreaText = parameters.get("safeArea");
			if (!safeAreaText) {
				return null;
			}
			const parts = safeAreaText.split(",").map((part) => System.parseFloat(part) || 0);
			return { top: parts[0] || 0, right: parts[1] || 0, bottom: parts[2] || 0, left: parts[3] || 0 };
		}
		catch (parseError) {
			return null;
		}
	}

	//==============================================================================
	// env(safe-area-inset-*) 실측.
	//==============================================================================
	/**
	 * @private
	 * @returns { object }
	 */
	readSafeAreaFromEnvironment() {
		const documentObject = System.document;
		if (!documentObject || !documentObject.body) {
			return { top: 0, right: 0, bottom: 0, left: 0 };
		}
		if (!this.#safeAreaProbeElement) {
			const probeElement = documentObject.createElement("div");
			probeElement.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;"
				+ "padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);"
				+ "padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);";
			documentObject.body.appendChild(probeElement);
			this.#safeAreaProbeElement = probeElement;
		}
		const computedStyle = System.getComputedStyle(this.#safeAreaProbeElement);
		return {
			top: System.parseFloat(computedStyle.paddingTop) || 0,
			right: System.parseFloat(computedStyle.paddingRight) || 0,
			bottom: System.parseFloat(computedStyle.paddingBottom) || 0,
			left: System.parseFloat(computedStyle.paddingLeft) || 0,
		};
	}
}
