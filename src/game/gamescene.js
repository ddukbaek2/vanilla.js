//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../base/vector2.js";
import { Rect } from "../base/rect.js";
import { Pivot } from "../base/pivot.js";
import { Color } from "../base/color.js";
import { Engine } from "../core/engine.js";
import { Graphic } from "../core/graphic.js";
import { Scene } from "../core/scene.js";
import { TouchRecognizer } from "../ui/touchrecognizer.js";
import { WorldNode } from "../core/node/worldnode.js";
import { DEVTools } from "../misc/devtools.js";
import { ImageAsset } from "../resource/imageasset.js";


//==============================================================================
// 게임 공통 베이스 씬.
// - 로딩 화면 (중앙 이미지 + 게이지 + 터치 단축).
// - 개발자 도구 (DEVTools).
// - 터치 입력 라우팅 (TouchRecognizer + DEVTools 캡처 시 무시).
// - 세이프 에어리어 노드 + env(safe-area-inset-*) 계산.
// - viewSize 변화 자동 감지 → layout 재호출.
// - 캔버스 배경 클리어.
//
// 서브클래스 hook:
// - loadAssets(): super 호출 후 자체 자산을 비동기 로드.
// - layout(): super 호출 후 자체 콘텐츠 레이아웃 갱신.
//==============================================================================
export class GameScene extends Scene {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { DEVTools } */ #devtools;
	/** @private @type { TouchRecognizer } */ #touchRaycaster;
	/** @private @type { WorldNode } */ #safeAreaNode;
	/** @private @type { Rect } */ #lastSafeAreaRect;
	/** @private @type { number } */ #lastViewSizeX;
	/** @private @type { number } */ #lastViewSizeY;
	/** @private @type { ImageAsset | null } */ #loadingImageAsset;
	/** @private @type { string } */ #loadingImageUrl;
	/** @private @type { number } */ #loadStartTime;
	/** @private @type { number } */ #loadMinDurationMs;
	/** @private @type { boolean } */ #loadTouchedToSkip;
	/** @private @type { Color } */ #sceneBackgroundColor;


	//==============================================================================
	// 생성자.
	//==============================================================================
	constructor() {
		super();
		this.#loadingImageAsset = null;
		this.#loadingImageUrl = "";
		this.#loadStartTime = 0;
		this.#loadMinDurationMs = 3000;
		this.#loadTouchedToSkip = false;
		this.#sceneBackgroundColor = Color.black();
	}


	//==============================================================================
	// 로딩 화면 중앙 이미지 URL 설정. (빈 문자열이면 이미지 없이 게이지만 노출)
	//==============================================================================
	/**
	 * @param { string } url
	 */
	setLoadingImageUrl(url) {
		this.#loadingImageUrl = url || "";
	}


	//==============================================================================
	// 로딩 화면 최소 노출 시간 (ms) 설정.
	//==============================================================================
	/**
	 * @param { number } milliseconds
	 */
	setLoadingMinDurationMs(milliseconds) {
		this.#loadMinDurationMs = milliseconds;
	}


	//==============================================================================
	// 캔버스 배경색 설정. (preDraw 단계에서 캔버스 전체에 적용)
	//==============================================================================
	/**
	 * @param { Color } color
	 */
	setSceneBackgroundColor(color) {
		this.#sceneBackgroundColor = color;
	}


	//==============================================================================
	// 세이프 에어리어 노드 반환. (서브클래스가 자식 콘텐츠를 여기에 붙인다)
	//==============================================================================
	/**
	 * @returns { WorldNode }
	 */
	getSafeAreaNode() {
		return this.#safeAreaNode;
	}


	//==============================================================================
	// 마지막으로 계산된 세이프 에어리어 영역 반환.
	//==============================================================================
	/**
	 * @returns { Rect }
	 */
	getSafeAreaRect() {
		return this.#lastSafeAreaRect;
	}


	//==============================================================================
	// 비동기 로드.
	// - loadAssets() hook 호출 + 최소 노출 시간 보장.
	// - 화면 터치 시 즉시 단축. drawOnLoad 단계에서는 씬의 touchPress 가
	//   호출된다는 보장이 없어 window 이벤트로 직접 캡처한다.
	//==============================================================================
	/**
	 * @override
	 * @param { Engine } engine
	 */
	async load(engine) {
		await super.load(engine);

		this.#loadStartTime = System.Date.now();
		this.#loadTouchedToSkip = false;

		const skipHandler = () => {
			this.#loadTouchedToSkip = true;
		};
		System.window.addEventListener("pointerdown", skipHandler, { once: true });

		try {
			await this.loadAssets();
			while (System.Date.now() - this.#loadStartTime < this.#loadMinDurationMs && !this.#loadTouchedToSkip) {
				await new Promise((resolve) => System.setTimeout(resolve, 50));
			}
		}
		finally {
			System.window.removeEventListener("pointerdown", skipHandler);
		}
	}


	//==============================================================================
	// 자산 로드 hook.
	// - 서브클래스가 오버라이드해서 자체 자산을 비동기 로드한다. super 호출 필수.
	//==============================================================================
	async loadAssets() {
		if (this.#loadingImageUrl) {
			const loadingImageAsset = new ImageAsset();
			this.#loadingImageAsset = loadingImageAsset;
			try {
				await loadingImageAsset.load(this.#loadingImageUrl);
			}
			catch (error) {
				console.error("[GameScene] 로딩 이미지 로드 실패:", error);
			}
		}
	}


	//==============================================================================
	// 로딩 화면 출력. (엔진이 isLoaded() === false 인 동안 매 프레임 호출)
	// - 검은 배경 + 중앙 로딩 이미지 + 하단 게이지.
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic
	 */
	drawOnLoad(graphic) {
		super.drawOnLoad(graphic);

		const engine = this.getEngine();
		if (!engine) {
			return;
		}
		const canvasRenderingContext = graphic.getCanvasRenderingContext();
		const viewManager = engine.getViewManager();
		const canvasNativeSize = viewManager.getCanvasNativeSize();
		const viewSize = viewManager.getViewSize();

		// 캔버스 전체 검은색.
		viewManager.applyCanvasNativeRect(canvasRenderingContext);
		graphic.setFillColor(Color.black());
		graphic.drawRect(Rect.create(0, 0, canvasNativeSize.x, canvasNativeSize.y));

		// 뷰 좌표계 적용.
		viewManager.applyViewRect(canvasRenderingContext);
		graphic.setFillColor(Color.black());
		graphic.drawRect(Rect.create(0, 0, viewSize.x, viewSize.y));

		// 중앙 로딩 이미지 (가로 70%, 비율 유지).
		const loadingImageAsset = this.#loadingImageAsset;
		if (loadingImageAsset && loadingImageAsset.isLoaded()) {
			const image = loadingImageAsset.image;
			const targetWidth = viewSize.x * 0.7;
			const ratio = image.height / image.width;
			const targetHeight = targetWidth * ratio;
			const positionX = (viewSize.x - targetWidth) * 0.5;
			const positionY = (viewSize.y - targetHeight) * 0.5;
			canvasRenderingContext.drawImage(image, positionX, positionY, targetWidth, targetHeight);
		}

		// 하단 로딩 게이지.
		const elapsed = System.Date.now() - this.#loadStartTime;
		const progress = System.Math.min(1, System.Math.max(0, elapsed / this.#loadMinDurationMs));
		const barWidth = viewSize.x * 0.6;
		const barHeight = 24;
		const barX = (viewSize.x - barWidth) * 0.5;
		const barY = viewSize.y * 0.78;
		canvasRenderingContext.fillStyle = "#333333";
		canvasRenderingContext.fillRect(barX, barY, barWidth, barHeight);
		canvasRenderingContext.fillStyle = "#ffffff";
		canvasRenderingContext.fillRect(barX, barY, barWidth * progress, barHeight);
	}


	//==============================================================================
	// 초기화.
	//==============================================================================
	/**
	 * @override
	 * @param { Engine } engine
	 */
	initialize(engine) {
		super.initialize(engine);

		// 개발자 도구.
		this.#devtools = new DEVTools();
		this.#devtools.setEngine(engine);
		this.#devtools.setRootNodes([this.getRoot()]);

		// 터치 레이캐스터.
		this.#touchRaycaster = new TouchRecognizer();
		this.#touchRaycaster.setRootNode(this.getRoot());

		// 세이프 에어리어 컨테이너.
		this.#safeAreaNode = new WorldNode();
		this.#safeAreaNode.setName("safeArea");
		this.#safeAreaNode.setPivot(Pivot.topLeft);
		this.#safeAreaNode.setAnchor(Pivot.topLeft);
		this.getRoot().addChild(this.#safeAreaNode);

		this.#lastSafeAreaRect = Rect.zero();
		this.#lastViewSizeX = 0;
		this.#lastViewSizeY = 0;
	}


	//==============================================================================
	// 화면 크기 변경됨.
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } canvasNativeSize
	 */
	resize(canvasNativeSize) {
		super.resize(canvasNativeSize);
		this.layout();
	}


	//==============================================================================
	// 레이아웃.
	// - 서브클래스는 super.layout() 호출 후 자체 콘텐츠 레이아웃을 갱신한다.
	//==============================================================================
	layout() {
		const safeAreaRect = this.computeSafeAreaRect();
		this.#lastSafeAreaRect = safeAreaRect;
		this.#safeAreaNode.setLocalPosition(Vector2.create(safeAreaRect.position.x, safeAreaRect.position.y));
		this.#safeAreaNode.setContentSize(safeAreaRect.size);
	}


	//==============================================================================
	// 세이프 에어리어 계산. (뷰 좌표계 기준)
	//==============================================================================
	/**
	 * @returns { Rect }
	 */
	computeSafeAreaRect() {
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		const viewSize = viewManager.getViewSize();
		const targetScale = viewManager.getTargetResolutionScale();

		// CSS 픽셀 기준 세이프 에어리어 인셋.
		const div = System.document.createElement("div");
		div.style.position = "absolute";
		div.style.visibility = "hidden";
		div.style.paddingTop = "env(safe-area-inset-top)";
		div.style.paddingRight = "env(safe-area-inset-right)";
		div.style.paddingBottom = "env(safe-area-inset-bottom)";
		div.style.paddingLeft = "env(safe-area-inset-left)";
		System.document.body.appendChild(div);
		const computedStyle = System.window.getComputedStyle(div);
		const insetTopCss = System.Number.parseInt(computedStyle.paddingTop) || 0;
		const insetRightCss = System.Number.parseInt(computedStyle.paddingRight) || 0;
		const insetBottomCss = System.Number.parseInt(computedStyle.paddingBottom) || 0;
		const insetLeftCss = System.Number.parseInt(computedStyle.paddingLeft) || 0;
		System.document.body.removeChild(div);

		// CSS 픽셀 → 뷰 좌표.
		const scale = targetScale > 0 ? targetScale : 1;
		const insetTop = insetTopCss / scale;
		const insetRight = insetRightCss / scale;
		const insetBottom = insetBottomCss / scale;
		const insetLeft = insetLeftCss / scale;

		const x = insetLeft;
		const y = insetTop;
		const width = System.Math.max(viewSize.x - insetLeft - insetRight, 0);
		const height = System.Math.max(viewSize.y - insetTop - insetBottom, 0);
		return Rect.create(x, y, width, height);
	}


	//==============================================================================
	// 갱신.
	// - viewSize 변화 감지 → 자동 layout 재호출.
	//   (모바일 주소창 표시/숨김으로 100vh 가 동적으로 변하는 경우 등에서
	//    resize 이벤트만으로는 누락될 수 있어 매 tick 보정.)
	// - DEVTools tick 처리.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		super.tick(timeDelta);

		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		const viewSize = viewManager.getViewSize();
		if (viewSize.x !== this.#lastViewSizeX || viewSize.y !== this.#lastViewSizeY) {
			this.#lastViewSizeX = viewSize.x;
			this.#lastViewSizeY = viewSize.y;
			this.layout();
		}

		const timeManager = engine.getTimeManager();
		const unscaledTimeDelta = timeManager.getUnscaleDeltaTime();
		this.#devtools.tick(unscaledTimeDelta);
	}


	//==============================================================================
	// 디브툴이 입력을 가져가는 중인지 여부.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isDevToolsCapturingInput() {
		return this.#devtools.isVisible() && this.#devtools.isPointerInsidePanel();
	}


	//==============================================================================
	// touchPress.
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } viewInputPosition
	 */
	touchPress(viewInputPosition) {
		if (this.isDevToolsCapturingInput()) {
			return;
		}
		this.#touchRaycaster.touchPress(viewInputPosition);
	}


	//==============================================================================
	// touchMove.
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } viewInputPosition
	 */
	touchMove(viewInputPosition) {
		if (this.isDevToolsCapturingInput()) {
			return;
		}
		this.#touchRaycaster.touchMove(viewInputPosition);
	}


	//==============================================================================
	// touchRelease.
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } viewInputPosition
	 */
	touchRelease(viewInputPosition) {
		if (this.isDevToolsCapturingInput()) {
			return;
		}
		this.#touchRaycaster.touchRelease(viewInputPosition);
	}


	//==============================================================================
	// touchCancel.
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } viewInputPosition
	 */
	touchCancel(viewInputPosition) {
		if (this.isDevToolsCapturingInput()) {
			return;
		}
		this.#touchRaycaster.touchCancel(viewInputPosition);
	}


	//==============================================================================
	// touchWheel.
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } viewInputPosition
	 * @param { Vector2 } wheelDelta
	 */
	touchWheel(viewInputPosition, wheelDelta) {
		if (this.isDevToolsCapturingInput()) {
			return;
		}
		this.#touchRaycaster.touchWheel(viewInputPosition, wheelDelta);
	}


	//==============================================================================
	// preDraw. 캔버스 전체를 sceneBackgroundColor 로 칠한다 (세이프 에어리어 바깥 영역 포함).
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic
	 */
	preDraw(graphic) {
		super.preDraw(graphic);

		const engine = this.getEngine();
		const canvasRenderingContext = graphic.getCanvasRenderingContext();
		const viewManager = engine.getViewManager();
		const canvasNativeSize = viewManager.getCanvasNativeSize();

		viewManager.applyCanvasNativeRect(canvasRenderingContext);
		graphic.setFillColor(this.#sceneBackgroundColor);
		graphic.drawRect(Rect.create(0, 0, canvasNativeSize.x, canvasNativeSize.y));

		viewManager.applyViewRect(canvasRenderingContext);
	}


	//==============================================================================
	// postDraw. DEVTools 를 화면 위에 그린다.
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic
	 */
	postDraw(graphic) {
		super.postDraw(graphic);
		this.#devtools.draw(graphic);
	}
}
