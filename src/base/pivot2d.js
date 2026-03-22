//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VVector2 } from "./vector2.js";


//==============================================================================
// 피봇. (2D 좌표계를 기준으로 좌상(0,0) ~ 우하(1,1)을 기준으로 삼는다.)
//==============================================================================
export const VPivot2D = {
	topLeft: VVector2.create(0, 0),
	topCenter: VVector2.create(0.5, 0),
	topRight: VVector2.create(1, 0),
	middleLeft: VVector2.create(0, 0.5),
	middleCenter: VVector2.create(0.5, 0.5),
	middleRight: VVector2.create(1, 0.5),
	bottomLeft: VVector2.create(0, 1),
	bottomCenter: VVector2.create(0.5, 1),
	bottomRight: VVector2.create(1, 1),
}