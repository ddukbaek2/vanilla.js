//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Matrix4 } from "../base/matrix4.js";
import { Vector3 } from "../base/vector3.js";
import { SeededRandom } from "../base/seededrandom.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 한 축의 흔들림 결을 이루는 사인파 수. (Cinemachine 잡음 설정처럼 주파수가 다른 파를 겹쳐 궤적이 되풀이되지 않게)
const WAVES_PER_CHANNEL = 2;
// 흔들림 결의 축 수. (자리 x, y, z 와 돌림 pitch, yaw, roll)
const CHANNEL_COUNT = 6;
// 사인파마다의 세기. (합이 1 이 되게 나눠 결이 -1 ~ 1 안에 든다)
const WAVE_WEIGHTS = System.Object.freeze([2 / 3, 1 / 3]);
// 사인파마다의 주파수 몫 범위. ([아래, 위], 흔들림 주파수에 곱한다)
const WAVE_RATIO_RANGES = System.Object.freeze([System.Object.freeze([0.85, 1.15]), System.Object.freeze([1.7, 2.3])]);
// 흔들림의 기본 값.
const DEFAULT_SHAKE = System.Object.freeze({
	amplitude: 0.1, // 자리 흔들림의 최대 길이. (장면 길이)
	rotationAmplitude: 0, // 돌림 흔들림의 최대 각. (라디안)
	frequency: 10, // 흔들림의 주파수. (초당 번)
	duration: 0.25, // 흔들림 길이. (초)
	attack: 0, // 처음 0 에서 다 센 데까지 오르는 초.
	decayExponent: 2, // 잦아듦의 지수. ((1 - 나이 / 길이) 의 이 제곱, 1 이면 곧게, 0 이면 끝까지 그대로)
});


//==============================================================================
// 보기 행렬에 카메라 지역 덧붙임 걸기. (카메라를 그 자리에서 position 만큼 옮기고 rotation 만큼 돌린 보기, 새 행렬)
// - position 은 카메라 지역 축이다. (x 오른쪽, y 위, z 뒤, 카메라는 -Z 를 봄)
// - rotation 은 카메라 지역 축의 각(라디안)이다. (x 는 pitch, y 는 yaw, z 는 roll, roll 다음 pitch 다음 yaw 로 건다)
// - 덧붙인 카메라는 (카메라) x 옮김 x yaw x pitch x roll 이고, 보기 행렬은 그 역이라 (옮김 x yaw x pitch x roll) 의 역을 앞에 곱한다.
//==============================================================================
/**
 * @param { Matrix4 } viewMatrix - 덧붙이기 앞의 보기 행렬. (월드 → 카메라, 고치지 않는다)
 * @param { Vector3 } position - 카메라 지역 자리 덧붙임. (장면 길이)
 * @param { Vector3 } rotation - 카메라 지역 돌림 덧붙임. (라디안, x pitch, y yaw, z roll)
 * @returns { Matrix4 } 덧붙인 보기 행렬. (새 행렬)
 * @example <caption>보기 행렬을 오른쪽으로 0.1, 고개를 0.02 라디안 들어 덧붙이기</caption>
 * import { createOffsetViewMatrix, Matrix4, Vector3 } from "./vanilla.js";
 * const viewMatrix = Matrix4.createLookAt(Vector3.create(0, 2, 6), Vector3.create(0, 1, 0), Vector3.create(0, 1, 0));
 * const shakenViewMatrix = createOffsetViewMatrix(viewMatrix, Vector3.create(0.1, 0, 0), Vector3.create(0.02, 0, 0));
 * console.log(shakenViewMatrix.getElements().length);
 */
export function createOffsetViewMatrix(viewMatrix, position, rotation) {
	const offsetMatrix = Matrix4.createRotationZ(-rotation.z);
	offsetMatrix.rotateX(-rotation.x);
	offsetMatrix.rotateY(-rotation.y);
	offsetMatrix.translate(-position.x, -position.y, -position.z);
	offsetMatrix.multiply(viewMatrix);
	return offsetMatrix;
}


//==============================================================================
// 3D 카메라 흔들림. (유니티 Cinemachine Impulse, 언리얼 Camera Shake 꼴의 엔진 흔들림)
// - add(options) 로 흔들림 하나를 더한다. 흔들림마다 자리 3 축과 돌림 3 축(pitch, yaw, roll)의 결, 세기, 주파수, 길이, 오름, 잦아듦을 따로 쥔다.
// - 결: 축마다 주파수가 조금씩 다른 사인파 둘을 겹친다. 위상과 주파수 몫은 흔들림의 씨앗에서 뽑는다. (같은 씨앗, 같은 나이면 같은 값)
// - 크기 곡선: 나이가 음수면 아직 0(그만큼 늦게 시작), attack 초 동안 0 에서 1 로 오르고, (1 - 나이 / 길이) 의 decayExponent 제곱으로 잦아들어 길이에서 0.
// - 겹침: 사는 흔들림을 모두 더한다. (센 쪽을 따르는 2D Shaker 와 다르다)
// - 나이: options.age 는 이미 지난 초다. 결도 나이로 셈해 늦게 보인 사건을 그 나이로 넣으면 처음부터 넣은 것과 같은 값이 이어진다.
// - update(초) 로 나이를 먹이고 다 된 흔들림을 지운다. read() 가 지금의 덧붙임 { position, rotation } 을 준다. (카메라 지역 축)
// - 거는 곳: Camera3D.setViewOffset(position, rotation) 에 넣거나, 게임이 셈한 보기 행렬이면 createOffsetViewMatrix 로 건다.
// - 씨앗: options.seed 를 주지 않은 흔들림은 이 바탕의 씨앗(생성의 seed)에서 차례로 씨앗을 뽑는다.
//==============================================================================
/**
 * @example <caption>폭발 흔들림을 Camera3D 에 걸기</caption>
 * import { CameraShake, Camera3D, Vector3 } from "./vanilla.js";
 * const camera = new Camera3D();
 * camera.setPerspective(Math.PI / 3, 0.1, 500);
 * camera.lookAt(Vector3.create(0, 4, 10), Vector3.create(0, 0, 0));
 * const cameraShake = new CameraShake({ seed: 7 });
 * cameraShake.add({ amplitude: 0.09, rotationAmplitude: 0.01, duration: 0.25, positionAxes: [1, 0.5, 1] });
 * cameraShake.add({ amplitude: 0.04, duration: 0.6, age: 0.1 });
 * cameraShake.update(1 / 60);
 * const shake = cameraShake.read();
 * camera.setViewOffset(shake.position, shake.rotation);
 * const viewProjectionMatrix = camera.getViewProjectionMatrix();
 * console.log(cameraShake.isShaking(), viewProjectionMatrix.getElements().length);
 */
export class CameraShake {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { SeededRandom } */ #random; // 씨앗을 주지 않은 흔들림의 씨앗을 뽑는 난수.
	/** @private @type { Array<object> } */ #shakes; // 사는 흔들림. ({ amplitude, rotationAmplitude, positionAxes, rotationAxes, frequency, duration, attack, decayExponent, age, waves })

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { object } [options] { seed = 1 } 씨앗을 주지 않은 흔들림의 씨앗을 뽑을 바탕 씨앗.
	 */
	constructor(options = {}) {
		this.#random = new SeededRandom(options.seed !== undefined ? options.seed : 1);
		this.#shakes = [];
	}

	//==============================================================================
	// 흔들림 더하기. (사는 흔들림에 겹쳐 더함)
	//==============================================================================
	/**
	 * @param { object } [options] { amplitude, rotationAmplitude, positionAxes, rotationAxes, frequency, duration, attack, decayExponent, age, seed }
	 *   - amplitude: 자리 흔들림의 최대 길이. (장면 길이, 기본 0.1)
	 *   - rotationAmplitude: 돌림 흔들림의 최대 각. (라디안, 기본 0)
	 *   - positionAxes: [x, y, z] 자리 축마다의 몫. (카메라 지역 축 오른쪽, 위, 뒤, 기본 [1, 1, 1])
	 *   - rotationAxes: [pitch, yaw, roll] 돌림 축마다의 몫. (기본 [1, 1, 1])
	 *   - frequency: 주파수. (초당 번, 기본 10)
	 *   - duration: 길이. (초, 기본 0.25)
	 *   - attack: 0 에서 다 센 데까지 오르는 초. (기본 0)
	 *   - decayExponent: 잦아듦 지수. (기본 2, (1 - 나이 / 길이) 의 이 제곱)
	 *   - age: 이미 지난 초. (기본 0, 음수면 그만큼 늦게 시작)
	 *   - seed: 이 흔들림의 씨앗. (없으면 바탕 씨앗에서 차례로 뽑음)
	 */
	add(options = {}) {
		const readOption = (name) => {
			return options[name] !== undefined ? options[name] : DEFAULT_SHAKE[name];
		};
		const seed = options.seed !== undefined ? options.seed : System.Math.floor(this.#random.nextValue() * 4294967296);
		const waveRandom = new SeededRandom(seed);
		const waves = [];
		for (let channelIndex = 0; channelIndex < CHANNEL_COUNT; ++channelIndex) {
			for (let waveIndex = 0; waveIndex < WAVES_PER_CHANNEL; ++waveIndex) {
				const ratioRange = WAVE_RATIO_RANGES[waveIndex];
				waves.push({ ratio: waveRandom.nextRange(ratioRange[0], ratioRange[1]), phase: waveRandom.nextRange(0, System.Math.PI * 2) });
			}
		}
		this.#shakes.push({
			amplitude: readOption("amplitude"),
			rotationAmplitude: readOption("rotationAmplitude"),
			positionAxes: options.positionAxes !== undefined ? System.Array.from(options.positionAxes) : [1, 1, 1],
			rotationAxes: options.rotationAxes !== undefined ? System.Array.from(options.rotationAxes) : [1, 1, 1],
			frequency: readOption("frequency"),
			duration: readOption("duration"),
			attack: readOption("attack"),
			decayExponent: readOption("decayExponent"),
			age: options.age !== undefined ? options.age : 0,
			waves: waves,
		});
	}

	//==============================================================================
	// 나이 먹이기. (다 된 흔들림을 지움)
	//==============================================================================
	/**
	 * @param { number } deltaTime 지난 프레임부터의 시간. (초)
	 */
	update(deltaTime) {
		for (let shakeIndex = this.#shakes.length - 1; shakeIndex >= 0; --shakeIndex) {
			const shake = this.#shakes[shakeIndex];
			shake.age += deltaTime;
			if (shake.age >= shake.duration) {
				this.#shakes.splice(shakeIndex, 1);
			}
		}
	}

	//==============================================================================
	// 지금의 덧붙임. (사는 흔들림을 모두 더함, 카메라 지역 축)
	//==============================================================================
	/**
	 * @returns { object } { position: Vector3, rotation: Vector3 } 자리(장면 길이, x 오른쪽, y 위, z 뒤)와 돌림(라디안, x pitch, y yaw, z roll). (흔들림이 없으면 둘 다 영 벡터)
	 */
	read() {
		const offset = [0, 0, 0, 0, 0, 0];
		for (const shake of this.#shakes) {
			const age = shake.age;
			if (age < 0 || age >= shake.duration) {
				continue;
			}
			let envelope = System.Math.pow(1 - age / shake.duration, shake.decayExponent);
			if (shake.attack > 0 && age < shake.attack) {
				envelope *= age / shake.attack;
			}
			const angularFrequency = System.Math.PI * 2 * shake.frequency;
			for (let channelIndex = 0; channelIndex < CHANNEL_COUNT; ++channelIndex) {
				const isPosition = channelIndex < 3;
				const axisIndex = channelIndex % 3;
				const gain = isPosition ? shake.amplitude * shake.positionAxes[axisIndex] : shake.rotationAmplitude * shake.rotationAxes[axisIndex];
				if (gain === 0) {
					continue;
				}
				let signal = 0;
				for (let waveIndex = 0; waveIndex < WAVES_PER_CHANNEL; ++waveIndex) {
					const wave = shake.waves[channelIndex * WAVES_PER_CHANNEL + waveIndex];
					signal += System.Math.sin(angularFrequency * wave.ratio * age + wave.phase) * WAVE_WEIGHTS[waveIndex];
				}
				offset[channelIndex] += signal * gain * envelope;
			}
		}
		return { position: Vector3.create(offset[0], offset[1], offset[2]), rotation: Vector3.create(offset[3], offset[4], offset[5]) };
	}

	//==============================================================================
	// 흔들림이 남았는지. (늦게 시작할 흔들림도 셈)
	//==============================================================================
	/**
	 * @returns { boolean } 사는 흔들림이 하나라도 있으면 true.
	 */
	isShaking() {
		return this.#shakes.length > 0;
	}

	//==============================================================================
	// 모든 흔들림을 곧바로 멈추기.
	//==============================================================================
	clear() {
		this.#shakes = [];
	}
}
