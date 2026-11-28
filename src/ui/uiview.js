//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Color } from "../base/color.js";
import { Pivot } from "../base/pivot.js";
import { Rect } from "../base/rect.js";
import { Vector2 } from "../base/vector2.js";
import { Component } from "../core/component.js";
import { Engine } from "../core/engine.js";
import { Graphic } from "../core/graphic.js";
import { ScreenEffect } from "../effect/screeneffect.js";
import { WorldNode } from "../core/node/worldnode.js";

const geometryKeyContentSize = Vector2.zero(); // writeGeometryKey 가 노드의 내용 크기를 복제본 없이 받는 곳.


//==============================================================================
// 뷰 컴포넌트.
// - ScrollView, SnapScrollView 등 모든 뷰 컴포넌트의 기반 클래스.
// - 타입으로 하위 뷰 컴포넌트를 한번에 조회할 수 있다.
//   예: node.getComponent(View)
// - 컨테이너 역할을 하므로 UIControl 을 상속하지 않고 Component 직접 상속.
//   대신 UIControl 이 갖던 setEngine/getEngine 를 자체적으로 보유한다.
//==============================================================================
/**
 * @example <caption>배경색이 있는 판에 라벨 담기</caption>
 * import { Engine, EngineConfiguration, UIScene, UIView, UILabel, WorldNode, Pivot, Vector2, Color } from "./build/vanilla.js";
 *
 * class MainScene extends UIScene {
 * 	constructor() {
 * 		super();
 * 		this.setLoadingMinDurationMs(0);
 * 	}
 *
 * 	initialize(engine) {
 * 		super.initialize(engine);
 * 		const panelNode = new WorldNode();
 * 		panelNode.setPivot(Pivot.topLeft);
 * 		panelNode.setAnchor(Pivot.topLeft);
 * 		panelNode.setLocalPosition(Vector2.create(40, 40));
 * 		panelNode.setContentSize(Vector2.create(240, 160));
 * 		const view = panelNode.addComponent(UIView);
 * 		view.setBackgroundColor(new Color(0.1, 0.12, 0.16, 1));
 *
 * 		const labelNode = new WorldNode();
 * 		labelNode.setPivot(Pivot.topLeft);
 * 		labelNode.setAnchor(Pivot.topLeft);
 * 		labelNode.setLocalPosition(Vector2.create(16, 16));
 * 		labelNode.setContentSize(Vector2.create(208, 32));
 * 		const label = labelNode.addComponent(UILabel);
 * 		label.setText("Panel");
 * 		label.setFontSize(20);
 * 		const content = view.getContent();
 * 		content.addChild(labelNode);
 *
 * 		const root = this.getRoot();
 * 		root.addChild(panelNode);
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
export class UIView extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Engine } */ #engine;
	/** @private @type { WorldNode | null } */ #content; // 컨텐트 노드.
	/** @private @type { Color } */ #backgroundColor;
	/** @private @type { number } */ #backdropBlurRadius; // 뒤 화면 흐림 반지름. (픽셀, 0 이면 끔)
	/** @private @type { ScreenEffect | null } */ #backdropScreenEffect; // 뒤 화면을 흐릴 화면 효과. (처음 흐릴 때 만든다)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.setComponentType("View");
		this.#engine = null;
		this.#content = null;
		this.#backgroundColor = new Color(1, 1, 1, 0);
		this.#backdropBlurRadius = 0;
		this.#backdropScreenEffect = null;
	}

	//==============================================================================
	// 엔진 설정. (구 UIComponent 에서 이관)
	//==============================================================================
	/**
	 * @param { Engine } engine 엔진.
	 */
	setEngine(engine) {
		this.#engine = engine;
	}

	//==============================================================================
	// 엔진 반환. (구 UIComponent 에서 이관)
	//==============================================================================
	/**
	 * @returns { Engine | null } setEngine 으로 준 엔진. (주지 않았으면 null)
	 */
	getEngine() {
		return this.#engine;
	}

	//==============================================================================
	// 노드에 붙음.
	//==============================================================================
	/**
	 * @override
	 * @param { ComponentNode } node 붙을 노드.
	 */
	attach(node) {
		super.attach(node);

		// 컨텐트 노드 추가. 부모 좌상단에 anchor (0,0) 으로 정렬.
		this.#content = new WorldNode();
		this.#content.setName("content");
		this.#content.setPivot(Pivot.topLeft);
		this.#content.setAnchor(Vector2.zero());
		this.#content.setAnchoredPosition(Vector2.zero());
		const content = this.getContent();
		node.addChild(content);
	}

	//==============================================================================
	// 노드에서 떨어짐.
	//==============================================================================
	/**
	 * @override
	 * @param { ComponentNode } node 떨어질 노드.
	 */
	detach(node) {
		super.detach(node);
	}

	//==============================================================================
	// 내용 영역 안에서만 그리는지 반환. (배경은 내용 크기의 사각형만 칠한다, 화면 밖과 자르기 밖 거르기가 쓴다)
	// - draw 를 덮어쓴 하위 클래스는 어디에 그리는지 모르므로 false. (그 클래스가 이 함수도 덮어써 알린다)
	//==============================================================================
	/**
	 * @override
	 * @returns { boolean } 내용 영역 안에서만 그리면 참.
	 */
	isDrawnInsideContent() {
		return this.draw === UIView.prototype.draw;
	}

	//==============================================================================
	// 그리기 입력을 기하 캐시 열쇠에 적기. (배경색, 내용 크기)
	// - draw 를 덮어쓴 하위 클래스는 무엇을 읽는지 모르므로 false. (그 클래스가 이 함수도 덮어써 알린다)
	//==============================================================================
	/**
	 * @override
	 * @param { GeometryKey } geometryKey 입력을 적을 열쇠.
	 * @returns { boolean } 입력을 적었으면 참.
	 */
	writeGeometryKey(geometryKey) {
		if (this.draw !== UIView.prototype.draw || this.#backdropBlurRadius > 0) {
			return false;
		}
		const node = this.getNode();
		if (!node) {
			return false;
		}
		const backgroundColor = this.getBackgroundColor();
		geometryKey.add(backgroundColor.red);
		geometryKey.add(backgroundColor.green);
		geometryKey.add(backgroundColor.blue);
		geometryKey.add(backgroundColor.alpha);
		const contentSize = geometryKeyContentSize;
		if (typeof node.copyContentSizeTo === "function") {
			node.copyContentSizeTo(contentSize);
		}
		else {
			const nodeContentSize = node.getContentSize();
			contentSize.set(nodeContentSize.x, nodeContentSize.y);
		}
		geometryKey.add(contentSize.x);
		geometryKey.add(contentSize.y);
		return true;
	}

	//==============================================================================
	// 출력. (배경색이 설정된 경우 스크롤뷰 영역에 배경을 그린다)
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

		// 뒤 화면 흐림. (바탕색보다 먼저, 이미 그려진 뒤 화면을 이 뷰 자리만 흐린다)
		if (this.#backdropBlurRadius > 0) {
			this.drawBackdropBlur(graphic, node);
		}

		//  컨텐트 영역 출력.
		// 투명한 바탕은 그리지 않는다. (보이지 않는 드로우가 묶어 그리기를 끊지 않게)
		const backgroundColor = this.getBackgroundColor();
		if (backgroundColor.alpha <= 0) {
			return;
		}
		const contentSize = node.getContentSize();
		const backgroundRect = Rect.create(0, 0, contentSize.x, contentSize.y);
		graphic.setFillColor(backgroundColor);
		graphic.drawRect(backgroundRect);
	}

	//==============================================================================
	// 뒤 화면 흐리기. (draw 가 부른다)
	// - 먼저 그린 것을 화면에 내보내고, 이 뷰의 내용 영역이 화면에서 차지한 사각형(변환한 네 귀퉁이의 경계 상자, 기기 픽셀)만 ScreenEffect 의 흐림(blur)으로 흐려 같은 자리에 되돌린다.
	// - 화면(기본 프레임버퍼)을 그릴 때만 한다. 렌더 타겟에 그리는 중이면 흐리지 않는다.
	//==============================================================================
	/**
	 * @private
	 * @param { Graphic } graphic 그래픽.
	 * @param { WorldNode } node 이 뷰의 노드.
	 */
	drawBackdropBlur(graphic, node) {
		const contentSize = node.getContentSize();
		if (!(contentSize.x > 0 && contentSize.y > 0)) {
			return;
		}
		const transformMatrix = graphic.getTransformMatrix();
		const cornerList = [
			transformMatrix.transformPoint(0, 0),
			transformMatrix.transformPoint(contentSize.x, 0),
			transformMatrix.transformPoint(contentSize.x, contentSize.y),
			transformMatrix.transformPoint(0, contentSize.y),
		];
		let leftX = System.Infinity;
		let topY = System.Infinity;
		let rightX = -System.Infinity;
		let bottomY = -System.Infinity;
		for (const corner of cornerList) {
			leftX = System.Math.min(leftX, corner.x);
			topY = System.Math.min(topY, corner.y);
			rightX = System.Math.max(rightX, corner.x);
			bottomY = System.Math.max(bottomY, corner.y);
		}
		const regionX = System.Math.round(leftX);
		const regionY = System.Math.round(topY);
		const regionWidth = System.Math.round(rightX) - regionX;
		const regionHeight = System.Math.round(bottomY) - regionY;
		if (regionWidth <= 0 || regionHeight <= 0) {
			return;
		}
		graphic.runExternalPass((webGL2RenderingContext) => {
			if (webGL2RenderingContext.getParameter(webGL2RenderingContext.FRAMEBUFFER_BINDING) !== null) {
				return;
			}
			let screenEffect = this.#backdropScreenEffect;
			if (screenEffect === null) {
				screenEffect = new ScreenEffect();
				screenEffect.setEnabled("blur", true);
				this.#backdropScreenEffect = screenEffect;
			}
			screenEffect.setParameters("blur", this.#backdropBlurRadius);
			screenEffect.setRegion(regionX, regionY, regionWidth, regionHeight);
			screenEffect.begin(graphic);
			screenEffect.end(graphic);
		}, { clearDepth: false });
	}

	//==============================================================================
	// 뒤 화면 흐림 설정. (CSS backdrop-filter: blur(), 언리얼 UMG BackgroundBlur 와 같은 뜻)
	// - 켜면 이 뷰가 그려질 때, 그보다 먼저 그려진 화면을 이 뷰의 내용 영역만 흐리고 그 위에 배경색(반투명)을 얹는다.
	// - 흐림은 ScreenEffect 의 blur 와 같은 가우스 근사다. 반지름은 그 blur 의 반지름(기기 픽셀)이다.
	// - 화면에 그릴 때만 된다. (렌더 타겟에 그리는 중이면 흐리지 않는다) 켜진 동안은 기하 캐시를 쓰지 않는다. (매 그리기마다 화면을 읽는다)
	//==============================================================================
	/**
	 * @param { number } blurRadius 흐림 반지름. (기기 픽셀, 0 이하면 끈다, 처음은 0)
	 * @example <caption>반투명 패널 뒤를 흐리기</caption>
	 * import { UIView, Color } from "./build/vanilla.js";
	 *
	 * const view = new UIView();
	 * view.setBackgroundColor(new Color(1, 1, 1, 0.25));
	 * view.setBackdropBlur(6);
	 * console.log(view.getBackdropBlur());
	 */
	setBackdropBlur(blurRadius) {
		this.#backdropBlurRadius = System.Math.max(0, blurRadius);
	}

	//==============================================================================
	// 뒤 화면 흐림 반지름 반환.
	//==============================================================================
	/**
	 * @returns { number } 흐림 반지름. (기기 픽셀, 0 이면 꺼짐)
	 */
	getBackdropBlur() {
		return this.#backdropBlurRadius;
	}

	//==============================================================================
	// 터치 누름. (TouchRaycaster → WorldNode)
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } viewInputPosition 누른 자리. (뷰 좌표)
	 */
	touchPress(viewInputPosition) {
	}

	//==============================================================================
	// 터치 이동. (TouchRaycaster → WorldNode)
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } viewInputPosition 옮긴 자리. (뷰 좌표)
	 */
	touchMove(viewInputPosition) {
		// if (this.isDragging()) {
		// 	//
		// }
	}

	//==============================================================================
	// 터치 뗌. (TouchRaycaster → WorldNode)
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } viewInputPosition 뗀 자리. (뷰 좌표)
	 */
	touchRelease(viewInputPosition) {
	}

	//==============================================================================
	// 터치 취소. (TouchRaycaster → WorldNode)
	//==============================================================================
	/**
	 * @virtual
	 * @param { Vector2 } viewInputPosition 취소된 때의 자리. (뷰 좌표)
	 */
	touchCancel(viewInputPosition) {
	}

	//==============================================================================
	// 콘텐츠 노드 반환. (자식 노드를 이 노드에 추가하면 스크롤 대상이 됨)
	//==============================================================================
	/**
	 * @returns { WorldNode } 컨텐트 노드. (노드에 붙기 전이면 null)
	 */
	getContent() {
		return this.#content;
	}

	//==============================================================================
	// 배경색 설정. (null 이면 배경을 지운다)
	//==============================================================================
	/**
	 * @param { Color | null } backgroundColor 배경색. (사본을 담는다, 알파가 0 이면 그리지 않는다, null 이나 undefined 면 처음 값인 알파 0 흰색으로 돌려 그리지 않는다)
	 * @example <caption>배경을 칠했다가 지우기</caption>
	 * import { UIView, Color } from "./build/vanilla.js";
	 *
	 * const view = new UIView();
	 * view.setBackgroundColor(new Color(0.1, 0.12, 0.16, 1));
	 * const paintedColor = view.getBackgroundColor();
	 * view.setBackgroundColor(null);
	 * const clearedColor = view.getBackgroundColor();
	 * console.log(paintedColor.alpha, clearedColor.alpha);
	 */
	setBackgroundColor(backgroundColor) {
		backgroundColor = Color.from(backgroundColor);
		if (backgroundColor === null || backgroundColor === undefined) {
			this.#backgroundColor = new Color(1, 1, 1, 0);
			return;
		}
		this.#backgroundColor = backgroundColor.clone();
	}

	//==============================================================================
	// 배경색 반환.
	//==============================================================================
	/**
	 * @returns { Color } 배경색. (기본은 알파가 0 인 흰색)
	 */
	getBackgroundColor() {
		return this.#backgroundColor;
	}
}


//==============================================================================
// 뷰 좌표의 점이 노드 내용 영역 안인지. (부모들의 변환을 모두 거친 네 귀퉁이로 본다, 러스트 판 ui::uiview::is_view_position_inside_node)
//==============================================================================
/**
 * @param { WorldNode | null } node 볼 노드. (없으면 거짓)
 * @param { Vector2 } viewPosition 뷰 좌표의 점. (픽셀)
 * @returns { boolean } 노드 contentSize 영역 안이면 참.
 * @example <caption>가운데 피봇(기본)인 40 x 20 노드의 안과 밖</caption>
 * import { isViewPositionInsideNode, Vector2, WorldNode } from "./build/vanilla.js";
 *
 * const rootNode = new WorldNode();
 * const buttonNode = new WorldNode();
 * rootNode.addChild(buttonNode);
 * buttonNode.setLocalPosition(Vector2.create(100, 100));
 * buttonNode.setContentSize(Vector2.create(40, 20));
 * console.log(isViewPositionInsideNode(buttonNode, Vector2.create(100, 100)));
 * console.log(isViewPositionInsideNode(buttonNode, Vector2.create(81, 91)));
 * console.log(isViewPositionInsideNode(buttonNode, Vector2.create(79, 100)));
 */
export function isViewPositionInsideNode(node, viewPosition) {
	if (node === null || node === undefined || typeof node.contains !== "function") {
		return false;
	}
	return node.contains(viewPosition);
}
