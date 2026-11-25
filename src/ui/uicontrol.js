//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { UIView } from "./uiview.js";


//==============================================================================
// UI 컨트롤.
// - 사용자 입력(터치/포인터)을 받는 단일 위젯의 기반 클래스.
// - UIKit 의 UIControl 이 UIView 를 상속하는 것과 동일한 구조를 따른다.
//   (모든 UI 는 UIView 트리, 입력을 받는 것은 UIControl 서브트리)
// - 표시/컨테이너 기능(content/mask/backgroundColor/setEngine 등)은
//   UIView 로부터 상속받는다.
//==============================================================================
/**
 * @example <caption>누름을 세는 컨트롤 만들기</caption>
 * import { Engine, EngineConfiguration, UIScene, UIControl, WorldNode, Paint, Pivot, Vector2, Color } from "./build/vanilla.js";
 *
 * class TapControl extends UIControl {
 * 	constructor() {
 * 		super();
 * 		this.tapCount = 0;
 * 	}
 *
 * 	attach(node) {
 * 		super.attach(node);
 * 		node.setInteractable(true);
 * 	}
 *
 * 	touchRelease(viewInputPosition) {
 * 		this.tapCount += 1;
 * 		console.log("tap", this.tapCount, viewInputPosition.x, viewInputPosition.y);
 * 	}
 * }
 *
 * class MainScene extends UIScene {
 * 	constructor() {
 * 		super();
 * 		this.setLoadingMinDurationMs(0);
 * 	}
 *
 * 	initialize(engine) {
 * 		super.initialize(engine);
 * 		const node = new WorldNode();
 * 		node.setPivot(Pivot.topLeft);
 * 		node.setAnchor(Pivot.topLeft);
 * 		node.setLocalPosition(Vector2.create(40, 40));
 * 		node.setContentSize(Vector2.create(160, 80));
 * 		const paint = node.addComponent(Paint);
 * 		paint.setColor(new Color(0.2, 0.5, 0.9, 1));
 * 		node.addComponent(TapControl);
 * 		const root = this.getRoot();
 * 		root.addChild(node);
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
export class UIControl extends UIView {
	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.setComponentType("UIControl");
	}
}
