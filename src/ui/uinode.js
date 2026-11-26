//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import * as Math from "../base/math.js";
import { Vector2 } from "../base/vector2.js";
import { OBB } from "../base/obb.js";
import { Graphic } from "../core/graphic.js";
import { TransformNode } from "../core/node/transformnode.js";
import { LayoutVariable } from "./autolayout/layoutvariable.js";
import { LayoutExpression } from "./autolayout/layoutexpression.js";
import { LayoutConstraint } from "./autolayout/layoutconstraint.js";
import { LayoutSolver } from "./autolayout/layoutsolver.js";
import { LayoutStrength } from "./autolayout/layoutstrength.js";
import { LayoutPriority } from "./autolayout/layoutpriority.js";
import { LayoutConstraintAxis } from "./autolayout/layoutconstraintaxis.js";


//==============================================================================
// UIKit 의 UIView.noIntrinsicMetric 와 같은 의미의 sentinel 값.
// - getIntrinsicContentSize 의 x 또는 y 가 본 값이면 그 축은 intrinsic 선호 없음.
//==============================================================================
const NO_INTRINSIC_METRIC = -1;


//==============================================================================
// UI 노드.
// - 기존 WorldNode 계열과 다른 별도 노선의 UI 노드.
// - 영역 정의는 솔버 변수 (left / right / top / bottom / width / height
//   + 파생 centerX / centerY) 8 개로 표현되며, 사용자가 LayoutSolver 에 제약을
//   걸어 그 값들을 결정한다.
// - 본 클래스는 변수 보유와 본질적 제약 (right == left + width, bottom == top
//   + height, centerX == left + width/2, centerY == top + height/2) 4 개를
//   자동으로 등록한다.
// - 사용자 제약은 addConstraint(constraint) 로 등록한다.
// - 솔버 부착은 setSolver(solver) 로 한다. 트리에 통합 운용한다면 루트 UINode 에만
//   설정해두고 자식이 setSolver 를 통해 같은 인스턴스를 받도록 호출자가 관리한다.
// - intrinsicContentSize / contentHuggingPriority / contentCompressionResistancePriority
//   는 UIKit 의 동명 API 와 동일 사상. 서브클래스가 getIntrinsicContentSize 를 override.
// - layoutMargins / layoutMarginsGuide 는 UIKit 의 UIView.layoutMargins /
//   layoutMarginsGuide 와 동일 사상. 자식 UINode 형태의 가이드를 lazy 로 노출.
//==============================================================================
/**
 * @example <caption>판의 여백 안쪽에 줄 하나 놓기</caption>
 * import { UINode, LayoutSolver } from "./build/vanilla.js";
 *
 * const solver = new LayoutSolver();
 * const panelNode = new UINode();
 * panelNode.setSolver(solver);
 * const panelLeftAnchor = panelNode.leftAnchor;
 * const panelTopAnchor = panelNode.topAnchor;
 * const panelWidthAnchor = panelNode.widthAnchor;
 * const panelHeightAnchor = panelNode.heightAnchor;
 * panelNode.addConstraint(panelLeftAnchor.equalTo(20));
 * panelNode.addConstraint(panelTopAnchor.equalTo(20));
 * panelNode.addConstraint(panelWidthAnchor.equalTo(400));
 * panelNode.addConstraint(panelHeightAnchor.equalTo(300));
 * panelNode.setLayoutMargins({ top: 16, left: 24, bottom: 16, right: 24 });
 *
 * const marginsGuide = panelNode.getLayoutMarginsGuide();
 * const rowNode = new UINode();
 * rowNode.setSolver(solver);
 * const guideLeftAnchor = marginsGuide.leftAnchor;
 * const guideRightAnchor = marginsGuide.rightAnchor;
 * const guideTopAnchor = marginsGuide.topAnchor;
 * const rowLeftAnchor = rowNode.leftAnchor;
 * const rowRightAnchor = rowNode.rightAnchor;
 * const rowTopAnchor = rowNode.topAnchor;
 * const rowHeightAnchor = rowNode.heightAnchor;
 * rowNode.addConstraint(rowLeftAnchor.equalTo(guideLeftAnchor));
 * rowNode.addConstraint(rowRightAnchor.equalTo(guideRightAnchor));
 * rowNode.addConstraint(rowTopAnchor.equalTo(guideTopAnchor));
 * rowNode.addConstraint(rowHeightAnchor.equalTo(48));
 *
 * solver.updateVariables();
 * console.log(rowNode.getLeft(), rowNode.getTop(), rowNode.getWidth(), rowNode.getHeight());
 */
export class UINode extends TransformNode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { LayoutSolver | null } */ #solver;
	/** @private @type { LayoutVariable } */ #leftVariable;
	/** @private @type { LayoutVariable } */ #rightVariable;
	/** @private @type { LayoutVariable } */ #topVariable;
	/** @private @type { LayoutVariable } */ #bottomVariable;
	/** @private @type { LayoutVariable } */ #widthVariable;
	/** @private @type { LayoutVariable } */ #heightVariable;
	/** @private @type { LayoutVariable } */ #centerXVariable;
	/** @private @type { LayoutVariable } */ #centerYVariable;
	/** @private @type { LayoutConstraint[] } */ #intrinsicConstraints;
	/** @private @type { LayoutConstraint[] } */ #userConstraints;
	/** @private @type { LayoutConstraint[] } */ #intrinsicSizeConstraints;
	/** @private @type { number } */ #horizontalHuggingPriority;
	/** @private @type { number } */ #verticalHuggingPriority;
	/** @private @type { number } */ #horizontalCompressionResistancePriority;
	/** @private @type { number } */ #verticalCompressionResistancePriority;
	/** @private @type { { top: number, left: number, bottom: number, right: number } } */ #layoutMargins;
	/** @private @type { UINode | null } */ #layoutMarginsGuide;
	/** @private @type { LayoutConstraint[] } */ #layoutMarginsGuideConstraints;
	/** @private @type { boolean } */ #isInteractable; // TouchRaycaster 가 맞힐지. (UIButton 이 붙으면 켠다)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.nodeType = "UINode";
		this.#solver = null;
		this.#leftVariable = new LayoutVariable("left");
		this.#rightVariable = new LayoutVariable("right");
		this.#topVariable = new LayoutVariable("top");
		this.#bottomVariable = new LayoutVariable("bottom");
		this.#widthVariable = new LayoutVariable("width");
		this.#heightVariable = new LayoutVariable("height");
		this.#centerXVariable = new LayoutVariable("centerX");
		this.#centerYVariable = new LayoutVariable("centerY");
		this.#intrinsicConstraints = this.buildIntrinsicConstraints();
		this.#userConstraints = [];
		this.#intrinsicSizeConstraints = [];
		this.#horizontalHuggingPriority = LayoutPriority.defaultLow;
		this.#verticalHuggingPriority = LayoutPriority.defaultLow;
		this.#horizontalCompressionResistancePriority = LayoutPriority.defaultHigh;
		this.#verticalCompressionResistancePriority = LayoutPriority.defaultHigh;
		this.#layoutMargins = { top: 8, left: 8, bottom: 8, right: 8 };
		this.#layoutMarginsGuide = null;
		this.#layoutMarginsGuideConstraints = [];
		this.#isInteractable = false;
	}

	//==============================================================================
	// 출력 상태 시작.
	// - 솔버 변수 (left / top) 는 UI 트리 루트가 속한 좌표계 기준의 절대 위치로 간주된다.
	//   (UIKit 의 anchor 가 window 좌표계 기준인 것과 동일한 사상)
	// - 부모도 UINode 라면 부모가 이미 (parentLeft, parentTop) 만큼 변환을 적용해 두었으므로
	//   자식은 (left - parentLeft, top - parentTop) 만큼 추가 이동만 해야 한다.
	// - 회전 / 스케일 / 투명도는 기존 TransformNode 의 멤버를 그대로 사용한다.
	//   (UINode 의 영역 자체는 솔버 변수로 결정되므로 setLocalPosition 은 사용하지 않는다)
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic 그래픽. (null 이면 아무것도 하지 않는다)
	 */
	pushTransform(graphic) {
		if (graphic) {
			graphic.pushState();

			const left = this.getLeft();
			const top = this.getTop();
			let translateX = left;
			let translateY = top;
			const parent = this.getParent();
			if (parent instanceof UINode) {
				const parentLeft = parent.getLeft();
				const parentTop = parent.getTop();
				translateX = left - parentLeft;
				translateY = top - parentTop;
			}
			const localRotation = this.getLocalRotation();
			const radian = Math.degreeToRadian(localRotation);
			const localScale = this.getLocalScale();
			graphic.translate(translateX, translateY);
			graphic.rotate(radian);
			graphic.scale(localScale.x, localScale.y);

			const localOpacity = this.getLocalOpacity();
			graphic.multiplyGlobalAlpha(localOpacity);
		}
	}

	//==============================================================================
	// 컨텐트 사이즈 반환. (솔버가 풀어낸 width / height)
	// - WorldNode 의 getContentSize 와 동일 시그니처. Mask 등 컴포넌트가 그대로 사용 가능.
	//==============================================================================
	/**
	 * @returns { Vector2 } 솔버가 푼 너비와 높이.
	 */
	getContentSize() {
		const width = this.getWidth();
		const height = this.getHeight();
		return Vector2.create(width, height);
	}

	//==============================================================================
	// 본질 제약 4 개 생성.
	// - right  == left + width
	// - bottom == top + height
	// - centerX == left + width/2
	// - centerY == top + height/2
	//==============================================================================
	/**
	 * @returns { LayoutConstraint[] } 본질 제약 4 개. (솔버에 넣지 않고 돌려준다)
	 */
	buildIntrinsicConstraints() {
		const leftExpression = this.leftAnchor;
		const rightExpression = this.rightAnchor;
		const topExpression = this.topAnchor;
		const bottomExpression = this.bottomAnchor;
		const widthExpression = this.widthAnchor;
		const heightExpression = this.heightAnchor;
		const centerXExpression = this.centerXAnchor;
		const centerYExpression = this.centerYAnchor;

		const rightConstraint = rightExpression.equalTo(leftExpression.add(widthExpression));
		const bottomConstraint = bottomExpression.equalTo(topExpression.add(heightExpression));
		const centerXConstraint = centerXExpression.equalTo(leftExpression.add(widthExpression.divide(2.0)));
		const centerYConstraint = centerYExpression.equalTo(topExpression.add(heightExpression.divide(2.0)));
		return [rightConstraint, bottomConstraint, centerXConstraint, centerYConstraint];
	}

	//==============================================================================
	// intrinsic content size 기반 제약 (hug / compression resistance) 4 개 생성.
	// - 축마다 intrinsic 값이 NO_INTRINSIC_METRIC (-1) 이면 그 축의 제약은 생성하지 않는다.
	// - hug:        widthAnchor.lessThanOrEqualTo(intrinsicWidth) @ huggingPriority
	// - compression: widthAnchor.greaterThanOrEqualTo(intrinsicWidth) @ compressionResistancePriority
	//==============================================================================
	/**
	 * @returns { LayoutConstraint[] } 내재 크기 제약 목록. (축마다 둘, 내재 크기가 없는 축은 빠진다, 솔버에 넣지 않고 돌려준다)
	 */
	buildIntrinsicSizeConstraints() {
		const intrinsicSize = this.getIntrinsicContentSize();
		const result = [];
		if (intrinsicSize.x !== NO_INTRINSIC_METRIC) {
			const horizontalHuggingStrength = LayoutStrength.fromPriority(this.#horizontalHuggingPriority);
			const horizontalCompressionStrength = LayoutStrength.fromPriority(this.#horizontalCompressionResistancePriority);
			const widthHugConstraint = this.widthAnchor.lessThanOrEqualTo(intrinsicSize.x).withStrength(horizontalHuggingStrength);
			const widthCompressionConstraint = this.widthAnchor.greaterThanOrEqualTo(intrinsicSize.x).withStrength(horizontalCompressionStrength);
			result.push(widthHugConstraint);
			result.push(widthCompressionConstraint);
		}
		if (intrinsicSize.y !== NO_INTRINSIC_METRIC) {
			const verticalHuggingStrength = LayoutStrength.fromPriority(this.#verticalHuggingPriority);
			const verticalCompressionStrength = LayoutStrength.fromPriority(this.#verticalCompressionResistancePriority);
			const heightHugConstraint = this.heightAnchor.lessThanOrEqualTo(intrinsicSize.y).withStrength(verticalHuggingStrength);
			const heightCompressionConstraint = this.heightAnchor.greaterThanOrEqualTo(intrinsicSize.y).withStrength(verticalCompressionStrength);
			result.push(heightHugConstraint);
			result.push(heightCompressionConstraint);
		}
		return result;
	}

	//==============================================================================
	// 본 노드의 intrinsic content size 반환. 서브클래스가 override.
	// - x 또는 y 가 NO_INTRINSIC_METRIC (-1) 이면 그 축은 intrinsic 선호 없음.
	// - 기본 구현은 부착된 컴포넌트 중 getIntrinsicContentSize 를 가진 것들의
	//   값을 max 로 합산해 반환. (Text 등 컴포넌트가 자동으로 기여)
	//==============================================================================
	/**
	 * @virtual
	 * @returns { Vector2 } 내재 크기. (축마다 컴포넌트 값 가운데 가장 큰 것, 없는 축은 -1)
	 */
	getIntrinsicContentSize() {
		let maxWidth = NO_INTRINSIC_METRIC;
		let maxHeight = NO_INTRINSIC_METRIC;
		const components = this.getAllComponents();
		for (const component of components) {
			if (typeof component.getIntrinsicContentSize !== "function") {
				continue;
			}
			const componentSize = component.getIntrinsicContentSize();
			if (componentSize.x > maxWidth) {
				maxWidth = componentSize.x;
			}
			if (componentSize.y > maxHeight) {
				maxHeight = componentSize.y;
			}
		}
		return Vector2.create(maxWidth, maxHeight);
	}

	//==============================================================================
	// intrinsic content size 무효화. UIKit 의 invalidateIntrinsicContentSize 와 동일.
	// - 솔버에서 기존 intrinsicSize 제약을 제거하고 새 값으로 다시 등록한다.
	// - 텍스트 / 이미지 등 컨텐트가 바뀌어 intrinsic size 가 달라졌을 때 호출.
	//==============================================================================
	invalidateIntrinsicContentSize() {
		const solver = this.#solver;
		if (solver !== null) {
			for (const constraint of this.#intrinsicSizeConstraints) {
				if (solver.hasConstraint(constraint)) {
					solver.removeConstraint(constraint);
				}
			}
		}
		this.#intrinsicSizeConstraints = this.buildIntrinsicSizeConstraints();
		if (solver !== null) {
			for (const constraint of this.#intrinsicSizeConstraints) {
				solver.addConstraint(constraint);
			}
		}
	}

	//==============================================================================
	// content hugging 우선순위 반환. (UIKit 의 contentHuggingPriority(for:))
	//==============================================================================
	/**
	 * @param { string } axis 축. (LayoutConstraintAxis 의 값, 그 밖이면 예외를 던진다)
	 * @returns { number } 그 축의 content hugging 우선순위. (기본 LayoutPriority.defaultLow)
	 */
	getContentHuggingPriority(axis) {
		if (axis === LayoutConstraintAxis.horizontal) {
			return this.#horizontalHuggingPriority;
		}
		if (axis === LayoutConstraintAxis.vertical) {
			return this.#verticalHuggingPriority;
		}
		throw new System.Error("[UINode] getContentHuggingPriority: 지원되지 않는 축.");
	}

	//==============================================================================
	// content hugging 우선순위 설정. (UIKit 의 setContentHuggingPriority(_:for:))
	// - intrinsicSize 제약을 즉시 갱신.
	//==============================================================================
	/**
	 * @param { number } priority 우선순위. (1 ~ 1000, LayoutPriority 의 값을 쓸 수 있다)
	 * @param { string } axis 축. (LayoutConstraintAxis 의 값, 그 밖이면 예외를 던진다)
	 */
	setContentHuggingPriority(priority, axis) {
		if (axis === LayoutConstraintAxis.horizontal) {
			this.#horizontalHuggingPriority = priority;
		}
		else if (axis === LayoutConstraintAxis.vertical) {
			this.#verticalHuggingPriority = priority;
		}
		else {
			throw new System.Error("[UINode] setContentHuggingPriority: 지원되지 않는 축.");
		}
		this.invalidateIntrinsicContentSize();
	}

	//==============================================================================
	// content compression resistance 우선순위 반환.
	// (UIKit 의 contentCompressionResistancePriority(for:))
	//==============================================================================
	/**
	 * @param { string } axis 축. (LayoutConstraintAxis 의 값, 그 밖이면 예외를 던진다)
	 * @returns { number } 그 축의 압축 저항 우선순위. (기본 LayoutPriority.defaultHigh)
	 */
	getContentCompressionResistancePriority(axis) {
		if (axis === LayoutConstraintAxis.horizontal) {
			return this.#horizontalCompressionResistancePriority;
		}
		if (axis === LayoutConstraintAxis.vertical) {
			return this.#verticalCompressionResistancePriority;
		}
		throw new System.Error("[UINode] getContentCompressionResistancePriority: 지원되지 않는 축.");
	}

	//==============================================================================
	// content compression resistance 우선순위 설정.
	// (UIKit 의 setContentCompressionResistancePriority(_:for:))
	// - intrinsicSize 제약을 즉시 갱신.
	//==============================================================================
	/**
	 * @param { number } priority 우선순위. (1 ~ 1000, LayoutPriority 의 값을 쓸 수 있다)
	 * @param { string } axis 축. (LayoutConstraintAxis 의 값, 그 밖이면 예외를 던진다)
	 */
	setContentCompressionResistancePriority(priority, axis) {
		if (axis === LayoutConstraintAxis.horizontal) {
			this.#horizontalCompressionResistancePriority = priority;
		}
		else if (axis === LayoutConstraintAxis.vertical) {
			this.#verticalCompressionResistancePriority = priority;
		}
		else {
			throw new System.Error("[UINode] setContentCompressionResistancePriority: 지원되지 않는 축.");
		}
		this.invalidateIntrinsicContentSize();
	}

	//==============================================================================
	// layoutMargins 반환. (UIKit 의 UIView.layoutMargins)
	//==============================================================================
	/**
	 * @returns { { top: number, left: number, bottom: number, right: number } } 레이아웃 여백의 사본. (기본 사방 8)
	 */
	getLayoutMargins() {
		const layoutMargins = this.#layoutMargins;
		return {
			top: layoutMargins.top,
			left: layoutMargins.left,
			bottom: layoutMargins.bottom,
			right: layoutMargins.right,
		};
	}

	//==============================================================================
	// layoutMargins 설정. (UIKit 의 UIView.layoutMargins setter)
	// - layoutMarginsGuide 가 이미 생성됐다면 가이드 제약을 즉시 갱신.
	//==============================================================================
	/**
	 * @param { { top: number, left: number, bottom: number, right: number } } layoutMargins 위, 왼쪽, 아래, 오른쪽 여백. (값을 복사해 담는다)
	 */
	setLayoutMargins(layoutMargins) {
		this.#layoutMargins = {
			top: layoutMargins.top,
			left: layoutMargins.left,
			bottom: layoutMargins.bottom,
			right: layoutMargins.right,
		};
		if (this.#layoutMarginsGuide !== null) {
			this.rebuildLayoutMarginsGuideConstraints();
		}
	}

	//==============================================================================
	// layoutMarginsGuide 반환. (UIKit 의 UIView.layoutMarginsGuide)
	// - 처음 호출 시 lazy 로 가이드 UINode 를 생성하고 4 개의 마진 제약을 솔버에 등록.
	// - 가이드는 트리에 들어가지 않아 렌더링되지 않으며, anchor 만 사용된다.
	//==============================================================================
	/**
	 * @returns { UINode } 여백만큼 안쪽으로 들어간 가이드 UINode.
	 */
	getLayoutMarginsGuide() {
		if (this.#layoutMarginsGuide === null) {
			this.#layoutMarginsGuide = new UINode();
			this.#layoutMarginsGuide.setName("layoutMargins");
			if (this.#solver !== null) {
				this.#layoutMarginsGuide.setSolver(this.#solver);
			}
			this.rebuildLayoutMarginsGuideConstraints();
		}
		return this.#layoutMarginsGuide;
	}

	//==============================================================================
	// layoutMarginsGuide 의 마진 제약 (4 개) 재구축.
	// - 기존 마진 제약을 솔버에서 제거하고 현재 #layoutMargins 값으로 다시 구축 후 재등록.
	//==============================================================================
	rebuildLayoutMarginsGuideConstraints() {
		const guide = this.#layoutMarginsGuide;
		if (guide === null) {
			return;
		}
		const solver = this.#solver;
		if (solver !== null) {
			for (const constraint of this.#layoutMarginsGuideConstraints) {
				if (solver.hasConstraint(constraint)) {
					solver.removeConstraint(constraint);
				}
			}
		}
		const margins = this.#layoutMargins;
		const guideLeftConstraint = guide.leftAnchor.equalTo(this.leftAnchor.add(margins.left));
		const guideTopConstraint = guide.topAnchor.equalTo(this.topAnchor.add(margins.top));
		const guideRightConstraint = guide.rightAnchor.equalTo(this.rightAnchor.subtract(margins.right));
		const guideBottomConstraint = guide.bottomAnchor.equalTo(this.bottomAnchor.subtract(margins.bottom));
		this.#layoutMarginsGuideConstraints = [guideLeftConstraint, guideTopConstraint, guideRightConstraint, guideBottomConstraint];
		if (solver !== null) {
			for (const constraint of this.#layoutMarginsGuideConstraints) {
				solver.addConstraint(constraint);
			}
		}
	}

	//==============================================================================
	// 솔버 설정 / 변경 / 해제.
	// - 기존 솔버에서 본 노드의 모든 제약을 제거한 뒤, 새 솔버에 다시 등록한다.
	// - layoutMarginsGuide 가 이미 존재하면 그 가이드와 가이드 제약도 함께 이전 / 신규 솔버로 옮긴다.
	// - solver 가 null 이면 모두 해제만 한다.
	//==============================================================================
	/**
	 * @param { LayoutSolver | null } solver 붙일 솔버. (null 이면 지금 솔버에서 떼기만 한다)
	 */
	setSolver(solver) {
		const previousSolver = this.#solver;
		if (previousSolver !== null) {
			for (const constraint of this.#layoutMarginsGuideConstraints) {
				if (previousSolver.hasConstraint(constraint)) {
					previousSolver.removeConstraint(constraint);
				}
			}
			for (const constraint of this.#userConstraints) {
				if (previousSolver.hasConstraint(constraint)) {
					previousSolver.removeConstraint(constraint);
				}
			}
			for (const constraint of this.#intrinsicSizeConstraints) {
				if (previousSolver.hasConstraint(constraint)) {
					previousSolver.removeConstraint(constraint);
				}
			}
			for (const constraint of this.#intrinsicConstraints) {
				if (previousSolver.hasConstraint(constraint)) {
					previousSolver.removeConstraint(constraint);
				}
			}
		}
		this.#solver = solver;
		if (this.#layoutMarginsGuide !== null) {
			this.#layoutMarginsGuide.setSolver(solver);
		}
		if (solver !== null) {
			for (const constraint of this.#intrinsicConstraints) {
				solver.addConstraint(constraint);
			}
			for (const constraint of this.#intrinsicSizeConstraints) {
				solver.addConstraint(constraint);
			}
			for (const constraint of this.#userConstraints) {
				solver.addConstraint(constraint);
			}
			for (const constraint of this.#layoutMarginsGuideConstraints) {
				solver.addConstraint(constraint);
			}
		}
	}

	//==============================================================================
	// 솔버 반환.
	//==============================================================================
	/**
	 * @returns { LayoutSolver | null } 붙은 솔버. (없으면 null)
	 */
	getSolver() {
		return this.#solver;
	}

	//==============================================================================
	// 사용자 제약 추가. 솔버에 즉시 등록.
	// - 솔버가 받지 않으면(이미 더한 제약, 모순 제약) 오류를 던지고 목록에도 남기지 않는다.
	//==============================================================================
	/**
	 * @param { LayoutConstraint } constraint 더할 제약. (솔버가 받지 않으면 오류를 던진다)
	 * @example <caption>약한 제약과 상한 제약 함께 쓰기</caption>
	 * import { UINode, LayoutSolver, LayoutStrength } from "./build/vanilla.js";
	 *
	 * const solver = new LayoutSolver();
	 * const node = new UINode();
	 * node.setSolver(solver);
	 * const leftAnchor = node.leftAnchor;
	 * const topAnchor = node.topAnchor;
	 * const widthAnchor = node.widthAnchor;
	 * const heightAnchor = node.heightAnchor;
	 * node.addConstraint(leftAnchor.equalTo(0));
	 * node.addConstraint(topAnchor.equalTo(0));
	 * node.addConstraint(heightAnchor.equalTo(40));
	 * const preferredWidthConstraint = widthAnchor.equalTo(300).withStrength(LayoutStrength.weak);
	 * const maximumWidthConstraint = widthAnchor.lessThanOrEqualTo(200);
	 * node.addConstraint(preferredWidthConstraint);
	 * node.addConstraint(maximumWidthConstraint);
	 * solver.updateVariables();
	 * console.log(node.getWidth());
	 *
	 * node.removeConstraint(maximumWidthConstraint);
	 * solver.updateVariables();
	 * console.log(node.getWidth());
	 */
	addConstraint(constraint) {
		const solver = this.getSolver();
		if (solver !== null) {
			solver.addConstraint(constraint);
		}
		this.#userConstraints.push(constraint);
	}

	//==============================================================================
	// 사용자 제약 제거. 솔버에서도 제거.
	//==============================================================================
	/**
	 * @param { LayoutConstraint } constraint 뺄 제약. (더하지 않은 제약이면 아무것도 하지 않는다)
	 */
	removeConstraint(constraint) {
		const index = this.#userConstraints.indexOf(constraint);
		if (index >= 0) {
			this.#userConstraints.splice(index, 1);
		}
		const solver = this.getSolver();
		if (solver !== null && solver.hasConstraint(constraint)) {
			solver.removeConstraint(constraint);
		}
	}

	//==============================================================================
	// 등록된 사용자 제약 목록 반환. (사본)
	//==============================================================================
	/**
	 * @returns { LayoutConstraint[] } 사용자 제약 목록의 사본.
	 */
	getConstraints() {
		return this.#userConstraints.slice();
	}

	//==============================================================================
	// 좌측 변수 반환. (식 외 용도로 raw LayoutVariable 이 필요할 때)
	//==============================================================================
	/**
	 * @returns { LayoutVariable } 왼쪽 변수.
	 */
	getLeftVariable() {
		return this.#leftVariable;
	}

	//==============================================================================
	// 우측 변수 반환.
	//==============================================================================
	/**
	 * @returns { LayoutVariable } 오른쪽 변수.
	 */
	getRightVariable() {
		return this.#rightVariable;
	}

	//==============================================================================
	// 상단 변수 반환.
	//==============================================================================
	/**
	 * @returns { LayoutVariable } 위 변수.
	 */
	getTopVariable() {
		return this.#topVariable;
	}

	//==============================================================================
	// 하단 변수 반환.
	//==============================================================================
	/**
	 * @returns { LayoutVariable } 아래 변수.
	 */
	getBottomVariable() {
		return this.#bottomVariable;
	}

	//==============================================================================
	// 너비 변수 반환.
	//==============================================================================
	/**
	 * @returns { LayoutVariable } 너비 변수.
	 */
	getWidthVariable() {
		return this.#widthVariable;
	}

	//==============================================================================
	// 높이 변수 반환.
	//==============================================================================
	/**
	 * @returns { LayoutVariable } 높이 변수.
	 */
	getHeightVariable() {
		return this.#heightVariable;
	}

	//==============================================================================
	// 가로 중심 변수 반환.
	//==============================================================================
	/**
	 * @returns { LayoutVariable } 가로 중심 변수.
	 */
	getCenterXVariable() {
		return this.#centerXVariable;
	}

	//==============================================================================
	// 세로 중심 변수 반환.
	//==============================================================================
	/**
	 * @returns { LayoutVariable } 세로 중심 변수.
	 */
	getCenterYVariable() {
		return this.#centerYVariable;
	}

	//==============================================================================
	// 좌측 앵커 식 반환. (UIKit 의 leftAnchor 와 같은 사상)
	// - 사용자 제약 작성 시 호출, 새 LayoutExpression 인스턴스를 매 호출마다 반환.
	//   add / subtract / multiply / divide 가 불변이라 매번 새로 만들어도 안전.
	//==============================================================================
	/**
	 * @returns { LayoutExpression } 왼쪽 변수 하나로 된 새 식.
	 */
	get leftAnchor() {
		return LayoutExpression.fromVariable(this.#leftVariable);
	}

	//==============================================================================
	// 우측 앵커 식 반환. (UIKit 의 rightAnchor 와 같은 사상)
	//==============================================================================
	/**
	 * @returns { LayoutExpression } 오른쪽 변수 하나로 된 새 식.
	 */
	get rightAnchor() {
		return LayoutExpression.fromVariable(this.#rightVariable);
	}

	//==============================================================================
	// 상단 앵커 식 반환. (UIKit 의 topAnchor 와 같은 사상)
	//==============================================================================
	/**
	 * @returns { LayoutExpression } 위 변수 하나로 된 새 식.
	 */
	get topAnchor() {
		return LayoutExpression.fromVariable(this.#topVariable);
	}

	//==============================================================================
	// 하단 앵커 식 반환. (UIKit 의 bottomAnchor 와 같은 사상)
	//==============================================================================
	/**
	 * @returns { LayoutExpression } 아래 변수 하나로 된 새 식.
	 */
	get bottomAnchor() {
		return LayoutExpression.fromVariable(this.#bottomVariable);
	}

	//==============================================================================
	// 너비 앵커 식 반환. (UIKit 의 widthAnchor 와 같은 사상)
	//==============================================================================
	/**
	 * @returns { LayoutExpression } 너비 변수 하나로 된 새 식.
	 */
	get widthAnchor() {
		return LayoutExpression.fromVariable(this.#widthVariable);
	}

	//==============================================================================
	// 높이 앵커 식 반환. (UIKit 의 heightAnchor 와 같은 사상)
	//==============================================================================
	/**
	 * @returns { LayoutExpression } 높이 변수 하나로 된 새 식.
	 */
	get heightAnchor() {
		return LayoutExpression.fromVariable(this.#heightVariable);
	}

	//==============================================================================
	// 가로 중심 앵커 식 반환. (UIKit 의 centerXAnchor 와 같은 사상)
	//==============================================================================
	/**
	 * @returns { LayoutExpression } 가로 중심 변수 하나로 된 새 식.
	 */
	get centerXAnchor() {
		return LayoutExpression.fromVariable(this.#centerXVariable);
	}

	//==============================================================================
	// 세로 중심 앵커 식 반환. (UIKit 의 centerYAnchor 와 같은 사상)
	//==============================================================================
	/**
	 * @returns { LayoutExpression } 세로 중심 변수 하나로 된 새 식.
	 */
	get centerYAnchor() {
		return LayoutExpression.fromVariable(this.#centerYVariable);
	}

	//==============================================================================
	// 시작 앵커 식 반환. (UIKit 의 leadingAnchor 와 같은 사상)
	// - LTR 환경에서는 leftAnchor 와 동일. RTL 미지원이라 항상 leftAnchor 를 반환.
	//==============================================================================
	/**
	 * @returns { LayoutExpression } leftAnchor 와 같은 식.
	 */
	get leadingAnchor() {
		return this.leftAnchor;
	}

	//==============================================================================
	// 끝 앵커 식 반환. (UIKit 의 trailingAnchor 와 같은 사상)
	// - LTR 환경에서는 rightAnchor 와 동일. RTL 미지원이라 항상 rightAnchor 를 반환.
	//==============================================================================
	/**
	 * @returns { LayoutExpression } rightAnchor 와 같은 식.
	 */
	get trailingAnchor() {
		return this.rightAnchor;
	}

	//==============================================================================
	// 첫 번째 baseline 앵커 식 반환. (UIKit 의 firstBaselineAnchor 와 같은 사상)
	// - 텍스트 컨텐트가 없는 일반 UINode 는 topAnchor 와 동일.
	// - UILabel 등 텍스트 노드는 서브클래스가 override 해 ascent 보정.
	//==============================================================================
	/**
	 * @virtual
	 * @returns { LayoutExpression } topAnchor 와 같은 식. (하위 클래스가 바꿀 수 있다)
	 */
	get firstBaselineAnchor() {
		return this.topAnchor;
	}

	//==============================================================================
	// 마지막 baseline 앵커 식 반환. (UIKit 의 lastBaselineAnchor 와 같은 사상)
	// - 텍스트 컨텐트가 없는 일반 UINode 는 bottomAnchor 와 동일.
	// - UILabel 등 텍스트 노드는 서브클래스가 override 해 descent 보정.
	//==============================================================================
	/**
	 * @virtual
	 * @returns { LayoutExpression } bottomAnchor 와 같은 식. (하위 클래스가 바꿀 수 있다)
	 */
	get lastBaselineAnchor() {
		return this.bottomAnchor;
	}

	//==============================================================================
	// 좌측 위치 반환. (LayoutSolver.updateVariables 호출 후 유효)
	//==============================================================================
	/**
	 * @returns { number } 솔버가 푼 왼쪽 위치. (UI 트리 루트의 좌표계)
	 */
	getLeft() {
		return this.#leftVariable.getValue();
	}

	//==============================================================================
	// 우측 위치 반환.
	//==============================================================================
	/**
	 * @returns { number } 솔버가 푼 오른쪽 위치. (UI 트리 루트의 좌표계)
	 */
	getRight() {
		return this.#rightVariable.getValue();
	}

	//==============================================================================
	// 상단 위치 반환.
	//==============================================================================
	/**
	 * @returns { number } 솔버가 푼 위쪽 위치. (UI 트리 루트의 좌표계)
	 */
	getTop() {
		return this.#topVariable.getValue();
	}

	//==============================================================================
	// 하단 위치 반환.
	//==============================================================================
	/**
	 * @returns { number } 솔버가 푼 아래쪽 위치. (UI 트리 루트의 좌표계)
	 */
	getBottom() {
		return this.#bottomVariable.getValue();
	}

	//==============================================================================
	// 너비 반환.
	//==============================================================================
	/**
	 * @returns { number } 솔버가 푼 너비.
	 */
	getWidth() {
		return this.#widthVariable.getValue();
	}

	//==============================================================================
	// 높이 반환.
	//==============================================================================
	/**
	 * @returns { number } 솔버가 푼 높이.
	 */
	getHeight() {
		return this.#heightVariable.getValue();
	}

	//==============================================================================
	// 가로 중심 위치 반환.
	//==============================================================================
	/**
	 * @returns { number } 솔버가 푼 가로 중심 위치. (UI 트리 루트의 좌표계)
	 */
	getCenterX() {
		return this.#centerXVariable.getValue();
	}

	//==============================================================================
	// 세로 중심 위치 반환.
	//==============================================================================
	/**
	 * @returns { number } 솔버가 푼 세로 중심 위치. (UI 트리 루트의 좌표계)
	 */
	getCenterY() {
		return this.#centerYVariable.getValue();
	}

	//==============================================================================
	// 터치 인터랙션 활성화 설정. (WorldNode 와 같다)
	//==============================================================================
	/**
	 * @param { boolean } isInteractable 참이면 TouchRaycaster 가 이 노드를 맞힌다. (UIButton 이 붙으면 켠다)
	 */
	setInteractable(isInteractable) {
		this.#isInteractable = isInteractable;
	}

	//==============================================================================
	// 터치 인터랙션 활성화 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 누를 수 있으면 참.
	 */
	isInteractable() {
		return this.#isInteractable;
	}

	//==============================================================================
	// 이 노드의 로컬 자리 → 뷰 좌표.
	// - pushTransform 이 거는 이동(솔버의 left, top, 부모가 UINode 면 부모의 left, top 을 뺀 값), 회전, 배율을 부모들까지 거슬러 올라가며 건다.
	// - UINode 가 아닌 부모는 그 노드의 자식 좌표계로 본다. (피봇이 있는 WorldNode 는 내용 영역의 왼쪽 위가 원점)
	//==============================================================================
	/**
	 * @param { Vector2 } localPosition 이 노드의 로컬 자리. (내용 영역의 왼쪽 위가 원점)
	 * @returns { Vector2 } 뷰 좌표의 자리.
	 */
	convertToViewPosition(localPosition) {
		const localScale = this.getLocalScale();
		const radian = Math.degreeToRadian(this.getLocalRotation());
		const cosRadian = Math.cos(radian);
		const sinRadian = Math.sin(radian);
		const scaledX = localPosition.x * localScale.x;
		const scaledY = localPosition.y * localScale.y;
		let parentX = scaledX * cosRadian - scaledY * sinRadian + this.getLeft();
		let parentY = scaledX * sinRadian + scaledY * cosRadian + this.getTop();
		const parent = this.getParent();
		if (parent instanceof UINode) {
			parentX -= parent.getLeft();
			parentY -= parent.getTop();
			const parentLocalPosition = Vector2.create(parentX, parentY);
			const viewPosition = parent.convertToViewPosition(parentLocalPosition);
			return viewPosition;
		}
		if (!parent || typeof parent.getPosition !== "function") {
			return Vector2.create(parentX, parentY);
		}

		// 피봇이 있는 부모(WorldNode)는 내용 영역의 왼쪽 위가 자식의 원점이다. (WorldNode.getPosition 과 같은 셈)
		if (typeof parent.getPivot === "function" && typeof parent.getContentSize === "function") {
			const parentPivot = parent.getPivot();
			const parentContentSize = parent.getContentSize();
			parentX -= parentContentSize.x * parentPivot.x;
			parentY -= parentContentSize.y * parentPivot.y;
		}
		const parentPosition = parent.getPosition();
		const parentScale = parent.getScale();
		const parentRadian = Math.degreeToRadian(parent.getRotation());
		const parentCosRadian = Math.cos(parentRadian);
		const parentSinRadian = Math.sin(parentRadian);
		const parentScaledX = parentX * parentScale.x;
		const parentScaledY = parentY * parentScale.y;
		return Vector2.create(parentPosition.x + parentScaledX * parentCosRadian - parentScaledY * parentSinRadian, parentPosition.y + parentScaledX * parentSinRadian + parentScaledY * parentCosRadian);
	}

	//==============================================================================
	// 실제 화면에 그려지는 영역 반환. (OBB, WorldNode 와 같은 꼴)
	//==============================================================================
	/**
	 * @returns { Vector2[] } 네 귀퉁이. (왼쪽 위, 오른쪽 위, 오른쪽 아래, 왼쪽 아래 차례, 뷰 좌표)
	 */
	getWorldCorners() {
		const width = this.getWidth();
		const height = this.getHeight();
		const topLeft = this.convertToViewPosition(Vector2.create(0, 0));
		const topRight = this.convertToViewPosition(Vector2.create(width, 0));
		const bottomRight = this.convertToViewPosition(Vector2.create(width, height));
		const bottomLeft = this.convertToViewPosition(Vector2.create(0, height));
		return [topLeft, topRight, bottomRight, bottomLeft];
	}

	//==============================================================================
	// 자리가 노드 안인지. (getWorldCorners 로 잰다, WorldNode 와 같다)
	//==============================================================================
	/**
	 * @param { Vector2 } viewPosition 볼 뷰 좌표.
	 * @returns { boolean } 네 귀퉁이 안이면 참. (null 이면 거짓)
	 * @example <caption>솔버로 놓은 단추 자리 누르기</caption>
	 * import { UINode, UIButton, LayoutSolver, Vector2 } from "./build/vanilla.js";
	 *
	 * const solver = new LayoutSolver();
	 * const buttonNode = new UINode();
	 * buttonNode.setSolver(solver);
	 * buttonNode.addConstraint(buttonNode.leftAnchor.equalTo(40));
	 * buttonNode.addConstraint(buttonNode.topAnchor.equalTo(20));
	 * buttonNode.addConstraint(buttonNode.widthAnchor.equalTo(120));
	 * buttonNode.addConstraint(buttonNode.heightAnchor.equalTo(48));
	 * solver.updateVariables();
	 * const button = buttonNode.addComponent(UIButton);
	 * let clickCount = 0;
	 * button.setClickEvent(() => {
	 * 	++clickCount;
	 * 	return true;
	 * });
	 * buttonNode.touchPress(Vector2.create(60, 40));
	 * buttonNode.touchRelease(Vector2.create(60, 40));
	 * console.log(buttonNode.isInteractable(), buttonNode.contains(Vector2.create(60, 40)), buttonNode.contains(Vector2.create(10, 10)), clickCount);
	 */
	contains(viewPosition) {
		if (viewPosition === null || viewPosition === undefined) {
			return false;
		}
		const worldCorners = this.getWorldCorners();
		const obb = new OBB();
		obb.setEdges(worldCorners);
		const isInside = obb.contains(viewPosition);
		return isInside;
	}

	//==============================================================================
	// 터치 누름. (TouchRaycaster 가 부른다, 컴포넌트에 넘긴다)
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 뷰 좌표의 입력 위치.
	 */
	touchPress(viewInputPosition) {
		const components = this.getAllComponents();
		for (const component of components) {
			if (typeof component.touchPress === "function") {
				component.touchPress(viewInputPosition);
			}
		}
	}

	//==============================================================================
	// 터치 이동. (TouchRaycaster 가 부른다, 컴포넌트에 넘긴다)
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 뷰 좌표의 입력 위치.
	 */
	touchMove(viewInputPosition) {
		const components = this.getAllComponents();
		for (const component of components) {
			if (typeof component.touchMove === "function") {
				component.touchMove(viewInputPosition);
			}
		}
	}

	//==============================================================================
	// 터치 뗌. (TouchRaycaster 가 부른다, 컴포넌트에 넘긴다)
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 뷰 좌표의 입력 위치.
	 */
	touchRelease(viewInputPosition) {
		const components = this.getAllComponents();
		for (const component of components) {
			if (typeof component.touchRelease === "function") {
				component.touchRelease(viewInputPosition);
			}
		}
	}

	//==============================================================================
	// 터치 취소. (TouchRaycaster 가 부른다, 컴포넌트에 넘긴다)
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition 뷰 좌표의 입력 위치.
	 */
	touchCancel(viewInputPosition) {
		const components = this.getAllComponents();
		for (const component of components) {
			if (typeof component.touchCancel === "function") {
				component.touchCancel(viewInputPosition);
			}
		}
	}
}


//==============================================================================
// noIntrinsicMetric 상수 노출. (UIKit 의 UIView.noIntrinsicMetric)
//==============================================================================
UINode.noIntrinsicMetric = NO_INTRINSIC_METRIC;
