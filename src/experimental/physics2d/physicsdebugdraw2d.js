//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";
import { Vector2 } from "../../base/vector2.js";
import { Color } from "../../base/color.js";
import { Graphic } from "../../core/graphic.js";
import { ShapeType2D } from "./geometry2d.js";
import { BodyType2D } from "./body2d.js";
import { WorldShape, fillWorldShape } from "./narrowphase2d.js";
import { PhysicsWorld2D } from "./physicsworld2d.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 둥근 모서리 하나를 나누는 조각 수.
const CORNER_SEGMENT_COUNT = 6;
// 몸 상태별 색. (정적, 운동학, 깨어 있는 동적, 잠든 동적, 센서, 관절)
const STATIC_COLOR = new Color(0.50, 0.75, 0.50, 1.0);
const KINEMATIC_COLOR = new Color(0.50, 0.62, 0.90, 1.0);
const DYNAMIC_COLOR = new Color(0.90, 0.70, 0.30, 1.0);
const SLEEPING_COLOR = new Color(0.55, 0.55, 0.60, 1.0);
const SENSOR_COLOR = new Color(0.30, 0.80, 0.90, 1.0);
const JOINT_COLOR = new Color(0.85, 0.85, 0.85, 1.0);
// 채우기는 선 색을 이만큼 옅게.
const FILL_ALPHA = 0.45;


//==============================================================================
// 2D 물리 그리기 도구. (확인용 선과 면)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 모양을 몸 상태 색으로 칠하고(정적 초록, 운동학 파랑, 동적 주황, 잠든 몸 회색, 센서 하늘색), 원은 돌림을 보이는 반지름 선을, 관절은 두 닻을 잇는 선을 긋는다.
// - 월드 좌표를 그대로 그리므로 그래픽의 좌표계가 월드와 같아야 한다. (화소 단위 월드면 씬의 draw 에서 바로 부른다)
//==============================================================================
/**
 * @example <caption>씬에서 월드 그리기</caption>
 * import { Engine, EngineConfiguration, Scene, Vector2 } from "./import.js";
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const world = new Experimental.PhysicsWorld2D(new Experimental.WorldDefinition2D(50));
 * const groundId = world.createBody(new Experimental.BodyDefinition2D());
 * world.createShape(groundId, new Experimental.ShapeDefinition2D(), Experimental.Segment2D.create(Vector2.create(40, 600), Vector2.create(1240, 600)));
 * const ballDefinition = new Experimental.BodyDefinition2D();
 * ballDefinition.type = Experimental.BodyType2D.dynamic;
 * ballDefinition.position = Vector2.create(640, 100);
 * const ballId = world.createBody(ballDefinition);
 * world.createShape(ballId, new Experimental.ShapeDefinition2D(), Experimental.Circle2D.create(Vector2.zero(), 30));
 *
 * class MainScene extends Scene {
 * 	tick(timeDelta) {
 * 		world.advance(timeDelta);
 * 		super.tick(timeDelta);
 * 	}
 *
 * 	draw(graphic) {
 * 		super.draw(graphic);
 * 		Experimental.PhysicsDebugDraw2D.draw(world, graphic, 2);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
export class PhysicsDebugDraw2D extends Object {
	//==============================================================================
	// 월드 그리기. (정적)
	//==============================================================================
	/**
	 * @param { PhysicsWorld2D } world 그릴 월드.
	 * @param { Graphic } graphic 그릴 그래픽.
	 * @param { number } lineWidth 선 굵기. (그래픽 좌표 단위)
	 */
	static draw(world, graphic, lineWidth) {
		const state = world.getState();
		const worldShape = new WorldShape();
		for (const bodyData of state.bodyDataList) {
			if (bodyData === null) {
				continue;
			}
			let bodyColor = DYNAMIC_COLOR;
			if (bodyData.type === BodyType2D.static) {
				bodyColor = STATIC_COLOR;
			}
			else if (bodyData.type === BodyType2D.kinematic) {
				bodyColor = KINEMATIC_COLOR;
			}
			else if (!bodyData.isAwake) {
				bodyColor = SLEEPING_COLOR;
			}
			for (const shapeId of bodyData.shapeIdList) {
				const shapeData = state.shapeDataList[shapeId.getIndex()];
				const lineColor = shapeData.isSensor ? SENSOR_COLOR : bodyColor;
				const fillColor = new Color(lineColor.red, lineColor.green, lineColor.blue, FILL_ALPHA);
				fillWorldShape(shapeData, bodyData.positionX, bodyData.positionY, bodyData.rotationCosine, bodyData.rotationSine, worldShape);
				PhysicsDebugDraw2D.drawWorldShape(graphic, worldShape, bodyData, fillColor, lineColor, lineWidth);
			}
		}
		graphic.setStrokeColor(JOINT_COLOR);
		for (const jointData of state.jointDataList) {
			if (jointData === null) {
				continue;
			}
			const bodyA = state.bodyDataList[jointData.bodyIndexA];
			const bodyB = state.bodyDataList[jointData.bodyIndexB];
			const anchorA = Vector2.create(bodyA.rotationCosine * jointData.localAnchorAX - bodyA.rotationSine * jointData.localAnchorAY + bodyA.positionX, bodyA.rotationSine * jointData.localAnchorAX + bodyA.rotationCosine * jointData.localAnchorAY + bodyA.positionY);
			const anchorB = Vector2.create(bodyB.rotationCosine * jointData.localAnchorBX - bodyB.rotationSine * jointData.localAnchorBY + bodyB.positionX, bodyB.rotationSine * jointData.localAnchorBX + bodyB.rotationCosine * jointData.localAnchorBY + bodyB.positionY);
			graphic.drawLine([anchorA, anchorB], lineWidth);
			graphic.setFillColor(JOINT_COLOR);
			graphic.drawCircle(anchorA, lineWidth * 1.5);
			graphic.drawCircle(anchorB, lineWidth * 1.5);
		}
	}

	//==============================================================================
	// 월드 모양 하나 그리기. (정적, 안에서 쓴다)
	//==============================================================================
	/**
	 * @private
	 * @param { Graphic } graphic
	 * @param { WorldShape } worldShape
	 * @param { object } bodyData
	 * @param { Color } fillColor
	 * @param { Color } lineColor
	 * @param { number } lineWidth
	 */
	static drawWorldShape(graphic, worldShape, bodyData, fillColor, lineColor, lineWidth) {
		graphic.setStrokeColor(lineColor);
		if (worldShape.type === ShapeType2D.circle) {
			const center = Vector2.create(worldShape.centerX, worldShape.centerY);
			graphic.setFillColor(fillColor);
			graphic.drawCircle(center, worldShape.radius);
			graphic.drawStrokeCircle(center, worldShape.radius, lineWidth);
			const edge = Vector2.create(worldShape.centerX + bodyData.rotationCosine * worldShape.radius, worldShape.centerY + bodyData.rotationSine * worldShape.radius);
			graphic.drawLine([center, edge], lineWidth);
			return;
		}
		if (worldShape.type === ShapeType2D.segment) {
			const point1 = Vector2.create(worldShape.vertexX[0], worldShape.vertexY[0]);
			const point2 = Vector2.create(worldShape.vertexX[1], worldShape.vertexY[1]);
			graphic.drawLine([point1, point2], lineWidth);
			return;
		}
		const positions = [];
		if (worldShape.radius <= 0) {
			for (let index = 0; index < worldShape.count; ++index) {
				positions.push(Vector2.create(worldShape.vertexX[index], worldShape.vertexY[index]));
			}
		}
		else {
			// 둥근 모서리. (꼭짓점마다 앞 변 법선에서 다음 변 법선까지 호)
			for (let index = 0; index < worldShape.count; ++index) {
				const previous = (index + worldShape.count - 1) % worldShape.count;
				const startAngle = System.Math.atan2(worldShape.normalY[previous], worldShape.normalX[previous]);
				let sweepAngle = System.Math.atan2(worldShape.normalY[index], worldShape.normalX[index]) - startAngle;
				while (sweepAngle < 0) {
					sweepAngle += 2 * System.Math.PI;
				}
				for (let segmentIndex = 0; segmentIndex <= CORNER_SEGMENT_COUNT; ++segmentIndex) {
					const angle = startAngle + sweepAngle * segmentIndex / CORNER_SEGMENT_COUNT;
					positions.push(Vector2.create(worldShape.vertexX[index] + worldShape.radius * System.Math.cos(angle), worldShape.vertexY[index] + worldShape.radius * System.Math.sin(angle)));
				}
			}
		}
		graphic.drawConvexPolygon(positions, fillColor);
		graphic.drawLineLoop(positions, lineWidth);
	}
}
