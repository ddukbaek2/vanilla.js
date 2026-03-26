//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "./src/base/vector2.js";
import { Rect } from "./src/base/rect.js";
import { Colors } from "./src/base/colors.js";
import { Engine, EngineConfiguration } from "./src/core/engine.js";
import { Renderer } from "./src/core/renderer.js";
import { Scene } from "./src/core/scene.js";
import { ViewScaleMode } from "./src/core/viewmanager.js";


//==============================================================================
// 게임 인스턴스.
//==============================================================================
class Tutorial extends Scene {
	//==============================================================================
	// 초기화.
	//==============================================================================
	/**
	 * @param { Engine } engine 
	 */
	initialize(engine) {
		super.initialize(engine);

		const viewManager = engine.getViewManager();
		viewManager.setViewScaleMode(ViewScaleMode.none); // 화면 전체 해상도.
		// viewManager.setViewScaleMode(ViewScaleMode.referenceResolution); // 기준 해상도.
		// viewManager.setViewScaleMode(ViewScaleMode.stretchWidth); // 기준해상도 + 가로로 늘려붙이기.
		viewManager.setViewScaleMode(ViewScaleMode.stretchHeight);
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Renderer } renderer 
	 */
	draw(renderer) {
		super.draw(renderer);

		const engine = super.getEngine();
		const canvasContext = renderer.getCanvasContext();
		const viewManager = engine.getViewManager();
		const canvasPixelSize = viewManager.getCanvasPixelSize();
		const referenceResolutionSize = viewManager.getReferenceResolutionSize();

		// 전체 영역 칠하기. (좌표계: (0 ~ canvasPixelRect))
		viewManager.applyCanvasPixelRect(canvasContext);
		canvasContext.beginPath();
		canvasContext.fillStyle = Colors.darkVanilla;
		canvasContext.fillRect(0, 0, canvasPixelSize.x, canvasPixelSize.y);

		// 게임 영역 칠하기. (좌표계: (0 ~ referenceResolutionSize))
		viewManager.applyViewRect(canvasContext);
		renderer.drawRect(Rect.create(0, 0, referenceResolutionSize.x, referenceResolutionSize.y), Colors.lightVanilla);

		// 사각형 그리기.
		let boxPosition = Vector2.create(0, 0);
		let boxSize = Vector2.create(100, 100);
		boxPosition = boxPosition.add(referenceResolutionSize.divide(2)).subtract(boxSize.divide(2));
		renderer.drawRect(Rect.create(boxPosition.x, boxPosition.y, boxSize.x, boxSize.y), "#ffff00");
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
engineConfiguration.referenceResolutionSize = Vector2.create(800, 1280);
engineConfiguration.canvasId = "tutorial";
engineConfiguration.isDevelopment = true;
const engine = new Engine(engineConfiguration);
document.title = "vanilla.js - Tutorial";
const tutorial = new Tutorial();
engine.run(tutorial);