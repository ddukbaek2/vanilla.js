//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { LayoutExpression } from "./layoutexpression.js";
import { LayoutRelation } from "./layoutrelation.js";
import { LayoutStrength } from "./layoutstrength.js";


//==============================================================================
// 레이아웃 제약.
// - 형태: expression { ==, <=, >= } 0
// - LayoutExpression.equalTo / lessThanOrEqualTo / greaterThanOrEqualTo 가 생성한다.
// - 강도 (strength) 는 충돌 시 우선순위 결정. 기본은 required.
//==============================================================================
/**
 * @example <caption>최소 높이와 약한 선호 높이 제약 풀기</caption>
 * import { LayoutSolver, LayoutVariable, LayoutExpression, LayoutConstraint, LayoutRelation, LayoutStrength } from "./build/vanilla.js";
 *
 * const solver = new LayoutSolver();
 * const height = new LayoutVariable("height");
 * const heightExpression = LayoutExpression.fromVariable(height);
 * const minimumExpression = heightExpression.subtract(44);
 * const minimumConstraint = new LayoutConstraint(minimumExpression, LayoutRelation.greaterThanOrEqual);
 * const preferredExpression = heightExpression.subtract(30);
 * const preferredConstraint = new LayoutConstraint(preferredExpression, LayoutRelation.equal, LayoutStrength.weak);
 * solver.addConstraint(minimumConstraint);
 * solver.addConstraint(preferredConstraint);
 * solver.updateVariables();
 * const heightValue = height.getValue();
 * console.log(heightValue);
 */
export class LayoutConstraint {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { LayoutExpression } */ #expression;
	/** @private @type { string } */ #relation;
	/** @private @type { number } */ #strength;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { LayoutExpression } expression 식. (expression relation 0 꼴, LayoutExpression 이 아니면 예외)
	 * @param { string } relation LayoutRelation 값.
	 * @param { number } [strength] 강도. (숫자가 아니면 required, 0 ~ required 로 자른다)
	 */
	constructor(expression, relation, strength) {
		if (!(expression instanceof LayoutExpression)) {
			throw new System.Error("[LayoutConstraint] expression 은 LayoutExpression 이어야 함.");
		}
		this.#expression = expression;
		this.#relation = relation;
		const requestedStrength = (typeof strength === "number") ? strength : LayoutStrength.required;
		this.#strength = LayoutStrength.clipStrength(requestedStrength);
	}

	//==============================================================================
	// 식 반환.
	//==============================================================================
	/**
	 * @returns { LayoutExpression } 제약의 식.
	 */
	getExpression() {
		return this.#expression;
	}

	//==============================================================================
	// 관계 반환.
	//==============================================================================
	/**
	 * @returns { string } LayoutRelation 값.
	 */
	getRelation() {
		return this.#relation;
	}

	//==============================================================================
	// 강도 반환.
	//==============================================================================
	/**
	 * @returns { number } 강도. (0 ~ required 로 자른 값)
	 */
	getStrength() {
		return this.#strength;
	}

	//==============================================================================
	// 강도만 다른 사본 반환. (제약 자체는 동일하지만 우선순위만 바꿔서 다시 등록할 때)
	//==============================================================================
	/**
	 * @param { number } newStrength 새 강도. (0 ~ required 로 자른다)
	 * @returns { LayoutConstraint } 식과 관계가 같고 강도만 다른 새 제약. (솔버에 넣은 제약은 그대로 둔다)
	 * @example <caption>필수 제약을 약한 제약으로 바꿔 다시 넣기</caption>
	 * import { LayoutSolver, LayoutVariable, LayoutExpression, LayoutStrength } from "./build/vanilla.js";
	 *
	 * const solver = new LayoutSolver();
	 * const width = new LayoutVariable("width");
	 * const widthExpression = LayoutExpression.fromVariable(width);
	 * const requiredConstraint = widthExpression.equalTo(100);
	 * solver.addConstraint(requiredConstraint);
	 * solver.removeConstraint(requiredConstraint);
	 * const weakConstraint = requiredConstraint.withStrength(LayoutStrength.weak);
	 * solver.addConstraint(weakConstraint);
	 * const minimumConstraint = widthExpression.greaterThanOrEqualTo(160);
	 * solver.addConstraint(minimumConstraint);
	 * solver.updateVariables();
	 * const widthValue = width.getValue();
	 * console.log(widthValue);
	 */
	withStrength(newStrength) {
		const expression = this.getExpression();
		const relation = this.getRelation();
		const constraint = new LayoutConstraint(expression, relation, newStrength);
		return constraint;
	}
}
