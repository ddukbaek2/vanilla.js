//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { AudioAsset } from "../resource/audioasset.js";


//==============================================================================
// 오디오 플레이어.
// AudioAsset 에 로드된 오디오 버퍼를 재생한다.
// 내보낼 노드를 주면(AudioBus.createAudioPlayer) 출력 대신 그 노드로 소리를 낸다.
//==============================================================================
/**
 * @example <caption>소리 하나를 빠르기와 음량을 바꿔 틀기</caption>
 * import { Engine, EngineConfiguration, AudioAsset } from "./build/vanilla.js";
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * const audioManager = engine.getAudioManager();
 * const audioAsset = new AudioAsset();
 * await audioAsset.load("examples/assets/beep.wav");
 *
 * const audioPlayer = audioManager.createAudioPlayer();
 * audioPlayer.setAudioAsset(audioAsset);
 * audioPlayer.setVolume(0.8);
 * audioPlayer.setPlaybackRate(1.5);
 * audioPlayer.play(false);
 * console.log(audioPlayer.getDuration(), audioPlayer.getVolume());
 */
export class AudioPlayer {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { AudioContext | null } */ #audioContext;
	/** @private @type { AudioAsset | null } */ #audioAsset;
	/** @private @type { AudioBufferSourceNode | null } */ #audioSource;
	/** @private @type { GainNode | null } */ #gainNode;
	/** @private @type { boolean } */ #isPlaying;
	/** @private @type { boolean } */ #isMuted;
	/** @private @type { number } */ #volume; // 음량. (0 ~ 1, 음소거를 풀면 이 음량으로 돌아간다)
	/** @private @type { boolean } */ #isLoop; // 루프 여부.
	/** @private @type { number } */ #time; // 재생 위치 (초). play() 호출 시 이 위치부터 재생.
	/** @private @type { number } */ #playbackRate; // 재생 빠르기. (1 이면 그대로, 다음 play 부터)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { AudioContext | null } audioContext 재생에 쓸 오디오 컨텍스트. (null 이면 소리를 내지 않는 플레이어)
	 * @param { AudioNode | null } [outputNode] 소리를 내보낼 노드. (null 이면 audioContext.destination)
	 */
	constructor(audioContext, outputNode = null) {
		this.#audioContext = audioContext;
		this.#audioAsset = null;
		this.#audioSource = null;
		this.#gainNode = null;
		this.#isPlaying = false;
		this.#isMuted = false;
		this.#volume = 1;
		this.#isLoop = false;
		this.#time = 0;
		this.#playbackRate = 1;

		if (audioContext) {
			this.#gainNode = audioContext.createGain();
			this.#gainNode.connect(outputNode !== null ? outputNode : audioContext.destination);
		}
	}

	//==============================================================================
	// 재생.
	//==============================================================================
	/**
	 * @param { boolean } loop 반복 재생하면 참. (기본 거짓)
	 */
	play(loop = false) {
		const audioContext = this.getAudioContext();
		if (!audioContext || !this.#gainNode) {
			return;
		}
		const audioAsset = this.getAudioAsset();
		if (!audioAsset) {
			return;
		}
		const audioBuffer = audioAsset.getAudioBuffer();
		if (!audioBuffer) {
			return;
		}

		// 재생 중일 경우 정지.
		if (this.#audioSource) {
			this.#audioSource.onended = null;
			this.#audioSource.stop();
			this.#audioSource = null;
		}

		// 오디오 컨텍스트가 일시 중단된 경우 재개 후 재생.
		if (audioContext.state === "suspended") {
			audioContext.resume().then(() => {
				this.startPlayback(audioBuffer, loop);
			});
			return;
		}

		this.startPlayback(audioBuffer, loop);
	}

	//==============================================================================
	// 내부 재생 시작.
	//==============================================================================
	/**
	 * @param { AudioBuffer } audioBuffer 재생할 오디오 버퍼.
	 * @param { boolean } loop 반복 재생하면 참.
	 */
	startPlayback(audioBuffer, loop) {
		const audioContext = this.getAudioContext();
		if (!audioContext || !this.#gainNode) {
			return;
		}

		this.#isLoop = loop;
		this.#audioSource = audioContext.createBufferSource();
		this.#audioSource.buffer = audioBuffer;
		this.#audioSource.loop = loop;
		this.#audioSource.playbackRate.value = this.#playbackRate;
		this.#audioSource.connect(this.#gainNode);

		this.#audioSource.onended = () => {
			this.#isPlaying = false;
			this.#audioSource = null;
		};

		this.#audioSource.start(0, this.#time);
		this.#isPlaying = true;
	}

	//==============================================================================
	// 재생 빠르기 설정. (1 이면 그대로, 음 높이도 같이 바뀐다, 다음 play 부터, 0 이하이거나 숫자가 아니면 1)
	//==============================================================================
	/**
	 * @param { number } playbackRate 재생 빠르기. (1 이면 그대로)
	 */
	setPlaybackRate(playbackRate) {
		const isValid = typeof playbackRate === "number" && System.Number.isFinite(playbackRate) && playbackRate > 0;
		this.#playbackRate = isValid ? playbackRate : 1;
	}

	//==============================================================================
	// 정지.
	//==============================================================================
	stop() {
		if (this.#audioSource) {
			this.#audioSource.onended = null;
			this.#audioSource.stop();
			this.#audioSource = null;
		}
		this.#isPlaying = false;
	}

	//==============================================================================
	// 음소거.
	//==============================================================================
	mute() {
		if (this.#gainNode) {
			this.#gainNode.gain.value = 0;
			this.#isMuted = true;
		}
	}

	//==============================================================================
	// 음소거 해제. (설정한 음량으로 돌아간다)
	//==============================================================================
	unmute() {
		if (this.#gainNode) {
			this.#gainNode.gain.value = this.#volume;
			this.#isMuted = false;
		}
	}

	//==============================================================================
	// 음량 설정. (0 ~ 1, 음소거 중이면 음소거를 풀 때 적용된다)
	//==============================================================================
	/**
	 * @param { number } volume 음량. (0 ~ 1 로 자르고, 유한한 숫자가 아니면 1)
	 */
	setVolume(volume) {
		const clampedVolume = System.Number.isFinite(volume) ? System.Math.max(0, System.Math.min(1, volume)) : 1;
		this.#volume = clampedVolume;
		if (this.#gainNode && !this.#isMuted) {
			this.#gainNode.gain.value = clampedVolume;
		}
	}

	//==============================================================================
	// 음량 반환.
	//==============================================================================
	/**
	 * @returns { number } 음량. (0 ~ 1, 기본 1)
	 */
	getVolume() {
		return this.#volume;
	}

	//==============================================================================
	// 재생 위치 설정.
	// 재생 중이면 해당 위치부터 즉시 다시 재생.
	//==============================================================================
	/**
	 * @param { number } time 재생 위치 (초).
	 */
	setTime(time) {
		this.#time = time;
		if (this.#isPlaying) {
			this.play(this.#isLoop);
		}
	}

	//==============================================================================
	// 오디오 애셋 설정.
	//==============================================================================
	/**
	 * @param { AudioAsset } audioAsset 재생할 오디오 애셋. (다음 play 부터)
	 */
	setAudioAsset(audioAsset) {
		this.#audioAsset = audioAsset;
	}

	//==============================================================================
	// 오디오 애셋 반환.
	//==============================================================================
	/**
	 * @returns { AudioAsset | null } 오디오 애셋. (없으면 null)
	 */
	getAudioAsset() {
		return this.#audioAsset;
	}

	//==============================================================================
	// 재생 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 재생 중이면 참. (끝까지 재생되면 거짓이 된다)
	 */
	isPlaying() {
		return this.#isPlaying;
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
	// 현재 시간 반환. (0~duration)
	//==============================================================================
	/**
	 * @returns { number } setTime 으로 정한 재생 시작 위치. (초, 재생 중에 늘지 않는다)
	 */
	getTime() {
		return this.#time;
	}

	//==============================================================================
	// 재생 시간 반환.
	//==============================================================================
	/**
	 * @returns { number } 애셋의 재생 시간. (초, 애셋이 없으면 0)
	 */
	getDuration() {
		const audioAsset = this.getAudioAsset();
		if (!audioAsset) {
			return 0.0;
		}
		return audioAsset.getDuration();
	}

	//==============================================================================
	// 오디오 컨텍스트 반환.
	//==============================================================================
	/**
	 * @returns { AudioContext | null } 오디오 컨텍스트. (없으면 null)
	 */
	getAudioContext() {
		return this.#audioContext;
	}
}
