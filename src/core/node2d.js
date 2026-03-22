//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VObject } from "../base/object.js";
import { VVector2 } from "../base/vector2.js";
import { VRenderer } from "./renderer.js";
import * as VMath from "../base/math.js";
import { VRect } from "../base/rect.js";
import { VOBB } from "../base/obb.js";
import { VTransform2D } from "./transform2d.js";
import { VPivot2D } from "../base/pivot2d.js";



//==============================================================================
// 계층 및 영역 객체.
//==============================================================================
/**
 * @class
 */
export class VNode2D extends VObject {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { VTransform2D } */ #transform; // 트랜스폼.
	/** @private @type { VNode | null } */ #parent; // 부모 노드.
	/** @private @type { VNode[] } */ #children; // 자식 노드 목록.
	/** @private @type { VVector2 } */ #position; // 위치.
	/** @private @type { VVector2 } */ #contentSize; // 크기.
	/** @private @type { VVector2 } */ #scale; // 크기.
	/** @private @type { number } */ #rotation; // 회전값. (degree)
	/** @private @type { boolean } */ #isActive; // 활성화 여부.
	/** @private @type { VVector2 } */ #pivot; // 출력 기준점.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.#transform = new VTransform2D();
		this.#parent = null;
		this.#children = [];
		this.#position = VVector2.zero();
		this.#contentSize = VVector2.zero();
		this.#scale = VVector2.one();
		this.#rotation = 0.0;
		this.#isActive = true;
		this.#pivot = VPivot2D.middleCenter;
	}

	//==============================================================================
	// 출력 상태 시작.
	//==============================================================================
	/**
	 * @virtual
	 * @param { VRenderer } renderer 
	 */
	pushTransform(renderer) {
		const canvasContext = renderer.getCanvasContext();
		canvasContext.save();
		
		const position = this.getPosition();
		const degree = this.getRotation();
		let radian = VMath.degreeToRadian(degree);
		const transformScale = this.calculateTransformScale();

		// 트랜스폼 조정.
		canvasContext.translate(position.x, position.y); // 위치.
		canvasContext.rotate(radian); // 회전.
		canvasContext.scale(transformScale.x, transformScale.y); // 크기.
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @virtual
	 * @param { VRenderer } renderer 
	 */
	draw(renderer) {
		const canvasContext = renderer.getCanvasContext();
		const size = this.getContentSize();
		const pivotPosition = this.calculatePivotPosition();

		// 출력.
		canvasContext.fillRect(pivotPosition.x, pivotPosition.y, size.x , size.y);
	}

	//==============================================================================
	// 출력 상태 종료.
	//==============================================================================
	/**
	 * @virtual
	 * @param { VRenderer } renderer 
	 */
	popTransform(renderer) {
		const canvasContext = renderer.getCanvasContext();
		canvasContext.globalAlpha = 1.0;
		canvasContext.restore();
	}

	// //==============================================================================
	// // 기즈모 출력.
	// //==============================================================================
	// /**
	//  * @virtual
	//  * @param { VRenderer } renderer 
	//  */
	// drawGizmos(renderer) {
	// 	if (!this.isVisibleGizmos()) {
	// 		return;
	// 	}
		
	// 	const engine = renderer.getEngine();
	// 	const canvasContext = renderer.getCanvasContext();

	// 	const degree = this.getRotation();
	// 	const radian = VMath.degreeToRadian(degree);

	// 	// 이미지 회전이 반영된 기준점 출력.
	// 	canvasContext.fillStyle = "#00ff00";
	// 	const worldCorners = this.getWorldCorners();
	// 	const pivots = [VPivot2D.topLeft, VPivot2D.topRight, VPivot2D.bottomRight, VPivot2D.bottomLeft];
	// 	for (let i = 0; i < worldCorners.length; ++i) {
	// 		const worldCorner = worldCorners[i];
	// 		canvasContext.save();
	// 		engine.gameViewIdentity(null);
	// 		canvasContext.translate(worldCorner.x, worldCorner.y);
	// 		canvasContext.rotate(radian);
	// 		const contentSize = VVector2.create(4, 4);//.divide(this.getScale());
	// 		const pivotPosition = VVector2.zero().subtract(contentSize.multiply(pivots[i]));
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

	//==============================================================================
	// 최종 크기 계산. (플립 기능으로 인해 뒤집어진 크기 계산)
	//==============================================================================
	/**
	 * @virtual
	 * @returns { VVector2 }
	 */
	calculateTransformScale() {
		const scale = this.getScale();
		return scale;
	}

	//==============================================================================
	// 최종 위치 계산. (피봇 기능으로 인해 스케일 반전되며 틀어진 출력 중심점 위치를 포함하여 중심점 위치 계산)
	//==============================================================================
	/**
	 * @virtual
	 * @returns { VVector2 }
	 */
	calculatePivotPosition() {
		const size = this.getContentSize();
		const pivot = this.getPivot();
		const pivotPosition = VVector2.zero().subtract(size.multiply(pivot)); // (0,0) - (size * (0~1,0~1))
		return pivotPosition;
	}

	//==============================================================================
	// 부모 설정.
	//==============================================================================
	/**
	 * @param { VNode } parent 
	 */
	setParent(parent) {
		// 기존 부모가 존재 할 경우.
		if (this.#parent) {
			// 동일 부모.
			if (this.#parent === parent) {
				return;
			}

			// 자식 제거.
			const index = this.#parent.#children.indexOf(this);
			if (index !== -1) {
				this.#parent.#children.splice(index, 1);
			}

			this.#parent = null;
		}

		this.#parent = parent;

		// 새 부모가 존재 할 경우.
		if (this.#parent) {

			// 자식 추가.
			parent.#children.push(this);
		}
	}

	//==============================================================================
	// 자식 추가.
	//==============================================================================
	/**
	 * @param { VNode } child 
	 */
	addChild(child) {
		child.setParent(this);
	}

	//==============================================================================
	// 자식 제거.
	//==============================================================================
	/**
	 * @param { VNode } child 
	 */
	removeChild(child) {
		child.setParent(null);
	}

	//==============================================================================
	// 모든 자식 제거. (직계 자식 목록만 비우기 때문에 자식들이 소유한 계층 구조는 유지됨)
	//==============================================================================
	removeChildren() {
		// for (let i = 0; i < this.#children.length; ++i) {
		// 	const child = this.#children[i];
		// 	this.removeChild(child);
		// 	--i;
		// }
		while (this.#children.length > 0) {
			const child = this.#children[0];
			this.removeChild(child);
		}
	}

	//==============================================================================
	// 부모가 없는지 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 
	 */
	isRoot() {
		return this.#parent === null;
	}

	//==============================================================================
	// 자식이 없는지 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 
	 */
	isLeaf() {
		return this.#children.length === 0;
	}

	//==============================================================================
	// 부모 반환.
	//==============================================================================
	/**
	 * @returns { VNode } 
	 */
	getParent() {
		return this.#parent;
	}

	//==============================================================================
	// 자식 목록 반환.
	//==============================================================================
	/**
	 * @returns { VNode[] } 
	 */
	getChildren() {
		return this.#children;
	}

	//==============================================================================
	// 자식 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 
	 */
	getChildCount(index) {
		return this.#children.length;
	}

	//==============================================================================
	// 자식 반환.
	//==============================================================================
	/**
	 * @returns { VNode } 
	 */
	getChild(index) {
		return this.#children[index];
	}

	//==============================================================================
	// 위치 설정.
	//==============================================================================
	/**
	 * @param { VVector2 } position 
	 */
	setPosition(position) {
		this.#position = position;
	}

	//==============================================================================
	// 위치 반환.
	//==============================================================================
	/**
	 * @returns { VVector2 } 
	 */
	getPosition() {
		return this.#position;
	}

	//==============================================================================
	// 크기 설정.
	//==============================================================================
	/**
	 * @param { VVector2 } size 
	 */
	setContentSize(size) {
		this.#contentSize = size;
	}

	//==============================================================================
	// 크기 반환.
	//==============================================================================
	/**
	 * @returns { VVector2 } 
	 */
	getContentSize() {
		return this.#contentSize;
	}

	//==============================================================================
	// 크기 설정.
	//==============================================================================
	/**
	 * @param { VVector2 } scale 
	 */
	setScale(scale) {
		this.#scale = scale;
	}

	//==============================================================================
	// 크기 반환.
	//==============================================================================
	/**
	 * @returns { VVector2 } 
	 */
	getScale() {
		return this.#scale;
	}

	//==============================================================================
	// 회전 설정.
	//==============================================================================
	/**
	 * @param { number } rotation 
	 */
	setRotation(rotation) {
		this.#rotation = rotation;
	}

	//==============================================================================
	// 회전 반환.
	//==============================================================================
	/**
	 * @returns { number } 
	 */
	getRotation() {
		return this.#rotation;
	}

	//==============================================================================
	// 활성화 상태 설정.
	//==============================================================================
	/**
	 * @param { boolean } active 
	 */
	setActive(active) {
		this.#isActive = active;
	}

	//==============================================================================
	// 현재부터 루트까지 계층 전체의 활성화 상태 반환. (루트까지 하나라도 비활성화상태면 false 반환)
	//==============================================================================
	/**
	 * @returns { boolean } 
	 */
	isActiveInHierarchy() {
		if (this.isActive()) {
			let current = this;
			while (current !== null) {
				if (current.isActive()) {
					current = current.getParent();
				}
				else {
					return false;
				}
			}
			return true;
		} else {
			return false;
		}
	}

	//==============================================================================
	// 활성화 상태 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 
	 */
	isActive() {
		return this.#isActive;		
	}

	//==============================================================================
	// 피봇 설정.
	//==============================================================================
	/**
	 * @param { VVector2 } pivot
	 */
	setPivot(pivot) {
		this.#pivot = pivot;
		this.#pivot.x = VMath.clamp(this.#pivot.x, 0, 1);
		this.#pivot.y = VMath.clamp(this.#pivot.y, 0, 1);
	}

	//==============================================================================
	// 피봇 반환.
	//==============================================================================
	/**
	 * @returns { VVector2 }
	 */
	getPivot() {
		return this.#pivot;
	}

	//==============================================================================
	// 실제 화면에 그려지는 영역 반환. (OBB)
	//==============================================================================
	/**
	 * @returns { VVector2[] }
	 */
	getWorldCorners() {
		const position = this.getPosition();
		const contentSize = this.getContentSize();
		const scale = this.getScale();
		const pivot = this.getPivot();
		const degree = this.getRotation();

		const width = contentSize.x * VMath.abs(scale.x);
		const height = contentSize.y * VMath.abs(scale.y);

		const left = -(width * pivot.x);
		const right = width * (1 - pivot.x);
		const top = -(height * pivot.y);
		const bottom = height * (1 - pivot.y);

		const radR = VMath.degreeToRadian(degree);
		const cosR = VMath.cos(radR);
		const sinR = VMath.sin(radR);

		return [
			VVector2.create(left * cosR - top * sinR + position.x, left * sinR + top * cosR + position.y),
			VVector2.create(right * cosR - top * sinR + position.x, right * sinR + top * cosR + position.y),
			VVector2.create(right * cosR - bottom * sinR + position.x, right * sinR + bottom * cosR + position.y),
			VVector2.create(left * cosR - bottom * sinR + position.x, left * sinR + bottom * cosR + position.y)
		];
	}

	//==============================================================================
	// getWorldCorners()를 기반으로 최소, 최대위치를 만들어 바운딩박스를 형성.
	//==============================================================================
	/**
	 * @returns { VRect }
	 */
	getWorldBounds() {
		const worldCorners = this.getWorldCorners();
		// const width = worldCorners[1].x - worldCorners[0].x; // rt - lt;
		// const height = worldCorners[2].y - worldCorners[0].y; // rb - lt;
		// return VRect.create(worldCorners[0].x, worldCorners[0].y, width, height);

		let min = VVector2.positiveInfinity();
		let max = VVector2.negativeInfinity();
		for (let i = 1; i < worldCorners.length; ++i) {
			const worldCorner = worldCorners[i];
			if (min.x > worldCorner.x) {
				min.x = worldCorner.x;
			}
			if (min.y > worldCorner.y) {
				min.y = worldCorner.y;
			}
			if (max.x < worldCorner.x) {
				max.x = worldCorner.x;
			}
			if (max.y < worldCorner.y) {
				max.y = worldCorner.y;
			}
		}
		return VRect.create(min.x, min.y, max.x - min.x, max.y - min.y);
	}

	//==============================================================================
	// getWorldCorners() 를 통한 충돌 검출.
	//==============================================================================
	/**
	 * @param { VVector2 } position
	 * @returns { boolean }
	 */
	contains(position) {
		if (position === null) {
			return false;
		}
		const worldCorners = this.getWorldCorners();
		const obb = new VOBB();
		obb.setEdges(worldCorners);
		const isInside = obb.contains(position);
		return isInside;
	}
}