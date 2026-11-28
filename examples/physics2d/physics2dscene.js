//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Scene, WorldNode, Paint, Pivot, Vector2, Color, Rect } from "../../import.js";
import * as Experimental from "../../src/experimental/experimental.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 화면 크기. (기준 해상도)
const VIEW_WIDTH = 1280;
const VIEW_HEIGHT = 720;
// 1 미터의 화소 수.
const PIXELS_PER_METER = 50;
// 한 걸음의 시간과 하위 걸음 수. (프레임마다 한 걸음, 두 엔진의 같은 프레임이 같은 걸음이 되게)
const STEP_SECONDS = 1 / 60;
const SUB_STEP_COUNT = 4;
// 운동학 발판이 방향을 바꾸는 걸음 수.
const PLATFORM_TURN_STEPS = 120;
// 광선.
const RAY_ORIGIN = Vector2.create(40, 250);
const RAY_TRANSLATION = Vector2.create(600, 360);
// 센서 칸.
const SENSOR_CENTER = Vector2.create(1130, 640);
const SENSOR_HALF_SIZE = Vector2.create(40, 40);
// 색.
const BACKGROUND_COLOR = new Color(0.106, 0.122, 0.165, 1);
const RAY_COLOR = new Color(1.0, 0.42, 0.38, 1);
const SENSOR_ACTIVE_COLOR = new Color(0.30, 0.80, 0.90, 0.35);
const NODE_BOX_COLOR = new Color(1.0, 0.44, 0.38, 1);


//==============================================================================
// 2D 물리 초안 견주기 씬. (러스트 예제 physics2d 와 같은 장면)
// - 상자 피라미드, 회전 관절 다리, 거리 관절 진자, 바퀴 관절 수레, 용접 다이빙대, 튀는 공, 캡슐, 둥근 육각형,
//   운동학 발판, 센서 칸(안에 무언가 있으면 칠한다), 광선(맞은 점과 법선), RigidBody2D 컴포넌트로 움직이는 Paint 노드.
// - 프레임마다 한 걸음(1/60 초, 하위 걸음 4)을 돈다. prestepCount 를 주면 처음에 그만큼 돌고 멈춘다. (두 엔진의 찍은 화면을 견줄 때)
//==============================================================================
export class Physics2DScene extends Scene {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Experimental.PhysicsWorld2D } */ #world;
	/** @private @type { object } */ #platformId;
	/** @private @type { number } */ #stepCount;
	/** @private @type { number } */ #sensorVisitorCount;
	/** @private @type { number } */ #prestepCount;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { number } prestepCount 처음에 돌고 멈출 걸음 수. (0 이면 멈추지 않는다)
	 */
	constructor(prestepCount) {
		super();
		this.#world = null;
		this.#platformId = null;
		this.#stepCount = 0;
		this.#sensorVisitorCount = 0;
		this.#prestepCount = prestepCount;
	}

	//==============================================================================
	// 월드 반환.
	//==============================================================================
	/**
	 * @returns { Experimental.PhysicsWorld2D }
	 */
	getWorld() {
		return this.#world;
	}

	//==============================================================================
	// 동적 몸 하나 만들기.
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @param { number } angle
	 * @returns { object }
	 */
	createDynamicBody(x, y, angle) {
		const world = this.getWorld();
		const bodyDefinition = new Experimental.BodyDefinition2D();
		bodyDefinition.type = Experimental.BodyType2D.dynamic;
		bodyDefinition.position = Vector2.create(x, y);
		bodyDefinition.angle = angle;
		return world.createBody(bodyDefinition);
	}

	//==============================================================================
	// 초기화. (월드와 노드)
	//==============================================================================
	/**
	 * @param { object } engine
	 */
	initialize(engine) {
		super.initialize(engine);
		const root = this.getRoot();
		root.setContentSize(Vector2.create(VIEW_WIDTH, VIEW_HEIGHT));
		this.#world = new Experimental.PhysicsWorld2D(new Experimental.WorldDefinition2D(PIXELS_PER_METER));
		const world = this.getWorld();
		const shapeDefinition = new Experimental.ShapeDefinition2D();

		// 땅, 왼쪽 비탈, 오른쪽 벽.
		const groundId = world.createBody(new Experimental.BodyDefinition2D());
		world.createShape(groundId, shapeDefinition, Experimental.Segment2D.create(Vector2.create(40, 680), Vector2.create(1240, 680)));
		world.createShape(groundId, shapeDefinition, Experimental.Segment2D.create(Vector2.create(1240, 680), Vector2.create(1240, 300)));
		const chainDefinition = new Experimental.ChainDefinition2D();
		chainDefinition.points = [Vector2.create(40, 420), Vector2.create(120, 560), Vector2.create(240, 680)];
		world.createChain(groundId, chainDefinition);

		// 상자 피라미드.
		const rowCount = 6;
		for (let row = 0; row < rowCount; ++row) {
			for (let column = 0; column < rowCount - row; ++column) {
				const x = 460 + (column - (rowCount - row - 1) * 0.5) * 34;
				const y = 663 - row * 34;
				const bodyId = this.createDynamicBody(x, y, 0);
				world.createShape(bodyId, shapeDefinition, Experimental.Polygon2D.makeBox(16, 16));
			}
		}

		// 회전 관절 다리.
		const plankCount = 10;
		let previousId = groundId;
		for (let index = 0; index < plankCount; ++index) {
			const plankId = this.createDynamicBody(613 + index * 26, 460, 0);
			world.createShape(plankId, shapeDefinition, Experimental.Polygon2D.makeBox(13, 3));
			const jointDefinition = new Experimental.RevoluteJointDefinition2D();
			jointDefinition.bodyIdA = previousId;
			jointDefinition.bodyIdB = plankId;
			jointDefinition.localAnchorA = previousId === groundId ? Vector2.create(600, 460) : Vector2.create(13, 0);
			jointDefinition.localAnchorB = Vector2.create(-13, 0);
			world.createRevoluteJoint(jointDefinition);
			previousId = plankId;
		}
		const lastJointDefinition = new Experimental.RevoluteJointDefinition2D();
		lastJointDefinition.bodyIdA = previousId;
		lastJointDefinition.bodyIdB = groundId;
		lastJointDefinition.localAnchorA = Vector2.create(13, 0);
		lastJointDefinition.localAnchorB = Vector2.create(860, 460);
		world.createRevoluteJoint(lastJointDefinition);

		// 다리에 떨어지는 공.
		const ballDefinition = new Experimental.ShapeDefinition2D();
		ballDefinition.restitution = 0.5;
		for (let index = 0; index < 6; ++index) {
			const bodyId = this.createDynamicBody(650 + index * 30, 200 + (index % 3) * 40, 0);
			world.createShape(bodyId, ballDefinition, Experimental.Circle2D.create(Vector2.zero(), 10));
		}

		// 캡슐과 둥근 육각형.
		for (let index = 0; index < 2; ++index) {
			const bodyId = this.createDynamicBody(450 + index * 30, 300 - index * 40, 0.4 * index);
			world.createShape(bodyId, shapeDefinition, Experimental.Capsule2D.create(Vector2.create(-14, 0), Vector2.create(14, 0), 8));
		}
		const hexagonPointList = [];
		for (let index = 0; index < 6; ++index) {
			const rotation = Experimental.PhysicsMath2D.computeRotation(index * System.Math.PI / 3);
			hexagonPointList.push(Vector2.create(16 * rotation.cosine, 16 * rotation.sine));
		}
		const hexagonId = this.createDynamicBody(520, 200, 0.2);
		world.createShape(hexagonId, shapeDefinition, Experimental.Polygon2D.makePolygon(hexagonPointList, 3));

		// 거리 관절 진자.
		const bobId = this.createDynamicBody(420, 120, 0);
		world.createShape(bobId, shapeDefinition, Experimental.Circle2D.create(Vector2.zero(), 14));
		const pendulumDefinition = new Experimental.DistanceJointDefinition2D();
		pendulumDefinition.bodyIdA = groundId;
		pendulumDefinition.bodyIdB = bobId;
		pendulumDefinition.localAnchorA = Vector2.create(300, 120);
		pendulumDefinition.length = 120;
		world.createDistanceJoint(pendulumDefinition);

		// 바퀴 관절 수레.
		const chassisId = this.createDynamicBody(1000, 630, 0);
		world.createShape(chassisId, shapeDefinition, Experimental.Polygon2D.makeBox(40, 10));
		for (let index = 0; index < 2; ++index) {
			const offsetX = index === 0 ? -28 : 28;
			const wheelId = this.createDynamicBody(1000 + offsetX, 652, 0);
			world.createShape(wheelId, shapeDefinition, Experimental.Circle2D.create(Vector2.zero(), 14));
			const wheelDefinition = new Experimental.WheelJointDefinition2D();
			wheelDefinition.bodyIdA = chassisId;
			wheelDefinition.bodyIdB = wheelId;
			wheelDefinition.localAnchorA = Vector2.create(offsetX, 22);
			wheelDefinition.hertz = 4;
			wheelDefinition.dampingRatio = 0.7;
			wheelDefinition.enableMotor = true;
			wheelDefinition.motorSpeed = 6;
			wheelDefinition.maxMotorTorque = 2000000;
			world.createWheelJoint(wheelDefinition);
		}

		// 용접 다이빙대와 그 위에 떨어지는 공.
		const boardId = this.createDynamicBody(1190, 300, 0);
		world.createShape(boardId, shapeDefinition, Experimental.Polygon2D.makeBox(50, 5));
		const weldDefinition = new Experimental.WeldJointDefinition2D();
		weldDefinition.bodyIdA = groundId;
		weldDefinition.bodyIdB = boardId;
		weldDefinition.localAnchorA = Vector2.create(1240, 300);
		weldDefinition.localAnchorB = Vector2.create(50, 0);
		weldDefinition.angularHertz = 4;
		weldDefinition.angularDampingRatio = 0.3;
		world.createWeldJoint(weldDefinition);
		const diverId = this.createDynamicBody(1160, 160, 0);
		world.createShape(diverId, ballDefinition, Experimental.Circle2D.create(Vector2.zero(), 12));

		// 센서 칸.
		const sensorBodyId = world.createBody(new Experimental.BodyDefinition2D());
		const sensorDefinition = new Experimental.ShapeDefinition2D();
		sensorDefinition.isSensor = true;
		world.createShape(sensorBodyId, sensorDefinition, Experimental.Polygon2D.makeOffsetBox(SENSOR_HALF_SIZE.x, SENSOR_HALF_SIZE.y, SENSOR_CENTER, 0));

		// 운동학 발판과 그 위의 상자.
		const platformDefinition = new Experimental.BodyDefinition2D();
		platformDefinition.type = Experimental.BodyType2D.kinematic;
		platformDefinition.position = Vector2.create(1000, 360);
		platformDefinition.linearVelocity = Vector2.create(80, 0);
		this.#platformId = world.createBody(platformDefinition);
		world.createShape(this.#platformId, shapeDefinition, Experimental.Polygon2D.makeBox(50, 6));
		const riderId = this.createDynamicBody(1000, 340, 0);
		world.createShape(riderId, shapeDefinition, Experimental.Polygon2D.makeBox(12, 12));

		// RigidBody2D 로 움직일 몸.
		const nodeBodyId = this.createDynamicBody(180, 300, 0.3);
		world.createShape(nodeBodyId, shapeDefinition, Experimental.Polygon2D.makeBox(20, 20));

		for (let index = 0; index < this.#prestepCount; ++index) {
			this.stepWorld();
		}

		// RigidBody2D 로 움직이는 Paint 노드. (붙일 때 몸 자리에 놓인다)
		const boxNode = new WorldNode();
		boxNode.setPivot(Pivot.middleCenter);
		boxNode.setContentSize(Vector2.create(40, 40));
		const paint = boxNode.addComponent(Paint);
		paint.setColor(NODE_BOX_COLOR);
		const rigidBody = boxNode.addComponent(Experimental.RigidBody2D);
		rigidBody.setBody(world, nodeBodyId);
		root.addChild(boxNode);
	}

	//==============================================================================
	// 한 걸음. (발판 방향 바꾸기, 센서 안의 수 세기)
	//==============================================================================
	stepWorld() {
		const world = this.getWorld();
		if (this.#stepCount > 0 && this.#stepCount % PLATFORM_TURN_STEPS === 0) {
			const platform = world.getBody(this.#platformId);
			const velocity = platform.getLinearVelocity();
			platform.setLinearVelocity(Vector2.create(-velocity.x, 0));
		}
		world.step(STEP_SECONDS, SUB_STEP_COUNT);
		const sensorBeginEvents = world.getSensorBeginEvents();
		const sensorEndEvents = world.getSensorEndEvents();
		this.#sensorVisitorCount += sensorBeginEvents.length - sensorEndEvents.length;
		this.#stepCount += 1;
	}

	//==============================================================================
	// 갱신. (멈추지 않았으면 프레임마다 한 걸음)
	//==============================================================================
	/**
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		if (this.#prestepCount === 0) {
			this.stepWorld();
		}
		super.tick(timeDelta);
	}

	//==============================================================================
	// 이전 출력. (배경)
	//==============================================================================
	/**
	 * @param { object } graphic
	 */
	preDraw(graphic) {
		super.preDraw(graphic);
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		const canvasNativeSize = viewManager.getCanvasNativeSize();
		viewManager.applyCanvasNativeRect(graphic);
		graphic.setFillColor(BACKGROUND_COLOR);
		graphic.drawRect(Rect.create(0, 0, canvasNativeSize.x, canvasNativeSize.y));
		viewManager.applyViewRect(graphic);
	}

	//==============================================================================
	// 출력. (센서 칸, 물리 모양, 광선, 노드)
	//==============================================================================
	/**
	 * @param { object } graphic
	 */
	draw(graphic) {
		const world = this.getWorld();
		if (this.#sensorVisitorCount > 0) {
			graphic.setFillColor(SENSOR_ACTIVE_COLOR);
			graphic.drawRect(Rect.create(SENSOR_CENTER.x - SENSOR_HALF_SIZE.x, SENSOR_CENTER.y - SENSOR_HALF_SIZE.y, SENSOR_HALF_SIZE.x * 2, SENSOR_HALF_SIZE.y * 2));
		}
		Experimental.PhysicsDebugDraw2D.draw(world, graphic, 2);

		// 광선. (맞은 점까지 선, 맞은 점의 원, 법선)
		const queryFilter = new Experimental.QueryFilter2D();
		const hit = world.castRayClosest(RAY_ORIGIN, RAY_TRANSLATION, queryFilter);
		graphic.setStrokeColor(RAY_COLOR);
		graphic.setFillColor(RAY_COLOR);
		if (hit === null) {
			const end = Vector2.create(RAY_ORIGIN.x + RAY_TRANSLATION.x, RAY_ORIGIN.y + RAY_TRANSLATION.y);
			graphic.drawLine([RAY_ORIGIN, end], 2);
		}
		else {
			graphic.drawLine([RAY_ORIGIN, hit.point], 2);
			graphic.drawCircle(hit.point, 5);
			const normalEnd = Vector2.create(hit.point.x + hit.normal.x * 24, hit.point.y + hit.normal.y * 24);
			graphic.drawLine([hit.point, normalEnd], 2);
		}
		super.draw(graphic);
	}
}
