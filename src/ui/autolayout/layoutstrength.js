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
export class LayoutStrength {
	//==============================================================================
	// 표준 강도 상수.
	//==============================================================================
	static required = 1001001000;
	static strong = 1000000;
	static medium = 1000;
	static weak = 1;

	//==============================================================================
	// 사용자 정의 강도 합성.
	// - 세 자리 강도 성분 (a, b, c) 와 가중치 (weight) 로 합성한다.
	// - 각 성분은 weight 곱한 뒤 0 ~ 1000 범위로 클램프된다.
	// - 합성 결과는 0 ~ required (1001001000) 범위가 된다.
	//==============================================================================
	/**
	 * @param { number } a
	 * @param { number } b
	 * @param { number } c
	 * @param { number } [weight]
	 * @returns { number }
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
	 * @param { number } strength
	 * @returns { number }
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
	 * @param { number } priority
	 * @returns { number }
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
