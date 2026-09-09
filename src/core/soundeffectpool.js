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
//==============================================================================
export class SoundEffectPool extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { AudioPlayer[] } */ #playerList;
	/** @private @type { number } */ #nextIndex;
	/** @private @type { boolean } */ #isMuted;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { AudioManager } audioManager
	 * @param { number } voiceCount 동시에 겹칠 수 있는 최대 재생 수.
	 */
	constructor(audioManager, voiceCount = 6) {
		super();

		this.#playerList = [];
		this.#nextIndex = 0;
		this.#isMuted = false;
		for (let index = 0; index < voiceCount; ++index) {
			this.#playerList.push(audioManager.createAudioPlayer());
		}
	}

	//==============================================================================
	// 효과음 재생.
	// - 다음 차례의 플레이어에 애셋을 실어 재생한다. 그 플레이어가 재생 중이었다면 끊고 새로 튼다.
	//==============================================================================
	/**
	 * @param { AudioAsset } audioAsset
	 */
	play(audioAsset) {
		if (this.#isMuted || !audioAsset) {
			return;
		}
		const player = this.#playerList[this.#nextIndex];
		this.#nextIndex = (this.#nextIndex + 1) % this.#playerList.length;
		if (player.isPlaying()) {
			player.stop();
		}
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
	 * @param { boolean } isMuted
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
	// 음소거 여부.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isMuted() {
		return this.#isMuted;
	}

	//==============================================================================
	// 보이스 수 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getVoiceCount() {
		return this.#playerList.length;
	}
}
