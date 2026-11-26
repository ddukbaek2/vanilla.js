//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Component } from "../../core/component.js";
import { Vector2 } from "../../base/vector2.js";
import { BodyId2D } from "./physicsid2d.js";
import { Body2D } from "./body2d.js";
import { PhysicsWorld2D } from "./physicsworld2d.js";


//==============================================================================
// 강체 컴포넌트. (노드를 2D 물리 몸에 잇는다)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - setBody(world, bodyId) 로 월드의 몸 하나를 맡으면, tick 마다 몸의 자리와 돌림을 노드의 로컬 자리와 돌림(도)에 넣는다. (유니티 Rigidbody2D 가 Transform 을 움직이는 것과 같다)
//   몸이 노드를 움직이고 노드가 몸을 움직이지는 않는다. 노드를 옮기려면 getBody().setTransform 을 부른다.
// - 월드 좌표가 노드 부모의 좌표와 같다고 본다. 물리 노드들은 월드 공간 하나를 맡은 부모 아래에 둔다.
// - 보간을 켜면(기본) 월드의 지난 advance 몫으로 앞 걸음과 지금 걸음 사이를 섞어, 걸음이 화면 주사율과 어긋나 떨리지 않는다.
// - 월드는 씬이 들고 씬의 tick 에서 노드보다 먼저 advance 한다. 몸과 모양은 월드의 것이라 컴포넌트를 떼어도 남는다.
//==============================================================================
/**
 * @example <caption>떨어지는 상자 노드</caption>
 * import { Engine, EngineConfiguration, Scene, WorldNode, Paint, Vector2, Pivot } from "./import.js";
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const world = new Experimental.PhysicsWorld2D(new Experimental.WorldDefinition2D(50));
 * const groundId = world.createBody(new Experimental.BodyDefinition2D());
 * world.createShape(groundId, new Experimental.ShapeDefinition2D(), Experimental.Segment2D.create(Vector2.create(0, 600), Vector2.create(1280, 600)));
 *
 * class MainScene extends Scene {
 * 	initialize(engine) {
 * 		super.initialize(engine);
 * 		const bodyDefinition = new Experimental.BodyDefinition2D();
 * 		bodyDefinition.type = Experimental.BodyType2D.dynamic;
 * 		bodyDefinition.position = Vector2.create(640, 100);
 * 		bodyDefinition.angle = 0.4;
 * 		const bodyId = world.createBody(bodyDefinition);
 * 		world.createShape(bodyId, new Experimental.ShapeDefinition2D(), Experimental.Polygon2D.makeBox(40, 40));
 * 		const boxNode = new WorldNode();
 * 		boxNode.setPivot(Pivot.middleCenter);
 * 		boxNode.setContentSize(Vector2.create(80, 80));
 * 		const paint = boxNode.addComponent(Paint);
 * 		paint.setColor("#e6b34d");
 * 		const rigidBody = boxNode.addComponent(Experimental.RigidBody2D);
 * 		rigidBody.setBody(world, bodyId);
 * 		const root = this.getRoot();
 * 		root.addChild(boxNode);
 * 	}
 *
 * 	tick(timeDelta) {
 * 		world.advance(timeDelta);
 * 		super.tick(timeDelta);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
export class RigidBody2D extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { PhysicsWorld2D | null } */ #world;
	/** @private @type { BodyId2D | null } */ #bodyId;
	/** @private @type { boolean } */ #isInterpolationEnabled;

	//==============================================================================
	// 생성. (맡은 몸 없음, 보간 켬)
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.setComponentType("RigidBody2D");
		this.#world = null;
		this.#bodyId = null;
		this.#isInterpolationEnabled = true;
	}

	//==============================================================================
	// 맡을 몸 설정. (바로 노드를 몸 자리에 둔다)
	//==============================================================================
	/**
	 * @param { PhysicsWorld2D } world 몸이 든 월드.
	 * @param { BodyId2D } bodyId 맡을 몸.
	 */
	setBody(world, bodyId) {
		this.#world = world;
		this.#bodyId = bodyId;
		this.synchronizeNode(1);
	}

	//==============================================================================
	// 월드 반환.
	//==============================================================================
	/**
	 * @returns { PhysicsWorld2D | null } 몸이 든 월드.
	 */
	getWorld() {
		return this.#world;
	}

	//==============================================================================
	// 몸 아이디 반환.
	//==============================================================================
	/**
	 * @returns { BodyId2D | null } 맡은 몸.
	 */
	getBodyId() {
		return this.#bodyId;
	}

	//==============================================================================
	// 몸 반환.
	//==============================================================================
	/**
	 * @returns { Body2D | null } 맡은 몸. (없거나 없어졌으면 null)
	 */
	getBody() {
		const world = this.getWorld();
		const bodyId = this.getBodyId();
		if (world === null || bodyId === null) {
			return null;
		}
		return world.getBody(bodyId);
	}

	//==============================================================================
	// 보간을 쓸지 설정.
	//==============================================================================
	/**
	 * @param { boolean } isInterpolationEnabled 보간을 쓸지.
	 */
	setInterpolationEnabled(isInterpolationEnabled) {
		this.#isInterpolationEnabled = isInterpolationEnabled;
	}

	//==============================================================================
	// 보간을 쓰는지.
	//==============================================================================
	/**
	 * @returns { boolean } 보간을 쓰면 참.
	 */
	isInterpolationEnabled() {
		return this.#isInterpolationEnabled;
	}

	//==============================================================================
	// 갱신. (몸의 자리와 돌림을 노드에 넣는다)
	//==============================================================================
	/**
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 */
	tick(timeDelta) {
		const world = this.getWorld();
		if (world === null) {
			return;
		}
		const isInterpolationEnabled = this.isInterpolationEnabled();
		const alpha = isInterpolationEnabled ? world.getInterpolationAlpha() : 1;
		this.synchronizeNode(alpha);
	}

	//==============================================================================
	// 노드를 몸 자리에 두기. (alpha 는 보간 몫)
	//==============================================================================
	/**
	 * @param { number } alpha 앞 걸음과 지금 걸음 사이 몫. (1 이면 지금 걸음)
	 */
	synchronizeNode(alpha) {
		const node = this.getNode();
		const body = this.getBody();
		if (node === null || body === null) {
			return;
		}
		const position = body.getInterpolatedPosition(alpha);
		const angle = body.getInterpolatedAngle(alpha);
		node.setLocalPosition(Vector2.create(position.x, position.y));
		node.setLocalRotation(angle * 180 / System.Math.PI);
	}
}
