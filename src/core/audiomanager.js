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
//==============================================================================
export class AudioManager extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { AudioContext | null } */ #audioContext;

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
		const audioContextType = System.window.AudioContext || System.window.webkitAudioContext;
		if (audioContextType) {
			this.#audioContext = new audioContextType();
		}
	}

	//==============================================================================
	// 오디오 컨텍스트 재개.
	// 브라우저 자동재생 정책 및 창 전환으로 인한 suspend 상태를 복구한다.
	// iOS WebKit 은 표준 "suspended" 외에 비표준 "interrupted" 상태를 쓴다.
	// (앱 전환·시스템 팝업·오디오 세션 경합 등) 두 상태만 명시적으로 재개를 시도한다 —
	// "interrupted" 는 iOS 에만 존재하는 값이라 다른 플랫폼 동작은 기존과 완전히 동일하다.
	//==============================================================================
	resumeContext() {
		const audioContext = this.getAudioContext();
		if (audioContext) {
			if (audioContext.state === "suspended" || audioContext.state === "interrupted") {
				try {
					const resumePromise = audioContext.resume();
					if (resumePromise && typeof resumePromise.catch === "function") {
						resumePromise.catch(() => {
							// 제스처 제약 등으로 일시적으로 거부될 수 있다. 다음 재생 시도에서 재시도된다.
						});
					}
				}
				catch (error) {
					console.error(error);
				}
			}
		}
	}

	//==============================================================================
	// 오디오 플레이어 생성.
	//==============================================================================
	/**
	 * @returns { AudioPlayer }
	 */
	createAudioPlayer() {
		const audioContext = this.getAudioContext();
		return new AudioPlayer(audioContext);
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
