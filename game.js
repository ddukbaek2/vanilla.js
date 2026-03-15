//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VEngine } from "./src/core/engine.js";
import { VGameInstance } from "./src/core/gameinstance.js";


//==============================================================================
// 게임 인스턴스.
//==============================================================================
class Game extends VGameInstance {
	onDraw(renderer) {
		super.onDraw(renderer);
	}
}

// 캔버스 생성.
let canvas = document.getElementById("game");
if (canvas === null) {
	canvas = document.createElement("canvas");
	canvas.id = "game";
	document.body.appendChild(canvas);
}

// 엔진 실행.
const engine = new VEngine(800, 1280, "game", true);
document.title = "vinilla.js";
engine.run(new Game());