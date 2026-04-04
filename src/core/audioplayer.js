//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { AudioAsset } from "../resource/audioasset.js";


//==============================================================================
// 공유 오디오 컨텍스트.
//==============================================================================
/** @type { AudioContext | null } */
let sharedAudioContext = null;


//==============================================================================
// 공유 오디오 컨텍스트 반환.
// 최초 호출 시 생성하며, 브라우저 정책으로 인한 일시정지(suspend) 자동 재개를 등록.
//==============================================================================
function getSharedAudioContext() {
	if (sharedAudioContext) {
		return sharedAudioContext;
	}
	const audioContextType = System.window.AudioContext || System.window.webkitAudioContext;
	if (!audioContextType) {
		return null;
	}
	sharedAudioContext = new audioContextType();
	setupAutoResume(sharedAudioContext);
	return sharedAudioContext;
}


//==============================================================================
// 브라우저 인터랙션 시 자동 재개 등록.
// 브라우저 자동재생 정책으로 suspended 상태가 될 경우 사용자 입력에서 재개.
//==============================================================================
/**
 * @param { AudioContext } audioContext
 */
function setupAutoResume(audioContext) {
	const resumeContext = () => {
		if (audioContext.state === "suspended") {
			audioContext.resume();
		}
	};
	System.window.addEventListener("click", resumeContext);
	System.window.addEventListener("touchstart", resumeContext);
	System.window.addEventListener("keydown", resumeContext);
	System.window.addEventListener("focus", resumeContext);
	System.document.addEventListener("visibilitychange", () => {
		if (System.document.visibilityState === "visible") {
			resumeContext();
		}
	});
}


//==============================================================================
// 오디오 플레이어.
// AudioAsset 에 로드된 오디오 버퍼를 재생한다.
//==============================================================================
export class AudioPlayer {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { AudioAsset | null } */ #audioAsset;
	/** @private @type { AudioBufferSourceNode | null } */ #audioSource;
	/** @private @type { GainNode | null } */ #gainNode;
	/** @private @type { boolean } */ #isPlaying;
	/** @private @type { boolean } */ #isMuted;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		this.#audioAsset = null;
		this.#audioSource = null;
		this.#gainNode = null;
		this.#isPlaying = false;
		this.#isMuted = false;

		const audioContext = getSharedAudioContext();
		if (audioContext) {
			this.#gainNode = audioContext.createGain();
			this.#gainNode.connect(audioContext.destination);
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
	// 재생.
	//==============================================================================
	/**
	 * @param { boolean } loop
	 */
	play(loop = false) {
		const audioContext = getSharedAudioContext();
		if (!audioContext || !this.#gainNode) {
			return;
		}
		if (!this.#audioAsset) {
			return;
		}
		const audioBuffer = this.#audioAsset.getAudioBuffer();
		if (!audioBuffer) {
			return;
		}

		// 재생 중일 경우 정지.
		if (this.#audioSource) {
			this.#audioSource.onended = null;
			this.#audioSource.stop();
			this.#audioSource = null;
		}

		// 컨텍스트가 일시 중단된 경우 재개 시도.
		if (audioContext.state === "suspended") {
			audioContext.resume();
		}

		this.#audioSource = audioContext.createBufferSource();
		this.#audioSource.buffer = audioBuffer;
		this.#audioSource.loop = loop;
		this.#audioSource.connect(this.#gainNode);

		this.#audioSource.onended = () => {
			this.#isPlaying = false;
			this.#audioSource = null;
		};

		this.#audioSource.start(0);
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
	// 음소거 해제.
	//==============================================================================
	unmute() {
		if (this.#gainNode) {
			this.#gainNode.gain.value = 1;
			this.#isMuted = false;
		}
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
	// 재생 시간 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getDuration() {
		if (!this.#audioAsset) {
			return 0.0;
		}
		return this.#audioAsset.getDuration();
	}
}
