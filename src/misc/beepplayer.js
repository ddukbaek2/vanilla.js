//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";


//==============================================================================
// 절차적 비프 재생기.
// - 오디오 파일 없이 OscillatorNode + GainNode 로 UI 효과음을 합성한다.
//   attack / sustain / release 엔벨로프로 클릭음이 나지 않게 스케줄링한다.
// - click / confirm / cancel / error / success / warning / notification 프리셋과
//   임의 톤 시퀀스 재생(playSequence)을 제공한다.
// - 사용:
//     const beepPlayer = new BeepPlayer(engine.getAudioManager());
//     beepPlayer.playPreset("confirm");
//==============================================================================
export class BeepPlayer extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { AudioManager } */ #audioManager;
	/** @private @type { number } */ #volume;
	/** @private @type { boolean } */ #isMuted;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { AudioManager } audioManager
	 * @param { number } volume 0 ~ 1.
	 */
	constructor(audioManager, volume = 0.35) {
		super();

		this.#audioManager = audioManager;
		this.#volume = volume;
		this.#isMuted = false;
	}

	//==============================================================================
	// 단일 톤 재생.
	//==============================================================================
	/**
	 * @param { number } frequency 주파수. (Hz)
	 * @param { number } durationSeconds 길이. (초)
	 * @param { string } waveform "sine" | "square" | "sawtooth" | "triangle"
	 * @param { number } delaySeconds 시작 지연. (초)
	 * @param { number } volumeScale 이 톤만의 음량 배율.
	 */
	playTone(frequency, durationSeconds = 0.08, waveform = "sine", delaySeconds = 0, volumeScale = 1) {
		if (this.#isMuted) {
			return;
		}
		this.#audioManager.resumeContext();
		const audioContext = this.#audioManager.getAudioContext();
		if (!audioContext || audioContext.state !== "running") {
			return;
		}
		const startTime = audioContext.currentTime + delaySeconds;
		const endTime = startTime + durationSeconds;
		const attackSeconds = System.Math.min(0.005, durationSeconds * 0.25);
		const releaseSeconds = System.Math.min(0.02, durationSeconds * 0.5);
		const peakVolume = System.Math.max(0.0001, this.#volume * volumeScale);

		const oscillatorNode = audioContext.createOscillator();
		oscillatorNode.type = waveform;
		oscillatorNode.frequency.setValueAtTime(frequency, startTime);

		const gainNode = audioContext.createGain();
		gainNode.gain.setValueAtTime(0.0001, startTime);
		gainNode.gain.linearRampToValueAtTime(peakVolume, startTime + attackSeconds);
		gainNode.gain.setValueAtTime(peakVolume, System.Math.max(startTime + attackSeconds, endTime - releaseSeconds));
		gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

		oscillatorNode.connect(gainNode);
		gainNode.connect(audioContext.destination);
		oscillatorNode.start(startTime);
		oscillatorNode.stop(endTime + 0.01);
		oscillatorNode.onended = () => {
			oscillatorNode.disconnect();
			gainNode.disconnect();
		};
	}

	//==============================================================================
	// 톤 시퀀스 재생.
	// - [{ frequency, duration, waveform?, volumeScale? }, ...] 를 차례로 이어 튼다.
	//==============================================================================
	/**
	 * @param { object[] } toneList
	 */
	playSequence(toneList) {
		let delaySeconds = 0;
		for (const tone of toneList) {
			this.playTone(
				tone.frequency,
				tone.duration,
				tone.waveform ? tone.waveform : "sine",
				delaySeconds,
				(tone.volumeScale !== undefined) ? tone.volumeScale : 1);
			delaySeconds += tone.duration;
		}
	}

	//==============================================================================
	// 프리셋 재생.
	//==============================================================================
	/**
	 * @param { string } presetName "click" | "confirm" | "cancel" | "error" | "success" | "warning" | "notification"
	 */
	playPreset(presetName) {
		switch (presetName) {
			case "click": {
				this.playTone(880, 0.045, "sine");
				break;
			}
			case "confirm": {
				this.playSequence([
					{ frequency: 660, duration: 0.06 },
					{ frequency: 990, duration: 0.09 },
				]);
				break;
			}
			case "cancel": {
				this.playSequence([
					{ frequency: 520, duration: 0.06 },
					{ frequency: 360, duration: 0.09 },
				]);
				break;
			}
			case "error": {
				this.playSequence([
					{ frequency: 220, duration: 0.1, waveform: "square", volumeScale: 0.7 },
					{ frequency: 180, duration: 0.14, waveform: "square", volumeScale: 0.7 },
				]);
				break;
			}
			case "success": {
				this.playSequence([
					{ frequency: 523, duration: 0.07 },
					{ frequency: 659, duration: 0.07 },
					{ frequency: 784, duration: 0.12 },
				]);
				break;
			}
			case "warning": {
				this.playSequence([
					{ frequency: 740, duration: 0.08, waveform: "triangle" },
					{ frequency: 740, duration: 0.08, waveform: "triangle" },
				]);
				break;
			}
			case "notification": {
				this.playSequence([
					{ frequency: 1047, duration: 0.06 },
					{ frequency: 1319, duration: 0.1 },
				]);
				break;
			}
			default: {
				this.playTone(880, 0.045, "sine");
				break;
			}
		}
	}

	//==============================================================================
	// 기본 음량 설정.
	//==============================================================================
	/**
	 * @param { number } volume 0 ~ 1.
	 */
	setVolume(volume) {
		this.#volume = System.Math.max(0, System.Math.min(1, volume));
	}

	//==============================================================================
	// 기본 음량 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getVolume() {
		return this.#volume;
	}

	//==============================================================================
	// 음소거 설정.
	//==============================================================================
	/**
	 * @param { boolean } isMuted
	 */
	setMuted(isMuted) {
		this.#isMuted = isMuted;
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
}
