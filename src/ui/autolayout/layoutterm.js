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
	 * @param { LayoutVariable } variable
	 * @param { number } [coefficient]
	 */
	constructor(variable, coefficient) {
		this.#variable = (variable !== undefined && variable !== null) ? variable : null;
		this.#coefficient = (typeof coefficient === "number") ? coefficient : 1.0;
	}

	//==============================================================================
	// 변수 반환.
	//==============================================================================
	/**
	 * @returns { LayoutVariable | null }
	 */
	getVariable() {
		return this.#variable;
	}

	//==============================================================================
	// 계수 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getCoefficient() {
		return this.#coefficient;
	}

	//==============================================================================
	// 평가값 (coefficient * variable.value) 반환. variable 이 없으면 0.
	//==============================================================================
	/**
	 * @returns { number }
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
