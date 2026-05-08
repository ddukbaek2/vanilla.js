//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { LayoutVariable } from "./layoutvariable.js";
import { LayoutTerm } from "./layoutterm.js";
import { LayoutExpression } from "./layoutexpression.js";
import { LayoutConstraint } from "./layoutconstraint.js";
import { LayoutRelation } from "./layoutrelation.js";
import { LayoutStrength } from "./layoutstrength.js";
import { LayoutSymbol } from "./layoutsymbol.js";
import { LayoutSymbolType } from "./layoutsymboltype.js";
import { LayoutRow } from "./layoutrow.js";


//==============================================================================
// Kiwi dual simplex 기반 제약 솔버.
//
// 사용:
//   const solver = new LayoutSolver();
//   const x = new LayoutVariable("x");
//   const y = new LayoutVariable("y");
//   solver.addConstraint(LayoutExpression.fromVariable(x).equalTo(10));
//   solver.addConstraint(LayoutExpression.fromVariable(y).equalTo(
//       LayoutExpression.fromVariable(x).add(20)
//   ));
//   solver.updateVariables();
//   x.getValue(); // 10
//   y.getValue(); // 30
//
// 동적 입력 (드래그 등):
//   solver.addEditVariable(x, LayoutStrength.strong);
//   solver.suggestValue(x, 50);
//   solver.updateVariables();
//==============================================================================
export class LayoutSolver {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Map<LayoutConstraint, LayoutTag> } */ #constraintTags;
	/** @private @type { Map<LayoutSymbol, LayoutRow> } */ #rows;
	/** @private @type { Map<LayoutVariable, LayoutSymbol> } */ #variableSymbols;
	/** @private @type { Map<LayoutVariable, LayoutEditInfo> } */ #editInfos;
	/** @private @type { LayoutSymbol[] } */ #infeasibleRows;
	/** @private @type { LayoutRow } */ #objective;
	/** @private @type { LayoutRow | null } */ #artificial;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		this.#constraintTags = new System.Map();
		this.#rows = new System.Map();
		this.#variableSymbols = new System.Map();
		this.#editInfos = new System.Map();
		this.#infeasibleRows = [];
		this.#objective = new LayoutRow(0.0);
		this.#artificial = null;
	}

	//==============================================================================
	// 제약 추가.
	//==============================================================================
	/**
	 * @param { LayoutConstraint } constraint
	 */
	addConstraint(constraint) {
		if (this.#constraintTags.has(constraint)) {
			throw new System.Error("[LayoutSolver] 이미 추가된 제약.");
		}
		const tag = new LayoutTag();
		const row = this.createRow(constraint, tag);
		let subject = this.chooseSubject(row, tag);

		// subject 가 invalid 이고 모든 항이 dummy 면 별도 처리 필요.
		if (subject.isInvalid() && allDummies(row)) {
			if (!nearZero(row.getConstant())) {
				throw new System.Error("[LayoutSolver] 모순 제약: 만족 불가능.");
			}
			subject = tag.getMarker();
		}

		if (subject.isInvalid()) {
			// 인공 변수로 행 추가 시도.
			const success = this.addWithArtificialVariable(row);
			if (!success) {
				throw new System.Error("[LayoutSolver] 모순 제약: 만족 불가능.");
			}
		}
		else {
			row.solveFor(subject);
			this.substitute(subject, row);
			this.#rows.set(subject, row);
		}

		this.#constraintTags.set(constraint, tag);
		this.optimize(this.#objective);
	}

	//==============================================================================
	// 제약 제거.
	//==============================================================================
	/**
	 * @param { LayoutConstraint } constraint
	 */
	removeConstraint(constraint) {
		const tag = this.#constraintTags.get(constraint);
		if (tag === undefined) {
			throw new System.Error("[LayoutSolver] 등록되지 않은 제약.");
		}
		this.#constraintTags.delete(constraint);

		// 오차 변수의 영향을 목적함수에서 제거.
		this.removeConstraintEffects(constraint, tag);

		// marker 행 제거 또는 marker 가 basic 이 아니면 leaving row 찾아서 제거.
		const marker = tag.getMarker();
		if (this.#rows.has(marker)) {
			this.#rows.delete(marker);
		}
		else {
			const leavingSymbol = this.getMarkerLeavingSymbol(marker);
			if (leavingSymbol.isInvalid()) {
				throw new System.Error("[LayoutSolver] 제약 제거 실패 — leaving row 없음.");
			}
			const leavingRow = this.#rows.get(leavingSymbol);
			this.#rows.delete(leavingSymbol);
			leavingRow.solveForPair(leavingSymbol, marker);
			this.substitute(marker, leavingRow);
		}

		this.optimize(this.#objective);
	}

	//==============================================================================
	// 제약 등록 여부.
	//==============================================================================
	/**
	 * @param { LayoutConstraint } constraint
	 * @returns { boolean }
	 */
	hasConstraint(constraint) {
		return this.#constraintTags.has(constraint);
	}

	//==============================================================================
	// 편집(edit) 변수 추가. suggestValue 사용 전 반드시 등록.
	//==============================================================================
	/**
	 * @param { LayoutVariable } variable
	 * @param { number } strength
	 */
	addEditVariable(variable, strength) {
		if (this.#editInfos.has(variable)) {
			throw new System.Error("[LayoutSolver] 이미 편집 변수로 등록됨.");
		}
		const clipped = LayoutStrength.clipStrength(strength);
		if (clipped >= LayoutStrength.required) {
			throw new System.Error("[LayoutSolver] 편집 변수에는 required 강도를 쓸 수 없음.");
		}
		const expression = LayoutExpression.fromVariable(variable);
		const constraint = new LayoutConstraint(expression, LayoutRelation.equal, clipped);
		this.addConstraint(constraint);
		const tag = this.#constraintTags.get(constraint);
		const editInfo = new LayoutEditInfo(constraint, tag, 0.0);
		this.#editInfos.set(variable, editInfo);
	}

	//==============================================================================
	// 편집 변수 제거.
	//==============================================================================
	/**
	 * @param { LayoutVariable } variable
	 */
	removeEditVariable(variable) {
		const editInfo = this.#editInfos.get(variable);
		if (editInfo === undefined) {
			throw new System.Error("[LayoutSolver] 등록되지 않은 편집 변수.");
		}
		this.removeConstraint(editInfo.getConstraint());
		this.#editInfos.delete(variable);
	}

	//==============================================================================
	// 편집 변수 등록 여부.
	//==============================================================================
	/**
	 * @param { LayoutVariable } variable
	 * @returns { boolean }
	 */
	hasEditVariable(variable) {
		return this.#editInfos.has(variable);
	}

	//==============================================================================
	// 편집 변수에 권장 값 제안. (드래그 갱신 등)
	// - 솔버는 가능한 그 값을 만족시키되 다른 제약과 충돌하면 강도에 따라 양보.
	//==============================================================================
	/**
	 * @param { LayoutVariable } variable
	 * @param { number } value
	 */
	suggestValue(variable, value) {
		const editInfo = this.#editInfos.get(variable);
		if (editInfo === undefined) {
			throw new System.Error("[LayoutSolver] 등록되지 않은 편집 변수.");
		}
		const delta = value - editInfo.getConstant();
		editInfo.setConstant(value);

		const tag = editInfo.getTag();
		const markerSymbol = tag.getMarker();
		const otherSymbol = tag.getOther();

		// marker 또는 other 가 basic 이면 그 행의 상수만 갱신.
		if (this.#rows.has(markerSymbol)) {
			const row = this.#rows.get(markerSymbol);
			if (row.addConstant(-delta) < 0.0) {
				this.#infeasibleRows.push(markerSymbol);
			}
			this.dualOptimize();
			return;
		}
		if (this.#rows.has(otherSymbol)) {
			const row = this.#rows.get(otherSymbol);
			if (row.addConstant(delta) < 0.0) {
				this.#infeasibleRows.push(otherSymbol);
			}
			this.dualOptimize();
			return;
		}

		// 그 외 — marker 가 등장하는 모든 행의 상수를 보정.
		for (const [symbol, row] of this.#rows) {
			const coefficient = row.coefficientFor(markerSymbol);
			if (coefficient === 0.0) {
				continue;
			}
			if (row.addConstant(delta * coefficient) < 0.0 && symbol.getType() !== LayoutSymbolType.external) {
				this.#infeasibleRows.push(symbol);
			}
		}
		this.dualOptimize();
	}

	//==============================================================================
	// 변수 값 갱신. tableau 의 external 행 상수항을 각 LayoutVariable 에 반영.
	//==============================================================================
	updateVariables() {
		for (const [variable, symbol] of this.#variableSymbols) {
			if (this.#rows.has(symbol)) {
				const row = this.#rows.get(symbol);
				variable.setValue(row.getConstant());
			}
			else {
				variable.setValue(0.0);
			}
		}
	}

	//==============================================================================
	// 내부: LayoutVariable → LayoutSymbol 매핑 (없으면 생성).
	//==============================================================================
	/**
	 * @param { LayoutVariable } variable
	 * @returns { LayoutSymbol }
	 */
	getOrCreateSymbol(variable) {
		if (this.#variableSymbols.has(variable)) {
			return this.#variableSymbols.get(variable);
		}
		const symbol = new LayoutSymbol(LayoutSymbolType.external);
		this.#variableSymbols.set(variable, symbol);
		return symbol;
	}

	//==============================================================================
	// 내부: 제약 → 행 생성. tag 에 marker / other 심볼을 채운다.
	//==============================================================================
	/**
	 * @param { LayoutConstraint } constraint
	 * @param { LayoutTag } tag
	 * @returns { LayoutRow }
	 */
	createRow(constraint, tag) {
		const expression = constraint.getExpression();
		const row = new LayoutRow(expression.getConstant());

		// 외부 변수 항 추가. basic 인 항은 substitute.
		const terms = expression.getTerms();
		for (const term of terms) {
			const coefficient = term.getCoefficient();
			if (nearZero(coefficient)) {
				continue;
			}
			const variable = term.getVariable();
			const symbol = this.getOrCreateSymbol(variable);
			if (this.#rows.has(symbol)) {
				const basicRow = this.#rows.get(symbol);
				row.insertRow(basicRow, coefficient);
			}
			else {
				row.insertSymbol(symbol, coefficient);
			}
		}

		const relation = constraint.getRelation();
		const strength = constraint.getStrength();

		if (relation === LayoutRelation.lessThanOrEqual || relation === LayoutRelation.greaterThanOrEqual) {
			const sign = (relation === LayoutRelation.lessThanOrEqual) ? 1.0 : -1.0;
			const slackSymbol = new LayoutSymbol(LayoutSymbolType.slack);
			tag.setMarker(slackSymbol);
			row.insertSymbol(slackSymbol, sign);
			if (strength < LayoutStrength.required) {
				const errorSymbol = new LayoutSymbol(LayoutSymbolType.error);
				tag.setOther(errorSymbol);
				row.insertSymbol(errorSymbol, -sign);
				this.#objective.insertSymbol(errorSymbol, strength);
			}
		}
		else {
			// equal
			if (strength < LayoutStrength.required) {
				const errorPlus = new LayoutSymbol(LayoutSymbolType.error);
				const errorMinus = new LayoutSymbol(LayoutSymbolType.error);
				tag.setMarker(errorPlus);
				tag.setOther(errorMinus);
				row.insertSymbol(errorPlus, -1.0);
				row.insertSymbol(errorMinus, 1.0);
				this.#objective.insertSymbol(errorPlus, strength);
				this.#objective.insertSymbol(errorMinus, strength);
			}
			else {
				const dummySymbol = new LayoutSymbol(LayoutSymbolType.dummy);
				tag.setMarker(dummySymbol);
				row.insertSymbol(dummySymbol, 1.0);
			}
		}

		// 우변(상수항) 음수면 양변에 -1 곱해 양수로.
		if (row.getConstant() < 0.0) {
			row.reverseSign();
		}

		return row;
	}

	//==============================================================================
	// 내부: 행에서 subject 심볼 선택.
	// 1) 외부 변수 우선. 2) slack/error 의 음수 계수 항. 3) 둘 다 없으면 invalid.
	//==============================================================================
	/**
	 * @param { LayoutRow } row
	 * @param { LayoutTag } tag
	 * @returns { LayoutSymbol }
	 */
	chooseSubject(row, tag) {
		const cells = row.getCells();
		for (const [symbol, _coefficient] of cells) {
			if (symbol.getType() === LayoutSymbolType.external) {
				return symbol;
			}
		}
		const markerSymbol = tag.getMarker();
		if (markerSymbol !== null && (markerSymbol.getType() === LayoutSymbolType.slack || markerSymbol.getType() === LayoutSymbolType.error)) {
			if (row.coefficientFor(markerSymbol) < 0.0) {
				return markerSymbol;
			}
		}
		const otherSymbol = tag.getOther();
		if (otherSymbol !== null && (otherSymbol.getType() === LayoutSymbolType.slack || otherSymbol.getType() === LayoutSymbolType.error)) {
			if (row.coefficientFor(otherSymbol) < 0.0) {
				return otherSymbol;
			}
		}
		return LayoutSymbol.invalid();
	}

	//==============================================================================
	// 내부: 인공 변수로 행 강제 추가. 성공 여부 반환.
	//==============================================================================
	/**
	 * @param { LayoutRow } row
	 * @returns { boolean }
	 */
	addWithArtificialVariable(row) {
		const artificialSymbol = new LayoutSymbol(LayoutSymbolType.slack);
		this.#rows.set(artificialSymbol, row.copy());
		this.#artificial = row.copy();

		this.optimize(this.#artificial);
		const success = nearZero(this.#artificial.getConstant());
		this.#artificial = null;

		// artificial 행이 아직 basic 이면 제거.
		if (this.#rows.has(artificialSymbol)) {
			const basicRow = this.#rows.get(artificialSymbol);
			this.#rows.delete(artificialSymbol);
			if (basicRow.getCells().size === 0) {
				return success;
			}
			const entering = anyPivotableSymbol(basicRow);
			if (entering.isInvalid()) {
				return false;
			}
			basicRow.solveForPair(artificialSymbol, entering);
			this.substitute(entering, basicRow);
			this.#rows.set(entering, basicRow);
		}

		// 모든 행에서 artificial 심볼 제거.
		for (const [_symbol, currentRow] of this.#rows) {
			currentRow.removeSymbol(artificialSymbol);
		}
		this.#objective.removeSymbol(artificialSymbol);
		return success;
	}

	//==============================================================================
	// 내부: 모든 행과 objective 에서 symbol 의 등장을 row 로 치환.
	//==============================================================================
	/**
	 * @param { LayoutSymbol } symbol
	 * @param { LayoutRow } row
	 */
	substitute(symbol, row) {
		for (const [basicSymbol, basicRow] of this.#rows) {
			basicRow.substitute(symbol, row);
			if (basicSymbol.getType() !== LayoutSymbolType.external && basicRow.getConstant() < 0.0) {
				this.#infeasibleRows.push(basicSymbol);
			}
		}
		this.#objective.substitute(symbol, row);
		if (this.#artificial !== null) {
			this.#artificial.substitute(symbol, row);
		}
	}

	//==============================================================================
	// 내부: 1차 (primal) 최적화. objective 가 더 이상 음수 계수를 갖지 않을 때까지 반복.
	//==============================================================================
	/**
	 * @param { LayoutRow } objective
	 */
	optimize(objective) {
		const safeguard = 100000;
		for (let i = 0; i < safeguard; i += 1) {
			const enteringSymbol = getEnteringSymbol(objective);
			if (enteringSymbol.isInvalid()) {
				return;
			}
			const leavingSymbol = this.getLeavingSymbol(enteringSymbol);
			if (leavingSymbol.isInvalid()) {
				throw new System.Error("[LayoutSolver] 목적함수가 무한대 — bound 가 부족함.");
			}
			const leavingRow = this.#rows.get(leavingSymbol);
			this.#rows.delete(leavingSymbol);
			leavingRow.solveForPair(leavingSymbol, enteringSymbol);
			this.substitute(enteringSymbol, leavingRow);
			this.#rows.set(enteringSymbol, leavingRow);
		}
		throw new System.Error("[LayoutSolver] optimize 반복 한계 초과.");
	}

	//==============================================================================
	// 내부: dual simplex 최적화. infeasible 행을 처리.
	//==============================================================================
	dualOptimize() {
		const safeguard = 100000;
		for (let i = 0; i < safeguard; i += 1) {
			if (this.#infeasibleRows.length === 0) {
				return;
			}
			const leavingSymbol = this.#infeasibleRows.pop();
			if (!this.#rows.has(leavingSymbol)) {
				continue;
			}
			const row = this.#rows.get(leavingSymbol);
			if (row.getConstant() >= 0.0) {
				continue;
			}
			const enteringSymbol = this.getDualEnteringSymbol(row);
			if (enteringSymbol.isInvalid()) {
				throw new System.Error("[LayoutSolver] dual optimize 실패 — entering 없음.");
			}
			this.#rows.delete(leavingSymbol);
			row.solveForPair(leavingSymbol, enteringSymbol);
			this.substitute(enteringSymbol, row);
			this.#rows.set(enteringSymbol, row);
		}
		throw new System.Error("[LayoutSolver] dualOptimize 반복 한계 초과.");
	}

	//==============================================================================
	// 내부: leaving symbol 결정. (Bland's rule 변형 + 비율 테스트)
	//==============================================================================
	/**
	 * @param { LayoutSymbol } enteringSymbol
	 * @returns { LayoutSymbol }
	 */
	getLeavingSymbol(enteringSymbol) {
		let ratio = System.Number.POSITIVE_INFINITY;
		let result = LayoutSymbol.invalid();
		for (const [symbol, row] of this.#rows) {
			if (symbol.getType() === LayoutSymbolType.external) {
				continue;
			}
			const coefficient = row.coefficientFor(enteringSymbol);
			if (coefficient < 0.0) {
				const tentativeRatio = -row.getConstant() / coefficient;
				if (tentativeRatio < ratio) {
					ratio = tentativeRatio;
					result = symbol;
				}
			}
		}
		return result;
	}

	//==============================================================================
	// 내부: dual entering symbol 결정.
	//==============================================================================
	/**
	 * @param { LayoutRow } row
	 * @returns { LayoutSymbol }
	 */
	getDualEnteringSymbol(row) {
		let ratio = System.Number.POSITIVE_INFINITY;
		let result = LayoutSymbol.invalid();
		const cells = row.getCells();
		for (const [symbol, value] of cells) {
			if (value > 0.0 && symbol.getType() !== LayoutSymbolType.dummy) {
				const objectiveCoefficient = this.#objective.coefficientFor(symbol);
				const tentativeRatio = objectiveCoefficient / value;
				if (tentativeRatio < ratio) {
					ratio = tentativeRatio;
					result = symbol;
				}
			}
		}
		return result;
	}

	//==============================================================================
	// 내부: marker 가 leaving 으로 떠날 행 결정.
	//==============================================================================
	/**
	 * @param { LayoutSymbol } marker
	 * @returns { LayoutSymbol }
	 */
	getMarkerLeavingSymbol(marker) {
		let ratio1 = System.Number.POSITIVE_INFINITY;
		let ratio2 = System.Number.POSITIVE_INFINITY;
		let result1 = LayoutSymbol.invalid();
		let result2 = LayoutSymbol.invalid();
		let result3 = LayoutSymbol.invalid();

		for (const [symbol, row] of this.#rows) {
			const coefficient = row.coefficientFor(marker);
			if (coefficient === 0.0) {
				continue;
			}
			if (symbol.getType() === LayoutSymbolType.external) {
				result3 = symbol;
			}
			else if (coefficient < 0.0) {
				const tentativeRatio = -row.getConstant() / coefficient;
				if (tentativeRatio < ratio1) {
					ratio1 = tentativeRatio;
					result1 = symbol;
				}
			}
			else {
				const tentativeRatio = row.getConstant() / coefficient;
				if (tentativeRatio < ratio2) {
					ratio2 = tentativeRatio;
					result2 = symbol;
				}
			}
		}
		if (!result1.isInvalid()) {
			return result1;
		}
		if (!result2.isInvalid()) {
			return result2;
		}
		return result3;
	}

	//==============================================================================
	// 내부: 제약의 오차 변수가 목적함수에 끼친 영향을 제거.
	//==============================================================================
	/**
	 * @param { LayoutConstraint } constraint
	 * @param { LayoutTag } tag
	 */
	removeConstraintEffects(constraint, tag) {
		const markerSymbol = tag.getMarker();
		const otherSymbol = tag.getOther();
		if (markerSymbol !== null && markerSymbol.getType() === LayoutSymbolType.error) {
			this.removeMarkerEffect(markerSymbol, constraint.getStrength());
		}
		if (otherSymbol !== null && otherSymbol.getType() === LayoutSymbolType.error) {
			this.removeMarkerEffect(otherSymbol, constraint.getStrength());
		}
	}

	//==============================================================================
	// 내부: 단일 오차 변수 영향 제거.
	//==============================================================================
	/**
	 * @param { LayoutSymbol } markerSymbol
	 * @param { number } strength
	 */
	removeMarkerEffect(markerSymbol, strength) {
		if (this.#rows.has(markerSymbol)) {
			const row = this.#rows.get(markerSymbol);
			this.#objective.insertRow(row, -strength);
		}
		else {
			this.#objective.insertSymbol(markerSymbol, -strength);
		}
	}
}


//==============================================================================
// 내부: 제약 등록 시 부착되는 marker / other 심볼 쌍.
//==============================================================================
class LayoutTag {
	/** @private @type { LayoutSymbol | null } */ #marker;
	/** @private @type { LayoutSymbol | null } */ #other;
	constructor() {
		this.#marker = null;
		this.#other = null;
	}
	getMarker() {
		return this.#marker;
	}
	setMarker(marker) {
		this.#marker = marker;
	}
	getOther() {
		return this.#other;
	}
	setOther(other) {
		this.#other = other;
	}
}


//==============================================================================
// 내부: 편집 변수 정보.
//==============================================================================
class LayoutEditInfo {
	/** @private @type { LayoutConstraint } */ #constraint;
	/** @private @type { LayoutTag } */ #tag;
	/** @private @type { number } */ #constant;
	constructor(constraint, tag, constant) {
		this.#constraint = constraint;
		this.#tag = tag;
		this.#constant = constant;
	}
	getConstraint() {
		return this.#constraint;
	}
	getTag() {
		return this.#tag;
	}
	getConstant() {
		return this.#constant;
	}
	setConstant(constant) {
		this.#constant = constant;
	}
}


//==============================================================================
// 내부: objective 에서 음수 계수를 가진 첫 entering symbol 반환.
//==============================================================================
function getEnteringSymbol(objective) {
	const cells = objective.getCells();
	for (const [symbol, value] of cells) {
		if (symbol.getType() !== LayoutSymbolType.dummy && value < 0.0) {
			return symbol;
		}
	}
	return LayoutSymbol.invalid();
}


//==============================================================================
// 내부: 행이 dummy 심볼만 포함하는지 검사.
//==============================================================================
function allDummies(row) {
	const cells = row.getCells();
	for (const [symbol, _value] of cells) {
		if (symbol.getType() !== LayoutSymbolType.dummy) {
			return false;
		}
	}
	return true;
}


//==============================================================================
// 내부: 행에서 pivot 가능한 첫 심볼 반환. (slack/error 만 후보)
//==============================================================================
function anyPivotableSymbol(row) {
	const cells = row.getCells();
	for (const [symbol, _value] of cells) {
		const type = symbol.getType();
		if (type === LayoutSymbolType.slack || type === LayoutSymbolType.error) {
			return symbol;
		}
	}
	return LayoutSymbol.invalid();
}


//==============================================================================
// 부동소수 0 근접 판정. (Kiwi 의 EPS 와 동일)
//==============================================================================
const NEAR_ZERO_EPS = 1e-8;
function nearZero(value) {
	return value < 0.0 ? -value < NEAR_ZERO_EPS : value < NEAR_ZERO_EPS;
}
