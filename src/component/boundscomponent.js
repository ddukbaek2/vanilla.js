//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Vector2 } from "../base/vector2.js";
import { Rect } from "../base/rect.js";
import * as Math from "../base/math.js";
import { Component } from "../core/component.js";
import { Pivot } from "../base/pivot.js";
import { OBB } from "../base/obb.js";
import { Renderer } from "../core/renderer.js";



//==============================================================================
// 내용의 크기 컴포넌트.
// - 출력될 대상 크기와 크기를 기준으로한 피봇을 지정할 수 있다.
// - 해당 값에 따라서 월드코너 값을 계산하여 반환한다.
//==============================================================================
export class BoundsComponent extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Vector2 } */ #pivot; // 기준점.
	/** @private @type { Vector2 } */ #contentSize; // 크기.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @construct
	 */
	constructor() {
		super();
		this.#contentSize = Vector2.zero();
		this.#pivot = Pivot.middleCenter;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta 
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Renderer } renderer 
	 */
	draw(renderer) {
		// super.draw(renderer);

		// const canvasContext = renderer.getCanvasContext();
		// const contentSize = this.getContentSize();
		// const pivot = this.getPivot();
		// const pivotPosition = this.getPivotPosition();

		// // 출력.
		// // 피봇 위치 반영 - 기본 (0, 0) 에서 피봇만큼 좌상 방향으로 당겨준다. 
		// // 이미지 플립 반영 - 이미지를 뒤집어서 출력한다.
		// canvasContext.globalAlpha = 1.0; // this.#opacity;
		// canvasContext.fillStyle = "#ffffff"; // this.#color;
		// canvasContext.fillRect(pivotPosition.x, pivotPosition.y, contentSize.x, contentSize.y);
		// // canvasContext.globalAlpha = 1.0;
		// // canvasContext.fillStyle
	}

	//==============================================================================
	// 크기 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } size 
	 */
	setContentSize(size) {
		this.#contentSize = size;
	}

	//==============================================================================
	// 크기 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 
	 */
	getContentSize() {
		return this.#contentSize;
	}

	//==============================================================================
	// 피봇 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } pivot
	 */
	setPivot(pivot) {
		this.#pivot = pivot;
		this.#pivot.x = Math.clamp(this.#pivot.x, 0, 1);
		this.#pivot.y = Math.clamp(this.#pivot.y, 0, 1);
	}

	//==============================================================================
	// 피봇 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getPivot() {
		return this.#pivot;
	}

	//==============================================================================
	// 피봇에 기반한 로컬 위치 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getPivotPosition() {
		const node = this.getNode();
		const contentSize = this.getContentSize();
		const pivot = this.getPivot();
		return Vector2.create(-(contentSize.x * pivot.x), -(contentSize.y * pivot.y));
	}

	//==============================================================================
	// 실제 화면에 그려지는 영역 반환. (OBB)
	//==============================================================================
	/**
	 * @returns { Vector2[] }
	 */
	getWorldCorners() {
		const node = this.getNode();
		const position = node.getPosition();
		const scale = node.getScale();
		const degree = node.getRotation();
		const contentSize = this.getContentSize();
		const pivot = this.getPivot();

		const width = contentSize.x * Math.abs(scale.x);
		const height = contentSize.y * Math.abs(scale.y);

		const left = -(width * pivot.x);
		const right = width * (1 - pivot.x);
		const top = -(height * pivot.y);
		const bottom = height * (1 - pivot.y);

		const radian = Math.degreeToRadian(degree);
		const cosR = Math.cos(radian);
		const sinR = Math.sin(radian);

		return [
			Vector2.create(left * cosR - top * sinR + position.x, left * sinR + top * cosR + position.y),
			Vector2.create(right * cosR - top * sinR + position.x, right * sinR + top * cosR + position.y),
			Vector2.create(right * cosR - bottom * sinR + position.x, right * sinR + bottom * cosR + position.y),
			Vector2.create(left * cosR - bottom * sinR + position.x, left * sinR + bottom * cosR + position.y)
		];
	}

	//==============================================================================
	// getWorldCorners()를 기반으로 최소, 최대위치를 만들어 바운딩박스를 형성.
	//==============================================================================
	/**
	 * @returns { Rect }
	 */
	getWorldBounds() {
		const worldCorners = this.getWorldCorners();
		// const width = worldCorners[1].x - worldCorners[0].x; // rt - lt;
		// const height = worldCorners[2].y - worldCorners[0].y; // rb - lt;
		// return Rect.create(worldCorners[0].x, worldCorners[0].y, width, height);

		let min = Vector2.positiveInfinity();
		let max = Vector2.negativeInfinity();
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
		return Rect.create(min.x, min.y, max.x - min.x, max.y - min.y);
	}

	//==============================================================================
	// getWorldCorners() 를 통한 충돌 검출.
	//==============================================================================
	/**
	 * @param { Vector2 } worldPosition
	 * @returns { boolean }
	 */
	contains(worldPosition) {
		if (worldPosition === null) {
			return false;
		}
		const worldCorners = this.getWorldCorners();
		const obb = new OBB();
		obb.setEdges(worldCorners);
		const isInside = obb.contains(worldPosition);
		return isInside;
	}
}