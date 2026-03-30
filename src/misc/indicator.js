//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Renderer } from "./renderer.js";


//==============================================================================
// 인디케이터 클래스.
//==============================================================================
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
	 * @param { number } timeDelta 
	 */
	tick(timeDelta) {
		if (!this.#isVisible) return;
		
		// 시간에 따라 회전 각도 누적
		this.#rotation += this.#speed * timeDelta;
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Renderer } renderer 
	 */
	draw(renderer) {
		if (!this.#isVisible) return;

		const canvasContext = renderer.getCanvasContext();
		
		canvasContext.save();
		// 1. 지정된 위치로 이동 후 회전 적용
		canvasContext.translate(this.#position.x, this.#position.y);
		canvasContext.rotate(this.#rotation);

		// 2. 그리기 설정
		canvasContext.fillStyle = this.#color;
		canvasContext.strokeStyle = this.#color;
		canvasContext.lineWidth = this.#radius * 0.2;
		canvasContext.lineCap = "round";
		canvasContext.lineJoin = "round";

		const teethCount = 8; // 톱니 개수
		const innerRadius = this.#radius * 0.5; // 안쪽 구멍 크기
		const outerRadius = this.#radius; // 바깥쪽 톱니 끝 크기

		// 3. 톱니(Teeth) 그리기 (중심에서 바깥으로 뻗어나가는 선)
		canvasContext.beginPath();
		for (let i = 0; i < teethCount; i++) {
			const angle = (i / teethCount) * Math.PI * 2;
			const cosA = Math.cos(angle);
			const sinA = Math.sin(angle);
			
			// 안쪽 링보다 살짝 안쪽에서 시작해서 바깥으로 뻗음
			canvasContext.moveTo(cosA * (innerRadius * 0.8), sinA * (innerRadius * 0.8));
			canvasContext.lineTo(cosA * outerRadius, sinA * outerRadius);
		}
		canvasContext.stroke();

		// 4. 안쪽 링(Ring) 그리기 (도넛 모양)
		canvasContext.beginPath();
		canvasContext.arc(0, 0, innerRadius, 0, Math.PI * 2);
		// 가운데 구멍 뚫기 위해 이전 방식 대신 stroke 두껍게 칠하기
		canvasContext.lineWidth = this.#radius * 0.3;
		canvasContext.stroke();

		canvasContext.restore();
	}
	
	//==============================================================================
	// 위치 설정.
	//==============================================================================
	/**
	 * 인디케이터가 표시될 중심 좌표를 설정합니다.
	 * @param { number } x 
	 * @param { number } y 
	 */
	setPosition(x, y) {
		this.#position.set(x, y);
	}

	//==============================================================================
	// 위치 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getPosition() {
		return this.#position;
	}

	//==============================================================================
	// 크기 설정.
	//==============================================================================
	/**
	 * @param { number } radius 
	 */
	setRadius(radius) {
		this.#radius = Math.max(1, radius);
	}

	//==============================================================================
	// 크기 반환.
	//==============================================================================
	/**
	 * @param { string } color (예: "#ff0000", "rgba(255,255,255,0.8)")
	 */
	setColor(color) {
		this.#color = color;
	}

	//==============================================================================
	// 회전 속도 설정.
	//==============================================================================
	/**
	 * @param { number } speedRadiansPerSecond 
	 */
	setSpeed(speedRadiansPerSecond) {
		this.#speed = speedRadiansPerSecond;
	}

	//==============================================================================
	// 출력 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } isVisible 
	 */
	setVisible(isVisible) {
		this.#isVisible = isVisible;
	}

	//==============================================================================
	// 출력 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	getVisible() {
		return this.#isVisible;
	}
}
