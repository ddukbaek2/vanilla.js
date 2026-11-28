//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { LayoutVariable } from "./layoutvariable.js";


//==============================================================================
// 식의 한 항. coefficient * variable.
// - LayoutExpression 의 구성 요소.
// - 불변 객체. 산술 연산은 항상 새 인스턴스를 반환한다.
//==============================================================================
/**
 * @example <caption>계수 0.5 인 항으로 가운데 식 만들기</caption>
 * import { LayoutSolver, LayoutVariable, LayoutTerm, LayoutExpression } from "./build/vanilla.js";
 *
 * const width = new LayoutVariable("width");
 * const halfWidth = new LayoutTerm(width, 0.5);
 * const centerExpression = new LayoutExpression([halfWidth], 10);
 * const solver = new LayoutSolver();
 * const widthExpression = LayoutExpression.fromVariable(width);
 * const widthConstraint = widthExpression.equalTo(300);
 * solver.addConstraint(widthConstraint);
 * solver.updateVariables();
 * const termValue = halfWidth.getValue();
 * const centerValue = centerExpression.getValue();
 * console.log(termValue, centerValue);
 */
export class LayoutTerm {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { LayoutVariable | null } */ #variable;
	/** @private @type { number } */ #coefficient;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { LayoutVariable } variable 항의 변수. (undefined 나 null 이면 null 로 두고 값은 0, 솔버는 이런 항을 건너뛴다)
	 * @param { number } [coefficient] 계수. (숫자가 아니면 1)
	 */
	constructor(variable, coefficient) {
		this.#variable = (variable !== undefined && variable !== null) ? variable : null;
		this.#coefficient = (typeof coefficient === "number") ? coefficient : 1.0;
	}

	//==============================================================================
	// 변수 반환.
	//==============================================================================
	/**
	 * @returns { LayoutVariable | null } 항의 변수. (없으면 null)
	 */
	getVariable() {
		return this.#variable;
	}

	//==============================================================================
	// 계수 반환.
	//==============================================================================
	/**
	 * @returns { number } 계수.
	 */
	getCoefficient() {
		return this.#coefficient;
	}

	//==============================================================================
	// 평가값 (coefficient * variable.value) 반환. variable 이 없으면 0.
	//==============================================================================
	/**
	 * @returns { number } coefficient * 변수 값. (변수가 없으면 0)
	 */
	getValue() {
		const variable = this.getVariable();
		if (variable === null) {
			return 0.0;
		}
		const coefficient = this.getCoefficient();
		const variableValue = variable.getValue();
		return coefficient * variableValue;
	}
}
