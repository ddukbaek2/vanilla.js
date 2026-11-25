//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Vector2 } from "./vector2.js";

/**
 * @example <caption>노드의 기준점을 아래 가운데로 두기</caption>
 * import { WorldNode, Pivot, Vector2 } from "./build/vanilla.js";
 *
 * const iconNode = new WorldNode();
 * const iconSize = Vector2.create(64, 64);
 * iconNode.setContentSize(iconSize);
 * iconNode.setPivot(Pivot.bottomCenter);
 * const pivot = iconNode.getPivot();
 * console.log(pivot.x, pivot.y);
 */


//==============================================================================
// 피봇. (2D 좌표계를 기준으로 좌상(0,0) ~ 우하(1,1)을 기준으로 삼는다.)
//==============================================================================
export const Pivot = {
	topLeft: Vector2.create(0, 0), // 좌상단. (0, 0)
	topCenter: Vector2.create(0.5, 0), // 위 가운데. (0.5, 0)
	topRight: Vector2.create(1, 0), // 우상단. (1, 0)
	middleLeft: Vector2.create(0, 0.5), // 왼쪽 가운데. (0, 0.5)
	middleCenter: Vector2.create(0.5, 0.5), // 정가운데. (0.5, 0.5)
	middleRight: Vector2.create(1, 0.5), // 오른쪽 가운데. (1, 0.5)
	bottomLeft: Vector2.create(0, 1), // 좌하단. (0, 1)
	bottomCenter: Vector2.create(0.5, 1), // 아래 가운데. (0.5, 1)
	bottomRight: Vector2.create(1, 1), // 우하단. (1, 1)
}