//==============================================================================
// 포함 모듈 목록.
//==============================================================================
// 옮긴 원문: Box2D 3 의 셈에서 옮김, MIT, THIRD_PARTY_LICENSES.md
const System = globalThis;
import { Object } from "../../base/object.js";
import { Vector2 } from "../../base/vector2.js";
import { AABB2D } from "../spatial/aabb2d.js";
import { ShapeType2D, Circle2D, Capsule2D, Segment2D, Polygon2D } from "./geometry2d.js";
import { ShapeId2D, BodyId2D } from "./physicsid2d.js";


//==============================================================================
// 충돌 거르기. (분류, 마스크, 무리)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 두 모양은 (A 분류 & B 마스크) 와 (B 분류 & A 마스크) 가 모두 0 이 아닐 때 부딪힌다. 비트는 32 개다. (유니티 2D 의 층 32 개와 같은 수)
// - 무리 번호가 0 이 아니고 서로 같으면 분류, 마스크보다 먼저 본다. 양수면 늘 부딪히고 음수면 늘 지나친다. (Box2D 의 groupIndex 와 같은 규칙)
//==============================================================================
/**
 * @example <caption>플레이어와 적만 부딪히게</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const playerFilter = new Experimental.CollisionFilter2D();
 * playerFilter.categoryBits = 0x0002;
 * playerFilter.maskBits = 0x0004;
 * const enemyFilter = new Experimental.CollisionFilter2D();
 * enemyFilter.categoryBits = 0x0004;
 * enemyFilter.maskBits = 0x0002;
 * console.log(playerFilter.shouldCollide(enemyFilter), playerFilter.shouldCollide(playerFilter));
 */
export class CollisionFilter2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { number } */ categoryBits; // 이 모양의 분류 비트. (기본 1)
	/** @type { number } */ maskBits; // 부딪힐 분류 비트. (기본 모두)
	/** @type { number } */ groupIndex; // 무리 번호. (0 이면 쓰지 않는다)

	//==============================================================================
	// 생성. (분류 1, 마스크 모두, 무리 0)
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.categoryBits = 1;
		this.maskBits = 0xffffffff;
		this.groupIndex = 0;
	}

	//==============================================================================
	// 복사본 반환.
	//==============================================================================
	/**
	 * @returns { CollisionFilter2D } 같은 값의 새 거르기.
	 */
	clone() {
		const filter = new CollisionFilter2D();
		filter.categoryBits = this.categoryBits;
		filter.maskBits = this.maskBits;
		filter.groupIndex = this.groupIndex;
		return filter;
	}

	//==============================================================================
	// 다른 거르기와 부딪히는지.
	//==============================================================================
	/**
	 * @param { CollisionFilter2D } other 견줄 거르기.
	 * @returns { boolean } 부딪히면 참.
	 */
	shouldCollide(other) {
		return shouldFiltersCollide(this.categoryBits, this.maskBits, this.groupIndex, other.categoryBits, other.maskBits, other.groupIndex);
	}
}

//==============================================================================
// 두 거르기 값이 부딪히는지. (안에서 쓴다)
//==============================================================================
/**
 * @param { number } categoryBitsA
 * @param { number } maskBitsA
 * @param { number } groupIndexA
 * @param { number } categoryBitsB
 * @param { number } maskBitsB
 * @param { number } groupIndexB
 * @returns { boolean }
 */
export function shouldFiltersCollide(categoryBitsA, maskBitsA, groupIndexA, categoryBitsB, maskBitsB, groupIndexB) {
	if (groupIndexA === groupIndexB && groupIndexA !== 0) {
		return groupIndexA > 0;
	}
	return (categoryBitsA & maskBitsB) !== 0 && (categoryBitsB & maskBitsA) !== 0;
}


//==============================================================================
// 질의 거르기. (광선, 겹침 질의가 찾을 모양)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - (모양 분류 & 질의 마스크) 와 (모양 마스크 & 질의 분류) 가 모두 0 이 아닌 모양만 찾는다. (Box2D 의 b2QueryFilter 와 같다)
//==============================================================================
/**
 * @example <caption>2 번 분류만 찾는 질의</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const queryFilter = new Experimental.QueryFilter2D();
 * queryFilter.maskBits = 0x0002;
 * console.log(queryFilter.categoryBits, queryFilter.maskBits);
 */
export class QueryFilter2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { number } */ categoryBits; // 질의의 분류 비트. (기본 1)
	/** @type { number } */ maskBits; // 찾을 분류 비트. (기본 모두)

	//==============================================================================
	// 생성. (분류 1, 마스크 모두)
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.categoryBits = 1;
		this.maskBits = 0xffffffff;
	}
}


//==============================================================================
// 모양 정의. (createShape 에 넘기는 값)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
//==============================================================================
/**
 * @example <caption>잘 튀는 센서 아닌 모양</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const shapeDefinition = new Experimental.ShapeDefinition2D();
 * shapeDefinition.density = 2;
 * shapeDefinition.restitution = 0.8;
 * console.log(shapeDefinition.friction, shapeDefinition.isSensor);
 */
export class ShapeDefinition2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { number } */ density; // 밀도. (넓이당 질량, 기본 1)
	/** @type { number } */ friction; // 마찰 계수. (기본 0.6, 두 모양의 값은 곱의 제곱근으로 섞는다)
	/** @type { number } */ restitution; // 반발 계수. (기본 0, 두 모양의 값은 큰 쪽을 쓴다)
	/** @type { CollisionFilter2D } */ filter; // 충돌 거르기.
	/** @type { boolean } */ isSensor; // 센서인지. (부딪히지 않고 겹침 사건만 낸다, 기본 거짓)
	/** @type { boolean } */ enableSensorEvents; // 센서에 들어가고 나갈 때 사건을 낼지. (기본 참)
	/** @type { boolean } */ enableContactEvents; // 닿기 시작과 끝 사건을 낼지. (기본 참)
	/** @type { any } */ userData; // 사용자 값.

	//==============================================================================
	// 생성. (밀도 1, 마찰 0.6, 반발 0)
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.density = 1;
		this.friction = 0.6;
		this.restitution = 0;
		this.filter = new CollisionFilter2D();
		this.isSensor = false;
		this.enableSensorEvents = true;
		this.enableContactEvents = true;
		this.userData = null;
	}
}


//==============================================================================
// 사슬 정의. (createChain 에 넘기는 값, 이은 선분들)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 점 i 와 i + 1 을 잇는 선분 모양을 하나씩 만든다. isLoop 면 마지막 점과 첫 점도 잇는다. (땅의 굴곡, 방의 벽)
// - 선분은 양면이다. Box2D 사슬의 한쪽 면과 유령 꼭짓점(이음매에서 걸리지 않게 하는 것)은 아직 없다.
//==============================================================================
/**
 * @example <caption>굽은 땅 사슬</caption>
 * import { Vector2 } from "./import.js";
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const chainDefinition = new Experimental.ChainDefinition2D();
 * chainDefinition.points = [Vector2.create(0, 300), Vector2.create(200, 320), Vector2.create(400, 300)];
 * console.log(chainDefinition.points.length, chainDefinition.isLoop);
 */
export class ChainDefinition2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { Vector2[] } */ points; // 점들. (몸 기준, 2 개 이상)
	/** @type { boolean } */ isLoop; // 끝과 처음을 이을지. (기본 거짓)
	/** @type { number } */ friction; // 마찰 계수. (기본 0.6)
	/** @type { number } */ restitution; // 반발 계수. (기본 0)
	/** @type { CollisionFilter2D } */ filter; // 충돌 거르기.
	/** @type { any } */ userData; // 사용자 값. (선분마다 같은 값)

	//==============================================================================
	// 생성. (점 없음)
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.points = [];
		this.isLoop = false;
		this.friction = 0.6;
		this.restitution = 0;
		this.filter = new CollisionFilter2D();
		this.userData = null;
	}
}


//==============================================================================
// 모양 자료. (월드가 셈에 쓰는 값, 안에서 쓴다)
//==============================================================================
export class ShapeData extends Object {
	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.id = null;
		this.bodyIndex = -1;
		this.type = ShapeType2D.circle;
		// 원.
		this.centerX = 0;
		this.centerY = 0;
		// 다각형 꼴. (캡슐과 선분은 꼭짓점 2 개)
		this.count = 0;
		this.vertexX = [0, 0, 0, 0, 0, 0, 0, 0];
		this.vertexY = [0, 0, 0, 0, 0, 0, 0, 0];
		this.normalX = [0, 0, 0, 0, 0, 0, 0, 0];
		this.normalY = [0, 0, 0, 0, 0, 0, 0, 0];
		this.radius = 0;
		// 재질.
		this.density = 1;
		this.friction = 0.6;
		this.restitution = 0;
		this.categoryBits = 1;
		this.maskBits = 0xffffffff;
		this.groupIndex = 0;
		this.isSensor = false;
		this.enableSensorEvents = true;
		this.enableContactEvents = true;
		this.userData = null;
		// 넓은 단계.
		this.proxyId = -1;
		this.aabb = new AABB2D();
		this.fatAabb = new AABB2D();
		this.isFilterDirty = false;
	}
}


//==============================================================================
// 모양. (몸에 붙은 충돌 모양 하나)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - PhysicsWorld2D.createShape 로 만들고 getShape(shapeId) 로 얻는다. 직접 만들지 않는다.
//==============================================================================
/**
 * @example <caption>모양의 재질 바꾸기</caption>
 * import { Vector2 } from "./import.js";
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const world = new Experimental.PhysicsWorld2D(new Experimental.WorldDefinition2D(1));
 * const bodyId = world.createBody(new Experimental.BodyDefinition2D());
 * const shapeId = world.createShape(bodyId, new Experimental.ShapeDefinition2D(), Experimental.Circle2D.create(Vector2.zero(), 2));
 * const shape = world.getShape(shapeId);
 * shape.setFriction(0.2);
 * shape.setRestitution(0.5);
 * console.log(shape.getType() === Experimental.ShapeType2D.circle, shape.getFriction(), shape.getRestitution());
 */
export class Shape2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { ShapeData } */ #data;
	/** @private @type { BodyId2D } */ #bodyId;

	//==============================================================================
	// 생성. (월드가 만든다)
	//==============================================================================
	/**
	 * @constructor
	 * @param { ShapeData } data 모양 자료.
	 * @param { BodyId2D } bodyId 붙은 몸의 아이디.
	 */
	constructor(data, bodyId) {
		super();
		this.#data = data;
		this.#bodyId = bodyId;
	}

	//==============================================================================
	// 모양 자료 반환. (안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @returns { ShapeData }
	 */
	getData() {
		return this.#data;
	}

	//==============================================================================
	// 아이디 반환.
	//==============================================================================
	/**
	 * @returns { ShapeId2D } 이 모양의 아이디.
	 */
	getId() {
		const data = this.getData();
		return data.id;
	}

	//==============================================================================
	// 붙은 몸의 아이디 반환.
	//==============================================================================
	/**
	 * @returns { BodyId2D } 몸 아이디.
	 */
	getBodyId() {
		return this.#bodyId;
	}

	//==============================================================================
	// 모양의 종류 반환.
	//==============================================================================
	/**
	 * @returns { number } ShapeType2D 값.
	 */
	getType() {
		const data = this.getData();
		return data.type;
	}

	//==============================================================================
	// 모양 반환. (몸 기준 좌표의 새 Circle2D, Capsule2D, Segment2D, Polygon2D)
	//==============================================================================
	/**
	 * @returns { Circle2D | Capsule2D | Segment2D | Polygon2D } 모양의 복사본.
	 */
	getGeometry() {
		const data = this.getData();
		if (data.type === ShapeType2D.circle) {
			const center = Vector2.create(data.centerX, data.centerY);
			return Circle2D.create(center, data.radius);
		}
		if (data.type === ShapeType2D.capsule) {
			const center1 = Vector2.create(data.vertexX[0], data.vertexY[0]);
			const center2 = Vector2.create(data.vertexX[1], data.vertexY[1]);
			return Capsule2D.create(center1, center2, data.radius);
		}
		if (data.type === ShapeType2D.segment) {
			const point1 = Vector2.create(data.vertexX[0], data.vertexY[0]);
			const point2 = Vector2.create(data.vertexX[1], data.vertexY[1]);
			return Segment2D.create(point1, point2);
		}
		const polygon = new Polygon2D();
		polygon.vertices = [];
		polygon.normals = [];
		for (let index = 0; index < data.count; ++index) {
			polygon.vertices.push(Vector2.create(data.vertexX[index], data.vertexY[index]));
			polygon.normals.push(Vector2.create(data.normalX[index], data.normalY[index]));
		}
		polygon.centroid = Polygon2D.computeCentroid(polygon.vertices);
		polygon.radius = data.radius;
		return polygon;
	}

	//==============================================================================
	// 밀도 반환.
	//==============================================================================
	/**
	 * @returns { number } 밀도.
	 */
	getDensity() {
		const data = this.getData();
		return data.density;
	}

	//==============================================================================
	// 마찰 계수 설정. (다음 걸음부터)
	//==============================================================================
	/**
	 * @param { number } friction 마찰 계수. (0 이상)
	 */
	setFriction(friction) {
		const data = this.getData();
		data.friction = System.Math.max(0, friction);
	}

	//==============================================================================
	// 마찰 계수 반환.
	//==============================================================================
	/**
	 * @returns { number } 마찰 계수.
	 */
	getFriction() {
		const data = this.getData();
		return data.friction;
	}

	//==============================================================================
	// 반발 계수 설정. (다음 걸음부터)
	//==============================================================================
	/**
	 * @param { number } restitution 반발 계수. (0 이상, 1 이면 튄 속력을 거의 그대로 돌려준다)
	 */
	setRestitution(restitution) {
		const data = this.getData();
		data.restitution = System.Math.max(0, restitution);
	}

	//==============================================================================
	// 반발 계수 반환.
	//==============================================================================
	/**
	 * @returns { number } 반발 계수.
	 */
	getRestitution() {
		const data = this.getData();
		return data.restitution;
	}

	//==============================================================================
	// 센서인지.
	//==============================================================================
	/**
	 * @returns { boolean } 센서면 참.
	 */
	isSensor() {
		const data = this.getData();
		return data.isSensor;
	}

	//==============================================================================
	// 충돌 거르기 설정. (다음 걸음 앞에서 닿음을 다시 고른다)
	//==============================================================================
	/**
	 * @param { CollisionFilter2D } filter 새 거르기.
	 */
	setFilter(filter) {
		const data = this.getData();
		data.categoryBits = filter.categoryBits >>> 0;
		data.maskBits = filter.maskBits >>> 0;
		data.groupIndex = filter.groupIndex;
		data.isFilterDirty = true;
	}

	//==============================================================================
	// 충돌 거르기 반환. (복사본)
	//==============================================================================
	/**
	 * @returns { CollisionFilter2D } 거르기.
	 */
	getFilter() {
		const data = this.getData();
		const filter = new CollisionFilter2D();
		filter.categoryBits = data.categoryBits;
		filter.maskBits = data.maskBits;
		filter.groupIndex = data.groupIndex;
		return filter;
	}

	//==============================================================================
	// 사용자 값 설정.
	//==============================================================================
	/**
	 * @param { any } userData 사용자 값.
	 */
	setUserData(userData) {
		const data = this.getData();
		data.userData = userData;
	}

	//==============================================================================
	// 사용자 값 반환.
	//==============================================================================
	/**
	 * @returns { any } 사용자 값.
	 */
	getUserData() {
		const data = this.getData();
		return data.userData;
	}

	//==============================================================================
	// 월드 좌표의 경계 상자 반환. (마지막 걸음의 자리, 복사본)
	//==============================================================================
	/**
	 * @returns { AABB2D } 경계 상자.
	 */
	getAabb() {
		const data = this.getData();
		return data.aabb.clone();
	}
}

//==============================================================================
// 모양 자료에 모양을 넣기. (안에서 쓴다)
//==============================================================================
/**
 * @param { ShapeData } data
 * @param { Circle2D | Capsule2D | Segment2D | Polygon2D } geometry
 * @returns { boolean } 받을 수 있는 모양이면 참.
 */
export function setShapeGeometry(data, geometry) {
	if (geometry instanceof Circle2D) {
		data.type = ShapeType2D.circle;
		data.centerX = geometry.center.x;
		data.centerY = geometry.center.y;
		data.radius = geometry.radius;
		data.count = 0;
		return true;
	}
	if (geometry instanceof Capsule2D || geometry instanceof Segment2D) {
		const isCapsule = geometry instanceof Capsule2D;
		const point1 = isCapsule ? geometry.center1 : geometry.point1;
		const point2 = isCapsule ? geometry.center2 : geometry.point2;
		const axisX = point2.x - point1.x;
		const axisY = point2.y - point1.y;
		const length = System.Math.sqrt(axisX * axisX + axisY * axisY);
		if (!(length > 0)) {
			return false;
		}
		data.type = isCapsule ? ShapeType2D.capsule : ShapeType2D.segment;
		data.count = 2;
		data.vertexX[0] = point1.x;
		data.vertexY[0] = point1.y;
		data.vertexX[1] = point2.x;
		data.vertexY[1] = point2.y;
		data.normalX[0] = axisY / length;
		data.normalY[0] = -axisX / length;
		data.normalX[1] = -data.normalX[0];
		data.normalY[1] = -data.normalY[0];
		data.radius = isCapsule ? geometry.radius : 0;
		data.centerX = 0.5 * (point1.x + point2.x);
		data.centerY = 0.5 * (point1.y + point2.y);
		return true;
	}
	if (geometry instanceof Polygon2D) {
		const count = geometry.vertices.length;
		if (count < 3 || count > 8 || geometry.normals.length !== count) {
			return false;
		}
		data.type = ShapeType2D.polygon;
		data.count = count;
		for (let index = 0; index < count; ++index) {
			data.vertexX[index] = geometry.vertices[index].x;
			data.vertexY[index] = geometry.vertices[index].y;
			data.normalX[index] = geometry.normals[index].x;
			data.normalY[index] = geometry.normals[index].y;
		}
		data.radius = geometry.radius;
		data.centerX = geometry.centroid.x;
		data.centerY = geometry.centroid.y;
		return true;
	}
	return false;
}

//==============================================================================
// 모양의 질량. (안에서 쓴다, 질량, 질량 중심(몸 기준), 질량 중심에 대한 회전 관성)
//==============================================================================
/**
 * @param { ShapeData } data
 * @returns { number[] } [질량, 중심 x, 중심 y, 회전 관성]
 */
export function computeShapeMass(data) {
	const density = data.density;
	if (data.type === ShapeType2D.circle) {
		const radiusSquared = data.radius * data.radius;
		const mass = density * System.Math.PI * radiusSquared;
		return [mass, data.centerX, data.centerY, mass * 0.5 * radiusSquared];
	}
	if (data.type === ShapeType2D.segment) {
		return [0, data.centerX, data.centerY, 0];
	}
	if (data.type === ShapeType2D.capsule) {
		const radius = data.radius;
		const radiusSquared = radius * radius;
		const axisX = data.vertexX[1] - data.vertexX[0];
		const axisY = data.vertexY[1] - data.vertexY[0];
		const length = System.Math.sqrt(axisX * axisX + axisY * axisY);
		const boxMass = density * (2 * radius * length);
		const circleMass = density * System.Math.PI * radiusSquared;
		const mass = boxMass + circleMass;
		// 반원 둘은 각자 중심이 원 중심에서 4r / (3 파이) 만큼 바깥이다. (평행축 정리로 캡슐 중심에 옮긴다)
		const semicircleOffset = 4 * radius / (3 * System.Math.PI);
		const halfLength = 0.5 * length;
		const circleInertia = circleMass * (0.5 * radiusSquared + halfLength * halfLength + 2 * halfLength * semicircleOffset);
		const boxInertia = boxMass * (4 * radiusSquared + length * length) / 12;
		return [mass, data.centerX, data.centerY, circleInertia + boxInertia];
	}

	// 다각형. (둥근 반지름이 있으면 꼭짓점을 이웃 법선의 가운데 쪽으로 반지름 x 루트 2 만큼 밀어 어림한다)
	const count = data.count;
	const pointX = [0, 0, 0, 0, 0, 0, 0, 0];
	const pointY = [0, 0, 0, 0, 0, 0, 0, 0];
	for (let index = 0; index < count; ++index) {
		pointX[index] = data.vertexX[index];
		pointY[index] = data.vertexY[index];
		if (data.radius > 0) {
			const previous = (index + count - 1) % count;
			const middleX = data.normalX[previous] + data.normalX[index];
			const middleY = data.normalY[previous] + data.normalY[index];
			const middleLength = System.Math.sqrt(middleX * middleX + middleY * middleY);
			const pushDistance = System.Math.SQRT2 * data.radius;
			pointX[index] += pushDistance * middleX / middleLength;
			pointY[index] += pushDistance * middleY / middleLength;
		}
	}
	const originX = pointX[0];
	const originY = pointY[0];
	let area = 0;
	let centerX = 0;
	let centerY = 0;
	let rotationalInertia = 0;
	for (let index = 1; index < count - 1; ++index) {
		const edge1X = pointX[index] - originX;
		const edge1Y = pointY[index] - originY;
		const edge2X = pointX[index + 1] - originX;
		const edge2Y = pointY[index + 1] - originY;
		const cross = edge1X * edge2Y - edge1Y * edge2X;
		const triangleArea = 0.5 * cross;
		area += triangleArea;
		centerX += triangleArea * (edge1X + edge2X) / 3;
		centerY += triangleArea * (edge1Y + edge2Y) / 3;
		const integralX = edge1X * edge1X + edge2X * edge1X + edge2X * edge2X;
		const integralY = edge1Y * edge1Y + edge2Y * edge1Y + edge2Y * edge2Y;
		rotationalInertia += (0.25 / 3 * cross) * (integralX + integralY);
	}
	const mass = density * area;
	centerX = centerX / area;
	centerY = centerY / area;
	// 첫 꼭짓점에 대한 관성을 질량 중심으로 옮긴다.
	const inertia = density * rotationalInertia - mass * (centerX * centerX + centerY * centerY);
	return [mass, originX + centerX, originY + centerY, inertia];
}

//==============================================================================
// 모양의 월드 경계 상자를 aabb 에 적기. (안에서 쓴다)
//==============================================================================
/**
 * @param { ShapeData } data
 * @param { number } positionX
 * @param { number } positionY
 * @param { number } cosine
 * @param { number } sine
 * @param { AABB2D } aabb
 */
export function computeShapeAabb(data, positionX, positionY, cosine, sine, aabb) {
	if (data.type === ShapeType2D.circle) {
		const centerX = cosine * data.centerX - sine * data.centerY + positionX;
		const centerY = sine * data.centerX + cosine * data.centerY + positionY;
		aabb.set(centerX - data.radius, centerY - data.radius, centerX + data.radius, centerY + data.radius);
		return;
	}
	let minimumX = System.Number.POSITIVE_INFINITY;
	let minimumY = System.Number.POSITIVE_INFINITY;
	let maximumX = System.Number.NEGATIVE_INFINITY;
	let maximumY = System.Number.NEGATIVE_INFINITY;
	for (let index = 0; index < data.count; ++index) {
		const vertexX = cosine * data.vertexX[index] - sine * data.vertexY[index] + positionX;
		const vertexY = sine * data.vertexX[index] + cosine * data.vertexY[index] + positionY;
		minimumX = System.Math.min(minimumX, vertexX);
		minimumY = System.Math.min(minimumY, vertexY);
		maximumX = System.Math.max(maximumX, vertexX);
		maximumY = System.Math.max(maximumY, vertexY);
	}
	aabb.set(minimumX - data.radius, minimumY - data.radius, maximumX + data.radius, maximumY + data.radius);
}

//==============================================================================
// 몸 질량 중심에서 모양의 가장 먼 거리. (안에서 쓴다, 잠자기 속력에 쓴다)
//==============================================================================
/**
 * @param { ShapeData } data
 * @param { number } localCenterX
 * @param { number } localCenterY
 * @returns { number }
 */
export function computeShapeExtent(data, localCenterX, localCenterY) {
	if (data.type === ShapeType2D.circle) {
		const differenceX = data.centerX - localCenterX;
		const differenceY = data.centerY - localCenterY;
		return System.Math.sqrt(differenceX * differenceX + differenceY * differenceY) + data.radius;
	}
	let maximumDistanceSquared = 0;
	for (let index = 0; index < data.count; ++index) {
		const differenceX = data.vertexX[index] - localCenterX;
		const differenceY = data.vertexY[index] - localCenterY;
		maximumDistanceSquared = System.Math.max(maximumDistanceSquared, differenceX * differenceX + differenceY * differenceY);
	}
	return System.Math.sqrt(maximumDistanceSquared) + data.radius;
}
