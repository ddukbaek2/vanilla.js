//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../base/vector2.js";
import { Graphic } from "../core/graphic.js";
import { TransformNode } from "../core/node/transformnode.js";


//==============================================================================
// 아지랑이 효과 노드.
// - 이 노드가 그려지기 전까지의 캔버스 내용을 가져와서 일렁이는 효과를 줍니다.
// - 따라서 씬의 가장 마지막(맨 위)에 추가되어야 효과가 보입니다.
//==============================================================================
export class HeatHazeEffect extends TransformNode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #timer;
	/** @private @type { number } */ #speed;      // 흔들리는 속도.
	/** @private @type { number } */ #amplitude;  // 흔들리는 폭 (강도).
	/** @private @type { number } */ #frequency;  // 흔들리는 빈도 (물결의 촘촘함).

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		
		this.#timer = 0;
		this.#speed = 2.0;
		this.#amplitude = 3.0;
		this.#frequency = 0.05;
		this.setContentSize(Vector2.create(300, 300));
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta 
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
		const speed = this.getSpeed();
		this.#timer += timeDelta * speed;
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Graphic } graphic 
	 */
	draw(graphic) {
		// 노드 자체가 활성화 상태가 아니면 그리지 않음.
		if (!this.isActive()) {
			return;
		}

		const canvasRenderingContext = graphic.getCanvasRenderingContext();
		const contentSize = this.getContentSize();

		// 영역 크기가 없다면 그리지 않음.
		if (contentSize.x <= 0 || contentSize.y <= 0) {
			return;
		}

		// 현재까지 그려진 캔버스 자체를 소스로 사용.
		const sourceCanvas = canvasRenderingContext.canvas;
		
		// 화면상의 절대 좌표 영역(바운딩 박스)을 가져와 캡처 범위로 사용합니다.
		const worldBounds = this.getWorldBounds();
		const scaleY = worldBounds.size.y / contentSize.y;

		// 성능을 위해 영역 내의 한 줄(1px)씩 잘라서 사인 곡선에 맞춰 좌우로 흔듭니다.
		for (let y = 0; y < contentSize.y; y++) {
			const amplitude = this.getAmplitude();
			const frequency = this.getFrequency();
			const offsetX = Math.sin(this.#timer + (y * frequency)) * amplitude;

			// 소스(sx, sy): 화면에 이미 그려진 글로벌 좌표 캡처 영역
			const sx = worldBounds.position.x;
			const sy = worldBounds.position.y + (y * scaleY);
			const sw = worldBounds.size.x;
			const sh = scaleY;

			// 대상(dx, dy): 현재 노드의 로컬 공간. 
			// SpriteComponent처럼 Context가 이미 변환(위치/회전/피봇)되어 있으므로 0부터 시작.
			canvasRenderingContext.drawImage(
				sourceCanvas,
				sx, sy, sw, sh,
				offsetX, y, contentSize.x, 1
			);
		}

		// 자식 노드가 있다면 마저 그립니다.
		super.draw(graphic);
	}

	//==============================================================================
	// 속도 설정.
	//==============================================================================
	/**
	 * @param { number } value 
	 */
	setSpeed(value) { 
		this.#speed = value; 
	}

	//==============================================================================
	// 속도 반환.
	//==============================================================================
	/**
	 * @returns { number } 
	 */
	getSpeed() { 
		return this.#speed; 
	}

	//==============================================================================
	// 강도 설정.
	//==============================================================================
	/**
	 * @param { number } value 
	 */
	setAmplitude(value) { 
		this.#amplitude = value; 
	}

	//==============================================================================
	// 강도 반환.
	//==============================================================================
	/**
	 * @returns { number } 
	 */
	getAmplitude() { 
		return this.#amplitude; 
	}

	//==============================================================================
	// 빈도 설정.
	//==============================================================================
	/**
	 * @param { number } value 
	 */
	setFrequency(value) { 
		this.#frequency = value; 
	}

	//==============================================================================
	// 빈도 반환.
	//==============================================================================
	/**
	 * @returns { number } 
	 */
	getFrequency() { 
		return this.#frequency; 
	}
}