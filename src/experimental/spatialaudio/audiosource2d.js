//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Component } from "../../core/component.js";
import { convertViewPositionToAudioPosition } from "./spatialaudiomath.js";
import { SpatialAudioPlayer } from "./spatialaudioplayer.js";


//==============================================================================
// 2D 노드를 따라가는 공간 소리 컴포넌트.
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 매 프레임(tick) 노드의 전역 자리(getPosition)를 WebAudio 좌표로 바꿔 SpatialAudioPlayer 의 자리에 건다. (바뀐 때만)
//   화면 좌표는 아래가 +Y 라 WebAudio 좌표(위가 +Y)로 Y 를 뒤집고, 픽셀을 pixelsPerUnit 으로 나눈다. Z 는 0 이다.
// - 플레이어는 setPlayer 로 넣는다. (AudioContext 를 든 매니저가 필요해서 컴포넌트가 만들지 않는다)
// - 러스트 판(vanilla-engine)의 AudioSource2D 와 같은 꼴이다.
//==============================================================================
/**
 * @example <caption>횃불 노드를 따라가는 소리</caption>
 * import { Engine, EngineConfiguration, Scene, WorldNode, Vector2, Experimental } from "./build/vanilla.js";
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * const audioManager = engine.getAudioManager();
 * const torchNode = new WorldNode();
 * torchNode.setLocalPosition(Vector2.create(300, 200));
 * const audioSource = torchNode.addComponent(Experimental.AudioSource2D);
 * audioSource.setPixelsPerUnit(100);
 * audioSource.setPlayer(new Experimental.SpatialAudioPlayer(audioManager));
 *
 * class MainScene extends Scene {
 * 	initialize(engine) {
 * 		super.initialize(engine);
 * 		this.getRoot().addChild(torchNode);
 * 	}
 * }
 * engine.run(new MainScene());
 * console.log(audioSource.getPixelsPerUnit(), audioSource.getPlayer() !== null);
 */
export class AudioSource2D extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { SpatialAudioPlayer | null } */ #player;
	/** @private @type { number } */ #pixelsPerUnit; // WebAudio 한 단위의 픽셀 수.

	//==============================================================================
	// 생성. (플레이어 없음, 한 단위 1 픽셀)
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.setComponentType("AudioSource2D");
		this.#player = null;
		this.#pixelsPerUnit = 1;
	}

	//==============================================================================
	// 따라갈 플레이어 넣기. (앞 플레이어는 버린다)
	//==============================================================================
	/**
	 * @param { SpatialAudioPlayer } player 노드 자리를 걸 공간 소리 플레이어.
	 */
	setPlayer(player) {
		this.#player = player;
	}

	//==============================================================================
	// 플레이어.
	//==============================================================================
	/**
	 * @returns { SpatialAudioPlayer | null } 넣은 플레이어. (없으면 null)
	 */
	getPlayer() {
		return this.#player;
	}

	//==============================================================================
	// WebAudio 한 단위의 픽셀 수 설정. (0 보다 크고 유한해야 받는다, 거리 모델의 기준과 최대 거리가 이 단위다)
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
	// 갱신. (노드의 전역 자리를 플레이어 자리에 건다)
	//==============================================================================
	/**
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 */
	tick(timeDelta) {
		const player = this.#player;
		const node = this.getNode();
		if (player === null || !node) {
			return;
		}
		player.setPosition(convertViewPositionToAudioPosition(node.getPosition(), this.#pixelsPerUnit, 0));
	}
}
