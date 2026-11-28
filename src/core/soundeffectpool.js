//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { AudioPlayer } from "./audioplayer.js";


//==============================================================================
// 효과음 풀.
// - 같은 효과음이 연달아 겹쳐 나도 끊기지 않도록, 여러 AudioPlayer 를
//   돌려 가며(라운드로빈) 재생한다. (여러 게임이 6채널 풀을 제각각 구현하던 것)
// - 사용:
//     const pool = new SoundEffectPool(engine.getAudioManager(), 6);
//     pool.play(hitAudioAsset);
//     pool.play(hitAudioAsset, 0.5);   // 이 재생만 절반 음량.
//     pool.setVolume(0.8);             // 풀 전체의 음량. (재생 중인 것에도 곱해진다)
//==============================================================================
/**
 * @example <caption>같은 효과음을 겹쳐 내기</caption>
 * import { Engine, EngineConfiguration, AudioAsset, SoundEffectPool } from "./build/vanilla.js";
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * const audioManager = engine.getAudioManager();
 * const audioAsset = new AudioAsset();
 * await audioAsset.load("examples/assets/beep.wav");
 *
 * const soundEffectPool = new SoundEffectPool(audioManager, 4);
 * soundEffectPool.setVolume(0.8);
 * soundEffectPool.play(audioAsset);
 * soundEffectPool.play(audioAsset, 0.5);
 * console.log(soundEffectPool.getVoiceCount(), soundEffectPool.getVolume());
 * soundEffectPool.stopAll();
 */
export class SoundEffectPool extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { AudioPlayer[] } */ #playerList;
	/** @private @type { number[] } */ #playerVolumeList; // 플레이어마다 마지막 재생의 음량. (풀의 음량을 곱하기 전)
	/** @private @type { number } */ #nextIndex;
	/** @private @type { boolean } */ #isMuted;
	/** @private @type { number } */ #volume; // 풀 전체의 음량. (0 ~ 1)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { AudioManager } audioManager 엔진의 AudioManager. (engine.getAudioManager(), 플레이어를 만든다)
	 * @param { number } voiceCount 동시에 겹칠 수 있는 최대 재생 수.
	 */
	constructor(audioManager, voiceCount = 6) {
		super();

		this.#playerList = [];
		this.#playerVolumeList = [];
		this.#nextIndex = 0;
		this.#isMuted = false;
		this.#volume = 1;
		for (let index = 0; index < voiceCount; ++index) {
			this.#playerList.push(audioManager.createAudioPlayer());
			this.#playerVolumeList.push(1);
		}
	}

	//==============================================================================
	// 효과음 재생.
	// - 다음 차례의 플레이어에 애셋을 실어 재생한다. 그 플레이어가 재생 중이었다면 끊고 새로 튼다.
	// - 음량은 이 재생의 음량(0 ~ 1)에 풀의 음량을 곱한 것이다.
	//==============================================================================
	/**
	 * @param { AudioAsset } audioAsset 재생할 오디오 애셋. (없거나 음소거 중이면 내지 않는다)
	 * @param { number } volume 이 재생의 음량. (0 ~ 1, 기본 1)
	 */
	play(audioAsset, volume = 1) {
		if (this.#isMuted || !audioAsset || this.#playerList.length === 0) {
			return;
		}
		const playerIndex = this.#nextIndex;
		const player = this.#playerList[playerIndex];
		this.#nextIndex = (this.#nextIndex + 1) % this.#playerList.length;
		if (player.isPlaying()) {
			player.stop();
		}
		this.#playerVolumeList[playerIndex] = volume;
		player.setVolume(volume * this.#volume);
		player.setAudioAsset(audioAsset);
		player.play(false);
	}

	//==============================================================================
	// 모두 정지.
	//==============================================================================
	stopAll() {
		for (const player of this.#playerList) {
			if (player.isPlaying()) {
				player.stop();
			}
		}
	}

	//==============================================================================
	// 음소거 설정.
	//==============================================================================
	/**
	 * @param { boolean } isMuted 참이면 모든 플레이어를 음소거하고 새 재생도 하지 않는다.
	 */
	setMuted(isMuted) {
		this.#isMuted = isMuted;
		for (const player of this.#playerList) {
			if (isMuted) {
				player.mute();
			}
			else {
				player.unmute();
			}
		}
	}

	//==============================================================================
	// 풀 전체의 음량 설정. (0 ~ 1, 재생 중인 것에도 바로 곱해진다)
	//==============================================================================
	/**
	 * @param { number } volume 풀 전체의 음량. (0 ~ 1 로 자르고, 유한한 숫자가 아니면 1)
	 */
	setVolume(volume) {
		this.#volume = System.Number.isFinite(volume) ? System.Math.max(0, System.Math.min(1, volume)) : 1;
		for (let index = 0; index < this.#playerList.length; ++index) {
			this.#playerList[index].setVolume(this.#playerVolumeList[index] * this.#volume);
		}
	}

	//==============================================================================
	// 풀 전체의 음량.
	//==============================================================================
	/**
	 * @returns { number } 풀 전체의 음량. (0 ~ 1, 기본 1)
	 */
	getVolume() {
		return this.#volume;
	}

	//==============================================================================
	// 음소거 여부.
	//==============================================================================
	/**
	 * @returns { boolean } 음소거 중이면 참.
	 */
	isMuted() {
		return this.#isMuted;
	}

	//==============================================================================
	// 보이스 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 플레이어 수. (동시에 겹칠 수 있는 최대 재생 수)
	 */
	getVoiceCount() {
		return this.#playerList.length;
	}
}
