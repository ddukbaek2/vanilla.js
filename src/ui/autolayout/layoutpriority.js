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
export class LayoutPriority {
	//==============================================================================
	// 표준 우선순위 상수.
	//==============================================================================
	static required = 1000;
	static defaultHigh = 750;
	static defaultLow = 250;
	static fittingSizeLevel = 50;
}
