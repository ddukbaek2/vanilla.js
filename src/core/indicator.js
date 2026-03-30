//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Renderer } from "./renderer.js";


//==============================================================================
// 인디케이터 유형.
//==============================================================================
export const IndicatorType = {
	circle: 0,
	arrow: 1,
	pointer: 2
};


//==============================================================================
// 인디케이터 클래스.
//==============================================================================
export class Indicator extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Vector2 } */ #position; // 인디케이터 중심 위치.
	/** @private @type { number } */ #type; // 인디케이터 모양 유형.
	/** @private @type { string } */ #color; // 색상 (CSS 컬러 문자열).
	/** @private @type { number } */ #size; // 기본 크기(반지름 또는 길이).
	/** @private @type { number } */ #angle; // 화살표 등의 회전 각도 (라디안).
	/** @private @type { number } */ #elapsedTime; // 애니메이션 계산을 위한 누적 시간.
	/** @private @type { boolean } */ #isVisible; // 출력 여부.

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.#position = Vector2.zero();
		this.#type = IndicatorType.circle;
		this.#color = "#ffeb3b"; // 기본: 노란색
		this.#size = 30;
		this.#angle = 0;
		this.#elapsedTime = 0;
		this.#isVisible = true;
	}

	//==============================================================================
	// 설정.
	//==============================================================================
	/**
	 * @param { number } x 
	 * @param { number } y 
	 */
	setPosition(x, y) {
		this.#position.set(x, y);
	}

	/**
	 * @returns { Vector2 }
	 */
	getPosition() {
		return this.#position;
	}

	/**
	 * @param { number } type IndicatorType 열거형
	 */
	setType(type) {
		this.#type = type;
	}

	/**
	 * @param { string } color 
	 */
	setColor(color) {
		this.#color = color;
	}

	/**
	 * @param { number } size 
	 */
	setSize(size) {
		this.#size = Math.max(1, size);
	}

	/**
	 * @param { number } angleRadians 
	 */
	setAngle(angleRadians) {
		this.#angle = angleRadians;
	}

	/**
	 * @param { boolean } isVisible 
	 */
	setVisible(isVisible) {
		this.#isVisible = isVisible;
	}

	/**
	 * @returns { boolean }
	 */
	getVisible() {
		return this.#isVisible;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta 
	 */
	tick(timeDelta) {
		if (!this.#isVisible) return;
		this.#elapsedTime += timeDelta;
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
		canvasContext.translate(this.#position.x, this.#position.y);
		
		// 애니메이션 계산 (예: 크기 펄스 효과, 위치 떠다님)
		const pulse = 1.0 + Math.sin(this.#elapsedTime * 5) * 0.2; // 0.8 ~ 1.2
		const floatY = Math.sin(this.#elapsedTime * 6) * 5; // -5 ~ 5
		
		switch (this.#type) {
			case IndicatorType.circle:
				this.#drawCircle(canvasContext, pulse);
				break;
			case IndicatorType.arrow:
				this.#drawArrow(canvasContext, pulse);
				break;
			case IndicatorType.pointer:
				this.#drawPointer(canvasContext, floatY);
				break;
		}

		canvasContext.restore();
	}

	//==============================================================================
	// 내부 그리기 메서드.
	//==============================================================================
	/**
	 * @private
	 * @param { CanvasRenderingContext2D } ctx 
	 * @param { number } pulse 
	 */
	#drawCircle(ctx, pulse) {
		const r = this.#size * pulse;
		ctx.beginPath();
		ctx.arc(0, 0, r, 0, Math.PI * 2);
		ctx.lineWidth = 3;
		ctx.strokeStyle = this.#color;
		ctx.stroke();
		
		// 내부 은은한 채우기
		ctx.fillStyle = this.#color;
		ctx.globalAlpha = 0.2;
		ctx.fill();
		ctx.globalAlpha = 1.0;
	}

	/**
	 * @private
	 * @param { CanvasRenderingContext2D } ctx 
	 * @param { number } pulse 
	 */
	#drawArrow(ctx, pulse) {
		ctx.rotate(this.#angle);
		const length = this.#size * pulse;
		const width = length * 0.5;
		
		ctx.beginPath();
		ctx.moveTo(length, 0); // 화살촉 끝
		ctx.lineTo(0, width / 2); // 오른쪽 날개
		ctx.lineTo(width / 3, 0); // 안쪽 파인 부분
		ctx.lineTo(0, -width / 2); // 왼쪽 날개
		ctx.closePath();

		ctx.fillStyle = this.#color;
		ctx.fill();
		ctx.lineWidth = 1;
		ctx.strokeStyle = '#ffffff';
		ctx.stroke();
	}

	/**
	 * @private
	 * @param { CanvasRenderingContext2D } ctx 
	 * @param { number } floatY 
	 */
	#drawPointer(ctx, floatY) {
		ctx.translate(0, floatY - this.#size); // 대상의 살짝 위에서 둥둥 떠다님
		
		const w = this.#size * 0.6;
		const h = this.#size;
		
		ctx.beginPath();
		ctx.moveTo(0, 0); // 뾰족한 끝 (아래쪽을 가리킴)
		ctx.lineTo(w / 2, -h * 0.4);
		ctx.lineTo(w / 2, -h);
		ctx.lineTo(-w / 2, -h);
		ctx.lineTo(-w / 2, -h * 0.4);
		ctx.closePath();

		ctx.fillStyle = this.#color;
		ctx.fill();
		ctx.lineWidth = 2;
		ctx.strokeStyle = '#000000';
		ctx.stroke();
	}
}