//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector3 } from "../../base/vector3.js";
import { degreeToRadian, sin, cos } from "../../base/math.js";
import { Component } from "../../core/component.js";
import { convertViewPositionToAudioPosition } from "./spatialaudiomath.js";
import { SpatialAudioListener } from "./spatialaudiolistener.js";


//==============================================================================
// 2D 노드를 따라가는 리스너 컴포넌트.
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 매 프레임(tick) 노드의 전역 자리를 WebAudio 좌표로 바꿔 리스너 자리에 건다. (바뀐 때만) 보통 카메라나 주인공 노드에 붙인다.
//   앞은 화면 안쪽 (0, 0, -1)이고, 위는 노드의 전역 회전을 따라 돈다. (회전 0 이면 (0, 1, 0), 화면 위)
// - 깊이(setDepth)를 주면 리스너가 화면에서 그만큼 떨어져 있어, 가까운 소리가 갑자기 한쪽으로 쏠리지 않는다. (기본 0)
// - 러스트 판(vanilla-engine)의 AudioListener2D 와 같은 꼴이다.
//==============================================================================
/**
 * @example <caption>카메라 노드에 리스너 붙이기</caption>
 * import { Engine, EngineConfiguration, WorldNode, Experimental } from "./build/vanilla.js";
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * const cameraNode = new WorldNode();
 * const audioListener = cameraNode.addComponent(Experimental.AudioListener2D);
 * audioListener.setPixelsPerUnit(100);
 * audioListener.setDepth(3);
 * audioListener.setListener(new Experimental.SpatialAudioListener(engine.getAudioManager()));
 * audioListener.tick(0.016);
 * console.log(audioListener.getDepth(), audioListener.getListener().getPosition().z);
 */
export class AudioListener2D extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { SpatialAudioListener | null } */ #listener;
	/** @private @type { number } */ #pixelsPerUnit; // WebAudio 한 단위의 픽셀 수.
	/** @private @type { number } */ #depth; // 리스너의 Z.

	//==============================================================================
	// 생성. (리스너 없음, 한 단위 1 픽셀, 깊이 0)
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.setComponentType("AudioListener2D");
		this.#listener = null;
		this.#pixelsPerUnit = 1;
		this.#depth = 0;
	}

	//==============================================================================
	// 따라갈 리스너 넣기.
	//==============================================================================
	/**
	 * @param { SpatialAudioListener } listener 노드 자리를 걸 리스너.
	 */
	setListener(listener) {
		this.#listener = listener;
	}

	//==============================================================================
	// 리스너.
	//==============================================================================
	/**
	 * @returns { SpatialAudioListener | null } 넣은 리스너. (없으면 null)
	 */
	getListener() {
		return this.#listener;
	}

	//==============================================================================
	// WebAudio 한 단위의 픽셀 수 설정. (0 보다 크고 유한해야 받는다, AudioSource2D 와 같은 값을 쓴다)
	//==============================================================================
	/**
	 * @param { number } pixelsPerUnit 한 단위가 몇 픽셀인지. (기본 1)
	 */
	setPixelsPerUnit(pixelsPerUnit) {
		if (System.Number.isFinite(pixelsPerUnit) && pixelsPerUnit > 0) {
			this.#pixelsPerUnit = pixelsPerUnit;
		}
	}

	//==============================================================================
	// WebAudio 한 단위의 픽셀 수.
	//==============================================================================
	/**
	 * @returns { number } 한 단위가 몇 픽셀인지. (기본 1)
	 */
	getPixelsPerUnit() {
		return this.#pixelsPerUnit;
	}

	//==============================================================================
	// 깊이 설정. (리스너가 화면에서 떨어진 거리, WebAudio 단위, 유한해야 받는다)
	//==============================================================================
	/**
	 * @param { number } depth 리스너의 Z. (기본 0, 소리는 Z 0 에 있다)
	 */
	setDepth(depth) {
		if (System.Number.isFinite(depth)) {
			this.#depth = depth;
		}
	}

	//==============================================================================
	// 깊이.
	//==============================================================================
	/**
	 * @returns { number } 리스너의 Z. (기본 0)
	 */
	getDepth() {
		return this.#depth;
	}

	//==============================================================================
	// 갱신. (노드의 전역 자리와 회전을 리스너에 건다)
	//==============================================================================
	/**
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 */
	tick(timeDelta) {
		const listener = this.#listener;
		const node = this.getNode();
		if (listener === null || !node) {
			return;
		}
		const radian = degreeToRadian(node.getRotation());
		listener.setPosition(convertViewPositionToAudioPosition(node.getPosition(), this.#pixelsPerUnit, this.#depth));
		// 화면 위 (0, -1) 을 시계 방향으로 돌린 (sin, -cos) 의 Y 를 뒤집는다.
		listener.setOrientation(Vector3.create(0, 0, -1), Vector3.create(sin(radian), cos(radian), 0));
	}
}
