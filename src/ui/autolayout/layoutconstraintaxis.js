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
	horizontal: "horizontal", // 가로 축.
	vertical: "vertical", // 세로 축.
});

/**
 * @example <caption>가로 축만 hugging 우선순위 올리기</caption>
 * import { UINode, LayoutConstraintAxis, LayoutPriority } from "./build/vanilla.js";
 *
 * const node = new UINode();
 * node.setContentHuggingPriority(LayoutPriority.required, LayoutConstraintAxis.horizontal);
 * const horizontalPriority = node.getContentHuggingPriority(LayoutConstraintAxis.horizontal);
 * const verticalPriority = node.getContentHuggingPriority(LayoutConstraintAxis.vertical);
 * console.log(horizontalPriority, verticalPriority);
 */
