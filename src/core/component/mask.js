//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Rect } from "../../base/rect.js";
import { Component } from "../component.js";
import { Graphic } from "../graphic.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 클립할 때마다 고쳐 쓰는 사각 영역. (graphic.beginClipRect 는 받은 영역의 값을 제 칸에 옮겨 적고 들고 있지 않는다)
const clipRect = new Rect();


//==============================================================================
// 마스크 컴포넌트.
// - 부착된 노드의 contentSize 영역으로 자식 노드들의 그리기를 클리핑한다.
// - 실제 begin/end 호출은 노드의 draw 가 자식 그리기 직전/직후에 한다.
//   (draw() 자체는 컴포넌트 출력 단계에서 호출되지만 아무것도 하지 않는다.)
//==============================================================================
/**
 * @example <caption>둥근 창 안으로 자식 자르기</caption>
 * import { Engine, EngineConfiguration, Scene, Vector2, WorldNode, Paint, Mask } from "./build/vanilla.js";
 *
 * class MainScene extends Scene {
 * 	async load(engine) {
 * 		await super.load(engine);
 * 		const windowNode = new WorldNode();
 * 		windowNode.setContentSize(Vector2.create(200, 200));
 * 		windowNode.setLocalPosition(Vector2.create(320, 180));
 * 		const paint = windowNode.addComponent(Paint);
 * 		paint.setColor("#223344");
 * 		paint.setRoundSize(24);
 * 		const mask = windowNode.addComponent(Mask);
 * 		mask.setRoundSize(24);
 * 		const root = this.getRoot();
 * 		root.addChild(windowNode);
 *
 * 		const childNode = new WorldNode();
 * 		childNode.setContentSize(Vector2.create(160, 160));
 * 		childNode.setLocalPosition(Vector2.create(160, 160));
 * 		const childPaint = childNode.addComponent(Paint);
 * 		childPaint.setColor("#ff6633");
 * 		windowNode.addChild(childNode);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
export class Mask extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #roundSize; // 둥근 모서리 반지름. (0 이면 사각형)

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setComponentType("Mask");
		this.#roundSize = 0;
	}

	//==============================================================================
	// 클리핑 시작. (노드의 draw 가 자식 그리기 직전에 호출)
	//==============================================================================
	/**
	 * @param { Graphic } graphic 그래픽.
	 */
	beginClip(graphic) {
		const node = this.getNode();
		if (!node) {
			return;
		}
		if (typeof node.getContentSize !== "function") {
			return;
		}
		const clipRectPosition = clipRect.position;
		const clipRectSize = clipRect.size;
		clipRectPosition.set(0, 0);
		if (typeof node.copyContentSizeTo === "function") {
			// 내용 크기를 복제본 없이 받는다.
			node.copyContentSizeTo(clipRectSize);
		}
		else {
			const contentSize = node.getContentSize();
			clipRectSize.set(contentSize.x, contentSize.y);
		}
		const roundSize = this.getRoundSize();
		graphic.beginClipRect(clipRect, roundSize);
	}

	//==============================================================================
	// 클리핑 종료. (노드의 draw 가 자식 그리기 직후에 호출)
	//==============================================================================
	/**
	 * @param { Graphic } graphic 그래픽.
	 */
	endClip(graphic) {
		graphic.endClipRect();
	}

	//==============================================================================
	// 내용 영역 안에서만 그리는지 반환. (컴포넌트 출력 단계에서는 아무것도 그리지 않는다)
	// - 걸러져도 자식을 자르는 클립은 노드의 draw 가 그대로 건다.
	// - draw 를 덮어쓴 하위 클래스는 어디에 그리는지 모르므로 false.
	//==============================================================================
	/**
	 * @override
	 * @returns { boolean } 내용 영역 안에서만 그리면 참.
	 */
	isDrawnInsideContent() {
		return this.draw === Mask.prototype.draw;
	}

	//==============================================================================
	// 둥근 모서리 반지름 설정. (Paint 의 roundSize 와 같은 값을 주면 배경 모양대로 잘린다)
	//==============================================================================
	/**
	 * @param { number } roundSize 둥근 모서리 반지름. (내용 크기 단위, 음수는 0, 0 이면 사각형)
	 */
	setRoundSize(roundSize) {
		this.#roundSize = Math.max(0, roundSize);
	}

	//==============================================================================
	// 둥근 모서리 반지름 반환.
	//==============================================================================
	/**
	 * @returns { number } 둥근 모서리 반지름.
	 */
	getRoundSize() {
		return this.#roundSize;
	}
}
