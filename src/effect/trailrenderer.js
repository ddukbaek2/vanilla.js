//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../base/vector2.js";
import { Color } from "../base/color.js";
import { Component } from "../core/component.js";
import { Graphic } from "../core/graphic.js";


//==============================================================================
// 트레일 렌더러.
// - 노드가 지나간 자리를 점으로 기록해 굵기 / 색이 잦아드는 띠로 그린다.
//   (유니티 TrailRenderer 의 2D 대응)
// - 사용:
//     const trail = node.addComponent(TrailRenderer);
//     trail.setTime(0.5);
//     trail.setWidth(14, 0);
//     trail.setColors(new Color(0.4, 0.8, 1, 0.9), new Color(0.4, 0.8, 1, 0));
//==============================================================================
export class TrailRenderer extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object[] } */ #pointList; // { x, y, age }
	/** @private @type { number } */ #pointLifetime; // 점이 남는 시간. (초)
	/** @private @type { number } */ #minVertexDistance; // 이보다 가까우면 점을 추가하지 않는다.
	/** @private @type { number } */ #startWidth;
	/** @private @type { number } */ #endWidth;
	/** @private @type { Color } */ #startColor;
	/** @private @type { Color } */ #endColor;
	/** @private @type { boolean } */ #isAdditive;
	/** @private @type { boolean } */ #isEmitting;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.setComponentType("TrailRenderer");
		this.#pointList = [];
		this.#pointLifetime = 0.5;
		this.#minVertexDistance = 3;
		this.#startWidth = 10;
		this.#endWidth = 0;
		this.#startColor = new Color(1, 1, 1, 0.9);
		this.#endColor = new Color(1, 1, 1, 0);
		this.#isAdditive = false;
		this.#isEmitting = true;
	}

	//==============================================================================
	// 갱신. (점 기록 + 노화)
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		const node = this.getNode();
		const localPosition = node.getLocalPosition();

		for (let pointIndex = this.#pointList.length - 1; pointIndex >= 0; --pointIndex) {
			const point = this.#pointList[pointIndex];
			point.age += timeDelta;
			if (point.age >= this.#pointLifetime) {
				this.#pointList.splice(pointIndex, 1);
			}
		}

		if (!this.#isEmitting) {
			return;
		}
		const lastPoint = this.#pointList[this.#pointList.length - 1];
		if (lastPoint) {
			const deltaX = localPosition.x - lastPoint.x;
			const deltaY = localPosition.y - lastPoint.y;
			if (deltaX * deltaX + deltaY * deltaY < this.#minVertexDistance * this.#minVertexDistance) {
				return;
			}
		}
		this.#pointList.push({ x: localPosition.x, y: localPosition.y, age: 0 });
	}

	//==============================================================================
	// 출력. (세그먼트마다 굵기 / 색 보간 — 노드 원점 기준 상대 좌표로 그린다)
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic
	 */
	draw(graphic) {
		if (this.#pointList.length < 2) {
			return;
		}
		if (this.#isAdditive) {
			graphic.setBlendMode("lighter");
		}
		const node = this.getNode();
		const nodePosition = node.getLocalPosition();

		for (let pointIndex = 0; pointIndex < this.#pointList.length - 1; ++pointIndex) {
			const point = this.#pointList[pointIndex];
			const nextPoint = this.#pointList[pointIndex + 1];
			const ageRatio = point.age / this.#pointLifetime;
			const freshRatio = 1 - ageRatio;
			const segmentWidth = System.Math.max(0.1, this.#endWidth + (this.#startWidth - this.#endWidth) * freshRatio);
			const red = System.Math.round((this.#endColor.red + (this.#startColor.red - this.#endColor.red) * freshRatio) * 255);
			const green = System.Math.round((this.#endColor.green + (this.#startColor.green - this.#endColor.green) * freshRatio) * 255);
			const blue = System.Math.round((this.#endColor.blue + (this.#startColor.blue - this.#endColor.blue) * freshRatio) * 255);
			const alpha = this.#endColor.alpha + (this.#startColor.alpha - this.#endColor.alpha) * freshRatio;
			graphic.setStrokeColor(`rgba(${red}, ${green}, ${blue}, ${alpha})`);
			graphic.drawLine([
				Vector2.create(point.x - nodePosition.x, point.y - nodePosition.y),
				Vector2.create(nextPoint.x - nodePosition.x, nextPoint.y - nodePosition.y),
			], segmentWidth);
		}

		if (this.#isAdditive) {
			graphic.setBlendMode("source-over");
		}
	}

	//==============================================================================
	// 흔적 지우기.
	//==============================================================================
	clear() {
		this.#pointList.length = 0;
	}

	//==============================================================================
	// 설정 메서드 목록.
	//==============================================================================
	/** @param { number } pointLifetime 점이 남는 시간. (초) */
	setTime(pointLifetime) {
		this.#pointLifetime = pointLifetime;
	}

	/** @param { number } minVertexDistance */
	setMinVertexDistance(minVertexDistance) {
		this.#minVertexDistance = minVertexDistance;
	}

	/** @param { number } startWidth @param { number } endWidth */
	setWidth(startWidth, endWidth) {
		this.#startWidth = startWidth;
		this.#endWidth = endWidth;
	}

	/** @param { Color } startColor @param { Color } endColor */
	setColors(startColor, endColor) {
		this.#startColor = startColor.clone();
		this.#endColor = endColor.clone();
	}

	/** @param { boolean } isAdditive */
	setAdditive(isAdditive) {
		this.#isAdditive = isAdditive;
	}

	/** @param { boolean } isEmitting 거짓이면 새 점을 만들지 않는다. (남은 띠는 잦아든다) */
	setEmitting(isEmitting) {
		this.#isEmitting = isEmitting;
	}

	//==============================================================================
	// 조회 메서드 목록.
	//==============================================================================
	/** @returns { number } */
	getPointCount() {
		return this.#pointList.length;
	}
}
