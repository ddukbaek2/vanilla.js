//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { AudioPlayer } from "./audioplayer.js";


//==============================================================================
// 오디오 버스.
// 여러 플레이어의 소리를 한 길로 모아 크기와 음소거를 한꺼번에 건다. (SoundSystem 의 배경음악 버스와 효과음 버스)
// 출력(audioContext.destination)에 이은 GainNode 하나이고, 그 버스로 트는 플레이어(createAudioPlayer)는 GainNode 를 출력 대신 여기에 잇는다.
// 만드는 곳은 AudioManager.createAudioBus() 다. AudioContext 가 없을 때 만든 버스는 소리가 없고, 그 버스로 만든 플레이어도 소리를 내지 않는다.
// 크기와 음소거는 AudioPlayer 와 같은 규칙이다. (0 ~ 1 로 자르고, 음소거를 풀면 설정한 크기로 돌아간다)
// 러스트 판(vanilla-engine)의 AudioBus 와 같은 꼴이다. (데스크탑은 kira 하위 트랙, 웹은 이 GainNode)
//==============================================================================
/**
 * @example <caption>효과음 버스를 만들어 크기를 한꺼번에 걸기</caption>
 * import { Engine, EngineConfiguration, AudioAsset } from "./build/vanilla.js";
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * const audioManager = engine.getAudioManager();
 * const audioBus = audioManager.createAudioBus();
 * audioBus.setVolume(0.5);
 *
 * const audioAsset = new AudioAsset();
 * await audioAsset.load("examples/assets/beep.wav");
 * const audioPlayer = audioBus.createAudioPlayer();
 * audioPlayer.setAudioAsset(audioAsset);
 * audioPlayer.play();
 * console.log(audioBus.isAvailable(), audioBus.getVolume());
 * audioBus.mute();
 * console.log(audioBus.isMuted());
 */
export class AudioBus {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { AudioContext | null } */ #audioContext;
	/** @private @type { GainNode | null } */ #gainNode;
	/** @private @type { boolean } */ #isMuted;
	/** @private @type { number } */ #volume; // 크기. (0 ~ 1, 음소거를 풀면 이 크기로 돌아간다)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { AudioContext | null } audioContext 버스를 만들 오디오 컨텍스트. (null 이면 소리 없는 버스)
	 */
	constructor(audioContext) {
		this.#audioContext = audioContext;
		this.#gainNode = null;
		this.#isMuted = false;
		this.#volume = 1;
		if (audioContext) {
			this.#gainNode = audioContext.createGain();
			this.#gainNode.connect(audioContext.destination);
		}
	}

	//==============================================================================
	// 이 버스로 트는 오디오 플레이어 생성. (버스가 소리 없으면 소리 없는 플레이어)
	//==============================================================================
	/**
	 * @returns { AudioPlayer } 이 버스로 소리를 내는 플레이어.
	 */
	createAudioPlayer() {
		const gainNode = this.getGainNode();
		return new AudioPlayer(gainNode ? this.#audioContext : null, gainNode);
	}

	//==============================================================================
	// 음소거. (소리 없는 버스면 아무것도 하지 않는다)
	//==============================================================================
	mute() {
		if (this.#gainNode) {
			this.#gainNode.gain.value = 0;
			this.#isMuted = true;
		}
	}

	//==============================================================================
	// 음소거 해제. (설정한 크기로 돌아간다)
	//==============================================================================
	unmute() {
		if (this.#gainNode) {
			this.#gainNode.gain.value = this.#volume;
			this.#isMuted = false;
		}
	}

	//==============================================================================
	// 크기 설정. (0 ~ 1, 음소거 중이면 음소거를 풀 때 적용된다)
	//==============================================================================
	/**
	 * @param { number } volume 크기. (0 ~ 1 로 자르고, 유한한 숫자가 아니면 1)
	 */
	setVolume(volume) {
		const clampedVolume = System.Number.isFinite(volume) ? System.Math.max(0, System.Math.min(1, volume)) : 1;
		this.#volume = clampedVolume;
		if (this.#gainNode && !this.#isMuted) {
			this.#gainNode.gain.value = clampedVolume;
		}
	}

	//==============================================================================
	// 크기 반환.
	//==============================================================================
	/**
	 * @returns { number } 크기. (0 ~ 1, 기본 1)
	 */
	getVolume() {
		return this.#volume;
	}

	//==============================================================================
	// 음소거 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 음소거 중이면 참.
	 */
	isMuted() {
		return this.#isMuted;
	}

	//==============================================================================
	// 소리를 모을 수 있는지. (AudioContext 가 있을 때 만든 버스)
	//==============================================================================
	/**
	 * @returns { boolean } 소리를 모을 수 있으면 참.
	 */
	isAvailable() {
		return this.#gainNode !== null;
	}

	//==============================================================================
	// 버스의 GainNode. (다른 WebAudio 노드를 이 버스에 이을 때, SoundSystem 이 설정 크기를 걸 때, 없으면 null)
	// - 이 노드에 직접 건 크기는 크기 칸(getVolume)과 음소거 칸을 바꾸지 않는다. setVolume, mute 로 건 값은 그때까지만 간다.
	//==============================================================================
	/**
	 * @returns { GainNode | null } 버스의 GainNode. (없으면 null)
	 */
	getGainNode() {
		return this.#gainNode;
	}
}
