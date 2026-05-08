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
	 * @param { LayoutExpression } expression
	 * @param { string } relation
	 * @param { number } [strength]
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
	 * @returns { LayoutExpression }
	 */
	getExpression() {
		return this.#expression;
	}

	//==============================================================================
	// 관계 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getRelation() {
		return this.#relation;
	}

	//==============================================================================
	// 강도 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getStrength() {
		return this.#strength;
	}

	//==============================================================================
	// 강도만 다른 사본 반환. (제약 자체는 동일하지만 우선순위만 바꿔서 다시 등록할 때)
	//==============================================================================
	/**
	 * @param { number } newStrength
	 * @returns { LayoutConstraint }
	 */
	withStrength(newStrength) {
		const expression = this.getExpression();
		const relation = this.getRelation();
		const constraint = new LayoutConstraint(expression, relation, newStrength);
		return constraint;
	}
}
