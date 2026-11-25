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
import { ViewScaleMode } from "../core/viewmanager.js";
import { TouchRecognizer } from "../ui/touchrecognizer.js";
import { UIWindowLayer } from "../ui/uiwindowlayer.js";
import { WorldNode } from "../core/node/worldnode.js";
import { DEVTools } from "../misc/devtools.js";
import { ImageAsset } from "../resource/imageasset.js";
import { LoadingProgress } from "../misc/loadingprogress.js";

//==============================================================================
// 게임 공통 베이스 씬.
// - 로딩 화면 (중앙 이미지 + 게이지 + 터치 단축).
//   색은 setLoadingColors, 그림 전체는 setLoadingDrawer 로 바꾼다. 게이지는 기본으로 최소 노출 시간의 경과를 보이고,
//   setLoadingProgress 나 trackAssetLoader 로 진행률을 알리면 그 진행률을 부드럽게 따라간다. (LoadingProgress)
// - 개발자 도구 (DEVTools).
// - 터치 입력 라우팅 (TouchRecognizer + DEVTools 캡처 시 무시).
// - 세이프 에어리어 노드 + env(safe-area-inset-*) 계산.
// - viewSize 변화 자동 감지 → layout 재호출.
// - 캔버스 배경 클리어.
// - 화면 페이드 (fadeScreen, 어두운 동안 입력을 막음).
// - UI 누름 판정 (isUserInterfaceAt) 과 UI 가 받지 않은 입력만 놀이로 넘기기 (setPlayInputHandler, 게임 영역 좌표).
// - 세이프에어리어를 뺀 게임 영역의 고정 쪽 길이를 늘 같게 (setPlayAreaReference).
//
// 서브클래스 hook:
// - loadAssets(): super 호출 후 자체 자산을 비동기 로드.
// - layout(): super 호출 후 자체 콘텐츠 레이아웃 갱신.
//==============================================================================
export class GameScene extends Scene {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { DEVTools | null } */ #devtools; // EngineConfiguration.useDevTools 가 꺼져 있으면 null.
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
	/** @private @type { string } */ #viewScaleMode;
	/** @private @type { ((graphic: Graphic, viewSize: Vector2, progress: number, elapsedSeconds: number) => void) | null } */ #loadingDrawer;
	/** @private @type { Color | string } */ #loadingBackgroundColor;
	/** @private @type { Color | string } */ #loadingBarBackColor;
	/** @private @type { Color | string } */ #loadingBarFillColor;
	/** @private @type { Color | string } */ #loadingOutsideColor; // 뷰 바깥(캔버스 나머지)의 색.
	/** @private @type { LoadingProgress } */ #loadingProgress;
	/** @private @type { boolean } */ #isLoadingProgressReported; // 진행률을 알린 적이 있는지. (없으면 게이지는 경과 시간)
	/** @private @type { Array<object> } */ #trackedAssetLoaderList;
	/** @private @type { number } */ #screenFadeAlpha; // 어두워지는 막의 진하기. (0 ~ 1)
	/** @private @type { number } */ #screenFadeDirection; // 1 이면 어두워지는 중, -1 이면 밝아지는 중, 0 이면 멈춤.
	/** @private @type { boolean } */ #isScreenFadeWaiting; // 다 어두워진 뒤 onDark 가 끝나기를 기다리는 중인지.
	/** @private @type { Function | null } */ #screenFadeEvent; // 다 어두워지면 부를 함수.
	/** @private @type { Color } */ #screenFadeColor;
	/** @private @type { number } */ #screenFadeSeconds; // 어두워지는 시간과 밝아지는 시간. (초)
	/** @private @type { object | null } */ #playInputHandler; // { press, move, release, wheel } (UI 가 받지 않은 입력, 게임 영역 좌표)
	/** @private @type { boolean } */ #isPlayPressActive; // 지금 누름이 놀이로 갔는지.
	/** @private @type { number } */ #playAreaFixedLength; // 게임 영역의 고정 쪽 길이. (0 이면 쓰지 않음)
	/** @private @type { boolean } */ #isPlayAreaLandscape; // 고정 쪽이 가로인지. (아니면 세로)

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
		this.#viewScaleMode = ViewScaleMode.none;
		this.#loadingDrawer = null;
		this.#loadingBackgroundColor = Color.black();
		this.#loadingBarBackColor = "#333333";
		this.#loadingBarFillColor = "#ffffff";
		this.#loadingOutsideColor = Color.black();
		this.#loadingProgress = new LoadingProgress();
		this.#isLoadingProgressReported = false;
		this.#trackedAssetLoaderList = [];
		this.#screenFadeAlpha = 0;
		this.#screenFadeDirection = 0;
		this.#isScreenFadeWaiting = false;
		this.#screenFadeEvent = null;
		this.#screenFadeColor = Color.black();
		this.#screenFadeSeconds = 0.35;
		this.#playInputHandler = null;
		this.#isPlayPressActive = false;
		this.#playAreaFixedLength = 0;
		this.#isPlayAreaLandscape = false;
	}

	//==============================================================================
	// ViewScaleMode 설정. 프로젝트별로 자유롭게 지정 가능.
	// - 디폴트는 ViewScaleMode.none. 엔진 기동 전 / 후 어디서든 호출 가능.
	// - 호출 시점에 엔진이 이미 attach 되어 있으면 즉시 viewManager 에 반영하고,
	//   아니면 initialize() 에서 일괄 적용된다.
	//==============================================================================
	/**
	 * @param { string } viewScaleMode
	 */
	setViewScaleMode(viewScaleMode) {
		this.#viewScaleMode = viewScaleMode;
		const engine = this.getEngine();
		if (engine) {
			engine.getViewManager().setViewScaleMode(viewScaleMode);
		}
	}

	//==============================================================================
	// 현재 ViewScaleMode 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getViewScaleMode() {
		return this.#viewScaleMode;
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
	// 로딩 화면 그리기 함수 설정. (null 이면 기본 그림: 가운데 로딩 이미지 + 아래 게이지)
	// - 엔진이 캔버스를 바깥 색으로, 뷰를 바탕색으로 칠하고 뷰 좌표계를 건 뒤 drawer(graphic, viewSize, progress, elapsedSeconds) 를 부른다.
	//   progress 는 보이는 진행률(0 ~ 1, 알린 것이 없으면 최소 노출 시간의 경과), elapsedSeconds 는 로딩을 시작한 뒤의 초다.
	// - 그림과 글꼴을 받기 전에도 그려지므로 도형과 시스템 글꼴로 그린다.
	//==============================================================================
	/**
	 * @param { ((graphic: Graphic, viewSize: Vector2, progress: number, elapsedSeconds: number) => void) | null } drawer
	 */
	setLoadingDrawer(drawer) {
		this.#loadingDrawer = drawer === undefined ? null : drawer;
	}

	//==============================================================================
	// 로딩 화면 그리기 함수 반환. (없으면 null)
	//==============================================================================
	/**
	 * @returns { Function | null }
	 */
	getLoadingDrawer() {
		return this.#loadingDrawer;
	}

	//==============================================================================
	// 로딩 화면 색 설정. (Color 나 "#rrggbb" 같은 색 글, 기본은 검은 바탕, #333333 게이지 바탕, #ffffff 게이지)
	// - outsideColor 는 뷰 바깥(캔버스 나머지)의 색이다. 주지 않으면 바탕색과 같다.
	//==============================================================================
	/**
	 * @param { Color | string } backgroundColor
	 * @param { Color | string } barBackColor
	 * @param { Color | string } barFillColor
	 * @param { Color | string } outsideColor
	 */
	setLoadingColors(backgroundColor, barBackColor, barFillColor, outsideColor = backgroundColor) {
		this.#loadingBackgroundColor = backgroundColor;
		this.#loadingBarBackColor = barBackColor;
		this.#loadingBarFillColor = barFillColor;
		this.#loadingOutsideColor = outsideColor;
	}

	//==============================================================================
	// 로딩 진행률 알리기. (0 ~ 1, 줄어들지 않는다. 알린 뒤로 게이지가 경과 시간 대신 이 값을 따라간다)
	//==============================================================================
	/**
	 * @param { number } progress
	 */
	setLoadingProgress(progress) {
		this.#isLoadingProgressReported = true;
		this.#loadingProgress.setProgress(progress);
	}

	//==============================================================================
	// 로딩 진행률 반환. (알린 정도와 부드럽게 따라가는 보이는 정도)
	//==============================================================================
	/**
	 * @returns { LoadingProgress }
	 */
	getLoadingProgress() {
		return this.#loadingProgress;
	}

	//==============================================================================
	// 애셋 함께 받기 맡기기. (로딩 화면이 프레임마다 맡긴 것들의 끝난 수 / 전체 수를 진행률로 알린다)
	//==============================================================================
	/**
	 * @param { AssetLoader } assetLoader
	 */
	trackAssetLoader(assetLoader) {
		if (this.#trackedAssetLoaderList.indexOf(assetLoader) < 0) {
			this.#trackedAssetLoaderList.push(assetLoader);
		}
		this.#isLoadingProgressReported = true;
	}

	//==============================================================================
	// 맡긴 애셋 함께 받기의 진행률을 알린다. (맡긴 것이 없으면 아무것도 하지 않는다)
	//==============================================================================
	updateTrackedAssetLoaderProgress() {
		const trackedAssetLoaderList = this.#trackedAssetLoaderList;
		if (trackedAssetLoaderList.length === 0) {
			return;
		}
		let finishedCount = 0;
		let totalCount = 0;
		for (const assetLoader of trackedAssetLoaderList) {
			finishedCount += assetLoader.getFinishedCount();
			totalCount += assetLoader.getTotalCount();
		}
		const progress = totalCount === 0 ? 1 : finishedCount / totalCount;
		this.#loadingProgress.setProgress(progress);
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
			if (this.#isLoadingProgressReported) {
				this.#loadingProgress.setProgress(1);
			}
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
	// - 바깥 색 캔버스 + 바탕색 뷰 + (그리기 함수, 없으면 중앙 로딩 이미지 + 하단 게이지).
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
		const viewManager = engine.getViewManager();
		const canvasNativeSize = viewManager.getCanvasNativeSize();
		const viewSize = viewManager.getViewSize();

		// 진행률. (맡긴 애셋 함께 받기를 읽고, 보이는 정도를 따라가게 한다)
		const timeManager = engine.getTimeManager();
		const unscaledTimeDelta = timeManager.getUnscaleDeltaTime();
		this.updateTrackedAssetLoaderProgress();
		const loadingProgress = this.#loadingProgress;
		loadingProgress.update(unscaledTimeDelta);
		const elapsed = System.Date.now() - this.#loadStartTime;
		let progress = System.Math.min(1, System.Math.max(0, elapsed / this.#loadMinDurationMs));
		if (this.#isLoadingProgressReported) {
			progress = loadingProgress.getShownProgress();
		}

		// 캔버스 전체 바깥 색. (기본 검은색)
		viewManager.applyCanvasNativeRect(graphic);
		graphic.setFillColor(this.#loadingOutsideColor);
		graphic.drawRect(Rect.create(0, 0, canvasNativeSize.x, canvasNativeSize.y));

		// 뷰 좌표계 적용.
		viewManager.applyViewRect(graphic);
		graphic.setFillColor(this.#loadingBackgroundColor);
		graphic.drawRect(Rect.create(0, 0, viewSize.x, viewSize.y));

		// 그리기 함수.
		const loadingDrawer = this.#loadingDrawer;
		if (loadingDrawer !== null) {
			loadingDrawer(graphic, viewSize, progress, elapsed / 1000);
			return;
		}

		// 중앙 로딩 이미지 (가로 70%, 비율 유지).
		const loadingImageAsset = this.#loadingImageAsset;
		if (loadingImageAsset && loadingImageAsset.isLoaded()) {
			const image = loadingImageAsset.image;
			const targetWidth = viewSize.x * 0.7;
			const ratio = image.height / image.width;
			const targetHeight = targetWidth * ratio;
			const positionX = (viewSize.x - targetWidth) * 0.5;
			const positionY = (viewSize.y - targetHeight) * 0.5;
			graphic.drawImage(image, Vector2.create(positionX, positionY), Vector2.create(targetWidth, targetHeight));
		}

		// 하단 로딩 게이지.
		const barWidth = viewSize.x * 0.6;
		const barHeight = 24;
		const barX = (viewSize.x - barWidth) * 0.5;
		const barY = viewSize.y * 0.78;
		graphic.setFillColor(this.#loadingBarBackColor);
		graphic.drawRect(Rect.create(barX, barY, barWidth, barHeight));
		graphic.setFillColor(this.#loadingBarFillColor);
		graphic.drawRect(Rect.create(barX, barY, barWidth * progress, barHeight));
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

		// ViewScaleMode 적용.
		engine.getViewManager().setViewScaleMode(this.#viewScaleMode);
		this.applyPlayAreaReference();

		// 개발자 도구. (EngineConfiguration.useDevTools 가 꺼져 있으면 만들지 않는다)
		this.#devtools = null;
		const engineConfiguration = engine.getEngineConfiguration();
		if (engineConfiguration.useDevTools !== false) {
			this.#devtools = new DEVTools();
			this.#devtools.setEngine(engine);
			this.#devtools.setRootNodes([this.getRoot()]);
		}

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
		this.applyPlayAreaReference();
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
		const safeAreaInsets = viewManager.getSafeAreaInsets();

		// 게임 영역 기준을 쓰면 올림한 뷰 크기 대신 캔버스를 배율로 나눈 실제 크기로 셈해 고정 쪽이 딱 맞게 한다.
		let viewWidth = viewSize.x;
		let viewHeight = viewSize.y;
		if (this.#playAreaFixedLength > 0) {
			const canvasNativeSize = viewManager.getCanvasNativeSize();
			const targetResolutionScale = viewManager.getTargetResolutionScale();
			const viewScale = targetResolutionScale > 0 ? targetResolutionScale : 1;
			viewWidth = canvasNativeSize.x / viewScale;
			viewHeight = canvasNativeSize.y / viewScale;
		}

		const x = safeAreaInsets.left;
		const y = safeAreaInsets.top;
		const width = System.Math.max(viewWidth - safeAreaInsets.left - safeAreaInsets.right, 0);
		const height = System.Math.max(viewHeight - safeAreaInsets.top - safeAreaInsets.bottom, 0);
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

		this.updateScreenFade();

		if (this.#devtools !== null) {
			const timeManager = engine.getTimeManager();
			const unscaledTimeDelta = timeManager.getUnscaleDeltaTime();
			this.#devtools.tick(unscaledTimeDelta);
		}
	}

	//==============================================================================
	// 디브툴이 입력을 가져가는 중인지 여부.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isDevToolsCapturingInput() {
		if (this.#devtools === null) {
			return false;
		}
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
		this.#isPlayPressActive = false;
		if (this.isDevToolsCapturingInput() || this.isScreenFading()) {
			return;
		}
		// UI 판정은 누름을 넘기기 전에 한다. (누른 단추가 창을 띄워도 이 누름은 놀이로 가지 않게)
		const isUserInterfacePressed = this.isUserInterfaceAt(viewInputPosition);
		this.#touchRaycaster.touchPress(viewInputPosition);
		if (isUserInterfacePressed || this.#playInputHandler === null) {
			return;
		}
		this.#isPlayPressActive = true;
		this.dispatchPlayInput("press", viewInputPosition, null);
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
		if (this.#isPlayPressActive) {
			this.dispatchPlayInput("move", viewInputPosition, null);
		}
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
		this.releasePlayPress(viewInputPosition);
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
		this.releasePlayPress(viewInputPosition);
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
		if (this.isDevToolsCapturingInput() || this.isScreenFading()) {
			return;
		}
		// 창 층 안을 가리키면 맨 위의 창이 먼저 받는다.
		const hitNode = this.#touchRaycaster.raycast(viewInputPosition);
		const windowLayer = UIWindowLayer.findWindowLayerOf(hitNode);
		if (windowLayer !== null) {
			windowLayer.scrollWindowAt(viewInputPosition, wheelDelta);
			return;
		}
		this.#touchRaycaster.touchWheel(viewInputPosition, wheelDelta);
		if (hitNode !== null && hitNode !== undefined) {
			return;
		}
		this.dispatchPlayInput("wheel", viewInputPosition, wheelDelta);
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
		const viewManager = engine.getViewManager();
		const canvasNativeSize = viewManager.getCanvasNativeSize();

		viewManager.applyCanvasNativeRect(graphic);
		graphic.setFillColor(this.#sceneBackgroundColor);
		graphic.drawRect(Rect.create(0, 0, canvasNativeSize.x, canvasNativeSize.y));

		viewManager.applyViewRect(graphic);
	}

	//==============================================================================
	// postDraw. 어두워지는 막과 DEVTools 를 화면 위에 그린다.
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic
	 */
	postDraw(graphic) {
		super.postDraw(graphic);
		this.drawScreenFade(graphic);
		if (this.#devtools !== null) {
			this.#devtools.draw(graphic);
		}
	}

	//==============================================================================
	// 어두워졌다 밝아지기.
	// - 다 어두워지면 onDark 를 부르고, 그것이 Promise 를 돌려주면 끝날 때까지(실패해도) 어둡게 두었다가 밝힌다.
	// - 막이 걸린 동안(어두워지고, 기다리고, 밝아지는 동안)은 누름과 휠을 받지 않는다.
	// - 이미 페이드 중이면 무시하고 false.
	//==============================================================================
	/**
	 * @param { Function | null } onDark () => void | Promise
	 * @returns { boolean } 시작했는지.
	 */
	fadeScreen(onDark) {
		if (this.isScreenFading()) {
			return false;
		}
		this.#screenFadeEvent = onDark;
		this.#screenFadeDirection = 1;
		return true;
	}

	//==============================================================================
	// 페이드 중인지. (어두워지거나, onDark 를 기다리거나, 밝아지는 중)
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isScreenFading() {
		return this.#screenFadeDirection !== 0 || this.#isScreenFadeWaiting || this.#screenFadeAlpha > 0;
	}

	//==============================================================================
	// 어두워지는 막의 색 설정. (기본 검정)
	//==============================================================================
	/**
	 * @param { Color } color
	 */
	setScreenFadeColor(color) {
		this.#screenFadeColor = color;
	}

	//==============================================================================
	// 어두워지는 시간과 밝아지는 시간 설정. (초, 기본 0.35, 0 이면 바로)
	//==============================================================================
	/**
	 * @param { number } seconds
	 */
	setScreenFadeSeconds(seconds) {
		this.#screenFadeSeconds = System.Math.max(0, seconds);
	}

	//==============================================================================
	// 어두워지는 막의 진하기. (0 ~ 1)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getScreenFadeAlpha() {
		return this.#screenFadeAlpha;
	}

	//==============================================================================
	// 막 갱신. (tick 이 부른다, 배율을 곱하지 않은 시간으로 움직여 놀이를 멈춰도 돈다, 한 프레임은 0.1 초까지)
	//==============================================================================
	updateScreenFade() {
		if (this.#screenFadeDirection === 0) {
			return;
		}
		const engine = this.getEngine();
		const timeManager = engine.getTimeManager();
		const unscaledTimeDelta = System.Math.min(timeManager.getUnscaleDeltaTime(), 0.1);
		const screenFadeSeconds = this.#screenFadeSeconds;
		const fadeStep = screenFadeSeconds > 0 ? unscaledTimeDelta / screenFadeSeconds : 1;
		if (this.#screenFadeDirection < 0) {
			this.#screenFadeAlpha = System.Math.max(0, this.#screenFadeAlpha - fadeStep);
			if (this.#screenFadeAlpha <= 0) {
				this.#screenFadeDirection = 0;
			}
			return;
		}
		this.#screenFadeAlpha = System.Math.min(1, this.#screenFadeAlpha + fadeStep);
		if (this.#screenFadeAlpha < 1) {
			return;
		}
		// 다 어두워졌다. 맡긴 일을 하는 동안은 막을 그대로 두고, 끝난 뒤에 밝아진다.
		this.#screenFadeDirection = 0;
		const screenFadeEvent = this.#screenFadeEvent;
		this.#screenFadeEvent = null;
		if (screenFadeEvent === null) {
			this.#screenFadeDirection = -1;
			return;
		}
		this.#isScreenFadeWaiting = true;
		const brighten = () => {
			this.#isScreenFadeWaiting = false;
			this.#screenFadeDirection = -1;
		};
		let result = null;
		try {
			result = screenFadeEvent();
		}
		catch (error) {
			console.error(error);
		}
		if (result && typeof result.then === "function") {
			result.then(brighten, (error) => {
				console.error(error);
				brighten();
			});
		}
		else {
			brighten();
		}
	}

	//==============================================================================
	// 어두워지는 막 그리기. (세이프에어리어까지 캔버스 전체를 덮는다)
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 */
	drawScreenFade(graphic) {
		const screenFadeAlpha = this.getScreenFadeAlpha();
		if (screenFadeAlpha <= 0) {
			return;
		}
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		const canvasNativeSize = viewManager.getCanvasNativeSize();
		const globalAlpha = graphic.getGlobalAlpha();
		viewManager.applyCanvasNativeRect(graphic);
		graphic.setGlobalAlpha(globalAlpha * screenFadeAlpha);
		graphic.setFillColor(this.#screenFadeColor);
		graphic.drawRect(Rect.create(0, 0, canvasNativeSize.x, canvasNativeSize.y));
		graphic.setGlobalAlpha(globalAlpha);
		viewManager.applyViewRect(graphic);
	}

	//==============================================================================
	// 그 자리에 UI(누를 수 있는 노드: 단추, 창의 어둠과 판, 스크롤 칸)가 있는지. (뷰 좌표)
	//==============================================================================
	/**
	 * @param { Vector2 } viewPosition
	 * @returns { boolean }
	 */
	isUserInterfaceAt(viewPosition) {
		if (!this.#touchRaycaster) {
			return false;
		}
		const hitNode = this.#touchRaycaster.raycast(viewPosition);
		return hitNode !== null && hitNode !== undefined;
	}

	//==============================================================================
	// 놀이 입력 처리기 설정. (UI 가 받지 않은 누름과 그 누름의 이동, 뗌(취소 포함), UI 밖의 휠을 게임 영역 좌표로 넘긴다, null 이면 넘기지 않는다)
	// - 게임 영역은 세이프에어리어 영역(getSafeAreaRect)이다. 좌표는 그 왼쪽 위가 0, 0 이다.
	// - 페이드 중에는 누름과 휠을 넘기지 않는다. 개발자 도구가 입력을 가져가면 넘기지 않는다.
	//==============================================================================
	/**
	 * @param { object | null } playInputHandler { press?(position), move?(position), release?(position), wheel?(position, wheelDelta) }
	 */
	setPlayInputHandler(playInputHandler) {
		this.#playInputHandler = playInputHandler;
		this.#isPlayPressActive = false;
	}

	//==============================================================================
	// 뷰 좌표 → 게임 영역 좌표. (세이프에어리어 왼쪽 위가 0, 0)
	//==============================================================================
	/**
	 * @param { Vector2 } viewPosition
	 * @returns { Vector2 }
	 */
	convertViewToPlayArea(viewPosition) {
		const safeAreaRect = this.getSafeAreaRect();
		if (!safeAreaRect) {
			return viewPosition.clone();
		}
		return Vector2.create(viewPosition.x - safeAreaRect.position.x, viewPosition.y - safeAreaRect.position.y);
	}

	//==============================================================================
	// 놀이 입력 넘기기. (kind 는 press, move, release, wheel, 처리기에 그 함수가 없으면 넘기지 않는다)
	//==============================================================================
	/**
	 * @param { string } kind
	 * @param { Vector2 } viewPosition
	 * @param { Vector2 | null } wheelDelta
	 */
	dispatchPlayInput(kind, viewPosition, wheelDelta) {
		const playInputHandler = this.#playInputHandler;
		if (playInputHandler === null || typeof playInputHandler[kind] !== "function") {
			return;
		}
		const playAreaPosition = this.convertViewToPlayArea(viewPosition);
		playInputHandler[kind](playAreaPosition, wheelDelta);
	}

	//==============================================================================
	// 놀이로 간 누름 끝내기. (뗌과 취소)
	//==============================================================================
	/**
	 * @param { Vector2 } viewPosition
	 */
	releasePlayPress(viewPosition) {
		if (!this.#isPlayPressActive) {
			return;
		}
		this.#isPlayPressActive = false;
		this.dispatchPlayInput("release", viewPosition, null);
	}

	//==============================================================================
	// 게임 영역 기준 설정. (세이프에어리어를 뺀 게임 영역의 고정 쪽 길이가 늘 fixedLength 가 되게 기준 해상도를 늘린다)
	// - 엔진은 캔버스 전체의 길이를 기준 해상도에 맞추는데 캔버스는 세이프에어리어까지 덮는다. 그만큼 기준 해상도를 늘린다.
	//   (캔버스 길이 : 세이프에어리어를 뺀 길이 = 기준 해상도 길이 : fixedLength)
	// - isLandscape 면 가로, 아니면 세로가 고정 쪽이다. 뷰 배율 방식도 그에 맞춰 둔다. (가로 고정 stretchWidthExpandHeight, 세로 고정 stretchHeightExpandWidth)
	// - 무시할 세이프에어리어 쪽은 ViewManager.setIgnoredSafeAreaSides 로 넘긴다. fixedLength 가 0 이면 끈다. (기준 해상도는 그대로 둔다)
	//==============================================================================
	/**
	 * @param { number } fixedLength
	 * @param { boolean } isLandscape
	 */
	setPlayAreaReference(fixedLength, isLandscape) {
		this.#playAreaFixedLength = System.Math.max(0, fixedLength);
		this.#isPlayAreaLandscape = isLandscape;
		if (this.#playAreaFixedLength <= 0) {
			return;
		}
		const viewScaleMode = isLandscape ? ViewScaleMode.stretchWidthExpandHeight : ViewScaleMode.stretchHeightExpandWidth;
		this.setViewScaleMode(viewScaleMode);
		this.applyPlayAreaReference();
	}

	//==============================================================================
	// 게임 영역의 고정 쪽 길이. (0 이면 쓰지 않음)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getPlayAreaFixedLength() {
		return this.#playAreaFixedLength;
	}

	//==============================================================================
	// 게임 영역 기준을 기준 해상도에 걸기. (캔버스와 인셋 크기에서만 셈해 몇 번을 불러도 같다, 같으면 건드리지 않는다)
	//==============================================================================
	applyPlayAreaReference() {
		const fixedLength = this.getPlayAreaFixedLength();
		const engine = this.getEngine();
		if (fixedLength <= 0 || !engine) {
			return;
		}
		const viewManager = engine.getViewManager();
		const canvasNativeSize = viewManager.getCanvasNativeSize();
		if (canvasNativeSize.x <= 0 || canvasNativeSize.y <= 0) {
			return;
		}
		// 인셋은 지금 배율로 나눈 뷰 좌표로 나온다. 배율을 곱해 캔버스 단위로 되돌린다.
		const safeAreaInsets = viewManager.getSafeAreaInsets();
		const targetResolutionScale = viewManager.getTargetResolutionScale();
		const insetScale = targetResolutionScale > 0 ? targetResolutionScale : 1;
		const isLandscape = this.#isPlayAreaLandscape;
		const referenceLength = GameScene.calculatePlayAreaReferenceLength(fixedLength, isLandscape, canvasNativeSize, safeAreaInsets, insetScale);
		if (referenceLength <= 0) {
			return;
		}
		const referenceResolutionSize = viewManager.getReferenceResolutionSize();
		const currentReferenceLength = isLandscape ? referenceResolutionSize.x : referenceResolutionSize.y;
		if (System.Math.abs(currentReferenceLength - referenceLength) < 0.0001) {
			return;
		}
		// 고정하는 쪽만 뷰 계산에 쓰인다. 다른 쪽에도 같은 값을 넣어 둔다. (엔진이 계속 들고 있는 값이라 새 벡터로)
		viewManager.applyReferenceResolutionSize(Vector2.create(referenceLength, referenceLength));
	}

	//==============================================================================
	// 게임 영역 기준의 기준 해상도 길이 셈. (못 셈하면 0)
	//==============================================================================
	/**
	 * @param { number } fixedLength
	 * @param { boolean } isLandscape
	 * @param { Vector2 } canvasNativeSize
	 * @param { object } safeAreaInsets { top, right, bottom, left } (뷰 좌표)
	 * @param { number } insetScale 뷰 좌표 → 캔버스 단위 배율.
	 * @returns { number }
	 */
	static calculatePlayAreaReferenceLength(fixedLength, isLandscape, canvasNativeSize, safeAreaInsets, insetScale) {
		const canvasLength = isLandscape ? canvasNativeSize.x : canvasNativeSize.y;
		const insetSum = isLandscape ? safeAreaInsets.left + safeAreaInsets.right : safeAreaInsets.top + safeAreaInsets.bottom;
		const safeAreaLength = canvasLength - insetSum * insetScale;
		if (safeAreaLength <= 0 || canvasLength <= 0) {
			return 0;
		}
		return fixedLength * canvasLength / safeAreaLength;
	}
}
