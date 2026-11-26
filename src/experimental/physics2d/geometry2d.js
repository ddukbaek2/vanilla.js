//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";
import { Vector2 } from "../../base/vector2.js";
import { PhysicsMath2D } from "./physicsmath2d.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 볼록 다각형 꼭짓점 수의 상한. (Box2D 의 B2_MAX_POLYGON_VERTICES 와 같은 8)
export const PHYSICS2D_MAXIMUM_POLYGON_VERTICES = 8;


//==============================================================================
// 모양의 종류. (값 차례가 충돌 짝의 차례다. 원이 늘 뒤에 온다)
//==============================================================================
/** @enum { number } */
export const ShapeType2D = System.Object.freeze({
	circle: 0, // 원.
	capsule: 1, // 캡슐. (두 중심을 잇는 선분에 반지름을 두른 것)
	segment: 2, // 선분. (두께 없음, 보통 정적 몸의 땅과 벽)
	polygon: 3, // 볼록 다각형. (꼭짓점 3 ~ 8 개, 둥근 반지름을 둘 수 있다)
});


//==============================================================================
// 원. (몸 기준 좌표)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
//==============================================================================
/**
 * @example <caption>몸 중심에서 오른쪽으로 비킨 원</caption>
 * import { Experimental, Vector2 } from "./build/vanilla.js";
 *
 * const circle = Experimental.Circle2D.create(Vector2.create(10, 0), 25);
 * console.log(circle.center.x, circle.radius);
 */
export class Circle2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { Vector2 } */ center; // 중심. (몸 기준)
	/** @type { number } */ radius; // 반지름.

	//==============================================================================
	// 생성. (중심 0, 반지름 0.5)
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.center = Vector2.zero();
		this.radius = 0.5;
	}

	//==============================================================================
	// 중심과 반지름으로 만들기. (정적)
	//==============================================================================
	/**
	 * @param { Vector2 } center 중심. (몸 기준)
	 * @param { number } radius 반지름.
	 * @returns { Circle2D } 새 원.
	 */
	static create(center, radius) {
		const circle = new Circle2D();
		circle.center = Vector2.create(center.x, center.y);
		circle.radius = radius;
		return circle;
	}
}


//==============================================================================
// 캡슐. (두 중심을 잇는 선분에 반지름을 두른 것, 몸 기준 좌표)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
//==============================================================================
/**
 * @example <caption>가로로 누운 캡슐</caption>
 * import { Experimental, Vector2 } from "./build/vanilla.js";
 *
 * const capsule = Experimental.Capsule2D.create(Vector2.create(-20, 0), Vector2.create(20, 0), 10);
 * console.log(capsule.center1.x, capsule.center2.x, capsule.radius);
 */
export class Capsule2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { Vector2 } */ center1; // 첫 반원의 중심. (몸 기준)
	/** @type { Vector2 } */ center2; // 둘째 반원의 중심. (몸 기준)
	/** @type { number } */ radius; // 반지름.

	//==============================================================================
	// 생성. (세로 길이 1, 반지름 0.25)
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.center1 = Vector2.create(0, -0.5);
		this.center2 = Vector2.create(0, 0.5);
		this.radius = 0.25;
	}

	//==============================================================================
	// 두 중심과 반지름으로 만들기. (정적)
	//==============================================================================
	/**
	 * @param { Vector2 } center1 첫 반원의 중심. (몸 기준)
	 * @param { Vector2 } center2 둘째 반원의 중심. (몸 기준, center1 과 달라야 한다)
	 * @param { number } radius 반지름.
	 * @returns { Capsule2D } 새 캡슐.
	 */
	static create(center1, center2, radius) {
		const capsule = new Capsule2D();
		capsule.center1 = Vector2.create(center1.x, center1.y);
		capsule.center2 = Vector2.create(center2.x, center2.y);
		capsule.radius = radius;
		return capsule;
	}
}


//==============================================================================
// 선분. (두께 없음, 몸 기준 좌표)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 질량이 없어 보통 정적 몸의 땅과 벽에 쓴다. 선분끼리는 부딪히지 않는다.
//==============================================================================
/**
 * @example <caption>땅 선분</caption>
 * import { Experimental, Vector2 } from "./build/vanilla.js";
 *
 * const segment = Experimental.Segment2D.create(Vector2.create(0, 400), Vector2.create(800, 400));
 * console.log(segment.point1.x, segment.point2.x);
 */
export class Segment2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { Vector2 } */ point1; // 첫 점. (몸 기준)
	/** @type { Vector2 } */ point2; // 둘째 점. (몸 기준)

	//==============================================================================
	// 생성. (가로 길이 1)
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.point1 = Vector2.create(-0.5, 0);
		this.point2 = Vector2.create(0.5, 0);
	}

	//==============================================================================
	// 두 점으로 만들기. (정적)
	//==============================================================================
	/**
	 * @param { Vector2 } point1 첫 점. (몸 기준)
	 * @param { Vector2 } point2 둘째 점. (몸 기준, point1 과 달라야 한다)
	 * @returns { Segment2D } 새 선분.
	 */
	static create(point1, point2) {
		const segment = new Segment2D();
		segment.point1 = Vector2.create(point1.x, point1.y);
		segment.point2 = Vector2.create(point2.x, point2.y);
		return segment;
	}
}


//==============================================================================
// 볼록 다각형. (꼭짓점 3 ~ 8 개, 둥근 반지름을 둘 수 있다, 몸 기준 좌표)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 꼭짓점은 수학 좌표의 반시계 방향(넓이가 양수인 쪽)으로 들고, normals[i] 는 꼭짓점 i 에서 i + 1 로 가는 변의 바깥쪽 단위 법선이다.
//   엔진 화면은 y 가 아래로 커서 화면에서는 시계 방향으로 보인다. 셈은 같다.
// - 직접 채우지 말고 makeBox, makeOffsetBox, makePolygon 으로 만든다.
//==============================================================================
/**
 * @example <caption>상자와 점 무리의 볼록 껍질</caption>
 * import { Experimental, Vector2 } from "./build/vanilla.js";
 *
 * const box = Experimental.Polygon2D.makeBox(20, 10);
 * console.log(box.vertices.length, box.normals[0].x, box.normals[0].y);
 * const pointList = [Vector2.create(0, 0), Vector2.create(30, 0), Vector2.create(15, 5), Vector2.create(15, 25)];
 * const hull = Experimental.Polygon2D.makePolygon(pointList, 0);
 * console.log(hull.vertices.length, hull.centroid.x.toFixed(3), hull.centroid.y.toFixed(3));
 */
export class Polygon2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { Vector2[] } */ vertices; // 꼭짓점. (몸 기준, 반시계)
	/** @type { Vector2[] } */ normals; // 변의 바깥쪽 단위 법선.
	/** @type { Vector2 } */ centroid; // 넓이 중심.
	/** @type { number } */ radius; // 둥근 반지름. (0 이면 모서리가 뾰족하다)

	//==============================================================================
	// 생성. (한 변이 1 인 정사각형)
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.vertices = [Vector2.create(-0.5, -0.5), Vector2.create(0.5, -0.5), Vector2.create(0.5, 0.5), Vector2.create(-0.5, 0.5)];
		this.normals = [Vector2.create(0, -1), Vector2.create(1, 0), Vector2.create(0, 1), Vector2.create(-1, 0)];
		this.centroid = Vector2.zero();
		this.radius = 0;
	}

	//==============================================================================
	// 몸 중심의 상자. (정적)
	//==============================================================================
	/**
	 * @param { number } halfWidth 너비의 절반.
	 * @param { number } halfHeight 높이의 절반.
	 * @returns { Polygon2D } 새 상자.
	 */
	static makeBox(halfWidth, halfHeight) {
		const polygon = new Polygon2D();
		polygon.vertices = [Vector2.create(-halfWidth, -halfHeight), Vector2.create(halfWidth, -halfHeight), Vector2.create(halfWidth, halfHeight), Vector2.create(-halfWidth, halfHeight)];
		polygon.normals = [Vector2.create(0, -1), Vector2.create(1, 0), Vector2.create(0, 1), Vector2.create(-1, 0)];
		polygon.centroid = Vector2.zero();
		polygon.radius = 0;
		return polygon;
	}

	//==============================================================================
	// 둥근 모서리 상자. (정적, 모서리를 radius 로 두른다. 겉 크기는 절반 크기 + radius)
	//==============================================================================
	/**
	 * @param { number } halfWidth 안쪽 상자 너비의 절반.
	 * @param { number } halfHeight 안쪽 상자 높이의 절반.
	 * @param { number } radius 둥근 반지름.
	 * @returns { Polygon2D } 새 상자.
	 */
	static makeRoundedBox(halfWidth, halfHeight, radius) {
		const polygon = Polygon2D.makeBox(halfWidth, halfHeight);
		polygon.radius = radius;
		return polygon;
	}

	//==============================================================================
	// 비키고 돌린 상자. (정적, 몸 기준 center 에 angle 만큼 돌려 둔다)
	//==============================================================================
	/**
	 * @param { number } halfWidth 너비의 절반.
	 * @param { number } halfHeight 높이의 절반.
	 * @param { Vector2 } center 상자 중심. (몸 기준)
	 * @param { number } angle 돌림. (라디안)
	 * @returns { Polygon2D } 새 상자.
	 */
	static makeOffsetBox(halfWidth, halfHeight, center, angle) {
		const rotation = PhysicsMath2D.computeRotation(angle);
		const cosine = rotation.cosine;
		const sine = rotation.sine;
		const polygon = Polygon2D.makeBox(halfWidth, halfHeight);
		for (let index = 0; index < 4; ++index) {
			const vertex = polygon.vertices[index];
			const normal = polygon.normals[index];
			polygon.vertices[index] = Vector2.create(cosine * vertex.x - sine * vertex.y + center.x, sine * vertex.x + cosine * vertex.y + center.y);
			polygon.normals[index] = Vector2.create(cosine * normal.x - sine * normal.y, sine * normal.x + cosine * normal.y);
		}
		polygon.centroid = Vector2.create(center.x, center.y);
		return polygon;
	}

	//==============================================================================
	// 점 무리의 볼록 껍질로 만들기. (정적, 앤드루의 단조 사슬)
	// - 한 줄 위의 점과 겹친 점은 뺀다. 껍질의 꼭짓점이 3 개보다 적거나 8 개보다 많으면 null.
	//==============================================================================
	/**
	 * @param { Vector2[] } points 점 무리. (몸 기준, 차례는 상관없다)
	 * @param { number } radius 둥근 반지름.
	 * @returns { Polygon2D | null } 새 다각형. (껍질을 못 지으면 null)
	 */
	static makePolygon(points, radius) {
		const sortedList = [];
		for (const point of points) {
			sortedList.push({ x: point.x, y: point.y });
		}
		sortedList.sort((first, second) => {
			if (first.x !== second.x) {
				return first.x < second.x ? -1 : 1;
			}
			if (first.y !== second.y) {
				return first.y < second.y ? -1 : 1;
			}
			return 0;
		});
		const hullList = [];
		for (let pass = 0; pass < 2; ++pass) {
			const chainList = [];
			for (let index = 0; index < sortedList.length; ++index) {
				const point = pass === 0 ? sortedList[index] : sortedList[sortedList.length - 1 - index];
				while (chainList.length >= 2) {
					const origin = chainList[chainList.length - 2];
					const middle = chainList[chainList.length - 1];
					const cross = (middle.x - origin.x) * (point.y - origin.y) - (middle.y - origin.y) * (point.x - origin.x);
					if (cross > 0) {
						break;
					}
					chainList.pop();
				}
				chainList.push(point);
			}
			chainList.pop();
			for (const point of chainList) {
				hullList.push(point);
			}
		}
		if (hullList.length < 3 || hullList.length > PHYSICS2D_MAXIMUM_POLYGON_VERTICES) {
			return null;
		}

		const polygon = new Polygon2D();
		polygon.vertices = [];
		polygon.normals = [];
		for (const point of hullList) {
			polygon.vertices.push(Vector2.create(point.x, point.y));
		}
		for (let index = 0; index < hullList.length; ++index) {
			const vertex1 = hullList[index];
			const vertex2 = hullList[(index + 1) % hullList.length];
			const edgeX = vertex2.x - vertex1.x;
			const edgeY = vertex2.y - vertex1.y;
			const length = System.Math.sqrt(edgeX * edgeX + edgeY * edgeY);
			polygon.normals.push(Vector2.create(edgeY / length, -edgeX / length));
		}
		polygon.centroid = Polygon2D.computeCentroid(polygon.vertices);
		polygon.radius = radius;
		return polygon;
	}

	//==============================================================================
	// 꼭짓점들의 넓이 중심. (정적, 첫 꼭짓점을 기준으로 삼각형 부채꼴)
	//==============================================================================
	/**
	 * @param { Vector2[] } vertices 반시계 꼭짓점.
	 * @returns { Vector2 } 넓이 중심.
	 */
	static computeCentroid(vertices) {
		const originX = vertices[0].x;
		const originY = vertices[0].y;
		let centerX = 0;
		let centerY = 0;
		let area = 0;
		for (let index = 1; index < vertices.length - 1; ++index) {
			const edge1X = vertices[index].x - originX;
			const edge1Y = vertices[index].y - originY;
			const edge2X = vertices[index + 1].x - originX;
			const edge2Y = vertices[index + 1].y - originY;
			const triangleArea = 0.5 * (edge1X * edge2Y - edge1Y * edge2X);
			centerX += triangleArea * (edge1X + edge2X) / 3;
			centerY += triangleArea * (edge1Y + edge2Y) / 3;
			area += triangleArea;
		}
		return Vector2.create(originX + centerX / area, originY + centerY / area);
	}
}
