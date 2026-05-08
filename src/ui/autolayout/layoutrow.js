//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 솔버 내부 행. (외부 노출 X)
// - tableau 의 한 행을 표현한다.
// - cells: Map<LayoutSymbol, coefficient>
// - constant: 상수항
// - 모든 변경 메서드는 in-place. (성능상 솔버 내부 전용이라 사본은 copy() 로만)
//==============================================================================
export class LayoutRow {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Map<import("./layoutsymbol.js").LayoutSymbol, number> } */ #cells;
	/** @private @type { number } */ #constant;

	//==============================================================================
	// 생성. constant 는 초기 상수항.
	//==============================================================================
	/**
	 * @constructor
	 * @param { number } [constant]
	 */
	constructor(constant) {
		this.#cells = new System.Map();
		this.#constant = (typeof constant === "number") ? constant : 0.0;
	}

	//==============================================================================
	// 셀 맵 반환.
	//==============================================================================
	/**
	 * @returns { Map<import("./layoutsymbol.js").LayoutSymbol, number> }
	 */
	getCells() {
		return this.#cells;
	}

	//==============================================================================
	// 상수항 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getConstant() {
		return this.#constant;
	}

	//==============================================================================
	// 상수항 설정.
	//==============================================================================
	/**
	 * @param { number } constant
	 */
	setConstant(constant) {
		this.#constant = constant;
	}

	//==============================================================================
	// 사본 생성.
	//==============================================================================
	/**
	 * @returns { LayoutRow }
	 */
	copy() {
		const cloned = new LayoutRow(this.getConstant());
		const ownCells = this.getCells();
		const clonedCells = cloned.getCells();
		for (const [symbol, coefficient] of ownCells) {
			clonedCells.set(symbol, coefficient);
		}
		return cloned;
	}

	//==============================================================================
	// 상수항에 값 추가. 새 상수 반환.
	//==============================================================================
	/**
	 * @param { number } value
	 * @returns { number }
	 */
	addConstant(value) {
		const newConstant = this.getConstant() + value;
		this.setConstant(newConstant);
		return newConstant;
	}

	//==============================================================================
	// 심볼에 coefficient * value 만큼 값을 더한다.
	// - 결과가 0 에 매우 근접하면 셀에서 제거.
	//==============================================================================
	/**
	 * @param { import("./layoutsymbol.js").LayoutSymbol } symbol
	 * @param { number } [coefficient]
	 */
	insertSymbol(symbol, coefficient) {
		const finalCoefficient = (typeof coefficient === "number") ? coefficient : 1.0;
		const cells = this.getCells();
		const previous = cells.has(symbol) ? cells.get(symbol) : 0.0;
		const next = previous + finalCoefficient;
		if (nearZero(next)) {
			cells.delete(symbol);
		}
		else {
			cells.set(symbol, next);
		}
	}

	//==============================================================================
	// 다른 행을 coefficient 만큼 곱한 뒤 본 행에 더한다.
	//==============================================================================
	/**
	 * @param { LayoutRow } otherRow
	 * @param { number } [coefficient]
	 */
	insertRow(otherRow, coefficient) {
		const finalCoefficient = (typeof coefficient === "number") ? coefficient : 1.0;
		const otherConstant = otherRow.getConstant();
		this.addConstant(otherConstant * finalCoefficient);
		const otherCells = otherRow.getCells();
		for (const [symbol, otherValue] of otherCells) {
			this.insertSymbol(symbol, otherValue * finalCoefficient);
		}
	}

	//==============================================================================
	// 심볼 제거.
	//==============================================================================
	/**
	 * @param { import("./layoutsymbol.js").LayoutSymbol } symbol
	 */
	removeSymbol(symbol) {
		const cells = this.getCells();
		cells.delete(symbol);
	}

	//==============================================================================
	// 행의 부호 반전. constant 와 모든 cell coefficient 를 -1 곱.
	//==============================================================================
	reverseSign() {
		this.setConstant(-this.getConstant());
		const cells = this.getCells();
		for (const [symbol, value] of cells) {
			cells.set(symbol, -value);
		}
	}

	//==============================================================================
	// 행을 주어진 심볼 기준으로 풀이한다 (해당 cell 의 계수로 행 전체를 정규화).
	// - 결과: subject 의 계수가 -1 이 되도록 변환된다 (Kiwi 관례).
	// - subject 가 cells 에 없으면 동작 미정의 (호출자가 보장).
	//==============================================================================
	/**
	 * @param { import("./layoutsymbol.js").LayoutSymbol } subject
	 */
	solveFor(subject) {
		const cells = this.getCells();
		const subjectCoefficient = cells.get(subject);
		const inverse = -1.0 / subjectCoefficient;
		cells.delete(subject);
		this.setConstant(this.getConstant() * inverse);
		const updatedCells = new System.Map();
		for (const [symbol, value] of cells) {
			updatedCells.set(symbol, value * inverse);
		}
		// in-place 교체.
		cells.clear();
		for (const [symbol, value] of updatedCells) {
			cells.set(symbol, value);
		}
	}

	//==============================================================================
	// lhs = rhs 형태로 본 행을 lhs 기준으로 풀고, rhs 기준으로 다시 푸는 헬퍼.
	// - solveFor(lhs, rhs): rhs 의 계수 / lhs 의 계수로 정규화 후 lhs 제거.
	// - 외부에서 잘 안 쓰지만 솔버 substitute 단계에서 호출.
	//==============================================================================
	/**
	 * @param { import("./layoutsymbol.js").LayoutSymbol } lhs
	 * @param { import("./layoutsymbol.js").LayoutSymbol } rhs
	 */
	solveForPair(lhs, rhs) {
		this.insertSymbol(lhs, -1.0);
		this.solveFor(rhs);
	}

	//==============================================================================
	// 주어진 심볼의 계수 반환. 없으면 0.
	//==============================================================================
	/**
	 * @param { import("./layoutsymbol.js").LayoutSymbol } symbol
	 * @returns { number }
	 */
	coefficientFor(symbol) {
		const cells = this.getCells();
		if (!cells.has(symbol)) {
			return 0.0;
		}
		return cells.get(symbol);
	}

	//==============================================================================
	// 다른 심볼이 본 행의 substitute 행으로 대체될 때, 본 행에 그 효과를 반영.
	//==============================================================================
	/**
	 * @param { import("./layoutsymbol.js").LayoutSymbol } symbol
	 * @param { LayoutRow } substitutionRow
	 */
	substitute(symbol, substitutionRow) {
		const cells = this.getCells();
		if (!cells.has(symbol)) {
			return;
		}
		const coefficient = cells.get(symbol);
		cells.delete(symbol);
		this.insertRow(substitutionRow, coefficient);
	}
}


//==============================================================================
// 부동소수 0 근접 판정. (Kiwi 의 EPS 와 동일)
//==============================================================================
const NEAR_ZERO_EPS = 1e-8;
function nearZero(value) {
	return value < 0.0 ? -value < NEAR_ZERO_EPS : value < NEAR_ZERO_EPS;
}
