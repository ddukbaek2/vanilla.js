//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Vector2 } from "./vector2.js";


//==============================================================================
// 피봇. (2D 좌표계를 기준으로 좌상(0,0) ~ 우하(1,1)을 기준으로 삼는다.)
//==============================================================================
export const Pivot = {
	topLeft: Vector2.create(0, 0),
	topCenter: Vector2.create(0.5, 0),
	topRight: Vector2.create(1, 0),
	middleLeft: Vector2.create(0, 0.5),
	middleCenter: Vector2.create(0.5, 0.5),
	middleRight: Vector2.create(1, 0.5),
	bottomLeft: Vector2.create(0, 1),
	bottomCenter: Vector2.create(0.5, 1),
	bottomRight: Vector2.create(1, 1),
}