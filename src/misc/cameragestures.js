//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../base/vector2.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 마우스의 단추. (MouseEvent.button)
const MOUSE_MIDDLE_BUTTON = 1;
const MOUSE_RIGHT_BUTTON = 2;


//==============================================================================
// 카메라 손짓. (3D 판이나 지도를 돌리고 밀고 키우는 손짓, 마우스 오른쪽과 가운데 단추 끌기, 두 손가락)
// - 엔진의 입력은 손가락 하나(또는 마우스의 아무 단추)를 누름, 끌기, 뗌으로만 넘긴다. 돌리고 밀고 키우는 손짓은 그 밖의 것이라 캔버스의 DOM 사건을 따로 읽는다. (엔진의 동작은 그대로 둔다)
//   - 마우스 오른쪽 단추를 누른 채 끌기: 가로로 끈 만큼 돌리고(화면 너비만큼이 한 바퀴), 세로로 끈 만큼 기울인다. 끌지 않고 떼면 오른쪽 클릭이다.
//   - 마우스 가운데 단추를 누른 채 끌기: 민다.
//   - 두 손가락: 같은 쪽으로 끌면 밀고, 오므리고 벌리면 두 손가락 가운데를 두고 키우고 줄이고, 비틀기 문턱을 넘게 비틀면 돌린다. (오므려 키우다가 조금씩 도는 것을 막는다)
// - 휠은 엔진이 넘긴다. 여기서는 Ctrl 을 눌렀는지만 적어 둔다. (노트북 터치패드의 오므리기도 Ctrl 휠로 온다)
// - 손짓 중에는 엔진이 넘기는 누름과 뗌을 놀이에 쓰지 않도록 isGestureActive 로 알린다.
// - 모인 양(밀기, 돌리기, 기울이기, 키우기)은 매 프레임 take 로 꺼내 간다. 밀기는 뷰 단위, 돌리기와 기울이기는 라디안, 키우기는 곱할 비다.
// - 마지막 손이 손가락인지 마우스인지도 읽는다. 손가락을 뗀 바로 뒤에 브라우저가 흉내 내 보내는 마우스 사건은 무시한다.
// - 생성하면 엔진의 캔버스에 사건을 붙인다. 다 쓰면 dispose().
//==============================================================================
/**
 * @example <caption>두 손가락과 마우스 손짓으로 2D 카메라 돌리고 밀고 키우기</caption>
 * import { Engine, EngineConfiguration, Scene, CameraGestures, Camera2D, Rect, Colors } from "./build/vanilla.js";
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * const cameraGestures = new CameraGestures();
 * const camera = new Camera2D();
 *
 * class MainScene extends Scene {
 * 	tick(timeDelta) {
 * 		super.tick(timeDelta);
 * 		const viewManager = engine.getViewManager();
 * 		const viewSize = viewManager.getViewSize();
 * 		camera.setViewSize(viewSize);
 * 		const pan = cameraGestures.takePan();
 * 		camera.panByScreen(pan.x, pan.y);
 * 		const rotation = cameraGestures.takeRotation();
 * 		const currentRotation = camera.getRotation();
 * 		camera.setRotation(currentRotation + rotation * 180 / Math.PI);
 * 		const zoom = cameraGestures.takeZoom();
 * 		const zoomAnchor = cameraGestures.getZoomAnchor();
 * 		if (zoom !== 1 && zoomAnchor !== null) {
 * 			camera.zoomAt(zoomAnchor, zoom);
 * 		}
 * 		camera.tick(timeDelta);
 * 	}
 *
 * 	draw(graphic) {
 * 		camera.begin(graphic);
 * 		graphic.setFillColor(Colors.white);
 * 		graphic.drawRect(Rect.create(-100, -100, 200, 200));
 * 		camera.end(graphic);
 * 		super.draw(graphic);
 * 	}
 *
 * 	touchPress(viewInputPosition) {
 * 		super.touchPress(viewInputPosition);
 * 		if (cameraGestures.isGestureActive()) {
 * 			return;
 * 		}
 * 		console.log("tap", viewInputPosition.x, viewInputPosition.y);
 * 	}
 * }
 *
 * engine.run(new MainScene());
 */
export class CameraGestures {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { HTMLCanvasElement | null } */ #canvas;
	/** @private @type { boolean } */ #isRightButtonDown;
	/** @private @type { boolean } */ #isMiddleButtonDown;
	/** @private @type { number } */ #lastMouseX;
	/** @private @type { number } */ #lastMouseY;
	/** @private @type { number } */ #rightPressX; // 오른쪽 단추를 누른 자리. (CSS 픽셀)
	/** @private @type { number } */ #rightPressY;
	/** @private @type { boolean } */ #isRightDragged; // 오른쪽 단추를 누른 채 문턱 넘게 끌었는지.
	/** @private @type { boolean } */ #isRightClicked; // 오른쪽 클릭이 있었는지. (꺼내 가면 지웁다)
	/** @private @type { boolean } */ #isMultiTouch; // 두 손가락 손짓 중인지. (모든 손가락을 뗄 때까지)
	/** @private @type { number } */ #lastTouchCenterX;
	/** @private @type { number } */ #lastTouchCenterY;
	/** @private @type { number } */ #lastTouchAngle;
	/** @private @type { number } */ #lastTouchDistance;
	/** @private @type { number } */ #twistSum; // 두 손가락을 댄 뒤 비튼 각도의 합. (문턱을 넘기 전)
	/** @private @type { boolean } */ #isTwisting; // 비틀기가 문턱을 넘어 돌리는 중인지.
	/** @private @type { number } */ #panX; // 모인 밀기. (뷰 단위)
	/** @private @type { number } */ #panY;
	/** @private @type { number } */ #rotation; // 모인 돌리기. (라디안)
	/** @private @type { number } */ #tilt; // 모인 기울이기. (라디안, + 가 위에서 보는 쪽)
	/** @private @type { number } */ #zoom; // 모인 키우기. (곱할 비, 1 이면 그대로)
	/** @private @type { Vector2 | null } */ #zoomAnchor; // 키우기의 가운데. (뷰 좌표, 두 손가락 가운데)
	/** @private @type { boolean } */ #isRotationReleased; // 돌리기를 놓았는지. (꺼내 가면 지웁다)
	/** @private @type { boolean } */ #isLastWheelCtrl; // 마지막 휠이 Ctrl 을 누른 휠이었는지.
	/** @private @type { boolean } */ #isTouchInput; // 마지막 손이 손가락인지.
	/** @private @type { number } */ #lastTouchTime; // 마지막 손가락 사건의 시각. (밀리초)
	/** @private @type { Array<object> } */ #listeners; // 붙인 DOM 사건. { target, type, handler, options }
	/** @private @type { number } */ #compatibilityMouseMilliseconds; // 손가락을 뗀 뒤 흉내 낸 마우스 사건을 무시하는 시간. (밀리초)
	/** @private @type { number } */ #twistStartRadians; // 두 손가락 비틀기가 돌리기를 시작하는 각도.
	/** @private @type { number } */ #tiltPerHalfHeightRadians; // 오른쪽 끌기를 화면 높이의 반만큼 세로로 끌면 기울어지는 각도.
	/** @private @type { number } */ #rightClickDistance; // 오른쪽 단추를 이만큼 안에서 떼면 끌기가 아니라 누르기. (CSS 픽셀)

	//==============================================================================
	// 생성. (캔버스에 사건을 붙인다, 다 쓰면 dispose)
	//==============================================================================
	constructor() {
		this.#canvas = null;
		this.#isRightButtonDown = false;
		this.#isMiddleButtonDown = false;
		this.#lastMouseX = 0;
		this.#lastMouseY = 0;
		this.#rightPressX = 0;
		this.#rightPressY = 0;
		this.#isRightDragged = false;
		this.#isRightClicked = false;
		this.#isMultiTouch = false;
		this.#lastTouchCenterX = 0;
		this.#lastTouchCenterY = 0;
		this.#lastTouchAngle = 0;
		this.#lastTouchDistance = 1;
		this.#twistSum = 0;
		this.#isTwisting = false;
		this.#panX = 0;
		this.#panY = 0;
		this.#rotation = 0;
		this.#tilt = 0;
		this.#zoom = 1;
		this.#zoomAnchor = null;
		this.#isRotationReleased = false;
		this.#isLastWheelCtrl = false;
		this.#isTouchInput = this.isCoarsePointer();
		this.#compatibilityMouseMilliseconds = 800;
		this.#twistStartRadians = 15 * System.Math.PI / 180;
		this.#tiltPerHalfHeightRadians = 35 * System.Math.PI / 180;
		this.#rightClickDistance = 8;
		this.#lastTouchTime = -this.#compatibilityMouseMilliseconds;
		this.#listeners = [];
		const engine = System.vanillaEngine;
		if (!engine) {
			return;
		}
		const canvas = engine.getCanvas();
		if (canvas === null || canvas === undefined) {
			return;
		}
		this.#canvas = canvas;
		this.addListener(canvas, "mousedown", (mouseEvent) => {
			this.handleMouseDown(mouseEvent);
		}, false);
		this.addListener(System.window, "mousemove", (mouseEvent) => {
			this.handleMouseMove(mouseEvent);
		}, false);
		this.addListener(System.window, "mouseup", (mouseEvent) => {
			this.handleMouseUp(mouseEvent);
		}, false);
		this.addListener(canvas, "wheel", (wheelEvent) => {
			this.handleWheel(wheelEvent);
		}, { passive: true });
		this.addListener(canvas, "touchstart", (touchEvent) => {
			this.handleTouchChange(touchEvent);
		}, { passive: true });
		this.addListener(canvas, "touchmove", (touchEvent) => {
			this.handleTouchMove(touchEvent);
		}, { passive: true });
		this.addListener(canvas, "touchend", (touchEvent) => {
			this.handleTouchChange(touchEvent);
		}, { passive: true });
		this.addListener(canvas, "touchcancel", (touchEvent) => {
			this.handleTouchChange(touchEvent);
		}, { passive: true });
	}

	//==============================================================================
	// DOM 사건 붙이기. (dispose 가 뗍다)
	//==============================================================================
	/**
	 * @param { EventTarget } target 사건을 붙일 대상.
	 * @param { string } type 사건 이름.
	 * @param { Function } handler 사건 처리 함수.
	 * @param { object | boolean } options addEventListener 의 options. (dispose 가 뗄 때도 같은 것을 넘긴다)
	 */
	addListener(target, type, handler, options) {
		target.addEventListener(type, handler, options);
		this.#listeners.push({ target: target, type: type, handler: handler, options: options });
	}

	//==============================================================================
	// 다 씀. (붙인 사건을 뗍다)
	//==============================================================================
	dispose() {
		for (const listener of this.#listeners) {
			listener.target.removeEventListener(listener.type, listener.handler, listener.options);
		}
		this.#listeners = [];
		this.#canvas = null;
	}

	//==============================================================================
	// 손짓 중인지. (오른쪽이나 가운데 단추를 누르고 있거나 두 손가락, 이때 엔진의 누름은 놀이에 쓰지 않는다)
	//==============================================================================
	/**
	 * @returns { boolean } 손짓 중이면 참.
	 */
	isGestureActive() {
		return this.#isRightButtonDown || this.#isMiddleButtonDown || this.#isMultiTouch;
	}

	//==============================================================================
	// 마지막 손이 손가락인지. (처음에는 기기가 손가락이 주된 입력인지로)
	//==============================================================================
	/**
	 * @returns { boolean } 마지막 손이 손가락이면 참.
	 */
	isTouchInput() {
		return this.#isTouchInput;
	}

	//==============================================================================
	// 기기가 손가락이 주된 입력인지. (폰과 태블릿)
	//==============================================================================
	/**
	 * @returns { boolean } 손가락이 주된 입력인 기기면 참. (matchMedia 가 없으면 거짓)
	 */
	isCoarsePointer() {
		if (typeof System.matchMedia !== "function") {
			return false;
		}
		const mediaQueryList = System.matchMedia("(pointer: coarse)");
		return mediaQueryList.matches;
	}

	//==============================================================================
	// 마지막 휠이 Ctrl 을 누른 휠이었는지. (휠로 밀기를 켰어도 그 휠은 키우기입다)
	//==============================================================================
	/**
	 * @returns { boolean } 마지막 휠이 Ctrl 을 누른 휠이면 참.
	 */
	isLastWheelCtrl() {
		return this.#isLastWheelCtrl;
	}

	//==============================================================================
	// 모인 밀기 꺼내기. ({ x, y } 뷰 단위, 꺼내면 비웁다)
	//==============================================================================
	/**
	 * @returns { object } 모인 밀기. ({ x, y }, 뷰 단위)
	 */
	takePan() {
		const pan = { x: this.#panX, y: this.#panY };
		this.#panX = 0;
		this.#panY = 0;
		return pan;
	}

	//==============================================================================
	// 모인 돌리기 꺼내기. (라디안, 꺼내면 비웁다)
	//==============================================================================
	/**
	 * @returns { number } 모인 돌리기. (라디안)
	 */
	takeRotation() {
		const rotation = this.#rotation;
		this.#rotation = 0;
		return rotation;
	}

	//==============================================================================
	// 모인 기울이기 꺼내기. (라디안, 꺼내면 비웁다)
	//==============================================================================
	/**
	 * @returns { number } 모인 기울이기. (라디안, + 가 위에서 보는 쪽)
	 */
	takeTilt() {
		const tilt = this.#tilt;
		this.#tilt = 0;
		return tilt;
	}

	//==============================================================================
	// 모인 키우기 꺼내기. (곱할 비, 꺼내면 1)
	//==============================================================================
	/**
	 * @returns { number } 모인 키우기. (곱할 비, 1 이면 그대로)
	 */
	takeZoom() {
		const zoom = this.#zoom;
		this.#zoom = 1;
		return zoom;
	}

	//==============================================================================
	// 키우기의 가운데. (뷰 좌표, 두 손가락 가운데, 없으면 null)
	//==============================================================================
	/**
	 * @returns { Vector2 | null } 키우기의 가운데. (뷰 좌표, 두 손가락으로 키운 적이 없으면 null)
	 */
	getZoomAnchor() {
		return this.#zoomAnchor;
	}

	//==============================================================================
	// 오른쪽 클릭이 있었는지 꺼내기. (끌지 않고 뗀 오른쪽 단추, 꺼내면 지웁다)
	//==============================================================================
	/**
	 * @returns { boolean } 오른쪽 클릭이 있었으면 참.
	 */
	takeRightClick() {
		const isRightClicked = this.#isRightClicked;
		this.#isRightClicked = false;
		return isRightClicked;
	}

	//==============================================================================
	// 돌리기를 놓았는지 꺼내기. (꺼내면 지웁다)
	//==============================================================================
	/**
	 * @returns { boolean } 돌리기를 놓았으면 참. (오른쪽 단추를 떼거나 두 손가락을 모두 뗐을 때)
	 */
	takeRotationReleased() {
		const isRotationReleased = this.#isRotationReleased;
		this.#isRotationReleased = false;
		return isRotationReleased;
	}

	//==============================================================================
	// CSS 픽셀 하나가 뷰 단위로 얼마인지. (폰의 pt 와 같습다)
	//==============================================================================
	/**
	 * @returns { number } CSS 픽셀 하나의 뷰 단위 크기. (엔진이 없으면 1)
	 */
	readUnitsPerCssPixel() {
		const engine = System.vanillaEngine;
		if (!engine) {
			return 1;
		}
		// 해상도 배율은 뷰 단위 하나가 CSS 픽셀로 얼마인지입다. (기기의 DPR 과 상관없음)
		const viewManager = engine.getViewManager();
		const targetResolutionScale = viewManager.getTargetResolutionScale();
		if (targetResolutionScale <= 0) {
			return 1;
		}
		return 1 / targetResolutionScale;
	}

	//==============================================================================
	// 브라우저 창의 자리를 뷰 좌표로. (엔진이 누름의 자리를 바꾸는 것과 같게, 엔진이 없으면 null)
	//==============================================================================
	/**
	 * @param { number } clientX 브라우저 창 기준 X. (CSS 픽셀)
	 * @param { number } clientY 브라우저 창 기준 Y. (CSS 픽셀)
	 * @returns { Vector2 | null } 뷰 좌표. (엔진이나 캔버스가 없으면 null)
	 */
	readViewPosition(clientX, clientY) {
		const engine = System.vanillaEngine;
		const canvas = this.#canvas;
		if (!engine || canvas === null) {
			return null;
		}
		const viewManager = engine.getViewManager();
		const canvasRect = canvas.getBoundingClientRect();
		const canvasPosition = Vector2.create(clientX - canvasRect.left, clientY - canvasRect.top);
		return viewManager.canvasPositionToViewPosition(canvasPosition);
	}

	//==============================================================================
	// 손가락을 뗀 바로 뒤의 마우스 사건인지. (브라우저가 흉내 내 보내는 것)
	//==============================================================================
	/**
	 * @returns { boolean } 마지막 손가락 사건 뒤 무시하는 시간 안이면 참.
	 */
	isCompatibilityMouse() {
		const now = System.performance.now();
		return now - this.#lastTouchTime < this.#compatibilityMouseMilliseconds;
	}

	//==============================================================================
	// 마우스 누름. (오른쪽 단추면 돌리기, 가운데 단추면 밀기 시작)
	//==============================================================================
	/**
	 * @param { MouseEvent } mouseEvent 브라우저 마우스 사건.
	 */
	handleMouseDown(mouseEvent) {
		if (this.isCompatibilityMouse()) {
			return;
		}
		this.#isTouchInput = false;
		this.#lastMouseX = mouseEvent.clientX;
		this.#lastMouseY = mouseEvent.clientY;
		if (mouseEvent.button === MOUSE_RIGHT_BUTTON) {
			this.#isRightButtonDown = true;
			this.#isRightDragged = false;
			this.#rightPressX = mouseEvent.clientX;
			this.#rightPressY = mouseEvent.clientY;
		}
		else if (mouseEvent.button === MOUSE_MIDDLE_BUTTON) {
			this.#isMiddleButtonDown = true;
			mouseEvent.preventDefault();
		}
	}

	//==============================================================================
	// 마우스로 끄는 커서. (오른쪽 단추로 돌리거나 가운데 단추로 미는 중이면 grabbing, 오른쪽 단추를 누르고 아직 끌지 않았으면 grab, 아니면 빈 글)
	//==============================================================================
	/**
	 * @returns { string } CSS 커서 이름. ("grabbing", "grab", 빈 글)
	 */
	readMouseDragCursor() {
		if (this.#isMiddleButtonDown || (this.#isRightButtonDown && this.#isRightDragged)) {
			return "grabbing";
		}
		if (this.#isRightButtonDown) {
			return "grab";
		}
		return "";
	}

	//==============================================================================
	// 마우스 움직임. (오른쪽 단추를 누른 채면 가로로 움직인 만큼 돌리고 세로로 움직인 만큼 기울이고, 가운데 단추면 밉다)
	//==============================================================================
	/**
	 * @param { MouseEvent } mouseEvent 브라우저 마우스 사건.
	 */
	handleMouseMove(mouseEvent) {
		if (!this.isCompatibilityMouse()) {
			this.#isTouchInput = false;
		}
		const deltaX = mouseEvent.clientX - this.#lastMouseX;
		const deltaY = mouseEvent.clientY - this.#lastMouseY;
		this.#lastMouseX = mouseEvent.clientX;
		this.#lastMouseY = mouseEvent.clientY;
		if (this.#isRightButtonDown) {
			const pressDistance = System.Math.hypot(mouseEvent.clientX - this.#rightPressX, mouseEvent.clientY - this.#rightPressY);
			if (pressDistance > this.#rightClickDistance) {
				this.#isRightDragged = true;
			}
			// 화면 너비만큼 끌면 한 바퀴, 화면 높이의 반만큼 끌면 기울기 끝에서 끝까지. (위로 끌면 위에서 보는 쪽)
			const canvas = this.#canvas;
			const canvasWidth = canvas !== null ? System.Math.max(1, canvas.clientWidth) : 1000;
			const canvasHeight = canvas !== null ? System.Math.max(1, canvas.clientHeight) : 1000;
			this.#rotation += deltaX / canvasWidth * System.Math.PI * 2;
			this.#tilt -= deltaY / (canvasHeight * 0.5) * this.#tiltPerHalfHeightRadians;
		}
		if (this.#isMiddleButtonDown) {
			const unitsPerCssPixel = this.readUnitsPerCssPixel();
			this.#panX += deltaX * unitsPerCssPixel;
			this.#panY += deltaY * unitsPerCssPixel;
		}
	}

	//==============================================================================
	// 마우스 뗌. (오른쪽 단추면 돌리기 끝, 끌지 않았으면 오른쪽 클릭, 가운데 단추면 밀기 끝)
	//==============================================================================
	/**
	 * @param { MouseEvent } mouseEvent 브라우저 마우스 사건.
	 */
	handleMouseUp(mouseEvent) {
		if (mouseEvent.button === MOUSE_RIGHT_BUTTON && this.#isRightButtonDown) {
			this.#isRightButtonDown = false;
			this.#isRotationReleased = true;
			if (!this.#isRightDragged) {
				this.#isRightClicked = true;
			}
		}
		else if (mouseEvent.button === MOUSE_MIDDLE_BUTTON) {
			this.#isMiddleButtonDown = false;
		}
	}

	//==============================================================================
	// 휠. (Ctrl 을 눌렀는지만 적는다, 키우기와 밀기는 엔진이 넘긴 휠로 화면이 합다)
	//==============================================================================
	/**
	 * @param { WheelEvent } wheelEvent 브라우저 휠 사건.
	 */
	handleWheel(wheelEvent) {
		this.#isLastWheelCtrl = wheelEvent.ctrlKey;
	}

	//==============================================================================
	// 손가락 수가 바뀜. (둘 이상이면 손짓을 시작하고, 모두 떼면 끝냅다)
	//==============================================================================
	/**
	 * @param { TouchEvent } touchEvent 브라우저 손가락 사건.
	 */
	handleTouchChange(touchEvent) {
		this.#isTouchInput = true;
		this.#lastTouchTime = System.performance.now();
		const touches = touchEvent.touches;
		if (touches.length >= 2) {
			if (!this.#isMultiTouch) {
				this.#twistSum = 0;
				this.#isTwisting = false;
			}
			this.#isMultiTouch = true;
			this.captureTouchPose(touches);
			return;
		}
		if (touches.length === 0 && this.#isMultiTouch) {
			this.#isMultiTouch = false;
			this.#isRotationReleased = true;
		}
	}

	//==============================================================================
	// 두 손가락의 가운데, 각도, 거리를 기준으로 잡기.
	//==============================================================================
	/**
	 * @param { TouchList } touches 지금 닿은 손가락 목록. (앞의 둘을 쓴다)
	 */
	captureTouchPose(touches) {
		const firstTouch = touches[0];
		const secondTouch = touches[1];
		this.#lastTouchCenterX = (firstTouch.clientX + secondTouch.clientX) * 0.5;
		this.#lastTouchCenterY = (firstTouch.clientY + secondTouch.clientY) * 0.5;
		this.#lastTouchAngle = System.Math.atan2(secondTouch.clientY - firstTouch.clientY, secondTouch.clientX - firstTouch.clientX);
		this.#lastTouchDistance = System.Math.max(1, System.Math.hypot(secondTouch.clientX - firstTouch.clientX, secondTouch.clientY - firstTouch.clientY));
	}

	//==============================================================================
	// 두 손가락이 움직임. (가운데가 움직인 만큼 밀고, 거리가 바뀐 만큼 키우고, 문턱을 넘게 비틀면 돌립다)
	//==============================================================================
	/**
	 * @param { TouchEvent } touchEvent 브라우저 손가락 사건.
	 */
	handleTouchMove(touchEvent) {
		this.#lastTouchTime = System.performance.now();
		const touches = touchEvent.touches;
		if (!this.#isMultiTouch || touches.length < 2) {
			return;
		}
		const firstTouch = touches[0];
		const secondTouch = touches[1];
		const centerX = (firstTouch.clientX + secondTouch.clientX) * 0.5;
		const centerY = (firstTouch.clientY + secondTouch.clientY) * 0.5;
		const angle = System.Math.atan2(secondTouch.clientY - firstTouch.clientY, secondTouch.clientX - firstTouch.clientX);
		const distance = System.Math.max(1, System.Math.hypot(secondTouch.clientX - firstTouch.clientX, secondTouch.clientY - firstTouch.clientY));
		const unitsPerCssPixel = this.readUnitsPerCssPixel();
		this.#panX += (centerX - this.#lastTouchCenterX) * unitsPerCssPixel;
		this.#panY += (centerY - this.#lastTouchCenterY) * unitsPerCssPixel;
		this.#zoom *= distance / this.#lastTouchDistance;
		this.#zoomAnchor = this.readViewPosition(centerX, centerY);
		let angleDelta = angle - this.#lastTouchAngle;
		while (angleDelta > System.Math.PI) {
			angleDelta -= System.Math.PI * 2;
		}
		while (angleDelta < -System.Math.PI) {
			angleDelta += System.Math.PI * 2;
		}
		if (this.#isTwisting) {
			this.#rotation += angleDelta;
		}
		else {
			this.#twistSum += angleDelta;
			if (System.Math.abs(this.#twistSum) > this.#twistStartRadians) {
				this.#isTwisting = true;
			}
		}
		this.#lastTouchCenterX = centerX;
		this.#lastTouchCenterY = centerY;
		this.#lastTouchAngle = angle;
		this.#lastTouchDistance = distance;
	}

	//==============================================================================
	// 문턱 설정. (비틀기를 시작하는 각도, 화면 높이의 반만큼 끌 때 기울어지는 각도, 오른쪽 클릭으로 보는 거리, 흉내 낸 마우스를 무시하는 밀리초)
	//==============================================================================
	/**
	 * @param { number } twistStartRadians 두 손가락 비틀기가 돌리기를 시작하는 각도. (라디안, 기본 15 도)
	 * @param { number } tiltPerHalfHeightRadians 오른쪽 끌기를 화면 높이의 반만큼 세로로 끌면 기울어지는 각도. (라디안, 기본 35 도)
	 * @param { number } rightClickDistance 오른쪽 단추를 이만큼 안에서 떼면 오른쪽 클릭으로 본다. (CSS 픽셀, 기본 8)
	 * @param { number } compatibilityMouseMilliseconds 손가락을 뗀 뒤 흉내 낸 마우스 사건을 무시하는 시간. (밀리초, 기본 800)
	 * @example <caption>문턱을 도 단위로 바꿔 넣기</caption>
	 * import { CameraGestures } from "./build/vanilla.js";
	 *
	 * const cameraGestures = new CameraGestures();
	 * const twistStartRadians = 10 * Math.PI / 180;
	 * const tiltPerHalfHeightRadians = 45 * Math.PI / 180;
	 * cameraGestures.setThresholds(twistStartRadians, tiltPerHalfHeightRadians, 6, 600);
	 * console.log(cameraGestures.isGestureActive(), cameraGestures.takeZoom());
	 * cameraGestures.dispose();
	 */
	setThresholds(twistStartRadians, tiltPerHalfHeightRadians, rightClickDistance, compatibilityMouseMilliseconds) {
		this.#twistStartRadians = twistStartRadians;
		this.#tiltPerHalfHeightRadians = tiltPerHalfHeightRadians;
		this.#rightClickDistance = rightClickDistance;
		this.#compatibilityMouseMilliseconds = compatibilityMouseMilliseconds;
	}
}
