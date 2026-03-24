// //==============================================================================
// // 포함 모듈 목록.
// //==============================================================================
// import { Object } from "../base/object.js";
// import { Vector2 } from "../base/vector2.js";
// import { Renderer } from "../core/renderer.js";
// import * as Math from "../base/math.js";
// import { Rect } from "../base/rect.js";
// import { OBB } from "../base/obb.js";
// import { Pivot } from "../base/pivot2d.js";


// //==============================================================================
// // 이미지 출력 객체.
// //==============================================================================
// /**
//  * @class
//  */
// export class VSimpleSprite extends Object {
// 	//==============================================================================
// 	// 멤버 변수 목록.
// 	//==============================================================================
// 	/** @private @type { Vector2 } */ #position; // 위치.
// 	/** @private @type { Vector2 } */ #pivot; // 출력 기준점.
// 	/** @private @type { Vector2 } */ #contentSize; // 실제 크기.
// 	/** @private @type { Vector2 } */ #scale; // 크기 배율.
// 	/** @private @type { number } */ #degree; // 회전값.
// 	/** @private @type { string } */ #color; // 컬러.
// 	/** @private @type { number } */ #opacity; // 투명도.

// 	//==============================================================================
// 	// 생성.
// 	//==============================================================================
// 	/**
// 	 * @constructor
// 	 */
// 	constructor() {
// 		super();
// 		this.#position = Vector2.zero();
// 		this.#pivot = Pivot.middleCenter;
// 		this.#contentSize = Vector2.zero();
// 		this.#scale = Vector2.one();
// 		this.#degree = 0.0;
// 		this.#color = "#ffffff"; // rgba(255, 255, 255, 1.0);
// 		this.#opacity = 1.0;
// 	}

// 	//==============================================================================
// 	// 출력.
// 	//==============================================================================
// 	/**
// 	 * @param { Renderer } renderer 
// 	 */
// 	draw(renderer) {
// 		// 출력 상태 시작.
// 		const canvasContext = renderer.getCanvasContext();
// 		canvasContext.save();
// 		canvasContext.globalAlpha = this.#opacity;
// 		canvasContext.fillStyle = this.#color;
// 		const position = this.getPosition();
// 		const degree = this.getDegree();
// 		let radian = Math.degreeToRadian(degree);
// 		const transformScale = this.calculateTransformScale();
// 		canvasContext.translate(position.x, position.y); // 위치.
// 		canvasContext.rotate(radian); // 회전.
// 		canvasContext.scale(transformScale.x, transformScale.y); // 크기.

// 		// 출력.
// 		const contentSize = this.getContentSize();
// 		const pivotPosition = this.calculatePivotPosition();
// 		canvasContext.fillRect(pivotPosition.x, pivotPosition.y, contentSize.x , contentSize.y);

// 		// 출력 상태 종료.
// 		canvasContext.globalAlpha = 1.0;
// 		canvasContext.restore();
// 	}

// 	// //==============================================================================
// 	// // 기즈모 출력.
// 	// //==============================================================================
// 	// /**
// 	//  * @param { Renderer } renderer 
// 	//  */
// 	// drawGizmos(renderer) {
// 	// 	const engine = renderer.getEngine();
// 	// 	const canvasContext = renderer.getCanvasContext();
// 	// 	const degree = this.getRotation();
// 	// 	const radian = Math.degreeToRadian(degree);

// 	// 	// 이미지 회전이 반영된 기준점 출력.
// 	// 	canvasContext.fillStyle = "#00ff00";
// 	// 	const worldCorners = this.getWorldCorners();
// 	// 	const pivots = [Pivot.topLeft, Pivot.topRight, Pivot.bottomRight, Pivot.bottomLeft];
// 	// 	for (let i = 0; i < worldCorners.length; ++i) {
// 	// 		const worldCorner = worldCorners[i];
// 	// 		canvasContext.save();
// 	// 		engine.gameViewIdentity(null);
// 	// 		canvasContext.translate(worldCorner.x, worldCorner.y);
// 	// 		canvasContext.rotate(radian);
// 	// 		const contentSize = Vector2.create(4, 4);//.divide(this.getScale());
// 	// 		const pivotPosition = Vector2.zero().subtract(contentSize.multiply(pivots[i]));
// 	// 		canvasContext.fillRect(pivotPosition.x, pivotPosition.y, contentSize.x, contentSize.y);
// 	// 		canvasContext.restore();
// 	// 	}

// 	// 	// 월드 코너 출력.
// 	// 	canvasContext.save();
// 	// 	engine.gameViewIdentity(null);
// 	// 	canvasContext.strokeStyle = "#00ff00";
// 	// 	canvasContext.lineWidth = 2;
// 	// 	canvasContext.beginPath();
// 	// 	canvasContext.moveTo(worldCorners[0].x, worldCorners[0].y);
// 	// 	for (let i = 1; i < worldCorners.length; ++i) {
// 	// 		canvasContext.lineTo(worldCorners[i].x, worldCorners[i].y);
// 	// 	}
// 	// 	canvasContext.closePath();
// 	// 	canvasContext.stroke();
// 	// 	canvasContext.restore();
// 	// }

// 	//==============================================================================
// 	// 최종 크기 계산. (플립 기능으로 인해 뒤집어진 크기 계산)
// 	//==============================================================================
// 	/**
// 	 * @returns { Vector2 }
// 	 */
// 	calculateTransformScale() {
// 		const scale = this.getScale();
// 		return scale;
// 	}

// 	//==============================================================================
// 	// 최종 위치 계산. (피봇 기능으로 인해 스케일 반전되며 틀어진 출력 중심점 위치를 포함하여 중심점 위치 계산)
// 	//==============================================================================
// 	/**
// 	 * @returns { Vector2 }
// 	 */
// 	calculatePivotPosition() {
// 		const contentSize = this.getContentSize();
// 		const pivot = this.getPivot();
// 		const pivotPosition = Vector2.zero().subtract(contentSize.multiply(pivot)); // (0,0) - (size * (0~1,0~1))
// 		return pivotPosition;
// 	}

// 	//==============================================================================
// 	// 위치 설정.
// 	//==============================================================================
// 	/**
// 	 * @param { Vector2 } position 
// 	 */
// 	setPosition(position) {
// 		this.#position = position;
// 	}

// 	//==============================================================================
// 	// 위치 반환.
// 	//==============================================================================
// 	/**
// 	 * @returns { Vector2 } 
// 	 */
// 	getPosition() {
// 		return this.#position;
// 	}

// 	//==============================================================================
// 	// 크기 설정.
// 	//==============================================================================
// 	/**
// 	 * @param { Vector2 } size 
// 	 */
// 	setContentSize(size) {
// 		this.#contentSize = size;
// 	}

// 	//==============================================================================
// 	// 크기 반환.
// 	//==============================================================================
// 	/**
// 	 * @returns { Vector2 } 
// 	 */
// 	getContentSize() {
// 		return this.#contentSize;
// 	}

// 	//==============================================================================
// 	// 크기 설정.
// 	//==============================================================================
// 	/**
// 	 * @param { Vector2 } scale 
// 	 */
// 	setScale(scale) {
// 		this.#scale = scale;
// 	}

// 	//==============================================================================
// 	// 크기 반환.
// 	//==============================================================================
// 	/**
// 	 * @returns { Vector2 } 
// 	 */
// 	getScale() {
// 		return this.#scale;
// 	}

// 	//==============================================================================
// 	// 회전 설정.
// 	//==============================================================================
// 	/**
// 	 * @param { number } rotation 
// 	 */
// 	setDegree(rotation) {
// 		this.#degree = rotation;
// 	}

// 	//==============================================================================
// 	// 회전 반환.
// 	//==============================================================================
// 	/**
// 	 * @returns { number } 
// 	 */
// 	getDegree() {
// 		return this.#degree;
// 	}

// 	//==============================================================================
// 	// 색상 설정.
// 	//==============================================================================
// 	/**
// 	 * @param { string } color 
// 	 */
// 	setColor(color) {
// 		this.#color = color;
// 	}

// 	//==============================================================================
// 	// 색상 반환.
// 	//==============================================================================
// 	/**
// 	 * @returns { string } 
// 	 */
// 	getColor() {
// 		return this.#color;
// 	}


// 	//==============================================================================
// 	// 투명도 설정.
// 	//==============================================================================
// 	/**
// 	 * @param { number } opacity 
// 	 */
// 	setOpacity(opacity) {
// 		this.#opacity = opacity;
// 	}

// 	//==============================================================================
// 	// 투명도 반환.
// 	//==============================================================================
// 	/**
// 	 * @returns { number } 
// 	 */
// 	getOpacity() {
// 		return this.#opacity;
// 	}

// 	//==============================================================================
// 	// 피봇 설정.
// 	//==============================================================================
// 	/**
// 	 * @param { Vector2 } pivot
// 	 */
// 	setPivot(pivot) {
// 		this.#pivot = pivot;
// 		this.#pivot.x = Math.clamp(this.#pivot.x, 0, 1);
// 		this.#pivot.y = Math.clamp(this.#pivot.y, 0, 1);
// 	}

// 	//==============================================================================
// 	// 피봇 반환.
// 	//==============================================================================
// 	/**
// 	 * @returns { Vector2 }
// 	 */
// 	getPivot() {
// 		return this.#pivot;
// 	}

// 	// //==============================================================================
// 	// // 실제 화면에 그려지는 영역 반환. (회전 무시한 AABB)
// 	// //==============================================================================
// 	// /**
// 	//  * @returns { Rect }
// 	//  */
// 	// getWorldRect() {
// 	// 	const position = this.getPosition();
// 	//     const contentSize = this.getContentSize();
// 	//     const scale = this.getScale();
// 	//     const pivot = this.getPivot();

// 	//     const width = contentSize.x * Math.abs(scale.x);
// 	//     const height = contentSize.y * Math.abs(scale.y);
// 	//     const x = position.x - (width * pivot.x);
// 	//     const y = position.y - (height * pivot.y);

// 	//     return Rect.create(x, y, width, height);
// 	// }

// 	// //==============================================================================
// 	// // 실제 화면에 그려지는 영역 반환. (회전 반영된 AABB)
// 	// //==============================================================================
// 	// /**
// 	//  * @returns { Rect }
// 	//  */
// 	// getWorldBounds() {
// 	// 	const position = this.getPosition();
// 	// 	const contentSize = this.getContentSize();
// 	// 	const scale = this.getScale();
// 	// 	const pivot = this.getPivot();
// 	// 	const degree = this.getRotation();
// 	// 	const radian = Math.degreeToRadian(degree);

// 	// 	const width = contentSize.x * Math.abs(scale.x);
// 	// 	const height = contentSize.y * Math.abs(scale.y);

// 	// 	const left = -(width * pivot.x);
// 	// 	const right = width * (1 - pivot.x);
// 	// 	const top = -(height * pivot.y);
// 	// 	const bottom = height * (1 - pivot.y);

// 	// 	const corners = [
// 	// 		{ x: left, y: top },
// 	// 		{ x: right, y: top },
// 	// 		{ x: right, y: bottom },
// 	// 		{ x: left, y: bottom }
// 	// 	];

// 	// 	const cosR = Math.cos(radian);
// 	// 	const sinR = Math.sin(radian);

// 	// 	let minX = Infinity;
// 	// 	let minY = Infinity;
// 	// 	let maxX = -Infinity;
// 	// 	let maxY = -Infinity;

// 	// 	for (const corner of corners) {
// 	// 		const rotatedX = corner.x * cosR - corner.y * sinR;
// 	// 		const rotatedY = corner.x * sinR + corner.y * cosR;

// 	// 		const globalX = rotatedX + position.x;
// 	// 		const globalY = rotatedY + position.y;

// 	// 		if (globalX < minX) minX = globalX;
// 	// 		if (globalX > maxX) maxX = globalX;
// 	// 		if (globalY < minY) minY = globalY;
// 	// 		if (globalY > maxY) maxY = globalY;
// 	// 	}

// 	// 	return Rect.create(minX, minY, maxX - minX, maxY - minY);
// 	// }

// 	//==============================================================================
// 	// 실제 화면에 그려지는 영역 반환. (OBB)
// 	//==============================================================================
// 	/**
// 	 * @returns { Vector2[] }
// 	 */
// 	getWorldCorners() {
// 		const position = this.getPosition();
// 		const contentSize = this.getContentSize();
// 		const scale = this.getScale();
// 		const pivot = this.getPivot();
// 		const degree = this.getDegree();

// 		const width = contentSize.x * Math.abs(scale.x);
// 		const height = contentSize.y * Math.abs(scale.y);

// 		const left = -(width * pivot.x);
// 		const right = width * (1 - pivot.x);
// 		const top = -(height * pivot.y);
// 		const bottom = height * (1 - pivot.y);

// 		const radR = Math.degreeToRadian(degree);
// 		const cosR = Math.cos(radR);
// 		const sinR = Math.sin(radR);

// 		return [
// 			Vector2.create(left * cosR - top * sinR + position.x, left * sinR + top * cosR + position.y),
// 			Vector2.create(right * cosR - top * sinR + position.x, right * sinR + top * cosR + position.y),
// 			Vector2.create(right * cosR - bottom * sinR + position.x, right * sinR + bottom * cosR + position.y),
// 			Vector2.create(left * cosR - bottom * sinR + position.x, left * sinR + bottom * cosR + position.y)
// 		];
// 	}

// 	//==============================================================================
// 	// getWorldCorners()를 기반으로 최소, 최대위치를 만들어 바운딩박스를 형성.
// 	//==============================================================================
// 	/**
// 	 * @returns { Rect }
// 	 */
// 	getWorldBounds() {
// 		const worldCorners = this.getWorldCorners();
// 		let min = Vector2.positiveInfinity();
// 		let max = Vector2.negativeInfinity();
// 		for (let i = 1; i < worldCorners.length; ++i) {
// 			const worldCorner = worldCorners[i];
// 			min.x = Math.min(min.x, worldCorner.x);
// 			min.y = Math.min(min.y, worldCorner.y);
// 			max.x = Math.max(max.x, worldCorner.x);
// 			max.y = Math.max(max.y, worldCorner.y);
// 		}

// 		return Rect.create(min.x, min.y, max.x - min.x, max.y - min.y);
// 	}

// 	//==============================================================================
// 	// 충돌 검출.
// 	//==============================================================================
// 	/**
// 	 * @param { Vector2 } position
// 	 * @returns { boolean }
// 	 */
// 	contains(position) {
// 		if (position === null) {
// 			return false;
// 		}
// 		const worldCorners = this.getWorldCorners();
// 		const obb = new OBB();
// 		obb.setEdges(worldCorners);
// 		const isInside = obb.contains(position);
// 		return isInside;
// 	}

// 	//==============================================================================
// 	// 객체 생성.
// 	//==============================================================================
// 	/**
// 	 * @returns { VSimpleSprite }
// 	 */
// 	static create() {
// 		var obj = new VSimpleSprite();
// 		return obj;
// 	}
// }