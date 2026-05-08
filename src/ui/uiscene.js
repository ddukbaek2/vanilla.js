//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../base/vector2.js";
import { Engine } from "../core/engine.js";
import { Scene } from "../core/scene.js";
import { TransformNode } from "../core/node/transformnode.js";
import { UINode } from "./uinode.js";
import { LayoutSolver } from "./autolayout/layoutsolver.js";
import { LayoutStrength } from "./autolayout/layoutstrength.js";
import { LayoutConstraint } from "./autolayout/layoutconstraint.js";


//==============================================================================
// UI 씬.
// - Scene 을 상속받아 LayoutSolver 운용을 자동화한다.
// - 자체 LayoutSolver 인스턴스를 보유. tick 마다 updateVariables 자동 호출.
// - 자체 화면 가이드 UINode (screenNode) 를 보유. 좌상단 (0, 0) 고정 + 너비/높이를
//   편집 변수로 등록해 resize 시 suggestValue 로 갱신한다.
//   (UIKit 의 UIWindow.bounds 와 같은 사상)
// - safeAreaLayoutGuide UINode 를 별도로 보유. screenNode 에서 safeAreaInsets 만큼
//   안쪽으로 들어간 영역을 표현. (UIKit 의 UIView.safeAreaLayoutGuide 와 동일 사상)
// - 트리에 추가된 UINode 들은 tick 시 자동으로 솔버에 부착된다.
//==============================================================================
export class UIScene extends Scene {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { LayoutSolver } */ #solver;
	/** @private @type { UINode } */ #screenNode;
	/** @private @type { UINode } */ #safeAreaLayoutGuide;
	/** @private @type { { top: number, left: number, bottom: number, right: number } } */ #safeAreaInsets;
	/** @private @type { LayoutConstraint[] } */ #safeAreaLayoutGuideConstraints;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @virtual
	 * @override
	 */
	create() {
		super.create();
		this.#solver = new LayoutSolver();
		this.#screenNode = new UINode();
		this.#screenNode.setName("screen");
		this.#screenNode.setSolver(this.#solver);

		// 좌상단 (0, 0) 고정.
		const screenLeftConstraint = this.#screenNode.leftAnchor().equalTo(0);
		const screenTopConstraint = this.#screenNode.topAnchor().equalTo(0);
		this.#screenNode.addConstraint(screenLeftConstraint);
		this.#screenNode.addConstraint(screenTopConstraint);

		// 너비/높이는 편집 변수로 등록 (resize 마다 suggestValue 로 갱신).
		const screenWidthVariable = this.#screenNode.getWidthVariable();
		const screenHeightVariable = this.#screenNode.getHeightVariable();
		this.#solver.addEditVariable(screenWidthVariable, LayoutStrength.strong);
		this.#solver.addEditVariable(screenHeightVariable, LayoutStrength.strong);

		// safeAreaLayoutGuide 초기 셋업. 기본 insets 0 (= screen 과 동일 영역).
		this.#safeAreaInsets = { top: 0, left: 0, bottom: 0, right: 0 };
		this.#safeAreaLayoutGuide = new UINode();
		this.#safeAreaLayoutGuide.setName("safeArea");
		this.#safeAreaLayoutGuide.setSolver(this.#solver);
		this.#safeAreaLayoutGuideConstraints = [];
		this.rebuildSafeAreaLayoutGuideConstraints();
	}

	//==============================================================================
	// 비동기 로딩.
	// - super.load 가 viewSize 로 root 를 셋업한 뒤, 솔버에도 동일한 viewSize 를 제안한다.
	//==============================================================================
	/**
	 * @virtual
	 * @override
	 * @param { Engine } engine
	 */
	async load(engine) {
		await super.load(engine);
		const viewManager = engine.getViewManager();
		const viewSize = viewManager.getViewSize();
		this.suggestScreenSize(viewSize);
		this.#solver.updateVariables();
	}

	//==============================================================================
	// 화면 크기 변경됨.
	// - super.resize 가 root 를 갱신한 뒤, 솔버의 screenNode 크기도 갱신한다.
	//==============================================================================
	/**
	 * @virtual
	 * @override
	 * @param { Vector2 } canvasNativeSize
	 */
	resize(canvasNativeSize) {
		super.resize(canvasNativeSize);
		const engine = this.getEngine();
		if (engine) {
			const viewManager = engine.getViewManager();
			const viewSize = viewManager.getViewSize();
			this.suggestScreenSize(viewSize);
			this.#solver.updateVariables();
		}
	}

	//==============================================================================
	// 주기적 갱신.
	// - 트리 내 새로 추가된 UINode 들을 솔버에 자동 부착한 뒤 솔버를 한 번 풀어낸다.
	//==============================================================================
	/**
	 * @virtual
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
		const root = this.getRoot();
		this.attachPendingUINodes(root);
		this.#solver.updateVariables();
	}

	//==============================================================================
	// 트리를 순회하며 솔버가 부착되지 않은 UINode 들을 본 씬의 솔버에 부착.
	//==============================================================================
	/**
	 * @param { TransformNode } node
	 */
	attachPendingUINodes(node) {
		if (node === null || node === undefined) {
			return;
		}
		if (node instanceof UINode) {
			const currentSolver = node.getSolver();
			if (currentSolver === null) {
				node.setSolver(this.#solver);
			}
		}
		const children = node.getChildren();
		for (const child of children) {
			this.attachPendingUINodes(child);
		}
	}

	//==============================================================================
	// 화면 가이드 UINode 의 너비/높이 값 제안.
	//==============================================================================
	/**
	 * @param { Vector2 } size
	 */
	suggestScreenSize(size) {
		const screenWidthVariable = this.#screenNode.getWidthVariable();
		const screenHeightVariable = this.#screenNode.getHeightVariable();
		this.#solver.suggestValue(screenWidthVariable, size.x);
		this.#solver.suggestValue(screenHeightVariable, size.y);
	}

	//==============================================================================
	// safeAreaInsets 반환. (UIKit 의 UIView.safeAreaInsets)
	//==============================================================================
	/**
	 * @returns { { top: number, left: number, bottom: number, right: number } }
	 */
	getSafeAreaInsets() {
		const safeAreaInsets = this.#safeAreaInsets;
		return {
			top: safeAreaInsets.top,
			left: safeAreaInsets.left,
			bottom: safeAreaInsets.bottom,
			right: safeAreaInsets.right,
		};
	}

	//==============================================================================
	// safeAreaInsets 설정. (모바일 노치 / 홈 인디케이터 회피용 영역 정의)
	// - safeAreaLayoutGuide 의 4 개 제약을 즉시 갱신한다.
	//==============================================================================
	/**
	 * @param { { top: number, left: number, bottom: number, right: number } } insets
	 */
	setSafeAreaInsets(insets) {
		this.#safeAreaInsets = {
			top: insets.top,
			left: insets.left,
			bottom: insets.bottom,
			right: insets.right,
		};
		this.rebuildSafeAreaLayoutGuideConstraints();
	}

	//==============================================================================
	// safeAreaLayoutGuide 의 4 개 제약 재구축.
	// - 기존 제약을 솔버에서 제거하고 현재 #safeAreaInsets 로 다시 구축 후 재등록.
	//==============================================================================
	rebuildSafeAreaLayoutGuideConstraints() {
		const guide = this.#safeAreaLayoutGuide;
		const screen = this.#screenNode;
		const solver = this.#solver;
		for (const constraint of this.#safeAreaLayoutGuideConstraints) {
			if (solver.hasConstraint(constraint)) {
				solver.removeConstraint(constraint);
			}
		}
		const insets = this.#safeAreaInsets;
		const guideLeftConstraint = guide.leftAnchor().equalTo(screen.leftAnchor().add(insets.left));
		const guideTopConstraint = guide.topAnchor().equalTo(screen.topAnchor().add(insets.top));
		const guideRightConstraint = guide.rightAnchor().equalTo(screen.rightAnchor().subtract(insets.right));
		const guideBottomConstraint = guide.bottomAnchor().equalTo(screen.bottomAnchor().subtract(insets.bottom));
		this.#safeAreaLayoutGuideConstraints = [guideLeftConstraint, guideTopConstraint, guideRightConstraint, guideBottomConstraint];
		for (const constraint of this.#safeAreaLayoutGuideConstraints) {
			solver.addConstraint(constraint);
		}
	}

	//==============================================================================
	// 솔버 반환.
	//==============================================================================
	/**
	 * @returns { LayoutSolver }
	 */
	getSolver() {
		return this.#solver;
	}

	//==============================================================================
	// 화면 가이드 UINode 반환.
	// - 트리에는 들어가지 않는 가이드 노드. left/top 은 0 고정, width/height 는
	//   현재 viewSize 와 동기화된 편집 변수.
	// - 사용자가 자기 UINode 의 제약을 화면 기준으로 작성할 때 앵커 소스로 사용.
	//==============================================================================
	/**
	 * @returns { UINode }
	 */
	getScreenNode() {
		return this.#screenNode;
	}

	//==============================================================================
	// safeAreaLayoutGuide 반환. (UIKit 의 UIView.safeAreaLayoutGuide 와 동일 사상)
	// - screenNode 에서 safeAreaInsets 만큼 안쪽으로 들어간 가이드 UINode.
	// - 사용자가 자기 UINode 의 제약을 safeArea 기준으로 작성할 때 앵커 소스로 사용.
	//==============================================================================
	/**
	 * @returns { UINode }
	 */
	getSafeAreaLayoutGuide() {
		return this.#safeAreaLayoutGuide;
	}
}
