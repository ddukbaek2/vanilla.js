//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Color } from "../base/color.js";
import { Rect } from "../base/rect.js";
import { Vector2 } from "../base/vector2.js";
import * as Math from "../base/math.js";
import { Graphic } from "../core/graphic.js";
import { WorldNode } from "../core/node/worldnode.js";
import { UIControl } from "./uicontrol.js";
import { ProgressDirection } from "./uiprogressview.js";


//==============================================================================
// 슬라이더 컨트롤.
// - 사용자 입력(드래그/탭)으로 값을 조정한다. → UIControl 을 상속.
// - 표시 부분(트랙/채움)은 UIProgressView 와 외관이 비슷하지만, 컨트롤 트리에
//   속해야 하므로 UIProgressView 를 상속하지 않고 직접 그린다.
// - thumb 까지 추가로 그린다.
//==============================================================================
/**
 * @example <caption>음량 슬라이더 만들기</caption>
 * import { Engine, EngineConfiguration, UIScene, UISlider, WorldNode, Pivot, Vector2 } from "./build/vanilla.js";
 *
 * class MainScene extends UIScene {
 * 	constructor() {
 * 		super();
 * 		this.setLoadingMinDurationMs(0);
 * 	}
 *
 * 	initialize(engine) {
 * 		super.initialize(engine);
 * 		const sliderNode = new WorldNode();
 * 		sliderNode.setPivot(Pivot.topLeft);
 * 		sliderNode.setAnchor(Pivot.topLeft);
 * 		sliderNode.setLocalPosition(Vector2.create(40, 60));
 * 		sliderNode.setContentSize(Vector2.create(240, 24));
 * 		const slider = sliderNode.addComponent(UISlider);
 * 		slider.setRange(0, 100);
 * 		slider.setValue(50);
 * 		slider.setTrackThickness(6);
 * 		slider.setCornerRadius(3);
 * 		slider.setThumbRadius(12);
 * 		slider.setValueChangedEvent((changedSlider) => {
 * 			console.log("volume", changedSlider.getValue());
 * 		});
 * 		const root = this.getRoot();
 * 		root.addChild(sliderNode);
 * 		console.log(slider.getValue(), slider.getRatio());
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
export class UISlider extends UIControl {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #value;
	/** @private @type { number } */ #minValue;
	/** @private @type { number } */ #maxValue;
	/** @private @type { Color } */  #trackColor;
	/** @private @type { Color } */  #fillColor;
	/** @private @type { Color } */  #thumbColor;
	/** @private @type { number } */ #thumbRadius;
	/** @private @type { number } */ #trackThickness;
	/** @private @type { WorldNode } */ #thumbNode;
	/** @private @type { number } */ #cornerRadius;
	/** @private @type { string } */ #direction;
	/** @private @type { boolean } */ #isDragging;
	/** @private @type { boolean } */ #isInteractable;
	/** @private @type { (slider: UISlider) => void } */ #valueChangedEvent;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setComponentType("UISlider");
		this.#value = 0;
		this.#minValue = 0;
		this.#maxValue = 1;
		this.#trackColor = new Color(0.7, 0.7, 0.7, 1);
		this.#fillColor = new Color(0.23, 0.51, 0.96, 1); // blue-500 근사
		this.#thumbColor = new Color(1, 1, 1, 1);
		this.#thumbRadius = 16;
		this.#trackThickness = 0;
		this.#thumbNode = null;
		this.#cornerRadius = 0;
		this.#direction = ProgressDirection.horizontal;
		this.#isDragging = false;
		this.#isInteractable = true;
		this.#valueChangedEvent = null;
	}

	//==============================================================================
	// 노드에 붙음. (WorldNode 의 isInteractable 을 자동 활성화)
	//==============================================================================
	/**
	 * @override
	 * @param { ComponentNode } node 붙을 노드.
	 */
	attach(node) {
		super.attach(node);
		if (node instanceof WorldNode) {
			node.setInteractable(true);
		}
	}

	//==============================================================================
	// 출력. (트랙 + 채움 + thumb)
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic 그래픽.
	 */
	draw(graphic) {
		const node = this.getNode();
		if (!node) {
			return;
		}
		const contentSize = node.getContentSize();
		if (contentSize.x <= 0 || contentSize.y <= 0) {
			return;
		}

		// 트랙. (두께를 정했으면 노드 가운데에 그 두께로 그린다)
		const trackThickness = this.#trackThickness;
		let trackRect = Rect.create(0, 0, contentSize.x, contentSize.y);
		if (trackThickness > 0) {
			if (this.#direction === ProgressDirection.vertical) {
				trackRect = Rect.create((contentSize.x - trackThickness) * 0.5, 0, trackThickness, contentSize.y);
			}
			else {
				trackRect = Rect.create(0, (contentSize.y - trackThickness) * 0.5, contentSize.x, trackThickness);
			}
		}
		graphic.setFillColor(this.#trackColor);
		if (this.#cornerRadius > 0) {
			graphic.drawRoundRect(trackRect, this.#cornerRadius);
		}
		else {
			graphic.drawRect(trackRect);
		}

		// 채움.
		const ratio = this.getRatio();
		if (ratio > 0) {
			let fillRect;
			if (this.#direction === ProgressDirection.vertical) {
				const fillHeight = contentSize.y * ratio;
				fillRect = Rect.create(trackRect.position.x, contentSize.y - fillHeight, trackRect.size.x, fillHeight);
			}
			else {
				const fillWidth = contentSize.x * ratio;
				fillRect = Rect.create(0, trackRect.position.y, fillWidth, trackRect.size.y);
			}
			graphic.setFillColor(this.#fillColor);
			if (this.#cornerRadius > 0) {
				graphic.drawRoundRect(fillRect, this.#cornerRadius);
			}
			else {
				graphic.drawRect(fillRect);
			}
		}

		// thumb 위치.
		let thumbX;
		let thumbY;
		if (this.#direction === ProgressDirection.vertical) {
			thumbX = contentSize.x * 0.5;
			thumbY = contentSize.y * (1 - ratio);
		}
		else {
			thumbX = contentSize.x * ratio;
			thumbY = contentSize.y * 0.5;
		}

		// thumb 노드를 지정했으면 그 노드를 자리에 옮기고 원은 그리지 않는다.
		if (this.#thumbNode) {
			const thumbSize = this.#thumbNode.getContentSize();
			this.#thumbNode.setLocalPosition(Vector2.create(thumbX - thumbSize.x * 0.5, thumbY - thumbSize.y * 0.5));
			return;
		}

		// thumb 그리기 (원).
		graphic.setFillColor(this.#thumbColor);
		graphic.drawCircle(Vector2.create(thumbX, thumbY), this.#thumbRadius);
	}

	//==============================================================================
	// 터치 누름.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 누른 자리. (뷰 좌표)
	 */
	touchPress(viewInputPosition) {
		if (!this.#isInteractable) {
			return;
		}
		this.#isDragging = true;
		this.updateValueFromInput(viewInputPosition);
	}

	//==============================================================================
	// 터치 이동.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 옮긴 자리. (뷰 좌표)
	 */
	touchMove(viewInputPosition) {
		if (!this.#isDragging) {
			return;
		}
		this.updateValueFromInput(viewInputPosition);
	}

	//==============================================================================
	// 터치 뗌.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 뗀 자리. (뷰 좌표)
	 */
	touchRelease(viewInputPosition) {
		if (!this.#isDragging) {
			return;
		}
		this.updateValueFromInput(viewInputPosition);
		this.#isDragging = false;
	}

	//==============================================================================
	// 터치 취소.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 취소된 때의 자리. (뷰 좌표)
	 */
	touchCancel(viewInputPosition) {
		this.#isDragging = false;
	}

	//==============================================================================
	// 입력 좌표 → 값 갱신 + 콜백.
	//==============================================================================
	/**
	 * @private
	 * @param { Vector2 } viewInputPosition
	 */
	updateValueFromInput(viewInputPosition) {
		const node = this.getNode();
		if (!node) {
			return;
		}
		const corners = node.getWorldCorners();
		if (!corners || corners.length < 1) {
			return;
		}
		const topLeft = corners[0];
		const localX = viewInputPosition.x - topLeft.x;
		const localY = viewInputPosition.y - topLeft.y;
		const contentSize = node.getContentSize();

		let ratio;
		if (this.#direction === ProgressDirection.vertical) {
			ratio = contentSize.y > 0 ? 1 - (localY / contentSize.y) : 0;
		}
		else {
			ratio = contentSize.x > 0 ? (localX / contentSize.x) : 0;
		}
		ratio = Math.clamp(ratio, 0, 1);

		const previousValue = this.#value;
		const newValue = this.#minValue + (this.#maxValue - this.#minValue) * ratio;
		this.setValue(newValue);

		if (this.#value !== previousValue && this.#valueChangedEvent) {
			this.#valueChangedEvent(this);
		}
	}

	//==============================================================================
	// 값/범위/비율.
	//==============================================================================
	/**
	 * @returns { number } 범위 안에서 값의 비율. (0 ~ 1, 범위가 0 이하면 0)
	 */
	getRatio() {
		const range = this.#maxValue - this.#minValue;
		if (range <= 0) {
			return 0;
		}
		const r = (this.#value - this.#minValue) / range;
		return Math.clamp(r, 0, 1);
	}

	//==============================================================================
	// 값 설정. (범위 안으로 자른다, 값 바뀜 이벤트는 부르지 않는다)
	//==============================================================================
	/** @param { number } value 새 값. (minValue ~ maxValue) */
	setValue(value) {
		this.#value = Math.clamp(value, this.#minValue, this.#maxValue);
	}
	//==============================================================================
	// 값 반환.
	//==============================================================================
	/**
	 * @returns { number } 지금 값. (기본 0)
	 */
	getValue() { return this.#value; }

	//==============================================================================
	// 범위 설정. (지금 값도 새 범위 안으로 자른다)
	//==============================================================================
	/**
	 * @param { number } minValue 가장 작은 값. (기본 0)
	 * @param { number } maxValue 가장 큰 값. (기본 1)
	 */
	setRange(minValue, maxValue) {
		this.#minValue = minValue;
		this.#maxValue = maxValue;
		this.setValue(this.#value);
	}
	//==============================================================================
	// 가장 작은 값 반환.
	//==============================================================================
	/**
	 * @returns { number } 가장 작은 값.
	 */
	getMinValue() { return this.#minValue; }
	//==============================================================================
	// 가장 큰 값 반환.
	//==============================================================================
	/**
	 * @returns { number } 가장 큰 값.
	 */
	getMaxValue() { return this.#maxValue; }

	//==============================================================================
	// 외부 setValue 후 콜백을 강제 호출하고 싶을 때.
	//==============================================================================
	fireValueChanged() {
		if (this.#valueChangedEvent) {
			this.#valueChangedEvent(this);
		}
	}

	//==============================================================================
	// 색상.
	//==============================================================================
	/** @param { Color } color 트랙 색. (기본 new Color(0.7, 0.7, 0.7, 1)) */ setTrackColor(color) { this.#trackColor = color; }
	//==============================================================================
	// 트랙 색 반환.
	//==============================================================================
	/**
	 * @returns { Color } 트랙 색.
	 */
	getTrackColor() { return this.#trackColor; }

	//==============================================================================
	// 채움 색 설정.
	//==============================================================================
	/** @param { Color } color 값까지 채우는 색. (기본 new Color(0.23, 0.51, 0.96, 1)) */ setFillColor(color) { this.#fillColor = color; }
	//==============================================================================
	// 채움 색 반환.
	//==============================================================================
	/**
	 * @returns { Color } 채움 색.
	 */
	getFillColor() { return this.#fillColor; }

	//==============================================================================
	// 손잡이 색 설정.
	//==============================================================================
	/** @param { Color } color 손잡이 원의 색. (기본 흰색, 손잡이 노드를 정했으면 쓰지 않는다) */ setThumbColor(color) { this.#thumbColor = color; }
	//==============================================================================
	// 손잡이 색 반환.
	//==============================================================================
	/**
	 * @returns { Color } 손잡이 원의 색.
	 */
	getThumbColor() { return this.#thumbColor; }

	//==============================================================================
	// 모양.
	//==============================================================================
	/** @param { number } radius 손잡이 원의 반지름. (기본 16, 손잡이 노드를 정했으면 쓰지 않는다) */ setThumbRadius(radius) { this.#thumbRadius = radius; }
	//==============================================================================
	// 손잡이 반지름 반환.
	//==============================================================================
	/**
	 * @returns { number } 손잡이 원의 반지름.
	 */
	getThumbRadius() { return this.#thumbRadius; }

	//==============================================================================
	// 트랙 두께 설정. (노드 가운데에 이 두께로 그린다)
	//==============================================================================
	/** @param { number } thickness 트랙 두께. (0 이하면 노드 전체, 기본 0) */ setTrackThickness(thickness) { this.#trackThickness = thickness; }
	//==============================================================================
	// 트랙 두께 반환.
	//==============================================================================
	/**
	 * @returns { number } 트랙 두께. (0 이면 노드 전체)
	 */
	getTrackThickness() { return this.#trackThickness; }

	//==============================================================================
	// 손잡이 노드 설정. (정하면 원을 그리지 않고 이 노드를 손잡이 자리로 옮긴다)
	//==============================================================================
	/**
	 * @param { WorldNode } node 손잡이로 쓸 노드. (슬라이더 노드의 자식, 왼쪽 위 피봇과 앵커로 둔다, null 이면 원을 그린다)
	 * @example <caption>그림 노드를 손잡이로 쓰기</caption>
	 * import { Engine, EngineConfiguration, UIScene, UISlider, Paint, WorldNode, Pivot, Vector2, Color } from "./build/vanilla.js";
	 *
	 * class MainScene extends UIScene {
	 * 	constructor() {
	 * 		super();
	 * 		this.setLoadingMinDurationMs(0);
	 * 	}
	 *
	 * 	initialize(engine) {
	 * 		super.initialize(engine);
	 * 		const sliderNode = new WorldNode();
	 * 		sliderNode.setPivot(Pivot.topLeft);
	 * 		sliderNode.setAnchor(Pivot.topLeft);
	 * 		sliderNode.setLocalPosition(Vector2.create(40, 60));
	 * 		sliderNode.setContentSize(Vector2.create(240, 24));
	 * 		const slider = sliderNode.addComponent(UISlider);
	 * 		slider.setTrackThickness(4);
	 *
	 * 		const thumbNode = new WorldNode();
	 * 		thumbNode.setPivot(Pivot.topLeft);
	 * 		thumbNode.setAnchor(Pivot.topLeft);
	 * 		thumbNode.setContentSize(Vector2.create(20, 28));
	 * 		const thumbPaint = thumbNode.addComponent(Paint);
	 * 		thumbPaint.setColor(new Color(1, 0.6, 0.2, 1));
	 * 		thumbPaint.setRoundSize(6);
	 * 		sliderNode.addChild(thumbNode);
	 * 		slider.setThumbNode(thumbNode);
	 * 		slider.setValue(0.3);
	 *
	 * 		const root = this.getRoot();
	 * 		root.addChild(sliderNode);
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
	setThumbNode(node) { this.#thumbNode = node; }
	//==============================================================================
	// 손잡이 노드 반환.
	//==============================================================================
	/**
	 * @returns { WorldNode } 손잡이 노드. (없으면 null)
	 */
	getThumbNode() { return this.#thumbNode; }

	//==============================================================================
	// 모서리 둥글기 설정.
	//==============================================================================
	/** @param { number } radius 트랙과 채움의 모서리 반지름. (0 이하면 각진 사각형, 기본 0) */ setCornerRadius(radius) { this.#cornerRadius = radius; }
	//==============================================================================
	// 모서리 둥글기 반환.
	//==============================================================================
	/**
	 * @returns { number } 트랙과 채움의 모서리 반지름.
	 */
	getCornerRadius() { return this.#cornerRadius; }

	//==============================================================================
	// 방향 설정.
	//==============================================================================
	/** @param { string } direction 방향. (horizontal 이면 왼쪽에서 오른쪽, vertical 이면 아래에서 위로 찬다, 기본 horizontal) */ setDirection(direction) { this.#direction = direction; }
	//==============================================================================
	// 방향 반환.
	//==============================================================================
	/**
	 * @returns { string } 방향. (horizontal 이나 vertical)
	 */
	getDirection() { return this.#direction; }

	//==============================================================================
	// 콜백 / 인터랙션.
	//==============================================================================
	/** @param { (slider: UISlider) => void } callback 누르거나 끌어 값이 바뀌면 부를 함수. (인자는 이 슬라이더, setValue 로 바꿀 때는 부르지 않는다, null 이면 부르지 않는다) */
	setValueChangedEvent(callback) { this.#valueChangedEvent = callback; }
	//==============================================================================
	// 값 바뀜 이벤트 반환.
	//==============================================================================
	/**
	 * @returns { (slider: UISlider) => void } 값 바뀜 이벤트 함수. (없으면 null)
	 */
	getValueChangedEvent() { return this.#valueChangedEvent; }

	//==============================================================================
	// 입력 받기 설정.
	//==============================================================================
	/** @param { boolean } isInteractable 거짓이면 새 누름을 받지 않는다. (기본 참) */
	setInteractable(isInteractable) { this.#isInteractable = isInteractable; }
	//==============================================================================
	// 입력 받기 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 누름을 받으면 참.
	 */
	getInteractable() { return this.#isInteractable; }

	//==============================================================================
	// 끄는 중인지.
	//==============================================================================
	/** @returns { boolean } 누른 뒤 떼거나 취소하기 전까지 참. */
	isDragging() { return this.#isDragging; }
}
