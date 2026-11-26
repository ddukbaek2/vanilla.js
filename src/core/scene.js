//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Object } from "../base/object.js";
import { Pivot } from "../base/pivot.js";
import { Vector2 } from "../base/vector2.js";
import { Engine } from "./engine.js";
import { Graphic } from "./graphic.js";
import { WorldNode } from "./node/worldnode.js";
import { TouchRaycaster } from "./touchraycaster.js";
import { Tween } from "./tween.js";


//==============================================================================
// 씬.
// - new() ==> create() ==> async load(engine) ==> initialize(engine)
// - finalize(engine) ==> async unload(engine) ==> destroy()
// - resize(canvasNativeSize)
// - tick(timeDelta)
// - preDraw(graphic) ==> draw(graphic) ==> postDraw(graphic)
// - touchPress(viewInputPosition) ==> touchMove(viewInputPosition) ==> touchRelease(viewInputPosition)
// - reset()
// - 터치는 씬 꼴과 상관없이 노드의 위젯이 받는다. tickTouch 가 씬의 터치 레이캐스터(처음은 TouchRaycaster, setTouchRaycaster 로 바꾼다)로
//   가장 앞의 누를 수 있는 노드에 먼저 넘기고, 그 뒤에 씬의 터치 훅을 부른다. (유니티 EventSystem 처럼, 러스트 판 SceneBase.tick 과 같다)
//==============================================================================
/**
 * @example <caption>불러오고, 갱신하고, 그리고, 누름 받기</caption>
 * import { Engine, EngineConfiguration, Scene, Vector2, Rect, Colors } from "./build/vanilla.js";
 *
 * class MainScene extends Scene {
 * 	async load(engine) {
 * 		await super.load(engine);
 * 		this.boxPosition = Vector2.create(100, 100);
 * 	}
 *
 * 	initialize(engine) {
 * 		console.log("initialized");
 * 	}
 *
 * 	tick(timeDelta) {
 * 		super.tick(timeDelta);
 * 		this.boxPosition.x += 60 * timeDelta;
 * 	}
 *
 * 	draw(graphic) {
 * 		super.draw(graphic);
 * 		graphic.setFillColor(Colors.white);
 * 		graphic.drawRect(Rect.create(this.boxPosition.x, this.boxPosition.y, 80, 80));
 * 	}
 *
 * 	touchPress(viewInputPosition) {
 * 		this.boxPosition = viewInputPosition.clone();
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
export class Scene extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Engine } */ #engine;
	/** @private @type { WorldNode } */ #root;
	/** @private @type { VTweeneen[] } */ #tweens;
	/** @private @type { boolean } */ #isGizmoVisible; // 기즈모 출력 여부.
	/** @private @type { boolean } */ #isLoaded; // 비동기 로딩 완료 여부.
	/** @private @type { TouchRaycaster | null } */ #touchRaycaster; // 노드에 터치를 넘기는 레이캐스터. (null 이면 넘기지 않는다)

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		// this.#root = new WorldNode();
	}
	
	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @virtual
	 */
	create() {
		this.#tweens = [];
		this.#isGizmoVisible = false;
		this.#isLoaded = false;
		this.#root = new WorldNode();
		const root = this.getRoot();
		root.setName("root");
		this.#touchRaycaster = new TouchRaycaster();
		this.#touchRaycaster.setRootNode(root);
	}

	//==============================================================================
	// 엔진 설정. (SceneManager가 load() 이전에 호출하여 drawOnLoad에서 접근 가능하게 함)
	//==============================================================================
	/**
	 * @param { Engine } engine 이 씬을 불러온 엔진.
	 */
	setEngine(engine) {
		this.#engine = engine;
	}

	//==============================================================================
	// 로딩 완료 여부 설정. (SceneManager가 load+initialize 이후 true로 전환)
	//==============================================================================
	/**
	 * @param { boolean } isLoaded 불러오기를 마쳤는지.
	 */
	setLoaded(isLoaded) {
		this.#isLoaded = isLoaded;
	}

	//==============================================================================
	// 로딩 완료 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 불러오기를 마쳤으면 참. (initialize 바로 앞에 참이 된다)
	 */
	isLoaded() {
		return this.#isLoaded;
	}

	//==============================================================================
	// 로딩 중 출력. (비동기 load() 진행 중에만 호출되며, 씬의 일반 tick/draw는 호출되지 않음)
	//==============================================================================
	/**
	 * @virtual
	 * @param { Graphic } graphic 그릴 그래픽.
	 * @example <caption>불러오는 동안 글 띄우기</caption>
	 * import { Engine, EngineConfiguration, Scene, Colors } from "./build/vanilla.js";
	 *
	 * class MainScene extends Scene {
	 * 	async load(engine) {
	 * 		await super.load(engine);
	 * 		await new Promise((resolve) => {
	 * 			setTimeout(resolve, 500);
	 * 		});
	 * 	}
	 *
	 * 	drawOnLoad(graphic) {
	 * 		graphic.setFillColor(Colors.white);
	 * 		graphic.setFontString("24px sans-serif");
	 * 		graphic.drawFillText("Loading", 40, 40);
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	drawOnLoad(graphic) {

	}

	//==============================================================================
	// 파괴.
	//==============================================================================
	/**
	 * @override
	 */
	destroy() {
		super.destroy();
	}

	//==============================================================================
	// 비동기 로딩.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Engine } engine 씬을 불러오는 엔진.
	 */
	async load(engine) {
		this.#engine = engine;
		await Promise.resolve();

		const viewManager = engine.getViewManager();
		const viewSize = viewManager.getViewSize();
		const root = this.getRoot();
		root.setPosition(Vector2.zero());
		root.setPivot(Pivot.topLeft);
		root.setContentSize(viewSize);
	}

	//==============================================================================
	// 초기화.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Engine } engine 씬을 불러온 엔진.
	 */
	initialize(engine) {

	}

	//==============================================================================
	// 종료처리.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Engine } engine 씬을 내리는 엔진.
	 */
	finalize(engine) {

	}

	//==============================================================================
	// 페이지 프로세스 파기 후 복원 감지 (freeze/resume, bfcache 복원 등).
	// 엔진이 브라우저 이벤트를 감지하여 로드된 모든 씬에 호출한다.
	//==============================================================================
	/**
	 * @virtual
	 */
	onPageProcessRestored() {

	}

	//==============================================================================
	// 페이지 가시성 복원 감지 (백그라운드 → 포어그라운드).
	// 엔진이 visibilitychange 이벤트를 감지하여 로드된 모든 씬에 호출한다.
	//==============================================================================
	/**
	 * @virtual
	 */
	onPageVisibilityRestored() {

	}

	//==============================================================================
	// 비동기 로딩 해제.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Engine } engine 씬을 내리는 엔진.
	 */
	async unload(engine) {
		await Promise.resolve();
	}

	//==============================================================================
	// 화면 크기 변경됨.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } canvasNativeSize 바뀐 캔버스 요소의 크기. (CSS 픽셀)
	 */
	resize(canvasNativeSize) {

		// 갱신.
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		const viewSize = viewManager.getViewSize();
		const root = this.getRoot();
		root.setPosition(Vector2.zero());
		root.setPivot(Pivot.topLeft);
		root.setContentSize(viewSize);
	}

	//==============================================================================
	// 주기적 갱신.
	//==============================================================================
	/**
	 * @virtual
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 */
	tick(timeDelta) {
		// 노드 갱신.
		try {
			const root = this.getRoot();
			if (root.isActive()) {
				root.tick(timeDelta);
			}
		}
		catch (error) {
			console.error(error);
		}

		// 터치 갱신.
		try {
			this.tickTouch(timeDelta);
		}
		catch (error) {
			console.error(error);
		}

		// 트윈 목록 갱신.
		for (let i = this.#tweens.length - 1; i >= 0; --i) {
			const tween = this.#tweens[i];
			try {
				if (tween) {
					tween.tick(timeDelta);
					if (tween.isFinished()) {
						this.#tweens.splice(i, 1);
					}
				}
				else {
					this.#tweens.splice(i, 1);
					continue;
				}
			}
			catch (error) {
				console.error(error);
			}
		}
	}

	//==============================================================================
	// 이전 출력.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Graphic } graphic 그릴 그래픽.
	 */
	preDraw(graphic) {
		// 코드.
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Graphic } graphic 그릴 그래픽.
	 */
	draw(graphic) {
		// 노드 출력.
		const root = this.getRoot();
		graphic.drawNode(root);
	}

	//==============================================================================
	// 이후 출력.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Graphic } graphic 그릴 그래픽.
	 */
	postDraw(graphic) {
		// 코드.
	}

	//==============================================================================
	// 기즈모 출력.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Graphic } graphic 그릴 그래픽.
	 */
	drawGizmos(graphic) {
		const isGizmoVisible = this.isGizmoVisible();
		if (!isGizmoVisible) {
			return;
		}

		// 출력.
	}

	//==============================================================================
	// 터치 갱신.
	//==============================================================================
	/**
	 * @virtual
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 */
	tickTouch(timeDelta) {
		const engine = this.getEngine();
		const inputManager = engine.getInputManager();
		const viewInputPosition = inputManager.getViewInputPosition();
		const isTouchPressed = inputManager.isTouchPressed();
		const touchRaycaster = this.#touchRaycaster;

		// 누름. (노드에 먼저 넘기고 훅을 부른다, 아래 모두 같다)
		if (isTouchPressed) {
			if (touchRaycaster) {
				try {
					touchRaycaster.touchPress(viewInputPosition);
				}
				catch (error) {
					console.error(error);
				}
			}
			try {
				this.touchPress(viewInputPosition);
			}
			catch (error) {
				console.error(error);
			}
		}

		// 뗌. (한 프레임 안에 눌렀다 뗐으면 누름 뒤에 바로 뗌을 넘긴다)
		if (inputManager.isTouchReleased()) {
			if (touchRaycaster) {
				try {
					touchRaycaster.touchRelease(viewInputPosition);
				}
				catch (error) {
					console.error(error);
				}
			}
			try {
				this.touchRelease(viewInputPosition);
			}
			catch (error) {
				console.error(error);
			}
		}
		// 누르고 있음. (누른 프레임에는 넘기지 않는다)
		else if (inputManager.isTouchMoved() && !isTouchPressed) {
			if (touchRaycaster) {
				try {
					touchRaycaster.touchMove(viewInputPosition);
				}
				catch (error) {
					console.error(error);
				}
			}
			try {
				this.touchMove(viewInputPosition);
			}
			catch (error) {
				console.error(error);
			}
		}
		// 취소됨.
		else if (inputManager.isTouchCancelled()) {
			if (touchRaycaster) {
				try {
					touchRaycaster.touchCancel(viewInputPosition);
				}
				catch (error) {
					console.error(error);
				}
			}
			try {
				this.touchCancel(viewInputPosition);
			}
			catch (error) {
				console.error(error);
			}
		}

		// 마우스 휠. (이번 프레임에 누적된 휠 값이 있으면 그 자리의 가장 앞 스크롤 칸에 넘기고 훅을 부른다)
		if (typeof inputManager.hasWheelDelta === "function" && inputManager.hasWheelDelta()) {
			const wheelDelta = Vector2.create(inputManager.getWheelDeltaX(), inputManager.getWheelDeltaY());
			if (touchRaycaster) {
				try {
					touchRaycaster.touchWheel(viewInputPosition, wheelDelta);
				}
				catch (error) {
					console.error(error);
				}
			}
			try {
				this.touchWheel(viewInputPosition, wheelDelta);
			}
			catch (error) {
				console.error(error);
			}
		}
	}

	//==============================================================================
	// 터치 누름.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } viewInputPosition 뷰 좌표의 입력 위치.
	 */
	touchPress(viewInputPosition) {

	}

	//==============================================================================
	// 터치 이동.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } viewInputPosition 뷰 좌표의 입력 위치.
	 */
	touchMove(viewInputPosition) {

	}

	//==============================================================================
	// 터치 뗌.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } viewInputPosition 뷰 좌표의 입력 위치.
	 */
	touchRelease(viewInputPosition) {

	}

	//==============================================================================
	// 터치 취소됨.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } viewInputPosition 뷰 좌표의 입력 위치.
	 */
	touchCancel(viewInputPosition) {

	}

	//==============================================================================
	// 마우스 휠.
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } viewInputPosition 뷰 좌표의 입력 위치.
	 * @param { Vector2 } wheelDelta 이번 프레임에 쌓인 휠 값. (WheelEvent 의 deltaX, deltaY 를 더한 것)
	 */
	touchWheel(viewInputPosition, wheelDelta) {

	}

	//==============================================================================
	// 트윈 시작.
	//==============================================================================
	/**
	 * @param { Tween } tween 시작할 트윈. (이미 도는 트윈이면 아무것도 하지 않는다)
	 * @example <caption>노드를 0.5 초 동안 나타나게 하기</caption>
	 * import { Engine, EngineConfiguration, Scene, WorldNode, Tween, TweenProperty, Vector2 } from "./build/vanilla.js";
	 *
	 * class MainScene extends Scene {
	 * 	initialize(engine) {
	 * 		const root = this.getRoot();
	 * 		const node = new WorldNode();
	 * 		node.setContentSize(Vector2.create(100, 100));
	 * 		root.addChild(node);
	 * 		const tween = Tween.createNodeTween(node, TweenProperty.localOpacity, 0, 1, 0.5);
	 * 		this.startTween(tween);
	 * 		const tweenCount = this.getTweenCount();
	 * 		console.log(tweenCount);
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	startTween(tween) {
		const index = this.#tweens.indexOf(tween);
		if (index !== -1) {
			return;
		}

		tween.start();
		this.#tweens.push(tween);
	}

	//==============================================================================
	// 트윈 중단.
	//==============================================================================
	/**
	 * @param { Tween } tween 멈출 트윈. (이 씬에서 돌지 않으면 아무것도 하지 않는다)
	 */
	stopTween(tween) {
		const index = this.#tweens.indexOf(tween);
		if (index === -1) {
			return;
		}

		tween.stop();
		this.#tweens.splice(index, 1);
	}

	//==============================================================================
	// 도는 트윈 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 도는 트윈 수.
	 */
	getTweenCount() {
		return this.#tweens.length;
	}

	//==============================================================================
	// 모든 트윈 중단.
	//==============================================================================
	stopAllTweens() {
		for (let i = this.#tweens.length - 1; i >= 0; --i) {
			const tween = this.#tweens[i];
			tween.stop();
			this.#tweens.splice(i, 1);
		}
	}

	//==============================================================================
	// 엔진 반환.
	//==============================================================================
	/**
	 * @returns { Engine } 이 씬을 불러온 엔진. (불러오기 전에는 undefined)
	 */
	getEngine() {
		return this.#engine;
	}
	
	//==============================================================================
	// 루트 노드 반환.
	//==============================================================================
	/**
	 * @returns { WorldNode } 루트 노드. (create 에서 만들고, 크기는 뷰 크기)
	 */
	getRoot() {
		return this.#root;
	}

	//==============================================================================
	// 터치 레이캐스터 설정.
	// - tickTouch 가 이 레이캐스터로 가장 앞의 누를 수 있는 노드에 터치를 넘긴다. 루트는 씬 루트로 건다.
	// - TouchRecognizer 를 주면 스크롤 칸 안의 끌기 손짓(누름 늦추기, 끌면 스크롤 칸으로)도 넘긴다.
	// - null 이면 노드에 넘기지 않는다. (씬이 터치 훅에서 직접 넘길 때, UIScene 과 GameScene 이 그렇게 한다)
	//==============================================================================
	/**
	 * @param { TouchRaycaster | null } touchRaycaster 노드에 터치를 넘길 레이캐스터. (null 이면 넘기지 않는다)
	 * @example <caption>스크롤 칸 끌기 손짓까지 넘기기</caption>
	 * import { Engine, EngineConfiguration, Scene, TouchRecognizer } from "./build/vanilla.js";
	 *
	 * class MainScene extends Scene {
	 * 	initialize(engine) {
	 * 		this.setTouchRaycaster(new TouchRecognizer());
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	setTouchRaycaster(touchRaycaster) {
		this.#touchRaycaster = touchRaycaster;
		if (touchRaycaster) {
			touchRaycaster.setRootNode(this.getRoot());
		}
	}

	//==============================================================================
	// 터치 레이캐스터 반환.
	//==============================================================================
	/**
	 * @returns { TouchRaycaster | null } 노드에 터치를 넘기는 레이캐스터. (create 에서 TouchRaycaster 를 만든다, 넘기지 않으면 null)
	 */
	getTouchRaycaster() {
		return this.#touchRaycaster;
	}

	//==============================================================================
	// 기즈모 그리기 설정.
	//==============================================================================
	/**
	 * @param { boolean } isVisible 참이면 기즈모를 그린다.
	 */
	setGizmoVisible(isVisible) {
		this.#isGizmoVisible = isVisible;
	}

	//==============================================================================
	// 기즈모 그리기 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 기즈모를 그리면 참.
	 */
	isGizmoVisible() {
		return this.#isGizmoVisible;
	}
}