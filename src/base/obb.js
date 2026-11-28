//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "./object.js";
import { Vector2 } from "./vector2.js";


//==============================================================================
// 회전된 바운딩 박스.
//==============================================================================
/**
 * @example <caption>점 포함과 두 상자의 겹침 검사</caption>
 * import { OBB, Vector2 } from "./build/vanilla.js";
 *
 * const box = new OBB();
 * box.setEdges([Vector2.create(0, 0), Vector2.create(10, 0), Vector2.create(10, 10), Vector2.create(0, 10)]);
 * const diamond = new OBB();
 * diamond.setEdges([Vector2.create(15, 5), Vector2.create(20, 10), Vector2.create(15, 15), Vector2.create(8, 10)]);
 * const point = Vector2.create(5, 5);
 * console.log(box.contains(point), box.overlaps(diamond));
 */
export class OBB extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { Vector2[] } */ #edges; // 4개의 모서리.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.#edges = [
			Vector2.zero(), Vector2.zero(), Vector2.zero(), Vector2.zero()
		];
	}

	//==============================================================================
	// 좌표와 충돌 검출.
	//==============================================================================
	/**
	 * @param { Vector2 } viewPosition 검사할 점. (모서리와 같은 좌표계)
	 * @returns { boolean } 점이 모서리들이 이루는 사각형 안에 있으면 참. (null 이거나 Vector2 가 아니면 거짓)
	 */
	contains(viewPosition) {
		if (!OBB.isValidate(viewPosition)) {
			return false;
		}
		else if (viewPosition instanceof Vector2) {
			const edges = this.getEdges();
			let isInside = false;
			for (let i = 0, j = edges.length - 1; i < edges.length; j = i++) {
				const xi = edges[i].x;
				const yi = edges[i].y;
				const xj = edges[j].x;
				const yj = edges[j].y;
				const intersect = ((yi > viewPosition.y) !== (yj > viewPosition.y)) && (viewPosition.x < (xj - xi) * (viewPosition.y - yi) / (yj - yi) + xi);
				if (intersect) {
					isInside = !isInside;
				}
			}

			return isInside;
		}

		return false;
	}

	//==============================================================================
	// 분리축 정리(SAT)를 이용한 다각형(OBB) 간의 충돌 검출.
	//==============================================================================
	/**
	 * @param { OBB } other 검사할 상자.
	 * @returns { boolean } 겹치면 참. (변이 닿기만 해도 참)
	 */
	overlaps(other) {
        const edges = this.getEdges();
        const otherEdges = other.getEdges();
        const polygons = [edges, otherEdges];
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
                for (let k = 0; k < otherEdges.length; ++k) {
                    const projection = (otherEdges[k].x * axisX) + (otherEdges[k].y * axisY);
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
	 * @param { Vector2[] } edges 모서리 4 개. (둘레를 따라 차례로, 벡터를 복사하지 않고 그대로 담는다, 4 개가 아니면 오류를 던진다)
	 * @returns { Vector2[] } 돌려주는 값 없음. (undefined)
	 */
	setEdges(edges) {
		if (!OBB.isValidate(edges)) {
			throw new System.Error(`edges is null.`);
		}
		if (!System.Array.isArray(edges)) {
			throw new System.Error(`edges is not Array.`);
		}
		if (this.#edges.length !== edges.length) {
			throw new System.Error(`edges.length !== this.#edges.length.`);
		}

		for (let i = 0; i < this.#edges.length; ++i) {
			this.#edges[i] = edges[i];
		}
	}

	//==============================================================================
	// 모서리 목록 반환.
	//==============================================================================
	/**
	 * @returns { Vector2[] } 모서리 4 개. (내부 배열을 그대로 돌려준다)
	 */
	getEdges() {
		return this.#edges;
	}
}