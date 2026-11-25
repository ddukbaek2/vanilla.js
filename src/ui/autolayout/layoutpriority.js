//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 레이아웃 우선순위. (UIKit 의 UILayoutPriority 와 같은 사상)
// - required (1000): 반드시 만족해야 하는 우선순위. LayoutStrength.required 로 매핑.
// - defaultHigh (750): 기본 압축 저항 (compression resistance) 우선순위.
// - defaultLow (250): 기본 hug 우선순위.
// - fittingSizeLevel (50): systemLayoutSizeFitting 호출 시 권장 크기 우선순위.
// - 1 ~ 999 의 값은 LayoutStrength.fromPriority 를 통해 medium tier 로 매핑된다.
//==============================================================================
/**
 * @example <caption>우선순위를 UINode 에 주고 강도로 바꾸기</caption>
 * import { UINode, LayoutPriority, LayoutStrength, LayoutConstraintAxis } from "./build/vanilla.js";
 *
 * const label = new UINode();
 * label.setContentCompressionResistancePriority(LayoutPriority.required, LayoutConstraintAxis.horizontal);
 * label.setContentHuggingPriority(LayoutPriority.defaultLow - 1, LayoutConstraintAxis.horizontal);
 * const strength = LayoutStrength.fromPriority(LayoutPriority.defaultHigh);
 * console.log(strength);
 */
export class LayoutPriority {
	//==============================================================================
	// 표준 우선순위 상수.
	//==============================================================================
	static required = 1000;
	static defaultHigh = 750; // 기본 압축 저항 우선순위. (750, UINode 의 압축 저항 기본값)
	static defaultLow = 250; // 기본 hugging 우선순위. (250, UINode 의 hugging 기본값)
	static fittingSizeLevel = 50; // 맞춤 크기 우선순위. (50, UIKit 과 같은 값이고 엔진 안에서 쓰는 곳은 없다)
}
