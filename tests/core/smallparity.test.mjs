//==============================================================================
// 러스트 판 꼴 맞추기 작은 것들의 node 시험. (node tests/core/smallparity.test.mjs)
// - 러스트 판 짝: src/base/color.rs 의 Color::create, src/misc/cameragestures.rs 의 take_pan(Vector2),
//   src/core/animation.rs 의 set_frames_from_rects, src/ui/autolayout/layoutsolver.rs 의 LayoutError Display 글.
//==============================================================================
import { Color } from "../../src/base/color.js";
import { Vector2 } from "../../src/base/vector2.js";
import { Rect } from "../../src/base/rect.js";
import { Animation } from "../../src/core/animation.js";
import { CameraGestures } from "../../src/misc/cameragestures.js";
import { LayoutSolver } from "../../src/ui/autolayout/layoutsolver.js";
import { LayoutVariable } from "../../src/ui/autolayout/layoutvariable.js";
import { check, checkEqual, finish } from "../testcheck.mjs";

// Color.create
const color = Color.create(1, 0.5, 0, 0.25);
check(color instanceof Color, "Color.create 는 Color");
checkEqual([color.red, color.green, color.blue, color.alpha].join(","), "1,0.5,0,0.25", "Color.create 성분");
checkEqual(Color.create().alpha, 1, "Color.create 기본 알파 1");

// takePan 은 Vector2
const cameraGestures = new CameraGestures();
const emptyPan = cameraGestures.takePan();
check(emptyPan instanceof Vector2, "takePan 은 Vector2");
checkEqual(emptyPan.x + "," + emptyPan.y, "0,0", "모인 것이 없으면 0, 0");

// Animation.setFramesFromRects 는 캔버스와 ImageBitmap 도 받는다. (node 에는 없는 꼴은 흉내 꼴로)
class FakeCanvas {
	constructor() {
		this.width = 64;
		this.height = 32;
	}
}
class FakeImageBitmap {
	constructor() {
		this.width = 64;
		this.height = 32;
	}
}
globalThis.OffscreenCanvas = FakeCanvas;
globalThis.ImageBitmap = FakeImageBitmap;
const rects = [Rect.create(0, 0, 32, 32), Rect.create(32, 0, 32, 32)];
for (const [name, image] of [["OffscreenCanvas", new FakeCanvas()], ["ImageBitmap", new FakeImageBitmap()]]) {
	const animation = new Animation();
	animation.setFramesFromRects(image, rects);
	check(animation.getCurrentFrame() !== null, "setFramesFromRects 가 " + name + " 를 받음");
}
const ignoredAnimation = new Animation();
ignoredAnimation.setFramesFromRects({ width: 1, height: 1 }, rects);
checkEqual(ignoredAnimation.getCurrentFrame(), null, "그림이 아닌 값은 무시");

// LayoutSolver 오류 글은 러스트 판 LayoutError Display 와 같다.
function messageOf(action) {
	try {
		action();
	}
	catch (error) {
		return error.message;
	}
	return null;
}
const solver = new LayoutSolver();
checkEqual(messageOf(() => solver.removeConstraint({})), "[LayoutSolver] 등록되지 않은 제약.", "등록되지 않은 제약");
check(messageOf(() => solver.suggestValue(new LayoutVariable("x"), 1)) === "[LayoutSolver] 등록되지 않은 편집 변수.", "등록되지 않은 편집 변수");
finish("러스트 판 꼴 맞추기 작은 것들 (node)");
