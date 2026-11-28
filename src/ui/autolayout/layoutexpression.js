//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { LayoutTerm } from "./layoutterm.js";
import { LayoutVariable } from "./layoutvariable.js";
import { LayoutRelation } from "./layoutrelation.js";


//==============================================================================
// 선형 식. terms[] + constant 형태.
// - 모든 산술 메서드는 새 LayoutExpression 을 반환 (불변 객체).
// - equalTo / lessThanOrEqualTo / greaterThanOrEqualTo 는 LayoutConstraint 를 반환.
// - 인자는 number / LayoutVariable / LayoutTerm / LayoutExpression 중 하나를 받는다.
//==============================================================================
/**
 * @example <caption>왼쪽과 너비로 가운데 식을 만들어 풀기</caption>
 * import { LayoutSolver, LayoutVariable, LayoutExpression } from "./build/vanilla.js";
 *
 * const solver = new LayoutSolver();
 * const left = new LayoutVariable("left");
 * const width = new LayoutVariable("width");
 * const leftExpression = LayoutExpression.fromVariable(left);
 * const widthExpression = LayoutExpression.fromVariable(width);
 * const halfWidthExpression = widthExpression.divide(2);
 * const centerExpression = leftExpression.add(halfWidthExpression);
 * const leftConstraint = leftExpression.equalTo(40);
 * const widthConstraint = widthExpression.greaterThanOrEqualTo(120);
 * const centerConstraint = centerExpression.equalTo(200);
 * solver.addConstraint(leftConstraint);
 * solver.addConstraint(widthConstraint);
 * solver.addConstraint(centerConstraint);
 * solver.updateVariables();
 * const widthValue = width.getValue();
 * const centerValue = centerExpression.getValue();
 * console.log(widthValue, centerValue);
 */
export class LayoutExpression {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { LayoutTerm[] } */ #terms;
	/** @private @type { number } */ #constant;

	//==============================================================================
	// 생성.
	// - terms: LayoutTerm 배열 (사본을 갖는다).
	// - constant: 상수항.
	//==============================================================================
	/**
	 * @constructor
	 * @param { LayoutTerm[] } [terms] 항 목록. (사본을 갖고, 배열이 아니면 빈 목록)
	 * @param { number } [constant] 상수항. (숫자가 아니면 0)
	 */
	constructor(terms, constant) {
		this.#terms = System.Array.isArray(terms) ? terms.slice() : [];
		this.#constant = (typeof constant === "number") ? constant : 0.0;
	}

	//==============================================================================
	// 정적 팩토리: 단일 LayoutVariable 로부터 식 생성. (1 * variable + 0)
	//==============================================================================
	/**
	 * @param { LayoutVariable } variable 식으로 만들 변수.
	 * @returns { LayoutExpression } 1 * variable + 0 인 새 식.
	 */
	static fromVariable(variable) {
		const term = new LayoutTerm(variable, 1.0);
		const expression = new LayoutExpression([term], 0.0);
		return expression;
	}

	//==============================================================================
	// 정적 팩토리: 상수만 가진 식 생성.
	//==============================================================================
	/**
	 * @param { number } value 상수항.
	 * @returns { LayoutExpression } 항 없이 상수항만 가진 새 식.
	 */
	static fromConstant(value) {
		const expression = new LayoutExpression([], value);
		return expression;
	}

	//==============================================================================
	// 임의 입력 (number / LayoutVariable / LayoutTerm / LayoutExpression) 을
	// LayoutExpression 으로 정규화.
	//==============================================================================
	/**
	 * @param { * } input number, LayoutVariable, LayoutTerm, LayoutExpression 가운데 하나. (그 밖이면 예외)
	 * @returns { LayoutExpression } 식. (LayoutExpression 이면 그것 그대로, 아니면 새 식)
	 * @example <caption>여러 꼴의 입력을 식으로 바꾸기</caption>
	 * import { LayoutVariable, LayoutTerm, LayoutExpression } from "./build/vanilla.js";
	 *
	 * const width = new LayoutVariable("width");
	 * const doubleWidth = new LayoutTerm(width, 2);
	 * const fromNumber = LayoutExpression.toExpression(8);
	 * const fromVariable = LayoutExpression.toExpression(width);
	 * const fromTerm = LayoutExpression.toExpression(doubleWidth);
	 * const sameExpression = LayoutExpression.toExpression(fromVariable);
	 * const isNumberConstant = fromNumber.isConstant();
	 * const termList = fromTerm.getTerms();
	 * console.log(isNumberConstant, termList.length, sameExpression === fromVariable);
	 */
	static toExpression(input) {
		if (input instanceof LayoutExpression) {
			return input;
		}
		if (input instanceof LayoutTerm) {
			return new LayoutExpression([input], 0.0);
		}
		if (input instanceof LayoutVariable) {
			return LayoutExpression.fromVariable(input);
		}
		if (typeof input === "number") {
			return LayoutExpression.fromConstant(input);
		}
		throw new System.Error("[LayoutExpression] toExpression: 지원되지 않는 입력 타입.");
	}

	//==============================================================================
	// 항 배열 반환.
	//==============================================================================
	/**
	 * @returns { LayoutTerm[] } 항 목록. (사본이 아닌 원본)
	 */
	getTerms() {
		return this.#terms;
	}

	//==============================================================================
	// 상수항 반환.
	//==============================================================================
	/**
	 * @returns { number } 상수항.
	 */
	getConstant() {
		return this.#constant;
	}

	//==============================================================================
	// 항이 없는지 (= 상수항만 있는지) 여부.
	//==============================================================================
	/**
	 * @returns { boolean } 항이 없으면 참.
	 */
	isConstant() {
		const terms = this.getTerms();
		return terms.length === 0;
	}

	//==============================================================================
	// 평가값 (sum(term.value) + constant) 반환.
	//==============================================================================
	/**
	 * @returns { number } 항 값의 합에 상수항을 더한 값. (변수 값은 마지막 updateVariables 기준)
	 */
	getValue() {
		let result = this.getConstant();
		const terms = this.getTerms();
		for (const term of terms) {
			result += term.getValue();
		}
		return result;
	}

	//==============================================================================
	// 산술: 덧셈.
	//==============================================================================
	/**
	 * @param { * } input 더할 값. (number, LayoutVariable, LayoutTerm, LayoutExpression)
	 * @returns { LayoutExpression } 더한 새 식. (같은 변수의 항도 합치지 않고 이어 붙인다)
	 * @example <caption>오른쪽 끝 식 만들기</caption>
	 * import { LayoutVariable, LayoutExpression } from "./build/vanilla.js";
	 *
	 * const left = new LayoutVariable("left");
	 * const width = new LayoutVariable("width");
	 * const leftExpression = LayoutExpression.fromVariable(left);
	 * const rightExpression = leftExpression.add(width);
	 * const paddedExpression = rightExpression.add(8);
	 * const termList = paddedExpression.getTerms();
	 * const constant = paddedExpression.getConstant();
	 * console.log(termList.length, constant);
	 */
	add(input) {
		const otherExpression = LayoutExpression.toExpression(input);
		const otherTerms = otherExpression.getTerms();
		const otherConstant = otherExpression.getConstant();
		const ownTerms = this.getTerms();
		const newTerms = ownTerms.slice();
		for (const otherTerm of otherTerms) {
			newTerms.push(otherTerm);
		}
		const newConstant = this.getConstant() + otherConstant;
		const result = new LayoutExpression(newTerms, newConstant);
		return result;
	}

	//==============================================================================
	// 산술: 뺄셈.
	//==============================================================================
	/**
	 * @param { * } input 뺄 값. (number, LayoutVariable, LayoutTerm, LayoutExpression)
	 * @returns { LayoutExpression } 뺀 새 식.
	 */
	subtract(input) {
		const otherExpression = LayoutExpression.toExpression(input);
		const negated = otherExpression.multiply(-1.0);
		const result = this.add(negated);
		return result;
	}

	//==============================================================================
	// 산술: 곱셈 (스칼라).
	// - 변수×변수 같은 비선형 곱은 지원하지 않는다 (선형 시스템 한정).
	//==============================================================================
	/**
	 * @param { number } coefficient 곱할 수. (number 가 아니면 예외)
	 * @returns { LayoutExpression } 모든 항의 계수와 상수항에 곱한 새 식.
	 */
	multiply(coefficient) {
		if (typeof coefficient !== "number") {
			throw new System.Error("[LayoutExpression] multiply: 스칼라(number) 만 지원.");
		}
		const ownTerms = this.getTerms();
		const newTerms = [];
		for (const term of ownTerms) {
			const variable = term.getVariable();
			const oldCoefficient = term.getCoefficient();
			const newTerm = new LayoutTerm(variable, oldCoefficient * coefficient);
			newTerms.push(newTerm);
		}
		const newConstant = this.getConstant() * coefficient;
		const result = new LayoutExpression(newTerms, newConstant);
		return result;
	}

	//==============================================================================
	// 산술: 나눗셈 (스칼라).
	//==============================================================================
	/**
	 * @param { number } denominator 나눌 수. (number 가 아니거나 0 이면 예외)
	 * @returns { LayoutExpression } 1 / denominator 를 곱한 새 식.
	 */
	divide(denominator) {
		if (typeof denominator !== "number") {
			throw new System.Error("[LayoutExpression] divide: 스칼라(number) 만 지원.");
		}
		if (denominator === 0) {
			throw new System.Error("[LayoutExpression] divide: 0 으로 나눌 수 없음.");
		}
		const result = this.multiply(1.0 / denominator);
		return result;
	}

	//==============================================================================
	// 비교: 동등 제약 생성. (this == input)
	//==============================================================================
	/**
	 * @param { * } input 오른쪽 값. (number, LayoutVariable, LayoutTerm, LayoutExpression)
	 * @returns { import("./layoutconstraint.js").LayoutConstraint } this - input == 0 인 required 제약.
	 */
	equalTo(input) {
		const otherExpression = LayoutExpression.toExpression(input);
		const difference = this.subtract(otherExpression);
		const LayoutConstraintModule = layoutConstraintModule();
		const constraint = new LayoutConstraintModule.LayoutConstraint(difference, LayoutRelation.equal);
		return constraint;
	}

	//==============================================================================
	// 비교: 작거나 같음 제약 생성. (this <= input)
	//==============================================================================
	/**
	 * @param { * } input 오른쪽 값. (number, LayoutVariable, LayoutTerm, LayoutExpression)
	 * @returns { import("./layoutconstraint.js").LayoutConstraint } this - input <= 0 인 required 제약.
	 */
	lessThanOrEqualTo(input) {
		const otherExpression = LayoutExpression.toExpression(input);
		const difference = this.subtract(otherExpression);
		const LayoutConstraintModule = layoutConstraintModule();
		const constraint = new LayoutConstraintModule.LayoutConstraint(difference, LayoutRelation.lessThanOrEqual);
		return constraint;
	}

	//==============================================================================
	// 비교: 크거나 같음 제약 생성. (this >= input)
	//==============================================================================
	/**
	 * @param { * } input 오른쪽 값. (number, LayoutVariable, LayoutTerm, LayoutExpression)
	 * @returns { import("./layoutconstraint.js").LayoutConstraint } this - input >= 0 인 required 제약.
	 */
	greaterThanOrEqualTo(input) {
		const otherExpression = LayoutExpression.toExpression(input);
		const difference = this.subtract(otherExpression);
		const LayoutConstraintModule = layoutConstraintModule();
		const constraint = new LayoutConstraintModule.LayoutConstraint(difference, LayoutRelation.greaterThanOrEqual);
		return constraint;
	}
}


//==============================================================================
// LayoutConstraint 와의 순환 import 방지를 위한 lazy 로더.
//==============================================================================
let cachedLayoutConstraintModule = null;
//==============================================================================
// LayoutConstraint 모듈 반환. (첫 호출 때 받아 cachedLayoutConstraintModule 에 담아 둔다)
//==============================================================================
function layoutConstraintModule() {
	if (cachedLayoutConstraintModule === null) {
		cachedLayoutConstraintModule = require_layoutconstraint();
	}
	return cachedLayoutConstraintModule;
}

//==============================================================================
// 동기 import 우회. ESM 환경에서 dynamic import 는 비동기지만, 본 모듈은 사용 시점이
// 항상 LayoutConstraint 가 이미 로드된 이후 (사용자가 식을 만들고 비교를 호출할 때)
// 라서 정적 import 를 따로 두고 첫 호출 시 그 참조를 캐시한다.
//==============================================================================
import * as LayoutConstraintNamespace from "./layoutconstraint.js";
//==============================================================================
// 정적으로 들여온 LayoutConstraint 모듈 이름 공간 반환.
//==============================================================================
function require_layoutconstraint() {
	return LayoutConstraintNamespace;
}
