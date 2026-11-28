//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 제약 관계 연산자.
// - LayoutConstraint 가 표현 == 0, <= 0, >= 0 중 어느 쪽인지 식별.
//==============================================================================
export const LayoutRelation = {
	equal: "==", // 같음. (식 == 0)
	lessThanOrEqual: "<=", // 작거나 같음. (식 <= 0)
	greaterThanOrEqual: ">=", // 크거나 같음. (식 >= 0)
};

/**
 * @example <caption>제약의 관계 읽기</caption>
 * import { LayoutVariable, LayoutExpression, LayoutRelation } from "./build/vanilla.js";
 *
 * const width = new LayoutVariable("width");
 * const widthExpression = LayoutExpression.fromVariable(width);
 * const constraint = widthExpression.greaterThanOrEqualTo(100);
 * const relation = constraint.getRelation();
 * console.log(relation, relation === LayoutRelation.greaterThanOrEqual);
 */
