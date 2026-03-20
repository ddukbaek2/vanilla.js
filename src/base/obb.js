//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VObject } from "./object.js";
import { VVector2 } from "./vector2.js";


//==============================================================================
// 회전된 바운딩 박스.
//==============================================================================
export class VOBB extends VObject {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { VVector2[] } */ #edges;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.#edges = [VVector2.zero(), VVector2.zero(), VVector2.zero(), VVector2.zero()];
	}


	//==============================================================================
	// 좌표와 충돌 검출.
	//==============================================================================
	/**
	 * @param { VVector2 } point
	 * @returns { boolean }
	 */
	contains(point) {
		if (point === null) {
			return false;
		}
		
		const edges = this.getEdges();
		let isInside = false;
		for (let i = 0, j = edges.length - 1; i < edges.length; j = i++) {
			const xi = edges[i].x;
			const yi = edges[i].y;
			const xj = edges[j].x;
			const yj = edges[j].y;
			const intersect = ((yi > point.y) !== (yj > point.y)) && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
			if (intersect) {
				isInside = !isInside;
			}
		}

		return isInside;
	}

	//==============================================================================
	// 분리축 정리(SAT)를 이용한 다각형(OBB) 간의 충돌 검출.
	//==============================================================================
	/**
	 * @param { VOBB } other
	 * @returns { boolean }
	 */
	overlaps(other) {
        const edges = this.getEdges();
        const polygons = [edges, other.getEdges()];
        for (let i = 0; i < polygons.length; ++i) {
            const polygon = polygons[i];
            
            for (let j = 0; j < polygon.length; ++j) {
                const p1 = polygon[j];
                const p2 = polygon[(j + 1) % polygon.length];

                const edgeX = p2.x - p1.x;
                const edgeY = p2.y - p1.y;
                const axisX = -edgeY;
                const axisY = edgeX;

                let myMin = Infinity;
                let myMax = -Infinity;
                for (let k = 0; k < edges.length; ++k) {
                    const projection = (edges[k].x * axisX) + (edges[k].y * axisY);
                    if (projection < myMin) myMin = projection;
                    if (projection > myMax) myMax = projection;
                }

                let otherMin = Infinity;
                let otherMax = -Infinity;
                for (let k = 0; k < other.length; ++k) {
                    const projection = (other[k].x * axisX) + (other[k].y * axisY);
                    if (projection < otherMin) otherMin = projection;
                    if (projection > otherMax) otherMax = projection;
                }

                if (myMax < otherMin || otherMax < myMin) {
                    return false;
                }
            }
        }

        return true;
    }

	//==============================================================================
	// 모서리 목록 설정.
	//==============================================================================
	/**
	 * @returns { VVector2[] }
	 */
	setEdges(edges) {
		if (edges === null) {
			throw new Error(`edges is null.`);
		}
		if (!Array.isArray(edges)) {
			throw new Error(`edges is not Array.`);
		}
		if (this.#edges.length !== edges.length) {
			throw new Error(`edges.length !== this.#edges.length.`);
		}

		for (let i = 0; i < this.#edges.length; ++i) {
			this.#edges[i] = edges[i];
		}
	}

	//==============================================================================
	// 모서리 목록 반환.
	//==============================================================================
	/**
	 * @returns { VVector2[] }
	 */
	getEdges() {
		return this.#edges;
	}
}