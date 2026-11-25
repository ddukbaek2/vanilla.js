//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import * as Math from "../../base/math.js";


//==============================================================================
// 레이아웃 제약 강도.
// - Cassowary / Kiwi 표준 강도 체계.
// - 강도는 제약 충돌 시 어느 쪽을 우선 만족시킬지 결정한다.
// - required 는 반드시 만족되어야 하며, 솔버가 못 풀면 예외를 던진다.
// - strong / medium / weak 는 가능한 한 만족시키되, 충돌 시 강도 순으로 양보한다.
// - createStrength(a, b, c, weight) 로 사용자 정의 강도 합성 가능.
//==============================================================================
/**
 * @example <caption>강한 제약이 약한 제약을 이기기</caption>
 * import { LayoutSolver, LayoutVariable, LayoutExpression, LayoutStrength } from "./build/vanilla.js";
 *
 * const solver = new LayoutSolver();
 * const width = new LayoutVariable("width");
 * const widthExpression = LayoutExpression.fromVariable(width);
 * const preferredConstraint = widthExpression.equalTo(200);
 * const strongConstraint = preferredConstraint.withStrength(LayoutStrength.strong);
 * const fallbackConstraint = widthExpression.equalTo(100);
 * const weakConstraint = fallbackConstraint.withStrength(LayoutStrength.weak);
 * solver.addConstraint(strongConstraint);
 * solver.addConstraint(weakConstraint);
 * solver.updateVariables();
 * const widthValue = width.getValue();
 * console.log(widthValue);
 */
export class LayoutStrength {
	//==============================================================================
	// 표준 강도 상수.
	//==============================================================================
	static required = 1001001000;
	static strong = 1000000; // 강한 강도. (1000000, createStrength(1, 0, 0) 과 같다)
	static medium = 1000; // 보통 강도. (1000, createStrength(0, 1, 0) 과 같다)
	static weak = 1; // 약한 강도. (1, createStrength(0, 0, 1) 과 같다)

	//==============================================================================
	// 사용자 정의 강도 합성.
	// - 세 자리 강도 성분 (a, b, c) 와 가중치 (weight) 로 합성한다.
	// - 각 성분은 weight 곱한 뒤 0 ~ 1000 범위로 클램프된다.
	// - 합성 결과는 0 ~ required (1001001000) 범위가 된다.
	//==============================================================================
	/**
	 * @param { number } a 강한 자리 성분. (weight 를 곱해 0 ~ 1000 으로 자른 뒤 1000000 배)
	 * @param { number } b 보통 자리 성분. (weight 를 곱해 0 ~ 1000 으로 자른 뒤 1000 배)
	 * @param { number } c 약한 자리 성분. (weight 를 곱해 0 ~ 1000 으로 자른다)
	 * @param { number } [weight] 세 성분에 곱할 가중치. (생략하거나 null 이면 1)
	 * @returns { number } 합친 강도. (0 ~ 1001001000)
	 * @example <caption>보통과 강함 사이의 강도 만들기</caption>
	 * import { LayoutStrength } from "./build/vanilla.js";
	 *
	 * const betweenMediumAndStrong = LayoutStrength.createStrength(0, 500, 0);
	 * const halfStrong = LayoutStrength.createStrength(1, 0, 0, 0.5);
	 * const medium = LayoutStrength.medium;
	 * const strong = LayoutStrength.strong;
	 * console.log(betweenMediumAndStrong, halfStrong, medium, strong);
	 */
	static createStrength(a, b, c, weight) {
		const finalWeight = weight ?? 1.0;
		const componentA = Math.clamp(a * finalWeight, 0, 1000) * 1000000;
		const componentB = Math.clamp(b * finalWeight, 0, 1000) * 1000;
		const componentC = Math.clamp(c * finalWeight, 0, 1000);
		const result = componentA + componentB + componentC;
		return result;
	}

	//==============================================================================
	// 강도 클램프. (0 ~ required)
	//==============================================================================
	/**
	 * @param { number } strength 자를 강도.
	 * @returns { number } 0 ~ required 로 자른 강도.
	 */
	static clipStrength(strength) {
		return Math.clamp(strength, 0, LayoutStrength.required);
	}

	//==============================================================================
	// UIKit 의 UILayoutPriority (1 ~ 1000) 를 LayoutStrength 으로 변환.
	// - priority >= 1000 (required) 은 LayoutStrength.required 로 매핑.
	// - 1 ~ 999 는 medium tier 의 weight 로 매핑 (priority 750 → 750000).
	// - 0 이하는 0 으로 매핑.
	//==============================================================================
	/**
	 * @param { number } priority UIKit 꼴 우선순위. (1 ~ 1000, LayoutPriority 값)
	 * @returns { number } 강도. (1000 이상은 required, 0 이하는 0, 그 사이는 priority * 1000)
	 * @example <caption>우선순위를 강도로 바꾸기</caption>
	 * import { LayoutStrength, LayoutPriority } from "./build/vanilla.js";
	 *
	 * const requiredStrength = LayoutStrength.fromPriority(LayoutPriority.required);
	 * const highStrength = LayoutStrength.fromPriority(LayoutPriority.defaultHigh);
	 * const zeroStrength = LayoutStrength.fromPriority(0);
	 * console.log(requiredStrength === LayoutStrength.required, highStrength, zeroStrength);
	 */
	static fromPriority(priority) {
		if (priority >= 1000) {
			return LayoutStrength.required;
		}
		if (priority <= 0) {
			return 0;
		}
		return LayoutStrength.createStrength(0, priority, 0);
	}
}
