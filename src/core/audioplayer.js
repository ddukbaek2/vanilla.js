//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { AudioAsset } from "../resource/audioasset.js";


//==============================================================================
// 오디오 플레이어.
// AudioAsset 에 로드된 오디오 버퍼를 재생한다.
//==============================================================================
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

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { AudioContext | null } audioContext
	 */
	constructor(audioContext) {
		this.#audioContext = audioContext;
		this.#audioAsset = null;
		this.#audioSource = null;
		this.#gainNode = null;
		this.#isPlaying = false;
		this.#isMuted = false;
		this.#volume = 1;
		this.#isLoop = false;
		this.#time = 0;

		if (audioContext) {
			this.#gainNode = audioContext.createGain();
			this.#gainNode.connect(audioContext.destination);
		}
	}

	//==============================================================================
	// 재생.
	//==============================================================================
	/**
	 * @param { boolean } loop
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
	 * @param { AudioBuffer } audioBuffer
	 * @param { boolean } loop
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
		this.#audioSource.connect(this.#gainNode);

		this.#audioSource.onended = () => {
			this.#isPlaying = false;
			this.#audioSource = null;
		};

		this.#audioSource.start(0, this.#time);
		this.#isPlaying = true;
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
	 * @param { number } volume
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
	 * @returns { number }
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
	 * @param { AudioAsset } audioAsset
	 */
	setAudioAsset(audioAsset) {
		this.#audioAsset = audioAsset;
	}

	//==============================================================================
	// 오디오 애셋 반환.
	//==============================================================================
	/**
	 * @returns { AudioAsset | null }
	 */
	getAudioAsset() {
		return this.#audioAsset;
	}

	//==============================================================================
	// 재생 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isPlaying() {
		return this.#isPlaying;
	}

	//==============================================================================
	// 음소거 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isMuted() {
		return this.#isMuted;
	}

	//==============================================================================
	// 현재 시간 반환. (0~duration)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getTime() {
		return this.#time;
	}

	//==============================================================================
	// 재생 시간 반환.
	//==============================================================================
	/**
	 * @returns { number }
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
	 * @returns { AudioContext | null }
	 */
	getAudioContext() {
		return this.#audioContext;
	}
}
