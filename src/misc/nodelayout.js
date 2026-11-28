//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import * as Math from "../base/math.js";
import { WorldNode } from "../core/node/worldnode.js";
import { Vector2 } from "../base/vector2.js";
import { Object } from "../base/object.js";
import { Mask } from "../core/component/mask.js";


//==============================================================================
// 노드 레이아웃.
// - 지역 변수 없이 노드 계층 구조를 선언적으로 구성하는 플루언트 빌더.
// - Unreal Slate / Flutter 위젯과 유사한 구조.
// - Vector2 없이 숫자쌍(x, y)으로 모든 위치/크기를 지정한다.
// - create(nodeClass)로 노드 타입을 지정한다. (기본값: WorldNode)
//
// 사용 예:
//   const panel = NodeLayout.create(WorldNode)
//       .pivot(Pivot.middleCenter)
//       .contentSize(680, 900)
//       .component(Paint, (c) => { c.setColor(new Color(0.1, 0.1, 0.1, 1)); })
//       .children(
//           NodeLayout.create(WorldNode)
//               .contentSize(120, 70)
//               .component(Text, (c) => { c.setText("확인"); })
//       )
//       .build();
//==============================================================================
/**
 * @example <caption>패널과 단추를 한 번에 선언해 뿌리에 붙이기</caption>
 * import { Engine, EngineConfiguration, Scene, NodeLayout, WorldNode, Paint, Pivot, Color } from "./build/vanilla.js";
 *
 * class MainScene extends Scene {
 * 	initialize(engine) {
 * 		super.initialize(engine);
 * 		const root = this.getRoot();
 * 		const panelLayout = NodeLayout.create(WorldNode)
 * 			.name("panel")
 * 			.pivot(Pivot.middleCenter)
 * 			.localPosition(320, 180)
 * 			.contentSize(300, 160)
 * 			.component(Paint, (paint) => {
 * 				paint.setColor(new Color(0.1, 0.1, 0.1, 1));
 * 			})
 * 			.children(
 * 				NodeLayout.create(WorldNode)
 * 					.name("button")
 * 					.pivot(Pivot.middleCenter)
 * 					.localPosition(150, 110)
 * 					.contentSize(120, 40)
 * 					.component(Paint, (paint) => {
 * 						paint.setColor(new Color(0.2, 0.6, 1, 1));
 * 					})
 * 			);
 * 		const panelNode = panelLayout.build(root);
 * 		console.log(panelNode.getName(), panelNode.getChildCount());
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
export class NodeLayout extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { * } */ #node;
	/** @private @type { NodeLayout[] } */ #childLayouts;
	/** @private @type { * } */ #parentNode;
	/** @private @type { { position: Vector2, anchor: Vector2 } | null } */ #pendingAnchoredPosition; // build 때 부모에 붙인 뒤 걸 앵커 기준 위치와 그때의 앵커.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { Function } [nodeClass] 만들 노드의 클래스. (없으면 WorldNode)
	 */
	constructor(nodeClass) {
		super();
		const NodeClass = nodeClass ?? WorldNode;
		this.#node = new NodeClass();
		this.#childLayouts = [];
		this.#parentNode = null;
		this.#pendingAnchoredPosition = null;
	}

	//==============================================================================
	// 부채꼴 배치. (정적, 손패 카드처럼 노드들을 호 위에 펼친다)
	// - 가운데 항목이 baseAngleRadian 방향(기본 위쪽)을 보도록 좌우 대칭으로 벌린다.
	// - rotateNodes 가 참이면 각 노드의 회전도 호의 접선에 맞춘다. (노드의 회전은 도 단위라 라디안을 도로 바꿔 건다)
	//==============================================================================
	/**
	 * @param { WorldNode[] } nodeList 펼칠 노드 목록.
	 * @param { object } options { centerX, centerY, radius, angleStepRadian = 0.12, baseAngleRadian = -PI/2, rotateNodes = true }
	 * @example <caption>손패 카드 다섯 장을 호 위에 펼치기</caption>
	 * import { NodeLayout, WorldNode } from "./build/vanilla.js";
	 *
	 * const cardList = [];
	 * for (let index = 0; index < 5; ++index) {
	 * 	cardList.push(new WorldNode());
	 * }
	 * NodeLayout.arrangeFan(cardList, { centerX: 320, centerY: 600, radius: 400, angleStepRadian: 0.12 });
	 * for (const card of cardList) {
	 * 	const position = card.getLocalPosition();
	 * 	const rotation = card.getLocalRotation();
	 * 	console.log(position.x.toFixed(1), position.y.toFixed(1), rotation.toFixed(1));
	 * }
	 */
	static arrangeFan(nodeList, options) {
		const count = nodeList.length;
		if (count === 0) {
			return;
		}
		const angleStepRadian = (options.angleStepRadian !== undefined) ? options.angleStepRadian : 0.12;
		const baseAngleRadian = (options.baseAngleRadian !== undefined) ? options.baseAngleRadian : -System.Math.PI / 2;
		const rotateNodes = (options.rotateNodes !== undefined) ? options.rotateNodes : true;
		const middleIndex = (count - 1) / 2;
		for (let index = 0; index < count; ++index) {
			const node = nodeList[index];
			const angleRadian = baseAngleRadian + (index - middleIndex) * angleStepRadian;
			const positionX = options.centerX + System.Math.cos(angleRadian) * options.radius;
			const positionY = options.centerY + System.Math.sin(angleRadian) * options.radius;
			node.setLocalPosition(Vector2.create(positionX, positionY));
			if (rotateNodes) {
				const rotationDegree = Math.radianToDegree(angleRadian - baseAngleRadian);
				node.setLocalRotation(rotationDegree);
			}
		}
	}

	//==============================================================================
	// 레이아웃 인스턴스 생성.
	//==============================================================================
	/**
	 * @param { Function } [nodeClass] 만들 노드의 클래스. (없으면 WorldNode)
	 * @returns { NodeLayout } 새 레이아웃.
	 */
	static create(nodeClass) {
		const nodeLayout = new NodeLayout(nodeClass);
		return nodeLayout;
	}

	//==============================================================================
	// 노드 직접 접근. (빌더에 없는 속성을 설정할 때 사용)
	//==============================================================================
	/**
	 * @param { Function } callback 노드를 받아 직접 고칠 함수. (node) => void
	 * @returns { NodeLayout } 이 레이아웃. (이어 부르기용)
	 */
	apply(callback) {
		callback(this.#node);
		return this;
	}

	//==============================================================================
	// 활성화 설정.
	//==============================================================================
	/**
	 * @param { boolean } active 참이면 노드를 켠다.
	 * @returns { NodeLayout } 이 레이아웃. (이어 부르기용)
	 */
	active(active) {
		this.#node.setActive(active);
		return this;
	}

	//==============================================================================
	// 이름 설정.
	//==============================================================================
	/**
	 * @param { string } name 노드 이름.
	 * @returns { NodeLayout } 이 레이아웃. (이어 부르기용)
	 */
	name(name) {
		this.#node.setName(name);
		return this;
	}

	//==============================================================================
	// 컴포넌트 추가 및 설정.
	// - callback이 없으면 컴포넌트만 추가한다.
	//==============================================================================
	/**
	 * @param { Function } componentType 더할 컴포넌트 클래스.
	 * @param { Function } [callback] 더한 컴포넌트를 받아 설정할 함수. (component) => void, 없으면 더하기만 한다
	 * @returns { NodeLayout } 이 레이아웃. (이어 부르기용)
	 */
	component(componentType, callback) {
		const component = this.#node.addComponent(componentType);
		if (callback) {
			callback(component);
		}
		return this;
	}

	//==============================================================================
	// 자식 레이아웃 추가.
	// - 가변 인자로 여러 자식 레이아웃을 한번에 추가할 수 있다.
	//==============================================================================
	/**
	 * @param { ...NodeLayout } layouts 자식으로 붙일 레이아웃들. (build 때 함께 빌드한다)
	 * @returns { NodeLayout } 이 레이아웃. (이어 부르기용)
	 */
	children(...layouts) {
		for (const layout of layouts) {
			this.#childLayouts.push(layout);
		}
		return this;
	}

	//==============================================================================
	// 로컬 위치 설정.
	//==============================================================================
	/**
	 * @param { number } x 지역 X 좌표.
	 * @param { number } y 지역 Y 좌표. (앞서 부른 anchoredPosition 은 버린다, 나중에 부른 것이 이긴다)
	 * @returns { NodeLayout } 이 레이아웃. (이어 부르기용)
	 */
	localPosition(x, y) {
		this.#node.setLocalPosition(Vector2.create(x, y));
		this.#pendingAnchoredPosition = null;
		return this;
	}

	//==============================================================================
	// 피벗 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } pivot 피벗. (0 ~ 1, Pivot 상수)
	 * @returns { NodeLayout } 이 레이아웃. (이어 부르기용)
	 */
	pivot(pivot) {
		this.#node.setPivot(pivot);
		return this;
	}

	//==============================================================================
	// 콘텐츠 크기 설정.
	//==============================================================================
	/**
	 * @param { number } x 콘텐츠 너비. (픽셀)
	 * @param { number } y 콘텐츠 높이. (픽셀)
	 * @returns { NodeLayout } 이 레이아웃. (이어 부르기용)
	 */
	contentSize(x, y) {
		this.#node.setContentSize(Vector2.create(x, y));
		return this;
	}

	//==============================================================================
	// 로컬 스케일 설정.
	//==============================================================================
	/**
	 * @param { number } x 가로 배율.
	 * @param { number } y 세로 배율.
	 * @returns { NodeLayout } 이 레이아웃. (이어 부르기용)
	 */
	localScale(x, y) {
		this.#node.setLocalScale(Vector2.create(x, y));
		return this;
	}

	//==============================================================================
	// 부모 노드 설정. (build()에 인자 없이 호출 시 이 부모에 자식으로 추가된다.)
	//==============================================================================
	/**
	 * @param { * } parentNode build 가 노드를 붙일 부모 노드.
	 * @returns { NodeLayout } 이 레이아웃. (이어 부르기용)
	 */
	parent(parentNode) {
		this.#parentNode = parentNode;
		return this;
	}

	//==============================================================================
	// 단일 앵커 설정. (WorldNode.setAnchor)
	//==============================================================================
	/**
	 * @param { number } x 앵커 X. (부모 크기 기준 비율, 0 ~ 1 로 자른다)
	 * @param { number } y 앵커 Y. (부모 크기 기준 비율, 0 ~ 1 로 자른다)
	 * @returns { NodeLayout } 이 레이아웃. (이어 부르기용)
	 */
	anchor(x, y) {
		this.#node.setAnchor(Vector2.create(x, y));
		return this;
	}

	//==============================================================================
	// 앵커 기준 위치 오프셋 설정.
	// - build 때 노드를 부모에 붙인 뒤 부모 contentSize 의 앵커 점 기준으로 건다. (빌드 중에는 노드에 아직 부모가 없다)
	// - 앵커는 이 메서드를 부를 때의 앵커를 쓴다. (앵커는 먼저 정한다, 나중에 부른 localPosition 이 이긴다)
	//==============================================================================
	/**
	 * @param { number } x 앵커 기준 X. (픽셀, build 에서 붙일 부모가 없으면 지역 X 로 들어간다)
	 * @param { number } y 앵커 기준 Y. (픽셀, build 에서 붙일 부모가 없으면 지역 Y 로 들어간다)
	 * @returns { NodeLayout } 이 레이아웃. (이어 부르기용)
	 * @example <caption>부모의 오른쪽 아래 귀퉁이에서 띄워 놓기</caption>
	 * import { NodeLayout, WorldNode } from "./build/vanilla.js";
	 *
	 * const panelNode = NodeLayout.create(WorldNode)
	 * 	.contentSize(680, 900)
	 * 	.children(
	 * 		NodeLayout.create(WorldNode)
	 * 			.name("corner")
	 * 			.anchor(1, 1)
	 * 			.anchoredPosition(-10, -20)
	 * 	)
	 * 	.build();
	 * const cornerNode = panelNode.findChildByName("corner");
	 * const localPosition = cornerNode.getLocalPosition();
	 * console.log(localPosition.x, localPosition.y);
	 */
	anchoredPosition(x, y) {
		const anchor = this.#node.getAnchor();
		this.#pendingAnchoredPosition = { position: Vector2.create(x, y), anchor: anchor.clone() };
		return this;
	}

	//==============================================================================
	// 마스크 활성화 설정.
	//==============================================================================
	/**
	 * @param { boolean } enabled 참이면 Mask 컴포넌트를 붙이고 거짓이면 뗀다.
	 * @returns { NodeLayout } 이 레이아웃. (이어 부르기용)
	 */
	maskEnabled(enabled) {
		if (enabled) {
			this.#node.getOrAddComponent(Mask);
		}
		else {
			const maskComponent = this.#node.getComponent(Mask);
			if (maskComponent) {
				this.#node.removeComponent(maskComponent);
			}
		}
		return this;
	}

	//==============================================================================
	// 빌드.
	// - 자식 레이아웃을 모두 재귀적으로 빌드한다.
	// - parent 인자가 제공되면 그 부모에 자식으로 추가한다.
	// - parent 인자가 없고 parent() 메서드로 지정된 부모가 있으면 그 부모에 자식으로 추가한다.
	// - 완성된 노드를 반환한다.
	//==============================================================================
	/**
	 * @param { * } [parent] 만든 노드를 붙일 부모. (없으면 parent() 로 정한 부모, 둘 다 없으면 붙이지 않는다)
	 * @returns { * } 만든 노드.
	 */
	build(parent) {
		for (const childLayout of this.#childLayouts) {
			childLayout.build(this.#node);
		}
		const targetParent = parent ?? this.#parentNode;
		if (targetParent) {
			targetParent.addChild(this.#node);
		}

		// 앵커 기준 위치. (부모에 붙은 뒤라 부모 contentSize 의 앵커 점을 안다, 부모가 WorldNode 가 아니면 지역 위치 그대로)
		const pendingAnchoredPosition = this.#pendingAnchoredPosition;
		if (pendingAnchoredPosition !== null) {
			const parentNode = this.#node.getParent();
			let anchorReferenceX = 0;
			let anchorReferenceY = 0;
			if (parentNode instanceof WorldNode) {
				const parentContentSize = parentNode.getContentSize();
				anchorReferenceX = parentContentSize.x * pendingAnchoredPosition.anchor.x;
				anchorReferenceY = parentContentSize.y * pendingAnchoredPosition.anchor.y;
			}
			const localPosition = Vector2.create(anchorReferenceX + pendingAnchoredPosition.position.x, anchorReferenceY + pendingAnchoredPosition.position.y);
			this.#node.setLocalPosition(localPosition);
		}
		return this.#node;
	}
}
