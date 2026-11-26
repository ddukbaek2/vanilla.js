//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";


//==============================================================================
// 맞을 수 있는 노드인지. (isInteractable 과 contains 가 있으면 WorldNode 가 아니어도 맞는다)
//==============================================================================
/**
 * @param { object } node 볼 노드.
 * @returns { boolean } 누를 수 있는지 묻고 자리를 품는지 잴 수 있으면 참.
 */
function isTouchableNode(node) {
	return typeof node.isInteractable === "function" && typeof node.contains === "function";
}


//==============================================================================
// 터치 레이캐스터.
// - 씬의 터치(Scene.tickTouch 가 씬의 레이캐스터에 넘긴다, Scene.setTouchRaycaster)를 받아
//   루트 노드 트리를 draw() 순서로 순회하고,
//   활성 + isInteractable() 노드 중 가장 앞(높은 번호)의 노드에
//   터치 이벤트를 전달한다.
// - 노드 종류는 가리지 않는다. isInteractable 과 contains 가 있는 노드는 WorldNode 가 아니어도(UINode 등) 맞을 수 있다.
//==============================================================================
/**
 * @example <caption>씬의 누름을 맨 앞 노드에 넘기기</caption>
 * import { Engine, EngineConfiguration, Scene, TouchRaycaster, WorldNode, Vector2 } from "./build/vanilla.js";
 *
 * class ButtonNode extends WorldNode {
 * 	touchPress(viewInputPosition) {
 * 		console.log("pressed", viewInputPosition.x, viewInputPosition.y);
 * 	}
 * }
 *
 * class MainScene extends Scene {
 * 	initialize(engine) {
 * 		const root = this.getRoot();
 * 		const buttonNode = new ButtonNode();
 * 		root.addChild(buttonNode);
 * 		buttonNode.setRect(100, 100, 200, 80);
 * 		buttonNode.setInteractable(true);
 * 		const touchRaycaster = this.getTouchRaycaster();
 * 		touchRaycaster.setFirstTouchCallback(() => {
 * 			console.log("first touch");
 * 		});
 * 		const hitNode = touchRaycaster.raycast(Vector2.create(150, 120));
 * 		console.log(hitNode === buttonNode, touchRaycaster instanceof TouchRaycaster);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
export class TouchRaycaster extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { * } */ #rootNode;
	/** @private @type { WorldNode | null } */ #touchTarget;
	/** @private @type { boolean } */ #hasEverTouched;
	/** @private @type { Function | null } */ #firstTouchCallback;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.#rootNode = null;
		this.#touchTarget = null;
		this.#hasEverTouched = false;
		this.#firstTouchCallback = null;
	}

	//==============================================================================
	// 터치 누름.
	// - raycast로 대상을 결정하고 touchPress를 전달한다.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 뷰 좌표의 입력 위치.
	 */
	touchPress(viewInputPosition) {
		if (!this.#hasEverTouched) {
			this.#hasEverTouched = true;
			if (this.#firstTouchCallback) {
				this.#firstTouchCallback();
			}
		}
		const hitNode = this.raycast(viewInputPosition);
		this.#touchTarget = hitNode;
		if (hitNode) {
			hitNode.touchPress(viewInputPosition);
		}
	}

	//==============================================================================
	// 터치 이동.
	// - press 시 결정된 대상에 touchMove를 전달한다.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 뷰 좌표의 입력 위치.
	 */
	touchMove(viewInputPosition) {
		const touchTarget = this.getTouchTarget();
		if (touchTarget) {
			touchTarget.touchMove(viewInputPosition);
		}
	}

	//==============================================================================
	// 터치 뗌.
	// - press 시 결정된 대상에 touchRelease를 전달하고 대상을 해제한다.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 뷰 좌표의 입력 위치.
	 */
	touchRelease(viewInputPosition) {
		const currentTarget = this.getTouchTarget();
		if (currentTarget) {
			currentTarget.touchRelease(viewInputPosition);
		}
		this.#touchTarget = null;
	}

	//==============================================================================
	// 터치 취소.
	// - press 시 결정된 대상에 touchCancel을 전달하고 대상을 해제한다.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 뷰 좌표의 입력 위치.
	 */
	touchCancel(viewInputPosition) {
		const currentTarget = this.getTouchTarget();
		if (currentTarget) {
			currentTarget.touchCancel(viewInputPosition);
		}
		this.#touchTarget = null;
	}

	//==============================================================================
	// 마우스 휠. (touchPress 와 무관하게 매번 viewInputPosition 으로 휠을 받을 스크롤 칸을 찾아 wheel 을 전달.)
	// - 그 자리를 덮는 것 가운데 그리는 순서로 가장 앞이 스크롤 칸(노드가 그 자리를 품은)이면 그 칸이 받는다.
	//   그 칸 안의 글이나 그림처럼 누를 수 없는 것 위에서 굴려도 칸이 받는다.
	// - 가장 앞이 누를 수 있는 노드면 그 노드와 부모 체인에서 첫 스크롤 칸이 받는다. (스크롤 칸을 덮은 막이나 창이 휠을 가린다)
	// - 받은 칸이 있으면 true.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 뷰 좌표의 입력 위치.
	 * @param { Vector2 } wheelDelta 휠 값. (스크롤 칸의 wheel 에 그대로 넘긴다)
	 * @returns { boolean } 휠을 받은 스크롤 칸이 있으면 참.
	 */
	touchWheel(viewInputPosition, wheelDelta) {
		const scrollView = this.findWheelScrollView(viewInputPosition);
		if (scrollView && typeof scrollView.wheel === "function") {
			scrollView.wheel(wheelDelta);
			return true;
		}
		return false;
	}

	//==============================================================================
	// 그 자리에서 휠을 받을 스크롤 칸 찾기. (touchWheel 의 셈, 없으면 null)
	// - raycast 와 같은 순서로 돌며 누를 수 있는 노드와 스크롤 칸 노드 가운데 가장 앞을 고른다.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 뷰 좌표의 입력 위치.
	 * @returns { object | null } 휠을 받을 스크롤 칸 컴포넌트. (없으면 null)
	 */
	findWheelScrollView(viewInputPosition) {
		const rootNode = this.getRootNode();
		if (!rootNode) {
			return null;
		}

		let drawOrderCounter = 0;
		let hitNode = null;
		let hitDrawOrder = -1;
		let scrollView = null;
		let scrollViewDrawOrder = -1;

		const traverse = (node) => {
			if (!node || !node.isActive()) {
				return;
			}
			const currentDrawOrder = drawOrderCounter;
			++drawOrderCounter;

			if (isTouchableNode(node)) {
				const nodeScrollView = this.findScrollViewComponent(node);
				const isCandidate = node.isInteractable() || nodeScrollView !== null;
				if (isCandidate && node.contains(viewInputPosition)) {
					if (nodeScrollView !== null) {
						scrollView = nodeScrollView;
						scrollViewDrawOrder = currentDrawOrder;
					}
					if (node.isInteractable()) {
						hitNode = node;
						hitDrawOrder = currentDrawOrder;
					}
				}
				if (this.isMaskedOut(node, viewInputPosition)) {
					return;
				}
			}

			const children = node.getChildren();
			for (const child of children) {
				traverse(child);
			}
		};

		traverse(rootNode);

		if (scrollView !== null && scrollViewDrawOrder >= hitDrawOrder) {
			return scrollView;
		}
		if (hitNode === null) {
			return null;
		}
		return this.findAncestorScrollViewForWheel(hitNode);
	}

	//==============================================================================
	// 노드에 붙은 스크롤 칸 컴포넌트 반환. (켜진 것만, 없으면 null, 닥 타이핑)
	//==============================================================================
	/**
	 * @param { WorldNode } node 볼 노드.
	 * @returns { object | null } 켜진 스크롤 칸 컴포넌트. (없으면 null)
	 */
	findScrollViewComponent(node) {
		if (typeof node.getAllComponents !== "function") {
			return null;
		}
		const components = node.getAllComponents();
		for (const component of components) {
			if (component && typeof component.wheel === "function" && typeof component.getScrollContentSize === "function" && component.isEnable()) {
				return component;
			}
		}
		return null;
	}

	//==============================================================================
	// hitNode 자기 자신을 포함해 부모 체인에서 가장 가까운 UIScrollView 를 찾는다.
	// (TouchRecognizer 의 findAncestorScrollView 와 다른 점: target 자신도 후보)
	// - UIScrollView import 를 피하기 위해 컴포넌트 타입은 닥 타이핑으로 검사한다.
	//==============================================================================
	/**
	 * @param { WorldNode } target 찾기 시작할 노드. (자신도 후보)
	 * @returns { object | null } 찾은 스크롤 칸 컴포넌트. (없으면 null)
	 */
	findAncestorScrollViewForWheel(target) {
		let node = target;
		while (node) {
			if (typeof node.getAllComponents === "function") {
				const components = node.getAllComponents();
				for (const component of components) {
					if (component && typeof component.wheel === "function" && typeof component.getScrollContentSize === "function") {
						return component;
					}
				}
			}
			node = typeof node.getParent === "function" ? node.getParent() : null;
		}
		return null;
	}

	//==============================================================================
	// 레이캐스트.
	// - 루트 노드로부터 draw() 호출 순서대로 번호를 매기며 순회한다.
	// - 활성화 상태이고 isInteractable()이 참이며 터치 좌표를 포함하는
	//   노드 중 가장 높은 번호의 노드를 반환한다. (노드 종류는 가리지 않는다)
	// - Mask 가 붙은 노드의 자손은 그 노드 영역 안에서만 맞는다. (잘려 보이지 않는 곳은 눌리지 않는다)
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 뷰 좌표의 입력 위치.
	 * @returns { WorldNode | null } 그 자리를 품은 가장 앞의 누를 수 있는 노드. (없으면 null)
	 */
	raycast(viewInputPosition) {
		const rootNode = this.getRootNode();
		if (!rootNode) {
			return null;
		}

		let drawOrderCounter = 0;
		let hitNode = null;
		let hitDrawOrder = -1;

		const traverse = (node) => {
			if (!node) {
				return;
			}
			const isActive = node.isActive();
			if (!isActive) {
				return;
			}

			// 현재 노드에 번호 부여 후 판정.
			const currentDrawOrder = drawOrderCounter;
			++drawOrderCounter;

			if (isTouchableNode(node)) {
				const isInteractable = node.isInteractable();
				if (isInteractable) {
					const isInside = node.contains(viewInputPosition);
					if (isInside) {
						if (currentDrawOrder > hitDrawOrder) {
							hitNode = node;
							hitDrawOrder = currentDrawOrder;
						}
					}
				}
			}

			// 잘라 그리는 노드 밖이면 자손은 보이지 않으므로 맞지 않는다. (Mask 를 들이지 않으려고 컴포넌트 종류 이름으로 본다)
			if (isTouchableNode(node) && this.isMaskedOut(node, viewInputPosition)) {
				return;
			}

			// 자식 순회. (draw() 순서와 동일)
			const children = node.getChildren();
			for (const child of children) {
				traverse(child);
			}
		};

		traverse(rootNode);

		return hitNode;
	}

	//==============================================================================
	// Mask 가 붙은 노드인데 좌표가 그 영역 밖인지.
	//==============================================================================
	/**
	 * @param { WorldNode } node 볼 노드.
	 * @param { Vector2 } viewInputPosition 뷰 좌표의 입력 위치.
	 * @returns { boolean } 켜진 Mask 가 붙어 있고 그 자리가 노드 밖이면 참.
	 */
	isMaskedOut(node, viewInputPosition) {
		if (typeof node.getAllComponents !== "function") {
			return false;
		}
		const components = node.getAllComponents();
		for (const component of components) {
			if (component && typeof component.getComponentType === "function" && component.getComponentType() === "Mask" && component.isEnable()) {
				return !node.contains(viewInputPosition);
			}
		}
		return false;
	}

	//==============================================================================
	// 루트 노드 설정.
	//==============================================================================
	/**
	 * @param { * } rootNode 훑을 루트 노드. (보통 씬의 루트)
	 */
	setRootNode(rootNode) {
		this.#rootNode = rootNode;
	}

	//==============================================================================
	// 루트 노드 반환.
	//==============================================================================
	/**
	 * @returns { * } 훑는 루트 노드. (정하지 않았으면 null)
	 */
	getRootNode() {
		return this.#rootNode;
	}

	//==============================================================================
	// 현재 터치 대상 반환.
	//==============================================================================
	/**
	 * @returns { WorldNode | null } 누를 때 맞은 노드. (뗐거나 없으면 null)
	 */
	getTouchTarget() {
		return this.#touchTarget;
	}

	//==============================================================================
	// 한 번이라도 터치된 적 있는지 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 한 번이라도 눌렀으면 참.
	 */
	hasEverTouched() {
		return this.#hasEverTouched;
	}

	//==============================================================================
	// 첫 터치 콜백 설정.
	//==============================================================================
	/**
	 * @param { Function } callback 처음 누를 때 한 번 부를 함수. (인자 없음)
	 */
	setFirstTouchCallback(callback) {
		this.#firstTouchCallback = callback;
	}
}
