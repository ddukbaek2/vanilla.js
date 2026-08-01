//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 레이아웃 제약 축. (UIKit 의 NSLayoutConstraint.Axis 와 같은 사상)
// - horizontal: 가로 축. width / left / right / centerX 와 관련된 제약을 의미.
// - vertical:   세로 축. height / top / bottom / centerY 와 관련된 제약을 의미.
//==============================================================================
export const LayoutConstraintAxis = System.Object.freeze({
	horizontal: "horizontal",
	vertical: "vertical",
});
