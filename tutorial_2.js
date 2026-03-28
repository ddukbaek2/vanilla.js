//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 as Vec2 } from "./src/base/vector2.js";
import { Rect } from "./src/base/rect.js";
import { Colors } from "./src/base/colors.js";
import { Engine, EngineConfiguration } from "./src/core/engine.js";
import { Renderer } from "./src/core/renderer.js";
import { Scene } from "./src/core/scene.js";
import { ViewScaleMode } from "./src/core/viewmanager.js";
import { Node } from "./src/core/node.js";
import { SpriteComponent } from "./src/component/spritecomponent.js";
import { ColorComponent, Pivot } from "./import.js";


//==============================================================================
// 게임 인스턴스.
//==============================================================================
class Tutorial_2 extends Scene {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	// /** @private @type { Node } */ #node;

	//==============================================================================
	// 불러오기.
	//==============================================================================
	/**
	 * @param { Engine } engine 
	 */
	async load(engine) {
		await super.load(engine);
	}

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
		viewManager.setViewScaleMode(ViewScaleMode.matchHeightToScreen); // 기준해상도 + 세로축 맞춤.
		const referenceResolutionSize = viewManager.getReferenceResolutionSize();

		// 루트 설정.
		const root = this.getRoot();
		root.setPosition(Vec2.zero());
		root.setPivot(Pivot.topLeft);
		root.setSize(referenceResolutionSize);
		// let color = root.addComponent(ColorComponent);
		// color.setColor("#000000");

		// 노드 설정.
		const node = new Node();
		node.setPivot(Pivot.topLeft);
		node.setLocalPosition(Vec2.create(100, 100));
		node.setSize(Vec2.create(200, 200));
		root.addChild(node);
		let color = node.addComponent(ColorComponent);
		color.setColor("#ff0000");

		// 자식 노드 설정.
		const child = new Node();	
		node.addChild(child);
		child.setPivot(Pivot.topLeft);
		child.setLocalPosition(Vec2.create(100, 100));
		child.setSize(Vec2.create(200, 200));
		color = child.addComponent(ColorComponent);
		color.setColor("#00ffff");	
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta 
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Renderer } renderer 
	 */
	draw(renderer) {
		const engine = super.getEngine();
		const canvasContext = renderer.getCanvasContext();
		const viewManager = engine.getViewManager();
		const canvasPixelSize = viewManager.getCanvasPixelSize();
		const referenceResolutionSize = viewManager.getReferenceResolutionSize();

		// 전체 영역 칠하기. (좌표계: (0 ~ canvasPixelRect))
		viewManager.applyCanvasNativeRect(canvasContext);
		canvasContext.beginPath();
		canvasContext.fillStyle = Colors.darkVanilla;
		canvasContext.fillRect(0, 0, canvasPixelSize.x, canvasPixelSize.y);

		// 게임 영역 칠하기. (좌표계: (0 ~ referenceResolutionSize))
		viewManager.applyViewRect(canvasContext);
		renderer.drawRect(Rect.create(0, 0, referenceResolutionSize.x, referenceResolutionSize.y), Colors.lightVanilla);

		super.draw(renderer);
	}

	//==============================================================================
	// 터치 누름.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition
	 */
	touchPress(viewInputPosition) {
		super.touchPress(viewInputPosition);
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
engineConfiguration.canvasId = "tutorial";
engineConfiguration.isDevelopment = true;
const engine = new Engine(engineConfiguration);
document.title = "vanilla.js - Tutorial";
const tutorial = new Tutorial_2();
engine.run(tutorial);