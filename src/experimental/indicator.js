//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Graphic } from "../core/graphic.js";


//==============================================================================
// 인디케이터 클래스.
//==============================================================================
/**
 * @example <caption>씬 위에 도는 톱니 그리기</caption>
 * import { Engine, EngineConfiguration, Scene, Indicator, Vector2 } from "./build/vanilla.js";
 *
 * const indicator = new Indicator();
 * indicator.setPosition(640, 360);
 * indicator.setRadius(32);
 * indicator.setColor("#ffd34dff");
 * indicator.setSpeed(Math.PI);
 *
 * class IndicatorScene extends Scene {
 * 	tick(timeDelta) {
 * 		super.tick(timeDelta);
 * 		indicator.tick(timeDelta);
 * 	}
 *
 * 	draw(graphic) {
 * 		super.draw(graphic);
 * 		indicator.draw(graphic);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
 * const engine = new Engine(engineConfiguration);
 * engine.run(new IndicatorScene());
 */
export class Indicator extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Vector2 } */ #position; // 화면 상의 출력 위치.
	/** @private @type { number } */ #radius; // 톱니바퀴의 기본 반지름.
	/** @private @type { string } */ #color; // 톱니바퀴 색상.
	/** @private @type { number } */ #rotation; // 현재 회전 각도 (라디안).
	/** @private @type { number } */ #speed; // 회전 속도 (라디안/초).
	/** @private @type { boolean } */ #isVisible; // 화면 출력 여부.

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.#position = Vector2.zero();
		this.#radius = 20;
		this.#color = "#ffffff"; // 기본: 흰색
		this.#rotation = 0;
		this.#speed = Math.PI * 1.5; // 초당 약 0.75바퀴 회전
		this.#isVisible = true;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초, 숨겨져 있으면 돌지 않는다)
	 */
	tick(timeDelta) {
		if (!this.getVisible()) {
			return;
		}
		
		// 시간에 따라 회전 각도 누적
		this.#rotation += this.#speed * timeDelta;
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Graphic } graphic 그릴 그래픽. (숨겨져 있으면 그리지 않는다)
	 */
	draw(graphic) {
		if (!this.getVisible()) {
			return;
		}

		graphic.pushState();
		// 1. 지정된 위치로 이동 후 회전 적용
		const position = this.getPosition();
		graphic.translate(position.x, position.y);
		graphic.rotate(this.#rotation);

		// 2. 그리기 설정
		// (Graphic 의 선은 끝이 각지다. Canvas2D 시절의 둥근 끝(lineCap round)은 없다)
		graphic.setFillColor(this.#color);
		graphic.setStrokeColor(this.#color);
		const teethLineWidth = this.#radius * 0.2;
		const innerRadius = this.#radius * 0.5; // 안쪽 구멍 크기

		// 3. 톱니(Teeth) 그리기 (중심에서 바깥으로 뻗어나가는 선)
		const teethSegments = this.buildTeethSegments();
		for (const teethSegment of teethSegments) {
			graphic.drawLine(teethSegment, teethLineWidth);
		}

		// 4. 안쪽 링(Ring) 그리기 (도넛 모양)
		// 가운데 구멍 뚫기 위해 이전 방식 대신 stroke 두껍게 칠하기
		const center = Vector2.zero();
		graphic.drawStrokeCircle(center, innerRadius, this.#radius * 0.3);

		graphic.popState();
	}
	
	//==============================================================================
	// 톱니 선분 목록 반환. (회전 전 중심 기준, [시작, 끝] 의 목록)
	//==============================================================================
	/**
	 * @returns { Vector2[][] } 톱니 8 개의 [시작, 끝] 선분 목록.
	 */
	buildTeethSegments() {
		const teethCount = 8; // 톱니 개수
		const innerRadius = this.#radius * 0.5; // 안쪽 구멍 크기
		const outerRadius = this.#radius; // 바깥쪽 톱니 끝 크기
		const teethSegments = [];
		for (let i = 0; i < teethCount; i++) {
			const angle = (i / teethCount) * System.Math.PI * 2;
			const cosA = System.Math.cos(angle);
			const sinA = System.Math.sin(angle);

			// 안쪽 링보다 살짝 안쪽에서 시작해서 바깥으로 뻗음
			const startPosition = Vector2.create(cosA * (innerRadius * 0.8), sinA * (innerRadius * 0.8));
			const endPosition = Vector2.create(cosA * outerRadius, sinA * outerRadius);
			teethSegments.push([startPosition, endPosition]);
		}
		return teethSegments;
	}

	//==============================================================================
	// 위치 설정.
	//==============================================================================
	/**
	 * 인디케이터가 표시될 중심 좌표를 설정합니다.
	 * @param { number } x 중심 x 좌표.
	 * @param { number } y 중심 y 좌표.
	 */
	setPosition(x, y) {
		this.#position.set(x, y);
	}

	//==============================================================================
	// 위치 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 중심 위치. (복사본이 아니다)
	 */
	getPosition() {
		return this.#position;
	}

	//==============================================================================
	// 크기 설정.
	//==============================================================================
	/**
	 * @param { number } radius 톱니 끝까지의 반지름. (1 보다 작으면 1)
	 */
	setRadius(radius) {
		this.#radius = Math.max(1, radius);
	}

	//==============================================================================
	// 크기 반환.
	//==============================================================================
	/**
	 * @returns { number } 톱니 끝까지의 반지름.
	 */
	getRadius() {
		return this.#radius;
	}

	//==============================================================================
	// 색 설정.
	//==============================================================================
	/**
	 * @param { string | Color } color (예: "#ff0000", "rgba(255,255,255,0.8)")
	 */
	setColor(color) {
		this.#color = color;
	}

	//==============================================================================
	// 회전 속도 설정.
	//==============================================================================
	/**
	 * @param { number } speedRadiansPerSecond 회전 속도. (라디안/초, 음수면 반대로 돈다)
	 */
	setSpeed(speedRadiansPerSecond) {
		this.#speed = speedRadiansPerSecond;
	}

	//==============================================================================
	// 지금 회전 각도 반환. (라디안)
	//==============================================================================
	/**
	 * @returns { number } 지금 회전 각도. (라디안)
	 */
	getRotation() {
		return this.#rotation;
	}

	//==============================================================================
	// 출력 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } isVisible 보이면 참. (거짓이면 tick 과 draw 가 아무것도 하지 않는다)
	 */
	setVisible(isVisible) {
		this.#isVisible = isVisible;
	}

	//==============================================================================
	// 출력 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 보이면 참.
	 */
	getVisible() {
		return this.#isVisible;
	}
}
