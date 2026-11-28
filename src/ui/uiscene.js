//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../base/vector2.js";
import { Rect } from "../base/rect.js";
import { Color } from "../base/color.js";
import { Engine } from "../core/engine.js";
import { Graphic } from "../core/graphic.js";
import { Scene } from "../core/scene.js";
import { ViewScaleMode } from "../core/viewmanager.js";
import { TransformNode } from "../core/node/transformnode.js";
import { TouchRecognizer } from "./touchrecognizer.js";
import { UINode } from "./uinode.js";
import { LayoutSolver } from "./autolayout/layoutsolver.js";
import { LayoutStrength } from "./autolayout/layoutstrength.js";
import { LayoutConstraint } from "./autolayout/layoutconstraint.js";
import { DevTools } from "../misc/devtools.js";
import { ImageAsset } from "../resource/imageasset.js";

//==============================================================================
// UI 씬.
// - Scene 을 직접 상속받는 독립 베이스 씬.
// - GameScene 과 동일한 공통 인프라 (개발자 도구 / 터치 라우팅 / 로딩 화면 /
//   env() safe-area 인셋 / viewSize 자동 감지 / 캔버스 배경 클리어) 를 자체 보유.
// - 자체 LayoutSolver 인스턴스를 보유. tick 마다 updateVariables 자동 호출.
// - 자체 화면 가이드 UINode (screenNode) 를 보유. 좌상단 (0, 0) 고정 + 너비/높이를
//   편집 변수로 등록해 resize 시 suggestValue 로 갱신한다.
//   (UIKit 의 UIWindow.bounds 와 같은 사상)
// - safeAreaLayoutGuide UINode 를 별도로 보유. screenNode 에서 safeAreaInsets 만큼
//   안쪽으로 들어간 영역을 표현. (UIKit 의 UIView.safeAreaLayoutGuide 와 동일 사상)
//   layout() 단계에서 env() 인셋이 자동으로 setSafeAreaInsets 에 반영된다.
// - 트리에 추가된 UINode 들은 tick 시 자동으로 솔버에 부착된다.
//==============================================================================
/**
 * @example <caption>세이프 에어리어 안쪽에 머리띠 붙이기</caption>
 * import { Engine, EngineConfiguration, UIScene, UINode, UILabel, Paint, Vector2, Color } from "./build/vanilla.js";
 *
 * class MainScene extends UIScene {
 * 	constructor() {
 * 		super();
 * 		this.setLoadingMinDurationMs(0);
 * 		this.setSceneBackgroundColor(new Color(0.08, 0.09, 0.12, 1));
 * 	}
 *
 * 	initialize(engine) {
 * 		super.initialize(engine);
 * 		const headerNode = new UINode();
 * 		headerNode.setName("header");
 * 		const paint = headerNode.addComponent(Paint);
 * 		paint.setColor(new Color(0.2, 0.45, 0.85, 1));
 * 		const label = headerNode.addComponent(UILabel);
 * 		label.setText("Header");
 * 		label.setFontSize(20);
 * 		const root = this.getRoot();
 * 		root.addChild(headerNode);
 *
 * 		const safeAreaGuide = this.getSafeAreaLayoutGuide();
 * 		const safeLeftAnchor = safeAreaGuide.leftAnchor;
 * 		const safeRightAnchor = safeAreaGuide.rightAnchor;
 * 		const safeTopAnchor = safeAreaGuide.topAnchor;
 * 		const headerLeftAnchor = headerNode.leftAnchor;
 * 		const headerRightAnchor = headerNode.rightAnchor;
 * 		const headerTopAnchor = headerNode.topAnchor;
 * 		const headerHeightAnchor = headerNode.heightAnchor;
 * 		const leftConstraint = headerLeftAnchor.equalTo(safeLeftAnchor.add(16));
 * 		const rightConstraint = headerRightAnchor.equalTo(safeRightAnchor.subtract(16));
 * 		const topConstraint = headerTopAnchor.equalTo(safeTopAnchor.add(16));
 * 		const heightConstraint = headerHeightAnchor.equalTo(56);
 * 		headerNode.addConstraint(leftConstraint);
 * 		headerNode.addConstraint(rightConstraint);
 * 		headerNode.addConstraint(topConstraint);
 * 		headerNode.addConstraint(heightConstraint);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * engineConfiguration.canvasId = "mainCanvas";
 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
 * engineConfiguration.autoResizeOnWindowResize = true;
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
export class UIScene extends Scene {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { DevTools | null } */ #devtools; // EngineConfiguration.useDevTools 가 꺼져 있으면 null.
	/** @private @type { TouchRecognizer } */ #touchRaycaster;
	/** @private @type { number } */ #lastViewSizeX;
	/** @private @type { number } */ #lastViewSizeY;
	/** @private @type { ImageAsset | null } */ #loadingImageAsset;
	/** @private @type { string } */ #loadingImageUrl;
	/** @private @type { number } */ #loadStartTime;
	/** @private @type { number } */ #loadMinDurationMs;
	/** @private @type { boolean } */ #loadTouchedToSkip;
	/** @private @type { string } */ #viewScaleMode;
	/** @private @type { LayoutSolver } */ #solver;
	/** @private @type { UINode } */ #screenNode;
	/** @private @type { UINode } */ #safeAreaLayoutGuide;
	/** @private @type { { top: number, left: number, bottom: number, right: number } } */ #safeAreaInsets;
	/** @private @type { LayoutConstraint[] } */ #safeAreaLayoutGuideConstraints;

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
		this.#viewScaleMode = ViewScaleMode.none;
	}

	//==============================================================================
	// ViewScaleMode 설정. 프로젝트별로 자유롭게 지정 가능.
	// - 디폴트는 ViewScaleMode.none. 엔진 기동 전 / 후 어디서든 호출 가능.
	// - 호출 시점에 엔진이 이미 attach 되어 있으면 즉시 viewManager 에 반영하고,
	//   아니면 initialize() 에서 일괄 적용된다.
	//==============================================================================
	/**
	 * @param { string } viewScaleMode 뷰 배율 모드. (ViewScaleMode 의 값, 기본 ViewScaleMode.none)
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
	 * @returns { string } 지금 뷰 배율 모드. (ViewScaleMode 의 값)
	 */
	getViewScaleMode() {
		return this.#viewScaleMode;
	}

	//==============================================================================
	// 로딩 화면 중앙 이미지 URL 설정. (빈 문자열이면 이미지 없이 게이지만 노출)
	//==============================================================================
	/**
	 * @param { string } url 로딩 화면 가운데에 그릴 그림 주소. (null 이나 빈 글이면 그림 없이 게이지만 그린다)
	 */
	setLoadingImageUrl(url) {
		this.#loadingImageUrl = url || "";
	}

	//==============================================================================
	// 로딩 화면 최소 노출 시간 (ms) 설정.
	//==============================================================================
	/**
	 * @param { number } milliseconds 로딩 화면을 보여 줄 가장 짧은 시간. (밀리초, 기본 3000, 화면을 누르면 바로 넘긴다)
	 * @example <caption>로딩 화면을 띄우고 애셋 읽기</caption>
	 * import { Engine, EngineConfiguration, UIScene, ImageAsset, Vector2 } from "./build/vanilla.js";
	 *
	 * class MainScene extends UIScene {
	 * 	constructor() {
	 * 		super();
	 * 		this.setLoadingImageUrl("assets/icons/icon.png");
	 * 		this.setLoadingMinDurationMs(500);
	 * 		this.imageAsset = null;
	 * 	}
	 *
	 * 	async loadAssets() {
	 * 		await super.loadAssets();
	 * 		const imageAsset = new ImageAsset();
	 * 		await imageAsset.load("examples/assets/spritesheet.png");
	 * 		this.imageAsset = imageAsset;
	 * 	}
	 *
	 * 	initialize(engine) {
	 * 		super.initialize(engine);
	 * 		console.log("loaded", this.imageAsset.isLoaded());
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.canvasId = "mainCanvas";
	 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
	 * engineConfiguration.autoResizeOnWindowResize = true;
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	setLoadingMinDurationMs(milliseconds) {
		this.#loadMinDurationMs = milliseconds;
	}

	//==============================================================================
	// 생성. 솔버 / screenNode / safeAreaLayoutGuide 셋업.
	//==============================================================================
	/**
	 * @override
	 */
	create() {
		super.create();

		this.#solver = new LayoutSolver();
		this.#screenNode = new UINode();
		this.#screenNode.setName("screen");
		this.#screenNode.setSolver(this.#solver);

		// 좌상단 (0, 0) 고정.
		const screenLeftAnchor = this.#screenNode.leftAnchor;
		const screenLeftConstraint = screenLeftAnchor.equalTo(0);
		this.#screenNode.addConstraint(screenLeftConstraint);
		const screenTopAnchor = this.#screenNode.topAnchor;
		const screenTopConstraint = screenTopAnchor.equalTo(0);
		this.#screenNode.addConstraint(screenTopConstraint);

		// 너비/높이는 편집 변수로 등록 (resize 마다 suggestValue 로 갱신).
		const screenWidthVariable = this.#screenNode.getWidthVariable();
		const screenHeightVariable = this.#screenNode.getHeightVariable();
		this.#solver.addEditVariable(screenWidthVariable, LayoutStrength.strong);
		this.#solver.addEditVariable(screenHeightVariable, LayoutStrength.strong);

		// safeAreaLayoutGuide 초기 셋업. 기본 insets 0 (= screen 과 동일 영역).
		this.#safeAreaInsets = { top: 0, left: 0, bottom: 0, right: 0 };
		this.#safeAreaLayoutGuide = new UINode();
		this.#safeAreaLayoutGuide.setName("safeArea");
		this.#safeAreaLayoutGuide.setSolver(this.#solver);
		this.#safeAreaLayoutGuideConstraints = [];
		this.rebuildSafeAreaLayoutGuideConstraints();
	}

	//==============================================================================
	// 비동기 로드.
	// - 자체 자산을 로드 (loadAssets) 한 뒤 최소 노출 시간을 보장한다.
	// - 화면 터치 시 즉시 단축. drawOnLoad 단계에서는 씬의 touchPress 가
	//   호출된다는 보장이 없어 window 이벤트로 직접 캡처.
	// - 로드 완료 후 viewSize 를 솔버에 즉시 반영한다.
	//==============================================================================
	/**
	 * @override
	 * @param { Engine } engine 엔진.
	 */
	async load(engine) {
		await super.load(engine);

		this.#loadStartTime = System.Date.now();
		this.#loadTouchedToSkip = false;

		const skipHandler = () => {
			this.#loadTouchedToSkip = true;
		};
		System.window.addEventListener("pointerdown", skipHandler, { once: true });

		// 찍기 모드는 최소 노출 시간을 엔진 시계(프레임마다 1/60 초)로 엔진 프레임마다 센다. (실제 시각으로 세면 씬이 처음 그려지는 프레임이 실행마다 밀린다)
		const isCaptureTimeStepFixed = engine.isCaptureTimeStepFixed();
		const timeManager = engine.getTimeManager();
		const captureLoadStartTime = timeManager.getRealtimeSinceStartup();

		try {
			await this.loadAssets();
			// 애셋을 다 받았으니 찍기 모드의 프레임 세우기를 푼다. (아래 최소 노출 시간은 엔진 시계로 센다)
			this.setCaptureFrameHeld(false);
			if (isCaptureTimeStepFixed) {
				while ((timeManager.getRealtimeSinceStartup() - captureLoadStartTime) * 1000 < this.#loadMinDurationMs && !this.#loadTouchedToSkip) {
					await engine.waitForNextEngineFrame();
				}
			}
			else {
				while (System.Date.now() - this.#loadStartTime < this.#loadMinDurationMs && !this.#loadTouchedToSkip) {
					await new Promise((resolve) => System.setTimeout(resolve, 50));
				}
			}
		}
		finally {
			System.window.removeEventListener("pointerdown", skipHandler);
		}

		const viewManager = engine.getViewManager();
		const viewSize = viewManager.getViewSize();
		this.suggestScreenSize(viewSize);
		this.#solver.updateVariables();
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
				console.error("[UIScene] 로딩 이미지 로드 실패:", error);
			}
		}
	}

	//==============================================================================
	// 로딩 화면 출력. (엔진이 isLoaded() === false 인 동안 매 프레임 호출)
	// - 검은 배경 + 중앙 로딩 이미지 + 하단 게이지.
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic 그래픽.
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

		// 캔버스 전체 검은색.
		viewManager.applyCanvasNativeRect(graphic);
		graphic.setFillColor(Color.black());
		graphic.drawRect(Rect.create(0, 0, canvasNativeSize.x, canvasNativeSize.y));

		// 뷰 좌표계 적용.
		viewManager.applyViewRect(graphic);
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
			graphic.drawImage(image, Vector2.create(positionX, positionY), Vector2.create(targetWidth, targetHeight));
		}

		// 하단 로딩 게이지.
		const elapsed = System.Date.now() - this.#loadStartTime;
		const progress = System.Math.min(1, System.Math.max(0, elapsed / this.#loadMinDurationMs));
		const barWidth = viewSize.x * 0.6;
		const barHeight = 24;
		const barX = (viewSize.x - barWidth) * 0.5;
		const barY = viewSize.y * 0.78;
		graphic.setFillColor("#333333");
		graphic.drawRect(Rect.create(barX, barY, barWidth, barHeight));
		graphic.setFillColor("#ffffff");
		graphic.drawRect(Rect.create(barX, barY, barWidth * progress, barHeight));
	}

	//==============================================================================
	// 초기화. 개발자 도구 + 터치 레이캐스터 셋업.
	//==============================================================================
	/**
	 * @override
	 * @param { Engine } engine 엔진.
	 */
	initialize(engine) {
		super.initialize(engine);

		// ViewScaleMode 적용.
		engine.getViewManager().setViewScaleMode(this.#viewScaleMode);

		// 개발자 도구. (EngineConfiguration.useDevTools 가 꺼져 있으면 만들지 않는다, GameScene 과 같음)
		this.#devtools = null;
		const engineConfiguration = engine.getEngineConfiguration();
		if (engineConfiguration.useDevTools !== false) {
			this.#devtools = new DevTools();
			this.#devtools.setEngine(engine);
			this.#devtools.setRootNodes([this.getRoot()]);
		}

		this.#touchRaycaster = new TouchRecognizer();
		this.#touchRaycaster.setRootNode(this.getRoot());
		// 씬 기본 넘기기는 끈다. (터치 훅에서 이 TouchRecognizer 로 넘긴다, 개발자 도구가 입력을 가져가면 넘기지 않아서, 두 번 넘기지 않게)
		this.setTouchRaycaster(null);

		this.#lastViewSizeX = 0;
		this.#lastViewSizeY = 0;
	}

	//==============================================================================
	// 화면 크기 변경됨.
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } canvasNativeSize 캔버스의 실제 픽셀 크기.
	 */
	resize(canvasNativeSize) {
		super.resize(canvasNativeSize);
		this.layout();
	}

	//==============================================================================
	// 레이아웃.
	// - viewSize 를 솔버에 suggest 하고, 뷰 매니저의 세이프 에어리어 인셋을 자체 safeAreaInsets 에 동기화.
	// - 변화가 있을 때만 setSafeAreaInsets 호출 (제약 재구축 비용 절감).
	//==============================================================================
	layout() {
		const engine = this.getEngine();
		if (!engine) {
			return;
		}
		const viewManager = engine.getViewManager();
		const viewSize = viewManager.getViewSize();
		this.suggestScreenSize(viewSize);

		const safeAreaRect = this.computeSafeAreaRect();
		const insetTop = safeAreaRect.position.y;
		const insetLeft = safeAreaRect.position.x;
		const insetRight = System.Math.max(viewSize.x - (safeAreaRect.position.x + safeAreaRect.size.x), 0);
		const insetBottom = System.Math.max(viewSize.y - (safeAreaRect.position.y + safeAreaRect.size.y), 0);
		const previousInsets = this.#safeAreaInsets;
		if (previousInsets.top !== insetTop || previousInsets.left !== insetLeft || previousInsets.right !== insetRight || previousInsets.bottom !== insetBottom) {
			this.setSafeAreaInsets({
				top: insetTop,
				left: insetLeft,
				right: insetRight,
				bottom: insetBottom,
			});
		}
		this.#solver.updateVariables();
	}

	//==============================================================================
	// 세이프 에어리어 영역 계산. (뷰 좌표계)
	// - 뷰 매니저의 getSafeAreaInsets 를 따른다. (setSafeAreaOverride > URL ?safeArea= > env() 실측, setIgnoredSafeAreaSides 로 뺀 쪽은 0)
	//==============================================================================
	/**
	 * @returns { Rect } 세이프 에어리어 영역. (뷰 좌표, 너비와 높이는 0 이상)
	 * @example <caption>데스크톱에서 노치를 흉내 내 세이프 에어리어를 읽기</caption>
	 * import { Engine, EngineConfiguration, UIScene, Vector2 } from "./build/vanilla.js";
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
	 * const engine = new Engine(engineConfiguration);
	 * engine.getViewManager().setSafeAreaOverride({ top: 40, right: 0, bottom: 20, left: 10 });
	 * class MainScene extends UIScene {
	 * 	initialize() {
	 * 		super.initialize();
	 * 		const safeAreaRect = this.computeSafeAreaRect();
	 * 		console.log(safeAreaRect.position.x, safeAreaRect.position.y, safeAreaRect.size.x, safeAreaRect.size.y);
	 * 	}
	 * }
	 * engine.run(new MainScene());
	 */
	computeSafeAreaRect() {
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		const viewSize = viewManager.getViewSize();
		const safeAreaInsets = viewManager.getSafeAreaInsets();
		const x = safeAreaInsets.left;
		const y = safeAreaInsets.top;
		const width = System.Math.max(viewSize.x - safeAreaInsets.left - safeAreaInsets.right, 0);
		const height = System.Math.max(viewSize.y - safeAreaInsets.top - safeAreaInsets.bottom, 0);
		return Rect.create(x, y, width, height);
	}

	//==============================================================================
	// 주기적 갱신.
	// - viewSize 변화 감지 → layout 자동 호출.
	//   (모바일 주소창 토글로 100vh 가 동적으로 변하는 경우 등에서 resize 이벤트만으론
	//    누락될 수 있어 매 tick 보정.)
	// - 트리 내 새로 추가된 UINode 들을 솔버에 자동 부착 후 솔버 한 번 풀이.
	// - DevTools tick.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
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

		const root = this.getRoot();
		this.attachPendingUINodes(root);
		this.#solver.updateVariables();

		const timeManager = engine.getTimeManager();
		const unscaledTimeDelta = timeManager.getUnscaleDeltaTime();
		if (this.#devtools !== null && this.#devtools !== undefined) {
			this.#devtools.tick(unscaledTimeDelta);
		}
	}

	//==============================================================================
	// 트리를 순회하며 솔버가 부착되지 않은 UINode 들을 본 씬의 솔버에 부착.
	//==============================================================================
	/**
	 * @param { TransformNode } node 훑기 시작할 노드. (null 이나 undefined 면 아무것도 하지 않는다)
	 */
	attachPendingUINodes(node) {
		if (node === null || node === undefined) {
			return;
		}
		if (node instanceof UINode) {
			const currentSolver = node.getSolver();
			if (currentSolver === null) {
				node.setSolver(this.#solver);
			}
		}
		const children = node.getChildren();
		for (const child of children) {
			this.attachPendingUINodes(child);
		}
	}

	//==============================================================================
	// 화면 가이드 UINode 의 너비/높이 값 제안.
	//==============================================================================
	/**
	 * @param { Vector2 } size 화면 가이드에 줄 너비와 높이. (뷰 단위)
	 */
	suggestScreenSize(size) {
		const screenWidthVariable = this.#screenNode.getWidthVariable();
		const screenHeightVariable = this.#screenNode.getHeightVariable();
		this.#solver.suggestValue(screenWidthVariable, size.x);
		this.#solver.suggestValue(screenHeightVariable, size.y);
	}

	//==============================================================================
	// safeAreaInsets 반환. (UIKit 의 UIView.safeAreaInsets)
	//==============================================================================
	/**
	 * @returns { { top: number, left: number, bottom: number, right: number } } 지금 세이프 에어리어 인셋의 사본. (뷰 단위)
	 */
	getSafeAreaInsets() {
		const safeAreaInsets = this.#safeAreaInsets;
		return {
			top: safeAreaInsets.top,
			left: safeAreaInsets.left,
			bottom: safeAreaInsets.bottom,
			right: safeAreaInsets.right,
		};
	}

	//==============================================================================
	// safeAreaInsets 설정. (모바일 노치 / 홈 인디케이터 회피용 영역 정의)
	// - safeAreaLayoutGuide 의 4 개 제약을 즉시 갱신한다.
	//==============================================================================
	/**
	 * @param { { top: number, left: number, bottom: number, right: number } } insets 위, 왼쪽, 아래, 오른쪽 인셋. (뷰 단위)
	 */
	setSafeAreaInsets(insets) {
		this.#safeAreaInsets = {
			top: insets.top,
			left: insets.left,
			bottom: insets.bottom,
			right: insets.right,
		};
		this.rebuildSafeAreaLayoutGuideConstraints();
	}

	//==============================================================================
	// safeAreaLayoutGuide 의 4 개 제약 재구축.
	// - 기존 제약을 솔버에서 제거하고 현재 #safeAreaInsets 로 다시 구축 후 재등록.
	//==============================================================================
	rebuildSafeAreaLayoutGuideConstraints() {
		const guide = this.#safeAreaLayoutGuide;
		const screen = this.#screenNode;
		const solver = this.#solver;
		for (const constraint of this.#safeAreaLayoutGuideConstraints) {
			if (solver.hasConstraint(constraint)) {
				solver.removeConstraint(constraint);
			}
		}
		const insets = this.#safeAreaInsets;

		const screenLeftAnchor = screen.leftAnchor;
		const leftOffsetExpression = screenLeftAnchor.add(insets.left);
		const guideLeftAnchor = guide.leftAnchor;
		const guideLeftConstraint = guideLeftAnchor.equalTo(leftOffsetExpression);

		const screenTopAnchor = screen.topAnchor;
		const topOffsetExpression = screenTopAnchor.add(insets.top);
		const guideTopAnchor = guide.topAnchor;
		const guideTopConstraint = guideTopAnchor.equalTo(topOffsetExpression);

		const screenRightAnchor = screen.rightAnchor;
		const rightOffsetExpression = screenRightAnchor.subtract(insets.right);
		const guideRightAnchor = guide.rightAnchor;
		const guideRightConstraint = guideRightAnchor.equalTo(rightOffsetExpression);

		const screenBottomAnchor = screen.bottomAnchor;
		const bottomOffsetExpression = screenBottomAnchor.subtract(insets.bottom);
		const guideBottomAnchor = guide.bottomAnchor;
		const guideBottomConstraint = guideBottomAnchor.equalTo(bottomOffsetExpression);

		this.#safeAreaLayoutGuideConstraints = [guideLeftConstraint, guideTopConstraint, guideRightConstraint, guideBottomConstraint];
		for (const constraint of this.#safeAreaLayoutGuideConstraints) {
			solver.addConstraint(constraint);
		}
	}

	//==============================================================================
	// 개발자 도구 반환. (initialize 전이거나 EngineConfiguration.useDevTools 가 꺼져 있으면 null)
	//==============================================================================
	/**
	 * @returns { DevTools | null } 개발자 도구. (만들지 않았으면 null)
	 * @example <caption>개발자 도구를 끈 엔진에서는 null</caption>
	 * import { Engine, EngineConfiguration, UIScene, Vector2 } from "./build/vanilla.js";
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
	 * engineConfiguration.useDevTools = false;
	 * const engine = new Engine(engineConfiguration);
	 * class MainScene extends UIScene {
	 * 	initialize() {
	 * 		super.initialize();
	 * 		console.log(this.getDevTools() === null);
	 * 	}
	 * }
	 * engine.run(new MainScene());
	 */
	getDevTools() {
		return this.#devtools ?? null;
	}

	//==============================================================================
	// 디브툴이 입력을 가져가는 중인지 여부.
	//==============================================================================
	/**
	 * @returns { boolean } 개발자 도구 패널이 보이고 포인터가 그 위에 있으면 참.
	 */
	isDevToolsCapturingInput() {
		if (this.#devtools === null || this.#devtools === undefined) {
			return false;
		}
		return this.#devtools.isVisible() && this.#devtools.isPointerInsidePanel();
	}

	//==============================================================================
	// 터치 레이캐스터 반환. (터치 훅에서 노드로 넘기는 TouchRecognizer, 씬 기본 넘기기는 끄고 이것으로 넘긴다)
	//==============================================================================
	/**
	 * @override
	 * @returns { TouchRecognizer } 터치 훅이 넘기는 TouchRecognizer. (initialize 전에는 undefined)
	 */
	getTouchRaycaster() {
		return this.#touchRaycaster;
	}

	//==============================================================================
	// touchPress.
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } viewInputPosition 누른 자리. (뷰 좌표)
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
	 * @param { Vector2 } viewInputPosition 옮긴 자리. (뷰 좌표)
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
	 * @param { Vector2 } viewInputPosition 뗀 자리. (뷰 좌표)
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
	 * @param { Vector2 } viewInputPosition 취소된 때의 자리. (뷰 좌표)
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
	 * @param { Vector2 } viewInputPosition 휠을 굴린 자리. (뷰 좌표)
	 * @param { Vector2 } wheelDelta 이번 프레임에 쌓인 휠 양. (WheelEvent 의 deltaX, deltaY)
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
	 * @param { Graphic } graphic 그래픽.
	 */
	preDraw(graphic) {
		super.preDraw(graphic);
		this.drawSceneBackground(graphic);
	}

	//==============================================================================
	// postDraw. DevTools 를 화면 위에 그린다.
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic 그래픽.
	 */
	postDraw(graphic) {
		super.postDraw(graphic);
		if (this.#devtools !== null && this.#devtools !== undefined) {
			this.#devtools.draw(graphic);
		}
	}

	//==============================================================================
	// 솔버 반환.
	//==============================================================================
	/**
	 * @returns { LayoutSolver } 이 씬의 레이아웃 솔버. (create 전이면 undefined)
	 */
	getSolver() {
		return this.#solver;
	}

	//==============================================================================
	// 화면 가이드 UINode 반환.
	// - 트리에는 들어가지 않는 가이드 노드. left/top 은 0 고정, width/height 는
	//   현재 viewSize 와 동기화된 편집 변수.
	// - 사용자가 자기 UINode 의 제약을 화면 기준으로 작성할 때 앵커 소스로 사용.
	//==============================================================================
	/**
	 * @returns { UINode } 화면 가이드 UINode.
	 */
	getScreenNode() {
		return this.#screenNode;
	}

	//==============================================================================
	// safeAreaLayoutGuide 반환. (UIKit 의 UIView.safeAreaLayoutGuide 와 동일 사상)
	// - screenNode 에서 safeAreaInsets 만큼 안쪽으로 들어간 가이드 UINode.
	// - 사용자가 자기 UINode 의 제약을 safeArea 기준으로 작성할 때 앵커 소스로 사용.
	//==============================================================================
	/**
	 * @returns { UINode } 세이프 에어리어 가이드 UINode.
	 */
	getSafeAreaLayoutGuide() {
		return this.#safeAreaLayoutGuide;
	}
}
