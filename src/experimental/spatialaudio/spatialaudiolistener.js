//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector3 } from "../../base/vector3.js";


// 리스너 AudioParam 이름. (자리, 앞, 위 차례)
const LISTENER_PARAM_NAME_LIST = ["positionX", "positionY", "positionZ", "forwardX", "forwardY", "forwardZ", "upX", "upY", "upZ"];


//==============================================================================
// 공간 소리 리스너.
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - AudioContext 의 리스너(audioContext.listener)는 컨텍스트에 하나다. 이 값을 여럿 만들어도 같은 리스너를 고친다.
//   (값은 이 값이 기억하는 것이라, 여럿이 서로 다른 값을 들면 마지막에 건 것이 리스너에 남는다)
// - 자리, 앞, 위는 리스너의 positionX ~ upZ 에 값으로 대입한다. (바뀐 칸만) 그 AudioParam 이 없는 옛 브라우저는 setPosition, setOrientation 을 쓴다.
// - 만들 때 AudioContext 가 없으면 만든다. (AudioManager.createAudioPlayer 와 같다)
// - 러스트 판(vanilla-engine)의 SpatialAudioListener 와 같은 꼴이다.
//==============================================================================
/**
 * @example <caption>리스너를 옮기고 돌리기</caption>
 * import { Engine, EngineConfiguration, Vector3, Experimental } from "./build/vanilla.js";
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * const listener = new Experimental.SpatialAudioListener(engine.getAudioManager());
 * listener.setPosition(Vector3.create(1, 2, 3));
 * listener.setOrientation(Vector3.create(1, 0, 0), Vector3.create(0, 1, 0));
 * console.log(listener.getPosition().x, listener.getForward().x, listener.getUp().y);
 */
export class SpatialAudioListener {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { AudioContext | null } */ #audioContext;
	/** @private @type { number[] } */ #valueList; // 자리, 앞, 위. (리스너에 건 값)

	//==============================================================================
	// 생성. (자리 (0, 0, 0), 앞 (0, 0, -1), 위 (0, 1, 0), 리스너에는 아직 아무것도 걸지 않는다)
	//==============================================================================
	/**
	 * @constructor
	 * @param { object } audioManager 엔진의 AudioManager. (engine.getAudioManager())
	 */
	constructor(audioManager) {
		this.#audioContext = audioManager.ensureAudioContext();
		this.#valueList = [0, 0, 0, 0, 0, -1, 0, 1, 0];
	}

	//==============================================================================
	// 자리 설정. (WebAudio 좌표, 유한하지 않은 칸은 받지 않는다)
	//==============================================================================
	/**
	 * @param { Vector3 } position 자리.
	 */
	setPosition(position) {
		this.#writeValues(0, position);
	}

	//==============================================================================
	// 자리.
	//==============================================================================
	/**
	 * @returns { Vector3 } 자리.
	 */
	getPosition() {
		return this.#readValues(0);
	}

	//==============================================================================
	// 방향 설정. (앞과 위, 길이는 상관없다. 기본 앞 (0, 0, -1), 위 (0, 1, 0))
	//==============================================================================
	/**
	 * @param { Vector3 } forward 앞.
	 * @param { Vector3 } up 위.
	 */
	setOrientation(forward, up) {
		this.#writeValues(3, forward);
		this.#writeValues(6, up);
	}

	//==============================================================================
	// 앞.
	//==============================================================================
	/**
	 * @returns { Vector3 } 앞.
	 */
	getForward() {
		return this.#readValues(3);
	}

	//==============================================================================
	// 위.
	//==============================================================================
	/**
	 * @returns { Vector3 } 위.
	 */
	getUp() {
		return this.#readValues(6);
	}

	//==============================================================================
	// 값 셋 읽기.
	//==============================================================================
	/**
	 * @private
	 * @param { number } firstIndex 첫 칸.
	 * @returns { Vector3 } 값.
	 */
	#readValues(firstIndex) {
		const valueList = this.#valueList;
		return Vector3.create(valueList[firstIndex], valueList[firstIndex + 1], valueList[firstIndex + 2]);
	}

	//==============================================================================
	// 바뀐 칸만 리스너에 대입한다. (러스트 판처럼 float 로)
	//==============================================================================
	/**
	 * @private
	 * @param { number } firstIndex 첫 칸.
	 * @param { Vector3 } vector 새 값.
	 */
	#writeValues(firstIndex, vector) {
		const nextList = [vector.x, vector.y, vector.z].map((value) => System.Math.fround(value));
		for (let offset = 0; offset < 3; ++offset) {
			const index = firstIndex + offset;
			const value = nextList[offset];
			if (!System.Number.isFinite(value) || value === this.#valueList[index]) {
				continue;
			}
			this.#valueList[index] = value;
			this.#applyValue(index, value);
		}
	}

	//==============================================================================
	// 리스너에 값 하나 걸기. (AudioParam 이 없으면 setPosition, setOrientation)
	//==============================================================================
	/**
	 * @private
	 * @param { number } index 칸.
	 * @param { number } value 값.
	 */
	#applyValue(index, value) {
		const audioContext = this.#audioContext;
		if (audioContext === null) {
			return;
		}
		const listener = audioContext.listener;
		const audioParam = listener[LISTENER_PARAM_NAME_LIST[index]];
		if (audioParam !== undefined) {
			audioParam.value = value;
			return;
		}
		const valueList = this.#valueList;
		if (index < 3) {
			listener.setPosition(valueList[0], valueList[1], valueList[2]);
		}
		else {
			listener.setOrientation(valueList[3], valueList[4], valueList[5], valueList[6], valueList[7], valueList[8]);
		}
	}
}
