//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import * as Math from "../base/math.js";
import { Vector2 } from "../base/vector2.js";
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
	 * @param { Graphic } graphic
	 */
	pushTransform(graphic) {
		const canvasRenderingContext = graphic.getCanvasRenderingContext();
		if (canvasRenderingContext) {
			canvasRenderingContext.save();

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
			canvasRenderingContext.translate(translateX, translateY);
			canvasRenderingContext.rotate(radian);
			canvasRenderingContext.scale(localScale.x, localScale.y);

			const localOpacity = this.getLocalOpacity();
			canvasRenderingContext.globalAlpha *= localOpacity;
		}
	}

	//==============================================================================
	// 컨텐트 사이즈 반환. (솔버가 풀어낸 width / height)
	// - WorldNode 의 getContentSize 와 동일 시그니처. Mask 등 컴포넌트가 그대로 사용 가능.
	//==============================================================================
	/**
	 * @returns { Vector2 }
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
	 * @returns { LayoutConstraint[] }
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
	 * @returns { LayoutConstraint[] }
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
	 * @returns { Vector2 }
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
	 * @param { string } axis
	 * @returns { number }
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
	 * @param { number } priority
	 * @param { string } axis
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
	 * @param { string } axis
	 * @returns { number }
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
	 * @param { number } priority
	 * @param { string } axis
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
	 * @returns { { top: number, left: number, bottom: number, right: number } }
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
	 * @param { { top: number, left: number, bottom: number, right: number } } layoutMargins
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
	 * @returns { UINode }
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
	 * @param { LayoutSolver | null } solver
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
	 * @returns { LayoutSolver | null }
	 */
	getSolver() {
		return this.#solver;
	}

	//==============================================================================
	// 사용자 제약 추가. 솔버에 즉시 등록.
	//==============================================================================
	/**
	 * @param { LayoutConstraint } constraint
	 */
	addConstraint(constraint) {
		this.#userConstraints.push(constraint);
		const solver = this.getSolver();
		if (solver !== null) {
			solver.addConstraint(constraint);
		}
	}

	//==============================================================================
	// 사용자 제약 제거. 솔버에서도 제거.
	//==============================================================================
	/**
	 * @param { LayoutConstraint } constraint
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
	 * @returns { LayoutConstraint[] }
	 */
	getConstraints() {
		return this.#userConstraints.slice();
	}

	//==============================================================================
	// 좌측 변수 반환. (식 외 용도로 raw LayoutVariable 이 필요할 때)
	//==============================================================================
	/**
	 * @returns { LayoutVariable }
	 */
	getLeftVariable() {
		return this.#leftVariable;
	}

	//==============================================================================
	// 우측 변수 반환.
	//==============================================================================
	/**
	 * @returns { LayoutVariable }
	 */
	getRightVariable() {
		return this.#rightVariable;
	}

	//==============================================================================
	// 상단 변수 반환.
	//==============================================================================
	/**
	 * @returns { LayoutVariable }
	 */
	getTopVariable() {
		return this.#topVariable;
	}

	//==============================================================================
	// 하단 변수 반환.
	//==============================================================================
	/**
	 * @returns { LayoutVariable }
	 */
	getBottomVariable() {
		return this.#bottomVariable;
	}

	//==============================================================================
	// 너비 변수 반환.
	//==============================================================================
	/**
	 * @returns { LayoutVariable }
	 */
	getWidthVariable() {
		return this.#widthVariable;
	}

	//==============================================================================
	// 높이 변수 반환.
	//==============================================================================
	/**
	 * @returns { LayoutVariable }
	 */
	getHeightVariable() {
		return this.#heightVariable;
	}

	//==============================================================================
	// 가로 중심 변수 반환.
	//==============================================================================
	/**
	 * @returns { LayoutVariable }
	 */
	getCenterXVariable() {
		return this.#centerXVariable;
	}

	//==============================================================================
	// 세로 중심 변수 반환.
	//==============================================================================
	/**
	 * @returns { LayoutVariable }
	 */
	getCenterYVariable() {
		return this.#centerYVariable;
	}

	//==============================================================================
	// 좌측 앵커 식 반환. (UIKit 의 leftAnchor 와 같은 사상)
	// - 사용자 제약 작성 시 호출 — 새 LayoutExpression 인스턴스를 매 호출마다 반환.
	//   add / subtract / multiply / divide 가 불변이라 매번 새로 만들어도 안전.
	//==============================================================================
	/**
	 * @returns { LayoutExpression }
	 */
	get leftAnchor() {
		return LayoutExpression.fromVariable(this.#leftVariable);
	}

	//==============================================================================
	// 우측 앵커 식 반환. (UIKit 의 rightAnchor 와 같은 사상)
	//==============================================================================
	/**
	 * @returns { LayoutExpression }
	 */
	get rightAnchor() {
		return LayoutExpression.fromVariable(this.#rightVariable);
	}

	//==============================================================================
	// 상단 앵커 식 반환. (UIKit 의 topAnchor 와 같은 사상)
	//==============================================================================
	/**
	 * @returns { LayoutExpression }
	 */
	get topAnchor() {
		return LayoutExpression.fromVariable(this.#topVariable);
	}

	//==============================================================================
	// 하단 앵커 식 반환. (UIKit 의 bottomAnchor 와 같은 사상)
	//==============================================================================
	/**
	 * @returns { LayoutExpression }
	 */
	get bottomAnchor() {
		return LayoutExpression.fromVariable(this.#bottomVariable);
	}

	//==============================================================================
	// 너비 앵커 식 반환. (UIKit 의 widthAnchor 와 같은 사상)
	//==============================================================================
	/**
	 * @returns { LayoutExpression }
	 */
	get widthAnchor() {
		return LayoutExpression.fromVariable(this.#widthVariable);
	}

	//==============================================================================
	// 높이 앵커 식 반환. (UIKit 의 heightAnchor 와 같은 사상)
	//==============================================================================
	/**
	 * @returns { LayoutExpression }
	 */
	get heightAnchor() {
		return LayoutExpression.fromVariable(this.#heightVariable);
	}

	//==============================================================================
	// 가로 중심 앵커 식 반환. (UIKit 의 centerXAnchor 와 같은 사상)
	//==============================================================================
	/**
	 * @returns { LayoutExpression }
	 */
	get centerXAnchor() {
		return LayoutExpression.fromVariable(this.#centerXVariable);
	}

	//==============================================================================
	// 세로 중심 앵커 식 반환. (UIKit 의 centerYAnchor 와 같은 사상)
	//==============================================================================
	/**
	 * @returns { LayoutExpression }
	 */
	get centerYAnchor() {
		return LayoutExpression.fromVariable(this.#centerYVariable);
	}

	//==============================================================================
	// 시작 앵커 식 반환. (UIKit 의 leadingAnchor 와 같은 사상)
	// - LTR 환경에서는 leftAnchor 와 동일. RTL 미지원이라 항상 leftAnchor 를 반환.
	//==============================================================================
	/**
	 * @returns { LayoutExpression }
	 */
	get leadingAnchor() {
		return this.leftAnchor;
	}

	//==============================================================================
	// 끝 앵커 식 반환. (UIKit 의 trailingAnchor 와 같은 사상)
	// - LTR 환경에서는 rightAnchor 와 동일. RTL 미지원이라 항상 rightAnchor 를 반환.
	//==============================================================================
	/**
	 * @returns { LayoutExpression }
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
	 * @returns { LayoutExpression }
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
	 * @returns { LayoutExpression }
	 */
	get lastBaselineAnchor() {
		return this.bottomAnchor;
	}

	//==============================================================================
	// 좌측 위치 반환. (LayoutSolver.updateVariables 호출 후 유효)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getLeft() {
		return this.#leftVariable.getValue();
	}

	//==============================================================================
	// 우측 위치 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getRight() {
		return this.#rightVariable.getValue();
	}

	//==============================================================================
	// 상단 위치 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getTop() {
		return this.#topVariable.getValue();
	}

	//==============================================================================
	// 하단 위치 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getBottom() {
		return this.#bottomVariable.getValue();
	}

	//==============================================================================
	// 너비 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getWidth() {
		return this.#widthVariable.getValue();
	}

	//==============================================================================
	// 높이 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getHeight() {
		return this.#heightVariable.getValue();
	}

	//==============================================================================
	// 가로 중심 위치 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getCenterX() {
		return this.#centerXVariable.getValue();
	}

	//==============================================================================
	// 세로 중심 위치 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getCenterY() {
		return this.#centerYVariable.getValue();
	}
}


//==============================================================================
// noIntrinsicMetric 상수 노출. (UIKit 의 UIView.noIntrinsicMetric)
//==============================================================================
UINode.noIntrinsicMetric = NO_INTRINSIC_METRIC;
