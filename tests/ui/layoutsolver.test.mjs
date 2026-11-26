//==============================================================================
// 레이아웃 풀이(카수어리) 시험. (node tests/ui/layoutsolver.test.mjs)
// - 러스트 판 짝: src/ui/autolayout/layoutsolver.rs 의 simple_equality, zero_value_terms_add_nothing, inequality_with_strengths,
//   edit_variable_suggest_value, remove_constraint_restores_previous_solution, duplicate_constraint_error,
//   unsatisfiable_required_constraint_error, unknown_and_edit_variable_errors, uikit_like_layout,
//   compression_and_hugging_choose_lower_priority, rebuild_guide_constraints.
// - 허용 오차 1e-6 과 오류 글은 러스트 판 시험과 같다. (러스트 판 cloned_solver_shares_state 는 러스트 핸들 복제라 짝이 없다)
//==============================================================================
import { LayoutSolver } from "../../src/ui/autolayout/layoutsolver.js";
import { LayoutExpression } from "../../src/ui/autolayout/layoutexpression.js";
import { LayoutVariable } from "../../src/ui/autolayout/layoutvariable.js";
import { LayoutTerm } from "../../src/ui/autolayout/layoutterm.js";
import { LayoutStrength } from "../../src/ui/autolayout/layoutstrength.js";
import { LayoutPriority } from "../../src/ui/autolayout/layoutpriority.js";
import { check, checkEqual, checkNear, finish } from "../testcheck.mjs";

const TOLERANCE = 1e-6;

function expression(variable) {
	return LayoutExpression.fromVariable(variable);
}

function getErrorMessage(action) {
	try {
		action();
	}
	catch (error) {
		return error.message;
	}
	return "";
}

// 가로 축만 본 UINode 꼴. (원본 buildIntrinsicConstraints 의 가로 둘을 등록한다)
function createHorizontalNode(solver) {
	const node = { left: new LayoutVariable("left"), right: new LayoutVariable("right"), width: new LayoutVariable("width"), centerX: new LayoutVariable("centerX") };
	solver.addConstraint(expression(node.right).equalTo(expression(node.left).add(node.width)));
	solver.addConstraint(expression(node.centerX).equalTo(expression(node.left).add(expression(node.width).divide(2))));
	return node;
}

// 원본 buildIntrinsicSizeConstraints 의 가로 둘. (hug, 압축 저항)
function addIntrinsicWidth(solver, node, intrinsicWidth, huggingPriority, compressionPriority) {
	solver.addConstraint(expression(node.width).lessThanOrEqualTo(intrinsicWidth).withStrength(LayoutStrength.fromPriority(huggingPriority)));
	solver.addConstraint(expression(node.width).greaterThanOrEqualTo(intrinsicWidth).withStrength(LayoutStrength.fromPriority(compressionPriority)));
}

// x == 10, y == x + 20.
{
	const solver = new LayoutSolver();
	const x = new LayoutVariable("x");
	const y = new LayoutVariable("y");
	solver.addConstraint(expression(x).equalTo(10));
	solver.addConstraint(expression(y).equalTo(expression(x).add(20)));
	solver.updateVariables();
	checkNear(x.getValue(), 10, TOLERANCE, "x == 10");
	checkNear(y.getValue(), 30, TOLERANCE, "y == x + 20");
}

// 계수 0 인 항은 아무것도 더하지 않는다. 그런 항만 남은 등식은 상수끼리의 비교다.
{
	const solver = new LayoutSolver();
	const x = new LayoutVariable("x");
	const unused = new LayoutVariable("unused");
	unused.setValue(7);
	const zeroTerm = new LayoutTerm(unused, 0);
	solver.addConstraint(new LayoutExpression([zeroTerm, new LayoutTerm(x, 1)], 0).equalTo(10));
	solver.updateVariables();
	checkNear(x.getValue(), 10, TOLERANCE, "계수 0 항 뒤 x");
	checkNear(unused.getValue(), 7, TOLERANCE, "계수 0 항 변수는 그대로");
	checkEqual(getErrorMessage(() => solver.addConstraint(new LayoutExpression([zeroTerm], 5).equalTo(0))), "[LayoutSolver] 모순 제약: 만족 불가능.", "계수 0 항만 남은 5 == 0");
	checkEqual(getErrorMessage(() => solver.addConstraint(new LayoutExpression([zeroTerm], 0).equalTo(0))), "", "계수 0 항만 남은 0 == 0");
}

// 부딪히는 제약은 강도가 센 쪽이 이기고, required 부등식은 늘 지킨다.
{
	const solver = new LayoutSolver();
	const x = new LayoutVariable("x");
	solver.addConstraint(expression(x).equalTo(40).withStrength(LayoutStrength.weak));
	solver.addConstraint(expression(x).equalTo(60).withStrength(LayoutStrength.strong));
	solver.updateVariables();
	checkNear(x.getValue(), 60, TOLERANCE, "strong 이 weak 를 이김");
	solver.addConstraint(expression(x).lessThanOrEqualTo(30));
	solver.updateVariables();
	checkNear(x.getValue(), 30, TOLERANCE, "required 부등식");
	const y = new LayoutVariable("y");
	solver.addConstraint(expression(y).greaterThanOrEqualTo(expression(x).multiply(2)));
	solver.addConstraint(expression(y).equalTo(0).withStrength(LayoutStrength.medium));
	solver.updateVariables();
	checkNear(y.getValue(), 60, TOLERANCE, "y >= 2x");
}

// 편집 변수.
{
	const solver = new LayoutSolver();
	const x = new LayoutVariable("x");
	const y = new LayoutVariable("y");
	solver.addConstraint(expression(y).equalTo(expression(x).multiply(2)));
	solver.addConstraint(expression(x).lessThanOrEqualTo(100));
	solver.addConstraint(expression(x).equalTo(5).withStrength(LayoutStrength.weak));
	solver.addEditVariable(x, LayoutStrength.strong);
	checkEqual(solver.hasEditVariable(x), true, "hasEditVariable");
	for (const [suggestedValue, expectedX, expectedY] of [[50, 50, 100], [10, 10, 20], [150, 100, 200]]) {
		solver.suggestValue(x, suggestedValue);
		solver.updateVariables();
		checkNear([x.getValue(), y.getValue()], [expectedX, expectedY], TOLERANCE, "suggestValue " + suggestedValue);
	}
	solver.removeEditVariable(x);
	checkEqual(solver.hasEditVariable(x), false, "removeEditVariable");
	solver.updateVariables();
	checkNear(x.getValue(), 5, TOLERANCE, "편집 변수를 지우면 weak 로");
}

// 이긴 제약을 지우면 앞의 해로 돌아간다.
{
	const solver = new LayoutSolver();
	const x = new LayoutVariable("x");
	const y = new LayoutVariable("y");
	solver.addConstraint(expression(x).equalTo(10).withStrength(LayoutStrength.weak));
	solver.addConstraint(expression(y).equalTo(expression(x).add(5)));
	const strongConstraint = expression(x).equalTo(50).withStrength(LayoutStrength.strong);
	solver.addConstraint(strongConstraint);
	solver.updateVariables();
	checkNear([x.getValue(), y.getValue()], [50, 55], TOLERANCE, "strong 이김");
	solver.removeConstraint(strongConstraint);
	checkEqual(solver.hasConstraint(strongConstraint), false, "removeConstraint");
	solver.updateVariables();
	checkNear([x.getValue(), y.getValue()], [10, 15], TOLERANCE, "지운 뒤 앞의 해");
	const requiredConstraint = expression(x).greaterThanOrEqualTo(30);
	solver.addConstraint(requiredConstraint);
	solver.updateVariables();
	checkNear(x.getValue(), 30, TOLERANCE, "required 부등식");
	solver.removeConstraint(requiredConstraint);
	solver.updateVariables();
	checkNear(x.getValue(), 10, TOLERANCE, "required 지운 뒤");
}

// 같은 제약을 또 넣으면 오류다. 식이 같아도 따로 만든 제약은 다른 제약이다.
{
	const solver = new LayoutSolver();
	const x = new LayoutVariable("x");
	const constraint = expression(x).equalTo(10);
	solver.addConstraint(constraint);
	checkEqual(solver.hasConstraint(constraint), true, "hasConstraint");
	checkEqual(getErrorMessage(() => solver.addConstraint(constraint)), "[LayoutSolver] 이미 추가된 제약.", "같은 제약 오류");
	const sameShape = expression(x).equalTo(10);
	checkEqual(solver.hasConstraint(sameShape), false, "모양만 같은 제약은 다른 제약");
	solver.addConstraint(sameShape);
	solver.updateVariables();
	checkNear(x.getValue(), 10, TOLERANCE, "모양만 같은 제약 뒤 x");
}

// 만족할 수 없는 required 제약은 오류다.
{
	const solver = new LayoutSolver();
	const x = new LayoutVariable("x");
	solver.addConstraint(expression(x).equalTo(10));
	const conflict = expression(x).equalTo(20);
	checkEqual(getErrorMessage(() => solver.addConstraint(conflict)), "[LayoutSolver] 모순 제약: 만족 불가능.", "모순 등식");
	checkEqual(solver.hasConstraint(conflict), false, "모순 등식은 들지 않음");
	const y = new LayoutVariable("y");
	solver.addConstraint(expression(y).greaterThanOrEqualTo(10));
	checkEqual(getErrorMessage(() => solver.addConstraint(expression(y).lessThanOrEqualTo(5))), "[LayoutSolver] 모순 제약: 만족 불가능.", "모순 부등식");
	solver.updateVariables();
	checkNear(x.getValue(), 10, TOLERANCE, "모순 뒤 x");
}

// 모르는 제약, 모르는 편집 변수, 겹친 편집 변수, required 편집 강도는 오류다.
{
	const solver = new LayoutSolver();
	const x = new LayoutVariable("x");
	checkEqual(getErrorMessage(() => solver.removeConstraint(expression(x).equalTo(1))), "[LayoutSolver] 등록되지 않은 제약.", "모르는 제약");
	checkEqual(getErrorMessage(() => solver.suggestValue(x, 1)), "[LayoutSolver] 등록되지 않은 편집 변수.", "모르는 편집 변수 suggestValue");
	checkEqual(getErrorMessage(() => solver.removeEditVariable(x)), "[LayoutSolver] 등록되지 않은 편집 변수.", "모르는 편집 변수 removeEditVariable");
	checkEqual(getErrorMessage(() => solver.addEditVariable(x, LayoutStrength.required)), "[LayoutSolver] 편집 변수에는 required 강도를 쓸 수 없음.", "required 편집 강도");
	checkEqual(getErrorMessage(() => solver.addEditVariable(x, 2e9)), "[LayoutSolver] 편집 변수에는 required 강도를 쓸 수 없음.", "required 를 넘는 편집 강도");
	solver.addEditVariable(x, LayoutStrength.medium);
	checkEqual(getErrorMessage(() => solver.addEditVariable(x, LayoutStrength.weak)), "[LayoutSolver] 이미 편집 변수로 등록됨.", "겹친 편집 변수");
}

// UIKit 꼴 배치.
{
	const solver = new LayoutSolver();
	const screen = createHorizontalNode(solver);
	solver.addConstraint(expression(screen.left).equalTo(0));
	solver.addEditVariable(screen.width, LayoutStrength.strong);
	solver.suggestValue(screen.width, 400);
	const child = createHorizontalNode(solver);
	solver.addConstraint(expression(child.left).equalTo(expression(screen.left).add(10)));
	solver.addConstraint(expression(child.width).equalTo(expression(screen.width).subtract(20)));
	solver.addConstraint(expression(child.centerX).equalTo(screen.centerX));
	const label = createHorizontalNode(solver);
	solver.addConstraint(expression(label.centerX).equalTo(screen.centerX));
	addIntrinsicWidth(solver, label, 120, LayoutPriority.defaultLow, LayoutPriority.defaultHigh);
	const narrowConstraint = expression(label.width).equalTo(80).withStrength(LayoutStrength.fromPriority(500));
	solver.addConstraint(narrowConstraint);
	solver.updateVariables();
	checkNear([screen.right.getValue(), child.left.getValue(), child.width.getValue(), child.right.getValue(), child.centerX.getValue()], [400, 10, 380, 390, 200], TOLERANCE, "화면과 자식");
	checkNear([label.width.getValue(), label.left.getValue()], [120, 140], TOLERANCE, "압축 저항이 좁히기를 이김");
	solver.removeConstraint(narrowConstraint);
	solver.addConstraint(expression(label.width).equalTo(200).withStrength(LayoutStrength.fromPriority(500)));
	solver.updateVariables();
	checkNear([label.width.getValue(), label.left.getValue()], [200, 100], TOLERANCE, "넓히기가 hug 를 이김");
	solver.suggestValue(screen.width, 600);
	solver.updateVariables();
	checkNear([child.width.getValue(), child.right.getValue(), label.left.getValue(), label.right.getValue()], [580, 590, 200, 400], TOLERANCE, "화면 크기 바꾸기");
}

// 나란한 두 라벨: 자리보다 크면 압축 저항이 낮은 쪽이 줄고, 자리가 남으면 hug 가 낮은 쪽이 는다.
{
	const solver = new LayoutSolver();
	const first = createHorizontalNode(solver);
	const second = createHorizontalNode(solver);
	solver.addConstraint(expression(first.left).equalTo(0));
	solver.addConstraint(expression(second.left).equalTo(first.right));
	solver.addConstraint(expression(second.right).equalTo(200));
	addIntrinsicWidth(solver, first, 120, LayoutPriority.defaultLow, LayoutPriority.defaultHigh);
	addIntrinsicWidth(solver, second, 120, LayoutPriority.defaultLow, LayoutPriority.defaultHigh + 10);
	solver.updateVariables();
	checkNear([first.width.getValue(), second.width.getValue(), second.left.getValue()], [80, 120, 80], TOLERANCE, "압축 저항 낮은 쪽이 줄어듦");
	const roomySolver = new LayoutSolver();
	const roomyFirst = createHorizontalNode(roomySolver);
	const roomySecond = createHorizontalNode(roomySolver);
	roomySolver.addConstraint(expression(roomyFirst.left).equalTo(0));
	roomySolver.addConstraint(expression(roomySecond.left).equalTo(roomyFirst.right));
	roomySolver.addConstraint(expression(roomySecond.right).equalTo(200));
	addIntrinsicWidth(roomySolver, roomyFirst, 50, LayoutPriority.defaultLow, LayoutPriority.defaultHigh);
	addIntrinsicWidth(roomySolver, roomySecond, 50, LayoutPriority.defaultLow + 1, LayoutPriority.defaultHigh);
	roomySolver.updateVariables();
	checkNear([roomyFirst.width.getValue(), roomySecond.width.getValue()], [150, 50], TOLERANCE, "hug 낮은 쪽이 늘어남");
}

// safeAreaLayoutGuide 다시 짓기: 제약을 지우고 새 여백으로 다시 넣는다.
{
	const solver = new LayoutSolver();
	const screen = createHorizontalNode(solver);
	solver.addConstraint(expression(screen.left).equalTo(0));
	solver.addEditVariable(screen.width, LayoutStrength.strong);
	solver.suggestValue(screen.width, 300);
	const guide = createHorizontalNode(solver);
	let guideConstraintList = [];
	for (const [leftInset, rightInset] of [[0, 0], [20, 30], [5, 0]]) {
		for (const constraint of guideConstraintList) {
			if (solver.hasConstraint(constraint)) {
				solver.removeConstraint(constraint);
			}
		}
		guideConstraintList = [
			expression(guide.left).equalTo(expression(screen.left).add(leftInset)),
			expression(guide.right).equalTo(expression(screen.right).subtract(rightInset)),
		];
		for (const constraint of guideConstraintList) {
			solver.addConstraint(constraint);
		}
		solver.updateVariables();
		checkNear([guide.left.getValue(), guide.width.getValue()], [leftInset, 300 - leftInset - rightInset], TOLERANCE, "가이드 여백 " + leftInset + ", " + rightInset);
	}
	check(guideConstraintList.length === 2, "가이드 제약 둘");
}

finish("tests/ui/layoutsolver.test.mjs");
