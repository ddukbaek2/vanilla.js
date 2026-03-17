//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VEngine } from "./src/core/engine.js";
import { VRenderer } from "./src/core/renderer.js";
import { VGameInstance } from "./src/core/gameinstance.js";
import { VRect } from "./src/base/rect.js";
import { VVector2 } from "./src/base/vector2.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
const COLOR_DARKVANILLA = "#d1c1b2";
const COLOR_LIGHTVANILLA = "#f1e9d8";
const COLOR_VANILLA = "#f3e5ab";


//==============================================================================
// 게임 인스턴스.
//==============================================================================
class Tutorial extends VGameInstance {

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { VRenderer } renderer 
	 */
	onDraw(renderer) {
		super.onDraw(renderer);

		const engine = super.getEngine();
		const view = engine.getView();

		// 전체 영역 초기화.
		engine.viewIdentity(COLOR_VANILLA);

		// 게임 영역 초기화.
		engine.gameViewIdentity(COLOR_LIGHTVANILLA);

		// 사각형 그리기.
		let boxPosition = VVector2.create(0, 0);
		let boxSize = VVector2.create(100, 100);
		boxPosition = boxPosition.add(view.resolution.divide(2)).subtract(boxSize.divide(2));
		renderer.drawRect(VRect.create(boxPosition, boxSize), COLOR_DARKVANILLA);
		// console.log(boxPosition);
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
const engine = new VEngine(800, 1280, "tutorial", true);
document.title = "vanilla.js";
engine.run(new Tutorial());