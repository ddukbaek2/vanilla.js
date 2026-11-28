//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Color } from "../../base/color.js";
import { Rect } from "../../base/rect.js";
import { Graphic } from "../graphic.js";
import { Component } from "../component.js";
import { TransformNode } from "../node/transformnode.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 그릴 때마다 고쳐 쓰는 사각 영역. (graphic 의 그리기 함수는 받은 사각 영역을 그 자리에서 읽기만 하고 들고 있지 않는다)
const paintRect = new Rect();


//==============================================================================
// 내용의 색상과 투명도를 결정하는 컴포넌트.
//==============================================================================
/**
 * @example <caption>둥근 판 하나 칠하기</caption>
 * import { Engine, EngineConfiguration, Scene, Vector2, WorldNode, Paint } from "./build/vanilla.js";
 *
 * class MainScene extends Scene {
 * 	async load(engine) {
 * 		await super.load(engine);
 * 		const node = new WorldNode();
 * 		node.setContentSize(Vector2.create(200, 120));
 * 		node.setLocalPosition(Vector2.create(320, 180));
 * 		const paint = node.addComponent(Paint);
 * 		paint.setColor("#3366ff");
 * 		paint.setRoundSize(16);
 * 		const root = this.getRoot();
 * 		root.addChild(node);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
export class Paint extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Color } */ #color; // 컬러.
	/** @private @type { number } */ #roundSize; // 라운드 사이즈.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @construct
	 */
	constructor() {
		super();
		this.setComponentType("Paint");
		this.#color = Color.white();
		this.#roundSize = 0;
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Graphic } graphic 그래픽.
	 */
	draw(graphic) {
		// super.draw(graphic);
		const node = this.getNode();

		// Component.draw()를 호출하는 쪽은 TransformNode이므로 신뢰하고 사용.
		// if (node instanceof TransformNode)
		const color = this.getColor();
		const rect = paintRect;
		const rectPosition = rect.position;
		const rectSize = rect.size;
		rectPosition.set(0, 0);
		if (typeof node.copyContentSizeTo === "function") {
			// 내용 크기를 복제본 없이 받는다.
			node.copyContentSizeTo(rectSize);
		}
		else {
			const contentSize = node.getContentSize();
			rectSize.set(contentSize.x, contentSize.y);
		}

		// 출력.
		graphic.setFillColor(color);
		if (this.#roundSize > 0) {
			graphic.drawRoundRect(rect, this.#roundSize);
		}
		else {
			graphic.drawRect(rect);
		}
	}

	//==============================================================================
	// 내용 영역 안에서만 그리는지 반환. (내용 크기의 사각형만 칠한다)
	// - draw 를 덮어쓴 하위 클래스는 어디에 그리는지 모르므로 false. (그 클래스가 이 함수도 덮어써 알린다)
	//==============================================================================
	/**
	 * @override
	 * @returns { boolean } 내용 영역 안에서만 그리면 참.
	 */
	isDrawnInsideContent() {
		return this.draw === Paint.prototype.draw;
	}

	//==============================================================================
	// 그리기 입력을 기하 캐시 열쇠에 적기. (색, 모서리 반지름, 내용 크기)
	// - draw 를 덮어쓴 하위 클래스는 무엇을 읽는지 모르므로 false. (그 클래스가 이 함수도 덮어써 알린다)
	//==============================================================================
	/**
	 * @override
	 * @param { GeometryKey } geometryKey 입력을 적을 열쇠.
	 * @returns { boolean } 입력을 적었으면 참.
	 */
	writeGeometryKey(geometryKey) {
		if (this.draw !== Paint.prototype.draw) {
			return false;
		}
		const node = this.getNode();
		const color = this.getColor();
		const contentSize = paintRect.size;
		if (typeof node.copyContentSizeTo === "function") {
			node.copyContentSizeTo(contentSize);
		}
		else {
			const nodeContentSize = node.getContentSize();
			contentSize.set(nodeContentSize.x, nodeContentSize.y);
		}
		geometryKey.add(color);
		if (color !== null && typeof color === "object") {
			geometryKey.add(color.red);
			geometryKey.add(color.green);
			geometryKey.add(color.blue);
			geometryKey.add(color.alpha);
		}
		geometryKey.add(this.#roundSize);
		geometryKey.add(contentSize.x);
		geometryKey.add(contentSize.y);
		return true;
	}

	//==============================================================================
	// 색상 설정.
	//==============================================================================
	/**
	 * @param { Color | string | CanvasGradient | CanvasPattern } other 색. (Color 나 "#rrggbb(aa)", "rgb(a)(...)" 글, null 이나 undefined 면 투명, 그 밖의 값은 무시한다)
	 */
	setColor(other) {
		if (other === null || other === undefined) {
			this.#color = Color.transparent();
		}
		else if (typeof other === "string") {
			this.#color = Color.from(other);
		}
		else if (other instanceof Color) {
			this.#color = other;
		}
	}

	//==============================================================================
	// 색상 반환.
	//==============================================================================
	/**
	 * @returns { Color } 색상.
	 */
	getColor() {
		return this.#color;
	}

	//==============================================================================
	// 라운드 크기 설정.
	//==============================================================================
	/**
	 * @param { number } roundSize 모서리 반지름. (내용 크기 단위, 0 이하면 각진 사각형, 짧은 변의 반을 넘으면 반으로 자른다)
	 */
	setRoundSize(roundSize) {
		this.#roundSize = roundSize;
	}

	//==============================================================================
	// 라운드 사이즈 반환.
	//==============================================================================
	/**
	 * @returns { number } 모서리 반지름.
	 */
	getRoundSize() {
		return this.#roundSize;
	}
}
