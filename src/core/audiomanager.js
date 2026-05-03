//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Engine } from "./engine.js";
import { AudioPlayer } from "./audioplayer.js";


//==============================================================================
// 오디오 매니저.
// 공유 AudioContext를 소유하며 AudioPlayer 생성을 담당한다.
//
// 브라우저 자동재생 정책 대응:
//  - 첫 user gesture (click/touch/keydown) 전에 AudioContext 를 만들면
//    브라우저가 console 경고("AudioContext was not allowed to start ...")를 띄운다.
//  - 그래서 AudioContext 는 lazy 생성 + user gesture 가 발생한 뒤에만 만든다.
//  - resumeContext() 도 user gesture 이전에는 silently no-op 한다.
//  - createAudioPlayer() 가 user gesture 전에 호출될 수 있는 경우를 위해
//    플레이어 생성 시점에는 (마지못해) AudioContext 를 만든다 — 이때만 경고가 날 수 있음.
//==============================================================================
export class AudioManager extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { AudioContext | null } */ #audioContext;
	/** @private @type { boolean } */ #hasUserGesture;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { Engine } engine
	 */
	constructor(engine) {
		super();
		this.#audioContext = null;
		this.#hasUserGesture = false;
		// AudioContext 는 user gesture 후에 lazy 생성 (브라우저 자동재생 정책).
	}

	//==============================================================================
	// 첫 user gesture 가 발생했음을 알린다. (Engine 의 click/touchstart/keydown 핸들러에서 호출)
	//==============================================================================
	markUserGesture() {
		this.#hasUserGesture = true;
	}

	//==============================================================================
	// user gesture 이후인지 여부.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	hasUserGesture() {
		return this.#hasUserGesture;
	}

	//==============================================================================
	// AudioContext 를 보장 (없으면 생성).
	//==============================================================================
	/**
	 * @private
	 * @returns { AudioContext | null }
	 */
	ensureAudioContext() {
		if (this.#audioContext) {
			return this.#audioContext;
		}
		const audioContextType = System.window.AudioContext || System.window.webkitAudioContext;
		if (audioContextType) {
			this.#audioContext = new audioContextType();
		}
		return this.#audioContext;
	}

	//==============================================================================
	// 오디오 컨텍스트 재개.
	// - user gesture 전에는 silently no-op (브라우저 경고 회피).
	// - resume() 의 promise rejection 도 silently 처리.
	//==============================================================================
	resumeContext() {
		if (!this.#hasUserGesture) {
			return;
		}
		const audioContext = this.ensureAudioContext();
		if (!audioContext) {
			return;
		}
		if (audioContext.state !== "suspended") {
			return;
		}
		try {
			const result = audioContext.resume();
			if (result && typeof result.catch === "function") {
				result.catch(() => {
					// user gesture 직후라도 일시적으로 거부될 수 있음. 다음 호출에서 재시도되므로 무시.
				});
			}
		}
		catch (error) {
			// 동기 예외도 무시.
		}
	}

	//==============================================================================
	// 오디오 플레이어 생성.
	//==============================================================================
	/**
	 * @returns { AudioPlayer }
	 */
	createAudioPlayer() {
		const audioContext = this.ensureAudioContext();
		return new AudioPlayer(audioContext);
	}

	//==============================================================================
	// 오디오 컨텍스트 반환. (없으면 null)
	//==============================================================================
	/**
	 * @returns { AudioContext | null }
	 */
	getAudioContext() {
		return this.#audioContext;
	}
}
