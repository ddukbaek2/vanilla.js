//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Asset } from "../core/asset.js";


//==============================================================================
// 오디오 애셋.
//==============================================================================
export class AudioAsset extends Asset {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { AudioContext | webkitAudioContext | null } */ #audioContext = null;
	/** @private @type { AudioBuffer | null } */ #audioBuffer = null;
	/** @private @type { AudioBufferSourceNode | null } */ #audioSource = null;
	/** @private @type { GainNode | null } */ #gainNode = null;
	/** @private @type { boolean } */ #isPlaying = false;
	/** @private @type { boolean } */ #isMuted = false;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();

		const audioContextType = System.window.AudioContext || System.window.webkitAudioContext;
		if (audioContextType) {
			this.#audioContext = new audioContextType();
			this.#gainNode = this.#audioContext.createGain();
			this.#gainNode.connect(this.#audioContext.destination);
		}

		this.#audioBuffer = null;
		this.#audioSource = null;
		this.#isMuted = false;
		this.#isPlaying = false;
	}

	//==============================================================================
	// 비동기 애셋 로드.
	//==============================================================================
	/**
	 * @override
	 * @param { string } assetPath 
	 */
	async load(assetPath) {
		// await super.load(assetPath);

		// 이미 로드 된 상태라면.
		if (super.isLoaded) {
			return Promise.resolve();
		}

		if (!this.#audioContext) {
			console.error(`AudioContext is not supported.`);
			return;
		}

		try {
			super.assetPath = assetPath;
			const response = await fetch(assetPath);
			const arrayBuffer = await response.arrayBuffer();
			this.#audioBuffer = await this.#audioContext.decodeAudioData(arrayBuffer);
			super.isLoaded = true;
		}
		catch (error) {
			console.error(`Error loading sound: ${super.assetPath}`, error);
			throw error;
		}
	}

	//==============================================================================
	// 재생.
	//==============================================================================
	/**
	 * @param { boolean } loop 
	 */
	play(loop = false) {
		if (!this.#audioContext || !this.#audioBuffer)
			return;

		// 재생 중일 경우 정지.
		if (this.#audioSource) {
			this.#audioSource.onended = null;
			this.#audioSource.stop();
		}

		// AudioBufferSourceNode.
		this.#audioSource = this.#audioContext.createBufferSource();
		this.#audioSource.buffer = this.#audioBuffer;
		this.#audioSource.loop = loop;
		this.#audioSource.connect(this.#gainNode);

		// 재생 완료 이벤트.
		this.#audioSource.onended = () => 
		{
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
			this.#audioSource.stop();
		}
	}

	//==============================================================================
	// 컨텍스트 재개.
	//==============================================================================
	resume() {
		if (this.#audioContext && this.#audioContext.state === "suspended") {
			this.#audioContext.resume();
		}
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
		if (this.#audioBuffer !== null && this.#audioBuffer !== undefined) {
			return this.#audioBuffer.duration;
		}
		return 0.0;
	}
}