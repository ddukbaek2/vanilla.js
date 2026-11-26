//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Object } from "../../base/object.js";


//==============================================================================
// 몸 아이디. (월드의 칸 번호와 세대)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 몸을 없애면 칸은 다시 쓰이지만 세대가 올라가, 옛 아이디로는 새 몸을 찾지 못한다. (Box2D 3 의 b2BodyId 와 같은 꼴)
// - 월드는 몸마다 아이디 객체를 하나만 만들어 돌려주므로 === 로 견줘도 된다. 러스트는 값 비교다.
//==============================================================================
/**
 * @example <caption>몸 아이디로 몸 찾기</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const world = new Experimental.PhysicsWorld2D(new Experimental.WorldDefinition2D(1));
 * const bodyId = world.createBody(new Experimental.BodyDefinition2D());
 * console.log(bodyId.getIndex(), bodyId.getGeneration(), world.getBody(bodyId) !== null);
 * world.destroyBody(bodyId);
 * console.log(world.getBody(bodyId));
 */
export class BodyId2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #index;
	/** @private @type { number } */ #generation;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { number } index 칸 번호.
	 * @param { number } generation 세대.
	 */
	constructor(index, generation) {
		super();
		this.#index = index;
		this.#generation = generation;
	}

	//==============================================================================
	// 칸 번호 반환.
	//==============================================================================
	/**
	 * @returns { number } 칸 번호.
	 */
	getIndex() {
		return this.#index;
	}

	//==============================================================================
	// 세대 반환.
	//==============================================================================
	/**
	 * @returns { number } 세대.
	 */
	getGeneration() {
		return this.#generation;
	}

	//==============================================================================
	// 같은 아이디인지.
	//==============================================================================
	/**
	 * @param { BodyId2D } other 견줄 아이디.
	 * @returns { boolean } 칸 번호와 세대가 같으면 참.
	 */
	equals(other) {
		if (!(other instanceof BodyId2D)) {
			return false;
		}
		const otherIndex = other.getIndex();
		const otherGeneration = other.getGeneration();
		return this.getIndex() === otherIndex && this.getGeneration() === otherGeneration;
	}
}


//==============================================================================
// 모양 아이디. (월드의 칸 번호와 세대)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
//==============================================================================
/**
 * @example <caption>모양 아이디로 모양 찾기</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const world = new Experimental.PhysicsWorld2D(new Experimental.WorldDefinition2D(1));
 * const bodyId = world.createBody(new Experimental.BodyDefinition2D());
 * const shapeId = world.createShape(bodyId, new Experimental.ShapeDefinition2D(), Experimental.Polygon2D.makeBox(1, 1));
 * console.log(shapeId.getIndex(), world.getShape(shapeId).getBodyId() === bodyId);
 */
export class ShapeId2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #index;
	/** @private @type { number } */ #generation;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { number } index 칸 번호.
	 * @param { number } generation 세대.
	 */
	constructor(index, generation) {
		super();
		this.#index = index;
		this.#generation = generation;
	}

	//==============================================================================
	// 칸 번호 반환.
	//==============================================================================
	/**
	 * @returns { number } 칸 번호.
	 */
	getIndex() {
		return this.#index;
	}

	//==============================================================================
	// 세대 반환.
	//==============================================================================
	/**
	 * @returns { number } 세대.
	 */
	getGeneration() {
		return this.#generation;
	}

	//==============================================================================
	// 같은 아이디인지.
	//==============================================================================
	/**
	 * @param { ShapeId2D } other 견줄 아이디.
	 * @returns { boolean } 칸 번호와 세대가 같으면 참.
	 */
	equals(other) {
		if (!(other instanceof ShapeId2D)) {
			return false;
		}
		const otherIndex = other.getIndex();
		const otherGeneration = other.getGeneration();
		return this.getIndex() === otherIndex && this.getGeneration() === otherGeneration;
	}
}


//==============================================================================
// 관절 아이디. (월드의 칸 번호와 세대)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
//==============================================================================
/**
 * @example <caption>관절 아이디로 관절 찾기</caption>
 * import { Vector2 } from "./import.js";
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const world = new Experimental.PhysicsWorld2D(new Experimental.WorldDefinition2D(1));
 * const groundId = world.createBody(new Experimental.BodyDefinition2D());
 * const bodyDefinition = new Experimental.BodyDefinition2D();
 * bodyDefinition.type = Experimental.BodyType2D.dynamic;
 * const bodyId = world.createBody(bodyDefinition);
 * const jointDefinition = new Experimental.RevoluteJointDefinition2D();
 * jointDefinition.bodyIdA = groundId;
 * jointDefinition.bodyIdB = bodyId;
 * const jointId = world.createRevoluteJoint(jointDefinition);
 * console.log(jointId.getIndex(), world.getJoint(jointId).getType() === Experimental.JointType2D.revolute);
 */
export class JointId2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #index;
	/** @private @type { number } */ #generation;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { number } index 칸 번호.
	 * @param { number } generation 세대.
	 */
	constructor(index, generation) {
		super();
		this.#index = index;
		this.#generation = generation;
	}

	//==============================================================================
	// 칸 번호 반환.
	//==============================================================================
	/**
	 * @returns { number } 칸 번호.
	 */
	getIndex() {
		return this.#index;
	}

	//==============================================================================
	// 세대 반환.
	//==============================================================================
	/**
	 * @returns { number } 세대.
	 */
	getGeneration() {
		return this.#generation;
	}

	//==============================================================================
	// 같은 아이디인지.
	//==============================================================================
	/**
	 * @param { JointId2D } other 견줄 아이디.
	 * @returns { boolean } 칸 번호와 세대가 같으면 참.
	 */
	equals(other) {
		if (!(other instanceof JointId2D)) {
			return false;
		}
		const otherIndex = other.getIndex();
		const otherGeneration = other.getGeneration();
		return this.getIndex() === otherIndex && this.getGeneration() === otherGeneration;
	}
}
