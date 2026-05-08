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
import { TransformNode } from "../core/node/transformnode.js";
import { TouchRecognizer } from "./touchrecognizer.js";
import { UINode } from "./uinode.js";
import { LayoutSolver } from "./autolayout/layoutsolver.js";
import { LayoutStrength } from "./autolayout/layoutstrength.js";
import { LayoutConstraint } from "./autolayout/layoutconstraint.js";
import { DEVTools } from "../misc/devtools.js";
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
export class UIScene extends Scene {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { DEVTools } */ #devtools;
	/** @private @type { TouchRecognizer } */ #touchRaycaster;
	/** @private @type { number } */ #lastViewSizeX;
	/** @private @type { number } */ #lastViewSizeY;
	/** @private @type { ImageAsset | null } */ #loadingImageAsset;
	/** @private @type { string } */ #loadingImageUrl;
	/** @private @type { number } */ #loadStartTime;
	/** @private @type { number } */ #loadMinDurationMs;
	/** @private @type { boolean } */ #loadTouchedToSkip;
	/** @private @type { Color } */ #sceneBackgroundColor;
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
		const screenLeftConstraint = this.#screenNode.leftAnchor().equalTo(0);
		const screenTopConstraint = this.#screenNode.topAnchor().equalTo(0);
		this.#screenNode.addConstraint(screenLeftConstraint);
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
	// 초기화. 개발자 도구 + 터치 레이캐스터 셋업.
	//==============================================================================
	/**
	 * @override
	 * @param { Engine } engine
	 */
	initialize(engine) {
		super.initialize(engine);

		this.#devtools = new DEVTools();
		this.#devtools.setEngine(engine);
		this.#devtools.setRootNodes([this.getRoot()]);

		this.#touchRaycaster = new TouchRecognizer();
		this.#touchRaycaster.setRootNode(this.getRoot());

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
	// - viewSize 를 솔버에 suggest 하고, env() 인셋을 자체 safeAreaInsets 에 동기화.
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
	// env(safe-area-inset-*) 기준 영역 계산. (뷰 좌표계)
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
	// 주기적 갱신.
	// - viewSize 변화 감지 → layout 자동 호출.
	//   (모바일 주소창 토글로 100vh 가 동적으로 변하는 경우 등에서 resize 이벤트만으론
	//    누락될 수 있어 매 tick 보정.)
	// - 트리 내 새로 추가된 UINode 들을 솔버에 자동 부착 후 솔버 한 번 풀이.
	// - DEVTools tick.
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

		const root = this.getRoot();
		this.attachPendingUINodes(root);
		this.#solver.updateVariables();

		const timeManager = engine.getTimeManager();
		const unscaledTimeDelta = timeManager.getUnscaleDeltaTime();
		this.#devtools.tick(unscaledTimeDelta);
	}


	//==============================================================================
	// 트리를 순회하며 솔버가 부착되지 않은 UINode 들을 본 씬의 솔버에 부착.
	//==============================================================================
	/**
	 * @param { TransformNode } node
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
	 * @param { Vector2 } size
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
	 * @returns { { top: number, left: number, bottom: number, right: number } }
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
	 * @param { { top: number, left: number, bottom: number, right: number } } insets
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
		const guideLeftConstraint = guide.leftAnchor().equalTo(screen.leftAnchor().add(insets.left));
		const guideTopConstraint = guide.topAnchor().equalTo(screen.topAnchor().add(insets.top));
		const guideRightConstraint = guide.rightAnchor().equalTo(screen.rightAnchor().subtract(insets.right));
		const guideBottomConstraint = guide.bottomAnchor().equalTo(screen.bottomAnchor().subtract(insets.bottom));
		this.#safeAreaLayoutGuideConstraints = [guideLeftConstraint, guideTopConstraint, guideRightConstraint, guideBottomConstraint];
		for (const constraint of this.#safeAreaLayoutGuideConstraints) {
			solver.addConstraint(constraint);
		}
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


	//==============================================================================
	// 솔버 반환.
	//==============================================================================
	/**
	 * @returns { LayoutSolver }
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
	 * @returns { UINode }
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
	 * @returns { UINode }
	 */
	getSafeAreaLayoutGuide() {
		return this.#safeAreaLayoutGuide;
	}
}
