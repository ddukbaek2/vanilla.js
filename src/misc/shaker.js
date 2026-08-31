//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";


//==============================================================================
// 흔들림 발생기. (화면 / 노드 공용)
// - 위상이 다른 두 사인파로 x / y 오프셋을 만들고 지수 감쇠로 잦아들게 한다.
//   (여러 게임이 sin 조합 + 감쇠 공식을 제각각 인라인으로 재구현하던 것)
// - addShake(strength) 로 세기를 더하고, 매 프레임 tick(dt) 후 getOffset() 을
//   카메라나 노드 위치에 더해 쓴다.
//==============================================================================
export class Shaker extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #strength;
	/** @private @type { number } */ #elapsedSeconds;
	/** @private @type { number } */ #decayRate;
	/** @private @type { number } */ #frequency;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { object } options { decayRate = 9, frequency = 42 }
	 */
	constructor(options = {}) {
		super();

		this.#strength = 0;
		this.#elapsedSeconds = 0;
		this.#decayRate = (options.decayRate !== undefined) ? options.decayRate : 9;
		this.#frequency = (options.frequency !== undefined) ? options.frequency : 42;
	}

	//==============================================================================
	// 흔들림 더하기.
	// - 이미 흔들리는 중이면 더 센 쪽을 따른다.
	//==============================================================================
	/**
	 * @param { number } strength 최대 오프셋. (픽셀)
	 */
	addShake(strength) {
		this.#strength = System.Math.max(this.#strength, strength);
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		this.#elapsedSeconds += timeDelta;
		if (this.#strength > 0) {
			this.#strength *= System.Math.exp(-this.#decayRate * timeDelta);
			if (this.#strength < 0.05) {
				this.#strength = 0;
			}
		}
	}

	//==============================================================================
	// 현재 오프셋 반환.
	// - 두 축의 주파수 비를 다르게 두어(1 : 1.37) 궤적이 단조롭지 않게 한다.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getOffset() {
		if (this.#strength <= 0) {
			return Vector2.zero();
		}
		const time = this.#elapsedSeconds;
		const offsetX = System.Math.sin(time * this.#frequency) * this.#strength;
		const offsetY = System.Math.cos(time * this.#frequency * 1.37) * this.#strength;
		return Vector2.create(offsetX, offsetY);
	}

	//==============================================================================
	// 흔들리는 중인지 여부.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isShaking() {
		return this.#strength > 0;
	}

	//==============================================================================
	// 곧바로 멈추기.
	//==============================================================================
	stop() {
		this.#strength = 0;
	}

	//==============================================================================
	// 감쇠율 설정. (클수록 빨리 잦아든다)
	//==============================================================================
	/**
	 * @param { number } decayRate
	 */
	setDecayRate(decayRate) {
		this.#decayRate = decayRate;
	}

	//==============================================================================
	// 진동 주파수 설정.
	//==============================================================================
	/**
	 * @param { number } frequency
	 */
	setFrequency(frequency) {
		this.#frequency = frequency;
	}
}
