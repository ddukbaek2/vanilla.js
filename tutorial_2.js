//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 as Vec2 } from "./src/base/vector2.js";
import { Rect } from "./src/base/rect.js";
import { Colors } from "./src/base/colors.js";
import { Engine, EngineConfiguration } from "./src/core/engine.js";
import { Graphic } from "./src/core/graphic.js";
import { Scene } from "./src/core/scene.js";
import { ViewScaleMode } from "./src/core/viewmanager.js";
import { Pivot } from "./src/base/pivot.js";
import { Paint } from "./src/core/component/paint.js";
import { WorldNode } from "./src/core/node/worldnode.js";



//==============================================================================
// 튜토리얼2 : 화면 레이아웃 및 터치 충돌.
//==============================================================================
class Tutorial_2 extends Scene {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Node } */ #touchNode;

	//==============================================================================
	// 초기화.
	//==============================================================================
	/**
	 * @param { Engine } engine 
	 */
	initialize(engine) {
		super.initialize(engine);

		// 뷰 해상도 설정.
		const viewManager = engine.getViewManager();
		viewManager.setViewScaleMode(ViewScaleMode.stretchHeight); // 기준해상도 + 세로축 맞춤.
		const viewSize = viewManager.getViewSize();

		// 루트 설정.
		const root = this.getRoot();
		root.setPosition(Vec2.zero());
		root.setPivot(Pivot.topLeft);
		root.setContentSize(viewSize);
		// let color = root.addComponent(Paint);
		// color.setColor("#000000");

		// 노드 설정.
		const node = new WorldNode();
		node.setPivot(Pivot.topLeft);
		node.setLocalPosition(Vec2.create(100, 100));
		node.setContentSize(Vec2.create(200, 200));
		root.addChild(node);
		let color = node.addComponent(Paint);
		color.setColor("#ff0000");

		// 자식 노드 설정.
		const child = new WorldNode();	
		node.addChild(child);
		child.setPivot(Pivot.topLeft);
		child.setLocalPosition(Vec2.create(100, 100));
		child.setContentSize(Vec2.create(200, 200));
		color = child.addComponent(Paint);
		color.setColor("#0000ff");

		// 자손 노드 설정.
		this.#touchNode = new WorldNode();
		child.addChild(this.#touchNode);
		this.#touchNode.setPivot(Pivot.middleCenter);
		this.#touchNode.setLocalPosition(Vec2.create(100, 100));
		this.#touchNode.setContentSize(Vec2.create(50, 50));
		this.#touchNode.setRotation(45);
		color = this.#touchNode.addComponent(Paint);
		color.setColor("#ff00ff");

		// UI 노드 설정.
		const uiRoot = new UINode();
		uiRoot.setPivot(Pivot.topLeft);
		uiRoot.setAnchorMin(Vec2.create(0.5, 0.5));
		uiRoot.setAnchorMax(Vec2.create(0.5, 0.5));
		uiRoot.setAnchoredPosition(Vec2.create(0, 0));
		uiRoot.setSizeDelta(Vec2.create(100, 100));
		root.addChild(uiRoot);
		color = uiRoot.addComponent(Paint);
		color.setColor("#ffff00");	
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta 
	 */
	tick(timeDelta) {
		super.tick(timeDelta);

		const engine = this.getEngine();
		const inputManager = engine.getInputManager();
		const viewInputPosition = inputManager.getViewInputPosition();
		const color = this.#touchNode.getComponent(Paint);
		if (this.#touchNode.contains(viewInputPosition)) {
			color.setColor("#00ff00");
		}
		else {
			color.setColor("#ff00ff");
		}
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Graphic } graphic 
	 */
	draw(graphic) {
		const engine = this.getEngine();
		const canvasRenderingContext = graphic.getCanvasRenderingContext();
		const viewManager = engine.getViewManager();
		const canvasNativeSize = viewManager.getCanvasNativeSize();
		const viewSize = viewManager.getViewSize();

		// 전체 화면 칠하기.
		viewManager.applyCanvasNativeRect(canvasRenderingContext);
		canvasRenderingContext.fillStyle = Colors.darkVanilla;
		graphic.drawRect(Rect.create(0, 0, canvasNativeSize.x, canvasNativeSize.y));

		// 게임 영역 칠하기.
		viewManager.applyViewRect(canvasRenderingContext);
		canvasRenderingContext.fillStyle = Colors.lightVanilla;
		graphic.drawRect(Rect.create(0, 0, viewSize.x, viewSize.y));

		// 출력.
		super.draw(graphic);
	}
}


// 캔버스 생성.
let canvas = document.getElementById("tutorial");
if (canvas === null) {
	canvas = document.createElement("canvas");
	canvas.id = "tutorial";
	document.body.appendChild(canvas);
}

// 엔진 실행.
const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vec2.create(800, 1280);
engineConfiguration.canvasId = "tutorialCanvas";
engineConfiguration.useStatistics = true;
const engine = new Engine(engineConfiguration);
document.title = "vanilla.js - Tutorial_2";
const tutorial = new Tutorial_2();
engine.run(tutorial);