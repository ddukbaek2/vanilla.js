//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Renderer } from "./renderer.js";
import * as Math from "../base/math.js";
import { Component } from "./component.js";
import { Node } from "../core/node.js";


//==============================================================================
// 계층 및 영역 객체.
//==============================================================================
export class VNode2D extends Node {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Vector2 } */ #anchoredPosition;
	/** @private @type { Vector2 } */ #sizeDelta;
	/** @private @type { Vector2 } */ #anchorMin;
	/** @private @type { Vector2 } */ #anchorMax;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.#anchoredPosition = Vector2.zero();
		this.#sizeDelta = Vector2.zero();
		this.#anchorMin = Vector2.zero();
		this.#anchorMax = Vector2.zero();
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta 
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
	}

	// //==============================================================================
	// // 기즈모 출력.
	// //==============================================================================
	// /**
	//  * @virtual
	//  * @param { Renderer } renderer 
	//  */
	// drawGizmos(renderer) {
	// 	if (!this.isVisibleGizmos()) {
	// 		return;
	// 	}
		
	// 	const engine = renderer.getEngine();
	// 	const canvasContext = renderer.getCanvasContext();

	// 	const degree = this.getRotation();
	// 	const radian = Math.degreeToRadian(degree);

	// 	// 이미지 회전이 반영된 기준점 출력.
	// 	canvasContext.fillStyle = "#00ff00";
	// 	const worldCorners = this.getWorldCorners();
	// 	const pivots = [VPiVPivotvot2D.topLeft, Pivot.topRight, Pivot.bottomRight, Pivot.bottomLeft];
	// 	for (let i = 0; i < worldCorners.length; ++i) {
	// 		const worldCorner = worldCorners[i];
	// 		canvasContext.save();
	// 		engine.gameViewIdentity(null);
	// 		canvasContext.translate(worldCorner.x, worldCorner.y);
	// 		canvasContext.rotate(radian);
	// 		const contentSize = Vector2.create(4, 4);//.divide(this.getScale());
	// 		const pivotPosition = Vector2.zero().subtract(contentSize.multiply(pivots[i]));
	// 		canvasContext.fillRect(pivotPosition.x, pivotPosition.y, contentSize.x, contentSize.y);
	// 		canvasContext.restore();
	// 	}

	// 	// 월드 코너 출력.
	// 	canvasContext.save();
	// 	engine.gameViewIdentity(null);
	// 	canvasContext.strokeStyle = "#00ff00";
	// 	canvasContext.lineWidth = 2;
	// 	canvasContext.beginPath();
	// 	canvasContext.moveTo(worldCorners[0].x, worldCorners[0].y);
	// 	for (let i = 1; i < worldCorners.length; ++i) {
	// 		canvasContext.lineTo(worldCorners[i].x, worldCorners[i].y);
	// 	}
	// 	canvasContext.closePath();
	// 	canvasContext.stroke();
	// 	canvasContext.restore();
	// }
}